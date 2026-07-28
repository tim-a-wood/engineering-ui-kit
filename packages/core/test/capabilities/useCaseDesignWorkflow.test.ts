import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  CapabilityWorkspace,
  compileScenarioDefinitions,
  createModuleDesignDraft,
  createModuleDesignSession,
  createScenarioRun,
  evaluateProductGate,
  evaluateUseCaseAnalysis,
  evaluateArchitectureProposal,
  finalizeScenarioRun,
  migrateLegacyUseCaseToWorkflow,
  projectUseCaseDiagram,
  projectModuleDiagrams,
  recordScenarioStep,
  summarizeScenarioRuns,
  type ApplicationSpecification,
  type ArchitectureSpecification,
  type ModuleManifest,
} from '../../src/capabilities/index.js'

const temporaryRoots: string[] = []
afterEach(() => {
  for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

function application(): ApplicationSpecification {
  const value: ApplicationSpecification = {
    schemaVersion: '1.0',
    projectId: 'project-1',
    id: 'application-1',
    revision: '2',
    status: 'approved',
    purpose: 'Review evidence',
    outcomes: ['A reviewer sees current evidence.'],
    actors: [{ id: 'reviewer', text: 'Reviewer' }],
    goals: [{ id: 'review', text: 'Review evidence safely' }],
    useCases: [{ id: 'uc-review', text: 'Review evidence' }],
    scenarios: [],
    useCaseDefinitions: [{
      id: 'uc-review',
      name: 'Review evidence',
      actorIds: ['reviewer'],
      trigger: 'The reviewer opens an approved baseline.',
      preconditions: ['An approved baseline exists.'],
      mainFlow: [
        {
          id: 'uc-review:step:open',
          order: 1,
          actorId: 'reviewer',
          action: 'Open the evidence workspace',
          expectedResult: 'The approved baseline is visible.',
          inputIds: ['baseline'],
          outputIds: ['workspace'],
          ruleIds: ['rule-approved-only'],
          evidencePolicy: 'screenshot',
        },
        {
          id: 'uc-review:step:check',
          order: 2,
          actorId: 'reviewer',
          action: 'Check the baseline revision',
          expectedResult: 'The revision matches the approved source.',
          inputIds: ['workspace'],
          outputIds: ['revision-check'],
          ruleIds: ['rule-approved-only'],
          evidencePolicy: 'structured',
        },
      ],
      alternatePaths: [],
      failurePaths: [],
      recoveryPaths: [],
      ruleIds: ['rule-approved-only'],
      inputIds: ['baseline'],
      outputIds: ['workspace', 'revision-check'],
      acceptanceCaseIds: ['accept-review'],
      sourceRefs: ['source:requirements'],
    }],
    information: [],
    rules: [{ id: 'rule-approved-only', text: 'Only approved baselines are reviewable.' }],
    externalSystems: [],
    constraints: [],
    scope: { inScope: ['Evidence review'], outOfScope: [] },
    acceptanceCases: [{
      id: 'accept-review',
      description: 'Open approved evidence',
      expectedOutcome: 'Evidence and revision are visible',
    }],
    sources: [{ id: 'source:requirements', text: 'Requirements' }],
    unresolvedQuestions: [],
    contentHash: 'application-hash',
  }
  value.applicationWorkflows = [
    migrateLegacyUseCaseToWorkflow(value.useCaseDefinitions![0]!).workflow,
  ]
  return value
}

function architecture(): ArchitectureSpecification {
  return {
    schemaVersion: '1.0',
    projectId: 'project-1',
    id: 'architecture-1',
    revision: '3',
    status: 'approved',
    applicationSpecId: 'application-1',
    applicationSpecRevision: '2',
    applicationSpecHash: 'application-hash',
    capabilityProjections: [{ id: 'evidence', name: 'Evidence review', moduleIds: ['mod.ui'] }],
    moduleIds: ['mod.ui'],
    moduleDefinitions: [{
      moduleId: 'mod.ui',
      name: 'Evidence workspace',
      moduleType: 'experience',
      responsibility: 'Present approved evidence.',
    }],
    dependencyEdges: [],
    operationAllocations: [],
    adapterAllocations: [],
    workflowTraces: [{
      useCaseId: 'uc-review',
      moduleIds: ['mod.ui'],
      entryPointId: 'route:evidence',
      outputId: 'workspace',
      nodeAllocations: [
        {
          workflowId: 'workflow:uc-review',
          nodeId: 'workflow:uc-review:action:uc-review:step:open',
          primaryModuleId: 'mod.ui',
          participatingModuleIds: [],
          entryPointId: 'route:evidence',
        },
        {
          workflowId: 'workflow:uc-review',
          nodeId: 'workflow:uc-review:action:uc-review:step:check',
          primaryModuleId: 'mod.ui',
          participatingModuleIds: [],
          entryPointId: 'route:evidence',
        },
      ],
      stepAllocations: [
        { stepId: 'uc-review:step:open', moduleId: 'mod.ui' },
        { stepId: 'uc-review:step:check', moduleId: 'mod.ui' },
      ],
    }],
    proposals: [],
    unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
    contentHash: 'architecture-hash',
  }
}

function manifest(): ModuleManifest {
  return {
    schemaVersion: '1.0',
    architectureVersion: '1.0',
    moduleId: 'mod.ui',
    moduleVersion: '1.0.0',
    moduleType: 'experience',
    name: 'Evidence workspace',
    responsibility: 'Present approved evidence.',
    ownedConcerns: ['Evidence presentation'],
    excludedConcerns: ['Evidence approval rules'],
    providedOperations: [],
    requiredOperations: [],
    verificationSuiteIds: ['suite.ui'],
    runtimeAllocation: 'local-embedded',
    events: [],
    ownedPaths: ['apps/evidence'],
  }
}

describe('polished workflow canonical integration', () => {
  it('validates detailed use cases and compiles stable scenarios', () => {
    const app = application()
    expect(evaluateUseCaseAnalysis(app)).toEqual({ passed: true, diagnostics: [] })
    expect(compileScenarioDefinitions(app)).toEqual([
      expect.objectContaining({
        id: 'uc-review:scenario:main',
        useCaseId: 'uc-review',
        stepIds: ['uc-review:step:open', 'uc-review:step:check'],
        requiredEvidence: 'either',
      }),
    ])
  })

  it('keeps use cases in Plan and creates only module-owned UML projections', () => {
    const design = createModuleDesignDraft({
      application: application(),
      architecture: architecture(),
      manifest: manifest(),
    })
    expect(design.trace.useCaseIds).toEqual(['uc-review'])
    expect(design.trace.scenarioStepIds).toEqual(['uc-review:step:open', 'uc-review:step:check'])
    expect(design.diagrams.map((item) => item.kind)).toEqual([
      'component',
      'activity',
      'state-machine',
      'sequence',
    ])
    expect(design.diagrams.every((item) => item.level === 'module')).toBe(true)
    expect(design.diagrams.find((item) => item.kind === 'activity')?.diagnostics).toEqual([
      expect.objectContaining({ code: 'CAP-UML-MODULE-ACTIVITY-REQUIRED' }),
    ])
    expect(projectUseCaseDiagram(application()).nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'system-boundary', label: 'Application 1' }),
        expect.objectContaining({ kind: 'actor', label: 'Reviewer' }),
      ]),
    )
  })

  it('blocks compound workflow labels at the gate and persistence boundary', () => {
    const app = application()
    app.useCases[0]!.text = 'Review and approve every open evidence finding'
    app.useCaseDefinitions![0]!.name = 'Review and approve every open evidence finding'
    app.useCaseDefinitions![0]!.mainFlow[0]!.action = 'Open the workspace and inspect the approved evidence'

    const gate = evaluateProductGate(app)
    expect(gate.passed).toBe(false)
    expect(gate.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'STE-LABEL-LENGTH' }),
      expect.objectContaining({ code: 'STE-LABEL-ONE-ACTION' }),
    ]))

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-ste-persistence-'))
    temporaryRoots.push(root)
    const workspace = new CapabilityWorkspace(root)
    expect(() => workspace.approveApplication('project-1', {
      ...app,
      status: 'draft',
    })).toThrow(/STE check failed/)
  })

  it('blocks module-design readiness when the project vocabulary prohibits an alias', () => {
    const candidateManifest = manifest()
    candidateManifest.name = 'Defect workspace'
    candidateManifest.responsibility = 'Present defect evidence.'

    const design = createModuleDesignDraft({
      application: application(),
      architecture: architecture(),
      manifest: candidateManifest,
      steLexicon: {
        prohibitedAliases: {
          defect: 'audit finding',
        },
      },
    })

    expect(design.status).toBe('needsInput')
    expect(design.gates).toEqual([
      expect.objectContaining({
        gateId: 'CAP-GATE-MODULE-DESIGN',
        passed: false,
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: 'STE-TERM-PREFERRED',
            message: 'Use the preferred term “audit finding” instead of “defect.”',
          }),
        ]),
      }),
    ])
  })

  it('reprojects UML when application behavior or module structure changes', () => {
    const app = application()
    const arch = architecture()
    const design = createModuleDesignDraft({
      application: app,
      architecture: arch,
      manifest: manifest(),
    })
    const baseline = new Map(design.diagrams.map((projection) => [projection.kind, projection.contentHash]))

    app.useCaseDefinitions[0]!.mainFlow[0]!.action = 'Open signed evidence'
    design.behavior.activityDefinitions = [{
      id: 'activity:review',
      name: 'Review evidence',
      refinesWorkflowNodeIds: [
        'workflow:uc-review:action:uc-review:step:open',
        'workflow:uc-review:action:uc-review:step:check',
      ],
      graph: {
        id: 'activity:review:graph',
        name: 'Review evidence',
        nodes: [
          { id: 'start', kind: 'initial', label: 'Initial', description: 'The activity starts.', refinesIds: [] },
          { id: 'review', kind: 'action', label: 'Review evidence', description: 'The module reviews the evidence.', refinesIds: ['uc-review:step:open', 'uc-review:step:check'] },
          { id: 'end', kind: 'final', label: 'Final', description: 'The activity ends.', refinesIds: [] },
        ],
        edges: [
          { id: 'start-review', fromNodeId: 'start', toNodeId: 'review', traceIds: ['activity:review'] },
          { id: 'review-end', fromNodeId: 'review', toNodeId: 'end', traceIds: ['activity:review'] },
        ],
      },
    }]
    design.behavior.stateDefinitions = [
      { id: 'ready', name: 'Ready', entryActionIds: [], exitActionIds: [] },
      { id: 'reviewing', name: 'Reviewing', entryActionIds: ['review'], exitActionIds: [] },
    ]
    design.behavior.stateTransitions = [{
      id: 'begin',
      fromStateId: 'ready',
      toStateId: 'reviewing',
      trigger: 'Start review',
      effectActivityNodeIds: ['review'],
    }]
    design.requiredOperations = [{
      operationId: 'evidence.read',
      acceptedContractRange: '^1.0.0',
      reason: 'Load the approved evidence baseline.',
    }]
    arch.moduleIds.push('mod.evidence')
    arch.moduleDefinitions!.push({
      moduleId: 'mod.evidence',
      name: 'Evidence store',
      moduleType: 'domain',
      responsibility: 'Own approved evidence.',
    })
    arch.dependencyEdges.push({
      fromModuleId: 'mod.ui',
      toModuleId: 'mod.evidence',
      reason: 'Read approved evidence.',
    })
    arch.operationAllocations.push({
      operationId: 'evidence.read',
      moduleId: 'mod.evidence',
    })

    const refreshed = projectModuleDiagrams({ application: app, architecture: arch, design })
    const byKind = new Map(refreshed.map((projection) => [projection.kind, projection]))

    expect(byKind.get('activity')?.contentHash).not.toBe(baseline.get('activity'))
    expect(byKind.get('state-machine')).toEqual(expect.objectContaining({
      contentHash: expect.not.stringMatching(`^${baseline.get('state-machine')}$`),
      nodes: expect.arrayContaining([
        expect.objectContaining({ id: 'module-state:mod.ui:reviewing', label: 'Reviewing' }),
      ]),
    }))
    expect(byKind.get('component')).toEqual(expect.objectContaining({
      contentHash: expect.not.stringMatching(`^${baseline.get('component')}$`),
      nodes: expect.arrayContaining([
        expect.objectContaining({
          id: 'required:mod.ui:evidence.read',
          parentId: 'component:mod.ui',
          label: 'Read evidence',
        }),
        expect.objectContaining({ id: 'component:mod.evidence', label: 'Evidence store' }),
        expect.objectContaining({
          id: 'provided:mod.evidence:evidence.read:for:mod.ui',
          parentId: 'component:mod.evidence',
          label: 'Read evidence',
        }),
      ]),
      edges: expect.arrayContaining([
        expect.objectContaining({
          kind: 'assembly',
          fromId: 'required:mod.ui:evidence.read',
          toId: 'provided:mod.evidence:evidence.read:for:mod.ui',
          label: 'Read evidence',
        }),
      ]),
    }))
  })

  it('blocks architecture approval when an application action is not allocated', () => {
    const candidate = architecture()
    candidate.workflowTraces[0]!.nodeAllocations = candidate.workflowTraces[0]!.nodeAllocations!.slice(0, 1)
    const evaluation = evaluateArchitectureProposal(application(), {
      architecture: candidate,
      moduleNeedTraces: [{ moduleId: 'mod.ui', needIds: ['uc-review'] }],
    })
    expect(evaluation.passed).toBe(false)
    expect(evaluation.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'CAP-DESIGN-ALLOCATION-MISSING',
        relatedIds: ['workflow:uc-review', 'workflow:uc-review:action:uc-review:step:check'],
      }),
    ]))
  })

  it('does not pass scenario verification without real evidence hashes', () => {
    const app = application()
    let run = createScenarioRun({
      runId: 'scenario-run-1',
      application: app,
      architecture: architecture(),
      moduleDesigns: [],
      scenarioId: 'uc-review:scenario:main',
      build: 'build-1',
      sourceRevision: 'source-1',
      environment: 'test',
      testDataRevision: 'data-1',
      runner: 'vitest',
      startedAt: '2026-01-01T00:00:00.000Z',
    })
    run = recordScenarioStep({
      record: run,
      scenarioStepId: 'uc-review:step:open',
      actualResult: 'The approved baseline is visible.',
      outcome: 'passed',
      evidence: [{ kind: 'screenshot', artifactId: 'screen-open' }],
      evidenceHashes: { 'screen-open': 'hash-screen-open' },
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:00:01.000Z',
    })
    run = recordScenarioStep({
      record: run,
      scenarioStepId: 'uc-review:step:check',
      actualResult: 'The revision matches.',
      outcome: 'passed',
      evidence: [{ kind: 'structured', artifactId: 'revision-check' }],
      evidenceHashes: { 'revision-check': 'hash-revision-check' },
      startedAt: '2026-01-01T00:00:01.000Z',
      completedAt: '2026-01-01T00:00:02.000Z',
    })
    const finalized = finalizeScenarioRun(app, run, '2026-01-01T00:00:02.000Z')
    expect(finalized.diagnostics).toEqual([])
    expect(finalized.record.outcome).toBe('passed')
    expect(summarizeScenarioRuns(app, [finalized.record])).toEqual(
      expect.objectContaining({ passed: 1, screenshotCount: 1, structuredCount: 1 }),
    )
  })

  it('round-trips module designs, sessions, scenario runs, and immutable image evidence', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-polished-workflow-'))
    temporaryRoots.push(root)
    const workspace = new CapabilityWorkspace(root)
    const design = createModuleDesignDraft({
      application: application(),
      architecture: architecture(),
      manifest: manifest(),
    })
    workspace.saveModuleDesignDraft('project-1', design)
    const session = createModuleDesignSession({
      projectId: 'project-1',
      moduleId: 'mod.ui',
      architecture: architecture(),
      now: '2026-01-01T00:00:00.000Z',
    })
    workspace.saveModuleDesignSession('project-1', session)
    const run = createScenarioRun({
      runId: 'scenario-run-1',
      application: application(),
      architecture: architecture(),
      moduleDesigns: [design],
      scenarioId: 'uc-review:scenario:main',
      build: 'build-1',
      sourceRevision: 'source-1',
      environment: 'test',
      testDataRevision: 'data-1',
      runner: 'vitest',
      startedAt: '2026-01-01T00:00:00.000Z',
    })
    workspace.saveScenarioRun('project-1', run)
    const artifact = workspace.saveScenarioEvidence({
      projectId: 'project-1',
      runId: run.runId,
      artifactId: 'screen-open',
      mediaType: 'image/png',
      bytes: new Uint8Array([137, 80, 78, 71]),
      provenanceSource: 'test runner',
    })

    expect(workspace.listModuleDesigns('project-1')[0]).toEqual(
      expect.objectContaining({ moduleId: 'mod.ui', draft: expect.objectContaining({ id: design.id }) }),
    )
    expect(workspace.getActiveModuleDesignSession('project-1', 'mod.ui')?.id).toBe(session.id)
    expect(workspace.listScenarioRuns('project-1')[0]?.runId).toBe(run.runId)
    expect(Array.from(workspace.getScenarioEvidence('project-1', run.runId, artifact.artifactId)?.bytes ?? []))
      .toEqual([137, 80, 78, 71])
  })
})
