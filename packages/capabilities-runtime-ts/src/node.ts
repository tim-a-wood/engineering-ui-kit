/**
 * @engineering-ui-kit/capabilities-runtime/node — HTTP, CLI, scheduled
 * worker, process lifecycle, Node filesystem/process/HTTP adapter
 * foundations, JSON console telemetry, and health/readiness (§7.1, §10.3).
 *
 * Node-only: this module and everything it imports may use `node:*`
 * built-ins. It MUST NOT import `@engineering-ui-kit/core`, the desktop
 * package, or the GUI package — this runtime is standalone.
 */

export type { HealthStatus, ReadinessStatus, HealthCheck, ReadinessCheck } from './node/health-types.js'
export { ALWAYS_HEALTHY, ALWAYS_READY } from './node/health-types.js'

export type { NodeContextOptions } from './node/context.js'
export { createNodeContext } from './node/context.js'

export {
  CORRELATION_ID_HEADER,
  createCorrelationId,
  currentCorrelationId,
  runWithCorrelationId,
} from './node/correlation.js'

export type { HttpRoute, NodeHttpHostOptions, NodeHttpHost } from './node/http.js'
export { createNodeHttpHost } from './node/http.js'

export type { CliCommand, CliParseError, CliSignalSource, CliWritable, RunCliOptions } from './node/cli.js'
export {
  runCli,
  CLI_EXIT_SUCCESS,
  CLI_EXIT_USAGE_ERROR,
  CLI_EXIT_REJECTED,
  CLI_EXIT_FAILED,
  CLI_EXIT_TIMED_OUT,
  CLI_EXIT_CANCELLED_SIGINT,
  CLI_EXIT_CANCELLED_SIGTERM,
} from './node/cli.js'

export type { CronSchedule, ZonedParts } from './node/cron.js'
export { parseCron, zonedParts, nextRunAfter } from './node/cron.js'

export type {
  OverlapPolicy,
  MisfirePolicy,
  ScheduledJobDefinition,
  ScheduledWorkerOptions,
  TimerHandle,
  RunScheduledJobOnceOptions,
} from './node/schedule.js'
export { ScheduledWorker, runScheduledJobOnce } from './node/schedule.js'

export type { TelemetrySink, ProcessLifecycleOptions, ProcessStartResult } from './node/lifecycle.js'
export { ProcessLifecycle } from './node/lifecycle.js'

export type { HttpAdapterOptions, OutboundHttpRequest, OutboundHttpResponse } from './node/http-client.js'
export { NodeHttpClientAdapter, HttpAdapterError, redactHeaders } from './node/http-client.js'

export type { FilesystemAdapterOptions } from './node/filesystem.js'
export {
  NodeFilesystemAdapter,
  FilesystemPathError,
  FilesystemCapabilityError,
  resolveWithinRoot,
} from './node/filesystem.js'

export type { ProcessAdapterOptions, RunCommandRequest, RunCommandResult } from './node/process-adapter.js'
export { NodeProcessAdapter, ProcessAdapterError } from './node/process-adapter.js'

export type { PersistenceAdapter } from './node/persistence.js'
export { InMemoryPersistenceAdapter } from './node/persistence.js'

export type { WritableStream, JsonConsoleLoggerOptions } from './node/telemetry.js'
export { JsonConsoleLogger, JsonConsoleTelemetrySink } from './node/telemetry.js'

export type { RequiredAdapterCheck, ReadinessOptions } from './node/health.js'
export { createEventLoopHealthCheck, createReadinessCheck } from './node/health.js'
