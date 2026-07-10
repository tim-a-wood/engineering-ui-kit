/**
 * Axis-field metadata for the configurable study chart: which numeric fields
 * can be plotted, their labels/units, and how to read one from a study point.
 */

import type { StudyPoint } from './model'

export type AxisFieldKey =
  | 'weightLb' | 'pressureAltitudeFt' | 'oatC' | 'windKt' | 'runwayLengthFt'
  | 'requiredRunwayFt' | 'runwayMarginFt' | 'climbGradientPct' | 'maxAllowableWeightLb'

export interface AxisField {
  key: AxisFieldKey
  label: string
  unit: string
  short: string
  read: (point: StudyPoint) => number
}

export const AXIS_FIELDS: AxisField[] = [
  { key: 'weightLb', label: 'Aircraft weight', unit: 'lb', short: 'Weight', read: (p) => p.inputs.weightLb },
  { key: 'pressureAltitudeFt', label: 'Pressure altitude', unit: 'ft', short: 'PA', read: (p) => p.inputs.pressureAltitudeFt },
  { key: 'oatC', label: 'Outside air temperature', unit: '°C', short: 'OAT', read: (p) => p.inputs.oatC },
  { key: 'windKt', label: 'Wind component', unit: 'kt', short: 'Wind', read: (p) => p.inputs.windKt },
  { key: 'runwayLengthFt', label: 'Available runway', unit: 'ft', short: 'Available', read: (p) => p.inputs.runwayLengthFt },
  { key: 'requiredRunwayFt', label: 'Required runway', unit: 'ft', short: 'Required', read: (p) => p.outputs.requiredRunwayFt },
  { key: 'runwayMarginFt', label: 'Runway margin', unit: 'ft', short: 'Margin', read: (p) => p.outputs.runwayMarginFt },
  { key: 'climbGradientPct', label: 'Climb gradient', unit: '%', short: 'Climb', read: (p) => p.outputs.climbGradientPct },
  { key: 'maxAllowableWeightLb', label: 'Max allowable weight', unit: 'lb', short: 'Max weight', read: (p) => p.outputs.maxAllowableWeightLb },
]

export const axisField = (key: AxisFieldKey): AxisField =>
  AXIS_FIELDS.find((f) => f.key === key) ?? AXIS_FIELDS[0]!

export const SWEEP_TO_AXIS: Record<string, AxisFieldKey> = {
  weightLb: 'weightLb',
  pressureAltitudeFt: 'pressureAltitudeFt',
  oatC: 'oatC',
  windKt: 'windKt',
  runwayLengthFt: 'runwayLengthFt',
}
