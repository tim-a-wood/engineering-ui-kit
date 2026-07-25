/**
 * §8.2 Architecture canvas — one system canvas inside the Design view.
 *
 * The system-level projection (elements = one component per module, edges =
 * `architecture.dependencyEdges`) is built locally (module-scoped
 * `projectComponentDiagram` does not cover the whole system) and then laid
 * out with the real, deterministic `layoutDiagram` from
 * `@engineering-ui-kit/core/design-browser` — the same layout engine used
 * for every other UML projection, so node placement, orthogonal routing, and
 * crossing/clearance checks are the product's real rules, not a bespoke
 * canvas-only approximation.
 */

import { useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import {
  layoutDiagram,
  type DiagramLayout,
  type DiagramProjection,
  type ModuleDesignProgress,
  type SystemStructureSpecification,
  type UmlElement,
  type UmlRelationship,
} from '@engineering-ui-kit/core/design-browser'
import { Dialog } from '../../components'
import { StateBadge, moduleTypeLabel } from './designShared'

const NODE_WIDTH = 160
const NODE_HEIGHT = 56
const MIN_SCALE = 0.5
const MAX_SCALE = 3
const ZOOM_STEP = 0.2
const PAN_STEP = 40

function elementIdFor(moduleId: string): string {
  return `system.element.${moduleId}`
}

function buildSystemProjection(architecture: SystemStructureSpecification): DiagramProjection {
  const moduleDefs =
    architecture.moduleDefinitions && architecture.moduleDefinitions.length > 0
      ? architecture.moduleDefinitions
      : architecture.moduleIds.map((moduleId) => ({ moduleId, name: moduleId, moduleType: 'domain' as const, responsibility: '' }))
  const nameByModuleId = new Map(moduleDefs.map((definition) => [definition.moduleId, definition.name]))

  const elements: UmlElement[] = moduleDefs.map((definition) => ({
    id: elementIdFor(definition.moduleId),
    kind: 'component',
    label: definition.name,
    sourceRecordId: architecture.id,
    umlType: 'Component',
    definition: definition.responsibility,
  }))

  const relationships: UmlRelationship[] = architecture.dependencyEdges.map((edge, index) => ({
    id: `system.relationship.${edge.fromModuleId}.${edge.toModuleId}.${index}`,
    kind: 'dependency',
    fromId: elementIdFor(edge.fromModuleId),
    toId: elementIdFor(edge.toModuleId),
    label: edge.reason,
    sourceRecordId: architecture.id,
  }))

  const textAlternative = architecture.dependencyEdges.map(
    (edge) => `${nameByModuleId.get(edge.fromModuleId) ?? edge.fromModuleId} depends on ${nameByModuleId.get(edge.toModuleId) ?? edge.toModuleId}: ${edge.reason}`,
  )

  const withoutHash = {
    diagramId: `system.diagram.${architecture.id}`,
    kind: 'component' as const,
    title: 'System structure',
    sourceRecordId: architecture.id,
    sourceRevision: architecture.revision,
    sourceContentHash: architecture.contentHash,
    elements,
    relationships,
    diagnostics: [],
    textAlternative,
  }
  // Deterministic content hash without pulling in the hash helper here — the
  // exact hash value does not matter for the canvas, only the input to
  // `layoutDiagram`'s seed derivation being stable across rerenders.
  const contentHash = `${architecture.contentHash}:${elements.length}:${relationships.length}`
  return { ...withoutHash, contentHash }
}

export type SystemCanvasProps = {
  architecture: SystemStructureSpecification
  progress: ModuleDesignProgress
  selectedModuleId?: string
  onSelectModule: (moduleId: string) => void
  /** §8.2 "use focus mode by default" — controlled so it survives a rerender (§18.1). */
  focusMode: boolean
  onFocusModeChange: (focusMode: boolean) => void
  listView: boolean
  onListViewChange: (listView: boolean) => void
}

export function SystemCanvas(props: SystemCanvasProps) {
  const { focusMode, listView } = props
  const setFocusMode = (updater: boolean | ((value: boolean) => boolean)) =>
    props.onFocusModeChange(typeof updater === 'function' ? (updater as (value: boolean) => boolean)(focusMode) : updater)
  const setListView = (updater: boolean | ((value: boolean) => boolean)) =>
    props.onListViewChange(typeof updater === 'function' ? (updater as (value: boolean) => boolean)(listView) : updater)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [detailId, setDetailId] = useState<string | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef<{ x: number; y: number } | null>(null)

  const projection = useMemo(() => buildSystemProjection(props.architecture), [props.architecture])
  const layout = useMemo(() => layoutDiagram(projection, 'wide', { nodeWidth: NODE_WIDTH, nodeHeight: NODE_HEIGHT }), [projection])

  const stateByModuleId = useMemo(() => new Map(props.progress.modules.map((entry) => [entry.moduleId, entry])), [props.progress])
  const nameByModuleId = useMemo(() => new Map(projection.elements.map((element) => [element.id, element.label])), [projection])

  const neighborhood = useMemo(() => {
    if (!props.selectedModuleId) return undefined
    const selectedElementId = elementIdFor(props.selectedModuleId)
    const ids = new Set<string>([selectedElementId])
    for (const edge of props.architecture.dependencyEdges) {
      if (edge.fromModuleId === props.selectedModuleId) ids.add(elementIdFor(edge.toModuleId))
      if (edge.toModuleId === props.selectedModuleId) ids.add(elementIdFor(edge.fromModuleId))
    }
    return ids
  }, [props.architecture, props.selectedModuleId])

  const visibleNodeIds = useMemo(() => {
    if (!focusMode || !neighborhood) return new Set(layout.nodes.map((node) => node.elementId))
    return neighborhood
  }, [focusMode, neighborhood, layout])

  const visibleNodes = layout.nodes.filter((node) => visibleNodeIds.has(node.elementId))
  const visibleEdgeSet = new Set(
    projection.relationships.filter((rel) => visibleNodeIds.has(rel.fromId) && visibleNodeIds.has(rel.toId)).map((rel) => rel.id),
  )
  const visibleEdges = layout.edges.filter((edge) => visibleEdgeSet.has(edge.relationshipId))

  // Reading order for keyboard navigation and the accessible list view (§8.2, §18.4).
  const readingOrder = useMemo(
    () => [...visibleNodes].sort((a, b) => a.y - b.y || a.x - b.x).map((node) => node.elementId),
    [visibleNodes],
  )

  const deployableBoxes = useMemo(() => {
    const nodeById = new Map(layout.nodes.map((node) => [node.elementId, node]))
    return props.architecture.deployables
      .map((deployable) => {
        const nodes = deployable.moduleIds.map((moduleId) => nodeById.get(elementIdFor(moduleId))).filter((n): n is (typeof layout.nodes)[number] => Boolean(n) && visibleNodeIds.has(n!.elementId))
        if (nodes.length === 0) return undefined
        const minX = Math.min(...nodes.map((n) => n.x)) - 24
        const minY = Math.min(...nodes.map((n) => n.y)) - 32
        const maxX = Math.max(...nodes.map((n) => n.x + n.width)) + 24
        const maxY = Math.max(...nodes.map((n) => n.y + n.height)) + 24
        return { id: deployable.deployableId, name: deployable.name, x: minX, y: minY, width: maxX - minX, height: maxY - minY }
      })
      .filter((box): box is { id: string; name: string; x: number; y: number; width: number; height: number } => Boolean(box))
  }, [layout, props.architecture.deployables, visibleNodeIds])

  function moveFocus(delta: number) {
    if (readingOrder.length === 0) return
    const active = document.activeElement
    const currentIndex = readingOrder.findIndex((id) => active?.getAttribute?.('data-node-id') === id)
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + delta + readingOrder.length) % readingOrder.length
    const nextId = readingOrder[nextIndex]!
    const el = containerRef.current?.querySelector<SVGGElement>(`[data-node-id="${cssEscape(nextId)}"]`)
    el?.focus()
  }

  function onContainerKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (document.activeElement !== containerRef.current) return
    if (event.key === 'ArrowLeft') setPan((p) => ({ ...p, x: p.x + PAN_STEP }))
    else if (event.key === 'ArrowRight') setPan((p) => ({ ...p, x: p.x - PAN_STEP }))
    else if (event.key === 'ArrowUp') setPan((p) => ({ ...p, y: p.y + PAN_STEP }))
    else if (event.key === 'ArrowDown') setPan((p) => ({ ...p, y: p.y - PAN_STEP }))
  }

  function onNodeKeyDown(event: ReactKeyboardEvent<SVGGElement>, moduleId: string) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      moveFocus(1)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      moveFocus(-1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      props.onSelectModule(moduleId)
      setDetailId(elementIdFor(moduleId))
    }
  }

  function onPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    draggingRef.current = { x: event.clientX - pan.x, y: event.clientY - pan.y }
  }
  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!draggingRef.current) return
    setPan({ x: event.clientX - draggingRef.current.x, y: event.clientY - draggingRef.current.y })
  }
  function onPointerUp() {
    draggingRef.current = null
  }
  function onWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey) return
    event.preventDefault()
    setScale((s) => clampScale(s + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)))
  }

  const selectedElement = detailId ? projection.elements.find((element) => element.id === detailId) : undefined
  const selectedEntry = selectedElement ? stateByModuleId.get(moduleIdFromElementId(selectedElement.id)) : undefined
  const selectedDependencies = selectedElement
    ? props.architecture.dependencyEdges.filter((edge) => elementIdFor(edge.fromModuleId) === selectedElement.id)
    : []
  const selectedConsumers = selectedElement
    ? props.architecture.dependencyEdges.filter((edge) => elementIdFor(edge.toModuleId) === selectedElement.id)
    : []

  return (
    <section className="design-canvas" aria-label="System canvas">
      <div className="design-canvas-toolbar" role="group" aria-label="Canvas controls">
        <button type="button" className="design-canvas-toggle" aria-pressed={!focusMode} onClick={() => setFocusMode((v) => !v)}>
          Show all links
          <span className="sr-only">{focusMode ? ', off — showing only the selected module’s neighborhood' : ', on'}</span>
        </button>
        <button type="button" className="design-canvas-toggle" aria-pressed={listView} onClick={() => setListView((v) => !v)}>
          List view
        </button>
        {!listView && (
          <>
            <button type="button" aria-label="Zoom out" onClick={() => setScale((s) => clampScale(s - ZOOM_STEP))}>
              −
            </button>
            <span className="design-canvas-zoom-level">{Math.round(scale * 100)}%</span>
            <button type="button" aria-label="Zoom in" onClick={() => setScale((s) => clampScale(s + ZOOM_STEP))}>
              +
            </button>
            <button type="button" onClick={() => { setScale(1); setPan({ x: 0, y: 0 }) }}>
              Reset view
            </button>
          </>
        )}
      </div>

      {listView ? (
        <div className="design-canvas-list">
          <h3>Modules</h3>
          <ul>
            {projection.elements.map((element) => {
              const moduleId = moduleIdFromElementId(element.id)
              const entry = stateByModuleId.get(moduleId)
              return (
                <li key={element.id}>
                  <button type="button" onClick={() => props.onSelectModule(moduleId)}>
                    {element.label}
                  </button>
                  {entry && <StateBadge state={entry.state} />}
                </li>
              )
            })}
          </ul>
          <h3>Dependencies</h3>
          {projection.textAlternative.length === 0 ? (
            <p className="secondary-text">No dependencies recorded.</p>
          ) : (
            <ul>
              {projection.textAlternative.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div
          className="design-canvas-viewport"
          ref={containerRef}
          tabIndex={0}
          role="application"
          aria-label="System canvas surface. Use Tab to reach a module, arrow keys to move between modules, Enter to open details. Use arrow keys while the canvas surface itself is focused to pan."
          onKeyDown={onContainerKeyDown}
          onWheel={onWheel}
        >
          <svg
            width="100%"
            height="480"
            viewBox="0 0 900 480"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            <g transform={`translate(${pan.x} ${pan.y}) scale(${scale})`}>
              {deployableBoxes.map((box) => (
                <g key={box.id}>
                  <rect x={box.x} y={box.y} width={box.width} height={box.height} className="design-canvas-deployable" rx={8} />
                  <text x={box.x + 8} y={box.y + 16} className="design-canvas-deployable-label">
                    {box.name}
                  </text>
                </g>
              ))}
              {visibleEdges.map((edge) => (
                <g key={edge.relationshipId} className="design-canvas-edge">
                  <polyline points={edge.points.map((point) => `${point.x},${point.y}`).join(' ')} markerEnd="url(#design-arrow)" />
                </g>
              ))}
              {visibleNodes.map((node) => {
                const moduleId = moduleIdFromElementId(node.elementId)
                const entry = stateByModuleId.get(moduleId)
                const providedCount = props.architecture.operationAllocations.filter((allocation) => allocation.moduleId === moduleId).length
                const requiredCount = props.architecture.dependencyEdges.filter((edge) => edge.fromModuleId === moduleId).length
                const selected = moduleId === props.selectedModuleId
                return (
                  <g
                    key={node.elementId}
                    data-node-id={node.elementId}
                    tabIndex={0}
                    role="button"
                    aria-label={`${nameByModuleId.get(node.elementId) ?? moduleId}${entry ? `, ${entry.state}` : ''}`}
                    aria-pressed={selected}
                    className={selected ? 'design-canvas-node selected' : 'design-canvas-node'}
                    transform={`translate(${node.x} ${node.y})`}
                    onClick={() => props.onSelectModule(moduleId)}
                    onDoubleClick={() => setDetailId(node.elementId)}
                    onKeyDown={(event) => onNodeKeyDown(event, moduleId)}
                  >
                    <rect width={node.width} height={node.height} rx={6} />
                    <text x={8} y={18} className="design-canvas-node-title">
                      {nameByModuleId.get(node.elementId) ?? moduleId}
                    </text>
                    <text x={8} y={34} className="design-canvas-node-meta" aria-hidden="true">
                      ▲{providedCount} ▽{requiredCount}
                    </text>
                    {entry && (
                      <text x={8} y={48} className="design-canvas-node-state" aria-hidden="true">
                        {entry.state}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
            <defs>
              <marker id="design-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" />
              </marker>
            </defs>
          </svg>
        </div>
      )}

      {selectedElement && (
        <Dialog title={`${selectedElement.label}`} onClose={() => setDetailId(undefined)}>
          {selectedEntry && (
            <p>
              <StateBadge state={selectedEntry.state} /> · {moduleTypeLabel(selectedEntry.moduleType)}
            </p>
          )}
          <p>{selectedElement.definition || 'No responsibility recorded yet.'}</p>
          <h3>Provides</h3>
          {selectedConsumers.length === 0 ? (
            <p className="secondary-text">No consumers depend on this module.</p>
          ) : (
            <ul>
              {selectedConsumers.map((edge) => (
                <li key={`${edge.fromModuleId}-consumer`}>{nameByModuleId.get(elementIdFor(edge.fromModuleId)) ?? edge.fromModuleId} depends on this module: {edge.reason}</li>
              ))}
            </ul>
          )}
          <h3>Requires</h3>
          {selectedDependencies.length === 0 ? (
            <p className="secondary-text">This module has no direct dependencies.</p>
          ) : (
            <ul>
              {selectedDependencies.map((edge) => (
                <li key={`${edge.toModuleId}-dependency`}>Depends on {nameByModuleId.get(elementIdFor(edge.toModuleId)) ?? edge.toModuleId}: {edge.reason}</li>
              ))}
            </ul>
          )}
        </Dialog>
      )}
    </section>
  )
}

function moduleIdFromElementId(elementId: string): string {
  return elementId.replace(/^system\.element\./, '')
}

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(value.toFixed(2))))
}

function cssEscape(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`)
}
