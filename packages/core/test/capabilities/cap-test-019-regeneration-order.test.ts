/**
 * CAP-TEST-019 — approved multi-level impact record: build regeneration order and request
 * packets repeatedly. Provider precedes workflow precedes experience; exactly one target is
 * actionable at a time; the delta scope stays local (unaffected modules never enter the queue).
 */

import { describe, expect, it } from 'vitest'
import { calculateImpact, deltaQueueState, nextActionableTarget } from '../../src/capabilities/impact.js'
import type { CapabilityGraph } from '../../src/capabilities/graph.js'
import type { ImpactRecord, ModuleManifest } from '../../src/capabilities/types.js'

function manifest(moduleId: string, moduleType: ModuleManifest['moduleType']): ModuleManifest {
  return {
    schemaVersion: '1.0',
    architectureVersion: '1.0',
    moduleId,
    moduleVersion: '1.0.0',
    moduleType,
    name: moduleId,
    responsibility: moduleId,
    ownedConcerns: [],
    excludedConcerns: [],
    providedOperations: [],
    requiredOperations: [],
    verificationSuiteIds: [],
    runtimeAllocation: 'local-embedded',
    events: [],
    ownedPaths: [],
  }
}

const manifests: ModuleManifest[] = [
  manifest('mod.platform', 'platform'),
  manifest('mod.domain', 'domain'),
  manifest('mod.workflow', 'workflow'),
  manifest('mod.experience', 'experience'),
  manifest('mod.untouched', 'domain'),
]

const graph: CapabilityGraph = {
  nodes: manifests.map((m) => ({ id: m.moduleId, moduleType: m.moduleType })),
  edges: [
    { from: 'mod.domain', to: 'mod.platform', reason: 'uses platform' },
    { from: 'mod.workflow', to: 'mod.domain', reason: 'orchestrates domain' },
    { from: 'mod.experience', to: 'mod.workflow', reason: 'renders workflow' },
  ],
}

function approved(): ImpactRecord {
  const impact = calculateImpact({
    changeId: 'chg-platform',
    initiatingRecordId: 'mod.platform',
    initiatingRevision: '3.0.0',
    classification: 'breaking',
    graph,
    manifests,
    changedModuleIds: ['mod.platform'],
  })
  return { ...impact, userApproval: { approved: true } }
}

describe('CAP-TEST-019 approved multi-level regeneration order', () => {
  it('orders providers before workflow before experience', () => {
    const order = approved().proposedPacketOrder
    expect(order).toEqual(['mod.platform', 'mod.domain', 'mod.workflow', 'mod.experience'])
    expect(order.indexOf('mod.platform')).toBeLessThan(order.indexOf('mod.workflow'))
    expect(order.indexOf('mod.domain')).toBeLessThan(order.indexOf('mod.workflow'))
    expect(order.indexOf('mod.workflow')).toBeLessThan(order.indexOf('mod.experience'))
  })

  it('exposes exactly one actionable target and advances deterministically when re-requested', () => {
    const impact = approved()
    // "Request packets repeatedly": the queue state is a pure function of completed targets.
    expect(deltaQueueState(impact, []).nextTarget).toBe('mod.platform')
    expect(deltaQueueState(impact, []).nextTarget).toBe('mod.platform')
    expect(nextActionableTarget(impact, new Set())).toBe('mod.platform')

    const afterFirst = deltaQueueState(impact, ['mod.platform'])
    expect(afterFirst.nextTarget).toBe('mod.domain')
    expect(afterFirst.blockedTargets).toEqual(['mod.workflow', 'mod.experience'])

    const done = deltaQueueState(impact, impact.proposedPacketOrder)
    expect(done.done).toBe(true)
    expect(done.nextTarget).toBeUndefined()
  })

  it('keeps delta scope local — unaffected modules never enter the queue', () => {
    const impact = approved()
    expect(impact.proposedPacketOrder).not.toContain('mod.untouched')
    expect(deltaQueueState(impact, []).order).not.toContain('mod.untouched')
    expect(impact.unaffectedModules.map((m) => m.moduleId)).toEqual(['mod.untouched'])
  })
})
