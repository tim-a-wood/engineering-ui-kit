/**
 * UI inbound-binding editor (CAP-CONTRACT-028 `ui` variant, CAP-ERA-001 §12.4).
 *
 * Internally this still works with the familiar `FrontendBinding` shape (the
 * element-selection / visible-behavior / test-and-approve substeps below are
 * the same mechanics BindingEditor.tsx uses), so a CAP-CONTRACT-013 binding
 * migrated to `ui` via `frontendBindingToInboundBinding` renders here
 * unchanged. Persistence crosses the CAP-CONTRACT-028 boundary at save/approve
 * time via `capabilitiesSaveInboundBindingDraft` / `capabilitiesApproveInboundBinding`.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  bindingModeLabel,
  buildConnectionPacket,
  evaluateBindingApprovalGate,
  simulateBindingMode,
} from '@engineering-ui-kit/core/browser'
import type {
  BindingDataMode,
  BindingTrigger,
  FrontendBinding,
  Project,
  ResultEnvelope,
  SelectionEvidence,
  UiInboundBinding,
} from '@engineering-ui-kit/core'
import type { EuikBridge } from '../../../bridge'
import { Icon } from '../../../icons'
import { StatusLine, type Status } from '../../../components'
import { CapabilityPreview, type CapabilityPreviewHandle } from '../CapabilityPreview'
import { PreviewBindingPicker } from '../PreviewBindingPicker'
import { canProceedWithSelection } from '../previewSelection'
import { BEHAVIOR_FIELDS, behaviorLabel, humanizeIdentifier, presentDiagnosticsForGuided, sanitizeGuidedMessage } from '../capabilityPresentation'
import { createUiBinding, inboundBindingToFrontendBinding } from './inboundBinding'

const DATA_MODES: BindingDataMode[] = ['connected', 'approved-example', 'invalid-input', 'dependency-unavailable', 'timeout']
const TRIGGERS: BindingTrigger[] = ['activate', 'change', 'submit', 'load']
const TRIGGER_LABELS: Record<BindingTrigger, string> = {
  activate: 'When clicked or activated',
  change: 'When the value changes',
  submit: 'When the form is submitted',
  load: 'When the screen loads',
}
const BEHAVIOR_PLACEHOLDERS: Record<string, string> = {
  loadingBehavior: 'e.g. show a spinner on the button',
  validationBehavior: 'e.g. highlight the invalid field',
  domainRejectionBehavior: 'e.g. show the rejection reason inline',
  technicalFailureBehavior: 'e.g. show a retry prompt',
  cancellationBehavior: 'e.g. restore the previous state',
  duplicateSubmissionBehavior: 'e.g. ignore the second click',
}

const emptyEvidence: SelectionEvidence = {
  route: '/',
  documentTitle: '',
  selector: '',
  visibleText: '',
  elementTag: '',
  captureTime: '1970-01-01T00:00:00.000Z',
}

function bindingFromCanonical(
  projectId: string,
  evidence: SelectionEvidence,
  initial?: Partial<FrontendBinding>,
): FrontendBinding {
  return {
    schemaVersion: '1.0',
    bindingId: initial?.bindingId ?? `binding.ui.${Date.now().toString(36)}`,
    version: initial?.version ?? '1.0.0',
    projectId,
    selectionEvidence: evidence,
    trigger: initial?.trigger ?? 'activate',
    operationId: initial?.operationId ?? '',
    operationVersion: initial?.operationVersion ?? '',
    inputMappings: initial?.inputMappings ?? [],
    outputMappings: initial?.outputMappings ?? [],
    loadingBehavior: initial?.loadingBehavior ?? '',
    validationBehavior: initial?.validationBehavior ?? '',
    domainRejectionBehavior: initial?.domainRejectionBehavior ?? '',
    technicalFailureBehavior: initial?.technicalFailureBehavior ?? '',
    cancellationBehavior: initial?.cancellationBehavior ?? '',
    duplicateSubmissionBehavior: initial?.duplicateSubmissionBehavior ?? '',
    dataMode: initial?.dataMode ?? 'connected',
  }
}

type Props = {
  bridge: EuikBridge
  projectId: string
  project?: Project
  deployableId: string
  transport?: UiInboundBinding['transport']
  operations: { operationId: string; operationVersion: string }[]
  selectionEvidence?: SelectionEvidence
  onSelectionEvidence: (e: SelectionEvidence | undefined) => void
  architectureVersion?: string
  architectureHash?: string
  initial?: UiInboundBinding
  previewRef: React.RefObject<CapabilityPreviewHandle | null>
  onSaved: () => void
  onProjectChanged?: () => Promise<void> | void
}

export function UiBindingEditor(props: Props) {
  const { bridge, projectId, deployableId, operations } = props
  const isElectron = typeof window !== 'undefined' && window.euikMode === 'electron'
  const initialFrontend = useMemo(
    () => (props.initial ? inboundBindingToFrontendBinding(props.initial) : undefined),
    [props.initial],
  )

  const evidence = props.selectionEvidence ?? initialFrontend?.selectionEvidence ?? emptyEvidence
  const [binding, setBinding] = useState<FrontendBinding>(() => bindingFromCanonical(projectId, evidence, initialFrontend))
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [status, setStatus] = useState<Status | null>(null)
  const [ranOutcome, setRanOutcome] = useState<{ label: string; outcome: string; connected: boolean } | null>(null)
  const [uiProject, setUiProject] = useState<Project | undefined>(props.project)
  // A configured launchUrl is not auto-trusted: the user must explicitly confirm it
  // (or edit it) before the target-app Preview launches (CAP-PKT-024/025).
  const [uiConfirmed, setUiConfirmed] = useState(!props.project)
  const [editingUi, setEditingUi] = useState(!props.project?.launchUrl)
  const [uiUrl, setUiUrl] = useState(props.project?.launchUrl ?? '')
  const [uiCommand, setUiCommand] = useState(props.project?.launchCommand ?? '')
  const [uiSetupError, setUiSetupError] = useState('')

  useEffect(() => {
    setBinding(bindingFromCanonical(projectId, props.selectionEvidence ?? initialFrontend?.selectionEvidence ?? emptyEvidence, initialFrontend))
    setAttempted(false)
    setStatus(null)
    setRanOutcome(null)
    busyRef.current = false
    setBusy(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, initialFrontend])

  useEffect(() => {
    if (props.selectionEvidence) setBinding((prev) => ({ ...prev, selectionEvidence: props.selectionEvidence!, projectId }))
  }, [props.selectionEvidence, projectId])

  function update<K extends keyof FrontendBinding>(key: K, value: FrontendBinding[K]) {
    setBinding((prev) => ({ ...prev, [key]: value }))
  }

  async function saveUiSetup() {
    const launchUrl = uiUrl.trim()
    if (!/^https?:\/\//.test(launchUrl)) {
      setUiSetupError('Enter the local or hosted application URL, starting with http:// or https://.')
      return
    }
    setBusy(true)
    setUiSetupError('')
    try {
      const updated = await bridge.updateProject(projectId, { launchUrl, launchCommand: uiCommand.trim() || undefined })
      setUiProject(updated)
      setEditingUi(false)
      setUiConfirmed(true)
      setStatus({ tone: 'success', text: `Using ${updated.name} as the application UI for this connection.` })
      await props.onProjectChanged?.()
    } catch (error) {
      setUiSetupError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const elementSelected = canProceedWithSelection(binding.selectionEvidence) && Boolean(binding.selectionEvidence.elementTag)
  const capabilityChosen = binding.operationId !== ''
  const behaviorsComplete = BEHAVIOR_FIELDS.every((f) => binding[f].trim() !== '')
  const gate = evaluateBindingApprovalGate(binding)
  const guidedError = (message: string): Status => ({ tone: 'error', text: sanitizeGuidedMessage(message) })

  async function runTest() {
    if (busyRef.current) return
    if (!capabilityChosen || !elementSelected || !behaviorsComplete) return
    busyRef.current = true
    setBusy(true)
    setAttempted(true)
    const mode = binding.dataMode
    const sim = simulateBindingMode({
      binding,
      mode,
      explicit: mode === 'connected' ? true : undefined,
      example:
        mode === 'approved-example'
          ? { id: 'ex.preview', version: '1.0.0', operationContractVersion: binding.operationVersion, input: {}, expectedResult: { preview: true }, source: 'guided-connect' }
          : undefined,
    })
    try {
      if (mode === 'connected' && sim.connectedInvokePlan) {
        const env = (await bridge.capabilitiesInvokeOperation({
          projectId,
          operationId: sim.connectedInvokePlan.operationId,
          args: sim.connectedInvokePlan.args,
          dataMode: 'connected',
          explicit: true,
        })) as ResultEnvelope
        setRanOutcome({ label: sim.modeLabel, outcome: env.outcome, connected: env.outcome === 'success' })
        setStatus({ tone: env.outcome === 'success' ? 'success' : 'info', text: `Connected test — ${env.outcome}.` })
      } else {
        await bridge.capabilitiesInvokeOperation({ projectId, operationId: binding.operationId || 'binding.simulated', dataMode: mode, explicit: false })
        setRanOutcome({ label: sim.modeLabel, outcome: sim.envelope.outcome, connected: false })
        setStatus({ tone: 'info', text: `Simulated ${sim.modeLabel} — ${sim.envelope.outcome} (no live call).` })
      }
    } catch (error) {
      setStatus(guidedError(error instanceof Error ? error.message : String(error)))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  async function approve() {
    if (busyRef.current) return
    setAttempted(true)
    if (!gate.passed) {
      setStatus(guidedError(`Not ready: ${presentDiagnosticsForGuided(gate.diagnostics)[0]?.message ?? 'complete every step first.'}`))
      return
    }
    busyRef.current = true
    setBusy(true)
    try {
      const inbound = createUiBinding(binding, deployableId, props.transport)
      await bridge.capabilitiesSaveInboundBindingDraft(projectId, inbound)
      const result = await bridge.capabilitiesApproveInboundBinding(projectId, inbound)
      if (!result.ok) {
        const diags = presentDiagnosticsForGuided((Array.isArray(result.diagnostics) ? result.diagnostics : []) as { message?: string }[])
        setStatus(guidedError(`Could not approve: ${diags[0]?.message ?? 'resolve the issues first.'}`))
        return
      }
      buildConnectionPacket({ packetId: `pkt-${binding.bindingId}`, binding, architectureVersion: props.architectureVersion ?? '1.0', architectureHash: props.architectureHash ?? 'pending' })
      setStatus({ tone: 'success', text: 'Connection approved.' })
      props.onSaved()
    } catch (error) {
      setStatus(guidedError(error instanceof Error ? error.message : String(error)))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const issues = attempted && !gate.passed ? presentDiagnosticsForGuided(gate.diagnostics) : []

  return (
    <div className="cap-connect-ui-editor" aria-label="UI entry point editor">
      {(editingUi || !uiProject?.launchUrl) && (
        <section className="cap-connect-step active" aria-label="Configure the application UI">
          <header className="cap-connect-step-head"><h3>Configure the application UI</h3></header>
          <div className="cap-ui-setup-form" aria-label="Application UI setup">
            <div className="cap-ui-setup-intro">
              <strong>{uiProject?.name ?? humanizeIdentifier(projectId)}</strong>
              <span>Repository: <code>{uiProject?.repoPath ?? 'Current project folder'}</code></span>
            </div>
            <label className="cap-connect-field">
              Application URL
              <input
                aria-label="Application UI URL"
                value={uiUrl}
                placeholder="http://localhost:5173"
                onChange={(event) => { setUiUrl(event.target.value); setUiSetupError('') }}
              />
              <span>The page Connect will preview and allow you to select elements from.</span>
            </label>
            <label className="cap-connect-field">
              Start command <span className="muted">(optional)</span>
              <input
                aria-label="Application UI start command"
                className="mono"
                value={uiCommand}
                placeholder="npm run dev"
                onChange={(event) => { setUiCommand(event.target.value); setUiSetupError('') }}
              />
              <span>Run in the project repository if the URL is not already available.</span>
            </label>
            {uiSetupError ? <p className="field-error" role="alert">{uiSetupError}</p> : null}
            <div className="cap-ui-source-actions">
              <button type="button" className="btn btn-primary btn-compact" disabled={busy} onClick={() => void saveUiSetup()}>
                Save and use this UI
              </button>
            </div>
          </div>
        </section>
      )}

      {!editingUi && uiProject?.launchUrl && (
        <section className={uiConfirmed ? 'cap-connect-step done' : 'cap-connect-step active'} aria-label="Application UI source">
          <div className="cap-ui-source-card">
            <div className="cap-ui-source-icon" aria-hidden="true">↗</div>
            <div className="cap-ui-source-summary">
              <span className="capabilities-eyebrow">Application UI source</span>
              <strong>{uiProject.name}</strong>
              <span><code>{uiProject.launchUrl}</code></span>
            </div>
            <div className="cap-ui-source-actions">
              {!uiConfirmed ? (
                <button type="button" className="btn btn-primary btn-compact" onClick={() => setUiConfirmed(true)}>
                  Use this UI
                </button>
              ) : (
                <span className="status status-ok"><span className="status-dot" aria-hidden="true" /> Connected</span>
              )}
              <button type="button" className="btn btn-secondary btn-compact" onClick={() => { setEditingUi(true); setUiConfirmed(false) }}>
                Change UI setup
              </button>
            </div>
          </div>
        </section>
      )}

      {uiConfirmed && (
        <section className="cap-connect-step active" aria-label="Select an element">
          <header className="cap-connect-step-head"><h3>Select an element</h3></header>
          <CapabilityPreview ref={props.previewRef} bridge={bridge} projectId={projectId} project={uiProject} />
          {isElectron ? (
            <PreviewBindingPicker
              disabled={!projectId}
              pickFromPreview={() => props.previewRef.current?.pickElement() ?? Promise.reject(new Error('Start Preview before selecting an element.'))}
              onEvidenceReady={props.onSelectionEvidence}
              onCancel={() => props.onSelectionEvidence(undefined)}
            />
          ) : (
            <p className="cap-connect-note" role="note">
              {Icon.info(14)} Element selection runs in the packaged desktop app. Open Capabilities there to select an
              element and continue this connection.
            </p>
          )}
          {elementSelected && (
            <p className="cap-connect-confirmed" role="status">
              Selected <strong>{binding.selectionEvidence.visibleText || binding.selectionEvidence.elementTag}</strong> on {binding.selectionEvidence.route}.
            </p>
          )}
        </section>
      )}

      {elementSelected && (
        <section className="cap-connect-step active" aria-label="Choose a capability">
          <header className="cap-connect-step-head"><h3>Choose a capability</h3></header>
          {operations.length === 0 ? (
            <p role="status">No approved capabilities are available yet. Approve a module first.</p>
          ) : (
            <label className="cap-connect-field">
              Capability
              <select
                aria-label="Capability"
                value={binding.operationId ? `${binding.operationId}@${binding.operationVersion}` : ''}
                onChange={(e) => {
                  const [id, version] = e.target.value.split('@')
                  setBinding((prev) => ({ ...prev, operationId: id ?? '', operationVersion: version ?? '' }))
                }}
              >
                <option value="">Select a capability…</option>
                {operations.map((op) => (
                  <option key={`${op.operationId}@${op.operationVersion}`} value={`${op.operationId}@${op.operationVersion}`}>
                    {humanizeIdentifier(op.operationId)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>
      )}

      {elementSelected && capabilityChosen && (
        <section className="cap-connect-step active" aria-label="Define visible behavior">
          <header className="cap-connect-step-head"><h3>Define visible behavior</h3></header>
          <label className="cap-connect-field">
            What triggers it
            <select aria-label="Trigger" value={binding.trigger} onChange={(e) => update('trigger', e.target.value as BindingTrigger)}>
              {TRIGGERS.map((t) => <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>)}
            </select>
          </label>
          <div className="cap-connect-behaviors">
            {BEHAVIOR_FIELDS.map((field) => (
              <label key={field} className="cap-connect-field">
                {behaviorLabel(field)}
                <input
                  aria-label={behaviorLabel(field)}
                  value={binding[field]}
                  placeholder={BEHAVIOR_PLACEHOLDERS[field]}
                  onChange={(e) => update(field, e.target.value)}
                />
              </label>
            ))}
          </div>
        </section>
      )}

      {elementSelected && capabilityChosen && (
        <section className="cap-connect-step active" aria-label="Test and approve">
          <header className="cap-connect-step-head"><h3>Test and approve</h3></header>
          <div className="cap-connect-test" role="group" aria-label="Test and approve">
            <label className="cap-connect-field">
              How to test
              <select aria-label="Test mode" value={binding.dataMode} onChange={(e) => update('dataMode', e.target.value as BindingDataMode)}>
                {DATA_MODES.map((mode) => (
                  <option key={mode} value={mode}>{bindingModeLabel(mode)}</option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-secondary btn-compact" disabled={busy || !capabilityChosen || !elementSelected || !behaviorsComplete} onClick={() => void runTest()}>
              {Icon.play(14)} Run {binding.dataMode === 'connected' ? 'connected test' : 'simulation'}
            </button>
            <button type="button" className="btn btn-primary btn-compact" disabled={busy || !behaviorsComplete} onClick={() => void approve()}>
              Approve connection
            </button>
          </div>
          {!behaviorsComplete && <p className="capabilities-note">Describe every behavior above to test or approve.</p>}
          {ranOutcome && (
            <p className="cap-connect-outcome" role="status">
              {ranOutcome.connected ? Icon.check(14) : Icon.info(14)}{' '}
              {ranOutcome.connected ? 'Connected' : 'Simulated'} · {ranOutcome.label} → {ranOutcome.outcome}
            </p>
          )}
        </section>
      )}

      {status && <StatusLine status={status} />}

      {issues.length > 0 && (
        <section aria-label="Open issues" className="cap-issues">
          <h3>To finish this connection</h3>
          <ul className="cap-issue-list">{issues.map((issue, i) => <li key={i}>{issue.message}</li>)}</ul>
        </section>
      )}
    </div>
  )
}
