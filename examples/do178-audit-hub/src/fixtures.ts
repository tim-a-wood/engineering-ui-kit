// Deterministic sample fixture repository (typed, immutable).
import { fakeHash, iso, pick } from './core.ts'
import type { AuditRecord, Baseline, BaselineInfo, ChangeMark, ChangeRecord, EvidenceRecord, EvidenceStatus, EvidenceType, Finding, Phase, ReviewMethod, ReviewRecord, ReviewResult, ReviewState, SourceKind } from './core.ts'

// ===== from fixtures/core.ts =====
// Shared deterministic fixture builders. All authoritative sample evidence is
// produced here from stable inputs — no randomness, no wall clock.

export const WORKSPACE_NAME = 'AeroNav Flight Guidance Computer — Lateral Guidance'
export const SOFTWARE_LEVEL = 'Level B'
export const WATERMARK = 'Synthetic sample — not certification evidence'

export const PEOPLE = [
  'M. Okafor',
  'J. Lindqvist',
  'R. Vasquez',
  'A. Chen',
  'S. Patel',
  'K. Yamada',
  'L. Fontaine',
  'D. Novak',
  'T. Ibrahim',
  'E. Sorensen',
] as const

export interface RecInput {
  id: string
  title: string
  type: EvidenceType
  phase: Phase
  status: EvidenceStatus
  revision: string
  sourcePath: string
  sourceKind: SourceKind
  modifiedDay: number
  baseline?: Baseline | 'both'
  upstream?: string[]
  downstream?: string[]
  reviewState?: ReviewState
  findingIds?: string[]
  provenance?: string
  changeMark?: ChangeMark
  meta?: Record<string, string | number>
}

export function rec(input: RecInput): EvidenceRecord {
  const provenance =
    input.provenance ??
    `Imported from ${input.sourceKind} export · ${input.sourcePath} · ${iso(input.modifiedDay, 30)}`
  return {
    id: input.id,
    title: input.title,
    type: input.type,
    phase: input.phase,
    status: input.status,
    revision: input.revision,
    sourcePath: input.sourcePath,
    sourceKind: input.sourceKind,
    hash: fakeHash(`${input.id}@${input.revision}`),
    modified: iso(input.modifiedDay, (input.id.length * 7) % 60),
    baseline: input.baseline ?? 'both',
    upstream: input.upstream ?? [],
    downstream: input.downstream ?? [],
    reviewState: input.reviewState ?? 'approved',
    findingIds: input.findingIds ?? [],
    provenance,
    changeMark: input.changeMark ?? 'unchanged',
    meta: input.meta ?? {},
  }
}

export const TYPE_LABEL: Record<EvidenceType, string> = {
  plan: 'Plan',
  standard: 'Standard',
  'sys-requirement': 'System requirement',
  hlr: 'High-level requirement',
  llr: 'Low-level requirement',
  'derived-requirement': 'Derived requirement',
  model: 'Model',
  harness: 'Test harness',
  'data-dictionary': 'Data dictionary',
  'model-element': 'Model element',
  'source-file': 'Source file',
  function: 'Function',
  'test-case': 'Test case',
  'result-set': 'Result set',
  result: 'Test result',
  objective: 'Objective',
  'config-item': 'Configuration item',
}

export const STATUS_LABEL: Record<EvidenceStatus, string> = {
  approved: 'Approved',
  'in-review': 'In review',
  draft: 'Draft',
  passed: 'Passed',
  failed: 'Failed',
  blocked: 'Blocked',
  'not-run': 'Not run',
  stale: 'Stale',
  satisfied: 'Satisfied',
  partial: 'Partial',
  unsatisfied: 'Unsatisfied',
}

export const REVIEW_STATE_LABEL: Record<ReviewState, string> = {
  approved: 'Review approved',
  pending: 'Review pending',
  stale: 'Review stale',
  rejected: 'Review rejected',
  'not-reviewed': 'Not reviewed',
}

export const PHASE_LABEL: Record<Phase, string> = {
  planning: 'Planning',
  requirements: 'Requirements',
  design: 'Design',
  implementation: 'Implementation',
  verification: 'Verification',
  cm: 'Configuration Management',
  qa: 'Quality Assurance',
  certification: 'Certification',
}

export const PHASE_ORDER: Phase[] = [
  'planning',
  'requirements',
  'design',
  'implementation',
  'verification',
  'cm',
  'qa',
  'certification',
]

// ===== from fixtures/planning.ts =====
// Planning phase fixtures: 10 plans/standards plus the development and
// verification environment inventory.

const planDefs: Array<{
  id: string
  title: string
  type: 'plan' | 'standard'
  rev: string
  day: number
  reviewState?: 'approved' | 'pending' | 'stale'
  status?: 'approved' | 'in-review'
  findingIds?: string[]
  changeMark?: 'changed' | 'unchanged'
}> = [
  { id: 'PLN-PSAC', title: 'Plan for Software Aspects of Certification (PSAC)', type: 'plan', rev: 'E', day: 4, findingIds: ['FND-009'], changeMark: 'changed' },
  { id: 'PLN-SDP', title: 'Software Development Plan (SDP)', type: 'plan', rev: 'D', day: 6 },
  { id: 'PLN-SVP', title: 'Software Verification Plan (SVP)', type: 'plan', rev: 'F', day: 8, changeMark: 'changed' },
  { id: 'PLN-SCMP', title: 'Software Configuration Management Plan (SCMP)', type: 'plan', rev: 'C', day: 5 },
  { id: 'PLN-SQAP', title: 'Software Quality Assurance Plan (SQAP)', type: 'plan', rev: 'C', day: 5 },
  { id: 'STD-REQ', title: 'Software Requirements Standard', type: 'standard', rev: 'B', day: 3 },
  { id: 'STD-DES', title: 'Software Design & Modeling Standard (DO-331)', type: 'standard', rev: 'C', day: 3 },
  { id: 'STD-CODE', title: 'Software Coding Standard (MISRA-based)', type: 'standard', rev: 'D', day: 3 },
  { id: 'STD-VER', title: 'Software Verification Standard', type: 'standard', rev: 'B', day: 3 },
  { id: 'PLN-TQP', title: 'Tool Qualification Plan (TQP)', type: 'plan', rev: 'B', day: 9, status: 'in-review', reviewState: 'pending' },
]

export const planningRecords: EvidenceRecord[] = planDefs.map((d, i) =>
  rec({
    id: d.id,
    title: d.title,
    type: d.type,
    phase: 'planning',
    status: d.status ?? 'approved',
    revision: `Rev ${d.rev}`,
    sourcePath: `plans/${d.id.toLowerCase().replace(/-/g, '_')}.xlsx`,
    sourceKind: 'XLSX',
    modifiedDay: 40 + d.day,
    reviewState: d.reviewState ?? 'approved',
    findingIds: d.findingIds,
    changeMark: d.changeMark ?? 'unchanged',
    meta: {
      owner: pick(PEOPLE, i),
      approver: pick(PEOPLE, i + 3),
      independence: d.id === 'PLN-SQAP' || d.type === 'standard' ? 'Independent' : 'Project',
      linkedReviews: 2 + (i % 2),
      issues: d.findingIds ? d.findingIds.join(', ') : '—',
    },
  }),
)

const envDefs: Array<{ id: string; title: string; ver: string; role: string; qualified: string }> = [
  { id: 'ENV-COMPILER', title: 'GCC ARM cross-compiler', ver: '12.3.1-aero', role: 'Code generation toolchain', qualified: 'TQL-5 qualified' },
  { id: 'ENV-TARGET', title: 'AeroNav FGC target board', ver: 'HW Rev 4', role: 'Target hardware', qualified: 'Conformity reviewed' },
  { id: 'ENV-RTOS', title: 'SafeRTOS-178 kernel', ver: '3.2.0', role: 'Runtime platform', qualified: 'Vendor cert package' },
  { id: 'ENV-MDLTOOL', title: 'Simulink model environment', ver: 'R2025b', role: 'Model development (DO-331)', qualified: 'TQL-4 qualified' },
  { id: 'ENV-CODEGEN', title: 'Embedded Coder generator', ver: 'R2025b', role: 'Model-to-code generation', qualified: 'TQL-4 qualified' },
  { id: 'ENV-COVTOOL', title: 'Structural coverage analyzer', ver: '5.1.2', role: 'Statement/decision/MC-DC measurement', qualified: 'TQL-5 qualified' },
  { id: 'ENV-STATIC', title: 'Static analysis suite', ver: '2026.1', role: 'Coding standard & defect analysis', qualified: 'TQL-5 qualified' },
  { id: 'ENV-TRACE', title: 'Trace & requirements manager', ver: '9.4', role: 'Trace data management', qualified: 'TQL-5 qualified' },
]

export const environmentRecords: EvidenceRecord[] = envDefs.map((d, i) =>
  rec({
    id: d.id,
    title: d.title,
    type: 'config-item',
    phase: 'planning',
    status: 'approved',
    revision: d.ver,
    sourcePath: `environment/${d.id.toLowerCase()}.cfg`,
    sourceKind: 'CONFIG',
    modifiedDay: 20 + i,
    meta: { role: d.role, qualification: d.qualified, owner: pick(PEOPLE, i + 1) },
  }),
)

// ===== from fixtures/requirements.ts =====
// Requirements phase fixtures: 18 system requirements, 36 HLRs, 54 LLRs,
// 6 derived requirements, with deterministic trace wiring.
// Featured chain members: SYS-LAT-014 → SWR-HLR-LAT-021 → SWR-LLR-LAT-044.

const pad = (n: number) => String(n).padStart(3, '0')

const SYS_TOPICS = [
  'Lateral track capture engagement criteria',
  'Course deviation computation accuracy',
  'Roll command output range and units',
  'Guidance mode annunciation to the display system',
  'Localizer capture from an intercept track',
  'Wind-corrected track hold performance',
  'Turn anticipation distance computation',
  'Waypoint sequencing on leg transition',
  'Mode transition timing between armed and active lateral modes',
  'Guidance output freshness monitoring',
  'Cross-track error limit during capture',
  'Heading hold engagement behavior',
  'Roll rate limiting for passenger comfort',
  'Commanded bank angle limiting envelope',
  'Guidance validity flag handling on sensor loss',
  'Lateral offset path guidance',
  'Reversion to heading hold on guidance invalid',
  'Interface timing with the autopilot servo loop',
] as const

const HLR_TOPICS = [
  'Compute cross-track deviation from active leg geometry',
  'Filter course deviation with configured time constant',
  'Generate roll command proportional to deviation and track error',
  'Annunciate armed lateral mode within one execution frame',
  'Arm localizer capture when intercept criteria are met',
  'Apply wind correction angle to commanded track',
  'Compute turn anticipation from ground speed and leg change',
  'Sequence active waypoint at the turn initiation point',
  'Debounce lateral mode transitions over consecutive frames',
  'Set guidance stale flag when input age exceeds threshold',
  'Limit cross-track error slope during capture maneuvers',
  'Hold selected heading within tolerance in heading mode',
  'Limit roll rate of the commanded bank profile',
  'Scale bank limit with airspeed regime',
  'Invalidate guidance outputs on navigation sensor loss',
  'Apply lateral offset to the active leg path',
  'Revert to heading hold when guidance becomes invalid',
  'Publish roll command on the servo interface bus each frame',
] as const

const LLR_TOPICS = [
  'Initialize deviation filter state on mode entry',
  'Saturate filtered deviation to interface range',
  'Compute proportional path gain from ground speed',
  'Latch mode annunciation output register',
  'Evaluate localizer intercept angle window',
  'Blend wind correction into track command',
  'Compute turn radius from bank limit and speed',
  'Advance leg index and reset transition state',
  'Count consecutive frames for transition debounce',
  'Compare input timestamp age against staleness limit',
  'Clamp cross-track slope during capture submode',
  'Compute heading error with wraparound handling',
  'Rate-limit bank command slew per frame',
  'Select bank limit from airspeed breakpoint table',
  'Clear validity flags and zero outputs on sensor loss',
  'Offset leg geometry by the configured lateral bias',
  'Trigger heading-hold reversion transition',
  'Write roll command to the output bus structure',
] as const

function sysUpstreamFor(hlrIdx1: number): string {
  // HLR n traces to SYS ceil(n/2); guarantees SWR-HLR-LAT-021 → SYS-LAT-011…
  // then explicitly rewired below so the featured chain holds exactly.
  return `SYS-LAT-${pad(Math.ceil(hlrIdx1 / 2))}`
}

/** Requirement ids that carry the 2.4.0 bank-limit change. */
export const BANK_LIMIT_CHANGED = ['SYS-LAT-014', 'SWR-HLR-LAT-021', 'SWR-LLR-LAT-044'] as const
/** Requirement ids that carry the 2.4.0 mode-transition change. */
export const MODE_TRANSITION_CHANGED = ['SYS-LAT-009', 'SWR-HLR-LAT-009', 'SWR-LLR-LAT-025', 'SWR-LLR-LAT-026'] as const

const UNTRACED_LLR = new Set(['SWR-LLR-LAT-052', 'SWR-LLR-LAT-037'])
const UNVERIFIED = new Set(['SWR-LLR-LAT-037', 'SWR-HLR-LAT-033', 'SWR-LLR-LAT-052'])

export const sysRequirements: EvidenceRecord[] = SYS_TOPICS.map((topic, i) => {
  const n = i + 1
  const id = `SYS-LAT-${pad(n)}`
  const changed = id === 'SYS-LAT-014' || id === 'SYS-LAT-009'
  return rec({
    id,
    title: topic,
    type: 'sys-requirement',
    phase: 'requirements',
    status: changed ? 'approved' : i % 7 === 5 ? 'in-review' : 'approved',
    revision: changed ? 'Rev 5' : 'Rev 3',
    sourcePath: 'requirements/system/aeronav_sys_lateral.slreqx',
    sourceKind: 'SLREQX',
    modifiedDay: changed ? 96 : 30 + i,
    downstream: [`SWR-HLR-LAT-${pad(n * 2 - 1)}`, `SWR-HLR-LAT-${pad(n * 2)}`],
    reviewState: i % 7 === 5 ? 'pending' : 'approved',
    changeMark: changed ? 'changed' : 'unchanged',
    meta: {
      owner: pick(PEOPLE, i),
      verificationMethod: i % 5 === 3 ? 'Analysis' : 'Test',
      changeImpact: id === 'SYS-LAT-014' ? 'Bank limit change (2.4.0)' : id === 'SYS-LAT-009' ? 'Mode transition change (2.4.0)' : 'None',
    },
  })
})

export const hlrRequirements: EvidenceRecord[] = Array.from({ length: 36 }, (_, i) => {
  const n = i + 1
  const id = `SWR-HLR-LAT-${pad(n)}`
  const changed = id === 'SWR-HLR-LAT-021' || id === 'SWR-HLR-LAT-009'
  const upstream = id === 'SWR-HLR-LAT-021' ? ['SYS-LAT-014'] : [sysUpstreamFor(n)]
  const firstLlr = Math.min(54 - 1, i * 3 % 54) + 1
  const downstream =
    id === 'SWR-HLR-LAT-021'
      ? ['SWR-LLR-LAT-044', 'SWR-LLR-LAT-045']
      : [`SWR-LLR-LAT-${pad(((n * 3 - 2 - 1) % 54) + 1)}`, `SWR-LLR-LAT-${pad(((n * 3 - 1 - 1) % 54) + 1)}`]
  void firstLlr
  return rec({
    id,
    title: pick(HLR_TOPICS, i) + (n > 18 ? ` — case ${Math.ceil(n / 18)}` : ''),
    type: 'hlr',
    phase: 'requirements',
    status: UNVERIFIED.has(id) ? 'in-review' : 'approved',
    revision: changed ? 'Rev 7' : 'Rev 4',
    sourcePath: 'requirements/software/aeronav_swr_hlr.slreqx',
    sourceKind: 'SLREQX',
    modifiedDay: changed ? 97 : 34 + (i % 20),
    upstream,
    downstream,
    reviewState: UNVERIFIED.has(id) ? 'pending' : 'approved',
    changeMark: changed ? 'changed' : upstream.includes('SYS-LAT-014') || upstream.includes('SYS-LAT-009') ? 'impacted' : 'unchanged',
    meta: {
      owner: pick(PEOPLE, i + 2),
      verificationMethod: i % 6 === 4 ? 'Analysis' : 'Test',
      changeImpact: changed ? (id === 'SWR-HLR-LAT-021' ? 'Bank limit change (2.4.0)' : 'Mode transition change (2.4.0)') : 'None',
    },
  })
})

export const llrRequirements: EvidenceRecord[] = Array.from({ length: 54 }, (_, i) => {
  const n = i + 1
  const id = `SWR-LLR-LAT-${pad(n)}`
  const changed = id === 'SWR-LLR-LAT-044' || id === 'SWR-LLR-LAT-025' || id === 'SWR-LLR-LAT-026'
  const untraced = UNTRACED_LLR.has(id)
  const upstream =
    id === 'SWR-LLR-LAT-044' || id === 'SWR-LLR-LAT-045'
      ? ['SWR-HLR-LAT-021']
      : [`SWR-HLR-LAT-${pad(Math.ceil(n / 1.5) > 36 ? 36 : Math.ceil(n / 1.5))}`]
  const downstream = untraced
    ? []
    : id === 'SWR-LLR-LAT-044'
      ? ['LateralGuidance/BankAngleLimiter']
      : [`ELM-${pad(((n * 2) % 120) + 1)}`]
  return rec({
    id,
    title:
      id === 'SWR-LLR-LAT-044'
        ? 'Clamp commanded bank angle to the speed-scheduled limit'
        : pick(LLR_TOPICS, i) + (n > 18 ? ` — variant ${Math.ceil(n / 18)}` : ''),
    type: 'llr',
    phase: 'requirements',
    status: UNVERIFIED.has(id) ? 'in-review' : 'approved',
    revision: changed ? 'Rev 6' : 'Rev 3',
    sourcePath: 'requirements/software/aeronav_swr_llr.slreqx',
    sourceKind: 'SLREQX',
    modifiedDay: changed ? 98 : 38 + (i % 24),
    upstream,
    downstream,
    reviewState: id === 'SWR-LLR-LAT-052' ? 'stale' : UNVERIFIED.has(id) ? 'pending' : 'approved',
    findingIds: id === 'SWR-LLR-LAT-052' ? ['FND-002'] : [],
    changeMark: changed ? 'changed' : upstream.includes('SWR-HLR-LAT-021') || upstream.includes('SWR-HLR-LAT-009') ? 'impacted' : 'unchanged',
    meta: {
      owner: pick(PEOPLE, i + 4),
      verificationMethod: i % 8 === 6 ? 'Review' : 'Test',
      changeImpact: changed
        ? id === 'SWR-LLR-LAT-044'
          ? 'Bank limit change (2.4.0)'
          : 'Mode transition change (2.4.0)'
        : 'None',
      traceGap: untraced ? 'Downstream model link missing' : '—',
    },
  })
})

const DERIVED_DEFS: Array<{ n: number; title: string; findingIds?: string[]; feedback: string }> = [
  { n: 1, title: 'Deviation filter warm-up period of 3 frames', feedback: 'Fed back to system process 2026-04-14' },
  { n: 2, title: 'Bank limit table hysteresis of 2 kt at breakpoints', feedback: 'Fed back to system process 2026-04-21' },
  { n: 3, title: 'Roll command zeroing during output-bus initialization', findingIds: ['FND-001'], feedback: 'Missing — safety feedback not recorded' },
  { n: 4, title: 'Mode debounce counter saturation at 255 frames', feedback: 'Fed back to system process 2026-05-02' },
  { n: 5, title: 'Stale-input counter reset on mode re-engagement', feedback: 'Fed back to system process 2026-05-02' },
  { n: 6, title: 'Turn anticipation floor of 0.3 NM at low speed', feedback: 'Fed back to system process 2026-05-19' },
]

export const derivedRequirements: EvidenceRecord[] = DERIVED_DEFS.map((d, i) =>
  rec({
    id: `SWR-DRV-LAT-${pad(d.n)}`,
    title: d.title,
    type: 'derived-requirement',
    phase: 'requirements',
    status: d.findingIds ? 'in-review' : 'approved',
    revision: 'Rev 2',
    sourcePath: 'requirements/software/aeronav_swr_derived.slreqx',
    sourceKind: 'SLREQX',
    modifiedDay: 60 + i * 2,
    downstream: [`ELM-${pad(20 + i * 9)}`],
    reviewState: d.findingIds ? 'pending' : 'approved',
    findingIds: d.findingIds,
    meta: {
      owner: pick(PEOPLE, i + 1),
      verificationMethod: 'Test',
      safetyFeedback: d.feedback,
      changeImpact: 'None',
    },
  }),
)

export const requirementRecords: EvidenceRecord[] = [
  ...sysRequirements,
  ...hlrRequirements,
  ...llrRequirements,
  ...derivedRequirements,
]

// ===== from fixtures/design.ts =====
// Design phase fixtures (DO-331): 7 models/harnesses, 2 data dictionaries,
// ~140 model elements. Featured: LateralGuidance/BankAngleLimiter and
// guidance_types.sldd (stale review, FND-003).


export const BANK_LIMITER_ELEMENT = 'LateralGuidance/BankAngleLimiter'

const MODEL_DEFS: Array<{
  id: string
  title: string
  file: string
  type: 'model' | 'harness'
  elements: number
  changed?: boolean
}> = [
  { id: 'MDL-LateralGuidance', title: 'LateralGuidance — top-level lateral guidance model', file: 'models/LateralGuidance.slx', type: 'model', elements: 48, changed: true },
  { id: 'MDL-ModeLogic', title: 'ModeLogic — lateral mode arming and transitions', file: 'models/ModeLogic.slx', type: 'model', elements: 32, changed: true },
  { id: 'MDL-RollCommand', title: 'RollCommand — roll command shaping and limits', file: 'models/RollCommand.slx', type: 'model', elements: 24 },
  { id: 'MDL-GuidanceOutput', title: 'GuidanceOutput — output bus assembly and validity', file: 'models/GuidanceOutput.slx', type: 'model', elements: 16 },
  { id: 'HRN-LateralGuidance', title: 'LateralGuidance_Harness — requirements test harness', file: 'models/harness/LateralGuidance_Harness.slx', type: 'harness', elements: 8 },
  { id: 'HRN-BankAngleLimiter', title: 'BankAngleLimiter_Harness — boundary test harness', file: 'models/harness/BankAngleLimiter_Harness.slx', type: 'harness', elements: 6, changed: true },
  { id: 'HRN-ModeLogic', title: 'ModeLogic_Harness — transition test harness', file: 'models/harness/ModeLogic_Harness.slx', type: 'harness', elements: 6 },
]

export const modelRecords: EvidenceRecord[] = MODEL_DEFS.map((d, i) =>
  rec({
    id: d.id,
    title: d.title,
    type: d.type,
    phase: 'design',
    status: 'approved',
    revision: d.changed ? 'Rev 12' : 'Rev 9',
    sourcePath: d.file,
    sourceKind: 'SLX',
    modifiedDay: d.changed ? 100 : 44 + i,
    reviewState: 'approved',
    changeMark: d.changed ? 'changed' : 'unchanged',
    meta: {
      owner: pick(PEOPLE, i + 2),
      elementCount: d.elements,
      modelKind: d.type === 'model' ? 'Design model' : 'Verification harness',
      coverageUp: d.type === 'model' ? '100% to LLR' : 'n/a',
      modifiedElements: d.changed ? 3 + i : 0,
    },
  }),
)

export const dictionaryRecords: EvidenceRecord[] = [
  rec({
    id: 'DD-guidance_types',
    title: 'guidance_types.sldd — bus and enumeration definitions',
    type: 'data-dictionary',
    phase: 'design',
    status: 'approved',
    revision: 'Rev 8',
    sourcePath: 'models/data/guidance_types.sldd',
    sourceKind: 'SLDD',
    modifiedDay: 101,
    reviewState: 'stale',
    findingIds: ['FND-003'],
    changeMark: 'changed',
    meta: {
      owner: pick(PEOPLE, 3),
      entryCount: 42,
      buses: 6,
      enums: 5,
      note: 'Review predates Rev 8 bank-limit bus change',
    },
  }),
  rec({
    id: 'DD-guidance_params',
    title: 'guidance_params.sldd — tunable parameter definitions',
    type: 'data-dictionary',
    phase: 'design',
    status: 'approved',
    revision: 'Rev 6',
    sourcePath: 'models/data/guidance_params.sldd',
    sourceKind: 'SLDD',
    modifiedDay: 88,
    reviewState: 'approved',
    changeMark: 'impacted',
    meta: { owner: pick(PEOPLE, 5), entryCount: 38, buses: 0, enums: 2, note: 'Bank limit table values updated for 2.4.0' },
  }),
]

const ELEMENT_KINDS = ['Subsystem', 'Chart', 'Gain', 'Saturation', 'Switch', 'Lookup1D', 'Integrator', 'Inport', 'Outport', 'BusCreator'] as const
const SUBSYSTEMS = ['CaptureLogic', 'DeviationFilter', 'TrackHold', 'TurnAnticipation', 'OutputStage', 'ValidityMonitor'] as const

// Reverse map LLR → element links declared in requirements fixtures.
const llrByElement = new Map<string, string[]>()
for (const llr of llrRequirements) {
  for (const d of llr.downstream) {
    const list = llrByElement.get(d) ?? []
    list.push(llr.id)
    llrByElement.set(d, list)
  }
}

function modelForElement(i: number): { model: (typeof MODEL_DEFS)[number]; local: number } {
  let acc = 0
  for (const m of MODEL_DEFS) {
    if (i < acc + m.elements) return { model: m, local: i - acc }
    acc += m.elements
  }
  return { model: MODEL_DEFS[0] as (typeof MODEL_DEFS)[number], local: i }
}

// 139 generated elements + the featured BankAngleLimiter subsystem = 140.
export const elementRecords: EvidenceRecord[] = [
  rec({
    id: BANK_LIMITER_ELEMENT,
    title: 'BankAngleLimiter — speed-scheduled bank angle limiting subsystem',
    type: 'model-element',
    phase: 'design',
    status: 'approved',
    revision: 'Rev 12',
    sourcePath: 'models/LateralGuidance.slx#BankAngleLimiter',
    sourceKind: 'SLX',
    modifiedDay: 100,
    upstream: ['SWR-LLR-LAT-044'],
    downstream: ['lateral_guidance.c::limit_bank_command'],
    reviewState: 'approved',
    changeMark: 'changed',
    meta: {
      model: 'MDL-LateralGuidance',
      kind: 'Subsystem',
      path: 'LateralGuidance/BankAngleLimiter',
      interface: 'in: airspeed_kt, bank_cmd_deg · out: bank_cmd_limited_deg',
      note: 'Limit table re-scheduled in 2.4.0 (25° → 27° high-speed segment)',
    },
  }),
  ...Array.from({ length: 139 }, (_, i) => {
    const n = i + 1
    const id = `ELM-${pad(n)}`
    const { model, local } = modelForElement(i)
    const kind = pick(ELEMENT_KINDS, n)
    const sub = pick(SUBSYSTEMS, Math.floor(n / 6))
    const path = `${model.id.replace(/^(MDL|HRN)-/, '')}/${sub}/${kind}${local + 1}`
    const upstream = llrByElement.get(id) ?? []
    const isInterface = kind === 'Inport' || kind === 'Outport'
    return rec({
      id,
      title: `${path} (${kind})`,
      type: 'model-element',
      phase: 'design',
      status: 'approved',
      revision: model.changed ? 'Rev 12' : 'Rev 9',
      sourcePath: `${model.file}#${path}`,
      sourceKind: 'SLX',
      modifiedDay: model.changed && n % 9 === 0 ? 100 : 46 + (n % 30),
      upstream,
      reviewState: upstream.length === 0 && n % 11 === 0 ? 'pending' : 'approved',
      changeMark: model.changed && n % 9 === 0 ? 'changed' : 'unchanged',
      meta: {
        model: model.id,
        kind,
        path,
        interface: isInterface ? `${kind === 'Inport' ? 'in' : 'out'}: signal_${n} (single)` : '—',
      },
    })
  }),
]

export const designRecords: EvidenceRecord[] = [...modelRecords, ...dictionaryRecords, ...elementRecords]

// ===== from fixtures/implementation.ts =====
// Implementation phase fixtures: 24 C/H files, 105 functions, coding-standard
// deviations. Featured: lateral_guidance.c::limit_bank_command; the separate
// missing-code-trace finding (FND-004) sits on mode_logic.c::select_capture_mode.


export const LIMIT_BANK_COMMAND = 'lateral_guidance.c::limit_bank_command'
export const MISSING_TRACE_FUNCTION = 'mode_logic.c::select_capture_mode'

const MODULES: Array<{
  name: string
  origin: 'generated' | 'hand'
  model: string
  fns: number
  changed?: boolean
}> = [
  { name: 'lateral_guidance', origin: 'generated', model: 'MDL-LateralGuidance', fns: 10, changed: true },
  { name: 'bank_angle_limiter', origin: 'generated', model: 'MDL-LateralGuidance', fns: 8, changed: true },
  { name: 'mode_logic', origin: 'generated', model: 'MDL-ModeLogic', fns: 9, changed: true },
  { name: 'roll_command', origin: 'generated', model: 'MDL-RollCommand', fns: 9 },
  { name: 'guidance_output', origin: 'generated', model: 'MDL-GuidanceOutput', fns: 8 },
  { name: 'bus_mapping', origin: 'generated', model: 'MDL-GuidanceOutput', fns: 9 },
  { name: 'lookup_tables', origin: 'generated', model: 'MDL-LateralGuidance', fns: 9 },
  { name: 'guidance_params', origin: 'generated', model: 'MDL-LateralGuidance', fns: 8 },
  { name: 'guidance_math', origin: 'hand', model: '—', fns: 9 },
  { name: 'scheduler', origin: 'hand', model: '—', fns: 9 },
  { name: 'io_interface', origin: 'hand', model: '—', fns: 8 },
  { name: 'diagnostics', origin: 'hand', model: '—', fns: 9 },
]

export const sourceFileRecords: EvidenceRecord[] = MODULES.flatMap((m, mi) =>
  (['c', 'h'] as const).map((ext) =>
    rec({
      id: `${m.name}.${ext}`,
      title: `${m.name}.${ext} — ${m.origin === 'generated' ? 'generated from ' + (m.model === '—' ? 'model' : m.model) : 'hand-written support code'}`,
      type: 'source-file',
      phase: 'implementation',
      status: 'approved',
      revision: m.changed ? 'r2412' : 'r2288',
      sourcePath: `src/lateral/${m.name}.${ext}`,
      sourceKind: ext === 'c' ? 'C' : 'H',
      modifiedDay: m.changed ? 102 : 52 + mi,
      upstream: m.model === '—' ? [] : [m.model],
      reviewState: m.changed && ext === 'c' ? 'pending' : 'approved',
      changeMark: m.changed ? 'changed' : 'unchanged',
      meta: {
        origin: m.origin === 'generated' ? 'Generated (Embedded Coder)' : 'Hand code',
        model: m.model,
        loc: ext === 'c' ? 220 + mi * 31 : 60 + mi * 9,
        functions: ext === 'c' ? m.fns : 0,
        staticAnalysis: mi === 11 ? '2 warnings' : 'Clean',
        deviations: mi === 8 ? 1 : 0,
        owner: pick(PEOPLE, mi),
      },
    }),
  ),
)

const VERBS = ['init', 'update', 'compute', 'reset', 'validate', 'apply', 'select', 'latch', 'publish', 'clamp'] as const
const NOUNS = ['deviation', 'track_error', 'roll_cmd', 'mode_state', 'capture_gate', 'bank_limit', 'wind_corr', 'leg_index', 'output_bus', 'stale_count'] as const

function fnName(m: (typeof MODULES)[number], k: number): string {
  return `${pick(VERBS, k + m.fns)}_${pick(NOUNS, k * 3 + m.name.length)}${k >= 10 ? String(k) : ''}`
}

export const functionRecords: EvidenceRecord[] = MODULES.flatMap((m, mi) =>
  Array.from({ length: m.fns }, (_, k) => {
    const globalIdx = MODULES.slice(0, mi).reduce((a, x) => a + x.fns, 0) + k
    let name = fnName(m, k)
    if (m.name === 'lateral_guidance' && k === 0) name = 'limit_bank_command'
    if (m.name === 'mode_logic' && k === 0) name = 'select_capture_mode'
    const id = `${m.name}.c::${name}`
    const featured = id === LIMIT_BANK_COMMAND
    const missingTrace = id === MISSING_TRACE_FUNCTION
    const upstream = featured
      ? [BANK_LIMITER_ELEMENT]
      : missingTrace
        ? []
        : m.origin === 'generated'
          ? [`ELM-${pad(((globalIdx * 4) % 139) + 1)}`]
          : ['SWR-LLR-LAT-' + pad((globalIdx % 54) + 1)]
    return rec({
      id,
      title: featured
        ? 'limit_bank_command — clamp roll command to speed-scheduled bank limit'
        : missingTrace
          ? 'select_capture_mode — capture submode selection (trace gap)'
          : `${name} — ${m.name.replace(/_/g, ' ')} ${pick(['step function', 'frame update', 'support routine', 'state handler'], globalIdx)}`,
      type: 'function',
      phase: 'implementation',
      status: 'approved',
      revision: m.changed ? 'r2412' : 'r2288',
      sourcePath: `src/lateral/${m.name}.c#${name}`,
      sourceKind: 'C',
      modifiedDay: m.changed ? 102 : 54 + (globalIdx % 26),
      upstream,
      reviewState: missingTrace ? 'pending' : 'approved',
      findingIds: missingTrace ? ['FND-004'] : featured ? ['FND-007'] : [],
      changeMark: featured ? 'changed' : m.changed && k < 3 ? 'impacted' : 'unchanged',
      meta: {
        file: `${m.name}.c`,
        loc: 18 + ((globalIdx * 13) % 90),
        complexity: 2 + ((globalIdx * 7) % 14),
        origin: m.origin === 'generated' ? 'Generated' : 'Hand',
        model: m.model,
        coverage: featured ? 'Decision 92.4% (gap)' : 'Decision 100%',
      },
    })
  }),
)

export interface DeviationRow {
  id: string
  rule: string
  scope: string
  rationale: string
  status: 'approved' | 'pending' | 'rejected'
  approver: string
  findingIds: string[]
}

export const deviationRows: DeviationRow[] = [
  { id: 'DEV-2026-001', rule: 'Rule 11.4 — pointer/int cast', scope: 'io_interface.c', rationale: 'Memory-mapped register access, hardware interface layer only.', status: 'approved', approver: 'S. Patel', findingIds: [] },
  { id: 'DEV-2026-002', rule: 'Rule 15.5 — single return point', scope: 'guidance_math.c', rationale: 'Early-return guard clauses; verified by review REV-2026-118.', status: 'approved', approver: 'S. Patel', findingIds: [] },
  { id: 'DEV-2026-003', rule: 'Rule 8.7 — external linkage', scope: 'diagnostics.c', rationale: 'Diagnostic hooks referenced by test harness only.', status: 'pending', approver: '—', findingIds: [] },
  { id: 'DEV-2026-004', rule: 'Rule 17.8 — parameter modification', scope: 'lookup_tables.c', rationale: 'Generated interpolation code pattern; DER-approved deviation.', status: 'approved', approver: 'DER — H. Whitfield', findingIds: ['FND-011'] },
  { id: 'DEV-2026-005', rule: 'Dir 4.9 — function-like macro', scope: 'scheduler.c', rationale: 'Frame timing macro required for deterministic scheduling.', status: 'approved', approver: 'S. Patel', findingIds: [] },
]

export const implementationRecords: EvidenceRecord[] = [...sourceFileRecords, ...functionRecords]

// ===== from fixtures/verification.ts =====
// Verification phase fixtures: 64 test cases (225 iterations total), 6 result
// sets, structural coverage rows, procedures. Featured: TC-LAT-BOUNDARY-008 →
// RequirementsResults_2_4_0 → VR-RESULT-2026-041.


export const FEATURED_TEST = 'TC-LAT-BOUNDARY-008'
export const FEATURED_RESULT_SET = 'RequirementsResults_2_4_0'
export const FEATURED_RESULT = 'VR-RESULT-2026-041'
export const FAILED_ROBUST_TEST = 'TC-LAT-ROBUST-007'
export const STALE_RESULT_SET = 'RegressionResults_2_4_0'

interface TestDef {
  id: string
  group: 'requirements' | 'boundary' | 'robustness'
  idx: number
  globalIdx: number
}

const testDefs: TestDef[] = [
  ...Array.from({ length: 40 }, (_, i) => ({ id: `TC-LAT-REQ-${pad(i + 1)}`, group: 'requirements' as const, idx: i, globalIdx: i })),
  ...Array.from({ length: 12 }, (_, i) => ({ id: `TC-LAT-BOUNDARY-${pad(i + 1)}`, group: 'boundary' as const, idx: i, globalIdx: 40 + i })),
  ...Array.from({ length: 12 }, (_, i) => ({ id: `TC-LAT-ROBUST-${pad(i + 1)}`, group: 'robustness' as const, idx: i, globalIdx: 52 + i })),
]

const GROUP_TITLES: Record<TestDef['group'], string> = {
  requirements: 'Requirements-based test',
  boundary: 'Boundary / equivalence test',
  robustness: 'Robustness test',
}

function upstreamFor(d: TestDef): string[] {
  if (d.id === FEATURED_TEST) return ['SWR-LLR-LAT-044', LIMIT_BANK_COMMAND]
  if (d.group === 'requirements') return [`SWR-HLR-LAT-${pad((d.idx % 36) + 1)}`]
  if (d.group === 'boundary') return [`SWR-LLR-LAT-${pad(((d.idx * 5) % 54) + 1)}`]
  return [`SWR-LLR-LAT-${pad(((d.idx * 4 + 2) % 54) + 1)}`, `SWR-DRV-LAT-${pad((d.idx % 6) + 1)}`]
}

export const testRecords: EvidenceRecord[] = testDefs.map((d) => {
  const failed = d.id === FAILED_ROBUST_TEST
  const notRun = d.id === 'TC-LAT-ROBUST-012'
  const blocked = d.id === 'TC-LAT-ROBUST-011'
  const iterations = 3 + (d.globalIdx % 2) + (d.id === FEATURED_TEST ? 1 : 0)
  const changed = d.id === FEATURED_TEST || d.id === 'TC-LAT-REQ-018'
  return rec({
    id: d.id,
    title:
      d.id === FEATURED_TEST
        ? 'Bank angle limit boundary sweep at airspeed breakpoints'
        : `${GROUP_TITLES[d.group]} — ${pick(['capture entry', 'track hold', 'mode transition', 'output validity', 'turn anticipation', 'deviation filter', 'bank limiting', 'stale input handling'], d.globalIdx)} case ${d.idx + 1}`,
    type: 'test-case',
    phase: 'verification',
    status: failed ? 'failed' : notRun ? 'not-run' : blocked ? 'blocked' : 'passed',
    revision: changed ? 'Rev 5' : 'Rev 3',
    sourcePath: `verification/tests/${d.group}/${d.id}.slmx`,
    sourceKind: 'SLMX',
    modifiedDay: changed ? 104 : 62 + (d.globalIdx % 30),
    upstream: upstreamFor(d),
    downstream: d.group === 'robustness' ? ['RobustnessResults_2_4_0'] : [FEATURED_RESULT_SET],
    reviewState: notRun ? 'not-reviewed' : failed ? 'pending' : 'approved',
    findingIds: failed ? ['FND-005'] : d.id === 'TC-LAT-REQ-012' ? ['FND-012'] : [],
    changeMark: changed ? 'changed' : d.id.startsWith('TC-LAT-BOUNDARY') ? 'impacted' : 'unchanged',
    meta: {
      owner: pick(PEOPLE, d.globalIdx),
      iterations,
      procedure: `PROC-${pad(Math.floor(d.globalIdx / 4) + 1)}`,
      method: d.group === 'robustness' ? 'Robustness' : 'Normal range',
      lastRun: changed ? '2026-07-08' : '2026-06-21',
    },
  })
})

export const TOTAL_ITERATIONS = testRecords.reduce((a, t) => a + (typeof t.meta.iterations === 'number' ? t.meta.iterations : 0), 0)

const RESULT_SET_DEFS: Array<{
  id: string
  title: string
  baseline: '2.3.0' | '2.4.0'
  status: 'passed' | 'failed' | 'stale'
  tests: number
  passed: number
  failed: number
  blocked: number
  notRun: number
  findingIds?: string[]
  day: number
}> = [
  { id: FEATURED_RESULT_SET, title: 'Requirements & boundary test results — baseline 2.4.0', baseline: '2.4.0', status: 'passed', tests: 52, passed: 52, failed: 0, blocked: 0, notRun: 0, day: 106 },
  { id: 'RobustnessResults_2_4_0', title: 'Robustness test results — baseline 2.4.0', baseline: '2.4.0', status: 'failed', tests: 12, passed: 9, failed: 1, blocked: 1, notRun: 1, findingIds: ['FND-005'], day: 107 },
  { id: 'CoverageResults_2_4_0', title: 'Structural coverage results — baseline 2.4.0', baseline: '2.4.0', status: 'passed', tests: 52, passed: 52, failed: 0, blocked: 0, notRun: 0, findingIds: ['FND-007'], day: 108 },
  { id: STALE_RESULT_SET, title: 'Regression subset results — baseline 2.4.0', baseline: '2.4.0', status: 'stale', tests: 20, passed: 20, failed: 0, blocked: 0, notRun: 0, findingIds: ['FND-006'], day: 92 },
  { id: 'RequirementsResults_2_3_0', title: 'Requirements test results — baseline 2.3.0', baseline: '2.3.0', status: 'passed', tests: 50, passed: 50, failed: 0, blocked: 0, notRun: 0, day: 12 },
  { id: 'RobustnessResults_2_3_0', title: 'Robustness test results — baseline 2.3.0', baseline: '2.3.0', status: 'passed', tests: 12, passed: 12, failed: 0, blocked: 0, notRun: 0, day: 13 },
]

export const resultSetRecords: EvidenceRecord[] = RESULT_SET_DEFS.map((d, i) =>
  rec({
    id: d.id,
    title: d.title,
    type: 'result-set',
    phase: 'verification',
    status: d.status,
    revision: d.baseline === '2.4.0' ? 'Run 2026-07' : 'Run 2026-03',
    sourcePath: `verification/results/${d.id}.xlsx`,
    sourceKind: 'XLSX',
    modifiedDay: d.day,
    baseline: d.baseline,
    upstream: d.id === FEATURED_RESULT_SET ? [FEATURED_TEST] : [],
    downstream: d.id === FEATURED_RESULT_SET ? [FEATURED_RESULT] : [],
    reviewState: d.status === 'stale' ? 'stale' : 'approved',
    findingIds: d.findingIds,
    changeMark: d.baseline === '2.4.0' ? (d.status === 'stale' ? 'stale' : 'added') : 'unchanged',
    provenance: `Published by test automation run ${d.baseline}-${pad(i + 1)} · verification host aeronav-vv-02`,
    meta: {
      tests: d.tests,
      passed: d.passed,
      failed: d.failed,
      blocked: d.blocked,
      notRun: d.notRun,
      environment: 'Target HW Rev 4 + SafeRTOS-178 3.2.0',
      hashState: d.status === 'stale' ? 'Stored hash differs from recomputed hash' : 'Verified',
    },
  }),
)

export const resultRecords: EvidenceRecord[] = [
  rec({
    id: FEATURED_RESULT,
    title: 'TC-LAT-BOUNDARY-008 execution record — all 5 iterations passed',
    type: 'result',
    phase: 'verification',
    status: 'passed',
    revision: 'Run 2026-07',
    sourcePath: 'verification/results/RequirementsResults_2_4_0.xlsx#VR-RESULT-2026-041',
    sourceKind: 'XLSX',
    modifiedDay: 106,
    baseline: '2.4.0',
    upstream: [FEATURED_RESULT_SET],
    changeMark: 'added',
    provenance: 'Recorded by test automation · reviewed in REV-2026-140',
    meta: {
      test: FEATURED_TEST,
      iterations: 5,
      verdict: 'Pass',
      environment: 'Target HW Rev 4',
      executedBy: 'K. Yamada',
    },
  }),
  rec({
    id: 'VR-RESULT-2026-044',
    title: 'TC-LAT-ROBUST-007 execution record — iteration 2 failed',
    type: 'result',
    phase: 'verification',
    status: 'failed',
    revision: 'Run 2026-07',
    sourcePath: 'verification/results/RobustnessResults_2_4_0.xlsx#VR-RESULT-2026-044',
    sourceKind: 'XLSX',
    modifiedDay: 107,
    baseline: '2.4.0',
    upstream: ['RobustnessResults_2_4_0'],
    findingIds: ['FND-005'],
    changeMark: 'added',
    provenance: 'Recorded by test automation · failure triaged in FND-005',
    meta: { test: FAILED_ROBUST_TEST, iterations: 4, verdict: 'Fail — output exceeded limit during stale-input recovery', environment: 'Target HW Rev 4', executedBy: 'K. Yamada' },
  }),
]

export interface CoverageRow {
  module: string
  statement: number
  decision: number
  mcdc: number
  note: string
  findingIds: string[]
}

export const coverageRows: CoverageRow[] = [
  { module: 'lateral_guidance.c', statement: 100, decision: 92.4, mcdc: 91.8, note: 'Decision gap in limit_bank_command high-speed branch', findingIds: ['FND-007'] },
  { module: 'bank_angle_limiter.c', statement: 100, decision: 100, mcdc: 100, note: '—', findingIds: [] },
  { module: 'mode_logic.c', statement: 100, decision: 98.6, mcdc: 97.2, note: 'Analysis pending for defensive branch', findingIds: [] },
  { module: 'roll_command.c', statement: 100, decision: 100, mcdc: 100, note: '—', findingIds: [] },
  { module: 'guidance_output.c', statement: 100, decision: 100, mcdc: 100, note: '—', findingIds: [] },
  { module: 'bus_mapping.c', statement: 100, decision: 100, mcdc: 100, note: '—', findingIds: [] },
  { module: 'lookup_tables.c', statement: 100, decision: 100, mcdc: 100, note: '—', findingIds: [] },
  { module: 'guidance_params.c', statement: 100, decision: 100, mcdc: 100, note: '—', findingIds: [] },
  { module: 'guidance_math.c', statement: 100, decision: 100, mcdc: 98.9, note: 'MC/DC analysis case documented', findingIds: [] },
  { module: 'scheduler.c', statement: 100, decision: 100, mcdc: 100, note: '—', findingIds: [] },
  { module: 'io_interface.c', statement: 98.7, decision: 96.1, mcdc: 95.4, note: 'Hardware-fault branches covered by analysis', findingIds: [] },
  { module: 'diagnostics.c', statement: 100, decision: 100, mcdc: 100, note: '—', findingIds: [] },
]

export const verificationRecords: EvidenceRecord[] = [...testRecords, ...resultSetRecords, ...resultRecords]

// ===== from fixtures/cm.ts =====
// Configuration management fixtures: baselines 2.3.0 / 2.4.0, 18 change and
// problem records, build reproducibility checks, and records removed in 2.4.0.

export const baselines: BaselineInfo[] = [
  {
    id: '2.3.0',
    label: 'Baseline 2.3.0 — released',
    published: '2026-03-14T10:00Z',
    itemCount: 512,
    status: 'released',
    notes: 'Certification baseline for prior audit cycle.',
  },
  {
    id: '2.4.0',
    label: 'Baseline 2.4.0 — active',
    published: '2026-07-10T09:00Z',
    itemCount: 531,
    status: 'active',
    notes: 'Adds bank-limit re-scheduling and mode-transition debounce changes.',
  },
]

const CR_TITLES = [
  'Raise high-speed bank limit segment from 25° to 27°',
  'Add two-frame debounce to lateral mode transitions',
  'Update bank limit breakpoint table in guidance_params.sldd',
  'Regenerate lateral_guidance module after limiter change',
  'Extend boundary test suite for new bank limit envelope',
  'Refresh derived requirement rationale for turn anticipation floor',
  'Update SVP regression strategy for partial reruns',
  'Correct waypoint sequencing hysteresis constant',
  'Re-schedule bank limit interpolation slope',
  'Add stale-input recovery robustness cases',
  'Align output bus version field with ICD Rev G',
  'Update PSAC references to SCI Rev E',
]

const PR_TITLES = [
  'Roll command transient observed during localizer capture in bench run',
  'Coverage tool mislabels analysis-covered branches in report export',
  'Regression subset result hash mismatch after re-archive',
  'Mode annunciation flicker during rapid arm/disarm sequence',
  'Robustness failure: bank command exceeds limit during stale-input recovery',
  'Trace export omits harness-only model elements',
]

export const changeRecords: ChangeRecord[] = [
  ...CR_TITLES.map((title, i) => {
    const n = i + 1
    const id = `CR-2026-${String(n).padStart(3, '0')}`
    const unreverified = id === 'CR-2026-009'
    return {
      id,
      kind: 'change' as const,
      title,
      status: unreverified ? ('implemented' as const) : n <= 8 ? ('closed' as const) : ('verified' as const),
      owner: pick(PEOPLE, i),
      raised: `2026-0${(i % 4) + 4}-${String((i * 2 + 3) % 27 + 1).padStart(2, '0')}`,
      baseline: '2.4.0' as const,
      affectedIds:
        n === 1
          ? ['SYS-LAT-014', 'SWR-HLR-LAT-021', 'SWR-LLR-LAT-044', 'LateralGuidance/BankAngleLimiter']
          : n === 2
            ? ['SYS-LAT-009', 'SWR-LLR-LAT-025', 'SWR-LLR-LAT-026', 'MDL-ModeLogic']
            : n === 9
              ? ['SWR-LLR-LAT-044', 'lateral_guidance.c::limit_bank_command', 'TC-LAT-BOUNDARY-008']
              : [`SWR-LLR-LAT-${String(((n * 4) % 54) + 1).padStart(3, '0')}`],
      reverified: !unreverified,
      findingIds: unreverified ? ['FND-010'] : [],
      detail: unreverified
        ? 'Interpolation slope change implemented in 2.4.0 but the affected boundary tests have not been re-executed.'
        : 'Change implemented and verification evidence re-established for baseline 2.4.0.',
    }
  }),
  ...PR_TITLES.map((title, i) => {
    const n = i + 1
    const id = `PR-2026-${String(n).padStart(3, '0')}`
    const openPr = n === 3 || n === 5
    return {
      id,
      kind: 'problem' as const,
      title,
      status: openPr ? ('open' as const) : n === 6 ? ('deferred' as const) : ('closed' as const),
      owner: pick(PEOPLE, i + 5),
      raised: `2026-0${(i % 3) + 5}-${String((i * 3 + 7) % 27 + 1).padStart(2, '0')}`,
      baseline: '2.4.0' as const,
      affectedIds:
        n === 3
          ? ['RegressionResults_2_4_0']
          : n === 5
            ? ['TC-LAT-ROBUST-007', 'RobustnessResults_2_4_0']
            : [`TC-LAT-REQ-${String(((n * 6) % 40) + 1).padStart(3, '0')}`],
      reverified: !openPr,
      findingIds: n === 3 ? ['FND-006'] : n === 5 ? ['FND-005'] : [],
      detail: openPr ? 'Problem confirmed; corrective action tracked through linked finding.' : 'Problem resolved and closed with linked evidence.',
    }
  }),
]

export interface ReproCheckRow {
  step: string
  expected: string
  actual: string
  match: boolean
  note: string
}

export const reproChecks: ReproCheckRow[] = [
  { step: 'Model archive checksum (models/)', expected: '9f31c2…', actual: '9f31c2…', match: true, note: 'Matches SCI Rev E entry' },
  { step: 'Generated code checksum (src/lateral/)', expected: '4ba7e8…', actual: '4ba7e8…', match: true, note: 'Regenerated from tagged models' },
  { step: 'Compiler/toolchain fingerprint', expected: 'gcc 12.3.1-aero', actual: 'gcc 12.3.1-aero', match: true, note: 'ENV-COMPILER pinned' },
  { step: 'Executable object checksum', expected: 'c118d0…', actual: 'c118d0…', match: true, note: 'Reproducible build verified' },
  { step: 'Regression result archive hash', expected: '7d92aa…', actual: '3f04b1…', match: false, note: 'Stale archive — see FND-006 / PR-2026-003' },
  { step: 'Coverage data bundle hash', expected: 'e5c614…', actual: 'e5c614…', match: true, note: 'Matches CoverageResults_2_4_0' },
]

/** Records present in 2.3.0 but removed from 2.4.0 (baseline compare). */
export const removedIn240: EvidenceRecord[] = [
  rec({
    id: 'SWR-LLR-LAT-R01',
    title: 'Legacy roll-rate pre-filter initialization (superseded)',
    type: 'llr',
    phase: 'requirements',
    status: 'approved',
    revision: 'Rev 2',
    sourcePath: 'requirements/software/aeronav_swr_llr.slreqx',
    sourceKind: 'SLREQX',
    modifiedDay: 5,
    baseline: '2.3.0',
    meta: { owner: pick(PEOPLE, 2), verificationMethod: 'Test', removal: 'Superseded by SWR-LLR-LAT-013 in 2.4.0' },
  }),
  rec({
    id: 'SWR-LLR-LAT-R02',
    title: 'Fixed 25° bank limit constant definition (replaced by table)',
    type: 'llr',
    phase: 'requirements',
    status: 'approved',
    revision: 'Rev 3',
    sourcePath: 'requirements/software/aeronav_swr_llr.slreqx',
    sourceKind: 'SLREQX',
    modifiedDay: 6,
    baseline: '2.3.0',
    meta: { owner: pick(PEOPLE, 4), verificationMethod: 'Test', removal: 'Replaced by speed-scheduled limit table (SWR-LLR-LAT-044)' },
  }),
  rec({
    id: 'TC-LAT-REQ-R01',
    title: 'Fixed bank limit verification test (retired with constant limit)',
    type: 'test-case',
    phase: 'verification',
    status: 'passed',
    revision: 'Rev 2',
    sourcePath: 'verification/tests/requirements/TC-LAT-REQ-R01.slmx',
    sourceKind: 'SLMX',
    modifiedDay: 8,
    baseline: '2.3.0',
    meta: { owner: pick(PEOPLE, 6), iterations: 3, removal: 'Retired — superseded by TC-LAT-BOUNDARY suite' },
  }),
]

// ===== from fixtures/qa.ts =====
// Quality assurance fixtures: 45 review records, 6 audits, open actions.
// REV-2026-112 (SWR-LLR-LAT-052) is the missing-independence review (FND-008).

const METHODS: ReviewMethod[] = ['inspection', 'walkthrough', 'analysis', 'checklist']

interface ReviewSeed {
  phase: Phase
  reviewType: string
  subjects: string[]
}

const SEEDS: ReviewSeed[] = [
  {
    phase: 'planning',
    reviewType: 'Plan review',
    subjects: ['PLN-PSAC', 'PLN-SDP', 'PLN-SVP', 'PLN-SCMP', 'PLN-SQAP', 'PLN-TQP'],
  },
  {
    phase: 'requirements',
    reviewType: 'Requirements review',
    subjects: [
      'SYS-LAT-014',
      'SWR-HLR-LAT-021',
      'SWR-HLR-LAT-009',
      'SWR-LLR-LAT-044',
      'SWR-LLR-LAT-025',
      'SWR-LLR-LAT-052',
      'SWR-DRV-LAT-003',
      'SWR-DRV-LAT-001',
      'SWR-HLR-LAT-005',
      'SWR-LLR-LAT-010',
    ],
  },
  {
    phase: 'design',
    reviewType: 'Model review',
    subjects: [
      'MDL-LateralGuidance',
      'MDL-ModeLogic',
      'MDL-RollCommand',
      'MDL-GuidanceOutput',
      'LateralGuidance/BankAngleLimiter',
      'DD-guidance_types',
      'DD-guidance_params',
      'HRN-BankAngleLimiter',
    ],
  },
  {
    phase: 'implementation',
    reviewType: 'Code review',
    subjects: ['lateral_guidance.c', 'bank_angle_limiter.c', 'mode_logic.c', 'guidance_math.c', 'io_interface.c', 'scheduler.c'],
  },
  {
    phase: 'verification',
    reviewType: 'Test & results review',
    subjects: [
      'TC-LAT-BOUNDARY-008',
      'TC-LAT-ROBUST-007',
      'RequirementsResults_2_4_0',
      'RobustnessResults_2_4_0',
      'CoverageResults_2_4_0',
      'RegressionResults_2_4_0',
      'VR-RESULT-2026-041',
      'TC-LAT-REQ-012',
    ],
  },
  { phase: 'cm', reviewType: 'CM record review', subjects: ['CR-2026-001', 'CR-2026-009', 'PR-2026-003'] },
  { phase: 'certification', reviewType: 'Compliance review', subjects: ['DOC-SAS', 'DOC-SCI', 'OBJ-A5-03', 'PKG-2026-011'] },
]

let seq = 100
export const reviewRecords: ReviewRecord[] = SEEDS.flatMap((seed, si) =>
  seed.subjects.map((subjectId, i) => {
    seq += 1
    const id = `REV-2026-${seq}`
    const missingIndependence = seed.phase === 'requirements' && subjectId === 'SWR-LLR-LAT-052'
    const stale = subjectId === 'DD-guidance_types'
    const pending = subjectId === 'PLN-TQP' || subjectId === 'TC-LAT-ROBUST-007'
    const result: ReviewResult = pending ? 'pending' : stale ? 'passed' : (si + i) % 5 === 3 ? 'passed-with-actions' : 'passed'
    return {
      id,
      reviewType: seed.reviewType,
      subjectId,
      phase: seed.phase,
      reviewer: pick(PEOPLE, si * 3 + i + 1),
      method: pick(METHODS, si + i),
      date: `2026-0${(si % 3) + 5}-${String(((i * 3 + si) % 27) + 1).padStart(2, '0')}`,
      revision: stale ? 'Rev 7 (current is Rev 8)' : 'Current',
      result,
      independent: !missingIndependence,
      openActions: result === 'passed-with-actions' ? 1 + (i % 2) : 0,
      comments: missingIndependence
        ? 'LLR review performed by the requirement author; independence required for Level B.'
        : stale
          ? 'Review predates the Rev 8 bank-limit bus change; re-review required.'
          : result === 'passed-with-actions'
            ? 'Minor editorial and checklist actions recorded.'
            : 'No issues recorded.',
      findingIds: missingIndependence ? ['FND-008'] : stale ? ['FND-003'] : [],
    }
  }),
)

export const auditRecords: AuditRecord[] = [
  { id: 'AUD-2026-01', scope: 'Planning process conformance (SDP/SVP execution)', auditor: 'E. Sorensen', date: '2026-04-09', result: 'conformant', openActions: 0, phase: 'planning' },
  { id: 'AUD-2026-02', scope: 'Requirements change control and trace discipline', auditor: 'E. Sorensen', date: '2026-05-06', result: 'observations', openActions: 2, phase: 'requirements' },
  { id: 'AUD-2026-03', scope: 'Model development standard conformance (DO-331)', auditor: 'T. Ibrahim', date: '2026-05-20', result: 'conformant', openActions: 0, phase: 'design' },
  { id: 'AUD-2026-04', scope: 'Verification environment control and result archiving', auditor: 'E. Sorensen', date: '2026-06-11', result: 'nonconformance', openActions: 3, phase: 'verification' },
  { id: 'AUD-2026-05', scope: 'Configuration status accounting for baseline 2.4.0', auditor: 'T. Ibrahim', date: '2026-06-25', result: 'observations', openActions: 1, phase: 'cm' },
  { id: 'AUD-2026-06', scope: 'Transition-to-certification readiness (SAS/SCI)', auditor: 'E. Sorensen', date: '2026-07-08', result: 'observations', openActions: 2, phase: 'certification' },
]

export interface OpenActionRow {
  id: string
  source: string
  action: string
  owner: string
  due: string
  overdue: boolean
}

export const openActions: OpenActionRow[] = [
  { id: 'ACT-041', source: 'AUD-2026-02', action: 'Record safety feedback for SWR-DRV-LAT-003 in system process log', owner: 'M. Okafor', due: '2026-07-15', overdue: true },
  { id: 'ACT-042', source: 'AUD-2026-02', action: 'Restore model link for SWR-LLR-LAT-052 or document decomposition', owner: 'R. Vasquez', due: '2026-07-24', overdue: false },
  { id: 'ACT-047', source: 'AUD-2026-04', action: 'Re-archive regression subset results with verified hash', owner: 'K. Yamada', due: '2026-07-12', overdue: true },
  { id: 'ACT-048', source: 'AUD-2026-04', action: 'Close robustness failure FND-005 corrective action', owner: 'K. Yamada', due: '2026-07-30', overdue: false },
  { id: 'ACT-049', source: 'AUD-2026-04', action: 'Complete decision-coverage gap analysis for limit_bank_command', owner: 'A. Chen', due: '2026-07-28', overdue: false },
  { id: 'ACT-052', source: 'AUD-2026-05', action: 'Re-run boundary tests affected by CR-2026-009', owner: 'J. Lindqvist', due: '2026-07-21', overdue: true },
  { id: 'ACT-055', source: 'AUD-2026-06', action: 'Update PSAC SCI reference from Rev C to Rev E', owner: 'L. Fontaine', due: '2026-08-01', overdue: false },
  { id: 'ACT-056', source: 'REV-2026-112', action: 'Repeat SWR-LLR-LAT-052 review with independent reviewer', owner: 'D. Novak', due: '2026-07-25', overdue: false },
]

// ===== from fixtures/certification.ts =====
// Certification fixtures: configurable objective identifiers (no licensed
// standard text), SAS/SCI status documents, and one seeded audit package.

// Objective identifiers are program-configurable labels; descriptions are
// hub-authored satisfaction summaries, not standard text.
const OBJ_DEFS: Array<{
  table: string
  n: number
  state: 'satisfied' | 'partial' | 'unsatisfied'
  summary: string
  evidence: string[]
  findingIds?: string[]
}> = [
  { table: 'A-2', n: 1, state: 'satisfied', summary: 'System requirement set allocated to software and baselined.', evidence: ['SYS-LAT-014', 'PLN-PSAC'] },
  { table: 'A-2', n: 2, state: 'satisfied', summary: 'High-level requirement set developed and reviewed.', evidence: ['SWR-HLR-LAT-021'] },
  { table: 'A-2', n: 3, state: 'partial', summary: 'Derived requirements defined; one safety feedback record outstanding.', evidence: ['SWR-DRV-LAT-003'], findingIds: ['FND-001'] },
  { table: 'A-2', n: 4, state: 'satisfied', summary: 'Design model architecture established under DO-331 supplement.', evidence: ['MDL-LateralGuidance'] },
  { table: 'A-2', n: 5, state: 'satisfied', summary: 'Low-level requirement set developed from design model.', evidence: ['SWR-LLR-LAT-044'] },
  { table: 'A-3', n: 1, state: 'satisfied', summary: 'HLR compliance with system requirements reviewed with trace evidence.', evidence: ['SWR-HLR-LAT-021', 'REV-2026-108'] },
  { table: 'A-3', n: 2, state: 'satisfied', summary: 'HLR accuracy and consistency reviews complete.', evidence: ['REV-2026-108'] },
  { table: 'A-3', n: 3, state: 'satisfied', summary: 'HLR verifiability confirmed by verification method assignment.', evidence: ['STD-VER'] },
  { table: 'A-3', n: 4, state: 'partial', summary: 'Trace SYS↔HLR complete; one LLR trace gap remains open.', evidence: ['SWR-LLR-LAT-052'], findingIds: ['FND-002'] },
  { table: 'A-3', n: 5, state: 'satisfied', summary: 'Requirement standard conformance audited.', evidence: ['STD-REQ', 'AUD-2026-02'] },
  { table: 'A-4', n: 1, state: 'satisfied', summary: 'LLR compliance with HLRs established through model review.', evidence: ['MDL-LateralGuidance', 'REV-2026-117'] },
  { table: 'A-4', n: 2, state: 'partial', summary: 'Data dictionary review stale after Rev 8 bus change.', evidence: ['DD-guidance_types'], findingIds: ['FND-003'] },
  { table: 'A-4', n: 3, state: 'satisfied', summary: 'Model architecture consistency verified in design reviews.', evidence: ['REV-2026-117'] },
  { table: 'A-4', n: 4, state: 'satisfied', summary: 'Design standard conformance confirmed (DO-331).', evidence: ['STD-DES', 'AUD-2026-03'] },
  { table: 'A-5', n: 1, state: 'partial', summary: 'Source-to-design trace complete except one hand-code gap.', evidence: ['mode_logic.c::select_capture_mode'], findingIds: ['FND-004'] },
  { table: 'A-5', n: 2, state: 'satisfied', summary: 'Code review evidence complete for generated and hand code.', evidence: ['REV-2026-125'] },
  { table: 'A-5', n: 3, state: 'partial', summary: 'Coding standard conformance with one DER-approved deviation.', evidence: ['DEV-2026-004'], findingIds: ['FND-011'] },
  { table: 'A-5', n: 4, state: 'satisfied', summary: 'Static analysis clean across baseline 2.4.0 modules.', evidence: ['lateral_guidance.c'] },
  { table: 'A-6', n: 1, state: 'partial', summary: 'Requirements-based testing complete; robustness failure in work.', evidence: ['RobustnessResults_2_4_0'], findingIds: ['FND-005'] },
  { table: 'A-6', n: 2, state: 'satisfied', summary: 'Normal-range test coverage of HLRs and LLRs achieved.', evidence: ['RequirementsResults_2_4_0'] },
  { table: 'A-6', n: 3, state: 'partial', summary: 'Structural coverage at decision level shows one open gap.', evidence: ['CoverageResults_2_4_0'], findingIds: ['FND-007'] },
  { table: 'A-7', n: 1, state: 'partial', summary: 'CM records current; one change awaits reverification.', evidence: ['CR-2026-009'], findingIds: ['FND-010'] },
  { table: 'A-7', n: 2, state: 'partial', summary: 'SCI current at Rev E; PSAC still references Rev C.', evidence: ['DOC-SCI', 'PLN-PSAC'], findingIds: ['FND-009'] },
  { table: 'A-7', n: 3, state: 'partial', summary: 'QA independence maintained except one LLR review.', evidence: ['REV-2026-112'], findingIds: ['FND-008'] },
]

export const objectiveRecords: EvidenceRecord[] = OBJ_DEFS.map((d, i) =>
  rec({
    id: `OBJ-${d.table}-${String(d.n).padStart(2, '0')}`,
    title: `Objective ${d.table}.${d.n} (configurable identifier) — ${d.summary}`,
    type: 'objective',
    phase: 'certification',
    status: d.state,
    revision: 'Matrix Rev 4',
    sourcePath: 'certification/objective_matrix.xlsx',
    sourceKind: 'XLSX',
    modifiedDay: 104 + (i % 4),
    upstream: d.evidence,
    reviewState: d.state === 'satisfied' ? 'approved' : 'pending',
    findingIds: d.findingIds,
    changeMark: d.findingIds ? 'impacted' : 'unchanged',
    meta: {
      objectiveTable: d.table,
      satisfaction: d.state,
      configNote: 'Identifier mapping configured per program; no licensed objective text stored.',
    },
  }),
)

export const certDocRecords: EvidenceRecord[] = [
  rec({
    id: 'DOC-SAS',
    title: 'Software Accomplishment Summary (SAS) — draft for baseline 2.4.0',
    type: 'plan',
    phase: 'certification',
    status: 'in-review',
    revision: 'Rev C (draft)',
    sourcePath: 'certification/sas_2_4_0.xlsx',
    sourceKind: 'XLSX',
    modifiedDay: 108,
    reviewState: 'pending',
    changeMark: 'changed',
    meta: {
      owner: 'L. Fontaine',
      sections: 'Overview · Compliance · Deviations · Open problems',
      openItems: 5,
    },
  }),
  rec({
    id: 'DOC-SCI',
    title: 'Software Configuration Index (SCI) — baseline 2.4.0',
    type: 'config-item',
    phase: 'certification',
    status: 'approved',
    revision: 'Rev E',
    sourcePath: 'certification/sci_2_4_0.xlsx',
    sourceKind: 'XLSX',
    modifiedDay: 106,
    reviewState: 'approved',
    findingIds: ['FND-009'],
    changeMark: 'changed',
    meta: {
      owner: 'D. Novak',
      itemCount: 531,
      note: 'PSAC cross-reference still cites Rev C (FND-009).',
    },
  }),
]

export interface SeedPackage {
  id: string
  name: string
  createdAt: string
  scopePhases: string[]
  evidenceCount: number
  findingCount: number
  reviewCount: number
  status: 'complete'
}

/** Seeded example package restored by “Reset sample changes”. */
export const seedPackage: SeedPackage = {
  id: 'PKG-2026-011',
  name: 'Stage 3 audit preparation package',
  createdAt: '2026-06-30T15:20Z',
  scopePhases: ['requirements', 'verification'],
  evidenceCount: 138,
  findingCount: 7,
  reviewCount: 18,
  status: 'complete',
}

export const certificationRecords: EvidenceRecord[] = [...objectiveRecords, ...certDocRecords]

// ===== from fixtures/findings.ts =====
// The twelve seeded findings. Fixture data is immutable: user transitions are
// stored as overlay history appended on top of these seeded records.

function h(at: string, actor: string, action: string, note?: string) {
  return note === undefined ? { at, actor, action } : { at, actor, action, note }
}

export const findings: Finding[] = [
  {
    id: 'FND-001',
    title: 'Derived requirement missing safety feedback record',
    detail:
      'SWR-DRV-LAT-003 (roll command zeroing during output-bus initialization) has no recorded feedback to the system safety process, required for derived requirements at Level B.',
    severity: 'medium',
    phase: 'requirements',
    owner: 'M. Okafor',
    status: 'assigned',
    due: '2026-07-31',
    evidenceIds: ['SWR-DRV-LAT-003'],
    history: [
      h('2026-06-02T09:12Z', 'E. Sorensen', 'Created', 'Raised during audit AUD-2026-02.'),
      h('2026-06-03T10:00Z', 'E. Sorensen', 'Assigned', 'Assigned to requirements lead.'),
    ],
  },
  {
    id: 'FND-002',
    title: 'Broken LLR-to-model trace link',
    detail:
      'SWR-LLR-LAT-052 no longer resolves to a model element after the ModeLogic restructure; downstream trace is empty and the review of the decomposition is stale.',
    severity: 'high',
    phase: 'requirements',
    owner: 'R. Vasquez',
    status: 'assigned',
    due: '2026-07-24',
    evidenceIds: ['SWR-LLR-LAT-052', 'MDL-ModeLogic'],
    history: [
      h('2026-06-10T14:40Z', 'Trace analyzer', 'Created', 'Automated trace audit reported unresolved downstream reference.'),
      h('2026-06-11T08:30Z', 'E. Sorensen', 'Assigned'),
    ],
  },
  {
    id: 'FND-003',
    title: 'Stale data-dictionary review',
    detail:
      'guidance_types.sldd Rev 8 introduced the bank-limit bus change, but the recorded review (REV-2026-122) covers Rev 7. Re-review is required before credit is taken.',
    severity: 'medium',
    phase: 'design',
    owner: 'A. Chen',
    status: 'dispositioned',
    due: '2026-07-28',
    evidenceIds: ['DD-guidance_types'],
    disposition: 'Re-review scheduled with the model review board; interim use restricted to analysis.',
    history: [
      h('2026-06-15T11:00Z', 'Hub staleness check', 'Created'),
      h('2026-06-16T09:00Z', 'T. Ibrahim', 'Assigned'),
      h('2026-06-20T15:30Z', 'A. Chen', 'Dispositioned', 'Re-review planned for the July model review board.'),
    ],
  },
  {
    id: 'FND-004',
    title: 'Missing code-to-design trace',
    detail:
      'mode_logic.c::select_capture_mode carries no model origin link. Either restore the generated-code trace annotation or document it as hand-modified code with its own LLR trace.',
    severity: 'high',
    phase: 'implementation',
    owner: 'J. Lindqvist',
    status: 'assigned',
    due: '2026-07-27',
    evidenceIds: ['mode_logic.c::select_capture_mode', 'mode_logic.c'],
    history: [
      h('2026-06-18T13:20Z', 'Trace analyzer', 'Created', 'Model-to-code sweep found an unlinked function.'),
      h('2026-06-19T08:45Z', 'S. Patel', 'Assigned'),
    ],
  },
  {
    id: 'FND-005',
    title: 'Robustness test failure in stale-input recovery',
    detail:
      'TC-LAT-ROBUST-007 iteration 2 failed: bank command exceeded the scheduled limit for one frame during stale-input recovery. Tracked with PR-2026-005.',
    severity: 'high',
    phase: 'verification',
    owner: 'K. Yamada',
    status: 'corrective-action',
    due: '2026-07-30',
    evidenceIds: ['TC-LAT-ROBUST-007', 'RobustnessResults_2_4_0', 'VR-RESULT-2026-044'],
    disposition: 'Confirmed software behavior deviation; fix required before closure of baseline 2.4.0 verification.',
    correctiveAction: 'Clamp recovery path added under CR-2026-010; re-run of robustness suite scheduled.',
    history: [
      h('2026-07-02T16:10Z', 'Test automation', 'Created', 'Failure recorded in RobustnessResults_2_4_0.'),
      h('2026-07-03T09:00Z', 'S. Patel', 'Assigned'),
      h('2026-07-04T10:30Z', 'K. Yamada', 'Dispositioned'),
      h('2026-07-08T14:00Z', 'K. Yamada', 'Corrective action', 'CR-2026-010 raised for recovery-path clamp.'),
    ],
  },
  {
    id: 'FND-006',
    title: 'Stale result hash on regression subset archive',
    detail:
      'RegressionResults_2_4_0 stored hash no longer matches the recomputed archive hash; the archive was re-packed without a controlled re-run. Tracked with PR-2026-003.',
    severity: 'medium',
    phase: 'verification',
    owner: 'K. Yamada',
    status: 'assigned',
    due: '2026-07-22',
    evidenceIds: ['RegressionResults_2_4_0'],
    history: [
      h('2026-07-05T08:20Z', 'Hub integrity check', 'Created', 'Hash verification failed during refresh.'),
      h('2026-07-05T09:10Z', 'E. Sorensen', 'Assigned'),
    ],
  },
  {
    id: 'FND-007',
    title: 'Decision coverage gap in limit_bank_command',
    detail:
      'Structural coverage for lateral_guidance.c::limit_bank_command reports 92.4% decision coverage; the high-speed limit branch is not exercised by the current boundary suite.',
    severity: 'medium',
    phase: 'verification',
    owner: 'A. Chen',
    status: 'dispositioned',
    due: '2026-07-28',
    evidenceIds: ['CoverageResults_2_4_0', 'lateral_guidance.c::limit_bank_command', 'TC-LAT-BOUNDARY-008'],
    disposition: 'Additional boundary iteration planned; gap traced to the 2.4.0 envelope extension.',
    history: [
      h('2026-07-06T10:00Z', 'Coverage analyzer', 'Created'),
      h('2026-07-06T11:00Z', 'S. Patel', 'Assigned'),
      h('2026-07-09T15:40Z', 'A. Chen', 'Dispositioned', 'New iteration TC-LAT-BOUNDARY-008/6 defined for the 27° segment.'),
    ],
  },
  {
    id: 'FND-008',
    title: 'Missing review independence on LLR review',
    detail:
      'REV-2026-112 for SWR-LLR-LAT-052 was performed by the requirement author. Level B requires independent review of LLRs; the review must be repeated.',
    severity: 'medium',
    phase: 'qa',
    owner: 'D. Novak',
    status: 'assigned',
    due: '2026-07-25',
    evidenceIds: ['REV-2026-112', 'SWR-LLR-LAT-052'],
    history: [
      h('2026-06-24T09:30Z', 'E. Sorensen', 'Created', 'Independence matrix audit.'),
      h('2026-06-24T10:00Z', 'E. Sorensen', 'Assigned'),
    ],
  },
  {
    id: 'FND-009',
    title: 'Obsolete SCI reference in PSAC',
    detail:
      'PLN-PSAC Rev E cites Software Configuration Index Rev C; the current index is Rev E. The PSAC reference set must be updated before the certification submission.',
    severity: 'low',
    phase: 'planning',
    owner: 'L. Fontaine',
    status: 'dispositioned',
    due: '2026-08-01',
    evidenceIds: ['PLN-PSAC', 'DOC-SCI'],
    disposition: 'Editorial update batched into the next PSAC revision cycle.',
    history: [
      h('2026-06-28T13:00Z', 'T. Ibrahim', 'Created', 'Found during certification readiness audit AUD-2026-06.'),
      h('2026-06-28T13:30Z', 'T. Ibrahim', 'Assigned'),
      h('2026-07-01T09:00Z', 'L. Fontaine', 'Dispositioned'),
    ],
  },
  {
    id: 'FND-010',
    title: 'Change record without reverification',
    detail:
      'CR-2026-009 (bank limit interpolation slope) is implemented in baseline 2.4.0, but the affected boundary tests have not been re-executed; verification credit is not yet re-established.',
    severity: 'high',
    phase: 'cm',
    owner: 'J. Lindqvist',
    status: 'corrective-action',
    due: '2026-07-21',
    evidenceIds: ['CR-2026-009', 'TC-LAT-BOUNDARY-008', 'SWR-LLR-LAT-044'],
    disposition: 'Change impact confirmed; targeted re-run required rather than full regression.',
    correctiveAction: 'Boundary suite re-run queued on verification host aeronav-vv-02.',
    history: [
      h('2026-07-01T08:00Z', 'CM status accounting', 'Created'),
      h('2026-07-01T09:20Z', 'D. Novak', 'Assigned'),
      h('2026-07-02T10:00Z', 'J. Lindqvist', 'Dispositioned'),
      h('2026-07-07T16:00Z', 'J. Lindqvist', 'Corrective action', 'Re-run scheduled with results due 2026-07-21.'),
    ],
  },
  {
    id: 'FND-011',
    title: 'Coding-standard deviation approved by DER',
    detail:
      'DEV-2026-004 (MISRA Rule 17.8 in generated interpolation code) is approved by the DER. Recorded as a finding so the deviation remains visible in audit scope.',
    severity: 'low',
    phase: 'implementation',
    owner: 'S. Patel',
    status: 'dispositioned',
    due: '2026-09-30',
    evidenceIds: ['DEV-2026-004', 'lookup_tables.c'],
    disposition: 'Deviation approved by DER H. Whitfield on 2026-06-30; no corrective action required.',
    history: [
      h('2026-06-29T11:00Z', 'S. Patel', 'Created', 'Deviation record promoted to audit visibility.'),
      h('2026-06-30T09:00Z', 'S. Patel', 'Assigned'),
      h('2026-06-30T15:00Z', 'DER — H. Whitfield', 'Dispositioned', 'Deviation approved; retained for audit trail.'),
    ],
  },
  {
    id: 'FND-012',
    title: 'Test procedure metadata mismatch (ready for closure)',
    detail:
      'TC-LAT-REQ-012 procedure header cited requirement revision Rev 3 while executing against Rev 4. Header corrected and procedure re-baselined; awaiting reverification evidence and independent closure.',
    severity: 'low',
    phase: 'verification',
    owner: 'K. Yamada',
    status: 'ready-for-closure',
    due: '2026-07-23',
    evidenceIds: ['TC-LAT-REQ-012', 'RequirementsResults_2_4_0'],
    disposition: 'Metadata defect confirmed; no impact on executed test logic.',
    correctiveAction: 'Procedure header corrected in Rev 4 and re-baselined into 2.4.0.',
    reverificationPlan: 'Attach re-executed TC-LAT-REQ-012 result delta and an independent QA confirmation review.',
    history: [
      h('2026-06-20T10:00Z', 'E. Sorensen', 'Created', 'Found during results review REV-2026-138.'),
      h('2026-06-20T10:30Z', 'E. Sorensen', 'Assigned'),
      h('2026-06-24T09:00Z', 'K. Yamada', 'Dispositioned'),
      h('2026-06-27T14:00Z', 'K. Yamada', 'Corrective action', 'Header corrected; procedure Rev 4 checked in.'),
      h('2026-07-03T11:00Z', 'K. Yamada', 'Ready for closure', 'Awaiting reverification evidence.'),
    ],
  },
]

// ===== from fixtures/index.ts =====
// Fixture repository: assembles all phase fixtures into one immutable,
// cross-linked evidence graph with search and trace traversal helpers.


const raw: EvidenceRecord[] = [
  ...planningRecords,
  ...environmentRecords,
  ...requirementRecords,
  ...designRecords,
  ...implementationRecords,
  ...verificationRecords,
  ...certificationRecords,
]

// Materialize bidirectional trace links: declared upstream/downstream unioned
// with the reverse direction, restricted to ids that actually resolve.
const byIdDraft = new Map(raw.map((r) => [r.id, r]))
const upMap = new Map<string, Set<string>>()
const downMap = new Map<string, Set<string>>()
const add = (map: Map<string, Set<string>>, key: string, value: string) => {
  const s = map.get(key) ?? new Set<string>()
  s.add(value)
  map.set(key, s)
}
for (const r of raw) {
  for (const u of r.upstream) {
    add(upMap, r.id, u)
    // Objective links reference evidence for compliance; they are not part of
    // the lifecycle trace chain, so they don't reverse-fill downstream trace.
    if (r.type !== 'objective' && byIdDraft.has(u)) add(downMap, u, r.id)
  }
  for (const d of r.downstream) {
    add(downMap, r.id, d)
    if (byIdDraft.has(d)) add(upMap, d, r.id)
  }
}

export const allEvidence: EvidenceRecord[] = raw.map((r) => ({
  ...r,
  upstream: [...(upMap.get(r.id) ?? [])].sort(),
  downstream: [...(downMap.get(r.id) ?? [])].sort(),
}))

export const evidenceById = new Map(allEvidence.map((r) => [r.id, r]))

export function getEvidence(id: string): EvidenceRecord | undefined {
  return evidenceById.get(id)
}

export function phaseRecords(phase: Phase): EvidenceRecord[] {
  return allEvidence.filter((r) => r.phase === phase)
}

/** The canonical eight-node cross-phase trace chain. */
export const canonicalChain: string[] = [
  'SYS-LAT-014',
  'SWR-HLR-LAT-021',
  'SWR-LLR-LAT-044',
  'LateralGuidance/BankAngleLimiter',
  'lateral_guidance.c::limit_bank_command',
  'TC-LAT-BOUNDARY-008',
  'RequirementsResults_2_4_0',
  'VR-RESULT-2026-041',
]

export interface TraceNode {
  record: EvidenceRecord | undefined
  id: string
  direction: 'upstream' | 'focus' | 'downstream'
  depth: number
  gap: boolean
}

/** Walk the trace graph from a focus record in both directions (bounded). */
export function traceFrom(id: string, maxDepth = 8, maxBreadth = 4): TraceNode[] {
  const focus = evidenceById.get(id)
  const nodes: TraceNode[] = []
  const seen = new Set<string>([id])
  const walk = (fromId: string, direction: 'upstream' | 'downstream', depth: number) => {
    if (depth > maxDepth) return
    const record = evidenceById.get(fromId)
    const nextIds = record ? (direction === 'upstream' ? record.upstream : record.downstream) : []
    for (const nextId of nextIds.slice(0, maxBreadth)) {
      if (seen.has(nextId)) continue
      seen.add(nextId)
      const next = evidenceById.get(nextId)
      nodes.push({ record: next, id: nextId, direction, depth, gap: next === undefined })
      if (next) walk(nextId, direction, depth + 1)
    }
  }
  nodes.push({ record: focus, id, direction: 'focus', depth: 0, gap: focus === undefined })
  walk(id, 'upstream', 1)
  walk(id, 'downstream', 1)
  return nodes
}

export function findingsFor(id: string) {
  return findings.filter((f) => f.evidenceIds.includes(id) || (evidenceById.get(id)?.findingIds ?? []).includes(f.id))
}

export function reviewsFor(id: string) {
  return reviewRecords.filter((r) => r.subjectId === id)
}

export interface SearchFacets {
  phase?: Phase | 'all'
  type?: string
  status?: string
  review?: string
  hasFindings?: boolean
  staleOnly?: boolean
}

export function searchEvidence(query: string, facets: SearchFacets = {}, limit = 40): EvidenceRecord[] {
  const q = query.trim().toLowerCase()
  const out: EvidenceRecord[] = []
  for (const r of allEvidence) {
    if (facets.phase && facets.phase !== 'all' && r.phase !== facets.phase) continue
    if (facets.type && facets.type !== 'all' && r.type !== facets.type) continue
    if (facets.status && facets.status !== 'all' && r.status !== facets.status) continue
    if (facets.review && facets.review !== 'all' && r.reviewState !== facets.review) continue
    if (facets.hasFindings && r.findingIds.length === 0) continue
    if (facets.staleOnly && r.reviewState !== 'stale' && r.status !== 'stale' && r.changeMark !== 'stale') continue
    if (q !== '') {
      const idMatch = r.id.toLowerCase().includes(q)
      const titleMatch = r.title.toLowerCase().includes(q)
      if (!idMatch && !titleMatch) continue
      // exact-id and prefix matches float to the top
      if (r.id.toLowerCase() === q) out.unshift(r)
      else if (idMatch) out.splice(Math.min(out.length, 10), 0, r)
      else out.push(r)
    } else {
      out.push(r)
    }
    if (out.length >= limit * 3) break
  }
  return out.slice(0, limit)
}

export interface PhaseStats {
  evidence: number
  reviews: number
  openFindings: number
  readiness: number
}

/** Deterministic per-phase readiness derived from evidence and finding state. */
export function phaseStats(phase: Phase, openFindingIds: Set<string>): PhaseStats {
  const records = phaseRecords(phase)
  const reviews = reviewRecords.filter((r) => r.phase === phase).length
  const phaseFindings = findings.filter((f) => f.phase === phase)
  const open = phaseFindings.filter((f) => openFindingIds.has(f.id)).length

  // CM and QA keep their authoritative records in dedicated registers rather
  // than the evidence graph, so their readiness derives from those registers.
  let evidence = records.length
  let good: number
  let total: number
  if (phase === 'cm') {
    evidence = changeRecords.length + baselines.length + removedIn240.length
    good = changeRecords.filter((c) => c.reverified).length + baselines.length
    total = changeRecords.length + baselines.length
  } else if (phase === 'qa') {
    evidence = auditRecords.length + openActions.length
    good = reviewRecords.filter((r) => r.independent && r.result !== 'pending' && r.result !== 'failed').length
    total = reviewRecords.length
  } else {
    good = records.filter(
      (r) => r.reviewState === 'approved' && r.status !== 'failed' && r.status !== 'stale' && r.status !== 'not-run',
    ).length
    total = records.length || 1
  }
  const readiness = Math.max(0, Math.round((good / total) * 100) - open * 3)
  return { evidence, reviews, openFindings: open, readiness }
}

export const PHASES: Phase[] = PHASE_ORDER

export interface CompareBuckets {
  added: EvidenceRecord[]
  removed: EvidenceRecord[]
  changed: EvidenceRecord[]
  stale: EvidenceRecord[]
  impacted: EvidenceRecord[]
}

/** Baseline 2.3.0 ↔ 2.4.0 comparison, optionally scoped to one phase. */
export function compareBaselines(phase?: Phase): CompareBuckets {
  const scope = (r: EvidenceRecord) => (phase ? r.phase === phase : true)
  return {
    added: allEvidence.filter((r) => scope(r) && (r.changeMark === 'added' || r.baseline === '2.4.0')),
    removed: removedIn240.filter(scope),
    changed: allEvidence.filter((r) => scope(r) && r.changeMark === 'changed'),
    stale: allEvidence.filter((r) => scope(r) && (r.changeMark === 'stale' || r.reviewState === 'stale' || r.status === 'stale')),
    impacted: allEvidence.filter((r) => scope(r) && r.changeMark === 'impacted'),
  }
}

/** Deterministic refresh diagnostics (source counts republished on refresh). */
export const refreshSourceCounts: Array<{ source: string; kind: string; count: number }> = [
  { source: 'requirements/system/aeronav_sys_lateral.slreqx', kind: 'SLREQX', count: 18 },
  { source: 'requirements/software/aeronav_swr_hlr.slreqx', kind: 'SLREQX', count: 36 },
  { source: 'requirements/software/aeronav_swr_llr.slreqx', kind: 'SLREQX', count: 54 },
  { source: 'requirements/software/aeronav_swr_derived.slreqx', kind: 'SLREQX', count: 6 },
  { source: 'models/*.slx + models/harness/*.slx', kind: 'SLX', count: 7 },
  { source: 'models/data/*.sldd', kind: 'SLDD', count: 2 },
  { source: 'src/lateral/*.{c,h}', kind: 'C/H', count: 24 },
  { source: 'verification/tests/**/*.slmx', kind: 'SLMX', count: 64 },
  { source: 'verification/results/*.xlsx', kind: 'XLSX', count: 6 },
  { source: 'qa/reviews/register.xlsx', kind: 'REVIEW', count: 45 },
  { source: 'cm/records/register.xlsx', kind: 'CONFIG', count: 18 },
]

export const sampleCounts = {
  plans: 10,
  systemRequirements: 18,
  hlrs: 36,
  llrs: 54,
  derived: 6,
  models: 7,
  dictionaries: 2,
  modelElements: 140,
  sourceFiles: 24,
  functions: 105,
  tests: 64,
  iterations: 225,
  resultSets: 6,
  reviews: reviewRecords.length,
  changeRecords: changeRecords.length,
  findings: findings.length,
  baselines: baselines.length,
  audits: auditRecords.length,
  openActions: openActions.length,
  packages: 1,
  environment: environmentRecords.length,
  reproChecks: reproChecks.length,
  seedPackageId: seedPackage.id,
} as const
