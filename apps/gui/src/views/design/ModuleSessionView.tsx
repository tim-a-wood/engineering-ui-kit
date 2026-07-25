/**
 * §9.3 Module-design session — six fixed steps, one current step shown,
 * completed steps openable, returning to an earlier step never drops later
 * draft data (enforced by the core session functions this view calls
 * through the store).
 */

import { useId, useState, type FormEvent } from 'react'
import {
  MODULE_DESIGN_STEPS,
  type ModuleDesignCheckEvaluation,
  type ModuleDesignProgressEntry,
  type ModuleDesignSession,
  type ModuleDesignSpecification,
  type ModuleDesignStep,
} from '@engineering-ui-kit/core/design-browser'
import type { OperationContract } from '@engineering-ui-kit/core'
import { StateBadge, moduleTypeLabel } from './designShared'
import type { SaveState } from './designState'
import { SaveIndicator } from './designShared'

const STEP_LABEL: Record<ModuleDesignStep, string> = {
  boundary: 'Review boundary',
  behavior: 'Define behavior',
  contracts: 'Define contracts',
  diagrams: 'Review diagrams',
  checks: 'Run checks',
  approval: 'Approve module',
}

export type ModuleSessionViewProps = {
  entry: ModuleDesignProgressEntry
  design?: ModuleDesignSpecification
  approvedDesign?: ModuleDesignSpecification
  session?: ModuleDesignSession
  checks?: ModuleDesignCheckEvaluation
  approvedContracts: OperationContract[]
  primaryActionLabel: string
  saveState: SaveState
  onPrimaryAction: () => void
  onGoToStep: (step: ModuleDesignStep) => void
  onAnswerQuestion: (itemId: string, text: string) => void
  onRunChecks: () => void
  onApprove: () => void
  onCreateHandoff: () => void
}

export function ModuleSessionView(props: ModuleSessionViewProps) {
  const headingId = useId()
  const { entry, design, session } = props

  if (!design || !session) {
    return (
      <section className="design-session design-session-empty" aria-labelledby={headingId}>
        <h2 id={headingId}>{entry.name}</h2>
        <p className="secondary-text">{entry.responsibility}</p>
        <button type="button" className="btn btn-primary" onClick={props.onPrimaryAction}>
          Create module draft
        </button>
      </section>
    )
  }

  const currentStep = session.currentStep

  return (
    <section className="design-session" aria-labelledby={headingId}>
      {entry.state === 'blocked' && (
        <div className="design-session-blocked" role="alert">
          This module is waiting for a dependency. You can still open it and prepare a draft, but it cannot be
          approved until the blocking module design is approved.
        </div>
      )}

      <header className="design-session-header">
        <div>
          <h2 id={headingId}>{design.module.name}</h2>
          <p className="secondary-text">
            {moduleTypeLabel(design.module.moduleType)} · Module design revision {design.revision}
          </p>
        </div>
        <StateBadge state={entry.state} />
        <SaveIndicator saveState={props.saveState} />
      </header>

      <ol className="design-session-steps" aria-label="Module-design session steps">
        {MODULE_DESIGN_STEPS.map((step, index) => {
          const completed = session.completedSteps.includes(step)
          const isCurrent = step === currentStep
          const openable = completed || isCurrent
          return (
            <li key={step} className={isCurrent ? 'design-session-step current' : completed ? 'design-session-step completed' : 'design-session-step locked'}>
              <button
                type="button"
                disabled={!openable}
                aria-current={isCurrent ? 'step' : undefined}
                onClick={() => props.onGoToStep(step)}
              >
                <span aria-hidden="true">{index + 1}.</span> {STEP_LABEL[step]}
                {completed && <span className="sr-only"> (completed)</span>}
              </button>
            </li>
          )
        })}
      </ol>

      <div className="design-session-content">
        {currentStep === 'boundary' && <BoundaryStep design={design} />}
        {currentStep === 'behavior' && (
          <BehaviorStep design={design} onAnswerQuestion={props.onAnswerQuestion} />
        )}
        {currentStep === 'contracts' && <ContractsStep design={design} approvedContracts={props.approvedContracts} />}
        {currentStep === 'diagrams' && <DiagramsStep design={design} />}
        {currentStep === 'checks' && <ChecksStep checks={props.checks} onRunChecks={props.onRunChecks} onGoToStep={props.onGoToStep} />}
        {currentStep === 'approval' && (
          <ApprovalStep design={design} approvedDesign={props.approvedDesign} onApprove={props.onApprove} onCreateHandoff={props.onCreateHandoff} />
        )}
      </div>

      <div className="design-session-primary-action">
        <button type="button" className="btn btn-primary" onClick={props.onPrimaryAction}>
          {props.primaryActionLabel}
        </button>
      </div>
    </section>
  )
}

function BoundaryStep(props: { design: ModuleDesignSpecification }) {
  const { design } = props
  return (
    <div className="design-step-panel">
      <h3>Responsibility</h3>
      <p>{design.module.responsibility || 'Not defined yet.'}</p>
      {design.module.nonResponsibilities.length > 0 && (
        <>
          <h4>Not this module&apos;s responsibility</h4>
          <ul>
            {design.module.nonResponsibilities.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </>
      )}
      <h4>Boundary</h4>
      <dl className="design-definition-grid">
        <dt>Deployable</dt>
        <dd>{design.boundary.deployableId}</dd>
        <dt>Runtime allocation</dt>
        <dd>{design.boundary.runtimeAllocation}</dd>
        <dt>Runtime language</dt>
        <dd>{design.boundary.runtimeLanguage}</dd>
        <dt>Direct dependencies</dt>
        <dd>{design.boundary.directDependencyIds.length === 0 ? 'None' : design.boundary.directDependencyIds.join(', ')}</dd>
        <dt>Direct consumers</dt>
        <dd>{design.boundary.directConsumerIds.length === 0 ? 'None' : design.boundary.directConsumerIds.join(', ')}</dd>
        <dt>Owned paths</dt>
        <dd>{design.boundary.ownedPaths.join(', ') || 'None recorded'}</dd>
      </dl>
    </div>
  )
}

function BehaviorStep(props: { design: ModuleDesignSpecification; onAnswerQuestion: (itemId: string, text: string) => void }) {
  const { design } = props
  const requiredQuestions = design.unresolvedItems.filter((item) => item.materiality === 'material' && !item.resolvedAt)
  return (
    <div className="design-step-panel">
      <h3>Provided operations</h3>
      {design.providedOperations.length === 0 ? (
        <p className="secondary-text">No provided operations yet.</p>
      ) : (
        <ul>
          {design.providedOperations.map((operation) => (
            <li key={operation.operationId}>
              {operation.operationId}@{operation.version}
            </li>
          ))}
        </ul>
      )}
      <h3>Required operations</h3>
      {design.requiredOperations.length === 0 ? (
        <p className="secondary-text">No required operations yet.</p>
      ) : (
        <ul>
          {design.requiredOperations.map((operation) => (
            <li key={operation.operationId}>
              {operation.operationId} from {operation.providerModuleId ?? 'an unassigned provider'} — {operation.reason}
            </li>
          ))}
        </ul>
      )}
      {requiredQuestions.length > 0 && (
        <div className="design-required-questions">
          <h3>
            Required question{requiredQuestions.length === 1 ? '' : 's'} ({requiredQuestions.length})
          </h3>
          {requiredQuestions.map((item) => (
            <RequiredQuestionForm key={item.id} itemId={item.id} description={item.description} onAnswerQuestion={props.onAnswerQuestion} />
          ))}
        </div>
      )}
    </div>
  )
}

function RequiredQuestionForm(props: { itemId: string; description: string; onAnswerQuestion: (itemId: string, text: string) => void }) {
  const [text, setText] = useState('')
  const fieldId = useId()
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!text.trim()) return
    props.onAnswerQuestion(props.itemId, text.trim())
    setText('')
  }
  return (
    <form className="design-required-question" onSubmit={submit}>
      <label htmlFor={fieldId}>{props.description}</label>
      <textarea id={fieldId} value={text} onChange={(event) => setText(event.target.value)} rows={2} />
      <button type="submit" className="btn btn-secondary" disabled={!text.trim()}>
        Save answer
      </button>
    </form>
  )
}

function ContractsStep(props: { design: ModuleDesignSpecification; approvedContracts: OperationContract[] }) {
  const approvedKeys = new Set(props.approvedContracts.map((contract) => `${contract.operationId}@${contract.version}`))
  return (
    <div className="design-step-panel">
      <h3>Review contracts</h3>
      {props.design.providedOperations.length === 0 ? (
        <p className="secondary-text">This module provides no operations yet.</p>
      ) : (
        <ul className="design-contract-list">
          {props.design.providedOperations.map((operation) => {
            const key = `${operation.operationId}@${operation.version}`
            const approved = approvedKeys.has(key) || Boolean(operation.contentHash)
            return (
              <li key={key}>
                <span>{key}</span>
                <span className={approved ? 'design-contract-status approved' : 'design-contract-status pending'}>
                  {approved ? '✓ Approved contract' : '○ No approved contract yet'}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function DiagramsStep(props: { design: ModuleDesignSpecification }) {
  return (
    <div className="design-step-panel">
      <h3>Review diagrams</h3>
      {props.design.diagrams.length === 0 ? (
        <p className="secondary-text">No diagrams apply to this module yet.</p>
      ) : (
        <ul>
          {props.design.diagrams.map((diagram) => (
            <li key={diagram.diagramId}>{diagram.kind} diagram</li>
          ))}
        </ul>
      )}
      <p className="secondary-text">Full diagram canvases open from the Diagrams workspace.</p>
    </div>
  )
}

/** Heuristic mapping from a diagnostic code to the step that contains the offending field, so the error summary can link to it (§18.4 "error summary and field links"). */
function stepForDiagnosticCode(code: string): ModuleDesignStep {
  if (code.startsWith('MODDESIGN-OPERATION') || code.startsWith('MODDESIGN-REQUIRED-OPERATION')) return 'contracts'
  if (code.startsWith('MODDESIGN-SCHEMA')) return 'behavior'
  if (code.startsWith('MODDESIGN-DIAGRAM') || code.startsWith('DIAGRAM-')) return 'diagrams'
  if (code.startsWith('MODDESIGN-RESPONSIBILITY') || code.startsWith('MODDESIGN-OWNED-PATH')) return 'boundary'
  return 'behavior'
}

function ChecksStep(props: { checks?: ModuleDesignCheckEvaluation; onRunChecks: () => void; onGoToStep: (step: ModuleDesignStep) => void }) {
  return (
    <div className="design-step-panel">
      <h3>Module-design checks</h3>
      <button type="button" className="btn btn-secondary" onClick={props.onRunChecks}>
        Run module checks
      </button>
      {props.checks && (
        <div className="design-check-results" role="status" aria-live="polite">
          <p>
            {props.checks.passed
              ? 'All required checks pass.'
              : `${props.checks.blockerCount} blocking issue${props.checks.blockerCount === 1 ? '' : 's'}, ${props.checks.warningCount} warning${props.checks.warningCount === 1 ? '' : 's'}.`}
          </p>
          {props.checks.diagnostics.length > 0 && (
            <ul className="design-error-summary" aria-label="Error summary">
              {props.checks.diagnostics.map((diagnostic) => (
                <li key={diagnostic.id} className={`design-diagnostic-${diagnostic.severity}`}>
                  <span aria-hidden="true">{diagnostic.severity === 'blocker' ? '⛔' : diagnostic.severity === 'warning' ? '⚠' : 'ℹ'}</span>{' '}
                  <button type="button" className="design-diagnostic-link" onClick={() => props.onGoToStep(stepForDiagnosticCode(diagnostic.code))}>
                    {diagnostic.message}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function ApprovalStep(props: {
  design: ModuleDesignSpecification
  approvedDesign?: ModuleDesignSpecification
  onApprove: () => void
  onCreateHandoff: () => void
}) {
  const { design, approvedDesign } = props
  const changed = approvedDesign && approvedDesign.revision !== design.revision
  return (
    <div className="design-step-panel">
      <h3>Approve module</h3>
      {design.status === 'approved' && design.approval ? (
        <p className="design-approval-confirmation" role="status">
          Approved by {design.approval.approvedBy} on {design.approval.approvedAt}.
        </p>
      ) : (
        <button type="button" className="btn btn-primary" onClick={props.onApprove} disabled={design.status !== 'readyForReview'}>
          Approve module
        </button>
      )}
      {changed && (
        <p className="design-last-approved secondary-text">
          Last approved revision: {approvedDesign!.revision} ({approvedDesign!.status}). This draft is revision {design.revision}.
        </p>
      )}
      {design.status === 'approved' && (
        <button type="button" className="btn btn-secondary" onClick={props.onCreateHandoff}>
          Create Copilot handoff
        </button>
      )}
    </div>
  )
}
