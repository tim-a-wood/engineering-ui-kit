/**
 * @engineering-ui-kit/capabilities-runtime — framework-neutral core.
 *
 * Framework-neutral only: this module MUST NOT import `node:*` built-ins so
 * it stays browser-safe-capable in principle. Host adapters (Node, browser,
 * React, Electron) are delivered by a later package increment.
 */

export type {
  SuccessOutcome,
  RejectedOutcome,
  FailedOutcome,
  CancelledOutcome,
  TimedOutOutcome,
} from './outcome.js'
// `Outcome` is re-exported once below, carrying both its type meaning
// (the discriminated union) and its value meaning (the constructor namespace).
export { Outcome, isSuccess, isRejected, isFailed, isCancelled, isTimedOut } from './outcome.js'

export type { Operation } from './operation.js'

export type { Context, Principal, AuthorizationHook } from './context.js'

export type { Clock } from './clock.js'
export { SYSTEM_CLOCK } from './clock.js'

export type { CancellationToken } from './cancellation.js'
export { CancellationError, CancellationController, NEVER_CANCELLED } from './cancellation.js'

export type { Logger, Tracer, Span } from './telemetry.js'
export { NOOP_LOGGER, NOOP_TRACER } from './telemetry.js'

export type { ConfigurationReader } from './configuration.js'
export { MapConfigurationReader } from './configuration.js'

export type { SecretReference, SecretResolver } from './secrets.js'
export { secretReference, isSecretReference, ResolvedSecret } from './secrets.js'

export type { Validator, ValidationResult, ValidationIssue } from './validation.js'
export { AjvValidator, createAjv2020 } from './validation.js'

export type { ValidationRejection } from './dispatch.js'
export {
  dispatch,
  VALIDATION_REJECTED_CODE,
  UNHANDLED_EXCEPTION_CODE,
  INVALID_OUTPUT_CODE,
  UNHANDLED_EXCEPTION_SAFE_MESSAGE,
  INVALID_OUTPUT_SAFE_MESSAGE,
} from './dispatch.js'

export type {
  Lifecycle,
  ServiceToken,
  ResolutionContext,
  ServiceRegistration,
  Scope,
} from './lifecycle.js'
export { LifecycleContainer, createToken } from './lifecycle.js'
