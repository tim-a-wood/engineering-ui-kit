/**
 * CAP-TEST-018 — branched dependency graph and proposed contract changes.
 * Calculating impact yields affected AND unaffected modules that each carry a reason, and the
 * freshly calculated record is a proposal only: no approval is baked in, so no delta packet
 * exists before the user approves.
 */

import { describe, expect, it } from 'vitest'
import { calculateImpact } from '../../src/capabilities/impact.js'
import type { CapabilityGraph } from '../../src/capabilities/graph.js'
import type { ModuleManifest } from '../../src/capabilities/types.js'

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

// A branched graph: workflow and experience transitively depend on domain.a → platform;
// domain.b and domain.c sit on separate branches with no path to the changed module.
const manifests: ModuleManifest[] = [
  manifest('mod.platform', 'platform'),
  manifest('mod.domain.a', 'domain'),
  manifest('mod.domain.b', 'domain'),
  manifest('mod.domain.c', 'domain'),
  manifest('mod.workflow', 'workflow'),
  manifest('mod.experience', 'experience'),
]

// edge { from: consumer, to: provider } — "from depends on to".
const graph: CapabilityGraph = {
  nodes: manifests.map((m) => ({ id: m.moduleId, moduleType: m.moduleType })),
  edges: [
    { from: 'mod.domain.a', to: 'mod.platform', reason: 'uses platform' },
    { from: 'mod.domain.b', to: 'mod.platform', reason: 'uses platform' },
    { from: 'mod.workflow', to: 'mod.domain.a', reason: 'orchestrates domain.a' },
    { from: 'mod.experience', to: 'mod.workflow', reason: 'renders workflow' },
    // mod.domain.c intentionally isolated (no dependency path to domain.a).
  ],
}

describe('CAP-TEST-018 branched impact before approval', () => {
  const impact = calculateImpact({
    changeId: 'chg-1',
    initiatingRecordId: 'mod.domain.a',
    initiatingRevision: '2.0.0',
    classification: 'required-additive',
    graph,
    manifests,
    changedModuleIds: ['mod.domain.a'],
  })

  it('marks every dependent as affected with a reason', () => {
    const byId = new Map(impact.affectedModules.map((m) => [m.moduleId, m.reason]))
    expect([...byId.keys()].sort()).toEqual(['mod.domain.a', 'mod.experience', 'mod.workflow'])
    expect(byId.get('mod.domain.a')).toBe('initiating-change')
    expect(byId.get('mod.workflow')).toBe('depends-on-affected-provider')
    expect(byId.get('mod.experience')).toBe('depends-on-affected-provider')
    // No affected module is left without an explanation.
    expect(impact.affectedModules.every((m) => m.reason.length > 0)).toBe(true)
  })

  it('marks unrelated branches as unaffected with a reason', () => {
    const byId = new Map(impact.unaffectedModules.map((m) => [m.moduleId, m.reason]))
    expect([...byId.keys()].sort()).toEqual(['mod.domain.b', 'mod.domain.c', 'mod.platform'])
    expect(impact.unaffectedModules.every((m) => m.reason === 'no-dependency-path')).toBe(true)
  })

  it('is a proposal only — no packet/approval exists before the user approves', () => {
    expect(impact.userApproval).toBeUndefined()
    // The proposed order lists only affected modules; nothing is exportable yet.
    expect(impact.proposedPacketOrder).toEqual(['mod.domain.a', 'mod.workflow', 'mod.experience'])
    expect(impact.proposedPacketOrder).not.toContain('mod.platform')
  })
})
