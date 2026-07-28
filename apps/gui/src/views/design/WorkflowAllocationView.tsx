import { useMemo, useState } from 'react'
import {
  evaluateSolutionAllocations,
  materializeApplicationWorkflows,
  materializeWorkflowNodeAllocations,
  projectSolutionAllocationDiagrams,
} from '@engineering-ui-kit/core/browser'
import type { ApplicationSpecification } from '@engineering-ui-kit/core'
import type { SystemStructureSpecification } from '@engineering-ui-kit/core/design-browser'
import { UmlDiagramWorkspace } from '../capabilities/UmlDiagramWorkspace'

type Props = {
  application: ApplicationSpecification
  architecture: SystemStructureSpecification
}

function moduleName(architecture: SystemStructureSpecification, moduleId: string): string {
  return architecture.moduleDefinitions?.find((module) => module.moduleId === moduleId)?.name ?? moduleId
}

export function WorkflowAllocationView({ application, architecture }: Props) {
  const workflows = useMemo(() => materializeApplicationWorkflows(application), [application])
  const [workflowId, setWorkflowId] = useState(workflows[0]?.id ?? '')
  const selected = workflows.find((workflow) => workflow.id === workflowId) ?? workflows[0]
  const projections = useMemo(
    () => projectSolutionAllocationDiagrams(application, architecture),
    [application, architecture],
  )
  const diagrams = projections.filter((diagram) => diagram.contextId === selected?.id)
  const allocations = useMemo(
    () => materializeWorkflowNodeAllocations(application, architecture),
    [application, architecture],
  )
  const selectedAllocations = allocations.filter((allocation) => allocation.workflowId === selected?.id)
  const evaluation = useMemo(
    () => evaluateSolutionAllocations(application, architecture),
    [application, architecture],
  )
  const allocationByNode = new Map(selectedAllocations.map((allocation) => [allocation.nodeId, allocation]))
  const executableNodes = selected?.graph.nodes.filter((node) =>
    !['initial', 'final', 'decision', 'merge', 'fork', 'join'].includes(node.kind)) ?? []

  if (!application.revision || !architecture.revision || workflows.length === 0) return null

  return (
    <section className="design-workflow-allocation" aria-label="Solution allocation">
      <div className="design-phase-heading">
        <div>
          <p className="overline">Design · Solution allocation</p>
          <h2>Check module allocation</h2>
          <p>Each observable application action has one primary module. Cross-module work must use an operation, event, entry point, or output.</p>
        </div>
        <span className={`design-state-badge ${evaluation.passed ? 'design-state-approved' : 'design-state-needsInput'}`}>
          {evaluation.passed ? 'Allocation checks pass' : `${evaluation.diagnostics.length} issues`}
        </span>
      </div>

      <div className="design-behavior-selector">
        <label>
          Workflow
          <select value={selected?.id ?? ''} onChange={(event) => setWorkflowId(event.target.value)}>
            {workflows.map((workflow) => (
              <option key={workflow.id} value={workflow.id}>{workflow.name}</option>
            ))}
          </select>
        </label>
        <div className="design-behavior-level" role="note">
          <b>Solution level</b>
          <span>Application action → primary module → boundary contract</span>
        </div>
      </div>

      <UmlDiagramWorkspace diagrams={diagrams} controlLabelPrefix="Solution allocation" />

      <div className="design-allocation-ledger" aria-label="Workflow action allocation">
        {executableNodes.map((node) => {
          const allocation = allocationByNode.get(node.id)
          return (
            <article key={node.id} className={allocation ? 'complete' : 'missing'}>
              <span aria-hidden="true">{allocation ? '✓' : '!'}</span>
              <div>
                <b>{node.label}</b>
                <small>{allocation ? moduleName(architecture, allocation.primaryModuleId) : 'Primary module required'}</small>
              </div>
              {allocation?.operationId && <code>{allocation.operationId}</code>}
            </article>
          )
        })}
      </div>

      {evaluation.diagnostics.length > 0 && (
        <details className="design-application-workflow-issues">
          <summary>Allocation issues ({evaluation.diagnostics.length})</summary>
          <ul className="design-error-summary">
            {evaluation.diagnostics.map((diagnostic, index) => (
              <li key={`${diagnostic.code}.${index}`}>{diagnostic.message}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
