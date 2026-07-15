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
  OverlayInspectionSummary,
} from '@engineering-ui-kit/core'
import {
  applicableDetailsFor,
  buildModuleInterviewPacket,
  inferModuleType,
  importModuleInterviewResponse,
  type ModuleInterviewResponse,
} from '@engineering-ui-kit/core/browser'
import type { CapabilityPacketExportResult, EuikBridge, TaskPacketFields } from '../../bridge'
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
  onStartUiBuild?: (projectId: string, fields: TaskPacketFields) => Promise<void>
}

function asArch(value: unknown): ArchitectureSpecification | undefined {
  if (!value || typeof value !== 'object') return undefined
  return value as ArchitectureSpecification
}

export function buildUiModuleTaskFields(
  manifest: ModuleManifest,
  architecture: ArchitectureSpecification,
): TaskPacketFields {
  const bullets = (values: string[], fallback: string) => values.length
    ? values.map((value) => `- ${value}`).join('\n')
    : `- ${fallback}`
  const numbered = (values: string[], fallback: string) => (values.length ? values : [fallback])
    .map((value, index) => `${index + 1}. ${value}`)
    .join('\n')
  const definitions = new Map((architecture.moduleDefinitions ?? []).map((definition) => [definition.moduleId, definition]))
  const moduleName = (moduleId: string) => definitions.get(moduleId)?.name || humanizeIdentifier(moduleId)
  const provided = manifest.providedOperations.map((operation) => (
    `${humanizeIdentifier(operation.operationId)} (${operation.operationId} @ ${operation.contractVersion})`
  ))
  const required = manifest.requiredOperations.map((operation) => (
    `${humanizeIdentifier(operation.operationId)} (${operation.operationId}, accepts ${operation.acceptedContractRange}) — ${operation.reason}`
  ))
  const owned = manifest.ownedConcerns.map((concern) => `${humanizeIdentifier(concern)} (${concern})`)
  const excluded = manifest.excludedConcerns.map((concern) => `${humanizeIdentifier(concern)} (${concern})`)
  const journeys = (architecture.capabilityProjections ?? [])
    .filter((projection) => projection.moduleIds.includes(manifest.moduleId))
    .map((projection) => projection.name || humanizeIdentifier(projection.id))
  const traces = (architecture.workflowTraces ?? [])
    .filter((trace) => trace.moduleIds.includes(manifest.moduleId))
    .map((trace) => `${humanizeIdentifier(trace.useCaseId)}: ${trace.moduleIds.map(moduleName).join(' → ')}`)
  const dependencies = (architecture.dependencyEdges ?? [])
    .filter((edge) => edge.fromModuleId === manifest.moduleId)
    .map((edge) => `${moduleName(edge.toModuleId)} — ${edge.reason}`)
  const consumers = (architecture.dependencyEdges ?? [])
    .filter((edge) => edge.toModuleId === manifest.moduleId)
    .map((edge) => `${moduleName(edge.fromModuleId)} — ${edge.reason}`)
  const functionalRequirements = [
    ...provided.map((operation) => `Provide a clear, discoverable interface for ${operation}, with visible confirmation of the outcome.`),
    ...manifest.requiredOperations.map((operation) => `Consume ${humanizeIdentifier(operation.operationId)} (${operation.operationId}, accepts ${operation.acceptedContractRange}) for this purpose: ${operation.reason.replace(/[.\s]+$/, '')}. Keep the call behind the approved module boundary; do not reproduce the capability or its business rules in presentation code.`),
    'Organize the smallest coherent set of screens, panels, and dialogs that fully supports the approved responsibility and journeys; do not add unrelated product scope.',
    'Make validation specific and actionable, preserve entered data after recoverable failures, and prevent accidental duplicate submissions.',
  ]
  const requirementSpec = [
    `# Approved UI requirement spec — ${manifest.name}`,
    `## Product outcome\nBuild a polished, production-quality user interface for **${manifest.name}**. ${manifest.responsibility}`,
    `## Users and supported journeys\n${bullets(journeys, 'Use the approved module responsibility to infer the primary user journey without expanding product scope.')}\n\nWorkflow traces:\n${bullets(traces, 'No cross-module workflow trace was recorded; keep navigation focused on this module’s responsibility.')}`,
    `## Functional requirements\n${numbered(functionalRequirements, 'Represent the approved module responsibility as a complete, usable interface.')}`,
    `## Capability interactions\nOperations this UI provides:\n${bullets(provided, 'No outward operation was recorded; present the module’s information and status without inventing commands.')}\n\nOperations this UI requires:\n${bullets(required, 'No capability dependency was recorded; keep sample data behind a replaceable local interface.')}`,
    `## Information, ownership, and boundaries\nThis UI owns:\n${bullets(owned, 'Presentation of the approved module responsibility.')}\n\nThis UI explicitly does not own:\n${bullets(excluded, 'Domain rules, persistence, orchestration, and external integration outside its approved responsibility.')}\n\nAllowed implementation paths:\n${bullets(manifest.ownedPaths, 'Choose paths that match the repository’s existing UI feature structure and do not modify unrelated modules.')}`,
    `## Architecture context\nThis module depends on:\n${bullets(dependencies, 'No module dependency is recorded.')}\n\nOther modules depending on this UI:\n${bullets(consumers, 'No downstream module dependency is recorded.')}\n\nKeep every interaction behind the named operation boundary so the local sample implementation can be replaced during Connect without rewriting the UI.`,
    `## Required experience states\n- Show intentional initial, loading, ready, empty, partial-data, validation-error, capability-rejection, technical-failure, cancelled, and retrying states where relevant.\n- Use local sample fixtures for this build; keep fixtures and state variants outside view markup and make every state easy to exercise.\n- For long-running actions, show progress and cancellation when supported. For destructive or irreversible actions, require clear confirmation.\n- Never leave a blank panel, silent failure, ambiguous disabled action, or color-only status.` ,
    `## Responsive and accessible behavior\n- Design desktop, tablet, narrow-window, and keyboard-only layouts; content must reflow without horizontal page scrolling.\n- Use semantic landmarks, headings, labels, descriptions, and status announcements. Preserve logical focus order and restore focus after dialogs.\n- Provide visible focus, sufficient contrast, non-color status cues, meaningful empty/error copy, and reduced-motion behavior.\n- Keep primary actions obvious, secondary actions quieter, and dense technical details progressively disclosed.` ,
    `## Visual and interaction quality\n- Follow the repository’s established design system, semantic tokens, components, spacing, and typography.\n- Establish a clear information hierarchy with aligned panels, consistent control placement, restrained decoration, and deliberate whitespace.\n- Reuse existing components before introducing new ones. Do not imitate a generic dashboard when the approved workflow calls for a more focused task surface.`,
    `## Verification targets\n- Every listed responsibility, owned concern, provided operation, required operation, and workflow is visibly accounted for.\n- Each relevant state can be reached with deterministic sample data.\n- Keyboard, focus, validation, responsive, and failure behaviors have automated or documented verification.\n- Type checking, tests, and the production build pass without weakening existing coverage.`,
  ].join('\n\n')
  return {
    taskTitle: `Build UI from approved capability spec: ${manifest.name}`,
    goal: requirementSpec,
    scope: [
      `Approved module: ${manifest.moduleId} @ ${manifest.moduleVersion}`,
      '- Implement the UI views, reusable presentation components, local state fixtures, and focused UI tests required by the specification.',
      '- Use sample adapters for approved capability ports so Connect can replace them without changing view components.',
      `- Account for these provided operations:\n${bullets(provided, 'No outward operation is recorded.')}`,
      `- Account for these required operations:\n${bullets(required, 'No required operation is recorded.')}`,
      `- Work only within approved or repository-consistent UI paths:\n${bullets(manifest.ownedPaths, 'Use the existing UI feature structure.')}`,
    ].join('\n\n'),
    constraints: [
      '- Preserve the approved ports-and-adapters boundaries; keep domain logic outside the UI module.',
      '- Do not call a real backend, network service, filesystem, or platform adapter in this build; use typed local fixtures behind the approved interfaces.',
      '- Use the repository’s existing design system, component patterns, visual language, framework, and dependencies.',
      '- Do not invent new domain rules, capability contracts, operations, or product scope.',
      `- Do not take ownership of:\n${bullets(excluded, 'Anything outside the approved module boundary.')}`,
    ].join('\n'),
    acceptanceCriteria: [
      '- The complete requirement spec in the Goal section is implemented and traceable in the resulting UI.',
      '- Every approved user-facing operation has a clear action, state model, and visible outcome.',
      '- Required capability operations are consumed through the approved interfaces, not reimplemented in the UI.',
      '- Loading, empty, validation, rejection, technical failure, cancellation, duplicate action, success, and retry behaviors are represented where applicable.',
      '- The module is visually polished, responsive, and accessible by keyboard and assistive technology.',
      '- Relevant tests, type checks, and the project build pass.',
    ].join('\n'),
    references: [
      `Capabilities architecture: ${architecture.id} revision ${architecture.revision}`,
      `Module manifest: ${manifest.moduleId} @ ${manifest.moduleVersion}`,
      `Runtime allocation: ${humanizeIdentifier(manifest.runtimeAllocation)}`,
      `Verification suites: ${manifest.verificationSuiteIds.join(', ') || 'none recorded'}`,
    ].join('\n'),
  }
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
        record={records.find((record) => record.moduleId === selectedModuleId)}
        isApproved={approvedIds.includes(selectedModuleId)}
        projection={projection}
        progressive={progressive}
        onChanged={onChanged}
        onStartUiBuild={onStartUiBuild}
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
}) {
  const { bridge, projectId, moduleId, architecture, record, isApproved, projection, progressive } = props
  const guided = projection === 'guided'
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
      if (imported.manifest) {
        await bridge.capabilitiesSaveModuleDraft(projectId, imported.manifest)
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
      setRevisitingInterview(false)
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

  async function startUiAgentBuild() {
    const manifest = record?.approved
    if (busy || !manifest || !architecture || !props.onStartUiBuild) return
    setBusy(true)
    setMessage('Preparing the UI build workspace with this module’s approved context…')
    try {
      await props.onStartUiBuild(projectId, buildUiModuleTaskFields(manifest, architecture))
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

  async function revisitInterview() {
    if (busy) return
    setRevisitingInterview(true)
    setDraft(undefined)
    setResponse(undefined)
    setDiagnostics([])
    setGatePassed(undefined)
    setInterviewExport(undefined)
    await exportPacket()
  }

  type BuildStep = 'interview' | 'import' | 'approve' | 'handoff' | 'inspect' | 'accept' | 'apply' | 'verify'
  const implementationStarted = Boolean(implementationExport) || ['packet-exported', 'overlay-inspected', 'overlay-applied'].includes(persistedLifecycleState)
  const implementationApplied = applied || persistedLifecycleState === 'overlay-applied'
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
          <p className="capabilities-note cap-assigned-module-type"><span className="badge">{moduleTypeLabel(selectedType)}</span> Assigned during Design</p>
          <button type="button" className="btn btn-primary btn-compact" onClick={() => void exportPacket()} disabled={!projectId || busy}>Create interview</button>
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
          {selectedType === 'experience' && props.onStartUiBuild ? (
            <div className="cap-ui-build-agent">
              <span className="capabilities-eyebrow">Recommended for UI modules</span>
              <strong>Build the UI with the agent</strong>
              <p>Open Build &amp; Test with this module’s approved responsibilities, operations, paths, and architecture boundaries already prepared.</p>
              <button type="button" className="btn btn-primary btn-compact" onClick={() => void startUiAgentBuild()} disabled={busy}>
                {Icon.sparkle(14)} Build UI with agent
              </button>
            </div>
          ) : null}
          <div className="cap-ui-build-manual">
            <strong>{selectedType === 'experience' ? 'Or use an external implementation handoff' : 'Create the implementation handoff'}</strong>
            <button type="button" className="btn btn-secondary btn-compact" onClick={() => void exportImplementation()} disabled={busy}>Create implementation handoff</button>
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
            <div><span>Runs as</span><strong>{interviewOutcome.runtimeAllocation ? humanizeIdentifier(interviewOutcome.runtimeAllocation) : 'Not assigned'}</strong></div>
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

          <div className="cap-build-outcome-footer">
            <span>{verificationSuiteIds.length} verification suite{verificationSuiteIds.length === 1 ? '' : 's'}</span>
            <span>Version {interviewOutcome.moduleVersion ?? 'not set'}</span>
          </div>
          <button type="button" className="btn btn-secondary btn-compact" onClick={() => void revisitInterview()} disabled={busy || revisitingInterview}>
            Revisit interview
          </button>
        </>
      ) : (
        <div className="cap-build-outcome-empty">
          <span aria-hidden="true">◇</span>
          <p>The interview outcome will appear here as a clear module boundary, operation map, and ownership summary.</p>
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
            <button type="button" className="btn btn-primary btn-compact" onClick={() => void exportPacket()} disabled={!projectId || busy}>Export module interview</button>
            <button type="button" className="btn btn-secondary btn-compact" onClick={() => void approve()} disabled={!projectId || !draft || busy || gatePassed === false}>Approve module</button>
          </div>

          {packet && !guided ? (
            <details open><summary>Interview packet {packet.packetId}</summary><pre className="capabilities-pre">{JSON.stringify(packet, null, 2)}</pre></details>
          ) : null}

          <InterviewImport label="Import module interview response" onImport={(r) => void handleImport(r)} disabled={!projectId || busy} projection={projection} />

          <section aria-label="Module implementation lifecycle">
            <h3>Implementation lifecycle</h3>
            <div className="capabilities-toolbar" role="group" aria-label="Implementation actions">
              <button type="button" className="btn btn-primary btn-compact" disabled={busy || !isApproved} onClick={() => void exportImplementation()}>Export implementation packet</button>
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
    </>
  )
}
