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
} from '@engineering-ui-kit/core/design-browser'
import type { OperationContract } from '@engineering-ui-kit/core'

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

  /** Appendix C `Create Copilot handoff`. Handoff packet creation is a Build-phase concern (out of this packet's scope); this records only a visible confirmation. */
  createCopilotHandoff(moduleId: string): void {
    const design = this.getDesign(moduleId)
    this.announce(`Copilot handoff prepared for ${design?.module.name ?? moduleId}.`)
    this.commit()
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
