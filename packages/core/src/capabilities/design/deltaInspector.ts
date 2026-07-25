/**
 * EUC-11 — Delta inspector and apply planner.
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §11.5,
 * §11.6, §12.1, §12.2, §19, §20.2, §24.1, §25.3 (EUC-11).
 *
 * Owned outputs: the §11.5 returned-delta rejection rules, the §11.6 full
 * inspection, user approval to apply, the §12.2 transactional apply plan,
 * a pure apply simulation for tests, and the §11.7 multi-pass continuation
 * helper for the workspace-revision side of a returned delta.
 *
 * This module never edits `records.ts` or `identity.ts` (shared contracts);
 * it only imports from them.
 */

import type { OperationContract } from '../types.js'
import { diagnostic, sortDiagnostics, type CapDiagnostic } from '../diagnostics.js'
import { sha256Hex, canonicalHash } from '../hash.js'
import { stableSortBy } from './identity.js'
import {
  isAgentActor,
  type DeltaApplyPlan,
  type DeltaApplyResult,
  type DeltaInspection,
  type DeltaRejectionReason,
  type ModuleDesignSpecification,
  type ModuleImplementationPacket,
  type ReturnedDelta,
  type ReturnedFileChange,
} from './records.js'
import { classifyContractChange } from './contractRegistry.js'

// ---------------------------------------------------------------------------
// Path validation (§20.2)
// ---------------------------------------------------------------------------

/**
 * Normalizes a returned path. Rejects absolute paths, `..` traversal
 * segments, and other symbolic-link-style escapes (§20.2). Returns
 * `undefined` when the path is not safe to evaluate further.
 */
export function normalizeReturnedPath(rawPath: string): string | undefined {
  if (typeof rawPath !== 'string' || rawPath.length === 0) return undefined
  if (rawPath.includes('\0')) return undefined
  if (rawPath.startsWith('/') || rawPath.startsWith('\\')) return undefined
  if (/^[A-Za-z]:[\\/]/.test(rawPath)) return undefined
  if (rawPath.startsWith('~')) return undefined
  const segments = rawPath.split(/[\\/]+/)
  if (segments.some((segment) => segment === '..')) return undefined
  const cleaned = segments.filter((segment) => segment.length > 0 && segment !== '.').join('/')
  if (!cleaned) return undefined
  return cleaned
}

function isWithinBoundaries(path: string, boundaries: string[]): boolean {
  return boundaries.some((boundary) => {
    const normalized = boundary.replace(/\/+$/, '')
    return path === normalized || path.startsWith(`${normalized}/`)
  })
}

// ---------------------------------------------------------------------------
// §11.5 — returned-delta rejection rules
// ---------------------------------------------------------------------------

export type DeltaWorkspaceContext = {
  /** Current workspace revision the delta's base must match (falls back to the packet's module-design revision). */
  workspaceRevision?: string
  /** Current workspace revision hash the delta's base must match (falls back to the packet's module-design hash). */
  workspaceHash?: string
  /** Paths the user pre-approved for deletion. */
  approvedDeletes?: string[]
  /** Impact-record ids the user has approved. */
  approvedImpactRecordIds?: string[]
  /** Maps a contract record change's `recordId` to the impact record id it claims. */
  contractChangeImpactRecordIds?: Record<string, string>
}

function emptyFileSummary(): DeltaInspection['fileSummary'] {
  return { created: [], changed: [], deleted: [] }
}

/**
 * §11.5 — validates a returned delta against the exact rejection rules and
 * returns a `DeltaInspection` (accepted flag plus rejection reasons). A
 * rejected delta is never discarded — the caller receives the full
 * inspection with the response preserved as evidence (§19 "Stale response").
 */
export function validateReturnedDelta(
  delta: ReturnedDelta,
  packet: ModuleImplementationPacket | undefined,
  workspace: DeltaWorkspaceContext,
  now: string = new Date(0).toISOString(),
): DeltaInspection {
  const rejectionReasons: DeltaRejectionReason[] = []
  const outOfScopeAttempts: string[] = []
  const fileSummary = emptyFileSummary()

  const inspectionId = `inspection.${delta.deltaId || 'unknown'}`
  const inspectedContentHash = canonicalHash(delta)
  const workspaceRevisionAtInspection = workspace.workspaceRevision ?? packet?.moduleDesignRevision ?? ''

  const base: DeltaInspection = {
    inspectionId,
    deltaId: delta.deltaId ?? '',
    packetId: delta.packetId ?? '',
    inspectedContentHash,
    workspaceRevisionAtInspection,
    accepted: false,
    rejectionReasons,
    fileSummary,
    recordChanges: (delta.recordChanges ?? []).map((c) => ({ recordId: c.recordId, kind: c.kind, summary: c.summary })),
    contractChanges: [],
    affectedRequirementIds: [],
    affectedUseCaseIds: [],
    testResults: delta.testResults ?? [],
    newWarnings: [],
    newDependencies: [],
    outOfScopeAttempts,
    generatedFiles: [],
    userOwnedFiles: [],
    rollbackPointRef: '',
    inspectedAt: now,
  }

  if (!packet || !delta.packetId || delta.packetId !== packet.packetId) {
    rejectionReasons.push('unknown-packet')
    return { ...base, rejectionReasons }
  }

  // stale base revision or hash (§11.5)
  const expectedRevision = workspace.workspaceRevision ?? packet.moduleDesignRevision
  const expectedHash = workspace.workspaceHash ?? packet.moduleDesignHash
  if (!delta.baseRevision || !delta.baseHash || delta.baseRevision !== expectedRevision || delta.baseHash !== expectedHash) {
    rejectionReasons.push('stale-base')
  }

  // change manifest presence
  const fileChanges = delta.fileChanges ?? []
  const recordChanges = delta.recordChanges ?? []
  if (fileChanges.length === 0 && recordChanges.length === 0) {
    rejectionReasons.push('missing-change-manifest')
  }

  // path and ownership checks
  const approvedDeletes = new Set(workspace.approvedDeletes ?? [])
  const boundaries = [...packet.allowedPaths, ...packet.editableSharedPaths]
  let sawPathTraversal = false
  let sawPathOutsideAllowed = false
  let sawUnapprovedDelete = false
  for (const change of fileChanges) {
    const normalized = normalizeReturnedPath(change.path)
    if (!normalized) {
      sawPathTraversal = true
      outOfScopeAttempts.push(change.path)
      continue
    }
    if (!isWithinBoundaries(normalized, boundaries)) {
      sawPathOutsideAllowed = true
      outOfScopeAttempts.push(change.path)
      continue
    }
    if (change.action === 'create') fileSummary.created.push(normalized)
    else if (change.action === 'change') fileSummary.changed.push(normalized)
    else if (change.action === 'delete') {
      fileSummary.deleted.push(normalized)
      if (!approvedDeletes.has(normalized) && !approvedDeletes.has(change.path)) {
        sawUnapprovedDelete = true
        outOfScopeAttempts.push(change.path)
      }
    }
  }
  if (sawPathTraversal) rejectionReasons.push('path-traversal')
  if (sawPathOutsideAllowed) rejectionReasons.push('path-outside-allowed')
  if (sawUnapprovedDelete) rejectionReasons.push('unapproved-delete')

  // canonical contract change without an approved impact record
  const approvedImpactRecordIds = new Set(workspace.approvedImpactRecordIds ?? [])
  const impactByRecordId = workspace.contractChangeImpactRecordIds ?? {}
  let sawUnapprovedContractChange = false
  for (const change of recordChanges) {
    if (change.kind !== 'contract') continue
    const payloadImpactId =
      change.payload && typeof change.payload === 'object' && change.payload !== null
        ? (change.payload as { impactRecordId?: string }).impactRecordId
        : undefined
    const impactRecordId = impactByRecordId[change.recordId] ?? payloadImpactId
    if (!impactRecordId || !approvedImpactRecordIds.has(impactRecordId)) {
      sawUnapprovedContractChange = true
    }
  }
  if (sawUnapprovedContractChange) rejectionReasons.push('contract-change-without-impact')

  // required checks did not run and no reason exists
  const testResults = delta.testResults ?? []
  const hasReason = (delta.unresolvedIssues ?? []).length > 0
  if (testResults.length === 0 && !hasReason) {
    rejectionReasons.push('checks-not-run')
  }

  const accepted = rejectionReasons.length === 0
  return { ...base, accepted, rejectionReasons: sortRejectionReasons(rejectionReasons) }
}

const REJECTION_ORDER: DeltaRejectionReason[] = [
  'unknown-packet',
  'stale-base',
  'path-outside-allowed',
  'unapproved-delete',
  'contract-change-without-impact',
  'missing-change-manifest',
  'checks-not-run',
  'path-traversal',
  'record-change-not-allowed',
]

function sortRejectionReasons(reasons: DeltaRejectionReason[]): DeltaRejectionReason[] {
  return [...new Set(reasons)].sort((a, b) => REJECTION_ORDER.indexOf(a) - REJECTION_ORDER.indexOf(b))
}

// ---------------------------------------------------------------------------
// §11.6 — full inspection
// ---------------------------------------------------------------------------

export type ContractChangeInput = {
  recordId: string
  operationId: string
  fromVersion: string
  toVersion: string
  oldContract: OperationContract
  newContract?: OperationContract
  moduleDesigns?: ModuleDesignSpecification[]
}

export type InspectDeltaExtras = {
  now?: string
  /** The current approved module design, used for the affected-requirements/use-cases trace. */
  moduleDesign?: ModuleDesignSpecification
  /** Explicit contract-change classification inputs (§9.7 compatibility). */
  contractChanges?: ContractChangeInput[]
  /** Classifies a changed or created path as generated (owned by a generator) or user-owned. */
  classifyFile?: (path: string) => 'generated' | 'userOwned'
  rollbackPointRef: string
  newWarnings?: string[]
  newDependencies?: string[]
}

/**
 * §11.6 — the full inspection shown to the user before approve/apply.
 * Builds on `validateReturnedDelta` and never auto-approves a partial or
 * rejected response (§19 "Copilot response incomplete").
 */
export function inspectDelta(
  delta: ReturnedDelta,
  packet: ModuleImplementationPacket | undefined,
  workspace: DeltaWorkspaceContext,
  extras: InspectDeltaExtras,
): DeltaInspection {
  const now = extras.now ?? new Date(0).toISOString()
  const base = validateReturnedDelta(delta, packet, workspace, now)

  const contractChanges = (extras.contractChanges ?? []).map((input) => {
    const classification = classifyContractChange(input.oldContract, input.newContract, input.moduleDesigns ?? [])
    return {
      operationId: input.operationId,
      fromVersion: input.fromVersion,
      toVersion: input.toVersion,
      compatibility: classification.classification,
    }
  })

  const classifyFile = extras.classifyFile ?? (() => 'userOwned' as const)
  const generatedFiles: string[] = []
  const userOwnedFiles: string[] = []
  for (const path of [...base.fileSummary.created, ...base.fileSummary.changed]) {
    if (classifyFile(path) === 'generated') generatedFiles.push(path)
    else userOwnedFiles.push(path)
  }

  const missing = missingRequiredDeltaFields(delta)
  const newWarnings = [
    ...missing.map((field) => `missing required field: ${field}`),
    ...(extras.newWarnings ?? []),
  ]

  return {
    ...base,
    contractChanges,
    affectedRequirementIds: [
      ...(extras.moduleDesign?.trace.ruleIds ?? []),
      ...(extras.moduleDesign?.trace.qualityRequirementIds ?? []),
    ],
    affectedUseCaseIds: extras.moduleDesign?.trace.useCaseIds ?? [],
    newWarnings,
    newDependencies: extras.newDependencies ?? [],
    generatedFiles,
    userOwnedFiles,
    rollbackPointRef: extras.rollbackPointRef,
  }
}

/** §19 "Copilot response incomplete" — the required fields missing from a partial response. */
export function missingRequiredDeltaFields(delta: ReturnedDelta): string[] {
  const missing: string[] = []
  if (!delta.deltaId) missing.push('deltaId')
  if (!delta.packetId) missing.push('packetId')
  if (!delta.baseRevision) missing.push('baseRevision')
  if (!delta.baseHash) missing.push('baseHash')
  if (!Array.isArray(delta.fileChanges)) missing.push('fileChanges')
  if (!Array.isArray(delta.recordChanges)) missing.push('recordChanges')
  if (!Array.isArray(delta.testResults)) missing.push('testResults')
  if (!delta.returnedAt) missing.push('returnedAt')
  if (!delta.contentHash) missing.push('contentHash')
  return missing
}

// ---------------------------------------------------------------------------
// Approve to apply (§11.6, §19 "workspace changed after inspection")
// ---------------------------------------------------------------------------

export type ApproveDeltaInput = {
  approvedBy: string
  /** The current workspace revision at the moment of approval. */
  currentWorkspaceRevision: string
}

export type ApproveDeltaResult = { ok: boolean; diagnostics: CapDiagnostic[] }

/**
 * User-only approval to apply an inspected delta. Rejects an agent actor
 * (§4), an unaccepted inspection, and a workspace that changed since
 * inspection (§11.6 "If the workspace changes after inspection, the
 * product shall require a new inspection").
 */
export function approveDeltaToApply(inspection: DeltaInspection, approval: ApproveDeltaInput): ApproveDeltaResult {
  if (isAgentActor(approval.approvedBy)) {
    return {
      ok: false,
      diagnostics: [
        diagnostic('CAP-DES-DELTA-AGENT-APPROVAL', 'an agent actor cannot approve a delta to apply', {
          ruleId: 'CAP-4',
          relatedIds: [approval.approvedBy],
        }),
      ],
    }
  }
  if (!inspection.accepted) {
    return {
      ok: false,
      diagnostics: [
        diagnostic('CAP-DES-DELTA-NOT-ACCEPTED', 'the inspection was not accepted', {
          ruleId: 'CAP-11.6',
          relatedIds: [inspection.inspectionId],
        }),
      ],
    }
  }
  if (approval.currentWorkspaceRevision !== inspection.workspaceRevisionAtInspection) {
    return {
      ok: false,
      diagnostics: [
        diagnostic('workspace-changed-reinspect', 'the workspace changed since inspection; a new inspection is required', {
          ruleId: 'CAP-11.6',
          relatedIds: [inspection.inspectionId],
        }),
      ],
    }
  }
  return { ok: true, diagnostics: [] }
}

// ---------------------------------------------------------------------------
// §12.2 — transactional apply plan
// ---------------------------------------------------------------------------

export type BuildApplyPlanInput = {
  planId: string
  backupRef: string
  /** Overrides the expected base workspace revision; defaults to the inspection's. */
  expectedWorkspaceRevision?: string
}

/** §12.2 — verifies the base workspace revision and the inspected delta hash; deletes are ordered last. */
export function buildApplyPlan(inspection: DeltaInspection, delta: ReturnedDelta, input: BuildApplyPlanInput): DeltaApplyPlan {
  const creates = (delta.fileChanges ?? []).filter((c) => c.action !== 'delete')
  const deletes = (delta.fileChanges ?? []).filter((c) => c.action === 'delete')
  const orderedChanges = [...stableSortBy(creates, (c) => c.path), ...stableSortBy(deletes, (c) => c.path)]
  const expectedWorkspaceRevision = input.expectedWorkspaceRevision ?? inspection.workspaceRevisionAtInspection

  return {
    planId: input.planId,
    inspectionId: inspection.inspectionId,
    deltaId: delta.deltaId,
    expectedWorkspaceRevision,
    expectedDeltaHash: inspection.inspectedContentHash,
    backupRef: input.backupRef,
    orderedChanges,
    rollbackInstructions: [
      `Restore the workspace from backup ${input.backupRef}.`,
      `Revert to workspace revision ${expectedWorkspaceRevision}.`,
      `Discard applied paths: ${orderedChanges.map((c) => c.path).join(', ') || '(none)'}.`,
    ],
  }
}

// ---------------------------------------------------------------------------
// Pure apply simulation (test utility)
// ---------------------------------------------------------------------------

export type SimulateApplyOutcome = { result: DeltaApplyResult; files: Record<string, string> }

function workspaceRevisionOf(files: Record<string, string>): string {
  const sortedKeys = Object.keys(files).sort()
  return sha256Hex(JSON.stringify(sortedKeys.map((key) => [key, files[key]])))
}

function conflictReason(change: ReturnedFileChange, files: Record<string, string>): string | undefined {
  const exists = Object.prototype.hasOwnProperty.call(files, change.path)
  if (change.action === 'create' && exists) {
    const existingHash = sha256Hex(files[change.path] ?? '')
    if (!change.contentHash || existingHash !== change.contentHash) {
      return `create target already exists at ${change.path}`
    }
  }
  if (change.action === 'change' && !exists) {
    return `change target is missing at ${change.path}`
  }
  if (change.action === 'delete' && !exists) {
    return `delete target is missing at ${change.path}`
  }
  return undefined
}

/**
 * Pure transactional apply simulation for tests (§12.2). Applies every
 * approved change or none: any conflict rolls back with zero mutations.
 * Unrelated files are preserved byte-identical.
 */
export function simulateApply(
  plan: DeltaApplyPlan,
  files: Record<string, string>,
  now: string = new Date(0).toISOString(),
): SimulateApplyOutcome {
  for (const change of plan.orderedChanges) {
    const reason = conflictReason(change, files)
    if (reason) {
      return {
        result: { planId: plan.planId, applied: false, rolledBack: true, appliedFiles: [], failure: reason, completedAt: now },
        files,
      }
    }
  }

  const nextFiles = { ...files }
  const appliedFiles: string[] = []
  for (const change of plan.orderedChanges) {
    if (change.action === 'delete') {
      delete nextFiles[change.path]
    } else {
      nextFiles[change.path] = change.content ?? ''
    }
    appliedFiles.push(change.path)
  }

  return {
    result: {
      planId: plan.planId,
      applied: true,
      rolledBack: false,
      appliedFiles,
      resultWorkspaceRevision: workspaceRevisionOf(nextFiles),
      completedAt: now,
    },
    files: nextFiles,
  }
}
