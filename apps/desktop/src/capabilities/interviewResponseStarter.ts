import type { InterviewPacket } from '@engineering-ui-kit/core'

function factValue(packet: InterviewPacket, prefix: string): string | undefined {
  return packet.inputContext.facts.find((fact) => fact.startsWith(prefix))?.slice(prefix.length)
}

/** Exact importer-facing starter that is embedded in the interview handoff. */
export function interviewResponseStarter(packet: InterviewPacket): unknown {
  if (packet.outputSchemaRef === 'CAP-CONTRACT-002') {
    const applicationId = packet.inputContext.recordIds[0] ?? 'app.current'
    return {
      architecture: {
        schemaVersion: '1.0', projectId: packet.projectId, id: 'arch.proposed', revision: '1', status: 'proposed',
        applicationSpecId: applicationId,
        applicationSpecRevision: packet.inputContext.revisions[0] ?? '1',
        applicationSpecHash: packet.inputContext.hashes[0] ?? 'pending',
        capabilityProjections: [{ id: 'capability.example', name: 'Replace with a capability', moduleIds: ['mod.example'] }],
        moduleIds: ['mod.example'],
        moduleDefinitions: [{
          moduleId: 'mod.example', name: 'Replace with a clear module name', moduleType: 'domain',
          responsibility: 'Replace with the single responsibility owned by this module',
        }],
        dependencyEdges: [],
        operationAllocations: [], adapterAllocations: [],
        workflowTraces: [{
          useCaseId: 'replace-with-use-case-id',
          moduleIds: ['mod.example'],
          entryPointId: 'replace-with-entry-point-id',
          outputId: 'replace-with-output-id',
          nodeAllocations: [{
            workflowId: 'workflow:replace-with-use-case-id',
            nodeId: 'workflow:replace-with-use-case-id:action:step-1',
            primaryModuleId: 'mod.example',
            participatingModuleIds: [],
            entryPointId: 'replace-with-entry-point-id',
            outputId: 'replace-with-output-id',
          }],
        }],
        proposals: [], unresolvedQuestions: [],
        gateResult: { gateId: 'CAP-GATE-002', passed: false, diagnostics: [] }, contentHash: 'pending',
      },
      moduleNeedTraces: [{ moduleId: 'mod.example', needIds: ['replace-with-use-case-id'] }],
      moduleJustifications: [{ moduleId: 'mod.example', justification: 'distinct-rules' }],
    }
  }

  if (packet.outputSchemaRef === 'CAP-CONTRACT-003') {
    const moduleId = packet.inputContext.recordIds[1] ?? 'mod.example'
    const moduleType = factValue(packet, 'moduleType:') ?? 'domain'
    const moduleVersion = factValue(packet, 'moduleVersion:') ?? '1.0.0'
    return {
      moduleId, moduleType, name: 'Replace with module name', moduleVersion,
      responsibility: 'Replace with one clear responsibility', ownedConcerns: [], excludedConcerns: [],
      providedOperations: [], requiredOperations: [], verificationSuiteIds: [], runtimeAllocation: 'local-embedded',
      events: [], ownedPaths: [`capabilities/modules/${moduleId}/`], configurationSchemaRef: null,
      operationContracts: [], dataSchemas: [],
      behaviorDraft: {
        preconditions: [],
        postconditions: [],
        domainRejections: [],
        technicalFailures: [],
        sideEffects: [],
        idempotency: 'Replace with the idempotency behavior.',
        cancellation: 'Replace with the cancellation behavior.',
        timeouts: 'Replace with the timeout behavior.',
        concurrency: 'Replace with the concurrency behavior.',
        retry: 'Replace with the retry behavior.',
        recovery: 'Replace with the recovery behavior.',
        emittedEvents: [],
        consumedEvents: [],
        activityDefinitions: [{
          id: `activity:${moduleId}:example`,
          name: 'Perform module work',
          refinesWorkflowNodeIds: ['replace-with-allocated-workflow-node-id'],
          graph: {
            id: `activity:${moduleId}:example:graph`,
            name: 'Perform module work',
            nodes: [
              { id: 'start', kind: 'initial', label: 'Initial', description: 'The module activity starts.', refinesIds: [] },
              { id: 'work', kind: 'action', label: 'Perform module work', description: 'Replace with the internal module action.', refinesIds: ['replace-with-allocated-workflow-node-id'] },
              { id: 'end', kind: 'final', label: 'Final', description: 'The module activity ends.', refinesIds: [] },
            ],
            edges: [
              { id: 'start-work', fromNodeId: 'start', toNodeId: 'work', traceIds: [] },
              { id: 'work-end', fromNodeId: 'work', toNodeId: 'end', traceIds: [] },
            ],
          },
        }],
        stateDefinitions: [],
        stateTransitions: [],
        interactionDefinitions: [],
        states: [],
        activities: [],
        interactions: [],
      },
      answers: packet.inputContext.facts.filter((fact) => fact.startsWith('detail:')).map((fact) => ({
        id: fact.slice('detail:'.length), text: 'Replace with a concrete answer', status: 'proposed',
      })),
      acceptanceCases: [{ id: 'ac-1', description: 'Replace with an acceptance case', expectedOutcome: 'Replace with the expected outcome' }],
      rules: [],
    }
  }

  return {
    schemaVersion: '1.0', projectId: packet.projectId, id: 'app.proposed', revision: '1', status: 'proposed',
    purpose: 'Replace with the application purpose', outcomes: ['Replace with a measurable outcome'],
    actors: [{ id: 'actor-1', text: 'Replace with an actor' }],
    goals: [{ id: 'goal-1', text: 'Replace with an actor goal' }],
    useCases: [{ id: 'use-case-1', text: 'Replace with a complete use case' }], scenarios: [],
    useCaseDefinitions: [{
      id: 'use-case-1',
      name: 'Replace with a complete use case',
      actorIds: ['actor-1'],
      trigger: 'Replace with the event that starts this use case',
      preconditions: [],
      mainFlow: [{
        id: 'use-case-1:main:step-1',
        order: 1,
        actorId: 'actor-1',
        action: 'Replace with the actor or system action',
        expectedResult: 'Replace with the observable result',
        inputIds: [],
        outputIds: [],
        ruleIds: [],
        evidencePolicy: 'either',
      }],
      alternatePaths: [],
      failurePaths: [],
      recoveryPaths: [],
      ruleIds: [],
      inputIds: [],
      outputIds: [],
      acceptanceCaseIds: ['ac-1'],
      sourceRefs: [],
    }],
    applicationWorkflows: [{
      id: 'workflow:use-case-1',
      useCaseId: 'use-case-1',
      name: 'Perform use case',
      graph: {
        id: 'workflow:use-case-1:graph',
        name: 'Perform use case',
        nodes: [
          { id: 'workflow:use-case-1:initial', kind: 'initial', label: 'Initial', description: 'The workflow starts.', refinesIds: [] },
          { id: 'workflow:use-case-1:action:step-1', kind: 'action', label: 'Perform application action', description: 'Replace with the observable result.', refinesIds: ['use-case-1:main:step-1'], actorId: 'actor-1' },
          { id: 'workflow:use-case-1:final', kind: 'final', label: 'Final', description: 'The workflow ends.', refinesIds: [] },
        ],
        edges: [
          { id: 'workflow:use-case-1:edge:1', fromNodeId: 'workflow:use-case-1:initial', toNodeId: 'workflow:use-case-1:action:step-1', outcome: 'success', traceIds: ['use-case-1:main'] },
          { id: 'workflow:use-case-1:edge:2', fromNodeId: 'workflow:use-case-1:action:step-1', toNodeId: 'workflow:use-case-1:final', outcome: 'success', traceIds: ['use-case-1:main'] },
        ],
      },
      pathIds: ['use-case-1:main'],
      acceptanceCaseIds: ['ac-1'],
      sourceRefs: [],
    }],
    information: [], rules: [], externalSystems: [], constraints: [],
    scope: { inScope: ['Replace with an in-scope item'], outOfScope: [] },
    acceptanceCases: [{ id: 'ac-1', description: 'Replace with an acceptance case', expectedOutcome: 'Replace with the expected outcome' }],
    sources: [], unresolvedQuestions: [], contentHash: 'pending',
  }
}
