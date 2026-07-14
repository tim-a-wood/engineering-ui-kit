/**
 * Architecture interview — export/import/review/approve (CAP-PKT-009).
 */

import { useEffect, useState } from 'react'
import type {
  ApplicationSpecification,
  ArchitectureSpecification,
  CapDiagnostic,
  InterviewPacket,
} from '@engineering-ui-kit/core'
import {
  buildArchitectureInterviewPacket,
  detectCycles,
  evaluateArchitectureProposal,
  importArchitectureProposal,
  projectDerivedGraph,
  type ArchitectureProposalInput,
} from '@engineering-ui-kit/core/browser'
import type { EuikBridge } from '../../bridge'
import { InterviewImport, type InterviewImportResult } from './InterviewImport'
import { presentDiagnosticsForGuided } from './capabilityPresentation'

type Props = {
  bridge: EuikBridge
  projectId: string
  architectureApproved: boolean
  projection: 'guided' | 'design'
  onApproved?: () => void
}

function asApp(value: unknown): ApplicationSpecification | undefined {
  if (!value || typeof value !== 'object') return undefined
  return value as ApplicationSpecification
}

function asArch(value: unknown): ArchitectureSpecification | undefined {
  if (!value || typeof value !== 'object') return undefined
  return value as ArchitectureSpecification
}

export function ArchitectureInterview({
  bridge,
  projectId,
  architectureApproved,
  projection,
  onApproved,
}: Props) {
  const guided = projection === 'guided'
  const [product, setProduct] = useState<ApplicationSpecification | undefined>()
  const [draft, setDraft] = useState<ArchitectureSpecification | undefined>()
  const [packet, setPacket] = useState<InterviewPacket | undefined>()
  const [proposal, setProposal] = useState<ArchitectureProposalInput | undefined>()
  const [diagnostics, setDiagnostics] = useState<CapDiagnostic[]>([])
  const [cycles, setCycles] = useState<string[][]>([])
  const [gatePassed, setGatePassed] = useState<boolean | undefined>()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    if (!projectId) return
    await bridge.capabilitiesEnsureInitialized(projectId)
    const app = await bridge.capabilitiesGetApplication(projectId)
    const arch = await bridge.capabilitiesGetArchitecture(projectId)
    setProduct(asApp(app.approved) ?? asApp(app.draft))
    setDraft(asArch(arch.draft) ?? asArch(arch.approved))
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
      setMessage('Approve a product specification before architecture interview.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const built = buildArchitectureInterviewPacket({
        packetId: `pkt-arch-${projectId}-${Date.now()}`,
        projectId,
        application: product,
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
      setMessage(`Exported ${exported.files.length} architecture handoff files for ${built.packetId}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function handleImport(result: InterviewImportResult) {
    if (!product) {
      setMessage('Product specification required for architecture import.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const parsed = result.parsed ?? JSON.parse(result.rawText)
      const imported = importArchitectureProposal(product, parsed)
      setDraft(imported.draft)
      setProposal(imported.proposal)
      setDiagnostics(imported.diagnostics)
      setGatePassed(imported.ok)
      setCycles(imported.evaluation?.cycles ?? [])
      if (imported.draft) {
        await bridge.capabilitiesSaveArchitectureDraft(projectId, imported.draft)
      }
      setMessage(
        imported.ok
          ? 'Imported architecture proposal as draft. Review cycles and findings, then approve.'
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

  async function approve() {
    if (!draft || !product) return
    setBusy(true)
    setMessage('')
    try {
      const currentProposal: ArchitectureProposalInput = proposal ?? {
        architecture: draft,
        moduleNeedTraces: draft.moduleIds.map((moduleId) => ({
          moduleId,
          needIds: product.useCases.map((u) => u.id),
        })),
      }
      const evaluation = evaluateArchitectureProposal(product, currentProposal)
      setDiagnostics(evaluation.diagnostics)
      setCycles(evaluation.cycles)
      setGatePassed(evaluation.passed)
      if (!evaluation.passed) {
        setMessage(guided ? 'Not ready to approve — resolve the findings above first.' : 'CAP-GATE-002 blocked approval.')
        return
      }
      const result = await bridge.capabilitiesApproveArchitecture(projectId, {
        ...draft,
        gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
      })
      if (!result.ok) {
        setDiagnostics(((result.gate as { diagnostics?: CapDiagnostic[] })?.diagnostics) ?? [])
        setGatePassed(false)
        setMessage('Approval rejected by architecture gate.')
        return
      }
      setMessage('Architecture approved.')
      onApproved?.()
      await refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const graph = draft ? projectDerivedGraph(draft) : undefined
  const liveCycles = draft ? detectCycles(projectDerivedGraph(draft)) : cycles

  return (
    <section
      className="capabilities-architecture-interview"
      role="region"
      aria-label="Architecture interview"
    >
      <p className="lede">
        {projection === 'guided'
          ? 'Propose the module structure through a Copilot interview, review dependencies and cycles, then approve the architecture.'
          : 'Review the proposed structure, dependencies, approval state, and technical record details.'}
      </p>
      <p role="status">{message || (architectureApproved ? 'Architecture is approved.' : 'Architecture not yet approved.')}</p>

      <div className="capabilities-toolbar" role="group" aria-label="Architecture interview actions">
        <button type="button" className="btn btn-primary btn-compact" onClick={() => void exportPacket()} disabled={!projectId || !product || busy}>
          Export architecture interview
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-compact"
          onClick={() => void approve()}
          disabled={!projectId || !draft || busy || gatePassed === false}
        >
          Approve architecture
        </button>
      </div>

      {packet && !guided ? (
        <details open>
          <summary>Interview packet {packet.packetId}</summary>
          <pre className="capabilities-pre">{JSON.stringify(packet, null, 2)}</pre>
        </details>
      ) : null}

      <InterviewImport
        label="Import architecture proposal"
        onImport={(r) => void handleImport(r)}
        disabled={!projectId || !product || busy}
      />

      {liveCycles.length > 0 ? (
        <div role="alert" aria-label="Dependency cycles">
          <strong>Dependency cycles</strong>
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
          <ul aria-label="Architecture gate diagnostics">
            {diagnostics.map((d, i) => (
              <li key={`${d.code}-${i}`}>
                {d.code}: {d.message}
                {d.relatedIds?.length ? ` (${d.relatedIds.join(', ')})` : ''}
              </li>
            ))}
          </ul>
        )
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
        <p className="capabilities-note">Module interviews remain blocked until architecture approval.</p>
      ) : null}
    </section>
  )
}
