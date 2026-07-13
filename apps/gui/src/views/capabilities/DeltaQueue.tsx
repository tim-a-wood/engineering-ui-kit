/**
 * Delta impact queue (CAP-PKT-016).
 *
 * Review affected/unaffected modules, approve an impact, then process the ordered delta
 * queue one target at a time: export the next packet, verify the target, and mark it complete.
 * Only the next actionable target is ever exportable; application-wide regeneration is never offered.
 */

import { useEffect, useState } from 'react'
import type { DeltaQueueState, ImpactRecord } from '@engineering-ui-kit/core'
import type { EuikBridge } from '../../bridge'

type Props = {
  bridge: EuikBridge
  projectId: string
  projection: 'guided' | 'design'
}

export function DeltaQueue({ bridge, projectId, projection }: Props) {
  const [impacts, setImpacts] = useState<ImpactRecord[]>([])
  const [changeId, setChangeId] = useState('')
  const [queue, setQueue] = useState<DeltaQueueState | undefined>()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  const impact = impacts.find((i) => i.changeId === changeId)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    void bridge.capabilitiesListImpacts(projectId).then((list) => {
      if (cancelled) return
      setImpacts(list)
      if (list.length && !list.some((i) => i.changeId === changeId)) {
        setChangeId(list[0]!.changeId)
      }
    })
    return () => {
      cancelled = true
    }
  }, [bridge, projectId])

  useEffect(() => {
    if (!projectId || !changeId) {
      setQueue(undefined)
      return
    }
    let cancelled = false
    void bridge
      .capabilitiesDeltaQueueState({ projectId, changeId })
      .then((q) => !cancelled && setQueue(q))
      .catch(() => !cancelled && setQueue(undefined))
    return () => {
      cancelled = true
    }
  }, [bridge, projectId, changeId])

  async function refreshQueue() {
    if (!projectId || !changeId) return
    setQueue(await bridge.capabilitiesDeltaQueueState({ projectId, changeId }))
  }

  async function exportNext() {
    if (!queue?.nextTarget) return
    setBusy(true)
    setStatus('')
    try {
      const result = await bridge.capabilitiesExportDeltaPacket({
        projectId,
        changeId,
        targetId: queue.nextTarget,
      })
      setStatus(
        `Exported delta packet ${result.packetId} (${result.uploadFiles.length} files) for ${queue.nextTarget}.`,
      )
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function verifyAndComplete() {
    if (!queue?.nextTarget) return
    const target = queue.nextTarget
    setBusy(true)
    setStatus('')
    try {
      const verification = await bridge.capabilitiesVerifyApprovedModule({
        projectId,
        moduleId: target,
        explicit: true,
      })
      if (!verification.eligibleForReady) {
        setStatus(
          `Verification for ${target} did not pass (${verification.record.outcome}); target not completed.`,
        )
        return
      }
      const next = await bridge.capabilitiesMarkDeltaTargetComplete({
        projectId,
        changeId,
        targetId: target,
        verificationId: verification.record.verificationId,
        explicit: true,
      })
      setQueue(next)
      setStatus(
        next.done
          ? `Delta queue complete — all ${next.completedTargets.length} targets processed.`
          : `Completed ${target}; next target is ${next.nextTarget}.`,
      )
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
      await refreshQueue()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="capabilities-delta-queue" role="region" aria-label="Delta queue">
      <p className="lede">
        {projection === 'guided'
          ? 'Process the approved change one module at a time. Each target is verified before the next unlocks.'
          : 'Deterministic provider-first ordering; only the next actionable target can export a bounded delta packet.'}
      </p>

      {impacts.length === 0 ? (
        <p className="capabilities-note" role="status">
          No approved impacts yet. Calculate and approve an impact to start a delta queue.
        </p>
      ) : (
        <label>
          Approved impact
          <select
            value={changeId}
            aria-label="Approved impact"
            onChange={(e) => setChangeId(e.target.value)}
          >
            {impacts.map((i) => (
              <option key={i.changeId} value={i.changeId}>
                {i.changeId} ({i.classification})
              </option>
            ))}
          </select>
        </label>
      )}

      {impact ? (
        <div className="capabilities-impact-explanations">
          <section aria-label="Affected modules">
            <h3>Affected modules</h3>
            <ul>
              {impact.affectedModules.map((m) => (
                <li key={m.moduleId}>
                  <code>{m.moduleId}</code> — {m.reason}
                </li>
              ))}
            </ul>
          </section>
          <section aria-label="Unaffected modules">
            <h3>Unaffected modules</h3>
            {impact.unaffectedModules.length === 0 ? (
              <p className="capabilities-note">None.</p>
            ) : (
              <ul>
                {impact.unaffectedModules.map((m) => (
                  <li key={m.moduleId}>
                    <code>{m.moduleId}</code> — {m.reason}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {queue ? (
        <section aria-label="Queue state">
          <h3>Queue</h3>
          <ol className="capabilities-delta-order">
            {queue.order.map((target) => {
              const done = queue.completedTargets.includes(target)
              const isNext = queue.nextTarget === target
              const state = done ? 'complete' : isNext ? 'actionable' : 'blocked'
              return (
                <li key={target} data-state={state} aria-current={isNext ? 'step' : undefined}>
                  <code>{target}</code> — <span>{done ? '✓ complete' : isNext ? '→ next' : '· blocked'}</span>
                </li>
              )
            })}
          </ol>

          {queue.done ? (
            <p role="status">Queue exhausted — every approved target has been processed.</p>
          ) : (
            <div className="capabilities-toolbar" role="group" aria-label="Delta actions">
              <button type="button" disabled={busy} onClick={() => void exportNext()}>
                Export delta packet for {queue.nextTarget}
              </button>
              <button type="button" disabled={busy} onClick={() => void verifyAndComplete()}>
                Verify &amp; complete {queue.nextTarget}
              </button>
            </div>
          )}
        </section>
      ) : null}

      {status ? <p role="status">{status}</p> : null}
    </div>
  )
}
