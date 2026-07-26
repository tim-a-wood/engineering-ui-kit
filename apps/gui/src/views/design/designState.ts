/**
 * In-browser state store for the use-case-led Design workspace (EUC-17 GUI
 * foundation packet).
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §8 (all),
 * §9 (all), §18.1, §18.3, §19 "Lost client session", §22.1.
 *
 * This is a plain TS, React-external, subscribable store (`DesignStore`).
 * All state transitions call the pure core functions from
 * `@engineering-ui-kit/core/design-browser` so GUI behavior matches the
 * product rules exactly (§9, §16). `useDesignState` at the bottom is the only
 * React-dependent piece, kept separate from the store class itself.
 *
 * Default project: when no project is configured, the store loads
 * `buildSampleAuditHub()` (`SAMPLE_PROJECT_ID`, §22.1) and surfaces its
 * `syntheticDataStatement`.
 *
 * Autosave (§18.1): every mutating action schedules a short debounced
 * persist to `localStorage`; `saveState` ('idle' | 'saving' | 'saved') is
 * part of the state so the UI can show it. On construction the store reads
 * any persisted draft for the same project and restores it, including the
 * last-selected module and each module's session step (§19 "Lost client
 * session" — "Restore persisted draft and last selected module").
 */

import { useSyncExternalStore } from 'react'
import {
  buildSampleAuditHub,
  SAMPLE_PROJECT_ID,
  computeModuleDesignProgress,
  filterModuleQueue,
  selectDefaultModule,
  createModuleDesignDraft,
  applyModuleDesignChecks,
  evaluateModuleDesignChecks,
  approveModuleDesign,
  createSession,
  goToStep as coreGoToStep,
  answerSessionQuestion,
  completeStep as coreCompleteStep,
  sessionPrimaryAction,
  systemStructureStatus,
  buildContextManifest,
  MODULE_DESIGN_STEPS,
  updateModuleDesignItem,
  reopenModuleDesign,
  analyzeDesignChange,
  evaluateBuildGate,
  buildModuleDesignPacket,
  buildModuleImplementationPacket,
  multiPassContinuation,
  buildMultiModulePacket,
  contextLimitReport,
  inspectDelta as coreInspectDelta,
  approveDeltaToApply,
  buildApplyPlan,
  simulateApply,
  deterministicTestProvider,
  buildScenarioTestPlan,
  childId,
  type SystemStructureSpecification,
  type ModuleDesignSpecification,
  type ModuleDesignSession,
  type ModuleDesignProgress,
  type ModuleDesignProgressEntry,
  type ModuleQueueFilter,
  type ModuleDesignStep,
  type ModuleDesignCheckContext,
  type ModuleDesignCheckEvaluation,
  type SystemStructureStatusView,
  type UseCaseAnalysis,
  type UseCaseContentTarget,
  type ContractRegistry,
  type DesignBaseline,
  type DesignWorkflowPolicy,
  type IncrementalPreview,
  type ImplementationWavePlan,
  type ScenarioRun,
  type ModuleVerificationResult,
  type SampleDefects,
  type ScenarioTestPlan,
  type DesignImpactRecord,
  type DiagramDiscussionEntry,
  type DesignChangeKind,
  type ImpactWorld,
  type BuildGateResult,
  type ModuleDesignPacket,
  type ModuleImplementationPacket,
  type ContextManifest,
  type ContextLimitReport,
  type BuildMultiModulePacketResult,
  type MultiModulePacketEntry,
  type DeltaInspection,
  type DeltaApplyResult,
  type ReturnedDelta,
  type DiagramKind,
  type ValidNextAction,
  type DesignDiagnostic,
  type DesignAuditEvent,
  type DesignOperationResult,
  APPROVAL_AUTHORITIES,
  type ApprovalAuthority,
  type VerifySummary,
} from '@engineering-ui-kit/core/design-browser'
import type { OperationContract, CapDiagnostic } from '@engineering-ui-kit/core'
import {
  DesignBridgeClient,
  detectDesignBridgeCaller,
  isUnknownOperationResponse,
  LOCAL_USER_ACTOR,
  type AdapterConfigurationResponse,
  type AdapterPrincipalResponse,
  type AdapterProjectRolesResponse,
  type AdapterProjectSourceResponse,
  type AdapterConnectionStateResponse,
  type AdapterRolesResponse,
  type DesignBridgeCaller,
  type BridgeChangeInput,
} from './designBridgeClient'

/**
 * §4 "Users and authority" — the full authority list, mirrored from
 * `records.ts` `APPROVAL_AUTHORITIES` (re-exported by
 * `@engineering-ui-kit/core/design-browser`, imported directly above so this
 * never drifts from the canonical list). `ProjectSetupPanel`'s "Grant design
 * authorities to this session user" action requests every one of these for
 * the current principal — the coordinator's `adapter:configureProjectRoles`
 * implementation, not this GUI, decides whether the request is honored.
 */
export const ALL_DESIGN_AUTHORITIES: readonly ApprovalAuthority[] = APPROVAL_AUTHORITIES

/**
 * Local mirror of `getWorkflowStatus`'s return shape
 * (`packages/core/src/capabilities/design/operations.ts`) — renderer-safe
 * duplication, the same pattern `bridge.ts` uses for `bridgeApi.ts`.
 */
type WorkflowStatusResult = {
  projectId: string
  useCaseAnalysis: { draft?: UseCaseAnalysis; approved?: UseCaseAnalysis }
  systemStructure: { draft?: SystemStructureSpecification; approved?: SystemStructureSpecification }
  baseline: { draft?: DesignBaseline; approved?: DesignBaseline }
  policy: DesignWorkflowPolicy
  scenarioRuns?: ScenarioRun[]
  verificationApprovals?: { runId: string; approvedAt: string; approvalRef?: string; approvedBy?: string }[]
}

// ---------------------------------------------------------------------------
// Diagram discussion / propose-change target (§9.8)
// ---------------------------------------------------------------------------

/** Identifies a selected diagram element or relationship for the discuss/propose-change flow. */
export type DiagramElementTarget = {
  diagramId: string
  diagramKind: DiagramKind
  elementId: string
  elementLabel: string
  /** True only for the module's own "self" component element — the one demonstrable rename target. */
  isRenameable: boolean
}

// ---------------------------------------------------------------------------
// Build/handoff (§11, §12, §3.5)
// ---------------------------------------------------------------------------

export type ModuleHandoffResult = {
  ok: boolean
  kind: 'design' | 'implementation'
  packet?: ModuleDesignPacket | ModuleImplementationPacket
  diagnostics: CapDiagnostic[]
  gate?: BuildGateResult
  manifest: ContextManifest
  limitReport?: ContextLimitReport
  createdAt: string
}

/**
 * §3.3 real, per-user checkbox state for a multi-module handoff (review
 * finding #2) — never hardcoded. `WavesView` renders one "I confirm these
 * modules are independent" checkbox (`userConfirmedIndependence`) and one
 * per-module "Fixtures and external resources are isolated" checkbox
 * (`fixtureIsolationConfirmedByModuleId`), plus a third confirmation for
 * `receivingAgentSupportsCombinedTask` (§3.3's fifth bullet has no
 * spec-mandated label, unlike the first two).
 */
export type MultiModuleConfirmations = {
  userConfirmedIndependence: boolean
  receivingAgentSupportsCombinedTask: boolean
  fixtureIsolationConfirmedByModuleId: Record<string, boolean>
}

export type DeltaFlowState = {
  packet?: ModuleImplementationPacket
  delta?: ReturnedDelta
  deltaSource?: 'pasted' | 'file' | 'provider' | 'sample-demo'
  importError?: string
  inspection?: DeltaInspection
  approved: boolean
  applyResult?: DeltaApplyResult
  files: Record<string, string>
  filesBeforeApply?: Record<string, string>
  rolledBack: boolean
}

function emptyDeltaFlow(): DeltaFlowState {
  return { approved: false, files: {}, rolledBack: false }
}

export type SaveState = 'idle' | 'saving' | 'saved'

/**
 * §22.1 "sample ONLY when no project is configured" — the workspace has two
 * explicit modes: `'sample'` is the in-browser demo store (this file's
 * original behavior, unchanged); `'project'` means every read and change
 * operation is routed through the desktop bridge's `design:operation`
 * envelope to the real `DesignOperationsService`, and this store becomes a
 * thin cache of its results. See `DesignWorkspaceView`'s `data-mode`
 * attribute and sample banner, which make the active mode visible to users
 * and tests.
 */
export type DesignWorkspaceMode = 'sample' | 'project'

/** Status of the one in-flight or last-completed bridge round trip, for the mode banner / loading states in `project` mode. */
export type BridgeStatus = 'idle' | 'loading' | 'ready' | 'error'

export type EvidenceArtifactLoadResult =
  | {
      ok: true
      ref: string
      mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'application/json' | 'text/plain'
      sha256: string
      bytes: number
      encoding: 'base64' | 'utf8'
      content: string
      fileName: string
    }
  | { ok: false; message: string }

// ---------------------------------------------------------------------------
// Project setup (§4, §17.3, §20.2, §25.3 — second-review P1: "nothing
// configures the repository adapter or project roles")
// ---------------------------------------------------------------------------

/** `adapter:getProjectRepository` / `adapter:configureProjectRepository` cache. */
export type RepositoryConfigState =
  | { status: 'idle' | 'loading' }
  | { status: 'configured'; repositoryRoot: string }
  | { status: 'not-configured'; message: string }
  | { status: 'error'; message: string }

/** `adapter:getPrincipal` cache — `'unavailable'` is the graceful fallback for a desktop build that has not implemented the operation yet (`EUC16-UNKNOWN-OPERATION`). */
export type PrincipalState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; principal: string }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string }

/** `adapter:configureProjectRoles` cache — same `'unavailable'` graceful fallback. */
export type RolesGrantState =
  | { status: 'idle' | 'loading' }
  | { status: 'granted'; principal: string; authorities: string[] }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string }

/** `getScenarioCoverage` / `getVerificationEvidence` cache for `project`-mode Verify (§14.4, §17.1). */
export type ProjectVerificationState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; summary?: VerifySummary; evidence?: ScenarioRun }
  | { status: 'error'; message: string }

/** Results returned by the real Connect executors, keyed by module id. */
export type WorkflowConnectionState = {
  status: 'idle' | 'configuring' | 'configured' | 'verifying' | 'verified' | 'failed'
  configuration?: unknown
  verification?: unknown
  message?: string
}

export type ProjectSourcePreviewState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; ref: string; fileName: string; mediaType: string; sha256: string; bytes: number; content: string; truncated: boolean }
  | { status: 'error'; ref: string; message: string }

export type ScenarioActionState = {
  status: 'idle' | 'running' | 'approving' | 'approved' | 'error'
  message?: string
  runId?: string
}

/** §17.3 "actor... does not hold... an authority" — the exact diagnostic code the Blocked-state guidance watches for. */
export const AUTHORITY_NOT_CONFIGURED_CODE = 'EUC16-AUTHORITY-NOT-CONFIGURED'

export type DesignState = {
  mode: DesignWorkspaceMode
  /** `project` mode only — the last bridge transport/service-level error, rendered verbatim; cleared on the next successful call. */
  bridgeError?: string
  bridgeStatus: BridgeStatus
  /** `project` mode only — drives button enablement (§17.3 "return valid next actions"); never computed locally. */
  validNextActions: ValidNextAction[]
  /** `project` mode only — diagnostics from the most recent change operation, rendered verbatim (§17.3 "return structured diagnostics"). */
  lastOperationDiagnostics: DesignDiagnostic[]
  projectId: string
  syntheticDataStatement: string
  architecture: SystemStructureSpecification
  approvedModuleDesigns: Record<string, ModuleDesignSpecification>
  moduleDesigns: ModuleDesignSpecification[]
  sessions: Record<string, ModuleDesignSession>
  approvedContracts: OperationContract[]
  progress: ModuleDesignProgress
  systemStatus: SystemStructureStatusView
  selectedModuleId?: string
  canvasSelectedModuleId?: string
  queueFilter: ModuleQueueFilter
  focusMode: boolean
  listView: boolean
  saveState: SaveState
  savedAt?: string
  announcement: string

  // -- Build/Verify/Evidence additions (EUC-17 part 2) --------------------
  useCaseAnalysis: UseCaseAnalysis
  contractRegistry: ContractRegistry
  designBaseline: DesignBaseline
  policy: DesignWorkflowPolicy
  incrementalPreview: IncrementalPreview
  wavePlan: ImplementationWavePlan
  copilotHandoffTargets: { wave: number; moduleId: string }[]
  scenarioTestPlan: ScenarioTestPlan
  scenarioRuns: ScenarioRun[]
  verificationResults: Record<string, ModuleVerificationResult[]>
  defects: SampleDefects
  /** §9.8 detail-modal discussion history, keyed by element/relationship id. */
  diagramDiscussions: Record<string, DiagramDiscussionEntry[]>
  /** Impact records produced by `proposeDiagramChange`, keyed by `impactId`. */
  diagramImpacts: Record<string, DesignImpactRecord>
  /** The most recent handoff attempt per module (§11.2, §11.3). */
  moduleHandoffs: Record<string, ModuleHandoffResult>
  /** The most recent multi-module handoff attempt (§3.3). */
  multiModuleHandoff?: { moduleIds: string[]; result: BuildMultiModulePacketResult }
  /** The returned-delta review flow, keyed by module id (§11.5, §11.6, §12). */
  deltaFlows: Record<string, DeltaFlowState>

  // -- Project setup (`project` mode only) --------------------------------
  repositoryConfig: RepositoryConfigState
  principal: PrincipalState
  rolesGrant: RolesGrantState
  sourcePreview: ProjectSourcePreviewState

  // -- Verify (`project` mode only) ---------------------------------------
  projectVerification: ProjectVerificationState
  scenarioActions: Record<string, ScenarioActionState>
  verificationApprovals: Record<string, { approvedAt: string; approvalRef?: string }>
  /** Live-project Connect results. The persisted binding itself remains adapter-owned. */
  connections: Record<string, WorkflowConnectionState>
}

const STORAGE_PREFIX = 'euik-design-workspace:'
const AUTOSAVE_DELAY_MS = 150

type PersistedShape = {
  schemaVersion: 1
  selectedModuleId?: string
  canvasSelectedModuleId?: string
  queueFilter: ModuleQueueFilter
  focusMode: boolean
  listView: boolean
  moduleDrafts: Record<string, ModuleDesignSpecification>
  sessions: Record<string, ModuleDesignSession>
  savedAt: string
}

function storageKey(projectId: string): string {
  return `${STORAGE_PREFIX}${projectId}`
}

function readPersisted(projectId: string): PersistedShape | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const raw = window.localStorage.getItem(storageKey(projectId))
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as PersistedShape
    if (parsed.schemaVersion !== 1) return undefined
    return parsed
  } catch {
    return undefined
  }
}

function writePersisted(projectId: string, payload: PersistedShape): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(payload))
  } catch {
    /* private-mode / quota — autosave silently degrades, draft stays in memory */
  }
}

/** A module blocks (§9.2 `Waiting for dependency`) when it has never been
 * approved and at least one direct dependency has never been approved.
 * Returns the blocking *module ids* (not prose) — the view layer resolves
 * names for the explanation text. */
function computeBlockers(
  architecture: SystemStructureSpecification,
  approvedModuleDesigns: Record<string, ModuleDesignSpecification>,
): Record<string, string[]> {
  const blockers: Record<string, string[]> = {}
  for (const moduleId of architecture.moduleIds) {
    if (approvedModuleDesigns[moduleId]) continue
    const dependencyIds = architecture.dependencyEdges.filter((edge) => edge.fromModuleId === moduleId).map((edge) => edge.toModuleId)
    const unapproved = dependencyIds.filter((dependencyId) => !approvedModuleDesigns[dependencyId])
    if (unapproved.length > 0) blockers[moduleId] = unapproved
  }
  return blockers
}

function mergeById<T extends { module: { moduleId: string } }>(base: T[], overrides?: Record<string, T>): T[] {
  if (!overrides) return base
  return base.map((item) => overrides[item.module.moduleId] ?? item)
}

/**
 * A module that already has a design (created outside this GUI session, e.g.
 * the sample) does not necessarily have a matching in-memory session. This
 * infers the six-step completion the design's own `status` already implies,
 * so the session view opens on the correct current step instead of
 * incorrectly restarting a design that is actually `readyForReview` or
 * `approved` (§9.3 resume semantics).
 */
function inferredCompletedSteps(design: ModuleDesignSpecification): ModuleDesignStep[] {
  switch (design.status) {
    case 'draft':
      return []
    case 'needsInput':
      return ['boundary']
    case 'readyForReview':
      return ['boundary', 'behavior', 'contracts', 'diagrams', 'checks']
    case 'approved':
    case 'stale':
    case 'superseded':
    case 'conflict':
    case 'withdrawn':
      return [...MODULE_DESIGN_STEPS]
    default:
      return []
  }
}

function inferredCurrentStep(design: ModuleDesignSpecification): ModuleDesignStep {
  const completed = inferredCompletedSteps(design)
  return MODULE_DESIGN_STEPS.find((step) => !completed.includes(step)) ?? 'approval'
}

/** Builds a session consistent with `design.status` when none was persisted or shipped with the snapshot. */
function materializeSession(projectId: string, architectureRevision: string, design: ModuleDesignSpecification, now: string): ModuleDesignSession {
  const manifest = buildContextManifest({ targetRecordId: design.id, targetRevision: design.revision, limit: 200_000, candidates: [] })
  const base = createSession({
    projectId,
    moduleId: design.module.moduleId,
    baseArchitectureRevision: architectureRevision,
    baseModuleDesignRevision: design.status === 'approved' ? design.revision : undefined,
    sourceManifest: manifest,
    now,
  })
  const completedSteps = inferredCompletedSteps(design)
  return {
    ...base,
    completedSteps,
    currentStep: inferredCurrentStep(design),
    state: completedSteps.length === MODULE_DESIGN_STEPS.length ? 'completed' : design.status === 'needsInput' ? 'needsInput' : design.status === 'readyForReview' ? 'readyForReview' : 'drafting',
  }
}

function loadDefaultSnapshot(): {
  projectId: string
  syntheticDataStatement: string
  architecture: SystemStructureSpecification
  approvedModuleDesigns: Record<string, ModuleDesignSpecification>
  moduleDesigns: ModuleDesignSpecification[]
  sessions: ModuleDesignSession[]
  approvedContracts: OperationContract[]
  useCaseAnalysis: UseCaseAnalysis
  contractRegistry: ContractRegistry
  designBaseline: DesignBaseline
  policy: DesignWorkflowPolicy
  incrementalPreview: IncrementalPreview
  wavePlan: ImplementationWavePlan
  copilotHandoffTargets: { wave: number; moduleId: string }[]
  scenarioTestPlan: ScenarioTestPlan
  scenarioRuns: ScenarioRun[]
  verificationResults: Record<string, ModuleVerificationResult[]>
  defects: SampleDefects
} {
  const sample = buildSampleAuditHub()
  return {
    projectId: sample.projectId,
    syntheticDataStatement: sample.syntheticDataStatement,
    architecture: sample.architecture,
    approvedModuleDesigns: sample.approvedModuleDesigns,
    moduleDesigns: sample.moduleDesigns,
    sessions: sample.sessions,
    approvedContracts: sample.operationContracts.contracts.filter((c) => c.status === 'approved').map((c) => c.contract),
    useCaseAnalysis: sample.useCaseAnalysis,
    contractRegistry: sample.operationContracts,
    designBaseline: sample.designBaseline,
    policy: sample.policy,
    incrementalPreview: sample.incrementalPreview,
    wavePlan: sample.wavePlan,
    copilotHandoffTargets: sample.copilotHandoffTargets,
    scenarioTestPlan: sample.scenarioTestPlan,
    scenarioRuns: sample.scenarioRuns,
    verificationResults: sample.verificationResults,
    defects: sample.defects,
  }
}

/**
 * A valid, empty `SystemStructureSpecification` — the placeholder used only
 * before the first `project`-mode `getWorkflowStatus` response arrives, or
 * when a real project has no approved (and no draft) system structure yet.
 * Every consuming view (`SystemCanvas`, `ModuleQueue`, ...) already renders
 * an empty state correctly for zero modules; this never fabricates content.
 */
function emptySystemStructure(projectId: string): SystemStructureSpecification {
  return {
    schemaVersion: '1.0',
    projectId,
    id: `${projectId}.architecture.pending`,
    revision: '',
    status: 'draft',
    applicationSpecId: '',
    applicationSpecRevision: '',
    applicationSpecHash: '',
    capabilityProjections: [],
    moduleIds: [],
    moduleDefinitions: [],
    dependencyEdges: [],
    operationAllocations: [],
    adapterAllocations: [],
    workflowTraces: [],
    proposals: [],
    unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-DES-SYS', passed: false, diagnostics: [] },
    deployables: [],
    modulePaths: [],
    contentHash: '',
  }
}

function emptyUseCaseAnalysis(projectId: string, now: string): UseCaseAnalysis {
  return {
    schemaVersion: '1.0',
    projectId,
    id: `${projectId}.use-case-analysis.pending`,
    revision: '',
    status: 'draft',
    workDescription: '',
    examples: [],
    prohibitedResults: [],
    actors: [],
    useCases: [],
    rules: [],
    qualityNeeds: [],
    sources: [],
    questions: [],
    gates: [],
    contentHash: '',
  }
}

function emptyDesignBaseline(projectId: string, architecture: SystemStructureSpecification): DesignBaseline {
  return {
    schemaVersion: '1.0',
    projectId,
    id: `${projectId}.design-baseline.pending`,
    revision: '',
    status: 'draft',
    architecture: { id: architecture.id, revision: architecture.revision, contentHash: architecture.contentHash },
    modules: [],
    operationContracts: [],
    requiredModuleIds: [],
    missingModuleIds: [],
    gates: [],
    contentHash: '',
  }
}

function emptyPolicy(projectId: string, actor: string, now: string): DesignWorkflowPolicy {
  return { projectId, mode: 'completeBaseline', changedAt: now, changedBy: actor }
}

/**
 * §22.1's `SampleDefects` / `IncrementalPreview` / `PackageExportOldResult`
 * types are documented in `packages/core/src/capabilities/design/
 * sampleAuditHub.ts` as "sample-specific supporting types (not canonical
 * records)" — there is no bridge operation that could honestly populate
 * them for a real project, and this store never fabricates defect or
 * defect-demo content for one. These placeholders exist only so
 * `DesignState`'s shared type can retain the sample-only defect gallery in
 * sample mode. Live-project Verify and Evidence use canonical `ScenarioRun`
 * records returned by `getWorkflowStatus`; they never read these values.
 */
function emptyModuleVerificationResult(now: string): ModuleVerificationResult {
  return { moduleId: '', caseId: '', outcome: 'skipped', summary: 'Not available in project mode yet.', evidenceRefs: [], recordedAt: now }
}

function emptyDesignAuditEvent(projectId: string, actor: string, now: string): DesignAuditEvent {
  return { eventId: `${projectId}.audit.none`, projectId, actor, operation: 'none', at: now, outcome: 'ok', diagnosticCodes: [], evidenceRefs: [] }
}

function emptyScenarioRun(projectId: string, now: string): ScenarioRun {
  return {
    schemaVersion: '1.0',
    runId: `${projectId}.run.none`,
    projectId,
    scenarioId: 'none',
    useCaseId: 'none',
    identity: {
      useCaseAnalysisRevision: '',
      applicationRevision: '',
      systemStructureRevision: '',
      moduleDesignRevisions: {},
      implementationRevisions: {},
      connectionRevision: '',
      build: '',
      sourceRevision: '',
      environment: '',
      testDataRevision: '',
      runner: '',
    },
    steps: [],
    outcome: 'skipped',
    startedAt: now,
    completedAt: now,
    evidenceHashes: [],
    contentHash: '',
  }
}

/** The synchronous placeholder state used the instant a `project`-mode store is constructed, before its first bridge round trip resolves — see `DesignStore.ready`. */
function emptyProjectState(projectId: string, actor: string = LOCAL_USER_ACTOR): DesignState {
  const now = new Date().toISOString()
  const architecture = emptySystemStructure(projectId)
  const policy = emptyPolicy(projectId, actor, now)
  return {
    mode: 'project',
    bridgeStatus: 'loading',
    bridgeError: undefined,
    validNextActions: [],
    lastOperationDiagnostics: [],
    projectId,
    syntheticDataStatement: '',
    architecture,
    approvedModuleDesigns: {},
    moduleDesigns: [],
    sessions: {},
    approvedContracts: [],
    progress: { projectId, architectureRevision: '', total: 0, notStarted: 0, draft: 0, needsInput: 0, readyForReview: 0, approved: 0, stale: 0, blocked: 0, modules: [] },
    systemStatus: { approved: false, approvedModuleDesignCount: 0, remainingModuleDesignCount: 0, blockingModuleIds: [] },
    selectedModuleId: undefined,
    canvasSelectedModuleId: undefined,
    queueFilter: 'all',
    focusMode: true,
    listView: false,
    saveState: 'idle',
    savedAt: undefined,
    announcement: 'Loading project design workspace…',
    useCaseAnalysis: emptyUseCaseAnalysis(projectId, now),
    contractRegistry: { contracts: [] },
    designBaseline: emptyDesignBaseline(projectId, architecture),
    policy,
    incrementalPreview: { policy, gateForFirstModule: { moduleId: '', result: { ok: true, diagnostics: [] } } },
    wavePlan: { projectId, architectureRevision: '', waves: [], autoDispatch: false },
    copilotHandoffTargets: [],
    scenarioTestPlan: { projectId, analysisId: '', analysisRevision: '', entries: [], diagnostics: [] },
    scenarioRuns: [],
    verificationResults: {},
    defects: {
      evidenceGraphBrokenTrace: emptyModuleVerificationResult(now),
      matlabAdapterTimeout: emptyModuleVerificationResult(now),
      spreadsheetInvalidMapping: emptyModuleVerificationResult(now),
      findingReviewRejectedDecision: emptyDesignAuditEvent(projectId, actor, now),
      packageExportOldResult: { run: emptyScenarioRun(projectId, now), currentState: 'current' },
    },
    diagramDiscussions: {},
    diagramImpacts: {},
    moduleHandoffs: {},
    deltaFlows: {},
    repositoryConfig: { status: 'idle' },
    principal: { status: 'idle' },
    rolesGrant: { status: 'idle' },
    sourcePreview: { status: 'idle' },
    projectVerification: { status: 'idle' },
    scenarioActions: {},
    verificationApprovals: {},
    connections: {},
  }
}

/** `project`-mode connection: which real project to talk to, over which bridge caller. */
export type DesignStoreBridgeOptions = {
  projectId: string
  /** Defaults to `LOCAL_USER_ACTOR` — see `designBridgeClient.ts` for why. */
  actor?: string
  call: DesignBridgeCaller
}

export type DesignStoreOptions = {
  /** Deterministic clock for tests; defaults to `new Date().toISOString()`. */
  now?: () => string
  /** Overrides the default sample snapshot (tests only). */
  snapshot?: ReturnType<typeof loadDefaultSnapshot>
  /**
   * `project` mode (§17, §22.1): when provided, the store never loads the
   * sample and never calls a core pure function to decide a canonical
   * outcome — every read and change goes through `bridge.call` and the
   * store becomes a thin cache of the results. Omit for `sample` mode
   * (default; unchanged in-browser demo behavior).
   */
  bridge?: DesignStoreBridgeOptions
}

/**
 * React-external, subscribable store for the Design workspace. Construct one
 * per mounted workspace (or share a module-level singleton via
 * `getDesignStore`). Constructing a *new* store against the same
 * `localStorage` simulates an application reload (§19 "Lost client session"),
 * which is how `resume at exact step after simulated reload` is tested.
 */
export class DesignStore {
  private state: DesignState
  private listeners = new Set<() => void>()
  private saveTimer: ReturnType<typeof setTimeout> | undefined
  private readonly now: () => string
  private executionIdentity: Partial<Pick<
    ScenarioRun['identity'],
    'build' | 'sourceRevision' | 'environment' | 'testDataRevision' | 'runner'
  >> = {}
  /** `project` mode only; unset in `sample` mode. */
  private readonly bridgeClient?: DesignBridgeClient
  /**
   * `project` mode only — resolves once the first `getWorkflowStatus` /
   * `listModuleDesigns` / `getImplementationWaves` / `getValidNextActions`
   * round trip has been applied to state. Tests await this instead of
   * polling; `sample` mode resolves it immediately (nothing to load).
   */
  readonly ready: Promise<void>
  /**
   * `project` mode only. Every method with a synchronous, pre-existing
   * return type (kept unchanged so `sample`-mode callers and tests are
   * unaffected — see review finding #1 acceptance notes) dispatches its
   * bridge round trip in the background and records it here; production
   * code observes the result through `subscribe`/`getState()` as usual,
   * and tests can `await store.waitForPendingOperation()` for a
   * deterministic point after the round trip has been applied to state.
   */
  private pendingOperation: Promise<unknown> = Promise.resolve()
  /** Prevents an older Verify read from overwriting a newer post-run summary. */
  private projectVerificationRequest = 0

  async waitForPendingOperation(): Promise<void> {
    await this.pendingOperation
  }

  /**
   * Resolves one opaque evidence reference without exposing a host path to the
   * renderer. Project artifacts cross the desktop trust boundary; bundled
   * sample artifacts are fetched from the signed application bundle and
   * hashed before display.
   */
  async loadEvidenceArtifact(ref: string): Promise<EvidenceArtifactLoadResult> {
    if (this.bridgeClient) {
      try {
        const response = await this.bridgeClient.read<
          | (Omit<Extract<EvidenceArtifactLoadResult, { ok: true }>, 'ref'> & { ok: true; ref: string })
          | { ok: false; diagnostics?: { message?: string }[] }
        >('adapter:getEvidenceArtifact', [{ projectId: this.state.projectId, ref }])
        if (!response.ok) return { ok: false, message: response.diagnostics?.[0]?.message ?? 'The evidence artifact could not be opened.' }
        return response
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) }
      }
    }

    const match = /^sample-evidence:\/\/(screenshots|structured)\/([a-z0-9][a-z0-9.-]{0,180})$/i.exec(ref)
    if (!match || typeof window === 'undefined') return { ok: false, message: 'This evidence reference is not supported.' }
    const [, directory = '', fileName = ''] = match
    try {
      const url = new URL(`sample-evidence/${directory}/${fileName}`, document.baseURI)
      const response = await fetch(url)
      if (!response.ok) return { ok: false, message: `Bundled evidence is missing (${response.status}).` }
      const bytes = new Uint8Array(await response.arrayBuffer())
      const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
      const sha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
      const extension = fileName.split('.').pop()?.toLowerCase()
      const mediaType: Extract<EvidenceArtifactLoadResult, { ok: true }>['mediaType'] =
        extension === 'png' ? 'image/png'
          : extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg'
            : extension === 'webp' ? 'image/webp'
              : extension === 'json' ? 'application/json'
                : 'text/plain'
      const binary = mediaType.startsWith('image/')
      let content: string
      if (binary) {
        let raw = ''
        const chunk = 0x8000
        for (let offset = 0; offset < bytes.length; offset += chunk) {
          raw += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunk, bytes.length)))
        }
        content = window.btoa(raw)
      } else {
        content = new TextDecoder().decode(bytes)
      }
      return {
        ok: true,
        ref,
        mediaType,
        sha256,
        bytes: bytes.byteLength,
        encoding: binary ? 'base64' : 'utf8',
        content,
        fileName,
      }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  constructor(options: DesignStoreOptions = {}) {
    this.now = options.now ?? (() => new Date().toISOString())

    if (options.bridge) {
      const { projectId, call } = options.bridge
      const actor = options.bridge.actor ?? LOCAL_USER_ACTOR
      this.bridgeClient = new DesignBridgeClient(call, projectId, actor)
      this.state = emptyProjectState(projectId, actor)
      this.ready = this.refreshProjectState()
      return
    }

    this.ready = Promise.resolve()
    const snapshot = options.snapshot ?? loadDefaultSnapshot()
    const persisted = readPersisted(snapshot.projectId)

    const moduleDesigns = mergeById(snapshot.moduleDesigns, persisted?.moduleDrafts)
    const sessionsRecord: Record<string, ModuleDesignSession> = {}
    for (const session of snapshot.sessions) sessionsRecord[session.moduleId] = session
    if (persisted?.sessions) Object.assign(sessionsRecord, persisted.sessions)
    // Every design needs a matching session so the workspace opens on the
    // correct step; the sample (and a caller-supplied snapshot) may not ship
    // one for every module.
    for (const design of moduleDesigns) {
      if (!sessionsRecord[design.module.moduleId]) {
        sessionsRecord[design.module.moduleId] = materializeSession(snapshot.projectId, snapshot.architecture.revision, design, this.now())
      }
    }

    const architecture = snapshot.architecture
    const approvedModuleDesigns = snapshot.approvedModuleDesigns
    const blockers = computeBlockers(architecture, approvedModuleDesigns)
    const progress = computeModuleDesignProgress(architecture, moduleDesigns, Object.values(sessionsRecord), blockers)
    const systemStatus = systemStructureStatus(
      architecture,
      progress.modules.map((entry) => ({ moduleId: entry.moduleId, approved: entry.state === 'approved' })),
    )

    const requestedSelection = persisted?.selectedModuleId
    const selectedModuleId =
      requestedSelection && progress.modules.some((entry) => entry.moduleId === requestedSelection)
        ? requestedSelection
        : selectDefaultModule(progress, persisted?.canvasSelectedModuleId)

    this.state = {
      mode: 'sample',
      bridgeStatus: 'idle',
      bridgeError: undefined,
      validNextActions: [],
      lastOperationDiagnostics: [],
      projectId: snapshot.projectId,
      syntheticDataStatement: snapshot.syntheticDataStatement,
      architecture,
      approvedModuleDesigns,
      moduleDesigns,
      sessions: sessionsRecord,
      approvedContracts: snapshot.approvedContracts,
      progress,
      systemStatus,
      selectedModuleId,
      canvasSelectedModuleId: persisted?.canvasSelectedModuleId,
      queueFilter: persisted?.queueFilter ?? 'all',
      focusMode: persisted?.focusMode ?? true,
      listView: persisted?.listView ?? false,
      saveState: 'idle',
      savedAt: persisted?.savedAt,
      announcement: persisted ? 'Restored your last session.' : '',
      useCaseAnalysis: snapshot.useCaseAnalysis,
      contractRegistry: snapshot.contractRegistry,
      designBaseline: snapshot.designBaseline,
      policy: snapshot.policy,
      incrementalPreview: snapshot.incrementalPreview,
      wavePlan: snapshot.wavePlan,
      copilotHandoffTargets: snapshot.copilotHandoffTargets,
      scenarioTestPlan: snapshot.scenarioTestPlan,
      scenarioRuns: snapshot.scenarioRuns,
      verificationResults: snapshot.verificationResults,
      defects: snapshot.defects,
      diagramDiscussions: {},
      diagramImpacts: {},
      moduleHandoffs: {},
      deltaFlows: {},
      // `sample` mode never talks to the bridge/adapter — these stay `idle`
      // and `ProjectSetupPanel`/`project`-mode Verify are never rendered.
      repositoryConfig: { status: 'idle' },
      principal: { status: 'idle' },
      rolesGrant: { status: 'idle' },
      sourcePreview: { status: 'idle' },
      projectVerification: { status: 'idle' },
      scenarioActions: {},
      verificationApprovals: {},
      connections: {},
    }
  }

  getState(): DesignState {
    return this.state
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }

  private patch(next: Partial<DesignState>): void {
    this.state = { ...this.state, ...next }
  }

  private recomputeProgress(): void {
    const blockers = computeBlockers(this.state.architecture, this.state.approvedModuleDesigns)
    const progress = computeModuleDesignProgress(this.state.architecture, this.state.moduleDesigns, Object.values(this.state.sessions), blockers)
    const systemStatus = systemStructureStatus(
      this.state.architecture,
      progress.modules.map((entry) => ({ moduleId: entry.moduleId, approved: entry.state === 'approved' })),
    )
    this.patch({ progress, systemStatus })
  }

  private touchDesign(design: ModuleDesignSpecification): void {
    const exists = this.state.moduleDesigns.some((d) => d.module.moduleId === design.module.moduleId)
    const moduleDesigns = exists
      ? this.state.moduleDesigns.map((d) => (d.module.moduleId === design.module.moduleId ? design : d))
      : [...this.state.moduleDesigns, design]
    this.patch({ moduleDesigns })
  }

  private touchSession(session: ModuleDesignSession): void {
    this.patch({ sessions: { ...this.state.sessions, [session.moduleId]: session } })
  }

  private announce(text: string): void {
    this.patch({ announcement: text })
  }

  // ---------------------------------------------------------------------
  // `project` mode — bridge plumbing (§17, §22.1, review finding #1)
  //
  // Every method below either issues exactly one `DesignBridgeClient` call
  // (a real `design:operation` round trip) or is a pure, non-authoritative
  // presentation projection over data the bridge already returned
  // (`materializeSession`, `systemStructureStatus`, `selectDefaultModule`).
  // None of them decide an approval, a check outcome, or a gate result —
  // those always come back from the service's own `DesignOperationResult`.
  // ---------------------------------------------------------------------

  isProjectMode(): boolean {
    return this.state.mode === 'project'
  }

  /**
   * Supplies the current desktop delivery-run identity to subsequent
   * scenario executions. This is presentation/application context (the
   * immutable run still gets its canonical design revisions from the
   * service), and never grants an approval or changes a gate.
   */
  setExecutionIdentity(identity: Partial<Pick<
    ScenarioRun['identity'],
    'build' | 'sourceRevision' | 'environment' | 'testDataRevision' | 'runner'
  >>): void {
    this.executionIdentity = { ...identity }
  }

  private requireBridge(): DesignBridgeClient {
    if (!this.bridgeClient) throw new Error('DesignStore is not in project mode')
    return this.bridgeClient
  }

  /** One `getModuleDesign` read — fetches and caches the current full record for one module. */
  private async loadModuleDesign(moduleId: string): Promise<ModuleDesignSpecification | undefined> {
    const client = this.requireBridge()
    const design = await client.read<ModuleDesignSpecification | undefined>('getModuleDesign', [client.projectId, moduleId])
    if (design) this.applyDesignRecord(design)
    this.emit()
    return design
  }

  /** Caches a design record returned by the bridge and derives its session step locally (no bridge op exists for session-step navigation — see file header). */
  private applyDesignRecord(design: ModuleDesignSpecification): void {
    this.touchDesign(design)
    if (design.status === 'approved') {
      this.patch({ approvedModuleDesigns: { ...this.state.approvedModuleDesigns, [design.module.moduleId]: design } })
    }
    const priorSession = this.state.sessions[design.module.moduleId]
    const inferred = inferredCompletedSteps(design)
    const session =
      priorSession && priorSession.moduleId === design.module.moduleId
        ? (() => {
            // Session navigation is presentation state: the service owns the
            // design record and its gates, but it has no operation for
            // acknowledging read-only Boundary/Contracts/Diagrams reviews.
            // Preserve those completed steps across bridge refreshes, then
            // advance when a service result (for example readyForReview)
            // proves that the current step is complete.
            const completedSteps = MODULE_DESIGN_STEPS.filter(
              (step) => priorSession.completedSteps.includes(step) || inferred.includes(step),
            )
            const currentStep = completedSteps.includes(priorSession.currentStep)
              ? MODULE_DESIGN_STEPS.find((step) => !completedSteps.includes(step)) ?? 'approval'
              : priorSession.currentStep
            return { ...priorSession, completedSteps, currentStep }
          })()
        : materializeSession(this.state.projectId, this.state.architecture.revision, design, this.now())
    this.touchSession(session)
  }

  /**
   * The one full-workspace refresh: `getWorkflowStatus`, `listModuleDesigns`,
   * `getImplementationWaves`, `getValidNextActions` (§17.1). Called once at
   * construction and again after every mutating call, so the workspace
   * always reflects the service's own current state — never a locally
   * computed approximation.
   */
  private async refreshProjectState(): Promise<void> {
    const client = this.requireBridge()
    this.patch({ bridgeStatus: 'loading' })
    this.emit()
    try {
      const [workflowStatus, progress, wavePlan, validNextActions] = await Promise.all([
        client.read<WorkflowStatusResult>('getWorkflowStatus', [client.projectId]),
        client.read<ModuleDesignProgress>('listModuleDesigns', [client.projectId, 'all']),
        client.read<ImplementationWavePlan>('getImplementationWaves', [client.projectId]),
        client.read<ValidNextAction[]>('getValidNextActions', [client.projectId]),
      ])
      const architecture = workflowStatus.systemStructure?.approved ?? workflowStatus.systemStructure?.draft ?? emptySystemStructure(client.projectId)
      const approvedAnalysis = workflowStatus.useCaseAnalysis?.approved
      const draftAnalysis = workflowStatus.useCaseAnalysis?.draft
      const useCaseAnalysis =
        draftAnalysis && (!approvedAnalysis || (draftAnalysis.revision !== approvedAnalysis.revision && draftAnalysis.status !== 'approved'))
          ? draftAnalysis
          : approvedAnalysis ?? draftAnalysis ?? emptyUseCaseAnalysis(client.projectId, this.now())
      const designBaseline = workflowStatus.baseline?.approved ?? workflowStatus.baseline?.draft ?? emptyDesignBaseline(client.projectId, architecture)
      const policy = workflowStatus.policy ?? emptyPolicy(client.projectId, client.actor, this.now())
      const scenarioRuns = workflowStatus.scenarioRuns ?? []
      const verificationApprovals = Object.fromEntries(
        (workflowStatus.verificationApprovals ?? []).map((approval) => [
          approval.runId,
          { approvedAt: approval.approvedAt, approvalRef: approval.approvalRef },
        ]),
      )
      const scenarioTestPlan = approvedAnalysis
        ? buildScenarioTestPlan(approvedAnalysis)
        : { projectId: client.projectId, analysisId: useCaseAnalysis.id, analysisRevision: useCaseAnalysis.revision, entries: [], diagnostics: [] }
      const systemStatus = systemStructureStatus(
        architecture,
        progress.modules.map((entry) => ({ moduleId: entry.moduleId, approved: entry.state === 'approved' })),
      )
      const selectedModuleId =
        this.state.selectedModuleId && progress.modules.some((entry) => entry.moduleId === this.state.selectedModuleId)
          ? this.state.selectedModuleId
          : selectDefaultModule(progress, this.state.canvasSelectedModuleId)

      this.patch({
        architecture,
        useCaseAnalysis,
        designBaseline,
        policy,
        scenarioRuns,
        verificationApprovals,
        scenarioTestPlan,
        progress,
        systemStatus,
        wavePlan,
        validNextActions,
        selectedModuleId,
        bridgeStatus: 'ready',
        bridgeError: undefined,
      })
      if (selectedModuleId) await this.loadModuleDesign(selectedModuleId)
    } catch (error) {
      this.patch({ bridgeStatus: 'error', bridgeError: error instanceof Error ? error.message : String(error) })
    }
    this.emit()
  }

  /** Runs one bridge change operation, applies its result (diagnostics, revision, `validNextActions`), and refreshes the workspace. Never decides locally whether the operation "should" succeed. */
  private async runChangeOperation<T>(
    operation: string,
    input: BridgeChangeInput,
    onValue?: (value: T) => void,
  ): Promise<DesignOperationResult<T>> {
    const client = this.requireBridge()
    this.patch({ saveState: 'saving' })
    this.emit()
    try {
      const result = await client.change<DesignOperationResult<T>>(operation, input)
      this.patch({
        lastOperationDiagnostics: result.diagnostics,
        validNextActions: result.validNextActions,
        saveState: 'saved',
        savedAt: this.now(),
        announcement: result.ok
          ? `${operation} succeeded.`
          : `${operation} was rejected: ${result.diagnostics[0]?.message ?? 'see diagnostics'}.`,
      })
      if (result.ok && result.value !== undefined && onValue) onValue(result.value)
      await this.refreshProjectState()
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.patch({ saveState: 'idle', bridgeError: message, announcement: `${operation} failed: ${message}` })
      this.emit()
      throw error
    }
  }

  private schedulePersist(): void {
    this.patch({ saveState: 'saving' })
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      const savedAt = this.now()
      const moduleDrafts: Record<string, ModuleDesignSpecification> = {}
      for (const design of this.state.moduleDesigns) moduleDrafts[design.module.moduleId] = design
      writePersisted(this.state.projectId, {
        schemaVersion: 1,
        selectedModuleId: this.state.selectedModuleId,
        canvasSelectedModuleId: this.state.canvasSelectedModuleId,
        queueFilter: this.state.queueFilter,
        focusMode: this.state.focusMode,
        listView: this.state.listView,
        moduleDrafts,
        sessions: this.state.sessions,
        savedAt,
      })
      this.patch({ saveState: 'saved', savedAt })
      this.emit()
    }, AUTOSAVE_DELAY_MS)
  }

  /**
   * `sample` mode: emit + schedule the local-storage autosave (§18.1).
   * `project` mode: emit only — there is no browser-local draft to persist;
   * every change already went through a bridge round trip that the service
   * itself persisted (§17.3 "write an audit event").
   */
  private commit(): void {
    this.emit()
    if (this.state.mode === 'sample') this.schedulePersist()
  }

  private checkContext(moduleId: string): ModuleDesignCheckContext {
    return {
      architecture: this.state.architecture,
      otherDesigns: this.state.moduleDesigns.filter((d) => d.module.moduleId !== moduleId),
      approvedContracts: this.state.approvedContracts,
    }
  }

  // ---------------------------------------------------------------------
  // Project setup — repository root, session principal, project roles
  // (§4, §17.3, §20.2, §25.3 — second-review P1: "nothing configures the
  // repository adapter or project roles"). `project` mode only; every
  // method here is a no-op outside `project` mode. `adapter:*` operations
  // never appear in `getValidNextActions` (they are adapter-owned, not
  // §17.2 change operations), so this store never gates them behind a
  // service-reported enabled flag the way primaryAction does.
  // ---------------------------------------------------------------------

  /** Loads (or reloads) the repository-root and principal state shown by `ProjectSetupPanel`. Safe to call repeatedly (e.g. on every panel mount). */
  async loadProjectSetup(): Promise<void> {
    if (!this.isProjectMode()) return
    const client = this.requireBridge()
    this.patch({ repositoryConfig: { status: 'loading' }, principal: { status: 'loading' }, rolesGrant: { status: 'loading' } })
    this.emit()
    const [repositoryConfig, principal, rolesGrant] = await Promise.all([
      this.readRepositoryConfig(client),
      this.readPrincipal(client),
      this.readProjectRoles(client),
    ])
    this.patch({ repositoryConfig, principal, rolesGrant })
    this.emit()
  }

  private async readRepositoryConfig(client: DesignBridgeClient): Promise<RepositoryConfigState> {
    try {
      const response = await client.read<AdapterConfigurationResponse>('adapter:getProjectRepository', [{ projectId: client.projectId }])
      if (response.ok) return { status: 'configured', repositoryRoot: response.repositoryRoot }
      return { status: 'not-configured', message: response.diagnostics[0]?.message ?? 'No repository is configured for this project yet.' }
    } catch (error) {
      return { status: 'error', message: error instanceof Error ? error.message : String(error) }
    }
  }

  private async readPrincipal(client: DesignBridgeClient): Promise<PrincipalState> {
    try {
      // `adapter:getPrincipal` takes no args — the principal is the
      // dispatcher's own OS-derived identity, not scoped to a project.
      const response = await client.read<AdapterPrincipalResponse>('adapter:getPrincipal', [])
      if (isUnknownOperationResponse(response)) {
        return { status: 'unavailable', message: 'Principal display requires a newer desktop build.' }
      }
      if (response.ok) return { status: 'ready', principal: response.principal }
      return { status: 'error', message: response.diagnostics[0]?.message ?? 'Could not read the session principal.' }
    } catch (error) {
      return { status: 'error', message: error instanceof Error ? error.message : String(error) }
    }
  }

  private async readProjectRoles(client: DesignBridgeClient): Promise<RolesGrantState> {
    try {
      const response = await client.read<AdapterProjectRolesResponse>('adapter:getProjectRoles', [{ projectId: client.projectId }])
      if (isUnknownOperationResponse(response)) {
        return { status: 'unavailable', message: 'Project-role status requires a newer desktop build.' }
      }
      if (response.ok) {
        return { status: 'granted', principal: response.principal, authorities: response.authorities }
      }
      const notConfigured = response.diagnostics.some((diagnostic) => diagnostic.code === AUTHORITY_NOT_CONFIGURED_CODE)
      return notConfigured
        ? { status: 'idle' }
        : { status: 'error', message: response.diagnostics[0]?.message ?? 'Could not read project roles.' }
    } catch (error) {
      return { status: 'error', message: error instanceof Error ? error.message : String(error) }
    }
  }

  async openProjectSource(ref: string): Promise<void> {
    if (!this.isProjectMode()) {
      this.patch({ sourcePreview: { status: 'error', ref, message: 'Bundled showcase sources are descriptive fixtures and do not resolve to project files.' } })
      this.emit()
      return
    }
    const client = this.requireBridge()
    this.patch({ sourcePreview: { status: 'loading' } })
    this.emit()
    try {
      const response = await client.read<AdapterProjectSourceResponse>('adapter:getProjectSource', [{ projectId: client.projectId, ref }])
      if (response.ok) {
        this.patch({
          sourcePreview: {
            status: 'ready',
            ref: response.ref,
            fileName: response.fileName,
            mediaType: response.mediaType,
            sha256: response.sha256,
            bytes: response.bytes,
            content: response.content,
            truncated: response.truncated,
          },
        })
      } else {
        this.patch({ sourcePreview: { status: 'error', ref, message: response.diagnostics[0]?.message ?? 'Could not open source.' } })
      }
    } catch (error) {
      this.patch({ sourcePreview: { status: 'error', ref, message: error instanceof Error ? error.message : String(error) } })
    }
    this.emit()
  }

  async checkProjectSource(ref: string): Promise<{ ok: boolean; message?: string }> {
    if (!this.isProjectMode()) return { ok: false, message: 'Select a desktop project before checking a source.' }
    const client = this.requireBridge()
    try {
      const response = await client.read<AdapterProjectSourceResponse>('adapter:getProjectSource', [{ projectId: client.projectId, ref }])
      return response.ok ? { ok: true } : { ok: false, message: response.diagnostics[0]?.message ?? 'Could not read source.' }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  closeProjectSource(): void {
    this.patch({ sourcePreview: { status: 'idle' } })
    this.emit()
  }

  async loadProjectConnections(): Promise<void> {
    if (!this.isProjectMode()) return
    const client = this.requireBridge()
    const results = await Promise.all(this.state.progress.modules.map(async (entry) => {
      try {
        return await client.read<AdapterConnectionStateResponse>('adapter:getConnectionState', [{
          projectId: client.projectId,
          moduleId: entry.moduleId,
        }])
      } catch {
        return undefined
      }
    }))
    const connections = { ...this.state.connections }
    for (const response of results) {
      if (!response?.ok || (!response.binding && !response.verification)) continue
      const verification = response.verification as { verificationStatus?: string } | undefined
      connections[response.moduleId] = {
        status: verification?.verificationStatus === 'pass' ? 'verified' : response.binding ? 'configured' : 'failed',
        configuration: response.binding,
        verification: response.verification,
        ...(verification && verification.verificationStatus !== 'pass' ? { message: 'The last connection verification did not pass.' } : {}),
      }
    }
    this.patch({ connections })
    this.emit()
  }

  /** `ProjectSetupPanel`'s "Configure repository root" form. */
  async configureRepositoryRoot(repositoryRoot: string): Promise<AdapterConfigurationResponse> {
    if (!this.isProjectMode()) throw new Error('configureRepositoryRoot is only available in project mode')
    const client = this.requireBridge()
    this.patch({ repositoryConfig: { status: 'loading' } })
    this.emit()
    try {
      const response = await client.change<AdapterConfigurationResponse>('adapter:configureProjectRepository', { projectId: client.projectId, repositoryRoot })
      this.patch({
        repositoryConfig: response.ok
          ? { status: 'configured', repositoryRoot: response.repositoryRoot }
          : { status: 'error', message: response.diagnostics[0]?.message ?? 'Could not configure the repository root.' },
        announcement: response.ok ? `Configured the repository root: ${response.repositoryRoot}.` : `Could not configure the repository root: ${response.diagnostics[0]?.message ?? 'see diagnostics'}.`,
      })
      this.emit()
      return response
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.patch({ repositoryConfig: { status: 'error', message } })
      this.emit()
      throw error
    }
  }

  /**
   * `ProjectSetupPanel`'s "Grant design authorities to this session user"
   * action. Requests every §4 authority (`ALL_DESIGN_AUTHORITIES`) for the
   * current principal — loads the principal first if it has not been read
   * yet, then sends both `grantee` and `authorities` explicitly (rather
   * than relying on `adapter:configureProjectRoles`'s own "defaults to the
   * stamped principal / all authorities" server-side default) so the
   * action's effect always matches its label exactly. The response
   * (`{ ok, auditEventId }`) does not echo what was granted, so the granted
   * `principal`/`authorities` shown afterward are what this call requested,
   * not a server echo. Gracefully reports `'unavailable'` on an
   * `EUC16-UNKNOWN-OPERATION` response — a defensive fallback for an older
   * desktop build (§17.3, `designBridgeClient.ts`).
   */
  async grantDesignAuthoritiesToSessionUser(): Promise<RolesGrantState> {
    if (!this.isProjectMode()) throw new Error('grantDesignAuthoritiesToSessionUser is only available in project mode')
    const client = this.requireBridge()
    let principalState = this.state.principal
    if (principalState.status !== 'ready') {
      principalState = await this.readPrincipal(client)
      this.patch({ principal: principalState })
      this.emit()
    }
    if (principalState.status !== 'ready') {
      const result: RolesGrantState = { status: 'error', message: 'The session principal is not available yet; cannot grant authorities to an unknown user.' }
      this.patch({ rolesGrant: result })
      this.emit()
      return result
    }
    const grantee = principalState.principal
    const authorities = [...ALL_DESIGN_AUTHORITIES]
    this.patch({ rolesGrant: { status: 'loading' } })
    this.emit()
    try {
      const response = await client.change<AdapterRolesResponse>('adapter:configureProjectRoles', { projectId: client.projectId, grantee, authorities })
      let result: RolesGrantState
      if (isUnknownOperationResponse(response)) {
        result = { status: 'unavailable', message: 'Granting authorities requires a newer desktop build.' }
      } else if (response.ok) {
        result = { status: 'granted', principal: grantee, authorities }
      } else {
        result = { status: 'error', message: response.diagnostics[0]?.message ?? 'Could not grant design authorities.' }
      }
      this.patch({
        rolesGrant: result,
        announcement:
          result.status === 'granted'
            ? `Granted ${result.authorities.length} design authorit${result.authorities.length === 1 ? 'y' : 'ies'} to ${result.principal}.`
            : result.message,
      })
      this.emit()
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const result: RolesGrantState = { status: 'error', message }
      this.patch({ rolesGrant: result })
      this.emit()
      return result
    }
  }

  // ---------------------------------------------------------------------
  // Verify (`project` mode) — §14.4, §17.1. `getScenarioCoverage` returns
  // the same `VerifySummary` shape `buildVerifySummary` computes locally
  // for `sample` mode (`packages/core` `verificationPlanner.ts`), so
  // `DesignVerifyView` renders both from one shared summary shape.
  // `getVerificationEvidence` is called for the summary's first failed run
  // so the failure detail can refresh independently. The full canonical run
  // list also arrives in `getWorkflowStatus` for Verify and Evidence.
  // ---------------------------------------------------------------------

  async loadProjectVerification(): Promise<void> {
    if (!this.isProjectMode()) return
    const client = this.requireBridge()
    const request = ++this.projectVerificationRequest
    this.patch({ projectVerification: { status: 'loading' } })
    this.emit()
    try {
      const summary = await client.read<VerifySummary | undefined>('getScenarioCoverage', [client.projectId])
      let evidence: ScenarioRun | undefined
      if (summary?.firstFailedStep) {
        evidence = await client.read<ScenarioRun | undefined>('getVerificationEvidence', [client.projectId, summary.firstFailedStep.runId])
      }
      if (request !== this.projectVerificationRequest) return
      this.patch({ projectVerification: { status: 'ready', summary, evidence } })
    } catch (error) {
      if (request !== this.projectVerificationRequest) return
      this.patch({ projectVerification: { status: 'error', message: error instanceof Error ? error.message : String(error) } })
    }
    this.emit()
  }

  // ---------------------------------------------------------------------
  // Selection, filters, canvas view state
  // ---------------------------------------------------------------------

  selectModule(moduleId: string): void {
    if (this.state.selectedModuleId === moduleId) return
    this.patch({ selectedModuleId: moduleId })
    this.commit()
    if (this.isProjectMode() && !this.getDesign(moduleId)) void this.loadModuleDesign(moduleId)
  }

  /** §9.2 default-selection rule 1: a canvas selection opens that module. */
  selectFromCanvas(moduleId: string): void {
    this.patch({ canvasSelectedModuleId: moduleId, selectedModuleId: moduleId })
    this.commit()
    if (this.isProjectMode() && !this.getDesign(moduleId)) void this.loadModuleDesign(moduleId)
  }

  setQueueFilter(filter: ModuleQueueFilter): void {
    this.patch({ queueFilter: filter })
    this.commit()
  }

  setFocusMode(focusMode: boolean): void {
    this.patch({ focusMode })
    this.commit()
  }

  setListView(listView: boolean): void {
    this.patch({ listView })
    this.commit()
  }

  filteredModules(): ModuleDesignProgressEntry[] {
    return filterModuleQueue(this.state.progress, this.state.queueFilter)
  }

  // ---------------------------------------------------------------------
  // Plan and system-design lifecycle (§6.1, §7, §8)
  // ---------------------------------------------------------------------

  /** Creates the canonical use-case analysis through the same operation used by the machine API. */
  createUseCaseAnalysis(input: {
    workDescription: string
    examples?: string[]
    prohibitedResults?: string[]
    sources?: { name: string; ref: string; required: boolean; status?: 'ok' | 'failed'; failureCause?: string }[]
  }): void {
    if (!this.isProjectMode()) {
      this.announce('The bundled sample is read-only. Select a project to create a use-case analysis.')
      this.emit()
      return
    }
    const client = this.requireBridge()
    this.pendingOperation = this.runChangeOperation<UseCaseAnalysis>(
      'createUseCaseDraft',
      {
        projectId: client.projectId,
        workDescription: input.workDescription,
        examples: input.examples ?? [],
        prohibitedResults: input.prohibitedResults ?? [],
        sources: input.sources ?? [],
        expectedBaseRevision: this.state.useCaseAnalysis.revision || undefined,
      },
      (analysis) => this.patch({ useCaseAnalysis: analysis }),
    ).catch(() => undefined)
  }

  /** Reviews one actor, rule, quality need, or acceptance check in the canonical analysis. */
  updateUseCaseAnalysisItem(itemId: string, action: 'accept' | 'correct' | 'reject', text?: string): void {
    if (!this.isProjectMode()) return
    const client = this.requireBridge()
    this.pendingOperation = this.runChangeOperation<UseCaseAnalysis>(
      'updateUseCaseItem',
      {
        projectId: client.projectId,
        expectedBaseRevision: this.state.useCaseAnalysis.revision,
        target: { kind: 'item', itemId, action, ...(text === undefined ? {} : { text }) },
      },
      (analysis) => this.patch({ useCaseAnalysis: analysis }),
    ).catch(() => undefined)
  }

  updateUseCaseContent(target: UseCaseContentTarget): void {
    if (!this.isProjectMode()) return
    const client = this.requireBridge()
    this.pendingOperation = this.runChangeOperation<UseCaseAnalysis>(
      'updateUseCaseItem',
      {
        projectId: client.projectId,
        expectedBaseRevision: this.state.useCaseAnalysis.revision,
        target,
      },
      (analysis) => this.patch({ useCaseAnalysis: analysis }),
    ).catch(() => undefined)
  }

  /** Answers a material Plan question; approval stays blocked until the service accepts the answer. */
  answerUseCaseQuestion(questionId: string, answer: string): void {
    if (!this.isProjectMode() || !answer.trim()) return
    const client = this.requireBridge()
    this.pendingOperation = this.runChangeOperation<UseCaseAnalysis>(
      'updateUseCaseItem',
      {
        projectId: client.projectId,
        expectedBaseRevision: this.state.useCaseAnalysis.revision,
        target: { kind: 'question', questionId, answer },
      },
      (analysis) => this.patch({ useCaseAnalysis: analysis }),
    ).catch(() => undefined)
  }

  /** Approves the analysis and compiles it to the application specification in one service transaction. */
  approveUseCaseAnalysis(): void {
    if (!this.isProjectMode()) return
    const client = this.requireBridge()
    this.pendingOperation = this.runChangeOperation<{ analysis: UseCaseAnalysis }>(
      'approveUseCaseAnalysis',
      {
        projectId: client.projectId,
        authority: 'product-lead',
        expectedBaseRevision: this.state.useCaseAnalysis.revision,
      },
      (value) => this.patch({ useCaseAnalysis: value.analysis }),
    ).catch(() => undefined)
  }

  reviseUseCaseAnalysis(): void {
    if (!this.isProjectMode() || this.state.useCaseAnalysis.status !== 'approved') return
    const client = this.requireBridge()
    this.pendingOperation = this.runChangeOperation<UseCaseAnalysis>(
      'reopenUseCaseAnalysis',
      {
        projectId: client.projectId,
        expectedBaseRevision: this.state.useCaseAnalysis.revision,
        expectedBaseHash: this.state.useCaseAnalysis.contentHash,
      },
      (analysis) => this.patch({ useCaseAnalysis: analysis }),
    ).catch(() => undefined)
  }

  /** Creates a system-structure draft from the approved, compiled application record. */
  createSystemStructure(options: {
    primaryModuleId?: string
    primaryModuleName?: string
    primaryModuleType?: 'experience' | 'workflow' | 'domain' | 'connection' | 'platform'
    primaryDeployableId?: string
  } = {}): void {
    if (!this.isProjectMode()) return
    const client = this.requireBridge()
    this.pendingOperation = this.runChangeOperation<SystemStructureSpecification>(
      'createSystemDesignDraft',
      { projectId: client.projectId, ...options },
      (architecture) => this.patch({ architecture }),
    ).catch(() => undefined)
  }

  applySystemDesignDecision(decision: Record<string, unknown>): void {
    if (!this.isProjectMode() || !this.state.architecture.revision) return
    const client = this.requireBridge()
    this.pendingOperation = this.runChangeOperation<SystemStructureSpecification>(
      'applySystemDesignDecision',
      {
        projectId: client.projectId,
        expectedBaseRevision: this.state.architecture.revision,
        expectedBaseHash: this.state.architecture.contentHash,
        decision,
      },
      (architecture) => this.patch({ architecture }),
    ).catch(() => undefined)
  }

  /** Freezes the current system structure before module design begins. */
  approveSystemStructure(): void {
    if (!this.isProjectMode() || !this.state.architecture.revision) return
    const client = this.requireBridge()
    this.pendingOperation = this.runChangeOperation<SystemStructureSpecification>(
      'approveSystemStructure',
      {
        projectId: client.projectId,
        authority: 'software-architect',
        expectedBaseRevision: this.state.architecture.revision,
      },
      (architecture) => this.patch({ architecture }),
    ).catch(() => undefined)
  }

  // ---------------------------------------------------------------------
  // Connect and scenario execution (§13, §14)
  // ---------------------------------------------------------------------

  private patchConnection(moduleId: string, state: WorkflowConnectionState): void {
    this.patch({ connections: { ...this.state.connections, [moduleId]: state } })
  }

  /** Validates and persists a real inbound binding through the desktop executor. */
  configureConnection(moduleId: string, bindingConfig: unknown): void {
    if (!this.isProjectMode()) return
    const client = this.requireBridge()
    this.patchConnection(moduleId, { status: 'configuring' })
    this.emit()
    this.pendingOperation = this.runChangeOperation<unknown>(
      'configureBinding',
      { projectId: client.projectId, moduleId, bindingConfig },
      (configuration) => this.patchConnection(moduleId, { status: 'configured', configuration }),
    ).then(async (result) => {
      if (!result.ok) {
        this.patchConnection(moduleId, { status: 'failed', message: result.diagnostics[0]?.message ?? 'Binding configuration failed.' })
        this.emit()
      } else {
        await this.loadProjectConnections()
      }
    }).catch((error) => {
      this.patchConnection(moduleId, { status: 'failed', message: error instanceof Error ? error.message : String(error) })
      this.emit()
    })
  }

  /** Launches the configured entry point and records real connection evidence. */
  verifyConnection(moduleId: string, bindingConfig?: unknown): void {
    if (!this.isProjectMode()) return
    const client = this.requireBridge()
    const current = this.state.connections[moduleId]
    this.patchConnection(moduleId, { ...current, status: 'verifying' })
    this.emit()
    this.pendingOperation = this.runChangeOperation<unknown>(
      'verifyConnection',
      { projectId: client.projectId, moduleId, ...(bindingConfig === undefined ? {} : { bindingConfig }) },
      (verification) => this.patchConnection(moduleId, { ...this.state.connections[moduleId], status: 'verified', verification }),
    ).then(async (result) => {
      if (!result.ok) {
        this.patchConnection(moduleId, { ...this.state.connections[moduleId], status: 'failed', message: result.diagnostics[0]?.message ?? 'Connection verification failed.' })
        this.emit()
      } else {
        await this.loadProjectConnections()
      }
    }).catch((error) => {
      this.patchConnection(moduleId, { ...this.state.connections[moduleId], status: 'failed', message: error instanceof Error ? error.message : String(error) })
      this.emit()
    })
  }

  /** Runs one approved scenario with the configured production executor and caches its immutable evidence. */
  runScenario(scenarioId: string): void {
    if (!this.isProjectMode()) return
    this.pendingOperation = this.runScenarioInternal(scenarioId).catch(() => undefined)
  }

  private async runScenarioInternal(scenarioId: string): Promise<boolean> {
    const client = this.requireBridge()
    const verifiedConnection = Object.values(this.state.connections)
      .find((connection) => connection.status === 'verified' && connection.verification !== undefined)
    const verification = verifiedConnection?.verification && typeof verifiedConnection.verification === 'object'
      ? verifiedConnection.verification as Record<string, unknown>
      : undefined
    const connectionRevision =
      typeof verification?.verificationId === 'string'
        ? verification.verificationId
        : verification?.hashes && typeof verification.hashes === 'object'
          && typeof (verification.hashes as Record<string, unknown>).binding === 'string'
          ? (verification.hashes as Record<string, string>).binding
          : ''
    this.patch({
      scenarioActions: {
        ...this.state.scenarioActions,
        [scenarioId]: { status: 'running', message: 'Running the current scenario…' },
      },
    })
    this.emit()
    try {
      const result = await this.runChangeOperation<ScenarioRun>(
        'runScenario',
        {
          projectId: client.projectId,
          scenarioId,
          identity: {
            ...this.executionIdentity,
            connectionRevision,
          },
        },
        (run) => {
          const withoutEarlierCopy = this.state.scenarioRuns.filter((candidate) => candidate.runId !== run.runId)
          this.patch({ scenarioRuns: [...withoutEarlierCopy, run], projectVerification: { status: 'idle' } })
        },
      )
      const run = result.value
      this.patch({
        scenarioActions: {
          ...this.state.scenarioActions,
          [scenarioId]: result.ok
            ? { status: 'idle', runId: run?.runId, message: 'Run completed.' }
            : { status: 'error', runId: run?.runId, message: result.diagnostics[0]?.message ?? 'The scenario did not pass.' },
        },
      })
      this.emit()
      return result.ok
    } catch (error) {
      this.patch({
        scenarioActions: {
          ...this.state.scenarioActions,
          [scenarioId]: { status: 'error', message: error instanceof Error ? error.message : String(error) },
        },
      })
      this.emit()
      return false
    }
  }

  async runAllCurrentScenarios(): Promise<void> {
    if (!this.isProjectMode()) return
    for (const entry of this.state.scenarioTestPlan.entries) {
      await this.runScenarioInternal(entry.scenarioId)
    }
  }

  /** Approves one exact scenario-run revision through the verification authority gate. */
  approveScenarioRun(runId: string): void {
    if (!this.isProjectMode()) return
    const client = this.requireBridge()
    const run = this.state.scenarioRuns.find((candidate) => candidate.runId === runId)
    const scenarioId = run?.scenarioId ?? runId
    this.patch({
      scenarioActions: {
        ...this.state.scenarioActions,
        [scenarioId]: { status: 'approving', runId, message: 'Approving this exact run…' },
      },
    })
    this.emit()
    this.pendingOperation = this.runChangeOperation<{ runId: string }>(
      'approveVerification',
      { projectId: client.projectId, runId, authority: 'verification-lead' },
    ).then((result) => {
      this.patch({
        scenarioActions: {
          ...this.state.scenarioActions,
          [scenarioId]: result.ok
            ? { status: 'approved', runId, message: 'Approved and linked to its immutable evidence.' }
            : { status: 'error', runId, message: result.diagnostics[0]?.message ?? 'Approval failed.' },
        },
        ...(result.ok
          ? {
              verificationApprovals: {
                ...this.state.verificationApprovals,
                [runId]: { approvedAt: this.now(), approvalRef: `${runId}@verified` },
              },
            }
          : {}),
      })
      this.emit()
    }).catch((error) => {
      this.patch({
        scenarioActions: {
          ...this.state.scenarioActions,
          [scenarioId]: { status: 'error', runId, message: error instanceof Error ? error.message : String(error) },
        },
      })
      this.emit()
    })
  }

  // ---------------------------------------------------------------------
  // Module-design session lifecycle (§9.3, §9.9, §9.10)
  // ---------------------------------------------------------------------

  getDesign(moduleId: string): ModuleDesignSpecification | undefined {
    return this.state.moduleDesigns.find((d) => d.module.moduleId === moduleId)
  }

  getSession(moduleId: string): ModuleDesignSession | undefined {
    return this.state.sessions[moduleId]
  }

  /** Live (non-persisted) check evaluation used to compute the primary action and the Checks step content. */
  evaluateChecks(moduleId: string): ModuleDesignCheckEvaluation | undefined {
    const design = this.getDesign(moduleId)
    if (!design) return undefined
    return evaluateModuleDesignChecks(design, this.checkContext(moduleId))
  }

  private ensureSession(moduleId: string, design: ModuleDesignSpecification): ModuleDesignSession {
    const existing = this.state.sessions[moduleId]
    if (existing) return existing
    const session = materializeSession(this.state.projectId, this.state.architecture.revision, design, this.now())
    this.touchSession(session)
    return session
  }

  /** §9.4 — creates a module draft from the approved system structure. */
  ensureDraft(moduleId: string): ModuleDesignSpecification | undefined {
    const existing = this.getDesign(moduleId)
    if (existing) {
      this.ensureSession(moduleId, existing)
      return existing
    }
    if (this.isProjectMode()) {
      this.pendingOperation = this.ensureDraftProject(moduleId).catch(() => undefined)
      return undefined
    }
    const draft = createModuleDesignDraft({
      projectId: this.state.projectId,
      architecture: this.state.architecture,
      moduleId,
    })
    this.touchDesign(draft)
    this.ensureSession(moduleId, draft)
    this.recomputeProgress()
    this.announce(`Created a module draft for ${draft.module.name}.`)
    this.commit()
    return draft
  }

  /** `project` mode: `getModuleDesign` (in case a draft already exists server-side) then, only if none exists, `startModuleDesign` (§17.2). */
  private async ensureDraftProject(moduleId: string): Promise<void> {
    const client = this.requireBridge()
    const existing = await client.read<ModuleDesignSpecification | undefined>('getModuleDesign', [client.projectId, moduleId])
    if (existing) {
      this.applyDesignRecord(existing)
      this.emit()
      return
    }
    await this.runChangeOperation<{ design: ModuleDesignSpecification; session: ModuleDesignSession }>(
      'startModuleDesign',
      { projectId: client.projectId, moduleId },
      ({ design, session }) => {
        this.applyDesignRecord(design)
        this.touchSession(session)
      },
    )
  }

  /** §9.3 — open a completed or current step without losing later draft data. */
  goToStep(moduleId: string, step: ModuleDesignStep): void {
    const session = this.state.sessions[moduleId]
    if (!session) return
    const result = coreGoToStep(session, step, this.now())
    if (!result.ok) {
      this.announce(result.diagnostics[0]?.message ?? 'That step is not open yet.')
      this.emit()
      return
    }
    this.touchSession(result.session)
    this.commit()
  }

  /** Marks the current (or given) step complete and advances to the next one. */
  completeStep(moduleId: string, step?: ModuleDesignStep): void {
    const session = this.state.sessions[moduleId]
    if (!session) return
    const target = step ?? session.currentStep
    const updated = coreCompleteStep(session, target, this.now())
    this.touchSession(updated)
    this.recomputeProgress()
    this.commit()
  }

  /** Resolves one required (material) question and re-runs checks. */
  answerRequiredQuestion(moduleId: string, itemId: string, answerText: string): void {
    const design = this.getDesign(moduleId)
    if (!design) return
    if (this.isProjectMode()) {
      const session = this.state.sessions[moduleId]
      const client = this.requireBridge()
      this.pendingOperation = this.runChangeOperation<{ design: ModuleDesignSpecification; session: ModuleDesignSession }>(
        'answerModuleDesignQuestion',
        { projectId: client.projectId, moduleId, questionId: itemId, step: session?.currentStep ?? 'behavior', text: answerText, expectedBaseRevision: design.revision },
        ({ design: updated, session: updatedSession }) => {
          this.applyDesignRecord(updated)
          this.touchSession(updatedSession)
        },
      ).catch(() => undefined)
      return
    }
    const now = this.now()
    const unresolvedItems = design.unresolvedItems.map((item) => (item.id === itemId ? { ...item, resolvedAt: now } : item))
    const updated = { ...design, unresolvedItems }
    const { design: checked } = applyModuleDesignChecks(updated, this.checkContext(moduleId))
    this.touchDesign(checked)
    const session = this.state.sessions[moduleId]
    if (session) {
      this.touchSession(answerSessionQuestion(session, { questionId: itemId, step: session.currentStep, text: answerText, answeredAt: now }))
    }
    this.recomputeProgress()
    this.announce(`Answered a required question for ${design.module.name}.`)
    this.commit()
  }

  /** §9.9 — "Run module checks" (Appendix C label). */
  runChecks(moduleId: string): ModuleDesignCheckEvaluation | undefined {
    const design = this.getDesign(moduleId)
    if (!design) return undefined
    if (this.isProjectMode()) {
      const client = this.requireBridge()
      this.pendingOperation = this.runChangeOperation<{ design: ModuleDesignSpecification; evaluation: ModuleDesignCheckEvaluation }>(
        'analyzeModuleDesign',
        { projectId: client.projectId, moduleId, expectedBaseRevision: design.revision },
        ({ design: updated }) => this.applyDesignRecord(updated),
      ).catch(() => undefined)
      return undefined
    }
    const { design: checked, evaluation } = applyModuleDesignChecks(design, this.checkContext(moduleId))
    this.touchDesign(checked)
    const session = this.state.sessions[moduleId]
    if (session) this.touchSession(coreCompleteStep(session, 'checks', this.now()))
    this.recomputeProgress()
    this.announce(
      evaluation.passed
        ? `Module checks passed for ${design.module.name}.`
        : `Module checks found ${evaluation.blockerCount} blocking issue${evaluation.blockerCount === 1 ? '' : 's'} for ${design.module.name}.`,
    )
    this.commit()
    return evaluation
  }

  /** §9.10 — approval of one module never touches another module's record. */
  approveModule(moduleId: string, approvedBy = 'you'): { ok: boolean; diagnostics: readonly { message: string }[] } {
    const design = this.getDesign(moduleId)
    if (!design) return { ok: false, diagnostics: [] }
    if (this.isProjectMode()) {
      void approvedBy // `project` mode: `approvedBy` is the bridge actor (§20.2 "no approval shortcut"), never a caller-supplied name.
      const client = this.requireBridge()
      this.pendingOperation = this.runChangeOperation<ModuleDesignSpecification>(
        'approveModuleDesign',
        { projectId: client.projectId, moduleId, authority: 'module-owner', expectedBaseRevision: design.revision },
        (updated) => this.applyDesignRecord(updated),
      ).catch(() => undefined)
      return { ok: false, diagnostics: [{ message: 'Approval submitted to the service; see the module status once it responds.' }] }
    }
    const result = approveModuleDesign(design, { approvedBy, authority: 'module-owner', approvedAt: this.now() }, this.checkContext(moduleId))
    if (result.ok) {
      this.touchDesign(result.design)
      this.patch({ approvedModuleDesigns: { ...this.state.approvedModuleDesigns, [moduleId]: result.design } })
      const session = this.state.sessions[moduleId]
      if (session) this.touchSession(coreCompleteStep(session, 'approval', this.now()))
      this.recomputeProgress()
      this.announce(`${design.module.name} approved. ${this.state.progress.approved} of ${this.state.progress.total} module designs approved.`)
    } else {
      this.announce(`${design.module.name} could not be approved: ${result.diagnostics[0]?.message ?? 'design checks failed'}.`)
    }
    this.commit()
    return result
  }

  /** The real one-module implementation handoff (§11.2, §11.3, §6.2). */
  createCopilotHandoff(moduleId: string): void {
    this.createModuleHandoff(moduleId)
  }

  /** Creates the complete Design baseline through the same service operation used by machine clients. */
  createDesignBaseline(): void {
    if (!this.isProjectMode()) {
      this.announce('The bundled sample already includes an approved Design baseline.')
      this.emit()
      return
    }
    const client = this.requireBridge()
    this.pendingOperation = this.runChangeOperation<DesignBaseline>(
      'createDesignBaseline',
      { projectId: client.projectId },
    ).catch(() => undefined)
  }

  /** Explicit human approval for the current Design baseline (§4, §6.2). */
  approveDesignBaseline(): void {
    if (!this.isProjectMode()) {
      this.announce('The bundled sample already includes an approved Design baseline.')
      this.emit()
      return
    }
    const client = this.requireBridge()
    const baseline = this.state.designBaseline
    this.pendingOperation = this.runChangeOperation<DesignBaseline>(
      'approveDesignBaseline',
      {
        projectId: client.projectId,
        authority: 'software-architect',
        ...(baseline.revision ? { expectedBaseRevision: baseline.revision } : {}),
      },
    ).catch(() => undefined)
  }

  /**
   * `project` mode: the workspace's one action for this module, taken
   * verbatim from the service's own `getValidNextActions` (§17.3) — never
   * computed locally. Falls back to a step-navigation label (no service
   * action targets this module — e.g. mid-edit on a `draft`) using the same
   * pure `sessionPrimaryAction` projection `sample` mode uses, since the
   * session step itself is not a canonical record (see file header).
   */
  private validNextActionFor(moduleId: string): ValidNextAction | undefined {
    return this.state.validNextActions.find((action) => action.targetId === moduleId)
  }

  /** The single primary-action label for the session (§9.3, §18.1), without side effects. */
  primaryActionLabel(moduleId: string): string {
    const design = this.getDesign(moduleId)
    const session = this.state.sessions[moduleId]
    if (this.isProjectMode()) {
      const action = this.validNextActionFor(moduleId)
      // `updateModuleDesignItem` is the service's intentionally generic
      // signal that the draft remains editable. The session's current step
      // provides the useful, specific action a person can actually take.
      if (action?.operation === 'updateModuleDesignItem' && design && session) {
        // Before the first authoritative check there are no recorded gates;
        // present "Run design checks", not a speculative local "Fix …"
        // result. Once a gate exists its diagnostics can guide remediation.
        return sessionPrimaryAction(session, design, design.gates.length ? this.evaluateChecks(moduleId) : undefined)
      }
      if (action) return action.label
      if (!design || !session) return 'Create module draft'
      return sessionPrimaryAction(session, design, this.evaluateChecks(moduleId))
    }
    if (!design || !session) return 'Create module draft'
    return sessionPrimaryAction(session, design, this.evaluateChecks(moduleId))
  }

  /**
   * Dispatches the single primary action. `project` mode: only dispatches a
   * bridge change when the matching `getValidNextActions` entry says
   * `enabled: true` — an explicit server-computed decision, never a local
   * approval/gate re-check (§17.3 "return valid next actions").
   */
  primaryAction(moduleId: string): void {
    const design = this.getDesign(moduleId)
    if (this.isProjectMode()) {
      const action = this.validNextActionFor(moduleId)
      if (action) {
        if (!action.enabled) {
          this.announce(action.blockedReason ?? `${action.label} is not available yet.`)
          return
        }
        switch (action.operation) {
          case 'startModuleDesign':
            this.ensureDraft(moduleId)
            return
          case 'updateModuleDesignItem': {
            if (!design) return
            const session = this.ensureSession(moduleId, design)
            const label = sessionPrimaryAction(session, design, design.gates.length ? this.evaluateChecks(moduleId) : undefined)
            if (label === 'Run design checks') {
              this.runChecks(moduleId)
            } else if (label.startsWith('Answer')) {
              this.goToStep(moduleId, 'behavior')
            } else if (label.startsWith('Fix')) {
              this.goToStep(moduleId, 'checks')
            } else {
              this.completeStep(moduleId)
            }
            return
          }
          case 'approveModuleDesign':
            this.approveModule(moduleId)
            return
          case 'createModuleImplementationPacket':
            this.createModuleHandoff(moduleId)
            return
          default:
            // answerModuleDesignQuestion / reopenModuleDesign — no single
            // bridge call corresponds to "the" action; direct the user to
            // the step that handles it instead of guessing an edit.
            this.announce(action.label)
            return
        }
      }
      if (!design) {
        this.ensureDraft(moduleId)
      }
      return
    }
    if (!design) {
      this.ensureDraft(moduleId)
      return
    }
    const session = this.ensureSession(moduleId, design)
    const checks = this.evaluateChecks(moduleId)
    const label = sessionPrimaryAction(session, design, checks)
    if (label.startsWith('Create module draft')) {
      this.ensureDraft(moduleId)
    } else if (label.startsWith('Answer')) {
      this.goToStep(moduleId, 'behavior')
    } else if (label === 'Review contracts') {
      this.goToStep(moduleId, 'contracts')
      this.completeStep(moduleId, 'contracts')
    } else if (label.startsWith('Fix')) {
      this.goToStep(moduleId, 'checks')
    } else if (label === 'Run design checks') {
      this.runChecks(moduleId)
    } else if (label === 'Approve module') {
      this.approveModule(moduleId)
    } else if (label === 'Create implementation handoff') {
      this.createCopilotHandoff(moduleId)
    } else {
      this.completeStep(moduleId)
    }
  }

  // ---------------------------------------------------------------------
  // Diagram discussion / propose-change (§9.8, §15, §10)
  // ---------------------------------------------------------------------

  /** Appends one bridge-returned discussion entry to the local cache — a pure presentation cache, never an authoritative record (the service already persisted `entry` via `workspace.saveDiagramDiscussionEntry`). */
  private appendDiagramDiscussionEntry(elementId: string, entry: DiagramDiscussionEntry): void {
    const existing = this.state.diagramDiscussions[elementId] ?? []
    this.patch({ diagramDiscussions: { ...this.state.diagramDiscussions, [elementId]: [...existing, entry] } })
  }

  /**
   * `project` mode: `proposeVisualChange` then, on success, `analyzeVisualChange`
   * (§17.2) — the same two-step service split sample mode's single local call
   * (`analyzeDesignChange` + two synthesized entries) combines into one user
   * action. Both calls' returned records (`DiagramDiscussionEntry`,
   * `DesignImpactRecord`) are cached and rendered verbatim; the local
   * "impact analysis" discussion entry below is a non-authoritative
   * presentation link to that verbatim `DesignImpactRecord` (the service
   * records its own `impactAnalysis` entry but `analyzeVisualChange` returns
   * only the impact record, not that entry, so `DiagramDetailModal`'s
   * existing "find the impact via the discussion history" lookup has
   * something bridge-derived to find) — never a fabricated approval or
   * check outcome.
   */
  private async proposeDiagramChangeProject(design: ModuleDesignSpecification, target: DiagramElementTarget, description: string): Promise<void> {
    const client = this.requireBridge()
    const proposeResult = await this.runChangeOperation<DiagramDiscussionEntry>('proposeVisualChange', {
      projectId: client.projectId,
      diagramId: target.diagramId,
      elementId: target.elementId,
      description,
    })
    if (!proposeResult.ok || !proposeResult.value) return
    this.appendDiagramDiscussionEntry(target.elementId, proposeResult.value)

    const changeKind: DesignChangeKind = target.isRenameable ? 'rename' : 'labelOnly'
    const analyzeResult = await this.runChangeOperation<DesignImpactRecord>('analyzeVisualChange', {
      projectId: client.projectId,
      diagramId: target.diagramId,
      elementId: target.elementId,
      changeKind,
      initiatingRecordId: design.id,
      initiatingRevision: design.revision,
      description,
    })
    if (!analyzeResult.ok || !analyzeResult.value) return
    const impact = analyzeResult.value
    this.patch({ diagramImpacts: { ...this.state.diagramImpacts, [impact.impactId]: impact } })
    const now = this.now()
    this.appendDiagramDiscussionEntry(target.elementId, {
      id: childId(target.diagramId, 'discussion', `${target.elementId}.${now}.impact`),
      elementId: target.elementId,
      diagramId: target.diagramId,
      author: 'system',
      kind: 'impactAnalysis',
      text: `Impact analysis: ${impact.items.length} affected item${impact.items.length === 1 ? '' : 's'}.`,
      impactRecordId: impact.impactId,
      at: now,
    })
    this.emit()
  }

  /** Impact analysis runs BEFORE any record change — this method never mutates `design` (§9.8, §10). */
  proposeDiagramChange(moduleId: string, target: DiagramElementTarget, description: string): DesignImpactRecord | undefined {
    const design = this.getDesign(moduleId)
    if (!design || !description.trim()) return undefined
    if (this.isProjectMode()) {
      this.pendingOperation = this.proposeDiagramChangeProject(design, target, description).catch(() => undefined)
      return undefined
    }
    const now = this.now()

    const world: ImpactWorld = {
      useCaseAnalysis: this.state.useCaseAnalysis,
      architecture: this.state.architecture,
      moduleDesigns: this.state.moduleDesigns,
      contracts: this.state.contractRegistry.contracts.map((c) => ({ operationId: c.operationId, version: c.version, providerModuleId: c.providerModuleId })),
      diagrams: design.diagrams,
      scenarioRuns: this.state.scenarioRuns,
    }
    const changeKind: DesignChangeKind = target.isRenameable ? 'rename' : 'labelOnly'
    const impact = analyzeDesignChange({
      projectId: this.state.projectId,
      changeKind,
      initiatingRecordId: design.id,
      initiatingRevision: design.revision,
      description,
      world,
      createdAt: now,
    })

    const proposalEntry: DiagramDiscussionEntry = {
      id: childId(target.diagramId, 'discussion', `${target.elementId}.${now}.proposed`),
      elementId: target.elementId,
      diagramId: target.diagramId,
      author: 'you',
      kind: 'proposedChange',
      text: description,
      at: now,
    }
    const impactEntry: DiagramDiscussionEntry = {
      id: childId(target.diagramId, 'discussion', `${target.elementId}.${now}.impact`),
      elementId: target.elementId,
      diagramId: target.diagramId,
      author: 'system',
      kind: 'impactAnalysis',
      text: `Impact analysis: ${impact.items.length} affected item${impact.items.length === 1 ? '' : 's'}.`,
      impactRecordId: impact.impactId,
      at: now,
    }
    const existing = this.state.diagramDiscussions[target.elementId] ?? []
    this.patch({
      diagramDiscussions: { ...this.state.diagramDiscussions, [target.elementId]: [...existing, proposalEntry, impactEntry] },
      diagramImpacts: { ...this.state.diagramImpacts, [impact.impactId]: impact },
    })
    this.announce(`Proposed a change to ${target.elementLabel}. Impact analysis found ${impact.items.length} affected item${impact.items.length === 1 ? '' : 's'}.`)
    this.commit()
    return impact
  }

  /**
   * `project` mode: `approveChangePlan` (§17.2) against the pending impact
   * record's id (found the same way sample mode finds it — the last
   * `impactAnalysis` discussion entry). `approvedBy` in the resulting
   * discussion entry is read from the service's own returned
   * `DesignImpactRecord.approval.approvedBy` (§20.2 "no approval shortcut",
   * second-review P1: never a caller-supplied or locally-invented name).
   */
  private async approveDiagramChangePlanProject(target: DiagramElementTarget): Promise<void> {
    const history = this.state.diagramDiscussions[target.elementId] ?? []
    const lastImpactEntry = [...history].reverse().find((entry) => entry.kind === 'impactAnalysis')
    if (!lastImpactEntry?.impactRecordId) {
      this.announce('Propose a change and run impact analysis before approving a change plan.')
      this.emit()
      return
    }
    const client = this.requireBridge()
    const result = await this.runChangeOperation<DesignImpactRecord>('approveChangePlan', {
      projectId: client.projectId,
      diagramId: target.diagramId,
      elementId: target.elementId,
      impactId: lastImpactEntry.impactRecordId,
      authority: 'module-owner',
    })
    if (!result.ok || !result.value) return
    const impact = result.value
    this.patch({ diagramImpacts: { ...this.state.diagramImpacts, [impact.impactId]: impact } })
    const now = this.now()
    this.appendDiagramDiscussionEntry(target.elementId, {
      id: childId(target.diagramId, 'discussion', `${target.elementId}.${now}.approved`),
      elementId: target.elementId,
      diagramId: target.diagramId,
      author: impact.approval?.approvedBy ?? 'unknown',
      kind: 'approvedChangePlan',
      text: 'Change plan approved.',
      impactRecordId: impact.impactId,
      at: now,
    })
    this.emit()
  }

  /** User action — records approval for the exact analyzed impact. Execution remains a separate action (§9.8, §9.11). */
  approveDiagramChangePlan(moduleId: string, target: DiagramElementTarget): void {
    const design = this.getDesign(moduleId)
    if (!design) return
    if (this.isProjectMode()) {
      this.pendingOperation = this.approveDiagramChangePlanProject(target).catch(() => undefined)
      return
    }
    const now = this.now()
    const history = this.state.diagramDiscussions[target.elementId] ?? []
    const lastImpactEntry = [...history].reverse().find((entry) => entry.kind === 'impactAnalysis')
    const impact = lastImpactEntry?.impactRecordId ? this.state.diagramImpacts[lastImpactEntry.impactRecordId] : undefined
    if (!impact || impact.approval) return
    const approvedImpact: DesignImpactRecord = {
      ...impact,
      approval: {
        approvedBy: 'you',
        authority: 'module-owner',
        approvedAt: now,
        recordId: impact.impactId,
        revision: impact.impactId,
        contentHash: impact.contentHash,
      },
    }

    const approvalEntry: DiagramDiscussionEntry = {
      id: childId(target.diagramId, 'discussion', `${target.elementId}.${now}.approved`),
      elementId: target.elementId,
      diagramId: target.diagramId,
      author: 'you',
      kind: 'approvedChangePlan',
      text: 'Change plan approved.',
      impactRecordId: lastImpactEntry?.impactRecordId,
      at: now,
    }
    this.patch({
      diagramDiscussions: { ...this.state.diagramDiscussions, [target.elementId]: [...history, approvalEntry] },
      diagramImpacts: { ...this.state.diagramImpacts, [impact.impactId]: approvedImpact },
    })
    this.announce(`Approved the change plan for ${target.elementLabel}.`)
    this.commit()
  }

  private async executeDiagramChangePlanProject(target: DiagramElementTarget): Promise<void> {
    const history = this.state.diagramDiscussions[target.elementId] ?? []
    const impactEntry = [...history].reverse().find((entry) => entry.impactRecordId)
    if (!impactEntry?.impactRecordId) return
    const client = this.requireBridge()
    const result = await this.runChangeOperation<{ impact: DesignImpactRecord; updatedDesign: ModuleDesignSpecification }>(
      'executeChangePlan',
      {
        projectId: client.projectId,
        diagramId: target.diagramId,
        elementId: target.elementId,
        impactId: impactEntry.impactRecordId,
      },
      (value) => {
        this.patch({ diagramImpacts: { ...this.state.diagramImpacts, [value.impact.impactId]: value.impact } })
        this.applyDesignRecord(value.updatedDesign)
      },
    )
    if (!result.ok || !result.value) return
    const now = this.now()
    this.appendDiagramDiscussionEntry(target.elementId, {
      id: childId(target.diagramId, 'discussion', `${target.elementId}.${now}.executed`),
      elementId: target.elementId,
      diagramId: target.diagramId,
      author: result.value.impact.execution?.executedBy ?? 'unknown',
      kind: 'executedChange',
      text: `Executed the approved change and regenerated ${result.value.impact.execution?.regeneratedProjectionIds.length ?? 0} projections.`,
      impactRecordId: result.value.impact.impactId,
      at: now,
    })
    this.emit()
  }

  executeDiagramChangePlan(moduleId: string, target: DiagramElementTarget): void {
    const design = this.getDesign(moduleId)
    if (!design) return
    if (this.isProjectMode()) {
      this.pendingOperation = this.executeDiagramChangePlanProject(target).catch(() => undefined)
      return
    }
    const history = this.state.diagramDiscussions[target.elementId] ?? []
    const lastImpactEntry = [...history].reverse().find((entry) => entry.impactRecordId)
    const lastProposal = [...history].reverse().find((entry) => entry.kind === 'proposedChange')
    const impact = lastImpactEntry?.impactRecordId ? this.state.diagramImpacts[lastImpactEntry.impactRecordId] : undefined
    if (!impact?.approval || impact.execution || !target.isRenameable || !lastProposal?.text) return
    const base = design.status === 'approved' ? reopenModuleDesign(design).draft : design
    const updated = updateModuleDesignItem(base, 'module.name', lastProposal.text)
    if (!updated.ok) return
    const now = this.now()
    const executedImpact: DesignImpactRecord = {
      ...impact,
      execution: {
        executedBy: 'you',
        executedAt: now,
        updatedRecordIds: [updated.design.id],
        regeneratedProjectionIds: updated.design.diagrams.map((diagram) => diagram.diagramId),
      },
    }
    const entry: DiagramDiscussionEntry = {
      id: childId(target.diagramId, 'discussion', `${target.elementId}.${now}.executed`),
      elementId: target.elementId,
      diagramId: target.diagramId,
      author: 'you',
      kind: 'executedChange',
      text: `Executed the approved change and regenerated ${updated.design.diagrams.length} projections.`,
      impactRecordId: impact.impactId,
      at: now,
    }
    this.touchDesign(updated.design)
    this.patch({
      diagramImpacts: { ...this.state.diagramImpacts, [impact.impactId]: executedImpact },
      diagramDiscussions: { ...this.state.diagramDiscussions, [target.elementId]: [...history, entry] },
    })
    this.recomputeProgress()
    this.announce(`Executed the approved change for ${target.elementLabel}.`)
    this.commit()
  }

  /**
   * `project` mode: `proposeVisualChange` (§17.2) — the closest matching
   * bridge operation, since the service exposes no separate freeform
   * "discussion" write; the returned `DiagramDiscussionEntry` (kind
   * `'proposedChange'`) is rendered verbatim exactly as the service
   * recorded it (`DISCUSSION_KIND_LABEL` in `DiagramDetailModal.tsx` labels
   * that kind "Proposed change" regardless of which UI action produced it).
   */
  private async addDiagramDiscussionProject(target: DiagramElementTarget, text: string): Promise<void> {
    const client = this.requireBridge()
    const result = await this.runChangeOperation<DiagramDiscussionEntry>('proposeVisualChange', {
      projectId: client.projectId,
      diagramId: target.diagramId,
      elementId: target.elementId,
      description: text,
    })
    if (result.ok && result.value) this.appendDiagramDiscussionEntry(target.elementId, result.value)
  }

  /** §9.8 `Discuss with agent`. */
  addDiagramDiscussion(moduleId: string, target: DiagramElementTarget, text: string): void {
    void moduleId
    if (!text.trim()) return
    if (this.isProjectMode()) {
      this.announce('Free-form agent discussion is not configured. Use Propose change for a controlled, impact-analyzed change request.')
      this.emit()
      return
    }
    const now = this.now()
    const entry: DiagramDiscussionEntry = {
      id: childId(target.diagramId, 'discussion', `${target.elementId}.${now}.discuss`),
      elementId: target.elementId,
      diagramId: target.diagramId,
      author: 'you',
      kind: 'discussion',
      text,
      at: now,
    }
    const existing = this.state.diagramDiscussions[target.elementId] ?? []
    this.patch({ diagramDiscussions: { ...this.state.diagramDiscussions, [target.elementId]: [...existing, entry] } })
    this.announce(`Sent a message to the agent about ${target.elementLabel}.`)
    this.commit()
  }

  getDiagramDiscussion(elementId: string): DiagramDiscussionEntry[] {
    return this.state.diagramDiscussions[elementId] ?? []
  }

  // ---------------------------------------------------------------------
  // Build / handoff (§11, §12, §3.5, §6.2)
  // ---------------------------------------------------------------------

  private designManifestCandidates(design: ModuleDesignSpecification) {
    const candidates: { kind: 'record' | 'contract'; ref: string; content: string; reason: string }[] = [
      {
        kind: 'record',
        ref: design.id,
        content: JSON.stringify({ id: design.id, revision: design.revision, module: design.module }),
        reason: 'Current module-design revision under handoff.',
      },
      {
        kind: 'record',
        ref: this.state.architecture.id,
        content: JSON.stringify({ id: this.state.architecture.id, revision: this.state.architecture.revision }),
        reason: 'Approved system-structure slice for this module.',
      },
    ]
    for (const depId of design.boundary.directDependencyIds) {
      candidates.push({ kind: 'record', ref: depId, content: JSON.stringify({ moduleId: depId }), reason: 'Direct dependency module summary.' })
    }
    for (const op of design.providedOperations) {
      candidates.push({ kind: 'contract', ref: `${op.operationId}@${op.version}`, content: JSON.stringify(op), reason: 'Provided operation contract reference.' })
    }
    for (const op of design.requiredOperations) {
      candidates.push({ kind: 'contract', ref: op.operationId, content: JSON.stringify(op), reason: 'Required operation contract reference.' })
    }
    return candidates
  }

  /** Deterministic context manifest for one module's handoff (§11.4). */
  buildDesignManifest(moduleId: string, limitBytes = 200_000): ContextManifest | undefined {
    const design = this.getDesign(moduleId)
    if (!design) return undefined
    return buildContextManifest({ targetRecordId: design.id, targetRevision: design.revision, limit: limitBytes, candidates: this.designManifestCandidates(design) })
  }

  /**
   * §6.2 Build gate for one module — verbatim blocking reasons. `sample`
   * mode only: `project` mode has no bridge preview for this (the service
   * evaluates the gate itself, inside `createModuleImplementationPacket`,
   * and returns its diagnostics verbatim from that one call — see
   * `createModuleHandoff`); this never re-derives an approximate answer
   * locally for a real project.
   */
  buildGateFor(moduleId: string): BuildGateResult {
    if (this.isProjectMode()) {
      return { ok: false, diagnostics: [{ code: 'CAP-DES-BUILD-GATE-PENDING', message: 'The build gate is evaluated by the service when you create the handoff.' }] }
    }
    const design = this.getDesign(moduleId)
    if (!design) {
      return { ok: false, diagnostics: [{ code: 'CAP-DES-BUILD-NO-DESIGN', message: 'No module design exists yet for this module.' }] }
    }
    const otherActiveModules = this.state.moduleDesigns
      .filter((d) => d.module.moduleId !== moduleId)
      .map((d) => ({ moduleId: d.module.moduleId, ownedPaths: d.boundary.ownedPaths }))
    const blockingImpactRecordIds = Object.values(this.state.diagramImpacts)
      .filter((impact) => impact.initiatingRecordId === design.id && !impact.approval)
      .map((impact) => impact.impactId)
    return evaluateBuildGate({
      policy: this.state.policy,
      baseline: this.state.designBaseline,
      moduleDesign: design,
      moduleProgress: {
        useCaseAnalysisApproved: this.state.useCaseAnalysis.status === 'approved',
        systemStructureApproved: this.state.architecture.status === 'approved',
      },
      contracts: this.state.contractRegistry.contracts,
      otherActiveModules,
      blockingImpactRecordIds: blockingImpactRecordIds.length ? blockingImpactRecordIds : undefined,
    })
  }

  private systemSliceFor(design: ModuleDesignSpecification): ModuleDesignPacket['systemSlice'] {
    const definitions = this.state.architecture.moduleDefinitions ?? []
    return {
      moduleSummaries: definitions.map((def) => ({ moduleId: def.moduleId, name: def.name, responsibility: def.responsibility })),
      dependencyEdges: this.state.architecture.dependencyEdges
        .filter((edge) => edge.fromModuleId === design.module.moduleId || edge.toModuleId === design.module.moduleId)
        .map((edge) => ({ fromModuleId: edge.fromModuleId, toModuleId: edge.toModuleId, reason: edge.reason })),
    }
  }

  /**
   * §11.2 / §11.3 / §6.2 — the real one-module Copilot handoff (default: exactly one module). A
   * draft or in-review design gets a design packet (never grants approval authority); an approved
   * design gets an implementation packet, gated by `evaluateBuildGate` — a blocked gate never
   * produces a packet, and its diagnostics are shown verbatim.
   */
  createModuleHandoff(moduleId: string, limitBytes = 200_000): ModuleHandoffResult {
    const design = this.getDesign(moduleId)
    const now = this.now()
    if (this.isProjectMode()) {
      const manifest = buildContextManifest({ targetRecordId: design?.id ?? moduleId, targetRevision: design?.revision ?? 'pending', limit: limitBytes, candidates: [] })
      if (!design || design.status !== 'approved') {
        const result: ModuleHandoffResult = {
          ok: false,
          kind: 'design',
          diagnostics: [{ code: 'CAP-DES-BUILD-NOT-APPROVED', message: 'This module design is not approved yet; approve it before creating an implementation handoff.' }],
          manifest,
          createdAt: now,
        }
        this.patch({ moduleHandoffs: { ...this.state.moduleHandoffs, [moduleId]: result } })
        this.commit()
        return result
      }
      this.pendingOperation = this.createModuleImplementationPacketProject(moduleId, design.revision).catch(() => undefined)
      const pending: ModuleHandoffResult = { ok: false, kind: 'implementation', diagnostics: [], manifest, createdAt: now }
      this.patch({ moduleHandoffs: { ...this.state.moduleHandoffs, [moduleId]: pending } })
      this.commit()
      return pending
    }
    if (!design) {
      const manifest = buildContextManifest({ targetRecordId: moduleId, targetRevision: 'none', limit: limitBytes, candidates: [] })
      const result: ModuleHandoffResult = {
        ok: false,
        kind: 'design',
        diagnostics: [{ code: 'CAP-DES-BUILD-NO-DESIGN', message: 'No module design exists yet for this module.' }],
        manifest,
        createdAt: now,
      }
      this.patch({ moduleHandoffs: { ...this.state.moduleHandoffs, [moduleId]: result } })
      this.announce(`Cannot create an implementation handoff: no module design exists yet for ${moduleId}.`)
      this.commit()
      return result
    }

    const manifest = buildContextManifest({ targetRecordId: design.id, targetRevision: design.revision, limit: limitBytes, candidates: this.designManifestCandidates(design) })
    const limitReport = contextLimitReport(manifest)

    let result: ModuleHandoffResult
    if (design.status !== 'approved') {
      const packetResult = buildModuleDesignPacket({
        projectId: this.state.projectId,
        moduleId,
        moduleType: design.module.moduleType,
        architectureRevision: this.state.architecture.revision,
        architectureHash: this.state.architecture.contentHash,
        systemSlice: this.systemSliceFor(design),
        useCaseIds: design.trace.useCaseIds,
        scenarioStepIds: design.trace.scenarioStepIds,
        contextManifest: manifest,
        idempotencyKey: `${design.revision}.${now}`,
        createdAt: now,
      })
      result = { ok: packetResult.ok, kind: 'design', packet: packetResult.packet, diagnostics: packetResult.diagnostics, manifest, limitReport, createdAt: now }
    } else {
      const gate = this.buildGateFor(moduleId)
      if (!gate.ok) {
        result = { ok: false, kind: 'implementation', diagnostics: gate.diagnostics, gate, manifest, limitReport, createdAt: now }
      } else {
        const packetResult = buildModuleImplementationPacket({
          projectId: this.state.projectId,
          design,
          contractRegistry: this.state.contractRegistry,
          architectureRevision: this.state.architecture.revision,
          architectureHash: this.state.architecture.contentHash,
          contextManifest: manifest,
          implementationSteps: [
            `Implement ${design.module.name} per the approved module design.`,
            'Add module tests for every acceptance case.',
            'Wire the module into its deployable.',
          ],
          acceptanceCases: design.verification.acceptanceCases,
          testCommands: design.verification.configuredCommands,
          requiredEvidence: design.verification.requiredEvidence,
          idempotencyKey: `${design.revision}.${now}`,
          passKind: 'initial',
          createdAt: now,
        })
        result = { ok: packetResult.ok, kind: 'implementation', packet: packetResult.packet, diagnostics: packetResult.diagnostics, gate, manifest, limitReport, createdAt: now }
        if (packetResult.ok && packetResult.packet) {
          const flow = this.deltaFlowFor(moduleId)
          this.patch({ deltaFlows: { ...this.state.deltaFlows, [moduleId]: { ...flow, packet: packetResult.packet } } })
        }
      }
    }

    this.patch({ moduleHandoffs: { ...this.state.moduleHandoffs, [moduleId]: result } })
    this.announce(
      result.ok
        ? `Created ${result.kind === 'implementation' ? 'an implementation handoff' : 'a design handoff'} for ${design.module.name}.`
        : `Implementation handoff blocked for ${design.module.name}: ${result.diagnostics[0]?.message ?? 'see diagnostics'}.`,
    )
    this.commit()
    return result
  }

  /** `project` mode: one `createModuleImplementationPacket` call (§17.2), used by both the initial handoff and §11.7 continuations. */
  private async createModuleImplementationPacketProject(
    moduleId: string,
    expectedBaseRevision: string,
    extra?: { passKind?: ModuleImplementationPacket['passKind']; previousPacketId?: string },
  ): Promise<void> {
    const client = this.requireBridge()
    const result = await this.runChangeOperation<ModuleImplementationPacket>(
      'createModuleImplementationPacket',
      { projectId: client.projectId, moduleId, expectedBaseRevision, ...extra },
      (packet) => {
        const manifest = packet.contextManifest
        const limitReport = contextLimitReport(manifest)
        const handoff: ModuleHandoffResult = { ok: true, kind: 'implementation', packet, diagnostics: [], manifest, limitReport, createdAt: this.now() }
        this.patch({
          moduleHandoffs: { ...this.state.moduleHandoffs, [moduleId]: handoff },
          deltaFlows: { ...this.state.deltaFlows, [moduleId]: { ...this.deltaFlowFor(moduleId), packet } },
        })
      },
    )
    if (!result.ok) {
      const design = this.getDesign(moduleId)
      const manifest = buildContextManifest({ targetRecordId: design?.id ?? moduleId, targetRevision: design?.revision ?? 'pending', limit: 200_000, candidates: [] })
      const handoff: ModuleHandoffResult = { ok: false, kind: 'implementation', diagnostics: result.diagnostics, manifest, createdAt: this.now() }
      this.patch({ moduleHandoffs: { ...this.state.moduleHandoffs, [moduleId]: handoff } })
      this.emit()
    }
  }

  /** §11.7 multi-pass continuation — creates a new implementation packet referencing the previous one. */
  continueModuleHandoff(moduleId: string, passKind: ModuleImplementationPacket['passKind'], limitBytes = 200_000): ModuleHandoffResult | undefined {
    const design = this.getDesign(moduleId)
    const priorHandoff = this.state.moduleHandoffs[moduleId]
    if (!design || !priorHandoff || priorHandoff.kind !== 'implementation' || !priorHandoff.packet) return undefined
    if (this.isProjectMode()) {
      const previousPacketId = (priorHandoff.packet as ModuleImplementationPacket).packetId
      this.pendingOperation = this.createModuleImplementationPacketProject(moduleId, design.revision, { passKind, previousPacketId }).catch(() => undefined)
      return undefined
    }
    const previous = priorHandoff.packet as ModuleImplementationPacket
    const now = this.now()
    const manifest = buildContextManifest({ targetRecordId: design.id, targetRevision: design.revision, limit: limitBytes, candidates: this.designManifestCandidates(design) })
    const limitReport = contextLimitReport(manifest)
    const continuation = multiPassContinuation(previous, design.revision, passKind)
    const packetResult = buildModuleImplementationPacket({
      projectId: this.state.projectId,
      design,
      contractRegistry: this.state.contractRegistry,
      architectureRevision: this.state.architecture.revision,
      architectureHash: this.state.architecture.contentHash,
      contextManifest: manifest,
      implementationSteps: [`Continue implementing ${design.module.name} (${passKind}).`],
      acceptanceCases: design.verification.acceptanceCases,
      testCommands: design.verification.configuredCommands,
      requiredEvidence: design.verification.requiredEvidence,
      idempotencyKey: `${design.revision}.${now}.${passKind}`,
      createdAt: now,
      ...continuation,
    })
    const result: ModuleHandoffResult = { ok: packetResult.ok, kind: 'implementation', packet: packetResult.packet, diagnostics: packetResult.diagnostics, manifest, limitReport, createdAt: now }
    this.patch({ moduleHandoffs: { ...this.state.moduleHandoffs, [moduleId]: result } })
    this.announce(
      result.ok ? `Created a ${passKind} continuation packet for ${design.module.name}.` : `Continuation packet blocked: ${result.diagnostics[0]?.message ?? 'see diagnostics'}.`,
    )
    this.commit()
    return result
  }

  /**
   * §3.3 — explicit multi-module handoff; any violation returns diagnostics
   * and no packets. `confirmations` must come from real, rendered checkbox
   * state (`WavesView`'s "I confirm these modules are independent" and
   * per-module "Fixtures and external resources are isolated" — review
   * finding #2): an unchecked box means `false` reaches
   * `buildMultiModulePacket` exactly as `false`, which its own runtime check
   * rejects with a diagnostic — this method never substitutes `true` for a
   * confirmation the user did not actually give.
   */
  createMultiModuleHandoff(moduleIds: string[], confirmations: MultiModuleConfirmations, limitBytes = 200_000): BuildMultiModulePacketResult {
    if (this.isProjectMode()) {
      // No bridge operation exists yet for a combined multi-module handoff
      // (§17.2 lists no such operation) — this never falls back to a local
      // packet build against a real project (§17, review finding #1).
      const result: BuildMultiModulePacketResult = {
        ok: false,
        diagnostics: [{ code: 'CAP-DES-PKT-MULTI-UNAVAILABLE', message: 'Multi-module handoff is not available in project mode yet; use the single-module implementation handoff instead.' }],
      }
      this.patch({ multiModuleHandoff: { moduleIds, result } })
      this.commit()
      return result
    }
    const now = this.now()
    const designs = moduleIds.map((id) => this.getDesign(id)).filter((d): d is ModuleDesignSpecification => Boolean(d))
    const entries: MultiModulePacketEntry[] = designs.map((design) => ({
      design,
      packetInput: {
        design,
        contractRegistry: this.state.contractRegistry,
        architectureRevision: this.state.architecture.revision,
        architectureHash: this.state.architecture.contentHash,
        contextManifest: buildContextManifest({
          targetRecordId: design.id,
          targetRevision: design.revision,
          limit: limitBytes,
          candidates: this.designManifestCandidates(design),
        }),
        implementationSteps: [`Implement ${design.module.name} per the approved module design.`],
        acceptanceCases: design.verification.acceptanceCases,
        testCommands: design.verification.configuredCommands,
        requiredEvidence: design.verification.requiredEvidence,
        idempotencyKey: `multi.${design.module.moduleId}.${design.revision}.${now}`,
        passKind: 'initial' as const,
        createdAt: now,
      },
      // `buildMultiModulePacket` requires the literal `true`; only an
      // actually-checked box produces it, so an unchecked box is passed
      // through as the real `false` and rejected by the function's own
      // runtime check (not by this store deciding the outcome).
      fixtureIsolationConfirmed: (confirmations.fixtureIsolationConfirmedByModuleId[design.module.moduleId] === true) as unknown as true,
    }))

    const dependencyEdgeAmongSelected = this.state.architecture.dependencyEdges.some(
      (edge) => moduleIds.includes(edge.fromModuleId) && moduleIds.includes(edge.toModuleId),
    )
    const allFixturesConfirmed = designs.length > 0 && designs.every((design) => confirmations.fixtureIsolationConfirmedByModuleId[design.module.moduleId] === true)
    const result = buildMultiModulePacket({
      projectId: this.state.projectId,
      modules: entries,
      dependencyPlanMarksIndependent: !dependencyEdgeAmongSelected,
      fixturesIsolated: allFixturesConfirmed,
      explicitUserSelection: moduleIds.length > 0,
      receivingAgentSupportsCombinedTask: confirmations.receivingAgentSupportsCombinedTask,
      userConfirmedIndependence: confirmations.userConfirmedIndependence as unknown as true,
    })
    this.patch({ multiModuleHandoff: { moduleIds, result } })
    this.announce(
      result.ok
        ? `Created a multi-module handoff for ${moduleIds.length} modules.`
        : `Multi-module handoff blocked: ${result.diagnostics[0]?.message ?? 'see diagnostics'}.`,
    )
    this.commit()
    return result
  }

  // ---------------------------------------------------------------------
  // Returned-delta review (§11.5, §11.6, §12, §19)
  // ---------------------------------------------------------------------

  private deltaFlowFor(moduleId: string): DeltaFlowState {
    return this.state.deltaFlows[moduleId] ?? emptyDeltaFlow()
  }

  private patchDeltaFlow(moduleId: string, next: Partial<DeltaFlowState>): void {
    const current = this.deltaFlowFor(moduleId)
    this.patch({ deltaFlows: { ...this.state.deltaFlows, [moduleId]: { ...current, ...next } } })
  }

  getDeltaFlow(moduleId: string): DeltaFlowState {
    return this.deltaFlowFor(moduleId)
  }

  /** Paste-JSON import of a returned delta. JSON parsing is a local format check (not approval logic); the canonical import itself is one `importAgentDelta` bridge call in `project` mode. */
  importReturnedDeltaText(moduleId: string, rawJson: string, source: 'pasted' | 'file' | 'provider' = 'pasted'): { ok: boolean; error?: string } {
    let delta: ReturnedDelta
    try {
      delta = JSON.parse(rawJson) as ReturnedDelta
    } catch {
      this.patchDeltaFlow(moduleId, { importError: 'That is not valid JSON.' })
      this.commit()
      return { ok: false, error: 'That is not valid JSON.' }
    }
    if (this.isProjectMode()) {
      this.patchDeltaFlow(moduleId, { deltaSource: source, importError: undefined, inspection: undefined, approved: false, applyResult: undefined, rolledBack: false })
      this.commit()
      const client = this.requireBridge()
      this.pendingOperation = this.runChangeOperation<ReturnedDelta>(
        'importAgentDelta',
        { projectId: client.projectId, delta },
        (imported) => this.patchDeltaFlow(moduleId, { delta: imported }),
      ).catch(() => undefined)
      return { ok: true }
    }
    this.patchDeltaFlow(moduleId, { delta, deltaSource: source, importError: undefined, inspection: undefined, approved: false, applyResult: undefined, rolledBack: false })
    this.announce('Imported a returned delta.')
    this.commit()
    return { ok: true }
  }

  /** Sample-only demo button (`deterministicTestProvider`) — clearly labeled in the UI as a sample, never real implementation output; never available in `project` mode. */
  async importSampleReturnedDelta(moduleId: string): Promise<{ ok: boolean; error?: string }> {
    if (this.isProjectMode()) {
      const message = 'Sample delta import is only available in sample mode.'
      this.patchDeltaFlow(moduleId, { importError: message })
      this.commit()
      return { ok: false, error: message }
    }
    const handoff = this.state.moduleHandoffs[moduleId]
    const packet = this.deltaFlowFor(moduleId).packet ?? (handoff?.kind === 'implementation' ? (handoff.packet as ModuleImplementationPacket | undefined) : undefined)
    if (!packet) {
      this.patchDeltaFlow(moduleId, { importError: 'Create an implementation handoff first.' })
      this.commit()
      return { ok: false, error: 'Create an implementation handoff first.' }
    }
    const provider = deterministicTestProvider('gui-sample-demo')
    const response = await provider.requestImplementation(packet, {})
    if (!response.ok || !response.value) {
      this.patchDeltaFlow(moduleId, { importError: 'The sample provider returned no delta.' })
      this.commit()
      return { ok: false, error: 'The sample provider returned no delta.' }
    }
    this.patchDeltaFlow(moduleId, {
      delta: response.value,
      deltaSource: 'sample-demo',
      importError: undefined,
      inspection: undefined,
      approved: false,
      applyResult: undefined,
      rolledBack: false,
    })
    this.announce('Imported a sample deterministic-test-provider delta — this is a labeled sample, not real implementation output.')
    this.commit()
    return { ok: true }
  }

  /** §11.6 — the full inspection shown before approve/apply. */
  inspectReturnedDelta(moduleId: string): DeltaInspection | undefined {
    const flow = this.deltaFlowFor(moduleId)
    const design = this.getDesign(moduleId)
    if (!flow.delta) return undefined
    if (this.isProjectMode()) {
      const client = this.requireBridge()
      this.pendingOperation = this.runChangeOperation<DeltaInspection>(
        'inspectAgentDelta',
        { projectId: client.projectId, deltaId: flow.delta.deltaId },
        (inspection) => this.patchDeltaFlow(moduleId, { inspection, approved: false }),
      ).catch(() => undefined)
      return undefined
    }
    const now = this.now()
    const inspection = coreInspectDelta(
      flow.delta,
      flow.packet,
      { workspaceRevision: flow.packet?.moduleDesignRevision, workspaceHash: flow.packet?.moduleDesignHash },
      { now, moduleDesign: design, rollbackPointRef: `workspace-snapshot.pre-${moduleId}.${now}` },
    )
    this.patchDeltaFlow(moduleId, { inspection, approved: false })
    this.announce(inspection.accepted ? 'The returned delta passed inspection.' : `The returned delta was rejected: ${inspection.rejectionReasons.join(', ')}.`)
    this.commit()
    return inspection
  }

  /** User-only approval to apply (§4, §11.6). */
  approveReturnedDelta(moduleId: string, approvedBy = 'you'): { ok: boolean; diagnostics: CapDiagnostic[] } {
    const flow = this.deltaFlowFor(moduleId)
    if (!flow.inspection) return { ok: false, diagnostics: [{ code: 'CAP-DES-DELTA-NOT-INSPECTED', message: 'Inspect the delta before approving it.' }] }
    if (this.isProjectMode()) {
      void approvedBy // `project` mode: the bridge actor approves (§20.2), never a caller-supplied name.
      const client = this.requireBridge()
      const inspectionId = flow.inspection.inspectionId
      this.pendingOperation = this.runChangeOperation<{ inspectionId: string; deltaId: string }>(
        'approveAgentDelta',
        { projectId: client.projectId, inspectionId },
        () => this.patchDeltaFlow(moduleId, { approved: true }),
      ).catch(() => undefined)
      return { ok: false, diagnostics: [{ code: 'CAP-DES-DELTA-PENDING', message: 'Approval submitted to the service; see the delta flow status once it responds.' }] }
    }
    const result = approveDeltaToApply(flow.inspection, { approvedBy, currentWorkspaceRevision: flow.inspection.workspaceRevisionAtInspection })
    if (result.ok) {
      this.patchDeltaFlow(moduleId, { approved: true })
      this.announce('Approved the returned delta to apply.')
    } else {
      this.announce(`Could not approve the returned delta: ${result.diagnostics[0]?.message ?? 'see diagnostics'}.`)
    }
    this.commit()
    return result
  }

  /** §12.2 apply — simulated in the browser; a real filesystem apply is desktop-side. */
  applyReturnedDelta(moduleId: string): DeltaApplyResult | undefined {
    const flow = this.deltaFlowFor(moduleId)
    if (!flow.approved || !flow.inspection || !flow.delta) return undefined
    if (this.isProjectMode()) {
      const client = this.requireBridge()
      const inspectionId = flow.inspection.inspectionId
      this.pendingOperation = this.runChangeOperation<DeltaApplyResult>(
        'applyAgentDelta',
        { projectId: client.projectId, inspectionId },
        (applyResult) => this.patchDeltaFlow(moduleId, { applyResult, rolledBack: false }),
      ).catch(() => undefined)
      return undefined
    }
    const now = this.now()
    const plan = buildApplyPlan(flow.inspection, flow.delta, { planId: `plan.${moduleId}.${now}`, backupRef: `backup.${moduleId}.${now}` })
    const outcome = simulateApply(plan, flow.files, now)
    this.patchDeltaFlow(moduleId, { applyResult: outcome.result, filesBeforeApply: flow.files, files: outcome.files, rolledBack: false })
    this.announce(
      outcome.result.applied
        ? `Applied the returned delta (simulated in browser mode) for ${moduleId}.`
        : `Apply failed and rolled back: ${outcome.result.failure ?? 'see diagnostics'}.`,
    )
    this.commit()
    return outcome.result
  }

  /** Restores the pre-apply simulated file map (rollback demonstration). */
  rollbackReturnedDelta(moduleId: string): void {
    if (this.isProjectMode()) {
      // §12.2 "Transactional apply" — the service rolls back a failed
      // `applyAgentDelta` itself; there is no separate bridge operation for
      // an after-the-fact manual rollback of an already-applied delta, and
      // this never simulates one locally against a real project.
      this.announce('Manual rollback is not available in project mode; the service applies changes transactionally.')
      return
    }
    const flow = this.deltaFlowFor(moduleId)
    if (!flow.filesBeforeApply) return
    // Keep `applyResult` set after rollback: `BuildHandoffView` gates its
    // status/result region (including the "Rolled back." confirmation) on
    // `applyResult` being present, so clearing it here would silently drop
    // the rollback confirmation from the DOM and its aria-live region
    // (§18.4 status announcements must remain visible, not just fire once).
    this.patchDeltaFlow(moduleId, { files: flow.filesBeforeApply, filesBeforeApply: undefined, rolledBack: true })
    this.announce(`Rolled back the simulated apply for ${moduleId}.`)
    this.commit()
  }
}

let singleton: DesignStore | undefined

/** Module-level singleton used by the mounted app; tests should construct `new DesignStore(...)` directly. */
export function getDesignStore(): DesignStore {
  if (!singleton) singleton = new DesignStore()
  return singleton
}

/** Test-only: forces the next `getDesignStore()` call to build a fresh store. */
export function resetDesignStoreSingleton(): void {
  singleton = undefined
}

export function useDesignState(store: DesignStore): DesignState {
  return useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getState(),
    () => store.getState(),
  )
}
