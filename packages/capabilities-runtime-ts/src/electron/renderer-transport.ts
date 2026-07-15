/**
 * Electron renderer-side transport (§10.3): a browser-safe `Transport`
 * (`../browser/transport.js`) implementation that sends every dispatch
 * request over the typed {@link CapabilitiesIpcBridge} a preload script
 * exposed via `contextBridge` — never a raw `ipcRenderer`/Node capability.
 * No `node:*`/`electron` import: this module only depends on the bridge's
 * structural shape, so it typechecks and runs identically whether `bridge`
 * is the real `window.capabilitiesIpc` or a test double.
 */

import type { Outcome } from '../outcome.js'
import type { Transport, TransportRequest } from '../browser/transport.js'
import type { CapabilitiesIpcBridge } from './channel.js'

export interface ElectronRendererTransportOptions {
  readonly bridge: CapabilitiesIpcBridge
}

/**
 * A `Transport` that forwards every call to the preload-exposed
 * `CapabilitiesIpcBridge`, propagating the correlation id and, on abort,
 * asking the main process to cancel the in-flight call.
 */
export class ElectronRendererTransport implements Transport {
  private readonly bridge: CapabilitiesIpcBridge

  constructor(options: ElectronRendererTransportOptions) {
    this.bridge = options.bridge
  }

  async send<Success, DomainRejection = never, TechnicalFailure = never>(
    request: TransportRequest,
  ): Promise<Outcome<Success, DomainRejection, TechnicalFailure>> {
    if (request.signal?.aborted) {
      return { kind: 'cancelled', reason: 'aborted-before-send' }
    }

    const onAbort = (): void => {
      this.bridge.cancel({ correlationId: request.correlationId })
    }
    request.signal?.addEventListener('abort', onAbort, { once: true })
    try {
      const outcome = await this.bridge.invoke({
        operationCode: request.operationCode,
        input: request.input,
        correlationId: request.correlationId,
      })
      return outcome as Outcome<Success, DomainRejection, TechnicalFailure>
    } finally {
      request.signal?.removeEventListener('abort', onAbort)
    }
  }
}
