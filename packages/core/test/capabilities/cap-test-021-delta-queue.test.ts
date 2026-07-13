/**
 * CAP-TEST-021 — delta queue ordering, single-actionable-target, and export guard (CAP-PKT-016).
 */

import { describe, expect, it } from 'vitest'
import {
  assertTargetExportable,
  deltaQueueState,
} from '../../src/capabilities/impact.js'
import type { ImpactRecord } from '../../src/capabilities/types.js'

function impact(order: string[]): ImpactRecord {
  return {
    schemaVersion: '1.0',
    changeId: 'impact-1',
    initiatingRecordId: 'mod.platform',
    initiatingRevision: '1.0.0',
    classification: 'required-additive',
    affectedModules: order.map((moduleId) => ({ moduleId, reason: 'depends-on-affected-provider' })),
    unaffectedModules: [{ moduleId: 'mod.untouched', reason: 'no-dependency-path' }],
    proposedPacketOrder: order,
    userApproval: { approved: true },
    recalculationEvidence: [],
  }
}

describe('CAP-TEST-021 delta queue', () => {
  const order = ['mod.platform', 'mod.domain', 'mod.experience']

  it('exposes exactly one actionable target and blocks the rest', () => {
    const state = deltaQueueState(impact(order), [])
    expect(state.nextTarget).toBe('mod.platform')
    expect(state.blockedTargets).toEqual(['mod.domain', 'mod.experience'])
    expect(state.done).toBe(false)
  })

  it('advances deterministically as targets complete', () => {
    let state = deltaQueueState(impact(order), ['mod.platform'])
    expect(state.nextTarget).toBe('mod.domain')
    expect(state.blockedTargets).toEqual(['mod.experience'])

    state = deltaQueueState(impact(order), ['mod.platform', 'mod.domain'])
    expect(state.nextTarget).toBe('mod.experience')
    expect(state.blockedTargets).toEqual([])

    state = deltaQueueState(impact(order), order)
    expect(state.nextTarget).toBeUndefined()
    expect(state.done).toBe(true)
  })

  it('allows exporting only the next actionable target', () => {
    expect(() => assertTargetExportable(impact(order), [], 'mod.platform')).not.toThrow()
    expect(() => assertTargetExportable(impact(order), [], 'mod.domain')).toThrow(/blocked/)
    expect(() => assertTargetExportable(impact(order), [], 'mod.unknown')).toThrow(/not part of/)
    expect(() => assertTargetExportable(impact(order), order, 'mod.platform')).toThrow(/exhausted/)
  })
})
