/**
 * §14.4 Verify view — counts over scenario runs (use cases, scenarios,
 * passed/failed/skipped/cancelled, steps, screenshots, structured evidence,
 * first failed step, current vs old) and links to approved Design records.
 * This view deliberately renders no design diagrams (§14.4 "Verify shall not
 * contain design diagrams").
 *
 * `sample` mode computes the summary locally (`buildVerifySummary` over the
 * sample's own scenario runs). `project` mode (second-review P1 finding:
 * "Verify... are unavailable in project mode") reads the identical
 * `VerifySummary` shape from the bridge's `getScenarioCoverage` (§17.1) —
 * `packages/core`'s own `getScenarioCoverage` operation calls the same
 * `buildVerifySummary` function server-side — and, when the summary reports
 * a `firstFailedStep`, fetches that one scenario run's full evidence via
 * `getVerificationEvidence`. There is no bridge operation to list every
 * scenario run, so `project` mode never invents one; an honest empty state
 * ("No scenario runs recorded yet") is shown instead.
 */

import { useEffect } from 'react'
import { buildVerifySummary, type ModuleDesignProgress, type ScenarioRun, type VerifySummary } from '@engineering-ui-kit/core/design-browser'
import { useDesignState, type DesignStore } from './designState'
import { currentStateLabel } from './designShared'

export type DesignVerifyViewProps = {
  store: DesignStore
  onSelectDesignLink: (moduleId: string) => void
}

function nameFor(progress: ModuleDesignProgress, moduleId: string): string {
  return progress.modules.find((entry) => entry.moduleId === moduleId)?.name ?? moduleId
}

function VerifySummaryGrid(props: { summary: VerifySummary; progress: ModuleDesignProgress; onSelectDesignLink: (moduleId: string) => void }) {
  const { summary, progress, onSelectDesignLink } = props
  return (
    <>
      <dl className="design-definition-grid design-verify-counts">
        <dt>Use cases</dt>
        <dd>{summary.useCaseCount}</dd>
        <dt>Scenarios</dt>
        <dd>{summary.scenarioCount}</dd>
        <dt>Passed</dt>
        <dd>{summary.passedCount}</dd>
        <dt>Failed</dt>
        <dd>{summary.failedCount}</dd>
        <dt>Skipped</dt>
        <dd>{summary.skippedCount}</dd>
        <dt>Cancelled</dt>
        <dd>{summary.cancelledCount}</dd>
        <dt>Steps</dt>
        <dd>{summary.stepCount}</dd>
        <dt>Screenshots</dt>
        <dd>{summary.screenshotCount}</dd>
        <dt>Structured evidence</dt>
        <dd>{summary.structuredEvidenceCount}</dd>
        <dt>Current results</dt>
        <dd>{currentStateLabel('current')}: {summary.currentCount}</dd>
        <dt>Old results</dt>
        <dd>{currentStateLabel('old')}: {summary.oldCount}</dd>
      </dl>

      {summary.firstFailedStep && (
        <div className="design-verify-first-failed" role="alert">
          <h3>First failed step</h3>
          <p>
            Run {summary.firstFailedStep.runId}, scenario {summary.firstFailedStep.scenarioId}, step {summary.firstFailedStep.stepId}: {summary.firstFailedStep.action}
          </p>
        </div>
      )}

      <h3>Design links</h3>
      {summary.designLinks.length === 0 ? (
        <p className="secondary-text">No approved Design records yet.</p>
      ) : (
        <ul className="design-verify-links">
          {summary.designLinks.map((moduleId) => (
            <li key={moduleId}>
              <button type="button" className="btn btn-secondary" onClick={() => onSelectDesignLink(moduleId)}>
                {nameFor(progress, moduleId)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function EvidenceDetail(props: { evidence: ScenarioRun }) {
  const { evidence } = props
  return (
    <div className="design-verify-evidence-detail" aria-label="First failed step evidence">
      <h3>Evidence for {evidence.runId}</h3>
      <p className="secondary-text">
        Scenario {evidence.scenarioId} — outcome: {evidence.outcome}.
      </p>
      {evidence.steps.length === 0 ? (
        <p className="secondary-text">No steps recorded for this run.</p>
      ) : (
        <ol className="design-verify-evidence-steps">
          {evidence.steps.map((step) => (
            <li key={step.stepId} className={`design-diagnostic-${step.outcome === 'failed' ? 'blocker' : 'info'}`}>
              {step.action} — {step.outcome}
              {step.screenshotRef ? ` (screenshot: ${step.screenshotRef})` : ''}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function ProjectVerify(props: DesignVerifyViewProps) {
  const { store } = props
  const state = useDesignState(store)

  useEffect(() => {
    void store.loadProjectVerification()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store])

  const projectVerification = state.projectVerification

  return (
    <section className="design-verify" aria-label="Verify">
      <h2>Verify</h2>
      {(projectVerification.status === 'idle' || projectVerification.status === 'loading') && (
        <p role="status" className="secondary-text">
          Loading verification data…
        </p>
      )}
      {projectVerification.status === 'error' && (
        <p role="alert" className="design-project-error">
          {projectVerification.message}
        </p>
      )}
      {projectVerification.status === 'ready' && !projectVerification.summary && (
        <p className="secondary-text" role="status">
          No scenario runs recorded yet.
        </p>
      )}
      {projectVerification.status === 'ready' && projectVerification.summary && (
        <VerifySummaryGrid summary={projectVerification.summary} progress={state.progress} onSelectDesignLink={props.onSelectDesignLink} />
      )}
      {projectVerification.status === 'ready' && projectVerification.evidence && <EvidenceDetail evidence={projectVerification.evidence} />}
    </section>
  )
}

function SampleVerify(props: DesignVerifyViewProps) {
  const state = useDesignState(props.store)
  const currentModuleDesignRevisions: Record<string, string> = {}
  for (const design of state.moduleDesigns) currentModuleDesignRevisions[design.module.moduleId] = design.revision

  const summary = buildVerifySummary(state.scenarioRuns, {
    scenarioTestPlan: state.scenarioTestPlan,
    currentRevisions: { moduleDesignRevisions: currentModuleDesignRevisions },
    designLinks: Object.keys(state.approvedModuleDesigns),
  })

  return (
    <section className="design-verify" aria-label="Verify">
      <h2>Verify</h2>
      <VerifySummaryGrid summary={summary} progress={state.progress} onSelectDesignLink={props.onSelectDesignLink} />
    </section>
  )
}

export function DesignVerifyView(props: DesignVerifyViewProps) {
  return props.store.isProjectMode() ? <ProjectVerify {...props} /> : <SampleVerify {...props} />
}
