/**
 * Raw `node:http` inbound adapter foundation (§7.1, §10.3, §15.4). Maps an
 * HTTP request to an {@link Operation} via {@link dispatch}, exposes
 * health/readiness routes, applies safe error mapping (no stack trace or
 * secret detail ever reaches the response body), propagates a correlation
 * id, and drains in-flight requests gracefully on `stop()`.
 *
 * This is a foundation, not a full framework: routing is exact
 * method+path matching. Generated code layers OpenAPI-driven routing and
 * request/response schema validation on top of this adapter.
 */

import type { Socket } from 'node:net'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'

import type { CancellationToken } from '../cancellation.js'
import { CancellationController } from '../cancellation.js'
import type { Context } from '../context.js'
import { dispatch } from '../dispatch.js'
import type { Operation } from '../operation.js'
import { Outcome } from '../outcome.js'
import type { ConfigurationReader } from '../configuration.js'
import type { SecretResolver } from '../secrets.js'
import type { Logger, Tracer } from '../telemetry.js'
import { NOOP_LOGGER, NOOP_TRACER } from '../telemetry.js'
import { createNodeContext } from './context.js'
import { CORRELATION_ID_HEADER, createCorrelationId, runWithCorrelationId } from './correlation.js'
import type { HealthCheck, ReadinessCheck } from './health-types.js'
import { ALWAYS_HEALTHY, ALWAYS_READY } from './health-types.js'

export interface HttpRoute {
  readonly method: string
  readonly path: string
  readonly operation: Operation<unknown, unknown, unknown, unknown>
}

export interface NodeHttpHostOptions {
  readonly routes: ReadonlyArray<HttpRoute>
  readonly configuration: ConfigurationReader
  readonly secretResolver: SecretResolver
  readonly logger?: Logger
  readonly tracer?: Tracer
  /** Route serving liveness. Defaults to `/health`. */
  readonly healthPath?: string
  /** Route serving readiness. Defaults to `/ready`. */
  readonly readinessPath?: string
  readonly health?: HealthCheck
  readonly readiness?: ReadinessCheck
  /** Bounds the request body read into memory. Defaults to 1 MiB. */
  readonly requestBodyLimitBytes?: number
  /** Grace period `stop()` waits for in-flight requests before forcibly closing sockets. Defaults to 5000ms. */
  readonly drainTimeoutMs?: number
}

export interface NodeHttpHost {
  readonly server: Server
  /** Starts listening; resolves with the actual bound port (useful when `port` is 0/ephemeral). */
  start(port?: number, host?: string): Promise<{ port: number }>
  /** Stops accepting new connections and waits (bounded by `drainTimeoutMs`) for in-flight requests to finish. */
  stop(): Promise<void>
}

const DEFAULT_BODY_LIMIT_BYTES = 1_048_576
const DEFAULT_DRAIN_TIMEOUT_MS = 5_000

function outcomeToResponse(outcome: Outcome<unknown, unknown, unknown>): { status: number; body: unknown } {
  if (Outcome.isSuccess(outcome)) {
    return { status: 200, body: { kind: 'success', value: outcome.value } }
  }
  if (Outcome.isRejected(outcome)) {
    return { status: 422, body: { kind: 'rejected', code: outcome.code, details: outcome.details } }
  }
  if (Outcome.isCancelled(outcome)) {
    return { status: 499, body: { kind: 'cancelled', reason: outcome.reason } }
  }
  if (Outcome.isTimedOut(outcome)) {
    return { status: 504, body: { kind: 'timedOut', deadline: outcome.deadline } }
  }
  // Failed: never include causeRef's referenced detail, only the opaque reference itself.
  return {
    status: 500,
    body: {
      kind: 'failed',
      code: outcome.code,
      safeMessage: outcome.safeMessage,
      retryable: outcome.retryable,
      causeRef: outcome.causeRef,
    },
  }
}

function matchRoute(routes: ReadonlyArray<HttpRoute>, method: string, path: string): HttpRoute | undefined {
  return routes.find((route) => route.method.toUpperCase() === method.toUpperCase() && route.path === path)
}

async function readBody(request: IncomingMessage, limitBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = []
  let received = 0
  return new Promise((resolve, reject) => {
    request.on('data', (chunk: Buffer) => {
      received += chunk.length
      if (received > limitBytes) {
        reject(new Error('request-body-too-large'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', (error) => reject(error))
  })
}

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload).toString(),
  })
  response.end(payload)
}

/** Creates a raw `node:http`-backed inbound adapter. Callers own `start`/`stop`. */
export function createNodeHttpHost(options: NodeHttpHostOptions): NodeHttpHost {
  const logger = options.logger ?? NOOP_LOGGER
  const tracer = options.tracer ?? NOOP_TRACER
  const healthPath = options.healthPath ?? '/health'
  const readinessPath = options.readinessPath ?? '/ready'
  const health = options.health ?? ALWAYS_HEALTHY
  const readiness = options.readiness ?? ALWAYS_READY
  const bodyLimit = options.requestBodyLimitBytes ?? DEFAULT_BODY_LIMIT_BYTES
  const drainTimeoutMs = options.drainTimeoutMs ?? DEFAULT_DRAIN_TIMEOUT_MS

  const sockets = new Set<Socket>()
  const inFlightControllers = new Set<CancellationController>()

  const server: Server = createServer((request: IncomingMessage, response: ServerResponse) => {
    void handleRequest(request, response)
  })

  server.on('connection', (socket: Socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })

  async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const method = request.method ?? 'GET'
    const url = new URL(request.url ?? '/', 'http://localhost')
    const path = url.pathname
    const incomingCorrelationId = request.headers[CORRELATION_ID_HEADER]
    const correlationId =
      (Array.isArray(incomingCorrelationId) ? incomingCorrelationId[0] : incomingCorrelationId) ??
      createCorrelationId()
    response.setHeader(CORRELATION_ID_HEADER, correlationId)

    await runWithCorrelationId(correlationId, async () => {
      if (method === 'GET' && path === healthPath) {
        const status = await health.check()
        writeJson(response, status.healthy ? 200 : 503, status)
        return
      }
      if (method === 'GET' && path === readinessPath) {
        const status = await readiness.check()
        writeJson(response, status.ready ? 200 : 503, status)
        return
      }

      const route = matchRoute(options.routes, method, path)
      if (!route) {
        writeJson(response, 404, { kind: 'not-found', method, path })
        return
      }

      let input: unknown
      try {
        const bodyBuffer = await readBody(request, bodyLimit)
        input = bodyBuffer.length === 0 ? undefined : JSON.parse(bodyBuffer.toString('utf8'))
      } catch (error) {
        const tooLarge = error instanceof Error && error.message === 'request-body-too-large'
        writeJson(response, tooLarge ? 413 : 400, {
          kind: 'bad-request',
          reason: tooLarge ? 'request body exceeds the configured limit' : 'request body is not valid JSON',
        })
        return
      }

      const cancellation = new CancellationController()
      inFlightControllers.add(cancellation)
      request.on('close', () => {
        if (!response.writableEnded) cancellation.cancel('client-disconnected')
      })

      const span = tracer.startSpan(`http ${method} ${path}`, { correlationId })
      try {
        const context: Context = createNodeContext({
          correlationId,
          configuration: options.configuration,
          secretResolver: options.secretResolver,
          cancellation,
          logger,
          tracer,
        })
        const outcome = await dispatch(route.operation, input, context)
        const { status, body } = outcomeToResponse(outcome)
        if (!response.writableEnded) writeJson(response, status, body)
      } catch (error) {
        logger.error('unhandled exception in HTTP host', { correlationId, error: String(error) })
        if (!response.writableEnded) {
          writeJson(response, 500, {
            kind: 'failed',
            code: 'unhandled-exception',
            safeMessage: 'An unexpected error occurred while executing the operation.',
            retryable: false,
          })
        }
      } finally {
        span.end()
        inFlightControllers.delete(cancellation)
      }
    })
  }

  return {
    server,
    start(port = 0, host = '127.0.0.1'): Promise<{ port: number }> {
      return new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, host, () => {
          server.removeListener('error', reject)
          const address = server.address()
          const boundPort = typeof address === 'object' && address !== null ? address.port : port
          resolve({ port: boundPort })
        })
      })
    },
    async stop(): Promise<void> {
      for (const controller of inFlightControllers) {
        controller.cancel('server-shutting-down')
      }
      const closePromise = new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
      const grace = setTimeout(() => {
        for (const socket of sockets) socket.destroy()
      }, drainTimeoutMs)
      const withUnref = grace as unknown as { unref?: () => void }
      if (typeof withUnref.unref === 'function') withUnref.unref()
      try {
        await closePromise
      } finally {
        clearTimeout(grace)
      }
    },
  }
}
