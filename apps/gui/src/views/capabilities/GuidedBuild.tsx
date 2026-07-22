/**
 * Guided Build — module picker above a focused two-column workspace.
 * The selected module/action stays on the left and its interview outcome stays
 * visible on the right. This avoids spending the full page height on a narrow
 * module rail while retaining the first-incomplete default selection.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ArchitectureSpecification, CapabilityIntegrationState, CapabilityModuleRecord, FoundationPlan, Project, SelectionEvidence } from '@engineering-ui-kit/core'
import type { CapabilityDeployableSummary, EuikBridge, InboundBindingReadRecord, TaskPacketFields } from '../../bridge'
import { Icon } from '../../icons'
import { ModulesView } from './ModulesView'
import { humanizeIdentifier, moduleTypeLabel } from './capabilityPresentation'
import { IntegrationWorkspace } from './IntegrationWorkspace'
import { GuidedConnect } from './GuidedConnect'
import type { CapabilityPreviewHandle } from './CapabilityPreview'

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
  integrationState?: CapabilityIntegrationState
  project?: Project
  deployables?: CapabilityDeployableSummary[]
  inboundBindingRecords?: InboundBindingReadRecord[]
  selectionEvidence?: SelectionEvidence
  onSelectionEvidence?: (e: SelectionEvidence | undefined) => void
  architectureVersion?: string
  architectureHash?: string
  previewRef?: React.RefObject<CapabilityPreviewHandle | null>
  onProjectChanged?: () => Promise<void> | void
  entryPointsReady?: boolean
}

export function GuidedBuild(props: Props) {
  const fallbackPreviewRef = useRef<CapabilityPreviewHandle | null>(null)
  const previewRef = props.previewRef ?? fallbackPreviewRef
  const entryPointsReady = props.entryPointsReady ?? true
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
  const modulesReady = moduleIds.length > 0 && approvedCount === moduleIds.length
  const setupParts = props.integrationState?.deployables ?? []
  const setupApplied = setupParts.length > 0 && setupParts.every((part) => Boolean(
    part.currentPlan
    && part.status === 'applied'
    && part.latestApply?.status === 'applied'
    && part.latestApply.planId === part.currentPlan.planId
    && part.latestApply.planHash === part.currentPlan.planHash,
  ))
  const setupChecked = setupParts.length > 0 && setupParts.every((part) => Boolean(
    part.currentPlan
    && part.latestCommandRun?.status === 'passed'
    && part.latestCommandRun.planId === part.currentPlan.planId
    && part.latestCommandRun.planHash === part.currentPlan.planHash,
  ))
  const buildReady = modulesReady && entryPointsReady && setupApplied && setupChecked
  const buildPhases = [
    {
      id: 'cap-build-modules',
      label: 'Modules',
      detail: modulesReady ? `${approvedCount} approved` : `${approvedCount} of ${moduleIds.length} approved`,
      ready: modulesReady,
      current: !modulesReady,
      blocked: false,
    },
    {
      id: 'cap-build-entry-points',
      label: 'Entry points',
      detail: entryPointsReady ? 'Configured' : modulesReady ? 'Needs attention' : 'After modules',
      ready: entryPointsReady,
      current: modulesReady && !entryPointsReady,
      blocked: !modulesReady,
    },
    {
      id: 'cap-build-shared-setup',
      label: 'Shared setup',
      detail: setupApplied && setupChecked ? 'Prepared and checked' : entryPointsReady ? 'Needs attention' : 'After entry points',
      ready: setupApplied && setupChecked,
      current: modulesReady && entryPointsReady && (!setupApplied || !setupChecked),
      blocked: !modulesReady || !entryPointsReady,
    },
    {
      id: 'cap-build-readiness',
      label: 'Ready to verify',
      detail: buildReady ? 'All checks complete' : 'Final review',
      ready: buildReady,
      current: modulesReady && entryPointsReady && setupApplied && setupChecked && !buildReady,
      blocked: !modulesReady || !entryPointsReady || !setupApplied || !setupChecked,
    },
  ]

  function stateOf(id: string): { label: string; glyph: React.ReactNode; cls: string } {
    if (readyIds.has(id)) return { label: 'Ready', glyph: Icon.shieldCheck(14), cls: 'ready' }
    if (approvedIds.has(id)) return { label: 'Approved', glyph: Icon.check(14), cls: 'approved' }
    return { label: 'Not started', glyph: Icon.clock(12), cls: 'pending' }
  }

  return (
    <div className="cap-build-stack">
      <nav className="cap-build-sequence" aria-label="Build steps">
        <ol>
          {buildPhases.map((phase, index) => (
            <li key={phase.id} className={`${phase.ready ? 'ready' : phase.current ? 'current' : phase.blocked ? 'blocked' : 'available'}`}>
              <button
                type="button"
                aria-current={phase.current ? 'step' : undefined}
                disabled={phase.blocked}
                onClick={() => document.getElementById(phase.id)?.scrollIntoView({
                  behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                  block: 'start',
                })}
              >
                <span className="cap-build-sequence-marker" aria-hidden="true">{phase.ready ? Icon.check(13) : index + 1}</span>
                <span><strong>{phase.label}</strong><small>{phase.detail}</small></span>
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <section id="cap-build-modules" className="cap-build-phase" aria-label="Build modules">
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
      </section>
      <section id="cap-build-entry-points" className="cap-build-phase" aria-label="Configure entry points">
        <GuidedConnect
          key={props.projectId}
          bridge={props.bridge}
          projectId={props.projectId}
          project={props.project}
          records={props.records}
          deployables={props.deployables}
          inboundBindingRecords={props.inboundBindingRecords}
          selectionEvidence={props.selectionEvidence}
          onSelectionEvidence={props.onSelectionEvidence ?? (() => {})}
          architectureVersion={props.architectureVersion}
          architectureHash={props.architectureHash}
          previewRef={previewRef}
          onChanged={props.onChanged}
          onProjectChanged={props.onProjectChanged}
          modulesReady={modulesReady}
        />
      </section>
      <section id="cap-build-shared-setup" className="cap-build-phase" aria-label="Prepare shared application setup">
        <IntegrationWorkspace
          bridge={props.bridge}
          projectId={props.projectId}
          state={props.integrationState}
          projection="guided"
          entryPointsReady={entryPointsReady}
          modulesReady={modulesReady}
          onChanged={props.onChanged}
        />
      </section>
      <section id="cap-build-readiness" className={`panel-raised cap-build-readiness cap-build-phase ${buildReady ? 'ready' : 'pending'}`} aria-label="Build readiness">
        <div className="cap-stage-head">
          <div>
            <p className="capabilities-eyebrow">Build step 4</p>
            <h3>Confirm Build readiness</h3>
            <p className="lede">Review the four conditions that must be current before the application can move to Verify.</p>
          </div>
          <span className={`badge ${buildReady ? 'approved' : 'attention'}`}>{buildReady ? 'Ready for Verify' : 'Not ready yet'}</span>
        </div>
        <ul className="cap-build-readiness-list">
          <ReadinessItem ready={modulesReady} label="Modules approved" detail={`${approvedCount} of ${moduleIds.length} approved`} />
          <ReadinessItem ready={entryPointsReady} label="Entry points ready" detail={entryPointsReady ? 'Every required application part can be started.' : 'Configure the required entry points above.'} />
          <ReadinessItem ready={setupApplied} label="Shared setup applied" detail={setupApplied ? 'The project contains the current generated setup.' : 'Prepare and apply the shared setup above.'} />
          <ReadinessItem ready={setupChecked} label="Setup checks passed" detail={setupChecked ? 'The current setup passed its build checks.' : 'Run the setup checks after applying it.'} />
        </ul>
      </section>
    </div>
  )
}

function ReadinessItem({ ready, label, detail }: { ready: boolean; label: string; detail: string }) {
  return (
    <li className={ready ? 'ready' : 'pending'}>
      <span className="cap-build-readiness-icon" aria-hidden="true">{ready ? Icon.check(14) : Icon.clock(14)}</span>
      <span><strong>{label}</strong><small>{detail}</small></span>
    </li>
  )
}
