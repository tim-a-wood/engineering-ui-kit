/**
 * Impact analysis and regeneration ordering (CAP-PKT-016).
 */

import type { ImpactClassification, ImpactRecord, ModuleManifest } from './types.js'
import type { CapabilityGraph } from './graph.js'

const TYPE_ORDER: Record<string, number> = {
  platform: 0,
  domain: 1,
  connection: 2,
  workflow: 3,
  experience: 4,
}

export function classifyImpact(change: {
  contractChanged: boolean
  additiveOnly: boolean
  breaking: boolean
  implementationOnly: boolean
}): ImpactClassification {
  if (change.breaking) return 'breaking'
  if (change.contractChanged && !change.additiveOnly) return 'required-additive'
  if (change.contractChanged && change.additiveOnly) return 'optional-additive'
  return 'implementation-only'
}

export function calculateImpact(input: {
  changeId: string
  initiatingRecordId: string
  initiatingRevision: string
  classification: ImpactClassification
  graph: CapabilityGraph
  manifests: ModuleManifest[]
  changedModuleIds: string[]
}): ImpactRecord {
  const byId = new Map(input.manifests.map((m) => [m.moduleId, m]))
  const affected = new Set<string>(input.changedModuleIds)
  let grew = true
  while (grew) {
    grew = false
    for (const edge of input.graph.edges) {
      if (affected.has(edge.to) && !affected.has(edge.from)) {
        affected.add(edge.from)
        grew = true
      }
    }
  }

  const affectedModules = [...affected]
    .sort((a, b) => a.localeCompare(b))
    .map((moduleId) => ({
      moduleId,
      reason: input.changedModuleIds.includes(moduleId)
        ? 'initiating-change'
        : 'depends-on-affected-provider',
    }))

  const unaffectedModules = input.graph.nodes
    .map((n) => n.id)
    .filter((id) => !affected.has(id))
    .sort((a, b) => a.localeCompare(b))
    .map((moduleId) => ({ moduleId, reason: 'no-dependency-path' }))

  const proposedPacketOrder = [...affected].sort((a, b) => {
    const ta = TYPE_ORDER[byId.get(a)?.moduleType ?? 'domain'] ?? 99
    const tb = TYPE_ORDER[byId.get(b)?.moduleType ?? 'domain'] ?? 99
    if (ta !== tb) return ta - tb
    return a.localeCompare(b)
  })

  return {
    schemaVersion: '1.0',
    changeId: input.changeId,
    initiatingRecordId: input.initiatingRecordId,
    initiatingRevision: input.initiatingRevision,
    classification: input.classification,
    affectedModules,
    unaffectedModules,
    proposedPacketOrder,
    recalculationEvidence: [`nodes:${input.graph.nodes.length}`, `edges:${input.graph.edges.length}`],
  }
}

export function nextActionableTarget(impact: ImpactRecord, completed: Set<string>): string | undefined {
  return impact.proposedPacketOrder.find((id) => !completed.has(id))
}

export type DeltaQueueState = {
  changeId: string
  order: string[]
  completedTargets: string[]
  nextTarget?: string
  /** Targets that must not be exported yet because an earlier target is incomplete. */
  blockedTargets: string[]
  done: boolean
}

/**
 * Deterministic queue state over an approved impact's ordering and its completed targets.
 * Only `nextTarget` is actionable; everything after it is blocked (CAP-PKT-016).
 */
export function deltaQueueState(impact: ImpactRecord, completed: Iterable<string>): DeltaQueueState {
  const completedSet = new Set(completed)
  const order = impact.proposedPacketOrder
  const nextTarget = order.find((id) => !completedSet.has(id))
  const nextIndex = nextTarget ? order.indexOf(nextTarget) : order.length
  const blockedTargets = order.filter((id, i) => i > nextIndex && !completedSet.has(id))
  return {
    changeId: impact.changeId,
    order,
    completedTargets: order.filter((id) => completedSet.has(id)),
    nextTarget,
    blockedTargets,
    done: nextTarget === undefined,
  }
}

/**
 * Guard: throws unless `targetId` is exactly the next actionable target for this impact.
 * Prevents later targets from exporting before earlier targets complete.
 */
export function assertTargetExportable(impact: ImpactRecord, completed: Iterable<string>, targetId: string): void {
  const state = deltaQueueState(impact, completed)
  if (!state.order.includes(targetId)) {
    throw new Error(`target ${targetId} is not part of impact ${impact.changeId}`)
  }
  if (state.done) {
    throw new Error(`impact ${impact.changeId} queue is already exhausted`)
  }
  if (targetId !== state.nextTarget) {
    throw new Error(
      `target ${targetId} is blocked; the next actionable target is ${state.nextTarget}`,
    )
  }
}
