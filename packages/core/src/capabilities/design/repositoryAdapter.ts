/**
 * EUC-15 — Repository and process adapters.
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §11.6,
 * §12.2, §19 ("MATLAB timeout", "Apply failure", "Verification command
 * timeout"), §20.1, §20.2, §25.3 (EUC-15).
 *
 * Node-only adapter: reads scoped repository context, computes a
 * deterministic content-derived workspace revision, applies an approved
 * `DeltaApplyPlan` transactionally against the real filesystem, and runs a
 * configured verification command with a timeout, an allowlist, and
 * explicit process isolation.
 *
 * This module never edits `records.ts` or `identity.ts` (shared contracts),
 * and never edits `deltaInspector.ts`, `contextPacket.ts`, or
 * `designWorkspace.ts` (committed siblings); it only imports from them.
 *
 * Do NOT import this module from a browser entry (`src/index.ts` "."/
 * "./browser" exports) — it uses `node:fs` and `node:child_process` directly.
 */

import fs from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { canonicalHash, sha256Hex } from '../hash.js'
import { isRealPathWithinProjectRoot } from '../filesystem.js'
import { stableSortBy, stableSortStrings } from './identity.js'
import { normalizeReturnedPath } from './deltaInspector.js'
import type { DeltaApplyPlan, DeltaApplyResult, ReturnedDelta, ReturnedFileChange } from './records.js'

// ---------------------------------------------------------------------------
// Shared filesystem walk helpers
// ---------------------------------------------------------------------------

const BACKUP_DIRNAME = '.euik-design-backups'
export const OWNERSHIP_FILE_NAME = 'design-ownership.json'

const SKIP_DIRECTORIES = new Set([
  '.git',
  '.idea',
  '.next',
  '.turbo',
  '.venv',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'target',
  'vendor',
  BACKUP_DIRNAME,
])

/**
 * Recursively lists every file under `absoluteDir` (relative to
 * `resolvedRoot`, posix-separated), skipping noise directories and any
 * symbolic link whose real target escapes `resolvedRoot` (§20.2).
 */
function collectDirectory(resolvedRoot: string, absoluteDir: string, relativeDir: string): string[] {
  const out: string[] = []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(absoluteDir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (SKIP_DIRECTORIES.has(entry.name)) continue
    const absChild = path.join(absoluteDir, entry.name)
    const relChild = relativeDir ? `${relativeDir}/${entry.name}` : entry.name
    if (entry.isSymbolicLink()) {
      if (!isRealPathWithinProjectRoot(resolvedRoot, absChild)) continue
      let realStat: fs.Stats
      try {
        realStat = fs.statSync(absChild)
      } catch {
        continue
      }
      if (realStat.isDirectory()) out.push(...collectDirectory(resolvedRoot, absChild, relChild))
      else if (realStat.isFile()) out.push(relChild)
      continue
    }
    if (entry.isDirectory()) {
      out.push(...collectDirectory(resolvedRoot, absChild, relChild))
    } else if (entry.isFile()) {
      out.push(relChild)
    }
  }
  return out
}

/** Lists the files reachable from a single include entry (file, directory, or safe symlink). */
function collectEntry(resolvedRoot: string, absoluteEntry: string, relativeEntry: string): string[] {
  let stat: fs.Stats
  try {
    stat = fs.lstatSync(absoluteEntry)
  } catch {
    return []
  }
  if (stat.isSymbolicLink()) {
    if (!isRealPathWithinProjectRoot(resolvedRoot, absoluteEntry)) return []
    let realStat: fs.Stats
    try {
      realStat = fs.statSync(absoluteEntry)
    } catch {
      return []
    }
    if (realStat.isDirectory()) return collectDirectory(resolvedRoot, absoluteEntry, relativeEntry)
    if (realStat.isFile()) return [relativeEntry]
    return []
  }
  if (stat.isDirectory()) return collectDirectory(resolvedRoot, absoluteEntry, relativeEntry)
  if (stat.isFile()) return [relativeEntry]
  return []
}

// ---------------------------------------------------------------------------
// §20.1 / §20.2 — read-only scoped context
// ---------------------------------------------------------------------------

export type ReadScopedContextInput = {
  root: string
  /** Repository-relative files or directories to read; never a path outside `root`. */
  includePaths: string[]
  /** Regular-expression source strings matched against the posix relative path; matches are skipped. */
  excludedPatterns?: string[]
}

/** A read-only candidate for a `ContextManifestEntry` (§16.4); the caller adds `priority`/`inclusionReason`. */
export type ScopedContextCandidate = {
  kind: 'source'
  ref: string
  contentHash: string
  bytes: number
  content: string
}

/**
 * §20.1 "Source adapters shall be read-only during Plan and Design analysis"
 * / §20.2 "reject symbolic-link or path-traversal escapes" — reads only
 * files under `input.includePaths`, resolved against `input.root`. Rejects
 * an absolute include path, a `..` traversal segment, and any include path
 * or nested entry whose resolved real path escapes the real path of `root`
 * (a symlink escape). Never writes. Returns candidates sorted deterministically by `ref`.
 */
export function readScopedContext(input: ReadScopedContextInput): ScopedContextCandidate[] {
  const resolvedRoot = path.resolve(input.root)
  const excludedRegexes = (input.excludedPatterns ?? []).map((pattern) => new RegExp(pattern))
  const seen = new Set<string>()
  const candidates: ScopedContextCandidate[] = []

  for (const rawInclude of input.includePaths) {
    const normalized = normalizeReturnedPath(rawInclude)
    if (!normalized) {
      throw new Error(`refused to read scoped context: unsafe include path "${rawInclude}"`)
    }
    const absoluteInclude = path.join(resolvedRoot, normalized)
    if (!isRealPathWithinProjectRoot(resolvedRoot, absoluteInclude)) {
      throw new Error(`refused to read scoped context: include path escapes the repository root: "${rawInclude}"`)
    }
    for (const relFile of collectEntry(resolvedRoot, absoluteInclude, normalized)) {
      if (seen.has(relFile)) continue
      if (excludedRegexes.some((regex) => regex.test(relFile))) continue
      const absFile = path.join(resolvedRoot, relFile)
      if (!isRealPathWithinProjectRoot(resolvedRoot, absFile)) continue
      const content = fs.readFileSync(absFile, 'utf8')
      candidates.push({
        kind: 'source',
        ref: relFile,
        contentHash: sha256Hex(content),
        bytes: Buffer.byteLength(content, 'utf8'),
        content,
      })
      seen.add(relFile)
    }
  }

  return stableSortBy(candidates, (candidate) => candidate.ref)
}

// ---------------------------------------------------------------------------
// §11.6 / §12.2 — deterministic workspace revision
// ---------------------------------------------------------------------------

function fileEntry(resolvedRoot: string, relPath: string): [string, string | null] {
  const absPath = path.join(resolvedRoot, relPath)
  try {
    if (!fs.statSync(absPath).isFile()) return [relPath, null]
  } catch {
    return [relPath, null]
  }
  return [relPath, sha256Hex(fs.readFileSync(absPath, 'utf8'))]
}

/** Expands a mix of file and directory paths into a deduplicated, safety-checked file list. */
function expandPathsForRevision(resolvedRoot: string, paths: string[]): string[] {
  const out = new Set<string>()
  for (const raw of paths) {
    const normalized = normalizeReturnedPath(raw)
    if (!normalized) continue
    const absPath = path.join(resolvedRoot, normalized)
    if (!isRealPathWithinProjectRoot(resolvedRoot, absPath)) continue
    let stat: fs.Stats | undefined
    try {
      stat = fs.statSync(absPath)
    } catch {
      stat = undefined
    }
    if (stat?.isDirectory()) {
      for (const rel of collectDirectory(resolvedRoot, absPath, normalized)) out.add(rel)
    } else {
      out.add(normalized)
    }
  }
  return [...out]
}

/**
 * §11.6 "If the workspace changes after inspection, the product shall
 * require a new inspection" / §12.2 "verify the base workspace revision" —
 * a deterministic content-derived revision: the canonical hash of the
 * sorted relative file paths paired with their content hash (or `null` when
 * a listed path does not currently exist as a file). When `paths` is
 * omitted, every file under `root` is included (noise directories and the
 * apply-backup directory are skipped).
 */
export function workspaceRevision(root: string, paths?: string[]): string {
  const resolvedRoot = path.resolve(root)
  const relPaths =
    paths && paths.length > 0
      ? stableSortStrings(expandPathsForRevision(resolvedRoot, paths))
      : stableSortStrings(collectDirectory(resolvedRoot, resolvedRoot, ''))
  const perFile = relPaths.map((relPath) => fileEntry(resolvedRoot, relPath))
  return canonicalHash(perFile)
}

// ---------------------------------------------------------------------------
// §12.2 — transactional apply, backup, and rollback
// ---------------------------------------------------------------------------

export type DesignOwnershipEntry = {
  path: string
  contentHash: string
  sourcePacketId: string
  planId: string
  updatedAt: string
}

export type DesignOwnershipManifest = {
  schemaVersion: '1.0'
  entries: DesignOwnershipEntry[]
}

function ownershipManifestPath(resolvedRoot: string): string {
  return path.join(resolvedRoot, OWNERSHIP_FILE_NAME)
}

/** Reads the ownership manifest at the root of a repository, if any (§12.2 "update ownership manifests"). */
export function readOwnershipManifest(root: string): DesignOwnershipManifest | undefined {
  const manifestPath = ownershipManifestPath(path.resolve(root))
  if (!fs.existsSync(manifestPath)) return undefined
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as DesignOwnershipManifest
}

function writeOwnershipManifest(resolvedRoot: string, manifest: DesignOwnershipManifest): void {
  const manifestPath = ownershipManifestPath(resolvedRoot)
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true })
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
}

type NormalizedChange = { path: string; action: ReturnedFileChange['action']; content?: string; contentHash?: string }

function updateOwnershipManifest(
  resolvedRoot: string,
  delta: ReturnedDelta,
  plan: DeltaApplyPlan,
  changes: NormalizedChange[],
  now: string,
): void {
  const existing = readOwnershipManifest(resolvedRoot) ?? { schemaVersion: '1.0' as const, entries: [] }
  const byPath = new Map(existing.entries.map((entry) => [entry.path, entry]))
  for (const change of changes) {
    if (change.action === 'delete') {
      byPath.delete(change.path)
      continue
    }
    const contentHash = change.contentHash ?? sha256Hex(change.content ?? '')
    byPath.set(change.path, {
      path: change.path,
      contentHash,
      sourcePacketId: delta.packetId,
      planId: plan.planId,
      updatedAt: now,
    })
  }
  const entries = stableSortBy([...byPath.values()], (entry) => entry.path)
  writeOwnershipManifest(resolvedRoot, { schemaVersion: '1.0', entries })
}

type BackupManifestEntry = { path: string; existedBefore: boolean }
type BackupManifest = { planId: string; createdAt: string; entries: BackupManifestEntry[] }

function backupDir(resolvedRoot: string, planId: string): string {
  return path.join(resolvedRoot, BACKUP_DIRNAME, planId)
}

function backupManifestPath(resolvedRoot: string, planId: string): string {
  return path.join(backupDir(resolvedRoot, planId), 'manifest.json')
}

function backupFilePath(resolvedRoot: string, planId: string, relPath: string): string {
  return path.join(backupDir(resolvedRoot, planId), 'files', relPath)
}

function readBackupManifest(resolvedRoot: string, planId: string): BackupManifest | undefined {
  const manifestPath = backupManifestPath(resolvedRoot, planId)
  if (!fs.existsSync(manifestPath)) return undefined
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as BackupManifest
}

/**
 * Copies every path in `relPaths` (its current content, when it exists) into
 * `<root>/.euik-design-backups/<planId>/`, plus a manifest recording which
 * paths existed before the apply (§12.2 "create a recoverable backup"). The
 * ownership manifest itself is included so a rollback restores it exactly.
 */
function createBackup(resolvedRoot: string, planId: string, relPaths: string[], now: string): BackupManifest {
  const entries: BackupManifestEntry[] = []
  for (const relPath of relPaths) {
    const absPath = path.join(resolvedRoot, relPath)
    let existedBefore = false
    try {
      existedBefore = fs.statSync(absPath).isFile()
    } catch {
      existedBefore = false
    }
    if (existedBefore) {
      const dest = backupFilePath(resolvedRoot, planId, relPath)
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.copyFileSync(absPath, dest)
    }
    entries.push({ path: relPath, existedBefore })
  }
  const manifest: BackupManifest = { planId, createdAt: now, entries }
  const manifestDest = backupManifestPath(resolvedRoot, planId)
  fs.mkdirSync(path.dirname(manifestDest), { recursive: true })
  fs.writeFileSync(manifestDest, JSON.stringify(manifest, null, 2) + '\n')
  return manifest
}

function restoreFromBackup(resolvedRoot: string, planId: string): void {
  const manifest = readBackupManifest(resolvedRoot, planId)
  if (!manifest) {
    throw new Error(`no recoverable backup found for plan "${planId}"`)
  }
  for (const entry of manifest.entries) {
    const absPath = path.join(resolvedRoot, entry.path)
    if (entry.existedBefore) {
      const src = backupFilePath(resolvedRoot, planId, entry.path)
      fs.mkdirSync(path.dirname(absPath), { recursive: true })
      fs.copyFileSync(src, absPath)
    } else if (fs.existsSync(absPath)) {
      fs.rmSync(absPath, { force: true })
    }
  }
}

/**
 * §12.2 "provide rollback instructions" / §19 "Apply failure" — restores
 * every path touched by `planId` (and the ownership manifest) from its
 * recoverable backup. Works whether the apply already rolled back mid-apply
 * or the caller is explicitly reverting a previously successful apply.
 */
export function rollback(planId: string, root: string): void {
  restoreFromBackup(path.resolve(root), planId)
}

export type ApplyDeltaTransactionOptions = {
  /** Precomputed current workspace revision over the plan's touched paths; recomputed when omitted. */
  currentRevision?: string
  now?: string
  /** Test hook: throws an induced failure after this many changes have been applied. */
  failAfter?: number
}

function failResult(planId: string, now: string, failure: string): DeltaApplyResult {
  return { planId, applied: false, rolledBack: false, appliedFiles: [], failure, completedAt: now }
}

/**
 * §12.2 — the real filesystem transactional apply. Verifies the base
 * workspace revision (`plan.expectedWorkspaceRevision`) over the delta's
 * touched paths, verifies the inspected delta hash
 * (`plan.expectedDeltaHash`), creates a recoverable backup, then applies
 * every approved change or none: any mid-apply failure (including the
 * `failAfter` test hook, or a delete whose target is missing) restores
 * every touched file — and the ownership manifest — from backup (§19 "Apply
 * failure"). Unrelated files are never touched. On success, updates
 * `design-ownership.json` at `root` and returns the `DeltaApplyResult`.
 */
export function applyDeltaTransactionally(
  plan: DeltaApplyPlan,
  delta: ReturnedDelta,
  root: string,
  options: ApplyDeltaTransactionOptions = {},
): DeltaApplyResult {
  const resolvedRoot = path.resolve(root)
  const now = options.now ?? new Date().toISOString()

  const normalizedChanges: NormalizedChange[] = []
  for (const change of plan.orderedChanges) {
    const normalized = normalizeReturnedPath(change.path)
    if (!normalized) {
      return failResult(plan.planId, now, `refused to apply: unsafe path "${change.path}"`)
    }
    const absPath = path.join(resolvedRoot, normalized)
    if (!isRealPathWithinProjectRoot(resolvedRoot, absPath)) {
      return failResult(plan.planId, now, `refused to apply: path escapes the repository root "${change.path}"`)
    }
    normalizedChanges.push({ path: normalized, action: change.action, content: change.content, contentHash: change.contentHash })
  }

  const touchedPaths = stableSortStrings([...new Set(normalizedChanges.map((change) => change.path))])

  // §12.2 "verify the base workspace revision"
  const currentRevision = options.currentRevision ?? workspaceRevision(resolvedRoot, touchedPaths)
  if (currentRevision !== plan.expectedWorkspaceRevision) {
    return failResult(plan.planId, now, 'stale workspace revision: the workspace changed after inspection')
  }

  // §12.2 "verify the inspected delta hash"
  const deltaHash = canonicalHash(delta)
  if (deltaHash !== plan.expectedDeltaHash) {
    return failResult(plan.planId, now, 'inspected delta hash mismatch: the delta content changed since inspection')
  }

  const backupPaths = stableSortStrings([...new Set([...touchedPaths, OWNERSHIP_FILE_NAME])])
  createBackup(resolvedRoot, plan.planId, backupPaths, now)

  const appliedFiles: string[] = []
  try {
    let count = 0
    for (const change of normalizedChanges) {
      count += 1
      if (options.failAfter !== undefined && count > options.failAfter) {
        throw new Error(`induced apply failure after ${options.failAfter} change(s) (test hook)`)
      }
      const absPath = path.join(resolvedRoot, change.path)
      if (change.action === 'delete') {
        if (!fs.existsSync(absPath)) {
          throw new Error(`delete target is missing at "${change.path}"`)
        }
        fs.rmSync(absPath, { force: true })
      } else {
        fs.mkdirSync(path.dirname(absPath), { recursive: true })
        fs.writeFileSync(absPath, change.content ?? '')
      }
      appliedFiles.push(change.path)
    }

    updateOwnershipManifest(resolvedRoot, delta, plan, normalizedChanges, now)

    return {
      planId: plan.planId,
      applied: true,
      rolledBack: false,
      appliedFiles,
      resultWorkspaceRevision: workspaceRevision(resolvedRoot, touchedPaths),
      completedAt: now,
    }
  } catch (error) {
    restoreFromBackup(resolvedRoot, plan.planId)
    const failure = error instanceof Error ? error.message : String(error)
    return { planId: plan.planId, applied: false, rolledBack: true, appliedFiles: [], failure, completedAt: now }
  }
}

// ---------------------------------------------------------------------------
// §20.2 — process isolation
// ---------------------------------------------------------------------------

export type ProcessIsolationGuardInput = {
  root: string
  cwd: string
  /** Names of process.env variables to pass through explicitly; nothing is inherited by default. */
  envAllowlist?: string[]
  extraEnv?: Record<string, string>
}

export type ProcessIsolationGuardResult =
  | { ok: true; cwd: string; env: Record<string, string> }
  | { ok: false; reason: string }

/**
 * §20.2 "External agents shall receive a packet, not unrestricted project
 * authority" — confirms a spawned process's working directory stays under
 * `root` (symlink-safe, §20.2 "reject symbolic-link or path-traversal
 * escapes"), and builds an explicit environment from an allowlist rather
 * than inheriting the full parent environment (no secret inheritance by
 * default).
 */
export function processIsolationGuard(input: ProcessIsolationGuardInput): ProcessIsolationGuardResult {
  const resolvedRoot = path.resolve(input.root)
  const resolvedCwd = path.resolve(input.cwd)
  if (!isRealPathWithinProjectRoot(resolvedRoot, resolvedCwd)) {
    return { ok: false, reason: `process working directory escapes the repository root: "${input.cwd}"` }
  }
  const env: Record<string, string> = {}
  for (const name of input.envAllowlist ?? []) {
    const value = process.env[name]
    if (value !== undefined) env[name] = value
  }
  Object.assign(env, input.extraEnv ?? {})
  return { ok: true, cwd: resolvedCwd, env }
}

// ---------------------------------------------------------------------------
// §19 "Verification command timeout" / §20.2 — configured command runner
// ---------------------------------------------------------------------------

export type RunConfiguredCommandInput = {
  command: string
  args?: string[]
  cwd: string
  timeoutMs: number
  /** §20.2 "Command execution shall use configured allowlists or explicit user approval." */
  allowedCommands: string[]
  cancellation?: { cancelled: boolean }
  /** Containment root for `processIsolationGuard`; defaults to `cwd`. */
  root?: string
  envAllowlist?: string[]
  extraEnv?: Record<string, string>
  maxOutputBytes?: number
  cancellationPollMs?: number
}

export type RunConfiguredCommandResult = {
  exitCode: number | null
  timedOut: boolean
  cancelled: boolean
  stdout: string
  stderr: string
  durationMs: number
}

/**
 * §19 "Verification command timeout: Stop the command, record timeout, keep
 * module not ready" — spawns `command` (`child_process.spawn`, no shell) and
 * enforces `timeoutMs` by killing the process and marking `timedOut`. §20.2
 * "reject a command not in [the allowlist]" — rejects (a rejected promise,
 * since this is an async operation) a `command` absent from
 * `allowedCommands` before spawning anything. Honors a shared
 * `cancellation.cancelled` flag by polling and killing the process, marking
 * `cancelled`. Output is captured up to `maxOutputBytes` (default 1 MiB).
 */
export async function runConfiguredCommand(input: RunConfiguredCommandInput): Promise<RunConfiguredCommandResult> {
  if (!input.allowedCommands.includes(input.command)) {
    throw new Error(`command is not in the configured allowlist: "${input.command}"`)
  }
  const guard = processIsolationGuard({
    root: input.root ?? input.cwd,
    cwd: input.cwd,
    envAllowlist: input.envAllowlist,
    extraEnv: input.extraEnv,
  })
  if (!guard.ok) {
    throw new Error(guard.reason)
  }

  const maxOutputBytes = input.maxOutputBytes ?? 1_048_576
  const startedAt = Date.now()

  return new Promise((resolve) => {
    const child = spawn(input.command, input.args ?? [], {
      cwd: guard.cwd,
      env: guard.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false
    let cancelled = false
    let settled = false

    const appendBounded = (current: string, chunk: Buffer): string => {
      if (Buffer.byteLength(current, 'utf8') >= maxOutputBytes) return current
      const next = current + chunk.toString('utf8')
      if (Buffer.byteLength(next, 'utf8') <= maxOutputBytes) return next
      return Buffer.from(next, 'utf8').subarray(0, maxOutputBytes).toString('utf8') + '\n[output truncated]\n'
    }

    const finish = (exitCode: number | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      clearInterval(cancelPoll)
      resolve({ exitCode, timedOut, cancelled, stdout, stderr, durationMs: Date.now() - startedAt })
    }

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, input.timeoutMs)

    const cancelPoll = setInterval(() => {
      if (input.cancellation?.cancelled && !cancelled) {
        cancelled = true
        child.kill('SIGKILL')
      }
    }, input.cancellationPollMs ?? 25)

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout = appendBounded(stdout, chunk)
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = appendBounded(stderr, chunk)
    })
    child.on('error', () => finish(null))
    child.on('close', (code) => finish(code))
  })
}

/**
 * Synchronous variant of `runConfiguredCommand` for the synchronous executor
 * slots in `operations.ts` (`verifyModule` and peers). Same allowlist,
 * isolation, and timeout semantics; cancellation is checked once before the
 * spawn because a synchronous child cannot be interrupted mid-run.
 */
export function runConfiguredCommandSync(input: RunConfiguredCommandInput): RunConfiguredCommandResult {
  if (!input.allowedCommands.includes(input.command)) {
    throw new Error(`command is not in the configured allowlist: "${input.command}"`)
  }
  const guard = processIsolationGuard({
    root: input.root ?? input.cwd,
    cwd: input.cwd,
    envAllowlist: input.envAllowlist,
    extraEnv: input.extraEnv,
  })
  if (!guard.ok) {
    throw new Error(guard.reason)
  }
  if (input.cancellation?.cancelled) {
    return { exitCode: null, timedOut: false, cancelled: true, stdout: '', stderr: '', durationMs: 0 }
  }

  const maxOutputBytes = input.maxOutputBytes ?? 1_048_576
  const startedAt = Date.now()
  const outcome = spawnSync(input.command, input.args ?? [], {
    cwd: guard.cwd,
    env: guard.env,
    timeout: input.timeoutMs,
    killSignal: 'SIGKILL',
    maxBuffer: maxOutputBytes,
    encoding: 'utf8',
  })
  const timedOut = outcome.error !== undefined && (outcome.error as NodeJS.ErrnoException).code === 'ETIMEDOUT'
  return {
    exitCode: outcome.status,
    timedOut,
    cancelled: false,
    stdout: outcome.stdout ?? '',
    stderr: outcome.stderr ?? '',
    durationMs: Date.now() - startedAt,
  }
}
