import { useEffect, useMemo, useState } from 'react'
import type { AnalysisItem, UseCaseDefinition } from '@engineering-ui-kit/core/design-browser'
import { useDesignState, type DesignStore } from './designState'

type Props = {
  store: DesignStore
  onContinueToDesign: () => void
}

function lines(value: string): string[] {
  return value.split('\n').map((item) => item.trim()).filter(Boolean)
}

function ReviewItem(props: { item: AnalysisItem; editable: boolean; store: DesignStore }) {
  const [correction, setCorrection] = useState(props.item.text)
  const settled = props.item.status === 'confirmed' || props.item.status === 'changed' || props.item.status === 'rejected'

  return (
    <li className="design-plan-review-item">
      <div>
        <span className={`design-plan-status design-plan-status-${props.item.status}`}>{props.item.status}</span>
        <p>{props.item.text}</p>
        {props.item.sourceRef && <small>Source: {props.item.sourceRef}</small>}
      </div>
      {props.editable && !settled && (
        <div className="design-plan-review-actions">
          <button type="button" className="btn btn-secondary btn-compact" onClick={() => props.store.updateUseCaseAnalysisItem(props.item.id, 'accept')}>
            Confirm
          </button>
          <details>
            <summary>Correct</summary>
            <label>
              Corrected text
              <input value={correction} onChange={(event) => setCorrection(event.target.value)} />
            </label>
            <button type="button" className="btn btn-secondary btn-compact" onClick={() => props.store.updateUseCaseAnalysisItem(props.item.id, 'correct', correction)}>
              Save correction
            </button>
          </details>
          <button type="button" className="btn btn-ghost btn-compact" onClick={() => props.store.updateUseCaseAnalysisItem(props.item.id, 'reject')}>
            Reject
          </button>
        </div>
      )}
    </li>
  )
}

function UseCaseDetail(props: {
  useCase: UseCaseDefinition
  actorNames: Map<string, string>
  editable: boolean
  store: DesignStore
}) {
  const useCase = props.useCase
  const actors = useCase.actors.map((actorId) => props.actorNames.get(actorId) ?? actorId)
  return (
    <article className="design-plan-use-case-detail" aria-label={`Use case ${useCase.name}`}>
      <header>
        <div>
          <p className="overline">Canonical use case</p>
          <h2>{useCase.name}</h2>
          <code>{useCase.id}</code>
        </div>
        <span className="design-plan-scenario-count">{useCase.scenarios.length} scenario{useCase.scenarios.length === 1 ? '' : 's'}</span>
      </header>

      <dl className="design-definition-grid">
        <dt>Actors</dt>
        <dd>{actors.join(', ') || 'None'}</dd>
        <dt>Trigger</dt>
        <dd>{useCase.trigger}</dd>
        <dt>Inputs</dt>
        <dd>{useCase.inputs.join(', ') || 'None'}</dd>
        <dt>Outputs</dt>
        <dd>{useCase.outputs.join(', ') || 'None'}</dd>
        <dt>Recovery</dt>
        <dd>{useCase.recoveryBehavior || 'No separate recovery behavior.'}</dd>
      </dl>

      <section>
        <h3>Main flow</h3>
        <ol className="design-plan-flow">
          {useCase.mainFlow.map((step) => (
            <li key={step.id}>
              <b>{step.action}</b>
              <span>{step.expectedResult}</span>
              <small>{step.visibleResult ? 'Screenshot evidence required' : step.screenshotNotApplicableReason ?? 'Structured evidence'}</small>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h3>Acceptance checks</h3>
        <ul className="design-plan-review-list">
          {useCase.acceptanceChecks.map((item) => <ReviewItem key={item.id} item={item} editable={props.editable} store={props.store} />)}
        </ul>
      </section>

      <section>
        <h3>Scenario paths</h3>
        <div className="design-plan-scenario-grid">
          {useCase.scenarios.map((scenario) => (
            <article key={scenario.id}>
              <span>{scenario.kind}</span>
              <b>{scenario.name}</b>
              <small>{scenario.steps.length} step{scenario.steps.length === 1 ? '' : 's'}</small>
            </article>
          ))}
        </div>
      </section>
    </article>
  )
}

export function UseCasePlanView({ store, onContinueToDesign }: Props) {
  const state = useDesignState(store)
  const analysis = state.useCaseAnalysis
  const [selectedUseCaseId, setSelectedUseCaseId] = useState(analysis.useCases[0]?.id ?? '')
  const [workDescription, setWorkDescription] = useState('')
  const [examples, setExamples] = useState('')
  const [prohibitedResults, setProhibitedResults] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!analysis.useCases.some((useCase) => useCase.id === selectedUseCaseId)) {
      setSelectedUseCaseId(analysis.useCases[0]?.id ?? '')
    }
  }, [analysis.useCases, selectedUseCaseId])

  const selectedUseCase = analysis.useCases.find((useCase) => useCase.id === selectedUseCaseId) ?? analysis.useCases[0]
  const editable = state.mode === 'project' && analysis.status !== 'approved'
  const gate = analysis.gates[0]
  const openQuestions = analysis.questions.filter((question) => question.material && !question.answer)
  const scenarios = useMemo(() => analysis.useCases.flatMap((useCase) => useCase.scenarios), [analysis.useCases])
  const actorNames = useMemo(
    () => new Map(analysis.actors.map((actor) => [actor.id, actor.text])),
    [analysis.actors],
  )

  if (!analysis.revision) {
    return (
      <section className="design-plan design-plan-empty" aria-label="Plan">
        <div className="design-phase-heading">
          <div>
            <p className="overline">Plan · Describe</p>
            <h2>Describe the work users must complete</h2>
            <p>The approved result becomes the source for the application contract, system structure, module traces, and scenario tests.</p>
          </div>
          <span className="design-source-chain">Use cases → application → modules → evidence</span>
        </div>
        {state.mode === 'sample' ? (
          <p className="secondary-text">Select a project to create a live analysis.</p>
        ) : (
          <form className="design-plan-create" onSubmit={(event) => {
            event.preventDefault()
            store.createUseCaseAnalysis({
              workDescription,
              examples: lines(examples),
              prohibitedResults: lines(prohibitedResults),
            })
          }}>
            <label>
              Work description
              <textarea required value={workDescription} onChange={(event) => setWorkDescription(event.target.value)} placeholder="What must the user accomplish?" />
            </label>
            <label>
              Examples, one per line
              <textarea value={examples} onChange={(event) => setExamples(event.target.value)} placeholder="Open the current evidence package" />
            </label>
            <label>
              Prohibited results, one per line
              <textarea value={prohibitedResults} onChange={(event) => setProhibitedResults(event.target.value)} placeholder="Never replace the last approved evidence set" />
            </label>
            <button type="submit" className="btn btn-primary" disabled={!workDescription.trim() || state.saveState === 'saving'}>Create use-case draft</button>
          </form>
        )}
      </section>
    )
  }

  return (
    <section className="design-plan" aria-label="Plan">
      <div className="design-phase-heading">
        <div>
          <p className="overline">Plan · Check</p>
          <h2>Check the use-case analysis</h2>
          <p>These are live canonical records. Approval compiles the application specification used by every later phase.</p>
        </div>
        <span className={`design-state-badge design-state-${analysis.status}`}>{analysis.status === 'readyForReview' ? 'Ready for review' : analysis.status[0]?.toUpperCase() + analysis.status.slice(1)}</span>
      </div>

      <div className="design-plan-metrics" aria-label="Use-case analysis counts">
        <div><strong>{analysis.actors.length}</strong><span>Actors</span></div>
        <div><strong>{analysis.useCases.length}</strong><span>Use cases</span></div>
        <div><strong>{scenarios.length}</strong><span>Scenarios</span></div>
        <div><strong>{openQuestions.length}</strong><span>Open material questions</span></div>
      </div>

      {state.lastOperationDiagnostics.length > 0 && (
        <ul className="design-error-summary" aria-label="Plan diagnostics">
          {state.lastOperationDiagnostics.map((diagnostic) => <li key={diagnostic.id} className={`design-diagnostic-${diagnostic.severity}`}>{diagnostic.message}</li>)}
        </ul>
      )}

      {openQuestions.length > 0 && (
        <section className="design-plan-questions" aria-label="Material questions">
          <h3>Questions that block approval</h3>
          {openQuestions.map((question) => (
            <form key={question.id} onSubmit={(event) => {
              event.preventDefault()
              store.answerUseCaseQuestion(question.id, answers[question.id] ?? '')
            }}>
              <label>
                {question.text}
                <input value={answers[question.id] ?? ''} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} />
              </label>
              <button type="submit" className="btn btn-secondary btn-compact">Save answer</button>
            </form>
          ))}
        </section>
      )}

      <div className="design-plan-layout">
        <aside className="design-plan-index" aria-label="Use cases">
          <h3>Use cases</h3>
          {analysis.useCases.map((useCase, index) => (
            <button key={useCase.id} type="button" className={useCase.id === selectedUseCase?.id ? 'selected' : ''} aria-pressed={useCase.id === selectedUseCase?.id} onClick={() => setSelectedUseCaseId(useCase.id)}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <b>{useCase.name}</b>
              <small>{useCase.scenarios.length} scenario{useCase.scenarios.length === 1 ? '' : 's'}</small>
            </button>
          ))}
          <h3>Actors</h3>
          <ul className="design-plan-review-list">
            {analysis.actors.map((item) => <ReviewItem key={item.id} item={item} editable={editable} store={store} />)}
          </ul>
        </aside>
        {selectedUseCase && (
          <UseCaseDetail
            useCase={selectedUseCase}
            actorNames={actorNames}
            editable={editable}
            store={store}
          />
        )}
      </div>

      <footer className="design-plan-footer">
        <div>
          <b>{gate?.passed ? 'Ready for approval' : 'Approval is blocked'}</b>
          <span>{gate?.passed ? 'All required use-case content is present.' : `${gate?.diagnostics.length ?? 0} blocking condition${gate?.diagnostics.length === 1 ? '' : 's'} remain.`}</span>
        </div>
        {analysis.status === 'approved' ? (
          <button type="button" className="btn btn-primary" onClick={onContinueToDesign}>Continue to system design</button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={!editable || !gate?.passed || state.saveState === 'saving'} onClick={() => store.approveUseCaseAnalysis()}>
            Approve use-case analysis
          </button>
        )}
      </footer>
    </section>
  )
}
