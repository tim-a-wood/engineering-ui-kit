/**
 * AeroStudy shared model — the single deterministic source of truth for
 * performance compute and study expansion, used by the builder preview and
 * every chart. Pure functions only; no I/O.
 */

export type Variant = 'GL-350' | 'GL-500' | 'GL-650'
export type Operation = 'takeoff' | 'landing'
export type RunwayCondition = 'dry' | 'wet'
export type FlapSetting = '10' | '15' | '20'
export type Status = 'within-limits' | 'caution' | 'out-of-limits'

export const VARIANTS: Variant[] = ['GL-350', 'GL-500', 'GL-650']
export const OPERATIONS: Operation[] = ['takeoff', 'landing']
export const CONDITIONS: RunwayCondition[] = ['dry', 'wet']
export const FLAPS: FlapSetting[] = ['10', '15', '20']

export interface PerfInputs {
  operation: Operation
  variant: Variant
  runwayId: string
  runwayLengthFt: number
  pressureAltitudeFt: number
  oatC: number
  weightLb: number
  windKt: number
  runwayCondition: RunwayCondition
  flapSetting: FlapSetting
}

export interface PerfOutputs {
  requiredRunwayFt: number
  runwayMarginFt: number
  climbGradientPct: number
  maxAllowableWeightLb: number
  limitingFactor: 'Runway length' | 'Minimum climb gradient'
  status: Status
  basis: string
}

interface VariantSpec {
  refWeightLb: number
  minWeightLb: number
  maxWeightLb: number
  baseTakeoffFt: number
  baseLandingFt: number
  baseClimbPct: number
}

const SPECS: Record<Variant, VariantSpec> = {
  'GL-350': { refWeightLb: 54000, minWeightLb: 32000, maxWeightLb: 60000, baseTakeoffFt: 3900, baseLandingFt: 3300, baseClimbPct: 4.1 },
  'GL-500': { refWeightLb: 60000, minWeightLb: 40000, maxWeightLb: 72000, baseTakeoffFt: 4200, baseLandingFt: 3600, baseClimbPct: 3.8 },
  'GL-650': { refWeightLb: 70000, minWeightLb: 46000, maxWeightLb: 84000, baseTakeoffFt: 4600, baseLandingFt: 3900, baseClimbPct: 3.6 },
}

/** Minimum acceptable net climb gradient for the operation (planning-grade). */
function minClimb(operation: Operation): number {
  return operation === 'takeoff' ? 2.4 : 3.2
}

const K_WEIGHT = 0.0000135
const K_PA = 0.000028
const K_TEMP = 0.0075
const K_WIND = 0.0045

function paFactor(pa: number): number { return 1 + K_PA * pa }
function tempFactor(oat: number): number { return 1 + K_TEMP * (oat - 15) }
function windFactor(wind: number): number { return Math.max(0.6, 1 - K_WIND * wind) }
function condFactor(condition: RunwayCondition): number { return condition === 'wet' ? 1.18 : 1 }
function flapFactor(flap: FlapSetting): number { return flap === '10' ? 1.06 : flap === '20' ? 0.96 : 1 }

export const variantSpec = (variant: Variant): VariantSpec => SPECS[variant]

/** Required runway (ft) for the given inputs — linear in weight for easy inversion. */
function requiredRunway(inputs: PerfInputs): number {
  const spec = SPECS[inputs.variant]
  const base = inputs.operation === 'takeoff' ? spec.baseTakeoffFt : spec.baseLandingFt
  const weightF = 1 + K_WEIGHT * (inputs.weightLb - spec.refWeightLb)
  const env = paFactor(inputs.pressureAltitudeFt) * tempFactor(inputs.oatC)
    * windFactor(inputs.windKt) * condFactor(inputs.runwayCondition) * flapFactor(inputs.flapSetting)
  return base * weightF * env
}

function climbGradient(inputs: PerfInputs): number {
  const spec = SPECS[inputs.variant]
  const weightF = 1 + K_WEIGHT * (inputs.weightLb - spec.refWeightLb)
  const env = paFactor(inputs.pressureAltitudeFt) * tempFactor(inputs.oatC)
  return spec.baseClimbPct / (weightF * env)
}

/** Weight at which required runway would exactly equal the available length. */
function weightLimitForRunway(inputs: PerfInputs): number {
  const spec = SPECS[inputs.variant]
  const base = inputs.operation === 'takeoff' ? spec.baseTakeoffFt : spec.baseLandingFt
  const env = paFactor(inputs.pressureAltitudeFt) * tempFactor(inputs.oatC)
    * windFactor(inputs.windKt) * condFactor(inputs.runwayCondition) * flapFactor(inputs.flapSetting)
  // required = base*env*(1 + K*(w - ref)) = available  →  solve for w
  const weightF = inputs.runwayLengthFt / (base * env)
  return spec.refWeightLb + (weightF - 1) / K_WEIGHT
}

/** Weight at which climb gradient would fall to its minimum. */
function weightLimitForClimb(inputs: PerfInputs): number {
  const spec = SPECS[inputs.variant]
  const env = paFactor(inputs.pressureAltitudeFt) * tempFactor(inputs.oatC)
  const weightF = spec.baseClimbPct / (minClimb(inputs.operation) * env)
  return spec.refWeightLb + (weightF - 1) / K_WEIGHT
}

export function computeOutputs(inputs: PerfInputs): PerfOutputs {
  const requiredRunwayFt = Math.round(requiredRunway(inputs))
  const runwayMarginFt = inputs.runwayLengthFt - requiredRunwayFt
  const climb = climbGradient(inputs)
  const spec = SPECS[inputs.variant]

  const runwayWeightLimit = weightLimitForRunway(inputs)
  const climbWeightLimit = weightLimitForClimb(inputs)
  const bindingWeightLimit = Math.min(runwayWeightLimit, climbWeightLimit)
  const maxAllowableWeightLb = Math.round(Math.max(spec.minWeightLb, Math.min(spec.maxWeightLb, bindingWeightLimit)))
  const limitingFactor: PerfOutputs['limitingFactor'] = runwayWeightLimit <= climbWeightLimit
    ? 'Runway length' : 'Minimum climb gradient'

  const climbHeadroom = climb - minClimb(inputs.operation)
  const belowLimits = runwayMarginFt < 0 || climbHeadroom < 0
  const caution = runwayMarginFt < 1000 || climbHeadroom < 0.3
  const status: Status = belowLimits ? 'out-of-limits' : caution ? 'caution' : 'within-limits'

  return {
    requiredRunwayFt,
    runwayMarginFt,
    climbGradientPct: Math.round(climb * 100) / 100,
    maxAllowableWeightLb,
    limitingFactor,
    status,
    basis: `Planning-grade synthetic model · ${inputs.variant} ${inputs.operation} · PA ${inputs.pressureAltitudeFt} ft · ${inputs.oatC} °C · ${inputs.runwayCondition} · flap ${inputs.flapSetting}`,
  }
}

/* --------------------------------------------------------------- studies */

export type SweepField = 'weightLb' | 'pressureAltitudeFt' | 'oatC' | 'windKt' | 'runwayLengthFt'
export type CompareDimension = 'none' | 'variant' | 'runwayCondition' | 'flapSetting' | 'operation'

export interface SweepConfig {
  field: SweepField
  start: number
  end: number
  step: number
}

export interface StudyDef {
  baseline: PerfInputs
  sweep: SweepConfig
  compareBy: CompareDimension
}

export interface Study extends StudyDef {
  id: string
  name: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface StudyPoint {
  seriesKey: string
  seriesLabel: string
  inputs: PerfInputs
  outputs: PerfOutputs
}

export interface StudySeries {
  key: string
  label: string
  points: StudyPoint[]
}

export const MAX_SWEEP_POINTS = 40

export function sweepValues(sweep: SweepConfig): number[] {
  const { start, end, step } = sweep
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(step) || step <= 0) return []
  const values: number[] = []
  const ascending = end >= start
  const s = Math.abs(step)
  for (let i = 0; i < MAX_SWEEP_POINTS + 1; i += 1) {
    const v = ascending ? start + i * s : start - i * s
    values.push(v)
    if (ascending ? v >= end : v <= end) break
  }
  return values
}

function compareValues(dim: CompareDimension): { key: string; label: string }[] {
  switch (dim) {
    case 'variant': return VARIANTS.map((v) => ({ key: v, label: v }))
    case 'runwayCondition': return CONDITIONS.map((c) => ({ key: c, label: c === 'wet' ? 'Wet runway' : 'Dry runway' }))
    case 'flapSetting': return FLAPS.map((f) => ({ key: f, label: `Flap ${f}` }))
    case 'operation': return OPERATIONS.map((o) => ({ key: o, label: o === 'takeoff' ? 'Takeoff' : 'Landing' }))
    case 'none': return [{ key: 'baseline', label: 'Baseline' }]
  }
}

function applyCompare(baseline: PerfInputs, dim: CompareDimension, key: string): PerfInputs {
  switch (dim) {
    case 'variant': return { ...baseline, variant: key as Variant }
    case 'runwayCondition': return { ...baseline, runwayCondition: key as RunwayCondition }
    case 'flapSetting': return { ...baseline, flapSetting: key as FlapSetting }
    case 'operation': return { ...baseline, operation: key as Operation }
    case 'none': return { ...baseline }
  }
}

export function expandStudy(def: StudyDef): StudySeries[] {
  const values = sweepValues(def.sweep)
  return compareValues(def.compareBy).map(({ key, label }) => {
    const base = applyCompare(def.baseline, def.compareBy, key)
    const points: StudyPoint[] = values.map((value) => {
      const inputs: PerfInputs = { ...base, [def.sweep.field]: value }
      return { seriesKey: key, seriesLabel: label, inputs, outputs: computeOutputs(inputs) }
    })
    return { key, label, points }
  })
}
