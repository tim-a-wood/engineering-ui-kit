/**
 * Scheduled/background inbound-binding editor (CAP-CONTRACT-028 `schedule`
 * variant, CAP-ERA-001 §12.4). Surfaces the schedule itself (cron + timezone)
 * plus the overlap/misfire policy, since those genuinely need a decision;
 * every other behavior field is pre-filled.
 */

import { useState } from 'react'
import { MISFIRE_POLICIES, OVERLAP_POLICIES } from '@engineering-ui-kit/core/browser'
import type { ScheduleInboundBinding } from '@engineering-ui-kit/core'
import type { EuikBridge } from '../../../bridge'
import { InboundBindingShell } from './InboundBindingShell'

type Props = {
  bridge: EuikBridge
  projectId: string
  operations: { operationId: string; operationVersion: string }[]
  initial: ScheduleInboundBinding
  onSaved: () => void
}

const OVERLAP_LABELS: Record<ScheduleInboundBinding['overlapPolicy'], string> = {
  skip: 'Skip the new run if one is already in progress',
  queue: 'Queue the new run to start after the current one finishes',
  'allow-concurrent': 'Allow runs to overlap',
}

const MISFIRE_LABELS: Record<ScheduleInboundBinding['misfirePolicy'], string> = {
  'run-once': 'Run once when the schedule is next reachable',
  skip: 'Skip the missed run entirely',
  'run-all': 'Run every missed occurrence',
}

export function ScheduleBindingEditor({ bridge, projectId, operations, initial, onSaved }: Props) {
  const [binding, setBinding] = useState<ScheduleInboundBinding>(initial)

  return (
    <InboundBindingShell bridge={bridge} projectId={projectId} binding={binding} setBinding={setBinding} operations={operations} onSaved={onSaved}>
      <div className="cap-connect-behaviors">
        <label className="cap-connect-field">
          Schedule (cron expression)
          <input
            aria-label="Cron expression"
            className="mono"
            value={binding.cronExpression}
            placeholder="0 * * * *"
            onChange={(e) => setBinding((prev) => ({ ...prev, cronExpression: e.target.value }))}
          />
        </label>
        <label className="cap-connect-field">
          Timezone
          <input
            aria-label="Timezone"
            value={binding.timezone}
            placeholder="UTC"
            onChange={(e) => setBinding((prev) => ({ ...prev, timezone: e.target.value }))}
          />
        </label>
        <label className="cap-connect-field">
          If a run is already in progress
          <select
            aria-label="Overlap policy"
            value={binding.overlapPolicy}
            onChange={(e) => setBinding((prev) => ({ ...prev, overlapPolicy: e.target.value as ScheduleInboundBinding['overlapPolicy'] }))}
          >
            {OVERLAP_POLICIES.map((p) => (
              <option key={p} value={p}>{OVERLAP_LABELS[p]}</option>
            ))}
          </select>
        </label>
        <label className="cap-connect-field">
          If a run is missed
          <select
            aria-label="Misfire policy"
            value={binding.misfirePolicy}
            onChange={(e) => setBinding((prev) => ({ ...prev, misfirePolicy: e.target.value as ScheduleInboundBinding['misfirePolicy'] }))}
          >
            {MISFIRE_POLICIES.map((p) => (
              <option key={p} value={p}>{MISFIRE_LABELS[p]}</option>
            ))}
          </select>
        </label>
      </div>
    </InboundBindingShell>
  )
}
