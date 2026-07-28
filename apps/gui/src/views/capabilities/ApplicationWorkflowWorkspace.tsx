import { useMemo, useState } from 'react'
import type {
  ActivityEdge,
  ActivityNode,
  ApplicationSpecification,
  ApplicationWorkflowDefinition,
  DiagramProjection,
} from '@engineering-ui-kit/core'
import {
  canonicalHash,
  evaluateApplicationWorkflows,
  materializeApplicationWorkflows,
  migrateLegacyUseCaseToWorkflow,
  projectApplicationBehaviorDiagrams,
  projectUseCaseDiagram,
} from '@engineering-ui-kit/core/browser'
import { UmlDiagramWorkspace } from './UmlDiagramWorkspace'

type Props = {
  specification: ApplicationSpecification
  approved: boolean
  onSave: (specification: ApplicationSpecification) => void | Promise<void>
}

type Selection =
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | undefined

let uniqueSequence = 0

function uniqueId(prefix: string): string {
  uniqueSequence += 1
  return `${prefix}-${Date.now().toString(36)}-${uniqueSequence.toString(36)}`
}

function hashSpecification(specification: ApplicationSpecification): ApplicationSpecification {
  const next = { ...specification, status: 'draft' as const, contentHash: '' }
  next.contentHash = canonicalHash({ ...next, contentHash: undefined })
  return next
}

export function ApplicationWorkflowWorkspace({ specification, approved, onSave }: Props) {
  const hasCanonicalWorkflows = Boolean(specification.applicationWorkflows?.length)
  const workflows = hasCanonicalWorkflows
    ? specification.applicationWorkflows!
    : approved
      ? materializeApplicationWorkflows(specification)
      : []
  const [workflowId, setWorkflowId] = useState(workflows[0]?.id ?? '')
  const [selection, setSelection] = useState<Selection>()
  const selectedWorkflow = workflows.find((workflow) => workflow.id === workflowId) ?? workflows[0]
  const projected = useMemo(
    () => projectApplicationBehaviorDiagrams(specification),
    [specification],
  )
  const selectedDiagram = selectedWorkflow
    ? projected.filter((item) => item.contextId === selectedWorkflow.id)
    : []
  const diagrams = [
    projectUseCaseDiagram(specification),
    ...selectedDiagram,
  ]
  const selectedNode = selection?.kind === 'node'
    ? selectedWorkflow?.graph.nodes.find((node) => node.id === selection.id)
    : undefined
  const selectedEdge = selection?.kind === 'edge'
    ? selectedWorkflow?.graph.edges.find((edge) => edge.id === selection.id)
    : undefined
  const selectedUseCase = (specification.useCaseDefinitions ?? [])
    .find((useCase) => useCase.id === selectedWorkflow?.useCaseId)
  const selectedUseCaseSteps = selectedUseCase
    ? [
        ...selectedUseCase.mainFlow,
        ...selectedUseCase.alternatePaths.flatMap((path) => path.steps),
        ...selectedUseCase.failurePaths.flatMap((path) => path.steps),
        ...selectedUseCase.recoveryPaths.flatMap((path) => path.steps),
      ]
    : []
  const diagnostics = evaluateApplicationWorkflows(specification).diagnostics

  async function commit(nextWorkflows: ApplicationWorkflowDefinition[]) {
    await onSave(hashSpecification({
      ...specification,
      applicationWorkflows: nextWorkflows,
      scenarioDefinitions: undefined,
    }))
  }

  async function createWorkflowDrafts() {
    const migrated = (specification.useCaseDefinitions ?? []).map((useCase) =>
      migrateLegacyUseCaseToWorkflow(useCase).workflow)
    if (!migrated.length) return
    setWorkflowId(migrated[0]!.id)
    await commit(migrated)
  }

  async function updateWorkflow(
    updater: (workflow: ApplicationWorkflowDefinition) => ApplicationWorkflowDefinition,
  ) {
    if (!selectedWorkflow || approved) return
    await commit(workflows.map((workflow) =>
      workflow.id === selectedWorkflow.id ? updater(workflow) : workflow))
  }

  async function updateNode(patch: Partial<ActivityNode>) {
    if (!selectedNode) return
    await updateWorkflow((workflow) => ({
      ...workflow,
      graph: {
        ...workflow.graph,
        nodes: workflow.graph.nodes.map((node) =>
          node.id === selectedNode.id ? { ...node, ...patch } : node),
      },
    }))
  }

  async function updateEdge(patch: Partial<ActivityEdge>) {
    if (!selectedEdge) return
    await updateWorkflow((workflow) => ({
      ...workflow,
      graph: {
        ...workflow.graph,
        edges: workflow.graph.edges.map((edge) =>
          edge.id === selectedEdge.id ? { ...edge, ...patch } : edge),
      },
    }))
  }

  async function insertAction() {
    if (!selectedWorkflow || approved) return
    const final = selectedWorkflow.graph.nodes.find((node) => node.kind === 'final')
    const incoming = final
      ? selectedWorkflow.graph.edges.find((edge) => edge.toNodeId === final.id)
      : undefined
    if (!final || !incoming) return
    const id = uniqueId('action')
    await updateWorkflow((workflow) => ({
      ...workflow,
      graph: {
        ...workflow.graph,
        nodes: [
          ...workflow.graph.nodes,
          {
            id,
            kind: 'action',
            label: 'Define action',
            description: 'Define the observable application action.',
            refinesIds: [],
          },
        ],
        edges: [
          ...workflow.graph.edges.map((edge) =>
            edge.id === incoming.id ? { ...edge, toNodeId: id } : edge),
          {
            id: uniqueId('edge'),
            fromNodeId: id,
            toNodeId: final.id,
            traceIds: [...workflow.pathIds],
          },
        ],
      },
    }))
    setSelection({ kind: 'node', id })
  }

  async function insertBranch(
    kind: 'decision' | 'fork',
    secondaryOutcome: 'alternate' | 'failure' | 'recovery' = 'alternate',
  ) {
    if (!selectedWorkflow || approved) return
    const final = selectedWorkflow.graph.nodes.find((node) => node.kind === 'final')
    const incoming = final
      ? selectedWorkflow.graph.edges.find((edge) => edge.toNodeId === final.id)
      : undefined
    if (!final || !incoming) return
    const splitId = uniqueId(kind)
    const leftId = uniqueId('action')
    const rightId = uniqueId('action')
    const combineKind = kind === 'decision' ? 'merge' : 'join'
    const combineId = uniqueId(combineKind)
    const mainPathId = selectedWorkflow.pathIds.find((pathId) =>
      !selectedUseCase?.alternatePaths.some((path) => path.id === pathId)
      && !selectedUseCase?.failurePaths.some((path) => path.id === pathId)
      && !selectedUseCase?.recoveryPaths.some((path) => path.id === pathId))
      ?? selectedWorkflow.pathIds[0]
    const secondaryPathId = selectedUseCase
      ? [
          ...selectedUseCase.alternatePaths,
          ...selectedUseCase.failurePaths,
          ...selectedUseCase.recoveryPaths,
        ].find((path) => path.kind === secondaryOutcome)?.id
      : undefined
    const traceIds = [...selectedWorkflow.pathIds]
    const primaryTraceIds = mainPathId ? [mainPathId] : traceIds
    const secondaryTraceIds = secondaryPathId ? [secondaryPathId] : traceIds
    const branchEdges: ActivityEdge[] = [
      {
        id: uniqueId('edge'),
        fromNodeId: splitId,
        toNodeId: leftId,
        ...(kind === 'decision' ? { guard: 'The primary condition is true.', outcome: 'success' as const } : {}),
        traceIds: kind === 'decision' ? primaryTraceIds : traceIds,
      },
      {
        id: uniqueId('edge'),
        fromNodeId: splitId,
        toNodeId: rightId,
        ...(kind === 'decision'
          ? {
            guard: `The ${secondaryOutcome} condition is true.`,
            outcome: secondaryOutcome,
          }
          : {}),
        traceIds: kind === 'decision' ? secondaryTraceIds : traceIds,
      },
      { id: uniqueId('edge'), fromNodeId: leftId, toNodeId: combineId, traceIds },
      { id: uniqueId('edge'), fromNodeId: rightId, toNodeId: combineId, traceIds },
      { id: uniqueId('edge'), fromNodeId: combineId, toNodeId: final.id, traceIds },
    ]
    await updateWorkflow((workflow) => ({
      ...workflow,
      graph: {
        ...workflow.graph,
        nodes: [
          ...workflow.graph.nodes,
          {
            id: splitId,
            kind,
            label: kind === 'decision' ? 'Define condition' : 'Start parallel work',
            description: kind === 'decision'
              ? 'Define the observable branch condition.'
              : 'Start the parallel application actions.',
            refinesIds: [],
          },
          {
            id: leftId,
            kind: 'action',
            label: 'Define primary action',
            description: 'Define the primary application action.',
            refinesIds: [],
          },
          {
            id: rightId,
            kind: 'action',
            label: kind === 'decision'
              ? `Define ${secondaryOutcome} action`
              : 'Define parallel action',
            description: kind === 'decision'
              ? `Define the ${secondaryOutcome} application action.`
              : 'Define the parallel application action.',
            refinesIds: [],
          },
          {
            id: combineId,
            kind: combineKind,
            label: kind === 'decision' ? 'Combine paths' : 'Wait for branches',
            description: kind === 'decision'
              ? 'Combine the alternate application paths.'
              : 'Wait for all parallel actions.',
            refinesIds: [],
          },
        ],
        edges: [
          ...workflow.graph.edges.map((edge) =>
            edge.id === incoming.id ? { ...edge, toNodeId: splitId } : edge),
          ...branchEdges,
        ],
      },
    }))
    setSelection({ kind: 'node', id: splitId })
  }

  function handleDiagramSelection(diagram: DiagramProjection, elementId: string) {
    if (!selectedWorkflow || diagram.level !== 'application') return
    const projectionNode = diagram.nodes.find((node) => node.id === elementId)
    const node = selectedWorkflow.graph.nodes.find((candidate) =>
      projectionNode?.traceIds.includes(candidate.id))
    if (node) {
      setSelection({ kind: 'node', id: node.id })
      return
    }
    const projectionEdge = diagram.edges.find((edge) => edge.id === elementId)
    const edge = selectedWorkflow.graph.edges.find((candidate) =>
      projectionEdge?.traceIds.includes(candidate.id))
    setSelection(edge ? { kind: 'edge', id: edge.id } : undefined)
  }

  if (!workflows.length) {
    return (
      <section className="cap-behavior-workspace cap-behavior-empty" aria-label="Application workflows">
        <div>
          <p className="capabilities-eyebrow">Application workflows</p>
          <h3>Model application behavior</h3>
          <p>Define observable branches, failures, recovery, and parallel work before solution design.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-compact"
          disabled={approved || !(specification.useCaseDefinitions?.length)}
          onClick={() => void createWorkflowDrafts()}
        >
          Create workflow drafts
        </button>
        {approved ? <p className="capabilities-note">Create a new application revision to add structured workflows.</p> : null}
      </section>
    )
  }

  return (
    <section className="cap-behavior-workspace" aria-labelledby="application-workflow-heading">
      <header className="cap-behavior-workspace-head">
        <div>
          <p className="capabilities-eyebrow">Application workflows</p>
          <h3 id="application-workflow-heading">Observable application behavior</h3>
          <p>These diagrams define what the application does. They do not contain modules or implementation operations.</p>
        </div>
        <div className="cap-behavior-status">
          <span className={diagnostics.length ? 'badge badge-warning' : 'badge approved'}>
            {diagnostics.length ? `${diagnostics.length} issues` : 'Workflow ready'}
          </span>
          <span>{selectedWorkflow?.graph.nodes.length ?? 0} nodes</span>
        </div>
      </header>

      {!hasCanonicalWorkflows ? (
        <p className="capabilities-note" role="note">
          This approved revision uses a read-only compatibility workflow. Create a new application revision to adopt structured behavior.
        </p>
      ) : null}

      <div className="cap-behavior-selector">
        <label>
          <span>Application workflow</span>
          <select
            value={selectedWorkflow?.id}
            onChange={(event) => {
              setWorkflowId(event.target.value)
              setSelection(undefined)
            }}
          >
            {workflows.map((workflow) => (
              <option key={workflow.id} value={workflow.id}>{workflow.name}</option>
            ))}
          </select>
        </label>
        {!approved ? (
          <div className="cap-behavior-commands" role="group" aria-label="Workflow commands">
            <button type="button" className="btn btn-secondary btn-compact" onClick={() => void insertAction()}>
              Add action
            </button>
            <button type="button" className="btn btn-secondary btn-compact" onClick={() => void insertBranch('decision')}>
              Add decision
            </button>
            <button type="button" className="btn btn-secondary btn-compact" onClick={() => void insertBranch('decision')}>
              Add alternate path
            </button>
            <button type="button" className="btn btn-secondary btn-compact" onClick={() => void insertBranch('decision', 'failure')}>
              Add failure path
            </button>
            <button type="button" className="btn btn-secondary btn-compact" onClick={() => void insertBranch('decision', 'recovery')}>
              Add recovery path
            </button>
            <button type="button" className="btn btn-secondary btn-compact" onClick={() => void insertBranch('fork')}>
              Add parallel branch
            </button>
          </div>
        ) : null}
      </div>

      <div className={`cap-behavior-layout${selection ? ' has-editor' : ''}`}>
        <div className="cap-behavior-canvas">
          <UmlDiagramWorkspace diagrams={diagrams} onSelectElement={handleDiagramSelection} />
        </div>
        {selection ? (
          <aside className="cap-behavior-editor" aria-label="Workflow element editor">
            {selectedNode ? (
              <>
                <span>{selectedNode.kind}</span>
                <h4>{selectedNode.label}</h4>
                <label>
                  <span>Concise label</span>
                  <input
                    disabled={approved}
                    value={selectedNode.label}
                    onChange={(event) => void updateNode({ label: event.target.value })}
                  />
                </label>
                <label>
                  <span>Observable result</span>
                  <textarea
                    disabled={approved}
                    rows={3}
                    value={selectedNode.description}
                    onChange={(event) => void updateNode({ description: event.target.value })}
                  />
                </label>
                <label>
                  <span>Actor</span>
                  <select
                    disabled={approved}
                    value={selectedNode.actorId ?? ''}
                    onChange={(event) => void updateNode({ actorId: event.target.value || undefined })}
                  >
                    <option value="">Application</option>
                    {specification.actors.map((actor) => (
                      <option key={actor.id} value={actor.id}>{actor.text}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Refined use-case steps</span>
                  <select
                    multiple
                    disabled={approved}
                    value={selectedNode.refinesIds}
                    onChange={(event) => void updateNode({
                      refinesIds: Array.from(event.target.selectedOptions).map((option) => option.value),
                    })}
                  >
                    {selectedUseCaseSteps.map((step) => (
                      <option key={step.id} value={step.id}>{step.action}</option>
                    ))}
                  </select>
                </label>
              </>
            ) : selectedEdge ? (
              <>
                <span>Control flow</span>
                <h4>{selectedEdge.guard ?? 'Unconditional flow'}</h4>
                <label>
                  <span>Guard</span>
                  <input
                    disabled={approved}
                    value={selectedEdge.guard ?? ''}
                    onChange={(event) => void updateEdge({ guard: event.target.value || undefined })}
                  />
                </label>
                <label>
                  <span>Outcome</span>
                  <select
                    disabled={approved}
                    value={selectedEdge.outcome ?? ''}
                    onChange={(event) => void updateEdge({
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
                  <span>Rejoin at</span>
                  <select
                    disabled={approved}
                    value={selectedEdge.toNodeId}
                    onChange={(event) => void updateEdge({ toNodeId: event.target.value })}
                  >
                    {selectedWorkflow?.graph.nodes
                      .filter((node) => node.id !== selectedEdge.fromNodeId)
                      .map((node) => (
                        <option key={node.id} value={node.id}>{node.label} · {node.kind}</option>
                      ))}
                  </select>
                </label>
                <label>
                  <span>Loop exit condition</span>
                  <input
                    disabled={approved}
                    value={selectedEdge.loop?.exitCondition ?? ''}
                    onChange={(event) => void updateEdge({
                      loop: event.target.value
                        ? {
                          exitCondition: event.target.value,
                          maximumIterations: selectedEdge.loop?.maximumIterations ?? 3,
                        }
                        : undefined,
                    })}
                  />
                </label>
                {selectedEdge.loop ? (
                  <label>
                    <span>Maximum iterations</span>
                    <input
                      type="number"
                      min={1}
                      disabled={approved}
                      value={selectedEdge.loop.maximumIterations ?? 3}
                      onChange={(event) => void updateEdge({
                        loop: {
                          ...selectedEdge.loop!,
                          maximumIterations: Math.max(1, Number(event.target.value) || 1),
                        },
                      })}
                    />
                  </label>
                ) : null}
              </>
            ) : null}
          </aside>
        ) : null}
      </div>

      <footer className="cap-behavior-trace">
        <div><span>Use case</span><code>{selectedWorkflow?.useCaseId}</code></div>
        <div><span>Paths</span>{selectedWorkflow?.pathIds.map((id) => <code key={id}>{id}</code>)}</div>
        <div><span>Acceptance</span>{selectedWorkflow?.acceptanceCaseIds.map((id) => <code key={id}>{id}</code>)}</div>
      </footer>
      {diagnostics.length ? (
        <details className="cap-issues">
          <summary>Workflow issues ({diagnostics.length})</summary>
          <ul className="cap-issue-list">
            {diagnostics.map((item) => (
              <li key={`${item.code}:${item.fieldPath}`}>{item.message} <code>{item.fieldPath}</code></li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  )
}
