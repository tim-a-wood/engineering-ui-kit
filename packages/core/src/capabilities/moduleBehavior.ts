/**
 * Internal module behavior validation, compatibility migration, and UML
 * projections. This module never reads a use-case flow to create module actions.
 */

import { isExecutableActivityNode, validateActivityGraph } from './activityGraph.js'
import {
  materializeApplicationWorkflows,
  materializeWorkflowNodeAllocations,
} from './applicationWorkflow.js'
import { diagnostic, sortDiagnostics, type CapDiagnostic } from './diagnostics.js'
import { canonicalHash } from './hash.js'
import type {
  ActivityEdge,
  ActivityNode,
  ApplicationSpecification,
  ArchitectureSpecification,
  DiagramProjection,
  DiagramProjectionEdge,
  DiagramProjectionNode,
  ModuleActivityDefinition,
  ModuleBehaviorSpecification,
  ModuleDesignSpecification,
  ModuleInteractionDefinition,
  ModuleStateDefinition,
  ModuleStateTransition,
  OperationContract,
} from './types.js'

export type ModuleBehaviorEvaluation = {
  passed: boolean
  diagnostics: CapDiagnostic[]
}

export type LegacyModuleBehaviorMigration = {
  behavior: ModuleBehaviorSpecification
  requiresReview: boolean
  diagnostics: CapDiagnostic[]
}

function diagram(
  input: Omit<DiagramProjection, 'schemaVersion' | 'contentHash'>,
): DiagramProjection {
  const value: DiagramProjection = { schemaVersion: '1.0', ...input, contentHash: '' }
  value.contentHash = canonicalHash({ ...value, contentHash: undefined })
  return value
}

function projectionNodeId(activityId: string, nodeId: string): string {
  return `module-activity:${activityId}:node:${nodeId}`
}

function interactionParticipantId(interactionId: string, participantId: string): string {
  return `module-sequence:${interactionId}:participant:${participantId}`
}

function workflowNodeIdsForModule(
  application: ApplicationSpecification,
  architecture: ArchitectureSpecification,
  moduleId: string,
): Set<string> {
  return new Set(
    materializeWorkflowNodeAllocations(application, architecture)
      .filter((allocation) => allocation.primaryModuleId === moduleId)
      .map((allocation) => allocation.nodeId),
  )
}

function declaredOperationIds(design: ModuleDesignSpecification): Set<string> {
  return new Set([
    ...design.providedOperations.map((operation) => operation.operationId),
    ...design.requiredOperations.map((operation) => operation.operationId),
  ])
}

function declaredEventIds(design: ModuleDesignSpecification): Set<string> {
  return new Set([
    ...design.behavior.emittedEvents,
    ...design.behavior.consumedEvents,
  ])
}

function allActivityNodeIds(activities: readonly ModuleActivityDefinition[]): Set<string> {
  return new Set(activities.flatMap((activity) => activity.graph.nodes.map((node) => node.id)))
}

/**
 * Convert a legacy activity list into a reviewable linear module draft. This
 * adapter uses only module-owned legacy fields.
 */
export function migrateLegacyModuleBehavior(
  behavior: ModuleBehaviorSpecification,
  moduleId: string,
): LegacyModuleBehaviorMigration {
  if (behavior.activityDefinitions?.length) {
    return { behavior, requiresReview: false, diagnostics: [] }
  }
  if (!behavior.activities.length) {
    return {
      behavior: { ...behavior, activityDefinitions: [] },
      requiresReview: true,
      diagnostics: [diagnostic(
        'CAP-MODULE-BEHAVIOR-MIGRATION-EMPTY',
        'Legacy module data has no activity behavior to migrate.',
        { fieldPath: 'behavior.activities', relatedIds: [moduleId] },
      )],
    }
  }
  const activityId = `module-activity:${moduleId}:legacy`
  const initialId = `${activityId}:initial`
  const finalId = `${activityId}:final`
  const actions: ActivityNode[] = behavior.activities.map((activity) => ({
    id: `${activityId}:action:${activity.id}`,
    kind: 'action',
    label: activity.text,
    description: activity.text,
    refinesIds: [],
  }))
  const ids = [initialId, ...actions.map((node) => node.id), finalId]
  const edges: ActivityEdge[] = ids.slice(0, -1).map((fromNodeId, index) => ({
    id: `${activityId}:edge:${index + 1}`,
    fromNodeId,
    toNodeId: ids[index + 1]!,
    traceIds: [moduleId, activityId],
  }))
  return {
    behavior: {
      ...behavior,
      activityDefinitions: [{
        id: activityId,
        name: 'Review legacy activity',
        refinesWorkflowNodeIds: [],
        graph: {
          id: `${activityId}:graph`,
          name: 'Review legacy activity',
          nodes: [
            {
              id: initialId,
              kind: 'initial',
              label: 'Initial',
              description: 'The module activity starts.',
              refinesIds: [],
            },
            ...actions,
            {
              id: finalId,
              kind: 'final',
              label: 'Final',
              description: 'The module activity ends.',
              refinesIds: [],
            },
          ],
          edges,
        },
      }],
    },
    requiresReview: true,
    diagnostics: [diagnostic(
      'CAP-MODULE-BEHAVIOR-MIGRATION-REVIEW',
      'Review the migrated module activity and add workflow refinement links.',
      { fieldPath: 'behavior.activityDefinitions', relatedIds: [moduleId, activityId] },
    )],
  }
}

export function evaluateModuleBehavior(input: {
  application: ApplicationSpecification
  architecture: ArchitectureSpecification
  design: ModuleDesignSpecification
  operationContracts?: OperationContract[]
}): ModuleBehaviorEvaluation {
  const { application, architecture, design } = input
  const diagnostics: CapDiagnostic[] = []
  const activities = design.behavior.activityDefinitions ?? []
  const allocatedIds = workflowNodeIdsForModule(application, architecture, design.module.moduleId)
  const workflows = materializeApplicationWorkflows(application)
  const allWorkflowNodeIds = new Set(workflows.flatMap((workflow) =>
    workflow.graph.nodes.map((node) => node.id)))
  const operationIds = declaredOperationIds(design)
  const contractIds = new Set((input.operationContracts ?? []).map((contract) => contract.operationId))
  const eventIds = declaredEventIds(design)

  if (!activities.length) {
    diagnostics.push(diagnostic(
      'CAP-MODULE-BEHAVIOR-REQUIRED',
      'Add a structured module activity before approval.',
      { fieldPath: 'behavior.activityDefinitions', relatedIds: [design.module.moduleId] },
    ))
  }

  const activityIds = new Set<string>()
  const refinedWorkflowNodeIds = new Set<string>()
  for (const activity of activities) {
    const root = `behavior.activityDefinitions.${activity.id}`
    if (activityIds.has(activity.id)) {
      diagnostics.push(diagnostic('CAP-MODULE-BEHAVIOR-ID', 'Module activity IDs must be unique.', {
        fieldPath: `${root}.id`,
        relatedIds: [activity.id],
      }))
    }
    activityIds.add(activity.id)
    diagnostics.push(...validateActivityGraph(activity.graph, {
      fieldPath: `${root}.graph`,
    }).diagnostics)
    if (!activity.refinesWorkflowNodeIds.length) {
      diagnostics.push(diagnostic(
        'CAP-MODULE-BEHAVIOR-REFINEMENT',
        'Module activity must refine an allocated application action.',
        { fieldPath: `${root}.refinesWorkflowNodeIds`, relatedIds: [activity.id] },
      ))
    }
    for (const workflowNodeId of activity.refinesWorkflowNodeIds) {
      if (!allWorkflowNodeIds.has(workflowNodeId)) {
        diagnostics.push(diagnostic(
          'CAP-MODULE-BEHAVIOR-REFINEMENT-REF',
          'Module activity references an unknown application workflow node.',
          { fieldPath: `${root}.refinesWorkflowNodeIds`, relatedIds: [workflowNodeId] },
        ))
      } else if (!allocatedIds.has(workflowNodeId)) {
        diagnostics.push(diagnostic(
          'CAP-MODULE-BEHAVIOR-REFINEMENT-OWNER',
          'Module activity can refine only actions allocated to this module.',
          { fieldPath: `${root}.refinesWorkflowNodeIds`, relatedIds: [workflowNodeId] },
        ))
      } else {
        refinedWorkflowNodeIds.add(workflowNodeId)
      }
    }
    if (activity.entryOperationId && !operationIds.has(activity.entryOperationId)) {
      diagnostics.push(diagnostic(
        'CAP-MODULE-BEHAVIOR-ENTRY-OPERATION',
        'Module activity entry operation must use an approved module operation.',
        { fieldPath: `${root}.entryOperationId`, relatedIds: [activity.entryOperationId] },
      ))
    }
    for (const node of activity.graph.nodes) {
      const nodePath = `${root}.graph.nodes.${node.id}`
      if (node.kind === 'call-operation' && node.operationId) {
        if (!operationIds.has(node.operationId)) {
          diagnostics.push(diagnostic(
            'CAP-MODULE-BEHAVIOR-OPERATION',
            'Operation call must reference a provided or required module operation.',
            { fieldPath: `${nodePath}.operationId`, relatedIds: [node.operationId] },
          ))
        } else if (contractIds.size && !contractIds.has(node.operationId)) {
          diagnostics.push(diagnostic(
            'CAP-MODULE-BEHAVIOR-OPERATION-CONTRACT',
            'Operation call requires an approved operation contract.',
            { fieldPath: `${nodePath}.operationId`, relatedIds: [node.operationId] },
          ))
        }
      }
      if ((node.kind === 'send-event' || node.kind === 'receive-event') && node.eventId && !eventIds.has(node.eventId)) {
        diagnostics.push(diagnostic(
          'CAP-MODULE-BEHAVIOR-EVENT',
          'Event action must reference a declared module event.',
          { fieldPath: `${nodePath}.eventId`, relatedIds: [node.eventId] },
        ))
      }
    }
  }

  for (const allocatedId of allocatedIds) {
    if (!refinedWorkflowNodeIds.has(allocatedId)) {
      diagnostics.push(diagnostic(
        'CAP-MODULE-BEHAVIOR-COVERAGE',
        'Allocated application action requires a refining module activity.',
        { fieldPath: 'behavior.activityDefinitions', relatedIds: [allocatedId] },
      ))
    }
  }

  const edges = activities.flatMap((activity) => activity.graph.edges)
  if (design.behavior.domainRejections.length && !edges.some((edge) =>
    edge.outcome === 'alternate' || edge.outcome === 'failure')) {
    diagnostics.push(diagnostic(
      'CAP-MODULE-BEHAVIOR-REJECTION-PATH',
      'Declared domain rejection requires an alternate or failure path.',
      { fieldPath: 'behavior.domainRejections' },
    ))
  }
  if (design.behavior.technicalFailures.length && !edges.some((edge) => edge.outcome === 'failure')) {
    diagnostics.push(diagnostic(
      'CAP-MODULE-BEHAVIOR-FAILURE-PATH',
      'Declared technical failure requires a failure path.',
      { fieldPath: 'behavior.technicalFailures' },
    ))
  }
  if (
    design.behavior.technicalFailures.length
    && design.behavior.recovery.trim()
    && design.behavior.recovery !== 'Not defined'
    && !edges.some((edge) => edge.outcome === 'recovery')
  ) {
    diagnostics.push(diagnostic(
      'CAP-MODULE-BEHAVIOR-RECOVERY-PATH',
      'Declared recovery behavior requires a recovery path.',
      { fieldPath: 'behavior.recovery' },
    ))
  }

  const states = design.behavior.stateDefinitions ?? []
  const transitions = design.behavior.stateTransitions ?? []
  const stateIds = new Set(states.map((state) => state.id))
  const activityNodeIds = allActivityNodeIds(activities)
  for (const state of states) {
    if (state.parentStateId && !stateIds.has(state.parentStateId)) {
      diagnostics.push(diagnostic('CAP-MODULE-STATE-PARENT', 'State references an unknown parent state.', {
        fieldPath: `behavior.stateDefinitions.${state.id}.parentStateId`,
        relatedIds: [state.parentStateId],
      }))
    }
    for (const actionId of [...state.entryActionIds, ...state.exitActionIds]) {
      if (!activityNodeIds.has(actionId)) {
        diagnostics.push(diagnostic('CAP-MODULE-STATE-ACTION', 'State action references an unknown activity node.', {
          fieldPath: `behavior.stateDefinitions.${state.id}`,
          relatedIds: [actionId],
        }))
      }
    }
  }
  for (const transition of transitions) {
    const root = `behavior.stateTransitions.${transition.id}`
    if (!stateIds.has(transition.fromStateId) || !stateIds.has(transition.toStateId)) {
      diagnostics.push(diagnostic('CAP-MODULE-STATE-TRANSITION-REF', 'State transition references an unknown state.', {
        fieldPath: root,
        relatedIds: [transition.fromStateId, transition.toStateId],
      }))
    }
    if (!transition.trigger.trim()) {
      diagnostics.push(diagnostic('CAP-MODULE-STATE-TRIGGER', 'State transition requires a trigger.', {
        fieldPath: `${root}.trigger`,
        relatedIds: [transition.id],
      }))
    }
    for (const actionId of transition.effectActivityNodeIds) {
      if (!activityNodeIds.has(actionId)) {
        diagnostics.push(diagnostic(
          'CAP-MODULE-STATE-EFFECT',
          'State transition effect references an unknown activity node.',
          { fieldPath: `${root}.effectActivityNodeIds`, relatedIds: [actionId] },
        ))
      }
    }
  }

  for (const interaction of design.behavior.interactionDefinitions ?? []) {
    const participantIds = new Set(interaction.participants.map((participant) => participant.id))
    const messageIds = new Set(interaction.messages.map((message) => message.id))
    if (!interaction.name.trim() || interaction.participants.length < 2) {
      diagnostics.push(diagnostic(
        'CAP-MODULE-INTERACTION-SHAPE',
        'Internal interaction requires a name and at least two participants.',
        {
          fieldPath: `behavior.interactionDefinitions.${interaction.id}`,
          relatedIds: [interaction.id],
        },
      ))
    }
    if (participantIds.size !== interaction.participants.length) {
      diagnostics.push(diagnostic(
        'CAP-MODULE-INTERACTION-PARTICIPANT-ID',
        'Interaction participant IDs must be unique.',
        {
          fieldPath: `behavior.interactionDefinitions.${interaction.id}.participants`,
          relatedIds: interaction.participants.map((participant) => participant.id),
        },
      ))
    }
    if (messageIds.size !== interaction.messages.length) {
      diagnostics.push(diagnostic(
        'CAP-MODULE-INTERACTION-MESSAGE-ID',
        'Interaction message IDs must be unique.',
        {
          fieldPath: `behavior.interactionDefinitions.${interaction.id}.messages`,
          relatedIds: interaction.messages.map((message) => message.id),
        },
      ))
    }
    for (const message of interaction.messages) {
      const root = `behavior.interactionDefinitions.${interaction.id}.messages.${message.id}`
      if (
        !participantIds.has(message.fromParticipantId)
        || !participantIds.has(message.toParticipantId)
      ) {
        diagnostics.push(diagnostic(
          'CAP-MODULE-INTERACTION-PARTICIPANT',
          'Interaction message references an unknown participant.',
          { fieldPath: root, relatedIds: [message.fromParticipantId, message.toParticipantId] },
        ))
      }
      if (message.operationId && !operationIds.has(message.operationId)) {
        diagnostics.push(diagnostic(
          'CAP-MODULE-INTERACTION-OPERATION',
          'Interaction message references an unknown module operation.',
          { fieldPath: `${root}.operationId`, relatedIds: [message.operationId] },
        ))
      }
      if (message.eventId && !eventIds.has(message.eventId)) {
        diagnostics.push(diagnostic(
          'CAP-MODULE-INTERACTION-EVENT',
          'Interaction message references an unknown module event.',
          { fieldPath: `${root}.eventId`, relatedIds: [message.eventId] },
        ))
      }
      for (const actionId of message.refinesActivityNodeIds) {
        if (!activityNodeIds.has(actionId)) {
          diagnostics.push(diagnostic(
            'CAP-MODULE-INTERACTION-ACTIVITY',
            'Interaction message references an unknown activity node.',
            { fieldPath: `${root}.refinesActivityNodeIds`, relatedIds: [actionId] },
          ))
        }
      }
    }
    for (const fragment of interaction.fragments ?? []) {
      const root = `behavior.interactionDefinitions.${interaction.id}.fragments.${fragment.id}`
      if (!fragment.label.trim() || !fragment.messageIds.length) {
        diagnostics.push(diagnostic(
          'CAP-MODULE-INTERACTION-FRAGMENT',
          'Interaction fragment requires a label and at least one message.',
          { fieldPath: root, relatedIds: [fragment.id] },
        ))
      }
      for (const messageId of fragment.messageIds) {
        if (!messageIds.has(messageId)) {
          diagnostics.push(diagnostic(
            'CAP-MODULE-INTERACTION-FRAGMENT-MESSAGE',
            'Interaction fragment references an unknown message.',
            { fieldPath: `${root}.messageIds`, relatedIds: [messageId] },
          ))
        }
      }
    }
  }

  const sorted = sortDiagnostics(diagnostics)
  return { passed: sorted.length === 0, diagnostics: sorted }
}

function projectActivity(
  application: Pick<ApplicationSpecification, 'id'>,
  design: ModuleDesignSpecification,
  activity: ModuleActivityDefinition,
): DiagramProjection {
  const nodes: DiagramProjectionNode[] = activity.graph.nodes.map((node) => ({
    id: projectionNodeId(activity.id, node.id),
    kind: node.kind,
    label: node.label,
    description: node.description,
    sourceRecordId: design.id,
    traceIds: [
      design.id,
      design.module.moduleId,
      activity.id,
      node.id,
      ...activity.refinesWorkflowNodeIds,
      ...node.refinesIds,
    ],
    stereotype: node.kind === 'call-operation'
      ? 'call'
      : node.kind === 'send-event' || node.kind === 'receive-event'
        ? 'event'
        : undefined,
    details: [
      ...(node.operationId ? [`Operation: ${node.operationId}`] : []),
      ...(node.eventId ? [`Event: ${node.eventId}`] : []),
      ...(node.refinesIds.length ? [`Refines: ${node.refinesIds.join(', ')}`] : []),
    ],
  }))
  const edges: DiagramProjectionEdge[] = activity.graph.edges.map((edge) => ({
    id: `module-activity:${activity.id}:edge:${edge.id}`,
    kind: 'control-flow',
    fromId: projectionNodeId(activity.id, edge.fromNodeId),
    toId: projectionNodeId(activity.id, edge.toNodeId),
    // A success outcome is already expressed by the normal control-flow
    // arrow. Reserve visible labels for guards and exceptional outcomes.
    label: edge.loop?.exitCondition
      ? 'Repeat'
      : edge.outcome && edge.outcome !== 'success'
        ? `${edge.outcome[0]!.toUpperCase()}${edge.outcome.slice(1)}`
        : undefined,
    guard: edge.guard,
    outcome: edge.outcome,
    isLoop: Boolean(edge.loop),
    description: edge.loop?.exitCondition
      ? `Repeat this flow until ${edge.loop.exitCondition}`
      : edge.guard?.trim()
        ? edge.guard
      : edge.outcome
        ? `Continue on the ${edge.outcome} path.`
        : 'Continue to the next module action.',
    sourceRecordId: design.id,
    traceIds: [design.id, activity.id, edge.id, ...edge.traceIds],
  }))
  const evaluation = validateActivityGraph(activity.graph, {
    fieldPath: `behavior.activityDefinitions.${activity.id}.graph`,
  })
  return diagram({
    id: `diagram:module-activity:${design.module.moduleId}:${activity.id}`,
    kind: 'activity',
    level: 'module',
    sourceRecordIds: [application.id, design.architecture.id, design.id, activity.id],
    projectId: design.projectId,
    contextId: design.module.moduleId,
    title: `${activity.name} module activity`,
    sourceRevision: design.revision,
    nodes,
    edges,
    diagnostics: evaluation.diagnostics.map((item, index) => ({
      id: `${item.code}:${index + 1}`,
      code: item.code,
      message: item.message,
      relatedIds: item.relatedIds,
    })),
    textAlternative: `${activity.name} has ${nodes.length} behavior nodes and ${edges.length} control flows.`,
  })
}

function projectStateMachine(
  application: Pick<ApplicationSpecification, 'id'>,
  design: ModuleDesignSpecification,
): DiagramProjection {
  const states = design.behavior.stateDefinitions ?? []
  const transitions = design.behavior.stateTransitions ?? []
  const incoming = new Set(transitions.map((transition) => transition.toStateId))
  const initialState = states.find((state) => !incoming.has(state.id)) ?? states[0]
  const initialId = `module-state:${design.module.moduleId}:initial`
  const nodes: DiagramProjectionNode[] = [
    {
      id: initialId,
      kind: 'initial',
      label: 'Initial',
      description: 'The module state machine starts.',
      sourceRecordId: design.id,
      traceIds: [design.id, design.module.moduleId],
    },
    ...states.map((state) => ({
      id: `module-state:${design.module.moduleId}:${state.id}`,
      kind: 'state' as const,
      label: state.name,
      description: state.name,
      sourceRecordId: design.id,
      traceIds: [
        design.id,
        state.id,
        ...state.entryActionIds,
        ...state.exitActionIds,
      ],
      parentId: state.parentStateId
        ? `module-state:${design.module.moduleId}:${state.parentStateId}`
        : undefined,
      details: [
        ...(state.entryActionIds.length ? [`Entry actions: ${state.entryActionIds.join(', ')}`] : []),
        ...(state.exitActionIds.length ? [`Exit actions: ${state.exitActionIds.join(', ')}`] : []),
      ],
    })),
  ]
  const edges: DiagramProjectionEdge[] = [
    ...(initialState
      ? [{
          id: `module-state:${design.module.moduleId}:initialize`,
          kind: 'transition' as const,
          fromId: initialId,
          toId: `module-state:${design.module.moduleId}:${initialState.id}`,
          label: 'Initialize',
          description: 'Initialize the module state.',
          sourceRecordId: design.id,
          traceIds: [design.id, initialState.id],
        }]
      : []),
    ...transitions.map((transition) => ({
      id: `module-state:${design.module.moduleId}:transition:${transition.id}`,
      kind: 'transition' as const,
      fromId: `module-state:${design.module.moduleId}:${transition.fromStateId}`,
      toId: `module-state:${design.module.moduleId}:${transition.toStateId}`,
      label: transition.trigger,
      guard: transition.guard,
      description: [
        ...(transition.guard ? [transition.guard] : []),
        ...(transition.effectActivityNodeIds.length
          ? [`Run ${transition.effectActivityNodeIds.join(', ')}.`]
          : ['Change the module state.']),
      ].join(' '),
      sourceRecordId: design.id,
      traceIds: [design.id, transition.id, ...transition.effectActivityNodeIds],
    })),
  ]
  return diagram({
    id: `diagram:module-state:${design.module.moduleId}`,
    kind: 'state-machine',
    level: 'module',
    sourceRecordIds: [application.id, design.architecture.id, design.id],
    projectId: design.projectId,
    contextId: design.module.moduleId,
    title: `${design.module.name} state behavior`,
    sourceRevision: design.revision,
    nodes,
    edges,
    diagnostics: states.length ? [] : [{
      id: 'CAP-UML-STATE-NOT-APPLICABLE',
      code: 'CAP-UML-STATE-NOT-APPLICABLE',
      message: 'This module has no structured state behavior.',
    }],
    textAlternative: states.length
      ? `${design.module.name} has ${states.length} states and ${transitions.length} transitions.`
      : `${design.module.name} has no structured state behavior.`,
  })
}

function projectInteraction(
  application: Pick<ApplicationSpecification, 'id'>,
  design: ModuleDesignSpecification,
  interaction: ModuleInteractionDefinition,
): DiagramProjection {
  const nodes: DiagramProjectionNode[] = [
    ...interaction.participants.map((participant) => ({
      id: interactionParticipantId(interaction.id, participant.id),
      kind: 'lifeline' as const,
      label: participant.label,
      description: `${participant.label} is an internal interaction participant.`,
      sourceRecordId: design.id,
      traceIds: [design.id, interaction.id, participant.id],
      stereotype: participant.kind,
    })),
    ...(interaction.fragments ?? []).map((fragment) => ({
      id: `module-sequence:${interaction.id}:fragment:${fragment.id}`,
      kind: 'fragment' as const,
      label: fragment.kind,
      description: fragment.guard
        ? `${fragment.label}: ${fragment.guard}`
        : fragment.label,
      sourceRecordId: design.id,
      traceIds: [
        fragment.id,
        ...fragment.messageIds,
      ],
      stereotype: fragment.kind,
      details: [
        fragment.label,
        ...(fragment.guard ? [`Guard: ${fragment.guard}`] : []),
      ],
    })),
  ]
  const edges: DiagramProjectionEdge[] = interaction.messages.map((message) => ({
    id: `module-sequence:${interaction.id}:message:${message.id}`,
    kind: message.kind === 'reply' ? 'reply-message' : 'synchronous-message',
    fromId: interactionParticipantId(interaction.id, message.fromParticipantId),
    toId: interactionParticipantId(interaction.id, message.toParticipantId),
    label: message.label,
    guard: message.guard,
    description: [
      ...(message.guard ? [message.guard] : []),
      message.kind === 'event'
        ? 'Send the declared module event.'
        : message.kind === 'reply'
          ? 'Return the operation result.'
          : 'Call the declared operation.',
    ].join(' '),
    sourceRecordId: design.id,
    traceIds: [design.id, interaction.id, message.id, ...message.refinesActivityNodeIds],
  }))
  return diagram({
    id: `diagram:module-sequence:${design.module.moduleId}:${interaction.id}`,
    kind: 'sequence',
    level: 'module',
    sourceRecordIds: [application.id, design.architecture.id, design.id, interaction.id],
    projectId: design.projectId,
    contextId: design.module.moduleId,
    title: `${interaction.name} internal sequence`,
    sourceRevision: design.revision,
    nodes,
    edges,
    diagnostics: nodes.length >= 2 ? [] : [{
      id: 'CAP-UML-INTERNAL-SEQUENCE-PARTICIPANTS',
      code: 'CAP-UML-INTERNAL-SEQUENCE-PARTICIPANTS',
      message: 'Internal sequence requires at least two participants.',
    }],
    textAlternative: `${interaction.name} has ${nodes.length} participants and ${edges.length} messages.`,
  })
}

export function projectModuleBehaviorDiagrams(input: {
  application: Pick<ApplicationSpecification, 'id'>
  architecture: Pick<ArchitectureSpecification, 'id'>
  design: ModuleDesignSpecification
}): DiagramProjection[] {
  const activities = input.design.behavior.activityDefinitions ?? []
  const activityDiagrams = activities.map((activity) =>
    projectActivity(input.application, input.design, activity))
  const emptyActivity = activities.length ? [] : [diagram({
    id: `diagram:module-activity:${input.design.module.moduleId}:empty`,
    kind: 'activity',
    level: 'module',
    sourceRecordIds: [input.application.id, input.architecture.id, input.design.id],
    projectId: input.design.projectId,
    contextId: input.design.module.moduleId,
    title: `${input.design.module.name} module activity`,
    sourceRevision: input.design.revision,
    nodes: [],
    edges: [],
    diagnostics: [{
      id: 'CAP-UML-MODULE-ACTIVITY-REQUIRED',
      code: 'CAP-UML-MODULE-ACTIVITY-REQUIRED',
      message: 'Add structured internal module behavior to create this diagram.',
    }],
    textAlternative: `${input.design.module.name} has no structured module activity.`,
  })]
  const interactionDiagrams = (input.design.behavior.interactionDefinitions ?? []).map((interaction) =>
    projectInteraction(input.application, input.design, interaction))
  const emptySequence = interactionDiagrams.length ? [] : [diagram({
    id: `diagram:module-sequence:${input.design.module.moduleId}:empty`,
    kind: 'sequence',
    level: 'module',
    sourceRecordIds: [input.application.id, input.architecture.id, input.design.id],
    projectId: input.design.projectId,
    contextId: input.design.module.moduleId,
    title: `${input.design.module.name} internal sequence`,
    sourceRevision: input.design.revision,
    nodes: [],
    edges: [],
    diagnostics: [{
      id: 'CAP-UML-INTERNAL-SEQUENCE-NOT-APPLICABLE',
      code: 'CAP-UML-INTERNAL-SEQUENCE-NOT-APPLICABLE',
      message: 'This module has no structured internal interaction.',
    }],
    textAlternative: `${input.design.module.name} has no structured internal interaction.`,
  })]
  return [
    ...activityDiagrams,
    ...emptyActivity,
    projectStateMachine(input.application, input.design),
    ...interactionDiagrams,
    ...emptySequence,
  ]
}

export function moduleBehaviorCoverage(input: {
  application: ApplicationSpecification
  architecture: ArchitectureSpecification
  design: ModuleDesignSpecification
}): {
  allocatedNodeIds: string[]
  refinedNodeIds: string[]
  missingNodeIds: string[]
} {
  const allocatedNodeIds = [...workflowNodeIdsForModule(
    input.application,
    input.architecture,
    input.design.module.moduleId,
  )].sort((left, right) => left.localeCompare(right))
  const refined = new Set(
    (input.design.behavior.activityDefinitions ?? [])
      .flatMap((activity) => activity.refinesWorkflowNodeIds),
  )
  return {
    allocatedNodeIds,
    refinedNodeIds: allocatedNodeIds.filter((id) => refined.has(id)),
    missingNodeIds: allocatedNodeIds.filter((id) => !refined.has(id)),
  }
}

export function moduleStateDefinitions(
  behavior: ModuleBehaviorSpecification,
): readonly ModuleStateDefinition[] {
  return behavior.stateDefinitions ?? []
}

export function moduleStateTransitions(
  behavior: ModuleBehaviorSpecification,
): readonly ModuleStateTransition[] {
  return behavior.stateTransitions ?? []
}
