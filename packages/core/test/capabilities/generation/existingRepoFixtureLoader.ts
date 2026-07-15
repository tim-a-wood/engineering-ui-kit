/**
 * Test-only helper (CAP-TEST-054): reads a static existing-repo fixture tree
 * from disk with `node:fs` and builds a `RepositoryEvidence` snapshot from
 * it. `node:fs` usage is confined to this test helper — the pure planning
 * modules under `src/capabilities/generation/` never touch the filesystem.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { RepositoryEvidence, RepositoryManifestEvidence } from '../../../src/capabilities/generation/repositoryDiscovery.js'

function listFilesRecursively(root: string, directory: string): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(root, absolute))
    } else if (entry.isFile()) {
      files.push(path.relative(root, absolute).split(path.sep).join('/'))
    }
  }
  return files
}

/** Parse a pip `requirements.txt`'s package names (ignoring version pins, comments, blank lines). */
function parseRequirementsTxt(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => line.split(/[<>=~! ]/)[0] ?? line)
    .filter((name) => name.length > 0)
}

/**
 * Read every file under `fixtureRoot` and build a `RepositoryEvidence`
 * snapshot: every file's repo-relative path, `package.json` manifests
 * (parsed as JSON, as a real caller would), and `requirements.txt` files
 * represented as a `{ dependencies: [...] }` manifest (matching the shape
 * `dependencyNames()` in `repositoryDiscovery.ts` already understands for a
 * dependency array — no TOML/pip parser is required for this evidence-only
 * fixture loader).
 */
export function loadExistingRepoEvidence(fixtureRoot: string, repositoryId: string): RepositoryEvidence {
  const files = listFilesRecursively(fixtureRoot, fixtureRoot).sort()
  const manifests: RepositoryManifestEvidence[] = []
  for (const file of files) {
    const absolute = path.join(fixtureRoot, file)
    if (file.endsWith('package.json')) {
      manifests.push({ path: file, content: JSON.parse(fs.readFileSync(absolute, 'utf8')) })
    } else if (file.endsWith('requirements.txt')) {
      const dependencies = parseRequirementsTxt(fs.readFileSync(absolute, 'utf8'))
      manifests.push({ path: file, content: { dependencies } })
    }
  }
  return {
    repositoryId,
    files: files.map((file) => ({ path: file })),
    manifests,
  }
}
