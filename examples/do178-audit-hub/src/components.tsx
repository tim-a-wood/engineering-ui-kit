// Reusable UI: store context, primitives, dialogs, tables, trace, inspector, shell.
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { cx, demoStateOf, fmtDateTime, formatHash, useRoute } from './core.ts'
import type { Baseline, DemoState, EvidenceRecord, EvidenceStatus, Finding, FindingSeverity, FindingStatus, Phase, ReviewMethod, ReviewResult, ReviewState } from './core.ts'
import { PEOPLE, PHASES, PHASE_LABEL, REVIEW_STATE_LABEL, STATUS_LABEL, TYPE_LABEL, WATERMARK, WORKSPACE_NAME, allEvidence, canonicalChain, compareBaselines, findings, findings as seedFindings, findingsFor, getEvidence, hydrateFromSnapshot, phaseStats, refreshSourceCounts, reviewRecords, reviewsFor, sampleCounts, searchEvidence, traceFrom } from './fixtures.ts'
import { FINDING_STATUS_LABEL, findingWithOverlay, loadOverlay, openFindingIds, overlayReducer, saveOverlay } from './store.ts'
import type { OverlayAction, OverlayState } from './store.ts'
import {
  AuditHubApiError,
  buildAuditPackage,
  connectProject,
  loadRuntimeSnapshot,
  recordEvidenceReview,
  resetSampleOverlay,
  runProjectRefresh,
  transitionFinding,
} from './api.ts'
import type {
  ConnectProjectInput,
  ReviewSubmission,
  RuntimeDiagnostic,
  RuntimePackageManifest,
  RuntimePackageRecord,
  RuntimeWorkspace,
} from './api.ts'

// ===== from store/store.tsx =====
// React context around the overlay reducer with localStorage persistence and
// a polite live announcer for success/status messages.

interface StoreValue {
  overlay: OverlayState
  dispatch: (action: OverlayAction) => void
  mergedFindings: Finding[]
  openIds: Set<string>
  announce: (message: string) => void
  announcement: string
  now: () => string
  runtime: {
    status: 'loading' | 'ready' | 'fallback' | 'error'
    workspace: RuntimeWorkspace
    snapshotId: string
    baselineId: string
    comparisonBaselineId?: string
    publishedAt: string
    availableBaselines: string[]
    packages: RuntimePackageRecord[]
    activity: Array<Record<string, unknown>>
    diagnostics: RuntimeDiagnostic[]
    error?: string
  }
  reloadRuntime: () => Promise<void>
  connectRuntimeProject: (input: ConnectProjectInput) => Promise<void>
  refreshRuntime: () => Promise<{
    status: 'published' | 'sample'
    diagnostics: RuntimeDiagnostic[]
  }>
  resetRuntimeSample: () => Promise<void>
  recordRuntimeReview: (subject: EvidenceRecord, review: ReviewSubmission) => Promise<void>
  transitionRuntimeFinding: (
    findingId: string,
    status: FindingStatus,
    payload: Record<string, unknown>,
  ) => Promise<void>
  buildRuntimePackage: (selection: {
    name: string
    evidenceIds: string[]
    phaseIds: Phase[]
    includeFindings: boolean
    includeReviews: boolean
  }) => Promise<{
    packageId: string
    manifest: RuntimePackageManifest
    download: { path: string; url: string; contentHash: string }
  }>
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [overlay, dispatch] = useReducer(overlayReducer, undefined, () => loadOverlay(window.localStorage))
  const [announcement, setAnnouncement] = useState('')
  const announceTimer = useRef<number | null>(null)
  const [runtime, setRuntime] = useState<StoreValue['runtime']>({
    status: 'loading',
    workspace: {
      id: 'sample-aeronav',
      name: WORKSPACE_NAME,
      kind: 'sample',
      softwareLevel: 'Level B',
      do331Applicable: true,
      watermark: WATERMARK,
    },
    snapshotId: 'sample-aeronav-2.4.0',
    baselineId: '2.4.0',
    comparisonBaselineId: '2.3.0',
    publishedAt: '2026-07-22T00:00:00.000Z',
    availableBaselines: ['2.4.0', '2.3.0'],
    packages: [],
    activity: [],
    diagnostics: [],
  })

  useEffect(() => {
    saveOverlay(window.localStorage, overlay)
  }, [overlay])

  const announce = useCallback((message: string) => {
    setAnnouncement(message)
    if (announceTimer.current !== null) window.clearTimeout(announceTimer.current)
    announceTimer.current = window.setTimeout(() => setAnnouncement(''), 6000)
  }, [])

  const now = useCallback(() => new Date().toISOString().slice(0, 16) + 'Z', [])

  const reloadRuntime = useCallback(async () => {
    setRuntime((current) => ({ ...current, status: 'loading', error: undefined }))
    try {
      const snapshot = await loadRuntimeSnapshot()
      hydrateFromSnapshot(snapshot)
      const availableBaselines = Array.from(new Set([
        snapshot.baselineId,
        ...(snapshot.comparisonBaselineId ? [snapshot.comparisonBaselineId] : []),
        ...snapshot.baselines.flatMap((entry) => (
          entry && typeof entry === 'object' && 'id' in entry && typeof entry.id === 'string'
            ? [entry.id]
            : []
        )),
      ]))
      dispatch({
        type: 'baseline/sync',
        baseline: snapshot.baselineId,
        comparisonAvailable: Boolean(snapshot.comparisonBaselineId),
      })
      setRuntime({
        status: 'ready',
        workspace: snapshot.workspace,
        snapshotId: snapshot.snapshotId,
        baselineId: snapshot.baselineId,
        ...(snapshot.comparisonBaselineId ? { comparisonBaselineId: snapshot.comparisonBaselineId } : {}),
        publishedAt: snapshot.publishedAt,
        availableBaselines,
        packages: snapshot.packages ?? [],
        activity: snapshot.activity ?? [],
        diagnostics: snapshot.diagnostics ?? [],
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setRuntime((current) => ({
        ...current,
        status: 'fallback',
        error: message,
        diagnostics: [],
      }))
      announce(`Backend unavailable — using bundled sample: ${message}`)
    }
  }, [announce])

  useEffect(() => {
    void reloadRuntime()
  }, [reloadRuntime])

  const connectRuntimeProject = useCallback(async (input: ConnectProjectInput) => {
    await connectProject(input)
    await reloadRuntime()
  }, [reloadRuntime])

  const refreshRuntime = useCallback(async () => {
    if (runtime.workspace.kind === 'sample') {
      await reloadRuntime()
      return { status: 'sample' as const, diagnostics: [] }
    }
    const result = await runProjectRefresh(runtime.workspace.id)
    if (result.status !== 'published') {
      const fatal = result.diagnostics.find((item) => item.severity === 'fatal')
      throw new AuditHubApiError(
        fatal?.code ?? 'refresh-not-published',
        fatal?.message ?? 'The candidate snapshot was not published.',
        false,
      )
    }
    await reloadRuntime()
    return { status: 'published' as const, diagnostics: result.diagnostics }
  }, [reloadRuntime, runtime.workspace.id, runtime.workspace.kind])

  const resetRuntimeSample = useCallback(async () => {
    if (runtime.workspace.kind === 'sample') {
      await resetSampleOverlay(runtime.workspace.id)
      await reloadRuntime()
    }
  }, [reloadRuntime, runtime.workspace.id, runtime.workspace.kind])

  const recordRuntimeReview = useCallback(async (subject: EvidenceRecord, review: ReviewSubmission) => {
    await recordEvidenceReview(runtime.workspace.id, [subject.id], review)
    await reloadRuntime()
  }, [reloadRuntime, runtime.workspace.id])

  const transitionRuntimeFinding = useCallback(async (
    findingId: string,
    status: FindingStatus,
    payload: Record<string, unknown>,
  ) => {
    await transitionFinding(runtime.workspace.id, findingId, status, payload)
    await reloadRuntime()
  }, [reloadRuntime, runtime.workspace.id])

  const buildRuntimePackage = useCallback(async (selection: {
    name: string
    evidenceIds: string[]
    phaseIds: Phase[]
    includeFindings: boolean
    includeReviews: boolean
  }) => {
    const result = await buildAuditPackage(runtime.workspace.id, runtime.snapshotId, selection)
    await reloadRuntime()
    return result
  }, [reloadRuntime, runtime.snapshotId, runtime.workspace.id])

  const value = useMemo<StoreValue>(() => {
    const mergedFindings = findings.map((f) => findingWithOverlay(f, overlay))
    return {
      overlay,
      dispatch,
      mergedFindings,
      openIds: openFindingIds(findings, overlay),
      announce,
      announcement,
      now,
      runtime,
      reloadRuntime,
      connectRuntimeProject,
      refreshRuntime,
      resetRuntimeSample,
      recordRuntimeReview,
      transitionRuntimeFinding,
      buildRuntimePackage,
    }
  }, [
    overlay,
    announce,
    announcement,
    now,
    runtime,
    reloadRuntime,
    connectRuntimeProject,
    refreshRuntime,
    resetRuntimeSample,
    recordRuntimeReview,
    transitionRuntimeFinding,
    buildRuntimePackage,
  ])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext)
  if (!v) throw new Error('useStore must be used within StoreProvider')
  return v
}

// ===== from components/ui.tsx =====
// Small shared presentational primitives.

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const TONE_GLYPH: Record<Tone, string> = {
  success: '✓',
  warning: '!',
  danger: '✕',
  info: 'i',
  neutral: '·',
}

export function Chip({ tone, children, title }: { tone: Tone; children: ReactNode; title?: string }) {
  return (
    <span className="chip" data-tone={tone} title={title}>
      <span className="chip-glyph" aria-hidden="true">
        {TONE_GLYPH[tone]}
      </span>
      {children}
    </span>
  )
}

export function statusTone(status: EvidenceStatus): Tone {
  switch (status) {
    case 'approved':
    case 'passed':
    case 'satisfied':
      return 'success'
    case 'in-review':
    case 'draft':
    case 'partial':
    case 'blocked':
      return 'warning'
    case 'failed':
    case 'unsatisfied':
      return 'danger'
    case 'stale':
    case 'not-run':
      return 'warning'
    default:
      return 'neutral'
  }
}

export function StatusChip({ status }: { status: EvidenceStatus }) {
  return <Chip tone={statusTone(status)}>{STATUS_LABEL[status]}</Chip>
}

export function reviewTone(state: ReviewState): Tone {
  switch (state) {
    case 'approved':
      return 'success'
    case 'pending':
    case 'stale':
      return 'warning'
    case 'rejected':
      return 'danger'
    default:
      return 'neutral'
  }
}

export function ReviewChip({ state }: { state: ReviewState }) {
  return <Chip tone={reviewTone(state)}>{REVIEW_STATE_LABEL[state]}</Chip>
}

export function severityTone(sev: FindingSeverity): Tone {
  return sev === 'high' ? 'danger' : sev === 'medium' ? 'warning' : 'neutral'
}

export function findingStatusTone(status: FindingStatus): Tone {
  if (status === 'closed' || status === 'reverified') return 'success'
  if (status === 'ready-for-closure') return 'info'
  return 'warning'
}

export function CopyLine({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <span className="copy-line">
      <code title={value}>{value}</code>
      <button
        type="button"
        className="btn btn-quiet btn-sm"
        onClick={() => {
          void navigator.clipboard?.writeText(value).catch(() => {})
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1500)
        }}
      >
        {copied ? 'Copied' : `Copy ${label}`}
      </button>
    </span>
  )
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint: string
  action?: ReactNode
}) {
  return (
    <div className="state-block" role="status">
      <h3>{title}</h3>
      <p>{hint}</p>
      {action}
    </div>
  )
}

export function ErrorState({ title, detail, onRetry, retrying }: { title: string; detail: string; onRetry?: () => void; retrying?: boolean }) {
  return (
    <div className="state-block" role="alert">
      <h3>{title}</h3>
      <p>{detail}</p>
      {onRetry ? (
        <button type="button" className="btn" onClick={onRetry} disabled={retrying}>
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
      ) : null}
    </div>
  )
}

export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-4)' }} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ width: `${88 - (i % 3) * 14}%` }} />
      ))}
    </div>
  )
}

export function Alert({ tone, title, children }: { tone: Tone; title: string; children?: ReactNode }) {
  return (
    <div className="alert" data-tone={tone} role={tone === 'danger' ? 'alert' : 'status'}>
      <span aria-hidden="true">{TONE_GLYPH[tone]}</span>
      <span>
        <b>{title}</b>
        {children ? <span className="alert-body"> — {children}</span> : null}
      </span>
    </div>
  )
}

export function Watermark() {
  return (
    <p className="watermark" role="note">
      <span aria-hidden="true">⚠</span> Synthetic sample — not certification evidence
    </p>
  )
}

export function Meter({
  label,
  value,
  max = 100,
  tone,
  valueText,
}: {
  label: string
  value: number
  max?: number
  tone?: 'warning' | 'danger'
  valueText?: string
}) {
  const pct = max === 0 ? 0 : Math.min(100, (value / max) * 100)
  return (
    <div className="meter">
      <span>{label}</span>
      <span
        className="bar"
        role="img"
        aria-label={`${label}: ${valueText ?? `${value} of ${max}`}`}
      >
        <span style={{ width: `${pct}%` }} data-tone={tone} />
      </span>
      <span className="value">{valueText ?? `${Math.round(pct)}%`}</span>
    </div>
  )
}

export function Field({
  label,
  hint,
  error,
  children,
  id,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
  id: string
}) {
  return (
    <div className={cx('field')}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children}
      <span className={cx('field-hint', error && 'error')} id={`${id}-hint`} role={error ? 'alert' : undefined}>
        {error ?? hint ?? ''}
      </span>
    </div>
  )
}

export function Tabs({
  tabs,
  active,
  onSelect,
  label,
}: {
  tabs: Array<{ key: string; label: string }>
  active: string
  onSelect: (key: string) => void
  label: string
}) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          className="tab"
          aria-selected={t.key === active}
          onClick={() => onSelect(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ===== from components/Dialog.tsx =====
// Modal dialog and right-side drawer with scrim, focus containment, Escape,
// and focus restoration to the invoking control (FND-A11Y-007).

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function useModalBehavior(onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const container = containerRef.current
    if (container) {
      const first = container.querySelector<HTMLElement>(FOCUSABLE)
      ;(first ?? container).focus()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Tab' && container) {
        const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (el) => el.offsetParent !== null || el === document.activeElement,
        )
        if (focusables.length === 0) return
        const first = focusables[0] as HTMLElement
        const last = focusables[focusables.length - 1] as HTMLElement
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      previouslyFocused?.focus()
    }
  }, [onClose])

  return containerRef
}

export function Dialog({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const ref = useModalBehavior(onClose)
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={wide ? 'dialog wide' : 'dialog'}
        tabIndex={-1}
      >
        <div className="dialog-header">
          <h2>{title}</h2>
          <button type="button" className="btn btn-quiet btn-sm" style={{ marginLeft: 'auto' }} onClick={onClose}>
            Close
          </button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer ? <div className="dialog-footer">{footer}</div> : null}
      </div>
    </>
  )
}

export function Drawer({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  const ref = useModalBehavior(onClose)
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="drawer" tabIndex={-1}>
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600, overflowWrap: 'anywhere' }}>{title}</h2>
            <button type="button" className="btn btn-quiet btn-sm" style={{ marginLeft: 'auto' }} onClick={onClose}>
              Close
            </button>
          </div>
          {subtitle}
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </>
  )
}

// ===== from components/charts.tsx =====
// Lightweight SVG chart primitives framed per CMP-VIZ-CHART-PANEL: every chart
// lives in a titled panel with a legend and a text/table fallback beside it.

export interface BarDatum {
  label: string
  value: number
  tone?: 'primary' | 'secondary' | 'warning' | 'danger'
}

const TONE_VAR: Record<NonNullable<BarDatum['tone']>, string> = {
  primary: 'var(--chart-series-primary)',
  secondary: 'var(--chart-series-secondary)',
  warning: 'var(--chart-series-warning)',
  danger: 'var(--chart-series-danger)',
}

/** Horizontal bar chart with round-step gridlines and value labels. */
export function BarChart({ data, max, unit, ariaLabel }: { data: BarDatum[]; max?: number; unit: string; ariaLabel: string }) {
  const m = max ?? Math.max(10, ...data.map((d) => d.value))
  // round the axis max up to a clean step
  const step = m <= 12 ? 2 : m <= 60 ? 10 : m <= 120 ? 20 : 50
  const axisMax = Math.ceil(m / step) * step
  const rowH = 22
  const labelW = 150
  const chartW = 420
  const h = data.length * rowH + 24
  const ticks: number[] = []
  for (let t = 0; t <= axisMax; t += step) ticks.push(t)
  return (
    <svg viewBox={`0 0 ${labelW + chartW + 56} ${h}`} role="img" aria-label={ariaLabel}>
      {ticks.map((t) => {
        const x = labelW + (t / axisMax) * chartW
        return (
          <g key={t}>
            <line x1={x} y1={0} x2={x} y2={h - 18} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={x} y={h - 5} fontSize={10} textAnchor="middle" fill="var(--chart-axis)">
              {t}
            </text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const y = i * rowH + 4
        const w = axisMax === 0 ? 0 : (d.value / axisMax) * chartW
        return (
          <g key={d.label}>
            <text x={labelW - 8} y={y + 11} fontSize={11} textAnchor="end" fill="var(--chart-axis)">
              {d.label.length > 22 ? d.label.slice(0, 21) + '…' : d.label}
            </text>
            <rect x={labelW} y={y} width={Math.max(1, w)} height={14} rx={2} fill={TONE_VAR[d.tone ?? 'primary']} />
            <text x={labelW + w + 6} y={y + 11} fontSize={10} fill="var(--chart-axis)" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {d.value}
              {unit === '%' ? '%' : ''}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function ChartPanel({
  title,
  scope,
  unit,
  children,
  legend,
  summary,
}: {
  title: string
  scope: string
  unit: string
  children: ReactNode
  legend?: Array<{ label: string; tone: NonNullable<BarDatum['tone']> }>
  summary: ReactNode
}) {
  return (
    <figure className="panel chart-panel" style={{ margin: 0 }}>
      <figcaption>
        <h3 className="panel-title">{title}</h3>
        <p className="panel-sub">
          {scope} · unit: {unit}
        </p>
      </figcaption>
      {children}
      {legend ? (
        <div className="chart-legend" aria-hidden="false">
          {legend.map((l) => (
            <span className="key" key={l.label}>
              <span className="swatch" style={{ background: TONE_VAR[l.tone] }} aria-hidden="true" />
              {l.label}
            </span>
          ))}
        </div>
      ) : null}
      <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{summary}</div>
    </figure>
  )
}

// ===== from components/EvidenceTable.tsx =====
// Generic filterable/sortable evidence table: text filter, quick-filter chips,
// column sort with aria-sort, row selection, keyboard navigation (arrow keys +
// Enter), pagination, and empty-filter recovery.

export interface Column {
  key: string
  label: string
  render: (r: EvidenceRecord) => ReactNode
  sortValue?: (r: EvidenceRecord) => string | number
  numeric?: boolean
  idCell?: boolean
}

export interface QuickFilter {
  key: string
  label: string
  predicate: (r: EvidenceRecord) => boolean
}

const PAGE_SIZE = 12

export function EvidenceTable({
  rows,
  columns,
  quickFilters = [],
  activeQuickFilter,
  onQuickFilter,
  onOpen,
  onReview,
  demo = null,
  onDemoRetry,
  label,
  searchPlaceholder = 'Filter by ID or title',
  selectedId,
}: {
  rows: EvidenceRecord[]
  columns: Column[]
  quickFilters?: QuickFilter[]
  activeQuickFilter?: string | null
  onQuickFilter?: (key: string | null) => void
  onOpen: (r: EvidenceRecord) => void
  onReview?: (r: EvidenceRecord) => void
  demo?: DemoState
  onDemoRetry?: () => void
  label: string
  searchPlaceholder?: string
  selectedId?: string | null
}) {
  const [text, setText] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<1 | -1>(1)
  const [page, setPage] = useState(0)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const tbodyRef = useRef<HTMLTableSectionElement>(null)

  const activeFilter = quickFilters.find((f) => f.key === activeQuickFilter)

  const filtered = useMemo(() => {
    let out = rows
    if (activeFilter) out = out.filter(activeFilter.predicate)
    const q = text.trim().toLowerCase()
    if (q !== '') out = out.filter((r) => r.id.toLowerCase().includes(q) || r.title.toLowerCase().includes(q))
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey)
      const sv = col?.sortValue ?? ((r: EvidenceRecord) => r.id)
      out = [...out].sort((a, b) => {
        const va = sv(a)
        const vb = sv(b)
        if (va < vb) return -sortDir
        if (va > vb) return sortDir
        return 0
      })
    }
    return out
  }, [rows, activeFilter, text, sortKey, sortDir, columns])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const clampedPage = Math.min(page, pageCount - 1)
  const pageRows = filtered.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE)

  useEffect(() => {
    setPage(0)
  }, [text, activeQuickFilter, rows])

  const onRowKeyDown = (e: ReactKeyboardEvent<HTMLTableRowElement>, r: EvidenceRecord) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen(r)
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const rowsEl = Array.from(tbodyRef.current?.querySelectorAll<HTMLTableRowElement>('tr.row') ?? [])
      const idx = rowsEl.indexOf(e.currentTarget)
      const next = rowsEl[idx + (e.key === 'ArrowDown' ? 1 : -1)]
      next?.focus()
    }
  }

  const toggleSort = (col: Column) => {
    if (!col.sortValue) return
    if (sortKey === col.key) {
      setSortDir((d) => (d === 1 ? -1 : 1))
    } else {
      setSortKey(col.key)
      setSortDir(1)
    }
  }

  if (demo === 'loading') {
    return (
      <div className="table-shell" aria-busy="true">
        <p className="visually-hidden" role="status">
          Loading {label}…
        </p>
        <SkeletonRows rows={8} />
      </div>
    )
  }
  if (demo === 'error') {
    return (
      <div className="table-shell">
        <ErrorState
          title="Evidence source unavailable"
          detail="The sample adapter reported a technical failure while reading this evidence table."
          onRetry={onDemoRetry}
        />
      </div>
    )
  }
  if (demo === 'empty') {
    return (
      <div className="table-shell">
        <EmptyState title="No evidence in this subview" hint="The connected project reported zero records for this scope." />
      </div>
    )
  }

  const hasActiveFilters = text !== '' || activeQuickFilter != null

  return (
    <div className="table-shell">
      {demo === 'partial' ? (
        <div style={{ padding: 'var(--space-2) var(--space-3) 0' }}>
          <Alert tone="warning" title="Partial data">
            One source file could not be parsed during the last refresh; rows from it are omitted.
          </Alert>
        </div>
      ) : null}
      <div className="table-toolbar">
        <input
          type="search"
          className="input"
          style={{ width: 240 }}
          placeholder={searchPlaceholder}
          aria-label={`Filter ${label}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {quickFilters.map((f) => (
          <button
            key={f.key}
            type="button"
            className="filter-chip"
            aria-pressed={activeQuickFilter === f.key}
            onClick={() => onQuickFilter?.(activeQuickFilter === f.key ? null : f.key)}
          >
            {f.label} ({rows.filter(f.predicate).length})
          </button>
        ))}
        {checked.size > 0 ? (
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            {checked.size} selected
          </span>
        ) : null}
      </div>
      <div className="table-scroll">
        <table className="data" aria-label={label}>
          <thead>
            <tr>
              <th style={{ width: 28 }}>
                <span className="visually-hidden">Select</span>
              </th>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cx(c.numeric && 'num', c.sortValue && 'sortable')}
                  aria-sort={sortKey === c.key ? (sortDir === 1 ? 'ascending' : 'descending') : undefined}
                  onClick={() => toggleSort(c)}
                >
                  {c.label}
                  {sortKey === c.key ? <span aria-hidden="true"> {sortDir === 1 ? '↑' : '↓'}</span> : null}
                </th>
              ))}
              {onReview ? (
                <th>
                  <span className="visually-hidden">Row actions</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody ref={tbodyRef}>
            {pageRows.map((r) => (
              <tr
                key={r.id}
                className="row"
                tabIndex={0}
                aria-selected={selectedId === r.id}
                onClick={() => onOpen(r)}
                onKeyDown={(e) => onRowKeyDown(e, r)}
              >
                <td
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.id}`}
                    checked={checked.has(r.id)}
                    onChange={(e) => {
                      const next = new Set(checked)
                      if (e.target.checked) next.add(r.id)
                      else next.delete(r.id)
                      setChecked(next)
                    }}
                  />
                </td>
                {columns.map((c) => {
                  const sv = c.sortValue?.(r)
                  return (
                    <td
                      key={c.key}
                      className={cx(c.numeric && 'num', c.idCell && 'id-cell')}
                      title={typeof sv === 'string' ? sv : undefined}
                    >
                      {c.render(r)}
                    </td>
                  )
                })}
                {onReview ? (
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="btn btn-quiet btn-sm"
                      onClick={() => onReview(r)}
                      aria-label={`Record review for ${r.id}`}
                    >
                      Review
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageRows.length === 0 ? (
        <EmptyState
          title="No rows match the current filters"
          hint={hasActiveFilters ? 'Adjust or clear the filters to see evidence again.' : 'This scope holds no records.'}
          action={
            hasActiveFilters ? (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setText('')
                  onQuickFilter?.(null)
                }}
              >
                Clear filters
              </button>
            ) : undefined
          }
        />
      ) : null}
      <div className="table-footer">
        <span>
          {filtered.length} of {rows.length} records
        </span>
        <span className="pager">
          <button type="button" className="btn btn-quiet btn-sm" disabled={clampedPage === 0} onClick={() => setPage(clampedPage - 1)}>
            ‹ Prev
          </button>
          <span aria-live="polite">
            Page {clampedPage + 1} / {pageCount}
          </span>
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            disabled={clampedPage >= pageCount - 1}
            onClick={() => setPage(clampedPage + 1)}
          >
            Next ›
          </button>
        </span>
      </div>
    </div>
  )
}

// ===== from components/TraceView.tsx =====
// Trace chain visualization: upstream ▲ / focus / downstream ▼ with node
// types, status, provenance, gap markers, and linked findings.

function NodeRow({
  record,
  id,
  gap,
  isFocus,
  onNavigate,
}: {
  record: EvidenceRecord | undefined
  id: string
  gap: boolean
  isFocus: boolean
  onNavigate: (id: string) => void
}) {
  const linked = record ? findingsFor(record.id) : []
  return (
    <li>
      <div className={cx('trace-node', isFocus && 'focus', gap && 'gap')}>
        <span className="trace-type">{record ? TYPE_LABEL[record.type] : 'Unresolved'}</span>
        <span className="trace-main">
          {record ? (
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              style={{ padding: 0, height: 'auto', display: 'block', textAlign: 'left' }}
              onClick={() => onNavigate(id)}
              aria-label={`Open ${id} in inspector`}
            >
              <span className="trace-id">{id}</span>
            </button>
          ) : (
            <span className="trace-id">{id}</span>
          )}
          <span className="trace-title">
            {record ? record.title : 'Trace gap — target does not resolve in baseline 2.4.0'}
          </span>
          <span className="trace-title">{record ? record.provenance : 'No provenance available'}</span>
        </span>
        {record ? <StatusChip status={record.status} /> : <Chip tone="danger">Gap</Chip>}
        {linked.slice(0, 2).map((f) => (
          <Chip key={f.id} tone={severityTone(f.severity)} title={f.title}>
            {f.id}
          </Chip>
        ))}
      </div>
    </li>
  )
}

export function TraceView({ focusId, onNavigate }: { focusId: string; onNavigate: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  useEffect(() => setExpanded(false), [focusId])

  const allNodes = traceFrom(focusId)
  const canonicalIndex = canonicalChain.indexOf(focusId)
  const focusedNodes = canonicalIndex >= 0
    ? canonicalChain.map((id, index) => ({
      record: getEvidence(id),
      id,
      direction: index < canonicalIndex ? 'upstream' as const : index > canonicalIndex ? 'downstream' as const : 'focus' as const,
      depth: Math.abs(index - canonicalIndex),
      gap: getEvidence(id) === undefined,
    }))
    : allNodes.filter((node) => node.direction === 'focus' || node.depth === 1)
  const visibleIds = new Set(focusedNodes.map((node) => node.id))
  const hiddenCount = allNodes.filter((node) => !visibleIds.has(node.id)).length
  const nodes = expanded ? allNodes : focusedNodes
  const focus = nodes.find((n) => n.direction === 'focus')
  const upstream = nodes.filter((n) => n.direction === 'upstream').sort((a, b) => b.depth - a.depth)
  const downstream = nodes.filter((n) => n.direction === 'downstream').sort((a, b) => a.depth - b.depth)
  const focusRecord = focus?.record
  const hasGaps = allNodes.some((n) => n.gap) || (focusRecord ? focusRecord.downstream.length === 0 && focusRecord.type === 'llr' : false)

  return (
    <div>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 var(--space-2)' }}>
        {expanded
          ? 'Full bounded impact graph. '
          : canonicalIndex >= 0
            ? 'Representative end-to-end evidence path. '
            : 'Direct upstream sources and downstream impacts. '}
        {hasGaps ? 'Dashed nodes mark trace gaps.' : 'No trace gaps detected on this chain.'}
      </p>
      {hiddenCount > 0 ? (
        <button
          type="button"
          className="btn btn-sm"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          style={{ marginBottom: 'var(--space-3)' }}
        >
          {expanded ? 'Return to focused path' : `Explore full impact graph (${hiddenCount} more)`}
        </button>
      ) : null}
      <ol className="trace-list" aria-label={`Trace chain for ${focusId}`}>
        {upstream.map((n) => (
          <NodeRow key={`u-${n.id}`} record={n.record} id={n.id} gap={n.gap} isFocus={false} onNavigate={onNavigate} />
        ))}
        {upstream.length > 0 ? (
          <li className="trace-arrow" aria-hidden="true">
            ▲ upstream · ▼ downstream
          </li>
        ) : null}
        {focus ? <NodeRow record={focus.record} id={focus.id} gap={focus.gap} isFocus onNavigate={onNavigate} /> : null}
        {downstream.length > 0 ? (
          <li className="trace-arrow" aria-hidden="true">
            ▼
          </li>
        ) : null}
        {downstream.map((n) => (
          <NodeRow key={`d-${n.id}`} record={n.record} id={n.id} gap={n.gap} isFocus={false} onNavigate={onNavigate} />
        ))}
      </ol>
      {focusRecord && focusRecord.downstream.length === 0 && (focusRecord.type === 'llr' || focusRecord.type === 'function') ? (
        <p style={{ color: 'var(--status-danger)', fontSize: 'var(--text-sm)' }} role="note">
          ✕ Downstream trace missing — this record does not reach the next lifecycle artifact.
        </p>
      ) : null}
    </div>
  )
}

// ===== from components/Inspector.tsx =====
// Evidence inspector: right-side drawer with Overview, Trace, Provenance,
// Reviews, Findings, and Baseline history tabs. Copyable IDs/paths/hashes and
// related-evidence navigation.

export type InspectorTab = 'overview' | 'trace' | 'provenance' | 'reviews' | 'findings' | 'baseline'

const TABS: Array<{ key: InspectorTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'trace', label: 'Trace' },
  { key: 'provenance', label: 'Provenance' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'findings', label: 'Findings' },
  { key: 'baseline', label: 'Baseline history' },
]

function RelatedList({ title, ids, onNavigate }: { title: string; ids: string[]; onNavigate: (id: string) => void }) {
  if (ids.length === 0)
    return (
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
        {title}: none recorded.
      </p>
    )
  return (
    <>
      <h3 className="section-header" style={{ marginTop: 'var(--space-4)' }}>
        {title}
      </h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {ids.map((id) => {
          const target = getEvidence(id)
          return (
            <li key={id} style={{ padding: '2px 0' }}>
              {target ? (
                <button
                  type="button"
                  className="btn btn-quiet btn-sm mono"
                  onClick={() => onNavigate(id)}
                  aria-label={`Open related evidence ${id}`}
                >
                  {id}
                </button>
              ) : (
                <span className="mono" style={{ color: 'var(--status-danger)' }} title="Unresolved reference">
                  ✕ {id} (unresolved)
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}

export function Inspector({
  record,
  tab,
  onTab,
  onClose,
  onNavigate,
  onOpenFinding,
  onRecordReview,
}: {
  record: EvidenceRecord
  tab: InspectorTab
  onTab: (t: InspectorTab) => void
  onClose: () => void
  onNavigate: (id: string) => void
  onOpenFinding: (id: string) => void
  onRecordReview: (r: EvidenceRecord) => void
}) {
  const { mergedFindings, overlay, runtime } = useStore()
  const [openNote, setOpenNote] = useState<string | null>(null)
  const linkedFindings = findingsFor(record.id).map((f) => mergedFindings.find((m) => m.id === f.id) ?? f)
  const linkedReviews = reviewsFor(record.id)
  const localReviews = runtime.workspace.kind === 'sample'
    ? overlay.recordedReviews.filter((r) => r.subjectId === record.id)
    : []

  return (
    <Drawer
      title={record.id}
      subtitle={
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', padding: 'var(--space-2) 0' }}>
          <Chip tone="neutral">{TYPE_LABEL[record.type]}</Chip>
          <StatusChip status={record.status} />
          <ReviewChip state={record.reviewState} />
        </div>
      }
      onClose={onClose}
    >
      <Tabs tabs={TABS} active={tab} onSelect={(k) => onTab(k as InspectorTab)} label="Inspector sections" />

      {tab === 'overview' ? (
        <div>
          <p style={{ marginTop: 0 }}>{record.title}</p>
          <dl className="kv">
            <dt>Lifecycle phase</dt>
            <dd>{PHASE_LABEL[record.phase]}</dd>
            <dt>Revision</dt>
            <dd className="mono">{record.revision}</dd>
            <dt>Baseline</dt>
            <dd className="mono">{record.baseline === 'both' ? runtime.availableBaselines.join(' · ') : record.baseline}</dd>
            <dt>Modified</dt>
            <dd className="mono">{fmtDateTime(record.modified)}</dd>
            <dt>Source kind</dt>
            <dd className="mono">{record.sourceKind}</dd>
            <dt>Identifier</dt>
            <dd>
              <CopyLine label="ID" value={record.id} />
            </dd>
            <dt>Source path</dt>
            <dd>
              <CopyLine label="path" value={record.sourcePath} />
            </dd>
            <dt>SHA-256</dt>
            <dd>
              <CopyLine label="hash" value={record.hash} />
            </dd>
          </dl>
          {Object.keys(record.meta).length > 0 ? (
            <>
              <h3 className="section-header">Attributes</h3>
              <dl className="kv">
                {Object.entries(record.meta).map(([k, v]) => (
                  <span key={k} style={{ display: 'contents' }}>
                    <dt>{k}</dt>
                    <dd>{String(v)}</dd>
                  </span>
                ))}
              </dl>
            </>
          ) : null}
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={() => onRecordReview(record)}>
              Record review
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setOpenNote(record.sourcePath)}
              aria-label={`Open source for ${record.id}`}
            >
              Show source location
            </button>
          </div>
          {openNote !== null ? (
            <p className="inset" style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)' }} role="status">
              {runtime.workspace.kind === 'sample' ? (
                <>Read-only sample: source <code>{openNote}</code> is a synthetic reference.</>
              ) : (
                <>Read-only connected source: <code>{openNote}</code>. Use this controlled path in the owning authoring tool.</>
              )}
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === 'trace' ? <TraceView focusId={record.id} onNavigate={onNavigate} /> : null}

      {tab === 'provenance' ? (
        <div>
          <dl className="kv">
            <dt>Provenance</dt>
            <dd>{record.provenance}</dd>
            <dt>Source kind</dt>
            <dd className="mono">{record.sourceKind}</dd>
            <dt>Source path</dt>
            <dd>
              <CopyLine label="path" value={record.sourcePath} />
            </dd>
            <dt>Content hash</dt>
            <dd>
              <CopyLine label="hash" value={record.hash} />
            </dd>
            <dt>Imported</dt>
            <dd className="mono">{fmtDateTime(record.modified)}</dd>
          </dl>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            Authoritative evidence is read-only in the hub. Hash and revision identify the exact configuration item in
            baseline {record.baseline === 'both' ? runtime.baselineId : record.baseline}.
          </p>
        </div>
      ) : null}

      {tab === 'reviews' ? (
        <div>
          {linkedReviews.length === 0 && localReviews.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No reviews recorded for this evidence.</p>
          ) : null}
          {linkedReviews.map((rv) => (
            <div key={rv.id} className="inset" style={{ marginBottom: 'var(--space-2)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="mono">{rv.id}</span>
                <Chip tone={rv.result === 'passed' ? 'success' : rv.result === 'failed' ? 'danger' : rv.result === 'pending' ? 'warning' : 'info'}>
                  {rv.result}
                </Chip>
                {!rv.independent ? <Chip tone="danger">No independence</Chip> : <Chip tone="neutral">Independent</Chip>}
              </div>
              <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                {rv.reviewType} · {rv.reviewer} · {rv.method} · {rv.date} · revision {rv.revision}
              </p>
              <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{rv.comments}</p>
            </div>
          ))}
          {localReviews.map((rv) => (
            <div key={rv.id} className="inset" style={{ marginBottom: 'var(--space-2)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <span className="mono">{rv.id}</span>
                <Chip tone="info">Hub-local</Chip>
                <Chip tone={rv.result === 'passed' ? 'success' : rv.result === 'failed' ? 'danger' : 'warning'}>{rv.result}</Chip>
              </div>
              <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                {rv.reviewer} · {rv.method} · {rv.date} · {rv.independent ? 'independent' : 'not independent'}
              </p>
              <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{rv.comments}</p>
            </div>
          ))}
          <button type="button" className="btn" onClick={() => onRecordReview(record)}>
            Record review
          </button>
        </div>
      ) : null}

      {tab === 'findings' ? (
        <div>
          {linkedFindings.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No findings reference this evidence.</p>
          ) : (
            linkedFindings.map((f) => (
              <button key={f.id} type="button" className="finding-card" onClick={() => onOpenFinding(f.id)}>
                <span style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <span className="mono">{f.id}</span>
                  <Chip tone={severityTone(f.severity)}>{f.severity}</Chip>
                  <Chip tone={findingStatusTone(f.status)}>{FINDING_STATUS_LABEL[f.status]}</Chip>
                </span>
                <span className="fc-title">{f.title}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Owner {f.owner} · due {f.due}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}

      {tab === 'baseline' ? (
        <div>
          {runtime.comparisonBaselineId ? (
            <dl className="kv">
              <dt>Comparison baseline</dt>
              <dd className="mono">{runtime.comparisonBaselineId}</dd>
              <dt>Current baseline</dt>
              <dd className="mono">{runtime.baselineId} · revision {record.revision}</dd>
              <dt>Delta</dt>
              <dd>
                <Chip
                  tone={
                    record.changeMark === 'changed' || record.changeMark === 'added'
                      ? 'info'
                      : record.changeMark === 'stale' || record.changeMark === 'impacted'
                        ? 'warning'
                        : 'neutral'
                  }
                >
                  {record.changeMark}
                </Chip>
              </dd>
              <dt>Review state</dt>
              <dd>{REVIEW_STATE_LABEL[record.reviewState]}</dd>
            </dl>
          ) : (
            <Alert tone="info" title="No comparison baseline configured">
              This record is present in baseline <code>{runtime.baselineId}</code> at revision{' '}
              <code>{record.revision}</code>. Configure a comparison baseline to calculate history deltas.
            </Alert>
          )}
          {record.changeMark === 'changed' ? (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              This record changed between baselines. See the phase Compare view for the full propagated impact set.
            </p>
          ) : null}
        </div>
      ) : null}

      <RelatedList title="Upstream evidence" ids={record.upstream} onNavigate={onNavigate} />
      <RelatedList title="Downstream evidence" ids={record.downstream} onNavigate={onNavigate} />
    </Drawer>
  )
}

// ===== from components/ReviewDialog.tsx =====
// Review recording dialog: reviewer, method, result, comments, date, revision,
// independence. Validation errors preserve input; success is announced.

export function ReviewDialog({ subject, onClose }: { subject: EvidenceRecord; onClose: () => void }) {
  const { announce, recordRuntimeReview, runtime } = useStore()
  const [reviewer, setReviewer] = useState('')
  const [method, setMethod] = useState<ReviewMethod>('inspection')
  const [result, setResult] = useState<ReviewResult>('passed')
  const [comments, setComments] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [independent, setIndependent] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    const nextErrors: Record<string, string> = {}
    if (reviewer.trim() === '') nextErrors.reviewer = 'Reviewer is required.'
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) nextErrors.date = 'Date must be YYYY-MM-DD.'
    if (result === 'failed' && comments.trim() === '')
      nextErrors.comments = 'A failed review requires comments describing the rejection.'
    if (!independent && subject.type === 'llr')
      nextErrors.independent = 'Domain rule: LLR reviews at Level B require independence.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    if (submitting) return
    setSubmitting(true)
    try {
      await recordRuntimeReview(subject, {
        phase: subject.phase,
        reviewer: reviewer.trim(),
        method,
        result,
        comments: comments.trim() === '' ? 'No comments recorded.' : comments.trim(),
        date,
        revision: subject.revision,
        independent,
        requiresIndependence: subject.type === 'llr',
      })
      announce(`Review recorded for ${subject.id} and persisted in the Audit Hub.`)
      onClose()
    } catch (error) {
      setErrors({ submit: error instanceof Error ? error.message : String(error) })
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      title={`Record review — ${subject.id}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? 'Recording…' : 'Record review'}
          </button>
        </>
      }
    >
      {Object.keys(errors).length > 0 ? (
        <Alert tone="danger" title="The review cannot be recorded yet">
          {Object.values(errors).join(' ')}
        </Alert>
      ) : null}
      <p style={{ marginTop: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
        Audit Hub review of <code>{subject.id}</code> at revision <code>{subject.revision}</code>. Authoritative
        evidence stays read-only; this review is persisted in the {runtime.workspace.kind === 'sample' ? 'sample' : 'project'} overlay.
      </p>
      <div className="panel-grid cols-2">
        <Field label="Reviewer" id="rv-reviewer" error={errors.reviewer} hint="Person performing the review">
          <input
            id="rv-reviewer"
            className={errors.reviewer ? 'input error' : 'input'}
            list="rv-people"
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
            aria-describedby="rv-reviewer-hint"
            style={{ width: '100%' }}
          />
        </Field>
        <datalist id="rv-people">
          {PEOPLE.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <Field label="Method" id="rv-method">
          <span className="select-wrap" style={{ width: '100%' }}>
            <select id="rv-method" className="select" value={method} onChange={(e) => setMethod(e.target.value as ReviewMethod)} style={{ width: '100%' }}>
              <option value="inspection">Inspection</option>
              <option value="walkthrough">Walkthrough</option>
              <option value="analysis">Analysis</option>
              <option value="checklist">Checklist</option>
            </select>
          </span>
        </Field>
        <Field label="Result" id="rv-result">
          <span className="select-wrap" style={{ width: '100%' }}>
            <select id="rv-result" className="select" value={result} onChange={(e) => setResult(e.target.value as ReviewResult)} style={{ width: '100%' }}>
              <option value="passed">Passed</option>
              <option value="passed-with-actions">Passed with actions</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>
          </span>
        </Field>
        <Field label="Review date" id="rv-date" error={errors.date} hint="YYYY-MM-DD">
          <input
            id="rv-date"
            className={errors.date ? 'input error' : 'input'}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ width: 140 }}
            aria-describedby="rv-date-hint"
          />
        </Field>
      </div>
      <Field label="Comments" id="rv-comments" error={errors.comments} hint="Required when the result is Failed">
        <textarea
          id="rv-comments"
          className={errors.comments ? 'textarea error' : 'textarea'}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          aria-describedby="rv-comments-hint"
        />
      </Field>
      <Field label="Independence" id="rv-independent" error={errors.independent} hint="Reviewer is independent of the artifact author">
        <label style={{ display: 'inline-flex', gap: 'var(--space-2)', alignItems: 'center', fontSize: 'var(--text-sm)' }}>
          <input
            id="rv-independent"
            type="checkbox"
            checked={independent}
            onChange={(e) => setIndependent(e.target.checked)}
            aria-describedby="rv-independent-hint"
          />
          Independent review
        </label>
      </Field>
    </Dialog>
  )
}

// ===== from components/FindingsPanel.tsx =====
// Contextual findings rail for lifecycle views: findings scoped to the phase,
// linking through to the findings workflow.

export function FindingsPanel({
  phase,
  findings,
  onOpenFinding,
}: {
  phase: Phase
  findings: Finding[]
  onOpenFinding: (id: string) => void
}) {
  const open = findings.filter((f) => f.status !== 'closed')
  return (
    <aside className="panel" aria-label={`${PHASE_LABEL[phase]} findings`}>
      <h2 className="panel-title">Findings in {PHASE_LABEL[phase]}</h2>
      <p className="panel-sub">
        {open.length} open · {findings.length - open.length} closed
      </p>
      {findings.length === 0 ? (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>No findings recorded for this phase.</p>
      ) : (
        findings.map((f) => (
          <button key={f.id} type="button" className="finding-card" onClick={() => onOpenFinding(f.id)}>
            <span style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
              <span className="mono" style={{ fontSize: 12 }}>
                {f.id}
              </span>
              <Chip tone={severityTone(f.severity)}>{f.severity}</Chip>
              <Chip tone={findingStatusTone(f.status)}>{FINDING_STATUS_LABEL[f.status]}</Chip>
            </span>
            <span className="fc-title">{f.title}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {f.owner} · due {f.due}
            </span>
          </button>
        ))
      )}
    </aside>
  )
}

// ===== from components/CompareView.tsx =====
// Baseline comparison 2.3.0 ↔ 2.4.0: added / removed / changed / stale /
// impacted buckets, scoped per phase or across the whole program.

function Bucket({
  title,
  tone,
  records,
  onOpen,
  note,
}: {
  title: string
  tone: Tone
  records: EvidenceRecord[]
  onOpen: (r: EvidenceRecord) => void
  note: string
}) {
  return (
    <div className="panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <h3 className="panel-title" style={{ margin: 0 }}>
          {title}
        </h3>
        <Chip tone={tone}>{records.length}</Chip>
      </div>
      <p className="panel-sub" style={{ margin: 'var(--space-1) 0 0' }}>
        {note}
      </p>
      <ul className="compare-list">
        {records.slice(0, 8).map((r) => (
          <li key={r.id}>
            <button
              type="button"
              className="btn btn-quiet btn-sm mono"
              style={{ padding: 0, height: 'auto' }}
              onClick={() => onOpen(r)}
              aria-label={`Open ${r.id}`}
            >
              {r.id}
            </button>
            <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.title}
            </span>
          </li>
        ))}
        {records.length > 8 ? (
          <li style={{ color: 'var(--text-muted)' }}>+ {records.length - 8} more (aggregated deterministically)</li>
        ) : null}
        {records.length === 0 ? <li style={{ color: 'var(--text-muted)' }}>None in this scope.</li> : null}
      </ul>
    </div>
  )
}

export function CompareView({ phase, onOpen }: { phase?: Phase; onOpen: (r: EvidenceRecord) => void }) {
  const buckets = compareBaselines(phase)
  const { runtime } = useStore()
  const comparison = runtime.comparisonBaselineId ?? 'comparison'
  return (
    <section aria-label={`Baseline comparison ${comparison} to ${runtime.baselineId}`}>
      <h2 className="section-header">
        Baseline compare · {comparison} ↔ {runtime.baselineId} {phase ? `· ${PHASE_LABEL[phase]}` : '· all phases'}
      </h2>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '0 0 var(--space-3)' }}>
        Changed records propagate impacts downstream through requirements, design, code, verification, configuration
        management, quality assurance, and certification evidence.
      </p>
      <div className="compare-cols">
        <Bucket title="Added" tone="info" records={buckets.added} onOpen={onOpen} note={`New in ${runtime.baselineId}`} />
        <Bucket title="Removed" tone="neutral" records={buckets.removed} onOpen={onOpen} note={`Present only in ${comparison}`} />
        <Bucket title="Changed" tone="info" records={buckets.changed} onOpen={onOpen} note="Revision differs between baselines" />
        <Bucket title="Stale" tone="warning" records={buckets.stale} onOpen={onOpen} note="Evidence or review out of date" />
        <Bucket title="Impacted" tone="warning" records={buckets.impacted} onOpen={onOpen} note="Downstream of a changed record" />
      </div>
    </section>
  )
}

// ===== from components/PackageBuilder.tsx =====
// Audit package builder: scope selection, deterministic progress with
// cancellation, manifest preview with exact revisions and SHA-256 hashes, and
// the mandatory synthetic watermark on every package surface.

type BuildStage = 'configure' | 'building' | 'done' | 'failed'

export function PackageBuilder({ onClose }: { onClose: () => void }) {
  const { announce, buildRuntimePackage, openIds, runtime } = useStore()
  const [name, setName] = useState('')
  const [scope, setScope] = useState<Set<Phase>>(new Set(PHASES))
  const [includeFindings, setIncludeFindings] = useState(true)
  const [includeReviews, setIncludeReviews] = useState(true)
  const [stage, setStage] = useState<BuildStage>('configure')
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{
    packageId: string
    manifest: RuntimePackageManifest
    download: { path: string; url: string; contentHash: string }
  } | null>(null)

  const scopedEvidence = allEvidence.filter((r) => scope.has(r.phase))
  const scopedFindings = includeFindings ? findings.filter((f) => scope.has(f.phase)) : []
  const scopedReviews = includeReviews ? reviewRecords.filter((r) => scope.has(r.phase)) : []

  const start = async () => {
    if (name.trim() === '') {
      setError('Package name is required.')
      return
    }
    if (scope.size === 0) {
      setError('Select at least one lifecycle phase.')
      return
    }
    if (stage === 'building') return // duplicate-action prevention
    setError(null)
    setStage('building')
    try {
      const result = await buildRuntimePackage({
        name: name.trim(),
        evidenceIds: scopedEvidence.map((record) => record.id),
        phaseIds: [...scope],
        includeFindings,
        includeReviews,
      })
      setCreated(result)
      setStage('done')
      announce(`Audit package ${result.packageId} created with ${result.manifest.counts.evidence} evidence items.`)
    } catch (buildError) {
      setError(buildError instanceof Error ? buildError.message : String(buildError))
      setStage('failed')
    }
  }

  return (
    <Dialog
      title="Build audit package"
      wide
      onClose={onClose}
      footer={
        stage === 'building' ? (
          <button type="button" className="btn btn-primary" disabled>
            Building verified package…
          </button>
        ) : stage === 'done' ? (
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        ) : (
          <>
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void start()}>
              {stage === 'failed' ? 'Retry build' : 'Assemble package'}
            </button>
          </>
        )
      }
    >
      {runtime.workspace.kind === 'sample' ? <Watermark /> : null}
      {stage === 'configure' || stage === 'failed' ? (
        <>
          {stage === 'failed' ? (
            <Alert tone="danger" title="Package build failed">
              {error}
            </Alert>
          ) : null}
          {error && stage !== 'failed' ? (
            <Alert tone="danger" title="Cannot assemble yet">
              {error}
            </Alert>
          ) : null}
          <div className="panel-grid cols-2">
            <Field label="Package name" id="pkg-name" error={error !== null && name.trim() === '' ? 'Required.' : undefined} hint="Shown in the package register">
              <input id="pkg-name" className="input" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} placeholder="e.g. Stage 4 SOI audit package" />
            </Field>
            <div className="field">
              <span className="field-label">Included assurance records</span>
              <label style={{ display: 'flex', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', alignItems: 'center' }}>
                <input type="checkbox" checked={includeFindings} onChange={(e) => setIncludeFindings(e.target.checked)} />
                Findings ({findings.filter((f) => scope.has(f.phase)).length} in scope, {[...openIds].filter((id) => findings.some((f) => f.id === id && scope.has(f.phase))).length} open)
              </label>
              <label style={{ display: 'flex', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', alignItems: 'center' }}>
                <input type="checkbox" checked={includeReviews} onChange={(e) => setIncludeReviews(e.target.checked)} />
                Reviews ({reviewRecords.filter((r) => scope.has(r.phase)).length} in scope)
              </label>
              <span className="field-hint" />
            </div>
          </div>
          <h3 className="section-header">Phase scope</h3>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {PHASES.map((p) => (
              <label key={p} style={{ display: 'inline-flex', gap: 'var(--space-1)', alignItems: 'center', fontSize: 'var(--text-sm)' }}>
                <input
                  type="checkbox"
                  checked={scope.has(p)}
                  onChange={(e) => {
                    const next = new Set(scope)
                    if (e.target.checked) next.add(p)
                    else next.delete(p)
                    setScope(next)
                  }}
                />
                {PHASE_LABEL[p]}
              </label>
            ))}
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            Current scope: {scopedEvidence.length} evidence items · {scopedFindings.length} findings ·{' '}
            {scopedReviews.length} reviews.
          </p>
        </>
      ) : null}

      {stage === 'building' ? (
        <div role="status" aria-live="polite">
          <p>
            Building “{name.trim()}” from immutable snapshot <code>{runtime.snapshotId}</code> — collecting{' '}
            {scopedEvidence.length} evidence items, writing exact revisions, and hashing the ZIP archive…
          </p>
          <div className="progress" aria-hidden="true">
            <span style={{ width: '65%' }} />
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            Server-side deterministic assembly; authoritative lifecycle sources remain read-only.
          </p>
        </div>
      ) : null}

      {stage === 'done' && created ? (
        <div>
          <Alert tone="success" title={`Package ${created.packageId} created`}>
            {created.manifest.counts.evidence} evidence items · {created.manifest.counts.findings} findings ·{' '}
            {created.manifest.counts.reviews} reviews.
          </Alert>
          <dl className="kv">
            <dt>Package ID</dt>
            <dd className="mono">{created.packageId}</dd>
            <dt>Created</dt>
            <dd className="mono">{created.manifest.createdAt}</dd>
            <dt>Archive</dt>
            <dd>
              <a className="btn btn-primary btn-sm" href={created.download.url} download>
                Download ZIP
              </a>
              <span className="table-meta mono">{created.download.path}</span>
            </dd>
            <dt>Archive SHA-256</dt>
            <dd className="mono">{created.download.contentHash}</dd>
          </dl>
          <h3 className="section-header">
            Manifest preview ({created.manifest.entries.length <= 12
              ? `all ${created.manifest.entries.length}`
              : `first 12 of ${created.manifest.entries.length}`})
          </h3>
          <div className="table-scroll">
            <table className="data" aria-label="Package manifest preview">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Revision</th>
                  <th>SHA-256</th>
                  <th>Source path</th>
                </tr>
              </thead>
              <tbody>
                {created.manifest.entries.slice(0, 12).map((m) => (
                  <tr key={m.id}>
                    <td className="id-cell">{m.id}</td>
                    <td className="id-cell">{m.revision}</td>
                    <td className="id-cell" title={m.hash}>
                      {m.hash.slice(0, 16)}…
                    </td>
                    <td className="id-cell" title={m.sourcePath}>
                      {m.sourcePath}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </Dialog>
  )
}

// ===== from components/SearchOverlay.tsx =====
// Global evidence search: identifier/title text plus facets for phase, type,
// status, review state, findings, and staleness. Opening a result deep-links
// to its lifecycle view with the inspector selected.

export function SearchOverlay({
  initialQuery,
  onClose,
  onOpen,
}: {
  initialQuery?: string
  onClose: () => void
  onOpen: (record: EvidenceRecord) => void
}) {
  const [query, setQuery] = useState(initialQuery ?? '')
  const [phase, setPhase] = useState<'all' | Phase>('all')
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [review, setReview] = useState('all')
  const [hasFindings, setHasFindings] = useState(false)
  const [staleOnly, setStaleOnly] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const results = useMemo(
    () => searchEvidence(query, { phase, type, status, review, hasFindings, staleOnly }),
    [query, phase, type, status, review, hasFindings, staleOnly],
  )

  return (
    <Dialog title="Search evidence" wide onClose={onClose}>
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
        <input
          ref={inputRef}
          type="search"
          className="input"
          style={{ flex: '1 1 260px' }}
          placeholder="Search by identifier or title — try SYS-LAT-014"
          aria-label="Search query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="select-wrap">
          <select className="select" aria-label="Phase facet" value={phase} onChange={(e) => setPhase(e.target.value as 'all' | Phase)}>
            <option value="all">All phases</option>
            {PHASES.map((p) => (
              <option key={p} value={p}>
                {PHASE_LABEL[p]}
              </option>
            ))}
          </select>
        </span>
        <span className="select-wrap">
          <select className="select" aria-label="Type facet" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All types</option>
            {Object.entries(TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </span>
        <span className="select-wrap">
          <select className="select" aria-label="Status facet" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All statuses</option>
            {['approved', 'in-review', 'draft', 'passed', 'failed', 'blocked', 'not-run', 'stale', 'satisfied', 'partial'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </span>
        <span className="select-wrap">
          <select className="select" aria-label="Review facet" value={review} onChange={(e) => setReview(e.target.value)}>
            <option value="all">Any review state</option>
            {['approved', 'pending', 'stale', 'rejected', 'not-reviewed'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </span>
        <label style={{ display: 'inline-flex', gap: 'var(--space-1)', alignItems: 'center', fontSize: 'var(--text-sm)' }}>
          <input type="checkbox" checked={hasFindings} onChange={(e) => setHasFindings(e.target.checked)} />
          With findings
        </label>
        <label style={{ display: 'inline-flex', gap: 'var(--space-1)', alignItems: 'center', fontSize: 'var(--text-sm)' }}>
          <input type="checkbox" checked={staleOnly} onChange={(e) => setStaleOnly(e.target.checked)} />
          Stale only
        </label>
      </div>
      <p style={{ margin: '0 0 var(--space-1)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }} role="status">
        {results.length} result{results.length === 1 ? '' : 's'}
        {query.trim() === '' ? ' (showing the first records; type to narrow)' : ''}
      </p>
      <ul className="search-results">
        {results.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => onOpen(r)}>
              <span className="mono">{r.id}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                {r.title}
              </span>
              <span style={{ display: 'inline-flex', gap: 'var(--space-1)' }}>
                <Chip tone="neutral">{PHASE_LABEL[r.phase]}</Chip>
                <StatusChip status={r.status} />
              </span>
            </button>
          </li>
        ))}
        {results.length === 0 ? (
          <li style={{ padding: 'var(--space-3)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            No evidence matches. Clear a facet or check the identifier spelling.
          </li>
        ) : null}
      </ul>
    </Dialog>
  )
}

// ===== from components/Shell.tsx =====
// Application shell: product header (baseline selector, compare, search,
// refresh, notifications, Sample Data badge, Connect real project) and the
// collapsible lifecycle navigation.

const NAV_GLYPH: Record<string, string> = {
  overview: 'OV',
  planning: 'PL',
  requirements: 'RQ',
  design: 'DS',
  implementation: 'IM',
  verification: 'VF',
  cm: 'CM',
  qa: 'QA',
  certification: 'CT',
  findings: 'FN',
  reviews: 'RV',
  packages: 'PK',
  activity: 'AC',
}

const UTILITY_LINKS: Array<{ key: string; label: string }> = [
  { key: 'findings', label: 'Findings' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'packages', label: 'Audit Packages' },
  { key: 'activity', label: 'Activity' },
]

function NavLink({ area, label, active }: { area: string; label: string; active: boolean }) {
  return (
    <a
      className="nav-item"
      href={formatHash([area])}
      aria-current={active ? 'page' : undefined}
      title={label}
      aria-label={label}
    >
      <span className="nav-glyph" aria-hidden="true">
        {NAV_GLYPH[area] ?? '··'}
      </span>
      <span className="nav-label">{label}</span>
    </a>
  )
}

type RefreshStage = 'idle' | 'running' | 'cancelled' | 'done' | 'failed' | 'retrying'

function RefreshDialog({ onClose, demoFail }: { onClose: () => void; demoFail: boolean }) {
  const { dispatch, announce, now, runtime, refreshRuntime } = useStore()
  const [stage, setStage] = useState<RefreshStage>('running')
  const [step, setStep] = useState(0)
  const [failureMessage, setFailureMessage] = useState('')
  const [diagnosticCount, setDiagnosticCount] = useState(0)
  const timer = useRef<number | null>(null)
  const failedOnce = useRef(false)

  const total = refreshSourceCounts.length

  const run = () => {
    setStage('running')
    setStep(0)
    setFailureMessage('')
    setDiagnosticCount(0)
    timer.current = window.setInterval(() => {
      setStep((s) => {
        const next = Math.min(s + 1, Math.max(0, total - 1))
        if (runtime.workspace.kind === 'sample' && demoFail && !failedOnce.current && next === 4) {
          failedOnce.current = true
          if (timer.current !== null) window.clearInterval(timer.current)
          setStage('failed')
          setFailureMessage('Simulated adapter fault while scanning verification results.')
          return s
        }
        return next
      })
    }, 220)
    void refreshRuntime().then((result) => {
      if (timer.current !== null) window.clearInterval(timer.current)
      setStep(total)
      setDiagnosticCount(result.diagnostics.length)
      setStage('done')
      dispatch({ type: 'refresh/complete', at: now(), sourceCount: total })
      announce(runtime.workspace.kind === 'sample'
        ? 'Refresh complete — sample snapshot republished.'
        : 'Refresh complete — a new immutable project snapshot was published.')
    }).catch((error) => {
      if (timer.current !== null) window.clearInterval(timer.current)
      setFailureMessage(error instanceof Error ? error.message : String(error))
      setStage('failed')
    })
  }

  useEffect(() => {
    run()
    return () => {
      if (timer.current !== null) window.clearInterval(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cancel = () => {
    if (timer.current !== null) window.clearInterval(timer.current)
    setStage('cancelled')
  }

  return (
    <Dialog
      title="Refresh evidence sources"
      onClose={onClose}
      footer={
        stage === 'running' ? (
          <button type="button" className="btn" onClick={cancel}>
            Cancel refresh
          </button>
        ) : stage === 'failed' ? (
          <>
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setStage('retrying')
                window.setTimeout(run, 400)
              }}
            >
              Retry
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        )
      }
    >
      <p style={{ marginTop: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
        {runtime.workspace.kind === 'sample'
          ? 'Revalidates the deterministic bundled normalized snapshot. No MATLAB installation is required for sample data.'
          : 'Scans configured read-only sources through the filesystem, Git, MATLAB/Simulink, spreadsheet, C/H, review, and coverage adapters. The current snapshot remains active unless the full candidate passes validation.'}
      </p>
      {stage === 'cancelled' ? (
        <Alert tone="warning" title="Refresh cancelled">
          The previous snapshot remains active; no partial data was published.
        </Alert>
      ) : null}
      {stage === 'failed' ? (
        <Alert tone="danger" title="Candidate snapshot not published">
          {failureMessage || `Adapter failure at source ${step + 1} of ${total}.`} The previous valid snapshot remains
          active.
        </Alert>
      ) : null}
      {stage === 'retrying' ? (
        <Alert tone="info" title="Retrying">
          Re-running the source scan…
        </Alert>
      ) : null}
      {stage === 'done' ? (
        <Alert tone="success" title={runtime.workspace.kind === 'sample' ? 'Sample snapshot validated' : 'Snapshot published'}>
          {total} source groups scanned · 0 fatal diagnostics · {diagnosticCount} informational or warning diagnostic
          {diagnosticCount === 1 ? '' : 's'}.
        </Alert>
      ) : null}
      <div className="progress" aria-hidden="true" style={{ margin: 'var(--space-3) 0' }}>
        <span style={{ width: `${(step / total) * 100}%` }} />
      </div>
      <div className="table-scroll">
        <table className="data" aria-label="Refresh source diagnostics">
          <thead>
            <tr>
              <th>Source</th>
              <th>Kind</th>
              <th className="num">Records</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {refreshSourceCounts.map((s, i) => (
              <tr key={s.source}>
                <td className="id-cell" title={s.source}>
                  {s.source}
                </td>
                <td className="id-cell">{s.kind}</td>
                <td className="num">{s.count}</td>
                <td>
                  {i < step ? (
                    <Chip tone="success">Scanned</Chip>
                  ) : stage === 'failed' && i === step ? (
                    <Chip tone="danger">Failed</Chip>
                  ) : stage === 'running' && i === step ? (
                    <Chip tone="info">Scanning…</Chip>
                  ) : (
                    <Chip tone="neutral">Queued</Chip>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Dialog>
  )
}

function ConnectDialog({ onClose }: { onClose: () => void }) {
  const { connectRuntimeProject, announce } = useStore()
  const [name, setName] = useState('DO-178C Project')
  const [rootPath, setRootPath] = useState('')
  const [softwareLevel, setSoftwareLevel] = useState('Level B')
  const [do331Applicable, setDo331Applicable] = useState(true)
  const [baselineId, setBaselineId] = useState('working')
  const [comparisonBaselineId, setComparisonBaselineId] = useState('')
  const [objectiveProfilePath, setObjectiveProfilePath] = useState('')
  const [matlabEnabled, setMatlabEnabled] = useState(true)
  const [matlabExecutable, setMatlabExecutable] = useState('matlab')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const kinds: Array<{ kind: string; expects: string }> = [
    { kind: 'SLREQX', expects: 'requirements/**/*.slreqx — system, HLR, LLR, derived requirement sets' },
    { kind: 'SLMX', expects: 'verification/tests/**/*.slmx — test case and iteration definitions' },
    { kind: 'SLX', expects: 'models/**/*.slx — design models and verification harnesses' },
    { kind: 'SLDD', expects: 'models/data/*.sldd — data dictionaries' },
    { kind: 'SLDATX', expects: 'verification/data/*.sldatx — simulation input/output data' },
    { kind: 'XLSX', expects: 'plans, result sets, matrices — controlled spreadsheet exports' },
    { kind: 'C/H', expects: 'src/**/*.{c,h} — generated and hand source code' },
    { kind: 'Review evidence', expects: 'qa/reviews/** — review records and checklists' },
    { kind: 'Configuration records', expects: 'cm/** — baselines, change records, problem reports' },
    { kind: 'Objective profile', expects: 'optional JSON/CSV/XLSX — program-owned objective identifiers and satisfaction links' },
  ]
  return (
    <Dialog title="Connect real project" wide onClose={onClose}>
      <Alert tone="info" title="Read-only evidence connection">
        The Audit Hub indexes configured sources into a new immutable snapshot. It never writes to requirements,
        models, source code, tests, results, review evidence, or repository history.
      </Alert>
      {error ? <Alert tone="danger" title="Project could not be published">{error}</Alert> : null}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          setBusy(true)
          setError('')
          void connectRuntimeProject({
            name,
            rootPath,
            softwareLevel,
            do331Applicable,
            baselineId,
            ...(comparisonBaselineId.trim() ? { comparisonBaselineId } : {}),
            ...(objectiveProfilePath.trim() ? { objectiveProfilePath } : {}),
            matlabEnabled,
            ...(matlabExecutable.trim() ? { matlabExecutable } : {}),
          }).then(() => {
            announce(`${name} connected and published.`)
            onClose()
          }).catch((caught) => {
            setError(caught instanceof Error ? caught.message : String(caught))
          }).finally(() => setBusy(false))
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', margin: 'var(--space-3) 0' }}>
          <Field id="connect-name" label="Project name">
            <input id="connect-name" className="input" value={name} onChange={(event) => setName(event.target.value)} required />
          </Field>
          <Field id="connect-level" label="Software level">
            <select id="connect-level" className="select" value={softwareLevel} onChange={(event) => setSoftwareLevel(event.target.value)}>
              {['Level A', 'Level B', 'Level C', 'Level D', 'Level E'].map((level) => <option key={level}>{level}</option>)}
            </select>
          </Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field
              id="connect-root"
              label="Project or repository root"
              hint="Absolute path containing the configured lifecycle evidence. Symbolic links are not followed."
              error={!rootPath && error ? 'Choose a readable project root.' : undefined}
            >
              <input
                id="connect-root"
                className="input"
                value={rootPath}
                onChange={(event) => setRootPath(event.target.value)}
                placeholder="/path/to/controlled/project"
                required
              />
            </Field>
          </div>
          <Field id="connect-baseline" label="Current baseline">
            <input id="connect-baseline" className="input" value={baselineId} onChange={(event) => setBaselineId(event.target.value)} required />
          </Field>
          <Field id="connect-compare" label="Comparison baseline" hint="Optional">
            <input id="connect-compare" className="input" value={comparisonBaselineId} onChange={(event) => setComparisonBaselineId(event.target.value)} />
          </Field>
          <div className="field">
            <span className="field-label">Model-based development</span>
            <label className="hstack" style={{ minHeight: 'var(--control-height)' }}>
              <input
                type="checkbox"
                checked={do331Applicable}
                onChange={(event) => setDo331Applicable(event.target.checked)}
              />
              DO-331 supplement applies
            </label>
            <span className="field-hint">Controls program context; it does not change authoritative source files.</span>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field id="connect-objectives" label="Objective-profile file" hint="Optional program-owned JSON, CSV, or XLSX identifiers and satisfaction links; licensed standard text is not bundled.">
              <input id="connect-objectives" className="input" value={objectiveProfilePath} onChange={(event) => setObjectiveProfilePath(event.target.value)} />
            </Field>
          </div>
          <div className="field">
            <span className="field-label">MATLAB/Simulink extraction</span>
            <label className="hstack" style={{ minHeight: 'var(--control-height)' }}>
              <input type="checkbox" checked={matlabEnabled} onChange={(event) => setMatlabEnabled(event.target.checked)} />
              Use licensed MATLAB APIs when normalized sidecars are absent
            </label>
            <span className="field-hint">Missing MATLAB affects only MATLAB-owned sources and is reported explicitly.</span>
          </div>
          <Field id="connect-matlab" label="MATLAB executable">
            <input
              id="connect-matlab"
              className="input"
              value={matlabExecutable}
              onChange={(event) => setMatlabExecutable(event.target.value)}
              disabled={!matlabEnabled}
            />
          </Field>
        </div>
        <div className="right" style={{ marginBottom: 'var(--space-3)' }}>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy || !name.trim() || !rootPath.trim()}>
            {busy ? 'Scanning and validating…' : 'Connect and publish'}
          </button>
        </div>
      </form>
      <div className="table-scroll">
        <table className="data" aria-label="Available project adapters">
          <thead>
            <tr>
              <th>Source kind</th>
              <th>Expected location and content</th>
              <th>Support</th>
            </tr>
          </thead>
          <tbody>
            {kinds.map((k) => (
              <tr key={k.kind}>
                <td className="id-cell">{k.kind}</td>
                <td style={{ whiteSpace: 'normal' }}>{k.expects}</td>
                <td><Chip tone="success">Supported</Chip></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Dialog>
  )
}

function ResetDialog({ onClose }: { onClose: () => void }) {
  const { dispatch, announce, now, resetRuntimeSample } = useStore()
  const [done, setDone] = useState(false)
  return (
    <Dialog
      title="Reset sample changes"
      onClose={onClose}
      footer={
        done ? (
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        ) : (
          <>
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                dispatch({ type: 'reset', at: now() })
                void resetRuntimeSample().then(() => {
                  setDone(true)
                  announce('Sample changes reset to seeded state.')
                }).catch((error) => {
                  announce(`Sample reset failed: ${error instanceof Error ? error.message : String(error)}`)
                })
              }}
            >
              Reset sample changes
            </button>
          </>
        )
      }
    >
      {done ? (
        <Alert tone="success" title="Sample restored">
          Restored: {sampleCounts.findings} findings · {sampleCounts.reviews} seeded reviews · 1 seeded package (
          {sampleCounts.seedPackageId}) · preferences and baseline 2.4.0. Local packages and recorded reviews were
          cleared; prior sandbox activity was cleared and a reset event was recorded.
        </Alert>
      ) : (
        <>
          <p style={{ marginTop: 0 }}>
            This clears only hub-local overlay changes: finding transitions, recorded reviews, built packages, and UI
            preferences. Authoritative fixture evidence is immutable and unaffected.
          </p>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            After reset: {sampleCounts.findings} findings in their seeded states, review defaults restored, package
            register back to the single seeded package, baseline 2.4.0 active.
          </p>
        </>
      )}
    </Dialog>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const { path, params, navigate, setParams } = useRoute()
  const { overlay, dispatch, openIds, mergedFindings, announcement, now, runtime } = useStore()
  const area = path[0] ?? 'overview'
  const [dialog, setDialog] = useState<'none' | 'refresh' | 'connect' | 'reset' | 'sample-menu' | 'notifications'>('none')
  const collapsed = overlay.prefs.navCollapsed
  const comparisonBaseline = runtime.comparisonBaselineId
  const isLoadingWorkspace = runtime.status === 'loading'

  const openFindings = mergedFindings.filter((f) => openIds.has(f.id))
  const overdue = openFindings.filter((f) => f.due < '2026-07-22')

  const demoFail = params.get('demo') === 'error'

  return (
    <div className="shell">
      <a href="#main-content" className="visually-hidden">
        Skip to content
      </a>
      <header className="app-header">
        <div className="product">
          <span className="product-name">DO-178C Audit Hub</span>
          <span
            className="workspace-name"
            title={isLoadingWorkspace
              ? 'Selecting the last real workspace or built-in sample'
              : `${runtime.workspace.name} · ${runtime.workspace.softwareLevel} · ${runtime.workspace.do331Applicable ? 'DO-331 applicable' : 'DO-331 not configured'}`}
          >
            {isLoadingWorkspace ? 'Loading workspace…' : runtime.workspace.name}
          </span>
        </div>
        <div className="header-controls">
          <label className="visually-hidden" htmlFor="baseline-select">
            Active baseline
          </label>
          <span className="select-wrap">
            <select
              id="baseline-select"
              className="select"
              value={overlay.prefs.baseline}
              disabled={isLoadingWorkspace || runtime.availableBaselines.length <= 1}
              onChange={(e) => dispatch({ type: 'baseline/set', baseline: e.target.value as Baseline, at: now() })}
            >
              {isLoadingWorkspace
                ? <option value={overlay.prefs.baseline}>Selecting baseline…</option>
                : runtime.availableBaselines.map((baseline) => (
                  <option key={baseline} value={baseline}>Baseline {baseline}</option>
                ))}
            </select>
          </span>
          <button
            type="button"
            className="btn"
            aria-pressed={overlay.prefs.compare}
            disabled={isLoadingWorkspace || !comparisonBaseline}
            onClick={() => dispatch({ type: 'compare/set', compare: !overlay.prefs.compare })}
            title={comparisonBaseline ? `Compare against baseline ${comparisonBaseline}` : 'Configure a comparison baseline to enable comparison'}
          >
            {isLoadingWorkspace
              ? 'Selecting comparison…'
              : comparisonBaseline
                ? `Compare ${comparisonBaseline}`
                : 'No compare baseline'}
          </button>
          <button type="button" className="btn" disabled={isLoadingWorkspace} onClick={() => setParams({ search: '1' })}>
            Search
          </button>
          <button type="button" className="btn" disabled={isLoadingWorkspace} onClick={() => setDialog('refresh')}>
            Refresh
          </button>
          <button
            type="button"
            className="btn"
            disabled={isLoadingWorkspace}
            onClick={() => setDialog('notifications')}
            aria-label={isLoadingWorkspace ? 'Notifications unavailable while loading' : `Notifications: ${overdue.length} overdue findings`}
          >
            {isLoadingWorkspace ? 'Alerts (—)' : `Alerts (${overdue.length})`}
          </button>
          {isLoadingWorkspace ? <Chip tone="info">Connecting…</Chip> : null}
          {runtime.status === 'fallback' ? <Chip tone="danger">Offline sample</Chip> : null}
          {isLoadingWorkspace ? null : runtime.workspace.kind === 'sample' ? (
            <button type="button" className="sample-badge" onClick={() => setDialog('sample-menu')} aria-haspopup="dialog">
              Sample Data
            </button>
          ) : (
            <Chip tone="success">Live snapshot</Chip>
          )}
          <button type="button" className="btn" onClick={() => setDialog('connect')}>
            {isLoadingWorkspace
              ? 'Configure project'
              : runtime.workspace.kind === 'sample'
                ? 'Connect real project'
                : 'Connect another project'}
          </button>
        </div>
      </header>
      <div className={collapsed ? 'shell-body nav-collapsed' : 'shell-body'}>
        <nav className="nav" aria-label="Lifecycle navigation">
          <span className="nav-section-label">Lifecycle</span>
          <NavLink area="overview" label="Overview" active={area === 'overview'} />
          {PHASES.map((p) => (
            <NavLink key={p} area={p} label={PHASE_LABEL[p]} active={area === p} />
          ))}
          <span className="nav-section-label">Audit</span>
          {UTILITY_LINKS.map((l) => (
            <NavLink key={l.key} area={l.key} label={l.label} active={area === l.key} />
          ))}
          <button
            type="button"
            className="nav-collapse-btn"
            aria-pressed={collapsed}
            onClick={() => dispatch({ type: 'nav/collapse', collapsed: !collapsed })}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {collapsed ? '»' : '« Collapse'}
          </button>
        </nav>
        <main className="main" id="main-content">
          {runtime.status === 'fallback' ? (
            <Alert tone="warning" title="Backend unavailable — bundled sample active">
              {runtime.error} The interface remains usable, but project connections, immutable server snapshots, and
              server-side packages are unavailable until the API reconnects.
            </Alert>
          ) : null}
          {children}
        </main>
      </div>

      {dialog === 'refresh' ? <RefreshDialog onClose={() => setDialog('none')} demoFail={demoFail} /> : null}
      {dialog === 'connect' ? <ConnectDialog onClose={() => setDialog('none')} /> : null}
      {dialog === 'reset' ? <ResetDialog onClose={() => setDialog('none')} /> : null}
      {dialog === 'sample-menu' ? (
        <Dialog title="Sample workspace" onClose={() => setDialog('none')}>
          <Watermark />
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            {runtime.workspace.name} · {runtime.workspace.softwareLevel} · DO-331 applicable. All evidence is deterministic synthetic fixture
            data; only hub-local findings/reviews/packages/preferences are editable.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
            <button type="button" className="btn" onClick={() => setDialog('reset')}>
              Reset sample changes…
            </button>
            {import.meta.env.DEV ? (
              <>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setDialog('none')
                    setParams({ demo: params.get('demo') === null ? 'loading' : null })
                  }}
                >
                  State demo: {params.get('demo') === null ? 'enable (loading)' : 'disable'}
                </button>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                  Developer state demo — set <code>?demo=loading|empty|error|partial</code> on any route to exercise
                  experience states deterministically.
                </p>
              </>
            ) : null}
          </div>
        </Dialog>
      ) : null}
      {dialog === 'notifications' ? (
        <Dialog title="Notifications" onClose={() => setDialog('none')}>
          {overdue.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No overdue findings. All quiet.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {overdue.map((f) => (
                <li key={f.id} style={{ padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <button
                    type="button"
                    className="btn btn-quiet"
                    style={{ display: 'block', textAlign: 'left', height: 'auto', padding: 'var(--space-1)' }}
                    onClick={() => {
                      setDialog('none')
                      navigate(['findings'], { select: f.id })
                    }}
                  >
                    <span className="mono">{f.id}</span> — {f.title}
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--status-warning)' }}>
                      ! Due {f.due} (overdue) · owner {f.owner}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Dialog>
      ) : null}
      <div aria-live="polite" role="status">
        {announcement !== '' ? <div className="toast">✓ {announcement}</div> : null}
      </div>
    </div>
  )
}

// ===== from components/LifecyclePage.tsx =====
// Shared lifecycle view anatomy: phase header with readiness and counts,
// subview tabs, working surface, contextual findings rail, evidence inspector
// drawer, and the per-phase baseline comparison.

export interface PhaseCtx {
  openRecord: (r: EvidenceRecord | string) => void
  openFinding: (id: string) => void
  review: (r: EvidenceRecord) => void
  demo: DemoState
  quickFilter: string | null
  setQuickFilter: (k: string | null) => void
  selectedId: string | null
}

export interface SubviewDef {
  key: string
  label: string
  render: (ctx: PhaseCtx) => ReactNode
}

export function LifecyclePage({
  phase,
  intro,
  subviews,
}: {
  phase: Phase
  intro: string
  subviews: SubviewDef[]
}) {
  const { path, params, navigate, setParams } = useRoute()
  const { overlay, dispatch, mergedFindings, openIds, runtime } = useStore()
  const [reviewTarget, setReviewTarget] = useState<EvidenceRecord | null>(null)

  const demo = demoStateOf(params)
  const activeKey = path[1] ?? subviews[0]?.key ?? ''
  const active = subviews.find((s) => s.key === activeKey) ?? subviews[0]
  const stats = phaseStats(phase, openIds)
  const phaseFindings = mergedFindings.filter((f) => f.phase === phase)
  const compare = overlay.prefs.compare

  const selectedId = params.get('select')
  const selected = selectedId !== null ? getEvidence(selectedId) : undefined
  const itab = (params.get('itab') ?? 'overview') as InspectorTab
  const quickFilter = params.get('f')

  const ctx: PhaseCtx = {
    openRecord: (r) => {
      const record = typeof r === 'string' ? getEvidence(r) : r
      if (!record) return
      if (record.phase !== phase) navigate([record.phase], { select: record.id, itab: 'overview' })
      else setParams({ select: record.id })
    },
    openFinding: (id) => navigate(['findings'], { select: id }),
    review: (r) => setReviewTarget(r),
    demo,
    quickFilter,
    setQuickFilter: (k) => setParams({ f: k }),
    selectedId,
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">{PHASE_LABEL[phase]}</h1>
          <p className="page-subtitle">{intro}</p>
        </div>
        <div className="page-header-actions">
          <Chip tone="neutral">Baseline {overlay.prefs.baseline}</Chip>
          <button
            type="button"
            className="btn btn-sm"
            aria-pressed={compare}
            disabled={!runtime.comparisonBaselineId}
            onClick={() => dispatch({ type: 'compare/set', compare: !compare })}
          >
            {runtime.comparisonBaselineId
              ? compare
                ? `Hide compare (${runtime.comparisonBaselineId})`
                : `Compare ${runtime.comparisonBaselineId}`
              : 'No compare baseline'}
          </button>
        </div>
      </header>

      <div className="stat-row" role="group" aria-label={`${PHASE_LABEL[phase]} status`}>
        <span className="stat">
          Readiness <b>{stats.readiness}%</b>
        </span>
        <span className="stat">
          Evidence <b>{stats.evidence}</b>
        </span>
        <span className="stat">
          Reviews <b>{stats.reviews}</b>
        </span>
        <span className="stat">
          Open findings <b>{stats.openFindings}</b>
        </span>
        <span className="stat">
          Compare <b>{compare && runtime.comparisonBaselineId ? `${runtime.comparisonBaselineId} ↔ ${runtime.baselineId}` : 'off'}</b>
        </span>
      </div>

      <div className="phase-grid">
        <div style={{ minWidth: 0 }}>
          <Tabs
            label={`${PHASE_LABEL[phase]} subviews`}
            tabs={subviews.map((s) => ({ key: s.key, label: s.label }))}
            active={active?.key ?? ''}
            onSelect={(key) => navigate([phase, key], { f: null, select: selectedId, demo: params.get('demo') })}
          />
          {active?.render(ctx)}
          {compare ? <CompareView phase={phase} onOpen={(r) => ctx.openRecord(r)} /> : null}
        </div>
        <FindingsPanel phase={phase} findings={phaseFindings} onOpenFinding={ctx.openFinding} />
      </div>

      {selected ? (
        <Inspector
          record={selected}
          tab={itab}
          onTab={(t) => setParams({ itab: t })}
          onClose={() => setParams({ select: null, itab: null })}
          onNavigate={(id) => {
            const target = getEvidence(id)
            if (!target) return
            if (target.phase !== phase) navigate([target.phase], { select: id, itab })
            else setParams({ select: id })
          }}
          onOpenFinding={ctx.openFinding}
          onRecordReview={(r) => setReviewTarget(r)}
        />
      ) : null}
      {selectedId !== null && !selected && !seedFindings.some((f) => f.id === selectedId) ? (
        <div className="alert" data-tone="warning" role="alert" style={{ marginTop: 'var(--space-3)' }}>
          <span aria-hidden="true">!</span>
          <span>
            <b>Unknown evidence id</b> — <code>{selectedId}</code> does not resolve in baseline {overlay.prefs.baseline}.
          </span>
        </div>
      ) : null}
      {reviewTarget ? <ReviewDialog subject={reviewTarget} onClose={() => setReviewTarget(null)} /> : null}
    </div>
  )
}
