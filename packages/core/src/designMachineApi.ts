/**
 * EUC-16 — machine API adapter for the use-case-led Capabilities design
 * workflow (§17, §25.3 "IPC, CLI, and machine API return the same structured
 * result for the same operation"; "every human operation has a machine
 * operation").
 *
 * `createDesignMachineApi` builds one `DesignWorkspace` +
 * `DesignOperationsService` (`capabilities/design/operations.ts`, EUC-16 core)
 * and returns a plain object with one async method per §17.1 read + §17.2
 * change operation, derived from the service itself (`Object.keys(service)`)
 * rather than a hand-maintained list — so this adapter can never expose an
 * operation the service does not, and never drifts from it. Every method
 * forwards its arguments unchanged to the matching service method and
 * returns its result unchanged: the same value `apps/desktop/src/capabilities
 * /designIpc.ts` and `designCli.ts` return for the same operation and
 * arguments, including the `EUC16-AGENT-APPROVAL-FORBIDDEN` rejection an
 * agent actor gets from any `approve*` operation (§20.2 "no approval
 * shortcut for agents") — this adapter adds no bypass of its own.
 */

import { DesignWorkspace } from './capabilities/design/designWorkspace.js'
import {
  createDesignOperations,
  type CreateDesignOperationsDeps,
  type DesignOperationExecutors,
  type DesignOperationsService,
} from './capabilities/design/operations.js'
import { applyDeltaTransactionally } from './capabilities/design/repositoryAdapter.js'

/**
 * One async method per `DesignOperationsService` operation, with the exact
 * same parameters and (awaited) return value as the underlying service
 * method — derived by mapped type so adding an operation to the committed
 * service automatically extends this type with no edit here.
 */
export type DesignMachineApi = {
  [K in keyof DesignOperationsService]: (
    ...args: Parameters<DesignOperationsService[K]>
  ) => Promise<Awaited<ReturnType<DesignOperationsService[K]>>>
}

export type CreateDesignMachineApiOptions = {
  dataDir: string
  /** Test hook — see `CreateDesignOperationsDeps.clock`; defaults to the real clock. */
  clock?: () => string
  /** Test hook — overrides the default filesystem-backed executors (see `buildDefaultExecutors`). */
  executors?: DesignOperationExecutors
}

/**
 * Real-filesystem executors (`capabilities/design/repositoryAdapter.ts`,
 * EUC-15). Only `applyDelta` is wired: `applyDeltaTransactionally` is
 * synchronous and matches the committed `DesignOperationExecutors['applyDelta']`
 * signature exactly. `verifyModule`/`configureBinding`/`verifyConnection`/
 * `runScenario` are intentionally left unconfigured here — the only
 * committed command-execution primitive, `repositoryAdapter.runConfiguredCommand`,
 * is `async`, but those four executor slots are typed to return their result
 * synchronously, so a real command-backed implementation cannot satisfy the
 * committed type without either blocking child-process I/O (unsafe) or a
 * core type change (see the final packet message "contract-change
 * requests"). Leaving them unconfigured is the documented, safe fallback:
 * those operations return an honest 'not-configured' diagnostic rather than
 * faking success (`operations.ts` §19).
 */
export function buildDefaultExecutors(root: string): DesignOperationExecutors {
  return {
    applyDelta: (plan, delta) => applyDeltaTransactionally(plan, delta, root),
  }
}

export function createDesignMachineApi(options: CreateDesignMachineApiOptions): DesignMachineApi {
  const workspace = new DesignWorkspace(options.dataDir)
  const deps: CreateDesignOperationsDeps = {
    workspace,
    executors: options.executors ?? buildDefaultExecutors(options.dataDir),
    ...(options.clock ? { clock: options.clock } : {}),
  }
  const service = createDesignOperations(deps)
  const byName = service as unknown as Record<string, (...args: unknown[]) => unknown>

  const api: Record<string, (...args: unknown[]) => Promise<unknown>> = {}
  for (const operation of Object.keys(byName)) {
    api[operation] = async (...args: unknown[]) => byName[operation]!(...args)
  }
  return api as DesignMachineApi
}
