import { describe, expect, it } from 'vitest'
import { isCancelled, isSuccess, isTimedOut, Outcome } from '../src/outcome.js'
import type { Operation } from '../src/operation.js'
import {
  createTestContext,
  FakeClock,
  InMemoryPersistenceAdapter,
  persistenceAdapterContract,
  runAdapterContract,
  trigger,
} from '../src/testing.js'
import { CancellationController } from '../src/cancellation.js'

interface Widget {
  readonly id: string
  readonly label: string
}

describe('testing harness', () => {
  it('FakeClock is manually advanced and never reads real time', () => {
    const clock = new FakeClock(1_000)
    expect(clock.now()).toBe(1_000)
    clock.advance(500)
    expect(clock.now()).toBe(1_500)
    clock.set(0)
    expect(clock.now()).toBe(0)
  })

  it('InMemoryPersistenceAdapter satisfies the standard persistence adapter contract', async () => {
    const adapter = new InMemoryPersistenceAdapter<Widget>()
    const result = await runAdapterContract(
      adapter,
      persistenceAdapterContract<Widget>({ id: 'a', label: 'sample' }, { id: 'a', label: 'updated' }),
    )
    expect(result.passed).toBe(true)
    expect(result.failures).toEqual([])
  })

  it('trigger() drives an Operation through the real dispatch boundary', async () => {
    const operation: Operation<{ value: number }, number, never, never> = {
      code: 'triple',
      execute(input) {
        return Outcome.success(input.value * 3)
      },
    }

    const outcome = await trigger(operation, { value: 4 })
    expect(isSuccess(outcome)).toBe(true)
    if (isSuccess(outcome)) {
      expect(outcome.value).toBe(12)
    }
  })

  it('trigger() honors an overridden cancellation token', async () => {
    const controller = new CancellationController()
    controller.cancel('trigger test cancellation')

    const operation: Operation<void, never, never, never> = {
      code: 'never-runs',
      execute() {
        throw new Error('must not execute')
      },
    }

    const outcome = await trigger(operation, undefined, { cancellation: controller })
    expect(isCancelled(outcome)).toBe(true)
  })

  it('trigger() honors an overridden deadline via createTestContext', async () => {
    const operation: Operation<void, never, never, never> = {
      code: 'never-runs',
      execute() {
        throw new Error('must not execute')
      },
    }

    const context = createTestContext({ deadline: 0, clock: new FakeClock(1_000) })
    expect(context.deadline).toBe(0)

    const outcome = await trigger(operation, undefined, { deadline: 0, clock: new FakeClock(1_000) })
    expect(isTimedOut(outcome)).toBe(true)
  })
})
