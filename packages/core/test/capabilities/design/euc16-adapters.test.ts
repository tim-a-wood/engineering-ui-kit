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
import { createDesignMachineApi } from '../../../src/designMachineApi.js'

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

  it('never throws for a hostile agent-actor approval attempt (usage-shaped, not a crash)', async () => {
    const cap = makeCapture()
    const code = await runDesignCli(
      [
        'approveModuleDesign',
        '--json',
        JSON.stringify([{ projectId: 'proj-cli-4', actor: 'agent:copilot', idempotencyKey: 'k1', moduleId: 'mod-x', authority: 'module-owner' }]),
      ],
      { dataDir: tmpDir(), ...cap.opts },
    )
    expect(code).toBe(1)
    const printed = JSON.parse(cap.out.join(''))
    expect(printed.ok).toBe(false)
    expect(printed.diagnostics.map((d: { code: string }) => d.code)).toContain('EUC16-AGENT-APPROVAL-FORBIDDEN')
  })
})

describe('EUC-16 machine API adapter', () => {
  it('exposes exactly the service operations, each callable and awaitable', async () => {
    const api = createDesignMachineApi({ dataDir: tmpDir() })
    expect(Object.keys(api).sort()).toEqual(realOperationNames())
    const status = await api.getWorkflowStatus('proj-machine-1')
    expect(status.projectId).toBe('proj-machine-1')
  })

  it('rejects an agent actor calling approveModuleDesign with the same diagnostics as a direct service call', async () => {
    const dataDir = tmpDir()
    const api = createDesignMachineApi({ dataDir })
    const viaApi = await api.approveModuleDesign({
      projectId: 'proj-machine-2',
      actor: 'agent:copilot',
      idempotencyKey: 'k1',
      moduleId: 'mod-x',
      authority: 'module-owner',
    })

    const workspace = new DesignWorkspace(dataDir)
    const service = createDesignOperations({ workspace })
    const direct = service.approveModuleDesign({
      projectId: 'proj-machine-2',
      actor: 'agent:copilot',
      idempotencyKey: 'k2',
      moduleId: 'mod-x',
      authority: 'module-owner',
    })

    expect(viaApi.ok).toBe(false)
    expect(direct.ok).toBe(false)
    expect(viaApi.diagnostics.map((d) => d.code)).toEqual(direct.diagnostics.map((d) => d.code))
    expect(viaApi.diagnostics.map((d) => d.code)).toContain('EUC16-AGENT-APPROVAL-FORBIDDEN')
  })
})

describe('review-fixes-r4 extension — repositoryRoot option (reviewer P1: data-dir/repository conflation)', () => {
  it('createDesignMachineApi still exposes exactly the service operations when repositoryRoot is set (no drift)', async () => {
    const api = createDesignMachineApi({ dataDir: tmpDir(), repositoryRoot: tmpDir() })
    expect(Object.keys(api).sort()).toEqual(realOperationNames())
  })

  it('applyAgentDelta via the machine API fails with a structured, configuration-naming diagnostic when repositoryRoot is not set (never silently applies into dataDir)', async () => {
    const dataDir = tmpDir()
    const api = createDesignMachineApi({ dataDir })
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
    const cliCode = await runDesignCli(['getWorkflowStatus', '--json', '["proj-equiv-1"]'], { dataDir: tmpDir(), ...cap.opts })
    expect(cliCode).toBe(0)
    const viaCli = JSON.parse(cap.out.join(''))

    const api = createDesignMachineApi({ dataDir: tmpDir() })
    const viaApi = await api.getWorkflowStatus('proj-equiv-1')

    expect(canonicalize(viaCli)).toEqual(canonicalize(viaApi))
  })

  it('returns the same §17.2 change result (minus the random auditEventId) for the same operation and args on identical fresh workspaces', async () => {
    const args = [{ projectId: 'proj-equiv-2', actor: 'user:tim', idempotencyKey: 'k-equiv', workDescription: '' }]

    const cap = makeCapture()
    const cliCode = await runDesignCli(['createUseCaseDraft', '--json', JSON.stringify(args)], { dataDir: tmpDir(), ...cap.opts })
    expect(cliCode).toBe(0)
    const viaCli = JSON.parse(cap.out.join(''))

    const api = createDesignMachineApi({ dataDir: tmpDir() })
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
