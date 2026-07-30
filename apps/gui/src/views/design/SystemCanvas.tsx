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

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import type { DiagramProjection as LiveDiagramProjection } from '@engineering-ui-kit/core'
import {
  layoutDiagram as layoutLegacyDiagram,
  type DiagramLayout,
  type DiagramLayoutEdge,
  type DiagramProjection,
  type ModuleDesignProgress,
  type SystemStructureSpecification,
  type UmlElement,
  type UmlRelationship,
} from '@engineering-ui-kit/core/design-browser'
import { Dialog } from '../../components'
import {
  analyzeUmlLayoutQuality,
  layoutUmlDiagram,
  type UmlLayoutQuality,
} from '../capabilities/umlDiagramLayout'
import { StateBadge, moduleTypeLabel } from './designShared'

const NODE_WIDTH = 176
const NODE_HEIGHT = 72
const MIN_SCALE = 0.75
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
    sourceElementRef: `module:${definition.moduleType}`,
    umlType: `Component · ${definition.moduleType}`,
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

function buildLiveSystemProjection(architecture: SystemStructureSpecification): LiveDiagramProjection {
  const moduleDefs =
    architecture.moduleDefinitions && architecture.moduleDefinitions.length > 0
      ? architecture.moduleDefinitions
      : architecture.moduleIds.map((moduleId) => ({
        moduleId,
        name: moduleId,
        moduleType: 'domain' as const,
        responsibility: '',
      }))
  const sourceRecordIds = [architecture.id]
  const nodes = moduleDefs.map((definition) => ({
    id: elementIdFor(definition.moduleId),
    kind: 'component' as const,
    label: definition.name,
    description: definition.responsibility || `${definition.name} module.`,
    sourceRecordId: architecture.id,
    traceIds: [architecture.id, definition.moduleId],
    stereotype: definition.moduleType,
  }))
  const edges = architecture.dependencyEdges.map((edge, index) => ({
    id: `system.relationship.${edge.fromModuleId}.${edge.toModuleId}.${index}`,
    kind: 'dependency' as const,
    fromId: elementIdFor(edge.fromModuleId),
    toId: elementIdFor(edge.toModuleId),
    description: edge.reason,
    sourceRecordId: architecture.id,
    traceIds: [architecture.id, edge.fromModuleId, edge.toModuleId],
  }))
  return {
    schemaVersion: '1.0',
    id: `system.diagram.${architecture.id}`,
    kind: 'component',
    projectId: architecture.projectId,
    contextId: architecture.id,
    title: 'System structure',
    sourceRevision: architecture.revision,
    sourceRecordIds,
    nodes,
    edges,
    diagnostics: [],
    textAlternative: `System structure has ${nodes.length} modules and ${edges.length} dependencies.`,
    contentHash: `${architecture.contentHash}:${nodes.length}:${edges.length}:elk-system`,
  }
}

export type SystemCanvasRouteResult = {
  layout: DiagramLayout
  quality: UmlLayoutQuality
}

/**
 * Route the architecture canvas through the same ELK geometry and quality
 * analyzer as the live UML workspaces. The legacy synchronous layout remains
 * a render fallback only; acceptance tests gate this result.
 */
export async function layoutSystemCanvas(
  architecture: SystemStructureSpecification,
): Promise<SystemCanvasRouteResult> {
  const projection = buildLiveSystemProjection(architecture)
  const routed = await layoutUmlDiagram(projection)
  const quality = analyzeUmlLayoutQuality(routed, projection)
  return {
    quality,
    layout: {
      diagramId: projection.id,
      viewportClass: 'wide',
      seed: projection.contentHash,
      nodes: routed.nodes
        .filter((node) => projection.nodes.find((candidate) => candidate.id === node.id)?.kind === 'component')
        .map((node) => ({
          elementId: node.id,
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
        })),
      edges: routed.edges.map((edge) => ({
        relationshipId: edge.id,
        points: edge.points,
      })),
      diagnostics: [],
      crossingCount: quality.crossings,
      contentHash: projection.contentHash,
    },
  }
}

type RoutedSegment = {
  start: { x: number; y: number }
  end: { x: number; y: number }
}

function properOrthogonalIntersection(
  first: RoutedSegment,
  second: RoutedSegment,
): { x: number; y: number } | undefined {
  const firstHorizontal = first.start.y === first.end.y
  const firstVertical = first.start.x === first.end.x
  const secondHorizontal = second.start.y === second.end.y
  const secondVertical = second.start.x === second.end.x
  const horizontal = firstHorizontal && secondVertical
    ? first
    : secondHorizontal && firstVertical ? second : undefined
  const vertical = firstVertical && secondHorizontal
    ? first
    : secondVertical && firstHorizontal ? second : undefined
  if (!horizontal || !vertical) return undefined
  const x = vertical.start.x
  const y = horizontal.start.y
  return (
    x > Math.min(horizontal.start.x, horizontal.end.x)
    && x < Math.max(horizontal.start.x, horizontal.end.x)
    && y > Math.min(vertical.start.y, vertical.end.y)
    && y < Math.max(vertical.start.y, vertical.end.y)
  ) ? { x, y } : undefined
}

function routeSegments(edge: DiagramLayoutEdge): RoutedSegment[] {
  return edge.points.slice(0, -1).map((start, index) => ({
    start,
    end: edge.points[index + 1]!,
  }))
}

/** Draw only the later relationship with a small bridge at each crossover. */
function bridgedPath(edge: DiagramLayoutEdge, allEdges: readonly DiagramLayoutEdge[]): string {
  const firstPoint = edge.points[0]
  if (!firstPoint) return ''
  const otherSegments = allEdges
    .filter((candidate) => candidate.relationshipId.localeCompare(edge.relationshipId) < 0)
    .flatMap(routeSegments)
  let path = `M ${firstPoint.x} ${firstPoint.y}`
  for (const segment of routeSegments(edge)) {
    const horizontal = segment.start.y === segment.end.y
    const vertical = segment.start.x === segment.end.x
    const length = Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y)
    const crossings = otherSegments
      .map((other) => properOrthogonalIntersection(segment, other))
      .filter((point): point is { x: number; y: number } => Boolean(point))
      .map((point) => ({
        ...point,
        distance: Math.hypot(point.x - segment.start.x, point.y - segment.start.y),
      }))
      .filter((point) => point.distance > 8 && point.distance < length - 8)
      .sort((left, right) => left.distance - right.distance)
      .filter((point, index, points) =>
        index === 0
        || point.x !== points[index - 1]!.x
        || point.y !== points[index - 1]!.y)
    for (const crossing of crossings) {
      if (horizontal) {
        const direction = Math.sign(segment.end.x - segment.start.x)
        path += ` L ${crossing.x - direction * 6} ${crossing.y}`
        path += ` Q ${crossing.x} ${crossing.y - 7} ${crossing.x + direction * 6} ${crossing.y}`
      } else if (vertical) {
        const direction = Math.sign(segment.end.y - segment.start.y)
        path += ` L ${crossing.x} ${crossing.y - direction * 6}`
        path += ` Q ${crossing.x + 7} ${crossing.y} ${crossing.x} ${crossing.y + direction * 6}`
      }
    }
    path += ` L ${segment.end.x} ${segment.end.y}`
  }
  return path
}

function humanizeIdentifier(value: string): string {
  const normalized = value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized ? `${normalized[0]!.toUpperCase()}${normalized.slice(1)}` : normalized
}

function wrapSystemLabel(value: string, limit = 21): string[] {
  const words = value.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  for (const word of words) {
    const current = lines[lines.length - 1]
    if (!current || (current.length + word.length + 1 > limit && lines.length < 2)) lines.push(word)
    else lines[lines.length - 1] = `${current} ${word}`
  }
  if (lines.length > 2) lines.splice(1, lines.length - 1, lines.slice(1).join(' '))
  if ((lines[1]?.length ?? 0) > limit + 5) lines[1] = `${lines[1]!.slice(0, limit + 2).trimEnd()}…`
  return lines.slice(0, 2)
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
  const fallbackLayout = useMemo(
    () => layoutLegacyDiagram(projection, 'wide', { nodeWidth: NODE_WIDTH, nodeHeight: NODE_HEIGHT }),
    [projection],
  )
  const [routedResult, setRoutedResult] = useState<SystemCanvasRouteResult>()
  const [routingError, setRoutingError] = useState('')
  useEffect(() => {
    let active = true
    setRoutedResult(undefined)
    setRoutingError('')
    void layoutSystemCanvas(props.architecture)
      .then((result) => {
        if (active) setRoutedResult(result)
      })
      .catch((error: unknown) => {
        if (active) setRoutingError(error instanceof Error ? error.message : String(error))
      })
    return () => { active = false }
  }, [props.architecture])
  const layout = routedResult?.layout ?? fallbackLayout
  const quality = routedResult?.quality
  const qualityDefects = quality
    ? quality.overlappingConnectorPairs
      + quality.nodeOverlaps
      + quality.edgeNodeClearanceViolations
      + quality.labelNodeOverlaps
      + quality.labelLabelOverlaps
      + quality.connectorLabelOverlaps
      + quality.portAlignmentViolations
      + quality.canvasBoundsViolations
    : 0
  const qualityLabel = routingError
    ? 'Fallback routing'
    : !quality
      ? 'Routing architecture'
      : qualityDefects > 0
        ? `${qualityDefects} layout notes`
        : quality.crossings === 0
          ? 'Layout verified'
          : quality.crossings === 1
            ? '1 bridged crossover'
            : `${quality.crossings} bridged crossovers`

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

  // Fit the viewBox to the visible content so the selected neighborhood (focus
  // mode) or the full structure (all-links mode) is always on screen; pan and
  // zoom remain user adjustments on top and never change the model (§8.2).
  const viewBox = useMemo(() => {
    if (visibleNodes.length === 0) return { x: 0, y: 0, width: 900, height: 480 }
    const pad = 48
    const edgePoints = visibleEdges.flatMap((edge) => edge.points)
    const minX = Math.min(...visibleNodes.map((n) => n.x), ...edgePoints.map((point) => point.x)) - pad
    const minY = Math.min(...visibleNodes.map((n) => n.y), ...edgePoints.map((point) => point.y)) - pad
    const maxX = Math.max(...visibleNodes.map((n) => n.x + n.width), ...edgePoints.map((point) => point.x)) + pad
    const maxY = Math.max(...visibleNodes.map((n) => n.y + n.height), ...edgePoints.map((point) => point.y)) + pad
    return { x: minX, y: minY, width: Math.max(maxX - minX, 480), height: Math.max(maxY - minY, 320) }
  }, [visibleEdges, visibleNodes])

  // A new selection or mode change re-fits the view; leftover pan from the
  // previous neighborhood would otherwise push the new content off screen.
  const visibleKey = useMemo(() => [...visibleNodeIds].sort().join('|'), [visibleNodeIds])
  useEffect(() => {
    setPan({ x: 0, y: 0 })
  }, [visibleKey])

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
  const selectedRelationship = detailId ? projection.relationships.find((relationship) => relationship.id === detailId) : undefined
  const selectedEntry = selectedElement ? stateByModuleId.get(moduleIdFromElementId(selectedElement.id)) : undefined
  const selectedDependencies = selectedElement
    ? props.architecture.dependencyEdges.filter((edge) => elementIdFor(edge.fromModuleId) === selectedElement.id)
    : []
  const selectedConsumers = selectedElement
    ? props.architecture.dependencyEdges.filter((edge) => elementIdFor(edge.toModuleId) === selectedElement.id)
    : []

  return (
    <section
      className="design-canvas"
      aria-label="System canvas"
      data-layout-engine={routedResult ? 'elk' : routingError ? 'fallback' : 'routing'}
    >
      <header className="design-canvas-header">
        <div>
          <p className="overline">Approved system design</p>
          <h2>Architecture canvas</h2>
          <p>Module topology, deployable boundaries, and dependency direction</p>
        </div>
        <div className="design-canvas-status" aria-label="Architecture layout status">
          <span className="design-canvas-count">{projection.elements.length} modules · {projection.relationships.length} dependencies</span>
          <span className="design-canvas-quality">{qualityLabel}</span>
        </div>
      </header>
      <div className="design-canvas-toolbar">
        <div role="group" aria-label="Canvas display controls">
          <button type="button" className="design-canvas-toggle" aria-label={focusMode ? 'Show all links' : 'Limit links'} aria-pressed={!focusMode} onClick={() => setFocusMode((v) => !v)}>
            Show all links
          </button>
          <button type="button" className="design-canvas-toggle" aria-pressed={listView} onClick={() => setListView((v) => !v)}>
            List view
          </button>
        </div>
        {!listView && (
          <div role="group" aria-label="Canvas viewport controls">
            <button type="button" aria-label="Zoom out" onClick={() => setScale((s) => clampScale(s - ZOOM_STEP))}>
              −
            </button>
            <span className="design-canvas-zoom-level">{Math.round(scale * 100)}%</span>
            <button type="button" aria-label="Zoom in" onClick={() => setScale((s) => clampScale(s + ZOOM_STEP))}>
              +
            </button>
            <button type="button" onClick={() => { setFocusMode(false); setScale(1); setPan({ x: 0, y: 0 }) }}>
              Fit system
            </button>
            <button type="button" disabled={!props.selectedModuleId} onClick={() => { setFocusMode(true); setScale(1); setPan({ x: 0, y: 0 }) }}>
              Fit selection
            </button>
          </div>
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
          aria-label="System canvas"
          onKeyDown={onContainerKeyDown}
          onWheel={onWheel}
        >
          <svg
            width="100%"
            height={Math.max(480, Math.min(820, viewBox.height))}
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
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
              {visibleEdges.map((edge) => {
                const relationship = projection.relationships.find((candidate) => candidate.id === edge.relationshipId)
                const selectedElementId = props.selectedModuleId ? elementIdFor(props.selectedModuleId) : undefined
                const contextual = !selectedElementId
                  || relationship?.fromId === selectedElementId
                  || relationship?.toId === selectedElementId
                return (
                <g key={edge.relationshipId} className={contextual ? 'design-canvas-edge contextual' : 'design-canvas-edge muted'}>
                  <path d={bridgedPath(edge, visibleEdges)} markerEnd="url(#design-arrow)" />
                  <path
                    d={bridgedPath(edge, visibleEdges)}
                    className={detailId === edge.relationshipId ? 'design-canvas-edge-hit selected' : 'design-canvas-edge-hit'}
                    tabIndex={0}
                    role="button"
                    aria-label={`Dependency: ${projection.relationships.find((relationship) => relationship.id === edge.relationshipId)?.label ?? 'module dependency'}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      setDetailId(edge.relationshipId)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setDetailId(edge.relationshipId)
                      }
                    }}
                  />
                </g>
                )
              })}
              {visibleNodes.map((node) => {
                const moduleId = moduleIdFromElementId(node.elementId)
                const entry = stateByModuleId.get(moduleId)
                const element = projection.elements.find((candidate) => candidate.id === node.elementId)
                const moduleName = nameByModuleId.get(node.elementId) ?? moduleId
                const titleLines = wrapSystemLabel(moduleName)
                const moduleType = humanizeIdentifier(element?.sourceElementRef?.replace(/^module:/, '') ?? 'module')
                const providedCount = props.architecture.operationAllocations.filter((allocation) => allocation.moduleId === moduleId).length
                const requiredCount = props.architecture.dependencyEdges.filter((edge) => edge.fromModuleId === moduleId).length
                const selected = moduleId === props.selectedModuleId
                return (
                  <g
                    key={node.elementId}
                    data-node-id={node.elementId}
                    tabIndex={0}
                    role="button"
                    aria-label={`${moduleName}${entry ? `, ${entry.state}` : ''}; ${moduleType} module; provides ${providedCount} operations; requires ${requiredCount} dependencies`}
                    aria-pressed={selected}
                    className={selected ? 'design-canvas-node selected' : 'design-canvas-node'}
                    transform={`translate(${node.x} ${node.y})`}
                    onClick={() => {
                      props.onSelectModule(moduleId)
                      setDetailId(node.elementId)
                    }}
                    onKeyDown={(event) => onNodeKeyDown(event, moduleId)}
                  >
                    <title>{moduleName} · {moduleType}{entry ? ` · ${humanizeIdentifier(entry.state)}` : ''}</title>
                    <rect width={node.width} height={node.height} rx={6} />
                    <g className="design-canvas-component-mark" aria-hidden="true">
                      <rect x={node.width - 25} y={8} width={16} height={18} rx={1} />
                      <rect x={node.width - 31} y={11} width={8} height={5} rx={1} />
                      <rect x={node.width - 31} y={19} width={8} height={5} rx={1} />
                    </g>
                    <text x={10} y={18} className="design-canvas-node-title">
                      {titleLines.map((line, index) => (
                        <tspan key={`${line}.${index}`} x={10} dy={index === 0 ? 0 : 16}>{line}</tspan>
                      ))}
                    </text>
                    <text x={10} y={node.height - 20} className="design-canvas-node-meta" aria-hidden="true">
                      {moduleType}
                    </text>
                    {entry && (
                      <text x={10} y={node.height - 7} className="design-canvas-node-state" aria-hidden="true">
                        {humanizeIdentifier(entry.state)}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
            <defs>
              <marker id="design-arrow" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
                <path d="M0,0 L7,3 L0,6" />
              </marker>
            </defs>
          </svg>
          {scale > 1 && <div className="design-canvas-minimap" aria-label="System minimap">
            <svg viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`} width="148" height="84" aria-hidden="true">
              {layout.edges.map((edge) => <polyline key={edge.relationshipId} points={edge.points.map((point) => `${point.x},${point.y}`).join(' ')} />)}
              {layout.nodes.map((node) => <rect key={node.elementId} x={node.x} y={node.y} width={node.width} height={node.height} rx={4} />)}
            </svg>
          </div>}
        </div>
      )}
      {!listView && (
        <footer className="design-canvas-footer">
          <span>Dashed open arrows show UML dependencies. Line bridges mark crossovers.</span>
          <span>Select a module or dependency for its approved design record.</span>
        </footer>
      )}

      {(selectedElement || selectedRelationship) && (
        <Dialog title={selectedElement?.label ?? 'Dependency details'} onClose={() => setDetailId(undefined)}>
          {selectedRelationship ? (
            <>
              <p className="overline">System relationship</p>
              <h3>{nameByModuleId.get(selectedRelationship.fromId) ?? selectedRelationship.fromId} → {nameByModuleId.get(selectedRelationship.toId) ?? selectedRelationship.toId}</h3>
              <p>{selectedRelationship.label || 'No dependency rationale recorded.'}</p>
              <dl className="design-definition-grid">
                <dt>Relationship</dt><dd>{selectedRelationship.kind}</dd>
                <dt>From</dt><dd>{nameByModuleId.get(selectedRelationship.fromId) ?? selectedRelationship.fromId}</dd>
                <dt>To</dt><dd>{nameByModuleId.get(selectedRelationship.toId) ?? selectedRelationship.toId}</dd>
              </dl>
            </>
          ) : selectedEntry && (
            <p>
              <StateBadge state={selectedEntry.state} /> · {moduleTypeLabel(selectedEntry.moduleType)}
            </p>
          )}
          {selectedElement && (
            <>
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
            </>
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
