/**
 * Shared chrome for every headless InboundBinding editor (http/cli/schedule/
 * embedded-library): operation choice, the deliberate exposure control, and
 * save/approve actions against the CAP-CONTRACT-028 mock bridge. Kind-specific
 * fields are passed as `children`.
 */

import { useEffect, useState, type ChangeEvent } from 'react'
import type { ExposureLevel, InboundBinding, SteLexicon } from '@engineering-ui-kit/core'
import { evaluateInboundBindingSte } from '@engineering-ui-kit/core/browser'
import type { EuikBridge } from '../../../bridge'
import { StatusLine, type Status } from '../../../components'
import { humanizeIdentifier } from '../capabilityPresentation'
import { validateInboundBindingDraft } from './inboundBinding'
import { ExposureControl } from './ExposureControl'

type Operation = { operationId: string; operationVersion: string }

type Props<T extends InboundBinding> = {
  bridge: EuikBridge
  projectId: string
  binding: T
  setBinding: (updater: (prev: T) => T) => void
  operations: Operation[]
  onSaved: () => void
  children?: React.ReactNode
}

export function InboundBindingShell<T extends InboundBinding>(props: Props<T>) {
  const { bridge, projectId, binding, setBinding, operations, onSaved } = props
  const [status, setStatus] = useState<Status | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [steLexicon, setSteLexicon] = useState<SteLexicon | undefined>()

  useEffect(() => {
    let active = true
    void bridge.capabilitiesGetSteLexicon(projectId)
      .then((value) => {
        if (active) setSteLexicon(value as SteLexicon | undefined)
      })
      .catch(() => {
        if (active) setSteLexicon(undefined)
      })
    return () => {
      active = false
    }
  }, [bridge, projectId])

  const steEvaluation = evaluateInboundBindingSte(binding, steLexicon)
  const issues = [
    ...validateInboundBindingDraft(binding),
    ...steEvaluation.diagnostics.map((item) => item.message),
  ]

  function update<K extends keyof T>(key: K, value: T[K]) {
    setBinding((prev) => ({ ...prev, [key]: value }))
  }

  async function saveDraft() {
    setBusy(true)
    try {
      await bridge.capabilitiesSaveInboundBindingDraft(projectId, binding)
      setStatus({ tone: 'success', text: 'Draft saved.' })
      onSaved()
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
    }
  }

  async function approve() {
    setAttempted(true)
    if (issues.length > 0) {
      setStatus({ tone: 'error', text: issues[0]! })
      return
    }
    setBusy(true)
    try {
      await bridge.capabilitiesSaveInboundBindingDraft(projectId, binding)
      const result = await bridge.capabilitiesApproveInboundBinding(projectId, binding)
      if (!result.ok) {
        const diags = (Array.isArray(result.diagnostics) ? result.diagnostics : []) as { message?: string }[]
        setStatus({ tone: 'error', text: diags[0]?.message ?? 'Could not approve this entry point.' })
        return
      }
      setStatus({ tone: 'success', text: 'Entry point approved.' })
      onSaved()
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
    }
  }

  function selectCapability(event: ChangeEvent<HTMLSelectElement>) {
    const [id, version] = event.target.value.split('@')
    setBinding((prev) => ({ ...prev, operationId: id ?? '', operationVersion: version ?? '' }))
  }

  return (
    <div className="cap-inbound-editor" aria-label="Entry point editor">
      <div className="cap-connect-field">
        <label htmlFor={`cap-inbound-operation-${binding.bindingId}`}>Capability</label>
        <select
          id={`cap-inbound-operation-${binding.bindingId}`}
          aria-label="Capability"
          value={binding.operationId ? `${binding.operationId}@${binding.operationVersion}` : ''}
          onChange={selectCapability}
        >
          <option value="">Select a capability…</option>
          {operations.map((op) => (
            <option key={`${op.operationId}@${op.operationVersion}`} value={`${op.operationId}@${op.operationVersion}`}>
              {humanizeIdentifier(op.operationId)}
            </option>
          ))}
        </select>
      </div>

      {props.children}

      <ExposureControl
        exposure={binding.exposure}
        onChange={(next: ExposureLevel) => update('exposure' as keyof T, next as T[keyof T])}
      />

      <div className="capabilities-toolbar" role="group" aria-label="Entry point actions">
        <button type="button" className="btn btn-secondary btn-compact" disabled={busy} onClick={saveDraft}>
          Save draft
        </button>
        <button type="button" className="btn btn-primary btn-compact" disabled={busy} onClick={approve}>
          Approve entry point
        </button>
      </div>

      {status && <StatusLine status={status} />}

      {attempted && issues.length > 0 && (
        <section aria-label="Open issues" className="cap-issues">
          <h3>Resolve entry issues</h3>
          <ul className="cap-issue-list">
            {issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
