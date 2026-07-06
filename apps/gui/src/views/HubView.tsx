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
  { icon: Icon.folderBig(30), title: '1. Prepare Context', body: 'Export your repo and standards for Copilot.' },
  { icon: Icon.filePlus(30), title: '2. Create Task Packet', body: 'Build the instruction packet with goal, constraints, and acceptance criteria.' },
  { icon: Icon.cloudUp(30), title: '3. Run in Copilot', body: 'Upload the packet to Microsoft 365 Copilot and request a zip overlay.' },
  { icon: Icon.downloadTray(30), title: '4. Apply Zip Overlay', body: "Extract Copilot's zip output on top of your existing repo." },
  { icon: Icon.shieldCheck(30), title: '5. Verify & Review', body: 'Run tests, then perform scoped Copilot review against the spec.' },
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

      <ol className="hub-markers" aria-hidden="true">
        {STEP_CARDS.map((card, index) => {
          const state = currentIndex === -1 ? 'upcoming' : index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'upcoming'
          return (
            <li key={card.title} className={`hub-marker-step ${state}`}>
              <span className="workflow-marker">{state === 'complete' ? '✓' : index + 1}</span>
            </li>
          )
        })}
      </ol>

      <section aria-label="Workflow steps" className="hub-steps">
        {STEP_CARDS.map((card, index) => {
          const state = currentIndex === -1 ? 'not-started' : index < currentIndex ? 'complete' : index === currentIndex ? 'in-progress' : 'not-started'
          const stepView = WORKFLOW_STEPS[index]!.id
          const reachable = run ? index <= currentIndex : false
          return (
            <article key={card.title} className="hub-card">
              <span className="hub-glyph" aria-hidden="true">{card.icon}</span>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              {state === 'complete' && <span className="badge badge-success">✓ Completed</span>}
              {state === 'in-progress' && (
                <button type="button" className="badge badge-info" onClick={() => props.onOpenStep(stepView)}>
                  ◔ In progress
                </button>
              )}
              {state === 'not-started' && (
                <button
                  type="button"
                  className="badge badge-neutral"
                  disabled={!reachable}
                  onClick={() => props.onOpenStep(stepView)}
                >
                  Not started
                </button>
              )}
            </article>
          )
        })}
      </section>

      {run && activeProject && (
        <div className="info-banner info-accent" role="status">
          <span aria-hidden="true">ⓘ</span>
          Active handoff run for <code>{activeProject.name}</code> — current step:{' '}
          {WORKFLOW_STEPS[currentIndex]?.short ?? 'Complete'}.
          <button type="button" className="btn btn-secondary btn-compact" onClick={() => props.onOpenStep(WORKFLOW_STEPS[Math.min(currentIndex, 4)]!.id)}>
            Continue
          </button>
        </div>
      )}

      <section className="panel" aria-labelledby="recent-projects-heading">
        <h2 id="recent-projects-heading" style={{ textAlign: 'center' }}>Recent Projects</h2>
        {recent.length === 0 ? (
          <div className="stack" style={{ alignItems: 'center' }}>
            <p className="secondary-text">No projects yet. Create one to start your first handoff.</p>
            <button type="button" className="btn btn-primary" onClick={() => setNewProjectOpen(true)}>
              {Icon.plus()} New Project
            </button>
          </div>
        ) : (
          <div className="recent-projects">
            {recent.map((project) => (
              <div key={project.id} className="recent-project">
                <span className="recent-project-icon" aria-hidden="true">{Icon.folderBig(30)}</span>
                <strong>{project.name}</strong>
                <span className="secondary-text">{lastUpdatedLabel(project.updatedAt)}</span>
                <button type="button" className="btn btn-secondary btn-compact" onClick={() => props.onStartRun(project.id)}>
                  {run && run.projectId === project.id ? 'Open' : 'Start handoff'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="info-banner hstack between">
        <span className="hstack" style={{ gap: 'var(--semantic-spacing-3)' }}>
          <span aria-hidden="true">ⓘ</span>
          <span>
            Primary output from Copilot should be a zip overlay of changed/new files only. After applying, run local
            verification and perform a scoped Copilot code review.
          </span>
        </span>
        <button type="button" className="tip-link" style={{ flexShrink: 0 }} onClick={props.onOpenHelp}>
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
