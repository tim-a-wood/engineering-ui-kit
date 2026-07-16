/**
 * Guided Connect — generalized multi-host inbound configuration
 * (CAP-ERA-001 §12.4, CAP-PKT WP6B), consuming the frozen CAP-CONTRACT-028
 * `InboundBinding` discriminated union.
 *
 * Connect opens with one question — "How is this capability triggered?" —
 * offering every host kind (existing/new UI, HTTP, CLI, scheduled/background,
 * embedded library, or decide later). The UI choice is hidden entirely when
 * this application has no UI deployable (§5.1). Every new entry point
 * defaults to `private` exposure; elevating to protected/public is always a
 * deliberate, separate action (ExposureControl). Multiple bindings may target
 * the same operation — none are ever deduplicated or replaced. Deferring
 * ("decide later") never completes Connect; the deployable stays visibly
 * incomplete in Needs attention until a real entry point is approved.
 *
 * The `ui` kind is edited by UiBindingEditor, which still works internally
 * with the familiar FrontendBinding shape (element selection / visible
 * behavior / test-and-approve) so a binding migrated from CAP-CONTRACT-013
 * renders unchanged; BindingEditor.tsx remains the separate Design-mode
 * compat route and is untouched by this rework.
 */

import { useMemo, useState } from 'react'
import type {
  CapabilityModuleRecord,
  CliInboundBinding,
  EmbeddedLibraryInboundBinding,
  HttpInboundBinding,
  Project,
  ScheduleInboundBinding,
  SelectionEvidence,
} from '@engineering-ui-kit/core'
import type { CapabilityDeployableSummary, EuikBridge, InboundBindingReadRecord } from '../../bridge'
import { humanizeIdentifier } from './capabilityPresentation'
import type { CapabilityPreviewHandle } from './CapabilityPreview'
import {
  TRIGGER_OPTIONS,
  createCliBinding,
  createEmbeddedLibraryBinding,
  createHttpBinding,
  createScheduleBinding,
  isExposureElevated,
  triggerLabel,
  type TriggerChoice,
} from './inbound/inboundBinding'
import { UiBindingEditor } from './inbound/UiBindingEditor'
import { HttpBindingEditor } from './inbound/HttpBindingEditor'
import { CliBindingEditor } from './inbound/CliBindingEditor'
import { ScheduleBindingEditor } from './inbound/ScheduleBindingEditor'
import { EmbeddedLibraryBindingEditor } from './inbound/EmbeddedLibraryBindingEditor'
import { DeferredEditor } from './inbound/DeferredEditor'

type Props = {
  bridge: EuikBridge
  projectId: string
  project?: Project
  records: CapabilityModuleRecord[]
  deployables?: CapabilityDeployableSummary[]
  inboundBindingRecords?: InboundBindingReadRecord[]
  selectionEvidence?: SelectionEvidence
  onSelectionEvidence: (e: SelectionEvidence | undefined) => void
  architectureVersion?: string
  architectureHash?: string
  previewRef: React.RefObject<CapabilityPreviewHandle | null>
  onChanged: () => void
  onProjectChanged?: () => Promise<void> | void
}

function isUiDeployableKind(kind: string): boolean {
  return kind === 'browser' || kind === 'electron-main'
}

let draftCounter = 0
function newBindingId(kind: TriggerChoice): string {
  draftCounter += 1
  return `binding.${kind}.${Date.now().toString(36)}${draftCounter}`
}

export function GuidedConnect(props: Props) {
  const { bridge, projectId, records } = props
  const deployables = props.deployables ?? []
  const inboundBindingRecords = props.inboundBindingRecords ?? []
  const [triggerChoice, setTriggerChoice] = useState<TriggerChoice | undefined>(undefined)
  const [draftSeed, setDraftSeed] = useState(0)

  const operations = useMemo(
    () =>
      records
        .flatMap((r) => (r.approved ? r.approved.providedOperations : []))
        .map((op) => ({ operationId: op.operationId, operationVersion: op.contractVersion }))
        .filter((op, i, all) => all.findIndex((o) => o.operationId === op.operationId && o.operationVersion === op.operationVersion) === i)
        .sort((a, b) => a.operationId.localeCompare(b.operationId)),
    [records],
  )

  const uiDeployable = deployables.find((d) => isUiDeployableKind(d.kind))
  const headlessDeployable = deployables.find((d) => !isUiDeployableKind(d.kind)) ?? deployables[0]
  const hasUiDeployable = Boolean(uiDeployable)

  const visibleTriggerOptions = TRIGGER_OPTIONS.filter((o) => o.id !== 'ui' || hasUiDeployable)

  function finishEditing() {
    setTriggerChoice(undefined)
    setDraftSeed((n) => n + 1)
    props.onChanged()
  }

  function pickTrigger(choice: TriggerChoice) {
    setTriggerChoice(choice)
  }

  const editorDeployableId =
    (triggerChoice === 'ui' ? uiDeployable?.deployableId : headlessDeployable?.deployableId) ?? 'deployable.main'

  const editor = useMemo(() => {
    if (!triggerChoice) return null
    if (triggerChoice === 'deferred') {
      return <DeferredEditor bridge={bridge} projectId={projectId} onDeferred={finishEditing} />
    }
    if (triggerChoice === 'ui') {
      return (
        <UiBindingEditor
          bridge={bridge}
          projectId={projectId}
          project={props.project}
          deployableId={editorDeployableId}
          transport={uiDeployable?.kind === 'electron-main' ? 'electron-ipc' : 'browser-local'}
          operations={operations}
          selectionEvidence={props.selectionEvidence}
          onSelectionEvidence={props.onSelectionEvidence}
          architectureVersion={props.architectureVersion}
          architectureHash={props.architectureHash}
          previewRef={props.previewRef}
          onSaved={finishEditing}
          onProjectChanged={props.onProjectChanged}
        />
      )
    }
    const base = {
      bindingId: newBindingId(triggerChoice),
      version: '1.0.0',
      projectId,
      deployableId: editorDeployableId,
      operationId: '',
      operationVersion: '',
    }
    if (triggerChoice === 'http') {
      return (
        <HttpBindingEditor
          bridge={bridge}
          projectId={projectId}
          operations={operations}
          initial={createHttpBinding(base) as HttpInboundBinding}
          onSaved={finishEditing}
        />
      )
    }
    if (triggerChoice === 'cli') {
      return (
        <CliBindingEditor
          bridge={bridge}
          projectId={projectId}
          operations={operations}
          initial={createCliBinding(base) as CliInboundBinding}
          onSaved={finishEditing}
        />
      )
    }
    if (triggerChoice === 'schedule') {
      return (
        <ScheduleBindingEditor
          bridge={bridge}
          projectId={projectId}
          operations={operations}
          initial={createScheduleBinding(base) as ScheduleInboundBinding}
          onSaved={finishEditing}
        />
      )
    }
    return (
      <EmbeddedLibraryBindingEditor
        bridge={bridge}
        projectId={projectId}
        operations={operations}
        initial={createEmbeddedLibraryBinding(base) as EmbeddedLibraryInboundBinding}
        onSaved={finishEditing}
      />
    )
    // draftSeed forces a fresh draft (new bindingId) each time the user re-enters a kind after saving.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerChoice, editorDeployableId, operations.length, draftSeed])

  return (
    <section className="cap-connect" aria-label="Connect capabilities to a trigger">
      <p className="cap-connect-purpose">
        Every capability needs an entry point before it can run for real. Connect is complete once every required
        deployable has at least one approved entry point — a UI element, an HTTP route, a CLI command, a schedule,
        or an explicit embedded-library reason.
      </p>

      {inboundBindingRecords.length > 0 && (
        <section aria-label="Configured entry points">
          <h3>Configured entry points</h3>
          <ul className="cap-entry-points">
            {inboundBindingRecords.map((record) => {
              const rec = record.approved ?? record.draft
              if (!rec) return null
              return (
                <li key={record.bindingId} className="cap-entry-point">
                  <span className="cap-entry-point-kind">{triggerLabel(rec.kind)}</span>
                  <span>{humanizeIdentifier(rec.operationId) || 'No capability chosen yet'}</span>
                  <span className={record.approved ? 'status status-ok' : 'status'} role="status">
                    <span className="status-dot" aria-hidden="true" /> {record.approved ? 'Approved' : 'Draft'}
                  </span>
                  <span className={isExposureElevated(rec.exposure) ? 'badge badge-warning' : 'badge'}>
                    {rec.exposure ?? 'private'}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {!triggerChoice && (
        <section aria-label="How is this capability triggered?">
          <h3>{inboundBindingRecords.length > 0 ? 'Add another entry point' : 'How is this capability triggered?'}</h3>
          <div className="cap-connect-dispositions" role="group" aria-label="Trigger choice">
            {visibleTriggerOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className="cap-connect-disposition"
                onClick={() => pickTrigger(option.id)}
              >
                <span className="cap-connect-disposition-icon" aria-hidden="true">•</span>
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {triggerChoice && triggerChoice !== 'deferred' && (
        <div className="hstack" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost btn-compact" onClick={() => setTriggerChoice(undefined)}>
            Cancel
          </button>
        </div>
      )}

      {editor}
    </section>
  )
}
