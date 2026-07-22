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
import { Dialog, EmptyState } from '../../components'
import { Icon } from '../../icons'
import { freshnessLabel, moduleTypeLabel, sanitizeGuidedMessage } from './capabilityPresentation'

type Props = {
  bridge: EuikBridge
  projectId: string
  projection: 'guided' | 'design'
  records: CapabilityModuleRecord[]
  onVerified: () => void | Promise<void>
  onOpenModules?: () => void
}

const OUTCOME_LABEL: Record<string, string> = {
  passed: 'Passed',
  'failed-setup': 'Setup failure',
  'failed-domain': 'Behavioral failure (domain)',
  'failed-technical': 'Technical failure',
  cancelled: 'Cancelled',
  unverified: 'Unverified',
}

export function VerificationPanel({ bridge, projectId, projection, records, onVerified, onOpenModules }: Props) {
  const approved = useMemo(() => records.filter((r) => r.approved), [records])
  const [moduleId, setModuleId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<RunModuleVerificationResult | undefined>()
  const [technicalOpen, setTechnicalOpen] = useState(false)

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
        projection === 'guided' && next.eligibleForReady
          ? 'Verification passed. This module can be marked ready.'
          : projection === 'guided'
            ? `Verification needs attention: ${OUTCOME_LABEL[next.record.outcome] ?? 'the checks did not pass'}.`
            : next.eligibleForReady
          ? `Verification ${next.record.verificationId} passed — eligible for ready.`
          : `Verification ${next.record.verificationId} outcome ${next.record.outcome} — not eligible for ready.`,
      )
      await onVerified()
    } catch (error) {
      setMessage(projection === 'guided'
        ? sanitizeGuidedMessage(error instanceof Error ? error.message : String(error))
        : error instanceof Error ? error.message : String(error))
      setResult(undefined)
    } finally {
      setBusy(false)
    }
  }

  const outcome = result?.record.outcome
  const isSetupFailure = outcome === 'failed-setup'
  const resultNeedsRepair = Boolean(result && !result.eligibleForReady)
  const selectedReady = freshness?.primaryState === 'ready'

  return (
    <div className="capabilities-verification" role="region" aria-label="Module verification">
      <div className="cap-module-verification-head">
        <div>
          <p className="capabilities-eyebrow">Module checks</p>
          <h3>{projection === 'guided' ? 'Verify each module' : 'Module verification'}</h3>
          <p>{projection === 'guided'
            ? 'Choose a module and run its real checks. A module is ready only when every required check passes.'
            : 'Run configured checks for approved modules and inspect the exact inputs, commands, and recorded outcomes.'}</p>
        </div>
        {selectedReady ? <span className="badge approved">Selected module ready</span> : null}
      </div>

      {approved.length === 0 ? (
        <div role="status">
          <EmptyState
            icon={Icon.listChecks(24)}
            title="No approved modules yet"
            hint="Approve at least one module, then return here to run its configured checks."
            action={projection === 'design' && onOpenModules ? (
              <button type="button" className="btn btn-primary btn-compact" onClick={onOpenModules}>
                Open Modules {Icon.arrowRight(14)}
              </button>
            ) : undefined}
          />
        </div>
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
                  {r.approved?.name ?? r.moduleId} ({r.approved ? moduleTypeLabel(r.approved.moduleType) : 'Module'})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={`btn ${projection === 'guided' && (selectedReady || resultNeedsRepair) ? 'btn-secondary' : 'btn-primary'} btn-compact`}
            disabled={busy || !projectId || !moduleId}
            onClick={() => void runVerification()}
          >
            {busy ? 'Running…' : projection === 'guided' ? selectedReady ? 'Run again' : 'Run verification' : 'Verify approved module'}
          </button>
        </div>
      )}

      {selectedManifest && projection === 'design' ? (
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
          Current status: <strong>{projection === 'guided' ? freshnessLabel(freshness.primaryState) : freshness.primaryState}</strong>
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
          <dl className={projection === 'design' ? 'capabilities-ids' : 'cap-verification-summary'}>
            {projection === 'design' ? <div>
              <dt>Verification ID</dt><dd><code>{result.record.verificationId}</code></dd>
            </div> : null}
            <div>
              <dt>Outcome</dt>
              <dd>{OUTCOME_LABEL[result.record.outcome] ?? result.record.outcome}</dd>
            </div>
            <div>
              <dt>{projection === 'guided' ? 'Module readiness' : 'Eligible for ready'}</dt>
              <dd>{projection === 'guided' ? result.eligibleForReady ? 'Ready' : 'Needs attention' : result.eligibleForReady ? 'yes' : 'no'}</dd>
            </div>
          </dl>

          {projection === 'design' ? <section aria-label="Commands">
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
          </section> : null}

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

          {result.repairContext && projection === 'design' ? (
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
          {projection === 'guided' ? (
            <div className="cap-verification-result-actions">
              {resultNeedsRepair && onOpenModules ? (
                <button type="button" className="btn btn-primary btn-compact" onClick={onOpenModules}>Return to Build</button>
              ) : null}
              <button type="button" className="btn btn-secondary btn-compact" onClick={() => setTechnicalOpen(true)}>Technical specification</button>
            </div>
          ) : null}
        </section>
      ) : null}

      {technicalOpen && result ? (
        <Dialog title="Verification technical specification" wide onClose={() => setTechnicalOpen(false)} actions={<button type="button" className="btn btn-primary" onClick={() => setTechnicalOpen(false)}>Close</button>}>
          <dl className="capabilities-ids">
            <div><dt>Verification ID</dt><dd><code>{result.record.verificationId}</code></dd></div>
            <div><dt>Outcome</dt><dd>{result.record.outcome}</dd></div>
            <div><dt>Suites</dt><dd>{result.record.suiteIds.join(', ') || '—'}</dd></div>
            <div><dt>Input hashes</dt><dd>{Object.entries(result.record.inputHashes).map(([key, value]) => `${key}=${value}`).join('; ') || '—'}</dd></div>
            <div><dt>Evidence references</dt><dd>{result.record.artifacts.join(', ') || '—'}</dd></div>
            <div><dt>Diagnostics</dt><dd>{result.record.diagnostics.map((diagnostic) => diagnostic.message).join('; ') || '—'}</dd></div>
          </dl>
          <section aria-label="Verification commands"><h3>Commands</h3>{result.record.commandResults.length ? <ul>{result.record.commandResults.map((command, index) => <li key={`${command.label}-${index}`}><code>{command.label}</code> — {command.passed ? 'passed' : `failed (exit ${command.exitCode})`}{command.outputSummary ? ` — ${command.outputSummary}` : ''}</li>)}</ul> : <p>No commands recorded.</p>}</section>
          {result.repairContext ? <section aria-label="Repair details"><h3>Repair details</h3><pre>{JSON.stringify(result.repairContext, null, 2)}</pre></section> : null}
        </Dialog>
      ) : null}
    </div>
  )
}
