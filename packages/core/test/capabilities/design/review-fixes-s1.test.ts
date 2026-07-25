/**
 * Review-fixes S1 — filesystem-safety P1 finding
 * (`packages/core/src/capabilities/design/repositoryAdapter.ts` ~254-268,
 * 410-420, 461).
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §12.2,
 * §20.2.
 *
 * The finding (reviewer run-confirmed): delta file write targets got a
 * containment check, but `design-ownership.json` — a product control file —
 * was read and written without resolving or rejecting symlinks. A repo
 * where `design-ownership.json` is a symlink to an external file got that
 * external file silently overwritten by an otherwise-valid apply.
 *
 * This file reproduces the reviewer scenario end to end:
 *  - `design-ownership.json` symlinked to an outside file -> the apply is
 *    rejected (rolled back), and the external file is byte-identical
 *    before and after;
 *  - a delta target replaced by a symlink after inspection (before apply)
 *    is rejected, whether or not the symlink resolves inside the root;
 *  - `.euik-design-backups` replaced by a symlink escaping the root is
 *    rejected before anything is touched;
 *  - a normal apply, with no symlinks anywhere, still succeeds exactly as
 *    before.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applyDeltaTransactionally,
  readOwnershipManifest,
  workspaceRevision,
} from '../../../src/capabilities/design/repositoryAdapter.js'
import { buildApplyPlan, validateReturnedDelta } from '../../../src/capabilities/design/deltaInspector.js'
import { sha256Hex } from '../../../src/capabilities/hash.js'
import type { ModuleImplementationPacket, ReturnedDelta } from '../../../src/capabilities/design/records.js'

function tmpDir(prefix = 'euik-s1-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

function writeFile(root: string, relPath: string, content: string): void {
  const abs = path.join(root, relPath)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content)
}

function readFile(root: string, relPath: string): string {
  return fs.readFileSync(path.join(root, relPath), 'utf8')
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
function buildPlanForChanges(root: string, planId: string, fileChanges: ReturnedDelta['fileChanges'], touchedPaths: string[]) {
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
  return { delta, plan, revisionAtInspection }
}

describe('review-fixes-s1 — applyDeltaTransactionally symlink safety (§12.2)', () => {
  it('rejects (and rolls back) an apply when design-ownership.json is a symlink to an outside file, leaving that file byte-identical', () => {
    const root = tmpDir()
    const outside = tmpDir('euik-s1-outside-')
    const outsideFile = path.join(outside, 'external-ownership.json')
    const externalContent = '{"not":"ours"}'
    fs.writeFileSync(outsideFile, externalContent)
    fs.symlinkSync(outsideFile, path.join(root, 'design-ownership.json'))

    const fileChanges: ReturnedDelta['fileChanges'] = [
      { path: 'module/create-me.txt', action: 'create', content: 'created content', contentHash: sha256Hex('created content') },
    ]
    const { delta, plan } = buildPlanForChanges(root, 'plan-symlinked-ownership', fileChanges, ['module/create-me.txt'])

    const result = applyDeltaTransactionally(plan, delta, root)

    expect(result.applied).toBe(false)
    expect(result.rolledBack).toBe(true)
    expect(result.failure).toMatch(/symbolic link/)

    // The external file was never overwritten.
    expect(fs.readFileSync(outsideFile, 'utf8')).toBe(externalContent)
    // The symlink itself was not replaced or removed.
    expect(fs.lstatSync(path.join(root, 'design-ownership.json')).isSymbolicLink()).toBe(true)
    // The delta content change was rolled back too (all-or-nothing).
    expect(fs.existsSync(path.join(root, 'module/create-me.txt'))).toBe(false)
  })

  it('rejects reading an ownership manifest that is a symlink', () => {
    const root = tmpDir()
    const outside = tmpDir('euik-s1-outside-')
    const outsideFile = path.join(outside, 'external-ownership.json')
    fs.writeFileSync(outsideFile, '{"schemaVersion":"1.0","entries":[]}')
    fs.symlinkSync(outsideFile, path.join(root, 'design-ownership.json'))

    expect(() => readOwnershipManifest(root)).toThrow(/symbolic link/)
  })

  it('rejects an apply when a delta target is replaced by a symlink after inspection (pointing inside the root)', () => {
    const root = tmpDir()
    // Both files share identical content so that swapping the target for a
    // symlink to the decoy leaves the content-derived workspace revision
    // unchanged — proving the rejection comes from the dedicated symlink
    // guard, not incidentally from the (also-present) staleness check.
    writeFile(root, 'module/target.txt', 'shared-content')
    writeFile(root, 'module/decoy.txt', 'shared-content')

    const fileChanges: ReturnedDelta['fileChanges'] = [
      { path: 'module/target.txt', action: 'change', content: 'changed content', contentHash: sha256Hex('changed content') },
    ]
    const { delta, plan } = buildPlanForChanges(root, 'plan-target-symlinked', fileChanges, ['module/target.txt'])

    // The workspace-revision and delta-hash checks only cover the touched
    // paths' *content* hash at inspection time; a symlink planted at the
    // target after inspection, before apply, must still be caught here,
    // even when the symlink resolves to content with the same hash.
    fs.rmSync(path.join(root, 'module/target.txt'))
    fs.symlinkSync(path.join(root, 'module/decoy.txt'), path.join(root, 'module/target.txt'))

    const result = applyDeltaTransactionally(plan, delta, root)

    expect(result.applied).toBe(false)
    expect(result.rolledBack).toBe(true)
    expect(result.failure).toMatch(/symbolic link/)
    // The symlink was not followed: the in-root decoy it points to was
    // never overwritten.
    expect(readFile(root, 'module/decoy.txt')).toBe('shared-content')
    expect(fs.lstatSync(path.join(root, 'module/target.txt')).isSymbolicLink()).toBe(true)
  })

  it('rejects an apply when a delta target is replaced by a symlink escaping the root after inspection', () => {
    const root = tmpDir()
    const outside = tmpDir('euik-s1-outside-')
    const outsideFile = path.join(outside, 'secret.txt')
    // Same content-matching trick as above, but the symlink points outside
    // the repository root entirely.
    writeFile(root, 'module/target.txt', 'shared-content')
    fs.writeFileSync(outsideFile, 'shared-content')

    const fileChanges: ReturnedDelta['fileChanges'] = [
      { path: 'module/target.txt', action: 'change', content: 'attacker-controlled content', contentHash: sha256Hex('attacker-controlled content') },
    ]
    const { delta, plan } = buildPlanForChanges(root, 'plan-target-escape', fileChanges, ['module/target.txt'])

    fs.rmSync(path.join(root, 'module/target.txt'))
    fs.symlinkSync(outsideFile, path.join(root, 'module/target.txt'))

    const result = applyDeltaTransactionally(plan, delta, root)

    // This particular case is caught even earlier than the mid-apply
    // symlink guard: normalizing `plan.orderedChanges` at the top of
    // `applyDeltaTransactionally` already resolves the real path of each
    // target, and a symlink resolving outside the root fails that
    // pre-existing containment check before anything (including a backup)
    // is touched.
    expect(result.applied).toBe(false)
    expect(result.rolledBack).toBe(false)
    expect(result.failure).toMatch(/escapes the repository root/)
    expect(fs.readFileSync(outsideFile, 'utf8')).toBe('shared-content')
  })

  it('rejects an apply when .euik-design-backups is replaced by a symlink escaping the root', () => {
    const root = tmpDir()
    const outside = tmpDir('euik-s1-outside-')

    const fileChanges: ReturnedDelta['fileChanges'] = [
      { path: 'module/create-me.txt', action: 'create', content: 'created content', contentHash: sha256Hex('created content') },
    ]
    const { delta, plan } = buildPlanForChanges(root, 'plan-backup-dir-symlinked', fileChanges, ['module/create-me.txt'])

    fs.symlinkSync(outside, path.join(root, '.euik-design-backups'), 'dir')

    const result = applyDeltaTransactionally(plan, delta, root)

    expect(result.applied).toBe(false)
    expect(result.rolledBack).toBe(false) // nothing was touched yet
    expect(result.failure).toBeTruthy()
    // Nothing was written into the outside directory the backup symlink
    // pointed at.
    expect(fs.readdirSync(outside)).toEqual([])
    // Nor was the delta target created.
    expect(fs.existsSync(path.join(root, 'module/create-me.txt'))).toBe(false)
  })

  it('applies normally when nothing is symlinked (no regression)', () => {
    const root = tmpDir()
    writeFile(root, 'module/keep.txt', 'keep me untouched')

    const fileChanges: ReturnedDelta['fileChanges'] = [
      { path: 'module/create-me.txt', action: 'create', content: 'created content', contentHash: sha256Hex('created content') },
    ]
    const { delta, plan } = buildPlanForChanges(root, 'plan-happy-s1', fileChanges, ['module/create-me.txt'])

    const result = applyDeltaTransactionally(plan, delta, root)

    expect(result.applied).toBe(true)
    expect(result.rolledBack).toBe(false)
    expect(readFile(root, 'module/create-me.txt')).toBe('created content')
    expect(readFile(root, 'module/keep.txt')).toBe('keep me untouched')

    const ownership = readOwnershipManifest(root)
    expect(ownership).toBeDefined()
    expect(fs.lstatSync(path.join(root, 'design-ownership.json')).isSymbolicLink()).toBe(false)
  })
})
