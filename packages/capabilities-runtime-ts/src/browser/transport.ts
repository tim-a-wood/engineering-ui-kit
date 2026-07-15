/**
 * Browser-safe transport boundary (§7.1, §10.3). A `Transport` is the thing
 * that actually crosses the network (fetch, WebSocket, IPC bridge, ...); the
 * `./browser` module defines only the protocol so callers can inject a real
 * implementation without this package importing `node:*` or any concrete
 * transport library.
 */

import type { Outcome } from '../outcome.js'

/** A single dispatch request crossing the transport boundary. */
export interface TransportRequest {
  readonly operationCode: string
  readonly input: unknown
  readonly correlationId: string
  readonly headers?: Readonly<Record<string, string>>
  /** Optional AbortSignal so the caller can cancel an in-flight transport call. */
  readonly signal?: AbortSignal
}

/**
 * Sends a {@link TransportRequest} and resolves to the {@link Outcome} the
 * remote inbound adapter produced. Implementations MUST NOT throw for a
 * domain rejection or technical failure — those are returned values — but
 * MAY throw for a transport-level defect the caller did not anticipate
 * (e.g. malformed response body), which `OperationClient` will surface as a
 * `failed` outcome.
 */
export interface Transport {
  send<Success, DomainRejection = never, TechnicalFailure = never>(
    request: TransportRequest,
  ): Promise<Outcome<Success, DomainRejection, TechnicalFailure>>
}
