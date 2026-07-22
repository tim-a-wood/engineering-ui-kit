/**
 * "Decide later" panel (CAP-ERA-001 §5.4/§12.4). Deferring never completes or
 * completes Build — the affected deployable stays visibly incomplete in Needs
 * attention until a real entry point is configured and approved.
 */

import { useState } from 'react'
import type { EuikBridge } from '../../../bridge'

type Props = {
  bridge: EuikBridge
  projectId: string
  onDeferred: () => void
}

export function DeferredEditor({ bridge, projectId, onDeferred }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function deferEntryPoint() {
    setBusy(true)
    setError('')
    try {
      await bridge.updateProject(projectId, { capabilitiesConnectDisposition: 'deferred' })
      onDeferred()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cap-connect-deferred" role="group" aria-label="Decide the entry point later">
      <p>
        You can continue without configuring this entry point now. It stays visible in{' '}
        <strong>Needs attention</strong> until you come back and configure a real entry point. Build cannot finish
        until every required application part is ready.
      </p>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <button type="button" className="btn btn-secondary btn-compact" disabled={busy} onClick={() => void deferEntryPoint()}>
        Decide later
      </button>
    </div>
  )
}
