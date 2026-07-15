/**
 * Electron renderer-side wiring for the Electron slice: browser-safe, no
 * `node:*`/`electron` import — builds a real `OperationClient`
 * (`@engineering-ui-kit/capabilities-runtime/browser`, frozen) over the
 * REAL `ElectronRendererTransport` (`@engineering-ui-kit/capabilities-runtime/electron/renderer`,
 * frozen), which forwards every call to whatever `CapabilitiesIpcBridge` it
 * is given — in production, the preload-exposed `window.capabilitiesIpc`;
 * in the IPC end-to-end test, a bridge built the same way the real preload
 * script builds one, driving a fake (but faithfully-typed and
 * JSON-round-tripped) `ipcRenderer.invoke`/`ipcMain.handle` wire.
 */
import { OperationClient } from '@engineering-ui-kit/capabilities-runtime/browser'
import { ElectronRendererTransport } from '@engineering-ui-kit/capabilities-runtime/electron/renderer'
import type { CapabilitiesIpcBridge } from '@engineering-ui-kit/capabilities-runtime/electron/renderer'

/** Builds an `OperationClient` that sends every call over `bridge`. */
export function createElectronRendererClient(bridge: CapabilitiesIpcBridge): OperationClient {
  const transport = new ElectronRendererTransport({ bridge })
  return new OperationClient({ transport })
}

/**
 * Real-renderer convenience: reads the preload-exposed bridge off
 * `window.capabilitiesIpc`. Not used by the IPC end-to-end test (which
 * injects its own bridge directly); only type-checked here, since `window`
 * is only defined in a real browser/Electron-renderer or jsdom context.
 */
declare global {
  interface Window {
    readonly capabilitiesIpc?: CapabilitiesIpcBridge
  }
}

export function createElectronRendererClientFromWindow(): OperationClient {
  const bridge = window.capabilitiesIpc
  if (!bridge) {
    throw new Error(
      'window.capabilitiesIpc is not defined — ensure the preload script called installCapabilitiesPreloadBridge().',
    )
  }
  return createElectronRendererClient(bridge)
}
