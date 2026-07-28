/**
 * §11 implementation-handoff UI, §12 Build, §3.5 gate-mode UI.
 *
 * Shows the current Design-to-Build gate mode beside every handoff action,
 * the sample's saved `incrementalModules` preview as a read-only comparison,
 * a per-module handoff panel (real `buildModuleDesignPacket` /
 * `buildModuleImplementationPacket`, blocked reasons shown verbatim), §11.7
 * multi-pass continuation actions, and the full returned-delta review flow
 * (import → inspect → approve → apply (simulated in browser) → rollback).
 */

import { useState, type ChangeEvent, type FormEvent } from 'react'
import type { HandoffRun } from '@engineering-ui-kit/core'
import type { ModuleImplementationPacket } from '@engineering-ui-kit/core/design-browser'
import { useDesignState, type DesignStore } from './designState'
import { gateModeDescription, gateModeLabel, stateLabel } from './designShared'
import { ModuleDiagrams } from './ModuleDiagrams'

export type BuildHandoffViewProps = {
  store: DesignStore
  linkedRun?: HandoffRun
  onContinueToBuild?: (input: { packet: ModuleImplementationPacket; moduleName: string }) => Promise<void> | void
}

const CONTINUATION_ACTIONS: { passKind: ModuleImplementationPacket['passKind']; label: string }[] = [
  { passKind: 'continueModule', label: 'Continue this module' },
  { passKind: 'fixFailedChecks', label: 'Fix failed checks' },
  { passKind: 'addMissingAcceptanceCase', label: 'Add acceptance case' },
  { passKind: 'updateAfterContractChange', label: 'Update contract change' },
  { passKind: 'prepareConnectionBinding', label: 'Prepare connection' },
  { passKind: 'addressReviewComments', label: 'Address review comments' },
]

export function BuildHandoffView(props: BuildHandoffViewProps) {
  const { store } = props
  const state = useDesignState(store)
  const [moduleId, setModuleId] = useState<string>(state.selectedModuleId ?? state.progress.modules[0]?.moduleId ?? '')
  const [pasteText, setPasteText] = useState('')
  const [continuing, setContinuing] = useState(false)

  const design = moduleId ? store.getDesign(moduleId) : undefined
  const progressEntry = state.progress.modules.find((entry) => entry.moduleId === moduleId)
  const gate = moduleId ? store.buildGateFor(moduleId) : undefined
  const handoff = state.moduleHandoffs[moduleId]
  const deltaFlow = state.deltaFlows[moduleId]
  const canContinue = handoff?.kind === 'implementation' && handoff.ok && handoff.packet
  const linkedRun = props.linkedRun
  const baselineAction = state.validNextActions.find(
    (action) => action.operation === 'createDesignBaseline' || action.operation === 'approveDesignBaseline',
  )
  const baselineApproved = Boolean(state.designBaseline.revision && state.designBaseline.status === 'approved')

  function submitPaste(event: FormEvent) {
    event.preventDefault()
    if (!pasteText.trim()) return
    store.importReturnedDeltaText(moduleId, pasteText)
    setPasteText('')
  }

  async function importDeltaFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      store.importReturnedDeltaText(moduleId, await file.text(), 'file')
    } catch (error) {
      store.importReturnedDeltaText(moduleId, '', 'file')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <section className="design-build-handoff" aria-label="Build handoff">
      <div className="design-handoff-heading">
        <div>
          <p className="overline">Focused handoff</p>
          <h2>Prepare module delivery</h2>
          <p>Select a module, resolve its gate, create one bounded packet, then continue the same packet into Build &amp; Test.</p>
        </div>
      </div>
      <div className="design-gate-mode-banner" role="note">
        <strong>Gate mode: {gateModeLabel(state.policy.mode)}</strong>
        <p className="secondary-text">{gateModeDescription(state.policy.mode)}</p>
      </div>

      {state.mode === 'project' && state.policy.mode === 'completeBaseline' && (
        <section className={`design-baseline-gate ${baselineApproved ? 'complete' : 'current'}`} aria-label="Design baseline gate">
          <div>
            <p className="overline">Required release gate</p>
            <h3>{baselineApproved ? 'Baseline approved' : baselineAction?.operation === 'approveDesignBaseline' ? 'Approve design baseline' : 'Freeze design baseline'}</h3>
            <p>
              {baselineApproved
                ? `Revision ${state.designBaseline.revision} freezes the approved system structure, module designs, and contracts used by every implementation packet.`
                : baselineAction?.operation === 'approveDesignBaseline'
                  ? 'Review and explicitly approve the frozen structure, module revisions, and operation contracts before implementation starts.'
                  : 'Create one immutable baseline from every approved module before preparing an implementation packet.'}
            </p>
            {!baselineApproved && baselineAction && !baselineAction.enabled && baselineAction.blockedReason && (
              <p className="design-inline-blocker" role="note">{baselineAction.blockedReason}</p>
            )}
          </div>
          {!baselineApproved && baselineAction && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!baselineAction.enabled || state.saveState === 'saving'}
              onClick={() => {
                if (baselineAction.operation === 'createDesignBaseline') store.createDesignBaseline()
                else store.approveDesignBaseline()
              }}
            >
              {baselineAction.label}
            </button>
          )}
        </section>
      )}

      {state.mode === 'sample' ? (
        <details className="design-incremental-preview" aria-label="Gate preview">
          <summary>Compare gate modes</summary>
          <p className="secondary-text">
            A saved preview of {gateModeLabel(state.incrementalPreview.policy.mode)} mode. This never changes the approved baseline or the active gate mode.
          </p>
          <p>
            First module ({state.incrementalPreview.gateForFirstModule.moduleId}):{' '}
            {state.incrementalPreview.gateForFirstModule.result.ok ? 'would pass the Build gate.' : 'would be blocked:'}
          </p>
          {!state.incrementalPreview.gateForFirstModule.result.ok && (
            <ul className="design-error-summary" aria-label="Gate blockers">
              {state.incrementalPreview.gateForFirstModule.result.diagnostics.map((diagnostic, index) => (
                <li key={`${diagnostic.code}.${index}`}>{diagnostic.message}</li>
              ))}
            </ul>
          )}
        </details>
      ) : (
        <></>
      )}

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

      {design && (
        <section className="design-build-behavior" aria-label={`Module behavior for ${design.module.name}`}>
          <div className="design-phase-heading">
            <div>
              <p className="overline">Build · Module behavior</p>
              <h2>Check module behavior</h2>
              <p>Review the internal activity, states, and interactions that refine the allocated application actions before you create the implementation handoff.</p>
            </div>
            <div className="design-behavior-level" role="note">
              <b>Module level</b>
              <span>{design.trace.workflowNodeIds?.length ?? 0} allocated actions → {design.behavior.activities?.length ?? 0} internal activities</span>
            </div>
          </div>
          <ModuleDiagrams
            store={store}
            design={design}
            architecture={state.architecture}
            allDesigns={state.moduleDesigns}
            useCaseAnalysis={state.useCaseAnalysis}
            diagramDiscussions={state.diagramDiscussions}
            diagramImpacts={state.diagramImpacts}
          />
        </section>
      )}

      {design && gate && (
        <div className="design-handoff-panel" aria-label={`Handoff panel for ${design.module.name}`}>
          <h3>{design.module.name}</h3>
          {state.mode === 'sample' ? (
            <>
              <p>
                Build gate: <strong>{gate.ok ? 'Open' : 'Blocked'}</strong>
              </p>
              {progressEntry?.state !== 'approved' && (
                <p className="design-inline-blocker" role="note">
                  Current design work is {progressEntry ? stateLabel(progressEntry.state).toLowerCase() : 'not approved'}. This gate uses the last approved module revision. Review the current work before you approve it.
                </p>
              )}
              {!gate.ok && (
                <ul className="design-error-summary" aria-label="Build blockers">
                  {gate.diagnostics.map((diagnostic, index) => (
                    <li key={`${diagnostic.code}.${index}`}>{diagnostic.message}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="secondary-text" role="note">
              The build gate is evaluated by the service when you create the handoff.
            </p>
          )}

          <button type="button" className="btn btn-primary design-handoff-primary" disabled={state.mode === 'sample' && !gate.ok} onClick={() => store.createModuleHandoff(moduleId)}>
            Create implementation handoff
          </button>

          {handoff && (
            <div className="design-handoff-result" role="status" aria-live="polite">
              <p>{handoff.ok ? `Created ${handoff.kind === 'implementation' ? 'an implementation' : 'a design'} handoff packet.` : `Handoff blocked (${handoff.kind}).`}</p>
              {!handoff.ok && (
                <ul className="design-error-summary" aria-label="Handoff blocked reasons">
                  {handoff.diagnostics.map((diagnostic, index) => (
                    <li key={`${diagnostic.code}.${index}`}>{diagnostic.message}</li>
                  ))}
                </ul>
              )}
              <details className="design-handoff-manifest">
                <summary>Context manifest</summary>
                <ul className="design-context-manifest">
                  {handoff.manifest.entries.map((entry) => (
                    <li key={entry.ref}>
                      [{entry.kind}] {entry.ref} — {entry.inclusionReason} ({entry.bytes} bytes)
                    </li>
                  ))}
                </ul>
                <p>{handoff.manifest.totalBytes} of {handoff.manifest.tokenOrByteLimit} bytes used.</p>
              </details>
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
              {handoff.ok && handoff.kind === 'implementation' && handoff.packet && (
                <div className="design-build-continuation">
                  {props.linkedRun?.designHandoff?.packetId === handoff.packet.packetId ? (
                    <>
                      <p>
                        Delivery run linked · <strong>{props.linkedRun.currentStep === 'complete' ? 'Complete' : 'In progress'}</strong>
                      </p>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!props.onContinueToBuild}
                        onClick={() => props.onContinueToBuild?.({ packet: handoff.packet as ModuleImplementationPacket, moduleName: design.module.name })}
                      >
                        Resume build
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!props.onContinueToBuild || continuing}
                      onClick={() => {
                        if (!props.onContinueToBuild) return
                        setContinuing(true)
                        void Promise.resolve(props.onContinueToBuild({ packet: handoff.packet as ModuleImplementationPacket, moduleName: design.module.name }))
                          .finally(() => setContinuing(false))
                      }}
                    >
                      {continuing ? 'Opening build…' : 'Open build'}
                    </button>
                  )}
                  {!props.onContinueToBuild && (
                    <p className="secondary-text">Select a desktop project to continue this packet into a delivery run.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {canContinue && (
            <details className="design-multi-pass-actions" aria-label="Multi-pass continuation actions">
              <summary>More handoff passes</summary>
              <div>
                {CONTINUATION_ACTIONS.map((action) => (
                  <button key={action.passKind} type="button" className="btn btn-secondary" onClick={() => store.continueModuleHandoff(moduleId, action.passKind)}>
                    {action.label}
                  </button>
                ))}
              </div>
            </details>
          )}

          <div className="design-delta-flow" aria-label="Returned changes">
            <div className="design-delta-heading">
              <div>
                <h4>Review returned changes</h4>
                <p>Import a return manifest associated with this exact packet. Nothing is applied until inspection and explicit approval succeed.</p>
              </div>
              {handoff?.packet && <span title={handoff.packet.packetId}>Packet {handoff.packet.packetId.slice(0, 12)}…</span>}
            </div>

            <div className="design-delta-file">
              <label htmlFor="design-delta-manifest"><b>Choose manifest</b></label>
              <span>JSON from the provider or delivery run</span>
              <input id="design-delta-manifest" type="file" accept="application/json,.json" onChange={(event) => void importDeltaFile(event)} />
            </div>

            {linkedRun && linkedRun.designHandoff?.packetId === handoff?.packet?.packetId && (
              <div className="design-delta-provider-link">
                <b>Delivery run linked</b>
                <span>{linkedRun.taskTitle ?? linkedRun.id}</span>
                <small>{linkedRun.changesZipPath ? 'A provider change archive is attached. Import its returned manifest for review.' : 'Waiting for the provider return manifest.'}</small>
              </div>
            )}

            <details className="design-delta-paste-fallback">
              <summary>Paste JSON instead</summary>
              <form onSubmit={submitPaste}>
                <label htmlFor="design-delta-paste">Returned delta JSON</label>
                <textarea id="design-delta-paste" rows={4} value={pasteText} onChange={(event) => setPasteText(event.target.value)} />
                <button type="submit" className="btn btn-secondary" disabled={!pasteText.trim()}>
                  Import pasted delta
                </button>
              </form>
            </details>
            {state.mode === 'sample' && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  void store.importSampleReturnedDelta(moduleId)
                }}
              >
                Use sample delta
              </button>
            )}
            {deltaFlow?.importError && (
              <p role="alert" className="design-delta-error">
                {deltaFlow.importError}
              </p>
            )}

            {deltaFlow?.delta && (
              <div className="design-delta-imported">
                <div className="design-delta-source">
                  <span>Imported from {deltaFlow.deltaSource === 'sample-demo' ? 'labeled sample provider' : deltaFlow.deltaSource === 'file' ? 'selected file' : deltaFlow.deltaSource === 'provider' ? 'linked provider run' : 'pasted JSON'}</span>
                  <b>{deltaFlow.delta.deltaId}</b>
                  <small>Returned {deltaFlow.delta.returnedAt} · packet {deltaFlow.delta.packetId}</small>
                </div>
                <div className="design-delta-file-diff" aria-label="Returned file changes">
                  {deltaFlow.delta.fileChanges.length === 0 ? (
                    <p className="secondary-text">No file changes were returned.</p>
                  ) : deltaFlow.delta.fileChanges.map((change) => (
                    <article key={`${change.action}-${change.path}`}>
                      <header><span>{change.action}</span><b>{change.path}</b></header>
                      <div>
                        <section><small>Before</small><pre>{change.action === 'create' ? 'File does not exist in the packet baseline.' : 'Resolved from the packet baseline during service inspection.'}</pre></section>
                        <section><small>Returned</small><pre>{change.action === 'delete' ? 'File will be removed.' : change.content?.slice(0, 1200) || `Content hash ${change.contentHash ?? 'not supplied'}`}</pre></section>
                      </div>
                    </article>
                  ))}
                </div>
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
                  Created: {deltaFlow.inspection.fileSummary.created.join(', ') || 'none'}. Changed: {deltaFlow.inspection.fileSummary.changed.join(', ') || 'none'}. Deleted:{' '}
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
                <h5>File ownership</h5>
                <p>
                  Generated: {deltaFlow.inspection.generatedFiles.join(', ') || 'none'}. User-owned: {deltaFlow.inspection.userOwnedFiles.join(', ') || 'none'}
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
                    ? `Applied (${state.mode === 'sample' ? 'simulated in browser mode' : 'by the service'}): ${deltaFlow.applyResult.appliedFiles.join(', ')}.`
                    : `Apply failed and rolled back automatically: ${deltaFlow.applyResult.failure ?? ''}.`}
                </p>
                {state.mode === 'sample' && deltaFlow.applyResult.applied && !deltaFlow.rolledBack && (
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
