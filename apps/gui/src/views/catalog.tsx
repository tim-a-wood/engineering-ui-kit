/**
 * Curated references per PRD §13.8/§13.9: the five approved recipes (usable —
 * a recipe prefills the task packet) and the eight curated components with
 * live token-styled demos, plus a compact searchable reference over the full
 * 68-component manifest (generated from standards/component-manifest.json).
 */

import { useMemo, useState, type ReactElement } from 'react'
import { EmptyState, PageHeader } from '../components'
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
      <section className="panel" aria-label="Recipe catalog">
        <div className="panel-head">
          <h2>Screen recipes</h2>
          <span className="muted num" style={{ fontSize: 11.5 }}>{visible.length} of {RECIPES.length}</span>
        </div>
        <ul className="row-list">
          {visible.map((recipe) => (
            <li key={recipe.id} className="row-item recipe-row">
              {recipe.thumbnail}
              <div className="row-copy">
                <h3>{recipe.title}</h3>
                <p>{recipe.description}</p>
                <p className="muted num" style={{ marginTop: 3, fontSize: 11.5 }}>
                  <code>{recipe.id}</code> · {recipe.componentsUsed.length} components
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-compact"
                onClick={() => props.onUseRecipe(recipe)}
                title={props.hasActiveRun ? 'Prefill the task packet with this recipe' : 'Starts with this recipe when you begin a handoff'}
              >
                Use in Task Packet {Icon.chevronRight(12)}
              </button>
            </li>
          ))}
        </ul>
      </section>
      {!props.hasActiveRun && (
        <div className="info-banner">
          <span aria-hidden="true">{Icon.info(14)}</span>
          No handoff is in progress. Selecting a recipe stores it; start a handoff from Projects and the task packet
          will be prefilled from the recipe.
        </div>
      )}
      <div className="info-banner">
        <span aria-hidden="true">{Icon.info(14)}</span>
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
  {
    title: 'Button', body: 'Triggers actions and submits forms. Accent is reserved for the primary action.', id: 'CMP-ACTION-BUTTON',
    demo: (
      <span className="hstack">
        <button type="button" className="btn btn-primary btn-compact">Primary</button>
        <button type="button" className="btn btn-secondary btn-compact">Secondary</button>
      </span>
    ),
  },
  {
    title: 'Status', body: 'Routine statuses are a dot plus text; tinted pills are reserved for prominent run states.', id: 'CMP-FEEDBACK-BADGE',
    demo: (
      <span className="stack" style={{ gap: 8, alignItems: 'flex-start' }}>
        <span className="status status-ok"><span className="status-dot" aria-hidden="true" /> Passed</span>
        <span className="status status-warning"><span className="status-dot" aria-hidden="true" /> Warning</span>
        <span className="status status-danger"><span className="status-dot" aria-hidden="true" /> Blocked</span>
        <span className="badge badge-info"><span className="badge-dot" aria-hidden="true" /> Run active</span>
      </span>
    ),
  },
  {
    title: 'Data Table', body: 'Dense rows, hairline separators, uppercase headers, dot + text status.', id: 'CMP-TABLE-DATA',
    demo: (
      <table className="data-table" style={{ fontSize: 12 }}>
        <thead><tr><th>Name</th><th>Role</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td>Jane Cooper</td><td className="secondary-text">Owner</td><td><span className="status status-ok"><span className="status-dot" aria-hidden="true" /> Active</span></td></tr>
          <tr><td>Cody Fisher</td><td className="secondary-text">Editor</td><td><span className="status status-neutral"><span className="status-dot" aria-hidden="true" /> Invited</span></td></tr>
        </tbody>
      </table>
    ),
  },
  { title: 'Tabs', body: 'Machined segmented control: inset track, raised active segment.', id: 'CMP-NAV-TABS', demo: <DemoTabs /> },
  { title: 'Input', body: 'Collects and validates user input.', id: 'CMP-FORM-INPUT', demo: <div className="field" style={{ margin: 0, width: '100%' }}><input type="text" placeholder="Enter your email" aria-label="Example input" /><p className="muted" style={{ margin: 0, fontSize: 11 }}>We'll never share your email.</p></div> },
  {
    title: 'Panel', body: 'Groups related content in a contained area.', id: 'CMP-SURFACE-PANEL',
    demo: <div className="panel" style={{ width: '100%', padding: 12 }}><strong style={{ fontSize: 12 }}>Project Overview</strong><p className="muted" style={{ margin: 0, fontSize: 11 }}>Bounded region on the panel surface with a hairline border.</p></div>,
  },
  {
    title: 'Page Header', body: 'Toolbar-like header row with a bottom hairline, not a hero title.', id: 'CMP-SHELL-PAGE-HEADER',
    demo: (
      <div style={{ width: '100%', borderBottom: '1px solid var(--semantic-border-subtle)', paddingBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="hstack"><strong style={{ fontSize: 13 }}>Page Title</strong><span className="muted" style={{ fontSize: 11.5 }}>Scope · context</span></span>
        <button type="button" className="btn btn-primary btn-compact">Action</button>
      </div>
    ),
  },
  {
    title: 'Progress', body: 'Shows completion status of a task; the numeral is tabular.', id: 'CMP-FEEDBACK-PROGRESS',
    demo: (
      <div className="hstack" style={{ width: '100%' }} aria-label="Progress: 60 percent">
        <div className="demo-progress-track">
          <div className="demo-progress-fill" style={{ width: '60%' }} />
        </div>
        <span className="mono num" style={{ fontSize: 11 }}>60%</span>
      </div>
    ),
  },
  {
    title: 'Alert', body: 'Prominent message for important contextual feedback.', id: 'CMP-FEEDBACK-ALERT',
    demo: (
      <div className="status-line status-error" style={{ width: '100%' }} role="note">
        <span><span className="status-label">Warning:</span> review the overlay warnings before applying.</span>
      </div>
    ),
  },
  {
    title: 'Toast', body: 'Temporary non-blocking system feedback.', id: 'CMP-FEEDBACK-TOAST',
    demo: (
      <div className="status-line status-success" style={{ width: '100%' }} role="status">
        <span className="status status-ok"><span className="status-dot" aria-hidden="true" /> Packet exported</span>
      </div>
    ),
  },
  {
    title: 'Breadcrumbs', body: 'Hierarchical location context for nested records.', id: 'CMP-NAV-BREADCRUMBS',
    demo: (
      <nav className="crumbs" aria-label="Breadcrumb demo" style={{ margin: 0 }}>
        <span className="crumb">Projects</span>
        <span className="crumb-sep" aria-hidden="true">{Icon.chevronRight(11)}</span>
        <span className="crumb">sample-app</span>
        <span className="crumb-sep" aria-hidden="true">{Icon.chevronRight(11)}</span>
        <span className="crumb-current num" style={{ color: 'var(--semantic-text-primary)' }}>Run 42</span>
      </nav>
    ),
  },
  {
    title: 'Empty State', body: 'Clear guidance when a panel or table has no data.', id: 'CMP-CONTENT-EMPTY-STATE',
    demo: (
      <div className="empty-state" style={{ padding: 0 }}>
        <span className="empty-icon" aria-hidden="true">{Icon.inbox(24)}</span>
        <p className="empty-title">No runs yet</p>
        <p className="empty-hint">Start a handoff to see it here.</p>
      </div>
    ),
  },
  {
    title: 'Icon Button', body: '28×28 icon-only action; the CSS tooltip carries its label.', id: 'CMP-ACTION-ICON-BUTTON',
    demo: (
      <span className="hstack" style={{ gap: 4 }}>
        <button type="button" className="icon-btn" aria-label="Copy" data-tip="Copy">{Icon.copy()}</button>
        <button type="button" className="icon-btn" aria-label="Download" data-tip="Download">{Icon.download()}</button>
        <button type="button" className="icon-btn icon-btn-outline" aria-label="Help" data-tip="Help">{Icon.help()}</button>
      </span>
    ),
  },
  {
    title: 'Checkbox & Radio', body: '16px selection controls: accent fill with a white check or dot.', id: 'CMP-FORM-CHECKBOX',
    demo: (
      <span className="stack" style={{ gap: 8, alignItems: 'flex-start' }}>
        <label className="hstack" style={{ fontSize: 12, cursor: 'pointer' }}>
          <input type="checkbox" defaultChecked /> Accept overwrite warnings
        </label>
        <label className="hstack" style={{ fontSize: 12, cursor: 'pointer' }}>
          <input type="radio" name="demo-radio" defaultChecked /> Flat file (recommended)
        </label>
        <label className="hstack" style={{ fontSize: 12, cursor: 'pointer' }}>
          <input type="radio" name="demo-radio" /> Structured (JSON)
        </label>
      </span>
    ),
  },
  { title: 'Switch', body: 'Immediate binary setting toggle.', id: 'CMP-FORM-SWITCH', demo: <DemoSwitch /> },
  {
    title: 'Select', body: 'Selection from a constrained list of values.', id: 'CMP-FORM-SELECT',
    demo: (
      <div className="field" style={{ margin: 0, width: '100%', maxWidth: 260 }}>
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

      <section className="panel specimen-panel" aria-label="Curated component specimens">
        <div className="specimen-grid">
          {curatedVisible.map((component) => (
            <article key={component.id} className="specimen">
              <div className="specimen-head">
                <h2 className="specimen-name">{component.title}</h2>
                <code className="specimen-id">{component.id}</code>
              </div>
              <div className="specimen-stage">{component.demo}</div>
              <p className="specimen-note">{component.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel panel-flush" aria-labelledby="manifest-heading">
        <div className="panel-head" style={{ margin: 0 }}>
          <div>
            <h2 id="manifest-heading">Full manifest reference</h2>
            <p className="panel-desc" style={{ marginBottom: 0 }}>
              Generated from <code>standards/component-manifest.json</code> ({catalog.standardsVersion}).
            </p>
          </div>
        </div>
        <div className="table-toolbar">
          <label className="sr-only" htmlFor="category-filter">Filter by category</label>
          <select
            id="category-filter"
            className="select-control"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span className="table-toolbar-spacer" />
          <span className="toolbar-count">
            {manifestVisible.length} of {ALL_COMPONENTS.length} components · {CATEGORIES.length} categories
          </span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <caption className="sr-only">Component manifest</caption>
            <thead>
              <tr><th scope="col">ID</th><th scope="col">Name</th><th scope="col">Category</th><th scope="col">Status</th><th scope="col">Description</th></tr>
            </thead>
            <tbody>
              {manifestVisible.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 0 }}>
                    <EmptyState
                      icon={Icon.search(24)}
                      title="No components match"
                      hint="Clear the search or pick a different category."
                    />
                  </td>
                </tr>
              )}
              {manifestVisible.map((c) => (
                <tr key={c.id}>
                  <td><code>{c.id}</code></td>
                  <td>{c.name}</td>
                  <td className="secondary-text">{CATEGORIES.find((cat) => cat.id === c.category)?.name ?? c.category}</td>
                  <td>
                    <span className={c.status === 'required' ? 'status status-info' : 'status status-neutral'}>
                      <span className="status-dot" aria-hidden="true" /> {c.status}
                    </span>
                  </td>
                  <td className="secondary-text" style={{ fontSize: 12 }}>{c.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="info-banner">
        <span aria-hidden="true">{Icon.info(14)}</span>
        These components are referenced in task packets and templates. This is a reference, not a Storybook-style
        playground.
      </div>
    </>
  )
}
