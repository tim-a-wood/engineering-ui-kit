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

    const dispatch = createDesignIpcDispatch(tmpDir())
    const viaDispatch = dispatch({ operation: 'approveModuleDesign', args }) as { ok: boolean; diagnostics: { code: string }[] }

    const direct = directService(tmpDir()).approveModuleDesign(
      { ...args[0], idempotencyKey: 'k2' } as Parameters<DesignOperationsService['approveModuleDesign']>[0],
    )

    expect(viaDispatch.ok).toBe(false)
    expect(direct.ok).toBe(false)
    expect(viaDispatch.diagnostics.map((d) => d.code)).toEqual(direct.diagnostics.map((d) => d.code))
    expect(viaDispatch.diagnostics.map((d) => d.code)).toContain('EUC16-AGENT-APPROVAL-FORBIDDEN')
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
      expect(result.diagnostics.map((d) => d.code)).toContain('EUC16-AGENT-APPROVAL-FORBIDDEN')
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
    }) as { ok: boolean; diagnostics: { code: string }[] }
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.code)).toContain('EUC16-ADAPTER-AGENT-FORBIDDEN')

    const fetched = dispatch({ operation: 'adapter:getProjectRepository', args: [{ projectId: 'proj-repo-2' }] }) as { ok: boolean }
    expect(fetched.ok).toBe(false)
  })

  it('a service actor cannot configure the project repository either', () => {
    const dispatch = createDesignIpcDispatch(tmpDir())
    const result = dispatch({
      operation: 'adapter:configureProjectRepository',
      args: [{ projectId: 'proj-repo-3', actor: 'service:ci', idempotencyKey: key(), repositoryRoot: tmpDir() }],
    }) as { ok: boolean; diagnostics: { code: string }[] }
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.code)).toContain('EUC16-ADAPTER-AGENT-FORBIDDEN')
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
    const dispatch = createDesignIpcDispatch(dataDir)

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
    const dispatch = createDesignIpcDispatch(dataDir)

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
    const dispatch = createDesignIpcDispatch(dataDir)

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
    const dispatch = createDesignIpcDispatch(dataDir)

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
    expect(fs.readFileSync(markerPath, 'utf8')).toBe(path.resolve(repoRoot))
  })

  it('produces the same applyAgentDelta result as a direct createDesignOperations call built with the identical repository-scoped executors (§25.3 adapter equivalence)', () => {
    const dataDirIpc = tmpDir()
    const dataDirDirect = tmpDir()
    const repoIpc = tmpDir('euik-design-ipc-repo-')
    const repoDirect = tmpDir('euik-design-ipc-repo-')
    const projectId = 'proj-equiv-ipc'
    seedFullAuthority(dataDirIpc, projectId)
    seedFullAuthority(dataDirDirect, projectId)

    const dispatch = createDesignIpcDispatch(dataDirIpc)
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
