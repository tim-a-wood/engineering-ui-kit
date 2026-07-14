/**
 * Guided Connect — progressive four-substep flow (CAP-PKT-024/025), distinct from the
 * full Design binding editor:
 *   1. Select an element   2. Choose a capability   3. Define visible behavior   4. Test & approve
 *
 * Guided rules honored here:
 * - No Binding ID / version, no raw `id @ version`; operation names are humanized.
 * - Input/output mappings live behind an Advanced disclosure.
 * - Behavior fields do not render until an element is selected AND a capability chosen.
 * - Diagnostics do not render until the user runs a test or attempts approval; issues are
 *   plain-language with no CAP codes.
 * - Element selection is honestly disabled outside packaged Electron.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  bindingModeLabel,
  buildConnectionPacket,
  evaluateBindingApprovalGate,
  simulateBindingMode,
} from '@engineering-ui-kit/core/browser'
import type {
  BindingDataMode,
  BindingTrigger,
  CapabilityModuleRecord,
  FrontendBinding,
  ResultEnvelope,
  SelectionEvidence,
} from '@engineering-ui-kit/core'
import type { EuikBridge } from '../../bridge'
import { Icon } from '../../icons'
import { StatusLine, type Status } from '../../components'
import { CapabilityPreview, type CapabilityPreviewHandle } from './CapabilityPreview'
import { PreviewBindingPicker } from './PreviewBindingPicker'
import { canProceedWithSelection } from './previewSelection'
import { BEHAVIOR_FIELDS, behaviorLabel, humanizeIdentifier, presentDiagnosticsForGuided, sanitizeGuidedMessage } from './capabilityPresentation'

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

type Props = {
  bridge: EuikBridge
  projectId: string
  records: CapabilityModuleRecord[]
  selectionEvidence?: SelectionEvidence
  onSelectionEvidence: (e: SelectionEvidence | undefined) => void
  architectureVersion?: string
  architectureHash?: string
  initialBinding?: Partial<FrontendBinding>
  previewRef: React.RefObject<CapabilityPreviewHandle | null>
  onChanged: () => void
}

function Substep(props: { n: number; title: string; done: boolean; active: boolean; children?: React.ReactNode }) {
  return (
    <section className={`cap-connect-step${props.active ? ' active' : ''}${props.done ? ' done' : ''}`} aria-label={`Step ${props.n}: ${props.title}`}>
      <header className="cap-connect-step-head">
        <span className="cap-connect-num" aria-hidden="true">{props.done ? Icon.check(13) : props.n}</span>
        <h3>{props.title}</h3>
      </header>
      {props.children}
    </section>
  )
}

export function GuidedConnect(props: Props) {
  const { bridge, projectId, records } = props
  const isElectron = typeof window !== 'undefined' && window.euikMode === 'electron'

  const operations = useMemo(
    () =>
      records
        .flatMap((r) => (r.approved ? r.approved.providedOperations : []))
        .map((op) => ({ operationId: op.operationId, operationVersion: op.contractVersion }))
        .filter((op, i, all) => all.findIndex((o) => o.operationId === op.operationId && o.operationVersion === op.operationVersion) === i)
        .sort((a, b) => a.operationId.localeCompare(b.operationId)),
    [records],
  )

  const evidence = props.selectionEvidence ?? props.initialBinding?.selectionEvidence ?? emptyEvidence
  const [binding, setBinding] = useState<FrontendBinding>(() => ({
    schemaVersion: '1.0',
    bindingId: props.initialBinding?.bindingId ?? 'binding.draft',
    version: props.initialBinding?.version ?? '1.0.0',
    projectId,
    selectionEvidence: evidence,
    trigger: props.initialBinding?.trigger ?? 'activate',
    operationId: props.initialBinding?.operationId ?? '',
    operationVersion: props.initialBinding?.operationVersion ?? '',
    inputMappings: props.initialBinding?.inputMappings ?? [],
    outputMappings: props.initialBinding?.outputMappings ?? [],
    loadingBehavior: props.initialBinding?.loadingBehavior ?? '',
    validationBehavior: props.initialBinding?.validationBehavior ?? '',
    domainRejectionBehavior: props.initialBinding?.domainRejectionBehavior ?? '',
    technicalFailureBehavior: props.initialBinding?.technicalFailureBehavior ?? '',
    cancellationBehavior: props.initialBinding?.cancellationBehavior ?? '',
    duplicateSubmissionBehavior: props.initialBinding?.duplicateSubmissionBehavior ?? '',
    dataMode: props.initialBinding?.dataMode ?? 'connected',
  }))
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status | null>(null)
  const [ranOutcome, setRanOutcome] = useState<{ label: string; outcome: string; connected: boolean } | null>(null)

  useEffect(() => {
    if (props.selectionEvidence) setBinding((prev) => ({ ...prev, selectionEvidence: props.selectionEvidence!, projectId }))
  }, [props.selectionEvidence, projectId])

  // Keep the binding bound to the active project (defence in depth beyond the parent remount).
  useEffect(() => {
    setBinding((prev) => (prev.projectId === projectId ? prev : { ...prev, projectId }))
  }, [projectId])

  function update<K extends keyof FrontendBinding>(key: K, value: FrontendBinding[K]) {
    setBinding((prev) => ({ ...prev, [key]: value }))
  }

  const elementSelected = canProceedWithSelection(binding.selectionEvidence) && Boolean(binding.selectionEvidence.elementTag)
  const capabilityChosen = binding.operationId !== ''
  const behaviorsComplete = BEHAVIOR_FIELDS.every((f) => binding[f].trim() !== '')
  const gate = evaluateBindingApprovalGate(binding) // canonical gate incl. mapping-ambiguity detection
  const guidedError = (message: string): Status => ({ tone: 'error', text: sanitizeGuidedMessage(message) })

  async function runTest() {
    if (busy) return
    if (binding.projectId !== projectId) { setStatus(guidedError('This connection is for a different project.')); return }
    if (!capabilityChosen || !elementSelected || !behaviorsComplete) return
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
      setBusy(false)
    }
  }

  async function approve() {
    if (busy) return
    if (binding.projectId !== projectId) { setStatus(guidedError('This connection is for a different project.')); return }
    setAttempted(true)
    if (!gate.passed) {
      setStatus(guidedError(`Not ready: ${presentDiagnosticsForGuided(gate.diagnostics)[0]?.message ?? 'complete every step first.'}`))
      return
    }
    setBusy(true)
    try {
      await bridge.capabilitiesSaveBindingDraft(projectId, binding)
      const result = await bridge.capabilitiesApproveBinding(projectId, binding)
      if (!result.ok) {
        const diags = presentDiagnosticsForGuided((Array.isArray(result.diagnostics) ? result.diagnostics : []) as { message?: string }[])
        setStatus(guidedError(`Could not approve: ${diags[0]?.message ?? 'resolve the issues first.'}`))
        return
      }
      buildConnectionPacket({ packetId: `pkt-${binding.bindingId}`, binding, architectureVersion: props.architectureVersion ?? '1.0', architectureHash: props.architectureHash ?? 'pending' })
      setStatus({ tone: 'success', text: 'Connection approved.' })
      props.onChanged()
    } catch (error) {
      setStatus(guidedError(error instanceof Error ? error.message : String(error)))
    } finally {
      setBusy(false)
    }
  }

  const issues = attempted && !gate.passed ? presentDiagnosticsForGuided(gate.diagnostics) : []

  return (
    <section className="cap-connect" aria-label="Connect an element to a capability">
      {/* 1. Select an element */}
      <Substep n={1} title="Select an element" done={elementSelected} active={!elementSelected}>
        <CapabilityPreview ref={props.previewRef} bridge={bridge} projectId={projectId} />
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
      </Substep>

      {/* 2. Choose a capability — only after a real element is selected (honest outside packaged Electron) */}
      {elementSelected && (
        <Substep n={2} title="Choose a capability" done={capabilityChosen} active={!capabilityChosen}>
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
        </Substep>
      )}

      {/* 3. Define visible behavior — only after element + capability */}
      {elementSelected && capabilityChosen && (
        <Substep n={3} title="Define visible behavior" done={behaviorsComplete} active={!behaviorsComplete}>
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
          <details className="cap-connect-advanced">
            <summary>Advanced: input / output mappings</summary>
            {(['inputMappings', 'outputMappings'] as const).map((side) => {
              const label = side === 'inputMappings' ? 'Input mappings' : 'Output mappings'
              return (
                <div key={side} role="group" aria-label={label} className="binding-mappings">
                  <h4>{label}</h4>
                  {binding[side].length === 0 ? <p className="capabilities-note">None.</p> : null}
                  {binding[side].map((m, i) => (
                    <div key={i} className="binding-mapping-row">
                      <input aria-label={`${label} ${i + 1} from`} placeholder="from" value={m.from}
                        onChange={(e) => setBinding((p) => ({ ...p, [side]: p[side].map((x, xi) => (xi === i ? { ...x, from: e.target.value } : x)) }))} />
                      <span aria-hidden="true">→</span>
                      <input aria-label={`${label} ${i + 1} to`} placeholder="to" value={m.to}
                        onChange={(e) => setBinding((p) => ({ ...p, [side]: p[side].map((x, xi) => (xi === i ? { ...x, to: e.target.value } : x)) }))} />
                      <button type="button" className="btn btn-ghost btn-compact" aria-label={`Remove ${label} ${i + 1}`}
                        onClick={() => setBinding((p) => ({ ...p, [side]: p[side].filter((_, xi) => xi !== i) }))}>Remove</button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-secondary btn-compact"
                    onClick={() => setBinding((p) => ({ ...p, [side]: [...p[side], { from: '', to: '' }] }))}>
                    Add {side === 'inputMappings' ? 'input' : 'output'} mapping
                  </button>
                </div>
              )
            })}
          </details>
        </Substep>
      )}

      {/* 4. Test and approve */}
      {elementSelected && capabilityChosen && (
        <Substep n={4} title="Test and approve" done={false} active={behaviorsComplete}>
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
          {!behaviorsComplete && (
            <p className="capabilities-note">Describe every behavior above to test or approve.</p>
          )}
          {ranOutcome && (
            <p className="cap-connect-outcome" role="status">
              {ranOutcome.connected ? Icon.check(14) : Icon.info(14)}{' '}
              {ranOutcome.connected ? 'Connected' : 'Simulated'} · {ranOutcome.label} → {ranOutcome.outcome}
            </p>
          )}
        </Substep>
      )}

      {status && <StatusLine status={status} />}

      {issues.length > 0 && (
        <section aria-label="Open issues" className="cap-issues">
          <h3>To finish this connection</h3>
          <ul className="cap-issue-list">{issues.map((issue, i) => <li key={i}>{issue.message}</li>)}</ul>
        </section>
      )}
    </section>
  )
}
