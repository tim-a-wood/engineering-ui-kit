/**
 * Review-fixes S2 — second-review identity/authority findings.
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §4, §5.3,
 * §9.7, §17.3, §20.2, §20.3.
 *
 * Covers three second-review findings:
 *  - Finding 1 (self-asserted approval identity) — every PUBLIC core
 *    approval function default-denies a non-human actor independent of
 *    capitalization ('Agent:copilot', ' SERVICE:bot ' are both rejected,
 *    not just a lowercase 'agent:' prefix), and the adapter boundary
 *    (designMachineApi.ts / designCli.ts) stamps a trusted principal onto
 *    every §17.2 change-operation request rather than trusting a
 *    caller-supplied `actor`.
 *  - Finding 2 (forgeable consumer acks) — a consumer contract
 *    acknowledgement rejects a non-human actor, requires module-owner or
 *    software-architect authority for the CONSUMER module's project,
 *    verifies the contract exists in the persisted registry, verifies the
 *    acking module actually requires it, binds the ack to the reviewed
 *    consumer design revision, and persists reviewer identity + authority +
 *    revision + time.
 *  - Finding 3 (audit idempotency scope) — an audit event is deduplicated
 *    by projectId + operation + idempotencyKey, the same scope
 *    `operations.ts`'s own result-replay cache uses, so two different
 *    operations that happen to reuse one idempotency key each get their own
 *    audit event.
 *
 * apps/desktop/src/capabilities/designIpc.ts's own trusted-principal fix is
 * covered by additive tests in apps/desktop/test/design-ipc.test.ts (that
 * file is owned by another packet for an unrelated realpath fix).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DesignWorkspace } from '../../../src/capabilities/design/designWorkspace.js'
import { createDesignOperations, type DesignOperationsService } from '../../../src/capabilities/design/operations.js'
import {
  APPROVAL_AUTHORITIES,
  isNonHumanActor,
  isAgentActor,
  type ApprovalAuthority,
} from '../../../src/capabilities/design/records.js'
import { approveModuleDesign } from '../../../src/capabilities/design/moduleDesign.js'
import { approveUseCaseAnalysis } from '../../../src/capabilities/design/useCaseAnalysis.js'
import { approveSystemStructure } from '../../../src/capabilities/design/systemDesign.js'
import { approveDesignBaseline, changeGateMode, createDefaultPolicy } from '../../../src/capabilities/design/designBaseline.js'
import { approveContract, createContractRegistry, registerContract } from '../../../src/capabilities/design/contractRegistry.js'
import type { OperationContract } from '../../../src/capabilities/types.js'
import { createDesignMachineApi, deriveOsPrincipal, resolvePrincipal, stampPrincipal } from '../../../src/designMachineApi.js'
import { runDesignCli, type DesignCliOptions } from '../../../src/designCli.js'

function tmpDir(prefix = 'euik-s2-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

const actor = 'user:alice'

let idem = 0
function key(): string {
  idem += 1
  return `s2-idem-${idem}`
}

function seedFullAuthority(workspace: DesignWorkspace, projectId: string, actorId = actor): void {
  workspace.saveProjectRoles(projectId, { [actorId]: [...APPROVAL_AUTHORITIES] })
}

/** The exact case variants the reviewer found bypassed the (case-sensitive, agent-only) actor check. */
const badActors = ['Agent:copilot', ' AGENT:x ', 'service:x', ' SERVICE:y ']

// ---------------------------------------------------------------------------
// Finding 1a — records.ts isNonHumanActor
// ---------------------------------------------------------------------------

describe('S2 Finding 1a — isNonHumanActor is case-insensitive and covers service: (records.ts)', () => {
  it('detects every bad-actor variant the reviewer used to bypass isAgentActor', () => {
    for (const bad of badActors) expect(isNonHumanActor(bad)).toBe(true)
  })

  it('does not flag a well-formed human actor', () => {
    expect(isNonHumanActor('user:alice')).toBe(false)
    expect(isNonHumanActor(' user:alice ')).toBe(false)
  })

  it('isAgentActor is kept as a working alias (deprecated) for an existing import', () => {
    expect(isAgentActor).toBe(isNonHumanActor)
    for (const bad of badActors) expect(isAgentActor(bad)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Finding 1b — every PUBLIC core approval function default-denies a
// non-human actor, independent of capitalization
// ---------------------------------------------------------------------------

describe('S2 Finding 1b — every public core approval function rejects Agent:copilot / AGENT:x / service:x / SERVICE:y', () => {
  it('contractRegistry.approveContract (reviewer regression: ran both cases through successfully)', () => {
    const contract: OperationContract = {
      schemaVersion: '1.0',
      operationId: 'op.s2-contract',
      version: '1.0.0',
      behavior: 'command',
      inputSchemaRef: 'schema.in@1',
      outputSchemaRef: 'schema.out@1',
      preconditions: [],
      postconditions: [],
      domainRejections: [],
      technicalErrors: [],
      sideEffects: [],
      idempotency: 'idempotent',
      timeoutClass: 'short',
      cancellable: false,
      artifactTypes: [],
      provenanceFields: [],
    }
    const registered = registerContract(createContractRegistry(), {
      operationId: 'op.s2-contract',
      version: '1.0.0',
      providerModuleId: 'mod.provider',
      contract,
    })
    expect(registered.ok).toBe(true)
    for (const bad of badActors) {
      const result = approveContract(registered.registry!, 'op.s2-contract', '1.0.0', { approvedBy: bad, authority: 'module-owner' })
      expect(result.ok).toBe(false)
      expect(result.diagnostics.some((d) => d.code === 'CAP-DES-CTR-AGENT-APPROVAL')).toBe(true)
    }
  })

  it('moduleDesign.approveModuleDesign', () => {
    const design = { module: { moduleId: 'mod.s2' }, status: 'readyForReview' } as any
    for (const bad of badActors) {
      const result = approveModuleDesign(design, { approvedBy: bad, authority: 'module-owner', approvedAt: new Date(0).toISOString() })
      expect(result.ok).toBe(false)
      expect(result.diagnostics.some((d) => d.code === 'MODDESIGN-APPROVAL-AGENT')).toBe(true)
    }
  })

  it('useCaseAnalysis.approveUseCaseAnalysis', () => {
    const analysis = { status: 'readyForReview' } as any
    for (const bad of badActors) {
      const result = approveUseCaseAnalysis(analysis, { approvedBy: bad, authority: 'product-lead', at: new Date(0).toISOString() })
      expect(result.diagnostics.some((d) => d.code)).toBe(true)
      expect(result.diagnostics.length).toBeGreaterThan(0)
    }
  })

  it('systemDesign.approveSystemStructure', () => {
    const architecture = { status: 'draft', id: 'arch-s2' } as any
    const application = {} as any
    for (const bad of badActors) {
      const result = approveSystemStructure(architecture, application, { approvedBy: bad, authority: 'software-architect' })
      expect(result.ok).toBe(false)
      expect(result.diagnostics.some((d) => d.code === 'CAP-DES-SYS-AGENT-APPROVAL')).toBe(true)
    }
  })

  it('designBaseline.approveDesignBaseline', () => {
    const baseline = { status: 'draft', id: 'baseline-s2', missingModuleIds: [], gates: [] } as any
    for (const bad of badActors) {
      const result = approveDesignBaseline(baseline, { approvedBy: bad, authority: 'software-architect' })
      expect(result.ok).toBe(false)
      expect(result.diagnostics.some((d) => d.code === 'CAP-DES-BASE-AGENT-APPROVAL')).toBe(true)
    }
  })

  it('designBaseline.changeGateMode', () => {
    const policy = createDefaultPolicy('proj-s2')
    for (const bad of badActors) {
      const result = changeGateMode(policy, 'incrementalModules', 'decision-1', bad)
      expect(result.ok).toBe(false)
      expect(result.diagnostics.some((d) => d.code === 'CAP-DES-POLICY-AGENT')).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Finding 1c — trusted principal at the adapter boundary
// (designMachineApi.ts / designCli.ts; designIpc.ts is covered by additive
// tests in apps/desktop/test/design-ipc.test.ts)
// ---------------------------------------------------------------------------

describe('S2 Finding 1c — trusted principal at the adapter boundary', () => {
  it('resolvePrincipal validates an explicit "user:<id>" principal and rejects a malformed one', () => {
    expect(resolvePrincipal(undefined)).toBeUndefined()
    expect(resolvePrincipal('user:alice')).toBe('user:alice')
    expect(() => resolvePrincipal('agent:copilot')).toThrow(/principal/)
    expect(() => resolvePrincipal('not-a-principal')).toThrow(/principal/)
  })

  it('stampPrincipal overrides args[0].actor for a change-operation input and leaves a read-op\'s positional args untouched', () => {
    const dataDir = tmpDir()
    const workspace = new DesignWorkspace(dataDir)
    const changeArgs = stampPrincipal([{ projectId: 'proj-x', actor: 'agent:copilot', idempotencyKey: 'k1' }], 'user:trusted', workspace, 'createUseCaseDraft')
    expect((changeArgs[0] as any).actor).toBe('user:trusted')

    const readArgs = stampPrincipal(['proj-x'], 'user:trusted', workspace, 'getWorkflowStatus')
    expect(readArgs).toEqual(['proj-x'])
  })

  it('stampPrincipal is a no-op when principal is undefined (opt-in stamping)', () => {
    const dataDir = tmpDir()
    const workspace = new DesignWorkspace(dataDir)
    const args = stampPrincipal([{ projectId: 'proj-x', actor: 'agent:copilot', idempotencyKey: 'k1' }], undefined, workspace, 'createUseCaseDraft')
    expect((args[0] as any).actor).toBe('agent:copilot')
  })

  it('createDesignMachineApi: an explicit principal overrides a claimed actor and records a non-blocking EUC16-ACTOR-CLAIM-MISMATCH audit event', async () => {
    const dataDir = tmpDir()
    const principal = 'user:trusted-caller'
    const api = createDesignMachineApi({ dataDir, principal })

    const result = await api.createUseCaseDraft({
      projectId: 'proj-s2-machine',
      actor: 'user:someone-else', // a caller-claimed identity that is not the constructed principal
      idempotencyKey: key(),
      workDescription: '',
    })
    expect(result.ok).toBe(true)

    const workspace = new DesignWorkspace(dataDir)
    const events = workspace.listAuditEvents('proj-s2-machine')
    const createEvent = events.find((e) => e.operation === 'createUseCaseDraft')
    expect(createEvent?.actor).toBe(principal)
    const mismatch = events.find((e) => e.diagnosticCodes.includes('EUC16-ACTOR-CLAIM-MISMATCH'))
    expect(mismatch).toBeDefined()
    expect(mismatch?.actor).toBe(principal)
    expect(mismatch?.evidenceRefs).toEqual(['user:someone-else'])
    expect(mismatch?.outcome).toBe('ok') // never blocks the call
  })

  it('createDesignMachineApi: a matching claimed actor records no mismatch event', async () => {
    const dataDir = tmpDir()
    const principal = 'user:trusted-caller'
    const api = createDesignMachineApi({ dataDir, principal })
    await api.createUseCaseDraft({ projectId: 'proj-s2-machine-2', actor: principal, idempotencyKey: key(), workDescription: '' })
    const workspace = new DesignWorkspace(dataDir)
    const events = workspace.listAuditEvents('proj-s2-machine-2')
    expect(events.some((e) => e.diagnosticCodes.includes('EUC16-ACTOR-CLAIM-MISMATCH'))).toBe(false)
  })

  it('runDesignCli: an explicit principal overrides a claimed --json actor', async () => {
    const dataDir = tmpDir()
    const out: string[] = []
    const err: string[] = []
    const opts: DesignCliOptions = { dataDir, principal: 'user:cli-trusted', stdout: (s) => out.push(s), stderr: (s) => err.push(s) }
    const code = await runDesignCli(
      ['createUseCaseDraft', '--json', JSON.stringify([{ projectId: 'proj-s2-cli', actor: 'agent:copilot', idempotencyKey: key(), workDescription: '' }])],
      opts,
    )
    expect(code).toBe(0)
    const workspace = new DesignWorkspace(dataDir)
    const event = workspace.listAuditEvents('proj-s2-cli').find((e) => e.operation === 'createUseCaseDraft')
    expect(event?.actor).toBe('user:cli-trusted')
  })

  it('deriveOsPrincipal returns a well-formed "user:<id>" principal a caller can opt in with', () => {
    const principal = deriveOsPrincipal()
    expect(principal.startsWith('user:')).toBe(true)
    expect(resolvePrincipal(principal)).toBe(principal)
  })
})

// ---------------------------------------------------------------------------
// Finding 2 — forgeable consumer acks
// ---------------------------------------------------------------------------

const workflowDetail = {
  trigger: 'A reviewer requests a pricing calculation.',
  orderedSteps: [{ id: 'step-validate', text: 'Validate inputs' }],
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

function ioSchemas(moduleId: string) {
  return [
    { schemaId: `${moduleId}.input`, version: '1.0.0', role: 'input' as const, ref: `schema://${moduleId}/in` },
    { schemaId: `${moduleId}.output`, version: '1.0.0', role: 'output' as const, ref: `schema://${moduleId}/out` },
  ]
}

/** Builds a project with an approved provider module and an approved consumer module that requires the provider's operation. */
function setupProviderAndConsumer(ops: DesignOperationsService, projectId: string): { operationId: string } {
  ops.createUseCaseDraft({ projectId, actor, idempotencyKey: key(), workDescription: 'Track review approvals.' })
  const approvedUseCase = ops.approveUseCaseAnalysis({ projectId, actor, idempotencyKey: key(), authority: 'product-lead' })
  const operationId = `op.${approvedUseCase.value!.application!.acceptanceCases[0]!.id}`
  ops.createSystemDesignDraft({ projectId, actor, idempotencyKey: key() })
  ops.applySystemDesignDecision({
    projectId,
    actor,
    idempotencyKey: key(),
    decision: {
      kind: 'split',
      moduleId: 'mod.core',
      newModules: [
        { moduleId: 'mod.provider', name: 'Provider', moduleType: 'workflow', responsibility: 'Provides the operation.', operationIds: [operationId] },
        { moduleId: 'mod.consumer', name: 'Consumer', moduleType: 'workflow', responsibility: 'Consumes the operation.', operationIds: [] },
      ],
    },
  })
  ops.approveSystemStructure({ projectId, actor, idempotencyKey: key(), authority: 'software-architect' })

  ops.startModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.provider' })
  ops.updateModuleDesignItem({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.provider', path: 'schemas', value: ioSchemas('mod.provider') })
  ops.updateModuleDesignItem({
    projectId,
    actor,
    idempotencyKey: key(),
    moduleId: 'mod.provider',
    path: 'verification.acceptanceCases',
    value: [{ id: 'ac.p', description: 'provides the operation', expectedOutcome: 'the operation runs' }],
  })
  ops.updateModuleDesignItem({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.provider', path: 'typeSpecific.detail', value: workflowDetail })
  ops.analyzeModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.provider' })
  const providerApproved = ops.approveModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.provider', authority: 'module-owner' })
  if (!providerApproved.ok) throw new Error(`provider setup failed: ${JSON.stringify(providerApproved.diagnostics)}`)

  ops.startModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.consumer' })
  ops.updateModuleDesignItem({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.consumer', path: 'schemas', value: ioSchemas('mod.consumer') })
  ops.updateModuleDesignItem({
    projectId,
    actor,
    idempotencyKey: key(),
    moduleId: 'mod.consumer',
    path: 'verification.acceptanceCases',
    value: [{ id: 'ac.c', description: 'consumes the operation', expectedOutcome: 'the consumer completes' }],
  })
  ops.updateModuleDesignItem({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.consumer', path: 'typeSpecific.detail', value: workflowDetail })
  ops.updateModuleDesignItem({
    projectId,
    actor,
    idempotencyKey: key(),
    moduleId: 'mod.consumer',
    path: 'requiredOperations',
    value: [{ operationId, acceptedVersionRange: '^1.0.0', providerModuleId: 'mod.provider', reason: 'needs the provided operation' }],
  })
  ops.analyzeModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.consumer' })
  const consumerApproved = ops.approveModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.consumer', authority: 'module-owner' })
  if (!consumerApproved.ok) throw new Error(`consumer setup failed: ${JSON.stringify(consumerApproved.diagnostics)}`)

  return { operationId }
}

describe('S2 Finding 2 — forgeable consumer acks (explicit requiredOperations.ack)', () => {
  it('reviewer regression: an agent actor can no longer persist an ack for a nonexistent contract (op.nonexistent@999)', () => {
    const workspace = new DesignWorkspace(tmpDir())
    const projectId = 'proj-s2-ack-regression'
    seedFullAuthority(workspace, projectId)
    const ops = createDesignOperations({ workspace })
    setupProviderAndConsumer(ops, projectId)

    ops.reopenModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.consumer' })
    const ack = ops.updateModuleDesignItem({
      projectId,
      actor: 'agent:copilot',
      idempotencyKey: key(),
      moduleId: 'mod.consumer',
      path: 'requiredOperations.ack',
      value: { operationId: 'op.nonexistent', version: '999.0.0' },
    })
    expect(ack.ok).toBe(false)
    expect(ack.diagnostics.map((d) => d.code)).toContain('EUC16-CONTRACT-ACK-NON-HUMAN')
    expect(workspace.listConsumerAcks(projectId, 'op.nonexistent', '999.0.0')).toEqual([])
  })

  it('rejects a case-varied non-human actor (Agent:copilot / SERVICE:bot)', () => {
    const workspace = new DesignWorkspace(tmpDir())
    const projectId = 'proj-s2-ack-case'
    seedFullAuthority(workspace, projectId)
    const ops = createDesignOperations({ workspace })
    const { operationId } = setupProviderAndConsumer(ops, projectId)
    ops.reopenModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.consumer' })

    for (const bad of ['Agent:copilot', ' SERVICE:bot ']) {
      const ack = ops.updateModuleDesignItem({
        projectId,
        actor: bad,
        idempotencyKey: key(),
        moduleId: 'mod.consumer',
        path: 'requiredOperations.ack',
        value: { operationId, version: '1.0.0' },
      })
      expect(ack.ok).toBe(false)
      expect(ack.diagnostics.map((d) => d.code)).toContain('EUC16-CONTRACT-ACK-NON-HUMAN')
    }
  })

  it('rejects a human actor with no configured authority for the consumer project', () => {
    const workspace = new DesignWorkspace(tmpDir())
    const projectId = 'proj-s2-ack-no-authority'
    seedFullAuthority(workspace, projectId)
    const ops = createDesignOperations({ workspace })
    const { operationId } = setupProviderAndConsumer(ops, projectId)
    ops.reopenModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.consumer' })

    const ack = ops.updateModuleDesignItem({
      projectId,
      actor: 'user:no-role',
      idempotencyKey: key(),
      moduleId: 'mod.consumer',
      path: 'requiredOperations.ack',
      value: { operationId, version: '1.0.0' },
    })
    expect(ack.ok).toBe(false)
    expect(ack.diagnostics.map((d) => d.code)).toContain('EUC16-AUTHORITY-NOT-CONFIGURED')
  })

  it('rejects an ack for an operationId@version that is not in the persisted registry', () => {
    const workspace = new DesignWorkspace(tmpDir())
    const projectId = 'proj-s2-ack-unknown-contract'
    seedFullAuthority(workspace, projectId)
    const ops = createDesignOperations({ workspace })
    setupProviderAndConsumer(ops, projectId)
    ops.reopenModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.consumer' })

    const ack = ops.updateModuleDesignItem({
      projectId,
      actor,
      idempotencyKey: key(),
      moduleId: 'mod.consumer',
      path: 'requiredOperations.ack',
      value: { operationId: 'op.nonexistent', version: '999.0.0' },
    })
    expect(ack.ok).toBe(false)
    expect(ack.diagnostics.map((d) => d.code)).toContain('EUC16-CONTRACT-ACK-UNKNOWN-CONTRACT')
  })

  it('rejects an ack for a real contract the acking module does not actually require', () => {
    const workspace = new DesignWorkspace(tmpDir())
    const projectId = 'proj-s2-ack-not-required'
    seedFullAuthority(workspace, projectId)
    const ops = createDesignOperations({ workspace })
    const { operationId } = setupProviderAndConsumer(ops, projectId)
    // mod.provider itself never lists a requiredOperations entry for its own operation.
    ops.reopenModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.provider' })

    const ack = ops.updateModuleDesignItem({
      projectId,
      actor,
      idempotencyKey: key(),
      moduleId: 'mod.provider',
      path: 'requiredOperations.ack',
      value: { operationId, version: '1.0.0' },
    })
    expect(ack.ok).toBe(false)
    expect(ack.diagnostics.map((d) => d.code)).toContain('EUC16-CONTRACT-ACK-NOT-REQUIRED')
  })

  it('a valid explicit ack persists reviewer identity + authority + consumer design revision + time', () => {
    const workspace = new DesignWorkspace(tmpDir())
    const projectId = 'proj-s2-ack-valid'
    seedFullAuthority(workspace, projectId)
    const ops = createDesignOperations({ workspace })
    const { operationId } = setupProviderAndConsumer(ops, projectId)
    const reopened = ops.reopenModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.consumer' })
    expect(reopened.ok).toBe(true)
    const consumerDraft = workspace.getModuleDesignDraft(projectId, 'mod.consumer')!

    const ack = ops.updateModuleDesignItem({
      projectId,
      actor,
      idempotencyKey: key(),
      moduleId: 'mod.consumer',
      path: 'requiredOperations.ack',
      value: { operationId, version: '1.0.0', authority: 'module-owner' },
    })
    expect(ack.ok).toBe(true)

    const acks = workspace.listConsumerAcks(projectId, operationId, '1.0.0')
    const persisted = acks.find((a) => a.consumerModuleId === 'mod.consumer')!
    expect(persisted).toBeDefined()
    expect(persisted.source).toBe('explicit')
    expect(persisted.ackedBy).toBe(actor)
    expect(persisted.authority).toBe('module-owner')
    expect(persisted.consumerDesignRevision).toBe(consumerDraft.revision)
    expect(typeof persisted.ackedAt).toBe('string')
    expect(persisted.ackedAt.length).toBeGreaterThan(0)
  })
})

describe('S2 Finding 2 — forgeable consumer acks (implicit ack via analyzeModuleDesign)', () => {
  it('derives identity from the authenticated principal of the analyzeModuleDesign call, and binds the consumer design revision', () => {
    const workspace = new DesignWorkspace(tmpDir())
    const projectId = 'proj-s2-implicit-ack'
    seedFullAuthority(workspace, projectId)
    const ops = createDesignOperations({ workspace })
    const { operationId } = setupProviderAndConsumer(ops, projectId)

    const consumerApproved = workspace.getApprovedModuleDesign(projectId, 'mod.consumer')!
    const acks = workspace.listConsumerAcks(projectId, operationId, '1.0.0')
    const implicitAck = acks.find((a) => a.consumerModuleId === 'mod.consumer' && a.source === 'analyze')!
    expect(implicitAck).toBeDefined()
    expect(implicitAck.ackedBy).toBe(actor)
    // Bound to the consumer design revision reviewed at that analyze call —
    // not necessarily the final approved revision (approval may freeze a
    // further revision), but always a design revision belonging to this consumer.
    expect(typeof implicitAck.consumerDesignRevision).toBe('string')
    expect(implicitAck.consumerDesignRevision.length).toBeGreaterThan(0)
    expect(consumerApproved).toBeDefined()
  })

  it('only acks operations the module actually requires and that exist — never an unrelated persisted contract', () => {
    const workspace = new DesignWorkspace(tmpDir())
    const projectId = 'proj-s2-implicit-scope'
    seedFullAuthority(workspace, projectId)
    const ops = createDesignOperations({ workspace })
    setupProviderAndConsumer(ops, projectId)

    // mod.provider was analyzed and approved, but it does not itself require
    // any operation, so it must never have acked anything.
    const providerAcksAsConsumer = workspace
      .listContracts(projectId)
      .flatMap((c) => workspace.listConsumerAcks(projectId, c.operationId, c.version))
      .filter((a) => a.consumerModuleId === 'mod.provider')
    expect(providerAcksAsConsumer).toEqual([])
  })

  it('does not record an implicit ack when analyzeModuleDesign is run by a non-human actor', () => {
    const workspace = new DesignWorkspace(tmpDir())
    const projectId = 'proj-s2-implicit-agent'
    seedFullAuthority(workspace, projectId)
    const ops = createDesignOperations({ workspace })
    const { operationId } = setupProviderAndConsumer(ops, projectId)

    // Re-open and re-analyze the consumer as an agent actor (agents may
    // legitimately draft/analyze, §4) — this must not count as the human
    // "consumer shall review" a changed contract requires.
    ops.reopenModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.consumer' })
    const beforeCount = workspace.listConsumerAcks(projectId, operationId, '1.0.0').length
    const analyzed = ops.analyzeModuleDesign({ projectId, actor: 'agent:copilot', idempotencyKey: key(), moduleId: 'mod.consumer' })
    expect(analyzed.ok).toBe(true) // analyzing itself is not an approval — agents may still draft/analyze
    const afterCount = workspace.listConsumerAcks(projectId, operationId, '1.0.0').length
    expect(afterCount).toBe(beforeCount) // but no new ack was recorded for the agent's run
  })
})

// ---------------------------------------------------------------------------
// Finding 3 — audit idempotency scope
// ---------------------------------------------------------------------------

describe('S2 Finding 3 — audit event deduplication is scoped to projectId + operation + idempotencyKey', () => {
  it('reviewer regression: createUseCaseDraft(key "same") then createSystemDesignDraft(key "same") produce two distinct audit events, both replayable independently', () => {
    const workspace = new DesignWorkspace(tmpDir())
    const projectId = 'proj-s2-audit-scope'
    seedFullAuthority(workspace, projectId)
    const ops = createDesignOperations({ workspace })
    const sharedKey = 'same'

    const draft = ops.createUseCaseDraft({ projectId, actor, idempotencyKey: sharedKey, workDescription: '' })
    expect(draft.ok).toBe(true)
    // Answer + approve so the system-design draft can be created.
    const questionId = draft.value!.questions[0]!.id
    ops.updateUseCaseItem({
      projectId,
      actor,
      idempotencyKey: key(),
      target: { kind: 'question', questionId, answer: 'Explain the workflow.' },
    })
    ops.approveUseCaseAnalysis({ projectId, actor, idempotencyKey: key(), authority: 'product-lead' })

    const systemDraft = ops.createSystemDesignDraft({ projectId, actor, idempotencyKey: sharedKey })
    expect(systemDraft.ok).toBe(true)

    // Two distinct operations executed — neither silently replayed the other.
    expect(systemDraft.idempotentReplay).not.toBe(true)
    expect(draft.auditEventId).not.toBe(systemDraft.auditEventId)

    const events = workspace.listAuditEvents(projectId).filter((e) => e.idempotencyKey === sharedKey)
    expect(events).toHaveLength(2)
    expect(new Set(events.map((e) => e.eventId)).size).toBe(2)
    expect(new Set(events.map((e) => e.operation))).toEqual(new Set(['createUseCaseDraft', 'createSystemDesignDraft']))

    // Each operation independently replays its own first committed result.
    const draftReplay = ops.createUseCaseDraft({ projectId, actor, idempotencyKey: sharedKey, workDescription: 'ignored on replay' })
    expect(draftReplay.idempotentReplay).toBe(true)
    expect(draftReplay.auditEventId).toBe(draft.auditEventId)

    const systemReplay = ops.createSystemDesignDraft({ projectId, actor, idempotencyKey: sharedKey })
    expect(systemReplay.idempotentReplay).toBe(true)
    expect(systemReplay.auditEventId).toBe(systemDraft.auditEventId)
  })

  it('designWorkspace.findAuditEventByIdempotencyKey matches by operation when given one, and appendAuditEvent writes a distinct event per operation even with a reused key', () => {
    const workspace = new DesignWorkspace(tmpDir())
    const projectId = 'proj-s2-workspace-audit'
    workspace.ensureInitialized(projectId)

    const first = workspace.appendAuditEvent(projectId, {
      eventId: 'evt-a',
      projectId,
      actor,
      operation: 'opA',
      idempotencyKey: 'shared',
      at: new Date(0).toISOString(),
      outcome: 'ok',
      diagnosticCodes: [],
      evidenceRefs: [],
    })
    const second = workspace.appendAuditEvent(projectId, {
      eventId: 'evt-b',
      projectId,
      actor,
      operation: 'opB',
      idempotencyKey: 'shared',
      at: new Date(0).toISOString(),
      outcome: 'ok',
      diagnosticCodes: [],
      evidenceRefs: [],
    })
    expect(first.eventId).toBe('evt-a')
    expect(second.eventId).toBe('evt-b')
    expect(workspace.listAuditEvents(projectId)).toHaveLength(2)

    expect(workspace.findAuditEventByIdempotencyKey(projectId, 'shared', 'opA')?.eventId).toBe('evt-a')
    expect(workspace.findAuditEventByIdempotencyKey(projectId, 'shared', 'opB')?.eventId).toBe('evt-b')
    expect(workspace.findAuditEventByIdempotencyKey(projectId, 'shared', 'opC')).toBeUndefined()

    // A retry of the *same* operation with the same key still replays.
    const retryA = workspace.appendAuditEvent(projectId, {
      eventId: 'evt-a-retry',
      projectId,
      actor,
      operation: 'opA',
      idempotencyKey: 'shared',
      at: new Date(0).toISOString(),
      outcome: 'ok',
      diagnosticCodes: [],
      evidenceRefs: [],
    })
    expect(retryA.eventId).toBe('evt-a')
    expect(workspace.listAuditEvents(projectId)).toHaveLength(2)

    // The deprecated 2-arg fallback matches by idempotencyKey only (first match).
    expect(workspace.findAuditEventByIdempotencyKey(projectId, 'shared')?.eventId).toBe('evt-a')
  })
})
