/**
 * @engineering-ui-kit/capabilities-runtime/react — thin React hooks over
 * the framework-neutral `./browser` operation client (§7.1, §10.3).
 *
 * Browser-safe only: this module and everything it imports MUST NOT import
 * `node:*` built-ins. Contains no operation/domain logic of its own:
 * `useOperation` only tracks a single named operation call's lifecycle
 * (loading, validation/domain rejection, technical failure, cancelled,
 * timed out, success) against a caller-supplied client, and guards against
 * duplicate concurrent submissions.
 */

export type {
  OperationCallable,
  OperationControllerSnapshot,
  OperationControllerState,
} from './react/controller.js'
export { OperationController } from './react/controller.js'

export type { UseOperationResult } from './react/use-operation.js'
export { useOperation } from './react/use-operation.js'
