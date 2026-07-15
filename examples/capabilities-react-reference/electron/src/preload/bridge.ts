/**
 * Electron preload entry point for the Electron slice: exposes exactly the
 * typed `capabilitiesIpc` surface via `contextBridge`, using the REAL
 * `exposeCapabilitiesIpcBridge` (`@engineering-ui-kit/capabilities-runtime/electron/preload`,
 * frozen) — never a raw `ipcRenderer` or other Node capability. No
 * `node:*` import in this file.
 *
 * This file touches the real `electron` module (via the runtime's
 * `electron/preload` subpath) and so cannot run outside a live Electron
 * preload script; it is exercised here only by `tsc --noEmit` (per the
 * packet, a real Electron process E2E is deferred to WP8).
 * `../../test/ipc-e2e.test.ts` proves the pure bridge-shape logic
 * (`createCapabilitiesIpcBridge`) this wraps, without needing a real
 * preload context.
 */
import { exposeCapabilitiesIpcBridge, CAPABILITIES_IPC_BRIDGE_GLOBAL } from '@engineering-ui-kit/capabilities-runtime/electron/preload'

export { CAPABILITIES_IPC_BRIDGE_GLOBAL }

/** Call once from the app's preload script to expose `window.capabilitiesIpc`. */
export function installCapabilitiesPreloadBridge(): void {
  exposeCapabilitiesIpcBridge()
}
