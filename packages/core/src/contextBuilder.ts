/**
 * Repo context and inventory builder.
 *
 * Walks a target repo root, applies the deterministic exclusion engine,
 * produces a `RepoInventory` (PRD §28.3) and a contract-conformant repo
 * flatfile. Never reads excluded content into the flatfile; secret-pattern
 * matches surface as context warnings for human review.
 */

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { decideExclusion, scanContentWarnings } from './exclusions.js'
import { serializeFlatfile, type FlatfileEntry, type FlatfileHeader } from './flatfile.js'
import type { RepoInventory } from './types.js'

export type ContextBuildOptions = {
  projectId: string
  packetId: string
  sourceRepo: string
  /** Repo-relative posix source root recorded in the header (informational). */
  sourceRoot?: string
  now?: () => Date
}

export type ContextBuildResult = {
  inventory: RepoInventory
  flatfileText: string
  includedFiles: { path: string; content: string }[]
}

function walk(root: string, dir: string, files: string[]): void {
  const dirents = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
  for (const dirent of dirents) {
    const abs = path.join(dir, dirent.name)
    if (dirent.isSymbolicLink()) continue
    if (dirent.isDirectory()) {
      walk(root, abs, files)
    } else if (dirent.isFile()) {
      files.push(path.relative(root, abs).split(path.sep).join('/'))
    }
  }
}

function detectBaselineCommit(repoPath: string): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoPath, encoding: 'utf8' }).trim()
  } catch {
    return 'no-git-baseline'
  }
}

function detectPackageManager(repoPath: string): RepoInventory['detectedPackageManager'] {
  if (fs.existsSync(path.join(repoPath, 'pnpm-lock.yaml'))) return 'pnpm'
  if (fs.existsSync(path.join(repoPath, 'yarn.lock'))) return 'yarn'
  if (fs.existsSync(path.join(repoPath, 'package-lock.json'))) return 'npm'
  return 'unknown'
}

function detectFrameworks(repoPath: string): { frameworks: string[]; scripts: Record<string, string> } {
  const pkgPath = path.join(repoPath, 'package.json')
  if (!fs.existsSync(pkgPath)) return { frameworks: [], scripts: {} }
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      scripts?: Record<string, string>
    }
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    const frameworks: string[] = []
    if (deps['react']) frameworks.push('react')
    if (deps['vite']) frameworks.push('vite')
    if (deps['typescript']) frameworks.push('typescript')
    if (deps['electron']) frameworks.push('electron')
    if (deps['vue']) frameworks.push('vue')
    if (deps['svelte']) frameworks.push('svelte')
    return { frameworks, scripts: pkg.scripts ?? {} }
  } catch {
    return { frameworks: [], scripts: {} }
  }
}

export function buildContext(repoPath: string, options: ContextBuildOptions): ContextBuildResult {
  if (!fs.existsSync(repoPath) || !fs.statSync(repoPath).isDirectory()) {
    throw new Error(`repo path does not exist or is not a directory: ${repoPath}`)
  }

  const allFiles: string[] = []
  walk(repoPath, repoPath, allFiles)

  const included: { path: string; content: string }[] = []
  const excludedPaths: RepoInventory['excludedPaths'] = []
  const contextWarnings: string[] = []

  for (const relative of allFiles) {
    const decision = decideExclusion(relative)
    if (decision.excluded) {
      excludedPaths.push({ path: relative, reason: decision.reason ?? 'excluded' })
      continue
    }
    const abs = path.join(repoPath, relative)
    const buffer = fs.readFileSync(abs)
    if (buffer.includes(0)) {
      excludedPaths.push({ path: relative, reason: 'binary content (NUL byte detected)' })
      continue
    }
    const content = buffer.toString('utf8')
    contextWarnings.push(...scanContentWarnings(relative, content))
    included.push({ path: relative, content })
  }

  const generatedAt = (options.now?.() ?? new Date()).toISOString().replace(/\.\d{3}Z$/, 'Z')
  const { frameworks, scripts } = detectFrameworks(repoPath)

  const inventory: RepoInventory = {
    projectId: options.projectId,
    repoPath,
    generatedAt,
    detectedFrameworks: frameworks,
    detectedPackageManager: detectPackageManager(repoPath),
    packageScripts: scripts,
    includedFiles: included.map((f) => f.path),
    excludedPaths,
    contextWarnings,
    sourceFileCount: allFiles.length,
    includedFileCount: included.length,
    excludedFileCount: excludedPaths.length,
  }

  const header: FlatfileHeader = {
    packetId: options.packetId,
    sourceRepo: options.sourceRepo,
    sourceRoot: options.sourceRoot ?? '.',
    baselineCommit: detectBaselineCommit(repoPath),
    generatedAt,
    includedFiles: included.length,
    excludedSummary:
      'git metadata, dependencies, lockfile, build output, caches, binaries, archives, env/secrets, and all files outside the target app',
    secretsGuarantee: 'none — exclusions reduce risk but are not secret detection',
  }

  const entries: FlatfileEntry[] = included.map((f) => ({ path: f.path, content: f.content }))
  return { inventory, flatfileText: serializeFlatfile(header, entries), includedFiles: included }
}
