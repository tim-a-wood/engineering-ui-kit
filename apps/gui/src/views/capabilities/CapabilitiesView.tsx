/**
 * Capabilities top-level page.
 *
 * Guided and Design are two projections over ONE canonical model. Guided walks a
 * five-step journey (Plan → Design → Build → Connect → Verify) and gates
 * locked stages so impossible downstream workflows can never be opened. Design
 * exposes the same records as the six canonical areas (Section 31). No projection
 * or stepper state is persisted (CAP-DEC-001/002) — the journey is derived on
 * every render from canonical records.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { projectArchitecture } from '@engineering-ui-kit/core/browser'
import type {
  ArchitectureSpecification,
  AttentionItem,
  CapabilityModuleRecord,
  CapabilityBindingRecord,
  ModuleManifest,
  Project,
  SelectionEvidence,
} from '@engineering-ui-kit/core'
import type { EuikBridge } from '../../bridge'
import { EmptyState, PageHeader } from '../../components'
import { Icon } from '../../icons'
import type { GuideTopicId } from '../../guides'
import { ApplicationDefinition } from './ApplicationDefinition'
import { ArchitectureInterview } from './ArchitectureInterview'
import { ArchitectureView } from './ArchitectureView'
import { BindingEditor } from './BindingEditor'
import { CapabilityJourney } from './CapabilityJourney'
import { CapabilityPreview, type CapabilityPreviewHandle } from './CapabilityPreview'
import { GuidedConnect } from './GuidedConnect'
import { GuidedBuild } from './GuidedBuild'
import { DeltaQueue } from './DeltaQueue'
import { ModulesView } from './ModulesView'
import { ImpactQueue } from './ImpactQueue'
import { NeedsAttention } from './NeedsAttention'
import { PreviewBindingPicker } from './PreviewBindingPicker'
import { VerificationPanel } from './VerificationPanel'
import {
  deriveJourney,
  stageById,
  STAGE_LABELS,
  type JourneyInput,
  type StageId,
} from './capabilitiesUiState'
import {
  DESIGN_SECTIONS,
  designSectionToStage,
  stageToDesignSection,
  stageToGuideTopic,
  type DesignSection,
} from './capabilityPresentation'

export type CapabilitiesProjection = 'guided' | 'design'

type GuidedPanel = 'journey' | 'attention' | 'changes'

type Props = {
  bridge: EuikBridge
  projects: Project[]
  activeProjectId?: string
  onOpenGuide?: (topic: GuideTopicId) => void
  onNavigateToProjects?: () => void
}

export function CapabilitiesView({
  bridge,
  projects,
  onOpenGuide,
  onNavigateToProjects,
}: Props) {
  const [projection, setProjection] = useState<CapabilitiesProjection>('guided')
  // No project is initialized implicitly (Section 31): selection is an explicit action.
  const [projectId, setProjectId] = useState('')
  const [application, setApplication] = useState<{ draft?: unknown; approved?: unknown }>({})
  const [architecture, setArchitecture] = useState<{ draft?: unknown; approved?: unknown }>({})
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([])
  const [moduleRecords, setModuleRecords] = useState<CapabilityModuleRecord[]>([])
  const [bindingRecords, setBindingRecords] = useState<CapabilityBindingRecord[]>([])
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

  const journeyInput: JourneyInput = useMemo(
    () => ({ application, architecture, modules: moduleRecords, bindings: bindingRecords }),
    [application, architecture, moduleRecords, bindingRecords],
  )
  const journey = useMemo(() => deriveJourney(journeyInput), [journeyInput])

  const fetchWorkspace = useCallback(
    async (id: string) => {
      const [app, arch, attention, modules, bindings] = await Promise.all([
        bridge.capabilitiesGetApplication(id),
        bridge.capabilitiesGetArchitecture(id),
        bridge.capabilitiesListNeedsAttention(id),
        bridge.capabilitiesListModules(id),
        bridge.capabilitiesListBindings(id),
      ])
      return { application: app, architecture: arch, attention, modules, bindings }
    },
    [bridge],
  )

  function clearRecords() {
    setApplication({})
    setArchitecture({})
    setAttentionItems([])
    setModuleRecords([])
    setBindingRecords([])
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
        setBindingRecords(d.bindings)
        const derived = deriveJourney({ application: d.application, architecture: d.architecture, modules: d.modules, bindings: d.bindings })
        setViewing(derived.firstIncompleteStageId)
        setDesignSection(stageToDesignSection(derived.firstIncompleteStageId))
        setLoadState('ready')
      } catch (error) {
        if (gen !== loadGenRef.current || id !== activeProjectRef.current) return
        setLoadError(error instanceof Error ? error.message : String(error))
        setLoadState('error') // never fall back to the previous project's records
      }
    },
    [bridge, fetchWorkspace],
  )

  const selectProject = useCallback(
    async (id: string) => {
      // Invalidate any in-flight load immediately so stale records can never render.
      loadGenRef.current++
      activeProjectRef.current = id
      setProjectId(id)
      clearRecords()
      if (!id) {
        setLoadState('idle')
        return
      }
      await loadProject(id)
    },
    [loadProject],
  )

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
    setBindingRecords(d.bindings)
  }, [projectId, fetchWorkspace])

  const architectureProjection = useMemo(() => {
    const arch = (architecture.approved ?? architecture.draft) as ArchitectureSpecification | undefined
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

  function openDesignSection(section: DesignSection) {
    setDesignSection(section)
    // Long areas such as Connections must not donate their scroll offset to the
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
  const attentionCount = attentionItems.length

  const headerActions = (
    <>
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
          aria-pressed={guidedPanel === 'attention'}
          onClick={() => setGuidedPanel(guidedPanel === 'attention' ? 'journey' : 'attention')}
        >
          {Icon.alertTriangle(14)} Needs attention
          <span className="badge">{attentionCount}</span>
        </button>
      )}
      {projectId && projection === 'guided' && (
        <button
          type="button"
          className={guidedPanel === 'changes' ? 'btn btn-secondary btn-compact active' : 'btn btn-secondary btn-compact'}
          aria-pressed={guidedPanel === 'changes'}
          onClick={() => setGuidedPanel(guidedPanel === 'changes' ? 'journey' : 'changes')}
        >
          {Icon.layers(14)} Changes
        </button>
      )}
      <button
        type="button"
        className="btn btn-ghost btn-compact"
        onClick={() => onOpenGuide?.(projection === 'guided' ? stageToGuideTopic(viewing) : 'capabilities-overview')}
      >
        {Icon.help(14)} {projection === 'guided' ? 'Stage guide' : 'Capability guide'}
      </button>
    </>
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
        actions={headerActions}
      />

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
          journey={journey}
          viewing={viewing}
          panel={guidedPanel}
          moduleRecords={moduleRecords}
          attentionItems={attentionItems}
          architectureProjection={architectureProjection}
          archSpec={archSpec}
          selectionEvidence={selectionEvidence}
          bindingRecords={bindingRecords}
          previewRef={previewRef}
          stageHeadingRef={stageHeadingRef}
          onView={viewStage}
          onChanged={refresh}
          onSelectionEvidence={setSelectionEvidence}
          onOpenGuide={onOpenGuide}
          onClosePanel={() => setGuidedPanel('journey')}
        />
      ) : (
        <DesignBody
          key={projectId}
          bridge={bridge}
          projectId={projectId}
          section={designSection}
          onSection={openDesignSection}
          moduleRecords={moduleRecords}
          attentionItems={attentionItems}
          architectureProjection={architectureProjection}
          archSpec={archSpec}
          application={application}
          architecture={architecture}
          selectionEvidence={selectionEvidence}
          bindingRecords={bindingRecords}
          previewRef={previewRef}
          onChanged={refresh}
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
  journey: ReturnType<typeof deriveJourney>
  viewing: StageId
  panel: GuidedPanel
  moduleRecords: CapabilityModuleRecord[]
  attentionItems: AttentionItem[]
  architectureProjection: ReturnType<typeof projectArchitecture> | undefined
  archSpec: ArchitectureSpecification | undefined
  selectionEvidence: SelectionEvidence | undefined
  bindingRecords: CapabilityBindingRecord[]
  previewRef: React.RefObject<CapabilityPreviewHandle | null>
  stageHeadingRef: React.RefObject<HTMLHeadingElement | null>
  onView: (id: StageId) => void
  onChanged: () => void
  onSelectionEvidence: (e: SelectionEvidence | undefined) => void
  onOpenGuide?: (topic: GuideTopicId) => void
  onClosePanel: () => void
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
            const target: StageId = item.primaryState === 'draft' ? 'build' : 'verify'
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
      <section className="capabilities-panel cap-stage" aria-label={`${stageLabel} stage`} aria-live="polite">
        <div className="cap-stage-head">
          <h2 ref={props.stageHeadingRef} tabIndex={-1}>
            {stageLabel}
          </h2>
          <button
            type="button"
            className="btn btn-ghost btn-compact"
            onClick={() => props.onOpenGuide?.(stageToGuideTopic(stage.id))}
          >
            {Icon.help(14)} How this works
          </button>
        </div>
        <GuidedStage {...props} stage={stage} />
        <StageCompletion journey={props.journey} stageId={stage.id} onView={props.onView} />
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
        <div className="cap-stage-complete" role="status">
          <span className="cap-complete-icon" aria-hidden="true">{Icon.shieldCheck(18)}</span>
          <p>Every module is approved and ready. The Capabilities journey is complete.</p>
        </div>
      )
    }
    return null
  }
  const next = props.journey.stages.find((s) => s.id === stage.nextStageId)
  if (!next || next.state === 'locked') return null
  return (
    <div className="cap-stage-complete" role="status">
      <span className="cap-complete-icon" aria-hidden="true">{Icon.check(16)}</span>
      <button type="button" className="btn btn-primary btn-compact" onClick={() => props.onView(next.id)}>
        Continue to {STAGE_LABELS[next.id]} {Icon.arrowRight(14)}
      </button>
    </div>
  )
}

function GuidedStage(props: {
  bridge: EuikBridge
  projectId: string
  stage: ReturnType<typeof stageById>
  journey: ReturnType<typeof deriveJourney>
  moduleRecords: CapabilityModuleRecord[]
  architectureProjection: ReturnType<typeof projectArchitecture> | undefined
  archSpec: ArchitectureSpecification | undefined
  selectionEvidence: SelectionEvidence | undefined
  bindingRecords: CapabilityBindingRecord[]
  previewRef: React.RefObject<CapabilityPreviewHandle | null>
  onChanged: () => void
  onSelectionEvidence: (e: SelectionEvidence | undefined) => void
  onOpenGuide?: (topic: GuideTopicId) => void
  onView: (id: StageId) => void
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
            architectureApproved={stage.state === 'complete'}
            projection="guided"
            onApproved={props.onChanged}
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
        />
      )
    case 'connect':
      if (stage.state === 'not-applicable') {
        return (
          <p className="cap-stage-na" role="status">
            This application has no user-interface modules, so there is nothing to connect. You can continue to Verify.
          </p>
        )
      }
      return (
        <GuidedConnect
          key={`${projectId}:${props.bindingRecords[0]?.bindingId ?? 'new'}`}
          bridge={bridge}
          projectId={projectId}
          records={props.moduleRecords}
          selectionEvidence={props.selectionEvidence}
          onSelectionEvidence={props.onSelectionEvidence}
          architectureVersion={props.archSpec?.revision}
          architectureHash={props.archSpec?.contentHash}
          initialBinding={props.bindingRecords[0]?.draft ?? props.bindingRecords[0]?.approved}
          previewRef={props.previewRef}
          onChanged={props.onChanged}
        />
      )
    case 'verify':
      return (
        <VerificationPanel
          bridge={bridge}
          projectId={projectId}
          projection="guided"
          records={props.moduleRecords}
          onVerified={props.onChanged}
        />
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
  previewRef: React.RefObject<CapabilityPreviewHandle | null>
  onChanged: () => void
  onSelectionEvidence: (e: SelectionEvidence | undefined) => void
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
          <ApplicationDefinition bridge={bridge} projectId={projectId} projection="design" onChanged={props.onChanged} />
        )}
        {props.section === 'architecture' && (
          <>
            <ArchitectureInterview
              bridge={bridge}
              projectId={projectId}
              architectureApproved={Boolean(props.architecture.approved)}
              projection="design"
              onApproved={props.onChanged}
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
          <ModulesView
            bridge={bridge}
            projectId={projectId}
            architectureApproved={Boolean(props.architecture.approved)}
            projection="design"
            records={props.moduleRecords}
            onChanged={async () => props.onChanged()}
            onOpenArchitecture={() => props.onSection('architecture')}
          />
        )}
        {props.section === 'connections' && (
          <div className="capabilities-connections">
            <CapabilityPreview ref={props.previewRef} bridge={bridge} projectId={projectId} />
            <PreviewBindingPicker
              disabled={!projectId}
              pickFromPreview={() =>
                props.previewRef.current?.pickElement() ??
                Promise.reject(new Error('Start Preview before selecting an element.'))
              }
              onEvidenceReady={props.onSelectionEvidence}
              onCancel={() => props.onSelectionEvidence(undefined)}
            />
            <BindingEditor
              bridge={bridge}
              projectId={projectId}
              projection="design"
              selectionEvidence={props.selectionEvidence}
              architectureVersion={props.archSpec?.revision}
              architectureHash={props.archSpec?.contentHash}
              records={props.moduleRecords}
              initialBinding={props.bindingRecords[0]?.draft ?? props.bindingRecords[0]?.approved}
              onChanged={props.onChanged}
            />
          </div>
        )}
        {props.section === 'verification' && (
          <VerificationPanel
            bridge={bridge}
            projectId={projectId}
            projection="design"
            records={props.moduleRecords}
            onVerified={props.onChanged}
            onOpenModules={() => props.onSection('modules')}
          />
        )}
      </section>
    </div>
  )
}
