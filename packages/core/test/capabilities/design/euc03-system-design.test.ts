/**
 * EUC-03 — System-design core.
 * Acceptance (SPECIFICATION.md §25.3 EUC-03):
 *  - every main use case has a complete path;
 *  - every external actor has an actor-specific adapter allocation;
 *  - a split has an approved reason;
 *  - cycles and unowned operations block approval.
 */
import { describe, expect, it } from 'vitest'
import type { ApplicationSpecification } from '../../../src/capabilities/types.js'
import {
  addDependency,
  approveSystemStructure,
  changeModulePurpose,
  changeModuleType,
  evaluateSystemStructureGate,
  moveModuleToDeployable,
  proposeSystemStructure,
  renameModule,
  systemStructureStatus,
  type SystemStructureSpecification,
} from '../../../src/capabilities/design/systemDesign.js'

const application: ApplicationSpecification = {
  schemaVersion: '1.0',
  projectId: 'proj-1',
  id: 'app-1',
  revision: 'r1',
  status: 'approved',
  purpose: 'audit evidence for DO-178C compliance',
  outcomes: ['reviewers can trust the evidence trail'],
  actors: [{ id: 'a1', text: 'auditor' }],
  goals: [{ id: 'g1', text: 'complete audit trail' }],
  useCases: [
    { id: 'uc.import-evidence', text: 'Import evidence' },
    { id: 'uc.review-evidence', text: 'Review evidence' },
  ],
  scenarios: [],
  information: [],
  rules: [],
  externalSystems: [
    { id: 'ext.matlab', text: 'MATLAB' },
    { id: 'ext.azure-devops', text: 'Azure DevOps' },
  ],
  constraints: [],
  scope: { inScope: ['evidence import'], outOfScope: [] },
  acceptanceCases: [{ id: 'ac1', description: 'imports evidence', expectedOutcome: 'stored' }],
  sources: [],
  unresolvedQuestions: [],
  contentHash: 'app-hash-1',
}

const operations = [{ operationId: 'op.import-evidence' }, { operationId: 'op.review-evidence' }]
const operationIds = operations.map((o) => o.operationId)

function propose(): SystemStructureSpecification {
  return proposeSystemStructure(application, { architectureId: 'arch-1', operations })
}

describe('EUC-03 proposeSystemStructure', () => {
  it('CAP-DES-SYS-001 starts with one module and one deployable', () => {
    const draft = propose()
    expect(draft.deployables.length).toBe(1)
    expect(draft.moduleIds).toContain('mod.core')
  })

  it('CAP-DES-SYS-004 allocates every operation to exactly one module', () => {
    const draft = propose()
    for (const op of operationIds) {
      const matches = draft.operationAllocations.filter((a) => a.operationId === op)
      expect(matches.length).toBe(1)
    }
  })

  it('CAP-DES-SYS-005 allocates one port and one actor-specific adapter per external system', () => {
    const draft = propose()
    expect(draft.adapterAllocations.length).toBe(application.externalSystems.length)
    const adapterIds = new Set(draft.adapterAllocations.map((a) => a.adapterId))
    expect(adapterIds.size).toBe(draft.adapterAllocations.length)
  })

  it('CAP-DES-SYS-006 gives every main use case a complete entry-to-output path', () => {
    const draft = propose()
    for (const useCase of application.useCases) {
      const trace = draft.workflowTraces.find((t) => t.useCaseId === useCase.id)
      expect(trace).toBeDefined()
      expect(trace!.moduleIds.length).toBeGreaterThan(0)
    }
  })

  it('CAP-DES-SYS-007 records a reason for every module', () => {
    const draft = propose()
    for (const moduleId of draft.moduleIds) {
      const reason = draft.proposals.find((p) => p.id === moduleId)
      const definition = draft.moduleDefinitions?.find((d) => d.moduleId === moduleId)
      expect(Boolean(reason?.text.trim() || definition?.responsibility.trim())).toBe(true)
    }
  })

  it('uses the approved use cases—not the raw application paragraph—as the primary module responsibility', () => {
    const draft = propose()
    expect(draft.moduleDefinitions?.find((definition) => definition.moduleId === 'mod.core')?.responsibility)
      .toBe('Coordinates the approved workflows for Import evidence; Review evidence.')
  })

  it('CAP-DES-SYS-008 identifies deployable units', () => {
    const draft = propose()
    expect(draft.deployables[0]!.moduleIds).toEqual([...draft.moduleIds].sort((a, b) => a.localeCompare(b)))
  })

  it('a well-formed proposal passes the system-structure gate', () => {
    const draft = propose()
    const gate = evaluateSystemStructureGate(draft, application, operationIds)
    expect(gate.passed).toBe(true)
    expect(gate.diagnostics).toEqual([])
    expect(draft.gateResult).toEqual(gate)
  })

  it('is deterministic for the same input', () => {
    const a = propose()
    const b = propose()
    expect(a.contentHash).toBe(b.contentHash)
  })
})

describe('EUC-03 evaluateSystemStructureGate blocking rules', () => {
  it('blocks approval on a dependency cycle', () => {
    const draft = propose()
    const adapterModuleId = draft.moduleIds.find((id) => id !== 'mod.core')!
    const withCycle = addDependency(draft, adapterModuleId, 'mod.core', 'adapter calls back into core')
    expect(withCycle.ok).toBe(true)
    const gate = evaluateSystemStructureGate(withCycle.architecture!, application, operationIds)
    expect(gate.passed).toBe(false)
    expect(gate.diagnostics.some((d) => d.code === 'CAP-DES-SYS-CYCLE')).toBe(true)
  })

  it('blocks approval on an unallocated operation', () => {
    const draft = propose()
    const withMissingOp: SystemStructureSpecification = {
      ...draft,
      operationAllocations: draft.operationAllocations.filter((a) => a.operationId !== 'op.review-evidence'),
    }
    const gate = evaluateSystemStructureGate(withMissingOp, application, operationIds)
    expect(gate.passed).toBe(false)
    expect(
      gate.diagnostics.some((d) => d.code === 'CAP-DES-SYS-UNALLOCATED-OP' && d.relatedIds?.includes('op.review-evidence')),
    ).toBe(true)
  })

  it('blocks approval on an incomplete main-use-case path', () => {
    const draft = propose()
    const withIncompletePath: SystemStructureSpecification = {
      ...draft,
      workflowTraces: draft.workflowTraces.filter((t) => t.useCaseId !== 'uc.review-evidence'),
    }
    const gate = evaluateSystemStructureGate(withIncompletePath, application, operationIds)
    expect(gate.passed).toBe(false)
    expect(gate.diagnostics.some((d) => d.code === 'CAP-DES-SYS-INCOMPLETE-PATH')).toBe(true)
  })

  it('blocks approval when an external system has no adapter allocation', () => {
    const draft = propose()
    const withoutAdapter: SystemStructureSpecification = {
      ...draft,
      adapterAllocations: draft.adapterAllocations.filter((a) => a.adapterId !== 'adapter.ext-matlab'),
    }
    const gate = evaluateSystemStructureGate(withoutAdapter, application, operationIds)
    expect(gate.passed).toBe(false)
    expect(
      gate.diagnostics.some((d) => d.code === 'CAP-DES-SYS-MISSING-ADAPTER' && d.relatedIds?.includes('ext.matlab')),
    ).toBe(true)
  })

  it('blocks approval when a split (a second deployable) has no valid reason', () => {
    const draft = propose()
    const adapterModuleId = draft.moduleIds.find((id) => id !== 'mod.core')!
    const moved = moveModuleToDeployable(draft, adapterModuleId, 'deployable.secondary')
    expect(moved.ok).toBe(false)
    expect(moved.diagnostics.some((d) => d.code === 'CAP-DES-SYS-SPLIT-REASON')).toBe(true)
  })

  it('accepts a split with a valid, justified reason', () => {
    const draft = propose()
    const adapterModuleId = draft.moduleIds.find((id) => id !== 'mod.core')!
    const moved = moveModuleToDeployable(draft, adapterModuleId, 'deployable.secondary', {
      splitReason: 'trustBoundary',
      splitJustification: 'the adapter must run in a separately sandboxed process.',
    })
    expect(moved.ok).toBe(true)
    expect(moved.architecture!.deployables.length).toBe(2)
    const gate = evaluateSystemStructureGate(moved.architecture!, application, operationIds)
    expect(gate.passed).toBe(true)
  })
})

describe('EUC-03 structural change commands', () => {
  it('renameModule, changeModulePurpose, and changeModuleType update the definition', () => {
    const draft = propose()
    const renamed = renameModule(draft, 'mod.core', 'Evidence core')
    expect(renamed.ok).toBe(true)
    expect(renamed.architecture!.moduleDefinitions?.find((d) => d.moduleId === 'mod.core')?.name).toBe('Evidence core')

    const purposed = changeModulePurpose(renamed.architecture!, 'mod.core', 'Owns evidence intake and review.')
    expect(purposed.ok).toBe(true)
    expect(purposed.architecture!.moduleDefinitions?.find((d) => d.moduleId === 'mod.core')?.responsibility).toBe(
      'Owns evidence intake and review.',
    )

    const typed = changeModuleType(purposed.architecture!, 'mod.core', 'domain')
    expect(typed.ok).toBe(true)
    expect(typed.architecture!.moduleDefinitions?.find((d) => d.moduleId === 'mod.core')?.moduleType).toBe('domain')
  })

  it('rejects edits to an approved record', () => {
    const draft = propose()
    const approval = approveSystemStructure(draft, application, { approvedBy: 'architect-1', authority: 'software-architect' }, operationIds)
    expect(approval.ok).toBe(true)
    const renamed = renameModule(approval.architecture!, 'mod.core', 'New name')
    expect(renamed.ok).toBe(false)
    expect(renamed.diagnostics.some((d) => d.code === 'CAP-DES-SYS-APPROVED-LOCKED')).toBe(true)
  })
})

describe('EUC-03 approveSystemStructure', () => {
  it('approves a passing draft, freezes the §8.3 list, and does not claim module behavior complete', () => {
    const draft = propose()
    const result = approveSystemStructure(
      draft,
      application,
      { approvedBy: 'architect-1', authority: 'software-architect', approvedAt: '2026-01-01T00:00:00.000Z' },
      operationIds,
    )
    expect(result.ok).toBe(true)
    expect(result.architecture!.status).toBe('approved')
    expect(result.architecture!.approval?.approvedBy).toBe('architect-1')
    expect(result.architecture!.approval?.contentHash).toBe(result.architecture!.contentHash)
    expect(result.architecture!.approvalStatement).toMatch(/does not claim/i)
    expect(result.architecture!.approvalStatement).toMatch(/module design/i)
  })

  it('rejects approval by an agent actor', () => {
    const draft = propose()
    const result = approveSystemStructure(
      draft,
      application,
      { approvedBy: 'agent:copilot', authority: 'software-architect' },
      operationIds,
    )
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-SYS-AGENT-APPROVAL')).toBe(true)
  })

  it('rejects approval when the gate fails', () => {
    const draft = propose()
    const withCycle = addDependency(draft, draft.moduleIds.find((id) => id !== 'mod.core')!, 'mod.core', 'r')
    const result = approveSystemStructure(
      withCycle.architecture!,
      application,
      { approvedBy: 'architect-1', authority: 'software-architect' },
      operationIds,
    )
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-SYS-CYCLE')).toBe(true)
  })
})

describe('EUC-03 systemStructureStatus (§8.3 display data)', () => {
  it('reports approval state, counts, and blocking modules for the next implementation target', () => {
    // "mod.a-core" is chosen to sort alphabetically before the adapter module
    // ids so the deterministic next-target selection picks the module whose
    // dependencies are the adapters, making the blocking-modules case exercisable.
    const draft = proposeSystemStructure(application, {
      architectureId: 'arch-1',
      operations,
      primaryModuleId: 'mod.a-core',
    })
    const approved = approveSystemStructure(
      draft,
      application,
      { approvedBy: 'architect-1', authority: 'software-architect' },
      operationIds,
    ).architecture!
    const adapterModuleIds = approved.moduleIds.filter((id) => id !== 'mod.a-core')
    const status = systemStructureStatus(approved, [{ moduleId: 'mod.a-core', approved: false }])
    expect(status.approved).toBe(true)
    expect(status.approvedModuleDesignCount).toBe(0)
    expect(status.remainingModuleDesignCount).toBe(approved.moduleIds.length)
    expect(status.nextModuleId).toBe('mod.a-core')
    expect(status.blockingModuleIds.sort()).toEqual([...adapterModuleIds].sort())
  })
})
