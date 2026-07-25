/**
 * EUC-16 — Core application-operations service.
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §5.3, §6,
 * §17 (all), §19, §20.3, §25.3 (EUC-13..17).
 *
 * "The interface and machine API shall call the same application
 * operations" (§17). This module is that one service: the desktop IPC
 * adapter, the CLI, and the machine API all call `createDesignOperations`
 * and dispatch to the same functions. It owns no new record shapes — every
 * change delegates to the already-committed core modules
 * (`useCaseAnalysis.ts`, `applicationCompiler.ts`, `systemDesign.ts`,
 * `moduleDesign.ts`, `moduleDesignSession.ts`, `moduleDesignCompilers.ts`,
 * `designBaseline.ts`, `impactEngine.ts`, `verificationPlanner.ts`,
 * `contextPacket.ts`, `deltaInspector.ts`) and persists through
 * `DesignWorkspace` (EUC-13).
 *
 * §17.3 controls are applied uniformly by `executeChange`, a wrapper used by
 * every §17.2 change operation: it requires an idempotency key, accepts and
 * checks an expected base revision/hash, validates authorization (an agent
 * actor is rejected for every `approve*` operation — §4, §20.2 "no approval
 * shortcut for agents"), replays the first committed result for a repeated
 * idempotency key, writes a `DesignAuditEvent`, and returns valid next
 * actions computed from the same gate functions the operations themselves
 * call (so the interface never shows an action the service will reject).
 *
 * Diagram operations (proposeVisualChange/analyzeVisualChange/
 * approveChangePlan) intentionally do not import `diagramSemantics.ts` or
 * `diagramLayout.ts` — those are owned by a concurrently edited packet.
 * Diagram projection/layout is a pluggable seam: this module records the
 * discussion entries and the pre-change impact analysis (§10 "Analyze
 * impact before applying a visual or structural change"); rendering a
 * `DiagramProjection`/`DiagramLayout` from those records is an adapter
 * concern. Provider dispatch (Copilot/local/deterministic) also happens in
 * adapters — `providers.ts` is not imported here.
 *
 * Executor-backed operations (`verifyModule`, `configureBinding`,
 * `verifyConnection`, `runScenario`, and the file-apply half of
 * `applyAgentDelta`) accept pluggable `deps.executors`. Without a configured
 * executor these operations return an honest 'not-configured' diagnostic —
 * they never fake success (§19 "the product shall never replace the last
 * valid approved snapshot with an invalid candidate").
 */

import crypto from 'node:crypto'
import { canonicalHash } from '../hash.js'
import { buildCapabilityGraph, detectCycles, type CapabilityGraph } from '../graph.js'
import type { CapDiagnostic } from '../diagnostics.js'
import type { ApplicationSpecification, ArchitectureSpecification, ModuleType } from '../types.js'
import { stableSortBy } from './identity.js'
import { DesignWorkspace, type ConsumerContractAck } from './designWorkspace.js'
import {
  type ApprovalAuthority,
  type DeltaApplyPlan,
  type DeltaApplyResult,
  type DeltaInspection,
  type DesignApproval,
  type DesignAuditEvent,
  type DesignBaseline,
  type DesignChangeKind,
  type DesignDiagnostic,
  type DesignImpactRecord,
  type DesignOperationResult,
  type DesignWorkflowPolicy,
  type DiagramDiscussionEntry,
  type GateResult,
  type ImplementationWavePlan,
  type ModuleDesignSession,
  type ModuleDesignSpecification,
  type ModuleDesignStep,
  type ModuleImplementationPacket,
  type ReturnedDelta,
  type ScenarioRun,
  type ScenarioStepEvidence,
  type UseCaseAnalysis,
  type ValidNextAction,
} from './records.js'
import * as UseCase from './useCaseAnalysis.js'
import { compileApplication } from './applicationCompiler.js'
import * as SystemDesign from './systemDesign.js'
import * as ModuleDesign from './moduleDesign.js'
import * as Session from './moduleDesignSession.js'
import { compileOperationContracts } from './moduleDesignCompilers.js'
import * as Baseline from './designBaseline.js'
import * as Impact from './impactEngine.js'
import * as VerificationPlanner from './verificationPlanner.js'
import * as ContextPacket from './contextPacket.js'
import * as DeltaInspector from './deltaInspector.js'
import {
  approveContract as approveRegisteredContract,
  consumerReviewRequirements,
  registerContract,
  type RegisteredContract,
} from './contractRegistry.js'

// ---------------------------------------------------------------------------
// Shared input/diagnostic helpers
// ---------------------------------------------------------------------------

/** §17.2 — every change operation input shape extends this. */
export type ChangeOperationInput = {
  actor: string
  idempotencyKey?: string
  expectedBaseRevision?: string
  expectedBaseHash?: string
  /**
   * §17.3 "accept a deadline for provider or process work". Pure in-process
   * operations here complete well under one second and do not read this;
   * it is threaded through to executor-backed operations
   * (verifyModule/configureBinding/verifyConnection/runScenario/
   * applyAgentDelta's file-apply step).
   */
  deadlineAt?: string
  /** §17.3 "support cancellation"; threaded through to executor-backed operations only. */
  cancellationRequested?: boolean
}

function makeDiagnostic(
  code: string,
  severity: DesignDiagnostic['severity'],
  message: string,
  target?: string,
  relatedIds?: string[],
): DesignDiagnostic {
  return {
    id: target ? `${code}:${target}` : code,
    code,
    severity,
    message,
    ...(relatedIds && relatedIds.length ? { relatedIds } : {}),
    ...(target ? { target } : {}),
  }
}

/** §5.3 "reject a stale base" with a stable diagnostic code. */
function checkExpectedBase(
  actualRevision: string | undefined,
  actualHash: string | undefined,
  input: { expectedBaseRevision?: string; expectedBaseHash?: string },
): DesignDiagnostic | undefined {
  if (input.expectedBaseRevision !== undefined && input.expectedBaseRevision !== actualRevision) {
    return makeDiagnostic(
      'EUC16-STALE-BASE',
      'blocker',
      `expected base revision ${input.expectedBaseRevision} but found ${actualRevision ?? '(none)'}`,
      'expectedBaseRevision',
    )
  }
  if (input.expectedBaseHash !== undefined && input.expectedBaseHash !== actualHash) {
    return makeDiagnostic(
      'EUC16-STALE-BASE',
      'blocker',
      `expected base hash ${input.expectedBaseHash} but found ${actualHash ?? '(none)'}`,
      'expectedBaseHash',
    )
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Actor authentication and authority (§4, §20.2, §20.3, finding R1)
//
// An actor is not authenticated by this service (that happens upstream, at
// the IPC/CLI/API boundary); this gate only refuses a change operation whose
// `actor` string does not have the required shape, and refuses to treat any
// claimed `authority` as sufficient on its own. Detection of an `agent:` or
// `service:` actor is case-insensitive and trims surrounding whitespace, so
// `'Agent:copilot'` and `' AGENT:x '` are both recognized and rejected for
// every approve* operation — the same operations the API must never expose
// as an "approval shortcut for agents" (§17.3).
// ---------------------------------------------------------------------------

/** `kind:id` after trim; kind is `user`, `agent`, or `service` (case-insensitive). */
const ACTOR_FORMAT = /^(user|agent|service):\S+$/i

type ActorKind = 'user' | 'agent' | 'service'

function actorKind(actor: string): ActorKind | undefined {
  const match = ACTOR_FORMAT.exec(actor.trim())
  return match ? (match[1]!.toLowerCase() as ActorKind) : undefined
}

/**
 * §4 table — the authorities that may approve each record kind. Every
 * approve* operation is keyed here; an operation absent from this map is not
 * an approval and is not subject to the authority check.
 */
/**
 * Sample bootstrap only. The bundled DO-178C Audit Hub sample project ships
 * with no `projectRoles` configuration (it is a read-only demo fixture, not
 * a real project with a real role assignment). Rather than silently
 * accepting a caller-asserted authority for *every* unconfigured project
 * (which finding R1 forbids), the default-deny rule below carves out this
 * one hard-coded project id: an approval against this exact project id is
 * exempt from `EUC16-AUTHORITY-NOT-CONFIGURED` only when the project has no
 * `projectRoles` record at all. A real project — including one that reuses
 * this id after `saveProjectRoles` has ever been called — is unaffected.
 * Agent and service actors are still rejected before this check runs.
 */
export const SAMPLE_BOOTSTRAP_PROJECT_ID = 'sample-do178c-audit-hub'

const APPROVE_OPERATION_AUTHORITIES: Record<string, readonly ApprovalAuthority[]> = {
  approveUseCaseAnalysis: ['product-lead'],
  approveSystemStructure: ['software-architect'],
  approveModuleDesign: ['module-owner', 'software-architect'],
  approveDesignBaseline: ['software-architect'],
  approveChangePlan: ['software-architect', 'module-owner', 'interface-engineer', 'integration-engineer', 'verification-lead'],
  approveAgentDelta: ['module-owner', 'software-architect'],
  approveVerification: ['verification-lead'],
}

/**
 * §4 "authority must not be caller-asserted alone" — checks the acting
 * user's *configured* `projectRoles` (never the request's own claim) against
 * the authorities allowed for `operation`. Default policy when no role is
 * configured for this actor: reject (`EUC16-AUTHORITY-NOT-CONFIGURED`) — an
 * unrecognized actor claiming an authority is never silently allowed.
 */
function checkApprovalAuthority(
  workspace: DesignWorkspace,
  projectId: string,
  operation: string,
  actor: string,
  claimedAuthority: ApprovalAuthority | undefined,
): DesignDiagnostic | undefined {
  const required = APPROVE_OPERATION_AUTHORITIES[operation]
  if (!required) return undefined

  const roles = workspace.getProjectRoles(projectId)
  if (roles === undefined && projectId === SAMPLE_BOOTSTRAP_PROJECT_ID) return undefined
  const held = roles?.[actor] ?? []

  if (held.length === 0) {
    return makeDiagnostic(
      'EUC16-AUTHORITY-NOT-CONFIGURED',
      'blocker',
      `no project role is configured for actor ${actor}; an approval requires a configured authority, not a caller-asserted one`,
      'actor',
      [actor],
    )
  }
  if (claimedAuthority !== undefined && !required.includes(claimedAuthority)) {
    return makeDiagnostic(
      'EUC16-AUTHORITY-NOT-APPLICABLE',
      'blocker',
      `authority "${claimedAuthority}" is not applicable to ${operation}; expected one of: ${required.join(', ')}`,
      'authority',
      [claimedAuthority],
    )
  }
  if (claimedAuthority !== undefined) {
    if (!held.includes(claimedAuthority)) {
      return makeDiagnostic(
        'EUC16-AUTHORITY-NOT-HELD',
        'blocker',
        `actor ${actor} does not hold the claimed authority "${claimedAuthority}"`,
        'authority',
        [actor, claimedAuthority],
      )
    }
    return undefined
  }
  if (!held.some((authority) => required.includes(authority))) {
    return makeDiagnostic(
      'EUC16-AUTHORITY-NOT-HELD',
      'blocker',
      `actor ${actor} does not hold an authority required for ${operation} (expected one of: ${required.join(', ')})`,
      'actor',
      [actor],
    )
  }
  return undefined
}

/** §5.3 / §17.3 (finding R2) — an idempotency key is scoped to one project and one operation. */
function operationResultCacheKey(projectId: string, operation: string, idempotencyKey: string): string {
  return JSON.stringify([projectId, operation, idempotencyKey])
}

function summarize(messages: string[]): string {
  return messages.slice(0, 3).join('; ') || 'blocked'
}

function summarizeCapDiagnostics(diagnostics: CapDiagnostic[]): string {
  return summarize(diagnostics.map((d) => d.message))
}

function summarizeGates(gates: GateResult[]): string {
  return summarizeCapDiagnostics(gates.flatMap((g) => g.diagnostics))
}

function summarizeDesignDiagnostics(diagnostics: DesignDiagnostic[]): string {
  return summarize(diagnostics.filter((d) => d.severity === 'blocker').map((d) => d.message))
}

function action(
  operation: string,
  label: string,
  enabled: boolean,
  opts: { targetId?: string; blockedReason?: string } = {},
): ValidNextAction {
  return {
    operation,
    label,
    enabled,
    ...(opts.targetId ? { targetId: opts.targetId } : {}),
    ...(!enabled && opts.blockedReason ? { blockedReason: opts.blockedReason } : {}),
  }
}

// ---------------------------------------------------------------------------
// Derived contract view (EUC-16 note — see final packet message: no §17.2
// operation registers/approves a standalone contract, and DesignWorkspace
// has no contract-registry persistence. This service derives an "approved
// contracts" view from `contentHash`-stamped provided operations on
// approved (or, for cross-module checks, in-review) module designs, and
// `analyzeModuleDesign` stamps that hash from the compiled skeleton
// contract. This is a pragmatic EUC-16-local substitute for a persisted
// EUC-05 registry — see contract-change request in the final message.)
// ---------------------------------------------------------------------------

function deriveOperations(application: ApplicationSpecification): { operationId: string }[] {
  return stableSortBy(application.acceptanceCases, (c) => c.id).map((c) => ({ operationId: `op.${c.id}` }))
}

function stampProvidedOperationHashes(design: ModuleDesignSpecification): ModuleDesignSpecification {
  const compiled = compileOperationContracts(design)
  const providedOperations = design.providedOperations.map((op) => {
    if (op.contentHash) return op
    const contract = compiled.find((c) => c.operationId === op.operationId && c.version === op.version)
    if (!contract) return op
    return { ...op, contentHash: canonicalHash(contract) }
  })
  return { ...design, providedOperations }
}

function deriveContractRegistry(designs: ModuleDesignSpecification[]): RegisteredContract[] {
  const list: RegisteredContract[] = []
  for (const design of designs) {
    const compiled = compileOperationContracts(design)
    for (const op of design.providedOperations) {
      if (!op.contentHash) continue
      const contract = compiled.find((c) => c.operationId === op.operationId && c.version === op.version)
      if (!contract) continue
      list.push({
        operationId: op.operationId,
        version: op.version,
        providerModuleId: design.module.moduleId,
        status: 'approved',
        contract,
        contentHash: op.contentHash,
      })
    }
  }
  return list
}

// ---------------------------------------------------------------------------
// Persisted contract lifecycle (§9.7, finding R3) — registers a draft
// `RegisteredContract` for every provided operation on `analyzeModuleDesign`,
// records a consumer acknowledgement when a module with a matching required
// operation is (re-)analyzed, blocks re-approval of a changed contract until
// every known consumer has acknowledged the new version, and approves the
// provider's own contracts alongside its module-design approval (the same
// authorized approver satisfies "the provider ... shall review").
// `deriveContractRegistry` above remains a lightweight *preview* used only
// for wave-planning and the enabled/disabled hint on `getValidNextActions`;
// every place that actually blocks a change (packet creation, re-approval of
// a changed contract) reads this persisted registry instead.
// ---------------------------------------------------------------------------

function registerProvidedContractDrafts(
  workspace: DesignWorkspace,
  projectId: string,
  design: ModuleDesignSpecification,
): CapDiagnostic[] {
  const diagnostics: CapDiagnostic[] = []
  const compiled = compileOperationContracts(design)
  let contracts = workspace.listContracts(projectId)
  for (const op of design.providedOperations) {
    const contract = compiled.find((c) => c.operationId === op.operationId && c.version === op.version)
    if (!contract) continue
    const result = registerContract(
      { contracts },
      { operationId: op.operationId, version: op.version, providerModuleId: design.module.moduleId, contract },
    )
    if (!result.ok || !result.contract) {
      diagnostics.push(...result.diagnostics)
      continue
    }
    if (result.contract.status === 'draft') {
      workspace.saveContract(projectId, result.contract)
    }
    contracts = result.registry?.contracts ?? contracts
  }
  return diagnostics
}

function recordConsumerAcksForRequiredOperations(
  workspace: DesignWorkspace,
  projectId: string,
  design: ModuleDesignSpecification,
  at: string,
): void {
  const contracts = workspace.listContracts(projectId)
  for (const required of design.requiredOperations) {
    for (const contract of contracts.filter((c) => c.operationId === required.operationId)) {
      const ack: ConsumerContractAck = {
        operationId: contract.operationId,
        version: contract.version,
        consumerModuleId: design.module.moduleId,
        ackedAt: at,
        source: 'analyze',
      }
      workspace.saveConsumerAck(projectId, ack)
    }
  }
}

/**
 * §9.7 "The provider and every known consumer shall review a changed
 * contract" — a provided operation whose compiled contract differs from an
 * already-*approved* version of the same operationId (a different version
 * string with different content) may not be approved until every known
 * consumer (a module whose `requiredOperations` references the operationId)
 * has acknowledged the new version, either by an `analyzeModuleDesign` run
 * that observed it or an explicit ack.
 */
function findBlockedContractApprovals(
  workspace: DesignWorkspace,
  projectId: string,
  design: ModuleDesignSpecification,
  otherDesigns: ModuleDesignSpecification[],
): DesignDiagnostic[] {
  const diagnostics: DesignDiagnostic[] = []
  const compiled = compileOperationContracts(design)
  const allContracts = workspace.listContracts(projectId)
  for (const op of design.providedOperations) {
    const newContract = compiled.find((c) => c.operationId === op.operationId && c.version === op.version)
    if (!newContract) continue
    const priorApproved = allContracts.filter(
      (c) => c.operationId === op.operationId && c.status === 'approved' && c.version !== op.version,
    )
    if (!priorApproved.length) continue
    const changed = priorApproved.some((c) => canonicalHash(c.contract) !== canonicalHash(newContract))
    if (!changed) continue
    const requirements = consumerReviewRequirements(
      { operationId: op.operationId, providerModuleId: design.module.moduleId },
      { moduleDesigns: [...otherDesigns, design] },
    )
    const consumerModuleIds = requirements.filter((r) => r.role === 'consumer').map((r) => r.moduleId)
    if (!consumerModuleIds.length) continue
    const acked = new Set(workspace.listConsumerAcks(projectId, op.operationId, op.version).map((a) => a.consumerModuleId))
    const missing = consumerModuleIds.filter((id) => !acked.has(id))
    if (missing.length) {
      diagnostics.push(
        makeDiagnostic(
          'EUC16-CONTRACT-CONSUMER-REVIEW-REQUIRED',
          'blocker',
          `contract ${op.operationId}@${op.version} changed from an approved version; these consumers have not re-analyzed against it: ${missing.join(', ')}`,
          'providedOperations',
          missing,
        ),
      )
    }
  }
  return diagnostics
}

/** Approves the provider's own contracts alongside its module-design approval (§9.7 "provider ... review"). */
function approveProvidedContracts(
  workspace: DesignWorkspace,
  projectId: string,
  design: ModuleDesignSpecification,
  approval: { approvedBy: string; authority: string; approvedAt: string },
): void {
  const compiled = compileOperationContracts(design)
  let contracts = workspace.listContracts(projectId)
  for (const op of design.providedOperations) {
    const contract = compiled.find((c) => c.operationId === op.operationId && c.version === op.version)
    if (!contract) continue
    let registered = contracts.find((c) => c.operationId === op.operationId && c.version === op.version)
    if (!registered) {
      const registerResult = registerContract(
        { contracts },
        { operationId: op.operationId, version: op.version, providerModuleId: design.module.moduleId, contract },
      )
      if (!registerResult.ok || !registerResult.contract) continue
      registered = registerResult.contract
      contracts = registerResult.registry?.contracts ?? contracts
      workspace.saveContract(projectId, registered)
    }
    if (registered.status === 'approved') continue
    const approveResult = approveRegisteredContract({ contracts }, op.operationId, op.version, approval)
    if (!approveResult.ok || !approveResult.contract) continue
    workspace.saveContract(projectId, approveResult.contract)
    contracts = approveResult.registry?.contracts ?? contracts
  }
}

function collectOtherModuleDesigns(
  workspace: DesignWorkspace,
  projectId: string,
  moduleId: string,
): ModuleDesignSpecification[] {
  const ids = workspace.listModuleIds(projectId).filter((id) => id !== moduleId)
  const result: ModuleDesignSpecification[] = []
  for (const id of ids) {
    const approved = workspace.getApprovedModuleDesign(projectId, id)
    if (approved) {
      result.push(approved)
      continue
    }
    const draft = workspace.getModuleDesignDraft(projectId, id)
    if (draft) result.push(draft)
  }
  return result
}

function collectApprovedDesigns(
  workspace: DesignWorkspace,
  projectId: string,
  architecture: ArchitectureSpecification,
): ModuleDesignSpecification[] {
  return architecture.moduleIds
    .map((id) => workspace.getApprovedModuleDesign(projectId, id))
    .filter((d): d is ModuleDesignSpecification => Boolean(d))
}

// ---------------------------------------------------------------------------
// Implementation waves (§11.8) — planning only; `autoDispatch` is always false.
// ---------------------------------------------------------------------------

function computeImplementationWaves(
  projectId: string,
  architecture: ArchitectureSpecification,
  approvedDesigns: ModuleDesignSpecification[],
): ImplementationWavePlan {
  const approvedIds = new Set(approvedDesigns.map((d) => d.module.moduleId))
  const subGraph: CapabilityGraph = {
    nodes: architecture.moduleIds.filter((id) => approvedIds.has(id)).map((id) => ({ id })),
    edges: architecture.dependencyEdges
      .filter((e) => approvedIds.has(e.fromModuleId) && approvedIds.has(e.toModuleId))
      .map((e) => ({ from: e.fromModuleId, to: e.toModuleId, reason: e.reason })),
  }
  const cycles = detectCycles(subGraph)
  const cycleModuleIds = new Set(cycles.flat())
  const dependenciesOf = new Map<string, string[]>()
  for (const node of subGraph.nodes) dependenciesOf.set(node.id, [])
  for (const edge of subGraph.edges) dependenciesOf.get(edge.from)?.push(edge.to)

  const level = new Map<string, number>()
  function computeLevel(id: string, seen: Set<string>): number {
    if (cycleModuleIds.has(id)) return 0
    const existing = level.get(id)
    if (existing !== undefined) return existing
    if (seen.has(id)) return 0
    const nextSeen = new Set(seen)
    nextSeen.add(id)
    const deps = (dependenciesOf.get(id) ?? []).filter((d) => !cycleModuleIds.has(d))
    const depLevels = deps.map((d) => computeLevel(d, nextSeen))
    const lvl = depLevels.length ? Math.max(...depLevels) + 1 : 1
    level.set(id, lvl)
    return lvl
  }
  for (const node of subGraph.nodes) computeLevel(node.id, new Set())

  const registry = deriveContractRegistry(approvedDesigns)
  const byModuleId = new Map(approvedDesigns.map((d) => [d.module.moduleId, d]))
  const maxLevel = Math.max(0, ...[...level.values()])
  const waves: ImplementationWavePlan['waves'] = []
  for (let w = 1; w <= maxLevel; w++) {
    const idsAtLevel = [...level.entries()]
      .filter(([, lvl]) => lvl === w)
      .map(([id]) => id)
      .sort((a, b) => a.localeCompare(b))
    const modules = idsAtLevel.map((id) => {
      const design = byModuleId.get(id)!
      const blockingUnapprovedContracts = design.providedOperations
        .filter((op) => !registry.some((c) => c.operationId === op.operationId && c.version === op.version && c.status === 'approved'))
        .map((op) => `${op.operationId}@${op.version}`)
      return {
        moduleId: id,
        directDependencyIds: design.boundary.directDependencyIds,
        allowedPaths: design.boundary.ownedPaths,
        sharedResources: design.boundary.editableSharedPaths,
        batchEligible: blockingUnapprovedContracts.length === 0,
        blockingUnapprovedContracts,
      }
    })
    waves.push({ wave: w, modules, blockingCycles: w === 1 ? cycles : [] })
  }
  if (maxLevel === 0 && cycles.length) {
    waves.push({ wave: 1, modules: [], blockingCycles: cycles })
  }
  return { projectId, architectureRevision: architecture.revision, waves, autoDispatch: false }
}

// ---------------------------------------------------------------------------
// §5.3 / §17.1 — valid next actions, computed from the same gate functions
// the change operations call. An action is `enabled: true` only when the
// service would in fact accept it (given a proper actor and idempotency
// key); otherwise it carries a `blockedReason`.
// ---------------------------------------------------------------------------

function computeValidNextActions(workspace: DesignWorkspace, projectId: string): ValidNextAction[] {
  const actions: ValidNextAction[] = []

  const approvedAnalysis = workspace.getApprovedUseCaseAnalysis(projectId)
  if (!approvedAnalysis) {
    const draft = workspace.getUseCaseAnalysisDraft(projectId)
    if (!draft) {
      actions.push(action('createUseCaseDraft', 'Create use-case draft', true))
      return actions
    }
    const openMaterial = draft.questions.filter((q) => q.material && !q.answer)
    if (openMaterial.length) {
      actions.push(
        action(
          'updateUseCaseItem',
          `Answer ${openMaterial.length} required question${openMaterial.length === 1 ? '' : 's'}`,
          true,
          { targetId: draft.id },
        ),
      )
      return actions
    }
    const gate = UseCase.evaluatePlanGate(draft)
    const ready = gate.passed && draft.status === 'readyForReview'
    actions.push(
      action('approveUseCaseAnalysis', 'Approve use-case analysis', ready, {
        targetId: draft.id,
        blockedReason: ready ? undefined : summarizeCapDiagnostics(gate.diagnostics),
      }),
    )
    return actions
  }

  const approvedArchitecture = workspace.getApprovedArchitecture(projectId)
  if (!approvedArchitecture) {
    const archDraft = workspace.getArchitectureDraft(projectId)
    if (!archDraft) {
      actions.push(action('createSystemDesignDraft', 'Create system design draft', true))
      return actions
    }
    const application = workspace.getApprovedApplication(projectId) ?? workspace.getApplicationDraft(projectId)
    if (!application) {
      actions.push(
        action('createSystemDesignDraft', 'Create system design draft', false, {
          blockedReason: 'no compiled application specification is available',
        }),
      )
      return actions
    }
    const requiredOps = deriveOperations(application).map((o) => o.operationId)
    const gate = SystemDesign.evaluateSystemStructureGate(
      archDraft as SystemDesign.SystemStructureSpecification,
      application,
      requiredOps,
    )
    actions.push(
      action('approveSystemStructure', 'Approve system structure', gate.passed, {
        targetId: archDraft.id,
        blockedReason: gate.passed ? undefined : summarizeCapDiagnostics(gate.diagnostics),
      }),
    )
    return actions
  }

  const moduleIds = [...approvedArchitecture.moduleIds].sort((a, b) => a.localeCompare(b))
  const approvedDesigns: ModuleDesignSpecification[] = []
  let allApproved = true
  for (const moduleId of moduleIds) {
    const approved = workspace.getApprovedModuleDesign(projectId, moduleId)
    const draft = workspace.getModuleDesignDraft(projectId, moduleId)
    if (approved && (!draft || draft.revision === approved.revision)) {
      approvedDesigns.push(approved)
      continue
    }
    allApproved = false
    if (!draft) {
      actions.push(action('startModuleDesign', `Design module: ${moduleId}`, true, { targetId: moduleId }))
      continue
    }
    if (draft.status === 'needsInput') {
      const openMaterial = draft.unresolvedItems.filter((i) => i.materiality === 'material' && !i.resolvedAt)
      actions.push(
        action(
          'answerModuleDesignQuestion',
          `Answer ${openMaterial.length} required question${openMaterial.length === 1 ? '' : 's'}: ${moduleId}`,
          true,
          { targetId: moduleId },
        ),
      )
      continue
    }
    if (draft.status === 'readyForReview') {
      const otherDesigns = collectOtherModuleDesigns(workspace, projectId, moduleId)
      const approvedContracts = deriveContractRegistry(otherDesigns).map((c) => c.contract)
      const evaluation = ModuleDesign.evaluateModuleDesignChecks(draft, {
        architecture: approvedArchitecture,
        otherDesigns,
        approvedContracts,
      })
      actions.push(
        action('approveModuleDesign', `Approve module design: ${moduleId}`, evaluation.passed, {
          targetId: moduleId,
          blockedReason: evaluation.passed ? undefined : summarizeDesignDiagnostics(evaluation.diagnostics),
        }),
      )
      continue
    }
    if (draft.status === 'stale') {
      actions.push(action('reopenModuleDesign', `Review upstream change: ${moduleId}`, true, { targetId: moduleId }))
      continue
    }
    if (draft.status === 'draft') {
      actions.push(action('updateModuleDesignItem', `Continue module design: ${moduleId}`, true, { targetId: moduleId }))
      continue
    }
    actions.push(
      action('reopenModuleDesign', `Resolve blocking issue: ${moduleId}`, false, {
        targetId: moduleId,
        blockedReason: `module design is ${draft.status}`,
      }),
    )
  }

  const baselineApproved = workspace.getApprovedDesignBaseline(projectId)
  if (!baselineApproved) {
    const baselineDraft = workspace.getDesignBaselineDraft(projectId)
    if (baselineDraft && baselineDraft.status !== 'approved') {
      actions.push(action('approveDesignBaseline', 'Approve Design baseline', baselineDraft.gates.every((g) => g.passed), {
        blockedReason: baselineDraft.gates.every((g) => g.passed) ? undefined : summarizeGates(baselineDraft.gates),
      }))
    } else {
      const contracts = deriveContractRegistry(approvedDesigns)
      const gates = Baseline.evaluateDesignBaselineGates(approvedArchitecture, approvedDesigns, contracts)
      const ready = allApproved && gates.every((g) => g.passed)
      actions.push(
        action('createDesignBaseline', 'Create Design baseline', ready, {
          blockedReason: ready
            ? undefined
            : allApproved
              ? summarizeGates(gates)
              : `${moduleIds.length - approvedDesigns.length} module design(s) remain`,
        }),
      )
    }
    return actions
  }

  const policy = workspace.getDesignWorkflowPolicy(projectId) ?? Baseline.createDefaultPolicy(projectId)
  const contracts = deriveContractRegistry(approvedDesigns)
  for (const design of approvedDesigns) {
    const otherActive = approvedDesigns
      .filter((d) => d.module.moduleId !== design.module.moduleId)
      .map((d) => ({ moduleId: d.module.moduleId, ownedPaths: d.boundary.ownedPaths }))
    const gate = Baseline.evaluateBuildGate({
      policy,
      baseline: baselineApproved,
      moduleDesign: design,
      moduleProgress: { useCaseAnalysisApproved: true, systemStructureApproved: true },
      contracts,
      otherActiveModules: otherActive,
    })
    actions.push(
      action('createModuleImplementationPacket', `Create Copilot handoff: ${design.module.moduleId}`, gate.ok, {
        targetId: design.module.moduleId,
        blockedReason: gate.ok ? undefined : summarizeCapDiagnostics(gate.diagnostics),
      }),
    )
  }
  return actions
}

// ---------------------------------------------------------------------------
// Executors (pluggable process/provider work — §19, §21)
// ---------------------------------------------------------------------------

export type ExecutionContext = { deadlineAt?: string; cancellationRequested?: boolean }

export type DesignOperationExecutors = {
  applyDelta?: (plan: DeltaApplyPlan, delta: ReturnedDelta, context: ExecutionContext) => DeltaApplyResult
  verifyModule?: (
    input: { design: ModuleDesignSpecification; plan: VerificationPlanner.ModuleAcceptancePlan },
    context: ExecutionContext,
  ) => { passed: boolean; evidenceRefs?: string[]; diagnostics?: DesignDiagnostic[] }
  configureBinding?: (
    input: { projectId: string; moduleId: string; bindingConfig: unknown },
    context: ExecutionContext,
  ) => { ok: boolean; value?: unknown; diagnostics?: DesignDiagnostic[] }
  verifyConnection?: (
    input: { projectId: string; moduleId: string; bindingConfig?: unknown },
    context: ExecutionContext,
  ) => { ok: boolean; value?: unknown; diagnostics?: DesignDiagnostic[] }
  runScenario?: (
    input: { entry: VerificationPlanner.ScenarioTestPlanEntry; analysis: UseCaseAnalysis },
    context: ExecutionContext,
  ) => { steps: ScenarioStepEvidence[]; outcome: ScenarioRun['outcome']; startedAt: string; completedAt: string }
  /**
   * §11.4, §20.1, §20.2 (finding R5) — reads repository content restricted
   * to the module's owned and editable-shared paths, for inclusion in the
   * implementation-packet context manifest as `source` entries. Optional:
   * when absent, `createModuleImplementationPacket` emits an explicit
   * warning diagnostic instead of silently omitting repository context.
   */
  readRepositoryContext?: (input: { ownedPaths: string[]; editableSharedPaths: string[] }) => RepositoryContextEntry[]
}

/** One repository file (or file-like unit) offered as packet context by `readRepositoryContext`. */
export type RepositoryContextEntry = {
  ref: string
  content?: string
  bytes?: number
  contentHash?: string
  reason?: string
}

export type CreateDesignOperationsDeps = {
  workspace: DesignWorkspace
  clock?: () => string
  workspaceRevisionProvider?: () => string
  executors?: DesignOperationExecutors
}

// ---------------------------------------------------------------------------
// createDesignOperations
// ---------------------------------------------------------------------------

export function createDesignOperations(deps: CreateDesignOperationsDeps) {
  const workspace = deps.workspace
  const clock = deps.clock ?? (() => new Date().toISOString())
  const workspaceRevisionProvider = deps.workspaceRevisionProvider
  const executors = deps.executors
  const resultCache = new Map<string, DesignOperationResult<unknown>>()

  type ChangeOutcome<T> = {
    ok: boolean
    diagnostics: DesignDiagnostic[]
    value?: T
    revision?: string
    contentHash?: string
    baseRevision?: string
    baseHash?: string
    approvalRef?: string
    evidenceRefs?: string[]
    agentSource?: string
    packetId?: string
    deltaId?: string
  }

  function executeChange<T>(
    meta: {
      operation: string
      projectId: string
      actor: string
      idempotencyKey?: string
      targetRecordId?: string
      /** The `authority` field of the request, when the operation input carries one (§4, finding R1). */
      claimedAuthority?: ApprovalAuthority
    },
    run: () => ChangeOutcome<T>,
  ): DesignOperationResult<T> {
    const { operation, projectId, actor, idempotencyKey, targetRecordId } = meta

    function finalize(outcome: ChangeOutcome<T>): DesignOperationResult<T> {
      const eventId = crypto.randomUUID()
      const event: DesignAuditEvent = {
        eventId,
        projectId,
        actor,
        operation,
        targetRecordId,
        baseRevision: outcome.baseRevision,
        baseHash: outcome.baseHash,
        resultRevision: outcome.revision,
        resultHash: outcome.contentHash,
        idempotencyKey,
        agentSource: outcome.agentSource,
        packetId: outcome.packetId,
        deltaId: outcome.deltaId,
        approvalRef: outcome.approvalRef,
        at: clock(),
        outcome: outcome.ok ? 'ok' : 'rejected',
        diagnosticCodes: outcome.diagnostics.map((d) => d.code),
        evidenceRefs: outcome.evidenceRefs ?? [],
      }
      const committed = workspace.appendAuditEvent(projectId, event)
      const result: DesignOperationResult<T> = {
        ok: outcome.ok,
        value: outcome.value,
        diagnostics: outcome.diagnostics,
        revision: outcome.revision,
        contentHash: outcome.contentHash,
        auditEventId: committed.eventId,
        validNextActions: computeValidNextActions(workspace, projectId),
      }
      if (idempotencyKey) {
        // §5.3 / §17.3 — the cache and the persisted result are keyed by
        // projectId + operation + idempotencyKey, never the raw key alone
        // (finding R2): the same key reused for a different operation or a
        // different project is a fresh call, not a replay.
        resultCache.set(operationResultCacheKey(projectId, operation, idempotencyKey), result as DesignOperationResult<unknown>)
        workspace.saveOperationResult(projectId, operation, idempotencyKey, result as DesignOperationResult<unknown>)
      }
      return result
    }

    // §17.3 "validate authorization" — actor format first, for every change
    // operation (finding R1a).
    const kind = actor && typeof actor === 'string' ? actorKind(actor) : undefined
    if (!kind) {
      return finalize({
        ok: false,
        diagnostics: [
          makeDiagnostic(
            'EUC16-ACTOR-INVALID',
            'blocker',
            `actor must match "user:<id>", "agent:<id>", or "service:<id>" after trimming whitespace (received ${JSON.stringify(actor)})`,
            'actor',
          ),
        ],
      })
    }
    // §4 / §20.2 "the API shall not expose an approval shortcut for agents"
    // — case-insensitive; a service actor is rejected the same as an agent
    // actor (finding R1b).
    if (operation.startsWith('approve') && (kind === 'agent' || kind === 'service')) {
      return finalize({
        ok: false,
        diagnostics: [
          makeDiagnostic('EUC16-AGENT-APPROVAL-FORBIDDEN', 'blocker', `an ${kind} actor cannot call ${operation}`, 'actor', [actor]),
        ],
      })
    }
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
      return finalize({ ok: false, diagnostics: [makeDiagnostic('EUC16-IDEMPOTENCY-KEY-REQUIRED', 'blocker', 'idempotencyKey is required for a change operation')] })
    }

    const cacheKey = operationResultCacheKey(projectId, operation, idempotencyKey)
    const cached = resultCache.get(cacheKey)
    if (cached) {
      return { ...(cached as DesignOperationResult<T>), idempotentReplay: true }
    }
    const persisted = workspace.findOperationResult(projectId, operation, idempotencyKey)
    if (persisted) {
      resultCache.set(cacheKey, persisted)
      return { ...(persisted as DesignOperationResult<T>), idempotentReplay: true }
    }

    // §4 "authority must not be caller-asserted alone" (finding R1c) — only
    // reached on a genuinely new attempt, after the replay checks above.
    const authorityDiagnostic = checkApprovalAuthority(workspace, projectId, operation, actor, meta.claimedAuthority)
    if (authorityDiagnostic) {
      return finalize({ ok: false, diagnostics: [authorityDiagnostic] })
    }

    return finalize(run())
  }

  // -------------------------------------------------------------------------
  // §17.1 — read operations
  // -------------------------------------------------------------------------

  function getWorkflowStatus(projectId: string) {
    return {
      projectId,
      useCaseAnalysis: {
        draft: workspace.getUseCaseAnalysisDraft(projectId),
        approved: workspace.getApprovedUseCaseAnalysis(projectId),
      },
      application: {
        draft: workspace.getApplicationDraft(projectId),
        approved: workspace.getApprovedApplication(projectId),
      },
      systemStructure: {
        draft: workspace.getArchitectureDraft(projectId),
        approved: workspace.getApprovedArchitecture(projectId),
      },
      moduleDesignProgress: workspace.getApprovedArchitecture(projectId) ? listModuleDesigns(projectId, 'all') : undefined,
      baseline: {
        draft: workspace.getDesignBaselineDraft(projectId),
        approved: workspace.getApprovedDesignBaseline(projectId),
      },
      policy: workspace.getDesignWorkflowPolicy(projectId) ?? Baseline.createDefaultPolicy(projectId),
    }
  }

  function getValidNextActions(projectId: string): ValidNextAction[] {
    return computeValidNextActions(workspace, projectId)
  }

  function getSystemDesign(projectId: string, revision?: string) {
    if (revision) return workspace.getApprovedArchitecture(projectId, revision)
    return workspace.getApprovedArchitecture(projectId) ?? workspace.getArchitectureDraft(projectId)
  }

  function listModuleDesigns(projectId: string, filter: ModuleDesign.ModuleQueueFilter = 'all') {
    const architecture = workspace.getApprovedArchitecture(projectId)
    if (!architecture) {
      return {
        projectId,
        architectureRevision: '',
        total: 0,
        notStarted: 0,
        draft: 0,
        needsInput: 0,
        readyForReview: 0,
        approved: 0,
        stale: 0,
        blocked: 0,
        modules: [],
      }
    }
    const designs: ModuleDesignSpecification[] = []
    for (const id of architecture.moduleIds) {
      const approved = workspace.getApprovedModuleDesign(projectId, id)
      if (approved) designs.push(approved)
      const draft = workspace.getModuleDesignDraft(projectId, id)
      if (draft) designs.push(draft)
    }
    const sessions = architecture.moduleIds
      .map((id) => workspace.getModuleDesignSession(projectId, id))
      .filter((s): s is ModuleDesignSession => Boolean(s))
    const progress = ModuleDesign.computeModuleDesignProgress(architecture, designs, sessions)
    return { ...progress, modules: ModuleDesign.filterModuleQueue(progress, filter) }
  }

  function getModuleDesign(projectId: string, moduleId: string, revision?: string) {
    if (revision) return workspace.getApprovedModuleDesign(projectId, moduleId, revision)
    return workspace.getApprovedModuleDesign(projectId, moduleId) ?? workspace.getModuleDesignDraft(projectId, moduleId)
  }

  function getModuleContext(projectId: string, moduleId: string) {
    return {
      session: workspace.getModuleDesignSession(projectId, moduleId),
      design: getModuleDesign(projectId, moduleId),
      impacts: workspace
        .listDesignImpactRecords(projectId)
        .filter((r) => r.initiatingRecordId === moduleId || r.items.some((i) => i.targetId === moduleId)),
    }
  }

  function getModuleImpact(projectId: string, moduleId: string): DesignImpactRecord[] {
    return workspace
      .listDesignImpactRecords(projectId)
      .filter((r) => r.initiatingRecordId === moduleId || r.items.some((i) => i.category === 'module' && i.targetId === moduleId))
  }

  function getImplementationWaves(projectId: string): ImplementationWavePlan {
    const architecture = workspace.getApprovedArchitecture(projectId)
    if (!architecture) return { projectId, architectureRevision: '', waves: [], autoDispatch: false }
    return computeImplementationWaves(projectId, architecture, collectApprovedDesigns(workspace, projectId, architecture))
  }

  function getScenarioCoverage(projectId: string) {
    const analysis = workspace.getApprovedUseCaseAnalysis(projectId)
    if (!analysis) return undefined
    const testPlan = VerificationPlanner.buildScenarioTestPlan(analysis)
    const runs = workspace.listScenarioRuns(projectId)
    const architecture = workspace.getApprovedArchitecture(projectId)
    const application = workspace.getApprovedApplication(projectId)
    const approvedDesigns = architecture ? collectApprovedDesigns(workspace, projectId, architecture) : []
    const moduleDesignRevisions: Record<string, string> = {}
    for (const d of approvedDesigns) moduleDesignRevisions[d.module.moduleId] = d.revision
    const currentRevisions: VerificationPlanner.CurrentRevisions = {
      useCaseAnalysisRevision: analysis.revision,
      applicationRevision: application?.revision,
      systemStructureRevision: architecture?.revision,
      moduleDesignRevisions,
    }
    return VerificationPlanner.buildVerifySummary(runs, { scenarioTestPlan: testPlan, currentRevisions, designLinks: [] })
  }

  function getVerificationEvidence(projectId: string, scenarioRunId: string): ScenarioRun | undefined {
    return workspace.getScenarioRun(projectId, scenarioRunId)
  }

  // -------------------------------------------------------------------------
  // §17.2 — change operations
  // -------------------------------------------------------------------------

  function createUseCaseDraft(input: CreateUseCaseDraftInput): DesignOperationResult<UseCaseAnalysis> {
    return executeChange({ operation: 'createUseCaseDraft', projectId: input.projectId, actor: input.actor, idempotencyKey: input.idempotencyKey }, () => {
      const current = workspace.getUseCaseAnalysisDraft(input.projectId)
      const staleDiagnostic = checkExpectedBase(current?.revision, current?.contentHash, input)
      if (staleDiagnostic) return { ok: false, diagnostics: [staleDiagnostic] }
      const result = UseCase.createUseCaseDraft({
        projectId: input.projectId,
        workDescription: input.workDescription,
        examples: input.examples,
        prohibitedResults: input.prohibitedResults,
        sources: input.sources,
      })
      if (result.diagnostics.some((d) => d.severity === 'blocker')) return { ok: false, diagnostics: result.diagnostics }
      workspace.saveUseCaseAnalysisDraft(input.projectId, result.analysis)
      return {
        ok: true,
        diagnostics: result.diagnostics,
        value: result.analysis,
        revision: result.analysis.revision,
        contentHash: result.analysis.contentHash,
      }
    })
  }

  function updateUseCaseItem(
    input: UpdateUseCaseItemInput,
  ): DesignOperationResult<UseCaseAnalysis> {
    return executeChange(
      {
        operation: 'updateUseCaseItem',
        projectId: input.projectId,
        actor: input.actor,
        idempotencyKey: input.idempotencyKey,
        targetRecordId: input.target.kind === 'question' ? input.target.questionId : input.target.itemId,
      },
      () => {
        const draft = workspace.getUseCaseAnalysisDraft(input.projectId)
        if (!draft) return { ok: false, diagnostics: [makeDiagnostic('EUC16-NOT-FOUND', 'blocker', 'no use-case analysis draft exists')] }
        const staleDiagnostic = checkExpectedBase(draft.revision, draft.contentHash, input)
        if (staleDiagnostic) return { ok: false, diagnostics: [staleDiagnostic], baseRevision: draft.revision, baseHash: draft.contentHash }

        const result =
          input.target.kind === 'question'
            ? UseCase.answerQuestion(draft, input.target.questionId, input.target.answer, input.actor, clock())
            : input.target.action === 'accept'
              ? UseCase.acceptAnalysisItem(draft, input.target.itemId, input.actor)
              : input.target.action === 'correct'
                ? UseCase.correctAnalysisItem(draft, input.target.itemId, input.target.text ?? '', input.actor)
                : UseCase.rejectAnalysisItem(draft, input.target.itemId, input.actor)

        if (result.diagnostics.length) {
          return { ok: false, diagnostics: result.diagnostics, baseRevision: draft.revision, baseHash: draft.contentHash }
        }
        workspace.saveUseCaseAnalysisDraft(input.projectId, result.analysis)
        return {
          ok: true,
          diagnostics: [],
          value: result.analysis,
          revision: result.analysis.revision,
          contentHash: result.analysis.contentHash,
          baseRevision: draft.revision,
          baseHash: draft.contentHash,
        }
      },
    )
  }

  function approveUseCaseAnalysis(
    input: ApproveUseCaseAnalysisInput,
  ): DesignOperationResult<{ analysis: UseCaseAnalysis; application?: ApplicationSpecification }> {
    return executeChange({ operation: 'approveUseCaseAnalysis', projectId: input.projectId, actor: input.actor, idempotencyKey: input.idempotencyKey, claimedAuthority: input.authority }, () => {
      const draft = workspace.getUseCaseAnalysisDraft(input.projectId)
      if (!draft) return { ok: false, diagnostics: [makeDiagnostic('EUC16-NOT-FOUND', 'blocker', 'no use-case analysis draft exists')] }
      const staleDiagnostic = checkExpectedBase(draft.revision, draft.contentHash, input)
      if (staleDiagnostic) return { ok: false, diagnostics: [staleDiagnostic], baseRevision: draft.revision, baseHash: draft.contentHash }
      const result = UseCase.approveUseCaseAnalysis(draft, { approvedBy: input.actor, authority: input.authority, at: clock() })
      if (result.diagnostics.length) {
        return { ok: false, diagnostics: result.diagnostics, baseRevision: draft.revision, baseHash: draft.contentHash }
      }
      const approved = workspace.approveUseCaseAnalysis(input.projectId, result.analysis)
      const compiled = compileApplication(approved)
      let application: ApplicationSpecification | undefined
      if (compiled.specification) {
        workspace.saveApplicationDraft(input.projectId, compiled.specification)
        application = compiled.specification
      }
      return {
        ok: true,
        diagnostics: compiled.diagnostics,
        value: { analysis: approved, application },
        revision: approved.revision,
        contentHash: approved.contentHash,
        baseRevision: draft.revision,
        baseHash: draft.contentHash,
        approvalRef: `${approved.id}@${approved.revision}`,
      }
    })
  }

  function createSystemDesignDraft(
    input: CreateSystemDesignDraftInput,
  ): DesignOperationResult<SystemDesign.SystemStructureSpecification> {
    return executeChange({ operation: 'createSystemDesignDraft', projectId: input.projectId, actor: input.actor, idempotencyKey: input.idempotencyKey }, () => {
      const application = workspace.getApprovedApplication(input.projectId) ?? workspace.getApplicationDraft(input.projectId)
      if (!application) {
        return { ok: false, diagnostics: [makeDiagnostic('EUC16-NOT-FOUND', 'blocker', 'no compiled application specification is available; approve the use-case analysis first')] }
      }
      const current = workspace.getArchitectureDraft(input.projectId)
      const staleDiagnostic = checkExpectedBase(current?.revision, current?.contentHash, input)
      if (staleDiagnostic) return { ok: false, diagnostics: [staleDiagnostic] }
      const architectureId = input.architectureId ?? current?.id ?? `${application.id}.architecture`
      const draft = SystemDesign.proposeSystemStructure(application, {
        architectureId,
        operations: deriveOperations(application),
        primaryModuleId: input.primaryModuleId,
        primaryModuleName: input.primaryModuleName,
        primaryModuleType: input.primaryModuleType,
        primaryDeployableId: input.primaryDeployableId,
      })
      workspace.saveArchitectureDraft(input.projectId, draft)
      return { ok: true, diagnostics: [], value: draft, revision: draft.revision, contentHash: draft.contentHash }
    })
  }

  function applySystemDesignDecision(
    input: ApplySystemDesignDecisionInput,
  ): DesignOperationResult<SystemDesign.SystemStructureSpecification> {
    return executeChange({ operation: 'applySystemDesignDecision', projectId: input.projectId, actor: input.actor, idempotencyKey: input.idempotencyKey }, () => {
      const current = workspace.getArchitectureDraft(input.projectId) as SystemDesign.SystemStructureSpecification | undefined
      if (!current) return { ok: false, diagnostics: [makeDiagnostic('EUC16-NOT-FOUND', 'blocker', 'no system design draft exists')] }
      const staleDiagnostic = checkExpectedBase(current.revision, current.contentHash, input)
      if (staleDiagnostic) return { ok: false, diagnostics: [staleDiagnostic], baseRevision: current.revision, baseHash: current.contentHash }

      const decision = input.decision
      let result: SystemDesign.SystemStructureCommandResult
      switch (decision.kind) {
        case 'rename':
          result = SystemDesign.renameModule(current, decision.moduleId, decision.name)
          break
        case 'changePurpose':
          result = SystemDesign.changeModulePurpose(current, decision.moduleId, decision.responsibility, decision.reason)
          break
        case 'changeType':
          result = SystemDesign.changeModuleType(current, decision.moduleId, decision.moduleType)
          break
        case 'split':
          result = SystemDesign.splitModule(current, decision.moduleId, decision.newModules)
          break
        case 'merge':
          result = SystemDesign.mergeModules(current, decision.moduleIds, decision.merged)
          break
        case 'moveOperation':
          result = SystemDesign.moveOperation(current, decision.operationId, decision.toModuleId)
          break
        case 'addDependency':
          result = SystemDesign.addDependency(current, decision.fromModuleId, decision.toModuleId, decision.reason)
          break
        case 'removeDependency':
          result = SystemDesign.removeDependency(current, decision.fromModuleId, decision.toModuleId)
          break
        case 'addAdapterAllocation':
          result = SystemDesign.addAdapterAllocation(current, decision.allocation)
          break
        case 'changeAdapterAllocation':
          result = SystemDesign.changeAdapterAllocation(current, decision.adapterId, decision.newModuleId)
          break
        case 'moveToDeployable':
          result = SystemDesign.moveModuleToDeployable(current, decision.moduleId, decision.targetDeployableId, decision.options)
          break
        case 'changeOwnedPath':
          result = SystemDesign.changeOwnedPath(current, decision.moduleId, decision.ownedPaths)
          break
      }
      if (!result.ok || !result.architecture) {
        return { ok: false, diagnostics: result.diagnostics.map(UseCase.toDesignDiagnostic), baseRevision: current.revision, baseHash: current.contentHash }
      }
      workspace.saveArchitectureDraft(input.projectId, result.architecture)
      return {
        ok: true,
        diagnostics: [],
        value: result.architecture,
        revision: result.architecture.revision,
        contentHash: result.architecture.contentHash,
        baseRevision: current.revision,
        baseHash: current.contentHash,
      }
    })
  }

  function approveSystemStructure(
    input: ApproveSystemStructureInput,
  ): DesignOperationResult<SystemDesign.SystemStructureSpecification> {
    return executeChange({ operation: 'approveSystemStructure', projectId: input.projectId, actor: input.actor, idempotencyKey: input.idempotencyKey, claimedAuthority: input.authority }, () => {
      const draft = workspace.getArchitectureDraft(input.projectId) as SystemDesign.SystemStructureSpecification | undefined
      if (!draft) return { ok: false, diagnostics: [makeDiagnostic('EUC16-NOT-FOUND', 'blocker', 'no system design draft exists')] }
      const staleDiagnostic = checkExpectedBase(draft.revision, draft.contentHash, input)
      if (staleDiagnostic) return { ok: false, diagnostics: [staleDiagnostic], baseRevision: draft.revision, baseHash: draft.contentHash }
      const application = workspace.getApprovedApplication(input.projectId) ?? workspace.getApplicationDraft(input.projectId)
      if (!application) return { ok: false, diagnostics: [makeDiagnostic('EUC16-NOT-FOUND', 'blocker', 'no compiled application specification is available')] }
      const requiredOps = deriveOperations(application).map((o) => o.operationId)
      const result = SystemDesign.approveSystemStructure(
        draft,
        application,
        { approvedBy: input.actor, authority: input.authority, approvedAt: clock() },
        requiredOps,
      )
      if (!result.ok || !result.architecture) {
        return { ok: false, diagnostics: result.diagnostics.map(UseCase.toDesignDiagnostic), baseRevision: draft.revision, baseHash: draft.contentHash }
      }
      const approved = workspace.approveArchitecture(input.projectId, result.architecture)
      return {
        ok: true,
        diagnostics: [],
        value: approved as SystemDesign.SystemStructureSpecification,
        revision: approved.revision,
        contentHash: approved.contentHash,
        baseRevision: draft.revision,
        baseHash: draft.contentHash,
        approvalRef: `${approved.id}@${approved.revision}`,
      }
    })
  }

  function startModuleDesign(
    input: StartModuleDesignInput,
  ): DesignOperationResult<{ design: ModuleDesignSpecification; session: ModuleDesignSession }> {
    return executeChange(
      { operation: 'startModuleDesign', projectId: input.projectId, actor: input.actor, idempotencyKey: input.idempotencyKey, targetRecordId: input.moduleId },
      () => {
        const architecture = workspace.getApprovedArchitecture(input.projectId)
        if (!architecture) return { ok: false, diagnostics: [makeDiagnostic('EUC16-NOT-FOUND', 'blocker', 'no approved system structure exists')] }
        if (!architecture.moduleIds.includes(input.moduleId)) {
          return { ok: false, diagnostics: [makeDiagnostic('EUC16-UNKNOWN-MODULE', 'blocker', `unknown module id: ${input.moduleId}`, 'moduleId', [input.moduleId])] }
        }
        const existingApproved = workspace.getApprovedModuleDesign(input.projectId, input.moduleId)
        const existingDraft = workspace.getModuleDesignDraft(input.projectId, input.moduleId)
        if (existingApproved || existingDraft) {
          return { ok: false, diagnostics: [makeDiagnostic('EUC16-ALREADY-STARTED', 'blocker', `module design already started: ${input.moduleId}`, 'moduleId', [input.moduleId])] }
        }
        const draft = ModuleDesign.createModuleDesignDraft({
          projectId: input.projectId,
          architecture,
          moduleId: input.moduleId,
          moduleVersion: input.moduleVersion,
          owner: input.owner,
          deployableId: input.deployableId,
          runtimeAllocation: input.runtimeAllocation,
          runtimeLanguage: input.runtimeLanguage,
          ownedPaths: input.ownedPaths,
          editableSharedPaths: input.editableSharedPaths,
        })
        workspace.saveModuleDesignDraft(input.projectId, input.moduleId, draft)
        const manifest = ContextPacket.buildContextManifest({
          targetRecordId: draft.id,
          targetRevision: draft.revision,
          limit: input.contextLimitBytes ?? 200000,
          candidates: [
            {
              kind: 'record',
              ref: architecture.id,
              content: JSON.stringify({ moduleId: input.moduleId, responsibility: draft.module.responsibility }),
              reason: 'architecture slice for this module',
            },
          ],
        })
        workspace.saveContextManifest(input.projectId, manifest)
        const session = Session.createSession({
          projectId: input.projectId,
          moduleId: input.moduleId,
          baseArchitectureRevision: architecture.revision,
          sourceManifest: manifest,
          now: clock(),
        })
        workspace.saveModuleDesignSession(input.projectId, session)
        return { ok: true, diagnostics: [], value: { design: draft, session }, revision: draft.revision, contentHash: draft.contentHash }
      },
    )
  }

  function answerModuleDesignQuestion(
    input: AnswerModuleDesignQuestionInput,
  ): DesignOperationResult<{ design: ModuleDesignSpecification; session: ModuleDesignSession }> {
    return executeChange(
      { operation: 'answerModuleDesignQuestion', projectId: input.projectId, actor: input.actor, idempotencyKey: input.idempotencyKey, targetRecordId: input.moduleId },
      () => {
        const session = workspace.getModuleDesignSession(input.projectId, input.moduleId)
        const design = workspace.getModuleDesignDraft(input.projectId, input.moduleId)
        if (!session || !design) {
          return { ok: false, diagnostics: [makeDiagnostic('EUC16-NOT-FOUND', 'blocker', `no module design session for ${input.moduleId}`)] }
        }
        const staleDiagnostic = checkExpectedBase(design.revision, design.contentHash, input)
        if (staleDiagnostic) return { ok: false, diagnostics: [staleDiagnostic], baseRevision: design.revision, baseHash: design.contentHash }

        const updatedSession = Session.answerSessionQuestion(session, {
          questionId: input.questionId,
          step: input.step,
          text: input.text,
          answeredAt: clock(),
        })
        workspace.saveModuleDesignSession(input.projectId, updatedSession)

        let updatedDesign = design
        if (design.unresolvedItems.some((item) => item.id === input.questionId)) {
          const unresolvedItems = design.unresolvedItems.map((item) =>
            item.id === input.questionId ? { ...item, resolvedAt: clock() } : item,
          )
          const result = ModuleDesign.updateModuleDesignItem(design, 'unresolvedItems', unresolvedItems)
          if (result.ok) {
            updatedDesign = result.design
            workspace.saveModuleDesignDraft(input.projectId, input.moduleId, updatedDesign)
          }
        }
        return {
          ok: true,
          diagnostics: [],
          value: { design: updatedDesign, session: updatedSession },
          revision: updatedDesign.revision,
          contentHash: updatedDesign.contentHash,
          baseRevision: design.revision,
          baseHash: design.contentHash,
        }
      },
    )
  }

  function updateModuleDesignItem(input: UpdateModuleDesignItemInput): DesignOperationResult<ModuleDesignSpecification> {
    return executeChange(
      { operation: 'updateModuleDesignItem', projectId: input.projectId, actor: input.actor, idempotencyKey: input.idempotencyKey, targetRecordId: input.moduleId },
      () => {
        const design = workspace.getModuleDesignDraft(input.projectId, input.moduleId)
        if (!design) return { ok: false, diagnostics: [makeDiagnostic('EUC16-NOT-FOUND', 'blocker', `no module design draft for ${input.moduleId}`)] }
        const staleDiagnostic = checkExpectedBase(design.revision, design.contentHash, input)
        if (staleDiagnostic) return { ok: false, diagnostics: [staleDiagnostic], baseRevision: design.revision, baseHash: design.contentHash }
        // §9.7 (finding R3) — an explicit consumer-review acknowledgement of
        // a provider's contract version. This does not change the module
        // design record; `path: 'requiredOperations.ack'` is a dedicated
        // signal handled here, not delegated to `ModuleDesign.updateModuleDesignItem`.
        if (input.path === 'requiredOperations.ack') {
          const ack = input.value as { operationId?: unknown; version?: unknown }
          if (typeof ack?.operationId !== 'string' || typeof ack?.version !== 'string') {
            return {
              ok: false,
              diagnostics: [makeDiagnostic('EUC16-CONTRACT-ACK-INVALID', 'blocker', 'requiredOperations.ack requires { operationId, version }', 'value')],
              baseRevision: design.revision,
              baseHash: design.contentHash,
            }
          }
          workspace.saveConsumerAck(input.projectId, {
            operationId: ack.operationId,
            version: ack.version,
            consumerModuleId: input.moduleId,
            ackedAt: clock(),
            source: 'explicit',
          })
          return {
            ok: true,
            diagnostics: [],
            value: design,
            revision: design.revision,
            contentHash: design.contentHash,
            baseRevision: design.revision,
            baseHash: design.contentHash,
          }
        }
        const result = ModuleDesign.updateModuleDesignItem(design, input.path, input.value)
        if (!result.ok) return { ok: false, diagnostics: result.diagnostics, baseRevision: design.revision, baseHash: design.contentHash }
        workspace.saveModuleDesignDraft(input.projectId, input.moduleId, result.design)
        return {
          ok: true,
          diagnostics: [],
          value: result.design,
          revision: result.design.revision,
          contentHash: result.design.contentHash,
          baseRevision: design.revision,
          baseHash: design.contentHash,
        }
      },
    )
  }

  function analyzeModuleDesign(
    input: AnalyzeModuleDesignInput,
  ): DesignOperationResult<{ design: ModuleDesignSpecification; evaluation: ModuleDesign.ModuleDesignCheckEvaluation }> {
    return executeChange(
      { operation: 'analyzeModuleDesign', projectId: input.projectId, actor: input.actor, idempotencyKey: input.idempotencyKey, targetRecordId: input.moduleId },
      () => {
        const design = workspace.getModuleDesignDraft(input.projectId, input.moduleId)
        if (!design) return { ok: false, diagnostics: [makeDiagnostic('EUC16-NOT-FOUND', 'blocker', `no module design draft for ${input.moduleId}`)] }
        const staleDiagnostic = checkExpectedBase(design.revision, design.contentHash, input)
        if (staleDiagnostic) return { ok: false, diagnostics: [staleDiagnostic], baseRevision: design.revision, baseHash: design.contentHash }
        const architecture = workspace.getApprovedArchitecture(input.projectId)
        const otherDesigns = collectOtherModuleDesigns(workspace, input.projectId, input.moduleId)
        const approvedContracts = deriveContractRegistry(otherDesigns).map((c) => c.contract)
        const stamped = stampProvidedOperationHashes(design)
        const { design: checked, evaluation } = ModuleDesign.applyModuleDesignChecks(stamped, { architecture, otherDesigns, approvedContracts })
        workspace.saveModuleDesignDraft(input.projectId, input.moduleId, checked)
        // §9.7 (finding R3) — register/update a draft contract for every
        // provided operation, and record this module's re-analysis as a
        // consumer acknowledgement for every currently persisted contract
        // version it requires.
        const contractDiagnostics = registerProvidedContractDrafts(workspace, input.projectId, checked)
        recordConsumerAcksForRequiredOperations(workspace, input.projectId, checked, clock())
        return {
          ok: true,
          diagnostics: [...evaluation.diagnostics, ...contractDiagnostics.map(UseCase.toDesignDiagnostic)],
          value: { design: checked, evaluation },
          revision: checked.revision,
          contentHash: checked.contentHash,
          baseRevision: design.revision,
          baseHash: design.contentHash,
        }
      },
    )
  }

  function approveModuleDesign(input: ApproveModuleDesignOpInput): DesignOperationResult<ModuleDesignSpecification> {
    return executeChange(
      { operation: 'approveModuleDesign', projectId: input.projectId, actor: input.actor, idempotencyKey: input.idempotencyKey, targetRecordId: input.moduleId, claimedAuthority: input.authority },
      () => {
        const design = workspace.getModuleDesignDraft(input.projectId, input.moduleId)
        if (!design) return { ok: false, diagnostics: [makeDiagnostic('EUC16-NOT-FOUND', 'blocker', `no module design draft for ${input.moduleId}`)] }
        const staleDiagnostic = checkExpectedBase(design.revision, design.contentHash, input)
        if (staleDiagnostic) return { ok: false, diagnostics: [staleDiagnostic], baseRevision: design.revision, baseHash: design.contentHash }
        const architecture = workspace.getApprovedArchitecture(input.projectId)
        const otherDesigns = collectOtherModuleDesigns(workspace, input.projectId, input.moduleId)
        const approvedContracts = deriveContractRegistry(otherDesigns).map((c) => c.contract)
        // §9.7 (finding R3) — a changed, already-approved contract may not
        // be re-approved until every known consumer has reviewed it.
        const blockedContracts = findBlockedContractApprovals(workspace, input.projectId, design, otherDesigns)
        if (blockedContracts.length) {
          return { ok: false, diagnostics: blockedContracts, baseRevision: design.revision, baseHash: design.contentHash }
        }
        const result = ModuleDesign.approveModuleDesign(
          design,
          { approvedBy: input.actor, authority: input.authority, approvedAt: clock() },
          { architecture, otherDesigns, approvedContracts },
        )
        if (!result.ok) return { ok: false, diagnostics: result.diagnostics, baseRevision: design.revision, baseHash: design.contentHash }
        const approved = workspace.approveModuleDesign(input.projectId, input.moduleId, result.design)
        // §9.7 "the provider ... shall review" — the same authorized
        // approval of this module approves its own provided contracts.
        approveProvidedContracts(workspace, input.projectId, approved, {
          approvedBy: input.actor,
          authority: input.authority,
          approvedAt: clock(),
        })
        return {
          ok: true,
          diagnostics: [],
          value: approved,
          revision: approved.revision,
          contentHash: approved.contentHash,
          baseRevision: design.revision,
          baseHash: design.contentHash,
          approvalRef: `${approved.id}@${approved.revision}`,
        }
      },
    )
  }

  function reopenModuleDesign(input: ReopenModuleDesignInput): DesignOperationResult<ModuleDesignSpecification> {
    return executeChange(
      { operation: 'reopenModuleDesign', projectId: input.projectId, actor: input.actor, idempotencyKey: input.idempotencyKey, targetRecordId: input.moduleId },
      () => {
        const approved = workspace.getApprovedModuleDesign(input.projectId, input.moduleId)
        if (!approved) return { ok: false, diagnostics: [makeDiagnostic('EUC16-NOT-FOUND', 'blocker', `no approved module design for ${input.moduleId}`)] }
        const staleDiagnostic = checkExpectedBase(approved.revision, approved.contentHash, input)
        if (staleDiagnostic) return { ok: false, diagnostics: [staleDiagnostic], baseRevision: approved.revision, baseHash: approved.contentHash }
        const { draft } = ModuleDesign.reopenModuleDesign(approved)
        workspace.saveModuleDesignDraft(input.projectId, input.moduleId, draft)
        return {
          ok: true,
          diagnostics: [],
          value: draft,
          revision: draft.revision,
          contentHash: draft.contentHash,
          baseRevision: approved.revision,
          baseHash: approved.contentHash,
        }
      },
    )
  }

  function createDesignBaseline(input: CreateDesignBaselineOpInput): DesignOperationResult<DesignBaseline> {
    return executeChange({ operation: 'createDesignBaseline', projectId: input.projectId, actor: input.actor, idempotencyKey: input.idempotencyKey }, () => {
      const architecture = workspace.getApprovedArchitecture(input.projectId)
      if (!architecture) return { ok: false, diagnostics: [makeDiagnostic('EUC16-NOT-FOUND', 'blocker', 'no approved system structure exists')] }
      const approvedDesigns = collectApprovedDesigns(workspace, input.projectId, architecture)
      const contracts = deriveContractRegistry(approvedDesigns)
      const baselineId = input.baselineId ?? `${architecture.id}.baseline`
      const draft = Baseline.createDesignBaseline(architecture, approvedDesigns, contracts, { baselineId })
      if (!draft.gates.every((g) => g.passed)) {
        return { ok: false, diagnostics: draft.gates.flatMap((g) => g.diagnostics).map(UseCase.toDesignDiagnostic) }
      }
      const current = workspace.getDesignBaselineDraft(input.projectId)
      const staleDiagnostic = checkExpectedBase(current?.revision, current?.contentHash, input)
      if (staleDiagnostic) return { ok: false, diagnostics: [staleDiagnostic] }
      workspace.saveDesignBaselineDraft(input.projectId, draft)
      return { ok: true, diagnostics: [], value: draft, revision: draft.revision, contentHash: draft.contentHash }
    })
  }

  function approveDesignBaseline(input: ApproveDesignBaselineOpInput): DesignOperationResult<DesignBaseline> {
    return executeChange({ operation: 'approveDesignBaseline', projectId: input.projectId, actor: input.actor, idempotencyKey: input.idempotencyKey, claimedAuthority: input.authority }, () => {
      const draft = workspace.getDesignBaselineDraft(input.projectId)
      if (!draft) return { ok: false, diagnostics: [makeDiagnostic('EUC16-NOT-FOUND', 'blocker', 'no Design baseline draft exists')] }
      const staleDiagnostic = checkExpectedBase(draft.revision, draft.contentHash, input)
      if (staleDiagnostic) return { ok: false, diagnostics: [staleDiagnostic], baseRevision: draft.revision, baseHash: draft.contentHash }
      const result = Baseline.approveDesignBaseline(draft, { approvedBy: input.actor, authority: input.authority, approvedAt: clock() })
      if (!result.ok || !result.baseline) {
        return { ok: false, diagnostics: result.diagnostics.map(UseCase.toDesignDiagnostic), baseRevision: draft.revision, baseHash: draft.contentHash }
      }
      const approved = workspace.approveDesignBaseline(input.projectId, result.baseline)
      return {
        ok: true,
        diagnostics: [],
        value: approved,
        revision: approved.revision,
        contentHash: approved.contentHash,
        baseRevision: draft.revision,
        baseHash: draft.contentHash,
        approvalRef: `${approved.id}@${approved.revision}`,
      }
    })
  }

  function proposeVisualChange(input: ProposeVisualChangeInput): DesignOperationResult<DiagramDiscussionEntry> {
    return executeChange(
      { operation: 'proposeVisualChange', projectId: input.projectId, actor: input.actor, idempotencyKey: input.idempotencyKey, targetRecordId: input.elementId },
      () => {
        const entry: DiagramDiscussionEntry = {
          id: `${input.diagramId}.${input.elementId}.${input.idempotencyKey}`,
          elementId: input.elementId,
          diagramId: input.diagramId,
          author: input.actor,
          kind: 'proposedChange',
          text: input.description,
          at: clock(),
        }
        workspace.saveDiagramDiscussionEntry(input.projectId, entry)
        return { ok: true, diagnostics: [], value: entry }
      },
    )
  }

  function analyzeVisualChange(input: AnalyzeVisualChangeInput): DesignOperationResult<DesignImpactRecord> {
    return executeChange(
      { operation: 'analyzeVisualChange', projectId: input.projectId, actor: input.actor, idempotencyKey: input.idempotencyKey, targetRecordId: input.elementId },
      () => {
        const architecture = workspace.getApprovedArchitecture(input.projectId)
        if (!architecture) return { ok: false, diagnostics: [makeDiagnostic('EUC16-NOT-FOUND', 'blocker', 'no approved system structure exists')] }
        const moduleDesigns = architecture.moduleIds
          .map((id) => workspace.getApprovedModuleDesign(input.projectId, id) ?? workspace.getModuleDesignDraft(input.projectId, id))
          .filter((d): d is ModuleDesignSpecification => Boolean(d))
        const world: Impact.ImpactWorld = {
          useCaseAnalysis: workspace.getApprovedUseCaseAnalysis(input.projectId),
          architecture,
          moduleDesigns,
          scenarioRuns: workspace.listScenarioRuns(input.projectId),
        }
        // §10 "Analyze impact before applying a visual or structural change" —
        // computed before any record change; nothing above this point mutates a record.
        const impact = Impact.analyzeDesignChange({
          projectId: input.projectId,
          changeKind: input.changeKind,
          initiatingRecordId: input.initiatingRecordId,
          initiatingRevision: input.initiatingRevision,
          description: input.description,
          target: input.target,
          world,
          createdAt: clock(),
        })
        workspace.saveDesignImpactRecord(input.projectId, impact)
        const entry: DiagramDiscussionEntry = {
          id: `${input.diagramId}.${input.elementId}.${impact.impactId}`,
          elementId: input.elementId,
          diagramId: input.diagramId,
          author: input.actor,
          kind: 'impactAnalysis',
          text: `impact analysis ${impact.impactId}`,
          impactRecordId: impact.impactId,
          at: clock(),
        }
        workspace.saveDiagramDiscussionEntry(input.projectId, entry)
        return { ok: true, diagnostics: [], value: impact, contentHash: impact.contentHash }
      },
    )
  }

  function approveChangePlan(input: ApproveChangePlanInput): DesignOperationResult<DesignImpactRecord> {
    return executeChange(
      { operation: 'approveChangePlan', projectId: input.projectId, actor: input.actor, idempotencyKey: input.idempotencyKey, targetRecordId: input.impactId, claimedAuthority: input.authority },
      () => {
        const impact = workspace.getDesignImpactRecord(input.projectId, input.impactId)
        if (!impact) return { ok: false, diagnostics: [makeDiagnostic('EUC16-NOT-FOUND', 'blocker', `no impact record: ${input.impactId}`)] }
        if (impact.approval) return { ok: false, diagnostics: [makeDiagnostic('EUC16-ALREADY-APPROVED', 'blocker', 'the change plan is already approved')] }
        const approval: DesignApproval = {
          approvedBy: input.actor,
          authority: input.authority,
          approvedAt: clock(),
          recordId: impact.impactId,
          revision: impact.impactId,
          contentHash: impact.contentHash,
        }
        const approved: DesignImpactRecord = { ...impact, approval }
        workspace.saveDesignImpactRecord(input.projectId, approved)
        const entry: DiagramDiscussionEntry = {
          id: `${input.diagramId}.${input.elementId}.${impact.impactId}.approved`,
          elementId: input.elementId,
          diagramId: input.diagramId,
          author: input.actor,
          kind: 'approvedChangePlan',
          text: `change plan approved for ${impact.impactId}`,
          impactRecordId: impact.impactId,
          at: clock(),
        }
        workspace.saveDiagramDiscussionEntry(input.projectId, entry)
        return { ok: true, diagnostics: [], value: approved, contentHash: impact.contentHash, approvalRef: `${impact.impactId}@approved` }
      },
    )
  }

  function createModuleImplementationPacket(
    input: CreateModuleImplementationPacketInput,
  ): DesignOperationResult<ModuleImplementationPacket> {
    return executeChange(
      { operation: 'createModuleImplementationPacket', projectId: input.projectId, actor: input.actor, idempotencyKey: input.idempotencyKey, targetRecordId: input.moduleId },
      () => {
        const design = workspace.getApprovedModuleDesign(input.projectId, input.moduleId)
        if (!design) return { ok: false, diagnostics: [makeDiagnostic('EUC16-NOT-FOUND', 'blocker', `no approved module design for ${input.moduleId}`)] }
        const architecture = workspace.getApprovedArchitecture(input.projectId)
        if (!architecture) return { ok: false, diagnostics: [makeDiagnostic('EUC16-NOT-FOUND', 'blocker', 'no approved system structure exists')] }
        const policy = workspace.getDesignWorkflowPolicy(input.projectId) ?? Baseline.createDefaultPolicy(input.projectId)
        const baseline = workspace.getApprovedDesignBaseline(input.projectId)
        const allApprovedDesigns = collectApprovedDesigns(workspace, input.projectId, architecture)
        const previewContracts = deriveContractRegistry(allApprovedDesigns)
        const otherActiveModules = allApprovedDesigns
          .filter((d) => d.module.moduleId !== input.moduleId)
          .map((d) => ({ moduleId: d.module.moduleId, ownedPaths: d.boundary.ownedPaths }))
        const analysis = workspace.getApprovedUseCaseAnalysis(input.projectId)
        const gate = Baseline.evaluateBuildGate({
          policy,
          baseline: baseline ?? ({ status: 'draft' } as DesignBaseline),
          moduleDesign: design,
          moduleProgress: { useCaseAnalysisApproved: Boolean(analysis), systemStructureApproved: true },
          contracts: previewContracts,
          otherActiveModules,
        })
        if (!gate.ok) return { ok: false, diagnostics: gate.diagnostics.map(UseCase.toDesignDiagnostic) }

        // §9.7 / finding R3 — the packet's contract registry is the real
        // persisted registry (approved-only versions win, not every
        // approved-module's provided operation). `buildModuleImplementationPacket`
        // (contextPacket.ts) refuses the packet when a provided or required
        // contract has no approved persisted version
        // (`assertNoUnapprovedContractForPacket`).
        const persistedContracts = workspace.listContracts(input.projectId)

        // §11.4 / finding R5 — the manifest carries more than the bare
        // module-design JSON: every provided/required *approved* contract,
        // referenced schemas, and applicable project rules from the design,
        // plus (when configured) repository files from the module's owned
        // paths as source entries.
        const manifestDiagnostics: DesignDiagnostic[] = []
        const candidates: ContextPacket.ContextManifestCandidate[] = [
          { kind: 'record', ref: design.id, content: JSON.stringify(design), reason: 'approved module design' },
        ]
        for (const rule of design.rules) {
          candidates.push({
            kind: 'record',
            ref: `rule:${rule.id}`,
            content: JSON.stringify(rule),
            reason: 'applicable project rule from the module design',
          })
        }
        const contractCandidateKeys = new Set<string>()
        const addContractCandidate = (operationId: string, version: string, reason: string) => {
          const key = `${operationId}@${version}`
          if (contractCandidateKeys.has(key)) return
          const approvedContract = persistedContracts.find(
            (c) => c.operationId === operationId && c.version === version && c.status === 'approved',
          )
          if (!approvedContract) return
          contractCandidateKeys.add(key)
          candidates.push({ kind: 'contract', ref: key, content: JSON.stringify(approvedContract.contract), reason })
        }
        for (const provided of design.providedOperations) {
          addContractCandidate(provided.operationId, provided.version, 'provided contract for this module')
        }
        for (const required of design.requiredOperations) {
          const approvedVersion = persistedContracts.find((c) => c.operationId === required.operationId && c.status === 'approved')
          if (approvedVersion) addContractCandidate(required.operationId, approvedVersion.version, 'required contract for this module')
        }
        for (const schema of design.schemas) {
          candidates.push({
            kind: 'schema',
            ref: schema.ref,
            content: JSON.stringify(schema),
            reason: `${schema.role} schema referenced by this module`,
          })
        }
        const readRepositoryContext = executors?.readRepositoryContext
        if (readRepositoryContext) {
          const entries = readRepositoryContext({
            ownedPaths: design.boundary.ownedPaths,
            editableSharedPaths: design.boundary.editableSharedPaths,
          })
          for (const entry of entries) {
            candidates.push({
              kind: 'source',
              ref: entry.ref,
              content: entry.content,
              bytes: entry.bytes,
              contentHash: entry.contentHash,
              reason: entry.reason ?? 'repository context from an owned or editable-shared path',
            })
          }
        } else {
          manifestDiagnostics.push(
            makeDiagnostic(
              'EUC16-REPO-CONTEXT-NOT-COMPILED',
              'warning',
              'repository context was not compiled: no readRepositoryContext executor is configured; the packet includes the module design, contracts, schemas, and rules only',
            ),
          )
        }

        const contextManifest = ContextPacket.buildContextManifest({
          targetRecordId: design.id,
          targetRevision: design.revision,
          limit: input.contextLimitBytes ?? 200000,
          candidates,
        })
        const otherModuleOwnedPaths = collectApprovedDesigns(workspace, input.projectId, architecture)
          .filter((other) => other.module.moduleId !== input.moduleId)
          .flatMap((other) => other.boundary.ownedPaths)
        const result = ContextPacket.buildModuleImplementationPacket({
          projectId: input.projectId,
          design,
          contractRegistry: { contracts: persistedContracts },
          otherModuleOwnedPaths,
          architectureRevision: architecture.revision,
          architectureHash: architecture.contentHash,
          contextManifest,
          implementationSteps: input.implementationSteps ?? [],
          acceptanceCases: design.verification.acceptanceCases,
          testCommands: input.testCommands ?? design.verification.configuredCommands,
          requiredEvidence: input.requiredEvidence ?? design.verification.requiredEvidence,
          // executeChange already required idempotencyKey to be present before invoking run().
          idempotencyKey: input.idempotencyKey!,
          passKind: input.passKind ?? 'initial',
          previousPacketId: input.previousPacketId,
          createdAt: clock(),
        })
        if (!result.ok || !result.packet) return { ok: false, diagnostics: result.diagnostics.map(UseCase.toDesignDiagnostic) }
        workspace.saveContextManifest(input.projectId, contextManifest)
        workspace.saveModuleImplementationPacket(input.projectId, result.packet)
        return {
          ok: true,
          diagnostics: manifestDiagnostics,
          value: result.packet,
          revision: result.packet.moduleDesignRevision,
          contentHash: result.packet.contentHash,
          packetId: result.packet.packetId,
        }
      },
    )
  }

  function importAgentDelta(input: ImportAgentDeltaInput): DesignOperationResult<ReturnedDelta> {
    return executeChange(
      { operation: 'importAgentDelta', projectId: input.projectId, actor: input.actor, idempotencyKey: input.idempotencyKey, targetRecordId: input.delta.deltaId },
      () => {
        const existing = workspace.getReturnedDelta(input.projectId, input.delta.deltaId)
        if (existing) {
          return {
            ok: false,
            diagnostics: [makeDiagnostic('EUC16-DELTA-ALREADY-IMPORTED', 'blocker', `a delta with this id is already imported: ${input.delta.deltaId}`)],
            value: existing,
            agentSource: input.agentSource,
            deltaId: input.delta.deltaId,
            packetId: input.delta.packetId,
          }
        }
        // §19 "Stale response" — preserved as evidence even when a later inspection rejects it (§11.5).
        workspace.saveReturnedDelta(input.projectId, input.delta)
        return {
          ok: true,
          diagnostics: [],
          value: input.delta,
          contentHash: input.delta.contentHash,
          agentSource: input.agentSource,
          deltaId: input.delta.deltaId,
          packetId: input.delta.packetId,
        }
      },
    )
  }

  function inspectAgentDelta(input: InspectAgentDeltaInput): DesignOperationResult<DeltaInspection> {
    return executeChange(
      { operation: 'inspectAgentDelta', projectId: input.projectId, actor: input.actor, idempotencyKey: input.idempotencyKey, targetRecordId: input.deltaId },
      () => {
        const delta = workspace.getReturnedDelta(input.projectId, input.deltaId)
        if (!delta) return { ok: false, diagnostics: [makeDiagnostic('EUC16-NOT-FOUND', 'blocker', `no returned delta: ${input.deltaId}`)] }
        const packet = workspace.getModuleImplementationPacket(input.projectId, delta.packetId)
        const design = packet ? workspace.getApprovedModuleDesign(input.projectId, packet.moduleId) : undefined
        const workspaceRevision = workspaceRevisionProvider?.() ?? design?.revision
        const inspection = DeltaInspector.inspectDelta(
          delta,
          packet,
          {
            workspaceRevision,
            workspaceHash: design?.contentHash,
            approvedDeletes: input.approvedDeletes,
            approvedImpactRecordIds: input.approvedImpactRecordIds,
            contractChangeImpactRecordIds: input.contractChangeImpactRecordIds,
          },
          {
            now: clock(),
            moduleDesign: design,
            contractChanges: input.contractChanges,
            classifyFile: input.classifyFile,
            rollbackPointRef: `${input.deltaId}.rollback`,
            newWarnings: input.newWarnings,
            newDependencies: input.newDependencies,
          },
        )
        workspace.saveDeltaInspection(input.projectId, inspection)
        const diagnostics = inspection.accepted
          ? []
          : inspection.rejectionReasons.map((reason) =>
              makeDiagnostic(`EUC16-DELTA-${reason.toUpperCase()}`, 'blocker', `delta rejected: ${reason}`),
            )
        return { ok: true, diagnostics, value: inspection, contentHash: inspection.inspectedContentHash, deltaId: delta.deltaId, packetId: delta.packetId }
      },
    )
  }

  function approveAgentDelta(input: ApproveAgentDeltaInput): DesignOperationResult<{ inspectionId: string; deltaId: string }> {
    return executeChange(
      { operation: 'approveAgentDelta', projectId: input.projectId, actor: input.actor, idempotencyKey: input.idempotencyKey, targetRecordId: input.inspectionId },
      () => {
        const inspection = workspace.getDeltaInspection(input.projectId, input.inspectionId)
        if (!inspection) return { ok: false, diagnostics: [makeDiagnostic('EUC16-NOT-FOUND', 'blocker', `no delta inspection: ${input.inspectionId}`)] }
        const packet = workspace.getModuleImplementationPacket(input.projectId, inspection.packetId)
        const design = packet ? workspace.getApprovedModuleDesign(input.projectId, packet.moduleId) : undefined
        const currentWorkspaceRevision = workspaceRevisionProvider?.() ?? design?.revision ?? ''
        const result = DeltaInspector.approveDeltaToApply(inspection, { approvedBy: input.actor, currentWorkspaceRevision })
        if (!result.ok) {
          return { ok: false, diagnostics: result.diagnostics.map(UseCase.toDesignDiagnostic), deltaId: inspection.deltaId, packetId: inspection.packetId }
        }
        return {
          ok: true,
          diagnostics: [],
          value: { inspectionId: inspection.inspectionId, deltaId: inspection.deltaId },
          deltaId: inspection.deltaId,
          packetId: inspection.packetId,
          approvalRef: `${inspection.inspectionId}@approved`,
        }
      },
    )
  }

  function applyAgentDelta(input: ApplyAgentDeltaInput): DesignOperationResult<DeltaApplyResult> {
    return executeChange(
      { operation: 'applyAgentDelta', projectId: input.projectId, actor: input.actor, idempotencyKey: input.idempotencyKey, targetRecordId: input.inspectionId },
      () => {
        const inspection = workspace.getDeltaInspection(input.projectId, input.inspectionId)
        if (!inspection) return { ok: false, diagnostics: [makeDiagnostic('EUC16-NOT-FOUND', 'blocker', `no delta inspection: ${input.inspectionId}`)] }
        const wasApproved = workspace
          .listAuditEvents(input.projectId)
          .some((e) => e.operation === 'approveAgentDelta' && e.outcome === 'ok' && e.targetRecordId === inspection.inspectionId)
        if (!wasApproved) {
          return { ok: false, diagnostics: [makeDiagnostic('EUC16-DELTA-NOT-APPROVED', 'blocker', 'the inspected delta was not approved to apply')], deltaId: inspection.deltaId, packetId: inspection.packetId }
        }
        const delta = workspace.getReturnedDelta(input.projectId, inspection.deltaId)
        if (!delta) return { ok: false, diagnostics: [makeDiagnostic('EUC16-NOT-FOUND', 'blocker', `no returned delta: ${inspection.deltaId}`)] }
        if (canonicalHash(delta) !== inspection.inspectedContentHash) {
          return {
            ok: false,
            diagnostics: [makeDiagnostic('EUC16-DELTA-HASH-MISMATCH', 'blocker', 'the delta content changed since inspection; a new inspection is required')],
            deltaId: inspection.deltaId,
            packetId: inspection.packetId,
          }
        }
        const applyDelta = executors?.applyDelta
        if (!applyDelta) {
          return {
            ok: false,
            diagnostics: [makeDiagnostic('EUC16-EXECUTOR-NOT-CONFIGURED', 'blocker', 'no apply-delta executor is configured; the file apply step cannot run')],
            deltaId: inspection.deltaId,
            packetId: inspection.packetId,
          }
        }
        const plan = DeltaInspector.buildApplyPlan(inspection, delta, {
          planId: `${inspection.inspectionId}.plan`,
          backupRef: `${inspection.inspectionId}.backup`,
        })
        const applyResult = applyDelta(plan, delta, { deadlineAt: input.deadlineAt, cancellationRequested: input.cancellationRequested })
        if (!applyResult.applied) {
          return {
            ok: false,
            diagnostics: [makeDiagnostic('EUC16-DELTA-APPLY-FAILED', 'blocker', applyResult.failure ?? 'the delta apply failed and was rolled back')],
            value: applyResult,
            deltaId: inspection.deltaId,
            packetId: inspection.packetId,
          }
        }
        return {
          ok: true,
          diagnostics: [],
          value: applyResult,
          deltaId: inspection.deltaId,
          packetId: inspection.packetId,
          approvalRef: `${inspection.inspectionId}@applied`,
        }
      },
    )
  }

  function verifyModule(
    input: VerifyModuleInput,
  ): DesignOperationResult<{ plan: VerificationPlanner.ModuleAcceptancePlan; passed: boolean; evidenceRefs: string[] }> {
    return executeChange(
      { operation: 'verifyModule', projectId: input.projectId, actor: input.actor, idempotencyKey: input.idempotencyKey, targetRecordId: input.moduleId },
      () => {
        const design = workspace.getApprovedModuleDesign(input.projectId, input.moduleId)
        if (!design) return { ok: false, diagnostics: [makeDiagnostic('EUC16-NOT-FOUND', 'blocker', `no approved module design for ${input.moduleId}`)] }
        const plan = VerificationPlanner.buildModuleAcceptancePlan(design)
        const verify = executors?.verifyModule
        if (!verify) {
          return {
            ok: false,
            diagnostics: [makeDiagnostic('EUC16-EXECUTOR-NOT-CONFIGURED', 'blocker', 'no module-verification executor is configured')],
            value: { plan, passed: false, evidenceRefs: [] },
          }
        }
        const outcome = verify({ design, plan }, { deadlineAt: input.deadlineAt, cancellationRequested: input.cancellationRequested })
        return {
          ok: outcome.passed,
          diagnostics: outcome.diagnostics ?? [],
          value: { plan, passed: outcome.passed, evidenceRefs: outcome.evidenceRefs ?? [] },
          evidenceRefs: outcome.evidenceRefs ?? [],
        }
      },
    )
  }

  function configureBinding(input: ConfigureBindingInput): DesignOperationResult<unknown> {
    return executeChange(
      { operation: 'configureBinding', projectId: input.projectId, actor: input.actor, idempotencyKey: input.idempotencyKey, targetRecordId: input.moduleId },
      () => {
        const configure = executors?.configureBinding
        if (!configure) {
          return { ok: false, diagnostics: [makeDiagnostic('EUC16-EXECUTOR-NOT-CONFIGURED', 'blocker', 'no binding-configuration executor is configured')] }
        }
        const outcome = configure(
          { projectId: input.projectId, moduleId: input.moduleId, bindingConfig: input.bindingConfig },
          { deadlineAt: input.deadlineAt, cancellationRequested: input.cancellationRequested },
        )
        return { ok: outcome.ok, diagnostics: outcome.diagnostics ?? [], value: outcome.value }
      },
    )
  }

  function verifyConnection(input: VerifyConnectionInput): DesignOperationResult<unknown> {
    return executeChange(
      { operation: 'verifyConnection', projectId: input.projectId, actor: input.actor, idempotencyKey: input.idempotencyKey, targetRecordId: input.moduleId },
      () => {
        const verify = executors?.verifyConnection
        if (!verify) {
          return { ok: false, diagnostics: [makeDiagnostic('EUC16-EXECUTOR-NOT-CONFIGURED', 'blocker', 'no connection-verification executor is configured')] }
        }
        const outcome = verify(
          { projectId: input.projectId, moduleId: input.moduleId, bindingConfig: input.bindingConfig },
          { deadlineAt: input.deadlineAt, cancellationRequested: input.cancellationRequested },
        )
        return { ok: outcome.ok, diagnostics: outcome.diagnostics ?? [], value: outcome.value }
      },
    )
  }

  function runScenario(input: RunScenarioInput): DesignOperationResult<ScenarioRun> {
    return executeChange(
      { operation: 'runScenario', projectId: input.projectId, actor: input.actor, idempotencyKey: input.idempotencyKey, targetRecordId: input.scenarioId },
      () => {
        const analysis = workspace.getApprovedUseCaseAnalysis(input.projectId)
        if (!analysis) return { ok: false, diagnostics: [makeDiagnostic('EUC16-NOT-FOUND', 'blocker', 'no approved use-case analysis exists')] }
        const testPlan = VerificationPlanner.buildScenarioTestPlan(analysis)
        const entry = testPlan.entries.find((e) => e.scenarioId === input.scenarioId)
        if (!entry) return { ok: false, diagnostics: [makeDiagnostic('EUC16-NOT-FOUND', 'blocker', `no scenario test-plan entry: ${input.scenarioId}`)] }
        const runner = executors?.runScenario
        if (!runner) {
          return { ok: false, diagnostics: [makeDiagnostic('EUC16-EXECUTOR-NOT-CONFIGURED', 'blocker', 'no scenario-runner executor is configured')] }
        }
        const outcome = runner({ entry, analysis }, { deadlineAt: input.deadlineAt, cancellationRequested: input.cancellationRequested })
        const architecture = workspace.getApprovedArchitecture(input.projectId)
        const application = workspace.getApprovedApplication(input.projectId)
        const approvedDesigns = architecture ? collectApprovedDesigns(workspace, input.projectId, architecture) : []
        const moduleDesignRevisions: Record<string, string> = {}
        for (const d of approvedDesigns) moduleDesignRevisions[d.module.moduleId] = d.revision
        const identity = VerificationPlanner.scenarioRunIdentity({
          useCaseAnalysisRevision: analysis.revision,
          applicationRevision: application?.revision ?? '',
          systemStructureRevision: architecture?.revision ?? '',
          moduleDesignRevisions,
          implementationRevisions: {},
          connectionRevision: input.identity?.connectionRevision ?? '',
          build: input.identity?.build ?? '',
          sourceRevision: input.identity?.sourceRevision ?? '',
          environment: input.identity?.environment ?? '',
          testDataRevision: input.identity?.testDataRevision ?? '',
          runner: input.identity?.runner ?? 'euc16',
        })
        const runId = `run.${entry.scenarioId}.${input.idempotencyKey}`
        const withoutHash: Omit<ScenarioRun, 'contentHash'> = {
          schemaVersion: '1.0',
          runId,
          projectId: input.projectId,
          scenarioId: entry.scenarioId,
          useCaseId: entry.useCaseId,
          identity,
          steps: outcome.steps,
          outcome: outcome.outcome,
          startedAt: outcome.startedAt,
          completedAt: outcome.completedAt,
          evidenceHashes: outcome.steps.map((s) => s.evidenceHash).filter((h): h is string => Boolean(h)),
        }
        const run: ScenarioRun = { ...withoutHash, contentHash: canonicalHash(withoutHash) }
        workspace.saveScenarioRun(input.projectId, run)
        return { ok: run.outcome === 'passed', diagnostics: [], value: run, contentHash: run.contentHash }
      },
    )
  }

  function approveVerification(input: ApproveVerificationInput): DesignOperationResult<{ runId: string }> {
    return executeChange(
      { operation: 'approveVerification', projectId: input.projectId, actor: input.actor, idempotencyKey: input.idempotencyKey, targetRecordId: input.runId, claimedAuthority: input.authority },
      () => {
        const run = workspace.getScenarioRun(input.projectId, input.runId)
        if (!run) return { ok: false, diagnostics: [makeDiagnostic('EUC16-NOT-FOUND', 'blocker', `no scenario run: ${input.runId}`)] }
        return { ok: true, diagnostics: [], value: { runId: run.runId }, contentHash: run.contentHash, approvalRef: `${run.runId}@verified` }
      },
    )
  }

  return {
    // §17.1 read operations
    getWorkflowStatus,
    getValidNextActions,
    getSystemDesign,
    listModuleDesigns,
    getModuleDesign,
    getModuleContext,
    getModuleImpact,
    getImplementationWaves,
    getScenarioCoverage,
    getVerificationEvidence,
    // §17.2 change operations
    createUseCaseDraft,
    updateUseCaseItem,
    approveUseCaseAnalysis,
    createSystemDesignDraft,
    applySystemDesignDecision,
    approveSystemStructure,
    startModuleDesign,
    answerModuleDesignQuestion,
    updateModuleDesignItem,
    analyzeModuleDesign,
    approveModuleDesign,
    reopenModuleDesign,
    createDesignBaseline,
    approveDesignBaseline,
    proposeVisualChange,
    analyzeVisualChange,
    approveChangePlan,
    createModuleImplementationPacket,
    importAgentDelta,
    inspectAgentDelta,
    approveAgentDelta,
    applyAgentDelta,
    verifyModule,
    configureBinding,
    verifyConnection,
    runScenario,
    approveVerification,
  }
}

export type DesignOperationsService = ReturnType<typeof createDesignOperations>

// ---------------------------------------------------------------------------
// Change-operation input types (§17.2)
// ---------------------------------------------------------------------------

export type CreateUseCaseDraftInput = ChangeOperationInput & {
  projectId: string
  workDescription: string
  examples?: string[]
  prohibitedResults?: string[]
  sources?: { name: string; ref: string; required: boolean; status?: 'ok' | 'failed'; failureCause?: string }[]
}

export type UpdateUseCaseItemInput = ChangeOperationInput & {
  projectId: string
  target:
    | { kind: 'question'; questionId: string; answer: string }
    | { kind: 'item'; itemId: string; action: 'accept' | 'correct' | 'reject'; text?: string }
}

export type ApproveUseCaseAnalysisInput = ChangeOperationInput & { projectId: string; authority: ApprovalAuthority }

export type CreateSystemDesignDraftInput = ChangeOperationInput & {
  projectId: string
  architectureId?: string
  primaryModuleId?: string
  primaryModuleName?: string
  primaryModuleType?: ModuleType
  primaryDeployableId?: string
}

export type SystemDesignDecision =
  | { kind: 'rename'; moduleId: string; name: string }
  | { kind: 'changePurpose'; moduleId: string; responsibility: string; reason?: string }
  | { kind: 'changeType'; moduleId: string; moduleType: ModuleType }
  | { kind: 'split'; moduleId: string; newModules: SystemDesign.SplitModuleTarget[] }
  | { kind: 'merge'; moduleIds: string[]; merged: SystemDesign.MergeModuleTarget }
  | { kind: 'moveOperation'; operationId: string; toModuleId: string }
  | { kind: 'addDependency'; fromModuleId: string; toModuleId: string; reason: string }
  | { kind: 'removeDependency'; fromModuleId: string; toModuleId: string }
  | { kind: 'addAdapterAllocation'; allocation: { adapterId: string; portId: string; moduleId: string } }
  | { kind: 'changeAdapterAllocation'; adapterId: string; newModuleId: string }
  | { kind: 'moveToDeployable'; moduleId: string; targetDeployableId: string; options?: SystemDesign.MoveModuleToDeployableOptions }
  | { kind: 'changeOwnedPath'; moduleId: string; ownedPaths: string[] }

export type ApplySystemDesignDecisionInput = ChangeOperationInput & { projectId: string; decision: SystemDesignDecision }

export type ApproveSystemStructureInput = ChangeOperationInput & { projectId: string; authority: ApprovalAuthority }

export type StartModuleDesignInput = ChangeOperationInput & {
  projectId: string
  moduleId: string
  moduleVersion?: string
  owner?: string
  deployableId?: string
  runtimeAllocation?: string
  runtimeLanguage?: string
  ownedPaths?: string[]
  editableSharedPaths?: string[]
  contextLimitBytes?: number
}

export type AnswerModuleDesignQuestionInput = ChangeOperationInput & {
  projectId: string
  moduleId: string
  questionId: string
  step: ModuleDesignStep
  text: string
}

export type UpdateModuleDesignItemInput = ChangeOperationInput & { projectId: string; moduleId: string; path: string; value: unknown }

export type AnalyzeModuleDesignInput = ChangeOperationInput & { projectId: string; moduleId: string }

export type ApproveModuleDesignOpInput = ChangeOperationInput & { projectId: string; moduleId: string; authority: ApprovalAuthority }

export type ReopenModuleDesignInput = ChangeOperationInput & { projectId: string; moduleId: string }

export type CreateDesignBaselineOpInput = ChangeOperationInput & { projectId: string; baselineId?: string }

export type ApproveDesignBaselineOpInput = ChangeOperationInput & { projectId: string; authority: ApprovalAuthority }

export type ProposeVisualChangeInput = ChangeOperationInput & {
  projectId: string
  diagramId: string
  elementId: string
  description: string
}

export type AnalyzeVisualChangeInput = ChangeOperationInput & {
  projectId: string
  diagramId: string
  elementId: string
  changeKind: DesignChangeKind
  initiatingRecordId: string
  initiatingRevision: string
  description: string
  target?: Impact.ImpactChangeTarget
}

export type ApproveChangePlanInput = ChangeOperationInput & {
  projectId: string
  diagramId: string
  elementId: string
  impactId: string
  authority: ApprovalAuthority
}

export type CreateModuleImplementationPacketInput = ChangeOperationInput & {
  projectId: string
  moduleId: string
  implementationSteps?: string[]
  testCommands?: string[]
  requiredEvidence?: string[]
  contextLimitBytes?: number
  passKind?: ModuleImplementationPacket['passKind']
  previousPacketId?: string
}

export type ImportAgentDeltaInput = ChangeOperationInput & { projectId: string; delta: ReturnedDelta; agentSource?: string }

export type InspectAgentDeltaInput = ChangeOperationInput & {
  projectId: string
  deltaId: string
  approvedDeletes?: string[]
  approvedImpactRecordIds?: string[]
  contractChangeImpactRecordIds?: Record<string, string>
  contractChanges?: DeltaInspector.ContractChangeInput[]
  classifyFile?: (path: string) => 'generated' | 'userOwned'
  newWarnings?: string[]
  newDependencies?: string[]
}

export type ApproveAgentDeltaInput = ChangeOperationInput & { projectId: string; inspectionId: string }

export type ApplyAgentDeltaInput = ChangeOperationInput & { projectId: string; inspectionId: string }

export type VerifyModuleInput = ChangeOperationInput & { projectId: string; moduleId: string }

export type ConfigureBindingInput = ChangeOperationInput & { projectId: string; moduleId: string; bindingConfig: unknown }

export type VerifyConnectionInput = ChangeOperationInput & { projectId: string; moduleId: string; bindingConfig?: unknown }

export type RunScenarioInput = ChangeOperationInput & {
  projectId: string
  scenarioId: string
  identity?: Partial<VerificationPlanner.ScenarioRunIdentityInput>
}

export type ApproveVerificationInput = ChangeOperationInput & { projectId: string; runId: string; authority: ApprovalAuthority }
