/**
 * Visual-fidelity census.
 *
 * Counts user-visible markup elements in text sources (TSX/JSX/HTML/etc.) and
 * in rendered DOM snapshots so the workflow can detect *loss* — an overlay or
 * transformation that silently drops icons, images, or interactive elements.
 * Static counts are heuristics over source text, not a render; they exist to
 * catch the common failure where a model regenerates a file and elides
 * `<svg>` blocks. Rendered counts (evidence capture) are authoritative.
 */

/** Elements whose disappearance almost always means visual regression. */
export const CENSUS_ELEMENTS = [
  'svg',
  'img',
  'button',
  'input',
  'select',
  'textarea',
  'a',
  'table',
  'canvas',
  'video',
] as const

export type CensusElement = (typeof CENSUS_ELEMENTS)[number]

/** element name -> occurrence count */
export type ElementCensus = Record<string, number>

/** File extensions whose contents are markup-bearing and worth censusing. */
const CENSUS_FILE_EXTENSIONS = new Set([
  '.tsx', '.jsx', '.html', '.htm', '.vue', '.svelte', '.astro', '.mdx',
])

export function isCensusableFile(relativePath: string): boolean {
  const dot = relativePath.lastIndexOf('.')
  if (dot < 0) return false
  return CENSUS_FILE_EXTENSIONS.has(relativePath.slice(dot).toLowerCase())
}

/** NUL byte in the first 8 KiB marks content as binary (same rule the inspector uses). */
export function isProbablyText(data: Buffer): boolean {
  return !data.subarray(0, 8192).includes(0)
}

/**
 * Count opening tags for each census element in source text. Matches
 * `<svg>`, `<svg …`, and `<svg/>` forms; case-insensitive so plain HTML and
 * JSX both count. Custom components (`<Icon …>`) are intentionally not
 * counted — only concrete elements render pixels.
 */
export function countMarkupElements(source: string): ElementCensus {
  const census: ElementCensus = {}
  for (const element of CENSUS_ELEMENTS) {
    const re = new RegExp(`<${element}(?=[\\s>/])`, 'gi')
    const matches = source.match(re)
    census[element] = matches ? matches.length : 0
  }
  return census
}

export type ElementLoss = { element: string; before: number; after: number }

/** Elements whose count dropped between two censuses (losses only). */
export function diffCensusLosses(before: ElementCensus, after: ElementCensus): ElementLoss[] {
  const losses: ElementLoss[] = []
  for (const element of Object.keys(before)) {
    const b = before[element] ?? 0
    const a = after[element] ?? 0
    if (a < b) losses.push({ element, before: b, after: a })
  }
  return losses
}

/** Human line for a warning message: `svg 4→0, img 2→1`. */
export function formatLosses(losses: ElementLoss[]): string {
  return losses.map((l) => `${l.element} ${l.before}→${l.after}`).join(', ')
}

/**
 * Compare the current content of a target file against incoming replacement
 * content and report visual-element losses. Empty array when nothing is lost.
 */
export function assessReplacementLoss(currentContent: string, incomingContent: string): ElementLoss[] {
  return diffCensusLosses(countMarkupElements(currentContent), countMarkupElements(incomingContent))
}
