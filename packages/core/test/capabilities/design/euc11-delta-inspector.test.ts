/**
 * EUC-11 — Delta inspector and apply planner.
 * Acceptance (SPECIFICATION.md §25.3 EUC-11):
 *  - an unapproved path blocks apply;
 *  - a workspace change after inspection requires new inspection;
 *  - apply changes all approved files or none;
 *  - unrelated workspace changes remain unchanged.
 * Also covers §19 (stale response preserved as evidence, never discarded)
 * and §20.2 (path-traversal / symlink-style escapes rejected).
 */
import { describe, expect, it } from 'vitest'
import {
  approveDeltaToApply,
  buildApplyPlan,
  buildApplyPlanWithRecords,
  inspectDelta,
  missingRequiredDeltaFields,
  normalizeReturnedPath,
  simulateApply,
  validateReturnedDelta,
  type DeltaWorkspaceContext,
} from '../../../src/capabilities/design/deltaInspector.js'
import type { ModuleImplementationPacket, ReturnedDelta } from '../../../src/capabilities/design/records.js'

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
    editableSharedPaths: ['capabilities/shared/types.ts'],
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

describe('EUC-11 normalizeReturnedPath (§20.2)', () => {
  it('accepts an ordinary relative path', () => {
    expect(normalizeReturnedPath('capabilities/modules/mod.x/index.ts')).toBe('capabilities/modules/mod.x/index.ts')
  })

  it('rejects a path-traversal segment', () => {
    expect(normalizeReturnedPath('capabilities/modules/../../etc/passwd')).toBeUndefined()
  })

  it('rejects an absolute unix path', () => {
    expect(normalizeReturnedPath('/etc/passwd')).toBeUndefined()
  })

  it('rejects an absolute windows path', () => {
    expect(normalizeReturnedPath('C:\\Windows\\System32\\evil.dll')).toBeUndefined()
  })

  it('rejects a home-relative (symlink-style) escape', () => {
    expect(normalizeReturnedPath('~/.ssh/id_rsa')).toBeUndefined()
  })
})

describe('EUC-11 validateReturnedDelta (§11.5 rejection rules)', () => {
  it('accepts a well-formed in-scope delta', () => {
    const result = validateReturnedDelta(delta(), packet(), workspace)
    expect(result.accepted).toBe(true)
    expect(result.rejectionReasons).toEqual([])
    expect(result.fileSummary.created).toEqual(['capabilities/modules/mod.evidence-store/index.ts'])
  })

  it('rejects an unknown packet id', () => {
    const result = validateReturnedDelta(delta({ packetId: 'packet-unknown' }), packet(), workspace)
    expect(result.accepted).toBe(false)
    expect(result.rejectionReasons).toEqual(['unknown-packet'])
  })

  it('rejects a stale base revision, and preserves the response as evidence rather than discarding it (§19)', () => {
    const staleDelta = delta({ baseRevision: 'r0' })
    const result = validateReturnedDelta(staleDelta, packet(), workspace)
    expect(result.accepted).toBe(false)
    expect(result.rejectionReasons).toContain('stale-base')
    // the exact returned content is preserved in the inspection, not thrown away
    expect(result.deltaId).toBe(staleDelta.deltaId)
    expect(result.testResults).toEqual(staleDelta.testResults)
    expect(result.inspectedContentHash).toBeTruthy()
  })

  it('rejects a stale base hash even when the revision string matches', () => {
    const result = validateReturnedDelta(delta({ baseHash: 'wrong-hash' }), packet(), workspace)
    expect(result.rejectionReasons).toContain('stale-base')
  })

  it('rejects a changed path outside the allowed set (an unapproved path blocks apply)', () => {
    const result = validateReturnedDelta(
      delta({ fileChanges: [{ path: 'capabilities/modules/other-module/index.ts', action: 'create', content: 'x' }] }),
      packet(),
      workspace,
    )
    expect(result.accepted).toBe(false)
    expect(result.rejectionReasons).toContain('path-outside-allowed')
    expect(result.outOfScopeAttempts).toContain('capabilities/modules/other-module/index.ts')
  })

  it('allows a change inside an editable shared path', () => {
    const result = validateReturnedDelta(
      delta({ fileChanges: [{ path: 'capabilities/shared/types.ts', action: 'change', content: 'x', contentHash: 'h' }] }),
      packet(),
      workspace,
    )
    expect(result.accepted).toBe(true)
    expect(result.fileSummary.changed).toEqual(['capabilities/shared/types.ts'])
  })

  it('rejects a path-traversal escape distinctly from an out-of-scope path', () => {
    const result = validateReturnedDelta(
      delta({ fileChanges: [{ path: '../../etc/passwd', action: 'create', content: 'x' }] }),
      packet(),
      workspace,
    )
    expect(result.accepted).toBe(false)
    expect(result.rejectionReasons).toContain('path-traversal')
  })

  it('rejects a deleted path that was not approved', () => {
    const result = validateReturnedDelta(
      delta({ fileChanges: [{ path: 'capabilities/modules/mod.evidence-store/old.ts', action: 'delete' }] }),
      packet(),
      workspace,
    )
    expect(result.accepted).toBe(false)
    expect(result.rejectionReasons).toContain('unapproved-delete')
  })

  it('allows a deleted path that was pre-approved', () => {
    const result = validateReturnedDelta(
      delta({ fileChanges: [{ path: 'capabilities/modules/mod.evidence-store/old.ts', action: 'delete' }] }),
      packet(),
      { ...workspace, approvedDeletes: ['capabilities/modules/mod.evidence-store/old.ts'] },
    )
    expect(result.accepted).toBe(true)
    expect(result.fileSummary.deleted).toEqual(['capabilities/modules/mod.evidence-store/old.ts'])
  })

  it('rejects a canonical contract change without an approved impact record', () => {
    const result = validateReturnedDelta(
      delta({ recordChanges: [{ recordId: 'op.import-evidence', kind: 'contract', summary: 'widened input' }] }),
      packet(),
      workspace,
    )
    expect(result.accepted).toBe(false)
    expect(result.rejectionReasons).toContain('contract-change-without-impact')
  })

  it('allows a canonical contract change with an approved impact record', () => {
    const result = validateReturnedDelta(
      delta({ recordChanges: [{ recordId: 'op.import-evidence', kind: 'contract', summary: 'widened input', payload: { impactRecordId: 'impact-1' } }] }),
      packet(),
      { ...workspace, approvedImpactRecordIds: ['impact-1'] },
    )
    expect(result.accepted).toBe(true)
  })

  it('rejects a response that omits its change manifest', () => {
    const result = validateReturnedDelta(delta({ fileChanges: [], recordChanges: [] }), packet(), workspace)
    expect(result.accepted).toBe(false)
    expect(result.rejectionReasons).toContain('missing-change-manifest')
  })

  it('rejects a response where required checks did not run and no reason exists', () => {
    const result = validateReturnedDelta(delta({ testResults: [], unresolvedIssues: [] }), packet(), workspace)
    expect(result.accepted).toBe(false)
    expect(result.rejectionReasons).toContain('checks-not-run')
  })

  it('allows skipped checks when a reason is recorded', () => {
    const result = validateReturnedDelta(
      delta({ testResults: [], unresolvedIssues: ['the test runner was unavailable in the sandbox'] }),
      packet(),
      workspace,
    )
    expect(result.rejectionReasons).not.toContain('checks-not-run')
  })

  // Second-review fix (P1): a non-contract record change used to be
  // accepted whenever `recordId === packet.moduleId`, *regardless of
  // kind* — see review-fixes-s4.test.ts for the full record-change policy
  // suite (kind allowlist, §5.3 approval-setting rejection, the apply-plan
  // record-changes carry-through, and the pure draft projection). These
  // two extend (never weaken) this file's existing "in scope" coverage
  // with the exact reproduced finding.
  it('rejects an architecture-kind record change on the packet own module that tries to set an approved status (reproduces the second-review finding)', () => {
    const result = validateReturnedDelta(
      delta({
        recordChanges: [{ recordId: 'mod.evidence-store', kind: 'architecture', summary: 'approval smuggled in', payload: { status: 'approved' } }],
      }),
      packet(),
      workspace,
    )
    expect(result.accepted).toBe(false)
    expect(result.rejectionReasons).toContain('record-change-not-allowed')
  })

  it('rejects a moduleDesign-kind record change on the packet own module that tries to set an approved status', () => {
    const result = validateReturnedDelta(
      delta({
        recordChanges: [{ recordId: 'mod.evidence-store', kind: 'moduleDesign', summary: 'approval smuggled in', payload: { status: 'approved' } }],
      }),
      packet(),
      workspace,
    )
    expect(result.accepted).toBe(false)
    expect(result.rejectionReasons).toContain('record-change-sets-approval')
  })
})

describe('EUC-11 missingRequiredDeltaFields (§19 partial response)', () => {
  it('identifies missing required fields without discarding valid data', () => {
    const partial = { ...delta(), deltaId: '', baseHash: '' } as ReturnedDelta
    const missing = missingRequiredDeltaFields(partial)
    expect(missing).toContain('deltaId')
    expect(missing).toContain('baseHash')
    const inspection = inspectDelta(partial, packet(), workspace, { rollbackPointRef: 'backup-1' })
    expect(inspection.accepted).toBe(false)
    expect(inspection.newWarnings.some((w) => w.includes('deltaId'))).toBe(true)
    // valid fields are still imported into the inspection
    expect(inspection.testResults).toEqual(partial.testResults)
  })
})

describe('EUC-11 inspectDelta (§11.6)', () => {
  it('shows the full inspection surface for an in-scope delta', () => {
    const inspection = inspectDelta(delta(), packet(), workspace, { rollbackPointRef: 'backup-1' })
    expect(inspection.accepted).toBe(true)
    expect(inspection.rollbackPointRef).toBe('backup-1')
    expect(inspection.fileSummary.created).toEqual(['capabilities/modules/mod.evidence-store/index.ts'])
  })

  it('classifies generated versus user-owned files', () => {
    const inspection = inspectDelta(delta(), packet(), workspace, {
      rollbackPointRef: 'backup-1',
      classifyFile: (path) => (path.endsWith('index.ts') ? 'generated' : 'userOwned'),
    })
    expect(inspection.generatedFiles).toEqual(['capabilities/modules/mod.evidence-store/index.ts'])
    expect(inspection.userOwnedFiles).toEqual([])
  })
})

describe('EUC-11 approveDeltaToApply', () => {
  it('rejects an agent actor', () => {
    const inspection = inspectDelta(delta(), packet(), workspace, { rollbackPointRef: 'backup-1' })
    const result = approveDeltaToApply(inspection, { approvedBy: 'agent:copilot', currentWorkspaceRevision: workspace.workspaceRevision! })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-DELTA-AGENT-APPROVAL')).toBe(true)
  })

  it('rejects approval of an unaccepted inspection', () => {
    const inspection = inspectDelta(delta({ baseRevision: 'stale' }), packet(), workspace, { rollbackPointRef: 'backup-1' })
    const result = approveDeltaToApply(inspection, { approvedBy: 'user-1', currentWorkspaceRevision: workspace.workspaceRevision! })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-DELTA-NOT-ACCEPTED')).toBe(true)
  })

  it('requires a new inspection when the workspace changed since inspection', () => {
    const inspection = inspectDelta(delta(), packet(), workspace, { rollbackPointRef: 'backup-1' })
    const result = approveDeltaToApply(inspection, { approvedBy: 'user-1', currentWorkspaceRevision: 'r2-changed' })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some((d) => d.code === 'workspace-changed-reinspect')).toBe(true)
  })

  it('approves an accepted inspection with an unchanged workspace', () => {
    const inspection = inspectDelta(delta(), packet(), workspace, { rollbackPointRef: 'backup-1' })
    const result = approveDeltaToApply(inspection, { approvedBy: 'user-1', currentWorkspaceRevision: workspace.workspaceRevision! })
    expect(result.ok).toBe(true)
  })
})

describe('EUC-11 buildApplyPlan and simulateApply (§12.2)', () => {
  it('orders deletes last', () => {
    const d = delta({
      fileChanges: [
        { path: 'capabilities/modules/mod.evidence-store/old.ts', action: 'delete' },
        { path: 'capabilities/modules/mod.evidence-store/index.ts', action: 'create', content: 'export {}', contentHash: 'hash-1' },
      ],
    })
    const inspection = inspectDelta(d, packet(), workspace, { rollbackPointRef: 'backup-1' })
    const plan = buildApplyPlan(inspection, d, { planId: 'plan-1', backupRef: 'backup-1' })
    expect(plan.orderedChanges.at(-1)?.action).toBe('delete')
  })

  it('applies every approved change and preserves unrelated files byte-identical', () => {
    const d = delta()
    const inspection = inspectDelta(d, packet(), workspace, { rollbackPointRef: 'backup-1' })
    const plan = buildApplyPlan(inspection, d, { planId: 'plan-1', backupRef: 'backup-1' })
    const files = { 'unrelated/file.ts': 'unchanged content' }
    const outcome = simulateApply(plan, files)
    expect(outcome.result.applied).toBe(true)
    expect(outcome.result.rolledBack).toBe(false)
    expect(outcome.files['capabilities/modules/mod.evidence-store/index.ts']).toBe('export {}')
    expect(outcome.files['unrelated/file.ts']).toBe('unchanged content')
    expect(outcome.result.resultWorkspaceRevision).toBeTruthy()
  })

  it('rolls back with zero mutations when any change conflicts (all files or none)', () => {
    const d = delta({
      fileChanges: [
        { path: 'capabilities/modules/mod.evidence-store/index.ts', action: 'create', content: 'export {}', contentHash: 'hash-1' },
        { path: 'capabilities/modules/mod.evidence-store/missing.ts', action: 'change', content: 'x', contentHash: 'h2' },
      ],
    })
    const inspection = inspectDelta(d, packet(), workspace, { rollbackPointRef: 'backup-1' })
    const plan = buildApplyPlan(inspection, d, { planId: 'plan-1', backupRef: 'backup-1' })
    const files = { 'unrelated/file.ts': 'unchanged content' }
    const outcome = simulateApply(plan, files)
    expect(outcome.result.applied).toBe(false)
    expect(outcome.result.rolledBack).toBe(true)
    expect(outcome.result.appliedFiles).toEqual([])
    // zero mutations: the file map returned is exactly the input map
    expect(outcome.files).toEqual(files)
    expect(outcome.files['capabilities/modules/mod.evidence-store/index.ts']).toBeUndefined()
  })

  it('rolls back a create that conflicts with an existing file of a different hash', () => {
    const d = delta({
      fileChanges: [{ path: 'capabilities/modules/mod.evidence-store/index.ts', action: 'create', content: 'export {}', contentHash: 'hash-1' }],
    })
    const inspection = inspectDelta(d, packet(), workspace, { rollbackPointRef: 'backup-1' })
    const plan = buildApplyPlan(inspection, d, { planId: 'plan-1', backupRef: 'backup-1' })
    const files = { 'capabilities/modules/mod.evidence-store/index.ts': 'already exists with different content' }
    const outcome = simulateApply(plan, files)
    expect(outcome.result.rolledBack).toBe(true)
    expect(outcome.files).toEqual(files)
  })

  // Second-review fix (P1): `buildApplyPlan` alone still cannot represent
  // accepted record changes (the frozen `DeltaApplyPlan` type has no field
  // for them); `buildApplyPlanWithRecords` carries them alongside an
  // identical plan instead of silently discarding them.
  it('buildApplyPlanWithRecords carries an accepted moduleDesign record change instead of silently discarding it', () => {
    const d = delta({
      recordChanges: [{ recordId: 'mod.evidence-store', kind: 'moduleDesign', summary: 'design update', payload: { invariants: ['x'] } }],
    })
    const inspection = inspectDelta(d, packet(), workspace, { rollbackPointRef: 'backup-1' })
    expect(inspection.accepted).toBe(true)
    const plainPlan = buildApplyPlan(inspection, d, { planId: 'plan-1', backupRef: 'backup-1' })
    const { plan, recordChanges } = buildApplyPlanWithRecords(inspection, d, { planId: 'plan-1', backupRef: 'backup-1' })
    expect(plan).toEqual(plainPlan)
    expect(recordChanges.moduleDesignChanges).toHaveLength(1)
    expect(recordChanges.moduleDesignChanges[0]?.recordId).toBe('mod.evidence-store')
  })
})
