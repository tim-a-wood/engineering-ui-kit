import { useEffect, useMemo, useState } from 'react'
import type {
  ApplicationSpecification,
  ProjectSteLexicon,
  ScenarioEvidencePolicy,
  UseCaseDefinition,
  UseCasePathDefinition,
  UseCasePathKind,
  UseCaseStepDefinition,
} from '@engineering-ui-kit/core'
import {
  allUseCasePaths,
  canonicalHash,
  checkSteEntries,
  checkSteText,
  compileScenarioDefinitions,
  evaluateUseCaseAnalysis,
  materializeUseCaseDefinitions,
  STE_DESCRIPTION_WORD_LIMIT,
  STE_LABEL_WORD_LIMIT,
  steWords,
} from '@engineering-ui-kit/core/browser'

type Props = {
  specification: ApplicationSpecification
  approved: boolean
  steLexicon?: ProjectSteLexicon
  onSave: (specification: ApplicationSpecification) => Promise<void>
}

const EVIDENCE_LABEL: Record<ScenarioEvidencePolicy, string> = {
  screenshot: 'Screenshot',
  structured: 'Structured result',
  either: 'Screenshot or structured',
  'not-applicable': 'Not applicable',
}

const PATH_LABEL: Record<UseCasePathKind, string> = {
  main: 'Main success path',
  alternate: 'Alternate path',
  failure: 'Failure path',
  recovery: 'Recovery path',
}

function SteFieldFeedback(props: {
  text: string
  textClass: 'action-label' | 'description'
  fieldPath: string
  steLexicon?: ProjectSteLexicon
}) {
  if (!props.text.trim()) return null
  const result = checkSteText(props.text, {
    textClass: props.textClass,
    fieldPath: props.fieldPath,
    lexicon: props.steLexicon,
  })
  const limit = props.textClass === 'action-label'
    ? STE_LABEL_WORD_LIMIT
    : STE_DESCRIPTION_WORD_LIMIT
  const tone = !result.passed
    ? 'invalid'
    : result.reviewDiagnostics.length
      ? 'review'
      : 'valid'
  return (
    <span className={`cap-ste-feedback ${tone}`}>
      {steWords(props.text).length}/{limit} words
      {result.diagnostics.length
        ? ` · ${result.diagnostics.map((item) => item.message).join(' ')}`
        : result.reviewDiagnostics.length
          ? ` · Review: ${result.reviewDiagnostics.map((item) => item.message).join(' ')}`
          : ' · Writing check passed'}
    </span>
  )
}

function safeId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'item'
}

function nextRevision(revision: string): string {
  const numeric = /^(\d+)$/.exec(revision)
  if (numeric) return String(Number(numeric[1]) + 1)
  const semantic = /^(\d+)\.(\d+)\.(\d+)$/.exec(revision)
  if (semantic) return `${semantic[1]}.${semantic[2]}.${Number(semantic[3]) + 1}`
  return `${revision}-use-cases`
}

function blankUseCase(index: number): UseCaseDefinition {
  const id = `use-case-${index}`
  return {
    id,
    name: '',
    actorIds: [],
    trigger: '',
    preconditions: [],
    mainFlow: [],
    alternatePaths: [],
    failurePaths: [],
    recoveryPaths: [],
    ruleIds: [],
    inputIds: [],
    outputIds: [],
    acceptanceCaseIds: [],
    sourceRefs: [],
  }
}

function pathCollectionKey(kind: Exclude<UseCasePathKind, 'main'>): 'alternatePaths' | 'failurePaths' | 'recoveryPaths' {
  if (kind === 'alternate') return 'alternatePaths'
  if (kind === 'failure') return 'failurePaths'
  return 'recoveryPaths'
}

function updatePath(
  useCase: UseCaseDefinition,
  kind: UseCasePathKind,
  pathId: string,
  update: (path: UseCasePathDefinition) => UseCasePathDefinition,
): UseCaseDefinition {
  if (kind === 'main') {
    const main: UseCasePathDefinition = {
      id: `${useCase.id}:main`,
      name: useCase.name,
      kind: 'main',
      trigger: useCase.trigger,
      preconditions: useCase.preconditions,
      steps: useCase.mainFlow,
      outcome: useCase.mainFlow.at(-1)?.expectedResult ?? '',
    }
    const next = update(main)
    return {
      ...useCase,
      trigger: next.trigger ?? '',
      preconditions: next.preconditions,
      mainFlow: next.steps,
    }
  }
  const key = pathCollectionKey(kind)
  return {
    ...useCase,
    [key]: useCase[key].map((path) => path.id === pathId ? update(path) : path),
  }
}

function PathEditor(props: {
  useCase: UseCaseDefinition
  path: UseCasePathDefinition
  actors: ApplicationSpecification['actors']
  steLexicon?: ProjectSteLexicon
  onChange: (useCase: UseCaseDefinition) => void
  onRemove?: () => void
}) {
  const { useCase, path, actors, onChange } = props

  function mutate(update: (current: UseCasePathDefinition) => UseCasePathDefinition) {
    onChange(updatePath(useCase, path.kind, path.id, update))
  }

  function addStep() {
    const order = path.steps.length + 1
    const step: UseCaseStepDefinition = {
      id: `${useCase.id}:${safeId(path.kind)}:step-${order}`,
      order,
      action: '',
      expectedResult: '',
      inputIds: [],
      outputIds: [],
      ruleIds: [],
      evidencePolicy: 'structured',
    }
    mutate((current) => ({ ...current, steps: [...current.steps, step] }))
  }

  function updateStep(index: number, patch: Partial<UseCaseStepDefinition>) {
    mutate((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step),
    }))
  }

  function removeStep(index: number) {
    mutate((current) => ({
      ...current,
      steps: current.steps
        .filter((_, stepIndex) => stepIndex !== index)
        .map((step, stepIndex) => ({ ...step, order: stepIndex + 1 })),
    }))
  }

  return (
    <section className="cap-uc-path" aria-label={`${PATH_LABEL[path.kind]} ${path.name}`}>
      <div className="cap-uc-path-head">
        <div>
          <span className={`cap-uc-path-kind ${path.kind}`}>{PATH_LABEL[path.kind]}</span>
          {path.kind === 'main' ? <strong>{useCase.name || 'Untitled use case'}</strong> : (
            <label>
              Path name
              <input
                aria-label={`${PATH_LABEL[path.kind]} name`}
                value={path.name}
                placeholder={`${PATH_LABEL[path.kind]} name`}
                onChange={(event) => mutate((current) => ({ ...current, name: event.target.value }))}
              />
              <SteFieldFeedback
                text={path.name}
                textClass="action-label"
                fieldPath={`${path.id}.name`}
                steLexicon={props.steLexicon}
              />
            </label>
          )}
        </div>
        {props.onRemove ? (
          <button type="button" className="btn btn-ghost btn-compact" onClick={props.onRemove}>
            Remove path
          </button>
        ) : null}
      </div>

      {path.kind !== 'main' ? (
        <div className="cap-uc-path-fields">
          <label>
            Trigger
            <input
              value={path.trigger ?? ''}
              onChange={(event) => mutate((current) => ({ ...current, trigger: event.target.value }))}
            />
            <SteFieldFeedback
              text={path.trigger ?? ''}
              textClass="description"
              fieldPath={`${path.id}.trigger`}
              steLexicon={props.steLexicon}
            />
          </label>
          <label>
            Observable outcome
            <input
              value={path.outcome}
              onChange={(event) => mutate((current) => ({ ...current, outcome: event.target.value }))}
            />
            <SteFieldFeedback
              text={path.outcome}
              textClass="description"
              fieldPath={`${path.id}.outcome`}
              steLexicon={props.steLexicon}
            />
          </label>
        </div>
      ) : null}

      <div className="cap-uc-step-list">
        {path.steps.map((step, index) => (
          <article className="cap-uc-step" key={step.id}>
            <span className="cap-uc-step-number" aria-hidden="true">{index + 1}</span>
            <div className="cap-uc-step-fields">
              <label>
                Actor
                <select
                  value={step.actorId ?? ''}
                  onChange={(event) => updateStep(index, { actorId: event.target.value || undefined })}
                >
                  <option value="">Actor not specified</option>
                  {actors.map((actor) => <option key={actor.id} value={actor.id}>{actor.text}</option>)}
                </select>
              </label>
              <label className="cap-uc-step-action">
                Action
                <input value={step.action} onChange={(event) => updateStep(index, { action: event.target.value })} />
                <SteFieldFeedback
                  text={step.action}
                  textClass="action-label"
                  fieldPath={`${step.id}.action`}
                  steLexicon={props.steLexicon}
                />
              </label>
              <label className="cap-uc-step-result">
                Expected result
                <input value={step.expectedResult} onChange={(event) => updateStep(index, { expectedResult: event.target.value })} />
                <SteFieldFeedback
                  text={step.expectedResult}
                  textClass="description"
                  fieldPath={`${step.id}.expectedResult`}
                  steLexicon={props.steLexicon}
                />
              </label>
              <label>
                Evidence
                <select
                  value={step.evidencePolicy}
                  onChange={(event) => updateStep(index, { evidencePolicy: event.target.value as ScenarioEvidencePolicy })}
                >
                  {Object.entries(EVIDENCE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-compact cap-uc-remove-step"
              aria-label={`Remove step ${index + 1}`}
              onClick={() => removeStep(index)}
            >
              Remove
            </button>
          </article>
        ))}
        {!path.steps.length ? <p className="capabilities-note">No steps yet. Add the first observable interaction.</p> : null}
      </div>
      <button type="button" className="btn btn-secondary btn-compact" onClick={addStep}>Add step</button>
    </section>
  )
}

export function UseCaseAnalysisPanel({ specification, approved, steLexicon, onSave }: Props) {
  const actors = specification.actors ?? []
  const acceptanceCases = specification.acceptanceCases ?? []
  const rules = specification.rules ?? []
  const initial = useMemo(() => materializeUseCaseDefinitions(specification), [specification])
  const [useCases, setUseCases] = useState<UseCaseDefinition[]>(initial)
  const [scenarioCommands, setScenarioCommands] = useState<Record<string, string>>(
    Object.fromEntries((specification.scenarioDefinitions ?? []).flatMap((scenario) =>
      scenario.testCommand ? [[scenario.id, scenario.testCommand]] : [])),
  )
  const [selectedId, setSelectedId] = useState(initial[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const next = materializeUseCaseDefinitions(specification)
    setUseCases(next)
    setScenarioCommands(Object.fromEntries((specification.scenarioDefinitions ?? []).flatMap((scenario) =>
      scenario.testCommand ? [[scenario.id, scenario.testCommand]] : [])))
    setSelectedId((current) => next.some((item) => item.id === current) ? current : next[0]?.id ?? '')
  }, [specification])

  const selected = useCases.find((item) => item.id === selectedId)
  const preview: ApplicationSpecification = {
    ...specification,
    useCaseDefinitions: useCases,
    scenarioDefinitions: undefined,
  }
  const evaluation = evaluateUseCaseAnalysis(preview, { includeSte: false })
  const steEvaluation = checkSteEntries(useCases.flatMap((useCase) => [
    {
      text: useCase.name,
      textClass: 'action-label' as const,
      fieldPath: `useCaseDefinitions.${useCase.id}.name`,
    },
    {
      text: useCase.trigger,
      textClass: 'description' as const,
      fieldPath: `useCaseDefinitions.${useCase.id}.trigger`,
    },
    ...allUseCasePaths(useCase).flatMap((path) => [
      ...(path.kind === 'main' ? [] : [{
        text: path.name,
        textClass: 'action-label' as const,
        fieldPath: `useCaseDefinitions.${useCase.id}.paths.${path.id}.name`,
      }]),
      ...(path.trigger ? [{
        text: path.trigger,
        textClass: 'description' as const,
        fieldPath: `useCaseDefinitions.${useCase.id}.paths.${path.id}.trigger`,
      }] : []),
      ...path.preconditions.map((precondition, index) => ({
        text: precondition,
        textClass: 'description' as const,
        fieldPath: `useCaseDefinitions.${useCase.id}.paths.${path.id}.preconditions.${index}`,
      })),
      ...path.steps.flatMap((step) => [{
        text: step.action,
        textClass: 'action-label' as const,
        fieldPath: `useCaseDefinitions.${useCase.id}.paths.${path.id}.steps.${step.id}.action`,
      }, {
        text: step.expectedResult,
        textClass: 'description' as const,
        fieldPath: `useCaseDefinitions.${useCase.id}.paths.${path.id}.steps.${step.id}.expectedResult`,
      }]),
      ...(path.outcome ? [{
        text: path.outcome,
        textClass: 'description' as const,
        fieldPath: `useCaseDefinitions.${useCase.id}.paths.${path.id}.outcome`,
      }] : []),
    ]),
  ]), { lexicon: steLexicon })
  const scenarios = compileScenarioDefinitions(preview)

  function replaceSelected(next: UseCaseDefinition) {
    setUseCases((current) => current.map((item) => item.id === selectedId ? next : item))
  }

  function addUseCase() {
    const next = blankUseCase(useCases.length + 1)
    setUseCases((current) => [...current, next])
    setSelectedId(next.id)
  }

  function addPath(kind: Exclude<UseCasePathKind, 'main'>) {
    if (!selected) return
    const key = pathCollectionKey(kind)
    const index = selected[key].length + 1
    const path: UseCasePathDefinition = {
      id: `${selected.id}:${kind}-${index}`,
      name: `${PATH_LABEL[kind]} ${index}`,
      kind,
      trigger: '',
      preconditions: [],
      steps: [],
      outcome: '',
    }
    replaceSelected({ ...selected, [key]: [...selected[key], path] })
  }

  async function save() {
    setBusy(true)
    setMessage('')
    try {
      const draft: ApplicationSpecification = {
        ...specification,
        revision: approved ? nextRevision(specification.revision) : specification.revision,
        status: 'draft',
        approvedAt: undefined,
        approvedBy: undefined,
        useCases: useCases.map((useCase) => ({ id: useCase.id, text: useCase.name })),
        useCaseDefinitions: useCases,
        scenarioDefinitions: undefined,
        contentHash: '',
      }
      draft.scenarioDefinitions = compileScenarioDefinitions(draft).map((scenario) => ({
        ...scenario,
        ...(scenarioCommands[scenario.id]?.trim() ? { testCommand: scenarioCommands[scenario.id]!.trim() } : {}),
      }))
      draft.contentHash = canonicalHash({ ...draft, contentHash: undefined })
      await onSave(draft)
      setMessage(evaluation.passed && steEvaluation.passed
        ? `Saved ${useCases.length} use cases and ${draft.scenarioDefinitions.length} scenario definitions.`
        : `Saved the draft. Resolve ${evaluation.diagnostics.length} design issues and ${steEvaluation.diagnostics.length} writing issues before approval.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="cap-use-case-analysis" aria-labelledby="cap-use-case-analysis-heading">
      <div className="cap-use-case-analysis-head">
        <div>
          <p className="capabilities-eyebrow">Traceable workflow</p>
          <h3 id="cap-use-case-analysis-heading">Design use cases</h3>
          <p>
            Use concise names and one action in each step. These records drive the architecture, module design, UML, implementation, and scenario checks.
          </p>
        </div>
        <div className="cap-use-case-metrics" aria-label="Use-case analysis summary">
          <span><strong>{useCases.length}</strong> use cases</span>
          <span><strong>{scenarios.length}</strong> scenarios</span>
          <span className={evaluation.passed ? 'ready' : 'needs-input'}>
            {evaluation.passed ? 'Traceable' : `${evaluation.diagnostics.length} issues`}
          </span>
          <span className={!steEvaluation.passed || steEvaluation.reviewDiagnostics.length ? 'needs-input' : 'ready'}>
            {!steEvaluation.passed
              ? `${steEvaluation.diagnostics.length} writing issues`
              : steEvaluation.reviewDiagnostics.length
                ? `${steEvaluation.reviewDiagnostics.length} writing reviews`
                : 'Writing checks pass'}
          </span>
        </div>
      </div>

      <div className="cap-use-case-workspace">
        <nav className="cap-use-case-list" aria-label="Use cases">
          {useCases.map((useCase) => {
            const pathCount = allUseCasePaths(useCase).filter((path) => path.steps.length).length
            return (
              <button
                type="button"
                key={useCase.id}
                className={selectedId === useCase.id ? 'active' : undefined}
                aria-current={selectedId === useCase.id ? 'true' : undefined}
                onClick={setSelectedId.bind(null, useCase.id)}
              >
                <strong>{useCase.name || 'Untitled use case'}</strong>
                <span>{useCase.mainFlow.length} steps · {pathCount} paths</span>
              </button>
            )
          })}
          <button type="button" className="cap-use-case-add" onClick={addUseCase}>Add use case</button>
        </nav>

        {selected ? (
          <div className="cap-use-case-editor">
            <div className="cap-use-case-fields">
              <label>
                Stable ID
                <input
                  value={selected.id}
                  onChange={(event) => {
                    const id = event.target.value
                    setUseCases((current) => current.map((item) => item.id === selectedId ? { ...item, id } : item))
                    setSelectedId(id)
                  }}
                />
              </label>
              <label>
                Use-case name
                <input value={selected.name} onChange={(event) => replaceSelected({ ...selected, name: event.target.value })} />
                <SteFieldFeedback
                  text={selected.name}
                  textClass="action-label"
                  fieldPath={`useCaseDefinitions.${selected.id}.name`}
                  steLexicon={steLexicon}
                />
              </label>
              <label className="cap-use-case-trigger">
                Trigger
                <input value={selected.trigger} onChange={(event) => replaceSelected({ ...selected, trigger: event.target.value })} />
                <SteFieldFeedback
                  text={selected.trigger}
                  textClass="description"
                  fieldPath={`useCaseDefinitions.${selected.id}.trigger`}
                  steLexicon={steLexicon}
                />
              </label>
            </div>

            <fieldset className="cap-use-case-checks">
              <legend>Primary actors</legend>
              {actors.map((actor) => (
                <label key={actor.id}>
                  <input
                    type="checkbox"
                    checked={selected.actorIds.includes(actor.id)}
                    onChange={() => replaceSelected({
                      ...selected,
                      actorIds: selected.actorIds.includes(actor.id)
                        ? selected.actorIds.filter((id) => id !== actor.id)
                        : [...selected.actorIds, actor.id],
                    })}
                  />
                  {actor.text}
                </label>
              ))}
              {!actors.length ? <p className="capabilities-note">Add actors to the application definition first.</p> : null}
            </fieldset>

            <PathEditor
              useCase={selected}
              path={allUseCasePaths(selected)[0]!}
              actors={actors}
              steLexicon={steLexicon}
              onChange={replaceSelected}
            />
            {(['alternate', 'failure', 'recovery'] as const).flatMap((kind) => {
              const key = pathCollectionKey(kind)
              return selected[key].map((path) => (
                <PathEditor
                  key={path.id}
                  useCase={selected}
                  path={path}
                  actors={actors}
                  steLexicon={steLexicon}
                  onChange={replaceSelected}
                  onRemove={() => replaceSelected({ ...selected, [key]: selected[key].filter((item) => item.id !== path.id) })}
                />
              ))
            })}
            <div className="cap-use-case-path-actions" role="group" aria-label="Add use-case path">
              <button type="button" className="btn btn-secondary btn-compact" onClick={addPath.bind(null, 'alternate')}>Add alternate path</button>
              <button type="button" className="btn btn-secondary btn-compact" onClick={addPath.bind(null, 'failure')}>Add failure path</button>
              <button type="button" className="btn btn-secondary btn-compact" onClick={addPath.bind(null, 'recovery')}>Add recovery path</button>
            </div>

            <div className="cap-use-case-reference-grid">
              <fieldset>
                <legend>Acceptance checks</legend>
                {acceptanceCases.map((acceptance) => (
                  <label key={acceptance.id}>
                    <input
                      type="checkbox"
                      checked={selected.acceptanceCaseIds.includes(acceptance.id)}
                      onChange={() => replaceSelected({
                        ...selected,
                        acceptanceCaseIds: selected.acceptanceCaseIds.includes(acceptance.id)
                          ? selected.acceptanceCaseIds.filter((id) => id !== acceptance.id)
                          : [...selected.acceptanceCaseIds, acceptance.id],
                      })}
                    />
                    {acceptance.description}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>Rules</legend>
                {rules.map((rule) => (
                  <label key={rule.id}>
                    <input
                      type="checkbox"
                      checked={selected.ruleIds.includes(rule.id)}
                      onChange={() => replaceSelected({
                        ...selected,
                        ruleIds: selected.ruleIds.includes(rule.id)
                          ? selected.ruleIds.filter((id) => id !== rule.id)
                          : [...selected.ruleIds, rule.id],
                      })}
                    />
                    {rule.text}
                  </label>
                ))}
              </fieldset>
            </div>
            <section className="cap-use-case-commands" aria-label="Scenario test commands">
              <div>
                <h4>Configured scenario tests</h4>
                <p>Optional repository commands run in the desktop app and store their actual output as structured evidence.</p>
              </div>
              {scenarios.filter((scenario) => scenario.useCaseId === selected.id).map((scenario) => (
                <label key={scenario.id}>
                  <span><strong>{scenario.kind}</strong> <code>{scenario.id}</code></span>
                  <input
                    value={scenarioCommands[scenario.id] ?? ''}
                    placeholder="For example: npm test -- --run scenario-name"
                    onChange={(event) => setScenarioCommands((current) => ({ ...current, [scenario.id]: event.target.value }))}
                  />
                </label>
              ))}
            </section>
          </div>
        ) : (
          <div className="cap-use-case-empty">
            <p>No detailed use case exists yet.</p>
            <button type="button" className="btn btn-primary btn-compact" onClick={addUseCase}>Create use case</button>
          </div>
        )}
      </div>

      {!evaluation.passed ? (
        <details className="cap-use-case-diagnostics">
          <summary>Resolve trace issues ({evaluation.diagnostics.length})</summary>
          <ul>
            {evaluation.diagnostics.map((diagnostic, index) => (
              <li key={`${diagnostic.code}-${diagnostic.fieldPath}-${index}`}>
                {diagnostic.message}{diagnostic.fieldPath ? ` — ${diagnostic.fieldPath}` : ''}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {!steEvaluation.passed ? (
        <details className="cap-use-case-diagnostics">
          <summary>Resolve writing issues ({steEvaluation.diagnostics.length})</summary>
          <ul>
            {steEvaluation.diagnostics.map((item, index) => (
              <li key={`${item.code}-${item.fieldPath}-${index}`}>
                {item.message}{item.fieldPath ? ` — ${item.fieldPath}` : ''}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {steEvaluation.reviewDiagnostics.length ? (
        <details className="cap-use-case-diagnostics">
          <summary>Review writing ({steEvaluation.reviewDiagnostics.length})</summary>
          <ul>
            {steEvaluation.reviewDiagnostics.map((item, index) => (
              <li key={`${item.code}-${item.fieldPath}-${index}`}>
                {item.message}{item.fieldPath ? ` — ${item.fieldPath}` : ''}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="cap-use-case-save">
        <p>{approved ? 'Saving creates a new application revision. The current approved record remains immutable.' : 'Save this analysis into the current application draft.'}</p>
        <button type="button" className="btn btn-primary btn-compact" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save use-case analysis'}
        </button>
      </div>
      {message ? <p className="capabilities-note" role="status">{message}</p> : null}
    </section>
  )
}
