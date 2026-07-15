/**
 * `useOperation` — a thin React hook over {@link OperationController}
 * (§7.1). No operation/domain logic lives here: every state transition is
 * delegated to the controller, which is in turn delegated to a
 * caller-supplied {@link OperationCallable} (typically an `OperationClient`
 * from `../browser`, wired to a generated per-operation client).
 * Browser-safe: no `node:*` import.
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react'

import type { OperationCallOptions } from '../browser/client.js'
import type { Outcome } from '../outcome.js'
import type {
  OperationCallable,
  OperationControllerSnapshot,
  OperationControllerState,
} from './controller.js'
import { OperationController } from './controller.js'

export type { OperationCallable, OperationControllerSnapshot, OperationControllerState }

export interface UseOperationResult<Input, Success, DomainRejection = never, TechnicalFailure = never> {
  readonly state: OperationControllerState
  /** True while a call is in flight — mirrors the hook's duplicate-submission guard. */
  readonly isSubmitting: boolean
  readonly outcome: Outcome<Success, DomainRejection, TechnicalFailure> | undefined
  /** Convenience projection of `outcome` for the common `success` case. */
  readonly value: Success | undefined
  /** Convenience projection of `outcome` for the domain-rejection case. */
  readonly rejection: { readonly code: string; readonly details: DomainRejection } | undefined
  /** Convenience projection of `outcome` for the technical-failure case. */
  readonly failure:
    | { readonly code: string; readonly safeMessage: string; readonly retryable: boolean }
    | undefined
  /** Convenience projection of `outcome` for the cancelled case. */
  readonly cancelledReason: string | undefined
  /**
   * Runs the operation. Calling `run` while a call is already in flight is
   * a no-op (resolves `undefined`) — the duplicate-submission guard —
   * rather than firing a second overlapping call.
   */
  run(input: Input, options?: OperationCallOptions): Promise<Outcome<Success, DomainRejection, TechnicalFailure> | undefined>
  /** Aborts the in-flight call, if any, and reflects `cancelled` state immediately. */
  cancel(reason?: string): void
  /** Returns to `idle`, discarding any in-flight call's eventual result. */
  reset(): void
}

/**
 * Drives a single named operation through `client` and exposes its
 * lifecycle (`idle` / `loading` / `success` / `rejected` / `failed` /
 * `cancelled` / `timedOut`) plus a duplicate-submission guard.
 *
 * `client` and `operationCode` are expected to be referentially stable
 * across renders (e.g. module-level singletons or values from a stable
 * generated client hook); the controller is rebuilt if either changes.
 */
export function useOperation<Input, Success, DomainRejection = never, TechnicalFailure = never>(
  client: OperationCallable,
  operationCode: string,
): UseOperationResult<Input, Success, DomainRejection, TechnicalFailure> {
  const controller = useMemo(
    () => new OperationController<Input, Success, DomainRejection, TechnicalFailure>(client, operationCode),
    [client, operationCode],
  )

  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)

  const run = useCallback(
    (input: Input, options?: OperationCallOptions) => controller.run(input, options),
    [controller],
  )
  const cancel = useCallback((reason?: string) => controller.cancel(reason), [controller])
  const reset = useCallback(() => controller.reset(), [controller])

  const outcome = snapshot.outcome
  return {
    state: snapshot.state,
    isSubmitting: snapshot.isSubmitting,
    outcome,
    value: outcome?.kind === 'success' ? outcome.value : undefined,
    rejection: outcome?.kind === 'rejected' ? { code: outcome.code, details: outcome.details } : undefined,
    failure:
      outcome?.kind === 'failed'
        ? { code: outcome.code, safeMessage: outcome.safeMessage, retryable: outcome.retryable }
        : undefined,
    cancelledReason: outcome?.kind === 'cancelled' ? outcome.reason : undefined,
    run,
    cancel,
    reset,
  }
}
