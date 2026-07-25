/**
 * EUC-16 — Core application-operations service.
 * Acceptance (SPECIFICATION.md §17 all, §5.3, §19, §20.3, §25.3 EUC-13..17):
 *  - IPC, CLI, and machine API return the same structured result for the
 *    same operation (exercised here through the one shared service);
 *  - the interface enables only valid next actions;
 *  - every human operation has a machine operation;
 *  - no machine operation bypasses approval.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DesignWorkspace } from '../../../src/capabilities/design/designWorkspace.js'
import { createDesignOperations, type DesignOperationsService } from '../../../src/capabilities/design/operations.js'
import type { ReturnedDelta } from '../../../src/capabilities/design/records.js'

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'euik-euc16-'))
}

function makeOps(): DesignOperationsService {
  const workspace = new DesignWorkspace(tmpDir())
  return createDesignOperations({
    workspace,
    executors: {
      applyDelta: (plan, _delta, _context) => ({
        planId: plan.planId,
        applied: true,
        rolledBack: false,
        appliedFiles: plan.orderedChanges.map((c) => c.path),
        resultWorkspaceRevision: 'ws-r2',
        completedAt: new Date().toISOString(),
      }),
      verifyModule: (_input, _context) => ({ passed: true, evidenceRefs: ['evidence.module-check-1'] }),
    },
  })
}

const actor = 'user:alice'
const agent = 'agent:copilot'

let idem = 0
function key(): string {
  idem += 1
  return `idem-${idem}`
}

const workflowDetail = {
  trigger: 'A reviewer requests a pricing calculation.',
  orderedSteps: [
    { id: 'step-validate', text: 'Validate inputs' },
    { id: 'step-price', text: 'Compute price' },
  ],
  participants: ['reviewer'],
  decisionsAndGuards: [{ id: 'guard-valid', text: 'inputs are valid' }],
  transactionBoundary: 'single request',
  partialCompletion: 'not supported',
  compensation: 'not applicable',
  retryPolicy: 'retry on transient failure',
  deduplication: 'idempotency key',
  idempotencyKeyUse: 'required on every call',
  cancellationPoints: ['before the price is recorded'],
  deadlinePropagation: 'propagated from the caller',
  resourceLocks: ['none'],
  progressReporting: 'not applicable',
  finalOutcomes: ['priced', 'rejected'],
}

const domainDetail = {
  domainVocabulary: [{ id: 'term-audit-entry', text: 'audit entry' }],
  valueObjects: [{ id: 'vo-audit-id', text: 'AuditEntryId' }],
  consistencyBoundary: 'one audit trail per project',
  invariants: ['an audit entry is never edited after creation'],
  calculations: [{ id: 'calc-none', text: 'no calculations' }],
  decisionTables: [{ id: 'dt-none', text: 'no decision tables' }],
  deterministicOrdering: 'ordered by creation time',
  canonicalIdentityRules: 'audit entry id is stable and unique',
  revisionComparison: 'compares by monotonically increasing revision',
  invalidStatePrevention: 'rejects an audit entry without an actor',
  operationPurity: [{ operationId: 'noop', pure: true }],
}

describe('EUC-16 core operations — full happy path', () => {
  const ops = makeOps()
  const projectId = 'proj-happy'

  let analysisId = ''
  let questionId = ''
  let operationId = ''
  let pricingRevision = ''
  let pricingHash = ''
  let packetId = ''
  let inspectionId = ''
  let deltaId = ''

  it('creates a use-case draft with an open material question', () => {
    const before = ops.getValidNextActions(projectId)
    expect(before).toEqual([{ operation: 'createUseCaseDraft', label: 'Create use-case draft', enabled: true }])

    const result = ops.createUseCaseDraft({ projectId, actor, idempotencyKey: key(), workDescription: '' })
    expect(result.ok).toBe(true)
    expect(result.value?.questions.length).toBe(1)
    analysisId = result.value!.id
    questionId = result.value!.questions[0]!.id

    const after = ops.getValidNextActions(projectId)
    expect(after[0]).toMatchObject({ operation: 'updateUseCaseItem', enabled: true, targetId: analysisId })
  })

  it('answers the material question (updateUseCaseItem)', () => {
    const result = ops.updateUseCaseItem({
      projectId,
      actor,
      idempotencyKey: key(),
      target: { kind: 'question', questionId, answer: 'Explain the CAP-16 audit workflow.' },
    })
    expect(result.ok).toBe(true)
    expect(result.value?.status).toBe('readyForReview')

    const actions = ops.getValidNextActions(projectId)
    expect(actions[0]).toMatchObject({ operation: 'approveUseCaseAnalysis', enabled: true })
  })

  it('approves the use-case analysis, compiling the application (EUC-02)', () => {
    const result = ops.approveUseCaseAnalysis({ projectId, actor, idempotencyKey: key(), authority: 'product-lead' })
    expect(result.ok).toBe(true)
    expect(result.value?.analysis.status).toBe('approved')
    expect(result.value?.application).toBeDefined()
    operationId = result.value!.application!.acceptanceCases[0]!.id
      ? `op.${result.value!.application!.acceptanceCases[0]!.id}`
      : ''
    expect(operationId).not.toBe('')

    const actions = ops.getValidNextActions(projectId)
    expect(actions[0]).toMatchObject({ operation: 'createSystemDesignDraft', enabled: true })
  })

  it('creates the system design draft', () => {
    const result = ops.createSystemDesignDraft({ projectId, actor, idempotencyKey: key() })
    expect(result.ok).toBe(true)
    expect(result.value?.moduleIds).toEqual(['mod.core'])
    expect(result.value?.operationAllocations[0]?.operationId).toBe(operationId)
  })

  it('splits the primary module into two modules (applySystemDesignDecision)', () => {
    const result = ops.applySystemDesignDecision({
      projectId,
      actor,
      idempotencyKey: key(),
      decision: {
        kind: 'split',
        moduleId: 'mod.core',
        newModules: [
          {
            moduleId: 'mod.svc.pricing',
            name: 'Pricing service',
            moduleType: 'workflow',
            responsibility: 'Calculates and records evidence pricing decisions.',
            operationIds: [operationId],
          },
          {
            moduleId: 'mod.svc.audit',
            name: 'Audit trail service',
            moduleType: 'domain',
            responsibility: 'Maintains invariants for the audit trail record.',
            operationIds: [],
          },
        ],
      },
    })
    expect(result.ok).toBe(true)
    expect(new Set(result.value?.moduleIds)).toEqual(new Set(['mod.svc.pricing', 'mod.svc.audit']))
  })

  it('approves the system structure', () => {
    const actions = ops.getValidNextActions(projectId)
    expect(actions[0]).toMatchObject({ operation: 'approveSystemStructure', enabled: true })

    const result = ops.approveSystemStructure({ projectId, actor, idempotencyKey: key(), authority: 'software-architect' })
    expect(result.ok).toBe(true)
    expect(result.value?.status).toBe('approved')
  })

  it('starts both module designs', () => {
    const actions = ops.getValidNextActions(projectId)
    const startable = actions.filter((a) => a.operation === 'startModuleDesign' && a.enabled).map((a) => a.targetId)
    expect(new Set(startable)).toEqual(new Set(['mod.svc.pricing', 'mod.svc.audit']))

    const pricing = ops.startModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.svc.pricing' })
    expect(pricing.ok).toBe(true)
    const auditing = ops.startModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.svc.audit' })
    expect(auditing.ok).toBe(true)
  })

  it('completes the pricing module design to readyForReview and approves it', () => {
    const schemas = ops.updateModuleDesignItem({
      projectId,
      actor,
      idempotencyKey: key(),
      moduleId: 'mod.svc.pricing',
      path: 'schemas',
      value: [
        { schemaId: 'schema.pricing.in', version: '1.0', role: 'input', ref: 'schema://pricing/in' },
        { schemaId: 'schema.pricing.out', version: '1.0', role: 'output', ref: 'schema://pricing/out' },
      ],
    })
    expect(schemas.ok).toBe(true)

    const acceptance = ops.updateModuleDesignItem({
      projectId,
      actor,
      idempotencyKey: key(),
      moduleId: 'mod.svc.pricing',
      path: 'verification.acceptanceCases',
      value: [{ id: 'ac.pricing.1', description: 'computes a price for valid input', expectedOutcome: 'a price is returned' }],
    })
    expect(acceptance.ok).toBe(true)

    const detail = ops.updateModuleDesignItem({
      projectId,
      actor,
      idempotencyKey: key(),
      moduleId: 'mod.svc.pricing',
      path: 'typeSpecific.detail',
      value: workflowDetail,
    })
    expect(detail.ok).toBe(true)

    const analyzeActions = ops.getValidNextActions(projectId)
    expect(analyzeActions.some((a) => a.operation === 'updateModuleDesignItem' && a.targetId === 'mod.svc.pricing')).toBe(true)

    const analyzed = ops.analyzeModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.svc.pricing' })
    expect(analyzed.ok).toBe(true)
    expect(analyzed.value?.design.status).toBe('readyForReview')

    const readyActions = ops.getValidNextActions(projectId)
    expect(readyActions.some((a) => a.operation === 'approveModuleDesign' && a.targetId === 'mod.svc.pricing' && a.enabled)).toBe(true)

    const approved = ops.approveModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.svc.pricing', authority: 'module-owner' })
    expect(approved.ok).toBe(true)
    expect(approved.value?.status).toBe('approved')
    pricingRevision = approved.value!.revision
    pricingHash = approved.value!.contentHash
  })

  it('blocks createDesignBaseline while the audit module design is missing (completeBaseline gate)', () => {
    const result = ops.createDesignBaseline({ projectId, actor, idempotencyKey: key() })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.length).toBeGreaterThan(0)

    const actions = ops.getValidNextActions(projectId)
    const baselineAction = actions.find((a) => a.operation === 'createDesignBaseline')
    expect(baselineAction).toMatchObject({ enabled: false })
  })

  it('completes and approves the audit module design (one module approved without changing another)', () => {
    const acceptance = ops.updateModuleDesignItem({
      projectId,
      actor,
      idempotencyKey: key(),
      moduleId: 'mod.svc.audit',
      path: 'verification.acceptanceCases',
      value: [{ id: 'ac.audit.1', description: 'records an audit entry', expectedOutcome: 'an audit entry exists' }],
    })
    expect(acceptance.ok).toBe(true)

    const detail = ops.updateModuleDesignItem({
      projectId,
      actor,
      idempotencyKey: key(),
      moduleId: 'mod.svc.audit',
      path: 'typeSpecific.detail',
      value: domainDetail,
    })
    expect(detail.ok).toBe(true)

    const analyzed = ops.analyzeModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.svc.audit' })
    expect(analyzed.ok).toBe(true)
    expect(analyzed.value?.design.status).toBe('readyForReview')

    const approved = ops.approveModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.svc.audit', authority: 'module-owner' })
    expect(approved.ok).toBe(true)
    expect(approved.value?.status).toBe('approved')

    // approving mod.svc.audit did not change the already-approved mod.svc.pricing revision/hash.
    const pricing = ops.getModuleDesign(projectId, 'mod.svc.pricing')
    expect(pricing?.revision).toBe(pricingRevision)
    expect(pricing?.contentHash).toBe(pricingHash)
  })

  it('creates and approves the Design baseline once both modules are approved', () => {
    const actions = ops.getValidNextActions(projectId)
    expect(actions.find((a) => a.operation === 'createDesignBaseline')).toMatchObject({ enabled: true })

    const created = ops.createDesignBaseline({ projectId, actor, idempotencyKey: key() })
    expect(created.ok).toBe(true)
    expect(created.value?.missingModuleIds).toEqual([])

    const approved = ops.approveDesignBaseline({ projectId, actor, idempotencyKey: key(), authority: 'verification-lead' })
    expect(approved.ok).toBe(true)
    expect(approved.value?.status).toBe('approved')
  })

  it('creates a module implementation packet for the pricing module', () => {
    const actions = ops.getValidNextActions(projectId)
    expect(actions.find((a) => a.operation === 'createModuleImplementationPacket' && a.targetId === 'mod.svc.pricing')).toMatchObject({
      enabled: true,
    })

    const result = ops.createModuleImplementationPacket({
      projectId,
      actor,
      idempotencyKey: key(),
      moduleId: 'mod.svc.pricing',
      implementationSteps: ['implement the pricing calculation'],
      testCommands: ['npm test'],
    })
    expect(result.ok).toBe(true)
    expect(result.value?.moduleId).toBe('mod.svc.pricing')
    packetId = result.value!.packetId
  })

  it('imports, inspects, approves, and applies an agent delta', () => {
    deltaId = 'delta.pricing.1'
    const delta: ReturnedDelta = {
      schemaVersion: '1.0',
      deltaId,
      packetId,
      baseRevision: pricingRevision,
      baseHash: pricingHash,
      fileChanges: [
        { path: 'capabilities/modules/mod.svc.pricing/index.ts', action: 'create', content: 'export {}', contentHash: 'file-hash-1' },
      ],
      recordChanges: [],
      testResults: [{ command: 'npm test', passed: true, summary: 'all green' }],
      assumptions: [],
      unresolvedIssues: [],
      requestedScopeChanges: [],
      evidenceFiles: [],
      returnedAt: new Date().toISOString(),
      contentHash: 'delta-hash-1',
    }

    const imported = ops.importAgentDelta({ projectId, actor, idempotencyKey: key(), delta })
    expect(imported.ok).toBe(true)

    const inspected = ops.inspectAgentDelta({ projectId, actor, idempotencyKey: key(), deltaId })
    expect(inspected.ok).toBe(true)
    expect(inspected.value?.accepted).toBe(true)
    inspectionId = inspected.value!.inspectionId

    const approvedDelta = ops.approveAgentDelta({ projectId, actor, idempotencyKey: key(), inspectionId })
    expect(approvedDelta.ok).toBe(true)

    const applied = ops.applyAgentDelta({ projectId, actor, idempotencyKey: key(), inspectionId })
    expect(applied.ok).toBe(true)
    expect(applied.value?.applied).toBe(true)
  })

  it('verifies the pricing module using the configured executor', () => {
    const result = ops.verifyModule({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.svc.pricing' })
    expect(result.ok).toBe(true)
    expect(result.value?.passed).toBe(true)
  })
})

describe('EUC-16 §17.3 controls', () => {
  it('rejects a change operation without an idempotency key', () => {
    const ops = makeOps()
    const result = ops.createUseCaseDraft({ projectId: 'proj-controls-1', actor, workDescription: 'Track review approvals.' })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.code)).toContain('EUC16-IDEMPOTENCY-KEY-REQUIRED')
  })

  it('replays the first committed result for a duplicate idempotency key (byte-equal)', () => {
    const ops = makeOps()
    const projectId = 'proj-controls-2'
    const sharedKey = key()
    const first = ops.createUseCaseDraft({ projectId, actor, idempotencyKey: sharedKey, workDescription: 'Track review approvals.' })
    const second = ops.createUseCaseDraft({ projectId, actor, idempotencyKey: sharedKey, workDescription: 'A completely different description.' })

    expect(second.idempotentReplay).toBe(true)
    expect(second.ok).toBe(first.ok)
    expect(second.value).toEqual(first.value)
    expect(second.diagnostics).toEqual(first.diagnostics)
    expect(second.revision).toBe(first.revision)
    expect(second.contentHash).toBe(first.contentHash)
    expect(second.auditEventId).toBe(first.auditEventId)
    expect(second.validNextActions).toEqual(first.validNextActions)
  })

  it('rejects a stale expected base revision with a stable code', () => {
    const ops = makeOps()
    const projectId = 'proj-controls-3'
    const created = ops.createUseCaseDraft({ projectId, actor, idempotencyKey: key(), workDescription: 'Track review approvals.' })
    expect(created.ok).toBe(true)

    const stale = ops.updateUseCaseItem({
      projectId,
      actor,
      idempotencyKey: key(),
      expectedBaseRevision: 'r999-does-not-exist',
      target: { kind: 'item', itemId: created.value!.actors[0]!.id, action: 'accept' },
    })
    expect(stale.ok).toBe(false)
    expect(stale.diagnostics.map((d) => d.code)).toContain('EUC16-STALE-BASE')
  })

  it('rejects every approve* operation for an agent actor (no approval shortcut for agents)', () => {
    const ops = makeOps()
    const projectId = 'proj-controls-agent'

    const attempts: Array<() => { ok: boolean; diagnostics: { code: string }[] }> = [
      () => ops.approveUseCaseAnalysis({ projectId, actor: agent, idempotencyKey: key(), authority: 'product-lead' }),
      () => ops.approveSystemStructure({ projectId, actor: agent, idempotencyKey: key(), authority: 'software-architect' }),
      () =>
        ops.approveModuleDesign({ projectId, actor: agent, idempotencyKey: key(), moduleId: 'mod.x', authority: 'module-owner' }),
      () => ops.approveDesignBaseline({ projectId, actor: agent, idempotencyKey: key(), authority: 'verification-lead' }),
      () =>
        ops.approveChangePlan({
          projectId,
          actor: agent,
          idempotencyKey: key(),
          diagramId: 'diagram-1',
          elementId: 'element-1',
          impactId: 'impact-1',
          authority: 'software-architect',
        }),
      () => ops.approveAgentDelta({ projectId, actor: agent, idempotencyKey: key(), inspectionId: 'inspection-1' }),
      () => ops.approveVerification({ projectId, actor: agent, idempotencyKey: key(), runId: 'run-1', authority: 'verification-lead' }),
    ]

    for (const attempt of attempts) {
      const result = attempt()
      expect(result.ok).toBe(false)
      expect(result.diagnostics.map((d) => d.code)).toContain('EUC16-AGENT-APPROVAL-FORBIDDEN')
    }
  })

  it('writes a DesignAuditEvent per change operation, including the idempotency key', () => {
    const ops = makeOps()
    const workspace = new DesignWorkspace(fs.mkdtempSync(path.join(os.tmpdir(), 'euik-euc16-audit-')))
    const localOps = createDesignOperations({ workspace })
    const projectId = 'proj-audit'

    const before = workspace.listAuditEvents(projectId).length
    const usedKey = key()
    const result = localOps.createUseCaseDraft({ projectId, actor, idempotencyKey: usedKey, workDescription: 'Track review approvals.' })
    expect(result.ok).toBe(true)

    const events = workspace.listAuditEvents(projectId)
    expect(events.length).toBe(before + 1)
    expect(events[events.length - 1]).toMatchObject({ operation: 'createUseCaseDraft', idempotencyKey: usedKey, outcome: 'ok' })
    expect(result.auditEventId).toBe(events[events.length - 1]!.eventId)
  })

  it('out-of-scope delta import is stored as evidence but inspection rejects it', () => {
    const ops = makeOps()
    const projectId = 'proj-out-of-scope'

    // Build a minimal single-module project through to an implementation packet.
    ops.createUseCaseDraft({ projectId, actor, idempotencyKey: key(), workDescription: 'Track review approvals.' })
    ops.approveUseCaseAnalysis({ projectId, actor, idempotencyKey: key(), authority: 'product-lead' })
    ops.createSystemDesignDraft({ projectId, actor, idempotencyKey: key() })
    ops.approveSystemStructure({ projectId, actor, idempotencyKey: key(), authority: 'software-architect' })
    ops.startModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' })
    ops.updateModuleDesignItem({
      projectId,
      actor,
      idempotencyKey: key(),
      moduleId: 'mod.core',
      path: 'schemas',
      value: [
        { schemaId: 'schema.in', version: '1.0', role: 'input', ref: 'schema://in' },
        { schemaId: 'schema.out', version: '1.0', role: 'output', ref: 'schema://out' },
      ],
    })
    ops.updateModuleDesignItem({
      projectId,
      actor,
      idempotencyKey: key(),
      moduleId: 'mod.core',
      path: 'verification.acceptanceCases',
      value: [{ id: 'ac1', description: 'does the work', expectedOutcome: 'the work is done' }],
    })
    ops.updateModuleDesignItem({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', path: 'typeSpecific.detail', value: workflowDetail })
    ops.analyzeModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' })
    const approved = ops.approveModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', authority: 'module-owner' })
    expect(approved.ok).toBe(true)
    ops.createDesignBaseline({ projectId, actor, idempotencyKey: key() })
    ops.approveDesignBaseline({ projectId, actor, idempotencyKey: key(), authority: 'verification-lead' })

    const packet = ops.createModuleImplementationPacket({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' })
    expect(packet.ok).toBe(true)

    const delta: ReturnedDelta = {
      schemaVersion: '1.0',
      deltaId: 'delta.out-of-scope',
      packetId: packet.value!.packetId,
      baseRevision: approved.value!.revision,
      baseHash: approved.value!.contentHash,
      fileChanges: [{ path: 'capabilities/modules/other-module/hack.ts', action: 'create', content: 'export {}', contentHash: 'hash-x' }],
      recordChanges: [],
      testResults: [{ command: 'npm test', passed: true, summary: 'all green' }],
      assumptions: [],
      unresolvedIssues: [],
      requestedScopeChanges: [],
      evidenceFiles: [],
      returnedAt: new Date().toISOString(),
      contentHash: 'delta-hash-out-of-scope',
    }

    const imported = ops.importAgentDelta({ projectId, actor, idempotencyKey: key(), delta })
    expect(imported.ok).toBe(true)

    const inspected = ops.inspectAgentDelta({ projectId, actor, idempotencyKey: key(), deltaId: delta.deltaId })
    expect(inspected.ok).toBe(true)
    expect(inspected.value?.accepted).toBe(false)
    expect(inspected.value?.rejectionReasons).toContain('path-outside-allowed')
  })

  it('incrementalModules mode allows a packet for a dependency-closed approved module while completeBaseline blocks it', () => {
    const ops = makeOps()
    const workspace = new DesignWorkspace(fs.mkdtempSync(path.join(os.tmpdir(), 'euik-euc16-incremental-')))
    const localOps = createDesignOperations({ workspace })
    const projectId = 'proj-incremental'

    localOps.createUseCaseDraft({ projectId, actor, idempotencyKey: key(), workDescription: 'Track review approvals.' })
    localOps.approveUseCaseAnalysis({ projectId, actor, idempotencyKey: key(), authority: 'product-lead' })
    localOps.createSystemDesignDraft({ projectId, actor, idempotencyKey: key() })
    localOps.approveSystemStructure({ projectId, actor, idempotencyKey: key(), authority: 'software-architect' })
    localOps.startModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' })
    localOps.updateModuleDesignItem({
      projectId,
      actor,
      idempotencyKey: key(),
      moduleId: 'mod.core',
      path: 'schemas',
      value: [
        { schemaId: 'schema.in', version: '1.0', role: 'input', ref: 'schema://in' },
        { schemaId: 'schema.out', version: '1.0', role: 'output', ref: 'schema://out' },
      ],
    })
    localOps.updateModuleDesignItem({
      projectId,
      actor,
      idempotencyKey: key(),
      moduleId: 'mod.core',
      path: 'verification.acceptanceCases',
      value: [{ id: 'ac1', description: 'does the work', expectedOutcome: 'the work is done' }],
    })
    localOps.updateModuleDesignItem({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', path: 'typeSpecific.detail', value: workflowDetail })
    localOps.analyzeModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' })
    const approved = localOps.approveModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', authority: 'module-owner' })
    expect(approved.ok).toBe(true)

    // completeBaseline (default policy) blocks the packet — no Design baseline is approved.
    const blocked = localOps.createModuleImplementationPacket({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' })
    expect(blocked.ok).toBe(false)

    workspace.saveDesignWorkflowPolicy(projectId, {
      projectId,
      mode: 'incrementalModules',
      approvedDecisionId: 'decision-1',
      changedAt: new Date().toISOString(),
      changedBy: actor,
    })

    const allowed = localOps.createModuleImplementationPacket({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' })
    expect(allowed.ok).toBe(true)
  })

  it('never enables an action that the service would then reject (probe on a fresh project)', () => {
    const ops = makeOps()
    const projectId = 'proj-probe'
    const actions = ops.getValidNextActions(projectId)
    const enabled = actions.filter((a) => a.enabled)
    expect(enabled.length).toBeGreaterThan(0)
    for (const enabledAction of enabled) {
      expect(enabledAction.operation).toBe('createUseCaseDraft')
      const result = ops.createUseCaseDraft({ projectId, actor, idempotencyKey: key(), workDescription: 'Track review approvals.' })
      expect(result.ok).toBe(true)
      expect(result.diagnostics.map((d) => d.code)).not.toContain('EUC16-AGENT-APPROVAL-FORBIDDEN')
      expect(result.diagnostics.map((d) => d.code)).not.toContain('EUC16-STALE-BASE')
    }
  })
})
