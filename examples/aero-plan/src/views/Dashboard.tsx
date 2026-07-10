/**
 * Fleet dashboard: one slim stat row (no tiles) over the priority review
 * table, worst first, each row linking into its case.
 */

import { useMemo } from 'react'
import type { PerformanceCase, Status } from '../../shared/model'
import { computeOutputs } from '../../shared/model'
import { formatInt, formatSigned, statusLabel } from '../../shared/format'
import { href } from '../router'

const RANK: Record<Status, number> = { 'out-of-limits': 0, caution: 1, 'within-limits': 2 }

export function Dashboard(props: { cases: PerformanceCase[] }) {
  const rows = useMemo(() => props.cases
    .map((c) => ({ case: c, outputs: computeOutputs(c.inputs) }))
    .sort((a, b) => RANK[a.outputs.status] - RANK[b.outputs.status] || a.outputs.runwayMarginFt - b.outputs.runwayMarginFt),
  [props.cases])

  const out = rows.filter((r) => r.outputs.status === 'out-of-limits').length
  const caution = rows.filter((r) => r.outputs.status === 'caution').length
  const thinnest = rows[0]

  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">Fleet overview</span>
          <h1>Performance review dashboard</h1>
          <p>Review limiting cases before a charter quote or airfield study proceeds.</p>
        </div>
        <div className="page-actions">
          <a className="button primary" href={href.calculator}>New case</a>
        </div>
      </header>

      <p className="summary-bar" aria-label="Fleet status summary">
        <span>Cases <strong>{rows.length}</strong></span>
        <span>Out of limits <strong className={out ? 'value-danger' : 'value-success'}>{out}</strong></span>
        <span>Caution <strong className={caution ? 'value-warning' : 'value-success'}>{caution}</strong></span>
        {thinnest && <span>Thinnest margin <strong className={thinnest.outputs.runwayMarginFt < 0 ? 'value-danger' : 'value-warning'}>{formatSigned(thinnest.outputs.runwayMarginFt)} ft</strong> — {thinnest.case.label}</span>}
      </p>

      <section className="page-section">
        <div className="section-header">
          <div><span className="eyebrow">Priority queue</span><h2>Cases requiring review</h2></div>
          <span className="panel-meta">Worst status, then thinnest margin</span>
        </div>
        {rows.length === 0 ? (
          <div className="remote-state"><strong>No saved cases yet</strong><span>Plan a case in the calculator to populate the dashboard.</span><a className="button primary" href={href.calculator}>New case</a></div>
        ) : (
          <div className="table-surface table-scroll">
            <table className="registry-table">
              <caption className="sr-only">Priority review, worst first</caption>
              <thead>
                <tr>
                  <th>Case</th>
                  <th className="numeric">Weight</th>
                  <th className="numeric">Required</th>
                  <th className="numeric">Margin</th>
                  <th>Limiting factor</th>
                  <th>Status</th>
                  <th><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map(({ case: c, outputs }) => (
                  <tr key={c.id}>
                    <td className="case-cell">
                      <a className="row-link" href={href.editCase(c.id)} title={c.label}>{c.label}</a>
                      <small>{c.inputs.variant} · {c.inputs.operation} · {c.inputs.runwayId}</small>
                    </td>
                    <td className="numeric">{formatInt(c.inputs.weightLb)} lb</td>
                    <td className="numeric">{formatInt(outputs.requiredRunwayFt)} ft</td>
                    <td className="numeric">{formatSigned(outputs.runwayMarginFt)} ft</td>
                    <td className="nowrap cell-muted">{outputs.limitingFactor}</td>
                    <td><span className={`status-badge status-${outputs.status}`}>{statusLabel(outputs.status)}</span></td>
                    <td className="cell-actions"><a className="table-action" href={href.editCase(c.id)}>Open case</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
