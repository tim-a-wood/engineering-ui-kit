/**
 * CAP-TEST-026/027/028 — MATLAB adapter tests.
 *
 * These run with NO MATLAB installed: EUIK_TEST_MODE forces the deterministic
 * fake worker. A real-integration test skips only when discovery genuinely
 * fails and prints the exact discovery failure reason.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createMatlabAdapter, type MatlabAdapter } from '../src/capabilities/matlabAdapter.ts'

process.env.EUIK_TEST_MODE = '1'

let tmpRoot: string
let adapter: MatlabAdapter

function rootDir(projectId: string): string {
  return path.join(tmpRoot, projectId)
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'matlab-adapter-'))
  adapter = createMatlabAdapter({ rootDir, forceFakeMode: true })
})

afterEach(async () => {
  await adapter.shutdownAll()
  fs.rmSync(tmpRoot, { recursive: true, force: true })
})

describe('lifecycle', () => {
  it('starts lazily and reports a ready record with no engine handle', async () => {
    expect(adapter.getStatus('p1').state).toBe('stopped')
    const started = await adapter.start('p1')
    expect(started.outcome).toBe('success')
    expect(adapter.getStatus('p1').state).toBe('ready')
    const record = started.value as Record<string, unknown>
    expect(record.processOwnership).toBe('app-owned')
    expect(JSON.stringify(record)).not.toContain('worker')
  })

  it('reuses one session across repeated calls', async () => {
    await adapter.start('p1')
    const before = adapter.getStatus('p1').sessionId
    const a = await adapter.evalExpression('p1', { expression: '1+1' })
    const b = await adapter.evalExpression('p1', { expression: '2*3' })
    expect((a.value as { value: number }).value).toBe(2)
    expect((b.value as { value: number }).value).toBe(6)
    expect(adapter.getStatus('p1').sessionId).toBe(before)
  })

  it('stops the session explicitly', async () => {
    await adapter.start('p1')
    const stopped = await adapter.stop('p1')
    expect(stopped.outcome).toBe('success')
    expect(adapter.getStatus('p1').state).toBe('stopped')
  })
})

describe('serialization and isolation', () => {
  it('serializes concurrent calls within a project', async () => {
    await adapter.start('p1')
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => adapter.evalExpression('p1', { expression: `${i}+${i}` })),
    )
    results.forEach((r, i) => {
      expect(r.outcome).toBe('success')
      expect((r.value as { value: number }).value).toBe(i * 2)
    })
  })

  it('isolates workspaces across projects', async () => {
    await adapter.workspacePut('p1', { name: 'x', value: 41 })
    await adapter.workspacePut('p2', { name: 'x', value: 99 })
    const g1 = await adapter.workspaceGet('p1', { name: 'x' })
    const g2 = await adapter.workspaceGet('p2', { name: 'x' })
    expect((g1.value as { value: number }).value).toBe(41)
    expect((g2.value as { value: number }).value).toBe(99)
  })

  it('runs distinct projects concurrently', async () => {
    const [a, b] = await Promise.all([
      adapter.evalExpression('pa', { expression: '10' }),
      adapter.evalExpression('pb', { expression: '20' }),
    ])
    expect((a.value as { value: number }).value).toBe(10)
    expect((b.value as { value: number }).value).toBe(20)
    expect(adapter.getStatus('pa').sessionId).not.toBe(adapter.getStatus('pb').sessionId)
  })
})

describe('crash and restart', () => {
  it('marks a session unhealthy after a crash and blocks reuse', async () => {
    await adapter.start('p1')
    await adapter.simulateCrash('p1')
    expect(adapter.getStatus('p1').state).toBe('unhealthy')
    const afterCrash = await adapter.evalExpression('p1', { expression: '1+1' })
    expect(afterCrash.outcome).toBe('technical-failure')
    expect(afterCrash.error?.code).toBe('CAP-MATLAB-UNHEALTHY')
  })

  it('restart recreates the session without claiming prior state survived', async () => {
    await adapter.workspacePut('p1', { name: 'x', value: 7 })
    await adapter.simulateCrash('p1')
    const restarted = await adapter.restart('p1')
    expect(restarted.outcome).toBe('success')
    expect((restarted.value as { inMemoryStatePreserved: boolean }).inMemoryStatePreserved).toBe(false)
    expect(adapter.getStatus('p1').state).toBe('ready')
    // Prior variable is gone after restart.
    const g = await adapter.workspaceGet('p1', { name: 'x' })
    expect(g.outcome).toBe('technical-failure')
  })
})

describe('allowlists', () => {
  it('rejects non-allowlisted expressions', async () => {
    await adapter.start('p1')
    const r = await adapter.evalExpression('p1', { expression: 'system("rm -rf /")' })
    expect(r.outcome).toBe('technical-failure')
    expect(r.error?.code).toBe('CAP-MATLAB-ALLOWLIST')
  })

  it('rejects non-allowlisted functions', async () => {
    await adapter.start('p1')
    const r = await adapter.callFunction('p1', { name: 'eval', args: [] })
    expect(r.outcome).toBe('technical-failure')
    expect(r.error?.code).toBe('CAP-MATLAB-ALLOWLIST')
  })

  it('allows an allowlisted function', async () => {
    const r = await adapter.callFunction('p1', { name: 'sum', args: [[1, 2, 3, 4]] })
    expect(r.outcome).toBe('success')
    expect((r.value as { value: number }).value).toBe(10)
  })

  it('rejects a script that is not approved', async () => {
    const r = await adapter.runScript('p1', { scriptId: 'unknown-script' })
    expect(r.outcome).toBe('technical-failure')
    expect(r.error?.code).toBe('CAP-MATLAB-SCRIPT-ALLOWLIST')
  })

  it('runs an approved script', async () => {
    const scoped = createMatlabAdapter({
      rootDir,
      forceFakeMode: true,
      allowlist: { scripts: { init: 'disp("hi")' } },
    })
    const r = await scoped.runScript('p1', { scriptId: 'init' })
    expect(r.outcome).toBe('success')
    await scoped.shutdownAll()
  })
})

describe('value conversion', () => {
  it('typed-rejects unsupported values on put', async () => {
    const r = await adapter.workspacePut('p1', { name: 'f', value: () => 1 })
    expect(r.outcome).toBe('technical-failure')
    expect(r.error?.code).toBe('CAP-MATLAB-UNSUPPORTED-VALUE')
    expect(r.error?.category).toBe('validation')
  })

  it('typed-rejects non-finite numbers', async () => {
    const r = await adapter.workspacePut('p1', { name: 'n', value: Number.POSITIVE_INFINITY })
    expect(r.outcome).toBe('technical-failure')
    expect(r.error?.code).toBe('CAP-MATLAB-UNSUPPORTED-VALUE')
  })

  it('accepts scalars, arrays and plain structs', async () => {
    const put = await adapter.workspacePut('p1', { name: 's', value: { a: 1, b: [1, 2, 3], c: 'ok', d: true, e: null } })
    expect(put.outcome).toBe('success')
    const got = await adapter.workspaceGet('p1', { name: 's' })
    expect((got.value as { value: { b: number[] } }).value.b).toEqual([1, 2, 3])
  })
})

describe('snapshots', () => {
  it('saves and restores selected variables with a matching checksum', async () => {
    await adapter.workspacePut('p1', { name: 'keep', value: 123 })
    await adapter.workspacePut('p1', { name: 'skip', value: 456 })
    const saved = await adapter.snapshotSave('p1', { variables: ['keep'] })
    expect(saved.outcome).toBe('success')
    const { snapshotId, checksum, dataRef } = saved.value as { snapshotId: string; checksum: string; dataRef: string }
    expect(checksum).toMatch(/^[0-9a-f]{64}$/)
    // Envelope carries only a relative ref, never an absolute host path.
    expect(path.isAbsolute(dataRef)).toBe(false)

    // Mutate then restore.
    await adapter.workspacePut('p1', { name: 'keep', value: 0 })
    const restored = await adapter.snapshotRestore('p1', { snapshotId })
    expect(restored.outcome).toBe('success')
    const g = await adapter.workspaceGet('p1', { name: 'keep' })
    expect((g.value as { value: number }).value).toBe(123)
  })

  it('rejects a corrupt snapshot and leaves the session usable', async () => {
    await adapter.workspacePut('p1', { name: 'keep', value: 1 })
    const saved = await adapter.snapshotSave('p1', { variables: ['keep'] })
    const { snapshotId, dataRef } = saved.value as { snapshotId: string; dataRef: string }
    fs.writeFileSync(path.join(rootDir('p1'), 'matlab-snapshots', dataRef), 'corrupted')
    const restored = await adapter.snapshotRestore('p1', { snapshotId })
    expect(restored.outcome).toBe('technical-failure')
    expect(restored.error?.code).toBe('CAP-MATLAB-SNAPSHOT-CORRUPT')
    // Session still usable.
    const ok = await adapter.evalExpression('p1', { expression: '2+2' })
    expect(ok.outcome).toBe('success')
  })

  it('rejects a cross-project snapshot restore', async () => {
    await adapter.workspacePut('p1', { name: 'keep', value: 1 })
    const saved = await adapter.snapshotSave('p1', { variables: ['keep'] })
    const { snapshotId, dataRef } = saved.value as { snapshotId: string; dataRef: string }
    // Copy p1 snapshot metadata + data into p2 but keep original projectId.
    const p2dir = path.join(rootDir('p2'), 'matlab-snapshots')
    fs.mkdirSync(p2dir, { recursive: true })
    fs.copyFileSync(path.join(rootDir('p1'), 'matlab-snapshots', `${snapshotId}.json`), path.join(p2dir, `${snapshotId}.json`))
    fs.copyFileSync(path.join(rootDir('p1'), 'matlab-snapshots', dataRef), path.join(p2dir, dataRef))
    const restored = await adapter.snapshotRestore('p2', { snapshotId })
    expect(restored.outcome).toBe('technical-failure')
    expect(restored.error?.code).toBe('CAP-MATLAB-SNAPSHOT-SCOPE')
  })

  it('requires an explicit variable selection (never the whole workspace)', async () => {
    const r = await adapter.snapshotSave('p1', { variables: [] })
    expect(r.outcome).toBe('technical-failure')
    expect(r.error?.code).toBe('CAP-MATLAB-SNAPSHOT-SCOPE')
  })
})

describe('discovery', () => {
  it('reports fake mode under EUIK_TEST_MODE', async () => {
    const d = await adapter.discover()
    expect(d.mode).toBe('fake')
    expect(d.available).toBe(false)
    expect(d.reason).toBeTruthy()
  })
})

describe('real integration (skips when Engine unavailable)', () => {
  it('discovers and runs against a real MATLAB Engine', async () => {
    delete process.env.EUIK_TEST_MODE
    const real = createMatlabAdapter({ rootDir })
    const discovery = await real.discover()
    if (!discovery.available) {
      console.warn(`[real-integration] skipped — MATLAB Engine unavailable: ${discovery.reason}`)
      await real.shutdownAll()
      process.env.EUIK_TEST_MODE = '1'
      return
    }
    const r = await real.evalExpression('real-p', { expression: '1+1' })
    expect(r.outcome).toBe('success')
    expect((r.value as { value: number }).value).toBe(2)
    await real.shutdownAll()
    process.env.EUIK_TEST_MODE = '1'
  })
})
