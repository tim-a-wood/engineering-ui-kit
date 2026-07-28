/**
 * Shared activity-graph validation and deterministic normalization.
 *
 * The graph is renderer neutral. Callers must apply the application, allocation,
 * or module ownership rules in addition to these structural rules.
 */

import { diagnostic, sortDiagnostics, type CapDiagnostic } from './diagnostics.js'
import { canonicalRecordHash } from './hash.js'
import { checkSteEntries, type SteLexicon, type SteReviewDiagnostic } from './simplifiedTechnicalEnglish.js'
import type {
  ActivityEdge,
  ActivityGraph,
  ActivityNode,
  ActivityNodeKind,
} from './types.js'

export const EXECUTABLE_ACTIVITY_NODE_KINDS: readonly ActivityNodeKind[] = [
  'action',
  'call-operation',
  'send-event',
  'receive-event',
] as const

const executableKinds = new Set<ActivityNodeKind>(EXECUTABLE_ACTIVITY_NODE_KINDS)

export function isExecutableActivityNode(node: ActivityNode): boolean {
  return executableKinds.has(node.kind)
}

export type ActivityGraphEvaluation = {
  passed: boolean
  diagnostics: CapDiagnostic[]
  reviewDiagnostics: SteReviewDiagnostic[]
}

export type ActivityGraphValidationOptions = {
  fieldPath?: string
  includeSte?: boolean
  steLexicon?: SteLexicon
}

function pathFor(root: string, collection: 'nodes' | 'edges', id: string): string {
  return `${root}.${collection}.${id}`
}

function reachableIds(startId: string, outgoing: ReadonlyMap<string, readonly ActivityEdge[]>): Set<string> {
  const visited = new Set<string>()
  const queue = [startId]
  while (queue.length) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    for (const edge of outgoing.get(id) ?? []) queue.push(edge.toNodeId)
  }
  return visited
}

function cyclicNodeGroups(
  nodeIds: readonly string[],
  outgoing: ReadonlyMap<string, readonly ActivityEdge[]>,
): string[][] {
  const reachability = new Map(nodeIds.map((id) => [id, reachableIds(id, outgoing)]))
  const remaining = new Set(nodeIds)
  const groups: string[][] = []
  for (const id of nodeIds) {
    if (!remaining.has(id)) continue
    const group = nodeIds.filter((candidate) =>
      remaining.has(candidate)
      && reachability.get(id)?.has(candidate)
      && reachability.get(candidate)?.has(id))
    const hasSelfLoop = (outgoing.get(id) ?? []).some((edge) => edge.toNodeId === id)
    if (group.length > 1 || hasSelfLoop) groups.push(group.sort((left, right) => left.localeCompare(right)))
    for (const candidate of group) remaining.delete(candidate)
  }
  return groups
}

function activityGraphSteEntries(graph: ActivityGraph, fieldPath: string) {
  return [
    {
      text: graph.name,
      textClass: 'action-label' as const,
      fieldPath: `${fieldPath}.name`,
    },
    ...graph.nodes.flatMap((node) => [
      ...(!['initial', 'final', 'fork', 'join'].includes(node.kind)
        ? [{
            text: node.label,
            textClass: node.kind === 'decision' || node.kind === 'merge'
              ? 'technical-name' as const
              : 'action-label' as const,
            fieldPath: `${pathFor(fieldPath, 'nodes', node.id)}.label`,
          }]
        : []),
      ...(node.description
        ? [{
            text: node.description,
            textClass: 'description' as const,
            fieldPath: `${pathFor(fieldPath, 'nodes', node.id)}.description`,
          }]
        : []),
    ]),
    ...graph.edges.flatMap((edge) => [
      ...(edge.guard
        ? [{
            text: edge.guard,
            textClass: 'description' as const,
            fieldPath: `${pathFor(fieldPath, 'edges', edge.id)}.guard`,
          }]
        : []),
      ...(edge.loop?.exitCondition
        ? [{
            text: edge.loop.exitCondition,
            textClass: 'description' as const,
            fieldPath: `${pathFor(fieldPath, 'edges', edge.id)}.loop.exitCondition`,
          }]
        : []),
    ]),
  ]
}

/**
 * Validate UML activity semantics with stable diagnostic codes and field paths.
 */
export function validateActivityGraph(
  graph: ActivityGraph,
  options: ActivityGraphValidationOptions = {},
): ActivityGraphEvaluation {
  const root = options.fieldPath ?? `activityGraphs.${graph.id || 'unknown'}`
  const diagnostics: CapDiagnostic[] = []
  const nodeById = new Map<string, ActivityNode>()
  const edgeById = new Map<string, ActivityEdge>()

  if (!graph.id.trim()) {
    diagnostics.push(diagnostic('CAP-ACTIVITY-GRAPH-ID', 'Activity graph requires an ID.', {
      fieldPath: `${root}.id`,
    }))
  }
  if (!graph.name.trim()) {
    diagnostics.push(diagnostic('CAP-ACTIVITY-GRAPH-NAME', 'Activity graph requires a name.', {
      fieldPath: `${root}.name`,
    }))
  }

  graph.nodes.forEach((node, index) => {
    const nodePath = pathFor(root, 'nodes', node.id || String(index))
    if (!node.id.trim()) {
      diagnostics.push(diagnostic('CAP-ACTIVITY-NODE-ID', 'Activity node requires an ID.', {
        fieldPath: `${nodePath}.id`,
      }))
    } else if (nodeById.has(node.id)) {
      diagnostics.push(diagnostic('CAP-ACTIVITY-NODE-ID-DUPLICATE', 'Activity node IDs must be unique.', {
        fieldPath: `${nodePath}.id`,
        relatedIds: [node.id],
      }))
    } else {
      nodeById.set(node.id, node)
    }
    if (
      !['initial', 'final', 'fork', 'join'].includes(node.kind)
      && !node.label.trim()
    ) {
      diagnostics.push(diagnostic('CAP-ACTIVITY-NODE-LABEL', 'Activity node requires a label.', {
        fieldPath: `${nodePath}.label`,
        relatedIds: node.id ? [node.id] : undefined,
      }))
    }
    if (node.kind === 'call-operation' && !node.operationId?.trim()) {
      diagnostics.push(diagnostic('CAP-ACTIVITY-OPERATION-REF', 'Operation call requires an operation ID.', {
        fieldPath: `${nodePath}.operationId`,
        relatedIds: node.id ? [node.id] : undefined,
      }))
    }
    if ((node.kind === 'send-event' || node.kind === 'receive-event') && !node.eventId?.trim()) {
      diagnostics.push(diagnostic('CAP-ACTIVITY-EVENT-REF', 'Event action requires an event ID.', {
        fieldPath: `${nodePath}.eventId`,
        relatedIds: node.id ? [node.id] : undefined,
      }))
    }
  })

  graph.edges.forEach((edge, index) => {
    const edgePath = pathFor(root, 'edges', edge.id || String(index))
    if (!edge.id.trim()) {
      diagnostics.push(diagnostic('CAP-ACTIVITY-EDGE-ID', 'Activity edge requires an ID.', {
        fieldPath: `${edgePath}.id`,
      }))
    } else if (edgeById.has(edge.id)) {
      diagnostics.push(diagnostic('CAP-ACTIVITY-EDGE-ID-DUPLICATE', 'Activity edge IDs must be unique.', {
        fieldPath: `${edgePath}.id`,
        relatedIds: [edge.id],
      }))
    } else {
      edgeById.set(edge.id, edge)
    }
    if (!nodeById.has(edge.fromNodeId)) {
      diagnostics.push(diagnostic('CAP-ACTIVITY-EDGE-FROM', 'Activity edge references an unknown source node.', {
        fieldPath: `${edgePath}.fromNodeId`,
        relatedIds: [edge.fromNodeId],
      }))
    }
    if (!nodeById.has(edge.toNodeId)) {
      diagnostics.push(diagnostic('CAP-ACTIVITY-EDGE-TO', 'Activity edge references an unknown target node.', {
        fieldPath: `${edgePath}.toNodeId`,
        relatedIds: [edge.toNodeId],
      }))
    }
    if (edge.loop) {
      if (!edge.loop.exitCondition.trim()) {
        diagnostics.push(diagnostic('CAP-ACTIVITY-LOOP-EXIT', 'Loop requires an exit condition.', {
          fieldPath: `${edgePath}.loop.exitCondition`,
          relatedIds: edge.id ? [edge.id] : undefined,
        }))
      }
      if (
        edge.loop.maximumIterations !== undefined
        && (!Number.isInteger(edge.loop.maximumIterations) || edge.loop.maximumIterations < 1)
      ) {
        diagnostics.push(diagnostic('CAP-ACTIVITY-LOOP-LIMIT', 'Loop limit must be a positive integer.', {
          fieldPath: `${edgePath}.loop.maximumIterations`,
          relatedIds: edge.id ? [edge.id] : undefined,
        }))
      }
    }
  })

  const validEdges = graph.edges.filter((edge) =>
    nodeById.has(edge.fromNodeId) && nodeById.has(edge.toNodeId))
  const outgoing = new Map<string, ActivityEdge[]>()
  const incoming = new Map<string, ActivityEdge[]>()
  for (const nodeId of nodeById.keys()) {
    outgoing.set(nodeId, [])
    incoming.set(nodeId, [])
  }
  for (const edge of validEdges) {
    outgoing.get(edge.fromNodeId)!.push(edge)
    incoming.get(edge.toNodeId)!.push(edge)
  }

  const initialNodes = graph.nodes.filter((node) => node.kind === 'initial')
  const finalNodes = graph.nodes.filter((node) => node.kind === 'final')
  if (initialNodes.length !== 1) {
    diagnostics.push(diagnostic('CAP-ACTIVITY-INITIAL', 'Activity graph requires exactly one initial node.', {
      fieldPath: `${root}.nodes`,
      relatedIds: initialNodes.map((node) => node.id),
    }))
  }
  if (!finalNodes.length) {
    diagnostics.push(diagnostic('CAP-ACTIVITY-FINAL', 'Activity graph requires at least one final node.', {
      fieldPath: `${root}.nodes`,
    }))
  }

  if (initialNodes.length === 1) {
    const reachable = reachableIds(initialNodes[0]!.id, outgoing)
    for (const node of graph.nodes) {
      if (!reachable.has(node.id)) {
        diagnostics.push(diagnostic('CAP-ACTIVITY-UNREACHABLE', 'Activity node is not reachable from the initial node.', {
          fieldPath: pathFor(root, 'nodes', node.id),
          relatedIds: [node.id],
        }))
      }
    }
  }

  for (const node of graph.nodes) {
    const nodePath = pathFor(root, 'nodes', node.id)
    const nodeOutgoing = outgoing.get(node.id) ?? []
    const nodeIncoming = incoming.get(node.id) ?? []
    if (node.kind !== 'final' && nodeOutgoing.length === 0) {
      diagnostics.push(diagnostic('CAP-ACTIVITY-DEAD-END', 'Non-final activity node requires an outgoing edge.', {
        fieldPath: nodePath,
        relatedIds: [node.id],
      }))
    }
    if (node.kind === 'initial' && nodeOutgoing.length !== 1) {
      diagnostics.push(diagnostic('CAP-ACTIVITY-INITIAL-OUTGOING', 'Initial node requires exactly one outgoing edge.', {
        fieldPath: nodePath,
        relatedIds: [node.id],
      }))
    }
    if (node.kind === 'final' && nodeOutgoing.length > 0) {
      diagnostics.push(diagnostic('CAP-ACTIVITY-FINAL-OUTGOING', 'Final node cannot have an outgoing edge.', {
        fieldPath: nodePath,
        relatedIds: [node.id],
      }))
    }
    if (node.kind === 'decision') {
      if (nodeOutgoing.length < 2) {
        diagnostics.push(diagnostic('CAP-ACTIVITY-DECISION-BRANCHES', 'Decision requires at least two outgoing edges.', {
          fieldPath: nodePath,
          relatedIds: [node.id],
        }))
      }
      for (const edge of nodeOutgoing) {
        if (!edge.guard?.trim()) {
          diagnostics.push(diagnostic('CAP-ACTIVITY-DECISION-GUARD', 'Each decision edge requires a guard.', {
            fieldPath: `${pathFor(root, 'edges', edge.id)}.guard`,
            relatedIds: [node.id, edge.id],
          }))
        }
      }
    }
    if (node.kind === 'merge' && nodeIncoming.length < 2) {
      diagnostics.push(diagnostic('CAP-ACTIVITY-MERGE-INCOMING', 'Merge requires at least two incoming edges.', {
        fieldPath: nodePath,
        relatedIds: [node.id],
      }))
    }
    if (node.kind === 'fork' && nodeOutgoing.length < 2) {
      diagnostics.push(diagnostic('CAP-ACTIVITY-FORK-BRANCHES', 'Fork requires at least two outgoing edges.', {
        fieldPath: nodePath,
        relatedIds: [node.id],
      }))
    }
    if (node.kind === 'join' && nodeIncoming.length < 2) {
      diagnostics.push(diagnostic('CAP-ACTIVITY-JOIN-INCOMING', 'Join requires at least two incoming edges.', {
        fieldPath: nodePath,
        relatedIds: [node.id],
      }))
    }
  }

  const sortedNodeIds = [...nodeById.keys()].sort((left, right) => left.localeCompare(right))
  for (const group of cyclicNodeGroups(sortedNodeIds, outgoing)) {
    const groupIds = new Set(group)
    const cycleEdges = validEdges.filter((edge) =>
      groupIds.has(edge.fromNodeId) && groupIds.has(edge.toNodeId))
    if (!cycleEdges.some((edge) => edge.loop?.exitCondition.trim())) {
      diagnostics.push(diagnostic('CAP-ACTIVITY-CYCLE-EXIT', 'Cyclic activity flow requires a declared loop exit.', {
        fieldPath: `${root}.edges`,
        relatedIds: group,
      }))
    }
  }

  let reviewDiagnostics: SteReviewDiagnostic[] = []
  if (options.includeSte !== false) {
    const ste = checkSteEntries(activityGraphSteEntries(graph, root), { lexicon: options.steLexicon })
    diagnostics.push(...ste.diagnostics)
    reviewDiagnostics = ste.reviewDiagnostics
  }
  const sorted = sortDiagnostics(diagnostics)
  return { passed: sorted.length === 0, diagnostics: sorted, reviewDiagnostics }
}

/** Sort graph collections without changing behavior. */
export function normalizeActivityGraph(graph: ActivityGraph): ActivityGraph {
  return {
    ...graph,
    nodes: [...graph.nodes].sort((left, right) => left.id.localeCompare(right.id)),
    edges: [...graph.edges].sort((left, right) =>
      left.fromNodeId.localeCompare(right.fromNodeId)
      || left.toNodeId.localeCompare(right.toNodeId)
      || left.id.localeCompare(right.id)),
  }
}

export function activityGraphHash(graph: ActivityGraph): string {
  return canonicalRecordHash(normalizeActivityGraph(graph))
}
