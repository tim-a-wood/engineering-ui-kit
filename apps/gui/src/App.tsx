import { Component, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { HandoffRun, Project, Settings } from '@engineering-ui-kit/core'
import { getBridge, type BuildPacketResult } from './bridge'
import { NAV_ITEMS, isStepReachable, stepIndex, type RecipePrefill, type ViewId, WORKFLOW_STEPS } from './appState'
import { Dialog, TipCard } from './components'
import { Icon } from './icons'
import { HubView } from './views/HubView'
import { ProjectsView } from './views/ProjectsView'
import { RecipesView, ComponentsView } from './views/catalog'
import { SettingsView } from './views/SettingsView'
import {
  ApplyZipOverlayView,
  CreateTaskPacketView,
  PrepareContextView,
  RunInCopilotView,
  VerifyReviewView,
} from './views/workflow'

const TIPS: Partial<Record<ViewId, string>> = {
  'copilot-handoff': 'Start with one screen/view for best results.',
  'prepare-context': 'Start with one screen/view for best results.',
  'create-task-packet': 'Be specific about the goal, acceptance criteria, and constraints.',
  'run-in-copilot': 'You can upload a maximum of 3 files to Microsoft 365 Copilot.',
  'apply-zip-overlay': 'Review every entry before applying. Blocked overlays can never be applied.',
  'verify-review': 'Review results carefully. If changes are needed, apply feedback and iterate.',
  projects: 'Organize and manage your Engineering UI Kit projects.',
  recipes: 'You can upload a maximum of 3 files to Microsoft 365 Copilot.',
  components: 'You can upload a maximum of 3 files to Microsoft 365 Copilot.',
}

/** Sidebar structure: uppercase section labels grouping the flat NAV_ITEMS. */
const NAV_SECTIONS: { label: string; items: ViewId[] }[] = [
  { label: 'Workflow', items: ['copilot-handoff'] },
  { label: 'Library', items: ['recipes', 'components'] },
  { label: 'System', items: ['projects', 'settings'] },
]

const NAV_GLYPHS: Partial<Record<ViewId, () => ReactNode>> = {
  'copilot-handoff': () => Icon.home(),
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
  const [projects, setProjects] = useState<Project[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [activeRun, setActiveRun] = useState<HandoffRun | undefined>(undefined)
  const [packet, setPacket] = useState<BuildPacketResult | null>(null)
  const [recipe, setRecipe] = useState<RecipePrefill | null>(null)
  const [version, setVersion] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)

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
      if (activeRun && activeRun.projectId === projectId && activeRun.currentStep !== 'complete') {
        const stepView = WORKFLOW_STEPS.find((s, i) => i === Math.min(WORKFLOW_STEPS.length - 1, ['prepare-context', 'create-task-packet', 'run-in-copilot', 'apply-zip-overlay', 'verify-review', 'complete'].indexOf(activeRun.currentStep)))
        setView(stepView?.id ?? 'prepare-context')
        return
      }
      const run = await bridge.createRun(projectId)
      setActiveRun(run)
      setPacket(null)
      setView('prepare-context')
    },
    [bridge, activeRun],
  )

  const navigate = useCallback(
    (next: ViewId) => {
      const isWorkflow = WORKFLOW_STEPS.some((s) => s.id === next)
      if (isWorkflow) {
        if (!activeRun) {
          setView('copilot-handoff')
          return
        }
        if (!isStepReachable(activeRun, next)) return
      }
      setView(next)
    },
    [activeRun],
  )

  const activeProject = activeRun ? projects.find((p) => p.id === activeRun.projectId) : undefined
  const navActive: ViewId = WORKFLOW_STEPS.some((s) => s.id === view) ? 'copilot-handoff' : view

  const renderView = (): ReactNode => {
    if (!settings) return <p className="secondary-text">Loading workspace…</p>

    const stepProps = activeRun && activeProject
      ? { bridge, project: activeProject, run: activeRun, refreshRun, onNavigate: navigate }
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
            onOpenHelp={() => setHelpOpen(true)}
          />
        )
      case 'prepare-context':
        return stepProps ? <PrepareContextView {...stepProps} recipe={recipe} /> : <MissingRun onBack={() => setView('copilot-handoff')} />
      case 'create-task-packet':
        return stepProps ? (
          <CreateTaskPacketWrapper
            stepProps={stepProps}
            onPacket={setPacket}
            recipe={recipe}
            onRecipeConsumed={() => setRecipe(null)}
            preferredTemplate={settings.preferredTemplate}
          />
        ) : <MissingRun onBack={() => setView('copilot-handoff')} />
      case 'run-in-copilot':
        return stepProps ? <RunInCopilotView {...stepProps} packet={packet} /> : <MissingRun onBack={() => setView('copilot-handoff')} />
      case 'apply-zip-overlay':
        return stepProps ? <ApplyZipOverlayView {...stepProps} /> : <MissingRun onBack={() => setView('copilot-handoff')} />
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
                setView('create-task-packet')
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
  const currentStepShort = activeRun
    ? WORKFLOW_STEPS[Math.min(stepIndex(activeRun.currentStep), WORKFLOW_STEPS.length - 1)]?.short ?? 'Complete'
    : undefined
  const versionLabel = version.replace(/^v/, '').replace(/\s*\(mock\)\s*$/, '') || '0.1.0'
  const isMock = typeof window !== 'undefined' && window.euikMode === 'mock'

  return (
    <div className="app-frame">
      <div className="titlebar">
        <span className="brand-mark" aria-hidden="true">{Icon.logo()}</span>
        <span className="brand-name">Engineering UI Kit</span>
        <span className="version-pill">v{versionLabel}</span>
        {isRunOpen && activeProject && (
          <nav className="topbar-crumbs" aria-label="Active handoff run">
            <button type="button" className="crumb" onClick={() => navigate('copilot-handoff')}>
              {activeProject.name}
            </button>
            <span className="crumb-sep" aria-hidden="true">{Icon.chevronRight(12)}</span>
            <span className="crumb-current">{currentStepShort}</span>
          </nav>
        )}
        <span className="titlebar-spacer" />
        {isMock && (
          <span className="mode-chip" title="Running against the in-memory mock bridge">
            <span className="mode-dot" aria-hidden="true" />
            Mock data
          </span>
        )}
        <button type="button" className="icon-btn" aria-label="Help" data-tip="Workflow help" data-tip-pos="bottom" onClick={() => setHelpOpen(true)}>
          {Icon.help()}
        </button>
      </div>

      <div className="app-body">
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
                          onClick={() => navigate(item.id)}
                        >
                          <span className="nav-glyph" aria-hidden="true">{NAV_GLYPHS[item.id]?.()}</span>
                          <span>{item.label}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>
          <span className="sidebar-spacer" />
          <TipCard
            text={TIPS[view] ?? 'Keep handoffs small and reviewable.'}
            linkLabel="View workflow guide"
            onLink={() => setHelpOpen(true)}
          />
        </aside>

        <main className="main">
          <ViewErrorBoundary viewKey={view}>{renderView()}</ViewErrorBoundary>
        </main>
      </div>

      {helpOpen && (
        <Dialog title="Workflow help" onClose={() => setHelpOpen(false)} wide>
          <div className="stack">
            <p className="secondary-text">
              The Copilot handoff workflow prepares a strict three-file packet, hands it to Microsoft 365 Copilot,
              then inspects, applies, and verifies the returned <code>ui-overlay.zip</code>.
            </p>
            <ol style={{ margin: 0, paddingLeft: 20, color: 'var(--semantic-text-secondary)' }}>
              <li><strong>Prepare Context</strong> — build the repo inventory and flatfile with deterministic exclusions.</li>
              <li><strong>Create Task Packet</strong> — capture goal, scope, constraints, acceptance criteria, and references; the standards pack is attached automatically.</li>
              <li><strong>Run in Copilot</strong> — upload at most three files and paste the recommended prompt.</li>
              <li><strong>Apply Zip Overlay</strong> — inspection blocks unsafe archives; warnings need your explicit acceptance; nothing is ever deleted.</li>
              <li><strong>Verify &amp; Review</strong> — run typecheck/build, launch the app, then approve or iterate.</li>
            </ol>
            <p className="muted">
              Safety posture: dark-first standards, semantic tokens, three-file budget, previewable and manually
              confirmed filesystem actions.
            </p>
          </div>
        </Dialog>
      )}
    </div>
  )
}

function CreateTaskPacketWrapper(props: {
  stepProps: {
    bridge: ReturnType<typeof getBridge>
    project: Project
    run: HandoffRun
    refreshRun: () => Promise<void>
    onNavigate: (view: ViewId) => void
  }
  onPacket: (packet: BuildPacketResult | null) => void
  recipe: RecipePrefill | null
  onRecipeConsumed: () => void
  preferredTemplate: string
}) {
  // CreateTaskPacketView owns its own build result; mirror the latest packet up
  // so Run in Copilot can show upload files and the recommended prompt.
  const originalBuild = props.stepProps.bridge.buildPacket.bind(props.stepProps.bridge)
  const bridge = useMemo(() => ({
    ...props.stepProps.bridge,
    buildPacket: async (runId: string, fields: Parameters<typeof originalBuild>[1]) => {
      const result = await originalBuild(runId, fields)
      props.onPacket(result)
      return result
    },
  }), [props.stepProps.bridge]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <CreateTaskPacketView
      {...props.stepProps}
      bridge={bridge}
      recipe={props.recipe}
      onRecipeConsumed={props.onRecipeConsumed}
      preferredTemplate={props.preferredTemplate}
    />
  )
}

function MissingRun(props: { onBack: () => void }) {
  return (
    <div className="panel" role="alert">
      <h2>No active handoff run</h2>
      <p className="secondary-text">Start a handoff from the Copilot Handoff hub or the Projects view first.</p>
      <button type="button" className="btn btn-primary" onClick={props.onBack}>
        Go to Copilot Handoff
      </button>
    </div>
  )
}
