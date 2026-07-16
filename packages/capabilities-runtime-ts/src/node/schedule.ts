/**
 * Scheduled-worker foundation (§7.1, §10.3). Drives {@link Operation}s off
 * the in-house five-field cron parser ({@link nextRunAfter}), with an
 * explicit IANA timezone, an injected {@link Clock} for deterministic
 * tests, an overlap policy, a misfire policy, a request-job {@link Context}
 * scope per run, and cooperative graceful shutdown.
 *
 * `OverlapPolicy` and `MisfirePolicy` mirror the frozen canonical contract
 * (CAP-ERA-001 §9 CAP-CONTRACT-028 schedule variant) exactly, so generated
 * inbound bindings can pass the contract's own string literals straight
 * through without a lossy remapping layer.
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

/**
 * How to handle a run becoming due while its predecessor is still active:
 *
 * - `'skip'` (default): the overlapping occurrence is dropped; only the
 *   in-flight run continues.
 * - `'queue'`: runs are serialized. The overlapping occurrence is never
 *   dropped and never runs concurrently with another — it is enqueued and
 *   started as soon as the active run (and any earlier queued runs) finish,
 *   in order.
 * - `'allow-concurrent'`: the overlapping occurrence starts immediately,
 *   even while the predecessor is still active.
 */
export type OverlapPolicy = 'skip' | 'queue' | 'allow-concurrent'

/**
 * How to handle one or more scheduled instants that have already elapsed by
 * the time the worker (re)computes a job's schedule — e.g. the process just
 * started after downtime, or a prior tick's own scheduling was delayed:
 *
 * - `'run-once'` (default): execute a single catch-up run representing the
 *   backlog, then resume the normal future schedule.
 * - `'skip'`: drop every missed occurrence; jump straight to the next
 *   future occurrence without executing any of the backlog.
 * - `'run-all'`: execute every missed occurrence exactly once, in
 *   chronological order, before resuming the normal future schedule.
 */
export type MisfirePolicy = 'run-once' | 'skip' | 'run-all'

export interface ScheduledJobDefinition<Input> {
  readonly name: string
  readonly cronExpression: string
  readonly timeZone: string
  readonly operation: Operation<Input, unknown, unknown, unknown>
  readonly input: () => Input | Promise<Input>
  readonly overlapPolicy?: OverlapPolicy
  readonly misfirePolicy?: MisfirePolicy
  readonly observedPath?: {
    readonly inboundAdapter: string
    readonly compositionRoot: string
    readonly operation: string
    readonly outboundAdapters: ReadonlyArray<string>
  }
}

export type RunScheduledJobOnceOptions = {
  readonly configuration: ConfigurationReader
  readonly secretResolver: SecretResolver
  readonly correlationId?: string
  readonly clock?: Clock
  readonly logger?: Logger
  readonly tracer?: Tracer
  readonly cancellation?: CancellationController
}

/** Executes one approved scheduled-job definition immediately through the same dispatch/context boundary. */
export async function runScheduledJobOnce(
  definition: ScheduledJobDefinition<never>,
  options: RunScheduledJobOnceOptions,
): Promise<Outcome<unknown, unknown, unknown>> {
  const correlationId = options.correlationId ?? createCorrelationId()
  const cancellation = options.cancellation ?? new CancellationController()
  return runWithCorrelationId(correlationId, async () => {
    const input = await definition.input()
    const context = createNodeContext({
      correlationId, configuration: options.configuration, secretResolver: options.secretResolver,
      cancellation, clock: options.clock ?? SYSTEM_CLOCK, logger: options.logger ?? NOOP_LOGGER,
      tracer: options.tracer ?? NOOP_TRACER,
    })
    return dispatch(definition.operation, input, context)
  })
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
  /** Next live cron occurrence to arm a timer for (i.e. after any misfire backlog has been queued). */
  nextRunAtMs: number
  /** Number of runs currently in flight for this job (>1 only under `allow-concurrent`). */
  activeCount: number
  timerHandle: TimerHandle | undefined
  readonly activeCancellations: Set<CancellationController>
  /**
   * FIFO of due occurrences awaiting execution, always run strictly one at a
   * time (the next entry starts only once the previous run completes,
   * regardless of `overlapPolicy` — these are not concurrent scheduling
   * pressure, just backlog). Populated by misfire `'run-once'`/`'run-all'`
   * catch-up and by overlap `'queue'` deferrals.
   */
  readonly pendingRuns: number[]
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
      activeCount: 0,
      timerHandle: undefined,
      activeCancellations: new Set<CancellationController>(),
      pendingRuns: [],
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
      job.pendingRuns.length = 0
      for (const cancellation of job.activeCancellations) cancellation.cancel('worker-shutting-down')
    }
    await Promise.all(Array.from(this.inFlight))
  }

  /** Diagnostic snapshot of computed next-run times, useful for tests and health/readiness reporting. */
  listJobs(): ReadonlyArray<{ name: string; nextRunAtMs: number }> {
    return this.jobs.map((job) => ({ name: job.definition.name, nextRunAtMs: job.nextRunAtMs }))
  }

  /**
   * The single scheduling step, run both when first arming a job and as the
   * live timer's own callback (since real elapsed time — or an injected
   * clock advanced by a test — may have moved further ahead than when the
   * timer was armed, which is exactly the misfire scenario this checks
   * for). If `job.nextRunAtMs` is due:
   *
   * - and no further occurrence has also already elapsed, this is a normal
   *   on-time tick — it is dispatched directly through the job's
   *   {@link OverlapPolicy}, regardless of `misfirePolicy`;
   * - otherwise at least one occurrence was genuinely missed, and the job's
   *   {@link MisfirePolicy} decides how much of the backlog is queued onto
   *   `job.pendingRuns` (run strictly one at a time, independent of
   *   `overlapPolicy`, since backlog is not concurrent scheduling
   *   pressure) before `job.nextRunAtMs` resumes at the next future tick.
   */
  private scheduleNext(job: JobState): void {
    if (this.stopping) return
    const now = this.clock.now()
    const { cronExpression, timeZone } = job.definition
    if (job.nextRunAtMs <= now) {
      const followingOccurrence = nextRunAfter(cronExpression, timeZone, job.nextRunAtMs)
      if (followingOccurrence > now) {
        // On-time (or only marginally late) single due occurrence: always dispatched.
        const dueAtMs = job.nextRunAtMs
        job.nextRunAtMs = followingOccurrence
        this.dispatchOccurrence(job, dueAtMs)
        return
      }
      this.applyMisfirePolicy(job, now)
      if (job.activeCount === 0) this.pumpPendingRuns(job)
    }
    const delayMs = job.nextRunAtMs - this.clock.now()
    job.timerHandle = this.scheduleTimer(() => {
      this.scheduleNext(job)
    }, delayMs)
  }

  /**
   * Queues the occurrence(s) genuinely missed (at least one whole occurrence
   * has already elapsed beyond the current due one) onto `job.pendingRuns`
   * and advances `job.nextRunAtMs` to the first genuinely future occurrence,
   * per the job's {@link MisfirePolicy}.
   */
  private applyMisfirePolicy(job: JobState, now: number): void {
    const policy = job.definition.misfirePolicy ?? 'run-once'
    const { cronExpression, timeZone } = job.definition
    if (policy === 'skip') {
      // Drop every missed occurrence; resume from the next future one.
      job.nextRunAtMs = nextRunAfter(cronExpression, timeZone, now)
      return
    }
    if (policy === 'run-once') {
      // A single catch-up run representing the whole backlog, then resume
      // from the next future occurrence (skipping the rest of the backlog).
      job.pendingRuns.push(job.nextRunAtMs)
      job.nextRunAtMs = nextRunAfter(cronExpression, timeZone, now)
      return
    }
    // 'run-all': enumerate every occurrence from the stale `nextRunAtMs` up
    // to (and including) `now`, queue each for execution in order, then
    // resume the live schedule from the first genuinely future occurrence.
    let occurrence = job.nextRunAtMs
    while (occurrence <= now) {
      job.pendingRuns.push(occurrence)
      occurrence = nextRunAfter(cronExpression, timeZone, occurrence)
    }
    job.nextRunAtMs = occurrence
  }

  /** Handles one on-time due occurrence per the job's {@link OverlapPolicy}, then re-arms the live schedule. */
  private dispatchOccurrence(job: JobState, dueAtMs: number): void {
    if (this.stopping) return
    const overlap = job.definition.overlapPolicy ?? 'skip'
    if (job.activeCount > 0) {
      if (overlap === 'allow-concurrent') {
        this.beginRun(job, dueAtMs)
      } else if (overlap === 'queue') {
        job.pendingRuns.push(dueAtMs)
      } else {
        this.logger.warn('scheduled job skipped: previous run still in progress', {
          job: job.definition.name,
          scheduledForMs: dueAtMs,
        })
      }
    } else {
      this.beginRun(job, dueAtMs)
    }
    this.scheduleNext(job)
  }

  private beginRun(job: JobState, dueAtMs: number): void {
    job.activeCount += 1
    const cancellation = new CancellationController()
    job.activeCancellations.add(cancellation)
    const runPromise = this.executeOnce(job, dueAtMs, cancellation).finally(() => {
      job.activeCount -= 1
      job.activeCancellations.delete(cancellation)
      this.inFlight.delete(runPromise)
      this.pumpPendingRuns(job)
    })
    this.inFlight.add(runPromise)
  }

  /**
   * Drains `job.pendingRuns` one entry at a time: starts the next queued
   * occurrence only when nothing is currently active. Called both whenever
   * a run finishes and right after misfire backlog is queued (in case no
   * run is already in flight to trigger the drain via its own completion).
   */
  private pumpPendingRuns(job: JobState): void {
    if (this.stopping) return
    if (job.activeCount > 0) return
    const dueAtMs = job.pendingRuns.shift()
    if (dueAtMs === undefined) return
    this.beginRun(job, dueAtMs)
  }

  private async executeOnce(job: JobState, dueAtMs: number, cancellation: CancellationController): Promise<void> {
    const correlationId = createCorrelationId()
    const span = this.tracer.startSpan(`schedule ${job.definition.name}`, { correlationId, scheduledForMs: dueAtMs })
    try {
      const outcome = await runScheduledJobOnce(job.definition, {
        correlationId, configuration: this.options.configuration, secretResolver: this.options.secretResolver,
        clock: this.clock, logger: this.logger, tracer: this.tracer, cancellation,
      })
      this.options.onRunComplete?.(job.definition.name, outcome)
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
