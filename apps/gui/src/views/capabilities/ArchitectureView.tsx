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

function clipped(value: string, length = 25): string {
  return value.length <= length ? value : `${value.slice(0, length - 1)}…`
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
        <div><dt>Module ID</dt><dd><code>{node.id}</code></dd></div>
        {node.moduleVersion ? <div><dt>Version</dt><dd>{node.moduleVersion}</dd></div> : null}
        {node.runtimeAllocation ? <div><dt>Runtime</dt><dd>{humanizeIdentifier(node.runtimeAllocation)}</dd></div> : null}
      </dl>
      <div className="architecture-detail-columns">
        <section aria-label="Module dependencies">
          <h3>Dependencies</h3>
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
          <h3>Operations and data</h3>
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
  const groups = useMemo(() => {
    const values = new Map<string, { x: number; count: number }>()
    for (const node of projection.nodes) {
      const current = values.get(node.purposeGroup)
      values.set(node.purposeGroup, { x: Math.min(current?.x ?? node.layout.x, node.layout.x), count: (current?.count ?? 0) + 1 })
    }
    return [...values.entries()]
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
      <p className="capabilities-note" role="note">Select a module to see its responsibility, type, dependencies, and allocations. Status uses text and shape, so color is redundant. Use arrow keys to move through the map and Enter to open details.</p>

      <div className="architecture-map-shell">
        <div className="architecture-map-toolbar" aria-hidden="true">
          <span>{projection.nodes.length} modules</span><span>{projection.edges.length} dependencies</span>
        </div>
        <div className="architecture-diagram" role="application" aria-label="Architecture diagram" aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Home End Enter" tabIndex={0} onKeyDown={onKeyDown}>
          <svg width="100%" viewBox={`0 0 ${maxX} ${maxY}`} role="img" aria-label="Module dependency diagram">
            <defs>
              <pattern id={`${labelId}-grid`} width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" className="architecture-grid-line" /></pattern>
              <marker id={`${labelId}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" className="architecture-arrow" /></marker>
            </defs>
            <rect width={maxX} height={maxY} className="architecture-map-background" />
            <rect width={maxX} height={maxY} fill={`url(#${labelId}-grid)`} />
            {groups.map(([group, value]) => <text key={group} x={value.x} y={32} className="architecture-group-label">{group} · {value.count}</text>)}
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
              return <path key={edge.id} d={`M ${x1} ${y1} C ${x1 + curve * direction} ${y1}, ${x2 - curve * direction} ${y2}, ${x2} ${y2}`} className={edge.suggested ? 'architecture-edge suggested' : 'architecture-edge'} markerEnd={`url(#${labelId}-arrow)`}><title>{edge.reason}</title></path>
            })}
            {projection.nodes.map((node) => {
              const selected = node.id === selectedId
              const inFocus = selected || neighborSet.has(node.id)
              return (
                <g key={node.id} transform={`translate(${node.layout.x},${node.layout.y})`} className={['architecture-node', node.proposed ? 'proposed' : '', selected ? 'selected' : '', inFocus ? 'in-focus' : '', `status-${node.statusIcon}`, `type-${node.moduleType ?? 'unassigned'}`].filter(Boolean).join(' ')} onClick={() => { setSelectedId(node.id); setDetailId(node.id) }} role="button" tabIndex={-1} aria-label={`${node.name}, ${moduleTypeLabel(node.moduleType ?? 'module')}, ${node.statusLabel}. Open details`} aria-pressed={selected}>
                  <rect width={NODE_WIDTH} height={NODE_HEIGHT} rx={14} />
                  <rect className="architecture-node-accent" width={5} height={NODE_HEIGHT - 20} x={0} y={10} rx={3} />
                  <text x={18} y={24} className="architecture-node-kicker">{moduleTypeLabel(node.moduleType ?? 'module').toUpperCase()}</text>
                  <text x={18} y={48} className="architecture-node-title">{clipped(node.name)}</text>
                  <text x={18} y={68} className="architecture-node-status"><tspan aria-hidden="true">{STATUS_GLYPH[node.statusIcon] ?? '◇'} </tspan>{node.statusLabel}</text>
                  <text x={178} y={48} className="architecture-node-open" aria-hidden="true">↗</text>
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
