/**
 * Two-case diff: all inputs and outputs as aligned rows, differing input
 * rows highlighted, numeric outputs with a signed delta column.
 */

import { useMemo } from 'react'
import type { PerformanceCase } from '../../shared/model'
import { computeOutputs } from '../../shared/model'
import { formatInt, formatSigned, formatValue, statusLabel } from '../../shared/format'
import { href } from '../router'

interface DiffRow {
  label: string
  a: string
  b: string
  delta?: string
  differs: boolean
}

export function Compare(props: { a?: string; b?: string; cases: PerformanceCase[] }) {
  const caseA = props.cases.find((c) => c.id === props.a)
  const caseB = props.cases.find((c) => c.id === props.b)

  const rows = useMemo(() => {
    if (!caseA || !caseB) return { inputs: [] as DiffRow[], outputs: [] as DiffRow[] }
    const ia = caseA.inputs
    const ib = caseB.inputs
    const inputs: DiffRow[] = [
      { label: 'Operation', a: ia.operation, b: ib.operation, differs: ia.operation !== ib.operation },
      { label: 'Variant', a: ia.variant, b: ib.variant, differs: ia.variant !== ib.variant },
      { label: 'Runway', a: ia.runwayId, b: ib.runwayId, differs: ia.runwayId !== ib.runwayId },
      { label: 'Available runway', a: `${formatInt(ia.runwayLengthFt)} ft`, b: `${formatInt(ib.runwayLengthFt)} ft`, differs: ia.runwayLengthFt !== ib.runwayLengthFt },
      { label: 'Pressure altitude', a: `${formatSigned(ia.pressureAltitudeFt)} ft`, b: `${formatSigned(ib.pressureAltitudeFt)} ft`, differs: ia.pressureAltitudeFt !== ib.pressureAltitudeFt },
      { label: 'OAT', a: `${formatSigned(ia.oatC)} °C`, b: `${formatSigned(ib.oatC)} °C`, differs: ia.oatC !== ib.oatC },
      { label: 'Weight', a: `${formatInt(ia.weightLb)} lb`, b: `${formatInt(ib.weightLb)} lb`, differs: ia.weightLb !== ib.weightLb },
      { label: 'Wind component', a: `${formatSigned(ia.windKt)} kt`, b: `${formatSigned(ib.windKt)} kt`, differs: ia.windKt !== ib.windKt },
      { label: 'Runway condition', a: ia.runwayCondition, b: ib.runwayCondition, differs: ia.runwayCondition !== ib.runwayCondition },
      { label: 'Flap setting', a: `Flap ${ia.flapSetting}`, b: `Flap ${ib.flapSetting}`, differs: ia.flapSetting !== ib.flapSetting },
    ]
    const oa = computeOutputs(ia)
    const ob = computeOutputs(ib)
    const num = (label: string, a: number, b: number, unit: string): DiffRow => ({
      label,
      a: unit === '%' ? formatValue(a, '%') : `${formatInt(a)} ${unit}`,
      b: unit === '%' ? formatValue(b, '%') : `${formatInt(b)} ${unit}`,
      delta: unit === '%' ? formatValue(Math.round((b - a) * 100) / 100, '%') : `${formatSigned(b - a)} ${unit}`,
      differs: a !== b,
    })
    const outputs: DiffRow[] = [
      num('Required runway', oa.requiredRunwayFt, ob.requiredRunwayFt, 'ft'),
      num('Runway margin', oa.runwayMarginFt, ob.runwayMarginFt, 'ft'),
      num('Takeoff distance', oa.takeoffDistanceFt, ob.takeoffDistanceFt, 'ft'),
      num('Accelerate-stop', oa.accelerateStopDistanceFt, ob.accelerateStopDistanceFt, 'ft'),
      num('Landing distance', oa.landingDistanceFt, ob.landingDistanceFt, 'ft'),
      num('Climb gradient', oa.climbGradientPct, ob.climbGradientPct, '%'),
      num('Approach speed', oa.approachSpeedKt, ob.approachSpeedKt, 'kt'),
      num('Max allowable weight', oa.maxAllowableWeightLb, ob.maxAllowableWeightLb, 'lb'),
      { label: 'Limiting factor', a: oa.limitingFactor, b: ob.limitingFactor, differs: oa.limitingFactor !== ob.limitingFactor },
      { label: 'Status', a: statusLabel(oa.status), b: statusLabel(ob.status), differs: oa.status !== ob.status },
    ]
    return { inputs, outputs }
  }, [caseA, caseB])

  if (!caseA || !caseB) {
    return (
      <div className="remote-state" role="alert">
        <strong>Pick exactly two cases to compare</strong>
        <span>Select them in the registry, then open the comparison.</span>
        <a className="button secondary" href={href.cases}>Back to saved cases</a>
      </div>
    )
  }

  const changedInputs = rows.inputs.filter((r) => r.differs).length

  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">Case comparison</span>
          <h1>{caseA.label} vs {caseB.label}</h1>
          <p>A = {caseA.label} · B = {caseB.label}. {changedInputs} input{changedInputs === 1 ? '' : 's'} differ{changedInputs === 1 ? 's' : ''} — highlighted below; output deltas are B − A in signed figures.</p>
        </div>
        <div className="page-actions">
          <a className="button secondary" href={href.cases}>Back to saved cases</a>
        </div>
      </header>

      <div className="review-columns">
        <section className="page-section">
          <div className="section-header"><div><span className="eyebrow">Inputs</span><h2>Configuration diff</h2></div></div>
          <div className="table-surface table-scroll">
            <table className="registry-table diff-table">
              <caption className="sr-only">Input differences between the two cases</caption>
              <thead>
                <tr><th>Input</th><th className="numeric" title={caseA.label}>A</th><th className="numeric" title={caseB.label}>B</th></tr>
              </thead>
              <tbody>
                {rows.inputs.map((r) => (
                  <tr key={r.label} className={r.differs ? 'diff-row' : undefined}>
                    <td className="nowrap">{r.label}</td>
                    <td className="numeric">{r.a}</td>
                    <td className="numeric">{r.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="page-section">
          <div className="section-header"><div><span className="eyebrow">Outputs</span><h2>Result diff</h2></div></div>
          <div className="table-surface table-scroll">
            <table className="registry-table diff-table">
              <caption className="sr-only">Output differences between the two cases</caption>
              <thead>
                <tr><th>Output</th><th className="numeric">A</th><th className="numeric">B</th><th className="numeric">Δ (B − A)</th></tr>
              </thead>
              <tbody>
                {rows.outputs.map((r) => (
                  <tr key={r.label} className={r.differs ? 'diff-row' : undefined}>
                    <td className="nowrap">{r.label}</td>
                    <td className="numeric">{r.a}</td>
                    <td className="numeric">{r.b}</td>
                    <td className="numeric">{r.delta ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  )
}
