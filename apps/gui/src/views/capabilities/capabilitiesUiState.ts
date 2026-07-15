/**
 * Pure Guided-journey state derivation for Capabilities.
 *
 * This module derives the five-stage journey (Define → Architect → Build →
 * Connect → Verify) SOLELY from canonical persisted records. It never persists
 * projection/stepper state as capability truth (CAP-DEC-001/002): the Guided
 * stepper is a projection, exactly like Design mode, computed on every render.
 *
 * Keep this file free of React and of bridge access so it can be unit tested in
 * isolation and reused by both Guided and Design projections.
 */

import type {
  ArchitectureSpecification,
  CapabilityBindingRecord,
  CapabilityModuleRecord,
  ModuleManifest,
  ModuleType,
} from '@engineering-ui-kit/core'
import type { GuideTopicId } from '../../guides'

export type StageId = 'define' | 'architect' | 'build' | 'connect' | 'verify'

/**
 * complete       – prerequisite satisfied and this stage's own goal met.
 * current        – the first incomplete, unlocked stage: where work happens now.
 * available      – unlocked and not complete, but not the current focus.
 * locked         – a prerequisite is not yet satisfied; not navigable.
 * not-applicable – satisfied without work (e.g. Connect when no UI modules exist).
 */
export type StageState = 'complete' | 'current' | 'available' | 'locked' | 'not-applicable'

export type StageProgress = { done: number; total: number }

export type JourneyStage = {
  id: StageId
  label: string
  state: StageState
  /** One short plain-language sentence describing the stage's current status. */
  shortStatus: string
  /** When locked, the plain-language prerequisite the user must satisfy first. */
  prerequisiteReason?: string
  /** Progress for stages that count sub-items (Build, Verify). */
  progress?: StageProgress
  helpTopic: GuideTopicId
  /** The stage a "Continue to …" action should advance to, if any. */
  nextStageId?: StageId
  /** True when this stage counts as satisfied (complete or not-applicable). */
  satisfied: boolean
}

export type JourneyInput = {
  application: { draft?: unknown; approved?: unknown }
  architecture: { draft?: unknown; approved?: unknown }
  modules: CapabilityModuleRecord[]
  bindings: CapabilityBindingRecord[]
  connectDisposition?: 'connect-now' | 'no-ui' | 'deferred'
}

export type Journey = {
  stages: JourneyStage[]
  /** The stage the user should be working on: first incomplete, else the last stage. */
  firstIncompleteStageId: StageId
  /** True when every applicable stage is satisfied. */
  complete: boolean
}

export const STAGE_ORDER: StageId[] = ['define', 'architect', 'build', 'connect', 'verify']

export const STAGE_LABELS: Record<StageId, string> = {
  define: 'Plan',
  architect: 'Design',
  build: 'Build',
  connect: 'Connect',
  verify: 'Verify',
}

const STAGE_HELP: Record<StageId, GuideTopicId> = {
  define: 'capabilities-define',
  architect: 'capabilities-architect',
  build: 'capabilities-build',
  connect: 'capabilities-connect',
  verify: 'capabilities-verify',
}

/** Module types that require a frontend Connect stage. */
const UI_MODULE_TYPES: ReadonlySet<ModuleType> = new Set<ModuleType>(['experience', 'connection'])

function approvedManifests(modules: CapabilityModuleRecord[]): ModuleManifest[] {
  return modules.map((m) => m.approved).filter((m): m is ModuleManifest => Boolean(m))
}

function nextStageOf(id: StageId): StageId | undefined {
  const idx = STAGE_ORDER.indexOf(id)
  return idx >= 0 ? STAGE_ORDER[idx + 1] : undefined
}

/**
 * Derives the full Guided journey from canonical records. Pure and deterministic.
 */
export function deriveJourney(input: JourneyInput): Journey {
  const appApproved = Boolean(input.application.approved)
  const appDraft = Boolean(input.application.draft)
  const archApproved = Boolean(input.architecture.approved)
  const archDraft = Boolean(input.architecture.draft)

  const approvedArch = input.architecture.approved as ArchitectureSpecification | undefined
  const allocatedModuleIds = archApproved ? approvedArch?.moduleIds ?? [] : []
  const approved = approvedManifests(input.modules)
  const approvedById = new Map(approved.map((m) => [m.moduleId, m]))

  // ---- Build ----
  const buildTotal = allocatedModuleIds.length
  const buildDone = allocatedModuleIds.filter((id) => approvedById.has(id)).length
  const buildHasModules = buildTotal > 0
  const buildComplete = buildHasModules && buildDone === buildTotal

  // ---- Connect applicability ----
  const hasApprovedOperation = approved.some((m) => m.providedOperations.length > 0)
  const requiresConnect = approved.some((m) => UI_MODULE_TYPES.has(m.moduleType))
  const approvedBinding = input.bindings.some((b) => Boolean(b.approved))
  const connectUnlocked = buildComplete && hasApprovedOperation
  const connectSkipped = input.connectDisposition === 'no-ui' || input.connectDisposition === 'deferred'
  const connectComplete = connectUnlocked && (!requiresConnect || approvedBinding || connectSkipped)

  // ---- Verify ----
  const verifyReady = approved.filter((m) => {
    const rec = input.modules.find((r) => r.moduleId === m.moduleId)
    return rec?.freshness?.primaryState === 'ready'
  }).length
  const verifyTotal = approved.length
  // connectComplete is true when Connect is satisfied OR not-applicable (both imply Build
  // complete + an approved operation). A locked Connect leaves Verify locked too.
  const verifyUnlocked = connectComplete
  const verifyComplete = verifyUnlocked && verifyTotal > 0 && verifyReady === verifyTotal

  const stages: JourneyStage[] = []

  // Define
  stages.push({
    id: 'define',
    label: STAGE_LABELS.define,
    state: appApproved ? 'complete' : 'current',
    shortStatus: appApproved
      ? 'Application plan approved.'
      : appDraft
        ? 'Review the application plan.'
        : 'Understand the application.',
    helpTopic: STAGE_HELP.define,
    nextStageId: 'architect',
    satisfied: appApproved,
  })

  // Architect
  stages.push({
    id: 'architect',
    label: STAGE_LABELS.architect,
    state: !appApproved ? 'locked' : archApproved ? 'complete' : 'current',
    shortStatus: !appApproved
      ? 'Approve Plan first.'
      : archApproved
        ? 'Solution design approved.'
        : archDraft
          ? 'Review the solution design.'
          : 'Shape the solution.',
    prerequisiteReason: !appApproved ? 'Requires an approved application plan.' : undefined,
    helpTopic: STAGE_HELP.architect,
    nextStageId: 'build',
    satisfied: archApproved,
  })

  // Build
  const buildState: StageState = !archApproved
    ? 'locked'
    : buildComplete
      ? 'complete'
      : 'current'
  stages.push({
    id: 'build',
    label: STAGE_LABELS.build,
    state: buildState,
    shortStatus: !archApproved
      ? 'Approve Design first.'
      : !buildHasModules
        ? 'The architecture allocates no modules.'
        : buildComplete
          ? `All ${buildTotal} modules approved.`
          : `${buildDone} of ${buildTotal} approved.`,
    prerequisiteReason: !archApproved ? 'Requires an approved solution design.' : undefined,
    progress: archApproved && buildHasModules ? { done: buildDone, total: buildTotal } : undefined,
    helpTopic: STAGE_HELP.build,
    nextStageId: 'connect',
    satisfied: buildComplete,
  })

  // Connect
  const connectState: StageState = !connectUnlocked
    ? 'locked'
    : !requiresConnect || connectSkipped
      ? 'not-applicable'
      : connectComplete
        ? 'complete'
        : 'current'
  stages.push({
    id: 'connect',
    label: STAGE_LABELS.connect,
    state: connectState,
    shortStatus: !buildComplete
      ? 'Complete Build first.'
      : !hasApprovedOperation
        ? 'No approved operation to connect yet.'
        : !requiresConnect
          ? 'Not required.'
          : input.connectDisposition === 'no-ui'
            ? 'No UI connection required.'
            : input.connectDisposition === 'deferred'
              ? 'UI connection deferred.'
          : connectComplete
            ? 'Connection approved.'
            : 'Connect an element to a capability.',
    prerequisiteReason: !connectUnlocked
      ? 'Requires a completed Build with at least one approved operation.'
      : undefined,
    helpTopic: STAGE_HELP.connect,
    nextStageId: 'verify',
    satisfied: connectComplete || connectState === 'not-applicable',
  })

  // Verify
  const verifyState: StageState = !verifyUnlocked
    ? 'locked'
    : verifyComplete
      ? 'complete'
      : 'current'
  stages.push({
    id: 'verify',
    label: STAGE_LABELS.verify,
    state: verifyState,
    shortStatus: !verifyUnlocked
      ? 'Complete the earlier stages first.'
      : verifyTotal === 0
        ? 'No approved modules to verify.'
        : verifyComplete
          ? `All ${verifyTotal} modules ready.`
          : `${verifyReady} of ${verifyTotal} ready.`,
    prerequisiteReason: !verifyUnlocked
      ? 'Requires Build complete and Connect complete or not required.'
      : undefined,
    progress: verifyUnlocked && verifyTotal > 0 ? { done: verifyReady, total: verifyTotal } : undefined,
    helpTopic: STAGE_HELP.verify,
    nextStageId: undefined,
    satisfied: verifyComplete,
  })

  const firstIncomplete = stages.find((s) => !s.satisfied)
  const firstIncompleteStageId = firstIncomplete?.id ?? 'verify'
  const complete = stages.every((s) => s.satisfied)

  return { stages, firstIncompleteStageId, complete }
}

/** Look up a single stage descriptor by id. */
export function stageById(journey: Journey, id: StageId): JourneyStage {
  const stage = journey.stages.find((s) => s.id === id)
  if (!stage) throw new Error(`unknown stage ${id}`)
  return stage
}

/** Whether a stage may be viewed (navigable) in the Guided stepper. */
export function isStageNavigable(stage: JourneyStage): boolean {
  return stage.state !== 'locked'
}

/** The "Continue to …" target after a stage becomes complete, if the next stage exists. */
export function continueTarget(journey: Journey, from: StageId): JourneyStage | undefined {
  const next = nextStageOf(from)
  if (!next) return undefined
  return journey.stages.find((s) => s.id === next)
}
