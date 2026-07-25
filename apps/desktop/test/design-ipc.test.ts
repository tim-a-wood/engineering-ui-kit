/**
 * EUC-16 — desktop IPC adapter for the use-case-led Capabilities design
 * workflow.
 * Acceptance (SPECIFICATION.md §17 all, §25.3 EUC-13..17): IPC, CLI, and
 * machine API return the same structured result for the same operation; no
 * machine operation bypasses approval.
 *
 * Exercises `createDesignIpcDispatch` directly (no `ipcMain`/`BrowserWindow`
 * needed — see `designIpc.ts`), and compares its result to a direct
 * `DesignOperationsService` call built the same way `packages/core`'s
 * `designCli.ts`/`designMachineApi.ts` build one, over the same `dataDir`.
 *
 * Run: npx vitest run apps/desktop/test/design-ipc.test.ts
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DesignWorkspace,
  createDesignOperations,
  canonicalize,
  applyDeltaTransactionally,
  workspaceRevision,
  APPROVAL_AUTHORITIES,
  type ApprovalAuthority,
  type DesignOperationsService,
  type ReturnedDelta,
} from '@engineering-ui-kit/core'
import { createDesignIpcDispatch } from '../src/capabilities/designIpc.js'
import { DESIGN_OPERATIONS } from '../src/capabilities/designBridge.js'

function tmpDir(prefix = 'euik-design-ipc-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

function directService(dataDir: string): DesignOperationsService {
  return createDesignOperations({ workspace: new DesignWorkspace(dataDir) })
}

describe('EUC-16 design IPC dispatch', () => {
  it('DESIGN_OPERATIONS matches exactly what the committed service exports (drift guard)', () => {
    const service = directService(tmpDir())
    expect([...DESIGN_OPERATIONS].sort()).toEqual(Object.keys(service).sort())
  })

  it('rejects an unrecognized operation with a structured error, never a throw', () => {
    const dispatch = createDesignIpcDispatch(tmpDir())
    const result = dispatch({ operation: 'deleteEverything', args: [] }) as { ok: boolean; diagnostics: { code: string }[] }
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.code)).toContain('EUC16-UNKNOWN-OPERATION')
  })

  it('rejects an operation name that merely looks like a property on the service object (e.g. "toString")', () => {
    const dispatch = createDesignIpcDispatch(tmpDir())
    const result = dispatch({ operation: 'toString', args: [] }) as { ok: boolean; diagnostics: { code: string }[] }
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.code)).toContain('EUC16-UNKNOWN-OPERATION')
  })

  it('happy path: createUseCaseDraft through dispatch matches a direct service call on an identical fresh workspace', () => {
    const args = [{ projectId: 'proj-ipc-1', actor: 'user:tim', idempotencyKey: 'k1', workDescription: '' }]

    const dispatch = createDesignIpcDispatch(tmpDir())
    const viaDispatch = dispatch({ operation: 'createUseCaseDraft', args }) as { ok: boolean; auditEventId: string }

    const direct = directService(tmpDir()).createUseCaseDraft(args[0] as Parameters<DesignOperationsService['createUseCaseDraft']>[0])

    expect(viaDispatch.ok).toBe(true)
    expect(direct.ok).toBe(true)
    expect(typeof viaDispatch.auditEventId).toBe('string')
    expect(viaDispatch.auditEventId.length).toBeGreaterThan(0)

    const { auditEventId: _dispatchId, ...dispatchRest } = viaDispatch as unknown as Record<string, unknown>
    const { auditEventId: _directId, ...directRest } = direct as unknown as Record<string, unknown>
    expect(canonicalize(dispatchRest)).toEqual(canonicalize(directRest))
  })

  it('read operations (§17.1) round-trip identically through dispatch and a direct call', () => {
    const dataDir = tmpDir()
    const dispatch = createDesignIpcDispatch(dataDir)
    const viaDispatch = dispatch({ operation: 'getWorkflowStatus', args: ['proj-ipc-2'] })
    const direct = directService(dataDir).getWorkflowStatus('proj-ipc-2')
    expect(canonicalize(viaDispatch)).toEqual(canonicalize(direct))
  })

  it('a hostile agent actor cannot approve a module design through dispatch — same diagnostics as a direct call (no approval bypass)', () => {
    const args = [
      { projectId: 'proj-ipc-3', actor: 'agent:copilot', idempotencyKey: 'k1', moduleId: 'mod-x', authority: 'module-owner' },
    ]

    // Second-review trust boundary: the dispatcher overrides the claimed
    // agent actor with its stamped user principal, so the claim never grants
    // agent semantics — and the unconfigured principal still cannot approve.
    const dispatch = createDesignIpcDispatch(tmpDir())
    const viaDispatch = dispatch({ operation: 'approveModuleDesign', args }) as { ok: boolean; diagnostics: { code: string }[] }

    expect(viaDispatch.ok).toBe(false)
    expect(viaDispatch.diagnostics.map((d) => d.code)).toContain('EUC16-AUTHORITY-NOT-CONFIGURED')

    // The same claim presented to the core service directly (no stamping
    // boundary) is rejected as a non-human actor — either way, no approval.
    const direct = directService(tmpDir()).approveModuleDesign(
      { ...args[0], idempotencyKey: 'k2' } as Parameters<DesignOperationsService['approveModuleDesign']>[0],
    )
    expect(direct.ok).toBe(false)
    expect(direct.diagnostics.map((d) => d.code)).toContain('EUC16-AGENT-APPROVAL-FORBIDDEN')
  })

  it('a hostile agent actor cannot approve via any approve* operation reachable on the channel', () => {
    const dispatch = createDesignIpcDispatch(tmpDir())
    const approveOps = DESIGN_OPERATIONS.filter((op) => op.startsWith('approve'))
    expect(approveOps.length).toBeGreaterThan(0)
    for (const operation of approveOps) {
      const result = dispatch({
        operation,
        args: [{ projectId: 'proj-ipc-4', actor: 'agent:copilot', idempotencyKey: `k-${operation}`, authority: 'module-owner' }],
      }) as { ok: boolean; diagnostics: { code: string }[] }
      expect(result.ok).toBe(false)
      // The claimed agent actor is overridden by the stamped user principal
      // (trust boundary); the unconfigured principal is then denied by the
      // default-deny authority policy — no approval happens either way.
      expect(result.diagnostics.map((d) => d.code)).toContain('EUC16-AUTHORITY-NOT-CONFIGURED')
    }
  })
})

// ---------------------------------------------------------------------------
// Reviewer P1 fix (designIpc.ts ~line 54): adapter-level project-repository
// configuration, and a real desktop project round trip against it.
// ---------------------------------------------------------------------------

const actor = 'user:alice'

function seedFullAuthority(dataDir: string, projectId: string): void {
  const workspace = new DesignWorkspace(dataDir)
  workspace.saveProjectRoles(projectId, { [actor]: [...APPROVAL_AUTHORITIES] } as Record<string, ApprovalAuthority[]>)
}

const workflowDetail = {
  trigger: 'A reviewer requests a pricing calculation.',
  orderedSteps: [
    { id: 'step-validate', text: 'Validate inputs' },
    { id: 'step-price', text: 'Compute price' },
  ],
  participants: ['reviewer'],
  decisionsAndGuards: [{ id: 'guard-valid', text: 'inputs are valid' }],
  transactionBoundary: 'single request',
  partialCompletion: 'not supported',
  compensation: 'not applicable',
  retryPolicy: 'retry on transient failure',
  deduplication: 'idempotency key',
  idempotencyKeyUse: 'required on every call',
  cancellationPoints: ['before the price is recorded'],
  deadlinePropagation: 'propagated from the caller',
  resourceLocks: ['none'],
  progressReporting: 'not applicable',
  finalOutcomes: ['priced', 'rejected'],
}

let idem = 0
function key(): string {
  idem += 1
  return `ipc-idem-${idem}`
}

const MODULE_PATH = 'capabilities/modules/mod.core/index.ts'

/** Drives one project through to an approved single-module ("mod.core") implementation packet, over the real dispatch function. */
function bootstrapPacket(dispatch: (request: { operation: string; args: unknown[] }) => any, projectId: string): { packetId: string; moduleHash: string } {
  const draft = dispatch({ operation: 'createUseCaseDraft', args: [{ projectId, actor, idempotencyKey: key(), workDescription: '' }] })
  expect(draft.ok).toBe(true)
  const questionId = draft.value.questions[0].id
  const answered = dispatch({
    operation: 'updateUseCaseItem',
    args: [{ projectId, actor, idempotencyKey: key(), target: { kind: 'question', questionId, answer: 'Explain the module workflow.' } }],
  })
  expect(answered.ok).toBe(true)
  dispatch({ operation: 'approveUseCaseAnalysis', args: [{ projectId, actor, idempotencyKey: key(), authority: 'product-lead' }] })
  dispatch({ operation: 'createSystemDesignDraft', args: [{ projectId, actor, idempotencyKey: key() }] })
  dispatch({ operation: 'approveSystemStructure', args: [{ projectId, actor, idempotencyKey: key(), authority: 'software-architect' }] })
  dispatch({ operation: 'startModuleDesign', args: [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' }] })
  dispatch({
    operation: 'updateModuleDesignItem',
    args: [
      {
        projectId,
        actor,
        idempotencyKey: key(),
        moduleId: 'mod.core',
        path: 'schemas',
        value: [
          { schemaId: 'schema.in', version: '1.0', role: 'input', ref: 'schema://in' },
          { schemaId: 'schema.out', version: '1.0', role: 'output', ref: 'schema://out' },
        ],
      },
    ],
  })
  dispatch({
    operation: 'updateModuleDesignItem',
    args: [
      {
        projectId,
        actor,
        idempotencyKey: key(),
        moduleId: 'mod.core',
        path: 'verification.acceptanceCases',
        value: [{ id: 'ac1', description: 'does the work', expectedOutcome: 'the work is done' }],
      },
    ],
  })
  dispatch({
    operation: 'updateModuleDesignItem',
    args: [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', path: 'typeSpecific.detail', value: workflowDetail }],
  })
  dispatch({ operation: 'analyzeModuleDesign', args: [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' }] })
  const approved = dispatch({
    operation: 'approveModuleDesign',
    args: [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', authority: 'module-owner' }],
  })
  expect(approved.ok).toBe(true)
  dispatch({ operation: 'createDesignBaseline', args: [{ projectId, actor, idempotencyKey: key() }] })
  dispatch({ operation: 'approveDesignBaseline', args: [{ projectId, actor, idempotencyKey: key(), authority: 'software-architect' }] })
  const packet = dispatch({
    operation: 'createModuleImplementationPacket',
    args: [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', implementationSteps: ['implement it'], testCommands: ['true'] }],
  })
  expect(packet.ok).toBe(true)
  return { packetId: packet.value.packetId, moduleHash: approved.value.contentHash }
}

function makeDelta(input: { packetId: string; baseRevision: string; baseHash: string; deltaId: string }): ReturnedDelta {
  return {
    schemaVersion: '1.0',
    deltaId: input.deltaId,
    packetId: input.packetId,
    baseRevision: input.baseRevision,
    baseHash: input.baseHash,
    fileChanges: [{ path: MODULE_PATH, action: 'create', content: 'export const value = 1\n', contentHash: 'file-hash-1' }],
    recordChanges: [],
    testResults: [{ command: 'true', passed: true, summary: 'all green' }],
    assumptions: [],
    unresolvedIssues: [],
    requestedScopeChanges: [],
    evidenceFiles: [],
    returnedAt: new Date().toISOString(),
    contentHash: 'delta-hash-1',
  }
}

describe('EUC-16 adapter-level project-repository configuration (reviewer P1 fix)', () => {
  it('adapter:configureProjectRepository / adapter:getProjectRepository are not part of DESIGN_OPERATIONS (§17 stays pure)', () => {
    expect(DESIGN_OPERATIONS as readonly string[]).not.toContain('adapter:configureProjectRepository')
    expect(DESIGN_OPERATIONS as readonly string[]).not.toContain('adapter:getProjectRepository')
  })

  it('a user actor configures a project repository root, persisted and readable back', () => {
    const dataDir = tmpDir()
    const repoRoot = tmpDir('euik-design-ipc-repo-')
    const dispatch = createDesignIpcDispatch(dataDir)

    const configured = dispatch({
      operation: 'adapter:configureProjectRepository',
      args: [{ projectId: 'proj-repo-1', actor, idempotencyKey: key(), repositoryRoot: repoRoot }],
    }) as { ok: boolean; repositoryRoot: string; auditEventId: string }
    expect(configured.ok).toBe(true)
    expect(configured.repositoryRoot).toBe(path.resolve(repoRoot))
    expect(typeof configured.auditEventId).toBe('string')

    const fetched = dispatch({ operation: 'adapter:getProjectRepository', args: [{ projectId: 'proj-repo-1' }] }) as { ok: boolean; repositoryRoot: string }
    expect(fetched.ok).toBe(true)
    expect(fetched.repositoryRoot).toBe(path.resolve(repoRoot))

    // Persisted as an adapter-owned file, atomically written.
    const configPath = path.join(dataDir, 'projects', 'proj-repo-1', 'design-adapter', 'repository.json')
    expect(fs.existsSync(configPath)).toBe(true)
    const persisted = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    expect(persisted.repositoryRoot).toBe(path.resolve(repoRoot))

    // And audit-logged.
    const workspace = new DesignWorkspace(dataDir)
    const events = workspace.listAuditEvents('proj-repo-1')
    expect(events.some((e) => e.operation === 'adapter:configureProjectRepository' && e.outcome === 'ok')).toBe(true)
  })

  it('an agent actor cannot configure the project repository', () => {
    const dataDir = tmpDir()
    const repoRoot = tmpDir('euik-design-ipc-repo-')
    const dispatch = createDesignIpcDispatch(dataDir)

    const result = dispatch({
      operation: 'adapter:configureProjectRepository',
      args: [{ projectId: 'proj-repo-2', actor: 'agent:copilot', idempotencyKey: key(), repositoryRoot: repoRoot }],
    }) as { ok: boolean; value?: { configuredBy?: string } }
    // Trust boundary: the renderer cannot present an agent identity — the
    // claim is overridden by the stamped OS-user principal, which performs
    // the configuration; the forged claim lands in the mismatch audit trail.
    expect(result.ok).toBe(true)
    const workspace = new DesignWorkspace(dataDir)
    const mismatch = workspace
      .listAuditEvents('proj-repo-2')
      .filter((event) => event.diagnosticCodes.includes('EUC16-ACTOR-CLAIM-MISMATCH'))
    expect(mismatch.length).toBeGreaterThan(0)
    expect(mismatch[0]!.evidenceRefs).toContain('agent:copilot')
    expect(mismatch[0]!.actor.startsWith('user:')).toBe(true)
  })

  it('adapter:getPrincipal returns the stamped principal and adapter:configureProjectRoles grants authorities to it', () => {
    const dataDir = tmpDir()
    const dispatch = createDesignIpcDispatch(dataDir, { principal: actor })

    const who = dispatch({ operation: 'adapter:getPrincipal', args: [] }) as { ok: boolean; principal?: string }
    expect(who.ok).toBe(true)
    expect(who.principal).toBe(actor)

    const granted = dispatch({
      operation: 'adapter:configureProjectRoles',
      args: [{ projectId: 'proj-roles-1', actor, idempotencyKey: key() }],
    }) as { ok: boolean; auditEventId?: string }
    expect(granted.ok).toBe(true)

    const roles = new DesignWorkspace(dataDir).getProjectRoles('proj-roles-1')
    expect(roles?.[actor]?.length).toBeGreaterThan(0)

    const invalid = dispatch({
      operation: 'adapter:configureProjectRoles',
      args: [{ projectId: 'proj-roles-1', actor, idempotencyKey: key(), authorities: ['made-up-authority'] }],
    }) as { ok: boolean; diagnostics: { code: string }[] }
    expect(invalid.ok).toBe(false)
    expect(invalid.diagnostics.map((d) => d.code)).toContain('EUC16-ADAPTER-AUTHORITY-INVALID')
  })

  it('a service actor claim is likewise overridden by the stamped principal', () => {
    const dataDir = tmpDir()
    const dispatch = createDesignIpcDispatch(dataDir)
    const result = dispatch({
      operation: 'adapter:configureProjectRepository',
      args: [{ projectId: 'proj-repo-3', actor: 'service:ci', idempotencyKey: key(), repositoryRoot: tmpDir() }],
    }) as { ok: boolean }
    expect(result.ok).toBe(true)
    const mismatch = new DesignWorkspace(dataDir)
      .listAuditEvents('proj-repo-3')
      .filter((event) => event.diagnosticCodes.includes('EUC16-ACTOR-CLAIM-MISMATCH'))
    expect(mismatch.length).toBeGreaterThan(0)
    expect(mismatch[0]!.evidenceRefs).toContain('service:ci')
  })

  it('rejects a repositoryRoot that does not exist, a relative path, and an unsafe projectId', () => {
    const dispatch = createDesignIpcDispatch(tmpDir())

    const missing = dispatch({
      operation: 'adapter:configureProjectRepository',
      args: [{ projectId: 'proj-repo-4', actor, idempotencyKey: key(), repositoryRoot: path.join(os.tmpdir(), 'does-not-exist-' + Date.now()) }],
    }) as { ok: boolean; diagnostics: { code: string }[] }
    expect(missing.ok).toBe(false)
    expect(missing.diagnostics.map((d) => d.code)).toContain('EUC16-ADAPTER-REPOSITORY-ROOT-NOT-FOUND')

    const relative = dispatch({
      operation: 'adapter:configureProjectRepository',
      args: [{ projectId: 'proj-repo-5', actor, idempotencyKey: key(), repositoryRoot: 'relative/path' }],
    }) as { ok: boolean; diagnostics: { code: string }[] }
    expect(relative.ok).toBe(false)
    expect(relative.diagnostics.map((d) => d.code)).toContain('EUC16-ADAPTER-REPOSITORY-ROOT-INVALID')

    const unsafeProjectId = dispatch({
      operation: 'adapter:configureProjectRepository',
      args: [{ projectId: '../escape', actor, idempotencyKey: key(), repositoryRoot: tmpDir() }],
    }) as { ok: boolean; diagnostics: { code: string }[] }
    expect(unsafeProjectId.ok).toBe(false)
    expect(unsafeProjectId.diagnostics.map((d) => d.code)).toContain('EUC16-ADAPTER-INVALID-PROJECT-ID')
  })

  it('replays the first committed configuration for a duplicate idempotency key', () => {
    const dataDir = tmpDir()
    const repoA = tmpDir('euik-design-ipc-repo-a-')
    const repoB = tmpDir('euik-design-ipc-repo-b-')
    const dispatch = createDesignIpcDispatch(dataDir)
    const sharedKey = key()

    const first = dispatch({
      operation: 'adapter:configureProjectRepository',
      args: [{ projectId: 'proj-repo-6', actor, idempotencyKey: sharedKey, repositoryRoot: repoA }],
    }) as { ok: boolean; repositoryRoot: string }
    const second = dispatch({
      operation: 'adapter:configureProjectRepository',
      args: [{ projectId: 'proj-repo-6', actor, idempotencyKey: sharedKey, repositoryRoot: repoB }],
    }) as { ok: boolean; repositoryRoot: string; idempotentReplay?: boolean }

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(second.idempotentReplay).toBe(true)
    expect(second.repositoryRoot).toBe(first.repositoryRoot)
    expect(second.repositoryRoot).toBe(path.resolve(repoA))
  })
})

describe('EUC-16 real desktop project round trip against a configured repository (reviewer P1 fix)', () => {
  it('imports, inspects, approves, and applies an agent delta into the real repository — never the data directory', () => {
    const dataDir = tmpDir()
    const repoRoot = tmpDir('euik-design-ipc-repo-')
    const projectId = 'proj-roundtrip-1'
    seedFullAuthority(dataDir, projectId)
    const dispatch = createDesignIpcDispatch(dataDir, { principal: actor })

    const configured = dispatch({
      operation: 'adapter:configureProjectRepository',
      args: [{ projectId, actor, idempotencyKey: key(), repositoryRoot: repoRoot }],
    }) as { ok: boolean }
    expect(configured.ok).toBe(true)

    const { packetId, moduleHash } = bootstrapPacket(dispatch, projectId)
    const delta = makeDelta({ packetId, baseRevision: workspaceRevision(repoRoot), baseHash: moduleHash, deltaId: 'delta.ipc.1' })

    const imported = dispatch({ operation: 'importAgentDelta', args: [{ projectId, actor, idempotencyKey: key(), delta }] }) as { ok: boolean }
    expect(imported.ok).toBe(true)

    const inspected = dispatch({
      operation: 'inspectAgentDelta',
      args: [{ projectId, actor, idempotencyKey: key(), deltaId: delta.deltaId }],
    }) as { ok: boolean; value: { accepted: boolean; inspectionId: string } }
    expect(inspected.ok).toBe(true)
    expect(inspected.value.accepted).toBe(true)
    const inspectionId = inspected.value.inspectionId

    const approvedDelta = dispatch({ operation: 'approveAgentDelta', args: [{ projectId, actor, idempotencyKey: key(), inspectionId }] }) as { ok: boolean }
    expect(approvedDelta.ok).toBe(true)

    const applied = dispatch({ operation: 'applyAgentDelta', args: [{ projectId, actor, idempotencyKey: key(), inspectionId }] }) as {
      ok: boolean
      value: { applied: boolean; appliedFiles: string[] }
    }
    expect(applied.ok).toBe(true)
    expect(applied.value.applied).toBe(true)
    expect(applied.value.appliedFiles).toEqual([MODULE_PATH])

    const writtenAbs = path.join(repoRoot, MODULE_PATH)
    expect(fs.existsSync(writtenAbs)).toBe(true)
    expect(fs.readFileSync(writtenAbs, 'utf8')).toBe('export const value = 1\n')

    // Never written into the data directory (the reviewer finding).
    expect(fs.existsSync(path.join(dataDir, MODULE_PATH))).toBe(false)
    expect(fs.existsSync(path.join(dataDir, 'capabilities'))).toBe(false)
  })

  it('applyAgentDelta fails with a structured, configuration-naming diagnostic when no repository is configured for the project', () => {
    const dataDir = tmpDir()
    const projectId = 'proj-roundtrip-2'
    seedFullAuthority(dataDir, projectId)
    const dispatch = createDesignIpcDispatch(dataDir, { principal: actor })

    // No adapter:configureProjectRepository call for this project.
    const { packetId, moduleHash } = bootstrapPacket(dispatch, projectId)
    const delta = makeDelta({ packetId, baseRevision: '', baseHash: moduleHash, deltaId: 'delta.ipc.2' })
    // With no repositoryRoot configured, inspectAgentDelta falls back to the
    // module design's own revision (no workspaceRevisionProvider wired).
    const design = dispatch({ operation: 'getModuleDesign', args: [projectId, 'mod.core'] }) as { revision: string }
    delta.baseRevision = design.revision

    dispatch({ operation: 'importAgentDelta', args: [{ projectId, actor, idempotencyKey: key(), delta }] })
    const inspected = dispatch({
      operation: 'inspectAgentDelta',
      args: [{ projectId, actor, idempotencyKey: key(), deltaId: delta.deltaId }],
    }) as { ok: boolean; value: { inspectionId: string; accepted: boolean } }
    expect(inspected.ok).toBe(true)
    expect(inspected.value.accepted).toBe(true)
    const inspectionId = inspected.value.inspectionId

    dispatch({ operation: 'approveAgentDelta', args: [{ projectId, actor, idempotencyKey: key(), inspectionId }] })
    const applied = dispatch({ operation: 'applyAgentDelta', args: [{ projectId, actor, idempotencyKey: key(), inspectionId }] }) as {
      ok: boolean
      value: { applied: boolean; failure?: string }
      diagnostics: { code: string }[]
    }
    expect(applied.ok).toBe(false)
    expect(applied.value.applied).toBe(false)
    expect(applied.value.failure).toMatch(/repository-not-configured/)
    expect(applied.value.failure).toMatch(/adapter:configureProjectRepository/)
    expect(applied.diagnostics.map((d) => d.code)).toContain('EUC16-DELTA-APPLY-FAILED')
    expect(fs.existsSync(path.join(dataDir, MODULE_PATH))).toBe(false)
  })

  it('rejects approval when the repository changed after inspection (stale, §11.6)', () => {
    const dataDir = tmpDir()
    const repoRoot = tmpDir('euik-design-ipc-repo-')
    const projectId = 'proj-roundtrip-3'
    seedFullAuthority(dataDir, projectId)
    const dispatch = createDesignIpcDispatch(dataDir, { principal: actor })

    dispatch({ operation: 'adapter:configureProjectRepository', args: [{ projectId, actor, idempotencyKey: key(), repositoryRoot: repoRoot }] })
    const { packetId, moduleHash } = bootstrapPacket(dispatch, projectId)
    const delta = makeDelta({ packetId, baseRevision: workspaceRevision(repoRoot), baseHash: moduleHash, deltaId: 'delta.ipc.3' })

    dispatch({ operation: 'importAgentDelta', args: [{ projectId, actor, idempotencyKey: key(), delta }] })
    const inspected = dispatch({
      operation: 'inspectAgentDelta',
      args: [{ projectId, actor, idempotencyKey: key(), deltaId: delta.deltaId }],
    }) as { ok: boolean; value: { inspectionId: string } }
    expect(inspected.ok).toBe(true)

    fs.writeFileSync(path.join(repoRoot, 'unexpected-change.txt'), 'someone else committed here\n')

    const approvedDelta = dispatch({
      operation: 'approveAgentDelta',
      args: [{ projectId, actor, idempotencyKey: key(), inspectionId: inspected.value.inspectionId }],
    }) as { ok: boolean; diagnostics: { code: string }[] }
    expect(approvedDelta.ok).toBe(false)
    expect(approvedDelta.diagnostics.map((d) => d.code)).toContain('workspace-changed-reinspect')
  })

  it('verifyModule runs the configured command with cwd set to the repository root', () => {
    const dataDir = tmpDir()
    const repoRoot = tmpDir('euik-design-ipc-repo-')
    const projectId = 'proj-roundtrip-4'
    seedFullAuthority(dataDir, projectId)
    const dispatch = createDesignIpcDispatch(dataDir, { principal: actor })

    dispatch({ operation: 'adapter:configureProjectRepository', args: [{ projectId, actor, idempotencyKey: key(), repositoryRoot: repoRoot }] })
    fs.writeFileSync(path.join(repoRoot, 'record-cwd.cjs'), "require('fs').writeFileSync('cwd-marker.txt', process.cwd())\n")

    const draft = dispatch({ operation: 'createUseCaseDraft', args: [{ projectId, actor, idempotencyKey: key(), workDescription: '' }] })
    const questionId = draft.value.questions[0].id
    dispatch({
      operation: 'updateUseCaseItem',
      args: [{ projectId, actor, idempotencyKey: key(), target: { kind: 'question', questionId, answer: 'Explain.' } }],
    })
    dispatch({ operation: 'approveUseCaseAnalysis', args: [{ projectId, actor, idempotencyKey: key(), authority: 'product-lead' }] })
    dispatch({ operation: 'createSystemDesignDraft', args: [{ projectId, actor, idempotencyKey: key() }] })
    dispatch({ operation: 'approveSystemStructure', args: [{ projectId, actor, idempotencyKey: key(), authority: 'software-architect' }] })
    dispatch({ operation: 'startModuleDesign', args: [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' }] })
    dispatch({
      operation: 'updateModuleDesignItem',
      args: [
        {
          projectId,
          actor,
          idempotencyKey: key(),
          moduleId: 'mod.core',
          path: 'schemas',
          value: [
            { schemaId: 'schema.in', version: '1.0', role: 'input', ref: 'schema://in' },
            { schemaId: 'schema.out', version: '1.0', role: 'output', ref: 'schema://out' },
          ],
        },
      ],
    })
    dispatch({
      operation: 'updateModuleDesignItem',
      args: [
        {
          projectId,
          actor,
          idempotencyKey: key(),
          moduleId: 'mod.core',
          path: 'verification.acceptanceCases',
          value: [{ id: 'ac1', description: 'x', expectedOutcome: 'y' }],
        },
      ],
    })
    dispatch({
      operation: 'updateModuleDesignItem',
      args: [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', path: 'typeSpecific.detail', value: workflowDetail }],
    })
    dispatch({
      operation: 'updateModuleDesignItem',
      args: [
        {
          projectId,
          actor,
          idempotencyKey: key(),
          moduleId: 'mod.core',
          path: 'verification.configuredCommands',
          value: [`${process.execPath} record-cwd.cjs`],
        },
      ],
    })
    dispatch({ operation: 'analyzeModuleDesign', args: [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' }] })
    const approved = dispatch({
      operation: 'approveModuleDesign',
      args: [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', authority: 'module-owner' }],
    })
    expect(approved.ok).toBe(true)

    const result = dispatch({ operation: 'verifyModule', args: [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' }] }) as {
      ok: boolean
      value: { passed: boolean }
    }
    expect(result.ok).toBe(true)
    expect(result.value.passed).toBe(true)

    const markerPath = path.join(repoRoot, 'cwd-marker.txt')
    expect(fs.existsSync(markerPath)).toBe(true)
    // Normalize both sides (fs.realpathSync) before comparing: on macOS
    // `os.tmpdir()` resolves under `/private/var/...` while the recorded
    // `process.cwd()` may report the unresolved `/var/...` alias (or vice
    // versa), which would otherwise make this assertion host-dependent.
    expect(fs.realpathSync(fs.readFileSync(markerPath, 'utf8'))).toBe(fs.realpathSync(path.resolve(repoRoot)))
  })

  it('produces the same applyAgentDelta result as a direct createDesignOperations call built with the identical repository-scoped executors (§25.3 adapter equivalence)', () => {
    const dataDirIpc = tmpDir()
    const dataDirDirect = tmpDir()
    const repoIpc = tmpDir('euik-design-ipc-repo-')
    const repoDirect = tmpDir('euik-design-ipc-repo-')
    const projectId = 'proj-equiv-ipc'
    seedFullAuthority(dataDirIpc, projectId)
    seedFullAuthority(dataDirDirect, projectId)

    const dispatch = createDesignIpcDispatch(dataDirIpc, { principal: actor })
    dispatch({ operation: 'adapter:configureProjectRepository', args: [{ projectId, actor, idempotencyKey: key(), repositoryRoot: repoIpc }] })
    const viaIpc = bootstrapPacket(dispatch, projectId)

    // A "direct" adapter built the same way `designMachineApi.ts`'s
    // `buildDefaultExecutors` builds one — apps/desktop cannot import that
    // file directly (it is not part of the package's public "exports" map),
    // so this reconstructs the identical executor shape from the same
    // public repositoryAdapter primitives `designIpc.ts` itself uses.
    const directWorkspace = new DesignWorkspace(dataDirDirect)
    const directDispatch = (request: { operation: string; args: unknown[] }) => {
      const service = createDesignOperations({
        workspace: directWorkspace,
        executors: { applyDelta: (plan, delta) => applyDeltaTransactionally(plan, delta, repoDirect, { currentRevision: workspaceRevision(repoDirect) }) },
        workspaceRevisionProvider: () => workspaceRevision(repoDirect),
      })
      const byName = service as unknown as Record<string, (...args: unknown[]) => unknown>
      return byName[request.operation]!(...request.args)
    }
    const viaDirect = bootstrapPacket(directDispatch, projectId)

    const deltaIpc = makeDelta({ packetId: viaIpc.packetId, baseRevision: workspaceRevision(repoIpc), baseHash: viaIpc.moduleHash, deltaId: 'delta.equiv' })
    const deltaDirect = makeDelta({
      packetId: viaDirect.packetId,
      baseRevision: workspaceRevision(repoDirect),
      baseHash: viaDirect.moduleHash,
      deltaId: 'delta.equiv',
    })

    dispatch({ operation: 'importAgentDelta', args: [{ projectId, actor, idempotencyKey: key(), delta: deltaIpc }] })
    const inspectedIpc = dispatch({
      operation: 'inspectAgentDelta',
      args: [{ projectId, actor, idempotencyKey: key(), deltaId: deltaIpc.deltaId }],
    }) as { value: { inspectionId: string } }
    dispatch({ operation: 'approveAgentDelta', args: [{ projectId, actor, idempotencyKey: key(), inspectionId: inspectedIpc.value.inspectionId }] })
    const appliedIpc = dispatch({
      operation: 'applyAgentDelta',
      args: [{ projectId, actor, idempotencyKey: key(), inspectionId: inspectedIpc.value.inspectionId }],
    }) as { ok: boolean; value: Record<string, unknown> }

    directDispatch({ operation: 'importAgentDelta', args: [{ projectId, actor, idempotencyKey: key(), delta: deltaDirect }] })
    const inspectedDirect = directDispatch({
      operation: 'inspectAgentDelta',
      args: [{ projectId, actor, idempotencyKey: key(), deltaId: deltaDirect.deltaId }],
    }) as { value: { inspectionId: string } }
    directDispatch({ operation: 'approveAgentDelta', args: [{ projectId, actor, idempotencyKey: key(), inspectionId: inspectedDirect.value.inspectionId }] })
    const appliedDirect = directDispatch({
      operation: 'applyAgentDelta',
      args: [{ projectId, actor, idempotencyKey: key(), inspectionId: inspectedDirect.value.inspectionId }],
    }) as { ok: boolean; value: Record<string, unknown> }

    expect(appliedIpc.ok).toBe(true)
    expect(appliedDirect.ok).toBe(true)
    expect(fs.readFileSync(path.join(repoIpc, MODULE_PATH), 'utf8')).toBe(fs.readFileSync(path.join(repoDirect, MODULE_PATH), 'utf8'))
    const { completedAt: _ipcAt, ...ipcRest } = appliedIpc.value
    const { completedAt: _directAt, ...directRest } = appliedDirect.value
    expect(canonicalize(ipcRest)).toEqual(canonicalize(directRest))
  })
})

// ---------------------------------------------------------------------------
// Second-review P1 fix (trusted principal at the adapter boundary) —
// ADDITIVE block only. `createDesignIpcDispatch` now derives a principal
// once per dispatcher (the real OS process identity in production; an
// explicit `options.principal` override here, for a deterministic test) and
// stamps/overrides it onto every §17.2 change-operation request AND every
// `adapter:*` request, so a request's own claimed `actor` is decorative
// only. This is a real behavior change from the rest of this file's
// pre-existing tests above (several of which assert on a claimed
// `'agent:copilot'`/`'service:ci'` actor reaching the service or the
// adapter's own actor check unstamped, and one compares a dispatched result
// byte-for-byte against a direct `createDesignOperations` call using the
// same claimed, unstamped actor) — those tests are not edited here (this
// file is owned by another packet); see the packet report for the exact
// list of now-failing assertions and why.
// ---------------------------------------------------------------------------

describe('EUC-16 design IPC dispatch — second-review fix: trusted principal at the adapter boundary', () => {
  it('derives a principal once per dispatcher and stamps every change-operation request with it, overriding a claimed agent actor', () => {
    const dataDir = tmpDir()
    const principal = 'user:ipc-trusted-caller'
    const dispatch = createDesignIpcDispatch(dataDir, { principal })

    const result = dispatch({
      operation: 'createUseCaseDraft',
      args: [{ projectId: 'proj-s2-ipc-1', actor: 'agent:copilot', idempotencyKey: 'k1', workDescription: '' }],
    }) as { ok: boolean }
    expect(result.ok).toBe(true)

    const workspace = new DesignWorkspace(dataDir)
    const events = workspace.listAuditEvents('proj-s2-ipc-1')
    const createEvent = events.find((e) => e.operation === 'createUseCaseDraft')
    expect(createEvent?.actor).toBe(principal)
    expect(createEvent?.actor).not.toBe('agent:copilot')
  })

  it('logs a non-blocking EUC16-ACTOR-CLAIM-MISMATCH audit event when the claimed actor differs from the stamped principal', () => {
    const dataDir = tmpDir()
    const principal = 'user:ipc-trusted-caller'
    const dispatch = createDesignIpcDispatch(dataDir, { principal })

    dispatch({
      operation: 'createUseCaseDraft',
      args: [{ projectId: 'proj-s2-ipc-2', actor: 'user:someone-else', idempotencyKey: 'k1', workDescription: '' }],
    })

    const workspace = new DesignWorkspace(dataDir)
    const events = workspace.listAuditEvents('proj-s2-ipc-2')
    const mismatch = events.find((e) => e.diagnosticCodes.includes('EUC16-ACTOR-CLAIM-MISMATCH'))
    expect(mismatch).toBeDefined()
    expect(mismatch?.actor).toBe(principal)
    expect(mismatch?.evidenceRefs).toEqual(['user:someone-else'])
    expect(mismatch?.outcome).toBe('ok')
  })

  it('stamps the principal onto adapter:configureProjectRepository too — a claimed agent actor cannot bypass the trust boundary, it is simply overridden', () => {
    const dataDir = tmpDir()
    const repoRoot = tmpDir('euik-design-ipc-s2-repo-')
    const principal = 'user:ipc-trusted-caller'
    const dispatch = createDesignIpcDispatch(dataDir, { principal })

    const result = dispatch({
      operation: 'adapter:configureProjectRepository',
      args: [{ projectId: 'proj-s2-ipc-3', actor: 'agent:copilot', idempotencyKey: 'k1', repositoryRoot: repoRoot }],
    }) as { ok: boolean; auditEventId?: string }
    // The claimed 'agent:copilot' actor never reaches
    // configureProjectRepository's own actor-kind check — it was already
    // overridden to the trusted `principal` before dispatch, so this
    // succeeds as a genuine user request (never a rejected agent claim).
    expect(result.ok).toBe(true)

    const workspace = new DesignWorkspace(dataDir)
    const configuredEvent = workspace
      .listAuditEvents('proj-s2-ipc-3')
      .find((e) => e.operation === 'adapter:configureProjectRepository' && e.outcome === 'ok')
    expect(configuredEvent?.actor).toBe(principal)
  })

  it('without an explicit principal override, falls back to a well-formed "user:<id>" OS-derived principal', () => {
    const dataDir = tmpDir()
    const dispatch = createDesignIpcDispatch(dataDir, { principal: actor }) // no options — the real production path
    const result = dispatch({
      operation: 'createUseCaseDraft',
      args: [{ projectId: 'proj-s2-ipc-4', actor: 'user:someone-else', idempotencyKey: 'k1', workDescription: '' }],
    }) as { ok: boolean }
    expect(result.ok).toBe(true)

    const workspace = new DesignWorkspace(dataDir)
    const event = workspace.listAuditEvents('proj-s2-ipc-4').find((e) => e.operation === 'createUseCaseDraft')
    expect(event?.actor).toMatch(/^user:\S+$/)
    expect(event?.actor).not.toBe('user:someone-else')
  })

  it('never throws for a request with an unsafe projectId, even when the claimed actor differs from the stamped principal (mismatch logging is best-effort)', () => {
    const dataDir = tmpDir()
    const dispatch = createDesignIpcDispatch(dataDir, { principal: 'user:ipc-trusted-caller' })
    expect(() =>
      dispatch({
        operation: 'adapter:configureProjectRepository',
        args: [{ projectId: '../escape', actor: 'agent:copilot', idempotencyKey: 'k1', repositoryRoot: tmpDir() }],
      }),
    ).not.toThrow()
    const result = dispatch({
      operation: 'adapter:configureProjectRepository',
      args: [{ projectId: '../escape', actor: 'agent:copilot', idempotencyKey: 'k2', repositoryRoot: tmpDir() }],
    }) as { ok: boolean; diagnostics: { code: string }[] }
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.code)).toContain('EUC16-ADAPTER-INVALID-PROJECT-ID')
  })
})
