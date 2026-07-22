import { useEffect, useState } from 'react'
import type { HandoffRun, Project } from '@engineering-ui-kit/core'
import type { EuikBridge } from '../bridge'
import { visibleStepIndex, viewForRunStep, WORKFLOW_STEPS, type ViewId } from '../appState'
import { PageHeader } from '../components'
import { Icon } from '../icons'
import { NewProjectDialog } from './ProjectsView'

function lastUpdatedLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5)
  if (days <= 0) return 'Last updated today'
  if (days === 1) return 'Last updated 1 day ago'
  return `Last updated ${days} days ago`
}

export function HubView(props: {
  bridge: EuikBridge
  projects: Project[]
  activeRun: HandoffRun | undefined
  refreshProjects: () => Promise<void>
  onStartRun: (projectId: string) => void
  onOpenStep: (view: ViewId) => void
  onOpenCapabilities: (projectId?: string) => void
}) {
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [continueThumbnail, setContinueThumbnail] = useState<string | null>(null)
  const run = props.activeRun
  const currentIndex = run ? visibleStepIndex(run.currentStep) : -1
  const activeProject = run ? props.projects.find((p) => p.id === run.projectId) : undefined
  const recent = props.projects.filter((p) => p.status === 'active').slice(0, 3)

  const runOpen = Boolean(run && run.currentStep !== 'complete')
  const currentStep = currentIndex >= 0 ? WORKFLOW_STEPS[currentIndex] : undefined
  const continueView = run ? viewForRunStep(run.currentStep) : 'build'

  useEffect(() => {
    if (!run) {
      setContinueThumbnail(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const evidence = await props.bridge.getEvidence(run.id)
        if (!cancelled) {
          const preferred = evidence.views.find((view) => view.afterShot)?.afterShot
            ?? evidence.views.find((view) => view.beforeShot)?.beforeShot
            ?? null
          setContinueThumbnail(preferred)
        }
      } catch { if (!cancelled) setContinueThumbnail(null) }
      try {
        const thumbnail = await props.bridge.captureProjectThumbnail(run.projectId)
        if (!cancelled && thumbnail) setContinueThumbnail(thumbnail)
      } catch { /* keep evidence thumbnail or icon fallback */ }
    })()
    return () => { cancelled = true }
  }, [props.bridge, run?.id])

  return (
    <>
      <PageHeader
        title="Build & Test"
        subtitle="Plan capabilities, build a change, and verify the result in one project workspace."
        actions={
          <>
            {activeProject ? (
              <button type="button" className="btn btn-secondary" onClick={() => props.onOpenCapabilities(activeProject.id)}>
                {Icon.box(16)} Plan capabilities
              </button>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={() => setNewProjectOpen(true)}>
              {Icon.plus()} New Project
            </button>
          </>
        }
      />

      {runOpen && activeProject && currentStep && (
        <button type="button" className="hub-continue" aria-label={`Continue ${activeProject.name} in ${currentStep.short}`} onClick={() => props.onOpenStep(continueView)}>
          <div className="hub-continue-head">
            <div className="hub-continue-copy">
              <span className="hub-continue-kicker">Active handoff</span>
              <h2>Continue {activeProject.name}</h2>
              <p>Pick up where you left off in {currentStep.short}.</p>
            </div>
            <span className="hub-row-arrow" aria-hidden="true">{Icon.arrowRight(16)}</span>
          </div>
          <div className="hub-continue-body">
            <span className={continueThumbnail ? 'hub-continue-icon has-thumbnail' : 'hub-continue-icon'} aria-hidden="true">
              {continueThumbnail ? <img src={continueThumbnail} alt="" /> : Icon.play(24)}
            </span>
            <div className="hub-continue-details">
              <span className="hub-continue-status"><span /> Ready to continue</span>
              <h3>{currentStep.short === 'Test' ? 'Review the latest result' : 'Prepare the next change'}</h3>
              <p>{currentStep.short === 'Test'
                ? 'Inspect the running app, resolve any failed checks, and approve or iterate on the result.'
                : 'Define the work, prepare the Copilot handoff, and apply the returned changes safely.'}</p>
              <div className="hub-continue-journey" aria-label="Build and Test progress">
                <span className={currentStep.short === 'Build' ? 'current' : 'complete'}>{currentStep.short === 'Build' ? '1' : '✓'} <b>Build</b></span>
                <i aria-hidden="true" />
                <span className={currentStep.short === 'Test' ? 'current' : ''}>2 <b>Test</b></span>
              </div>
              <dl className="hub-continue-meta">
                <div><dt>Last activity</dt><dd>{lastUpdatedLabel(activeProject.updatedAt).replace('Last updated ', '')}</dd></div>
                <div><dt>Location</dt><dd title={activeProject.repoPath}>{activeProject.repoPath}</dd></div>
              </dl>
              <span className="hub-continue-action">Continue to {currentStep.short} {Icon.arrowRight(14)}</span>
            </div>
          </div>
        </button>
      )}

      <section className="hub-projects hub-projects-minimal" aria-labelledby="recent-projects-heading">
        <div className="panel-head">
          <div className="hstack">
            <h2 id="recent-projects-heading">Recent Projects</h2>
            <span className="toolbar-count num" style={{ color: 'var(--semantic-text-muted)', fontSize: 12 }}>
              {recent.length} active
            </span>
          </div>
          <button type="button" className="tip-link" onClick={() => props.onOpenStep('projects')}>
            View all →
          </button>
        </div>
        {recent.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon" aria-hidden="true">{Icon.folderBig(24)}</span>
            <p className="empty-title">No projects yet</p>
            <p className="empty-hint">Create a project to start your first handoff.</p>
            <button type="button" className="btn btn-secondary" onClick={() => setNewProjectOpen(true)}>
              {Icon.plus(14)} New Project
            </button>
          </div>
        ) : (
          <ul className="project-rows">
            {recent.map((project) => (
              <li key={project.id}>
                <div className="project-row-shell">
                  <button type="button" className="project-row" aria-label={`Build and test ${project.name}`} onClick={() => props.onStartRun(project.id)}>
                    <span className="project-row-icon" aria-hidden="true">{Icon.folder(18)}</span>
                    <div className="project-row-copy">
                      <strong>{project.name}</strong>
                      {project.isSample && <span className="sample-chip" title="Built-in sample project — explore freely">Sample</span>}
                      <p className="project-meta">
                        {project.description ? `${project.description} · ` : ''}
                        {lastUpdatedLabel(project.updatedAt)}
                      </p>
                    </div>
                    <span className="project-row-primary-label">Build &amp; Test</span>
                    <span className="hub-row-arrow" aria-hidden="true">{Icon.chevronRight(16)}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-compact project-row-capabilities"
                    aria-label={`Plan capabilities for ${project.name}`}
                    onClick={() => props.onOpenCapabilities(project.id)}
                  >
                    {Icon.box(14)} Plan capabilities
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {newProjectOpen && (
        <NewProjectDialog
          bridge={props.bridge}
          onClose={() => setNewProjectOpen(false)}
          onCreated={async (project) => {
            setNewProjectOpen(false)
            await props.refreshProjects()
            props.onStartRun(project.id)
          }}
        />
      )}
    </>
  )
}
