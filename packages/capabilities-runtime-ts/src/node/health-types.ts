/**
 * Health/readiness protocol (§15.4). Liveness means the process event loop
 * is functioning; readiness means required configuration and mandatory
 * adapters are available. This module defines only the shared shapes so
 * `./node` HTTP hosts and the `./node` health helpers agree on a contract
 * without a circular dependency between them.
 */

export interface HealthStatus {
  readonly healthy: boolean
  readonly details?: Readonly<Record<string, unknown>>
}

export interface ReadinessStatus {
  readonly ready: boolean
  readonly details?: Readonly<Record<string, unknown>>
}

export interface HealthCheck {
  check(): HealthStatus | Promise<HealthStatus>
}

export interface ReadinessCheck {
  check(): ReadinessStatus | Promise<ReadinessStatus>
}

/** Always-healthy default: reaching this code at all proves the event loop is running. */
export const ALWAYS_HEALTHY: HealthCheck = {
  check(): HealthStatus {
    return { healthy: true }
  },
}

/** Always-ready default, used only when a host registers no readiness dependencies. */
export const ALWAYS_READY: ReadinessCheck = {
  check(): ReadinessStatus {
    return { ready: true }
  },
}
