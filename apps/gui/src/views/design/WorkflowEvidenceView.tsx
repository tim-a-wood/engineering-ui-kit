import { useMemo, useState } from 'react'
import { useDesignState, type DesignStore } from './designState'

type Props = { store: DesignStore }

function runKey(run: { runId: string; contentHash: string; completedAt: string }): string {
  return `${run.runId}:${run.contentHash}:${run.completedAt}`
}

export function WorkflowEvidenceView({ store }: Props) {
  const state = useDesignState(store)
  const orderedRuns = useMemo(() => [...state.scenarioRuns].sort((a, b) => b.completedAt.localeCompare(a.completedAt)), [state.scenarioRuns])
  const [selectedRunId, setSelectedRunId] = useState(orderedRuns[0] ? runKey(orderedRuns[0]) : '')
  const selected = orderedRuns.find((run) => runKey(run) === selectedRunId) ?? orderedRuns[0]
  const scenarioName = (scenarioId: string) => state.scenarioTestPlan.entries.find((entry) => entry.scenarioId === scenarioId)?.scenarioName ?? scenarioId

  return (
    <section className="design-evidence-live" aria-label="Evidence">
      <div className="design-phase-heading">
        <div>
          <p className="overline">Evidence · Immutable runs</p>
          <h2>Trace scenario results to exact design revisions</h2>
          <p>Every row below comes from a persisted scenario run. Screenshot references, structured evidence references, hashes, build identity, and source identity are shown without substitution.</p>
        </div>
        <span className="design-source-chain">{orderedRuns.length} recorded run{orderedRuns.length === 1 ? '' : 's'}</span>
      </div>
      {orderedRuns.length === 0 ? (
        <p className="secondary-text">No scenario runs are recorded for this project. Run an approved scenario in Verify.</p>
      ) : (
        <div className="design-evidence-live-layout">
          <aside>
            {orderedRuns.map((run) => (
              <button key={runKey(run)} type="button" className={runKey(run) === (selected ? runKey(selected) : '') ? 'selected' : ''} onClick={() => setSelectedRunId(runKey(run))}>
                <b>{scenarioName(run.scenarioId)}</b>
                <span>{run.outcome}</span>
                <small><code>{run.scenarioId}</code><br />{run.completedAt}</small>
              </button>
            ))}
          </aside>
          {selected && (
            <article>
              <header>
                <div><h3>{scenarioName(selected.scenarioId)}</h3><code>{selected.scenarioId}</code><br /><code>{selected.runId}</code></div>
                <span className={`design-run-outcome design-run-${selected.outcome}`}>{selected.outcome}</span>
              </header>
              <dl className="design-definition-grid">
                <dt>Use-case revision</dt><dd><code>{selected.identity.useCaseAnalysisRevision}</code></dd>
                <dt>Application revision</dt><dd><code>{selected.identity.applicationRevision}</code></dd>
                <dt>System revision</dt><dd><code>{selected.identity.systemStructureRevision}</code></dd>
                <dt>Source revision</dt><dd><code>{selected.identity.sourceRevision || 'Not supplied'}</code></dd>
                <dt>Environment</dt><dd>{selected.identity.environment || 'Not supplied'}</dd>
                <dt>Runner</dt><dd>{selected.identity.runner}</dd>
              </dl>
              <ol className="design-evidence-step-list">
                {selected.steps.map((step) => (
                  <li key={step.stepId}>
                    <span className={`design-run-outcome design-run-${step.outcome}`}>{step.outcome}</span>
                    <div><b>{step.action}</b><p>{step.actualResult}</p></div>
                    <dl>
                      <dt>Screenshot</dt><dd>{step.screenshotRef ?? 'Not applicable'}</dd>
                      <dt>Structured evidence</dt><dd>{step.structuredEvidenceRef ?? 'Not applicable'}</dd>
                      <dt>Evidence hash</dt><dd><code>{step.evidenceHash ?? 'None'}</code></dd>
                    </dl>
                  </li>
                ))}
              </ol>
            </article>
          )}
        </div>
      )}
    </section>
  )
}
