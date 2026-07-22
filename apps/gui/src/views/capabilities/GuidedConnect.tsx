/** Build subsection for configuring how application capabilities are started. */

import { useMemo, useState } from 'react'
import type {
  CapabilityModuleRecord,
  CliInboundBinding,
  EmbeddedLibraryInboundBinding,
  HttpInboundBinding,
  InboundBinding,
  Project,
  ScheduleInboundBinding,
  SelectionEvidence,
  UiInboundBinding,
} from '@engineering-ui-kit/core'
import type { CapabilityDeployableSummary, EuikBridge, InboundBindingReadRecord } from '../../bridge'
import { Dialog } from '../../components'
import { humanizeIdentifier, sanitizeGuidedMessage } from './capabilityPresentation'
import type { CapabilityPreviewHandle } from './CapabilityPreview'
import {
  TRIGGER_OPTIONS,
  createCliBinding,
  createEmbeddedLibraryBinding,
  createHttpBinding,
  createScheduleBinding,
  isExposureElevated,
  triggerLabel,
  validateInboundBindingDraft,
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
  /** Entry-point work follows module approval. Existing records remain editable while modules are revisited. */
  modulesReady?: boolean
}

type EditorState = {
  choice: TriggerChoice
  deployableId: string
  bindingId: string
  initial?: InboundBinding
}

let draftCounter = 0

function newBindingId(kind: TriggerChoice): string {
  draftCounter += 1
  return `binding.${kind}.${Date.now().toString(36)}${draftCounter}`
}

function nextPatchVersion(version: string): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (!match) return `${version}.1`
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`
}

function isUiDeployableKind(kind: string): boolean {
  return kind === 'browser' || kind === 'electron-main'
}

function recommendedTrigger(kind: string): Exclude<TriggerChoice, 'deferred'> | undefined {
  switch (kind) {
    case 'browser':
    case 'electron-main': return 'ui'
    case 'http-api': return 'http'
    case 'cli': return 'cli'
    case 'worker': return 'schedule'
    case 'embedded-library': return undefined
    default: return 'embedded-library'
  }
}

function hostDescription(deployable: CapabilityDeployableSummary): string {
  switch (deployable.kind) {
    case 'browser': return 'The application screen people use.'
    case 'electron-main': return 'The installed desktop application.'
    case 'http-api': return 'The application service other systems call.'
    case 'cli': return 'The command-line application.'
    case 'worker': return 'The background process that runs scheduled work.'
    case 'embedded-library': return 'Built-in logic called directly by other application code.'
    default: return 'An application part that can start a capability.'
  }
}

function activeBinding(record: InboundBindingReadRecord): InboundBinding | undefined {
  return record.approved ?? record.draft
}

function technicalStartDefinition(binding: InboundBinding): string {
  switch (binding.kind) {
    case 'http': return `${binding.method} ${binding.path}`
    case 'cli': return binding.command
    case 'schedule': return `${binding.cronExpression} (${binding.timezone})`
    case 'embedded-library': return binding.exportedCallable
    case 'ui': return `${binding.transport}; ${binding.selectionEvidence?.selector ?? 'selector not recorded'}`
  }
}

function editableBinding(record: InboundBindingReadRecord): InboundBinding | undefined {
  const binding = activeBinding(record)
  if (!binding) return undefined
  return record.approved
    ? { ...binding, version: nextPatchVersion(binding.version), approvalState: 'draft' }
    : binding
}

export function GuidedConnect(props: Props) {
  const { bridge, projectId, records } = props
  const deployables = props.deployables ?? []
  const inboundBindingRecords = props.inboundBindingRecords ?? []
  const modulesReady = props.modulesReady ?? true
  const [editorState, setEditorState] = useState<EditorState | undefined>()
  const [technicalOpen, setTechnicalOpen] = useState(false)
  const [removingId, setRemovingId] = useState('')
  const [busyId, setBusyId] = useState('')
  const [actionMessage, setActionMessage] = useState('')

  const operations = useMemo(
    () => records
      .flatMap((record) => record.approved?.providedOperations ?? [])
      .map((operation) => ({ operationId: operation.operationId, operationVersion: operation.contractVersion }))
      .filter((operation, index, all) => all.findIndex((candidate) =>
        candidate.operationId === operation.operationId && candidate.operationVersion === operation.operationVersion) === index)
      .sort((a, b) => a.operationId.localeCompare(b.operationId)),
    [records],
  )

  const bindingSummaryByDeployable = useMemo(() => {
    const counts = new Map<string, { total: number; approved: number }>()
    for (const record of inboundBindingRecords) {
      const binding = activeBinding(record)
      if (binding) {
        const current = counts.get(binding.deployableId) ?? { total: 0, approved: 0 }
        counts.set(binding.deployableId, {
          total: current.total + 1,
          approved: current.approved + (record.approved ? 1 : 0),
        })
      }
    }
    return counts
  }, [inboundBindingRecords])

  const hasUiDeployable = deployables.some((deployable) => isUiDeployableKind(deployable.kind))
  const visibleTriggerOptions = TRIGGER_OPTIONS.filter((option) => option.id !== 'ui' || hasUiDeployable)
  const requiredDeployables = deployables.filter((deployable) => deployable.kind !== 'embedded-library')
  const configuredRequiredCount = requiredDeployables.filter((deployable) => (bindingSummaryByDeployable.get(deployable.deployableId)?.approved ?? 0) > 0).length

  function targetFor(choice: TriggerChoice): CapabilityDeployableSummary | undefined {
    if (choice === 'ui') return deployables.find((deployable) => isUiDeployableKind(deployable.kind))
    const matchingKind = choice === 'http' ? 'http-api' : choice === 'schedule' ? 'worker' : choice
    return deployables.find((deployable) => deployable.kind === matchingKind)
      ?? deployables.find((deployable) => !isUiDeployableKind(deployable.kind))
      ?? deployables[0]
  }

  function openNew(choice: TriggerChoice, deployableId?: string) {
    const target = deployableId ? deployables.find((deployable) => deployable.deployableId === deployableId) : targetFor(choice)
    setActionMessage('')
    setEditorState({ choice, deployableId: target?.deployableId ?? 'deployable.main', bindingId: newBindingId(choice) })
  }

  function finishEditing() {
    setEditorState(undefined)
    setRemovingId('')
    props.onChanged()
  }

  async function removeBinding(bindingId: string) {
    setBusyId(bindingId)
    setActionMessage('')
    try {
      await bridge.capabilitiesArchiveInboundBinding(projectId, bindingId)
      setRemovingId('')
      setActionMessage('Entry point removed. Refresh the shared setup after the remaining entry points are ready.')
      props.onChanged()
    } catch (error) {
      setActionMessage(sanitizeGuidedMessage(error instanceof Error ? error.message : String(error)))
    } finally {
      setBusyId('')
    }
  }

  function renderEditor() {
    if (!editorState) return null
    if (editorState.choice === 'deferred') {
      return <DeferredEditor bridge={bridge} projectId={projectId} onDeferred={finishEditing} />
    }
    const initial = editorState.initial
    const base = {
      bindingId: initial?.bindingId ?? editorState.bindingId,
      version: initial?.version ?? '1.0.0',
      projectId,
      deployableId: editorState.deployableId,
      operationId: initial?.operationId ?? (operations.length === 1 ? operations[0]!.operationId : ''),
      operationVersion: initial?.operationVersion ?? (operations.length === 1 ? operations[0]!.operationVersion : ''),
    }
    if (editorState.choice === 'ui') {
      const uiDeployable = deployables.find((deployable) => deployable.deployableId === editorState.deployableId)
      return (
        <UiBindingEditor
          bridge={bridge}
          projectId={projectId}
          project={props.project}
          deployableId={editorState.deployableId}
          transport={uiDeployable?.kind === 'electron-main' ? 'electron-ipc' : 'browser-local'}
          operations={operations}
          selectionEvidence={props.selectionEvidence}
          onSelectionEvidence={props.onSelectionEvidence}
          architectureVersion={props.architectureVersion}
          architectureHash={props.architectureHash}
          initial={initial as UiInboundBinding | undefined}
          suggestedOperation={operations.length === 1 ? operations[0] : undefined}
          previewRef={props.previewRef}
          onSaved={finishEditing}
          onProjectChanged={props.onProjectChanged}
        />
      )
    }
    if (editorState.choice === 'http') {
      return <HttpBindingEditor bridge={bridge} projectId={projectId} operations={operations} initial={(initial ?? createHttpBinding(base)) as HttpInboundBinding} onSaved={finishEditing} />
    }
    if (editorState.choice === 'cli') {
      return <CliBindingEditor bridge={bridge} projectId={projectId} operations={operations} initial={(initial ?? createCliBinding(base)) as CliInboundBinding} onSaved={finishEditing} />
    }
    if (editorState.choice === 'schedule') {
      return <ScheduleBindingEditor bridge={bridge} projectId={projectId} operations={operations} initial={(initial ?? createScheduleBinding(base)) as ScheduleInboundBinding} onSaved={finishEditing} />
    }
    return <EmbeddedLibraryBindingEditor bridge={bridge} projectId={projectId} operations={operations} initial={(initial ?? createEmbeddedLibraryBinding(base)) as EmbeddedLibraryInboundBinding} onSaved={finishEditing} />
  }

  return (
    <section className="cap-connect cap-entry-point-workspace" aria-label="Configure entry points">
      <div className="cap-stage-head cap-entry-point-head">
        <div>
          <p className="capabilities-eyebrow">Build step 2</p>
          <h3>Configure application entry points</h3>
          <p className="cap-connect-purpose">Choose how people, systems, or scheduled work start an application capability. Suggestions come from the approved application design and remain editable.</p>
        </div>
        <button type="button" className="btn btn-secondary btn-compact" onClick={() => setTechnicalOpen(true)}>Technical specification</button>
      </div>

      {!modulesReady ? (
        <div className="panel-raised cap-blocker" role="status">
          <p>Approve every module above before adding application entry points. Existing entry points remain available to revise or remove.</p>
        </div>
      ) : null}

      {requiredDeployables.length === 0 && deployables.length > 0 ? (
        <div className="panel-raised cap-entry-point-exempt" role="status">
          <span className="badge approved">Not required</span>
          <div><strong>No external entry point is needed.</strong><p>This application is used as built-in library logic. You can still add an exported callable below if other code needs one.</p></div>
        </div>
      ) : null}

      {deployables.length === 0 ? <p className="capabilities-note" role="status">Approve the application structure before configuring entry points.</p> : (
        <div className="cap-entry-point-recommendations" role="group" aria-label="Application parts">
          {deployables.map((deployable) => {
            const recommendation = recommendedTrigger(deployable.kind)
            const summary = bindingSummaryByDeployable.get(deployable.deployableId) ?? { total: 0, approved: 0 }
            const exempt = deployable.kind === 'embedded-library'
            return (
              <article key={deployable.deployableId} className="panel-raised cap-entry-point-host">
                <header><div><span className="capabilities-eyebrow">Application part</span><h4>{deployable.name}</h4></div><span className={`badge ${summary.approved > 0 || exempt ? 'approved' : 'attention'}`}>{summary.approved > 0 ? 'Configured' : summary.total > 0 ? 'Draft in progress' : exempt ? 'Not required' : 'Needs an entry point'}</span></header>
                <p>{hostDescription(deployable)}</p>
                {recommendation && summary.total === 0 ? (
                  <div className="cap-entry-point-suggestion">
                    <span className="badge">Suggested</span>
                    <span>{triggerLabel(recommendation)}</span>
                    <button type="button" className="btn btn-primary btn-compact" disabled={!modulesReady} onClick={() => openNew(recommendation, deployable.deployableId)}>Use suggestion</button>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}

      {inboundBindingRecords.length > 0 ? (
        <section aria-label="Configured entry points">
          <div className="cap-entry-point-list-head"><h4>Configured entry points</h4><span>{configuredRequiredCount} of {requiredDeployables.length} required application parts ready</span></div>
          <div className="cap-entry-point-cards">
            {inboundBindingRecords.map((record) => {
              const binding = activeBinding(record)
              if (!binding) return null
              const host = deployables.find((deployable) => deployable.deployableId === binding.deployableId)
              return (
                <article key={record.bindingId} className="panel-raised cap-entry-point-card">
                  <header><div><span className="capabilities-eyebrow">{triggerLabel(binding.kind)}</span><h4>{humanizeIdentifier(binding.operationId) || 'Capability not chosen'}</h4></div><span className={`badge ${record.approved ? 'approved' : 'attention'}`}>{record.approved ? 'Approved' : 'Draft'}</span></header>
                  <dl>
                    <div><dt>Runs from</dt><dd>{host?.name ?? 'Current application part'}</dd></div>
                    <div><dt>Access</dt><dd>{binding.exposure === 'private' ? 'Private to this application' : humanizeIdentifier(binding.exposure ?? 'private')}</dd></div>
                  </dl>
                  {isExposureElevated(binding.exposure) ? <p className="cap-entry-point-warning">This entry point can be reached beyond the application’s private boundary.</p> : null}
                  <div className="capabilities-toolbar">
                    <button type="button" className="btn btn-secondary btn-compact" onClick={() => {
                      const initial = editableBinding(record)
                      if (initial) {
                        props.onSelectionEvidence(initial.kind === 'ui' ? initial.selectionEvidence : undefined)
                        setEditorState({ choice: initial.kind, deployableId: initial.deployableId, bindingId: initial.bindingId, initial })
                      }
                    }}>Edit</button>
                    {removingId === record.bindingId ? (
                      <><button type="button" className="btn btn-secondary btn-compact" onClick={() => setRemovingId('')}>Cancel</button><button type="button" className="btn btn-danger btn-compact" disabled={busyId === record.bindingId} onClick={() => void removeBinding(record.bindingId)}>Confirm remove</button></>
                    ) : <button type="button" className="btn btn-secondary btn-compact" onClick={() => setRemovingId(record.bindingId)}>Remove</button>}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ) : null}

      {!editorState ? (
        <section aria-label="Add an entry point">
          <h4>{inboundBindingRecords.length ? 'Add another entry point' : 'Choose another way to start a capability'}</h4>
          <div className="cap-connect-dispositions" role="group" aria-label="Entry point type">
            {visibleTriggerOptions.map((option) => (
              <button key={option.id} type="button" className="cap-connect-disposition" disabled={!modulesReady} onClick={() => openNew(option.id)}>
                <span className="cap-connect-disposition-icon" aria-hidden="true">•</span>
                <strong>{option.label}</strong><span>{option.description}</span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="cap-entry-point-editor-wrap" aria-label="Edit entry point">
          <div className="cap-entry-point-editor-head"><div><span className="capabilities-eyebrow">Entry point</span><h4>{editorState.initial ? 'Revise this entry point' : `Add ${triggerLabel(editorState.choice)}`}</h4></div><button type="button" className="btn btn-ghost btn-compact" onClick={() => setEditorState(undefined)}>Cancel</button></div>
          {renderEditor()}
        </section>
      )}

      {actionMessage ? <p className="capabilities-note" role="status">{actionMessage}</p> : null}

      {technicalOpen ? (
        <Dialog title="Entry-point technical specification" wide onClose={() => setTechnicalOpen(false)} actions={<button type="button" className="btn btn-primary" onClick={() => setTechnicalOpen(false)}>Close</button>}>
          <p className="lede">Canonical binding records, generated adapter targets, routes, commands, identifiers, diagnostics, and architecture provenance used by shared-setup generation.</p>
          <dl className="capabilities-ids">
            <div><dt>Project</dt><dd><code>{projectId}</code></dd></div>
            <div><dt>Architecture version</dt><dd><code>{props.architectureVersion ?? 'unavailable'}</code></dd></div>
            <div><dt>Architecture hash</dt><dd><code>{props.architectureHash ?? 'unavailable'}</code></dd></div>
          </dl>
          {inboundBindingRecords.length ? inboundBindingRecords.map((record) => {
            const binding = activeBinding(record)
            if (!binding) return null
            const diagnostics = validateInboundBindingDraft(binding)
            return (
              <section key={record.bindingId} className="panel-raised cap-entry-point-technical-record">
                <h3><code>{record.bindingId}</code></h3>
                <dl className="capabilities-ids">
                  <div><dt>Record state</dt><dd>{record.approved ? 'approved' : 'draft'}</dd></div>
                  <div><dt>Kind</dt><dd><code>{binding.kind}</code></dd></div>
                  <div><dt>Deployable ID</dt><dd><code>{binding.deployableId}</code></dd></div>
                  <div><dt>Operation</dt><dd><code>{binding.operationId}@{binding.operationVersion}</code></dd></div>
                  <div><dt>Route, command, schedule, or callable</dt><dd><code>{technicalStartDefinition(binding)}</code></dd></div>
                  <div><dt>Exposure</dt><dd><code>{binding.exposure}</code></dd></div>
                  <div><dt>Generated adapter targets</dt><dd>{binding.generatedTargets.length ? binding.generatedTargets.map((target) => <code key={target}>{target}</code>) : 'Created when shared setup is generated.'}</dd></div>
                  <div><dt>Diagnostics</dt><dd>{diagnostics.length ? diagnostics.join('; ') : 'No binding diagnostics.'}</dd></div>
                  <div><dt>Provenance</dt><dd>Project <code>{binding.projectId}</code>; architecture <code>{props.architectureVersion ?? 'unavailable'}</code> / <code>{props.architectureHash ?? 'unavailable'}</code></dd></div>
                </dl>
                <details open><summary>Canonical record JSON</summary><pre>{JSON.stringify(binding, null, 2)}</pre></details>
              </section>
            )
          }) : <p>No canonical entry-point records exist yet.</p>}
        </Dialog>
      ) : null}
    </section>
  )
}
