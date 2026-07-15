/**
 * @engineering-ui-kit/capabilities-runtime/electron/preload — Electron
 * preload wiring (§10.3). The only file under `./electron` that touches
 * `electron`'s `contextBridge`/`ipcRenderer` — never a `node:*` built-in —
 * and exposes exactly one typed surface, `capabilitiesIpc` (see
 * {@link CAPABILITIES_IPC_BRIDGE_GLOBAL}), to the renderer's isolated main
 * world. No raw `ipcRenderer` or other Node capability is exposed.
 *
 * Runs only inside an Electron preload script (with `contextIsolation`
 * enabled); it cannot be exercised outside a running Electron process, so
 * `./preload-bridge.js` carries the tested logic and this file is only
 * type-checked, not unit-tested (deferred to a real-Electron E2E harness).
 */

import { contextBridge, ipcRenderer } from 'electron'

import { createCapabilitiesIpcBridge } from './preload-bridge.js'

/** Global key the typed bridge is exposed under in the renderer's main world. */
export const CAPABILITIES_IPC_BRIDGE_GLOBAL = 'capabilitiesIpc'

/**
 * Exposes the typed `capabilitiesIpc` bridge on `globalKey` (default
 * {@link CAPABILITIES_IPC_BRIDGE_GLOBAL}) in the renderer's main world.
 * Call this once from the app's preload script.
 */
export function exposeCapabilitiesIpcBridge(globalKey: string = CAPABILITIES_IPC_BRIDGE_GLOBAL): void {
  const bridge = createCapabilitiesIpcBridge(
    (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    (channel, ...args) => ipcRenderer.send(channel, ...args),
  )
  contextBridge.exposeInMainWorld(globalKey, bridge)
}
