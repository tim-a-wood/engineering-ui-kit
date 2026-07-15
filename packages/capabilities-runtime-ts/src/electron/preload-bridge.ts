/**
 * Pure Electron preload bridge factory (§10.3): builds the single typed
 * surface (`invoke`/`cancel`) a preload script exposes via
 * `contextBridge.exposeInMainWorld`, given caller-supplied `invoke`/`send`
 * functions shaped like `ipcRenderer.invoke`/`ipcRenderer.send`.
 * Deliberately free of any `electron` import so it can be exercised by
 * tests — including asserting the exposed surface leaks no other
 * Node/Electron capability — without a real Electron runtime; `./preload.js`
 * wires this to the real `ipcRenderer`.
 */

import type { Outcome } from '../outcome.js'
import { CAPABILITIES_IPC_CANCEL_CHANNEL, CAPABILITIES_IPC_INVOKE_CHANNEL } from './channel.js'
import type { CapabilitiesIpcBridge, IpcCancelRequest, IpcOperationRequest } from './channel.js'

/** Shape of `ipcRenderer.invoke`. */
export type IpcInvokeFn = (channel: string, ...args: unknown[]) => Promise<unknown>
/** Shape of `ipcRenderer.send`. */
export type IpcSendFn = (channel: string, ...args: unknown[]) => void

/**
 * Builds the object a preload script exposes via `contextBridge`. The
 * returned object has exactly two members — `invoke` and `cancel` — never
 * the raw `invokeFn`/`sendFn` it was built from, so a renderer can never
 * reach `ipcRenderer.sendSync`, `ipcRenderer.on`, or any other
 * unrestricted IPC/Node capability through this surface.
 */
export function createCapabilitiesIpcBridge(invokeFn: IpcInvokeFn, sendFn: IpcSendFn): CapabilitiesIpcBridge {
  return {
    invoke(request: IpcOperationRequest): Promise<Outcome<unknown, unknown, unknown>> {
      return invokeFn(CAPABILITIES_IPC_INVOKE_CHANNEL, request) as Promise<Outcome<unknown, unknown, unknown>>
    },
    cancel(request: IpcCancelRequest): void {
      sendFn(CAPABILITIES_IPC_CANCEL_CHANNEL, request)
    },
  }
}
