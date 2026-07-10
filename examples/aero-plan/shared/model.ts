/**
 * AeroPlan shared model — the single deterministic compute source for client
 * and server: performance outputs, the contribution breakdown, density
 * altitude, status boundaries and weight headroom. Pure functions only.
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

export interface CaseInputs {
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

export interface PerformanceCase {
  id: string
  label: string
  /** Present when the case belongs to a generated sweep family. */
  sweepFamily?: string
  inputs: CaseInputs
  createdAt: string
  updatedAt: string
}

export interface Runway {
  id: string
  lengthFt: number
  elevationFt: number
  notes: string
  updatedAt: string
}

interface VariantSpec {
  refWeightLb: number
  minWeightLb: number
  maxWeightLb: number
  baseTakeoffFt: number
  baseLandingFt: number
  baseClimbPct: number
  refApproachKt: number
}

export const SPECS: Record<Variant, VariantSpec> = {
  'GL-350': { refWeightLb: 54000, minWeightLb: 32000, maxWeightLb: 60000, baseTakeoffFt: 3900, baseLandingFt: 3300, baseClimbPct: 4.1, refApproachKt: 128 },
  'GL-500': { refWeightLb: 60000, minWeightLb: 40000, maxWeightLb: 72000, baseTakeoffFt: 4200, baseLandingFt: 3600, baseClimbPct: 3.8, refApproachKt: 134 },
  'GL-650': { refWeightLb: 70000, minWeightLb: 46000, maxWeightLb: 84000, baseTakeoffFt: 4600, baseLandingFt: 3900, baseClimbPct: 3.6, refApproachKt: 139 },
}

const K_WEIGHT = 0.0000135
const K_PA = 0.000028
const K_TEMP = 0.0075
const K_WIND = 0.0045
const CAUTION_MARGIN_FT = 1000
const CAUTION_CLIMB_PCT = 0.3

export const minClimb = (operation: Operation): number => (operation === 'takeoff' ? 2.4 : 3.2)

/** ISA temperature at pressure altitude: 15 °C − 2 °C per 1,000 ft. */
export const isaTempC = (pressureAltitudeFt: number): number => 15 - 2 * (pressureAltitudeFt / 1000)

/** Density altitude (planning-grade): PA + 120 × (OAT − ISA). */
export const densityAltitudeFt = (pressureAltitudeFt: number, oatC: number): number =>
  Math.round(pressureAltitudeFt + 120 * (oatC - isaTempC(pressureAltitudeFt)))

const paFactor = (pa: number) => 1 + K_PA * pa
const tempFactor = (oat: number) => 1 + K_TEMP * (oat - 15)
const windFactor = (wind: number) => Math.max(0.6, 1 - K_WIND * wind)
const condFactor = (c: RunwayCondition) => (c === 'wet' ? 1.18 : 1)
const flapFactor = (f: FlapSetting) => (f === '10' ? 1.06 : f === '20' ? 0.96 : 1)
const weightFactor = (variant: Variant, weightLb: number) => 1 + K_WEIGHT * (weightLb - SPECS[variant].refWeightLb)

export interface BreakdownStep {
  factorLabel: string
  detail: string
  multiplier: number
  runningFt: number
}

/** Ordered contribution breakdown: base → weight → altitude → temp → wind → surface → flap. */
export function breakdown(inputs: CaseInputs): BreakdownStep[] {
  const spec = SPECS[inputs.variant]
  const base = inputs.operation === 'takeoff' ? spec.baseTakeoffFt : spec.baseLandingFt
  const steps: { label: string; detail: string; multiplier: number }[] = [
    { label: 'Base distance', detail: `${inputs.variant} · ${inputs.operation} at ${spec.refWeightLb.toLocaleString('en-US')} lb`, multiplier: 1 },
    { label: 'Weight', detail: `${inputs.weightLb.toLocaleString('en-US')} lb vs reference`, multiplier: weightFactor(inputs.variant, inputs.weightLb) },
    { label: 'Pressure altitude', detail: `${inputs.pressureAltitudeFt.toLocaleString('en-US')} ft`, multiplier: paFactor(inputs.pressureAltitudeFt) },
    { label: 'Temperature', detail: `${inputs.oatC} °C vs ISA sea level`, multiplier: tempFactor(inputs.oatC) },
    { label: 'Wind', detail: `${inputs.windKt} kt component`, multiplier: windFactor(inputs.windKt) },
    { label: 'Surface', detail: inputs.runwayCondition === 'wet' ? 'Wet runway' : 'Dry runway', multiplier: condFactor(inputs.runwayCondition) },
    { label: 'Flap', detail: `Flap ${inputs.flapSetting}`, multiplier: flapFactor(inputs.flapSetting) },
  ]
  let running = base
  return steps.map((step, index) => {
    running = index === 0 ? base : running * step.multiplier
    return { factorLabel: step.label, detail: step.detail, multiplier: step.multiplier, runningFt: Math.round(running) }
  })
}

export interface Outputs {
  takeoffDistanceFt: number
  accelerateStopDistanceFt: number
  landingDistanceFt: number
  requiredRunwayFt: number
  runwayMarginFt: number
  climbGradientPct: number
  approachSpeedKt: number
  maxAllowableWeightLb: number
  limitingFactor: 'Runway length' | 'Minimum climb gradient'
  status: Status
  /** Signed lb from current weight to the caution boundary (negative = already past). */
  headroomToCautionLb: number
  /** Signed lb from current weight to the out-of-limits boundary. */
  headroomToLimitLb: number
  densityAltitudeFt: number
  basis: string
}

function envFactor(inputs: CaseInputs): number {
  return paFactor(inputs.pressureAltitudeFt) * tempFactor(inputs.oatC)
    * windFactor(inputs.windKt) * condFactor(inputs.runwayCondition) * flapFactor(inputs.flapSetting)
}

/** Weight at which required runway equals `targetFt` (linear inversion). */
function weightForRequired(inputs: CaseInputs, targetFt: number): number {
  const spec = SPECS[inputs.variant]
  const base = inputs.operation === 'takeoff' ? spec.baseTakeoffFt : spec.baseLandingFt
  const wf = targetFt / (base * envFactor(inputs))
  return spec.refWeightLb + (wf - 1) / K_WEIGHT
}

function weightForClimb(inputs: CaseInputs, targetPct: number): number {
  const spec = SPECS[inputs.variant]
  const env = paFactor(inputs.pressureAltitudeFt) * tempFactor(inputs.oatC)
  const wf = spec.baseClimbPct / (targetPct * env)
  return spec.refWeightLb + (wf - 1) / K_WEIGHT
}

export function computeOutputs(inputs: CaseInputs): Outputs {
  const spec = SPECS[inputs.variant]
  const steps = breakdown(inputs)
  const requiredRunwayFt = steps[steps.length - 1]!.runningFt
  const takeoffBase = SPECS[inputs.variant].baseTakeoffFt * weightFactor(inputs.variant, inputs.weightLb) * envFactor({ ...inputs, operation: 'takeoff' })
  const landingBase = SPECS[inputs.variant].baseLandingFt * weightFactor(inputs.variant, inputs.weightLb) * envFactor({ ...inputs, operation: 'landing' })
  const climb = spec.baseClimbPct / (weightFactor(inputs.variant, inputs.weightLb) * paFactor(inputs.pressureAltitudeFt) * tempFactor(inputs.oatC))
  const runwayMarginFt = inputs.runwayLengthFt - requiredRunwayFt

  const runwayLimit = weightForRequired(inputs, inputs.runwayLengthFt)
  const climbLimit = weightForClimb(inputs, minClimb(inputs.operation))
  const binding = Math.min(runwayLimit, climbLimit)
  const maxAllowableWeightLb = Math.round(Math.max(spec.minWeightLb, Math.min(spec.maxWeightLb, binding)))
  const limitingFactor: Outputs['limitingFactor'] = runwayLimit <= climbLimit ? 'Runway length' : 'Minimum climb gradient'

  // Weight headroom to each status boundary (whichever constraint binds first).
  const cautionWeight = Math.min(
    weightForRequired(inputs, inputs.runwayLengthFt - CAUTION_MARGIN_FT),
    weightForClimb(inputs, minClimb(inputs.operation) + CAUTION_CLIMB_PCT),
  )
  const climbHeadroom = climb - minClimb(inputs.operation)
  const belowLimits = runwayMarginFt < 0 || climbHeadroom < 0
  const caution = runwayMarginFt < CAUTION_MARGIN_FT || climbHeadroom < CAUTION_CLIMB_PCT
  const status: Status = belowLimits ? 'out-of-limits' : caution ? 'caution' : 'within-limits'

  return {
    takeoffDistanceFt: Math.round(takeoffBase),
    accelerateStopDistanceFt: Math.round(takeoffBase * 1.12),
    landingDistanceFt: Math.round(landingBase),
    requiredRunwayFt,
    runwayMarginFt,
    climbGradientPct: Math.round(climb * 100) / 100,
    approachSpeedKt: Math.round(spec.refApproachKt * Math.sqrt(inputs.weightLb / spec.refWeightLb)),
    maxAllowableWeightLb,
    limitingFactor,
    status,
    headroomToCautionLb: Math.round(cautionWeight - inputs.weightLb),
    headroomToLimitLb: Math.round(binding - inputs.weightLb),
    densityAltitudeFt: densityAltitudeFt(inputs.pressureAltitudeFt, inputs.oatC),
    basis: `Planning-grade synthetic model · ${inputs.variant} ${inputs.operation} · ${inputs.runwayCondition} · flap ${inputs.flapSetting}`,
  }
}

export const MAX_SWEEP_POINTS = 25

export function sweepWeights(startLb: number, endLb: number, stepLb: number): number[] {
  if (!Number.isFinite(startLb) || !Number.isFinite(endLb) || !Number.isFinite(stepLb) || stepLb <= 0) return []
  const weights: number[] = []
  const ascending = endLb >= startLb
  for (let i = 0; i <= MAX_SWEEP_POINTS; i += 1) {
    const w = ascending ? startLb + i * stepLb : startLb - i * stepLb
    weights.push(w)
    if (ascending ? w >= endLb : w <= endLb) break
  }
  return weights
}
