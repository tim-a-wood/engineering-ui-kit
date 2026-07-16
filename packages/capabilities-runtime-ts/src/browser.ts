/**
 * @engineering-ui-kit/capabilities-runtime/browser — browser-safe
 * dispatcher/client, configuration boundary, and correlation propagation
 * (§7.1, §10.3).
 *
 * Browser-safe only: this module and everything it imports MUST NOT import
 * `node:*` built-ins. React and Electron adapters are delivered by a later
 * package increment; this module contains no framework-specific code.
 */

export type { Transport, TransportRequest } from './browser/transport.js'
export type { OperationCallOptions, OperationClientOptions } from './browser/client.js'
export { OperationClient } from './browser/client.js'
export { BrowserConfigurationReader, readBrowserConfigurationFromGlobal } from './browser/configuration.js'
export { createCorrelationId, CORRELATION_ID_HEADER } from './browser/correlation.js'
export { BrowserLocalTransport } from './browser/local-transport.js'
export type { BrowserLocalOperation, BrowserLocalTransportOptions } from './browser/local-transport.js'
