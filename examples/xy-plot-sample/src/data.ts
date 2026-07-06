/**
 * Sample datasets and pure derivation helpers for the XY plot.
 * Domain data and math stay out of the presentation layer.
 */

export type Point = { x: number; y: number }

export type Dataset = {
  id: string
  name: string
  description: string
  unitX: string
  unitY: string
  kind: 'line' | 'scatter'
  points: Point[]
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

const sineSweep: Point[] = Array.from({ length: 41 }, (_, i) => {
  const x = i * 0.25
  return { x: round2(x), y: round2(4 * Math.sin(x) + 0.35 * x) }
})

const responseCurve: Point[] = Array.from({ length: 25 }, (_, i) => {
  const x = i * 2
  return { x, y: round2(100 * (1 - Math.exp(-x / 14))) }
})

// Deterministic pseudo-noise so the scatter is stable across runs.
const calibrationScatter: Point[] = Array.from({ length: 36 }, (_, i) => {
  const x = round2(1 + i * 0.8)
  const wobble = Math.sin(i * 12.9898) * 43758.5453
  const noise = (wobble - Math.floor(wobble) - 0.5) * 6
  return { x, y: round2(0.9 * x + 8 + noise) }
})

export const DATASETS: Dataset[] = [
  {
    id: 'sine-sweep',
    name: 'Sine sweep',
    description: 'Oscillator output over a 10-second sweep',
    unitX: 's',
    unitY: 'V',
    kind: 'line',
    points: sineSweep,
  },
  {
    id: 'response-curve',
    name: 'Step response',
    description: 'System response approaching steady state',
    unitX: 'ms',
    unitY: '%',
    kind: 'line',
    points: responseCurve,
  },
  {
    id: 'calibration',
    name: 'Calibration scatter',
    description: 'Sensor readings against reference values',
    unitX: 'ref',
    unitY: 'reading',
    kind: 'scatter',
    points: calibrationScatter,
  },
]

export type Stats = {
  count: number
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  yMean: number
}

export function computeStats(points: Point[]): Stats {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const sum = ys.reduce((a, b) => a + b, 0)
  return {
    count: points.length,
    xMin: Math.min(...xs),
    xMax: Math.max(...xs),
    yMin: round2(Math.min(...ys)),
    yMax: round2(Math.max(...ys)),
    yMean: round2(sum / points.length),
  }
}

/** Evenly spaced tick values across a range, inclusive of both ends. */
export function ticks(min: number, max: number, count: number): number[] {
  if (count < 2) return [min]
  const step = (max - min) / (count - 1)
  return Array.from({ length: count }, (_, i) => round2(min + i * step))
}
