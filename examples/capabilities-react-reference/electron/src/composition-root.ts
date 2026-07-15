/**
 * Explicit composition root (§10.2, §19) for the Electron slice. Registers
 * the domain operation plus the configuration reader / secret resolver it
 * needs into a real {@link LifecycleContainer}, and resolves them into a
 * root {@link Scope}. Both `src/main/host.ts` (real `ipcMain` wiring) and
 * this composition root's test-side callers build on the SAME registration
 * — neither imports `createTaskOperation` directly.
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
import {
  createTaskOperation,
  type CreateTaskInput,
  type CreateTaskSuccess,
  type CreateTaskRejection,
} from './domain/create-task.js'

export const CREATE_TASK_OPERATION_TOKEN = createToken<
  Operation<CreateTaskInput, CreateTaskSuccess, CreateTaskRejection, never>
>('example-react-reference/electron/create-task-operation')
export const CONFIGURATION_TOKEN = createToken<ConfigurationReader>('example-react-reference/electron/configuration')
export const SECRET_RESOLVER_TOKEN = createToken<SecretResolver>('example-react-reference/electron/secret-resolver')

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
        `capabilities-react-reference/electron composition root has no secret registered for reference "${reference.ref}"`,
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
    factory: () => new MapConfigurationReader({ SERVICE_NAME: 'capabilities-react-reference-electron' }),
  })

  container.register<SecretResolver>({
    token: SECRET_RESOLVER_TOKEN,
    lifecycle: 'singleton',
    factory: () => createUnusedSecretResolver(),
  })

  container.register<Operation<CreateTaskInput, CreateTaskSuccess, CreateTaskRejection, never>>({
    token: CREATE_TASK_OPERATION_TOKEN,
    lifecycle: 'singleton',
    factory: () => createTaskOperation,
  })

  const rootScope = container.createRootScope('example-react-reference-electron')

  return { container, rootScope }
}
