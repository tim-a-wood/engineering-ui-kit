import { CancellationError } from './cancellation.js'
import type { Context } from './context.js'
import { SYSTEM_CLOCK } from './clock.js'
import type { Operation } from './operation.js'
import { Outcome } from './outcome.js'
import type { ValidationIssue } from './validation.js'

/** Domain rejection produced when an operation's declared input validator rejects the input. */
export interface ValidationRejection {
  readonly errors: ReadonlyArray<ValidationIssue>
}

export const VALIDATION_REJECTED_CODE = 'validation-rejected'
export const UNHANDLED_EXCEPTION_CODE = 'unhandled-exception'
export const INVALID_OUTPUT_CODE = 'invalid-output'
export const UNHANDLED_EXCEPTION_SAFE_MESSAGE = 'An unexpected error occurred while executing the operation.'
export const INVALID_OUTPUT_SAFE_MESSAGE = 'The operation produced a result that failed contract validation.'

/**
 * Dispatches `input` to `operation.execute` under `context`.
 *
 * - Validates input via `operation.inputValidator` (AJV-backed or any
 *   injected {@link Validator}) before execution; a validation failure is
 *   returned as a domain `rejected` outcome, never an exception.
 * - Catches every exception thrown by `execute` at this boundary and
 *   converts it to a safe technical `failed` outcome — no stack trace,
 *   message detail, or secret value is ever included.
 * - Honors `context.cancellation`: if already cancelled, or cancelled
 *   during execution, resolves to a `cancelled` outcome.
 * - Enforces `context.deadline`: if already exceeded, or exceeded during
 *   execution, resolves to a `timedOut` outcome.
 */
export async function dispatch<Input, Success, DomainRejection, TechnicalFailure>(
  operation: Operation<Input, Success, DomainRejection, TechnicalFailure>,
  input: Input,
  context: Context,
): Promise<Outcome<Success, DomainRejection | ValidationRejection, TechnicalFailure>> {
  type Result = Outcome<Success, DomainRejection | ValidationRejection, TechnicalFailure>

  try {
    context.cancellation.throwIfCancelled()

    const clock = context.clock ?? SYSTEM_CLOCK
    if (context.deadline !== undefined && clock.now() >= context.deadline) {
      return Outcome.timedOut(context.deadline)
    }

    if (operation.inputValidator) {
      const result = operation.inputValidator.validate(input)
      if (!result.valid) {
        return Outcome.rejected<ValidationRejection>(VALIDATION_REJECTED_CODE, { errors: result.errors ?? [] })
      }
    }

    const cleanup: Array<() => void> = []
    const racers: Array<Promise<Result>> = [Promise.resolve().then(() => operation.execute(input, context))]

    racers.push(
      new Promise<Result>((resolve) => {
        const unsubscribe = context.cancellation.onCancel((reason) => resolve(Outcome.cancelled(reason)))
        cleanup.push(unsubscribe)
      }),
    )

    if (context.deadline !== undefined) {
      const deadline = context.deadline
      racers.push(
        new Promise<Result>((resolve) => {
          const remainingMs = Math.max(0, deadline - clock.now())
          const timer = setTimeout(() => resolve(Outcome.timedOut(deadline)), remainingMs)
          const withUnref = timer as unknown as { unref?: () => void }
          if (typeof withUnref.unref === 'function') withUnref.unref()
          cleanup.push(() => clearTimeout(timer))
        }),
      )
    }

    const outcome = await Promise.race(racers)
    for (const dispose of cleanup) dispose()

    if (Outcome.isSuccess(outcome) && operation.outputValidator) {
      const result = operation.outputValidator.validate(outcome.value)
      if (!result.valid) {
        return Outcome.failed<TechnicalFailure>(INVALID_OUTPUT_CODE, INVALID_OUTPUT_SAFE_MESSAGE, false)
      }
    }

    return outcome
  } catch (error) {
    if (error instanceof CancellationError) {
      return Outcome.cancelled(error.reason)
    }
    return Outcome.failed<TechnicalFailure>(UNHANDLED_EXCEPTION_CODE, UNHANDLED_EXCEPTION_SAFE_MESSAGE, false)
  }
}
