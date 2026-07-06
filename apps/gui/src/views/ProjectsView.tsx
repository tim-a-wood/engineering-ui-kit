import { useMemo, useState } from 'react'

function friendlyDate(iso: string): string {
  const date = new Date(iso)
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const today = new Date()
  const yesterday = new Date(Date.now() - 864e5)
  if (date.toDateString() === today.toDateString()) return `Today, ${time}`
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
import type { Project } from '@engineering-ui-kit/core'
import type { EuikBridge } from '../bridge'
import { Dialog, EmptyState, PageHeader, StatusLine, type Status } from '../components'
import { Icon } from '../icons'

export function ProjectsView(props: {
  bridge: EuikBridge
  projects: Project[]
  refreshProjects: () => Promise<void>
  onStartRun: (projectId: string) => void
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all')
  const [sortBy, setSortBy] = useState<'modified' | 'name'>('modified')
  const [layout, setLayout] = useState<'list' | 'grid'>('list')
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [launchUrlProject, setLaunchUrlProject] = useState<Project | null>(null)
  const [status, setStatus] = useState<Status>({ tone: 'info', text: 'Manage your Engineering UI Kit projects.' })

  const PAGE_SIZE = 8
  const filtered = useMemo(() => {
    return props.projects
      .filter((p) => statusFilter === 'all' || p.status === statusFilter)
      .filter((p) => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => (sortBy === 'modified' ? b.updatedAt.localeCompare(a.updatedAt) : a.name.localeCompare(b.name)))
  }, [props.projects, search, statusFilter, sortBy])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const toggleArchive = async (project: Project) => {
    await props.bridge.updateProject(project.id, { status: project.status === 'active' ? 'archived' : 'active' })
    await props.refreshProjects()
    setStatus({ tone: 'success', text: `${project.name} ${project.status === 'active' ? 'archived' : 'reactivated'}.` })
  }

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="Organize and manage your Engineering UI Kit projects."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setDialogOpen(true)}>
            {Icon.plus(14)} New Project
          </button>
        }
      />

      <section className="panel panel-flush" aria-label="Project list">
      <div className="table-toolbar">
        <div className="search-input">
          <span className="search-glyph" aria-hidden="true">{Icon.search()}</span>
          <input
            type="text"
            aria-label="Search projects"
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="table-toolbar-spacer" />
        <span className="toolbar-count">
          {filtered.length} project{filtered.length === 1 ? '' : 's'}
        </span>
        <label className="sr-only" htmlFor="status-filter">Filter by status</label>
        <select
          id="status-filter"
          className="select-control"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1) }}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
        <label className="sr-only" htmlFor="sort-select">Sort projects</label>
        <select
          id="sort-select"
          className="select-control"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
        >
          <option value="modified">Sort: Last Modified</option>
          <option value="name">Sort: Name</option>
        </select>
        <div className="segmented" role="group" aria-label="Layout">
          <button
            type="button"
            className={layout === 'list' ? 'segment active' : 'segment'}
            aria-pressed={layout === 'list'}
            aria-label="List view"
            data-tip="List view"
            onClick={() => setLayout('list')}
          >
            {Icon.list(14)}
          </button>
          <button
            type="button"
            className={layout === 'grid' ? 'segment active' : 'segment'}
            aria-pressed={layout === 'grid'}
            aria-label="Grid view"
            data-tip="Grid view"
            onClick={() => setLayout('grid')}
          >
            {Icon.grid(14)}
          </button>
        </div>
      </div>

      {layout === 'grid' ? (
        <div className="card-grid" aria-label="Project cards" style={{ padding: 'var(--semantic-spacing-4)' }}>
          {visible.length === 0 && (
            <EmptyState
              icon={Icon.folderBig(24)}
              title="No projects match"
              hint="Adjust the search or filters, or create a new project."
            />
          )}
          {visible.map((project) => (
            <article key={project.id} className="panel recent-project" style={{ textAlign: 'center' }}>
              <span className="recent-project-icon" aria-hidden="true">{Icon.folder()}</span>
              <strong>{project.name}</strong>
              <span className="secondary-text" style={{ fontSize: 13 }}>{project.description ?? project.repoPath}</span>
              <span className={project.status === 'active' ? 'status status-ok' : 'status status-neutral'}>
                <span className="status-dot" aria-hidden="true" /> {project.status === 'active' ? 'Active' : 'Archived'}
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-compact"
                disabled={project.status !== 'active'}
                onClick={() => props.onStartRun(project.id)}
              >
                Start handoff
              </button>
            </article>
          ))}
        </div>
      ) : (
        <table className="data-table">
          <caption className="sr-only">Projects</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Status</th>
              <th scope="col">Last Modified</th>
              <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 0 }}>
                  <EmptyState
                    icon={Icon.folderBig(24)}
                    title="No projects match"
                    hint="Adjust the search or filters, or create a new project."
                  />
                </td>
              </tr>
            )}
            {visible.map((project) => (
              <tr key={project.id}>
                <td>
                  <div className="hstack">
                    <span aria-hidden="true" style={{ color: 'var(--semantic-text-muted)', display: 'inline-flex' }}>{Icon.folder()}</span>
                    <div>
                      <strong>{project.name}</strong>
                      <p className="muted" style={{ margin: 0, fontSize: 13 }}>{project.description ?? project.repoPath}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={project.status === 'active' ? 'status status-ok' : 'status status-neutral'}>
                    <span className="status-dot" aria-hidden="true" /> {project.status === 'active' ? 'Active' : 'Archived'}
                  </span>
                </td>
                <td className="secondary-text num">{friendlyDate(project.updatedAt)}</td>
                <td>
                  <div className="hstack" style={{ justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-compact"
                      disabled={project.status !== 'active'}
                      onClick={() => props.onStartRun(project.id)}
                    >
                      Start handoff
                    </button>
                    <button type="button" className="btn btn-secondary btn-compact" onClick={() => setLaunchUrlProject(project)}>
                      {project.launchUrl ? 'Launch URL…' : 'Set launch URL…'}
                    </button>
                    <button type="button" className="btn btn-secondary btn-compact" onClick={() => toggleArchive(project)}>
                      {project.status === 'active' ? 'Archive' : 'Reactivate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="table-footer">
        <span className="num">
          {filtered.length === 0
            ? 'Showing 0 projects'
            : `Showing ${(currentPage - 1) * PAGE_SIZE + 1} to ${Math.min(currentPage * PAGE_SIZE, filtered.length)} of ${filtered.length} project${filtered.length === 1 ? '' : 's'}`}
        </span>
        {pageCount > 1 && (
          <nav className="hstack" aria-label="Pagination">
            <button type="button" className="icon-btn icon-btn-outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} aria-label="Previous page" data-tip="Previous page">
              {Icon.chevronLeft(14)}
            </button>
            {Array.from({ length: pageCount }, (_, i) => (
              <button
                key={i}
                type="button"
                className={i + 1 === currentPage ? 'btn btn-primary btn-compact' : 'btn btn-secondary btn-compact'}
                aria-current={i + 1 === currentPage ? 'page' : undefined}
                onClick={() => setPage(i + 1)}
              >
                {i + 1}
              </button>
            ))}
            <button type="button" className="icon-btn icon-btn-outline" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} aria-label="Next page" data-tip="Next page">
              {Icon.chevronRight(14)}
            </button>
          </nav>
        )}
      </div>
      </section>

      <StatusLine status={status} />

      {dialogOpen && (
        <NewProjectDialog
          bridge={props.bridge}
          onClose={() => setDialogOpen(false)}
          onCreated={async (project) => {
            setDialogOpen(false)
            await props.refreshProjects()
            setStatus({ tone: 'success', text: `Project ${project.name} created.` })
          }}
        />
      )}

      {launchUrlProject && (
        <LaunchUrlDialog
          project={launchUrlProject}
          onClose={() => setLaunchUrlProject(null)}
          onSave={async (url) => {
            await props.bridge.updateProject(launchUrlProject.id, { launchUrl: url || undefined } as Partial<Project>)
            await props.refreshProjects()
            setLaunchUrlProject(null)
            setStatus({ tone: 'success', text: url ? `Launch URL saved for ${launchUrlProject.name}.` : `Launch URL cleared for ${launchUrlProject.name}.` })
          }}
        />
      )}
    </>
  )
}

/** PRD §27.5 — per-project launch URL used by the Launch App button. */
function LaunchUrlDialog(props: { project: Project; onClose: () => void; onSave: (url: string) => Promise<void> }) {
  const [url, setUrl] = useState(props.project.launchUrl ?? '')
  const [error, setError] = useState<string | null>(null)
  const save = async () => {
    const trimmed = url.trim()
    if (trimmed && !/^https?:\/\//.test(trimmed)) {
      setError('Launch URL must start with http:// or https://')
      return
    }
    await props.onSave(trimmed)
  }
  return (
    <Dialog
      title={`Launch URL — ${props.project.name}`}
      onClose={props.onClose}
      actions={
        <>
          <button type="button" className="btn btn-secondary" onClick={props.onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save}>Save</button>
        </>
      }
    >
      <div className={error ? 'field invalid' : 'field'}>
        <label htmlFor="launch-url">Launch URL</label>
        <input
          id="launch-url"
          type="text"
          placeholder="http://localhost:5173"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(null) }}
        />
        {error && <p className="field-error" role="alert">Error: {error}</p>}
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          Used by the Launch App button in Verify &amp; Review. Start your dev server manually, then Launch App opens
          this URL. Leave empty to clear.
        </p>
      </div>
    </Dialog>
  )
}

export function NewProjectDialog(props: {
  bridge: EuikBridge
  onClose: () => void
  onCreated: (project: Project) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [repoPath, setRepoPath] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showValidation, setShowValidation] = useState(false)

  const create = async () => {
    setShowValidation(true)
    if (!name.trim() || !repoPath.trim()) return
    try {
      const project = await props.bridge.createProject({
        name,
        repoPath,
        ...(description.trim() ? { description: description.trim() } : {}),
      })
      await props.onCreated(project)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : String(createError))
    }
  }

  return (
    <Dialog
      title="New Project"
      onClose={props.onClose}
      actions={
        <>
          <button type="button" className="btn btn-secondary" onClick={props.onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={create}>
            Create Project
          </button>
        </>
      }
    >
      <div className={showValidation && !name.trim() ? 'field invalid' : 'field'}>
        <label htmlFor="np-name">Project name</label>
        <input id="np-name" type="text" placeholder="Enter project name…" value={name} onChange={(e) => setName(e.target.value)} />
        {showValidation && !name.trim() && <p className="field-error" role="alert">Error: Project name is required.</p>}
      </div>
      <div className={showValidation && !repoPath.trim() ? 'field invalid' : 'field'}>
        <label htmlFor="np-path">Repository path</label>
        <div className="field-row">
          <input id="np-path" type="text" placeholder="Enter repository path…" value={repoPath} onChange={(e) => setRepoPath(e.target.value)} />
          <button
            type="button"
            className="btn btn-secondary btn-compact"
            onClick={async () => {
              const picked = await props.bridge.pickDirectory()
              if (picked) setRepoPath(picked)
            }}
          >
            Browse
          </button>
        </div>
        {showValidation && !repoPath.trim() && <p className="field-error" role="alert">Error: Repository path is required.</p>}
      </div>
      <div className="field">
        <label htmlFor="np-desc">Description (optional)</label>
        <textarea id="np-desc" rows={3} placeholder="Enter a short description of the project…" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      {error && (
        <p className="field-error" role="alert" style={{ color: 'var(--semantic-status-danger)' }}>
          <strong>Error:</strong> {error}
        </p>
      )}
    </Dialog>
  )
}
