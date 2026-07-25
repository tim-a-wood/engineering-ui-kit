/**
 * EUC-08 — Diagram semantics.
 * Acceptance (SPECIFICATION.md §25.3 EUC-08/09):
 *  - every visible relationship exists in the semantic projection;
 *  - every selectable element opens its canonical source (carries `sourceRecordId`);
 *  - the same record produces the same projection (determinism);
 *  - the renderer never hides a relationship to make a layout pass.
 * Also covers §15.1 UML 2.5.1 subset semantic validation and §15.2 text
 * alternative content.
 */
import { describe, expect, it } from 'vitest'
import {
  projectActivityDiagram,
  projectComponentDiagram,
  projectSequenceDiagram,
  projectStateMachineDiagram,
  projectUseCaseDiagram,
  validateUmlProjection,
} from '../../../src/capabilities/design/diagramSemantics.js'
import type { ModuleDesignSpecification, UmlElement, UmlRelationship, UseCaseAnalysis } from '../../../src/capabilities/design/records.js'
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
    moduleIds: ['mod.domain', 'mod.workflow', 'mod.experience', 'mod.connection'],
    moduleDefinitions: [
      { moduleId: 'mod.domain', name: 'Evidence domain', moduleType: 'domain', responsibility: 'Own evidence rules' },
      { moduleId: 'mod.workflow', name: 'Review workflow', moduleType: 'workflow', responsibility: 'Orchestrate evidence review' },
      { moduleId: 'mod.experience', name: 'Review screen', moduleType: 'experience', responsibility: 'Render the review screen' },
      { moduleId: 'mod.connection', name: 'Bundle importer', moduleType: 'connection', responsibility: 'Import evidence bundles' },
    ],
    dependencyEdges: [
      { fromModuleId: 'mod.workflow', toModuleId: 'mod.domain', reason: 'uses domain rules' },
      { fromModuleId: 'mod.experience', toModuleId: 'mod.workflow', reason: 'invokes the review workflow' },
    ],
    operationAllocations: [
      { operationId: 'op.calculate', moduleId: 'mod.domain' },
      { operationId: 'op.run', moduleId: 'mod.workflow' },
    ],
    adapterAllocations: [],
    workflowTraces: [{ useCaseId: 'uc.review-evidence', moduleIds: ['mod.domain', 'mod.workflow', 'mod.experience'] }],
    proposals: [],
    unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
    contentHash: 'arch-hash',
    ...overrides,
  }
}

type ModuleDesignOverrides = {
  id: string
  moduleId: string
  name?: string
  directDependencyIds?: string[]
  directConsumerIds?: string[]
  providedOperations?: ModuleDesignSpecification['providedOperations']
  requiredOperations?: ModuleDesignSpecification['requiredOperations']
  useCaseIds?: string[]
  activities?: NonNullable<ModuleDesignSpecification['behavior']['activities']>
  states?: NonNullable<ModuleDesignSpecification['behavior']['states']>
  interactions?: NonNullable<ModuleDesignSpecification['behavior']['interactions']>
  recovery?: string
}

function moduleDesignFixture(overrides: ModuleDesignOverrides): ModuleDesignSpecification {
  return {
    schemaVersion: '1.0',
    projectId: 'proj-1',
    id: overrides.id,
    revision: 'r1',
    status: 'draft',
    architecture: { id: 'arch-1', revision: 'r1', contentHash: 'arch-hash' },
    module: {
      moduleId: overrides.moduleId,
      moduleVersion: '1.0.0',
      name: overrides.name ?? overrides.moduleId,
      moduleType: 'workflow',
      responsibility: `${overrides.moduleId} responsibility`,
      nonResponsibilities: [],
      ownedConcerns: [],
      excludedConcerns: [],
    },
    trace: {
      useCaseIds: overrides.useCaseIds ?? [],
      scenarioStepIds: [],
      ruleIds: [],
      qualityRequirementIds: [],
      sourceRefs: [],
      designDecisionIds: [],
    },
    boundary: {
      directDependencyIds: overrides.directDependencyIds ?? [],
      directConsumerIds: overrides.directConsumerIds ?? [],
      deployableId: `deployable.${overrides.moduleId}`,
      runtimeAllocation: 'local-embedded',
      runtimeLanguage: 'typescript',
      ownedPaths: [`capabilities/modules/${overrides.moduleId}/`],
      editableSharedPaths: [],
    },
    providedOperations: overrides.providedOperations ?? [],
    requiredOperations: overrides.requiredOperations ?? [],
    schemas: [],
    rules: [],
    invariants: [],
    behavior: {
      preconditions: [],
      postconditions: [],
      domainRejections: [],
      technicalFailures: [],
      sideEffects: [],
      idempotency: '',
      cancellation: '',
      timeouts: '',
      concurrency: '',
      retry: '',
      recovery: overrides.recovery ?? '',
      emittedEvents: [],
      consumedEvents: [],
      activities: overrides.activities,
      states: overrides.states,
      interactions: overrides.interactions,
    },
    data: {
      inputSchemas: [],
      outputSchemas: [],
      persistentRecords: [],
      dataOwnership: '',
      retention: '',
      migrationNeeds: '',
      confidentiality: '',
      provenanceFields: [],
      canonicalUnits: [],
      canonicalEnumerations: [],
    },
    runtime: {
      configurationRefs: [],
      secretReferenceIds: [],
      lifecycleRegistration: '',
      healthBehavior: '',
      telemetry: '',
      resourceOwnership: '',
      startupBehavior: '',
      shutdownBehavior: '',
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
      moduleType: 'workflow',
      detail: {
        trigger: '',
        orderedSteps: [],
        participants: [],
        decisionsAndGuards: [],
        transactionBoundary: '',
        partialCompletion: '',
        compensation: '',
        retryPolicy: '',
        deduplication: '',
        idempotencyKeyUse: '',
        cancellationPoints: [],
        deadlinePropagation: '',
        resourceLocks: [],
        progressReporting: '',
        finalOutcomes: [],
      },
    },
    diagrams: [],
    unresolvedItems: [],
    gates: [],
    contentHash: `hash-${overrides.id}`,
  }
}

const workflowDesign = moduleDesignFixture({
  id: 'design.mod.workflow',
  moduleId: 'mod.workflow',
  name: 'Review workflow',
  directDependencyIds: ['mod.domain'],
  directConsumerIds: ['mod.experience'],
  providedOperations: [{ operationId: 'op.run', version: '1.0.0' }],
  requiredOperations: [{ operationId: 'op.calculate', acceptedVersionRange: '^1.0.0', providerModuleId: 'mod.domain', reason: 'needs the domain calculation' }],
})

const domainDesign = moduleDesignFixture({ id: 'design.mod.domain', moduleId: 'mod.domain', name: 'Evidence domain' })
const experienceDesign = moduleDesignFixture({ id: 'design.mod.experience', moduleId: 'mod.experience', name: 'Review screen' })

// ---------------------------------------------------------------------------
// projectComponentDiagram (§9.8 row 1)
// ---------------------------------------------------------------------------

describe('EUC-08 projectComponentDiagram', () => {
  it('includes the selected module, direct consumers, dependencies, provided/required interfaces, and dependency relationships', () => {
    const architecture = architectureFixture()
    const projection = projectComponentDiagram({ design: workflowDesign, architecture, allDesigns: [domainDesign, experienceDesign] })

    expect(projection.kind).toBe('component')
    expect(projection.diagnostics).toEqual([])

    const kinds = projection.elements.map((element) => element.kind).sort()
    expect(kinds).toEqual(['component', 'component', 'component', 'providedInterface', 'requiredInterface'].sort())

    const dependencyRel = projection.relationships.find((rel) => rel.kind === 'dependency' && rel.label === 'uses domain rules')
    expect(dependencyRel).toBeDefined()
    const consumerRel = projection.relationships.find((rel) => rel.kind === 'dependency' && rel.label === 'invokes the review workflow')
    expect(consumerRel).toBeDefined()
    expect(projection.relationships.some((rel) => rel.kind === 'provides')).toBe(true)
    expect(projection.relationships.some((rel) => rel.kind === 'requires')).toBe(true)

    // Every visible relationship exists in the semantic projection, and every
    // selectable element carries a sourceRecordId that opens its canonical source.
    expect(projection.textAlternative).toHaveLength(projection.relationships.length)
    for (const element of projection.elements) expect(element.sourceRecordId).toBeTruthy()
    for (const rel of projection.relationships) {
      expect(projection.elements.some((element) => element.id === rel.fromId)).toBe(true)
      expect(projection.elements.some((element) => element.id === rel.toId)).toBe(true)
    }
  })

  it('resolves peer component names from allDesigns when available, else the architecture definition', () => {
    const architecture = architectureFixture()
    const withPeers = projectComponentDiagram({ design: workflowDesign, architecture, allDesigns: [domainDesign, experienceDesign] })
    const domainElement = withPeers.elements.find((element) => element.sourceElementRef === 'module' && element.label === 'Evidence domain')
    expect(domainElement?.sourceRecordId).toBe('design.mod.domain')

    const withoutPeers = projectComponentDiagram({ design: workflowDesign, architecture })
    const fallbackElement = withoutPeers.elements.find((element) => element.label === 'Evidence domain')
    expect(fallbackElement?.sourceRecordId).toBe('arch-1')
  })

  it('is deterministic for the same input', () => {
    const architecture = architectureFixture()
    const first = projectComponentDiagram({ design: workflowDesign, architecture, allDesigns: [domainDesign, experienceDesign] })
    const second = projectComponentDiagram({ design: workflowDesign, architecture, allDesigns: [domainDesign, experienceDesign] })
    expect(second).toEqual(first)
    expect(second.contentHash).toBe(first.contentHash)
  })
})

// ---------------------------------------------------------------------------
// projectActivityDiagram (§9.8 row 2)
// ---------------------------------------------------------------------------

describe('EUC-08 projectActivityDiagram', () => {
  const activityDesign = moduleDesignFixture({
    id: 'design.mod.workflow',
    moduleId: 'mod.workflow',
    name: 'Review workflow',
    recovery: 'Retry the review on a transient failure',
    activities: [
      {
        id: 'act.review',
        name: 'Review evidence',
        actions: [
          { id: 'start', kind: 'initial', label: 'Start', next: [{ targetId: 'check' }] },
          {
            id: 'check',
            kind: 'decision',
            label: 'Bundle complete?',
            next: [
              { targetId: 'process', guard: 'complete' },
              { targetId: 'reject', guard: 'incomplete' },
            ],
          },
          { id: 'process', kind: 'action', label: 'Approve bundle', next: [{ targetId: 'end' }] },
          { id: 'reject', kind: 'action', label: 'Reject bundle', next: [{ targetId: 'end' }] },
          { id: 'end', kind: 'final', label: 'End', next: [] },
        ],
      },
    ],
  })

  it('projects the initial node, actions, guarded decisions, recovery, and final node with no diagnostics', () => {
    const projection = projectActivityDiagram(activityDesign)
    expect(projection.diagnostics).toEqual([])
    expect(projection.elements.filter((element) => element.kind === 'initialNode')).toHaveLength(1)
    expect(projection.elements.filter((element) => element.kind === 'finalNode')).toHaveLength(1)
    expect(projection.elements.some((element) => element.kind === 'decision')).toBe(true)

    const recoveryElement = projection.elements.find((element) => element.sourceElementRef === 'recovery')
    expect(recoveryElement?.label).toContain('Retry the review')

    const guardedEdges = projection.relationships.filter((rel) => rel.kind === 'controlFlow' && rel.guard)
    expect(guardedEdges.map((edge) => edge.guard).sort()).toEqual(['complete', 'incomplete'])
    expect(projection.textAlternative).toHaveLength(projection.relationships.length)
  })

  it('is deterministic and every element carries a sourceRecordId', () => {
    const first = projectActivityDiagram(activityDesign)
    const second = projectActivityDiagram(activityDesign)
    expect(second).toEqual(first)
    for (const element of first.elements) expect(element.sourceRecordId).toBe(activityDesign.id)
  })
})

// ---------------------------------------------------------------------------
// projectStateMachineDiagram (§9.8 row 3 / §15.1 trigger [guard] / effect)
// ---------------------------------------------------------------------------

describe('EUC-08 projectStateMachineDiagram', () => {
  const stateDesign = moduleDesignFixture({
    id: 'design.mod.workflow',
    moduleId: 'mod.workflow',
    name: 'Review workflow',
    states: [
      {
        recordName: 'EvidenceBundle',
        states: ['draft', 'submitted', 'approved', 'rejected'],
        initialState: 'draft',
        finalStates: ['approved'],
        transitions: [
          { id: 't.submit', from: 'draft', to: 'submitted', trigger: 'submit' },
          { id: 't.approve', from: 'submitted', to: 'approved', trigger: 'approve', guard: 'complete', effect: 'record approval' },
          { id: 't.reject', from: 'submitted', to: 'rejected', trigger: 'reject', guard: 'incomplete' },
          { id: 't.revise', from: 'rejected', to: 'draft', trigger: 'revise' },
        ],
      },
    ],
  })

  it('formats transitions as `trigger [guard] / effect` and the text alternative matches §15.2', () => {
    const projection = projectStateMachineDiagram(stateDesign)
    expect(projection.diagnostics).toEqual([])

    const approveTransition = projection.relationships.find((rel) => rel.trigger === 'approve')
    expect(approveTransition?.label).toBe('approve [complete] / record approval')
    expect(projection.textAlternative).toContain('state submitted → approved on approve [complete] / record approval')
    expect(projection.textAlternative).toHaveLength(projection.relationships.length)
  })

  it('includes exactly one initial pseudostate and a final state for a defined final state', () => {
    const projection = projectStateMachineDiagram(stateDesign)
    expect(projection.elements.filter((element) => element.kind === 'initialNode')).toHaveLength(1)
    expect(projection.elements.filter((element) => element.kind === 'finalNode')).toHaveLength(1)
  })

  it('is deterministic for the same input', () => {
    const first = projectStateMachineDiagram(stateDesign)
    const second = projectStateMachineDiagram(stateDesign)
    expect(second).toEqual(first)
  })
})

// ---------------------------------------------------------------------------
// projectSequenceDiagram (§9.8 row 4 / §15.1 solid calls, dashed replies)
// ---------------------------------------------------------------------------

describe('EUC-08 projectSequenceDiagram', () => {
  const sequenceDesign = moduleDesignFixture({
    id: 'design.mod.workflow',
    moduleId: 'mod.workflow',
    name: 'Review workflow',
    interactions: [
      {
        id: 'int.approve',
        name: 'Approve evidence',
        lifelines: [
          { id: 'reviewer', label: 'Reviewer', kind: 'actor' },
          { id: 'ui', label: 'Review UI', kind: 'boundary' },
          { id: 'svc', label: 'Approval service', kind: 'control' },
        ],
        fragments: [{ id: 'frag.alt', operator: 'alt', operands: [{ id: 'op.complete', guard: 'complete' }, { id: 'op.incomplete', guard: 'incomplete' }] }],
        messages: [
          { id: 'm1', from: 'reviewer', to: 'ui', label: 'click approve', kind: 'call' },
          { id: 'm2', from: 'ui', to: 'svc', label: 'approve(id)', kind: 'call' },
          { id: 'm3', from: 'svc', to: 'ui', label: 'result', kind: 'reply' },
          { id: 'm4', from: 'ui', to: 'reviewer', label: 'show result', kind: 'reply' },
        ],
      },
    ],
  })

  it('projects lifelines, a labeled combined fragment, and calls/replies in top-to-bottom order with no diagnostics', () => {
    const projection = projectSequenceDiagram(sequenceDesign)
    expect(projection.diagnostics).toEqual([])
    expect(projection.elements.filter((element) => element.kind === 'lifeline')).toHaveLength(3)

    const fragment = projection.elements.find((element) => element.kind === 'fragment')
    expect(fragment?.umlType).toBe('combined fragment «alt»')

    const messageOrder = projection.relationships.map((rel) => rel.label)
    expect(messageOrder).toEqual(['click approve', 'approve(id)', 'result', 'show result'])
    expect(projection.relationships.map((rel) => rel.kind)).toEqual(['message', 'message', 'reply', 'reply'])
    expect(projection.textAlternative).toHaveLength(projection.relationships.length)
  })

  it('is deterministic for the same input', () => {
    const first = projectSequenceDiagram(sequenceDesign)
    const second = projectSequenceDiagram(sequenceDesign)
    expect(second).toEqual(first)
  })
})

// ---------------------------------------------------------------------------
// projectUseCaseDiagram (§9.8 row 5 / §15.1 actors outside, use cases inside)
// ---------------------------------------------------------------------------

function useCaseAnalysisFixture(): UseCaseAnalysis {
  return {
    schemaVersion: '1.0',
    projectId: 'proj-1',
    id: 'analysis-1',
    revision: 'r1',
    status: 'approved',
    workDescription: 'Review DO-178C evidence bundles',
    examples: [],
    prohibitedResults: [],
    actors: [{ id: 'actor.reviewer', text: 'Certification engineer', status: 'confirmed' }],
    useCases: [
      {
        id: 'uc.review-evidence',
        name: 'Review evidence',
        actors: ['actor.reviewer'],
        trigger: 'a bundle is submitted',
        preconditions: [],
        mainFlow: [
          {
            id: 'uc.review-evidence.step.1',
            action: 'the reviewer runs uc.validate-bundle against the submission',
            expectedResult: 'the bundle is validated',
            visibleResult: true,
          },
        ],
        alternatePaths: [
          {
            id: 'uc.review-evidence.alt.1',
            name: 'Incomplete bundle',
            kind: 'alternate',
            steps: [
              {
                id: 'uc.review-evidence.alt.1.step.1',
                action: 'the reviewer triggers uc.request-more-evidence',
                expectedResult: 'the submitter is notified',
                visibleResult: true,
              },
            ],
          },
        ],
        failurePaths: [],
        recoveryBehavior: '',
        rules: [],
        inputs: [],
        outputs: [],
        acceptanceChecks: [],
        sourceLinks: [],
        scenarios: [],
      },
      {
        id: 'uc.validate-bundle',
        name: 'Validate bundle',
        actors: ['actor.reviewer'],
        trigger: '',
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
        scenarios: [],
      },
      {
        id: 'uc.request-more-evidence',
        name: 'Request more evidence',
        actors: ['actor.reviewer'],
        trigger: '',
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
        scenarios: [],
      },
    ],
    rules: [],
    qualityNeeds: [],
    sources: [],
    questions: [],
    gates: [],
    contentHash: 'analysis-hash',
  }
}

describe('EUC-08 projectUseCaseDiagram', () => {
  const analysis = useCaseAnalysisFixture()
  const useCaseDesign = moduleDesignFixture({
    id: 'design.mod.workflow',
    moduleId: 'mod.workflow',
    name: 'Review workflow',
    useCaseIds: ['uc.review-evidence'],
  })

  it('places actors outside the boundary, use cases inside it, and labels include/extend relationships', () => {
    const projection = projectUseCaseDiagram({ design: useCaseDesign, analysis })
    expect(projection.diagnostics).toEqual([])

    const boundary = projection.elements.find((element) => element.kind === 'systemBoundary')
    expect(boundary).toBeDefined()
    expect(projection.elements.filter((element) => element.kind === 'actor')).toHaveLength(1)
    // The referenced use cases (via the include/extend heuristic) are added even though only
    // `uc.review-evidence` was directly selected by the module design's trace.
    expect(projection.elements.filter((element) => element.kind === 'useCase')).toHaveLength(3)

    const include = projection.relationships.find((rel) => rel.kind === 'include')
    expect(include?.label).toBe('«include»')
    const extend = projection.relationships.find((rel) => rel.kind === 'extend')
    expect(extend?.label).toBe('«extend»')

    for (const rel of projection.relationships) {
      expect(projection.elements.some((element) => element.id === rel.fromId)).toBe(true)
      expect(projection.elements.some((element) => element.id === rel.toId)).toBe(true)
    }
    expect(projection.textAlternative).toHaveLength(projection.relationships.length)
  })

  it('every selectable element carries a sourceRecordId that opens its canonical source', () => {
    const projection = projectUseCaseDiagram({ design: useCaseDesign, analysis })
    for (const element of projection.elements) expect(element.sourceRecordId).toBeTruthy()
    const useCaseElement = projection.elements.find((element) => element.kind === 'useCase')
    expect(useCaseElement?.sourceRecordId).toBe(analysis.id)
  })

  it('is deterministic for the same input', () => {
    const first = projectUseCaseDiagram({ design: useCaseDesign, analysis })
    const second = projectUseCaseDiagram({ design: useCaseDesign, analysis })
    expect(second).toEqual(first)
  })
})

// ---------------------------------------------------------------------------
// validateUmlProjection (§15.1 semantic validation, §9.9 checks)
// ---------------------------------------------------------------------------

function element(id: string, kind: UmlElement['kind'], label = id): UmlElement {
  return { id, kind, label, sourceRecordId: 'src-1', umlType: kind }
}

function relationship(id: string, kind: UmlRelationship['kind'], fromId: string, toId: string, extra: Partial<UmlRelationship> = {}): UmlRelationship {
  return { id, kind, fromId, toId, sourceRecordId: 'src-1', ...extra }
}

describe('EUC-08 validateUmlProjection', () => {
  it('flags a state transition with no trigger', () => {
    const diagnostics = validateUmlProjection({
      diagramId: 'diagram-1',
      kind: 'stateMachine',
      elements: [element('s.a', 'state'), element('s.b', 'state')],
      relationships: [relationship('t1', 'transition', 's.a', 's.b', { trigger: '' })],
    })
    expect(diagnostics.some((d) => d.code === 'DIAGRAM-TRANSITION-NO-TRIGGER')).toBe(true)
  })

  it('flags a decision outgoing edge with no guard', () => {
    const diagnostics = validateUmlProjection({
      diagramId: 'diagram-1',
      kind: 'activity',
      elements: [element('d.1', 'decision'), element('a.1', 'action'), element('i.1', 'initialNode'), element('f.1', 'finalNode')],
      relationships: [relationship('e1', 'controlFlow', 'd.1', 'a.1')],
    })
    expect(diagnostics.some((d) => d.code === 'DIAGRAM-DECISION-NO-GUARD')).toBe(true)
  })

  it('flags a reply with no matching preceding call', () => {
    const diagnostics = validateUmlProjection({
      diagramId: 'diagram-1',
      kind: 'sequence',
      elements: [element('l.a', 'lifeline'), element('l.b', 'lifeline')],
      relationships: [relationship('r1', 'reply', 'l.b', 'l.a')],
    })
    expect(diagnostics.some((d) => d.code === 'DIAGRAM-REPLY-WITHOUT-CALL')).toBe(true)
  })

  it('accepts a reply that follows a call between the same lifelines', () => {
    const diagnostics = validateUmlProjection({
      diagramId: 'diagram-1',
      kind: 'sequence',
      elements: [element('l.a', 'lifeline'), element('l.b', 'lifeline')],
      relationships: [relationship('m1', 'message', 'l.a', 'l.b'), relationship('r1', 'reply', 'l.b', 'l.a')],
    })
    expect(diagnostics.some((d) => d.code === 'DIAGRAM-REPLY-WITHOUT-CALL')).toBe(false)
  })

  it('flags an actor placed inside the use-case system boundary', () => {
    const diagnostics = validateUmlProjection({
      diagramId: 'diagram-1',
      kind: 'useCase',
      elements: [element('boundary', 'systemBoundary'), element('actor.1', 'actor')],
      relationships: [relationship('contains.actor.1', 'association', 'boundary', 'actor.1')],
    })
    expect(diagnostics.some((d) => d.code === 'DIAGRAM-ACTOR-INSIDE-BOUNDARY')).toBe(true)
  })

  it('flags a dangling relationship endpoint', () => {
    const diagnostics = validateUmlProjection({
      diagramId: 'diagram-1',
      kind: 'component',
      elements: [element('c.1', 'component')],
      relationships: [relationship('r1', 'dependency', 'c.1', 'c.missing')],
    })
    expect(diagnostics.some((d) => d.code === 'DIAGRAM-DANGLING-ENDPOINT')).toBe(true)
  })

  it('flags an unknown element and relationship kind', () => {
    const diagnostics = validateUmlProjection({
      diagramId: 'diagram-1',
      kind: 'component',
      elements: [{ ...element('c.1', 'component'), kind: 'bogus' as unknown as UmlElement['kind'] }],
      relationships: [{ ...relationship('r1', 'dependency', 'c.1', 'c.1'), kind: 'bogus' as unknown as UmlRelationship['kind'] }],
    })
    expect(diagnostics.some((d) => d.code === 'DIAGRAM-UNKNOWN-ELEMENT-KIND')).toBe(true)
    expect(diagnostics.some((d) => d.code === 'DIAGRAM-UNKNOWN-RELATIONSHIP-KIND')).toBe(true)
  })

  it('requires exactly one initial node and at least one final node for an activity diagram', () => {
    const diagnostics = validateUmlProjection({
      diagramId: 'diagram-1',
      kind: 'activity',
      elements: [element('a.1', 'action')],
      relationships: [],
    })
    expect(diagnostics.some((d) => d.code === 'DIAGRAM-ACTIVITY-INITIAL-COUNT')).toBe(true)
    expect(diagnostics.some((d) => d.code === 'DIAGRAM-ACTIVITY-FINAL-MISSING')).toBe(true)
  })
})
