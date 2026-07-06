/**
 * Typed view-state navigation per ARCH-ROUTE-001/002 — no URL router.
 * Workflow step preconditions are pure functions of persisted handoff state
 * (ARCH-ROUTE-004) shared by the stepper, guards, and tests.
 */

import type { HandoffRun } from '@engineering-ui-kit/core'

export type ViewId =
  | 'copilot-handoff'
  | 'recipes'
  | 'components'
  | 'projects'
  | 'settings'
  | 'prepare-context'
  | 'create-task-packet'
  | 'run-in-copilot'
  | 'apply-zip-overlay'
  | 'verify-review'

export const NAV_ITEMS: { id: ViewId; label: string; glyph: string }[] = [
  { id: 'copilot-handoff', label: 'Copilot Handoff', glyph: '⌂' },
  { id: 'recipes', label: 'Recipes', glyph: '▦' },
  { id: 'components', label: 'Components', glyph: '⬡' },
  { id: 'projects', label: 'Projects', glyph: '▱' },
  { id: 'settings', label: 'Settings', glyph: '⚙' },
]

export const WORKFLOW_STEPS: { id: ViewId; index: number; name: string; short: string }[] = [
  { id: 'prepare-context', index: 0, name: '1. Prepare Context', short: 'Prepare Context' },
  { id: 'create-task-packet', index: 1, name: '2. Create Task Packet', short: 'Create Task Packet' },
  { id: 'run-in-copilot', index: 2, name: '3. Run in Copilot', short: 'Run in Copilot' },
  { id: 'apply-zip-overlay', index: 3, name: '4. Apply Zip Overlay', short: 'Apply Zip Overlay' },
  { id: 'verify-review', index: 4, name: '5. Verify & Review', short: 'Verify & Review' },
]

export const STEP_ORDER: HandoffRun['currentStep'][] = [
  'prepare-context',
  'create-task-packet',
  'run-in-copilot',
  'apply-zip-overlay',
  'verify-review',
  'complete',
]

export function stepIndex(step: HandoffRun['currentStep']): number {
  return STEP_ORDER.indexOf(step)
}

/**
 * Precondition: which workflow views are reachable for a given run.
 * Completed and current steps are always revisitable; a future step opens
 * only when the artifacts it consumes exist (ARCH-ROUTE-004). The
 * run-in-copilot → apply-zip-overlay transition is artifact-gated rather
 * than state-gated because the Copilot upload itself is user-owned and
 * invisible to the app.
 */
export function isStepReachable(run: HandoffRun | undefined, view: ViewId): boolean {
  const target = WORKFLOW_STEPS.find((s) => s.id === view)
  if (!target) return true
  if (!run) return target.index === 0
  const current = stepIndex(run.currentStep)
  if (target.index <= current) return true
  switch (target.id) {
    case 'create-task-packet':
      return Boolean(run.repoFlatfilePath)
    case 'run-in-copilot':
      return Boolean(run.taskPacketPath || run.taskAndStandardPackPath)
    case 'apply-zip-overlay':
      return Boolean(run.taskPacketPath || run.taskAndStandardPackPath)
    case 'verify-review':
      return Boolean(run.appliedFilesPath)
    default:
      return false
  }
}

export function stepStateFor(run: HandoffRun | undefined, index: number): 'complete' | 'current' | 'upcoming' {
  const current = run ? Math.min(stepIndex(run.currentStep), WORKFLOW_STEPS.length - 1) : 0
  if (index < current || (run && run.currentStep === 'complete')) return 'complete'
  if (index === current) return 'current'
  return 'upcoming'
}

/** Recipe selection carried from the Recipes view into Create Task Packet. */
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
