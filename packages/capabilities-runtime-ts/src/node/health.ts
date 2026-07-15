/**
 * Health/readiness helpers (§15.4). Liveness means the process event loop
 * is functioning: reaching this synchronous check at all is sufficient
 * evidence. Readiness means required configuration keys are present and
 * mandatory adapters report themselves available.
 */

import type { ConfigurationReader } from '../configuration.js'
import type { HealthCheck, HealthStatus, ReadinessCheck, ReadinessStatus } from './health-types.js'

/** A health check that is satisfied merely by executing — proof the event loop is responsive. */
export function createEventLoopHealthCheck(): HealthCheck {
  return {
    check(): HealthStatus {
      return { healthy: true, details: { checkedAtMs: Date.now() } }
    },
  }
}

export interface RequiredAdapterCheck {
  readonly name: string
  isAvailable(): boolean | Promise<boolean>
}

export interface ReadinessOptions {
  readonly configuration: ConfigurationReader
  readonly requiredConfigurationKeys?: ReadonlyArray<string>
  readonly requiredAdapters?: ReadonlyArray<RequiredAdapterCheck>
}

/** Builds a {@link ReadinessCheck} from required configuration keys and mandatory-adapter availability probes. */
export function createReadinessCheck(options: ReadinessOptions): ReadinessCheck {
  return {
    async check(): Promise<ReadinessStatus> {
      const missingConfigurationKeys: string[] = []
      for (const key of options.requiredConfigurationKeys ?? []) {
        if (options.configuration.get(key) === undefined) missingConfigurationKeys.push(key)
      }
      const unavailableAdapters: string[] = []
      for (const adapter of options.requiredAdapters ?? []) {
        const available = await adapter.isAvailable()
        if (!available) unavailableAdapters.push(adapter.name)
      }
      const ready = missingConfigurationKeys.length === 0 && unavailableAdapters.length === 0
      return ready ? { ready: true } : { ready: false, details: { missingConfigurationKeys, unavailableAdapters } }
    },
  }
}
