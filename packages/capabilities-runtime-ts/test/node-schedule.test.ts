import { describe, expect, it, vi } from 'vitest'
import { MapConfigurationReader } from '../src/configuration.js'
import type { Operation } from '../src/operation.js'
import { Outcome } from '../src/outcome.js'
import { FakeClock, TestSecretResolver } from '../src/testing.js'
import type { ScheduledJobDefinition, TimerHandle } from '../src/node/schedule.js'
import { ScheduledWorker } from '../src/node/schedule.js'

/** Deterministic manual timer harness: `scheduleTimer` records the (single,
 * at-most-one-per-job) pending callback instead of using real timers; the
 * test fires it explicitly via `fire()`, on its own schedule, independent
 * of wall time. */
function createManualTimer(): {
  scheduleTimer: (callback: () => void, delayMs: number) => TimerHandle
  fire: () => void
} {
  let pending: (() => void) | undefined
  return {
    scheduleTimer(callback: () => void): TimerHandle {
      pending = callback
      return {
        cancel(): void {
          if (pending === callback) pending = undefined
        },
      }
    },
    fire(): void {
      const callback = pending
      pending = undefined
      callback?.()
    },
  }
}

/** A no-input, void-output operation whose `execute` is fully controlled by the test. */
function makeOperation(execute: () => Promise<Outcome<void>> | Outcome<void>): Operation<void, void> {
  return {
    code: 'test-scheduled-op',
    execute,
  }
}

function buildJob(overrides: Partial<ScheduledJobDefinition<never>>): ScheduledJobDefinition<never> {
  return {
    name: 'job-a',
    cronExpression: '* * * * *',
    timeZone: 'UTC',
    operation: makeOperation(() => Outcome.success(undefined)),
    input: () => undefined,
    ...overrides,
  } as ScheduledJobDefinition<never>
}

describe('ScheduledWorker overlap policy', () => {
  it('skip (default): drops an occurrence that becomes due while the previous run is still active', async () => {
    const clock = new FakeClock(Date.UTC(2026, 6, 15, 10, 0, 0))
    const timers = createManualTimer()
    let runCount = 0
    const resolvers: Array<() => void> = []
    const operation = makeOperation(
      () =>
        new Promise<Outcome<void>>((resolve) => {
          runCount += 1
          resolvers.push(() => resolve(Outcome.success(undefined)))
        }),
    )
    const worker = new ScheduledWorker({
      jobs: [buildJob({ operation, overlapPolicy: 'skip' })],
      configuration: new MapConfigurationReader(),
      secretResolver: new TestSecretResolver(),
      clock,
      scheduleTimer: timers.scheduleTimer,
    })

    worker.start()
    clock.advance(60_000)
    timers.fire() // first occurrence starts
    await vi.waitFor(() => expect(runCount).toBe(1))

    clock.advance(60_000)
    timers.fire() // second occurrence is due while the first is still active -> skipped, not queued, not concurrent
    await Promise.resolve()
    expect(runCount).toBe(1)

    resolvers[0]?.()
    await vi.waitFor(() => expect(resolvers.length).toBe(1))
    await worker.stop()
  })

  it('allow-concurrent: starts a new run even while the previous is still active', async () => {
    const clock = new FakeClock(Date.UTC(2026, 6, 15, 10, 0, 0))
    const timers = createManualTimer()
    let runCount = 0
    const resolvers: Array<() => void> = []
    const operation = makeOperation(
      () =>
        new Promise<Outcome<void>>((resolve) => {
          runCount += 1
          resolvers.push(() => resolve(Outcome.success(undefined)))
        }),
    )
    const worker = new ScheduledWorker({
      jobs: [buildJob({ operation, overlapPolicy: 'allow-concurrent' })],
      configuration: new MapConfigurationReader(),
      secretResolver: new TestSecretResolver(),
      clock,
      scheduleTimer: timers.scheduleTimer,
    })

    worker.start()
    clock.advance(60_000)
    timers.fire()
    await vi.waitFor(() => expect(runCount).toBe(1))

    clock.advance(60_000)
    timers.fire()
    await vi.waitFor(() => expect(runCount).toBe(2)) // started concurrently, previous still active

    resolvers.forEach((resolve) => resolve())
    await worker.stop()
  })

  it('queue: serializes an overlapping occurrence, starting it only once the active run finishes', async () => {
    const clock = new FakeClock(Date.UTC(2026, 6, 15, 10, 0, 0))
    const timers = createManualTimer()
    let runCount = 0
    const resolvers: Array<() => void> = []
    const operation = makeOperation(
      () =>
        new Promise<Outcome<void>>((resolve) => {
          runCount += 1
          resolvers.push(() => resolve(Outcome.success(undefined)))
        }),
    )
    const worker = new ScheduledWorker({
      jobs: [buildJob({ operation, overlapPolicy: 'queue' })],
      configuration: new MapConfigurationReader(),
      secretResolver: new TestSecretResolver(),
      clock,
      scheduleTimer: timers.scheduleTimer,
    })

    worker.start()
    clock.advance(60_000)
    timers.fire() // run #1 starts
    await vi.waitFor(() => expect(runCount).toBe(1))

    clock.advance(60_000)
    timers.fire() // run #2 becomes due while #1 is active -> queued, NOT started, NOT dropped
    await Promise.resolve()
    expect(runCount).toBe(1)

    resolvers[0]?.() // #1 finishes -> the queued #2 should start immediately, without waiting for another tick
    await vi.waitFor(() => expect(runCount).toBe(2))

    resolvers[1]?.()
    await worker.stop()
  })
})

describe('ScheduledWorker misfire policy', () => {
  it('skip: drops every missed occurrence and jumps straight to the next future one', async () => {
    const clock = new FakeClock(Date.UTC(2026, 6, 15, 10, 0, 0))
    const timers = createManualTimer()
    let runCount = 0
    const operation = makeOperation(() => {
      runCount += 1
      return Outcome.success(undefined)
    })
    const worker = new ScheduledWorker({
      jobs: [buildJob({ operation, misfirePolicy: 'skip' })],
      configuration: new MapConfigurationReader(),
      secretResolver: new TestSecretResolver(),
      clock,
      scheduleTimer: timers.scheduleTimer,
    })

    worker.start()
    // Simulate the process being "down"/unpolled for 5 whole scheduled minutes.
    clock.advance(5 * 60_000)
    timers.fire()
    await Promise.resolve()
    await Promise.resolve()

    expect(runCount).toBe(0)
    const [job] = worker.listJobs()
    expect(job?.nextRunAtMs).toBeGreaterThan(clock.now())
    await worker.stop()
  })

  it('run-once: fires a single catch-up run for the whole backlog, then resumes the normal schedule', async () => {
    const clock = new FakeClock(Date.UTC(2026, 6, 15, 10, 0, 0))
    const timers = createManualTimer()
    let runCount = 0
    const operation = makeOperation(() => {
      runCount += 1
      return Outcome.success(undefined)
    })
    const worker = new ScheduledWorker({
      jobs: [buildJob({ operation, misfirePolicy: 'run-once' })],
      configuration: new MapConfigurationReader(),
      secretResolver: new TestSecretResolver(),
      clock,
      scheduleTimer: timers.scheduleTimer,
    })

    worker.start()
    clock.advance(5 * 60_000) // 5 occurrences missed
    timers.fire()

    await vi.waitFor(() => expect(runCount).toBe(1)) // exactly one catch-up run, not five
    const [job] = worker.listJobs()
    expect(job?.nextRunAtMs).toBeGreaterThan(clock.now())
    await worker.stop()
  })

  it('run-all: fires each missed occurrence exactly once, in order, then resumes the normal schedule', async () => {
    const clock = new FakeClock(Date.UTC(2026, 6, 15, 10, 0, 0))
    const timers = createManualTimer()
    let runCount = 0
    const seenDueTimestamps: number[] = []
    const operation = makeOperation(() => {
      runCount += 1
      return Outcome.success(undefined)
    })
    const worker = new ScheduledWorker({
      jobs: [buildJob({ operation, misfirePolicy: 'run-all' })],
      configuration: new MapConfigurationReader(),
      secretResolver: new TestSecretResolver(),
      clock,
      tracer: {
        startSpan(_name, fields) {
          seenDueTimestamps.push(fields?.scheduledForMs as number)
          return { end(): void {}, recordException(): void {} }
        },
      },
      scheduleTimer: timers.scheduleTimer,
    })

    worker.start()
    clock.advance(3 * 60_000) // exactly 3 occurrences missed (T+1, T+2, T+3 minutes)
    timers.fire()

    await vi.waitFor(() => expect(runCount).toBe(3))
    expect(seenDueTimestamps).toEqual([...seenDueTimestamps].sort((a, b) => a - b)) // executed in chronological order
    const [job] = worker.listJobs()
    expect(job?.nextRunAtMs).toBeGreaterThan(clock.now())
    await worker.stop()
  })
})
