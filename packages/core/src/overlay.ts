/**
 * Zip-overlay inspector and applier.
 *
 * Inspection implements the hard blockers AI-HANDOFF-030…039 and warnings
 * AI-HANDOFF-040…047 from `standards/copilot-handoff/overlay-safety.md`, and
 * emits the PRD §28.4 `OverlayInspectionSummary` shape. Application refuses
 * blocked overlays, never deletes, and records PRD §28.6 `AppliedFiles`.
 */

import fs from 'node:fs'
import path from 'node:path'
import AdmZip from 'adm-zip'
import { execFileSync } from 'node:child_process'
import type { AppliedFiles, OverlayInspectionSummary } from './types.js'

export type InspectOptions = {
  runId: string
  targetRoot: string
  expectedFiles?: string[]
  largeFileBytes?: number
  fullRepoDumpThreshold?: number
  now?: () => Date
}

const DEFAULT_LARGE_FILE_BYTES = 200 * 1024
const DEFAULT_FULL_REPO_THRESHOLD = 25

const DEPENDENCY_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'coverage', '.cache', '.turbo', '.vite'])

function isAbsoluteEntry(p: string): boolean {
  return p.startsWith('/') || p.startsWith('\\\\') || /^[A-Za-z]:[\\/]/.test(p)
}

function isSecretName(fileName: string): boolean {
  const n = fileName.toLowerCase()
  return (
    n === '.env' || n.startsWith('.env.') ||
    n.endsWith('.pem') || n.endsWith('.key') || n.endsWith('.crt') || n.endsWith('.pfx') || n.endsWith('.p12') ||
    n.includes('credential') || n === 'id_rsa' || n === 'id_ed25519'
  )
}

function isDirtyWorktree(targetRoot: string): boolean {
  try {
    const out = execFileSync('git', ['status', '--porcelain', '--', '.'], {
      cwd: targetRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return out.trim().length > 0
  } catch {
    return false
  }
}

export function inspectOverlay(zipPath: string, options: InspectOptions): OverlayInspectionSummary {
  const inspectedAt = (options.now?.() ?? new Date()).toISOString()
  const summary: OverlayInspectionSummary = {
    runId: options.runId,
    zipFilename: path.basename(zipPath),
    inspectedAt,
    normalizedEntries: [],
    hardBlockers: [],
    warnings: [],
    canApply: false,
  }

  let zip: AdmZip
  try {
    zip = new AdmZip(zipPath)
    zip.getEntries()
  } catch (error) {
    summary.hardBlockers.push({
      ruleId: 'AI-HANDOFF-030',
      message: `archive cannot be opened or listed: ${error instanceof Error ? error.message : String(error)}`,
    })
    return summary
  }

  const largeFileBytes = options.largeFileBytes ?? DEFAULT_LARGE_FILE_BYTES
  const expected = options.expectedFiles ? new Set(options.expectedFiles) : undefined
  let fileCount = 0

  for (const entry of zip.getEntries()) {
    const original = entry.entryName
    if (entry.isDirectory) {
      summary.normalizedEntries.push({
        originalPath: original,
        normalizedRelativePath: original.replace(/\/+$/, ''),
        targetPath: '',
        isDirectory: true,
      })
      continue
    }
    fileCount += 1

    const decoded = original
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f\u007f]/.test(decoded)) {
      summary.hardBlockers.push({ ruleId: 'AI-HANDOFF-039', path: original, message: 'entry path contains control characters' })
      continue
    }

    if (isAbsoluteEntry(decoded)) {
      summary.hardBlockers.push({ ruleId: 'AI-HANDOFF-031', path: original, message: 'absolute entry path' })
      continue
    }
    const posix = decoded.replace(/\\/g, '/')
    const segments = posix.split('/')
    if (segments.includes('..')) {
      summary.hardBlockers.push({ ruleId: 'AI-HANDOFF-032', path: original, message: 'path traversal segment' })
      continue
    }

    const normalized = path.posix.normalize(posix)
    const targetPath = path.resolve(options.targetRoot, normalized)
    const rootResolved = path.resolve(options.targetRoot)
    if (!targetPath.startsWith(rootResolved + path.sep) && targetPath !== rootResolved) {
      summary.hardBlockers.push({ ruleId: 'AI-HANDOFF-033', path: original, message: 'normalized path escapes the target root' })
      continue
    }

    const mode = entry.header.attr >>> 16
    if (mode !== 0 && (mode & 0o170000) !== 0o100000 && (mode & 0o170000) !== 0) {
      summary.hardBlockers.push({ ruleId: 'AI-HANDOFF-034', path: original, message: 'symlink or special file entry' })
      continue
    }

    if (segments.includes('.git')) {
      summary.hardBlockers.push({ ruleId: 'AI-HANDOFF-035', path: original, message: 'git metadata entry' })
      continue
    }
    if (segments.some((s) => DEPENDENCY_DIRS.has(s))) {
      summary.hardBlockers.push({ ruleId: 'AI-HANDOFF-036', path: original, message: 'dependency, cache, or build folder entry' })
      continue
    }
    const fileName = segments[segments.length - 1] ?? posix
    if (isSecretName(fileName)) {
      summary.hardBlockers.push({ ruleId: 'AI-HANDOFF-037', path: original, message: 'likely secret or environment file' })
      continue
    }

    const sizeBytes = entry.header.size
    summary.normalizedEntries.push({
      originalPath: original,
      normalizedRelativePath: normalized,
      targetPath,
      sizeBytes,
      isDirectory: false,
    })

    const exists = fs.existsSync(targetPath)
    if (exists) {
      summary.warnings.push({ ruleId: 'AI-HANDOFF-040', path: normalized, message: 'overwrites existing source file' })
    }
    if (fileName === 'package.json' || fileName === 'package-lock.json' || fileName === 'pnpm-lock.yaml' || fileName === 'yarn.lock') {
      summary.warnings.push({ ruleId: 'AI-HANDOFF-041', path: normalized, message: 'changes package manifest or lockfile' })
    }
    if (fileName.startsWith('tsconfig') || fileName.startsWith('vite.config') || fileName.startsWith('webpack.config')) {
      summary.warnings.push({ ruleId: 'AI-HANDOFF-042', path: normalized, message: 'changes build or tooling configuration' })
    }
    if (expected && !expected.has(normalized)) {
      summary.warnings.push({ ruleId: 'AI-HANDOFF-043', path: normalized, message: 'outside expected changed-file scope' })
    }
    if (sizeBytes > largeFileBytes) {
      summary.warnings.push({ ruleId: 'AI-HANDOFF-044', path: normalized, message: `unusually large file (${sizeBytes} bytes)` })
    }
    if (entry.getData().includes(0)) {
      summary.warnings.push({ ruleId: 'AI-HANDOFF-047', path: normalized, message: 'introduces a binary file' })
    }
  }

  if (fileCount > (options.fullRepoDumpThreshold ?? DEFAULT_FULL_REPO_THRESHOLD)) {
    summary.hardBlockers.push({
      ruleId: 'AI-HANDOFF-038',
      message: `archive contains ${fileCount} files and appears to be a repository dump rather than a focused change set`,
    })
  }

  if (isDirtyWorktree(options.targetRoot)) {
    summary.warnings.push({ ruleId: 'AI-HANDOFF-045', message: 'target working tree has uncommitted changes before apply' })
  }

  summary.canApply = summary.hardBlockers.length === 0
  return summary
}

export type ApplyOptions = {
  runId: string
  targetRoot: string
  /** Explicit human/system confirmation that warnings were reviewed. */
  acceptWarnings: boolean
  now?: () => Date
}

export function applyOverlay(
  zipPath: string,
  inspection: OverlayInspectionSummary,
  options: ApplyOptions,
): AppliedFiles {
  if (!inspection.canApply) {
    throw new Error('refusing to apply: overlay inspection recorded hard blockers')
  }
  if (inspection.warnings.length > 0 && !options.acceptWarnings) {
    throw new Error('refusing to apply: warnings present and not explicitly accepted')
  }

  const zip = new AdmZip(zipPath)
  const applied: AppliedFiles = {
    runId: options.runId,
    appliedAt: (options.now?.() ?? new Date()).toISOString(),
    files: [],
  }

  for (const entry of inspection.normalizedEntries) {
    if (entry.isDirectory) continue
    const zipEntry = zip.getEntry(entry.originalPath)
    if (!zipEntry) {
      throw new Error(`inspected entry missing from archive at apply time: ${entry.originalPath}`)
    }
    const data = zipEntry.getData()
    const existed = fs.existsSync(entry.targetPath)
    if (existed) {
      const current = fs.readFileSync(entry.targetPath)
      if (current.equals(data)) {
        applied.files.push({ relativePath: entry.normalizedRelativePath, action: 'unchanged', sizeBytes: data.length })
        continue
      }
    }
    fs.mkdirSync(path.dirname(entry.targetPath), { recursive: true })
    fs.writeFileSync(entry.targetPath, data)
    applied.files.push({
      relativePath: entry.normalizedRelativePath,
      action: existed ? 'overwritten' : 'created',
      sizeBytes: data.length,
    })
  }

  return applied
}
