/**
 * Runway library: managed records with validation and per-runway usage
 * counts (how many saved cases reference each).
 */

import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import type { PerformanceCase, Runway } from '../../shared/model'
import { formatInt } from '../../shared/format'
import { ApiError, createRunway, updateRunway } from '../api'

export function Runways(props: { cases: PerformanceCase[]; runways: Runway[]; online: boolean; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState<Runway | 'new' | null>(null)

  const usage = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of props.cases) counts.set(c.inputs.runwayId, (counts.get(c.inputs.runwayId) ?? 0) + 1)
    return counts
  }, [props.cases])

  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">Managed reference data</span>
          <h1>Runway library</h1>
          <p>Maintain the runway records that prefill planning cases; usage counts show which records saved cases rely on.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="button primary" disabled={!props.online} onClick={() => setEditing('new')}>Add runway</button>
        </div>
      </header>

      {editing && (
        <RunwayForm
          runway={editing === 'new' ? null : editing}
          online={props.online}
          onDone={async () => { setEditing(null); await props.refresh() }}
          onCancel={() => setEditing(null)}
        />
      )}

      <section className="page-section">
        <div className="section-header">
          <div><span className="eyebrow">Registry view</span><h2>Runways</h2></div>
          <span className="panel-meta">{props.runways.length} records</span>
        </div>
        <div className="table-surface table-scroll">
          <table className="registry-table">
            <caption className="sr-only">Runway library</caption>
            <thead>
              <tr>
                <th>Runway id</th>
                <th className="numeric">Length</th>
                <th className="numeric">Elevation</th>
                <th>Notes</th>
                <th className="numeric">Used by</th>
                <th><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {props.runways.map((r) => (
                <tr key={r.id}>
                  <td className="nowrap"><span className="mono">{r.id}</span></td>
                  <td className="numeric">{formatInt(r.lengthFt)} ft</td>
                  <td className="numeric">{formatInt(r.elevationFt)} ft</td>
                  <td className="case-cell"><span title={r.notes}>{r.notes || '—'}</span></td>
                  <td className="numeric">{usage.get(r.id) ?? 0} case{(usage.get(r.id) ?? 0) === 1 ? '' : 's'}</td>
                  <td className="cell-actions">
                    <button type="button" className="table-action" disabled={!props.online} onClick={() => setEditing(r)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function RunwayForm({ runway, online, onDone, onCancel }: {
  runway: Runway | null
  online: boolean
  onDone: () => Promise<void>
  onCancel: () => void
}) {
  const [id, setId] = useState(runway?.id ?? '')
  const [lengthFt, setLengthFt] = useState(runway?.lengthFt ?? 6000)
  const [elevationFt, setElevationFt] = useState(runway?.elevationFt ?? 0)
  const [notes, setNotes] = useState(runway?.notes ?? '')
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const problems: string[] = []
    if (!id.trim()) problems.push('Runway id is required.')
    if (!Number.isFinite(lengthFt) || lengthFt < 1000 || lengthFt > 20000) problems.push('Length must be between 1,000 and 20,000 ft.')
    if (!Number.isFinite(elevationFt)) problems.push('Elevation must be a number.')
    setErrors(problems)
    if (problems.length > 0) return
    setBusy(true)
    try {
      const payload = { id: id.trim(), lengthFt, elevationFt, notes: notes.trim() }
      if (runway) await updateRunway(runway.id, payload)
      else await createRunway(payload)
      await onDone()
    } catch (error) {
      setErrors([error instanceof ApiError ? error.message : String(error)])
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="form-group" onSubmit={submit} noValidate>
      <h3 className="group-header">{runway ? `Edit ${runway.id}` : 'New runway'}</h3>
      {errors.length > 0 && (
        <div className="validation-summary" role="alert">
          <strong>Review required</strong>
          <ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
      <div className="form-row">
        <Field id="r-id" label="Runway id" hint="e.g. KSVN RWY 10 — unique." size="id">
          <input id="r-id" type="text" value={id} onChange={(e) => setId(e.target.value)} required />
        </Field>
        <Field id="r-length" label="Length (ft)" hint="1,000–20,000" size="num">
          <input id="r-length" type="number" value={lengthFt} onChange={(e) => setLengthFt(Number(e.target.value))} required />
        </Field>
        <Field id="r-elev" label="Elevation (ft)" size="num">
          <input id="r-elev" type="number" value={elevationFt} onChange={(e) => setElevationFt(Number(e.target.value))} required />
        </Field>
        <Field id="r-notes" label="Notes" size="grow">
          <input id="r-notes" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      <div className="wizard-actions">
        <button type="button" className="button secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="button primary" disabled={busy || !online}>{busy ? 'Saving…' : 'Save runway'}</button>
      </div>
    </form>
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
