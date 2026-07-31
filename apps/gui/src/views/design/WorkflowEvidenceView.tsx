import { useEffect, useMemo, useState } from 'react'
import { currentResultState, type CurrentRevisions, type ScenarioEvidenceArtifact, type ScenarioStepEvidence } from '@engineering-ui-kit/core/design-browser'
import { useDesignState, type DesignStore } from './designState'
import { EvidenceArtifactViewer } from './EvidenceArtifactViewer'

type TracePhase = 'plan' | 'design' | 'build' | 'connect' | 'verify'
type Props = {
  store: DesignStore
  initialRunId?: string
  onRunSelected?: (runId: string) => void
  onOpenTrace?: (phase: TracePhase, moduleId?: string) => void
  initialArtifactRef?: string
  onArtifactSelected?: (ref?: string) => void
}

function runKey(run: { runId: string; contentHash: string; completedAt: string }): string {
  return `${run.runId}:${run.contentHash}:${run.completedAt}`
}

function readableDate(value?: string): string {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function shortId(value: string): string {
  return value.length <= 20 ? value : `${value.slice(0, 10)}…${value.slice(-6)}`
}

function projectedArtifacts(step: ScenarioStepEvidence): ScenarioEvidenceArtifact[] {
  if (step.artifacts?.length) return step.artifacts
  const capturedAt = step.endedAt
  const artifacts: ScenarioEvidenceArtifact[] = []
  if (step.screenshotRef) {
    artifacts.push({
      artifactId: `${step.stepId}.legacy-screenshot`,
      kind: 'screenshot',
      status: 'available',
      ref: step.screenshotRef,
      mediaType: 'image/png',
      role: 'original',
      capturedAt,
    })
  } else if (step.screenshotNotApplicableReason) {
    artifacts.push({
      artifactId: `${step.stepId}.legacy-screenshot-na`,
      kind: 'screenshot',
      status: 'notApplicable',
      role: 'original',
      capturedAt,
      notApplicableReason: step.screenshotNotApplicableReason,
    })
  }
  if (step.structuredEvidenceRef) {
    artifacts.push({
      artifactId: `${step.stepId}.legacy-structured`,
      kind: 'structured',
      status: 'available',
      ref: step.structuredEvidenceRef,
      mediaType: 'application/json',
      role: 'original',
      capturedAt,
    })
  }
  if (artifacts.length === 0) {
    artifacts.push({
      artifactId: `${step.stepId}.missing`,
      kind: 'structured',
      status: 'missing',
      role: 'original',
      capturedAt,
      failure: 'The run contains no artifact reference or approved not-applicable reason.',
    })
  }
  return artifacts
}

export function WorkflowEvidenceView({ store, initialRunId, onRunSelected, onOpenTrace, initialArtifactRef, onArtifactSelected }: Props) {
  const state = useDesignState(store)
  const orderedRuns = useMemo(() => [...state.scenarioRuns].sort((a, b) => b.completedAt.localeCompare(a.completedAt)), [state.scenarioRuns])
  const initialRun = orderedRuns.find((run) => run.runId === initialRunId) ?? orderedRuns[0]
  const [selectedRunId, setSelectedRunId] = useState(initialRun ? runKey(initialRun) : '')
  const selected = orderedRuns.find((run) => runKey(run) === selectedRunId) ?? orderedRuns[0]
  const scenarioEntry = selected ? state.scenarioTestPlan.entries.find((entry) => entry.scenarioId === selected.scenarioId) : undefined
  const scenarioName = (scenarioId: string) => state.scenarioTestPlan.entries.find((entry) => entry.scenarioId === scenarioId)?.scenarioName ?? 'Recorded scenario'
  const approval = selected ? state.verificationApprovals[selected.runId] : undefined
  const firstModuleId = selected ? Object.keys(selected.identity.moduleDesignRevisions)[0] : undefined
  const currentRevisions: CurrentRevisions = {
    useCaseAnalysisRevision: state.useCaseAnalysis.revision,
    applicationRevision: state.architecture.applicationSpecRevision,
    systemStructureRevision: state.architecture.revision,
    moduleDesignRevisions: Object.fromEntries(state.moduleDesigns.map((design) => [design.module.moduleId, design.revision])),
  }
  const selectedCurrency = selected ? currentResultState(selected, currentRevisions) : undefined

  useEffect(() => {
    const routed = orderedRuns.find((run) => run.runId === initialRunId)
    if (routed) setSelectedRunId(runKey(routed))
  }, [initialRunId, orderedRuns])

  const trace = selected ? [
    {
      phase: 'plan' as const,
      label: 'Plan',
      state: 'Approved use case',
      detail: selected.identity.useCaseAnalysisRevision || 'Revision missing',
      available: Boolean(selected.identity.useCaseAnalysisRevision),
    },
    {
      phase: 'design' as const,
      label: 'Design',
      state: `${Object.keys(selected.identity.moduleDesignRevisions).length} module revision${Object.keys(selected.identity.moduleDesignRevisions).length === 1 ? '' : 's'}`,
      detail: selected.identity.systemStructureRevision || 'Revision missing',
      available: Boolean(selected.identity.systemStructureRevision),
    },
    {
      phase: 'build' as const,
      label: 'Build',
      state: selected.identity.build ? 'Build run recorded' : 'Build identity missing',
      detail: selected.identity.build
        ? `Run ${shortId(selected.identity.build)}${selected.identity.sourceRevision ? ` · packet ${shortId(selected.identity.sourceRevision)}` : ''}`
        : 'Source revision not supplied',
      available: Boolean(selected.identity.build),
    },
    {
      phase: 'connect' as const,
      label: 'Connect',
      state: selected.identity.connectionRevision
        ? `${selected.steps[0]?.executionTrace?.entryPointKind === 'ui' ? 'UI' : 'Entry-point'} connection proved`
        : 'Connection identity missing',
      detail: selected.identity.connectionRevision
        ? `Proof ${shortId(selected.identity.connectionRevision)} · ${selected.identity.environment || 'environment not supplied'}`
        : 'Environment not supplied',
      available: Boolean(selected.identity.connectionRevision),
    },
    {
      phase: 'verify' as const,
      label: 'Verify',
      state: selected.outcome,
      detail: readableDate(selected.completedAt),
      available: true,
    },
  ] : []

  return (
    <section className="design-evidence-live" aria-label="Evidence">
      <div className="design-phase-heading">
        <div>
          <p className="overline">Evidence · Immutable trace</p>
          <h2>Trace result evidence</h2>
          <p>Each run links the approved use case, design and implementation revisions, recorded connection, scenario steps, original captures, hashes, and verification approval.</p>
        </div>
        <span className="design-source-chain">{orderedRuns.length} recorded run{orderedRuns.length === 1 ? '' : 's'}</span>
      </div>
      {orderedRuns.length === 0 ? (
        <p className="secondary-text">No scenario runs are recorded for this project. Run an approved scenario in Verify.</p>
      ) : (
        <div className="design-evidence-live-layout">
          <aside aria-label="Recorded runs">
            <header>
              <h3>Recorded runs</h3>
              <span>Newest first</span>
            </header>
            {orderedRuns.map((run) => {
              const resultState = currentResultState(run, currentRevisions)
              return (
              <button key={runKey(run)} type="button" className={runKey(run) === (selected ? runKey(selected) : '') ? 'selected' : ''} onClick={() => {
                setSelectedRunId(runKey(run))
                onRunSelected?.(run.runId)
              }}>
                <b>{scenarioName(run.scenarioId)}</b>
                <span>{resultState} · {run.outcome}</span>
                <small>{readableDate(run.completedAt)} · <span title={run.runId}>{shortId(run.runId)}</span></small>
              </button>
              )
            })}
          </aside>
          {selected && (
            <article>
              <header className="design-evidence-run-heading">
                <div>
                  <p className="overline">{scenarioEntry?.scenarioKind ?? 'Scenario'} path</p>
                  <h3>{scenarioName(selected.scenarioId)}</h3>
                  <p>{readableDate(selected.completedAt)} · {selected.steps.length} steps</p>
                </div>
                <div className="design-evidence-run-state">
                  {selectedCurrency === 'old' && <span className="design-run-currency-old">Old result</span>}
                  <span className={`design-run-outcome design-run-${selected.outcome}`}>{selected.outcome}</span>
                </div>
              </header>
              {selectedCurrency === 'old' && (
                <p className="design-result-currency-warning" role="note">
                  Old result: these immutable artifacts remain valid for the recorded run, but its revisions no longer match the current design.
                </p>
              )}

              <section className="design-evidence-trace" aria-labelledby="design-evidence-trace-heading">
                <header>
                  <div>
                    <p className="overline">Lifecycle trace</p>
                    <h4 id="design-evidence-trace-heading">Result records</h4>
                  </div>
                  {approval
                    ? <span className={selectedCurrency === 'old' ? 'old' : 'approved'}>{selectedCurrency === 'old' ? '↺ Historical approval' : '✓ Approved'} {readableDate(approval.approvedAt)}</span>
                    : <span>Not yet approved</span>}
                </header>
                <ol>
                  {trace.map((item, index) => (
                    <li key={item.phase} className={!item.available ? 'missing' : selectedCurrency === 'old' ? 'old' : 'available'}>
                      <span aria-hidden="true">{!item.available ? '!' : selectedCurrency === 'old' ? '↺' : '✓'}</span>
                      <div><b>{item.label}</b><strong>{item.state}</strong><small>{item.detail}</small></div>
                      {onOpenTrace && <button type="button" disabled={!item.available} onClick={() => onOpenTrace(item.phase, item.phase === 'design' ? firstModuleId : undefined)}>Open</button>}
                      {index < trace.length - 1 && <i aria-hidden="true" />}
                    </li>
                  ))}
                  <li className={approval ? selectedCurrency === 'old' ? 'old' : 'available' : 'pending'}>
                    <span aria-hidden="true">{approval ? selectedCurrency === 'old' ? '↺' : '✓' : '○'}</span>
                    <div><b>Approval</b><strong>{approval ? selectedCurrency === 'old' ? 'Historical verification approval' : 'Verification approved' : 'Awaiting verification approval'}</strong><small>{approval?.approvalRef ?? 'Approve the exact passing run in Verify.'}</small></div>
                    {onOpenTrace && <button type="button" onClick={() => onOpenTrace('verify')}>Open</button>}
                  </li>
                </ol>
              </section>

              <ol className="design-evidence-step-list">
                {selected.steps.map((step, index) => (
                  <li key={step.stepId}>
                    <span className="design-evidence-step-number">{index + 1}</span>
                    <div className="design-evidence-step-summary">
                      <span className={`design-run-outcome design-run-${step.outcome}`}>{step.outcome}</span>
                      <h4>{step.action}</h4>
                      <dl>
                        <dt>Expected</dt><dd>{step.expectedResult}</dd>
                        <dt>Observed</dt><dd>{step.actualResult || 'No result recorded.'}</dd>
                        {step.executionTrace && (
                          <>
                            <dt>Entry point</dt><dd>{step.executionTrace.entryPointKind}</dd>
                            <dt>Route or command</dt><dd><code>{step.executionTrace.routeOrCommand}</code></dd>
                            <dt>Action target</dt><dd><code>{step.executionTrace.actionTarget}</code></dd>
                            <dt>Observation target</dt><dd><code>{step.executionTrace.observationTarget}</code></dd>
                          </>
                        )}
                        <dt>Captured</dt><dd>{readableDate(step.endedAt)}</dd>
                      </dl>
                    </div>
                    <EvidenceArtifactViewer
                      store={store}
                      artifacts={projectedArtifacts(step)}
                      initialArtifactRef={initialArtifactRef}
                      onArtifactSelected={onArtifactSelected}
                    />
                    <details className="design-technical-details">
                      <summary>Technical identity</summary>
                      <dl>
                        <dt>Evidence hash</dt><dd><code>{step.evidenceHash ?? 'Not recorded'}</code></dd>
                        <dt>Step ID</dt><dd><code>{step.stepId}</code></dd>
                      </dl>
                    </details>
                  </li>
                ))}
              </ol>

              <details className="design-evidence-run-identity">
                <summary>Run revisions</summary>
                <dl className="design-definition-grid">
                  <dt>Run</dt><dd title={selected.runId}><code>{shortId(selected.runId)}</code></dd>
                  <dt>Scenario</dt><dd title={selected.scenarioId}><code>{shortId(selected.scenarioId)}</code></dd>
                  <dt>Use-case revision</dt><dd><code>{selected.identity.useCaseAnalysisRevision}</code></dd>
                  <dt>Application revision</dt><dd><code>{selected.identity.applicationRevision}</code></dd>
                  <dt>System revision</dt><dd><code>{selected.identity.systemStructureRevision}</code></dd>
                  <dt>Source revision</dt><dd><code>{selected.identity.sourceRevision || 'Not supplied'}</code></dd>
                  <dt>Environment</dt><dd>{selected.identity.environment || 'Not supplied'}</dd>
                  <dt>Runner</dt><dd>{selected.identity.runner}</dd>
                  <dt>Content hash</dt><dd><code>{selected.contentHash}</code></dd>
                </dl>
              </details>
            </article>
          )}
        </div>
      )}
    </section>
  )
}
