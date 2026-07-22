import { useState } from 'react'
import type { CapabilityIntegrationState, InboundBinding } from '@engineering-ui-kit/core'
import type { EuikBridge, InboundBindingReadRecord } from '../../bridge'
import { Dialog } from '../../components'
import { humanizeIdentifier, sanitizeGuidedMessage } from './capabilityPresentation'
import { triggerLabel } from './inbound/inboundBinding'

type Props = {
  bridge: EuikBridge
  projectId: string
  bindings: InboundBindingReadRecord[]
  integrationState: CapabilityIntegrationState
  projection: 'guided' | 'design'
  onChanged: () => void | Promise<void>
}

function evidenceLabel(status: string): string {
  switch (status) {
    case 'pass': return 'Passed'
    case 'fail': return 'Needs attention'
    case 'stale': return 'Needs refresh'
    default: return 'Not yet verified'
  }
}

export function ConnectionVerificationPanel(props: Props) {
  const [busyBinding, setBusyBinding] = useState('')
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [technicalBindingId, setTechnicalBindingId] = useState('')
  const design = props.projection === 'design'
  const bindings = props.bindings.map((record) => record.approved)
    .filter((binding): binding is InboundBinding => Boolean(binding))
  const rows = bindings.map((binding) => {
    const deployable = props.integrationState.deployables.find((item) => item.deployableId === binding.deployableId)
    const evidence = [...(deployable?.connectionVerifications ?? [])]
      .filter((record) => record.bindingId === binding.bindingId)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0]
    const evidenceCurrent = Boolean(evidence && deployable?.currentConnectionVerificationIds.includes(evidence.verificationId))
    const ready = deployable?.status === 'applied'
    const displayStatus = evidenceCurrent ? evidence?.verificationStatus ?? 'unverified' : evidence ? 'stale' : 'unverified'
    return { binding, deployable, evidence, evidenceCurrent, ready, displayStatus }
  })
  const passedCount = rows.filter((row) => row.displayStatus === 'pass').length
  const technicalRow = rows.find((row) => row.binding.bindingId === technicalBindingId)

  async function verify(binding: InboundBinding) {
    setBusyBinding(binding.bindingId)
    setMessages((current) => ({ ...current, [binding.bindingId]: '' }))
    try {
      const record = await props.bridge.capabilitiesRunConnectionVerification({
        projectId: props.projectId,
        deployableId: binding.deployableId,
        bindingId: binding.bindingId,
        explicit: true,
      })
      setMessages((current) => ({
        ...current,
        [binding.bindingId]: record.verificationStatus === 'pass'
          ? 'The real target launched and the configured execution path was observed.'
          : `Verification ${record.verificationStatus}: ${record.outcomeSummary}`,
      }))
      await props.onChanged()
    } catch (error) {
      setMessages((current) => ({
        ...current, [binding.bindingId]: design
          ? error instanceof Error ? error.message : String(error)
          : sanitizeGuidedMessage(error instanceof Error ? error.message : String(error)),
      }))
    } finally {
      setBusyBinding('')
    }
  }

  return (
    <section className="cap-connection-verification" aria-label="Live entry-point verification">
      <div className="cap-verify-overview">
        <div className="cap-verify-overview-copy">
          <p className="capabilities-eyebrow">Live evidence</p>
          <h3>Application entry points</h3>
          <p>
            {rows.length === 0
              ? 'Configure an entry point in Build before running the live checks.'
              : passedCount === rows.length
                ? 'Every configured entry point has reached its intended capability through the real application.'
                : 'Run each configured entry point and confirm it reaches the intended capability through the real application.'}
          </p>
        </div>
        {rows.length ? (
          <div className={`cap-verify-score${passedCount === rows.length ? ' complete' : ''}`} role="status" aria-label={`${passedCount} of ${rows.length} entry points verified`}>
            <strong>{passedCount}/{rows.length}</strong>
            <span>verified</span>
          </div>
        ) : null}
      </div>
      {bindings.length === 0 ? (
        <p className="capabilities-note" role="status">Approve at least one application entry point in Build before running verification.</p>
      ) : (
        <div className="cap-verification-grid">
          {rows.map(({ binding, evidence, evidenceCurrent, ready, displayStatus }) => {
            const operationName = humanizeIdentifier(binding.operationId)
            return (
              <article key={binding.bindingId} className="panel-raised cap-verification-card">
                <header>
                  <div>
                    <span className="capabilities-eyebrow">{triggerLabel(binding.kind)}</span>
                    <h4>{design ? binding.bindingId : operationName}</h4>
                    {design
                      ? <p><code>{binding.operationId}@{binding.operationVersion}</code> on <strong>{binding.deployableId}</strong></p>
                      : <p>{displayStatus === 'pass'
                        ? `Confirmed through the real application: ${operationName}.`
                        : displayStatus === 'stale'
                          ? 'This check is out of date after a recent change. Run it again.'
                          : displayStatus === 'fail'
                            ? 'The real application path did not reach the expected capability.'
                            : 'Run the real application path once to capture evidence.'}</p>}
                  </div>
                  <span className={`badge ${displayStatus}`}>{design ? displayStatus : evidenceLabel(displayStatus)}</span>
                </header>
                {!ready ? <p className="capabilities-note">Generate and apply the current deployable plan before verification.</p> : null}
                {evidence ? (
                  <div className="cap-verification-evidence">
                    {!evidenceCurrent ? <p className="capabilities-note">This evidence is stale because an approved input or generated source changed.</p> : null}
                    {design ? <p>{evidence.outcomeSummary}</p> : null}
                    {design ? <dl>
                      <div><dt>Health</dt><dd>{evidence.healthState}</dd></div>
                      <div><dt>Evidence</dt><dd>{evidence.externalEvidenceStatus}</dd></div>
                      <div><dt>Duration</dt><dd>{evidence.durationMs} ms</dd></div>
                    </dl> : null}
                    {design ? (
                      <ol aria-label="Observed execution path">
                        <li>{evidence.observedPath.inboundAdapter}</li>
                        <li>{evidence.observedPath.compositionRoot}</li>
                        <li>{evidence.observedPath.operation}</li>
                        {evidence.observedPath.outboundAdapters.map((adapter) => <li key={adapter}>{adapter}</li>)}
                      </ol>
                    ) : (
                      <ol aria-label="Observed execution path">
                        <li>Application entry point</li>
                        <li>Shared application setup</li>
                        <li>{operationName}</li>
                        {evidence.observedPath.outboundAdapters.length ? <li>{evidence.observedPath.outboundAdapters.length} supporting application service{evidence.observedPath.outboundAdapters.length === 1 ? '' : 's'}</li> : null}
                      </ol>
                    )}
                    {design ? (
                      <details>
                        <summary>Evidence identifiers and hashes</summary>
                        <dl className="capabilities-ids">
                          <div><dt>Verification</dt><dd><code>{evidence.verificationId}</code></dd></div>
                          <div><dt>Correlation</dt><dd><code>{evidence.correlationId}</code></dd></div>
                          {Object.entries(evidence.hashes).map(([name, hash]) => <div key={name}><dt>{name}</dt><dd><code>{hash}</code></dd></div>)}
                        </dl>
                      </details>
                    ) : null}
                  </div>
                ) : null}
                <div className="cap-verification-actions">
                  <button type="button" className={`btn ${design ? 'btn-primary' : 'btn-secondary'} btn-compact`} disabled={!ready || Boolean(busyBinding)} onClick={() => void verify(binding)}>
                    {busyBinding === binding.bindingId ? 'Verifying…' : evidence ? 'Run again' : 'Run live check'}
                  </button>
                  {!design && evidence ? <button type="button" className="btn btn-ghost btn-compact" onClick={() => setTechnicalBindingId(binding.bindingId)}>Technical details</button> : null}
                </div>
                {messages[binding.bindingId] ? <p className="capabilities-note" role="status">{messages[binding.bindingId]}</p> : null}
              </article>
            )
          })}
        </div>
      )}
      {technicalRow?.evidence ? (
        <Dialog
          title={`${humanizeIdentifier(technicalRow.binding.operationId)} technical evidence`}
          wide
          onClose={() => setTechnicalBindingId('')}
          actions={<button type="button" className="btn btn-primary" onClick={() => setTechnicalBindingId('')}>Close</button>}
        >
          <p>{technicalRow.evidence.outcomeSummary}</p>
          <dl className="capabilities-ids">
            <div><dt>Verification</dt><dd><code>{technicalRow.evidence.verificationId}</code></dd></div>
            <div><dt>Correlation</dt><dd><code>{technicalRow.evidence.correlationId}</code></dd></div>
            <div><dt>Health</dt><dd>{technicalRow.evidence.healthState}</dd></div>
            <div><dt>External evidence</dt><dd>{technicalRow.evidence.externalEvidenceStatus}</dd></div>
            <div><dt>Duration</dt><dd>{technicalRow.evidence.durationMs} ms</dd></div>
          </dl>
          <section aria-label="Observed technical path">
            <h3>Observed execution path</h3>
            <ol>
              <li><code>{technicalRow.evidence.observedPath.inboundAdapter}</code></li>
              <li><code>{technicalRow.evidence.observedPath.compositionRoot}</code></li>
              <li><code>{technicalRow.evidence.observedPath.operation}</code></li>
              {technicalRow.evidence.observedPath.outboundAdapters.map((adapter) => <li key={adapter}><code>{adapter}</code></li>)}
            </ol>
          </section>
          <section aria-label="Evidence hashes">
            <h3>Evidence hashes</h3>
            <dl className="capabilities-ids">
              {Object.entries(technicalRow.evidence.hashes).map(([name, hash]) => <div key={name}><dt>{name}</dt><dd><code>{hash}</code></dd></div>)}
            </dl>
          </section>
        </Dialog>
      ) : null}
    </section>
  )
}
