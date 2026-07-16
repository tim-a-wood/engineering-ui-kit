import { CancellationController } from '../cancellation.js'
import { SYSTEM_CLOCK } from '../clock.js'
import { MapConfigurationReader } from '../configuration.js'
import type { Context } from '../context.js'
import { dispatch } from '../dispatch.js'
import type { Operation } from '../operation.js'
import type { Outcome } from '../outcome.js'
import type { SecretReference, SecretResolver } from '../secrets.js'
import { NOOP_LOGGER } from '../telemetry.js'
import type { Transport, TransportRequest } from './transport.js'

export type BrowserLocalOperation = {
  operationCode: string
  operation: Operation<unknown, unknown, unknown, unknown>
}

export type BrowserLocalTransportOptions = {
  operations: ReadonlyArray<BrowserLocalOperation>
  configuration?: Readonly<Record<string, string>>
  onInvocationComplete?: (evidence: {
    request: TransportRequest
    outcome: Outcome<unknown, unknown, unknown>
  }) => Promise<void> | void
  observedPath?: {
    inboundAdapter: string
    compositionRoot: string
    operation: string
    outboundAdapters: ReadonlyArray<string>
  }
}

/** Executes an approved operation locally in the browser without a network or Node boundary. */
export class BrowserLocalTransport implements Transport {
  private readonly operations: ReadonlyMap<string, Operation<unknown, unknown, unknown, unknown>>
  constructor(private readonly options: BrowserLocalTransportOptions) {
    this.operations = new Map(options.operations.map((entry) => [entry.operationCode, entry.operation]))
  }

  async send<Success, DomainRejection = never, TechnicalFailure = never>(
    request: TransportRequest,
  ): Promise<Outcome<Success, DomainRejection, TechnicalFailure>> {
    const operation = this.operations.get(request.operationCode)
    if (!operation) return { kind: 'failed', code: 'unknown-operation', safeMessage: 'The requested capability is unavailable.', retryable: false }
    const cancellation = new CancellationController()
    const onAbort = () => cancellation.cancel('browser-request-aborted')
    request.signal?.addEventListener('abort', onAbort, { once: true })
    const secretResolver: SecretResolver = {
      resolve(reference: SecretReference): never {
        throw new Error(`Browser-local secret reference cannot be resolved: ${reference.ref}`)
      },
    }
    const context: Context = {
      correlationId: request.correlationId,
      cancellation,
      configuration: new MapConfigurationReader(this.options.configuration),
      secretResolver,
      logger: NOOP_LOGGER,
      clock: SYSTEM_CLOCK,
    }
    try {
      const outcome = await dispatch(operation, request.input, context)
      await this.options.onInvocationComplete?.({ request, outcome })
      const browserGlobal = globalThis as unknown as {
        dispatchEvent?: (event: unknown) => boolean
        CustomEvent?: new (type: string, init: { detail: unknown }) => unknown
      }
      if (outcome.kind === 'success' && this.options.observedPath && browserGlobal.dispatchEvent && browserGlobal.CustomEvent) {
        browserGlobal.dispatchEvent(new browserGlobal.CustomEvent('euik-capability-invoked', { detail: {
          correlationId: request.correlationId,
          operation: request.operationCode,
          observedPath: this.options.observedPath,
        } }))
      }
      return outcome as Outcome<Success, DomainRejection, TechnicalFailure>
    } finally {
      request.signal?.removeEventListener('abort', onAbort)
    }
  }
}
