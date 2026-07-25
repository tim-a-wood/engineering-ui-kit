/**
 * Stable IDs, revisions, and content hashing for design-workflow records.
 * Shared by EUC-01..EUC-17. Deterministic: the same input produces the same
 * output (§24.1 "stable IDs; deterministic hashes; stable sorting").
 */

import { canonicalHash } from '../hash.js'

export { canonicalHash }

/** Slug for stable, human-readable record ids. */
export function stableSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
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

/** Stable sort for string keys — deterministic across platforms (§24.1). */
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
