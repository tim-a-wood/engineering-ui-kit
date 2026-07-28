/**
 * §22 Lifecycle Explorer sample — browse sample evidence by lifecycle
 * phase: the five required §22.3 defects (broken trace, MATLAB/Simulink
 * timeout, invalid column mapping, rejected non-independent review, old
 * package after a baseline change), plus valid, old, failed-refresh,
 * recovery, and baseline data. Every item has a follow-trace navigation
 * action. State labels follow Appendix C ("Old", never "stale").
 */

import type { DesignAuditEvent, ModuleDesignSpecification } from '@engineering-ui-kit/core/design-browser'
import { useDesignState, type DesignStore } from './designState'
import { stateLabel, verificationOutcomeLabel } from './designShared'

export type EvidenceExplorerProps = {
  store: DesignStore
  onFollowTrace: (moduleId: string) => void
}

function moduleIdForUseCase(moduleDesigns: ModuleDesignSpecification[], useCaseId: string): string | undefined {
  return moduleDesigns.find((design) => design.trace.useCaseIds.includes(useCaseId))?.module.moduleId
}

function moduleIdForAuditEvent(approvedModuleDesigns: Record<string, ModuleDesignSpecification>, event: DesignAuditEvent): string | undefined {
  return Object.values(approvedModuleDesigns).find((design) => design.contentHash === event.baseHash)?.module.moduleId
}

export function EvidenceExplorer(props: EvidenceExplorerProps) {
  const state = useDesignState(props.store)
  const nameByModuleId = new Map(state.progress.modules.map((entry) => [entry.moduleId, entry.name]))
  const nameOf = (moduleId: string) => nameByModuleId.get(moduleId) ?? moduleId

  const { evidenceGraphBrokenTrace, matlabAdapterTimeout, spreadsheetInvalidMapping, findingReviewRejectedDecision, packageExportOldResult } = state.defects
  const findingModuleId = moduleIdForAuditEvent(state.approvedModuleDesigns, findingReviewRejectedDecision)
  const packageExportModuleId = moduleIdForUseCase(state.moduleDesigns, packageExportOldResult.run.useCaseId)

  const passedResults = Object.values(state.verificationResults)
    .flat()
    .filter((result) => result.outcome === 'passed')
    .slice(0, 6)

  const oldModules = state.progress.modules.filter((entry) => entry.state === 'stale')

  const failedRuns = state.scenarioRuns.filter((run) => run.outcome === 'failed')

  const recoveryModules = state.moduleDesigns.filter((design) => design.behavior.recovery.trim().length > 0)

  return (
    <section className="design-evidence-explorer" aria-label="Evidence Explorer">
      <h2>Evidence Explorer</h2>
      <p className="secondary-text">{state.syntheticDataStatement}</p>

      <div className="design-evidence-phase" role="region" aria-label="Refresh evidence defects">
        <h3>Refresh evidence — defects</h3>
        <ul className="design-evidence-list">
          <li>
            <strong>Broken trace</strong> — {evidenceGraphBrokenTrace.summary}
            <button type="button" className="btn btn-secondary" onClick={() => props.onFollowTrace(evidenceGraphBrokenTrace.moduleId)}>
              Follow trace to {nameOf(evidenceGraphBrokenTrace.moduleId)}
            </button>
          </li>
          <li>
            <strong>MATLAB and Simulink timeout</strong> ({verificationOutcomeLabel(matlabAdapterTimeout.outcome)}) — {matlabAdapterTimeout.summary}
            <button type="button" className="btn btn-secondary" onClick={() => props.onFollowTrace(matlabAdapterTimeout.moduleId)}>
              Follow trace to {nameOf(matlabAdapterTimeout.moduleId)}
            </button>
          </li>
          <li>
            <strong>Invalid column mapping</strong> — {spreadsheetInvalidMapping.summary}
            <button type="button" className="btn btn-secondary" onClick={() => props.onFollowTrace(spreadsheetInvalidMapping.moduleId)}>
              Follow trace to {nameOf(spreadsheetInvalidMapping.moduleId)}
            </button>
          </li>
        </ul>
      </div>

      <div className="design-evidence-phase" role="region" aria-label="Review finding defects">
        <h3>Review finding — defects</h3>
        <p>
          <strong>Rejected — reviewer not independent</strong> — {findingReviewRejectedDecision.diagnosticCodes.join(', ')} (target {findingReviewRejectedDecision.targetRecordId})
        </p>
        {findingModuleId && (
          <button type="button" className="btn btn-secondary" onClick={() => props.onFollowTrace(findingModuleId)}>
            Follow trace to {nameOf(findingModuleId)}
          </button>
        )}
      </div>

      <div className="design-evidence-phase" role="region" aria-label="Export package defects">
        <h3>Export package — defects</h3>
        <p>
          <strong>Old package after baseline change</strong> — run {packageExportOldResult.run.runId} is {packageExportOldResult.currentState === 'old' ? stateLabel('stale') : 'Current'}.
        </p>
        {packageExportModuleId && (
          <button type="button" className="btn btn-secondary" onClick={() => props.onFollowTrace(packageExportModuleId)}>
            Follow trace to {nameOf(packageExportModuleId)}
          </button>
        )}
      </div>

      <div className="design-evidence-phase" role="region" aria-label="Valid evidence">
        <h3>Valid evidence</h3>
        {passedResults.length === 0 ? (
          <p className="secondary-text">No valid results recorded.</p>
        ) : (
          <ul className="design-evidence-list">
            {passedResults.map((result) => (
              <li key={`${result.moduleId}.${result.caseId}`}>
                {verificationOutcomeLabel(result.outcome)}: {result.summary}
                <button type="button" className="btn btn-secondary" onClick={() => props.onFollowTrace(result.moduleId)}>
                  Follow trace to {nameOf(result.moduleId)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="design-evidence-phase" role="region" aria-label="Old module designs">
        <h3>Old module designs</h3>
        {oldModules.length === 0 ? (
          <p className="secondary-text">No old module designs.</p>
        ) : (
          <ul className="design-evidence-list">
            {oldModules.map((entry) => (
              <li key={entry.moduleId}>
                {entry.name}: {stateLabel(entry.state)}
                <button type="button" className="btn btn-secondary" onClick={() => props.onFollowTrace(entry.moduleId)}>
                  Follow trace to {entry.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="design-evidence-phase" role="region" aria-label="Failed refresh runs">
        <h3>Failed refresh runs</h3>
        {failedRuns.length === 0 ? (
          <p className="secondary-text">No failed scenario runs.</p>
        ) : (
          <ul className="design-evidence-list">
            {failedRuns.map((run) => {
              const runModuleId = moduleIdForUseCase(state.moduleDesigns, run.useCaseId)
              return (
                <li key={run.runId}>
                  {run.scenarioId} failed.
                  {runModuleId && (
                    <button type="button" className="btn btn-secondary" onClick={() => props.onFollowTrace(runModuleId)}>
                      Follow trace to {nameOf(runModuleId)}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="design-evidence-phase" role="region" aria-label="Recovery behavior">
        <h3>Recovery behavior</h3>
        {recoveryModules.length === 0 ? (
          <p className="secondary-text">No recorded recovery behavior.</p>
        ) : (
          <ul className="design-evidence-list">
            {recoveryModules.map((design) => (
              <li key={design.module.moduleId}>
                {design.module.name}: {design.behavior.recovery}
                <button type="button" className="btn btn-secondary" onClick={() => props.onFollowTrace(design.module.moduleId)}>
                  Follow trace to {design.module.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="design-evidence-phase" role="region" aria-label="Design baseline">
        <h3>Design baseline</h3>
        <p>
          {state.designBaseline.id} revision {state.designBaseline.revision} — {state.designBaseline.status}. {state.designBaseline.requiredModuleIds.length} required modules,{' '}
          {state.designBaseline.missingModuleIds.length} missing.
        </p>
      </div>
    </section>
  )
}
