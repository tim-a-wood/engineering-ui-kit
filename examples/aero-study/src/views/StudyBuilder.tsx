/**
 * Study builder as a stepped wizard (RCP-WORKFLOW-001): 1 identity &
 * baseline → 2 sweep & compare → 3 preview & save. Fields group under
 * ruled headers in content-sized rows that fill the working width;
 * controls size to what they hold.
 */

import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import type { CompareDimension, PerfInputs, Study, SweepField } from '../../shared/model'
import {
  CONDITIONS, FLAPS, MAX_SWEEP_POINTS, OPERATIONS, VARIANTS, expandStudy, sweepValues,
} from '../../shared/model'
import { SWEEP_TO_AXIS } from '../../shared/fields'
import { createStudy, updateStudy, ApiError, type StudyInput } from '../api'
import { href, navigate } from '../router'
import { StudyChart } from '../chart/StudyChart'
import { toPlotSeries } from '../chart/analysis'
import { WizardActions, WizardPhase, WizardStepper } from '../components/Wizard'

const STEPS = [
  { id: 'identity', label: 'Identity & baseline' },
  { id: 'sweep', label: 'Sweep & compare' },
  { id: 'review', label: 'Preview & save' },
]

const SWEEP_OPTIONS: { key: SweepField; label: string; unit: string }[] = [
  { key: 'weightLb', label: 'Aircraft weight', unit: 'lb' },
  { key: 'pressureAltitudeFt', label: 'Pressure altitude', unit: 'ft' },
  { key: 'oatC', label: 'Outside air temperature', unit: '°C' },
  { key: 'windKt', label: 'Wind component', unit: 'kt' },
  { key: 'runwayLengthFt', label: 'Available runway', unit: 'ft' },
]

const COMPARE_OPTIONS: { key: CompareDimension; label: string }[] = [
  { key: 'none', label: 'None — single series' },
  { key: 'variant', label: 'Aircraft variant' },
  { key: 'runwayCondition', label: 'Runway condition' },
  { key: 'flapSetting', label: 'Flap setting' },
  { key: 'operation', label: 'Operation' },
]

const NUM_LIMITS: Record<string, [number, number]> = {
  runwayLengthFt: [1000, 20000],
  pressureAltitudeFt: [-1000, 14000],
  oatC: [-40, 55],
  weightLb: [30000, 90000],
  windKt: [-30, 50],
}

export function StudyBuilder(props: { id?: string; studies: Study[]; online: boolean; refresh: () => Promise<void> }) {
  const editing = props.id ? props.studies.find((s) => s.id === props.id) : undefined
  if (props.id && !editing) {
    return (
      <div className="remote-state" role="alert">
        <strong>Study not found</strong>
        <a className="button secondary" href={href.list}>Back to studies</a>
      </div>
    )
  }
  return <BuilderBody key={editing?.id ?? 'new'} editing={editing} online={props.online} refresh={props.refresh} />
}

function BuilderBody({ editing, online, refresh }: { editing?: Study; online: boolean; refresh: () => Promise<void> }) {
  const [name, setName] = useState(editing?.name ?? '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [baseline, setBaseline] = useState<PerfInputs>(editing?.baseline ?? {
    operation: 'takeoff', variant: 'GL-500', runwayId: 'KSVN RWY 10', runwayLengthFt: 5000,
    pressureAltitudeFt: 100, oatC: 27, weightLb: 60000, windKt: 5, runwayCondition: 'dry', flapSetting: '15',
  })
  const [sweep, setSweep] = useState(editing?.sweep ?? { field: 'weightLb' as SweepField, start: 48000, end: 72000, step: 2000 })
  const [compareBy, setCompareBy] = useState<CompareDimension>(editing?.compareBy ?? 'none')
  const [step, setStep] = useState(0)
  const [furthest, setFurthest] = useState(editing ? STEPS.length - 1 : 0)
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const pointCount = sweepValues(sweep).length
  const preview = useMemo(() => {
    if (pointCount === 0 || pointCount > MAX_SWEEP_POINTS) return null
    return expandStudy({ baseline, sweep, compareBy })
  }, [baseline, sweep, compareBy, pointCount])
  const previewPlot = useMemo(
    () => (preview ? toPlotSeries(preview, SWEEP_TO_AXIS[sweep.field] ?? 'weightLb', 'runwayMarginFt') : []),
    [preview, sweep.field],
  )

  const setNum = (key: keyof PerfInputs) => (value: string) =>
    setBaseline((b) => ({ ...b, [key]: Number(value) }))

  const validateIdentity = (): string[] => {
    const problems: string[] = []
    if (!name.trim()) problems.push('Study name is required.')
    if (name.trim().length > 80) problems.push('Study name is limited to 80 characters.')
    if (!baseline.runwayId.trim()) problems.push('Runway id is required.')
    for (const [key, [lo, hi]] of Object.entries(NUM_LIMITS)) {
      const v = baseline[key as keyof PerfInputs] as number
      if (!Number.isFinite(v) || v < lo || v > hi) problems.push(`${key} must be between ${lo.toLocaleString()} and ${hi.toLocaleString()}.`)
    }
    return problems
  }

  const validateSweep = (): string[] => {
    const problems: string[] = []
    if (!Number.isFinite(sweep.start) || !Number.isFinite(sweep.end)) problems.push('Sweep start and end must be numbers.')
    if (!Number.isFinite(sweep.step) || sweep.step <= 0) problems.push('Sweep step must be a positive number.')
    if (pointCount > MAX_SWEEP_POINTS) problems.push(`Sweep generates ${pointCount} points — the cap is ${MAX_SWEEP_POINTS}.`)
    if (pointCount === 0) problems.push('Sweep generates no points — check start, end, and step.')
    return problems
  }

  const next = () => {
    const problems = step === 0 ? validateIdentity() : validateSweep()
    setErrors(problems)
    if (problems.length > 0) return
    const target = Math.min(STEPS.length - 1, step + 1)
    setStep(target)
    setFurthest((f) => Math.max(f, target))
  }

  const goTo = (index: number) => {
    setErrors([])
    setStep(index)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const problems = [...validateIdentity(), ...validateSweep()]
    setErrors(problems)
    if (problems.length > 0) return
    const input: StudyInput = { name: name.trim(), notes: notes.trim(), baseline, sweep, compareBy }
    setBusy(true)
    try {
      const saved = editing ? await updateStudy(editing.id, input) : await createStudy(input)
      await refresh()
      navigate(href.detail(saved.id))
    } catch (error) {
      setErrors([error instanceof ApiError ? error.message : String(error)])
    } finally {
      setBusy(false)
    }
  }

  const sweepLabel = SWEEP_OPTIONS.find((o) => o.key === sweep.field)
  const compareLabel = COMPARE_OPTIONS.find((o) => o.key === compareBy)

  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">Study builder</span>
          <h1>{editing ? `Edit — ${editing.name}` : 'New trade study'}</h1>
          <p>Three steps: define the baseline, choose what to sweep and compare, review the expanded study before saving.</p>
        </div>
        <div className="page-actions">
          <a className="button secondary" href={editing ? href.detail(editing.id) : href.list}>Cancel</a>
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
                <Field id="b-name" label="Study name" hint="Unique enough to find; 80 characters max." size="name">
                  <input id="b-name" type="text" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} required />
                </Field>
                <Field id="b-notes" label="Notes" hint="What question does this study answer?" size="grow">
                  <input id="b-notes" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Field>
              </div>
            </div>

            <div className="form-group">
              <h3 className="group-header">Configuration</h3>
              <div className="form-row">
                <Field id="b-operation" label="Operation" size="select">
                  <select id="b-operation" value={baseline.operation} onChange={(e) => setBaseline((b) => ({ ...b, operation: e.target.value as PerfInputs['operation'] }))}>
                    {OPERATIONS.map((o) => <option key={o} value={o}>{o === 'takeoff' ? 'Takeoff' : 'Landing'}</option>)}
                  </select>
                </Field>
                <Field id="b-variant" label="Aircraft variant" size="select">
                  <select id="b-variant" value={baseline.variant} onChange={(e) => setBaseline((b) => ({ ...b, variant: e.target.value as PerfInputs['variant'] }))}>
                    {VARIANTS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </Field>
                <Field id="b-flap" label="Flap setting" size="select">
                  <select id="b-flap" value={baseline.flapSetting} onChange={(e) => setBaseline((b) => ({ ...b, flapSetting: e.target.value as PerfInputs['flapSetting'] }))}>
                    {FLAPS.map((f) => <option key={f} value={f}>Flap {f}</option>)}
                  </select>
                </Field>
                <Field id="b-cond" label="Runway condition" size="select">
                  <select id="b-cond" value={baseline.runwayCondition} onChange={(e) => setBaseline((b) => ({ ...b, runwayCondition: e.target.value as PerfInputs['runwayCondition'] }))}>
                    {CONDITIONS.map((c) => <option key={c} value={c}>{c === 'dry' ? 'Dry' : 'Wet'}</option>)}
                  </select>
                </Field>
              </div>
            </div>

            <div className="form-group">
              <h3 className="group-header">Environment & runway</h3>
              <div className="form-row">
                <Field id="b-runway" label="Runway id" hint="e.g. KSVN RWY 10" size="id">
                  <input id="b-runway" type="text" value={baseline.runwayId} onChange={(e) => setBaseline((b) => ({ ...b, runwayId: e.target.value }))} required />
                </Field>
                <Field id="b-length" label="Available runway (ft)" hint="1,000–20,000" size="num">
                  <input id="b-length" type="number" value={baseline.runwayLengthFt} onChange={(e) => setNum('runwayLengthFt')(e.target.value)} required />
                </Field>
                <Field id="b-pa" label="Pressure altitude (ft)" hint="−1,000–14,000" size="num">
                  <input id="b-pa" type="number" value={baseline.pressureAltitudeFt} onChange={(e) => setNum('pressureAltitudeFt')(e.target.value)} required />
                </Field>
                <Field id="b-oat" label="OAT (°C)" hint="−40–55" size="num">
                  <input id="b-oat" type="number" value={baseline.oatC} onChange={(e) => setNum('oatC')(e.target.value)} required />
                </Field>
                <Field id="b-weight" label="Weight (lb)" hint="30,000–90,000" size="num">
                  <input id="b-weight" type="number" value={baseline.weightLb} onChange={(e) => setNum('weightLb')(e.target.value)} required />
                </Field>
                <Field id="b-wind" label="Wind (kt)" hint="Headwind positive" size="num">
                  <input id="b-wind" type="number" value={baseline.windKt} onChange={(e) => setNum('windKt')(e.target.value)} required />
                </Field>
              </div>
            </div>

            <WizardActions>
              <button type="button" className="button primary" onClick={next}>Next — sweep & compare</button>
            </WizardActions>
          </WizardPhase>
        )}

        {step === 1 && (
          <WizardPhase wide>
            <div className="form-group">
              <h3 className="group-header">Sweep definition</h3>
              <div className="form-row">
                <Field id="s-field" label="Sweep variable" size="wide-select">
                  <select id="s-field" value={sweep.field} onChange={(e) => setSweep((s) => ({ ...s, field: e.target.value as SweepField }))}>
                    {SWEEP_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label} ({o.unit})</option>)}
                  </select>
                </Field>
                <Field id="s-start" label="Start" size="num">
                  <input id="s-start" type="number" value={sweep.start} onChange={(e) => setSweep((s) => ({ ...s, start: Number(e.target.value) }))} required />
                </Field>
                <Field id="s-end" label="End" size="num">
                  <input id="s-end" type="number" value={sweep.end} onChange={(e) => setSweep((s) => ({ ...s, end: Number(e.target.value) }))} required />
                </Field>
                <Field id="s-step" label="Step" hint={`≤ ${MAX_SWEEP_POINTS} points`} size="num">
                  <input id="s-step" type="number" value={sweep.step} onChange={(e) => setSweep((s) => ({ ...s, step: Number(e.target.value) }))} required />
                </Field>
              </div>
            </div>

            <div className="form-group">
              <h3 className="group-header">Compare & expansion</h3>
              <div className="form-row">
                <Field id="s-compare" label="Compare dimension" hint="Fans the study into overlaid series." size="wide-select">
                  <select id="s-compare" value={compareBy} onChange={(e) => setCompareBy(e.target.value as CompareDimension)}>
                    {COMPARE_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                </Field>
                <div className="field size-grow">
                  <span className="field-label-static">Expansion</span>
                  <p className="expansion-note num">{pointCount} point{pointCount === 1 ? '' : 's'} × {preview?.length ?? 0} series — computed live; nothing saved yet.</p>
                  <p className="field-message"> </p>
                </div>
              </div>
            </div>

            <WizardActions>
              <button type="button" className="button secondary" onClick={() => goTo(0)}>Back</button>
              <button type="button" className="button primary" onClick={next}>Next — preview & save</button>
            </WizardActions>
          </WizardPhase>
        )}

        {step === 2 && (
          <WizardPhase wide>
            <p className="review-summary">
              <strong>{name.trim() || 'Untitled study'}</strong> — {baseline.variant} · {baseline.operation} · {baseline.runwayId} ·
              sweeping {sweepLabel?.label.toLowerCase()} {sweep.start.toLocaleString('en-US')}–{sweep.end.toLocaleString('en-US')} {sweepLabel?.unit} by {sweep.step.toLocaleString('en-US')} ·
              compare: {compareLabel?.label.toLowerCase()} · <span className="num">{pointCount} × {preview?.length ?? 0} series</span>
            </p>
            {previewPlot.length > 0
              ? <StudyChart series={previewPlot} xKey={SWEEP_TO_AXIS[sweep.field] ?? 'weightLb'} yKey="runwayMarginFt" reference={{ value: 0, label: 'Zero margin' }} height={360} />
              : <div className="remote-state"><strong>No preview</strong><span>Go back and fix the sweep definition.</span></div>}
            <WizardActions>
              <button type="button" className="button secondary" onClick={() => goTo(1)}>Back</button>
              <button type="submit" className="button primary" disabled={busy || !online}>
                {busy ? 'Saving…' : editing ? 'Save study' : 'Create study'}
              </button>
              {!online && <span className="disabled-explanation">Offline — saving is disabled until the connection returns.</span>}
            </WizardActions>
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
