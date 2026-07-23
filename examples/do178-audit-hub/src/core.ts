// Core: domain types, deterministic helpers, and hash routing.
import { useCallback, useSyncExternalStore } from 'react'

// ===== from domain/types.ts =====
// Domain types for the DO-178C Audit Hub sample workspace.
// Authoritative evidence is read-only fixture data; only hub-local
// finding/review/package/overlay state is mutable (see store/overlay.ts).

export type Phase =
  | 'planning'
  | 'requirements'
  | 'design'
  | 'implementation'
  | 'verification'
  | 'cm'
  | 'qa'
  | 'certification'

export type Baseline = '2.3.0' | '2.4.0'

export type SourceKind =
  | 'SLREQX'
  | 'SLMX'
  | 'SLX'
  | 'SLDD'
  | 'SLDATX'
  | 'XLSX'
  | 'C'
  | 'H'
  | 'REVIEW'
  | 'CONFIG'

export type EvidenceType =
  | 'plan'
  | 'standard'
  | 'sys-requirement'
  | 'hlr'
  | 'llr'
  | 'derived-requirement'
  | 'model'
  | 'harness'
  | 'data-dictionary'
  | 'model-element'
  | 'source-file'
  | 'function'
  | 'test-case'
  | 'result-set'
  | 'result'
  | 'objective'
  | 'config-item'

export type EvidenceStatus =
  | 'approved'
  | 'in-review'
  | 'draft'
  | 'passed'
  | 'failed'
  | 'blocked'
  | 'not-run'
  | 'stale'
  | 'satisfied'
  | 'partial'
  | 'unsatisfied'

export type ReviewState = 'approved' | 'pending' | 'stale' | 'rejected' | 'not-reviewed'

/** Delta classification of a record in baseline 2.4.0 relative to 2.3.0. */
export type ChangeMark = 'added' | 'changed' | 'stale' | 'impacted' | 'unchanged'

export interface EvidenceRecord {
  id: string
  title: string
  type: EvidenceType
  phase: Phase
  status: EvidenceStatus
  revision: string
  sourcePath: string
  sourceKind: SourceKind
  /** SHA-256-like synthetic content hash. */
  hash: string
  modified: string
  baseline: Baseline | 'both'
  upstream: string[]
  downstream: string[]
  reviewState: ReviewState
  findingIds: string[]
  provenance: string
  changeMark: ChangeMark
  /** Type-specific attributes (owner, coverage, loc, iterations, …). */
  meta: Record<string, string | number>
}

export type FindingStatus =
  | 'open'
  | 'assigned'
  | 'dispositioned'
  | 'corrective-action'
  | 'ready-for-closure'
  | 'reverified'
  | 'closed'

export type FindingSeverity = 'high' | 'medium' | 'low'

export interface FindingHistoryEntry {
  at: string
  actor: string
  action: string
  note?: string
}

export interface Finding {
  id: string
  title: string
  detail: string
  severity: FindingSeverity
  phase: Phase
  owner: string
  status: FindingStatus
  due: string
  evidenceIds: string[]
  disposition?: string
  correctiveAction?: string
  reverificationPlan?: string
  /** Immutable seeded history; overlay appends, never rewrites. */
  history: FindingHistoryEntry[]
}

export type ReviewMethod = 'inspection' | 'walkthrough' | 'analysis' | 'checklist'
export type ReviewResult = 'passed' | 'passed-with-actions' | 'failed' | 'pending'

export interface ReviewRecord {
  id: string
  reviewType: string
  subjectId: string
  phase: Phase
  reviewer: string
  method: ReviewMethod
  date: string
  revision: string
  result: ReviewResult
  independent: boolean
  openActions: number
  comments: string
  findingIds: string[]
}

export type ChangeKind = 'change' | 'problem'

export interface ChangeRecord {
  id: string
  kind: ChangeKind
  title: string
  status: 'open' | 'implemented' | 'verified' | 'closed' | 'deferred'
  owner: string
  raised: string
  baseline: Baseline
  affectedIds: string[]
  reverified: boolean
  findingIds: string[]
  detail: string
}

export interface BaselineInfo {
  id: Baseline
  label: string
  published: string
  itemCount: number
  status: 'released' | 'active'
  notes: string
}

export interface AuditRecord {
  id: string
  scope: string
  auditor: string
  date: string
  result: 'conformant' | 'observations' | 'nonconformance'
  openActions: number
  phase: Phase
}

// ===== from lib/util.ts =====
// Small shared helpers. Deterministic — no wall-clock or randomness in fixtures.

/** Safe cyclic index for readonly arrays under noUncheckedIndexedAccess. */
export function pick<T>(arr: readonly T[], i: number): T {
  const n = arr.length
  return arr[((i % n) + n) % n] as T
}

/** Deterministic SHA-256-like hex digest (synthetic; FNV-1a rounds). */
export function fakeHash(seed: string): string {
  let out = ''
  let h = 0x811c9dc5
  for (let round = 0; round < 8; round++) {
    h = (h ^ (round * 0x9e3779b9)) >>> 0
    for (let i = 0; i < seed.length; i++) {
      h = (h ^ seed.charCodeAt(i)) >>> 0
      h = Math.imul(h, 0x01000193) >>> 0
    }
    out += h.toString(16).padStart(8, '0')
  }
  return out
}

const DAY_MS = 86_400_000
const BASE = Date.UTC(2026, 2, 2, 8, 0) // 2026-03-02T08:00Z

/** Deterministic ISO timestamp: `day` days and `minute` minutes after the sample epoch. */
export function iso(day: number, minute = 0): string {
  const d = new Date(BASE + day * DAY_MS + minute * 60_000)
  return d.toISOString().slice(0, 16) + 'Z'
}

export function fmtDate(isoStr: string): string {
  return isoStr.slice(0, 10)
}

export function fmtDateTime(isoStr: string): string {
  return isoStr.replace('T', ' ').replace('Z', ' UTC')
}

export function shortHash(hash: string): string {
  return hash.slice(0, 12) + '…'
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function pctText(n: number, d: number): string {
  if (d === 0) return '—'
  return ((n / d) * 100).toFixed(1) + '%'
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

export function metaStr(meta: Record<string, string | number>, key: string): string {
  const v = meta[key]
  return v === undefined ? '' : String(v)
}

export function metaNum(meta: Record<string, string | number>, key: string): number {
  const v = meta[key]
  return typeof v === 'number' ? v : 0
}

// ===== from lib/router.ts =====
// Hand-rolled hash routing (no router dependency). Deep-link-friendly:
//   #/requirements/hlr?select=SWR-HLR-LAT-021&itab=trace&f=untraced&demo=loading

export interface Route {
  /** Path segments, e.g. ['requirements', 'hlr']. */
  path: string[]
  params: URLSearchParams
}

export type DemoState = 'loading' | 'empty' | 'error' | 'partial' | null

function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '')
  const qIdx = raw.indexOf('?')
  const pathPart = qIdx >= 0 ? raw.slice(0, qIdx) : raw
  const queryPart = qIdx >= 0 ? raw.slice(qIdx + 1) : ''
  const path = pathPart.split('/').filter(Boolean).map(decodeURIComponent)
  return { path, params: new URLSearchParams(queryPart) }
}

export function formatHash(path: string[], params?: Record<string, string | null>): string {
  const base = '#/' + path.map(encodeURIComponent).join('/')
  const search = new URLSearchParams()
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== null && v !== '') search.set(k, v)
    }
  }
  const q = search.toString()
  return q ? `${base}?${q}` : base
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

function getSnapshot(): string {
  return window.location.hash
}

export function useRoute(): Route & {
  navigate: (path: string[], params?: Record<string, string | null>) => void
  /** Merge params into the current route without changing the path. */
  setParams: (patch: Record<string, string | null>) => void
} {
  const hash = useSyncExternalStore(subscribe, getSnapshot)
  const route = parseHash(hash)

  const navigate = useCallback((path: string[], params?: Record<string, string | null>) => {
    window.location.hash = formatHash(path, params)
  }, [])

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const current = parseHash(window.location.hash)
      const merged: Record<string, string | null> = {}
      current.params.forEach((v, k) => {
        merged[k] = v
      })
      Object.assign(merged, patch)
      window.location.hash = formatHash(current.path, merged)
    },
    [],
  )

  return { ...route, navigate, setParams }
}

export function demoStateOf(params: URLSearchParams): DemoState {
  const v = params.get('demo')
  if (v === 'loading' || v === 'empty' || v === 'error' || v === 'partial') return v
  return null
}
