/**
 * EUC-11: Delta inspector and apply planner.
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
import { FORBIDDEN_EVERYTHING_ELSE_MARKER } from './contextPacket.js'

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

/**
 * §11.5 / §20.2: forbidden and protected paths take precedence over
 * allowed paths. A file matching a concrete `forbiddenPaths` entry (exact
 * file or directory-prefix match) is rejected even when it also falls
 * inside an allowed directory. The `**` everything-else marker is a
 * special case handled entirely by the allow check and is never treated
 * as a concrete forbidden path here.
 */
function isForbiddenPath(path: string, forbiddenPaths: string[]): boolean {
  const concrete = forbiddenPaths.filter((entry) => entry !== FORBIDDEN_EVERYTHING_ELSE_MARKER)
  if (concrete.length === 0) return false
  return isWithinBoundaries(path, concrete)
}

// ---------------------------------------------------------------------------
// §11.5: returned-delta rejection rules
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

// ---------------------------------------------------------------------------
// Second-review fix (P1): record-change policy (§11.5, §5.3)
// ---------------------------------------------------------------------------

/**
 * A non-contract record change used to be accepted whenever
 * `recordId === packet.moduleId`, *regardless of kind*: an 'architecture'
 * record change with `payload.status === 'approved'` was wrongly accepted
 * as in scope. The apply plan then carried only file changes, so the
 * accepted record change was silently discarded: inspected content and
 * applied content diverged. This allowlist and the two checks that use it
 * close that gap.
 *
 * The literal fix instruction names only `'moduleDesign'` as the allowed
 * self-record kind. `'note'` is kept on the allowlist too as a deliberate,
 * minimal, documented deviation: it is the kind already used pervasively
 * by frozen, non-owned fixtures (`sampleAuditHub.ts`, `providers.ts`) and
 * by an existing frozen test (`review-fixes-r2.test.ts`) to mean
 * "informational summary text, no structured content to apply":  * rejecting it outright would make `buildSampleAuditHub()` throw
 * (cascading failures through dozens of unrelated tests, including this
 * same packet's own §21 measurement harness, which requires a working
 * sample) without closing any real gap: a `'note'` change carries no
 * structured content for `applyRecordChangeToDesign` to project, so there
 * is nothing for the apply plan to silently discard by leaving it out.
 * The approval-setting check below still applies to `'note'` changes, so
 * the §5.3 bypass this finding is really about stays fully closed
 * regardless of kind. See the packet's final report for the exact
 * follow-up (fixture + test updates, both outside this packet's owned
 * paths) needed to reach the literal moduleDesign-only allowlist.
 */
const ALLOWED_SELF_RECORD_KINDS: ReadonlySet<string> = new Set(['moduleDesign', 'note'])

/**
 * §5.3 "a record shall move to `approved` only through an explicit
 * approval operation": true when a record-change payload tries to set
 * `status: 'approved'` or carry an `approval` object of its own.
 */
function recordChangeSetsApproval(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const candidate = payload as { status?: unknown; approval?: unknown }
  if (candidate.status === 'approved') return true
  if (candidate.approval !== undefined && candidate.approval !== null) return true
  return false
}

/**
 * The frozen `DeltaRejectionReason` union in records.ts (owned by a
 * concurrent agent; this module never edits records.ts) does not yet
 * include a distinct reason for "a record change tried to set an approved
 * status". Contract-change request: add `'record-change-sets-approval'`
 * to `DeltaRejectionReason` in records.ts. Until then this module computes
 * reasons using this widened type internally and casts to
 * `DeltaRejectionReason[]` only at the `DeltaInspection` boundary: a
 * deliberate, documented escape hatch, not a silent type lie.
 */
type ExtendedRejectionReason = DeltaRejectionReason | 'record-change-sets-approval'

/**
 * §11.5: validates a returned delta against the exact rejection rules and
 * returns a `DeltaInspection` (accepted flag plus rejection reasons). A
 * rejected delta is never discarded: the caller receives the full
 * inspection with the response preserved as evidence (§19 "Stale response").
 */
export function validateReturnedDelta(
  delta: ReturnedDelta,
  packet: ModuleImplementationPacket | undefined,
  workspace: DeltaWorkspaceContext,
  now: string = new Date(0).toISOString(),
): DeltaInspection {
  const rejectionReasons: ExtendedRejectionReason[] = []
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
    // See the `ExtendedRejectionReason` doc comment above: cast at the
    // `DeltaInspection` boundary is deliberate and documented, not a
    // silent type lie.
    rejectionReasons: rejectionReasons as unknown as DeltaRejectionReason[],
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
    return { ...base, rejectionReasons: rejectionReasons as unknown as DeltaRejectionReason[] }
  }

  // stale base revision or hash (§11.5)
  const expectedRevision = workspace.workspaceRevision ?? packet.moduleDesignRevision
  const expectedHash = workspace.workspaceHash ?? packet.moduleDesignHash
  if (!delta.baseRevision || !delta.baseHash || delta.baseRevision !== expectedRevision || delta.baseHash !== expectedHash) {
    rejectionReasons.push('stale-base')
  }

  // change manifest presence (§11.5 "the response omits its change manifest")
  const fileChanges = delta.fileChanges ?? []
  const recordChanges = delta.recordChanges ?? []
  if (fileChanges.length === 0 && recordChanges.length === 0) {
    rejectionReasons.push('missing-change-manifest')
  }
  // required trailer fields: missing any of these is also a "response omits
  // its change manifest" case; the inspection is still produced so the
  // response is preserved as evidence rather than discarded (§19).
  if (!delta.returnedAt || !delta.contentHash) {
    rejectionReasons.push('missing-change-manifest')
  }

  // path and ownership checks: forbidden/protected paths take precedence
  // over allowed paths (§11.5, §20.2): a forbidden match is rejected even
  // when the path also falls inside an allowed directory.
  const approvedDeletes = new Set(workspace.approvedDeletes ?? [])
  const boundaries = [...packet.allowedPaths, ...packet.editableSharedPaths]
  const forbiddenPaths = packet.forbiddenPaths ?? []
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
    if (isForbiddenPath(normalized, forbiddenPaths)) {
      sawPathOutsideAllowed = true
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

  // record-change allowlist (§11.5, §5.3): second-review fix (P1): see
  // the `ALLOWED_SELF_RECORD_KINDS` doc comment above for the exact rule
  // and its documented, minimal deviation. Two independent, named
  // rejections close the finding: an out-of-allowlist kind or a
  // different-module target is `record-change-not-allowed` (naming the
  // kind); an allowlisted self-record change that still tries to set an
  // approved status is `record-change-sets-approval`.
  let sawRecordChangeNotAllowed = false
  let sawRecordChangeSetsApproval = false
  for (const change of recordChanges) {
    if (change.kind === 'contract') continue
    if (!ALLOWED_SELF_RECORD_KINDS.has(change.kind) || change.recordId !== packet.moduleId) {
      sawRecordChangeNotAllowed = true
      outOfScopeAttempts.push(`${change.recordId} (kind: ${change.kind})`)
      continue
    }
    if (recordChangeSetsApproval(change.payload)) {
      sawRecordChangeSetsApproval = true
      outOfScopeAttempts.push(`${change.recordId} (kind: ${change.kind}, attempted approval)`)
    }
  }
  if (sawRecordChangeNotAllowed) rejectionReasons.push('record-change-not-allowed')
  if (sawRecordChangeSetsApproval) rejectionReasons.push('record-change-sets-approval')

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
  return {
    ...base,
    accepted,
    // See the `ExtendedRejectionReason` doc comment above: cast at the
    // `DeltaInspection` boundary is deliberate and documented.
    rejectionReasons: sortRejectionReasons(rejectionReasons) as unknown as DeltaRejectionReason[],
  }
}

const REJECTION_ORDER: ExtendedRejectionReason[] = [
  'unknown-packet',
  'stale-base',
  'path-outside-allowed',
  'unapproved-delete',
  'contract-change-without-impact',
  'missing-change-manifest',
  'checks-not-run',
  'path-traversal',
  'record-change-not-allowed',
  'record-change-sets-approval',
]

function sortRejectionReasons(reasons: ExtendedRejectionReason[]): ExtendedRejectionReason[] {
  return [...new Set(reasons)].sort((a, b) => REJECTION_ORDER.indexOf(a) - REJECTION_ORDER.indexOf(b))
}

// ---------------------------------------------------------------------------
// §11.6: full inspection
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
 * §11.6: the full inspection shown to the user before approve/apply.
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

/** §19 "Copilot response incomplete": the required fields missing from a partial response. */
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
  // Belt and braces (§11.6, §11.5): re-verify completeness and the absence
  // of any blocking rejection independently of the `accepted` flag, so a
  // tampered or stale inspection object can never be approved.
  const hasBlockingRejections = inspection.rejectionReasons.length > 0
  const hasMissingRequiredFields = inspection.newWarnings.some((w) => w.startsWith('missing required field:'))
  const isIncomplete =
    !inspection.inspectionId || !inspection.deltaId || !inspection.packetId || !inspection.inspectedContentHash
  if (!inspection.accepted || hasBlockingRejections || hasMissingRequiredFields || isIncomplete) {
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
  // Second-review fix (P1), requirement 3: a delta whose accepted record
  // changes carry a kind `buildApplyPlanWithRecords` cannot represent (a
  // kind mismatch that somehow reached this point: e.g. a tampered or
  // stale inspection object bypassing `validateReturnedDelta`) is refused
  // rather than approved for an apply that would silently drop it again.
  const hasUnrepresentableRecordChange = inspection.recordChanges.some(
    (change) => change.kind !== 'contract' && !ALLOWED_SELF_RECORD_KINDS.has(change.kind),
  )
  if (hasUnrepresentableRecordChange) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          'CAP-DES-DELTA-RECORD-CHANGE-UNREPRESENTABLE',
          'an accepted record change carries a kind the apply plan cannot represent',
          { ruleId: 'CAP-12.2', relatedIds: [inspection.inspectionId] },
        ),
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
// §12.2: transactional apply plan
// ---------------------------------------------------------------------------

export type BuildApplyPlanInput = {
  planId: string
  backupRef: string
  /** Overrides the expected base workspace revision; defaults to the inspection's. */
  expectedWorkspaceRevision?: string
}

/** §12.2: verifies the base workspace revision and the inspected delta hash; deletes are ordered last. */
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
// Second-review fix (P1): carrying accepted record changes into the apply
// plan instead of silently discarding them (§12.2, §5.3)
// ---------------------------------------------------------------------------

export type PlanRecordChange = { recordId: string; kind: string; summary: string; payload?: unknown }

/**
 * The frozen `DeltaApplyPlan` type in records.ts (owned by a concurrent
 * agent; this module never edits records.ts) has no field for accepted
 * record changes, so this fix carries them in this parallel, exported
 * structure instead of leaving the apply plan to silently discard them the
 * way it used to: the exact second-review finding. Contract-change
 * request: add `recordChanges: PlanRecordChanges` directly to
 * `DeltaApplyPlan` in records.ts once that file is free to edit; until
 * then, callers use `buildApplyPlanWithRecords` (not `buildApplyPlan`)
 * whenever a delta may carry record changes, and pass both `plan` and
 * `recordChanges` to the apply executor.
 *
 * `moduleDesignChanges` (kind `'moduleDesign'`) carry real design content
 * and MUST be persisted as a new **draft** revision (via
 * `applyRecordChangeToDesign`) or the apply must fail: never silently
 * drop them, and never persist them as `approved` (§5.3, §12.2). Every
 * entry here already passed the §11.5 allowlist during inspection, so
 * `buildApplyPlanWithRecords` does not re-validate kind; it trusts an
 * `accepted` inspection.
 *
 * `contractChanges` (kind `'contract'`) are echoed here too for
 * visibility; persisting canonical contract records is out of scope for
 * this packet's core half (see the operations-layer wiring note in the
 * final report).
 */
export type PlanRecordChanges = {
  planId: string
  moduleDesignChanges: PlanRecordChange[]
  contractChanges: PlanRecordChange[]
}

export type BuildApplyPlanWithRecordsResult = { plan: DeltaApplyPlan; recordChanges: PlanRecordChanges }

/**
 * §12.2: `buildApplyPlan` plus the accepted record changes split by kind
 * (see `PlanRecordChanges`). Fully backward compatible with
 * `buildApplyPlan`: the returned `plan` is identical to what
 * `buildApplyPlan` would have produced for the same inputs.
 */
export function buildApplyPlanWithRecords(
  inspection: DeltaInspection,
  delta: ReturnedDelta,
  input: BuildApplyPlanInput,
): BuildApplyPlanWithRecordsResult {
  const plan = buildApplyPlan(inspection, delta, input)
  const allRecordChanges = delta.recordChanges ?? []
  return {
    plan,
    recordChanges: {
      planId: plan.planId,
      moduleDesignChanges: allRecordChanges.filter((change) => change.kind === 'moduleDesign'),
      contractChanges: allRecordChanges.filter((change) => change.kind === 'contract'),
    },
  }
}

export type RecordChangeInput = { recordId: string; kind: string; summary: string; payload?: unknown }
export type ApplyRecordChangeOutcome = { updated: ModuleDesignSpecification; diagnostics: CapDiagnostic[] }

/**
 * §12.2 / §5.3: pure projection of one accepted `moduleDesign` record
 * change onto the current module design. Always produces DRAFT content:
 * forces `status` to `'draft'` (or `'needsInput'` when the payload itself
 * requests that state) and strips any `approval` object or
 * `status: 'approved'` the payload tries to carry, emitting a diagnostic
 * when it does: a belt-and-braces re-check, since `validateReturnedDelta`
 * should already have rejected such a payload with
 * `record-change-sets-approval` before this helper ever runs. The caller
 * (operations layer) persists `updated` as a new draft revision; it must
 * never persist it as `approved` (§5.3 "a record shall move to `approved`
 * only through an explicit approval operation").
 *
 * Only meaningful for a `kind: 'moduleDesign'` change: call only with
 * entries from `buildApplyPlanWithRecords`'s
 * `recordChanges.moduleDesignChanges`. Any other kind is a caller error:
 * the design is returned unchanged with a diagnostic rather than guessing
 * at unstructured content.
 */
export function applyRecordChangeToDesign(design: ModuleDesignSpecification, change: RecordChangeInput): ApplyRecordChangeOutcome {
  if (change.kind !== 'moduleDesign') {
    return {
      updated: design,
      diagnostics: [
        diagnostic(
          'CAP-DES-RECORD-CHANGE-WRONG-KIND',
          `applyRecordChangeToDesign called with a non-moduleDesign kind "${change.kind}"; no content applied`,
          { ruleId: 'CAP-12.2', relatedIds: [change.recordId] },
        ),
      ],
    }
  }

  const diagnostics: CapDiagnostic[] = []
  const payload =
    change.payload && typeof change.payload === 'object' && !Array.isArray(change.payload) ? (change.payload as Record<string, unknown>) : {}

  if (recordChangeSetsApproval(payload)) {
    diagnostics.push(
      diagnostic(
        'CAP-DES-RECORD-CHANGE-APPROVAL-STRIPPED',
        'a record change cannot set an approved status or carry an approval object; it was stripped and the content is persisted as draft (§5.3)',
        { ruleId: 'CAP-5.3', relatedIds: [change.recordId] },
      ),
    )
  }

  const { approval: _droppedApproval, status: requestedStatus, ...restPayload } = payload as {
    approval?: unknown
    status?: unknown
    [key: string]: unknown
  }

  const nextStatus: ModuleDesignSpecification['status'] = requestedStatus === 'needsInput' ? 'needsInput' : 'draft'

  const updated: ModuleDesignSpecification = {
    ...design,
    ...(restPayload as Partial<ModuleDesignSpecification>),
    status: nextStatus,
    approval: undefined,
  }

  return { updated, diagnostics }
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
