/**
 * Pure path and ordering helpers shared across `generation/*` (CAP-ERA-001 §11.1).
 *
 * Every planning function in this directory must produce byte-identical output
 * regardless of input ordering, host path separators, or locale. This module is
 * the single place that normalizes paths and orders collections so those rules
 * are enforced consistently — never `node:path`, never `Array.prototype.sort`
 * with `localeCompare` (locale-sensitive), never `Date.now()`/`Math.random()`.
 */

/** Convert any host path separator to POSIX and strip redundant `./`, `//`, and trailing `/`. */
export function toPosixPath(value: string): string {
  const posix = value.replace(/\\/g, '/')
  const collapsed = posix.replace(/\/{2,}/g, '/')
  const withoutLeadingDot = collapsed.replace(/^(\.\/)+/, '')
  const withoutTrailingSlash = withoutLeadingDot.length > 1 && withoutLeadingDot.endsWith('/')
    ? withoutLeadingDot.slice(0, -1)
    : withoutLeadingDot
  return withoutTrailingSlash === '' ? '.' : withoutTrailingSlash
}

/** Normalize a repository-relative path for canonical, cross-host comparison and output. */
export function normalizeRepoRelativePath(value: string): string {
  return toPosixPath(value)
}

/**
 * Locale-independent ordinal string comparison (UTF-16 code-unit order).
 * `String.prototype.localeCompare` MUST NOT be used in `generation/*`: its
 * result can vary by host locale/ICU data, which would break determinism.
 */
export function ordinalCompare(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/** Stable sort of a copy of `items` by an ordinal string key. */
export function sortByKey<T>(items: readonly T[], key: (item: T) => string): T[] {
  return [...items]
    .map((item, index) => ({ item, index, sortKey: key(item) }))
    .sort((a, b) => ordinalCompare(a.sortKey, b.sortKey) || a.index - b.index)
    .map(({ item }) => item)
}

/** Deduplicated, ordinally sorted copy of `values`. */
export function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(ordinalCompare)
}
