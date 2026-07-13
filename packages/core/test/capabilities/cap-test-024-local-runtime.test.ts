/** CAP-TEST-024 — one approved local operation crosses the chosen transport. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { invokeLocalRuntime } from '../../src/capabilities/localRuntimeHost.js'

describe('CAP-TEST-024 local embedded runtime transport', () => {
  it('invokes exactly one operation from a manifest-owned runtime entrypoint', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-local-runtime-'))
    const moduleRoot = path.join(root, 'capabilities', 'modules', 'mod.math')
    fs.mkdirSync(moduleRoot, { recursive: true })
    fs.writeFileSync(
      path.join(moduleRoot, 'runtime.mjs'),
      `export const operations = { 'op.add': ({ a, b }) => ({ total: a + b }) }\n`,
    )
    await expect(
      invokeLocalRuntime({
        repoRoot: root,
        moduleId: 'mod.math',
        ownedPaths: ['capabilities/modules/mod.math/'],
        operationId: 'op.add',
        args: { a: 2, b: 3 },
      }),
    ).resolves.toEqual({ total: 5 })
    await expect(
      invokeLocalRuntime({
        repoRoot: root,
        moduleId: 'mod.math',
        ownedPaths: ['capabilities/modules/mod.math/'],
        operationId: 'op.missing',
      }),
    ).rejects.toThrow(/does not export/)
  })

  it('rejects entrypoints outside manifest-owned paths', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-local-runtime-scope-'))
    fs.writeFileSync(path.join(root, 'runtime.mjs'), `export const operations = { x: () => 1 }\n`)
    await expect(
      invokeLocalRuntime({
        repoRoot: root,
        moduleId: 'mod.bad',
        ownedPaths: ['../'],
        operationId: 'x',
      }),
    ).rejects.toThrow(/invalid owned path/)
  })
})
