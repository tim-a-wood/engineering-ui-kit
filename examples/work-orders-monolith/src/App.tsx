/**
 * PlantOps — a deliberately plain, fully usable multi-page work-order monolith.
 * Sample target app for Engineering UI Kit handoffs: hash routing (evidence
 * views can target #/routes), forms, tables, filters, inline SVG icons and
 * charts, localStorage persistence. No dependencies beyond React.
 */

import { useEffect, useMemo, useState, type ReactElement } from 'react'
import {
  loadState, saveState, nextOrderId, SEED,
  type AppState, type Asset, type OrderPriority, type OrderStatus, type WorkOrder,
} from './data'

type Route =
  | { page: 'dashboard' }
  | { page: 'orders' }
  | { page: 'order'; id: string | null } // null = new
  | { page: 'assets' }
  | { page: 'reports' }
  | { page: 'settings' }

function parseHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, '')
  if (h === '' || h === 'dashboard') return { page: 'dashboard' }
  if (h === 'orders') return { page: 'orders' }
  if (h === 'orders/new') return { page: 'order', id: null }
  if (h.startsWith('orders/')) return { page: 'order', id: h.slice('orders/'.length) }
  if (h === 'assets') return { page: 'assets' }
  if (h === 'reports') return { page: 'reports' }
  if (h === 'settings') return { page: 'settings' }
  return { page: 'dashboard' }
}

const go = (hash: string) => { window.location.hash = hash }

/* Small inline icon set (kept inline on purpose — census-rich markup). */
const ic = {
  wrench: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.9 2.9-2.1-2.1 2.9-2.9z" />
    </svg>
  ),
  pump: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="6" /><path d="M12 6V2M12 22v-4M2 12h4M18 12h4" />
    </svg>
  ),
  motor: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="8" width="14" height="10" /><path d="M17 11h4v4h-4M6 8V5h8v3" />
    </svg>
  ),
  conveyor: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="2" y="10" width="20" height="5" rx="2.5" /><circle cx="7" cy="12.5" r="1" /><circle cx="12" cy="12.5" r="1" /><circle cx="17" cy="12.5" r="1" />
    </svg>
  ),
  sensor: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="14" r="3" /><path d="M5 14a7 7 0 0 1 14 0M2 14a10 10 0 0 1 20 0" />
    </svg>
  ),
  hvac: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="4" width="18" height="14" /><path d="M7 8h10M7 11h10M7 14h6M3 21h18" />
    </svg>
  ),
  alert: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 3 2 20h20L12 3zM12 10v4M12 17.5v.5" />
    </svg>
  ),
}

const assetIcon = (kind: Asset['kind']): ReactElement =>
  kind === 'pump' ? ic.pump : kind === 'motor' ? ic.motor : kind === 'conveyor' ? ic.conveyor : kind === 'sensor' ? ic.sensor : ic.hvac

const STATUS_LABEL: Record<OrderStatus, string> = { 'open': 'Open', 'in-progress': 'In progress', 'blocked': 'Blocked', 'done': 'Done' }

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash)
  const [state, setState] = useState<AppState>(loadState)

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const update = (mutate: (draft: AppState) => AppState) => {
    setState((current) => {
      const next = mutate(current)
      saveState(next)
      return next
    })
  }

  const nav = (
    <nav className="mainnav">
      {([
        ['dashboard', 'Dashboard'], ['orders', 'Work Orders'], ['assets', 'Assets'],
        ['reports', 'Reports'], ['settings', 'Settings'],
      ] as const).map(([key, label]) => (
        <a
          key={key}
          href={`#/${key}`}
          className={route.page === key || (key === 'orders' && route.page === 'order') ? 'active' : ''}
        >
          {label}
        </a>
      ))}
    </nav>
  )

  return (
    <>
      <div className="topbar">
        <span aria-hidden="true">{ic.wrench}</span>
        <h1>PlantOps Maintenance</h1>
        <span className="site">{state.settings.siteName} · logged in as supervisor</span>
      </div>
      {nav}
      <div className="page">
        {route.page === 'dashboard' && <Dashboard state={state} />}
        {route.page === 'orders' && <Orders state={state} />}
        {route.page === 'order' && <OrderForm key={route.id ?? 'new'} state={state} id={route.id} update={update} />}
        {route.page === 'assets' && <Assets state={state} />}
        {route.page === 'reports' && <Reports state={state} />}
        {route.page === 'settings' && <SettingsPage state={state} update={update} />}
      </div>
      <div className="footer">PlantOps v3.2.1 — internal maintenance tracking. For urgent failures call the control room (ext. 210).</div>
    </>
  )
}

function Dashboard(props: { state: AppState }) {
  const { orders, assets } = props.state
  const open = orders.filter((o) => o.status !== 'done')
  const overdue = open.filter((o) => o.dueDate < new Date().toISOString().slice(0, 10))
  const critical = open.filter((o) => o.priority === 'critical')
  const downAssets = assets.filter((a) => a.health === 'down')

  return (
    <>
      <h2>Dashboard</h2>
      <div className="kpis">
        <div className="kpi"><div className="num">{open.length}</div><div className="lbl">Open work orders</div></div>
        <div className="kpi"><div className="num">{overdue.length}</div><div className="lbl">Overdue</div></div>
        <div className="kpi"><div className="num">{critical.length}</div><div className="lbl">Critical priority</div></div>
        <div className="kpi"><div className="num">{downAssets.length}</div><div className="lbl">Assets down</div></div>
      </div>

      {(critical.length > 0 || downAssets.length > 0) && (
        <div className="box" style={{ borderColor: '#d48282', background: '#fff5f5' }}>
          <strong style={{ color: '#9c1a1a' }}><span aria-hidden="true">{ic.alert}</span> Attention</strong>
          <ul style={{ margin: '6px 0 0' }}>
            {critical.map((o) => <li key={o.id}><a href={`#/orders/${o.id}`}>{o.id}</a> {o.title}</li>)}
            {downAssets.map((a) => <li key={a.id}>{a.name} is DOWN ({a.location})</li>)}
          </ul>
        </div>
      )}

      <div className="box">
        <h3 style={{ marginTop: 0 }}>Recent work orders</h3>
        <table className="grid">
          <thead>
            <tr><th>ID</th><th>Title</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Due</th></tr>
          </thead>
          <tbody>
            {orders.slice(0, 6).map((o) => (
              <tr key={o.id} className="clickable" onClick={() => go(`#/orders/${o.id}`)}>
                <td>{o.id}</td><td>{o.title}</td>
                <td><span className={`badge ${o.status}`}>{STATUS_LABEL[o.status]}</span></td>
                <td><span className={`badge ${o.priority}`}>{o.priority}</span></td>
                <td>{o.assignee}</td><td>{o.dueDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="primary" onClick={() => go('#/orders/new')}>+ New Work Order</button>
    </>
  )
}

function Orders(props: { state: AppState }) {
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | OrderPriority>('all')
  const [search, setSearch] = useState('')

  const rows = useMemo(() => props.state.orders.filter((o) =>
    (statusFilter === 'all' || o.status === statusFilter) &&
    (priorityFilter === 'all' || o.priority === priorityFilter) &&
    (search.trim() === '' || `${o.id} ${o.title} ${o.assignee}`.toLowerCase().includes(search.toLowerCase())),
  ), [props.state.orders, statusFilter, priorityFilter, search])

  return (
    <>
      <h2>Work Orders</h2>
      <div className="toolbar">
        <label>Status:{' '}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | OrderStatus)}>
            <option value="all">All</option>
            <option value="open">Open</option><option value="in-progress">In progress</option>
            <option value="blocked">Blocked</option><option value="done">Done</option>
          </select>
        </label>
        <label>Priority:{' '}
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as 'all' | OrderPriority)}>
            <option value="all">All</option>
            <option value="low">Low</option><option value="medium">Medium</option>
            <option value="high">High</option><option value="critical">Critical</option>
          </select>
        </label>
        <input type="text" placeholder="Search id, title, assignee…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <span className="spacer" />
        <button className="primary" onClick={() => go('#/orders/new')}>+ New Work Order</button>
      </div>
      <table className="grid">
        <thead>
          <tr><th>ID</th><th>Title</th><th>Asset</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Due</th></tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id} className="clickable" onClick={() => go(`#/orders/${o.id}`)}>
              <td>{o.id}</td><td>{o.title}</td>
              <td>{props.state.assets.find((a) => a.id === o.assetId)?.name ?? o.assetId}</td>
              <td><span className={`badge ${o.status}`}>{STATUS_LABEL[o.status]}</span></td>
              <td><span className={`badge ${o.priority}`}>{o.priority}</span></td>
              <td>{o.assignee}</td><td>{o.dueDate}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div className="empty">No work orders match the current filters.</div>}
    </>
  )
}

function OrderForm(props: { state: AppState; id: string | null; update: (m: (d: AppState) => AppState) => void }) {
  const existing = props.id ? props.state.orders.find((o) => o.id === props.id) : undefined
  const [draft, setDraft] = useState<WorkOrder>(existing ?? {
    id: nextOrderId(props.state.orders),
    title: '', assetId: props.state.assets[0]?.id ?? '', status: 'open', priority: 'medium',
    assignee: 'Unassigned', dueDate: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
    createdAt: new Date().toISOString().slice(0, 10), description: '',
  })
  const [error, setError] = useState('')
  if (props.id && !existing) return <div className="empty">Work order {props.id} was not found.</div>

  const set = <K extends keyof WorkOrder>(key: K, value: WorkOrder[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const save = () => {
    if (!draft.title.trim()) { setError('Title is required.'); return }
    props.update((s) => ({
      ...s,
      orders: existing ? s.orders.map((o) => (o.id === draft.id ? draft : o)) : [draft, ...s.orders],
    }))
    go('#/orders')
  }

  const remove = () => {
    props.update((s) => ({ ...s, orders: s.orders.filter((o) => o.id !== draft.id) }))
    go('#/orders')
  }

  return (
    <>
      <h2>{existing ? `Edit ${draft.id}` : 'New Work Order'}</h2>
      <div className="box">
        <div className="formrow"><label htmlFor="wo-title">Title *</label>
          <input id="wo-title" type="text" value={draft.title} onChange={(e) => set('title', e.target.value)} /></div>
        <div className="formrow"><label htmlFor="wo-asset">Asset</label>
          <select id="wo-asset" value={draft.assetId} onChange={(e) => set('assetId', e.target.value)}>
            {props.state.assets.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.id})</option>)}
          </select></div>
        <div className="formrow"><label htmlFor="wo-status">Status</label>
          <select id="wo-status" value={draft.status} onChange={(e) => set('status', e.target.value as OrderStatus)}>
            <option value="open">Open</option><option value="in-progress">In progress</option>
            <option value="blocked">Blocked</option><option value="done">Done</option>
          </select></div>
        <div className="formrow"><label htmlFor="wo-priority">Priority</label>
          <select id="wo-priority" value={draft.priority} onChange={(e) => set('priority', e.target.value as OrderPriority)}>
            <option value="low">Low</option><option value="medium">Medium</option>
            <option value="high">High</option><option value="critical">Critical</option>
          </select></div>
        <div className="formrow"><label htmlFor="wo-assignee">Assignee</label>
          <input id="wo-assignee" type="text" value={draft.assignee} onChange={(e) => set('assignee', e.target.value)} /></div>
        <div className="formrow"><label htmlFor="wo-due">Due date</label>
          <input id="wo-due" type="date" value={draft.dueDate} onChange={(e) => set('dueDate', e.target.value)} /></div>
        <div className="formrow"><label htmlFor="wo-desc">Description</label>
          <div>
            <textarea id="wo-desc" rows={5} value={draft.description} onChange={(e) => set('description', e.target.value)} />
            <p className="hint">Include symptoms, parts, and safety notes. Plain text only.</p>
          </div></div>
        {error && <p style={{ color: '#9c1a1a' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="primary" onClick={save}>{existing ? 'Save Changes' : 'Create Work Order'}</button>
          <button onClick={() => go('#/orders')}>Cancel</button>
          {existing && <button className="danger" onClick={remove} style={{ marginLeft: 'auto' }}>Delete</button>}
        </div>
      </div>
    </>
  )
}

function Assets(props: { state: AppState }) {
  const openByAsset = (assetId: string) => props.state.orders.filter((o) => o.assetId === assetId && o.status !== 'done').length
  return (
    <>
      <h2>Assets</h2>
      <div className="assetgrid">
        {props.state.assets.map((a) => (
          <div key={a.id} className="asset">
            <span className="ic" aria-hidden="true">{assetIcon(a.kind)}</span>
            <div>
              <h4>{a.name}</h4>
              <p>{a.id} · {a.location} · <span className={`health-${a.health}`}>{a.health.toUpperCase()}</span></p>
              <p>{openByAsset(a.id)} open work order(s)</p>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function Reports(props: { state: AppState }) {
  const byStatus = (['open', 'in-progress', 'blocked', 'done'] as const).map((s) => ({
    status: s, count: props.state.orders.filter((o) => o.status === s).length,
  }))
  const max = Math.max(1, ...byStatus.map((b) => b.count))
  const barColors: Record<OrderStatus, string> = { 'open': '#3f6db3', 'in-progress': '#d4a017', 'blocked': '#c0392b', 'done': '#27862c' }

  // Fake weekly completion trend derived from seed sizes so the chart is stable.
  const weekly = [3, 5, 2, 6, 4, props.state.orders.filter((o) => o.status === 'done').length]
  const maxW = Math.max(...weekly, 1)
  const points = weekly.map((v, i) => `${20 + i * 52},${120 - (v / maxW) * 95}`).join(' ')

  return (
    <>
      <h2>Reports</h2>
      <div className="chartrow">
        <div className="chart">
          <h4>Work orders by status</h4>
          <svg width="320" height="150" viewBox="0 0 320 150" role="img" aria-label="Bar chart of work orders by status">
            {byStatus.map((b, i) => (
              <g key={b.status}>
                <rect x={20 + i * 75} y={120 - (b.count / max) * 95} width="44" height={(b.count / max) * 95} fill={barColors[b.status]} />
                <text x={42 + i * 75} y={135} textAnchor="middle" fontSize="9">{STATUS_LABEL[b.status]}</text>
                <text x={42 + i * 75} y={115 - (b.count / max) * 95} textAnchor="middle" fontSize="10" fontWeight="bold">{b.count}</text>
              </g>
            ))}
            <line x1="15" y1="120" x2="315" y2="120" stroke="#999" />
          </svg>
        </div>
        <div className="chart">
          <h4>Completions per week</h4>
          <svg width="320" height="150" viewBox="0 0 320 150" role="img" aria-label="Line chart of completions per week">
            <polyline points={points} fill="none" stroke="#3f6db3" strokeWidth="2" />
            {weekly.map((v, i) => (
              <circle key={i} cx={20 + i * 52} cy={120 - (v / maxW) * 95} r="3" fill="#2c5aa0" />
            ))}
            <line x1="15" y1="120" x2="315" y2="120" stroke="#999" />
            <text x="20" y="135" fontSize="9">6 weeks ago</text>
            <text x="290" y="135" fontSize="9" textAnchor="end">now</text>
          </svg>
        </div>
      </div>
      <div className="box">
        <h3 style={{ marginTop: 0 }}>Totals</h3>
        <table className="grid" style={{ maxWidth: 420 }}>
          <thead><tr><th>Status</th><th>Count</th></tr></thead>
          <tbody>
            {byStatus.map((b) => (
              <tr key={b.status}><td>{STATUS_LABEL[b.status]}</td><td>{b.count}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function SettingsPage(props: { state: AppState; update: (m: (d: AppState) => AppState) => void }) {
  const [draft, setDraft] = useState(props.state.settings)
  const [saved, setSaved] = useState(false)
  return (
    <>
      <h2>Settings</h2>
      <div className="box" style={{ maxWidth: 560 }}>
        <div className="formrow"><label htmlFor="set-site">Site name</label>
          <input id="set-site" type="text" value={draft.siteName} onChange={(e) => setDraft({ ...draft, siteName: e.target.value })} /></div>
        <div className="formrow"><label>Notifications</label>
          <div>
            <label style={{ display: 'block', width: 'auto' }}>
              <input type="checkbox" checked={draft.emailAlerts} onChange={(e) => setDraft({ ...draft, emailAlerts: e.target.checked })} /> Email alerts for critical orders
            </label>
            <label style={{ display: 'block', width: 'auto' }}>
              <input type="checkbox" checked={draft.dailyDigest} onChange={(e) => setDraft({ ...draft, dailyDigest: e.target.checked })} /> Daily digest
            </label>
          </div></div>
        <div className="formrow"><label htmlFor="set-retention">Record retention</label>
          <select id="set-retention" value={draft.retentionDays} onChange={(e) => setDraft({ ...draft, retentionDays: Number(e.target.value) })}>
            <option value={90}>90 days</option><option value={180}>180 days</option><option value={365}>1 year</option><option value={1095}>3 years</option>
          </select></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="primary"
            onClick={() => { props.update((s) => ({ ...s, settings: draft })); setSaved(true); window.setTimeout(() => setSaved(false), 2000) }}
          >
            Save Settings
          </button>
          <button onClick={() => { localStorage.clear(); window.location.reload() }}>Reset demo data</button>
          {saved && <span style={{ color: '#1d6d1d', paddingTop: 5 }}>Saved.</span>}
        </div>
        <p className="hint" style={{ fontSize: 11, color: '#777' }}>
          Reset restores the seeded demo state ({SEED.orders.length} orders, {SEED.assets.length} assets).
        </p>
      </div>
    </>
  )
}
