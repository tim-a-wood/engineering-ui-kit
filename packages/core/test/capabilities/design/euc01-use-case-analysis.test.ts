/**
 * EUC-01 — Use-case analysis core (§24.1, §25.3 EUC-01 acceptance).
 */
import { describe, expect, it } from 'vitest'
import {
  EUC01_DIAGNOSTIC_CODES,
  acceptAnalysisItem,
  answerQuestion,
  approveUseCaseAnalysis,
  correctAnalysisItem,
  createUseCaseDraft,
  evaluatePlanGate,
  rejectAnalysisItem,
  reviewCounts,
  type UseCaseAnalysisInput,
} from '../../../src/capabilities/design/useCaseAnalysis.js'

const baseInput: UseCaseAnalysisInput = {
  projectId: 'proj-1',
  workDescription: 'Review evidence bundle',
  examples: ['Upload evidence bundle'],
  prohibitedResults: [],
}

describe('EUC-01 createUseCaseDraft', () => {
  it('is deterministic: the same input produces the same canonical record and hash', () => {
    const first = createUseCaseDraft(baseInput)
    const second = createUseCaseDraft(baseInput)
    expect(second.analysis).toEqual(first.analysis)
    expect(second.diagnostics).toEqual(first.diagnostics)
    expect(first.analysis.contentHash).toBeTruthy()
    expect(second.analysis.contentHash).toBe(first.analysis.contentHash)
  })

  it('creates the first draft without record IDs, schemas, modules, ports, or adapters from the user (CAP-PLAN-004)', () => {
    const { analysis } = createUseCaseDraft(baseInput)
    expect(analysis.id).toBeTruthy()
    expect(analysis.revision).toBe('r1')
    expect(analysis.useCases.length).toBeGreaterThanOrEqual(1)
  })

  it('generates at least one main use case with stable scenario/step IDs', () => {
    const { analysis } = createUseCaseDraft(baseInput)
    const [useCase] = analysis.useCases
    expect(useCase).toBeDefined()
    expect(useCase!.scenarios.length).toBeGreaterThanOrEqual(1)
    expect(useCase!.scenarios[0]!.steps.length).toBeGreaterThanOrEqual(1)
    expect(useCase!.scenarios[0]!.steps[0]!.id).toMatch(/\.step\./)

    const again = createUseCaseDraft(baseInput)
    expect(again.analysis.useCases[0]!.id).toBe(useCase!.id)
    expect(again.analysis.useCases[0]!.scenarios[0]!.id).toBe(useCase!.scenarios[0]!.id)
    expect(again.analysis.useCases[0]!.scenarios[0]!.steps[0]!.id).toBe(useCase!.scenarios[0]!.steps[0]!.id)
  })

  it('turns a narrative description into a concise actor, task, outcomes, failure path, and recovery scenario', () => {
    const { analysis } = createUseCaseDraft({
      projectId: 'proj-delivery',
      workDescription:
        'A release manager runs a repository-local command to validate a delivery package. '
        + 'The workflow must report a structured pass or failure result, preserve the last approved result on failure, '
        + 'and retain evidence that an independent reviewer can inspect.',
      examples: ['Validate the current delivery package', 'Review the recorded result'],
      prohibitedResults: ['Never replace the last approved result after a failed validation'],
    })
    const [useCase] = analysis.useCases

    expect(analysis.actors[0]?.text).toBe('Release manager')
    expect(useCase?.name).toBe('Validate a delivery package')
    expect(useCase?.trigger).toBe('Release manager needs to validate a delivery package.')
    expect(useCase?.mainFlow.map((step) => step.expectedResult)).toEqual([
      'A structured pass or failure result is reported.',
      'Evidence is retained for independent review.',
    ])
    expect(useCase?.failurePaths).toHaveLength(1)
    expect(useCase?.failurePaths[0]?.name).toBe('Preserve the last approved result on failure')
    expect(useCase?.failurePaths[0]?.steps[0]?.expectedResult).toBe('The last approved result remains unchanged after the failed validation.')
    expect(useCase?.recoveryBehavior).toBe('Preserve the last approved result on failure.')
    expect(useCase?.scenarios.map((scenario) => scenario.kind)).toEqual(['main', 'failure', 'recovery'])
    expect(useCase?.scenarios[2]?.name).toBe('Recover from a failed attempt to validate a delivery package')
    expect(useCase?.acceptanceChecks[0]?.text).toContain('report a structured pass or failure result')
  })

  it('produces a material question and needsInput status when the work description is empty (CAP-PLAN-001)', () => {
    const { analysis } = createUseCaseDraft({ projectId: 'proj-1', workDescription: '' })
    expect(analysis.status).toBe('needsInput')
    expect(analysis.questions.some((q) => q.material && !q.answer)).toBe(true)
  })

  it('an optional missing source creates a warning and keeps the draft valid (CAP-PLAN-005)', () => {
    const { analysis, diagnostics } = createUseCaseDraft({
      ...baseInput,
      sources: [{ name: 'design doc', ref: 'docs/design.md', required: false, status: 'failed', failureCause: 'not found' }],
    })
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]!.code).toBe(EUC01_DIAGNOSTIC_CODES.sourceFailedOptional)
    expect(diagnostics[0]!.severity).toBe('warning')
    // The draft stays valid: it still has a main use case and is not blocked purely by the optional source.
    expect(analysis.useCases.length).toBeGreaterThanOrEqual(1)
    const gate = evaluatePlanGate(analysis)
    expect(gate.diagnostics.some((d) => d.code === EUC01_DIAGNOSTIC_CODES.sourceFailedOptional)).toBe(false)
  })

  it('a failed required source blocks approval and identifies the source and cause (CAP-PLAN-006)', () => {
    const { analysis } = createUseCaseDraft({
      ...baseInput,
      sources: [{ name: 'audit basis', ref: 'docs/basis.md', required: true, status: 'failed', failureCause: 'access denied' }],
    })
    const gate = evaluatePlanGate(analysis)
    expect(gate.passed).toBe(false)
    const sourceDiagnostic = gate.diagnostics.find((d) => d.code === EUC01_DIAGNOSTIC_CODES.sourceFailedRequired)
    expect(sourceDiagnostic).toBeDefined()
    expect(sourceDiagnostic!.message).toContain('audit basis')
    expect(sourceDiagnostic!.message).toContain('access denied')
  })
})

describe('EUC-01 item review model (CAP-PLAN-010..013)', () => {
  it('reviewCounts reports counts by status, not a percentage', () => {
    const { analysis } = createUseCaseDraft(baseInput)
    const counts = reviewCounts(analysis)
    expect(counts.inferred).toBeGreaterThan(0)
    expect(counts.confirmed).toBe(0)
    expect(counts.rejected).toBe(0)
  })

  it('accept/correct/reject item transitions produce new revisions and never mutate the input', () => {
    const { analysis: draft } = createUseCaseDraft(baseInput)
    const actorId = draft.actors[0]!.id

    const accepted = acceptAnalysisItem(draft, actorId, 'product-lead:alice')
    expect(accepted.diagnostics).toHaveLength(0)
    expect(accepted.analysis.actors[0]!.status).toBe('confirmed')
    expect(accepted.analysis.revision).not.toBe(draft.revision)
    expect(draft.actors[0]!.status).toBe('inferred') // input untouched

    const corrected = correctAnalysisItem(accepted.analysis, actorId, 'Certification engineer', 'product-lead:alice')
    expect(corrected.diagnostics).toHaveLength(0)
    expect(corrected.analysis.actors[0]!.status).toBe('changed')
    expect(corrected.analysis.actors[0]!.text).toBe('Certification engineer')
    expect(accepted.analysis.actors[0]!.text).not.toBe('Certification engineer') // input untouched

    const rejected = rejectAnalysisItem(corrected.analysis, actorId, 'product-lead:alice')
    expect(rejected.diagnostics).toHaveLength(0)
    expect(rejected.analysis.actors[0]!.status).toBe('rejected')
  })

  it('returns a diagnostic instead of throwing for an unknown item id', () => {
    const { analysis: draft } = createUseCaseDraft(baseInput)
    const result = acceptAnalysisItem(draft, 'no-such-item', 'product-lead:alice')
    expect(result.analysis).toBe(draft)
    expect(result.diagnostics[0]!.code).toBe(EUC01_DIAGNOSTIC_CODES.unknownItem)
  })
})

describe('EUC-01 material questions (CAP-PLAN-014)', () => {
  it('material questions must be answered before readyForReview', () => {
    const { analysis: draft } = createUseCaseDraft({ projectId: 'proj-1', workDescription: '' })
    expect(draft.status).toBe('needsInput')
    const questionId = draft.questions[0]!.id

    const answered = answerQuestion(draft, questionId, 'Review evidence bundles.', 'product-lead:alice', '2026-07-25T00:00:00.000Z')
    expect(answered.diagnostics).toHaveLength(0)
    expect(answered.analysis.questions[0]!.answer).toBe('Review evidence bundles.')
    expect(answered.analysis.status).not.toBe('needsInput')
  })

  it('returns a diagnostic instead of throwing for an unknown question id', () => {
    const { analysis: draft } = createUseCaseDraft(baseInput)
    const result = answerQuestion(draft, 'no-such-question', 'answer', 'product-lead:alice')
    expect(result.diagnostics[0]!.code).toBe(EUC01_DIAGNOSTIC_CODES.unknownQuestion)
  })
})

function readyToApprove() {
  const { analysis } = createUseCaseDraft(baseInput)
  expect(analysis.status).toBe('readyForReview')
  return analysis
}

describe('EUC-01 approveUseCaseAnalysis (§5.2, §5.3, CAP-PLAN-015/016)', () => {
  it('blocks a scenario action label that violates the STE word limit', () => {
    const { analysis } = createUseCaseDraft(baseInput)
    const useCase = analysis.useCases[0]!
    const scenario = useCase.scenarios[0]!
    const changed = {
      ...analysis,
      useCases: [{
        ...useCase,
        scenarios: [{
          ...scenario,
          steps: [{
            ...scenario.steps[0]!,
            action: 'The user uploads a bundle and checks every artifact.',
          }],
        }],
      }],
    }
    expect(evaluatePlanGate(changed).diagnostics).toContainEqual(
      expect.objectContaining({ code: 'STE-LABEL-LENGTH' }),
    )
  })

  it('approves a readyForReview analysis with a passing gate', () => {
    const analysis = readyToApprove()
    const result = approveUseCaseAnalysis(analysis, {
      approvedBy: 'product-lead:alice',
      authority: 'product-lead',
      at: '2026-07-25T00:00:00.000Z',
    })
    expect(result.diagnostics).toHaveLength(0)
    expect(result.analysis.status).toBe('approved')
    expect(result.analysis.approval).toBeDefined()
    expect(result.analysis.approval!.recordId).toBe(analysis.id)
    expect(result.analysis.approval!.revision).toBe(analysis.revision)
  })

  it('a required conflict blocks approval and reports the exact cause', () => {
    const { analysis } = createUseCaseDraft({
      ...baseInput,
      sources: [{ name: 'audit basis', ref: 'docs/basis.md', required: true, status: 'failed', failureCause: 'access denied' }],
    })
    const result = approveUseCaseAnalysis(analysis, {
      approvedBy: 'product-lead:alice',
      authority: 'product-lead',
      at: '2026-07-25T00:00:00.000Z',
    })
    expect(result.analysis.status).not.toBe('approved')
    expect(result.diagnostics.some((d) => d.code === EUC01_DIAGNOSTIC_CODES.sourceFailedRequired)).toBe(true)
  })

  it('approval preserves the exact source set and hash', () => {
    const { analysis } = createUseCaseDraft({
      ...baseInput,
      sources: [{ name: 'design doc', ref: 'docs/design.md', required: false }],
    })
    const result = approveUseCaseAnalysis(analysis, {
      approvedBy: 'product-lead:alice',
      authority: 'product-lead',
      at: '2026-07-25T00:00:00.000Z',
    })
    expect(result.analysis.sources).toEqual(analysis.sources)
    expect(Object.keys(result.analysis.approval!.sourceHashes!)).toEqual(analysis.sources.map((s) => s.id))
    for (const source of analysis.sources) {
      expect(result.analysis.approval!.sourceHashes![source.id]).toBeTruthy()
    }
  })

  it('rejects an agent actor (§4, §2.2)', () => {
    const analysis = readyToApprove()
    const result = approveUseCaseAnalysis(analysis, {
      approvedBy: 'agent:copilot',
      authority: 'product-lead',
      at: '2026-07-25T00:00:00.000Z',
    })
    expect(result.analysis.status).not.toBe('approved')
    expect(result.diagnostics[0]!.code).toBe(EUC01_DIAGNOSTIC_CODES.agentActorForbidden)
  })

  it('rejects an idempotent re-approval attempt with a diagnostic', () => {
    const analysis = readyToApprove()
    const first = approveUseCaseAnalysis(analysis, {
      approvedBy: 'product-lead:alice',
      authority: 'product-lead',
      at: '2026-07-25T00:00:00.000Z',
    })
    expect(first.diagnostics).toHaveLength(0)
    const second = approveUseCaseAnalysis(first.analysis, {
      approvedBy: 'product-lead:alice',
      authority: 'product-lead',
      at: '2026-07-25T00:01:00.000Z',
    })
    expect(second.diagnostics[0]!.code).toBe(EUC01_DIAGNOSTIC_CODES.alreadyApproved)
    expect(second.analysis).toEqual(first.analysis)
  })
})
