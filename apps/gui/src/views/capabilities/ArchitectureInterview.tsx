/**
 * Architecture interview — export/import/review/approve (CAP-PKT-009).
 */

import { useEffect, useState } from 'react'
import type {
  ApplicationSpecification,
  ArchitectureSpecification,
  CapDiagnostic,
  FoundationPlan,
  InterviewPacket,
} from '@engineering-ui-kit/core'
import {
  buildArchitectureInterviewPacket,
  canonicalHash,
  detectCycles,
  evaluateArchitectureProposal,
  importArchitectureProposal,
  normalizeArchitectureProposal,
  projectDerivedGraph,
  type ArchitectureProposalInput,
} from '@engineering-ui-kit/core/browser'
import type { CapabilityPacketExportResult, EuikBridge } from '../../bridge'
import { Icon } from '../../icons'
import { COPILOT_URL, copyText } from '../workflowShared'
import { InterviewImport, type InterviewImportResult } from './InterviewImport'
import { CapabilityHandoffCard } from './CapabilityHandoffCard'
import { FoundationReview } from './FoundationReview'
import { presentDiagnosticsForGuided } from './capabilityPresentation'

type Props = {
  bridge: EuikBridge
  projectId: string
  architectureApproved: boolean
  projection: 'guided' | 'design'
  onChanged?: () => void | Promise<void>
  /** Backward-compatible alias for callers that only refreshed after approval. */
  onApproved?: () => void | Promise<void>
}

function asApp(value: unknown): ApplicationSpecification | undefined {
  if (!value || typeof value !== 'object') return undefined
  return value as ApplicationSpecification
}

function asArch(value: unknown): ArchitectureSpecification | undefined {
  if (!value || typeof value !== 'object') return undefined
  return value as ArchitectureSpecification
}

export function nextArchitectureRevision(revision: string): string {
  const match = revision.match(/^(.*?)(\d+)$/)
  if (!match) return `${revision}.1`
  return `${match[1]}${Number(match[2]) + 1}`
}

function prepareRevisedArchitecture(
  draft: ArchitectureSpecification,
  approved: ArchitectureSpecification,
): ArchitectureSpecification {
  const { approvedAt: _approvedAt, approvedBy: _approvedBy, ...withoutApproval } = draft
  const revised = {
    ...withoutApproval,
    revision: nextArchitectureRevision(approved.revision),
    status: 'proposed' as const,
  }
  return {
    ...revised,
    contentHash: canonicalHash({ ...revised, contentHash: undefined }),
  }
}

export function buildArchitectureCorrectionPrompt(input: {
  product: ApplicationSpecification
  response: string
  diagnostics: CapDiagnostic[]
  cycles: string[][]
}): string {
  const cycleFindings = input.diagnostics.some((diagnostic) => diagnostic.code === 'CAP-AR-006')
    ? []
    : input.cycles.map((cycle) => `- CAP-AR-006: module dependency cycle detected (${cycle.join(' -> ')})`)
  const findings = [
    ...input.diagnostics.map((diagnostic) => {
      const context = [
        diagnostic.fieldPath ? `field: ${diagnostic.fieldPath}` : '',
        diagnostic.relatedIds?.length ? `related IDs: ${diagnostic.relatedIds.join(', ')}` : '',
      ].filter(Boolean).join('; ')
      return `- ${diagnostic.code}: ${diagnostic.message}${context ? ` (${context})` : ''}`
    }),
    ...cycleFindings,
  ]

  return [
    'Correct the architecture proposal JSON below so it passes every listed validation finding.',
    '',
    'Preserve valid requirements, IDs, and design intent. Make only the changes needed to produce a complete valid architecture response. Do not omit required fields, leave unresolved questions, or introduce dependency cycles.',
    '',
    'Authoritative application context:',
    `- projectId: ${input.product.projectId}`,
    `- applicationSpecId: ${input.product.id}`,
    `- applicationSpecRevision: ${input.product.revision}`,
    `- applicationSpecHash: ${input.product.contentHash}`,
    `- valid use case IDs: ${input.product.useCases.map((useCase) => useCase.id).join(', ') || '(none)'}`,
    '',
    'Validation findings:',
    ...findings,
    '',
    'Return one complete replacement JSON object only, with no markdown fence or commentary. Use the architecture response envelope with architecture, moduleNeedTraces, and moduleJustifications. Every module must have a name, moduleType, responsibility, workflow trace, need trace, and justification. Every dependency edge must have a concrete reason.',
    '',
    'Rejected JSON:',
    input.response,
  ].join('\n')
}

export function ArchitectureInterview({
  bridge,
  projectId,
  architectureApproved,
  projection,
  onChanged,
  onApproved,
}: Props) {
  const guided = projection === 'guided'
  const notifyChanged = onChanged ?? onApproved
  const [product, setProduct] = useState<ApplicationSpecification | undefined>()
  const [draft, setDraft] = useState<ArchitectureSpecification | undefined>()
  const [approvedArch, setApprovedArch] = useState<ArchitectureSpecification | undefined>()
  const [foundation, setFoundation] = useState<{ draft?: FoundationPlan; approved?: FoundationPlan }>({})
  const [packet, setPacket] = useState<InterviewPacket | undefined>()
  const [exportResult, setExportResult] = useState<CapabilityPacketExportResult | undefined>()
  const [proposal, setProposal] = useState<ArchitectureProposalInput | undefined>()
  const [diagnostics, setDiagnostics] = useState<CapDiagnostic[]>([])
  const [cycles, setCycles] = useState<string[][]>([])
  const [gatePassed, setGatePassed] = useState<boolean | undefined>()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [lastImportedText, setLastImportedText] = useState('')
  const [revisionStarted, setRevisionStarted] = useState(false)

  async function refresh() {
    if (!projectId) return
    await bridge.capabilitiesEnsureInitialized(projectId)
    const app = await bridge.capabilitiesGetApplication(projectId)
    const arch = await bridge.capabilitiesGetArchitecture(projectId)
    setProduct(asApp(app.approved) ?? asApp(app.draft))
    setDraft(asArch(arch.draft) ?? asArch(arch.approved))
    setApprovedArch(asArch(arch.approved))
    setFoundation(await bridge.capabilitiesGetFoundation(projectId))
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh on project change
  }, [bridge, projectId])

  async function exportPacket() {
    if (!product) {
      setMessage(guided ? 'Finish and approve Plan before designing how the application works.' : 'Approve a product specification before architecture interview.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const basePacket = buildArchitectureInterviewPacket({
        packetId: `pkt-arch-${projectId}-${Date.now()}`,
        projectId,
        application: product,
      })
      const currentArchitecture = approvedArch ?? draft
      const built: InterviewPacket = currentArchitecture
        ? {
            ...basePacket,
            inputContext: {
              ...basePacket.inputContext,
              facts: [
                ...basePacket.inputContext.facts,
                `currentArchitectureSpecification:${JSON.stringify(currentArchitecture)}`,
                `architectureRevision:replace approved revision ${currentArchitecture.revision} with revision ${nextArchitectureRevision(currentArchitecture.revision)}`,
              ],
            },
          }
        : basePacket
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
      if (architectureApproved) setRevisionStarted(true)
      setMessage(guided ? '' : `Exported ${exported.files.length} architecture handoff files for ${built.packetId}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function handleImport(result: InterviewImportResult) {
    if (!product) {
      setMessage(guided ? 'Finish and approve Plan before importing the proposed application structure.' : 'Product specification required for architecture import.')
      return
    }
    if (approvedArch) setRevisionStarted(true)
    setLastImportedText(result.rawText)
    setBusy(true)
    setMessage('')
    try {
      const parsed = result.parsed ?? JSON.parse(result.rawText)
      const imported = importArchitectureProposal(product, parsed)
      const importedDraft = imported.draft && approvedArch
        ? prepareRevisedArchitecture(imported.draft, approvedArch)
        : imported.draft
      const importedProposal = imported.proposal && importedDraft
        ? { ...imported.proposal, architecture: importedDraft }
        : imported.proposal
      setDraft(importedDraft)
      setProposal(importedProposal)
      setDiagnostics(imported.diagnostics)
      setGatePassed(imported.ok)
      setCycles(imported.evaluation?.cycles ?? [])
      if (importedDraft) {
        await bridge.capabilitiesSaveArchitectureDraft(projectId, importedDraft)
        if (approvedArch) setRevisionStarted(true)
        await notifyChanged?.()
      }
      setMessage(
        imported.ok
          ? guided
            ? 'Imported the proposed application structure. Review it, then approve when ready.'
            : 'Imported architecture proposal as draft. Review cycles and findings, then approve.'
          : guided
            ? `Imported with ${imported.diagnostics.length} issue(s) to resolve before approval.`
            : `Imported draft blocked by CAP-GATE-002 (${imported.diagnostics.length} finding(s)).`,
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function fixErrorsInCopilot() {
    if (!product) return
    const response = lastImportedText || JSON.stringify(proposal ?? (draft ? { architecture: draft } : {}), null, 2)
    const prompt = buildArchitectureCorrectionPrompt({
      product,
      response,
      diagnostics,
      cycles: draft ? detectCycles(projectDerivedGraph(draft)) : cycles,
    })
    setBusy(true)
    let copied = false
    let opened = false
    try {
      copied = await copyText(prompt)
    } catch {
      copied = false
    }
    try {
      await bridge.openExternal(COPILOT_URL)
      opened = true
    } catch {
      opened = false
    }
    setMessage(opened
      ? copied
        ? 'Copilot opened with the fix request on your clipboard. Paste it into the chat, then import the replacement JSON.'
        : 'Copilot opened, but the fix request could not be copied. Copy the findings and rejected JSON manually.'
      : copied
        ? 'The fix request was copied, but Copilot could not be opened. Open Copilot and paste the request to get replacement JSON.'
        : 'The fix request could not be copied and Copilot could not be opened. Copy the findings and rejected JSON manually.')
    setBusy(false)
  }

  async function approve() {
    if (!draft || !product) return
    setBusy(true)
    setMessage('')
    try {
      const currentProposal = normalizeArchitectureProposal(product, proposal ?? {
        architecture: draft,
        moduleNeedTraces: draft.moduleIds.map((moduleId) => ({
          moduleId,
          needIds: product.useCases.map((u) => u.id),
        })),
      })
      const normalizedDraft = currentProposal.architecture
      setDraft(normalizedDraft)
      setProposal(currentProposal)
      await bridge.capabilitiesSaveArchitectureDraft(projectId, normalizedDraft)
      const evaluation = evaluateArchitectureProposal(product, currentProposal)
      setDiagnostics(evaluation.diagnostics)
      setCycles(evaluation.cycles)
      setGatePassed(evaluation.passed)
      if (!evaluation.passed) {
        setMessage(guided ? 'Not ready to approve — resolve the findings above first.' : 'CAP-GATE-002 blocked approval.')
        return
      }
      const result = await bridge.capabilitiesApproveArchitecture(projectId, {
        ...normalizedDraft,
        gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
      })
      if (!result.ok) {
        setDiagnostics(((result.gate as { diagnostics?: CapDiagnostic[] })?.diagnostics) ?? [])
        setGatePassed(false)
        setMessage('Approval rejected by architecture gate.')
        return
      }
      setMessage(guided ? 'Application structure approved.' : 'Architecture approved.')
      setRevisionStarted(false)
      await notifyChanged?.()
      await refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const hasPendingRevision = Boolean(approvedArch && draft && draft.revision !== approvedArch.revision)
  const revising = revisionStarted || hasPendingRevision
  const currentApproval = architectureApproved && !revising
  const awaitingRevisedImport = Boolean(architectureApproved && revisionStarted && !hasPendingRevision)
  const graph = draft ? projectDerivedGraph(draft) : undefined
  const liveCycles = draft ? detectCycles(projectDerivedGraph(draft)) : cycles
  const readyToApprove = Boolean(draft && gatePassed !== false && !currentApproval && !awaitingRevisedImport)
  const guidedTaskTitle = currentApproval
    ? 'Application parts approved'
    : revising
      ? 'Review the revised application structure'
    : liveCycles.length || diagnostics.length
      ? 'Resolve the remaining design issues'
      : draft
        ? 'Review how the application will work'
        : 'Generate a solution draft with Copilot'

  return (
    <section
      className="capabilities-architecture-interview"
      role="region"
      aria-label="Architecture interview"
    >
      {guided ? (
        <div className={`cap-task-command${currentApproval ? ' complete' : ''}`}>
          <div className="cap-task-command-copy">
            <p className="capabilities-eyebrow">Solution design</p>
            <h3>{guidedTaskTitle}</h3>
            <p>
              {currentApproval
                ? 'The main parts and their responsibilities are agreed. Review how they run together below to finish Design.'
                : revising
                  ? awaitingRevisedImport
                    ? 'Import the updated Copilot response to review the replacement design.'
                    : 'Review the replacement design below, then approve it when ready.'
                : liveCycles.length || diagnostics.length
                  ? 'The proposed structure is saved. Resolve the highlighted issues before approval.'
                  : draft
                    ? 'Review the application parts and their interaction below before approving the design.'
                    : 'Copilot proposes the main application parts from the approved plan. You review one concise set of assumptions instead of answering a field-by-field questionnaire.'}
            </p>
            {message ? <p role="status" className="cap-task-command-status">{message}</p> : null}
          </div>
          <div className="capabilities-toolbar cap-task-command-actions" role="group" aria-label="Architecture interview actions">
            <button
              type="button"
              className={`btn ${draft ? 'btn-secondary' : 'btn-primary'} btn-compact`}
              onClick={() => void exportPacket()}
              disabled={!projectId || !product || busy}
            >
              {currentApproval ? 'Revise design' : exportResult ? 'Restart in Copilot' : 'Continue in Copilot'}
            </button>
            {!currentApproval ? (
              <button
                type="button"
                className={`btn ${readyToApprove ? 'btn-primary' : 'btn-secondary'} btn-compact`}
                onClick={() => void approve()}
                disabled={!readyToApprove || busy}
              >
                Approve application structure
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <p className="lede">Review the proposed structure, dependencies, approval state, and technical record details.</p>
          <p role="status">{message || (currentApproval ? 'Architecture is approved.' : revising ? 'An architecture revision is in progress.' : 'Architecture not yet approved.')}</p>
          <div className="capabilities-toolbar" role="group" aria-label="Architecture interview actions">
            <button type="button" className="btn btn-primary btn-compact" onClick={() => void exportPacket()} disabled={!projectId || !product || busy}>{currentApproval ? 'Revise architecture' : 'Generate architecture draft'}</button>
            <button type="button" className="btn btn-secondary btn-compact" onClick={() => void approve()} disabled={!projectId || !readyToApprove || busy}>Approve architecture</button>
          </div>
        </>
      )}

      {guided && exportResult ? (
        <CapabilityHandoffCard bridge={bridge} projectId={projectId} result={exportResult} projection="guided" />
      ) : null}

      {packet && !guided ? (
        <details open>
          <summary>Interview packet {packet.packetId}</summary>
          <pre className="capabilities-pre">{JSON.stringify(packet, null, 2)}</pre>
        </details>
      ) : null}

      {guided ? (
        <details className="cap-interview-import" open={!draft || revising || liveCycles.length > 0 || diagnostics.length > 0}>
          <summary>{draft ? 'Import an updated Copilot response' : 'Import the proposed structure'}</summary>
          <InterviewImport label="Import proposed structure" onImport={(r) => void handleImport(r)} disabled={!projectId || !product || busy} projection={projection} />
        </details>
      ) : (
        <InterviewImport label="Import architecture proposal" onImport={(r) => void handleImport(r)} disabled={!projectId || !product || busy} projection={projection} />
      )}

      {liveCycles.length > 0 || diagnostics.length > 0 ? (
        <section className="cap-fix-errors" role="alert" aria-label="Architecture validation issues">
          <div className="cap-fix-errors-head">
            <div>
              <strong>{guided ? 'The proposed structure needs changes' : 'Architecture validation issues'}</strong>
              <p>Send these findings and the rejected response to Copilot to get corrected JSON.</p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-compact"
              onClick={() => void fixErrorsInCopilot()}
              disabled={busy || !product}
            >
              {Icon.sparkle(14)} Fix errors in Copilot
            </button>
          </div>

          {liveCycles.length > 0 ? (
            <div aria-label={guided ? 'Parts that depend on each other in a loop' : 'Dependency cycles'}>
              <strong>{guided ? 'Parts that depend on each other in a loop' : 'Dependency cycles'}</strong>
              <ul>
                {liveCycles.map((cycle) => (
                  <li key={cycle.join('→')}>{cycle.join(' → ')}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {diagnostics.length > 0 ? (
            guided ? (
              <ul aria-label="Open issues" className="cap-issue-list">
                {presentDiagnosticsForGuided(diagnostics).map((issue, i) => <li key={i}>{issue.message}</li>)}
              </ul>
            ) : (
              <ul aria-label="Architecture gate diagnostics" className="cap-issue-list">
                {diagnostics.map((d, i) => (
                  <li key={`${d.code}-${i}`}>
                    {d.code}: {d.message}
                    {d.relatedIds?.length ? ` (${d.relatedIds.join(', ')})` : ''}
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </section>
      ) : null}

      {projection === 'design' && graph ? (
        <dl className="capabilities-ids" aria-label="Derived graph summary">
          <div>
            <dt>Nodes</dt>
            <dd>{graph.nodes.map((n) => n.id).join(', ') || '—'}</dd>
          </div>
          <div>
            <dt>Edges</dt>
            <dd>
              {graph.edges.map((e) => `${e.from}→${e.to}`).join(', ') || '—'}
            </dd>
          </div>
        </dl>
      ) : null}

      {!architectureApproved ? (
        <p className="capabilities-note">
          {guided ? 'Build interviews become available after the application structure is approved.' : 'Module interviews remain blocked until architecture approval.'}
        </p>
      ) : null}

      {currentApproval && approvedArch ? (
        <FoundationReview
          bridge={bridge}
          projectId={projectId}
          plan={foundation.draft ?? foundation.approved}
          approvedFoundation={foundation.approved}
          approvedArchitecture={approvedArch}
          projection={projection}
          onChanged={() => {
            void refresh().then(() => notifyChanged?.())
          }}
        />
      ) : null}
    </section>
  )
}
