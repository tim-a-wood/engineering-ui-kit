import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { HandoffRun, Project, Settings } from '@engineering-ui-kit/core'
import type { ModuleImplementationPacket } from '@engineering-ui-kit/core/design-browser'
import { getBridge, type BuildPacketResult, type TaskPacketFields } from './bridge'
import {
  NAV_ITEMS,
  isStepReachable,
  isWorkflowView,
  resolveWorkflowNavigation,
  stepIndex,
  viewForRunStep,
  type BuildWorkspaceState,
  type RecipePrefill,
  type ViewId,
} from './appState'
import { TipCard } from './components'
import { GuideOverlay, type GuideTopicId } from './guides'
import { Icon } from './icons'
import { HubView } from './views/HubView'
import { ProjectsView } from './views/ProjectsView'
import { ProjectOverviewView } from './views/ProjectOverviewView'
import { RecipesView, ComponentsView } from './views/catalog'
import { SettingsView } from './views/SettingsView'
import { BuildView } from './views/build/BuildView'
import { VerifyReviewView } from './views/workflow'
import { DesignStore, getDesignStore } from './views/design/designState'
import { detectDesignBridgeCaller } from './views/design/designBridgeClient'

const DesignWorkspaceView = lazy(async () => {
  const module = await import('./views/design/DesignWorkspaceView')
  return { default: module.DesignWorkspaceView }
})

const TIPS: Partial<Record<ViewId, string>> = {
  'copilot-handoff': 'Start with one screen/view for best results.',
  build: 'Prepare the handoff, run it in Copilot, inspect the overlay, then apply it safely.',
  'prepare-context': 'Start with one screen/view for best results.',
  'create-task-packet': 'Be specific about the goal, acceptance criteria, and constraints.',
  'run-in-copilot': 'You can upload a maximum of 3 files to Microsoft 365 Copilot.',
  'apply-zip-overlay': 'Review every entry before applying. Blocked overlays can never be applied.',
  'verify-review': 'Review results carefully. If changes are needed, apply feedback and iterate from Build.',
  capabilities: 'Start with approved use cases. The same records drive system design, modules, connections, and scenario evidence.',
  design: 'Start with approved use cases. The same records drive system design, modules, connections, and scenario evidence.',
  projects: 'Organize and manage your Engineering UI Kit projects.',
  recipes: 'You can upload a maximum of 3 files to Microsoft 365 Copilot.',
  components: 'You can upload a maximum of 3 files to Microsoft 365 Copilot.',
}

/** Sidebar structure: uppercase section labels grouping the flat NAV_ITEMS. */
const NAV_SECTIONS: { label: string; items: ViewId[] }[] = [
  { label: 'Workflow', items: ['copilot-handoff', 'capabilities'] },
  { label: 'Library', items: ['recipes', 'components'] },
  { label: 'System', items: ['projects', 'settings'] },
]

const NAV_GLYPHS: Partial<Record<ViewId, () => ReactNode>> = {
  'copilot-handoff': () => Icon.home(),
  capabilities: () => Icon.box(),
  recipes: () => Icon.grid(),
  components: () => Icon.box(),
  projects: () => Icon.folder(),
  settings: () => Icon.gear(),
}

function initialApplicationView(): ViewId {
  if (typeof window === 'undefined') return 'copilot-handoff'
  const location = `${window.location.pathname}${window.location.search}${window.location.hash}`
  return /(?:^|[/#?&=])capabilities(?:$|[/#?&=])/i.test(location) ? 'capabilities' : 'copilot-handoff'
}

class ViewErrorBoundary extends Component<{ viewKey: string; children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  override componentDidUpdate(prev: { viewKey: string }) {
    if (prev.viewKey !== this.props.viewKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="panel" role="alert">
          <h2>View error</h2>
          <p className="secondary-text">{this.state.error.message}</p>
          <button type="button" className="btn btn-secondary" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const bridge = useMemo(() => getBridge(), [])
  // §17, §22.1 — the Design workspace's 'project' mode is available only
  // when the desktop bridge exposes `designOperation` (see
  // `designBridgeClient.ts`); this is stable for the app's lifetime.
  const designBridgeCaller = useMemo(() => detectDesignBridgeCaller(), [])
  const [view, setView] = useState<ViewId>(initialApplicationView)
  // LAY-SHELL-001: the nav rail collapses to a 64px icon rail, persisted.
  const [navCollapsed, setNavCollapsed] = useState(() => {
    try { return localStorage.getItem('euik-nav-collapsed') === '1' } catch { return false }
  })
  const toggleNav = useCallback(() => {
    setNavCollapsed((collapsed) => {
      try { localStorage.setItem('euik-nav-collapsed', collapsed ? '0' : '1') } catch { /* private mode */ }
      return !collapsed
    })
  }, [])
  const [projects, setProjects] = useState<Project[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [activeRun, setActiveRun] = useState<HandoffRun | undefined>(undefined)
  const [packet, setPacket] = useState<BuildPacketResult | null>(null)
  const [recipe, setRecipe] = useState<RecipePrefill | null>(null)
  const [buildWorkspace, setBuildWorkspace] = useState<BuildWorkspaceState>('handoff')
  const [capabilitiesProjectId, setCapabilitiesProjectId] = useState(() => {
    try { return localStorage.getItem('euik-active-project') ?? '' } catch { return '' }
  })
  const [projectOverviewId, setProjectOverviewId] = useState('')
  const [version, setVersion] = useState('')
  const [guideTopic, setGuideTopic] = useState<GuideTopicId | null>(null)
  const selectCapabilitiesProject = useCallback((projectId: string) => {
    setCapabilitiesProjectId(projectId)
    try {
      if (projectId) localStorage.setItem('euik-active-project', projectId)
      else localStorage.removeItem('euik-active-project')
    } catch { /* private mode */ }
  }, [])

  const refreshProjects = useCallback(async () => {
    setProjects(await bridge.listProjects())
  }, [bridge])

  const refreshRun = useCallback(async () => {
    if (!activeRun) return
    setActiveRun(await bridge.getRun(activeRun.id))
  }, [bridge, activeRun])

  useEffect(() => {
    void (async () => {
      setVersion(await bridge.appVersion())
      setSettings(await bridge.getSettings())
      await refreshProjects()
      const runs = await bridge.listRuns()
      const open = runs.find((r) => r.currentStep !== 'complete')
      if (open) setActiveRun(open)
    })()
  }, [bridge, refreshProjects])

  const startRun = useCallback(
    async (projectId: string) => {
      // Opening a project resumes its open run at the step the user was at —
      // a fresh run is created only when none is open. Furthest progress
      // first, then most recently touched, so an accidentally created empty
      // run can never hijack resume from the run with real work in it.
      const open = (await bridge.listRuns(projectId))
        .filter((r) => r.currentStep !== 'complete')
        .sort((a, b) =>
          (stepIndex(b.currentStep) - stepIndex(a.currentStep))
          || b.updatedAt.localeCompare(a.updatedAt))[0]
      if (open) {
        if (open.id !== activeRun?.id) setPacket(null)
        setActiveRun(open)
        const resume = resolveWorkflowNavigation(viewForRunStep(open.currentStep))
        setView(resume.view)
        if (resume.workspace) setBuildWorkspace(resume.workspace)
        return
      }
      const run = await bridge.createRun(projectId)
      setActiveRun(run)
      setPacket(null)
      setBuildWorkspace('handoff')
      setView('build')
    },
    [bridge, activeRun],
  )

  const navigate = useCallback(
    (next: ViewId) => {
      if (next === 'capabilities') {
        if (activeRun?.projectId) selectCapabilitiesProject(activeRun.projectId)
        setView('capabilities')
        return
      }
      if (isWorkflowView(next)) {
        if (!activeRun) {
          setView('copilot-handoff')
          return
        }
        if (!isStepReachable(activeRun, next)) return
        const resolved = resolveWorkflowNavigation(next)
        setView(resolved.view)
        if (resolved.workspace) setBuildWorkspace(resolved.workspace)
        return
      }
      setView(next)
    },
    [activeRun, selectCapabilitiesProject],
  )

  const openCapabilities = useCallback((projectId?: string) => {
    const contextualProjectId = projectId ?? projectOverviewId ?? activeRun?.projectId ?? capabilitiesProjectId
    if (contextualProjectId) selectCapabilitiesProject(contextualProjectId)
    setView('capabilities')
  }, [activeRun?.projectId, capabilitiesProjectId, projectOverviewId, selectCapabilitiesProject])

  const startNewRun = useCallback(async (projectId: string) => {
    const run = await bridge.createRun(projectId)
    setActiveRun(run)
    setPacket(null)
    setRecipe(null)
    setBuildWorkspace('handoff')
    setView('build')
  }, [bridge])

  const continueCapabilitiesPacket = useCallback(async (input: {
    packet: ModuleImplementationPacket
    moduleName: string
  }) => {
    const project = projects.find((candidate) => candidate.id === input.packet.projectId)
    if (!project) throw new Error('The packet project is not available in Build & Test.')

    const acceptanceCriteria = input.packet.acceptanceCases.length > 0
      ? input.packet.acceptanceCases.map((item) => `${item.description}: ${item.expectedOutcome}`).join('\n')
      : 'Run every configured module check and attach the resulting evidence.'
    const fields: TaskPacketFields = {
      taskTitle: `Implement ${input.moduleName}`,
      goal: `Implement the approved ${input.moduleName} module without changing its approved behavior, boundaries, or contracts.`,
      scope: [
        ...input.packet.implementationSteps,
        `Allowed paths: ${input.packet.allowedPaths.join(', ') || 'none listed'}`,
        ...(input.packet.editableSharedPaths.length ? [`Editable shared paths: ${input.packet.editableSharedPaths.join(', ')}`] : []),
      ].join('\n'),
      constraints: [
        `Do not change forbidden paths: ${input.packet.forbiddenPaths.join(', ') || 'none listed'}.`,
        `Preserve module design revision ${input.packet.moduleDesignRevision} and architecture revision ${input.packet.architectureRevision}.`,
        'Return implementation files through the inspected overlay flow; do not approve or apply your own changes.',
      ].join('\n'),
      acceptanceCriteria,
      references: [
        `Capabilities packet: ${input.packet.packetId}`,
        `Packet content hash: ${input.packet.contentHash}`,
        `Module design: ${input.packet.moduleId}@${input.packet.moduleDesignRevision}`,
        `Context manifest: ${input.packet.contextManifest.id}`,
        ...(input.packet.traceability?.useCaseIds.map((id) => `Approved use case: ${id}`) ?? []),
        ...(input.packet.traceability?.workflowNodeIds.map((id) => `Approved workflow action: ${id}`) ?? []),
        ...(input.packet.traceability?.experienceElementIds.map((id) => `Approved experience element: ${id}`) ?? []),
        ...input.packet.providedContracts.map((contract) => `Provides: ${contract.operationId}@${contract.version}`),
        ...input.packet.requiredContracts.map((contract) => `Requires: ${contract.operationId}@${contract.version}`),
      ].join('\n'),
    }

    let run = activeRun?.designHandoff?.packetId === input.packet.packetId
      ? activeRun
      : undefined
    if (!run || run.currentStep === 'complete') run = await bridge.createRun(project.id)
    run = await bridge.updateRun(run.id, {
      taskId: input.packet.packetId,
      taskTitle: fields.taskTitle,
      taskPacketFields: fields,
      designHandoff: {
        schemaVersion: '1.0',
        packetId: input.packet.packetId,
        packetContentHash: input.packet.contentHash,
        moduleId: input.packet.moduleId,
        moduleName: input.moduleName,
        moduleDesignRevision: input.packet.moduleDesignRevision,
        architectureRevision: input.packet.architectureRevision,
        linkedAt: new Date().toISOString(),
      },
    })
    selectCapabilitiesProject(project.id)
    setActiveRun(run)
    setPacket(null)
    setRecipe(null)
    setBuildWorkspace('handoff')
    setView('build')
  }, [activeRun, bridge, projects, selectCapabilitiesProject])

  const openProjectOverview = useCallback((projectId: string) => {
    selectCapabilitiesProject(projectId)
    setProjectOverviewId(projectId)
    setView('project-overview')
  }, [selectCapabilitiesProject])

  const activeProject = activeRun ? projects.find((p) => p.id === activeRun.projectId) : undefined
  const workflowProjectId = capabilitiesProjectId || activeProject?.id || ''
  const workflowProject = projects.find((project) => project.id === workflowProjectId)

  useEffect(() => {
    if (projects.length > 0 && capabilitiesProjectId && !projects.some((project) => project.id === capabilitiesProjectId)) {
      selectCapabilitiesProject('')
    }
  }, [capabilitiesProjectId, projects, selectCapabilitiesProject])

  /**
   * §22.1 "sample ONLY when no project is configured" — 'project' mode
   * requires BOTH the desktop bridge and a configured/selected project.
   * Project selection belongs to the Capabilities workflow itself; it is not
   * coupled to an unrelated open Build & Test run.
   * Rebuilt only when the bridge or the selected project id actually
   * changes, so switching projects gets a fresh store instead of stale
   * cross-project state.
   */
  const designStore = useMemo(() => {
    if (designBridgeCaller && workflowProject) {
      return new DesignStore({ bridge: { projectId: workflowProject.id, call: designBridgeCaller } })
    }
    return getDesignStore()
  }, [designBridgeCaller, workflowProject?.id])

  const navActive: ViewId = isWorkflowView(view)
    ? 'copilot-handoff'
    : view === 'project-overview'
      ? 'projects'
      : view === 'design'
        ? 'capabilities'
        : view

  const renderView = (): ReactNode => {
    if (!settings) return <p className="secondary-text">Loading workspace…</p>

    const stepProps = activeRun && activeProject
      ? { bridge, project: activeProject, run: activeRun, refreshRun, refreshProjects, onNavigate: navigate, onOpenGuide: setGuideTopic }
      : null

    switch (view) {
      case 'copilot-handoff':
        return (
          <HubView
            bridge={bridge}
            projects={projects}
            activeRun={activeRun}
            refreshProjects={refreshProjects}
            onStartRun={startRun}
            onOpenStep={navigate}
            onOpenCapabilities={openCapabilities}
            onOpenProject={openProjectOverview}
          />
        )
      case 'capabilities':
      case 'design':
        return (
          <Suspense fallback={<p className="secondary-text" role="status">Loading capabilities workflow…</p>}>
            <DesignWorkspaceView
              store={designStore}
              projects={projects}
              activeProjectId={workflowProjectId}
              onProjectSelected={selectCapabilitiesProject}
              projectModeAvailable={Boolean(designBridgeCaller)}
              onNavigateToProjects={() => setView('projects')}
              linkedRun={activeRun?.projectId === workflowProjectId ? activeRun : undefined}
              onContinueToBuild={workflowProject ? continueCapabilitiesPacket : undefined}
              initialTab="plan"
            />
          </Suspense>
        )
      case 'build':
      case 'prepare-context':
      case 'create-task-packet':
      case 'run-in-copilot':
      case 'apply-zip-overlay':
        return stepProps ? (
          <BuildView
            {...stepProps}
            recipe={recipe}
            onRecipeConsumed={() => setRecipe(null)}
            preferredTemplate={settings.preferredTemplate}
            packet={packet}
            onPacket={setPacket}
            initialWorkspace={buildWorkspace}
          />
        ) : <MissingRun onBack={() => setView('copilot-handoff')} />
      case 'verify-review':
        return stepProps ? <VerifyReviewView {...stepProps} /> : <MissingRun onBack={() => setView('copilot-handoff')} />
      case 'projects':
        return (
          <ProjectsView
            bridge={bridge}
            projects={projects}
            refreshProjects={refreshProjects}
            onStartRun={startRun}
            onOpenProject={openProjectOverview}
          />
        )
      case 'project-overview': {
        const project = projects.find((candidate) => candidate.id === projectOverviewId)
        return project ? (
          <ProjectOverviewView
            bridge={bridge}
            project={project}
            onBack={() => setView('projects')}
            onResumeTask={startRun}
            onStartChange={startNewRun}
            onOpenCapabilities={openCapabilities}
          />
        ) : (
          <div className="panel" role="alert">
            <h2>Project not found</h2>
            <button type="button" className="btn btn-primary" onClick={() => setView('projects')}>
              Open projects
            </button>
          </div>
        )
      }
      case 'recipes':
        return (
          <RecipesView
            hasActiveRun={Boolean(activeRun && activeRun.currentStep !== 'complete')}
            onUseRecipe={(selected) => {
              setRecipe(selected)
              if (activeRun && activeRun.currentStep !== 'complete' && isStepReachable(activeRun, 'create-task-packet')) {
                navigate('create-task-packet')
              }
            }}
          />
        )
      case 'components':
        return <ComponentsView />
      case 'settings':
        return <SettingsView bridge={bridge} settings={settings} onSaved={setSettings} onBack={() => setView('copilot-handoff')} />
    }
  }

  const isRunOpen = Boolean(activeRun && activeRun.currentStep !== 'complete')
  const versionLabel = version.replace(/^v/, '').replace(/\s*\(mock\)\s*$/, '') || '0.1.0'
  const isMock = typeof window !== 'undefined' && window.euikMode === 'mock'

  return (
    <div className="app-frame">
      <div className="titlebar">
        <span className="brand-mark" aria-hidden="true">{Icon.logo()}</span>
        <span className="brand-name">Engineering UI Kit</span>
        <span className="version-pill">v{versionLabel}</span>
        {isRunOpen && activeProject && isWorkflowView(view) && (
          <nav className="topbar-crumbs" aria-label="Active handoff run">
            <button type="button" className="crumb" onClick={() => navigate('copilot-handoff')}>
              Build application
            </button>
            <span className="crumb-sep" aria-hidden="true">{Icon.chevronRight(12)}</span>
            <span className="crumb-current">{activeProject.name}</span>
          </nav>
        )}
        {workflowProject && (view === 'capabilities' || view === 'design') && (
          <nav className="topbar-crumbs" aria-label="Active capabilities project">
            <button type="button" className="crumb" onClick={() => openProjectOverview(workflowProject.id)}>
              Capabilities
            </button>
            <span className="crumb-sep" aria-hidden="true">{Icon.chevronRight(12)}</span>
            <span className="crumb-current">{workflowProject.name}</span>
          </nav>
        )}
        <span className="titlebar-spacer" />
        {isMock && (
          <span className="mode-chip" title="Use mock bridge">
            <span className="mode-dot" aria-hidden="true" />
            Mock data
          </span>
        )}
        <button type="button" className="icon-btn" aria-label="Help" data-tip="How-to guides" data-tip-pos="bottom" onClick={() => setGuideTopic(view === 'capabilities' ? 'capabilities-overview' : 'workflow-overview')}>
          {Icon.help()}
        </button>
      </div>

      <div className={navCollapsed ? 'app-body nav-collapsed' : 'app-body'}>
        <aside className="sidebar">
          <nav aria-label="Primary navigation" className="nav-sections">
            {NAV_SECTIONS.map((section) => (
              <div key={section.label}>
                <span className="nav-section-label">{section.label}</span>
                <ul className="nav-list">
                  {section.items.map((id) => {
                    const item = NAV_ITEMS.find((n) => n.id === id)
                    if (!item) return null
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={item.id === navActive ? 'nav-item active' : 'nav-item'}
                          aria-current={item.id === navActive ? 'page' : undefined}
                          aria-label={item.label}
                          title={navCollapsed ? item.label : undefined}
                          onClick={() => navigate(item.id)}
                        >
                          <span className="nav-glyph" aria-hidden="true">{NAV_GLYPHS[item.id]?.()}</span>
                          <span className="nav-label">{item.label}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>
          <span className="sidebar-spacer" />
          <button
            type="button"
            className="nav-item nav-collapse"
            aria-expanded={!navCollapsed}
            title={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            onClick={toggleNav}
          >
            <span className="nav-glyph" aria-hidden="true">
              {navCollapsed ? Icon.chevronRight(16) : Icon.chevronLeft(16)}
            </span>
            <span className="nav-label">Collapse</span>
          </button>
          <TipCard
            text={
              view === 'capabilities' || view === 'design'
                ? 'One canonical path connects Plan, Design, Build, Connect, Verify, and immutable Evidence. Use-case revisions remain traceable in every later phase.'
                : TIPS[view] ?? 'Keep handoffs small and reviewable.'
            }
            linkLabel={view === 'capabilities' || view === 'design' ? 'View Capabilities guide' : 'View workflow guide'}
            onLink={() => setGuideTopic(view === 'capabilities' || view === 'design' ? 'capabilities-overview' : 'workflow-overview')}
          />
        </aside>

        <main className="main">
          <ViewErrorBoundary viewKey={view}>{renderView()}</ViewErrorBoundary>
        </main>
      </div>

      {guideTopic && (
        <GuideOverlay topic={guideTopic} onSelectTopic={setGuideTopic} onClose={() => setGuideTopic(null)} />
      )}
    </div>
  )
}

function MissingRun(props: { onBack: () => void }) {
  return (
    <div className="panel" role="alert">
      <h2>No active run</h2>
      <p className="secondary-text">Start from Workflow or Projects.</p>
      <button type="button" className="btn btn-primary" onClick={props.onBack}>
        Open build workspace
      </button>
    </div>
  )
}
