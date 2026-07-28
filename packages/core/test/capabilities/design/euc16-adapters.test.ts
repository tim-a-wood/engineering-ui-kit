/**
 * EUC-16 — CLI and machine API adapters for the use-case-led Capabilities
 * design workflow.
 * Acceptance (SPECIFICATION.md §17 all, §25.3 EUC-13..17):
 *  - IPC, CLI, and machine API return the same structured result for the
 *    same operation (exercised here: CLI vs. machine API; the IPC side is
 *    exercised in `apps/desktop/test/design-ipc.test.ts` against a direct
 *    service call, since IPC dispatch lives in the desktop package);
 *  - every human operation has a machine operation;
 *  - no machine operation bypasses approval.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DesignWorkspace } from '../../../src/capabilities/design/designWorkspace.js'
import { createDesignOperations } from '../../../src/capabilities/design/operations.js'
import { canonicalize } from '../../../src/capabilities/hash.js'
import { runDesignCli, type DesignCliOptions } from '../../../src/designCli.js'
import { createDesignMachineApi, deriveOsPrincipal } from '../../../src/designMachineApi.js'

/** Second-review fix: `createDesignMachineApi` requires (or defaults) a trusted principal — see `designMachineApi.ts` module doc "Trust model". A fixed, explicit value keeps these tests independent of the sandbox's real OS username. */
const principal = 'user:machine-api-tester'

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'euik-euc16-adapters-'))
}

function makeCapture(): { out: string[]; err: string[]; opts: Pick<DesignCliOptions, 'stdout' | 'stderr'> } {
  const out: string[] = []
  const err: string[] = []
  return { out, err, opts: { stdout: (s: string) => out.push(s), stderr: (s: string) => err.push(s) } }
}

/** Every real operation name, exactly as `createDesignOperations` exports it. */
function realOperationNames(): string[] {
  const workspace = new DesignWorkspace(tmpDir())
  return Object.keys(createDesignOperations({ workspace })).sort()
}

describe('EUC-16 CLI adapter', () => {
  it('list-operations prints exactly the service operation names and exits 0', async () => {
    const dataDir = tmpDir()
    const cap = makeCapture()
    const code = await runDesignCli(['list-operations'], { dataDir, ...cap.opts })
    expect(code).toBe(0)
    expect(cap.err).toEqual([])
    const printed = JSON.parse(cap.out.join('')) as string[]
    expect([...printed].sort()).toEqual(realOperationNames())
  })

  it('exits 2 (usage error) with no operation given', async () => {
    const cap = makeCapture()
    const code = await runDesignCli([], { dataDir: tmpDir(), ...cap.opts })
    expect(code).toBe(2)
    expect(cap.out).toEqual([])
    expect(cap.err.join('')).toMatch(/usage:/)
  })

  it('exits 2 (usage error) for an unknown operation', async () => {
    const cap = makeCapture()
    const code = await runDesignCli(['definitelyNotAnOperation'], { dataDir: tmpDir(), ...cap.opts })
    expect(code).toBe(2)
    expect(cap.err.join('')).toMatch(/unknown operation/)
  })

  it('exits 2 (usage error) for malformed --json', async () => {
    const cap = makeCapture()
    const code = await runDesignCli(['getWorkflowStatus', '--json', '{not valid json'], { dataDir: tmpDir(), ...cap.opts })
    expect(code).toBe(2)
    expect(cap.err.join('')).toMatch(/invalid --json/)
  })

  it('exits 2 (usage error) when --json is not a JSON array', async () => {
    const cap = makeCapture()
    const code = await runDesignCli(['getWorkflowStatus', '--json', '{"projectId":"p"}'], { dataDir: tmpDir(), ...cap.opts })
    expect(code).toBe(2)
    expect(cap.err.join('')).toMatch(/JSON array/)
  })

  it('exits 2 (usage error) when --json is given with no value', async () => {
    const cap = makeCapture()
    const code = await runDesignCli(['getWorkflowStatus', '--json'], { dataDir: tmpDir(), ...cap.opts })
    expect(code).toBe(2)
  })

  it('exits 0 for a §17.1 read operation (no ok field, so ok !== false)', async () => {
    const cap = makeCapture()
    const code = await runDesignCli(['getWorkflowStatus', '--json', '["proj-cli-1"]'], { dataDir: tmpDir(), ...cap.opts })
    expect(code).toBe(0)
    const printed = JSON.parse(cap.out.join(''))
    expect(printed.projectId).toBe('proj-cli-1')
  })

  it('exits 0 for a successful §17.2 change operation', async () => {
    const cap = makeCapture()
    const code = await runDesignCli(
      [
        'createUseCaseDraft',
        '--json',
        JSON.stringify([{ projectId: 'proj-cli-2', actor: 'user:tim', idempotencyKey: 'k1', workDescription: '' }]),
      ],
      { dataDir: tmpDir(), ...cap.opts },
    )
    expect(code).toBe(0)
    const printed = JSON.parse(cap.out.join(''))
    expect(printed.ok).toBe(true)
  })

  it('exits 1 when a §17.2 change operation is rejected (ok: false)', async () => {
    const cap = makeCapture()
    // Missing idempotencyKey is a domain rejection (EUC16-IDEMPOTENCY-KEY-REQUIRED), not a usage error.
    const code = await runDesignCli(
      ['createUseCaseDraft', '--json', JSON.stringify([{ projectId: 'proj-cli-3', actor: 'user:tim', workDescription: '' }])],
      { dataDir: tmpDir(), ...cap.opts },
    )
    expect(code).toBe(1)
    const printed = JSON.parse(cap.out.join(''))
    expect(printed.ok).toBe(false)
    expect(printed.diagnostics.map((d: { code: string }) => d.code)).toContain('EUC16-IDEMPOTENCY-KEY-REQUIRED')
  })

  it('respects --data-dir over the default dataDir', async () => {
    const overrideDir = tmpDir()
    const cap = makeCapture()
    const code = await runDesignCli(
      ['getWorkflowStatus', '--json', '["proj-override"]', '--data-dir', overrideDir],
      { dataDir: tmpDir(), ...cap.opts },
    )
    expect(code).toBe(0)
    expect(fs.existsSync(path.join(overrideDir, 'projects', 'proj-override', 'design', 'meta', 'schema-version.json'))).toBe(true)
  })

  it('never throws for a hostile agent-actor approval attempt (usage-shaped, not a crash); the claimed actor is stamped over before it reaches the service', async () => {
    const cap = makeCapture()
    const code = await runDesignCli(
      [
        'approveModuleDesign',
        '--json',
        JSON.stringify([{ projectId: 'proj-cli-4', actor: 'agent:copilot', idempotencyKey: 'k1', moduleId: 'mod-x', authority: 'module-owner' }]),
      ],
      { dataDir: tmpDir(), principal, ...cap.opts },
    )
    expect(code).toBe(1)
    const printed = JSON.parse(cap.out.join(''))
    expect(printed.ok).toBe(false)
    // Second-review fix (trusted principal at the adapter boundary): the
    // `--json` body's claimed `agent:copilot` actor never reaches the
    // service — `runDesignCli` stamps every change-operation request with
    // `opts.principal` first, so this is rejected for having no configured
    // authority, not for looking like an agent.
    expect(printed.diagnostics.map((d: { code: string }) => d.code)).toContain('EUC16-AUTHORITY-NOT-CONFIGURED')
    expect(printed.diagnostics.map((d: { code: string }) => d.code)).not.toContain('EUC16-AGENT-APPROVAL-FORBIDDEN')
  })

  it('rejects a malformed explicit `principal` with a usage error, never a throw', async () => {
    const cap = makeCapture()
    const code = await runDesignCli(['getWorkflowStatus', '--json', '["proj-cli-bad-principal"]'], {
      dataDir: tmpDir(),
      principal: 'agent:copilot',
      ...cap.opts,
    })
    expect(code).toBe(2)
    expect(cap.err.join('')).toMatch(/principal/)
  })
})

describe('EUC-16 machine API adapter', () => {
  it('exposes exactly the service operations, each callable and awaitable', async () => {
    const api = createDesignMachineApi({ dataDir: tmpDir(), principal })
    expect(Object.keys(api).sort()).toEqual(realOperationNames())
    const status = await api.getWorkflowStatus('proj-machine-1')
    expect(status.projectId).toBe('proj-machine-1')
  })

  // Second-review fix (trusted principal at the adapter boundary): a
  // caller-claimed `actor` can no longer reach the service unstamped, so
  // this is no longer "the same diagnostics as a direct service call" (a
  // direct call is a different trust boundary — see the last assertion
  // here, and euc16-operations.test.ts for its own full coverage). The
  // machine API's own contract is that the *constructed* principal, never
  // the request's claim, decides the outcome.
  it('stamps every change-operation actor with the constructed principal — a caller-claimed agent actor never reaches the service unstamped', async () => {
    const dataDir = tmpDir()
    const viaApi = await createDesignMachineApi({ dataDir, principal }).approveModuleDesign({
      projectId: 'proj-machine-2',
      actor: 'agent:copilot', // a hostile/buggy caller claim
      idempotencyKey: 'k1',
      moduleId: 'mod-x',
      authority: 'module-owner',
    })

    // Rejected — but because no role is configured for the *real*, stamped
    // principal, never because the claimed actor looked like an agent: the
    // claim never reached the authorization check as `'agent:copilot'`.
    expect(viaApi.ok).toBe(false)
    expect(viaApi.diagnostics.map((d) => d.code)).toContain('EUC16-AUTHORITY-NOT-CONFIGURED')
    expect(viaApi.diagnostics.map((d) => d.code)).not.toContain('EUC16-AGENT-APPROVAL-FORBIDDEN')

    // The audit trail records the real stamped principal as the actor —
    // never the claimed 'agent:copilot' — and a distinct, non-blocking
    // mismatch event names the forged claim as evidence.
    const workspace = new DesignWorkspace(dataDir)
    const events = workspace.listAuditEvents('proj-machine-2')
    const approveEvent = events.find((e) => e.operation === 'approveModuleDesign')
    expect(approveEvent?.actor).toBe(principal)
    const mismatchEvent = events.find((e) => e.diagnosticCodes.includes('EUC16-ACTOR-CLAIM-MISMATCH'))
    expect(mismatchEvent?.actor).toBe(principal)
    expect(mismatchEvent?.evidenceRefs).toEqual(['agent:copilot'])

    // A direct, unstamped service call — the trusted low-level API other
    // packets' own code calls, never a remote/renderer caller — still
    // rejects an agent actor outright; the machine API's stamping is
    // additive, never a replacement for that check.
    const service = createDesignOperations({ workspace })
    const direct = service.approveModuleDesign({
      projectId: 'proj-machine-2',
      actor: 'agent:copilot',
      idempotencyKey: 'k2',
      moduleId: 'mod-x',
      authority: 'module-owner',
    })
    expect(direct.ok).toBe(false)
    expect(direct.diagnostics.map((d) => d.code)).toContain('EUC16-AGENT-APPROVAL-FORBIDDEN')
  })

  it('omitting `principal` is opt-out: the pre-fix behavior is unchanged, the request\'s own actor is trusted', async () => {
    // `principal` stamping is opt-in (see designMachineApi.ts module doc) so
    // that an existing embedder/test that has not yet been updated to pass
    // one keeps working exactly as before this packet — a deliberate,
    // documented trust-model gap; see the packet report.
    const dataDir = tmpDir()
    const api = createDesignMachineApi({ dataDir })
    const result = await api.createUseCaseDraft({
      projectId: 'proj-machine-3',
      actor: 'user:someone-else',
      idempotencyKey: 'k1',
      workDescription: '',
    })
    expect(result.ok).toBe(true)
    const workspace = new DesignWorkspace(dataDir)
    const event = workspace.listAuditEvents('proj-machine-3').find((e) => e.operation === 'createUseCaseDraft')
    expect(event?.actor).toBe('user:someone-else')
    // `deriveOsPrincipal` remains available for a caller that wants to opt
    // in explicitly (e.g. a real CLI binary wrapper).
    expect(typeof deriveOsPrincipal()).toBe('string')
  })

  it('rejects a malformed explicit `principal` at construction (fail fast, never a silent fallback)', () => {
    expect(() => createDesignMachineApi({ dataDir: tmpDir(), principal: 'agent:copilot' })).toThrow(/principal/)
    expect(() => createDesignMachineApi({ dataDir: tmpDir(), principal: 'not-a-principal' })).toThrow(/principal/)
  })
})

describe('review-fixes-r4 extension — repositoryRoot option (reviewer P1: data-dir/repository conflation)', () => {
  it('createDesignMachineApi still exposes exactly the service operations when repositoryRoot is set (no drift)', async () => {
    const api = createDesignMachineApi({ dataDir: tmpDir(), repositoryRoot: tmpDir(), principal })
    expect(Object.keys(api).sort()).toEqual(realOperationNames())
  })

  it('applyAgentDelta via the machine API fails with a structured, configuration-naming diagnostic when repositoryRoot is not set (never silently applies into dataDir)', async () => {
    const dataDir = tmpDir()
    const api = createDesignMachineApi({ dataDir, principal })
    const result = await api.applyAgentDelta({ projectId: 'proj-no-repo', actor: 'user:tim', idempotencyKey: 'k1', inspectionId: 'inspection-does-not-exist' })
    // No such inspection exists, so this is EUC16-NOT-FOUND — the point of
    // this test is only that the call never throws and never touches
    // dataDir; the full "repository-not-configured" round trip is exercised
    // in review-fixes-r4.test.ts.
    expect(result.ok).toBe(false)
    expect(fs.existsSync(path.join(dataDir, 'capabilities'))).toBe(false)
  })

  it('runDesignCli accepts the same repositoryRoot option shape (single path and a per-project map) without a usage error', async () => {
    const cap1 = makeCapture()
    const code1 = await runDesignCli(['getWorkflowStatus', '--json', '["proj-cli-repo-1"]'], { dataDir: tmpDir(), repositoryRoot: tmpDir(), ...cap1.opts })
    expect(code1).toBe(0)

    const cap2 = makeCapture()
    const code2 = await runDesignCli(['getWorkflowStatus', '--json', '["proj-cli-repo-2"]'], {
      dataDir: tmpDir(),
      repositoryRoot: { 'proj-cli-repo-2': tmpDir() },
      ...cap2.opts,
    })
    expect(code2).toBe(0)
  })
})

describe('EUC-16 CLI vs. machine API equivalence (§25.3)', () => {
  it('returns the same §17.1 read result for the same operation and args on identical fresh workspaces', async () => {
    const cap = makeCapture()
    const cliCode = await runDesignCli(['getWorkflowStatus', '--json', '["proj-equiv-1"]'], { dataDir: tmpDir(), principal, ...cap.opts })
    expect(cliCode).toBe(0)
    const viaCli = JSON.parse(cap.out.join(''))

    const api = createDesignMachineApi({ dataDir: tmpDir(), principal })
    const viaApi = await api.getWorkflowStatus('proj-equiv-1')

    expect(canonicalize(viaCli)).toEqual(canonicalize(viaApi))
  })

  it('returns the same §17.2 change result (minus the random auditEventId) for the same operation and args on identical fresh workspaces', async () => {
    // Both adapters stamp `actor` with the same constructed `principal`
    // (see module doc "Trust model"), so a claimed actor here is decorative
    // — it never reaches either adapter's underlying service call.
    const args = [{ projectId: 'proj-equiv-2', actor: 'user:tim', idempotencyKey: 'k-equiv', workDescription: '' }]

    const cap = makeCapture()
    const cliCode = await runDesignCli(['createUseCaseDraft', '--json', JSON.stringify(args)], { dataDir: tmpDir(), principal, ...cap.opts })
    expect(cliCode).toBe(0)
    const viaCli = JSON.parse(cap.out.join(''))

    const api = createDesignMachineApi({ dataDir: tmpDir(), principal })
    const viaApi = await api.createUseCaseDraft(args[0] as Parameters<typeof api.createUseCaseDraft>[0])

    expect(typeof viaCli.auditEventId).toBe('string')
    expect(viaCli.auditEventId.length).toBeGreaterThan(0)
    expect(typeof viaApi.auditEventId).toBe('string')
    expect(viaApi.auditEventId.length).toBeGreaterThan(0)

    const { auditEventId: _cliAuditId, ...cliRest } = viaCli
    const { auditEventId: _apiAuditId, ...apiRest } = viaApi as Record<string, unknown>
    expect(canonicalize(cliRest)).toEqual(canonicalize(apiRest))
  })
})
