/** Live, bounded repository discovery for implementation handoffs. */

import fs from 'node:fs'
import path from 'node:path'
import type { RepositoryImplementationContext } from './implementationBrief.js'

const SKIP_DIRECTORIES = new Set([
  '.git', '.idea', '.next', '.turbo', '.venv', 'build', 'coverage', 'dist',
  'node_modules', 'out', 'target', 'vendor',
])

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  '.c': 'C', '.cc': 'C++', '.cpp': 'C++', '.cs': 'C#', '.css': 'CSS', '.f': 'Fortran',
  '.f90': 'Fortran', '.go': 'Go', '.html': 'HTML', '.java': 'Java', '.js': 'JavaScript',
  '.jsx': 'JavaScript/JSX', '.kt': 'Kotlin', '.m': 'MATLAB/Objective-C', '.mm': 'Objective-C++',
  '.php': 'PHP', '.py': 'Python', '.rb': 'Ruby', '.rs': 'Rust', '.scala': 'Scala',
  '.swift': 'Swift', '.ts': 'TypeScript', '.tsx': 'TypeScript/TSX', '.vue': 'Vue',
}

const ROOT_MANIFESTS = [
  'package.json', 'pnpm-workspace.yaml', 'pyproject.toml', 'requirements.txt', 'Pipfile',
  'Cargo.toml', 'go.mod', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle',
  'composer.json', 'Gemfile', 'CMakeLists.txt', 'Makefile', 'Directory.Build.props',
]

const CONFIG_FILE_PATTERN = /(^|\/)(tsconfig(?:\.[^/]+)?\.json|vite\.config\.[^/]+|webpack\.config\.[^/]+|eslint\.config\.[^/]+|\.eslintrc(?:\.[^/]+)?|pytest\.ini|tox\.ini|setup\.cfg|mypy\.ini|rust-toolchain(?:\.toml)?|\.golangci\.ya?ml)$/i

function toPosix(value: string): string {
  return value.split(path.sep).join('/')
}

function safePath(root: string, relative: string): string | undefined {
  const absolute = path.resolve(root, relative)
  const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`
  return absolute === root || absolute.startsWith(prefix) ? absolute : undefined
}

function walk(root: string, maxFiles = 5000): string[] {
  const files: string[] = []
  const visit = (directory: string) => {
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
        files.push(toPosix(path.relative(root, absolute)))
      }
    }
  }
  visit(root)
  return files
}

function packageDetails(root: string): {
  frameworks: string[]
  scripts: Record<string, string>
} {
  const packagePath = path.join(root, 'package.json')
  if (!fs.existsSync(packagePath)) return { frameworks: [], scripts: {} }
  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      scripts?: Record<string, string>
    }
    const dependencies = { ...pkg.dependencies, ...pkg.devDependencies }
    const known = [
      'react', 'vue', 'svelte', 'angular', 'electron', 'vite', 'next', 'express', 'fastify',
      'nestjs', 'typescript', 'jest', 'vitest', 'playwright',
    ]
    return {
      frameworks: known.filter((name) => name in dependencies),
      scripts: pkg.scripts ?? {},
    }
  } catch {
    return { frameworks: [], scripts: {} }
  }
}

function packageManager(root: string): string {
  if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm'
  if (fs.existsSync(path.join(root, 'yarn.lock'))) return 'yarn'
  if (fs.existsSync(path.join(root, 'bun.lockb')) || fs.existsSync(path.join(root, 'bun.lock'))) return 'bun'
  if (fs.existsSync(path.join(root, 'package-lock.json'))) return 'npm'
  if (fs.existsSync(path.join(root, 'poetry.lock'))) return 'poetry'
  if (fs.existsSync(path.join(root, 'Cargo.toml'))) return 'cargo'
  if (fs.existsSync(path.join(root, 'go.mod'))) return 'go modules'
  if (fs.existsSync(path.join(root, 'pom.xml'))) return 'maven'
  if (fs.existsSync(path.join(root, 'build.gradle')) || fs.existsSync(path.join(root, 'build.gradle.kts'))) return 'gradle'
  return 'unknown'
}

function isTestFile(file: string): boolean {
  return /(^|\/)(test|tests|__tests__)\//i.test(file) || /\.(test|spec)\.[^.]+$/i.test(file)
}

export function discoverRepositoryImplementationContext(input: {
  repoRoot: string
  allowedPaths: string[]
  verificationCommands?: Record<string, string | undefined>
}): RepositoryImplementationContext {
  const root = path.resolve(input.repoRoot)
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`repo path does not exist or is not a directory: ${input.repoRoot}`)
  }
  const files = walk(root)
  const languageCounts = new Map<string, number>()
  for (const file of files) {
    const language = LANGUAGE_BY_EXTENSION[path.extname(file).toLowerCase()]
    if (language) languageCounts.set(language, (languageCounts.get(language) ?? 0) + 1)
  }
  const detectedLanguages = [...languageCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([language]) => language)
  const ownedPaths = input.allowedPaths.map((relative) => {
    const absolute = safePath(root, relative)
    if (!absolute || !fs.existsSync(absolute)) return { path: relative, exists: false, kind: 'missing' as const }
    return {
      path: relative,
      exists: true,
      kind: fs.statSync(absolute).isDirectory() ? 'directory' as const : 'file' as const,
    }
  })
  const existingFilesInScope = files.filter((file) => input.allowedPaths.some((allowed) => {
    const normalized = toPosix(allowed).replace(/^\.\//, '')
    return file === normalized || file.startsWith(normalized.endsWith('/') ? normalized : `${normalized}/`)
  })).slice(0, 80)
  const sourceFiles = files.filter((file) => LANGUAGE_BY_EXTENSION[path.extname(file).toLowerCase()])
  const ownedTokens = new Set(
    input.allowedPaths
      .flatMap((allowed) => toPosix(allowed).toLowerCase().split('/'))
      .filter((token) => token && !['src', 'app', 'lib', 'packages', 'modules', 'capabilities'].includes(token)),
  )
  const inScopeExtensions = new Set(existingFilesInScope.map((file) => path.extname(file).toLowerCase()))
  const nearbyPatternFiles = sourceFiles
    .filter((file) => !existingFilesInScope.includes(file))
    .filter((file) => /(^|\/)(src|app|lib|packages|modules|services|domain|adapters?)\//i.test(file))
    .map((file) => {
      const lower = file.toLowerCase()
      const tokenScore = [...ownedTokens].filter((token) => lower.split('/').includes(token)).length * 4
      const extensionScore = inScopeExtensions.has(path.extname(file).toLowerCase()) ? 2 : 0
      const sameRootScore = input.allowedPaths.some((allowed) => lower.startsWith(`${toPosix(allowed).toLowerCase().split('/')[0]}/`)) ? 1 : 0
      return { file, score: tokenScore + extensionScore + sameRootScore }
    })
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))
    .map(({ file }) => file)
    .slice(0, 30)
  const sourceRoots = [...new Set(sourceFiles.map((file) => file.includes('/') ? file.split('/')[0]! : '.').filter(Boolean))].slice(0, 12)
  const manifestFiles = files.filter((file) =>
    ROOT_MANIFESTS.includes(file)
    || /\.(sln|csproj|fsproj|vbproj)$/i.test(file)
    || CONFIG_FILE_PATTERN.test(file),
  ).slice(0, 30)
  const packageInfo = packageDetails(root)
  const configuredVerificationCommands = Object.fromEntries(
    Object.entries(input.verificationCommands ?? {})
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && Boolean(entry[1].trim())),
  )
  return {
    repositoryName: path.basename(root),
    detectedLanguages,
    detectedFrameworks: packageInfo.frameworks,
    detectedPackageManager: packageManager(root),
    manifestFiles,
    sourceRoots,
    packageScripts: packageInfo.scripts,
    configuredVerificationCommands,
    ownedPaths,
    existingFilesInScope,
    nearbyPatternFiles,
    testFiles: files.filter(isTestFile).slice(0, 80),
  }
}
