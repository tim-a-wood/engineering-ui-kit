/**
 * Node process lifecycle (§7.1, §10.3): start/stop, graceful drain of the
 * HTTP host and scheduled worker, disposal of the composition root scope,
 * and telemetry-sink flush — the glue a generated Node deployable's entry
 * point calls into.
 */

import type { Scope } from '../lifecycle.js'
import type { Logger } from '../telemetry.js'
import { NOOP_LOGGER } from '../telemetry.js'
import type { NodeHttpHost } from './http.js'
import type { ScheduledWorker } from './schedule.js'

export interface TelemetrySink {
  flush(): Promise<void> | void
}

export interface ProcessLifecycleOptions {
  readonly rootScope: Scope
  readonly httpHost?: NodeHttpHost
  readonly scheduledWorker?: ScheduledWorker
  readonly telemetrySink?: TelemetrySink
  readonly logger?: Logger
  readonly httpPort?: number
  readonly httpHostAddress?: string
}

export interface ProcessStartResult {
  readonly httpPort?: number
}

/** Orchestrates start/stop across the HTTP host, scheduled worker, composition scope, and telemetry sink. */
export class ProcessLifecycle {
  private readonly logger: Logger
  private started = false

  constructor(private readonly options: ProcessLifecycleOptions) {
    this.logger = options.logger ?? NOOP_LOGGER
  }

  async start(): Promise<ProcessStartResult> {
    if (this.started) {
      throw new Error('ProcessLifecycle is already started')
    }
    this.started = true
    let httpPort: number | undefined
    if (this.options.httpHost) {
      const bound = await this.options.httpHost.start(this.options.httpPort, this.options.httpHostAddress)
      httpPort = bound.port
      this.logger.info('http host started', { port: httpPort })
    }
    this.options.scheduledWorker?.start()
    return { httpPort }
  }

  /** Drains the HTTP host and scheduled worker, disposes the root composition scope, then flushes telemetry. */
  async stop(): Promise<void> {
    if (!this.started) return
    this.started = false
    if (this.options.scheduledWorker) {
      await this.options.scheduledWorker.stop()
    }
    if (this.options.httpHost) {
      await this.options.httpHost.stop()
    }
    await this.options.rootScope.dispose()
    if (this.options.telemetrySink) {
      await this.options.telemetrySink.flush()
    }
    this.logger.info('process lifecycle stopped')
  }
}
