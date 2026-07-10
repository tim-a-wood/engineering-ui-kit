export const AIRCRAFT_VARIANTS = ['GL-350', 'GL-500', 'GL-650'] as const;
export const OPERATIONS = ['takeoff', 'landing'] as const;
export const RUNWAY_CONDITIONS = ['dry', 'wet'] as const;
export const FLAP_SETTINGS = [10, 15, 20] as const;
export const CASE_STATUSES = ['within-limits', 'caution', 'out-of-limits'] as const;

export type AircraftVariant = (typeof AIRCRAFT_VARIANTS)[number];
export type Operation = (typeof OPERATIONS)[number];
export type RunwayCondition = (typeof RUNWAY_CONDITIONS)[number];
export type FlapSetting = (typeof FLAP_SETTINGS)[number];
export type CaseStatus = (typeof CASE_STATUSES)[number];

export interface Runway {
  id: string;
  lengthFt: number;
  elevationFt: number;
  notes: string;
  updatedAt: string;
}

export interface CaseInputs {
  label: string;
  operation: Operation;
  variant: AircraftVariant;
  runwayId: string;
  runwayLengthFt: number;
  pressureAltitudeFt: number;
  oatC: number;
  weightLb: number;
  windKt: number;
  runwayCondition: RunwayCondition;
  flapSetting: FlapSetting;
  notes: string;
}

export interface CalculationOutputs {
  takeoffDistanceFt: number;
  accelerateStopDistanceFt: number;
  landingDistanceFt: number;
  requiredRunwayFt: number;
  runwayMarginFt: number;
  climbGradientPct: number;
  approachSpeedKt: number;
  maxAllowableWeightLb: number;
  limitingFactor: string;
  calculationBasis: string;
  status: CaseStatus;
}

export interface CalculationReview {
  inputs: CaseInputs;
  outputs: CalculationOutputs;
}

export interface PerformanceCase extends CalculationReview {
  id: string;
  sweepFamilyId: string | null;
  sweepFamilyLabel: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SweepRequest {
  baseInputs: CaseInputs;
  startWeightLb: number;
  endWeightLb: number;
  stepWeightLb: number;
}

export interface ApiError {
  error: string;
  fieldErrors?: Record<string, string>;
}

export interface AppSnapshot {
  cases: PerformanceCase[];
  runways: Runway[];
}

export const VARIANT_WEIGHT_LIMITS: Record<AircraftVariant, { min: number; max: number }> = {
  'GL-350': { min: 30_000, max: 55_000 },
  'GL-500': { min: 40_000, max: 72_000 },
  'GL-650': { min: 48_000, max: 90_000 }
};
