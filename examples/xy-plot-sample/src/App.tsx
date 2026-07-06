import { useMemo, useState } from 'react'
import { DATASETS, computeStats, ticks, type Dataset } from './data'

const WIDTH = 680
const HEIGHT = 380
const MARGIN = { top: 20, right: 24, bottom: 44, left: 56 }

function scale(value: number, domainMin: number, domainMax: number, rangeMin: number, rangeMax: number): number {
  if (domainMax === domainMin) return (rangeMin + rangeMax) / 2
  return rangeMin + ((value - domainMin) / (domainMax - domainMin)) * (rangeMax - rangeMin)
}

function Plot({ dataset }: { dataset: Dataset }) {
  const stats = useMemo(() => computeStats(dataset.points), [dataset])
  const innerLeft = MARGIN.left
  const innerRight = WIDTH - MARGIN.right
  const innerTop = MARGIN.top
  const innerBottom = HEIGHT - MARGIN.bottom

  const sx = (x: number) => scale(x, stats.xMin, stats.xMax, innerLeft, innerRight)
  const sy = (y: number) => scale(y, stats.yMin, stats.yMax, innerBottom, innerTop)

  const xTicks = ticks(stats.xMin, stats.xMax, 6)
  const yTicks = ticks(stats.yMin, stats.yMax, 6)
  const linePath = dataset.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')

  return (
    <svg
      className="plot"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      role="img"
      aria-label={`${dataset.name}: ${dataset.description}. ${stats.count} points, y from ${stats.yMin} to ${stats.yMax} ${dataset.unitY}.`}
    >
      {yTicks.map((t) => (
        <g key={`y-${t}`}>
          <line className="gridline" x1={innerLeft} y1={sy(t)} x2={innerRight} y2={sy(t)} />
          <text className="tick-label" x={innerLeft - 8} y={sy(t) + 4} textAnchor="end">
            {t}
          </text>
        </g>
      ))}
      {xTicks.map((t) => (
        <g key={`x-${t}`}>
          <line className="tick" x1={sx(t)} y1={innerBottom} x2={sx(t)} y2={innerBottom + 5} />
          <text className="tick-label" x={sx(t)} y={innerBottom + 20} textAnchor="middle">
            {t}
          </text>
        </g>
      ))}
      <line className="axis" x1={innerLeft} y1={innerTop} x2={innerLeft} y2={innerBottom} />
      <line className="axis" x1={innerLeft} y1={innerBottom} x2={innerRight} y2={innerBottom} />
      <text className="axis-label" x={(innerLeft + innerRight) / 2} y={HEIGHT - 8} textAnchor="middle">
        x ({dataset.unitX})
      </text>
      <text
        className="axis-label"
        x={14}
        y={(innerTop + innerBottom) / 2}
        textAnchor="middle"
        transform={`rotate(-90 14 ${(innerTop + innerBottom) / 2})`}
      >
        y ({dataset.unitY})
      </text>

      {dataset.kind === 'line' && <polyline className="series-line" points={linePath} fill="none" />}
      {dataset.points.map((p) => (
        <circle key={`${p.x}-${p.y}`} className="series-point" cx={sx(p.x)} cy={sy(p.y)} r={dataset.kind === 'line' ? 2.5 : 3.5}>
          <title>{`x=${p.x} ${dataset.unitX}, y=${p.y} ${dataset.unitY}`}</title>
        </circle>
      ))}
    </svg>
  )
}

export default function App() {
  const [datasetId, setDatasetId] = useState(DATASETS[0]!.id)
  const dataset = DATASETS.find((d) => d.id === datasetId) ?? DATASETS[0]!
  const stats = computeStats(dataset.points)

  return (
    <div className="app">
      <header className="header">
        <h1>XY Plot Sample</h1>
        <p className="subtitle">Sample datasets rendered as an SVG chart — no chart library.</p>
      </header>

      <section className="controls" aria-label="Dataset selection">
        <label htmlFor="dataset-select">Dataset</label>
        <select id="dataset-select" value={datasetId} onChange={(e) => setDatasetId(e.target.value)}>
          {DATASETS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <span className="description">{dataset.description}</span>
      </section>

      <section className="chart-panel" aria-label="Chart">
        <Plot dataset={dataset} />
      </section>

      <section className="stats" aria-label="Summary statistics">
        <h2>Summary</h2>
        <dl className="stats-list">
          <div>
            <dt>Points</dt>
            <dd>{stats.count}</dd>
          </div>
          <div>
            <dt>x range</dt>
            <dd>
              {stats.xMin} – {stats.xMax} {dataset.unitX}
            </dd>
          </div>
          <div>
            <dt>y range</dt>
            <dd>
              {stats.yMin} – {stats.yMax} {dataset.unitY}
            </dd>
          </div>
          <div>
            <dt>y mean</dt>
            <dd>
              {stats.yMean} {dataset.unitY}
            </dd>
          </div>
        </dl>
      </section>

      <section className="table-panel" aria-label="Data table">
        <h2>Data (first 10 rows)</h2>
        <table>
          <caption className="sr-only">First ten points of {dataset.name}</caption>
          <thead>
            <tr>
              <th scope="col">x ({dataset.unitX})</th>
              <th scope="col">y ({dataset.unitY})</th>
            </tr>
          </thead>
          <tbody>
            {dataset.points.slice(0, 10).map((p) => (
              <tr key={`${p.x}`}>
                <td>{p.x}</td>
                <td>{p.y}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
