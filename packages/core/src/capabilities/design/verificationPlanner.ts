/**
 * EUC-12 — Verification planner.
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §14 (all),
 * §25.3 (EUC-12). Builds the scenario-to-test plan, the module acceptance
 * plan, the per-step evidence-expectation plan, scenario-run identity and
 * current-versus-old calculation, and the Verify view summary.
 *
 * Deliberately does not import other `design/*.ts` modules that other agents
 * are concurrently editing; only the shared, read-only contracts
 * (`./records.js`, `./identity.js`) are used.
 *
 * Pure and deterministic: no I/O, no clock reads. Every function's output
 * depends only on its input.
 */

import { stableSortBy, stableSortStrings } from './identity.js'
import type { DesignDiagnostic, ModuleDesignSpecification, ScenarioRun, UseCaseAnalysis, UseCaseScenario } from './records.js'

// ---------------------------------------------------------------------------
// Local diagnostic helpers (kept local so this file has no dependency on
// another agent's concurrently edited module).
// ---------------------------------------------------------------------------

export const EUC12_DIAGNOSTIC_CODES = {
  analysisNotApproved: 'EUC12-ANALYSIS-NOT-APPROVED',
  scenarioNoSteps: 'EUC12-SCENARIO-NO-STEPS',
  moduleNoAcceptanceCases: 'EUC12-MODULE-NO-ACCEPTANCE-CASES',
} as const

function designDiagnostic(
  code: string,
  severity: DesignDiagnostic['severity'],
  message: string,
  extras: Partial<Omit<DesignDiagnostic, 'id' | 'code' | 'severity' | 'message'>> = {},
): DesignDiagnostic {
  const id = extras.target ? `${code}:${extras.target}` : code
  return { id, code, severity, message, ...extras }
}

function sortDesignDiagnostics(diagnostics: DesignDiagnostic[]): DesignDiagnostic[] {
  return [...diagnostics].sort((a, b) => {
    const code = a.code.localeCompare(b.code)
    if (code !== 0) return code
    const target = (a.target ?? '').localeCompare(b.target ?? '')
    if (target !== 0) return target
    return a.message.localeCompare(b.message)
  })
}

// ---------------------------------------------------------------------------
// §14.1 — Scenario generation
// ---------------------------------------------------------------------------

export type ScenarioAutomationAction = { stepId: string; action: string }
export type ScenarioAutomationCheck = { stepId: string; expectedResult: string }

export type ScenarioTestPlanEntry = {
  /** Deterministic id for the one automation target this scenario receives (§14.1). */
  automationTargetId: string
  useCaseId: string
  scenarioId: string
  scenarioKind: UseCaseScenario['kind']
  scenarioName: string
  /** Every action refers to exactly one scenario-step id (§14.1). */
  actions: ScenarioAutomationAction[]
  /** Every check refers to exactly one scenario-step id (§14.1). */
  checks: ScenarioAutomationCheck[]
}

export type ScenarioTestPlan = {
  projectId: string
  analysisId: string
  analysisRevision: string
  entries: ScenarioTestPlanEntry[]
  diagnostics: DesignDiagnostic[]
}

/**
 * §14.1 — one automated end-to-end test per approved main, alternate,
 * failure, or recovery scenario. A scenario without steps cannot receive a
 * test; it produces a diagnostic instead of an entry.
 */
export function buildScenarioTestPlan(analysis: UseCaseAnalysis): ScenarioTestPlan {
  const diagnostics: DesignDiagnostic[] = []
  const entries: ScenarioTestPlanEntry[] = []

  if (analysis.status !== 'approved') {
    diagnostics.push(
      designDiagnostic(
        EUC12_DIAGNOSTIC_CODES.analysisNotApproved,
        'blocker',
        'the use-case analysis must be approved before scenario tests are generated',
        { target: analysis.id },
      ),
    )
    return { projectId: analysis.projectId, analysisId: analysis.id, analysisRevision: analysis.revision, entries, diagnostics: sortDesignDiagnostics(diagnostics) }
  }

  const useCases = stableSortBy(analysis.useCases, (u) => u.id)
  for (const useCase of useCases) {
    const scenarios = stableSortBy(useCase.scenarios, (s) => s.id)
    for (const scenario of scenarios) {
      if (scenario.steps.length === 0) {
        diagnostics.push(
          designDiagnostic(
            EUC12_DIAGNOSTIC_CODES.scenarioNoSteps,
            'blocker',
            `scenario ${scenario.id} has no steps; an automated test cannot be generated`,
            { target: scenario.id, relatedIds: [useCase.id] },
          ),
        )
        continue
      }
      entries.push({
        automationTargetId: `test.e2e.${scenario.id}`,
        useCaseId: useCase.id,
        scenarioId: scenario.id,
        scenarioKind: scenario.kind,
        scenarioName: scenario.name,
        actions: scenario.steps.map((step) => ({ stepId: step.id, action: step.action })),
        checks: scenario.steps.map((step) => ({ stepId: step.id, expectedResult: step.expectedResult })),
      })
    }
  }

  return {
    projectId: analysis.projectId,
    analysisId: analysis.id,
    analysisRevision: analysis.revision,
    entries,
    diagnostics: sortDesignDiagnostics(diagnostics),
  }
}

// ---------------------------------------------------------------------------
// Module acceptance plan
// ---------------------------------------------------------------------------

export type ModuleAcceptancePlanEntry = {
  caseId: string
  description: string
  expectedOutcome: string
  kind: 'example' | 'failure'
  requiredEvidence: string[]
}

export type ModuleAcceptancePlan = {
  moduleId: string
  moduleRevision: string
  entries: ModuleAcceptancePlanEntry[]
  diagnostics: DesignDiagnostic[]
}

/** Acceptance-case test plan for one module design, with required evidence per case. */
export function buildModuleAcceptancePlan(design: ModuleDesignSpecification): ModuleAcceptancePlan {
  const diagnostics: DesignDiagnostic[] = []
  if (design.verification.acceptanceCases.length === 0) {
    diagnostics.push(
      designDiagnostic(
        EUC12_DIAGNOSTIC_CODES.moduleNoAcceptanceCases,
        'warning',
        `module ${design.module.moduleId} has no acceptance cases`,
        { target: design.id },
      ),
    )
  }

  const requiredEvidence = stableSortStrings(design.verification.requiredEvidence)
  const entries = stableSortBy(design.verification.acceptanceCases, (c) => c.id).map((acceptanceCase) => ({
    caseId: acceptanceCase.id,
    description: acceptanceCase.description,
    expectedOutcome: acceptanceCase.expectedOutcome,
    kind: acceptanceCase.kind ?? ('example' as const),
    requiredEvidence,
  }))

  return {
    moduleId: design.module.moduleId,
    moduleRevision: design.revision,
    entries,
    diagnostics: sortDesignDiagnostics(diagnostics),
  }
}

// ---------------------------------------------------------------------------
// §14.2 — Step evidence
// ---------------------------------------------------------------------------

export type StepEvidencePolicy = {
  stepId: string
  evidenceKind: 'screenshot' | 'structured'
  /** Present only when a visible step could not be captured by screenshot (§14.2). */
  screenshotNotApplicableReason?: string
}

export type EvidenceExpectationPlan = {
  scenarioId: string
  policies: StepEvidencePolicy[]
}

/**
 * §14.2 — screenshot evidence when the step result is visible, structured
 * evidence otherwise; a visible step that cannot be captured must record
 * `screenshotNotApplicableReason` and falls back to structured evidence.
 */
export function buildEvidenceExpectationPlan(scenario: UseCaseScenario): EvidenceExpectationPlan {
  const policies: StepEvidencePolicy[] = scenario.steps.map((step) => {
    if (step.visibleResult) {
      if (step.screenshotNotApplicableReason) {
        return { stepId: step.id, evidenceKind: 'structured', screenshotNotApplicableReason: step.screenshotNotApplicableReason }
      }
      return { stepId: step.id, evidenceKind: 'screenshot' }
    }
    return { stepId: step.id, evidenceKind: 'structured' }
  })
  return { scenarioId: scenario.id, policies }
}

// ---------------------------------------------------------------------------
// §14.3 — Scenario run identity
// ---------------------------------------------------------------------------

export type ScenarioRunIdentityInput = {
  useCaseAnalysisRevision: string
  applicationRevision: string
  systemStructureRevision: string
  moduleDesignRevisions: Record<string, string>
  implementationRevisions: Record<string, string>
  connectionRevision: string
  build: string
  sourceRevision: string
  environment: string
  testDataRevision: string
  runner: string
}

function sortedRecord(record: Record<string, string>): Record<string, string> {
  const sorted: Record<string, string> = {}
  for (const key of stableSortStrings(Object.keys(record))) {
    const value = record[key]
    if (value !== undefined) sorted[key] = value
  }
  return sorted
}

/** §14.3 — assembles the full scenario-run identity block. */
export function scenarioRunIdentity(input: ScenarioRunIdentityInput): ScenarioRun['identity'] {
  return {
    useCaseAnalysisRevision: input.useCaseAnalysisRevision,
    applicationRevision: input.applicationRevision,
    systemStructureRevision: input.systemStructureRevision,
    moduleDesignRevisions: sortedRecord(input.moduleDesignRevisions),
    implementationRevisions: sortedRecord(input.implementationRevisions),
    connectionRevision: input.connectionRevision,
    build: input.build,
    sourceRevision: input.sourceRevision,
    environment: input.environment,
    testDataRevision: input.testDataRevision,
    runner: input.runner,
  }
}

// ---------------------------------------------------------------------------
// Current-versus-old (EUC-12 acceptance: "a stale module or connection
// revision makes the affected scenario result old")
// ---------------------------------------------------------------------------

export type CurrentRevisions = {
  useCaseAnalysisRevision?: string
  applicationRevision?: string
  systemStructureRevision?: string
  moduleDesignRevisions?: Record<string, string>
  implementationRevisions?: Record<string, string>
  connectionRevision?: string
}

/**
 * `old` when any revision recorded by the run's identity no longer matches
 * the corresponding current revision; `current` otherwise. Only revisions
 * the run's identity actually references are checked, so a stale module
 * unrelated to a given run's identity never affects that run's state.
 */
export function currentResultState(run: ScenarioRun, currentRevisions: CurrentRevisions): 'current' | 'old' {
  const { identity } = run

  if (currentRevisions.useCaseAnalysisRevision !== undefined && currentRevisions.useCaseAnalysisRevision !== identity.useCaseAnalysisRevision) {
    return 'old'
  }
  if (currentRevisions.applicationRevision !== undefined && currentRevisions.applicationRevision !== identity.applicationRevision) {
    return 'old'
  }
  if (currentRevisions.systemStructureRevision !== undefined && currentRevisions.systemStructureRevision !== identity.systemStructureRevision) {
    return 'old'
  }
  if (currentRevisions.connectionRevision !== undefined && currentRevisions.connectionRevision !== identity.connectionRevision) {
    return 'old'
  }
  if (currentRevisions.moduleDesignRevisions) {
    for (const moduleId of Object.keys(identity.moduleDesignRevisions)) {
      const current = currentRevisions.moduleDesignRevisions[moduleId]
      if (current !== undefined && current !== identity.moduleDesignRevisions[moduleId]) return 'old'
    }
  }
  if (currentRevisions.implementationRevisions) {
    for (const moduleId of Object.keys(identity.implementationRevisions)) {
      const current = currentRevisions.implementationRevisions[moduleId]
      if (current !== undefined && current !== identity.implementationRevisions[moduleId]) return 'old'
    }
  }
  return 'current'
}

// ---------------------------------------------------------------------------
// §14.4 — Verify view
// ---------------------------------------------------------------------------

export type VerifySummaryInput = {
  scenarioTestPlan: ScenarioTestPlan
  currentRevisions: CurrentRevisions
  /** Links to approved Design records (§14.4); never diagram payloads. */
  designLinks: string[]
}

export type VerifyFirstFailedStep = { runId: string; scenarioId: string; stepId: string; action: string }

/**
 * §14.4 Verify view counts. Deliberately has no field capable of carrying a
 * diagram payload ("Verify shall not contain design diagrams").
 */
export type VerifySummary = {
  useCaseCount: number
  scenarioCount: number
  passedCount: number
  failedCount: number
  skippedCount: number
  cancelledCount: number
  stepCount: number
  screenshotCount: number
  structuredEvidenceCount: number
  firstFailedStep?: VerifyFirstFailedStep
  currentCount: number
  oldCount: number
  designLinks: string[]
}

/** §14.4 — Verify view counts, current-versus-old, and links to Design records. */
export function buildVerifySummary(runs: ScenarioRun[], plans: VerifySummaryInput): VerifySummary {
  const orderedRuns = stableSortBy(runs, (r) => r.runId)

  const useCaseCount = new Set(plans.scenarioTestPlan.entries.map((e) => e.useCaseId)).size
  const scenarioCount = new Set(plans.scenarioTestPlan.entries.map((e) => e.scenarioId)).size

  let passedCount = 0
  let failedCount = 0
  let skippedCount = 0
  let cancelledCount = 0
  let stepCount = 0
  let screenshotCount = 0
  let structuredEvidenceCount = 0
  let currentCount = 0
  let oldCount = 0
  let firstFailedStep: VerifyFirstFailedStep | undefined

  for (const run of orderedRuns) {
    switch (run.outcome) {
      case 'passed':
        passedCount += 1
        break
      case 'failed':
        failedCount += 1
        break
      case 'skipped':
        skippedCount += 1
        break
      case 'cancelled':
        cancelledCount += 1
        break
    }

    stepCount += run.steps.length
    for (const step of run.steps) {
      if (step.screenshotRef) screenshotCount += 1
      if (step.structuredEvidenceRef) structuredEvidenceCount += 1
      if (!firstFailedStep && step.outcome === 'failed') {
        firstFailedStep = { runId: run.runId, scenarioId: run.scenarioId, stepId: step.stepId, action: step.action }
      }
    }

    if (currentResultState(run, plans.currentRevisions) === 'current') currentCount += 1
    else oldCount += 1
  }

  return {
    useCaseCount,
    scenarioCount,
    passedCount,
    failedCount,
    skippedCount,
    cancelledCount,
    stepCount,
    screenshotCount,
    structuredEvidenceCount,
    firstFailedStep,
    currentCount,
    oldCount,
    designLinks: stableSortStrings(plans.designLinks),
  }
}
