/**
 * Implementation-wave overview. This is planning context, not a second
 * handoff surface: one focused module is handed off in BuildHandoffView.
 */

import { useState } from 'react'
import type { BuildMultiModulePacketResult, ImplementationWavePlan, ModuleDesignProgress } from '@engineering-ui-kit/core/design-browser'
import type { DesignWorkspaceMode, MultiModuleConfirmations } from './designState'

export type WavesViewProps = {
  wavePlan: ImplementationWavePlan
  progress: ModuleDesignProgress
  onCreateHandoff: (moduleId: string) => void
  onCreateMultiModuleHandoff: (moduleIds: string[], confirmations: MultiModuleConfirmations) => void
  multiModuleHandoff?: { moduleIds: string[]; result: BuildMultiModulePacketResult }
  mode?: DesignWorkspaceMode
  currentDesignComplete?: boolean
}

export function WavesView(props: WavesViewProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [userConfirmedIndependence, setUserConfirmedIndependence] = useState(false)
  const [receivingAgentSupportsCombinedTask, setReceivingAgentSupportsCombinedTask] = useState(false)
  const [fixtureIsolationConfirmedByModuleId, setFixtureIsolationConfirmedByModuleId] = useState<Record<string, boolean>>({})
  const nameByModuleId = new Map(props.progress.modules.map((entry) => [entry.moduleId, entry.name]))

  function toggle(moduleId: string) {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(moduleId)) next.delete(moduleId)
      else next.add(moduleId)
      return next
    })
  }

  return (
    <section className="design-waves" aria-label="Implementation plan">
      <div className="design-waves-heading">
        <div>
          <p className="overline">Build · Implementation plan</p>
          <h2>Build one approved module at a time</h2>
          <p>Dependency waves explain safe order. Choose the module in the focused handoff workspace below; no work is dispatched from this plan.</p>
        </div>
        <span>{props.wavePlan.waves.length} wave{props.wavePlan.waves.length === 1 ? '' : 's'} · {props.progress.total} modules</span>
      </div>
      {props.currentDesignComplete === false && (
        <p className="design-result-currency-warning" role="note">
          These waves describe the last approved Design baseline. {props.progress.total - props.progress.approved} current module design{props.progress.total - props.progress.approved === 1 ? '' : 's'} still require approval and are not included.
        </p>
      )}

      <div className="design-wave-cards">
        {props.wavePlan.waves.map((wave, index) => (
          <details key={wave.wave} className="design-wave" open={index === 0}>
            <summary>
              <span>Wave {wave.wave}</span>
              <b>{wave.modules.length} module{wave.modules.length === 1 ? '' : 's'}</b>
              <small>{wave.blockingCycles.length
                ? `${wave.blockingCycles.length} blocking cycle${wave.blockingCycles.length === 1 ? '' : 's'}`
                : props.currentDesignComplete === false ? 'Approved baseline order' : 'Ready in dependency order'}</small>
            </summary>
            {wave.blockingCycles.length > 0 && (
              <div className="design-wave-cycles" role="alert">
                <b>Resolve dependency cycles before building this wave.</b>
                <p>{wave.blockingCycles.map((cycle) => cycle.map((id) => nameByModuleId.get(id) ?? id).join(' → ')).join('; ')}</p>
              </div>
            )}
            <ul className="design-wave-modules">
              {wave.modules.map((entry) => (
                <li key={entry.moduleId}>
                  <div>
                    <b>{nameByModuleId.get(entry.moduleId) ?? entry.moduleId}</b>
                    <small>{entry.directDependencyIds.length
                      ? `Needs ${entry.directDependencyIds.map((id) => nameByModuleId.get(id) ?? id).join(', ')}`
                      : 'No direct module dependency'}</small>
                  </div>
                  <span className={entry.blockingUnapprovedContracts.length ? 'blocked' : 'ready'}>
                    {entry.blockingUnapprovedContracts.length
                      ? `${entry.blockingUnapprovedContracts.length} contract blocker${entry.blockingUnapprovedContracts.length === 1 ? '' : 's'}`
                      : props.currentDesignComplete === false ? 'Baseline ready' : 'Ready'}
                  </span>
                  <details>
                    <summary>Scope</summary>
                    <dl className="design-definition-grid">
                      <dt>Owned paths</dt><dd>{entry.allowedPaths.join(', ') || 'None recorded'}</dd>
                      <dt>Shared resources</dt><dd>{entry.sharedResources.join(', ') || 'None'}</dd>
                      <dt>Batch safe</dt><dd>{entry.batchEligible ? 'Yes' : 'No'}</dd>
                    </dl>
                  </details>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>

      {props.mode !== 'project' && (
        <details className="design-waves-multi-select">
          <summary>Advanced sample: combine independent modules</summary>
          <p className="secondary-text">This sample-only path demonstrates the extra confirmations required for a combined packet. Live projects do not advertise this unsupported path.</p>
          <div className="design-waves-module-checks">
            {props.wavePlan.waves.flatMap((wave) => wave.modules).map((entry) => (
              <label key={entry.moduleId}>
                <input type="checkbox" checked={selected.has(entry.moduleId)} onChange={() => toggle(entry.moduleId)} aria-label={`Select ${nameByModuleId.get(entry.moduleId) ?? entry.moduleId} for a multi-module handoff`} />
                {nameByModuleId.get(entry.moduleId) ?? entry.moduleId}
              </label>
            ))}
          </div>
          <label className="design-waves-confirm">
            <input type="checkbox" checked={userConfirmedIndependence} onChange={(event) => setUserConfirmedIndependence(event.target.checked)} />
            I confirm these modules are independent
          </label>
          <label className="design-waves-confirm">
            <input type="checkbox" checked={receivingAgentSupportsCombinedTask} onChange={(event) => setReceivingAgentSupportsCombinedTask(event.target.checked)} />
            The receiving agent supports this combined task
          </label>
          {selected.size > 0 && (
            <fieldset className="design-waves-fixture-confirm">
              <legend>Fixture isolation</legend>
              {[...selected].map((moduleId) => (
                <label key={moduleId}>
                  <input
                    type="checkbox"
                    checked={fixtureIsolationConfirmedByModuleId[moduleId] ?? false}
                    onChange={() => setFixtureIsolationConfirmedByModuleId((current) => ({ ...current, [moduleId]: !current[moduleId] }))}
                    aria-label={`Fixtures and external resources are isolated: ${nameByModuleId.get(moduleId) ?? moduleId}`}
                  />
                  Fixtures and external resources are isolated ({nameByModuleId.get(moduleId) ?? moduleId})
                </label>
              ))}
            </fieldset>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            disabled={selected.size < 2}
            onClick={() => props.onCreateMultiModuleHandoff([...selected], {
              userConfirmedIndependence,
              receivingAgentSupportsCombinedTask,
              fixtureIsolationConfirmedByModuleId,
            })}
          >
            Create multi-module handoff ({selected.size} selected)
          </button>
          {props.multiModuleHandoff && (
            <div className="design-waves-multi-result" role="status" aria-live="polite">
              {props.multiModuleHandoff.result.ok ? (
                <p>Created {props.multiModuleHandoff.result.packets?.length ?? 0} implementation packets.</p>
              ) : (
                <ul className="design-error-summary" aria-label="Multi-module handoff diagnostics">
                  {props.multiModuleHandoff.result.diagnostics.map((diagnostic, index) => <li key={`${diagnostic.code}.${index}`}>{diagnostic.message}</li>)}
                </ul>
              )}
            </div>
          )}
        </details>
      )}
    </section>
  )
}
