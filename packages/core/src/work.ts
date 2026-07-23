import type { HandoffRun } from './types.js'
import type {
  CapabilityModuleRecord,
  CapabilityRunScope,
  FreshnessState,
} from './capabilities/types.js'
import {
  WORK_LIFECYCLE_STATES,
  type PersistedWorkLifecycleState,
  type WorkCondition,
  type WorkLifecycleState,
  type WorkOutcome,
  type WorkTargetKind,
} from './workTypes.js'

export * from './workTypes.js'

const STATE_INDEX = new Map<WorkLifecycleState, number>(
  WORK_LIFECYCLE_STATES.map((state, index) => [state, index]),
)

const LEGACY_STATE_ALIASES: Record<string, WorkLifecycleState> = {
  ready: 'queued',
  'packet-exported': 'exported',
  'result-returned': 'returned',
  'overlay-inspected': 'inspected',
  'overlay-applied': 'applied',
}

export type NormalizedWorkState = {
  state: WorkLifecycleState
  condition: WorkCondition
  legacyValue?: string
}

/** Normalize old persisted values without rewriting or overstating their evidence. */
export function normalizeWorkLifecycleState(value: string | undefined): NormalizedWorkState {
  if (value && STATE_INDEX.has(value as WorkLifecycleState)) {
    return { state: value as WorkLifecycleState, condition: 'current' }
  }
  const alias = value ? LEGACY_STATE_ALIASES[value] : undefined
  if (alias) return { state: alias, condition: 'current', legacyValue: value }
  return {
    state: 'draft',
    condition: value ? 'legacy-unknown' : 'current',
    ...(value ? { legacyValue: value } : {}),
  }
}

export function workLifecycleRank(state: WorkLifecycleState): number {
  return STATE_INDEX.get(state) ?? 0
}

export function hasReachedWorkState(
  actual: WorkLifecycleState,
  expected: WorkLifecycleState,
): boolean {
  return workLifecycleRank(actual) >= workLifecycleRank(expected)
}

/**
 * Runs are monotonic. A caller may skip states when one atomic operation
 * produces the intervening evidence, but it may never move backward.
 */
export function assertWorkLifecycleTransition(
  from: PersistedWorkLifecycleState | string,
  to: WorkLifecycleState,
): void {
  const normalized = normalizeWorkLifecycleState(from)
  if (normalized.condition === 'legacy-unknown') {
    throw new Error(`cannot transition unknown legacy lifecycle state: ${from}`)
  }
  if (workLifecycleRank(to) < workLifecycleRank(normalized.state)) {
    throw new Error(`work lifecycle cannot move backward from ${normalized.state} to ${to}`)
  }
}

export type WorkTargetProgress = {
  targetId: string
  targetKind: WorkTargetKind
  label: string
  lifecycleState: WorkLifecycleState
  condition: WorkCondition
  outcome: WorkOutcome
  sourceRunId?: string
  approved: boolean
  freshness?: FreshnessState
}

export type WorkCoverage = {
  total: number
  defined: number
  approved: number
  exported: number
  returned: number
  inspected: number
  applied: number
  verified: number
  integrated: number
  complete: number
}

export type WorkCoverageDimension = {
  id: 'modules' | 'frontend'
  label: string
  coverage: WorkCoverage
}

export type WorkNextOperation =
  | 'definition.propose'
  | 'definition.review'
  | 'architecture.propose'
  | 'architecture.review'
  | 'modules.propose_batch'
  | 'modules.review_batch'
  | 'work.plan'
  | 'run.export'
  | 'run.return'
  | 'run.inspect'
  | 'run.apply'
  | 'run.verify'
  | 'frontend.plan'
  | 'result.open'

export type WorkNextAction = {
  actionId: string
  operation: WorkNextOperation
  reason: string
  targetIds: string[]
  prerequisites: string[]
  risk: 'low' | 'medium' | 'high'
  requiresHumanApproval: boolean
}

export type ProjectWorkOverview = {
  schemaVersion: '1.0'
  projectId: string
  targets: WorkTargetProgress[]
  dimensions: WorkCoverageDimension[]
  history: WorkHistoryEntry[]
  nextActions: WorkNextAction[]
  complete: boolean
  blockingDiagnostics: string[]
}

export type WorkHistoryEntry = {
  runId: string
  source: 'capability' | 'frontend'
  kind: string
  targetId: string
  targetKind: WorkTargetKind
  title: string
  lifecycleState: WorkLifecycleState
  condition: WorkCondition
  outcome: WorkOutcome
  parentRunId?: string
  supersedesRunId?: string
  changeReason?: string
  isEmptyDraft: boolean
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export type ProjectWorkInput = {
  projectId: string
  application: { draft?: unknown; approved?: unknown }
  architecture: { draft?: { moduleIds?: string[] }; approved?: { moduleIds?: string[] } }
  modules: CapabilityModuleRecord[]
  capabilityRuns: CapabilityRunScope[]
  handoffRuns: HandoffRun[]
  requiresFrontend?: boolean
}

function laterState(a: WorkLifecycleState, b: WorkLifecycleState): WorkLifecycleState {
  return workLifecycleRank(a) >= workLifecycleRank(b) ? a : b
}

/** Evidence fields can only advance a run beyond its persisted lifecycle value. */
export function capabilityRunEvidenceState(run: CapabilityRunScope): NormalizedWorkState {
  const normalized = normalizeWorkLifecycleState(run.lifecycleState)
  let state = normalized.state
  if (run.packetRefs.length > 0) state = laterState(state, 'exported')
  if (run.inspectionRef) state = laterState(state, 'inspected')
  if (run.applicationRef) state = laterState(state, 'applied')
  if (run.verificationRef) state = laterState(state, 'verified')
  return { ...normalized, state }
}

export function handoffRunEvidenceState(run: HandoffRun): NormalizedWorkState {
  let state: WorkLifecycleState = 'draft'
  if (run.repoFlatfilePath || run.repoInventoryPath) state = 'queued'
  if (run.taskPacketPath || run.taskAndStandardPackPath) state = 'exported'
  if (run.overlayZipPath || run.changesZipPath) state = 'returned'
  if (run.overlayInspectionSummaryPath) state = 'inspected'
  if (run.appliedFilesPath) state = 'applied'
  if ((run.verificationResultPaths?.length ?? 0) > 0) state = 'verified'
  if (run.currentStep === 'complete' && run.completionStatus === 'approved') state = 'complete'
  const condition: WorkCondition =
    run.completionStatus === 'rejected' ? 'failed'
      : run.completionStatus === 'needs-follow-up' ? 'blocked'
        : 'current'
  return { state, condition }
}

function coverage(targets: WorkTargetProgress[]): WorkCoverage {
  const reached = (state: WorkLifecycleState) =>
    targets.filter((target) => hasReachedWorkState(target.lifecycleState, state)).length
  return {
    total: targets.length,
    defined: targets.filter((target) => target.approved || hasReachedWorkState(target.lifecycleState, 'proposed')).length,
    approved: targets.filter((target) => target.approved).length,
    exported: reached('exported'),
    returned: reached('returned'),
    inspected: reached('inspected'),
    applied: reached('applied'),
    verified: reached('verified'),
    integrated: reached('integrated'),
    complete: reached('complete'),
  }
}

function latestCapabilityRun(
  runs: CapabilityRunScope[],
  targetId: string,
): CapabilityRunScope | undefined {
  return runs
    .filter((run) =>
      run.targetOwnerId === targetId
      && (run.kind === 'implementation' || run.kind === 'delta'))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
}

function moduleTarget(
  moduleId: string,
  modules: CapabilityModuleRecord[],
  runs: CapabilityRunScope[],
): WorkTargetProgress {
  const record = modules.find((candidate) => candidate.moduleId === moduleId)
  const run = latestCapabilityRun(runs, moduleId)
  const runState = run ? capabilityRunEvidenceState(run) : undefined
  const approved = Boolean(record?.approved)
  const ready = record?.freshness?.primaryState === 'ready'
  let lifecycleState: WorkLifecycleState = approved
    ? 'approved'
    : record?.draft
      ? 'proposed'
      : 'draft'
  if (runState) lifecycleState = laterState(lifecycleState, runState.state)
  // A current passing freshness record is canonical verification evidence,
  // including for workspaces created before run-level verification references.
  if (ready) lifecycleState = laterState(lifecycleState, 'verified')
  const freshness = record?.freshness?.primaryState
  const condition: WorkCondition =
    runState?.condition === 'legacy-unknown' ? 'legacy-unknown'
      : freshness && freshness !== 'ready' ? 'stale'
        : 'current'
  return {
    targetId: moduleId,
    targetKind: 'module',
    label: record?.approved?.name ?? record?.draft?.name ?? moduleId,
    lifecycleState,
    condition,
    outcome: ready ? 'passed' : 'pending',
    ...(run ? { sourceRunId: run.runId } : {}),
    approved,
    ...(freshness ? { freshness } : {}),
  }
}

function frontendTarget(runs: HandoffRun[]): WorkTargetProgress {
  const ranked = runs
    .map((run) => ({ run, evidence: handoffRunEvidenceState(run) }))
    .sort((a, b) =>
      workLifecycleRank(b.evidence.state) - workLifecycleRank(a.evidence.state)
      || b.run.updatedAt.localeCompare(a.run.updatedAt))[0]
  return {
    targetId: 'frontend',
    targetKind: 'frontend',
    label: 'Frontend',
    lifecycleState: ranked?.evidence.state ?? 'draft',
    condition: ranked?.evidence.condition ?? 'current',
    outcome:
      ranked?.run.completionStatus === 'approved' ? 'passed'
        : ranked?.run.completionStatus === 'rejected' ? 'rejected'
          : ranked?.run.completionStatus === 'needs-follow-up' ? 'needs-follow-up'
            : 'pending',
    ...(ranked ? { sourceRunId: ranked.run.id } : {}),
    approved: ranked?.run.completionStatus === 'approved',
  }
}

function inferCapabilityTargetKind(run: CapabilityRunScope): WorkTargetKind {
  if (run.targetKind) return run.targetKind
  const target = run.targetOwnerId.toLowerCase()
  if (target.includes('architecture')) return 'architecture'
  if (target.includes('product') || target.includes('application')) return 'product-definition'
  if (run.kind === 'connection') return 'binding'
  if (run.kind === 'verification') return 'verification'
  return 'module'
}

export function deriveProjectWorkHistory(
  capabilityRuns: CapabilityRunScope[],
  handoffRuns: HandoffRun[],
): WorkHistoryEntry[] {
  const capabilityHistory: WorkHistoryEntry[] = capabilityRuns.map((run) => {
    const evidence = capabilityRunEvidenceState(run)
    return {
      runId: run.runId,
      source: 'capability',
      kind: run.kind,
      targetId: run.targetOwnerId,
      targetKind: inferCapabilityTargetKind(run),
      title: run.targetOwnerId,
      lifecycleState: evidence.state,
      condition: evidence.condition,
      outcome: hasReachedWorkState(evidence.state, 'verified') ? 'passed' : 'pending',
      ...(run.parentRunId ? { parentRunId: run.parentRunId } : {}),
      ...(run.supersedesRunId ? { supersedesRunId: run.supersedesRunId } : {}),
      ...(run.changeReason ? { changeReason: run.changeReason } : {}),
      isEmptyDraft: run.packetRefs.length === 0 && run.artifactRefs.length === 0,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      ...(run.completedAt ? { completedAt: run.completedAt } : {}),
    }
  })
  const frontendHistory: WorkHistoryEntry[] = handoffRuns.map((run) => {
    const evidence = handoffRunEvidenceState(run)
    return {
      runId: run.id,
      source: 'frontend',
      kind: run.taskTemplateId ?? 'frontend-handoff',
      targetId: run.taskId ?? 'frontend',
      targetKind: 'frontend',
      title: run.taskTitle ?? 'Untitled frontend draft',
      lifecycleState: evidence.state,
      condition: evidence.condition,
      outcome:
        run.completionStatus === 'approved' ? 'passed'
          : run.completionStatus === 'rejected' ? 'rejected'
            : run.completionStatus === 'needs-follow-up' ? 'needs-follow-up'
              : 'pending',
      isEmptyDraft: !run.repoFlatfilePath && !run.taskPacketPath && !run.taskAndStandardPackPath,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      ...(run.completedAt ? { completedAt: run.completedAt } : {}),
    }
  })
  return [...capabilityHistory, ...frontendHistory]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function action(
  projectId: string,
  operation: WorkNextOperation,
  reason: string,
  targetIds: string[],
  options: Partial<Pick<WorkNextAction, 'prerequisites' | 'risk' | 'requiresHumanApproval'>> = {},
): WorkNextAction {
  return {
    actionId: `${projectId}:${operation}:${targetIds.join(',') || 'project'}`,
    operation,
    reason,
    targetIds,
    prerequisites: options.prerequisites ?? [],
    risk: options.risk ?? 'low',
    requiresHumanApproval: options.requiresHumanApproval ?? false,
  }
}

function deriveNextActions(
  input: ProjectWorkInput,
  moduleTargets: WorkTargetProgress[],
  frontend: WorkTargetProgress | undefined,
): WorkNextAction[] {
  if (!input.application.approved) {
    return [action(
      input.projectId,
      input.application.draft ? 'definition.review' : 'definition.propose',
      input.application.draft
        ? 'Review and approve the proposed product definition.'
        : 'Define the product before allocating architecture.',
      ['product-definition'],
      { requiresHumanApproval: Boolean(input.application.draft) },
    )]
  }
  if (!input.architecture.approved) {
    return [action(
      input.projectId,
      input.architecture.draft ? 'architecture.review' : 'architecture.propose',
      input.architecture.draft
        ? 'Review and approve the proposed architecture.'
        : 'Allocate modules, ports, adapters, bindings, and deployables.',
      ['architecture'],
      { requiresHumanApproval: Boolean(input.architecture.draft) },
    )]
  }
  const undefinedTargets = moduleTargets.filter((target) => target.lifecycleState === 'draft')
  if (undefinedTargets.length) {
    return [action(
      input.projectId,
      'modules.propose_batch',
      `Generate ${undefinedTargets.length} architecture-derived module proposals together.`,
      undefinedTargets.map((target) => target.targetId),
    )]
  }
  const unapproved = moduleTargets.filter((target) => !target.approved)
  if (unapproved.length) {
    return [action(
      input.projectId,
      'modules.review_batch',
      `Review ${unapproved.length} module proposals and shared assumptions in one batch.`,
      unapproved.map((target) => target.targetId),
      { requiresHumanApproval: true },
    )]
  }
  const unexported = moduleTargets.filter((target) => !hasReachedWorkState(target.lifecycleState, 'exported'))
  if (unexported.length) {
    return [action(
      input.projectId,
      'work.plan',
      `Plan dependency-ordered implementation for ${unexported.length} approved modules.`,
      unexported.map((target) => target.targetId),
    )]
  }
  const waiting = moduleTargets.filter((target) =>
    hasReachedWorkState(target.lifecycleState, 'exported')
    && !hasReachedWorkState(target.lifecycleState, 'returned'))
  if (waiting.length) {
    return [action(
      input.projectId,
      'run.return',
      `Return implementation results for ${waiting.length} exported targets.`,
      waiting.map((target) => target.targetId),
    )]
  }
  const inspect = moduleTargets.filter((target) =>
    hasReachedWorkState(target.lifecycleState, 'returned')
    && !hasReachedWorkState(target.lifecycleState, 'inspected'))
  if (inspect.length) {
    return [action(
      input.projectId,
      'run.inspect',
      `Inspect ${inspect.length} returned implementation results.`,
      inspect.map((target) => target.targetId),
    )]
  }
  const apply = moduleTargets.filter((target) =>
    hasReachedWorkState(target.lifecycleState, 'inspected')
    && !hasReachedWorkState(target.lifecycleState, 'applied'))
  if (apply.length) {
    return [action(
      input.projectId,
      'run.apply',
      `Apply ${apply.length} reviewed implementation results.`,
      apply.map((target) => target.targetId),
      { risk: 'high', requiresHumanApproval: true },
    )]
  }
  const verify = moduleTargets.filter((target) =>
    hasReachedWorkState(target.lifecycleState, 'applied')
    && !hasReachedWorkState(target.lifecycleState, 'verified'))
  if (verify.length) {
    return [action(
      input.projectId,
      'run.verify',
      `Verify ${verify.length} applied module implementations.`,
      verify.map((target) => target.targetId),
      { risk: 'medium', requiresHumanApproval: true },
    )]
  }
  if (input.requiresFrontend && frontend && !hasReachedWorkState(frontend.lifecycleState, 'exported')) {
    return [action(
      input.projectId,
      'frontend.plan',
      'Compile the frontend brief from approved capabilities and bindings.',
      ['frontend'],
    )]
  }
  if (frontend && hasReachedWorkState(frontend.lifecycleState, 'exported')
    && !hasReachedWorkState(frontend.lifecycleState, 'complete')) {
    const operation: WorkNextOperation =
      !hasReachedWorkState(frontend.lifecycleState, 'returned') ? 'run.return'
        : !hasReachedWorkState(frontend.lifecycleState, 'inspected') ? 'run.inspect'
          : !hasReachedWorkState(frontend.lifecycleState, 'applied') ? 'run.apply'
            : 'run.verify'
    return [action(
      input.projectId,
      operation,
      'Continue the active frontend result through return, review, apply, and verification.',
      ['frontend'],
      {
        risk: operation === 'run.apply' ? 'high' : operation === 'run.verify' ? 'medium' : 'low',
        requiresHumanApproval: operation === 'run.apply' || operation === 'run.verify',
      },
    )]
  }
  return [action(
    input.projectId,
    'result.open',
    'All required work has current verification evidence.',
    ['project-result'],
  )]
}

/** Canonical project projection consumed by both the human UI and machine API. */
export function deriveProjectWorkOverview(input: ProjectWorkInput): ProjectWorkOverview {
  const allocatedModuleIds =
    input.architecture.approved?.moduleIds
    ?? input.architecture.draft?.moduleIds
    ?? input.modules.map((record) => record.moduleId)
  const moduleTargets = allocatedModuleIds.map((moduleId) =>
    moduleTarget(moduleId, input.modules, input.capabilityRuns))
  const frontend = input.requiresFrontend ? frontendTarget(input.handoffRuns) : undefined
  const targets = [...moduleTargets, ...(frontend ? [frontend] : [])]
  const dimensions: WorkCoverageDimension[] = [{
    id: 'modules',
    label: 'Modules',
    coverage: coverage(moduleTargets),
  }]
  if (frontend) dimensions.push({
    id: 'frontend',
    label: 'Frontend',
    coverage: coverage([frontend]),
  })
  const moduleComplete = moduleTargets.length > 0
    && moduleTargets.every((target) => hasReachedWorkState(target.lifecycleState, 'verified'))
  const frontendComplete = !frontend || hasReachedWorkState(frontend.lifecycleState, 'complete')
  return {
    schemaVersion: '1.0',
    projectId: input.projectId,
    targets,
    dimensions,
    history: deriveProjectWorkHistory(input.capabilityRuns, input.handoffRuns),
    nextActions: deriveNextActions(input, moduleTargets, frontend),
    complete: moduleComplete && frontendComplete,
    blockingDiagnostics: targets
      .filter((target) => target.condition === 'legacy-unknown')
      .map((target) => `${target.targetId} has an unrecognized legacy lifecycle state.`),
  }
}
