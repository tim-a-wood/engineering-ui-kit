/**
 * Framework-neutral operation controller underlying the `./react` hooks
 * (§7.1). Browser-safe: no `node:*` import, no JSX, no React dependency —
 * this file is plain state-machine logic so it can be unit-tested without
 * rendering a component.
 */

import { Outcome } from '../outcome.js'
import type { OperationCallOptions } from '../browser/client.js'

/**
 * Duck-typed subset of `OperationClient` (`../browser/client.js`) this
 * controller depends on — any generated per-operation client exposing this
 * shape can be used, without this module importing the concrete
 * `OperationClient` implementation.
 */
export interface OperationCallable {
  call<Success, DomainRejection = never, TechnicalFailure = never>(
    operationCode: string,
    input: unknown,
    options?: OperationCallOptions,
  ): Promise<Outcome<Success, DomainRejection, TechnicalFailure>>
}

export type OperationControllerState =
  | 'idle'
  | 'loading'
  | 'success'
  | 'rejected'
  | 'failed'
  | 'cancelled'
  | 'timedOut'

export interface OperationControllerSnapshot<Success, DomainRejection, TechnicalFailure> {
  readonly state: OperationControllerState
  /** True while a call is in flight; used to guard duplicate submissions. */
  readonly isSubmitting: boolean
  readonly outcome?: Outcome<Success, DomainRejection, TechnicalFailure>
}

const IDLE_SNAPSHOT: OperationControllerSnapshot<never, never, never> = {
  state: 'idle',
  isSubmitting: false,
}

/**
 * Thin, framework-neutral controller wrapping a single named operation call
 * through an {@link OperationCallable} (typically an `OperationClient` from
 * `../browser`, or a generated per-operation client built on top of it).
 * Holds no operation/domain logic of its own — it only tracks call
 * lifecycle state and guards against duplicate concurrent submissions.
 */
export class OperationController<Input, Success, DomainRejection = never, TechnicalFailure = never> {
  private readonly listeners = new Set<() => void>()
  private snapshotValue: OperationControllerSnapshot<Success, DomainRejection, TechnicalFailure> =
    IDLE_SNAPSHOT as OperationControllerSnapshot<Success, DomainRejection, TechnicalFailure>
  private generation = 0
  private activeAbort: AbortController | undefined

  constructor(
    private readonly client: OperationCallable,
    private readonly operationCode: string,
  ) {}

  getSnapshot = (): OperationControllerSnapshot<Success, DomainRejection, TechnicalFailure> => this.snapshotValue

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Runs the operation. This is the duplicate-submission guard: if a call
   * is already in flight, a second `run` is ignored (resolves `undefined`)
   * rather than firing an overlapping call.
   */
  async run(
    input: Input,
    options: OperationCallOptions = {},
  ): Promise<Outcome<Success, DomainRejection, TechnicalFailure> | undefined> {
    if (this.snapshotValue.isSubmitting) {
      return undefined
    }
    const generation = (this.generation += 1)
    const abortController = new AbortController()
    this.activeAbort = abortController
    this.setSnapshot({ state: 'loading', isSubmitting: true, outcome: undefined })

    let outcome: Outcome<Success, DomainRejection, TechnicalFailure>
    try {
      outcome = await this.client.call<Success, DomainRejection, TechnicalFailure>(this.operationCode, input, {
        ...options,
        signal: options.signal ?? abortController.signal,
      })
    } catch {
      // The transport boundary contract (`../browser/transport.js`) allows a
      // transport to throw for a defect it did not anticipate; the React
      // layer never lets an unexpected throw escape a hook, so it is mapped
      // to a safe technical failure here rather than propagated.
      outcome = Outcome.failed<TechnicalFailure>(
        'transport-defect',
        'An unexpected error occurred while communicating with the server.',
        false,
      )
    }

    if (generation !== this.generation) {
      // Superseded by a subsequent run()/cancel()/reset(); stale result
      // discarded from the reactive snapshot, but still returned to whoever
      // awaited this specific run() call directly.
      return outcome
    }
    this.activeAbort = undefined
    this.applyOutcome(outcome)
    return outcome
  }

  /**
   * Aborts the in-flight call, if any, and immediately reflects `cancelled`
   * state locally — independent of whether the transport itself honors the
   * abort signal before this method returns.
   */
  cancel(reason = 'cancelled-by-caller'): void {
    if (!this.snapshotValue.isSubmitting) return
    this.generation += 1
    this.activeAbort?.abort(reason)
    this.activeAbort = undefined
    this.setSnapshot({ state: 'cancelled', isSubmitting: false, outcome: Outcome.cancelled(reason) })
  }

  /**
   * Returns the controller to its initial idle state and discards any
   * in-flight call's eventual result.
   */
  reset(): void {
    this.generation += 1
    this.activeAbort = undefined
    this.setSnapshot({ state: 'idle', isSubmitting: false, outcome: undefined })
  }

  private applyOutcome(outcome: Outcome<Success, DomainRejection, TechnicalFailure>): void {
    const state: OperationControllerState = Outcome.isSuccess(outcome)
      ? 'success'
      : Outcome.isRejected(outcome)
        ? 'rejected'
        : Outcome.isFailed(outcome)
          ? 'failed'
          : Outcome.isCancelled(outcome)
            ? 'cancelled'
            : 'timedOut'
    this.setSnapshot({ state, isSubmitting: false, outcome })
  }

  private setSnapshot(next: OperationControllerSnapshot<Success, DomainRejection, TechnicalFailure>): void {
    this.snapshotValue = next
    for (const listener of this.listeners) listener()
  }
}
