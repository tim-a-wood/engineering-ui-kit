/**
 * The configurable engineering XY chart (CMP-VIZ-CHART-PANEL /
 * CMP-VIZ-LINE-CHART / CMP-VIZ-LEGEND / CMP-VIZ-CHART-TOOLTIP): overlaid
 * x-sorted series, round-tick gridded axes, an optional reference line with
 * interpolated crossover markers, and a crosshair driven by pointer and
 * keyboard with a visible exact-value readout.
 */

import { useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { axisField, type AxisFieldKey } from '../../shared/fields'
import { formatValue, statusLabel } from '../../shared/format'
import { axisTicks, findCrossings, type PlotSeries } from './analysis'

export const SERIES_CLASSES = ['series-a', 'series-b', 'series-c', 'series-d'] as const
export const seriesClass = (index: number) => SERIES_CLASSES[index % SERIES_CLASSES.length]!

export interface Reference { value: number; label: string }

interface Active { series: number; point: number }

export function StudyChart(props: {
  series: PlotSeries[]
  xKey: AxisFieldKey
  yKey: AxisFieldKey
  reference?: Reference | null
  height?: number
}) {
  const { series, xKey, yKey } = props
  const fx = axisField(xKey)
  const fy = axisField(yKey)
  const width = 860
  const height = props.height ?? 430
  const margin = { top: 18, right: 24, bottom: 54, left: 84 }
  const innerW = width - margin.left - margin.right
  const innerH = height - margin.top - margin.bottom

  const [active, setActive] = useState<Active | null>(null)

  const flat = useMemo(() => series.flatMap((s) => s.points), [series])
  const domain = useMemo(() => {
    const xs = flat.map((p) => p.x)
    const ys = flat.map((p) => p.y)
    if (props.reference) ys.push(props.reference.value)
    return {
      x: axisTicks(Math.min(...xs), Math.max(...xs), 6),
      y: axisTicks(Math.min(...ys), Math.max(...ys), 5),
    }
  }, [flat, props.reference])

  if (flat.length === 0) {
    return <div className="remote-state"><strong>No points to plot</strong><span>Adjust the sweep so it generates at least one case.</span></div>
  }

  const sx = (v: number) => margin.left + ((v - domain.x.lo) / ((domain.x.hi - domain.x.lo) || 1)) * innerW
  const sy = (v: number) => margin.top + innerH - ((v - domain.y.lo) / ((domain.y.hi - domain.y.lo) || 1)) * innerH

  const activePoint = active ? series[active.series]?.points[active.point] ?? null : null

  const moveAlong = (delta: number) => {
    if (series.length === 0) return
    const s = active?.series ?? 0
    const count = series[s]?.points.length ?? 0
    if (count === 0) return
    const next = active ? Math.min(count - 1, Math.max(0, active.point + delta)) : delta > 0 ? 0 : count - 1
    setActive({ series: s, point: next })
  }

  const switchSeries = (delta: number) => {
    if (series.length === 0) return
    const s = active ? (active.series + delta + series.length) % series.length : 0
    const count = series[s]?.points.length ?? 0
    setActive({ series: s, point: Math.min(active?.point ?? 0, Math.max(0, count - 1)) })
  }

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); moveAlong(1) }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); moveAlong(-1) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); switchSeries(-1) }
    else if (event.key === 'ArrowDown') { event.preventDefault(); switchSeries(1) }
    else if (event.key === 'Home') { event.preventDefault(); setActive({ series: active?.series ?? 0, point: 0 }) }
    else if (event.key === 'End') {
      event.preventDefault()
      const s = active?.series ?? 0
      setActive({ series: s, point: Math.max(0, (series[s]?.points.length ?? 1) - 1) })
    } else if (event.key === 'Escape') { setActive(null) }
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
    if (best) setActive({ series: best.s, point: best.p })
  }

  return (
    <div className="chart-wrap">
      <svg
        className="study-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="application"
        tabIndex={0}
        aria-label={`XY chart: ${fy.label} (${fy.unit}) against ${fx.label} (${fx.unit}), ${series.length} series. Arrow keys walk points and switch series; the readout below reports exact values. The synced list beside the chart carries the same data as text.`}
        onKeyDown={onKeyDown}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setActive(null)}
      >
        <rect className="chart-area" x={margin.left} y={margin.top} width={innerW} height={innerH} />
        {domain.y.ticks.map((tick) => (
          <g key={`y-${tick}`}>
            <line className="chart-grid" x1={margin.left} x2={width - margin.right} y1={sy(tick)} y2={sy(tick)} />
            <text className="chart-tick" x={margin.left - 10} y={sy(tick) + 4} textAnchor="end">{fy.unit === '%' ? tick.toFixed(1) : tick.toLocaleString('en-US')}</text>
          </g>
        ))}
        {domain.x.ticks.map((tick) => (
          <g key={`x-${tick}`}>
            <line className="chart-grid" x1={sx(tick)} x2={sx(tick)} y1={margin.top} y2={height - margin.bottom} />
            <text className="chart-tick" x={sx(tick)} y={height - margin.bottom + 22} textAnchor="middle">{tick.toLocaleString('en-US')}</text>
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
            {s.points.length > 1 && (
              <polyline fill="none" points={s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')} />
            )}
            {s.points.map((p, pi) => (
              <circle
                key={pi}
                className={active && active.series === si && active.point === pi ? 'chart-point active' : 'chart-point'}
                cx={sx(p.x)}
                cy={sy(p.y)}
                r={3.5}
              />
            ))}
            {props.reference && findCrossings(s.points, props.reference.value).map((x, ci) => (
              <g key={`cross-${ci}`} className="chart-crossing">
                <circle cx={sx(x)} cy={sy(props.reference!.value)} r={5.5} />
                <text x={sx(x)} y={sy(props.reference!.value) + 20} textAnchor="middle">
                  {formatValue(x, fx.unit)}
                </text>
              </g>
            ))}
          </g>
        ))}

        <text className="chart-axis-title" x={margin.left + innerW / 2} y={height - 8} textAnchor="middle">
          {fx.label} ({fx.unit})
        </text>
        <text className="chart-axis-title" transform={`translate(18 ${margin.top + innerH / 2}) rotate(-90)`} textAnchor="middle">
          {fy.label} ({fy.unit})
        </text>
      </svg>
      <p className="chart-readout" role="status" aria-live="polite">
        {activePoint
          ? `${activePoint.seriesLabel} — ${fx.short} ${formatValue(activePoint.x, fx.unit)} → ${fy.short} ${formatValue(activePoint.y, fy.unit)} · ${statusLabel(activePoint.status)}`
          : 'Hover the chart or focus it: ← → walk points, ↑ ↓ switch series, Home/End jump, Esc clears.'}
      </p>
    </div>
  )
}
