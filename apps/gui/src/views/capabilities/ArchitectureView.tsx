/**
 * Read-only architecture diagram + list (CAP-PKT-010 / CAP-DEC-006).
 * SVG layout with keyboard selection; Guided vs Design field sets.
 */

import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import type { ArchitectureProjection, ArchitectureProjectionMode } from '@engineering-ui-kit/core'
import { focusArchitectureNeighbors } from '@engineering-ui-kit/core/browser'

type Props = {
  projection: ArchitectureProjection
  mode: ArchitectureProjectionMode
}

const STATUS_GLYPH: Record<string, string> = {
  ready: '●',
  review: '◐',
  blocked: '■',
  failed: '✖',
  draft: '○',
  proposed: '◌',
  unknown: '?',
}

export function ArchitectureView({ projection, mode }: Props) {
  const labelId = useId()
  const [selectedId, setSelectedId] = useState<string | null>(projection.nodes[0]?.id ?? null)
  const orderedIds = projection.nodes.map((n) => n.id)

  useEffect(() => {
    if (selectedId && !orderedIds.includes(selectedId)) {
      setSelectedId(orderedIds[0] ?? null)
    }
  }, [orderedIds, selectedId])

  const { focused, neighbors } = selectedId
    ? focusArchitectureNeighbors(projection, selectedId)
    : { focused: undefined, neighbors: [] }
  const neighborSet = new Set(neighbors.map((n) => n.id))

  const moveSelection = (delta: number) => {
    if (orderedIds.length === 0) return
    const current = selectedId ? orderedIds.indexOf(selectedId) : 0
    const next = (current + delta + orderedIds.length) % orderedIds.length
    setSelectedId(orderedIds[next]!)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault()
      moveSelection(1)
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault()
      moveSelection(-1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      setSelectedId(orderedIds[0] ?? null)
    } else if (event.key === 'End') {
      event.preventDefault()
      setSelectedId(orderedIds[orderedIds.length - 1] ?? null)
    }
  }

  const maxX = Math.max(320, ...projection.nodes.map((n) => n.layout.x + 140))
  const maxY = Math.max(200, ...projection.nodes.map((n) => n.layout.y + 70))

  return (
    <div className="architecture-view" role="region" aria-labelledby={labelId}>
      <h3 id={labelId}>
        Architecture {mode === 'guided' ? '(Guided)' : '(Design)'} — {projection.architectureId} @{' '}
        {projection.architectureRevision}
      </h3>
      <p className="capabilities-note" role="note">
        Read-only diagram. Status uses text and shape; color is redundant. Use the list for a complete
        non-graph alternative. Arrow keys move selection when the diagram is focused.
      </p>

      <div
        className="architecture-diagram"
        role="application"
        aria-label="Architecture diagram"
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Home End"
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <svg
          width="100%"
          viewBox={`0 0 ${maxX} ${maxY}`}
          role="img"
          aria-label="Module dependency diagram"
        >
          {projection.edges.map((edge) => {
            const from = projection.nodes.find((n) => n.id === edge.from)
            const to = projection.nodes.find((n) => n.id === edge.to)
            if (!from || !to) return null
            return (
              <line
                key={edge.id}
                x1={from.layout.x + 60}
                y1={from.layout.y + 24}
                x2={to.layout.x + 60}
                y2={to.layout.y + 24}
                className={edge.suggested ? 'architecture-edge suggested' : 'architecture-edge'}
                strokeDasharray={edge.suggested ? '4 4' : undefined}
              />
            )
          })}
          {projection.nodes.map((node) => {
            const selected = node.id === selectedId
            const inFocus = selected || neighborSet.has(node.id)
            return (
              <g
                key={node.id}
                transform={`translate(${node.layout.x},${node.layout.y})`}
                className={[
                  'architecture-node',
                  node.proposed ? 'proposed' : '',
                  selected ? 'selected' : '',
                  inFocus ? 'in-focus' : '',
                  `status-${node.statusIcon}`,
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setSelectedId(node.id)}
                role="button"
                tabIndex={-1}
                aria-label={`${node.name}, ${node.statusLabel}`}
                aria-pressed={selected}
              >
                <rect
                  width={120}
                  height={48}
                  rx={node.proposed ? 2 : 6}
                  strokeDasharray={node.proposed ? '6 3' : undefined}
                />
                <text x={8} y={20} className="architecture-node-title">
                  {STATUS_GLYPH[node.statusIcon] ?? '?'} {node.name}
                </text>
                <text x={8} y={38} className="architecture-node-status">
                  {node.statusLabel}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {focused ? (
        <p role="status" aria-live="polite">
          Focused {focused.name} ({focused.statusLabel}). Neighbors:{' '}
          {neighbors.map((n) => n.name).join(', ') || 'none'}.
        </p>
      ) : null}

      <h4>Architecture list</h4>
      <ul className="architecture-list" aria-label="Architecture list alternative">
        {projection.listItems.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={item.id === selectedId ? 'active' : undefined}
              aria-current={item.id === selectedId ? 'true' : undefined}
              onClick={() => setSelectedId(item.id)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  moveSelection(1)
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  moveSelection(-1)
                }
              }}
            >
              <span>
                {STATUS_GLYPH[item.statusIcon] ?? '?'} <strong>{item.name}</strong> — {item.statusLabel}
              </span>
              <span className="capabilities-note">
                Group: {item.purposeGroup}. Edges: {item.edgeSummaries.join('; ') || 'none'}.
              </span>
              {mode === 'design' && item.designSummary ? (
                <span className="capabilities-note mono">{item.designSummary}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
