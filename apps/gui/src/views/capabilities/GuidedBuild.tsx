/**
 * Guided Build — module picker above a focused two-column workspace.
 * The selected module/action stays on the left and its interview outcome stays
 * visible on the right. This avoids spending the full page height on a narrow
 * module rail while retaining the first-incomplete default selection.
 */

import { useEffect, useMemo, useState } from 'react'
import type { ArchitectureSpecification, CapabilityIntegrationState, CapabilityModuleRecord, FoundationPlan } from '@engineering-ui-kit/core'
import type { EuikBridge, TaskPacketFields } from '../../bridge'
import { Icon } from '../../icons'
import { ModulesView } from './ModulesView'
import { humanizeIdentifier, moduleTypeLabel } from './capabilityPresentation'
import { IntegrationWorkspace } from './IntegrationWorkspace'

type Props = {
  bridge: EuikBridge
  projectId: string
  archSpec: ArchitectureSpecification | undefined
  records: CapabilityModuleRecord[]
  onChanged: () => void
  onStartUiBuild?: (projectId: string, fields: TaskPacketFields) => Promise<void>
  /** WP5A bullet (d)/(e) — the project's approved foundation plan and the build-handoff gate derived from it. */
  approvedFoundation?: FoundationPlan
  foundationGate?: { enabled: boolean; reason?: string }
  integrationState: CapabilityIntegrationState
}

export function GuidedBuild(props: Props) {
  const moduleIds = props.archSpec?.moduleIds ?? []
  const moduleDefinitions = useMemo(
    () => new Map((props.archSpec?.moduleDefinitions ?? []).map((definition) => [definition.moduleId, definition])),
    [props.archSpec?.moduleDefinitions],
  )
  const approvedIds = useMemo(
    () => new Set(props.records.filter((r) => r.approved).map((r) => r.moduleId)),
    [props.records],
  )
  const readyIds = useMemo(
    () => new Set(props.records.filter((r) => r.freshness?.primaryState === 'ready').map((r) => r.moduleId)),
    [props.records],
  )
  const firstIncomplete = moduleIds.find((id) => !approvedIds.has(id)) ?? moduleIds[0] ?? ''
  const [selected, setSelected] = useState(firstIncomplete)

  // Follow the first-incomplete module when the set of approved modules changes and
  // the current selection has just been completed.
  useEffect(() => {
    if (!selected || (approvedIds.has(selected) && firstIncomplete && firstIncomplete !== selected)) {
      setSelected(firstIncomplete)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstIncomplete])

  const approvedCount = moduleIds.filter((id) => approvedIds.has(id)).length
  const completion = moduleIds.length ? Math.round((approvedCount / moduleIds.length) * 100) : 0

  function stateOf(id: string): { label: string; glyph: React.ReactNode; cls: string } {
    if (readyIds.has(id)) return { label: 'Ready', glyph: Icon.shieldCheck(14), cls: 'ready' }
    if (approvedIds.has(id)) return { label: 'Approved', glyph: Icon.check(14), cls: 'approved' }
    return { label: 'Not started', glyph: Icon.clock(12), cls: 'pending' }
  }

  return (
    <div className="cap-build-stack">
      <IntegrationWorkspace bridge={props.bridge} projectId={props.projectId} state={props.integrationState} projection="guided" onChanged={props.onChanged} />
      <div className="cap-build">
      <aside className="cap-build-list" role="navigation" aria-label="Allocated modules">
        <div className="cap-build-list-head">
          <div>
            <p className="capabilities-eyebrow">Build modules</p>
            <h3>Choose a module</h3>
          </div>
          <div className="cap-build-progress">
            <span><strong>{approvedCount} of {moduleIds.length}</strong> approved</span>
            <span
              className="cap-build-progress-track"
              role="progressbar"
              aria-label="Approved modules"
              aria-valuemin={0}
              aria-valuemax={moduleIds.length}
              aria-valuenow={approvedCount}
            >
              <span style={{ width: `${completion}%` }} />
            </span>
          </div>
        </div>
        <ul>
          {moduleIds.length === 0 ? <li className="capabilities-note">The architecture allocates no modules.</li> : null}
          {moduleIds.map((id) => {
            const s = stateOf(id)
            const definition = moduleDefinitions.get(id)
            const displayName = definition?.name || humanizeIdentifier(id)
            const typeLabel = definition ? moduleTypeLabel(definition.moduleType) : undefined
            return (
              <li key={id}>
                <button
                  type="button"
                  className={`cap-build-module ${s.cls}${selected === id ? ' active' : ''}`}
                  aria-current={selected === id ? 'true' : undefined}
                  aria-label={`${displayName}${typeLabel ? `, ${typeLabel}` : ''}, ${s.label}`}
                  onClick={() => setSelected(id)}
                >
                  <span className="cap-build-module-glyph" aria-hidden="true">{s.glyph}</span>
                  <span className="cap-build-module-name">{displayName}</span>
                  <span className="cap-build-module-state">{typeLabel ?? 'Module'}</span>
                  <span className={`cap-build-module-status ${s.cls}`}>{s.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      <div className="cap-build-work">
        {selected ? (
          <ModulesView
            bridge={props.bridge}
            projectId={props.projectId}
            architectureApproved
            projection="guided"
            records={props.records}
            onChanged={async () => props.onChanged()}
            hideModuleList
            progressive
            externalSelectedModuleId={selected}
            onSelectModule={setSelected}
            onStartUiBuild={props.onStartUiBuild}
            approvedFoundation={props.approvedFoundation}
            foundationGate={props.foundationGate}
          />
        ) : (
          <p role="status" className="capabilities-note">Select a module to work on.</p>
        )}
      </div>
      </div>
    </div>
  )
}
