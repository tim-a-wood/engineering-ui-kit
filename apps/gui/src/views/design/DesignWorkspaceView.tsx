/**
 * §8, §9, §18 Design workspace — the use-case-led Design view. Contains the
 * system canvas (§8.2) and the module-design workspace (§9): a module queue,
 * the current module's session, and system context (§18.2).
 */

import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { currentResultState, type ModuleDesignStep } from '@engineering-ui-kit/core/design-browser'
import type { HandoffRun, Project } from '@engineering-ui-kit/core'
import type { ModuleImplementationPacket } from '@engineering-ui-kit/core/design-browser'
import { AUTHORITY_NOT_CONFIGURED_CODE, DesignStore, useDesignState, type MultiModuleConfirmations } from './designState'
import { ModuleQueue } from './ModuleQueue'
import { ModuleSessionView } from './ModuleSessionView'
import { SystemCanvas } from './SystemCanvas'
import { WavesView } from './WavesView'
import { BuildHandoffView } from './BuildHandoffView'
import { DesignVerifyView } from './DesignVerifyView'
import { EvidenceExplorer } from './EvidenceExplorer'
import { ProjectSetupPanel } from './ProjectSetupPanel'
import { SaveIndicator, approvalCountText } from './designShared'
import { UseCasePlanView } from './UseCasePlanView'
import { SystemDesignGate } from './SystemDesignGate'
import { WorkflowConnectView } from './WorkflowConnectView'
import { WorkflowEvidenceView } from './WorkflowEvidenceView'
import { ApplicationBehaviorView } from './ApplicationBehaviorView'
import { WorkflowAllocationView } from './WorkflowAllocationView'

const NARROW_BREAKPOINT = 900

export type WorkspaceTab = 'plan' | 'design' | 'build' | 'connect' | 'verify' | 'evidence' | 'setup'
type WorkspaceProjection = 'guided' | 'technical'

const TABS: { id: WorkspaceTab; label: string }[] = [
  { id: 'setup', label: 'Setup' },
  { id: 'plan', label: 'Plan' },
  { id: 'design', label: 'Design' },
  { id: 'build', label: 'Build' },
  { id: 'connect', label: 'Connect' },
  { id: 'verify', label: 'Verify' },
  { id: 'evidence', label: 'Evidence' },
]

const GUIDED_STAGES: { id: Exclude<WorkspaceTab, 'setup'>; label: string; description: string }[] = [
  { id: 'plan', label: 'Plan', description: 'Describe and approve what users need to accomplish.' },
  { id: 'design', label: 'Design', description: 'Approve the system structure and its module designs.' },
  { id: 'build', label: 'Build', description: 'Prepare one approved module for implementation and delivery.' },
  { id: 'connect', label: 'Connect', description: 'Configure and prove how the built capability is reached.' },
  { id: 'verify', label: 'Verify', description: 'Run the approved scenarios against the current build.' },
  { id: 'evidence', label: 'Evidence', description: 'Review the immutable run and its original artifacts.' },
]

type WorkflowRoute = {
  tab?: WorkspaceTab
  projection?: WorkspaceProjection
  moduleId?: string
  runId?: string
  useCaseId?: string
  scenarioId?: string
  diagramElementId?: string
  artifactRef?: string
}

function routeStorageKey(projectId: string): string {
  return `euik-design-route:${projectId}`
}

function parseWorkflowRoute(projectId: string): WorkflowRoute {
  if (typeof window === 'undefined') return {}
  const hash = window.location.hash
  const match = /^#capabilities\/(setup|plan|design|build|connect|verify|evidence)(?:\?(.*))?$/i.exec(hash)
  if (match) {
    const params = new URLSearchParams(match[2] ?? '')
    return {
      tab: match[1]?.toLowerCase() as WorkspaceTab,
      projection: params.get('mode') === 'technical' ? 'technical' : 'guided',
      moduleId: params.get('module') ?? undefined,
      runId: params.get('run') ?? undefined,
      useCaseId: params.get('useCase') ?? undefined,
      scenarioId: params.get('scenario') ?? undefined,
      diagramElementId: params.get('element') ?? undefined,
      artifactRef: params.get('artifact') ?? undefined,
    }
  }
  try {
    const saved = window.localStorage.getItem(routeStorageKey(projectId))
    return saved ? JSON.parse(saved) as WorkflowRoute : {}
  } catch {
    return {}
  }
}

function replaceWorkflowRoute(projectId: string, route: WorkflowRoute): void {
  if (typeof window === 'undefined' || !route.tab) return
  const params = new URLSearchParams()
  params.set('mode', route.projection ?? 'guided')
  if (route.moduleId) params.set('module', route.moduleId)
  if (route.runId) params.set('run', route.runId)
  if (route.useCaseId) params.set('useCase', route.useCaseId)
  if (route.scenarioId) params.set('scenario', route.scenarioId)
  if (route.diagramElementId) params.set('element', route.diagramElementId)
  if (route.artifactRef) params.set('artifact', route.artifactRef)
  const hash = `#capabilities/${route.tab}?${params.toString()}`
  try {
    window.localStorage.setItem(routeStorageKey(projectId), JSON.stringify(route))
  } catch {
    // Private browsing may reject persistence; the URL remains authoritative.
  }
  if (window.location.hash !== hash) window.history.replaceState(null, '', hash)
}

function useIsNarrow(breakpoint = NARROW_BREAKPOINT): boolean {
  const [narrow, setNarrow] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches
  })
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const listener = () => setNarrow(query.matches)
    if (query.addEventListener) query.addEventListener('change', listener)
    else query.addListener(listener)
    return () => {
      if (query.removeEventListener) query.removeEventListener('change', listener)
      else query.removeListener(listener)
    }
  }, [breakpoint])
  return narrow
}

export type DesignWorkspaceViewProps = {
  store: DesignStore
  projects?: Project[]
  activeProjectId?: string
  onProjectSelected?: (projectId: string) => void
  /** Whether this runtime can open project-backed design operations. */
  projectModeAvailable?: boolean
  onNavigateToProjects?: () => void
  linkedRun?: HandoffRun
  onContinueToBuild?: (input: { packet: ModuleImplementationPacket; moduleName: string }) => Promise<void> | void
  /** The app opens at Plan; component-level design tests retain Design as their default. */
  initialTab?: WorkspaceTab
}

export function DesignWorkspaceView(props: DesignWorkspaceViewProps) {
  const state = useDesignState(props.store)
  const narrow = useIsNarrow()
  const initialRoute = useMemo(() => parseWorkflowRoute(state.projectId), [state.projectId])
  const [queueOpen, setQueueOpen] = useState(!narrow)
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialRoute.tab ?? props.initialTab ?? 'design')
  const [projection, setProjection] = useState<WorkspaceProjection>(initialRoute.projection ?? 'guided')
  const [planSection, setPlanSection] = useState<'use-cases' | 'workflows'>('use-cases')
  const [routedRunId, setRoutedRunId] = useState(initialRoute.runId ?? '')
  const [routedUseCaseId, setRoutedUseCaseId] = useState(initialRoute.useCaseId ?? '')
  const [routedScenarioId, setRoutedScenarioId] = useState(initialRoute.scenarioId ?? '')
  const [routedDiagramElementId, setRoutedDiagramElementId] = useState(initialRoute.diagramElementId ?? '')
  const [routedArtifactRef, setRoutedArtifactRef] = useState(initialRoute.artifactRef ?? '')

  const selectedEntry = useMemo(
    () => state.progress.modules.find((entry) => entry.moduleId === state.selectedModuleId),
    [state.progress, state.selectedModuleId],
  )
  const design = state.selectedModuleId ? props.store.getDesign(state.selectedModuleId) : undefined
  const approvedDesign = state.selectedModuleId ? state.approvedModuleDesigns[state.selectedModuleId] : undefined
  const session = state.selectedModuleId ? props.store.getSession(state.selectedModuleId) : undefined
  const checks = state.selectedModuleId ? props.store.evaluateChecks(state.selectedModuleId) : undefined
  const primaryActionLabel = state.selectedModuleId ? props.store.primaryActionLabel(state.selectedModuleId) : 'Create module draft'

  useEffect(() => {
    props.store.setExecutionIdentity({
      build: props.linkedRun?.id ?? '',
      sourceRevision: props.linkedRun?.designHandoff?.packetContentHash ?? '',
      environment: state.mode === 'project' ? 'desktop-project' : 'bundled-showcase',
      testDataRevision: state.useCaseAnalysis.contentHash,
      runner: state.mode === 'project' ? 'desktop-project-runner' : 'bundled-showcase',
    })
  }, [
    props.linkedRun?.designHandoff?.packetContentHash,
    props.linkedRun?.id,
    props.store,
    state.mode,
    state.useCaseAnalysis.contentHash,
  ])

  useEffect(() => {
    const route = parseWorkflowRoute(state.projectId)
    setActiveTab(route.tab ?? props.initialTab ?? 'design')
    setProjection(route.projection ?? 'guided')
    setRoutedRunId(route.runId ?? '')
    setRoutedUseCaseId(route.useCaseId ?? '')
    setRoutedScenarioId(route.scenarioId ?? '')
    setRoutedDiagramElementId(route.diagramElementId ?? '')
    setRoutedArtifactRef(route.artifactRef ?? '')
    if (route.moduleId && state.progress.modules.some((entry) => entry.moduleId === route.moduleId)) {
      props.store.selectModule(route.moduleId)
    }
    if (state.mode === 'project') {
      void props.store.loadProjectSetup()
      void props.store.loadProjectConnections()
    }
  }, [props.initialTab, props.store, state.mode, state.projectId]) // project switch is a real workspace switch

  useEffect(() => {
    replaceWorkflowRoute(state.projectId, {
      tab: activeTab,
      projection,
      moduleId: state.selectedModuleId,
      runId: activeTab === 'evidence' ? routedRunId || props.linkedRun?.id : undefined,
      useCaseId: activeTab === 'plan' ? routedUseCaseId || undefined : undefined,
      scenarioId: activeTab === 'verify' ? routedScenarioId || undefined : undefined,
      diagramElementId: activeTab === 'design' ? routedDiagramElementId || undefined : undefined,
      artifactRef: activeTab === 'evidence' ? routedArtifactRef || undefined : undefined,
    })
  }, [activeTab, projection, props.linkedRun?.id, routedArtifactRef, routedDiagramElementId, routedRunId, routedScenarioId, routedUseCaseId, state.projectId, state.selectedModuleId])

  useEffect(() => {
    if (!narrow || projection !== 'guided' || activeTab === 'setup' || typeof document === 'undefined') return
    const currentStage = document.getElementById(`design-workspace-tab-${activeTab}`)
    if (typeof currentStage?.scrollIntoView === 'function') {
      currentStage.scrollIntoView({ block: 'nearest', inline: 'center' })
    }
  }, [activeTab, narrow, projection])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onRouteChange = () => {
      const route = parseWorkflowRoute(state.projectId)
      if (route.tab) setActiveTab(route.tab)
      if (route.projection) setProjection(route.projection)
      setRoutedRunId(route.runId ?? '')
      setRoutedUseCaseId(route.useCaseId ?? '')
      setRoutedScenarioId(route.scenarioId ?? '')
      setRoutedDiagramElementId(route.diagramElementId ?? '')
      setRoutedArtifactRef(route.artifactRef ?? '')
      if (route.moduleId && state.progress.modules.some((entry) => entry.moduleId === route.moduleId)) {
        props.store.selectModule(route.moduleId)
      }
    }
    window.addEventListener('hashchange', onRouteChange)
    window.addEventListener('popstate', onRouteChange)
    return () => {
      window.removeEventListener('hashchange', onRouteChange)
      window.removeEventListener('popstate', onRouteChange)
    }
  }, [props.store, state.progress.modules, state.projectId])

  const hasValidEvidence = (run: (typeof state.scenarioRuns)[number]) =>
    run.steps.length > 0 && run.steps.every((step) => {
      if (step.artifacts?.length) return step.artifacts.every((artifact) => artifact.status !== 'missing')
      return Boolean(step.screenshotRef || step.structuredEvidenceRef || step.screenshotNotApplicableReason)
    })
  const currentModuleDesignRevisions = Object.fromEntries(
    state.moduleDesigns.map((moduleDesign) => [moduleDesign.module.moduleId, moduleDesign.revision]),
  )
  const currentRevisions = {
    useCaseAnalysisRevision: state.useCaseAnalysis.revision,
    applicationRevision: state.architecture.applicationSpecRevision,
    systemStructureRevision: state.architecture.revision,
    moduleDesignRevisions: currentModuleDesignRevisions,
  }
  const currentRuns = state.scenarioRuns.filter((run) => currentResultState(run, currentRevisions) === 'current')
  const currentPassingRuns = currentRuns.filter((run) => run.outcome === 'passed')
  const historicalEvidenceComplete = state.scenarioRuns.length > 0 && state.scenarioRuns.every(hasValidEvidence)
  const planComplete = state.useCaseAnalysis.status === 'approved'
  const designComplete = planComplete
    && state.architecture.status === 'approved'
    && state.progress.total > 0
    && state.progress.approved === state.progress.total
  const buildRecorded = state.mode === 'sample'
    ? state.scenarioRuns.some((run) => Boolean(run.identity.build))
    : Boolean(props.linkedRun?.appliedFilesPath
      || props.linkedRun?.completionStatus === 'approved'
      || Object.values(state.deltaFlows).some((flow) => flow.applyResult?.applied)
      || currentRuns.some((run) => Boolean(run.identity.build)))
  const buildComplete = designComplete && buildRecorded
  const connectionRecorded = state.mode === 'sample'
    ? state.scenarioRuns.some((run) => Boolean(run.identity.connectionRevision))
    : Object.values(state.connections).some((connection) => connection.status === 'verified')
      || currentRuns.some((run) => Boolean(run.identity.connectionRevision))
  const connectComplete = buildComplete && connectionRecorded
  const verifyComplete = connectComplete && currentPassingRuns.length > 0
  const evidenceComplete = verifyComplete && currentRuns.length > 0 && currentRuns.every(hasValidEvidence)
  const stageCompletion: Record<Exclude<WorkspaceTab, 'setup'>, boolean> = {
    plan: planComplete,
    design: designComplete,
    build: buildComplete,
    connect: connectComplete,
    verify: verifyComplete,
    evidence: evidenceComplete,
  }
  const recordedDataAvailable: Record<Exclude<WorkspaceTab, 'setup'>, boolean> = {
    plan: Boolean(state.useCaseAnalysis.revision),
    design: Boolean(state.architecture.revision || state.moduleDesigns.length),
    build: buildRecorded,
    connect: connectionRecorded,
    verify: state.scenarioRuns.length > 0,
    evidence: historicalEvidenceComplete,
  }
  const firstIncompleteStage = GUIDED_STAGES.find((stage) => !stageCompletion[stage.id])?.id
  const guidedStages = GUIDED_STAGES.map((stage, index) => {
    const firstIncompleteIndex = firstIncompleteStage
      ? GUIDED_STAGES.findIndex((candidate) => candidate.id === firstIncompleteStage)
      : GUIDED_STAGES.length
    const complete = stageCompletion[stage.id]
    const locked = state.mode === 'project' && !complete && index > firstIncompleteIndex
    const status = stage.id === 'design'
      ? `${state.progress.approved}/${state.progress.total} approved`
      : stage.id === 'verify'
        ? `${currentPassingRuns.length} current pass${currentPassingRuns.length === 1 ? '' : 'es'}`
        : complete
          ? 'Complete'
          : locked
            ? `Complete ${GUIDED_STAGES[index - 1]?.label ?? 'the previous stage'} first`
            : state.mode === 'sample' && recordedDataAvailable[stage.id] && stage.id !== firstIncompleteStage
              ? 'Recorded showcase'
              : 'Next action'
    return { ...stage, complete, locked, current: firstIncompleteStage === stage.id, status }
  })

  function openWorkspaceTab(tab: WorkspaceTab) {
    setActiveTab(tab)
  }

  function selectModule(moduleId: string) {
    props.store.selectModule(moduleId)
    if (narrow) setQueueOpen(false)
  }

  function goToDesignRecord(moduleId: string) {
    props.store.selectModule(moduleId)
    openWorkspaceTab('design')
  }

  // §17.3, §4, §20.2 — the Setup tab (repository root, session principal,
  // project roles) only makes sense once there is a real project behind the
  // bridge; `sample` mode has no adapter to configure (second-review P1
  // finding).
  const visibleTabs = state.mode === 'project' ? TABS : TABS.filter((tab) => tab.id !== 'setup')

  function onTabKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const currentIndex = visibleTabs.findIndex((tab) => tab.id === activeTab)
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const delta = event.key === 'ArrowRight' ? 1 : -1
      const next = visibleTabs[(currentIndex + delta + visibleTabs.length) % visibleTabs.length]!
      setActiveTab(next.id)
      document.getElementById(`design-workspace-tab-${next.id}`)?.focus()
    }
  }

  const blockingModuleNamesForStatus = state.systemStatus.blockingModuleIds.map(
    (id) => state.progress.modules.find((entry) => entry.moduleId === id)?.name ?? id,
  )

  // Blocked-state guidance (§17.3, §4 — second-review P1): a rejected
  // approval whose diagnostics include `EUC16-AUTHORITY-NOT-CONFIGURED`
  // gets an explicit link back to the Setup tab instead of a dead end.
  const authorityNotConfigured = state.mode === 'project' && state.lastOperationDiagnostics.some((d) => d.code === AUTHORITY_NOT_CONFIGURED_CODE)

  return (
    <div className={narrow ? 'design-workspace narrow' : 'design-workspace'} data-mode={state.mode} data-projection={projection}>
      {state.mode === 'sample' ? (
        <aside className="design-sample-banner" role="note">
          <div>
            <strong>Synthetic workflow showcase</strong>
            <span>DO-178C Audit Hub · bundled fixture records · no production data</span>
          </div>
          <details>
            <summary>About this showcase</summary>
            <p>
              {state.syntheticDataStatement} Module practice edits are saved only in this browser.
              {props.projectModeAvailable === false && ' Project-backed design is available in the desktop app. This browser build stays on bundled data.'}
            </p>
          </details>
          {props.onNavigateToProjects && (
            <button type="button" className="btn btn-secondary btn-compact" onClick={props.onNavigateToProjects}>
              Select project
            </button>
          )}
        </aside>
      ) : (
        <>
          {state.bridgeStatus === 'loading' && (
            <p className="design-project-loading" role="status">
              Loading project design workspace…
            </p>
          )}
          {state.bridgeError && (
            <p className="design-project-error" role="alert">
              {state.bridgeError}
            </p>
          )}
          {authorityNotConfigured && (
            <div className="design-authority-blocked" role="alert">
              <p>
                {state.lastOperationDiagnostics.find((d) => d.code === AUTHORITY_NOT_CONFIGURED_CODE)?.message ??
                  'This session has no configured project role for the attempted approval.'}
              </p>
              <button type="button" className="btn btn-secondary" onClick={() => {
                setProjection('technical')
                setActiveTab('setup')
              }}>
                Go to project setup
              </button>
            </div>
          )}
        </>
      )}

      <div className="sr-only" role="status" aria-live="polite">
        {state.announcement}
      </div>

      <header className="design-workspace-header">
        <div className="design-workspace-title">
          <p className="overline">Use-case-led delivery</p>
          <h1>Product delivery</h1>
        </div>
        <div className="design-workspace-header-controls">
          {props.projects && props.onProjectSelected && (
            <div className="design-project-picker">
              <label>
                Project
                <select
                  aria-label="Capabilities workflow project"
                  value={props.projectModeAvailable === false ? '' : props.activeProjectId ?? ''}
                  onChange={(event) => props.onProjectSelected?.(event.target.value)}
                >
                  <option value="">DO-178C showcase</option>
                  {props.projects.map((project) => (
                    <option key={project.id} value={project.id} disabled={props.projectModeAvailable === false}>
                      {project.name}{props.projectModeAvailable === false ? ' (desktop app)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              {props.onNavigateToProjects && <button type="button" className="btn btn-ghost btn-compact" onClick={props.onNavigateToProjects}>Manage projects</button>}
            </div>
          )}
          <div className="design-projection-switch" role="group" aria-label="Workflow view">
            <button
              type="button"
              aria-pressed={projection === 'guided'}
              className={projection === 'guided' ? 'active' : ''}
              onClick={() => {
                setProjection('guided')
                if (activeTab === 'setup') setActiveTab(firstIncompleteStage ?? 'evidence')
              }}
            >
              Guided
            </button>
            <button
              type="button"
              aria-pressed={projection === 'technical'}
              className={projection === 'technical' ? 'active' : ''}
              onClick={() => setProjection('technical')}
            >
              Technical
            </button>
          </div>
        </div>
        <div className="design-workspace-meta">
          <p className="design-system-status">
            Use cases {state.useCaseAnalysis.status === 'approved' ? 'approved' : 'not yet approved'} · system structure {state.systemStatus.approved ? 'approved' : 'not yet approved'} · {approvalCountText(state.progress)},{' '}
            {state.progress.total - state.progress.approved} remain.
            {blockingModuleNamesForStatus.length > 0 && <> Blocking: {blockingModuleNamesForStatus.join(', ')}.</>}
          </p>
          <SaveIndicator saveState={state.saveState} savedAt={state.savedAt} mode={state.mode} />
        </div>
      </header>

      {state.mode === 'project' && (
        <section className="design-readiness-strip" aria-label="Project readiness">
          <div>
            <span className={state.repositoryConfig.status === 'configured' ? 'complete' : 'blocked'}>
              {state.repositoryConfig.status === 'configured' ? '✓ Repository connected' : '○ Repository setup required'}
            </span>
            <span className={state.principal.status === 'ready' ? 'complete' : 'blocked'}>
              {state.principal.status === 'ready' ? '✓ Session identified' : '○ Session identity required'}
            </span>
            <span className={state.rolesGrant.status === 'granted' ? 'complete' : 'blocked'}>
              {state.rolesGrant.status === 'granted' ? '✓ Approval roles ready' : '○ Approval roles need confirmation'}
            </span>
          </div>
          <button type="button" className="btn btn-secondary btn-compact" onClick={() => {
            setProjection('technical')
            setActiveTab('setup')
          }}>
            Review project setup
          </button>
        </section>
      )}

      {projection === 'guided' ? (
        <>
          <ol className="design-journey-rail" aria-label="Product delivery stages">
            {guidedStages.map((stage, index) => (
              <li key={stage.id} className={`${stage.complete ? 'complete' : stage.locked ? 'locked' : stage.current ? 'current' : 'available'}${activeTab === stage.id ? ' viewing' : ''}`}>
                <button
                  id={`design-workspace-tab-${stage.id}`}
                  type="button"
                  disabled={stage.locked}
                  aria-current={activeTab === stage.id ? 'step' : undefined}
                  title={stage.locked ? stage.status : undefined}
                  onClick={() => openWorkspaceTab(stage.id)}
                >
                  <span className="design-journey-marker" aria-hidden="true">{stage.complete ? '✓' : index + 1}</span>
                  <span><b>{stage.label}</b><small>{stage.status}</small></span>
                </button>
              </li>
            ))}
          </ol>
          {activeTab !== 'setup' && (
            <section className="design-guided-stage-heading">
              <div>
                <p className="overline">Stage {GUIDED_STAGES.findIndex((stage) => stage.id === activeTab) + 1} of {GUIDED_STAGES.length}</p>
                <h2>{GUIDED_STAGES.find((stage) => stage.id === activeTab)?.label}</h2>
                <p>{GUIDED_STAGES.find((stage) => stage.id === activeTab)?.description}</p>
              </div>
              <span className={stageCompletion[activeTab as Exclude<WorkspaceTab, 'setup'>] ? 'complete' : 'current'}>
                {stageCompletion[activeTab as Exclude<WorkspaceTab, 'setup'>] ? '✓ Complete' : 'In progress'}
              </span>
            </section>
          )}
        </>
      ) : (
        <div role="tablist" aria-label="Technical workflow sections" className="design-workspace-tabs" onKeyDown={onTabKeyDown}>
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              id={`design-workspace-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-current={activeTab === tab.id ? 'true' : undefined}
              aria-controls={`design-workspace-panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              className={activeTab === tab.id ? 'design-workspace-tab active' : 'design-workspace-tab'}
              onClick={() => openWorkspaceTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'plan' && (
        <div id="design-workspace-panel-plan" role="tabpanel" aria-labelledby="design-workspace-tab-plan">
          <div className="design-level-switch" role="tablist" aria-label="Plan behavior level">
            <button
              type="button"
              role="tab"
              aria-selected={planSection === 'use-cases'}
              className={planSection === 'use-cases' ? 'active' : ''}
              onClick={() => setPlanSection('use-cases')}
            >
              Use-case analysis
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={planSection === 'workflows'}
              className={planSection === 'workflows' ? 'active' : ''}
              onClick={() => setPlanSection('workflows')}
            >
              Application workflows
            </button>
          </div>
          {planSection === 'use-cases' ? (
            <UseCasePlanView
              store={props.store}
              onContinueToDesign={() => {
                setPlanSection('workflows')
                setActiveTab('plan')
              }}
              initialUseCaseId={routedUseCaseId}
              onUseCaseSelected={setRoutedUseCaseId}
            />
          ) : (
            <ApplicationBehaviorView
              application={state.application}
              onOpenUseCases={() => setPlanSection('use-cases')}
            />
          )}
        </div>
      )}

      {activeTab === 'design' && (
        <div
          id="design-workspace-panel-design"
          role="tabpanel"
          aria-labelledby="design-workspace-tab-design"
          className={session?.currentStep === 'diagrams' ? 'design-workspace-design-panel diagram-focus' : 'design-workspace-design-panel'}
        >
          <SystemDesignGate store={props.store} onOpenPlan={() => setActiveTab('plan')} />
          <WorkflowAllocationView application={state.application} architecture={state.architecture} />
          <SystemCanvas
            architecture={state.architecture}
            progress={state.progress}
            selectedModuleId={state.selectedModuleId}
            onSelectModule={(moduleId) => props.store.selectFromCanvas(moduleId)}
            focusMode={state.focusMode}
            onFocusModeChange={(value) => props.store.setFocusMode(value)}
            listView={state.listView}
            onListViewChange={(value) => props.store.setListView(value)}
          />

          {narrow && (
            <button type="button" className="design-queue-drawer-toggle" aria-expanded={queueOpen} onClick={() => setQueueOpen((v) => !v)}>
              {queueOpen ? 'Hide module list' : 'Show module list'}
              {selectedEntry ? ` — current: ${selectedEntry.name}` : ''}
            </button>
          )}

          {session?.currentStep === 'diagrams' && selectedEntry && (
            <div className="design-diagram-review-header">
              <div>
                <p className="overline">Diagram review</p>
                <h3>{selectedEntry.name}</h3>
                <span>Review every applicable projection and relationship before running design checks.</span>
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => props.store.goToStep(selectedEntry.moduleId, 'checks')}>
                Exit diagram review
              </button>
            </div>
          )}

          <div className={session?.currentStep === 'diagrams' ? 'design-workspace-body diagram-focus' : 'design-workspace-body'}>
            {(!narrow || queueOpen) && (
              <ModuleQueue
                progress={state.progress}
                filter={state.queueFilter}
                onFilterChange={(filter) => props.store.setQueueFilter(filter)}
                selectedModuleId={state.selectedModuleId}
                onSelectModule={selectModule}
                compact={narrow}
              />
            )}

            <div className="design-workspace-main">
              {selectedEntry ? (
                <ModuleSessionView
                  entry={selectedEntry}
                  design={design}
                  approvedDesign={approvedDesign}
                  session={session}
                  checks={checks}
                  approvedContracts={state.approvedContracts}
                  primaryActionLabel={primaryActionLabel}
                  saveState={state.saveState}
                  mode={state.mode}
                  onPrimaryAction={() => props.store.primaryAction(selectedEntry.moduleId)}
                  onGoToStep={(step: ModuleDesignStep) => props.store.goToStep(selectedEntry.moduleId, step)}
                  onAnswerQuestion={(itemId, text) => props.store.answerRequiredQuestion(selectedEntry.moduleId, itemId, text)}
                  onRunChecks={() => props.store.runChecks(selectedEntry.moduleId)}
                  onApprove={() => props.store.approveModule(selectedEntry.moduleId)}
                  onCreateHandoff={() => props.store.createCopilotHandoff(selectedEntry.moduleId)}
                  store={props.store}
                  architecture={state.architecture}
                  allDesigns={state.moduleDesigns}
                  useCaseAnalysis={state.useCaseAnalysis}
                  diagramDiscussions={state.diagramDiscussions}
                  diagramImpacts={state.diagramImpacts}
                  initialDiagramSelectionId={routedDiagramElementId}
                  onDiagramSelectionChange={(selectionId) => setRoutedDiagramElementId(selectionId ?? '')}
                />
              ) : (
                <p className="secondary-text">Select a module from the list to begin.</p>
              )}
            </div>

            <DesignContextPanel store={props.store} selectedModuleId={state.selectedModuleId} />
          </div>
        </div>
      )}

      {activeTab === 'connect' && (
        <div id="design-workspace-panel-connect" role="tabpanel" aria-labelledby="design-workspace-tab-connect">
          <WorkflowConnectView store={props.store} />
        </div>
      )}

      {activeTab === 'build' && (
        <div id="design-workspace-panel-build" role="tabpanel" aria-labelledby="design-workspace-tab-build">
          <WavesView
            wavePlan={state.wavePlan}
            progress={state.progress}
            onCreateHandoff={(moduleId) => props.store.createModuleHandoff(moduleId)}
            onCreateMultiModuleHandoff={(moduleIds: string[], confirmations: MultiModuleConfirmations) => props.store.createMultiModuleHandoff(moduleIds, confirmations)}
            multiModuleHandoff={state.multiModuleHandoff}
            mode={state.mode}
            currentDesignComplete={designComplete}
          />
          <BuildHandoffView store={props.store} linkedRun={props.linkedRun} onContinueToBuild={props.onContinueToBuild} />
        </div>
      )}

      {activeTab === 'verify' && (
        <div id="design-workspace-panel-verify" role="tabpanel" aria-labelledby="design-workspace-tab-verify">
          <DesignVerifyView
            store={props.store}
            onSelectDesignLink={goToDesignRecord}
            onSelectEvidenceLink={(runId) => {
              setRoutedRunId(runId)
              openWorkspaceTab('evidence')
            }}
            initialScenarioId={routedScenarioId}
            onScenarioSelected={setRoutedScenarioId}
          />
        </div>
      )}

      {activeTab === 'evidence' && (
        <div id="design-workspace-panel-evidence" role="tabpanel" aria-labelledby="design-workspace-tab-evidence">
          <WorkflowEvidenceView
            store={props.store}
            initialRunId={routedRunId}
            onRunSelected={setRoutedRunId}
            initialArtifactRef={routedArtifactRef}
            onArtifactSelected={(ref) => setRoutedArtifactRef(ref ?? '')}
            onOpenTrace={(phase, moduleId) => {
              if (moduleId) props.store.selectModule(moduleId)
              openWorkspaceTab(phase)
            }}
          />
          {state.mode === 'sample' && (
            <details className="design-sample-defect-gallery">
              <summary>Sample defects</summary>
              <EvidenceExplorer store={props.store} onFollowTrace={goToDesignRecord} />
            </details>
          )}
        </div>
      )}

      {activeTab === 'setup' && state.mode === 'project' && (
        <div id="design-workspace-panel-setup" role="tabpanel" aria-labelledby="design-workspace-tab-setup">
          <ProjectSetupPanel store={props.store} />
        </div>
      )}
    </div>
  )
}

function DesignContextPanel(props: { store: DesignStore; selectedModuleId?: string }) {
  const [open, setOpen] = useState(true)
  const state = useDesignState(props.store)
  const entry = state.progress.modules.find((candidate) => candidate.moduleId === props.selectedModuleId)
  const checks = props.selectedModuleId ? props.store.evaluateChecks(props.selectedModuleId) : undefined
  const design = props.selectedModuleId ? props.store.getDesign(props.selectedModuleId) : undefined
  const nameOf = (moduleId: string) => state.progress.modules.find((candidate) => candidate.moduleId === moduleId)?.name ?? moduleId
  const useCaseName = (useCaseId: string) => {
    const name = state.useCaseAnalysis.useCases.find((candidate) => candidate.id === useCaseId)?.name ?? 'Approved use case'
    return name.length > 64 ? `${name.slice(0, 61)}…` : name
  }

  return (
    <aside className="design-context-panel">
      <button type="button" className="design-context-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        System context
      </button>
      {open && entry && design && (
        <div className="design-context-content">
          <h3>Dependencies</h3>
          {design.boundary.directDependencyIds.length === 0 ? (
            <p className="secondary-text">None</p>
          ) : (
            <ul>
              {design.boundary.directDependencyIds.map((id) => (
                <li key={id}>{nameOf(id)}</li>
              ))}
            </ul>
          )}
          <h3>Consumers</h3>
          {design.boundary.directConsumerIds.length === 0 ? (
            <p className="secondary-text">None</p>
          ) : (
            <ul>
              {design.boundary.directConsumerIds.map((id) => (
                <li key={id}>{nameOf(id)}</li>
              ))}
            </ul>
          )}
          <h3>Linked use cases</h3>
          {design.trace.useCaseIds.length === 0 ? (
            <p className="secondary-text">No use cases linked yet.</p>
          ) : (
            <ul>
              {design.trace.useCaseIds.map((id) => (
                <li key={id} title={`${useCaseName(id)} · ${id}`}>{useCaseName(id)}</li>
              ))}
            </ul>
          )}
          <h3>Checks</h3>
          {checks ? (
            <p>
              {checks.blockerCount} blocking, {checks.warningCount} warning{checks.warningCount === 1 ? '' : 's'}.
            </p>
          ) : (
            <p className="secondary-text">Not run yet.</p>
          )}
        </div>
      )}
      {open && !entry && <p className="secondary-text">Select a module to see its dependencies, consumers, traces, and checks.</p>}
    </aside>
  )
}
