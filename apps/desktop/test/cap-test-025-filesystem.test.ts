/**
 * CAP-TEST-025 — hostile-filesystem policy for a temporary project with source/data/artifact
 * roots and hostile paths/symlinks.
 *
 * Exercises the exact security primitives the desktop filesystem handlers use
 * (`resolveProjectRelativePath` + `isRealPathWithinProjectRoot`) against a REAL on-disk project
 * with a REAL symlink that escapes the project root:
 *   - approved project-relative operations resolve;
 *   - absolute paths, traversal, and out-of-policy roots are rejected;
 *   - a symlink pointing outside the project fails the symlink-safe containment check that a
 *     pure string prefix check would wrongly accept;
 *   - resolved results carry only project-relative paths — never a host absolute path.
 *
 * Run: npx vitest run apps/desktop/test/cap-test-025-filesystem.test.ts
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  resolveProjectRelativePath,
  isRealPathWithinProjectRoot,
  isWithinProjectRoot,
} from '@engineering-ui-kit/core'

const POLICY = {
  roots: {
    source: 'capabilities/modules',
    'generated-output': 'capabilities/generated',
    configuration: 'capabilities/config',
    'input-data': 'data',
    artifacts: 'artifacts',
  },
} as const

const ALL_ROOTS = [
  'source',
  'generated-output',
  'configuration',
  'input-data',
  'artifacts',
] as const

let projectRoot: string
let outsideDir: string

beforeAll(() => {
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-test-025-proj-'))
  outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-test-025-outside-'))
  fs.mkdirSync(path.join(projectRoot, 'artifacts'), { recursive: true })
  fs.writeFileSync(path.join(projectRoot, 'artifacts', 'ok.txt'), 'inside')
  fs.writeFileSync(path.join(outsideDir, 'secret.txt'), 'host-secret')
  // Hostile symlink INSIDE the project pointing at a directory OUTSIDE the project.
  fs.symlinkSync(outsideDir, path.join(projectRoot, 'artifacts', 'escape'))
})

afterAll(() => {
  fs.rmSync(projectRoot, { recursive: true, force: true })
  fs.rmSync(outsideDir, { recursive: true, force: true })
})

describe('CAP-TEST-025 hostile filesystem policy', () => {
  it('resolves approved project-relative operations', () => {
    const result = resolveProjectRelativePath(POLICY, 'artifacts/ok.txt', [...ALL_ROOTS])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.root).toBe('artifacts')
      expect(result.relativePath).toBe('artifacts/ok.txt')
    }
  })

  it('rejects absolute paths', () => {
    const result = resolveProjectRelativePath(POLICY, '/etc/passwd', [...ALL_ROOTS])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.diagnostics[0].code).toBe('CAP-FS-001')
  })

  it('rejects traversal escapes', () => {
    const result = resolveProjectRelativePath(POLICY, 'artifacts/../../etc/passwd', [...ALL_ROOTS])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.diagnostics[0].code).toBe('CAP-FS-002')
  })

  it('rejects paths outside the policy roots', () => {
    const result = resolveProjectRelativePath(POLICY, 'somewhere-else/file.txt', [...ALL_ROOTS])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.diagnostics[0].code).toBe('CAP-FS-003')
  })

  it('fails a symlink that escapes the project root', () => {
    const escapeLeaf = path.join(projectRoot, 'artifacts', 'escape', 'secret.txt')
    // A naive string prefix check is fooled — the path textually sits under the project root...
    expect(isWithinProjectRoot(projectRoot, escapeLeaf)).toBe(true)
    // ...but symlink-safe containment resolves the real target and rejects it.
    expect(isRealPathWithinProjectRoot(projectRoot, escapeLeaf)).toBe(false)
  })

  it('accepts a genuine file inside the project root', () => {
    const inside = path.join(projectRoot, 'artifacts', 'ok.txt')
    expect(isRealPathWithinProjectRoot(projectRoot, inside)).toBe(true)
  })

  it('never leaks a host absolute path in a resolved result', () => {
    const result = resolveProjectRelativePath(POLICY, 'artifacts/ok.txt', [...ALL_ROOTS])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(path.isAbsolute(result.relativePath)).toBe(false)
      expect(result.relativePath).not.toContain(projectRoot)
      expect(result.relativePath).not.toContain(os.tmpdir())
    }
  })
})
