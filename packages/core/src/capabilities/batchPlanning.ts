import type {
  ArchitectureSpecification,
  CapabilityModuleRecord,
  ModuleManifest,
  ModuleType,
} from './types.js'

export type ModuleProposal = {
  moduleId: string
  manifest: ModuleManifest
  exceptionReasons: string[]
}

export type ModuleProposalBatch = {
  schemaVersion: '1.0'
  projectId: string
  architectureRevision: string
  architectureHash: string
  commonAssumptions: string[]
  proposals: ModuleProposal[]
  generatedAt: string
}

export type ImplementationWaveTarget = {
  moduleId: string
  name: string
  moduleType: ModuleType
  dependsOn: string[]
  allowedPaths: string[]
  batchEligible: boolean
}

export type ImplementationWave = {
  index: number
  targets: ImplementationWaveTarget[]
}

export type ImplementationWavePlan = {
  schemaVersion: '1.0'
  projectId: string
  architectureRevision: string
  waves: ImplementationWave[]
  blockedCycles: string[][]
  unapprovedModuleIds: string[]
  blockedByUnapproved: { moduleId: string; dependencyIds: string[] }[]
}

function safeSegment(moduleId: string): string {
  return moduleId
    .replace(/^mod\./, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'module'
}

function defaultRuntime(moduleType: ModuleType): ModuleManifest['runtimeAllocation'] {
  return moduleType === 'connection' ? 'external-adapter' : 'local-embedded'
}

/**
 * Deterministically proposes every architecture-allocated module together.
 * Missing architecture detail is surfaced as an exception, never hidden.
 */
export function proposeArchitectureModuleBatch(input: {
  projectId: string
  architecture: ArchitectureSpecification
  existing?: CapabilityModuleRecord[]
  generatedAt?: string
}): ModuleProposalBatch {
  const definitions = new Map(
    (input.architecture.moduleDefinitions ?? []).map((definition) => [definition.moduleId, definition]),
  )
  const existing = new Map((input.existing ?? []).map((record) => [record.moduleId, record]))
  const responsibilityById = new Map(
    input.architecture.moduleIds.map((moduleId) => [
      moduleId,
      definitions.get(moduleId)?.responsibility ?? `Own the ${moduleId} capability boundary.`,
    ]),
  )
  const operationsByModule = new Map<string, string[]>()
  for (const allocation of input.architecture.operationAllocations) {
    const values = operationsByModule.get(allocation.moduleId) ?? []
    values.push(allocation.operationId)
    operationsByModule.set(allocation.moduleId, values)
  }

  const proposals = input.architecture.moduleIds.map((moduleId): ModuleProposal => {
    const current = existing.get(moduleId)?.approved ?? existing.get(moduleId)?.draft
    if (current) return { moduleId, manifest: current, exceptionReasons: [] }
    const definition = definitions.get(moduleId)
    const moduleType = definition?.moduleType ?? 'domain'
    const explicitOperations = [...new Set(operationsByModule.get(moduleId) ?? [])].sort()
    const fallbackOperation = `operation.${safeSegment(moduleId)}.execute`
    const providedOperationIds = explicitOperations.length ? explicitOperations : [fallbackOperation]
    const dependencies = input.architecture.dependencyEdges
      .filter((edge) => edge.fromModuleId === moduleId)
      .map((edge) => edge.toModuleId)
    const requiredOperations = dependencies.flatMap((dependencyId) => {
      const dependencyOperations = operationsByModule.get(dependencyId) ?? []
      return (dependencyOperations.length
        ? dependencyOperations
        : [`operation.${safeSegment(dependencyId)}.execute`])
        .map((operationId) => ({
          operationId,
          acceptedContractRange: '^1.0',
          reason: input.architecture.dependencyEdges.find((edge) =>
            edge.fromModuleId === moduleId && edge.toModuleId === dependencyId)?.reason
            ?? `Uses ${dependencyId}.`,
        }))
    })
    const otherResponsibilities = input.architecture.moduleIds
      .filter((candidate) => candidate !== moduleId)
      .map((candidate) => responsibilityById.get(candidate)!)
      .slice(0, 4)
    const exceptionReasons = [
      ...(!definition ? ['Architecture does not contain an explicit module definition.'] : []),
      ...(explicitOperations.length === 0 ? ['Architecture allocates no explicit provided operation; a reviewable placeholder was proposed.'] : []),
      ...(moduleType === 'connection' && !input.architecture.adapterAllocations.some((allocation) => allocation.moduleId === moduleId)
        ? ['Connection module has no actor-specific adapter allocation.']
        : []),
    ]
    return {
      moduleId,
      exceptionReasons,
      manifest: {
        schemaVersion: '1.0',
        architectureVersion: '1.0',
        moduleId,
        moduleVersion: '1.0.0',
        moduleType,
        name: definition?.name ?? moduleId,
        responsibility: responsibilityById.get(moduleId)!,
        ownedConcerns: [responsibilityById.get(moduleId)!],
        excludedConcerns: otherResponsibilities.length
          ? otherResponsibilities
          : ['Presentation, integration, and platform concerns outside this module boundary.'],
        providedOperations: providedOperationIds.map((operationId) => ({
          operationId,
          contractVersion: '1.0',
        })),
        requiredOperations,
        verificationSuiteIds: [`suite.${safeSegment(moduleId)}`],
        runtimeAllocation: defaultRuntime(moduleType),
        events: [],
        ownedPaths: [`src/capabilities/${safeSegment(moduleId)}`],
      },
    }
  })
  return {
    schemaVersion: '1.0',
    projectId: input.projectId,
    architectureRevision: input.architecture.revision,
    architectureHash: input.architecture.contentHash,
    commonAssumptions: [
      'Operation contracts begin at version 1.0 unless the architecture allocates another version.',
      'Each module owns one repository-relative source boundary and one verification suite.',
      'Module dependencies are consumed through required operation contracts, never direct implementation imports.',
      'Connection modules represent technology-neutral boundaries; concrete actor adapters remain separately reviewable.',
    ],
    proposals,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  }
}

function cycleFromRemaining(remaining: Set<string>, dependencies: Map<string, Set<string>>): string[] {
  const start = [...remaining].sort()[0]
  if (!start) return []
  const path: string[] = []
  const positions = new Map<string, number>()
  let current = start
  while (!positions.has(current)) {
    positions.set(current, path.length)
    path.push(current)
    const next = [...(dependencies.get(current) ?? [])].filter((id) => remaining.has(id)).sort()[0]
    if (!next) return path
    current = next
  }
  return path.slice(positions.get(current)).concat(current)
}

/** Topological implementation waves: dependencies are implemented before their consumers. */
export function planImplementationWaves(input: {
  projectId: string
  architecture: ArchitectureSpecification
  modules: CapabilityModuleRecord[]
}): ImplementationWavePlan {
  const approved = new Map(
    input.modules
      .filter((record): record is CapabilityModuleRecord & { approved: ModuleManifest } => Boolean(record.approved))
      .map((record) => [record.moduleId, record.approved]),
  )
  const unapprovedModuleIds = input.architecture.moduleIds.filter((moduleId) => !approved.has(moduleId))
  const allDependencies = new Map<string, Set<string>>(
    input.architecture.moduleIds.map((moduleId) => [moduleId, new Set<string>()]),
  )
  for (const edge of input.architecture.dependencyEdges) {
    if (allDependencies.has(edge.fromModuleId) && allDependencies.has(edge.toModuleId)) {
      allDependencies.get(edge.fromModuleId)!.add(edge.toModuleId)
    }
  }
  const eligible = new Set(input.architecture.moduleIds.filter((moduleId) => approved.has(moduleId)))
  const blockedByUnapprovedMap = new Map<string, Set<string>>()
  let changed = true
  while (changed) {
    changed = false
    for (const moduleId of [...eligible]) {
      const blockedDependencies = [...(allDependencies.get(moduleId) ?? [])]
        .filter((dependencyId) => !eligible.has(dependencyId))
      if (blockedDependencies.length === 0) continue
      blockedByUnapprovedMap.set(moduleId, new Set(blockedDependencies))
      eligible.delete(moduleId)
      changed = true
    }
  }
  const dependencies = new Map<string, Set<string>>(
    [...eligible].map((moduleId) => [moduleId, new Set<string>()]),
  )
  for (const edge of input.architecture.dependencyEdges) {
    if (eligible.has(edge.fromModuleId) && eligible.has(edge.toModuleId)) {
      dependencies.get(edge.fromModuleId)!.add(edge.toModuleId)
    }
  }
  const remaining = new Set(eligible)
  const waves: ImplementationWave[] = []
  while (remaining.size > 0) {
    const ready = [...remaining]
      .filter((moduleId) => [...(dependencies.get(moduleId) ?? [])].every((dependency) => !remaining.has(dependency)))
      .sort()
    if (ready.length === 0) break
    waves.push({
      index: waves.length + 1,
      targets: ready.map((moduleId) => {
        const manifest = approved.get(moduleId)!
        return {
          moduleId,
          name: manifest.name,
          moduleType: manifest.moduleType,
          dependsOn: [...(dependencies.get(moduleId) ?? [])].sort(),
          allowedPaths: manifest.ownedPaths,
          batchEligible: manifest.ownedPaths.length > 0,
        }
      }),
    })
    for (const moduleId of ready) remaining.delete(moduleId)
  }
  return {
    schemaVersion: '1.0',
    projectId: input.projectId,
    architectureRevision: input.architecture.revision,
    waves,
    blockedCycles: remaining.size ? [cycleFromRemaining(remaining, dependencies)] : [],
    unapprovedModuleIds,
    blockedByUnapproved: [...blockedByUnapprovedMap]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([moduleId, dependencyIds]) => ({ moduleId, dependencyIds: [...dependencyIds].sort() })),
  }
}
