/**
 * @engineering-ui-kit/capabilities-runtime/electron/renderer — browser-safe
 * Electron renderer-side pieces (§10.3): the typed IPC channel contract and
 * a `Transport` that sends every call over a preload-exposed
 * `CapabilitiesIpcBridge`. No `node:*`/`electron` import — safe to bundle
 * into an Electron renderer (or, since it never touches Electron globals
 * directly, any browser-like target that supplies a compatible bridge).
 */

export {
  CAPABILITIES_IPC_INVOKE_CHANNEL,
  CAPABILITIES_IPC_CANCEL_CHANNEL,
  validateIpcOperationRequest,
  validateIpcCancelRequest,
} from './channel.js'
export type { IpcOperationRequest, IpcCancelRequest, CapabilitiesIpcBridge } from './channel.js'

export { ElectronRendererTransport } from './renderer-transport.js'
export type { ElectronRendererTransportOptions } from './renderer-transport.js'
