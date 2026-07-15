/**
 * Pure Electron main-process IPC handler logic (§10.3): validates the
 * request envelope, looks up the target operation in a caller-supplied
 * registry, and drives it through the framework-neutral `dispatch`
 * boundary (`../dispatch.js`) — propagating correlation and honoring
 * renderer-initiated cancellation. Deliberately free of any `electron`
 * import so it can be exercised by tests without a real Electron runtime;
 * `./main.js` wires this logic to the real `ipcMain`.
 */

import { CancellationController } from '../cancellation.js'
import type { Context } from '../context.js'
import { dispatch } from '../dispatch.js'
import type { Operation } from '../operation.js'
import { Outcome } from '../outcome.js'
import type { ConfigurationReader } from '../configuration.js'
import type { SecretResolver } from '../secrets.js'
import type { Logger, Tracer } from '../telemetry.js'
import { NOOP_LOGGER, NOOP_TRACER } from '../telemetry.js'
import { createNodeContext } from '../node/context.js'
import { validateIpcCancelRequest, validateIpcOperationRequest } from './channel.js'

/** One operation registered against the Electron IPC host, keyed by its `operationCode`. */
export interface ElectronIpcOperation {
  readonly operationCode: string
  readonly operation: Operation<unknown, unknown, unknown, unknown>
}

export interface CapabilitiesIpcMainHandlerOptions {
  readonly operations: ReadonlyArray<ElectronIpcOperation>
  readonly configuration: ConfigurationReader
  readonly secretResolver: SecretResolver
  readonly logger?: Logger
  readonly tracer?: Tracer
}

export const IPC_BAD_REQUEST_CODE = 'invalid-ipc-request'
export const IPC_UNKNOWN_OPERATION_CODE = 'unknown-operation'
export const IPC_UNHANDLED_EXCEPTION_CODE = 'unhandled-exception'

export interface CapabilitiesIpcMainHandler {
  /** Handles one `invoke` call, mirroring the shape `ipcMain.handle`'s listener expects. */
  handleInvoke(rawRequest: unknown): Promise<Outcome<unknown, unknown, unknown>>
  /** Handles one `cancel` message, mirroring `ipcMain.on`'s listener. */
  handleCancel(rawRequest: unknown): void
  /** Number of calls currently in flight (test/diagnostic hook). */
  readonly inFlightCount: number
  /** Cancels every in-flight call, e.g. on host shutdown. */
  cancelAll(reason: string): void
}

/**
 * Builds the pure invoke/cancel handler pair used by both
 * `./main.js` (wired to the real `ipcMain`) and tests (driven directly).
 */
export function createCapabilitiesIpcMainHandler(
  options: CapabilitiesIpcMainHandlerOptions,
): CapabilitiesIpcMainHandler {
  const logger = options.logger ?? NOOP_LOGGER
  const tracer = options.tracer ?? NOOP_TRACER
  const operationsByCode = new Map(options.operations.map((entry) => [entry.operationCode, entry.operation]))
  const inFlight = new Map<string, CancellationController>()

  return {
    get inFlightCount(): number {
      return inFlight.size
    },

    async handleInvoke(rawRequest: unknown): Promise<Outcome<unknown, unknown, unknown>> {
      const validation = validateIpcOperationRequest(rawRequest)
      if (!validation.valid || !validation.value) {
        return Outcome.failed(IPC_BAD_REQUEST_CODE, 'The IPC request did not match the expected shape.', false)
      }
      const request = validation.value
      const operation = operationsByCode.get(request.operationCode)
      if (!operation) {
        return Outcome.failed(
          IPC_UNKNOWN_OPERATION_CODE,
          `No operation is registered for "${request.operationCode}".`,
          false,
        )
      }

      const cancellation = new CancellationController()
      inFlight.set(request.correlationId, cancellation)
      const span = tracer.startSpan(`electron-ipc ${request.operationCode}`, { correlationId: request.correlationId })
      try {
        const context: Context = createNodeContext({
          correlationId: request.correlationId,
          configuration: options.configuration,
          secretResolver: options.secretResolver,
          cancellation,
          logger,
          tracer,
        })
        return await dispatch(operation, request.input, context)
      } catch (error) {
        logger.error('unhandled exception in Electron IPC host', {
          correlationId: request.correlationId,
          error: String(error),
        })
        return Outcome.failed(
          IPC_UNHANDLED_EXCEPTION_CODE,
          'An unexpected error occurred while executing the operation.',
          false,
        )
      } finally {
        span.end()
        inFlight.delete(request.correlationId)
      }
    },

    handleCancel(rawRequest: unknown): void {
      const validation = validateIpcCancelRequest(rawRequest)
      if (!validation.valid || !validation.value) return
      inFlight.get(validation.value.correlationId)?.cancel('renderer-requested-cancel')
    },

    cancelAll(reason: string): void {
      for (const controller of inFlight.values()) controller.cancel(reason)
      inFlight.clear()
    },
  }
}
