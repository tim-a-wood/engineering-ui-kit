/**
 * EUC-09 — Diagram layout adapter.
 * Acceptance (SPECIFICATION.md §25.3 EUC-08/09):
 *  - the renderer never hides a relationship to make a layout pass;
 *  - the same record and viewport class produce a stable layout.
 * Also covers §15.2 layout quality: no node overlap, minimum clearance,
 * crossing threshold, and labels that do not cover node boxes.
 */
import { describe, expect, it } from 'vitest'
import {
  accessibleDescription,
  analyzeLayoutQuality,
  checkLayout,
  layoutDiagram,
} from '../../../src/capabilities/design/diagramLayout.js'
import { buildSampleAuditHub } from '../../../src/capabilities/design/sampleAuditHub.js'
import {
  projectActivityDiagram,
  projectComponentDiagram,
  projectSequenceDiagram,
  projectStateMachineDiagram,
  projectUseCaseDiagram,
} from '../../../src/capabilities/design/diagramSemantics.js'
import type { DiagramLayout, DiagramProjection, ModuleDesignSpecification, UseCaseAnalysis } from '../../../src/capabilities/design/records.js'
import type { ArchitectureSpecification } from '../../../src/capabilities/types.js'

// ---------------------------------------------------------------------------
// Fixtures (mirrors euc08's fixture shape; kept self-contained per packet)
// ---------------------------------------------------------------------------

function architectureFixture(moduleCount: 4 | 6 = 4): ArchitectureSpecification {
  const baseModules = [
    { moduleId: 'mod.domain', name: 'Evidence domain', moduleType: 'domain' as const, responsibility: 'Own evidence rules' },
    { moduleId: 'mod.workflow', name: 'Review workflow', moduleType: 'workflow' as const, responsibility: 'Orchestrate evidence review' },
    { moduleId: 'mod.experience', name: 'Review screen', moduleType: 'experience' as const, responsibility: 'Render the review screen' },
    { moduleId: 'mod.connection', name: 'Bundle importer', moduleType: 'connection' as const, responsibility: 'Import evidence bundles' },
    { moduleId: 'mod.platform', name: 'Evidence store', moduleType: 'platform' as const, responsibility: 'Persist evidence bundles' },
    { moduleId: 'mod.audit', name: 'Audit trail', moduleType: 'domain' as const, responsibility: 'Record audit events' },
  ]
  const moduleDefinitions = baseModules.slice(0, moduleCount)
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
    moduleIds: moduleDefinitions.map((m) => m.moduleId),
    moduleDefinitions,
    dependencyEdges: [
      { fromModuleId: 'mod.workflow', toModuleId: 'mod.domain', reason: 'uses domain rules' },
      { fromModuleId: 'mod.workflow', toModuleId: 'mod.connection', reason: 'imports bundles' },
      { fromModuleId: 'mod.workflow', toModuleId: 'mod.platform', reason: 'persists results' },
      { fromModuleId: 'mod.experience', toModuleId: 'mod.workflow', reason: 'invokes the review workflow' },
      { fromModuleId: 'mod.audit', toModuleId: 'mod.workflow', reason: 'observes workflow events' },
    ],
    operationAllocations: [
      { operationId: 'op.calculate', moduleId: 'mod.domain' },
      { operationId: 'op.run', moduleId: 'mod.workflow' },
    ],
    adapterAllocations: [],
    workflowTraces: [{ useCaseId: 'uc.review-evidence', moduleIds: moduleDefinitions.map((m) => m.moduleId) }],
    proposals: [],
    unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
    contentHash: 'arch-hash',
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

function crowdedComponentProjection(): DiagramProjection {
  const architecture = architectureFixture(6)
  const design = moduleDesignFixture({
    id: 'design.mod.workflow',
    moduleId: 'mod.workflow',
    name: 'Review workflow',
    directDependencyIds: ['mod.domain', 'mod.connection', 'mod.platform'],
    directConsumerIds: ['mod.experience', 'mod.audit'],
    providedOperations: [{ operationId: 'op.run', version: '1.0.0' }],
    requiredOperations: [{ operationId: 'op.calculate', acceptedVersionRange: '^1.0.0', reason: 'domain calc' }],
  })
  return projectComponentDiagram({ design, architecture })
}

function activityProjection(): DiagramProjection {
  const design = moduleDesignFixture({
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
  return projectActivityDiagram(design)
}

function stateMachineProjectionWithLoop(): DiagramProjection {
  const design = moduleDesignFixture({
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
  return projectStateMachineDiagram(design)
}

function sequenceProjection(): DiagramProjection {
  const design = moduleDesignFixture({
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
        fragments: [{ id: 'frag.alt', operator: 'alt', operands: [{ id: 'op.complete', guard: 'complete' }] }],
        messages: [
          { id: 'm1', from: 'reviewer', to: 'ui', label: 'click approve', kind: 'call' },
          { id: 'm2', from: 'ui', to: 'svc', label: 'approve(id)', kind: 'call' },
          { id: 'm3', from: 'svc', to: 'ui', label: 'result', kind: 'reply' },
          { id: 'm4', from: 'ui', to: 'reviewer', label: 'show result', kind: 'reply' },
        ],
      },
    ],
  })
  return projectSequenceDiagram(design)
}

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
    actors: [
      { id: 'actor.reviewer', text: 'Certification engineer', status: 'confirmed' },
      { id: 'actor.submitter', text: 'Evidence submitter', status: 'confirmed' },
      { id: 'actor.auditor', text: 'Independent auditor', status: 'confirmed' },
    ],
    useCases: [
      {
        id: 'uc.review-evidence',
        name: 'Review evidence',
        actors: ['actor.reviewer', 'actor.auditor'],
        trigger: 'a bundle is submitted',
        preconditions: [],
        mainFlow: [
          { id: 'uc.review-evidence.step.1', action: 'the reviewer runs uc.validate-bundle', expectedResult: 'the bundle is validated', visibleResult: true },
        ],
        alternatePaths: [
          {
            id: 'uc.review-evidence.alt.1',
            name: 'Incomplete bundle',
            kind: 'alternate',
            steps: [
              { id: 'uc.review-evidence.alt.1.step.1', action: 'the reviewer triggers uc.request-more-evidence', expectedResult: 'notified', visibleResult: true },
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
        actors: ['actor.submitter'],
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

function useCaseProjection(): DiagramProjection {
  const analysis = useCaseAnalysisFixture()
  const design = moduleDesignFixture({
    id: 'design.mod.workflow',
    moduleId: 'mod.workflow',
    name: 'Review workflow',
    useCaseIds: ['uc.review-evidence'],
  })
  return projectUseCaseDiagram({ design, analysis })
}

// ---------------------------------------------------------------------------
// determinism
// ---------------------------------------------------------------------------

describe('EUC-09 layoutDiagram — determinism', () => {
  const cases: [string, () => DiagramProjection][] = [
    ['component', crowdedComponentProjection],
    ['activity', activityProjection],
    ['stateMachine', stateMachineProjectionWithLoop],
    ['sequence', sequenceProjection],
    ['useCase', useCaseProjection],
  ]

  for (const [name, buildProjection] of cases) {
    it(`produces an identical layout for the same ${name} record and viewport class`, () => {
      const projection = buildProjection()
      const first = layoutDiagram(projection, 'wide')
      const second = layoutDiagram(projection, 'wide')
      expect(second).toEqual(first)
      expect(second.contentHash).toBe(first.contentHash)
      expect(second.seed).toBe(first.seed)
    })

    it(`produces a different seed for ${name} across viewport classes but stays deterministic within one`, () => {
      const projection = buildProjection()
      const wide = layoutDiagram(projection, 'wide')
      const narrow = layoutDiagram(projection, 'narrow')
      expect(wide.seed).not.toBe(narrow.seed)
      expect(layoutDiagram(projection, 'narrow')).toEqual(narrow)
    })
  }
})

// ---------------------------------------------------------------------------
// never drop a relationship
// ---------------------------------------------------------------------------

describe('EUC-09 layoutDiagram — never hides a relationship', () => {
  const cases: [string, () => DiagramProjection][] = [
    ['component', crowdedComponentProjection],
    ['activity', activityProjection],
    ['stateMachine', stateMachineProjectionWithLoop],
    ['sequence', sequenceProjection],
    ['useCase', useCaseProjection],
  ]

  for (const [name, buildProjection] of cases) {
    it(`keeps one edge per relationship for the ${name} diagram, even under a very low crossing threshold`, () => {
      const projection = buildProjection()
      const layout = layoutDiagram(projection, 'wide', { crossingThreshold: 0 })
      expect(layout.edges).toHaveLength(projection.relationships.length)
      expect(layout.edges.map((edge) => edge.relationshipId).sort()).toEqual(projection.relationships.map((rel) => rel.id).sort())
      expect(layout.diagnostics.some((d) => d.code === 'LAYOUT-RELATIONSHIP-COUNT-MISMATCH')).toBe(false)
    })
  }
})

// ---------------------------------------------------------------------------
// collision, clearance, crossing, and label quality (§15.2)
// ---------------------------------------------------------------------------

describe('EUC-09 layoutDiagram — layout quality', () => {
  it('keeps long semantic element and relationship identities distinct', () => {
    const sample = buildSampleAuditHub()
    for (const projection of sample.diagrams) {
      expect(new Set(projection.elements.map((element) => element.id)).size, `${projection.diagramId} element IDs`).toBe(projection.elements.length)
      expect(new Set(projection.relationships.map((relationship) => relationship.id)).size, `${projection.diagramId} relationship IDs`).toBe(projection.relationships.length)
    }
  })

  it('keeps the dense Package Export sample clear of ports and below the crossing threshold', () => {
    const sample = buildSampleAuditHub()
    const design = sample.moduleDesigns.find((candidate) => candidate.module.name === 'Package Export')!
    const projection = projectComponentDiagram({
      design,
      architecture: sample.architecture,
      allDesigns: sample.moduleDesigns,
    })
    const layout = layoutDiagram(projection, 'wide', { nodeWidth: 180, nodeHeight: 68 })

    expect(layout.diagnostics).toEqual([])
    expect(layout.crossingCount).toBeLessThanOrEqual(8)
  })

  it('keeps every bundled sample projection free of layout diagnostics', () => {
    const sample = buildSampleAuditHub()
    for (const projection of sample.diagrams) {
      expect(layoutDiagram(projection, 'wide').diagnostics, `${projection.diagramId} wide`).toEqual([])
      expect(layoutDiagram(projection, 'narrow').diagnostics, `${projection.diagramId} narrow`).toEqual([])
    }
  })

  it('uses straight interface connectors and only necessary bends in the Finding Review component diagram', () => {
    const sample = buildSampleAuditHub()
    const findingReview = sample.approvedModuleDesigns['mod.finding-review']!
    const projection = sample.diagrams.find((candidate) =>
      candidate.kind === 'component' && candidate.sourceRecordId === findingReview.id)!
    const layout = layoutDiagram(projection, 'wide', { nodeWidth: 180, nodeHeight: 68 })
    const edgeById = new Map(layout.edges.map((edge) => [edge.relationshipId, edge]))
    const interfaceRelationships = projection.relationships.filter((relationship) =>
      relationship.kind === 'provides' || relationship.kind === 'requires')

    for (const relationship of interfaceRelationships) {
      const route = edgeById.get(relationship.id)!.points
      expect(route, relationship.id).toHaveLength(2)
      expect(route[0]!.y, relationship.id).toBe(route[1]!.y)
    }

    const quality = analyzeLayoutQuality(layout, projection)
    expect(quality.crossingCount).toBe(0)
    expect(quality.overlappingEdgePairs).toBe(0)
    expect(quality.edgeNodeClearanceViolations).toBe(0)
    expect(quality.labelNodeOverlaps).toBe(0)
    expect(quality.labelLabelOverlaps).toBe(0)
    expect(quality.bendCount).toBeLessThanOrEqual(4)
    expect(quality.totalEdgeLength).toBeLessThanOrEqual(1200)
  })

  it('keeps every actor association on a distinct attachment and routing corridor', () => {
    const sample = buildSampleAuditHub()
    const evidenceStore = sample.moduleDesigns.find((candidate) => candidate.module.name === 'Evidence Store')!
    const projections = [
      ...sample.diagrams.filter((candidate) => candidate.kind === 'useCase'),
      projectUseCaseDiagram({ design: evidenceStore, analysis: sample.useCaseAnalysis }),
    ]
    for (const projection of projections) {
      const layout = layoutDiagram(projection, 'wide')
      const kindById = new Map(projection.elements.map((element) => [element.id, element.kind]))
      const edgeById = new Map(layout.edges.map((edge) => [edge.relationshipId, edge]))
      const actorAssociations = projection.relationships.filter(
        (relationship) => kindById.get(relationship.fromId) === 'actor' || kindById.get(relationship.toId) === 'actor',
      )
      const channelCoordinates: number[] = []
      const attachmentCoordinatesByActor = new Map<string, string[]>()

      for (const relationship of actorAssociations) {
        const edge = edgeById.get(relationship.id)!
        const fromActor = kindById.get(relationship.fromId) === 'actor'
        const actorId = fromActor ? relationship.fromId : relationship.toId
        const attachment = fromActor ? edge.points[0]! : edge.points.at(-1)!
        const channel = fromActor ? edge.points[1]! : edge.points.at(-2)!
        channelCoordinates.push(channel.x)
        const actorAttachments = attachmentCoordinatesByActor.get(actorId) ?? []
        actorAttachments.push(`${attachment.x}:${attachment.y}`)
        attachmentCoordinatesByActor.set(actorId, actorAttachments)
      }

      expect(new Set(channelCoordinates).size, `${projection.diagramId} association corridors`).toBe(channelCoordinates.length)
      expect(layout.crossingCount, `${projection.diagramId} association crossings`).toBe(0)
      for (const [actorId, attachments] of attachmentCoordinatesByActor) {
        expect(new Set(attachments).size, `${projection.diagramId} ${actorId} attachments`).toBe(attachments.length)
      }
    }
  })

  it('never overlaps two nodes in a crowded component diagram', () => {
    const projection = crowdedComponentProjection()
    const layout = layoutDiagram(projection, 'wide')
    expect(layout.diagnostics.filter((d) => d.code === 'LAYOUT-NODE-OVERLAP')).toEqual([])
  })

  it('keeps a two-component boundary compact', () => {
    const architecture = architectureFixture(4)
    const design = moduleDesignFixture({
      id: 'design.mod.experience',
      moduleId: 'mod.experience',
      name: 'Review screen',
      directDependencyIds: ['mod.workflow'],
    })
    const projection = projectComponentDiagram({ design, architecture })
    const layout = layoutDiagram(projection, 'wide')
    const minY = Math.min(...layout.nodes.map((node) => node.y))
    const maxY = Math.max(...layout.nodes.map((node) => node.y + node.height))
    expect(maxY - minY).toBeLessThanOrEqual(280)
    expect(layout.diagnostics).toEqual([])
  })

  it('respects the configured clearance between edges and unrelated nodes in a crowded component diagram', () => {
    const projection = crowdedComponentProjection()
    const layout = layoutDiagram(projection, 'wide')
    expect(layout.diagnostics.filter((d) => d.code === 'LAYOUT-EDGE-CLEARANCE')).toEqual([])
  })

  it('respects clearance for a state machine with a backward (loop) transition', () => {
    const projection = stateMachineProjectionWithLoop()
    const layout = layoutDiagram(projection, 'wide')
    expect(layout.diagnostics.filter((d) => d.code === 'LAYOUT-EDGE-CLEARANCE')).toEqual([])
    expect(layout.diagnostics.filter((d) => d.code === 'LAYOUT-NODE-OVERLAP')).toEqual([])
  })

  it('respects clearance and avoids overlap for a use-case diagram with include/extend relationships', () => {
    const projection = useCaseProjection()
    const layout = layoutDiagram(projection, 'wide')
    expect(layout.diagnostics.filter((d) => d.code === 'LAYOUT-EDGE-CLEARANCE')).toEqual([])
    expect(layout.diagnostics.filter((d) => d.code === 'LAYOUT-NODE-OVERLAP')).toEqual([])
  })

  it('does not place a label on top of a node box', () => {
    const projection = stateMachineProjectionWithLoop()
    const layout = layoutDiagram(projection, 'wide')
    expect(layout.diagnostics.filter((d) => d.code === 'LAYOUT-LABEL-OVERLAP')).toEqual([])
  })

  it('reports the crossing count and produces a non-blocking diagnostic once the configured threshold is exceeded', () => {
    const projection = crowdedComponentProjection()
    const permissive = layoutDiagram(projection, 'wide', { crossingThreshold: 1000 })
    expect(permissive.crossingCount).toBeGreaterThanOrEqual(0)
    expect(permissive.diagnostics.some((d) => d.code === 'LAYOUT-CROSSING-THRESHOLD')).toBe(false)

    const strict = layoutDiagram(projection, 'wide', { crossingThreshold: -1 })
    expect(strict.crossingCount).toBe(permissive.crossingCount)
    // Any non-negative crossing count exceeds a threshold of -1.
    expect(strict.diagnostics.some((d) => d.code === 'LAYOUT-CROSSING-THRESHOLD')).toBe(true)
    // A crossing-threshold diagnostic never removes a relationship.
    expect(strict.edges).toHaveLength(projection.relationships.length)
  })

  it('never shrinks a node below the configured minimum size on a narrow viewport', () => {
    const projection = crowdedComponentProjection()
    const layout = layoutDiagram(projection, 'narrow', { nodeWidth: 10, nodeHeight: 10, minNodeWidth: 90, minNodeHeight: 30 })
    for (const node of layout.nodes) {
      expect(node.width).toBeGreaterThanOrEqual(90)
      expect(node.height).toBeGreaterThanOrEqual(30)
    }
  })
})

// ---------------------------------------------------------------------------
// checkLayout as a standalone verifier
// ---------------------------------------------------------------------------

describe('EUC-09 checkLayout', () => {
  it('flags a hand-built layout with two overlapping nodes', () => {
    const projection = crowdedComponentProjection()
    const layout = layoutDiagram(projection, 'wide')
    const overlapping: DiagramLayout = {
      ...layout,
      nodes: layout.nodes.map((node, index) => (index === 1 ? { ...node, x: layout.nodes[0]!.x, y: layout.nodes[0]!.y } : node)),
    }
    const diagnostics = checkLayout(overlapping, projection)
    expect(diagnostics.some((d) => d.code === 'LAYOUT-NODE-OVERLAP')).toBe(true)
  })

  it('flags a hand-built layout where an edge passes through an unrelated node', () => {
    const projection = crowdedComponentProjection()
    const layout = layoutDiagram(projection, 'wide')
    const firstRelationship = projection.relationships.find((relationship) => relationship.id === layout.edges[0]?.relationshipId)!
    const targetNode = layout.nodes.find((node) => node.elementId !== firstRelationship.fromId && node.elementId !== firstRelationship.toId)!
    const clipped: DiagramLayout = {
      ...layout,
      edges: layout.edges.map((edge, index) =>
        index === 0 ? { ...edge, points: [{ x: targetNode.x + targetNode.width / 2, y: targetNode.y + targetNode.height / 2 }, { x: targetNode.x + targetNode.width / 2, y: targetNode.y + targetNode.height / 2 + 1 }] } : edge,
      ),
    }
    const diagnostics = checkLayout(clipped, projection, { clearance: 5 })
    expect(diagnostics.some((d) => d.code === 'LAYOUT-EDGE-CLEARANCE')).toBe(true)
  })

  it('flags a layout that dropped a relationship', () => {
    const projection = crowdedComponentProjection()
    const layout = layoutDiagram(projection, 'wide')
    const dropped: DiagramLayout = { ...layout, edges: layout.edges.slice(1) }
    const diagnostics = checkLayout(dropped, projection)
    expect(diagnostics.some((d) => d.code === 'LAYOUT-RELATIONSHIP-COUNT-MISMATCH')).toBe(true)
  })

  it('flags a label placed on top of a node box', () => {
    const projection = crowdedComponentProjection()
    const layout = layoutDiagram(projection, 'wide')
    const node = layout.nodes[0]!
    const withBadLabel: DiagramLayout = {
      ...layout,
      edges: layout.edges.map((edge, index) => (index === 0 ? { ...edge, labelPosition: { x: node.x + node.width / 2, y: node.y + node.height / 2 } } : edge)),
    }
    const diagnostics = checkLayout(withBadLabel, projection)
    expect(diagnostics.some((d) => d.code === 'LAYOUT-LABEL-OVERLAP')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// accessibleDescription
// ---------------------------------------------------------------------------

describe('EUC-09 accessibleDescription', () => {
  it('merges the reading order with the text alternative relationship list', () => {
    const projection = stateMachineProjectionWithLoop()
    const layout = layoutDiagram(projection, 'wide')
    const description = accessibleDescription(layout, projection)
    expect(description).toContain('Reading order:')
    for (const line of projection.textAlternative) expect(description).toContain(line)
  })
})
