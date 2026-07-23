// Hub-local overlay state: reducer, validation, persistence (pure logic).
import type { Baseline, Finding, FindingHistoryEntry, FindingStatus, Phase, ReviewMethod, ReviewResult } from './core.ts'

// ===== from store/overlay.ts =====
// Hub-local overlay state: the only mutable data in the app. Authoritative
// fixture evidence stays immutable; the overlay layers finding transitions,
// recorded reviews, packages, preferences, and the activity timeline on top,
// persisted in localStorage.

export const OVERLAY_STORAGE_KEY = 'do178-audit-hub:overlay:v1'

export interface RecordedReview {
  id: string
  subjectId: string
  phase: Phase
  reviewer: string
  method: ReviewMethod
  result: ReviewResult
  comments: string
  date: string
  revision: string
  independent: boolean
}

export interface PackageManifestEntry {
  id: string
  title: string
  revision: string
  hash: string
  sourcePath: string
}

export interface AuditPackage {
  id: string
  name: string
  createdAt: string
  scopePhases: Phase[]
  includeFindings: boolean
  includeReviews: boolean
  evidenceCount: number
  findingIds: string[]
  reviewIds: string[]
  manifest: PackageManifestEntry[]
  status: 'complete' | 'cancelled'
  watermark: string
}

export type ActivityKind =
  | 'sample-reset'
  | 'finding-transition'
  | 'review-recorded'
  | 'package-created'
  | 'package-cancelled'
  | 'baseline-changed'
  | 'refresh'
  | 'sample-initialized'

export interface ActivityEvent {
  id: string
  at: string
  kind: ActivityKind
  message: string
}

export interface FindingOverlay {
  status: FindingStatus
  appendedHistory: FindingHistoryEntry[]
  reverificationEvidence: string[]
  independentCloser?: string
}

export interface Preferences {
  navCollapsed: boolean
  baseline: Baseline
  compare: boolean
}

export interface OverlayState {
  version: 1
  findingOverlays: Record<string, FindingOverlay>
  recordedReviews: RecordedReview[]
  packages: AuditPackage[]
  activity: ActivityEvent[]
  prefs: Preferences
  seq: number
}

export const initialOverlay: OverlayState = {
  version: 1,
  findingOverlays: {},
  recordedReviews: [],
  packages: [],
  activity: [
    {
      id: 'ACT-SEED-1',
      at: '2026-07-10T09:00Z',
      kind: 'sample-initialized',
      message: 'Sample workspace initialized on baseline 2.4.0 (AeroNav Flight Guidance Computer — Lateral Guidance).',
    },
  ],
  prefs: { navCollapsed: false, baseline: '2.4.0', compare: false },
  seq: 1,
}

export const FINDING_FLOW: FindingStatus[] = [
  'open',
  'assigned',
  'dispositioned',
  'corrective-action',
  'ready-for-closure',
  'reverified',
  'closed',
]

export const FINDING_STATUS_LABEL: Record<FindingStatus, string> = {
  open: 'Open',
  assigned: 'Assigned',
  dispositioned: 'Dispositioned',
  'corrective-action': 'Corrective action',
  'ready-for-closure': 'Ready for closure',
  reverified: 'Reverified',
  closed: 'Closed',
}

/** Deterministic reverification evidence attached for finding closure. */
export const REVERIFICATION_EVIDENCE = [
  'VR-RESULT-2026-052 — TC-LAT-REQ-012 re-execution delta (all iterations passed, Rev 4 header verified)',
  'REV-2026-208 — independent QA confirmation review (E. Sorensen, checklist, passed)',
]

export function findingWithOverlay(seed: Finding, overlay: OverlayState): Finding {
  const o = overlay.findingOverlays[seed.id]
  if (!o) return seed
  return { ...seed, status: o.status, history: [...seed.history, ...o.appendedHistory] }
}

export function openFindingIds(seeds: Finding[], overlay: OverlayState): Set<string> {
  const s = new Set<string>()
  for (const f of seeds) {
    const merged = findingWithOverlay(f, overlay)
    if (merged.status !== 'closed') s.add(f.id)
  }
  return s
}

export interface TransitionCheck {
  ok: boolean
  reason?: string
}

/** Validate a finding transition; closure enforces evidence + independence. */
export function checkTransition(
  current: Finding,
  to: FindingStatus,
  overlay: OverlayState,
  opts: { independentCloser?: string } = {},
): TransitionCheck {
  const fromIdx = FINDING_FLOW.indexOf(current.status)
  const toIdx = FINDING_FLOW.indexOf(to)
  if (toIdx === -1 || fromIdx === -1) return { ok: false, reason: 'Unknown finding state.' }
  if (current.status === 'closed') return { ok: false, reason: 'Finding is closed; history is immutable.' }
  if (toIdx !== fromIdx + 1) return { ok: false, reason: `Transition must follow the lifecycle (next step: ${FINDING_STATUS_LABEL[FINDING_FLOW[fromIdx + 1] ?? 'closed']}).` }
  if (to === 'reverified') {
    const o = overlay.findingOverlays[current.id]
    if (!o || o.reverificationEvidence.length === 0) {
      return { ok: false, reason: 'Reverification requires attached reverification evidence.' }
    }
    if (!opts.independentCloser || opts.independentCloser.trim() === '') {
      return { ok: false, reason: 'Reverification requires an independent verifier.' }
    }
    if (opts.independentCloser.trim() === current.owner) {
      return { ok: false, reason: 'Verifier must be independent of the finding owner.' }
    }
  }
  return { ok: true }
}

export type OverlayAction =
  | { type: 'finding/attach-evidence'; findingId: string; evidence: string[]; actor: string; at: string }
  | { type: 'finding/transition'; findingId: string; to: FindingStatus; actor: string; at: string; note?: string; independentCloser?: string; seedFinding: Finding }
  | { type: 'review/record'; review: Omit<RecordedReview, 'id'>; at: string }
  | { type: 'package/add'; pkg: Omit<AuditPackage, 'id'>; at: string }
  | { type: 'package/cancelled'; name: string; at: string }
  | { type: 'baseline/set'; baseline: Baseline; at: string }
  | { type: 'baseline/sync'; baseline: Baseline; comparisonAvailable: boolean }
  | { type: 'compare/set'; compare: boolean }
  | { type: 'nav/collapse'; collapsed: boolean }
  | { type: 'refresh/complete'; at: string; sourceCount: number }
  | { type: 'reset'; at: string }

function logEvent(state: OverlayState, at: string, kind: ActivityKind, message: string): OverlayState {
  const id = `EVT-${String(state.seq).padStart(4, '0')}`
  return {
    ...state,
    seq: state.seq + 1,
    activity: [{ id, at, kind, message }, ...state.activity].slice(0, 200),
  }
}

export function overlayReducer(state: OverlayState, action: OverlayAction): OverlayState {
  switch (action.type) {
    case 'finding/attach-evidence': {
      const existing = state.findingOverlays[action.findingId]
      const base: FindingOverlay = existing ?? { status: 'ready-for-closure', appendedHistory: [], reverificationEvidence: [] }
      const merged = Array.from(new Set([...base.reverificationEvidence, ...action.evidence]))
      const next: FindingOverlay = {
        ...base,
        reverificationEvidence: merged,
        appendedHistory: [
          ...base.appendedHistory,
          { at: action.at, actor: action.actor, action: 'Evidence attached', note: `${action.evidence.length} reverification item(s) attached.` },
        ],
      }
      const s = { ...state, findingOverlays: { ...state.findingOverlays, [action.findingId]: next } }
      return logEvent(s, action.at, 'finding-transition', `${action.findingId}: reverification evidence attached (${merged.length} item(s)).`)
    }
    case 'finding/transition': {
      const seed = action.seedFinding
      const current = findingWithOverlay(seed, state)
      const check = checkTransition(current, action.to, state, { independentCloser: action.independentCloser })
      if (!check.ok) return state
      const existing = state.findingOverlays[action.findingId]
      const base: FindingOverlay = existing ?? { status: seed.status, appendedHistory: [], reverificationEvidence: [] }
      const entry: FindingHistoryEntry = {
        at: action.at,
        actor: action.actor,
        action: FINDING_STATUS_LABEL[action.to],
        ...(action.note !== undefined && action.note !== '' ? { note: action.note } : {}),
      }
      const next: FindingOverlay = {
        ...base,
        status: action.to,
        appendedHistory: [...base.appendedHistory, entry],
        ...(action.independentCloser !== undefined ? { independentCloser: action.independentCloser } : {}),
      }
      const s = { ...state, findingOverlays: { ...state.findingOverlays, [action.findingId]: next } }
      return logEvent(s, action.at, 'finding-transition', `${action.findingId} → ${FINDING_STATUS_LABEL[action.to]} (${action.actor}).`)
    }
    case 'review/record': {
      const id = `REV-LOCAL-${String(state.seq).padStart(3, '0')}`
      const review: RecordedReview = { ...action.review, id }
      const s = { ...state, recordedReviews: [review, ...state.recordedReviews] }
      return logEvent(s, action.at, 'review-recorded', `Review ${id} recorded for ${review.subjectId} (${review.result}).`)
    }
    case 'package/add': {
      const id = `PKG-2026-${String(100 + state.seq)}`
      const pkg: AuditPackage = { ...action.pkg, id }
      const s = { ...state, packages: [pkg, ...state.packages] }
      return logEvent(s, action.at, 'package-created', `Audit package ${id} created (${pkg.evidenceCount} evidence item(s), ${pkg.findingIds.length} finding(s), ${pkg.reviewIds.length} review(s)).`)
    }
    case 'package/cancelled':
      return logEvent(state, action.at, 'package-cancelled', `Package build “${action.name}” cancelled before completion.`)
    case 'baseline/set': {
      if (state.prefs.baseline === action.baseline) return state
      const s = { ...state, prefs: { ...state.prefs, baseline: action.baseline } }
      return logEvent(s, action.at, 'baseline-changed', `Active baseline set to ${action.baseline}.`)
    }
    case 'baseline/sync':
      return {
        ...state,
        prefs: {
          ...state.prefs,
          baseline: action.baseline,
          compare: action.comparisonAvailable ? state.prefs.compare : false,
        },
      }
    case 'compare/set':
      return { ...state, prefs: { ...state.prefs, compare: action.compare } }
    case 'nav/collapse':
      return { ...state, prefs: { ...state.prefs, navCollapsed: action.collapsed } }
    case 'refresh/complete':
      return logEvent(state, action.at, 'refresh', `Refresh republished the sample snapshot (${action.sourceCount} sources scanned, 0 diagnostics fatal).`)
    case 'reset': {
      const s: OverlayState = { ...initialOverlay, activity: state.activity, seq: state.seq }
      return logEvent(
        s,
        action.at,
        'sample-reset',
        'Sample changes reset: 12 findings restored to seeded state, 45 review defaults restored, local packages cleared (1 seeded package retained), preferences reset, baseline 2.4.0.',
      )
    }
    default:
      return state
  }
}

export function loadOverlay(storage: Pick<Storage, 'getItem'>): OverlayState {
  try {
    const rawValue = storage.getItem(OVERLAY_STORAGE_KEY)
    if (rawValue === null) return initialOverlay
    const parsed = JSON.parse(rawValue) as OverlayState
    if (parsed.version !== 1) return initialOverlay
    return { ...initialOverlay, ...parsed, prefs: { ...initialOverlay.prefs, ...parsed.prefs } }
  } catch {
    return initialOverlay
  }
}

export function saveOverlay(storage: Pick<Storage, 'setItem'>, state: OverlayState): void {
  try {
    storage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Persistence is best-effort; the sample remains usable without it.
  }
}
