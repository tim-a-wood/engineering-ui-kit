/**
 * Capabilities top-level project workspace.
 *
 * Guided and Design are two projections over ONE canonical model. Guided walks a
 * four-step journey (Plan → Design → Build → Verify) and gates
 * locked stages so impossible downstream workflows can never be opened. Design
 * exposes the same records as the five canonical areas. No projection
 * or stepper state is persisted (CAP-DEC-001/002) — the journey is derived on
 * every render from canonical records.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { foundationHandoffGate, projectArchitecture } from '@engineering-ui-kit/core/browser'
import type {
  ArchitectureSpecification,
  AttentionItem,
  CapabilityModuleRecord,
  CapabilityBindingRecord,
  FoundationPlan,
  ModuleManifest,
  Project,
  SelectionEvidence,
  CapabilityIntegrationState,
  CapabilityRunScope,
} from '@engineering-ui-kit/core'
import type { CapabilityDeployableSummary, EuikBridge, InboundBindingReadRecord, TaskPacketFields } from '../../bridge'
import { EmptyState, PageHeader } from '../../components'
import { Icon } from '../../icons'
import type { GuideTopicId } from '../../guides'
import { ApplicationDefinition } from './ApplicationDefinition'
import { ArchitectureInterview } from './ArchitectureInterview'
import { ArchitectureView } from './ArchitectureView'
import { CapabilityJourney } from './CapabilityJourney'
import type { CapabilityPreviewHandle } from './CapabilityPreview'
import { GuidedConnect } from './GuidedConnect'
import { GuidedBuild } from './GuidedBuild'
import { DeltaQueue } from './DeltaQueue'
import { ModulesView } from './ModulesView'
import { ImpactQueue } from './ImpactQueue'
import { NeedsAttention } from './NeedsAttention'
import { VerificationPanel } from './VerificationPanel'
import { IntegrationWorkspace } from './IntegrationWorkspace'
import { ConnectionVerificationPanel } from './ConnectionVerificationPanel'
import {
  deriveJourney,
  stageFromCapabilitiesNavigation,
  stageById,
  STAGE_LABELS,
  type CapabilityInboundBindingRecord,
  type JourneyInput,
  type StageId,
} from './capabilitiesUiState'
import {
  DESIGN_SECTIONS,
  designSectionToStage,
  normalizeDesignSection,
  stageToDesignSection,
  stageToGuideTopic,
  type DesignSection,
} from './capabilityPresentation'
import { architectureForDisplay } from './capabilitiesProjection'

export type CapabilitiesProjection = 'guided' | 'design'

type GuidedPanel = 'journey' | 'attention' | 'changes'

const GUIDED_STAGE_DESCRIPTION: Record<StageId, string> = {
  define: 'Agree what the application must achieve and where its boundaries are.',
  architect: 'Shape the main parts of the solution and how they work together.',
  build: 'Complete each module, configure how the application starts, and prepare the shared setup.',
  verify: 'Run the real checks, review the evidence, and resolve anything that is not ready.',
}

const GUIDED_STAGE_STATE_LABEL = {
  complete: 'Complete',
  current: 'In progress',
  available: 'Ready to start',
  locked: 'Locked',
  'not-applicable': 'Not required',
} as const

/**
 * Projects the raw CAP-CONTRACT-028 read model (draft/approved per bindingId)
 * into the minimal shape `deriveJourney` needs to evaluate Build entry-point
 * completeness (CAP-ERA-001 §5.1/§12.4). Every record's own kind/exposure
 * ride along unchanged; nothing here decides completeness itself.
 */
function projectInboundBindings(records: InboundBindingReadRecord[]): CapabilityInboundBindingRecord[] {
  return records.flatMap((record) => {
    const rec = record.approved ?? record.draft
    if (!rec) return []
    return [{
      bindingId: record.bindingId,
      deployableId: rec.deployableId,
      operationId: rec.operationId,
      operationVersion: rec.operationVersion,
      approved: Boolean(record.approved),
      exposure: rec.exposure,
    }]
  })
}

type Props = {
  bridge: EuikBridge
  projects: Project[]
  activeProjectId?: string
  onProjectSelected?: (projectId: string) => void
  onOpenGuide?: (topic: GuideTopicId) => void
  onNavigateToProjects?: () => void
  onOpenBuildTest?: (projectId: string) => void
  onProjectsChanged?: () => Promise<void> | void
  onStartUiBuild?: (projectId: string, fields: TaskPacketFields) => Promise<void>
}

export function CapabilitiesView({
  bridge,
  projects,
  activeProjectId,
  onProjectSelected,
  onOpenGuide,
  onNavigateToProjects,
  onOpenBuildTest,
  onProjectsChanged,
  onStartUiBuild,
}: Props) {
  const [projection, setProjection] = useState<CapabilitiesProjection>('guided')
  // No project is initialized implicitly (Section 31): selection is an explicit action.
  const [projectId, setProjectId] = useState('')
  const [application, setApplication] = useState<{ draft?: unknown; approved?: unknown }>({})
  const [architecture, setArchitecture] = useState<{ draft?: unknown; approved?: unknown }>({})
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([])
  const [moduleRecords, setModuleRecords] = useState<CapabilityModuleRecord[]>([])
  const [capabilityRuns, setCapabilityRuns] = useState<CapabilityRunScope[]>([])
  const [bindingRecords, setBindingRecords] = useState<CapabilityBindingRecord[]>([])
  const [deployables, setDeployables] = useState<CapabilityDeployableSummary[]>([])
  const [inboundBindingRecords, setInboundBindingRecords] = useState<InboundBindingReadRecord[]>([])
  const [foundation, setFoundation] = useState<{ draft?: FoundationPlan; approved?: FoundationPlan }>({})
  const [integrationState, setIntegrationState] = useState<CapabilityIntegrationState>({ schemaVersion: '1.0', projectId: '', deployables: [], updatedAt: '' })
  const [selectionEvidence, setSelectionEvidence] = useState<SelectionEvidence | undefined>()
  const [viewing, setViewing] = useState<StageId>('define')
  const [designSection, setDesignSection] = useState<DesignSection>('application')
  const [guidedPanel, setGuidedPanel] = useState<GuidedPanel>('journey')
  // Project-loading boundary: writes are only possible in 'ready'; a generation token
  // discards any late response from a project the user has since switched away from.
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [loadError, setLoadError] = useState('')
  const loadGenRef = useRef(0)
  // Updated synchronously on selection so callbacks retained by an unmounted child
  // can never refresh their former project into the newly active workspace.
  const activeProjectRef = useRef('')
  const previewRef = useRef<CapabilityPreviewHandle | null>(null)
  const projectSelectRef = useRef<HTMLSelectElement | null>(null)
  const stageHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const viewRef = useRef<HTMLDivElement | null>(null)
  const requestedStageRef = useRef<StageId | undefined>(
    typeof window === 'undefined' ? undefined : stageFromCapabilitiesNavigation(window.location.href),
  )

  const selectedProject = projects.find((project) => project.id === projectId)
  const inboundBindingProjections = useMemo(() => projectInboundBindings(inboundBindingRecords), [inboundBindingRecords])
  const journeyInput: JourneyInput = useMemo(
    () => ({
      application,
      architecture,
      foundation,
      modules: moduleRecords,
      capabilityRuns,
      bindings: bindingRecords,
      deployables,
      inboundBindings: inboundBindingProjections,
      connectDisposition: selectedProject?.capabilitiesConnectDisposition,
      integration: integrationState,
    }),
    [application, architecture, foundation, moduleRecords, capabilityRuns, bindingRecords, deployables, inboundBindingProjections, selectedProject?.capabilitiesConnectDisposition, integrationState],
  )
  const journey = useMemo(() => deriveJourney(journeyInput), [journeyInput])
  const effectiveAttentionItems = useMemo(() => {
    const hasMissingEntryPoint = journey.entryPoints.some((item) => item.requiresEntryPoint && !item.satisfied)
    if (selectedProject?.capabilitiesConnectDisposition !== 'deferred' || !hasMissingEntryPoint) return attentionItems
    if (attentionItems.some((item) => item.reasonCodes.includes('ui-connection-deferred'))) return attentionItems
    return [...attentionItems, {
      moduleId: 'ui.connection',
      primaryState: 'needs-review' as const,
      reasonCodes: ['ui-connection-deferred'],
      blocker: 'Entry-point configuration deferred',
      nextAction: 'Return to Build and configure how this application is started',
    }]
  }, [attentionItems, journey.entryPoints, selectedProject?.capabilitiesConnectDisposition])

  const fetchWorkspace = useCallback(
    async (id: string) => {
      const [app, arch, attention, modules, runs, bindings, deployableList, inboundBindings, foundationResult, integration] = await Promise.all([
        bridge.capabilitiesGetApplication(id),
        bridge.capabilitiesGetArchitecture(id),
        bridge.capabilitiesListNeedsAttention(id),
        bridge.capabilitiesListModules(id),
        bridge.capabilitiesListRuns(id),
        bridge.capabilitiesListBindings(id),
        bridge.capabilitiesListDeployables(id),
        bridge.capabilitiesListInboundBindings(id),
        bridge.capabilitiesGetFoundation(id),
        bridge.capabilitiesGetIntegrationState(id),
      ])
      return { application: app, architecture: arch, attention, modules, runs, bindings, deployableList, inboundBindings, foundation: foundationResult, integration }
    },
    [bridge],
  )

  function clearRecords() {
    setApplication({})
    setArchitecture({})
    setAttentionItems([])
    setModuleRecords([])
    setCapabilityRuns([])
    setBindingRecords([])
    setDeployables([])
    setInboundBindingRecords([])
    setFoundation({})
    setIntegrationState({ schemaVersion: '1.0', projectId: '', deployables: [], updatedAt: '' })
    setSelectionEvidence(undefined)
    setGuidedPanel('journey')
  }

  /** Atomically load a project. A late response for a superseded generation is discarded. */
  const loadProject = useCallback(
    async (id: string) => {
      const gen = ++loadGenRef.current
      clearRecords()
      setLoadState('loading')
      setLoadError('')
      try {
        // Lazy initialization only on explicit selection.
        await bridge.capabilitiesEnsureInitialized(id)
        const d = await fetchWorkspace(id)
        if (gen !== loadGenRef.current || id !== activeProjectRef.current) return
        setApplication(d.application)
        setArchitecture(d.architecture)
        setAttentionItems(d.attention)
        setModuleRecords(d.modules)
        setCapabilityRuns(d.runs)
        setBindingRecords(d.bindings)
        setDeployables(d.deployableList)
        setInboundBindingRecords(d.inboundBindings)
        setFoundation(d.foundation)
        setIntegrationState(d.integration)
        const project = projects.find((candidate) => candidate.id === id)
        const derived = deriveJourney({
          application: d.application,
          architecture: d.architecture,
          foundation: d.foundation,
          modules: d.modules,
          capabilityRuns: d.runs,
          bindings: d.bindings,
          deployables: d.deployableList,
          inboundBindings: projectInboundBindings(d.inboundBindings),
          connectDisposition: project?.capabilitiesConnectDisposition,
          integration: d.integration,
        })
        const requestedStage = requestedStageRef.current
        const requestedDescriptor = requestedStage ? derived.stages.find((stage) => stage.id === requestedStage) : undefined
        const initialStage = requestedDescriptor && requestedDescriptor.state !== 'locked'
          ? requestedDescriptor.id
          : derived.firstIncompleteStageId
        setViewing(initialStage)
        setDesignSection(stageToDesignSection(initialStage))
        requestedStageRef.current = undefined
        setLoadState('ready')
      } catch (error) {
        if (gen !== loadGenRef.current || id !== activeProjectRef.current) return
        setLoadError(error instanceof Error ? error.message : String(error))
        setLoadState('error') // never fall back to the previous project's records
      }
    },
    [bridge, fetchWorkspace, projects],
  )

  const selectProject = useCallback(
    async (id: string) => {
      // Invalidate any in-flight load immediately so stale records can never render.
      loadGenRef.current++
      activeProjectRef.current = id
      setProjectId(id)
      onProjectSelected?.(id)
      clearRecords()
      if (!id) {
        setLoadState('idle')
        return
      }
      await loadProject(id)
    },
    [loadProject, onProjectSelected],
  )

  // Entering from Build & Test or a project row carries the project context
  // into Capabilities. A bare top-level visit remains non-mutating until the
  // user chooses a project, preserving the explicit-selection safety boundary.
  useEffect(() => {
    if (projectId || loadState !== 'idle' || !activeProjectId) return
    if (!projects.some((project) => project.id === activeProjectId)) return
    void selectProject(activeProjectId)
  }, [activeProjectId, loadState, projectId, projects, selectProject])

  // Move focus to the stage heading when the viewed stage changes.
  useEffect(() => {
    if (projection === 'guided' && guidedPanel === 'journey' && projectId && loadState === 'ready') {
      stageHeadingRef.current?.focus()
    }
  }, [viewing, projection, guidedPanel, projectId, loadState])

  /** Background refresh after a child mutation — gen-guarded so it cannot clobber a switch. */
  const refresh = useCallback(async () => {
    const expectedProjectId = projectId
    if (!expectedProjectId || expectedProjectId !== activeProjectRef.current) return
    const gen = loadGenRef.current
    const d = await fetchWorkspace(expectedProjectId)
    if (gen !== loadGenRef.current || expectedProjectId !== activeProjectRef.current) return
    setApplication(d.application)
    setArchitecture(d.architecture)
    setAttentionItems(d.attention)
    setModuleRecords(d.modules)
    setCapabilityRuns(d.runs)
    setBindingRecords(d.bindings)
    setDeployables(d.deployableList)
    setInboundBindingRecords(d.inboundBindings)
    setFoundation(d.foundation)
    setIntegrationState(d.integration)
  }, [projectId, fetchWorkspace])

  const architectureProjection = useMemo(() => {
    const arch = architectureForDisplay(architecture)
    if (!arch) return undefined
    const manifests = moduleRecords
      .map((record) => record.approved ?? record.draft)
      .filter((manifest): manifest is ModuleManifest => Boolean(manifest))
    const freshnessByModule = Object.fromEntries(
      moduleRecords.filter((r) => Boolean(r.freshness)).map((r) => [r.moduleId, r.freshness!]),
    )
    return projectArchitecture(arch, manifests, freshnessByModule, { mode: projection })
  }, [architecture, moduleRecords, projection])

  const archSpec = (architecture.approved ?? architecture.draft) as ArchitectureSpecification | undefined
  const approvedArchSpec = architecture.approved as ArchitectureSpecification | undefined

  /** WP5A bullet (d) — blocks the module implementation/From-spec-Build handoff until an approved, non-stale foundation exists. */
  const foundationGate = useMemo(() => {
    if (!approvedArchSpec) {
      return { enabled: false, reason: 'Architecture must be approved before the foundation can be planned.' }
    }
    return foundationHandoffGate({ approvedFoundation: foundation.approved, approvedArchitecture: approvedArchSpec })
  }, [foundation.approved, approvedArchSpec])

  function switchProjection(next: CapabilitiesProjection) {
    if (next === projection) return
    if (next === 'design') {
      setDesignSection(stageToDesignSection(viewing))
    } else {
      const mapped = designSectionToStage(designSection)
      const stage = journey.stages.find((s) => s.id === mapped)
      setViewing(stage && stage.state !== 'locked' ? mapped : journey.firstIncompleteStageId)
      setGuidedPanel('journey')
    }
    setProjection(next)
    viewRef.current?.scrollIntoView?.({ block: 'start' })
  }

  function openDesignSection(section: DesignSection | string) {
    setDesignSection(normalizeDesignSection(section))
    // Long Design areas must not donate their scroll offset to the
    // next area. Keep the page header and Design navigation in view.
    viewRef.current?.scrollIntoView?.({ block: 'start' })
  }

  function viewStage(id: StageId) {
    const stage = stageById(journey, id)
    if (stage.state === 'locked') return
    setGuidedPanel('journey')
    setViewing(id)
  }

  const hasProjects = projects.length > 0
  const attentionCount = effectiveAttentionItems.length

  const workspaceControls = (
    <div className="cap-workspace-controls" role="group" aria-label="Capabilities workspace controls">
      <span className="cap-workspace-label">Project workspace</span>
      <label className="cap-project-select">
        <span className="sr-only">Capabilities project</span>
        <select
          ref={projectSelectRef}
          value={projectId}
          onChange={(e) => void selectProject(e.target.value)}
          aria-label="Capabilities project"
        >
          <option value="">Select a project…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <div className="segmented" role="group" aria-label="View mode">
        <button
          type="button"
          className={projection === 'guided' ? 'segment active' : 'segment'}
          aria-pressed={projection === 'guided'}
          onClick={() => switchProjection('guided')}
        >
          Guided
        </button>
        <button
          type="button"
          className={projection === 'design' ? 'segment active' : 'segment'}
          aria-pressed={projection === 'design'}
          onClick={() => switchProjection('design')}
        >
          Design
        </button>
      </div>
      {projectId && projection === 'guided' && attentionCount > 0 && (
        <button
          type="button"
          className={guidedPanel === 'attention' ? 'btn btn-secondary btn-compact active' : 'btn btn-secondary btn-compact'}
          aria-label={`Needs attention, ${attentionCount} item${attentionCount === 1 ? '' : 's'}`}
          aria-pressed={guidedPanel === 'attention'}
          onClick={() => setGuidedPanel(guidedPanel === 'attention' ? 'journey' : 'attention')}
        >
          {Icon.alertTriangle(14)} <span className="cap-header-action-label">Needs attention</span>
          <span className="badge">{attentionCount}</span>
        </button>
      )}
      {projectId && projection === 'guided' && (
        <button
          type="button"
          className={guidedPanel === 'changes' ? 'btn btn-secondary btn-compact active' : 'btn btn-secondary btn-compact'}
          aria-label="Changes"
          aria-pressed={guidedPanel === 'changes'}
          onClick={() => setGuidedPanel(guidedPanel === 'changes' ? 'journey' : 'changes')}
        >
          {Icon.layers(14)} <span className="cap-header-action-label">Changes</span>
        </button>
      )}
      <button
        type="button"
        className="btn btn-ghost btn-compact"
        aria-label={projection === 'guided' ? 'Stage guide' : 'Capability guide'}
        onClick={() => onOpenGuide?.(projection === 'guided' ? stageToGuideTopic(viewing) : 'capabilities-overview')}
      >
        {Icon.help(14)} <span className="cap-header-action-label">{projection === 'guided' ? 'Stage guide' : 'Capability guide'}</span>
      </button>
    </div>
  )

  return (
    <div ref={viewRef} className="capabilities-view" role="region" aria-label="Capabilities">
      <PageHeader
        title="Capabilities"
        icon={Icon.box()}
        badge={<span className="badge badge-warning">Experimental</span>}
        subtitle={
          projection === 'guided'
            ? 'Turn what the application must do into approved, verified modules.'
            : 'Inspect the contracts, modules, connections, and verification behind the same records.'
        }
        actions={projectId && onOpenBuildTest ? (
          <button type="button" className="btn btn-secondary btn-compact" onClick={() => onOpenBuildTest(projectId)}>
            {Icon.home(14)} Open Build &amp; Test
          </button>
        ) : undefined}
      />

      {workspaceControls}

      {!projectId ? (
        <EmptyState
          icon={Icon.folderBig(24)}
          title="Select a project to begin"
          hint={
            hasProjects
              ? 'Capabilities works per project. Choose one to start or resume its journey.'
              : 'No projects yet. Create one first, then return to Capabilities.'
          }
          action={
            hasProjects ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => projectSelectRef.current?.focus()}
              >
                Select a project
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => onNavigateToProjects?.()}>
                Go to Projects
              </button>
            )
          }
        />
      ) : loadState === 'loading' ? (
        <div className="capabilities-panel cap-loading" role="status" aria-live="polite" aria-busy="true">
          <span className="cap-loading-spinner" aria-hidden="true">{Icon.refresh(16)}</span>
          <p>Loading this project…</p>
        </div>
      ) : loadState === 'error' ? (
        <div className="capabilities-panel cap-load-error" role="alert">
          <span className="cap-blocker-icon" aria-hidden="true">{Icon.alertTriangle(18)}</span>
          <p>This project could not be loaded. {loadError}</p>
          <button type="button" className="btn btn-primary btn-compact" onClick={() => void loadProject(projectId)}>
            {Icon.refresh(14)} Retry
          </button>
        </div>
      ) : projection === 'guided' ? (
        // key={projectId}: switching projects fully remounts the workspace, resetting every
        // child-local transient value (drafts, packets, diagnostics, run IDs, inspection, …).
        <GuidedBody
          key={projectId}
          bridge={bridge}
          projectId={projectId}
          project={selectedProject}
          journey={journey}
          viewing={viewing}
          panel={guidedPanel}
          moduleRecords={moduleRecords}
          attentionItems={effectiveAttentionItems}
          architectureProjection={architectureProjection}
          archSpec={archSpec}
          selectionEvidence={selectionEvidence}
          bindingRecords={bindingRecords}
          inboundBindingRecords={inboundBindingRecords}
          deployables={deployables}
          previewRef={previewRef}
          stageHeadingRef={stageHeadingRef}
          onView={viewStage}
          onChanged={refresh}
          onSelectionEvidence={setSelectionEvidence}
          onOpenGuide={onOpenGuide}
          onClosePanel={() => setGuidedPanel('journey')}
          onProjectsChanged={onProjectsChanged}
          onStartUiBuild={onStartUiBuild}
          approvedFoundation={foundation.approved}
          foundationGate={foundationGate}
          integrationState={integrationState}
        />
      ) : (
        <DesignBody
          key={projectId}
          bridge={bridge}
          projectId={projectId}
          project={selectedProject}
          journey={journey}
          section={designSection}
          onSection={openDesignSection}
          moduleRecords={moduleRecords}
          attentionItems={effectiveAttentionItems}
          architectureProjection={architectureProjection}
          archSpec={archSpec}
          application={application}
          architecture={architecture}
          selectionEvidence={selectionEvidence}
          bindingRecords={bindingRecords}
          inboundBindingRecords={inboundBindingRecords}
          deployables={deployables}
          previewRef={previewRef}
          onChanged={refresh}
          onProjectsChanged={onProjectsChanged}
          approvedFoundation={foundation.approved}
          foundationGate={foundationGate}
          integrationState={integrationState}
          onSelectionEvidence={setSelectionEvidence}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ guided */

export function GuidedBody(props: {
  bridge: EuikBridge
  projectId: string
  project?: Project
  journey: ReturnType<typeof deriveJourney>
  viewing: StageId
  panel: GuidedPanel
  moduleRecords: CapabilityModuleRecord[]
  attentionItems: AttentionItem[]
  architectureProjection: ReturnType<typeof projectArchitecture> | undefined
  archSpec: ArchitectureSpecification | undefined
  selectionEvidence: SelectionEvidence | undefined
  bindingRecords: CapabilityBindingRecord[]
  deployables: CapabilityDeployableSummary[]
  inboundBindingRecords: InboundBindingReadRecord[]
  previewRef: React.RefObject<CapabilityPreviewHandle | null>
  stageHeadingRef: React.RefObject<HTMLHeadingElement | null>
  onView: (id: StageId) => void
  onChanged: () => void
  onSelectionEvidence: (e: SelectionEvidence | undefined) => void
  onOpenGuide?: (topic: GuideTopicId) => void
  onClosePanel: () => void
  onProjectsChanged?: () => Promise<void> | void
  onStartUiBuild?: (projectId: string, fields: TaskPacketFields) => Promise<void>
  approvedFoundation?: FoundationPlan
  foundationGate?: { enabled: boolean; reason?: string }
  integrationState: CapabilityIntegrationState
}) {
  const stage = stageById(props.journey, props.viewing)
  const stageLabel = stage.label

  if (props.panel === 'attention') {
    return (
      <section className="capabilities-panel" aria-label="Needs attention">
        <PanelBackButton onClick={props.onClosePanel} />
        <NeedsAttention
          items={props.attentionItems}
          projection="guided"
          onNextAction={(item) => {
            // Route to the relevant Guided stage where possible.
            const target: StageId = item.reasonCodes.includes('ui-connection-deferred')
              ? 'build'
              : item.primaryState === 'draft' ? 'build' : 'verify'
            const t = props.journey.stages.find((s) => s.id === target)
            if (t && t.state !== 'locked') props.onView(target)
          }}
        />
      </section>
    )
  }

  if (props.panel === 'changes') {
    return (
      <section className="capabilities-panel" aria-label="Changes">
        <PanelBackButton onClick={props.onClosePanel} />
        <ImpactQueue bridge={props.bridge} projectId={props.projectId} records={props.moduleRecords} projection="guided" />
        <DeltaQueue bridge={props.bridge} projectId={props.projectId} projection="guided" />
      </section>
    )
  }

  return (
    <div className="cap-guided">
      <CapabilityJourney stages={props.journey.stages} viewing={props.viewing} onView={props.onView} />
      <section
        className="capabilities-panel cap-stage"
        data-stage-id={stage.id}
        data-stage-state={stage.state}
        aria-label={`${stageLabel} stage`}
        aria-live="polite"
      >
        <div className="cap-stage-hero">
          <div className="cap-stage-identity">
            <p className="cap-stage-kicker">
              Stage {props.journey.stages.findIndex((item) => item.id === stage.id) + 1} of {props.journey.stages.length}
              <span aria-hidden="true"> · </span>
              <span>{GUIDED_STAGE_STATE_LABEL[stage.state]}</span>
            </p>
            <h2 ref={props.stageHeadingRef} tabIndex={-1}>{stageLabel}</h2>
            <p>{GUIDED_STAGE_DESCRIPTION[stage.id]}</p>
          </div>
          <div className="cap-stage-hero-actions">
            <StageCompletion journey={props.journey} stageId={stage.id} onView={props.onView} />
          </div>
        </div>
        <div className="cap-stage-content">
          <GuidedStage {...props} stage={stage} />
        </div>
      </section>
    </div>
  )
}

function PanelBackButton(props: { onClick: () => void }) {
  return (
    <button type="button" className="btn btn-ghost btn-compact cap-back" onClick={props.onClick}>
      {Icon.arrowLeft(14)} Back to journey
    </button>
  )
}

function StageCompletion(props: {
  journey: ReturnType<typeof deriveJourney>
  stageId: StageId
  onView: (id: StageId) => void
}) {
  const stage = stageById(props.journey, props.stageId)
  if (!stage.satisfied || !stage.nextStageId) {
    if (stage.satisfied && props.stageId === 'verify' && props.journey.complete) {
      return (
        <div className="cap-stage-outcome complete" role="status">
          <span className="cap-complete-icon" aria-hidden="true">{Icon.shieldCheck(18)}</span>
          <span>Journey complete</span>
        </div>
      )
    }
    return null
  }
  const next = props.journey.stages.find((s) => s.id === stage.nextStageId)
  if (!next || next.state === 'locked') return null
  return (
    <div className="cap-stage-outcome" role="status">
      <button type="button" className="btn btn-primary btn-compact cap-stage-next" onClick={() => props.onView(next.id)}>
        Continue to {STAGE_LABELS[next.id]} {Icon.arrowRight(14)}
      </button>
    </div>
  )
}

function GuidedStage(props: {
  bridge: EuikBridge
  projectId: string
  project?: Project
  stage: ReturnType<typeof stageById>
  journey: ReturnType<typeof deriveJourney>
  moduleRecords: CapabilityModuleRecord[]
  architectureProjection: ReturnType<typeof projectArchitecture> | undefined
  archSpec: ArchitectureSpecification | undefined
  selectionEvidence: SelectionEvidence | undefined
  bindingRecords: CapabilityBindingRecord[]
  deployables: CapabilityDeployableSummary[]
  inboundBindingRecords: InboundBindingReadRecord[]
  previewRef: React.RefObject<CapabilityPreviewHandle | null>
  onChanged: () => void
  onSelectionEvidence: (e: SelectionEvidence | undefined) => void
  onOpenGuide?: (topic: GuideTopicId) => void
  onView: (id: StageId) => void
  onProjectsChanged?: () => Promise<void> | void
  onStartUiBuild?: (projectId: string, fields: TaskPacketFields) => Promise<void>
  approvedFoundation?: FoundationPlan
  foundationGate?: { enabled: boolean; reason?: string }
  integrationState: CapabilityIntegrationState
}) {
  const { bridge, projectId, stage } = props

  // Locked stages never render their internals (defensive; the stepper blocks navigation).
  if (stage.state === 'locked') {
    return (
      <StageBlocker
        reason={stage.prerequisiteReason ?? 'Complete the earlier stages first.'}
        helpTopic={stageToGuideTopic(stage.id)}
        onOpenGuide={props.onOpenGuide}
      />
    )
  }

  switch (stage.id) {
    case 'define':
      return (
        <ApplicationDefinition
          bridge={bridge}
          projectId={projectId}
          project={props.project}
          projection="guided"
          onChanged={props.onChanged}
          onHelp={() => props.onOpenGuide?.(stageToGuideTopic('define'))}
        />
      )
    case 'architect':
      return (
        <>
          <ArchitectureInterview
            bridge={bridge}
            projectId={projectId}
            architectureApproved={Boolean(props.archSpec?.status === 'approved')}
            projection="guided"
            onChanged={props.onChanged}
          />
          {props.architectureProjection && (
            <ArchitectureView projection={props.architectureProjection} mode="guided" />
          )}
        </>
      )
    case 'build':
      return (
        <GuidedBuild
          bridge={bridge}
          projectId={projectId}
          archSpec={props.archSpec}
          records={props.moduleRecords}
          onChanged={props.onChanged}
          onStartUiBuild={props.onStartUiBuild}
          approvedFoundation={props.approvedFoundation}
          foundationGate={props.foundationGate}
          integrationState={props.integrationState}
          project={props.project}
          deployables={props.deployables}
          inboundBindingRecords={props.inboundBindingRecords}
          selectionEvidence={props.selectionEvidence}
          onSelectionEvidence={props.onSelectionEvidence}
          architectureVersion={props.archSpec?.revision}
          architectureHash={props.archSpec?.contentHash}
          previewRef={props.previewRef}
          onProjectChanged={props.onProjectsChanged}
          entryPointsReady={props.journey.entryPoints.every((item) => !item.requiresEntryPoint || item.satisfied)}
        />
      )
    case 'verify':
      return (
        <>
          <ConnectionVerificationPanel
            bridge={bridge}
            projectId={projectId}
            bindings={props.inboundBindingRecords}
            integrationState={props.integrationState}
            projection="guided"
            onChanged={props.onChanged}
          />
          <VerificationPanel
            bridge={bridge}
            projectId={projectId}
            projection="guided"
            records={props.moduleRecords}
            onVerified={props.onChanged}
            onOpenModules={() => props.onView('build')}
          />
        </>
      )
  }
}

function StageBlocker(props: {
  reason: string
  helpTopic: GuideTopicId
  onOpenGuide?: (topic: GuideTopicId) => void
}) {
  return (
    <div className="panel-raised cap-blocker" role="status">
      <span className="cap-blocker-icon" aria-hidden="true">{Icon.info(18)}</span>
      <p>{props.reason}</p>
      <button type="button" className="btn btn-secondary btn-compact" onClick={() => props.onOpenGuide?.(props.helpTopic)}>
        Show me how
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ design */

export function DesignBody(props: {
  bridge: EuikBridge
  projectId: string
  project?: Project
  journey: ReturnType<typeof deriveJourney>
  section: DesignSection
  onSection: (s: DesignSection) => void
  moduleRecords: CapabilityModuleRecord[]
  attentionItems: AttentionItem[]
  architectureProjection: ReturnType<typeof projectArchitecture> | undefined
  archSpec: ArchitectureSpecification | undefined
  application: { draft?: unknown; approved?: unknown }
  architecture: { draft?: unknown; approved?: unknown }
  selectionEvidence: SelectionEvidence | undefined
  bindingRecords: CapabilityBindingRecord[]
  inboundBindingRecords: InboundBindingReadRecord[]
  deployables: CapabilityDeployableSummary[]
  previewRef: React.RefObject<CapabilityPreviewHandle | null>
  onChanged: () => void
  onProjectsChanged?: () => Promise<void> | void
  onSelectionEvidence: (e: SelectionEvidence | undefined) => void
  approvedFoundation?: FoundationPlan
  foundationGate?: { enabled: boolean; reason?: string }
  integrationState: CapabilityIntegrationState
}) {
  const { bridge, projectId } = props
  return (
    <div className="cap-design">
      <div className="tab-row" role="tablist" aria-label="Design areas">
        {DESIGN_SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={props.section === s.id}
            className={props.section === s.id ? 'tab active' : 'tab'}
            onClick={() => props.onSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <section className="capabilities-panel" role="region" aria-label={DESIGN_SECTIONS.find((s) => s.id === props.section)?.label}>
        {props.section === 'application' && (
          <ApplicationDefinition bridge={bridge} projectId={projectId} project={props.project} projection="design" onChanged={props.onChanged} />
        )}
        {props.section === 'architecture' && (
          <>
            <ArchitectureInterview
              bridge={bridge}
              projectId={projectId}
              architectureApproved={Boolean(props.architecture.approved)}
              projection="design"
              onChanged={props.onChanged}
            />
            {props.architectureProjection && <ArchitectureView projection={props.architectureProjection} mode="design" />}
          </>
        )}
        {props.section === 'attention' && (
          <>
            <NeedsAttention items={props.attentionItems} projection="design" />
            <ImpactQueue bridge={bridge} projectId={projectId} records={props.moduleRecords} projection="design" />
            <DeltaQueue bridge={bridge} projectId={projectId} projection="design" />
          </>
        )}
        {props.section === 'modules' && (
          <>
            <ModulesView
              bridge={bridge}
              projectId={projectId}
              architectureApproved={Boolean(props.architecture.approved)}
              projection="design"
              records={props.moduleRecords}
              onChanged={async () => props.onChanged()}
              onOpenArchitecture={() => props.onSection('architecture')}
              approvedFoundation={props.approvedFoundation}
              foundationGate={props.foundationGate}
            />
            <GuidedConnect
              bridge={bridge}
              projectId={projectId}
              project={props.project}
              records={props.moduleRecords}
              deployables={props.deployables}
              inboundBindingRecords={props.inboundBindingRecords}
              selectionEvidence={props.selectionEvidence}
              onSelectionEvidence={props.onSelectionEvidence}
              architectureVersion={props.archSpec?.revision}
              architectureHash={props.archSpec?.contentHash}
              previewRef={props.previewRef}
              onChanged={props.onChanged}
              onProjectChanged={props.onProjectsChanged}
              modulesReady={Boolean(props.archSpec?.moduleIds.length)
                && props.archSpec!.moduleIds.every((moduleId) => props.moduleRecords.some((record) => record.moduleId === moduleId && Boolean(record.approved)))}
            />
            <IntegrationWorkspace
              bridge={bridge}
              projectId={projectId}
              state={props.integrationState}
              projection="design"
              entryPointsReady={props.journey.entryPoints.every((item) => !item.requiresEntryPoint || item.satisfied)}
              modulesReady={Boolean(props.archSpec?.moduleIds.length)
                && props.archSpec!.moduleIds.every((moduleId) => props.moduleRecords.some((record) => record.moduleId === moduleId && Boolean(record.approved)))}
              onChanged={props.onChanged}
            />
          </>
        )}
        {props.section === 'verification' && (
          <>
            <ConnectionVerificationPanel
              bridge={bridge}
              projectId={projectId}
              bindings={props.inboundBindingRecords}
              integrationState={props.integrationState}
              projection="design"
              onChanged={props.onChanged}
            />
            <VerificationPanel bridge={bridge} projectId={projectId} projection="design" records={props.moduleRecords} onVerified={props.onChanged} onOpenModules={() => props.onSection('modules')} />
          </>
        )}
      </section>
    </div>
  )
}
