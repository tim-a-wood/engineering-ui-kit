/**
 * Second-review P1 fix — real `configureBinding`/`verifyConnection`/
 * `runScenario` executors for the desktop IPC adapter.
 *
 * Before this file existed, `designIpc.ts`'s `buildExecutors` left these
 * three deliberately unconfigured (DEV-05,
 * `docs/use-case-led-workflow/IMPLEMENTATION-STATUS.md`): a user reaching
 * Connect in the deployed desktop app could never configure/verify a real
 * binding or run an approved scenario through a production entry point —
 * only an injected test executor exercised that code
 * (`packages/core/test/capabilities/design/product-scenarios.test.ts`
 * S26/S27).
 *
 * The real implementation lives in `packages/core`
 * (`capabilities/design/connectExecutors.ts`, a Node adapter-layer module —
 * see its module doc for exactly what each executor does and does not
 * cover) so the desktop IPC adapter, the CLI, and the machine API all carry
 * the identical behavior (§25.3 "the same structured result for the same
 * operation"). This file only adapts `DesignWorkspace` reads into the plain
 * functions `ConnectExecutorDeps` expects — mirroring
 * `designMachineApi.ts`'s own (not cross-package-importable)
 * `buildConnectExecutorDeps` helper, since `apps/desktop` cannot import a
 * `packages/core` file that is not re-exported through the package's "."
 * entry (see the packet report "contract-change requests" for the barrel
 * addition this required).
 */

import { createConnectExecutors, type ConnectExecutorDeps, type DesignOperationExecutors, type DesignWorkspace, type ModuleDesignSpecification } from '@engineering-ui-kit/core'

/**
 * Builds `ConnectExecutorDeps` from a real `DesignWorkspace` — the same
 * reads `designMachineApi.ts`'s `buildConnectExecutorDeps` performs, kept as
 * a local copy here because `designMachineApi.ts` itself is not reachable
 * from `apps/desktop` (see module doc).
 */
export function buildConnectExecutorDeps(workspace: DesignWorkspace, dataDir: string, repositoryRoot: string): ConnectExecutorDeps {
  return {
    dataDir,
    repositoryRoot,
    getModuleDesign: (projectId, moduleId) => workspace.getApprovedModuleDesign(projectId, moduleId) ?? workspace.getModuleDesignDraft(projectId, moduleId),
    listApprovedOperations: (projectId) =>
      workspace
        .listContracts(projectId)
        .filter((c) => c.status === 'approved')
        .map((c) => ({ operationId: c.operationId, version: c.version })),
    listApprovedModuleDesigns: (projectId): ModuleDesignSpecification[] => {
      const architecture = workspace.getApprovedArchitecture(projectId)
      if (!architecture) return []
      return architecture.moduleIds
        .map((id) => workspace.getApprovedModuleDesign(projectId, id))
        .filter((d): d is ModuleDesignSpecification => Boolean(d))
    },
  }
}

/** Builds the real `configureBinding`/`verifyConnection`/`runScenario` executors for `designIpc.ts`'s `buildExecutors`. */
export function buildDesktopConnectExecutors(
  workspace: DesignWorkspace,
  dataDir: string,
  repositoryRoot: string,
  captureScreenshot?: ConnectExecutorDeps['captureScreenshot'],
): Pick<DesignOperationExecutors, 'configureBinding' | 'verifyConnection' | 'runScenario'> {
  return createConnectExecutors({
    ...buildConnectExecutorDeps(workspace, dataDir, repositoryRoot),
    ...(captureScreenshot ? { captureScreenshot } : {}),
  })
}
