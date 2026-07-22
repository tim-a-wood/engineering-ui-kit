/**
 * Read-only architecture map (CAP-PKT-010 / CAP-DEC-006).
 * Responsibility lanes and isolated port routes keep the dependency view legible;
 * module cards open a shared detail dialog and retain keyboard navigation.
 */

import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react'
import type { ArchitectureNodeProjection, ArchitectureProjection, ArchitectureProjectionMode } from '@engineering-ui-kit/core'
import { focusArchitectureNeighbors } from '@engineering-ui-kit/core/browser'
import { Dialog } from '../../components'
import { humanizeIdentifier, moduleTypeLabel } from './capabilityPresentation'

type Props = {
  projection: ArchitectureProjection
  mode: ArchitectureProjectionMode
}

const STATUS_GLYPH: Record<string, string> = {
  ready: '✓', review: '◒', blocked: '!', failed: '×', draft: '○', proposed: '◇', unknown: '◇',
}

const ARCHITECTURE_TYPES = [
  { type: 'experience', label: 'Experience adapter' },
  { type: 'workflow', label: 'Application workflow' },
  { type: 'domain', label: 'Domain module' },
  { type: 'platform', label: 'Platform adapter' },
  { type: 'connection', label: 'External adapter' },
] as const

const ROLE_LANES = [
  { role: 'inbound-adapter', label: 'Inbound adapters', hint: 'User, API, CLI, or event entry points' },
  { role: 'application', label: 'Application', hint: 'Coordinates use cases and workflows' },
  { role: 'domain-core', label: 'Domain', hint: 'Business rules and core decisions' },
  { role: 'outbound-adapter', label: 'Outbound adapters', hint: 'Storage, platforms, and external systems' },
  { role: 'unassigned', label: 'Other', hint: 'Modules awaiting architectural placement' },
] as const

function ModuleDetails(props: {
  node: ArchitectureNodeProjection
  projection: ArchitectureProjection
  onClose: () => void
}) {
  const { node, projection } = props
  const incoming = projection.edges.filter((edge) => edge.to === node.id)
  const outgoing = projection.edges.filter((edge) => edge.from === node.id)
  return (
    <Dialog title={node.name} onClose={props.onClose} wide>
      <div className="architecture-detail-hero">
        <span className={`architecture-type architecture-type-${node.moduleType ?? 'unassigned'}`}>
          {moduleTypeLabel(node.moduleType ?? 'module')}
        </span>
        <span className={`architecture-status status-${node.statusIcon}`}>
          <span aria-hidden="true">{STATUS_GLYPH[node.statusIcon] ?? '◇'}</span> {node.statusLabel}
        </span>
      </div>
      <p className="architecture-responsibility">
        {node.responsibility || 'Responsibility will be refined during the module interview.'}
      </p>
      <dl className="architecture-detail-grid">
        <div><dt>Capability group</dt><dd>{node.purposeGroup}</dd></div>
        <div><dt>Architecture role</dt><dd>{node.laneLabel ?? 'Other modules'}</dd></div>
        <div><dt>Module ID</dt><dd><code>{node.id}</code></dd></div>
        {node.moduleVersion ? <div><dt>Version</dt><dd>{node.moduleVersion}</dd></div> : null}
        {node.runtimeAllocation ? <div><dt>Runtime</dt><dd>{humanizeIdentifier(node.runtimeAllocation)}</dd></div> : null}
      </dl>
      <div className="architecture-detail-columns">
        <section aria-label="Module port connections">
          <h3>Ports &amp; connections</h3>
          {incoming.length + outgoing.length === 0 ? <p className="capabilities-note">No direct dependencies.</p> : (
            <ul className="architecture-connection-list">
              {outgoing.map((edge) => (
                <li key={edge.id}><span className="architecture-direction">Uses</span><strong>{projection.nodes.find((item) => item.id === edge.to)?.name ?? edge.to}</strong><p>{edge.reason}</p></li>
              ))}
              {incoming.map((edge) => (
                <li key={edge.id}><span className="architecture-direction">Used by</span><strong>{projection.nodes.find((item) => item.id === edge.from)?.name ?? edge.from}</strong><p>{edge.reason}</p></li>
              ))}
            </ul>
          )}
        </section>
        <section aria-label="Module allocations">
          <h3>Operations &amp; adapters</h3>
          {node.toolsAndData.length ? <ul className="architecture-chip-list">{node.toolsAndData.map((item) => <li key={item}>{humanizeIdentifier(item)}</li>)}</ul> : <p className="capabilities-note">No operations or data allocations yet.</p>}
        </section>
      </div>
    </Dialog>
  )
}

export function ArchitectureView({ projection, mode }: Props) {
  const labelId = useId()
  const [selectedId, setSelectedId] = useState<string | null>(projection.nodes[0]?.id ?? null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const orderedIds = projection.nodes.map((node) => node.id)

  useEffect(() => {
    if (selectedId && !orderedIds.includes(selectedId)) setSelectedId(orderedIds[0] ?? null)
  }, [orderedIds, selectedId])

  const { focused, neighbors } = selectedId
    ? focusArchitectureNeighbors(projection, selectedId)
    : { focused: undefined, neighbors: [] }
  const neighborSet = new Set(neighbors.map((node) => node.id))
  const detailNode = projection.nodes.find((node) => node.id === detailId)
  const lanes = useMemo(() => ROLE_LANES
    .map((lane) => ({
      ...lane,
      nodes: projection.nodes
        .filter((node) => (node.architectureRole ?? 'unassigned') === lane.role)
        .sort((left, right) => left.name.localeCompare(right.name)),
    }))
    .filter((lane) => lane.nodes.length > 0), [projection.nodes])

  const routes = useMemo(() => projection.edges.map((edge) => ({
    ...edge,
    fromNode: projection.nodes.find((node) => node.id === edge.from),
    toNode: projection.nodes.find((node) => node.id === edge.to),
  })).filter((edge) => edge.fromNode && edge.toNode), [projection.edges, projection.nodes])

  const moveSelection = (delta: number) => {
    if (!orderedIds.length) return
    const current = selectedId ? orderedIds.indexOf(selectedId) : 0
    setSelectedId(orderedIds[(current + delta + orderedIds.length) % orderedIds.length]!)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault(); moveSelection(1)
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault(); moveSelection(-1)
    } else if (event.key === 'Home') {
      event.preventDefault(); setSelectedId(orderedIds[0] ?? null)
    } else if (event.key === 'End') {
      event.preventDefault(); setSelectedId(orderedIds[orderedIds.length - 1] ?? null)
    } else if ((event.key === 'Enter' || event.key === ' ') && selectedId) {
      event.preventDefault(); setDetailId(selectedId)
    }
  }

  return (
    <div className="architecture-view" role="region" aria-labelledby={labelId}>
      <div className="architecture-heading">
        <div>
          <p className="architecture-eyebrow">Approved solution map</p>
          <h3 id={labelId}>Architecture overview</h3>
        </div>
        <span className="architecture-revision">Revision {projection.architectureRevision}</span>
      </div>
      <p className="capabilities-note" role="note">
        {mode === 'guided'
          ? 'See the main parts of the solution, what each part is responsible for, and how work moves between them. Use arrow keys to move and Enter to open details.'
          : 'Modules are arranged by architectural responsibility. Every dependency is shown below as its own required-port to provided-port route, so direction and interaction stay readable without crossing lines. Use arrow keys to move and Enter to open details.'}
      </p>

      <div className="architecture-map-shell">
        <div className="architecture-map-toolbar">
          <div className="architecture-map-counts" role="group" aria-label="Architecture map summary"><span>{projection.nodes.length} modules</span><span>{projection.edges.length} port connections</span></div>
          <ul className="architecture-map-legend" aria-label="Component types">
            {ARCHITECTURE_TYPES.map((item) => <li key={item.type}><span className={`architecture-type-swatch type-${item.type}`} aria-hidden="true" />{item.label}</li>)}
            <li><span className="architecture-port-swatch" aria-hidden="true" />{mode === 'guided' ? 'Interaction' : 'Port connection'}</li>
          </ul>
        </div>
        <div className="architecture-diagram" role="application" aria-label="Architecture diagram" aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Home End Enter" tabIndex={0} onKeyDown={onKeyDown}>
          <div className={`architecture-lanes architecture-lanes-${lanes.length}`} role="group" aria-label="Architecture responsibility lanes">
            {lanes.map((lane) => (
              <section key={lane.role} className={`architecture-lane architecture-lane-${lane.role}`} aria-label={lane.label}>
                <header>
                  <span className="architecture-lane-count">{lane.nodes.length}</span>
                  <div><h4>{lane.label}</h4><p>{lane.hint}</p></div>
                </header>
                <ul>
                  {lane.nodes.map((node) => {
                    const selected = node.id === selectedId
                    const inFocus = selected || neighborSet.has(node.id)
                    return (
                      <li key={node.id}>
                        <button
                          type="button"
                          className={['architecture-node-card', node.proposed ? 'proposed' : '', selected ? 'selected' : '', inFocus ? 'in-focus' : '', `status-${node.statusIcon}`, `type-${node.moduleType ?? 'unassigned'}`].filter(Boolean).join(' ')}
                          onClick={() => { setSelectedId(node.id); setDetailId(node.id) }}
                          tabIndex={-1}
                          aria-label={`${node.name}, ${moduleTypeLabel(node.moduleType ?? 'module')}, ${node.statusLabel}. Open details`}
                          aria-pressed={selected}
                        >
                          <span className={`architecture-node-icon architecture-type-${node.moduleType ?? 'unassigned'}`} aria-hidden="true">{moduleTypeLabel(node.moduleType ?? 'module').charAt(0)}</span>
                          <span className="architecture-node-copy">
                            <span className="architecture-node-meta">
                              <small>{moduleTypeLabel(node.moduleType ?? 'module')}</small>
                              <span className="architecture-node-status"><span aria-hidden="true">{STATUS_GLYPH[node.statusIcon] ?? '◇'}</span> {node.statusLabel}</span>
                            </span>
                            <strong>{node.name}</strong>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>

          <section className="architecture-routes" aria-label="Port dependency routes">
            <div className="architecture-routes-heading">
              <div>
                <p className="architecture-eyebrow">Interactions</p>
                <h4>{mode === 'guided' ? 'How the parts work together' : 'Port-to-port dependency routes'}</h4>
              </div>
              <span>{routes.length} connection{routes.length === 1 ? '' : 's'}</span>
            </div>
            {routes.length ? (
              <ol className="architecture-route-list">
                {routes.map((route) => (
                  <li key={route.id} className={route.suggested ? 'suggested' : undefined}>
                    <div className="architecture-route-endpoint source"><small>{mode === 'guided' ? 'From' : 'Requires'}</small><strong>{route.fromNode!.name}</strong></div>
                    <div className="architecture-route-wire" aria-label={mode === 'guided'
                      ? `${route.fromNode!.name} works with ${route.toNode!.name}: ${route.reason}`
                      : `${route.fromNode!.name} depends on ${route.toNode!.name}: ${route.reason}`}>
                      <span className="architecture-route-port" aria-hidden="true" />
                      <span className="architecture-route-reason">{route.reason || 'Uses capability'}</span>
                      <span className="architecture-route-arrow" aria-hidden="true">→</span>
                      <span className="architecture-route-port" aria-hidden="true" />
                    </div>
                    <div className="architecture-route-endpoint target"><small>{mode === 'guided' ? 'To' : 'Provides'}</small><strong>{route.toNode!.name}</strong></div>
                  </li>
                ))}
              </ol>
            ) : <p className="architecture-routes-empty">No module dependencies are defined.</p>}
          </section>
        </div>
      </div>

      {focused ? <p role="status" aria-live="polite" className="sr-only">Focused {focused.name}. {neighbors.length} connected modules.</p> : null}

      {detailNode ? <ModuleDetails node={detailNode} projection={projection} onClose={() => setDetailId(null)} /> : null}
    </div>
  )
}
