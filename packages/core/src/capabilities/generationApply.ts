/**
 * Transactional staging/apply/rollback for a `GenerationPlan` (CAP-ERA-001
 * §9 CAP-CONTRACT-025, §11.3 apply protocol).
 *
 * This module mutates a target repository on disk and is therefore
 * Node-only (`node:fs`/`node:path`) — unlike `generation/*` (which stays
 * `node:*`-free so it can bundle into the renderer), it lives directly under
 * `capabilities/` alongside `overlay.ts`/`persistence.ts` and is exported
 * only from `capabilities/index.ts`, never `browser.ts`.
 *
 * Protocol (exactly): revalidate (refuse, change nothing, on any problem) ->
 * stage postimages under a private `.engineering-ui/capabilities/staging/<runId>`
 * directory -> self-validate the staged bytes -> snapshot every file that is
 * about to be overwritten/deleted into a rollback bundle + journal -> apply
 * every change with `fs.renameSync` (atomic on the same filesystem) -> on ANY
 * error mid-apply, restore every already-applied change from the rollback
 * bundle so the target returns to its exact pre-apply state, then re-throw.
 * `plan.commands` are returned, never executed, here.
 */

import fs from 'node:fs'
import path from 'node:path'
import { canonicalRecordHash } from './hash.js'
import { isRealPathWithinProjectRoot } from './filesystem.js'
import { toPosixPath } from './generation/paths.js'
import type { FileChangeAction, GeneratedOwnershipManifest, GenerationFileChange, GenerationPlan } from './types.js'

/** A virtual (in-memory) generated file supplied by the caller for this apply. */
export type GenerationApplyVirtualFile = { path: string; contents: string }

export type ApplyGenerationPlanInput = {
  plan: GenerationPlan
  targetRoot: string
  virtualFiles: GenerationApplyVirtualFile[]
  /**
   * Previously recorded ownership manifests (CAP-CONTRACT-026), used to
   * refuse regenerating a `generated`-ownership file that was hand-edited
   * since it was last applied (MODIFIED-GENERATED).
   */
  ownershipManifest?: GeneratedOwnershipManifest[]
  acceptDirtyWorktree?: boolean
  /**
   * Deterministic run identity. Not part of the abbreviated §11.3 signature
   * sketch but required for a deterministic, test-injectable staging/rollback
   * directory name (`.../staging/<runId>`, `.../rollback/<runId>`) — see
   * HANDOFF "signature completion" note. Must be a plain identifier (no path
   * separators or traversal).
   */
  runId: string
  now?: () => Date
}

export type AppliedFileRecord = { path: string; action: FileChangeAction; sizeBytes: number }

export type ApplyGenerationPlanResult = {
  runId: string
  appliedFiles: AppliedFileRecord[]
  rollbackId: string
  commands: string[]
  /** Repo-relative path -> resulting content hash, for every applied create/update. */
  resultingHashes: Record<string, string>
}

export type RollbackRestoredRecord = { path: string; action: 'restored' | 'removed'; sizeBytes: number }

export type RollbackGenerationApplyResult = {
  rollbackId: string
  restoredFiles: RollbackRestoredRecord[]
}

/** Thrown when revalidation refuses the plan; nothing on disk is touched. */
export class GenerationApplyRefusedError extends Error {
  constructor(readonly issues: string[]) {
    super(`generation apply refused (${issues.length} issue(s)):\n${issues.map((i) => `- ${i}`).join('\n')}`)
    this.name = 'GenerationApplyRefusedError'
  }
}

/**
 * Thrown when an error occurs mid-apply. By the time this is thrown, every
 * already-applied change has been restored from the rollback bundle, so the
 * target is back to its exact pre-apply state.
 */
export class GenerationApplyRolledBackError extends Error {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super(`generation apply failed and was fully rolled back: ${message}`, options)
    this.name = 'GenerationApplyRolledBackError'
  }
}

function textHash(content: string): string {
  return canonicalRecordHash(content)
}

function byteSize(content: string): number {
  return Buffer.byteLength(content, 'utf8')
}

const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

function capabilitiesDotDir(targetRootAbs: string): string {
  return path.join(targetRootAbs, '.engineering-ui', 'capabilities')
}

function stagingRoot(targetRootAbs: string, runId: string): string {
  return path.join(capabilitiesDotDir(targetRootAbs), 'staging', runId)
}

function rollbackRoot(targetRootAbs: string, runId: string): string {
  return path.join(capabilitiesDotDir(targetRootAbs), 'rollback', runId)
}

function isPosixOrWindowsAbsolute(value: string): boolean {
  return value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value) || value.startsWith('\\\\')
}

/** Normalize + reject an unsafe repo-relative path. Never touches disk. */
function normalizeChangePath(rawPath: string): { ok: true; path: string } | { ok: false; reason: string } {
  if (typeof rawPath !== 'string' || rawPath.length === 0) {
    return { ok: false, reason: `file change path "${String(rawPath)}" is empty` }
  }
  if (rawPath.includes('\0')) {
    return { ok: false, reason: `file change path "${rawPath}" contains a null byte` }
  }
  if (isPosixOrWindowsAbsolute(rawPath)) {
    return { ok: false, reason: `file change path "${rawPath}" is absolute; only repo-relative paths are allowed` }
  }
  const normalized = toPosixPath(rawPath)
  if (normalized === '.' || normalized === '') {
    return { ok: false, reason: `file change path "${rawPath}" does not name a file` }
  }
  if (normalized.split('/').some((segment) => segment === '..')) {
    return { ok: false, reason: `file change path "${rawPath}" contains ".." traversal` }
  }
  return { ok: true, path: normalized }
}

/** Resolve `relPath` under `targetRootAbs`, refusing traversal and symlink escape. */
function resolveInsideTarget(
  targetRootAbs: string,
  rawPath: string,
): { ok: true; relPath: string; absPath: string } | { ok: false; reason: string } {
  const normalized = normalizeChangePath(rawPath)
  if (!normalized.ok) return normalized
  const absPath = path.resolve(targetRootAbs, normalized.path)
  const rootResolved = path.resolve(targetRootAbs)
  if (absPath !== rootResolved && !absPath.startsWith(rootResolved + path.sep)) {
    return { ok: false, reason: `file change path "${rawPath}" resolves outside targetRoot` }
  }
  if (!isRealPathWithinProjectRoot(targetRootAbs, absPath)) {
    return { ok: false, reason: `file change path "${rawPath}" escapes targetRoot via a symlink` }
  }
  return { ok: true, relPath: normalized.path, absPath }
}

function readCurrentHash(absPath: string): string | undefined {
  if (!fs.existsSync(absPath)) return undefined
  if (!fs.statSync(absPath).isFile()) return undefined
  return textHash(fs.readFileSync(absPath, 'utf8'))
}

type ResolvedChange = {
  change: GenerationFileChange
  relPath: string
  absPath: string
}

type ValidatedPlan = {
  resolved: ResolvedChange[]
  virtualByPath: Map<string, string>
}

function revalidate(input: ApplyGenerationPlanInput, targetRootAbs: string): ValidatedPlan {
  const issues: string[] = []

  for (const blocker of input.plan.blockers) {
    issues.push(`PLAN-BLOCKER: ${blocker}`)
  }
  for (const ambiguity of input.plan.ambiguityQuestions) {
    issues.push(`PLAN-AMBIGUITY: ${ambiguity.question} (${ambiguity.choices.join(', ')})`)
  }

  if (!RUN_ID_PATTERN.test(input.runId)) {
    issues.push(`runId "${input.runId}" must be a non-empty identifier with no path separators`)
  }

  if (!fs.existsSync(targetRootAbs) || !fs.statSync(targetRootAbs).isDirectory()) {
    issues.push(`targetRoot "${input.targetRoot}" does not exist or is not a directory`)
    // Nothing else can be meaningfully validated without a real targetRoot.
    throw new GenerationApplyRefusedError(issues)
  }

  if (input.plan.targetRepository.cleanState === 'dirty' && !input.acceptDirtyWorktree) {
    issues.push(
      `plan.targetRepository.cleanState is "dirty"; pass acceptDirtyWorktree: true to apply anyway`,
    )
  }

  const virtualByPath = new Map<string, string>()
  for (const file of input.virtualFiles) {
    const normalized = normalizeChangePath(file.path)
    if (!normalized.ok) {
      issues.push(`virtualFiles: ${normalized.reason}`)
      continue
    }
    if (virtualByPath.has(normalized.path)) {
      issues.push(`virtualFiles contains duplicate path "${normalized.path}"`)
      continue
    }
    virtualByPath.set(normalized.path, file.contents)
  }

  const ownershipByPath = new Map<string, GeneratedOwnershipManifest>()
  for (const manifest of input.ownershipManifest ?? []) {
    const normalized = normalizeChangePath(manifest.filePath)
    if (normalized.ok) ownershipByPath.set(normalized.path, manifest)
  }

  const resolved: ResolvedChange[] = []

  for (const change of input.plan.fileChanges) {
    const location = resolveInsideTarget(targetRootAbs, change.path)
    if (!location.ok) {
      issues.push(location.reason)
      continue
    }
    const { relPath, absPath } = location

    if (change.action === 'update' || change.action === 'delete') {
      if (change.preimageHash === undefined) {
        issues.push(`"${relPath}" (${change.action}): fileChange is missing preimageHash`)
      } else {
        const currentHash = readCurrentHash(absPath)
        if (currentHash === undefined) {
          issues.push(
            `STALE-PREIMAGE: "${relPath}" (${change.action}) does not exist on disk but a preimageHash was expected`,
          )
        } else if (currentHash !== change.preimageHash) {
          issues.push(
            `STALE-PREIMAGE: "${relPath}" (${change.action}) on-disk hash does not match the plan's preimageHash`,
          )
        }
      }
    }

    if (change.action === 'update' && change.ownership === 'generated') {
      const manifest = ownershipByPath.get(relPath)
      if (manifest) {
        const currentHash = readCurrentHash(absPath)
        if (currentHash !== undefined && currentHash !== manifest.contentHash) {
          issues.push(
            `MODIFIED-GENERATED: "${relPath}" was changed since it was last generated `
              + `(on-disk hash does not match the recorded ownership manifest hash)`,
          )
        }
      }
    }

    if (change.action === 'create' || change.action === 'update') {
      if (change.postimageHash === undefined) {
        issues.push(`"${relPath}" (${change.action}): fileChange is missing postimageHash`)
      } else {
        const virtualContent = virtualByPath.get(relPath)
        if (virtualContent === undefined) {
          issues.push(`"${relPath}" (${change.action}): no matching entry in virtualFiles`)
        } else if (textHash(virtualContent) !== change.postimageHash) {
          issues.push(`"${relPath}" (${change.action}): virtualFiles content hash does not match postimageHash`)
        }
      }
    }

    resolved.push({ change, relPath, absPath })
  }

  if (issues.length > 0) {
    throw new GenerationApplyRefusedError(issues)
  }

  return { resolved, virtualByPath }
}

type JournalEntry = {
  path: string
  action: FileChangeAction
  hadPreimage: boolean
}

type RollbackJournal = {
  runId: string
  planHash: string
  timestamp: string
  changes: JournalEntry[]
}

function journalPath(rollbackRootAbs: string): string {
  return path.join(rollbackRootAbs, 'journal.json')
}

function preimageStoragePath(rollbackRootAbs: string, relPath: string): string {
  return path.join(rollbackRootAbs, 'files', relPath)
}

function removeDirIfEmpty(dirAbs: string, stopAtAbs: string): void {
  let current = dirAbs
  const stop = path.resolve(stopAtAbs)
  while (path.resolve(current) !== stop && current.startsWith(stop + path.sep)) {
    let entries: string[]
    try {
      entries = fs.readdirSync(current)
    } catch {
      return
    }
    if (entries.length > 0) return
    try {
      fs.rmdirSync(current)
    } catch {
      return
    }
    current = path.dirname(current)
  }
}

/**
 * Apply a `GenerationPlan` (CAP-CONTRACT-025) to `input.targetRoot`
 * atomically: either every file change lands and is verified, or the target
 * is restored to its exact pre-apply state and a `GenerationApplyRolledBackError`
 * (or `GenerationApplyRefusedError`, if revalidation itself failed) is thrown.
 *
 * `plan.commands` are returned verbatim but never executed — the caller (or
 * the desktop process) runs them.
 */
export function applyGenerationPlan(input: ApplyGenerationPlanInput): ApplyGenerationPlanResult {
  const targetRootAbs = path.resolve(input.targetRoot)

  // Step 1: revalidate. Throws (refusing, changing nothing) on any problem.
  const { resolved } = revalidate(input, targetRootAbs)

  const runId = input.runId
  const stagingRootAbs = stagingRoot(targetRootAbs, runId)
  const rollbackRootAbs = rollbackRoot(targetRootAbs, runId)
  const now = input.now ?? (() => new Date())

  const stagedPathFor = (relPath: string) => path.join(stagingRootAbs, relPath)

  // Step 2: stage every postimage (never touching real targets yet).
  try {
    for (const { change, relPath } of resolved) {
      if (change.action === 'create' || change.action === 'update') {
        const content = input.virtualFiles.find((f) => toPosixPath(f.path) === relPath)!.contents
        const stagedAbs = stagedPathFor(relPath)
        fs.mkdirSync(path.dirname(stagedAbs), { recursive: true })
        fs.writeFileSync(stagedAbs, content, 'utf8')
      }
    }

    // Step 3: self-validate staged content.
    for (const { change, relPath } of resolved) {
      if (change.action === 'create' || change.action === 'update') {
        const stagedAbs = stagedPathFor(relPath)
        const stagedContent = fs.readFileSync(stagedAbs, 'utf8')
        if (textHash(stagedContent) !== change.postimageHash) {
          throw new Error(`staged content for "${relPath}" does not hash to the expected postimageHash`)
        }
      }
    }
  } catch (err) {
    // Nothing has touched the real target yet at this point; just clean up staging.
    fs.rmSync(stagingRootAbs, { recursive: true, force: true })
    throw err instanceof GenerationApplyRefusedError
      ? err
      : new Error(`generation apply staging failed before any target file was touched: ${(err as Error).message}`, {
          cause: err,
        })
  }

  // Step 4: save rollback material (current bytes of everything about to be
  // overwritten/deleted) + a rollback journal, before any target mutation.
  const journal: RollbackJournal = {
    runId,
    planHash: input.plan.planHash,
    timestamp: now().toISOString(),
    changes: [],
  }
  try {
    for (const { relPath, absPath } of resolved) {
      const exists = fs.existsSync(absPath) && fs.statSync(absPath).isFile()
      if (exists) {
        const preimageAbs = preimageStoragePath(rollbackRootAbs, relPath)
        fs.mkdirSync(path.dirname(preimageAbs), { recursive: true })
        fs.copyFileSync(absPath, preimageAbs)
      }
      journal.changes.push({
        path: relPath,
        // `hadPreimage` reflects on-disk reality (defensive: even a nominal
        // "create" whose target already existed is treated as having a
        // preimage, so rollback never loses pre-existing content).
        action: resolved.find((r) => r.relPath === relPath)!.change.action,
        hadPreimage: exists,
      })
    }
    fs.mkdirSync(rollbackRootAbs, { recursive: true })
    fs.writeFileSync(journalPath(rollbackRootAbs), JSON.stringify(journal, null, 2) + '\n', 'utf8')
  } catch (err) {
    fs.rmSync(stagingRootAbs, { recursive: true, force: true })
    fs.rmSync(rollbackRootAbs, { recursive: true, force: true })
    throw new Error(`generation apply failed while saving rollback material; no target file was touched: ${(err as Error).message}`, {
      cause: err,
    })
  }

  // Step 5: apply atomically, tracking exactly which changes have landed.
  const applied: { relPath: string; absPath: string; action: FileChangeAction; hadPreimage: boolean }[] = []
  const restore = (): void => {
    for (const done of [...applied].reverse()) {
      const entry = journal.changes.find((c) => c.path === done.relPath)
      if (entry?.hadPreimage) {
        const preimageAbs = preimageStoragePath(rollbackRootAbs, done.relPath)
        fs.mkdirSync(path.dirname(done.absPath), { recursive: true })
        fs.copyFileSync(preimageAbs, done.absPath)
      } else {
        fs.rmSync(done.absPath, { force: true })
        removeDirIfEmpty(path.dirname(done.absPath), targetRootAbs)
      }
    }
  }

  try {
    for (const { change, relPath, absPath } of resolved) {
      const hadPreimage = journal.changes.find((c) => c.path === relPath)!.hadPreimage
      if (change.action === 'create' || change.action === 'update') {
        const stagedAbs = stagedPathFor(relPath)
        fs.mkdirSync(path.dirname(absPath), { recursive: true })
        fs.renameSync(stagedAbs, absPath)
      } else {
        fs.rmSync(absPath, { force: true })
      }
      applied.push({ relPath, absPath, action: change.action, hadPreimage })
    }
  } catch (err) {
    restore()
    fs.rmSync(stagingRootAbs, { recursive: true, force: true })
    fs.rmSync(rollbackRootAbs, { recursive: true, force: true })
    throw new GenerationApplyRolledBackError((err as Error).message, { cause: err })
  }

  // Step 6 (verify) — each applied file's on-disk hash must equal postimageHash.
  try {
    for (const { change, relPath, absPath } of resolved) {
      if (change.action === 'create' || change.action === 'update') {
        const finalHash = textHash(fs.readFileSync(absPath, 'utf8'))
        if (finalHash !== change.postimageHash) {
          throw new Error(`post-apply verification failed for "${relPath}": on-disk hash does not match postimageHash`)
        }
      }
    }
  } catch (err) {
    restore()
    fs.rmSync(stagingRootAbs, { recursive: true, force: true })
    fs.rmSync(rollbackRootAbs, { recursive: true, force: true })
    throw new GenerationApplyRolledBackError((err as Error).message, { cause: err })
  }

  // Success: staging is fully consumed, clean it up. Keep the rollback bundle
  // (and its journal) so `rollbackGenerationApply` can undo this run later.
  fs.rmSync(stagingRootAbs, { recursive: true, force: true })

  const appliedFiles: AppliedFileRecord[] = []
  const resultingHashes: Record<string, string> = {}
  for (const { change, relPath, absPath } of resolved) {
    if (change.action === 'create' || change.action === 'update') {
      const content = fs.readFileSync(absPath, 'utf8')
      appliedFiles.push({ path: relPath, action: change.action, sizeBytes: byteSize(content) })
      resultingHashes[relPath] = textHash(content)
    } else {
      appliedFiles.push({ path: relPath, action: change.action, sizeBytes: 0 })
    }
  }

  return {
    runId,
    appliedFiles,
    rollbackId: runId,
    commands: [...input.plan.commands],
    resultingHashes,
  }
}

/**
 * Restore the exact pre-apply state recorded by a prior `applyGenerationPlan`
 * run identified by `rollbackId` (== that run's `runId`). Idempotent: calling
 * it again after a successful rollback is a safe no-op re-application of the
 * same restore (already-removed files stay removed; already-restored files
 * are rewritten to the same bytes).
 */
export function rollbackGenerationApply(targetRoot: string, rollbackId: string): RollbackGenerationApplyResult {
  const targetRootAbs = path.resolve(targetRoot)
  if (!RUN_ID_PATTERN.test(rollbackId)) {
    throw new Error(`rollbackId "${rollbackId}" must be a non-empty identifier with no path separators`)
  }
  const rollbackRootAbs = rollbackRoot(targetRootAbs, rollbackId)
  const journalFile = journalPath(rollbackRootAbs)
  if (!fs.existsSync(journalFile)) {
    throw new Error(`no rollback bundle found for rollbackId "${rollbackId}" under "${targetRoot}"`)
  }
  const journal = JSON.parse(fs.readFileSync(journalFile, 'utf8')) as RollbackJournal

  const restoredFiles: RollbackRestoredRecord[] = []
  for (const entry of [...journal.changes].reverse()) {
    const location = resolveInsideTarget(targetRootAbs, entry.path)
    if (!location.ok) {
      throw new Error(`rollback refused: ${location.reason}`)
    }
    const { absPath } = location
    if (entry.hadPreimage) {
      const preimageAbs = preimageStoragePath(rollbackRootAbs, entry.path)
      const content = fs.readFileSync(preimageAbs, 'utf8')
      fs.mkdirSync(path.dirname(absPath), { recursive: true })
      fs.writeFileSync(absPath, content, 'utf8')
      restoredFiles.push({ path: entry.path, action: 'restored', sizeBytes: byteSize(content) })
    } else {
      fs.rmSync(absPath, { force: true })
      removeDirIfEmpty(path.dirname(absPath), targetRootAbs)
      restoredFiles.push({ path: entry.path, action: 'removed', sizeBytes: 0 })
    }
  }

  return { rollbackId, restoredFiles }
}
