/**
 * @engineering-ui-kit/capabilities-runtime/electron/main — Electron
 * main-process wiring (§10.3). Registers the typed IPC contract
 * (`./channel.js`) against the real `ipcMain`, delegating all
 * validation/dispatch logic to the framework-neutral
 * `createCapabilitiesIpcMainHandler` (`./main-handler.js`). Node/Electron
 * entry point — the only file under `./electron` that touches the real
 * `ipcMain` global, so it cannot be exercised outside a running Electron
 * main process; `./main-handler.js` carries the tested logic (a real
 * end-to-end Electron run is deferred to a later, environment-backed
 * verification pass).
 */

import { ipcMain } from 'electron'
import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron'

import { CAPABILITIES_IPC_CANCEL_CHANNEL, CAPABILITIES_IPC_INVOKE_CHANNEL } from './channel.js'
import type {
  CapabilitiesIpcMainHandler,
  CapabilitiesIpcMainHandlerOptions,
  ElectronIpcOperation,
} from './main-handler.js'
import { createCapabilitiesIpcMainHandler } from './main-handler.js'

export type { CapabilitiesIpcMainHandlerOptions, ElectronIpcOperation, CapabilitiesIpcMainHandler }

export interface ElectronMainIpcHost {
  readonly handler: CapabilitiesIpcMainHandler
  /** Removes the registered `ipcMain` listeners and cancels any in-flight calls. */
  dispose(): void
}

/** Registers the typed invoke/cancel listeners on the real `ipcMain`, wiring them to `dispatch`. */
export function registerCapabilitiesIpcHost(options: CapabilitiesIpcMainHandlerOptions): ElectronMainIpcHost {
  const handler = createCapabilitiesIpcMainHandler(options)

  const onInvoke = (_event: IpcMainInvokeEvent, rawRequest: unknown): Promise<unknown> => handler.handleInvoke(rawRequest)
  const onCancel = (_event: IpcMainEvent, rawRequest: unknown): void => handler.handleCancel(rawRequest)

  ipcMain.handle(CAPABILITIES_IPC_INVOKE_CHANNEL, onInvoke)
  ipcMain.on(CAPABILITIES_IPC_CANCEL_CHANNEL, onCancel)

  return {
    handler,
    dispose(): void {
      ipcMain.removeHandler(CAPABILITIES_IPC_INVOKE_CHANNEL)
      ipcMain.off(CAPABILITIES_IPC_CANCEL_CHANNEL, onCancel)
      handler.cancelAll('host-disposed')
    },
  }
}
