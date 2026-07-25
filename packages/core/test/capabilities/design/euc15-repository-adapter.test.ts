/**
 * EUC-15 — Repository and process adapters.
 * Acceptance from docs/use-case-led-workflow/SPECIFICATION.md §11.6, §12.2,
 * §19 ("MATLAB timeout", "Apply failure", "Verification command timeout"),
 * §20.1, §20.2, §25.3 (EUC-15).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applyDeltaTransactionally,
  processIsolationGuard,
  readOwnershipManifest,
  readScopedContext,
  rollback,
  runConfiguredCommand,
  workspaceRevision,
} from '../../../src/capabilities/design/repositoryAdapter.js'
import { buildApplyPlan, validateReturnedDelta } from '../../../src/capabilities/design/deltaInspector.js'
import { sha256Hex } from '../../../src/capabilities/hash.js'
import type { ModuleImplementationPacket, ReturnedDelta } from '../../../src/capabilities/design/records.js'

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'euik-euc15-'))
}

function writeFile(root: string, relPath: string, content: string): void {
  const abs = path.join(root, relPath)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content)
}

function readFile(root: string, relPath: string): string {
  return fs.readFileSync(path.join(root, relPath), 'utf8')
}

function exists(root: string, relPath: string): boolean {
  return fs.existsSync(path.join(root, relPath))
}

/** Recursively snapshots every file (excluding adapter-internal files) as relPath -> content. */
function snapshotFiles(root: string, subDir: string): Record<string, string> {
  const out: Record<string, string> = {}
  const visit = (dir: string, rel: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absChild = path.join(dir, entry.name)
      const relChild = rel ? `${rel}/${entry.name}` : entry.name
      if (entry.isDirectory()) visit(absChild, relChild)
      else if (entry.isFile()) out[relChild] = fs.readFileSync(absChild, 'utf8')
    }
  }
  const start = path.join(root, subDir)
  if (fs.existsSync(start)) visit(start, subDir)
  return out
}

function packetFixture(overrides: Partial<ModuleImplementationPacket> = {}): ModuleImplementationPacket {
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
    allowedPaths: ['module'],
    forbiddenPaths: ['**'],
    editableSharedPaths: [],
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

function deltaFixture(overrides: Partial<ReturnedDelta> = {}): ReturnedDelta {
  return {
    schemaVersion: '1.0',
    deltaId: 'delta-1',
    packetId: 'packet-1',
    baseRevision: 'base-rev',
    baseHash: 'base-rev',
    fileChanges: [],
    recordChanges: [],
    testResults: [{ command: 'npm test', passed: true, summary: 'all green' }],
    assumptions: [],
    unresolvedIssues: [],
    requestedScopeChanges: [],
    evidenceFiles: [],
    returnedAt: '2026-01-01T00:00:00.000Z',
    contentHash: 'delta-hash',
    ...overrides,
  }
}

/** Builds an accepted plan for the given file changes against the current on-disk state of `touchedPaths`. */
function buildPlanForChanges(
  root: string,
  planId: string,
  fileChanges: ReturnedDelta['fileChanges'],
  touchedPaths: string[],
) {
  const revisionAtInspection = workspaceRevision(root, touchedPaths)
  const delta = deltaFixture({
    fileChanges,
    baseRevision: revisionAtInspection,
    baseHash: revisionAtInspection,
  })
  const packet = packetFixture()
  const approvedDeletes = fileChanges.filter((c) => c.action === 'delete').map((c) => c.path)
  const inspection = validateReturnedDelta(delta, packet, {
    workspaceRevision: revisionAtInspection,
    workspaceHash: revisionAtInspection,
    approvedDeletes,
  })
  expect(inspection.accepted).toBe(true)
  const plan = buildApplyPlan(inspection, delta, { planId, backupRef: `backup:${planId}` })
  return { delta, inspection, plan, revisionAtInspection }
}

// ---------------------------------------------------------------------------
// readScopedContext (§20.1, §20.2)
// ---------------------------------------------------------------------------

describe('readScopedContext', () => {
  it('rejects an absolute include path', () => {
    const root = tmpDir()
    expect(() => readScopedContext({ root, includePaths: ['/etc/passwd'] })).toThrow()
  })

  it('rejects a traversal include path', () => {
    const root = tmpDir()
    expect(() => readScopedContext({ root, includePaths: ['../outside'] })).toThrow()
  })

  it('rejects a symlink escape (a real symlink pointing outside root)', () => {
    const root = tmpDir()
    const outside = tmpDir()
    writeFile(outside, 'secret.txt', 'do not read me')
    fs.symlinkSync(outside, path.join(root, 'escape'), 'dir')

    expect(() => readScopedContext({ root, includePaths: ['escape'] })).toThrow()
  })

  it('never follows a nested symlink to content outside root during a directory scan', () => {
    const root = tmpDir()
    const outside = tmpDir()
    writeFile(outside, 'secret.txt', 'do not read me')
    writeFile(root, 'src/a.ts', 'export const a = 1\n')
    fs.symlinkSync(outside, path.join(root, 'src', 'escape'), 'dir')

    const candidates = readScopedContext({ root, includePaths: ['src'] })
    expect(candidates.map((c) => c.ref)).toEqual(['src/a.ts'])
    expect(candidates.some((c) => c.content.includes('do not read me'))).toBe(false)
  })

  it('is read-only: the source tree is byte-identical before and after', () => {
    const root = tmpDir()
    writeFile(root, 'src/a.ts', 'export const a = 1\n')
    writeFile(root, 'src/nested/b.ts', 'export const b = 2\n')
    const before = snapshotFiles(root, 'src')

    readScopedContext({ root, includePaths: ['src'] })

    const after = snapshotFiles(root, 'src')
    expect(after).toEqual(before)
  })

  it('produces deterministic, stably ordered candidates', () => {
    const root = tmpDir()
    writeFile(root, 'src/nested/b.ts', 'export const b = 2\n')
    writeFile(root, 'src/a.ts', 'export const a = 1\n')

    const first = readScopedContext({ root, includePaths: ['src'] })
    const second = readScopedContext({ root, includePaths: ['src'] })

    expect(first).toEqual(second)
    expect(first.map((c) => c.ref)).toEqual(['src/a.ts', 'src/nested/b.ts'])
    for (const candidate of first) {
      expect(candidate.kind).toBe('source')
      expect(candidate.contentHash).toBe(sha256Hex(candidate.content))
      expect(candidate.bytes).toBe(Buffer.byteLength(candidate.content, 'utf8'))
    }
  })

  it('excludes files matching an excluded pattern', () => {
    const root = tmpDir()
    writeFile(root, 'src/a.ts', 'export const a = 1\n')
    writeFile(root, 'src/a.test.ts', 'test content\n')

    const candidates = readScopedContext({ root, includePaths: ['src'], excludedPatterns: ['\\.test\\.ts$'] })
    expect(candidates.map((c) => c.ref)).toEqual(['src/a.ts'])
  })
})

// ---------------------------------------------------------------------------
// workspaceRevision (§11.6, §12.2)
// ---------------------------------------------------------------------------

describe('workspaceRevision', () => {
  it('is deterministic across repeated calls with no mutation', () => {
    const root = tmpDir()
    writeFile(root, 'module/a.txt', 'alpha')
    writeFile(root, 'module/b.txt', 'beta')

    const first = workspaceRevision(root, ['module'])
    const second = workspaceRevision(root, ['module'])
    expect(first).toBe(second)
  })

  it('changes when a tracked file changes and is stable when unrelated files change', () => {
    const root = tmpDir()
    writeFile(root, 'module/a.txt', 'alpha')
    const before = workspaceRevision(root, ['module/a.txt'])

    writeFile(root, 'module/unrelated.txt', 'unrelated')
    const afterUnrelated = workspaceRevision(root, ['module/a.txt'])
    expect(afterUnrelated).toBe(before)

    writeFile(root, 'module/a.txt', 'alpha-changed')
    const afterChange = workspaceRevision(root, ['module/a.txt'])
    expect(afterChange).not.toBe(before)
  })

  it('distinguishes a missing path from an existing one', () => {
    const root = tmpDir()
    const missing = workspaceRevision(root, ['module/never-created.txt'])
    writeFile(root, 'module/never-created.txt', 'now it exists')
    const present = workspaceRevision(root, ['module/never-created.txt'])
    expect(missing).not.toBe(present)
  })
})

// ---------------------------------------------------------------------------
// applyDeltaTransactionally (§12.2, §19 "Apply failure")
// ---------------------------------------------------------------------------

describe('applyDeltaTransactionally', () => {
  it('applies create + change + delete together, updates ownership, and preserves unrelated files', () => {
    const root = tmpDir()
    writeFile(root, 'module/keep.txt', 'keep me untouched')
    writeFile(root, 'module/change-me.txt', 'original content')
    writeFile(root, 'module/delete-me.txt', 'to be removed')
    const keepBefore = readFile(root, 'module/keep.txt')

    const fileChanges: ReturnedDelta['fileChanges'] = [
      { path: 'module/create-me.txt', action: 'create', content: 'created content', contentHash: sha256Hex('created content') },
      { path: 'module/change-me.txt', action: 'change', content: 'changed content', contentHash: sha256Hex('changed content') },
      { path: 'module/delete-me.txt', action: 'delete' },
    ]
    const { delta, plan } = buildPlanForChanges(root, 'plan-happy', fileChanges, [
      'module/create-me.txt',
      'module/change-me.txt',
      'module/delete-me.txt',
    ])

    const result = applyDeltaTransactionally(plan, delta, root)

    expect(result.applied).toBe(true)
    expect(result.rolledBack).toBe(false)
    expect(result.appliedFiles.sort()).toEqual(['module/change-me.txt', 'module/create-me.txt', 'module/delete-me.txt'].sort())
    expect(readFile(root, 'module/create-me.txt')).toBe('created content')
    expect(readFile(root, 'module/change-me.txt')).toBe('changed content')
    expect(exists(root, 'module/delete-me.txt')).toBe(false)
    expect(readFile(root, 'module/keep.txt')).toBe(keepBefore)

    const ownership = readOwnershipManifest(root)
    expect(ownership).toBeDefined()
    const byPath = new Map(ownership!.entries.map((e) => [e.path, e]))
    expect(byPath.get('module/create-me.txt')?.contentHash).toBe(sha256Hex('created content'))
    expect(byPath.get('module/change-me.txt')?.contentHash).toBe(sha256Hex('changed content'))
    expect(byPath.get('module/change-me.txt')?.sourcePacketId).toBe(delta.packetId)
    expect(byPath.has('module/delete-me.txt')).toBe(false)
  })

  it('rolls back completely when a delete target is missing mid-apply, preserving diagnostics', () => {
    const root = tmpDir()
    writeFile(root, 'module/existing.txt', 'original')
    const before = snapshotFiles(root, 'module')

    const fileChanges: ReturnedDelta['fileChanges'] = [
      { path: 'module/existing.txt', action: 'change', content: 'changed', contentHash: sha256Hex('changed') },
      { path: 'module/never-existed.txt', action: 'delete' },
    ]
    const { delta, plan } = buildPlanForChanges(root, 'plan-missing-delete', fileChanges, [
      'module/existing.txt',
      'module/never-existed.txt',
    ])

    const result = applyDeltaTransactionally(plan, delta, root)

    expect(result.applied).toBe(false)
    expect(result.rolledBack).toBe(true)
    expect(result.appliedFiles).toEqual([])
    expect(result.failure).toBeTruthy()

    const after = snapshotFiles(root, 'module')
    expect(after).toEqual(before)
  })

  it('rolls back completely on an induced mid-apply failure (failAfter test hook)', () => {
    const root = tmpDir()
    writeFile(root, 'module/first.txt', 'first-original')
    writeFile(root, 'module/second.txt', 'second-original')
    const before = snapshotFiles(root, 'module')

    const fileChanges: ReturnedDelta['fileChanges'] = [
      { path: 'module/first.txt', action: 'change', content: 'first-changed', contentHash: sha256Hex('first-changed') },
      { path: 'module/second.txt', action: 'change', content: 'second-changed', contentHash: sha256Hex('second-changed') },
    ]
    const { delta, plan } = buildPlanForChanges(root, 'plan-fail-after', fileChanges, ['module/first.txt', 'module/second.txt'])

    const result = applyDeltaTransactionally(plan, delta, root, { failAfter: 1 })

    expect(result.applied).toBe(false)
    expect(result.rolledBack).toBe(true)
    expect(result.appliedFiles).toEqual([])
    expect(result.failure).toContain('induced apply failure')

    const after = snapshotFiles(root, 'module')
    expect(after).toEqual(before)
  })

  it('refuses to apply when the workspace changed since inspection (stale revision)', () => {
    const root = tmpDir()
    writeFile(root, 'module/tracked.txt', 'original')

    const fileChanges: ReturnedDelta['fileChanges'] = [
      { path: 'module/tracked.txt', action: 'change', content: 'changed', contentHash: sha256Hex('changed') },
    ]
    const { delta, plan } = buildPlanForChanges(root, 'plan-stale', fileChanges, ['module/tracked.txt'])

    // The workspace changes after inspection built the plan.
    writeFile(root, 'module/tracked.txt', 'mutated out from under the plan')

    const result = applyDeltaTransactionally(plan, delta, root)

    expect(result.applied).toBe(false)
    expect(result.rolledBack).toBe(false)
    expect(result.failure).toMatch(/stale workspace revision/)
    expect(readFile(root, 'module/tracked.txt')).toBe('mutated out from under the plan')
  })

  it('refuses to apply when the inspected delta hash no longer matches', () => {
    const root = tmpDir()
    writeFile(root, 'module/tracked.txt', 'original')

    const fileChanges: ReturnedDelta['fileChanges'] = [
      { path: 'module/tracked.txt', action: 'change', content: 'changed', contentHash: sha256Hex('changed') },
    ]
    const { delta, plan } = buildPlanForChanges(root, 'plan-hash-mismatch', fileChanges, ['module/tracked.txt'])

    const mutatedDelta: ReturnedDelta = { ...delta, assumptions: ['a late assumption that was not inspected'] }

    const result = applyDeltaTransactionally(plan, mutatedDelta, root)

    expect(result.applied).toBe(false)
    expect(result.rolledBack).toBe(false)
    expect(result.failure).toMatch(/inspected delta hash mismatch/)
    expect(readFile(root, 'module/tracked.txt')).toBe('original')
  })

  it('supports an explicit rollback after a successful apply', () => {
    const root = tmpDir()
    writeFile(root, 'module/change-me.txt', 'original content')

    const fileChanges: ReturnedDelta['fileChanges'] = [
      { path: 'module/create-me.txt', action: 'create', content: 'created content', contentHash: sha256Hex('created content') },
      { path: 'module/change-me.txt', action: 'change', content: 'changed content', contentHash: sha256Hex('changed content') },
    ]
    const { delta, plan } = buildPlanForChanges(root, 'plan-explicit-rollback', fileChanges, [
      'module/create-me.txt',
      'module/change-me.txt',
    ])

    const applied = applyDeltaTransactionally(plan, delta, root)
    expect(applied.applied).toBe(true)
    expect(exists(root, 'module/create-me.txt')).toBe(true)

    rollback('plan-explicit-rollback', root)

    expect(exists(root, 'module/create-me.txt')).toBe(false)
    expect(readFile(root, 'module/change-me.txt')).toBe('original content')
    expect(readOwnershipManifest(root)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// processIsolationGuard (§20.2)
// ---------------------------------------------------------------------------

describe('processIsolationGuard', () => {
  it('rejects a cwd outside the repository root', () => {
    const root = tmpDir()
    const outside = tmpDir()
    const result = processIsolationGuard({ root, cwd: outside })
    expect(result.ok).toBe(false)
  })

  it('builds an explicit environment from an allowlist rather than inheriting the parent environment', () => {
    const root = tmpDir()
    process.env.EUIK_TEST_UNLISTED_SECRET = 'super-secret-value'
    process.env.EUIK_TEST_ALLOWED = 'allowed-value'
    try {
      const result = processIsolationGuard({ root, cwd: root, envAllowlist: ['EUIK_TEST_ALLOWED'] })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.env.EUIK_TEST_ALLOWED).toBe('allowed-value')
        expect(result.env.EUIK_TEST_UNLISTED_SECRET).toBeUndefined()
      }
    } finally {
      delete process.env.EUIK_TEST_UNLISTED_SECRET
      delete process.env.EUIK_TEST_ALLOWED
    }
  })
})

// ---------------------------------------------------------------------------
// runConfiguredCommand (§19 "Verification command timeout", §20.2)
// ---------------------------------------------------------------------------

describe('runConfiguredCommand', () => {
  it('rejects a command that is not in the configured allowlist', async () => {
    const root = tmpDir()
    await expect(
      runConfiguredCommand({
        command: 'not-an-allowed-command',
        args: [],
        cwd: root,
        timeoutMs: 1000,
        allowedCommands: ['echo'],
      }),
    ).rejects.toThrow()
  })

  it('captures the exit code of a configured command', async () => {
    const root = tmpDir()
    const result = await runConfiguredCommand({
      command: process.execPath,
      args: ['-e', 'process.exit(3)'],
      cwd: root,
      timeoutMs: 5000,
      allowedCommands: [process.execPath],
    })
    expect(result.exitCode).toBe(3)
    expect(result.timedOut).toBe(false)
    expect(result.cancelled).toBe(false)
  })

  it('captures stdout from a configured command', async () => {
    const root = tmpDir()
    const result = await runConfiguredCommand({
      command: process.execPath,
      args: ['-e', "process.stdout.write('hello-from-child')"],
      cwd: root,
      timeoutMs: 5000,
      allowedCommands: [process.execPath],
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('hello-from-child')
  })

  it('stops a command that exceeds its timeout and records timedOut', async () => {
    const root = tmpDir()
    const result = await runConfiguredCommand({
      command: process.execPath,
      args: ['-e', 'setTimeout(() => {}, 5000)'],
      cwd: root,
      timeoutMs: 200,
      allowedCommands: [process.execPath],
    })
    expect(result.timedOut).toBe(true)
    expect(result.cancelled).toBe(false)
    expect(result.exitCode).toBeNull()
  }, 10000)

  it('respects an explicit cancellation flag', async () => {
    const root = tmpDir()
    const cancellation = { cancelled: false }
    const promise = runConfiguredCommand({
      command: process.execPath,
      args: ['-e', 'setTimeout(() => {}, 5000)'],
      cwd: root,
      timeoutMs: 10_000,
      allowedCommands: [process.execPath],
      cancellation,
    })
    setTimeout(() => {
      cancellation.cancelled = true
    }, 100)
    const result = await promise
    expect(result.cancelled).toBe(true)
    expect(result.timedOut).toBe(false)
    expect(result.durationMs).toBeLessThan(5000)
  }, 10000)
})
