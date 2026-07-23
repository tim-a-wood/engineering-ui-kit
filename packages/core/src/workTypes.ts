/**
 * Canonical product-work lifecycle shared by Capabilities, frontend handoffs,
 * project history, and machine clients.
 *
 * Lifecycle answers "how far did this result travel?". Freshness, failure,
 * blocking, and supersession are deliberately separate conditions so a stale
 * verified result is never misrepresented as an earlier lifecycle state.
 */
export const WORK_LIFECYCLE_STATES = [
  'draft',
  'proposed',
  'approved',
  'queued',
  'exported',
  'returned',
  'inspected',
  'applied',
  'verified',
  'integrated',
  'complete',
] as const

export type WorkLifecycleState = (typeof WORK_LIFECYCLE_STATES)[number]

/** Values written by pre-unification releases. They remain readable in place. */
export const LEGACY_WORK_LIFECYCLE_STATES = [
  'ready',
  'packet-exported',
  'result-returned',
  'overlay-inspected',
  'overlay-applied',
] as const

export type LegacyWorkLifecycleState = (typeof LEGACY_WORK_LIFECYCLE_STATES)[number]
export type PersistedWorkLifecycleState = WorkLifecycleState | LegacyWorkLifecycleState

export const WORK_CONDITIONS = [
  'current',
  'stale',
  'blocked',
  'failed',
  'superseded',
  'abandoned',
  'legacy-unknown',
] as const

export type WorkCondition = (typeof WORK_CONDITIONS)[number]

export type WorkTargetKind =
  | 'product-definition'
  | 'architecture'
  | 'module'
  | 'adapter'
  | 'binding'
  | 'deployable'
  | 'frontend'
  | 'integration'
  | 'verification'

export type WorkOutcome = 'pending' | 'passed' | 'failed' | 'rejected' | 'needs-follow-up'
