/**
 * Electron main-process entry point for the Electron slice: wires the
 * composition root's `create-task` operation to the REAL `ipcMain` via
 * `registerCapabilitiesIpcHost` (`@engineering-ui-kit/capabilities-runtime/electron/main`,
 * frozen). Nothing here calls `dispatch`/`createTaskOperation` directly —
 * that happens inside the runtime's Electron IPC main-handler, on every
 * real inbound `invoke`/`cancel` message.
 *
 * This file touches the real `electron` module (via the runtime's
 * `electron/main` subpath) and so cannot run outside a live Electron main
 * process; it is exercised here only by `tsc --noEmit` (per the packet, a
 * real Electron process E2E is deferred to WP8). `../../test/ipc-e2e.test.ts`
 * proves the pure invoke/cancel -> dispatch -> operation logic this
 * function wires up, without needing a real `ipcMain`.
 */
import { registerCapabilitiesIpcHost, type ElectronMainIpcHost } from '@engineering-ui-kit/capabilities-runtime/electron/main'
import type { Operation } from '@engineering-ui-kit/capabilities-runtime'

import {
  createCompositionRoot,
  CREATE_TASK_OPERATION_TOKEN,
  CONFIGURATION_TOKEN,
  SECRET_RESOLVER_TOKEN,
} from '../composition-root.js'
import { CREATE_TASK_OPERATION_CODE } from '../domain/create-task.js'

/** Builds a fresh composition root and registers its operation(s) against the real `ipcMain`. */
export function createElectronMainHost(): ElectronMainIpcHost {
  const { rootScope } = createCompositionRoot()
  const operation = rootScope.resolve(CREATE_TASK_OPERATION_TOKEN) as Operation<unknown, unknown, unknown, unknown>
  const configuration = rootScope.resolve(CONFIGURATION_TOKEN)
  const secretResolver = rootScope.resolve(SECRET_RESOLVER_TOKEN)

  return registerCapabilitiesIpcHost({
    operations: [{ operationCode: CREATE_TASK_OPERATION_CODE, operation }],
    configuration,
    secretResolver,
  })
}
