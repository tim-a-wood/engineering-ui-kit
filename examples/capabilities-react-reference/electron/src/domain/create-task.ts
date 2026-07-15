/**
 * Tiny domain operation used to prove the TS capabilities runtime's
 * Electron IPC adapters work end-to-end: `create-task` succeeds for a
 * non-blank title and produces a domain rejection for a blank one. This is
 * the ONLY business logic in the Electron slice — everything else is
 * composition-root wiring and the Electron IPC host/renderer adapters
 * supplied by `@engineering-ui-kit/capabilities-runtime`.
 *
 * `execute` folds `context.correlationId` into the success value on
 * purpose: it lets the IPC end-to-end test assert that the correlation id
 * a renderer request carries really did propagate all the way through the
 * typed IPC boundary, `dispatch`'s `Context`, and into the operation itself
 * — not just as far as the main-process handler.
 */
import type { Context, Operation } from '@engineering-ui-kit/capabilities-runtime'
import { Outcome } from '@engineering-ui-kit/capabilities-runtime'

export interface CreateTaskInput {
  readonly title: string
}

export interface CreateTaskSuccess {
  readonly taskId: string
  readonly title: string
}

export interface CreateTaskRejection {
  readonly field: string
}

export const CREATE_TASK_OPERATION_CODE = 'create-task'

/** Domain-rejection code returned when `title` is blank (after trimming). */
export const BLANK_TITLE_REJECTED_CODE = 'blank-title'

export const createTaskOperation: Operation<CreateTaskInput, CreateTaskSuccess, CreateTaskRejection, never> = {
  code: CREATE_TASK_OPERATION_CODE,
  execute(input: CreateTaskInput, context: Context) {
    const title = input.title.trim()
    if (title.length === 0) {
      return Outcome.rejected<CreateTaskRejection>(BLANK_TITLE_REJECTED_CODE, { field: 'title' })
    }
    return Outcome.success<CreateTaskSuccess>({ taskId: `task-${context.correlationId}`, title })
  },
}
