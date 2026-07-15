/**
 * In-process browser transport for the React-web slice (§7.1, §10.3): the
 * "browser-local client wired to a composition root running a domain
 * operation in-process" the packet calls for. It implements the SAME
 * `Transport` protocol (`@engineering-ui-kit/capabilities-runtime/browser`)
 * a real fetch/WebSocket transport would, but instead of crossing a network
 * boundary it drives the composition root's registered operation through the
 * real `dispatch` boundary directly — the single-deployable-web-app
 * equivalent of `createNodeHttpHost` (`packages/capabilities-runtime-ts/src/node/http.ts`)
 * mapping an inbound request to `dispatch`. This module never imports
 * `greetOperation` or any domain code: it is purely operation-code-keyed
 * plumbing, reused for any operation the composition root registers.
 */
import {
  CancellationController,
  dispatch,
  NOOP_LOGGER,
  NOOP_TRACER,
  Outcome,
  type ConfigurationReader,
  type Context,
  type Operation,
  type SecretResolver,
} from '@engineering-ui-kit/capabilities-runtime'
import type { Transport, TransportRequest } from '@engineering-ui-kit/capabilities-runtime/browser'

export interface InProcessOperationEntry {
  readonly operationCode: string
  readonly operation: Operation<unknown, unknown, unknown, unknown>
}

export interface InProcessBrowserTransportOptions {
  readonly operations: ReadonlyArray<InProcessOperationEntry>
  readonly configuration: ConfigurationReader
  readonly secretResolver: SecretResolver
}

export const UNKNOWN_OPERATION_CODE = 'unknown-operation'

/**
 * A `Transport` that dispatches every call directly to an operation
 * resolved from the composition root, in the same JS process/heap as the
 * `useOperation` hook that triggered it — i.e. a real single-deployable UI
 * trigger reaching a real operation through the real `dispatch` boundary,
 * with no network hop.
 */
export class InProcessBrowserTransport implements Transport {
  private readonly operationsByCode: Map<string, Operation<unknown, unknown, unknown, unknown>>
  private readonly configuration: ConfigurationReader
  private readonly secretResolver: SecretResolver

  constructor(options: InProcessBrowserTransportOptions) {
    this.operationsByCode = new Map(options.operations.map((entry) => [entry.operationCode, entry.operation]))
    this.configuration = options.configuration
    this.secretResolver = options.secretResolver
  }

  async send<Success, DomainRejection = never, TechnicalFailure = never>(
    request: TransportRequest,
  ): Promise<Outcome<Success, DomainRejection, TechnicalFailure>> {
    const operation = this.operationsByCode.get(request.operationCode)
    if (!operation) {
      return Outcome.failed<TechnicalFailure>(
        UNKNOWN_OPERATION_CODE,
        `No operation is registered for "${request.operationCode}".`,
        false,
      )
    }

    if (request.signal?.aborted) {
      return Outcome.cancelled('aborted-before-dispatch')
    }

    const cancellation = new CancellationController()
    const onAbort = (): void => {
      const reason = request.signal?.reason
      cancellation.cancel(typeof reason === 'string' ? reason : 'aborted-by-caller')
    }
    request.signal?.addEventListener('abort', onAbort, { once: true })

    try {
      const context: Context = {
        correlationId: request.correlationId,
        cancellation,
        configuration: this.configuration,
        secretResolver: this.secretResolver,
        logger: NOOP_LOGGER,
        tracer: NOOP_TRACER,
      }
      const outcome = await dispatch(operation, request.input, context)
      return outcome as Outcome<Success, DomainRejection, TechnicalFailure>
    } finally {
      request.signal?.removeEventListener('abort', onAbort)
    }
  }
}
