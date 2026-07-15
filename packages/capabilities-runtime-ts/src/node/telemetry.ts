/**
 * JSON console telemetry sink (§15.4). The default standalone `Logger`
 * implementation for Node hosts: one JSON object per line, tagged with the
 * active request/job correlation id (via `AsyncLocalStorage`) when one is
 * in scope. No secret values are ever accepted as first-class fields by
 * this module — callers are responsible for passing only redaction-safe
 * structured detail (per §15.1).
 */

import type { Logger } from '../telemetry.js'
import type { TelemetrySink } from './lifecycle.js'
import { currentCorrelationId } from './correlation.js'

export interface WritableStream {
  write(chunk: string): unknown
}

export interface JsonConsoleLoggerOptions {
  /** Defaults to `process.stdout`. */
  readonly stream?: WritableStream
  readonly service?: string
}

function writeRecord(
  stream: WritableStream,
  level: string,
  message: string,
  fields: Readonly<Record<string, unknown>> | undefined,
  service: string | undefined,
): void {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    message,
    correlationId: currentCorrelationId(),
    ...(service !== undefined ? { service } : {}),
    ...fields,
  }
  stream.write(`${JSON.stringify(record)}\n`)
}

/** JSON-lines console logger; the default standalone telemetry sink for Node hosts. */
export class JsonConsoleLogger implements Logger {
  private readonly stream: WritableStream
  private readonly service: string | undefined

  constructor(options: JsonConsoleLoggerOptions = {}) {
    this.stream = options.stream ?? process.stdout
    this.service = options.service
  }

  debug(message: string, fields?: Readonly<Record<string, unknown>>): void {
    writeRecord(this.stream, 'debug', message, fields, this.service)
  }

  info(message: string, fields?: Readonly<Record<string, unknown>>): void {
    writeRecord(this.stream, 'info', message, fields, this.service)
  }

  warn(message: string, fields?: Readonly<Record<string, unknown>>): void {
    writeRecord(this.stream, 'warn', message, fields, this.service)
  }

  error(message: string, fields?: Readonly<Record<string, unknown>>): void {
    writeRecord(this.stream, 'error', message, fields, this.service)
  }
}

/**
 * A {@link TelemetrySink} for {@link ProcessLifecycle}. Console writes are
 * effectively synchronous for the standalone JSON sink, so `flush()` is a
 * no-op today; the hook exists so a future buffering/batching sink can
 * implement real flush semantics without changing the `ProcessLifecycle`
 * contract.
 */
export class JsonConsoleTelemetrySink implements TelemetrySink {
  async flush(): Promise<void> {
    // Nothing to flush: see class doc.
  }
}
