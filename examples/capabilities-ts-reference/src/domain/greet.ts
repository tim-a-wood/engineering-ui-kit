/**
 * Tiny domain operation used to prove the TS capabilities runtime works
 * end-to-end: `greet` succeeds for a non-blank name and produces a domain
 * rejection for a blank one. This is the ONLY business logic in this
 * reference app — everything else is composition-root wiring and host
 * adapters supplied by `@engineering-ui-kit/capabilities-runtime`.
 */
import type { Operation } from '@engineering-ui-kit/capabilities-runtime'
import { Outcome } from '@engineering-ui-kit/capabilities-runtime'

export interface GreetInput {
  readonly name: string
}

export interface GreetSuccess {
  readonly greeting: string
}

export interface GreetRejection {
  readonly field: string
}

/** Domain-rejection code returned when `name` is blank (after trimming). */
export const BLANK_NAME_REJECTED_CODE = 'blank-name'

export const greetOperation: Operation<GreetInput, GreetSuccess, GreetRejection, never> = {
  code: 'greet',
  execute(input: GreetInput) {
    const trimmed = input.name.trim()
    if (trimmed.length === 0) {
      return Outcome.rejected<GreetRejection>(BLANK_NAME_REJECTED_CODE, { field: 'name' })
    }
    return Outcome.success<GreetSuccess>({ greeting: `Hello, ${trimmed}!` })
  },
}
