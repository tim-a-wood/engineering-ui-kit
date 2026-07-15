/**
 * Scheduled-worker foundation (§7.1, §10.3). Drives {@link Operation}s off
 * the in-house five-field cron parser ({@link nextRunAfter}), with an
 * explicit IANA timezone, an injected {@link Clock} for deterministic
 * tests, an overlap policy, a narrow misfire policy, a request-job
 * {@link Context} scope per run, and cooperative graceful shutdown.
 */

import { CancellationController } from '../cancellation.js'
import type { Clock } from '../clock.js'
import { SYSTEM_CLOCK } from '../clock.js'
import type { ConfigurationReader } from '../configuration.js'
import { dispatch } from '../dispatch.js'
import type { Operation } from '../operation.js'
import type { Outcome } from '../outcome.js'
import type { SecretResolver } from '../secrets.js'
import type { Logger, Tracer } from '../telemetry.js'
import { NOOP_LOGGER, NOOP_TRACER } from '../telemetry.js'
import { nextRunAfter } from './cron.js'
import { createNodeContext } from './context.js'
import { createCorrelationId, runWithCorrelationId } from './correlation.js'

/** `'skip'` (default): a run whose predecessor is still in flight is skipped. `'allow'`: runs may overlap. */
export type OverlapPolicy = 'skip' | 'allow'

/**
 * `'skip-missed'` (default): if a job's scheduled instant has already
 * elapsed by the time it is (re)armed — e.g. the process just started, or
 * the previous run overran — jump straight to the next future occurrence
 * without executing the overdue one. `'run-once'`: execute the single
 * overdue occurrence once, then resume the normal future schedule.
 */
export type MisfirePolicy = 'skip-missed' | 'run-once'

export interface ScheduledJobDefinition<Input> {
  readonly name: string
  readonly cronExpression: string
  readonly timeZone: string
  readonly operation: Operation<Input, unknown, unknown, unknown>
  readonly input: () => Input | Promise<Input>
  readonly overlapPolicy?: OverlapPolicy
  readonly misfirePolicy?: MisfirePolicy
}

export interface TimerHandle {
  cancel(): void
}

export interface ScheduledWorkerOptions {
  readonly jobs: ReadonlyArray<ScheduledJobDefinition<never>>
  readonly configuration: ConfigurationReader
  readonly secretResolver: SecretResolver
  /** Injected clock; defaults to the system clock. Tests should inject a `FakeClock`. */
  readonly clock?: Clock
  readonly logger?: Logger
  readonly tracer?: Tracer
  readonly onRunComplete?: (jobName: string, outcome: Outcome<unknown, unknown, unknown>) => void
  /** Injectable timer scheduling function; defaults to `setTimeout`. Tests can drive scheduling manually. */
  readonly scheduleTimer?: (callback: () => void, delayMs: number) => TimerHandle
}

interface JobState {
  readonly definition: ScheduledJobDefinition<never>
  nextRunAtMs: number
  running: boolean
  timerHandle: TimerHandle | undefined
  currentCancellation: CancellationController | undefined
}

function defaultScheduleTimer(callback: () => void, delayMs: number): TimerHandle {
  const handle = setTimeout(callback, Math.max(0, delayMs))
  const withUnref = handle as unknown as { unref?: () => void }
  if (typeof withUnref.unref === 'function') withUnref.unref()
  return { cancel: (): void => clearTimeout(handle) }
}

/** Drives a set of scheduled jobs off the in-house cron parser and an injected clock. */
export class ScheduledWorker {
  private readonly jobs: JobState[]
  private readonly clock: Clock
  private readonly logger: Logger
  private readonly tracer: Tracer
  private readonly scheduleTimer: (callback: () => void, delayMs: number) => TimerHandle
  private started = false
  private stopping = false
  private readonly inFlight = new Set<Promise<void>>()

  constructor(private readonly options: ScheduledWorkerOptions) {
    this.clock = options.clock ?? SYSTEM_CLOCK
    this.logger = options.logger ?? NOOP_LOGGER
    this.tracer = options.tracer ?? NOOP_TRACER
    this.scheduleTimer = options.scheduleTimer ?? defaultScheduleTimer
    this.jobs = options.jobs.map((definition) => ({
      definition,
      nextRunAtMs: nextRunAfter(definition.cronExpression, definition.timeZone, this.clock.now()),
      running: false,
      timerHandle: undefined,
      currentCancellation: undefined,
    }))
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.stopping = false
    for (const job of this.jobs) this.scheduleNext(job)
  }

  /** Cancels in-flight runs' cooperative cancellation tokens and waits for them to settle. */
  async stop(): Promise<void> {
    this.stopping = true
    this.started = false
    for (const job of this.jobs) {
      job.timerHandle?.cancel()
      job.timerHandle = undefined
      job.currentCancellation?.cancel('worker-shutting-down')
    }
    await Promise.all(Array.from(this.inFlight))
  }

  /** Diagnostic snapshot of computed next-run times, useful for tests and health/readiness reporting. */
  listJobs(): ReadonlyArray<{ name: string; nextRunAtMs: number }> {
    return this.jobs.map((job) => ({ name: job.definition.name, nextRunAtMs: job.nextRunAtMs }))
  }

  private scheduleNext(job: JobState): void {
    if (this.stopping) return
    const now = this.clock.now()
    if (job.nextRunAtMs <= now && (job.definition.misfirePolicy ?? 'skip-missed') === 'skip-missed') {
      job.nextRunAtMs = nextRunAfter(job.definition.cronExpression, job.definition.timeZone, now)
    }
    const delayMs = job.nextRunAtMs - this.clock.now()
    job.timerHandle = this.scheduleTimer(() => {
      void this.runJob(job)
    }, delayMs)
  }

  private async runJob(job: JobState): Promise<void> {
    if (this.stopping) return
    if (job.running && (job.definition.overlapPolicy ?? 'skip') === 'skip') {
      this.logger.warn('scheduled job skipped: previous run still in progress', { job: job.definition.name })
      this.advanceAfterRun(job)
      return
    }

    job.running = true
    const runPromise = this.executeOnce(job).finally(() => {
      job.running = false
      job.currentCancellation = undefined
      this.inFlight.delete(runPromise)
      this.advanceAfterRun(job)
    })
    this.inFlight.add(runPromise)
    await runPromise
  }

  private advanceAfterRun(job: JobState): void {
    job.nextRunAtMs = nextRunAfter(job.definition.cronExpression, job.definition.timeZone, this.clock.now())
    if (!this.stopping) this.scheduleNext(job)
  }

  private async executeOnce(job: JobState): Promise<void> {
    const correlationId = createCorrelationId()
    const cancellation = new CancellationController()
    job.currentCancellation = cancellation
    const span = this.tracer.startSpan(`schedule ${job.definition.name}`, { correlationId })
    try {
      await runWithCorrelationId(correlationId, async () => {
        const input = await job.definition.input()
        const context = createNodeContext({
          correlationId,
          configuration: this.options.configuration,
          secretResolver: this.options.secretResolver,
          cancellation,
          clock: this.clock,
          logger: this.logger,
          tracer: this.tracer,
        })
        const outcome = await dispatch(job.definition.operation, input, context)
        this.options.onRunComplete?.(job.definition.name, outcome)
      })
    } catch (error) {
      this.logger.error('scheduled job threw outside dispatch', {
        job: job.definition.name,
        error: String(error),
      })
    } finally {
      span.end()
    }
  }
}
