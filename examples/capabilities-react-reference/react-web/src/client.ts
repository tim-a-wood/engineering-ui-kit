/**
 * Wires the React-web slice's composition root to a real `OperationClient`
 * (`@engineering-ui-kit/capabilities-runtime/browser`) over the in-process
 * transport (`./browser-transport.js`). `GreetForm` depends only on the
 * resulting `OperationClient` (via its `OperationCallable` duck type),
 * never on the composition root or the domain operation directly.
 */
import { OperationClient } from '@engineering-ui-kit/capabilities-runtime/browser'
import type { Operation } from '@engineering-ui-kit/capabilities-runtime'

import { createCompositionRoot, GREET_OPERATION_TOKEN, CONFIGURATION_TOKEN, SECRET_RESOLVER_TOKEN } from './composition-root.js'
import { InProcessBrowserTransport } from './browser-transport.js'
import { GREET_OPERATION_CODE } from './domain/greet.js'

export interface ReactWebApp {
  readonly client: OperationClient
}

/** Builds a fresh composition root and a fresh browser-local `OperationClient` from it. */
export function createReactWebApp(): ReactWebApp {
  const { rootScope } = createCompositionRoot()
  const operation = rootScope.resolve(GREET_OPERATION_TOKEN) as Operation<unknown, unknown, unknown, unknown>
  const configuration = rootScope.resolve(CONFIGURATION_TOKEN)
  const secretResolver = rootScope.resolve(SECRET_RESOLVER_TOKEN)

  const transport = new InProcessBrowserTransport({
    operations: [{ operationCode: GREET_OPERATION_CODE, operation }],
    configuration,
    secretResolver,
  })

  const client = new OperationClient({ transport })
  return { client }
}
