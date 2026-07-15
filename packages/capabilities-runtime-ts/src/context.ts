import type { CancellationToken } from './cancellation.js'
import type { Clock } from './clock.js'
import type { ConfigurationReader } from './configuration.js'
import type { SecretResolver } from './secrets.js'
import type { Logger, Tracer } from './telemetry.js'

/** Authenticated caller identity, if any. Identity-provider integration is a host concern. */
export interface Principal {
  readonly id?: string
  readonly claims?: Readonly<Record<string, unknown>>
}

/**
 * Authorization hook (§15.2). Protected operations default to deny until a
 * hook is registered; the runtime defines the protocol only, never policy.
 */
export interface AuthorizationHook {
  isAuthorized(operationCode: string, principal: Principal | undefined): boolean | Promise<boolean>
}

/**
 * Per-dispatch execution context (§10.1). Framework-neutral: every field is
 * a protocol/hook, never a concrete Node/browser dependency.
 */
export interface Context {
  readonly correlationId: string
  readonly cancellation: CancellationToken
  /** Epoch-millisecond absolute deadline; absent means no deadline. */
  readonly deadline?: number
  readonly principal?: Principal
  readonly authorization?: AuthorizationHook
  readonly configuration: ConfigurationReader
  readonly secretResolver: SecretResolver
  readonly logger: Logger
  readonly tracer?: Tracer
  /** Injectable clock for deterministic deadline enforcement; defaults to the system clock. */
  readonly clock?: Clock
}
