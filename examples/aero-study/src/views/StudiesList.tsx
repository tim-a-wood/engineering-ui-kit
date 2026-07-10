/**
 * Landing page: instrument strip over a dense study registry table, worst
 * first; multi-select feeds the comparison view; duplicate/edit per row.
 */

import { useMemo, useState } from 'react'
import type { Status, Study } from '../../shared/model'
import { expandStudy } from '../../shared/model'
import { axisField, SWEEP_TO_AXIS } from '../../shared/fields'
import { formatValue, statusLabel } from '../../shared/format'
import { duplicateStudy } from '../api'
import { href, navigate } from '../router'
import { summarizeSeries, toPlotSeries } from '../chart/analysis'

const STATUS_RANK: Record<Status, number> = { 'within-limits': 0, caution: 1, 'out-of-limits': 2 }

const SWEEP_LABEL: Record<Study['sweep']['field'], string> = {
  weightLb: 'Weight',
  pressureAltitudeFt: 'Pressure altitude',
  oatC: 'OAT',
  windKt: 'Wind',
  runwayLengthFt: 'Available runway',
}

const COMPARE_LABEL: Record<Study['compareBy'], string> = {
  none: 'no compare',
  variant: 'by variant',
  runwayCondition: 'by runway condition',
  flapSetting: 'by flap',
  operation: 'by operation',
}

interface StudyDigest {
  study: Study
  seriesCount: number
  pointCount: number
  worst: Status
  limiting: string
}

function digest(study: Study): StudyDigest {
  const series = expandStudy(study)
  const xKey = SWEEP_TO_AXIS[study.sweep.field] ?? 'weightLb'
  const plot = toPlotSeries(series, xKey, 'runwayMarginFt')
  const fx = axisField(xKey)
  let worst: Status = 'within-limits'
  let limiting = 'No crossover in range'
  for (const s of plot) {
    const summary = summarizeSeries(s, 0)
    if (STATUS_RANK[summary.worst] > STATUS_RANK[worst]) worst = summary.worst
    if (summary.crossover !== undefined && limiting === 'No crossover in range') {
      limiting = `${s.label}: margin = 0 at ${formatValue(summary.crossover, fx.unit)}`
    }
  }
  return {
    study,
    seriesCount: series.length,
    pointCount: series.reduce((sum, s) => sum + s.points.length, 0),
    worst,
    limiting,
  }
}

export function StudiesList(props: { studies: Study[]; online: boolean; refresh: () => Promise<void> }) {
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const digests = useMemo(
    () => props.studies.map(digest).sort((a, b) => STATUS_RANK[b.worst] - STATUS_RANK[a.worst]),
    [props.studies],
  )

  const outCount = digests.filter((d) => d.worst === 'out-of-limits').length
  const reviewCount = digests.filter((d) => d.worst !== 'within-limits').length
  const totalPoints = digests.reduce((sum, d) => sum + d.pointCount, 0)

  const toggle = (id: string) => {
    setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }

  const duplicate = async (id: string) => {
    setBusy(id)
    setError(null)
    try {
      const copy = await duplicateStudy(id)
      await props.refresh()
      navigate(href.edit(copy.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">Study registry</span>
          <h1>Performance trade studies</h1>
          <p>Multi-case sweeps with compare dimensions; worst studies first. Select two or more to overlay them.</p>
        </div>
        <div className="page-actions">
          <a
            className={selected.length >= 2 ? 'button secondary' : 'button secondary disabled-link'}
            aria-disabled={selected.length < 2}
            href={selected.length >= 2 ? href.compare(selected) : undefined}
          >
            Compare selected ({selected.length})
          </a>
          <a className="button primary" href={href.create}>New study</a>
        </div>
      </header>

      <section className="summary-bar" aria-label="Study status summary">
        <span>Studies <strong>{digests.length}</strong> · {totalPoints.toLocaleString('en-US')} computed cases</span>
        <span>Out of limits <strong className={outCount ? 'value-danger' : 'value-success'}>{outCount}</strong></span>
        <span>Needs review <strong className={reviewCount ? 'value-warning' : 'value-success'}>{reviewCount}</strong></span>
      </section>

      {error && <div className="alert danger" role="alert">{error}</div>}

      <section className="page-section">
        <div className="section-header">
          <div><span className="eyebrow">Registry view</span><h2>Studies</h2></div>
          <span className="panel-meta">Worst status first · numerics in planning units</span>
        </div>
        {digests.length === 0 ? (
          <div className="remote-state"><strong>No studies yet</strong><span>Create the first study to start a tradeoff.</span><a className="button primary" href={href.create}>New study</a></div>
        ) : (
          <div className="table-surface table-scroll">
            <table className="registry-table">
              <caption className="sr-only">Saved trade studies, worst status first</caption>
              <thead>
                <tr>
                  <th className="cell-check"><span className="sr-only">Select for comparison</span></th>
                  <th>Study</th>
                  <th>Varies</th>
                  <th className="numeric">Series</th>
                  <th className="numeric">Points</th>
                  <th>Headline tradeoff</th>
                  <th>Worst status</th>
                  <th>Updated</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {digests.map(({ study, seriesCount, pointCount, worst, limiting }) => (
                  <tr key={study.id}>
                    <td className="cell-check">
                      <input
                        type="checkbox"
                        checked={selected.includes(study.id)}
                        aria-label={`Select ${study.name} for comparison`}
                        onChange={() => toggle(study.id)}
                      />
                    </td>
                    <td className="case-cell">
                      <a className="row-link" href={href.detail(study.id)} title={study.name}>{study.name}</a>
                      <small>{study.baseline.variant} · {study.baseline.operation} · {study.baseline.runwayId}</small>
                    </td>
                    <td className="nowrap">{SWEEP_LABEL[study.sweep.field]} · {COMPARE_LABEL[study.compareBy]}</td>
                    <td className="numeric">{seriesCount}</td>
                    <td className="numeric">{pointCount}</td>
                    <td className="limiting-cell" title={limiting}><span>{limiting}</span></td>
                    <td><span className={`status-badge status-${worst}`}>{statusLabel(worst)}</span></td>
                    <td className="nowrap muted-cell">{new Date(study.updatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                    <td className="cell-actions">
                      <a className="table-action" href={href.edit(study.id)}>Edit</a>
                      <button
                        type="button"
                        className="table-action"
                        disabled={!props.online || busy === study.id}
                        title={props.online ? 'Duplicate as a starting point for a variant' : 'Offline — duplication is disabled'}
                        onClick={() => void duplicate(study.id)}
                      >
                        {busy === study.id ? 'Copying…' : 'Duplicate'}
                      </button>
                    </td>
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
