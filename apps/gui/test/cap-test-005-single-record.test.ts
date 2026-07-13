/**
 * CAP-TEST-005 — one canonical record set across Guided/Design.
 * Projection is pure renderer view state; it must not create a duplicate persisted record,
 * and a reload must return the same IDs/revisions regardless of the mode the user was in.
 */

import { describe, expect, it } from 'vitest'
import { installMockBridge } from '../src/mockBridge'

const draft = {
  schemaVersion: '1.0' as const,
  id: 'app.demo',
  revision: '3',
  name: 'Demo application',
  purpose: 'demo',
  outcomes: [],
  userRoles: [],
  domainTerms: [],
  constraints: [],
  successMeasures: [],
}

describe('CAP-TEST-005 single canonical record set', () => {
  it('returns the same record on reload with no projection duplication', async () => {
    const bridge = installMockBridge()
    await bridge.capabilitiesEnsureInitialized('p1')
    await bridge.capabilitiesSaveApplicationDraft('p1', draft)

    // "Reload" — a fresh read after the write (as a section switch / remount would do).
    const first = await bridge.capabilitiesGetApplication('p1')
    const second = await bridge.capabilitiesGetApplication('p1')

    const firstDraft = first.draft as { id: string; revision: string }
    const secondDraft = second.draft as { id: string; revision: string }
    expect(firstDraft.id).toBe('app.demo')
    expect(firstDraft.revision).toBe('3')
    // Guided and Design read the identical persisted record — same IDs/revisions, no divergence.
    expect(secondDraft).toEqual(firstDraft)
    // No separate "projection" record slot exists on the persisted shape.
    expect(Object.keys(first).sort()).toEqual(['approved', 'draft'])
  })

  it('keeps an approved revision stable when a later draft is saved', async () => {
    const bridge = installMockBridge()
    await bridge.capabilitiesEnsureInitialized('p1')
    await bridge.capabilitiesApproveApplication('p1', draft)
    const approvedBefore = (await bridge.capabilitiesGetApplication('p1')).approved as { revision: string }

    await bridge.capabilitiesSaveApplicationDraft('p1', { ...draft, revision: '4' })
    const after = await bridge.capabilitiesGetApplication('p1')
    expect((after.approved as { revision: string }).revision).toBe(approvedBefore.revision)
    expect((after.draft as { revision: string }).revision).toBe('4')
  })
})
