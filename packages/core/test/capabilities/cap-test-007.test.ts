/**
 * CAP-TEST-007 — Approved product revision vs Copilot response changing a confirmed rule.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  diffApplicationSpecification,
  importProductInterviewResponse,
} from '../../src/capabilities/interview.js'
import { evaluateProductGate } from '../../src/capabilities/gates.js'
import { CapabilityWorkspace } from '../../src/capabilities/persistence.js'
import type { ApplicationSpecification } from '../../src/capabilities/types.js'

function tempWorkspace(): CapabilityWorkspace {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-cap-007-'))
  return new CapabilityWorkspace(dir)
}

function approvedSpec(): ApplicationSpecification {
  return {
    schemaVersion: '1.0',
    projectId: 'proj-1',
    id: 'app-1',
    revision: '1',
    status: 'approved',
    purpose: 'Track inventory for operators',
    outcomes: ['accurate stock counts'],
    actors: [{ id: 'a1', text: 'operator' }],
    goals: [{ id: 'g1', text: 'reduce stockouts' }],
    useCases: [{ id: 'u1', text: 'receive shipment' }],
    scenarios: [{ id: 's1', text: 'happy path receive' }],
    information: [{ id: 'i1', text: 'sku quantities' }],
    rules: [{ id: 'r1', text: 'quantity must be non-negative' }],
    externalSystems: [{ id: 'e1', text: 'local filesystem' }],
    constraints: [{ id: 'c1', text: 'offline capable' }],
    scope: { inScope: ['receive', 'count'], outOfScope: ['payroll'] },
    acceptanceCases: [{ id: 'ac1', description: 'receive updates stock', expectedOutcome: 'success' }],
    sources: [{ id: 'src1', text: 'product interview' }],
    unresolvedQuestions: [],
    contentHash: 'approved-hash-1',
    approvedAt: '2026-07-12T12:00:00.000Z',
  }
}

describe('CAP-TEST-007 approved revision protection and field-level delta', () => {
  it('does not mutate approved revision on import; shows field-level delta; approval creates new revision', () => {
    const ws = tempWorkspace()
    const first = approvedSpec()
    const stored = ws.approveApplication('proj-1', { ...first, status: 'draft' })
    expect(stored.revision).toBe('1')
    expect(stored.rules[0]?.text).toBe('quantity must be non-negative')

    const responseChangingRule: ApplicationSpecification = {
      ...first,
      revision: '2',
      status: 'draft',
      rules: [{ id: 'r1', text: 'quantity must be positive integer' }],
      contentHash: 'pending',
      approvedAt: undefined,
    }

    const imported = importProductInterviewResponse(responseChangingRule, {
      projectId: 'proj-1',
      approved: ws.getApprovedApplication('proj-1'),
    })

    // Import without approval — approved record unchanged.
    ws.saveApplicationDraft('proj-1', imported.draft)
    const stillApproved = ws.getApprovedApplication('proj-1')
    expect(stillApproved?.revision).toBe('1')
    expect(stillApproved?.rules[0]?.text).toBe('quantity must be non-negative')
    expect(ws.getApplicationDraft('proj-1')?.rules[0]?.text).toBe('quantity must be positive integer')

    const delta = imported.delta.length
      ? imported.delta
      : diffApplicationSpecification(stillApproved, imported.draft)
    expect(delta.some((d) => d.fieldPath === 'rules.r1' && d.change === 'changed')).toBe(true)
    const ruleDelta = delta.find((d) => d.fieldPath === 'rules.r1')
    expect(ruleDelta?.before).toEqual({ id: 'r1', text: 'quantity must be non-negative' })
    expect(ruleDelta?.after).toEqual({ id: 'r1', text: 'quantity must be positive integer' })

    expect(imported.gate.passed).toBe(true)
    const gate = evaluateProductGate(imported.draft)
    expect(gate.passed).toBe(true)

    const next = ws.approveApplication('proj-1', imported.draft)
    expect(next.revision).toBe('2')
    expect(next.rules[0]?.text).toBe('quantity must be positive integer')
    expect(ws.getApprovedApplication('proj-1')?.revision).toBe('2')
    // Prior revision file remains immutable.
    expect(ws.getApprovedApplication('proj-1', '1')?.rules[0]?.text).toBe(
      'quantity must be non-negative',
    )
  })
})
