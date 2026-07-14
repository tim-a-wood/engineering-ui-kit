/**
 * CAP-TEST-012 — Architecture diagram and list projection.
 */
import { describe, expect, it } from 'vitest'
import {
  focusArchitectureNeighbors,
  projectArchitecture,
} from '../../src/capabilities/architectureProjection.js'
import type {
  ArchitectureSpecification,
  FreshnessRecord,
  ModuleManifest,
} from '../../src/capabilities/types.js'

function buildTwentyNodeFixture(): {
  architecture: ArchitectureSpecification
  manifests: ModuleManifest[]
  freshness: Record<string, FreshnessRecord>
} {
  const moduleIds = Array.from({ length: 20 }, (_, i) => `mod.${String(i + 1).padStart(2, '0')}`)
  const groups = [
    { id: 'cap.primary', name: 'Primary capabilities', moduleIds: moduleIds.slice(0, 8) },
    { id: 'cap.platform', name: 'Platform', moduleIds: moduleIds.slice(8, 14) },
    { id: 'cap.connections', name: 'Connections', moduleIds: moduleIds.slice(14, 20) },
  ]
  const dependencyEdges = moduleIds.slice(1).map((id, index) => ({
    fromModuleId: id,
    toModuleId: moduleIds[index]!,
    reason: `depends on ${moduleIds[index]}`,
  }))
  const architecture: ArchitectureSpecification = {
    schemaVersion: '1.0',
    projectId: 'proj-arch',
    id: 'arch-20',
    revision: '3',
    status: 'approved',
    applicationSpecId: 'app-1',
    applicationSpecRevision: '1',
    applicationSpecHash: 'app-hash',
    capabilityProjections: groups,
    moduleIds,
    dependencyEdges,
    operationAllocations: moduleIds.map((id, i) => ({
      operationId: `op.${i + 1}`,
      moduleId: id,
    })),
    adapterAllocations: [
      { adapterId: 'adapter.filesystem', moduleId: moduleIds[14]!, portId: 'fs' },
      { adapterId: 'adapter.matlab', moduleId: moduleIds[15]!, portId: 'ml' },
    ],
    workflowTraces: [{ useCaseId: 'u1', moduleIds: moduleIds.slice(0, 5) }],
    proposals: [],
    unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
    contentHash: 'arch-20-hash',
  }

  const types = ['domain', 'workflow', 'experience', 'connection', 'platform'] as const
  const manifests: ModuleManifest[] = moduleIds.map((id, i) => ({
    schemaVersion: '1.0',
    architectureVersion: '1.0',
    moduleId: id,
    moduleVersion: `1.${i}.0`,
    moduleType: types[i % types.length]!,
    name: `Capability ${i + 1}`,
    responsibility: `resp-${i + 1}`,
    ownedConcerns: [`c-${i}`],
    excludedConcerns: ['other'],
    providedOperations: [{ operationId: `op.${i + 1}`, contractVersion: '1.0.0' }],
    requiredOperations:
      i > 0
        ? [
            {
              operationId: `op.${i}`,
              acceptedContractRange: '^1.0.0',
              reason: 'need',
            },
          ]
        : [],
    verificationSuiteIds: [`suite.${i + 1}`],
    runtimeAllocation: i >= 14 ? 'external-adapter' : 'local-embedded',
    events: [],
    ownedPaths: [`capabilities/modules/${id}/`],
  }))

  const freshness: Record<string, FreshnessRecord> = Object.fromEntries(
    moduleIds.map((id, i) => [
      id,
      {
        schemaVersion: '1.0' as const,
        moduleId: id,
        moduleVersion: `1.${i}.0`,
        hashes: {
          specification: `spec-${i}`,
          implementation: `impl-${i}`,
          architecture: 'arch-20-hash',
          dependencies: `dep-${i}`,
          adapters: `ad-${i}`,
          bindings: `bind-${i}`,
          verificationSuites: `vs-${i}`,
        },
        evaluatedAt: '2026-07-12T00:00:00.000Z',
        primaryState: (i % 5 === 0 ? 'ready' : i % 5 === 1 ? 'needs-review' : 'draft') as FreshnessRecord['primaryState'],
        reasonCodes: [],
      },
    ]),
  )

  return { architecture, manifests, freshness }
}

describe('CAP-TEST-012 architecture diagram and list projection', () => {
  it('matches source IDs and edges in Guided and Design; list is complete', () => {
    const { architecture, manifests, freshness } = buildTwentyNodeFixture()
    const sourceIds = architecture.moduleIds.slice().sort((a, b) => a.localeCompare(b))
    const sourceEdges = architecture.dependencyEdges
      .map((e) => `${e.fromModuleId}->${e.toModuleId}`)
      .sort()

    const guided = projectArchitecture(architecture, manifests, freshness, { mode: 'guided' })
    const design = projectArchitecture(architecture, manifests, freshness, { mode: 'design' })

    expect(guided.nodes.map((n) => n.id)).toEqual(sourceIds)
    expect(design.nodes.map((n) => n.id)).toEqual(sourceIds)
    expect(guided.edges.map((e) => e.id).sort()).toEqual(sourceEdges)
    expect(design.edges.map((e) => e.id).sort()).toEqual(sourceEdges)
    expect(guided.listItems.map((i) => i.id)).toEqual(sourceIds)
    expect(design.listItems.map((i) => i.id)).toEqual(sourceIds)
    expect(guided.listItems).toHaveLength(20)
    expect(design.listItems).toHaveLength(20)

    // Same underlying IDs across modes
    expect(guided.nodes.map((n) => n.id)).toEqual(design.nodes.map((n) => n.id))
  })

  it('exposes status as text and icon (color is redundant) and Design adds technical fields', () => {
    const { architecture, manifests, freshness } = buildTwentyNodeFixture()
    const guided = projectArchitecture(architecture, manifests, freshness, { mode: 'guided' })
    const design = projectArchitecture(architecture, manifests, freshness, { mode: 'design' })

    for (const node of guided.nodes) {
      expect(node.statusLabel.length).toBeGreaterThan(0)
      expect(node.statusIcon.length).toBeGreaterThan(0)
      expect(node.moduleType).toBeTruthy()
    }
    for (const node of design.nodes) {
      expect(node.moduleType).toBeTruthy()
      expect(node.moduleVersion).toBeTruthy()
      expect(node.runtimeAllocation).toBeTruthy()
      expect(node.ownedPaths?.length).toBeGreaterThan(0)
      expect(node.hashes).toBeTruthy()
      expect(node.statusLabel).toBeTruthy()
    }
  })

  it('supports focus neighbors and does not mutate source records', () => {
    const { architecture, manifests, freshness } = buildTwentyNodeFixture()
    const before = JSON.stringify(architecture)
    const projection = projectArchitecture(architecture, manifests, freshness, { mode: 'design' })
    const mid = projection.nodes[10]!
    const { focused, neighbors } = focusArchitectureNeighbors(projection, mid.id)
    expect(focused?.id).toBe(mid.id)
    expect(neighbors.map((n) => n.id).sort()).toEqual(mid.neighborIds.slice().sort())
    expect(JSON.stringify(architecture)).toBe(before)
  })

  it('marks proposed architecture nodes as proposed / dashed semantics', () => {
    const { architecture, manifests } = buildTwentyNodeFixture()
    const proposed = { ...architecture, status: 'proposed' as const }
    const projection = projectArchitecture(proposed, manifests, {}, { mode: 'guided' })
    expect(projection.nodes.every((n) => n.proposed && n.status === 'proposed')).toBe(true)
    expect(projection.edges.every((e) => e.suggested)).toBe(true)
  })

  it('uses design-time module definitions before module manifests exist', () => {
    const { architecture } = buildTwentyNodeFixture()
    const firstId = architecture.moduleIds[0]!
    architecture.moduleDefinitions = [{
      moduleId: firstId,
      name: 'Flight Planner',
      moduleType: 'workflow',
      responsibility: 'Coordinates the planning workflow.',
    }]
    const projection = projectArchitecture(architecture, [], {}, { mode: 'guided' })
    expect(projection.nodes[0]).toEqual(expect.objectContaining({
      name: 'Flight Planner', moduleType: 'workflow', responsibility: 'Coordinates the planning workflow.',
      status: 'planned', statusLabel: 'Planned',
    }))
  })
})
