/**
 * Embedded-library inbound-binding editor (CAP-CONTRACT-028 `embedded-library`
 * variant, CAP-ERA-001 §12.4). This is the one kind that intentionally has no
 * externally reachable entry point at all, so an explicit reason is always
 * required — never inferred or defaulted.
 */

import { useState } from 'react'
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

  return (
    <InboundBindingShell bridge={bridge} projectId={projectId} binding={binding} setBinding={setBinding} operations={operations} onSaved={onSaved}>
      <div className="cap-connect-behaviors">
        <label className="cap-connect-field">
          Exported callable
          <input
            aria-label="Exported callable"
            className="mono"
            value={binding.exportedCallable}
            placeholder="approveOrder"
            onChange={(e) => setBinding((prev) => ({ ...prev, exportedCallable: e.target.value }))}
          />
          <span>The function or method other code in this app calls directly.</span>
        </label>
        <label className="cap-connect-field">
          Why is this only reachable as an embedded library?
          <textarea
            aria-label="Reason this is embedded-library only"
            value={binding.reason}
            placeholder="e.g. only ever invoked in-process by the batch job runner; never exposed externally"
            onChange={(e) => setBinding((prev) => ({ ...prev, reason: e.target.value }))}
            required
          />
        </label>
      </div>
    </InboundBindingShell>
  )
}
