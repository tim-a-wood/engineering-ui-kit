export type AircraftVariant = 'GL-350' | 'GL-500' | 'GL-650'
export type OperationMode = 'takeoff' | 'landing'
export type RunwayCondition = 'dry' | 'wet'
export type FlapSetting = '10' | '15' | '20'
export type PerformanceStatus = 'within-limits' | 'caution' | 'out-of-limits'

export interface PerformanceInputs {
  mode: OperationMode
  aircraftVariant: AircraftVariant
  runwayId: string
  runwayLengthFt: number
  pressureAltitudeFt: number
  oatC: number
  weightLb: number
  windComponentKt: number
  runwayCondition: RunwayCondition
  flapSetting: FlapSetting
  notes: string
}

export interface PerformanceOutput {
  takeoffDistanceFt: number
  accelerateStopDistanceFt: number
  landingDistanceFt: number
  requiredRunwayFt: number
  runwayMarginFt: number
  climbGradientPct: number
  approachSpeedKt: number
  maxAllowableWeightLb: number
  limitingFactor: string
  status: PerformanceStatus
  advisory: string[]
  calculationBasis: string
}

export interface PerformanceCase {
  id: string
  label: string
  createdAt: string
  updatedAt: string
  inputs: PerformanceInputs
  output: PerformanceOutput
}

export interface CaseInput {
  label: string
  inputs: PerformanceInputs
}

export interface CaseCollection {
  cases: PerformanceCase[]
}

export interface ApiError {
  error: string
}
