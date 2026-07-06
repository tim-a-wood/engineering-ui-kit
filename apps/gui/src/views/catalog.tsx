/**
 * Curated references per PRD §13.8/§13.9: the five approved recipes (usable —
 * a recipe prefills the task packet) and the eight curated components with
 * live token-styled demos, plus a compact searchable reference over the full
 * 68-component manifest (generated from standards/component-manifest.json).
 */

import { useMemo, useState, type ReactElement } from 'react'
import { PageHeader } from '../components'
import { Icon } from '../icons'
import type { RecipePrefill } from '../appState'
import catalog from '../data/componentCatalog.json'

/* ------------------------------------------------------------ Recipes */

type Recipe = RecipePrefill & { description: string; thumbnail: ReactElement }

const thumb = (children: ReactElement) => (
  <svg viewBox="0 0 96 60" className="recipe-thumb" aria-hidden="true">
    <rect x="0" y="0" width="96" height="60" rx="4" className="rt-bg" />
    {children}
  </svg>
)

export const RECIPES: Recipe[] = [
  {
    id: 'LAY-SHELL-001',
    title: 'Engineering App Shell',
    description: 'A foundational app shell with global navigation, header, and content area.',
    componentsUsed: ['CMP-SHELL-APP', 'CMP-NAV-PRIMARY', 'CMP-SHELL-PAGE-HEADER', 'CMP-SURFACE-PANEL'],
    goal: 'Implement the standard dark-first engineering app shell: persistent top bar, left primary navigation with visible active state, and a page content region with a consistent header.',
    scope: 'Application shell only: top bar, primary navigation, page header, and content container.\nNo feature screens beyond a placeholder content area.',
    constraints: 'Do not change domain logic, calculation logic, API contracts, test data, or unrelated screens.\nNo new dependencies; no router or state library additions.',
    acceptanceCriteria: 'Shell renders with semantic surface hierarchy (canvas, panel).\nNavigation exposes the active item semantically and by keyboard.\nPage header shows title, subtitle, and action region.\nDark-first tokens only; no raw colors outside the token entry point.',
    references: 'LAY-SHELL-001 (standards/layouts-and-recipes/application-shell.md)\nCMP-SHELL-APP, CMP-NAV-PRIMARY, CMP-SHELL-PAGE-HEADER',
    thumbnail: thumb(
      <>
        <rect x="4" y="4" width="20" height="52" rx="2" className="rt-panel" />
        <rect x="6" y="8" width="16" height="3" rx="1" className="rt-accent" />
        <rect x="6" y="14" width="16" height="3" rx="1" className="rt-line" />
        <rect x="6" y="20" width="16" height="3" rx="1" className="rt-line" />
        <rect x="28" y="4" width="64" height="8" rx="2" className="rt-panel" />
        <rect x="30" y="6" width="24" height="4" rx="1" className="rt-line" />
        <rect x="28" y="16" width="64" height="40" rx="2" className="rt-panel" />
      </>,
    ),
  },
  {
    id: 'RCP-DASH-001',
    title: 'Dashboard',
    description: 'A dashboard layout with summary cards, charts, and key metrics.',
    componentsUsed: ['CMP-SURFACE-PANEL', 'CMP-DATA-CHART-LINE', 'CMP-FEEDBACK-BADGE', 'CMP-SHELL-PAGE-HEADER'],
    goal: 'Implement a dark-first engineering dashboard with summary stat cards, a primary chart region, and a recent-activity list.',
    scope: 'One dashboard screen: stat card row, chart panel, activity panel.\nStatic or sample data wiring only; no new data services.',
    constraints: 'Do not change domain logic, calculation logic, API contracts, test data, or unrelated screens.\nNo new dependencies; no router or state library additions.',
    acceptanceCriteria: 'Stat cards use raised panels with text labels beside every value.\nChart region uses an inset technical surface.\nStatus indicators carry text, never color alone.\nDark-first tokens only.',
    references: 'RCP-DASH-001 (standards/layouts-and-recipes/workflow-pages.md)\nApproved mockup: Dashboard recipe row',
    thumbnail: thumb(
      <>
        <rect x="4" y="4" width="27" height="16" rx="2" className="rt-panel" />
        <rect x="35" y="4" width="27" height="16" rx="2" className="rt-panel" />
        <rect x="66" y="4" width="26" height="16" rx="2" className="rt-panel" />
        <rect x="4" y="24" width="58" height="32" rx="2" className="rt-panel" />
        <polyline points="8,48 20,38 32,42 44,30 56,34" className="rt-spark" />
        <rect x="66" y="24" width="26" height="32" rx="2" className="rt-panel" />
      </>,
    ),
  },
  {
    id: 'RCP-SPLIT-001',
    title: 'Workspace',
    description: 'A two-pane workspace for focused work with contextual details.',
    componentsUsed: ['CMP-SURFACE-PANEL', 'CMP-NAV-TREE', 'CMP-FORM-FIELD', 'CMP-SHELL-PAGE-HEADER'],
    goal: 'Implement a two-pane workspace: a primary working pane and a contextual details pane, with a clear focus hierarchy.',
    scope: 'One workspace screen with list/tree on the left pane and detail editor on the right pane.\nSelection state only; no new persistence.',
    constraints: 'Do not change domain logic, calculation logic, API contracts, test data, or unrelated screens.\nNo new dependencies; no router or state library additions.',
    acceptanceCriteria: 'Two panes with visible boundary and correct keyboard traversal order.\nDetail pane updates from selection with status text.\nDark-first tokens only.',
    references: 'RCP-SPLIT-001 / RCP-SPLIT-002 (standards/layouts-and-recipes/workflow-pages.md)',
    thumbnail: thumb(
      <>
        <rect x="4" y="4" width="34" height="52" rx="2" className="rt-panel" />
        <rect x="6" y="8" width="30" height="3" rx="1" className="rt-line" />
        <rect x="6" y="14" width="30" height="3" rx="1" className="rt-accent" />
        <rect x="6" y="20" width="30" height="3" rx="1" className="rt-line" />
        <rect x="42" y="4" width="50" height="52" rx="2" className="rt-panel" />
        <rect x="45" y="8" width="30" height="4" rx="1" className="rt-line" />
        <rect x="45" y="16" width="44" height="3" rx="1" className="rt-line" />
        <rect x="45" y="22" width="44" height="3" rx="1" className="rt-line" />
      </>,
    ),
  },
  {
    id: 'RCP-TABLE-001',
    title: 'Data Table View',
    description: 'A sortable, filterable data table for structured information.',
    componentsUsed: ['CMP-TABLE-DATA', 'CMP-FORM-INPUT', 'CMP-FEEDBACK-BADGE', 'CMP-NAV-PAGINATION'],
    goal: 'Implement a dense, readable engineering data table with search, status badges, and pagination.',
    scope: 'One table screen: toolbar (search + filter), table with sortable headers, status column, pagination.\nSample data only.',
    constraints: 'Do not change domain logic, calculation logic, API contracts, test data, or unrelated screens.\nNo new dependencies; no router or state library additions.',
    acceptanceCriteria: 'Table uses semantic headers and caption.\nRow status shown as text badges.\nKeyboard operable controls with visible focus.\nDark-first tokens only.',
    references: 'RCP-TABLE-001 (standards/layouts-and-recipes/workflow-pages.md)\nApproved mockup: Projects table',
    thumbnail: thumb(
      <>
        <rect x="4" y="4" width="88" height="8" rx="2" className="rt-panel" />
        <rect x="4" y="16" width="88" height="6" rx="1" className="rt-line" />
        <rect x="4" y="26" width="88" height="6" rx="1" className="rt-panel" />
        <rect x="4" y="36" width="88" height="6" rx="1" className="rt-line" />
        <rect x="4" y="46" width="88" height="6" rx="1" className="rt-panel" />
        <rect x="70" y="17" width="10" height="4" rx="2" className="rt-accent" />
      </>,
    ),
  },
  {
    id: 'RCP-WORKFLOW-001',
    title: 'Execution Progress',
    description: 'A stepper-based layout to track progress and execution status.',
    componentsUsed: ['CMP-WORKFLOW-STEP-INDICATOR', 'CMP-FEEDBACK-PROGRESS', 'CMP-FEEDBACK-ALERT', 'CMP-SURFACE-PANEL'],
    goal: 'Implement a multi-step execution screen with a step indicator, per-step status, and explicit progress text.',
    scope: 'One workflow screen with an ordered stepper, current-step panel, and status region.\nStep state driven by existing app state only.',
    constraints: 'Do not change domain logic, calculation logic, API contracts, test data, or unrelated screens.\nNo new dependencies; no router or state library additions.',
    acceptanceCriteria: 'Stepper shows completed, current, and pending states with text.\nProgress is announced in text, not color alone.\nDark-first tokens only.',
    references: 'RCP-WORKFLOW-001 (standards/layouts-and-recipes/workflow-pages.md)\nApproved mockup: workflow stepper',
    thumbnail: thumb(
      <>
        <circle cx="14" cy="14" r="5" className="rt-success" />
        <circle cx="38" cy="14" r="5" className="rt-accent-stroke" />
        <circle cx="62" cy="14" r="5" className="rt-circle" />
        <circle cx="86" cy="14" r="5" className="rt-circle" />
        <line x1="19" y1="14" x2="33" y2="14" className="rt-connector" />
        <line x1="43" y1="14" x2="57" y2="14" className="rt-connector" />
        <line x1="67" y1="14" x2="81" y2="14" className="rt-connector" />
        <rect x="4" y="26" width="88" height="30" rx="2" className="rt-panel" />
        <rect x="8" y="32" width="50" height="4" rx="1" className="rt-line" />
      </>,
    ),
  },
  {
    id: 'RCP-DETAIL-001',
    title: 'Entity Detail Page',
    description: 'A structured detail page with summary, metadata, tabs, and related panels.',
    componentsUsed: ['CMP-LAYOUT-DETAIL', 'CMP-SHELL-PAGE-HEADER', 'CMP-NAV-TABS', 'CMP-CONTENT-KEY-VALUE-LIST'],
    goal: 'Implement a dark-first entity detail page: identity header, key-value metadata, tabbed sections, and related-record panels.',
    scope: 'REPLACE: name the entity and its fields.\nOne detail view: header with title/status, metadata list, 2-3 tabbed content sections.\nRead-only in this pass; actions listed but stubbed.',
    constraints: 'Do not change domain logic, calculation logic, API contracts, test data, or unrelated screens.\nNo new dependencies; no router or state library additions unless the task explicitly allows them.\nDark-first only; semantic tokens as CSS custom properties; no raw colors outside the token entry point.',
    acceptanceCriteria: 'npm run typecheck and npm run build pass after overlay application.\nHeader, metadata, and tabs render from the entity data with text status badges.\nComplete keyboard operation with visible focus; tabs follow the established keyboard pattern.',
    references: 'RCP-DETAIL-001 (standards/layouts-and-recipes/workflow-pages.md)',
    thumbnail: thumb(
      <>
        <rect x="4" y="4" width="88" height="12" rx="2" className="rt-panel" />
        <rect x="8" y="8" width="30" height="4" rx="1" className="rt-line" />
        <rect x="70" y="7" width="18" height="6" rx="3" className="rt-accent" />
        <rect x="4" y="20" width="40" height="36" rx="2" className="rt-panel" />
        <rect x="7" y="24" width="34" height="3" rx="1" className="rt-line" />
        <rect x="7" y="30" width="34" height="3" rx="1" className="rt-line" />
        <rect x="48" y="20" width="44" height="36" rx="2" className="rt-panel" />
        <rect x="51" y="24" width="14" height="3" rx="1" className="rt-accent" />
        <rect x="67" y="24" width="14" height="3" rx="1" className="rt-line" />
      </>,
    ),
  },
  {
    id: 'RCP-SPLIT-002',
    title: 'Compare & Review',
    description: 'A side-by-side compare/review layout for diffs, evidence, and approval decisions.',
    componentsUsed: ['CMP-LAYOUT-SPLIT-PANEL', 'CMP-ENG-DIFF-VIEWER', 'CMP-FEEDBACK-VALIDATION-SUMMARY', 'CMP-ACTION-BUTTON'],
    goal: 'Implement a dark-first compare/review screen: two synchronized panes for before/after content with a decision bar (approve, reject, notes).',
    scope: 'REPLACE: name the artifacts being compared.\nTwo-pane compare region, difference highlights, decision action bar with confirmation.',
    constraints: 'Do not change domain logic, calculation logic, API contracts, test data, or unrelated screens.\nNo new dependencies; no router or state library additions unless the task explicitly allows them.\nDark-first only; semantic tokens as CSS custom properties; no raw colors outside the token entry point.',
    acceptanceCriteria: 'npm run typecheck and npm run build pass after overlay application.\nBoth panes render with clear labels; differences carry text markers, not color alone.\nDecision actions require explicit confirmation.',
    references: 'RCP-SPLIT-002 (standards/layouts-and-recipes/workflow-pages.md)',
    thumbnail: thumb(
      <>
        <rect x="4" y="4" width="42" height="44" rx="2" className="rt-panel" />
        <rect x="50" y="4" width="42" height="44" rx="2" className="rt-panel" />
        <rect x="7" y="9" width="36" height="3" rx="1" className="rt-line" />
        <rect x="53" y="9" width="36" height="3" rx="1" className="rt-line" />
        <rect x="7" y="15" width="36" height="3" rx="1" className="rt-success" />
        <rect x="53" y="15" width="36" height="3" rx="1" className="rt-accent" />
        <rect x="4" y="52" width="88" height="6" rx="2" className="rt-panel" />
        <rect x="70" y="53" width="20" height="4" rx="2" className="rt-accent" />
      </>,
    ),
  },
]

export function RecipesView(props: { hasActiveRun: boolean; onUseRecipe: (recipe: RecipePrefill) => void }) {
  const [search, setSearch] = useState('')
  const visible = RECIPES.filter((r) => !search.trim() || r.title.toLowerCase().includes(search.toLowerCase()))
  return (
    <>
      <PageHeader
        title="Recipes"
        subtitle="Choose a screen recipe to shape your app or transformation task."
        actions={
          <div className="search-input">
            <span className="search-glyph" aria-hidden="true">{Icon.search()}</span>
            <input type="text" aria-label="Search recipes" placeholder="Search recipes" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        }
      />
      <ul className="row-list">
        {visible.map((recipe) => (
          <li key={recipe.id} className="row-item recipe-row">
            {recipe.thumbnail}
            <div className="row-copy">
              <h3>{recipe.title}</h3>
              <p>{recipe.description}</p>
              <p className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                <code>{recipe.id}</code> · {recipe.componentsUsed.length} components
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              onClick={() => props.onUseRecipe(recipe)}
              title={props.hasActiveRun ? 'Prefill the task packet with this recipe' : 'Starts with this recipe when you begin a handoff'}
            >
              Use in Task Packet ›
            </button>
          </li>
        ))}
      </ul>
      {!props.hasActiveRun && (
        <div className="info-banner">
          <span aria-hidden="true">ⓘ</span>
          No handoff is in progress. Selecting a recipe stores it; start a handoff from Projects and the task packet
          will be prefilled from the recipe.
        </div>
      )}
      <div className="info-banner">
        <span aria-hidden="true">ⓘ</span>
        These recipes are used when creating task packets or starting new apps. The full recipe manifest lives in the
        standards repository.
      </div>
    </>
  )
}

/* ------------------------------------------------------------ Components */

type CatalogComponent = { id: string; name: string; category: string; status: string; description: string }
const ALL_COMPONENTS = catalog.components as CatalogComponent[]
const CATEGORIES = catalog.categories as { id: string; name: string; purpose: string }[]

function DemoSwitch() {
  const [on, setOn] = useState(true)
  return (
    <div className="toggle-row" style={{ width: '100%' }}>
      <span className="toggle-label" style={{ fontSize: 12 }}>Warn on dirty repo</span>
      <button type="button" className="toggle" role="switch" aria-checked={on} aria-label="Warn on dirty repo" onClick={() => setOn(!on)} />
    </div>
  )
}

function DemoTabs() {
  const [tab, setTab] = useState(0)
  return (
    <div style={{ width: '100%' }}>
      <div className="tab-row" role="tablist" aria-label="Demo tabs">
        {['Tab 1', 'Tab 2', 'Tab 3'].map((label, i) => (
          <button key={label} type="button" role="tab" aria-selected={tab === i} className={tab === i ? 'tab active' : 'tab'} onClick={() => setTab(i)}>
            {label}
          </button>
        ))}
      </div>
      <div className="inset" style={{ fontSize: 12 }}>
        This is the content for Tab {tab + 1}. Select another tab to view its content.
      </div>
    </div>
  )
}

const CURATED: { title: string; body: string; id: string; demo: ReactElement }[] = [
  { title: 'Button', body: 'Triggers actions and submits forms.', id: 'CMP-ACTION-BUTTON', demo: <button type="button" className="btn btn-primary btn-compact">Primary</button> },
  {
    title: 'Status Badge', body: 'Conveys state or status with a compact label.', id: 'CMP-FEEDBACK-BADGE',
    demo: (
      <span className="stack" style={{ gap: 6 }}>
        <span className="badge badge-success">✓ Success</span>
        <span className="badge badge-warning">⚠ Warning</span>
        <span className="badge badge-info">ⓘ Info</span>
      </span>
    ),
  },
  {
    title: 'Data Table', body: 'Displays structured data in rows and columns.', id: 'CMP-TABLE-DATA',
    demo: (
      <table className="data-table" style={{ fontSize: 12 }}>
        <thead><tr><th>Name</th><th>Role</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td>Jane Cooper</td><td>Owner</td><td><span className="badge badge-success">Active</span></td></tr>
          <tr><td>Cody Fisher</td><td>Editor</td><td><span className="badge badge-info">Invited</span></td></tr>
        </tbody>
      </table>
    ),
  },
  { title: 'Tabs', body: 'Organizes content across multiple sections.', id: 'CMP-NAV-TABS', demo: <DemoTabs /> },
  { title: 'Input', body: 'Collects and validates user input.', id: 'CMP-FORM-INPUT', demo: <div className="field" style={{ margin: 0, width: '100%' }}><input type="text" placeholder="Enter your email" aria-label="Example input" /><p className="muted" style={{ margin: 0, fontSize: 11 }}>We'll never share your email.</p></div> },
  {
    title: 'Panel', body: 'Groups related content in a contained area.', id: 'CMP-SURFACE-PANEL',
    demo: <div className="inset" style={{ width: '100%' }}><strong style={{ fontSize: 12 }}>Project Overview</strong><p className="muted" style={{ margin: 0, fontSize: 11 }}>This panel groups related information in a contained area for clarity and focus.</p></div>,
  },
  {
    title: 'Page Header', body: 'Provides context and primary navigation.', id: 'CMP-SHELL-PAGE-HEADER',
    demo: (
      <div className="inset hstack between" style={{ width: '100%' }}>
        <span className="hstack"><span aria-hidden="true">≡</span> <strong style={{ fontSize: 13 }}>Page Title</strong></span>
        <span className="badge badge-info">JD</span>
      </div>
    ),
  },
  {
    title: 'Progress', body: 'Shows completion status of a task.', id: 'CMP-FEEDBACK-PROGRESS',
    demo: (
      <div className="hstack" style={{ width: '100%' }} aria-label="Progress: 60 percent">
        <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--semantic-surface-inset)' }}>
          <div style={{ width: '60%', height: '100%', borderRadius: 4, background: 'var(--semantic-accent-primary)' }} />
        </div>
        <span className="mono">60%</span>
      </div>
    ),
  },
  {
    title: 'Alert', body: 'Prominent message for important contextual feedback.', id: 'CMP-FEEDBACK-ALERT',
    demo: (
      <div className="inset" style={{ width: '100%', borderColor: 'var(--semantic-status-warning)' }} role="note">
        <strong style={{ fontSize: 12, color: 'var(--semantic-status-warning)' }}>⚠ Warning</strong>
        <p className="muted" style={{ margin: 0, fontSize: 11 }}>Review the overlay warnings before applying.</p>
      </div>
    ),
  },
  {
    title: 'Toast', body: 'Temporary non-blocking system feedback.', id: 'CMP-FEEDBACK-TOAST',
    demo: (
      <div className="inset hstack" style={{ borderColor: 'var(--semantic-status-success)' }} role="status">
        <span style={{ color: 'var(--semantic-status-success)' }}>✓</span>
        <span style={{ fontSize: 12 }}>Packet exported</span>
      </div>
    ),
  },
  {
    title: 'Breadcrumbs', body: 'Hierarchical location context for nested records.', id: 'CMP-NAV-BREADCRUMBS',
    demo: (
      <nav aria-label="Breadcrumb demo" style={{ fontSize: 12 }}>
        <span className="muted">Projects</span> <span aria-hidden="true">›</span>{' '}
        <span className="muted">sample-app</span> <span aria-hidden="true">›</span>{' '}
        <strong>Run 42</strong>
      </nav>
    ),
  },
  {
    title: 'Empty State', body: 'Clear guidance when a panel or table has no data.', id: 'CMP-CONTENT-EMPTY-STATE',
    demo: (
      <div className="stack" style={{ alignItems: 'center', gap: 4 }}>
        <span aria-hidden="true" style={{ fontSize: 20, color: 'var(--semantic-text-muted)' }}>▱</span>
        <strong style={{ fontSize: 12 }}>No runs yet</strong>
        <span className="muted" style={{ fontSize: 11 }}>Start a handoff to see it here.</span>
      </div>
    ),
  },
  { title: 'Switch', body: 'Immediate binary setting toggle.', id: 'CMP-FORM-SWITCH', demo: <DemoSwitch /> },
  {
    title: 'Select', body: 'Selection from a constrained list of values.', id: 'CMP-FORM-SELECT',
    demo: (
      <div className="field" style={{ margin: 0, width: '100%' }}>
        <select className="select-control" aria-label="Example select" defaultValue="dark">
          <option value="dark">Dark (default)</option>
          <option value="compact">Compact density</option>
        </select>
      </div>
    ),
  },
]

export function ComponentsView() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all')

  const query = search.trim().toLowerCase()
  const curatedVisible = CURATED.filter((c) => !query || c.title.toLowerCase().includes(query) || c.id.toLowerCase().includes(query))
  const manifestVisible = useMemo(
    () => ALL_COMPONENTS.filter((c) =>
      (category === 'all' || c.category === category) &&
      (!query || c.name.toLowerCase().includes(query) || c.id.toLowerCase().includes(query) || c.description.toLowerCase().includes(query))),
    [query, category],
  )

  return (
    <>
      <PageHeader
        title="Components"
        subtitle="Reusable UI building blocks used by recipes and task packets."
        actions={
          <div className="search-input">
            <span className="search-glyph" aria-hidden="true">{Icon.search()}</span>
            <input type="text" aria-label="Search components" placeholder="Search components…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        }
      />

      <div className="card-grid">
        {curatedVisible.map((component) => (
          <article key={component.id} className="panel component-card">
            <div className="component-demo">{component.demo}</div>
            <h2 style={{ fontSize: 14 }}>{component.title}</h2>
            <p className="panel-desc" style={{ marginBottom: 4 }}>{component.body}</p>
            <code className="muted" style={{ fontSize: 11 }}>{component.id}</code>
          </article>
        ))}
      </div>

      <section className="panel" aria-labelledby="manifest-heading">
        <div className="hstack between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 id="manifest-heading">Full manifest reference</h2>
            <p className="panel-desc" style={{ marginBottom: 0 }}>
              {ALL_COMPONENTS.length} components across {CATEGORIES.length} categories, generated from{' '}
              <code>standards/component-manifest.json</code> ({catalog.standardsVersion}).
            </p>
          </div>
          <label className="sr-only" htmlFor="category-filter">Filter by category</label>
          <select
            id="category-filter"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              background: 'var(--semantic-surface-inset)',
              color: 'var(--semantic-text-primary)',
              border: '1px solid var(--semantic-border-subtle)',
              borderRadius: 'var(--semantic-radius-md)',
              minHeight: 'var(--semantic-density-compact-control-height)',
              padding: '0 var(--semantic-spacing-3)',
            }}
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <table className="data-table" style={{ marginTop: 12 }}>
          <caption className="sr-only">Component manifest</caption>
          <thead>
            <tr><th scope="col">ID</th><th scope="col">Name</th><th scope="col">Category</th><th scope="col">Status</th><th scope="col">Description</th></tr>
          </thead>
          <tbody>
            {manifestVisible.length === 0 && (
              <tr><td colSpan={5} className="secondary-text">No components match the current search/filter.</td></tr>
            )}
            {manifestVisible.map((c) => (
              <tr key={c.id}>
                <td><code>{c.id}</code></td>
                <td>{c.name}</td>
                <td className="secondary-text">{CATEGORIES.find((cat) => cat.id === c.category)?.name ?? c.category}</td>
                <td><span className={c.status === 'required' ? 'badge badge-info' : 'badge badge-neutral'}>{c.status}</span></td>
                <td className="secondary-text" style={{ fontSize: 13 }}>{c.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="info-banner">
        <span aria-hidden="true">ⓘ</span>
        These components are referenced in task packets and templates. This is a reference, not a Storybook-style
        playground.
      </div>
    </>
  )
}
