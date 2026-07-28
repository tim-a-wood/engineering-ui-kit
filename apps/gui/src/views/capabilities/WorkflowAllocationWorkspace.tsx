import { useMemo, useState } from 'react'
import type {
  ApplicationSpecification,
  ArchitectureSpecification,
  DiagramProjection,
  WorkflowNodeAllocation,
} from '@engineering-ui-kit/core'
import {
  canonicalHash,
  evaluateSolutionAllocations,
  isExecutableActivityNode,
  materializeApplicationWorkflows,
  materializeWorkflowNodeAllocations,
  projectSolutionAllocationDiagrams,
} from '@engineering-ui-kit/core/browser'
import { UmlDiagramWorkspace } from './UmlDiagramWorkspace'

type Props = {
  application: ApplicationSpecification
  architecture: ArchitectureSpecification
  approved: boolean
  onSave: (architecture: ArchitectureSpecification) => void | Promise<void>
  onOpenModule?: (moduleId: string) => void
}

function moduleName(architecture: ArchitectureSpecification, moduleId: string): string {
  return architecture.moduleDefinitions?.find((module) => module.moduleId === moduleId)?.name ?? moduleId
}

export function WorkflowAllocationWorkspace({
  application,
  architecture,
  approved,
  onSave,
  onOpenModule,
}: Props) {
  const workflows = materializeApplicationWorkflows(application)
  const [workflowId, setWorkflowId] = useState(workflows[0]?.id ?? '')
  const [nodeId, setNodeId] = useState('')
  const workflow = workflows.find((candidate) => candidate.id === workflowId) ?? workflows[0]
  const allocations = materializeWorkflowNodeAllocations(application, architecture)
  const allocationByNode = new Map(
    allocations
      .filter((allocation) => allocation.workflowId === workflow?.id)
      .map((allocation) => [allocation.nodeId, allocation]),
  )
  const executableNodes = workflow?.graph.nodes.filter(isExecutableActivityNode) ?? []
  const selectedNode = executableNodes.find((node) => node.id === nodeId) ?? executableNodes[0]
  const selectedAllocation = selectedNode ? allocationByNode.get(selectedNode.id) : undefined
  const evaluation = evaluateSolutionAllocations(application, architecture)
  const diagrams = useMemo(
    () => projectSolutionAllocationDiagrams(application, architecture)
      .filter((diagram) => diagram.contextId === workflow?.id),
    [application, architecture, workflow?.id],
  )
  const covered = executableNodes.filter((node) => allocationByNode.has(node.id)).length

  async function updateAllocation(patch: Partial<WorkflowNodeAllocation>) {
    if (!workflow || !selectedNode || approved) return
    const current: WorkflowNodeAllocation = selectedAllocation ?? {
      workflowId: workflow.id,
      nodeId: selectedNode.id,
      primaryModuleId: '',
      participatingModuleIds: [],
    }
    const nextAllocation = { ...current, ...patch }
    const traceIndex = architecture.workflowTraces.findIndex((trace) =>
      trace.useCaseId === workflow.useCaseId)
    const traces = architecture.workflowTraces.map((trace, index) => {
      if (index !== traceIndex) return trace
      const existing = allocations
        .filter((allocation) => allocation.workflowId === workflow.id)
        .filter((allocation) =>
        !(allocation.workflowId === workflow.id && allocation.nodeId === selectedNode.id))
      return {
        ...trace,
        stepAllocations: undefined,
        moduleIds: [...new Set([
          ...trace.moduleIds,
          ...(nextAllocation.primaryModuleId ? [nextAllocation.primaryModuleId] : []),
          ...nextAllocation.participatingModuleIds,
        ])],
        nodeAllocations: nextAllocation.primaryModuleId
          ? [...existing, nextAllocation]
          : existing,
      }
    })
    if (traceIndex < 0 && nextAllocation.primaryModuleId) {
      traces.push({
        useCaseId: workflow.useCaseId,
        moduleIds: [
          nextAllocation.primaryModuleId,
          ...nextAllocation.participatingModuleIds,
        ],
        nodeAllocations: [nextAllocation],
      })
    }
    const next: ArchitectureSpecification = {
      ...architecture,
      status: 'draft',
      workflowTraces: traces,
      gateResult: {
        gateId: 'CAP-GATE-002',
        passed: false,
        diagnostics: [],
      },
      contentHash: '',
    }
    next.contentHash = canonicalHash({ ...next, contentHash: undefined })
    await onSave(next)
  }

  function handleDiagramSelection(diagram: DiagramProjection, elementId: string) {
    const projectionNode = diagram.nodes.find((node) => node.id === elementId)
    const sourceNode = executableNodes.find((node) => projectionNode?.traceIds.includes(node.id))
    if (sourceNode) setNodeId(sourceNode.id)
  }

  if (!workflows.length) {
    return (
      <section className="cap-behavior-workspace cap-behavior-empty" aria-label="Solution allocation">
        <div>
          <p className="capabilities-eyebrow">Solution allocation</p>
          <h3>Approve workflows</h3>
          <p>Design assigns modules to approved application actions. It does not infer missing workflow behavior.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="cap-behavior-workspace" aria-labelledby="allocation-workspace-heading">
      <header className="cap-behavior-workspace-head">
        <div>
          <p className="capabilities-eyebrow">Solution allocation</p>
          <h3 id="allocation-workspace-heading">Assign application actions</h3>
          <p>Each executable action has one primary module. Cross-module transitions use explicit operations, events, entries, or outputs.</p>
        </div>
        <div className="cap-behavior-status">
          <span className={covered === executableNodes.length ? 'badge approved' : 'badge badge-warning'}>
            {covered} of {executableNodes.length} assigned
          </span>
          <span>{evaluation.diagnostics.length} issues</span>
        </div>
      </header>

      <div className="cap-behavior-selector">
        <label>
          <span>Application workflow</span>
          <select
            value={workflow?.id}
            onChange={(event) => {
              setWorkflowId(event.target.value)
              setNodeId('')
            }}
          >
            {workflows.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Application action</span>
          <select value={selectedNode?.id ?? ''} onChange={(event) => setNodeId(event.target.value)}>
            {executableNodes.map((node) => (
              <option key={node.id} value={node.id}>{node.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="cap-behavior-layout has-editor">
        <div className="cap-behavior-canvas">
          <UmlDiagramWorkspace diagrams={diagrams} onSelectElement={handleDiagramSelection} />
        </div>
        <aside className="cap-behavior-editor" aria-label="Allocation inspector">
          <span>Application action</span>
          <h4>{selectedNode?.label ?? 'Select an action'}</h4>
          <p>{selectedNode?.description}</p>
          <label>
            <span>Primary module</span>
            <select
              disabled={approved || !selectedNode}
              value={selectedAllocation?.primaryModuleId ?? ''}
              onChange={(event) => void updateAllocation({ primaryModuleId: event.target.value })}
            >
              <option value="">Not assigned</option>
              {architecture.moduleIds.map((moduleId) => (
                <option key={moduleId} value={moduleId}>{moduleName(architecture, moduleId)}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Participating modules</span>
            <select
              multiple
              disabled={approved || !selectedNode}
              value={selectedAllocation?.participatingModuleIds ?? []}
              onChange={(event) => void updateAllocation({
                participatingModuleIds: Array.from(event.target.selectedOptions)
                  .map((option) => option.value)
                  .filter((moduleId) => moduleId !== selectedAllocation?.primaryModuleId),
              })}
            >
              {architecture.moduleIds.map((moduleId) => (
                <option key={moduleId} value={moduleId}>{moduleName(architecture, moduleId)}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Bound operation</span>
            <select
              disabled={approved || !selectedNode}
              value={selectedAllocation?.operationId ?? ''}
              onChange={(event) => void updateAllocation({ operationId: event.target.value || undefined })}
            >
              <option value="">No operation</option>
              {architecture.operationAllocations.map((operation) => (
                <option key={`${operation.moduleId}:${operation.operationId}`} value={operation.operationId}>
                  {operation.operationId} · {moduleName(architecture, operation.moduleId)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Entry point</span>
            <input
              disabled={approved || !selectedNode}
              value={selectedAllocation?.entryPointId ?? ''}
              onChange={(event) => void updateAllocation({ entryPointId: event.target.value || undefined })}
            />
          </label>
          <label>
            <span>Event</span>
            <input
              disabled={approved || !selectedNode}
              value={selectedAllocation?.eventId ?? ''}
              onChange={(event) => void updateAllocation({ eventId: event.target.value || undefined })}
            />
          </label>
          {selectedAllocation?.primaryModuleId && onOpenModule ? (
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              onClick={() => onOpenModule(selectedAllocation.primaryModuleId)}
            >
              Open module
            </button>
          ) : null}
        </aside>
      </div>

      <div className="cap-allocation-coverage" aria-label="Allocation coverage">
        {executableNodes.map((node) => {
          const allocation = allocationByNode.get(node.id)
          return (
            <button
              type="button"
              key={node.id}
              className={node.id === selectedNode?.id ? 'active' : undefined}
              onClick={() => setNodeId(node.id)}
            >
              <span className={allocation ? 'complete' : 'missing'} aria-hidden="true" />
              <strong>{node.label}</strong>
              <small>{allocation ? moduleName(architecture, allocation.primaryModuleId) : 'Module required'}</small>
            </button>
          )
        })}
      </div>

      {evaluation.diagnostics.length ? (
        <details className="cap-issues">
          <summary>Allocation issues ({evaluation.diagnostics.length})</summary>
          <ul className="cap-issue-list">
            {evaluation.diagnostics.map((item) => (
              <li key={`${item.code}:${item.fieldPath}`}>{item.message} <code>{item.fieldPath}</code></li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  )
}
