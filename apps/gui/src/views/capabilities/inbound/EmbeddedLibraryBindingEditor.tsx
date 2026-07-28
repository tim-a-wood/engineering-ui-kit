/**
 * Embedded-library inbound-binding editor (CAP-CONTRACT-028 `embedded-library`
 * variant, CAP-ERA-001 §12.4). This is the one kind that intentionally has no
 * externally reachable entry point at all, so an explicit reason is always
 * required — never inferred or defaulted.
 */

import { useState, type ChangeEvent } from 'react'
import type { EmbeddedLibraryInboundBinding } from '@engineering-ui-kit/core'
import type { EuikBridge } from '../../../bridge'
import { InboundBindingShell } from './InboundBindingShell'

type Props = {
  bridge: EuikBridge
  projectId: string
  operations: { operationId: string; operationVersion: string }[]
  initial: EmbeddedLibraryInboundBinding
  onSaved: () => void
}

export function EmbeddedLibraryBindingEditor({ bridge, projectId, operations, initial, onSaved }: Props) {
  const [binding, setBinding] = useState<EmbeddedLibraryInboundBinding>(initial)

  function changeCallable(event: ChangeEvent<HTMLInputElement>) {
    setBinding((prev) => ({ ...prev, exportedCallable: event.target.value }))
  }

  function changeReason(event: ChangeEvent<HTMLTextAreaElement>) {
    setBinding((prev) => ({ ...prev, reason: event.target.value }))
  }

  return (
    <InboundBindingShell bridge={bridge} projectId={projectId} binding={binding} setBinding={setBinding} operations={operations} onSaved={onSaved}>
      <div className="cap-connect-behaviors">
        <div className="cap-connect-field">
          <label htmlFor="cap-exported-callable">Exported callable</label>
          <input
            id="cap-exported-callable"
            aria-label="Exported callable"
            className="mono"
            value={binding.exportedCallable}
            placeholder="approveOrder"
            onChange={changeCallable}
          />
          <span>The function or method other code in this app calls directly.</span>
        </div>
        <label className="cap-connect-field">
          Explain embedding
          <textarea
            aria-label="Explain embedding"
            value={binding.reason}
            placeholder="For example: used only by the batch runner. Not exposed."
            onChange={changeReason}
            required
          />
        </label>
      </div>
    </InboundBindingShell>
  )
}
