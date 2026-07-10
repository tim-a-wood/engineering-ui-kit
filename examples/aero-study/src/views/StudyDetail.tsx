/**
 * Study detail: the configurable chart (axis pickers, reference line,
 * crossover markers, crosshair readout), a synced text-alternative rail,
 * and the per-series analysis panel with a plain-English finding.
 */

import { useMemo, useState } from 'react'
import type { Study } from '../../shared/model'
import { expandStudy } from '../../shared/model'
import { AXIS_FIELDS, axisField, SWEEP_TO_AXIS, type AxisFieldKey } from '../../shared/fields'
import { formatValue, statusLabel } from '../../shared/format'
import { href } from '../router'
import { StudyChart, seriesClass, type Reference } from '../chart/StudyChart'
import { summarizeSeries, toPlotSeries } from '../chart/analysis'

export function StudyDetail(props: { id: string; studies: Study[]; online: boolean; refresh: () => Promise<void> }) {
  const study = props.studies.find((s) => s.id === props.id)
  if (!study) {
    return (
      <div className="remote-state" role="alert">
        <strong>Study not found</strong>
        <span>It may have been removed, or the link is stale.</span>
        <a className="button secondary" href={href.list}>Back to studies</a>
      </div>
    )
  }
  return <DetailBody study={study} />
}

function DetailBody({ study }: { study: Study }) {
  const defaultX = SWEEP_TO_AXIS[study.sweep.field] ?? 'weightLb'
  const [xKey, setXKey] = useState<AxisFieldKey>(defaultX)
  const [yKey, setYKey] = useState<AxisFieldKey>('requiredRunwayFt')
  const [activeSeries, setActiveSeries] = useState(0)

  const series = useMemo(() => expandStudy(study), [study])
  const plot = useMemo(() => toPlotSeries(series, xKey, yKey), [series, xKey, yKey])
  const fx = axisField(xKey)
  const fy = axisField(yKey)

  // Reference lines per §3: available runway when plotting required runway,
  // the zero line when plotting margin — these carry the tradeoff.
  const reference: Reference | null = yKey === 'requiredRunwayFt'
    ? { value: study.baseline.runwayLengthFt, label: `Available ${formatValue(study.baseline.runwayLengthFt, 'ft')}` }
    : yKey === 'runwayMarginFt'
      ? { value: 0, label: 'Zero margin' }
      : null

  const summaries = useMemo(
    () => plot.map((s) => summarizeSeries(s, reference?.value)),
    [plot, reference?.value],
  )

  const finding = useMemo(() => {
    if (!reference) return `Plotting ${fy.label.toLowerCase()} against ${fx.label.toLowerCase()} — pick required runway or margin on Y to read limiting values.`
    const parts = summaries.map((s) => s.crossover !== undefined
      ? `${s.label}: limit at ${formatValue(s.crossover, fx.unit)}`
      : `${s.label}: no crossover in range`)
    return parts.join('; ')
  }, [summaries, reference, fx, fy])

  const rail = plot[activeSeries] ?? plot[0]

  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">Trade study</span>
          <h1>{study.name}</h1>
          <p>{study.notes || 'No notes.'} <span className="muted-inline">Baseline: {study.baseline.variant} · {study.baseline.operation} · {study.baseline.runwayId} · {formatValue(study.baseline.runwayLengthFt, 'ft')} available.</span></p>
        </div>
        <div className="page-actions">
          <a className="button secondary" href={href.list}>Back</a>
          <a className="button primary" href={href.edit(study.id)}>Edit study</a>
        </div>
      </header>

      <section className="page-section">
        <div className="section-header">
          <div><span className="eyebrow">Study chart</span><h2>{fy.label} vs {fx.label.toLowerCase()}</h2></div>
          <div className="axis-controls">
            <div className="field-inline">
              <label htmlFor="axis-x">X axis</label>
              <select id="axis-x" value={xKey} onChange={(e) => setXKey(e.target.value as AxisFieldKey)}>
                {AXIS_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label} ({f.unit})</option>)}
              </select>
            </div>
            <div className="field-inline">
              <label htmlFor="axis-y">Y axis</label>
              <select id="axis-y" value={yKey} onChange={(e) => setYKey(e.target.value as AxisFieldKey)}>
                {AXIS_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label} ({f.unit})</option>)}
              </select>
            </div>
          </div>
        </div>

        <ul className="chart-legend" aria-label="Chart legend">
          {plot.map((s, i) => (
            <li key={s.key}>
              <button
                type="button"
                className={i === activeSeries ? 'legend-chip active' : 'legend-chip'}
                onClick={() => setActiveSeries(i)}
                title="Show this series in the synced rail"
              >
                <span className={`legend-line ${seriesClass(i)}`} aria-hidden="true" /> {s.label}
              </button>
            </li>
          ))}
          {reference && <li className="legend-static"><span className="legend-ref" aria-hidden="true" /> {reference.label}</li>}
          <li className="legend-static"><span className="legend-cross" aria-hidden="true" /> Crossover (limiting value)</li>
        </ul>

        <div className="chart-rail-layout">
          <StudyChart series={plot} xKey={xKey} yKey={yKey} reference={reference} />
          <div className="synced-rail" aria-label={`Synced values — ${rail?.label ?? 'series'}`}>
            <div className="rail-header">
              <span className="eyebrow">Text alternative</span>
              <strong>{rail?.label}</strong>
            </div>
            <ol className="synced-list">
              {(rail?.points ?? []).map((p, i) => (
                <li key={i} className="synced-row static">
                  <span className="synced-top">
                    <span className="synced-label">{fx.short} {formatValue(p.x, fx.unit)}</span>
                    <span className={`synced-status synced-${p.status}`}>{statusLabel(p.status)}</span>
                  </span>
                  <span className="synced-values">{fy.short} {formatValue(p.y, fy.unit)}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="section-header">
          <div><span className="eyebrow">Study analysis</span><h2>Per-series tradeoffs</h2></div>
          <span className="panel-meta">{reference ? reference.label : 'No reference for this Y axis'}</span>
        </div>
        <p className="finding">{finding}</p>
        <div className="table-surface table-scroll">
          <table className="registry-table">
            <caption className="sr-only">Per-series analysis</caption>
            <thead>
              <tr>
                <th>Series</th>
                <th className="numeric">{fy.short} min</th>
                <th className="numeric">{fy.short} max</th>
                <th>Crossover ({fx.unit})</th>
                <th>Worst status</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s, i) => (
                <tr key={s.key}>
                  <td className="nowrap"><span className={`legend-line ${seriesClass(i)}`} aria-hidden="true" /> {s.label}</td>
                  <td className="numeric">{formatValue(s.yMin, fy.unit)}</td>
                  <td className="numeric">{formatValue(s.yMax, fy.unit)}</td>
                  <td className="nowrap">{s.crossover !== undefined ? formatValue(s.crossover, fx.unit) : 'No crossover in range'}</td>
                  <td><span className={`status-badge status-${s.worst}`}>{statusLabel(s.worst)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
