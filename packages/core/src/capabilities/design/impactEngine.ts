/**
 * EUC-07 — Impact engine.
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §10 (all),
 * §25.3 (EUC-07). Builds a `DesignImpactRecord` for one proposed design
 * change: traverses direct and transitive consumers through the module
 * dependency graph (§10.2), classifies the minimum invalidation per change
 * kind exactly per the §10.3 matrix, and produces a dependency-ordered
 * required-change plan (§10.4).
 *
 * Reuses `buildCapabilityGraph` (../graph.js) for the module dependency
 * graph and the graph-growing traversal pattern used by `calculateImpact`
 * (../impact.ts). Deliberately does not import other `design/*.ts` modules
 * that other agents are concurrently editing; only the shared, read-only
 * contracts (`./records.js`, `./identity.js`, `../types.js`, `../graph.js`)
 * are used.
 *
 * Pure and deterministic: no I/O, no clock reads except where a caller
 * supplies a timestamp explicitly.
 */

import type { ArchitectureSpecification } from '../types.js'
import { buildCapabilityGraph, type CapabilityGraph } from '../graph.js'
import { childId, designContentHash, stableSortBy } from './identity.js'
import type {
  DesignChangeKind,
  DesignImpactItem,
  DesignImpactRecord,
  DiagramProjectionRef,
  ModuleDesignSpecification,
  ScenarioRun,
  UseCaseAnalysis,
} from './records.js'

// ---------------------------------------------------------------------------
// World and change target inputs
// ---------------------------------------------------------------------------

/** Minimal projection of a registered operation contract (EUC-05 owns the full registry). */
export type ImpactContractRef = {
  operationId: string
  version: string
  providerModuleId: string
}

/**
 * The record universe an impact calculation reasons over. Every field is
 * optional except `architecture` and `moduleDesigns`, so a caller can supply
 * only what it has (§10.2 lists many categories; not every project has all
 * of them at every point in the workflow).
 */
export type ImpactWorld = {
  useCaseAnalysis?: UseCaseAnalysis
  architecture: ArchitectureSpecification
  moduleDesigns: ModuleDesignSpecification[]
  contracts?: ImpactContractRef[]
  /** Present for completeness (§10.2 "baselines"); not read directly by this engine. */
  baselines?: unknown[]
  /** Diagram projections, or bare diagram ids when the caller has no full projection. */
  diagrams?: (DiagramProjectionRef | string)[]
  scenarioRuns?: ScenarioRun[]
  /** moduleId -> module test ids. */
  moduleTestIds?: Record<string, string[]>
  /** adapterId or moduleId -> connection test ids. */
  connectionTestIds?: Record<string, string[]>
  /** scenarioId -> end-to-end test ids. */
  endToEndTestIds?: Record<string, string[]>
  /** moduleId -> implementation packet ids. */
  implementationPacketIds?: Record<string, string[]>
}

/** The specifics of one proposed change; which fields are required depends on `changeKind`. */
export type ImpactChangeTarget = {
  moduleId?: string
  operationId?: string
  schemaId?: string
  sourceModuleId?: string
  targetModuleId?: string
  adapterId?: string
  portId?: string
  deployableId?: string
  ownedPath?: string
  splitOrMergeModuleIds?: string[]
  useCaseId?: string
  scenarioId?: string
  stepId?: string
}

export type AnalyzeDesignChangeInput = {
  projectId: string
  changeKind: DesignChangeKind
  initiatingRecordId: string
  initiatingRevision: string
  description: string
  target?: ImpactChangeTarget
  world: ImpactWorld
  impactId?: string
  createdAt?: string
}

// ---------------------------------------------------------------------------
// Graph traversal (§10.2 "direct and transitive" consumers)
// ---------------------------------------------------------------------------

/**
 * Grows `seeds` to include every module that depends on a module already in
 * the set, directly or transitively, via architecture dependency edges
 * (edge.from depends on edge.to). Same growth pattern as
 * `calculateImpact` in ../impact.ts, generalized to an arbitrary seed set.
 */
function transitiveConsumers(graph: CapabilityGraph, seeds: Iterable<string>): Set<string> {
  const affected = new Set<string>(seeds)
  let grew = true
  while (grew) {
    grew = false
    for (const edge of graph.edges) {
      if (affected.has(edge.to) && !affected.has(edge.from)) {
        affected.add(edge.from)
        grew = true
      }
    }
  }
  return affected
}

/**
 * Dependency-ordered (upstream/provider first) module order over the induced
 * subgraph of `moduleIds`, with a stable localeCompare tie-break (§10.4).
 */
function topologicalModuleOrder(graph: CapabilityGraph, moduleIds: Iterable<string>): string[] {
  const affected = new Set(moduleIds)
  // Ordering edge: provider (edge.to) must precede consumer (edge.from).
  const dependents = new Map<string, string[]>()
  const inDegree = new Map<string, number>()
  for (const id of affected) inDegree.set(id, 0)
  for (const edge of graph.edges) {
    if (!affected.has(edge.from) || !affected.has(edge.to) || edge.from === edge.to) continue
    const list = dependents.get(edge.to) ?? []
    list.push(edge.from)
    dependents.set(edge.to, list)
    inDegree.set(edge.from, (inDegree.get(edge.from) ?? 0) + 1)
  }

  const ready = [...affected].filter((id) => (inDegree.get(id) ?? 0) === 0).sort((a, b) => a.localeCompare(b))
  const result: string[] = []
  const remaining = new Set(affected)

  while (ready.length) {
    ready.sort((a, b) => a.localeCompare(b))
    const next = ready.shift() as string
    if (!remaining.has(next)) continue
    result.push(next)
    remaining.delete(next)
    for (const dependent of dependents.get(next) ?? []) {
      const nextDegree = (inDegree.get(dependent) ?? 0) - 1
      inDegree.set(dependent, nextDegree)
      if (nextDegree === 0 && remaining.has(dependent)) ready.push(dependent)
    }
  }

  // Any leftover indicates a cycle; append deterministically rather than drop it.
  for (const id of [...remaining].sort((a, b) => a.localeCompare(b))) result.push(id)
  return result
}

// ---------------------------------------------------------------------------
// Lookup helpers over the world
// ---------------------------------------------------------------------------

function moduleDesignById(world: ImpactWorld, moduleId: string): ModuleDesignSpecification | undefined {
  return world.moduleDesigns.find((m) => m.module.moduleId === moduleId)
}

function findOperationProvider(world: ImpactWorld, operationId: string): string | undefined {
  const fromDesigns = world.moduleDesigns.find((m) => m.providedOperations.some((op) => op.operationId === operationId))
  if (fromDesigns) return fromDesigns.module.moduleId
  return (world.contracts ?? []).find((c) => c.operationId === operationId)?.providerModuleId
}

function findOperationDirectConsumers(world: ImpactWorld, operationId: string): string[] {
  return world.moduleDesigns
    .filter((m) => m.requiredOperations.some((op) => op.operationId === operationId))
    .map((m) => m.module.moduleId)
}

function findSchemaProvider(world: ImpactWorld, schemaId: string): string | undefined {
  return world.moduleDesigns.find((m) =>
    m.schemas.some((s) => s.schemaId === schemaId && (s.role === 'output' || s.role === 'persistent')),
  )?.module.moduleId
}

function findSchemaDirectConsumers(world: ImpactWorld, schemaId: string): string[] {
  return world.moduleDesigns
    .filter((m) => m.schemas.some((s) => s.schemaId === schemaId && s.role === 'input'))
    .map((m) => m.module.moduleId)
}

function normalizedDiagramRefs(world: ImpactWorld): { diagramId: string; sourceRecordId?: string }[] {
  return (world.diagrams ?? []).map((d) => (typeof d === 'string' ? { diagramId: d } : { diagramId: d.diagramId, sourceRecordId: d.sourceRecordId }))
}

/** Diagram ids projected from the architecture record, or the architecture id itself as a fallback. */
function architectureDiagramIds(world: ImpactWorld): string[] {
  const matches = normalizedDiagramRefs(world).filter((d) => d.sourceRecordId === world.architecture.id)
  return matches.length ? matches.map((d) => d.diagramId) : [world.architecture.id]
}

type AffectedScenario = { useCaseId: string; scenarioId: string; stepIds: string[] }

/** Scenarios that contain at least one step traced to one of `moduleIds` (§10.2 "scenarios and steps"). */
function affectedScenariosForModules(world: ImpactWorld, moduleIds: Iterable<string>): AffectedScenario[] {
  const stepIds = new Set<string>()
  for (const id of moduleIds) {
    for (const stepId of moduleDesignById(world, id)?.trace.scenarioStepIds ?? []) stepIds.add(stepId)
  }
  if (!world.useCaseAnalysis || stepIds.size === 0) return []
  const result: AffectedScenario[] = []
  for (const useCase of world.useCaseAnalysis.useCases) {
    for (const scenario of useCase.scenarios) {
      const matched = scenario.steps.filter((s) => stepIds.has(s.id)).map((s) => s.id)
      if (matched.length) result.push({ useCaseId: useCase.id, scenarioId: scenario.id, stepIds: matched })
    }
  }
  return stableSortBy(result, (r) => `${r.useCaseId}.${r.scenarioId}`)
}

function scenarioContainingStep(analysis: UseCaseAnalysis | undefined, stepId: string): { useCaseId: string; scenarioId: string } | undefined {
  if (!analysis) return undefined
  for (const useCase of analysis.useCases) {
    for (const scenario of useCase.scenarios) {
      if (scenario.steps.some((s) => s.id === stepId)) return { useCaseId: useCase.id, scenarioId: scenario.id }
    }
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Item builders shared across change kinds
// ---------------------------------------------------------------------------

function moduleTestItems(world: ImpactWorld, moduleIds: Iterable<string>): DesignImpactItem[] {
  const items: DesignImpactItem[] = []
  for (const id of moduleIds) {
    for (const testId of world.moduleTestIds?.[id] ?? []) {
      items.push({ category: 'moduleTest', targetId: testId, reason: `module test for ${id} must be re-run`, invalidation: 'stale' })
    }
    for (const packetId of world.implementationPacketIds?.[id] ?? []) {
      items.push({
        category: 'implementationPacket',
        targetId: packetId,
        reason: `implementation packet for ${id} is no longer valid`,
        invalidation: 'stale',
      })
    }
  }
  return items
}

function bindingItems(world: ImpactWorld, moduleIds: Iterable<string>): DesignImpactItem[] {
  const items: DesignImpactItem[] = []
  for (const id of moduleIds) {
    const design = moduleDesignById(world, id)
    if (design?.typeSpecific.moduleType === 'experience') {
      for (const bindingId of design.typeSpecific.detail.inboundBindingIds) {
        items.push({
          category: 'generatedCode',
          targetId: bindingId,
          reason: `inbound binding for ${id} must be regenerated`,
          invalidation: 'stale',
        })
      }
    }
  }
  return items
}

function scenarioItems(world: ImpactWorld, moduleIds: Iterable<string>): DesignImpactItem[] {
  const items: DesignImpactItem[] = []
  for (const scenario of affectedScenariosForModules(world, moduleIds)) {
    for (const stepId of scenario.stepIds) {
      items.push({
        category: 'scenarioStep',
        targetId: stepId,
        reason: `scenario step affected by the change`,
        invalidation: 'stale',
      })
    }
    const testIds = world.endToEndTestIds?.[scenario.scenarioId] ?? [scenario.scenarioId]
    for (const testId of testIds) {
      items.push({
        category: 'endToEndTest',
        targetId: testId,
        reason: `end-to-end test for scenario ${scenario.scenarioId} must be re-run`,
        invalidation: 'stale',
      })
    }
    for (const run of world.scenarioRuns ?? []) {
      if (run.scenarioId === scenario.scenarioId) {
        items.push({
          category: 'verificationRecord',
          targetId: run.runId,
          reason: `scenario run ${run.runId} must be re-verified`,
          invalidation: 'stale',
        })
      }
    }
  }
  return items
}

function architectureItems(world: ImpactWorld, reason: string): DesignImpactItem[] {
  return architectureDiagramIds(world).map((diagramId) => ({ category: 'diagram', targetId: diagramId, reason, invalidation: 'stale' }))
}

function requireTarget(target: ImpactChangeTarget | undefined, key: keyof ImpactChangeTarget, changeKind: DesignChangeKind): string {
  const value = target?.[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`analyzeDesignChange: changeKind "${changeKind}" requires target.${String(key)}`)
  }
  return value
}

// ---------------------------------------------------------------------------
// §10.3 invalidation matrix — one builder per change kind
// ---------------------------------------------------------------------------

function itemsForLabelOnly(input: AnalyzeDesignChangeInput): DesignImpactItem[] {
  const diagrams = normalizedDiagramRefs(input.world).filter((d) => d.sourceRecordId === input.initiatingRecordId)
  const items: DesignImpactItem[] = diagrams.map((d) => ({
    category: 'diagram',
    targetId: d.diagramId,
    reason: `label-only change to ${input.initiatingRecordId} invalidates its diagram projection`,
    invalidation: 'projectionOnly',
  }))
  items.push({
    category: 'documentation',
    targetId: input.initiatingRecordId,
    reason: 'label-only change invalidates generated text projections',
    invalidation: 'projectionOnly',
  })
  return items
}

function itemsForResponsibilityText(input: AnalyzeDesignChangeInput): DesignImpactItem[] {
  const moduleId = input.target?.moduleId ?? input.initiatingRecordId
  return [
    {
      category: 'module',
      targetId: moduleId,
      reason: 'responsibility text changed with no semantic effect; module needs review',
      invalidation: 'review',
    },
  ]
}

function itemsForOperationBehavior(input: AnalyzeDesignChangeInput, graph: CapabilityGraph): DesignImpactItem[] {
  const operationId = requireTarget(input.target, 'operationId', input.changeKind)
  const items: DesignImpactItem[] = [
    { category: 'operationContract', targetId: operationId, reason: 'operation behavior changed', invalidation: 'stale' },
  ]
  const provider = input.target?.moduleId ?? findOperationProvider(input.world, operationId)
  if (!provider) return items

  const directConsumers = findOperationDirectConsumers(input.world, operationId).filter((id) => id !== provider)
  const seeds = new Set([provider, ...directConsumers])
  const affected = transitiveConsumers(graph, seeds)

  items.push({ category: 'module', targetId: provider, reason: 'provider module of the changed operation', invalidation: 'stale' })
  for (const id of directConsumers) {
    items.push({ category: 'module', targetId: id, reason: 'direct consumer of the changed operation', invalidation: 'stale' })
  }
  for (const id of affected) {
    if (seeds.has(id)) continue
    items.push({ category: 'module', targetId: id, reason: 'transitive consumer via the dependency graph', invalidation: 'stale' })
  }

  items.push(...moduleTestItems(input.world, affected))
  items.push(...bindingItems(input.world, affected))
  items.push(...scenarioItems(input.world, affected))
  return items
}

function itemsForSchema(input: AnalyzeDesignChangeInput, graph: CapabilityGraph): DesignImpactItem[] {
  const schemaId = requireTarget(input.target, 'schemaId', input.changeKind)
  const items: DesignImpactItem[] = [{ category: 'schema', targetId: schemaId, reason: 'input or output schema changed', invalidation: 'stale' }]
  const provider = input.target?.moduleId ?? findSchemaProvider(input.world, schemaId)
  if (!provider) return items

  const directConsumers = findSchemaDirectConsumers(input.world, schemaId).filter((id) => id !== provider)
  const seeds = new Set([provider, ...directConsumers])
  const affected = transitiveConsumers(graph, seeds)

  items.push({ category: 'module', targetId: provider, reason: 'provider of the changed schema', invalidation: 'stale' })
  for (const id of directConsumers) {
    items.push({ category: 'module', targetId: id, reason: 'direct consumer (binding) of the changed schema', invalidation: 'stale' })
  }
  for (const id of affected) {
    if (seeds.has(id)) continue
    items.push({ category: 'module', targetId: id, reason: 'transitive consumer via the dependency graph', invalidation: 'stale' })
  }

  items.push(...moduleTestItems(input.world, affected))
  items.push(...bindingItems(input.world, affected))
  items.push(...scenarioItems(input.world, affected))
  return items
}

/** Dependency changes touch only the source and target modules — deliberately not propagated
 * further, so an unrelated module never becomes stale (§10.3 "shall not mark unrelated modules stale"). */
function itemsForDependency(input: AnalyzeDesignChangeInput): DesignImpactItem[] {
  const source = requireTarget(input.target, 'sourceModuleId', input.changeKind)
  const target = requireTarget(input.target, 'targetModuleId', input.changeKind)
  return [
    { category: 'module', targetId: source, reason: 'dependency change affects the source module', invalidation: 'stale' },
    { category: 'module', targetId: target, reason: 'dependency change affects the target module', invalidation: 'stale' },
    ...architectureItems(input.world, 'architecture path recalculation required by dependency change'),
  ]
}

function itemsForAdapterAllocation(input: AnalyzeDesignChangeInput): DesignImpactItem[] {
  const adapterId = requireTarget(input.target, 'adapterId', input.changeKind)
  const portId = requireTarget(input.target, 'portId', input.changeKind)
  const moduleId = input.target?.moduleId ?? input.initiatingRecordId
  const items: DesignImpactItem[] = [
    { category: 'adapter', targetId: adapterId, reason: 'adapter allocation changed', invalidation: 'stale' },
    { category: 'port', targetId: portId, reason: 'port allocation changed', invalidation: 'stale' },
    { category: 'module', targetId: moduleId, reason: 'connection module allocation changed', invalidation: 'stale' },
    {
      category: 'verificationRecord',
      targetId: `${moduleId}.connect`,
      reason: 'Connect record invalidated by adapter allocation change',
      invalidation: 'stale',
    },
  ]
  const connectionTestIds = input.world.connectionTestIds?.[moduleId] ?? input.world.connectionTestIds?.[adapterId] ?? []
  for (const testId of connectionTestIds) {
    items.push({ category: 'connectionTest', targetId: testId, reason: 'connection test must be re-run', invalidation: 'stale' })
  }
  items.push(...scenarioItems(input.world, [moduleId]))
  return items
}

function itemsForDeployableAllocation(input: AnalyzeDesignChangeInput): DesignImpactItem[] {
  const deployableId = requireTarget(input.target, 'deployableId', input.changeKind)
  const moduleId = input.target?.moduleId ?? input.initiatingRecordId
  return [
    { category: 'deployable', targetId: deployableId, reason: 'deployable allocation changed: foundation and composition affected', invalidation: 'stale' },
    { category: 'module', targetId: moduleId, reason: 'module moved to another deployable: commands and health checks affected', invalidation: 'stale' },
    {
      category: 'verificationRecord',
      targetId: `${moduleId}.connectionEvidence`,
      reason: 'connection evidence invalidated by deployable allocation change',
      invalidation: 'stale',
    },
  ]
}

function itemsForModuleSplitOrMerge(input: AnalyzeDesignChangeInput, graph: CapabilityGraph): DesignImpactItem[] {
  const moduleIds = input.target?.splitOrMergeModuleIds ?? []
  if (moduleIds.length === 0) {
    throw new Error(`analyzeDesignChange: changeKind "moduleSplitOrMerge" requires target.splitOrMergeModuleIds`)
  }
  const items: DesignImpactItem[] = [...architectureItems(input.world, 'architecture changed by module split or merge')]

  for (const id of moduleIds) {
    items.push({
      category: 'module',
      targetId: id,
      reason: 'module split or merge affects this module design, ownership, and paths',
      invalidation: 'stale',
    })
    items.push({
      category: 'migration',
      targetId: id,
      reason: 'migration work required to move ownership and content between modules',
      invalidation: 'review',
    })
    const design = moduleDesignById(input.world, id)
    for (const op of design?.providedOperations ?? []) {
      items.push({
        category: 'operationContract',
        targetId: op.operationId,
        reason: `operation contract ownership affected by split/merge of ${id}`,
        invalidation: 'stale',
      })
    }
    for (const path of design?.boundary.ownedPaths ?? []) {
      items.push({ category: 'sourceOverlay', targetId: path, reason: `owned path ownership changed by split/merge of ${id}`, invalidation: 'stale' })
    }
  }

  const seeds = new Set(moduleIds)
  const affected = transitiveConsumers(graph, seeds)
  for (const id of affected) {
    if (seeds.has(id)) continue
    items.push({ category: 'module', targetId: id, reason: 'consumer of a split or merged module; interfaces may change', invalidation: 'review' })
  }
  items.push(...moduleTestItems(input.world, new Set([...seeds, ...affected])))
  return items
}

function itemsForUseCaseStep(input: AnalyzeDesignChangeInput): DesignImpactItem[] {
  const stepId = requireTarget(input.target, 'stepId', input.changeKind)
  const useCaseId = input.target?.useCaseId ?? input.initiatingRecordId
  const performingModules = input.world.moduleDesigns.filter((m) => m.trace.scenarioStepIds.includes(stepId)).map((m) => m.module.moduleId)

  const items: DesignImpactItem[] = [
    { category: 'useCase', targetId: useCaseId, reason: 'use-case step changed', invalidation: 'stale' },
    { category: 'scenarioStep', targetId: stepId, reason: 'use-case step content changed', invalidation: 'stale' },
    ...architectureItems(input.world, 'architecture path affected by use-case step change'),
  ]
  for (const id of performingModules) {
    items.push({ category: 'module', targetId: id, reason: 'module performs the changed use-case step', invalidation: 'stale' })
  }

  const scenarioRef = input.target?.scenarioId
    ? { useCaseId, scenarioId: input.target.scenarioId }
    : scenarioContainingStep(input.world.useCaseAnalysis, stepId)
  if (scenarioRef) {
    const testIds = input.world.endToEndTestIds?.[scenarioRef.scenarioId] ?? [scenarioRef.scenarioId]
    for (const testId of testIds) {
      items.push({ category: 'endToEndTest', targetId: testId, reason: 'scenario test regeneration required', invalidation: 'stale' })
    }
  }
  return items
}

function itemsForScreenshotExpectation(input: AnalyzeDesignChangeInput): DesignImpactItem[] {
  const stepId = requireTarget(input.target, 'stepId', input.changeKind)
  const items: DesignImpactItem[] = [
    { category: 'screenshotExpectation', targetId: stepId, reason: 'screenshot expectation changed', invalidation: 'stale' },
  ]
  const scenarioRef = input.target?.scenarioId
    ? { scenarioId: input.target.scenarioId }
    : scenarioContainingStep(input.world.useCaseAnalysis, stepId)
  if (scenarioRef) {
    const testIds = input.world.endToEndTestIds?.[scenarioRef.scenarioId] ?? [scenarioRef.scenarioId]
    for (const testId of testIds) {
      items.push({
        category: 'endToEndTest',
        targetId: testId,
        reason: 'scenario test and Verify evidence policy must be updated',
        invalidation: 'stale',
      })
    }
  }
  return items
}

// Change kinds present on `DesignChangeKind` beyond the ten rows in §10.3.
// Handled conservatively by mapping to the closest matching rule so the
// engine is total over the shared `DesignChangeKind` type; not required by
// the EUC-07 acceptance criteria.

function itemsForModuleType(input: AnalyzeDesignChangeInput, graph: CapabilityGraph): DesignImpactItem[] {
  const moduleId = input.target?.moduleId ?? input.initiatingRecordId
  const items: DesignImpactItem[] = [
    { category: 'module', targetId: moduleId, reason: 'module type changed; type-specific fields require review', invalidation: 'stale' },
    ...architectureItems(input.world, 'architecture diagram reflects the module type'),
  ]
  const consumers = [...transitiveConsumers(graph, new Set([moduleId]))].filter((id) => id !== moduleId)
  for (const id of consumers) {
    items.push({ category: 'module', targetId: id, reason: 'consumer of a module whose type changed', invalidation: 'review' })
  }
  return items
}

function itemsForOwnedPath(input: AnalyzeDesignChangeInput): DesignImpactItem[] {
  const moduleId = input.target?.moduleId ?? input.initiatingRecordId
  const items: DesignImpactItem[] = [{ category: 'module', targetId: moduleId, reason: 'owned path changed', invalidation: 'stale' }]
  if (input.target?.ownedPath) {
    items.push({ category: 'sourceOverlay', targetId: input.target.ownedPath, reason: 'owned path ownership changed', invalidation: 'stale' })
  }
  return items
}

function itemsForRuntimeAllocation(input: AnalyzeDesignChangeInput): DesignImpactItem[] {
  const moduleId = input.target?.moduleId ?? input.initiatingRecordId
  const design = moduleDesignById(input.world, moduleId)
  const items: DesignImpactItem[] = [{ category: 'module', targetId: moduleId, reason: 'runtime allocation changed', invalidation: 'stale' }]
  if (design) {
    items.push({
      category: 'deployable',
      targetId: design.boundary.deployableId,
      reason: 'runtime allocation change affects deployable composition',
      invalidation: 'stale',
    })
  }
  return items
}

function itemsForPortChange(input: AnalyzeDesignChangeInput): DesignImpactItem[] {
  const portId = requireTarget(input.target, 'portId', input.changeKind)
  const moduleId = input.target?.moduleId ?? input.initiatingRecordId
  const items: DesignImpactItem[] = [
    { category: 'port', targetId: portId, reason: 'port added or removed', invalidation: 'stale' },
    { category: 'module', targetId: moduleId, reason: 'module port set changed', invalidation: 'stale' },
  ]
  for (const testId of input.world.connectionTestIds?.[moduleId] ?? []) {
    items.push({ category: 'connectionTest', targetId: testId, reason: 'connection test must be re-run', invalidation: 'stale' })
  }
  return items
}

// ---------------------------------------------------------------------------
// Merge, order, and assemble
// ---------------------------------------------------------------------------

const INVALIDATION_SEVERITY: Record<DesignImpactItem['invalidation'], number> = {
  none: 0,
  projectionOnly: 1,
  review: 2,
  stale: 3,
  blocked: 4,
}

function mergeAndSortItems(items: DesignImpactItem[]): DesignImpactItem[] {
  const byKey = new Map<string, DesignImpactItem>()
  for (const item of items) {
    const key = `${item.category}:${item.targetId}`
    const existing = byKey.get(key)
    if (!existing || INVALIDATION_SEVERITY[item.invalidation] > INVALIDATION_SEVERITY[existing.invalidation]) {
      byKey.set(key, item)
    }
  }
  return [...byKey.values()].sort(
    (a, b) => a.category.localeCompare(b.category) || a.targetId.localeCompare(b.targetId) || a.reason.localeCompare(b.reason),
  )
}

/** §10.4 — ordered required-change plan: modules first, in dependency order, then other required items. */
function buildOrderedChangePlan(graph: CapabilityGraph, items: DesignImpactItem[]): DesignImpactRecord['orderedChangePlan'] {
  const required = items.filter((i) => i.invalidation === 'stale' || i.invalidation === 'blocked')
  const moduleIds = [...new Set(required.filter((i) => i.category === 'module').map((i) => i.targetId))]
  const orderedModuleIds = topologicalModuleOrder(graph, moduleIds)
  const reasonByModuleId = new Map(required.filter((i) => i.category === 'module').map((i) => [i.targetId, i.reason]))

  const plan: DesignImpactRecord['orderedChangePlan'] = []
  let order = 1
  for (const moduleId of orderedModuleIds) {
    plan.push({ order: order++, targetId: moduleId, description: reasonByModuleId.get(moduleId) ?? 'apply required module change' })
  }

  const others = required
    .filter((i) => i.category !== 'module')
    .sort((a, b) => a.category.localeCompare(b.category) || a.targetId.localeCompare(b.targetId))
  const seen = new Set<string>()
  for (const item of others) {
    const key = `${item.category}:${item.targetId}`
    if (seen.has(key)) continue
    seen.add(key)
    plan.push({ order: order++, targetId: item.targetId, description: item.reason })
  }
  return plan
}

/**
 * Builds a `DesignImpactRecord` for one proposed design change (§10.2, §10.3,
 * §10.4). Pure and deterministic: the same input always produces the same
 * output (`impactId` and `createdAt` default to deterministic values derived
 * from the input rather than the clock, but a caller may supply either).
 */
export function analyzeDesignChange(input: AnalyzeDesignChangeInput): DesignImpactRecord {
  const graph = buildCapabilityGraph(input.world.architecture)

  let items: DesignImpactItem[]
  switch (input.changeKind) {
    case 'labelOnly':
    case 'rename':
      items = itemsForLabelOnly(input)
      break
    case 'responsibilityText':
    case 'purpose':
      items = itemsForResponsibilityText(input)
      break
    case 'operationBehavior':
    case 'contract':
      items = itemsForOperationBehavior(input, graph)
      break
    case 'schema':
      items = itemsForSchema(input, graph)
      break
    case 'dependency':
      items = itemsForDependency(input)
      break
    case 'adapterAllocation':
      items = itemsForAdapterAllocation(input)
      break
    case 'deployableAllocation':
      items = itemsForDeployableAllocation(input)
      break
    case 'moduleSplitOrMerge':
      items = itemsForModuleSplitOrMerge(input, graph)
      break
    case 'useCaseStep':
      items = itemsForUseCaseStep(input)
      break
    case 'screenshotExpectation':
      items = itemsForScreenshotExpectation(input)
      break
    case 'moduleType':
      items = itemsForModuleType(input, graph)
      break
    case 'ownedPath':
      items = itemsForOwnedPath(input)
      break
    case 'runtimeAllocation':
      items = itemsForRuntimeAllocation(input)
      break
    case 'portChange':
      items = itemsForPortChange(input)
      break
    default: {
      const exhaustive: never = input.changeKind
      throw new Error(`analyzeDesignChange: unsupported change kind ${String(exhaustive)}`)
    }
  }

  const mergedItems = mergeAndSortItems(items)
  const orderedChangePlan = buildOrderedChangePlan(graph, mergedItems)
  const impactId = input.impactId ?? childId(input.projectId, 'impact', `${input.initiatingRecordId}.${input.initiatingRevision}.${input.changeKind}`)
  const createdAt = input.createdAt ?? new Date(0).toISOString()

  const record: DesignImpactRecord = {
    schemaVersion: '1.0',
    impactId,
    projectId: input.projectId,
    initiatingRecordId: input.initiatingRecordId,
    initiatingRevision: input.initiatingRevision,
    changeKind: input.changeKind,
    description: input.description,
    items: mergedItems,
    orderedChangePlan,
    createdAt,
    contentHash: '',
  }
  return { ...record, contentHash: designContentHash(record) }
}

// ---------------------------------------------------------------------------
// Persistence helper (§10 — used later to transition records to stale/review)
// ---------------------------------------------------------------------------

export type ApplyImpactResult = {
  /** Record ids whose highest-severity matching impact item is `stale`. */
  staleRecordIds: string[]
  /** Record ids whose highest-severity matching impact item is `review` (and not also `stale`). */
  reviewRecordIds: string[]
}

/**
 * Pure helper: given a calculated impact and the set of records it may
 * affect, returns which record ids must transition to `stale` versus which
 * only need review. Only ids present in `records` and referenced by an
 * impact item are returned; unrelated records are never included.
 */
export function applyImpactToRecords(impact: DesignImpactRecord, records: { id: string }[]): ApplyImpactResult {
  const knownIds = new Set(records.map((r) => r.id))
  const stale = new Set<string>()
  const review = new Set<string>()
  for (const item of impact.items) {
    if (!knownIds.has(item.targetId)) continue
    if (item.invalidation === 'stale' || item.invalidation === 'blocked') stale.add(item.targetId)
    else if (item.invalidation === 'review') review.add(item.targetId)
  }
  for (const id of stale) review.delete(id)
  return {
    staleRecordIds: [...stale].sort((a, b) => a.localeCompare(b)),
    reviewRecordIds: [...review].sort((a, b) => a.localeCompare(b)),
  }
}
