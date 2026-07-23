/**
 * Module interview workflows — type-specific export/import/approve (CAP-PKT-011).
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
  FoundationPlan,
  FrontendBrief,
  ImplementationWavePlan,
  InterviewPacket,
  ModuleManifest,
  OverlayInspectionSummary,
} from '@engineering-ui-kit/core'
import {
  applicableDetailsFor,
  buildModuleInterviewPacket,
  inferModuleType,
  importModuleInterviewResponse,
  normalizeWorkLifecycleState,
  type ModuleInterviewResponse,
} from '@engineering-ui-kit/core/browser'
import type {
  CapabilityPacketExportResult,
  EuikBridge,
  ImplementationWaveExportResult,
  ModuleProposalBatchResult,
  TaskPacketFields,
  TaskPacketTextKey,
} from '../../bridge'
import { Dialog, EmptyState } from '../../components'
import { Icon } from '../../icons'
import { InterviewImport, type InterviewImportResult } from './InterviewImport'
import { CapabilityHandoffCard } from './CapabilityHandoffCard'
import { humanizeIdentifier, moduleTypeLabel, presentDiagnosticsForGuided } from './capabilityPresentation'
import { deploymentContextFor } from './moduleBuildTask'

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
  onStartUiBuild?: (projectId: string, fields: TaskPacketFields) => Promise<void>
  /** WP5A (CAP-TEST-070/WP5B backing) — the project's approved foundation plan, if any, for From-spec deployment enrichment. */
  approvedFoundation?: FoundationPlan
  /** WP5A bullet (d) — blocks the implementation handoff (agent build / implementation packet) until an approved, non-stale foundation exists. Defaults to enabled for callers that predate foundation planning. */
  foundationGate?: { enabled: boolean; reason?: string }
}


function asArch(value: unknown): ArchitectureSpecification | undefined {
  if (!value || typeof value !== 'object') return undefined
  return value as ArchitectureSpecification
}

function runtimeLabel(runtime: ModuleManifest['runtimeAllocation'] | undefined): string {
  if (runtime === 'local-embedded') return 'Inside this application'
  if (runtime === 'external-adapter') return 'Through a connected service'
  return 'Not assigned'
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
  onStartUiBuild,
  approvedFoundation,
  foundationGate = { enabled: true },
}: Props) {
  const guided = projection === 'guided'
  const [architecture, setArchitecture] = useState<ArchitectureSpecification | undefined>()
  const [internalSelected, setInternalSelected] = useState('')
  const [proposalBatch, setProposalBatch] = useState<ModuleProposalBatchResult>()
  const [selectedProposalIds, setSelectedProposalIds] = useState<string[]>([])
  const [wavePlan, setWavePlan] = useState<ImplementationWavePlan>()
  const [waveExport, setWaveExport] = useState<ImplementationWaveExportResult>()
  const [batchBusy, setBatchBusy] = useState(false)
  const [batchMessage, setBatchMessage] = useState('')
  const approvedIds = records.filter((r) => Boolean(r.approved)).map((r) => r.moduleId)
  const moduleIds = architecture?.moduleIds ?? []
  const selectedModuleId = externalSelectedModuleId ?? internalSelected
  const unapprovedIds = moduleIds.filter((moduleId) => !approvedIds.includes(moduleId))

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

  useEffect(() => {
    if (!projectId || !architectureApproved) {
      setWavePlan(undefined)
      return
    }
    let cancelled = false
    void Promise.resolve()
      .then(() => bridge.capabilitiesPlanImplementationWaves(projectId))
      .then((result) => {
        if (
          !cancelled
          && result
          && Array.isArray(result.waves)
          && Array.isArray(result.blockedCycles)
          && Array.isArray(result.unapprovedModuleIds)
          && Array.isArray(result.blockedByUnapproved)
        ) setWavePlan(result)
      })
      .catch(() => {
        if (!cancelled) setWavePlan(undefined)
      })
    return () => { cancelled = true }
  }, [
    bridge,
    projectId,
    architectureApproved,
    records.map((record) => `${record.moduleId}:${record.approved ? 'approved' : record.draft ? 'draft' : 'empty'}`).join('|'),
  ])

  async function generateProposalBatch() {
    if (batchBusy) return
    setBatchBusy(true)
    setBatchMessage('')
    try {
      const result = await bridge.capabilitiesProposeModuleBatch(projectId)
      setProposalBatch(result)
      setSelectedProposalIds(result.proposals
        .map((proposal) => proposal.moduleId)
        .filter((moduleId) => !approvedIds.includes(moduleId)))
      await onChanged()
      setBatchMessage(
        result.savedDraftModuleIds.length
          ? `Prepared ${result.savedDraftModuleIds.length} new module proposal(s). Review the highlighted exceptions, then approve the selected set.`
          : 'Loaded the current module proposals without replacing existing work.',
      )
    } catch (error) {
      setBatchMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBatchBusy(false)
    }
  }

  async function approveProposalBatch() {
    if (batchBusy || selectedProposalIds.length === 0) return
    setBatchBusy(true)
    setBatchMessage('')
    try {
      const result = await bridge.capabilitiesApproveModuleBatch({
        projectId,
        moduleIds: selectedProposalIds,
        explicit: true,
      })
      const blocked = result.results.filter((entry) => !entry.ok)
      setSelectedProposalIds(blocked.map((entry) => entry.moduleId))
      await onChanged()
      const nextPlan = await bridge.capabilitiesPlanImplementationWaves(projectId)
      setWavePlan(nextPlan)
      setBatchMessage(blocked.length
        ? `${result.results.length - blocked.length} proposal(s) approved; ${blocked.length} need focused review.`
        : `${result.results.length} module proposal(s) approved. The implementation waves are ready.`)
    } catch (error) {
      setBatchMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBatchBusy(false)
    }
  }

  function toggleProposal(moduleId: string) {
    setSelectedProposalIds((current) =>
      current.includes(moduleId)
        ? current.filter((candidate) => candidate !== moduleId)
        : [...current, moduleId],
    )
  }

  async function exportImplementationWave(waveIndex: number, moduleIds: string[]) {
    if (batchBusy || !foundationGate.enabled) return
    setBatchBusy(true)
    setBatchMessage('')
    try {
      const result = await bridge.capabilitiesExportImplementationWave({
        projectId,
        waveIndex,
        moduleIds,
      })
      setWaveExport(result)
      setBatchMessage(
        `Created one handoff for ${result.targets.length} target(s). Each target keeps its own result ZIP, inspection, and verification evidence.`,
      )
    } catch (error) {
      setBatchMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBatchBusy(false)
    }
  }

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

      {moduleIds.length > 0 && (
        <section className="cap-batch-planner" aria-label="Architecture-wide module review">
          <div className="cap-batch-planner-head">
            <div>
              <p className="capabilities-eyebrow">Fast path</p>
              <h3>Review modules as one architecture</h3>
              <p>
                Generate every allocated module together, review shared assumptions once, and
                use focused interviews only where the architecture leaves an exception.
              </p>
            </div>
            {!proposalBatch && unapprovedIds.length > 0 ? (
              <button
                type="button"
                className="btn btn-primary btn-compact"
                disabled={batchBusy}
                onClick={() => void generateProposalBatch()}
              >
                {batchBusy ? 'Generating…' : `Generate all ${unapprovedIds.length} proposals`}
              </button>
            ) : null}
          </div>

          {proposalBatch ? (
            <>
              <details className="cap-batch-assumptions">
                <summary>Shared assumptions ({proposalBatch.commonAssumptions.length})</summary>
                <ul>
                  {proposalBatch.commonAssumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}
                </ul>
              </details>
              <div className="cap-batch-proposal-grid">
                {proposalBatch.proposals.map((proposal) => {
                  const approved = approvedIds.includes(proposal.moduleId)
                  const selected = selectedProposalIds.includes(proposal.moduleId)
                  return (
                    <article
                      key={proposal.moduleId}
                      className={`cap-batch-proposal${proposal.exceptionReasons.length ? ' has-exceptions' : ''}`}
                    >
                      <label>
                        <input
                          type="checkbox"
                          checked={approved || selected}
                          disabled={approved || batchBusy}
                          onChange={() => toggleProposal(proposal.moduleId)}
                        />
                        <span>
                          <strong>{proposal.manifest.name}</strong>
                          <small>{moduleTypeLabel(proposal.manifest.moduleType)} · {approved ? 'approved' : 'proposal'}</small>
                        </span>
                      </label>
                      <p>{proposal.manifest.responsibility}</p>
                      {proposal.exceptionReasons.length ? (
                        <ul aria-label={`Exceptions for ${proposal.manifest.name}`}>
                          {proposal.exceptionReasons.map((reason) => <li key={reason}>{reason}</li>)}
                        </ul>
                      ) : <span className="cap-batch-clear">No architecture exceptions</span>}
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => (onSelectModule ? onSelectModule(proposal.moduleId) : setInternalSelected(proposal.moduleId))}
                      >
                        Review details
                      </button>
                    </article>
                  )
                })}
              </div>
              {selectedProposalIds.length > 0 ? (
                <div className="cap-batch-approval">
                  <p>
                    This explicitly approves {selectedProposalIds.length} selected proposal(s);
                    existing approved modules are never replaced.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-compact"
                    disabled={batchBusy}
                    onClick={() => void approveProposalBatch()}
                  >
                    {batchBusy ? 'Approving…' : `Approve selected proposals (${selectedProposalIds.length})`}
                  </button>
                </div>
              ) : null}
            </>
          ) : unapprovedIds.length === 0 ? (
            <p className="capabilities-note">All allocated modules are approved.</p>
          ) : null}

          {wavePlan && (wavePlan.waves.length > 0 || wavePlan.blockedCycles.length > 0) ? (
            <div className="cap-wave-plan" aria-label="Implementation waves">
              <div>
                <h4>Implementation waves</h4>
                <p>Independent modules share a wave; dependencies are completed first.</p>
              </div>
              {wavePlan.waves.map((wave) => (
                <div className="cap-wave" key={wave.index}>
                  <span>Wave {wave.index}</span>
                  <div>
                    {wave.targets.map((target) => (
                      <button
                        type="button"
                        key={target.moduleId}
                        onClick={() => (onSelectModule ? onSelectModule(target.moduleId) : setInternalSelected(target.moduleId))}
                      >
                        {target.name}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="cap-wave-export"
                      disabled={batchBusy || !foundationGate.enabled}
                      title={!foundationGate.enabled ? foundationGate.reason ?? 'Approve the foundation first.' : undefined}
                      onClick={() => void exportImplementationWave(
                        wave.index,
                        wave.targets.filter((target) => target.batchEligible).map((target) => target.moduleId),
                      )}
                    >
                      {Icon.sparkle(13)} Create one handoff
                    </button>
                  </div>
                </div>
              ))}
              {wavePlan.unapprovedModuleIds.length ? (
                <p className="capabilities-note">
                  {wavePlan.unapprovedModuleIds.length} unapproved module(s) are omitted from the plan.
                </p>
              ) : null}
              {wavePlan.blockedByUnapproved.map((blocked) => (
                <p className="capabilities-note" key={blocked.moduleId}>
                  {humanizeIdentifier(blocked.moduleId)} waits for {blocked.dependencyIds.map(humanizeIdentifier).join(', ')}.
                </p>
              ))}
              {wavePlan.blockedCycles.map((cycle) => (
                <p className="cap-batch-error" key={cycle.join('>')}>
                  Dependency cycle blocks implementation: {cycle.join(' → ')}
                </p>
              ))}
            </div>
          ) : null}

          {waveExport && waveExport.targets[0] ? (
            <CapabilityHandoffCard
              bridge={bridge}
              projectId={projectId}
              projection={projection}
              result={{
                runId: waveExport.targets[0].runId,
                packetId: waveExport.groupId,
                recommendedPrompt: waveExport.recommendedPrompt,
                files: waveExport.files,
                uploadFiles: waveExport.uploadFiles,
              }}
            />
          ) : null}

          {batchMessage ? <p className="capabilities-note" role="status">{batchMessage}</p> : null}
        </section>
      )}

      {/* key: remount (full reset of every module-scoped value) when project or module changes. */}
      <ModuleWorkspace
        key={`${projectId}:${selectedModuleId}`}
        bridge={bridge}
        projectId={projectId}
        moduleId={selectedModuleId}
        architecture={architecture}
        record={records.find((record) => record.moduleId === selectedModuleId)}
        isApproved={approvedIds.includes(selectedModuleId)}
        projection={projection}
        progressive={progressive}
        onChanged={onChanged}
        onStartUiBuild={onStartUiBuild}
        approvedFoundation={approvedFoundation}
        foundationGate={foundationGate}
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
  record?: CapabilityModuleRecord
  isApproved: boolean
  projection: 'guided' | 'design'
  progressive: boolean
  onChanged: () => Promise<void>
  onStartUiBuild?: (projectId: string, fields: TaskPacketFields) => Promise<void>
  approvedFoundation?: FoundationPlan
  foundationGate: { enabled: boolean; reason?: string }
}) {
  const { bridge, projectId, moduleId, architecture, record, isApproved, projection, progressive, foundationGate } = props
  const guided = projection === 'guided'
  const handoffBlocked = !foundationGate.enabled
  const foundationPrerequisiteMessage = `Foundation must be approved first.${foundationGate.reason ? ` ${foundationGate.reason}` : ''}`
  const architectureModule = architecture?.moduleDefinitions?.find((definition) => definition.moduleId === moduleId)
  const selectedType = architectureModule?.moduleType ?? inferModuleType(moduleId, architectureModule?.name)
  const [packet, setPacket] = useState<InterviewPacket | undefined>()
  const [interviewExport, setInterviewExport] = useState<CapabilityPacketExportResult>()
  const [draft, setDraft] = useState<ModuleManifest | undefined>(record?.draft)
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
  const [revisitingInterview, setRevisitingInterview] = useState(false)
  const [technicalOpen, setTechnicalOpen] = useState(false)
  const [frontendBrief, setFrontendBrief] = useState<FrontendBrief>()
  const [frontendFields, setFrontendFields] = useState<TaskPacketFields>()
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

  async function exportPacket(moduleVersion?: string) {
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
        moduleVersion,
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
      if (imported.manifest) {
        await bridge.capabilitiesSaveModuleDraft(projectId, imported.manifest, imported.response)
        await props.onChanged()
      }
      if (!mounted.current) return
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
      const result = await bridge.capabilitiesApproveModule(projectId, draft, response)
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
      setRevisitingInterview(false)
      setMessage(guided ? 'Module approved.' : `Approved module ${draft.moduleId}@${draft.moduleVersion}.`)
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  async function exportImplementation() {
    if (busy || !isApproved || handoffBlocked) return
    setBusy(true)
    try {
      const exported = await bridge.capabilitiesExportImplementationPacket({ projectId, moduleId })
      if (!mounted.current) return
      setImplementationExport(exported)
      setImplementationRunId(exported.runId)
      setPersistedLifecycleState('exported')
      setInspection(undefined)
      setWarningsAccepted(false)
      setApplied(false)
      setZipPath('')
      const readiness = exported.readiness
      if (readiness?.status === 'blocked') {
        setMessage(`Implementation handoff created, but repository setup is incomplete: ${readiness.issues.map((issue) => issue.message).join(' ')}`)
      } else if (readiness?.status === 'ready-with-gaps') {
        setMessage(`Implementation handoff created with ${readiness.issues.length} documented context gap(s). Copilot is instructed to inspect the repository and ask only if a material decision remains ambiguous.`)
      } else {
        setMessage(guided ? 'Implementation-ready handoff created.' : `Exported ${exported.files.length} implementation handoff files for ${moduleId}.`)
      }
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  async function startUiAgentBuild() {
    const manifest = record?.approved
    if (busy || !manifest || !architecture || !props.onStartUiBuild || handoffBlocked) return
    setBusy(true)
    setMessage('Compiling product, capability, operation, and binding evidence into the frontend brief…')
    try {
      const deployment = deploymentContextFor(props.approvedFoundation, manifest.moduleId, manifest)
      const compiled = await bridge.capabilitiesCompileFrontendBrief({
        projectId,
        targetModuleIds: [manifest.moduleId],
      })
      const fields: TaskPacketFields = {
        ...compiled.fields,
        references: [
          compiled.fields.references,
          ...(deployment
            ? [
                `Deployable: ${deployment.deployableId} (${deployment.kind}, ${deployment.runtimeLanguage} ${deployment.runtimeVersionRange})`,
                `Composition root: ${deployment.compositionRootPath}`,
                ...Object.entries(deployment.commands).map(([label, command]) => `Command (${label}): ${command}`),
                ...deployment.generatedContractRefs.map((reference) => `Generated contract: ${reference}`),
                ...deployment.generatedTypeTargets.map((reference) => `Generated type target: ${reference}`),
              ]
            : []),
        ].filter(Boolean).join('\n'),
      }
      setFrontendBrief(compiled)
      setFrontendFields(fields)
      setMessage('')
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  async function openCompiledFrontendBuild() {
    if (busy || !frontendFields || !props.onStartUiBuild) return
    setBusy(true)
    try {
      await props.onStartUiBuild(projectId, frontendFields)
      if (mounted.current) {
        setFrontendBrief(undefined)
        setFrontendFields(undefined)
      }
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  function updateFrontendField(key: TaskPacketTextKey, value: string) {
    setFrontendFields((current) => current ? { ...current, [key]: value } : current)
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
      setPersistedLifecycleState('applied')
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

  async function revisitInterview() {
    if (busy) return
    const currentVersion = record?.approved?.moduleVersion ?? '1.0.0'
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(currentVersion)
    const nextVersion = match
      ? `${match[1]}.${match[2]}.${Number(match[3]) + 1}`
      : '1.0.1'
    setRevisitingInterview(true)
    setDraft(undefined)
    setResponse(undefined)
    setDiagnostics([])
    setGatePassed(undefined)
    setInterviewExport(undefined)
    await exportPacket(nextVersion)
  }

  type BuildStep = 'interview' | 'import' | 'approve' | 'handoff' | 'inspect' | 'accept' | 'apply' | 'verify'
  const normalizedImplementationState = normalizeWorkLifecycleState(persistedLifecycleState).state
  const implementationStarted = Boolean(implementationExport)
    || ['exported', 'returned', 'inspected', 'applied', 'verified', 'integrated', 'complete'].includes(normalizedImplementationState)
  const implementationApplied = applied
    || ['applied', 'verified', 'integrated', 'complete'].includes(normalizedImplementationState)
  const moduleReady = record?.freshness?.primaryState === 'ready'
  const buildStep: BuildStep = revisitingInterview
    ? draft ? 'approve' : interviewExport ? 'import' : 'interview'
    : !isApproved
    ? draft ? 'approve' : interviewExport ? 'import' : 'interview'
    : implementationApplied ? 'verify'
      : !implementationStarted ? 'handoff'
      : !inspection ? 'inspect'
        : inspection.warnings.length > 0 && !warningsAccepted ? 'accept'
          : inspection.canApply && !applied ? 'apply'
            : applied ? 'verify'
              : 'inspect'
  const BUILD_STEP_LABEL: Record<BuildStep, string> = {
    interview: 'Generate the module draft', import: 'Import the response', approve: 'Review and approve',
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
          <button type="button" className="btn btn-primary btn-compact" onClick={() => void exportPacket()} disabled={!projectId || busy}>Generate guided draft</button>
          <p className="capabilities-note">Copilot pre-fills the full module specification from Design and asks you to accept or correct only material assumptions.</p>
          <p className="capabilities-note cap-assigned-module-type"><span className="badge">{moduleTypeLabel(selectedType)}</span> Assigned during Design</p>
        </>
      )}
      {buildStep === 'import' && (
        <>
          {interviewExport ? <CapabilityHandoffCard bridge={bridge} projectId={projectId} result={interviewExport} projection="guided" /> : null}
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
        <div className="cap-ui-build-options">
          {handoffBlocked ? (
            <p className="capabilities-note cap-foundation-prerequisite" role="status">
              {foundationPrerequisiteMessage}
            </p>
          ) : null}
          {selectedType === 'experience' && props.onStartUiBuild ? (
            <div className="cap-ui-build-agent">
              <span className="capabilities-eyebrow">Recommended for UI modules</span>
              <strong>Build the UI with the agent</strong>
              <p>Open Build &amp; Test with this module’s approved responsibilities, operations, paths, and architecture boundaries already prepared.</p>
              <button type="button" className="btn btn-primary btn-compact" onClick={() => void startUiAgentBuild()} disabled={busy || handoffBlocked}>
                {Icon.sparkle(14)} Compile frontend brief
              </button>
            </div>
          ) : null}
          <div className="cap-ui-build-manual">
            <strong>{selectedType === 'experience' ? 'Or use an external implementation handoff' : 'Create the implementation handoff'}</strong>
            <button type="button" className="btn btn-secondary btn-compact" onClick={() => void exportImplementation()} disabled={busy || handoffBlocked}>Create implementation handoff</button>
          </div>
        </div>
      )}
      {buildStep === 'inspect' && (
        <>
          {implementationExport ? <CapabilityHandoffCard bridge={bridge} projectId={projectId} result={implementationExport} projection="guided" /> : null}
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
        <button
          type="button"
          className={`btn ${moduleReady ? 'btn-secondary' : 'btn-primary'} btn-compact`}
          onClick={() => void verifyApprovedModule()}
          disabled={busy}
        >
          {moduleReady ? 'Re-run verification' : 'Run verification'}
        </button>
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

  const interviewOutcome = draft ?? record?.draft ?? record?.approved
  const moduleDisplayName = interviewOutcome?.name ?? architectureModule?.name ?? humanizeIdentifier(moduleId)
  const outcomeModuleType = interviewOutcome?.moduleType ?? selectedType
  const requiredOperations = interviewOutcome?.requiredOperations ?? []
  const providedOperations = interviewOutcome?.providedOperations ?? []
  const ownedConcerns = interviewOutcome?.ownedConcerns ?? []
  const excludedConcerns = interviewOutcome?.excludedConcerns ?? []
  const verificationSuiteIds = interviewOutcome?.verificationSuiteIds ?? []
  const outcomeState = revisitingInterview ? 'Revising' : isApproved ? 'Approved' : interviewOutcome ? 'Draft' : 'Waiting for interview'
  const interviewOutcomePanel = (
    <section className="cap-build-outcome" aria-label={`Interview outcome for ${moduleDisplayName}`}>
      <div className="cap-build-outcome-head">
        <div>
          <p className="capabilities-eyebrow">Interview outcome</p>
          <h3>{moduleDisplayName}</h3>
        </div>
        <span className={`badge cap-build-outcome-state ${outcomeState.toLowerCase().replaceAll(' ', '-')}`}>{outcomeState}</span>
      </div>

      {interviewOutcome ? (
        <>
          <p className="cap-build-outcome-responsibility">{interviewOutcome.responsibility || architectureModule?.responsibility || 'The module interview outcome is ready for review.'}</p>
          <div className="cap-build-outcome-facts">
            <div><span>Module type</span><strong>{moduleTypeLabel(outcomeModuleType)}</strong></div>
            <div><span>Runs</span><strong>{runtimeLabel(interviewOutcome.runtimeAllocation)}</strong></div>
          </div>

          <div className="cap-build-operation-map" aria-label="Module operation map">
            <div className="cap-build-operation-side incoming">
              <span>Uses</span>
              {requiredOperations.length
                ? requiredOperations.map((operation) => <code key={operation.operationId}>{humanizeIdentifier(operation.operationId)}</code>)
                : <em>No required operations</em>}
            </div>
            <div className="cap-build-operation-module">
              <span>{moduleTypeLabel(outcomeModuleType)}</span>
              <strong>{moduleDisplayName}</strong>
            </div>
            <div className="cap-build-operation-side outgoing">
              <span>Provides</span>
              {providedOperations.length
                ? providedOperations.map((operation) => <code key={operation.operationId}>{humanizeIdentifier(operation.operationId)}</code>)
                : <em>No provided operations</em>}
            </div>
          </div>

          <div className="cap-build-outcome-groups">
            <div>
              <h4>Owns</h4>
              <div className="cap-build-chip-list">
                {ownedConcerns.length
                  ? ownedConcerns.map((concern) => <span key={concern}>{humanizeIdentifier(concern)}</span>)
                  : <span className="muted">No concerns recorded</span>}
              </div>
            </div>
            <div>
              <h4>Does not own</h4>
              <div className="cap-build-chip-list excluded">
                {excludedConcerns.length
                  ? excludedConcerns.map((concern) => <span key={concern}>{humanizeIdentifier(concern)}</span>)
                  : <span className="muted">No exclusions recorded</span>}
              </div>
            </div>
          </div>

          <div className="cap-build-outcome-actions">
            <button type="button" className="btn btn-secondary btn-compact" onClick={() => setTechnicalOpen(true)}>
              Technical specification
            </button>
            <button type="button" className="btn btn-secondary btn-compact" onClick={() => void revisitInterview()} disabled={busy || revisitingInterview}>
              Revisit interview
            </button>
          </div>

          {technicalOpen ? (
            <Dialog
              title={`${moduleDisplayName} technical specification`}
              wide
              onClose={() => setTechnicalOpen(false)}
              actions={<button type="button" className="btn btn-primary" onClick={() => setTechnicalOpen(false)}>Close</button>}
            >
              <p className="lede">Exact implementation and verification details from the approved module record.</p>
              <dl className="capabilities-ids">
                <div><dt>Module ID</dt><dd><code>{interviewOutcome.moduleId}</code></dd></div>
                <div><dt>Version</dt><dd><code>{interviewOutcome.moduleVersion}</code></dd></div>
                <div><dt>Runtime allocation</dt><dd><code>{interviewOutcome.runtimeAllocation}</code></dd></div>
                <div><dt>Verification suites</dt><dd>{verificationSuiteIds.length ? verificationSuiteIds.map((id) => <code key={id}>{id}</code>) : 'None'}</dd></div>
                <div><dt>Provided operations</dt><dd>{providedOperations.length ? providedOperations.map((operation) => <code key={operation.operationId}>{operation.operationId}@{operation.contractVersion}</code>) : 'None'}</dd></div>
                <div><dt>Required operations</dt><dd>{requiredOperations.length ? requiredOperations.map((operation) => <code key={operation.operationId}>{operation.operationId}@{operation.acceptedContractRange}</code>) : 'None'}</dd></div>
                <div><dt>Owned paths</dt><dd>{interviewOutcome.ownedPaths.length ? interviewOutcome.ownedPaths.map((path) => <code key={path}>{path}</code>) : 'None'}</dd></div>
                <div><dt>Events</dt><dd>{interviewOutcome.events.length ? interviewOutcome.events.map((event) => <code key={event}>{event}</code>) : 'None'}</dd></div>
                <div><dt>Configuration schema</dt><dd>{interviewOutcome.configurationSchemaRef ? <code>{interviewOutcome.configurationSchemaRef}</code> : 'None'}</dd></div>
              </dl>
            </Dialog>
          ) : null}
        </>
      ) : (
        <div className="cap-build-outcome-empty">
          <span aria-hidden="true">◇</span>
          <p>The interview outcome will appear here as a clear summary of this module’s responsibilities, interactions, and boundaries.</p>
        </div>
      )}
    </section>
  )

  return (
    <>
      {message ? <p role="status">{message}</p> : <p role="status" className="sr-only">Ready.</p>}

      {progressive ? (
        <div className="cap-build-module-workspace">
          <section className="cap-build-action-panel" aria-label={`Build actions for ${moduleDisplayName}`}>
            <div className="cap-build-selection-summary">
              <p className="capabilities-eyebrow">Selected module</p>
              <h3>{moduleDisplayName}</h3>
              {architectureModule?.responsibility ? <p className="capabilities-note">{architectureModule.responsibility}</p> : null}
            </div>
            {progressiveNextAction}
            {diagnosticsBlock ? <div className="cap-build-action-diagnostics">{diagnosticsBlock}</div> : null}
          </section>
          {interviewOutcomePanel}
        </div>
      ) : (
        <>
          <p className="capabilities-note cap-assigned-module-type"><span className="badge">{guided ? moduleTypeLabel(selectedType) : selectedType}</span> Assigned by the approved architecture</p>

          {projection === 'design' ? (
            <p className="capabilities-note">Applicable details ({selectedType}): {applicableDetailsFor(selectedType).join(', ')}</p>
          ) : null}

          <div className="capabilities-toolbar" role="group" aria-label="Module interview actions">
            <button type="button" className="btn btn-primary btn-compact" onClick={() => void exportPacket()} disabled={!projectId || busy}>{isApproved ? 'Revisit module definition' : 'Generate module draft'}</button>
            <button type="button" className="btn btn-secondary btn-compact" onClick={() => void approve()} disabled={!projectId || !draft || busy || gatePassed === false}>Approve module</button>
          </div>

          {packet && !guided ? (
            <details open><summary>Interview packet {packet.packetId}</summary><pre className="capabilities-pre">{JSON.stringify(packet, null, 2)}</pre></details>
          ) : null}

          <InterviewImport label="Import module interview response" onImport={(r) => void handleImport(r)} disabled={!projectId || busy} projection={projection} />

          <section aria-label="Module implementation lifecycle">
            <h3>Implementation lifecycle</h3>
            {isApproved && handoffBlocked ? (
              <p className="capabilities-note cap-foundation-prerequisite" role="status">
                {foundationPrerequisiteMessage}
              </p>
            ) : null}
            <div className="capabilities-toolbar" role="group" aria-label="Implementation actions">
              <button type="button" className="btn btn-primary btn-compact" disabled={busy || !isApproved || handoffBlocked} onClick={() => void exportImplementation()}>Export implementation packet</button>
              <button type="button" className="btn btn-secondary btn-compact" disabled={busy || !implementationRunId} onClick={() => void selectAndInspectOverlay()}>Select and inspect overlay</button>
              <button type="button" className="btn btn-secondary btn-compact" disabled={busy || !inspection?.canApply || (inspection.warnings.length > 0 && !warningsAccepted)} onClick={() => void applyInspectedOverlay()}>Apply reviewed overlay</button>
              <button type="button" className="btn btn-secondary btn-compact" disabled={busy || !isApproved} onClick={() => void verifyApprovedModule()}>Verify module</button>
            </div>
            {implementationExport ? (
              guided ? (
                <CapabilityHandoffCard bridge={bridge} projectId={projectId} result={implementationExport} projection="guided" />
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

      {!progressive ? diagnosticsBlock : null}

      {draft && projection === 'design' ? (
        <details><summary>Manifest draft {draft.moduleId}</summary><pre className="capabilities-pre">{JSON.stringify(draft, null, 2)}</pre></details>
      ) : null}

      {response && guided ? (
        <p className="capabilities-note">Draft {humanizeIdentifier(response.moduleId)} ({moduleTypeLabel(response.moduleType)}) — {response.answers.length} answers.</p>
      ) : null}

      {frontendBrief && frontendFields ? (
        <Dialog
          title="Review compiled frontend brief"
          wide
          onClose={() => {
            setFrontendBrief(undefined)
            setFrontendFields(undefined)
          }}
          actions={(
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setFrontendBrief(undefined)
                  setFrontendFields(undefined)
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || frontendBrief.gaps.some((gap) => gap.severity === 'blocking')}
                onClick={() => void openCompiledFrontendBuild()}
              >
                Open Build with this brief
              </button>
            </>
          )}
        >
          <div className="frontend-brief-summary">
            <p className="lede">
              Compiled from {frontendBrief.coverage.moduleIds.length} module(s),{' '}
              {frontendBrief.coverage.operationIds.length} operation(s), and{' '}
              {frontendBrief.coverage.bindingIds.length} approved UI binding(s). Edit any section before continuing.
            </p>
            <div className="frontend-brief-coverage" aria-label="Frontend brief coverage">
              <span>{frontendBrief.coverage.routes.length} route(s)</span>
              <span>{frontendBrief.coverage.useCaseIds.length} use case(s)</span>
              <span>Architecture r{frontendBrief.source.architectureRevision}</span>
            </div>
            {frontendBrief.gaps.length ? (
              <ul className="cap-issue-list">
                {frontendBrief.gaps.map((gap) => (
                  <li key={gap.code}>
                    {gap.message} <span className={`badge badge-${gap.severity === 'blocking' ? 'danger' : 'warning'}`}>{gap.severity}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="cap-batch-clear">All available capability and binding evidence is included.</p>}
          </div>
          <div className="frontend-brief-editor">
            {([
              ['taskTitle', 'Task title'],
              ['goal', 'Goal and requirements'],
              ['scope', 'Scope'],
              ['constraints', 'Constraints'],
              ['acceptanceCriteria', 'Acceptance criteria'],
              ['references', 'Source references'],
            ] as [TaskPacketTextKey, string][]).map(([key, label]) => (
              <label key={key}>
                <span>{label}</span>
                {key === 'taskTitle' ? (
                  <input
                    value={frontendFields[key]}
                    onChange={(event) => updateFrontendField(key, event.target.value)}
                  />
                ) : (
                  <textarea
                    rows={key === 'goal' ? 16 : 7}
                    value={frontendFields[key]}
                    onChange={(event) => updateFrontendField(key, event.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
        </Dialog>
      ) : null}
    </>
  )
}
