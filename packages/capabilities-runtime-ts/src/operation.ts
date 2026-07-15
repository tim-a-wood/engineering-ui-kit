import type { Context } from './context.js'
import type { Outcome } from './outcome.js'
import type { Validator } from './validation.js'

/**
 * Operation<Input, Success, DomainRejection, TechnicalFailure> (§10.1).
 * `execute` returns an {@link Outcome}; it MUST NOT throw for domain
 * rejection — only for genuinely unexpected technical failure, which
 * {@link dispatch} catches at the boundary and converts to a safe `failed`
 * outcome.
 */
export interface Operation<Input, Success, DomainRejection = never, TechnicalFailure = never> {
  readonly code: string
  /** Optional injected input validator; `dispatch` runs it before `execute`. */
  readonly inputValidator?: Validator<Input>
  /** Optional injected output validator; `dispatch` runs it after a `success` outcome. */
  readonly outputValidator?: Validator<Success>
  execute(
    input: Input,
    context: Context,
  ): Outcome<Success, DomainRejection, TechnicalFailure> | Promise<Outcome<Success, DomainRejection, TechnicalFailure>>
}
