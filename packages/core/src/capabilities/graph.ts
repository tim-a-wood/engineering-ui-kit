/**
 * Derived capability dependency graph and architecture rules (CAP-PKT-002).
 */

import type { ArchitectureSpecification, ModuleManifest } from './types.js'
import { diagnostic, sortDiagnostics, type CapDiagnostic } from './diagnostics.js'

export type CapabilityGraphNode = {
  id: string
  moduleType?: string
  runtimeAllocation?: string
}

export type CapabilityGraphEdge = {
  from: string
  to: string
  reason: string
}

export type CapabilityGraph = {
  nodes: CapabilityGraphNode[]
  edges: CapabilityGraphEdge[]
}

const APPROVED_EXTERNAL_ADAPTERS = new Set([
  'adapter.filesystem',
  'adapter.matlab',
  'adapter.azure-devops',
])

export function buildCapabilityGraph(
  architecture: ArchitectureSpecification,
  manifests: ModuleManifest[] = [],
): CapabilityGraph {
  const byId = new Map(manifests.map((m) => [m.moduleId, m]))
  const nodes: CapabilityGraphNode[] = (architecture.moduleIds ?? [])
    .slice()
    .sort((a, b) => a.localeCompare(b))
    .map((id) => {
      const manifest = byId.get(id)
      return {
        id,
        moduleType: manifest?.moduleType,
        runtimeAllocation: manifest?.runtimeAllocation,
      }
    })
  const edges = (architecture.dependencyEdges ?? [])
    .slice()
    .sort((a, b) => {
      const from = String(a.fromModuleId ?? '').localeCompare(String(b.fromModuleId ?? ''))
      if (from !== 0) return from
      return String(a.toModuleId ?? '').localeCompare(String(b.toModuleId ?? ''))
    })
    .map((e) => ({
      from: String(e.fromModuleId ?? ''),
      to: String(e.toModuleId ?? ''),
      reason: typeof e.reason === 'string' ? e.reason : '',
    }))
  return { nodes, edges }
}

export function detectCycles(graph: CapabilityGraph): string[][] {
  const adj = new Map<string, string[]>()
  for (const node of graph.nodes) adj.set(node.id, [])
  for (const edge of graph.edges) {
    if (!adj.has(edge.from)) adj.set(edge.from, [])
    adj.get(edge.from)!.push(edge.to)
  }
  for (const [, targets] of adj) targets.sort((a, b) => a.localeCompare(b))

  const cycles: string[][] = []
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const stack: string[] = []

  function dfs(node: string) {
    if (visiting.has(node)) {
      const start = stack.indexOf(node)
      cycles.push(stack.slice(start).concat(node))
      return
    }
    if (visited.has(node)) return
    visiting.add(node)
    stack.push(node)
    for (const next of adj.get(node) ?? []) dfs(next)
    stack.pop()
    visiting.delete(node)
    visited.add(node)
  }

  for (const id of [...adj.keys()].sort()) dfs(id)
  return cycles
}

export function evaluateArchitectureRules(
  architecture: ArchitectureSpecification,
  manifests: ModuleManifest[],
): CapDiagnostic[] {
  const diagnostics: CapDiagnostic[] = []
  const graph = buildCapabilityGraph(architecture, manifests)
  const byId = new Map(manifests.map((m) => [m.moduleId, m]))

  for (const cycle of detectCycles(graph)) {
    diagnostics.push(
      diagnostic('CAP-AR-006', 'dependency cycle violates architecture rules', {
        ruleId: 'CAP-AR-006',
        relatedIds: cycle,
      }),
    )
  }

  for (const manifest of manifests) {
    for (const req of manifest.requiredOperations) {
      const provider = manifests.find((m) =>
        m.providedOperations.some((p) => p.operationId === req.operationId),
      )
      if (!provider) {
        diagnostics.push(
          diagnostic('CAP-AR-005', 'required operation is not declared by any module', {
            ruleId: 'CAP-AR-005',
            relatedIds: [manifest.moduleId, req.operationId],
          }),
        )
      }
    }
    for (const owned of manifest.ownedPaths) {
      if (owned.startsWith('/') || /^[A-Za-z]:[\\/]/.test(owned)) {
        diagnostics.push(
          diagnostic('CAP-AR-008', 'ownedPaths must be repository-relative', {
            ruleId: 'CAP-AR-008',
            relatedIds: [manifest.moduleId],
            fieldPath: 'ownedPaths',
          }),
        )
      }
    }
    if (
      manifest.runtimeAllocation === 'external-adapter' &&
      !manifest.moduleId.startsWith('adapter.') &&
      !APPROVED_EXTERNAL_ADAPTERS.has(manifest.moduleId)
    ) {
      // connection modules may wrap approved adapters; flag unknown adapter ids in allocations
    }
    if (
      manifest.runtimeAllocation !== 'local-embedded' &&
      manifest.runtimeAllocation !== 'external-adapter'
    ) {
      diagnostics.push(
        diagnostic('CAP-AR-010', 'unsupported runtime allocation', {
          ruleId: 'CAP-AR-010',
          relatedIds: [manifest.moduleId],
        }),
      )
    }
  }

  for (const edge of architecture.dependencyEdges) {
    const from = byId.get(edge.fromModuleId)
    const to = byId.get(edge.toModuleId)
    if (from?.moduleType === 'experience' && to?.moduleType === 'connection') {
      diagnostics.push(
        diagnostic('CAP-AR-001', 'experience modules must not depend directly on adapters/connections', {
          ruleId: 'CAP-AR-001',
          relatedIds: [edge.fromModuleId, edge.toModuleId],
        }),
      )
    }
    if (from?.moduleType === 'domain' && (to?.moduleType === 'experience' || to?.moduleType === 'connection')) {
      diagnostics.push(
        diagnostic('CAP-AR-003', 'domain modules may depend only on domain code and ports', {
          ruleId: 'CAP-AR-003',
          relatedIds: [edge.fromModuleId, edge.toModuleId],
        }),
      )
    }
  }

  for (const alloc of architecture.adapterAllocations) {
    if (!APPROVED_EXTERNAL_ADAPTERS.has(alloc.adapterId) && !alloc.adapterId.startsWith('port.')) {
      diagnostics.push(
        diagnostic('CAP-AR-010', 'MVP allows only filesystem, MATLAB, or Azure DevOps adapters', {
          ruleId: 'CAP-AR-010',
          relatedIds: [alloc.adapterId],
        }),
      )
    }
  }

  return sortDiagnostics(diagnostics)
}
