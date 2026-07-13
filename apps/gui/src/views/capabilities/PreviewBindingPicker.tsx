/**
 * Preview binding picker UI (CAP-PKT-023).
 * Attaches to a Document or mock host; no React fiber inspection.
 */

import { useEffect, useRef, useState } from 'react'
import type { SelectionEvidence } from '@engineering-ui-kit/core'
import {
  attachPreviewPicker,
  canProceedWithSelection,
  confirmSourceTarget,
  requiresSourceTargetConfirmation,
  type PickerSession,
} from './previewSelection'

type Props = {
  /** Document or mock host for picker attachment. */
  documentHost?: Document | null
  /** Electron target-app guest picker. Preferred in the product UI. */
  pickFromPreview?: () => Promise<SelectionEvidence | null>
  disabled?: boolean
  onEvidenceReady?: (evidence: SelectionEvidence) => void
  onCancel?: () => void
}

export function PreviewBindingPicker({
  documentHost,
  pickFromPreview,
  disabled,
  onEvidenceReady,
  onCancel,
}: Props) {
  const [picking, setPicking] = useState(false)
  const [pending, setPending] = useState<SelectionEvidence | null>(null)
  const [proposedTarget, setProposedTarget] = useState('')
  const [error, setError] = useState<string | null>(null)
  const sessionRef = useRef<PickerSession | null>(null)

  const stopSession = () => {
    sessionRef.current?.cleanup()
    sessionRef.current = null
    setPicking(false)
  }

  useEffect(() => () => stopSession(), [])

  const acceptEvidence = (evidence: SelectionEvidence) => {
    if (requiresSourceTargetConfirmation(evidence)) {
      setPending(evidence)
      setProposedTarget(evidence.selector)
      setError('Unmarked element — confirm the proposed source target before continuing.')
      return
    }
    onEvidenceReady?.(evidence)
  }

  const startPick = async () => {
    if (disabled) return
    stopSession()
    setPending(null)
    setError(null)
    setProposedTarget('')
    setPicking(true)
    if (pickFromPreview) {
      try {
        const evidence = await pickFromPreview()
        setPicking(false)
        if (!evidence) {
          onCancel?.()
          return
        }
        acceptEvidence(evidence)
      } catch (cause) {
        setPicking(false)
        setError(cause instanceof Error ? cause.message : String(cause))
      }
      return
    }

    // Test/embedded-document path. Never silently attach to the Engineering
    // UI Kit host document: production selection must target the app preview.
    const host = documentHost ?? null
    if (!host) {
      setPicking(false)
      setError('Start the target-app Preview before selecting an element.')
      return
    }
    sessionRef.current = attachPreviewPicker(host, {
      onPicked: (evidence) => {
        sessionRef.current = null
        setPicking(false)
        acceptEvidence(evidence)
      },
      onCancel: () => {
        sessionRef.current = null
        setPicking(false)
        setPending(null)
        onCancel?.()
      },
    })
  }

  const cancelPick = () => {
    sessionRef.current?.cancel()
    sessionRef.current = null
    setPicking(false)
    setPending(null)
    setError(null)
    onCancel?.()
  }

  const confirmPending = () => {
    if (!pending) return
    const confirmed = confirmSourceTarget(pending, proposedTarget.trim() || pending.selector)
    if (!canProceedWithSelection(confirmed)) {
      setError('Confirmation is required for unmarked elements.')
      return
    }
    setPending(null)
    setError(null)
    onEvidenceReady?.(confirmed)
  }

  return (
    <div className="preview-binding-picker" aria-label="Preview binding picker">
      <div className="hstack" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={picking ? 'btn btn-primary' : 'btn btn-secondary'}
          disabled={disabled || picking}
          onClick={() => void startPick()}
        >
          {picking ? 'Click an element…' : 'Select preview element'}
        </button>
        {picking ? (
          <button type="button" className="btn btn-secondary" onClick={cancelPick}>
            Cancel
          </button>
        ) : null}
      </div>
      {picking ? (
        <p role="status">Hover and click a component. Escape cancels. Navigation/reload cancels.</p>
      ) : null}
      {error ? (
        <p role="alert" className="capabilities-note">
          {error}
        </p>
      ) : null}
      {pending ? (
        <div className="preview-binding-confirm" role="group" aria-label="Confirm source target">
          <p>
            Selected <code>{pending.selector}</code> ({pending.elementTag}) has no stable marker
            (<code>data-cap-id</code> / <code>data-testid</code>).
          </p>
          <label>
            Proposed source target
            <input
              type="text"
              value={proposedTarget}
              onChange={(e) => setProposedTarget(e.target.value)}
              aria-label="Proposed source target"
            />
          </label>
          <label className="hstack" style={{ gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={pending.sourceTargetConfirmed === true}
              onChange={(e) => {
                setPending({
                  ...pending,
                  sourceTargetConfirmed: e.target.checked,
                  proposedSourceTarget: proposedTarget.trim() || pending.selector,
                })
              }}
              aria-label="Confirm proposed source target"
            />
            I confirm this source target
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!pending.sourceTargetConfirmed}
            onClick={confirmPending}
          >
            Continue with confirmation
          </button>
        </div>
      ) : null}
    </div>
  )
}
