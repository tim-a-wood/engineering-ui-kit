/**
 * Typed view-state navigation per ARCH-ROUTE-001/002 — no URL router.
 * Workflow step preconditions are pure functions of persisted handoff state
 * (ARCH-ROUTE-004) shared by the stepper, guards, and tests.
 *
 * User-facing workflow is two steps (Build → Test). Persisted
 * `HandoffRun.currentStep` values remain the five legacy artifact stages so
 * existing runs need no destructive migration.
 */

import type { HandoffRun } from '@engineering-ui-kit/core'

export type ViewId =
  | 'copilot-handoff'
  | 'recipes'
  | 'components'
  | 'projects'
  | 'settings'
  | 'build'
  | 'prepare-context'
  | 'create-task-packet'
  | 'run-in-copilot'
  | 'apply-zip-overlay'
  | 'verify-review'

/** Internal Build workspace tabs — not workflow steps. */
export type BuildWorkspaceState = 'handoff' | 'copilot' | 'overlay'

export const NAV_ITEMS: { id: ViewId; label: string; glyph: string }[] = [
  { id: 'copilot-handoff', label: 'Build & Test', glyph: '⌂' },
  { id: 'recipes', label: 'Recipes', glyph: '▦' },
  { id: 'components', label: 'Components', glyph: '⬡' },
  { id: 'projects', label: 'Projects', glyph: '▱' },
  { id: 'settings', label: 'Settings', glyph: '⚙' },
]

/** User-facing stepper — exactly Build then Test. */
export const WORKFLOW_STEPS: {
  id: ViewId
  index: number
  name: string
  short: string
  supporting: string
}[] = [
  { id: 'build', index: 0, name: '1. Build', short: 'Build', supporting: 'Prepare, hand off & apply' },
  { id: 'verify-review', index: 1, name: '2. Test', short: 'Test', supporting: 'Verify & review' },
]

/** Persisted run.currentStep order (compatibility with stored runs). */
export const STEP_ORDER: HandoffRun['currentStep'][] = [
  'prepare-context',
  'create-task-packet',
  'run-in-copilot',
  'apply-zip-overlay',
  'verify-review',
  'complete',
]

/** Legacy view IDs that resolve into Build with a workspace state. */
export const LEGACY_BUILD_VIEWS: ViewId[] = [
  'prepare-context',
  'create-task-packet',
  'run-in-copilot',
  'apply-zip-overlay',
]

export function stepIndex(step: HandoffRun['currentStep']): number {
  return STEP_ORDER.indexOf(step)
}

/** Map a persisted run step to the visible Build/Test stepper index. */
export function visibleStepIndex(step: HandoffRun['currentStep']): number {
  if (step === 'verify-review' || step === 'complete') return 1
  return 0
}

/** Initial Build workspace tab for a persisted (or legacy) step/view. */
export function buildWorkspaceForStep(
  step: HandoffRun['currentStep'] | ViewId,
): BuildWorkspaceState {
  switch (step) {
    case 'run-in-copilot':
      return 'copilot'
    case 'apply-zip-overlay':
      return 'overlay'
    case 'prepare-context':
    case 'create-task-packet':
    case 'build':
    default:
      return 'handoff'
  }
}

/**
 * Resolve any workflow-related ViewId to the canonical route plus optional
 * Build workspace. Legacy pre-test routes become `build`.
 */
export function resolveWorkflowNavigation(view: ViewId): {
  view: ViewId
  workspace?: BuildWorkspaceState
} {
  if (view === 'build' || LEGACY_BUILD_VIEWS.includes(view)) {
    return { view: 'build', workspace: buildWorkspaceForStep(view === 'build' ? 'prepare-context' : view) }
  }
  return { view }
}

export function isWorkflowView(view: ViewId): boolean {
  return view === 'build' || view === 'verify-review' || LEGACY_BUILD_VIEWS.includes(view)
}

/**
 * Precondition: which workflow views are reachable for a given run.
 * Completed and current stages are always revisitable; a future stage opens
 * only when the artifacts it consumes exist (ARCH-ROUTE-004).
 *
 * Build (and all legacy Build stages) are reachable whenever Prepare Context
 * would have been. Test requires appliedFilesPath, matching Verify & Review.
 */
export function isStepReachable(run: HandoffRun | undefined, view: ViewId): boolean {
  const resolved = resolveWorkflowNavigation(view).view
  if (resolved !== 'build' && resolved !== 'verify-review') return true

  if (!run) return resolved === 'build'

  const currentVisible = visibleStepIndex(run.currentStep)
  const targetIndex = resolved === 'build' ? 0 : 1
  if (targetIndex <= currentVisible) return true

  if (resolved === 'build') return true

  // Test / verify-review — same gate as before
  return Boolean(run.appliedFilesPath)
}

/** Whether a legacy Build-internal stage is artifact-reachable (for rail CTAs). */
export function isLegacyStageReachable(
  run: HandoffRun | undefined,
  stage: HandoffRun['currentStep'] | ViewId,
): boolean {
  if (!run) return stage === 'prepare-context' || stage === 'build'
  const current = stepIndex(run.currentStep)
  const stageKey = stage === 'build' ? 'prepare-context' : stage
  const target = STEP_ORDER.indexOf(stageKey as HandoffRun['currentStep'])
  if (target < 0) return true
  if (target <= current) return true
  switch (stageKey) {
    case 'create-task-packet':
      return Boolean(run.repoFlatfilePath)
    case 'run-in-copilot':
    case 'apply-zip-overlay':
      return Boolean(run.taskPacketPath || run.taskAndStandardPackPath)
    case 'verify-review':
      return Boolean(run.appliedFilesPath)
    default:
      return target === 0
  }
}

export function stepStateFor(run: HandoffRun | undefined, index: number): 'complete' | 'current' | 'upcoming' {
  const current = run ? visibleStepIndex(run.currentStep) : 0
  if (run && run.currentStep === 'complete') return 'complete'
  if (index < current) return 'complete'
  if (index === current) return 'current'
  return 'upcoming'
}

/** Canonical view to open when resuming a persisted run. */
export function viewForRunStep(step: HandoffRun['currentStep']): ViewId {
  if (step === 'verify-review' || step === 'complete') return 'verify-review'
  return 'build'
}

/** Recipe selection carried from the Recipes view into Build task authoring. */
export type RecipePrefill = {
  id: string
  title: string
  goal: string
  scope: string
  constraints: string
  acceptanceCriteria: string
  references: string
  componentsUsed: string[]
}
