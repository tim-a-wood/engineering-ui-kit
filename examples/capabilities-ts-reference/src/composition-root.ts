/**
 * Explicit composition root (§10.2, §19). Registers the domain operation
 * plus the configuration reader / secret resolver it needs into a real
 * {@link LifecycleContainer}, and resolves them into a root {@link Scope}.
 * Both the HTTP slice (`src/http/app.ts`) and the CLI slice
 * (`src/cli/app.ts`) build on this SAME composition root — there is no
 * direct import of `greetOperation` by either host entry point.
 */
import {
  LifecycleContainer,
  createToken,
  MapConfigurationReader,
  type ConfigurationReader,
  type Operation,
  type Scope,
  type SecretResolver,
} from '@engineering-ui-kit/capabilities-runtime'
import { greetOperation, type GreetInput, type GreetSuccess, type GreetRejection } from './domain/greet.js'

export const GREET_OPERATION_TOKEN = createToken<Operation<GreetInput, GreetSuccess, GreetRejection, never>>(
  'example-ts-reference/greet-operation',
)
export const CONFIGURATION_TOKEN = createToken<ConfigurationReader>('example-ts-reference/configuration')
export const SECRET_RESOLVER_TOKEN = createToken<SecretResolver>('example-ts-reference/secret-resolver')

/**
 * This reference app never resolves a secret; it still wires a real
 * {@link SecretResolver} (rather than `undefined`) because host adapters
 * require one. Throwing on any reference keeps the contract honest: if a
 * future operation declares a `SecretReference`, this composition root
 * must be updated to supply a real resolver for it.
 */
function createUnusedSecretResolver(): SecretResolver {
  return {
    resolve(reference) {
      throw new Error(
        `example-ts-reference composition root has no secret registered for reference "${reference.ref}"`,
      )
    },
  }
}

export interface CompositionRoot {
  readonly container: LifecycleContainer
  readonly rootScope: Scope
}

export function createCompositionRoot(): CompositionRoot {
  const container = new LifecycleContainer()

  container.register<ConfigurationReader>({
    token: CONFIGURATION_TOKEN,
    lifecycle: 'singleton',
    factory: () => new MapConfigurationReader({ SERVICE_NAME: 'capabilities-ts-reference' }),
  })

  container.register<SecretResolver>({
    token: SECRET_RESOLVER_TOKEN,
    lifecycle: 'singleton',
    factory: () => createUnusedSecretResolver(),
  })

  container.register<Operation<GreetInput, GreetSuccess, GreetRejection, never>>({
    token: GREET_OPERATION_TOKEN,
    lifecycle: 'singleton',
    factory: () => greetOperation,
  })

  const rootScope = container.createRootScope('example-ts-reference')

  return { container, rootScope }
}
