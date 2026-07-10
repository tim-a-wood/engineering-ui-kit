/**
 * Registry XY chart (CMP-VIZ-*): required runway vs weight. Sweep families
 * plot as weight-sorted line series; standalone cases as scatter. When every
 * visible case shares one runway, its available length draws as a reference
 * line with interpolated crossover markers. Crosshair via pointer and
 * keyboard with a visible exact-value readout.
 */

import { useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react'
import type { PerformanceCase, Status } from '../../shared/model'
import { computeOutputs } from '../../shared/model'
import { formatInt, statusLabel } from '../../shared/format'

export const seriesClass = (index: number) => ['series-a', 'series-b', 'series-c', 'series-d'][index % 4]!

interface PlotPoint { x: number; y: number; status: Status; label: string; seriesLabel: string; caseId: string }
export interface PlotSeries { key: string; label: string; line: boolean; points: PlotPoint[] }

export function buildSeries(cases: PerformanceCase[]): PlotSeries[] {
  const families = new Map<string, PlotPoint[]>()
  const singles: PlotPoint[] = []
  for (const c of cases) {
    const outputs = computeOutputs(c.inputs)
    const point: PlotPoint = {
      x: c.inputs.weightLb, y: outputs.requiredRunwayFt, status: outputs.status,
      label: c.label, seriesLabel: c.sweepFamily ?? 'Standalone cases', caseId: c.id,
    }
    if (c.sweepFamily) families.set(c.sweepFamily, [...(families.get(c.sweepFamily) ?? []), point])
    else singles.push(point)
  }
  const series: PlotSeries[] = [...families.entries()].map(([key, points]) => ({
    key, label: `${key} — sweep`, line: true, points: [...points].sort((a, b) => a.x - b.x),
  }))
  if (singles.length > 0) series.push({ key: '__singles', label: 'Standalone cases', line: false, points: [...singles].sort((a, b) => a.x - b.x) })
  return series
}

function niceStep(range: number, target: number): number {
  const raw = range / Math.max(1, target)
  const mag = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)))
  const norm = raw / mag
  return (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag
}

function ticks(min: number, max: number, target = 5): { ticks: number[]; lo: number; hi: number } {
  if (min === max) { min -= 1; max += 1 }
  const step = niceStep(max - min, target)
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const out: number[] = []
  for (let t = lo; t <= hi + step / 2; t += step) out.push(t)
  return { ticks: out, lo, hi }
}

function crossings(points: PlotPoint[], reference: number): number[] {
  const out: number[] = []
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!
    const b = points[i]!
    const da = a.y - reference
    const db = b.y - reference
    if (da === 0) out.push(a.x)
    else if (da * db < 0) out.push(a.x + (da / (da - db)) * (b.x - a.x))
  }
  return out
}

export function CasesChart(props: {
  series: PlotSeries[]
  reference?: { value: number; label: string } | null
  onSelect?: (caseId: string) => void
}) {
  const { series } = props
  const width = 860
  const height = 420
  const margin = { top: 18, right: 24, bottom: 54, left: 84 }
  const innerW = width - margin.left - margin.right
  const innerH = height - margin.top - margin.bottom
  const [active, setActive] = useState<{ s: number; p: number } | null>(null)

  const flat = useMemo(() => series.flatMap((s) => s.points), [series])
  const domain = useMemo(() => {
    const xs = flat.map((p) => p.x)
    const ys = flat.map((p) => p.y)
    if (props.reference) ys.push(props.reference.value)
    return { x: ticks(Math.min(...xs), Math.max(...xs), 6), y: ticks(Math.min(...ys), Math.max(...ys), 5) }
  }, [flat, props.reference])

  if (flat.length === 0) {
    return <div className="remote-state"><strong>No cases to plot</strong><span>Loosen the filters or save a case first.</span></div>
  }

  const sx = (v: number) => margin.left + ((v - domain.x.lo) / ((domain.x.hi - domain.x.lo) || 1)) * innerW
  const sy = (v: number) => margin.top + innerH - ((v - domain.y.lo) / ((domain.y.hi - domain.y.lo) || 1)) * innerH
  const activePoint = active ? series[active.s]?.points[active.p] ?? null : null

  const moveAlong = (delta: number) => {
    const s = active?.s ?? 0
    const count = series[s]?.points.length ?? 0
    if (count === 0) return
    const next = active ? Math.min(count - 1, Math.max(0, active.p + delta)) : delta > 0 ? 0 : count - 1
    setActive({ s, p: next })
  }

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); moveAlong(1) }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); moveAlong(-1) }
    else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      const s = active ? (active.s + delta + series.length) % series.length : 0
      setActive({ s, p: Math.min(active?.p ?? 0, Math.max(0, (series[s]?.points.length ?? 1) - 1)) })
    } else if (event.key === 'Home') { event.preventDefault(); setActive({ s: active?.s ?? 0, p: 0 }) }
    else if (event.key === 'End') {
      event.preventDefault()
      const s = active?.s ?? 0
      setActive({ s, p: Math.max(0, (series[s]?.points.length ?? 1) - 1) })
    } else if (event.key === 'Escape') { setActive(null) }
    else if (event.key === 'Enter' && activePoint && props.onSelect) { props.onSelect(activePoint.caseId) }
  }

  const onMouseMove = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const px = ((event.clientX - rect.left) / rect.width) * width
    const py = ((event.clientY - rect.top) / rect.height) * height
    let best: { s: number; p: number; d: number } | null = null
    for (let si = 0; si < series.length; si += 1) {
      const pts = series[si]!.points
      for (let pi = 0; pi < pts.length; pi += 1) {
        const dx = sx(pts[pi]!.x) - px
        const dy = sy(pts[pi]!.y) - py
        const d = dx * dx + dy * dy
        if (!best || d < best.d) best = { s: si, p: pi, d }
      }
    }
    if (best) setActive({ s: best.s, p: best.p })
  }

  return (
    <div className="chart-wrap">
      <svg
        className="study-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="application"
        tabIndex={0}
        aria-label={`XY chart of ${flat.length} saved cases: required runway (ft) against aircraft weight (lb), ${series.length} series. Arrow keys walk points and switch series; the readout below reports exact values; the synced rail carries the same data as text.`}
        onKeyDown={onKeyDown}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setActive(null)}
      >
        <rect className="chart-area" x={margin.left} y={margin.top} width={innerW} height={innerH} />
        {domain.y.ticks.map((tick) => (
          <g key={`y-${tick}`}>
            <line className="chart-grid" x1={margin.left} x2={width - margin.right} y1={sy(tick)} y2={sy(tick)} />
            <text className="chart-tick" x={margin.left - 10} y={sy(tick) + 4} textAnchor="end">{formatInt(tick)}</text>
          </g>
        ))}
        {domain.x.ticks.map((tick) => (
          <g key={`x-${tick}`}>
            <line className="chart-grid" x1={sx(tick)} x2={sx(tick)} y1={margin.top} y2={height - margin.bottom} />
            <text className="chart-tick" x={sx(tick)} y={height - margin.bottom + 22} textAnchor="middle">{formatInt(tick)}</text>
          </g>
        ))}

        {props.reference && (
          <g className="chart-reference">
            <line x1={margin.left} x2={width - margin.right} y1={sy(props.reference.value)} y2={sy(props.reference.value)} />
            <text x={width - margin.right - 6} y={sy(props.reference.value) - 6} textAnchor="end">{props.reference.label}</text>
          </g>
        )}

        {activePoint && (
          <g className="chart-crosshair" aria-hidden="true">
            <line x1={sx(activePoint.x)} x2={sx(activePoint.x)} y1={margin.top} y2={height - margin.bottom} />
            <line x1={margin.left} x2={width - margin.right} y1={sy(activePoint.y)} y2={sy(activePoint.y)} />
            <circle className="chart-halo" cx={sx(activePoint.x)} cy={sy(activePoint.y)} r={11} />
          </g>
        )}

        {series.map((s, si) => (
          <g key={s.key} className={`chart-series ${seriesClass(si)}`}>
            {s.line && s.points.length > 1 && (
              <polyline fill="none" points={s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')} />
            )}
            {s.points.map((p, pi) => (
              <circle
                key={p.caseId}
                className={active && active.s === si && active.p === pi ? 'chart-point active' : 'chart-point'}
                cx={sx(p.x)}
                cy={sy(p.y)}
                r={s.line ? 3.5 : 4.5}
              />
            ))}
            {props.reference && s.line && crossings(s.points, props.reference.value).map((x, ci) => (
              <g key={`cross-${ci}`} className="chart-crossing">
                <circle cx={sx(x)} cy={sy(props.reference!.value)} r={5.5} />
                <text x={sx(x)} y={sy(props.reference!.value) + 20} textAnchor="middle">{formatInt(x)} lb</text>
              </g>
            ))}
          </g>
        ))}

        <text className="chart-axis-title" x={margin.left + innerW / 2} y={height - 8} textAnchor="middle">Aircraft weight (lb)</text>
        <text className="chart-axis-title" transform={`translate(16 ${margin.top + innerH / 2}) rotate(-90)`} textAnchor="middle">Required runway (ft)</text>
      </svg>
      <p className="chart-readout" role="status" aria-live="polite">
        {activePoint
          ? `${activePoint.label} — ${formatInt(activePoint.x)} lb → ${formatInt(activePoint.y)} ft required · ${statusLabel(activePoint.status)}${props.onSelect ? ' · Enter opens the case' : ''}`
          : 'Hover the chart or focus it: ← → walk points, ↑ ↓ switch series, Home/End jump, Esc clears.'}
      </p>
    </div>
  )
}
