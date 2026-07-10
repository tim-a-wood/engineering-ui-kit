/**
 * Saved cases registry: dense one-line-row table (meta line for config ·
 * runway) with filters/search/sort, a synchronized XY chart view, selection
 * of exactly two cases for the diff comparison, and per-row edit/duplicate.
 */

import { useMemo, useState } from 'react'
import type { PerformanceCase, Status, Variant } from '../../shared/model'
import { computeOutputs, VARIANTS } from '../../shared/model'
import { formatInt, formatSigned, statusLabel } from '../../shared/format'
import { duplicateCase } from '../api'
import { href } from '../router'
import { buildSeries, CasesChart, seriesClass } from '../chart/CasesChart'

type StatusFilter = 'all' | Status
type OpFilter = 'all' | 'takeoff' | 'landing'
type SortKey = 'margin' | 'updated'

export function Cases(props: { cases: PerformanceCase[]; online: boolean; refresh: () => Promise<void> }) {
  const [query, setQuery] = useState('')
  const [variant, setVariant] = useState<'all' | Variant>('all')
  const [operation, setOperation] = useState<OpFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sortBy, setSortBy] = useState<SortKey>('margin')
  const [view, setView] = useState<'table' | 'chart'>('table')
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = props.cases.filter((c) => {
      if (q && !c.label.toLowerCase().includes(q) && !c.inputs.runwayId.toLowerCase().includes(q)) return false
      if (variant !== 'all' && c.inputs.variant !== variant) return false
      if (operation !== 'all' && c.inputs.operation !== operation) return false
      const outputs = computeOutputs(c.inputs)
      if (status !== 'all' && outputs.status !== status) return false
      return true
    }).map((c) => ({ case: c, outputs: computeOutputs(c.inputs) }))
    filtered.sort((a, b) => sortBy === 'margin'
      ? a.outputs.runwayMarginFt - b.outputs.runwayMarginFt
      : b.case.updatedAt.localeCompare(a.case.updatedAt))
    return filtered
  }, [props.cases, query, variant, operation, status, sortBy])

  // Single-runway filter → the chart earns its reference line (§4).
  const runwaysInView = useMemo(() => [...new Set(rows.map((r) => r.case.inputs.runwayId))], [rows])
  const reference = runwaysInView.length === 1 && rows[0]
    ? { value: rows[0].case.inputs.runwayLengthFt, label: `${runwaysInView[0]} available ${formatInt(rows[0].case.inputs.runwayLengthFt)} ft` }
    : null
  const series = useMemo(() => buildSeries(rows.map((r) => r.case)), [rows])

  const toggle = (id: string) => setSelected((ids) => {
    if (ids.includes(id)) return ids.filter((x) => x !== id)
    return ids.length >= 2 ? [ids[1]!, id] : [...ids, id]
  })

  const duplicate = async (id: string) => {
    setBusy(id)
    setError(null)
    try {
      await duplicateCase(id)
      await props.refresh()
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
          <span className="eyebrow">Case registry</span>
          <h1>Saved performance cases</h1>
          <p>Filter, compare margins, and inspect weight-to-runway trends. Select exactly two cases to diff them.</p>
        </div>
        <div className="page-actions">
          <a
            className={selected.length === 2 ? 'button secondary' : 'button secondary disabled-link'}
            aria-disabled={selected.length !== 2}
            href={selected.length === 2 ? href.compare(selected[0]!, selected[1]!) : undefined}
          >
            Compare selected ({selected.length}/2)
          </a>
          <a className="button primary" href={href.calculator}>New case</a>
        </div>
      </header>

      <div className="form-group">
        <div className="form-row filters-row">
          <div className="field size-grow">
            <label htmlFor="q">Search label or runway</label>
            <input id="q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
            <p className="field-message"> </p>
          </div>
          <div className="field size-select">
            <label htmlFor="f-variant">Variant</label>
            <select id="f-variant" value={variant} onChange={(e) => setVariant(e.target.value as 'all' | Variant)}>
              <option value="all">All variants</option>
              {VARIANTS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <p className="field-message"> </p>
          </div>
          <div className="field size-select">
            <label htmlFor="f-op">Operation</label>
            <select id="f-op" value={operation} onChange={(e) => setOperation(e.target.value as OpFilter)}>
              <option value="all">All operations</option>
              <option value="takeoff">Takeoff</option>
              <option value="landing">Landing</option>
            </select>
            <p className="field-message"> </p>
          </div>
          <div className="field size-select">
            <label htmlFor="f-status">Status</label>
            <select id="f-status" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
              <option value="all">All statuses</option>
              <option value="within-limits">Within limits</option>
              <option value="caution">Caution</option>
              <option value="out-of-limits">Out of limits</option>
            </select>
            <p className="field-message"> </p>
          </div>
          <div className="field size-select">
            <label htmlFor="f-sort">Sort</label>
            <select id="f-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>
              <option value="margin">Thinnest margin</option>
              <option value="updated">Updated time</option>
            </select>
            <p className="field-message"> </p>
          </div>
          <div className="field">
            <span className="field-label-static">View</span>
            <div className="segmented" role="group" aria-label="Registry view">
              <button type="button" className={view === 'table' ? 'active' : ''} aria-pressed={view === 'table'} onClick={() => setView('table')}>Table</button>
              <button type="button" className={view === 'chart' ? 'active' : ''} aria-pressed={view === 'chart'} onClick={() => setView('chart')}>XY chart</button>
            </div>
            <p className="field-message"> </p>
          </div>
        </div>
        <p className="summary-bar">Showing <strong>{rows.length}</strong> of {props.cases.length} saved cases{reference ? ' · single-runway view — reference line active' : ''}</p>
      </div>

      {error && <div className="alert danger" role="alert">{error}</div>}

      {view === 'table' ? (
        <section className="page-section">
          <div className="section-header">
            <div><span className="eyebrow">Registry view</span><h2>Case table</h2></div>
            <span className="panel-meta">Numerics in planning units</span>
          </div>
          {rows.length === 0 ? (
            <div className="remote-state"><strong>No matching cases</strong><span>Loosen the filters or save a reviewed calculation.</span></div>
          ) : (
            <div className="table-surface table-scroll">
              <table className="registry-table">
                <caption className="sr-only">Saved performance cases</caption>
                <thead>
                  <tr>
                    <th className="cell-check"><span className="sr-only">Select for comparison</span></th>
                    <th>Case</th>
                    <th className="numeric">Weight</th>
                    <th className="numeric">PA / OAT</th>
                    <th className="numeric">Required</th>
                    <th className="numeric">Margin</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ case: c, outputs }) => (
                    <tr key={c.id}>
                      <td className="cell-check">
                        <input
                          type="checkbox"
                          checked={selected.includes(c.id)}
                          aria-label={`Select ${c.label} for comparison`}
                          onChange={() => toggle(c.id)}
                        />
                      </td>
                      <td className="case-cell">
                        <a className="row-link" href={href.editCase(c.id)} title={c.label}>{c.label}</a>
                        <small>{c.inputs.variant} · {c.inputs.operation} · flap {c.inputs.flapSetting} · {c.inputs.runwayId}</small>
                      </td>
                      <td className="numeric">{formatInt(c.inputs.weightLb)} lb</td>
                      <td className="numeric">{formatSigned(c.inputs.pressureAltitudeFt)} ft / {formatSigned(c.inputs.oatC)} °C</td>
                      <td className="numeric">{formatInt(outputs.requiredRunwayFt)} ft</td>
                      <td className="numeric">{formatSigned(outputs.runwayMarginFt)} ft</td>
                      <td><span className={`status-badge status-${outputs.status}`}>{statusLabel(outputs.status)}</span></td>
                      <td className="nowrap muted-cell">{new Date(c.updatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                      <td className="cell-actions">
                        <a className="table-action" href={href.editCase(c.id)}>Edit</a>
                        <button type="button" className="table-action" disabled={!props.online || busy === c.id} onClick={() => void duplicate(c.id)}>
                          {busy === c.id ? 'Copying…' : 'Duplicate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className="page-section">
          <div className="section-header">
            <div><span className="eyebrow">Chart view</span><h2>Required runway vs aircraft weight</h2></div>
            <span className="panel-meta">{reference ? reference.label : 'Mixed runways — no reference line'}</span>
          </div>
          <ul className="chart-legend" aria-label="Chart legend">
            {series.map((s, i) => (
              <li key={s.key} className="legend-static">
                <span className={s.line ? `legend-line ${seriesClass(i)}` : 'legend-diamond'} aria-hidden="true" /> {s.label}
              </li>
            ))}
            {reference && <li className="legend-static"><span className="legend-ref" aria-hidden="true" /> {reference.label}</li>}
            {reference && <li className="legend-static"><span className="legend-cross" aria-hidden="true" /> Crossover (limiting weight)</li>}
          </ul>
          <CasesChart series={series} reference={reference} onSelect={(id) => { window.location.hash = href.editCase(id) }} />
        </section>
      )}
    </>
  )
}
