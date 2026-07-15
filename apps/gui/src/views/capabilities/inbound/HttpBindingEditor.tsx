/**
 * HTTP inbound-binding editor (CAP-CONTRACT-028 `http` variant, CAP-ERA-001 §12.4).
 * Surfaces only the fields that are genuinely ambiguous — method and path;
 * every behavior field is pre-filled with a sensible default.
 */

import { useState } from 'react'
import { HTTP_METHODS } from '@engineering-ui-kit/core/browser'
import type { HttpInboundBinding } from '@engineering-ui-kit/core'
import type { EuikBridge } from '../../../bridge'
import { InboundBindingShell } from './InboundBindingShell'

type Props = {
  bridge: EuikBridge
  projectId: string
  operations: { operationId: string; operationVersion: string }[]
  initial: HttpInboundBinding
  onSaved: () => void
}

export function HttpBindingEditor({ bridge, projectId, operations, initial, onSaved }: Props) {
  const [binding, setBinding] = useState<HttpInboundBinding>(initial)

  return (
    <InboundBindingShell bridge={bridge} projectId={projectId} binding={binding} setBinding={setBinding} operations={operations} onSaved={onSaved}>
      <div className="cap-connect-behaviors">
        <label className="cap-connect-field">
          Method
          <select
            aria-label="HTTP method"
            value={binding.method}
            onChange={(e) => setBinding((prev) => ({ ...prev, method: e.target.value as HttpInboundBinding['method'] }))}
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="cap-connect-field">
          Path
          <input
            aria-label="HTTP path"
            className="mono"
            value={binding.path}
            placeholder="/orders/:id/approve"
            onChange={(e) => setBinding((prev) => ({ ...prev, path: e.target.value }))}
          />
        </label>
      </div>
    </InboundBindingShell>
  )
}
