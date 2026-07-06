import { useMemo, useState } from 'react'
import {
  CHANNELS,
  EVENTS,
  RUN,
  STAGES,
  TRACE,
  soakSummary,
  ticks,
  type Channel,
  type ChannelStatus,
  type EventSeverity,
  type StageId,
} from './data'

const WIDTH = 760
const HEIGHT = 396
const MARGIN = { top: 18, right: 86, bottom: 42, left: 54 }

function scale(value: number, domainMin: number, domainMax: number, rangeMin: number, rangeMax: number): number {
  if (domainMax === domainMin) return (rangeMin + rangeMax) / 2
  return rangeMin + ((value - domainMin) / (domainMax - domainMin)) * (rangeMax - rangeMin)
}

function formatSigned(value: number): string {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(1)}`
}

/** CMP-VIZ-CHART-PANEL / CMP-VIZ-LINE-CHART: measured vs setpoint trace. */
function TraceChart({ stage }: { stage: StageId }) {
  const window = STAGES.find((s) => s.id === stage) ?? STAGES[0]!
  const points = useMemo(() => TRACE.filter((p) => p.t >= window.from && p.t <= window.to), [window])

  const values = points.flatMap((p) => [p.measured, p.setpoint])
  const yMin = Math.floor(Math.min(...values) - 2)
  const yMax = Math.ceil(Math.max(...values) + 2)

  const innerLeft = MARGIN.left
  const innerRight = WIDTH - MARGIN.right
  const innerTop = MARGIN.top
  const innerBottom = HEIGHT - MARGIN.bottom

  const sx = (t: number) => scale(t, window.from, window.to, innerLeft, innerRight)
  const sy = (v: number) => scale(v, yMin, yMax, innerBottom, innerTop)

  const xTicks = ticks(window.from, window.to, 7)
  const yTicks = ticks(yMin, yMax, 6)
  const measuredPath = points.map((p) => `${sx(p.t)},${sy(p.measured)}`).join(' ')
  const setpointPath = points.map((p) => `${sx(p.t)},${sy(p.setpoint)}`).join(' ')
  const last = points[points.length - 1]!

  return (
    <svg
      className="trace"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`Chamber temperature trace, ${window.label.toLowerCase()} window: measured temperature against the ${RUN.setpointC} degree setpoint profile, minutes ${window.from} to ${window.to}.`}
    >
      {yTicks.map((v) => (
        <g key={`y-${v}`}>
          <line className="gridline" x1={innerLeft} y1={sy(v)} x2={innerRight} y2={sy(v)} />
          <text className="tick-label" x={innerLeft - 8} y={sy(v) + 4} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      {xTicks.map((t) => (
        <text key={`x-${t}`} className="tick-label" x={sx(t)} y={innerBottom + 18} textAnchor="middle">
          {t}
        </text>
      ))}
      <line className="axis" x1={innerLeft} y1={innerTop} x2={innerLeft} y2={innerBottom} />
      <line className="axis" x1={innerLeft} y1={innerBottom} x2={innerRight} y2={innerBottom} />
      <text className="axis-label" x={(innerLeft + innerRight) / 2} y={HEIGHT - 8} textAnchor="middle">
        elapsed (min)
      </text>
      <text
        className="axis-label"
        x={14}
        y={(innerTop + innerBottom) / 2}
        textAnchor="middle"
        transform={`rotate(-90 14 ${(innerTop + innerBottom) / 2})`}
      >
        temperature (°C)
      </text>

      <polyline className="series-setpoint" points={setpointPath} fill="none" />
      <polyline className="series-measured" points={measuredPath} fill="none" />
      {points.map((p) => (
        <circle key={p.t} className="series-point" cx={sx(p.t)} cy={sy(p.measured)} r={2.4}>
          <title>{`t=${p.t} min — measured ${p.measured.toFixed(1)} °C, setpoint ${p.setpoint.toFixed(1)} °C`}</title>
        </circle>
      ))}

      {/* Direct end-of-line labels so series identity never rides on color alone. */}
      <text className="series-label series-label-measured" x={innerRight + 8} y={sy(last.measured) + 4}>
        Measured
      </text>
      <text
        className="series-label series-label-setpoint"
        x={innerRight + 8}
        y={sy(last.setpoint) + (Math.abs(sy(last.setpoint) - sy(last.measured)) < 14 ? 18 : 4)}
      >
        Setpoint
      </text>
    </svg>
  )
}

function StatusBadge({ status }: { status: ChannelStatus | EventSeverity | 'Running' }) {
  const tone = status === 'OK' || status === 'Info' ? 'ok' : status === 'Warning' ? 'warning' : status === 'Running' ? 'running' : 'fault'
  return (
    <span className={`badge badge-${tone}`}>
      <span className="badge-dot" aria-hidden="true" />
      {status}
    </span>
  )
}

interface Kpi {
  label: string
  value: string
  unit?: string
  context: string
  tone: 'neutral' | 'ok' | 'warning' | 'fault'
}

function buildKpis(): Kpi[] {
  const lastPoint = TRACE[TRACE.length - 1]!
  const online = CHANNELS.filter((c) => c.status !== 'Fault').length
  const alerts = CHANNELS.filter((c) => c.status !== 'OK').length
  const worst = Math.max(
    ...CHANNELS.filter((c) => c.deviationC !== null).map((c) => Math.abs(c.deviationC!)),
  )
  return [
    {
      label: 'Chamber temperature',
      value: lastPoint.measured.toFixed(1),
      unit: '°C',
      context: `Setpoint ${RUN.setpointC.toFixed(1)} °C — soak hold`,
      tone: 'neutral',
    },
    {
      label: 'Worst channel deviation',
      value: formatSigned(worst),
      unit: '°C',
      context: `Tolerance ±${RUN.toleranceC.toFixed(1)} °C — TC-05 closest`,
      tone: worst > RUN.toleranceC ? 'fault' : worst > RUN.toleranceC * 0.8 ? 'warning' : 'ok',
    },
    {
      label: 'Channels online',
      value: `${online} / ${CHANNELS.length}`,
      context: 'TC-07 open circuit — excluded from mean',
      tone: online === CHANNELS.length ? 'ok' : 'warning',
    },
    {
      label: 'Active alerts',
      value: String(alerts),
      context: '1 warning · 1 fault — see event log',
      tone: alerts === 0 ? 'ok' : 'fault',
    },
  ]
}

function ChannelRow({ channel }: { channel: Channel }) {
  return (
    <tr className={channel.status !== 'OK' ? `row-${channel.status.toLowerCase()}` : undefined}>
      <td className="cell-id">{channel.id}</td>
      <td className="cell-text">{channel.location}</td>
      <td className="cell-num">{channel.readingC === null ? '—' : `${channel.readingC.toFixed(1)} °C`}</td>
      <td className="cell-num">{channel.deviationC === null ? '—' : `${formatSigned(channel.deviationC)} °C`}</td>
      <td>
        <StatusBadge status={channel.status} />
      </td>
      <td className="cell-note">{channel.note}</td>
    </tr>
  )
}

export default function App() {
  const [stage, setStage] = useState<StageId>('full')
  const [statusFilter, setStatusFilter] = useState<ChannelStatus | 'All'>('All')

  const summary = soakSummary()
  const kpis = buildKpis()
  const filters: (ChannelStatus | 'All')[] = ['All', 'OK', 'Warning', 'Fault']
  const visibleChannels = CHANNELS.filter((c) => statusFilter === 'All' || c.status === statusFilter)

  return (
    <div className="app">
      <header className="run-header">
        <div>
          <div className="run-rig">{RUN.rig}</div>
          <h1>
            {RUN.id} <span className="run-profile">· {RUN.profile}</span>
          </h1>
        </div>
        <div className="run-meta">
          <StatusBadge status={RUN.state} />
          <div className="run-elapsed">
            <span className="run-elapsed-label">Elapsed</span>
            <span className="run-elapsed-value">
              {RUN.elapsed} <span className="run-elapsed-total">/ {RUN.planned}</span>
            </span>
          </div>
        </div>
      </header>

      <section className="kpis" aria-label="Key figures">
        {kpis.map((kpi) => (
          <article key={kpi.label} className={`kpi kpi-${kpi.tone}`}>
            <div className="kpi-label">{kpi.label}</div>
            <div className="kpi-value">
              {kpi.value}
              {kpi.unit && <span className="kpi-unit"> {kpi.unit}</span>}
            </div>
            <div className="kpi-context">{kpi.context}</div>
          </article>
        ))}
      </section>

      <div className="main-grid">
        <section className="panel chart-panel" aria-label="Temperature trace">
          <div className="panel-head">
            <div>
              <h2>Temperature trace</h2>
              <p className="panel-sub">Chamber mean over 7 channels · °C by elapsed minutes</p>
            </div>
            <div className="stage-tabs" role="group" aria-label="Trace window">
              {STAGES.map((s) => (
                <button key={s.id} type="button" aria-pressed={stage === s.id} onClick={() => setStage(s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <TraceChart stage={stage} />
          <div className="chart-footer">
            <ul className="legend" aria-label="Series legend">
              <li>
                <span className="legend-swatch legend-measured" aria-hidden="true" />
                Measured — chamber mean
              </li>
              <li>
                <span className="legend-swatch legend-setpoint" aria-hidden="true" />
                Setpoint — profile {RUN.profile}
              </li>
            </ul>
            <p className="chart-summary">
              Soak window mean {summary.meanC.toFixed(1)} °C · max deviation {formatSigned(summary.maxDeviationC)} °C ·{' '}
              {summary.withinTolerance ? 'within' : 'outside'} ±{RUN.toleranceC.toFixed(1)} °C tolerance
            </p>
          </div>
        </section>

        <section className="panel events-panel" aria-label="Event log">
          <div className="panel-head">
            <h2>Event log</h2>
            <span className="panel-count">{EVENTS.length} events</span>
          </div>
          <ol className="events">
            {EVENTS.map((event) => (
              <li key={`${event.at}-${event.message}`} className={`event event-${event.severity.toLowerCase()}`}>
                <span className="event-at">{event.at}</span>
                <div>
                  <StatusBadge status={event.severity} />
                  <p className="event-message">{event.message}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="panel table-panel" aria-label="Thermocouple channels">
        <div className="panel-head">
          <div>
            <h2>Channels</h2>
            <p className="panel-sub">Latest reading and deviation against the {RUN.setpointC.toFixed(1)} °C setpoint</p>
          </div>
          <div className="filter-tabs" role="group" aria-label="Filter channels by status">
            {filters.map((f) => {
              const count = f === 'All' ? CHANNELS.length : CHANNELS.filter((c) => c.status === f).length
              return (
                <button key={f} type="button" aria-pressed={statusFilter === f} onClick={() => setStatusFilter(f)}>
                  {f} <span className="filter-count">{count}</span>
                </button>
              )
            })}
          </div>
        </div>
        <table>
          <caption className="sr-only">
            Thermocouple channels with latest reading, deviation from setpoint, and status
          </caption>
          <thead>
            <tr>
              <th scope="col">Channel</th>
              <th scope="col">Location</th>
              <th scope="col" className="cell-num">Reading</th>
              <th scope="col" className="cell-num">Deviation</th>
              <th scope="col">Status</th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {visibleChannels.map((channel) => (
              <ChannelRow key={channel.id} channel={channel} />
            ))}
          </tbody>
        </table>
        {visibleChannels.length === 0 && <p className="table-empty">No channels match this filter.</p>}
      </section>
    </div>
  )
}
