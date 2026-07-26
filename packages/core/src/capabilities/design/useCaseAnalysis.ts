/**
 * EUC-01 — Use-case analysis core.
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §5, §7, §16,
 * §25.3 (EUC-01). Builds and evolves the canonical `UseCaseAnalysis` record
 * (CAP-PLAN-001..016). Pure and deterministic: no I/O, no clock reads except
 * where a caller supplies a timestamp explicitly. Adapters own source-content
 * retrieval, persistence, and audit writing.
 */

import type {
  AnalysisItem,
  AnalysisItemStatus,
  AnalysisQuestion,
  AnalysisSource,
  DesignApproval,
  DesignDiagnostic,
  DesignRecordState,
  GateResult,
  ScenarioStep,
  UseCaseAnalysis,
  UseCaseDefinition,
} from './records.js'
import { isNonHumanActor } from './records.js'
import { canonicalHash, childId, designContentHash, firstRevision, nextRevision, stableSortStrings } from './identity.js'
import { diagnostic, sortDiagnostics, type CapDiagnostic } from '../diagnostics.js'

export { canonicalHash }

/** §7.1 / §7.3 — stable diagnostic codes owned by EUC-01. */
export const EUC01_DIAGNOSTIC_CODES = {
  sourceFailedOptional: 'EUC01-SOURCE-FAILED-OPTIONAL',
  sourceFailedRequired: 'EUC01-SOURCE-FAILED-REQUIRED',
  materialQuestionOpen: 'EUC01-MATERIAL-QUESTION-OPEN',
  conflictingItem: 'EUC01-CONFLICTING-ITEM',
  useCaseRequired: 'EUC01-USE-CASE-REQUIRED',
  useCaseMissingActor: 'EUC01-USE-CASE-MISSING-ACTOR',
  useCaseMissingOutput: 'EUC01-USE-CASE-MISSING-OUTPUT',
  useCaseMissingAcceptance: 'EUC01-USE-CASE-MISSING-ACCEPTANCE',
  notReadyForReview: 'EUC01-NOT-READY-FOR-REVIEW',
  agentActorForbidden: 'EUC01-AGENT-ACTOR-FORBIDDEN',
  alreadyApproved: 'EUC01-ALREADY-APPROVED',
  unknownQuestion: 'EUC01-UNKNOWN-QUESTION',
  unknownItem: 'EUC01-UNKNOWN-ITEM',
} as const

/** Input the Describe view collects (CAP-PLAN-001, CAP-PLAN-002). No record
 * IDs, schemas, modules, ports, or adapters are required from the user
 * (CAP-PLAN-004). */
export type UseCaseAnalysisInput = {
  projectId: string
  workDescription: string
  examples?: string[]
  prohibitedResults?: string[]
  sources?: {
    name: string
    ref: string
    required: boolean
    status?: 'ok' | 'failed'
    failureCause?: string
  }[]
}

/** Uniform result shape for every EUC-01 operation — never throws for a
 * domain rejection; the caller inspects `diagnostics` instead. */
export type UseCaseAnalysisResult = {
  analysis: UseCaseAnalysis
  diagnostics: DesignDiagnostic[]
}

export type AnalysisReviewCounts = Record<AnalysisItemStatus, number>

export type UseCaseContentTarget =
  | {
      kind: 'useCaseContent'
      useCaseId: string
      content: 'scalar'
      field: 'name' | 'trigger' | 'recoveryBehavior'
      action: 'accept' | 'correct' | 'reject'
      text?: string
    }
  | {
      kind: 'useCaseContent'
      useCaseId: string
      content: 'list'
      field: 'preconditions' | 'inputs' | 'outputs' | 'sourceLinks'
      action: 'accept' | 'correct' | 'reject' | 'add'
      index?: number
      text?: string
    }
  | {
      kind: 'useCaseContent'
      useCaseId: string
      content: 'step'
      stepId: string
      field: 'action' | 'expectedResult'
      action: 'accept' | 'correct' | 'reject'
      text?: string
    }
  | {
      kind: 'useCaseContent'
      useCaseId: string
      content: 'path'
      pathKind: 'alternatePaths' | 'failurePaths'
      scenarioId: string
      action: 'accept' | 'correct' | 'reject'
      text?: string
    }

/** Build a DesignDiagnostic with a stable, deterministic id. Shared with
 * EUC-02, which depends on EUC-01 (§25.2). */
export function designDiagnostic(
  code: string,
  severity: DesignDiagnostic['severity'],
  message: string,
  extras: Partial<Omit<DesignDiagnostic, 'id' | 'code' | 'severity' | 'message'>> = {},
): DesignDiagnostic {
  const id = extras.target ? `${code}:${extras.target}` : code
  return { id, code, severity, message, ...extras }
}

export function sortDesignDiagnostics(diagnostics: DesignDiagnostic[]): DesignDiagnostic[] {
  return [...diagnostics].sort((a, b) => {
    const code = a.code.localeCompare(b.code)
    if (code !== 0) return code
    const target = (a.target ?? '').localeCompare(b.target ?? '')
    if (target !== 0) return target
    return a.message.localeCompare(b.message)
  })
}

/** Convert a Plan-gate diagnostic (CapDiagnostic, no severity) to the
 * DesignDiagnostic shape operations return. Gate diagnostics are always
 * treated as blocking — the gate itself only carries blocking conditions. */
export function toDesignDiagnostic(capDiagnostic: CapDiagnostic): DesignDiagnostic {
  return {
    id: capDiagnostic.fieldPath ? `${capDiagnostic.code}:${capDiagnostic.fieldPath}` : capDiagnostic.code,
    code: capDiagnostic.code,
    severity: 'blocker',
    message: capDiagnostic.message,
    relatedIds: capDiagnostic.relatedIds,
    target: capDiagnostic.fieldPath,
  }
}

function allAnalysisItems(analysis: UseCaseAnalysis): AnalysisItem[] {
  return [
    ...analysis.actors,
    ...analysis.rules,
    ...analysis.qualityNeeds,
    ...analysis.useCases.flatMap((uc) => uc.acceptanceChecks),
  ]
}

/**
 * §7.3 — Plan gate (CAP-PLAN-015, CAP-PLAN-016). Blocks approval when a main
 * use case lacks an actor, result/output, or acceptance check, or when a
 * material question, required-source failure, or conflicting item is open.
 */
export function evaluatePlanGate(analysis: UseCaseAnalysis): GateResult {
  const diagnostics: CapDiagnostic[] = []

  if (!analysis.useCases.length) {
    diagnostics.push(
      diagnostic(EUC01_DIAGNOSTIC_CODES.useCaseRequired, 'at least one main use case is required', {
        ruleId: 'CAP-PLAN-015',
        fieldPath: 'useCases',
      }),
    )
  }

  for (const useCase of analysis.useCases) {
    if (!useCase.actors.length) {
      diagnostics.push(
        diagnostic(EUC01_DIAGNOSTIC_CODES.useCaseMissingActor, `use case has no actor: ${useCase.id}`, {
          ruleId: 'CAP-PLAN-015',
          fieldPath: `useCases.${useCase.id}.actors`,
          relatedIds: [useCase.id],
        }),
      )
    }
    if (!useCase.outputs.length) {
      diagnostics.push(
        diagnostic(EUC01_DIAGNOSTIC_CODES.useCaseMissingOutput, `use case has no result or output: ${useCase.id}`, {
          ruleId: 'CAP-PLAN-015',
          fieldPath: `useCases.${useCase.id}.outputs`,
          relatedIds: [useCase.id],
        }),
      )
    }
    if (!useCase.acceptanceChecks.length) {
      diagnostics.push(
        diagnostic(EUC01_DIAGNOSTIC_CODES.useCaseMissingAcceptance, `use case has no acceptance check: ${useCase.id}`, {
          ruleId: 'CAP-PLAN-015',
          fieldPath: `useCases.${useCase.id}.acceptanceChecks`,
          relatedIds: [useCase.id],
        }),
      )
    }
  }

  const openMaterialQuestions = analysis.questions.filter((q) => q.material && !q.answer)
  if (openMaterialQuestions.length) {
    diagnostics.push(
      diagnostic(EUC01_DIAGNOSTIC_CODES.materialQuestionOpen, 'a material question is open', {
        ruleId: 'CAP-PLAN-016',
        fieldPath: 'questions',
        relatedIds: openMaterialQuestions.map((q) => q.id),
      }),
    )
  }

  const failedRequiredSources = analysis.sources.filter((s) => s.required && s.status === 'failed')
  for (const source of failedRequiredSources) {
    diagnostics.push(
      diagnostic(
        EUC01_DIAGNOSTIC_CODES.sourceFailedRequired,
        `required source failed: ${source.name}${source.failureCause ? ` (${source.failureCause})` : ''}`,
        { ruleId: 'CAP-PLAN-006', fieldPath: `sources.${source.id}`, relatedIds: [source.id] },
      ),
    )
  }

  const conflicting = allAnalysisItems(analysis).filter((item) => item.status === 'conflicting')
  if (conflicting.length) {
    diagnostics.push(
      diagnostic(EUC01_DIAGNOSTIC_CODES.conflictingItem, 'a conflicting item is open', {
        ruleId: 'CAP-PLAN-016',
        fieldPath: 'items',
        relatedIds: conflicting.map((item) => item.id),
      }),
    )
  }

  const sorted = sortDiagnostics(diagnostics)
  return { gateId: 'CAP-PLAN-GATE', passed: sorted.length === 0, diagnostics: sorted }
}

/** §5.2 state derivation: a material question blocks with `needsInput`;
 * otherwise the Plan gate decides between `draft` and `readyForReview`. */
function deriveStatus(analysis: UseCaseAnalysis, gate: GateResult): DesignRecordState {
  const hasOpenMaterialQuestion = analysis.questions.some((q) => q.material && !q.answer)
  if (hasOpenMaterialQuestion) return 'needsInput'
  if (!gate.passed) return 'draft'
  return 'readyForReview'
}

function finalizeAnalysis(base: UseCaseAnalysis): UseCaseAnalysis {
  const gate = evaluatePlanGate(base)
  const status = deriveStatus(base, gate)
  const withStatusAndGate: UseCaseAnalysis = { ...base, status, gates: [gate] }
  const contentHash = designContentHash(withStatusAndGate)
  return { ...withStatusAndGate, contentHash }
}

function withNextRevision(analysis: UseCaseAnalysis, patch: Partial<UseCaseAnalysis>): UseCaseAnalysis {
  const revision = nextRevision(analysis.revision)
  const merged: UseCaseAnalysis = { ...analysis, ...patch, revision, approval: undefined }
  return finalizeAnalysis(merged)
}

const ACTOR_ACTION =
  'needs?|wants?|can|must|should|shall|runs?|uses?|reviews?|creates?|approves?|validates?|submits?|opens?|views?|manages?|tracks?|configures?|records?|checks?|uploads?|downloads?|requests?|starts?|performs?|refreshes?'

function sentenceFragments(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]?/g) ?? [])
    .map((sentence) => sentence.trim().replace(/[.!?]+$/, ''))
    .filter(Boolean)
}

function sentenceCase(text: string): string {
  const trimmed = text.trim().replace(/[.!?]+$/, '')
  return trimmed ? `${trimmed[0]!.toUpperCase()}${trimmed.slice(1)}` : ''
}

function inferPrimaryActor(description: string): string {
  const firstSentence = sentenceFragments(description)[0] ?? ''
  const match = firstSentence.match(new RegExp(`^(?:an?|the)\\s+(.{1,64}?)\\s+(?:${ACTOR_ACTION})\\b`, 'i'))
  return match ? sentenceCase(match[1]!) : 'Primary user'
}

function inferUseCaseName(description: string): string {
  const firstSentence = sentenceFragments(description)[0] ?? description
  const purpose = firstSentence.match(
    /\bto\s+((?:approve|build|check|configure|create|deliver|inspect|manage|open|record|report|review|run|submit|track|validate|verify)\b[^,;.!?]*)/i,
  )
  if (purpose) return sentenceCase(purpose[1]!)

  const actorLead = firstSentence.match(new RegExp(`^(?:an?|the)\\s+.{1,64}?\\s+(${ACTOR_ACTION})\\b\\s*(.*)$`, 'i'))
  if (actorLead) {
    const verb = actorLead[1]!
      .replace(/ies$/i, 'y')
      .replace(/(sh|ch|x|z|ss|o)es$/i, '$1')
      .replace(/s$/i, '')
    return sentenceCase(`${verb} ${actorLead[2]!.split(',')[0]}`.trim())
  }

  return sentenceCase(firstSentence)
}

function requirementClauses(description: string): string[] {
  const sentences = sentenceFragments(description)
  const firstSentenceClauses = sentences[0]?.includes(',') ? sentences[0]!.split(',').slice(1) : []
  const requirementSentences = [...firstSentenceClauses, ...sentences.slice(1)]
  return requirementSentences
    .flatMap((sentence) => sentence.split(/,\s*(?:and\s+)?|\s+and\s+(?=(?:allow|ensure|keep|notify|preserve|prevent|record|reject|report|restore|retain|retry|return|show)\b)/i))
    .map((clause) =>
      clause
        .trim()
        .replace(/^(?:the\s+(?:application|service|system|tool|workflow)|it)\s+(?:must|shall|should|will)\s+/i, '')
        .replace(/^(?:and|then)\s+/i, ''),
    )
    .filter(Boolean)
}

function passiveOutcome(requirement: string): string {
  const normalized = requirement.trim().replace(/[.!?]+$/, '')
  const passive = normalized
    .replace(/^report\s+(an?|the)\s+(.+)$/i, (_match, article: string, result: string) => `${article} ${result} is reported`)
    .replace(/^preserve\s+(an?|the)\s+(.+)$/i, (_match, article: string, result: string) => `${article} ${result} is preserved`)
    .replace(/^retain\s+evidence\s+that\s+an?\s+independent\s+reviewer\s+can\s+inspect$/i, 'evidence is retained for independent review')
    .replace(/^retain\s+(.+)$/i, (_match, result: string) => `${result} is retained`)
    .replace(/^record\s+(.+)$/i, (_match, result: string) => `${result} is recorded`)
    .replace(/^return\s+(.+)$/i, (_match, result: string) => `${result} is returned`)
  if (passive !== normalized) return `${sentenceCase(passive)}.`
  return `The workflow satisfies the requirement to ${normalized}.`
}

function inferredExpectedResult(exampleIndex: number, exampleCount: number, requirements: string[]): string {
  if (requirements.length === 0) return 'The described outcome is observable and reviewable.'
  const requirementIndex = exampleCount <= 1
    ? 0
    : Math.round((exampleIndex / (exampleCount - 1)) * (requirements.length - 1))
  return passiveOutcome(requirements[requirementIndex]!)
}

function inferRecoveryBehavior(requirements: string[]): string {
  const recovery = requirements.filter((requirement) =>
    /\b(?:preserv\w*|recover\w*|restore\w*|retry|roll\s*back|last approved|on fail\w*|after fail\w*)\b/i.test(requirement),
  )
  return recovery.length ? recovery.map(sentenceCase).join('; ') + '.' : ''
}

function inferredFailureScenario(prohibitedResult: string, index: number, useCaseId: string) {
  const prohibitedOutcome = prohibitedResult.trim().replace(/^never\s+/i, '').replace(/[.!?]+$/, '')
  const protectsApprovedResult = /\b(?:replace|overwrite)\b.*\blast approved result\b/i.test(prohibitedOutcome)
  const scenarioId = childId(useCaseId, 'scenario', `failure.${index + 1}.${prohibitedResult}`)
  const step: ScenarioStep = {
    id: childId(scenarioId, 'step', 'prevent-prohibited-result'),
    action: protectsApprovedResult
      ? 'Run validation when the current attempt fails'
      : `Exercise the failure path related to: ${prohibitedOutcome}`,
    expectedResult: protectsApprovedResult
      ? 'The last approved result remains unchanged after the failed validation.'
      : `The prohibited outcome is prevented: ${prohibitedOutcome}.`,
    visibleResult: true,
  }
  return {
    id: scenarioId,
    name: protectsApprovedResult
      ? 'Preserve the last approved result on failure'
      : `Prevent prohibited outcome ${index + 1}`,
    kind: 'failure' as const,
    steps: [step],
  }
}

/**
 * §7.1 / §7.2 — build the first use-case draft from a plain work description.
 * Deterministic: the same input produces the same ids and contentHash. Always
 * generates at least one main use case with stable scenario/step IDs
 * (CAP-PLAN-001, CAP-PLAN-004).
 */
export function createUseCaseDraft(input: UseCaseAnalysisInput): UseCaseAnalysisResult {
  if (typeof input?.projectId !== 'string' || !input.projectId.trim()) {
    throw new Error('createUseCaseDraft requires a projectId')
  }
  if (typeof input.workDescription !== 'string') {
    throw new Error('createUseCaseDraft requires a workDescription string')
  }

  const description = input.workDescription.trim()
  const hasDescription = description.length > 0
  const useCaseName = hasDescription ? inferUseCaseName(description) : 'Untitled work'
  const primaryActorText = hasDescription ? inferPrimaryActor(description) : 'Primary user'
  const requirements = requirementClauses(description)
  const recoveryBehavior = inferRecoveryBehavior(requirements)

  const analysisId = childId(input.projectId, 'use-case-analysis', description || 'untitled')
  const useCaseId = childId(analysisId, 'use-case', 'main')
  const mainScenarioId = childId(useCaseId, 'scenario', 'main')

  const examples = (input.examples ?? []).filter((example) => typeof example === 'string' && example.trim())
  const mainFlow: ScenarioStep[] = examples.length
    ? examples.map((example, index) => ({
        id: childId(useCaseId, 'step', `${index + 1}.${example}`),
        action: example,
        expectedResult: inferredExpectedResult(index, examples.length, requirements),
        visibleResult: true,
      }))
    : [
        {
          id: childId(useCaseId, 'step', 'primary'),
          action: useCaseName,
          expectedResult: requirements.length ? passiveOutcome(requirements[0]!) : 'The described outcome is observable and reviewable.',
          visibleResult: true,
        },
      ]

  const primaryActorId = childId(analysisId, 'actor', primaryActorText)
  const actors: AnalysisItem[] = [{ id: primaryActorId, text: primaryActorText, status: 'inferred' }]
  const prohibitedResults = [...(input.prohibitedResults ?? [])]
  const failurePaths = prohibitedResults.map((prohibitedResult, index) =>
    inferredFailureScenario(prohibitedResult, index, useCaseId),
  )
  const recoveryScenario = recoveryBehavior
    ? {
        id: childId(useCaseId, 'scenario', 'recovery'),
        name: `Recover from a failed attempt to ${useCaseName.toLocaleLowerCase()}`,
        kind: 'recovery' as const,
        steps: [
          {
            id: childId(useCaseId, 'step', 'recovery'),
            action: `Recover after an attempt to ${useCaseName.toLocaleLowerCase()} fails`,
            expectedResult: recoveryBehavior,
            visibleResult: true,
          },
        ],
      }
    : undefined
  const scenarios = [
    { id: mainScenarioId, name: useCaseName, kind: 'main' as const, steps: mainFlow },
    ...failurePaths,
    ...(recoveryScenario ? [recoveryScenario] : []),
  ]

  const acceptanceCheckId = childId(useCaseId, 'acceptance', 'primary')
  const useCase: UseCaseDefinition = {
    id: useCaseId,
    name: useCaseName,
    actors: [primaryActorId],
    trigger: `${primaryActorText} needs to ${useCaseName.toLocaleLowerCase()}.`,
    preconditions: [],
    mainFlow,
    alternatePaths: [],
    failurePaths,
    recoveryBehavior,
    rules: [],
    inputs: [],
    outputs: requirements.length ? requirements.map(passiveOutcome) : [`Completed outcome: ${useCaseName}`],
    acceptanceChecks: [
      {
        id: acceptanceCheckId,
        text: requirements.length
          ? `The primary path satisfies the approved requirements to ${requirements.join('; ')}.`
          : `The work "${useCaseName}" is completed with an observable, reviewable result.`,
        status: 'inferred',
      },
    ],
    sourceLinks: [],
    scenarios,
  }

  const sources: AnalysisSource[] = (input.sources ?? []).map((source, index) => ({
    id: childId(analysisId, 'source', source.name || source.ref || String(index)),
    name: source.name,
    ref: source.ref,
    required: source.required,
    readOnly: true,
    status: source.status ?? 'ok',
    ...(source.failureCause ? { failureCause: source.failureCause } : {}),
  }))

  const questions: AnalysisQuestion[] = hasDescription
    ? []
    : [
        {
          id: childId(analysisId, 'question', 'work-description'),
          text: 'What is the work description?',
          material: true,
        },
      ]

  const base: UseCaseAnalysis = {
    schemaVersion: '1.0',
    projectId: input.projectId,
    id: analysisId,
    revision: firstRevision(),
    status: 'draft',
    workDescription: description,
    examples,
    prohibitedResults,
    actors,
    useCases: [useCase],
    rules: [],
    qualityNeeds: [],
    sources,
    questions,
    gates: [],
    contentHash: '',
  }

  const analysis = finalizeAnalysis(base)

  // CAP-PLAN-005 / CAP-PLAN-006 — a failed optional source warns but stays
  // valid; a failed required source is also surfaced here for visibility (the
  // Plan gate blocks approval on it independently).
  const sourceDiagnostics = sortDesignDiagnostics(
    sources
      .filter((source) => source.status === 'failed')
      .map((source) =>
        designDiagnostic(
          source.required ? EUC01_DIAGNOSTIC_CODES.sourceFailedRequired : EUC01_DIAGNOSTIC_CODES.sourceFailedOptional,
          source.required ? 'blocker' : 'warning',
          `${source.required ? 'required' : 'optional'} source failed: ${source.name}${
            source.failureCause ? ` (${source.failureCause})` : ''
          }`,
          { target: source.id, relatedIds: [source.id] },
        ),
      ),
  )

  return { analysis, diagnostics: sourceDiagnostics }
}

/** §7.3 — counts by item status, not a completion percentage (CAP-PLAN-010,
 * CAP-PLAN-011). */
export function reviewCounts(analysis: UseCaseAnalysis): AnalysisReviewCounts {
  const counts: AnalysisReviewCounts = {
    sourced: 0,
    inferred: 0,
    confirmed: 0,
    changed: 0,
    conflicting: 0,
    rejected: 0,
  }
  for (const item of allAnalysisItems(analysis)) {
    counts[item.status] += 1
  }
  return counts
}

function transformAnalysisItem(
  analysis: UseCaseAnalysis,
  itemId: string,
  transform: (item: AnalysisItem) => AnalysisItem,
): UseCaseAnalysisResult {
  let found = false
  const applyList = (items: AnalysisItem[]): AnalysisItem[] =>
    items.map((item) => {
      if (item.id !== itemId) return item
      found = true
      return transform(item)
    })

  const actors = applyList(analysis.actors)
  const rules = applyList(analysis.rules)
  const qualityNeeds = applyList(analysis.qualityNeeds)
  const useCases = analysis.useCases.map((uc) => ({ ...uc, acceptanceChecks: applyList(uc.acceptanceChecks) }))

  if (!found) {
    return {
      analysis,
      diagnostics: [
        designDiagnostic(EUC01_DIAGNOSTIC_CODES.unknownItem, 'blocker', `analysis item not found: ${itemId}`, {
          target: itemId,
        }),
      ],
    }
  }

  const updated = withNextRevision(analysis, { actors, rules, qualityNeeds, useCases })
  return { analysis: updated, diagnostics: [] }
}

/** CAP-PLAN-013 — accept an inferred (or sourced) item: marks it confirmed. */
export function acceptAnalysisItem(analysis: UseCaseAnalysis, itemId: string, actor: string): UseCaseAnalysisResult {
  void actor
  return transformAnalysisItem(analysis, itemId, (item) => ({ ...item, status: 'confirmed' }))
}

/** CAP-PLAN-013 — correct an item's text: marks it changed. */
export function correctAnalysisItem(
  analysis: UseCaseAnalysis,
  itemId: string,
  text: string,
  actor: string,
): UseCaseAnalysisResult {
  void actor
  return transformAnalysisItem(analysis, itemId, (item) => ({ ...item, text, status: 'changed' }))
}

/** CAP-PLAN-013 — reject an item: it no longer counts toward Plan-gate
 * content but stays visible for audit. */
export function rejectAnalysisItem(analysis: UseCaseAnalysis, itemId: string, actor: string): UseCaseAnalysisResult {
  void actor
  return transformAnalysisItem(analysis, itemId, (item) => ({ ...item, status: 'rejected' }))
}

/**
 * Reviews structural use-case content with the same accept/correct/reject
 * semantics as inferred `AnalysisItem`s. Corrections update the canonical
 * field itself; rejection removes list/path/step content while retaining a
 * stable review disposition for scalar identity fields.
 */
export function updateUseCaseContent(
  analysis: UseCaseAnalysis,
  target: UseCaseContentTarget,
  actor: string,
): UseCaseAnalysisResult {
  void actor
  const index = analysis.useCases.findIndex((candidate) => candidate.id === target.useCaseId)
  if (index === -1) {
    return {
      analysis,
      diagnostics: [designDiagnostic(EUC01_DIAGNOSTIC_CODES.unknownItem, 'blocker', `use case not found: ${target.useCaseId}`, { target: target.useCaseId })],
    }
  }
  const current = analysis.useCases[index]!
  let updated: UseCaseDefinition = { ...current, reviewStates: { ...(current.reviewStates ?? {}) } }
  const state = target.action === 'accept' ? 'confirmed' : target.action === 'correct' || target.action === 'add' ? 'changed' : 'rejected'

  if (target.content === 'scalar') {
    const key = `scalar.${target.field}`
    if (target.action === 'correct') updated = { ...updated, [target.field]: (target.text ?? '').trim() }
    updated.reviewStates![key] = state
  } else if (target.content === 'list') {
    const list = [...current[target.field]]
    if (target.action === 'add') {
      const value = (target.text ?? '').trim()
      if (!value) {
        return { analysis, diagnostics: [designDiagnostic(EUC01_DIAGNOSTIC_CODES.unknownItem, 'blocker', 'new review content cannot be empty', { target: target.field })] }
      }
      list.push(value)
      updated.reviewStates![`list.${target.field}.${list.length - 1}`] = state
    } else if (typeof target.index !== 'number' || target.index < 0 || target.index >= list.length) {
      return { analysis, diagnostics: [designDiagnostic(EUC01_DIAGNOSTIC_CODES.unknownItem, 'blocker', `list item not found: ${target.field}[${String(target.index)}]`, { target: target.field })] }
    } else {
      const key = `list.${target.field}.${target.index}`
      if (target.action === 'correct') list[target.index] = (target.text ?? '').trim()
      if (target.action === 'reject') list.splice(target.index, 1)
      updated.reviewStates![key] = state
    }
    updated = { ...updated, [target.field]: list }
  } else if (target.content === 'step') {
    let found = false
    const transform = (step: ScenarioStep): ScenarioStep => {
      if (step.id !== target.stepId) return step
      found = true
      if (target.action === 'correct') return { ...step, [target.field]: (target.text ?? '').trim() }
      return step
    }
    let mainFlow = current.mainFlow.map(transform)
    const mapScenarios = (items: UseCaseDefinition['scenarios']) =>
      items.map((scenario) => ({ ...scenario, steps: scenario.steps.map(transform) }))
    let scenarios = mapScenarios(current.scenarios)
    let alternatePaths = mapScenarios(current.alternatePaths)
    let failurePaths = mapScenarios(current.failurePaths)
    if (!found) {
      return { analysis, diagnostics: [designDiagnostic(EUC01_DIAGNOSTIC_CODES.unknownItem, 'blocker', `scenario step not found: ${target.stepId}`, { target: target.stepId })] }
    }
    if (target.action === 'reject') {
      mainFlow = mainFlow.filter((step) => step.id !== target.stepId)
      const remove = (items: UseCaseDefinition['scenarios']) => items.map((scenario) => ({ ...scenario, steps: scenario.steps.filter((step) => step.id !== target.stepId) }))
      scenarios = remove(scenarios)
      alternatePaths = remove(alternatePaths)
      failurePaths = remove(failurePaths)
    }
    updated = { ...updated, mainFlow, scenarios, alternatePaths, failurePaths }
    updated.reviewStates![`step.${target.stepId}.${target.field}`] = state
  } else {
    const paths = [...current[target.pathKind]]
    const pathIndex = paths.findIndex((candidate) => candidate.id === target.scenarioId)
    if (pathIndex === -1) {
      return { analysis, diagnostics: [designDiagnostic(EUC01_DIAGNOSTIC_CODES.unknownItem, 'blocker', `scenario path not found: ${target.scenarioId}`, { target: target.scenarioId })] }
    }
    if (target.action === 'correct') paths[pathIndex] = { ...paths[pathIndex]!, name: (target.text ?? '').trim() }
    if (target.action === 'reject') paths.splice(pathIndex, 1)
    updated = { ...updated, [target.pathKind]: paths }
    updated.reviewStates![`path.${target.scenarioId}`] = state
  }

  const useCases = analysis.useCases.map((candidate, candidateIndex) => candidateIndex === index ? updated : candidate)
  return { analysis: withNextRevision(analysis, { useCases }), diagnostics: [] }
}

/** CAP-PLAN-014 — answer a question; only material questions block
 * readyForReview, but any question can be answered. */
export function answerQuestion(
  analysis: UseCaseAnalysis,
  questionId: string,
  answer: string,
  actor: string,
  at?: string,
): UseCaseAnalysisResult {
  const index = analysis.questions.findIndex((q) => q.id === questionId)
  if (index === -1) {
    return {
      analysis,
      diagnostics: [
        designDiagnostic(EUC01_DIAGNOSTIC_CODES.unknownQuestion, 'blocker', `question not found: ${questionId}`, {
          target: questionId,
        }),
      ],
    }
  }
  const answeredAt = at ?? new Date().toISOString()
  const questions = analysis.questions.map((q, i) =>
    i === index ? { ...q, answer, answeredBy: actor, answeredAt } : q,
  )
  const updated = withNextRevision(analysis, { questions })
  return { analysis: updated, diagnostics: [] }
}

/**
 * §3.2 / §5.3 / §9.10-equivalent for Plan — approve a use-case analysis.
 * Allowed only from `readyForReview` with a passing Plan gate; rejects agent
 * actors (§4, §2.2) and idempotent re-approval attempts. Preserves the exact
 * source set and freezes its hashes in the approval record.
 */
export function approveUseCaseAnalysis(
  analysis: UseCaseAnalysis,
  input: { approvedBy: string; authority: string; at: string },
): UseCaseAnalysisResult {
  // §4, §17.3 (second-review finding — self-asserted approval identity):
  // case-insensitive after trim, and rejects a `service:` actor the same as
  // an `agent:` actor.
  if (isNonHumanActor(input.approvedBy)) {
    return {
      analysis,
      diagnostics: [
        designDiagnostic(
          EUC01_DIAGNOSTIC_CODES.agentActorForbidden,
          'blocker',
          'a non-human (agent or service) actor cannot approve a use-case analysis',
          { target: 'approvedBy', relatedIds: [input.approvedBy] },
        ),
      ],
    }
  }

  if (analysis.status === 'approved') {
    return {
      analysis,
      diagnostics: [
        designDiagnostic(EUC01_DIAGNOSTIC_CODES.alreadyApproved, 'blocker', 'this revision is already approved', {
          target: 'status',
          relatedIds: [analysis.id, analysis.revision],
        }),
      ],
    }
  }

  const gate = evaluatePlanGate(analysis)
  if (!gate.passed) {
    return { analysis, diagnostics: sortDesignDiagnostics(gate.diagnostics.map(toDesignDiagnostic)) }
  }

  if (analysis.status !== 'readyForReview') {
    return {
      analysis,
      diagnostics: [
        designDiagnostic(
          EUC01_DIAGNOSTIC_CODES.notReadyForReview,
          'blocker',
          `analysis must be readyForReview to approve (current status: ${analysis.status})`,
          { target: 'status' },
        ),
      ],
    }
  }

  const sourceHashes: Record<string, string> = {}
  for (const source of stableSortStrings(analysis.sources.map((s) => s.id)).map(
    (id) => analysis.sources.find((s) => s.id === id)!,
  )) {
    sourceHashes[source.id] = canonicalHash(source)
  }

  const approvedRecord: UseCaseAnalysis = { ...analysis, status: 'approved', previousApproval: undefined }
  const contentHash = designContentHash(approvedRecord)
  const approval: DesignApproval = {
    approvedBy: input.approvedBy,
    authority: input.authority,
    approvedAt: input.at,
    recordId: analysis.id,
    revision: analysis.revision,
    contentHash,
    sourceHashes,
  }
  const finalRecord: UseCaseAnalysis = { ...approvedRecord, approval, contentHash }
  return { analysis: finalRecord, diagnostics: [] }
}

/**
 * Starts a new editable revision while preserving the exact approved record
 * in approved history. Downstream records continue to reference the last
 * approved revision until this new draft is reviewed and approved.
 */
export function reopenUseCaseAnalysis(approved: UseCaseAnalysis): UseCaseAnalysisResult {
  if (approved.status !== 'approved' || !approved.approval) {
    return {
      analysis: approved,
      diagnostics: [
        designDiagnostic(
          EUC01_DIAGNOSTIC_CODES.notReadyForReview,
          'blocker',
          'only an approved use-case analysis can be revised',
          { target: 'status', relatedIds: [approved.id, approved.revision] },
        ),
      ],
    }
  }
  const reopened = withNextRevision(approved, { previousApproval: approved.approval })
  return { analysis: reopened, diagnostics: [] }
}
