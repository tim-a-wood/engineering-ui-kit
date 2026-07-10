/**
 * App shell: sidebar navigation, offline/update banners, routed views.
 * Studies load once here (the app's single remote region) and refresh after
 * every mutation; views receive the list, connection state, and a refresh.
 */

import { useCallback, useEffect, useState } from 'react'
import type { Study } from '../shared/model'
import { listStudies } from './api'
import { href, useRoute } from './router'
import { StudiesList } from './views/StudiesList'
import { StudyBuilder } from './views/StudyBuilder'
import { StudyDetail } from './views/StudyDetail'
import { Comparison } from './views/Comparison'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; studies: Study[] }

export function App() {
  const route = useRoute()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [online, setOnline] = useState(navigator.onLine)
  const [updateReady, setUpdateReady] = useState<ServiceWorkerRegistration | null>(null)
  const [navCollapsed, setNavCollapsed] = useState(() => localStorage.getItem('aerostudy:nav-collapsed') === '1')
  const toggleNav = () => setNavCollapsed((collapsed) => {
    localStorage.setItem('aerostudy:nav-collapsed', collapsed ? '0' : '1')
    return !collapsed
  })

  const refresh = useCallback(async () => {
    try {
      const studies = await listStudies()
      setState({ status: 'ready', studies })
      setOnline(true)
    } catch (error) {
      // The service worker serves cached data offline; a hard failure here
      // means neither network nor cache could answer.
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
    window.addEventListener('aerostudy:update-ready', onUpdate)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('aerostudy:update-ready', onUpdate)
    }
  }, [refresh])

  const reloadForUpdate = () => {
    updateReady?.waiting?.postMessage('SKIP_WAITING')
    window.setTimeout(() => window.location.reload(), 150)
  }

  const nav = [
    { label: 'Studies', description: 'Registry & tradeoffs', initial: 'St', target: href.list, active: route.view === 'list' || route.view === 'detail' || route.view === 'compare' },
    { label: 'New study', description: 'Sweep & compare builder', initial: '+', target: href.create, active: route.view === 'new' || route.view === 'edit' },
  ]

  return (
    <div className={navCollapsed ? 'app-shell nav-collapsed' : 'app-shell'}>
      <a className="skip-link" href="#main">Skip to content</a>
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">AS</span>
          <div>
            <strong>AeroStudy</strong>
            <small>Trade-study workbench</small>
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
          <small>Port 4181 · JSON persistence</small>
        </div>
      </aside>

      <div className="content-shell">
        {!online && (
          <div className="offline-banner" role="status">
            Offline — showing last-synced studies (read-only). Mutations are disabled until the connection returns.
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
            <div className="remote-state" role="status"><strong>Loading studies…</strong><span>Reading the local study registry.</span></div>
          )}
          {state.status === 'error' && (
            <div className="remote-state" role="alert">
              <strong>Couldn't load studies</strong>
              <span>{state.message}</span>
              <button type="button" className="button secondary" onClick={() => { setState({ status: 'loading' }); void refresh() }}>Retry</button>
            </div>
          )}
          {state.status === 'ready' && <RoutedView studies={state.studies} online={online} refresh={refresh} />}
        </main>
      </div>
    </div>
  )
}

function RoutedView(props: { studies: Study[]; online: boolean; refresh: () => Promise<void> }) {
  const route = useRoute()
  switch (route.view) {
    case 'list':
      return <StudiesList studies={props.studies} online={props.online} refresh={props.refresh} />
    case 'new':
      return <StudyBuilder studies={props.studies} online={props.online} refresh={props.refresh} />
    case 'edit':
      return <StudyBuilder id={route.id} studies={props.studies} online={props.online} refresh={props.refresh} />
    case 'detail':
      return <StudyDetail id={route.id} studies={props.studies} online={props.online} refresh={props.refresh} />
    case 'compare':
      return <Comparison ids={route.ids} studies={props.studies} />
  }
}
