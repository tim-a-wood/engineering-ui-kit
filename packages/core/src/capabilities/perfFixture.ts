/**
 * Performance fixture: 100 modules / 300 edges (CAP-PKT-031).
 */

import type { ArchitectureSpecification, ModuleManifest } from './types.js'

export function buildPerfFixture(seed = 1): {
  architecture: ArchitectureSpecification
  manifests: ModuleManifest[]
} {
  const moduleIds: string[] = []
  const manifests: ModuleManifest[] = []
  const TYPES = ['domain', 'workflow', 'experience', 'connection', 'platform'] as const
  for (let i = 0; i < 100; i += 1) {
    const id = `mod.perf.${String(i).padStart(3, '0')}`
    moduleIds.push(id)
    const moduleType = TYPES[i % TYPES.length]!
    manifests.push({
      schemaVersion: '1.0',
      architectureVersion: '1.0',
      moduleId: id,
      moduleVersion: '1.0.0',
      moduleType,
      name: `Perf ${i}`,
      responsibility: `responsibility ${i}`,
      ownedConcerns: [`c${i}`],
      excludedConcerns: ['other'],
      providedOperations: [{ operationId: `op.${i}`, contractVersion: '1.0.0' }],
      requiredOperations:
        i > 0
          ? [{ operationId: `op.${i - 1}`, acceptedContractRange: '^1.0.0', reason: 'chain' }]
          : [],
      verificationSuiteIds: ['suite.perf'],
      runtimeAllocation: moduleType === 'connection' ? 'external-adapter' : 'local-embedded',
      events: [],
      ownedPaths: [`capabilities/modules/${id}/`],
    })
  }
  const dependencyEdges: ArchitectureSpecification['dependencyEdges'] = []
  let produced = 0
  for (let i = 1; i < 100 && produced < 300; i += 1) {
    dependencyEdges.push({
      fromModuleId: moduleIds[i]!,
      toModuleId: moduleIds[i - 1]!,
      reason: 'chain',
    })
    produced += 1
  }
  // Add extra deterministic edges without cycles (always toward lower index).
  for (let i = 2; i < 100 && produced < 300; i += 1) {
    for (let span = 2; span < 6 && produced < 300; span += 1) {
      const target = i - span
      if (target < 0) break
      dependencyEdges.push({
        fromModuleId: moduleIds[i]!,
        toModuleId: moduleIds[target]!,
        reason: `span-${span}-seed-${seed}`,
      })
      produced += 1
    }
  }
  const architecture: ArchitectureSpecification = {
    schemaVersion: '1.0',
    projectId: 'perf',
    id: 'arch-perf',
    revision: '1',
    status: 'approved',
    applicationSpecId: 'app-perf',
    applicationSpecRevision: '1',
    applicationSpecHash: 'perf',
    capabilityProjections: [{ id: 'all', name: 'All', moduleIds }],
    moduleIds,
    dependencyEdges,
    operationAllocations: manifests.map((m) => ({
      operationId: m.providedOperations[0]!.operationId,
      moduleId: m.moduleId,
    })),
    adapterAllocations: [],
    workflowTraces: [{ useCaseId: 'u-perf', moduleIds }],
    proposals: [],
    unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
    contentHash: 'perf',
  }
  return { architecture, manifests }
}
