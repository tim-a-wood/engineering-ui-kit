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
import { applyDeltaTransactionally, runConfiguredCommandSync } from './capabilities/design/repositoryAdapter.js'

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
 * EUC-15). `applyDelta` applies transactionally against `root`.
 * `verifyModule` runs the approved design's configured verification commands
 * through `runConfiguredCommandSync` — the allowlist is exactly the command
 * set frozen in the approved `ModuleDesignSpecification` (§12.3 "configured
 * commands", §20.2 configured allowlist). A design with no configured
 * commands fails honestly rather than passing vacuously. `configureBinding`,
 * `verifyConnection`, and `runScenario` stay unconfigured here: they need a
 * launched deployable or a browser runner that a bare data directory cannot
 * provide, so those operations return the honest 'not-configured'
 * diagnostic (`operations.ts`, §19) unless the embedding product supplies
 * real executors.
 */
export function buildDefaultExecutors(root: string): DesignOperationExecutors {
  return {
    applyDelta: (plan, delta) => applyDeltaTransactionally(plan, delta, root),
    verifyModule: ({ design }, context) => {
      const commands = design.verification.configuredCommands
      if (commands.length === 0) {
        return {
          passed: false,
          diagnostics: [
            {
              id: 'euc16.verify.no-commands',
              code: 'EUC16-VERIFY-NO-COMMANDS',
              severity: 'blocker' as const,
              message: 'the approved module design defines no configured verification commands',
            },
          ],
        }
      }
      const results = commands.map((line) => {
        const [command = '', ...args] = line.split(' ').filter(Boolean)
        const outcome = runConfiguredCommandSync({
          command,
          args,
          cwd: root,
          root,
          timeoutMs: 120_000,
          allowedCommands: [command],
          cancellation: context.cancellationRequested ? { cancelled: true } : undefined,
          envAllowlist: ['PATH'],
        })
        return { line, outcome }
      })
      const failed = results.filter(({ outcome }) => outcome.exitCode !== 0 || outcome.timedOut || outcome.cancelled)
      return {
        passed: failed.length === 0,
        evidenceRefs: results.map(({ line, outcome }) => `command:${line}:exit=${outcome.exitCode ?? 'none'}${outcome.timedOut ? ':timeout' : ''}`),
        diagnostics: failed.map(({ line, outcome }) => ({
          id: `euc16.verify.${sha256Short(line)}`,
          code: outcome.timedOut ? 'EUC16-VERIFY-TIMEOUT' : 'EUC16-VERIFY-FAILED',
          severity: 'blocker' as const,
          message: outcome.timedOut
            ? `verification command timed out: ${line}`
            : `verification command failed (exit ${outcome.exitCode ?? 'none'}): ${line}`,
        })),
      }
    },
  }
}

function sha256Short(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  return hash.toString(16)
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
