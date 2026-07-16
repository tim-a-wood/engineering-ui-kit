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
  CapabilityIntegrationState,
  CapabilityBindingRecord,
  CapabilityModuleRecord,
  DeployableKind,
  ExposureLevel,
  ModuleManifest,
} from '@engineering-ui-kit/core'
import { evaluateConnectEntryPoints, type DeployableConnectStatus } from '@engineering-ui-kit/core'
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

/**
 * A deployable that may need a Connect inbound entry point (CAP-ERA-001 §5.1).
 * `kind: 'embedded-library'` deployables never require one.
 */
export type CapabilityDeployableRecord = {
  deployableId: string
  kind: DeployableKind
}

/**
 * A CAP-CONTRACT-028 `InboundBinding` projection used for Connect completeness.
 * Multiple records may share the same `deployableId`/`operationId` — the model
 * never deduplicates bindings targeting the same operation (§12.4).
 */
export type CapabilityInboundBindingRecord = {
  bindingId: string
  deployableId: string
  operationId?: string
  operationVersion?: string
  /** A binding counts toward completeness once reviewed/approved; drafts remain visible but not valid. */
  approved: boolean
  /** Omitted exposure is treated as `private` (§5.1/§15.2) — never silently escalated. */
  exposure?: ExposureLevel
}

export type JourneyInput = {
  application: { draft?: unknown; approved?: unknown }
  architecture: { draft?: unknown; approved?: unknown }
  modules: CapabilityModuleRecord[]
  /**
   * Legacy CAP-CONTRACT-013 `FrontendBinding` records. Retained for callers that have
   * not yet migrated to `inboundBindings`; no longer consulted for Connect completeness
   * (superseded by CAP-CONTRACT-028 `InboundBinding` via `inboundBindings`).
   */
  bindings: CapabilityBindingRecord[]
  /** Deployables the architecture allocates (§5.1) — drives Connect applicability/completeness. */
  deployables?: CapabilityDeployableRecord[]
  /** Inbound bindings (CAP-CONTRACT-028) targeting those deployables. */
  inboundBindings?: CapabilityInboundBindingRecord[]
  /**
   * A UX hint only: which host choices to foreground/hide and whether the user has
   * explicitly deferred configuring Connect. It never completes or skips Connect by
   * itself — Connect stays incomplete until every required deployable has a valid
   * inbound entry point (§5.4/§12.4).
   */
  connectDisposition?: 'connect-now' | 'no-ui' | 'deferred'
  /**
   * Persisted production generation/apply/verification lifecycle. When this
   * is supplied, approved interviews alone cannot complete Build and approved
   * bindings alone cannot complete Connect/Verify.
   */
  integration?: CapabilityIntegrationState
}

export type Journey = {
  stages: JourneyStage[]
  /** The stage the user should be working on: first incomplete, else the last stage. */
  firstIncompleteStageId: StageId
  /** True when every applicable stage is satisfied. */
  complete: boolean
  /**
   * Per-deployable Connect entry-point status (CAP-ERA-001 §5.1/§12.4). Surfaced
   * explicitly so a deferred/incomplete deployable and any exposure escalation
   * stay visible rather than being hidden by a coarse stage state.
   */
  connectEntryPoints: DeployableConnectStatus[]
  /** True when any inbound binding has been deliberately elevated beyond `private`. */
  anyExposureElevated: boolean
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
  const modulesApproved = buildHasModules && buildDone === buildTotal
  const integrationDeployables = input.integration?.deployables ?? []
  const hasProductionIntegration = input.integration !== undefined
  const currentGenerationApplied = !hasProductionIntegration || (
    integrationDeployables.length > 0
    && integrationDeployables.every((item) => Boolean(
      item.currentPlan
      && item.latestApply?.status === 'applied'
      && item.latestApply.planId === item.currentPlan.planId
      && item.latestApply.planHash === item.currentPlan.planHash
      && item.status === 'applied',
    ))
  )
  const currentCommandsPassed = !hasProductionIntegration || (
    integrationDeployables.length > 0
    && integrationDeployables.every((item) => Boolean(
      item.currentPlan
      && item.latestCommandRun?.status === 'passed'
      && item.latestCommandRun.planId === item.currentPlan.planId
      && item.latestCommandRun.planHash === item.currentPlan.planHash,
    ))
  )
  const buildComplete = modulesApproved && currentGenerationApplied && currentCommandsPassed

  // ---- Connect applicability (CAP-ERA-001 §5.1/§5.4/§12.4) ----
  // Driven by deployable entry points, not by UI module types: a deployable is
  // incomplete until it has a valid inbound binding unless Design classifies it
  // `embedded-library`. "No UI" only changes which host choices are foregrounded
  // (connectDisposition) — it never completes or skips Connect on its own.
  const hasApprovedOperation = approved.some((m) => m.providedOperations.length > 0)
  const deployables = input.deployables ?? []
  const inboundBindings = input.inboundBindings ?? []
  const entryPoints = evaluateConnectEntryPoints(
    deployables.map((d) => ({ deployableId: d.deployableId, kind: d.kind })),
    inboundBindings.map((b) => ({
      bindingId: b.bindingId,
      deployableId: b.deployableId,
      operationId: b.operationId,
      operationVersion: b.operationVersion,
      approved: b.approved,
      exposure: b.exposure,
    })),
  )
  const requiresConnect = entryPoints.requiredDeployableIds.length > 0
  // A user may defer Connect, but the affected deployable remains "Needs attention"
  // and can never be silently marked complete (§5.4/CAP-TEST-079).
  const connectDeferred = input.connectDisposition === 'deferred'
  const connectUnlocked = buildComplete && hasApprovedOperation
  const connectComplete = connectUnlocked && currentGenerationApplied
    && (!requiresConnect || (entryPoints.allRequiredSatisfied && !connectDeferred))

  // ---- Verify ----
  const requiredBindings = inboundBindings.filter((binding) => binding.approved)
  const passingBindingIds = new Set(
    integrationDeployables.flatMap((item) => item.connectionVerifications
      .filter((record) => item.currentConnectionVerificationIds.includes(record.verificationId)))
      .filter((record) => record.verificationStatus === 'pass' && !record.usedTestAdapter)
      .map((record) => record.bindingId),
  )
  const verifyReady = hasProductionIntegration
    ? requiredBindings.filter((binding) => passingBindingIds.has(binding.bindingId)).length
    : approved.filter((m) => {
        const rec = input.modules.find((r) => r.moduleId === m.moduleId)
        return rec?.freshness?.primaryState === 'ready'
      }).length
  const verifyTotal = hasProductionIntegration ? requiredBindings.length : approved.length
  // connectComplete is true when Connect is satisfied OR not-applicable (both imply Build
  // complete + an approved operation). A locked Connect leaves Verify locked too.
  const verifyUnlocked = connectComplete
  const verifyComplete = verifyUnlocked
    && (verifyTotal > 0 ? verifyReady === verifyTotal : hasProductionIntegration && currentGenerationApplied)

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
        : !modulesApproved
          ? `${buildDone} of ${buildTotal} approved.`
          : buildComplete
            ? hasProductionIntegration
              ? `All ${buildTotal} modules approved and deployable infrastructure built and tested.`
              : `All ${buildTotal} modules approved.`
            : integrationDeployables.length === 0
              ? 'Approve the deployable foundation before generating infrastructure.'
              : currentGenerationApplied
                ? 'Run the approved install, build, and test commands.'
                : 'Generate and apply the deployable infrastructure.',
    prerequisiteReason: !archApproved ? 'Requires an approved solution design.' : undefined,
    progress: archApproved && buildHasModules ? {
      done: buildDone + (hasProductionIntegration && currentGenerationApplied && currentCommandsPassed ? 1 : 0),
      total: buildTotal + (hasProductionIntegration ? 1 : 0),
    } : undefined,
    helpTopic: STAGE_HELP.build,
    nextStageId: 'connect',
    satisfied: buildComplete,
  })

  // Connect
  const connectState: StageState = !connectUnlocked
    ? 'locked'
    : !requiresConnect
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
          : connectComplete
            ? 'Connection approved.'
            : connectDeferred
              ? 'Connect is deferred and needs attention.'
              : input.connectDisposition === 'no-ui'
                ? 'Configure a headless entry point (HTTP, CLI, schedule, or embedded library).'
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

  return {
    stages,
    firstIncompleteStageId,
    complete,
    connectEntryPoints: entryPoints.deployables,
    anyExposureElevated: entryPoints.anyExposureElevated,
  }
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
