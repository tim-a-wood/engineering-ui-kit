/**
 * App shell: collapsible primary navigation (LAY-SHELL-001), offline/update
 * banners, routed views. Cases and runways load once here and refresh after
 * every mutation.
 */

import { useCallback, useEffect, useState } from 'react'
import type { PerformanceCase, Runway } from '../shared/model'
import { loadData } from './api'
import { href, useRoute } from './router'
import { Dashboard } from './views/Dashboard'
import { Calculator } from './views/Calculator'
import { Cases } from './views/Cases'
import { Compare } from './views/Compare'
import { Runways } from './views/Runways'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; cases: PerformanceCase[]; runways: Runway[] }

export function App() {
  const route = useRoute()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [online, setOnline] = useState(navigator.onLine)
  const [updateReady, setUpdateReady] = useState<ServiceWorkerRegistration | null>(null)
  const [navCollapsed, setNavCollapsed] = useState(() => localStorage.getItem('aeroplan:nav-collapsed') === '1')

  const toggleNav = () => setNavCollapsed((collapsed) => {
    localStorage.setItem('aeroplan:nav-collapsed', collapsed ? '0' : '1')
    return !collapsed
  })

  const refresh = useCallback(async () => {
    try {
      const data = await loadData()
      setState({ status: 'ready', cases: data.cases, runways: data.runways })
      setOnline(true)
    } catch (error) {
      if (navigator.onLine === false) setOnline(false)
      setState((prev) => prev.status === 'ready'
        ? prev
        : { status: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  useEffect(() => {
    const onOnline = () => { setOnline(true); void refresh() }
    const onOffline = () => setOnline(false)
    const onUpdate = (event: Event) => setUpdateReady((event as CustomEvent<ServiceWorkerRegistration>).detail)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('aeroplan:update-ready', onUpdate)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('aeroplan:update-ready', onUpdate)
    }
  }, [refresh])

  const reloadForUpdate = () => {
    updateReady?.waiting?.postMessage('SKIP_WAITING')
    window.setTimeout(() => window.location.reload(), 150)
  }

  const nav = [
    { label: 'Dashboard', description: 'Fleet review', initial: 'D', target: href.dashboard, active: route.view === 'dashboard' },
    { label: 'Calculator', description: 'Plan a case', initial: 'C', target: href.calculator, active: route.view === 'calculator' },
    { label: 'Saved cases', description: 'Registry & chart', initial: 'S', target: href.cases, active: route.view === 'cases' || route.view === 'compare' },
    { label: 'Runway library', description: 'Managed records', initial: 'R', target: href.runways, active: route.view === 'runways' },
  ]

  return (
    <div className={navCollapsed ? 'app-shell nav-collapsed' : 'app-shell'}>
      <a className="skip-link" href="#main">Skip to content</a>
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">AP</span>
          <div>
            <strong>AeroPlan</strong>
            <small>Performance planning</small>
          </div>
        </div>
        <nav>
          <ul>
            {nav.map((item) => (
              <li key={item.label}>
                <a
                  className={item.active ? 'nav-item active' : 'nav-item'}
                  aria-current={item.active ? 'page' : undefined}
                  aria-label={item.label}
                  title={navCollapsed ? item.label : undefined}
                  href={item.target}
                >
                  <span className="nav-initial" aria-hidden="true">{item.initial}</span>
                  <strong>{item.label}</strong>
                  <span className="nav-desc">{item.description}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <button
          type="button"
          className="nav-toggle"
          onClick={toggleNav}
          aria-expanded={!navCollapsed}
          aria-label={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          title={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          <span aria-hidden="true">{navCollapsed ? '»' : '«'}</span>
          <span className="nav-toggle-label">Collapse</span>
        </button>
        <div className="sidebar-meta">
          <span>Local deployment</span>
          <strong className={online ? 'online' : 'offline'}>{online ? 'API connected' : 'Offline'}</strong>
          <small>Port 4180 · JSON persistence</small>
        </div>
      </aside>

      <div className="content-shell">
        {!online && (
          <div className="offline-banner" role="status">
            Offline — showing last-synced data (read-only). Mutations are disabled until the connection returns.
          </div>
        )}
        {updateReady && (
          <div className="update-banner" role="status">
            Update available —
            <button type="button" onClick={reloadForUpdate}>reload to apply</button>
          </div>
        )}

        <main id="main">
          <div className="limitation-banner">
            <strong>Planning-grade only.</strong>
            <span>No approved AFM/OEM data is used. Results must not be presented as approved aircraft performance.</span>
          </div>

          {state.status === 'loading' && (
            <div className="remote-state" role="status"><strong>Loading…</strong><span>Reading cases and runways from the local server.</span></div>
          )}
          {state.status === 'error' && (
            <div className="remote-state" role="alert">
              <strong>Couldn't load data</strong>
              <span>{state.message}</span>
              <button type="button" className="button secondary" onClick={() => { setState({ status: 'loading' }); void refresh() }}>Retry</button>
            </div>
          )}
          {state.status === 'ready' && (
            <RoutedView cases={state.cases} runways={state.runways} online={online} refresh={refresh} />
          )}
        </main>
      </div>
    </div>
  )
}

function RoutedView(props: { cases: PerformanceCase[]; runways: Runway[]; online: boolean; refresh: () => Promise<void> }) {
  const route = useRoute()
  switch (route.view) {
    case 'dashboard':
      return <Dashboard cases={props.cases} />
    case 'calculator':
      return <Calculator id={route.id} cases={props.cases} runways={props.runways} online={props.online} refresh={props.refresh} />
    case 'cases':
      return <Cases cases={props.cases} online={props.online} refresh={props.refresh} />
    case 'compare':
      return <Compare a={route.a} b={route.b} cases={props.cases} />
    case 'runways':
      return <Runways cases={props.cases} runways={props.runways} online={props.online} refresh={props.refresh} />
  }
}
