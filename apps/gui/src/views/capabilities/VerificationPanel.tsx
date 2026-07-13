/**
 * Module verification panel — real approved-module verification (CAP-PKT-014 / Packet 5).
 *
 * The renderer supplies only project ID, module ID, and explicit confirmation. The desktop
 * loads the approved manifest, computes every input hash, and executes the project's configured
 * verification commands. No injected outcomes, scenario pickers, or placeholder hashes exist here.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  selectVerificationSuites,
  type CapabilityModuleRecord,
  type RunModuleVerificationResult,
} from '@engineering-ui-kit/core/browser'
import type { EuikBridge } from '../../bridge'

type Props = {
  bridge: EuikBridge
  projectId: string
  projection: 'guided' | 'design'
  records: CapabilityModuleRecord[]
  onVerified: () => void | Promise<void>
}

const OUTCOME_LABEL: Record<string, string> = {
  passed: 'Passed',
  'failed-setup': 'Setup failure',
  'failed-domain': 'Behavioral failure (domain)',
  'failed-technical': 'Technical failure',
  cancelled: 'Cancelled',
  unverified: 'Unverified',
}

export function VerificationPanel({ bridge, projectId, projection, records, onVerified }: Props) {
  const approved = useMemo(() => records.filter((r) => r.approved), [records])
  const [moduleId, setModuleId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<RunModuleVerificationResult | undefined>()

  useEffect(() => {
    // Keep the selection valid as approved modules and freshness reload.
    if (approved.length === 0) {
      if (moduleId) setModuleId('')
      return
    }
    if (!approved.some((r) => r.moduleId === moduleId)) {
      setModuleId(approved[0]!.moduleId)
    }
  }, [approved, moduleId])

  const selected = approved.find((r) => r.moduleId === moduleId)
  const selectedManifest = selected?.approved
  const suites = selectedManifest
    ? selectVerificationSuites(selectedManifest.moduleType, selectedManifest)
    : []
  const freshness = selected?.freshness

  async function runVerification() {
    if (!projectId || !moduleId) {
      setMessage('Select an approved module first.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const next = await bridge.capabilitiesVerifyApprovedModule({
        projectId,
        moduleId,
        explicit: true,
      })
      setResult(next)
      setMessage(
        next.eligibleForReady
          ? `Verification ${next.record.verificationId} passed — eligible for ready.`
          : `Verification ${next.record.verificationId} outcome ${next.record.outcome} — not eligible for ready.`,
      )
      await onVerified()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
      setResult(undefined)
    } finally {
      setBusy(false)
    }
  }

  const outcome = result?.record.outcome
  const isSetupFailure = outcome === 'failed-setup'

  return (
    <div className="capabilities-verification" role="region" aria-label="Module verification">
      <p className="lede">
        {projection === 'guided'
          ? 'Verify an approved module. The desktop runs its configured checks and records provenance; ready stays gated on an exact pass.'
          : 'Desktop-computed input hashes and configured commands only. Renderer never supplies command outcomes.'}
      </p>

      {approved.length === 0 ? (
        <p className="capabilities-note" role="status">
          No approved modules yet. Approve a module before verification.
        </p>
      ) : (
        <div
          className="capabilities-verification-controls"
          role="group"
          aria-label="Verification controls"
        >
          <label>
            Approved module
            <select
              value={moduleId}
              aria-label="Approved module"
              onChange={(e) => setModuleId(e.target.value)}
            >
              {approved.map((r) => (
                <option key={r.moduleId} value={r.moduleId}>
                  {r.approved?.name ?? r.moduleId} ({r.approved?.moduleType})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busy || !projectId || !moduleId}
            onClick={() => void runVerification()}
          >
            {busy ? 'Running…' : 'Verify approved module'}
          </button>
        </div>
      )}

      {selectedManifest ? (
        <section aria-label="Selected suites">
          <h3>Suites for {selectedManifest.moduleType}</h3>
          <ul>
            {suites.map((id) => (
              <li key={id}>
                <code>{id}</code>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {freshness ? (
        <p className="capabilities-note" role="status">
          Current freshness: <strong>{freshness.primaryState}</strong>
        </p>
      ) : null}

      {message ? <p role="status">{message}</p> : null}

      {result ? (
        <section aria-label="Verification result">
          <h3>Result</h3>
          {isSetupFailure ? (
            <p className="capabilities-note" role="alert">
              Setup failure — the module's checks could not be prepared or executed. This is distinct
              from a technical or behavioral failure.
            </p>
          ) : null}
          <dl className="capabilities-ids">
            <div>
              <dt>Verification ID</dt>
              <dd>
                <code>{result.record.verificationId}</code>
              </dd>
            </div>
            <div>
              <dt>Outcome</dt>
              <dd>{OUTCOME_LABEL[result.record.outcome] ?? result.record.outcome}</dd>
            </div>
            <div>
              <dt>Eligible for ready</dt>
              <dd>{result.eligibleForReady ? 'yes' : 'no'}</dd>
            </div>
          </dl>

          <section aria-label="Commands">
            <h4>Commands</h4>
            {result.record.commandResults.length === 0 ? (
              <p className="capabilities-note">No commands recorded.</p>
            ) : (
              <ul>
                {result.record.commandResults.map((c, i) => (
                  <li key={`${c.label}-${i}`}>
                    <code>{c.label}</code> — {c.passed ? 'passed' : `failed (exit ${c.exitCode})`}
                    {c.outputSummary ? ` — ${c.outputSummary}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {projection === 'design' ? (
            <dl className="capabilities-ids">
              <div>
                <dt>Suites</dt>
                <dd>{result.record.suiteIds.join(', ') || '—'}</dd>
              </div>
              <div>
                <dt>Input hashes</dt>
                <dd>
                  {Object.entries(result.record.inputHashes)
                    .map(([k, v]) => `${k}=${v}`)
                    .join('; ') || '—'}
                </dd>
              </div>
              <div>
                <dt>Evidence references</dt>
                <dd>{result.record.artifacts.join(', ') || '—'}</dd>
              </div>
              <div>
                <dt>Diagnostics</dt>
                <dd>
                  {result.record.diagnostics.length === 0
                    ? '—'
                    : result.record.diagnostics.map((d) => d.message).join('; ')}
                </dd>
              </div>
            </dl>
          ) : null}

          {result.repairContext ? (
            <div className="capabilities-note" role="region" aria-label="Repair packet">
              <h4>Scoped repair packet</h4>
              {'setupAction' in result.repairContext ? (
                <p>Setup action required: {result.repairContext.setupAction}</p>
              ) : (
                <p>
                  Repair packet <code>{result.repairContext.packetId}</code> scoped to{' '}
                  <code>{result.repairContext.targetId}</code>
                </p>
              )}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
