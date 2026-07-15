/**
 * CAP-TEST-085 — transactional staging/apply/rollback (CAP-ERA-001 §11.3).
 *
 * The critical property under test: at EVERY phase of `applyGenerationPlan`
 * (staging, self-validation, saving rollback material, and mid-apply), a
 * forced failure must leave the target repository byte-for-byte identical to
 * its pre-apply snapshot. Failures are injected either via real filesystem
 * conditions (a pre-existing directory blocking a rename) or by monkeypatching
 * the shared `node:fs` module object with `vi.spyOn` (both modules resolve
 * `import fs from 'node:fs'` to the same live object, so a spy installed from
 * the test observes calls made inside `generationApply.ts`).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyGenerationPlan,
  GenerationApplyRefusedError,
  GenerationApplyRolledBackError,
  rollbackGenerationApply,
  type ApplyGenerationPlanInput,
  type GenerationApplyVirtualFile,
} from '../../src/capabilities/generationApply.js'
import { canonicalRecordHash } from '../../src/capabilities/hash.js'
import type { GeneratedOwnershipManifest, GenerationFileChange, GenerationPlan } from '../../src/capabilities/types.js'

function contentHash(content: string): string {
  return canonicalRecordHash(content)
}

function makePlan(fileChanges: GenerationFileChange[], overrides: Partial<GenerationPlan> = {}): GenerationPlan {
  const base: Omit<GenerationPlan, 'planHash'> = {
    schemaVersion: '1.0',
    planId: overrides.planId ?? 'plan-cap-test-085',
    projectId: 'proj-cap-test-085',
    inputRecords: [],
    generatorVersion: '0.1.0',
    referenceProfileVersion: '1.0.0',
    targetRepository: { root: '.', cleanState: overrides.targetRepository?.cleanState ?? 'clean' },
    dependencyChanges: [],
    fileChanges,
    commands: overrides.commands ?? ['npm install'],
    warnings: [],
    blockers: [],
    ambiguityQuestions: [],
    rollbackStrategy: 'staged-rename-with-journal',
  }
  return { ...base, planHash: canonicalRecordHash(base), ...overrides }
}

function mkTempRepo(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cap-test-085-'))
}

function writeFile(root: string, relPath: string, content: string): void {
  const abs = path.join(root, relPath)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content, 'utf8')
}

function readFile(root: string, relPath: string): string {
  return fs.readFileSync(path.join(root, relPath), 'utf8')
}

/** Recursive directory snapshot (path -> content), excluding `.engineering-ui`. */
function snapshot(root: string): Record<string, string> {
  const out: Record<string, string> = {}
  function walk(dir: string, rel: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (rel === '' && entry.name === '.engineering-ui') continue
      const abs = path.join(dir, entry.name)
      const relPath = rel === '' ? entry.name : `${rel}/${entry.name}`
      if (entry.isSymbolicLink()) out[relPath] = `SYMLINK:${fs.readlinkSync(abs)}`
      else if (entry.isDirectory()) walk(abs, relPath)
      else out[relPath] = fs.readFileSync(abs, 'utf8')
    }
  }
  walk(root, '')
  return out
}

let repoRoots: string[] = []
function repo(): string {
  const root = mkTempRepo()
  repoRoots.push(root)
  return root
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const root of repoRoots) fs.rmSync(root, { recursive: true, force: true })
  repoRoots = []
})

const FIXED_NOW = () => new Date('2026-07-15T00:00:00.000Z')

describe('CAP-TEST-085 transactional generation apply', () => {
  it('applies create + update + delete and verifies postimages', () => {
    const root = repo()
    writeFile(root, 'src/existing.ts', 'export const original = 1\n')
    writeFile(root, 'src/gone.ts', 'export const toDelete = true\n')

    const newContent = 'export const brandNew = true\n'
    const updatedContent = 'export const original = 2\n'

    const fileChanges: GenerationFileChange[] = [
      { path: 'src/new.ts', action: 'create', ownership: 'editable', reason: 'scaffold', postimageHash: contentHash(newContent) },
      {
        path: 'src/existing.ts',
        action: 'update',
        ownership: 'editable',
        reason: 'update',
        preimageHash: contentHash('export const original = 1\n'),
        postimageHash: contentHash(updatedContent),
      },
      {
        path: 'src/gone.ts',
        action: 'delete',
        ownership: 'editable',
        reason: 'remove',
        preimageHash: contentHash('export const toDelete = true\n'),
      },
    ]
    const plan = makePlan(fileChanges)
    const virtualFiles: GenerationApplyVirtualFile[] = [
      { path: 'src/new.ts', contents: newContent },
      { path: 'src/existing.ts', contents: updatedContent },
    ]

    const result = applyGenerationPlan({ plan, targetRoot: root, virtualFiles, runId: 'run-happy', now: FIXED_NOW })

    expect(result.runId).toBe('run-happy')
    expect(result.rollbackId).toBe('run-happy')
    expect(result.commands).toEqual(['npm install'])
    expect(new Set(result.appliedFiles.map((f) => f.path))).toEqual(new Set(['src/new.ts', 'src/existing.ts', 'src/gone.ts']))
    expect(result.resultingHashes['src/new.ts']).toBe(contentHash(newContent))
    expect(result.resultingHashes['src/existing.ts']).toBe(contentHash(updatedContent))
    expect(result.resultingHashes['src/gone.ts']).toBeUndefined()

    expect(readFile(root, 'src/new.ts')).toBe(newContent)
    expect(readFile(root, 'src/existing.ts')).toBe(updatedContent)
    expect(fs.existsSync(path.join(root, 'src/gone.ts'))).toBe(false)

    // Staging is cleaned up after success; the rollback bundle is retained.
    expect(fs.existsSync(path.join(root, '.engineering-ui/capabilities/staging/run-happy'))).toBe(false)
    expect(fs.existsSync(path.join(root, '.engineering-ui/capabilities/rollback/run-happy/journal.json'))).toBe(true)
  })

  it('leaves an update unchanged (no spurious diff) when the postimage is identical to the preimage', () => {
    const root = repo()
    const content = 'export const stable = 1\n'
    writeFile(root, 'src/stable.ts', content)

    const fileChanges: GenerationFileChange[] = [
      {
        path: 'src/stable.ts',
        action: 'update',
        ownership: 'editable',
        reason: 'idempotent regeneration',
        preimageHash: contentHash(content),
        postimageHash: contentHash(content),
      },
    ]
    const plan = makePlan(fileChanges)
    const result = applyGenerationPlan({
      plan,
      targetRoot: root,
      virtualFiles: [{ path: 'src/stable.ts', contents: content }],
      runId: 'run-idempotent',
      now: FIXED_NOW,
    })

    expect(readFile(root, 'src/stable.ts')).toBe(content)
    expect(result.resultingHashes['src/stable.ts']).toBe(contentHash(content))
  })

  describe('forced failure at each phase restores the exact pre-apply state', () => {
    it('phase: staging (a real fs collision blocks writing the staged postimage)', () => {
      const root = repo()
      writeFile(root, 'src/a.ts', 'export const a = 1\n')
      const before = snapshot(root)

      const aUpdated = 'export const a = 2\n'
      const bContent = 'export const b = 1\n'
      const runId = 'run-stage-fail'

      // Force a real staging-phase failure for src/b.ts: pre-create a
      // *directory* at the exact staging path `writeFileSync` will target,
      // so the write throws (EISDIR) before any real target file is touched.
      const stagingPathForB = path.join(root, '.engineering-ui/capabilities/staging', runId, 'src/b.ts')
      fs.mkdirSync(stagingPathForB, { recursive: true })

      const plan = makePlan([
        {
          path: 'src/a.ts',
          action: 'update',
          ownership: 'editable',
          reason: 'x',
          preimageHash: contentHash('export const a = 1\n'),
          postimageHash: contentHash(aUpdated),
        },
        { path: 'src/b.ts', action: 'create', ownership: 'editable', reason: 'y', postimageHash: contentHash(bContent) },
      ])

      expect(() =>
        applyGenerationPlan({
          plan,
          targetRoot: root,
          virtualFiles: [
            { path: 'src/a.ts', contents: aUpdated },
            { path: 'src/b.ts', contents: bContent },
          ],
          runId,
          now: FIXED_NOW,
        }),
      ).toThrow()

      expect(snapshot(root)).toEqual(before)
      expect(fs.existsSync(path.join(root, '.engineering-ui/capabilities/staging', runId))).toBe(false)
    })

    it('phase: self-validation (staged bytes silently diverge from the expected postimage)', () => {
      const root = repo()
      writeFile(root, 'src/keep.ts', 'export const keep = 1\n')
      const before = snapshot(root)

      const content = 'export const fresh = 1\n'
      const fileChanges: GenerationFileChange[] = [
        { path: 'src/fresh.ts', action: 'create', ownership: 'editable', reason: 'x', postimageHash: contentHash(content) },
      ]
      const plan = makePlan(fileChanges)

      // There is exactly one staging write in this plan (src/fresh.ts); make
      // that single write silently land corrupted bytes so self-validation
      // (re-hash the staged file, compare to postimageHash) must catch it.
      const originalWrite = fs.writeFileSync.bind(fs)
      const spy = vi
        .spyOn(fs, 'writeFileSync')
        .mockImplementationOnce(((target: fs.PathOrFileDescriptor, _data: unknown, options?: unknown) =>
          originalWrite(target, 'CORRUPTED', options as fs.WriteFileOptions)) as typeof fs.writeFileSync)

      expect(() =>
        applyGenerationPlan({
          plan,
          targetRoot: root,
          virtualFiles: [{ path: 'src/fresh.ts', contents: content }],
          runId: 'run-selfvalidate-fail',
          now: FIXED_NOW,
        }),
      ).toThrow()
      spy.mockRestore()

      expect(snapshot(root)).toEqual(before)
      expect(fs.existsSync(path.join(root, '.engineering-ui/capabilities/staging/run-selfvalidate-fail'))).toBe(false)
    })

    it('phase: saving rollback material (copyFileSync throws while snapshotting a preimage)', () => {
      const root = repo()
      writeFile(root, 'src/existing.ts', 'export const original = 1\n')
      const before = snapshot(root)

      const updated = 'export const original = 2\n'
      const fileChanges: GenerationFileChange[] = [
        {
          path: 'src/existing.ts',
          action: 'update',
          ownership: 'editable',
          reason: 'update',
          preimageHash: contentHash('export const original = 1\n'),
          postimageHash: contentHash(updated),
        },
      ]
      const plan = makePlan(fileChanges)

      const spy = vi.spyOn(fs, 'copyFileSync').mockImplementation(() => {
        throw new Error('injected copyFileSync failure')
      })

      expect(() =>
        applyGenerationPlan({
          plan,
          targetRoot: root,
          virtualFiles: [{ path: 'src/existing.ts', contents: updated }],
          runId: 'run-rollback-save-fail',
          now: FIXED_NOW,
        }),
      ).toThrow(/injected copyFileSync failure/)
      spy.mockRestore()

      expect(snapshot(root)).toEqual(before)
      expect(fs.existsSync(path.join(root, '.engineering-ui/capabilities/staging/run-rollback-save-fail'))).toBe(false)
      expect(fs.existsSync(path.join(root, '.engineering-ui/capabilities/rollback/run-rollback-save-fail'))).toBe(false)
    })

    it('phase: mid-apply, after N of M changes (renameSync fails on the 2nd of 3 changes)', () => {
      const root = repo()
      writeFile(root, 'src/one.ts', 'export const one = 1\n')
      writeFile(root, 'src/two.ts', 'export const two = 1\n')
      writeFile(root, 'src/three.ts', 'export const three = 1\n')
      const before = snapshot(root)

      const oneUpdated = 'export const one = 2\n'
      const twoUpdated = 'export const two = 2\n'
      const threeUpdated = 'export const three = 2\n'

      const fileChanges: GenerationFileChange[] = [
        { path: 'src/one.ts', action: 'update', ownership: 'editable', reason: 'x', preimageHash: contentHash('export const one = 1\n'), postimageHash: contentHash(oneUpdated) },
        { path: 'src/three.ts', action: 'update', ownership: 'editable', reason: 'x', preimageHash: contentHash('export const three = 1\n'), postimageHash: contentHash(threeUpdated) },
        { path: 'src/two.ts', action: 'update', ownership: 'editable', reason: 'x', preimageHash: contentHash('export const two = 1\n'), postimageHash: contentHash(twoUpdated) },
      ]
      const plan = makePlan(fileChanges)

      let renameCount = 0
      const originalRename = fs.renameSync.bind(fs)
      const spy = vi.spyOn(fs, 'renameSync').mockImplementation((...args: Parameters<typeof fs.renameSync>) => {
        renameCount += 1
        if (renameCount === 2) {
          throw new Error('injected renameSync failure on the 2nd change')
        }
        return originalRename(...args)
      })

      expect(() =>
        applyGenerationPlan({
          plan,
          targetRoot: root,
          virtualFiles: [
            { path: 'src/one.ts', contents: oneUpdated },
            { path: 'src/two.ts', contents: twoUpdated },
            { path: 'src/three.ts', contents: threeUpdated },
          ],
          runId: 'run-midapply-fail',
          now: FIXED_NOW,
        }),
      ).toThrow(GenerationApplyRolledBackError)
      spy.mockRestore()

      expect(renameCount).toBe(2)
      expect(snapshot(root)).toEqual(before)
      expect(fs.existsSync(path.join(root, '.engineering-ui/capabilities/staging/run-midapply-fail'))).toBe(false)
      expect(fs.existsSync(path.join(root, '.engineering-ui/capabilities/rollback/run-midapply-fail'))).toBe(false)
    })

    it('phase: mid-apply on a brand-new file (renameSync fails on the 2nd create; the 1st created file is removed)', () => {
      const root = repo()
      const before = snapshot(root)

      const aContent = 'export const a = 1\n'
      const bContent = 'export const b = 1\n'
      const fileChanges: GenerationFileChange[] = [
        { path: 'src/a.ts', action: 'create', ownership: 'editable', reason: 'x', postimageHash: contentHash(aContent) },
        { path: 'src/b.ts', action: 'create', ownership: 'editable', reason: 'x', postimageHash: contentHash(bContent) },
      ]
      const plan = makePlan(fileChanges)

      let renameCount = 0
      const originalRename = fs.renameSync.bind(fs)
      const spy = vi.spyOn(fs, 'renameSync').mockImplementation((...args: Parameters<typeof fs.renameSync>) => {
        renameCount += 1
        if (renameCount === 2) throw new Error('injected failure on 2nd create')
        return originalRename(...args)
      })

      expect(() =>
        applyGenerationPlan({
          plan,
          targetRoot: root,
          virtualFiles: [
            { path: 'src/a.ts', contents: aContent },
            { path: 'src/b.ts', contents: bContent },
          ],
          runId: 'run-midapply-create-fail',
          now: FIXED_NOW,
        }),
      ).toThrow(GenerationApplyRolledBackError)
      spy.mockRestore()

      expect(snapshot(root)).toEqual(before)
      expect(fs.existsSync(path.join(root, 'src'))).toBe(false)
    })
  })

  it('STALE-PREIMAGE: refuses an update whose on-disk hash no longer matches preimageHash, target unchanged', () => {
    const root = repo()
    writeFile(root, 'src/drifted.ts', 'export const v = 1\n')
    const before = snapshot(root)

    const fileChanges: GenerationFileChange[] = [
      {
        path: 'src/drifted.ts',
        action: 'update',
        ownership: 'editable',
        reason: 'update',
        preimageHash: contentHash('export const v = 0\n'), // stale: on-disk is v = 1
        postimageHash: contentHash('export const v = 2\n'),
      },
    ]
    const plan = makePlan(fileChanges)

    let error: unknown
    try {
      applyGenerationPlan({
        plan,
        targetRoot: root,
        virtualFiles: [{ path: 'src/drifted.ts', contents: 'export const v = 2\n' }],
        runId: 'run-stale-preimage',
        now: FIXED_NOW,
      })
    } catch (err) {
      error = err
    }

    expect(error).toBeInstanceOf(GenerationApplyRefusedError)
    expect((error as GenerationApplyRefusedError).issues.some((i) => i.includes('STALE-PREIMAGE'))).toBe(true)
    expect(snapshot(root)).toEqual(before)
    expect(fs.existsSync(path.join(root, '.engineering-ui'))).toBe(false)
  })

  it('MODIFIED-GENERATED: refuses updating a generated file changed since it was last generated', () => {
    const root = repo()
    const lastGenerated = 'export const generatedValue = 1\n'
    const handEdited = 'export const generatedValue = 999 // hand edited\n'
    writeFile(root, 'src/gen.ts', handEdited)
    const before = snapshot(root)

    const manifest: GeneratedOwnershipManifest = {
      schemaVersion: '1.0',
      projectId: 'proj-cap-test-085',
      filePath: 'src/gen.ts',
      contentHash: contentHash(lastGenerated),
      generatorVersion: '0.1.0',
      referenceProfileVersion: '1.0.0',
      sourceContractHashes: [],
      deployableId: 'dep-1',
      moduleIds: [],
      lastAppliedPlanId: 'plan-old',
      safeToDelete: false,
    }

    const newContent = 'export const generatedValue = 2\n'
    const fileChanges: GenerationFileChange[] = [
      {
        path: 'src/gen.ts',
        action: 'update',
        ownership: 'generated',
        reason: 'regenerate',
        preimageHash: contentHash(handEdited),
        postimageHash: contentHash(newContent),
      },
    ]
    const plan = makePlan(fileChanges)

    let error: unknown
    try {
      applyGenerationPlan({
        plan,
        targetRoot: root,
        virtualFiles: [{ path: 'src/gen.ts', contents: newContent }],
        ownershipManifest: [manifest],
        runId: 'run-modified-generated',
        now: FIXED_NOW,
      })
    } catch (err) {
      error = err
    }

    expect(error).toBeInstanceOf(GenerationApplyRefusedError)
    expect((error as GenerationApplyRefusedError).issues.some((i) => i.includes('MODIFIED-GENERATED'))).toBe(true)
    expect(snapshot(root)).toEqual(before)
  })

  describe('PATH SAFETY', () => {
    it('refuses a change path containing ".." traversal, nothing written', () => {
      const root = repo()
      const before = snapshot(root)
      const content = 'malicious\n'
      const plan = makePlan([
        { path: '../escape.ts', action: 'create', ownership: 'editable', reason: 'x', postimageHash: contentHash(content) },
      ])

      expect(() =>
        applyGenerationPlan({
          plan,
          targetRoot: root,
          virtualFiles: [{ path: '../escape.ts', contents: content }],
          runId: 'run-traversal',
          now: FIXED_NOW,
        }),
      ).toThrow(GenerationApplyRefusedError)

      expect(snapshot(root)).toEqual(before)
      expect(fs.existsSync(path.join(path.dirname(root), 'escape.ts'))).toBe(false)
    })

    it('refuses an absolute change path, nothing written', () => {
      const root = repo()
      const before = snapshot(root)
      const content = 'malicious\n'
      const outside = path.join(os.tmpdir(), `cap-test-085-absolute-${Date.now()}.ts`)
      const plan = makePlan([
        { path: outside, action: 'create', ownership: 'editable', reason: 'x', postimageHash: contentHash(content) },
      ])

      expect(() =>
        applyGenerationPlan({
          plan,
          targetRoot: root,
          virtualFiles: [{ path: outside, contents: content }],
          runId: 'run-absolute',
          now: FIXED_NOW,
        }),
      ).toThrow(GenerationApplyRefusedError)

      expect(snapshot(root)).toEqual(before)
      expect(fs.existsSync(outside)).toBe(false)
    })

    it('refuses a change path whose parent is a symlink escaping targetRoot', () => {
      const root = repo()
      const outsideDir = repo() // a second temp dir, outside `root`
      fs.symlinkSync(outsideDir, path.join(root, 'escaped-link'), 'dir')
      const before = snapshot(root) // snapshot walks real files only (symlink dir itself has no files yet)

      const content = 'malicious\n'
      const plan = makePlan([
        { path: 'escaped-link/pwned.ts', action: 'create', ownership: 'editable', reason: 'x', postimageHash: contentHash(content) },
      ])

      expect(() =>
        applyGenerationPlan({
          plan,
          targetRoot: root,
          virtualFiles: [{ path: 'escaped-link/pwned.ts', contents: content }],
          runId: 'run-symlink-escape',
          now: FIXED_NOW,
        }),
      ).toThrow(GenerationApplyRefusedError)

      expect(fs.existsSync(path.join(outsideDir, 'pwned.ts'))).toBe(false)
      expect(snapshot(root)).toEqual(before)
    })
  })

  describe('rollbackGenerationApply', () => {
    it('restores the exact pre-apply state after a successful apply, and is idempotent on a 2nd call', () => {
      const root = repo()
      writeFile(root, 'src/existing.ts', 'export const original = 1\n')
      writeFile(root, 'src/gone.ts', 'export const toDelete = true\n')
      const before = snapshot(root)

      const newContent = 'export const brandNew = true\n'
      const updatedContent = 'export const original = 2\n'
      const fileChanges: GenerationFileChange[] = [
        { path: 'src/new.ts', action: 'create', ownership: 'editable', reason: 'x', postimageHash: contentHash(newContent) },
        {
          path: 'src/existing.ts',
          action: 'update',
          ownership: 'editable',
          reason: 'x',
          preimageHash: contentHash('export const original = 1\n'),
          postimageHash: contentHash(updatedContent),
        },
        {
          path: 'src/gone.ts',
          action: 'delete',
          ownership: 'editable',
          reason: 'x',
          preimageHash: contentHash('export const toDelete = true\n'),
        },
      ]
      const plan = makePlan(fileChanges)
      const result = applyGenerationPlan({
        plan,
        targetRoot: root,
        virtualFiles: [
          { path: 'src/new.ts', contents: newContent },
          { path: 'src/existing.ts', contents: updatedContent },
        ],
        runId: 'run-to-rollback',
        now: FIXED_NOW,
      })

      // Sanity: apply actually changed the target.
      expect(snapshot(root)).not.toEqual(before)

      const rollback1 = rollbackGenerationApply(root, result.rollbackId)
      expect(new Set(rollback1.restoredFiles.map((f) => f.path))).toEqual(
        new Set(['src/new.ts', 'src/existing.ts', 'src/gone.ts']),
      )
      const afterFirstRollback = snapshot(root)
      expect(afterFirstRollback).toEqual(before)

      // Idempotent: rolling back again produces the same on-disk state.
      const rollback2 = rollbackGenerationApply(root, result.rollbackId)
      expect(snapshot(root)).toEqual(before)
      expect(rollback2.restoredFiles.length).toBe(rollback1.restoredFiles.length)
    })
  })
})
