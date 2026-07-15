/**
 * Node correlation-id generation and per-request/job propagation via
 * `AsyncLocalStorage` (§15.4). Every inbound Node adapter (HTTP, CLI,
 * scheduled worker) runs its work inside {@link runWithCorrelationId} so
 * host-supplied loggers can attach the active correlation id without every
 * call site threading it through explicitly.
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'

export const CORRELATION_ID_HEADER = 'x-correlation-id'

const storage = new AsyncLocalStorage<string>()

/** Generates a new correlation id (RFC 4122 v4, via `node:crypto`). */
export function createCorrelationId(): string {
  return randomUUID()
}

/** Returns the correlation id for the currently running request/job scope, if any. */
export function currentCorrelationId(): string | undefined {
  return storage.getStore()
}

/** Runs `fn` with `correlationId` bound as the active scope's correlation id. */
export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  return storage.run(correlationId, fn)
}
