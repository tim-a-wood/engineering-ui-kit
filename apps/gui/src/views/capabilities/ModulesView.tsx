/**
 * Module interviews — type-specific export/import/approve (CAP-PKT-011).
 * One interview depth; five module types share CAP-CONTRACT-003.
 */

import { useEffect, useState } from 'react'
import type {
  ArchitectureSpecification,
  CapabilityModuleRecord,
  CapDiagnostic,
  InterviewPacket,
  ModuleManifest,
  ModuleType,
  OverlayInspectionSummary,
} from '@engineering-ui-kit/core'
import {
  applicableDetailsFor,
  buildModuleInterviewPacket,
  importModuleInterviewResponse,
  MODULE_APPLICABLE_DETAILS,
  type ModuleInterviewResponse,
} from '@engineering-ui-kit/core/browser'
import type { CapabilityPacketExportResult, EuikBridge } from '../../bridge'
import { InterviewImport, type InterviewImportResult } from './InterviewImport'
import { CapabilityHandoffCard } from './CapabilityHandoffCard'
import { presentDiagnosticsForGuided } from './capabilityPresentation'

type Props = {
  bridge: EuikBridge
  projectId: string
  architectureApproved: boolean
  projection: 'guided' | 'design'
  records?: CapabilityModuleRecord[]
  onChanged?: () => Promise<void>
}

const MODULE_TYPES = Object.keys(MODULE_APPLICABLE_DETAILS) as ModuleType[]

function asArch(value: unknown): ArchitectureSpecification | undefined {
  if (!value || typeof value !== 'object') return undefined
  return value as ArchitectureSpecification
}

export function ModulesView({
  bridge,
  projectId,
  architectureApproved,
  projection,
  records = [],
  onChanged = async () => {},
}: Props) {
  const guided = projection === 'guided'
  const [architecture, setArchitecture] = useState<ArchitectureSpecification | undefined>()
  const [selectedType, setSelectedType] = useState<ModuleType>('domain')
  const [selectedModuleId, setSelectedModuleId] = useState('')
  const [packet, setPacket] = useState<InterviewPacket | undefined>()
  const [draft, setDraft] = useState<ModuleManifest | undefined>()
  const [response, setResponse] = useState<ModuleInterviewResponse | undefined>()
  const [diagnostics, setDiagnostics] = useState<CapDiagnostic[]>([])
  const [gatePassed, setGatePassed] = useState<boolean | undefined>()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [implementationExport, setImplementationExport] = useState<CapabilityPacketExportResult>()
  const [implementationRunId, setImplementationRunId] = useState('')
  const [zipPath, setZipPath] = useState('')
  const [inspection, setInspection] = useState<OverlayInspectionSummary>()
  const [warningsAccepted, setWarningsAccepted] = useState(false)
  const approvedIds = records.filter((record) => Boolean(record.approved)).map((record) => record.moduleId)

  const moduleIds = architecture?.moduleIds ?? []

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!projectId) return
      try {
        await bridge.capabilitiesEnsureInitialized(projectId)
        const arch = await bridge.capabilitiesGetArchitecture(projectId)
        if (cancelled) return
        const approved = asArch(arch.approved) ?? asArch(arch.draft)
        setArchitecture(approved)
        if (approved?.moduleIds[0]) setSelectedModuleId(approved.moduleIds[0])
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : String(error))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bridge, projectId])

  useEffect(() => {
    if (!projectId || !selectedModuleId) return
    void bridge.capabilitiesListRuns(projectId).then((values) => {
      const matching = (values as { runId: string; targetOwnerId: string; kind: string; createdAt: string }[])
        .filter((run) => run.targetOwnerId === selectedModuleId && run.kind === 'implementation')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      setImplementationRunId(matching?.runId ?? '')
    })
  }, [bridge, projectId, selectedModuleId])

  async function exportPacket() {
    if (!architectureApproved || !architecture) {
      setMessage('Architecture must be approved before module interviews.')
      return
    }
    const moduleId = selectedModuleId || `mod.${selectedType}`
    setBusy(true)
    setMessage('')
    try {
      const built = buildModuleInterviewPacket({
        packetId: `pkt-mod-${moduleId}-${Date.now()}`,
        projectId,
        architecture,
        moduleId,
        moduleType: selectedType,
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
      setMessage(
        `Exported ${exported.files.length} ${selectedType} module interview files for ${moduleId}. Applicable details: ${applicableDetailsFor(selectedType).join(', ')}.`,
      )
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
      const parsed = result.parsed ?? JSON.parse(result.rawText)
      const imported = importModuleInterviewResponse(parsed)
      setResponse(imported.response)
      setDraft(imported.manifest)
      setDiagnostics(imported.diagnostics)
      setGatePassed(imported.ok)
      if (imported.manifest) {
        await bridge.capabilitiesSaveModuleDraft(projectId, imported.manifest)
      }
      setMessage(
        imported.ok
          ? 'Imported module draft. Review gate findings, then approve.'
          : guided
            ? `Imported with ${imported.diagnostics.length} issue(s) to resolve before approval.`
            : `Module draft blocked by CAP-GATE-003 (${imported.diagnostics.length} finding(s)).`,
      )
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
      const result = await bridge.capabilitiesApproveModule(projectId, draft)
      if (!result.ok) {
        setDiagnostics(((result.gate as { diagnostics?: CapDiagnostic[] })?.diagnostics) ?? [])
        setGatePassed(false)
        setMessage(guided ? 'Not ready to approve — resolve the issues above first.' : 'CAP-GATE-003 blocked module approval.')
        return
      }
      await onChanged()
      setGatePassed(true)
      setMessage(`Approved module ${draft.moduleId}@${draft.moduleVersion}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function exportImplementation() {
    if (!selectedModuleId || !approvedIds.includes(selectedModuleId)) return
    setBusy(true)
    try {
      const exported = await bridge.capabilitiesExportImplementationPacket({ projectId, moduleId: selectedModuleId })
      setImplementationExport(exported)
      setImplementationRunId(exported.runId)
      setInspection(undefined)
      setWarningsAccepted(false)
      setZipPath('')
      setMessage(`Exported ${exported.files.length} implementation handoff files for ${selectedModuleId}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally { setBusy(false) }
  }

  async function selectAndInspectOverlay() {
    if (!implementationRunId) return
    const selected = await bridge.pickZipFile()
    if (!selected) return
    setBusy(true)
    try {
      const next = await bridge.capabilitiesInspectOverlay({ projectId, runId: implementationRunId, zipPath: selected })
      setZipPath(selected)
      setInspection(next)
      setWarningsAccepted(false)
      setMessage(next.canApply ? `Inspected overlay with ${next.warnings.length} warning(s).` : `Overlay blocked by ${next.hardBlockers.length} issue(s).`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally { setBusy(false) }
  }

  async function applyInspectedOverlay() {
    if (!implementationRunId || !zipPath || !inspection?.canApply) return
    setBusy(true)
    try {
      const applied = await bridge.capabilitiesApplyOverlay({
        projectId, runId: implementationRunId, zipPath,
        acceptWarnings: inspection.warnings.length === 0 || warningsAccepted, explicit: true,
      })
      setMessage(`Applied ${applied.files.length} file(s); verification is now required.`)
      await onChanged()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally { setBusy(false) }
  }

  async function verifyApprovedModule() {
    if (!selectedModuleId || !approvedIds.includes(selectedModuleId)) return
    setBusy(true)
    try {
      const result = await bridge.capabilitiesVerifyApprovedModule({ projectId, moduleId: selectedModuleId, explicit: true })
      setMessage(`Verification outcome: ${result.record.outcome}.`)
      await onChanged()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally { setBusy(false) }
  }

  if (!architectureApproved) {
    return (
      <section className="capabilities-modules" role="region" aria-label="Modules">
        <p role="status">Module interviews are blocked until architecture is approved (CAP-GATE-002).</p>
      </section>
    )
  }

  return (
    <section className="capabilities-modules" role="region" aria-label="Modules">
      <p className="lede">
        {projection === 'guided'
          ? 'Run one type-specific module interview per allocated module. Applicable details are required; unresolved domain questions block approval.'
          : 'Inspect module types, applicable detail IDs, manifests, and CAP-GATE-003 diagnostics.'}
      </p>
      <p role="status">{message}</p>

      <div className="capabilities-module-list" role="navigation" aria-label="Allocated modules">
        <h3>Allocated modules</h3>
        <ul>
          {moduleIds.length === 0 ? <li>No modules in approved architecture.</li> : null}
          {moduleIds.map((id) => (
            <li key={id}>
              <button
                type="button"
                className={selectedModuleId === id ? 'active' : undefined}
                aria-current={selectedModuleId === id ? 'true' : undefined}
                aria-label={`Select module ${id}`}
                onClick={() => setSelectedModuleId(id)}
              >
                {id}
                {approvedIds.includes(id) ? ' (approved)' : ''}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <label>
        Module type
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as ModuleType)}
          aria-label="Module interview type"
        >
          {MODULE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      {projection === 'design' ? (
        <p className="capabilities-note">
          Applicable details ({selectedType}): {applicableDetailsFor(selectedType).join(', ')}
        </p>
      ) : null}

      <div className="capabilities-toolbar" role="group" aria-label="Module interview actions">
        <button type="button" onClick={() => void exportPacket()} disabled={!projectId || busy}>
          Export module interview
        </button>
        <button
          type="button"
          onClick={() => void approve()}
          disabled={!projectId || !draft || busy || gatePassed === false}
        >
          Approve module
        </button>
      </div>

      {packet && !guided ? (
        <details open>
          <summary>Interview packet {packet.packetId}</summary>
          <pre className="capabilities-pre">{JSON.stringify(packet, null, 2)}</pre>
        </details>
      ) : null}

      <InterviewImport
        label="Import module interview response"
        onImport={(r) => void handleImport(r)}
        disabled={!projectId || busy}
      />

      <section aria-label="Module implementation lifecycle">
        <h3>Implementation lifecycle</h3>
        <div className="capabilities-toolbar" role="group" aria-label="Implementation actions">
          <button type="button" disabled={busy || !approvedIds.includes(selectedModuleId)} onClick={() => void exportImplementation()}>
            Export implementation packet
          </button>
          <button type="button" disabled={busy || !implementationRunId} onClick={() => void selectAndInspectOverlay()}>
            Select and inspect overlay
          </button>
          <button type="button" disabled={busy || !inspection?.canApply || (inspection.warnings.length > 0 && !warningsAccepted)} onClick={() => void applyInspectedOverlay()}>
            Apply reviewed overlay
          </button>
          <button type="button" disabled={busy || !approvedIds.includes(selectedModuleId)} onClick={() => void verifyApprovedModule()}>
            Verify module
          </button>
        </div>
        {implementationExport ? (
          guided ? (
            <CapabilityHandoffCard bridge={bridge} result={implementationExport} projection="guided" />
          ) : (
            <ul aria-label="Implementation handoff files">
              {implementationExport.files.map((file) => <li key={file.path}><code>{file.path}</code> — {file.bytes} bytes — {file.sha256.slice(0, 12)}…</li>)}
            </ul>
          )
        ) : null}
        {inspection ? (
          <div aria-label="Capability overlay inspection">
            {inspection.hardBlockers.length ? <ul>{inspection.hardBlockers.map((item, index) => <li key={`${item.ruleId}-${index}`}>{item.ruleId}: {item.message}</li>)}</ul> : null}
            {inspection.warnings.length ? <ul>{inspection.warnings.map((item, index) => <li key={`${item.ruleId}-${index}`}>Warning {item.ruleId}: {item.message}</li>)}</ul> : <p>No overlay warnings.</p>}
            {inspection.warnings.length ? <label><input type="checkbox" checked={warningsAccepted} onChange={(event) => setWarningsAccepted(event.target.checked)} />I reviewed and accept every overlay warning</label> : null}
          </div>
        ) : null}
      </section>

      {diagnostics.length > 0 ? (
        guided ? (
          <ul aria-label="Open issues" className="cap-issue-list">
            {presentDiagnosticsForGuided(diagnostics).map((issue, i) => <li key={i}>{issue.message}</li>)}
          </ul>
        ) : (
          <ul aria-label="Module gate diagnostics">
            {diagnostics.map((d, i) => (
              <li key={`${d.code}-${i}`}>
                {d.code}: {d.message}
                {d.fieldPath ? ` [${d.fieldPath}]` : ''}
              </li>
            ))}
          </ul>
        )
      ) : null}

      {draft && projection === 'design' ? (
        <details>
          <summary>Manifest draft {draft.moduleId}</summary>
          <pre className="capabilities-pre">{JSON.stringify(draft, null, 2)}</pre>
        </details>
      ) : null}

      {response && projection === 'guided' ? (
        <p className="capabilities-note">
          Draft {response.moduleId} ({response.moduleType}) — {response.answers.length} answers.
        </p>
      ) : null}
    </section>
  )
}
