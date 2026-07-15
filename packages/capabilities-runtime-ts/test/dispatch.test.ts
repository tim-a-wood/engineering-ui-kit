import { describe, expect, it } from 'vitest'
import { CancellationController, NEVER_CANCELLED } from '../src/cancellation.js'
import type { Context } from '../src/context.js'
import { dispatch } from '../src/dispatch.js'
import { MapConfigurationReader } from '../src/configuration.js'
import type { Operation } from '../src/operation.js'
import { isCancelled, isFailed, isRejected, isSuccess, isTimedOut, Outcome } from '../src/outcome.js'
import { NOOP_LOGGER } from '../src/telemetry.js'
import { TestSecretResolver } from '../src/testing.js'

function baseContext(overrides: Partial<Context> = {}): Context {
  return {
    correlationId: 'corr-1',
    cancellation: NEVER_CANCELLED,
    configuration: new MapConfigurationReader(),
    secretResolver: new TestSecretResolver(),
    logger: NOOP_LOGGER,
    ...overrides,
  }
}

describe('dispatch', () => {
  it('converts a thrown exception into a safe failed outcome, never leaking the raw error', async () => {
    const operation: Operation<void, never, never, never> = {
      code: 'boom',
      execute() {
        throw new Error('leaking a raw stack trace and secret-value-should-never-appear-abc123')
      },
    }

    const outcome = await dispatch(operation, undefined, baseContext())

    expect(isFailed(outcome)).toBe(true)
    if (isFailed(outcome)) {
      expect(outcome.code).toBe('unhandled-exception')
      expect(outcome.retryable).toBe(false)
      const serialized = JSON.stringify(outcome)
      expect(serialized).not.toContain('secret-value-should-never-appear-abc123')
      expect(serialized).not.toContain('Error:')
      expect(serialized).not.toContain('.ts:')
    }
  })

  it('returns a domain rejection as-is, distinct from a technical failure', async () => {
    const operation: Operation<void, never, { field: string }, never> = {
      code: 'reject-me',
      execute() {
        return Outcome.rejected('duplicate-email', { field: 'email' })
      },
    }

    const outcome = await dispatch(operation, undefined, baseContext())

    expect(isRejected(outcome)).toBe(true)
    expect(isFailed(outcome)).toBe(false)
    if (isRejected(outcome)) {
      expect(outcome.code).toBe('duplicate-email')
      expect(outcome.details).toEqual({ field: 'email' })
    }
  })

  it('passes through a genuine success outcome', async () => {
    const operation: Operation<{ value: number }, number, never, never> = {
      code: 'double',
      execute(input) {
        return Outcome.success(input.value * 2)
      },
    }

    const outcome = await dispatch(operation, { value: 21 }, baseContext())

    expect(isSuccess(outcome)).toBe(true)
    if (isSuccess(outcome)) {
      expect(outcome.value).toBe(42)
    }
  })

  it('resolves to cancelled when the context is already cancelled', async () => {
    const controller = new CancellationController()
    controller.cancel('already cancelled before dispatch')

    const operation: Operation<void, never, never, never> = {
      code: 'never-runs',
      execute() {
        throw new Error('must not execute')
      },
    }

    const outcome = await dispatch(operation, undefined, baseContext({ cancellation: controller }))

    expect(isCancelled(outcome)).toBe(true)
    if (isCancelled(outcome)) {
      expect(outcome.reason).toBe('already cancelled before dispatch')
    }
  })

  it('resolves to cancelled when cancellation happens during execution', async () => {
    const controller = new CancellationController()

    const operation: Operation<void, string, never, never> = {
      code: 'slow',
      async execute() {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return Outcome.success('too late')
      },
    }

    const dispatchPromise = dispatch(operation, undefined, baseContext({ cancellation: controller }))
    controller.cancel('user cancelled mid-flight')

    const outcome = await dispatchPromise
    expect(isCancelled(outcome)).toBe(true)
    if (isCancelled(outcome)) {
      expect(outcome.reason).toBe('user cancelled mid-flight')
    }
  })

  it('resolves to timedOut when the deadline has already elapsed', async () => {
    const operation: Operation<void, never, never, never> = {
      code: 'never-runs',
      execute() {
        throw new Error('must not execute')
      },
    }

    const clock = { now: () => 1_000 }
    const outcome = await dispatch(operation, undefined, baseContext({ deadline: 500, clock }))

    expect(isTimedOut(outcome)).toBe(true)
    if (isTimedOut(outcome)) {
      expect(outcome.deadline).toBe(500)
    }
  })

  it('resolves to timedOut when the deadline elapses during execution', async () => {
    // Deadline is 10ms out; the operation takes 40ms — the deadline timer
    // must win the race even though clock.now() never advances on its own.
    const clock = { now: () => 0 }
    const operation: Operation<void, string, never, never> = {
      code: 'slow',
      async execute() {
        await new Promise((resolve) => setTimeout(resolve, 40))
        return Outcome.success('too late')
      },
    }

    const outcome = await dispatch(operation, undefined, baseContext({ deadline: 10, clock }))

    expect(isTimedOut(outcome)).toBe(true)
    if (isTimedOut(outcome)) {
      expect(outcome.deadline).toBe(10)
    }
  })
})
