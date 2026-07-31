/**
 * Stable IDs, revisions, and content hashing for design-workflow records.
 * Shared by EUC-01..EUC-17. Deterministic: the same input produces the same
 * output (§24.1 "stable IDs; deterministic hashes; stable sorting").
 */

import { canonicalHash } from '../hash.js'

export { canonicalHash }

/** Slug for stable, human-readable record ids. */
export function stableSlug(text: string): string {
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (normalized.length <= 64) return normalized
  // A plain prefix truncation makes two long semantic paths with the same
  // opening segments collapse to one ID (for example two activity flows
  // leaving the same decision). Retain a readable prefix and append a stable
  // digest so long discriminators remain deterministic and collision-safe.
  return `${normalized.slice(0, 51).replace(/-+$/g, '')}-${canonicalHash(normalized).slice(0, 12)}`
}

/** Deterministic child id: parent id + discriminator. */
export function childId(parentId: string, kind: string, discriminator: string): string {
  return `${parentId}.${kind}.${stableSlug(discriminator)}`
}

/** Revisions are `r<number>`; the first revision is `r1`. */
export function firstRevision(): string {
  return 'r1'
}

export function nextRevision(revision: string): string {
  const match = /^r(\d+)$/.exec(revision)
  if (!match) throw new Error(`invalid revision: ${revision}`)
  return `r${Number(match[1]) + 1}`
}

export function compareRevisions(a: string, b: string): number {
  const na = Number(/^r(\d+)$/.exec(a)?.[1] ?? NaN)
  const nb = Number(/^r(\d+)$/.exec(b)?.[1] ?? NaN)
  if (Number.isNaN(na) || Number.isNaN(nb)) throw new Error(`invalid revision comparison: ${a} vs ${b}`)
  return na - nb
}

/**
 * Content hash of a record, excluding volatile fields. The hash covers the
 * approved content, not the approval or the hash field itself.
 */
export function designContentHash(record: object): string {
  const { contentHash: _contentHash, approval: _approval, ...rest } = record as {
    contentHash?: unknown
    approval?: unknown
  }
  return canonicalHash(rest)
}

/** Stable sort for string keys: deterministic across platforms (§24.1). */
export function stableSortStrings(values: readonly string[]): string[] {
  return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

export function stableSortBy<T>(values: readonly T[], key: (value: T) => string): T[] {
  return [...values].sort((a, b) => {
    const ka = key(a)
    const kb = key(b)
    return ka < kb ? -1 : ka > kb ? 1 : 0
  })
}

/**
 * Normalizes a repository-relative path for overlap comparison: backslashes
 * become forward slashes, a leading `./` is stripped, and repeated/trailing
 * slashes are collapsed away, leaving normalized segments.
 */
function normalizeOwnedPathSegments(path: string): string[] {
  const slashed = path.replace(/\\/g, '/')
  const withoutLeadingDot = slashed.replace(/^\.\/+/, '')
  return withoutLeadingDot.split('/').filter((segment) => segment.length > 0)
}

/**
 * §6.2, §9.9: two owned paths overlap when they are equal, or when one is a
 * directory-prefix of the other (comparing normalized path segments, so
 * `src/adapters` and `src/adapters/git` overlap but `src/adapters` and
 * `src/adapters-extra` do not). Paths are normalized first: backslashes are
 * treated as forward slashes, a leading `./` is stripped, and trailing
 * slashes are ignored.
 */
export function ownedPathsOverlap(pathA: string, pathB: string): boolean {
  const segmentsA = normalizeOwnedPathSegments(pathA)
  const segmentsB = normalizeOwnedPathSegments(pathB)
  const shorter = segmentsA.length <= segmentsB.length ? segmentsA : segmentsB
  const longer = segmentsA.length <= segmentsB.length ? segmentsB : segmentsA
  if (shorter.length === 0) return longer.length === 0
  return shorter.every((segment, index) => segment === longer[index])
}
