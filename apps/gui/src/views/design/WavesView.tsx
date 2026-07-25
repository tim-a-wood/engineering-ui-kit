/**
 * §11.8 Implementation waves — planning information only. Waves show
 * modules, direct dependencies, allowed paths, shared resources, batch
 * eligibility, and blocking contracts/cycles. There is deliberately no
 * dispatch-all action: only a per-module `Create Copilot handoff` (default
 * one module) and the explicit multi-module selection flow.
 */

import { useState } from 'react'
import type { BuildMultiModulePacketResult, ImplementationWavePlan, ModuleDesignProgress } from '@engineering-ui-kit/core/design-browser'

export type WavesViewProps = {
  wavePlan: ImplementationWavePlan
  progress: ModuleDesignProgress
  onCreateHandoff: (moduleId: string) => void
  onCreateMultiModuleHandoff: (moduleIds: string[]) => void
  multiModuleHandoff?: { moduleIds: string[]; result: BuildMultiModulePacketResult }
}

export function WavesView(props: WavesViewProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const nameByModuleId = new Map(props.progress.modules.map((entry) => [entry.moduleId, entry.name]))

  function toggle(moduleId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(moduleId)) next.delete(moduleId)
      else next.add(moduleId)
      return next
    })
  }

  return (
    <section className="design-waves" aria-label="Implementation waves">
      <p className="secondary-text">Waves are planning information only. Nothing dispatches automatically — every handoff is an explicit action below.</p>

      {props.wavePlan.waves.map((wave) => (
        <div key={wave.wave} className="design-wave" aria-label={`Wave ${wave.wave}`}>
          <h3>Wave {wave.wave}</h3>
          {wave.blockingCycles.length > 0 && (
            <div className="design-wave-cycles" role="alert">
              Blocking dependency cycles: {wave.blockingCycles.map((cycle) => cycle.join(' → ')).join('; ')}
            </div>
          )}
          <table className="design-wave-table">
            <thead>
              <tr>
                <th scope="col">Select</th>
                <th scope="col">Module</th>
                <th scope="col">Direct dependencies</th>
                <th scope="col">Allowed paths</th>
                <th scope="col">Shared resources</th>
                <th scope="col">Batch eligible</th>
                <th scope="col">Blocking contracts</th>
                <th scope="col">Handoff</th>
              </tr>
            </thead>
            <tbody>
              {wave.modules.map((entry) => (
                <tr key={entry.moduleId}>
                  <td>
                    <label>
                      <input
                        type="checkbox"
                        checked={selected.has(entry.moduleId)}
                        onChange={() => toggle(entry.moduleId)}
                        aria-label={`Select ${nameByModuleId.get(entry.moduleId) ?? entry.moduleId} for a multi-module handoff`}
                      />
                    </label>
                  </td>
                  <td>{nameByModuleId.get(entry.moduleId) ?? entry.moduleId}</td>
                  <td>{entry.directDependencyIds.length ? entry.directDependencyIds.join(', ') : 'None'}</td>
                  <td>{entry.allowedPaths.join(', ') || 'None recorded'}</td>
                  <td>{entry.sharedResources.length ? entry.sharedResources.join(', ') : 'None'}</td>
                  <td>{entry.batchEligible ? 'Yes' : 'No'}</td>
                  <td>{entry.blockingUnapprovedContracts.length ? entry.blockingUnapprovedContracts.join(', ') : 'None'}</td>
                  <td>
                    <button type="button" className="btn btn-secondary" onClick={() => props.onCreateHandoff(entry.moduleId)}>
                      Create Copilot handoff
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div className="design-waves-multi-select">
        <h3>Multi-module handoff</h3>
        <p className="secondary-text">Select two or more independent modules above, then create one combined handoff (§3.3).</p>
        <button type="button" className="btn btn-primary" disabled={selected.size < 2} onClick={() => props.onCreateMultiModuleHandoff([...selected])}>
          Create multi-module handoff ({selected.size} selected)
        </button>
        {props.multiModuleHandoff && (
          <div className="design-waves-multi-result" role="status" aria-live="polite">
            {props.multiModuleHandoff.result.ok ? (
              <p>Created {props.multiModuleHandoff.result.packets?.length ?? 0} implementation packets.</p>
            ) : (
              <ul className="design-error-summary" aria-label="Multi-module handoff diagnostics">
                {props.multiModuleHandoff.result.diagnostics.map((diagnostic, index) => (
                  <li key={`${diagnostic.code}.${index}`}>{diagnostic.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
