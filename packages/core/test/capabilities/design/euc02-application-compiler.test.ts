/**
 * EUC-02 — Application compiler (§24.1, §25.3 EUC-02 acceptance).
 */
import { describe, expect, it } from 'vitest'
import {
  approveUseCaseAnalysis,
  createUseCaseDraft,
  type UseCaseAnalysisInput,
} from '../../../src/capabilities/design/useCaseAnalysis.js'
import type { UseCaseAnalysis } from '../../../src/capabilities/design/records.js'
import {
  EUC02_DIAGNOSTIC_CODES,
  compileApplication,
} from '../../../src/capabilities/design/applicationCompiler.js'
import { validateContractRecord } from '../../../src/capabilities/validation.js'

const draftInput: UseCaseAnalysisInput = {
  projectId: 'proj-1',
  workDescription: 'Review a DO-178C evidence bundle for completeness',
  examples: ['Upload a bundle and confirm every required artifact is present'],
  prohibitedResults: ['Silently accept an incomplete bundle'],
  sources: [{ name: 'design doc', ref: 'docs/design.md', required: false }],
}

function approvedAnalysis(): UseCaseAnalysis {
  const { analysis } = createUseCaseDraft(draftInput)
  const approval = approveUseCaseAnalysis(analysis, {
    approvedBy: 'product-lead:alice',
    authority: 'product-lead',
    at: '2026-07-25T00:00:00.000Z',
  })
  expect(approval.diagnostics).toHaveLength(0)
  expect(approval.analysis.status).toBe('approved')
  return approval.analysis
}

describe('EUC-02 compileApplication', () => {
  it('refuses to compile an unapproved analysis and grants no approval', () => {
    const { analysis: draft } = createUseCaseDraft(draftInput)
    expect(draft.status).not.toBe('approved')
    const result = compileApplication(draft)
    expect(result.specification).toBeUndefined()
    expect(result.diagnostics[0]!.code).toBe(EUC02_DIAGNOSTIC_CODES.notApproved)
    // No compilation path grants approval — the input analysis is untouched.
    expect(draft.status).not.toBe('approved')
    expect(draft.approval).toBeUndefined()
  })

  it('compiles an approved analysis to a deterministic ApplicationSpecification', () => {
    const analysis = approvedAnalysis()
    const first = compileApplication(analysis)
    const second = compileApplication(analysis)
    expect(first.diagnostics).toHaveLength(0)
    expect(first.specification).toBeDefined()
    expect(second.specification).toEqual(first.specification)
    expect(second.specification!.contentHash).toBe(first.specification!.contentHash)
  })

  it('maps analysis fields to the legacy ApplicationSpecification shape', () => {
    const analysis = approvedAnalysis()
    const { specification } = compileApplication(analysis)
    expect(specification).toBeDefined()
    const spec = specification!

    expect(spec.purpose).toBe(analysis.workDescription)
    expect(spec.scope.outOfScope).toEqual(analysis.prohibitedResults)
    expect(spec.actors.map((a) => a.id)).toEqual(
      [...analysis.actors.filter((a) => a.status !== 'rejected').map((a) => a.id)].sort(),
    )
    expect(spec.useCases.map((u) => u.id)).toEqual(analysis.useCases.map((u) => u.id))
    expect(spec.acceptanceCases.length).toBe(analysis.useCases[0]!.acceptanceChecks.length)
    expect(spec.sources.map((s) => s.text)).toEqual(analysis.sources.map((s) => s.name))
  })

  it('validates structurally with validateContractRecord CAP-CONTRACT-001', () => {
    const analysis = approvedAnalysis()
    const { specification } = compileApplication(analysis)
    expect(specification).toBeDefined()
    const diagnostics = validateContractRecord('CAP-CONTRACT-001', specification)
    expect(diagnostics).toHaveLength(0)
  })

  it('returns a stable diagnostic and no specification for a missing required item', () => {
    const analysis = approvedAnalysis()
    const withoutUseCases: UseCaseAnalysis = { ...analysis, useCases: [] }
    const result = compileApplication(withoutUseCases)
    expect(result.specification).toBeUndefined()
    expect(result.diagnostics.some((d) => d.code === EUC02_DIAGNOSTIC_CODES.missingUseCases)).toBe(true)
    expect(result.diagnostics.some((d) => d.code === EUC02_DIAGNOSTIC_CODES.missingAcceptanceCases)).toBe(true)
  })

  it('accepts explicit id/revision options deterministically', () => {
    const analysis = approvedAnalysis()
    const first = compileApplication(analysis, { id: 'app.fixed', revision: '7' })
    const second = compileApplication(analysis, { id: 'app.fixed', revision: '7' })
    expect(first.specification!.id).toBe('app.fixed')
    expect(first.specification!.revision).toBe('7')
    expect(second.specification).toEqual(first.specification)
  })
})
