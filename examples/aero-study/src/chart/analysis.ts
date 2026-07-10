/**
 * Chart-side analysis: nice axis ticks, reference-crossing interpolation,
 * and per-series tradeoff summaries. Pure functions over expanded points.
 */

import type { Status, StudySeries } from '../../shared/model'
import { axisField, type AxisFieldKey } from '../../shared/fields'

export interface PlotPoint {
  x: number
  y: number
  status: Status
  seriesLabel: string
}

export interface PlotSeries {
  key: string
  label: string
  points: PlotPoint[]
}

export function toPlotSeries(series: StudySeries[], xKey: AxisFieldKey, yKey: AxisFieldKey): PlotSeries[] {
  const fx = axisField(xKey)
  const fy = axisField(yKey)
  return series.map((s) => ({
    key: s.key,
    label: s.label,
    points: s.points
      .map((p) => ({ x: fx.read(p), y: fy.read(p), status: p.outputs.status, seriesLabel: s.label }))
      .sort((a, b) => a.x - b.x),
  }))
}

function niceStep(range: number, targetTicks: number): number {
  const raw = range / Math.max(1, targetTicks)
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)))
  const normalized = raw / magnitude
  const factor = normalized >= 5 ? 10 : normalized >= 2 ? 5 : normalized >= 1 ? 2 : 1
  return factor * magnitude
}

export function axisTicks(min: number, max: number, targetTicks = 5): { ticks: number[]; lo: number; hi: number } {
  if (min === max) { min -= 1; max += 1 }
  const step = niceStep(max - min, targetTicks)
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Math.round(t * 1e6) / 1e6)
  return { ticks, lo, hi }
}

/** Interpolated x positions where the polyline crosses y = reference. */
export function findCrossings(points: PlotPoint[], reference: number): number[] {
  const crossings: number[] = []
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!
    const b = points[i]!
    const da = a.y - reference
    const db = b.y - reference
    if (da === 0) crossings.push(a.x)
    else if (da * db < 0) {
      const t = da / (da - db)
      crossings.push(a.x + t * (b.x - a.x))
    }
  }
  if (points.length > 0 && points[points.length - 1]!.y === reference) crossings.push(points[points.length - 1]!.x)
  return crossings
}

const STATUS_RANK: Record<Status, number> = { 'within-limits': 0, caution: 1, 'out-of-limits': 2 }

export interface SeriesSummary {
  key: string
  label: string
  yMin: number
  yMax: number
  crossover: number | undefined
  worst: Status
}

export function summarizeSeries(series: PlotSeries, reference: number | undefined): SeriesSummary {
  const ys = series.points.map((p) => p.y)
  const worst = series.points.reduce<Status>(
    (acc, p) => (STATUS_RANK[p.status] > STATUS_RANK[acc] ? p.status : acc),
    'within-limits',
  )
  const crossover = reference === undefined ? undefined : findCrossings(series.points, reference)[0]
  return {
    key: series.key,
    label: series.label,
    yMin: ys.length ? Math.min(...ys) : 0,
    yMax: ys.length ? Math.max(...ys) : 0,
    crossover,
    worst,
  }
}
