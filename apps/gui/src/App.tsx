import { Component, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { HandoffRun, Project, Settings } from '@engineering-ui-kit/core'
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
import { RecipesView, ComponentsView } from './views/catalog'
import { SettingsView } from './views/SettingsView'
import { BuildView } from './views/build/BuildView'
import { VerifyReviewView } from './views/workflow'
import { CapabilitiesView } from './views/capabilities/CapabilitiesView'

const TIPS: Partial<Record<ViewId, string>> = {
  'copilot-handoff': 'Start with one screen/view for best results.',
  build: 'Prepare the handoff, run it in Copilot, inspect the overlay, then apply it safely.',
  'prepare-context': 'Start with one screen/view for best results.',
  'create-task-packet': 'Be specific about the goal, acceptance criteria, and constraints.',
  'run-in-copilot': 'You can upload a maximum of 3 files to Microsoft 365 Copilot.',
  'apply-zip-overlay': 'Review every entry before applying. Blocked overlays can never be applied.',
  'verify-review': 'Review results carefully. If changes are needed, apply feedback and iterate from Build.',
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
          <h2>Something went wrong in this view</h2>
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
  const [view, setView] = useState<ViewId>('copilot-handoff')
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
  const [version, setVersion] = useState('')
  const [guideTopic, setGuideTopic] = useState<GuideTopicId | null>(null)

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
    [activeRun],
  )

  const startUiModuleBuild = useCallback(async (projectId: string, fields: TaskPacketFields) => {
    const run = await bridge.createRun(projectId)
    await bridge.updateRun(run.id, { taskTitle: fields.taskTitle, taskPacketFields: fields })
    await bridge.prepareContext(run.id)
    const generated = await bridge.buildPacket(run.id, fields)
    setActiveRun((await bridge.getRun(run.id)) ?? run)
    setPacket(generated)
    setRecipe(null)
    setBuildWorkspace('handoff')
    setView('build')
  }, [bridge])

  const activeProject = activeRun ? projects.find((p) => p.id === activeRun.projectId) : undefined
  const navActive: ViewId = isWorkflowView(view) ? 'copilot-handoff' : view

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
          />
        )
      case 'capabilities':
        return (
          <CapabilitiesView
            bridge={bridge}
            projects={projects}
            activeProjectId={activeProject?.id}
            onOpenGuide={setGuideTopic}
            onNavigateToProjects={() => setView('projects')}
            onProjectsChanged={refreshProjects}
            onStartUiBuild={startUiModuleBuild}
          />
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
        return <ProjectsView bridge={bridge} projects={projects} refreshProjects={refreshProjects} onStartRun={startRun} />
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
              Build &amp; Test
            </button>
            <span className="crumb-sep" aria-hidden="true">{Icon.chevronRight(12)}</span>
            <span className="crumb-current">{activeProject.name}</span>
          </nav>
        )}
        <span className="titlebar-spacer" />
        {isMock && (
          <span className="mode-chip" title="Running against the in-memory mock bridge">
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
              view === 'capabilities'
                ? 'Guided follows five steps: Plan, Design, Build, Connect, and Verify. Switch views for the technical detail.'
                : TIPS[view] ?? 'Keep handoffs small and reviewable.'
            }
            linkLabel={view === 'capabilities' ? 'View Capabilities guide' : 'View workflow guide'}
            onLink={() => setGuideTopic(view === 'capabilities' ? 'capabilities-overview' : 'workflow-overview')}
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
      <h2>No active handoff run</h2>
      <p className="secondary-text">Start from Build &amp; Test or Projects first.</p>
      <button type="button" className="btn btn-primary" onClick={props.onBack}>
        Go to Build &amp; Test
      </button>
    </div>
  )
}
