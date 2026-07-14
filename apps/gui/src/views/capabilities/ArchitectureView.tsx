/**
 * Read-only architecture map and module directory (CAP-PKT-010 / CAP-DEC-006).
 * Module cards open a shared detail dialog; keyboard selection remains available.
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

const NODE_WIDTH = 196
const NODE_HEIGHT = 82

const ARCHITECTURE_TYPES = [
  { type: 'experience', label: 'User-facing adapter' },
  { type: 'workflow', label: 'Application flow' },
  { type: 'domain', label: 'Domain core' },
  { type: 'platform', label: 'Platform adapter' },
  { type: 'connection', label: 'External adapter' },
] as const

function clipped(value: string, length = 25): string {
  return value.length <= length ? value : `${value.slice(0, length - 1)}…`
}

function NodeShape({ moduleType }: { moduleType?: string }) {
  if (moduleType === 'domain') {
    return <path className="architecture-node-body architecture-shape-domain" data-component-shape="hexagon" d="M24 1 H172 L195 41 L172 81 H24 L1 41 Z" />
  }
  if (moduleType === 'experience') {
    return <path className="architecture-node-body architecture-shape-experience" data-component-shape="inbound-adapter" d="M10 1 H166 L195 41 L166 81 H10 Q1 81 1 72 V10 Q1 1 10 1 Z" />
  }
  if (moduleType === 'connection') {
    return (
      <>
        <rect className="architecture-node-body architecture-shape-connection" data-component-shape="outbound-adapter" width={190} height={80} x={1} y={1} rx={40} />
        <path className="architecture-connector-prongs" d="M181 31 H195 M181 51 H195" />
      </>
    )
  }
  if (moduleType === 'platform') {
    return (
      <>
        <path className="architecture-node-body architecture-shape-platform" data-component-shape="platform" d="M1 14 C1 6 44 1 98 1 C152 1 195 6 195 14 V68 C195 76 152 81 98 81 C44 81 1 76 1 68 Z" />
        <path className="architecture-platform-rim" d="M1 14 C1 22 44 27 98 27 C152 27 195 22 195 14" />
      </>
    )
  }
  return <rect className="architecture-node-body architecture-shape-workflow" data-component-shape={moduleType === 'workflow' ? 'application' : 'unassigned'} width={194} height={80} x={1} y={1} rx={moduleType === 'workflow' ? 16 : 8} />
}

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

export function ArchitectureView({ projection }: Props) {
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
  const lanes = useMemo(() => {
    const values = new Map<number, { x: number; count: number; label: string }>()
    for (const node of projection.nodes) {
      const current = values.get(node.layout.column)
      values.set(node.layout.column, {
        x: Math.min(current?.x ?? node.layout.x, node.layout.x),
        count: (current?.count ?? 0) + 1,
        label: node.laneLabel ?? 'Other modules',
      })
    }
    return [...values.entries()].sort(([left], [right]) => left - right)
  }, [projection.nodes])

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

  const maxX = Math.max(420, ...projection.nodes.map((node) => node.layout.x + NODE_WIDTH + 54))
  const maxY = Math.max(250, ...projection.nodes.map((node) => node.layout.y + NODE_HEIGHT + 52))

  return (
    <div className="architecture-view" role="region" aria-labelledby={labelId}>
      <div className="architecture-heading">
        <div>
          <p className="architecture-eyebrow">Approved solution map</p>
          <h3 id={labelId}>Architecture overview</h3>
        </div>
        <span className="architecture-revision">Revision {projection.architectureRevision}</span>
      </div>
      <p className="capabilities-note" role="note">Read the map from user-facing adapters through application workflows into the domain core and out to platform or external adapters. Shape and text make every type clear, so color is redundant; connection points show ports. Use arrow keys to move and Enter to open details.</p>

      <div className="architecture-map-shell">
        <div className="architecture-map-toolbar">
          <div className="architecture-map-counts" aria-label="Architecture map summary"><span>{projection.nodes.length} modules</span><span>{projection.edges.length} port connections</span></div>
          <ul className="architecture-map-legend" aria-label="Component type shapes">
            {ARCHITECTURE_TYPES.map((item) => <li key={item.type}><span className={`architecture-shape-swatch shape-${item.type}`} aria-hidden="true" />{item.label}</li>)}
            <li><span className="architecture-port-swatch" aria-hidden="true" />Port</li>
          </ul>
        </div>
        <div className="architecture-diagram" role="application" aria-label="Architecture diagram" aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Home End Enter" tabIndex={0} onKeyDown={onKeyDown}>
          <svg width="100%" viewBox={`0 0 ${maxX} ${maxY}`} role="img" aria-label="Hexagonal ports and adapters module dependency diagram">
            <defs>
              <pattern id={`${labelId}-grid`} width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" className="architecture-grid-line" /></pattern>
              <marker id={`${labelId}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" className="architecture-arrow" /></marker>
            </defs>
            <rect width={maxX} height={maxY} className="architecture-map-background" />
            <rect width={maxX} height={maxY} fill={`url(#${labelId}-grid)`} />
            {lanes.map(([column, value]) => (
              <g key={column} className="architecture-lane-heading">
                <rect x={value.x - 10} y={22} width={216} height={34} rx={17} />
                <text x={value.x + 7} y={43}>{value.label.toUpperCase()} · {value.count}</text>
              </g>
            ))}
            {projection.nodes.filter((node) => node.architectureRole === 'domain-core').map((node) => (
              <ellipse key={`halo-${node.id}`} className="architecture-domain-halo" cx={node.layout.x + NODE_WIDTH / 2} cy={node.layout.y + NODE_HEIGHT / 2} rx={125} ry={62} />
            ))}
            {projection.edges.map((edge) => {
              const from = projection.nodes.find((node) => node.id === edge.from)
              const to = projection.nodes.find((node) => node.id === edge.to)
              if (!from || !to) return null
              const sameColumn = from.layout.x === to.layout.x
              const movesRight = to.layout.x > from.layout.x
              const x1 = sameColumn || movesRight ? from.layout.x + NODE_WIDTH : from.layout.x
              const y1 = from.layout.y + NODE_HEIGHT / 2
              const x2 = sameColumn ? to.layout.x + NODE_WIDTH : movesRight ? to.layout.x : to.layout.x + NODE_WIDTH
              const y2 = to.layout.y + NODE_HEIGHT / 2
              const curve = sameColumn ? 62 + Math.abs(from.layout.row - to.layout.row) * 10 : Math.max(38, Math.abs(x2 - x1) * 0.42)
              const direction = sameColumn || movesRight ? 1 : -1
              return (
                <g key={edge.id} className="architecture-port-connection">
                  <path d={`M ${x1} ${y1} C ${x1 + curve * direction} ${y1}, ${x2 - curve * direction} ${y2}, ${x2} ${y2}`} className={edge.suggested ? 'architecture-edge suggested' : 'architecture-edge'} markerEnd={`url(#${labelId}-arrow)`}><title>{edge.reason}</title></path>
                  <circle cx={x1} cy={y1} r={5} className="architecture-port output-port"><title>{`Output port from ${from.name}`}</title></circle>
                  <circle cx={x2} cy={y2} r={5} className="architecture-port input-port"><title>{`Input port on ${to.name}`}</title></circle>
                </g>
              )
            })}
            {projection.nodes.map((node) => {
              const selected = node.id === selectedId
              const inFocus = selected || neighborSet.has(node.id)
              return (
                <g key={node.id} transform={`translate(${node.layout.x},${node.layout.y})`} className={['architecture-node', node.proposed ? 'proposed' : '', selected ? 'selected' : '', inFocus ? 'in-focus' : '', `status-${node.statusIcon}`, `type-${node.moduleType ?? 'unassigned'}`].filter(Boolean).join(' ')} onClick={() => { setSelectedId(node.id); setDetailId(node.id) }} role="button" tabIndex={-1} aria-label={`${node.name}, ${moduleTypeLabel(node.moduleType ?? 'module')}, ${node.statusLabel}. Open details`} aria-pressed={selected}>
                  <NodeShape moduleType={node.moduleType} />
                  <circle className="architecture-node-type-mark" cx={node.moduleType === 'domain' ? 35 : 19} cy={20} r={4} />
                  <text x={node.moduleType === 'domain' ? 46 : 30} y={23} className="architecture-node-kicker">{moduleTypeLabel(node.moduleType ?? 'module').toUpperCase()}</text>
                  <text x={node.moduleType === 'domain' ? 34 : 20} y={48} className="architecture-node-title">{clipped(node.name, node.moduleType === 'domain' ? 21 : 25)}</text>
                  <text x={node.moduleType === 'domain' ? 34 : 20} y={68} className="architecture-node-status"><tspan aria-hidden="true">{STATUS_GLYPH[node.statusIcon] ?? '◇'} </tspan>{node.statusLabel}</text>
                  <text x={node.moduleType === 'connection' ? 164 : 174} y={48} className="architecture-node-open" aria-hidden="true">↗</text>
                </g>
              )
            })}
          </svg>
        </div>
      </div>

      {focused ? <p role="status" aria-live="polite" className="sr-only">Focused {focused.name}. {neighbors.length} connected modules.</p> : null}

      <div className="architecture-directory-heading"><div><p className="architecture-eyebrow">Module directory</p><h4>Explore the solution</h4></div><span className="capabilities-note">Open any card for full details</span></div>
      <ul className="architecture-list" aria-label="Architecture list alternative">
        {projection.listItems.map((item) => (
          <li key={item.id}>
            <button type="button" className={item.id === selectedId ? 'active' : undefined} aria-current={item.id === selectedId ? 'true' : undefined} onClick={() => { setSelectedId(item.id); setDetailId(item.id) }}>
              <span className={`architecture-list-icon architecture-type-${item.moduleType ?? 'unassigned'}`} aria-hidden="true">{moduleTypeLabel(item.moduleType ?? 'module').charAt(0)}</span>
              <span className="architecture-list-copy"><strong>{item.name}</strong><span>{moduleTypeLabel(item.moduleType ?? 'module')} · {item.purposeGroup}</span></span>
              <span className={`architecture-list-status status-${item.statusIcon}`}><span aria-hidden="true">{STATUS_GLYPH[item.statusIcon] ?? '◇'}</span> {item.statusLabel}</span>
              <span className="architecture-list-open" aria-hidden="true">→</span>
            </button>
          </li>
        ))}
      </ul>
      {detailNode ? <ModuleDetails node={detailNode} projection={projection} onClose={() => setDetailId(null)} /> : null}
    </div>
  )
}
