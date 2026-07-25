/**
 * §11 Copilot workflow UI, §12 Build, §3.5 gate-mode UI.
 *
 * Shows the current Design-to-Build gate mode beside every handoff action,
 * the sample's saved `incrementalModules` preview as a read-only comparison,
 * a per-module handoff panel (real `buildModuleDesignPacket` /
 * `buildModuleImplementationPacket`, blocked reasons shown verbatim), §11.7
 * multi-pass continuation actions, and the full returned-delta review flow
 * (import → inspect → approve → apply (simulated in browser) → rollback).
 */

import { useState, type FormEvent } from 'react'
import type { ModuleImplementationPacket } from '@engineering-ui-kit/core/design-browser'
import { useDesignState, type DesignStore } from './designState'
import { gateModeDescription, gateModeLabel } from './designShared'

export type BuildHandoffViewProps = {
  store: DesignStore
}

const CONTINUATION_ACTIONS: { passKind: ModuleImplementationPacket['passKind']; label: string }[] = [
  { passKind: 'continueModule', label: 'Continue this module' },
  { passKind: 'fixFailedChecks', label: 'Fix failed checks' },
  { passKind: 'addMissingAcceptanceCase', label: 'Add a missing acceptance case' },
  { passKind: 'updateAfterContractChange', label: 'Update after a contract change' },
  { passKind: 'prepareConnectionBinding', label: 'Prepare a connection binding' },
  { passKind: 'addressReviewComments', label: 'Address review comments' },
]

export function BuildHandoffView(props: BuildHandoffViewProps) {
  const { store } = props
  const state = useDesignState(store)
  const [moduleId, setModuleId] = useState<string>(state.selectedModuleId ?? state.progress.modules[0]?.moduleId ?? '')
  const [pasteText, setPasteText] = useState('')

  const design = moduleId ? store.getDesign(moduleId) : undefined
  const gate = moduleId ? store.buildGateFor(moduleId) : undefined
  const handoff = state.moduleHandoffs[moduleId]
  const deltaFlow = state.deltaFlows[moduleId]
  const canContinue = handoff?.kind === 'implementation' && handoff.ok && handoff.packet

  function submitPaste(event: FormEvent) {
    event.preventDefault()
    if (!pasteText.trim()) return
    store.importReturnedDeltaText(moduleId, pasteText)
    setPasteText('')
  }

  return (
    <section className="design-build-handoff" aria-label="Build handoff">
      <div className="design-gate-mode-banner" role="note">
        <strong>Gate mode: {gateModeLabel(state.policy.mode)}</strong>
        <p className="secondary-text">{gateModeDescription(state.policy.mode)}</p>
      </div>

      <div className="design-incremental-preview" aria-label="Incremental modules preview (not applied)">
        <h3>Incremental modules preview</h3>
        <p className="secondary-text">
          A saved preview of {gateModeLabel(state.incrementalPreview.policy.mode)} mode. This never changes the approved baseline or the active gate mode.
        </p>
        <p>
          First module ({state.incrementalPreview.gateForFirstModule.moduleId}):{' '}
          {state.incrementalPreview.gateForFirstModule.result.ok ? 'would pass the Build gate.' : 'would be blocked:'}
        </p>
        {!state.incrementalPreview.gateForFirstModule.result.ok && (
          <ul className="design-error-summary" aria-label="Incremental preview blocked reasons">
            {state.incrementalPreview.gateForFirstModule.result.diagnostics.map((diagnostic, index) => (
              <li key={`${diagnostic.code}.${index}`}>{diagnostic.message}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="design-handoff-module-picker">
        <label htmlFor="design-handoff-module-select">Module</label>
        <select id="design-handoff-module-select" value={moduleId} onChange={(event) => setModuleId(event.target.value)}>
          {state.progress.modules.map((entry) => (
            <option key={entry.moduleId} value={entry.moduleId}>
              {entry.name}
            </option>
          ))}
        </select>
      </div>

      {design && gate && (
        <div className="design-handoff-panel" aria-label={`Handoff panel for ${design.module.name}`}>
          <h3>{design.module.name}</h3>
          <p>
            Build gate: <strong>{gate.ok ? 'Open' : 'Blocked'}</strong>
          </p>
          {!gate.ok && (
            <ul className="design-error-summary" aria-label="Build gate blocked reasons">
              {gate.diagnostics.map((diagnostic, index) => (
                <li key={`${diagnostic.code}.${index}`}>{diagnostic.message}</li>
              ))}
            </ul>
          )}

          <button type="button" className="btn btn-primary" onClick={() => store.createModuleHandoff(moduleId)}>
            Create Copilot handoff
          </button>

          {handoff && (
            <div className="design-handoff-result" role="status" aria-live="polite">
              <p>{handoff.ok ? `Created a ${handoff.kind} handoff packet.` : `Handoff blocked (${handoff.kind}).`}</p>
              {!handoff.ok && (
                <ul className="design-error-summary" aria-label="Handoff blocked reasons">
                  {handoff.diagnostics.map((diagnostic, index) => (
                    <li key={`${diagnostic.code}.${index}`}>{diagnostic.message}</li>
                  ))}
                </ul>
              )}
              <h4>Context manifest</h4>
              <ul className="design-context-manifest">
                {handoff.manifest.entries.map((entry) => (
                  <li key={entry.ref}>
                    [{entry.kind}] {entry.ref} — {entry.inclusionReason} ({entry.bytes} bytes)
                  </li>
                ))}
              </ul>
              <p>
                {handoff.manifest.totalBytes} of {handoff.manifest.tokenOrByteLimit} bytes used.
              </p>
              {handoff.limitReport && (
                <div className="design-context-limit-report" role="alert">
                  <p>Over the configured context limit ({handoff.limitReport.configuredLimit} bytes).</p>
                  <h5>Largest items</h5>
                  <ul>
                    {handoff.limitReport.largestItems.map((item) => (
                      <li key={item.ref}>
                        {item.ref} ({item.bytes} bytes)
                      </li>
                    ))}
                  </ul>
                  <h5>Safe to exclude</h5>
                  <ul>
                    {handoff.limitReport.safeExclusionChoices.map((choice) => (
                      <li key={choice.ref}>
                        {choice.ref} — {choice.reason}
                      </li>
                    ))}
                  </ul>
                  <p className="secondary-text">You can always create a smaller subtask instead.</p>
                </div>
              )}
            </div>
          )}

          {canContinue && (
            <div className="design-multi-pass-actions" aria-label="Multi-pass continuation actions">
              <h4>Continue this module (§11.7)</h4>
              {CONTINUATION_ACTIONS.map((action) => (
                <button key={action.passKind} type="button" className="btn btn-secondary" onClick={() => store.continueModuleHandoff(moduleId, action.passKind)}>
                  {action.label}
                </button>
              ))}
            </div>
          )}

          <div className="design-delta-flow" aria-label="Returned changes">
            <h4>Returned changes</h4>
            <form onSubmit={submitPaste}>
              <label htmlFor="design-delta-paste">Paste a returned delta (JSON)</label>
              <textarea id="design-delta-paste" rows={4} value={pasteText} onChange={(event) => setPasteText(event.target.value)} />
              <button type="submit" className="btn btn-secondary" disabled={!pasteText.trim()}>
                Import pasted delta
              </button>
            </form>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                void store.importSampleReturnedDelta(moduleId)
              }}
            >
              Use sample deterministic-test-provider delta (sample only, not real Copilot output)
            </button>
            {deltaFlow?.importError && (
              <p role="alert" className="design-delta-error">
                {deltaFlow.importError}
              </p>
            )}

            {deltaFlow?.delta && (
              <div className="design-delta-imported">
                <p>Delta {deltaFlow.delta.deltaId} imported ({deltaFlow.deltaSource === 'sample-demo' ? 'sample demo' : 'pasted'}).</p>
                <button type="button" className="btn btn-primary" onClick={() => store.inspectReturnedDelta(moduleId)}>
                  Inspect returned changes
                </button>
              </div>
            )}

            {deltaFlow?.inspection && (
              <div className="design-delta-inspection" aria-label="Delta inspection">
                <p>{deltaFlow.inspection.accepted ? 'Accepted.' : `Rejected: ${deltaFlow.inspection.rejectionReasons.join(', ')}.`}</p>
                <h5>File summary</h5>
                <p>
                  Created: {deltaFlow.inspection.fileSummary.created.join(', ') || 'none'}; Changed: {deltaFlow.inspection.fileSummary.changed.join(', ') || 'none'}; Deleted:{' '}
                  {deltaFlow.inspection.fileSummary.deleted.join(', ') || 'none'}
                </p>
                <h5>Record changes</h5>
                {deltaFlow.inspection.recordChanges.length === 0 ? (
                  <p className="secondary-text">None.</p>
                ) : (
                  <ul>
                    {deltaFlow.inspection.recordChanges.map((change) => (
                      <li key={change.recordId}>
                        {change.recordId} ({change.kind}): {change.summary}
                      </li>
                    ))}
                  </ul>
                )}
                <h5>Contract changes</h5>
                {deltaFlow.inspection.contractChanges.length === 0 ? (
                  <p className="secondary-text">None.</p>
                ) : (
                  <ul>
                    {deltaFlow.inspection.contractChanges.map((change) => (
                      <li key={`${change.operationId}.${change.fromVersion}.${change.toVersion}`}>
                        {change.operationId}: {change.fromVersion} → {change.toVersion} ({change.compatibility})
                      </li>
                    ))}
                  </ul>
                )}
                <h5>Affected requirements</h5>
                <p>{deltaFlow.inspection.affectedRequirementIds.join(', ') || 'None.'}</p>
                <h5>Affected use cases</h5>
                <p>{deltaFlow.inspection.affectedUseCaseIds.join(', ') || 'None.'}</p>
                <h5>Test results</h5>
                {deltaFlow.inspection.testResults.length === 0 ? (
                  <p className="secondary-text">None.</p>
                ) : (
                  <ul>
                    {deltaFlow.inspection.testResults.map((result) => (
                      <li key={result.command}>
                        {result.command}: {result.passed ? 'passed' : 'failed'} — {result.summary}
                      </li>
                    ))}
                  </ul>
                )}
                <h5>Warnings</h5>
                <p>{deltaFlow.inspection.newWarnings.join(', ') || 'None.'}</p>
                <h5>New dependencies</h5>
                <p>{deltaFlow.inspection.newDependencies.join(', ') || 'None.'}</p>
                <h5>Out-of-scope attempts</h5>
                {deltaFlow.inspection.outOfScopeAttempts.length === 0 ? (
                  <p className="secondary-text">None.</p>
                ) : (
                  <ul aria-label="Out-of-scope attempts">
                    {deltaFlow.inspection.outOfScopeAttempts.map((attempt) => (
                      <li key={attempt}>{attempt}</li>
                    ))}
                  </ul>
                )}
                <h5>Generated vs user-owned files</h5>
                <p>
                  Generated: {deltaFlow.inspection.generatedFiles.join(', ') || 'none'}; User-owned: {deltaFlow.inspection.userOwnedFiles.join(', ') || 'none'}
                </p>
                <h5>Rollback point</h5>
                <p>{deltaFlow.inspection.rollbackPointRef}</p>

                {deltaFlow.inspection.accepted && !deltaFlow.approved && (
                  <button type="button" className="btn btn-primary" onClick={() => store.approveReturnedDelta(moduleId)}>
                    Approve to apply
                  </button>
                )}
                {deltaFlow.approved && !deltaFlow.applyResult && (
                  <button type="button" className="btn btn-primary" onClick={() => store.applyReturnedDelta(moduleId)}>
                    Apply reviewed changes
                  </button>
                )}
              </div>
            )}

            {deltaFlow?.applyResult && (
              <div className="design-delta-apply-result" role="status" aria-live="polite">
                <p>
                  {deltaFlow.applyResult.applied
                    ? `Applied (simulated in browser mode): ${deltaFlow.applyResult.appliedFiles.join(', ')}.`
                    : `Apply failed and rolled back automatically: ${deltaFlow.applyResult.failure ?? ''}.`}
                </p>
                {deltaFlow.applyResult.applied && !deltaFlow.rolledBack && (
                  <button type="button" className="btn btn-secondary" onClick={() => store.rollbackReturnedDelta(moduleId)}>
                    Roll back (demonstration)
                  </button>
                )}
                {deltaFlow.rolledBack && <p>Rolled back.</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
