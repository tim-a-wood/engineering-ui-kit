// Lifecycle and utility views plus the root App routing.
import { useState } from 'react'
import { demoStateOf, fmtDate, fmtDateTime, metaNum, metaStr, shortHash, useRoute } from './core.ts'
import type { ChangeRecord, EvidenceRecord, Finding, ReviewRecord } from './core.ts'
import { PEOPLE, PHASES, PHASE_LABEL, TOTAL_ITERATIONS, TYPE_LABEL, allEvidence, auditRecords, baselines, canonicalChain, certDocRecords, changeRecords, compareBaselines, coverageRows, derivedRequirements, deviationRows, dictionaryRecords, elementRecords, environmentRecords, functionRecords, getEvidence, hlrRequirements, llrRequirements, modelRecords, objectiveRecords, openActions, phaseStats, planningRecords, removedIn240, reproChecks, resultRecords, resultSetRecords, reviewRecords, seedPackage, sourceFileRecords, sysRequirements, testRecords } from './fixtures.ts'
import { Alert, BarChart, ChartPanel, Chip, Drawer, EvidenceTable, Field, LifecyclePage, Meter, PackageBuilder, ReviewChip, SearchOverlay, Shell, SkeletonRows, StatusChip, Tabs, Watermark, findingStatusTone, severityTone, useStore } from './components.tsx'
import type { Column, PhaseCtx, QuickFilter, Tone } from './components.tsx'
import { FINDING_FLOW, FINDING_STATUS_LABEL, REVERIFICATION_EVIDENCE, checkTransition } from './store.ts'

// ===== from views/columns.tsx =====
// Reusable evidence table column definitions shared across lifecycle views.

export const idCol: Column = {
  key: 'id',
  label: 'ID',
  idCell: true,
  render: (r) => r.id,
  sortValue: (r) => r.id,
}

export function titleCol(label = 'Title'): Column {
  return {
    key: 'title',
    label,
    render: (r) => (
      <span>
        {r.title}
        <span className="table-meta">{r.sourcePath}</span>
      </span>
    ),
    sortValue: (r) => r.title,
  }
}

export const typeCol: Column = {
  key: 'type',
  label: 'Type',
  render: (r) => TYPE_LABEL[r.type],
  sortValue: (r) => r.type,
}

export const statusCol: Column = {
  key: 'status',
  label: 'Status',
  render: (r) => <StatusChip status={r.status} />,
  sortValue: (r) => r.status,
}

export const reviewCol: Column = {
  key: 'review',
  label: 'Review',
  render: (r) => <ReviewChip state={r.reviewState} />,
  sortValue: (r) => r.reviewState,
}

export const revisionCol: Column = {
  key: 'revision',
  label: 'Revision',
  idCell: true,
  render: (r) => r.revision,
  sortValue: (r) => r.revision,
}

export const modifiedCol: Column = {
  key: 'modified',
  label: 'Modified',
  idCell: true,
  render: (r) => fmtDate(r.modified),
  sortValue: (r) => r.modified,
}

export const findingsCol: Column = {
  key: 'findings',
  label: 'Findings',
  render: (r) =>
    r.findingIds.length === 0 ? (
      <span style={{ color: 'var(--text-muted)' }}>—</span>
    ) : (
      <Chip tone="warning">{r.findingIds.join(', ')}</Chip>
    ),
  sortValue: (r) => r.findingIds.length,
  numeric: false,
}

export function ownerCol(key = 'owner', label = 'Owner'): Column {
  return {
    key,
    label,
    render: (r) => metaStr(r.meta, key) || '—',
    sortValue: (r) => metaStr(r.meta, key),
  }
}

export function metaCol(key: string, label: string, opts: { numeric?: boolean; mono?: boolean } = {}): Column {
  return {
    key: `meta-${key}`,
    label,
    numeric: opts.numeric,
    idCell: opts.mono,
    render: (r) => {
      const v = r.meta[key]
      return v === undefined || v === '' ? <span style={{ color: 'var(--text-muted)' }}>—</span> : String(v)
    },
    sortValue: (r) => (opts.numeric ? metaNum(r.meta, key) : metaStr(r.meta, key)),
  }
}

export const traceCol: Column = {
  key: 'trace',
  label: 'Trace ↑/↓',
  render: (r) => (
    <span className="mono">
      {r.upstream.length === 0 ? <span style={{ color: 'var(--status-danger)' }}>✕0</span> : `↑${r.upstream.length}`}
      {' · '}
      {r.downstream.length === 0 ? <span style={{ color: 'var(--status-danger)' }}>✕0</span> : `↓${r.downstream.length}`}
    </span>
  ),
  sortValue: (r) => r.upstream.length + r.downstream.length,
}

export const changeCol: Column = {
  key: 'change',
  label: 'Δ 2.3.0',
  render: (r) =>
    r.changeMark === 'unchanged' ? (
      <span style={{ color: 'var(--text-muted)' }}>—</span>
    ) : (
      <Chip tone={r.changeMark === 'changed' || r.changeMark === 'added' ? 'info' : 'warning'}>{r.changeMark}</Chip>
    ),
  sortValue: (r) => r.changeMark,
}

// ===== from views/shared.tsx =====
// Shared small tables for non-evidence records (reviews, change records).

export function reviewResultTone(result: ReviewRecord['result']): Tone {
  return result === 'passed' ? 'success' : result === 'failed' ? 'danger' : result === 'pending' ? 'warning' : 'info'
}

export function ReviewTable({
  reviews,
  onOpenSubject,
  label,
}: {
  reviews: ReviewRecord[]
  onOpenSubject: (id: string) => void
  label: string
}) {
  return (
    <div className="table-shell standalone">
      <div className="table-scroll">
        <table className="data" aria-label={label}>
          <thead>
            <tr>
              <th>Review</th>
              <th>Subject</th>
              <th>Type · method</th>
              <th>Reviewer</th>
              <th>Date</th>
              <th>Revision</th>
              <th>Result</th>
              <th>Independence</th>
              <th className="num">Open actions</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((rv) => (
              <tr key={rv.id}>
                <td className="id-cell">{rv.id}</td>
                <td className="id-cell">
                  <button
                    type="button"
                    className="btn btn-quiet btn-sm mono"
                    style={{ padding: 0, height: 'auto' }}
                    onClick={() => onOpenSubject(rv.subjectId)}
                    aria-label={`Open ${rv.subjectId}`}
                  >
                    {rv.subjectId}
                  </button>
                </td>
                <td>
                  {rv.reviewType}
                  <span className="table-meta">{rv.method}</span>
                </td>
                <td>{rv.reviewer}</td>
                <td className="id-cell">{rv.date}</td>
                <td className="id-cell">{rv.revision}</td>
                <td>
                  <Chip tone={reviewResultTone(rv.result)}>{rv.result}</Chip>
                </td>
                <td>{rv.independent ? <Chip tone="neutral">Independent</Chip> : <Chip tone="danger">Missing</Chip>}</td>
                <td className="num">{rv.openActions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>{reviews.length} review records</span>
      </div>
    </div>
  )
}

export function changeStatusTone(status: ChangeRecord['status']): Tone {
  switch (status) {
    case 'closed':
    case 'verified':
      return 'success'
    case 'implemented':
      return 'warning'
    case 'open':
      return 'danger'
    default:
      return 'neutral'
  }
}

export function ChangeTable({
  records,
  onOpenEvidence,
  label,
}: {
  records: ChangeRecord[]
  onOpenEvidence: (id: string) => void
  label: string
}) {
  return (
    <div className="table-shell standalone">
      <div className="table-scroll">
        <table className="data" aria-label={label}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Status</th>
              <th>Owner</th>
              <th>Raised</th>
              <th>Reverified</th>
              <th>Affected evidence</th>
            </tr>
          </thead>
          <tbody>
            {records.map((c) => (
              <tr key={c.id}>
                <td className="id-cell">{c.id}</td>
                <td>
                  {c.title}
                  <span className="table-meta">{c.detail}</span>
                </td>
                <td>
                  <Chip tone={changeStatusTone(c.status)}>{c.status}</Chip>
                </td>
                <td>{c.owner}</td>
                <td className="id-cell">{c.raised}</td>
                <td>
                  {c.reverified ? (
                    <Chip tone="success">Yes</Chip>
                  ) : (
                    <Chip tone="danger">No{c.findingIds.length > 0 ? ` · ${c.findingIds.join(', ')}` : ''}</Chip>
                  )}
                </td>
                <td>
                  {c.affectedIds.slice(0, 3).map((id) => (
                    <button
                      key={id}
                      type="button"
                      className="btn btn-quiet btn-sm mono"
                      style={{ padding: '0 var(--space-1)', height: 'auto' }}
                      onClick={() => onOpenEvidence(id)}
                      aria-label={`Open ${id}`}
                    >
                      {id}
                    </button>
                  ))}
                  {c.affectedIds.length > 3 ? (
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>+{c.affectedIds.length - 3}</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>{records.length} records</span>
      </div>
    </div>
  )
}

// ===== from views/OverviewView.tsx =====
// Overview: Program Readiness, Lifecycle Evidence Flow, Open Findings,
// Recent Activity — with the executive readiness strip, canonical chain, and
// “Continue audit” panel. Cards deep-link to filtered lifecycle views.

export function OverviewView() {
  const { path, navigate } = useRoute()
  const { mergedFindings, openIds, overlay } = useStore()
  const sub = path[1] ?? 'readiness'
  const compare = compareBaselines()
  const open = mergedFindings.filter((f) => openIds.has(f.id))
  const reviewed = allEvidence.filter((r) => r.reviewState === 'approved').length
  const traced = allEvidence.filter((r) => r.upstream.length > 0 || r.downstream.length > 0).length

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="page-subtitle">
            AeroNav Flight Guidance Computer — Lateral Guidance · Software Level B · DO-331 applicable · baseline{' '}
            {overlay.prefs.baseline}
          </p>
        </div>
      </header>

      <div className="stat-row" role="group" aria-label="Executive readiness">
        <span className="stat">
          Evidence <b>{allEvidence.length}</b>
        </span>
        <span className="stat">
          Reviews <b>{reviewRecords.length}</b>
        </span>
        <span className="stat">
          Open findings <b>{open.length}</b>
        </span>
        <span className="stat">
          Changed vs 2.3.0 <b>{compare.changed.length}</b>
        </span>
        <span className="stat">
          Trace coverage <b>{Math.round((traced / allEvidence.length) * 100)}%</b>
        </span>
      </div>

      <Tabs
        label="Overview subviews"
        tabs={[
          { key: 'readiness', label: 'Program Readiness' },
          { key: 'flow', label: 'Lifecycle Evidence Flow' },
          { key: 'findings', label: 'Open Findings' },
          { key: 'activity', label: 'Recent Activity' },
        ]}
        active={sub}
        onSelect={(k) => navigate(['overview', k])}
      />

      {sub === 'readiness' ? (
        <div className="panel-grid cols-2">
          <div className="panel">
            <h3 className="panel-title">Readiness by lifecycle phase</h3>
            <p className="panel-sub">Derived from evidence status, review state, and open findings.</p>
            {PHASES.map((p) => {
              const s = phaseStats(p, openIds)
              return (
                <Meter
                  key={p}
                  label={PHASE_LABEL[p]}
                  value={s.readiness}
                  max={100}
                  tone={s.readiness < 80 ? 'warning' : undefined}
                  valueText={`${s.readiness}%`}
                />
              )
            })}
          </div>
          <div className="panel">
            <h3 className="panel-title">Continue audit</h3>
            <p className="panel-sub">The canonical bank-limit trace chain and the fastest paths back into open work.</p>
            <ol style={{ margin: 0, paddingLeft: 'var(--space-5)', fontSize: 'var(--text-sm)' }}>
              {canonicalChain.map((id) => (
                <li key={id} style={{ padding: '2px 0' }}>
                  <button
                    type="button"
                    className="btn btn-quiet btn-sm mono"
                    style={{ padding: 0, height: 'auto' }}
                    onClick={() => {
                      const rec = allEvidence.find((r) => r.id === id)
                      if (rec) navigate([rec.phase], { select: id, itab: 'trace' })
                    }}
                  >
                    {id}
                  </button>
                </li>
              ))}
            </ol>
            <h3 className="section-header">Coverage</h3>
            <Meter label="Evidence reviewed" value={reviewed} max={allEvidence.length} valueText={`${Math.round((reviewed / allEvidence.length) * 100)}%`} />
            <Meter label="Evidence traced" value={traced} max={allEvidence.length} valueText={`${Math.round((traced / allEvidence.length) * 100)}%`} />
            <Meter label="Findings closed" value={mergedFindings.length - open.length} max={mergedFindings.length} valueText={`${mergedFindings.length - open.length}/${mergedFindings.length}`} />
            <h3 className="section-header">Changes 2.3.0 → 2.4.0</h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
              {compare.changed.length} changed · {compare.added.length} added · {compare.removed.length} removed ·{' '}
              {compare.impacted.length} impacted.{' '}
              <button type="button" className="btn btn-quiet btn-sm" style={{ padding: 0, height: 'auto' }} onClick={() => navigate(['requirements'], {})}>
                Review impacts in Requirements →
              </button>
            </p>
          </div>
        </div>
      ) : null}

      {sub === 'flow' ? (
        <>
          <div className="panel" style={{ marginBottom: 'var(--space-4)' }}>
            <h3 className="panel-title">Lifecycle evidence flow</h3>
            <p className="panel-sub">Planning through certification — each node links to its lifecycle view.</p>
            <div className="flow" role="list">
              {PHASES.map((p, i) => {
                const s = phaseStats(p, openIds)
                return (
                  <span key={p} style={{ display: 'contents' }}>
                    {i > 0 ? (
                      <span className="flow-sep" aria-hidden="true">
                        →
                      </span>
                    ) : null}
                    <button type="button" role="listitem" className="flow-node" onClick={() => navigate([p])} aria-label={`${PHASE_LABEL[p]}: ${s.evidence} evidence records, ${s.openFindings} open findings`}>
                      <span className="flow-count">{s.evidence}</span>
                      <span className="flow-label">{PHASE_LABEL[p]}</span>
                      <span className="flow-label">
                        {s.openFindings > 0 ? `! ${s.openFindings} open` : '✓ clear'} · {s.reviews} reviews
                      </span>
                    </button>
                  </span>
                )
              })}
            </div>
          </div>
          <ChartPanel
            title="Evidence volume by phase"
            scope={`Baseline ${overlay.prefs.baseline} · ${allEvidence.length} records`}
            unit="records"
            legend={[{ label: 'Evidence records', tone: 'primary' }]}
            summary={<span>Design and implementation dominate by element/function count; certification carries the objective matrix.</span>}
          >
            <BarChart ariaLabel="Evidence count by phase" unit="" data={PHASES.map((p) => ({ label: PHASE_LABEL[p], value: phaseStats(p, openIds).evidence }))} />
          </ChartPanel>
        </>
      ) : null}

      {sub === 'findings' ? (
        <div className="panel-grid cols-2">
          <ChartPanel
            title="Finding distribution"
            scope="12 seeded findings"
            unit="findings"
            legend={[
              { label: 'High', tone: 'danger' },
              { label: 'Medium', tone: 'warning' },
              { label: 'Low', tone: 'primary' },
            ]}
            summary={
              <span>
                {mergedFindings.filter((f) => f.severity === 'high').length} high ·{' '}
                {mergedFindings.filter((f) => f.severity === 'medium').length} medium ·{' '}
                {mergedFindings.filter((f) => f.severity === 'low').length} low —{' '}
                {open.length} open, {mergedFindings.length - open.length} closed.
              </span>
            }
          >
            <BarChart
              ariaLabel="Findings by phase"
              unit=""
              data={PHASES.map((p) => ({
                label: PHASE_LABEL[p],
                value: mergedFindings.filter((f) => f.phase === p).length,
                tone: mergedFindings.some((f) => f.phase === p && f.severity === 'high' && f.status !== 'closed') ? 'danger' : 'primary',
              }))}
            />
          </ChartPanel>
          <div className="panel">
            <h3 className="panel-title">Open findings</h3>
            {open.map((f) => (
              <button key={f.id} type="button" className="finding-card" onClick={() => navigate(['findings'], { select: f.id })}>
                <span style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                  <span className="mono" style={{ fontSize: 12 }}>
                    {f.id}
                  </span>
                  <Chip tone={severityTone(f.severity)}>{f.severity}</Chip>
                  <Chip tone={findingStatusTone(f.status)}>{FINDING_STATUS_LABEL[f.status]}</Chip>
                </span>
                <span className="fc-title">{f.title}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {sub === 'activity' ? (
        <div className="panel">
          <h3 className="panel-title">Recent activity</h3>
          <p className="panel-sub">Hub-local timeline — resets, finding transitions, reviews, packages, baselines, refreshes.</p>
          <ul className="timeline">
            {overlay.activity.slice(0, 12).map((e) => (
              <li key={e.id}>
                <span className="t-at">{fmtDateTime(e.at)}</span>
                <span>
                  <Chip tone="neutral">{e.kind}</Chip>
                </span>
                <span>{e.message}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-quiet" onClick={() => navigate(['activity'])}>
            Full activity timeline →
          </button>
        </div>
      ) : null}
    </div>
  )
}

// ===== from views/PlanningView.tsx =====
// Planning: Plans & Standards, Approval Matrix, Development & Verification
// Environment, Plan Review Evidence.

export function PlanningView() {
  const approved = planningRecords.filter((r) => r.status === 'approved').length
  return (
    <LifecyclePage
      phase="planning"
      intro="Plans, standards, and the development/verification environment governing the AeroNav lateral guidance software."
      subviews={[
        {
          key: 'plans',
          label: 'Plans & Standards',
          render: (ctx) => (
            <>
              <div className="panel" style={{ marginBottom: 'var(--space-4)' }}>
                <h3 className="panel-title">Approval coverage</h3>
                <Meter label="Plans approved" value={approved} max={planningRecords.length} valueText={`${approved}/${planningRecords.length}`} />
                <Meter
                  label="Independent authorship"
                  value={planningRecords.filter((r) => metaStr(r.meta, 'independence') === 'Independent').length}
                  max={planningRecords.length}
                  valueText={`${planningRecords.filter((r) => metaStr(r.meta, 'independence') === 'Independent').length}/${planningRecords.length}`}
                />
                <p className="panel-sub" style={{ margin: 'var(--space-2) 0 0' }}>
                  PLN-TQP remains in review; FND-009 tracks the obsolete SCI reference inside PLN-PSAC.
                </p>
              </div>
              <EvidenceTable
                label="Plans and standards"
                rows={planningRecords}
                columns={[idCol, titleCol(), typeCol, ownerCol(), revisionCol, statusCol, reviewCol, metaCol('linkedReviews', 'Reviews', { numeric: true }), findingsCol]}
                quickFilters={[
                  { key: 'standards', label: 'Standards', predicate: (r) => r.type === 'standard' },
                  { key: 'in-review', label: 'In review', predicate: (r) => r.status === 'in-review' },
                  { key: 'findings', label: 'With findings', predicate: (r) => r.findingIds.length > 0 },
                ]}
                activeQuickFilter={ctx.quickFilter}
                onQuickFilter={ctx.setQuickFilter}
                onOpen={ctx.openRecord}
                onReview={ctx.review}
                demo={ctx.demo}
                selectedId={ctx.selectedId}
              />
            </>
          ),
        },
        {
          key: 'approvals',
          label: 'Approval Matrix',
          render: (ctx) => (
            <div className="table-shell standalone">
              <div className="table-scroll">
                <table className="data" aria-label="Plan approval matrix">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Owner</th>
                      <th>Approver</th>
                      <th>Authorship</th>
                      <th>Approval</th>
                      <th>Review evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planningRecords.map((r) => (
                      <tr key={r.id} className="row" tabIndex={0} onClick={() => ctx.openRecord(r)} onKeyDown={(e) => e.key === 'Enter' && ctx.openRecord(r)}>
                        <td className="id-cell">{r.id}</td>
                        <td>{metaStr(r.meta, 'owner')}</td>
                        <td>{metaStr(r.meta, 'approver')}</td>
                        <td>
                          <Chip tone={metaStr(r.meta, 'independence') === 'Independent' ? 'success' : 'neutral'}>
                            {metaStr(r.meta, 'independence')}
                          </Chip>
                        </td>
                        <td>
                          <Chip tone={r.status === 'approved' ? 'success' : 'warning'}>{r.status === 'approved' ? 'Approved' : 'Pending'}</Chip>
                        </td>
                        <td className="num">{metaStr(r.meta, 'linkedReviews')} linked</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ),
        },
        {
          key: 'environment',
          label: 'Dev & Verification Environment',
          render: (ctx) => (
            <EvidenceTable
              label="Development and verification environment"
              rows={environmentRecords}
              columns={[idCol, titleCol('Tool / platform'), revisionCol, metaCol('role', 'Role'), metaCol('qualification', 'Qualification'), ownerCol()]}
              onOpen={ctx.openRecord}
              demo={ctx.demo}
              selectedId={ctx.selectedId}
            />
          ),
        },
        {
          key: 'plan-reviews',
          label: 'Plan Review Evidence',
          render: (ctx) => (
            <ReviewTable
              label="Plan review evidence"
              reviews={reviewRecords.filter((rv) => rv.phase === 'planning')}
              onOpenSubject={(id) => ctx.openRecord(id)}
            />
          ),
        },
      ]}
    />
  )
}

// ===== from views/RequirementsView.tsx =====
// Requirements: System / HLR / LLR / Derived subviews plus Coverage & Gaps.
// Featured: SYS-LAT-014, SWR-HLR-LAT-021, SWR-LLR-LAT-044, broken-link
// SWR-LLR-LAT-052, and derived SWR-DRV-LAT-003 (missing safety feedback).

const REQ_FILTERS: QuickFilter[] = [
  { key: 'untraced', label: 'Untraced', predicate: (r) => r.upstream.length === 0 || r.downstream.length === 0 },
  { key: 'unverified', label: 'Unverified', predicate: (r) => r.reviewState !== 'approved' || r.status !== 'approved' },
  { key: 'changed', label: 'Changed', predicate: (r) => r.changeMark === 'changed' || r.changeMark === 'impacted' },
  { key: 'derived', label: 'Derived', predicate: (r) => r.type === 'derived-requirement' },
  { key: 'findings', label: 'Findings', predicate: (r) => r.findingIds.length > 0 },
]

const REQ_COLUMNS = [idCol, titleCol('Requirement'), statusCol, reviewCol, traceCol, metaCol('verificationMethod', 'Method'), metaCol('changeImpact', 'Change impact'), changeCol, findingsCol]

function reqTable(label: string, rows: EvidenceRecord[], ctx: PhaseCtx) {
  return (
    <EvidenceTable
      label={label}
      rows={rows}
      columns={REQ_COLUMNS}
      quickFilters={REQ_FILTERS}
      activeQuickFilter={ctx.quickFilter}
      onQuickFilter={ctx.setQuickFilter}
      onOpen={ctx.openRecord}
      onReview={ctx.review}
      demo={ctx.demo}
      selectedId={ctx.selectedId}
    />
  )
}

function downstreamCovered(rows: EvidenceRecord[]): number {
  return rows.filter((r) => r.downstream.length > 0).length
}

export function RequirementsView() {
  const all = [...sysRequirements, ...hlrRequirements, ...llrRequirements, ...derivedRequirements]
  return (
    <LifecyclePage
      phase="requirements"
      intro="System, high-level, low-level, and derived requirements for the lateral guidance function with trace coverage and change impact."
      subviews={[
        { key: 'system', label: 'System Requirements', render: (ctx) => reqTable('System requirements', sysRequirements, ctx) },
        { key: 'hlr', label: 'High-Level Requirements', render: (ctx) => reqTable('High-level requirements', hlrRequirements, ctx) },
        { key: 'llr', label: 'Low-Level Requirements', render: (ctx) => reqTable('Low-level requirements', llrRequirements, ctx) },
        {
          key: 'derived',
          label: 'Derived Requirements',
          render: (ctx) => (
            <>
              <p style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Derived requirements require recorded feedback to the system safety process.{' '}
                <code>SWR-DRV-LAT-003</code> is missing that record (FND-001).
              </p>
              <EvidenceTable
                label="Derived requirements"
                rows={derivedRequirements}
                columns={[idCol, titleCol('Derived requirement'), statusCol, reviewCol, metaCol('safetyFeedback', 'Safety feedback'), ownerCol(), findingsCol]}
                onOpen={ctx.openRecord}
                onReview={ctx.review}
                demo={ctx.demo}
                selectedId={ctx.selectedId}
              />
            </>
          ),
        },
        {
          key: 'coverage',
          label: 'Coverage & Gaps',
          render: (ctx) => {
            const gaps = all.filter((r) => r.upstream.length === 0 && r.type !== 'sys-requirement')
            const downGaps = all.filter((r) => r.downstream.length === 0 && r.type !== 'derived-requirement')
            return (
              <div className="panel-grid cols-2">
                <ChartPanel
                  title="Downstream trace coverage"
                  scope="Requirements → next lifecycle artifact, baseline 2.4.0"
                  unit="requirements"
                  legend={[{ label: 'Traced downstream', tone: 'primary' }]}
                  summary={
                    <span>
                      {downstreamCovered(llrRequirements)}/{llrRequirements.length} LLRs reach a model element;{' '}
                      {llrRequirements.length - downstreamCovered(llrRequirements)} gaps include the broken link on{' '}
                      <code>SWR-LLR-LAT-052</code> (FND-002).
                    </span>
                  }
                >
                  <BarChart
                    ariaLabel="Downstream trace coverage by requirement level"
                    unit=""
                    data={[
                      { label: `System (${sysRequirements.length})`, value: downstreamCovered(sysRequirements) },
                      { label: `HLR (${hlrRequirements.length})`, value: downstreamCovered(hlrRequirements) },
                      { label: `LLR (${llrRequirements.length})`, value: downstreamCovered(llrRequirements) },
                      { label: `Derived (${derivedRequirements.length})`, value: downstreamCovered(derivedRequirements) },
                    ]}
                  />
                </ChartPanel>
                <div className="panel">
                  <h3 className="panel-title">Verification & review coverage</h3>
                  <Meter
                    label="Review approved"
                    value={all.filter((r) => r.reviewState === 'approved').length}
                    max={all.length}
                    valueText={`${all.filter((r) => r.reviewState === 'approved').length}/${all.length}`}
                  />
                  <Meter
                    label="Verified by test"
                    value={all.filter((r) => metaStr(r.meta, 'verificationMethod') === 'Test').length}
                    max={all.length}
                    valueText={`${all.filter((r) => metaStr(r.meta, 'verificationMethod') === 'Test').length}/${all.length}`}
                  />
                  <Meter
                    label="Changed / impacted in 2.4.0"
                    value={all.filter((r) => r.changeMark !== 'unchanged').length}
                    max={all.length}
                    tone="warning"
                    valueText={`${all.filter((r) => r.changeMark !== 'unchanged').length}`}
                  />
                  <h3 className="section-header">Open trace gaps</h3>
                  <ul className="compare-list">
                    {[...gaps, ...downGaps].slice(0, 6).map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          className="btn btn-quiet btn-sm mono"
                          style={{ padding: 0, height: 'auto' }}
                          onClick={() => ctx.openRecord(r)}
                        >
                          {r.id}
                        </button>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {r.upstream.length === 0 ? 'no upstream trace' : 'no downstream trace'}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                    Canonical chain check:{' '}
                    <button type="button" className="btn btn-quiet btn-sm mono" style={{ padding: 0, height: 'auto' }} onClick={() => ctx.openRecord(getEvidence('SYS-LAT-014') ?? 'SYS-LAT-014')}>
                      SYS-LAT-014
                    </button>{' '}
                    resolves through 8 nodes to VR-RESULT-2026-041.
                  </p>
                </div>
              </div>
            )
          },
        },
      ]}
    />
  )
}

// ===== from views/DesignView.tsx =====
// Design (DO-331): Models, Data Dictionaries, Interfaces, Model Review,
// Design Traceability. Featured: LateralGuidance/BankAngleLimiter and the
// stale-review guidance_types.sldd (FND-003).

const interfaces = elementRecords.filter((r) => {
  const k = metaStr(r.meta, 'kind')
  return k === 'Inport' || k === 'Outport'
})

export function DesignView() {
  return (
    <LifecyclePage
      phase="design"
      intro="Simulink design models, harnesses, data dictionaries, and ~140 model elements with model-to-code traceability."
      subviews={[
        {
          key: 'models',
          label: 'Models',
          render: (ctx) => (
            <>
              <div className="panel" style={{ marginBottom: 'var(--space-4)' }}>
                <h3 className="panel-title">Model hierarchy</h3>
                <p className="panel-sub">4 design models · 3 verification harnesses · elements roll up per model</p>
                {modelRecords.map((m) => (
                  <div key={m.id} className="meter">
                    <span className="mono" style={{ fontSize: 12 }}>
                      {m.id}
                    </span>
                    <span className="bar" role="img" aria-label={`${m.id}: ${metaNum(m.meta, 'elementCount')} elements`}>
                      <span style={{ width: `${(metaNum(m.meta, 'elementCount') / 48) * 100}%` }} />
                    </span>
                    <span className="value">{metaNum(m.meta, 'elementCount')} elem</span>
                  </div>
                ))}
              </div>
              <EvidenceTable
                label="Design models and harnesses"
                rows={modelRecords}
                columns={[idCol, titleCol('Model'), metaCol('modelKind', 'Kind'), revisionCol, statusCol, reviewCol, metaCol('elementCount', 'Elements', { numeric: true }), metaCol('modifiedElements', 'Modified elem', { numeric: true }), changeCol, findingsCol]}
                quickFilters={[
                  { key: 'changed', label: 'Changed in 2.4.0', predicate: (r) => r.changeMark === 'changed' },
                  { key: 'harness', label: 'Harnesses', predicate: (r) => r.type === 'harness' },
                ]}
                activeQuickFilter={ctx.quickFilter}
                onQuickFilter={ctx.setQuickFilter}
                onOpen={ctx.openRecord}
                onReview={ctx.review}
                demo={ctx.demo}
                selectedId={ctx.selectedId}
              />
            </>
          ),
        },
        {
          key: 'dictionaries',
          label: 'Data Dictionaries',
          render: (ctx) => (
            <>
              <p style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Bus, enumeration, and parameter definitions shared by the design models.{' '}
                <code>guidance_types.sldd</code> carries a stale review after the Rev 8 bank-limit bus change (FND-003).
              </p>
              <EvidenceTable
                label="Data dictionaries"
                rows={dictionaryRecords}
                columns={[idCol, titleCol('Dictionary'), revisionCol, reviewCol, metaCol('entryCount', 'Entries', { numeric: true }), metaCol('buses', 'Buses', { numeric: true }), metaCol('enums', 'Enums', { numeric: true }), metaCol('note', 'Notes'), findingsCol]}
                onOpen={ctx.openRecord}
                onReview={ctx.review}
                demo={ctx.demo}
                selectedId={ctx.selectedId}
              />
            </>
          ),
        },
        {
          key: 'interfaces',
          label: 'Interfaces',
          render: (ctx) => (
            <EvidenceTable
              label="Model interfaces"
              rows={interfaces}
              columns={[idCol, titleCol('Interface element'), metaCol('model', 'Model', { mono: true }), metaCol('kind', 'Direction'), metaCol('interface', 'Signal'), reviewCol]}
              onOpen={ctx.openRecord}
              demo={ctx.demo}
              selectedId={ctx.selectedId}
            />
          ),
        },
        {
          key: 'model-review',
          label: 'Model Review',
          render: (ctx) => (
            <div className="table-shell standalone">
              <div className="table-scroll">
                <table className="data" aria-label="Model review state">
                  <thead>
                    <tr>
                      <th>Artifact</th>
                      <th>Review state</th>
                      <th>Owner</th>
                      <th className="num">Modified elements</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...modelRecords, ...dictionaryRecords].map((m) => (
                      <tr key={m.id} className="row" tabIndex={0} onClick={() => ctx.openRecord(m)} onKeyDown={(e) => e.key === 'Enter' && ctx.openRecord(m)}>
                        <td className="id-cell">{m.id}</td>
                        <td>
                          <ReviewChip state={m.reviewState} />
                        </td>
                        <td>{metaStr(m.meta, 'owner')}</td>
                        <td className="num">{metaNum(m.meta, 'modifiedElements')}</td>
                        <td style={{ whiteSpace: 'normal' }}>
                          {m.reviewState === 'stale' ? 'Re-review required before design credit (FND-003).' : metaStr(m.meta, 'note') || 'Review current for this revision.'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ),
        },
        {
          key: 'traceability',
          label: 'Design Traceability',
          render: (ctx) => {
            const traced = elementRecords.filter((r) => r.upstream.length > 0)
            const toCode = elementRecords.filter((r) => r.downstream.length > 0)
            return (
              <>
                <div className="panel" style={{ marginBottom: 'var(--space-4)' }}>
                  <h3 className="panel-title">Element trace coverage</h3>
                  <Meter label="LLR → element (upstream)" value={traced.length} max={elementRecords.length} valueText={`${traced.length}/${elementRecords.length}`} />
                  <Meter label="Element → code (downstream)" value={toCode.length} max={elementRecords.length} valueText={`${toCode.length}/${elementRecords.length}`} />
                  <p className="panel-sub" style={{ margin: 'var(--space-2) 0 0' }}>
                    Untraced elements are structural (subsystem plumbing) per the modeling standard;{' '}
                    <Chip tone="info">LateralGuidance/BankAngleLimiter</Chip> anchors the canonical bank-limit chain.
                  </p>
                </div>
                <EvidenceTable
                  label="Model elements"
                  rows={elementRecords}
                  columns={[idCol, titleCol('Element'), metaCol('model', 'Model', { mono: true }), metaCol('kind', 'Kind'), traceCol, statusCol, reviewCol, changeCol, findingsCol]}
                  quickFilters={[
                    { key: 'untraced', label: 'No LLR trace', predicate: (r) => r.upstream.length === 0 },
                    { key: 'to-code', label: 'Traced to code', predicate: (r) => r.downstream.length > 0 },
                    { key: 'changed', label: 'Changed', predicate: (r) => r.changeMark === 'changed' },
                  ]}
                  activeQuickFilter={ctx.quickFilter}
                  onQuickFilter={ctx.setQuickFilter}
                  onOpen={ctx.openRecord}
                  demo={ctx.demo}
                  selectedId={ctx.selectedId}
                />
              </>
            )
          },
        },
      ]}
    />
  )
}

// ===== from views/ImplementationView.tsx =====
// Implementation: Source Files, Functions, Model-to-Code Trace, Coding
// Standards, Static Analysis. Featured: lateral_guidance.c::limit_bank_command
// and the missing-trace function mode_logic.c::select_capture_mode (FND-004).

export function ImplementationView() {
  const generated = sourceFileRecords.filter((r) => metaStr(r.meta, 'origin').startsWith('Generated'))
  return (
    <LifecyclePage
      phase="implementation"
      intro="24 C/H files and 105 functions: generated model code plus hand-written support code, with coding-standard and static-analysis state."
      subviews={[
        {
          key: 'files',
          label: 'Source Files',
          render: (ctx) => (
            <>
              <div className="panel" style={{ marginBottom: 'var(--space-4)' }}>
                <h3 className="panel-title">Code composition</h3>
                <Meter label="Generated from models" value={generated.length} max={sourceFileRecords.length} valueText={`${generated.length}/${sourceFileRecords.length}`} />
                <Meter label="Hand-written support" value={sourceFileRecords.length - generated.length} max={sourceFileRecords.length} valueText={`${sourceFileRecords.length - generated.length}/${sourceFileRecords.length}`} />
              </div>
              <EvidenceTable
                label="Source files"
                rows={sourceFileRecords}
                columns={[idCol, titleCol('File'), metaCol('origin', 'Origin'), metaCol('model', 'Model', { mono: true }), metaCol('loc', 'LOC', { numeric: true }), metaCol('functions', 'Functions', { numeric: true }), revisionCol, reviewCol, metaCol('staticAnalysis', 'Static analysis'), changeCol]}
                quickFilters={[
                  { key: 'generated', label: 'Generated', predicate: (r) => metaStr(r.meta, 'origin').startsWith('Generated') },
                  { key: 'hand', label: 'Hand code', predicate: (r) => metaStr(r.meta, 'origin') === 'Hand code' },
                  { key: 'changed', label: 'Changed', predicate: (r) => r.changeMark !== 'unchanged' },
                ]}
                activeQuickFilter={ctx.quickFilter}
                onQuickFilter={ctx.setQuickFilter}
                onOpen={ctx.openRecord}
                onReview={ctx.review}
                demo={ctx.demo}
                selectedId={ctx.selectedId}
              />
            </>
          ),
        },
        {
          key: 'functions',
          label: 'Functions',
          render: (ctx) => (
            <EvidenceTable
              label="Functions"
              rows={functionRecords}
              columns={[idCol, titleCol('Function'), metaCol('loc', 'LOC', { numeric: true }), metaCol('complexity', 'Cyclomatic', { numeric: true }), metaCol('origin', 'Origin'), traceCol, metaCol('coverage', 'Coverage'), reviewCol, findingsCol]}
              quickFilters={[
                { key: 'untraced', label: 'Missing trace', predicate: (r) => r.upstream.length === 0 },
                { key: 'complex', label: 'Complexity > 10', predicate: (r) => Number(r.meta.complexity ?? 0) > 10 },
                { key: 'findings', label: 'Findings', predicate: (r) => r.findingIds.length > 0 },
              ]}
              activeQuickFilter={ctx.quickFilter}
              onQuickFilter={ctx.setQuickFilter}
              onOpen={ctx.openRecord}
              onReview={ctx.review}
              demo={ctx.demo}
              selectedId={ctx.selectedId}
            />
          ),
        },
        {
          key: 'trace',
          label: 'Model-to-Code Trace',
          render: (ctx) => {
            const genFns = functionRecords.filter((r) => metaStr(r.meta, 'origin') === 'Generated')
            const linked = genFns.filter((r) => r.upstream.length > 0)
            return (
              <>
                <div className="panel" style={{ marginBottom: 'var(--space-4)' }}>
                  <h3 className="panel-title">Generated-code trace closure</h3>
                  <Meter label="Functions with model origin" value={linked.length} max={genFns.length} valueText={`${linked.length}/${genFns.length}`} tone={linked.length < genFns.length ? 'warning' : undefined} />
                  <p className="panel-sub" style={{ margin: 'var(--space-2) 0 0' }}>
                    <code>mode_logic.c::select_capture_mode</code> has no model origin link — tracked as FND-004
                    (separate from the featured bank-limit chain).
                  </p>
                </div>
                <EvidenceTable
                  label="Model to code trace"
                  rows={genFns}
                  columns={[idCol, metaCol('model', 'Model', { mono: true }), traceCol, metaCol('coverage', 'Coverage'), statusCol, findingsCol]}
                  quickFilters={[{ key: 'gap', label: 'Trace gaps', predicate: (r) => r.upstream.length === 0 }]}
                  activeQuickFilter={ctx.quickFilter}
                  onQuickFilter={ctx.setQuickFilter}
                  onOpen={ctx.openRecord}
                  demo={ctx.demo}
                  selectedId={ctx.selectedId}
                />
              </>
            )
          },
        },
        {
          key: 'coding-standards',
          label: 'Coding Standards',
          render: (ctx) => (
            <div className="table-shell standalone">
              <div className="table-scroll">
                <table className="data" aria-label="Coding standard deviations">
                  <thead>
                    <tr>
                      <th>Deviation</th>
                      <th>Rule</th>
                      <th>Scope</th>
                      <th>Rationale</th>
                      <th>Status</th>
                      <th>Approver</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deviationRows.map((d) => (
                      <tr key={d.id}>
                        <td className="id-cell">{d.id}</td>
                        <td>{d.rule}</td>
                        <td className="id-cell">
                          <button type="button" className="btn btn-quiet btn-sm mono" style={{ padding: 0, height: 'auto' }} onClick={() => ctx.openRecord(d.scope)}>
                            {d.scope}
                          </button>
                        </td>
                        <td style={{ whiteSpace: 'normal' }}>{d.rationale}</td>
                        <td>
                          <Chip tone={d.status === 'approved' ? 'success' : d.status === 'pending' ? 'warning' : 'danger'}>
                            {d.status}
                            {d.findingIds.length > 0 ? ` · ${d.findingIds.join(', ')}` : ''}
                          </Chip>
                        </td>
                        <td>{d.approver}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="table-footer">
                <span>
                  {deviationRows.length} deviations · MISRA-based coding standard STD-CODE Rev D · DEV-2026-004 is the
                  DER-approved deviation (FND-011)
                </span>
              </div>
            </div>
          ),
        },
        {
          key: 'static-analysis',
          label: 'Static Analysis',
          render: (ctx) => (
            <>
              <p style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Static analysis suite 2026.1 (TQL-5 qualified) across baseline 2.4.0. All modules clean except{' '}
                <code>diagnostics.c</code> (2 non-blocking warnings under review).
              </p>
              <EvidenceTable
                label="Static analysis by file"
                rows={sourceFileRecords.filter((r) => r.sourceKind === 'C')}
                columns={[idCol, metaCol('staticAnalysis', 'Static analysis'), metaCol('deviations', 'Deviations', { numeric: true }), metaCol('loc', 'LOC', { numeric: true }), revisionCol, reviewCol]}
                quickFilters={[{ key: 'warnings', label: 'With warnings', predicate: (r) => metaStr(r.meta, 'staticAnalysis') !== 'Clean' }]}
                activeQuickFilter={ctx.quickFilter}
                onQuickFilter={ctx.setQuickFilter}
                onOpen={ctx.openRecord}
                demo={ctx.demo}
                selectedId={ctx.selectedId}
              />
            </>
          ),
        },
      ]}
    />
  )
}

// ===== from views/VerificationView.tsx =====
// Verification: Test Cases, Test Procedures, Results, Structural Coverage,
// Robustness & Reverification. Featured: TC-LAT-BOUNDARY-008 →
// RequirementsResults_2_4_0 → VR-RESULT-2026-041, the robustness failure
// (FND-005), stale result hash (FND-006), decision coverage gap (FND-007).

const passed = testRecords.filter((t) => t.status === 'passed').length
const failed = testRecords.filter((t) => t.status === 'failed').length
const blocked = testRecords.filter((t) => t.status === 'blocked').length
const notRun = testRecords.filter((t) => t.status === 'not-run').length

interface ProcRow {
  id: string
  tests: number
  iterations: number
  group: string
  status: string
}

const procedures: ProcRow[] = (() => {
  const map = new Map<string, ProcRow>()
  for (const t of testRecords) {
    const pid = metaStr(t.meta, 'procedure')
    const row = map.get(pid) ?? { id: pid, tests: 0, iterations: 0, group: t.id.includes('ROBUST') ? 'Robustness' : t.id.includes('BOUNDARY') ? 'Boundary' : 'Requirements', status: 'passed' }
    row.tests += 1
    row.iterations += metaNum(t.meta, 'iterations')
    if (t.status === 'failed') row.status = 'failed'
    else if (t.status !== 'passed' && row.status === 'passed') row.status = t.status
    map.set(pid, row)
  }
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id))
})()

export function VerificationView() {
  return (
    <LifecyclePage
      phase="verification"
      intro="64 test cases (225 iterations), 6 result sets, structural coverage, and the reverification queue for baseline 2.4.0."
      subviews={[
        {
          key: 'tests',
          label: 'Test Cases',
          render: (ctx) => (
            <>
              <div className="stat-row" style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: 'var(--space-4)' }} role="group" aria-label="Test execution summary">
                <span className="stat">
                  Passed <b>{passed}</b>
                </span>
                <span className="stat">
                  Failed <b>{failed}</b>
                </span>
                <span className="stat">
                  Blocked <b>{blocked}</b>
                </span>
                <span className="stat">
                  Not run <b>{notRun}</b>
                </span>
                <span className="stat">
                  Iterations <b>{TOTAL_ITERATIONS}</b>
                </span>
              </div>
              <EvidenceTable
                label="Test cases"
                rows={testRecords}
                columns={[idCol, titleCol('Test case'), statusCol, metaCol('iterations', 'Iterations', { numeric: true }), metaCol('method', 'Method'), traceCol, metaCol('lastRun', 'Last run', { mono: true }), reviewCol, changeCol, findingsCol]}
                quickFilters={[
                  { key: 'failed', label: 'Failed', predicate: (r) => r.status === 'failed' },
                  { key: 'not-run', label: 'Blocked / not run', predicate: (r) => r.status === 'blocked' || r.status === 'not-run' },
                  { key: 'changed', label: 'Changed / impacted', predicate: (r) => r.changeMark !== 'unchanged' },
                  { key: 'findings', label: 'Findings', predicate: (r) => r.findingIds.length > 0 },
                ]}
                activeQuickFilter={ctx.quickFilter}
                onQuickFilter={ctx.setQuickFilter}
                onOpen={ctx.openRecord}
                onReview={ctx.review}
                demo={ctx.demo}
                selectedId={ctx.selectedId}
              />
            </>
          ),
        },
        {
          key: 'procedures',
          label: 'Test Procedures',
          render: () => (
            <div className="table-shell standalone">
              <div className="table-scroll">
                <table className="data" aria-label="Test procedures">
                  <thead>
                    <tr>
                      <th>Procedure</th>
                      <th>Group</th>
                      <th className="num">Test cases</th>
                      <th className="num">Iterations</th>
                      <th>Aggregate status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {procedures.map((p) => (
                      <tr key={p.id}>
                        <td className="id-cell">{p.id}</td>
                        <td>{p.group}</td>
                        <td className="num">{p.tests}</td>
                        <td className="num">{p.iterations}</td>
                        <td>
                          <Chip tone={p.status === 'passed' ? 'success' : p.status === 'failed' ? 'danger' : 'warning'}>{p.status}</Chip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="table-footer">
                <span>
                  {procedures.length} procedures · {TOTAL_ITERATIONS} iterations total (deterministic aggregate)
                </span>
              </div>
            </div>
          ),
        },
        {
          key: 'results',
          label: 'Results',
          render: (ctx) => (
            <>
              <EvidenceTable
                label="Result sets"
                rows={resultSetRecords}
                columns={[idCol, titleCol('Result set'), statusCol, metaCol('tests', 'Tests', { numeric: true }), metaCol('passed', 'Passed', { numeric: true }), metaCol('failed', 'Failed', { numeric: true }), metaCol('hashState', 'Hash check'), revisionCol, changeCol, findingsCol]}
                onOpen={ctx.openRecord}
                onReview={ctx.review}
                demo={ctx.demo}
                selectedId={ctx.selectedId}
              />
              <h3 className="section-header">Individual execution records</h3>
              <EvidenceTable
                label="Execution records"
                rows={resultRecords}
                columns={[idCol, titleCol('Execution record'), statusCol, metaCol('test', 'Test', { mono: true }), metaCol('iterations', 'Iterations', { numeric: true }), metaCol('executedBy', 'Executed by'), findingsCol]}
                onOpen={ctx.openRecord}
                demo={ctx.demo}
                selectedId={ctx.selectedId}
              />
            </>
          ),
        },
        {
          key: 'coverage',
          label: 'Structural Coverage',
          render: (ctx) => (
            <div className="panel-grid cols-2">
              <ChartPanel
                title="Decision coverage by module"
                scope="CoverageResults_2_4_0 · target: 100% decision (Level B)"
                unit="%"
                legend={[
                  { label: 'Decision coverage', tone: 'primary' },
                  { label: 'Below target (labeled)', tone: 'danger' },
                ]}
                summary={
                  <span>
                    Program decision coverage 98.9%. Open gap: <code>lateral_guidance.c</code> at 92.4% —{' '}
                    <code>limit_bank_command</code> high-speed branch (FND-007).
                  </span>
                }
              >
                <BarChart
                  ariaLabel="Decision coverage percentage by module"
                  unit="%"
                  max={100}
                  data={coverageRows.map((c) => ({
                    label: c.module,
                    value: c.decision,
                    tone: c.decision < 95 ? 'danger' : 'primary',
                  }))}
                />
              </ChartPanel>
              <div className="table-shell standalone" style={{ alignSelf: 'stretch' }}>
                <div className="table-scroll">
                  <table className="data" aria-label="Structural coverage by module">
                    <thead>
                      <tr>
                        <th>Module</th>
                        <th className="num">Statement</th>
                        <th className="num">Decision</th>
                        <th className="num">MC/DC</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coverageRows.map((c) => (
                        <tr key={c.module} className="row" tabIndex={0} onClick={() => ctx.openRecord(c.module)} onKeyDown={(e) => e.key === 'Enter' && ctx.openRecord(c.module)}>
                          <td className="id-cell">{c.module}</td>
                          <td className="num">{c.statement.toFixed(1)}</td>
                          <td className="num">{c.decision < 95 ? <span style={{ color: 'var(--status-danger)' }}>{c.decision.toFixed(1)} ✕</span> : c.decision.toFixed(1)}</td>
                          <td className="num">{c.mcdc.toFixed(1)}</td>
                          <td style={{ whiteSpace: 'normal' }}>
                            {c.note}
                            {c.findingIds.length > 0 ? ` (${c.findingIds.join(', ')})` : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ),
        },
        {
          key: 'robustness',
          label: 'Robustness & Reverification',
          render: (ctx) => {
            const robust = testRecords.filter((t) => t.id.includes('ROBUST'))
            const queue = changeRecords.filter((c) => !c.reverified)
            return (
              <>
                <EvidenceTable
                  label="Robustness tests"
                  rows={robust}
                  columns={[idCol, titleCol('Robustness test'), statusCol, metaCol('iterations', 'Iterations', { numeric: true }), reviewCol, findingsCol]}
                  quickFilters={[{ key: 'failed', label: 'Failures', predicate: (r) => r.status === 'failed' }]}
                  activeQuickFilter={ctx.quickFilter}
                  onQuickFilter={ctx.setQuickFilter}
                  onOpen={ctx.openRecord}
                  demo={ctx.demo}
                  selectedId={ctx.selectedId}
                />
                <h3 className="section-header">Reverification queue</h3>
                <div className="panel">
                  <p className="panel-sub" style={{ marginBottom: 'var(--space-2)' }}>
                    Changes implemented in 2.4.0 whose verification credit is not yet re-established.
                  </p>
                  {queue.length === 0 ? (
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Queue empty — all changes reverified.</p>
                  ) : (
                    <ul className="compare-list">
                      {queue.map((c) => (
                        <li key={c.id}>
                          <span className="mono">{c.id}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{c.title}</span>
                          <Chip tone="danger">not reverified{c.findingIds.length > 0 ? ` · ${c.findingIds.join(', ')}` : ''}</Chip>
                          {c.affectedIds.slice(0, 2).map((id) => (
                            <button key={id} type="button" className="btn btn-quiet btn-sm mono" style={{ padding: 0, height: 'auto' }} onClick={() => ctx.openRecord(id)}>
                              {id}
                            </button>
                          ))}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )
          },
        },
      ]}
    />
  )
}

// ===== from views/CMView.tsx =====
// Configuration Management: Baselines, Configuration Items, Change Records,
// Problem Reports, Build Reproducibility. Featured: CR-2026-009 unreverified
// change (FND-010) and the regression archive hash mismatch (FND-006).

// Representative configuration-item slice: plans, models, dictionaries, files,
// and result sets carry the controlled hashes for status accounting.
const configItems = allEvidence.filter((r) =>
  ['plan', 'standard', 'model', 'harness', 'data-dictionary', 'source-file', 'result-set', 'config-item'].includes(r.type),
)

export function CMView() {
  return (
    <LifecyclePage
      phase="cm"
      intro="Baselines 2.3.0 and 2.4.0, configuration item hashes, 18 change/problem records, and build reproducibility checks."
      subviews={[
        {
          key: 'baselines',
          label: 'Baselines',
          render: (ctx) => (
            <>
              <div className="panel-grid cols-2" style={{ marginBottom: 'var(--space-4)' }}>
                {baselines.map((b) => (
                  <div key={b.id} className="panel panel-raised">
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                      <h3 className="panel-title" style={{ margin: 0 }}>
                        {b.label}
                      </h3>
                      <Chip tone={b.status === 'active' ? 'info' : 'neutral'}>{b.status}</Chip>
                    </div>
                    <dl className="kv">
                      <dt>Published</dt>
                      <dd className="mono">{b.published}</dd>
                      <dt>Config items</dt>
                      <dd className="mono">{b.itemCount}</dd>
                      <dt>Notes</dt>
                      <dd>{b.notes}</dd>
                    </dl>
                  </div>
                ))}
              </div>
              <h3 className="section-header">Removed in 2.4.0 (exact revision set delta)</h3>
              <EvidenceTable
                label="Records removed in baseline 2.4.0"
                rows={removedIn240}
                columns={[idCol, titleCol('Removed record'), typeCol, revisionCol, { key: 'removal', label: 'Removal rationale', render: (r) => String(r.meta.removal ?? '—'), sortValue: (r) => String(r.meta.removal ?? '') }]}
                onOpen={() => {}}
                demo={ctx.demo}
              />
            </>
          ),
        },
        {
          key: 'config-items',
          label: 'Configuration Items',
          render: (ctx) => (
            <EvidenceTable
              label="Configuration items"
              rows={configItems}
              columns={[
                idCol,
                titleCol('Configuration item'),
                typeCol,
                revisionCol,
                {
                  key: 'hash',
                  label: 'SHA-256',
                  idCell: true,
                  render: (r) => <span title={r.hash}>{shortHash(r.hash)}</span>,
                  sortValue: (r) => r.hash,
                },
                statusCol,
                changeCol,
              ]}
              quickFilters={[
                { key: 'changed', label: 'Changed in 2.4.0', predicate: (r) => r.changeMark === 'changed' },
                { key: 'stale', label: 'Stale', predicate: (r) => r.status === 'stale' || r.reviewState === 'stale' },
              ]}
              activeQuickFilter={ctx.quickFilter}
              onQuickFilter={ctx.setQuickFilter}
              onOpen={ctx.openRecord}
              demo={ctx.demo}
              selectedId={ctx.selectedId}
            />
          ),
        },
        {
          key: 'changes',
          label: 'Change Records',
          render: (ctx) => (
            <ChangeTable
              label="Change records"
              records={changeRecords.filter((c) => c.kind === 'change')}
              onOpenEvidence={(id) => ctx.openRecord(id)}
            />
          ),
        },
        {
          key: 'problems',
          label: 'Problem Reports',
          render: (ctx) => (
            <ChangeTable
              label="Problem reports"
              records={changeRecords.filter((c) => c.kind === 'problem')}
              onOpenEvidence={(id) => ctx.openRecord(id)}
            />
          ),
        },
        {
          key: 'repro',
          label: 'Build Reproducibility',
          render: (ctx) => (
            <div className="table-shell standalone">
              <div className="table-scroll">
                <table className="data" aria-label="Build reproducibility checks">
                  <thead>
                    <tr>
                      <th>Check</th>
                      <th>Expected</th>
                      <th>Actual</th>
                      <th>Result</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reproChecks.map((c) => (
                      <tr key={c.step}>
                        <td style={{ whiteSpace: 'normal' }}>{c.step}</td>
                        <td className="id-cell">{c.expected}</td>
                        <td className="id-cell">{c.actual}</td>
                        <td>{c.match ? <Chip tone="success">Match</Chip> : <Chip tone="danger">Mismatch</Chip>}</td>
                        <td style={{ whiteSpace: 'normal' }}>{c.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="table-footer">
                <span>
                  {reproChecks.filter((c) => c.match).length}/{reproChecks.length} checks reproduce · mismatch chain:{' '}
                  <button type="button" className="btn btn-quiet btn-sm mono" style={{ padding: 0, height: 'auto' }} onClick={() => ctx.openRecord('RegressionResults_2_4_0')}>
                    RegressionResults_2_4_0
                  </button>{' '}
                  → PR-2026-003 → FND-006
                </span>
              </div>
            </div>
          ),
        },
      ]}
    />
  )
}

// ===== from views/QAView.tsx =====
// Quality Assurance: Audits, Reviews, Independence, Process Compliance,
// Open Actions. Featured: missing-independence review REV-2026-112 (FND-008).

export function QAView() {
  const independent = reviewRecords.filter((r) => r.independent).length
  return (
    <LifecyclePage
      phase="qa"
      intro="45 review records, process audits, independence coverage, and the open corrective-action register."
      subviews={[
        {
          key: 'audits',
          label: 'Audits',
          render: () => (
            <div className="table-shell standalone">
              <div className="table-scroll">
                <table className="data" aria-label="Process audits">
                  <thead>
                    <tr>
                      <th>Audit</th>
                      <th>Scope</th>
                      <th>Auditor</th>
                      <th>Date</th>
                      <th>Result</th>
                      <th className="num">Open actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditRecords.map((a) => (
                      <tr key={a.id}>
                        <td className="id-cell">{a.id}</td>
                        <td style={{ whiteSpace: 'normal' }}>{a.scope}</td>
                        <td>{a.auditor}</td>
                        <td className="id-cell">{a.date}</td>
                        <td>
                          <Chip tone={a.result === 'conformant' ? 'success' : a.result === 'observations' ? 'warning' : 'danger'}>{a.result}</Chip>
                        </td>
                        <td className="num">{a.openActions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="table-footer">
                <span>{auditRecords.length} audits across the lifecycle · 1 nonconformance (verification archiving)</span>
              </div>
            </div>
          ),
        },
        {
          key: 'reviews',
          label: 'Reviews',
          render: (ctx) => (
            <ReviewTable label="Review register" reviews={reviewRecords} onOpenSubject={(id) => ctx.openRecord(id)} />
          ),
        },
        {
          key: 'independence',
          label: 'Independence',
          render: (ctx) => (
            <div className="panel-grid cols-2">
              <div className="panel">
                <h3 className="panel-title">Independence coverage</h3>
                <Meter label="Independent reviews" value={independent} max={reviewRecords.length} valueText={`${independent}/${reviewRecords.length}`} tone={independent < reviewRecords.length ? 'warning' : undefined} />
                <p className="panel-sub" style={{ margin: 'var(--space-2) 0 0' }}>
                  Level B requires independence for requirement, design, and verification reviews. One violation is
                  open.
                </p>
                <h3 className="section-header">Violations</h3>
                <ul className="compare-list">
                  {reviewRecords
                    .filter((r) => !r.independent)
                    .map((r) => (
                      <li key={r.id}>
                        <span className="mono">{r.id}</span>
                        <button type="button" className="btn btn-quiet btn-sm mono" style={{ padding: 0, height: 'auto' }} onClick={() => ctx.openRecord(r.subjectId)}>
                          {r.subjectId}
                        </button>
                        <Chip tone="danger">FND-008</Chip>
                      </li>
                    ))}
                </ul>
              </div>
              <ChartPanel
                title="Review coverage by lifecycle phase"
                scope="45 seeded reviews, baseline 2.4.0"
                unit="reviews"
                legend={[{ label: 'Reviews recorded', tone: 'primary' }]}
                summary={<span>Verification and requirements carry the deepest review coverage; CM reviews focus on change records.</span>}
              >
                <BarChart
                  ariaLabel="Review count by phase"
                  unit=""
                  data={PHASES.map((p) => ({ label: PHASE_LABEL[p], value: reviewRecords.filter((r) => r.phase === p).length }))}
                />
              </ChartPanel>
            </div>
          ),
        },
        {
          key: 'compliance',
          label: 'Process Compliance',
          render: () => {
            const rows = [
              { area: 'Planning process', state: 'Compliant', note: 'Plans approved; TQP approval in progress.' },
              { area: 'Requirements process', state: 'Observations', note: 'Derived-requirement feedback gap (FND-001); trace gap (FND-002).' },
              { area: 'Design process (DO-331)', state: 'Observations', note: 'Stale data-dictionary review (FND-003).' },
              { area: 'Coding process', state: 'Compliant with deviation', note: 'DER-approved deviation DEV-2026-004 (FND-011).' },
              { area: 'Integration & verification', state: 'Nonconformance', note: 'Result archiving control failed (FND-006); robustness failure open (FND-005).' },
              { area: 'Configuration management', state: 'Observations', note: 'Unreverified change CR-2026-009 (FND-010).' },
              { area: 'Certification liaison', state: 'Observations', note: 'PSAC SCI reference obsolete (FND-009).' },
            ]
            return (
              <div className="table-shell standalone">
                <div className="table-scroll">
                  <table className="data" aria-label="Process compliance">
                    <thead>
                      <tr>
                        <th>Process area</th>
                        <th>State</th>
                        <th>Basis</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.area}>
                          <td>{r.area}</td>
                          <td>
                            <Chip tone={r.state === 'Compliant' ? 'success' : r.state === 'Nonconformance' ? 'danger' : 'warning'}>{r.state}</Chip>
                          </td>
                          <td style={{ whiteSpace: 'normal' }}>{r.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          },
        },
        {
          key: 'actions',
          label: 'Open Actions',
          render: () => (
            <div className="table-shell standalone">
              <div className="table-scroll">
                <table className="data" aria-label="Open audit and review actions">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Source</th>
                      <th>Description</th>
                      <th>Owner</th>
                      <th>Due</th>
                      <th>State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openActions.map((a) => (
                      <tr key={a.id}>
                        <td className="id-cell">{a.id}</td>
                        <td className="id-cell">{a.source}</td>
                        <td style={{ whiteSpace: 'normal' }}>{a.action}</td>
                        <td>{a.owner}</td>
                        <td className="id-cell">{a.due}</td>
                        <td>{a.overdue ? <Chip tone="danger">Overdue</Chip> : <Chip tone="warning">Open</Chip>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="table-footer">
                <span>
                  {openActions.length} open actions · {openActions.filter((a) => a.overdue).length} overdue
                </span>
              </div>
            </div>
          ),
        },
      ]}
    />
  )
}

// ===== from views/CertificationView.tsx =====
// Certification: Objective Matrix (configurable identifiers only), PSAC &
// Compliance, SAS, SCI, and Audit Packages (builder + register).

function PackagesSubview({ openRecord }: { openRecord: (id: string) => void }) {
  const { overlay } = useStore()
  const [builderOpen, setBuilderOpen] = useState(false)
  void openRecord
  return (
    <>
      <Watermark />
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        <button type="button" className="btn btn-primary" onClick={() => setBuilderOpen(true)}>
          Build audit package…
        </button>
      </div>
      <div className="table-shell standalone">
        <div className="table-scroll">
          <table className="data" aria-label="Audit package register">
            <thead>
              <tr>
                <th>Package</th>
                <th>Name</th>
                <th>Created</th>
                <th>Scope</th>
                <th className="num">Evidence</th>
                <th className="num">Findings</th>
                <th className="num">Reviews</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="id-cell">{seedPackage.id}</td>
                <td>
                  {seedPackage.name}
                  <span className="table-meta">Seeded sample package · synthetic watermark applied</span>
                </td>
                <td className="id-cell">{seedPackage.createdAt}</td>
                <td>{seedPackage.scopePhases.join(', ')}</td>
                <td className="num">{seedPackage.evidenceCount}</td>
                <td className="num">{seedPackage.findingCount}</td>
                <td className="num">{seedPackage.reviewCount}</td>
                <td>
                  <Chip tone="success">complete</Chip>
                </td>
              </tr>
              {overlay.packages.map((p) => (
                <tr key={p.id}>
                  <td className="id-cell">{p.id}</td>
                  <td>
                    {p.name}
                    <span className="table-meta">{p.watermark}</span>
                  </td>
                  <td className="id-cell">{p.createdAt}</td>
                  <td>{p.scopePhases.map((ph) => PHASE_LABEL[ph]).join(', ')}</td>
                  <td className="num">{p.evidenceCount}</td>
                  <td className="num">{p.findingIds.length}</td>
                  <td className="num">{p.reviewIds.length}</td>
                  <td>
                    <Chip tone={p.status === 'complete' ? 'success' : 'warning'}>{p.status}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>{1 + overlay.packages.length} packages · every sample export carries the synthetic watermark</span>
        </div>
      </div>
      {builderOpen ? <PackageBuilder onClose={() => setBuilderOpen(false)} /> : null}
    </>
  )
}

export function CertificationView() {
  const satisfied = objectiveRecords.filter((o) => o.status === 'satisfied').length
  return (
    <LifecyclePage
      phase="certification"
      intro="Objective satisfaction, PSAC compliance, SAS/SCI status, and reproducible audit package assembly. Objective identifiers are program-configurable; no licensed standard text is stored."
      subviews={[
        {
          key: 'objectives',
          label: 'Objective Matrix',
          render: (ctx) => (
            <>
              <div className="panel" style={{ marginBottom: 'var(--space-4)' }}>
                <h3 className="panel-title">Objective coverage</h3>
                <Meter label="Satisfied" value={satisfied} max={objectiveRecords.length} valueText={`${satisfied}/${objectiveRecords.length}`} />
                <Meter label="Partial (open findings)" value={objectiveRecords.filter((o) => o.status === 'partial').length} max={objectiveRecords.length} tone="warning" valueText={`${objectiveRecords.filter((o) => o.status === 'partial').length}`} />
              </div>
              <EvidenceTable
                label="Objective matrix"
                rows={objectiveRecords}
                columns={[idCol, titleCol('Objective (configurable identifier)'), metaCol('objectiveTable', 'Table'), statusCol, { key: 'links', label: 'Linked evidence', render: (r) => <span className="mono">{r.upstream.length} link(s)</span>, sortValue: (r) => r.upstream.length, numeric: true }, findingsCol]}
                quickFilters={[
                  { key: 'partial', label: 'Partial', predicate: (r) => r.status === 'partial' },
                  { key: 'satisfied', label: 'Satisfied', predicate: (r) => r.status === 'satisfied' },
                ]}
                activeQuickFilter={ctx.quickFilter}
                onQuickFilter={ctx.setQuickFilter}
                onOpen={ctx.openRecord}
                demo={ctx.demo}
                selectedId={ctx.selectedId}
              />
            </>
          ),
        },
        {
          key: 'psac',
          label: 'PSAC & Compliance',
          render: (ctx) => (
            <div className="panel-grid cols-2">
              <div className="panel">
                <h3 className="panel-title">PSAC status</h3>
                <dl className="kv">
                  <dt>Document</dt>
                  <dd>
                    <button type="button" className="btn btn-quiet btn-sm mono" style={{ padding: 0, height: 'auto' }} onClick={() => ctx.openRecord('PLN-PSAC')}>
                      PLN-PSAC
                    </button>{' '}
                    Rev E
                  </dd>
                  <dt>Software level</dt>
                  <dd>Level B · DO-331 model-based supplement applicable</dd>
                  <dt>Open compliance items</dt>
                  <dd>SCI reference obsolete (FND-009) · SAS draft in review</dd>
                </dl>
                <h3 className="section-header">Approved deviations</h3>
                <ul className="compare-list">
                  {deviationRows
                    .filter((d) => d.status === 'approved')
                    .map((d) => (
                      <li key={d.id}>
                        <span className="mono">{d.id}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{d.rule}</span>
                        {d.findingIds.length > 0 ? <Chip tone="warning">{d.findingIds.join(', ')}</Chip> : null}
                      </li>
                    ))}
                </ul>
              </div>
              <div className="panel">
                <h3 className="panel-title">Compliance summary</h3>
                <p className="panel-sub">Derived from the objective matrix and open findings.</p>
                <Meter label="Objectives satisfied" value={satisfied} max={objectiveRecords.length} valueText={`${Math.round((satisfied / objectiveRecords.length) * 100)}%`} />
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  Blocking items before submission: robustness failure (FND-005), coverage gap (FND-007), unreverified
                  change (FND-010). Remaining partials are editorial or in corrective action.
                </p>
              </div>
            </div>
          ),
        },
        {
          key: 'sas',
          label: 'SAS',
          render: (ctx) => (
            <EvidenceTable
              label="Software Accomplishment Summary"
              rows={certDocRecords.filter((r) => r.id === 'DOC-SAS')}
              columns={[idCol, titleCol('Document'), statusCol, metaCol('sections', 'Sections'), metaCol('openItems', 'Open items', { numeric: true }), metaCol('owner', 'Owner')]}
              onOpen={ctx.openRecord}
              onReview={ctx.review}
              demo={ctx.demo}
              selectedId={ctx.selectedId}
            />
          ),
        },
        {
          key: 'sci',
          label: 'SCI',
          render: (ctx) => (
            <>
              <p style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Software Configuration Index Rev E covers 531 items in baseline 2.4.0. FND-009 tracks the obsolete
                Rev C reference still present in the PSAC.
              </p>
              <EvidenceTable
                label="Software Configuration Index"
                rows={certDocRecords.filter((r) => r.id === 'DOC-SCI')}
                columns={[idCol, titleCol('Document'), statusCol, metaCol('itemCount', 'Items', { numeric: true }), metaCol('note', 'Note'), findingsCol]}
                onOpen={ctx.openRecord}
                onReview={ctx.review}
                demo={ctx.demo}
                selectedId={ctx.selectedId}
              />
            </>
          ),
        },
        {
          key: 'packages',
          label: 'Audit Packages',
          render: (ctx) => <PackagesSubview openRecord={(id) => ctx.openRecord(id)} />,
        },
      ]}
    />
  )
}

// ===== from views/FindingsView.tsx =====
// Findings register and workflow. Lifecycle: Create → Assigned →
// Dispositioned → Corrective Action → Ready for Closure → Reverified → Closed.
// FND-012 can be taken through reverification and closure with enforced
// evidence + independence; history is immutable and append-only.

function FindingDetail({ finding, onClose, onOpenEvidence }: { finding: Finding; onClose: () => void; onOpenEvidence: (id: string) => void }) {
  const { overlay, dispatch, announce, now, mergedFindings } = useStore()
  const merged = mergedFindings.find((f) => f.id === finding.id) ?? finding
  const overlayEntry = overlay.findingOverlays[finding.id]
  const attachedEvidence = overlayEntry?.reverificationEvidence ?? []
  const [note, setNote] = useState('')
  const [verifier, setVerifier] = useState('')
  const [error, setError] = useState<string | null>(null)

  const flowIdx = FINDING_FLOW.indexOf(merged.status)
  const nextStatus = FINDING_FLOW[flowIdx + 1]

  const doTransition = () => {
    if (nextStatus === undefined) return
    const check = checkTransition(merged, nextStatus, overlay, { independentCloser: verifier })
    if (!check.ok) {
      setError(check.reason ?? 'Transition rejected.')
      return
    }
    setError(null)
    dispatch({
      type: 'finding/transition',
      findingId: merged.id,
      to: nextStatus,
      actor: nextStatus === 'reverified' ? verifier.trim() : 'You (audit hub user)',
      at: now(),
      note: note.trim() === '' ? undefined : note.trim(),
      independentCloser: nextStatus === 'reverified' ? verifier.trim() : undefined,
      seedFinding: finding,
    })
    setNote('')
    announce(`${merged.id} moved to ${FINDING_STATUS_LABEL[nextStatus]}.`)
  }

  const attach = () => {
    dispatch({
      type: 'finding/attach-evidence',
      findingId: merged.id,
      evidence: REVERIFICATION_EVIDENCE,
      actor: 'You (audit hub user)',
      at: now(),
    })
    announce(`Deterministic reverification evidence attached to ${merged.id}.`)
  }

  return (
    <Drawer
      title={`${merged.id} — ${merged.title}`}
      subtitle={
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', padding: 'var(--space-2) 0' }}>
          <Chip tone={severityTone(merged.severity)}>Severity {merged.severity}</Chip>
          <Chip tone={findingStatusTone(merged.status)}>{FINDING_STATUS_LABEL[merged.status]}</Chip>
          <Chip tone="neutral">{PHASE_LABEL[merged.phase]}</Chip>
        </div>
      }
      onClose={onClose}
    >
      <p style={{ marginTop: 0 }}>{merged.detail}</p>
      <dl className="kv">
        <dt>Owner</dt>
        <dd>{merged.owner}</dd>
        <dt>Due</dt>
        <dd className="mono">{merged.due}</dd>
        <dt>Disposition</dt>
        <dd>{merged.disposition ?? '—'}</dd>
        <dt>Corrective action</dt>
        <dd>{merged.correctiveAction ?? '—'}</dd>
        <dt>Reverification</dt>
        <dd>{merged.reverificationPlan ?? '—'}</dd>
      </dl>

      <h3 className="section-header">Linked evidence</h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {merged.evidenceIds.map((id) => (
          <li key={id} style={{ padding: '2px 0' }}>
            {getEvidence(id) ? (
              <button type="button" className="btn btn-quiet btn-sm mono" onClick={() => onOpenEvidence(id)}>
                {id}
              </button>
            ) : (
              <span className="mono" style={{ color: 'var(--text-muted)' }}>
                {id} (assurance record)
              </span>
            )}
          </li>
        ))}
      </ul>

      <h3 className="section-header">Workflow</h3>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 var(--space-2)' }}>
        {FINDING_FLOW.map((s, i) => (
          <span key={s}>
            {i > 0 ? ' → ' : ''}
            <span style={{ color: i <= flowIdx ? 'var(--text-primary)' : undefined, fontWeight: s === merged.status ? 600 : 400 }}>
              {FINDING_STATUS_LABEL[s]}
            </span>
          </span>
        ))}
      </p>
      {error !== null ? (
        <Alert tone="danger" title="Transition rejected">
          {error}
        </Alert>
      ) : null}
      {merged.status === 'closed' ? (
        <Alert tone="success" title="Finding closed">
          History is immutable; no further transitions are possible.
        </Alert>
      ) : (
        <>
          {nextStatus === 'reverified' ? (
            <>
              <div className="inset" style={{ marginBottom: 'var(--space-2)' }}>
                <b style={{ fontSize: 'var(--text-sm)' }}>Reverification evidence ({attachedEvidence.length} attached)</b>
                {attachedEvidence.length === 0 ? (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 'var(--space-1) 0' }}>
                    Closure requires attached reverification evidence and an independent verifier.
                  </p>
                ) : (
                  <ul style={{ margin: 'var(--space-1) 0', paddingLeft: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
                    {attachedEvidence.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                )}
                <button type="button" className="btn btn-sm" onClick={attach} disabled={attachedEvidence.length >= REVERIFICATION_EVIDENCE.length}>
                  {attachedEvidence.length > 0 ? 'Evidence attached' : 'Attach reverification evidence'}
                </button>
              </div>
              <Field label="Independent verifier" id="fnd-verifier" hint={`Must differ from the owner (${merged.owner})`}>
                <input id="fnd-verifier" className="input" list="fnd-people" value={verifier} onChange={(e) => setVerifier(e.target.value)} style={{ width: 220 }} />
              </Field>
              <datalist id="fnd-people">
                {PEOPLE.filter((p) => p !== merged.owner).map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </>
          ) : null}
          <Field label="Transition note (recorded in history)" id="fnd-note" hint="Optional">
            <textarea id="fnd-note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {nextStatus !== undefined ? (
            <button type="button" className="btn btn-primary" onClick={doTransition}>
              Move to {FINDING_STATUS_LABEL[nextStatus]}
            </button>
          ) : null}
        </>
      )}

      <h3 className="section-header">History (immutable, append-only)</h3>
      <ul className="timeline">
        {merged.history.map((h, i) => (
          <li key={i}>
            <span className="t-at">{h.at}</span>
            <span>{h.actor}</span>
            <span>
              <b>{h.action}</b>
              {h.note !== undefined ? <span style={{ color: 'var(--text-muted)' }}> — {h.note}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </Drawer>
  )
}

export function FindingsView() {
  const { params, setParams, navigate } = useRoute()
  const { mergedFindings } = useStore()
  const demo = demoStateOf(params)
  const selectedId = params.get('select')
  const selected = mergedFindings.find((f) => f.id === selectedId)
  const [severityFilter, setSeverityFilter] = useState<string | null>(null)

  const rows = severityFilter === null ? mergedFindings : mergedFindings.filter((f) => f.severity === severityFilter)

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Findings</h1>
          <p className="page-subtitle">
            12 seeded findings across the lifecycle. Transitions are hub-local overlay state on immutable seeded
            history.
          </p>
        </div>
      </header>
      <div className="stat-row" role="group" aria-label="Finding summary">
        <span className="stat">
          Open <b>{mergedFindings.filter((f) => f.status !== 'closed').length}</b>
        </span>
        <span className="stat">
          High severity <b>{mergedFindings.filter((f) => f.severity === 'high' && f.status !== 'closed').length}</b>
        </span>
        <span className="stat">
          Ready for closure <b>{mergedFindings.filter((f) => f.status === 'ready-for-closure').length}</b>
        </span>
        <span className="stat">
          Closed <b>{mergedFindings.filter((f) => f.status === 'closed').length}</b>
        </span>
      </div>
      <div className="table-shell">
        <div className="table-toolbar">
          {['high', 'medium', 'low'].map((s) => (
            <button key={s} type="button" className="filter-chip" aria-pressed={severityFilter === s} onClick={() => setSeverityFilter(severityFilter === s ? null : s)}>
              {s} ({mergedFindings.filter((f) => f.severity === s).length})
            </button>
          ))}
        </div>
        {demo === 'loading' ? (
          <SkeletonRows rows={8} />
        ) : (
          <div className="table-scroll">
            <table className="data" aria-label="Findings register">
              <thead>
                <tr>
                  <th>Finding</th>
                  <th>Title</th>
                  <th>Severity</th>
                  <th>Phase</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Due</th>
                  <th>Linked evidence</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => (
                  <tr
                    key={f.id}
                    className="row"
                    tabIndex={0}
                    aria-selected={selectedId === f.id}
                    onClick={() => setParams({ select: f.id })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setParams({ select: f.id })
                      }
                    }}
                  >
                    <td className="id-cell">{f.id}</td>
                    <td>
                      {f.title}
                      <span className="table-meta">{f.detail.slice(0, 96)}…</span>
                    </td>
                    <td>
                      <Chip tone={severityTone(f.severity)}>{f.severity}</Chip>
                    </td>
                    <td>{PHASE_LABEL[f.phase]}</td>
                    <td>
                      <Chip tone={findingStatusTone(f.status)}>{FINDING_STATUS_LABEL[f.status]}</Chip>
                    </td>
                    <td>{f.owner}</td>
                    <td className="id-cell">{f.due}</td>
                    <td className="id-cell">{f.evidenceIds.slice(0, 2).join(', ')}{f.evidenceIds.length > 2 ? ` +${f.evidenceIds.length - 2}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-footer">
          <span>{rows.length} findings shown</span>
        </div>
      </div>
      {selected ? (
        <FindingDetail
          finding={selected}
          onClose={() => setParams({ select: null })}
          onOpenEvidence={(id) => {
            const rec = getEvidence(id)
            if (rec) navigate([rec.phase], { select: id })
          }}
        />
      ) : null}
    </div>
  )
}

// ===== from views/UtilityViews.tsx =====
// Utility views: Reviews register, Audit Packages, and the Activity timeline.

export function ReviewsView() {
  const { navigate } = useRoute()
  const { overlay } = useStore()
  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Reviews</h1>
          <p className="page-subtitle">
            {reviewRecords.length} seeded review records plus {overlay.recordedReviews.length} hub-local recorded
            review(s).
          </p>
        </div>
      </header>
      {overlay.recordedReviews.length > 0 ? (
        <>
          <h3 className="section-header">Recorded in this hub (overlay)</h3>
          <div className="table-shell standalone" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="table-scroll">
              <table className="data" aria-label="Hub-local reviews">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Subject</th>
                    <th>Reviewer</th>
                    <th>Method</th>
                    <th>Date</th>
                    <th>Result</th>
                    <th>Independence</th>
                    <th>Comments</th>
                  </tr>
                </thead>
                <tbody>
                  {overlay.recordedReviews.map((rv) => (
                    <tr key={rv.id}>
                      <td className="id-cell">{rv.id}</td>
                      <td className="id-cell">{rv.subjectId}</td>
                      <td>{rv.reviewer}</td>
                      <td>{rv.method}</td>
                      <td className="id-cell">{rv.date}</td>
                      <td>
                        <Chip tone={rv.result === 'passed' ? 'success' : rv.result === 'failed' ? 'danger' : 'warning'}>{rv.result}</Chip>
                      </td>
                      <td>{rv.independent ? 'Independent' : 'Not independent'}</td>
                      <td style={{ whiteSpace: 'normal' }}>{rv.comments}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
      <h3 className="section-header">Seeded review register</h3>
      <ReviewTable
        label="All reviews"
        reviews={reviewRecords}
        onOpenSubject={(id) => {
          const rec = getEvidence(id)
          if (rec) navigate([rec.phase], { select: id })
        }}
      />
    </div>
  )
}

export function PackagesView() {
  const { overlay } = useStore()
  const [builderOpen, setBuilderOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Audit Packages</h1>
          <p className="page-subtitle">Reproducible evidence packages with exact revisions and SHA-256 hashes.</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary" onClick={() => setBuilderOpen(true)}>
            Build audit package…
          </button>
        </div>
      </header>
      <Watermark />
      <div className="panel" style={{ marginBottom: 'var(--space-4)' }}>
        <h3 className="panel-title">
          {seedPackage.id} — {seedPackage.name}
        </h3>
        <p className="panel-sub">
          Seeded sample package · {seedPackage.createdAt} · {seedPackage.evidenceCount} evidence items ·{' '}
          {seedPackage.findingCount} findings · {seedPackage.reviewCount} reviews · scope{' '}
          {seedPackage.scopePhases.join(', ')}.
        </p>
        <Chip tone="success">complete</Chip>
      </div>
      {overlay.packages.length === 0 ? (
        <div className="panel">
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            No hub-local packages yet — build one to see progress, manifest, hashes, and the synthetic watermark.
          </p>
        </div>
      ) : (
        overlay.packages.map((p) => (
          <div key={p.id} className="panel" style={{ marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
              <h3 className="panel-title" style={{ margin: 0 }}>
                {p.id} — {p.name}
              </h3>
              <Chip tone={p.status === 'complete' ? 'success' : 'warning'}>{p.status}</Chip>
              <span style={{ marginLeft: 'auto', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{fmtDateTime(p.createdAt)}</span>
            </div>
            <p className="panel-sub" style={{ margin: 'var(--space-1) 0' }}>
              {p.evidenceCount} evidence · {p.findingIds.length} findings · {p.reviewIds.length} reviews · scope{' '}
              {p.scopePhases.map((ph) => PHASE_LABEL[ph]).join(', ')} · {p.watermark}
            </p>
            <button type="button" className="btn btn-sm" onClick={() => setExpanded(expanded === p.id ? null : p.id)} aria-expanded={expanded === p.id}>
              {expanded === p.id ? 'Hide manifest' : `Show manifest (${p.manifest.length} entries)`}
            </button>
            {expanded === p.id ? (
              <div className="table-scroll" style={{ marginTop: 'var(--space-2)' }}>
                <table className="data" aria-label={`Manifest for ${p.id}`}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Revision</th>
                      <th>SHA-256</th>
                      <th>Source path</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.manifest.slice(0, 20).map((m) => (
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
                {p.manifest.length > 20 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: 'var(--space-2)' }}>
                    + {p.manifest.length - 20} more entries in the stored manifest.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ))
      )}
      {builderOpen ? <PackageBuilder onClose={() => setBuilderOpen(false)} /> : null}
    </div>
  )
}

export function ActivityView() {
  const { overlay } = useStore()
  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Activity</h1>
          <p className="page-subtitle">
            Global hub-local timeline: sample resets, finding transitions, reviews, packages, baseline changes, and
            refreshes.
          </p>
        </div>
      </header>
      <div className="panel">
        <ul className="timeline">
          {overlay.activity.map((e) => (
            <li key={e.id}>
              <span className="t-at">{fmtDateTime(e.at)}</span>
              <span>
                <Chip tone="neutral">{e.kind}</Chip>
              </span>
              <span>{e.message}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ===== from App.tsx =====
// Root routing: nine lifecycle areas plus the four utility views, wrapped in
// the shell with the global search overlay. First load with no configured
// project opens the AeroNav sample on baseline 2.4.0 (no onboarding dead end).

function CurrentView({ area }: { area: string }) {
  switch (area) {
    case 'planning':
      return <PlanningView />
    case 'requirements':
      return <RequirementsView />
    case 'design':
      return <DesignView />
    case 'implementation':
      return <ImplementationView />
    case 'verification':
      return <VerificationView />
    case 'cm':
      return <CMView />
    case 'qa':
      return <QAView />
    case 'certification':
      return <CertificationView />
    case 'findings':
      return <FindingsView />
    case 'reviews':
      return <ReviewsView />
    case 'packages':
      return <PackagesView />
    case 'activity':
      return <ActivityView />
    default:
      return <OverviewView />
  }
}

export function App() {
  const { path, params, setParams, navigate } = useRoute()
  const area = path[0] ?? 'overview'
  useStore() // ensures the provider is mounted above; sample auto-initializes

  return (
    <Shell>
      <CurrentView area={area} />
      {params.get('search') === '1' ? (
        <SearchOverlay
          initialQuery={params.get('q') ?? ''}
          onClose={() => setParams({ search: null, q: null })}
          onOpen={(record) => navigate([record.phase], { select: record.id, itab: 'trace' })}
        />
      ) : null}
    </Shell>
  )
}
