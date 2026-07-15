/**
 * Guided Build — two-region workspace.
 *   Left:  allocated modules with per-module state, "x of y approved" progress,
 *          and first-incomplete default selection.
 *   Right: the selected module and ONLY its next relevant lifecycle action
 *          (delegated to ModulesView in controlled + progressive mode).
 */

import { useEffect, useMemo, useState } from 'react'
import type { ArchitectureSpecification, CapabilityModuleRecord } from '@engineering-ui-kit/core'
import type { EuikBridge, TaskPacketFields } from '../../bridge'
import { Icon } from '../../icons'
import { ModulesView } from './ModulesView'
import { humanizeIdentifier, moduleTypeLabel } from './capabilityPresentation'

type Props = {
  bridge: EuikBridge
  projectId: string
  archSpec: ArchitectureSpecification | undefined
  records: CapabilityModuleRecord[]
  onChanged: () => void
  onStartUiBuild?: (projectId: string, fields: TaskPacketFields) => Promise<void>
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

  function stateOf(id: string): { label: string; glyph: React.ReactNode; cls: string } {
    if (readyIds.has(id)) return { label: 'Ready', glyph: Icon.shieldCheck(14), cls: 'ready' }
    if (approvedIds.has(id)) return { label: 'Approved', glyph: Icon.check(14), cls: 'approved' }
    return { label: 'Not started', glyph: Icon.clock(12), cls: 'pending' }
  }

  return (
    <div className="cap-build">
      <aside className="cap-build-list" role="navigation" aria-label="Allocated modules">
        <div className="cap-build-progress">
          <strong>{approvedCount} of {moduleIds.length}</strong> approved
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
                  <span className="cap-build-module-state">{typeLabel ? `${typeLabel} · ` : ''}{s.label}</span>
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
          />
        ) : (
          <p role="status" className="capabilities-note">Select a module to work on.</p>
        )}
      </div>
    </div>
  )
}
