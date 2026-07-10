/**
 * Case calculator — a three-step wizard (RCP-WORKFLOW-001): grouped inputs
 * with the live density-altitude readout and variant envelopes → review with
 * the contribution breakdown → explicit save. Also generates weight sweeps.
 */

import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import type { CaseInputs, FlapSetting, Operation, PerformanceCase, Runway, RunwayCondition, Variant } from '../../shared/model'
import {
  CONDITIONS, FLAPS, MAX_SWEEP_POINTS, OPERATIONS, SPECS, VARIANTS,
  breakdown, computeOutputs, densityAltitudeFt, sweepWeights,
} from '../../shared/model'
import { formatInt, formatSigned, formatValue, statusLabel } from '../../shared/format'
import { ApiError, createCase, createCasesBulk, updateCase } from '../api'
import { href, navigate } from '../router'
import { WizardActions, WizardPhase, WizardStepper } from '../components/Wizard'

const STEPS = [
  { id: 'inputs', label: 'Inputs' },
  { id: 'review', label: 'Review calculation' },
  { id: 'save', label: 'Save case' },
]

export function Calculator(props: { id?: string; cases: PerformanceCase[]; runways: Runway[]; online: boolean; refresh: () => Promise<void> }) {
  const editing = props.id ? props.cases.find((c) => c.id === props.id) : undefined
  if (props.id && !editing) {
    return (
      <div className="remote-state" role="alert">
        <strong>Case not found</strong>
        <a className="button secondary" href={href.cases}>Back to saved cases</a>
      </div>
    )
  }
  return <CalculatorBody key={editing?.id ?? 'new'} editing={editing} {...props} />
}

function CalculatorBody({ editing, cases, runways, online, refresh }: {
  editing?: PerformanceCase
  cases: PerformanceCase[]
  runways: Runway[]
  online: boolean
  refresh: () => Promise<void>
}) {
  const [label, setLabel] = useState(editing?.label ?? '')
  const [inputs, setInputs] = useState<CaseInputs>(editing?.inputs ?? {
    operation: 'takeoff', variant: 'GL-500', runwayId: runways[0]?.id ?? 'KSVN RWY 10',
    runwayLengthFt: runways[0]?.lengthFt ?? 5000, pressureAltitudeFt: 100, oatC: 27,
    weightLb: 60000, windKt: 5, runwayCondition: 'dry', flapSetting: '15',
  })
  const [step, setStep] = useState(0)
  const [furthest, setFurthest] = useState(editing ? STEPS.length - 1 : 0)
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [sweepOpen, setSweepOpen] = useState(false)
  const [sweep, setSweep] = useState({ start: 52000, end: 68000, step: 4000 })

  const spec = SPECS[inputs.variant]
  const densityAlt = densityAltitudeFt(inputs.pressureAltitudeFt, inputs.oatC)
  const outputs = useMemo(() => computeOutputs(inputs), [inputs])
  const steps = useMemo(() => breakdown(inputs), [inputs])
  const sweepList = sweepWeights(sweep.start, sweep.end, sweep.step)

  const labelTaken = cases.some((c) => c.label.toLowerCase() === label.trim().toLowerCase() && c.id !== editing?.id)

  const setNum = (key: keyof CaseInputs) => (value: string) => setInputs((i) => ({ ...i, [key]: Number(value) }))
  const pickRunway = (id: string) => {
    const runway = runways.find((r) => r.id === id)
    setInputs((i) => ({ ...i, runwayId: id, runwayLengthFt: runway?.lengthFt ?? i.runwayLengthFt }))
  }

  const validateInputs = (): string[] => {
    const problems: string[] = []
    if (!label.trim()) problems.push('Case label is required.')
    if (label.trim().length > 80) problems.push('Case label is limited to 80 characters.')
    if (labelTaken) problems.push(`Case label "${label.trim()}" is already in use.`)
    const limits: [keyof CaseInputs, number, number][] = [
      ['runwayLengthFt', 1000, 20000], ['pressureAltitudeFt', -1000, 14000], ['oatC', -40, 55], ['windKt', -30, 50],
    ]
    for (const [key, lo, hi] of limits) {
      const v = inputs[key] as number
      if (!Number.isFinite(v) || v < lo || v > hi) problems.push(`${key} must be between ${lo.toLocaleString()} and ${hi.toLocaleString()}.`)
    }
    if (!Number.isFinite(inputs.weightLb) || inputs.weightLb < spec.minWeightLb || inputs.weightLb > spec.maxWeightLb) {
      problems.push(`Weight must be within the ${inputs.variant} envelope (${formatInt(spec.minWeightLb)}–${formatInt(spec.maxWeightLb)} lb).`)
    }
    return problems
  }

  const next = () => {
    const problems = validateInputs()
    setErrors(problems)
    if (problems.length > 0) return
    const target = Math.min(STEPS.length - 1, step + 1)
    setStep(target)
    setFurthest((f) => Math.max(f, target))
  }

  const goTo = (index: number) => { setErrors([]); setStep(index) }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const problems = validateInputs()
    setErrors(problems)
    if (problems.length > 0) return
    setBusy(true)
    try {
      const payload = { label: label.trim(), inputs }
      const saved = editing ? await updateCase(editing.id, payload) : await createCase(payload)
      await refresh()
      navigate(href.cases)
      void saved
    } catch (error) {
      setErrors([error instanceof ApiError ? error.message : String(error)])
    } finally {
      setBusy(false)
    }
  }

  const generateSweep = async () => {
    const problems = validateInputs()
    if (sweepList.length === 0 || sweepList.length > MAX_SWEEP_POINTS) problems.push(`Sweep must generate 1–${MAX_SWEEP_POINTS} cases (currently ${sweepList.length}).`)
    const family = label.trim()
    setErrors(problems)
    if (problems.length > 0) return
    setBusy(true)
    try {
      await createCasesBulk(sweepList.map((w) => ({
        label: `${family} · sweep ${w} lb`,
        sweepFamily: family,
        inputs: { ...inputs, weightLb: w },
      })))
      await refresh()
      navigate(href.cases)
    } catch (error) {
      setErrors([error instanceof ApiError ? error.message : String(error)])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">Case calculator</span>
          <h1>{editing ? `Edit — ${editing.label}` : 'Plan a performance case'}</h1>
          <p>Inputs → review the calculation with its contribution breakdown → save explicitly. Nothing persists before step 3.</p>
        </div>
        <div className="page-actions">
          <a className="button secondary" href={href.cases}>Cancel</a>
        </div>
      </header>

      <WizardStepper steps={STEPS} current={step} furthest={furthest} onSelect={goTo} />

      {errors.length > 0 && (
        <div className="validation-summary" role="alert">
          <strong>Review required</strong>
          <ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}

      <form onSubmit={submit} noValidate>
        {step === 0 && (
          <WizardPhase wide>
            <div className="form-group">
              <h3 className="group-header">Identity</h3>
              <div className="form-row">
                <Field id="c-label" label="Case label" hint={labelTaken ? 'This label is already in use.' : 'Unique across saved cases; 80 characters max.'} size="name">
                  <input id="c-label" type="text" value={label} maxLength={80} aria-invalid={labelTaken} onChange={(e) => setLabel(e.target.value)} required />
                </Field>
              </div>
            </div>

            <div className="form-group">
              <h3 className="group-header">Configuration</h3>
              <div className="form-row">
                <Field id="c-operation" label="Operation" size="select">
                  <select id="c-operation" value={inputs.operation} onChange={(e) => setInputs((i) => ({ ...i, operation: e.target.value as Operation }))}>
                    {OPERATIONS.map((o) => <option key={o} value={o}>{o === 'takeoff' ? 'Takeoff' : 'Landing'}</option>)}
                  </select>
                </Field>
                <Field id="c-variant" label="Aircraft variant" hint={`Envelope ${formatInt(spec.minWeightLb)}–${formatInt(spec.maxWeightLb)} lb`} size="select">
                  <select id="c-variant" value={inputs.variant} onChange={(e) => setInputs((i) => ({ ...i, variant: e.target.value as Variant }))}>
                    {VARIANTS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </Field>
                <Field id="c-flap" label="Flap setting" size="select">
                  <select id="c-flap" value={inputs.flapSetting} onChange={(e) => setInputs((i) => ({ ...i, flapSetting: e.target.value as FlapSetting }))}>
                    {FLAPS.map((f) => <option key={f} value={f}>Flap {f}</option>)}
                  </select>
                </Field>
                <Field id="c-cond" label="Runway condition" size="select">
                  <select id="c-cond" value={inputs.runwayCondition} onChange={(e) => setInputs((i) => ({ ...i, runwayCondition: e.target.value as RunwayCondition }))}>
                    {CONDITIONS.map((c) => <option key={c} value={c}>{c === 'dry' ? 'Dry' : 'Wet'}</option>)}
                  </select>
                </Field>
              </div>
            </div>

            <div className="form-group">
              <h3 className="group-header">Environment & runway</h3>
              <div className="form-row">
                <Field id="c-runway" label="Runway" hint="Prefills available length." size="wide-select">
                  <select id="c-runway" value={inputs.runwayId} onChange={(e) => pickRunway(e.target.value)}>
                    {runways.map((r) => <option key={r.id} value={r.id}>{r.id} — {formatInt(r.lengthFt)} ft</option>)}
                  </select>
                </Field>
                <Field id="c-length" label="Available runway (ft)" hint="Editable for studies." size="num">
                  <input id="c-length" type="number" value={inputs.runwayLengthFt} onChange={(e) => setNum('runwayLengthFt')(e.target.value)} required />
                </Field>
                <Field id="c-pa" label="Pressure altitude (ft)" hint="−1,000–14,000" size="num">
                  <input id="c-pa" type="number" value={inputs.pressureAltitudeFt} onChange={(e) => setNum('pressureAltitudeFt')(e.target.value)} required />
                </Field>
                <Field id="c-oat" label="OAT (°C)" hint="−40–55" size="num">
                  <input id="c-oat" type="number" value={inputs.oatC} onChange={(e) => setNum('oatC')(e.target.value)} required />
                </Field>
                <Field id="c-weight" label="Weight (lb)" hint={`${formatInt(spec.minWeightLb)}–${formatInt(spec.maxWeightLb)}`} size="num">
                  <input id="c-weight" type="number" value={inputs.weightLb} onChange={(e) => setNum('weightLb')(e.target.value)} required />
                </Field>
                <Field id="c-wind" label="Wind (kt)" hint="Headwind positive" size="num">
                  <input id="c-wind" type="number" value={inputs.windKt} onChange={(e) => setNum('windKt')(e.target.value)} required />
                </Field>
                <div className="field size-num">
                  <span className="field-label-static">Density altitude</span>
                  <p className="expansion-note num">{formatInt(densityAlt)} ft</p>
                  <p className="field-message">PA + 120 × (OAT − ISA)</p>
                </div>
              </div>
            </div>

            <WizardActions>
              <button type="button" className="button primary" onClick={next}>Next — review calculation</button>
            </WizardActions>
          </WizardPhase>
        )}

        {step === 1 && (
          <WizardPhase wide>
            <p className="review-summary">
              <strong>{label.trim() || 'Untitled case'}</strong> — {inputs.variant} · {inputs.operation} · {inputs.runwayId} ·
              <span className="num"> {formatInt(inputs.weightLb)} lb · DA {formatInt(densityAlt)} ft</span> · outputs are not saved yet.
            </p>

            <div className="review-columns">
              <div className="form-group">
                <h3 className="group-header">Outputs</h3>
                <dl className="output-list">
                  <div><dt>Required runway</dt><dd>{formatInt(outputs.requiredRunwayFt)} ft</dd></div>
                  <div><dt>Runway margin</dt><dd className={outputs.runwayMarginFt < 0 ? 'value-danger' : outputs.runwayMarginFt < 1000 ? 'value-warning' : ''}>{formatSigned(outputs.runwayMarginFt)} ft</dd></div>
                  <div><dt>Status</dt><dd><span className={`status-badge status-${outputs.status}`}>{statusLabel(outputs.status)}</span></dd></div>
                  <div><dt>Limiting factor</dt><dd className="plain">{outputs.limitingFactor}</dd></div>
                  <div><dt>Takeoff distance</dt><dd>{formatInt(outputs.takeoffDistanceFt)} ft</dd></div>
                  <div><dt>Accelerate-stop</dt><dd>{formatInt(outputs.accelerateStopDistanceFt)} ft</dd></div>
                  <div><dt>Landing distance</dt><dd>{formatInt(outputs.landingDistanceFt)} ft</dd></div>
                  <div><dt>Climb gradient</dt><dd>{formatValue(outputs.climbGradientPct, '%')}</dd></div>
                  <div><dt>Approach speed</dt><dd>{outputs.approachSpeedKt} kt</dd></div>
                  <div><dt>Max allowable weight</dt><dd>{formatInt(outputs.maxAllowableWeightLb)} lb</dd></div>
                  <div><dt>Headroom to caution</dt><dd>{formatSigned(outputs.headroomToCautionLb)} lb</dd></div>
                  <div><dt>Headroom to limit</dt><dd>{formatSigned(outputs.headroomToLimitLb)} lb</dd></div>
                </dl>
                <p className="field-message">{outputs.basis}</p>
              </div>

              <div className="form-group">
                <h3 className="group-header">Contribution breakdown</h3>
                <div className="table-surface table-scroll">
                  <table className="registry-table">
                    <caption className="sr-only">How the base distance becomes the required runway</caption>
                    <thead>
                      <tr><th>Factor</th><th>Basis</th><th className="numeric">Multiplier</th><th className="numeric">Running (ft)</th></tr>
                    </thead>
                    <tbody>
                      {steps.map((s) => (
                        <tr key={s.factorLabel}>
                          <td className="nowrap">{s.factorLabel}</td>
                          <td className="cell-muted">{s.detail}</td>
                          <td className="numeric">{s.multiplier.toFixed(3)}</td>
                          <td className="numeric">{formatInt(s.runningFt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <WizardActions>
              <button type="button" className="button secondary" onClick={() => goTo(0)}>Back</button>
              <button type="button" className="button primary" onClick={next}>Next — save case</button>
            </WizardActions>
          </WizardPhase>
        )}

        {step === 2 && (
          <WizardPhase>
            <p className="review-summary">
              Saving <strong>{label.trim() || 'Untitled case'}</strong> — {inputs.variant} · {inputs.operation} · {inputs.runwayId} ·
              <span className="num"> {formatInt(inputs.weightLb)} lb → {formatInt(outputs.requiredRunwayFt)} ft required · {formatSigned(outputs.runwayMarginFt)} ft margin</span> · {statusLabel(outputs.status)}.
            </p>

            <WizardActions>
              <button type="button" className="button secondary" onClick={() => goTo(1)}>Back</button>
              <button type="submit" className="button primary" disabled={busy || !online}>
                {busy ? 'Saving…' : editing ? 'Save changes' : 'Save case'}
              </button>
              {!editing && (
                <button type="button" className="button secondary" onClick={() => setSweepOpen((v) => !v)}>
                  {sweepOpen ? 'Hide weight sweep' : 'Generate weight sweep…'}
                </button>
              )}
              {!online && <span className="disabled-explanation">Offline — saving is disabled until the connection returns.</span>}
            </WizardActions>

            {sweepOpen && !editing && (
              <div className="form-group" style={{ marginTop: 'var(--spacing-4)' }}>
                <h3 className="group-header">Weight sweep from this configuration</h3>
                <div className="form-row">
                  <Field id="w-start" label="Start (lb)" size="num">
                    <input id="w-start" type="number" value={sweep.start} onChange={(e) => setSweep((s) => ({ ...s, start: Number(e.target.value) }))} />
                  </Field>
                  <Field id="w-end" label="End (lb)" size="num">
                    <input id="w-end" type="number" value={sweep.end} onChange={(e) => setSweep((s) => ({ ...s, end: Number(e.target.value) }))} />
                  </Field>
                  <Field id="w-step" label="Step (lb)" hint={`≤ ${MAX_SWEEP_POINTS} cases`} size="num">
                    <input id="w-step" type="number" value={sweep.step} onChange={(e) => setSweep((s) => ({ ...s, step: Number(e.target.value) }))} />
                  </Field>
                  <div className="field size-grow">
                    <span className="field-label-static">Family</span>
                    <p className="expansion-note num">{sweepList.length} case{sweepList.length === 1 ? '' : 's'} · “{label.trim() || '…'} · sweep ‹weight› lb”</p>
                    <p className="field-message">Each generated case saves through the same API.</p>
                  </div>
                </div>
                <WizardActions>
                  <button type="button" className="button primary" disabled={busy || !online} onClick={() => void generateSweep()}>
                    {busy ? 'Generating…' : `Generate ${sweepList.length} cases`}
                  </button>
                </WizardActions>
              </div>
            )}
          </WizardPhase>
        )}
      </form>
    </>
  )
}

function Field({ id, label, hint, size, children }: {
  id: string
  label: string
  hint?: string
  size?: 'num' | 'select' | 'wide-select' | 'id' | 'name' | 'grow'
  children: ReactNode
}) {
  return (
    <div className={size ? `field size-${size}` : 'field'}>
      <label htmlFor={id}>{label}</label>
      {children}
      <p id={`${id}-hint`} className="field-message">{hint ?? ' '}</p>
    </div>
  )
}
