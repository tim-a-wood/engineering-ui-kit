import { useMemo, useState } from 'react'
import {
  evaluateApplicationWorkflows,
  materializeApplicationWorkflows,
  projectApplicationBehaviorDiagrams,
  projectUseCaseDiagram,
} from '@engineering-ui-kit/core/browser'
import type { ApplicationSpecification } from '@engineering-ui-kit/core'
import { UmlDiagramWorkspace } from '../capabilities/UmlDiagramWorkspace'

type Props = {
  application: ApplicationSpecification
  onOpenUseCases: () => void
}

export function ApplicationBehaviorView({ application, onOpenUseCases }: Props) {
  const workflows = useMemo(() => materializeApplicationWorkflows(application), [application])
  const [workflowId, setWorkflowId] = useState(workflows[0]?.id ?? '')
  const selected = workflows.find((workflow) => workflow.id === workflowId) ?? workflows[0]
  const activity = useMemo(
    () => projectApplicationBehaviorDiagrams(application),
    [application],
  )
  const diagrams = [
    ...activity.filter((diagram) => diagram.contextId === selected?.id),
    projectUseCaseDiagram(application),
  ]
  const evaluation = useMemo(() => evaluateApplicationWorkflows(application), [application])
  const actionCount = workflows.reduce(
    (total, workflow) => total + workflow.graph.nodes.filter((node) =>
      !['initial', 'final', 'decision', 'merge', 'fork', 'join'].includes(node.kind)).length,
    0,
  )

  if (!application.revision || workflows.length === 0) {
    return (
      <section className="design-application-behavior design-plan-empty" aria-label="Application workflows">
        <div className="design-phase-heading">
          <div>
            <p className="overline">Plan · Application workflows</p>
            <h2>Define application behavior</h2>
            <p>Approve the use-case analysis first. The application compiler then creates traceable workflows from the reviewed scenarios.</p>
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={onOpenUseCases}>Open use cases</button>
      </section>
    )
  }

  return (
    <section className="design-application-behavior" aria-label="Application workflows">
      <div className="design-phase-heading">
        <div>
          <p className="overline">Plan · Application workflows</p>
          <h2>Check application behavior</h2>
          <p>These workflows describe observable application behavior. They contain no module calls or implementation detail.</p>
        </div>
        <span className={`design-state-badge ${evaluation.passed ? 'design-state-approved' : 'design-state-needsInput'}`}>
          {evaluation.passed ? 'Workflow checks pass' : `${evaluation.diagnostics.length} issues`}
        </span>
      </div>

      <div className="design-plan-metrics" aria-label="Application workflow counts">
        <div><strong>{application.useCaseDefinitions?.length ?? application.useCases.length}</strong><span>Use cases</span></div>
        <div><strong>{workflows.length}</strong><span>Workflow paths</span></div>
        <div><strong>{actionCount}</strong><span>Application actions</span></div>
        <div><strong>{application.scenarioDefinitions?.length ?? 0}</strong><span>Scenario traces</span></div>
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
          <b>Application level</b>
          <span>Use case → workflow path → observable action</span>
        </div>
      </div>

      <UmlDiagramWorkspace diagrams={diagrams} />

      {selected && (
        <section className="design-behavior-trace" aria-label="Application workflow trace">
          <div>
            <span>Use case</span>
            <b>{application.useCases.find((useCase) => useCase.id === selected.useCaseId)?.text ?? selected.useCaseId}</b>
          </div>
          <div>
            <span>Paths</span>
            <b>{selected.pathIds.length}</b>
          </div>
          <div>
            <span>Acceptance checks</span>
            <b>{selected.acceptanceCaseIds.length}</b>
          </div>
          <div>
            <span>Application revision</span>
            <b>{application.revision}</b>
          </div>
        </section>
      )}

      {evaluation.diagnostics.length > 0 && (
        <details className="design-application-workflow-issues">
          <summary>Workflow issues ({evaluation.diagnostics.length})</summary>
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
