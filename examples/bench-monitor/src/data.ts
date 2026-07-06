// Deterministic sample data for RUN-2189, a thermal soak qualification on
// Bench 3. Everything derives from pure functions of time so the screen is
// exactly reproducible (a REQUIREMENTS.md constraint).

export const RUN = {
  rig: 'Bench 3 · Environmental chamber',
  id: 'RUN-2189',
  profile: 'THRM-SOAK-85',
  state: 'Running' as const,
  elapsed: '01:48:22',
  planned: '02:00:00',
  setpointC: 85.0,
  toleranceC: 1.5,
  rampEndMin: 30,
  durationMin: 108,
}

export interface TracePoint {
  /** minutes since run start */
  t: number
  setpoint: number
  measured: number
}

function setpointAt(t: number): number {
  if (t >= RUN.rampEndMin) return RUN.setpointC
  return 25 + (RUN.setpointC - 25) * (t / RUN.rampEndMin)
}

function measuredAt(t: number): number {
  // First-order lag behind the setpoint plus a small periodic ripple from the
  // chamber's control loop. Pure function of t — no randomness.
  const lagged = setpointAt(Math.max(0, t - 2.4))
  const settling = (setpointAt(t) - lagged) * 0.35
  const ripple = 0.38 * Math.sin(t / 3.1) + 0.22 * Math.sin(t / 7.7 + 1.3)
  return lagged + settling + ripple * Math.min(1, t / 10)
}

export const TRACE: TracePoint[] = Array.from({ length: RUN.durationMin / 2 + 1 }, (_, i) => {
  const t = i * 2
  return {
    t,
    setpoint: Math.round(setpointAt(t) * 10) / 10,
    measured: Math.round(measuredAt(t) * 10) / 10,
  }
})

export type StageId = 'full' | 'ramp' | 'soak'

export const STAGES: { id: StageId; label: string; from: number; to: number }[] = [
  { id: 'full', label: 'Full run', from: 0, to: RUN.durationMin },
  { id: 'ramp', label: 'Ramp', from: 0, to: 36 },
  { id: 'soak', label: 'Soak', from: 36, to: RUN.durationMin },
]

export interface SoakSummary {
  meanC: number
  maxDeviationC: number
  withinTolerance: boolean
}

export function soakSummary(): SoakSummary {
  const soak = TRACE.filter((p) => p.t >= 36)
  const mean = soak.reduce((acc, p) => acc + p.measured, 0) / soak.length
  const maxDev = Math.max(...soak.map((p) => Math.abs(p.measured - p.setpoint)))
  return {
    meanC: Math.round(mean * 10) / 10,
    maxDeviationC: Math.round(maxDev * 10) / 10,
    withinTolerance: maxDev <= RUN.toleranceC,
  }
}

export type ChannelStatus = 'OK' | 'Warning' | 'Fault'

export interface Channel {
  id: string
  location: string
  /** latest reading in °C, or null when the channel is not reporting */
  readingC: number | null
  /** deviation from setpoint in °C, or null when not applicable */
  deviationC: number | null
  status: ChannelStatus
  note: string
}

export const CHANNELS: Channel[] = [
  { id: 'TC-01', location: 'Chamber core', readingC: 84.9, deviationC: -0.1, status: 'OK', note: 'Primary control sensor' },
  { id: 'TC-02', location: 'Chamber upper', readingC: 85.3, deviationC: 0.3, status: 'OK', note: 'Stratification watch' },
  { id: 'TC-03', location: 'Chamber lower', readingC: 84.5, deviationC: -0.5, status: 'OK', note: 'Stratification watch' },
  { id: 'TC-04', location: 'DUT surface', readingC: 83.8, deviationC: -1.2, status: 'OK', note: 'Bonded to enclosure lid' },
  { id: 'TC-05', location: 'DUT connector', readingC: 86.4, deviationC: 1.4, status: 'Warning', note: 'Drift approaching ±1.5 °C tolerance since 01:12:05' },
  { id: 'TC-06', location: 'Fixture plate', readingC: 84.1, deviationC: -0.9, status: 'OK', note: 'Fixture thermal mass' },
  { id: 'TC-07', location: 'Exhaust duct', readingC: null, deviationC: null, status: 'Fault', note: 'Open circuit at 01:36:12 — excluded from chamber mean' },
  { id: 'TC-08', location: 'Ambient reference', readingC: 23.4, deviationC: null, status: 'OK', note: 'Room reference — not against setpoint' },
]

export type EventSeverity = 'Info' | 'Warning' | 'Fault'

export interface RunEvent {
  at: string
  severity: EventSeverity
  message: string
}

/** Reverse-chronological, newest first. */
export const EVENTS: RunEvent[] = [
  { at: '01:40:00', severity: 'Info', message: 'Chamber mean recomputed over 7 channels' },
  { at: '01:36:12', severity: 'Fault', message: 'TC-07 open circuit — channel excluded from chamber mean' },
  { at: '01:12:05', severity: 'Warning', message: 'TC-05 deviation +1.4 °C — approaching ±1.5 °C tolerance' },
  { at: '00:31:40', severity: 'Info', message: 'Soak stage entered — setpoint held at 85.0 °C' },
  { at: '00:02:10', severity: 'Info', message: 'Ramp stage entered — setpoint 25 → 85 °C over 30 min' },
  { at: '00:00:00', severity: 'Info', message: 'Run RUN-2189 started — profile THRM-SOAK-85, planned 02:00:00' },
]

export function ticks(min: number, max: number, count: number): number[] {
  if (max === min) return [min]
  const step = (max - min) / (count - 1)
  return Array.from({ length: count }, (_, i) => Math.round((min + i * step) * 10) / 10)
}
