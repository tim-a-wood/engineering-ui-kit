/**
 * Application definition — product interview export/import/approve (CAP-PKT-008).
 */

import { useEffect, useState } from 'react'
import type {
  ApplicationSpecification,
  CapDiagnostic,
  FieldDelta,
  GateResult,
  InterviewPacket,
} from '@engineering-ui-kit/core'
import {
  buildProductInterviewPacket,
  diffApplicationSpecification,
  importProductInterviewResponse,
} from '@engineering-ui-kit/core/browser'
import type { EuikBridge, CapabilityPacketExportResult } from '../../bridge'
import { InterviewImport, type InterviewImportResult } from './InterviewImport'
import { CapabilityHandoffCard } from './CapabilityHandoffCard'
import { humanizeFieldPath, presentDiagnosticsForGuided } from './capabilityPresentation'

type Props = {
  bridge: EuikBridge
  projectId: string
  projection: 'guided' | 'design'
  onChanged?: () => void
  onHelp?: () => void
}

type GateLike = GateResult | { gateId?: string; passed?: boolean; diagnostics?: CapDiagnostic[] }

function asApp(value: unknown): ApplicationSpecification | undefined {
  if (!value || typeof value !== 'object') return undefined
  return value as ApplicationSpecification
}

function compactPreview(values: string[], limit = 2): string {
  if (values.length === 0) return 'None captured'
  const visible = values.slice(0, limit).join(' · ')
  return values.length > limit ? `${visible} · +${values.length - limit} more` : visible
}

function briefText(value: unknown): string {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  const record = value as Record<string, unknown>
  for (const key of ['text', 'name', 'description', 'expectedOutcome']) {
    if (typeof record[key] === 'string') return record[key]
  }
  return ''
}

export function ApplicationDefinition({ bridge, projectId, projection, onChanged, onHelp }: Props) {
  const guided = projection === 'guided'
  const [draft, setDraft] = useState<ApplicationSpecification | undefined>()
  const [approved, setApproved] = useState<ApplicationSpecification | undefined>()
  const [packet, setPacket] = useState<InterviewPacket | undefined>()
  const [exportResult, setExportResult] = useState<CapabilityPacketExportResult | undefined>()
  const [delta, setDelta] = useState<FieldDelta[]>([])
  const [diagnostics, setDiagnostics] = useState<CapDiagnostic[]>([])
  const [gate, setGate] = useState<GateLike | undefined>()
  const [fieldStates, setFieldStates] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    if (!projectId) return
    await bridge.capabilitiesEnsureInitialized(projectId)
    const app = await bridge.capabilitiesGetApplication(projectId)
    setDraft(asApp(app.draft))
    setApproved(asApp(app.approved))
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await refresh()
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : String(error))
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh on project change only
  }, [bridge, projectId])

  async function exportPacket() {
    setBusy(true)
    setMessage('')
    try {
      const currentDefinition = draft ?? approved
      const built = buildProductInterviewPacket({
        packetId: `pkt-product-${projectId}-${Date.now()}`,
        projectId,
        approved: currentDefinition,
        facts: currentDefinition
          ? [`currentApplicationSpecification:${JSON.stringify(currentDefinition)}`]
          : undefined,
      })
      const exported = await bridge.capabilitiesExportInterviewPacket({
        packetId: built.packetId,
        projectId: built.projectId,
        interviewKind: built.interviewKind,
        gateId: built.gateId,
        inputContext: built.inputContext,
        interviewBoundary: built.interviewBoundary,
        stateLabels: built.stateLabels,
      })
      setPacket(built)
      setExportResult(exported)
      setMessage(guided ? '' : `Exported ${exported.files.length} handoff files for ${built.packetId}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function handleImport(result: InterviewImportResult) {
    setBusy(true)
    setMessage('')
    try {
      const imported = importProductInterviewResponse(result.rawText, {
        projectId,
        approved,
        packet,
      })
      setDraft(imported.draft)
      setDiagnostics(imported.diagnostics)
      setGate(imported.gate)
      setDelta(imported.delta)
      setFieldStates(imported.fieldStates)

      await bridge.capabilitiesImportInterviewResponse(projectId, result.rawText)
      await bridge.capabilitiesSaveApplicationDraft(projectId, imported.draft)
      const unresolvedCount = imported.draft.unresolvedQuestions.length
      setMessage(
        imported.valid
          ? unresolvedCount
            ? `Interview imported. ${unresolvedCount} open question${unresolvedCount === 1 ? '' : 's'} remain — continue in Copilot to finish the plan.`
            : 'Interview imported. Review the definition, then approve it.'
          : 'Imported invalid response as draft with diagnostics. Approval remains blocked.',
      )
      onChanged?.()
      await refresh()
      setDraft(imported.draft)
      setDelta(imported.delta.length ? imported.delta : diffApplicationSpecification(approved, imported.draft))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function approve() {
    if (!draft) return
    setBusy(true)
    setMessage('')
    try {
      const gateResult = (await bridge.capabilitiesEvaluateProductGate(draft)) as GateLike
      setGate(gateResult)
      if (!gateResult.passed) {
        const diags = (gateResult.diagnostics as CapDiagnostic[]) ?? []
        setMessage(
          guided
            ? `Not ready to approve: ${presentDiagnosticsForGuided(diags)[0]?.message ?? 'resolve the open items first.'}`
            : 'CAP-GATE-001 blocked approval.',
        )
        setDiagnostics(diags)
        return
      }
      const result = await bridge.capabilitiesApproveApplication(projectId, draft)
      setGate(result.gate as GateLike)
      if (!result.ok) {
        setMessage('Approval rejected by product gate.')
        setDiagnostics(((result.gate as GateLike)?.diagnostics as CapDiagnostic[]) ?? [])
        return
      }
      setMessage(`Approved application revision ${(result.approved as ApplicationSpecification)?.revision}.`)
      onChanged?.()
      await refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const confirmed = Object.entries(fieldStates).filter(([, s]) => s === 'confirmed')
  const proposed = Object.entries(fieldStates).filter(([, s]) => s === 'proposed')
  const unresolved = Object.entries(fieldStates).filter(([, s]) => s === 'unresolved')
  const openQuestions = draft?.unresolvedQuestions ?? []
  const visibleDelta = guided ? delta.filter((row) => row.fieldPath !== '$') : delta
  const legacyDraft = draft as unknown as { userRoles?: unknown[] } | undefined
  const briefActors = ((draft?.actors as unknown[] | undefined) ?? legacyDraft?.userRoles ?? []).map(briefText).filter(Boolean)
  const briefOutcomes = ((draft?.outcomes as unknown[] | undefined) ?? []).map(briefText).filter(Boolean)
  const briefUseCases = ((draft?.useCases as unknown[] | undefined) ?? []).map(briefText).filter(Boolean)
  const briefInScope = ((draft?.scope?.inScope as unknown[] | undefined) ?? []).map(briefText).filter(Boolean)
  const briefOutOfScope = ((draft?.scope?.outOfScope as unknown[] | undefined) ?? []).map(briefText).filter(Boolean)
  const briefRules = ((draft?.rules as unknown[] | undefined) ?? []).map(briefText).filter(Boolean)
  const briefAcceptance = ((draft?.acceptanceCases as unknown[] | undefined) ?? []).map(briefText).filter(Boolean)
  const guidedDiagnostics = [
    ...((gate?.diagnostics as CapDiagnostic[] | undefined) ?? []),
    ...diagnostics,
  ].filter((diagnostic) => !(openQuestions.length > 0 && diagnostic.code === 'CAP-GATE-001-UNRESOLVED'))

  return (
    <section
      className="capabilities-application-definition"
      role="region"
      aria-label="Application definition"
    >
      <p className="lede">
        {guided
          ? 'Capture what the application must do through a Copilot interview, then approve the definition.'
          : 'Review the canonical definition, imported field changes, approval state, and technical record details.'}
      </p>

      <div className="capabilities-toolbar" role="group" aria-label="Application definition actions">
        <button type="button" className="btn btn-primary btn-compact" onClick={() => void exportPacket()} disabled={!projectId || busy}>
          {guided
            ? exportResult
              ? draft?.unresolvedQuestions?.length ? 'Continue in Copilot' : 'Restart in Copilot'
              : draft?.unresolvedQuestions?.length ? 'Continue in Copilot' : draft ? 'Revise in Copilot' : 'Start in Copilot'
            : exportResult ? 'Recreate interview handoff' : 'Create interview handoff'}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-compact"
          onClick={() => void approve()}
          disabled={!projectId || !draft || busy || openQuestions.length > 0 || gate?.passed === false}
        >
          Approve definition
        </button>
      </div>

      {guided && exportResult && openQuestions.length === 0 ? (
        <CapabilityHandoffCard bridge={bridge} projectId={projectId} result={exportResult} projection="guided" onHelp={onHelp} />
      ) : null}

      {!guided && packet ? (
        <details open>
          <summary>Interview packet {packet.packetId}</summary>
          <dl className="capabilities-ids">
            <div>
              <dt>Kind / gate</dt>
              <dd>
                {packet.interviewKind} → {packet.gateId}
              </dd>
            </div>
            <div>
              <dt>Output</dt>
              <dd>{packet.outputFileName}</dd>
            </div>
            <div>
              <dt>Boundary</dt>
              <dd>{packet.interviewBoundary}</dd>
            </div>
          </dl>
          <pre className="capabilities-pre">{JSON.stringify(packet, null, 2)}</pre>
        </details>
      ) : null}

      <InterviewImport onImport={(r) => void handleImport(r)} disabled={!projectId || busy} projection={projection} />

      {message ? (
        <p role="status" className="capabilities-note cap-interview-status">
          {message}
        </p>
      ) : null}

      {guided ? (
        openQuestions.length > 0 ? (
          <section className="cap-question-card" aria-labelledby="cap-open-question-heading">
            <div className="cap-question-card-head">
              <div>
                <h3 id="cap-open-question-heading">
                  {openQuestions.length} question{openQuestions.length === 1 ? '' : 's'} to finish
                </h3>
                <p>Your brief is saved. Resolve these with Copilot, then import the updated response.</p>
              </div>
              <span className="badge" aria-hidden="true">{openQuestions.length}</span>
            </div>
            <ol className="cap-question-list">
              {openQuestions.map((question) => <li key={question.id}>{question.text}</li>)}
            </ol>
            {exportResult ? (
              <CapabilityHandoffCard bridge={bridge} projectId={projectId} result={exportResult} projection="guided" onHelp={onHelp} />
            ) : (
              <button type="button" className="btn btn-primary btn-compact" onClick={() => void exportPacket()} disabled={busy}>
                Continue in Copilot
              </button>
            )}
            {(unresolved.length || proposed.length || confirmed.length) ? (
              <details className="cap-captured-details">
                <summary>Review captured brief</summary>
                <div className="cap-review-summary" aria-label="Interview field states">
                  {proposed.length ? (
                    <section className="cap-review-group">
                      <h4>Still being shaped <span className="badge">{proposed.length}</span></h4>
                      <ul>{proposed.map(([path]) => <li key={path}>{humanizeFieldPath(path)}</li>)}</ul>
                    </section>
                  ) : null}
                  {confirmed.length ? (
                    <section className="cap-review-group">
                      <h4>Captured <span className="badge">{confirmed.length}</span></h4>
                      <ul>{confirmed.map(([path]) => <li key={path}>{humanizeFieldPath(path)}</li>)}</ul>
                    </section>
                  ) : null}
                </div>
              </details>
            ) : null}
          </section>
        ) : draft ? (
          <section className="cap-definition-review" aria-labelledby="cap-definition-review-heading">
            <div className="cap-definition-review-head">
              <div>
                <h3 id="cap-definition-review-heading">Application brief ready</h3>
                <p>Review what was captured, then approve it to shape the solution.</p>
              </div>
              <span className="cap-ready-label">Ready to approve</span>
            </div>
            <div className="cap-definition-purpose">
              <span>Purpose</span>
              <p>{draft.purpose}</p>
              <div className="cap-definition-metrics" aria-label="Brief summary">
                <span><strong>{briefActors.length}</strong> people</span>
                <span><strong>{briefOutcomes.length}</strong> outcomes</span>
                <span><strong>{briefUseCases.length}</strong> workflows</span>
                <span><strong>{briefInScope.length + briefOutOfScope.length}</strong> scope decisions</span>
              </div>
            </div>
            <div className="cap-brief-sections">
              <details className="cap-brief-section">
                <summary>
                  <span><strong>People</strong><small>{compactPreview(briefActors)}</small></span>
                  <span className="cap-brief-count">{briefActors.length}</span>
                </summary>
                <ul>{briefActors.map((actor, index) => <li key={`${actor}-${index}`}>{actor}</li>)}</ul>
              </details>
              <details className="cap-brief-section">
                <summary>
                  <span><strong>Outcomes</strong><small>{compactPreview(briefOutcomes, 1)}</small></span>
                  <span className="cap-brief-count">{briefOutcomes.length}</span>
                </summary>
                <ul>{briefOutcomes.map((outcome, index) => <li key={`${outcome}-${index}`}>{outcome}</li>)}</ul>
              </details>
              <details className="cap-brief-section">
                <summary>
                  <span><strong>Main workflows</strong><small>{compactPreview(briefUseCases, 1)}</small></span>
                  <span className="cap-brief-count">{briefUseCases.length}</span>
                </summary>
                <ul>{briefUseCases.map((useCase, index) => <li key={`${useCase}-${index}`}>{useCase}</li>)}</ul>
              </details>
              <details className="cap-brief-section">
                <summary>
                  <span><strong>Scope</strong><small>{briefInScope.length} in · {briefOutOfScope.length} out</small></span>
                  <span className="cap-brief-count">{briefInScope.length + briefOutOfScope.length}</span>
                </summary>
                <div className="cap-brief-scope">
                  <section>
                    <h4>In scope</h4>
                    <ul>{briefInScope.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
                  </section>
                  <section>
                    <h4>Out of scope</h4>
                    <ul>{briefOutOfScope.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
                  </section>
                </div>
              </details>
              <details className="cap-brief-section">
                <summary>
                  <span><strong>Operational rules</strong><small>{compactPreview(briefRules, 1)}</small></span>
                  <span className="cap-brief-count">{briefRules.length}</span>
                </summary>
                <ul>{briefRules.map((rule, index) => <li key={`${rule}-${index}`}>{rule}</li>)}</ul>
              </details>
              <details className="cap-brief-section">
                <summary>
                  <span><strong>Acceptance checks</strong><small>{compactPreview(briefAcceptance, 1)}</small></span>
                  <span className="cap-brief-count">{briefAcceptance.length}</span>
                </summary>
                <ul>{briefAcceptance.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
              </details>
            </div>
          </section>
        ) : (unresolved.length || proposed.length || confirmed.length) ? (
          <div className="cap-review-summary" aria-label="Interview field states">
            {unresolved.length ? (
              <section className="cap-review-group cap-review-unresolved">
                <h3>Unresolved <span className="badge">{unresolved.length}</span></h3>
                <ul>{unresolved.map(([path]) => <li key={path}>{humanizeFieldPath(path)}</li>)}</ul>
              </section>
            ) : null}
            {proposed.length ? (
              <section className="cap-review-group">
                <h3>Proposed <span className="badge">{proposed.length}</span></h3>
                <ul>{proposed.map(([path]) => <li key={path}>{humanizeFieldPath(path)}</li>)}</ul>
              </section>
            ) : null}
            {confirmed.length ? (
              <section className="cap-review-group">
                <h3>Confirmed <span className="badge">{confirmed.length}</span></h3>
                <ul>{confirmed.map(([path]) => <li key={path}>{humanizeFieldPath(path)}</li>)}</ul>
              </section>
            ) : null}
          </div>
        ) : null
      ) : (
        <div className="capabilities-state-columns" aria-label="Interview field states">
          <section>
            <h3>Confirmed</h3>
            <ul>{confirmed.length === 0 ? <li>—</li> : confirmed.map(([path]) => <li key={path}>{path}</li>)}</ul>
          </section>
          <section>
            <h3>Proposed</h3>
            <ul>{proposed.length === 0 ? <li>—</li> : proposed.map(([path]) => <li key={path}>{path}</li>)}</ul>
          </section>
          <section>
            <h3>Unresolved</h3>
            <ul>{unresolved.length === 0 ? <li>—</li> : unresolved.map(([path]) => <li key={path}>{path}</li>)}</ul>
          </section>
        </div>
      )}

      {visibleDelta.length > 0 ? (
        <section aria-label="Field-level delta">
          <h3>Field-level delta vs approved</h3>
          <table className="capabilities-delta-table">
            <thead>
              <tr>
                <th scope="col">Field</th>
                <th scope="col">Change</th>
                {projection === 'design' ? (
                  <>
                    <th scope="col">Before</th>
                    <th scope="col">After</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {visibleDelta.map((row) => (
                <tr key={row.fieldPath}>
                  <td>{guided ? humanizeFieldPath(row.fieldPath) : row.fieldPath}</td>
                  <td>{row.change}</td>
                  {projection === 'design' ? (
                    <>
                      <td>
                        <code>{JSON.stringify(row.before)}</code>
                      </td>
                      <td>
                        <code>{JSON.stringify(row.after)}</code>
                      </td>
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="capabilities-note">
            Approved revision {approved?.revision ?? '—'} is unchanged until you explicitly approve.
          </p>
        </section>
      ) : null}

      {(guided ? guidedDiagnostics.length > 0 : diagnostics.length > 0 || (gate && !gate.passed)) && (
        guided ? (
          <section aria-label="Open issues" className="cap-issues">
            <h3>Open issues</h3>
            <ul className="cap-issue-list">
              {presentDiagnosticsForGuided(guidedDiagnostics).map((issue, i) => (
                <li key={i}>{issue.message}</li>
              ))}
            </ul>
          </section>
        ) : (
          <section aria-label="Diagnostics">
            <h3>Diagnostics</h3>
            <ul>
              {(gate?.diagnostics as CapDiagnostic[] | undefined)?.map((d) => (
                <li key={`${d.code}-${d.fieldPath ?? ''}-${d.message}`}>
                  {d.code}: {d.message}
                </li>
              ))}
              {diagnostics.map((d) => (
                <li key={`${d.code}-${d.fieldPath ?? ''}-${d.message}`}>
                  {d.code}: {d.message}
                  {d.fieldPath ? ` (${d.fieldPath})` : ''}
                </li>
              ))}
            </ul>
          </section>
        )
      )}

      {projection === 'design' && (draft || approved) ? (
        <dl className="capabilities-ids">
          <div>
            <dt>Draft</dt>
            <dd>
              {draft ? `${draft.id} @ ${draft.revision} (${draft.contentHash.slice(0, 12)}…)` : '—'}
            </dd>
          </div>
          <div>
            <dt>Approved</dt>
            <dd>
              {approved
                ? `${approved.id} @ ${approved.revision} (${approved.contentHash.slice(0, 12)}…)`
                : '—'}
            </dd>
          </div>
        </dl>
      ) : null}

    </section>
  )
}
