/**
 * EUC-09 — Diagram layout adapter.
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §15.2, §24.1,
 * §25.3 (EUC-08/09). Pure, deterministic layout of a `DiagramProjection` into
 * a `DiagramLayout`: no DOM, no I/O, no randomness, no wall-clock reads.
 *
 * Collision avoidance is enforced by construction (layered/column placement
 * with dedicated, node-free routing corridors — see `routeGeneric` below) and
 * verified with `checkLayout`. A layout failure produces a diagnostic; it
 * never drops a relationship (`layout.edges.length === projection.relationships.length`
 * always holds).
 *
 * This module never edits `records.ts` or `identity.ts` (shared contracts);
 * it only imports from them.
 */

import type { DesignDiagnostic, DiagramLayout, DiagramLayoutEdge, DiagramLayoutNode, DiagramProjection, UmlElement, UmlRelationship } from './records.js'
import { canonicalHash, childId, designContentHash, stableSortStrings } from './identity.js'

// ---------------------------------------------------------------------------
// Options and constants
// ---------------------------------------------------------------------------

export type DiagramLayoutOptions = {
  /** Minimum clearance (px) between an edge route and an unrelated node (§15.2). Default 12. */
  clearance?: number
  /** Relationship-crossing count above which a diagnostic is produced (§15.2). Default 8. */
  crossingThreshold?: number
  nodeWidth?: number
  nodeHeight?: number
  /** Readable minimum node size; the layout never shrinks below this, even on a narrow viewport (§15.2). */
  minNodeWidth?: number
  minNodeHeight?: number
}

export type DiagramLayoutQuality = {
  crossingCount: number
  overlappingEdgePairs: number
  edgeNodeClearanceViolations: number
  labelNodeOverlaps: number
  labelLabelOverlaps: number
  bendCount: number
  totalEdgeLength: number
}

const DEFAULT_NODE_WIDTH = 160
const DEFAULT_NODE_HEIGHT = 56
const MIN_NODE_WIDTH = 120
const MIN_NODE_HEIGHT = 40

const LAYER_GAP_Y = 96
const NODE_GAP_X = 40
const GAP_BAND_OFFSET = 20
const COLLECTOR_MARGIN = 80

const LIFELINE_GAP_X = 60
const HEADER_HEIGHT_EXTRA = 0
const MESSAGE_START_GAP = 48
const MESSAGE_GAP_Y = 56
const LABEL_OFFSET_Y = 14

const ACTOR_COLUMN_GAP = 120
const BOUNDARY_PADDING = 32
const USE_CASE_COLUMN_GAP_OFFSET = 20

const DEFAULT_CLEARANCE = 12
const DEFAULT_CROSSING_THRESHOLD = 8

type Point = { x: number; y: number }

function isContainerKind(kind: UmlElement['kind'] | undefined): boolean {
  return kind === 'systemBoundary' || kind === 'fragment'
}

function relationshipLabelText(rel: UmlRelationship): string | undefined {
  if (rel.label) return rel.label
  if (rel.guard) {
    const guard = rel.guard.trim()
    return guard.startsWith('[') && guard.endsWith(']') ? guard : `[${guard}]`
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Layered node placement (component / activity / stateMachine)
// ---------------------------------------------------------------------------

/** Multi-source BFS layering, cycle-tolerant and deterministic (visited-once). */
function computeLayers(elements: readonly UmlElement[], relationships: readonly UmlRelationship[]): Map<string, number> {
  const ids = elements.map((element) => element.id)
  const idSet = new Set(ids)
  const outgoing = new Map<string, string[]>()
  const incomingCount = new Map<string, number>()
  for (const id of ids) {
    outgoing.set(id, [])
    incomingCount.set(id, 0)
  }
  for (const rel of relationships) {
    if (!idSet.has(rel.fromId) || !idSet.has(rel.toId)) continue
    outgoing.get(rel.fromId)!.push(rel.toId)
    incomingCount.set(rel.toId, (incomingCount.get(rel.toId) ?? 0) + 1)
  }

  const layers = new Map<string, number>()
  const visited = new Set<string>()

  function bfsFrom(rootIds: readonly string[], startLayer: number) {
    const queue: { id: string; layer: number }[] = rootIds.map((id) => ({ id, layer: startLayer }))
    for (const root of rootIds) visited.add(root)
    let head = 0
    while (head < queue.length) {
      const current = queue[head++]!
      const existing = layers.get(current.id)
      if (existing === undefined || current.layer < existing) layers.set(current.id, current.layer)
      for (const next of outgoing.get(current.id) ?? []) {
        if (visited.has(next)) continue
        visited.add(next)
        queue.push({ id: next, layer: current.layer + 1 })
      }
    }
  }

  const initialRoots = stableSortStrings(elements.filter((element) => element.kind === 'initialNode').map((element) => element.id))
  const zeroIndegreeRoots = stableSortStrings(ids.filter((id) => (incomingCount.get(id) ?? 0) === 0))
  const roots = initialRoots.length > 0 ? initialRoots : zeroIndegreeRoots
  if (roots.length > 0) bfsFrom(roots, 0)

  let remaining = stableSortStrings(ids.filter((id) => !layers.has(id)))
  while (remaining.length > 0) {
    const startLayer = layers.size > 0 ? Math.max(...layers.values()) + 1 : 0
    bfsFrom([remaining[0]!], startLayer)
    remaining = stableSortStrings(ids.filter((id) => !layers.has(id)))
  }

  return layers
}

function orderLayerMembers(
  layerKeys: readonly number[],
  byLayer: ReadonlyMap<number, string[]>,
  relationships: readonly UmlRelationship[],
): Map<number, string[]> {
  const ordered = new Map(layerKeys.map((layer) => [layer, stableSortStrings(byLayer.get(layer) ?? [])]))
  const layerById = new Map<string, number>()
  for (const layer of layerKeys) {
    for (const id of ordered.get(layer) ?? []) layerById.set(id, layer)
  }
  const neighbors = new Map<string, string[]>()
  for (const relationship of relationships) {
    const fromLayer = layerById.get(relationship.fromId)
    const toLayer = layerById.get(relationship.toId)
    if (fromLayer === undefined || toLayer === undefined || fromLayer === toLayer) continue
    neighbors.set(relationship.fromId, [...(neighbors.get(relationship.fromId) ?? []), relationship.toId])
    neighbors.set(relationship.toId, [...(neighbors.get(relationship.toId) ?? []), relationship.fromId])
  }

  const sweep = (layers: readonly number[]) => {
    const position = new Map<string, number>()
    for (const layer of layerKeys) {
      ;(ordered.get(layer) ?? []).forEach((id, index) => position.set(id, index))
    }
    for (const layer of layers) {
      const current = ordered.get(layer) ?? []
      const ranked = current.map((id) => {
        const connected = (neighbors.get(id) ?? [])
          .filter((neighborId) => layerById.get(neighborId) !== layer)
          .map((neighborId) => position.get(neighborId))
          .filter((entry): entry is number => entry !== undefined)
        const barycenter = connected.length > 0
          ? connected.reduce((sum, entry) => sum + entry, 0) / connected.length
          : Number.POSITIVE_INFINITY
        return { id, barycenter, previous: position.get(id) ?? 0 }
      })
      ranked.sort((a, b) =>
        a.barycenter - b.barycenter
        || a.previous - b.previous
        || a.id.localeCompare(b.id),
      )
      ordered.set(layer, ranked.map((entry) => entry.id))
    }
  }

  for (let pass = 0; pass < 4; pass += 1) {
    sweep(layerKeys.slice(1))
    sweep([...layerKeys].reverse().slice(1))
  }
  return ordered
}

function layoutLayeredNodes(projection: DiagramProjection, width: number, height: number, maxNodesPerRow: number): DiagramLayoutNode[] {
  const layers = computeLayers(projection.elements, projection.relationships)
  const byLayer = new Map<number, string[]>()
  for (const element of projection.elements) {
    const layer = layers.get(element.id) ?? 0
    const list = byLayer.get(layer) ?? []
    list.push(element.id)
    byLayer.set(layer, list)
  }

  const nodes: DiagramLayoutNode[] = []
  const layerKeys = [...byLayer.keys()].sort((a, b) => a - b)
  let layerY = 0
  for (const layerIndex of layerKeys) {
    const ids = stableSortStrings(byLayer.get(layerIndex)!)
    ids.forEach((id, index) => {
      const row = Math.floor(index / maxNodesPerRow)
      const column = index % maxNodesPerRow
      nodes.push({
        elementId: id,
        x: column * (width + NODE_GAP_X),
        y: layerY + row * (height + NODE_GAP_X),
        width,
        height,
      })
    })
    const rowCount = Math.max(1, Math.ceil(ids.length / maxNodesPerRow))
    layerY += rowCount * height + Math.max(0, rowCount - 1) * NODE_GAP_X + LAYER_GAP_Y
  }
  return nodes
}

/**
 * Orthogonal H-V-H / V-H-V route via a shared rail through a routing
 * corridor that is always node-free by construction: the exit/entry hops
 * stay within a node's own row/column band or the gap immediately outside
 * it, and the shared "collector" coordinate sits strictly beyond the extent
 * of every real node. This keeps every route clear of unrelated nodes
 * regardless of how many layers/rows/columns it spans, forward or backward
 * (§15.2 "keep at least the configured clearance between a line and
 * unrelated node"; "route multiple relationships through shared rails").
 */
function routeGeneric(from: DiagramLayoutNode, to: DiagramLayoutNode, axis: 'vertical' | 'horizontal', collector: number, gapOffset: number): Point[] {
  if (axis === 'vertical') {
    const sx = from.x + from.width / 2
    const tx = to.x + to.width / 2
    const exitY = from.y + from.height + gapOffset
    const entryY = to.y - gapOffset
    return [
      { x: sx, y: from.y + from.height },
      { x: sx, y: exitY },
      { x: collector, y: exitY },
      { x: collector, y: entryY },
      { x: tx, y: entryY },
      { x: tx, y: to.y },
    ]
  }
  const sy = from.y + from.height / 2
  const ty = to.y + to.height / 2
  const exitX = from.x + from.width + gapOffset
  const entryX = to.x - gapOffset
  return [
    { x: from.x + from.width, y: sy },
    { x: exitX, y: sy },
    { x: exitX, y: collector },
    { x: entryX, y: collector },
    { x: entryX, y: ty },
    { x: to.x, y: ty },
  ]
}

function degenerateEdge(rel: UmlRelationship): DiagramLayoutEdge {
  return { relationshipId: rel.id, points: [{ x: 0, y: 0 }, { x: 0, y: 0 }] }
}

function labelAtMidpoint(points: Point[], startIndex: number): Point {
  const a = points[startIndex]!
  const b = points[startIndex + 1]!
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function buildLayeredLayout(projection: DiagramProjection, width: number, height: number, maxNodesPerRow: number): { nodes: DiagramLayoutNode[]; edges: DiagramLayoutEdge[] } {
  const nodes = layoutLayeredNodes(projection, width, height, maxNodesPerRow)
  const nodeById = new Map(nodes.map((node) => [node.elementId, node]))
  const collectorX = nodes.length > 0 ? Math.max(...nodes.map((node) => node.x + node.width)) + COLLECTOR_MARGIN : 0

  const edges = projection.relationships.map((rel) => {
    const from = nodeById.get(rel.fromId)
    const to = nodeById.get(rel.toId)
    if (!from || !to) return degenerateEdge(rel)
    const points = routeGeneric(from, to, 'vertical', collectorX, GAP_BAND_OFFSET)
    const label = relationshipLabelText(rel)
    // Put the label on the target approach instead of the shared collector
    // rail. Several relationships intentionally share that rail; placing
    // every label there made them overwrite one another.
    return { relationshipId: rel.id, points, ...(label ? { labelPosition: labelAtMidpoint(points, 4) } : {}) }
  })

  return { nodes, edges }
}

/**
 * Activity and state diagrams read as vertical narratives, not wiring
 * harnesses. Place each semantic layer around one center line, route normal
 * forward flows through the whitespace between layers, and reserve distinct
 * outside rails only for loops or non-adjacent jumps. Recovery prose remains
 * part of the projection but is presented as a side note rather than a loose
 * action in the executable flow.
 *
 * This layout also handles system-level component projections, which have no
 * single semantic "main module" and therefore should read as a centered
 * topology rather than a module-and-ports diagram.
 */
function buildFlowLayout(
  projection: DiagramProjection,
  width: number,
  height: number,
  maxNodesPerRow: number,
): { nodes: DiagramLayoutNode[]; edges: DiagramLayoutEdge[] } {
  const annotations = projection.elements.filter((element) => element.sourceElementRef === 'recovery')
  const graphElements = projection.elements.filter((element) => element.sourceElementRef !== 'recovery')
  const graphIds = new Set(graphElements.map((element) => element.id))
  const graphRelationships = projection.relationships.filter((rel) => graphIds.has(rel.fromId) && graphIds.has(rel.toId))
  const layers = computeLayers(graphElements, graphRelationships)
  const byLayer = new Map<number, string[]>()
  for (const element of graphElements) {
    const layer = layers.get(element.id) ?? 0
    const ids = byLayer.get(layer) ?? []
    ids.push(element.id)
    byLayer.set(layer, ids)
  }

  const layerKeys = [...byLayer.keys()].sort((a, b) => a - b)
  const orderedByLayer = orderLayerMembers(layerKeys, byLayer, graphRelationships)
  const layerWidths = layerKeys.map((layer) => {
    const count = byLayer.get(layer)?.length ?? 0
    const columns = Math.min(maxNodesPerRow, Math.max(1, count))
    return columns * width + Math.max(0, columns - 1) * NODE_GAP_X
  })
  const systemTopology = projection.kind === 'component'
    && graphElements.length > 0
    && graphElements.every((element) => element.sourceElementRef?.startsWith('module:'))
  let graphWidth = Math.max(width, ...layerWidths)
  const nodes: DiagramLayoutNode[] = []
  let layerY = 0

  if (systemTopology) {
    const elementById = new Map(graphElements.map((element) => [element.id, element]))
    const relationshipCountToConnections = (elementId: string) => projection.relationships.filter((relationship) =>
      relationship.fromId === elementId
      && elementById.get(relationship.toId)?.sourceElementRef === 'module:connection',
    ).length
    const elementsOfType = (type: string) => graphElements
      .filter((element) => element.sourceElementRef === `module:${type}`)
      .sort((a, b) =>
        relationshipCountToConnections(a.id) - relationshipCountToConnections(b.id)
        || a.label.localeCompare(b.label)
        || a.id.localeCompare(b.id),
      )

    const coreGap = 70
    const coreColumns = 3
    const coreWidth = coreColumns * width + (coreColumns - 1) * coreGap
    const rowStep = height + 110
    const placeCoreRow = (elements: UmlElement[], y: number) => {
      const rowWidth = elements.length * width + Math.max(0, elements.length - 1) * coreGap
      const startX = (coreWidth - rowWidth) / 2
      elements.forEach((element, index) => {
        nodes.push({ elementId: element.id, x: startX + index * (width + coreGap), y, width, height })
      })
    }

    placeCoreRow(elementsOfType('experience'), 0)
    placeCoreRow(elementsOfType('workflow'), rowStep)
    placeCoreRow(elementsOfType('domain'), rowStep * 2)
    placeCoreRow(elementsOfType('platform'), rowStep * 3)

    const connections = elementsOfType('connection')
    const adapterColumns = 2
    const adapterGapX = 52
    const adapterGapY = 42
    const adapterStartX = coreWidth + 210
    connections.forEach((element, index) => {
      const column = index % adapterColumns
      const row = Math.floor(index / adapterColumns)
      nodes.push({
        elementId: element.id,
        x: adapterStartX + column * (width + adapterGapX),
        y: rowStep * .65 + row * (height + adapterGapY),
        width,
        height,
      })
    })
    graphWidth = adapterStartX + adapterColumns * width + (adapterColumns - 1) * adapterGapX
    layerY = Math.max(rowStep * 3 + height, ...nodes.map((node) => node.y + node.height))
  } else {
    layerKeys.forEach((layer, layerIndex) => {
      const ids = orderedByLayer.get(layer) ?? []
      const rowCount = Math.max(1, Math.ceil(ids.length / maxNodesPerRow))
      for (let row = 0; row < rowCount; row++) {
        const rowIds = ids.slice(row * maxNodesPerRow, row * maxNodesPerRow + maxNodesPerRow)
        const rowWidth = rowIds.length * width + Math.max(0, rowIds.length - 1) * NODE_GAP_X
        const rowX = (graphWidth - rowWidth) / 2
        rowIds.forEach((id, column) => {
          nodes.push({
            elementId: id,
            x: rowX + column * (width + NODE_GAP_X),
            y: layerY + row * (height + NODE_GAP_X),
            width,
            height,
          })
        })
      }
      const layerHeight = rowCount * height + Math.max(0, rowCount - 1) * NODE_GAP_X
      layerY += layerHeight + (layerIndex === layerKeys.length - 1 ? 0 : LAYER_GAP_Y)
    })
  }

  // Keep explanatory recovery behavior visibly related to the flow without
  // implying that it is another executable step or leaving it detached below
  // the final node.
  annotations.forEach((element, index) => {
    nodes.push({
      elementId: element.id,
      x: graphWidth + 220,
      y: Math.min(Math.max(height + 28, layerY / 3), Math.max(height + 28, layerY - height * 1.3)) + index * (height * 1.35 + NODE_GAP_X),
      width: Math.max(width * 1.8, 300),
      height: Math.max(height * 1.55, 104),
    })
  })

  const nodeById = new Map(nodes.map((node) => [node.elementId, node]))
  const kindById = new Map(projection.elements.map((element) => [element.id, element.kind]))
  const elementById = new Map(projection.elements.map((element) => [element.id, element]))
  const outgoing = new Map<string, UmlRelationship[]>()
  const incoming = new Map<string, UmlRelationship[]>()
  for (const relationship of projection.relationships) {
    const from = outgoing.get(relationship.fromId) ?? []
    from.push(relationship)
    outgoing.set(relationship.fromId, from)
    const to = incoming.get(relationship.toId) ?? []
    to.push(relationship)
    incoming.set(relationship.toId, to)
  }
  for (const relationships of [...outgoing.values(), ...incoming.values()]) {
    relationships.sort((a, b) => a.id.localeCompare(b.id))
  }

  const attachmentX = (node: DiagramLayoutNode, relationship: UmlRelationship, relationships: readonly UmlRelationship[]) => {
    const index = Math.max(relationships.findIndex((candidate) => candidate.id === relationship.id), 0)
    const step = Math.min(26, node.width / Math.max(relationships.length + 1, 2))
    return node.x + node.width / 2 + (index - (relationships.length - 1) / 2) * step
  }

  const loopRailIndex = new Map<string, number>()
  projection.relationships
    .filter((relationship) => {
      const fromLayer = layers.get(relationship.fromId) ?? 0
      const toLayer = layers.get(relationship.toId) ?? 0
      return toLayer <= fromLayer || toLayer - fromLayer > 1
    })
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach((relationship, index) => loopRailIndex.set(relationship.id, index))
  const topologyRelationshipIndex = new Map(
    [...projection.relationships]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((relationship, index) => [relationship.id, index]),
  )
  const connectionNodes = nodes.filter((node) => elementById.get(node.elementId)?.sourceElementRef === 'module:connection')
  const coreNodes = nodes.filter((node) => elementById.get(node.elementId)?.sourceElementRef !== 'module:connection')
  const connectionLeft = connectionNodes.length > 0 ? Math.min(...connectionNodes.map((node) => node.x)) : graphWidth
  const coreRight = coreNodes.length > 0 ? Math.max(...coreNodes.map((node) => node.x + node.width)) : 0

  const edges = projection.relationships.map((rel) => {
    const from = nodeById.get(rel.fromId)
    const to = nodeById.get(rel.toId)
    if (!from || !to) return degenerateEdge(rel)

    const fromLayer = layers.get(rel.fromId) ?? 0
    const toLayer = layers.get(rel.toId) ?? 0
    const normalForwardFlow = toLayer === fromLayer + 1 && to.y > from.y + from.height
    let points: Point[]
    let labelPosition: Point | undefined

    if (projection.kind === 'component') {
      const relationshipIndex = topologyRelationshipIndex.get(rel.id) ?? 0
      const sourceX = attachmentX(from, rel, outgoing.get(rel.fromId) ?? [rel])
      const targetX = attachmentX(to, rel, incoming.get(rel.toId) ?? [rel])
      const sourceY = from.y + from.height
      const targetY = to.y

      if (systemTopology && elementById.get(rel.toId)?.sourceElementRef === 'module:connection') {
        const availableGap = Math.max(72, connectionLeft - coreRight)
        const laneStep = Math.max(10, (availableGap - 64) / Math.max(connectionNodes.length - 1, 1))
        const laneX = coreRight + 32 + (relationshipIndex % Math.max(connectionNodes.length, 1)) * laneStep
        const sourceCenterY = from.y + from.height / 2
        const targetCenterY = to.y + to.height / 2
        points = [
          { x: from.x + from.width, y: sourceCenterY },
          { x: laneX, y: sourceCenterY },
          { x: laneX, y: targetCenterY },
          { x: to.x, y: targetCenterY },
        ]
        labelPosition = labelAtMidpoint(points, 0)
      } else if (Math.abs(from.y - to.y) < 1) {
        // Same-rank dependencies use a short channel immediately below their
        // row. This keeps peer relationships local instead of sending them to
        // the edge of the whole architecture canvas.
        const channelY = from.y + from.height + 24 + (relationshipIndex % 5) * 10
        points = [
          { x: sourceX, y: sourceY },
          { x: sourceX, y: channelY },
          { x: targetX, y: channelY },
          { x: targetX, y: to.y + to.height },
        ]
        labelPosition = labelAtMidpoint(points, 1)
      } else if (to.y > from.y + from.height) {
        const verticalDistance = targetY - sourceY
        if (verticalDistance <= LAYER_GAP_Y + 8) {
          const channelY = sourceY + verticalDistance / 2
          points = [
            { x: sourceX, y: sourceY },
            { x: sourceX, y: channelY },
            { x: targetX, y: channelY },
            { x: targetX, y: targetY },
          ]
          labelPosition = labelAtMidpoint(points, 1)
        } else {
          // Long forward dependencies travel down a real inter-column gap.
          // The rail starts below the source and leaves above the target, so
          // it never becomes a screen-wide bus across component faces.
          const internalRails = Array.from(
            { length: Math.max(1, maxNodesPerRow - 1) },
            (_, index) => width + NODE_GAP_X / 2 + index * (width + NODE_GAP_X),
          )
          const railX = internalRails
            .map((x) => ({ x, distance: Math.abs(sourceX - x) + Math.abs(targetX - x) }))
            .sort((a, b) => a.distance - b.distance || a.x - b.x)[0]!.x
          const exitY = sourceY + 22 + (relationshipIndex % 3) * 8
          const entryY = targetY - 22 - (relationshipIndex % 3) * 8
          points = [
            { x: sourceX, y: sourceY },
            { x: sourceX, y: exitY },
            { x: railX, y: exitY },
            { x: railX, y: entryY },
            { x: targetX, y: entryY },
            { x: targetX, y: targetY },
          ]
          labelPosition = labelAtMidpoint(points, 4)
        }
      } else {
        const useLeftRail = from.x + from.width / 2 < graphWidth / 2
        const railOffset = 72 + (relationshipIndex % 4) * 24
        const railX = useLeftRail ? -railOffset : graphWidth + railOffset
        const sourceCenterY = from.y + from.height / 2
        const targetCenterY = to.y + to.height / 2
        points = [
          { x: useLeftRail ? from.x : from.x + from.width, y: sourceCenterY },
          { x: railX, y: sourceCenterY },
          { x: railX, y: targetCenterY },
          { x: useLeftRail ? to.x : to.x + to.width, y: targetCenterY },
        ]
        labelPosition = labelAtMidpoint(points, 0)
      }
    } else if (normalForwardFlow) {
      const sourceX = attachmentX(from, rel, outgoing.get(rel.fromId) ?? [rel])
      const targetX = attachmentX(to, rel, incoming.get(rel.toId) ?? [rel])
      const sourceKind = kindById.get(rel.fromId)
      const targetKind = kindById.get(rel.toId)
      const sourceY = sourceKind === 'initialNode' || sourceKind === 'finalNode'
        ? from.y + from.height / 2 + 12
        : from.y + from.height
      const targetY = targetKind === 'initialNode' || targetKind === 'finalNode'
        ? to.y + to.height / 2 - 12
        : to.y
      if (Math.abs(sourceX - targetX) < 1) {
        points = [{ x: sourceX, y: sourceY }, { x: targetX, y: targetY }]
        labelPosition = { x: sourceX + 36, y: (sourceY + targetY) / 2 }
      } else {
        const channelY = sourceY + (targetY - sourceY) / 2
        points = [
          { x: sourceX, y: sourceY },
          { x: sourceX, y: channelY },
          { x: targetX, y: channelY },
          { x: targetX, y: targetY },
        ]
        labelPosition = labelAtMidpoint(points, 1)
      }
    } else {
      // A loop exits from the nearest outside edge so it cannot run through a
      // sibling node in the same row. A compact bank of stable rails prevents
      // dense system topologies from expanding into a screen-wide collector.
      const useLeftRail = from.x + from.width / 2 < graphWidth / 2
      const railOffset = 72 + ((loopRailIndex.get(rel.id) ?? 0) % 6) * 30
      const railX = useLeftRail ? -railOffset : graphWidth + railOffset
      const sourceY = from.y + from.height / 2
      const targetY = to.y + to.height / 2
      const sourceX = useLeftRail ? from.x : from.x + from.width
      const targetX = useLeftRail ? to.x : to.x + to.width
      points = [
        { x: sourceX, y: sourceY },
        { x: railX, y: sourceY },
        { x: railX, y: targetY },
        { x: targetX, y: targetY },
      ]
      // Keep loop labels on the outside rail. Centering a long label on the
      // short node-to-rail exit can place its background back over the source
      // state even when the anchor point itself clears the node.
      labelPosition = labelAtMidpoint(points, 1)
    }

    const label = relationshipLabelText(rel)
    return { relationshipId: rel.id, points, ...(label && labelPosition ? { labelPosition } : {}) }
  })

  return { nodes, edges }
}

// ---------------------------------------------------------------------------
// Component layout: semantic center with consumers, dependencies, and ports
// ---------------------------------------------------------------------------

/**
 * Component projections are not generic flow charts. Treating every
 * provided/required interface as another node in one BFS layer produced a
 * multi-thousand-pixel row and a collector rail far outside the visible
 * diagram. This layout keeps the module component central, consumers above,
 * dependencies below, and UML interface symbols at the left/right edges.
 */
function buildComponentLayout(projection: DiagramProjection, width: number, height: number): { nodes: DiagramLayoutNode[]; edges: DiagramLayoutEdge[] } {
  const elementById = new Map(projection.elements.map((element) => [element.id, element]))
  const components = projection.elements.filter((element) => element.kind === 'component')
  const semanticMain = components.find((element) => element.sourceElementRef === 'module')
  const provided = projection.elements.filter((element) => element.kind === 'providedInterface')
  const required = projection.elements.filter((element) => element.kind === 'requiredInterface')
  if (!semanticMain && provided.length === 0 && required.length === 0) {
    return buildFlowLayout(projection, width, height, 4)
  }
  const main = semanticMain
    ?? [...components].sort((a, b) => {
      const degree = projection.relationships.filter((rel) => rel.fromId === b.id || rel.toId === b.id).length
        - projection.relationships.filter((rel) => rel.fromId === a.id || rel.toId === a.id).length
      return degree || a.id.localeCompare(b.id)
    })[0]
  if (!main) return buildLayeredLayout(projection, width, height, 4)

  const consumerIds = new Set(
    projection.relationships.filter((rel) => rel.toId === main.id && elementById.get(rel.fromId)?.kind === 'component').map((rel) => rel.fromId),
  )
  const dependencyIds = new Set(
    projection.relationships.filter((rel) => rel.fromId === main.id && elementById.get(rel.toId)?.kind === 'component').map((rel) => rel.toId),
  )
  const consumers = components.filter((element) => consumerIds.has(element.id))
  const dependencies = components.filter((element) => dependencyIds.has(element.id))
  const remaining = components.filter((element) => element.id !== main.id && !consumerIds.has(element.id) && !dependencyIds.has(element.id))
  const lowerComponents = [...dependencies, ...remaining]

  const sideGap = 90
  const centerX = width * 2 + sideGap * 2
  const leftX = 0
  const widestComponentRowCount = Math.max(
    Math.min(4, consumers.length),
    Math.min(4, lowerComponents.length),
    1,
  )
  const widestComponentRowWidth = widestComponentRowCount * width
    + Math.max(0, widestComponentRowCount - 1) * NODE_GAP_X
  const componentRowRightEdge = centerX + width / 2 + widestComponentRowWidth / 2
  // Interface columns sit beyond every peer component. Otherwise a route to
  // the rightmost dependency can pass directly through required-interface
  // glyphs, which is both visually ambiguous and invalid under §15.2.
  const rightX = Math.max(
    centerX + width + sideGap * 2,
    componentRowRightEdge + sideGap,
  )
  const consumerRows = Math.max(1, Math.ceil(consumers.length / 4))
  const consumerBottom = consumers.length > 0
    ? consumerRows * height + Math.max(0, consumerRows - 1) * NODE_GAP_X
    : 0
  // Reserve one distinct horizontal channel per consumer between the peer
  // rows and the main component. Without this dynamic band, the fifth and
  // later consumer routes could climb back into a wrapped peer row, putting
  // both the connector and its label on top of an unrelated component.
  const mainY = Math.max(180, consumerBottom + 64 + Math.max(0, consumers.length - 1) * 18)
  const sideStep = height + 22
  const sideCount = Math.max(provided.length, required.length)
  const simpleBoundary = sideCount === 0 && consumers.length + lowerComponents.length <= 2
  const dependencyY = Math.max(mainY + height + (simpleBoundary ? 96 : 250), 70 + sideCount * sideStep)

  const nodes: DiagramLayoutNode[] = [{ elementId: main.id, x: centerX, y: mainY, width, height }]

  function placeCenteredRow(elements: UmlElement[], y: number) {
    const maxPerRow = 4
    elements.forEach((element, index) => {
      const row = Math.floor(index / maxPerRow)
      const rowItems = elements.slice(row * maxPerRow, row * maxPerRow + maxPerRow)
      const rowWidth = rowItems.length * width + Math.max(0, rowItems.length - 1) * NODE_GAP_X
      const x = centerX + width / 2 - rowWidth / 2 + (index % maxPerRow) * (width + NODE_GAP_X)
      nodes.push({ elementId: element.id, x, y: y + row * (height + NODE_GAP_X), width, height })
    })
  }

  placeCenteredRow(consumers, 0)
  placeCenteredRow(lowerComponents, dependencyY)
  provided.forEach((element, index) => nodes.push({ elementId: element.id, x: leftX, y: 80 + index * sideStep, width, height }))
  required.forEach((element, index) => nodes.push({ elementId: element.id, x: rightX, y: 45 + index * sideStep, width, height }))

  const nodeById = new Map(nodes.map((node) => [node.elementId, node]))
  // Component-to-component relationships share a rail in the clear corridor
  // between the peer rows and the required-interface column. Branching from
  // that rail immediately above each target row prevents a dependency bound
  // for a wrapped row from running through components in earlier rows.
  const componentCollectorX = componentRowRightEdge + 24
  const providedIndex = new Map(provided.map((element, index) => [element.id, index]))
  const requiredIndex = new Map(required.map((element, index) => [element.id, index]))
  const interfaceAnchorY = (index: number, count: number) => mainY + ((index + 1) * height) / (count + 1)

  const edges = projection.relationships.map((rel) => {
    const from = nodeById.get(rel.fromId)
    const to = nodeById.get(rel.toId)
    if (!from || !to) return degenerateEdge(rel)
    let points: Point[]
    let labelPosition: Point | undefined

    if (rel.toId === main.id && elementById.get(rel.fromId)?.kind === 'component') {
      points = routeGeneric(from, to, 'vertical', componentCollectorX, GAP_BAND_OFFSET)
      labelPosition = labelAtMidpoint(points, 0)
    } else if (rel.fromId === main.id && elementById.get(rel.toId)?.kind === 'component') {
      points = routeGeneric(from, to, 'vertical', componentCollectorX, GAP_BAND_OFFSET)
      labelPosition = labelAtMidpoint(points, 4)
    } else if (rel.fromId === main.id && elementById.get(rel.toId)?.kind === 'providedInterface') {
      const index = providedIndex.get(rel.toId) ?? 0
      const sy = interfaceAnchorY(index, provided.length)
      const ty = to.y + to.height / 2
      // Provided interfaces share the matching left-side rail. Branches meet
      // the rail orthogonally instead of weaving through one another.
      const channelX = leftX + width + 36
      points = [{ x: from.x, y: sy }, { x: channelX, y: sy }, { x: channelX, y: ty }, { x: to.x + to.width, y: ty }]
    } else if (rel.fromId === main.id && elementById.get(rel.toId)?.kind === 'requiredInterface') {
      const index = requiredIndex.get(rel.toId) ?? 0
      const sy = interfaceAnchorY(index, required.length)
      const ty = to.y + to.height / 2
      // Required interfaces share a stable rail in the right-side corridor.
      // Keeping that rail beyond the component collector prevents the
      // dependency bus from cutting across every required-interface branch.
      const channelX = rightX - 36
      points = [{ x: from.x + from.width, y: sy }, { x: channelX, y: sy }, { x: channelX, y: ty }, { x: to.x, y: ty }]
    } else {
      const collector = rightX + width + COLLECTOR_MARGIN
      points = routeGeneric(from, to, 'vertical', collector, GAP_BAND_OFFSET)
      labelPosition = labelAtMidpoint(points, 4)
    }
    const label = relationshipLabelText(rel)
    return { relationshipId: rel.id, points, ...(label && labelPosition ? { labelPosition } : {}) }
  })
  return { nodes, edges }
}

// ---------------------------------------------------------------------------
// Sequence layout: fixed lifeline columns, top-to-bottom messages
// ---------------------------------------------------------------------------

function buildSequenceLayout(projection: DiagramProjection, width: number, height: number): { nodes: DiagramLayoutNode[]; edges: DiagramLayoutEdge[] } {
  const lifelines = projection.elements.filter((element) => element.kind === 'lifeline')
  const fragments = projection.elements.filter((element) => element.kind === 'fragment')

  const nodes: DiagramLayoutNode[] = []
  const xById = new Map<string, number>()
  lifelines.forEach((lifeline, index) => {
    const x = index * (width + LIFELINE_GAP_X)
    xById.set(lifeline.id, x)
    nodes.push({ elementId: lifeline.id, x, y: HEADER_HEIGHT_EXTRA, width, height })
  })

  const messageRelationships = projection.relationships.filter((rel) => rel.kind === 'message' || rel.kind === 'reply')
  const edges: DiagramLayoutEdge[] = []
  let messageY = height + MESSAGE_START_GAP

  messageRelationships.forEach((rel) => {
    const fromX = xById.get(rel.fromId)
    const toX = xById.get(rel.toId)
    if (fromX === undefined || toX === undefined) {
      edges.push(degenerateEdge(rel))
      return
    }
    const fromCenter = fromX + width / 2
    const toCenter = toX + width / 2
    const selfMessage = rel.fromId === rel.toId
    const points: Point[] = selfMessage
      ? [
          { x: fromCenter, y: messageY },
          { x: fromCenter + 54, y: messageY },
          { x: fromCenter + 54, y: messageY + 28 },
          { x: fromCenter, y: messageY + 28 },
        ]
      : [
          { x: fromCenter, y: messageY },
          { x: toCenter, y: messageY },
        ]
    const label = relationshipLabelText(rel)
    edges.push({
      relationshipId: rel.id,
      points,
      ...(label
        ? {
            labelPosition: {
              x: selfMessage ? fromCenter + 27 : (fromCenter + toCenter) / 2,
              y: messageY - LABEL_OFFSET_Y,
            },
          }
        : {}),
    })
    messageY += MESSAGE_GAP_Y + (selfMessage ? 28 : 0)
  })

  if (fragments.length > 0 && lifelines.length > 0) {
    const totalWidth = (lifelines.length - 1) * (width + LIFELINE_GAP_X) + width
    const fragmentTop = height + 24
    const fragmentHeight = Math.max(height + 40, messageY - fragmentTop)
    fragments.forEach((fragment, index) => {
      const inset = index * 10
      nodes.unshift({
        elementId: fragment.id,
        x: -18 + inset,
        y: fragmentTop + inset,
        width: totalWidth + 36 - inset * 2,
        height: fragmentHeight - inset * 2,
      })
    })
  }

  // Never drop a relationship: any non message/reply relationship on a sequence
  // projection still gets an edge entry via the generic node-center fallback.
  const nodeById = new Map(nodes.map((node) => [node.elementId, node]))
  for (const rel of projection.relationships) {
    if (rel.kind === 'message' || rel.kind === 'reply') continue
    const from = nodeById.get(rel.fromId)
    const to = nodeById.get(rel.toId)
    if (!from || !to) {
      edges.push(degenerateEdge(rel))
      continue
    }
    const points = [{ x: from.x + from.width / 2, y: from.y + from.height / 2 }, { x: to.x + to.width / 2, y: to.y + to.height / 2 }]
    edges.push({ relationshipId: rel.id, points })
  }

  return { nodes, edges }
}

// ---------------------------------------------------------------------------
// Use case layout: boundary box + actor column + use-case column
// ---------------------------------------------------------------------------

function buildUseCaseLayout(projection: DiagramProjection, width: number, height: number): { nodes: DiagramLayoutNode[]; edges: DiagramLayoutEdge[] } {
  const boundary = projection.elements.find((element) => element.kind === 'systemBoundary')
  const actors = projection.elements.filter((element) => element.kind === 'actor')
  const useCases = projection.elements.filter((element) => element.kind === 'useCase')
  const actorWidth = Math.max(Math.round(width * 0.7), MIN_NODE_WIDTH)
  const actorHeight = Math.max(height + 32, 96)
  const boundaryX = actorWidth + ACTOR_COLUMN_GAP
  const useCaseIndex = new Map(useCases.map((entry, index) => [entry.id, index]))
  const actorSet = new Set(actors.map((entry) => entry.id))
  const useCaseSet = new Set(useCases.map((entry) => entry.id))
  const actorTargets = new Map<string, number[]>()
  for (const relationship of projection.relationships) {
    const actorId = actorSet.has(relationship.fromId)
      ? relationship.fromId
      : actorSet.has(relationship.toId)
        ? relationship.toId
        : undefined
    const useCaseId = useCaseSet.has(relationship.fromId)
      ? relationship.fromId
      : useCaseSet.has(relationship.toId)
        ? relationship.toId
        : undefined
    if (!actorId || !useCaseId) continue
    actorTargets.set(actorId, [...(actorTargets.get(actorId) ?? []), useCaseIndex.get(useCaseId) ?? 0])
  }
  const orderedActors = [...actors].sort((a, b) => {
    const aTargets = actorTargets.get(a.id) ?? []
    const bTargets = actorTargets.get(b.id) ?? []
    const average = (values: number[]) => values.length > 0
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : Number.POSITIVE_INFINITY
    return average(aTargets) - average(bTargets)
      || bTargets.length - aTargets.length
      || a.id.localeCompare(b.id)
  })

  const actorNodes: DiagramLayoutNode[] = []
  let nextActorY = 0
  for (const actor of orderedActors) {
    const targets = actorTargets.get(actor.id) ?? []
    const averageTarget = targets.length > 0
      ? targets.reduce((sum, value) => sum + value, 0) / targets.length
      : actorNodes.length
    const desiredY = BOUNDARY_PADDING + averageTarget * (height + NODE_GAP_X) + height / 2 - actorHeight / 2
    const y = Math.max(nextActorY, desiredY)
    actorNodes.push({ elementId: actor.id, x: 0, y, width: actorWidth, height: actorHeight })
    nextActorY = y + actorHeight + 24
  }

  const useCaseNodes = useCases.map((useCase, index) => ({
    elementId: useCase.id,
    x: boundaryX + BOUNDARY_PADDING,
    y: BOUNDARY_PADDING + index * (height + NODE_GAP_X),
    width,
    height,
  }))
  const useCaseRelationships = projection.relationships.filter((entry) =>
    useCaseSet.has(entry.fromId) && useCaseSet.has(entry.toId),
  )
  const relationRailIndex = new Map(
    [...useCaseRelationships]
      .sort((a, b) => {
        const aSpan = Math.abs((useCaseIndex.get(a.fromId) ?? 0) - (useCaseIndex.get(a.toId) ?? 0))
        const bSpan = Math.abs((useCaseIndex.get(b.fromId) ?? 0) - (useCaseIndex.get(b.toId) ?? 0))
        return aSpan - bSpan || a.id.localeCompare(b.id)
      })
      .map((entry, index) => [entry.id, index]),
  )
  const relationRailWidth = useCaseRelationships.length > 0
    ? 48 + Math.max(0, useCaseRelationships.length - 1) * 18
    : 0
  const actorsBottom = actorNodes.length > 0 ? Math.max(...actorNodes.map((entry) => entry.y + entry.height)) : 0
  const useCasesBottom = useCaseNodes.length > 0 ? Math.max(...useCaseNodes.map((entry) => entry.y + entry.height)) : height
  const contentBottom = Math.max(actorsBottom, useCasesBottom, height)
  const boundaryWidth = width + 2 * BOUNDARY_PADDING + relationRailWidth
  const boundaryNode = boundary
    ? { elementId: boundary.id, x: boundaryX, y: 0, width: boundaryWidth, height: contentBottom + BOUNDARY_PADDING }
    : undefined
  const nodes = [...(boundaryNode ? [boundaryNode] : []), ...actorNodes, ...useCaseNodes]
  const nodeById = new Map(nodes.map((node) => [node.elementId, node]))

  const actorAssociations = projection.relationships.filter((entry) =>
    (actorSet.has(entry.fromId) && useCaseSet.has(entry.toId))
    || (actorSet.has(entry.toId) && useCaseSet.has(entry.fromId)),
  )
  const associationsByActor = new Map<string, UmlRelationship[]>()
  for (const entry of actorAssociations) {
    const actorId = actorSet.has(entry.fromId) ? entry.fromId : entry.toId
    associationsByActor.set(actorId, [...(associationsByActor.get(actorId) ?? []), entry])
  }
  for (const entries of associationsByActor.values()) {
    entries.sort((a, b) => {
      const aUseCase = actorSet.has(a.fromId) ? a.toId : a.fromId
      const bUseCase = actorSet.has(b.fromId) ? b.toId : b.fromId
      return (useCaseIndex.get(aUseCase) ?? 0) - (useCaseIndex.get(bUseCase) ?? 0) || a.id.localeCompare(b.id)
    })
  }
  const associationOrder = [...actorAssociations].sort((a, b) => {
    const aActor = actorSet.has(a.fromId) ? a.fromId : a.toId
    const bActor = actorSet.has(b.fromId) ? b.fromId : b.toId
    const aUseCase = actorSet.has(a.fromId) ? a.toId : a.fromId
    const bUseCase = actorSet.has(b.fromId) ? b.toId : b.fromId
    const aActorY = nodeById.get(aActor)?.y ?? 0
    const bActorY = nodeById.get(bActor)?.y ?? 0
    return aActorY - bActorY
      || (useCaseIndex.get(aUseCase) ?? 0) - (useCaseIndex.get(bUseCase) ?? 0)
      || a.id.localeCompare(b.id)
  })
  const associationChannelIndex = new Map(associationOrder.map((entry, index) => [entry.id, index]))
  const channelBandStart = actorWidth + 18
  const channelBandWidth = Math.max(24, boundaryX - channelBandStart - 18)
  const associationChannelX = (relationshipId: string) =>
    channelBandStart
    + ((associationChannelIndex.get(relationshipId) ?? 0) + 1)
      * channelBandWidth / Math.max(actorAssociations.length + 1, 2)

  const edges: DiagramLayoutEdge[] = projection.relationships.map((rel) => {
    const from = nodeById.get(rel.fromId)
    const to = nodeById.get(rel.toId)
    if (!from || !to) return degenerateEdge(rel)

    // Containment (boundary -> use case) is implied by nesting; UML draws no
    // line for it, so this is a degenerate (zero-length) edge at the target.
    if (boundary && rel.fromId === boundary.id) {
      const center = { x: to.x + to.width / 2, y: to.y + to.height / 2 }
      return { relationshipId: rel.id, points: [center, center] }
    }

    const fromKind = projection.elements.find((entry) => entry.id === rel.fromId)?.kind
    const toKind = projection.elements.find((entry) => entry.id === rel.toId)?.kind
    let points: Point[]
    if (fromKind === 'actor' && toKind === 'useCase') {
      const entries = associationsByActor.get(rel.fromId) ?? [rel]
      const associationIndex = Math.max(entries.findIndex((entry) => entry.id === rel.id), 0)
      const sourceOffset = (associationIndex - (entries.length - 1) / 2) * Math.min(14, from.height / Math.max(entries.length + 1, 2))
      const sy = from.y + from.height / 2 + sourceOffset
      const ty = to.y + to.height / 2
      const channelX = associationChannelX(rel.id)
      points = [
        { x: from.x + from.width / 2, y: sy },
        { x: channelX, y: sy },
        { x: channelX, y: ty },
        { x: to.x, y: ty },
      ]
    } else if (fromKind === 'useCase' && toKind === 'actor') {
      const sy = from.y + from.height / 2
      const entries = associationsByActor.get(rel.toId) ?? [rel]
      const associationIndex = Math.max(entries.findIndex((entry) => entry.id === rel.id), 0)
      const targetOffset = (associationIndex - (entries.length - 1) / 2) * Math.min(14, to.height / Math.max(entries.length + 1, 2))
      const ty = to.y + to.height / 2 + targetOffset
      const channelX = associationChannelX(rel.id)
      points = [
        { x: from.x, y: sy },
        { x: channelX, y: sy },
        { x: channelX, y: ty },
        { x: to.x + to.width / 2, y: ty },
      ]
    } else if (fromKind === 'useCase' && toKind === 'useCase') {
      const railX = boundaryX + BOUNDARY_PADDING + width + 24 + (relationRailIndex.get(rel.id) ?? 0) * 18
      const sy = from.y + from.height / 2
      const ty = to.y + to.height / 2
      points = [
        { x: from.x + from.width, y: sy },
        { x: railX, y: sy },
        { x: railX, y: ty },
        { x: to.x + to.width, y: ty },
      ]
    } else {
      const collectorY = contentBottom + COLLECTOR_MARGIN
      points = routeGeneric(from, to, 'horizontal', collectorY, USE_CASE_COLUMN_GAP_OFFSET)
    }
    const label = relationshipLabelText(rel)
    const labelSegment = fromKind === 'useCase' && toKind === 'useCase' ? 1 : 2
    return { relationshipId: rel.id, points, ...(label ? { labelPosition: labelAtMidpoint(points, labelSegment) } : {}) }
  })

  return { nodes, edges }
}

// ---------------------------------------------------------------------------
// Geometry helpers for collision checking
// ---------------------------------------------------------------------------

function rectsOverlap(a: DiagramLayoutNode, b: DiagramLayoutNode): boolean {
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y)
}

function pointInRect(p: Point, rect: DiagramLayoutNode): boolean {
  return p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height
}

function pointsEqual(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y
}

function orientation(p: Point, q: Point, r: Point): 0 | 1 | 2 {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y)
  if (Math.abs(val) < 1e-9) return 0
  return val > 0 ? 1 : 2
}

function onSegment(p: Point, q: Point, r: Point): boolean {
  return (
    Math.min(p.x, r.x) - 1e-9 <= q.x && q.x <= Math.max(p.x, r.x) + 1e-9 && Math.min(p.y, r.y) - 1e-9 <= q.y && q.y <= Math.max(p.y, r.y) + 1e-9
  )
}

/** Proper (transversal) intersection only — collinear/overlapping shared rails are not "crossings" (§15.2). */
function properIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const o1 = orientation(p1, p2, p3)
  const o2 = orientation(p1, p2, p4)
  const o3 = orientation(p3, p4, p1)
  const o4 = orientation(p3, p4, p2)
  return o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0 && o1 !== o2 && o3 !== o4
}

/** Intersection or touch (including collinear overlap) — used for zero-distance short-circuiting. */
function segmentsIntersectOrTouch(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const o1 = orientation(p1, p2, p3)
  const o2 = orientation(p1, p2, p4)
  const o3 = orientation(p3, p4, p1)
  const o4 = orientation(p3, p4, p2)
  if (o1 !== o2 && o3 !== o4) return true
  if (o1 === 0 && onSegment(p1, p3, p2)) return true
  if (o2 === 0 && onSegment(p1, p4, p2)) return true
  if (o3 === 0 && onSegment(p3, p1, p4)) return true
  if (o4 === 0 && onSegment(p3, p2, p4)) return true
  return false
}

function pointSegDistance(p: Point, a: Point, b: Point): number {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const lengthSq = abx * abx + aby * aby
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lengthSq
  t = Math.max(0, Math.min(1, t))
  const projX = a.x + t * abx
  const projY = a.y + t * aby
  return Math.hypot(p.x - projX, p.y - projY)
}

function segSegDistance(p1: Point, p2: Point, p3: Point, p4: Point): number {
  if (segmentsIntersectOrTouch(p1, p2, p3, p4)) return 0
  return Math.min(pointSegDistance(p1, p3, p4), pointSegDistance(p2, p3, p4), pointSegDistance(p3, p1, p2), pointSegDistance(p4, p1, p2))
}

function rectCorners(rect: DiagramLayoutNode): Point[] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ]
}

function segmentToRectDistance(p1: Point, p2: Point, rect: DiagramLayoutNode): number {
  if (pointInRect(p1, rect) || pointInRect(p2, rect)) return 0
  const corners = rectCorners(rect)
  const edges: [Point, Point][] = [
    [corners[0]!, corners[1]!],
    [corners[1]!, corners[2]!],
    [corners[2]!, corners[3]!],
    [corners[3]!, corners[0]!],
  ]
  return Math.min(...edges.map(([a, b]) => segSegDistance(p1, p2, a, b)))
}

function toSegments(points: readonly Point[]): [Point, Point][] {
  const segments: [Point, Point][] = []
  for (let i = 0; i + 1 < points.length; i++) segments.push([points[i]!, points[i + 1]!])
  return segments
}

function sharesEndpoint(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  return pointsEqual(a1, b1) || pointsEqual(a1, b2) || pointsEqual(a2, b1) || pointsEqual(a2, b2)
}

function countCrossings(edges: readonly DiagramLayoutEdge[]): number {
  let count = 0
  for (let i = 0; i < edges.length; i++) {
    const segmentsA = toSegments(edges[i]!.points)
    for (let j = i + 1; j < edges.length; j++) {
      const segmentsB = toSegments(edges[j]!.points)
      for (const [a1, a2] of segmentsA) {
        for (const [b1, b2] of segmentsB) {
          if (sharesEndpoint(a1, a2, b1, b2)) continue
          if (properIntersect(a1, a2, b1, b2)) count++
        }
      }
    }
  }
  return count
}

function segmentOverlapLength(a1: Point, a2: Point, b1: Point, b2: Point): number {
  if (orientation(a1, a2, b1) !== 0 || orientation(a1, a2, b2) !== 0) return 0
  const useX = Math.abs(a2.x - a1.x) >= Math.abs(a2.y - a1.y)
  const aStart = useX ? a1.x : a1.y
  const aEnd = useX ? a2.x : a2.y
  const bStart = useX ? b1.x : b1.y
  const bEnd = useX ? b2.x : b2.y
  return Math.max(0, Math.min(Math.max(aStart, aEnd), Math.max(bStart, bEnd))
    - Math.max(Math.min(aStart, aEnd), Math.min(bStart, bEnd)))
}

function countOverlappingEdgePairs(edges: readonly DiagramLayoutEdge[]): number {
  let count = 0
  for (let i = 0; i < edges.length; i++) {
    const segmentsA = toSegments(edges[i]!.points)
    for (let j = i + 1; j < edges.length; j++) {
      const segmentsB = toSegments(edges[j]!.points)
      const overlaps = segmentsA.some(([a1, a2]) =>
        segmentsB.some(([b1, b2]) => segmentOverlapLength(a1, a2, b1, b2) > 4),
      )
      if (overlaps) count += 1
    }
  }
  return count
}

type LabelRect = { relationshipId: string; x: number; y: number; width: number; height: number }

function labelRect(edge: DiagramLayoutEdge, relationship: UmlRelationship | undefined): LabelRect | undefined {
  const text = relationship ? relationshipLabelText(relationship) : undefined
  if (!edge.labelPosition || !text) return undefined
  const visibleLength = Math.min(text.length, 32)
  const width = visibleLength * 6.8 + 14
  return {
    relationshipId: edge.relationshipId,
    x: edge.labelPosition.x - width / 2,
    y: edge.labelPosition.y - 17,
    width,
    height: 17,
  }
}

function labelRectOverlapsNode(label: LabelRect, node: DiagramLayoutNode): boolean {
  return !(
    label.x + label.width <= node.x
    || node.x + node.width <= label.x
    || label.y + label.height <= node.y
    || node.y + node.height <= label.y
  )
}

function labelRectsOverlap(a: LabelRect, b: LabelRect): boolean {
  return !(
    a.x + a.width <= b.x
    || b.x + b.width <= a.x
    || a.y + a.height <= b.y
    || b.y + b.height <= a.y
  )
}

export function analyzeLayoutQuality(
  layout: DiagramLayout,
  projection: DiagramProjection,
  options: DiagramLayoutOptions = {},
): DiagramLayoutQuality {
  const kindByElementId = new Map(projection.elements.map((entry) => [entry.id, entry.kind]))
  const relationshipById = new Map(projection.relationships.map((entry) => [entry.id, entry]))
  const clearance = options.clearance ?? DEFAULT_CLEARANCE
  let edgeNodeClearanceViolations = 0
  let bendCount = 0
  let totalEdgeLength = 0

  for (const edge of layout.edges) {
    const relationship = relationshipById.get(edge.relationshipId)
    const relatedIds = new Set(relationship ? [relationship.fromId, relationship.toId] : [])
    const segments = toSegments(edge.points)
    bendCount += Math.max(0, segments.length - 1)
    for (const [a, b] of segments) totalEdgeLength += Math.hypot(b.x - a.x, b.y - a.y)
    for (const node of layout.nodes) {
      if (relatedIds.has(node.elementId) || isContainerKind(kindByElementId.get(node.elementId))) continue
      const minDistance = Math.min(...segments.map(([a, b]) => segmentToRectDistance(a, b, node)))
      if (minDistance < clearance) edgeNodeClearanceViolations += 1
    }
  }

  const labels = layout.edges
    .map((edge) => labelRect(edge, relationshipById.get(edge.relationshipId)))
    .filter((entry): entry is LabelRect => Boolean(entry))
  let labelNodeOverlaps = 0
  for (const label of labels) {
    for (const node of layout.nodes) {
      if (isContainerKind(kindByElementId.get(node.elementId))) continue
      if (labelRectOverlapsNode(label, node)) labelNodeOverlaps += 1
    }
  }
  let labelLabelOverlaps = 0
  for (let index = 0; index < labels.length; index += 1) {
    for (let other = index + 1; other < labels.length; other += 1) {
      if (labelRectsOverlap(labels[index]!, labels[other]!)) labelLabelOverlaps += 1
    }
  }

  return {
    crossingCount: countCrossings(layout.edges),
    overlappingEdgePairs: countOverlappingEdgePairs(layout.edges),
    edgeNodeClearanceViolations,
    labelNodeOverlaps,
    labelLabelOverlaps,
    bendCount,
    totalEdgeLength,
  }
}

// ---------------------------------------------------------------------------
// checkLayout — collision/clearance/crossing/label diagnostics
// ---------------------------------------------------------------------------

/**
 * §15.2 — verifies a layout: no node-node overlap, minimum edge/unrelated-node
 * clearance, crossing count vs. the configured threshold, and labels that do
 * not cover node boxes. A failing check produces a diagnostic; it never
 * removes a relationship (the caller keeps every edge regardless).
 */
export function checkLayout(layout: DiagramLayout, projection: DiagramProjection, options: DiagramLayoutOptions = {}): DesignDiagnostic[] {
  const diagnostics: DesignDiagnostic[] = []
  const add = (code: string, severity: DesignDiagnostic['severity'], message: string, relatedIds?: string[]) => {
    diagnostics.push({
      id: childId(layout.diagramId, 'layout-diagnostic', `${code}-${relatedIds?.join('.') ?? String(diagnostics.length)}`),
      code,
      severity,
      message,
      ...(relatedIds && relatedIds.length ? { relatedIds } : {}),
    })
  }

  if (layout.edges.length !== projection.relationships.length) {
    add(
      'LAYOUT-RELATIONSHIP-COUNT-MISMATCH',
      'blocker',
      `layout has ${layout.edges.length} edges but the projection has ${projection.relationships.length} relationships`,
    )
  }

  const kindByElementId = new Map(projection.elements.map((element) => [element.id, element.kind]))
  const relById = new Map(projection.relationships.map((rel) => [rel.id, rel]))
  const clearance = options.clearance ?? DEFAULT_CLEARANCE
  const crossingThreshold = options.crossingThreshold ?? DEFAULT_CROSSING_THRESHOLD

  for (let i = 0; i < layout.nodes.length; i++) {
    const a = layout.nodes[i]!
    if (isContainerKind(kindByElementId.get(a.elementId))) continue
    for (let j = i + 1; j < layout.nodes.length; j++) {
      const b = layout.nodes[j]!
      if (isContainerKind(kindByElementId.get(b.elementId))) continue
      if (rectsOverlap(a, b)) add('LAYOUT-NODE-OVERLAP', 'blocker', `nodes ${a.elementId} and ${b.elementId} overlap`, [a.elementId, b.elementId])
    }
  }

  for (const edge of layout.edges) {
    const rel = relById.get(edge.relationshipId)
    const relatedIds = new Set(rel ? [rel.fromId, rel.toId] : [])
    const segments = toSegments(edge.points)
    for (const node of layout.nodes) {
      if (relatedIds.has(node.elementId)) continue
      if (isContainerKind(kindByElementId.get(node.elementId))) continue
      let minDistance = Infinity
      for (const [a, b] of segments) minDistance = Math.min(minDistance, segmentToRectDistance(a, b, node))
      if (minDistance < clearance) {
        add(
          'LAYOUT-EDGE-CLEARANCE',
          'warning',
          `edge ${edge.relationshipId} passes within ${minDistance.toFixed(1)}px of unrelated node ${node.elementId} (minimum clearance ${clearance}px)`,
          [edge.relationshipId, node.elementId],
        )
      }
    }
  }

  for (const edge of layout.edges) {
    if (!edge.labelPosition) continue
    for (const node of layout.nodes) {
      if (isContainerKind(kindByElementId.get(node.elementId))) continue
      if (pointInRect(edge.labelPosition, node)) {
        add('LAYOUT-LABEL-OVERLAP', 'warning', `label for ${edge.relationshipId} covers node ${node.elementId}`, [edge.relationshipId, node.elementId])
      }
    }
  }

  const crossingCount = countCrossings(layout.edges)
  if (crossingCount > crossingThreshold) {
    add(
      'LAYOUT-CROSSING-THRESHOLD',
      'warning',
      `relationship crossings (${crossingCount}) exceed the configured threshold (${crossingThreshold})`,
    )
  }

  return diagnostics
}

// ---------------------------------------------------------------------------
// layoutDiagram
// ---------------------------------------------------------------------------

/**
 * §15.2 — deterministic layout: the same `projection.contentHash` and
 * `viewportClass` always produce the same layout (seed derived from both).
 * Narrow viewports never shrink nodes below the configured minimum size;
 * content may exceed the viewport width and is expected to pan horizontally.
 */
export function layoutDiagram(projection: DiagramProjection, viewportClass: DiagramLayout['viewportClass'], options: DiagramLayoutOptions = {}): DiagramLayout {
  const seed = canonicalHash({ sourceContentHash: projection.contentHash, viewportClass })
  const nodeWidth = Math.max(options.nodeWidth ?? DEFAULT_NODE_WIDTH, options.minNodeWidth ?? MIN_NODE_WIDTH)
  const nodeHeight = Math.max(options.nodeHeight ?? DEFAULT_NODE_HEIGHT, options.minNodeHeight ?? MIN_NODE_HEIGHT)

  const built =
    projection.kind === 'sequence'
      ? buildSequenceLayout(projection, nodeWidth, nodeHeight)
      : projection.kind === 'useCase'
        ? buildUseCaseLayout(projection, nodeWidth, nodeHeight)
      : projection.kind === 'component'
          ? buildComponentLayout(projection, nodeWidth, nodeHeight)
          : buildFlowLayout(projection, nodeWidth, nodeHeight, 4)

  const shell: DiagramLayout = {
    diagramId: projection.diagramId,
    viewportClass,
    seed,
    nodes: built.nodes,
    edges: built.edges,
    diagnostics: [],
    crossingCount: 0,
    contentHash: '',
  }

  const diagnostics = checkLayout(shell, projection, options)
  const crossingCount = countCrossings(shell.edges)
  const withChecks: DiagramLayout = { ...shell, diagnostics, crossingCount, contentHash: '' }
  return { ...withChecks, contentHash: designContentHash(withChecks) }
}

// ---------------------------------------------------------------------------
// accessibleDescription
// ---------------------------------------------------------------------------

/** §15.2 accessible description: merges the text alternative with node reading order (top-to-bottom, left-to-right). */
export function accessibleDescription(layout: DiagramLayout, projection: DiagramProjection): string {
  const labelById = new Map(projection.elements.map((element) => [element.id, element.label]))
  const readingOrder = [...layout.nodes]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((node) => labelById.get(node.elementId) ?? node.elementId)

  const lines = [`Reading order: ${readingOrder.join(', ')}.`, ...projection.textAlternative]
  return lines.join('\n')
}
