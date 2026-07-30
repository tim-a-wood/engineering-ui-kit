import { describe, expect, it } from 'vitest'
import {
  compileWorkflowScenarioDefinitions,
  createModuleDesignDraft,
  createScenarioRun,
  evaluateArchitectureApplicationLink,
  evaluateArchitectureProposal,
  evaluateApplicationWorkflows,
  evaluateModuleBehavior,
  evaluateModuleDesign,
  evaluateModuleInterviewSte,
  evaluateProductGate,
  evaluateScenarioTraceFreshness,
  evaluateSolutionAllocations,
  migrateLegacyModuleBehavior,
  migrateLegacyUseCaseToWorkflow,
  parseModuleInterviewResponse,
  projectApplicationBehaviorDiagrams,
  projectModuleBehaviorDiagrams,
  projectScenarioStepTrace,
  projectSolutionAllocationDiagrams,
  validateActivityGraph,
  type ActivityGraph,
  type ApplicationSpecification,
  type ArchitectureSpecification,
  type ModuleDesignSpecification,
  type OperationContract,
} from '../../src/capabilities/index.js'

const graph: ActivityGraph = {
  id: 'workflow:review:graph',
  name: 'Review evidence',
  nodes: [
    { id: 'start', kind: 'initial', label: 'Initial', description: 'The workflow starts.', refinesIds: [] },
    { id: 'open', kind: 'action', label: 'Open evidence', description: 'The reviewer opens the evidence.', refinesIds: ['uc-review:step:open'], actorId: 'reviewer' },
    { id: 'check', kind: 'decision', label: 'Evidence valid', description: 'The workflow checks the evidence.', refinesIds: [] },
    { id: 'accept', kind: 'action', label: 'Accept evidence', description: 'The reviewer accepts the evidence.', refinesIds: ['uc-review:step:accept'], actorId: 'reviewer' },
    { id: 'return', kind: 'action', label: 'Return evidence', description: 'The reviewer returns the evidence.', refinesIds: ['uc-review:step:return'], actorId: 'reviewer' },
    { id: 'merge', kind: 'merge', label: 'Review result', description: 'The workflow combines both review paths.', refinesIds: [] },
    { id: 'end', kind: 'final', label: 'Final', description: 'The workflow ends.', refinesIds: [] },
  ],
  edges: [
    { id: 'start-open', fromNodeId: 'start', toNodeId: 'open', traceIds: ['uc-review:main', 'uc-review:path:return'] },
    { id: 'open-check', fromNodeId: 'open', toNodeId: 'check', traceIds: ['uc-review:main', 'uc-review:path:return'] },
    { id: 'check-accept', fromNodeId: 'check', toNodeId: 'accept', guard: 'The evidence is valid.', outcome: 'success', traceIds: ['uc-review:main'] },
    { id: 'check-return', fromNodeId: 'check', toNodeId: 'return', guard: 'The evidence is invalid.', outcome: 'alternate', traceIds: ['uc-review:path:return'] },
    { id: 'accept-merge', fromNodeId: 'accept', toNodeId: 'merge', traceIds: ['uc-review:main'] },
    { id: 'return-merge', fromNodeId: 'return', toNodeId: 'merge', traceIds: ['uc-review:path:return'] },
    { id: 'merge-end', fromNodeId: 'merge', toNodeId: 'end', traceIds: ['uc-review:main', 'uc-review:path:return'] },
  ],
}

function application(): ApplicationSpecification {
  return {
    schemaVersion: '1.0',
    projectId: 'project',
    id: 'app',
    revision: '2',
    status: 'approved',
    purpose: 'Review approved evidence.',
    outcomes: ['The reviewer records an evidence result.'],
    actors: [{ id: 'reviewer', text: 'Reviewer' }],
    goals: [{ id: 'goal', text: 'Review evidence' }],
    useCases: [{ id: 'uc-review', text: 'Review evidence' }],
    scenarios: [],
    useCaseDefinitions: [{
      id: 'uc-review',
      name: 'Review evidence',
      actorIds: ['reviewer'],
      trigger: 'The reviewer opens an evidence record.',
      preconditions: ['An approved evidence record exists.'],
      mainFlow: [
        {
          id: 'uc-review:step:open',
          order: 1,
          actorId: 'reviewer',
          action: 'Open evidence',
          expectedResult: 'The evidence record is visible.',
          inputIds: [],
          outputIds: [],
          ruleIds: [],
          evidencePolicy: 'screenshot',
        },
        {
          id: 'uc-review:step:accept',
          order: 2,
          actorId: 'reviewer',
          action: 'Accept evidence',
          expectedResult: 'The evidence result is accepted.',
          inputIds: [],
          outputIds: [],
          ruleIds: [],
          evidencePolicy: 'structured',
        },
      ],
      alternatePaths: [{
        id: 'uc-review:path:return',
        name: 'Return evidence',
        kind: 'alternate',
        preconditions: [],
        steps: [{
          id: 'uc-review:step:return',
          order: 1,
          actorId: 'reviewer',
          action: 'Return evidence',
          expectedResult: 'The evidence returns for correction.',
          inputIds: [],
          outputIds: [],
          ruleIds: [],
          evidencePolicy: 'structured',
        }],
        outcome: 'The evidence returns for correction.',
      }],
      failurePaths: [],
      recoveryPaths: [],
      ruleIds: [],
      inputIds: [],
      outputIds: [],
      acceptanceCaseIds: ['accept-review'],
      sourceRefs: ['source-review'],
    }],
    applicationWorkflows: [{
      id: 'workflow:review',
      useCaseId: 'uc-review',
      name: 'Review evidence',
      graph,
      pathIds: ['uc-review:main', 'uc-review:path:return'],
      acceptanceCaseIds: ['accept-review'],
      sourceRefs: ['source-review'],
    }],
    information: [],
    rules: [],
    externalSystems: [],
    constraints: [],
    scope: { inScope: ['Evidence review'], outOfScope: [] },
    acceptanceCases: [{
      id: 'accept-review',
      description: 'Review approved evidence.',
      expectedOutcome: 'The review records a result.',
    }],
    sources: [{ id: 'source-review', text: 'Review requirements' }],
    unresolvedQuestions: [],
    contentHash: 'app-hash',
  }
}

function architecture(): ArchitectureSpecification {
  return {
    schemaVersion: '1.0',
    projectId: 'project',
    id: 'arch',
    revision: '3',
    status: 'approved',
    applicationSpecId: 'app',
    applicationSpecRevision: '2',
    applicationSpecHash: 'app-hash',
    capabilityProjections: [],
    moduleIds: ['mod.ui', 'mod.review'],
    moduleDefinitions: [
      { moduleId: 'mod.ui', name: 'Review UI', moduleType: 'experience', responsibility: 'Present review evidence.' },
      { moduleId: 'mod.review', name: 'Review service', moduleType: 'domain', responsibility: 'Record review decisions.' },
    ],
    dependencyEdges: [{ fromModuleId: 'mod.ui', toModuleId: 'mod.review', reason: 'Record the review decision.' }],
    operationAllocations: [{ operationId: 'review.record', moduleId: 'mod.review' }],
    adapterAllocations: [],
    workflowTraces: [{
      useCaseId: 'uc-review',
      moduleIds: ['mod.ui', 'mod.review'],
      nodeAllocations: [
        { workflowId: 'workflow:review', nodeId: 'open', primaryModuleId: 'mod.ui', participatingModuleIds: [], entryPointId: 'route:review' },
        { workflowId: 'workflow:review', nodeId: 'accept', primaryModuleId: 'mod.review', participatingModuleIds: [], operationId: 'review.record' },
        { workflowId: 'workflow:review', nodeId: 'return', primaryModuleId: 'mod.review', participatingModuleIds: [], operationId: 'review.record' },
      ],
    }],
    proposals: [],
    unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
    contentHash: 'arch-hash',
  }
}

function design(): ModuleDesignSpecification {
  return {
    schemaVersion: '1.0',
    projectId: 'project',
    id: 'module-design:mod.review',
    revision: '1',
    status: 'draft',
    architecture: { id: 'arch', revision: '3', contentHash: 'arch-hash' },
    module: {
      moduleId: 'mod.review',
      moduleVersion: '1.0.0',
      name: 'Review service',
      moduleType: 'domain',
      responsibility: 'Record review decisions.',
      nonResponsibilities: ['Present evidence'],
      ownedConcerns: ['Review decisions'],
      excludedConcerns: ['Evidence display'],
    },
    trace: {
      useCaseIds: ['uc-review'],
      workflowNodeIds: ['accept', 'return'],
      scenarioStepIds: ['uc-review:step:accept', 'uc-review:step:return'],
      ruleIds: [],
      qualityRequirementIds: [],
      sourceRefs: ['source-review'],
      designDecisionIds: [],
    },
    boundary: {
      directDependencyIds: [],
      directConsumerIds: ['mod.ui'],
      deployableId: 'service',
      runtimeAllocation: 'local-embedded',
      runtimeLanguage: 'typescript',
      ownedPaths: ['src/review'],
      editableSharedPaths: [],
    },
    providedOperations: [{ operationId: 'review.record', contractVersion: '1.0.0' }],
    requiredOperations: [],
    schemas: [{ id: 'review', text: 'Review record' }],
    rules: [],
    invariants: [],
    behavior: {
      preconditions: [],
      postconditions: [],
      domainRejections: ['The evidence is invalid.'],
      technicalFailures: [],
      sideEffects: [],
      idempotency: 'Use the request ID.',
      cancellation: 'Stop before the record write.',
      timeouts: 'Use the service timeout.',
      concurrency: 'Serialize each review record.',
      retry: 'Do not retry a domain rejection.',
      recovery: 'Keep the prior review record.',
      emittedEvents: [],
      consumedEvents: [],
      states: [],
      activities: [],
      interactions: [],
      stateDefinitions: [],
      stateTransitions: [],
      interactionDefinitions: [],
      activityDefinitions: [{
        id: 'activity:record-review',
        name: 'Record review result',
        entryOperationId: 'review.record',
        refinesWorkflowNodeIds: ['accept', 'return'],
        graph: {
          id: 'activity:record-review:graph',
          name: 'Record review result',
          nodes: [
            { id: 'start', kind: 'initial', label: 'Initial', description: 'The module activity starts.', refinesIds: [] },
            { id: 'validate', kind: 'decision', label: 'Evidence valid', description: 'The module checks the evidence.', refinesIds: [] },
            { id: 'record', kind: 'call-operation', label: 'Record review result', description: 'The module records the review result.', refinesIds: ['accept'], operationId: 'review.record' },
            { id: 'reject', kind: 'action', label: 'Reject review request', description: 'The module rejects the request.', refinesIds: ['return'] },
            { id: 'end', kind: 'final', label: 'Final', description: 'The module activity ends.', refinesIds: [] },
          ],
          edges: [
            { id: 'start-validate', fromNodeId: 'start', toNodeId: 'validate', traceIds: ['activity:record-review'] },
            { id: 'validate-record', fromNodeId: 'validate', toNodeId: 'record', guard: 'The evidence is valid.', outcome: 'success', traceIds: ['activity:record-review'] },
            { id: 'validate-reject', fromNodeId: 'validate', toNodeId: 'reject', guard: 'The evidence is invalid.', outcome: 'failure', traceIds: ['activity:record-review'] },
            { id: 'record-end', fromNodeId: 'record', toNodeId: 'end', traceIds: ['activity:record-review'] },
            { id: 'reject-end', fromNodeId: 'reject', toNodeId: 'end', traceIds: ['activity:record-review'] },
          ],
        },
      }],
    },
    data: {
      persistentRecords: [],
      ownership: [],
      retention: [],
      migrationNeeds: [],
      confidentiality: 'Internal',
      provenanceFields: [],
      canonicalUnits: [],
    },
    runtime: {
      configurationRefs: [],
      secretRefs: [],
      lifecycleRegistration: 'request-job',
      health: [],
      telemetry: [],
      resourceOwnership: [],
      startup: [],
      shutdown: [],
      compatibilityConstraints: [],
    },
    verification: {
      examples: [],
      edgeCases: [],
      acceptanceCaseIds: ['accept-review'],
      verificationSuiteIds: ['suite-review'],
      requiredEvidence: ['structured'],
      testDoubles: [],
      fixtureNeeds: [],
      commands: [],
    },
    diagrams: [],
    unresolvedItems: [],
    gates: [],
    contentHash: '',
  }
}

describe('three-level behavior model', () => {
  it('enforces the Plan, Design, Build, and handoff lifecycle in order', () => {
    const app = application()
    const arch = architecture()
    const moduleDesign = design()
    const contract: OperationContract = {
      schemaVersion: '1.0',
      operationId: 'review.record',
      version: '1.0.0',
      behavior: 'command',
      inputSchemaRef: 'review',
      outputSchemaRef: 'review',
      preconditions: [],
      postconditions: ['The review result is recorded.'],
      domainRejections: ['The evidence is invalid.'],
      technicalErrors: [],
      sideEffects: [],
      idempotency: 'idempotent',
      timeoutClass: 'short',
      cancellable: true,
      artifactTypes: [],
      provenanceFields: [],
    }

    expect(evaluateProductGate(app).passed).toBe(true)
    expect(evaluateArchitectureProposal(app, {
      architecture: arch,
      moduleNeedTraces: arch.moduleIds.map((moduleId) => ({
        moduleId,
        needIds: ['uc-review'],
      })),
    }).passed).toBe(true)
    expect(evaluateModuleDesign(moduleDesign, [contract], undefined, {
      application: app,
      architecture: arch,
    }).passed).toBe(true)

    const revisedApplication = {
      ...app,
      revision: '3',
      contentHash: 'app-hash-3',
    }
    expect(evaluateArchitectureApplicationLink(revisedApplication, arch)).toEqual({
      current: false,
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: 'CAP-ARCH-APPLICATION-REVISION' }),
        expect.objectContaining({ code: 'CAP-ARCH-APPLICATION-HASH' }),
      ]),
    })
    expect(() => createModuleDesignDraft({
      application: revisedApplication,
      architecture: arch,
      manifest: {
        schemaVersion: '1.0',
        architectureVersion: '1.0',
        moduleId: 'mod.review',
        moduleVersion: '1.0.0',
        moduleType: 'workflow',
        name: 'Review service',
        responsibility: 'Record review decisions.',
        ownedConcerns: ['Review decisions'],
        excludedConcerns: ['Evidence display'],
        providedOperations: [{ operationId: 'review.record', contractVersion: '1.0.0' }],
        requiredOperations: [],
        verificationSuiteIds: ['suite-review'],
        runtimeAllocation: 'local-embedded',
        events: [],
        ownedPaths: ['src/review'],
      },
    })).toThrow(/architecture is stale/i)

    const revisedArchitecture = {
      ...arch,
      revision: '4',
      applicationSpecRevision: revisedApplication.revision,
      applicationSpecHash: revisedApplication.contentHash,
      contentHash: 'arch-hash-4',
    }
    expect(evaluateArchitectureProposal(revisedApplication, {
      architecture: revisedArchitecture,
      moduleNeedTraces: revisedArchitecture.moduleIds.map((moduleId) => ({
        moduleId,
        needIds: ['uc-review'],
      })),
    }).passed).toBe(true)
    expect(evaluateModuleDesign(moduleDesign, [contract], undefined, {
      application: revisedApplication,
      architecture: revisedArchitecture,
    }).diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CAP-MODULE-DESIGN-ARCHITECTURE-STALE' }),
    ]))
  })

  it('validates a branched application graph with stable paths', () => {
    expect(validateActivityGraph(graph).passed).toBe(true)
    expect(evaluateApplicationWorkflows(application())).toEqual({ passed: true, diagnostics: [] })
    expect(compileWorkflowScenarioDefinitions(application())).toEqual(expect.arrayContaining([
      expect.objectContaining({
        workflowId: 'workflow:review',
        workflowNodeIds: ['open', 'accept'],
        stepIds: ['uc-review:step:open', 'uc-review:step:accept'],
      }),
      expect.objectContaining({
        workflowId: 'workflow:review',
        workflowNodeIds: ['open', 'return'],
        stepIds: ['uc-review:step:open', 'uc-review:step:return'],
      }),
    ]))
  })

  it('returns stable paths for invalid decisions and unreachable nodes', () => {
    const invalid: ActivityGraph = {
      ...graph,
      nodes: [...graph.nodes, {
        id: 'orphan',
        kind: 'action',
        label: 'Inspect orphan',
        description: 'The node is not reachable.',
        refinesIds: [],
      }],
      edges: graph.edges.map((edge) =>
        edge.fromNodeId === 'check' ? { ...edge, guard: undefined } : edge),
    }
    const result = validateActivityGraph(invalid, { includeSte: false, fieldPath: 'fixture.graph' })
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'CAP-ACTIVITY-DECISION-GUARD',
        fieldPath: 'fixture.graph.edges.check-accept.guard',
      }),
      expect.objectContaining({
        code: 'CAP-ACTIVITY-UNREACHABLE',
        fieldPath: 'fixture.graph.nodes.orphan',
      }),
    ]))
  })

  it('validates allocation and module refinement as separate gates', () => {
    const app = application()
    const arch = architecture()
    const moduleDesign = design()
    expect(evaluateSolutionAllocations(app, arch)).toEqual({ passed: true, diagnostics: [] })
    expect(evaluateModuleBehavior({ application: app, architecture: arch, design: moduleDesign }))
      .toEqual({ passed: true, diagnostics: [] })

    moduleDesign.behavior.activityDefinitions![0]!.refinesWorkflowNodeIds = ['open']
    expect(evaluateModuleBehavior({ application: app, architecture: arch, design: moduleDesign }).diagnostics)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'CAP-MODULE-BEHAVIOR-REFINEMENT-OWNER' }),
        expect.objectContaining({ code: 'CAP-MODULE-BEHAVIOR-COVERAGE', relatedIds: ['accept'] }),
      ]))
  })

  it('projects distinct application, allocation, and internal module diagrams', () => {
    const app = application()
    const arch = architecture()
    const moduleDesign = design()
    const applicationDiagram = projectApplicationBehaviorDiagrams(app)[0]!
    const allocationDiagrams = projectSolutionAllocationDiagrams(app, arch)
    const moduleDiagrams = projectModuleBehaviorDiagrams({ application: app, architecture: arch, design: moduleDesign })

    expect(applicationDiagram.level).toBe('application')
    expect(applicationDiagram.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'swimlane', label: 'Reviewer' }),
    ]))
    const applicationSuccess = applicationDiagram.edges.find((edge) => edge.outcome === 'success')
    expect(applicationSuccess).toEqual(expect.objectContaining({
      label: undefined,
      guard: 'The evidence is valid.',
    }))
    expect(allocationDiagrams.map((item) => item.level)).toEqual(['allocation', 'allocation'])
    expect(moduleDiagrams.every((item) => item.level === 'module')).toBe(true)
    const moduleActivity = moduleDiagrams.find((item) => item.kind === 'activity')
    expect(moduleActivity?.nodes.map((node) => node.label))
      .not.toContain('Open evidence')
    expect(moduleActivity?.edges.find((edge) => edge.outcome === 'success')).toEqual(
      expect.objectContaining({ label: undefined, guard: 'The evidence is valid.' }),
    )
    expect(moduleActivity?.sourceRecordIds)
      .toContain(moduleDesign.id)
  })

  it('migrates legacy records without inventing branch anchors or module behavior', () => {
    const useCase = application().useCaseDefinitions![0]!
    const migratedWorkflow = migrateLegacyUseCaseToWorkflow(useCase)
    expect(migratedWorkflow.workflow.graph.nodes.filter((node) => node.kind === 'action')).toHaveLength(2)
    expect(migratedWorkflow.unresolvedItems).toEqual([
      expect.objectContaining({ relatedIds: ['uc-review', 'uc-review:path:return'] }),
    ])

    const legacy = design().behavior
    legacy.activityDefinitions = undefined
    legacy.activities = [{ id: 'legacy-check', text: 'Check review record' }]
    const migratedModule = migrateLegacyModuleBehavior(legacy, 'mod.review')
    expect(migratedModule.requiresReview).toBe(true)
    expect(migratedModule.behavior.activityDefinitions![0]!.refinesWorkflowNodeIds).toEqual([])
    expect(migratedModule.behavior.activityDefinitions![0]!.graph.nodes.map((node) => node.label))
      .not.toContain('Open evidence')
  })

  it('preserves an AI behavior draft and uses it to start module design', () => {
    const behaviorDraft = design().behavior
    const parsed = parseModuleInterviewResponse({
      moduleId: 'mod.review',
      moduleType: 'workflow',
      name: 'Review workflow',
      moduleVersion: '1.0.0',
      responsibility: 'Record review decisions.',
      ownedConcerns: ['Review decisions'],
      excludedConcerns: ['Evidence storage'],
      providedOperations: [{ operationId: 'review.record', contractVersion: '1.0.0' }],
      requiredOperations: [],
      verificationSuiteIds: ['accept.review'],
      runtimeAllocation: 'local-embedded',
      events: [],
      answers: [],
      acceptanceCases: [],
      rules: [],
      operationContracts: [],
      dataSchemas: [],
      behaviorDraft,
    })
    expect(parsed.diagnostics).toEqual([])
    expect(parsed.response?.behaviorDraft?.activityDefinitions?.[0]?.graph.nodes)
      .toEqual(behaviorDraft.activityDefinitions?.[0]?.graph.nodes)
    parsed.response!.behaviorDraft!.activityDefinitions![0]!.graph.nodes[2]!.label =
      'Record; review result'
    expect(evaluateModuleInterviewSte(parsed.response!).diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'STE-PUNCTUATION-SEMICOLON',
          fieldPath: 'behaviorDraft.activityDefinitions.activity:record-review.graph.nodes.record.label',
        }),
      ]),
    )
    parsed.response!.behaviorDraft!.activityDefinitions![0]!.graph.nodes[2]!.label =
      behaviorDraft.activityDefinitions![0]!.graph.nodes[2]!.label

    const draft = createModuleDesignDraft({
      application: application(),
      architecture: architecture(),
      manifest: {
        schemaVersion: '1.0',
        architectureVersion: '1.0',
        moduleId: 'mod.review',
        moduleVersion: '1.0.0',
        moduleType: 'workflow',
        name: 'Review workflow',
        responsibility: 'Record review decisions.',
        ownedConcerns: ['Review decisions'],
        excludedConcerns: ['Evidence storage'],
        providedOperations: [{ operationId: 'review.record', contractVersion: '1.0.0' }],
        requiredOperations: [],
        verificationSuiteIds: ['accept.review'],
        runtimeAllocation: 'local-embedded',
        events: [],
        ownedPaths: ['src/review/'],
      },
      behaviorDraft: parsed.response!.behaviorDraft,
    })
    expect(draft.behavior.activityDefinitions?.[0]?.id).toBe('activity:record-review')
    expect(draft.diagrams.find((diagram) => diagram.kind === 'activity')?.nodes)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ label: 'Record review result' }),
      ]))
  })

  it('traces an observed application step through allocation and module behavior', () => {
    const app = application()
    const arch = architecture()
    const moduleDesign = design()
    const scenario = compileWorkflowScenarioDefinitions(app)
      .find((candidate) => candidate.kind === 'main')!
    const run = createScenarioRun({
      runId: 'run:review',
      application: app,
      architecture: arch,
      moduleDesigns: [moduleDesign],
      scenarioId: scenario.id,
      build: 'build:1',
      sourceRevision: 'source:1',
      environment: 'test',
      testDataRevision: 'data:1',
      runner: 'vitest',
      startedAt: '2026-01-01T00:00:00.000Z',
    })
    const trace = projectScenarioStepTrace({
      application: app,
      architecture: arch,
      moduleDesigns: [moduleDesign],
      scenarioId: scenario.id,
      scenarioStepId: 'uc-review:step:accept',
      record: run,
    })

    expect(trace.workflowNodeIds).toEqual(['accept'])
    expect(trace.modules).toEqual([
      expect.objectContaining({
        moduleId: 'mod.review',
        activityIds: ['activity:record-review'],
        activityNodeIds: ['record'],
        operationIds: ['review.record'],
        stale: false,
      }),
    ])
    expect(evaluateScenarioTraceFreshness({
      application: app,
      architecture: arch,
      moduleDesigns: [moduleDesign],
      record: run,
    }).current).toBe(true)

    const changedDesign = { ...moduleDesign, revision: '2' }
    expect(evaluateScenarioTraceFreshness({
      application: app,
      architecture: arch,
      moduleDesigns: [changedDesign],
      record: run,
    }).diagnostics).toEqual([
      expect.objectContaining({
        code: 'CAP-SCENARIO-MODULE-DESIGN-STALE',
        relatedIds: ['mod.review', '1'],
      }),
    ])
  })
})
