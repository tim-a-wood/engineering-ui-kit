/**
 * Shared helper for building a per-request/job {@link Context} from Node
 * host adapters (HTTP, CLI, scheduled worker). Framework-neutral defaults
 * (`NEVER_CANCELLED`, `NOOP_LOGGER`, `NOOP_TRACER`) apply whenever a host
 * does not override them.
 */

import type { AuthorizationHook, Context, Principal } from '../context.js'
import type { CancellationToken } from '../cancellation.js'
import { NEVER_CANCELLED } from '../cancellation.js'
import type { Clock } from '../clock.js'
import type { ConfigurationReader } from '../configuration.js'
import type { SecretResolver } from '../secrets.js'
import type { Logger, Tracer } from '../telemetry.js'
import { NOOP_LOGGER, NOOP_TRACER } from '../telemetry.js'

export interface NodeContextOptions {
  readonly correlationId: string
  readonly configuration: ConfigurationReader
  readonly secretResolver: SecretResolver
  readonly cancellation?: CancellationToken
  readonly deadline?: number
  readonly principal?: Principal
  readonly authorization?: AuthorizationHook
  readonly logger?: Logger
  readonly tracer?: Tracer
  readonly clock?: Clock
}

export function createNodeContext(options: NodeContextOptions): Context {
  return {
    correlationId: options.correlationId,
    cancellation: options.cancellation ?? NEVER_CANCELLED,
    deadline: options.deadline,
    principal: options.principal,
    authorization: options.authorization,
    configuration: options.configuration,
    secretResolver: options.secretResolver,
    logger: options.logger ?? NOOP_LOGGER,
    tracer: options.tracer ?? NOOP_TRACER,
    clock: options.clock,
  }
}
