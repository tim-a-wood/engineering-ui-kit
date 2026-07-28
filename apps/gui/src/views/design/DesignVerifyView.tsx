/**
 * Scenario-first verification workspace. Canonical plans and immutable runs
 * still come from core/the desktop service; this view presents them as a
 * grouped list with a focused scenario and actionable evidence.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  buildVerifySummary,
  currentResultState,
  type CurrentRevisions,
  type ModuleDesignProgress,
  type ScenarioRun,
  type ScenarioTestPlanEntry,
  type VerifySummary,
} from '@engineering-ui-kit/core/design-browser'
import { useDesignState, type DesignStore } from './designState'
import { currentStateLabel } from './designShared'

export type DesignVerifyViewProps = {
  store: DesignStore
  onSelectDesignLink: (moduleId: string) => void
  onSelectEvidenceLink?: (runId: string) => void
  initialScenarioId?: string
  onScenarioSelected?: (scenarioId: string) => void
}

type ScenarioFilter = 'all' | 'not-run' | 'passed' | 'failed' | 'approved'

function readableDate(value?: string): string {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function shortId(value: string): string {
  if (value.length <= 20) return value
  return `${value.slice(0, 10)}…${value.slice(-6)}`
}

function nameFor(progress: ModuleDesignProgress, moduleId: string): string {
  return progress.modules.find((entry) => entry.moduleId === moduleId)?.name ?? moduleId
}

function downloadReport(projectId: string, entries: ScenarioTestPlanEntry[], runs: ScenarioRun[]): void {
  const report = {
    schemaVersion: '1.0',
    projectId,
    exportedAt: new Date().toISOString(),
    scenarioPlan: entries,
    immutableRuns: runs,
  }
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${projectId}-verification-report.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

function SummaryStrip(props: { summary: VerifySummary }) {
  return (
    <div className="design-verify-summary" aria-label="Verification summary">
      <div><strong>{props.summary.scenarioCount}</strong><span>Scenarios</span></div>
      <div className="pass"><strong>{props.summary.passedCount}</strong><span>Recorded passed</span></div>
      <div className={props.summary.failedCount ? 'fail' : ''}><strong>{props.summary.failedCount}</strong><span>Recorded failed</span></div>
      <div><strong>{props.summary.screenshotCount + props.summary.structuredEvidenceCount}</strong><span>Recorded artifacts</span></div>
      <details>
        <summary>Coverage details</summary>
        <dl className="design-definition-grid design-verify-counts">
          <dt>Use cases</dt><dd>{props.summary.useCaseCount}</dd>
          <dt>Steps</dt><dd>{props.summary.stepCount}</dd>
          <dt>Screenshots</dt><dd>{props.summary.screenshotCount}</dd>
          <dt>Structured evidence</dt><dd>{props.summary.structuredEvidenceCount}</dd>
          <dt>Current results</dt><dd>{currentStateLabel('current')}: {props.summary.currentCount}</dd>
          <dt>Old results</dt><dd>{currentStateLabel('old')}: {props.summary.oldCount}</dd>
          <dt>Skipped</dt><dd>{props.summary.skippedCount}</dd>
          <dt>Canceled</dt><dd>{props.summary.cancelledCount}</dd>
        </dl>
      </details>
    </div>
  )
}

function ScenarioWorkspace(props: DesignVerifyViewProps) {
  const state = useDesignState(props.store)
  const projectMode = props.store.isProjectMode()
  const currentRevisions: CurrentRevisions = {
    useCaseAnalysisRevision: state.useCaseAnalysis.revision,
    applicationRevision: state.architecture.applicationSpecRevision,
    systemStructureRevision: state.architecture.revision,
    moduleDesignRevisions: Object.fromEntries(state.moduleDesigns.map((design) => [design.module.moduleId, design.revision])),
  }
  const [filter, setFilter] = useState<ScenarioFilter>('all')
  const [query, setQuery] = useState('')
  const [selectedScenarioId, setSelectedScenarioId] = useState(
    state.scenarioTestPlan.entries.some((entry) => entry.scenarioId === props.initialScenarioId)
      ? props.initialScenarioId!
      : state.scenarioTestPlan.entries[0]?.scenarioId ?? '',
  )
  const [runningAll, setRunningAll] = useState(false)
  const latestRunByScenario = useMemo(() => {
    const latest = new Map<string, ScenarioRun>()
    for (const run of [...state.scenarioRuns].sort((a, b) => a.completedAt.localeCompare(b.completedAt))) latest.set(run.scenarioId, run)
    return latest
  }, [state.scenarioRuns])
  const useCaseNames = new Map(state.useCaseAnalysis.useCases.map((useCase) => [useCase.id, useCase.name]))

  const filteredEntries = state.scenarioTestPlan.entries.filter((entry) => {
    const run = latestRunByScenario.get(entry.scenarioId)
    const approved = Boolean(run && state.verificationApprovals[run.runId])
    const matchesFilter =
      filter === 'all'
      || (filter === 'not-run' && !run)
      || (filter === 'passed' && run?.outcome === 'passed')
      || (filter === 'failed' && run?.outcome === 'failed')
      || (filter === 'approved' && approved)
    const normalizedQuery = query.trim().toLocaleLowerCase()
    const matchesQuery = !normalizedQuery
      || entry.scenarioName.toLocaleLowerCase().includes(normalizedQuery)
      || (useCaseNames.get(entry.useCaseId) ?? '').toLocaleLowerCase().includes(normalizedQuery)
    return matchesFilter && matchesQuery
  })

  const grouped = new Map<string, ScenarioTestPlanEntry[]>()
  for (const entry of filteredEntries) grouped.set(entry.useCaseId, [...(grouped.get(entry.useCaseId) ?? []), entry])

  useEffect(() => {
    if (!state.scenarioTestPlan.entries.some((entry) => entry.scenarioId === selectedScenarioId)) {
      setSelectedScenarioId(state.scenarioTestPlan.entries[0]?.scenarioId ?? '')
    }
  }, [selectedScenarioId, state.scenarioTestPlan.entries])

  useEffect(() => {
    if (props.initialScenarioId && state.scenarioTestPlan.entries.some((entry) => entry.scenarioId === props.initialScenarioId)) {
      setSelectedScenarioId(props.initialScenarioId)
    }
  }, [props.initialScenarioId, state.scenarioTestPlan.entries])

  const selectedEntry = state.scenarioTestPlan.entries.find((entry) => entry.scenarioId === selectedScenarioId)
    ?? filteredEntries[0]
    ?? state.scenarioTestPlan.entries[0]
  const selectedRun = selectedEntry ? latestRunByScenario.get(selectedEntry.scenarioId) : undefined
  const selectedResultState = selectedRun ? currentResultState(selectedRun, currentRevisions) : undefined
  const selectedAction = selectedEntry ? state.scenarioActions[selectedEntry.scenarioId] : undefined
  const approval = selectedRun ? state.verificationApprovals[selectedRun.runId] : undefined
  const firstFailedStep = selectedRun?.steps.find((step) => step.outcome === 'failed')
  const anyScenarioBusy = Object.values(state.scenarioActions).some((action) => action.status === 'running' || action.status === 'approving')

  if (state.scenarioTestPlan.entries.length === 0) {
    return <p className="secondary-text">Approve the use-case analysis to generate scenario tests.</p>
  }

  return (
    <section className="design-scenario-runner" aria-label="Use-case scenarios">
      <div className="design-scenario-runner-heading">
        <div>
          <h3>Approved scenarios</h3>
          <p>Run the same main, alternate, failure, and recovery paths that were approved in Plan.</p>
        </div>
        <div className="design-verify-toolbar">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!projectMode || runningAll || anyScenarioBusy}
            onClick={async () => {
              setRunningAll(true)
              try {
                await props.store.runAllCurrentScenarios()
              } finally {
                setRunningAll(false)
              }
            }}
          >
            {runningAll ? 'Running current scenarios…' : 'Run all current scenarios'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => downloadReport(state.projectId, state.scenarioTestPlan.entries, state.scenarioRuns)}>
            Export report
          </button>
        </div>
      </div>
      {!projectMode && <p className="design-live-required">This bundled sample contains recorded evidence. Select a desktop project to execute scenarios.</p>}

      <div className="design-verify-workspace">
        <aside className="design-verify-scenario-list">
          <div className="design-verify-filters">
            <label>
              Find a scenario
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Scenario or use case" />
            </label>
            <label>
              Result
              <select value={filter} onChange={(event) => setFilter(event.target.value as ScenarioFilter)}>
                <option value="all">All scenarios</option>
                <option value="not-run">Not run</option>
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
                <option value="approved">Approved results</option>
              </select>
            </label>
          </div>
          {grouped.size === 0 ? (
            <p className="secondary-text">No scenarios match this filter.</p>
          ) : [...grouped].map(([useCaseId, entries]) => (
            <section key={useCaseId}>
              <header>
                <span>Use case</span>
                <h4>{useCaseNames.get(useCaseId) ?? 'Unnamed use case'}</h4>
                <small>{entries.length} path{entries.length === 1 ? '' : 's'}</small>
              </header>
              {entries.map((entry) => {
                const run = latestRunByScenario.get(entry.scenarioId)
                const action = state.scenarioActions[entry.scenarioId]
                const approved = Boolean(run && state.verificationApprovals[run.runId])
                const resultState = run ? currentResultState(run, currentRevisions) : undefined
                return (
                  <button
                    key={entry.scenarioId}
                    type="button"
                    className={entry.scenarioId === selectedEntry?.scenarioId ? 'selected' : ''}
                    aria-pressed={entry.scenarioId === selectedEntry?.scenarioId}
                    onClick={() => {
                      setSelectedScenarioId(entry.scenarioId)
                      props.onScenarioSelected?.(entry.scenarioId)
                    }}
                  >
                    <span>{entry.scenarioKind}</span>
                    <b>{entry.scenarioName}</b>
                    <small>
                      {action?.status === 'running' ? 'Running…'
                        : action?.status === 'approving' ? 'Approving…'
                          : approved ? `${resultState} · approved`
                            : run ? `${resultState} · ${run.outcome} · ${readableDate(run.completedAt)}` : 'Not run'}
                    </small>
                  </button>
                )
              })}
            </section>
          ))}
        </aside>

        <article className="design-verify-scenario-detail">
          {selectedEntry && (
            <>
              <header>
                <div>
                  <p className="overline">{selectedEntry.scenarioKind} path</p>
                  <h3>{selectedEntry.scenarioName}</h3>
                  <p>{useCaseNames.get(selectedEntry.useCaseId) ?? 'Approved use case'}</p>
                </div>
                <span className={`design-run-outcome design-run-${selectedRun?.outcome ?? 'not-run'}`}>
                  {approval ? 'approved' : selectedAction?.status === 'running' ? 'running' : selectedRun?.outcome ?? 'not run'}
                </span>
              </header>

              {selectedAction?.status === 'error' && (
                <div className="design-verify-row-error" role="alert">
                  <b>Action failed</b>
                  <p>{selectedAction.message}</p>
                  <button type="button" className="btn btn-secondary btn-compact" onClick={() => props.store.runScenario(selectedEntry.scenarioId)}>Retry this scenario</button>
                </div>
              )}
              {selectedAction?.status === 'approved' && <p className="design-approval-confirmation" role="status">{selectedAction.message}</p>}
              {selectedResultState === 'old' && (
                <p className="design-result-currency-warning" role="note">
                  Old result — its recorded revisions no longer match the current design. Rerun this scenario before relying on it.
                </p>
              )}

              <div className="design-verify-detail-actions">
                {projectMode && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={selectedAction?.status === 'running' || selectedAction?.status === 'approving'}
                    onClick={() => props.store.runScenario(selectedEntry.scenarioId)}
                  >
                    {selectedAction?.status === 'running' ? 'Running…' : selectedRun ? 'Run current scenario again' : 'Run current scenario'}
                  </button>
                )}
                {projectMode && selectedRun?.outcome === 'passed' && !approval && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={selectedAction?.status === 'approving'}
                    onClick={() => props.store.approveScenarioRun(selectedRun.runId)}
                  >
                    {selectedAction?.status === 'approving' ? 'Approving…' : 'Approve this exact result'}
                  </button>
                )}
                {selectedRun && props.onSelectEvidenceLink && (
                  <button type="button" className="btn btn-secondary" onClick={() => props.onSelectEvidenceLink?.(selectedRun.runId)}>
                    Open immutable evidence
                  </button>
                )}
              </div>

              {approval && (
                <div className="design-verify-approval">
                  <b>Verification approved</b>
                  <span>{readableDate(approval.approvedAt)}</span>
                  <small>This exact run and its evidence hashes are the approved result.</small>
                </div>
              )}

              {firstFailedStep && (
                <div className="design-verify-first-failed" role="alert">
                  <p className="overline">First actionable failure</p>
                  <h4>{firstFailedStep.action}</h4>
                  <p><b>Expected:</b> {firstFailedStep.expectedResult}</p>
                  <p><b>Observed:</b> {firstFailedStep.actualResult || 'No actual result was recorded.'}</p>
                  <small>Inspect this step’s evidence, correct the Build or Connect configuration, then rerun this scenario.</small>
                </div>
              )}

              <ol className="design-verify-step-comparison">
                {selectedEntry.actions.map((action, index) => {
                  const check = selectedEntry.checks.find((candidate) => candidate.stepId === action.stepId)
                  const result = selectedRun?.steps.find((candidate) => candidate.stepId === action.stepId)
                  return (
                    <li key={action.stepId} data-outcome={result?.outcome ?? 'not-run'}>
                      <span>{index + 1}</span>
                      <div>
                        <b>{action.action}</b>
                        <dl>
                          <dt>Expected</dt><dd>{check?.expectedResult ?? 'No expected result recorded.'}</dd>
                          <dt>Observed</dt><dd>{result?.actualResult || 'Not run yet.'}</dd>
                        </dl>
                      </div>
                      <span className={`design-run-outcome design-run-${result?.outcome ?? 'not-run'}`}>{result?.outcome ?? 'not run'}</span>
                    </li>
                  )
                })}
              </ol>

              {selectedRun && (
                <details className="design-verify-technical">
                  <summary>Run trace</summary>
                  <dl className="design-definition-grid">
                    <dt>Completed</dt><dd>{readableDate(selectedRun.completedAt)}</dd>
                    <dt>Run</dt><dd title={selectedRun.runId}><code>{shortId(selectedRun.runId)}</code></dd>
                    <dt>Scenario</dt><dd title={selectedRun.scenarioId}><code>{shortId(selectedRun.scenarioId)}</code></dd>
                    <dt>Build</dt><dd><code>{selectedRun.identity.build || 'Not supplied'}</code></dd>
                    <dt>Connection</dt><dd><code>{selectedRun.identity.connectionRevision || 'Not supplied'}</code></dd>
                    <dt>Environment</dt><dd>{selectedRun.identity.environment || 'Not supplied'}</dd>
                  </dl>
                </details>
              )}
            </>
          )}
        </article>
      </div>
    </section>
  )
}

function DesignLinks(props: { summary: VerifySummary; progress: ModuleDesignProgress; onSelectDesignLink: (moduleId: string) => void }) {
  return (
    <details className="design-verify-design-links">
      <summary>Approved design records ({props.summary.designLinks.length})</summary>
      {props.summary.designLinks.length === 0 ? (
        <p className="secondary-text">No approved Design records yet.</p>
      ) : (
        <ul className="design-verify-links">
          {props.summary.designLinks.map((moduleId) => (
            <li key={moduleId}>
              <button type="button" className="btn btn-secondary" onClick={() => props.onSelectDesignLink(moduleId)}>
                {nameFor(props.progress, moduleId)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}

export function DesignVerifyView(props: DesignVerifyViewProps) {
  const state = useDesignState(props.store)
  const currentModuleDesignRevisions: Record<string, string> = {}
  for (const design of state.moduleDesigns) currentModuleDesignRevisions[design.module.moduleId] = design.revision
  const localSummary = buildVerifySummary(state.scenarioRuns, {
    scenarioTestPlan: state.scenarioTestPlan,
    currentRevisions: {
      useCaseAnalysisRevision: state.useCaseAnalysis.revision,
      applicationRevision: state.architecture.applicationSpecRevision,
      systemStructureRevision: state.architecture.revision,
      moduleDesignRevisions: currentModuleDesignRevisions,
    },
    designLinks: Object.keys(state.approvedModuleDesigns),
  })
  const projectMode = props.store.isProjectMode()

  useEffect(() => {
    if (projectMode) void props.store.loadProjectVerification()
  }, [projectMode, props.store, state.scenarioRuns.length])

  const summary = projectMode && state.projectVerification.status === 'ready' && state.projectVerification.summary
    ? state.projectVerification.summary
    : localSummary

  return (
    <section className="design-verify" aria-label="Verify">
      <div className="design-phase-heading">
        <div>
          <p className="overline">Verify · Approved scenarios</p>
          <h2>Verify current build</h2>
          <p>Run approved paths, inspect expected versus observed results, approve an exact passing run, and follow its immutable evidence.</p>
        </div>
        <span className="design-source-chain">Use case → scenario → current build → step evidence</span>
      </div>
      {state.projectVerification.status === 'error' && <p role="alert" className="design-project-error">{state.projectVerification.message}</p>}
      {summary.oldCount > 0 && (
        <p className="design-result-currency-warning" role="note">
          {summary.currentCount === 0
            ? `All ${summary.oldCount} recorded result${summary.oldCount === 1 ? ' is' : 's are'} old for the current design. Finish Design, Build, and Connect, then rerun the approved scenarios.`
            : `${summary.oldCount} recorded result${summary.oldCount === 1 ? ' is' : 's are'} old. Use current results for release decisions.`}
        </p>
      )}
      <SummaryStrip summary={summary} />
      {summary.firstFailedStep && (
        <div className="design-verify-first-failed" role="alert">
          <p className="overline">First recorded failed step</p>
          <h3>{summary.firstFailedStep.action}</h3>
          <p>Open the affected scenario below to compare the expected and observed result, then correct Build or Connect and rerun it.</p>
          <details>
            <summary>Failure identity</summary>
            <dl className="design-definition-grid">
              <dt>Run</dt><dd><code>{summary.firstFailedStep.runId}</code></dd>
              <dt>Scenario</dt><dd><code>{summary.firstFailedStep.scenarioId}</code></dd>
              <dt>Step</dt><dd><code>{summary.firstFailedStep.stepId}</code></dd>
            </dl>
          </details>
          {state.projectVerification.status === 'ready' && state.projectVerification.evidence && (
            <ol className="design-verify-evidence-steps" aria-label="Failed run evidence">
              {state.projectVerification.evidence.steps.map((step) => (
                <li key={step.stepId} className={step.outcome === 'failed' ? 'design-diagnostic-blocker' : ''}>
                  <b>{step.action}</b> · {step.outcome} · {step.actualResult || 'No observed result'}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
      {projectMode && state.projectVerification.status === 'ready' && !state.projectVerification.summary && state.scenarioRuns.length === 0 && (
        <p className="secondary-text" role="status">No scenario runs recorded yet.</p>
      )}
      <ScenarioWorkspace {...props} />
      <DesignLinks summary={summary} progress={state.progress} onSelectDesignLink={props.onSelectDesignLink} />
    </section>
  )
}
