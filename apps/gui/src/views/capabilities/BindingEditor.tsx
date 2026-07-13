/**
 * Preview binding editor — CAP-PKT-024 / CAP-PKT-025.
 * Collects required behavior fields, resolves ambiguity, labels mode, shows outcomes.
 * Selection evidence may be supplied by PreviewBindingPicker (separate) via props.
 */

import { useEffect, useState } from 'react'
import type { EuikBridge } from '../../bridge'
import {
  BINDING_BEHAVIOR_FIELDS,
  bindingModeLabel,
  buildConnectionPacket,
  evaluateBindingApprovalGate,
  simulateBindingMode,
  type MappingAmbiguity,
} from '@engineering-ui-kit/core/browser'
import type {
  BindingDataMode,
  BindingTrigger,
  CapabilityModuleRecord,
  FrontendBinding,
  ResultEnvelope,
  SelectionEvidence,
} from '@engineering-ui-kit/core'

type Props = {
  bridge: EuikBridge
  projectId: string
  projection?: 'guided' | 'design'
  selectionEvidence?: SelectionEvidence
  initialBinding?: Partial<FrontendBinding>
  architectureVersion?: string
  architectureHash?: string
  /** Approved module records — the only source of selectable operations. */
  records?: CapabilityModuleRecord[]
  onChanged?: () => void | Promise<void>
}

const TRIGGERS: BindingTrigger[] = ['activate', 'change', 'submit', 'load']
const DATA_MODES: BindingDataMode[] = [
  'connected',
  'approved-example',
  'invalid-input',
  'dependency-unavailable',
  'timeout',
]

const emptyEvidence: SelectionEvidence = {
  route: '/',
  documentTitle: '',
  selector: '',
  visibleText: '',
  elementTag: '',
  captureTime: new Date().toISOString(),
}

function defaultBinding(
  projectId: string,
  selectionEvidence: SelectionEvidence,
  initial?: Partial<FrontendBinding>,
): FrontendBinding {
  return {
    schemaVersion: '1.0',
    bindingId: initial?.bindingId ?? 'binding.draft',
    version: initial?.version ?? '1.0.0',
    projectId,
    selectionEvidence,
    trigger: initial?.trigger ?? 'activate',
    operationId: initial?.operationId ?? '',
    operationVersion: initial?.operationVersion ?? '1.0.0',
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

export function BindingEditor({
  bridge,
  projectId,
  projection = 'guided',
  selectionEvidence,
  initialBinding,
  architectureVersion = '1.0',
  architectureHash = 'pending',
  records = [],
  onChanged = () => {},
}: Props) {
  // Selectable operations come only from persisted approved module manifests.
  const operations = records
    .flatMap((r) => (r.approved ? r.approved.providedOperations : []))
    .map((op) => ({ operationId: op.operationId, operationVersion: op.contractVersion }))
    .filter(
      (op, i, all) =>
        all.findIndex(
          (o) => o.operationId === op.operationId && o.operationVersion === op.operationVersion,
        ) === i,
    )
    .sort((a, b) => a.operationId.localeCompare(b.operationId))
  const evidence = selectionEvidence ?? initialBinding?.selectionEvidence ?? emptyEvidence
  const [binding, setBinding] = useState<FrontendBinding>(() =>
    defaultBinding(projectId, evidence, initialBinding),
  )
  const [ambiguities, setAmbiguities] = useState<MappingAmbiguity[]>([])
  const [status, setStatus] = useState('Draft binding — complete all behavior fields to approve.')
  const [packetJson, setPacketJson] = useState<string>('')
  const [lastResult, setLastResult] = useState<{
    modeLabel: string
    envelope: ResultEnvelope
    presentation: ReturnType<typeof simulateBindingMode>['presentation']
    qualifiesForConnectedVerification: boolean
    adapterCalled: boolean
  } | null>(null)

  useEffect(() => {
    if (!selectionEvidence) return
    setBinding((prev) => ({ ...prev, selectionEvidence, projectId }))
  }, [selectionEvidence, projectId])

  useEffect(() => {
    if (!initialBinding) return
    setBinding(defaultBinding(projectId, initialBinding.selectionEvidence ?? evidence, initialBinding))
  }, [initialBinding, projectId])

  const gate = evaluateBindingApprovalGate(binding, { ambiguities })

  function update<K extends keyof FrontendBinding>(key: K, value: FrontendBinding[K]) {
    setBinding((prev) => ({ ...prev, [key]: value }))
  }

  function resolveAmbiguity(from: string, resolvedTo: string) {
    setAmbiguities((prev) =>
      prev.map((a) => (a.from === from ? { ...a, resolvedTo } : a)),
    )
    setBinding((prev) => ({
      ...prev,
      inputMappings: prev.inputMappings
        .filter((m) => m.from !== from)
        .concat([{ from, to: resolvedTo }]),
    }))
  }

  async function onSaveDraft() {
    await bridge.capabilitiesSaveBindingDraft(projectId, binding)
    await onChanged()
    setStatus(`Saved draft ${binding.bindingId}@${binding.version}.`)
  }

  async function onApprove() {
    if (!gate.passed) {
      setStatus(`Blocked: ${gate.diagnostics.map((d) => d.message).join('; ')}`)
      return
    }
    await bridge.capabilitiesSaveBindingDraft(projectId, binding)
    const result = await bridge.capabilitiesApproveBinding(projectId, binding)
    if (!result.ok) {
      setStatus(`Approval failed: ${JSON.stringify(result.diagnostics ?? result)}`)
      return
    }
    await onChanged()
    try {
      const packet = buildConnectionPacket({
        packetId: `pkt-${binding.bindingId}`,
        binding,
        architectureVersion,
        architectureHash,
      })
      setPacketJson(JSON.stringify(packet, null, 2))
      setStatus(`Approved ${binding.bindingId}@${binding.version}; connection packet ready.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    }
  }

  async function onRunMode() {
    const mode = binding.dataMode
    const result = simulateBindingMode({
      binding,
      mode,
      explicit: mode === 'connected' ? true : undefined,
      example:
        mode === 'approved-example'
          ? {
              id: 'ex.preview',
              version: '1.0.0',
              operationContractVersion: binding.operationVersion,
              input: {},
              expectedResult: { preview: true },
              source: 'binding-editor',
            }
          : undefined,
    })

    let envelope = result.envelope
    let qualifies = result.qualifiesForConnectedVerification
    let adapterCalled = false

    try {
      if (mode === 'connected' && result.connectedInvokePlan) {
        const bridgeResult = (await bridge.capabilitiesInvokeOperation({
          projectId,
          operationId: result.connectedInvokePlan.operationId,
          args: result.connectedInvokePlan.args,
          dataMode: 'connected',
          explicit: true,
        })) as ResultEnvelope
        envelope = bridgeResult
        qualifies = bridgeResult.outcome === 'success'
        adapterCalled = true
      } else if (mode !== 'connected') {
        // Simulated modes hit the named bridge channel but never earn connected credit.
        await bridge.capabilitiesInvokeOperation({
          projectId,
          operationId: binding.operationId || 'binding.simulated',
          dataMode: mode,
          explicit: false,
        })
        qualifies = false
        adapterCalled = false
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
      setLastResult({
        modeLabel: result.modeLabel,
        envelope: result.envelope,
        presentation: result.presentation,
        qualifiesForConnectedVerification: false,
        adapterCalled: false,
      })
      return
    }

    setLastResult({
      modeLabel: result.modeLabel,
      envelope,
      presentation: { ...result.presentation, outcome: envelope.outcome },
      qualifiesForConnectedVerification: qualifies,
      adapterCalled,
    })
    setStatus(
      qualifies
        ? `Connected invoke succeeded for ${binding.operationId}`
        : `Simulated ${result.modeLabel} — outcome ${envelope.outcome}`,
    )
  }

  function addMapping(side: 'inputMappings' | 'outputMappings') {
    setBinding((prev) => ({ ...prev, [side]: [...prev[side], { from: '', to: '' }] }))
  }

  function updateMapping(
    side: 'inputMappings' | 'outputMappings',
    index: number,
    key: 'from' | 'to',
    value: string,
  ) {
    setBinding((prev) => ({
      ...prev,
      [side]: prev[side].map((m, i) => (i === index ? { ...m, [key]: value } : m)),
    }))
  }

  function removeMapping(side: 'inputMappings' | 'outputMappings', index: number) {
    setBinding((prev) => ({ ...prev, [side]: prev[side].filter((_, i) => i !== index) }))
  }

  function selectOperation(operationId: string, operationVersion: string) {
    setBinding((prev) => ({ ...prev, operationId, operationVersion }))
  }

  return (
    <section className="capabilities-panel binding-editor" aria-label="Binding editor">
      <h2>Frontend binding</h2>
      <p className="lede">
        {projection === 'guided'
          ? 'Map a Preview selection to one operation. Complete every presentation behavior before approval.'
          : 'Validate CAP-CONTRACT-013 fields, resolve mapping ambiguity, approve a revision, and export a bounded connection packet.'}
      </p>

      <p role="status" className="capabilities-note">
        {status}
      </p>

      <div className="binding-editor-grid">
        <label>
          Binding ID
          <input
            value={binding.bindingId}
            onChange={(e) => update('bindingId', e.target.value)}
            aria-label="Binding ID"
          />
        </label>
        <label>
          Version
          <input
            value={binding.version}
            onChange={(e) => update('version', e.target.value)}
            aria-label="Binding version"
          />
        </label>
        <label>
          Operation
          <select
            value={binding.operationId ? `${binding.operationId}@${binding.operationVersion}` : ''}
            aria-label="Operation"
            onChange={(e) => {
              const [id, version] = e.target.value.split('@')
              selectOperation(id ?? '', version ?? '')
            }}
          >
            <option value="">
              {operations.length === 0
                ? 'No approved operations available'
                : 'Select one operation'}
            </option>
            {operations.map((op) => (
              <option
                key={`${op.operationId}@${op.operationVersion}`}
                value={`${op.operationId}@${op.operationVersion}`}
              >
                {op.operationId} @ {op.operationVersion}
              </option>
            ))}
          </select>
        </label>
        <label>
          Trigger
          <select
            value={binding.trigger}
            onChange={(e) => update('trigger', e.target.value as BindingTrigger)}
            aria-label="Trigger"
          >
            {TRIGGERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Data mode
          <select
            value={binding.dataMode}
            onChange={(e) => update('dataMode', e.target.value as BindingDataMode)}
            aria-label="Data mode"
          >
            {DATA_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {bindingModeLabel(mode)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p aria-live="polite">
        Current mode: <strong>{bindingModeLabel(binding.dataMode)}</strong>
      </p>

      <h3>Selection evidence</h3>
      <dl className="capabilities-ids">
        <div>
          <dt>Route</dt>
          <dd>{binding.selectionEvidence.route || '—'}</dd>
        </div>
        <div>
          <dt>Selector</dt>
          <dd>
            <code>{binding.selectionEvidence.selector || '—'}</code>
          </dd>
        </div>
        <div>
          <dt>Stable marker</dt>
          <dd>{binding.selectionEvidence.stableMarker || 'none'}</dd>
        </div>
        <div>
          <dt>Source confirmed</dt>
          <dd>{binding.selectionEvidence.sourceTargetConfirmed ? 'yes' : 'no'}</dd>
        </div>
        {projection === 'design' ? (
          <>
            <div>
              <dt>Element tag</dt>
              <dd>{binding.selectionEvidence.elementTag || '—'}</dd>
            </div>
            <div>
              <dt>Capture time</dt>
              <dd>{binding.selectionEvidence.captureTime || '—'}</dd>
            </div>
          </>
        ) : null}
      </dl>
      {!binding.selectionEvidence.stableMarker ? (
        <label>
          <input
            type="checkbox"
            checked={binding.selectionEvidence.sourceTargetConfirmed === true}
            onChange={(e) =>
              setBinding((prev) => ({
                ...prev,
                selectionEvidence: {
                  ...prev.selectionEvidence,
                  sourceTargetConfirmed: e.target.checked,
                },
              }))
            }
          />{' '}
          Confirm proposed source target
        </label>
      ) : null}

      <h3>Behavior mappings</h3>
      <div className="binding-editor-grid">
        {BINDING_BEHAVIOR_FIELDS.map((field) => (
          <label key={field}>
            {field}
            <input
              value={binding[field]}
              onChange={(e) => update(field, e.target.value)}
              aria-label={field}
              required
            />
          </label>
        ))}
      </div>

      {(['inputMappings', 'outputMappings'] as const).map((side) => {
        const label = side === 'inputMappings' ? 'Input mappings' : 'Output mappings'
        return (
          <div key={side} className="binding-mappings" role="group" aria-label={label}>
            <h3>{label}</h3>
            {binding[side].length === 0 ? <p className="capabilities-note">None.</p> : null}
            {binding[side].map((m, i) => (
              <div key={i} className="binding-mapping-row">
                <input
                  value={m.from}
                  aria-label={`${label} ${i + 1} from`}
                  placeholder="from"
                  onChange={(e) => updateMapping(side, i, 'from', e.target.value)}
                />
                <span aria-hidden="true">→</span>
                <input
                  value={m.to}
                  aria-label={`${label} ${i + 1} to`}
                  placeholder="to"
                  onChange={(e) => updateMapping(side, i, 'to', e.target.value)}
                />
                <button
                  type="button"
                  aria-label={`Remove ${label} ${i + 1}`}
                  onClick={() => removeMapping(side, i)}
                >
                  Remove
                </button>
              </div>
            ))}
            <button type="button" onClick={() => addMapping(side)}>
              Add {side === 'inputMappings' ? 'input' : 'output'} mapping
            </button>
          </div>
        )
      })}

      {ambiguities.some((a) => !a.resolvedTo) ? (
        <div className="binding-ambiguity" role="group" aria-label="Ambiguous mappings">
          <h3>Resolve ambiguity</h3>
          {ambiguities
            .filter((a) => !a.resolvedTo)
            .map((a) => (
              <div key={`${a.side}-${a.from}`}>
                <p>
                  {a.side} mapping for <code>{a.from}</code> has multiple candidates.
                </p>
                <div role="group" aria-label={`Resolve ${a.from}`}>
                  {a.candidates.map((candidate) => (
                    <button
                      key={candidate}
                      type="button"
                      onClick={() => resolveAmbiguity(a.from, candidate)}
                    >
                      Use {candidate}
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>
      ) : null}

      <div className="capabilities-toolbar" role="group" aria-label="Binding actions">
        <button type="button" onClick={() => void onSaveDraft()}>
          Save draft
        </button>
        <button type="button" onClick={() => void onApprove()} disabled={!gate.passed}>
          Approve binding
        </button>
        <button type="button" onClick={() => void onRunMode()}>
          Run {bindingModeLabel(binding.dataMode)}
        </button>
      </div>

      {!gate.passed ? (
        <ul aria-label="Binding diagnostics">
          {gate.diagnostics.map((d) => (
            <li key={`${d.code}-${d.fieldPath ?? ''}-${d.message}`}>
              <code>{d.code}</code> {d.message}
            </li>
          ))}
        </ul>
      ) : (
        <p role="status">Gate passed — ready to approve.</p>
      )}

      {lastResult ? (
        <section aria-label="Binding outcome presentation">
          <h3>Outcome presentation</h3>
          <p>
            Mode: <strong>{lastResult.modeLabel}</strong>
          </p>
          <dl className="capabilities-ids">
            <div>
              <dt>Outcome</dt>
              <dd>{lastResult.envelope.outcome}</dd>
            </div>
            <div>
              <dt>Loading</dt>
              <dd>{lastResult.presentation.loading}</dd>
            </div>
            <div>
              <dt>Validation</dt>
              <dd>{lastResult.presentation.validation}</dd>
            </div>
            <div>
              <dt>Domain rejection</dt>
              <dd>{lastResult.presentation.domainRejection}</dd>
            </div>
            <div>
              <dt>Technical failure</dt>
              <dd>{lastResult.presentation.technicalFailure}</dd>
            </div>
            <div>
              <dt>Connected verification credit</dt>
              <dd>{lastResult.qualifiesForConnectedVerification ? 'yes' : 'no'}</dd>
            </div>
            {projection === 'design' ? (
              <div>
                <dt>Adapter called</dt>
                <dd>{lastResult.adapterCalled ? 'yes' : 'no'}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      {packetJson ? (
        <section aria-label="Connection packet">
          <h3>Connection packet</h3>
          <pre className="pre">
            <code>{packetJson}</code>
          </pre>
        </section>
      ) : null}
    </section>
  )
}
