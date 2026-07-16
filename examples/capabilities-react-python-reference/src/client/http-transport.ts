/**
 * A REAL HTTP `Transport` (`@engineering-ui-kit/capabilities-runtime/browser`)
 * that speaks the generated OpenAPI boundary (`../generation/generate-openapi.js`)
 * over the network to a live Python `HttpOperationHost` process
 * (`../../src/capabilities_react_python_reference/http_app.py`) — the
 * cross-process/cross-language counterpart to
 * `examples/capabilities-react-reference/react-web/src/browser-transport.ts`'s
 * in-process transport.
 *
 * Framework-neutral and operation-code-keyed, exactly like
 * `InProcessBrowserTransport`: this module never imports
 * `PlaceOrderOperation` or any Python code — it only knows how to map ONE
 * named operation code to an HTTP `method`/`path` pair and translate the
 * Python host's JSON `Outcome` envelope (`kind`/`value`/`code`/`details`,
 * see `runtimes/python/src/engineering_ui_capabilities_runtime/http/mapping.py`
 * `outcome_envelope`) back into the runtime's typed `Outcome`. Uses the
 * platform `fetch` (global since Node 18) — the same real network call a
 * browser would make, just against `127.0.0.1` instead of a bundler dev
 * server proxy.
 */
import { Outcome } from '@engineering-ui-kit/capabilities-runtime'
import type { Transport, TransportRequest } from '@engineering-ui-kit/capabilities-runtime/browser'

export interface HttpOperationRoute {
  readonly operationCode: string
  readonly method: string
  readonly path: string
}

export interface PythonHttpTransportOptions {
  /** e.g. `http://127.0.0.1:51234` — no trailing slash. */
  readonly baseUrl: string
  readonly routes: ReadonlyArray<HttpOperationRoute>
}

export const UNKNOWN_OPERATION_CODE = 'unknown-operation'

/** The raw JSON envelope shape `outcome_envelope` (Python side) serializes. */
interface PythonOutcomeEnvelope {
  readonly kind: 'success' | 'rejected' | 'failed' | 'cancelled' | 'timed_out'
  readonly value?: unknown
  readonly code?: string
  readonly details?: unknown
  readonly safe_message?: string
  readonly retryable?: boolean
  readonly cause_ref?: string
  readonly reason?: string
  readonly deadline?: string
}

/**
 * Translates the Python host's wire envelope into the runtime's typed
 * `Outcome`. `success`/`rejected` fields (`kind`/`value`/`code`/`details`)
 * are already named identically on both sides
 * (`runtimes/python/.../http/mapping.py` vs.
 * `packages/capabilities-runtime-ts/src/outcome.ts`); only the less
 * commonly exercised `failed`/`timed_out` kinds need a snake_case ->
 * camelCase field rename, handled here defensively even though this
 * example's `PlaceOrderOperation` never returns them.
 */
export function mapPythonEnvelopeToOutcome<Success, DomainRejection, TechnicalFailure>(
  envelope: PythonOutcomeEnvelope,
): Outcome<Success, DomainRejection, TechnicalFailure> {
  switch (envelope.kind) {
    case 'success':
      return Outcome.success(envelope.value as Success)
    case 'rejected':
      return Outcome.rejected(envelope.code ?? 'unknown', envelope.details as DomainRejection)
    case 'failed':
      return Outcome.failed<TechnicalFailure>(
        envelope.code ?? 'unknown',
        envelope.safe_message ?? 'An unexpected error occurred.',
        envelope.retryable ?? false,
        envelope.cause_ref,
      )
    case 'cancelled':
      return Outcome.cancelled(envelope.reason ?? 'cancelled')
    case 'timed_out':
      return Outcome.timedOut(Date.parse(envelope.deadline ?? '') || Date.now())
  }
}

/**
 * A `Transport` that sends every call as a REAL `fetch()` HTTP request to
 * the live Python host at `baseUrl`, mapping `request.operationCode` to
 * the HTTP `method`/`path` the generated OpenAPI document (and the
 * Python-side `HttpInboundBinding`) declare for it.
 */
export class PythonHttpTransport implements Transport {
  private readonly baseUrl: string
  private readonly routesByCode: Map<string, HttpOperationRoute>

  constructor(options: PythonHttpTransportOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    this.routesByCode = new Map(options.routes.map((route) => [route.operationCode, route]))
  }

  async send<Success, DomainRejection = never, TechnicalFailure = never>(
    request: TransportRequest,
  ): Promise<Outcome<Success, DomainRejection, TechnicalFailure>> {
    const route = this.routesByCode.get(request.operationCode)
    if (!route) {
      return Outcome.failed<TechnicalFailure>(
        UNKNOWN_OPERATION_CODE,
        `No HTTP route is registered for operation "${request.operationCode}".`,
        false,
      )
    }

    if (request.signal?.aborted) {
      return Outcome.cancelled(reasonFromSignal(request.signal))
    }

    const performRequest = async (): Promise<Outcome<Success, DomainRejection, TechnicalFailure>> => {
      // Deliberately NOT forwarding `request.signal` into fetch's own
      // `signal` option: `request.signal` is whatever `AbortSignal`
      // implementation the CALLER's realm constructs (e.g. the runtime's
      // `OperationController`, via the ambient `AbortController`), which
      // is not guaranteed to be the exact class this transport's `fetch`
      // implementation recognizes (its WHATWG IDL binding validates the
      // signal's brand, not just its shape) — most concretely when a
      // caller is rendered under a DOM-emulation test environment
      // (`jsdom`) that installs its own `AbortController`/`AbortSignal`,
      // distinct from the one the Node `fetch` implementation expects.
      // Cancellation is instead bridged manually below, so a caller-side
      // abort is always honored (the caller stops waiting immediately),
      // independent of which realm produced its `AbortSignal`.
      const response = await fetch(`${this.baseUrl}${route.path}`, {
        method: route.method,
        headers: {
          'content-type': 'application/json',
          ...request.headers,
        },
        body: JSON.stringify(request.input),
      })
      const envelope = (await response.json()) as PythonOutcomeEnvelope
      return mapPythonEnvelopeToOutcome<Success, DomainRejection, TechnicalFailure>(envelope)
    }

    const signal = request.signal
    if (!signal) {
      return performRequest()
    }

    return new Promise((resolve, reject) => {
      const onAbort = (): void => {
        resolve(Outcome.cancelled(reasonFromSignal(signal)))
      }
      signal.addEventListener('abort', onAbort, { once: true })
      performRequest().then(
        (outcome) => {
          signal.removeEventListener('abort', onAbort)
          resolve(outcome)
        },
        (error: unknown) => {
          signal.removeEventListener('abort', onAbort)
          reject(error)
        },
      )
    })
  }
}

function reasonFromSignal(signal: AbortSignal): string {
  return typeof signal.reason === 'string' ? signal.reason : 'aborted-by-caller'
}
