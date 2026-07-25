/**
 * Review-fixes S4 — second-review record-change finding (P1, core half).
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §11.5,
 * §11.6, §12.2, §5.3 (approval-only-through-approval).
 *
 * The finding (deltaInspector.ts ~206-217, 433-446; repositoryAdapter.ts
 * ~410-461): a non-contract record change used to be accepted whenever
 * `recordId === packet.moduleId`, *regardless of kind* — a reviewer
 * run-confirmed an 'architecture' record change with `payload.status`
 * `'approved'` being wrongly accepted. The apply plan then carried only
 * FILE changes, so the accepted record change was silently discarded: the
 * delta reported "applied" while the inspected content and applied content
 * diverged.
 *
 * This suite covers the CORE policy half of the fix:
 *  1. an explicit record-kind allowlist that names the rejected kind;
 *  2. a distinct rejection when an allowlisted self-record change still
 *     tries to set an approved status or carry an approval object (§5.3);
 *  3. `buildApplyPlanWithRecords` / `PlanRecordChanges` — the accepted
 *     record changes are no longer silently discarded from the apply
 *     plan;
 *  4. `applyRecordChangeToDesign` — the pure projection the operations
 *     layer will use to persist an accepted moduleDesign record change as
 *     a DRAFT revision (never approved);
 *  5. `approveDeltaToApply`'s belt-and-braces refusal of an
 *     unrepresentable record-change kind that somehow reached approval.
 *
 * Documented, minimal deviation from the literal fix instruction: `'note'`
 * stays on the self-record allowlist alongside `'moduleDesign'` (see the
 * `ALLOWED_SELF_RECORD_KINDS` doc comment in deltaInspector.ts for the
 * full rationale — frozen, non-owned fixtures and an existing frozen test
 * already rely on it, and it carries no structured content to silently
 * discard). This suite exercises that compatibility explicitly so the
 * decision is test-covered, not just asserted in a comment.
 */
import { describe, expect, it } from 'vitest'
import {
  applyRecordChangeToDesign,
  approveDeltaToApply,
  buildApplyPlan,
  buildApplyPlanWithRecords,
  inspectDelta,
  validateReturnedDelta,
  type DeltaWorkspaceContext,
} from '../../../src/capabilities/design/deltaInspector.js'
import type { DeltaInspection, ModuleDesignSpecification, ModuleImplementationPacket, ReturnedDelta } from '../../../src/capabilities/design/records.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function packet(overrides: Partial<ModuleImplementationPacket> = {}): ModuleImplementationPacket {
  return {
    schemaVersion: '1.0',
    packetId: 'packet-1',
    projectId: 'proj-1',
    moduleId: 'mod.evidence-store',
    moduleVersion: '1.0.0',
    moduleDesignRevision: 'r1',
    moduleDesignHash: 'design-hash-r1',
    architectureRevision: 'r1',
    architectureHash: 'arch-hash',
    allowedPaths: ['capabilities/modules/mod.evidence-store/'],
    forbiddenPaths: ['**'],
    editableSharedPaths: [],
    providedContracts: [],
    requiredContracts: [],
    canonicalSchemaRefs: [],
    contextManifest: {
      id: 'ctx-1',
      targetRecordId: 'design.mod.evidence-store',
      targetRevision: 'r1',
      tokenOrByteLimit: 100_000,
      totalBytes: 0,
      entries: [],
      omitted: [],
      contentHash: 'ctx-hash',
    },
    targetDeployableId: 'deployable.primary',
    implementationSteps: ['create the module'],
    acceptanceCases: [],
    testCommands: ['npm test'],
    requiredEvidence: [],
    returnManifestSchemaRef: 'ReturnedDelta@1.0',
    idempotencyKey: 'idem-1',
    cancellationInstructions: 'stop and return partial progress',
    passKind: 'initial',
    createdAt: '2026-01-01T00:00:00.000Z',
    contentHash: 'packet-hash',
    ...overrides,
  }
}

function delta(overrides: Partial<ReturnedDelta> = {}): ReturnedDelta {
  return {
    schemaVersion: '1.0',
    deltaId: 'delta-1',
    packetId: 'packet-1',
    baseRevision: 'r1',
    baseHash: 'design-hash-r1',
    fileChanges: [
      { path: 'capabilities/modules/mod.evidence-store/index.ts', action: 'create', content: 'export {}', contentHash: 'hash-1' },
    ],
    recordChanges: [],
    testResults: [{ command: 'npm test', passed: true, summary: 'all green' }],
    assumptions: [],
    unresolvedIssues: [],
    requestedScopeChanges: [],
    evidenceFiles: [],
    returnedAt: '2026-01-02T00:00:00.000Z',
    contentHash: 'delta-hash',
    ...overrides,
  }
}

const workspace: DeltaWorkspaceContext = { workspaceRevision: 'r1', workspaceHash: 'design-hash-r1' }

function moduleDesignFixture(overrides: Partial<ModuleDesignSpecification> = {}): ModuleDesignSpecification {
  return {
    schemaVersion: '1.0',
    projectId: 'proj-1',
    id: 'design.mod.evidence-store',
    revision: 'r1',
    status: 'approved',
    architecture: { id: 'arch-1', revision: 'r1', contentHash: 'arch-hash' },
    module: {
      moduleId: 'mod.evidence-store',
      moduleVersion: '1.0.0',
      name: 'Evidence Store',
      moduleType: 'domain',
      responsibility: 'owns evidence records',
      nonResponsibilities: [],
      ownedConcerns: ['owns-thing'],
      excludedConcerns: [],
    },
    trace: { useCaseIds: ['uc.main'], scenarioStepIds: [], ruleIds: [], qualityRequirementIds: [], sourceRefs: [], designDecisionIds: [] },
    boundary: {
      directDependencyIds: [],
      directConsumerIds: [],
      deployableId: 'deployable.main',
      runtimeAllocation: 'local-embedded',
      runtimeLanguage: 'typescript',
      ownedPaths: [],
      editableSharedPaths: [],
    },
    providedOperations: [],
    requiredOperations: [],
    schemas: [],
    rules: [],
    invariants: [],
    behavior: {
      preconditions: [],
      postconditions: [],
      domainRejections: [],
      technicalFailures: [],
      sideEffects: [],
      idempotency: 'idempotent',
      cancellation: 'not cancellable',
      timeouts: 'medium',
      concurrency: 'single-threaded',
      retry: 'none',
      recovery: 'none',
      emittedEvents: [],
      consumedEvents: [],
    },
    data: {
      inputSchemas: [],
      outputSchemas: [],
      persistentRecords: [],
      dataOwnership: 'owned',
      retention: 'n/a',
      migrationNeeds: 'none',
      confidentiality: 'internal',
      provenanceFields: [],
      canonicalUnits: [],
      canonicalEnumerations: [],
    },
    runtime: {
      configurationRefs: [],
      secretReferenceIds: [],
      lifecycleRegistration: 'n/a',
      healthBehavior: 'n/a',
      telemetry: 'n/a',
      resourceOwnership: 'n/a',
      startupBehavior: 'n/a',
      shutdownBehavior: 'n/a',
      compatibilityConstraints: [],
    },
    verification: {
      examples: [],
      edgeCases: [],
      acceptanceCases: [],
      verificationSuiteIds: [],
      requiredEvidence: [],
      testDoubles: [],
      fixtureNeeds: [],
      configuredCommands: [],
      unresolvedItems: [],
    },
    typeSpecific: {
      moduleType: 'domain',
      detail: {
        domainVocabulary: [],
        valueObjects: [],
        consistencyBoundary: 'n/a',
        invariants: [],
        calculations: [],
        decisionTables: [],
        deterministicOrdering: 'n/a',
        canonicalIdentityRules: 'n/a',
        revisionComparison: 'n/a',
        invalidStatePrevention: 'n/a',
        operationPurity: [],
      },
    },
    diagrams: [],
    unresolvedItems: [],
    gates: [],
    contentHash: 'design-hash-r1',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// 1) record-kind allowlist (§11.5)
// ---------------------------------------------------------------------------

describe('S4 record-change kind allowlist (§11.5) — the reviewer-confirmed finding', () => {
  it('rejects an architecture-kind record change on the packet own module, naming the kind (the exact reproduced finding)', () => {
    const result = validateReturnedDelta(
      delta({
        recordChanges: [{ recordId: 'mod.evidence-store', kind: 'architecture', summary: 'sneaks in an approval', payload: { status: 'approved' } }],
      }),
      packet(),
      workspace,
    )
    expect(result.accepted).toBe(false)
    expect(result.rejectionReasons).toContain('record-change-not-allowed')
    expect(result.outOfScopeAttempts.some((a) => a.includes('mod.evidence-store') && a.includes('architecture'))).toBe(true)
  })

  it.each(['approval', 'baseline', 'unknown-kind'])('rejects a %s-kind record change on the packet own module', (kind) => {
    const result = validateReturnedDelta(
      delta({ recordChanges: [{ recordId: 'mod.evidence-store', kind, summary: 'not allowed' }] }),
      packet(),
      workspace,
    )
    expect(result.accepted).toBe(false)
    expect(result.rejectionReasons).toContain('record-change-not-allowed')
  })

  it('rejects a moduleDesign-kind record change targeting a different module', () => {
    const result = validateReturnedDelta(
      delta({ recordChanges: [{ recordId: 'mod.other-module', kind: 'moduleDesign', summary: 'wrong module' }] }),
      packet(),
      workspace,
    )
    expect(result.accepted).toBe(false)
    expect(result.rejectionReasons).toContain('record-change-not-allowed')
  })

  it('accepts a moduleDesign-kind record change targeting the packet own module', () => {
    const result = validateReturnedDelta(
      delta({ recordChanges: [{ recordId: 'mod.evidence-store', kind: 'moduleDesign', summary: 'real design content', payload: { invariants: ['x'] } }] }),
      packet(),
      workspace,
    )
    expect(result.accepted).toBe(true)
    expect(result.rejectionReasons).not.toContain('record-change-not-allowed')
  })

  it('still allows a note-kind record change on the packet own module (documented compatibility)', () => {
    const result = validateReturnedDelta(
      delta({ recordChanges: [{ recordId: 'mod.evidence-store', kind: 'note', summary: 'implementation notes' }] }),
      packet(),
      workspace,
    )
    expect(result.accepted).toBe(true)
  })

  it('still allows a contract-kind record change with an approved impact record (unchanged rule)', () => {
    const result = validateReturnedDelta(
      delta({ recordChanges: [{ recordId: 'op.import-evidence', kind: 'contract', summary: 'widened input', payload: { impactRecordId: 'impact-1' } }] }),
      packet(),
      { ...workspace, approvedImpactRecordIds: ['impact-1'] },
    )
    expect(result.accepted).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 2) approval-setting rejection (§5.3)
// ---------------------------------------------------------------------------

describe('S4 record-change-sets-approval (§5.3 approval-only-through-approval)', () => {
  it('rejects a moduleDesign record change whose payload sets status "approved"', () => {
    const result = validateReturnedDelta(
      delta({ recordChanges: [{ recordId: 'mod.evidence-store', kind: 'moduleDesign', summary: 'sneaky approval', payload: { status: 'approved' } }] }),
      packet(),
      workspace,
    )
    expect(result.accepted).toBe(false)
    expect(result.rejectionReasons).toContain('record-change-sets-approval')
    expect(result.rejectionReasons).not.toContain('record-change-not-allowed')
  })

  it('rejects a moduleDesign record change whose payload carries an approval object', () => {
    const result = validateReturnedDelta(
      delta({
        recordChanges: [
          {
            recordId: 'mod.evidence-store',
            kind: 'moduleDesign',
            summary: 'sneaky approval object',
            payload: { approval: { approvedBy: 'agent:copilot', authority: 'module-owner', approvedAt: '2026-01-01T00:00:00.000Z' } },
          },
        ],
      }),
      packet(),
      workspace,
    )
    expect(result.accepted).toBe(false)
    expect(result.rejectionReasons).toContain('record-change-sets-approval')
  })

  it('rejects a note-kind record change on the own module that also tries to set an approved status', () => {
    // The approval-setting check applies regardless of which allowlisted
    // kind carries it — the §5.3 bypass this finding is about is closed
    // for every allowlisted self-record kind, not only 'moduleDesign'.
    const result = validateReturnedDelta(
      delta({ recordChanges: [{ recordId: 'mod.evidence-store', kind: 'note', summary: 'note claiming approval', payload: { status: 'approved' } }] }),
      packet(),
      workspace,
    )
    expect(result.accepted).toBe(false)
    expect(result.rejectionReasons).toContain('record-change-sets-approval')
  })

  it('accepts a moduleDesign record change with a needsInput status (not an approval)', () => {
    const result = validateReturnedDelta(
      delta({ recordChanges: [{ recordId: 'mod.evidence-store', kind: 'moduleDesign', summary: 'still needs input', payload: { status: 'needsInput' } }] }),
      packet(),
      workspace,
    )
    expect(result.accepted).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 3) buildApplyPlanWithRecords — no silent discard (§12.2)
// ---------------------------------------------------------------------------

describe('S4 buildApplyPlanWithRecords (§12.2 no silent discard)', () => {
  it('produces the same plan buildApplyPlan would, plus the accepted record changes split by kind', () => {
    const d = delta({
      recordChanges: [
        { recordId: 'mod.evidence-store', kind: 'moduleDesign', summary: 'design update', payload: { invariants: ['x'] } },
        { recordId: 'op.import-evidence', kind: 'contract', summary: 'widened input', payload: { impactRecordId: 'impact-1' } },
        { recordId: 'mod.evidence-store', kind: 'note', summary: 'informational' },
      ],
    })
    const inspection = inspectDelta(d, packet(), { ...workspace, approvedImpactRecordIds: ['impact-1'] }, { rollbackPointRef: 'backup-1' })
    expect(inspection.accepted).toBe(true)

    const basePlan = buildApplyPlan(inspection, d, { planId: 'plan-1', backupRef: 'backup-1' })
    const { plan, recordChanges } = buildApplyPlanWithRecords(inspection, d, { planId: 'plan-1', backupRef: 'backup-1' })

    expect(plan).toEqual(basePlan)
    expect(recordChanges.planId).toBe('plan-1')
    expect(recordChanges.moduleDesignChanges).toEqual([
      { recordId: 'mod.evidence-store', kind: 'moduleDesign', summary: 'design update', payload: { invariants: ['x'] } },
    ])
    expect(recordChanges.contractChanges).toEqual([
      { recordId: 'op.import-evidence', kind: 'contract', summary: 'widened input', payload: { impactRecordId: 'impact-1' } },
    ])
    // the 'note' change is not "content to apply" (see the allowlist doc
    // comment) — it is not silently discarded either: it remains fully
    // visible on the inspection itself (§11.6 "the user shall see record
    // changes").
    expect(inspection.recordChanges.some((c) => c.kind === 'note')).toBe(true)
  })

  it('produces an empty recordChanges split when the delta carries no record changes', () => {
    const d = delta()
    const inspection = inspectDelta(d, packet(), workspace, { rollbackPointRef: 'backup-1' })
    const { recordChanges } = buildApplyPlanWithRecords(inspection, d, { planId: 'plan-1', backupRef: 'backup-1' })
    expect(recordChanges.moduleDesignChanges).toEqual([])
    expect(recordChanges.contractChanges).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 4) applyRecordChangeToDesign — pure DRAFT projection (§12.2, §5.3)
// ---------------------------------------------------------------------------

describe('S4 applyRecordChangeToDesign (draft-only projection)', () => {
  it('projects an accepted moduleDesign change onto the design and forces status to draft', () => {
    const design = moduleDesignFixture({ status: 'approved' })
    const { updated, diagnostics } = applyRecordChangeToDesign(design, {
      recordId: 'mod.evidence-store',
      kind: 'moduleDesign',
      summary: 'add an invariant',
      payload: { invariants: ['records are immutable once written'] },
    })
    expect(updated.status).toBe('draft')
    expect(updated.invariants).toEqual(['records are immutable once written'])
    expect(diagnostics).toEqual([])
    // the original design object is untouched (pure projection)
    expect(design.status).toBe('approved')
  })

  it('keeps needsInput when the payload explicitly requests it', () => {
    const design = moduleDesignFixture()
    const { updated } = applyRecordChangeToDesign(design, {
      recordId: 'mod.evidence-store',
      kind: 'moduleDesign',
      summary: 'still needs input',
      payload: { status: 'needsInput' },
    })
    expect(updated.status).toBe('needsInput')
  })

  it('strips an approved status and an approval object, forcing draft and emitting a diagnostic (§5.3 belt and braces)', () => {
    const design = moduleDesignFixture()
    const { updated, diagnostics } = applyRecordChangeToDesign(design, {
      recordId: 'mod.evidence-store',
      kind: 'moduleDesign',
      summary: 'sneaky approval that should never reach this far',
      payload: {
        status: 'approved',
        approval: { approvedBy: 'agent:copilot', authority: 'module-owner', approvedAt: '2026-01-01T00:00:00.000Z', recordId: 'x', revision: 'r2', contentHash: 'h' },
      },
    })
    expect(updated.status).toBe('draft')
    expect(updated.approval).toBeUndefined()
    expect(diagnostics.some((d) => d.code === 'CAP-DES-RECORD-CHANGE-APPROVAL-STRIPPED')).toBe(true)
  })

  it('returns the design unchanged with a diagnostic when called with a non-moduleDesign kind', () => {
    const design = moduleDesignFixture()
    const { updated, diagnostics } = applyRecordChangeToDesign(design, { recordId: 'mod.evidence-store', kind: 'note', summary: 'just a note' })
    expect(updated).toEqual(design)
    expect(diagnostics.some((d) => d.code === 'CAP-DES-RECORD-CHANGE-WRONG-KIND')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 5) approveDeltaToApply refuses an unrepresentable accepted record change
// ---------------------------------------------------------------------------

describe('S4 approveDeltaToApply refuses an unrepresentable record-change kind', () => {
  it('refuses approval when a tampered inspection carries an accepted record change of a disallowed kind', () => {
    const inspection = inspectDelta(delta(), packet(), workspace, { rollbackPointRef: 'backup-1' })
    // Simulate a tampered/stale inspection object bypassing validateReturnedDelta.
    const tampered: DeltaInspection = {
      ...inspection,
      accepted: true,
      rejectionReasons: [],
      recordChanges: [{ recordId: 'mod.evidence-store', kind: 'architecture', summary: 'should never get here' }],
    }
    const result = approveDeltaToApply(tampered, { approvedBy: 'user-1', currentWorkspaceRevision: workspace.workspaceRevision! })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-DELTA-RECORD-CHANGE-UNREPRESENTABLE')).toBe(true)
  })

  it('still approves a real accepted delta whose record changes are all representable', () => {
    const d = delta({ recordChanges: [{ recordId: 'mod.evidence-store', kind: 'moduleDesign', summary: 'ok', payload: { invariants: ['x'] } }] })
    const inspection = inspectDelta(d, packet(), workspace, { rollbackPointRef: 'backup-1' })
    expect(inspection.accepted).toBe(true)
    const result = approveDeltaToApply(inspection, { approvedBy: 'user-1', currentWorkspaceRevision: workspace.workspaceRevision! })
    expect(result.ok).toBe(true)
  })
})
