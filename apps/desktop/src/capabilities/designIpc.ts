/**
 * EUC-16 — desktop IPC adapter for the use-case-led Capabilities design
 * workflow (§17, §25.3 "IPC, CLI, and machine API return the same structured
 * result for the same operation").
 *
 * One `ipcMain.handle` on `DESIGN_CHANNEL` dispatches every design-workflow
 * operation to the same `DesignOperationsService` (packages/core
 * `capabilities/design/operations.ts`) that `packages/core/src/designCli.ts`
 * and `packages/core/src/designMachineApi.ts` call — no operation is
 * reimplemented here, and no operation is added that the service does not
 * already expose (§20.2 "no approval shortcut for agents": an `approve*`
 * request from an agent actor reaches `executeChange`'s own
 * `isAgentActor`/`approve` check and is rejected with the same diagnostics
 * whether it arrives over IPC, the CLI, or the machine API).
 *
 * `createDesignIpcDispatch` is exported separately from
 * `registerDesignIpcHandlers` so tests can dispatch a request without an
 * Electron `ipcMain`/`BrowserWindow`.
 */

import { ipcMain } from 'electron'
import {
  DesignWorkspace,
  createDesignOperations,
  applyDeltaTransactionally,
  type DesignOperationExecutors,
  type DesignOperationsService,
} from '@engineering-ui-kit/core'
import { DESIGN_CHANNEL, DESIGN_OPERATIONS, type DesignBridgeRequest, type DesignBridgeResponse } from './designBridge.js'

function makeDiagnostic(code: string, message: string, target?: string) {
  return {
    id: target ? `${code}:${target}` : code,
    code,
    severity: 'blocker' as const,
    message,
    ...(target ? { target } : {}),
  }
}

function unknownOperationResult(operation: string): DesignBridgeResponse {
  return {
    ok: false,
    diagnostics: [makeDiagnostic('EUC16-UNKNOWN-OPERATION', `unknown operation: ${operation}`, 'operation')],
    validNextActions: [],
  }
}

/**
 * Executors backed by the real filesystem (`packages/core`
 * `capabilities/design/repositoryAdapter.ts`, EUC-15). Only `applyDelta` is
 * wired: `applyDeltaTransactionally` is synchronous and matches the
 * committed `DesignOperationExecutors['applyDelta']` signature exactly.
 * `verifyModule`/`configureBinding`/`verifyConnection`/`runScenario` are
 * intentionally left unconfigured — `repositoryAdapter.runConfiguredCommand`
 * (the only committed command-execution primitive) is `async`, but those
 * four executor slots are typed to return their result synchronously, so a
 * real command-backed implementation cannot satisfy the committed type
 * without either blocking child-process I/O (unsafe) or a core type change
 * (out of this packet's owned files — see the final packet message
 * "contract-change requests"). Leaving them unconfigured is the documented,
 * safe fallback: those operations return an honest 'not-configured'
 * diagnostic rather than faking success (`operations.ts` §19).
 *
 * `root` is the workspace data directory (the only path this adapter's
 * signature receives); a future packet that threads the project's real
 * repository path through `registerDesignIpcHandlers` should pass that path
 * here instead.
 */
function buildExecutors(root: string): DesignOperationExecutors {
  return {
    applyDelta: (plan, delta) => applyDeltaTransactionally(plan, delta, root),
  }
}

/**
 * Builds one `DesignWorkspace` + `DesignOperationsService` for `dataDir` and
 * returns a plain dispatch function — no Electron dependency, so tests can
 * call it directly.
 */
export function createDesignIpcDispatch(dataDir: string): (request: DesignBridgeRequest) => DesignBridgeResponse {
  const workspace = new DesignWorkspace(dataDir)
  const service = createDesignOperations({ workspace, executors: buildExecutors(dataDir) })
  const byName = service as unknown as Record<string, (...args: unknown[]) => unknown>

  return function dispatch(request: DesignBridgeRequest): DesignBridgeResponse {
    const { operation, args } = request
    if (!(DESIGN_OPERATIONS as readonly string[]).includes(operation) || typeof byName[operation] !== 'function') {
      return unknownOperationResult(operation)
    }
    // `args` is spread positionally onto the named service method — the
    // exact same call shape `designCli.ts` and `designMachineApi.ts` use, so
    // the same operation with the same args produces the same result
    // regardless of which adapter is called (§25.3).
    return byName[operation]!(...(Array.isArray(args) ? args : []))
  }
}

/**
 * Registers the single `DESIGN_CHANNEL` handler. `getDataDir` is called at
 * most once — the `DesignWorkspace`/`DesignOperationsService` pair is
 * created lazily on the first request and reused for the life of the
 * process, one instance per process.
 */
export function registerDesignIpcHandlers(getDataDir: () => string): void {
  let dispatch: ((request: DesignBridgeRequest) => DesignBridgeResponse) | undefined
  ipcMain.handle(DESIGN_CHANNEL, (_event, request: DesignBridgeRequest) => {
    dispatch ??= createDesignIpcDispatch(getDataDir())
    return dispatch(request)
  })
}

export type { DesignOperationsService }
