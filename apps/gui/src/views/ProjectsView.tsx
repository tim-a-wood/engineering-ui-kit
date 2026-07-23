import { useEffect, useMemo, useState } from 'react'

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
  onOpenProject: (projectId: string) => void
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all')
  const [sortBy, setSortBy] = useState<'modified' | 'name'>('modified')
  const [layout, setLayout] = useState<'list' | 'grid'>('list')
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [launchUrlProject, setLaunchUrlProject] = useState<Project | null>(null)
  // Null until an action produces feedback — no filler status banner.
  const [status, setStatus] = useState<Status | null>(null)
  // Projects with an open run resume at their persisted step — label them so.
  const [openProjects, setOpenProjects] = useState<Set<string>>(new Set())
  useEffect(() => {
    let cancelled = false
    props.bridge.listRuns()
      .then((runs) => {
        if (!cancelled) setOpenProjects(new Set(runs.filter((r) => r.currentStep !== 'complete').map((r) => r.projectId)))
      })
      .catch(() => { /* labels fall back to Start handoff */ })
    return () => { cancelled = true }
  }, [props.bridge, props.projects])

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
                onClick={() => props.onOpenProject(project.id)}
              >
                Open project
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
                      {project.isSample && <span className="sample-chip" title="Built-in sample project — explore freely">Sample</span>}
                      <p className="row-meta" title={project.description ?? project.repoPath}>{project.description ?? project.repoPath}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={project.status === 'active' ? 'status status-ok' : 'status status-neutral'}>
                    <span className="status-dot" aria-hidden="true" /> {project.status === 'active' ? 'Active' : 'Archived'}
                  </span>
                </td>
                <td className="secondary-text num cell-time">{friendlyDate(project.updatedAt)}</td>
                <td>
                  <div className="hstack" style={{ justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-compact"
                      disabled={project.status !== 'active'}
                      onClick={() => props.onOpenProject(project.id)}
                    >
                      Open project
                    </button>
                    <RowMenu
                      items={[
                        {
                          label: openProjects.has(project.id) ? 'Resume active task' : 'Start change',
                          onSelect: () => props.onStartRun(project.id),
                        },
                        ...(project.launchUrl
                          ? [{
                              label: 'Open App',
                              onSelect: async () => {
                                setStatus({ tone: 'info', text: `Opening ${project.name}…` })
                                try {
                                  const result = await props.bridge.launchApp(project.id)
                                  setStatus({ tone: 'success', text: result.started ? `Dev server started — ${project.name} opened at ${result.url}.` : `${project.name} opened at ${result.url}.` })
                                } catch (error) {
                                  setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
                                }
                              },
                            }]
                          : []),
                        {
                          label: project.launchUrl ? 'Launch & evidence…' : 'Set launch & evidence…',
                          onSelect: () => setLaunchUrlProject(project),
                        },
                        {
                          label: project.status === 'active' ? 'Archive' : 'Reactivate',
                          onSelect: () => void toggleArchive(project),
                        },
                      ]}
                    />
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

      {status && <StatusLine status={status} />}

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
          onSave={async (url, command, views) => {
            await props.bridge.updateProject(launchUrlProject.id, {
              launchUrl: url || undefined,
              launchCommand: command || undefined,
              evidenceViews: views.length > 0 ? views : undefined,
            } as Partial<Project>)
            await props.refreshProjects()
            setLaunchUrlProject(null)
            setStatus({ tone: 'success', text: `Launch & evidence settings saved for ${launchUrlProject.name}.` })
          }}
        />
      )}
    </>
  )
}

/**
 * Compact per-row overflow menu (CMP-TABLE-DATA-TABLE): one primary action
 * stays visible in the row; secondary actions live behind "More actions".
 */
function RowMenu(props: { items: { label: string; onSelect: () => void }[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="row-menu"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <button
        type="button"
        className="icon-btn icon-btn-outline"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        data-tip="More actions"
        onClick={() => setOpen((o) => !o)}
      >
        {Icon.dots(14)}
      </button>
      {open && (
        <ul className="row-menu-list" role="menu">
          {props.items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                className="row-menu-item"
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** PRD §27.5 + R1 — per-project launch URL, launch command, evidence views. */
export function LaunchUrlDialog(props: {
  project: Project
  onClose: () => void
  onSave: (url: string, command: string, views: { id: string; label: string; path: string }[]) => Promise<void>
}) {
  const [url, setUrl] = useState(props.project.launchUrl ?? '')
  const [command, setCommand] = useState(props.project.launchCommand ?? '')
  const [viewsText, setViewsText] = useState(
    (props.project.evidenceViews ?? []).map((v) => `${v.label} | ${v.path}`).join('\n'),
  )
  const [error, setError] = useState<string | null>(null)

  const parseViews = (): { id: string; label: string; path: string }[] | null => {
    const views: { id: string; label: string; path: string }[] = []
    const seen = new Set<string>()
    for (const raw of viewsText.split('\n')) {
      const line = raw.trim()
      if (!line) continue
      const [labelPart, pathPart] = line.split('|').map((s) => s.trim())
      // Hash-routed apps use "#/screen" (or "/#/screen") paths — both valid.
      if (!labelPart || !pathPart || !/^[/#]/.test(pathPart)) {
        setError(`Each view line must be "Label | /path" (or "Label | #/screen" for hash-routed apps) — problem line: "${line}"`)
        return null
      }
      let id = labelPart.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'view'
      while (seen.has(id)) id = `${id}-2`
      seen.add(id)
      views.push({ id, label: labelPart, path: pathPart })
    }
    return views
  }

  const save = async () => {
    const trimmed = url.trim()
    if (trimmed && !/^https?:\/\//.test(trimmed)) {
      setError('Launch URL must start with http:// or https://')
      return
    }
    const views = parseViews()
    if (views === null) return
    if (views.length > 0 && !trimmed) {
      setError('Evidence views need a launch URL to capture against.')
      return
    }
    await props.onSave(trimmed, command.trim(), views)
  }

  return (
    <Dialog
      title={`Launch & evidence — ${props.project.name}`}
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
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          Used by the Launch App button and by evidence capture.
        </p>
      </div>
      <div className="field">
        <label htmlFor="launch-command">Launch command <span className="muted">(optional)</span></label>
        <input
          id="launch-command"
          type="text"
          className="mono"
          placeholder="npm start"
          value={command}
          onChange={(e) => { setCommand(e.target.value); setError(null) }}
        />
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          Run in the repo when nothing is serving the launch URL — Launch App and evidence capture
          start it for you and stop it when the workbench quits. Leave empty to start your dev server manually.
        </p>
      </div>
      <div className="field">
        <label htmlFor="evidence-views">Evidence target views (one per line: <code>Label | /path</code>)</label>
        <textarea
          id="evidence-views"
          rows={4}
          placeholder={'Dashboard | /\nSettings | /settings'}
          value={viewsText}
          onChange={(e) => { setViewsText(e.target.value); setError(null) }}
        />
        {error && <p className="field-error" role="alert">Error: {error}</p>}
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          These views are screenshotted before and after each handoff; the pairs (plus an element-loss census)
          go into the review evidence contact sheet.
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
