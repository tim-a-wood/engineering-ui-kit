/**
 * CAP-TEST-040 — Offline MVP journeys CAP-JRN-001–008 (CAP-PKT-032).
 * Packaged Electron path is covered separately by apps/desktop/e2e/capabilities-journeys.mjs
 * (core offline mode there; packaged UI status recorded in evidence).
 */
import { describe, expect, it } from 'vitest'
import { runAllOfflineJourneys } from '../../src/capabilities/journeys.js'

describe('CAP-TEST-040 offline journeys CAP-JRN-001 through CAP-JRN-008', () => {
  it('completes all eight journeys with restart and deferred features absent', () => {
    const { results, restartOk, deferredAbsent } = runAllOfflineJourneys()
    const byId = Object.fromEntries(results.map((r) => [r.journeyId, r]))

    for (const id of [
      'CAP-JRN-001',
      'CAP-JRN-002',
      'CAP-JRN-003',
      'CAP-JRN-004',
      'CAP-JRN-005',
      'CAP-JRN-006',
      'CAP-JRN-007',
      'CAP-JRN-008',
    ]) {
      expect(byId[id]?.passed, `${id} evidence=${JSON.stringify(byId[id]?.evidence)}`).toBe(true)
    }

    expect(restartOk).toBe(true)
    expect(deferredAbsent).toBe(true)

    expect(byId['CAP-JRN-001']!.evidence.revision).toBe('1')
    expect(byId['CAP-JRN-002']!.evidence.gatePassed).toBe(true)
    expect(byId['CAP-JRN-003']!.evidence.freshness).toBe('ready')
    expect(byId['CAP-JRN-004']!.evidence.nextActionable).toBe('mod.domain')
    expect(byId['CAP-JRN-005']!.evidence.escapeBlocked).toBe(true)
    expect(byId['CAP-JRN-006']!.evidence.reused).toBe(true)
    expect(byId['CAP-JRN-007']!.evidence.bindingId).toBe('bind-approve')
    expect(byId['CAP-JRN-008']!.evidence.approvedUnchanged).toBe(true)
  })
})
