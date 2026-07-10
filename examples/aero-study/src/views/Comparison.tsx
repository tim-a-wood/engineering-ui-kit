/**
 * Multi-study comparison: overlays one representative series from each
 * selected study on a single configurable chart, with the same analysis
 * summary per curve.
 */

import { useMemo, useState } from 'react'
import type { Study } from '../../shared/model'
import { expandStudy } from '../../shared/model'
import { AXIS_FIELDS, axisField, SWEEP_TO_AXIS, type AxisFieldKey } from '../../shared/fields'
import { formatValue, statusLabel } from '../../shared/format'
import { href } from '../router'
import { StudyChart, seriesClass } from '../chart/StudyChart'
import { summarizeSeries, toPlotSeries, type PlotSeries } from '../chart/analysis'

export function Comparison(props: { ids: string[]; studies: Study[] }) {
  const chosen = props.ids
    .map((id) => props.studies.find((s) => s.id === id))
    .filter((s): s is Study => Boolean(s))

  const defaultX = chosen[0] ? SWEEP_TO_AXIS[chosen[0].sweep.field] ?? 'weightLb' : 'weightLb'
  const [xKey, setXKey] = useState<AxisFieldKey>(defaultX)
  const [yKey, setYKey] = useState<AxisFieldKey>('runwayMarginFt')

  const plot: PlotSeries[] = useMemo(() => chosen.map((study) => {
    const first = toPlotSeries(expandStudy(study), xKey, yKey)[0]
    return {
      key: study.id,
      label: first && first.label !== 'Baseline' ? `${study.name} — ${first.label}` : study.name,
      points: first?.points ?? [],
    }
  }), [chosen, xKey, yKey])

  const fx = axisField(xKey)
  const fy = axisField(yKey)
  const reference = yKey === 'runwayMarginFt' ? { value: 0, label: 'Zero margin' } : null
  const summaries = useMemo(() => plot.map((s) => summarizeSeries(s, reference?.value)), [plot, reference?.value])

  if (chosen.length < 2) {
    return (
      <div className="remote-state" role="alert">
        <strong>Pick at least two studies to compare</strong>
        <span>Select studies in the registry, then open the comparison.</span>
        <a className="button secondary" href={href.list}>Back to studies</a>
      </div>
    )
  }

  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">Multi-study comparison</span>
          <h1>Overlay — {chosen.length} studies</h1>
          <p>One representative curve per study (its first series), on shared axes. Sweeps over different variables still plot against the chosen X field.</p>
        </div>
        <div className="page-actions">
          <a className="button secondary" href={href.list}>Back to studies</a>
        </div>
      </header>

      <section className="page-section">
        <div className="section-header">
          <div><span className="eyebrow">Comparison chart</span><h2>{fy.label} vs {fx.label.toLowerCase()}</h2></div>
          <div className="axis-controls">
            <div className="field-inline">
              <label htmlFor="cmp-x">X axis</label>
              <select id="cmp-x" value={xKey} onChange={(e) => setXKey(e.target.value as AxisFieldKey)}>
                {AXIS_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label} ({f.unit})</option>)}
              </select>
            </div>
            <div className="field-inline">
              <label htmlFor="cmp-y">Y axis</label>
              <select id="cmp-y" value={yKey} onChange={(e) => setYKey(e.target.value as AxisFieldKey)}>
                {AXIS_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label} ({f.unit})</option>)}
              </select>
            </div>
          </div>
        </div>

        <ul className="chart-legend" aria-label="Chart legend">
          {plot.map((s, i) => (
            <li key={s.key} className="legend-static">
              <span className={`legend-line ${seriesClass(i)}`} aria-hidden="true" /> {s.label}
            </li>
          ))}
          {reference && <li className="legend-static"><span className="legend-ref" aria-hidden="true" /> {reference.label}</li>}
        </ul>

        <StudyChart series={plot} xKey={xKey} yKey={yKey} reference={reference} />
      </section>

      <section className="page-section">
        <div className="section-header">
          <div><span className="eyebrow">Comparison analysis</span><h2>Per-study tradeoffs</h2></div>
        </div>
        <div className="table-surface table-scroll">
          <table className="registry-table">
            <caption className="sr-only">Per-study comparison analysis</caption>
            <thead>
              <tr>
                <th>Study curve</th>
                <th className="numeric">{fy.short} min</th>
                <th className="numeric">{fy.short} max</th>
                <th>Crossover ({fx.unit})</th>
                <th>Worst status</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s, i) => (
                <tr key={s.key}>
                  <td className="case-cell">
                    <span className="nowrap"><span className={`legend-line ${seriesClass(i)}`} aria-hidden="true" /> {s.label}</span>
                  </td>
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
