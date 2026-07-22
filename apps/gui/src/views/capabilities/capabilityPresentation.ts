/**
 * Pure presentation helpers for Capabilities.
 *
 * Guided mode is a friendly projection: it humanizes identifiers, replaces raw
 * schema field keys with plain-language labels, and strips technical codes from
 * diagnostics. Design mode keeps the raw values. These helpers are deterministic
 * and unit tested; they hold no React and no bridge access.
 */

import type { GuideTopicId } from '../../guides'
import type { StageId } from './capabilitiesUiState'

/* ----------------------------------------------------------- design sections */

export type DesignSection =
  | 'application'
  | 'architecture'
  | 'attention'
  | 'modules'
  | 'verification'

/** The five canonical Design areas, in order. Entry points live within Modules/Build. */
export const DESIGN_SECTIONS: { id: DesignSection; label: string }[] = [
  { id: 'application', label: 'Application' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'attention', label: 'Needs attention' },
  { id: 'modules', label: 'Modules' },
  { id: 'verification', label: 'Verification' },
]

const STAGE_TO_DESIGN: Record<StageId, DesignSection> = {
  define: 'application',
  architect: 'architecture',
  build: 'modules',
  verify: 'verification',
}

const DESIGN_TO_STAGE: Record<DesignSection, StageId> = {
  application: 'define',
  architecture: 'architect',
  attention: 'build',
  modules: 'build',
  verification: 'verify',
}

/** Redirect persisted/deep-linked Connect-era Design locations into Build. */
export function normalizeDesignSection(section: string | undefined): DesignSection {
  if (section === 'connections' || section === 'connect') return 'modules'
  return DESIGN_SECTIONS.some((candidate) => candidate.id === section)
    ? section as DesignSection
    : 'application'
}

/** Map a Guided stage to the Design area that shows the same records. */
export function stageToDesignSection(stage: StageId): DesignSection {
  return STAGE_TO_DESIGN[stage]
}

/** Map a Design area back to its related Guided stage. */
export function designSectionToStage(section: DesignSection): StageId {
  return DESIGN_TO_STAGE[section]
}

/* ------------------------------------------------------------- help mapping */

const STAGE_TO_GUIDE: Record<StageId, GuideTopicId> = {
  define: 'capabilities-define',
  architect: 'capabilities-architect',
  build: 'capabilities-build',
  verify: 'capabilities-verify',
}

/** The contextual guide topic for a Guided stage. */
export function stageToGuideTopic(stage: StageId): GuideTopicId {
  return STAGE_TO_GUIDE[stage]
}

/* -------------------------------------------------------------- humanization */

const KNOWN_NAMESPACES = new Set(['mod', 'module', 'app', 'application', 'binding', 'op', 'operation', 'arch', 'architecture'])

/**
 * Turn a raw dotted/kebab/snake identifier into a readable, title-cased label.
 * Drops a leading known namespace segment (e.g. `mod.`), then title-cases the rest.
 * `mod.order-history` → `Order History`; `binding.draft` → `Draft`.
 */
export function humanizeIdentifier(raw: string): string {
  if (!raw) return ''
  const segments = raw.split('.')
  if (segments.length > 1 && KNOWN_NAMESPACES.has(segments[0]!.toLowerCase())) {
    segments.shift()
  }
  const words = segments
    .join(' ')
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return raw
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

/** Guided module-type labels. Persisted enum values are never renamed. */
export const MODULE_TYPE_LABELS: Record<string, string> = {
  domain: 'Domain logic',
  workflow: 'Workflow',
  experience: 'User experience',
  connection: 'Connection',
  platform: 'Platform',
}

export function moduleTypeLabel(moduleType: string): string {
  return MODULE_TYPE_LABELS[moduleType] ?? humanizeIdentifier(moduleType)
}

/** Guided labels for binding behavior fields (raw schema keys stay in Design). */
export const BEHAVIOR_LABELS: Record<string, string> = {
  loadingBehavior: 'While it runs',
  validationBehavior: 'Invalid input',
  domainRejectionBehavior: 'Request rejected',
  technicalFailureBehavior: 'Something goes wrong',
  cancellationBehavior: 'User cancels',
  duplicateSubmissionBehavior: 'Repeated submission',
}

/** Ordered behavior fields for the Guided "Define visible behavior" substep. */
export const BEHAVIOR_FIELDS = [
  'loadingBehavior',
  'validationBehavior',
  'domainRejectionBehavior',
  'technicalFailureBehavior',
  'cancellationBehavior',
  'duplicateSubmissionBehavior',
] as const

export function behaviorLabel(field: string): string {
  return BEHAVIOR_LABELS[field] ?? humanizeIdentifier(field)
}

/** Plain-language freshness / attention states (no reason codes). */
export const FRESHNESS_LABELS: Record<string, string> = {
  draft: 'Draft',
  ready: 'Ready',
  'needs-review': 'Needs review',
  'verification-needed': 'Needs verification',
  'connection-outdated': 'Connection outdated',
  blocked: 'Blocked',
  failed: 'Failed',
}

export function freshnessLabel(state: string): string {
  return FRESHNESS_LABELS[state] ?? humanizeIdentifier(state)
}

/** Humanized impact-classification labels. */
export const IMPACT_CLASSIFICATION_LABELS: Record<string, string> = {
  'implementation-only': 'Internal change only',
  'optional-additive': 'Optional addition',
  'required-additive': 'Required addition',
  breaking: 'Breaking change',
}

export function impactClassificationLabel(classification: string): string {
  return IMPACT_CLASSIFICATION_LABELS[classification] ?? humanizeIdentifier(classification)
}

/**
 * Humanize a schema field path for the Guided review summary.
 * `outcomes[0].name` → `Outcomes 1 · name`; `userRoles` → `User roles`.
 */
export function humanizeFieldPath(path: string): string {
  if (!path) return ''
  return path
    .replace(/\[(\d+)\]/g, (_m, n) => ` ${Number(n) + 1}`)
    .split('.')
    .map((seg) => humanizeIdentifier(seg))
    .filter(Boolean)
    .join(' · ')
}

/* -------------------------------------------------- guided diagnostics */

export type RawDiagnostic = { code?: string; message?: string; severity?: string; [k: string]: unknown }
export type GuidedIssue = { message: string; severity: string }

/**
 * Project structured diagnostics into a Guided-safe issue list: plain messages,
 * NO CAP-* codes. If a diagnostic has no message, fall back to a humanized code
 * so nothing is silently dropped, but the raw code itself is never shown.
 */
export function presentDiagnosticsForGuided(diagnostics: readonly RawDiagnostic[]): GuidedIssue[] {
  return diagnostics.map((d) => ({
    message: sanitizeGuidedMessage(
      (d.message && String(d.message).trim()) || humanizeIdentifier(String(d.code ?? 'issue')),
    ),
    severity: String(d.severity ?? 'error'),
  }))
}

/** Replace raw schema field keys / codes that would leak into Guided copy with plain words. */
const GUIDED_TERM_REPLACEMENTS: [RegExp, string][] = [
  [/loadingBehavior/g, 'while it runs'],
  [/validationBehavior/g, 'invalid input'],
  [/domainRejectionBehavior/g, 'request rejected'],
  [/technicalFailureBehavior/g, 'a technical failure'],
  [/cancellationBehavior/g, 'user cancels'],
  [/duplicateSubmissionBehavior/g, 'repeated submission'],
  [/selectionEvidence\.\w+/g, 'the selected element'],
  [/\bbinding\.draft\b/g, 'this connection'],
  [/CAP-[A-Z]+-\d+/g, ''],
]

export function sanitizeGuidedMessage(message: string): string {
  let out = message
  for (const [pattern, replacement] of GUIDED_TERM_REPLACEMENTS) out = out.replace(pattern, replacement)
  return out.replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim()
}

/** The single most useful remediation message for a blocked Guided action. */
export function firstRemediation(diagnostics: readonly RawDiagnostic[]): string | undefined {
  const issues = presentDiagnosticsForGuided(diagnostics)
  return issues[0]?.message
}

/** Show just the filename of an absolute or repo-relative path (Guided). */
export function fileNameOf(path: string): string {
  if (!path) return ''
  const parts = path.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? path
}

/** Compact human-readable byte size, e.g. 2048 → "2 KB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${trimZero(kb < 10 ? kb.toFixed(1) : String(Math.round(kb)))} KB`
  const mb = kb / 1024
  return `${trimZero(mb < 10 ? mb.toFixed(1) : String(Math.round(mb)))} MB`
}

function trimZero(s: string): string {
  return s.replace(/\.0$/, '')
}
