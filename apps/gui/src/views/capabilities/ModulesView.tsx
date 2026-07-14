/**
 * Module interviews — type-specific export/import/approve (CAP-PKT-011).
 * One interview depth; five module types share CAP-CONTRACT-003.
 *
 * State-safety: all per-module transient state lives in <ModuleWorkspace/>, which is keyed by
 * project+module so switching either identity fully remounts it and resets drafts, responses,
 * diagnostics, packets, handoffs, run IDs, ZIP paths, inspection and messages. Approve/import
 * are additionally guarded so a record can only be committed against its own module + project.
 */

import { useEffect, useRef, useState } from 'react'
import type {
  ArchitectureSpecification,
  CapabilityRunScope,
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
import { EmptyState } from '../../components'
import { Icon } from '../../icons'
import { InterviewImport, type InterviewImportResult } from './InterviewImport'
import { CapabilityHandoffCard } from './CapabilityHandoffCard'
import { humanizeIdentifier, moduleTypeLabel, presentDiagnosticsForGuided } from './capabilityPresentation'

type Props = {
  bridge: EuikBridge
  projectId: string
  architectureApproved: boolean
  projection: 'guided' | 'design'
  records?: CapabilityModuleRecord[]
  onChanged?: () => Promise<void>
  /** When embedded in the guided two-region Build workspace, the parent owns the module list. */
  hideModuleList?: boolean
  externalSelectedModuleId?: string
  onSelectModule?: (id: string) => void
  /** Guided: render only the single next relevant lifecycle action. */
  progressive?: boolean
  onOpenArchitecture?: () => void
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
  hideModuleList = false,
  externalSelectedModuleId,
  onSelectModule,
  progressive = false,
  onOpenArchitecture,
}: Props) {
  const guided = projection === 'guided'
  const [architecture, setArchitecture] = useState<ArchitectureSpecification | undefined>()
  const [internalSelected, setInternalSelected] = useState('')
  const approvedIds = records.filter((r) => Boolean(r.approved)).map((r) => r.moduleId)
  const moduleIds = architecture?.moduleIds ?? []
  const selectedModuleId = externalSelectedModuleId ?? internalSelected

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
        if (!externalSelectedModuleId && approved?.moduleIds[0]) setInternalSelected(approved.moduleIds[0])
      } catch {
        /* surfaced by the parent workspace loader */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bridge, projectId, externalSelectedModuleId])

  if (!architectureApproved) {
    return (
      <section className="capabilities-modules" role="region" aria-label="Modules">
        <div role="status">
          <EmptyState
            icon={Icon.box(24)}
            title="Approve the architecture first"
            hint="Modules become available after the application structure and dependencies are approved."
            action={onOpenArchitecture ? (
              <button type="button" className="btn btn-primary btn-compact" onClick={onOpenArchitecture}>
                Open Architecture {Icon.arrowRight(14)}
              </button>
            ) : undefined}
          />
        </div>
      </section>
    )
  }

  return (
    <section className="capabilities-modules" role="region" aria-label="Modules">
      {!hideModuleList && (
        <p className="lede">
          {guided
            ? 'Work one allocated module at a time: interview it, approve it, then hand off implementation.'
            : 'Review allocated modules, their contracts, implementation status, and approval details.'}
        </p>
      )}

      {!hideModuleList && (
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
                  onClick={() => (onSelectModule ? onSelectModule(id) : setInternalSelected(id))}
                >
                  {guided ? humanizeIdentifier(id) : id}
                  {approvedIds.includes(id) ? ' (approved)' : ''}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* key: remount (full reset of every module-scoped value) when project or module changes. */}
      <ModuleWorkspace
        key={`${projectId}:${selectedModuleId}`}
        bridge={bridge}
        projectId={projectId}
        moduleId={selectedModuleId}
        architecture={architecture}
        isApproved={approvedIds.includes(selectedModuleId)}
        projection={projection}
        progressive={progressive}
        onChanged={onChanged}
      />
    </section>
  )
}

/* ----------------------------------------------------- per-module workspace */

function ModuleWorkspace(props: {
  bridge: EuikBridge
  projectId: string
  moduleId: string
  architecture: ArchitectureSpecification | undefined
  isApproved: boolean
  projection: 'guided' | 'design'
  progressive: boolean
  onChanged: () => Promise<void>
}) {
  const { bridge, projectId, moduleId, architecture, isApproved, projection, progressive } = props
  const guided = projection === 'guided'
  const [selectedType, setSelectedType] = useState<ModuleType>('domain')
  const [packet, setPacket] = useState<InterviewPacket | undefined>()
  const [interviewExport, setInterviewExport] = useState<CapabilityPacketExportResult>()
  const [draft, setDraft] = useState<ModuleManifest | undefined>()
  const [response, setResponse] = useState<ModuleInterviewResponse | undefined>()
  const [diagnostics, setDiagnostics] = useState<CapDiagnostic[]>([])
  const [gatePassed, setGatePassed] = useState<boolean | undefined>()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [implementationExport, setImplementationExport] = useState<CapabilityPacketExportResult>()
  const [implementationRunId, setImplementationRunId] = useState('')
  const [persistedLifecycleState, setPersistedLifecycleState] = useState('')
  const [zipPath, setZipPath] = useState('')
  const [inspection, setInspection] = useState<OverlayInspectionSummary>()
  const [warningsAccepted, setWarningsAccepted] = useState(false)
  const [applied, setApplied] = useState(false)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // Resume any persisted implementation run for this module (lifecycle survives remount/reload).
  useEffect(() => {
    if (!projectId || !moduleId) return
    let cancelled = false
    void bridge.capabilitiesListRuns(projectId)
      .then((values) => {
        if (cancelled || !mounted.current) return
        const matching = (values as CapabilityRunScope[])
          .filter((run) => run.targetOwnerId === moduleId && run.kind === 'implementation')
          .sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))[0]
        setImplementationRunId(matching?.runId ?? '')
        setPersistedLifecycleState(matching?.lifecycleState ?? '')
      })
      .catch((error) => {
        if (!cancelled && mounted.current) {
          setMessage(guided ? 'Implementation progress could not be loaded.' : error instanceof Error ? error.message : String(error))
        }
      })
    return () => { cancelled = true }
  }, [bridge, projectId, moduleId])

  const belongsToActiveModule = (candidateModuleId: string) =>
    candidateModuleId === moduleId && (architecture?.moduleIds.includes(moduleId) ?? false)

  async function exportPacket() {
    if (busy) return
    if (!architecture) {
      setMessage('Architecture must be approved before module interviews.')
      return
    }
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
        packetId: built.packetId, projectId: built.projectId, interviewKind: built.interviewKind,
        gateId: built.gateId, inputContext: built.inputContext, interviewBoundary: built.interviewBoundary, stateLabels: built.stateLabels,
      })
      if (!mounted.current) return
      setPacket(built)
      setInterviewExport(exported)
      setMessage(guided ? '' : `Exported ${exported.files.length} ${selectedType} module interview files for ${moduleId}. Applicable details: ${applicableDetailsFor(selectedType).join(', ')}.`)
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  async function handleImport(result: InterviewImportResult) {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const parsed = result.parsed ?? JSON.parse(result.rawText)
      const imported = importModuleInterviewResponse(parsed)
      // Guard: never accept a response for a different module.
      if (imported.manifest && imported.manifest.moduleId !== moduleId) {
        setMessage(guided
          ? `That response is for a different module (${humanizeIdentifier(imported.manifest.moduleId)}). Import the response for ${humanizeIdentifier(moduleId)}.`
          : `Response module ${imported.manifest.moduleId} does not match selected module ${moduleId}; not saved.`)
        return
      }
      if (!mounted.current) return
      setResponse(imported.response)
      setDraft(imported.manifest)
      setDiagnostics(imported.diagnostics)
      setGatePassed(imported.ok)
      if (imported.manifest) await bridge.capabilitiesSaveModuleDraft(projectId, imported.manifest)
      setMessage(imported.ok
        ? 'Imported module draft. Review gate findings, then approve.'
        : guided ? `Imported with ${imported.diagnostics.length} issue(s) to resolve before approval.` : `Module draft blocked by CAP-GATE-003 (${imported.diagnostics.length} finding(s)).`)
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  async function approve() {
    if (busy || !draft) return
    // Guard: draft must be for the active module of the active architecture.
    if (!belongsToActiveModule(draft.moduleId)) {
      setMessage(guided ? 'This draft is not for the selected module.' : `Draft module ${draft.moduleId} is not the active module ${moduleId}; not approved.`)
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const result = await bridge.capabilitiesApproveModule(projectId, draft)
      if (!mounted.current) return
      if (!result.ok) {
        setDiagnostics(((result.gate as { diagnostics?: CapDiagnostic[] })?.diagnostics) ?? [])
        setGatePassed(false)
        setMessage(guided ? 'Not ready to approve — resolve the issues above first.' : 'CAP-GATE-003 blocked module approval.')
        return
      }
      await props.onChanged()
      if (!mounted.current) return
      setGatePassed(true)
      setMessage(guided ? 'Module approved.' : `Approved module ${draft.moduleId}@${draft.moduleVersion}.`)
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  async function exportImplementation() {
    if (busy || !isApproved) return
    setBusy(true)
    try {
      const exported = await bridge.capabilitiesExportImplementationPacket({ projectId, moduleId })
      if (!mounted.current) return
      setImplementationExport(exported)
      setImplementationRunId(exported.runId)
      setPersistedLifecycleState('packet-exported')
      setInspection(undefined)
      setWarningsAccepted(false)
      setApplied(false)
      setZipPath('')
      setMessage(guided ? '' : `Exported ${exported.files.length} implementation handoff files for ${moduleId}.`)
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  async function selectAndInspectOverlay() {
    if (busy || !implementationRunId) return
    const selected = await bridge.pickZipFile()
    if (!selected) return
    setBusy(true)
    try {
      const next = await bridge.capabilitiesInspectOverlay({ projectId, runId: implementationRunId, zipPath: selected })
      if (!mounted.current) return
      setZipPath(selected)
      setInspection(next)
      setWarningsAccepted(false)
      setApplied(false)
      setMessage(next.canApply ? `Inspected overlay with ${next.warnings.length} warning(s).` : `Overlay blocked by ${next.hardBlockers.length} issue(s).`)
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  async function applyInspectedOverlay() {
    if (busy || !implementationRunId || !zipPath || !inspection?.canApply) return
    setBusy(true)
    try {
      const result = await bridge.capabilitiesApplyOverlay({
        projectId, runId: implementationRunId, zipPath,
        acceptWarnings: inspection.warnings.length === 0 || warningsAccepted, explicit: true,
      })
      if (!mounted.current) return
      setApplied(true)
      setPersistedLifecycleState('overlay-applied')
      setMessage(`Applied ${result.files.length} file(s); verification is now required.`)
      await props.onChanged()
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  async function verifyApprovedModule() {
    if (busy || !isApproved) return
    setBusy(true)
    try {
      const result = await bridge.capabilitiesVerifyApprovedModule({ projectId, moduleId, explicit: true })
      if (!mounted.current) return
      setMessage(guided ? `Verification: ${result.record.outcome}.` : `Verification outcome: ${result.record.outcome}.`)
      await props.onChanged()
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  type BuildStep = 'interview' | 'import' | 'approve' | 'handoff' | 'inspect' | 'accept' | 'apply' | 'verify'
  const implementationStarted = Boolean(implementationExport) || ['packet-exported', 'overlay-inspected', 'overlay-applied'].includes(persistedLifecycleState)
  const implementationApplied = applied || persistedLifecycleState === 'overlay-applied'
  const buildStep: BuildStep = !isApproved
    ? draft ? 'approve' : interviewExport ? 'import' : 'interview'
    : implementationApplied ? 'verify'
      : !implementationStarted ? 'handoff'
      : !inspection ? 'inspect'
        : inspection.warnings.length > 0 && !warningsAccepted ? 'accept'
          : inspection.canApply && !applied ? 'apply'
            : applied ? 'verify'
              : 'inspect'
  const BUILD_STEP_LABEL: Record<BuildStep, string> = {
    interview: 'Create the module interview', import: 'Import the response', approve: 'Review and approve',
    handoff: 'Create the implementation handoff', inspect: 'Select and inspect the overlay',
    accept: 'Review and accept warnings', apply: 'Apply the reviewed overlay', verify: 'Ready for verification',
  }

  const overlayInspection = inspection ? (
    <div aria-label="Capability overlay inspection" className="cap-overlay-inspect">
      {inspection.hardBlockers.length ? <ul className="cap-issue-list">{inspection.hardBlockers.map((item, index) => <li key={`${item.ruleId}-${index}`}>{guided ? item.message : `${item.ruleId}: ${item.message}`} <span className="badge">cannot apply</span></li>)}</ul> : null}
      {inspection.warnings.length ? <ul>{inspection.warnings.map((item, index) => <li key={`${item.ruleId}-${index}`}>Warning: {guided ? item.message : `${item.ruleId}: ${item.message}`}</li>)}</ul> : <p className="capabilities-note">No overlay warnings.</p>}
      {inspection.warnings.length ? <label className="cap-accept-warnings"><input type="checkbox" checked={warningsAccepted} onChange={(e) => setWarningsAccepted(e.target.checked)} /> I reviewed and accept every overlay warning</label> : null}
    </div>
  ) : null

  const progressiveNextAction = (
    <div className="cap-build-next" role="group" aria-label="Next action">
      <p className="cap-build-step-label"><span className="badge">Next</span> {BUILD_STEP_LABEL[buildStep]}</p>
      {buildStep === 'interview' && (
        <>
          <label className="cap-connect-field">Kind of module
            <select value={selectedType} onChange={(e) => setSelectedType(e.target.value as ModuleType)} aria-label="Module interview type" disabled={busy}>
              {MODULE_TYPES.map((type) => <option key={type} value={type}>{moduleTypeLabel(type)}</option>)}
            </select>
          </label>
          <button type="button" className="btn btn-primary btn-compact" onClick={() => void exportPacket()} disabled={!projectId || busy}>Create interview</button>
        </>
      )}
      {buildStep === 'import' && (
        <>
          {interviewExport ? <CapabilityHandoffCard bridge={bridge} result={interviewExport} projection="guided" /> : null}
          <InterviewImport label="Import module interview response" onImport={(r) => void handleImport(r)} disabled={!projectId || busy} projection={projection} />
        </>
      )}
      {buildStep === 'approve' && (
        <>
          {response ? <p className="capabilities-note">Draft ready ({response.answers.length} answers). Review and approve.</p> : null}
          <button type="button" className="btn btn-primary btn-compact" onClick={() => void approve()} disabled={!projectId || !draft || busy || gatePassed === false}>Approve module</button>
        </>
      )}
      {buildStep === 'handoff' && (
        <button type="button" className="btn btn-primary btn-compact" onClick={() => void exportImplementation()} disabled={busy}>Create implementation handoff</button>
      )}
      {buildStep === 'inspect' && (
        <>
          {implementationExport ? <CapabilityHandoffCard bridge={bridge} result={implementationExport} projection="guided" /> : null}
          <button type="button" className="btn btn-primary btn-compact" onClick={() => void selectAndInspectOverlay()} disabled={busy || !implementationRunId}>Select and inspect overlay</button>
        </>
      )}
      {buildStep === 'accept' && overlayInspection}
      {buildStep === 'apply' && (
        <>
          {overlayInspection}
          <button type="button" className="btn btn-primary btn-compact" onClick={() => void applyInspectedOverlay()} disabled={busy || !inspection?.canApply}>Apply reviewed overlay</button>
        </>
      )}
      {buildStep === 'verify' && (
        <button type="button" className="btn btn-primary btn-compact" onClick={() => void verifyApprovedModule()} disabled={busy}>Run verification</button>
      )}
    </div>
  )

  const diagnosticsBlock = diagnostics.length > 0 ? (
    guided ? (
      <ul aria-label="Open issues" className="cap-issue-list">
        {presentDiagnosticsForGuided(diagnostics).map((issue, i) => <li key={i}>{issue.message}</li>)}
      </ul>
    ) : (
      <ul aria-label="Module gate diagnostics">
        {diagnostics.map((d, i) => (
          <li key={`${d.code}-${i}`}>{d.code}: {d.message}{d.fieldPath ? ` [${d.fieldPath}]` : ''}</li>
        ))}
      </ul>
    )
  ) : null

  return (
    <>
      {message ? <p role="status">{message}</p> : <p role="status" className="sr-only">Ready.</p>}

      {progressive ? (
        progressiveNextAction
      ) : (
        <>
          <label>
            Module type
            <select value={selectedType} onChange={(e) => setSelectedType(e.target.value as ModuleType)} aria-label="Module interview type" disabled={busy}>
              {MODULE_TYPES.map((type) => <option key={type} value={type}>{guided ? moduleTypeLabel(type) : type}</option>)}
            </select>
          </label>

          {projection === 'design' ? (
            <p className="capabilities-note">Applicable details ({selectedType}): {applicableDetailsFor(selectedType).join(', ')}</p>
          ) : null}

          <div className="capabilities-toolbar" role="group" aria-label="Module interview actions">
            <button type="button" onClick={() => void exportPacket()} disabled={!projectId || busy}>Export module interview</button>
            <button type="button" onClick={() => void approve()} disabled={!projectId || !draft || busy || gatePassed === false}>Approve module</button>
          </div>

          {packet && !guided ? (
            <details open><summary>Interview packet {packet.packetId}</summary><pre className="capabilities-pre">{JSON.stringify(packet, null, 2)}</pre></details>
          ) : null}

          <InterviewImport label="Import module interview response" onImport={(r) => void handleImport(r)} disabled={!projectId || busy} projection={projection} />

          <section aria-label="Module implementation lifecycle">
            <h3>Implementation lifecycle</h3>
            <div className="capabilities-toolbar" role="group" aria-label="Implementation actions">
              <button type="button" disabled={busy || !isApproved} onClick={() => void exportImplementation()}>Export implementation packet</button>
              <button type="button" disabled={busy || !implementationRunId} onClick={() => void selectAndInspectOverlay()}>Select and inspect overlay</button>
              <button type="button" disabled={busy || !inspection?.canApply || (inspection.warnings.length > 0 && !warningsAccepted)} onClick={() => void applyInspectedOverlay()}>Apply reviewed overlay</button>
              <button type="button" disabled={busy || !isApproved} onClick={() => void verifyApprovedModule()}>Verify module</button>
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
            {overlayInspection}
          </section>
        </>
      )}

      {diagnosticsBlock}

      {draft && projection === 'design' ? (
        <details><summary>Manifest draft {draft.moduleId}</summary><pre className="capabilities-pre">{JSON.stringify(draft, null, 2)}</pre></details>
      ) : null}

      {response && guided ? (
        <p className="capabilities-note">Draft {humanizeIdentifier(response.moduleId)} ({moduleTypeLabel(response.moduleType)}) — {response.answers.length} answers.</p>
      ) : null}
    </>
  )
}
