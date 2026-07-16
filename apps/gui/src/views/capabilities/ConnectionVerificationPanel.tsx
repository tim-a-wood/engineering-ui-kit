import { useState } from 'react'
import type { CapabilityIntegrationState, InboundBinding } from '@engineering-ui-kit/core'
import type { EuikBridge, InboundBindingReadRecord } from '../../bridge'

type Props = {
  bridge: EuikBridge
  projectId: string
  bindings: InboundBindingReadRecord[]
  integrationState: CapabilityIntegrationState
  projection: 'guided' | 'design'
  onChanged: () => void | Promise<void>
}

export function ConnectionVerificationPanel(props: Props) {
  const [busyBinding, setBusyBinding] = useState('')
  const [messages, setMessages] = useState<Record<string, string>>({})
  const design = props.projection === 'design'
  const bindings = props.bindings.map((record) => record.approved)
    .filter((binding): binding is InboundBinding => Boolean(binding))

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
        ...current,
        [binding.bindingId]: error instanceof Error ? error.message : String(error),
      }))
    } finally {
      setBusyBinding('')
    }
  }

  return (
    <section className="cap-connection-verification" aria-label="Real connection verification">
      <div className="cap-stage-head">
        <div>
          <p className="capabilities-eyebrow">Live evidence</p>
          <h3>Verify generated connections</h3>
          <p className="lede">Launch each actual deployable and trigger its approved inbound adapter. Simulation never counts as passing evidence.</p>
        </div>
      </div>
      {bindings.length === 0 ? (
        <p className="capabilities-note" role="status">Approve at least one non-deferred entry point in Connect before running verification.</p>
      ) : (
        <div className="cap-verification-grid">
          {bindings.map((binding) => {
            const deployable = props.integrationState.deployables.find((item) => item.deployableId === binding.deployableId)
            const evidence = [...(deployable?.connectionVerifications ?? [])]
              .filter((record) => record.bindingId === binding.bindingId)
              .sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0]
            const evidenceCurrent = Boolean(evidence && deployable?.currentConnectionVerificationIds.includes(evidence.verificationId))
            const ready = deployable?.status === 'applied'
            return (
              <article key={binding.bindingId} className="panel-raised cap-verification-card">
                <header>
                  <div>
                    <span className="capabilities-eyebrow">{binding.kind} entry point</span>
                    <h4>{binding.bindingId}</h4>
                    <p><code>{binding.operationId}@{binding.operationVersion}</code> on <strong>{binding.deployableId}</strong></p>
                  </div>
                  <span className={`badge ${evidenceCurrent ? evidence?.verificationStatus : evidence ? 'stale' : 'unverified'}`}>{evidenceCurrent ? evidence?.verificationStatus : evidence ? 'stale' : 'unverified'}</span>
                </header>
                {!ready ? <p className="capabilities-note">Generate and apply the current deployable plan before verification.</p> : null}
                {evidence ? (
                  <div className="cap-verification-evidence">
                    {!evidenceCurrent ? <p className="capabilities-note">This evidence is stale because an approved input or generated source changed.</p> : null}
                    <p>{evidence.outcomeSummary}</p>
                    <dl>
                      <div><dt>Health</dt><dd>{evidence.healthState}</dd></div>
                      <div><dt>Evidence</dt><dd>{evidence.externalEvidenceStatus}</dd></div>
                      <div><dt>Duration</dt><dd>{evidence.durationMs} ms</dd></div>
                    </dl>
                    <ol aria-label="Observed execution path">
                      <li>{evidence.observedPath.inboundAdapter}</li>
                      <li>{evidence.observedPath.compositionRoot}</li>
                      <li>{evidence.observedPath.operation}</li>
                      {evidence.observedPath.outboundAdapters.map((adapter) => <li key={adapter}>{adapter}</li>)}
                    </ol>
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
                <button type="button" className="btn btn-primary btn-compact" disabled={!ready || Boolean(busyBinding)} onClick={() => void verify(binding)}>
                  {busyBinding === binding.bindingId ? 'Verifying…' : evidence ? 'Re-run real verification' : 'Run real verification'}
                </button>
                {messages[binding.bindingId] ? <p className="capabilities-note" role="status">{messages[binding.bindingId]}</p> : null}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
