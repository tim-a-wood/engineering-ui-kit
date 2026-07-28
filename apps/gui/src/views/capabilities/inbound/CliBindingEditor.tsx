/**
 * CLI inbound-binding editor (CAP-CONTRACT-028 `cli` variant, CAP-ERA-001 §12.4).
 * Surfaces only the command name; every behavior field is pre-filled.
 */

import { useState, type ChangeEvent } from 'react'
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

  function changeCommand(event: ChangeEvent<HTMLInputElement>) {
    setBinding((prev) => ({ ...prev, command: event.target.value }))
  }

  return (
    <InboundBindingShell bridge={bridge} projectId={projectId} binding={binding} setBinding={setBinding} operations={operations} onSaved={onSaved}>
      <div className="cap-connect-field">
        <label htmlFor="cap-cli-command">Command</label>
        <input
          id="cap-cli-command"
          aria-label="Command"
          className="mono"
          value={binding.command}
          placeholder="orders approve"
          onChange={changeCommand}
        />
        <span>The command a person or script runs to trigger this capability.</span>
      </div>
    </InboundBindingShell>
  )
}
