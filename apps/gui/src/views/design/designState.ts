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
} from '@engineering-ui-kit/core/design-browser'
import type { OperationContract, CapDiagnostic } from '@engineering-ui-kit/core'

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

export type DeltaFlowState = {
  packet?: ModuleImplementationPacket
  delta?: ReturnedDelta
  deltaSource?: 'pasted' | 'sample-demo'
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

export type DesignState = {
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

export type DesignStoreOptions = {
  /** Deterministic clock for tests; defaults to `new Date().toISOString()`. */
  now?: () => string
  /** Overrides the default sample snapshot (tests only). */
  snapshot?: ReturnType<typeof loadDefaultSnapshot>
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

  constructor(options: DesignStoreOptions = {}) {
    this.now = options.now ?? (() => new Date().toISOString())
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

  private commit(): void {
    this.emit()
    this.schedulePersist()
  }

  private checkContext(moduleId: string): ModuleDesignCheckContext {
    return {
      architecture: this.state.architecture,
      otherDesigns: this.state.moduleDesigns.filter((d) => d.module.moduleId !== moduleId),
      approvedContracts: this.state.approvedContracts,
    }
  }

  // ---------------------------------------------------------------------
  // Selection, filters, canvas view state
  // ---------------------------------------------------------------------

  selectModule(moduleId: string): void {
    if (this.state.selectedModuleId === moduleId) return
    this.patch({ selectedModuleId: moduleId })
    this.commit()
  }

  /** §9.2 default-selection rule 1: a canvas selection opens that module. */
  selectFromCanvas(moduleId: string): void {
    this.patch({ canvasSelectedModuleId: moduleId, selectedModuleId: moduleId })
    this.commit()
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
  ensureDraft(moduleId: string): ModuleDesignSpecification {
    const existing = this.getDesign(moduleId)
    if (existing) {
      this.ensureSession(moduleId, existing)
      return existing
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

  /** Appendix C `Create Copilot handoff` — the real one-module Build handoff (§11.2, §11.3, §6.2). */
  createCopilotHandoff(moduleId: string): void {
    this.createModuleHandoff(moduleId)
  }

  /** The single primary-action label for the session (§9.3, §18.1), without side effects. */
  primaryActionLabel(moduleId: string): string {
    const design = this.getDesign(moduleId)
    const session = this.state.sessions[moduleId]
    if (!design || !session) return 'Create module draft'
    return sessionPrimaryAction(session, design, this.evaluateChecks(moduleId))
  }

  /** Dispatches the single primary action per `sessionPrimaryAction` (§9.3, §18.1). */
  primaryAction(moduleId: string): void {
    const design = this.getDesign(moduleId)
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
    } else if (label === 'Approve module') {
      this.approveModule(moduleId)
    } else if (label === 'Create Copilot handoff') {
      this.createCopilotHandoff(moduleId)
    } else {
      this.completeStep(moduleId)
    }
  }

  // ---------------------------------------------------------------------
  // Diagram discussion / propose-change (§9.8, §15, §10)
  // ---------------------------------------------------------------------

  /** Impact analysis runs BEFORE any record change — this method never mutates `design` (§9.8, §10). */
  proposeDiagramChange(moduleId: string, target: DiagramElementTarget, description: string): DesignImpactRecord | undefined {
    const design = this.getDesign(moduleId)
    if (!design || !description.trim()) return undefined
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

  /** User action — records approval and, for a renameable element, applies the approved rename to the underlying record so unaffected diagrams stay identical (§9.8, §9.11). */
  approveDiagramChangePlan(moduleId: string, target: DiagramElementTarget): void {
    const design = this.getDesign(moduleId)
    if (!design) return
    const now = this.now()
    const history = this.state.diagramDiscussions[target.elementId] ?? []
    const lastImpactEntry = [...history].reverse().find((entry) => entry.kind === 'impactAnalysis')
    const lastProposal = [...history].reverse().find((entry) => entry.kind === 'proposedChange')

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
    this.patch({ diagramDiscussions: { ...this.state.diagramDiscussions, [target.elementId]: [...history, approvalEntry] } })

    if (target.isRenameable && lastProposal?.text) {
      const base = design.status === 'approved' ? reopenModuleDesign(design).draft : design
      const updated = updateModuleDesignItem(base, 'module.name', lastProposal.text)
      if (updated.ok) {
        this.touchDesign(updated.design)
        this.recomputeProgress()
      }
    }
    this.announce(`Approved the change plan for ${target.elementLabel}.`)
    this.commit()
  }

  /** §9.8 `Discuss with agent`. */
  addDiagramDiscussion(moduleId: string, target: DiagramElementTarget, text: string): void {
    void moduleId
    if (!text.trim()) return
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

  /** §6.2 Build gate for one module — verbatim blocking reasons. */
  buildGateFor(moduleId: string): BuildGateResult {
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
      this.announce(`Cannot create a Copilot handoff: no module design exists yet for ${moduleId}.`)
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
        ? `Created a Copilot ${result.kind} handoff for ${design.module.name}.`
        : `Copilot handoff blocked for ${design.module.name}: ${result.diagnostics[0]?.message ?? 'see diagnostics'}.`,
    )
    this.commit()
    return result
  }

  /** §11.7 multi-pass continuation — creates a new implementation packet referencing the previous one. */
  continueModuleHandoff(moduleId: string, passKind: ModuleImplementationPacket['passKind'], limitBytes = 200_000): ModuleHandoffResult | undefined {
    const design = this.getDesign(moduleId)
    const priorHandoff = this.state.moduleHandoffs[moduleId]
    if (!design || !priorHandoff || priorHandoff.kind !== 'implementation' || !priorHandoff.packet) return undefined
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

  /** §3.3 — explicit multi-module handoff; any violation returns diagnostics and no packets. */
  createMultiModuleHandoff(moduleIds: string[], limitBytes = 200_000): BuildMultiModulePacketResult {
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
    }))

    const dependencyEdgeAmongSelected = this.state.architecture.dependencyEdges.some(
      (edge) => moduleIds.includes(edge.fromModuleId) && moduleIds.includes(edge.toModuleId),
    )
    const result = buildMultiModulePacket({
      projectId: this.state.projectId,
      modules: entries,
      dependencyPlanMarksIndependent: !dependencyEdgeAmongSelected,
      fixturesIsolated: true,
      explicitUserSelection: moduleIds.length > 0,
      receivingAgentSupportsCombinedTask: true,
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

  /** Paste-JSON import of a returned delta. */
  importReturnedDeltaText(moduleId: string, rawJson: string): { ok: boolean; error?: string } {
    try {
      const delta = JSON.parse(rawJson) as ReturnedDelta
      this.patchDeltaFlow(moduleId, { delta, deltaSource: 'pasted', importError: undefined, inspection: undefined, approved: false, applyResult: undefined, rolledBack: false })
      this.announce('Imported a returned delta.')
      this.commit()
      return { ok: true }
    } catch {
      this.patchDeltaFlow(moduleId, { importError: 'That is not valid JSON.' })
      this.commit()
      return { ok: false, error: 'That is not valid JSON.' }
    }
  }

  /** Sample-only demo button (`deterministicTestProvider`) — clearly labeled in the UI as a sample, never real Copilot output. */
  async importSampleReturnedDelta(moduleId: string): Promise<{ ok: boolean; error?: string }> {
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
    this.announce('Imported a sample deterministic-test-provider delta — this is a labeled sample, not real Copilot output.')
    this.commit()
    return { ok: true }
  }

  /** §11.6 — the full inspection shown before approve/apply. */
  inspectReturnedDelta(moduleId: string): DeltaInspection | undefined {
    const flow = this.deltaFlowFor(moduleId)
    const design = this.getDesign(moduleId)
    if (!flow.delta) return undefined
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
    const flow = this.deltaFlowFor(moduleId)
    if (!flow.filesBeforeApply) return
    this.patchDeltaFlow(moduleId, { files: flow.filesBeforeApply, filesBeforeApply: undefined, applyResult: undefined, rolledBack: true })
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
