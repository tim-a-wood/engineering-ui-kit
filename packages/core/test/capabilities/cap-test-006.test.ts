/**
 * CAP-TEST-006 — Product interview packet and incomplete/complete responses.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  PRODUCT_INTERVIEW_UPLOAD_BUDGET,
  buildProductInterviewPacket,
  importProductInterviewResponse,
  productInterviewUploadFiles,
} from '../../src/capabilities/interview.js'
import { evaluateProductGate } from '../../src/capabilities/gates.js'
import { CapabilityWorkspace } from '../../src/capabilities/persistence.js'
import type { ApplicationSpecification } from '../../src/capabilities/types.js'

function tempWorkspace(): CapabilityWorkspace {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-cap-006-'))
  return new CapabilityWorkspace(dir)
}

function completeSpec(overrides: Partial<ApplicationSpecification> = {}): ApplicationSpecification {
  return {
    schemaVersion: '1.0',
    projectId: 'proj-1',
    id: 'app-1',
    revision: '1',
    status: 'draft',
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
    contentHash: 'pending',
    ...overrides,
  }
}

describe('CAP-TEST-006 product interview packet and gate', () => {
  it('exports a bounded product interview packet within the upload budget', () => {
    const packet = buildProductInterviewPacket({
      packetId: 'pkt-product-1',
      projectId: 'proj-1',
    })
    expect(packet.interviewKind).toBe('product')
    expect(packet.gateId).toBe('CAP-GATE-001')
    expect(packet.outputSchemaRef).toBe('CAP-CONTRACT-001')
    expect(packet.outputFileName).toBe('capability-interview-response.json')
    expect(packet.safetyNotes.length).toBeGreaterThan(0)
    expect(packet.interviewBoundary).toMatch(/Product interview/i)
    expect(packet.interviewBoundary).toMatch(/per conversational turn/i)
    expect(packet.interviewBoundary).toMatch(/until every approval-blocking item is resolved/i)
    expect(packet.interviewBoundary).toMatch(/not.*permission to end the interview/i)
    const files = productInterviewUploadFiles(packet)
    expect(files.length).toBeLessThanOrEqual(PRODUCT_INTERVIEW_UPLOAD_BUDGET)
    expect(files).toContain('capability-interview-response.json')
  })

  it('blocks incomplete responses at CAP-GATE-001 and preserves them as drafts', () => {
    const ws = tempWorkspace()
    const incomplete = {
      schemaVersion: '1.0',
      projectId: 'proj-1',
      id: 'app-1',
      revision: '1',
      status: 'draft',
      purpose: 'partial',
      outcomes: [],
      actors: [],
      goals: [],
      useCases: [],
      scenarios: [],
      information: [],
      rules: [],
      externalSystems: [],
      constraints: [],
      scope: { inScope: [], outOfScope: [] },
      acceptanceCases: [],
      sources: [],
      unresolvedQuestions: [{ id: 'q1', text: 'who is the primary actor?' }],
      contentHash: 'incomplete',
    }
    const imported = importProductInterviewResponse(incomplete, { projectId: 'proj-1' })
    expect(imported.gate.passed).toBe(false)
    expect(imported.gate.diagnostics.some((d) => d.code === 'CAP-GATE-001-UNRESOLVED')).toBe(true)
    expect(imported.fieldStates['unresolvedQuestions.q1']).toBe('unresolved')
    ws.saveApplicationDraft('proj-1', imported.draft)
    expect(ws.getApplicationDraft('proj-1')?.unresolvedQuestions[0]?.id).toBe('q1')
    expect(ws.getApprovedApplication('proj-1')).toBeUndefined()

    const gate = evaluateProductGate(imported.draft)
    expect(gate.passed).toBe(false)
    expect(() => {
      if (!gate.passed) throw new Error('blocked by CAP-GATE-001')
      ws.approveApplication('proj-1', imported.draft)
    }).toThrow(/blocked/)
  })

  it('approves a complete reviewed response into an immutable revision', () => {
    const ws = tempWorkspace()
    const packet = buildProductInterviewPacket({ packetId: 'pkt-product-2', projectId: 'proj-1' })
    const complete = completeSpec()
    const imported = importProductInterviewResponse(complete, {
      projectId: 'proj-1',
      packet,
    })
    expect(imported.uploadFileCount).toBeLessThanOrEqual(PRODUCT_INTERVIEW_UPLOAD_BUDGET)
    expect(imported.valid).toBe(true)
    expect(imported.gate.passed).toBe(true)
    expect(imported.fieldStates.purpose).toBe('confirmed')

    ws.saveApplicationDraft('proj-1', imported.draft)
    const approved = ws.approveApplication('proj-1', imported.draft)
    expect(approved.status).toBe('approved')
    expect(approved.revision).toBe('1')
    expect(approved.contentHash.length).toBeGreaterThan(10)
    expect(ws.getApprovedApplication('proj-1')?.purpose).toBe(complete.purpose)
  })

  it('preserves invalid JSON as a draft with diagnostics', () => {
    const imported = importProductInterviewResponse('{not-json', { projectId: 'proj-1' })
    expect(imported.valid).toBe(false)
    expect(imported.diagnostics.some((d) => d.code === 'CAP-INT-PARSE')).toBe(true)
    expect(imported.draft.status).toBe('draft')
    expect(imported.gate.passed).toBe(false)
  })

  it('recovers a rich Copilot product-interview envelope without losing its answers', () => {
    const imported = importProductInterviewResponse({
      schemaVersion: '1.0',
      productDefinition: {
        purpose: 'Calculate approved aircraft performance data',
        primaryUser: 'Flight crew',
        secondaryUsers: ['Dispatch'],
        approvedCalculationBasis: 'Approved analytical models',
        operationalAuthority: 'Primary operational means',
        systemBoundary: { liveWeatherDatabaseConnections: false },
      },
      confirmedRequirements: {
        calculationScope: ['Takeoff performance'],
        requiredOutputs: ['V1', 'V2'],
        preflightWorkflow: ['Enter inputs', 'Calculate'],
        operatingEnvironments: ['Flight deck'],
        mandatoryOperationalInputsWhereApplicable: ['Aircraft weight'],
        operationalControls: ['Block invalid inputs'],
        firstReleaseAcceptanceCriteriaConfirmed: ['Produces traceable results'],
        firstReleaseExclusions: ['Live weather database'],
      },
      proposedRequirements: [],
      unresolvedRequirements: [{ id: 'UNRES-1', statement: 'Define response time' }],
    }, { projectId: 'proj-1' })

    expect(imported.valid).toBe(true)
    expect(imported.draft.purpose).toMatch(/aircraft performance/)
    expect(imported.draft.actors.map((actor) => actor.text)).toEqual(['Flight crew', 'Dispatch'])
    expect(imported.draft.useCases).toHaveLength(2)
    expect(imported.draft.acceptanceCases).toHaveLength(1)
    expect(imported.draft.unresolvedQuestions[0]?.text).toBe('Define response time')
    expect(imported.gate.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(['CAP-GATE-001-UNRESOLVED'])
  })
})
