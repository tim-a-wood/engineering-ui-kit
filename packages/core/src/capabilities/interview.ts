/**
 * Product interview import and field-level delta (CAP-PKT-008).
 * Does not mutate approved records — callers persist drafts / approve explicitly.
 */

import type { ApplicationSpecification, InterviewPacket, NamedText } from './types.js'
import { validateContractRecord } from './validation.js'
import { diagnostic, sortDiagnostics, type CapDiagnostic } from './diagnostics.js'
import { evaluateProductGate, type GateResult } from './gates.js'
import { buildInterviewPacket, packetContentHash } from './packets.js'
import { canonicalHash } from './hash.js'

export const PRODUCT_INTERVIEW_RESPONSE_FILENAME = 'capability-interview-response.json'
export const PRODUCT_INTERVIEW_UPLOAD_BUDGET = 3

export type FieldDelta = {
  fieldPath: string
  change: 'added' | 'removed' | 'changed'
  before: unknown
  after: unknown
}

export type InterviewFieldState = 'confirmed' | 'proposed' | 'unresolved'

export type ProductInterviewImportResult = {
  draft: ApplicationSpecification
  diagnostics: CapDiagnostic[]
  gate: GateResult
  delta: FieldDelta[]
  valid: boolean
  fieldStates: Record<string, InterviewFieldState>
  uploadFileCount: number
}

const SCALAR_FIELDS = ['purpose'] as const
const STRING_ARRAY_FIELDS = ['outcomes'] as const
const NAMED_ARRAY_FIELDS = [
  'actors',
  'goals',
  'useCases',
  'scenarios',
  'information',
  'rules',
  'externalSystems',
  'constraints',
  'sources',
  'unresolvedQuestions',
] as const

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function parseRawJson(raw: string | object): { value: unknown; diagnostics: CapDiagnostic[] } {
  if (typeof raw !== 'string') return { value: raw, diagnostics: [] }
  try {
    return { value: JSON.parse(raw), diagnostics: [] }
  } catch (error) {
    return {
      value: {},
      diagnostics: [
        diagnostic('CAP-INT-PARSE', error instanceof Error ? error.message : 'invalid JSON', {
          fieldPath: '$',
          ruleId: 'CAP-INT-PARSE',
        }),
      ],
    }
  }
}

function asNamedList(value: unknown): NamedText[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item, index) => {
      if (typeof item === 'string') return { id: `auto-${index + 1}`, text: item }
      const obj = asObject(item)
      if (!obj) return undefined
      const id = typeof obj.id === 'string' && obj.id.trim() ? obj.id : `auto-${index + 1}`
      const text = typeof obj.text === 'string' ? obj.text : String(obj.text ?? '')
      return { id, text }
    })
    .filter((item): item is NamedText => item !== undefined)
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => (typeof item === 'string' ? item : String(item ?? '')))
}

function asAcceptanceCases(value: unknown): ApplicationSpecification['acceptanceCases'] {
  if (!Array.isArray(value)) return []
  return value
    .map((item, index) => {
      const obj = asObject(item)
      if (!obj) return undefined
      return {
        id: typeof obj.id === 'string' && obj.id.trim() ? obj.id : `ac-${index + 1}`,
        description: typeof obj.description === 'string' ? obj.description : '',
        expectedOutcome: typeof obj.expectedOutcome === 'string' ? obj.expectedOutcome : '',
        ...(obj.kind === 'example' || obj.kind === 'failure' ? { kind: obj.kind } : {}),
      }
    })
    .filter((item): item is ApplicationSpecification['acceptanceCases'][number] => item !== undefined)
}

function emptyDraft(projectId: string): ApplicationSpecification {
  return {
    schemaVersion: '1.0',
    projectId,
    id: 'app-draft',
    revision: '1',
    status: 'draft',
    purpose: '',
    outcomes: [],
    actors: [],
    goals: [],
    useCases: [],
    scenarios: [],
    information: [],
    rules: [],
    externalSystems: [],
    constraints: [],
    scope: { inScope: [], outOfScope: [] },
    acceptanceCases: [],
    sources: [],
    unresolvedQuestions: [],
    contentHash: 'pending',
  }
}

function namedFrom(values: unknown, prefix: string): NamedText[] {
  if (!Array.isArray(values)) return []
  return values.flatMap((value, index) => {
    if (typeof value === 'string' && value.trim()) return [{ id: `${prefix}-${index + 1}`, text: value }]
    const record = asObject(value)
    const text = record && typeof record.statement === 'string'
      ? record.statement
      : record && typeof record.text === 'string'
        ? record.text
        : ''
    return text.trim() ? [{ id: typeof record?.id === 'string' ? record.id : `${prefix}-${index + 1}`, text }] : []
  })
}

/**
 * Recover the rich envelope older handoffs allowed Copilot to invent. Keeping
 * this compatibility path means a completed interview is not discarded merely
 * because its fields were nested under productDefinition/confirmedRequirements.
 */
function normalizeProductInterviewEnvelope(value: unknown, projectId: string): unknown {
  const root = asObject(value)
  const product = asObject(root?.productDefinition)
  const confirmed = asObject(root?.confirmedRequirements)
  if (!root || (!product && !confirmed)) return value

  const primaryUser = typeof product?.primaryUser === 'string' ? [product.primaryUser] : []
  const secondaryUsers = Array.isArray(product?.secondaryUsers) ? product.secondaryUsers : []
  const calculationScope = asStringList(confirmed?.calculationScope)
  const requiredOutputs = asStringList(confirmed?.requiredOutputs)
  const firstReleaseExclusions = asStringList(confirmed?.firstReleaseExclusions)
  const acceptance = asStringList(confirmed?.firstReleaseAcceptanceCriteriaConfirmed)
  const systemBoundary = asObject(product?.systemBoundary)
  const externalSystems = systemBoundary
    ? Object.entries(systemBoundary).map(([key, enabled], index) => ({ id: `external-${index + 1}`, text: `${key}: ${String(enabled)}` }))
    : []
  const proposed = namedFrom(root.proposedRequirements, 'proposed')
  const unresolved = namedFrom(root.unresolvedRequirements, 'unresolved')

  return {
    schemaVersion: '1.0',
    projectId,
    id: 'app.proposed',
    revision: '1',
    status: 'proposed',
    purpose: typeof product?.purpose === 'string' ? product.purpose : '',
    outcomes: requiredOutputs.length ? requiredOutputs : calculationScope,
    actors: namedFrom([...primaryUser, ...secondaryUsers], 'actor'),
    goals: namedFrom(calculationScope, 'goal'),
    useCases: namedFrom(confirmed?.preflightWorkflow, 'use-case'),
    scenarios: namedFrom(confirmed?.operatingEnvironments, 'scenario'),
    information: namedFrom([
      ...asStringList(confirmed?.mandatoryOperationalInputsWhereApplicable),
      ...requiredOutputs,
    ], 'information'),
    rules: namedFrom(confirmed?.operationalControls, 'rule'),
    externalSystems,
    constraints: namedFrom([
      typeof product?.approvedCalculationBasis === 'string' ? product.approvedCalculationBasis : '',
      typeof product?.operationalAuthority === 'string' ? product.operationalAuthority : '',
    ].filter(Boolean), 'constraint'),
    scope: { inScope: calculationScope, outOfScope: firstReleaseExclusions },
    acceptanceCases: acceptance.map((text, index) => ({
      id: `ac-${index + 1}`, description: text, expectedOutcome: text,
    })),
    sources: namedFrom(
      typeof product?.approvedCalculationBasis === 'string' ? [product.approvedCalculationBasis] : [],
      'source',
    ),
    unresolvedQuestions: [...proposed, ...unresolved],
    contentHash: 'pending',
  } satisfies ApplicationSpecification
}

/**
 * Coerce an interview response (or partial object) into an ApplicationSpecification draft.
 * Invalid input is preserved as a draft with diagnostics — never throws for shape errors.
 */
export function coerceApplicationDraft(
  value: unknown,
  options: { projectId: string; previousApproved?: ApplicationSpecification },
): { draft: ApplicationSpecification; diagnostics: CapDiagnostic[] } {
  const parseDiagnostics: CapDiagnostic[] = []
  const obj = asObject(value)
  if (!obj) {
    parseDiagnostics.push(
      diagnostic('CAP-INT-SHAPE', 'interview response must be a JSON object', {
        fieldPath: '$',
        ruleId: 'CAP-INT-SHAPE',
      }),
    )
  }
  const source = obj ?? {}
  const base = emptyDraft(options.projectId)
  const previous = options.previousApproved

  const scopeObj = asObject(source.scope)
  const draft: ApplicationSpecification = {
    ...base,
    projectId:
      typeof source.projectId === 'string' && source.projectId.trim()
        ? source.projectId
        : options.projectId,
    id:
      typeof source.id === 'string' && source.id.trim()
        ? source.id
        : previous?.id ?? base.id,
    revision:
      typeof source.revision === 'string' && source.revision.trim()
        ? source.revision
        : previous
          ? String(Number(previous.revision) + 1 || `${previous.revision}-next`)
          : '1',
    status: 'draft',
    purpose: typeof source.purpose === 'string' ? source.purpose : '',
    outcomes: asStringList(source.outcomes),
    actors: asNamedList(source.actors),
    goals: asNamedList(source.goals),
    useCases: asNamedList(source.useCases),
    scenarios: asNamedList(source.scenarios),
    information: asNamedList(source.information),
    rules: asNamedList(source.rules),
    externalSystems: asNamedList(source.externalSystems),
    constraints: asNamedList(source.constraints),
    scope: {
      inScope: asStringList(scopeObj?.inScope),
      outOfScope: asStringList(scopeObj?.outOfScope),
    },
    acceptanceCases: asAcceptanceCases(source.acceptanceCases),
    sources: asNamedList(source.sources),
    unresolvedQuestions: asNamedList(source.unresolvedQuestions),
    contentHash: 'pending',
  }

  // Validate the raw payload (not the filled draft) so incomplete imports stay invalid.
  const rawValidation = validateContractRecord('CAP-CONTRACT-001', value ?? {})
  const diagnostics = sortDiagnostics([...parseDiagnostics, ...rawValidation])

  draft.contentHash = canonicalHash({ ...draft, contentHash: undefined, status: 'draft' })
  return { draft, diagnostics }
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Field-level delta between an approved specification and a proposed draft. */
export function diffApplicationSpecification(
  approved: ApplicationSpecification | undefined,
  draft: ApplicationSpecification,
): FieldDelta[] {
  if (!approved) {
    return [
      {
        fieldPath: '$',
        change: 'added' as const,
        before: undefined,
        after: { id: draft.id, revision: draft.revision },
      },
    ]
  }
  const deltas: FieldDelta[] = []

  for (const field of SCALAR_FIELDS) {
    if (!jsonEqual(approved[field], draft[field])) {
      deltas.push({
        fieldPath: field,
        change: approved[field] === '' && draft[field] !== '' ? 'added' : 'changed',
        before: approved[field],
        after: draft[field],
      })
    }
  }

  for (const field of STRING_ARRAY_FIELDS) {
    if (!jsonEqual(approved[field], draft[field])) {
      deltas.push({
        fieldPath: field,
        change: 'changed',
        before: approved[field],
        after: draft[field],
      })
    }
  }

  if (!jsonEqual(approved.scope, draft.scope)) {
    if (!jsonEqual(approved.scope.inScope, draft.scope.inScope)) {
      deltas.push({
        fieldPath: 'scope.inScope',
        change: 'changed',
        before: approved.scope.inScope,
        after: draft.scope.inScope,
      })
    }
    if (!jsonEqual(approved.scope.outOfScope, draft.scope.outOfScope)) {
      deltas.push({
        fieldPath: 'scope.outOfScope',
        change: 'changed',
        before: approved.scope.outOfScope,
        after: draft.scope.outOfScope,
      })
    }
  }

  if (!jsonEqual(approved.acceptanceCases, draft.acceptanceCases)) {
    deltas.push({
      fieldPath: 'acceptanceCases',
      change: 'changed',
      before: approved.acceptanceCases,
      after: draft.acceptanceCases,
    })
  }

  for (const field of NAMED_ARRAY_FIELDS) {
    const beforeMap = new Map(approved[field].map((item) => [item.id, item]))
    const afterMap = new Map(draft[field].map((item) => [item.id, item]))
    for (const [id, after] of afterMap) {
      const before = beforeMap.get(id)
      if (!before) {
        deltas.push({ fieldPath: `${field}.${id}`, change: 'added', before: undefined, after })
      } else if (!jsonEqual(before, after)) {
        deltas.push({ fieldPath: `${field}.${id}`, change: 'changed', before, after })
      }
    }
    for (const [id, before] of beforeMap) {
      if (!afterMap.has(id)) {
        deltas.push({ fieldPath: `${field}.${id}`, change: 'removed', before, after: undefined })
      }
    }
  }

  return deltas.sort((a, b) => a.fieldPath.localeCompare(b.fieldPath))
}

function deriveFieldStates(
  draft: ApplicationSpecification,
  packet?: InterviewPacket,
): Record<string, InterviewFieldState> {
  const states: Record<string, InterviewFieldState> = {}
  const confirmed = new Set(packet?.stateLabels.confirmed ?? [])
  const proposed = new Set(packet?.stateLabels.proposed ?? [])
  const unresolved = new Set(packet?.stateLabels.unresolved ?? [])

  const mark = (path: string, fallback: InterviewFieldState) => {
    if (unresolved.has(path)) states[path] = 'unresolved'
    else if (proposed.has(path)) states[path] = 'proposed'
    else if (confirmed.has(path)) states[path] = 'confirmed'
    else states[path] = fallback
  }

  mark('purpose', draft.purpose ? 'confirmed' : 'unresolved')
  mark('outcomes', draft.outcomes.length ? 'confirmed' : 'unresolved')
  mark('actors', draft.actors.length ? 'confirmed' : 'unresolved')
  mark('scope.inScope', draft.scope.inScope.length ? 'confirmed' : 'unresolved')
  mark('acceptanceCases', draft.acceptanceCases.length ? 'confirmed' : 'unresolved')
  for (const q of draft.unresolvedQuestions) {
    states[`unresolvedQuestions.${q.id}`] = 'unresolved'
  }
  for (const rule of draft.rules) {
    mark(`rules.${rule.id}`, 'proposed')
  }
  for (const path of confirmed) states[path] = 'confirmed'
  for (const path of proposed) states[path] = 'proposed'
  for (const path of unresolved) states[path] = 'unresolved'
  return states
}

/** Bounded product interview packet (CAP-CONTRACT-014 specialization). */
export function buildProductInterviewPacket(input: {
  packetId: string
  projectId: string
  approved?: ApplicationSpecification
  facts?: string[]
  glossary?: NamedText[]
  questionBudget?: number
}): InterviewPacket {
  const approved = input.approved
  const budget = input.questionBudget ?? 3
  return buildInterviewPacket({
    packetId: input.packetId,
    projectId: input.projectId,
    interviewKind: 'product',
    gateId: 'CAP-GATE-001',
    interviewBoundary: `Product interview only. Ask at most ${budget} related questions per conversational turn, wait for the answers, and continue with further turns until every approval-blocking item is resolved. Do not treat this per-turn limit as permission to end the interview. Do not design architecture or implement source.`,
    inputContext: {
      recordIds: approved ? [approved.id] : [],
      revisions: approved ? [approved.revision] : [],
      hashes: approved ? [approved.contentHash] : [],
      facts: input.facts ?? (approved ? [`purpose:${approved.purpose}`] : []),
      glossary: input.glossary ?? [],
    },
    stateLabels: {
      confirmed: approved
        ? ['purpose', ...approved.rules.map((r) => `rules.${r.id}`)].filter(Boolean)
        : [],
      proposed: [],
      unresolved: approved?.unresolvedQuestions.map((q) => `unresolvedQuestions.${q.id}`) ?? [],
    },
  })
}

/**
 * Import a product interview response into a draft ApplicationSpecification.
 * Never mutates `approved` — returns delta for review before approval.
 */
export function importProductInterviewResponse(
  raw: string | object,
  options: {
    projectId: string
    approved?: ApplicationSpecification
    packet?: InterviewPacket
  },
): ProductInterviewImportResult {
  const parsed = parseRawJson(raw)
  const normalized = normalizeProductInterviewEnvelope(parsed.value, options.projectId)
  const { draft, diagnostics } = coerceApplicationDraft(normalized, {
    projectId: options.projectId,
    previousApproved: options.approved,
  })
  const allDiagnostics = sortDiagnostics([...parsed.diagnostics, ...diagnostics])
  const valid = allDiagnostics.length === 0

  const gate = evaluateProductGate(draft)
  const delta = diffApplicationSpecification(options.approved, draft)
  const fieldStates = deriveFieldStates(draft, options.packet)

  // Upload set: interview packet + response (+ optional third file) — always ≤ budget.
  const uploadFileCount = options.packet ? 2 : 1

  return {
    draft,
    diagnostics: allDiagnostics,
    gate,
    delta,
    valid,
    fieldStates,
    uploadFileCount,
  }
}

/** Files that make up a product interview handoff (must stay within upload budget). */
export function productInterviewUploadFiles(packet: InterviewPacket): string[] {
  return [`${packet.packetId}.json`, PRODUCT_INTERVIEW_RESPONSE_FILENAME]
}

export function interviewPacketHash(packet: InterviewPacket): string {
  return packetContentHash(packet)
}
