import { useState, type ReactElement } from 'react'
import type { HandoffRun, Project } from '@engineering-ui-kit/core'
import type { EuikBridge } from '../bridge'
import { stepIndex, WORKFLOW_STEPS, type ViewId } from '../appState'
import { PageHeader } from '../components'
import { Icon } from '../icons'
import { NewProjectDialog } from './ProjectsView'

function lastUpdatedLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5)
  if (days <= 0) return 'Last updated today'
  if (days === 1) return 'Last updated 1 day ago'
  return `Last updated ${days} days ago`
}

const STEP_CARDS: { icon: ReactElement; title: string; body: string }[] = [
  { icon: Icon.folderBig(20), title: 'Prepare Context', body: 'Export your repo and standards for Copilot.' },
  { icon: Icon.filePlus(20), title: 'Create Task Packet', body: 'Build the instruction packet with goal, constraints, and acceptance criteria.' },
  { icon: Icon.cloudUp(20), title: 'Run in Copilot', body: 'Upload the packet to Microsoft 365 Copilot and request a zip overlay.' },
  { icon: Icon.downloadTray(20), title: 'Apply Zip Overlay', body: "Extract Copilot's zip output on top of your existing repo." },
  { icon: Icon.shieldCheck(20), title: 'Verify & Review', body: 'Run tests, then perform scoped Copilot review against the spec.' },
]

export function HubView(props: {
  bridge: EuikBridge
  projects: Project[]
  activeRun: HandoffRun | undefined
  refreshProjects: () => Promise<void>
  onStartRun: (projectId: string) => void
  onOpenStep: (view: ViewId) => void
  onOpenHelp: () => void
}) {
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const run = props.activeRun
  const currentIndex = run ? Math.min(stepIndex(run.currentStep), 4) : -1
  const activeProject = run ? props.projects.find((p) => p.id === run.projectId) : undefined
  const recent = props.projects.filter((p) => p.status === 'active').slice(0, 3)

  return (
    <>
      <PageHeader
        title="Copilot Handoff Hub"
        subtitle="End-to-end workflow to standardize or build engineering web apps with Microsoft 365 Copilot."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setNewProjectOpen(true)}>
            {Icon.plus()} New Project
          </button>
        }
      />

      <section aria-label="Workflow steps" className="hub-steps">
        {STEP_CARDS.map((card, index) => {
          const state = currentIndex === -1 ? 'upcoming' : index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'upcoming'
          const stateLabel = state === 'complete' ? 'Completed' : state === 'current' ? 'In progress' : 'Not started'
          const stepView = WORKFLOW_STEPS[index]!.id
          const reachable = run ? index <= currentIndex : false
          const inner = (
            <>
              <span className="hub-card-head">
                <span className="hub-step-marker" aria-hidden="true">{state === 'complete' ? '✓' : index + 1}</span>
                <span className="hub-card-title">{card.title}</span>
                <span className="hub-card-icon" aria-hidden="true">{card.icon}</span>
              </span>
              <p>{card.body}</p>
              <span className="hub-card-foot">
                {state === 'complete' && <span className="badge badge-success">✓ {stateLabel}</span>}
                {state === 'current' && (
                  <span className="badge badge-info">
                    <span className="badge-dot" aria-hidden="true" /> {stateLabel}
                  </span>
                )}
                {state === 'upcoming' && <span className="badge badge-neutral">{stateLabel}</span>}
              </span>
            </>
          )
          return reachable ? (
            <button
              key={card.title}
              type="button"
              className={`hub-card ${state}`}
              aria-label={`Step ${index + 1}: ${card.title}, ${stateLabel}`}
              onClick={() => props.onOpenStep(stepView)}
            >
              {inner}
            </button>
          ) : (
            <article key={card.title} className={`hub-card ${state}`} aria-label={`Step ${index + 1}: ${card.title}, ${stateLabel}`}>
              {inner}
            </article>
          )
        })}
      </section>

      {run && activeProject && (
        <div className="info-banner info-accent" role="status">
          <span aria-hidden="true">ⓘ</span>
          <span className="info-banner-copy">
            Active handoff run for <code>{activeProject.name}</code> — current step:{' '}
            {WORKFLOW_STEPS[currentIndex]?.short ?? 'Complete'}.
          </span>
          <button type="button" className="btn btn-secondary btn-compact" onClick={() => props.onOpenStep(WORKFLOW_STEPS[Math.min(currentIndex, 4)]!.id)}>
            Continue
          </button>
        </div>
      )}

      <section className="panel" aria-labelledby="recent-projects-heading">
        <div className="panel-head">
          <h2 id="recent-projects-heading">Recent Projects</h2>
          <button type="button" className="tip-link" onClick={() => props.onOpenStep('projects')}>
            View all →
          </button>
        </div>
        {recent.length === 0 ? (
          <div className="empty-state">
            <p>No projects yet. Create one to start your first handoff.</p>
            <button type="button" className="btn btn-primary" onClick={() => setNewProjectOpen(true)}>
              {Icon.plus()} New Project
            </button>
          </div>
        ) : (
          <ul className="project-rows">
            {recent.map((project) => (
              <li key={project.id} className="project-row">
                <span className="project-row-icon" aria-hidden="true">{Icon.folder(18)}</span>
                <div className="project-row-copy">
                  <strong>{project.name}</strong>
                  <p className="project-meta">
                    {project.description ? `${project.description} · ` : ''}
                    {lastUpdatedLabel(project.updatedAt)}
                  </p>
                </div>
                <button type="button" className="btn btn-secondary btn-compact" onClick={() => props.onStartRun(project.id)}>
                  {run && run.projectId === project.id ? 'Open' : 'Start handoff'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="info-banner">
        <span aria-hidden="true">ⓘ</span>
        <span className="info-banner-copy">
          Primary output from Copilot should be a zip overlay of changed/new files only. After applying, run local
          verification and perform a scoped Copilot code review.
        </span>
        <button type="button" className="tip-link info-banner-action" onClick={props.onOpenHelp}>
          Learn more about the workflow →
        </button>
      </div>

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
