/**
 * Small, dependency-free manifest readers used by privileged repository
 * discovery. They intentionally extract dependency names only; the desktop
 * does not need a complete TOML interpreter to identify host frameworks.
 */

function dependencyName(requirement: string): string | undefined {
  const withoutMarker = requirement.split(';', 1)[0]?.trim()
  if (!withoutMarker || withoutMarker.startsWith('-')) return undefined
  const name = withoutMarker.split(/[<>=~! \[]/, 1)[0]?.trim()
  return name || undefined
}

/** Minimal `requirements.txt` -> pseudo-manifest dependency map. */
export function requirementsTxtDependencies(text: string): Record<string, string> {
  const dependencies: Record<string, string> = {}
  for (const rawLine of text.split(/\r?\n/)) {
    const name = dependencyName(rawLine.split('#', 1)[0] ?? '')
    if (name) dependencies[name] = ''
  }
  return dependencies
}

function stripTomlComment(line: string): string {
  let quote: '"' | "'" | undefined
  let escaped = false
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (quote) {
      if (quote === '"' && character === '\\' && !escaped) {
        escaped = true
        continue
      }
      if (character === quote && !escaped) quote = undefined
      escaped = false
      continue
    }
    if (character === '"' || character === "'") quote = character
    else if (character === '#') return line.slice(0, index)
  }
  return line
}

function quotedStrings(value: string): string[] {
  const strings: string[] = []
  const pattern = /(["'])(.*?)\1/g
  for (const match of value.matchAll(pattern)) strings.push(match[2] ?? '')
  return strings
}

/**
 * Extract the two dependency shapes consumed by core repository discovery:
 * PEP 621 `[project].dependencies` and Poetry `[tool.poetry.dependencies]`.
 * Malformed or dynamic TOML contributes no invented evidence.
 */
export function pyprojectManifestContent(text: string): Record<string, unknown> {
  const projectDependencies: string[] = []
  const poetryDependencies: Record<string, string> = {}
  const lines = text.split(/\r?\n/)
  let section = ''

  for (let index = 0; index < lines.length; index += 1) {
    const line = stripTomlComment(lines[index] ?? '').trim()
    if (!line) continue
    const sectionMatch = /^\[([^\]]+)\]$/.exec(line)
    if (sectionMatch) {
      section = sectionMatch[1]?.trim() ?? ''
      continue
    }

    if (section === 'project' && /^dependencies\s*=/.test(line)) {
      let value = line.slice(line.indexOf('=') + 1)
      while (!value.includes(']') && index + 1 < lines.length) {
        index += 1
        value += `\n${stripTomlComment(lines[index] ?? '')}`
      }
      for (const requirement of quotedStrings(value)) {
        const name = dependencyName(requirement)
        if (name) projectDependencies.push(requirement.trim())
      }
      continue
    }

    if (section === 'tool.poetry.dependencies') {
      const keyMatch = /^([A-Za-z0-9_.-]+|"[^"]+"|'[^']+')\s*=/.exec(line)
      const key = keyMatch?.[1]?.replace(/^["']|["']$/g, '')
      if (key && key.toLowerCase() !== 'python') poetryDependencies[key] = ''
    }
  }

  const content: Record<string, unknown> = {}
  if (projectDependencies.length > 0) content.project = { dependencies: projectDependencies }
  if (Object.keys(poetryDependencies).length > 0) {
    content.tool = { poetry: { dependencies: poetryDependencies } }
  }
  return content
}

const SKIP_DIRECTORIES = new Set([
  '.git', '.idea', '.next', '.turbo', '.venv', 'build', 'coverage', 'dist',
  'node_modules', 'out', 'target', 'vendor',
])

/** Bounded, symlink-safe repository file walk for privileged discovery. */
export function walkRepositoryFilePaths(root: string, maxFiles = 5000): string[] {
  const files: string[] = []
  const visit = (directory: string): void => {
    if (files.length >= maxFiles) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (files.length >= maxFiles) break
      if (entry.isSymbolicLink()) continue
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry.name)) visit(absolute)
      } else if (entry.isFile()) {
        files.push(path.relative(root, absolute).split(path.sep).join('/'))
      }
    }
  }
  visit(root)
  return files
}

/** Live evidence shared by foundation proposal and existing-repository adoption preview. */
export function buildRepositoryEvidence(repoRoot: string): RepositoryEvidence {
  const root = path.resolve(repoRoot)
  const files = walkRepositoryFilePaths(root).map((filePath) => ({ path: filePath }))
  const manifests: RepositoryManifestEvidence[] = []
  const packageJsonPath = path.join(root, 'package.json')
  if (fs.existsSync(packageJsonPath)) {
    try {
      manifests.push({ path: 'package.json', content: JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) })
    } catch {
      // Malformed manifests contribute no invented dependency evidence.
    }
  }
  const requirementsPath = path.join(root, 'requirements.txt')
  if (fs.existsSync(requirementsPath)) {
    manifests.push({
      path: 'requirements.txt',
      content: { dependencies: requirementsTxtDependencies(fs.readFileSync(requirementsPath, 'utf8')) },
    })
  }
  const pyprojectPath = path.join(root, 'pyproject.toml')
  if (fs.existsSync(pyprojectPath)) {
    manifests.push({ path: 'pyproject.toml', content: pyprojectManifestContent(fs.readFileSync(pyprojectPath, 'utf8')) })
  }
  return { repositoryId: root, files, manifests }
}
import fs from 'node:fs'
import path from 'node:path'

import type { RepositoryEvidence, RepositoryManifestEvidence } from '@engineering-ui-kit/core'
