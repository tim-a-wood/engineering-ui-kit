/**
 * Typed Electron IPC channel contract (§10.3). Browser-safe: no `node:*` or
 * `electron` import — this module only defines channel names, the request
 * envelope shapes, and their schema validators, so both the renderer
 * (`./renderer.js`) and the main process (`./main-handler.js`) depend on the
 * same contract without either importing the other's runtime.
 */

import { AjvValidator, createAjv2020 } from '../validation.js'
import type { Validator, ValidationResult } from '../validation.js'
import type { Outcome } from '../outcome.js'

/** `ipcRenderer.invoke`/`ipcMain.handle` channel carrying one operation call. */
export const CAPABILITIES_IPC_INVOKE_CHANNEL = 'engineering-ui-kit:capabilities:invoke'
/** `ipcRenderer.send`/`ipcMain.on` channel carrying a cancellation request for an in-flight call. */
export const CAPABILITIES_IPC_CANCEL_CHANNEL = 'engineering-ui-kit:capabilities:cancel'

/** One dispatch request crossing the Electron IPC boundary. */
export interface IpcOperationRequest {
  readonly operationCode: string
  readonly input: unknown
  readonly correlationId: string
}

/** Requests cancellation of the in-flight call identified by `correlationId`. */
export interface IpcCancelRequest {
  readonly correlationId: string
}

/**
 * The single typed surface a preload script exposes via
 * `contextBridge.exposeInMainWorld` (see `./preload.js`) — never a raw
 * `ipcRenderer` or other Node/Electron capability.
 */
export interface CapabilitiesIpcBridge {
  invoke(request: IpcOperationRequest): Promise<Outcome<unknown, unknown, unknown>>
  cancel(request: IpcCancelRequest): void
}

const ipcOperationRequestSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['operationCode', 'input', 'correlationId'],
  properties: {
    operationCode: { type: 'string', minLength: 1 },
    input: {},
    correlationId: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
} as const

const ipcCancelRequestSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['correlationId'],
  properties: {
    correlationId: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
} as const

const sharedAjv = createAjv2020()
const operationRequestValidator: Validator<IpcOperationRequest> = new AjvValidator(ipcOperationRequestSchema, sharedAjv)
const cancelRequestValidator: Validator<IpcCancelRequest> = new AjvValidator(ipcCancelRequestSchema, sharedAjv)

/** Validates an inbound `invoke` payload against {@link IpcOperationRequest}'s schema. */
export function validateIpcOperationRequest(value: unknown): ValidationResult<IpcOperationRequest> {
  return operationRequestValidator.validate(value)
}

/** Validates an inbound `cancel` payload against {@link IpcCancelRequest}'s schema. */
export function validateIpcCancelRequest(value: unknown): ValidationResult<IpcCancelRequest> {
  return cancelRequestValidator.validate(value)
}
