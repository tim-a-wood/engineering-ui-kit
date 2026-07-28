/**
 * EUC-07 — Impact engine.
 * Acceptance from docs/use-case-led-workflow/SPECIFICATION.md §25.3 EUC-07:
 * label-only changes do not mark implementations old; contract changes
 * identify providers, consumers, tests, and bindings; split and merge
 * changes identify ownership and migration work.
 */
import { describe, expect, it } from 'vitest'
import {
  analyzeDesignChange,
  applyImpactToRecords,
  type AnalyzeDesignChangeInput,
  type ImpactWorld,
} from '../../../src/capabilities/design/impactEngine.js'
import type { ModuleDesignSpecification, UseCaseAnalysis } from '../../../src/capabilities/design/records.js'
import type { ArchitectureSpecification } from '../../../src/capabilities/types.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function architectureFixture(overrides: Partial<ArchitectureSpecification> = {}): ArchitectureSpecification {
  return {
    schemaVersion: '1.0',
    projectId: 'proj-1',
    id: 'arch-1',
    revision: 'r1',
    status: 'approved',
    applicationSpecId: 'app-1',
    applicationSpecRevision: 'r1',
    applicationSpecHash: 'app-hash',
    capabilityProjections: [],
    moduleIds: ['mod.platform', 'mod.domain', 'mod.workflow', 'mod.experience', 'mod.unrelated'],
    moduleDefinitions: [
      { moduleId: 'mod.platform', name: 'Platform module', moduleType: 'platform', responsibility: 'Own storage' },
      { moduleId: 'mod.domain', name: 'Domain module', moduleType: 'domain', responsibility: 'Own domain rules' },
      { moduleId: 'mod.workflow', name: 'Workflow module', moduleType: 'workflow', responsibility: 'Orchestrate the main flow' },
      { moduleId: 'mod.experience', name: 'Experience module', moduleType: 'experience', responsibility: 'Render the main screen' },
      { moduleId: 'mod.unrelated', name: 'Unrelated module', moduleType: 'domain', responsibility: 'Owns an unrelated concern' },
    ],
    // mod.workflow -> mod.domain -> mod.platform ; mod.experience -> mod.workflow
    dependencyEdges: [
      { fromModuleId: 'mod.workflow', toModuleId: 'mod.domain', reason: 'uses domain rules' },
      { fromModuleId: 'mod.domain', toModuleId: 'mod.platform', reason: 'reads and writes storage' },
      { fromModuleId: 'mod.experience', toModuleId: 'mod.workflow', reason: 'invokes the workflow' },
    ],
    operationAllocations: [
      { operationId: 'op.calculate', moduleId: 'mod.domain' },
      { operationId: 'op.run', moduleId: 'mod.workflow' },
    ],
    adapterAllocations: [],
    workflowTraces: [{ useCaseId: 'uc.main', moduleIds: ['mod.platform', 'mod.domain', 'mod.workflow', 'mod.experience'] }],
    proposals: [],
    unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
    contentHash: 'arch-hash',
    ...overrides,
  }
}

function baseModuleDesign(moduleId: string, overrides: Partial<ModuleDesignSpecification> = {}): ModuleDesignSpecification {
  return {
    schemaVersion: '1.0',
    projectId: 'proj-1',
    id: `design.${moduleId}`,
    revision: 'r1',
    status: 'approved',
    architecture: { id: 'arch-1', revision: 'r1', contentHash: 'arch-hash' },
    module: {
      moduleId,
      moduleVersion: '1.0.0',
      name: moduleId,
      moduleType: 'domain',
      responsibility: `${moduleId} responsibility`,
      nonResponsibilities: [],
      ownedConcerns: ['owns-thing'],
      excludedConcerns: [],
    },
    trace: { useCaseIds: [], scenarioStepIds: [], ruleIds: [], qualityRequirementIds: [], sourceRefs: [], designDecisionIds: [] },
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
      examples: [],
      edgeCases: [],
      acceptanceCases: [],
      verificationSuiteIds: [],
      requiredEvidence: [],
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

function useCaseAnalysisFixture(overrides: Partial<UseCaseAnalysis> = {}): UseCaseAnalysis {
  return {
    schemaVersion: '1.0',
    projectId: 'proj-1',
    id: 'analysis-1',
    revision: 'r1',
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
        mainFlow: [
          { id: 'uc.main.step1', action: 'submit request', expectedResult: 'request accepted', visibleResult: true },
        ],
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
              { id: 'uc.main.step1', action: 'submit request', expectedResult: 'request accepted', visibleResult: true },
            ],
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

function worldFixture(overrides: Partial<ImpactWorld> = {}): ImpactWorld {
  const architecture = architectureFixture()
  const platform = baseModuleDesign('mod.platform', {
    module: { ...baseModuleDesign('mod.platform').module, moduleType: 'platform' },
    boundary: { ...baseModuleDesign('mod.platform').boundary, directConsumerIds: ['mod.domain'] },
    providedOperations: [{ operationId: 'op.store', version: '1.0.0' }],
    schemas: [{ schemaId: 'schema.record', version: '1.0.0', role: 'output', ref: 'schemas/record.json' }],
    typeSpecific: {
      moduleType: 'platform',
      detail: {
        storedOrScheduledResource: 'records',
        ownershipAndAccess: 'owned',
        consistency: 'strong',
        transactionBehavior: 'n/a',
        indexing: 'n/a',
        retention: 'n/a',
        backupAndRecovery: 'n/a',
        capacity: 'n/a',
        cleanup: 'n/a',
        healthChecks: 'n/a',
        failureInjection: 'n/a',
        testImplementation: 'n/a',
      },
    },
  })
  const domain = baseModuleDesign('mod.domain', {
    boundary: { ...baseModuleDesign('mod.domain').boundary, directDependencyIds: ['mod.platform'], directConsumerIds: ['mod.workflow'] },
    providedOperations: [{ operationId: 'op.calculate', version: '1.0.0' }],
    requiredOperations: [{ operationId: 'op.store', acceptedVersionRange: '^1.0.0', reason: 'persist results' }],
    schemas: [
      { schemaId: 'schema.record', version: '1.0.0', role: 'input', ref: 'schemas/record.json' },
      { schemaId: 'schema.calc-result', version: '1.0.0', role: 'output', ref: 'schemas/calc-result.json' },
    ],
    trace: { ...baseModuleDesign('mod.domain').trace, scenarioStepIds: ['uc.main.step1'] },
  })
  const workflow = baseModuleDesign('mod.workflow', {
    module: { ...baseModuleDesign('mod.workflow').module, moduleType: 'workflow' },
    boundary: { ...baseModuleDesign('mod.workflow').boundary, directDependencyIds: ['mod.domain'], directConsumerIds: ['mod.experience'] },
    requiredOperations: [{ operationId: 'op.calculate', acceptedVersionRange: '^1.0.0', reason: 'runs the calculation' }],
    schemas: [{ schemaId: 'schema.calc-result', version: '1.0.0', role: 'input', ref: 'schemas/calc-result.json' }],
    trace: { ...baseModuleDesign('mod.workflow').trace, scenarioStepIds: ['uc.main.step1'] },
    typeSpecific: {
      moduleType: 'workflow',
      detail: {
        trigger: 'user submits',
        orderedSteps: [],
        participants: [],
        decisionsAndGuards: [],
        transactionBoundary: 'n/a',
        partialCompletion: 'n/a',
        compensation: 'n/a',
        retryPolicy: 'n/a',
        deduplication: 'n/a',
        idempotencyKeyUse: 'n/a',
        cancellationPoints: [],
        deadlinePropagation: 'n/a',
        resourceLocks: [],
        progressReporting: 'n/a',
        finalOutcomes: [],
      },
    },
  })
  const experience = baseModuleDesign('mod.experience', {
    module: { ...baseModuleDesign('mod.experience').module, moduleType: 'experience' },
    boundary: { ...baseModuleDesign('mod.experience').boundary, directDependencyIds: ['mod.workflow'] },
    typeSpecific: {
      moduleType: 'experience',
      detail: {
        userRolesAndTasks: [],
        surfaces: [],
        informationHierarchy: 'n/a',
        commandsAndNavigation: [],
        viewStates: [],
        loadingBehavior: 'n/a',
        emptyStates: 'n/a',
        validationMessages: 'n/a',
        permissionStates: 'n/a',
        partialDataStates: 'n/a',
        recoverableFailures: 'n/a',
        unrecoverableFailures: 'n/a',
        responsiveBehavior: 'n/a',
        touchTargets: 'n/a',
        keyboardBehavior: 'n/a',
        focusOrderAndReturn: 'n/a',
        screenReaderNamesAndStatus: 'n/a',
        reducedMotionBehavior: 'n/a',
        themeAndContrast: 'n/a',
        approvedComponentSources: [],
        inboundBindingIds: ['binding.main'],
        scenarioScreenshotIds: [],
      },
    },
  })
  const unrelated = baseModuleDesign('mod.unrelated')

  return {
    architecture,
    moduleDesigns: [platform, domain, workflow, experience, unrelated],
    useCaseAnalysis: useCaseAnalysisFixture(),
    diagrams: [{ diagramId: 'diagram.arch', kind: 'component', sourceRecordId: architecture.id, sourceRevision: architecture.revision }],
    moduleTestIds: { 'mod.domain': ['test.module.domain'], 'mod.workflow': ['test.module.workflow'] },
    endToEndTestIds: { 'uc.main.scenario.main': ['test.e2e.uc.main.scenario.main'] },
    ...overrides,
  }
}

const baseInput: Omit<AnalyzeDesignChangeInput, 'changeKind' | 'target' | 'description'> = {
  projectId: 'proj-1',
  initiatingRecordId: 'mod.domain',
  initiatingRevision: 'r2',
  world: worldFixture(),
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EUC-07 impact engine', () => {
  it('a label-only change never marks implementations old (only diagram and text projections)', () => {
    const impact = analyzeDesignChange({
      ...baseInput,
      changeKind: 'labelOnly',
      initiatingRecordId: 'arch-1',
      description: 'renamed the architecture title',
    })

    expect(impact.items.length).toBeGreaterThan(0)
    for (const item of impact.items) {
      expect(item.invalidation).toBe('projectionOnly')
      expect(['diagram', 'documentation']).toContain(item.category)
    }
    expect(impact.items.some((i) => i.category === 'module')).toBe(false)
    expect(impact.items.some((i) => i.category === 'moduleTest')).toBe(false)
    expect(impact.orderedChangePlan.some((c) => c.targetId === 'mod.domain')).toBe(false)
  })

  it('an operation-behavior (contract) change identifies the provider, direct and transitive consumers, tests, and bindings', () => {
    const impact = analyzeDesignChange({
      ...baseInput,
      changeKind: 'operationBehavior',
      target: { operationId: 'op.calculate' },
      description: 'op.calculate now requires an additional precondition',
    })

    const moduleTargets = impact.items.filter((i) => i.category === 'module').map((i) => i.targetId)
    expect(moduleTargets).toContain('mod.domain') // provider
    expect(moduleTargets).toContain('mod.workflow') // direct consumer
    expect(moduleTargets).toContain('mod.experience') // transitive consumer
    expect(moduleTargets).not.toContain('mod.unrelated')
    expect(moduleTargets).not.toContain('mod.platform')

    const testTargets = impact.items.filter((i) => i.category === 'moduleTest').map((i) => i.targetId)
    expect(testTargets).toContain('test.module.domain')
    expect(testTargets).toContain('test.module.workflow')

    const bindingTargets = impact.items.filter((i) => i.category === 'generatedCode').map((i) => i.targetId)
    expect(bindingTargets).toContain('binding.main')

    expect(impact.items.some((i) => i.category === 'operationContract' && i.targetId === 'op.calculate')).toBe(true)
    for (const item of impact.items) expect(item.invalidation).not.toBe('none')
  })

  it('a schema change identifies the provider, consumers, bindings, and affected scenarios', () => {
    const impact = analyzeDesignChange({
      ...baseInput,
      changeKind: 'schema',
      target: { schemaId: 'schema.calc-result' },
      description: 'calc-result schema gained a required field',
    })

    const moduleTargets = impact.items.filter((i) => i.category === 'module').map((i) => i.targetId)
    expect(moduleTargets).toContain('mod.domain') // provider
    expect(moduleTargets).toContain('mod.workflow') // direct consumer
    expect(moduleTargets).not.toContain('mod.unrelated')

    expect(impact.items.some((i) => i.category === 'scenarioStep' && i.targetId === 'uc.main.step1')).toBe(true)
    expect(impact.items.some((i) => i.category === 'endToEndTest')).toBe(true)
  })

  it('a module split or merge change identifies ownership and migration work', () => {
    const impact = analyzeDesignChange({
      ...baseInput,
      changeKind: 'moduleSplitOrMerge',
      target: { splitOrMergeModuleIds: ['mod.domain'] },
      description: 'split mod.domain into mod.domain and mod.domain.rules',
    })

    expect(impact.items.some((i) => i.category === 'module' && i.targetId === 'mod.domain' && i.invalidation === 'stale')).toBe(true)
    expect(impact.items.some((i) => i.category === 'migration' && i.targetId === 'mod.domain')).toBe(true)
    expect(impact.items.some((i) => i.category === 'operationContract' && i.targetId === 'op.calculate')).toBe(true)
    expect(impact.items.some((i) => i.category === 'diagram')).toBe(true)
    // mod.workflow depends on mod.domain, so it needs review as an interface consumer.
    expect(impact.items.some((i) => i.category === 'module' && i.targetId === 'mod.workflow' && i.invalidation === 'review')).toBe(true)
  })

  it('a dependency change affects only the source and target modules, never an unrelated module', () => {
    const impact = analyzeDesignChange({
      ...baseInput,
      changeKind: 'dependency',
      target: { sourceModuleId: 'mod.workflow', targetModuleId: 'mod.domain' },
      description: 'mod.workflow now depends directly on mod.domain for a new reason',
    })

    const moduleTargets = impact.items.filter((i) => i.category === 'module').map((i) => i.targetId)
    expect(moduleTargets.sort()).toEqual(['mod.domain', 'mod.workflow'])
    expect(impact.items.some((i) => i.targetId === 'mod.unrelated')).toBe(false)
    expect(impact.items.some((i) => i.targetId === 'mod.experience')).toBe(false)
    expect(impact.items.some((i) => i.targetId === 'mod.platform')).toBe(false)
  })

  it('an unrelated module never receives an impact item for a responsibility-text change', () => {
    const impact = analyzeDesignChange({
      ...baseInput,
      changeKind: 'responsibilityText',
      target: { moduleId: 'mod.domain' },
      description: 'clarified wording only',
    })

    expect(impact.items).toHaveLength(1)
    expect(impact.items[0]).toMatchObject({ category: 'module', targetId: 'mod.domain', invalidation: 'review' })
    expect(impact.items.some((i) => i.targetId === 'mod.unrelated')).toBe(false)
  })

  it('produces a dependency-ordered change plan with providers before consumers', () => {
    const impact = analyzeDesignChange({
      ...baseInput,
      changeKind: 'operationBehavior',
      target: { operationId: 'op.calculate' },
      description: 'behavior change ripples through the chain',
    })

    const order = impact.orderedChangePlan.map((c) => c.targetId)
    expect(order.indexOf('mod.domain')).toBeLessThan(order.indexOf('mod.workflow'))
    expect(order.indexOf('mod.workflow')).toBeLessThan(order.indexOf('mod.experience'))
    // Stable, ascending order entries.
    expect(impact.orderedChangePlan.map((c) => c.order)).toEqual(impact.orderedChangePlan.map((_, i) => i + 1))
  })

  it('is deterministic: the same input produces a deep-equal record on every call', () => {
    const input: AnalyzeDesignChangeInput = {
      ...baseInput,
      changeKind: 'schema',
      target: { schemaId: 'schema.calc-result' },
      description: 'calc-result schema gained a required field',
    }
    const first = analyzeDesignChange(input)
    const second = analyzeDesignChange(input)
    expect(first).toEqual(second)
    expect(first.contentHash).toBe(second.contentHash)
  })

  it('applyImpactToRecords returns only the affected record ids, split into stale versus review', () => {
    const impact = analyzeDesignChange({
      ...baseInput,
      changeKind: 'operationBehavior',
      target: { operationId: 'op.calculate' },
      description: 'behavior change',
    })
    const records = [{ id: 'mod.domain' }, { id: 'mod.workflow' }, { id: 'mod.experience' }, { id: 'mod.unrelated' }, { id: 'mod.platform' }]
    const result = applyImpactToRecords(impact, records)

    expect(result.staleRecordIds).toEqual(['mod.domain', 'mod.experience', 'mod.workflow'])
    expect(result.reviewRecordIds).toEqual([])
    expect(result.staleRecordIds).not.toContain('mod.unrelated')
  })

  it('applyImpactToRecords distinguishes stale from review for a responsibility-text change', () => {
    const impact = analyzeDesignChange({
      ...baseInput,
      changeKind: 'responsibilityText',
      target: { moduleId: 'mod.domain' },
      description: 'clarified wording only',
    })
    const result = applyImpactToRecords(impact, [{ id: 'mod.domain' }, { id: 'mod.unrelated' }])
    expect(result.staleRecordIds).toEqual([])
    expect(result.reviewRecordIds).toEqual(['mod.domain'])
  })
})
