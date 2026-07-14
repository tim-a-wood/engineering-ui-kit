/**
 * Derived architecture diagram/list projection (CAP-PKT-010).
 * Read-only; no graph DB; IDs/edges come from architecture + manifests.
 */

import type {
  ArchitectureSpecification,
  FreshnessRecord,
  FreshnessState,
  ModuleManifest,
} from './types.js'

export type ArchitectureProjectionMode = 'guided' | 'design'

export type ArchitectureNodeStatus = FreshnessState | 'planned' | 'proposed' | 'unknown'

export type ArchitectureNodeProjection = {
  id: string
  name: string
  purposeGroup: string
  status: ArchitectureNodeStatus
  /** Plain-language status; never rely on color alone. */
  statusLabel: string
  /** Non-color cue (shape/icon name). */
  statusIcon: 'ready' | 'review' | 'blocked' | 'failed' | 'draft' | 'proposed' | 'unknown'
  proposed: boolean
  neighborIds: string[]
  toolsAndData: string[]
  responsibility?: string
  architectureRole?: 'inbound-adapter' | 'application' | 'domain-core' | 'outbound-adapter' | 'unassigned'
  laneLabel?: string
  layout: { x: number; y: number; column: number; row: number }
  moduleType?: string
  moduleVersion?: string
  runtimeAllocation?: string
  providedOperations?: { operationId: string; contractVersion: string }[]
  requiredOperations?: {
    operationId: string
    acceptedContractRange: string
    reason: string
  }[]
  ownedPaths?: string[]
  hashes?: FreshnessRecord['hashes']
  evidenceRefs?: string[]
}

export type ArchitectureEdgeProjection = {
  id: string
  from: string
  to: string
  reason: string
  /** Dotted when suggested/unconfirmed. */
  suggested: boolean
}

export type ArchitectureListItem = {
  id: string
  name: string
  purposeGroup: string
  statusLabel: string
  statusIcon: ArchitectureNodeProjection['statusIcon']
  moduleType?: string
  responsibility?: string
  neighborIds: string[]
  edgeSummaries: string[]
  designSummary?: string
}

export type ArchitectureProjection = {
  mode: ArchitectureProjectionMode
  architectureId: string
  architectureRevision: string
  architectureStatus: ArchitectureSpecification['status']
  nodes: ArchitectureNodeProjection[]
  edges: ArchitectureEdgeProjection[]
  listItems: ArchitectureListItem[]
}

const STATUS_LABEL: Record<ArchitectureNodeStatus, string> = {
  ready: 'Ready',
  'needs-review': 'Needs review',
  'verification-needed': 'Verification needed',
  'connection-outdated': 'Connection outdated',
  blocked: 'Blocked',
  failed: 'Failed',
  draft: 'Draft',
  planned: 'Planned',
  proposed: 'Proposed',
  unknown: 'Unknown',
}

const STATUS_ICON: Record<ArchitectureNodeStatus, ArchitectureNodeProjection['statusIcon']> = {
  ready: 'ready',
  'needs-review': 'review',
  'verification-needed': 'review',
  'connection-outdated': 'review',
  blocked: 'blocked',
  failed: 'failed',
  draft: 'draft',
  planned: 'proposed',
  proposed: 'proposed',
  unknown: 'unknown',
}

function purposeGroupFor(
  moduleId: string,
  architecture: ArchitectureSpecification,
): string {
  const match = architecture.capabilityProjections.find((g) => g.moduleIds.includes(moduleId))
  return match?.name ?? 'Ungrouped'
}

function toolsAndDataFor(
  moduleId: string,
  architecture: ArchitectureSpecification,
  manifest: ModuleManifest | undefined,
): string[] {
  const adapters = architecture.adapterAllocations
    .filter((a) => a.moduleId === moduleId)
    .map((a) => a.adapterId)
  const ops = architecture.operationAllocations
    .filter((a) => a.moduleId === moduleId)
    .map((a) => a.operationId)
  const owned = manifest?.ownedPaths ?? []
  return [...new Set([...adapters, ...ops, ...owned])].sort((a, b) => a.localeCompare(b))
}

function neighborsOf(moduleId: string, edges: ArchitectureEdgeProjection[]): string[] {
  const set = new Set<string>()
  for (const edge of edges) {
    if (edge.from === moduleId) set.add(edge.to)
    if (edge.to === moduleId) set.add(edge.from)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

function layoutNodes(
  moduleIds: string[],
  roleOf: (id: string) => ArchitectureNodeProjection['architectureRole'],
): Map<string, { x: number; y: number; column: number; row: number }> {
  const byRole = new Map<NonNullable<ArchitectureNodeProjection['architectureRole']>, string[]>()
  for (const id of moduleIds) {
    const role = roleOf(id) ?? 'unassigned'
    if (!byRole.has(role)) byRole.set(role, [])
    byRole.get(role)!.push(id)
  }
  const layout = new Map<string, { x: number; y: number; column: number; row: number }>()
  const roleOrder: NonNullable<ArchitectureNodeProjection['architectureRole']>[] = [
    'inbound-adapter', 'application', 'domain-core', 'outbound-adapter', 'unassigned',
  ]
  const colWidth = 258
  const rowHeight = 132
  roleOrder.forEach((role, column) => {
    const ids = (byRole.get(role) ?? []).slice().sort((a, b) => a.localeCompare(b))
    ids.forEach((id, row) => {
      layout.set(id, {
        column,
        row,
        x: 56 + column * colWidth,
        y: 78 + row * rowHeight,
      })
    })
  })
  return layout
}

function architectureRoleFor(moduleType: string | undefined): {
  role: NonNullable<ArchitectureNodeProjection['architectureRole']>
  laneLabel: string
} {
  if (moduleType === 'experience') return { role: 'inbound-adapter', laneLabel: 'Inbound adapters' }
  if (moduleType === 'workflow') return { role: 'application', laneLabel: 'Application' }
  if (moduleType === 'domain') return { role: 'domain-core', laneLabel: 'Domain core' }
  if (moduleType === 'connection' || moduleType === 'platform') {
    return { role: 'outbound-adapter', laneLabel: 'Outbound adapters' }
  }
  return { role: 'unassigned', laneLabel: 'Other modules' }
}

/**
 * Build a deterministic Guided or Design projection.
 * Does not mutate inputs. Edges and node IDs match architecture + manifests.
 */
export function projectArchitecture(
  architecture: ArchitectureSpecification,
  manifests: ModuleManifest[] = [],
  freshnessByModule: Readonly<Record<string, FreshnessRecord>> = {},
  options: { mode?: ArchitectureProjectionMode } = {},
): ArchitectureProjection {
  const mode = options.mode ?? 'guided'
  const byId = new Map(manifests.map((m) => [m.moduleId, m]))
  const definitionById = new Map((architecture.moduleDefinitions ?? []).map((definition) => [definition.moduleId, definition]))
  const moduleIds = architecture.moduleIds.slice().sort((a, b) => a.localeCompare(b))
  const proposedArchitecture =
    architecture.status === 'proposed' || architecture.status === 'draft'

  const suggested = architecture.status !== 'approved'
  const edges: ArchitectureEdgeProjection[] = architecture.dependencyEdges
    .slice()
    .sort((a, b) => {
      const from = a.fromModuleId.localeCompare(b.fromModuleId)
      if (from !== 0) return from
      return a.toModuleId.localeCompare(b.toModuleId)
    })
    .map((e) => ({
      id: `${e.fromModuleId}->${e.toModuleId}`,
      from: e.fromModuleId,
      to: e.toModuleId,
      reason: e.reason,
      suggested,
    }))

  const moduleTypeFor = (id: string) => byId.get(id)?.moduleType ?? definitionById.get(id)?.moduleType
  const layouts = layoutNodes(moduleIds, (id) => architectureRoleFor(moduleTypeFor(id)).role)

  const nodes: ArchitectureNodeProjection[] = moduleIds.map((id) => {
    const manifest = byId.get(id)
    const definition = definitionById.get(id)
    const freshness = freshnessByModule[id]
    const status: ArchitectureNodeStatus = proposedArchitecture
      ? 'proposed'
      : (freshness?.primaryState ?? (manifest ? 'draft' : 'planned'))
    const neighborIds = neighborsOf(id, edges)
    const moduleType = manifest?.moduleType ?? definition?.moduleType
    const architectureRole = architectureRoleFor(moduleType)
    const base: ArchitectureNodeProjection = {
      id,
      name: manifest?.name || definition?.name || id,
      purposeGroup: purposeGroupFor(id, architecture),
      status,
      statusLabel: STATUS_LABEL[status],
      statusIcon: STATUS_ICON[status],
      proposed: proposedArchitecture,
      neighborIds,
      toolsAndData: toolsAndDataFor(id, architecture, manifest),
      responsibility: manifest?.responsibility || definition?.responsibility,
      architectureRole: architectureRole.role,
      laneLabel: architectureRole.laneLabel,
      layout: layouts.get(id)!,
      moduleType,
    }
    if (mode === 'design') {
      base.moduleVersion = manifest?.moduleVersion
      base.runtimeAllocation = manifest?.runtimeAllocation
      base.providedOperations = manifest?.providedOperations.slice() ?? []
      base.requiredOperations = manifest?.requiredOperations.slice() ?? []
      base.ownedPaths = manifest?.ownedPaths.slice() ?? []
      base.hashes = freshness?.hashes
      base.evidenceRefs = freshness?.verificationEvidenceId
        ? [freshness.verificationEvidenceId]
        : []
    }
    return base
  })

  const listItems: ArchitectureListItem[] = nodes.map((node) => {
    const edgeSummaries = edges
      .filter((e) => e.from === node.id || e.to === node.id)
      .map((e) => `${e.from} → ${e.to} (${e.reason})`)
    const item: ArchitectureListItem = {
      id: node.id,
      name: node.name,
      purposeGroup: node.purposeGroup,
      statusLabel: node.statusLabel,
      statusIcon: node.statusIcon,
      moduleType: node.moduleType,
      responsibility: node.responsibility,
      neighborIds: node.neighborIds.slice(),
      edgeSummaries,
    }
    if (mode === 'design') {
      item.designSummary = [
        node.moduleType,
        node.moduleVersion,
        node.runtimeAllocation,
        ...(node.providedOperations?.map((o) => o.operationId) ?? []),
        ...(node.ownedPaths ?? []),
      ]
        .filter(Boolean)
        .join(' · ')
    }
    return item
  })

  return {
    mode,
    architectureId: architecture.id,
    architectureRevision: architecture.revision,
    architectureStatus: architecture.status,
    nodes,
    edges,
    listItems,
  }
}

/** Focus a node and return it plus direct neighbors (CAP-UX-002 focus). */
export function focusArchitectureNeighbors(
  projection: ArchitectureProjection,
  nodeId: string,
): { focused: ArchitectureNodeProjection | undefined; neighbors: ArchitectureNodeProjection[] } {
  const focused = projection.nodes.find((n) => n.id === nodeId)
  if (!focused) return { focused: undefined, neighbors: [] }
  const neighborSet = new Set(focused.neighborIds)
  const neighbors = projection.nodes.filter((n) => neighborSet.has(n.id))
  return { focused, neighbors }
}
