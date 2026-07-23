import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type {
  Project,
  ProjectWorkOverview,
  WorkflowMetrics,
  WorkCoverage,
  WorkNextAction,
} from '@engineering-ui-kit/core'
import type { EuikBridge } from '../bridge'
import { EmptyState, PageHeader, StatusLine, type Status } from '../components'
import { Icon } from '../icons'

type Props = {
  bridge: EuikBridge
  project: Project
  onBack: () => void
  onResumeTask: (projectId: string) => Promise<void> | void
  onStartChange: (projectId: string) => Promise<void> | void
  onOpenCapabilities: (projectId: string) => void
}

const COVERAGE_ROWS: { key: keyof WorkCoverage; label: string }[] = [
  { key: 'defined', label: 'Defined' },
  { key: 'approved', label: 'Approved' },
  { key: 'exported', label: 'Exported' },
  { key: 'returned', label: 'Returned' },
  { key: 'applied', label: 'Applied' },
  { key: 'verified', label: 'Verified' },
  { key: 'complete', label: 'Complete' },
]

function actionLabel(action: WorkNextAction): string {
  switch (action.operation) {
    case 'definition.propose': return 'Define product'
    case 'definition.review': return 'Review product definition'
    case 'architecture.propose': return 'Design architecture'
    case 'architecture.review': return 'Review architecture'
    case 'modules.propose_batch': return 'Generate module proposals'
    case 'modules.review_batch': return 'Review module proposals'
    case 'work.plan': return 'Plan implementation'
    case 'run.export': return 'Export next implementation'
    case 'run.return': return 'Return with result'
    case 'run.inspect': return 'Inspect result'
    case 'run.apply': return 'Apply reviewed result'
    case 'run.verify': return 'Verify applied result'
    case 'frontend.plan': return 'Plan frontend'
    case 'result.open': return 'Open result'
  }
}

export function ProjectOverviewView(props: Props) {
  const [overview, setOverview] = useState<ProjectWorkOverview>()
  const [workflowMetrics, setWorkflowMetrics] = useState<WorkflowMetrics>()
  const [status, setStatus] = useState<Status>({ tone: 'info', text: 'Loading current project evidence…' })
  const historyRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    let cancelled = false
    setOverview(undefined)
    setWorkflowMetrics(undefined)
    setStatus({ tone: 'info', text: 'Loading current project evidence…' })
    void Promise.all([
      props.bridge.getProjectWorkOverview(props.project.id),
      props.bridge.getProjectWorkflowMetrics(props.project.id),
    ])
      .then(([result, metrics]) => {
        if (cancelled) return
        setOverview(result)
        setWorkflowMetrics(metrics)
        setStatus({
          tone: result.blockingDiagnostics.length ? 'error' : 'success',
          text: result.blockingDiagnostics.length
            ? `${result.blockingDiagnostics.length} legacy record${result.blockingDiagnostics.length === 1 ? '' : 's'} need review.`
            : 'Coverage is derived from current persisted evidence.',
        })
      })
      .catch((error) => {
        if (!cancelled) setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
      })
    return () => { cancelled = true }
  }, [props.bridge, props.project.id])

  const primary = overview?.nextActions[0]
  const openResult = async () => {
    setStatus({ tone: 'info', text: `Opening ${props.project.name}…` })
    try {
      const result = await props.bridge.launchApp(props.project.id)
      setStatus({
        tone: 'success',
        text: result.started
          ? `Application started and opened at ${result.url}.`
          : `Application opened at ${result.url}.`,
      })
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    }
  }

  const performNextAction = () => {
    if (!primary) return
    if (primary.operation === 'result.open') {
      void openResult()
      return
    }
    if (primary.operation === 'frontend.plan') {
      void props.onStartChange(props.project.id)
      return
    }
    const frontendTarget = primary.targetIds.includes('frontend')
    if (primary.operation.startsWith('run.') && frontendTarget) {
      void props.onResumeTask(props.project.id)
      return
    }
    props.onOpenCapabilities(props.project.id)
  }

  return (
    <>
      <PageHeader
        title={props.project.name}
        subtitle="One evidence-backed workspace for definition, implementation, frontend, integration, and verification."
        onBack={props.onBack}
        badge={props.project.isSample ? <span className="sample-chip">Sample</span> : undefined}
        actions={(
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              View history
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => void props.onResumeTask(props.project.id)}>
              Resume active task
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void props.onStartChange(props.project.id)}>
              Start change
            </button>
          </>
        )}
      />

      {overview ? (
        <ProjectOverviewContent
          project={props.project}
          overview={overview}
          onNextAction={performNextAction}
          onOpenCapabilities={() => props.onOpenCapabilities(props.project.id)}
          onOpenResult={() => void openResult()}
          historyRef={historyRef}
          workflowMetrics={workflowMetrics}
        />
      ) : (
        <section className="panel" aria-live="polite">
          <p className="secondary-text">Building the unified project index…</p>
        </section>
      )}
      <StatusLine status={status} />
    </>
  )
}

export function ProjectOverviewContent(props: {
  project: Project
  overview: ProjectWorkOverview
  onNextAction: () => void
  onOpenCapabilities: () => void
  onOpenResult: () => void
  historyRef?: RefObject<HTMLElement | null>
  workflowMetrics?: WorkflowMetrics
}) {
  const primary = props.overview.nextActions[0]
  const hasRunnableResult = props.overview.history.some((entry) =>
    entry.source === 'frontend' && ['verified', 'integrated', 'complete'].includes(entry.lifecycleState))
  const activeHistory = useMemo(
    () => props.overview.history.filter((entry) => !entry.isEmptyDraft || entry.lifecycleState !== 'draft'),
    [props.overview.history],
  )
  const emptyDrafts = props.overview.history.length - activeHistory.length

  return (
    <>
      {primary && (
        <section className="panel" aria-labelledby="project-next-action">
          <div className="hstack between" style={{ alignItems: 'flex-start', gap: 16 }}>
            <div>
              <span className="badge badge-info">Next best action</span>
              <h2 id="project-next-action" style={{ marginTop: 8 }}>{actionLabel(primary)}</h2>
              <p className="panel-desc" style={{ marginBottom: 0 }}>{primary.reason}</p>
              {primary.targetIds.length > 0 && (
                <p className="mono muted" style={{ marginBottom: 0 }}>
                  {primary.targetIds.length} target{primary.targetIds.length === 1 ? '' : 's'}: {primary.targetIds.join(', ')}
                </p>
              )}
            </div>
            <button type="button" className="btn btn-primary" onClick={props.onNextAction}>
              {actionLabel(primary)} {Icon.arrowRight(14)}
            </button>
          </div>
        </section>
      )}

      <section className="panel" aria-labelledby="coverage-heading">
        <div className="hstack between">
          <div>
            <h2 id="coverage-heading">Product coverage</h2>
            <p className="panel-desc">Approval and executable progress are shown separately.</p>
          </div>
          <button type="button" className="btn btn-secondary btn-compact" onClick={props.onOpenCapabilities}>
            Open capabilities
          </button>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <caption className="sr-only">Definition and implementation coverage</caption>
            <thead>
              <tr>
                <th scope="col">Area</th>
                {COVERAGE_ROWS.map((row) => <th scope="col" className="cell-num" key={row.key}>{row.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {props.overview.dimensions.map((dimension) => (
                <tr key={dimension.id}>
                  <th scope="row">{dimension.label} <span className="muted">({dimension.coverage.total})</span></th>
                  {COVERAGE_ROWS.map((row) => (
                    <td className="cell-num mono" key={row.key}>
                      {dimension.coverage[row.key]} / {dimension.coverage.total}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" aria-labelledby="result-heading">
        <div className="hstack between">
          <div>
            <h2 id="result-heading">Latest result</h2>
            <p className="panel-desc">
              {hasRunnableResult
                ? 'A verified frontend result is available.'
                : 'No verified frontend result is available yet.'}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!hasRunnableResult && !props.project.launchUrl}
            onClick={props.onOpenResult}
          >
            Open result
          </button>
        </div>
      </section>

      {props.workflowMetrics && props.workflowMetrics.events > 0 && (
        <section className="panel" aria-labelledby="workflow-efficiency-heading">
          <div className="hstack between" style={{ alignItems: 'flex-start', gap: 16 }}>
            <div>
              <h2 id="workflow-efficiency-heading">Workflow efficiency</h2>
              <p className="panel-desc">
                Local operational measurements only. Prompt text, source paths, and user content are never recorded.
              </p>
            </div>
            <span className="toolbar-count">{props.workflowMetrics.events} actions measured</span>
          </div>
          <div className="metric-grid" aria-label="Workflow efficiency metrics">
            <article className="metric-card">
              <span className="metric-value">{props.workflowMetrics.uniqueRuns}</span>
              <span className="metric-label">Runs started</span>
            </article>
            <article className="metric-card">
              <span className="metric-value">{props.workflowMetrics.completedRuns}</span>
              <span className="metric-label">Runs completed</span>
            </article>
            <article className="metric-card">
              <span className="metric-value">{props.workflowMetrics.handoffsExported}</span>
              <span className="metric-label">Handoffs exported</span>
            </article>
            <article className="metric-card">
              <span className="metric-value">
                {props.workflowMetrics.blockedActions + props.workflowMetrics.failedActions}
              </span>
              <span className="metric-label">Blocked or failed</span>
            </article>
            <article className="metric-card">
              <span className="metric-value">{formatDuration(props.workflowMetrics.medianActionDurationMs)}</span>
              <span className="metric-label">Median action</span>
            </article>
          </div>
        </section>
      )}

      <section className="panel" aria-labelledby="history-heading" ref={props.historyRef}>
        <div className="hstack between">
          <div>
            <h2 id="history-heading">Project history</h2>
            <p className="panel-desc">
              Capability and frontend work in one timeline.
              {emptyDrafts > 0 ? ` ${emptyDrafts} empty draft${emptyDrafts === 1 ? ' is' : 's are'} excluded from progress.` : ''}
            </p>
          </div>
          <span className="toolbar-count">{activeHistory.length} substantive</span>
        </div>
        {activeHistory.length === 0 ? (
          <EmptyState
            icon={Icon.folderBig(24)}
            title="No substantive work yet"
            hint="Start with the next best action above."
          />
        ) : (
          <table className="data-table">
            <caption className="sr-only">Unified project run history</caption>
            <thead>
              <tr><th scope="col">Work</th><th scope="col">Target</th><th scope="col">Maturity</th><th scope="col">Condition</th><th scope="col">Updated</th></tr>
            </thead>
            <tbody>
              {activeHistory.map((entry) => (
                <tr key={`${entry.source}-${entry.runId}`}>
                  <td><strong>{entry.title}</strong><p className="row-meta">{entry.source} · {entry.kind}</p></td>
                  <td className="mono">{entry.targetId}</td>
                  <td><span className={`status ${entry.lifecycleState === 'complete' || entry.lifecycleState === 'verified' ? 'status-ok' : 'status-info'}`}><span className="status-dot" />{entry.lifecycleState}</span></td>
                  <td>{entry.condition}</td>
                  <td className="secondary-text">{new Date(entry.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1_000) return `${Math.round(durationMs)} ms`
  if (durationMs < 60_000) return `${(durationMs / 1_000).toFixed(1)} s`
  return `${(durationMs / 60_000).toFixed(1)} min`
}
