/**
 * §8, §9, §18 Design workspace — the use-case-led Design view. Contains the
 * system canvas (§8.2) and the module-design workspace (§9): a module queue,
 * the current module's session, and system context (§18.2).
 */

import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { ModuleDesignStep } from '@engineering-ui-kit/core/design-browser'
import type { Project } from '@engineering-ui-kit/core'
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

const NARROW_BREAKPOINT = 900

type WorkspaceTab = 'plan' | 'design' | 'build' | 'connect' | 'verify' | 'evidence' | 'setup'

const TABS: { id: WorkspaceTab; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'design', label: 'Design' },
  { id: 'build', label: 'Build' },
  { id: 'connect', label: 'Connect' },
  { id: 'verify', label: 'Verify' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'setup', label: 'Setup' },
]

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
  onNavigateToProjects?: () => void
  /** The app opens at Plan; component-level design tests retain Design as their default. */
  initialTab?: WorkspaceTab
}

export function DesignWorkspaceView(props: DesignWorkspaceViewProps) {
  const state = useDesignState(props.store)
  const narrow = useIsNarrow()
  const [queueOpen, setQueueOpen] = useState(!narrow)
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(props.initialTab ?? 'design')

  const selectedEntry = useMemo(
    () => state.progress.modules.find((entry) => entry.moduleId === state.selectedModuleId),
    [state.progress, state.selectedModuleId],
  )
  const design = state.selectedModuleId ? props.store.getDesign(state.selectedModuleId) : undefined
  const approvedDesign = state.selectedModuleId ? state.approvedModuleDesigns[state.selectedModuleId] : undefined
  const session = state.selectedModuleId ? props.store.getSession(state.selectedModuleId) : undefined
  const checks = state.selectedModuleId ? props.store.evaluateChecks(state.selectedModuleId) : undefined
  const primaryActionLabel = state.selectedModuleId ? props.store.primaryActionLabel(state.selectedModuleId) : 'Create module draft'

  function selectModule(moduleId: string) {
    props.store.selectModule(moduleId)
    if (narrow) setQueueOpen(false)
  }

  function goToDesignRecord(moduleId: string) {
    props.store.selectModule(moduleId)
    setActiveTab('design')
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
    <div className={narrow ? 'design-workspace narrow' : 'design-workspace'} data-mode={state.mode}>
      {state.mode === 'sample' ? (
        <>
          <p className="design-sample-statement" role="note">
            {state.syntheticDataStatement}
          </p>
          {/* §22.1 — sample mode ONLY when no project is configured; this banner must always be visible alongside the synthetic-data statement above, never merged into it, so a test (or a user) can tell the two apart. */}
          <p className="design-sample-mode-banner" role="note">
            Sample workspace — changes stay in this browser and do not affect any project
          </p>
        </>
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
              <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('setup')}>
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
          <h1>Capabilities workflow</h1>
        </div>
        {props.projects && props.onProjectSelected && (
          <div className="design-project-picker">
            <label>
              Project
              <select aria-label="Capabilities workflow project" value={props.activeProjectId ?? ''} onChange={(event) => props.onProjectSelected?.(event.target.value)}>
                <option value="">DO-178C sample</option>
                {props.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label>
            {props.onNavigateToProjects && <button type="button" className="btn btn-ghost btn-compact" onClick={props.onNavigateToProjects}>Manage projects</button>}
          </div>
        )}
        <p className="design-system-status">
          Use cases {state.useCaseAnalysis.status === 'approved' ? 'approved' : 'not yet approved'} · system structure {state.systemStatus.approved ? 'approved' : 'not yet approved'} · {approvalCountText(state.progress)},{' '}
          {state.progress.total - state.progress.approved} remain.
          {blockingModuleNamesForStatus.length > 0 && <> Blocking: {blockingModuleNamesForStatus.join(', ')}.</>}
        </p>
        <SaveIndicator saveState={state.saveState} savedAt={state.savedAt} />
      </header>

      <div role="tablist" aria-label="Design workspace sections" className="design-workspace-tabs" onKeyDown={onTabKeyDown}>
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
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'plan' && (
        <div id="design-workspace-panel-plan" role="tabpanel" aria-labelledby="design-workspace-tab-plan">
          <UseCasePlanView store={props.store} onContinueToDesign={() => setActiveTab('design')} />
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
          />
          <BuildHandoffView store={props.store} />
        </div>
      )}

      {activeTab === 'verify' && (
        <div id="design-workspace-panel-verify" role="tabpanel" aria-labelledby="design-workspace-tab-verify">
          <DesignVerifyView store={props.store} onSelectDesignLink={goToDesignRecord} />
        </div>
      )}

      {activeTab === 'evidence' && (
        <div id="design-workspace-panel-evidence" role="tabpanel" aria-labelledby="design-workspace-tab-evidence">
          <WorkflowEvidenceView store={props.store} />
          {state.mode === 'sample' && (
            <details className="design-sample-defect-gallery">
              <summary>Open the sample defect gallery</summary>
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
          <h3>Traces</h3>
          {design.trace.useCaseIds.length === 0 ? (
            <p className="secondary-text">No use cases linked yet.</p>
          ) : (
            <ul>
              {design.trace.useCaseIds.map((id) => (
                <li key={id}>{id}</li>
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
