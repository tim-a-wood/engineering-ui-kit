/**
 * Application workflow ownership, compatibility migration, solution allocation,
 * and renderer-neutral Plan and Design projections.
 */

import { validateActivityGraph, isExecutableActivityNode } from './activityGraph.js'
import { diagnostic, sortDiagnostics, type CapDiagnostic } from './diagnostics.js'
import { canonicalHash } from './hash.js'
import { allUseCasePaths, allUseCaseSteps, materializeUseCaseDefinitions } from './useCaseAnalysis.js'
import type {
  ActivityEdge,
  ActivityGraph,
  ActivityNode,
  ApplicationSpecification,
  ApplicationWorkflowDefinition,
  ArchitectureSpecification,
  DiagramNodeKind,
  DiagramProjection,
  DiagramProjectionEdge,
  DiagramProjectionNode,
  ScenarioDefinition,
  UseCaseDefinition,
  UseCasePathKind,
  WorkflowNodeAllocation,
} from './types.js'

export type LegacyWorkflowMigrationResult = {
  workflow: ApplicationWorkflowDefinition
  unresolvedItems: { id: string; description: string; relatedIds: string[] }[]
}

export type ApplicationWorkflowEvaluation = {
  passed: boolean
  diagnostics: CapDiagnostic[]
}

export function evaluateArchitectureApplicationLink(
  application: Pick<ApplicationSpecification, 'id' | 'revision' | 'contentHash'>,
  architecture: Pick<
    ArchitectureSpecification,
    'applicationSpecId' | 'applicationSpecRevision' | 'applicationSpecHash'
  >,
): { current: boolean; diagnostics: CapDiagnostic[] } {
  const diagnostics: CapDiagnostic[] = []
  if (architecture.applicationSpecId !== application.id) {
    diagnostics.push(diagnostic(
      'CAP-ARCH-APPLICATION-ID',
      'The architecture references another application record.',
      {
        fieldPath: 'applicationSpecId',
        relatedIds: [architecture.applicationSpecId, application.id],
      },
    ))
  }
  if (architecture.applicationSpecRevision !== application.revision) {
    diagnostics.push(diagnostic(
      'CAP-ARCH-APPLICATION-REVISION',
      'The architecture uses an earlier application revision.',
      {
        fieldPath: 'applicationSpecRevision',
        relatedIds: [architecture.applicationSpecRevision, application.revision],
      },
    ))
  }
  if (architecture.applicationSpecHash !== application.contentHash) {
    diagnostics.push(diagnostic(
      'CAP-ARCH-APPLICATION-HASH',
      'The application workflow changed after architecture approval.',
      { fieldPath: 'applicationSpecHash' },
    ))
  }
  const sorted = sortDiagnostics(diagnostics)
  return { current: sorted.length === 0, diagnostics: sorted }
}

function humanLabel(value: string): string {
  const local = value.split(/[.:/]/).filter(Boolean).at(-1) ?? value
  return local
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .replace(/\bDo(\d+)([A-Za-z])?\b/g, (_match, number: string, suffix?: string) =>
      `DO-${number}${suffix?.toUpperCase() ?? ''}`)
}

function diagram(
  input: Omit<DiagramProjection, 'schemaVersion' | 'contentHash'>,
): DiagramProjection {
  const value: DiagramProjection = { schemaVersion: '1.0', ...input, contentHash: '' }
  value.contentHash = canonicalHash({ ...value, contentHash: undefined })
  return value
}

function activityProjectionKind(node: ActivityNode): DiagramNodeKind {
  return node.kind
}

function activityNodeId(workflowId: string, nodeId: string): string {
  return `workflow:${workflowId}:node:${nodeId}`
}

function controlEdge(
  workflow: ApplicationWorkflowDefinition,
  edge: ActivityEdge,
  sourceRecordId = workflow.id,
): DiagramProjectionEdge {
  const label = edge.loop?.exitCondition
    ? 'Repeat'
    : edge.outcome
      ? humanLabel(edge.outcome)
      : undefined
  return {
    id: `workflow:${workflow.id}:edge:${edge.id}`,
    kind: 'control-flow',
    fromId: activityNodeId(workflow.id, edge.fromNodeId),
    toId: activityNodeId(workflow.id, edge.toNodeId),
    label,
    guard: edge.guard,
    outcome: edge.outcome,
    isLoop: Boolean(edge.loop),
    description: edge.loop?.exitCondition
      ? `Repeat this flow until ${edge.loop.exitCondition}`
      : edge.guard?.trim()
        ? edge.guard
      : edge.outcome
        ? `Continue on the ${edge.outcome} path.`
        : 'Continue to the next action.',
    sourceRecordId,
    traceIds: [workflow.id, edge.id, ...edge.traceIds],
  }
}

function pathKind(pathId: string, useCase: UseCaseDefinition): UseCasePathKind {
  return allUseCasePaths(useCase).find((path) => path.id === pathId)?.kind ?? 'main'
}

function evidencePolicyForNodeIds(
  nodeIds: readonly string[],
  workflow: ApplicationWorkflowDefinition,
  useCase: UseCaseDefinition,
): ScenarioDefinition['requiredEvidence'] {
  const stepIds = new Set(
    workflow.graph.nodes
      .filter((node) => nodeIds.includes(node.id))
      .flatMap((node) => node.refinesIds),
  )
  const policies = new Set(
    allUseCaseSteps(useCase)
      .filter((step) => stepIds.has(step.id))
      .map((step) => step.evidencePolicy),
  )
  if (policies.size === 1) return [...policies][0]!
  if (policies.has('screenshot') && policies.has('structured')) return 'either'
  if (policies.has('screenshot')) return 'screenshot'
  if (policies.has('structured')) return 'structured'
  return 'not-applicable'
}

function orderedPathNodeIds(workflow: ApplicationWorkflowDefinition, pathId: string): string[] {
  const edges = workflow.graph.edges.filter((edge) => edge.traceIds.includes(pathId))
  if (!edges.length) {
    return workflow.graph.nodes.filter(isExecutableActivityNode).map((node) => node.id)
  }
  const allowed = new Set(edges.map((edge) => edge.id))
  const outgoing = new Map<string, ActivityEdge[]>()
  for (const edge of workflow.graph.edges) {
    if (!allowed.has(edge.id)) continue
    const existing = outgoing.get(edge.fromNodeId) ?? []
    existing.push(edge)
    outgoing.set(edge.fromNodeId, existing)
  }
  const initial = workflow.graph.nodes.find((node) => node.kind === 'initial')
  if (!initial) return []
  const ordered: string[] = []
  const visitedEdges = new Set<string>()
  const queue = [initial.id]
  while (queue.length) {
    const nodeId = queue.shift()!
    const node = workflow.graph.nodes.find((candidate) => candidate.id === nodeId)
    if (node && isExecutableActivityNode(node) && !ordered.includes(node.id)) ordered.push(node.id)
    for (const edge of (outgoing.get(nodeId) ?? []).sort((left, right) => left.id.localeCompare(right.id))) {
      if (visitedEdges.has(edge.id)) continue
      visitedEdges.add(edge.id)
      queue.push(edge.toNodeId)
    }
  }
  return ordered
}

/**
 * Convert only evidenced legacy behavior. Alternate paths without branch and
 * rejoin anchors stay unresolved instead of becoming invented graph structure.
 */
export function migrateLegacyUseCaseToWorkflow(
  useCase: UseCaseDefinition,
): LegacyWorkflowMigrationResult {
  const workflowId = `workflow:${useCase.id}`
  const initialId = `${workflowId}:initial`
  const finalId = `${workflowId}:final`
  const mainPathId = `${useCase.id}:main`
  const actionNodes: ActivityNode[] = [...useCase.mainFlow]
    .sort((left, right) => left.order - right.order)
    .map((step) => ({
      id: `${workflowId}:action:${step.id}`,
      kind: 'action',
      label: step.action,
      description: step.expectedResult,
      refinesIds: [step.id],
      actorId: step.actorId,
    }))
  const ids = [initialId, ...actionNodes.map((node) => node.id), finalId]
  const edges: ActivityEdge[] = ids.slice(0, -1).map((fromNodeId, index) => ({
    id: `${workflowId}:edge:${index + 1}`,
    fromNodeId,
    toNodeId: ids[index + 1]!,
    outcome: 'success',
    traceIds: [useCase.id, mainPathId],
  }))
  const workflow: ApplicationWorkflowDefinition = {
    id: workflowId,
    useCaseId: useCase.id,
    name: useCase.name,
    graph: {
      id: `${workflowId}:graph`,
      name: useCase.name,
      nodes: [
        {
          id: initialId,
          kind: 'initial',
          label: 'Initial',
          description: useCase.trigger || 'The workflow starts.',
          refinesIds: [],
        },
        ...actionNodes,
        {
          id: finalId,
          kind: 'final',
          label: 'Final',
          description: actionNodes.at(-1)?.description || 'The workflow ends.',
          refinesIds: [],
        },
      ],
      edges,
    },
    pathIds: [mainPathId],
    acceptanceCaseIds: [...useCase.acceptanceCaseIds],
    sourceRefs: [...useCase.sourceRefs],
  }
  const unresolvedItems = [
    ...useCase.alternatePaths,
    ...useCase.failurePaths,
    ...useCase.recoveryPaths,
  ].map((path) => ({
    id: `workflow-migration:${path.id}`,
    description: `Set the branch and rejoin points for ${path.name}.`,
    relatedIds: [useCase.id, path.id],
  }))
  return { workflow, unresolvedItems }
}

export function materializeApplicationWorkflows(
  application: ApplicationSpecification,
): ApplicationWorkflowDefinition[] {
  if (application.applicationWorkflows?.length) return application.applicationWorkflows
  return materializeUseCaseDefinitions(application).map((useCase) =>
    migrateLegacyUseCaseToWorkflow(useCase).workflow)
}

/**
 * Compile scenario traces from canonical application workflows. Existing stored
 * scenario definitions remain readable and take precedence.
 */
export function compileWorkflowScenarioDefinitions(
  application: ApplicationSpecification,
): ScenarioDefinition[] {
  if (application.scenarioDefinitions?.length) return application.scenarioDefinitions
  const useCases = materializeUseCaseDefinitions(application)
  return materializeApplicationWorkflows(application).flatMap((workflow) => {
    const useCase = useCases.find((candidate) => candidate.id === workflow.useCaseId)
    if (!useCase) return []
    return workflow.pathIds.map((pathId) => {
      const workflowNodeIds = orderedPathNodeIds(workflow, pathId)
      const stepIds = workflow.graph.nodes
        .filter((node) => workflowNodeIds.includes(node.id))
        .flatMap((node) => node.refinesIds)
      const definition = allUseCasePaths(useCase).find((path) => path.id === pathId)
      return {
        id: `${useCase.id}:scenario:${pathId === `${useCase.id}:main` ? 'main' : humanLabel(pathId).toLowerCase().replace(/\s+/g, '-')}`,
        useCaseId: useCase.id,
        pathId,
        workflowId: workflow.id,
        workflowNodeIds,
        name: definition?.name ?? workflow.name,
        kind: pathKind(pathId, useCase),
        stepIds: [...new Set(stepIds)],
        tags: [useCase.id, workflow.id, pathKind(pathId, useCase)],
        requiredEvidence: evidencePolicyForNodeIds(workflowNodeIds, workflow, useCase),
      } satisfies ScenarioDefinition
    })
  }).filter((scenario) => scenario.stepIds.length > 0)
}

export function evaluateApplicationWorkflows(
  application: ApplicationSpecification,
): ApplicationWorkflowEvaluation {
  const diagnostics: CapDiagnostic[] = []
  const useCases = materializeUseCaseDefinitions(application)
  const useCaseById = new Map(useCases.map((useCase) => [useCase.id, useCase]))
  const actorIds = new Set((application.actors ?? []).map((actor) => actor.id))
  const acceptanceIds = new Set((application.acceptanceCases ?? []).map((item) => item.id))
  const workflowIds = new Set<string>()

  if (!application.applicationWorkflows?.length) {
    diagnostics.push(diagnostic('CAP-PLAN-WORKFLOW-REQUIRED', 'Add an application workflow before approval.', {
      fieldPath: 'applicationWorkflows',
      ruleId: 'CAP-PLAN-WORKFLOW',
    }))
  }

  for (const workflow of application.applicationWorkflows ?? []) {
    const root = `applicationWorkflows.${workflow.id}`
    if (workflowIds.has(workflow.id)) {
      diagnostics.push(diagnostic('CAP-PLAN-WORKFLOW-ID', 'Application workflow IDs must be unique.', {
        fieldPath: `${root}.id`,
        relatedIds: [workflow.id],
      }))
    }
    workflowIds.add(workflow.id)
    const useCase = useCaseById.get(workflow.useCaseId)
    if (!useCase) {
      diagnostics.push(diagnostic('CAP-PLAN-WORKFLOW-USE-CASE', 'Application workflow references an unknown use case.', {
        fieldPath: `${root}.useCaseId`,
        relatedIds: [workflow.useCaseId],
      }))
    }
    diagnostics.push(...validateActivityGraph(workflow.graph, {
      fieldPath: `${root}.graph`,
    }).diagnostics)
    if (!workflow.pathIds.length) {
      diagnostics.push(diagnostic('CAP-PLAN-WORKFLOW-PATH', 'Application workflow requires at least one path trace.', {
        fieldPath: `${root}.pathIds`,
      }))
    }
    if (!workflow.acceptanceCaseIds.length) {
      diagnostics.push(diagnostic('CAP-PLAN-WORKFLOW-ACCEPTANCE', 'Application workflow requires an acceptance trace.', {
        fieldPath: `${root}.acceptanceCaseIds`,
      }))
    }
    for (const acceptanceId of workflow.acceptanceCaseIds) {
      if (!acceptanceIds.has(acceptanceId) || (useCase && !useCase.acceptanceCaseIds.includes(acceptanceId))) {
        diagnostics.push(diagnostic(
          'CAP-PLAN-WORKFLOW-ACCEPTANCE-REF',
          'Application workflow references an acceptance case outside its use case.',
          {
            fieldPath: `${root}.acceptanceCaseIds`,
            relatedIds: [acceptanceId],
          },
        ))
      }
    }
    const validStepIds = new Set(useCase ? allUseCaseSteps(useCase).map((step) => step.id) : [])
    for (const node of workflow.graph.nodes) {
      const nodePath = `${root}.graph.nodes.${node.id}`
      if (node.operationId || node.kind === 'call-operation') {
        diagnostics.push(diagnostic(
          'CAP-PLAN-WORKFLOW-IMPLEMENTATION',
          'Application workflow cannot define an implementation operation.',
          { fieldPath: nodePath, relatedIds: [node.id] },
        ))
      }
      if (node.actorId && !actorIds.has(node.actorId)) {
        diagnostics.push(diagnostic('CAP-PLAN-WORKFLOW-ACTOR-REF', 'Workflow node references an unknown actor.', {
          fieldPath: `${nodePath}.actorId`,
          relatedIds: [node.actorId],
        }))
      }
      if (isExecutableActivityNode(node)) {
        if (!node.refinesIds.length) {
          diagnostics.push(diagnostic(
            'CAP-PLAN-WORKFLOW-STEP-TRACE',
            'Executable application node must refine a stable use-case step.',
            { fieldPath: `${nodePath}.refinesIds`, relatedIds: [node.id] },
          ))
        }
        for (const refinesId of node.refinesIds) {
          if (!validStepIds.has(refinesId)) {
            diagnostics.push(diagnostic(
              'CAP-PLAN-WORKFLOW-STEP-REF',
              'Workflow node references a step outside its use case.',
              { fieldPath: `${nodePath}.refinesIds`, relatedIds: [refinesId] },
            ))
          }
        }
      }
    }
  }
  const sorted = sortDiagnostics(diagnostics)
  return { passed: sorted.length === 0, diagnostics: sorted }
}

export function projectUseCaseDiagram(
  application: ApplicationSpecification,
): DiagramProjection {
  const useCases = materializeUseCaseDefinitions(application)
  const actorIds = [...new Set(useCases.flatMap((useCase) => useCase.actorIds))]
  const boundaryId = `use-case-boundary:${application.id}`
  const nodes: DiagramProjectionNode[] = [
    {
      id: boundaryId,
      kind: 'system-boundary',
      label: humanLabel(application.id),
      description: application.purpose,
      sourceRecordId: application.id,
      traceIds: useCases.map((useCase) => useCase.id),
    },
    ...actorIds.map((actorId) => ({
      id: `use-case-actor:${actorId}`,
      kind: 'actor' as const,
      label: application.actors.find((actor) => actor.id === actorId)?.text ?? humanLabel(actorId),
      description: 'External role.',
      sourceRecordId: application.id,
      traceIds: useCases.filter((useCase) => useCase.actorIds.includes(actorId)).map((useCase) => useCase.id),
    })),
    ...useCases.map((useCase) => ({
      id: `use-case:${useCase.id}`,
      kind: 'use-case' as const,
      label: useCase.name,
      description: useCase.trigger,
      sourceRecordId: useCase.id,
      traceIds: [application.id, useCase.id],
      parentId: boundaryId,
    })),
  ]
  const edges = useCases.flatMap((useCase) => useCase.actorIds.map((actorId) => ({
    id: `use-case-association:${actorId}:${useCase.id}`,
    kind: 'association' as const,
    fromId: `use-case-actor:${actorId}`,
    toId: `use-case:${useCase.id}`,
    description: `${application.actors.find((actor) => actor.id === actorId)?.text ?? humanLabel(actorId)} starts ${useCase.name}.`,
    sourceRecordId: useCase.id,
    traceIds: [application.id, useCase.id],
  })))
  return diagram({
    id: `diagram:use-case:${application.id}`,
    kind: 'use-case',
    level: 'application',
    sourceRecordIds: [application.id, ...useCases.map((useCase) => useCase.id)],
    projectId: application.projectId,
    contextId: application.id,
    title: 'Application use cases',
    sourceRevision: application.revision,
    nodes,
    edges,
    diagnostics: useCases.length ? [] : [{
      id: 'CAP-UML-USE-CASE-EMPTY',
      code: 'CAP-UML-USE-CASE-EMPTY',
      message: 'Add a use case to create this diagram.',
    }],
    textAlternative: useCases.length
      ? `The application has ${useCases.length} use cases and ${actorIds.length} actors.`
      : 'The application has no use cases.',
  })
}

export function projectApplicationBehaviorDiagrams(
  application: ApplicationSpecification,
): DiagramProjection[] {
  const workflows = materializeApplicationWorkflows(application)
  return workflows.map((workflow) => {
    const actorIds = [...new Set(workflow.graph.nodes.flatMap((node) => node.actorId ? [node.actorId] : []))]
    const laneNodes: DiagramProjectionNode[] = actorIds.map((actorId) => ({
      id: `workflow:${workflow.id}:actor:${actorId}`,
      kind: 'swimlane',
      label: application.actors.find((actor) => actor.id === actorId)?.text ?? humanLabel(actorId),
      description: 'Actor partition.',
      sourceRecordId: application.id,
      traceIds: [application.id, workflow.id, actorId],
    }))
    const nodes: DiagramProjectionNode[] = [
      ...laneNodes,
      ...workflow.graph.nodes.map((node) => ({
        id: activityNodeId(workflow.id, node.id),
        kind: activityProjectionKind(node),
        label: node.label,
        description: node.description,
        sourceRecordId: workflow.id,
        traceIds: [application.id, workflow.useCaseId, workflow.id, node.id, ...node.refinesIds],
        parentId: node.actorId ? `workflow:${workflow.id}:actor:${node.actorId}` : undefined,
        stereotype: node.kind === 'call-operation'
          ? 'call'
          : node.kind === 'send-event' || node.kind === 'receive-event'
            ? 'event'
            : undefined,
        details: [
          ...(node.refinesIds.length ? [`Refines ${node.refinesIds.join(', ')}`] : []),
          ...(node.eventId ? [`Event ${node.eventId}`] : []),
        ],
      })),
    ]
    const evaluation = validateActivityGraph(workflow.graph, {
      fieldPath: `applicationWorkflows.${workflow.id}.graph`,
    })
    return diagram({
      id: `diagram:application-activity:${workflow.id}`,
      kind: 'activity',
      level: 'application',
      sourceRecordIds: [application.id, workflow.useCaseId, workflow.id],
      projectId: application.projectId,
      contextId: workflow.id,
      title: `${workflow.name} application workflow`,
      sourceRevision: application.revision,
      nodes,
      edges: workflow.graph.edges.map((edge) => controlEdge(workflow, edge)),
      diagnostics: evaluation.diagnostics.map((item, index) => ({
        id: `${item.code}:${index + 1}`,
        code: item.code,
        message: item.message,
        relatedIds: item.relatedIds,
      })),
      textAlternative: `${workflow.name} has ${workflow.graph.nodes.length} behavior nodes and ${workflow.graph.edges.length} control flows.`,
    })
  })
}

export function materializeWorkflowNodeAllocations(
  application: ApplicationSpecification,
  architecture: ArchitectureSpecification,
): WorkflowNodeAllocation[] {
  const workflows = materializeApplicationWorkflows(application)
  const allocations: WorkflowNodeAllocation[] = []
  for (const trace of architecture.workflowTraces) {
    if (trace.nodeAllocations?.length) {
      allocations.push(...trace.nodeAllocations)
      continue
    }
    const workflow = workflows.find((candidate) => candidate.useCaseId === trace.useCaseId)
    if (!workflow) continue
    for (const legacy of trace.stepAllocations ?? []) {
      const matches = workflow.graph.nodes.filter((node) => node.refinesIds.includes(legacy.stepId))
      if (matches.length !== 1) continue
      allocations.push({
        workflowId: workflow.id,
        nodeId: matches[0]!.id,
        primaryModuleId: legacy.moduleId,
        participatingModuleIds: [],
        entryPointId: trace.entryPointId,
        outputId: trace.outputId,
      })
    }
  }
  return allocations
}

export function evaluateSolutionAllocations(
  application: ApplicationSpecification,
  architecture: ArchitectureSpecification,
): ApplicationWorkflowEvaluation {
  const diagnostics: CapDiagnostic[] = []
  const workflows = materializeApplicationWorkflows(application)
  const workflowById = new Map(workflows.map((workflow) => [workflow.id, workflow]))
  const moduleIds = new Set(architecture.moduleIds)
  const allocations = materializeWorkflowNodeAllocations(application, architecture)
  const allocationByNode = new Map<string, WorkflowNodeAllocation[]>()
  for (const allocation of allocations) {
    const key = `${allocation.workflowId}:${allocation.nodeId}`
    const existing = allocationByNode.get(key) ?? []
    existing.push(allocation)
    allocationByNode.set(key, existing)
    const root = `workflowNodeAllocations.${allocation.workflowId}.${allocation.nodeId}`
    const workflow = workflowById.get(allocation.workflowId)
    if (!workflow?.graph.nodes.some((node) => node.id === allocation.nodeId)) {
      diagnostics.push(diagnostic('CAP-DESIGN-ALLOCATION-NODE', 'Allocation references an unknown workflow node.', {
        fieldPath: `${root}.nodeId`,
        relatedIds: [allocation.workflowId, allocation.nodeId],
      }))
    }
    if (!moduleIds.has(allocation.primaryModuleId)) {
      diagnostics.push(diagnostic('CAP-DESIGN-ALLOCATION-MODULE', 'Allocation references an unknown primary module.', {
        fieldPath: `${root}.primaryModuleId`,
        relatedIds: [allocation.primaryModuleId],
      }))
    }
    for (const moduleId of allocation.participatingModuleIds) {
      if (!moduleIds.has(moduleId)) {
        diagnostics.push(diagnostic('CAP-DESIGN-ALLOCATION-PARTICIPANT', 'Allocation references an unknown participant.', {
          fieldPath: `${root}.participatingModuleIds`,
          relatedIds: [moduleId],
        }))
      }
    }
    const trace = architecture.workflowTraces.find((candidate) =>
      candidate.useCaseId === workflow?.useCaseId)
    for (const moduleId of [allocation.primaryModuleId, ...allocation.participatingModuleIds]) {
      if (trace && !trace.moduleIds.includes(moduleId)) {
        diagnostics.push(diagnostic(
          'CAP-DESIGN-ALLOCATION-TRACE',
          'Allocated module must appear in the workflow trace.',
          { fieldPath: root, relatedIds: [moduleId, trace.useCaseId] },
        ))
      }
    }
    if (
      allocation.operationId
      && !architecture.operationAllocations.some((candidate) =>
        candidate.operationId === allocation.operationId)
    ) {
      diagnostics.push(diagnostic('CAP-DESIGN-ALLOCATION-OPERATION', 'Allocation references an unknown operation.', {
        fieldPath: `${root}.operationId`,
        relatedIds: [allocation.operationId],
      }))
    }
  }

  for (const workflow of workflows) {
    for (const node of workflow.graph.nodes.filter(isExecutableActivityNode)) {
      const key = `${workflow.id}:${node.id}`
      const matches = allocationByNode.get(key) ?? []
      if (matches.length === 0) {
        diagnostics.push(diagnostic('CAP-DESIGN-ALLOCATION-MISSING', 'Assign one primary module to this workflow action.', {
          fieldPath: `workflowNodeAllocations.${workflow.id}.${node.id}`,
          relatedIds: [workflow.id, node.id],
        }))
      } else if (matches.length > 1) {
        diagnostics.push(diagnostic('CAP-DESIGN-ALLOCATION-DUPLICATE', 'Workflow action must have one primary module.', {
          fieldPath: `workflowNodeAllocations.${workflow.id}.${node.id}`,
          relatedIds: [workflow.id, node.id],
        }))
      }
    }
    for (const edge of workflow.graph.edges) {
      const from = (allocationByNode.get(`${workflow.id}:${edge.fromNodeId}`) ?? [])[0]
      const to = (allocationByNode.get(`${workflow.id}:${edge.toNodeId}`) ?? [])[0]
      if (from && to && from.primaryModuleId !== to.primaryModuleId) {
        const hasBoundary = Boolean(
          to.entryPointId || to.operationId || to.eventId
          || from.outputId || from.eventId,
        )
        if (!hasBoundary) {
          diagnostics.push(diagnostic(
            'CAP-DESIGN-ALLOCATION-BOUNDARY',
            'Cross-module flow requires an operation, event, entry point, or output.',
            {
              fieldPath: `applicationWorkflows.${workflow.id}.graph.edges.${edge.id}`,
              relatedIds: [edge.id, from.primaryModuleId, to.primaryModuleId],
            },
          ))
        }
      }
    }
  }

  const tracedModules = new Set(allocations.flatMap((allocation) => [
    allocation.primaryModuleId,
    ...allocation.participatingModuleIds,
  ]))
  for (const trace of architecture.workflowTraces) {
    for (const moduleId of trace.moduleIds) tracedModules.add(moduleId)
  }
  for (const moduleId of architecture.moduleIds) {
    if (!tracedModules.has(moduleId)) {
      diagnostics.push(diagnostic('CAP-DESIGN-ALLOCATION-ORPHAN', 'Module has no application workflow allocation.', {
        fieldPath: `moduleIds.${moduleId}`,
        relatedIds: [moduleId],
      }))
    }
  }
  const sorted = sortDiagnostics(diagnostics)
  return { passed: sorted.length === 0, diagnostics: sorted }
}

function moduleName(architecture: ArchitectureSpecification, moduleId: string): string {
  return architecture.moduleDefinitions?.find((definition) => definition.moduleId === moduleId)?.name
    ?? humanLabel(moduleId)
}

export function projectSolutionAllocationDiagrams(
  application: ApplicationSpecification,
  architecture: ArchitectureSpecification,
): DiagramProjection[] {
  const workflows = materializeApplicationWorkflows(application)
  const allocations = materializeWorkflowNodeAllocations(application, architecture)
  const evaluation = evaluateSolutionAllocations(application, architecture)
  return workflows.flatMap((workflow) => {
    const byNode = new Map(
      allocations
        .filter((allocation) => allocation.workflowId === workflow.id)
        .map((allocation) => [allocation.nodeId, allocation]),
    )
    const allocatedModuleIds = [...new Set([...byNode.values()].flatMap((allocation) => [
      allocation.primaryModuleId,
      ...allocation.participatingModuleIds,
    ]))]
    const laneIds = allocatedModuleIds.length ? allocatedModuleIds : ['unallocated']
    const laneNodes: DiagramProjectionNode[] = laneIds.map((moduleId) => ({
      id: `allocation:${workflow.id}:lane:${moduleId}`,
      kind: 'swimlane',
      label: moduleId === 'unallocated' ? 'Unallocated' : moduleName(architecture, moduleId),
      description: moduleId === 'unallocated'
        ? 'Assign each application action to a module.'
        : architecture.moduleDefinitions?.find((definition) => definition.moduleId === moduleId)?.responsibility
          ?? 'Solution module.',
      sourceRecordId: architecture.id,
      traceIds: [application.id, workflow.id, architecture.id, moduleId],
    }))
    const nodes: DiagramProjectionNode[] = [
      ...laneNodes,
      ...workflow.graph.nodes.map((node) => {
        const allocation = byNode.get(node.id)
        return {
          id: activityNodeId(workflow.id, node.id),
          kind: activityProjectionKind(node),
          label: node.label,
          description: node.description,
          sourceRecordId: allocation ? architecture.id : workflow.id,
          traceIds: [
            application.id,
            workflow.useCaseId,
            workflow.id,
            node.id,
            ...(allocation ? [architecture.id, allocation.primaryModuleId] : []),
            ...node.refinesIds,
          ],
          parentId: `allocation:${workflow.id}:lane:${allocation?.primaryModuleId ?? laneIds[0]}`,
          stereotype: allocation?.operationId
            ? 'operation'
            : allocation?.eventId
              ? 'event'
              : undefined,
          details: allocation
            ? [
                `Primary module: ${moduleName(architecture, allocation.primaryModuleId)}`,
                ...(allocation.participatingModuleIds.length
                  ? [`Participants: ${allocation.participatingModuleIds.map((id) => moduleName(architecture, id)).join(', ')}`]
                  : []),
                ...(allocation.operationId ? [`Operation: ${allocation.operationId}`] : []),
                ...(allocation.eventId ? [`Event: ${allocation.eventId}`] : []),
              ]
            : ['No primary module is assigned.'],
        } satisfies DiagramProjectionNode
      }),
    ]
    const activity = diagram({
      id: `diagram:solution-allocation:${workflow.id}`,
      kind: 'activity',
      level: 'allocation',
      sourceRecordIds: [application.id, workflow.id, architecture.id],
      projectId: application.projectId,
      contextId: workflow.id,
      title: `${workflow.name} solution allocation`,
      sourceRevision: architecture.revision,
      nodes,
      edges: workflow.graph.edges.map((edge) => controlEdge(workflow, edge, architecture.id)),
      diagnostics: evaluation.diagnostics
        .filter((item) => item.relatedIds?.includes(workflow.id))
        .map((item, index) => ({
          id: `${item.code}:${index + 1}`,
          code: item.code,
          message: item.message,
          relatedIds: item.relatedIds,
        })),
      textAlternative: `${workflow.name} uses ${allocatedModuleIds.length} module lanes.`,
    })

    const lifelines: DiagramProjectionNode[] = allocatedModuleIds.map((moduleId) => ({
      id: `allocation-sequence:${workflow.id}:${moduleId}`,
      kind: 'lifeline',
      label: moduleName(architecture, moduleId),
      description: architecture.moduleDefinitions?.find((definition) => definition.moduleId === moduleId)?.responsibility
        ?? 'Solution module.',
      sourceRecordId: architecture.id,
      traceIds: [application.id, workflow.id, moduleId],
      stereotype: 'module',
    }))
    const messages: DiagramProjectionEdge[] = workflow.graph.edges.flatMap((edge) => {
      const from = byNode.get(edge.fromNodeId)
      const to = byNode.get(edge.toNodeId)
      if (!from || !to || from.primaryModuleId === to.primaryModuleId) return []
      return [{
        id: `allocation-message:${workflow.id}:${edge.id}`,
        kind: 'synchronous-message',
        fromId: `allocation-sequence:${workflow.id}:${from.primaryModuleId}`,
        toId: `allocation-sequence:${workflow.id}:${to.primaryModuleId}`,
        label: to.operationId ?? to.eventId ?? to.entryPointId ?? from.outputId ?? 'Transfer work',
        guard: edge.guard,
        outcome: edge.outcome,
        isLoop: Boolean(edge.loop),
        description: edge.guard
          ? `Transfer control when ${edge.guard}`
          : 'Transfer control across the module boundary.',
        sourceRecordId: architecture.id,
        traceIds: [application.id, workflow.id, edge.id, from.nodeId, to.nodeId],
      }]
    })
    const sequence = diagram({
      id: `diagram:solution-sequence:${workflow.id}`,
      kind: 'sequence',
      level: 'allocation',
      sourceRecordIds: [application.id, workflow.id, architecture.id],
      projectId: application.projectId,
      contextId: workflow.id,
      title: `${workflow.name} module sequence`,
      sourceRevision: architecture.revision,
      nodes: lifelines,
      edges: messages,
      diagnostics: lifelines.length >= 2 ? [] : [{
        id: 'CAP-UML-SEQUENCE-NOT-APPLICABLE',
        code: 'CAP-UML-SEQUENCE-NOT-APPLICABLE',
        message: 'This workflow does not cross a module boundary.',
      }],
      textAlternative: `${workflow.name} has ${messages.length} cross-module messages.`,
    })
    return [activity, sequence]
  })
}
