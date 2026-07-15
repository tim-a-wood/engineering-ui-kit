/**
 * CLI inbound-binding editor (CAP-CONTRACT-028 `cli` variant, CAP-ERA-001 §12.4).
 * Surfaces only the command name; every behavior field is pre-filled.
 */

import { useState } from 'react'
import type { CliInboundBinding } from '@engineering-ui-kit/core'
import type { EuikBridge } from '../../../bridge'
import { InboundBindingShell } from './InboundBindingShell'

type Props = {
  bridge: EuikBridge
  projectId: string
  operations: { operationId: string; operationVersion: string }[]
  initial: CliInboundBinding
  onSaved: () => void
}

export function CliBindingEditor({ bridge, projectId, operations, initial, onSaved }: Props) {
  const [binding, setBinding] = useState<CliInboundBinding>(initial)

  return (
    <InboundBindingShell bridge={bridge} projectId={projectId} binding={binding} setBinding={setBinding} operations={operations} onSaved={onSaved}>
      <label className="cap-connect-field">
        Command
        <input
          aria-label="Command"
          className="mono"
          value={binding.command}
          placeholder="orders approve"
          onChange={(e) => setBinding((prev) => ({ ...prev, command: e.target.value }))}
        />
        <span>The command a person or script runs to trigger this capability.</span>
      </label>
    </InboundBindingShell>
  )
}
