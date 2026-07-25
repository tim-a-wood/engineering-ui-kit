/**
 * EUC-12 — Verification planner.
 * Acceptance from docs/use-case-led-workflow/SPECIFICATION.md §25.3 EUC-12:
 * every approved scenario has one automation target; every step has an
 * evidence policy; a stale module or connection revision makes the affected
 * scenario result old; Verify contains no design diagram.
 */
import { describe, expect, it } from 'vitest'
import {
  buildEvidenceExpectationPlan,
  buildModuleAcceptancePlan,
  buildScenarioTestPlan,
  buildVerifySummary,
  currentResultState,
  scenarioRunIdentity,
  type CurrentRevisions,
} from '../../../src/capabilities/design/verificationPlanner.js'
import type { ModuleDesignSpecification, ScenarioRun, UseCaseAnalysis, UseCaseScenario } from '../../../src/capabilities/design/records.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function useCaseAnalysisFixture(overrides: Partial<UseCaseAnalysis> = {}): UseCaseAnalysis {
  return {
    schemaVersion: '1.0',
    projectId: 'proj-1',
    id: 'analysis-1',
    revision: 'r3',
    status: 'approved',
    workDescription: 'do the thing',
    examples: [],
    prohibitedResults: [],
    actors: [],
    useCases: [
      {
        id: 'uc.main',
        name: 'Main use case',
        actors: ['user'],
        trigger: 'user starts',
        preconditions: [],
        mainFlow: [],
        alternatePaths: [],
        failurePaths: [],
        recoveryBehavior: '',
        rules: [],
        inputs: [],
        outputs: [],
        acceptanceChecks: [],
        sourceLinks: [],
        scenarios: [
          {
            id: 'uc.main.scenario.main',
            name: 'Main scenario',
            kind: 'main',
            steps: [
              { id: 'step.1', action: 'submit request', expectedResult: 'request accepted', visibleResult: true },
              { id: 'step.2', action: 'store record', expectedResult: 'record stored', visibleResult: false },
            ],
          },
          {
            id: 'uc.main.scenario.failure',
            name: 'Invalid input',
            kind: 'failure',
            steps: [{ id: 'step.f1', action: 'submit invalid request', expectedResult: 'error shown', visibleResult: true }],
          },
          {
            id: 'uc.main.scenario.empty',
            name: 'Scenario with no steps yet',
            kind: 'alternate',
            steps: [],
          },
        ],
      },
    ],
    rules: [],
    qualityNeeds: [],
    sources: [],
    questions: [],
    gates: [],
    contentHash: 'analysis-hash',
    ...overrides,
  }
}

function moduleDesignFixture(overrides: Partial<ModuleDesignSpecification> = {}): ModuleDesignSpecification {
  return {
    schemaVersion: '1.0',
    projectId: 'proj-1',
    id: 'design.mod.domain',
    revision: 'r2',
    status: 'approved',
    architecture: { id: 'arch-1', revision: 'r1', contentHash: 'arch-hash' },
    module: {
      moduleId: 'mod.domain',
      moduleVersion: '1.0.0',
      name: 'Domain module',
      moduleType: 'domain',
      responsibility: 'owns domain rules',
      nonResponsibilities: [],
      ownedConcerns: ['owns-thing'],
      excludedConcerns: [],
    },
    trace: { useCaseIds: ['uc.main'], scenarioStepIds: ['step.1'], ruleIds: [], qualityRequirementIds: [], sourceRefs: [], designDecisionIds: [] },
    boundary: {
      directDependencyIds: [],
      directConsumerIds: [],
      deployableId: 'deployable.main',
      runtimeAllocation: 'local-embedded',
      runtimeLanguage: 'typescript',
      ownedPaths: [],
      editableSharedPaths: [],
    },
    providedOperations: [],
    requiredOperations: [],
    schemas: [],
    rules: [],
    invariants: [],
    behavior: {
      preconditions: [],
      postconditions: [],
      domainRejections: [],
      technicalFailures: [],
      sideEffects: [],
      idempotency: 'idempotent',
      cancellation: 'not cancellable',
      timeouts: 'medium',
      concurrency: 'single-threaded',
      retry: 'none',
      recovery: 'none',
      emittedEvents: [],
      consumedEvents: [],
    },
    data: {
      inputSchemas: [],
      outputSchemas: [],
      persistentRecords: [],
      dataOwnership: 'owned',
      retention: 'n/a',
      migrationNeeds: 'none',
      confidentiality: 'internal',
      provenanceFields: [],
      canonicalUnits: [],
      canonicalEnumerations: [],
    },
    runtime: {
      configurationRefs: [],
      secretReferenceIds: [],
      lifecycleRegistration: 'n/a',
      healthBehavior: 'n/a',
      telemetry: 'n/a',
      resourceOwnership: 'n/a',
      startupBehavior: 'n/a',
      shutdownBehavior: 'n/a',
      compatibilityConstraints: [],
    },
    verification: {
      examples: ['a worked example'],
      edgeCases: [],
      acceptanceCases: [
        { id: 'ac.2', description: 'rejects invalid input', expectedOutcome: 'input is rejected', kind: 'failure' },
        { id: 'ac.1', description: 'accepts valid input', expectedOutcome: 'result is produced', kind: 'example' },
      ],
      verificationSuiteIds: [],
      requiredEvidence: ['unit-test-report', 'coverage-report'],
      testDoubles: [],
      fixtureNeeds: [],
      configuredCommands: [],
      unresolvedItems: [],
    },
    typeSpecific: {
      moduleType: 'domain',
      detail: {
        domainVocabulary: [],
        valueObjects: [],
        consistencyBoundary: 'n/a',
        invariants: [],
        calculations: [],
        decisionTables: [],
        deterministicOrdering: 'n/a',
        canonicalIdentityRules: 'n/a',
        revisionComparison: 'n/a',
        invalidStatePrevention: 'n/a',
        operationPurity: [],
      },
    },
    diagrams: [],
    unresolvedItems: [],
    gates: [],
    contentHash: 'ignored',
    ...overrides,
  }
}

function scenarioRunFixture(overrides: Partial<ScenarioRun> = {}): ScenarioRun {
  return {
    schemaVersion: '1.0',
    runId: 'run.1',
    projectId: 'proj-1',
    scenarioId: 'uc.main.scenario.main',
    useCaseId: 'uc.main',
    identity: {
      useCaseAnalysisRevision: 'r3',
      applicationRevision: 'r1',
      systemStructureRevision: 'r1',
      moduleDesignRevisions: { 'mod.domain': 'r2', 'mod.workflow': 'r1' },
      implementationRevisions: { 'mod.domain': 'impl-r1' },
      connectionRevision: 'r1',
      build: 'build-1',
      sourceRevision: 'src-1',
      environment: 'ci',
      testDataRevision: 'td-1',
      runner: 'playwright',
    },
    steps: [
      {
        stepId: 'step.1',
        action: 'submit request',
        expectedResult: 'request accepted',
        actualResult: 'request accepted',
        startedAt: '2026-07-25T00:00:00.000Z',
        endedAt: '2026-07-25T00:00:01.000Z',
        outcome: 'passed',
        screenshotRef: 'shot-1.png',
      },
      {
        stepId: 'step.2',
        action: 'store record',
        expectedResult: 'record stored',
        actualResult: 'record stored',
        startedAt: '2026-07-25T00:00:01.000Z',
        endedAt: '2026-07-25T00:00:02.000Z',
        outcome: 'passed',
        structuredEvidenceRef: 'evidence-1.json',
      },
    ],
    outcome: 'passed',
    startedAt: '2026-07-25T00:00:00.000Z',
    completedAt: '2026-07-25T00:00:02.000Z',
    evidenceHashes: ['hash-1'],
    contentHash: 'run-hash',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// §14.1 scenario test plan
// ---------------------------------------------------------------------------

describe('buildScenarioTestPlan (§14.1)', () => {
  it('gives every approved main, alternate, and failure scenario exactly one automation target', () => {
    const plan = buildScenarioTestPlan(useCaseAnalysisFixture())
    const scenarioIds = plan.entries.map((e) => e.scenarioId)
    expect(scenarioIds).toContain('uc.main.scenario.main')
    expect(scenarioIds).toContain('uc.main.scenario.failure')
    expect(new Set(scenarioIds).size).toBe(scenarioIds.length)
  })

  it('every action and check refers to exactly one scenario-step id', () => {
    const plan = buildScenarioTestPlan(useCaseAnalysisFixture())
    const main = plan.entries.find((e) => e.scenarioId === 'uc.main.scenario.main')
    expect(main?.actions).toEqual([
      { stepId: 'step.1', action: 'submit request' },
      { stepId: 'step.2', action: 'store record' },
    ])
    expect(main?.checks).toEqual([
      { stepId: 'step.1', expectedResult: 'request accepted' },
      { stepId: 'step.2', expectedResult: 'record stored' },
    ])
  })

  it('produces a diagnostic instead of an entry for a scenario with no steps', () => {
    const plan = buildScenarioTestPlan(useCaseAnalysisFixture())
    expect(plan.entries.some((e) => e.scenarioId === 'uc.main.scenario.empty')).toBe(false)
    expect(plan.diagnostics.some((d) => d.code === 'EUC12-SCENARIO-NO-STEPS' && d.target === 'uc.main.scenario.empty')).toBe(true)
  })

  it('produces no automation targets for an analysis that is not approved', () => {
    const plan = buildScenarioTestPlan(useCaseAnalysisFixture({ status: 'readyForReview' }))
    expect(plan.entries).toEqual([])
    expect(plan.diagnostics.some((d) => d.code === 'EUC12-ANALYSIS-NOT-APPROVED')).toBe(true)
  })

  it('is deterministic: the same analysis produces a deep-equal plan on every call', () => {
    const analysis = useCaseAnalysisFixture()
    expect(buildScenarioTestPlan(analysis)).toEqual(buildScenarioTestPlan(analysis))
  })
})

// ---------------------------------------------------------------------------
// Module acceptance plan
// ---------------------------------------------------------------------------

describe('buildModuleAcceptancePlan', () => {
  it('builds one plan entry per acceptance case with required evidence attached', () => {
    const plan = buildModuleAcceptancePlan(moduleDesignFixture())
    expect(plan.entries).toHaveLength(2)
    // stable, sorted by case id
    expect(plan.entries.map((e) => e.caseId)).toEqual(['ac.1', 'ac.2'])
    for (const entry of plan.entries) {
      expect(entry.requiredEvidence).toEqual(['coverage-report', 'unit-test-report'])
    }
    expect(plan.entries[0]).toMatchObject({ kind: 'example' })
    expect(plan.entries[1]).toMatchObject({ kind: 'failure' })
  })

  it('produces a diagnostic when a module has no acceptance cases', () => {
    const plan = buildModuleAcceptancePlan(moduleDesignFixture({ verification: { ...moduleDesignFixture().verification, acceptanceCases: [] } }))
    expect(plan.entries).toEqual([])
    expect(plan.diagnostics.some((d) => d.code === 'EUC12-MODULE-NO-ACCEPTANCE-CASES')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// §14.2 step evidence
// ---------------------------------------------------------------------------

describe('buildEvidenceExpectationPlan (§14.2)', () => {
  const scenario: UseCaseScenario = {
    id: 'scenario.1',
    name: 'Scenario 1',
    kind: 'main',
    steps: [
      { id: 's1', action: 'a', expectedResult: 'visible result', visibleResult: true },
      { id: 's2', action: 'a', expectedResult: 'nonvisual result', visibleResult: false },
      {
        id: 's3',
        action: 'a',
        expectedResult: 'visible but uncapturable result',
        visibleResult: true,
        screenshotNotApplicableReason: 'result renders in a native OS dialog outside the capture surface',
      },
    ],
  }

  it('gives every step exactly one evidence policy', () => {
    const plan = buildEvidenceExpectationPlan(scenario)
    expect(plan.policies).toHaveLength(scenario.steps.length)
    expect(plan.policies.map((p) => p.stepId)).toEqual(['s1', 's2', 's3'])
  })

  it('assigns screenshot evidence to a visible step', () => {
    const plan = buildEvidenceExpectationPlan(scenario)
    expect(plan.policies.find((p) => p.stepId === 's1')).toEqual({ stepId: 's1', evidenceKind: 'screenshot' })
  })

  it('assigns structured evidence to a nonvisual step', () => {
    const plan = buildEvidenceExpectationPlan(scenario)
    expect(plan.policies.find((p) => p.stepId === 's2')).toEqual({ stepId: 's2', evidenceKind: 'structured' })
  })

  it('requires and preserves screenshotNotApplicableReason for a visible step that cannot be captured', () => {
    const plan = buildEvidenceExpectationPlan(scenario)
    const policy = plan.policies.find((p) => p.stepId === 's3')
    expect(policy?.evidenceKind).toBe('structured')
    expect(policy?.screenshotNotApplicableReason).toBe('result renders in a native OS dialog outside the capture surface')
  })
})

// ---------------------------------------------------------------------------
// §14.3 scenario run identity
// ---------------------------------------------------------------------------

describe('scenarioRunIdentity (§14.3)', () => {
  it('assembles every required identity field', () => {
    const identity = scenarioRunIdentity({
      useCaseAnalysisRevision: 'r3',
      applicationRevision: 'r1',
      systemStructureRevision: 'r1',
      moduleDesignRevisions: { 'mod.b': 'r1', 'mod.a': 'r2' },
      implementationRevisions: { 'mod.a': 'impl-r1' },
      connectionRevision: 'r1',
      build: 'build-1',
      sourceRevision: 'src-1',
      environment: 'ci',
      testDataRevision: 'td-1',
      runner: 'playwright',
    })
    expect(identity).toEqual({
      useCaseAnalysisRevision: 'r3',
      applicationRevision: 'r1',
      systemStructureRevision: 'r1',
      moduleDesignRevisions: { 'mod.a': 'r2', 'mod.b': 'r1' },
      implementationRevisions: { 'mod.a': 'impl-r1' },
      connectionRevision: 'r1',
      build: 'build-1',
      sourceRevision: 'src-1',
      environment: 'ci',
      testDataRevision: 'td-1',
      runner: 'playwright',
    })
  })
})

// ---------------------------------------------------------------------------
// Current-versus-old
// ---------------------------------------------------------------------------

describe('currentResultState', () => {
  it('is current when every checked revision matches', () => {
    const run = scenarioRunFixture()
    const current: CurrentRevisions = { moduleDesignRevisions: { 'mod.domain': 'r2', 'mod.workflow': 'r1' } }
    expect(currentResultState(run, current)).toBe('current')
  })

  it('is old when the module design a scenario used has a newer revision', () => {
    const run = scenarioRunFixture()
    const current: CurrentRevisions = { moduleDesignRevisions: { 'mod.domain': 'r3' } }
    expect(currentResultState(run, current)).toBe('old')
  })

  it('is old when the connection revision has moved on', () => {
    const run = scenarioRunFixture()
    const current: CurrentRevisions = { connectionRevision: 'r2' }
    expect(currentResultState(run, current)).toBe('old')
  })

  it('only affects the scenario whose run references the stale module — an unrelated run stays current', () => {
    const affectedRun = scenarioRunFixture({ runId: 'run.affected' })
    const unrelatedRun = scenarioRunFixture({
      runId: 'run.unrelated',
      scenarioId: 'uc.other.scenario.main',
      identity: { ...scenarioRunFixture().identity, moduleDesignRevisions: { 'mod.other': 'r1' } },
    })
    const current: CurrentRevisions = { moduleDesignRevisions: { 'mod.domain': 'r3' } }
    expect(currentResultState(affectedRun, current)).toBe('old')
    expect(currentResultState(unrelatedRun, current)).toBe('current')
  })
})

// ---------------------------------------------------------------------------
// §14.4 Verify summary
// ---------------------------------------------------------------------------

describe('buildVerifySummary (§14.4)', () => {
  it('counts use cases, scenarios, outcomes, steps, and evidence kinds', () => {
    const plan = buildScenarioTestPlan(useCaseAnalysisFixture())
    const runs = [scenarioRunFixture(), scenarioRunFixture({ runId: 'run.2', outcome: 'failed', steps: [
      {
        stepId: 'step.f1',
        action: 'submit invalid request',
        expectedResult: 'error shown',
        actualResult: 'no error shown',
        startedAt: '2026-07-25T00:00:00.000Z',
        endedAt: '2026-07-25T00:00:01.000Z',
        outcome: 'failed',
        screenshotRef: 'shot-2.png',
      },
    ] })]
    const summary = buildVerifySummary(runs, {
      scenarioTestPlan: plan,
      currentRevisions: { moduleDesignRevisions: { 'mod.domain': 'r2' } },
      designLinks: ['design.mod.domain', 'baseline.1'],
    })

    expect(summary.useCaseCount).toBe(1)
    expect(summary.scenarioCount).toBe(plan.entries.length)
    expect(summary.passedCount).toBe(1)
    expect(summary.failedCount).toBe(1)
    expect(summary.stepCount).toBe(3)
    expect(summary.screenshotCount).toBe(2)
    expect(summary.structuredEvidenceCount).toBe(1)
    expect(summary.firstFailedStep).toEqual({ runId: 'run.2', scenarioId: 'uc.main.scenario.main', stepId: 'step.f1', action: 'submit invalid request' })
    expect(summary.currentCount).toBe(2)
    expect(summary.oldCount).toBe(0)
  })

  it('contains links to Design records and no diagram payload anywhere in the summary', () => {
    const plan = buildScenarioTestPlan(useCaseAnalysisFixture())
    const summary = buildVerifySummary([scenarioRunFixture()], {
      scenarioTestPlan: plan,
      currentRevisions: {},
      designLinks: ['design.mod.domain', 'baseline.1'],
    })

    expect(summary.designLinks).toEqual(['baseline.1', 'design.mod.domain'])
    expect(Object.keys(summary)).not.toContain('diagrams')
    expect(Object.keys(summary)).not.toContain('diagram')
    const serialized = JSON.stringify(summary).toLowerCase()
    expect(serialized).not.toContain('diagram')
  })

  it('is deterministic: the same runs and plan produce a deep-equal summary on every call', () => {
    const plan = buildScenarioTestPlan(useCaseAnalysisFixture())
    const runs = [scenarioRunFixture()]
    const input = { scenarioTestPlan: plan, currentRevisions: { moduleDesignRevisions: { 'mod.domain': 'r2' } }, designLinks: ['design.mod.domain'] }
    expect(buildVerifySummary(runs, input)).toEqual(buildVerifySummary(runs, input))
  })
})
