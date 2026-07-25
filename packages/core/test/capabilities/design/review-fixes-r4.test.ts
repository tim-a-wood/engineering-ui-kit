/**
 * Review-fixes R4 — desktop design adapter reviewer P1 findings
 * (`apps/desktop/src/capabilities/designIpc.ts` ~line 54, mirrored in
 * `packages/core/src/designMachineApi.ts` / `designCli.ts`).
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §11.6, §12,
 * §17.3, §25.3.
 *
 * The finding: the desktop adapter left module verification, Connect, and
 * scenario execution unconfigured, and its only executor applied deltas
 * against the application *data directory* rather than the project
 * *repository*; inspection recorded a module design revision like `'r1'`
 * while apply recomputed a filesystem hash, so the default apply always
 * failed as stale before writing anything.
 *
 * This file proves the machine-API/CLI half of the fix (the desktop IPC half
 * is proven in `apps/desktop/test/design-ipc.test.ts`, since IPC dispatch
 * lives in the desktop package):
 *  - a full real-repository round trip (`importAgentDelta` ->
 *    `inspectAgentDelta` -> `approveAgentDelta` -> `applyAgentDelta`)
 *    against a real temp repository succeeds and writes files there — never
 *    into the workspace data directory;
 *  - with no `repositoryRoot` configured, `applyAgentDelta` fails with a
 *    structured diagnostic that names how to configure one;
 *  - a repository modified after inspection (before approve, and again
 *    before apply) is rejected as stale;
 *  - `verifyModule` runs the design's configured command with `cwd` set to
 *    the repository root;
 *  - `createDesignMachineApi`/`runDesignCli`, both given the same
 *    `repositoryRoot`, produce the same round-trip result (§25.3 adapter
 *    equivalence).
 *
 * Discovered nuance (recorded as a remaining risk in the packet report):
 * `operations.ts`'s `inspectAgentDelta` (frozen — not editable in this
 * packet) feeds the *same* `workspaceRevisionProvider()` value into both
 * `DeltaInspector.validateReturnedDelta`'s `workspaceRevision` (the §11.5
 * "stale-base" check, comparing against `delta.baseRevision`) and
 * `workspaceRevisionAtInspection` (the later §11.6/§12.2 apply-time
 * staleness check) — the two are the same field in `deltaInspector.ts`.
 * Once a repository is configured, a real returned delta's `baseRevision`
 * must therefore equal the real repository's content-derived revision
 * (`workspaceRevision(repositoryRoot)`), not the module design's own
 * revision string — this test file's `makeDelta` reflects that.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DesignWorkspace } from '../../../src/capabilities/design/designWorkspace.js'
import { workspaceRevision } from '../../../src/capabilities/design/repositoryAdapter.js'
import { canonicalize } from '../../../src/capabilities/hash.js'
import { APPROVAL_AUTHORITIES, type ApprovalAuthority, type ReturnedDelta } from '../../../src/capabilities/design/records.js'
import { createDesignMachineApi, type DesignMachineApi } from '../../../src/designMachineApi.js'
import { runDesignCli, type DesignCliOptions } from '../../../src/designCli.js'

function tmpDir(prefix = 'euik-r4-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

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
  return `r4-idem-${idem}`
}

const MODULE_PATH = 'capabilities/modules/mod.core/index.ts'

/**
 * Drives one project from a blank workspace through to an approved,
 * single-module ("mod.core") implementation packet, using `call` (an
 * operation-name + args-array invoker — the same shape every adapter uses).
 * Returns the packet id and the approved module design's revision/hash (the
 * delta's required `baseRevision`/`baseHash`).
 */
async function bootstrapPacket(
  call: (operation: string, args: unknown[]) => Promise<any>,
  projectId: string,
): Promise<{ packetId: string; moduleRevision: string; moduleHash: string }> {
  const draft = await call('createUseCaseDraft', [{ projectId, actor, idempotencyKey: key(), workDescription: '' }])
  expect(draft.ok).toBe(true)
  const questionId = draft.value.questions[0].id
  const answered = await call('updateUseCaseItem', [
    { projectId, actor, idempotencyKey: key(), target: { kind: 'question', questionId, answer: 'Explain the module workflow.' } },
  ])
  expect(answered.ok).toBe(true)
  await call('approveUseCaseAnalysis', [{ projectId, actor, idempotencyKey: key(), authority: 'product-lead' }])
  await call('createSystemDesignDraft', [{ projectId, actor, idempotencyKey: key() }])
  await call('approveSystemStructure', [{ projectId, actor, idempotencyKey: key(), authority: 'software-architect' }])
  await call('startModuleDesign', [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' }])
  await call('updateModuleDesignItem', [
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
  ])
  await call('updateModuleDesignItem', [
    {
      projectId,
      actor,
      idempotencyKey: key(),
      moduleId: 'mod.core',
      path: 'verification.acceptanceCases',
      value: [{ id: 'ac1', description: 'does the work', expectedOutcome: 'the work is done' }],
    },
  ])
  await call('updateModuleDesignItem', [
    { projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', path: 'typeSpecific.detail', value: workflowDetail },
  ])
  await call('analyzeModuleDesign', [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' }])
  const approved = await call('approveModuleDesign', [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', authority: 'module-owner' }])
  expect(approved.ok).toBe(true)
  await call('createDesignBaseline', [{ projectId, actor, idempotencyKey: key() }])
  await call('approveDesignBaseline', [{ projectId, actor, idempotencyKey: key(), authority: 'software-architect' }])
  const packet = await call('createModuleImplementationPacket', [
    { projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', implementationSteps: ['implement it'], testCommands: ['true'] },
  ])
  expect(packet.ok).toBe(true)
  return { packetId: packet.value.packetId, moduleRevision: approved.value.revision, moduleHash: approved.value.contentHash }
}

function makeDelta(input: { packetId: string; baseRevision: string; baseHash: string; deltaId: string; path?: string; content?: string }): ReturnedDelta {
  return {
    schemaVersion: '1.0',
    deltaId: input.deltaId,
    packetId: input.packetId,
    baseRevision: input.baseRevision,
    baseHash: input.baseHash,
    fileChanges: [{ path: input.path ?? MODULE_PATH, action: 'create', content: input.content ?? 'export const value = 1\n', contentHash: 'file-hash-1' }],
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

function machineApiCaller(api: DesignMachineApi): (operation: string, args: unknown[]) => Promise<any> {
  const byName = api as unknown as Record<string, (...args: unknown[]) => Promise<any>>
  return (operation, args) => byName[operation]!(...args)
}

function cliCaller(dataDir: string, repositoryRoot: string | undefined): (operation: string, args: unknown[]) => Promise<any> {
  return async (operation, args) => {
    const out: string[] = []
    const err: string[] = []
    const opts: DesignCliOptions = { dataDir, stdout: (s) => out.push(s), stderr: (s) => err.push(s), ...(repositoryRoot ? { repositoryRoot } : {}) }
    const code = await runDesignCli([operation, '--json', JSON.stringify(args)], opts)
    if (out.length === 0) throw new Error(`no stdout from CLI for ${operation} (exit ${code}): ${err.join('')}`)
    return JSON.parse(out.join(''))
  }
}

describe('review-fixes-r4 — machine API real-repository round trip', () => {
  it('applies a delta into the configured repository root, never the data directory', async () => {
    const dataDir = tmpDir()
    const repoRoot = tmpDir('euik-r4-repo-')
    const projectId = 'r4-proj-1'
    seedFullAuthority(dataDir, projectId)

    const api = createDesignMachineApi({ dataDir, repositoryRoot: repoRoot })
    const call = machineApiCaller(api)

    const { packetId, moduleHash } = await bootstrapPacket(call, projectId)

    const delta = makeDelta({ packetId, baseRevision: workspaceRevision(repoRoot), baseHash: moduleHash, deltaId: 'delta.r4.1' })
    const imported = await call('importAgentDelta', [{ projectId, actor, idempotencyKey: key(), delta }])
    expect(imported.ok).toBe(true)

    const inspected = await call('inspectAgentDelta', [{ projectId, actor, idempotencyKey: key(), deltaId: delta.deltaId }])
    expect(inspected.ok).toBe(true)
    expect(inspected.value.accepted).toBe(true)
    const inspectionId = inspected.value.inspectionId

    const approvedDelta = await call('approveAgentDelta', [{ projectId, actor, idempotencyKey: key(), inspectionId }])
    expect(approvedDelta.ok).toBe(true)

    const applied = await call('applyAgentDelta', [{ projectId, actor, idempotencyKey: key(), inspectionId }])
    expect(applied.ok).toBe(true)
    expect(applied.value.applied).toBe(true)
    expect(applied.value.appliedFiles).toEqual([MODULE_PATH])

    // Written into the real repository...
    const writtenAbs = path.join(repoRoot, MODULE_PATH)
    expect(fs.existsSync(writtenAbs)).toBe(true)
    expect(fs.readFileSync(writtenAbs, 'utf8')).toBe('export const value = 1\n')

    // ...never into the workspace data directory (the reviewer finding).
    expect(fs.existsSync(path.join(dataDir, MODULE_PATH))).toBe(false)
    expect(fs.existsSync(path.join(dataDir, 'capabilities'))).toBe(false)
  })

  it('fails honestly (never touching the data directory) when no repositoryRoot is configured', async () => {
    const dataDir = tmpDir()
    const projectId = 'r4-proj-2'
    seedFullAuthority(dataDir, projectId)

    const api = createDesignMachineApi({ dataDir }) // no repositoryRoot
    const call = machineApiCaller(api)

    const { packetId, moduleRevision, moduleHash } = await bootstrapPacket(call, projectId)
    // No repositoryRoot configured -> workspaceRevisionProvider is never
    // wired, so the fallback (module design revision) is what stale-base
    // compares against.
    const delta = makeDelta({ packetId, baseRevision: moduleRevision, baseHash: moduleHash, deltaId: 'delta.r4.2' })

    await call('importAgentDelta', [{ projectId, actor, idempotencyKey: key(), delta }])
    const inspected = await call('inspectAgentDelta', [{ projectId, actor, idempotencyKey: key(), deltaId: delta.deltaId }])
    expect(inspected.ok).toBe(true)
    const inspectionId = inspected.value.inspectionId
    await call('approveAgentDelta', [{ projectId, actor, idempotencyKey: key(), inspectionId }])

    const applied = await call('applyAgentDelta', [{ projectId, actor, idempotencyKey: key(), inspectionId }])
    expect(applied.ok).toBe(false)
    expect(applied.value.applied).toBe(false)
    expect(applied.value.failure).toMatch(/repository-not-configured/)
    expect(applied.value.failure).toMatch(/repositoryRoot/)
    expect(applied.diagnostics.map((d: { code: string }) => d.code)).toContain('EUC16-DELTA-APPLY-FAILED')

    expect(fs.existsSync(path.join(dataDir, MODULE_PATH))).toBe(false)
  })

  it('rejects approval when the repository changed after inspection (stale, §11.6)', async () => {
    const dataDir = tmpDir()
    const repoRoot = tmpDir('euik-r4-repo-')
    const projectId = 'r4-proj-3'
    seedFullAuthority(dataDir, projectId)

    const api = createDesignMachineApi({ dataDir, repositoryRoot: repoRoot })
    const call = machineApiCaller(api)

    const { packetId, moduleHash } = await bootstrapPacket(call, projectId)
    const delta = makeDelta({ packetId, baseRevision: workspaceRevision(repoRoot), baseHash: moduleHash, deltaId: 'delta.r4.3' })
    await call('importAgentDelta', [{ projectId, actor, idempotencyKey: key(), delta }])
    const inspected = await call('inspectAgentDelta', [{ projectId, actor, idempotencyKey: key(), deltaId: delta.deltaId }])
    expect(inspected.ok).toBe(true)
    const inspectionId = inspected.value.inspectionId

    // Modify the repository after inspection, before approval.
    fs.writeFileSync(path.join(repoRoot, 'unexpected-change.txt'), 'someone else committed here\n')

    const approvedDelta = await call('approveAgentDelta', [{ projectId, actor, idempotencyKey: key(), inspectionId }])
    expect(approvedDelta.ok).toBe(false)
    expect(approvedDelta.diagnostics.map((d: { code: string }) => d.code)).toContain('workspace-changed-reinspect')
  })

  it('rejects apply when the repository changed after approval, before apply (stale, §12.2)', async () => {
    const dataDir = tmpDir()
    const repoRoot = tmpDir('euik-r4-repo-')
    const projectId = 'r4-proj-4'
    seedFullAuthority(dataDir, projectId)

    const api = createDesignMachineApi({ dataDir, repositoryRoot: repoRoot })
    const call = machineApiCaller(api)

    const { packetId, moduleHash } = await bootstrapPacket(call, projectId)
    const delta = makeDelta({ packetId, baseRevision: workspaceRevision(repoRoot), baseHash: moduleHash, deltaId: 'delta.r4.4' })
    await call('importAgentDelta', [{ projectId, actor, idempotencyKey: key(), delta }])
    const inspected = await call('inspectAgentDelta', [{ projectId, actor, idempotencyKey: key(), deltaId: delta.deltaId }])
    const inspectionId = inspected.value.inspectionId
    const approvedDelta = await call('approveAgentDelta', [{ projectId, actor, idempotencyKey: key(), inspectionId }])
    expect(approvedDelta.ok).toBe(true)

    // Modify the repository after approval, before apply.
    fs.writeFileSync(path.join(repoRoot, 'unexpected-change-2.txt'), 'a concurrent write\n')

    const applied = await call('applyAgentDelta', [{ projectId, actor, idempotencyKey: key(), inspectionId }])
    expect(applied.ok).toBe(false)
    expect(applied.value.applied).toBe(false)
    expect(applied.value.failure).toMatch(/stale workspace revision/)
  })

  it('verifyModule runs the configured command with cwd set to the repository root', async () => {
    const dataDir = tmpDir()
    const repoRoot = tmpDir('euik-r4-repo-')
    const projectId = 'r4-proj-5'
    seedFullAuthority(dataDir, projectId)

    // A tiny script that records the process's cwd; configuredCommands is
    // split on whitespace (`operations.ts`'s executor contract), so the
    // command and script path must each be a single token.
    fs.writeFileSync(path.join(repoRoot, 'record-cwd.cjs'), "require('fs').writeFileSync('cwd-marker.txt', process.cwd())\n")

    const api = createDesignMachineApi({ dataDir, repositoryRoot: repoRoot })
    const call = machineApiCaller(api)

    const draft = await call('createUseCaseDraft', [{ projectId, actor, idempotencyKey: key(), workDescription: '' }])
    const questionId = draft.value.questions[0].id
    await call('updateUseCaseItem', [{ projectId, actor, idempotencyKey: key(), target: { kind: 'question', questionId, answer: 'Explain the module workflow.' } }])
    await call('approveUseCaseAnalysis', [{ projectId, actor, idempotencyKey: key(), authority: 'product-lead' }])
    await call('createSystemDesignDraft', [{ projectId, actor, idempotencyKey: key() }])
    await call('approveSystemStructure', [{ projectId, actor, idempotencyKey: key(), authority: 'software-architect' }])
    await call('startModuleDesign', [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' }])
    await call('updateModuleDesignItem', [
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
    ])
    await call('updateModuleDesignItem', [
      { projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', path: 'verification.acceptanceCases', value: [{ id: 'ac1', description: 'x', expectedOutcome: 'y' }] },
    ])
    await call('updateModuleDesignItem', [
      { projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', path: 'typeSpecific.detail', value: workflowDetail },
    ])
    await call('updateModuleDesignItem', [
      { projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', path: 'verification.configuredCommands', value: [`${process.execPath} record-cwd.cjs`] },
    ])
    await call('analyzeModuleDesign', [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' }])
    const approved = await call('approveModuleDesign', [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', authority: 'module-owner' }])
    expect(approved.ok).toBe(true)

    const result = await call('verifyModule', [{ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' }])
    expect(result.ok).toBe(true)
    expect(result.value.passed).toBe(true)

    const markerPath = path.join(repoRoot, 'cwd-marker.txt')
    expect(fs.existsSync(markerPath)).toBe(true)
    expect(fs.readFileSync(markerPath, 'utf8')).toBe(path.resolve(repoRoot))
  })

  it('supports a per-project repositoryRoot map', async () => {
    const dataDir = tmpDir()
    const repoA = tmpDir('euik-r4-repo-a-')
    const repoB = tmpDir('euik-r4-repo-b-')
    const projectA = 'r4-proj-map-a'
    const projectB = 'r4-proj-map-b'
    seedFullAuthority(dataDir, projectA)
    seedFullAuthority(dataDir, projectB)

    const api = createDesignMachineApi({ dataDir, repositoryRoot: { [projectA]: repoA, [projectB]: repoB } })
    const call = machineApiCaller(api)

    const a = await bootstrapPacket(call, projectA)
    const b = await bootstrapPacket(call, projectB)

    const deltaA = makeDelta({ packetId: a.packetId, baseRevision: workspaceRevision(repoA), baseHash: a.moduleHash, deltaId: 'delta.map.a' })
    await call('importAgentDelta', [{ projectId: projectA, actor, idempotencyKey: key(), delta: deltaA }])
    const inspectedA = await call('inspectAgentDelta', [{ projectId: projectA, actor, idempotencyKey: key(), deltaId: deltaA.deltaId }])
    await call('approveAgentDelta', [{ projectId: projectA, actor, idempotencyKey: key(), inspectionId: inspectedA.value.inspectionId }])
    const appliedA = await call('applyAgentDelta', [{ projectId: projectA, actor, idempotencyKey: key(), inspectionId: inspectedA.value.inspectionId }])
    expect(appliedA.ok).toBe(true)

    const deltaB = makeDelta({ packetId: b.packetId, baseRevision: workspaceRevision(repoB), baseHash: b.moduleHash, deltaId: 'delta.map.b' })
    await call('importAgentDelta', [{ projectId: projectB, actor, idempotencyKey: key(), delta: deltaB }])
    const inspectedB = await call('inspectAgentDelta', [{ projectId: projectB, actor, idempotencyKey: key(), deltaId: deltaB.deltaId }])
    await call('approveAgentDelta', [{ projectId: projectB, actor, idempotencyKey: key(), inspectionId: inspectedB.value.inspectionId }])
    const appliedB = await call('applyAgentDelta', [{ projectId: projectB, actor, idempotencyKey: key(), inspectionId: inspectedB.value.inspectionId }])
    expect(appliedB.ok).toBe(true)

    // Each project's delta landed only in its own repository.
    expect(fs.existsSync(path.join(repoA, MODULE_PATH))).toBe(true)
    expect(fs.existsSync(path.join(repoB, MODULE_PATH))).toBe(true)
  })
})

describe('review-fixes-r4 — CLI/machine API adapter equivalence (§25.3) with repositoryRoot', () => {
  it('runDesignCli and createDesignMachineApi apply the same delta into the same repository with the same result', async () => {
    const dataDirApi = tmpDir()
    const dataDirCli = tmpDir()
    const repoApi = tmpDir('euik-r4-repo-api-')
    const repoCli = tmpDir('euik-r4-repo-cli-')
    const projectId = 'r4-equiv'
    seedFullAuthority(dataDirApi, projectId)
    seedFullAuthority(dataDirCli, projectId)

    const api = createDesignMachineApi({ dataDir: dataDirApi, repositoryRoot: repoApi })
    const viaApi = machineApiCaller(api)
    const viaCli = cliCaller(dataDirCli, repoCli)

    const apiPacket = await bootstrapPacket(viaApi, projectId)
    const cliPacket = await bootstrapPacket(viaCli, projectId)

    const deltaApi = makeDelta({ packetId: apiPacket.packetId, baseRevision: workspaceRevision(repoApi), baseHash: apiPacket.moduleHash, deltaId: 'delta.equiv' })
    const deltaCli = makeDelta({ packetId: cliPacket.packetId, baseRevision: workspaceRevision(repoCli), baseHash: cliPacket.moduleHash, deltaId: 'delta.equiv' })

    await viaApi('importAgentDelta', [{ projectId, actor, idempotencyKey: key(), delta: deltaApi }])
    const inspectedApi = await viaApi('inspectAgentDelta', [{ projectId, actor, idempotencyKey: key(), deltaId: deltaApi.deltaId }])
    await viaApi('approveAgentDelta', [{ projectId, actor, idempotencyKey: key(), inspectionId: inspectedApi.value.inspectionId }])
    const appliedApi = await viaApi('applyAgentDelta', [{ projectId, actor, idempotencyKey: key(), inspectionId: inspectedApi.value.inspectionId }])

    await viaCli('importAgentDelta', [{ projectId, actor, idempotencyKey: key(), delta: deltaCli }])
    const inspectedCli = await viaCli('inspectAgentDelta', [{ projectId, actor, idempotencyKey: key(), deltaId: deltaCli.deltaId }])
    await viaCli('approveAgentDelta', [{ projectId, actor, idempotencyKey: key(), inspectionId: inspectedCli.value.inspectionId }])
    const appliedCli = await viaCli('applyAgentDelta', [{ projectId, actor, idempotencyKey: key(), inspectionId: inspectedCli.value.inspectionId }])

    expect(appliedApi.ok).toBe(true)
    expect(appliedCli.ok).toBe(true)
    // Both wrote the same relative file with the same content into their
    // own (independent) repository roots.
    expect(fs.readFileSync(path.join(repoApi, MODULE_PATH), 'utf8')).toBe(fs.readFileSync(path.join(repoCli, MODULE_PATH), 'utf8'))
    // Non-deterministic fields aside (completedAt timestamps), the shape of
    // the two adapters' results is identical.
    const { completedAt: _apiAt, ...apiRest } = appliedApi.value
    const { completedAt: _cliAt, ...cliRest } = appliedCli.value
    expect(canonicalize(apiRest)).toEqual(canonicalize(cliRest))
  })
})
