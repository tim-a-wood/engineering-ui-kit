/**
 * Zip-overlay inspector and applier.
 *
 * Inspection implements the hard blockers AI-HANDOFF-030…039 and warnings
 * AI-HANDOFF-040…048 from `standards/copilot-handoff/overlay-safety.md`, and
 * emits the PRD §28.4 `OverlayInspectionSummary` shape. Application refuses
 * blocked overlays, never deletes, and records PRD §28.6 `AppliedFiles`.
 *
 * AI-HANDOFF-048 is the visual-fidelity gate: when an entry overwrites an
 * existing markup-bearing file, the incoming content is censused against the
 * current content and any element loss (svg/img/button/…) becomes a warning
 * that must be explicitly accepted before apply.
 */

import fs from 'node:fs'
import path from 'node:path'
import AdmZip from 'adm-zip'
import { execFileSync } from 'node:child_process'
import type { AppliedFiles, OverlayInspectionSummary } from './types.js'
import { assessReplacementLoss, formatLosses, isCensusableFile, isProbablyText } from './fidelity.js'
import {
  checkSteText,
  type SteLexicon,
  type SteTextClass,
} from './capabilities/simplifiedTechnicalEnglish.js'
import {
  evaluateFrontendDesignSources,
  type FrontendDesignSystemConfig,
} from './capabilities/frontendDesignSystem.js'

export type InspectOptions = {
  runId: string
  targetRoot: string
  expectedFiles?: string[]
  /** Capability-run hard scope (CAP-PKT-013). Paths outside this set are hard blockers. */
  capabilityAllowedPaths?: string[]
  /** Paths owned by deterministic generation or otherwise forbidden to an external overlay. */
  protectedPaths?: string[]
  largeFileBytes?: number
  fullRepoDumpThreshold?: number
  now?: () => Date
  /** Optional project-owned vocabulary from a licensed or selected checker. */
  steLexicon?: SteLexicon
  /** Required visual contract for a complete generated frontend overlay. */
  frontendDesignContract?: FrontendDesignSystemConfig
}

const DEFAULT_LARGE_FILE_BYTES = 200 * 1024
const DEFAULT_FULL_REPO_THRESHOLD = 25

const DEPENDENCY_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'coverage', '.cache', '.turbo', '.vite'])

/** Image assets small UI overlays may legitimately ship (icons, logos). */
const IMAGE_ASSET_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg'])

const STE_MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdx'])
const STE_MARKUP_EXTENSIONS = new Set(['.html', '.htm', '.jsx', '.tsx', '.vue', '.svelte', '.astro'])
const STE_SCRIPT_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx'])

type OverlaySteFragment = {
  text: string
  textClass: SteTextClass
  offset: number
  source: string
}

function isAbsoluteEntry(p: string): boolean {
  return p.startsWith('/') || p.startsWith('\\\\') || /^[A-Za-z]:[\\/]/.test(p)
}

function isSecretName(fileName: string): boolean {
  const n = fileName.toLowerCase()
  return (
    n === '.env' || n.startsWith('.env.') ||
    n.endsWith('.pem') || n.endsWith('.key') || n.endsWith('.crt') || n.endsWith('.pfx') || n.endsWith('.p12') ||
    n.includes('credential') || n === 'id_rsa' || n === 'id_ed25519'
  )
}

function isDirtyWorktree(targetRoot: string): boolean {
  try {
    const out = execFileSync('git', ['status', '--porcelain', '--', '.'], {
      cwd: targetRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return out.trim().length > 0
  } catch {
    return false
  }
}

function maskVisibleSource(value: string): string {
  return value.replace(/[^\n]/g, ' ')
}

/**
 * Mask Markdown regions that show code or document metadata, but preserve
 * offsets and line breaks. Markup in a fenced example is not application text.
 */
function maskMarkdownCode(source: string): string {
  const lines = source.match(/[^\n]*(?:\n|$)/g) ?? []
  let inFrontMatter = false
  let fenceCharacter = ''
  let fenceLength = 0

  return lines.map((line, index) => {
    const content = line.replace(/\n$/, '')
    if (index === 0 && /^---\s*$/.test(content)) {
      inFrontMatter = true
      return maskVisibleSource(line)
    }
    if (inFrontMatter) {
      if (/^(?:---|\.\.\.)\s*$/.test(content)) {
        inFrontMatter = false
      }
      return maskVisibleSource(line)
    }

    const fence = content.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (fenceCharacter) {
      const closesFence = new RegExp(`^\\s{0,3}${fenceCharacter}{${fenceLength},}\\s*$`).test(content)
      if (closesFence) {
        fenceCharacter = ''
        fenceLength = 0
      }
      return maskVisibleSource(line)
    }
    if (fence?.[1]) {
      fenceCharacter = fence[1][0] ?? ''
      fenceLength = fence[1].length
      return maskVisibleSource(line)
    }
    if (/^(?: {4}|\t)/.test(content)) {
      return maskVisibleSource(line)
    }
    return line
  }).join('')
}

function maskInlineMarkdownCode(source: string): string {
  return source.replace(/(`+)([^`\n]*?)\1/g, (match) => maskVisibleSource(match))
}

function decodeHtmlEntities(value: string): string {
  const named: Readonly<Record<string, string>> = {
    amp: '&',
    apos: "'",
    gt: '>',
    ldquo: '“',
    lt: '<',
    nbsp: ' ',
    quot: '"',
    rdquo: '”',
    rsquo: '’',
    semi: ';',
  }
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z][\da-z]+);/gi, (_match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const codePoint = Number.parseInt(entity.slice(2), 16)
      return Number.isFinite(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : ' '
    }
    if (entity.startsWith('#')) {
      const codePoint = Number.parseInt(entity.slice(1), 10)
      return Number.isFinite(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : ' '
    }
    return named[entity.toLowerCase()] ?? ' '
  })
}

function stripJsxExpressions(value: string): string {
  const withLiteralText = value.replace(
    /\{\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|`((?:\\.|[^`\\])*)`)\s*\}/g,
    (_match, doubleQuoted: string | undefined, singleQuoted: string | undefined, template: string | undefined) =>
      (doubleQuoted ?? singleQuoted ?? template ?? '')
        .replace(/\\(['"`])/g, '$1')
        .replace(/\\[nrt]/g, ' '),
  )

  let result = ''
  let expressionDepth = 0
  for (const character of withLiteralText) {
    if (character === '{') {
      expressionDepth += 1
      continue
    }
    if (character === '}' && expressionDepth > 0) {
      expressionDepth -= 1
      continue
    }
    if (expressionDepth === 0) result += character
  }
  return result
}

function normalizeVisibleText(value: string): string {
  return decodeHtmlEntities(stripJsxExpressions(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim())
}

/**
 * Approximate the browser accessible-name algorithm for static markup.
 * Canonical names exclude helper copy, status badges, hidden icons, and
 * nested controls. The runtime fidelity check still uses the browser for
 * complete computed accessibility data.
 */
function accessibleNameMarkup(value: string): string {
  let result = value
  const excludedPair =
    /<([A-Za-z][\w:.-]*)\b[^>]*(?:aria-hidden\s*=\s*(?:"true"|'true'|\{true\})|class(?:Name)?\s*=\s*(?:"[^"]*\b(?:badge|help|hint|meta|secondary|status|supporting)\b[^"]*"|'[^']*\b(?:badge|help|hint|meta|secondary|status|supporting)\b[^']*'))[^>]*>[\s\S]*?<\/\1\s*>/gi
  for (let pass = 0; pass < 3; pass += 1) result = result.replace(excludedPair, ' ')
  return result
    .replace(/<(?:small|script|style)\b[^>]*>[\s\S]*?<\/(?:small|script|style)\s*>/gi, ' ')
    .replace(/<(?:input|select|textarea|svg)\b[\s\S]*?(?:\/>|<\/(?:select|textarea|svg)\s*>|>)/gi, ' ')
}

function normalizeMarkdownText(value: string): string {
  return normalizeVisibleText(value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
    .replace(/<https?:\/\/[^>]+>/gi, ' ')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '')
    .replace(/[*_~]/g, ' '))
}

function maskCodeOnlyMarkupStrings(source: string): string {
  const stringPattern = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g
  return source.replace(stringPattern, (match, offset: number) => {
    // An apostrophe in visible text is not the start of a code string.
    if (match.startsWith("'") && /[A-Za-z0-9]/.test(source[offset - 1] ?? '')
      && /[A-Za-z0-9]/.test(match[1] ?? '')) {
      return match
    }
    if (!/<\/?[A-Za-z]/.test(match)) return match
    const insideOpeningTag = source.lastIndexOf('<', offset) > source.lastIndexOf('>', offset)
    return insideOpeningTag ? match : maskVisibleSource(match)
  })
}

function maskMarkupCode(source: string): string {
  const commentMasked = source
    .replace(/<!--[\s\S]*?-->/g, (match) => maskVisibleSource(match))
    .replace(/\/\*[\s\S]*?\*\//g, (match) => maskVisibleSource(match))
    .replace(/(^|\n)([ \t]*\/\/[^\n]*)/g, (_match, newline: string, comment: string) =>
      `${newline}${maskVisibleSource(comment)}`)
  return maskCodeOnlyMarkupStrings(commentMasked)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, (match) => maskVisibleSource(match))
}

type MarkupOpeningTag = {
  tagName: string
  start: number
  nameEnd: number
  end: number
  attributes: string
  selfClosing: boolean
}

function findMarkupTagEnd(source: string, start: number): number {
  let quote = ''
  let braceDepth = 0
  let comment: 'line' | 'block' | '' = ''
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index] ?? ''
    const nextCharacter = source[index + 1] ?? ''
    if (comment === 'line') {
      if (character === '\n') comment = ''
      continue
    }
    if (comment === 'block') {
      if (character === '*' && nextCharacter === '/') {
        comment = ''
        index += 1
      }
      continue
    }
    if (quote) {
      if (character === '\\') {
        index += 1
      } else if (character === quote) {
        quote = ''
      }
      continue
    }
    if (braceDepth > 0 && character === '/' && nextCharacter === '/') {
      comment = 'line'
      index += 1
      continue
    }
    if (braceDepth > 0 && character === '/' && nextCharacter === '*') {
      comment = 'block'
      index += 1
      continue
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character
      continue
    }
    if (character === '{') {
      braceDepth += 1
      continue
    }
    if (character === '}' && braceDepth > 0) {
      braceDepth -= 1
      continue
    }
    if (character === '>' && braceDepth === 0) return index
  }
  return -1
}

function markupOpeningTags(source: string): MarkupOpeningTag[] {
  const tags: MarkupOpeningTag[] = []
  const openingPattern = /<([A-Za-z][\w:.-]*)\b/g
  for (const match of source.matchAll(openingPattern)) {
    const tagName = match[1]
    if (!tagName || match.index === undefined) continue
    const end = findMarkupTagEnd(source, match.index)
    if (end < 0) continue
    const nameEnd = match.index + match[0].length
    const attributes = source.slice(nameEnd, end)
    tags.push({
      tagName,
      start: match.index,
      nameEnd,
      end,
      attributes,
      selfClosing: /\/\s*$/.test(attributes),
    })
  }
  return tags
}

function closingTag(source: string, opening: MarkupOpeningTag): {
  start: number
  end: number
} | undefined {
  const escapedName = opening.tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`</${escapedName}\\s*>`, 'gi')
  pattern.lastIndex = opening.end + 1
  const match = pattern.exec(source)
  return match ? { start: match.index, end: match.index + match[0].length } : undefined
}

function classifyElementText(tagName: string): SteTextClass {
  const simpleName = tagName.toLowerCase().split(/[.:]/).pop() ?? tagName.toLowerCase()
  if (simpleName === 'button' || simpleName === 'a'
    || simpleName.endsWith('button') || simpleName.endsWith('link')) {
    return 'action-label'
  }
  if (/^h[1-6]$/.test(simpleName) || simpleName === 'legend' || simpleName === 'summary') {
    return 'heading'
  }
  if (simpleName === 'label' || simpleName === 'option' || simpleName === 'th') return 'technical-name'
  return 'description'
}

function classifyAttributeText(tagName: string, attributeName: string): SteTextClass {
  const simpleTag = tagName.toLowerCase().split(/[.:]/).pop() ?? tagName.toLowerCase()
  const normalized = attributeName.toLowerCase()
  const actionElement = simpleTag === 'button'
    || simpleTag === 'a'
    || simpleTag.endsWith('button')
    || simpleTag.endsWith('link')
  if (
    normalized.includes('action')
    || normalized.includes('button')
    || normalized.includes('cta')
    || (actionElement && ['aria-label', 'label', 'text'].includes(normalized))
  ) {
    return 'action-label'
  }
  if (normalized.endsWith('heading') || normalized.endsWith('title')) return 'heading'
  if (normalized === 'label' || normalized.endsWith('label')) return 'technical-name'
  return 'description'
}

function extractMarkupSteFragments(source: string): OverlaySteFragment[] {
  const masked = maskMarkupCode(source)
  const fragments: OverlaySteFragment[] = []
  const claimedRanges: Array<{ start: number; end: number }> = []
  const openings = markupOpeningTags(masked)
  const pairedNamePattern = /^(?:(?:button|a|summary|h[1-6]|legend|label|option|th)|(?:[A-Za-z][\w:.-]*(?:Button|Link)))$/i

  for (const opening of openings) {
    if (opening.selfClosing || !pairedNamePattern.test(opening.tagName)) continue
    const closing = closingTag(masked, opening)
    if (!closing) continue
    const explicitName = /\baria-label\s*=/i.test(opening.attributes)
    const labelledBy = opening.attributes.match(/\baria-labelledby\s*=\s*(?:"([^"]+)"|'([^']+)')/i)
    if (classifyElementText(opening.tagName) === 'action-label' && (explicitName || labelledBy)) {
      claimedRanges.push({ start: opening.end + 1, end: closing.start })
      if (labelledBy) {
        const ids = (labelledBy[1] ?? labelledBy[2] ?? '').split(/\s+/).filter(Boolean)
        const labels = ids.flatMap((id) => {
          const target = openings.find((candidate) => {
            const idMatch = candidate.attributes.match(/\bid\s*=\s*(?:"([^"]+)"|'([^']+)')/i)
            return (idMatch?.[1] ?? idMatch?.[2]) === id
          })
          if (!target || target.selfClosing) return []
          const targetClosing = closingTag(masked, target)
          if (!targetClosing) return []
          return [normalizeVisibleText(accessibleNameMarkup(masked.slice(target.end + 1, targetClosing.start)))]
        }).filter(Boolean)
        const text = labels.join(' ')
        if (/[A-Za-z]/.test(text)) {
          fragments.push({
            text,
            textClass: 'action-label',
            offset: opening.nameEnd,
            source: 'aria-labelledby name',
          })
        }
      }
      continue
    }
    const rawText = masked.slice(opening.end + 1, closing.start)
    const visibleText = accessibleNameMarkup(rawText)
    const innerOffset = opening.end + 1
    const text = normalizeVisibleText(visibleText)
    claimedRanges.push({ start: innerOffset, end: innerOffset + rawText.length })
    if (/[A-Za-z]/.test(text)) {
      fragments.push({
        text,
        textClass: classifyElementText(opening.tagName),
        offset: innerOffset,
        source: `element <${opening.tagName}>`,
      })
    }
  }

  for (const opening of openings) {
    const { tagName, attributes } = opening
    const attributesOffset = opening.nameEnd
    const attributePattern =
      /\b(aria-label|title|placeholder|alt|text|label|caption|hint|tooltip|[A-Za-z_$][\w$]*(?:Label|Text|Title|Heading|Message|Caption|Hint|Tooltip))\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*"([^"]*)"\s*\}|\{\s*'([^']*)'\s*\}|\{\s*`([^`]*)`\s*\})/g

    for (const attributeMatch of attributes.matchAll(attributePattern)) {
      const attributeName = attributeMatch[1]?.toLowerCase()
      const rawText = attributeMatch[2] ?? attributeMatch[3] ?? attributeMatch[4]
        ?? attributeMatch[5] ?? attributeMatch[6] ?? ''
      const text = normalizeVisibleText(rawText)
      if (!attributeName || !/[A-Za-z]/.test(text) || attributeMatch.index === undefined) continue
      fragments.push({
        text,
        textClass: classifyAttributeText(tagName, attributeName),
        offset: attributesOffset + attributeMatch.index,
        source: `${attributeName} attribute`,
      })
    }

    if (tagName.toLowerCase() === 'input') {
      const type = attributes.match(/\btype\s*=\s*(?:"([^"]*)"|'([^']*)')/i)
      const inputType = (type?.[1] ?? type?.[2] ?? '').toLowerCase()
      if (inputType === 'button' || inputType === 'submit' || inputType === 'reset') {
        const value = attributes.match(/\bvalue\s*=\s*(?:"([^"]*)"|'([^']*)')/i)
        const rawText = value?.[1] ?? value?.[2] ?? ''
        const text = normalizeVisibleText(rawText)
        if (/[A-Za-z]/.test(text) && value?.index !== undefined) {
          fragments.push({
            text,
            textClass: 'action-label',
            offset: attributesOffset + value.index,
            source: 'input value',
          })
        }
      }
    }
  }

  const textNodePattern = /<(p|span|li|td|dt|dd|caption)\b[^>]*>([^<>]+)<\/\1\s*>/gi
  for (const match of masked.matchAll(textNodePattern)) {
    const tagName = match[1]
    const rawText = match[2]
    if (!tagName || rawText === undefined || match.index === undefined) continue
    const offset = match.index + match[0].indexOf(rawText)
    if (claimedRanges.some((range) => offset >= range.start && offset < range.end)) continue
    const text = normalizeVisibleText(rawText)
    if (!/[A-Za-z]/.test(text)) continue
    fragments.push({
      text,
      textClass: classifyElementText(tagName),
      offset,
      source: `text in <${tagName}>`,
    })
  }

  return fragments
}

function scriptStringValue(match: RegExpMatchArray, firstCapture: number): string {
  return (match[firstCapture] ?? match[firstCapture + 1] ?? match[firstCapture + 2] ?? '')
    .replace(/\\(['"`])/g, '$1')
    .replace(/\\[nrt]/g, ' ')
}

function scriptTextClass(key: string): SteTextClass {
  const normalized = key.toLowerCase()
  if (normalized.includes('action') || normalized.includes('button') || normalized.includes('cta')) {
    return 'action-label'
  }
  if (normalized.endsWith('title') || normalized.endsWith('heading')) return 'heading'
  if (normalized === 'label' || normalized.endsWith('label')) return 'technical-name'
  return 'description'
}

type ScriptLiteralAssignment = {
  text: string
  offset: number
}

function collectScriptLiteralAssignments(source: string): Map<string, ScriptLiteralAssignment> {
  const assignments = new Map<string, ScriptLiteralAssignment>()
  const declarationPattern =
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::\s*[^=;\n]+)?=\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|`((?:\\.|[^`\\])*)`)/g
  for (const match of source.matchAll(declarationPattern)) {
    if (!match[1] || match.index === undefined) continue
    const text = normalizeVisibleText(scriptStringValue(match, 2))
    if (!/[A-Za-z]/.test(text)) continue
    assignments.set(match[1], { text, offset: match.index })
  }
  return assignments
}

/**
 * Inspect string literals only when the surrounding code identifies them as UI
 * copy. Ordinary source strings remain exempt.
 */
function extractScriptSteFragments(source: string): OverlaySteFragment[] {
  const masked = maskMarkupCode(source)
  const fragments: OverlaySteFragment[] = []
  const literalAssignments = collectScriptLiteralAssignments(masked)
  const assignmentPattern =
    /\b([A-Za-z_$][\w$]*(?:Label|Text|Title|Heading|Description|Message|Placeholder|Caption|Hint|Tooltip)|label|text|title|heading|description|message|placeholder|caption|hint|tooltip)\b\s*(?::|=)\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|`((?:\\.|[^`\\])*)`)/g

  for (const match of masked.matchAll(assignmentPattern)) {
    if (match.index === undefined || !match[1]) continue
    if (/^(?:css|class|source|raw|sql|code|template)Text$/i.test(match[1])) continue
    const text = normalizeVisibleText(scriptStringValue(match, 2))
    if (!/[A-Za-z]/.test(text)) continue
    fragments.push({
      text,
      textClass: scriptTextClass(match[1]),
      offset: match.index,
      source: `${match[1]} UI string`,
    })
  }

  const jsxElementNamePattern =
    /^(?:(?:button|a|summary|h[1-6]|legend|label|option|p|span|li|td|dt|dd|caption)|(?:[A-Za-z][\w:.-]*(?:Button|Link)))$/i
  const openings = markupOpeningTags(masked)
  for (const opening of openings) {
    if (opening.selfClosing || !jsxElementNamePattern.test(opening.tagName)) continue
    if (
      classifyElementText(opening.tagName) === 'action-label'
      && /\baria-label\s*=/i.test(opening.attributes)
    ) continue
    const closing = closingTag(masked, opening)
    if (!closing) continue
    const tagName = opening.tagName
    const body = masked.slice(opening.end + 1, closing.start)
    for (const expressionMatch of body.matchAll(/\{([\s\S]*?)\}/g)) {
      const expression = expressionMatch[1] ?? ''
      const expressionOffset = opening.end + 1 + (expressionMatch.index ?? 0)
      const literalPattern = /"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|`((?:\\.|[^`\\])*)`/g
      for (const literalMatch of expression.matchAll(literalPattern)) {
        const text = normalizeVisibleText(scriptStringValue(literalMatch, 1))
        if (!/[A-Za-z]/.test(text)) continue
        fragments.push({
          text,
          textClass: classifyElementText(tagName),
          offset: expressionOffset + (literalMatch.index ?? 0),
          source: `expression in <${tagName}>`,
        })
      }
      for (const identifierMatch of expression.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
        const assignment = literalAssignments.get(identifierMatch[1] ?? '')
        if (!assignment) continue
        fragments.push({
          text: assignment.text,
          textClass: classifyElementText(tagName),
          offset: assignment.offset,
          source: `text for <${tagName}>`,
        })
      }
    }
  }

  for (const opening of openings) {
    const { tagName, attributes } = opening
    const attributePattern =
      /\b(aria-label|title|placeholder|alt|text|label|caption|hint|tooltip|[A-Za-z_$][\w$]*(?:Label|Text|Title|Heading|Message|Caption|Hint|Tooltip))\s*=\s*\{\s*([A-Za-z_$][\w$]*)\s*\}/g
    for (const attributeMatch of attributes.matchAll(attributePattern)) {
      const attributeName = attributeMatch[1]
      const assignment = literalAssignments.get(attributeMatch[2] ?? '')
      if (!attributeName || !assignment) continue
      fragments.push({
        text: assignment.text,
        textClass: classifyAttributeText(tagName, attributeName),
        offset: assignment.offset,
        source: `${attributeName} attribute`,
      })
    }
  }

  const callPattern =
    /\b(setMessage|toast|alert|confirm)\s*\(\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|`((?:\\.|[^`\\])*)`)/g
  for (const match of masked.matchAll(callPattern)) {
    if (match.index === undefined || !match[1]) continue
    const text = normalizeVisibleText(scriptStringValue(match, 2))
    if (!/[A-Za-z]/.test(text)) continue
    fragments.push({
      text,
      textClass: 'description',
      offset: match.index,
      source: `${match[1]} UI message`,
    })
  }

  const textContentPattern =
    /\.(?:textContent|innerText)\s*=\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|`((?:\\.|[^`\\])*)`)/g
  for (const match of masked.matchAll(textContentPattern)) {
    if (match.index === undefined) continue
    const text = normalizeVisibleText(scriptStringValue(match, 1))
    if (!/[A-Za-z]/.test(text)) continue
    fragments.push({
      text,
      textClass: 'description',
      offset: match.index,
      source: 'DOM text',
    })
  }

  const createElementPattern =
    /\b(?:React\.)?createElement\s*\(\s*['"]((?:button|a|summary|h[1-6]|legend|label|option))['"]\s*,\s*(?:null|\{[^{}]*\}|[A-Za-z_$][\w$]*)\s*,\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|`((?:\\.|[^`\\])*)`|([A-Za-z_$][\w$]*))\s*[,)]/gi
  for (const match of masked.matchAll(createElementPattern)) {
    if (match.index === undefined || !match[1]) continue
    const assignment = match[5] ? literalAssignments.get(match[5]) : undefined
    const text = assignment?.text ?? normalizeVisibleText(scriptStringValue(match, 2))
    if (!/[A-Za-z]/.test(text)) continue
    fragments.push({
      text,
      textClass: classifyElementText(match[1]),
      offset: assignment?.offset ?? match.index,
      source: `createElement <${match[1]}>`,
    })
  }

  return fragments
}

function extractMarkdownSteFragments(source: string): OverlaySteFragment[] {
  const masked = maskInlineMarkdownCode(maskMarkdownCode(source))
  const fragments: OverlaySteFragment[] = []
  const lines = masked.match(/[^\n]*(?:\n|$)/g) ?? []
  let offset = 0
  let paragraphText: string[] = []
  let paragraphOffset = 0

  const flushParagraph = () => {
    const text = normalizeMarkdownText(paragraphText.join(' '))
    if (/[A-Za-z]/.test(text)) {
      fragments.push({ text, textClass: 'description', offset: paragraphOffset, source: 'Markdown paragraph' })
    }
    paragraphText = []
  }

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? ''
    const content = line.replace(/\n$/, '')
    const nextLine = lines[lineIndex + 1]
    const nextContent = nextLine?.replace(/\n$/, '') ?? ''
    const setextHeading = /\S/.test(content) && /^\s{0,3}(?:=+|-+)\s*$/.test(nextContent)
    const heading = content.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/)
    const listItem = content.match(/^\s*(?:[-*+]|\d+[.)])\s+(.+)$/)
    const skipLine = /^\s*$/.test(content)
      || /^\s*\[[^\]]+]:\s+\S+/.test(content)
      || /^\s*(?:import|export)\s/.test(content)
      || /^\s*[{}]\s*$/.test(content)

    if (setextHeading) {
      flushParagraph()
      const text = normalizeMarkdownText(content)
      if (/[A-Za-z]/.test(text)) {
        fragments.push({
          text,
          textClass: 'heading',
          offset: offset + Math.max(0, content.search(/\S/)),
          source: 'Markdown heading',
        })
      }
      offset += line.length + (nextLine?.length ?? 0)
      lineIndex += 1
      continue
    }
    if (heading?.[1]) {
      flushParagraph()
      const text = normalizeMarkdownText(heading[1])
      if (/[A-Za-z]/.test(text)) {
        fragments.push({
          text,
          textClass: 'heading',
          offset: offset + content.indexOf(heading[1]),
          source: 'Markdown heading',
        })
      }
    } else if (listItem?.[1]) {
      flushParagraph()
      const text = normalizeMarkdownText(listItem[1])
      if (/[A-Za-z]/.test(text)) {
        fragments.push({
          text,
          textClass: 'description',
          offset: offset + content.indexOf(listItem[1]),
          source: 'Markdown list item',
        })
      }
    } else if (skipLine) {
      flushParagraph()
    } else {
      if (paragraphText.length === 0) paragraphOffset = offset + Math.max(0, content.search(/\S/))
      paragraphText.push(content)
    }
    offset += line.length
  }
  flushParagraph()
  return fragments
}

function lineNumberAt(source: string, offset: number): number {
  let line = 1
  for (let index = 0; index < offset; index += 1) {
    if (source.charCodeAt(index) === 10) line += 1
  }
  return line
}

function appendSteOverlayBlockers(
  summary: OverlayInspectionSummary,
  normalizedPath: string,
  extension: string,
  source: string,
  lexicon?: SteLexicon,
): void {
  if (
    !STE_MARKDOWN_EXTENSIONS.has(extension)
    && !STE_MARKUP_EXTENSIONS.has(extension)
    && !STE_SCRIPT_EXTENSIONS.has(extension)
  ) return
  const markdownSource = STE_MARKDOWN_EXTENSIONS.has(extension)
    ? maskInlineMarkdownCode(maskMarkdownCode(source))
    : source
  const fragments = [
    ...(STE_MARKDOWN_EXTENSIONS.has(extension) ? extractMarkdownSteFragments(source) : []),
    ...(STE_MARKUP_EXTENSIONS.has(extension) || STE_MARKDOWN_EXTENSIONS.has(extension)
      ? extractMarkupSteFragments(markdownSource)
      : []),
    ...(STE_SCRIPT_EXTENSIONS.has(extension) ? extractScriptSteFragments(source) : []),
  ]
  const seen = new Set<string>()
  const seenReview = new Set<string>()

  for (const fragment of fragments) {
    const line = lineNumberAt(source, fragment.offset)
    const result = checkSteText(fragment.text, {
      textClass: fragment.textClass,
      fieldPath: `${normalizedPath}:${line}`,
      lexicon,
      requireLexicon: !lexicon?.generalWords?.length,
    })
    for (const steDiagnostic of result.diagnostics) {
      const key = `${line}\u0000${steDiagnostic.code}\u0000${steDiagnostic.message}`
      if (seen.has(key)) continue
      seen.add(key)
      summary.hardBlockers.push({
        ruleId: 'AI-HANDOFF-STE-001',
        path: normalizedPath,
        message: `line ${line}, ${fragment.source}: ${steDiagnostic.code}: ${steDiagnostic.message}`,
      })
    }
    for (const reviewDiagnostic of result.reviewDiagnostics) {
      const key = `${line}\u0000${reviewDiagnostic.code}\u0000${reviewDiagnostic.message}`
      if (seenReview.has(key)) continue
      seenReview.add(key)
      summary.warnings.push({
        ruleId: 'AI-HANDOFF-STE-REVIEW-001',
        path: normalizedPath,
        message: `line ${line}, ${fragment.source}: ${reviewDiagnostic.code}: ${reviewDiagnostic.message}`,
      })
    }
  }
}

export function inspectOverlay(zipPath: string, options: InspectOptions): OverlayInspectionSummary {
  const inspectedAt = (options.now?.() ?? new Date()).toISOString()
  const summary: OverlayInspectionSummary = {
    runId: options.runId,
    zipFilename: path.basename(zipPath),
    inspectedAt,
    normalizedEntries: [],
    hardBlockers: [],
    warnings: [],
    canApply: false,
  }

  let zip: AdmZip
  try {
    zip = new AdmZip(zipPath)
    zip.getEntries()
  } catch (error) {
    summary.hardBlockers.push({
      ruleId: 'AI-HANDOFF-030',
      message: `archive cannot be opened or listed: ${error instanceof Error ? error.message : String(error)}`,
    })
    return summary
  }

  const largeFileBytes = options.largeFileBytes ?? DEFAULT_LARGE_FILE_BYTES
  const expected = options.expectedFiles ? new Set(options.expectedFiles) : undefined
  let fileCount = 0
  const frontendSources: Record<string, string> = {}

  for (const entry of zip.getEntries()) {
    const original = entry.entryName
    if (entry.isDirectory) {
      summary.normalizedEntries.push({
        originalPath: original,
        normalizedRelativePath: original.replace(/\/+$/, ''),
        targetPath: '',
        isDirectory: true,
      })
      continue
    }
    fileCount += 1

    const decoded = original
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f\u007f]/.test(decoded)) {
      summary.hardBlockers.push({ ruleId: 'AI-HANDOFF-039', path: original, message: 'entry path contains control characters' })
      continue
    }

    if (isAbsoluteEntry(decoded)) {
      summary.hardBlockers.push({ ruleId: 'AI-HANDOFF-031', path: original, message: 'absolute entry path' })
      continue
    }
    const posix = decoded.replace(/\\/g, '/')
    const segments = posix.split('/')
    if (segments.includes('..')) {
      summary.hardBlockers.push({ ruleId: 'AI-HANDOFF-032', path: original, message: 'path traversal segment' })
      continue
    }

    const normalized = path.posix.normalize(posix)
    const targetPath = path.resolve(options.targetRoot, normalized)
    const rootResolved = path.resolve(options.targetRoot)
    if (!targetPath.startsWith(rootResolved + path.sep) && targetPath !== rootResolved) {
      summary.hardBlockers.push({ ruleId: 'AI-HANDOFF-033', path: original, message: 'normalized path escapes the target root' })
      continue
    }

    if (options.capabilityAllowedPaths && options.capabilityAllowedPaths.length > 0) {
      const allowed = options.capabilityAllowedPaths.map((p) => p.replace(/\\/g, '/').replace(/\/+$/, ''))
      const inScope = allowed.some(
        (root) => normalized === root || normalized.startsWith(root + '/') || root.startsWith(normalized + '/'),
      )
      if (!inScope) {
        summary.hardBlockers.push({
          ruleId: 'CAP-OVERLAY-SCOPE-001',
          path: normalized,
          message: 'path outside persisted capability allowedPaths',
        })
        continue
      }
    }

    if (options.protectedPaths?.length) {
      const protectedRoots = options.protectedPaths.map((p) => p.replace(/\\/g, '/').replace(/\/+$/, ''))
      const protectedMatch = protectedRoots.find((root) => normalized === root || normalized.startsWith(root + '/'))
      if (protectedMatch) {
        summary.hardBlockers.push({
          ruleId: 'CAP-OVERLAY-OWNERSHIP-001',
          path: normalized,
          message: `external overlay cannot overwrite generated-owned path "${protectedMatch}"`,
        })
        continue
      }
    }

    const mode = entry.header.attr >>> 16
    if (mode !== 0 && (mode & 0o170000) !== 0o100000 && (mode & 0o170000) !== 0) {
      summary.hardBlockers.push({ ruleId: 'AI-HANDOFF-034', path: original, message: 'symlink or special file entry' })
      continue
    }

    if (segments.includes('.git')) {
      summary.hardBlockers.push({ ruleId: 'AI-HANDOFF-035', path: original, message: 'git metadata entry' })
      continue
    }
    if (segments.some((s) => DEPENDENCY_DIRS.has(s))) {
      summary.hardBlockers.push({ ruleId: 'AI-HANDOFF-036', path: original, message: 'dependency, cache, or build folder entry' })
      continue
    }
    const fileName = segments[segments.length - 1] ?? posix
    if (isSecretName(fileName)) {
      summary.hardBlockers.push({ ruleId: 'AI-HANDOFF-037', path: original, message: 'likely secret or environment file' })
      continue
    }

    const sizeBytes = entry.header.size
    summary.normalizedEntries.push({
      originalPath: original,
      normalizedRelativePath: normalized,
      targetPath,
      sizeBytes,
      isDirectory: false,
    })

    const data = entry.getData()
    const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')).toLowerCase() : ''
    const isBinary = data.includes(0)
    if (!isBinary) {
        frontendSources[normalized] = data.toString('utf8')
        appendSteOverlayBlockers(
          summary,
          normalized,
          ext,
          data.toString('utf8'),
          options.steLexicon,
        )
    }
    const exists = fs.existsSync(targetPath)
    if (exists) {
      summary.warnings.push({ ruleId: 'AI-HANDOFF-040', path: normalized, message: 'overwrites existing source file' })
    }
    if (fileName === 'package.json' || fileName === 'package-lock.json' || fileName === 'pnpm-lock.yaml' || fileName === 'yarn.lock') {
      summary.warnings.push({ ruleId: 'AI-HANDOFF-041', path: normalized, message: 'changes package manifest or lockfile' })
    }
    if (fileName.startsWith('tsconfig') || fileName.startsWith('vite.config') || fileName.startsWith('webpack.config')) {
      summary.warnings.push({ ruleId: 'AI-HANDOFF-042', path: normalized, message: 'changes build or tooling configuration' })
    }
    if (expected && !expected.has(normalized)) {
      summary.warnings.push({ ruleId: 'AI-HANDOFF-043', path: normalized, message: 'outside expected changed-file scope' })
    }
    if (sizeBytes > largeFileBytes) {
      summary.warnings.push({ ruleId: 'AI-HANDOFF-044', path: normalized, message: `unusually large file (${sizeBytes} bytes)` })
    }
    if (isBinary) {
      summary.warnings.push({
        ruleId: 'AI-HANDOFF-047',
        path: normalized,
        message: IMAGE_ASSET_EXTENSIONS.has(ext)
          ? `introduces an image asset (${sizeBytes} bytes)`
          : 'introduces a binary file',
      })
    } else if (exists && isCensusableFile(normalized)) {
      // Visual-fidelity gate: does replacing this file drop rendered elements?
      const current = fs.readFileSync(targetPath)
      if (isProbablyText(current)) {
        const losses = assessReplacementLoss(current.toString('utf8'), data.toString('utf8'))
        if (losses.length > 0) {
          summary.warnings.push({
            ruleId: 'AI-HANDOFF-048',
            path: normalized,
            message: `replacing this file drops visual elements: ${formatLosses(losses)}`,
          })
        }
      }
    }
  }

  if (options.frontendDesignContract) {
    const findings = evaluateFrontendDesignSources(
      frontendSources,
      options.frontendDesignContract,
    )
    for (const finding of findings) {
      const target = finding.severity === 'blocking'
        ? summary.hardBlockers
        : summary.warnings
      target.push({
        ruleId: finding.code,
        message: finding.message,
      })
    }
  }

  if (fileCount > (options.fullRepoDumpThreshold ?? DEFAULT_FULL_REPO_THRESHOLD)) {
    summary.hardBlockers.push({
      ruleId: 'AI-HANDOFF-038',
      message: `archive contains ${fileCount} files and appears to be a repository dump rather than a focused change set`,
    })
  }

  if (isDirtyWorktree(options.targetRoot)) {
    summary.warnings.push({ ruleId: 'AI-HANDOFF-045', message: 'target working tree has uncommitted changes before apply' })
  }

  summary.canApply = summary.hardBlockers.length === 0
  return summary
}

export type ApplyOptions = {
  runId: string
  targetRoot: string
  /** Explicit human/system confirmation that warnings were reviewed. */
  acceptWarnings: boolean
  now?: () => Date
}

export function applyOverlay(
  zipPath: string,
  inspection: OverlayInspectionSummary,
  options: ApplyOptions,
): AppliedFiles {
  if (!inspection.canApply) {
    throw new Error('refusing to apply: overlay inspection recorded hard blockers')
  }
  if (inspection.warnings.length > 0 && !options.acceptWarnings) {
    throw new Error('refusing to apply: warnings present and not explicitly accepted')
  }

  const zip = new AdmZip(zipPath)
  const applied: AppliedFiles = {
    runId: options.runId,
    appliedAt: (options.now?.() ?? new Date()).toISOString(),
    files: [],
  }

  for (const entry of inspection.normalizedEntries) {
    if (entry.isDirectory) continue
    const zipEntry = zip.getEntry(entry.originalPath)
    if (!zipEntry) {
      throw new Error(`inspected entry missing from archive at apply time: ${entry.originalPath}`)
    }
    const data = zipEntry.getData()
    const existed = fs.existsSync(entry.targetPath)
    if (existed) {
      const current = fs.readFileSync(entry.targetPath)
      if (current.equals(data)) {
        applied.files.push({ relativePath: entry.normalizedRelativePath, action: 'unchanged', sizeBytes: data.length })
        continue
      }
    }
    fs.mkdirSync(path.dirname(entry.targetPath), { recursive: true })
    fs.writeFileSync(entry.targetPath, data)
    applied.files.push({
      relativePath: entry.normalizedRelativePath,
      action: existed ? 'overwritten' : 'created',
      sizeBytes: data.length,
    })
  }

  return applied
}
