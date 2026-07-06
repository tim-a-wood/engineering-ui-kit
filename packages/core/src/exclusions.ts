/**
 * Deterministic context-exclusion engine.
 *
 * Implements `standards/copilot-handoff/context-exclusions.md`: git metadata,
 * dependencies, lockfiles, build output, caches, binaries, archives, and
 * env/secret material never enter a repo flatfile. Decisions are pure functions
 * of the repo-relative path so two runs over the same tree agree exactly.
 */

export type ExclusionDecision = {
  excluded: boolean
  reason?: string
}

const EXCLUDED_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  '.cache',
  '.turbo',
  '.next',
  '.vite',
  '.idea',
  '.vscode',
  '__pycache__',
  '.venv',
  'venv',
])

const EXCLUDED_FILE_NAMES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
  '.DS_Store',
  'Thumbs.db',
])

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.tiff',
  '.pdf', '.zip', '.gz', '.tar', '.tgz', '.7z', '.rar',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.mp3', '.mp4', '.mov', '.avi', '.webm',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.node', '.wasm',
  '.pyc', '.class', '.jar',
])

const SECRET_FILE_PATTERNS: { test: (name: string) => boolean; reason: string }[] = [
  { test: (n) => n === '.env' || n.startsWith('.env.'), reason: 'environment file' },
  { test: (n) => n.endsWith('.pem') || n.endsWith('.key') || n.endsWith('.crt') || n.endsWith('.pfx') || n.endsWith('.p12'), reason: 'key or certificate material' },
  { test: (n) => n.includes('credential') || n.includes('secret'), reason: 'credential-named file' },
  { test: (n) => n === 'id_rsa' || n === 'id_ed25519' || n.startsWith('id_rsa.') || n.startsWith('id_ed25519.'), reason: 'ssh key material' },
]

/** Content patterns that raise warnings (never silent) during context review. */
const SECRET_CONTENT_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, label: 'private key block' },
  { re: /\bAKIA[0-9A-Z]{16}\b/, label: 'AWS access key id' },
  { re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/, label: 'GitHub token' },
  { re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, label: 'Slack token' },
  { re: /\b(?:api[_-]?key|secret|token|password)\b\s*[:=]\s*['"][^'"\s]{8,}['"]/i, label: 'assigned secret-like literal' },
]

/** Decide whether a repo-relative POSIX path is excluded from context. */
export function decideExclusion(relativePath: string): ExclusionDecision {
  const segments = relativePath.split('/')
  const fileName = segments[segments.length - 1] ?? relativePath

  for (const segment of segments.slice(0, -1)) {
    if (EXCLUDED_DIR_NAMES.has(segment)) {
      return { excluded: true, reason: `directory '${segment}' is excluded (dependencies, VCS metadata, build output, or caches)` }
    }
  }

  if (EXCLUDED_FILE_NAMES.has(fileName)) {
    return { excluded: true, reason: `file '${fileName}' is excluded (lockfile or OS metadata)` }
  }

  for (const pattern of SECRET_FILE_PATTERNS) {
    if (pattern.test(fileName.toLowerCase())) {
      return { excluded: true, reason: `likely ${pattern.reason}` }
    }
  }

  const dot = fileName.lastIndexOf('.')
  const ext = dot >= 0 ? fileName.slice(dot).toLowerCase() : ''
  if (BINARY_EXTENSIONS.has(ext)) {
    return { excluded: true, reason: `binary or archive extension '${ext}'` }
  }

  return { excluded: false }
}

/**
 * Scan file content for secret-like patterns. Matches are warnings for human
 * review, not proof; the flatfile header must keep saying so.
 */
export function scanContentWarnings(relativePath: string, content: string): string[] {
  const warnings: string[] = []
  for (const { re, label } of SECRET_CONTENT_PATTERNS) {
    if (re.test(content)) {
      warnings.push(`${relativePath}: possible ${label} matched pattern review`)
    }
  }
  return warnings
}
