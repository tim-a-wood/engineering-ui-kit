/**
 * HTTP slice entry point: builds the real `node:http`-backed host from
 * `@engineering-ui-kit/capabilities-runtime/node`, wiring its single route
 * to the `greet` operation resolved from the composition root. Nothing
 * here calls `dispatch` or `greetOperation` directly — that happens inside
 * `createNodeHttpHost`, on every real inbound HTTP request.
 */
import { createNodeHttpHost, type NodeHttpHost } from '@engineering-ui-kit/capabilities-runtime/node'
import {
  createCompositionRoot,
  GREET_OPERATION_TOKEN,
  CONFIGURATION_TOKEN,
  SECRET_RESOLVER_TOKEN,
} from '../composition-root.js'

export interface HttpApp {
  readonly host: NodeHttpHost
}

/** Builds a fresh composition root and a fresh HTTP host from it. */
export function createHttpApp(): HttpApp {
  const { rootScope } = createCompositionRoot()
  const operation = rootScope.resolve(GREET_OPERATION_TOKEN)
  const configuration = rootScope.resolve(CONFIGURATION_TOKEN)
  const secretResolver = rootScope.resolve(SECRET_RESOLVER_TOKEN)

  const host = createNodeHttpHost({
    routes: [{ method: 'POST', path: '/greet', operation }],
    configuration,
    secretResolver,
  })

  return { host }
}
