/**
 * Wires this slice's `OperationClient` (`@engineering-ui-kit/capabilities-runtime/browser`)
 * to a REAL `PythonHttpTransport` pointed at a live Python
 * `HttpOperationHost` process (CAP-ERA-001 §10.3). `PlaceOrderForm`
 * (`../react/PlaceOrderForm.tsx`) depends only on the resulting
 * `OperationClient` (via its `OperationCallable` duck type), never on this
 * composition root or the Python process directly.
 */
import { OperationClient } from '@engineering-ui-kit/capabilities-runtime/browser'

import { PLACE_ORDER_HTTP_METHOD, PLACE_ORDER_HTTP_PATH } from '../generation/contract.js'
import { PLACE_ORDER_OPERATION_CODE } from './types.js'
import { PythonHttpTransport } from './http-transport.js'

export interface ReactPythonApp {
  readonly client: OperationClient
}

/** Builds a fresh `OperationClient` wired to the live Python host at `baseUrl`. */
export function createReactPythonApp(baseUrl: string): ReactPythonApp {
  const transport = new PythonHttpTransport({
    baseUrl,
    routes: [{ operationCode: PLACE_ORDER_OPERATION_CODE, method: PLACE_ORDER_HTTP_METHOD, path: PLACE_ORDER_HTTP_PATH }],
  })

  const client = new OperationClient({ transport })
  return { client }
}
