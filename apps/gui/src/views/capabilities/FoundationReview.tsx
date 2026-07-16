/**
 * Foundation plan review (WP5A — CAP-TEST-074/075).
 *
 * Renders ONE canonical `FoundationPlan` — the proposed deployables, the
 * module→deployable allocation rationale, and any unresolved ambiguity
 * questions — identically from Guided and Design (bullet f: both projections
 * show the same records; only copy/detail density differs). Answering a
 * question re-derives the plan through the same pure `proposeFoundation`
 * core function and persists the draft; approval is only possible once
 * `readiness.status === 'ready'` (bullet d backing: `foundationHandoffGate`
 * only enables the downstream Build handoff once an approved, non-stale
 * foundation exists).
 */

import { useState } from 'react'
import type { ArchitectureSpecification, FoundationPlan } from '@engineering-ui-kit/core'
import { foundationHandoffGate } from '@engineering-ui-kit/core/browser'
import type { EuikBridge } from '../../bridge'
import { humanizeIdentifier } from './capabilityPresentation'

type Props = {
  bridge: EuikBridge
  projectId: string
  /** The current draft (preferred) or approved plan to review — undefined until first proposed. */
  plan: FoundationPlan | undefined
  approvedFoundation: FoundationPlan | undefined
  approvedArchitecture: ArchitectureSpecification
  projection: 'guided' | 'design'
  /** Called after any persisted mutation (propose/answer/approve) so the parent can refetch canonical state. */
  onChanged?: () => void
}

export function FoundationReview({
  bridge,
  projectId,
  plan,
  approvedFoundation,
  approvedArchitecture,
  projection,
  onChanged,
}: Props) {
  const guided = projection === 'guided'
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedChoices, setSelectedChoices] = useState<Record<string, string>>({})

  async function proposeInitial() {
    setBusy(true)
    setMessage('')
    try {
      const proposed = await bridge.capabilitiesProposeFoundation({ projectId })
      await bridge.capabilitiesSaveFoundationDraft(projectId, proposed)
      setMessage(
        guided
          ? ''
          : `Proposed ${proposed.deployables.length} deployable(s); readiness ${proposed.readiness.status}.`,
      )
      onChanged?.()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function answerAmbiguity(id: string) {
    if (!plan) return
    const choice = selectedChoices[id]
    if (!choice) return
    setBusy(true)
    setMessage('')
    try {
      const nextAnswers = [...plan.resolvedAnswers.filter((answer) => answer.id !== id), { id, choice }]
      const reproposed = await bridge.capabilitiesProposeFoundation({ projectId, answers: nextAnswers })
      await bridge.capabilitiesSaveFoundationDraft(projectId, reproposed)
      setMessage(guided ? '' : 'Answer recorded; foundation re-proposed.')
      onChanged?.()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function approve() {
    if (!plan || plan.readiness.status !== 'ready') return
    setBusy(true)
    setMessage('')
    try {
      const result = await bridge.capabilitiesApproveFoundation(projectId, plan)
      if (!result.ok) {
        setMessage(result.reason ?? 'Foundation approval blocked.')
        return
      }
      setMessage(guided ? 'Foundation approved.' : `Approved foundation plan ${plan.contentHash.slice(0, 12)}…`)
      onChanged?.()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const gate = approvedFoundation
    ? foundationHandoffGate({ approvedFoundation, approvedArchitecture })
    : { enabled: false, reason: 'No approved foundation plan exists for this project.' }

  return (
    <section className="capabilities-foundation-review" role="region" aria-label="Foundation plan">
      <h3>Foundation plan</h3>
      <p className="lede">
        {guided
          ? 'Review the proposed deployables and where each module runs, resolve any open questions, then approve.'
          : 'Review the proposed deployable topology, module allocation rationale, and ambiguity resolution before approving the foundation.'}
      </p>

      {!plan ? (
        <>
          <p role="status">No foundation plan proposed yet.</p>
          <button
            type="button"
            className="btn btn-primary btn-compact"
            onClick={() => void proposeInitial()}
            disabled={busy || !projectId}
          >
            Propose foundation plan
          </button>
        </>
      ) : (
        <>
          <p role="status">{message || `Readiness: ${plan.readiness.status}.`}</p>

          <div aria-label="Proposed deployables">
            <h4>Deployables</h4>
            {plan.deployables.length === 0 ? (
              <p className="capabilities-note">No deployables proposed.</p>
            ) : (
              <ul className="cap-foundation-deployables">
                {plan.deployables.map((deployable) => (
                  <li key={deployable.deployableId}>
                    <strong>{deployable.name}</strong> ({deployable.kind}) — {deployable.runtimeLanguage}{' '}
                    {deployable.runtimeVersionRange} — <code>{deployable.compositionRootPath}</code>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div aria-label="Module allocations">
            <h4>Module allocations</h4>
            {plan.allocations.length === 0 ? (
              <p className="capabilities-note">No modules allocated.</p>
            ) : (
              <ul className="cap-foundation-allocations">
                {plan.allocations.map((allocation) => (
                  <li key={`${allocation.moduleId}::${allocation.deployableId}`}>
                    {guided ? humanizeIdentifier(allocation.moduleId) : allocation.moduleId} →{' '}
                    {allocation.deployableId}
                    <span className="capabilities-note"> — {allocation.rationale}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {plan.unresolvedAmbiguities.length > 0 ? (
            <div aria-label="Open foundation questions" role="group">
              <h4>Open questions</h4>
              {plan.unresolvedAmbiguities.map((ambiguity) => (
                <div key={ambiguity.id} className="cap-foundation-ambiguity">
                  <label htmlFor={`foundation-ambiguity-${ambiguity.id}`}>{ambiguity.question}</label>
                  <select
                    id={`foundation-ambiguity-${ambiguity.id}`}
                    value={selectedChoices[ambiguity.id] ?? ''}
                    onChange={(event) =>
                      setSelectedChoices((prev) => ({ ...prev, [ambiguity.id]: event.target.value }))
                    }
                  >
                    <option value="">Select…</option>
                    {ambiguity.choices.map((choice) => (
                      <option key={choice} value={choice}>
                        {choice}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-secondary btn-compact"
                    onClick={() => void answerAmbiguity(ambiguity.id)}
                    disabled={busy || !selectedChoices[ambiguity.id]}
                  >
                    Answer
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="capabilities-toolbar" role="group" aria-label="Foundation actions">
            <button
              type="button"
              className="btn btn-primary btn-compact"
              onClick={() => void approve()}
              disabled={busy || plan.readiness.status !== 'ready'}
            >
              Approve foundation
            </button>
          </div>

          {projection === 'design' ? (
            <p className="capabilities-note" role="status">
              Build handoff gate: {gate.enabled ? 'enabled' : `blocked — ${gate.reason}`}
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}
