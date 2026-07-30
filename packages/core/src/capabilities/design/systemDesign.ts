/**
 * EUC-03 — System-design core.
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §3.1, §6.1,
 * §8, §25.3 (EUC-03). Creates and changes the simplest valid system
 * structure, evaluates the system-structure gate, and approves the
 * structure without claiming module behavior is complete (§8.3).
 *
 * Depends only on EUC-02 output (`ApplicationSpecification`). Builds on the
 * shared, read-only `ArchitectureSpecification` contract (../types.js) and
 * the shared design-record approval primitives (./records.ts). This module
 * extends `ArchitectureSpecification` locally with fields the canonical
 * contract does not yet carry (deployables, owned-path allocation, the
 * structure-approval statement) — see the end-of-packet notes for the
 * requested `types.ts` change.
 */

import type {
  ApplicationSpecification,
  ArchitectureModuleDefinition,
  ArchitectureSpecification,
  DependencyEdge,
  ModuleType,
  NamedText,
} from '../types.js'
import { diagnostic, sortDiagnostics, type CapDiagnostic } from '../diagnostics.js'
import { detectCycles, type CapabilityGraph } from '../graph.js'
import { canonicalHash } from '../hash.js'
import type { GateResult } from '../gates.js'
import { isNonHumanActor, type DesignApproval } from './records.js'
import {
  evaluateArchitectureApplicationLink,
  evaluateSolutionAllocations,
  materializeApplicationWorkflows,
} from '../applicationWorkflow.js'
import { isExecutableActivityNode } from '../activityGraph.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** CAP-DES-SYS-003 — valid reasons for a separate deployable. */
export const SPLIT_REASONS = [
  'runtime',
  'trustBoundary',
  'owner',
  'scale',
  'releaseTiming',
  'faultIsolation',
  'legalSeparation',
  'safetySeparation',
] as const
export type SplitReason = (typeof SPLIT_REASONS)[number]
const SPLIT_REASON_SET = new Set<string>(SPLIT_REASONS)

export type DeployableAllocation = {
  deployableId: string
  name: string
  moduleIds: string[]
  /** Required for every deployable beyond the first (CAP-DES-SYS-002/003). */
  splitReason?: SplitReason
  splitJustification?: string
}

export type ModuleOwnedPathAllocation = {
  moduleId: string
  ownedPaths: string[]
}

/**
 * Local extension of the canonical `ArchitectureSpecification`
 * (types.ts CAP-CONTRACT-002) with the system-design-only fields the shared
 * contract does not yet carry.
 */
export type SystemStructureSpecification = ArchitectureSpecification & {
  deployables: DeployableAllocation[]
  modulePaths?: ModuleOwnedPathAllocation[]
  /** §8.3 — approval must not claim module behavior is complete. */
  approvalStatement?: string
  approval?: DesignApproval
}

export type SystemStructureCommandResult = {
  ok: boolean
  architecture?: SystemStructureSpecification
  diagnostics: CapDiagnostic[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x'
}

function withHash(architecture: SystemStructureSpecification): SystemStructureSpecification {
  return {
    ...architecture,
    contentHash: canonicalHash({ ...architecture, contentHash: undefined, approval: undefined }),
  }
}

function commandGuard(architecture: SystemStructureSpecification): CapDiagnostic[] {
  if (architecture.status === 'approved') {
    return [
      diagnostic(
        'CAP-DES-SYS-APPROVED-LOCKED',
        'an approved system structure cannot be edited directly; reopen it first',
        { ruleId: 'CAP-DES-SYS-EDIT' },
      ),
    ]
  }
  return []
}

function requireModule(architecture: SystemStructureSpecification, moduleId: string): CapDiagnostic | undefined {
  if (!(architecture.moduleIds ?? []).includes(moduleId)) {
    return diagnostic('CAP-DES-SYS-UNKNOWN-MODULE', `unknown module id: ${moduleId}`, { relatedIds: [moduleId] })
  }
  return undefined
}

function commandOk(architecture: SystemStructureSpecification): SystemStructureCommandResult {
  return { ok: true, architecture: withHash(architecture), diagnostics: [] }
}

function commandFail(diagnostics: CapDiagnostic[]): SystemStructureCommandResult {
  return { ok: false, diagnostics: sortDiagnostics(diagnostics) }
}

// ---------------------------------------------------------------------------
// Proposal (CAP-DES-SYS-001..008)
// ---------------------------------------------------------------------------

export type ProposeSystemStructureOptions = {
  architectureId: string
  revision?: string
  /** Every operation the application must expose; each is allocated to the one core module. */
  operations: { operationId: string }[]
  primaryModuleId?: string
  primaryModuleName?: string
  primaryModuleType?: ModuleType
  primaryDeployableId?: string
}

const DEFAULT_PRIMARY_MODULE_ID = 'mod.core'
const DEFAULT_DEPLOYABLE_ID = 'deployable.primary'

/**
 * CAP-DES-SYS-001..008 — deterministic simplest-structure proposal: one
 * module owns every operation, one deployable holds every module, and one
 * dedicated port + actor-specific adapter module exists per external system.
 */
export function proposeSystemStructure(
  application: ApplicationSpecification,
  options: ProposeSystemStructureOptions,
): SystemStructureSpecification {
  const primaryModuleId = options.primaryModuleId ?? DEFAULT_PRIMARY_MODULE_ID
  const primaryModuleType: ModuleType = options.primaryModuleType ?? 'workflow'
  const primaryModuleName = options.primaryModuleName ?? 'Core application'
  const deployableId = options.primaryDeployableId ?? DEFAULT_DEPLOYABLE_ID
  const needsWorkflowBoundary = primaryModuleType === 'experience' && application.useCases.length > 1
  const workflowModuleId = `${primaryModuleId}.workflow`
  const operationOwnerId = needsWorkflowBoundary ? workflowModuleId : primaryModuleId

  const externalSystems = [...(application.externalSystems ?? [])].sort((a, b) => a.id.localeCompare(b.id))
  const useCaseNames = application.useCases.map((useCase) => useCase.text.trim()).filter(Boolean)
  const primaryResponsibility = useCaseNames.length === 1
    ? `Coordinates the approved workflow to ${useCaseNames[0]![0]!.toLocaleLowerCase()}${useCaseNames[0]!.slice(1)}.`
    : useCaseNames.length > 1
      ? `Coordinates the approved workflows for ${useCaseNames.join('; ')}.`
      : `Coordinates ${application.purpose || 'the approved application workflow'}.`

  const moduleDefinitions: ArchitectureModuleDefinition[] = [
    {
      moduleId: primaryModuleId,
      name: primaryModuleName,
      moduleType: primaryModuleType,
      responsibility: primaryResponsibility,
    },
  ]
  const proposals: NamedText[] = [
    {
      id: primaryModuleId,
      text: 'CAP-DES-SYS-001: the simplest structure starts with one module that owns every allocated operation.',
    },
  ]
  const dependencyEdges: DependencyEdge[] = []
  const adapterAllocations: { adapterId: string; moduleId: string; portId: string }[] = []
  const adapterModuleIds: string[] = []

  if (needsWorkflowBoundary) {
    moduleDefinitions.push({
      moduleId: workflowModuleId,
      name: 'Application workflow',
      moduleType: 'workflow',
      responsibility: 'Coordinates approved user tasks and operation outcomes.',
    })
    proposals.push({
      id: workflowModuleId,
      text: 'CAP-DES-SYS-001: a workflow boundary keeps process state outside the user experience.',
    })
    dependencyEdges.push({
      fromModuleId: primaryModuleId,
      toModuleId: workflowModuleId,
      reason: `${primaryModuleName} calls the application workflow through approved operations.`,
    })
  }

  for (const system of externalSystems) {
    const key = slug(system.id)
    const adapterModuleId = `mod.adapter.${key}`
    const label = system.text || system.id
    adapterModuleIds.push(adapterModuleId)
    moduleDefinitions.push({
      moduleId: adapterModuleId,
      name: `${label} adapter`,
      moduleType: 'connection',
      responsibility: `Owns the one actor-specific adapter and port for the external system "${label}" (CAP-DES-SYS-005).`,
    })
    proposals.push({
      id: adapterModuleId,
      text: `CAP-DES-SYS-005: a dedicated adapter module isolates the "${label}" external system behind one port.`,
    })
    adapterAllocations.push({ adapterId: `adapter.${key}`, moduleId: adapterModuleId, portId: `port.${key}` })
    dependencyEdges.push({
      fromModuleId: operationOwnerId,
      toModuleId: adapterModuleId,
      reason: `${primaryModuleName} calls the ${label} adapter through its port.`,
    })
  }

  const moduleIds = [primaryModuleId, ...(needsWorkflowBoundary ? [workflowModuleId] : []), ...adapterModuleIds]
  const sortedModuleIds = [...moduleIds].sort((a, b) => a.localeCompare(b))

  const operations = [...(options.operations ?? [])].sort((a, b) => a.operationId.localeCompare(b.operationId))
  const operationAllocations = operations.map((op) => ({ operationId: op.operationId, moduleId: operationOwnerId }))

  const useCases = [...(application.useCases ?? [])].sort((a, b) => a.id.localeCompare(b.id))
  const workflows = materializeApplicationWorkflows(application)
  const workflowTraces = useCases.map((useCase) => ({
    useCaseId: useCase.id,
    moduleIds: sortedModuleIds,
    nodeAllocations: workflows
      .filter((workflow) => workflow.useCaseId === useCase.id)
      .flatMap((workflow) => workflow.graph.nodes
        .filter(isExecutableActivityNode)
        .map((node) => ({
          workflowId: workflow.id,
          nodeId: node.id,
          primaryModuleId: operationOwnerId,
          participatingModuleIds: needsWorkflowBoundary ? [primaryModuleId] : [],
        }))),
  }))

  const deployables: DeployableAllocation[] = [
    { deployableId, name: 'Primary deployable', moduleIds: sortedModuleIds },
  ]

  const draft: SystemStructureSpecification = {
    schemaVersion: '1.0',
    projectId: application.projectId,
    id: options.architectureId,
    revision: options.revision ?? 'r1',
    status: 'draft',
    applicationSpecId: application.id,
    applicationSpecRevision: application.revision,
    applicationSpecHash: application.contentHash,
    capabilityProjections: [],
    moduleIds,
    moduleDefinitions,
    dependencyEdges,
    operationAllocations,
    adapterAllocations,
    workflowTraces,
    proposals,
    unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-DES-SYS', passed: false, diagnostics: [] },
    deployables,
    modulePaths: [],
    contentHash: '',
  }
  return refreshSystemStructureGate(draft, application, operations.map((operation) => operation.operationId))
}

// ---------------------------------------------------------------------------
// Gate (CAP-DES-SYS-001..008)
// ---------------------------------------------------------------------------

export function evaluateSystemStructureGate(
  architecture: SystemStructureSpecification,
  application: ApplicationSpecification,
  requiredOperationIds: string[] = [],
): GateResult {
  const diagnostics: CapDiagnostic[] = []
  const moduleIds = architecture.moduleIds ?? []
  const dependencyEdges = architecture.dependencyEdges ?? []

  diagnostics.push(
    ...evaluateArchitectureApplicationLink(application, architecture).diagnostics,
    ...evaluateSolutionAllocations(application, architecture).diagnostics,
  )

  // CAP-DES-SYS-004 (part 1) — dependency cycles block approval.
  const graph: CapabilityGraph = {
    nodes: moduleIds.map((id) => ({ id })),
    edges: dependencyEdges.map((e) => ({
      from: e.fromModuleId,
      to: e.toModuleId,
      reason: typeof e.reason === 'string' ? e.reason : '',
    })),
  }
  for (const cycle of detectCycles(graph)) {
    diagnostics.push(
      diagnostic('CAP-DES-SYS-CYCLE', 'a module dependency cycle blocks system-structure approval', {
        ruleId: 'CAP-DES-SYS-004',
        relatedIds: cycle,
      }),
    )
  }

  // CAP-DES-SYS-004 (part 2) — every operation allocated to exactly one module.
  const allocationCounts = new Map<string, number>()
  for (const alloc of architecture.operationAllocations ?? []) {
    allocationCounts.set(alloc.operationId, (allocationCounts.get(alloc.operationId) ?? 0) + 1)
    if (!moduleIds.includes(alloc.moduleId)) {
      diagnostics.push(
        diagnostic('CAP-DES-SYS-OP-MODULE', 'an operation is allocated to an unknown module', {
          ruleId: 'CAP-DES-SYS-004',
          relatedIds: [alloc.operationId, alloc.moduleId],
        }),
      )
    }
  }
  const knownOperationIds = new Set<string>([...requiredOperationIds, ...allocationCounts.keys()])
  for (const operationId of [...knownOperationIds].sort((a, b) => a.localeCompare(b))) {
    const count = allocationCounts.get(operationId) ?? 0
    if (count === 0) {
      diagnostics.push(
        diagnostic('CAP-DES-SYS-UNALLOCATED-OP', 'an operation is not allocated to any module', {
          ruleId: 'CAP-DES-SYS-004',
          relatedIds: [operationId],
        }),
      )
    } else if (count > 1) {
      diagnostics.push(
        diagnostic('CAP-DES-SYS-MULTI-OP', 'an operation is allocated to more than one module', {
          ruleId: 'CAP-DES-SYS-004',
          relatedIds: [operationId],
        }),
      )
    }
  }

  // CAP-DES-SYS-006 — every main use case needs a complete entry-to-output path.
  const traceByUseCase = new Map((architecture.workflowTraces ?? []).map((t) => [t.useCaseId, t.moduleIds ?? []]))
  for (const useCase of application.useCases ?? []) {
    const path = traceByUseCase.get(useCase.id)
    if (!path || path.length === 0) {
      diagnostics.push(
        diagnostic('CAP-DES-SYS-INCOMPLETE-PATH', 'a main use case has no complete entry-to-output path', {
          ruleId: 'CAP-DES-SYS-006',
          relatedIds: [useCase.id],
        }),
      )
    }
  }

  // CAP-DES-SYS-005 — every external system needs exactly one port and one actor-specific adapter.
  for (const system of application.externalSystems ?? []) {
    const key = slug(system.id)
    const matches = (architecture.adapterAllocations ?? []).filter(
      (a) => a.adapterId === `adapter.${key}` || a.portId === `port.${key}`,
    )
    if (matches.length === 0) {
      diagnostics.push(
        diagnostic('CAP-DES-SYS-MISSING-ADAPTER', 'an external system has no port and actor-specific adapter allocation', {
          ruleId: 'CAP-DES-SYS-005',
          relatedIds: [system.id],
        }),
      )
    } else if (matches.length > 1) {
      diagnostics.push(
        diagnostic('CAP-DES-SYS-MULTI-ADAPTER', 'an external system has more than one adapter allocation', {
          ruleId: 'CAP-DES-SYS-005',
          relatedIds: [system.id],
        }),
      )
    }
  }

  // CAP-DES-SYS-002/003 — a split (a deployable beyond the first) needs a valid, justified reason.
  const deployables = architecture.deployables ?? []
  for (let i = 1; i < deployables.length; i++) {
    const deployable = deployables[i]!
    const validReason = deployable.splitReason && SPLIT_REASON_SET.has(deployable.splitReason)
    if (!validReason || !deployable.splitJustification?.trim()) {
      diagnostics.push(
        diagnostic('CAP-DES-SYS-SPLIT-REASON', 'a separate deployable requires a stated, valid split reason', {
          ruleId: 'CAP-DES-SYS-002',
          relatedIds: [deployable.deployableId],
        }),
      )
    }
  }

  // CAP-DES-SYS-007 — every module needs a recorded reason for existing.
  const reasonById = new Map((architecture.proposals ?? []).map((p) => [p.id, p.text]))
  for (const moduleId of moduleIds) {
    const definition = (architecture.moduleDefinitions ?? []).find((d) => d.moduleId === moduleId)
    const hasReason = Boolean(reasonById.get(moduleId)?.trim() || definition?.responsibility?.trim())
    if (!hasReason) {
      diagnostics.push(
        diagnostic('CAP-DES-SYS-NO-REASON', 'a module has no recorded reason for existing', {
          ruleId: 'CAP-DES-SYS-007',
          relatedIds: [moduleId],
        }),
      )
    }
  }

  const sorted = sortDiagnostics(diagnostics)
  return { gateId: 'CAP-DES-SYS', passed: sorted.length === 0, diagnostics: sorted }
}

/** Re-evaluates the visible draft gate and re-hashes the resulting record. */
export function refreshSystemStructureGate(
  architecture: SystemStructureSpecification,
  application: ApplicationSpecification,
  requiredOperationIds: string[] = [],
): SystemStructureSpecification {
  const gate = evaluateSystemStructureGate(architecture, application, requiredOperationIds)
  return withHash({
    ...architecture,
    gateResult: {
      gateId: gate.gateId,
      passed: gate.passed,
      diagnostics: gate.diagnostics.map((entry, index) => ({
        id: `${gate.gateId}.${entry.code}.${index + 1}`,
        code: entry.code,
        message: entry.message,
        relatedIds: entry.relatedIds,
      })),
    },
  })
}

// ---------------------------------------------------------------------------
// Approval (§8.3)
// ---------------------------------------------------------------------------

export type SystemStructureApprovalInput = {
  approvedBy: string
  authority: string
  approvedAt?: string
}

export type SystemStructureApprovalResult = {
  ok: boolean
  architecture?: SystemStructureSpecification
  diagnostics: CapDiagnostic[]
}

/**
 * §8.3 — freezes module IDs/names/types/responsibility summaries, dependency
 * edges, operation/adapter/deployable/use-case-path allocation. The approval
 * explicitly does not claim module behavior is complete.
 */
export function approveSystemStructure(
  architecture: SystemStructureSpecification,
  application: ApplicationSpecification,
  approval: SystemStructureApprovalInput,
  requiredOperationIds: string[] = [],
): SystemStructureApprovalResult {
  if (architecture.status === 'approved') {
    return {
      ok: false,
      diagnostics: [
        diagnostic('CAP-DES-SYS-ALREADY-APPROVED', 'the system structure is already approved', {
          relatedIds: [architecture.id],
        }),
      ],
    }
  }
  // §4, §17.3 (second-review finding — self-asserted approval identity):
  // case-insensitive after trim, and rejects a `service:` actor the same as
  // an `agent:` actor.
  if (isNonHumanActor(approval.approvedBy)) {
    return {
      ok: false,
      diagnostics: [
        diagnostic('CAP-DES-SYS-AGENT-APPROVAL', 'a non-human (agent or service) actor cannot approve the system structure', {
          ruleId: 'CAP-4',
          relatedIds: [approval.approvedBy],
        }),
      ],
    }
  }
  const gate = evaluateSystemStructureGate(architecture, application, requiredOperationIds)
  if (!gate.passed) {
    return { ok: false, diagnostics: gate.diagnostics }
  }

  const approvedAt = approval.approvedAt ?? new Date(0).toISOString()
  const approvalStatement =
    'System structure approved: module boundaries, dependency edges, operation allocation, adapter ' +
    'allocation, deployable allocation, and use-case path allocation are frozen at this revision. ' +
    'This approval does not claim that module behavior is complete; module designs remain open.'

  const withStatus: SystemStructureSpecification = {
    ...architecture,
    status: 'approved',
    approvedAt,
    approvedBy: approval.approvedBy,
    gateResult: { gateId: gate.gateId, passed: true, diagnostics: [] },
    approvalStatement,
  }
  const contentHash = canonicalHash({ ...withStatus, contentHash: undefined, approval: undefined })
  const approved: SystemStructureSpecification = {
    ...withStatus,
    contentHash,
    approval: {
      approvedBy: approval.approvedBy,
      authority: approval.authority,
      approvedAt,
      recordId: architecture.id,
      revision: architecture.revision,
      contentHash,
    },
  }
  return { ok: true, architecture: approved, diagnostics: [] }
}

// ---------------------------------------------------------------------------
// §8.3 display data
// ---------------------------------------------------------------------------

export type ModuleDesignProgressInput = { moduleId: string; approved: boolean }

export type SystemStructureStatusView = {
  approved: boolean
  approvedModuleDesignCount: number
  remainingModuleDesignCount: number
  blockingModuleIds: string[]
  nextModuleId?: string
}

export function systemStructureStatus(
  architecture: SystemStructureSpecification,
  moduleProgress: ModuleDesignProgressInput[],
): SystemStructureStatusView {
  const moduleIds = [...(architecture.moduleIds ?? [])].sort((a, b) => a.localeCompare(b))
  const approvedIds = new Set(moduleProgress.filter((m) => m.approved).map((m) => m.moduleId))
  const approvedModuleDesignCount = moduleIds.filter((id) => approvedIds.has(id)).length
  const remainingModuleDesignCount = moduleIds.length - approvedModuleDesignCount
  const nextModuleId = moduleIds.find((id) => !approvedIds.has(id))

  let blockingModuleIds: string[] = []
  if (nextModuleId) {
    const deps = (architecture.dependencyEdges ?? [])
      .filter((e) => e.fromModuleId === nextModuleId)
      .map((e) => e.toModuleId)
    blockingModuleIds = [...new Set(deps)].filter((id) => !approvedIds.has(id)).sort((a, b) => a.localeCompare(b))
  }

  return {
    approved: architecture.status === 'approved',
    approvedModuleDesignCount,
    remainingModuleDesignCount,
    blockingModuleIds,
    nextModuleId,
  }
}

// ---------------------------------------------------------------------------
// Structural change commands (pure)
// ---------------------------------------------------------------------------

export function renameModule(
  architecture: SystemStructureSpecification,
  moduleId: string,
  name: string,
): SystemStructureCommandResult {
  const guard = commandGuard(architecture)
  if (guard.length) return commandFail(guard)
  const missing = requireModule(architecture, moduleId)
  if (missing) return commandFail([missing])
  const moduleDefinitions = (architecture.moduleDefinitions ?? []).map((d) =>
    d.moduleId === moduleId ? { ...d, name } : d,
  )
  return commandOk({ ...architecture, moduleDefinitions })
}

export function changeModulePurpose(
  architecture: SystemStructureSpecification,
  moduleId: string,
  responsibility: string,
  reason?: string,
): SystemStructureCommandResult {
  const guard = commandGuard(architecture)
  if (guard.length) return commandFail(guard)
  const missing = requireModule(architecture, moduleId)
  if (missing) return commandFail([missing])
  const moduleDefinitions = (architecture.moduleDefinitions ?? []).map((d) =>
    d.moduleId === moduleId ? { ...d, responsibility } : d,
  )
  const proposals = reason
    ? [...(architecture.proposals ?? []).filter((p) => p.id !== moduleId), { id: moduleId, text: reason }]
    : architecture.proposals
  return commandOk({ ...architecture, moduleDefinitions, proposals })
}

export function changeModuleType(
  architecture: SystemStructureSpecification,
  moduleId: string,
  moduleType: ModuleType,
): SystemStructureCommandResult {
  const guard = commandGuard(architecture)
  if (guard.length) return commandFail(guard)
  const missing = requireModule(architecture, moduleId)
  if (missing) return commandFail([missing])
  const moduleDefinitions = (architecture.moduleDefinitions ?? []).map((d) =>
    d.moduleId === moduleId ? { ...d, moduleType } : d,
  )
  return commandOk({ ...architecture, moduleDefinitions })
}

export type SplitModuleTarget = {
  moduleId: string
  name: string
  moduleType: ModuleType
  responsibility: string
  operationIds: string[]
}

export function splitModule(
  architecture: SystemStructureSpecification,
  moduleId: string,
  newModules: SplitModuleTarget[],
): SystemStructureCommandResult {
  const guard = commandGuard(architecture)
  if (guard.length) return commandFail(guard)
  const missing = requireModule(architecture, moduleId)
  if (missing) return commandFail([missing])
  if (newModules.length < 2) {
    return commandFail([
      diagnostic('CAP-DES-SYS-SPLIT-COUNT', 'splitting a module requires at least two replacement modules', {
        relatedIds: [moduleId],
      }),
    ])
  }
  const newIds = newModules.map((m) => m.moduleId)
  const duplicate = newIds.find((id) => id !== moduleId && architecture.moduleIds.includes(id))
  if (duplicate) {
    return commandFail([
      diagnostic('CAP-DES-SYS-SPLIT-DUP', 'a replacement module id already exists', { relatedIds: [duplicate] }),
    ])
  }

  const claimedOperations = new Set(newModules.flatMap((m) => m.operationIds))
  const previousOperations = (architecture.operationAllocations ?? [])
    .filter((a) => a.moduleId === moduleId)
    .map((a) => a.operationId)
  const uncovered = previousOperations.filter((id) => !claimedOperations.has(id))
  if (uncovered.length) {
    return commandFail([
      diagnostic(
        'CAP-DES-SYS-SPLIT-UNCOVERED-OP',
        'every operation on the split module must be claimed by a replacement module',
        { ruleId: 'CAP-DES-SYS-004', relatedIds: uncovered },
      ),
    ])
  }

  const replaceEndpoint = (id: string): string[] => (id === moduleId ? newIds : [id])

  const moduleIds = [...architecture.moduleIds.filter((id) => id !== moduleId), ...newIds]
  const moduleDefinitions = [
    ...(architecture.moduleDefinitions ?? []).filter((d) => d.moduleId !== moduleId),
    ...newModules.map((m) => ({
      moduleId: m.moduleId,
      name: m.name,
      moduleType: m.moduleType,
      responsibility: m.responsibility,
    })),
  ]

  const opOwner = new Map<string, string>()
  for (const m of newModules) for (const opId of m.operationIds) opOwner.set(opId, m.moduleId)
  const operationAllocations = (architecture.operationAllocations ?? []).map((a) =>
    a.moduleId === moduleId ? { ...a, moduleId: opOwner.get(a.operationId) ?? a.moduleId } : a,
  )

  const dependencyEdges: DependencyEdge[] = []
  const seenEdges = new Set<string>()
  for (const edge of architecture.dependencyEdges ?? []) {
    for (const from of replaceEndpoint(edge.fromModuleId)) {
      for (const to of replaceEndpoint(edge.toModuleId)) {
        if (from === to) continue
        const key = `${from}->${to}`
        if (seenEdges.has(key)) continue
        seenEdges.add(key)
        dependencyEdges.push({ fromModuleId: from, toModuleId: to, reason: edge.reason })
      }
    }
  }

  const adapterAllocations = (architecture.adapterAllocations ?? []).map((a) =>
    a.moduleId === moduleId ? { ...a, moduleId: newIds[0]! } : a,
  )
  const workflowTraces = (architecture.workflowTraces ?? []).map((t) => ({
    ...t,
    moduleIds: [...new Set((t.moduleIds ?? []).flatMap(replaceEndpoint))].sort((a, b) => a.localeCompare(b)),
    nodeAllocations: t.nodeAllocations?.map((allocation) => ({
      ...allocation,
      primaryModuleId: allocation.primaryModuleId === moduleId
        ? (allocation.operationId ? opOwner.get(allocation.operationId) : undefined) ?? newIds[0]!
        : allocation.primaryModuleId,
      participatingModuleIds: [...new Set(allocation.participatingModuleIds.flatMap(replaceEndpoint))]
        .filter((id) => id !== (
          allocation.primaryModuleId === moduleId
            ? (allocation.operationId ? opOwner.get(allocation.operationId) : undefined) ?? newIds[0]!
            : allocation.primaryModuleId
        ))
        .sort((a, b) => a.localeCompare(b)),
    })),
  }))
  const deployables = (architecture.deployables ?? []).map((d) => ({
    ...d,
    moduleIds: [...new Set(d.moduleIds.flatMap(replaceEndpoint))].sort((a, b) => a.localeCompare(b)),
  }))
  const proposals = [
    ...(architecture.proposals ?? []).filter((p) => p.id !== moduleId),
    ...newModules.map((m) => ({ id: m.moduleId, text: `Split from ${moduleId}: ${m.responsibility}` })),
  ]

  return commandOk({
    ...architecture,
    moduleIds,
    moduleDefinitions,
    dependencyEdges,
    operationAllocations,
    adapterAllocations,
    workflowTraces,
    deployables,
    proposals,
  })
}

export type MergeModuleTarget = {
  moduleId: string
  name: string
  moduleType: ModuleType
  responsibility: string
}

export function mergeModules(
  architecture: SystemStructureSpecification,
  moduleIds: string[],
  merged: MergeModuleTarget,
): SystemStructureCommandResult {
  const guard = commandGuard(architecture)
  if (guard.length) return commandFail(guard)
  if (moduleIds.length < 2) {
    return commandFail([
      diagnostic('CAP-DES-SYS-MERGE-COUNT', 'merging requires at least two source modules', {
        relatedIds: moduleIds,
      }),
    ])
  }
  const missing = moduleIds.map((id) => requireModule(architecture, id)).filter((d): d is CapDiagnostic => Boolean(d))
  if (missing.length) return commandFail(missing)

  const sourceSet = new Set(moduleIds)
  const replace = (id: string): string => (sourceSet.has(id) ? merged.moduleId : id)

  const nextModuleIds = [...architecture.moduleIds.filter((id) => !sourceSet.has(id)), merged.moduleId]
  const moduleDefinitions = [
    ...(architecture.moduleDefinitions ?? []).filter((d) => !sourceSet.has(d.moduleId)),
    { moduleId: merged.moduleId, name: merged.name, moduleType: merged.moduleType, responsibility: merged.responsibility },
  ]
  const operationAllocations = (architecture.operationAllocations ?? []).map((a) => ({
    ...a,
    moduleId: replace(a.moduleId),
  }))

  const dependencyEdges: DependencyEdge[] = []
  const seenEdges = new Set<string>()
  for (const edge of architecture.dependencyEdges ?? []) {
    const from = replace(edge.fromModuleId)
    const to = replace(edge.toModuleId)
    if (from === to) continue
    const key = `${from}->${to}`
    if (seenEdges.has(key)) continue
    seenEdges.add(key)
    dependencyEdges.push({ fromModuleId: from, toModuleId: to, reason: edge.reason })
  }
  const adapterAllocations = (architecture.adapterAllocations ?? []).map((a) => ({ ...a, moduleId: replace(a.moduleId) }))
  const workflowTraces = (architecture.workflowTraces ?? []).map((t) => ({
    ...t,
    moduleIds: [...new Set((t.moduleIds ?? []).map(replace))].sort((a, b) => a.localeCompare(b)),
    nodeAllocations: t.nodeAllocations?.map((allocation) => ({
      ...allocation,
      primaryModuleId: replace(allocation.primaryModuleId),
      participatingModuleIds: [...new Set(allocation.participatingModuleIds.map(replace))]
        .filter((id) => id !== replace(allocation.primaryModuleId))
        .sort((a, b) => a.localeCompare(b)),
    })),
  }))
  const deployables = (architecture.deployables ?? []).map((d) => ({
    ...d,
    moduleIds: [...new Set(d.moduleIds.map(replace))].sort((a, b) => a.localeCompare(b)),
  }))
  const proposals = [
    ...(architecture.proposals ?? []).filter((p) => !sourceSet.has(p.id)),
    { id: merged.moduleId, text: `Merged from ${[...moduleIds].sort((a, b) => a.localeCompare(b)).join(', ')}: ${merged.responsibility}` },
  ]

  return commandOk({
    ...architecture,
    moduleIds: nextModuleIds,
    moduleDefinitions,
    dependencyEdges,
    operationAllocations,
    adapterAllocations,
    workflowTraces,
    deployables,
    proposals,
  })
}

export function moveOperation(
  architecture: SystemStructureSpecification,
  operationId: string,
  toModuleId: string,
): SystemStructureCommandResult {
  const guard = commandGuard(architecture)
  if (guard.length) return commandFail(guard)
  const missing = requireModule(architecture, toModuleId)
  if (missing) return commandFail([missing])
  const found = (architecture.operationAllocations ?? []).some((a) => a.operationId === operationId)
  if (!found) {
    return commandFail([
      diagnostic('CAP-DES-SYS-UNKNOWN-OPERATION', `unknown operation id: ${operationId}`, {
        relatedIds: [operationId],
      }),
    ])
  }
  const operationAllocations = (architecture.operationAllocations ?? []).map((a) =>
    a.operationId === operationId ? { ...a, moduleId: toModuleId } : a,
  )
  const workflowTraces = architecture.workflowTraces.map((trace) => ({
    ...trace,
    moduleIds: trace.moduleIds.includes(toModuleId)
      ? trace.moduleIds
      : trace.nodeAllocations?.some((allocation) => allocation.operationId === operationId)
        ? [...trace.moduleIds, toModuleId].sort((a, b) => a.localeCompare(b))
        : trace.moduleIds,
    nodeAllocations: trace.nodeAllocations?.map((allocation) =>
      allocation.operationId === operationId
        ? { ...allocation, primaryModuleId: toModuleId }
        : allocation),
  }))
  return commandOk({ ...architecture, operationAllocations, workflowTraces })
}

export function addDependency(
  architecture: SystemStructureSpecification,
  fromModuleId: string,
  toModuleId: string,
  reason: string,
): SystemStructureCommandResult {
  const guard = commandGuard(architecture)
  if (guard.length) return commandFail(guard)
  const missing = [requireModule(architecture, fromModuleId), requireModule(architecture, toModuleId)].filter(
    (d): d is CapDiagnostic => Boolean(d),
  )
  if (missing.length) return commandFail(missing)
  if (!reason.trim()) {
    return commandFail([
      diagnostic('CAP-DES-SYS-DEP-REASON', 'a dependency edge requires a reason', {
        relatedIds: [fromModuleId, toModuleId],
      }),
    ])
  }
  const exists = (architecture.dependencyEdges ?? []).some(
    (e) => e.fromModuleId === fromModuleId && e.toModuleId === toModuleId,
  )
  if (exists) {
    return commandFail([
      diagnostic('CAP-DES-SYS-DEP-EXISTS', 'the dependency edge already exists', {
        relatedIds: [fromModuleId, toModuleId],
      }),
    ])
  }
  const dependencyEdges = [...(architecture.dependencyEdges ?? []), { fromModuleId, toModuleId, reason }]
  return commandOk({ ...architecture, dependencyEdges })
}

export function removeDependency(
  architecture: SystemStructureSpecification,
  fromModuleId: string,
  toModuleId: string,
): SystemStructureCommandResult {
  const guard = commandGuard(architecture)
  if (guard.length) return commandFail(guard)
  const dependencyEdges = (architecture.dependencyEdges ?? []).filter(
    (e) => !(e.fromModuleId === fromModuleId && e.toModuleId === toModuleId),
  )
  return commandOk({ ...architecture, dependencyEdges })
}

export function addAdapterAllocation(
  architecture: SystemStructureSpecification,
  allocation: { adapterId: string; portId: string; moduleId: string },
): SystemStructureCommandResult {
  const guard = commandGuard(architecture)
  if (guard.length) return commandFail(guard)
  const missing = requireModule(architecture, allocation.moduleId)
  if (missing) return commandFail([missing])
  const exists = (architecture.adapterAllocations ?? []).some((a) => a.adapterId === allocation.adapterId)
  if (exists) {
    return commandFail([
      diagnostic('CAP-DES-SYS-ADAPTER-EXISTS', 'the adapter is already allocated', {
        relatedIds: [allocation.adapterId],
      }),
    ])
  }
  const adapterAllocations = [
    ...(architecture.adapterAllocations ?? []),
    { adapterId: allocation.adapterId, moduleId: allocation.moduleId, portId: allocation.portId },
  ]
  return commandOk({ ...architecture, adapterAllocations })
}

export function changeAdapterAllocation(
  architecture: SystemStructureSpecification,
  adapterId: string,
  newModuleId: string,
): SystemStructureCommandResult {
  const guard = commandGuard(architecture)
  if (guard.length) return commandFail(guard)
  const missing = requireModule(architecture, newModuleId)
  if (missing) return commandFail([missing])
  const found = (architecture.adapterAllocations ?? []).some((a) => a.adapterId === adapterId)
  if (!found) {
    return commandFail([
      diagnostic('CAP-DES-SYS-UNKNOWN-ADAPTER', `unknown adapter id: ${adapterId}`, { relatedIds: [adapterId] }),
    ])
  }
  const adapterAllocations = (architecture.adapterAllocations ?? []).map((a) =>
    a.adapterId === adapterId ? { ...a, moduleId: newModuleId } : a,
  )
  return commandOk({ ...architecture, adapterAllocations })
}

export type MoveModuleToDeployableOptions = {
  name?: string
  splitReason?: SplitReason
  splitJustification?: string
}

export function moveModuleToDeployable(
  architecture: SystemStructureSpecification,
  moduleId: string,
  targetDeployableId: string,
  options: MoveModuleToDeployableOptions = {},
): SystemStructureCommandResult {
  const guard = commandGuard(architecture)
  if (guard.length) return commandFail(guard)
  const missing = requireModule(architecture, moduleId)
  if (missing) return commandFail([missing])

  const deployables = architecture.deployables ?? []
  const isNewDeployable = !deployables.some((d) => d.deployableId === targetDeployableId)
  if (isNewDeployable) {
    const validReason = options.splitReason && SPLIT_REASON_SET.has(options.splitReason)
    if (!validReason || !options.splitJustification?.trim()) {
      return commandFail([
        diagnostic(
          'CAP-DES-SYS-SPLIT-REASON',
          'a separate deployable requires one of the valid split reasons and a justification',
          { ruleId: 'CAP-DES-SYS-002', relatedIds: [targetDeployableId] },
        ),
      ])
    }
  }

  const withoutModule = deployables.map((d) => ({ ...d, moduleIds: d.moduleIds.filter((id) => id !== moduleId) }))
  const nextDeployables = isNewDeployable
    ? [
        ...withoutModule,
        {
          deployableId: targetDeployableId,
          name: options.name ?? targetDeployableId,
          moduleIds: [moduleId],
          splitReason: options.splitReason,
          splitJustification: options.splitJustification,
        },
      ]
    : withoutModule.map((d) => (d.deployableId === targetDeployableId ? { ...d, moduleIds: [...d.moduleIds, moduleId] } : d))

  return commandOk({ ...architecture, deployables: nextDeployables.filter((d) => d.moduleIds.length > 0) })
}

export function changeOwnedPath(
  architecture: SystemStructureSpecification,
  moduleId: string,
  ownedPaths: string[],
): SystemStructureCommandResult {
  const guard = commandGuard(architecture)
  if (guard.length) return commandFail(guard)
  const missing = requireModule(architecture, moduleId)
  if (missing) return commandFail([missing])
  const modulePaths = [
    ...(architecture.modulePaths ?? []).filter((m) => m.moduleId !== moduleId),
    { moduleId, ownedPaths: [...ownedPaths].sort((a, b) => a.localeCompare(b)) },
  ].sort((a, b) => a.moduleId.localeCompare(b.moduleId))
  return commandOk({ ...architecture, modulePaths })
}
