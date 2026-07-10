import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react'
import { calculateCase, createCase, listCases, updateCase } from './api'
import type {
  AircraftVariant,
  CaseInput,
  FlapSetting,
  OperationMode,
  PerformanceCase,
  PerformanceInputs,
  PerformanceOutput,
  PerformanceStatus,
  RunwayCondition,
} from '../shared/types'

type View = 'dashboard' | 'calculator' | 'cases'
type CasePresentationView = 'table' | 'plot'
type ValidationErrors = Partial<Record<keyof PerformanceInputs | 'label', string>>
interface SweepConfig {
  startWeightLb: number
  endWeightLb: number
  stepWeightLb: number
}
type SweepErrors = Partial<Record<keyof SweepConfig | 'range', string>>

const emptyInputs: PerformanceInputs = {
  mode: 'takeoff',
  aircraftVariant: 'GL-500',
  runwayId: 'KSVN RWY 10',
  runwayLengthFt: 9351,
  pressureAltitudeFt: 48,
  oatC: 29,
  weightLb: 64500,
  windComponentKt: 8,
  runwayCondition: 'dry',
  flapSetting: '15',
  notes: '',
}

const emptyCase: CaseInput = {
  label: '',
  inputs: emptyInputs,
}

const defaultSweep: SweepConfig = {
  startWeightLb: 56000,
  endWeightLb: 72000,
  stepWeightLb: 4000,
}

const NAV: { id: View; label: string; description: string }[] = [
  { id: 'dashboard', label: 'Dashboard', description: 'Fleet-level performance review' },
  { id: 'calculator', label: 'Calculator', description: 'Create or update a performance case' },
  { id: 'cases', label: 'Saved cases', description: 'Read and edit persisted calculations' },
]

function formatNumber(value: number): string {
  return value.toLocaleString('en-US')
}

function statusText(status: PerformanceStatus): string {
  if (status === 'within-limits') return 'Within limits'
  if (status === 'out-of-limits') return 'Out of limits'
  return 'Caution'
}

function statusTone(status: PerformanceStatus): 'success' | 'warning' | 'danger' {
  if (status === 'within-limits') return 'success'
  if (status === 'out-of-limits') return 'danger'
  return 'warning'
}

function defaultLabel(inputs: PerformanceInputs): string {
  return `${inputs.aircraftVariant} ${inputs.runwayId} ${inputs.mode}`
}

function validate(form: CaseInput): ValidationErrors {
  const errors: ValidationErrors = {}
  if (!form.label.trim()) errors.label = 'Case label is required.'
  if (!form.inputs.runwayId.trim()) errors.runwayId = 'Runway identifier is required.'
  if (form.inputs.runwayLengthFt < 1500 || form.inputs.runwayLengthFt > 16000) {
    errors.runwayLengthFt = 'Runway length must be between 1,500 and 16,000 ft.'
  }
  if (form.inputs.pressureAltitudeFt < -2000 || form.inputs.pressureAltitudeFt > 14000) {
    errors.pressureAltitudeFt = 'Pressure altitude must be between -2,000 and 14,000 ft.'
  }
  if (form.inputs.oatC < -40 || form.inputs.oatC > 55) {
    errors.oatC = 'Outside air temperature must be between -40 and 55 °C.'
  }
  if (form.inputs.windComponentKt < -20 || form.inputs.windComponentKt > 40) {
    errors.windComponentKt = 'Wind component must be between -20 kt tailwind and +40 kt headwind.'
  }
  if (form.inputs.weightLb < 30000 || form.inputs.weightLb > 90000) {
    errors.weightLb = 'Weight must be between 30,000 and 90,000 lb.'
  }
  return errors
}


function validateSweep(config: SweepConfig): SweepErrors {
  const errors: SweepErrors = {}
  if (!Number.isInteger(config.startWeightLb) || config.startWeightLb < 30000 || config.startWeightLb > 90000) {
    errors.startWeightLb = 'Sweep start weight must be a whole number between 30,000 and 90,000 lb.'
  }
  if (!Number.isInteger(config.endWeightLb) || config.endWeightLb < 30000 || config.endWeightLb > 90000) {
    errors.endWeightLb = 'Sweep end weight must be a whole number between 30,000 and 90,000 lb.'
  }
  if (!Number.isInteger(config.stepWeightLb) || config.stepWeightLb < 100 || config.stepWeightLb > 10000) {
    errors.stepWeightLb = 'Sweep step must be a whole number between 100 and 10,000 lb.'
  }
  if (!errors.startWeightLb && !errors.endWeightLb && config.endWeightLb < config.startWeightLb) {
    errors.range = 'Sweep end weight must be greater than or equal to the start weight.'
  }
  if (!Object.keys(errors).length && sweepWeights(config).length > 25) {
    errors.range = 'Limit the sweep to 25 cases or fewer for this focused pass.'
  }
  return errors
}

function sweepWeights(config: SweepConfig): number[] {
  if (config.stepWeightLb <= 0 || config.endWeightLb < config.startWeightLb) return []
  const values: number[] = []
  for (let weight = config.startWeightLb; weight <= config.endWeightLb; weight += config.stepWeightLb) {
    values.push(weight)
    if (values.length > 50) break
  }
  if (values[values.length - 1] !== config.endWeightLb) values.push(config.endWeightLb)
  return values
}

function outputRank(item: PerformanceCase): number {
  if (item.output.status === 'out-of-limits') return 0
  if (item.output.status === 'caution') return 1
  return 2
}

function SummaryCard({ label, value, detail, tone = 'neutral' }: { label: string; value: string; detail: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  return (
    <article className={`summary-card summary-${tone}`}>
      <span className="summary-label">{label}</span>
      <strong className="num">{value}</strong>
      <span className="summary-detail">{detail}</span>
    </article>
  )
}

function StatusBadge({ status }: { status: PerformanceStatus }) {
  const tone = statusTone(status)
  return (
    <span className={`status status-${tone}`}>
      <span className="status-dot" aria-hidden="true" />
      {statusText(status)}
    </span>
  )
}


/*
 * Engineering XY chart for saved cases — CMP-VIZ-CHART-PANEL /
 * CMP-VIZ-LINE-CHART / CMP-VIZ-LEGEND / CMP-VIZ-CHART-TOOLTIP.
 * Sweep families plot as weight-sorted line series; standalone cases are
 * scatter points. Round-tick axes with gridlines; crosshair + keyboard
 * readout of exact values; status always carried in text.
 */

function niceStep(range: number, targetTicks: number): number {
  const raw = range / Math.max(1, targetTicks)
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const normalized = raw / magnitude
  const factor = normalized >= 5 ? 10 : normalized >= 2 ? 5 : normalized >= 1 ? 2 : 1
  return factor * magnitude
}

function axisTicks(min: number, max: number, targetTicks = 5): { ticks: number[]; lo: number; hi: number } {
  const step = niceStep((max - min) || 1, targetTicks)
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(t)
  return { ticks, lo, hi }
}

const MINI_STATUS: Record<PerformanceStatus, string> = {
  'within-limits': 'OK',
  'caution': 'CAUTION',
  'out-of-limits': 'EXCEEDS',
}

/** Sweep families ("… · sweep …" labels, 2+ members) become line series; everything else is a single point. */
function chartSeries(cases: PerformanceCase[]): { families: { name: string; points: PerformanceCase[] }[]; singles: PerformanceCase[] } {
  const buckets = new Map<string, PerformanceCase[]>()
  const singles: PerformanceCase[] = []
  for (const item of cases) {
    const match = item.label.match(/^(.*?)\s*·\s*sweep\b/)
    if (match && match[1]) buckets.set(match[1], [...(buckets.get(match[1]) ?? []), item])
    else singles.push(item)
  }
  const families: { name: string; points: PerformanceCase[] }[] = []
  for (const [name, points] of buckets) {
    if (points.length >= 2) {
      families.push({ name: name + ' — sweep', points: [...points].sort((a, b) => a.inputs.weightLb - b.inputs.weightLb) })
    } else {
      singles.push(...points)
    }
  }
  return { families, singles }
}

function CasesPlot({ cases }: { cases: PerformanceCase[]; onEdit?: (item: PerformanceCase) => void }) {
  const width = 760
  const height = 400
  const margin = { top: 16, right: 20, bottom: 52, left: 78 }
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom

  const { families, singles } = useMemo(() => chartSeries(cases), [cases])
  const ordered = useMemo(() => [...cases].sort((a, b) => a.inputs.weightLb - b.inputs.weightLb), [cases])
  const [activeId, setActiveId] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  const x = axisTicks(
    Math.min(...cases.map((c) => c.inputs.weightLb)),
    Math.max(...cases.map((c) => c.inputs.weightLb)),
    5,
  )
  const y = axisTicks(
    Math.min(...cases.map((c) => c.output.requiredRunwayFt)),
    Math.max(...cases.map((c) => c.output.requiredRunwayFt)),
    5,
  )
  const sx = (value: number) => margin.left + ((value - x.lo) / ((x.hi - x.lo) || 1)) * innerWidth
  const sy = (value: number) => margin.top + innerHeight - ((value - y.lo) / ((y.hi - y.lo) || 1)) * innerHeight

  const active = activeId ? cases.find((c) => c.id === activeId) ?? null : null

  const moveActive = (delta: number) => {
    if (ordered.length === 0) return
    const index = active ? ordered.findIndex((c) => c.id === active.id) : delta > 0 ? -1 : 0
    const next = Math.min(ordered.length - 1, Math.max(0, index + delta))
    const target = ordered[next]
    if (target) setActiveId(target.id)
  }

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); moveActive(1) }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); moveActive(-1) }
    else if (event.key === 'Home') { event.preventDefault(); setActiveId(ordered[0]?.id ?? null) }
    else if (event.key === 'End') { event.preventDefault(); setActiveId(ordered[ordered.length - 1]?.id ?? null) }
    else if (event.key === 'Escape') { setActiveId(null) }
  }

  const onMouseMove = (event: MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const px = ((event.clientX - rect.left) / rect.width) * width
    const py = ((event.clientY - rect.top) / rect.height) * height
    let best: { id: string; d: number } | null = null
    for (const item of cases) {
      const dx = sx(item.inputs.weightLb) - px
      const dy = sy(item.output.requiredRunwayFt) - py
      const d = dx * dx + dy * dy
      if (!best || d < best.d) best = { id: item.id, d }
    }
    if (best) setActiveId(best.id)
  }

  const seriesClass = (index: number) => (index % 2 === 0 ? 'plot-series-primary' : 'plot-series-secondary')

  return (
    <div className="chart-panel">
      <div className="chart-header">
        <div>
          <h3 className="chart-title">Required runway vs aircraft weight</h3>
          <p className="chart-sub num">
            ft vs lb · {cases.length} case{cases.length === 1 ? '' : 's'} · {families.length} sweep series · planning-grade basis
          </p>
        </div>
        <ul className="chart-legend" aria-label="Chart legend">
          {families.map((family, index) => (
            <li key={family.name}><span className={'legend-line ' + seriesClass(index)} aria-hidden="true" /> {family.name}</li>
          ))}
          {singles.length > 0 && <li><span className="legend-diamond" aria-hidden="true" /> Single case</li>}
          <li><span className="legend-dot legend-success" aria-hidden="true" /> Within limits</li>
          <li><span className="legend-dot legend-warning" aria-hidden="true" /> Caution</li>
          <li><span className="legend-dot legend-danger" aria-hidden="true" /> Out of limits</li>
        </ul>
      </div>

      <div className="plot-layout">
        <div className="xy-plot-frame">
          <svg
            ref={svgRef}
            className="xy-plot"
            viewBox={'0 0 ' + width + ' ' + height}
            role="application"
            tabIndex={0}
            aria-label={'XY chart of ' + cases.length + ' saved performance cases: required runway in feet against aircraft weight in pounds. Arrow keys walk the cases by weight; the readout below reports exact values. Every case is also listed beside the chart.'}
            onKeyDown={onKeyDown}
            onMouseMove={onMouseMove}
            onMouseLeave={() => setActiveId(null)}
          >
            <rect className="plot-area" x={margin.left} y={margin.top} width={innerWidth} height={innerHeight} />
            {y.ticks.map((tick) => (
              <g key={'y-' + tick}>
                <line className="plot-grid" x1={margin.left} x2={width - margin.right} y1={sy(tick)} y2={sy(tick)} />
                <text className="plot-tick num" x={margin.left - 10} y={sy(tick) + 4} textAnchor="end">{formatNumber(tick)}</text>
              </g>
            ))}
            {x.ticks.map((tick) => (
              <g key={'x-' + tick}>
                <line className="plot-grid" x1={sx(tick)} x2={sx(tick)} y1={margin.top} y2={height - margin.bottom} />
                <text className="plot-tick num" x={sx(tick)} y={height - margin.bottom + 22} textAnchor="middle">{formatNumber(tick)}</text>
              </g>
            ))}

            {active && (
              <g className="plot-crosshair" aria-hidden="true">
                <line x1={sx(active.inputs.weightLb)} x2={sx(active.inputs.weightLb)} y1={margin.top} y2={height - margin.bottom} />
                <line x1={margin.left} x2={width - margin.right} y1={sy(active.output.requiredRunwayFt)} y2={sy(active.output.requiredRunwayFt)} />
                <circle className="plot-halo" cx={sx(active.inputs.weightLb)} cy={sy(active.output.requiredRunwayFt)} r={11} />
              </g>
            )}

            {families.map((family, index) => (
              <polyline
                key={family.name}
                className={'plot-series ' + seriesClass(index)}
                fill="none"
                points={family.points.map((p) => sx(p.inputs.weightLb) + ',' + sy(p.output.requiredRunwayFt)).join(' ')}
              />
            ))}
            {families.flatMap((family) => family.points).map((item) => (
              <circle
                key={item.id}
                className={'plot-marker point-' + statusTone(item.output.status) + (item.id === activeId ? ' active' : '')}
                cx={sx(item.inputs.weightLb)}
                cy={sy(item.output.requiredRunwayFt)}
                r={4.5}
              />
            ))}
            {singles.map((item) => {
              const cx = sx(item.inputs.weightLb)
              const cy = sy(item.output.requiredRunwayFt)
              return (
                <rect
                  key={item.id}
                  className={'plot-marker point-' + statusTone(item.output.status) + (item.id === activeId ? ' active' : '')}
                  x={cx - 4.5}
                  y={cy - 4.5}
                  width={9}
                  height={9}
                  transform={'rotate(45 ' + cx + ' ' + cy + ')'}
                />
              )
            })}

            <text className="plot-axis-label" x={margin.left + innerWidth / 2} y={height - 8} textAnchor="middle">Aircraft weight (lb)</text>
            <text className="plot-axis-label" transform={'translate(16 ' + (margin.top + innerHeight / 2) + ') rotate(-90)'} textAnchor="middle">Required runway (ft)</text>
          </svg>
          <p className="plot-readout-line num" role="status" aria-live="polite">
            {active
              ? active.label + ' — ' + formatNumber(active.inputs.weightLb) + ' lb · ' + formatNumber(active.output.requiredRunwayFt) + ' ft required · ' + formatNumber(active.output.runwayMarginFt) + ' ft margin · ' + statusText(active.output.status)
              : 'Hover the chart or focus it and use ← → Home End for exact values.'}
          </p>
        </div>

        <div className="plot-side" aria-label="Saved case values">
          <div className="case-mini-scroll">
            <table className="case-mini-table">
              <caption className="sr-only">Saved cases ordered by weight; selecting a row highlights its point on the chart.</caption>
              <thead>
                <tr>
                  <th scope="col">Case</th>
                  <th scope="col" className="cell-num">Wt (lb)</th>
                  <th scope="col" className="cell-num">Req (ft)</th>
                  <th scope="col" className="cell-num">Mgn (ft)</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((item) => (
                  <tr
                    key={item.id}
                    className={item.id === activeId ? 'active' : undefined}
                    onClick={() => setActiveId(item.id)}
                  >
                    <td className="case-label" title={item.label}><span>{item.label}</span></td>
                    <td className="cell-num num">{formatNumber(item.inputs.weightLb)}</td>
                    <td className="cell-num num">{formatNumber(item.output.requiredRunwayFt)}</td>
                    <td className="cell-num num">{formatNumber(item.output.runwayMarginFt)}</td>
                    <td>
                      <span className={'mini-status point-' + statusTone(item.output.status)} title={statusText(item.output.status)}>
                        <span className="status-dot" aria-hidden="true" />
                        {MINI_STATUS[item.output.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function SweepPanel({
  sweep,
  errors,
  saving,
  message,
  onSweepChange,
  onSaveSweep,
}: {
  sweep: SweepConfig
  errors: SweepErrors
  saving: boolean
  message: string | null
  onSweepChange: (key: keyof SweepConfig, value: number) => void
  onSaveSweep: () => void
}) {
  const plannedWeights = sweepWeights(sweep)
  const describedBy = ['sweep-help', errors.range ? 'sweep-range-error' : null].filter(Boolean).join(' ')
  return (
    <section className="sweep-panel" aria-labelledby="sweep-title" aria-describedby={describedBy}>
      <div className="sweep-head">
        <div>
          <h3 id="sweep-title">Weight sweep</h3>
          <p id="sweep-help">Create one-to-many cases from the current inputs by varying aircraft weight. Each generated case is saved through the existing API and appears in the saved-case table.</p>
        </div>
        <span className="sweep-count">{plannedWeights.length} case{plannedWeights.length === 1 ? '' : 's'}</span>
      </div>

      <div className="sweep-grid">
        <FormField id="sweepStart" label="Start weight" hint="lb" error={errors.startWeightLb}>
          <input
            id="sweepStart"
            type="number"
            min="30000"
            max="90000"
            value={sweep.startWeightLb}
            aria-invalid={Boolean(errors.startWeightLb)}
            aria-describedby={errors.startWeightLb ? 'sweepStart-error sweepStart-hint' : 'sweepStart-hint'}
            onChange={(event) => onSweepChange('startWeightLb', Number(event.target.value))}
          />
        </FormField>
        <FormField id="sweepEnd" label="End weight" hint="lb" error={errors.endWeightLb}>
          <input
            id="sweepEnd"
            type="number"
            min="30000"
            max="90000"
            value={sweep.endWeightLb}
            aria-invalid={Boolean(errors.endWeightLb)}
            aria-describedby={errors.endWeightLb ? 'sweepEnd-error sweepEnd-hint' : 'sweepEnd-hint'}
            onChange={(event) => onSweepChange('endWeightLb', Number(event.target.value))}
          />
        </FormField>
        <FormField id="sweepStep" label="Step" hint="lb" error={errors.stepWeightLb}>
          <input
            id="sweepStep"
            type="number"
            min="100"
            max="10000"
            value={sweep.stepWeightLb}
            aria-invalid={Boolean(errors.stepWeightLb)}
            aria-describedby={errors.stepWeightLb ? 'sweepStep-error sweepStep-hint' : 'sweepStep-hint'}
            onChange={(event) => onSweepChange('stepWeightLb', Number(event.target.value))}
          />
        </FormField>
      </div>

      {errors.range && <p id="sweep-range-error" className="field-error sweep-error">{errors.range}</p>}
      {plannedWeights.length > 0 && (
        <p className="sweep-preview">
          Planned weights: {plannedWeights.map((weight) => `${formatNumber(weight)} lb`).join(', ')}
        </p>
      )}
      {message && <p className="sweep-message" role="status">{message}</p>}

      <div className="sweep-actions">
        <button type="button" className="button secondary" onClick={onSaveSweep} disabled={saving}>
          {saving ? 'Saving sweep…' : 'Save sweep cases'}
        </button>
      </div>
    </section>
  )
}

function Alert({ tone, title, children }: { tone: 'info' | 'danger' | 'warning'; title: string; children: React.ReactNode }) {
  return (
    <div className={`alert alert-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <strong>{title}</strong>
      <span>{children}</span>
    </div>
  )
}

function OutputPanel({ output }: { output: PerformanceOutput }) {
  return (
    <section className="panel output-panel" aria-label="Calculation output">
      <div className="panel-head">
        <div>
          <h2>Calculation output</h2>
          <p>Planning result returned by the local JSON API.</p>
        </div>
        <StatusBadge status={output.status} />
      </div>

      <div className="output-grid">
        <SummaryCard label="Required runway" value={`${formatNumber(output.requiredRunwayFt)} ft`} detail="Controlling takeoff or landing distance" tone={statusTone(output.status)} />
        <SummaryCard label="Runway margin" value={`${formatNumber(output.runwayMarginFt)} ft`} detail={`Limit: ${output.limitingFactor}`} tone={output.runwayMarginFt < 0 ? 'danger' : output.runwayMarginFt < 1000 ? 'warning' : 'success'} />
        <SummaryCard label="Climb gradient" value={`${output.climbGradientPct.toFixed(1)}%`} detail="Planning threshold 3.3%" tone={output.climbGradientPct < 3.3 ? 'danger' : output.climbGradientPct < 4 ? 'warning' : 'success'} />
        <SummaryCard label="Max allowable weight" value={`${formatNumber(output.maxAllowableWeightLb)} lb`} detail="Estimated runway-limited value" />
      </div>

      <dl className="technical-list">
        <div>
          <dt>Takeoff distance</dt>
          <dd>{formatNumber(output.takeoffDistanceFt)} ft</dd>
        </div>
        <div>
          <dt>Accelerate-stop distance</dt>
          <dd>{formatNumber(output.accelerateStopDistanceFt)} ft</dd>
        </div>
        <div>
          <dt>Landing distance</dt>
          <dd>{formatNumber(output.landingDistanceFt)} ft</dd>
        </div>
        <div>
          <dt>Approach speed</dt>
          <dd>{output.approachSpeedKt} kt</dd>
        </div>
      </dl>

      <div className="advisory-block">
        <h3>Advisory notes</h3>
        <ul>
          {output.advisory.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>{output.calculationBasis}</p>
      </div>
    </section>
  )
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <section className="panel state-panel" aria-live="polite">
      <span className="loader" aria-hidden="true" />
      <p>{label}</p>
    </section>
  )
}

function EmptyPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel state-panel">
      <h2>{title}</h2>
      <p>{children}</p>
    </section>
  )
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="panel state-panel" role="alert">
      <h2>Unable to load performance cases</h2>
      <p>{message}</p>
      <button type="button" className="button secondary" onClick={onRetry}>
        Retry
      </button>
    </section>
  )
}

function FormField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      <p id={`${id}-hint`} className="hint">
        {hint ?? '\u00A0'}
      </p>
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
      {describedBy && <span className="sr-only">Field described by {describedBy}</span>}
    </div>
  )
}

function ReviewDialog({
  output,
  onClose,
}: {
  output: PerformanceOutput
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    return () => returnFocus.current?.focus()
  }, [])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [],
    ).filter((item) => !item.hasAttribute('disabled'))

    if (!focusable.length) return
    const first = focusable[0]!
    const last = focusable[focusable.length - 1]!

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="dialog-scrim" role="presentation">
      <div
        ref={dialogRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
        aria-describedby="review-description"
        onKeyDown={onKeyDown}
      >
        <div className="dialog-head">
          <div>
            <h2 id="review-title">Review calculation</h2>
            <p id="review-description">Review the API result before saving this case.</p>
          </div>
          <button ref={closeRef} type="button" className="icon-button" aria-label="Close review dialog" onClick={onClose}>
            ×
          </button>
        </div>
        <OutputPanel output={output} />
        <div className="dialog-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Return to form
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [view, setView] = useState<View>('dashboard')
  const [cases, setCases] = useState<PerformanceCase[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [form, setForm] = useState<CaseInput>({ ...emptyCase, inputs: { ...emptyInputs } })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [validation, setValidation] = useState<ValidationErrors>({})
  const [preview, setPreview] = useState<PerformanceOutput | null>(null)
  const [dialogOutput, setDialogOutput] = useState<PerformanceOutput | null>(null)
  const [saving, setSaving] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [casesView, setCasesView] = useState<CasePresentationView>('table')
  const [sweep, setSweep] = useState<SweepConfig>(defaultSweep)
  const [sweepErrors, setSweepErrors] = useState<SweepErrors>({})
  const [sweepSaving, setSweepSaving] = useState(false)
  const [sweepMessage, setSweepMessage] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    setLoadError(null)
    try {
      const payload = await listCases()
      setCases(payload.cases)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unknown API error.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const dashboard = useMemo(() => {
    const sorted = [...cases].sort((a, b) => outputRank(a) - outputRank(b) || a.output.runwayMarginFt - b.output.runwayMarginFt)
    const out = cases.filter((item) => item.output.status === 'out-of-limits').length
    const caution = cases.filter((item) => item.output.status === 'caution').length
    const minMargin = cases.length ? Math.min(...cases.map((item) => item.output.runwayMarginFt)) : 0
    const maxWeightLimited = cases.length ? Math.min(...cases.map((item) => item.output.maxAllowableWeightLb)) : 0
    return { sorted, out, caution, minMargin, maxWeightLimited }
  }, [cases])

  function patchInput<K extends keyof PerformanceInputs>(key: K, value: PerformanceInputs[K]) {
    setForm((current) => ({
      ...current,
      inputs: {
        ...current.inputs,
        [key]: value,
      },
    }))
    setPreview(null)
    setSweepMessage(null)
  }

  function onNumberChange(key: keyof Pick<PerformanceInputs, 'runwayLengthFt' | 'pressureAltitudeFt' | 'oatC' | 'weightLb' | 'windComponentKt'>) {
    return (event: ChangeEvent<HTMLInputElement>) => patchInput(key, Number(event.target.value))
  }

  async function reviewCalculation() {
    const errors = validate(form)
    setValidation(errors)
    setApiError(null)
    if (Object.keys(errors).length) return

    try {
      const result = await calculateCase({
        label: form.label.trim() || defaultLabel(form.inputs),
        inputs: form.inputs,
      })
      setPreview(result)
      setDialogOutput(result)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Calculation request failed.')
    }
  }

  async function saveCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = { label: form.label.trim() || defaultLabel(form.inputs), inputs: form.inputs }
    const errors = validate(normalized)
    setValidation(errors)
    setApiError(null)
    if (Object.keys(errors).length) return

    setSaving(true)
    try {
      const saved = editingId ? await updateCase(editingId, normalized) : await createCase(normalized)
      setCases((current) => {
        const without = current.filter((item) => item.id !== saved.id)
        return [saved, ...without]
      })
      setPreview(saved.output)
      setEditingId(saved.id)
      setForm({ label: saved.label, inputs: saved.inputs })
      setView('cases')
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Save request failed.')
    } finally {
      setSaving(false)
    }
  }


  function updateSweep(key: keyof SweepConfig, value: number) {
    setSweep((current) => ({ ...current, [key]: value }))
    setSweepErrors({})
    setSweepMessage(null)
  }

  async function saveSweepCases() {
    const normalized = { label: form.label.trim() || defaultLabel(form.inputs), inputs: form.inputs }
    const baseErrors = validate(normalized)
    const nextSweepErrors = validateSweep(sweep)
    setValidation(baseErrors)
    setSweepErrors(nextSweepErrors)
    setApiError(null)
    setSweepMessage(null)
    if (Object.keys(baseErrors).length || Object.keys(nextSweepErrors).length) return

    const weights = sweepWeights(sweep)
    setSweepSaving(true)
    try {
      const savedCases: PerformanceCase[] = []
      for (const weight of weights) {
        const saved = await createCase({
          label: `${normalized.label} · sweep ${formatNumber(weight)} lb`,
          inputs: {
            ...normalized.inputs,
            weightLb: weight,
          },
        })
        savedCases.push(saved)
      }
      setCases((current) => {
        const savedIds = new Set(savedCases.map((item) => item.id))
        return [...savedCases.reverse(), ...current.filter((item) => !savedIds.has(item.id))]
      })
      const lastSaved = savedCases[0]
      if (lastSaved) setPreview(lastSaved.output)
      setEditingId(null)
      setCasesView('table')
      setView('cases')
      setSweepMessage(`${weights.length} sweep case${weights.length === 1 ? '' : 's'} saved to the tabular output view.`)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Sweep save request failed.')
    } finally {
      setSweepSaving(false)
    }
  }

  function editCase(item: PerformanceCase) {
    setEditingId(item.id)
    setForm({ label: item.label, inputs: item.inputs })
    setPreview(item.output)
    setValidation({})
    setSweepErrors({})
    setSweepMessage(null)
    setApiError(null)
    setView('calculator')
  }

  function resetForm() {
    setEditingId(null)
    setForm({ ...emptyCase, inputs: { ...emptyInputs } })
    setPreview(null)
    setValidation({})
    setSweepErrors({})
    setSweepMessage(null)
    setApiError(null)
    setView('calculator')
  }

  const validationEntries = Object.entries(validation).filter(([, value]) => value)

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">T</span>
          <div>
            <strong>test</strong>
            <span>Performance workbench</span>
          </div>
        </div>

        <nav>
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className="nav-item"
              aria-current={view === item.id ? 'page' : undefined}
              onClick={() => setView(item.id)}
            >
              <span>{item.label}</span>
              <small>{item.description}</small>
            </button>
          ))}
        </nav>

        <div className="sidebar-meta">
          <span>Local API</span>
          <code>/api/cases</code>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Aircraft performance calculator</p>
            <h1>{NAV.find((item) => item.id === view)?.label}</h1>
          </div>
          <button type="button" className="button primary" onClick={resetForm}>
            New case
          </button>
        </header>

        <Alert tone="warning" title="Limitation">
          No aircraft-specific approved AFM/OEM tables were supplied with the packet. Results are explicitly planning/demo-grade and must not be treated as approved performance data.
        </Alert>

        {view === 'dashboard' && (
          <>
            {loading ? (
              <LoadingPanel label="Loading saved performance cases…" />
            ) : loadError ? (
              <ErrorPanel message={loadError} onRetry={() => void refresh()} />
            ) : cases.length === 0 ? (
              <EmptyPanel title="No saved cases">Create a performance case to populate the dashboard.</EmptyPanel>
            ) : (
              <>
                <section className="summary-grid" aria-label="Performance summary">
                  <SummaryCard label="Saved cases" value={String(cases.length)} detail="Persisted in the local JSON store" />
                  <SummaryCard label="Out of limits" value={String(dashboard.out)} detail="Cases requiring review" tone={dashboard.out ? 'danger' : 'success'} />
                  <SummaryCard label="Caution" value={String(dashboard.caution)} detail="Margins or climb gradient close to limit" tone={dashboard.caution ? 'warning' : 'success'} />
                  <SummaryCard label="Minimum margin" value={`${formatNumber(dashboard.minMargin)} ft`} detail={`Lowest max weight ${formatNumber(dashboard.maxWeightLimited)} lb`} tone={dashboard.minMargin < 0 ? 'danger' : dashboard.minMargin < 1000 ? 'warning' : 'success'} />
                </section>

                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Priority review</h2>
                      <p>Worst cases first by status and runway margin.</p>
                    </div>
                  </div>
                  <table className="priority-table">
                    <caption className="sr-only">Worst cases first by status and runway margin</caption>
                    <thead>
                      <tr>
                        <th scope="col">Case</th>
                        <th scope="col">Configuration</th>
                        <th scope="col" className="cell-num">Margin (ft)</th>
                        <th scope="col">Status</th>
                        <th scope="col"><span className="sr-only">Action</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.sorted.slice(0, 5).map((item) => (
                        <tr key={item.id}>
                          <td className="case-label-wide"><span title={item.label}>{item.label}</span></td>
                          <td className="cell-muted">{item.inputs.aircraftVariant} · {item.inputs.runwayId} · {item.inputs.mode}</td>
                          <td className="cell-num num">{formatNumber(item.output.runwayMarginFt)}</td>
                          <td><StatusBadge status={item.output.status} /></td>
                          <td className="cell-action">
                            <button type="button" className="button secondary" onClick={() => editCase(item)}>
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              </>
            )}
          </>
        )}

        {view === 'calculator' && (
          <div className="calculator-grid">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>{editingId ? 'Edit performance case' : 'New performance case'}</h2>
                  <p>Inputs are validated in the client and again by the local API.</p>
                </div>
              </div>

              {validationEntries.length > 0 && (
                <div className="validation-summary" role="alert" aria-labelledby="validation-title">
                  <strong id="validation-title">Review required</strong>
                  <ul>
                    {validationEntries.map(([key, message]) => (
                      <li key={key}>{message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {apiError && (
                <Alert tone="danger" title="API error">
                  {apiError}
                </Alert>
              )}

              <form className="form-grid" onSubmit={saveCase}>
                <FormField id="label" label="Case label" error={validation.label}>
                  <input
                    id="label"
                    value={form.label}
                    aria-invalid={Boolean(validation.label)}
                    aria-describedby={validation.label ? 'label-error' : undefined}
                    onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                    placeholder={defaultLabel(form.inputs)}
                  />
                </FormField>

                <FormField id="mode" label="Operation">
                  <select id="mode" value={form.inputs.mode} onChange={(event) => patchInput('mode', event.target.value as OperationMode)}>
                    <option value="takeoff">Takeoff</option>
                    <option value="landing">Landing</option>
                  </select>
                </FormField>

                <FormField id="aircraft" label="Aircraft variant">
                  <select id="aircraft" value={form.inputs.aircraftVariant} onChange={(event) => patchInput('aircraftVariant', event.target.value as AircraftVariant)}>
                    <option value="GL-350">GL-350</option>
                    <option value="GL-500">GL-500</option>
                    <option value="GL-650">GL-650</option>
                  </select>
                </FormField>

                <FormField id="runway" label="Runway" error={validation.runwayId}>
                  <input
                    id="runway"
                    value={form.inputs.runwayId}
                    aria-invalid={Boolean(validation.runwayId)}
                    aria-describedby={validation.runwayId ? 'runway-error' : undefined}
                    onChange={(event) => patchInput('runwayId', event.target.value)}
                  />
                </FormField>

                <FormField id="runwayLength" label="Runway length" hint="Feet available." error={validation.runwayLengthFt}>
                  <input
                    id="runwayLength"
                    type="number"
                    min="1500"
                    max="16000"
                    value={form.inputs.runwayLengthFt}
                    aria-invalid={Boolean(validation.runwayLengthFt)}
                    aria-describedby={validation.runwayLengthFt ? 'runwayLength-error runwayLength-hint' : 'runwayLength-hint'}
                    onChange={onNumberChange('runwayLengthFt')}
                  />
                </FormField>

                <FormField id="pressureAltitude" label="Pressure altitude" hint="Feet." error={validation.pressureAltitudeFt}>
                  <input
                    id="pressureAltitude"
                    type="number"
                    min="-2000"
                    max="14000"
                    value={form.inputs.pressureAltitudeFt}
                    aria-invalid={Boolean(validation.pressureAltitudeFt)}
                    aria-describedby={validation.pressureAltitudeFt ? 'pressureAltitude-error pressureAltitude-hint' : 'pressureAltitude-hint'}
                    onChange={onNumberChange('pressureAltitudeFt')}
                  />
                </FormField>

                <FormField id="oat" label="Outside air temperature" hint="°C." error={validation.oatC}>
                  <input
                    id="oat"
                    type="number"
                    min="-40"
                    max="55"
                    value={form.inputs.oatC}
                    aria-invalid={Boolean(validation.oatC)}
                    aria-describedby={validation.oatC ? 'oat-error oat-hint' : 'oat-hint'}
                    onChange={onNumberChange('oatC')}
                  />
                </FormField>

                <FormField id="weight" label="Aircraft weight" hint="Pounds." error={validation.weightLb}>
                  <input
                    id="weight"
                    type="number"
                    min="30000"
                    max="90000"
                    value={form.inputs.weightLb}
                    aria-invalid={Boolean(validation.weightLb)}
                    aria-describedby={validation.weightLb ? 'weight-error weight-hint' : 'weight-hint'}
                    onChange={onNumberChange('weightLb')}
                  />
                </FormField>

                <FormField id="wind" label="Wind component" hint="Headwind positive; tailwind negative." error={validation.windComponentKt}>
                  <input
                    id="wind"
                    type="number"
                    min="-20"
                    max="40"
                    value={form.inputs.windComponentKt}
                    aria-invalid={Boolean(validation.windComponentKt)}
                    aria-describedby={validation.windComponentKt ? 'wind-error wind-hint' : 'wind-hint'}
                    onChange={onNumberChange('windComponentKt')}
                  />
                </FormField>

                <FormField id="condition" label="Runway condition">
                  <select id="condition" value={form.inputs.runwayCondition} onChange={(event) => patchInput('runwayCondition', event.target.value as RunwayCondition)}>
                    <option value="dry">Dry</option>
                    <option value="wet">Wet</option>
                  </select>
                </FormField>

                <FormField id="flaps" label="Flap setting">
                  <select id="flaps" value={form.inputs.flapSetting} onChange={(event) => patchInput('flapSetting', event.target.value as FlapSetting)}>
                    <option value="10">Flaps 10</option>
                    <option value="15">Flaps 15</option>
                    <option value="20">Flaps 20</option>
                  </select>
                </FormField>

                <FormField id="notes" label="Notes" hint="Optional review context.">
                  <textarea
                    id="notes"
                    rows={4}
                    value={form.inputs.notes}
                    aria-describedby="notes-hint"
                    onChange={(event) => patchInput('notes', event.target.value)}
                  />
                </FormField>


                <div className="form-wide">
                  <SweepPanel
                    sweep={sweep}
                    errors={sweepErrors}
                    saving={sweepSaving}
                    message={sweepMessage}
                    onSweepChange={updateSweep}
                    onSaveSweep={() => void saveSweepCases()}
                  />
                </div>

                <div className="form-actions">
                  <button type="button" className="button secondary" onClick={() => void reviewCalculation()}>
                    Review calculation
                  </button>
                  <button type="submit" className="button primary" disabled={saving}>
                    {saving ? 'Saving…' : editingId ? 'Update case' : 'Save case'}
                  </button>
                </div>
              </form>
            </section>

            {preview ? (
              <OutputPanel output={preview} />
            ) : (
              <EmptyPanel title="No calculation reviewed">Use Review calculation to call the API and inspect output before saving.</EmptyPanel>
            )}
          </div>
        )}

        {view === 'cases' && (
          <>
            {loading ? (
              <LoadingPanel label="Loading saved cases…" />
            ) : loadError ? (
              <ErrorPanel message={loadError} onRetry={() => void refresh()} />
            ) : cases.length === 0 ? (
              <EmptyPanel title="No saved cases">Save a calculator case to create the first persisted record.</EmptyPanel>
            ) : (
              <section className="panel table-panel">
                <div className="panel-head">
                  <div>
                    <h2>Saved performance cases</h2>
                    <p>{cases.length} records loaded from the local server, including single cases and generated sweeps. Use the table for case outputs or the XY plot for weight-to-runway trends.</p>
                  </div>
                  <div className="view-toggle" role="group" aria-label="Saved cases view">
                    <button type="button" aria-pressed={casesView === 'table'} onClick={() => setCasesView('table')}>
                      Table
                    </button>
                    <button type="button" aria-pressed={casesView === 'plot'} onClick={() => setCasesView('plot')}>
                      XY plot
                    </button>
                  </div>
                </div>

                {casesView === 'table' ? (
                  <table>
                    <caption className="sr-only">Tabular output view for saved aircraft performance cases, including sweep-generated cases and calculated output values</caption>
                    <thead>
                      <tr>
                        <th scope="col">Case</th>
                        <th scope="col">Aircraft</th>
                        <th scope="col">Runway</th>
                        <th scope="col">Weight</th>
                        <th scope="col">PA / OAT</th>
                        <th scope="col">Required</th>
                        <th scope="col">Margin</th>
                        <th scope="col">Climb</th>
                        <th scope="col">Vref</th>
                        <th scope="col">Status</th>
                        <th scope="col">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cases.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.label}</strong>
                            <span>{new Date(item.updatedAt).toLocaleString()}</span>
                          </td>
                          <td>{item.inputs.aircraftVariant}</td>
                          <td>{item.inputs.runwayId}</td>
                          <td>{formatNumber(item.inputs.weightLb)} lb</td>
                          <td>{formatNumber(item.inputs.pressureAltitudeFt)} ft / {item.inputs.oatC} °C</td>
                          <td>{formatNumber(item.output.requiredRunwayFt)} ft</td>
                          <td>
                            <code>{formatNumber(item.output.runwayMarginFt)} ft</code>
                          </td>
                          <td>{item.output.climbGradientPct.toFixed(1)}%</td>
                          <td>{item.output.approachSpeedKt} kt</td>
                          <td>
                            <StatusBadge status={item.output.status} />
                          </td>
                          <td>
                            <button type="button" className="button secondary" onClick={() => editCase(item)}>
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <CasesPlot cases={cases} onEdit={editCase} />
                )}
              </section>
            )}
          </>
        )}
      </main>

      {dialogOutput && <ReviewDialog output={dialogOutput} onClose={() => setDialogOutput(null)} />}
    </div>
  )
}
