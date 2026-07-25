/**
 * §14.4 Verify view — counts over the sample scenario runs (use cases,
 * scenarios, passed/failed/skipped/cancelled, steps, screenshots, structured
 * evidence, first failed step, current vs old) and links to approved Design
 * records. This view deliberately renders no design diagrams (§14.4 "Verify
 * shall not contain design diagrams").
 */

import { buildVerifySummary, type ModuleDesignProgress } from '@engineering-ui-kit/core/design-browser'
import { useDesignState, type DesignStore } from './designState'
import { currentStateLabel } from './designShared'

export type DesignVerifyViewProps = {
  store: DesignStore
  onSelectDesignLink: (moduleId: string) => void
}

function nameFor(progress: ModuleDesignProgress, moduleId: string): string {
  return progress.modules.find((entry) => entry.moduleId === moduleId)?.name ?? moduleId
}

export function DesignVerifyView(props: DesignVerifyViewProps) {
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
              <button type="button" className="btn btn-secondary" onClick={() => props.onSelectDesignLink(moduleId)}>
                {nameFor(state.progress, moduleId)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
