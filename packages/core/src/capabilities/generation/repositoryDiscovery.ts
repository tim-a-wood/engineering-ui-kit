/**
 * Pure, evidence-based repository convention detection (CAP-ERA-001 §11.1
 * `repositoryDiscovery.ts`, §11.2 repository path proposal).
 *
 * This module never touches the filesystem. Callers (desktop/main process
 * code) collect a `RepositoryEvidence` snapshot — a file list plus parsed
 * manifest/CI contents — and pass it in. Given identical evidence, discovery
 * output is byte-identical regardless of array ordering or host path
 * separators (CAP-TEST-048/049).
 */

import type { RuntimeLanguage } from '../types.js'
import { normalizeRepoRelativePath, ordinalCompare, sortByKey, uniqueSorted } from './paths.js'

/** One file known to exist in the target repository. Any separator accepted. */
export type RepositoryFileEvidence = {
  path: string
}

/** A parsed package/dependency manifest found in the repository. */
export type RepositoryManifestEvidence = {
  path: string
  /** Parsed contents (e.g. `JSON.parse(readFileSync('package.json'))`). Never re-parsed here. */
  content: Record<string, unknown>
}

/** Parsed CI configuration evidence; the caller extracts the OS matrix, not this module. */
export type RepositoryCiEvidence = {
  path: string
  operatingSystems?: string[]
}

export type RepositoryEvidence = {
  /** Stable logical identifier for the target repository (not a filesystem path). */
  repositoryId: string
  files: RepositoryFileEvidence[]
  manifests?: RepositoryManifestEvidence[]
  ciConfigs?: RepositoryCiEvidence[]
}

export type AmbiguityChoice = {
  id: string
  question: string
  choices: string[]
}

export type RepositoryDiscoveryResult = {
  /** `'unknown'` when no lockfile/manifest evidence identifies a package manager. */
  packageManager: string
  /** Runtime languages with file-extension evidence, ordinally sorted. */
  languages: RuntimeLanguage[]
  /** Candidate source roots, ordinally sorted (evidence-derived; never a hard-coded `src/`). */
  sourceRoots: string[]
  /** Candidate test roots, ordinally sorted. */
  testRoots: string[]
  /** Candidate entry-point files, ordinally sorted. */
  entryPoints: string[]
  /** Known frameworks detected in manifest dependencies, ordinally sorted. */
  frameworks: string[]
  /** Existing composition-root-like files, ordinally sorted. */
  existingCompositionPaths: string[]
  /** CI-declared operating systems, ordinally sorted. */
  ciOperatingSystems: string[]
  /** Only genuinely ambiguous, evidence-backed choices (≥2 concrete options each). */
  ambiguities: AmbiguityChoice[]
}

const SOURCE_EXTENSION_LANGUAGE: Record<string, RuntimeLanguage> = {
  '.ts': 'typescript', '.tsx': 'typescript', '.js': 'typescript', '.jsx': 'typescript',
  '.mjs': 'typescript', '.cjs': 'typescript', '.py': 'python',
}

const LOCKFILE_PACKAGE_MANAGER: { file: string; manager: string }[] = [
  { file: 'pnpm-lock.yaml', manager: 'pnpm' },
  { file: 'yarn.lock', manager: 'yarn' },
  { file: 'bun.lockb', manager: 'bun' },
  { file: 'bun.lock', manager: 'bun' },
  { file: 'package-lock.json', manager: 'npm' },
  { file: 'poetry.lock', manager: 'poetry' },
  { file: 'Pipfile.lock', manager: 'pipenv' },
  { file: 'requirements.txt', manager: 'pip' },
]

const KNOWN_FRAMEWORKS = [
  'react', 'vue', 'svelte', '@angular/core', 'electron', 'vite', 'next', 'express', 'fastify',
  '@nestjs/core', 'fastapi', 'django', 'flask',
]

const TEST_SEGMENT_PATTERN = /^(test|tests|__tests__)$/i
const TEST_FILENAME_PATTERN = /\.(test|spec)\.[^./]+$/i
const COMPOSITION_PATTERN = /(^|\/)(composition|container|bootstrap)(\/|\.[^./]+$)/i

function extensionOf(file: string): string {
  const name = file.slice(file.lastIndexOf('/') + 1)
  const dotIndex = name.lastIndexOf('.')
  return dotIndex <= 0 ? '' : name.slice(dotIndex).toLowerCase()
}

function candidateSourceRoot(file: string): string | undefined {
  const segments = file.split('/')
  if (segments.length <= 1) return undefined
  const srcIndex = segments.findIndex((segment) => segment === 'src')
  if (srcIndex >= 0) return segments.slice(0, srcIndex + 1).join('/')
  return segments[0]
}

function candidateTestRoot(file: string): string | undefined {
  const segments = file.split('/')
  const testIndex = segments.findIndex((segment) => TEST_SEGMENT_PATTERN.test(segment))
  if (testIndex >= 0) return segments.slice(0, testIndex + 1).join('/')
  if (TEST_FILENAME_PATTERN.test(file)) return segments.length > 1 ? segments.slice(0, -1).join('/') : '.'
  return undefined
}

/** Count occurrences per candidate key, then return keys tied for the maximum count. */
function tiedForMax(counts: Map<string, number>): string[] {
  let max = 0
  for (const count of counts.values()) max = Math.max(max, count)
  if (max === 0) return []
  return [...counts.entries()].filter(([, count]) => count === max).map(([key]) => key)
}

function dependencyNames(content: Record<string, unknown>): string[] {
  const names = new Set<string>()
  const addFrom = (value: unknown) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const key of Object.keys(value as Record<string, unknown>)) names.add(key)
    } else if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === 'string') names.add(entry.split(/[<>=~^ ]/)[0] ?? entry)
      }
    }
  }
  addFrom(content['dependencies'])
  addFrom(content['devDependencies'])
  // pyproject.toml (PEP 621) and Poetry shapes, parsed generically.
  const project = content['project']
  if (project && typeof project === 'object') addFrom((project as Record<string, unknown>)['dependencies'])
  const tool = content['tool']
  if (tool && typeof tool === 'object') {
    const poetry = (tool as Record<string, unknown>)['poetry']
    if (poetry && typeof poetry === 'object') addFrom((poetry as Record<string, unknown>)['dependencies'])
  }
  return [...names]
}

function entryPointsFromManifest(content: Record<string, unknown>): string[] {
  const entries: string[] = []
  for (const field of ['main', 'module'] as const) {
    const value = content[field]
    if (typeof value === 'string' && value.trim()) entries.push(value)
  }
  const bin = content['bin']
  if (typeof bin === 'string' && bin.trim()) entries.push(bin)
  else if (bin && typeof bin === 'object') {
    for (const value of Object.values(bin as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim()) entries.push(value)
    }
  }
  return entries
}

/**
 * Detect package manager, languages, source/test roots, entry points,
 * frameworks, existing composition, and CI OS evidence from supplied
 * repository evidence. Surfaces only material, evidence-backed ambiguity.
 */
export function discoverRepository(evidence: RepositoryEvidence): RepositoryDiscoveryResult {
  const files = evidence.files.map((file) => normalizeRepoRelativePath(file.path))

  // Package manager: precedence order, but a genuine tie across the first-seen
  // priority band still resolves deterministically to the highest-priority
  // manager while surfacing the ambiguity for the user to confirm.
  const presentLockfiles = LOCKFILE_PACKAGE_MANAGER.filter(({ file }) => files.includes(file))
  const distinctManagers = uniqueSorted(presentLockfiles.map(({ manager }) => manager))
  const packageManager = presentLockfiles[0]?.manager ?? 'unknown'
  const ambiguities: AmbiguityChoice[] = []
  if (distinctManagers.length > 1) {
    ambiguities.push({
      id: 'package-manager',
      question: 'Multiple package-manager lockfiles were found. Which package manager should generation target?',
      choices: distinctManagers,
    })
  }

  // Languages: file-extension evidence only.
  const languageCounts = new Map<RuntimeLanguage, number>()
  for (const file of files) {
    const language = SOURCE_EXTENSION_LANGUAGE[extensionOf(file)]
    if (language) languageCounts.set(language, (languageCounts.get(language) ?? 0) + 1)
  }
  const languages = [...languageCounts.keys()].sort(ordinalCompare)

  // Source and test roots.
  const testRootCounts = new Map<string, number>()
  const sourceRootCounts = new Map<string, number>()
  for (const file of files) {
    const testRoot = candidateTestRoot(file)
    if (testRoot) {
      testRootCounts.set(testRoot, (testRootCounts.get(testRoot) ?? 0) + 1)
      continue
    }
    if (!SOURCE_EXTENSION_LANGUAGE[extensionOf(file)]) continue
    const sourceRoot = candidateSourceRoot(file)
    if (sourceRoot) sourceRootCounts.set(sourceRoot, (sourceRootCounts.get(sourceRoot) ?? 0) + 1)
  }
  const sourceRoots = uniqueSorted([...sourceRootCounts.keys()])
  const testRoots = uniqueSorted([...testRootCounts.keys()])
  if (sourceRootCounts.size > 1) {
    const tied = tiedForMax(sourceRootCounts)
    if (tied.length > 1) {
      ambiguities.push({
        id: 'source-root',
        question: 'Multiple candidate source roots have equal file-count evidence. Which is the primary source root?',
        choices: uniqueSorted(tied),
      })
    }
  }

  // Frameworks and entry points from manifest evidence.
  const frameworkNames = new Set<string>()
  const entryPoints = new Set<string>()
  for (const manifest of evidence.manifests ?? []) {
    const names = dependencyNames(manifest.content)
    for (const framework of KNOWN_FRAMEWORKS) if (names.includes(framework)) frameworkNames.add(framework)
    for (const entry of entryPointsFromManifest(manifest.content)) {
      entryPoints.add(normalizeRepoRelativePath(entry))
    }
  }
  // Conventional entry points present as real files, evidence-backed rather than assumed.
  for (const file of files) {
    if (/(^|\/)(index)\.(ts|tsx|js|jsx)$/i.test(file) || /(^|\/)(main|app)\.py$/i.test(file)) {
      entryPoints.add(file)
    }
  }

  const existingCompositionPaths = files.filter((file) => COMPOSITION_PATTERN.test(file))

  const ciOperatingSystems = uniqueSorted(
    (evidence.ciConfigs ?? []).flatMap((ci) => ci.operatingSystems ?? []),
  )

  return {
    packageManager,
    languages,
    sourceRoots,
    testRoots,
    entryPoints: uniqueSorted([...entryPoints]),
    frameworks: uniqueSorted([...frameworkNames]),
    existingCompositionPaths: sortByKey(uniqueSorted(existingCompositionPaths), (path) => path),
    ciOperatingSystems,
    ambiguities: sortByKey(ambiguities, (item) => item.id),
  }
}
