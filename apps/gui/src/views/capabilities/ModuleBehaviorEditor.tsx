import { useMemo, useState } from 'react'
import type {
  ActivityEdge,
  ActivityNode,
  DiagramProjection,
  ModuleActivityDefinition,
  ModuleDesignSpecification,
  ModuleInteractionDefinition,
  ModuleStateDefinition,
  ModuleStateTransition,
} from '@engineering-ui-kit/core'
import {
  migrateLegacyModuleBehavior,
  projectModuleBehaviorDiagrams,
} from '@engineering-ui-kit/core/browser'
import { UmlDiagramWorkspace } from './UmlDiagramWorkspace'

type Props = {
  design: ModuleDesignSpecification
  disabled: boolean
  onChange: (design: ModuleDesignSpecification) => void
}

let uniqueSequence = 0

function uniqueId(prefix: string): string {
  uniqueSequence += 1
  return `${prefix}-${Date.now().toString(36)}-${uniqueSequence.toString(36)}`
}

export function ModuleBehaviorEditor({ design, disabled, onChange }: Props) {
  const compatibility = useMemo(
    () => migrateLegacyModuleBehavior(design.behavior, design.module.moduleId),
    [design.behavior, design.module.moduleId],
  )
  const activities = design.behavior.activityDefinitions
    ?? (disabled ? compatibility.behavior.activityDefinitions ?? [] : [])
  const [activityId, setActivityId] = useState(activities[0]?.id ?? '')
  const [nodeId, setNodeId] = useState('')
  const [edgeId, setEdgeId] = useState('')
  const activity = activities.find((candidate) => candidate.id === activityId) ?? activities[0]
  const selectedNode = activity?.graph.nodes.find((node) => node.id === nodeId)
  const selectedEdge = activity?.graph.edges.find((edge) => edge.id === edgeId)
  const projectionDesign = design.behavior.activityDefinitions === undefined && disabled
    ? { ...design, behavior: compatibility.behavior }
    : design
  const diagrams = useMemo(() => projectModuleBehaviorDiagrams({
    application: { id: projectionDesign.projectId },
    architecture: { id: projectionDesign.architecture.id },
    design: projectionDesign,
  }), [projectionDesign])
  const allocatedNodeIds = design.trace.workflowNodeIds ?? []
  const refinedNodeIds = new Set(activities.flatMap((item) => item.refinesWorkflowNodeIds))
  const missingNodeIds = allocatedNodeIds.filter((id) => !refinedNodeIds.has(id))

  function updateActivities(next: ModuleActivityDefinition[]) {
    onChange({
      ...design,
      behavior: {
        ...design.behavior,
        activityDefinitions: next,
      },
    })
  }

  function updateActivity(
    updater: (activity: ModuleActivityDefinition) => ModuleActivityDefinition,
  ) {
    if (!activity || disabled) return
    updateActivities(activities.map((candidate) =>
      candidate.id === activity.id ? updater(candidate) : candidate))
  }

  function updateNode(patch: Partial<ActivityNode>) {
    if (!selectedNode) return
    updateActivity((candidate) => ({
      ...candidate,
      graph: {
        ...candidate.graph,
        nodes: candidate.graph.nodes.map((node) =>
          node.id === selectedNode.id ? { ...node, ...patch } : node),
      },
    }))
  }

  function updateEdge(patch: Partial<ActivityEdge>) {
    if (!selectedEdge) return
    updateActivity((candidate) => ({
      ...candidate,
      graph: {
        ...candidate.graph,
        edges: candidate.graph.edges.map((edge) =>
          edge.id === selectedEdge.id ? { ...edge, ...patch } : edge),
      },
    }))
  }

  function addActivity() {
    if (disabled) return
    const id = uniqueId(`activity:${design.module.moduleId}`)
    const allocatedId = missingNodeIds[0]
    const next: ModuleActivityDefinition = {
      id,
      name: 'Define module activity',
      refinesWorkflowNodeIds: allocatedId ? [allocatedId] : [],
      graph: {
        id: `${id}:graph`,
        name: 'Define module activity',
        nodes: [
          { id: `${id}:start`, kind: 'initial', label: 'Initial', description: 'The module activity starts.', refinesIds: [] },
          { id: `${id}:action`, kind: 'action', label: 'Define module action', description: 'Define the internal module action.', refinesIds: allocatedId ? [allocatedId] : [] },
          { id: `${id}:end`, kind: 'final', label: 'Final', description: 'The module activity ends.', refinesIds: [] },
        ],
        edges: [
          { id: `${id}:edge:start`, fromNodeId: `${id}:start`, toNodeId: `${id}:action`, traceIds: [id] },
          { id: `${id}:edge:end`, fromNodeId: `${id}:action`, toNodeId: `${id}:end`, traceIds: [id] },
        ],
      },
    }
    updateActivities([...activities, next])
    setActivityId(id)
    setNodeId(`${id}:action`)
    setEdgeId('')
  }

  function addNode(kind: 'action' | 'call-operation' | 'send-event' | 'receive-event') {
    if (!activity || disabled) return
    const final = activity.graph.nodes.find((node) => node.kind === 'final')
    const incoming = final
      ? activity.graph.edges.find((edge) => edge.toNodeId === final.id)
      : undefined
    if (!final || !incoming) return
    const id = uniqueId(`${activity.id}:${kind}`)
    const operationId = kind === 'call-operation'
      ? [...design.providedOperations, ...design.requiredOperations][0]?.operationId
      : undefined
    const eventId = kind === 'send-event'
      ? design.behavior.emittedEvents[0]
      : kind === 'receive-event'
        ? design.behavior.consumedEvents[0]
        : undefined
    const labels = {
      action: 'Define module action',
      'call-operation': 'Call module operation',
      'send-event': 'Send module event',
      'receive-event': 'Receive module event',
    } as const
    updateActivity((candidate) => ({
      ...candidate,
      graph: {
        ...candidate.graph,
        nodes: [
          ...candidate.graph.nodes,
          {
            id,
            kind,
            label: labels[kind],
            description: 'Define the internal module action.',
            refinesIds: [],
            ...(operationId ? { operationId } : {}),
            ...(eventId ? { eventId } : {}),
          },
        ],
        edges: [
          ...candidate.graph.edges.map((edge) =>
            edge.id === incoming.id ? { ...edge, toNodeId: id } : edge),
          {
            id: uniqueId(`${activity.id}:edge`),
            fromNodeId: id,
            toNodeId: final.id,
            traceIds: [activity.id],
          },
        ],
      },
    }))
    setNodeId(id)
    setEdgeId('')
  }

  function addDecision() {
    if (!activity || disabled) return
    const final = activity.graph.nodes.find((node) => node.kind === 'final')
    const incoming = final
      ? activity.graph.edges.find((edge) => edge.toNodeId === final.id)
      : undefined
    if (!final || !incoming) return
    const decisionId = uniqueId(`${activity.id}:decision`)
    const successId = uniqueId(`${activity.id}:success`)
    const failureId = uniqueId(`${activity.id}:failure`)
    const mergeId = uniqueId(`${activity.id}:merge`)
    updateActivity((candidate) => ({
      ...candidate,
      graph: {
        ...candidate.graph,
        nodes: [
          ...candidate.graph.nodes,
          { id: decisionId, kind: 'decision', label: 'Define condition', description: 'Define the internal decision.', refinesIds: [] },
          { id: successId, kind: 'action', label: 'Handle success', description: 'Define the successful module action.', refinesIds: [] },
          { id: failureId, kind: 'action', label: 'Handle failure', description: 'Define the failed module action.', refinesIds: [] },
          { id: mergeId, kind: 'merge', label: 'Combine results', description: 'Combine the internal paths.', refinesIds: [] },
        ],
        edges: [
          ...candidate.graph.edges.map((edge) =>
            edge.id === incoming.id ? { ...edge, toNodeId: decisionId } : edge),
          { id: uniqueId('edge'), fromNodeId: decisionId, toNodeId: successId, guard: 'The condition is true.', outcome: 'success', traceIds: [activity.id] },
          { id: uniqueId('edge'), fromNodeId: decisionId, toNodeId: failureId, guard: 'The condition is false.', outcome: 'failure', traceIds: [activity.id] },
          { id: uniqueId('edge'), fromNodeId: successId, toNodeId: mergeId, traceIds: [activity.id] },
          { id: uniqueId('edge'), fromNodeId: failureId, toNodeId: mergeId, traceIds: [activity.id] },
          { id: uniqueId('edge'), fromNodeId: mergeId, toNodeId: final.id, traceIds: [activity.id] },
        ],
      },
    }))
    setNodeId(decisionId)
    setEdgeId('')
  }

  function addParallelBranch() {
    if (!activity || disabled) return
    const final = activity.graph.nodes.find((node) => node.kind === 'final')
    const incoming = final
      ? activity.graph.edges.find((edge) => edge.toNodeId === final.id)
      : undefined
    if (!final || !incoming) return
    const forkId = uniqueId(`${activity.id}:fork`)
    const leftId = uniqueId(`${activity.id}:action`)
    const rightId = uniqueId(`${activity.id}:action`)
    const joinId = uniqueId(`${activity.id}:join`)
    updateActivity((candidate) => ({
      ...candidate,
      graph: {
        ...candidate.graph,
        nodes: [
          ...candidate.graph.nodes,
          { id: forkId, kind: 'fork', label: 'Start parallel work', description: 'The module starts both branches.', refinesIds: [] },
          { id: leftId, kind: 'action', label: 'Perform first branch', description: 'The module performs the first branch.', refinesIds: [] },
          { id: rightId, kind: 'action', label: 'Perform second branch', description: 'The module performs the second branch.', refinesIds: [] },
          { id: joinId, kind: 'join', label: 'Finish parallel work', description: 'The module waits for both branches.', refinesIds: [] },
        ],
        edges: [
          ...candidate.graph.edges.map((edge) =>
            edge.id === incoming.id ? { ...edge, toNodeId: forkId } : edge),
          { id: uniqueId('edge'), fromNodeId: forkId, toNodeId: leftId, traceIds: [activity.id] },
          { id: uniqueId('edge'), fromNodeId: forkId, toNodeId: rightId, traceIds: [activity.id] },
          { id: uniqueId('edge'), fromNodeId: leftId, toNodeId: joinId, traceIds: [activity.id] },
          { id: uniqueId('edge'), fromNodeId: rightId, toNodeId: joinId, traceIds: [activity.id] },
          { id: uniqueId('edge'), fromNodeId: joinId, toNodeId: final.id, traceIds: [activity.id] },
        ],
      },
    }))
    setNodeId(forkId)
    setEdgeId('')
  }

  function updateStates(states: ModuleStateDefinition[]) {
    onChange({
      ...design,
      behavior: { ...design.behavior, stateDefinitions: states },
    })
  }

  function updateTransitions(transitions: ModuleStateTransition[]) {
    onChange({
      ...design,
      behavior: { ...design.behavior, stateTransitions: transitions },
    })
  }

  function updateInteractions(interactions: ModuleInteractionDefinition[]) {
    onChange({
      ...design,
      behavior: { ...design.behavior, interactionDefinitions: interactions },
    })
  }

  function handleDiagramSelection(diagram: DiagramProjection, elementId: string) {
    if (diagram.level !== 'module') return
    const projectedNode = diagram.nodes.find((node) => node.id === elementId)
    const sourceActivity = activities.find((candidate) =>
      candidate.graph.nodes.some((node) => projectedNode?.traceIds.includes(node.id))
      || candidate.graph.edges.some((edge) =>
        diagram.edges.find((item) => item.id === elementId)?.traceIds.includes(edge.id)))
    if (sourceActivity) setActivityId(sourceActivity.id)
    const sourceNode = sourceActivity?.graph.nodes.find((candidate) =>
      projectedNode?.traceIds.includes(candidate.id))
    if (sourceNode) {
      setNodeId(sourceNode.id)
      setEdgeId('')
      return
    }
    const projectedEdge = diagram.edges.find((edge) => edge.id === elementId)
    const sourceEdge = sourceActivity?.graph.edges.find((candidate) =>
      projectedEdge?.traceIds.includes(candidate.id))
    if (sourceEdge) {
      setEdgeId(sourceEdge.id)
      setNodeId('')
    }
  }

  return (
    <section className="cap-module-behavior-editor" aria-labelledby="module-behavior-heading">
      <header className="cap-behavior-workspace-head">
        <div>
          <p className="capabilities-eyebrow">Internal module behavior</p>
          <h5 id="module-behavior-heading">Perform module work</h5>
          <p>Define internal decisions, operation calls, events, retry, recovery, and state changes.</p>
        </div>
        <div className="cap-behavior-status">
          <span className={missingNodeIds.length ? 'badge badge-warning' : 'badge approved'}>
            {allocatedNodeIds.length - missingNodeIds.length} of {allocatedNodeIds.length} actions refined
          </span>
          <span>{activities.length} activities</span>
        </div>
      </header>

      <div className="cap-behavior-selector">
        <label>
          <span>Module activity</span>
          <select
            value={activity?.id ?? ''}
            onChange={(event) => {
              setActivityId(event.target.value)
              setNodeId('')
              setEdgeId('')
            }}
          >
            {activities.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
            ))}
          </select>
        </label>
        {!disabled ? (
          <div className="cap-behavior-commands" role="group" aria-label="Module behavior commands">
            <button type="button" className="btn btn-secondary btn-compact" onClick={addActivity}>Add activity</button>
            <button type="button" className="btn btn-secondary btn-compact" onClick={() => addNode('action')} disabled={!activity}>Add action</button>
            <button type="button" className="btn btn-secondary btn-compact" onClick={() => addNode('call-operation')} disabled={!activity}>Add call</button>
            <button type="button" className="btn btn-secondary btn-compact" onClick={() => addNode('receive-event')} disabled={!activity}>Add receive</button>
            <button type="button" className="btn btn-secondary btn-compact" onClick={() => addNode('send-event')} disabled={!activity}>Add send</button>
            <button type="button" className="btn btn-secondary btn-compact" onClick={addDecision} disabled={!activity}>Add decision</button>
            <button type="button" className="btn btn-secondary btn-compact" onClick={addParallelBranch} disabled={!activity}>Add parallel work</button>
          </div>
        ) : null}
      </div>

      {activity ? (
        <>
          <div className="cap-module-activity-meta">
            <label>
              <span>Activity name</span>
              <input
                disabled={disabled}
                value={activity.name}
                onChange={(event) => updateActivity((candidate) => ({
                  ...candidate,
                  name: event.target.value,
                  graph: { ...candidate.graph, name: event.target.value },
                }))}
              />
            </label>
            <label>
              <span>Entry operation</span>
              <select
                disabled={disabled}
                value={activity.entryOperationId ?? ''}
                onChange={(event) => updateActivity((candidate) => ({
                  ...candidate,
                  entryOperationId: event.target.value || undefined,
                }))}
              >
                <option value="">No entry operation</option>
                {[...design.providedOperations, ...design.requiredOperations].map((operation) => (
                  <option key={operation.operationId} value={operation.operationId}>{operation.operationId}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Allocated actions</span>
              <select
                multiple
                disabled={disabled}
                value={activity.refinesWorkflowNodeIds}
                onChange={(event) => updateActivity((candidate) => ({
                  ...candidate,
                  refinesWorkflowNodeIds: Array.from(event.target.selectedOptions).map((option) => option.value),
                }))}
              >
                {allocatedNodeIds.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            </label>
          </div>
          <div className={`cap-behavior-layout${selectedNode || selectedEdge ? ' has-editor' : ''}`}>
            <div className="cap-behavior-canvas">
              <UmlDiagramWorkspace
                diagrams={diagrams}
                onSelectElement={handleDiagramSelection}
              />
            </div>
            {selectedNode ? (
              <aside className="cap-behavior-editor" aria-label="Activity node editor">
                <span>{selectedNode.kind}</span>
                <h4>{selectedNode.label}</h4>
                <label>
                  <span>Concise label</span>
                  <input disabled={disabled} value={selectedNode.label} onChange={(event) => updateNode({ label: event.target.value })} />
                </label>
                <label>
                  <span>Internal result</span>
                  <textarea disabled={disabled} rows={3} value={selectedNode.description} onChange={(event) => updateNode({ description: event.target.value })} />
                </label>
                {selectedNode.kind === 'call-operation' ? (
                  <label>
                    <span>Operation</span>
                    <select
                      disabled={disabled}
                      value={selectedNode.operationId ?? ''}
                      onChange={(event) => updateNode({ operationId: event.target.value || undefined })}
                    >
                      <option value="">Select operation</option>
                      {[...design.providedOperations, ...design.requiredOperations].map((operation) => (
                        <option key={operation.operationId} value={operation.operationId}>{operation.operationId}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {selectedNode.kind === 'send-event' || selectedNode.kind === 'receive-event' ? (
                  <label>
                    <span>Event</span>
                    <select
                      disabled={disabled}
                      value={selectedNode.eventId ?? ''}
                      onChange={(event) => updateNode({ eventId: event.target.value || undefined })}
                    >
                      <option value="">Select event</option>
                      {[...design.behavior.emittedEvents, ...design.behavior.consumedEvents].map((eventId) => (
                        <option key={eventId} value={eventId}>{eventId}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </aside>
            ) : selectedEdge ? (
              <aside className="cap-behavior-editor" aria-label="Activity edge editor">
                <span>Control flow</span>
                <h4>{selectedEdge.outcome ?? 'Continue'}</h4>
                <label>
                  <span>Guard</span>
                  <input
                    disabled={disabled}
                    value={selectedEdge.guard ?? ''}
                    onChange={(event) => updateEdge({ guard: event.target.value || undefined })}
                  />
                </label>
                <label>
                  <span>Outcome</span>
                  <select
                    disabled={disabled}
                    value={selectedEdge.outcome ?? ''}
                    onChange={(event) => updateEdge({
                      outcome: event.target.value
                        ? event.target.value as ActivityEdge['outcome']
                        : undefined,
                    })}
                  >
                    <option value="">Continue</option>
                    <option value="success">Success</option>
                    <option value="alternate">Alternate</option>
                    <option value="failure">Failure</option>
                    <option value="recovery">Recovery</option>
                  </select>
                </label>
                <label>
                  <span>Loop exit condition</span>
                  <input
                    disabled={disabled}
                    value={selectedEdge.loop?.exitCondition ?? ''}
                    onChange={(event) => updateEdge({
                      loop: event.target.value
                        ? {
                          exitCondition: event.target.value,
                          maximumIterations: selectedEdge.loop?.maximumIterations ?? 3,
                        }
                        : undefined,
                    })}
                  />
                </label>
              </aside>
            ) : null}
          </div>
        </>
      ) : (
        <div className="cap-behavior-empty">
          <p>
            {design.behavior.activities.length
              ? 'Create a review draft from the legacy module activity list.'
              : 'Add a structured activity. Do not copy the application workflow into this module.'}
          </p>
          {!disabled && design.behavior.activities.length ? (
            <button
              type="button"
              className="btn btn-primary btn-compact"
              onClick={() => onChange({
                ...design,
                status: 'draft',
                behavior: compatibility.behavior,
              })}
            >
              Create behavior draft
            </button>
          ) : !disabled ? (
            <button type="button" className="btn btn-primary btn-compact" onClick={addActivity}>Add first activity</button>
          ) : null}
        </div>
      )}

      <div className="cap-module-state-editor">
        <section>
          <header>
            <div><h5>Module states</h5><p>States are internal to this module.</p></div>
            {!disabled ? (
              <button
                type="button"
                className="btn btn-secondary btn-compact"
                onClick={() => updateStates([
                  ...(design.behavior.stateDefinitions ?? []),
                  { id: uniqueId('state'), name: 'Define state', entryActionIds: [], exitActionIds: [] },
                ])}
              >
                Add state
              </button>
            ) : null}
          </header>
          {(design.behavior.stateDefinitions ?? []).map((state) => (
            <label key={state.id}>
              <span>{state.id}</span>
              <input
                disabled={disabled}
                value={state.name}
                onChange={(event) => updateStates((design.behavior.stateDefinitions ?? []).map((candidate) =>
                  candidate.id === state.id ? { ...candidate, name: event.target.value } : candidate))}
              />
            </label>
          ))}
        </section>
        <section>
          <header>
            <div><h5>State transitions</h5><p>Each transition has a trigger and optional guard.</p></div>
            {!disabled && (design.behavior.stateDefinitions?.length ?? 0) >= 2 ? (
              <button
                type="button"
                className="btn btn-secondary btn-compact"
                onClick={() => {
                  const states = design.behavior.stateDefinitions!
                  updateTransitions([
                    ...(design.behavior.stateTransitions ?? []),
                    {
                      id: uniqueId('transition'),
                      fromStateId: states[0]!.id,
                      toStateId: states[1]!.id,
                      trigger: 'Define trigger',
                      effectActivityNodeIds: [],
                    },
                  ])
                }}
              >
                Add transition
              </button>
            ) : null}
          </header>
          {(design.behavior.stateTransitions ?? []).map((transition) => (
            <div className="cap-state-transition-row" key={transition.id}>
              <select
                disabled={disabled}
                value={transition.fromStateId}
                onChange={(event) => updateTransitions((design.behavior.stateTransitions ?? []).map((candidate) =>
                  candidate.id === transition.id ? { ...candidate, fromStateId: event.target.value } : candidate))}
              >
                {(design.behavior.stateDefinitions ?? []).map((state) => <option key={state.id} value={state.id}>{state.name}</option>)}
              </select>
              <span aria-hidden="true">→</span>
              <select
                disabled={disabled}
                value={transition.toStateId}
                onChange={(event) => updateTransitions((design.behavior.stateTransitions ?? []).map((candidate) =>
                  candidate.id === transition.id ? { ...candidate, toStateId: event.target.value } : candidate))}
              >
                {(design.behavior.stateDefinitions ?? []).map((state) => <option key={state.id} value={state.id}>{state.name}</option>)}
              </select>
              <input
                disabled={disabled}
                aria-label={`Trigger for ${transition.id}`}
                value={transition.trigger}
                onChange={(event) => updateTransitions((design.behavior.stateTransitions ?? []).map((candidate) =>
                  candidate.id === transition.id ? { ...candidate, trigger: event.target.value } : candidate))}
              />
              <input
                disabled={disabled}
                aria-label={`Guard for ${transition.id}`}
                placeholder="Optional guard"
                value={transition.guard ?? ''}
                onChange={(event) => updateTransitions((design.behavior.stateTransitions ?? []).map((candidate) =>
                  candidate.id === transition.id
                    ? { ...candidate, guard: event.target.value || undefined }
                    : candidate))}
              />
              <select
                multiple
                disabled={disabled}
                aria-label={`Effects for ${transition.id}`}
                value={transition.effectActivityNodeIds}
                onChange={(event) => updateTransitions((design.behavior.stateTransitions ?? []).map((candidate) =>
                  candidate.id === transition.id
                    ? {
                      ...candidate,
                      effectActivityNodeIds: Array.from(event.target.selectedOptions)
                        .map((option) => option.value),
                    }
                    : candidate))}
              >
                {activities.flatMap((item) => item.graph.nodes)
                  .filter((node) => !['initial', 'final', 'decision', 'merge', 'fork', 'join'].includes(node.kind))
                  .map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}
              </select>
            </div>
          ))}
        </section>
      </div>

      <section className="cap-module-interaction-editor">
        <header>
          <div>
            <h5>Internal interactions</h5>
            <p>Sequence diagrams use these participants and messages.</p>
          </div>
          {!disabled ? (
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              onClick={() => {
                const id = uniqueId('interaction')
                updateInteractions([
                  ...(design.behavior.interactionDefinitions ?? []),
                  {
                    id,
                    name: 'Define internal interaction',
                    participants: [
                      { id: 'module', label: design.module.name, kind: 'module' },
                      { id: 'peer', label: 'Connected module', kind: 'module' },
                    ],
                    messages: [],
                  },
                ])
              }}
            >
              Add interaction
            </button>
          ) : null}
        </header>
        {(design.behavior.interactionDefinitions ?? []).map((interaction) => (
          <article key={interaction.id}>
            <div className="cap-module-interaction-head">
              <input
                disabled={disabled}
                aria-label={`Name for ${interaction.id}`}
                value={interaction.name}
                onChange={(event) => updateInteractions((design.behavior.interactionDefinitions ?? [])
                  .map((candidate) => candidate.id === interaction.id
                    ? { ...candidate, name: event.target.value }
                    : candidate))}
              />
              {!disabled ? (
                <div className="cap-module-interaction-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-compact"
                    onClick={() => {
                      const participantId = uniqueId('participant')
                      updateInteractions((design.behavior.interactionDefinitions ?? [])
                        .map((candidate) => candidate.id === interaction.id
                          ? {
                            ...candidate,
                            participants: [
                              ...candidate.participants,
                              { id: participantId, label: 'Define participant', kind: 'module' },
                            ],
                          }
                          : candidate))
                    }}
                  >
                    Add participant
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-compact"
                    onClick={() => {
                      const messageId = uniqueId('message')
                      updateInteractions((design.behavior.interactionDefinitions ?? [])
                        .map((candidate) => candidate.id === interaction.id
                          ? {
                            ...candidate,
                            messages: [
                              ...candidate.messages,
                              {
                                id: messageId,
                                fromParticipantId: candidate.participants[0]?.id ?? 'module',
                                toParticipantId: candidate.participants[1]?.id ?? 'peer',
                                label: 'Call module operation',
                                kind: 'synchronous',
                                refinesActivityNodeIds: [],
                              },
                            ],
                          }
                          : candidate))
                    }}
                  >
                    Add message
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-compact"
                    disabled={!interaction.messages.length}
                    onClick={() => {
                      const fragmentId = uniqueId('fragment')
                      updateInteractions((design.behavior.interactionDefinitions ?? [])
                        .map((candidate) => candidate.id === interaction.id
                          ? {
                            ...candidate,
                            fragments: [
                              ...(candidate.fragments ?? []),
                              {
                                id: fragmentId,
                                kind: 'alt',
                                label: 'Alternate result',
                                guard: 'The alternate condition is true.',
                                messageIds: [candidate.messages[0]!.id],
                              },
                            ],
                          }
                          : candidate))
                    }}
                  >
                    Add fragment
                  </button>
                </div>
              ) : null}
            </div>
            <section className="cap-module-participants" aria-label="Sequence participants">
              <h6>Participants</h6>
              {interaction.participants.map((participant) => (
                <div key={participant.id}>
                  <input
                    disabled={disabled}
                    aria-label={`Label for ${participant.id}`}
                    value={participant.label}
                    onChange={(event) => updateInteractions((design.behavior.interactionDefinitions ?? [])
                      .map((candidate) => candidate.id === interaction.id
                        ? {
                          ...candidate,
                          participants: candidate.participants.map((item) => item.id === participant.id
                            ? { ...item, label: event.target.value }
                            : item),
                        }
                        : candidate))}
                  />
                  <select
                    disabled={disabled}
                    aria-label={`Kind for ${participant.id}`}
                    value={participant.kind}
                    onChange={(event) => updateInteractions((design.behavior.interactionDefinitions ?? [])
                      .map((candidate) => candidate.id === interaction.id
                        ? {
                          ...candidate,
                          participants: candidate.participants.map((item) => item.id === participant.id
                            ? { ...item, kind: event.target.value as typeof item.kind }
                            : item),
                        }
                        : candidate))}
                  >
                    <option value="actor">Actor</option>
                    <option value="module">Module</option>
                    <option value="operation">Operation</option>
                    <option value="external">External</option>
                  </select>
                </div>
              ))}
            </section>
            {interaction.messages.map((message) => (
              <div className="cap-module-message" key={message.id}>
                <div className="cap-module-message-row">
                  <select
                    disabled={disabled}
                    aria-label={`Source for ${message.id}`}
                    value={message.fromParticipantId}
                    onChange={(event) => updateInteractions((design.behavior.interactionDefinitions ?? [])
                      .map((candidate) => candidate.id === interaction.id
                        ? {
                          ...candidate,
                          messages: candidate.messages.map((item) => item.id === message.id
                            ? { ...item, fromParticipantId: event.target.value }
                            : item),
                        }
                        : candidate))}
                  >
                    {interaction.participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.label}</option>)}
                  </select>
                  <select
                    disabled={disabled}
                    aria-label={`Kind for ${message.id}`}
                    value={message.kind}
                    onChange={(event) => updateInteractions((design.behavior.interactionDefinitions ?? [])
                      .map((candidate) => candidate.id === interaction.id
                        ? {
                          ...candidate,
                          messages: candidate.messages.map((item) => item.id === message.id
                            ? {
                              ...item,
                              kind: event.target.value as typeof item.kind,
                              operationId: undefined,
                              eventId: undefined,
                            }
                            : item),
                        }
                        : candidate))}
                  >
                    <option value="synchronous">Call</option>
                    <option value="reply">Reply</option>
                    <option value="event">Event</option>
                  </select>
                  <select
                    disabled={disabled}
                    aria-label={`Target for ${message.id}`}
                    value={message.toParticipantId}
                    onChange={(event) => updateInteractions((design.behavior.interactionDefinitions ?? [])
                      .map((candidate) => candidate.id === interaction.id
                        ? {
                          ...candidate,
                          messages: candidate.messages.map((item) => item.id === message.id
                            ? { ...item, toParticipantId: event.target.value }
                            : item),
                        }
                        : candidate))}
                  >
                    {interaction.participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.label}</option>)}
                  </select>
                  <input
                    disabled={disabled}
                    aria-label={`Label for ${message.id}`}
                    value={message.label}
                    onChange={(event) => updateInteractions((design.behavior.interactionDefinitions ?? [])
                      .map((candidate) => candidate.id === interaction.id
                        ? {
                          ...candidate,
                          messages: candidate.messages.map((item) => item.id === message.id
                            ? { ...item, label: event.target.value }
                            : item),
                        }
                        : candidate))}
                  />
                </div>
                <div className="cap-module-message-details">
                  <input
                    disabled={disabled}
                    aria-label={`Guard for ${message.id}`}
                    placeholder="Optional guard"
                    value={message.guard ?? ''}
                    onChange={(event) => updateInteractions((design.behavior.interactionDefinitions ?? [])
                      .map((candidate) => candidate.id === interaction.id
                        ? {
                          ...candidate,
                          messages: candidate.messages.map((item) => item.id === message.id
                            ? { ...item, guard: event.target.value || undefined }
                            : item),
                        }
                        : candidate))}
                  />
                  <select
                    disabled={disabled}
                    aria-label={`Binding for ${message.id}`}
                    value={message.kind === 'event' ? message.eventId ?? '' : message.operationId ?? ''}
                    onChange={(event) => updateInteractions((design.behavior.interactionDefinitions ?? [])
                      .map((candidate) => candidate.id === interaction.id
                        ? {
                          ...candidate,
                          messages: candidate.messages.map((item) => item.id === message.id
                            ? message.kind === 'event'
                              ? { ...item, eventId: event.target.value || undefined }
                              : { ...item, operationId: event.target.value || undefined }
                            : item),
                        }
                        : candidate))}
                  >
                    <option value="">No binding</option>
                    {(message.kind === 'event'
                      ? [...design.behavior.emittedEvents, ...design.behavior.consumedEvents]
                      : [...design.providedOperations, ...design.requiredOperations]
                        .map((operation) => operation.operationId))
                      .map((id) => <option key={id} value={id}>{id}</option>)}
                  </select>
                  <select
                    multiple
                    disabled={disabled}
                    aria-label={`Refinements for ${message.id}`}
                    value={message.refinesActivityNodeIds}
                    onChange={(event) => updateInteractions((design.behavior.interactionDefinitions ?? [])
                      .map((candidate) => candidate.id === interaction.id
                        ? {
                          ...candidate,
                          messages: candidate.messages.map((item) => item.id === message.id
                            ? {
                              ...item,
                              refinesActivityNodeIds: Array.from(event.target.selectedOptions)
                                .map((option) => option.value),
                            }
                            : item),
                        }
                        : candidate))}
                  >
                    {activities.flatMap((item) => item.graph.nodes)
                      .filter((node) => !['initial', 'final', 'decision', 'merge', 'fork', 'join'].includes(node.kind))
                      .map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}
                  </select>
                </div>
              </div>
            ))}
            {(interaction.fragments ?? []).length ? (
              <section className="cap-module-fragments" aria-label="Sequence fragments">
                <h6>Fragments</h6>
                {(interaction.fragments ?? []).map((fragment) => (
                  <div key={fragment.id}>
                    <select
                      disabled={disabled}
                      aria-label={`Kind for ${fragment.id}`}
                      value={fragment.kind}
                      onChange={(event) => updateInteractions((design.behavior.interactionDefinitions ?? [])
                        .map((candidate) => candidate.id === interaction.id
                          ? {
                            ...candidate,
                            fragments: (candidate.fragments ?? []).map((item) => item.id === fragment.id
                              ? { ...item, kind: event.target.value as typeof item.kind }
                              : item),
                          }
                          : candidate))}
                    >
                      <option value="alt">Alternate</option>
                      <option value="opt">Optional</option>
                      <option value="loop">Loop</option>
                    </select>
                    <input
                      disabled={disabled}
                      aria-label={`Label for ${fragment.id}`}
                      value={fragment.label}
                      onChange={(event) => updateInteractions((design.behavior.interactionDefinitions ?? [])
                        .map((candidate) => candidate.id === interaction.id
                          ? {
                            ...candidate,
                            fragments: (candidate.fragments ?? []).map((item) => item.id === fragment.id
                              ? { ...item, label: event.target.value }
                              : item),
                          }
                          : candidate))}
                    />
                    <input
                      disabled={disabled}
                      aria-label={`Guard for ${fragment.id}`}
                      placeholder="Optional guard"
                      value={fragment.guard ?? ''}
                      onChange={(event) => updateInteractions((design.behavior.interactionDefinitions ?? [])
                        .map((candidate) => candidate.id === interaction.id
                          ? {
                            ...candidate,
                            fragments: (candidate.fragments ?? []).map((item) => item.id === fragment.id
                              ? { ...item, guard: event.target.value || undefined }
                              : item),
                          }
                          : candidate))}
                    />
                    <select
                      multiple
                      disabled={disabled}
                      aria-label={`Messages for ${fragment.id}`}
                      value={fragment.messageIds}
                      onChange={(event) => updateInteractions((design.behavior.interactionDefinitions ?? [])
                        .map((candidate) => candidate.id === interaction.id
                          ? {
                            ...candidate,
                            fragments: (candidate.fragments ?? []).map((item) => item.id === fragment.id
                              ? {
                                ...item,
                                messageIds: Array.from(event.target.selectedOptions)
                                  .map((option) => option.value),
                              }
                              : item),
                          }
                          : candidate))}
                    >
                      {interaction.messages.map((message) => (
                        <option key={message.id} value={message.id}>{message.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </section>
            ) : null}
          </article>
        ))}
      </section>

      <footer className="cap-behavior-trace">
        <div><span>Allocated actions</span>{allocatedNodeIds.map((id) => <code key={id}>{id}</code>)}</div>
        <div><span>Missing refinement</span>{missingNodeIds.length ? missingNodeIds.map((id) => <code key={id}>{id}</code>) : 'None'}</div>
      </footer>
    </section>
  )
}
