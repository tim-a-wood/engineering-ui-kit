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
      const built = buildProductInterviewPacket({
        packetId: `pkt-product-${projectId}-${Date.now()}`,
        projectId,
        approved,
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
      setMessage(
        imported.valid
          ? 'Imported draft. Review field delta before approval.'
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

  return (
    <section
      className="capabilities-application-definition"
      role="region"
      aria-label="Application definition"
    >
      <p className="lede">
        {guided
          ? 'Capture what the application must do through a Copilot interview, then approve the definition.'
          : 'Inspect packet IDs, content hashes, field deltas, and gate diagnostics for the same application records.'}
      </p>

      <div className="capabilities-toolbar" role="group" aria-label="Application definition actions">
        <button type="button" className="btn btn-primary btn-compact" onClick={() => void exportPacket()} disabled={!projectId || busy}>
          {exportResult ? 'Recreate interview handoff' : 'Create interview handoff'}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-compact"
          onClick={() => void approve()}
          disabled={!projectId || !draft || busy || gate?.passed === false}
        >
          Approve definition
        </button>
      </div>

      {guided && exportResult ? (
        <CapabilityHandoffCard bridge={bridge} result={exportResult} projection="guided" onHelp={onHelp} />
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

      <InterviewImport onImport={(r) => void handleImport(r)} disabled={!projectId || busy} />

      {guided ? (
        (unresolved.length || proposed.length || confirmed.length) ? (
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

      {delta.length > 0 ? (
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
              {delta.map((row) => (
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

      {(diagnostics.length > 0 || (gate && !gate.passed)) && (
        guided ? (
          <section aria-label="Open issues" className="cap-issues">
            <h3>Open issues</h3>
            <ul className="cap-issue-list">
              {presentDiagnosticsForGuided([
                ...((gate?.diagnostics as CapDiagnostic[] | undefined) ?? []),
                ...diagnostics,
              ]).map((issue, i) => (
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

      {message ? (
        <p role="status" className="capabilities-note">
          {message}
        </p>
      ) : null}
    </section>
  )
}
