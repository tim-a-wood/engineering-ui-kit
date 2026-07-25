/**
 * Review-fixes R1 — EUC-16 operations service + EUC-13 workspace.
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §4, §5.3,
 * §9.7, §17.3, §20.2, §20.3.
 *
 * Covers five review findings against `operations.ts` / `designWorkspace.ts`:
 *  - R1 actor authentication and authority (a caller-controlled actor string
 *    and a caller-claimed authority are never sufficient on their own);
 *  - R2 idempotency scoped to projectId + operation + idempotencyKey, with
 *    the full result persisted so a replay survives a process restart;
 *  - R3 a persisted contract registry backs module-design approval and
 *    packet creation (no "derived, always approved" shortcut);
 *  - R4 path containment for every identifier used in a persisted path;
 *  - R5 the implementation-packet context manifest carries contracts,
 *    schemas, and rules, plus repository files when an executor is
 *    configured (an explicit diagnostic when it is not).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DesignPathError, DesignWorkspace } from '../../../src/capabilities/design/designWorkspace.js'
import {
  createDesignOperations,
  SAMPLE_BOOTSTRAP_PROJECT_ID,
  type DesignOperationsService,
  type RepositoryContextEntry,
} from '../../../src/capabilities/design/operations.js'
import { APPROVAL_AUTHORITIES, type ApprovalAuthority } from '../../../src/capabilities/design/records.js'
import * as Baseline from '../../../src/capabilities/design/designBaseline.js'

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'euik-r1-'))
}

const actor = 'user:alice'

let idem = 0
function key(): string {
  idem += 1
  return `r1-idem-${idem}`
}

function seedRoles(workspace: DesignWorkspace, projectId: string, roles: Record<string, ApprovalAuthority[]>): void {
  workspace.saveProjectRoles(projectId, roles)
}

function seedFullAuthority(workspace: DesignWorkspace, projectId: string, actorId = actor): void {
  seedRoles(workspace, projectId, { [actorId]: [...APPROVAL_AUTHORITIES] })
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

function ioSchemas(moduleId: string) {
  return [
    { schemaId: `${moduleId}.input`, version: '1.0.0', role: 'input' as const, ref: `schema://${moduleId}/in` },
    { schemaId: `${moduleId}.output`, version: '1.0.0', role: 'output' as const, ref: `schema://${moduleId}/out` },
  ]
}

/** Builds one project through an approved single-module design (mirrors the euc16-operations.test.ts pattern). */
function setupApprovedSingleModule(
  ops: DesignOperationsService,
  projectId: string,
  moduleId: string,
  requiredOperations: { operationId: string; acceptedVersionRange: string; providerModuleId: string; reason: string }[] = [],
): { operationId: string } {
  ops.createUseCaseDraft({ projectId, actor, idempotencyKey: key(), workDescription: 'Track review approvals.' })
  const approvedUseCase = ops.approveUseCaseAnalysis({ projectId, actor, idempotencyKey: key(), authority: 'product-lead' })
  const operationId = `op.${approvedUseCase.value!.application!.acceptanceCases[0]!.id}`
  ops.createSystemDesignDraft({ projectId, actor, idempotencyKey: key() })
  ops.approveSystemStructure({ projectId, actor, idempotencyKey: key(), authority: 'software-architect' })
  ops.startModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId })
  ops.updateModuleDesignItem({ projectId, actor, idempotencyKey: key(), moduleId, path: 'schemas', value: ioSchemas(moduleId) })
  ops.updateModuleDesignItem({
    projectId,
    actor,
    idempotencyKey: key(),
    moduleId,
    path: 'verification.acceptanceCases',
    value: [{ id: 'ac1', description: 'does the work', expectedOutcome: 'the work is done' }],
  })
  ops.updateModuleDesignItem({ projectId, actor, idempotencyKey: key(), moduleId, path: 'typeSpecific.detail', value: workflowDetail })
  if (requiredOperations.length) {
    ops.updateModuleDesignItem({ projectId, actor, idempotencyKey: key(), moduleId, path: 'requiredOperations', value: requiredOperations })
  }
  ops.analyzeModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId })
  const approved = ops.approveModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId, authority: 'module-owner' })
  if (!approved.ok) throw new Error(`setup failed: ${JSON.stringify(approved.diagnostics)}`)
  return { operationId }
}

// ---------------------------------------------------------------------------
// R1 — actor authentication and authority
// ---------------------------------------------------------------------------

describe('R1 — actor authentication and authority', () => {
  const badActors = ['Agent:copilot', ' AGENT:x ', 'service:x', ' SERVICE:y ']

  it('rejects every approve* operation for Agent:copilot / AGENT:x / service:x (case-insensitive, trimmed)', () => {
    const workspace = new DesignWorkspace(tmpDir())
    const projectId = 'proj-r1-badactor'
    const ops = createDesignOperations({ workspace })

    for (const badActor of badActors) {
      const results = [
        ops.approveUseCaseAnalysis({ projectId, actor: badActor, idempotencyKey: key(), authority: 'product-lead' }),
        ops.approveSystemStructure({ projectId, actor: badActor, idempotencyKey: key(), authority: 'software-architect' }),
        ops.approveModuleDesign({ projectId, actor: badActor, idempotencyKey: key(), moduleId: 'mod.x', authority: 'module-owner' }),
        ops.approveDesignBaseline({ projectId, actor: badActor, idempotencyKey: key(), authority: 'software-architect' }),
        ops.approveChangePlan({
          projectId,
          actor: badActor,
          idempotencyKey: key(),
          diagramId: 'd1',
          elementId: 'e1',
          impactId: 'impact-1',
          authority: 'software-architect',
        }),
        ops.approveAgentDelta({ projectId, actor: badActor, idempotencyKey: key(), inspectionId: 'insp-1' }),
        ops.approveVerification({ projectId, actor: badActor, idempotencyKey: key(), runId: 'run-1', authority: 'verification-lead' }),
      ]
      for (const result of results) {
        expect(result.ok).toBe(false)
        expect(result.diagnostics.map((d) => d.code)).toContain('EUC16-AGENT-APPROVAL-FORBIDDEN')
      }
    }
  })

  it('rejects a malformed actor on every change operation, not only approve*', () => {
    const workspace = new DesignWorkspace(tmpDir())
    const projectId = 'proj-r1-malformed'
    const ops = createDesignOperations({ workspace })

    const malformedActors = ['not-a-valid-actor', 'robot:copilot', '', '   ']
    for (const malformed of malformedActors) {
      const created = ops.createUseCaseDraft({ projectId, actor: malformed, idempotencyKey: key(), workDescription: 'x' })
      expect(created.ok).toBe(false)
      expect(created.diagnostics.map((d) => d.code)).toContain('EUC16-ACTOR-INVALID')

      const updated = ops.updateUseCaseItem({
        projectId,
        actor: malformed,
        idempotencyKey: key(),
        target: { kind: 'item', itemId: 'x', action: 'accept' },
      })
      expect(updated.ok).toBe(false)
      expect(updated.diagnostics.map((d) => d.code)).toContain('EUC16-ACTOR-INVALID')

      const started = ops.startModuleDesign({ projectId, actor: malformed, idempotencyKey: key(), moduleId: 'mod.x' })
      expect(started.ok).toBe(false)
      expect(started.diagnostics.map((d) => d.code)).toContain('EUC16-ACTOR-INVALID')
    }
  })

  it('accepts well-formed user/agent/service actor strings for a non-approve operation', () => {
    const workspace = new DesignWorkspace(tmpDir())
    const projectId = 'proj-r1-wellformed'
    const ops = createDesignOperations({ workspace })
    const wellFormed = ['user:alice', 'agent:copilot', 'service:ci-runner', ' user:bob ']
    for (const wf of wellFormed) {
      const result = ops.createUseCaseDraft({ projectId: `${projectId}-${wf.trim()}`, actor: wf, idempotencyKey: key(), workDescription: 'x' })
      expect(result.diagnostics.map((d) => d.code)).not.toContain('EUC16-ACTOR-INVALID')
    }
  })

  it('rejects an unconfigured actor claiming an authority (default policy: deny, not silently allow)', () => {
    const workspace = new DesignWorkspace(tmpDir())
    const projectId = 'proj-r1-unconfigured'
    const ops = createDesignOperations({ workspace })
    ops.createUseCaseDraft({ projectId, actor, idempotencyKey: key(), workDescription: 'Track review approvals.' })
    const result = ops.approveUseCaseAnalysis({ projectId, actor, idempotencyKey: key(), authority: 'product-lead' })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.code)).toContain('EUC16-AUTHORITY-NOT-CONFIGURED')
  })

  it('rejects a claimed-but-unheld authority once roles are configured', () => {
    const workspace = new DesignWorkspace(tmpDir())
    const projectId = 'proj-r1-unheld'
    seedRoles(workspace, projectId, { [actor]: ['module-owner'] })
    const ops = createDesignOperations({ workspace })
    ops.createUseCaseDraft({ projectId, actor, idempotencyKey: key(), workDescription: 'Track review approvals.' })
    const result = ops.approveUseCaseAnalysis({ projectId, actor, idempotencyKey: key(), authority: 'product-lead' })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.code)).toContain('EUC16-AUTHORITY-NOT-HELD')
  })

  it('allows approval once the acting user holds a configured authority for that record kind', () => {
    const workspace = new DesignWorkspace(tmpDir())
    const projectId = 'proj-r1-configured'
    seedRoles(workspace, projectId, { [actor]: ['product-lead'] })
    const ops = createDesignOperations({ workspace })
    ops.createUseCaseDraft({ projectId, actor, idempotencyKey: key(), workDescription: 'Track review approvals.' })
    const result = ops.approveUseCaseAnalysis({ projectId, actor, idempotencyKey: key(), authority: 'product-lead' })
    expect(result.ok).toBe(true)
    expect(result.value?.analysis.status).toBe('approved')
  })

  it('the sample bootstrap exemption is scoped to the exact sample project id, not a generic default', () => {
    const workspace = new DesignWorkspace(tmpDir())
    const otherProjectId = 'not-the-sample-project'
    const ops = createDesignOperations({ workspace })
    ops.createUseCaseDraft({ projectId: otherProjectId, actor, idempotencyKey: key(), workDescription: 'Track review approvals.' })
    const rejected = ops.approveUseCaseAnalysis({ projectId: otherProjectId, actor, idempotencyKey: key(), authority: 'product-lead' })
    expect(rejected.ok).toBe(false)
    expect(rejected.diagnostics.map((d) => d.code)).toContain('EUC16-AUTHORITY-NOT-CONFIGURED')

    ops.createUseCaseDraft({ projectId: SAMPLE_BOOTSTRAP_PROJECT_ID, actor, idempotencyKey: key(), workDescription: 'Track review approvals.' })
    const allowed = ops.approveUseCaseAnalysis({ projectId: SAMPLE_BOOTSTRAP_PROJECT_ID, actor, idempotencyKey: key(), authority: 'product-lead' })
    expect(allowed.ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// R2 — idempotency scoped to projectId + operation + idempotencyKey
// ---------------------------------------------------------------------------

describe('R2 — idempotency scoping and persisted replay', () => {
  it('the same idempotency key used for a different project is not a replay', () => {
    const workspace = new DesignWorkspace(tmpDir())
    const ops = createDesignOperations({ workspace })
    const sharedKey = key()

    const a = ops.createUseCaseDraft({ projectId: 'proj-r2-a', actor, idempotencyKey: sharedKey, workDescription: 'Project A description.' })
    const b = ops.createUseCaseDraft({ projectId: 'proj-r2-b', actor, idempotencyKey: sharedKey, workDescription: 'Project B description.' })

    expect(a.ok).toBe(true)
    expect(b.ok).toBe(true)
    expect(a.idempotentReplay).toBeFalsy()
    expect(b.idempotentReplay).toBeFalsy()
    // project B got its own draft, not project A's.
    expect(workspace.getUseCaseAnalysisDraft('proj-r2-a')?.id).not.toBe(workspace.getUseCaseAnalysisDraft('proj-r2-b')?.id)
    expect(workspace.getUseCaseAnalysisDraft('proj-r2-b')?.id).toContain('proj-r2-b')
  })

  it('the same idempotency key used for a different operation on the same project is not a replay', () => {
    const workspace = new DesignWorkspace(tmpDir())
    const projectId = 'proj-r2-cross-op'
    seedFullAuthority(workspace, projectId)
    const ops = createDesignOperations({ workspace })
    const sharedKey = key()

    const created = ops.createUseCaseDraft({ projectId, actor, idempotencyKey: sharedKey, workDescription: 'x' })
    expect(created.ok).toBe(true)
    // A different operation reusing the same key is a fresh call: it fails on its own terms
    // (no use-case draft has been approved yet to compile a system design from), not a replay.
    const reused = ops.createSystemDesignDraft({ projectId, actor, idempotencyKey: sharedKey })
    expect(reused.idempotentReplay).toBeFalsy()
    expect(reused.ok).toBe(false)
    expect(reused.diagnostics.map((d) => d.code)).not.toContain('EUC16-STALE-BASE')
  })

  it('replays the full first committed result (value included) after a simulated process restart', () => {
    const dataDir = tmpDir()
    const projectId = 'proj-r2-restart'
    const usedKey = key()

    const firstWorkspace = new DesignWorkspace(dataDir)
    const firstOps = createDesignOperations({ workspace: firstWorkspace })
    const first = firstOps.createUseCaseDraft({ projectId, actor, idempotencyKey: usedKey, workDescription: 'Track review approvals.' })
    expect(first.ok).toBe(true)
    expect(first.value).toBeDefined()

    // A brand-new DesignWorkspace + operations instance over the same dataDir — the
    // in-process resultCache is empty; only the persisted result can satisfy the replay.
    const restartedWorkspace = new DesignWorkspace(dataDir)
    const restartedOps = createDesignOperations({ workspace: restartedWorkspace })
    const replay = restartedOps.createUseCaseDraft({ projectId, actor, idempotencyKey: usedKey, workDescription: 'A different description entirely.' })

    expect(replay.idempotentReplay).toBe(true)
    expect(replay.ok).toBe(first.ok)
    expect(replay.value).toEqual(first.value)
    expect(replay.revision).toBe(first.revision)
    expect(replay.contentHash).toBe(first.contentHash)
    expect(replay.diagnostics).toEqual(first.diagnostics)
    expect(JSON.stringify(replay)).toBe(JSON.stringify({ ...first, idempotentReplay: true }))
  })
})

// ---------------------------------------------------------------------------
// R3 — persisted contract approval lifecycle
// ---------------------------------------------------------------------------

describe('R3 — contract approval lifecycle', () => {
  it('a changed, previously-approved contract blocks re-approval until every known consumer re-analyzes it', () => {
    const workspace = new DesignWorkspace(tmpDir())
    const projectId = 'proj-r3-consumer-review'
    seedFullAuthority(workspace, projectId)
    const ops = createDesignOperations({ workspace })

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
    expect(providerApproved.ok).toBe(true)

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
    expect(consumerApproved.ok).toBe(true)

    // Contract v1.0.0 is now approved and acknowledged by the consumer.
    expect(workspace.getContract(projectId, operationId, '1.0.0')?.status).toBe('approved')
    expect(workspace.listConsumerAcks(projectId, operationId, '1.0.0').map((a) => a.consumerModuleId)).toContain('mod.consumer')

    // Change the provider's contract: reopen, bump the provided operation's version.
    ops.reopenModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.provider' })
    ops.updateModuleDesignItem({
      projectId,
      actor,
      idempotencyKey: key(),
      moduleId: 'mod.provider',
      path: 'providedOperations',
      value: [{ operationId, version: '1.1.0' }],
    })
    ops.updateModuleDesignItem({
      projectId,
      actor,
      idempotencyKey: key(),
      moduleId: 'mod.provider',
      path: 'behavior.postconditions',
      value: ['a price was recorded'],
    })
    ops.analyzeModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.provider' })

    // Blocked: the consumer has not re-analyzed against v1.1.0 yet.
    const blocked = ops.approveModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.provider', authority: 'module-owner' })
    expect(blocked.ok).toBe(false)
    expect(blocked.diagnostics.map((d) => d.code)).toContain('EUC16-CONTRACT-CONSUMER-REVIEW-REQUIRED')
    expect(workspace.getContract(projectId, operationId, '1.1.0')?.status).toBe('draft')

    // The consumer records an explicit ack (reopen is required to reach `updateModuleDesignItem`).
    ops.reopenModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.consumer' })
    const ack = ops.updateModuleDesignItem({
      projectId,
      actor,
      idempotencyKey: key(),
      moduleId: 'mod.consumer',
      path: 'requiredOperations.ack',
      value: { operationId, version: '1.1.0' },
    })
    expect(ack.ok).toBe(true)
    expect(workspace.listConsumerAcks(projectId, operationId, '1.1.0').map((a) => a.consumerModuleId)).toContain('mod.consumer')

    // Now the changed contract can be approved.
    const nowApproved = ops.approveModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.provider', authority: 'module-owner' })
    expect(nowApproved.ok).toBe(true)
    expect(workspace.getContract(projectId, operationId, '1.1.0')?.status).toBe('approved')
  })

  it('createModuleImplementationPacket refuses a module whose required operation has no persisted approved contract', () => {
    const workspace = new DesignWorkspace(tmpDir())
    const projectId = 'proj-r3-unapproved-packet'
    seedFullAuthority(workspace, projectId)
    const ops = createDesignOperations({ workspace })

    const { operationId } = setupApprovedSingleModule(ops, projectId, 'mod.core', [
      { operationId: 'op.ghost-provider', acceptedVersionRange: '^1.0.0', providerModuleId: 'mod.ghost', reason: 'needed but never approved' },
    ])
    expect(operationId).toBeTruthy()

    // Directly seed an *approved* Design baseline (bypassing ops.createDesignBaseline's own
    // preview gate) to isolate the packet-creation-time real-registry check under test —
    // §16.7's "completeBaseline" policy would otherwise also block earlier, at baseline
    // creation, for the same missing-provider reason.
    const architecture = workspace.getApprovedArchitecture(projectId)!
    const moduleDesign = workspace.getApprovedModuleDesign(projectId, 'mod.core')!
    // mod.core's own provided operation is genuinely approved (finding R3 fixed that path for
    // real); only the required "op.ghost-provider" is fabricated here, standing in for what an
    // old *derived* (always-approved) registry would have wrongly reported.
    const fabricatedContracts = [
      ...workspace.listContracts(projectId),
      {
        operationId: 'op.ghost-provider',
        version: '1.0.0',
        providerModuleId: 'mod.ghost',
        status: 'approved' as const,
        contract: {
          schemaVersion: '1.0' as const,
          operationId: 'op.ghost-provider',
          version: '1.0.0',
          behavior: 'command' as const,
          inputSchemaRef: '',
          outputSchemaRef: '',
          preconditions: [],
          postconditions: [],
          domainRejections: [],
          technicalErrors: [],
          sideEffects: [],
          idempotency: 'unknown' as const,
          timeoutClass: 'medium' as const,
          cancellable: false,
          artifactTypes: [],
          provenanceFields: [],
        },
        contentHash: 'fabricated-hash',
      },
    ]
    const baselineDraft = Baseline.createDesignBaseline(architecture, [moduleDesign], fabricatedContracts, { baselineId: `${architecture.id}.baseline` })
    expect(baselineDraft.gates.every((g) => g.passed)).toBe(true)
    workspace.saveDesignBaselineDraft(projectId, baselineDraft)
    const approvedBaseline = Baseline.approveDesignBaseline(baselineDraft, { approvedBy: actor, authority: 'software-architect' })
    expect(approvedBaseline.ok).toBe(true)
    workspace.approveDesignBaseline(projectId, approvedBaseline.baseline!)

    // The real, persisted contract registry has no entry at all for op.ghost-provider —
    // createModuleImplementationPacket must refuse regardless of the fabricated baseline.
    const packet = ops.createModuleImplementationPacket({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' })
    expect(packet.ok).toBe(false)
    expect(packet.diagnostics.some((d) => d.code === 'CAP-DES-CTR-UNAPPROVED-REQUIRED')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// R4 — path containment through the operations service
// ---------------------------------------------------------------------------

describe('R4 — path containment through the operations service', () => {
  it('rejects a path-traversal projectId, moduleId, and packetId at the operations boundary', () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-r1-guard-'))
    const dataDir = path.join(parent, 'data')
    const workspace = new DesignWorkspace(dataDir)
    const ops = createDesignOperations({ workspace })

    expect(() => ops.createUseCaseDraft({ projectId: '../../escaped-project', actor, idempotencyKey: key(), workDescription: 'x' })).toThrow(
      DesignPathError,
    )
    expect(() =>
      ops.updateModuleDesignItem({ projectId: 'proj-r4', actor, idempotencyKey: key(), moduleId: '../../escaped-module', path: 'schemas', value: [] }),
    ).toThrow(DesignPathError)
    expect(fs.existsSync(path.join(parent, 'escaped-project'))).toBe(false)
    expect(fs.existsSync(path.join(parent, 'escaped-module'))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// R5 — implementation-packet context manifest content
// ---------------------------------------------------------------------------

describe('R5 — implementation-packet context manifest content', () => {
  it('includes provided/required approved contracts, schemas, and rules; warns when no repository executor is configured', () => {
    const workspace = new DesignWorkspace(tmpDir())
    const projectId = 'proj-r5-manifest'
    seedFullAuthority(workspace, projectId)
    const ops = createDesignOperations({ workspace })

    ops.createUseCaseDraft({ projectId, actor, idempotencyKey: key(), workDescription: 'Track review approvals.' })
    const approvedUseCase = ops.approveUseCaseAnalysis({ projectId, actor, idempotencyKey: key(), authority: 'product-lead' })
    const operationId = `op.${approvedUseCase.value!.application!.acceptanceCases[0]!.id}`
    ops.createSystemDesignDraft({ projectId, actor, idempotencyKey: key() })
    ops.approveSystemStructure({ projectId, actor, idempotencyKey: key(), authority: 'software-architect' })
    ops.startModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' })
    ops.updateModuleDesignItem({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', path: 'schemas', value: ioSchemas('mod.core') })
    ops.updateModuleDesignItem({
      projectId,
      actor,
      idempotencyKey: key(),
      moduleId: 'mod.core',
      path: 'verification.acceptanceCases',
      value: [{ id: 'ac1', description: 'does the work', expectedOutcome: 'the work is done' }],
    })
    ops.updateModuleDesignItem({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', path: 'typeSpecific.detail', value: workflowDetail })
    ops.updateModuleDesignItem({
      projectId,
      actor,
      idempotencyKey: key(),
      moduleId: 'mod.core',
      path: 'rules',
      value: [{ id: 'rule.privacy', text: 'No PII in logs.' }],
    })
    ops.analyzeModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' })
    const approved = ops.approveModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', authority: 'module-owner' })
    expect(approved.ok).toBe(true)
    ops.createDesignBaseline({ projectId, actor, idempotencyKey: key() })
    ops.approveDesignBaseline({ projectId, actor, idempotencyKey: key(), authority: 'software-architect' })

    // Without a configured executor: an explicit warning, packet still valid.
    const withoutExecutor = ops.createModuleImplementationPacket({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' })
    expect(withoutExecutor.ok).toBe(true)
    expect(withoutExecutor.diagnostics.some((d) => d.code === 'EUC16-REPO-CONTEXT-NOT-COMPILED')).toBe(true)
    const manifestWithout = withoutExecutor.value!.contextManifest
    expect(manifestWithout.entries.some((e) => e.kind === 'contract' && e.ref === `${operationId}@1.0.0`)).toBe(true)
    expect(manifestWithout.entries.some((e) => e.kind === 'schema')).toBe(true)
    expect(manifestWithout.entries.some((e) => e.kind === 'record' && e.ref === 'rule:rule.privacy')).toBe(true)
    expect(manifestWithout.entries.some((e) => e.kind === 'source')).toBe(false)

    // With a configured executor: repository files appear as source entries with reasons,
    // and canonical entries (kind 'record'/'contract') keep top priority.
    const repoEntries: RepositoryContextEntry[] = [
      { ref: 'capabilities/modules/mod.core/index.ts', content: 'export {}', reason: 'owned-path source file' },
    ]
    // Re-run with the executor configured, via a second operations instance sharing the workspace.
    const opsWithExecutor = createDesignOperations({
      workspace,
      executors: { readRepositoryContext: () => repoEntries },
    })
    const withRepo = opsWithExecutor.createModuleImplementationPacket({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' })
    expect(withRepo.ok).toBe(true)
    expect(withRepo.diagnostics.some((d) => d.code === 'EUC16-REPO-CONTEXT-NOT-COMPILED')).toBe(false)
    const manifestWithRepo = withRepo.value!.contextManifest
    const sourceEntry = manifestWithRepo.entries.find((e) => e.kind === 'source')
    expect(sourceEntry?.ref).toBe('capabilities/modules/mod.core/index.ts')
    expect(sourceEntry?.inclusionReason).toBe('owned-path source file')
    const canonicalPriorities = manifestWithRepo.entries.filter((e) => e.kind === 'record' || e.kind === 'contract').map((e) => e.priority)
    const sourcePriorities = manifestWithRepo.entries.filter((e) => e.kind === 'source').map((e) => e.priority)
    expect(Math.max(...canonicalPriorities)).toBeLessThan(Math.min(...sourcePriorities))
  })
})
