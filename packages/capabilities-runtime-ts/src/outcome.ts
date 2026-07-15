/**
 * Outcome<Success, DomainRejection, TechnicalFailure> — the canonical,
 * language-neutral result shape for a Capabilities operation.
 *
 * See docs/CAPABILITIES-EXECUTABLE-REFERENCE-ARCHITECTURE-CLAUDE-HANDOFF.md
 * §10.1. Domain rejection is always a returned value, never an exception.
 * Technical failures carry only a safe message plus an optional opaque
 * cause reference — never a raw stack trace or secret detail.
 */

export interface SuccessOutcome<Success> {
  readonly kind: 'success'
  readonly value: Success
}

export interface RejectedOutcome<DomainRejection> {
  readonly kind: 'rejected'
  readonly code: string
  readonly details: DomainRejection
}

export interface FailedOutcome<TechnicalFailure = never> {
  readonly kind: 'failed'
  readonly code: string
  readonly safeMessage: string
  readonly retryable: boolean
  /** Opaque reference to out-of-band diagnostic detail (never the raw cause). */
  readonly causeRef?: string
  /** Optional structured, redaction-safe failure detail. */
  readonly details?: TechnicalFailure
}

export interface CancelledOutcome {
  readonly kind: 'cancelled'
  readonly reason: string
}

export interface TimedOutOutcome {
  readonly kind: 'timedOut'
  /** Epoch-millisecond deadline that was exceeded. */
  readonly deadline: number
}

export type Outcome<Success, DomainRejection = never, TechnicalFailure = never> =
  | SuccessOutcome<Success>
  | RejectedOutcome<DomainRejection>
  | FailedOutcome<TechnicalFailure>
  | CancelledOutcome
  | TimedOutOutcome

function success<Success>(value: Success): SuccessOutcome<Success> {
  return { kind: 'success', value }
}

function rejected<DomainRejection>(code: string, details: DomainRejection): RejectedOutcome<DomainRejection> {
  return { kind: 'rejected', code, details }
}

function failed<TechnicalFailure = never>(
  code: string,
  safeMessage: string,
  retryable: boolean,
  causeRef?: string,
): FailedOutcome<TechnicalFailure> {
  return causeRef === undefined
    ? { kind: 'failed', code, safeMessage, retryable }
    : { kind: 'failed', code, safeMessage, retryable, causeRef }
}

function cancelled(reason: string): CancelledOutcome {
  return { kind: 'cancelled', reason }
}

function timedOut(deadline: number): TimedOutOutcome {
  return { kind: 'timedOut', deadline }
}

export function isSuccess<Success, DomainRejection, TechnicalFailure>(
  outcome: Outcome<Success, DomainRejection, TechnicalFailure>,
): outcome is SuccessOutcome<Success> {
  return outcome.kind === 'success'
}

export function isRejected<Success, DomainRejection, TechnicalFailure>(
  outcome: Outcome<Success, DomainRejection, TechnicalFailure>,
): outcome is RejectedOutcome<DomainRejection> {
  return outcome.kind === 'rejected'
}

export function isFailed<Success, DomainRejection, TechnicalFailure>(
  outcome: Outcome<Success, DomainRejection, TechnicalFailure>,
): outcome is FailedOutcome<TechnicalFailure> {
  return outcome.kind === 'failed'
}

export function isCancelled<Success, DomainRejection, TechnicalFailure>(
  outcome: Outcome<Success, DomainRejection, TechnicalFailure>,
): outcome is CancelledOutcome {
  return outcome.kind === 'cancelled'
}

export function isTimedOut<Success, DomainRejection, TechnicalFailure>(
  outcome: Outcome<Success, DomainRejection, TechnicalFailure>,
): outcome is TimedOutOutcome {
  return outcome.kind === 'timedOut'
}

/**
 * Namespace of Outcome constructors. Named identically to the `Outcome`
 * type (types and values occupy separate namespaces in TypeScript), so
 * call sites read as `Outcome.success(value)` / `outcome is Outcome<...>`.
 */
export const Outcome = {
  success,
  rejected,
  failed,
  cancelled,
  timedOut,
  isSuccess,
  isRejected,
  isFailed,
  isCancelled,
  isTimedOut,
}
