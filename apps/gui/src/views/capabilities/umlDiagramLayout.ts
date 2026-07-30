import type {
  DiagramKind,
  DiagramNodeKind,
  DiagramProjection,
  DiagramProjectionEdge,
  DiagramProjectionNode,
} from '@engineering-ui-kit/core'
import ELK from 'elkjs/lib/elk.bundled.js'
import type {
  ElkExtendedEdge,
  ElkLabel,
  ElkNode,
  ElkPoint,
  ElkPort,
} from 'elkjs/lib/elk-api'

export type UmlPoint = { x: number; y: number }

export type UmlLayoutPort = {
  id: string
  kind: 'provided-interface' | 'required-interface' | 'port'
  label: string
  x: number
  y: number
}

export type UmlLayoutNode = {
  id: string
  kind: DiagramNodeKind
  x: number
  y: number
  width: number
  height: number
  ports: UmlLayoutPort[]
}

export type UmlLayoutLabel = {
  x: number
  y: number
  width: number
  height: number
}

export type UmlLayoutEdge = {
  id: string
  points: UmlPoint[]
  label?: UmlLayoutLabel
}

export type UmlDiagramLayout = {
  width: number
  height: number
  nodes: UmlLayoutNode[]
  edges: UmlLayoutEdge[]
  engine: 'elk-layered' | 'ranked-activity' | 'swimlane' | 'balanced-state' | 'temporal'
}

export type UmlLayoutQuality = {
  crossings: number
  overlappingConnectorPairs: number
  nodeOverlaps: number
  edgeNodeClearanceViolations: number
  labelNodeOverlaps: number
  labelLabelOverlaps: number
  connectorLabelOverlaps: number
  portAlignmentViolations: number
  canvasBoundsViolations: number
  bends: number
  totalConnectorLength: number
  canvasOccupancy: number
}

type SizedNode = DiagramProjectionNode & { width: number; height: number }

const CANVAS_PADDING = 54
const MIN_CANVAS_WIDTH = 920
const MIN_CANVAS_HEIGHT = 520
const elk = new ELK()

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function textWidth(value: string, minimum: number, maximum: number, padding: number): number {
  return clamp(Math.ceil(value.length * 7.2 + padding), minimum, maximum)
}

function wrappedLineCount(value: string, charactersPerLine: number): number {
  const words = value.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return 1
  let lines = 1
  let current = 0
  for (const word of words) {
    const next = current ? current + 1 + word.length : word.length
    if (next > charactersPerLine) {
      lines += 1
      current = word.length
    } else {
      current = next
    }
  }
  return lines
}

export function sizeForNode(node: DiagramProjectionNode): { width: number; height: number } {
  switch (node.kind) {
    case 'component':
      return {
        width: textWidth(node.label, 190, 268, 64),
        height: 108,
      }
    case 'actor':
      return {
        width: textWidth(node.label, 148, 214, 36),
        height: 154,
      }
    case 'use-case':
      return {
        width: textWidth(node.label, 220, 330, 72),
        height: clamp(62 + (wrappedLineCount(node.label, 30) - 1) * 16, 76, 108),
      }
    case 'action':
    case 'call-operation':
    case 'send-event':
    case 'receive-event':
      return {
        width: textWidth(node.label, 250, 360, 68),
        height: clamp(58 + (wrappedLineCount(node.label, 38) - 1) * 16, 68, 112),
      }
    case 'state':
      return {
        width: textWidth(node.label, 178, 276, 56),
        height: clamp(66 + (wrappedLineCount(node.label, 30) - 1) * 15, 74, 104),
      }
    case 'decision':
    case 'merge':
      return { width: 58, height: 58 }
    case 'fork':
    case 'join':
      return { width: 96, height: 12 }
    case 'swimlane':
      return {
        width: textWidth(node.label, 320, 440, 96),
        height: 240,
      }
    case 'initial':
    case 'final':
      return { width: 26, height: 26 }
    case 'lifeline':
      return {
        width: textWidth(node.label, 142, 194, 42),
        height: 88,
      }
    case 'activation':
      return { width: 16, height: 84 }
    case 'fragment':
      return { width: 360, height: 160 }
    case 'system-boundary':
      return { width: 600, height: 400 }
    case 'provided-interface':
    case 'required-interface':
    case 'port':
      return { width: 16, height: 16 }
    default:
      return { width: 210, height: 78 }
  }
}

function edgeLabelSize(value: string): { width: number; height: number } {
  const lines = wrappedLineCount(value, 30)
  return {
    width: textWidth(value, 58, 224, 24),
    height: clamp(24 + (lines - 1) * 14, 24, 52),
  }
}

export function edgeDisplayLabel(edge: DiagramProjectionEdge): string | undefined {
  const guard = edge.guard?.trim()
  if (guard && edge.label) return `[${guard}]\n${edge.label}`
  if (guard) return `[${guard}]`
  return edge.label
}

function directionFor(kind: DiagramKind): 'RIGHT' | 'DOWN' {
  return kind === 'activity' ? 'DOWN' : 'RIGHT'
}

function graphOptions(kind: DiagramKind): Record<string, string> {
  const direction = directionFor(kind)
  return {
    'elk.algorithm': 'layered',
    'elk.direction': direction,
    'elk.edgeRouting': 'ORTHOGONAL',
    ...(kind === 'use-case' || kind === 'activity'
      ? { 'elk.hierarchyHandling': 'INCLUDE_CHILDREN' }
      : {}),
    'elk.randomSeed': '1',
    'elk.padding': `[top=${CANVAS_PADDING},left=${CANVAS_PADDING},bottom=${CANVAS_PADDING},right=${CANVAS_PADDING}]`,
    'elk.spacing.nodeNode': kind === 'use-case' ? '52' : '42',
    'elk.spacing.edgeNode': '26',
    'elk.spacing.edgeEdge': '16',
    'elk.spacing.edgeLabel': '8',
    'elk.spacing.labelNode': '14',
    'elk.spacing.labelLabel': '12',
    'elk.spacing.portPort': '18',
    'elk.layered.spacing.nodeNodeBetweenLayers': kind === 'activity'
      ? '62'
      : kind === 'state-machine' ? '30' : kind === 'component' ? '76' : '88',
    'elk.layered.spacing.edgeNodeBetweenLayers': '28',
    'elk.layered.nodePlacement.strategy': kind === 'use-case' ? 'BRANDES_KOEPF' : 'NETWORK_SIMPLEX',
    'elk.layered.nodePlacement.favorStraightEdges': 'true',
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    'elk.layered.crossingMinimization.greedySwitch.type': 'TWO_SIDED',
    ...(kind === 'use-case'
      ? {
        'elk.layered.crossingMinimization.greedySwitchHierarchical.type': 'TWO_SIDED',
        'elk.layered.crossingMinimization.hierarchicalSweepiness': '1',
      }
      : {}),
    'elk.layered.considerModelOrder.strategy': 'NONE',
    'elk.layered.edgeLabels.centerLabelPlacementStrategy': 'SPACE_EFFICIENT_LAYER',
    'elk.layered.compaction.postCompaction.strategy': 'EDGE_LENGTH',
    // Five sweeps preserve the stable low-crossing layout in the complex
    // fixture and keep interactive diagram changes inside the 500 ms target.
    'elk.layered.thoroughness': kind === 'activity' ? '5' : '8',
    'elk.layered.unnecessaryBendpoints': 'false',
    'elk.layered.mergeEdges': 'false',
    ...(kind === 'state-machine'
      ? { 'elk.aspectRatio': String(MIN_CANVAS_WIDTH / MIN_CANVAS_HEIGHT) }
      : {}),
  }
}

function portSide(node: DiagramProjectionNode): 'WEST' | 'EAST' {
  return node.kind === 'provided-interface' ? 'WEST' : 'EAST'
}

function toElkPort(node: DiagramProjectionNode, order: number): ElkPort {
  const size = sizeForNode(node)
  return {
    id: node.id,
    width: size.width,
    height: size.height,
    layoutOptions: {
      'elk.port.side': portSide(node),
      'elk.port.index': String(order),
      'elk.port.borderOffset': '0',
    },
  }
}

function endpointId(
  id: string,
  nodesById: Map<string, DiagramProjectionNode>,
): string {
  const node = nodesById.get(id)
  return node?.parentId && (
    node.kind === 'provided-interface'
    || node.kind === 'required-interface'
    || node.kind === 'port'
  ) ? node.id : id
}

type ActorPartition = { left: Set<string>; right: Set<string> }

function orderedUseCaseActors(
  diagram: DiagramProjection,
): string[] {
  const useCaseOrder = new Map(diagram.nodes
    .filter((node) => node.kind === 'use-case')
    .map((node, index) => [node.id, index]))
  return diagram.nodes
    .filter((node) => node.kind === 'actor')
    .map((actor, order) => {
      const connected = diagram.edges.flatMap((edge) => edge.fromId === actor.id
        ? [useCaseOrder.get(edge.toId)]
        : edge.toId === actor.id ? [useCaseOrder.get(edge.fromId)] : [])
        .filter((index): index is number => index !== undefined)
      return {
        id: actor.id,
        order,
        barycenter: connected.length
          ? connected.reduce((sum, index) => sum + index, 0) / connected.length
          : order,
      }
    })
    .sort((left, right) => left.barycenter - right.barycenter || left.order - right.order)
    .map((actor) => actor.id)
}

function useCaseActorPartitions(diagram: DiagramProjection): ActorPartition[] {
  const actors = orderedUseCaseActors(diagram)
  if (actors.length < 2) {
    return [{ left: new Set(actors), right: new Set() }]
  }

  // Evaluate every meaningful split for normal-sized diagrams. In theory a
  // mirrored split has equivalent topology, but ELK's directional port order
  // and different actor widths can produce materially different routes.
  if (actors.length <= 6) {
    const partitions: ActorPartition[] = []
    const combinations = 2 ** actors.length
    for (let mask = 1; mask < combinations - 1; mask += 1) {
      const right = new Set<string>()
      for (let index = 0; index < actors.length; index += 1) {
        if (mask & (1 << index)) right.add(actors[index]!)
      }
      partitions.push({
        right,
        left: new Set(actors.filter((actor) => !right.has(actor))),
      })
    }
    return partitions
  }

  // Bound layout work for unusually large actor sets while still offering ELK
  // several balanced, deterministic partitions to compare.
  return [0, 1, 2, 3].map((offset) => {
    const right = new Set(actors.filter((_actor, index) => (index + offset) % 4 < 2))
    if (!right.size) right.add(actors[0]!)
    if (right.size === actors.length) right.delete(actors.at(-1)!)
    return {
      right,
      left: new Set(actors.filter((actor) => !right.has(actor))),
    }
  })
}

function buildElkGraph(
  diagram: DiagramProjection,
  actorPartition: ActorPartition = { left: new Set(), right: new Set() },
  layoutOverrides: Record<string, string> = {},
): {
  graph: ElkNode
  sizedNodes: Map<string, SizedNode>
  portsByParent: Map<string, DiagramProjectionNode[]>
  reversedEdgeIds: Set<string>
} {
  const sizedNodes = new Map<string, SizedNode>()
  const nodesById = new Map(diagram.nodes.map((node) => [node.id, node]))
  const portsByParent = new Map<string, DiagramProjectionNode[]>()
  const reversedEdgeIds = new Set<string>()

  for (const node of diagram.nodes) {
    const size = sizeForNode(node)
    sizedNodes.set(node.id, { ...node, ...size })
    if (
      node.parentId
      && (node.kind === 'provided-interface' || node.kind === 'required-interface' || node.kind === 'port')
    ) {
      const ports = portsByParent.get(node.parentId) ?? []
      ports.push(node)
      portsByParent.set(node.parentId, ports)
    }
  }

  const activityLanes = diagram.kind === 'activity'
    ? diagram.nodes.filter((node) => node.kind === 'swimlane')
    : []
  const activityLaneIds = new Set(activityLanes.map((node) => node.id))

  const toLeafNode = (node: DiagramProjectionNode): ElkNode => {
    const sized = sizedNodes.get(node.id)!
    const ports = portsByParent.get(node.id) ?? []
    return {
      id: node.id,
      width: sized.width,
      height: sized.height,
      ports: ports.map(toElkPort),
      layoutOptions: ports.length ? {
        'elk.portConstraints': 'FIXED_ORDER',
        'elk.portAlignment.west': 'JUSTIFIED',
        'elk.portAlignment.east': 'JUSTIFIED',
      } : undefined,
    }
  }

  let children: ElkNode[] = diagram.nodes
    .filter((node) =>
      node.kind !== 'system-boundary'
      && !(diagram.kind === 'use-case' && node.kind === 'use-case')
      && !activityLaneIds.has(node.id)
      && !(node.parentId && activityLaneIds.has(node.parentId))
      && node.kind !== 'provided-interface'
      && node.kind !== 'required-interface'
      && node.kind !== 'port')
    .map(toLeafNode)

  if (activityLanes.length) {
    children.push(...activityLanes.map((lane) => {
      const laneChildren = diagram.nodes
        .filter((node) =>
          node.parentId === lane.id
          && node.kind !== 'provided-interface'
          && node.kind !== 'required-interface'
          && node.kind !== 'port')
        .map(toLeafNode)
      const sized = sizedNodes.get(lane.id)!
      return {
        id: lane.id,
        ...(laneChildren.length
          ? { children: laneChildren }
          : { width: sized.width, height: sized.height }),
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': 'DOWN',
          'elk.edgeRouting': 'ORTHOGONAL',
          'elk.padding': '[top=66,left=32,bottom=32,right=32]',
          'elk.spacing.nodeNode': '42',
          'elk.spacing.edgeNode': '24',
          'elk.layered.spacing.nodeNodeBetweenLayers': '56',
          'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
          'elk.layered.nodePlacement.favorStraightEdges': 'true',
          'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
          'elk.layered.thoroughness': '5',
        },
      }
    }))
  }

  if (diagram.kind === 'use-case') {
    const boundary = diagram.nodes.find((node) => node.kind === 'system-boundary')
    const useCases = diagram.nodes.filter((node) =>
      node.kind === 'use-case' && node.parentId === boundary?.id)
    if (boundary && useCases.length) {
      children.push({
        id: boundary.id,
        children: useCases.map((node) => {
          const sized = sizedNodes.get(node.id)!
          return { id: node.id, width: sized.width, height: sized.height }
        }),
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': 'DOWN',
          'elk.edgeRouting': 'ORTHOGONAL',
          'elk.padding': '[top=76,left=54,bottom=48,right=54]',
          'elk.spacing.nodeNode': '60',
          'elk.spacing.edgeNode': '30',
          'elk.spacing.edgeEdge': '18',
          'elk.spacing.edgeLabel': '10',
          'elk.spacing.labelNode': '18',
          'elk.spacing.labelLabel': '14',
          'elk.layered.spacing.nodeNodeBetweenLayers': '62',
          'elk.layered.spacing.edgeNodeBetweenLayers': '30',
        },
      })
    }
  }

  const edges: ElkExtendedEdge[] = diagram.edges.map((edge) => {
    const reverse = diagram.kind === 'use-case' && actorPartition.right.has(edge.fromId)
    const displayLabel = edgeDisplayLabel(edge)
    if (reverse) reversedEdgeIds.add(edge.id)
    return {
      id: edge.id,
      sources: [endpointId(reverse ? edge.toId : edge.fromId, nodesById)],
      targets: [endpointId(reverse ? edge.fromId : edge.toId, nodesById)],
      labels: displayLabel ? [{
        id: `${edge.id}:label`,
        text: displayLabel,
        ...edgeLabelSize(displayLabel),
        layoutOptions: {
          'elk.edgeLabels.placement': 'CENTER',
        },
      }] : undefined,
    }
  })

  return {
    graph: {
      id: diagram.id,
      layoutOptions: {
        ...graphOptions(diagram.kind),
        ...layoutOverrides,
      },
      children,
      edges,
    },
    sizedNodes,
    portsByParent,
    reversedEdgeIds,
  }
}

function translatePoint(point: ElkPoint, dx = 0, dy = 0): UmlPoint {
  return { x: point.x + dx, y: point.y + dy }
}

function pointsForEdge(edge: ElkExtendedEdge): UmlPoint[] {
  const section = edge.sections?.[0]
  if (!section) return []
  const rawPoints = [
    translatePoint(section.startPoint),
    ...(section.bendPoints ?? []).map((point) => translatePoint(point)),
    translatePoint(section.endPoint),
  ]
  return rawPoints.reduce<UmlPoint[]>((points, point) => {
    const previous = points.at(-1)
    if (previous?.x === point.x && previous.y === point.y) return points
    const beforePrevious = points.at(-2)
    if (
      beforePrevious
      && previous
      && (
        (beforePrevious.x === previous.x && previous.x === point.x)
        || (beforePrevious.y === previous.y && previous.y === point.y)
      )
    ) {
      points[points.length - 1] = point
    } else {
      points.push(point)
    }
    return points
  }, [])
}

function fallbackLabel(points: UmlPoint[], label: ElkLabel): UmlLayoutLabel | undefined {
  if (label.width === undefined || label.height === undefined || points.length < 2) return undefined
  let longestStart = points[0]!
  let longestEnd = points[1]!
  let longest = 0
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]!
    const end = points[index + 1]!
    const length = Math.abs(end.x - start.x) + Math.abs(end.y - start.y)
    if (length > longest) {
      longest = length
      longestStart = start
      longestEnd = end
    }
  }
  return {
    x: (longestStart.x + longestEnd.x - label.width) / 2,
    y: (longestStart.y + longestEnd.y - label.height) / 2 - 10,
    width: label.width,
    height: label.height,
  }
}

function bounds(
  nodes: UmlLayoutNode[],
  edges: UmlLayoutEdge[],
): { minX: number; minY: number; maxX: number; maxY: number } {
  const nodeLeft = nodes.map((node) => node.x)
  const nodeTop = nodes.map((node) => node.y)
  const nodeRight = nodes.map((node) => node.x + node.width)
  const nodeBottom = nodes.map((node) => node.y + node.height)
  const points = edges.flatMap((edge) => edge.points)
  const labels = edges.flatMap((edge) => edge.label ? [edge.label] : [])
  if (!nodes.length && !points.length && !labels.length) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  }
  return {
    minX: Math.min(...nodeLeft, ...points.map((point) => point.x), ...labels.map((label) => label.x)),
    minY: Math.min(...nodeTop, ...points.map((point) => point.y), ...labels.map((label) => label.y)),
    maxX: Math.max(...nodeRight, ...points.map((point) => point.x), ...labels.map((label) => label.x + label.width)),
    maxY: Math.max(...nodeBottom, ...points.map((point) => point.y), ...labels.map((label) => label.y + label.height)),
  }
}

function translateLayout(
  nodes: UmlLayoutNode[],
  edges: UmlLayoutEdge[],
  dx: number,
  dy: number,
): { nodes: UmlLayoutNode[]; edges: UmlLayoutEdge[] } {
  return {
    nodes: nodes.map((node) => ({
      ...node,
      x: node.x + dx,
      y: node.y + dy,
      ports: node.ports.map((port) => ({
        ...port,
        x: port.x + dx,
        y: port.y + dy,
      })),
    })),
    edges: edges.map((edge) => ({
      ...edge,
      points: edge.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
      label: edge.label ? {
        ...edge.label,
        x: edge.label.x + dx,
        y: edge.label.y + dy,
      } : undefined,
    })),
  }
}

function normalizeLayout(
  nodes: UmlLayoutNode[],
  edges: UmlLayoutEdge[],
  engine: UmlDiagramLayout['engine'],
): UmlDiagramLayout {
  const current = bounds(nodes, edges)
  const contentWidth = current.maxX - current.minX
  const contentHeight = current.maxY - current.minY
  const width = Math.ceil(Math.max(MIN_CANVAS_WIDTH, contentWidth + CANVAS_PADDING * 2))
  const height = Math.ceil(Math.max(MIN_CANVAS_HEIGHT, contentHeight + CANVAS_PADDING * 2))
  const shiftX = (width - contentWidth) / 2 - current.minX
  const shiftY = (height - contentHeight) / 2 - current.minY
  const shifted = translateLayout(nodes, edges, shiftX, shiftY)
  return {
    width,
    height,
    nodes: shifted.nodes,
    edges: shifted.edges,
    engine,
  }
}

type Segment = { edgeId: string; start: UmlPoint; end: UmlPoint }
type Rect = { x: number; y: number; width: number; height: number }

function layoutSegments(layout: UmlDiagramLayout): Segment[] {
  return layout.edges.flatMap((edge) =>
    edge.points.slice(0, -1).map((start, index) => ({
      edgeId: edge.id,
      start,
      end: edge.points[index + 1]!,
    })))
}

function pointEquals(left: UmlPoint, right: UmlPoint): boolean {
  return Math.abs(left.x - right.x) < 0.01 && Math.abs(left.y - right.y) < 0.01
}

function orientation(a: UmlPoint, b: UmlPoint, c: UmlPoint): 0 | 1 | 2 {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y)
  if (Math.abs(value) < 0.01) return 0
  return value > 0 ? 1 : 2
}

function properIntersection(a: Segment, b: Segment): boolean {
  if (
    pointEquals(a.start, b.start)
    || pointEquals(a.start, b.end)
    || pointEquals(a.end, b.start)
    || pointEquals(a.end, b.end)
  ) return false
  const first = orientation(a.start, a.end, b.start)
  const second = orientation(a.start, a.end, b.end)
  const third = orientation(b.start, b.end, a.start)
  const fourth = orientation(b.start, b.end, a.end)
  return first !== 0 && second !== 0 && third !== 0 && fourth !== 0
    && first !== second && third !== fourth
}

function segmentOverlapLength(a: Segment, b: Segment): number {
  if (
    orientation(a.start, a.end, b.start) !== 0
    || orientation(a.start, a.end, b.end) !== 0
  ) return 0
  const useX = Math.abs(a.end.x - a.start.x) >= Math.abs(a.end.y - a.start.y)
  const aStart = useX ? a.start.x : a.start.y
  const aEnd = useX ? a.end.x : a.end.y
  const bStart = useX ? b.start.x : b.start.y
  const bEnd = useX ? b.end.x : b.end.y
  return Math.max(
    0,
    Math.min(Math.max(aStart, aEnd), Math.max(bStart, bEnd))
      - Math.max(Math.min(aStart, aEnd), Math.min(bStart, bEnd)),
  )
}

function rectanglesOverlap(left: Rect, right: Rect): boolean {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y
}

function pointToSegmentDistance(point: UmlPoint, start: UmlPoint, end: UmlPoint): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y)
  const ratio = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
    0,
    1,
  )
  return Math.hypot(
    point.x - (start.x + ratio * dx),
    point.y - (start.y + ratio * dy),
  )
}

function segmentsTouch(aStart: UmlPoint, aEnd: UmlPoint, bStart: UmlPoint, bEnd: UmlPoint): boolean {
  if (properIntersection(
    { edgeId: 'a', start: aStart, end: aEnd },
    { edgeId: 'b', start: bStart, end: bEnd },
  )) return true
  return segmentOverlapLength(
    { edgeId: 'a', start: aStart, end: aEnd },
    { edgeId: 'b', start: bStart, end: bEnd },
  ) > 0
}

function segmentToRectDistance(segment: Segment, rect: Rect): number {
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ]
  const sides = corners.map((corner, index) => [
    corner,
    corners[(index + 1) % corners.length]!,
  ] as const)
  if (
    segment.start.x >= rect.x && segment.start.x <= rect.x + rect.width
    && segment.start.y >= rect.y && segment.start.y <= rect.y + rect.height
  ) return 0
  if (
    segment.end.x >= rect.x && segment.end.x <= rect.x + rect.width
    && segment.end.y >= rect.y && segment.end.y <= rect.y + rect.height
  ) return 0
  if (sides.some(([start, end]) => segmentsTouch(segment.start, segment.end, start, end))) return 0
  return Math.min(
    ...corners.map((corner) => pointToSegmentDistance(corner, segment.start, segment.end)),
    ...sides.flatMap(([start, end]) => [
      pointToSegmentDistance(segment.start, start, end),
      pointToSegmentDistance(segment.end, start, end),
    ]),
  )
}

function isLayoutContainer(kind: DiagramProjectionNode['kind']): boolean {
  return kind === 'system-boundary' || kind === 'swimlane' || kind === 'fragment'
}

/**
 * Measures rendered geometry, including defects that ELK's own crossing
 * score does not report: shared connector trunks, label boxes, node
 * clearance, and semantic port attachment. Tests and the UI can use the same
 * measurements, so a "verified" diagram means more than "no nodes overlap".
 */
export function analyzeUmlLayoutQuality(
  layout: UmlDiagramLayout,
  diagram: DiagramProjection,
  clearance = 12,
): UmlLayoutQuality {
  const segments = layoutSegments(layout)
  const nodeDefinitionById = new Map(diagram.nodes.map((node) => [node.id, node]))
  const layoutNodeById = new Map(layout.nodes.map((node) => [node.id, node]))
  const parentByNodeId = new Map(
    diagram.nodes.flatMap((node) => node.parentId ? [[node.id, node.parentId] as const] : []),
  )
  let crossings = 0
  const overlappingPairs = new Set<string>()
  for (let left = 0; left < segments.length; left += 1) {
    for (let right = left + 1; right < segments.length; right += 1) {
      const first = segments[left]!
      const second = segments[right]!
      if (first.edgeId === second.edgeId) continue
      if (properIntersection(first, second)) crossings += 1
      if (segmentOverlapLength(first, second) > 4) {
        overlappingPairs.add([first.edgeId, second.edgeId].sort().join('\u0000'))
      }
    }
  }

  let nodeOverlaps = 0
  const semanticNodes = layout.nodes.filter((node) => {
    const definition = nodeDefinitionById.get(node.id)
    return definition && !isLayoutContainer(definition.kind)
  })
  for (let left = 0; left < semanticNodes.length; left += 1) {
    for (let right = left + 1; right < semanticNodes.length; right += 1) {
      if (rectanglesOverlap(semanticNodes[left]!, semanticNodes[right]!)) nodeOverlaps += 1
    }
  }

  let edgeNodeClearanceViolations = 0
  for (const edge of layout.edges) {
    const definition = diagram.edges.find((candidate) => candidate.id === edge.id)
    const relatedNodeIds = new Set([
      definition?.fromId,
      definition?.toId,
      definition ? parentByNodeId.get(definition.fromId) : undefined,
      definition ? parentByNodeId.get(definition.toId) : undefined,
    ].filter((id): id is string => Boolean(id)))
    const edgeSegments = segments.filter((segment) => segment.edgeId === edge.id)
    for (const node of semanticNodes) {
      if (relatedNodeIds.has(node.id)) continue
      if (diagram.kind === 'sequence' && nodeDefinitionById.get(node.id)?.kind === 'lifeline') continue
      const distance = Math.min(...edgeSegments.map((segment) => segmentToRectDistance(segment, node)))
      if (distance < clearance) edgeNodeClearanceViolations += 1
    }
  }

  const labels = layout.edges.flatMap((edge) => edge.label ? [{ edgeId: edge.id, ...edge.label }] : [])
  let labelNodeOverlaps = 0
  for (const label of labels) {
    for (const node of semanticNodes) {
      if (diagram.kind === 'sequence' && nodeDefinitionById.get(node.id)?.kind === 'lifeline') continue
      if (rectanglesOverlap(label, node)) labelNodeOverlaps += 1
    }
  }
  let labelLabelOverlaps = 0
  for (let left = 0; left < labels.length; left += 1) {
    for (let right = left + 1; right < labels.length; right += 1) {
      if (rectanglesOverlap(labels[left]!, labels[right]!)) labelLabelOverlaps += 1
    }
  }
  let connectorLabelOverlaps = 0
  for (const label of labels) {
    for (const segment of segments) {
      if (segment.edgeId === label.edgeId) continue
      if (segmentToRectDistance(segment, label) < 2) connectorLabelOverlaps += 1
    }
  }

  let portAlignmentViolations = 0
  for (const definition of diagram.nodes) {
    if (!definition.parentId || !(
      definition.kind === 'provided-interface'
      || definition.kind === 'required-interface'
      || definition.kind === 'port'
    )) continue
    const parent = layoutNodeById.get(definition.parentId)
    const port = parent?.ports.find((candidate) => candidate.id === definition.id)
    if (!parent || !port) {
      portAlignmentViolations += 1
      continue
    }
    const expectedX = definition.kind === 'provided-interface'
      ? parent.x
      : parent.x + parent.width
    if (Math.abs(port.x - expectedX) > 9) portAlignmentViolations += 1
    for (const edge of diagram.edges.filter((candidate) =>
      candidate.fromId === definition.id || candidate.toId === definition.id)) {
      const laidOutEdge = layout.edges.find((candidate) => candidate.id === edge.id)
      const endpoint = edge.fromId === definition.id
        ? laidOutEdge?.points[0]
        : laidOutEdge?.points.at(-1)
      if (!endpoint || Math.hypot(endpoint.x - port.x, endpoint.y - port.y) > 9) {
        portAlignmentViolations += 1
      }
    }
  }

  const outsideCanvas = (rect: Rect) =>
    rect.x < 0
    || rect.y < 0
    || rect.x + rect.width > layout.width
    || rect.y + rect.height > layout.height
  const canvasBoundsViolations = layout.nodes.filter(outsideCanvas).length
    + layout.nodes.flatMap((node) => node.ports).filter((port) =>
      port.x < 0 || port.y < 0 || port.x > layout.width || port.y > layout.height).length
    + labels.filter(outsideCanvas).length
    + layout.edges.flatMap((edge) => edge.points).filter((point) =>
      point.x < 0 || point.y < 0 || point.x > layout.width || point.y > layout.height).length

  const bends = layout.edges.reduce(
    (total, edge) => total + Math.max(0, edge.points.length - 2),
    0,
  )
  const totalConnectorLength = segments.reduce(
    (total, segment) => total + Math.hypot(
      segment.end.x - segment.start.x,
      segment.end.y - segment.start.y,
    ),
    0,
  )
  const semanticArea = semanticNodes.reduce((total, node) => total + node.width * node.height, 0)
  return {
    crossings,
    overlappingConnectorPairs: overlappingPairs.size,
    nodeOverlaps,
    edgeNodeClearanceViolations,
    labelNodeOverlaps,
    labelLabelOverlaps,
    connectorLabelOverlaps,
    portAlignmentViolations,
    canvasBoundsViolations,
    bends,
    totalConnectorLength,
    canvasOccupancy: semanticArea / Math.max(1, layout.width * layout.height),
  }
}

function swimlaneNodeSize(node: DiagramProjectionNode): { width: number; height: number } {
  if (
    node.kind === 'action'
    || node.kind === 'call-operation'
    || node.kind === 'send-event'
    || node.kind === 'receive-event'
  ) {
    return {
      width: 166,
      height: clamp(58 + (wrappedLineCount(node.label, 25) - 1) * 15, 66, 96),
    }
  }
  if (node.kind === 'decision' || node.kind === 'merge') return { width: 54, height: 54 }
  if (node.kind === 'fork' || node.kind === 'join') return { width: 112, height: 12 }
  if (node.kind === 'initial' || node.kind === 'final') return { width: 26, height: 26 }
  return sizeForNode(node)
}

function activityRanks(
  nodes: readonly DiagramProjectionNode[],
  edges: readonly DiagramProjectionEdge[],
): Map<string, number> {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const rankEdges = edges.filter((edge) =>
    !edge.isLoop && nodeIds.has(edge.fromId) && nodeIds.has(edge.toId))
  const indegree = new Map(nodes.map((node) => [node.id, 0]))
  const outgoing = new Map<string, DiagramProjectionEdge[]>()
  for (const edge of rankEdges) {
    indegree.set(edge.toId, (indegree.get(edge.toId) ?? 0) + 1)
    outgoing.set(edge.fromId, [...(outgoing.get(edge.fromId) ?? []), edge])
  }
  const nodeOrder = new Map(nodes.map((node, index) => [node.id, index]))
  const queue = nodes
    .filter((node) => indegree.get(node.id) === 0)
    .sort((left, right) => (nodeOrder.get(left.id) ?? 0) - (nodeOrder.get(right.id) ?? 0))
  const ranks = new Map(nodes.map((node) => [node.id, 0]))
  const visited = new Set<string>()
  while (queue.length) {
    const current = queue.shift()!
    visited.add(current.id)
    for (const edge of outgoing.get(current.id) ?? []) {
      ranks.set(edge.toId, Math.max(
        ranks.get(edge.toId) ?? 0,
        (ranks.get(current.id) ?? 0) + 1,
      ))
      const next = (indegree.get(edge.toId) ?? 1) - 1
      indegree.set(edge.toId, next)
      if (next === 0) {
        const target = nodes.find((node) => node.id === edge.toId)
        if (target) queue.push(target)
        queue.sort((left, right) =>
          (nodeOrder.get(left.id) ?? 0) - (nodeOrder.get(right.id) ?? 0))
      }
    }
  }

  // A partially edited graph can contain a residual cycle. Keep all symbols
  // inspectable without assigning invented workflow semantics.
  let fallbackRank = Math.max(0, ...ranks.values())
  for (const node of nodes) {
    if (visited.has(node.id)) continue
    fallbackRank += 1
    ranks.set(node.id, fallbackRank)
  }
  return ranks
}

function activityLaneAssignments(
  nodes: readonly DiagramProjectionNode[],
  edges: readonly DiagramProjectionEdge[],
  laneIds: ReadonlySet<string>,
  firstLaneId: string,
): Map<string, string> {
  const assignments = new Map<string, string>()
  for (const node of nodes) {
    if (node.parentId && laneIds.has(node.parentId)) assignments.set(node.id, node.parentId)
  }
  const incoming = new Map<string, string[]>()
  const outgoing = new Map<string, string[]>()
  for (const edge of edges) {
    incoming.set(edge.toId, [...(incoming.get(edge.toId) ?? []), edge.fromId])
    outgoing.set(edge.fromId, [...(outgoing.get(edge.fromId) ?? []), edge.toId])
  }
  for (let pass = 0; pass < nodes.length; pass += 1) {
    let changed = false
    for (const node of nodes) {
      if (assignments.has(node.id)) continue
      const neighborIds = node.kind === 'initial'
        ? outgoing.get(node.id) ?? []
        : node.kind === 'final'
          ? incoming.get(node.id) ?? []
          : [...(incoming.get(node.id) ?? []), ...(outgoing.get(node.id) ?? [])]
      const laneId = neighborIds.map((id) => assignments.get(id)).find(Boolean)
      if (laneId) {
        assignments.set(node.id, laneId)
        changed = true
      }
    }
    if (!changed) break
  }
  for (const node of nodes) {
    if (!assignments.has(node.id)) assignments.set(node.id, firstLaneId)
  }
  return assignments
}

function compactPoints(points: UmlPoint[]): UmlPoint[] {
  return points.reduce<UmlPoint[]>((result, point) => {
    const previous = result.at(-1)
    if (previous?.x === point.x && previous.y === point.y) return result
    const before = result.at(-2)
    if (
      before
      && previous
      && (
        (before.x === previous.x && previous.x === point.x)
        || (before.y === previous.y && previous.y === point.y)
      )
    ) {
      result[result.length - 1] = point
    } else {
      result.push(point)
    }
    return result
  }, [])
}

function labelForRoute(
  edge: DiagramProjectionEdge,
  points: readonly UmlPoint[],
  obstacles: readonly UmlLayoutNode[] = [],
  connectorObstacles: readonly Segment[] = [],
  labelObstacles: readonly Rect[] = [],
): UmlLayoutLabel | undefined {
  const displayLabel = edgeDisplayLabel(edge)
  if (!displayLabel || points.length < 2) return undefined
  const size = edgeLabelSize(displayLabel)
  const segments = points.slice(0, -1).map((start, index) => {
    const end = points[index + 1]!
    return {
      start,
      end,
      horizontal: start.y === end.y,
      length: Math.abs(end.x - start.x) + Math.abs(end.y - start.y),
    }
  })
  const candidates = segments.flatMap((segment) => {
    const base = segment.horizontal
      ? {
        x: (segment.start.x + segment.end.x - size.width) / 2,
        y: segment.start.y - size.height - 7,
      }
      : {
        x: segment.start.x + 8,
        y: (segment.start.y + segment.end.y - size.height) / 2,
      }
    const alternate = segment.horizontal
      ? { x: base.x, y: segment.start.y + 7 }
      : { x: segment.start.x - size.width - 8, y: base.y }
    return [base, alternate].map((position, side) => ({
      ...position,
      ...size,
      nodeOverlapCount: obstacles.filter((node) =>
        rectanglesOverlap({ ...position, ...size }, node)).length,
      connectorOverlapCount: connectorObstacles.filter((connector) =>
        segmentToRectDistance(connector, { ...position, ...size }) < 2).length,
      labelOverlapCount: labelObstacles.filter((label) =>
        rectanglesOverlap({ ...position, ...size }, label)).length,
      orientationRank: segment.horizontal ? 0 : 1,
      side,
      length: segment.length,
    }))
  })
  const selected = candidates.sort((left, right) =>
    left.nodeOverlapCount - right.nodeOverlapCount
    || left.connectorOverlapCount - right.connectorOverlapCount
    || left.labelOverlapCount - right.labelOverlapCount
    || left.orientationRank - right.orientationRank
    || right.length - left.length
    || left.side - right.side)[0]
  if (!selected) return undefined
  const {
    nodeOverlapCount: _nodeOverlapCount,
    connectorOverlapCount: _connectorOverlapCount,
    labelOverlapCount: _labelOverlapCount,
    orientationRank: _orientationRank,
    side: _side,
    length: _length,
    ...label
  } = selected
  return label
}

function placeRouteLabels(
  diagram: DiagramProjection,
  edges: readonly UmlLayoutEdge[],
  obstacles: readonly UmlLayoutNode[],
): UmlLayoutEdge[] {
  const edgeById = new Map(diagram.edges.map((edge) => [edge.id, edge]))
  const segments = edges.flatMap((edge) => edge.points.slice(0, -1).map((start, index) => ({
    edgeId: edge.id,
    start,
    end: edge.points[index + 1]!,
  })))
  const placedLabels: UmlLayoutLabel[] = []
  return edges.map((edge) => {
    const definition = edgeById.get(edge.id)
    const label = definition
      ? labelForRoute(
        definition,
        edge.points,
        obstacles,
        segments.filter((segment) => segment.edgeId !== edge.id),
        placedLabels,
      )
      : edge.label
    if (label) placedLabels.push(label)
    return { ...edge, label }
  })
}

function layoutSwimlaneActivity(diagram: DiagramProjection): UmlDiagramLayout {
  const lanes = diagram.nodes.filter((node) => node.kind === 'swimlane')
  const semanticNodes = diagram.nodes.filter((node) => node.kind !== 'swimlane')
  const laneIds = new Set(lanes.map((lane) => lane.id))
  const laneWidth = lanes.length === 1 ? 640 : 202
  const laneGap = 10
  const laneHeader = 50
  const lanePadding = 20
  const rankGap = 34
  const itemGap = 16
  const ranks = activityRanks(semanticNodes, diagram.edges)
  const assignments = activityLaneAssignments(
    semanticNodes,
    diagram.edges,
    laneIds,
    lanes[0]!.id,
  )
  const maxRank = Math.max(0, ...ranks.values())
  const transitionGapByRank = new Map<number, number>()
  for (const node of semanticNodes) {
    const labeledOutgoing = diagram.edges.filter((edge) =>
      edge.fromId === node.id && !edge.isLoop && Boolean(edgeDisplayLabel(edge)))
    const transitionGap = labeledOutgoing.length
      ? labeledOutgoing.reduce((height, edge) =>
        height + edgeLabelSize(edgeDisplayLabel(edge)!).height + 10, 20)
      : 34
    const rank = ranks.get(node.id) ?? 0
    transitionGapByRank.set(rank, Math.max(
      transitionGapByRank.get(rank) ?? 34,
      transitionGap,
    ))
  }
  const buckets = new Map<string, DiagramProjectionNode[]>()
  for (const node of semanticNodes) {
    const key = `${assignments.get(node.id)}\u0000${ranks.get(node.id) ?? 0}`
    buckets.set(key, [...(buckets.get(key) ?? []), node])
  }
  const rowHeights = Array.from({ length: maxRank + 1 }, (_unused, rank) => {
    const laneHeights = lanes.map((lane) => {
      const items = buckets.get(`${lane.id}\u0000${rank}`) ?? []
      return lanes.length === 1
        ? Math.max(0, ...items.map((node) => swimlaneNodeSize(node).height))
        : items.reduce((height, node, index) =>
          height + swimlaneNodeSize(node).height + (index ? itemGap : 0), 0)
    })
    return Math.max(60, ...laneHeights)
      + Math.max(rankGap, transitionGapByRank.get(rank) ?? rankGap)
  })
  const rowTops: number[] = []
  let nextRowTop = laneHeader + lanePadding
  for (const rowHeight of rowHeights) {
    rowTops.push(nextRowTop)
    nextRowTop += rowHeight
  }
  const laneHeight = Math.max(440, nextRowTop + lanePadding)
  const laneLayouts: UmlLayoutNode[] = lanes.map((lane, index) => ({
    id: lane.id,
    kind: lane.kind,
    x: index * (laneWidth + laneGap),
    y: 0,
    width: laneWidth,
    height: laneHeight,
    ports: [],
  }))
  const laneById = new Map(laneLayouts.map((lane) => [lane.id, lane]))
  const nodeLayouts: UmlLayoutNode[] = []
  for (const lane of lanes) {
    const laneLayout = laneById.get(lane.id)!
    for (let rank = 0; rank <= maxRank; rank += 1) {
      const items = buckets.get(`${lane.id}\u0000${rank}`) ?? []
      let itemTop = rowTops[rank]!
      const itemSizes = items.map(swimlaneNodeSize)
      const totalWidth = itemSizes.reduce((width, size) => width + size.width, 0)
        + Math.max(0, itemSizes.length - 1) * itemGap
      let itemLeft = laneLayout.x + (laneWidth - totalWidth) / 2
      for (const node of items) {
        const size = swimlaneNodeSize(node)
        nodeLayouts.push({
          id: node.id,
          kind: node.kind,
          x: lanes.length === 1
            ? itemLeft
            : laneLayout.x + (laneWidth - size.width) / 2,
          y: itemTop,
          ...size,
          ports: [],
        })
        if (lanes.length === 1) {
          itemLeft += size.width + itemGap
        } else {
          itemTop += size.height + itemGap
        }
      }
    }
  }

  const byId = new Map(nodeLayouts.map((node) => [node.id, node]))
  const outgoing = new Map<string, DiagramProjectionEdge[]>()
  const incoming = new Map<string, DiagramProjectionEdge[]>()
  for (const edge of diagram.edges) {
    outgoing.set(edge.fromId, [...(outgoing.get(edge.fromId) ?? []), edge])
    incoming.set(edge.toId, [...(incoming.get(edge.toId) ?? []), edge])
  }
  for (const collection of outgoing.values()) {
    collection.sort((left, right) =>
      (byId.get(left.toId)?.x ?? 0) - (byId.get(right.toId)?.x ?? 0)
      || left.id.localeCompare(right.id))
  }
  for (const collection of incoming.values()) {
    collection.sort((left, right) =>
      (byId.get(left.fromId)?.x ?? 0) - (byId.get(right.fromId)?.x ?? 0)
      || left.id.localeCompare(right.id))
  }
  let backTrack = 0
  const reservedOuterTracks = diagram.edges.filter((edge) => {
    const fromRank = ranks.get(edge.fromId) ?? 0
    const toRank = ranks.get(edge.toId) ?? 0
    return edge.isLoop || toRank <= fromRank
  }).length
  let leftDetourTrack = 0
  let rightDetourTrack = 0
  const anchorX = (
    node: UmlLayoutNode,
    edge: DiagramProjectionEdge,
    collection: readonly DiagramProjectionEdge[],
  ) => {
    const index = Math.max(0, collection.findIndex((candidate) => candidate.id === edge.id))
    return node.x + node.width * ((index + 1) / (collection.length + 1))
  }
  const edges: UmlLayoutEdge[] = diagram.edges.flatMap((edge): UmlLayoutEdge[] => {
    const from = byId.get(edge.fromId)
    const to = byId.get(edge.toId)
    if (!from || !to) return []
    const fromRank = ranks.get(edge.fromId) ?? 0
    const toRank = ranks.get(edge.toId) ?? 0
    let points: UmlPoint[]
    let customLabel: UmlLayoutLabel | undefined
    if (!edge.isLoop && toRank > fromRank) {
      const start = {
        x: anchorX(from, edge, outgoing.get(edge.fromId) ?? [edge]),
        y: from.y + from.height,
      }
      const end = {
        x: anchorX(to, edge, incoming.get(edge.toId) ?? [edge]),
        y: to.y,
      }
      if (Math.abs(start.x - end.x) < 0.5) {
        points = [start, end]
      } else {
        const collection = outgoing.get(edge.fromId) ?? [edge]
        const sourceCenter = from.x + from.width / 2
        const leftTargets = collection
          .filter((candidate) => (byId.get(candidate.toId)?.x ?? sourceCenter) < sourceCenter)
          .sort((left, right) =>
            (byId.get(left.toId)?.x ?? 0) - (byId.get(right.toId)?.x ?? 0))
        const rightTargets = collection
          .filter((candidate) => (byId.get(candidate.toId)?.x ?? sourceCenter) >= sourceCenter)
          .sort((left, right) =>
            (byId.get(right.toId)?.x ?? 0) - (byId.get(left.toId)?.x ?? 0))
        const routeOrder = [...leftTargets, ...rightTargets]
        const trackIndex = Math.max(0, routeOrder.findIndex((candidate) => candidate.id === edge.id))
        const displayLabel = edgeDisplayLabel(edge)
        const labelSize = displayLabel ? edgeLabelSize(displayLabel) : undefined
        const precedingLabelHeight = collection
          .slice(0, trackIndex)
          .reduce((total, candidate) => {
            const candidateLabel = edgeDisplayLabel(candidate)
            return total + (candidateLabel ? edgeLabelSize(candidateLabel).height : 14) + 10
          }, 0)
        const desiredOffset = labelSize
          ? 14 + labelSize.height + precedingLabelHeight
          : 20 + trackIndex * 18
        const routeY = start.y + Math.min(
          Math.max(16, end.y - start.y - 16),
          desiredOffset,
        )
        points = [start, { x: start.x, y: routeY }, { x: end.x, y: routeY }, end]
      }
      const blockingRouteNodes = nodeLayouts.filter((node) => {
        if (node.id === from.id || node.id === to.id) return false
        return points.slice(0, -1).some((point, index) => {
          const next = points[index + 1]!
          if (Math.abs(point.x - next.x) < 0.5) {
            return point.x > node.x - 12
              && point.x < node.x + node.width + 12
              && Math.max(point.y, next.y) > node.y - 12
              && Math.min(point.y, next.y) < node.y + node.height + 12
          }
          if (Math.abs(point.y - next.y) < 0.5) {
            return point.y > node.y - 12
              && point.y < node.y + node.height + 12
              && Math.max(point.x, next.x) > node.x - 12
              && Math.min(point.x, next.x) < node.x + node.width + 12
          }
          return false
        })
      })
      if (blockingRouteNodes.length > 0) {
        const useLeftDetour = start.x <= from.x + from.width / 2
        const trackIndex = reservedOuterTracks + (
          useLeftDetour ? leftDetourTrack++ : rightDetourTrack++
        )
        const trackX = useLeftDetour
          ? laneLayouts[0]!.x - 28 - trackIndex * 14
          : laneLayouts.at(-1)!.x + laneWidth + 28 + trackIndex * 14
        const entryY = Math.min(
          end.y - 2,
          Math.max(
            end.y - 18,
            ...blockingRouteNodes.map((node) => node.y + node.height + 12),
          ),
        )
        points = [
          start,
          { x: start.x, y: start.y + 18 },
          { x: trackX, y: start.y + 18 },
          { x: trackX, y: entryY },
          { x: end.x, y: entryY },
          end,
        ]
        const displayLabel = edgeDisplayLabel(edge)
        if (displayLabel) {
          const size = edgeLabelSize(displayLabel)
          customLabel = {
            x: useLeftDetour ? trackX - size.width - 8 : trackX + 8,
            y: (start.y + end.y - size.height) / 2,
            ...size,
          }
        }
      }
    } else if (!edge.isLoop && fromRank === toRank) {
      const movingRight = to.x >= from.x
      const start = {
        x: movingRight ? from.x + from.width : from.x,
        y: from.y + from.height / 2,
      }
      const end = {
        x: movingRight ? to.x : to.x + to.width,
        y: to.y + to.height / 2,
      }
      const routeX = (start.x + end.x) / 2
      points = [start, { x: routeX, y: start.y }, { x: routeX, y: end.y }, end]
    } else {
      const contentCenter = (
        laneLayouts[0]!.x
        + laneLayouts.at(-1)!.x
        + laneWidth
      ) / 2
      const useLeftTrack = from.x + from.width / 2 <= contentCenter
      const sourceRelationships = outgoing.get(edge.fromId) ?? [edge]
      const targetRelationships = incoming.get(edge.toId) ?? [edge]
      const sourceIndex = Math.max(
        0,
        sourceRelationships.findIndex((candidate) => candidate.id === edge.id),
      )
      const targetIndex = Math.max(
        0,
        targetRelationships.findIndex((candidate) => candidate.id === edge.id),
      )
      const source = {
        x: useLeftTrack ? from.x : from.x + from.width,
        y: from.y + from.height * ((sourceIndex + 1) / (sourceRelationships.length + 1)),
      }
      const target = {
        x: useLeftTrack ? to.x : to.x + to.width,
        y: to.y + to.height * ((targetIndex + 1) / (targetRelationships.length + 1)),
      }
      const trackX = useLeftTrack
        ? laneLayouts[0]!.x - 28 - backTrack * 14
        : laneLayouts.at(-1)!.x + laneWidth + 28 + backTrack * 14
      backTrack += 1
      points = [
        source,
        { x: trackX, y: source.y },
        { x: trackX, y: target.y },
        target,
      ]
      const displayLabel = edgeDisplayLabel(edge)
      if (displayLabel) {
        const size = edgeLabelSize(displayLabel)
        customLabel = {
          x: useLeftTrack ? trackX - size.width - 8 : trackX + 8,
          y: (source.y + target.y - size.height) / 2,
          ...size,
        }
      }
    }
    const compact = compactPoints(points)
    return [{
      id: edge.id,
      points: compact,
      label: customLabel ?? labelForRoute(edge, compact, nodeLayouts),
    }]
  })
  return normalizeLayout(
    [...laneLayouts, ...nodeLayouts],
    placeRouteLabels(diagram, edges, nodeLayouts),
    'swimlane',
  )
}

function layoutRankedActivity(diagram: DiagramProjection): UmlDiagramLayout {
  const syntheticLaneId = `${diagram.id}:layout-lane`
  const syntheticDiagram: DiagramProjection = {
    ...diagram,
    nodes: [
      {
        id: syntheticLaneId,
        kind: 'swimlane',
        label: diagram.title,
        description: 'Presentation-only activity partition.',
        sourceRecordId: diagram.sourceRecordIds?.[0] ?? diagram.id,
        traceIds: [],
      },
      ...diagram.nodes.map((node) => ({
        ...node,
        parentId: syntheticLaneId,
      })),
    ],
  }
  const layout = layoutSwimlaneActivity(syntheticDiagram)
  return {
    ...layout,
    nodes: layout.nodes.filter((node) => node.id !== syntheticLaneId),
    engine: 'ranked-activity',
  }
}

function orthogonalCrossingMetrics(result: ElkNode): {
  count: number
  minimumClearance: number
} {
  const aligned = (left: number, right: number) => Math.abs(left - right) < 0.01
  const segments = (result.edges ?? []).flatMap((edge) => {
    const points = pointsForEdge(edge)
    return points.slice(0, -1).map((start, index) => ({
      edgeId: edge.id,
      start,
      end: points[index + 1]!,
    }))
  })
  let crossings = 0
  let minimumClearance = Number.POSITIVE_INFINITY
  for (let leftIndex = 0; leftIndex < segments.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < segments.length; rightIndex += 1) {
      const left = segments[leftIndex]!
      const right = segments[rightIndex]!
      if (left.edgeId === right.edgeId) continue
      const horizontal = aligned(left.start.y, left.end.y)
        ? left
        : aligned(right.start.y, right.end.y) ? right : undefined
      const vertical = aligned(left.start.x, left.end.x)
        ? left
        : aligned(right.start.x, right.end.x) ? right : undefined
      if (!horizontal || !vertical || horizontal === vertical) continue
      const crossingX = vertical.start.x
      const crossingY = horizontal.start.y
      if (
        crossingX > Math.min(horizontal.start.x, horizontal.end.x)
        && crossingX < Math.max(horizontal.start.x, horizontal.end.x)
        && crossingY > Math.min(vertical.start.y, vertical.end.y)
        && crossingY < Math.max(vertical.start.y, vertical.end.y)
      ) {
        crossings += 1
        minimumClearance = Math.min(
          minimumClearance,
          Math.abs(crossingX - horizontal.start.x),
          Math.abs(crossingX - horizontal.end.x),
          Math.abs(crossingY - vertical.start.y),
          Math.abs(crossingY - vertical.end.y),
        )
      }
    }
  }
  return { count: crossings, minimumClearance }
}

function layoutQuality(result: ElkNode): [number, number, number, number, number] {
  const width = result.width ?? MIN_CANVAS_WIDTH
  const height = result.height ?? MIN_CANVAS_HEIGHT
  const normalizedWidth = Math.max(width, MIN_CANVAS_WIDTH)
  const normalizedHeight = Math.max(height, MIN_CANVAS_HEIGHT)
  const targetAspect = MIN_CANVAS_WIDTH / MIN_CANVAS_HEIGHT
  const aspectPenalty = Math.abs(Math.log((normalizedWidth / normalizedHeight) / targetAspect))
  const routes = (result.edges ?? []).map(pointsForEdge)
  const routeLength = routes.reduce((total, points) =>
    total + points.slice(0, -1).reduce((length, point, index) => {
      const next = points[index + 1]!
      return length + Math.abs(next.x - point.x) + Math.abs(next.y - point.y)
    }, 0), 0)
  const bendCount = routes.reduce((total, points) => total + Math.max(0, points.length - 2), 0)
  const crossingMetrics = orthogonalCrossingMetrics(result)
  return [
    crossingMetrics.count,
    crossingMetrics.count ? -crossingMetrics.minimumClearance : 0,
    routeLength,
    bendCount,
    normalizedWidth * normalizedHeight * (1 + aspectPenalty * 0.25),
  ]
}

function isBetterQuality(
  candidate: ReturnType<typeof layoutQuality>,
  current: ReturnType<typeof layoutQuality>,
): boolean {
  return candidate.some((value, index) =>
    value < current[index]! && candidate.slice(0, index).every((prior, priorIndex) =>
      prior === current[priorIndex]))
}

async function layoutWithElk(diagram: DiagramProjection): Promise<UmlDiagramLayout> {
  const partitions = diagram.kind === 'use-case'
    ? useCaseActorPartitions(diagram)
    : [{ left: new Set<string>(), right: new Set<string>() }]
  const layoutVariants = diagram.kind === 'component'
    ? [
      ...['RIGHT', 'DOWN'].flatMap((direction, directionIndex) =>
        ['NETWORK_SIMPLEX', 'BRANDES_KOEPF', 'LINEAR_SEGMENTS', 'SIMPLE'].map((strategy, index) => ({
          'elk.direction': direction,
          'elk.randomSeed': String(directionIndex * 4 + index + 1),
          'elk.layered.nodePlacement.strategy': strategy,
        }))),
      ...(diagram.nodes.length >= 15 && diagram.edges.length >= diagram.nodes.length
        ? ['3', '4', '5'].flatMap((layerBound, boundIndex) =>
          ['NETWORK_SIMPLEX', 'BRANDES_KOEPF'].map((strategy, strategyIndex) => ({
            'elk.direction': 'RIGHT',
            'elk.randomSeed': String(9 + boundIndex * 2 + strategyIndex),
            'elk.layered.layering.strategy': 'COFFMAN_GRAHAM',
            'elk.layered.layering.coffmanGraham.layerBound': layerBound,
            'elk.layered.nodePlacement.strategy': strategy,
          })))
        : []),
    ]
    : [{}]
  let selected:
    | {
      result: ElkNode
      sizedNodes: Map<string, SizedNode>
      portsByParent: Map<string, DiagramProjectionNode[]>
      reversedEdgeIds: Set<string>
      quality: ReturnType<typeof layoutQuality>
    }
    | undefined

  for (const partition of partitions) {
    for (const variant of layoutVariants) {
      const built = buildElkGraph(diagram, partition, variant)
      const result = await elk.layout(built.graph)
      const quality = layoutQuality(result)
      if (!selected || isBetterQuality(quality, selected.quality)) {
        selected = { result, ...built, quality }
      }
      if (diagram.kind === 'component' && quality[0] === 0) break
    }
    if (diagram.kind === 'component' && selected?.quality[0] === 0) break
  }

  const {
    result,
    sizedNodes,
    portsByParent,
    reversedEdgeIds,
  } = selected!
  const nodes: UmlLayoutNode[] = []
  const visitNode = (node: ElkNode, parentX = 0, parentY = 0) => {
    const semantic = sizedNodes.get(node.id)!
    const x = parentX + (node.x ?? 0)
    const y = parentY + (node.y ?? 0)
    const ports = (node.ports ?? []).map((port): UmlLayoutPort => {
      const definition = (portsByParent.get(node.id) ?? []).find((candidate) => candidate.id === port.id)!
      return {
        id: definition.id,
        kind: definition.kind as UmlLayoutPort['kind'],
        label: definition.label,
        x: x + (port.x ?? 0) + (port.width ?? 0) / 2,
        y: y + (port.y ?? 0) + (port.height ?? 0) / 2,
      }
    })
    nodes.push({
      id: semantic.id,
      kind: semantic.kind,
      x,
      y,
      width: node.width ?? semantic.width,
      height: node.height ?? semantic.height,
      ports,
    })
    for (const child of node.children ?? []) visitNode(child, x, y)
  }
  for (const node of result.children ?? []) visitNode(node)
  const semanticNodeById = new Map(diagram.nodes.map((node) => [node.id, node]))
  const semanticEdgeById = new Map(diagram.edges.map((edge) => [edge.id, edge]))
  const layoutNodeById = new Map(nodes.map((node) => [node.id, node]))
  const laidOutEdges = (result.edges ?? []).map((edge): UmlLayoutEdge => {
    const semanticEdge = semanticEdgeById.get(edge.id)
    const sourceParentId = semanticEdge
      ? semanticNodeById.get(semanticEdge.fromId)?.parentId
      : undefined
    const targetParentId = semanticEdge
      ? semanticNodeById.get(semanticEdge.toId)?.parentId
      : undefined
    // ELK reports an edge whose endpoints share a compound parent in that
    // parent's local coordinate system. Mixed-level edges are already root
    // relative. Normalize both cases before JointJS receives the route.
    const sharedParent = sourceParentId && sourceParentId === targetParentId
      ? layoutNodeById.get(sourceParentId)
      : undefined
    const offsetX = sharedParent?.x ?? 0
    const offsetY = sharedParent?.y ?? 0
    const originalPoints = pointsForEdge(edge).map((point) => ({
      x: point.x + offsetX,
      y: point.y + offsetY,
    }))
    const points = reversedEdgeIds.has(edge.id) ? [...originalPoints].reverse() : originalPoints
    const label = edge.labels?.[0]
    const positionedLabel = label && label.x !== undefined && label.y !== undefined
      && label.width !== undefined && label.height !== undefined
      ? {
        x: label.x + offsetX,
        y: label.y + offsetY,
        width: label.width,
        height: label.height,
      }
      : label ? fallbackLabel(points, label) : undefined
    return {
      id: edge.id,
      points,
      label: positionedLabel,
    }
  })
  return normalizeLayout(nodes, laidOutEdges, 'elk-layered')
}

function sequenceEdgePoints(
  from: UmlLayoutNode,
  to: UmlLayoutNode,
  y: number,
): UmlPoint[] {
  const startX = from.x + from.width / 2
  const endX = to.x + to.width / 2
  if (from.id !== to.id) return [{ x: startX, y }, { x: endX, y }]
  return [
    { x: startX, y },
    { x: startX + 54, y },
    { x: startX + 54, y: y + 32 },
    { x: startX, y: y + 32 },
  ]
}

function layoutSequence(diagram: DiagramProjection): UmlDiagramLayout {
  const participants = diagram.nodes.filter((node) => node.kind === 'lifeline')
  const sizes = participants.map((node) => ({ node, ...sizeForNode(node) }))
  const gap = sizes.length > 6 ? 28 : 52
  const contentWidth = sizes.reduce((total, node) => total + node.width, 0)
    + Math.max(0, sizes.length - 1) * gap
  const width = Math.max(MIN_CANVAS_WIDTH, contentWidth + CANVAS_PADDING * 2)
  let x = (width - contentWidth) / 2
  const messageRows = diagram.edges.map((edge) => {
    const displayLabel = edgeDisplayLabel(edge)
    return displayLabel ? Math.max(58, edgeLabelSize(displayLabel).height + 34) : 58
  })
  const messageAreaHeight = Math.max(
    340,
    messageRows.reduce((total, rowHeight) => total + rowHeight, 0) + 92,
  )
  const nodes: UmlLayoutNode[] = sizes.map((entry) => {
    const node: UmlLayoutNode = {
      id: entry.node.id,
      kind: entry.node.kind,
      x,
      y: 42,
      width: entry.width,
      height: entry.height + messageAreaHeight,
      ports: [],
    }
    x += entry.width + gap
    return node
  })
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const edges = diagram.edges.flatMap((edge, index): UmlLayoutEdge[] => {
    const from = byId.get(edge.fromId)
    const to = byId.get(edge.toId)
    if (!from || !to) return []
    // A message label belongs to the message below it. Reserve that label's
    // height before the message line, not after the preceding line. This keeps
    // a tall guarded message label clear of the previous interaction.
    const y = 174 + messageRows.slice(1, index + 1)
      .reduce((total, rowHeight) => total + rowHeight, 0)
    const points = sequenceEdgePoints(from, to, y)
    const displayLabel = edgeDisplayLabel(edge)
    const labelSize = displayLabel ? edgeLabelSize(displayLabel) : undefined
    const left = Math.min(points[0]!.x, points.at(-1)!.x)
    const right = Math.max(points[0]!.x, points.at(-1)!.x)
    return [{
      id: edge.id,
      points,
      label: labelSize ? {
        x: (left + right - labelSize.width) / 2,
        y: y - labelSize.height - 12,
        ...labelSize,
      } : undefined,
    }]
  })
  const participantLeft = Math.min(...nodes.map((node) => node.x), CANVAS_PADDING)
  const participantRight = Math.max(
    ...nodes.map((node) => node.x + node.width),
    width - CANVAS_PADDING,
  )
  const fragmentNodes: UmlLayoutNode[] = diagram.nodes
    .filter((node) => node.kind === 'fragment')
    .map((fragment) => {
      const messageIndexes = diagram.edges
        .map((connector, index) =>
          fragment.traceIds.some((traceId) => connector.traceIds.includes(traceId))
            ? index
            : -1)
        .filter((index) => index >= 0)
      const coveredEdges = messageIndexes.map((index) => edges[index]).filter(Boolean) as UmlLayoutEdge[]
      const top = coveredEdges.length
        ? Math.min(...coveredEdges.map((connector) =>
          Math.min(connector.points[0]!.y - 38, connector.label?.y ?? Number.POSITIVE_INFINITY)))
        : 132
      const bottom = coveredEdges.length
        ? Math.max(...coveredEdges.map((connector) => connector.points.at(-1)!.y + 34))
        : top + 112
      return {
        id: fragment.id,
        kind: fragment.kind,
        x: participantLeft - 18,
        y: top,
        width: participantRight - participantLeft + 36,
        height: Math.max(96, bottom - top),
        ports: [],
      }
    })
  nodes.unshift(...fragmentNodes)
  return normalizeLayout(nodes, edges, 'temporal')
}

function linearStateOrder(diagram: DiagramProjection): DiagramProjectionNode[] | undefined {
  if (diagram.kind !== 'state-machine' || diagram.edges.length !== diagram.nodes.length - 1) {
    return undefined
  }
  const incoming = new Map(diagram.nodes.map((node) => [node.id, 0]))
  const outgoing = new Map<string, string[]>()
  for (const edge of diagram.edges) {
    if (!incoming.has(edge.fromId) || !incoming.has(edge.toId)) return undefined
    incoming.set(edge.toId, incoming.get(edge.toId)! + 1)
    const targets = outgoing.get(edge.fromId) ?? []
    targets.push(edge.toId)
    outgoing.set(edge.fromId, targets)
  }
  if ([...incoming.values()].some((count) => count > 1)) return undefined
  if ([...outgoing.values()].some((targets) => targets.length > 1)) return undefined
  const starts = diagram.nodes.filter((node) => incoming.get(node.id) === 0)
  if (starts.length !== 1) return undefined

  const byId = new Map(diagram.nodes.map((node) => [node.id, node]))
  const ordered: DiagramProjectionNode[] = []
  const visited = new Set<string>()
  let current: DiagramProjectionNode | undefined = starts[0]
  while (current && !visited.has(current.id)) {
    ordered.push(current)
    visited.add(current.id)
    const nextId = outgoing.get(current.id)?.[0]
    current = nextId ? byId.get(nextId) : undefined
  }
  return ordered.length === diagram.nodes.length ? ordered : undefined
}

function stateEdgeLabelSize(value: string): { width: number; height: number } {
  return {
    width: textWidth(value, 64, 136, 20),
    height: wrappedLineCount(value, 20) > 1 ? 38 : 24,
  }
}

function layoutLinearStateMachine(
  diagram: DiagramProjection,
  ordered: DiagramProjectionNode[],
): UmlDiagramLayout {
  const columns = ordered.length <= 4
    ? ordered.length
    : Math.min(4, Math.ceil(ordered.length / 2))
  const entries = ordered.map((node, order) => {
    const row = Math.floor(order / columns)
    const offset = order % columns
    const column = row % 2 === 0 ? offset : columns - 1 - offset
    return { node, order, row, column, ...sizeForNode(node) }
  })
  const rowCount = Math.ceil(ordered.length / columns)
  const columnWidths = Array.from({ length: columns }, (_unused, column) =>
    Math.max(...entries.filter((entry) => entry.column === column).map((entry) => entry.width), 0))
  const rowHeights = Array.from({ length: rowCount }, (_unused, row) =>
    Math.max(...entries.filter((entry) => entry.row === row).map((entry) => entry.height), 0))
  const columnGap = 150
  const rowGap = 142
  const columnLefts: number[] = []
  const rowTops: number[] = []
  for (let column = 0, x = 0; column < columns; column += 1) {
    columnLefts.push(x)
    x += columnWidths[column]! + columnGap
  }
  for (let row = 0, y = 0; row < rowCount; row += 1) {
    rowTops.push(y)
    y += rowHeights[row]! + rowGap
  }

  const nodes: UmlLayoutNode[] = entries.map((entry) => ({
    id: entry.node.id,
    kind: entry.node.kind,
    x: columnLefts[entry.column]! + (columnWidths[entry.column]! - entry.width) / 2,
    y: rowTops[entry.row]! + (rowHeights[entry.row]! - entry.height) / 2,
    width: entry.width,
    height: entry.height,
    ports: [],
  }))
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const entriesById = new Map(entries.map((entry) => [entry.node.id, entry]))
  const edges = diagram.edges.flatMap((edge): UmlLayoutEdge[] => {
    const from = nodesById.get(edge.fromId)
    const to = nodesById.get(edge.toId)
    const fromEntry = entriesById.get(edge.fromId)
    const toEntry = entriesById.get(edge.toId)
    if (!from || !to || !fromEntry || !toEntry) return []
    const sameRow = fromEntry.row === toEntry.row
    const movingRight = to.x > from.x
    const points = sameRow
      ? [
        { x: movingRight ? from.x + from.width : from.x, y: from.y + from.height / 2 },
        { x: movingRight ? to.x : to.x + to.width, y: to.y + to.height / 2 },
      ]
      : [
        { x: from.x + from.width / 2, y: from.y + from.height },
        { x: to.x + to.width / 2, y: to.y },
      ]
    const displayLabel = edgeDisplayLabel(edge)
    const labelSize = displayLabel ? stateEdgeLabelSize(displayLabel) : undefined
    const label = labelSize ? (
      sameRow
        ? {
          x: (points[0]!.x + points[1]!.x - labelSize.width) / 2,
          y: points[0]!.y - labelSize.height - 10,
          ...labelSize,
        }
        : {
          x: points[0]!.x - labelSize.width - 12,
          y: (points[0]!.y + points[1]!.y - labelSize.height) / 2,
          ...labelSize,
        }
    ) : undefined
    return [{ id: edge.id, points, label }]
  })
  return normalizeLayout(nodes, edges, 'balanced-state')
}

function layoutNonlinearStateMachine(diagram: DiagramProjection): UmlDiagramLayout {
  const ordered = [
    ...diagram.nodes.filter((node) => node.kind === 'initial'),
    ...diagram.nodes.filter((node) => node.kind !== 'initial' && node.kind !== 'final'),
    ...diagram.nodes.filter((node) => node.kind === 'final'),
  ]
  const columns = Math.min(3, Math.max(2, Math.ceil(Math.sqrt(ordered.length * 1.4))))
  const entries = ordered.map((node, order) => {
    const row = Math.floor(order / columns)
    const offset = order % columns
    const column = row % 2 === 0 ? offset : columns - 1 - offset
    return { node, order, row, column, ...sizeForNode(node) }
  })
  const rowCount = Math.ceil(ordered.length / columns)
  const columnWidths = Array.from({ length: columns }, (_unused, column) =>
    Math.max(...entries.filter((entry) => entry.column === column).map((entry) => entry.width), 0))
  const rowHeights = Array.from({ length: rowCount }, (_unused, row) =>
    Math.max(...entries.filter((entry) => entry.row === row).map((entry) => entry.height), 0))
  const columnGap = 184
  const rowGap = 188
  const columnLefts: number[] = []
  const rowTops: number[] = []
  for (let column = 0, x = 0; column < columns; column += 1) {
    columnLefts.push(x)
    x += columnWidths[column]! + columnGap
  }
  for (let row = 0, y = 0; row < rowCount; row += 1) {
    rowTops.push(y)
    y += rowHeights[row]! + rowGap
  }

  const nodes: UmlLayoutNode[] = entries.map((entry) => ({
    id: entry.node.id,
    kind: entry.node.kind,
    x: columnLefts[entry.column]! + (columnWidths[entry.column]! - entry.width) / 2,
    y: rowTops[entry.row]! + (rowHeights[entry.row]! - entry.height) / 2,
    width: entry.width,
    height: entry.height,
    ports: [],
  }))
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const entriesById = new Map(entries.map((entry) => [entry.node.id, entry]))
  const edgePairs = new Set(diagram.edges.map((edge) => `${edge.fromId}\u0000${edge.toId}`))
  let backTrack = 0
  const edges = diagram.edges.flatMap((edge): UmlLayoutEdge[] => {
    const from = nodesById.get(edge.fromId)
    const to = nodesById.get(edge.toId)
    const fromEntry = entriesById.get(edge.fromId)
    const toEntry = entriesById.get(edge.toId)
    if (!from || !to || !fromEntry || !toEntry) return []
    const sameRow = fromEntry.row === toEntry.row
    const reciprocal = edgePairs.has(`${edge.toId}\u0000${edge.fromId}`)
    let points: UmlPoint[]
    let customLabel: UmlLayoutLabel | undefined
    if (sameRow && !reciprocal) {
      const movingRight = to.x > from.x
      points = [
        {
          x: movingRight ? from.x + from.width : from.x,
          y: from.y + from.height / 2,
        },
        {
          x: movingRight ? to.x : to.x + to.width,
          y: to.y + to.height / 2,
        },
      ]
    } else if (sameRow) {
      const movingRight = to.x > from.x
      const routeY = movingRight
        ? Math.min(from.y, to.y) - 54
        : Math.max(from.y + from.height, to.y + to.height) + 54
      points = [
        {
          x: movingRight ? from.x + from.width : from.x,
          y: from.y + from.height / 2,
        },
        {
          x: movingRight ? from.x + from.width + 34 : from.x - 34,
          y: from.y + from.height / 2,
        },
        {
          x: movingRight ? from.x + from.width + 34 : from.x - 34,
          y: routeY,
        },
        {
          x: movingRight ? to.x - 34 : to.x + to.width + 34,
          y: routeY,
        },
        {
          x: movingRight ? to.x - 34 : to.x + to.width + 34,
          y: to.y + to.height / 2,
        },
        {
          x: movingRight ? to.x : to.x + to.width,
          y: to.y + to.height / 2,
        },
      ]
    } else if (toEntry.order > fromEntry.order) {
      const start = { x: from.x + from.width / 2, y: from.y + from.height }
      const end = { x: to.x + to.width / 2, y: to.y }
      const routeY = (start.y + end.y) / 2
      points = Math.abs(start.x - end.x) < 0.5
        ? [start, end]
        : [start, { x: start.x, y: routeY }, { x: end.x, y: routeY }, end]
    } else {
      const movingLeft = to.x <= from.x
      const start = {
        x: movingLeft ? from.x : from.x + from.width,
        y: from.y + from.height / 2,
      }
      const end = {
        x: to.x + to.width / 2,
        y: to.y,
      }
      const contentLeft = Math.min(...nodes.map((node) => node.x))
      const contentRight = Math.max(...nodes.map((node) => node.x + node.width))
      const trackX = movingLeft
        ? contentLeft - 68 - backTrack * 28
        : contentRight + 68 + backTrack * 28
      const trackY = Math.min(...nodes.map((node) => node.y)) - 68 - backTrack * 28
      backTrack += 1
      points = [
        start,
        { x: trackX, y: start.y },
        { x: trackX, y: trackY },
        { x: end.x, y: trackY },
        end,
      ]
      const displayLabel = edgeDisplayLabel(edge)
      if (displayLabel) {
        const size = edgeLabelSize(displayLabel)
        customLabel = {
          x: (trackX + end.x - size.width) / 2,
          y: trackY - size.height - 8,
          ...size,
        }
      }
    }
    const compact = compactPoints(points)
    return [{
      id: edge.id,
      points: compact,
      label: customLabel ?? labelForRoute(edge, compact),
    }]
  })
  return normalizeLayout(nodes, edges, 'balanced-state')
}

export async function layoutUmlDiagram(diagram: DiagramProjection): Promise<UmlDiagramLayout> {
  if (diagram.kind === 'sequence') return layoutSequence(diagram)
  if (diagram.kind === 'activity') {
    if (diagram.nodes.some((node) => node.kind === 'swimlane')) return layoutSwimlaneActivity(diagram)
    try {
      const result = await layoutWithElk(diagram)
      return { ...result, engine: 'ranked-activity' }
    } catch {
      return layoutRankedActivity(diagram)
    }
  }
  const stateOrder = linearStateOrder(diagram)
  if (stateOrder) return layoutLinearStateMachine(diagram, stateOrder)
  if (diagram.kind === 'state-machine') {
    try {
      const result = await layoutWithElk(diagram)
      return { ...result, engine: 'balanced-state' }
    } catch {
      return layoutNonlinearStateMachine(diagram)
    }
  }
  return layoutWithElk(diagram)
}
