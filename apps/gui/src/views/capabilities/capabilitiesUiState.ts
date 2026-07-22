/**
 * Pure Guided-journey state derivation for Capabilities.
 *
 * This module derives the four-stage journey (Plan → Design → Build → Verify)
 * SOLELY from canonical persisted records. Entry-point configuration is an
 * ordered part of Build, before shared application setup is generated. It never persists
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
  FoundationPlan,
  ModuleManifest,
} from '@engineering-ui-kit/core'
import { evaluateConnectEntryPoints, type DeployableConnectStatus } from '@engineering-ui-kit/core/browser'
import type { GuideTopicId } from '../../guides'

export type StageId = 'define' | 'architect' | 'build' | 'verify'

/**
 * complete       – prerequisite satisfied and this stage's own goal met.
 * current        – the first incomplete, unlocked stage: where work happens now.
 * available      – unlocked and not complete, but not the current focus.
 * locked         – a prerequisite is not yet satisfied; not navigable.
 * not-applicable – satisfied without work.
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
 * A deployable that may need a Build entry point (CAP-ERA-001 §5.1).
 * `kind: 'embedded-library'` deployables never require one.
 */
export type CapabilityDeployableRecord = {
  deployableId: string
  kind: DeployableKind
}

/**
 * A CAP-CONTRACT-028 `InboundBinding` projection used for Build completeness.
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
  /**
   * The canonical application-structure decision that follows architecture approval.
   * Omitted by legacy callers; when supplied, Design is complete only when the
   * approved foundation was derived from the current approved architecture.
   */
  foundation?: { approved?: FoundationPlan }
  modules: CapabilityModuleRecord[]
  /**
   * Legacy CAP-CONTRACT-013 `FrontendBinding` records. Retained for callers that have
   * not yet migrated to `inboundBindings`; no longer consulted for Build completeness
   * (superseded by CAP-CONTRACT-028 `InboundBinding` via `inboundBindings`).
   */
  bindings: CapabilityBindingRecord[]
  /** Deployables the architecture allocates (§5.1) — drives entry-point applicability/completeness. */
  deployables?: CapabilityDeployableRecord[]
  /** Inbound bindings (CAP-CONTRACT-028) targeting those deployables. */
  inboundBindings?: CapabilityInboundBindingRecord[]
  /**
   * Legacy Connect-era UX hint. Retained so existing projects migrate without
   * losing a deferred/no-UI decision. It never completes Build by itself; each
   * required deployable still needs a valid approved entry point (§5.4/§12.4).
   */
  connectDisposition?: 'connect-now' | 'no-ui' | 'deferred'
  /**
   * Persisted production generation/apply/verification lifecycle. When this
   * is supplied, approved interviews alone cannot complete Build and approved
   * bindings alone cannot complete Build/Verify.
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
   * Per-deployable Build entry-point status (CAP-ERA-001 §5.1/§12.4). Surfaced
   * explicitly so a deferred/incomplete deployable and any exposure escalation
   * stay visible rather than being hidden by a coarse stage state.
   */
  entryPoints: DeployableConnectStatus[]
  /** @deprecated Compatibility alias for callers compiled against the former five-stage projection. */
  connectEntryPoints: DeployableConnectStatus[]
  /** True when any inbound binding has been deliberately elevated beyond `private`. */
  anyExposureElevated: boolean
}

export const STAGE_ORDER: StageId[] = ['define', 'architect', 'build', 'verify']

export const STAGE_LABELS: Record<StageId, string> = {
  define: 'Plan',
  architect: 'Design',
  build: 'Build',
  verify: 'Verify',
}

/** Redirect Connect-era deep links or persisted projection hints into Build. */
export function normalizeStageId(stage: string | undefined): StageId {
  if (stage === 'connect') return 'build'
  return STAGE_ORDER.includes(stage as StageId) ? stage as StageId : 'define'
}

/** Resolve legacy/current Capabilities deep-link shapes without persisting a second workflow state. */
export function stageFromCapabilitiesNavigation(locationText: string): StageId | undefined {
  if (!locationText.trim()) return undefined
  let decoded = locationText
  try { decoded = decodeURIComponent(locationText) } catch { /* retain the original hostile/malformed value */ }
  const direct = /(?:^|[?&#/])(?:capabilities-)?(?:stage|section)[=/:]([^&#/]+)/i.exec(decoded)?.[1]
  const pathStage = /(?:^|[/#])capabilities[/#:](define|plan|architect|design|build|connect|verify)(?:$|[/?&#])/i.exec(decoded)?.[1]
  const candidate = (direct ?? pathStage)?.toLowerCase()
  if (!candidate) return undefined
  if (candidate === 'connect' || candidate === 'connections') return 'build'
  if (candidate === 'plan') return 'define'
  if (candidate === 'design') return 'architect'
  return normalizeStageId(candidate)
}

const STAGE_HELP: Record<StageId, GuideTopicId> = {
  define: 'capabilities-define',
  architect: 'capabilities-architect',
  build: 'capabilities-build',
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
  const foundationRequired = input.foundation !== undefined
  const foundationApproved = Boolean(
    approvedArch
    && input.foundation?.approved
    && input.foundation.approved.architectureHash === approvedArch.contentHash,
  )
  const designComplete = archApproved && (!foundationRequired || foundationApproved)
  const allocatedModuleIds = archApproved ? approvedArch?.moduleIds ?? [] : []
  const approved = approvedManifests(input.modules)
  const approvedById = new Map(approved.map((m) => [m.moduleId, m]))

  // ---- Build: modules → entry points → shared application setup ----
  const buildTotal = allocatedModuleIds.length
  const buildDone = allocatedModuleIds.filter((id) => approvedById.has(id)).length
  const buildHasModules = buildTotal > 0
  const modulesApproved = buildHasModules && buildDone === buildTotal

  const approvedOperationKeys = new Set(approved.flatMap((manifest) => manifest.providedOperations
    .map((operation) => `${operation.operationId}@${operation.contractVersion}`)))
  const hasApprovedOperation = approvedOperationKeys.size > 0
  const deployables = input.deployables ?? []
  const inboundBindings = input.inboundBindings ?? []
  const entryPoints = evaluateConnectEntryPoints(
    deployables.map((d) => ({ deployableId: d.deployableId, kind: d.kind })),
    inboundBindings.map((b) => ({
      bindingId: b.bindingId,
      deployableId: b.deployableId,
      operationId: b.operationId,
      operationVersion: b.operationVersion,
      approved: b.approved && approvedOperationKeys.has(`${b.operationId}@${b.operationVersion}`),
      exposure: b.exposure,
    })),
  )
  const requiresEntryPoints = entryPoints.requiredDeployableIds.length > 0
  const entryPointsConfigured = !requiresEntryPoints || entryPoints.allRequiredSatisfied
  const entryPointDone = entryPoints.deployables.filter((item) => item.requiresEntryPoint && item.satisfied).length
  const entryPointTotal = entryPoints.requiredDeployableIds.length

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
  const buildComplete = modulesApproved && entryPointsConfigured && currentGenerationApplied && currentCommandsPassed

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
  const verifyUnlocked = buildComplete
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
    state: !appApproved ? 'locked' : designComplete ? 'complete' : 'current',
    shortStatus: !appApproved
      ? 'Approve Plan first.'
      : designComplete
        ? 'Solution design approved.'
        : archApproved
          ? 'Review how the application runs.'
        : archDraft
          ? 'Review the solution design.'
          : 'Shape the solution.',
    prerequisiteReason: !appApproved ? 'Requires an approved application plan.' : undefined,
    helpTopic: STAGE_HELP.architect,
    nextStageId: 'build',
    satisfied: designComplete,
  })

  // Build
  const buildState: StageState = !designComplete
    ? 'locked'
    : buildComplete
      ? 'complete'
      : 'current'
  stages.push({
    id: 'build',
    label: STAGE_LABELS.build,
    state: buildState,
    shortStatus: !designComplete
      ? 'Approve Design first.'
      : !buildHasModules
        ? 'The architecture allocates no modules.'
        : !modulesApproved
          ? `${buildDone} of ${buildTotal} approved.`
          : requiresEntryPoints && !hasApprovedOperation
            ? 'Approve at least one capability operation before configuring entry points.'
            : !entryPointsConfigured
              ? input.connectDisposition === 'deferred'
                ? 'Entry-point configuration is deferred and needs attention.'
                : `${entryPointDone} of ${entryPointTotal} application entry points configured.`
          : buildComplete
            ? hasProductionIntegration
              ? `All ${buildTotal} modules approved, entry points configured, and shared setup tested.`
              : `All ${buildTotal} modules approved.`
            : integrationDeployables.length === 0
              ? 'Approve the deployable foundation before generating infrastructure.'
              : currentGenerationApplied
                ? 'Run the approved install, build, and test commands.'
                : 'Generate and apply the deployable infrastructure.',
    prerequisiteReason: !designComplete ? 'Requires an approved solution design.' : undefined,
    progress: archApproved && buildHasModules ? {
      done: buildDone + entryPointDone + (hasProductionIntegration && currentGenerationApplied && currentCommandsPassed ? 1 : 0),
      total: buildTotal + entryPointTotal + (hasProductionIntegration ? 1 : 0),
    } : undefined,
    helpTopic: STAGE_HELP.build,
    nextStageId: 'verify',
    satisfied: buildComplete,
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
      ? 'Requires approved modules, configured entry points, and current shared application setup.'
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
    entryPoints: entryPoints.deployables,
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
