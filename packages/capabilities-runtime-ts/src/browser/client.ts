/**
 * Browser-safe dispatcher/client (§7.1, §10.3). `OperationClient` never
 * imports `node:*`: it calls a caller-injected {@link Transport} and never
 * reaches out to the network directly, so a real fetch/WebSocket/IPC-bridge
 * transport can be swapped in per host without this module changing.
 */

import type { Outcome } from '../outcome.js'
import { CORRELATION_ID_HEADER, createCorrelationId } from './correlation.js'
import type { Transport, TransportRequest } from './transport.js'

export interface OperationCallOptions {
  readonly correlationId?: string
  readonly headers?: Readonly<Record<string, string>>
  readonly signal?: AbortSignal
}

export interface OperationClientOptions {
  readonly transport: Transport
  /** Generates a correlation id per call when the caller does not supply one. Defaults to {@link createCorrelationId}. */
  readonly correlationIdFactory?: () => string
  readonly defaultHeaders?: Readonly<Record<string, string>>
}

/**
 * A framework-neutral client that dispatches a named operation through a
 * {@link Transport}, propagating (and, when absent, minting) a correlation
 * id on every call. This is the browser-side counterpart to the Node
 * `dispatch` boundary: it never runs `Operation.execute` itself, it only
 * shapes the request/response contract at the transport edge.
 */
export class OperationClient {
  private readonly transport: Transport
  private readonly correlationIdFactory: () => string
  private readonly defaultHeaders: Readonly<Record<string, string>>

  constructor(options: OperationClientOptions) {
    this.transport = options.transport
    this.correlationIdFactory = options.correlationIdFactory ?? createCorrelationId
    this.defaultHeaders = options.defaultHeaders ?? {}
  }

  async call<Success, DomainRejection = never, TechnicalFailure = never>(
    operationCode: string,
    input: unknown,
    options: OperationCallOptions = {},
  ): Promise<Outcome<Success, DomainRejection, TechnicalFailure>> {
    const correlationId = options.correlationId ?? this.correlationIdFactory()
    const request: TransportRequest = {
      operationCode,
      input,
      correlationId,
      headers: {
        ...this.defaultHeaders,
        [CORRELATION_ID_HEADER]: correlationId,
        ...options.headers,
      },
      signal: options.signal,
    }
    return this.transport.send<Success, DomainRejection, TechnicalFailure>(request)
  }
}
