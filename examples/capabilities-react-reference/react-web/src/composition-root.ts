/**
 * Explicit composition root (§10.2, §19) for the React-web slice. Registers
 * the domain operation plus the configuration reader / secret resolver it
 * needs into a real {@link LifecycleContainer}, and resolves them into a
 * root {@link Scope}. `src/browser-transport.ts` and the `GreetForm`
 * component built on top of it never import `greetOperation` directly.
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
  'example-react-reference/react-web/greet-operation',
)
export const CONFIGURATION_TOKEN = createToken<ConfigurationReader>('example-react-reference/react-web/configuration')
export const SECRET_RESOLVER_TOKEN = createToken<SecretResolver>('example-react-reference/react-web/secret-resolver')

/**
 * This reference slice never resolves a secret; it still wires a real
 * {@link SecretResolver} (rather than `undefined`) because `dispatch`'s
 * `Context` requires one. Throwing on any reference keeps the contract
 * honest: if a future operation declares a `SecretReference`, this
 * composition root must be updated to supply a real resolver for it.
 */
function createUnusedSecretResolver(): SecretResolver {
  return {
    resolve(reference) {
      throw new Error(
        `capabilities-react-reference/react-web composition root has no secret registered for reference "${reference.ref}"`,
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
    factory: () => new MapConfigurationReader({ SERVICE_NAME: 'capabilities-react-reference-web' }),
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

  const rootScope = container.createRootScope('example-react-reference-web')

  return { container, rootScope }
}
