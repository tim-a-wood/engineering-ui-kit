// Focused overlay-store tests: finding-12 closure workflow with enforced
// reverification evidence + independence, immutable history, and reset.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findings } from '../fixtures.ts'
import {
  checkTransition,
  findingWithOverlay,
  initialOverlay,
  overlayReducer,
  REVERIFICATION_EVIDENCE,
  type OverlayState,
} from '../store.ts'

const seed12 = findings.find((f) => f.id === 'FND-012')
if (!seed12) throw new Error('FND-012 seed missing')

const AT = '2026-07-22T10:00Z'

test('closure is blocked without reverification evidence', () => {
  const check = checkTransition(seed12, 'reverified', initialOverlay, { independentCloser: 'E. Sorensen' })
  assert.equal(check.ok, false)
  assert.match(check.reason ?? '', /evidence/i)
})

test('closure is blocked without an independent verifier', () => {
  let s: OverlayState = overlayReducer(initialOverlay, {
    type: 'finding/attach-evidence',
    findingId: 'FND-012',
    evidence: REVERIFICATION_EVIDENCE,
    actor: 'tester',
    at: AT,
  })
  const noVerifier = checkTransition(seed12, 'reverified', s, {})
  assert.equal(noVerifier.ok, false)
  const ownerAsVerifier = checkTransition(seed12, 'reverified', s, { independentCloser: seed12.owner })
  assert.equal(ownerAsVerifier.ok, false)
  s = overlayReducer(s, {
    type: 'finding/transition',
    findingId: 'FND-012',
    to: 'reverified',
    actor: seed12.owner,
    at: AT,
    independentCloser: seed12.owner,
    seedFinding: seed12,
  })
  assert.equal(findingWithOverlay(seed12, s).status, 'ready-for-closure', 'invalid transition must not apply')
})

test('finding 12 closes through reverified → closed with appended history', () => {
  let s: OverlayState = overlayReducer(initialOverlay, {
    type: 'finding/attach-evidence',
    findingId: 'FND-012',
    evidence: REVERIFICATION_EVIDENCE,
    actor: 'tester',
    at: AT,
  })
  s = overlayReducer(s, {
    type: 'finding/transition',
    findingId: 'FND-012',
    to: 'reverified',
    actor: 'E. Sorensen',
    at: AT,
    independentCloser: 'E. Sorensen',
    seedFinding: seed12,
  })
  assert.equal(findingWithOverlay(seed12, s).status, 'reverified')
  s = overlayReducer(s, {
    type: 'finding/transition',
    findingId: 'FND-012',
    to: 'closed',
    actor: 'E. Sorensen',
    at: AT,
    seedFinding: seed12,
  })
  const merged = findingWithOverlay(seed12, s)
  assert.equal(merged.status, 'closed')
  // Immutable seeded history is preserved and extended, never rewritten.
  assert.deepEqual(merged.history.slice(0, seed12.history.length), seed12.history)
  assert.ok(merged.history.length > seed12.history.length)
  // Closed findings accept no further transitions.
  const reopen = checkTransition(merged, 'open', s)
  assert.equal(reopen.ok, false)
  // Activity log recorded the transitions.
  assert.ok(s.activity.some((e) => e.kind === 'finding-transition'))
})

test('skipping lifecycle steps is rejected', () => {
  const check = checkTransition(seed12, 'closed', initialOverlay)
  assert.equal(check.ok, false)
})

test('reset restores seeded finding state and logs restored counts', () => {
  let s: OverlayState = overlayReducer(initialOverlay, {
    type: 'finding/attach-evidence',
    findingId: 'FND-012',
    evidence: REVERIFICATION_EVIDENCE,
    actor: 'tester',
    at: AT,
  })
  s = overlayReducer(s, { type: 'reset', at: AT })
  assert.deepEqual(s.findingOverlays, {})
  assert.equal(s.packages.length, 0)
  assert.equal(s.recordedReviews.length, 0)
  assert.equal(s.prefs.baseline, '2.4.0')
  assert.match(s.activity[0]?.message ?? '', /12 findings/)
})

test('review recording and baseline changes append activity events', () => {
  let s: OverlayState = overlayReducer(initialOverlay, {
    type: 'review/record',
    at: AT,
    review: {
      subjectId: 'SWR-LLR-LAT-044',
      phase: 'requirements',
      reviewer: 'A. Chen',
      method: 'inspection',
      result: 'passed',
      comments: 'ok',
      date: '2026-07-22',
      revision: 'Rev 6',
      independent: true,
    },
  })
  assert.equal(s.recordedReviews.length, 1)
  s = overlayReducer(s, { type: 'baseline/set', baseline: '2.3.0', at: AT })
  assert.equal(s.prefs.baseline, '2.3.0')
  assert.ok(s.activity.some((e) => e.kind === 'baseline-changed'))
})
