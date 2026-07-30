import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type {
  AnalysisItem,
  AnalysisItemStatus,
  AnalysisSource,
  ScenarioStep,
  UseCaseContentTarget,
  UseCaseDefinition,
  UseCaseScenario,
} from '@engineering-ui-kit/core/design-browser'
import { useDesignState, type DesignStore } from './designState'

type Props = {
  store: DesignStore
  onContinueToDesign: () => void
  initialUseCaseId?: string
  onUseCaseSelected?: (useCaseId: string) => void
}

function lines(value: string): string[] {
  return value.split('\n').map((item) => item.trim()).filter(Boolean)
}

function diagnosticDomId(fieldPath: string): string {
  return `plan-field-${fieldPath.replace(/[^a-z0-9_-]+/gi, '-')}`
}

function readableDate(value?: string): string {
  if (!value) return 'Unknown time'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

type DraftSource = {
  id: string
  name: string
  ref: string
  required: boolean
  status: 'unchecked' | 'checking' | 'ok' | 'failed'
  failureCause?: string
}

type UseCaseContentInput<T = UseCaseContentTarget> = T extends UseCaseContentTarget
  ? Omit<T, 'kind' | 'useCaseId'>
  : never

function ReviewItem(props: { item: AnalysisItem; editable: boolean; store: DesignStore }) {
  const [correction, setCorrection] = useState(props.item.text)
  const settled = props.item.status === 'confirmed' || props.item.status === 'changed' || props.item.status === 'rejected'

  return (
    <li className="design-plan-review-item">
      <div>
        <span className={`design-plan-status design-plan-status-${props.item.status}`}>{props.item.status}</span>
        <p>{props.item.text}</p>
        {props.item.sourceRef && (
          <button type="button" className="design-source-link" onClick={() => void props.store.openProjectSource(props.item.sourceRef!)}>
            Open source · {props.item.sourceRef}
          </button>
        )}
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

function ReviewableContent(props: {
  targetId?: string
  label: string
  value: string
  state?: AnalysisItemStatus
  editable: boolean
  onAction: (action: 'accept' | 'correct' | 'reject', text?: string) => void
  children?: ReactNode
}) {
  const [draft, setDraft] = useState(props.value)
  useEffect(() => setDraft(props.value), [props.value])
  const settled = props.state === 'confirmed' || props.state === 'changed' || props.state === 'rejected'
  return (
    <div className="design-reviewable-content" id={props.targetId}>
      <div className="design-reviewable-copy">
        <span className="design-reviewable-label">{props.label}</span>
        <p>{props.value || 'Not specified'}</p>
        {props.children}
      </div>
      {props.state && <span className={`design-plan-status design-plan-status-${props.state}`}>{props.state}</span>}
      {props.editable && !settled && (
        <div className="design-reviewable-actions">
          <button type="button" className="btn btn-secondary btn-compact" onClick={() => props.onAction('accept')}>Confirm</button>
          <details>
            <summary>Edit or reject</summary>
            <label>
              Corrected text
              <textarea rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} />
            </label>
            <div>
              <button type="button" className="btn btn-secondary btn-compact" onClick={() => props.onAction('correct', draft)}>Save correction</button>
              <button type="button" className="btn btn-ghost btn-compact" onClick={() => props.onAction('reject')}>Reject</button>
            </div>
          </details>
        </div>
      )}
    </div>
  )
}

function sourceName(sources: AnalysisSource[], ref: string): string {
  return sources.find((source) => source.ref === ref || source.id === ref)?.name ?? ref
}

function UseCaseDetail(props: {
  useCase: UseCaseDefinition
  actorNames: Map<string, string>
  sources: AnalysisSource[]
  editable: boolean
  store: DesignStore
}) {
  const useCase = props.useCase
  const actors = useCase.actors.map((actorId) => props.actorNames.get(actorId) ?? actorId)
  const [newValues, setNewValues] = useState<Record<string, string>>({})
  const statusFor = (key: string) => useCase.reviewStates?.[key] ?? 'inferred'
  const update = (target: UseCaseContentInput) =>
    props.store.updateUseCaseContent({ ...target, kind: 'useCaseContent', useCaseId: useCase.id } as UseCaseContentTarget)
  const renderList = (field: 'preconditions' | 'inputs' | 'outputs' | 'sourceLinks', label: string) => {
    const values = useCase[field]
    return (
      <section className="design-plan-review-section">
        <h3>{label}</h3>
        {values.length === 0 ? <p className="secondary-text">None specified.</p> : (
          <div className="design-reviewable-list">
            {values.map((value, index) => (
              <ReviewableContent
                key={`${field}.${index}.${value}`}
                label={`${label} ${index + 1}`}
                value={field === 'sourceLinks' ? sourceName(props.sources, value) : value}
                state={statusFor(`list.${field}.${index}`)}
                editable={props.editable}
                onAction={(action, text) => update({ content: 'list', field, index, action, text })}
              >
                {field === 'sourceLinks' && (
                  <button type="button" className="design-source-link" onClick={() => void props.store.openProjectSource(value)}>Open source</button>
                )}
              </ReviewableContent>
            ))}
          </div>
        )}
        {props.editable && (
          <form className="design-inline-add" onSubmit={(event) => {
            event.preventDefault()
            const value = newValues[field]?.trim()
            if (!value) return
            update({ content: 'list', field, action: 'add', text: value })
            setNewValues((current) => ({ ...current, [field]: '' }))
          }}>
            <label>
              Add {label.toLowerCase()}
              <input value={newValues[field] ?? ''} onChange={(event) => setNewValues((current) => ({ ...current, [field]: event.target.value }))} />
            </label>
            <button type="submit" className="btn btn-secondary btn-compact">Add</button>
          </form>
        )}
      </section>
    )
  }
  const renderPath = (path: UseCaseScenario, pathKind: 'alternatePaths' | 'failurePaths') => (
    <article key={path.id} className="design-plan-path-card">
      <ReviewableContent
        targetId={diagnosticDomId(`useCases.${useCase.id}.scenarios.${path.id}.name`)}
        label={pathKind === 'alternatePaths' ? 'Alternate path' : 'Failure path'}
        value={path.name}
        state={statusFor(`path.${path.id}`)}
        editable={props.editable}
        onAction={(action, text) => update({ content: 'path', pathKind, scenarioId: path.id, action, text })}
      />
      <ol className="design-plan-flow">
        {path.steps.map((step) => renderStep(step))}
      </ol>
    </article>
  )
  const renderStep = (step: ScenarioStep) => (
    <li key={step.id}>
      <ReviewableContent
        targetId={diagnosticDomId(`useCases.${useCase.id}.scenarios.${useCase.scenarios.find((scenario) => scenario.steps.some((candidate) => candidate.id === step.id))?.id ?? 'main'}.steps.${step.id}.action`)}
        label="Action"
        value={step.action}
        state={statusFor(`step.${step.id}.action`)}
        editable={props.editable}
        onAction={(action, text) => update({ content: 'step', stepId: step.id, field: 'action', action, text })}
      />
      <ReviewableContent
        label="Expected result"
        value={step.expectedResult}
        state={statusFor(`step.${step.id}.expectedResult`)}
        editable={props.editable}
        onAction={(action, text) => update({ content: 'step', stepId: step.id, field: 'expectedResult', action, text })}
      >
        <small>{step.visibleResult ? 'Original screenshot required' : step.screenshotNotApplicableReason ?? 'Structured evidence required'}</small>
      </ReviewableContent>
    </li>
  )
  return (
    <article className="design-plan-use-case-detail" id={diagnosticDomId(`useCases.${useCase.id}`)} aria-label={`Use case ${useCase.name}`}>
      <header>
        <div>
          <p className="overline">User task</p>
          <h2 id={diagnosticDomId(`useCases.${useCase.id}.name`)}>{useCase.name}</h2>
          <details className="design-technical-details"><summary>Technical identity</summary><code>{useCase.id}</code></details>
        </div>
        <span className="design-plan-scenario-count">{useCase.scenarios.length} scenario{useCase.scenarios.length === 1 ? '' : 's'}</span>
      </header>

      <section className="design-plan-review-section">
        <h3>Purpose and users</h3>
        <ReviewableContent
          label="Use-case identity"
          value={useCase.name}
          state={statusFor('scalar.name')}
          editable={props.editable}
          onAction={(action, text) => update({ content: 'scalar', field: 'name', action, text })}
        />
        <div className="design-reviewable-copy"><span className="design-reviewable-label">Users</span><p>{actors.join(', ') || 'None'}</p></div>
        <ReviewableContent
          label="Trigger"
          value={useCase.trigger}
          state={statusFor('scalar.trigger')}
          editable={props.editable}
          onAction={(action, text) => update({ content: 'scalar', field: 'trigger', action, text })}
        />
      </section>

      {renderList('preconditions', 'Preconditions')}
      {renderList('inputs', 'Inputs')}
      {renderList('outputs', 'Results')}

      <section className="design-plan-review-section">
        <h3>Main task</h3>
        <ol className="design-plan-flow">
          {useCase.mainFlow.map((step) => renderStep(step))}
        </ol>
      </section>

      {(useCase.alternatePaths.length > 0 || useCase.failurePaths.length > 0) && (
        <section className="design-plan-review-section">
          <h3>Other paths</h3>
          {useCase.alternatePaths.map((path) => renderPath(path, 'alternatePaths'))}
          {useCase.failurePaths.map((path) => renderPath(path, 'failurePaths'))}
        </section>
      )}

      <section className="design-plan-review-section">
        <h3>Recovery</h3>
        <ReviewableContent
          label="Recovery behavior"
          value={useCase.recoveryBehavior}
          state={statusFor('scalar.recoveryBehavior')}
          editable={props.editable}
          onAction={(action, text) => update({ content: 'scalar', field: 'recoveryBehavior', action, text })}
        />
      </section>

      <section className="design-plan-review-section">
        <h3>Acceptance checks</h3>
        <ul className="design-plan-review-list">
          {useCase.acceptanceChecks.map((item) => <ReviewItem key={item.id} item={item} editable={props.editable} store={props.store} />)}
        </ul>
      </section>

      <section className="design-plan-review-section">
        <h3>Automation paths</h3>
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
      {renderList('sourceLinks', 'Sources')}
    </article>
  )
}

export function UseCasePlanView({ store, onContinueToDesign, initialUseCaseId, onUseCaseSelected }: Props) {
  const state = useDesignState(store)
  const analysis = state.useCaseAnalysis
  const [selectedUseCaseId, setSelectedUseCaseId] = useState(
    analysis.useCases.some((useCase) => useCase.id === initialUseCaseId) ? initialUseCaseId! : analysis.useCases[0]?.id ?? '',
  )
  const [workDescription, setWorkDescription] = useState('')
  const [examples, setExamples] = useState('')
  const [exampleMode, setExampleMode] = useState<'separate-use-cases' | 'steps'>('separate-use-cases')
  const [prohibitedResults, setProhibitedResults] = useState('')
  const [sources, setSources] = useState<DraftSource[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!analysis.useCases.some((useCase) => useCase.id === selectedUseCaseId)) {
      setSelectedUseCaseId(analysis.useCases[0]?.id ?? '')
    }
  }, [analysis.useCases, selectedUseCaseId])

  useEffect(() => {
    if (initialUseCaseId && analysis.useCases.some((useCase) => useCase.id === initialUseCaseId)) {
      setSelectedUseCaseId(initialUseCaseId)
    }
  }, [analysis.useCases, initialUseCaseId])

  const selectedUseCase = analysis.useCases.find((useCase) => useCase.id === selectedUseCaseId) ?? analysis.useCases[0]
  const editable = state.mode === 'project' && analysis.status !== 'approved'
  const gate = analysis.gates[0]
  const openQuestions = analysis.questions.filter((question) => question.material && !question.answer)
  const scenarios = useMemo(() => analysis.useCases.flatMap((useCase) => useCase.scenarios), [analysis.useCases])
  const actorNames = useMemo(
    () => new Map(analysis.actors.map((actor) => [actor.id, actor.text])),
    [analysis.actors],
  )
  const blockers = gate?.diagnostics ?? []

  const fixNextBlocker = () => {
    const blocker = blockers[0]
    if (!blocker) return
    const useCase = analysis.useCases.find((candidate) =>
      blocker.fieldPath?.includes(candidate.id) || blocker.relatedIds?.includes(candidate.id),
    )
    if (useCase) {
      setSelectedUseCaseId(useCase.id)
      onUseCaseSelected?.(useCase.id)
    }
    window.setTimeout(() => {
      const exact = blocker.fieldPath ? document.getElementById(diagnosticDomId(blocker.fieldPath)) : undefined
      const fallback = useCase ? document.getElementById(diagnosticDomId(`useCases.${useCase.id}`)) : undefined
      const target = exact ?? fallback
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      target?.querySelector<HTMLElement>('button, input, textarea, summary')?.focus()
    }, 0)
  }

  if (!analysis.revision) {
    return (
      <section className="design-plan design-plan-empty" aria-label="Plan">
        <div className="design-phase-heading">
          <div>
            <p className="overline">Plan · Describe</p>
            <h2>Describe user work</h2>
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
              exampleMode,
              examples: lines(examples),
              prohibitedResults: lines(prohibitedResults),
              sources: sources.map(({ name, ref, required, status, failureCause }) => ({
                name,
                ref,
                required,
                status: status === 'failed' ? 'failed' : 'ok',
                ...(status === 'failed' && failureCause ? { failureCause } : {}),
              })),
            })
          }}>
            <label>
              Work description
              <textarea required value={workDescription} onChange={(event) => setWorkDescription(event.target.value)} placeholder="What must the user accomplish?" />
            </label>
            <label>
              Examples
              <textarea value={examples} onChange={(event) => setExamples(event.target.value)} placeholder="Open the current evidence package" />
            </label>
            {lines(examples).length > 1 && (
              <fieldset className="design-example-mode">
                <legend>How do these examples relate?</legend>
                <label>
                  <input
                    type="radio"
                    name="example-mode"
                    checked={exampleMode === 'separate-use-cases'}
                    onChange={() => setExampleMode('separate-use-cases')}
                  />
                  <span><b>Separate user tasks</b><small>Recommended for goals that can succeed or fail independently.</small></span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="example-mode"
                    checked={exampleMode === 'steps'}
                    onChange={() => setExampleMode('steps')}
                  />
                  <span><b>Steps in one task</b><small>Use this only when the user must complete the examples in order.</small></span>
                </label>
              </fieldset>
            )}
            <label>
              Prohibited results
              <textarea value={prohibitedResults} onChange={(event) => setProhibitedResults(event.target.value)} placeholder="Never replace the last approved evidence set" />
            </label>
            <fieldset className="design-plan-source-picker">
              <legend>Read-only sources</legend>
              <p>Sources are read for analysis only. The workflow never modifies them. Mark a source required when analysis must stop if it cannot be opened.</p>
              <label className="design-file-source-picker">
                Add local files
                <input
                  type="file"
                  multiple
                  onChange={(event) => {
                    const picked = Array.from(event.target.files ?? [])
                    setSources((current) => [
                      ...current,
                      ...picked.map((file) => ({
                        id: `${file.name}.${file.size}.${file.lastModified}`,
                        name: file.name,
                        ref: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
                        required: true,
                        status: 'unchecked' as const,
                      })),
                    ])
                    event.currentTarget.value = ''
                  }}
                />
              </label>
              <button
                type="button"
                className="btn btn-secondary btn-compact"
                onClick={() => setSources((current) => [...current, { id: `source.${Date.now()}`, name: '', ref: '', required: false, status: 'unchecked' }])}
              >
                Add repository reference
              </button>
              {sources.length === 0 ? (
                <p className="secondary-text">No sources selected. You can still draft from the description alone.</p>
              ) : (
                <ul className="design-plan-source-drafts">
                  {sources.map((source) => (
                    <li key={source.id}>
                      <label>
                        Name
                        <input value={source.name} onChange={(event) => setSources((current) => current.map((candidate) => candidate.id === source.id ? { ...candidate, name: event.target.value } : candidate))} />
                      </label>
                      <label>
                        Repository-relative reference
                        <input value={source.ref} onChange={(event) => setSources((current) => current.map((candidate) => candidate.id === source.id ? { ...candidate, ref: event.target.value } : candidate))} placeholder="docs/requirements.md" />
                      </label>
                      <label className="design-checkbox-row">
                        <input type="checkbox" checked={source.required} onChange={(event) => setSources((current) => current.map((candidate) => candidate.id === source.id ? { ...candidate, required: event.target.checked } : candidate))} />
                        Required
                      </label>
                      <div className={`design-source-health ${source.status}`}>
                        {source.status === 'unchecked' ? 'Not checked' : source.status === 'checking' ? 'Checking…' : source.status === 'ok' ? '✓ Available' : `Unavailable · ${source.failureCause ?? 'Unknown error'}`}
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary btn-compact"
                        disabled={!source.ref.trim() || source.status === 'checking'}
                        onClick={async () => {
                          setSources((current) => current.map((candidate) => candidate.id === source.id ? { ...candidate, status: 'checking', failureCause: undefined } : candidate))
                          const result = await store.checkProjectSource(source.ref)
                          setSources((current) => current.map((candidate) => candidate.id === source.id
                            ? { ...candidate, status: result.ok ? 'ok' : 'failed', failureCause: result.message }
                            : candidate))
                        }}
                      >
                        Check source
                      </button>
                      <button type="button" className="btn btn-ghost btn-compact" onClick={() => setSources((current) => current.filter((candidate) => candidate.id !== source.id))}>Remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={
                !workDescription.trim() ||
                state.saveState === 'saving' ||
                sources.some((source) => !source.name.trim() || !source.ref.trim() || source.status === 'unchecked' || source.status === 'checking')
              }
            >
              Create use-case draft
            </button>
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
          <h2>Check use cases</h2>
          <p>Check the proposed users, tasks, limits, and success criteria. Approval makes this plan the source for every later phase.</p>
        </div>
        <span className={`design-state-badge design-state-${analysis.status}`}>{analysis.status === 'readyForReview' ? 'Ready for review' : analysis.status[0]?.toUpperCase() + analysis.status.slice(1)}</span>
      </div>

      {!gate?.passed && blockers.length > 0 && (
        <section className="design-plan-blocker-summary" role="alert" aria-label="Approval blockers">
          <div>
            <span className="design-plan-blocker-count">{blockers.length}</span>
            <div>
              <b>Approval blocked</b>
              <p>{blockers[0]?.message}</p>
            </div>
          </div>
          <button type="button" className="btn btn-primary btn-compact" onClick={fixNextBlocker}>Fix next blocker</button>
          <details>
            <summary>Show all blockers</summary>
            <ol>{blockers.map((blocker) => <li key={`${blocker.code}.${blocker.fieldPath ?? ''}`}>{blocker.message}</li>)}</ol>
          </details>
        </section>
      )}

      <div className="design-plan-metrics" aria-label="Use-case analysis counts">
        <div><strong>{analysis.actors.length}</strong><span>Actors</span></div>
        <div><strong>{analysis.useCases.length}</strong><span>Use cases</span></div>
        <div><strong>{scenarios.length}</strong><span>Scenarios</span></div>
        <div><strong>{openQuestions.length}</strong><span>Open material questions</span></div>
      </div>

      <section className="design-plan-sources" aria-label="Analysis sources">
        <div>
          <h3>Analysis sources</h3>
          <p>Read-only inputs support this version. Required failures block approval. Optional failures remain visible warnings.</p>
        </div>
        {analysis.sources.length === 0 ? (
          <p className="secondary-text">This draft was created from the written description only.</p>
        ) : (
          <ul>
            {analysis.sources.map((source) => (
              <li key={source.id} className={source.status === 'ok' ? 'healthy' : source.required ? 'blocked' : 'warning'}>
                <span aria-hidden="true">{source.status === 'ok' ? '✓' : source.required ? '!' : '△'}</span>
                <div>
                  <b>{source.name}</b>
                  <small>{source.required ? 'Required' : 'Optional'} · {source.status === 'ok' ? 'Available' : source.failureCause ?? 'Could not be read'}</small>
                </div>
                <button type="button" className="btn btn-secondary btn-compact" onClick={() => void store.openProjectSource(source.ref)}>Open source</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {state.lastOperationDiagnostics.length > 0 && (
        <ul className="design-error-summary" aria-label="Plan diagnostics">
          {state.lastOperationDiagnostics.map((diagnostic) => <li key={diagnostic.id} className={`design-diagnostic-${diagnostic.severity}`}>{diagnostic.message}</li>)}
        </ul>
      )}

      {openQuestions.length > 0 && (
        <section className="design-plan-questions" aria-label="Material questions">
          <h3>Approval questions</h3>
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
            <button key={useCase.id} type="button" className={useCase.id === selectedUseCase?.id ? 'selected' : ''} aria-pressed={useCase.id === selectedUseCase?.id} onClick={() => {
              setSelectedUseCaseId(useCase.id)
              onUseCaseSelected?.(useCase.id)
            }}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <b>{useCase.name}</b>
              <small>{useCase.scenarios.length} scenario{useCase.scenarios.length === 1 ? '' : 's'}</small>
            </button>
          ))}
          <h3>Actors</h3>
          <ul className="design-plan-review-list">
            {analysis.actors.map((item) => <ReviewItem key={item.id} item={item} editable={editable} store={store} />)}
          </ul>
          <h3>Rules and limits</h3>
          {analysis.rules.length === 0 ? <p className="secondary-text">No separate rules inferred.</p> : (
            <ul className="design-plan-review-list">
              {analysis.rules.map((item) => <ReviewItem key={item.id} item={item} editable={editable} store={store} />)}
            </ul>
          )}
          <h3>Quality needs</h3>
          {analysis.qualityNeeds.length === 0 ? <p className="secondary-text">No quality constraints inferred.</p> : (
            <ul className="design-plan-review-list">
              {analysis.qualityNeeds.map((item) => <ReviewItem key={item.id} item={item} editable={editable} store={store} />)}
            </ul>
          )}
        </aside>
        {selectedUseCase && (
          <UseCaseDetail
            useCase={selectedUseCase}
            actorNames={actorNames}
            sources={analysis.sources}
            editable={editable}
            store={store}
          />
        )}
      </div>

      <footer className="design-plan-footer">
        {analysis.status === 'approved' ? (
          <>
            <div>
              <b>Approved by {analysis.approval?.approvedBy ?? 'an authorized reviewer'}</b>
              <span>{readableDate(analysis.approval?.approvedAt)} · revision {analysis.revision}</span>
            </div>
            <div className="design-plan-footer-actions">
              {state.mode === 'project' && <button type="button" className="btn btn-secondary" onClick={() => store.reviseUseCaseAnalysis()}>Revise use cases</button>}
              <button type="button" className="btn btn-primary" onClick={onContinueToDesign}>Continue to application workflows</button>
            </div>
          </>
        ) : (
          <>
            <div>
              <b>{gate?.passed ? 'Ready for approval' : 'Approval is blocked'}</b>
              <span>
                {analysis.previousApproval
                  ? `Revision ${analysis.previousApproval.revision} remains approved while this revision is reviewed.`
                  : gate?.passed
                    ? 'All required use-case content is present.'
                    : `${gate?.diagnostics.length ?? 0} blocking condition${gate?.diagnostics.length === 1 ? '' : 's'} remain.`}
              </span>
            </div>
            <button type="button" className="btn btn-primary" disabled={!editable || !gate?.passed || state.saveState === 'saving'} onClick={() => store.approveUseCaseAnalysis()}>
              Approve this revision
            </button>
          </>
        )}
      </footer>

      {state.sourcePreview.status !== 'idle' && (
        <div className="design-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) store.closeProjectSource()
        }}>
          <section className="design-source-preview" role="dialog" aria-modal="true" aria-label="Source preview">
            <header>
              <div>
                <p className="overline">Read-only source</p>
                <h2>{state.sourcePreview.status === 'ready' ? state.sourcePreview.fileName : 'Opening source…'}</h2>
              </div>
              <button type="button" className="btn btn-ghost" onClick={() => store.closeProjectSource()}>Close</button>
            </header>
            {state.sourcePreview.status === 'loading' && <p role="status">Loading source…</p>}
            {state.sourcePreview.status === 'error' && <p role="alert" className="design-project-error">{state.sourcePreview.message}</p>}
            {state.sourcePreview.status === 'ready' && (
              <>
                <pre>{state.sourcePreview.content}</pre>
                <details className="design-technical-details">
                  <summary>Source identity</summary>
                  <p>{state.sourcePreview.ref} · {state.sourcePreview.bytes.toLocaleString()} bytes · SHA-256 {state.sourcePreview.sha256}</p>
                  {state.sourcePreview.truncated && <p>The preview is limited to 1 MB. The hash covers the complete original.</p>}
                </details>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  )
}
