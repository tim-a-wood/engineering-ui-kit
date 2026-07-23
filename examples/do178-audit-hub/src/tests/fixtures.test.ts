// Focused fixture integrity tests (run with `npm run test` — node --test,
// native type stripping; no test-framework dependency added).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  allEvidence,
  baselines,
  canonicalChain,
  changeRecords,
  compareBaselines,
  evidenceById,
  findings,
  reviewRecords,
  searchEvidence,
  traceFrom,
} from '../fixtures.ts'
import { derivedRequirements, hlrRequirements, llrRequirements, sysRequirements } from '../fixtures.ts'
import { dictionaryRecords, elementRecords, modelRecords } from '../fixtures.ts'
import { functionRecords, sourceFileRecords } from '../fixtures.ts'
import { resultSetRecords, testRecords, TOTAL_ITERATIONS } from '../fixtures.ts'
import { planningRecords } from '../fixtures.ts'

test('sample scale matches the specification', () => {
  assert.equal(planningRecords.length, 10)
  assert.equal(sysRequirements.length, 18)
  assert.equal(hlrRequirements.length, 36)
  assert.equal(llrRequirements.length, 54)
  assert.equal(derivedRequirements.length, 6)
  assert.equal(modelRecords.length, 7)
  assert.equal(dictionaryRecords.length, 2)
  assert.equal(elementRecords.length, 140)
  assert.equal(sourceFileRecords.length, 24)
  assert.equal(functionRecords.length, 105)
  assert.equal(testRecords.length, 64)
  assert.equal(TOTAL_ITERATIONS, 225)
  assert.equal(resultSetRecords.length, 6)
  assert.equal(reviewRecords.length, 45)
  assert.equal(changeRecords.length, 18)
  assert.equal(findings.length, 12)
  assert.equal(baselines.length, 2)
})

test('evidence ids are unique and records carry required fields', () => {
  const seen = new Set<string>()
  for (const r of allEvidence) {
    assert.ok(!seen.has(r.id), `duplicate id ${r.id}`)
    seen.add(r.id)
    assert.match(r.hash, /^[0-9a-f]{64}$/)
    assert.ok(r.revision.length > 0)
    assert.ok(r.sourcePath.length > 0)
    assert.ok(r.provenance.length > 0)
    assert.ok(r.modified.length > 0)
  }
})

test('canonical eight-node chain resolves end to end via downstream links', () => {
  assert.equal(canonicalChain.length, 8)
  for (const id of canonicalChain) {
    assert.ok(evidenceById.has(id), `chain node ${id} must resolve`)
  }
  for (let i = 0; i < canonicalChain.length - 1; i++) {
    const here = evidenceById.get(canonicalChain[i] as string)
    const nextId = canonicalChain[i + 1] as string
    assert.ok(here, `record ${canonicalChain[i]}`)
    assert.ok(here.downstream.includes(nextId), `${here.id} must trace downstream to ${nextId}`)
  }
})

test('trace traversal from SYS-LAT-014 reaches the final result record', () => {
  const nodes = traceFrom('SYS-LAT-014', 8, 8)
  const ids = new Set(nodes.map((n) => n.id))
  assert.ok(ids.has('VR-RESULT-2026-041'))
})

test('broken LLR-to-model link is a real downstream gap with finding FND-002', () => {
  const rec = evidenceById.get('SWR-LLR-LAT-052')
  assert.ok(rec)
  assert.equal(rec.downstream.length, 0)
  assert.ok(rec.findingIds.includes('FND-002'))
})

test('search resolves SYS-LAT-014 as the top result', () => {
  const results = searchEvidence('SYS-LAT-014')
  assert.ok(results.length >= 1)
  assert.equal(results[0]?.id, 'SYS-LAT-014')
})

test('baseline compare buckets are populated and phase-consistent', () => {
  const all = compareBaselines()
  assert.ok(all.changed.some((r) => r.id === 'SYS-LAT-014'))
  assert.ok(all.changed.some((r) => r.id === 'LateralGuidance/BankAngleLimiter'))
  assert.ok(all.removed.length === 3)
  const req = compareBaselines('requirements')
  for (const r of [...req.changed, ...req.impacted]) assert.equal(r.phase, 'requirements')
})

test('twelve findings include the seeded scenarios', () => {
  const byId = new Map(findings.map((f) => [f.id, f]))
  assert.equal(byId.get('FND-012')?.status, 'ready-for-closure')
  assert.equal(byId.get('FND-005')?.severity, 'high')
  assert.ok(byId.get('FND-009')?.evidenceIds.includes('PLN-PSAC'))
  for (const f of findings) {
    assert.ok(f.history.length >= 2, `${f.id} needs seeded history`)
    assert.ok(f.evidenceIds.length >= 1)
  }
})
