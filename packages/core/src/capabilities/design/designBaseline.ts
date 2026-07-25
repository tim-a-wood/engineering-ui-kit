/**
 * EUC-06 — Design baseline.
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §3.5, §6.2,
 * §16.6, §16.7, §25.3 (EUC-06). Creates and approves the exact architecture
 * and required module-design set, owns the complete/incremental gate-mode
 * policy, and calculates baseline staleness.
 *
 * Reuses `ArchitectureSpecification` (../types.js) and the canonical
 * `DesignBaseline` / `DesignWorkflowPolicy` / `ModuleDesignSpecification`
 * records and approval primitives (./records.ts). Depends on EUC-05's
 * `RegisteredContract` envelope for approved-contract lookups.
 */

import type { ArchitectureSpecification } from '../types.js'
import { diagnostic, sortDiagnostics, type CapDiagnostic } from '../diagnostics.js'
import { canonicalHash } from '../hash.js'
import {
  isAgentActor,
  type DesignBaseline,
  type DesignWorkflowPolicy,
  type ModuleDesignSpecification,
} from './records.js'
import type { GateResult } from '../gates.js'
import type { RegisteredContract } from './contractRegistry.js'

function moduleIdOf(design: ModuleDesignSpecification): string {
  return design.module.moduleId
}

// ---------------------------------------------------------------------------
// §16.6 — Complete Design baseline
// ---------------------------------------------------------------------------

export type CreateDesignBaselineInput = {
  baselineId: string
  revision?: string
  projectId?: string
}

/**
 * §16.6 blocking gates: the system structure must be approved, every
 * allocated module needs an approved module design, and every provided or
 * required operation on an approved module design needs an approved
 * contract.
 */
export function evaluateDesignBaselineGates(
  architecture: ArchitectureSpecification,
  moduleDesigns: ModuleDesignSpecification[],
  contracts: RegisteredContract[],
): GateResult[] {
  const gates: GateResult[] = []

  const archDiagnostics: CapDiagnostic[] = []
  if (architecture.status !== 'approved') {
    archDiagnostics.push(
      diagnostic('CAP-DES-BASE-ARCH', 'the system structure must be approved before the Design baseline', {
        ruleId: 'CAP-DES-BASE-ARCH',
        relatedIds: [architecture.id],
      }),
    )
  }
  gates.push({ gateId: 'CAP-DES-BASE-ARCH', passed: archDiagnostics.length === 0, diagnostics: archDiagnostics })

  const requiredModuleIds = [...new Set(architecture.moduleIds ?? [])].sort((a, b) => a.localeCompare(b))
  const approvedModuleIds = new Set(moduleDesigns.filter((d) => d.status === 'approved').map(moduleIdOf))
  const moduleDiagnostics: CapDiagnostic[] = requiredModuleIds
    .filter((id) => !approvedModuleIds.has(id))
    .map((id) =>
      diagnostic('CAP-DES-BASE-MODULE', 'a required module design is not approved', {
        ruleId: 'CAP-DES-BASE-MODULE',
        relatedIds: [id],
      }),
    )
  gates.push({ gateId: 'CAP-DES-BASE-MODULES', passed: moduleDiagnostics.length === 0, diagnostics: moduleDiagnostics })

  const contractDiagnostics: CapDiagnostic[] = []
  for (const design of moduleDesigns.filter((d) => approvedModuleIds.has(moduleIdOf(d)))) {
    for (const provided of design.providedOperations) {
      const approved = contracts.some(
        (c) => c.operationId === provided.operationId && c.version === provided.version && c.status === 'approved',
      )
      if (!approved) {
        contractDiagnostics.push(
          diagnostic('CAP-DES-BASE-CONTRACT', 'a provided operation has no approved contract', {
            ruleId: 'CAP-DES-BASE-CONTRACT',
            relatedIds: [moduleIdOf(design), `${provided.operationId}@${provided.version}`],
          }),
        )
      }
    }
    for (const required of design.requiredOperations) {
      const approvedProvider = contracts.some((c) => c.operationId === required.operationId && c.status === 'approved')
      if (!approvedProvider) {
        contractDiagnostics.push(
          diagnostic('CAP-DES-BASE-REQUIRED', 'a required operation has no approved provider contract', {
            ruleId: 'CAP-DES-BASE-CONTRACT',
            relatedIds: [moduleIdOf(design), required.operationId],
          }),
        )
      }
    }
  }
  gates.push({ gateId: 'CAP-DES-BASE-CONTRACTS', passed: contractDiagnostics.length === 0, diagnostics: contractDiagnostics })

  return gates
}

export function createDesignBaseline(
  architecture: ArchitectureSpecification,
  moduleDesigns: ModuleDesignSpecification[],
  contracts: RegisteredContract[],
  input: CreateDesignBaselineInput,
): DesignBaseline {
  const requiredModuleIds = [...new Set(architecture.moduleIds ?? [])].sort((a, b) => a.localeCompare(b))
  const approvedByModuleId = new Map(
    moduleDesigns.filter((d) => d.status === 'approved').map((d) => [moduleIdOf(d), d] as const),
  )
  const missingModuleIds = requiredModuleIds.filter((id) => !approvedByModuleId.has(id))
  const modules = requiredModuleIds
    .filter((id) => approvedByModuleId.has(id))
    .map((id) => {
      const design = approvedByModuleId.get(id)!
      return { moduleId: id, designId: design.id, revision: design.revision, contentHash: design.contentHash }
    })
  const operationContracts = contracts
    .filter((c) => c.status === 'approved')
    .map((c) => ({ operationId: c.operationId, version: c.version, contentHash: c.contentHash }))
    .sort((a, b) => a.operationId.localeCompare(b.operationId) || a.version.localeCompare(b.version))

  const gates = evaluateDesignBaselineGates(architecture, moduleDesigns, contracts)

  const draft: DesignBaseline = {
    schemaVersion: '1.0',
    projectId: input.projectId ?? architecture.projectId,
    id: input.baselineId,
    revision: input.revision ?? 'r1',
    status: 'draft',
    architecture: { id: architecture.id, revision: architecture.revision, contentHash: architecture.contentHash },
    modules,
    operationContracts,
    requiredModuleIds,
    missingModuleIds,
    gates,
    contentHash: '',
  }
  return { ...draft, contentHash: canonicalHash({ ...draft, contentHash: undefined }) }
}

export type ApproveDesignBaselineInput = { approvedBy: string; authority: string; approvedAt?: string }

export type ApproveDesignBaselineResult = {
  ok: boolean
  baseline?: DesignBaseline
  diagnostics: CapDiagnostic[]
}

/** §16.6 — approve only when `missingModuleIds` is empty and every blocking gate passes. */
export function approveDesignBaseline(
  baseline: DesignBaseline,
  approval: ApproveDesignBaselineInput,
): ApproveDesignBaselineResult {
  if (baseline.status === 'approved') {
    return {
      ok: false,
      diagnostics: [diagnostic('CAP-DES-BASE-ALREADY-APPROVED', 'the Design baseline is already approved', { relatedIds: [baseline.id] })],
    }
  }
  if (isAgentActor(approval.approvedBy)) {
    return {
      ok: false,
      diagnostics: [
        diagnostic('CAP-DES-BASE-AGENT-APPROVAL', 'an agent actor cannot approve the Design baseline', {
          ruleId: 'CAP-4',
          relatedIds: [approval.approvedBy],
        }),
      ],
    }
  }
  const diagnostics: CapDiagnostic[] = []
  if (baseline.missingModuleIds.length) {
    diagnostics.push(
      diagnostic('CAP-DES-BASE-MISSING', 'the Design baseline cannot be approved while module designs are missing', {
        ruleId: 'CAP-DES-BASE-16.6',
        relatedIds: baseline.missingModuleIds,
      }),
    )
  }
  for (const gate of baseline.gates) {
    if (!gate.passed) diagnostics.push(...gate.diagnostics)
  }
  if (diagnostics.length) return { ok: false, diagnostics: sortDiagnostics(diagnostics) }

  const approvedAt = approval.approvedAt ?? new Date(0).toISOString()
  const withStatus: DesignBaseline = { ...baseline, status: 'approved' }
  const contentHash = canonicalHash({ ...withStatus, contentHash: undefined, approval: undefined })
  const approved: DesignBaseline = {
    ...withStatus,
    contentHash,
    approval: {
      approvedBy: approval.approvedBy,
      authority: approval.authority,
      approvedAt,
      recordId: baseline.id,
      revision: baseline.revision,
      contentHash,
    },
  }
  return { ok: true, baseline: approved, diagnostics: [] }
}

/** Stale when a linked module design revision or the architecture revision changed. */
export function baselineStaleness(
  baseline: DesignBaseline,
  currentDesigns: ModuleDesignSpecification[],
  currentArchitecture?: { revision: string },
): boolean {
  if (currentArchitecture && currentArchitecture.revision !== baseline.architecture.revision) return true
  const currentByModuleId = new Map(currentDesigns.map((d) => [moduleIdOf(d), d]))
  for (const linked of baseline.modules) {
    const current = currentByModuleId.get(linked.moduleId)
    if (!current) continue
    if (current.revision !== linked.revision || current.contentHash !== linked.contentHash) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// §3.5 / §16.7 — Design workflow (gate-mode) policy
// ---------------------------------------------------------------------------

export function createDefaultPolicy(
  projectId: string,
  changedBy = 'system',
  changedAt = new Date(0).toISOString(),
): DesignWorkflowPolicy {
  return { projectId, mode: 'completeBaseline', changedAt, changedBy }
}

export type ChangeGateModeResult = { ok: boolean; policy?: DesignWorkflowPolicy; diagnostics: CapDiagnostic[] }

/**
 * A change to `incrementalModules` shall be an approved project decision
 * (§3.5). Changing the policy shall not change an existing record approval
 * (§16.7) — this function only ever returns a new policy value.
 */
export function changeGateMode(
  policy: DesignWorkflowPolicy,
  mode: DesignWorkflowPolicy['mode'],
  approvedDecisionId: string | undefined,
  actor: string,
  changedAt = new Date(0).toISOString(),
): ChangeGateModeResult {
  if (isAgentActor(actor)) {
    return {
      ok: false,
      diagnostics: [
        diagnostic('CAP-DES-POLICY-AGENT', 'an agent actor cannot change the Design-to-Build gate mode', {
          ruleId: 'CAP-4',
          relatedIds: [actor],
        }),
      ],
    }
  }
  if (mode === 'incrementalModules' && !approvedDecisionId) {
    return {
      ok: false,
      diagnostics: [
        diagnostic('CAP-DES-POLICY-DECISION', 'switching to incrementalModules requires an approved project decision', {
          ruleId: 'CAP-DES-POLICY-3.5',
        }),
      ],
    }
  }
  return {
    ok: true,
    policy: {
      projectId: policy.projectId,
      mode,
      approvedDecisionId: mode === 'incrementalModules' ? approvedDecisionId : undefined,
      changedAt,
      changedBy: actor,
    },
    diagnostics: [],
  }
}

// ---------------------------------------------------------------------------
// §6.2 — Build gate
// ---------------------------------------------------------------------------

export type BuildGateInput = {
  policy: DesignWorkflowPolicy
  baseline: DesignBaseline
  moduleDesign: ModuleDesignSpecification
  moduleProgress: { useCaseAnalysisApproved: boolean; systemStructureApproved: boolean }
  contracts: RegisteredContract[]
  otherActiveModules: { moduleId: string; ownedPaths: string[] }[]
  blockingImpactRecordIds?: string[]
}

export type BuildGateResult = { ok: boolean; diagnostics: CapDiagnostic[] }

/**
 * §6.2 — in `completeBaseline` mode, implementation handoffs remain blocked
 * until the complete Design baseline is approved. In `incrementalModules`
 * mode, a module can enter Build only when every dependency-closed
 * eligibility condition holds; every failing condition is returned so the
 * interface can show the exact blocking diagnostics.
 */
export function evaluateBuildGate(input: BuildGateInput): BuildGateResult {
  const diagnostics: CapDiagnostic[] = []

  if (input.policy.mode === 'completeBaseline') {
    if (input.baseline.status !== 'approved') {
      diagnostics.push(
        diagnostic(
          'CAP-DES-BUILD-BASELINE',
          'implementation handoffs remain blocked until the complete Design baseline is approved',
          { ruleId: 'CAP-DES-BUILD-6.2' },
        ),
      )
    }
    return { ok: diagnostics.length === 0, diagnostics: sortDiagnostics(diagnostics) }
  }

  if (!input.moduleProgress.useCaseAnalysisApproved) {
    diagnostics.push(
      diagnostic('CAP-DES-BUILD-USECASE', 'the use-case analysis must be approved before Build', {
        ruleId: 'CAP-DES-BUILD-6.2',
      }),
    )
  }
  if (!input.moduleProgress.systemStructureApproved) {
    diagnostics.push(
      diagnostic('CAP-DES-BUILD-STRUCTURE', 'the system structure must be approved before Build', {
        ruleId: 'CAP-DES-BUILD-6.2',
      }),
    )
  }
  if (input.moduleDesign.status !== 'approved') {
    diagnostics.push(
      diagnostic('CAP-DES-BUILD-MODULE', 'the module design must be approved before Build', {
        ruleId: 'CAP-DES-BUILD-6.2',
        relatedIds: [input.moduleDesign.module.moduleId],
      }),
    )
  }
  for (const provided of input.moduleDesign.providedOperations) {
    const approved = input.contracts.some(
      (c) => c.operationId === provided.operationId && c.version === provided.version && c.status === 'approved',
    )
    if (!approved) {
      diagnostics.push(
        diagnostic('CAP-DES-BUILD-CONTRACT', 'every provided operation contract must be approved before Build', {
          ruleId: 'CAP-DES-BUILD-6.2',
          relatedIds: [provided.operationId, provided.version],
        }),
      )
    }
  }
  for (const required of input.moduleDesign.requiredOperations) {
    const approvedProvider = input.contracts.some((c) => c.operationId === required.operationId && c.status === 'approved')
    if (!approvedProvider) {
      diagnostics.push(
        diagnostic('CAP-DES-BUILD-PROVIDER', 'every required operation must have an approved provider contract before Build', {
          ruleId: 'CAP-DES-BUILD-6.2',
          relatedIds: [required.operationId],
        }),
      )
    }
  }
  if (!input.moduleDesign.boundary.deployableId || !input.moduleDesign.boundary.runtimeAllocation) {
    diagnostics.push(
      diagnostic('CAP-DES-BUILD-DEPLOYABLE', 'the module deployable and runtime allocation must be approved before Build', {
        ruleId: 'CAP-DES-BUILD-6.2',
        relatedIds: [input.moduleDesign.module.moduleId],
      }),
    )
  }
  const ownedPaths = new Set(input.moduleDesign.boundary.ownedPaths)
  for (const other of input.otherActiveModules) {
    const overlap = other.ownedPaths.filter((p) => ownedPaths.has(p))
    if (overlap.length) {
      diagnostics.push(
        diagnostic('CAP-DES-BUILD-PATH-CONFLICT', 'the module owned paths conflict with another active module', {
          ruleId: 'CAP-DES-BUILD-6.2',
          relatedIds: [input.moduleDesign.module.moduleId, other.moduleId, ...overlap],
        }),
      )
    }
  }
  if (input.blockingImpactRecordIds?.length) {
    diagnostics.push(
      diagnostic('CAP-DES-BUILD-IMPACT', 'a blocking impact record applies to this module', {
        ruleId: 'CAP-DES-BUILD-6.2',
        relatedIds: input.blockingImpactRecordIds,
      }),
    )
  }

  return { ok: diagnostics.length === 0, diagnostics: sortDiagnostics(diagnostics) }
}
