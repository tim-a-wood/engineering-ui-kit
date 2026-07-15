/**
 * Framework-neutral logger/tracer hooks referenced by {@link Context}. Host
 * packages (Node/browser) supply real implementations; this package only
 * defines the protocol plus no-op defaults so core code and tests never
 * need a host telemetry dependency.
 */

export interface Logger {
  debug(message: string, fields?: Readonly<Record<string, unknown>>): void
  info(message: string, fields?: Readonly<Record<string, unknown>>): void
  warn(message: string, fields?: Readonly<Record<string, unknown>>): void
  error(message: string, fields?: Readonly<Record<string, unknown>>): void
}

export interface Span {
  end(fields?: Readonly<Record<string, unknown>>): void
  recordException(error: unknown): void
}

export interface Tracer {
  startSpan(name: string, fields?: Readonly<Record<string, unknown>>): Span
}

export const NOOP_LOGGER: Logger = {
  debug(): void {},
  info(): void {},
  warn(): void {},
  error(): void {},
}

const NOOP_SPAN: Span = {
  end(): void {},
  recordException(): void {},
}

export const NOOP_TRACER: Tracer = {
  startSpan(): Span {
    return NOOP_SPAN
  },
}
