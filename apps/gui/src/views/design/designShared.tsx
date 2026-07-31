/**
 * Shared presentation helpers for the Design workspace views.
 *
 * Labels follow Appendix C of the specification verbatim (the "Use" column):
 * `Design modules`, `Module design`, `Required question`, `Review contracts`,
 * `Create implementation handoff`, `Old`, `Waiting for dependency`,
 * `Run module checks`.
 */

import type { ReactNode } from 'react'
import type {
  DesignWorkflowPolicy,
  ModuleDesignProgress,
  ModuleDesignProgressEntry,
  ModuleQueueFilter,
  ModuleVerificationResult,
} from '@engineering-ui-kit/core/design-browser'
import type { ModuleType } from '@engineering-ui-kit/core'
import type { SaveState } from './designState'

/** Resolves an entry's `blockingIds` (module ids) to display names for the block explanation (§9.2 "explain the block"). */
export function blockingModuleNames(entry: ModuleDesignProgressEntry, progress: ModuleDesignProgress): string[] {
  const nameByModuleId = new Map(progress.modules.map((candidate) => [candidate.moduleId, candidate.name]))
  return entry.blockingIds.map((id) => nameByModuleId.get(id) ?? id)
}

/** Appendix C row-state label: never the "Do not use" column term. */
export function stateLabel(state: ModuleDesignProgressEntry['state']): string {
  switch (state) {
    case 'notStarted':
      return 'Not started'
    case 'draft':
      return 'Draft'
    case 'needsInput':
      return 'Needs input'
    case 'readyForReview':
      return 'Ready for review'
    case 'approved':
      return 'Approved'
    case 'stale':
      return 'Old'
    case 'blocked':
      return 'Waiting for dependency'
    default:
      return state
  }
}

/** Non-color glyph beside every state label (§18.4 "non-color status indicators"). */
export function stateGlyph(state: ModuleDesignProgressEntry['state']): string {
  switch (state) {
    case 'notStarted':
      return '○'
    case 'draft':
      return '◐'
    case 'needsInput':
      return '?'
    case 'readyForReview':
      return '◔'
    case 'approved':
      return '✓'
    case 'stale':
      return '↻'
    case 'blocked':
      return '⛔'
    default:
      return '·'
  }
}

export function moduleTypeLabel(moduleType: ModuleType): string {
  switch (moduleType) {
    case 'experience':
      return 'Experience'
    case 'workflow':
      return 'Workflow'
    case 'domain':
      return 'Domain'
    case 'connection':
      return 'Connection'
    case 'platform':
      return 'Platform'
    default:
      return moduleType
  }
}

export function operationName(operationId: string): string {
  const useCaseMatch = operationId.match(/\.use-case\.([^.]+)\.acceptance(?:\.|$)/i)
  const source = useCaseMatch?.[1]
    ?? operationId
      .replace(/^(?:op|operation)[.:/_-]+/i, '')
      .split('.')
      .filter((part) => !/^(?:acceptance|operation|primary)$/i.test(part))
      .slice(-3)
      .join(' ')
  const label = source
    .replace(/[.:/_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b(?:acceptance|operation|primary)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  return label ? `${label[0]!.toUpperCase()}${label.slice(1)}` : 'Operation'
}

export function scenarioSelectorToken(action: string): string {
  return action
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function suggestedScenarioSelector(action: string, target: 'action' | 'result'): string {
  const token = scenarioSelectorToken(action) || 'user-task'
  return `[data-scenario-${target}="${token}"]`
}

/** §9.2 queue filter chips, exact spec wording, in spec order. */
export const QUEUE_FILTERS: { id: ModuleQueueFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'notStarted', label: 'Not started' },
  { id: 'needsInput', label: 'Needs input' },
  { id: 'readyForReview', label: 'Ready for review' },
  { id: 'approved', label: 'Approved' },
  { id: 'old', label: 'Old' },
  { id: 'blocked', label: 'Blocked' },
]

export function filterCount(progress: { total: number; notStarted: number; needsInput: number; readyForReview: number; approved: number; stale: number; blocked: number }, filter: ModuleQueueFilter): number {
  switch (filter) {
    case 'all':
      return progress.total
    case 'notStarted':
      return progress.notStarted
    case 'needsInput':
      return progress.needsInput
    case 'readyForReview':
      return progress.readyForReview
    case 'approved':
      return progress.approved
    case 'old':
      return progress.stale
    case 'blocked':
      return progress.blocked
    default:
      return 0
  }
}

export function StateBadge(props: { state: ModuleDesignProgressEntry['state'] }): ReactNode {
  return (
    <span className={`design-state-badge design-state-${props.state}`}>
      <span aria-hidden="true">{stateGlyph(props.state)}</span>
      {stateLabel(props.state)}
    </span>
  )
}

/** §18.1 "Autosave drafts locally and show save state." Text alone carries the state (non-color). */
export function SaveIndicator(props: { saveState: SaveState; savedAt?: string; mode?: 'sample' | 'project' }): ReactNode {
  const text = props.saveState === 'saving'
    ? 'Saving…'
    : props.saveState === 'saved'
      ? props.mode === 'project' ? 'Synced to project' : 'Saved in this browser'
      : props.mode === 'sample' ? 'Bundled baseline' : 'Synced to project'
  return (
    <span className="design-save-indicator" role="status" aria-live="polite">
      {text}
    </span>
  )
}

/** §18.3 counts, never percentages: "3 of 17 module designs approved". */
export function approvalCountText(progress: { approved: number; total: number }): string {
  return `${progress.approved} of ${progress.total} module designs approved`
}

// ---------------------------------------------------------------------------
// Build / Verify / Evidence shared labels (§3.5, §6.2, §11, §14, §22)
// ---------------------------------------------------------------------------

/** §3.5: the two Design-to-Build gate modes, exact spec wording. */
export function gateModeLabel(mode: DesignWorkflowPolicy['mode']): string {
  return mode === 'completeBaseline' ? 'Complete Design baseline' : 'Incremental modules'
}

export function gateModeDescription(mode: DesignWorkflowPolicy['mode']): string {
  return mode === 'completeBaseline'
    ? 'Build starts after the complete Design baseline is approved.'
    : 'An approved, dependency-closed module can enter Build before unrelated module designs are complete.'
}

/** Module-verification outcome label: never "stale" (Appendix C uses "Old" for staleness elsewhere). */
export function verificationOutcomeLabel(outcome: ModuleVerificationResult['outcome']): string {
  switch (outcome) {
    case 'passed':
      return 'Valid'
    case 'failed':
      return 'Failed'
    case 'timeout':
      return 'Timed out'
    case 'skipped':
      return 'Skipped'
    default:
      return outcome
  }
}

/** Scenario-run / verification-record current-vs-old label (Appendix C: "Old", not "Freshness invalid"). */
export function currentStateLabel(state: 'current' | 'old'): string {
  return state === 'current' ? 'Current' : 'Old'
}
