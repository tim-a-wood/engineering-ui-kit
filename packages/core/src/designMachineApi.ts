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
 *
 * --- Reviewer P1 fix (finding: apps/desktop/src/capabilities/designIpc.ts
 * ~line 54, mirrored here) ---------------------------------------------------
 *
 * `buildDefaultExecutors(root)` now treats `root` unambiguously as the
 * project's real *repository* root (never the design workspace's own data
 * directory): `applyDelta` supplies `options.currentRevision:
 * workspaceRevision(root)` so it agrees with the `workspaceRevisionProvider`
 * `createDesignMachineApi` wires from the same `root` (§11.6/§12.2 — inspect
 * and apply must compare the same real-filesystem revision, not a
 * module-design revision string against a filesystem hash), and a new
 * `readRepositoryContext` executor reads the module's owned + editable-shared
 * paths from `root` (`repositoryAdapter.readScopedContext`).
 *
 * `CreateDesignMachineApiOptions.repositoryRoot` (a single path, or a
 * `{ [projectId]: path }` map for a multi-project embedder) is the option
 * that supplies `root`; `runDesignCli` (`designCli.ts`) accepts and resolves
 * the identical option so the CLI and machine API adapters build the exact
 * same executors for the exact same project. With no `repositoryRoot`
 * resolved for a request's project, `applyDelta` returns a structured
 * `{ applied: false, failure: 'repository-not-configured: ...' }` result
 * instead of silently applying into `dataDir` (the reviewer finding).
 */

import { DesignWorkspace } from './capabilities/design/designWorkspace.js'
import {
  createDesignOperations,
  type CreateDesignOperationsDeps,
  type DesignOperationExecutors,
  type DesignOperationsService,
} from './capabilities/design/operations.js'
import { applyDeltaTransactionally, readScopedContext, runConfiguredCommandSync, workspaceRevision } from './capabilities/design/repositoryAdapter.js'

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

/** A single repository root shared by every project, or a `projectId -> repositoryRoot` map for a multi-project embedder. */
export type RepositoryRootOption = string | Record<string, string>

export type CreateDesignMachineApiOptions = {
  dataDir: string
  /** Test hook — see `CreateDesignOperationsDeps.clock`; defaults to the real clock. */
  clock?: () => string
  /** Test hook — overrides the default filesystem-backed executors (see `buildDefaultExecutors`). Bypasses `repositoryRoot` resolution entirely when set. */
  executors?: DesignOperationExecutors
  /**
   * The project's real repository root(s) (§11.6, §12.2, §17.3, §25.3) —
   * `applyDelta`/`verifyModule`/`readRepositoryContext` operate on this
   * path, never on `dataDir`. With no `repositoryRoot` resolved for a given
   * call's project, those executors fail honestly (`applyDelta`) or stay
   * unconfigured (`verifyModule`) rather than touching `dataDir`.
   */
  repositoryRoot?: RepositoryRootOption
}

/** Resolves `repositoryRoot` (single path or per-project map) for a given `projectId`; `undefined` when nothing is configured for it. */
export function resolveRepositoryRoot(repositoryRoot: RepositoryRootOption | undefined, projectId: string | undefined): string | undefined {
  if (!repositoryRoot) return undefined
  if (typeof repositoryRoot === 'string') return repositoryRoot
  if (!projectId) return undefined
  return repositoryRoot[projectId]
}

/**
 * Every §17.1 read operation takes `projectId` as its first positional
 * argument; every §17.2 change operation takes one input object with a
 * `projectId` field — the exact convention `operations.ts` itself uses for
 * `executeChange`'s `meta.projectId`. Used to resolve the request's
 * `repositoryRoot` before the executors it needs are built.
 */
export function extractProjectId(args: readonly unknown[]): string | undefined {
  const first = args[0]
  if (typeof first === 'string') return first
  if (first && typeof first === 'object' && typeof (first as { projectId?: unknown }).projectId === 'string') {
    return (first as { projectId: string }).projectId
  }
  return undefined
}

const REPOSITORY_NOT_CONFIGURED_MESSAGE =
  'repository-not-configured: no repositoryRoot is configured for this project; pass repositoryRoot to createDesignMachineApi/runDesignCli (a single path, or a { [projectId]: path } map) before applying a delta'

/** `applyDelta` fails honestly with no repository configured; every other executor stays unconfigured (operations.ts's own `EUC16-EXECUTOR-NOT-CONFIGURED` names the missing hook). */
export function buildRepositoryNotConfiguredExecutors(): DesignOperationExecutors {
  return {
    applyDelta: (plan) => ({
      planId: plan.planId,
      applied: false,
      rolledBack: false,
      appliedFiles: [],
      failure: REPOSITORY_NOT_CONFIGURED_MESSAGE,
      completedAt: new Date().toISOString(),
    }),
  }
}

/**
 * Real-filesystem executors (`capabilities/design/repositoryAdapter.ts`,
 * EUC-15) scoped to the real project repository at `root`. `applyDelta`
 * applies transactionally against `root`, supplying `options.currentRevision:
 * workspaceRevision(root)` so it matches the `workspaceRevisionProvider`
 * `createDesignMachineApi` wires from the same `root` (see module doc).
 * `verifyModule` runs the approved design's configured verification commands
 * through `runConfiguredCommandSync` with `cwd: root` — the allowlist is
 * exactly the command set frozen in the approved `ModuleDesignSpecification`
 * (§12.3 "configured commands", §20.2 configured allowlist). A design with no
 * configured commands fails honestly rather than passing vacuously.
 * `readRepositoryContext` reads the module's owned + editable-shared paths
 * from `root` (`repositoryAdapter.readScopedContext`). `configureBinding`,
 * `verifyConnection`, and `runScenario` stay unconfigured here (DEV-05): they
 * need a launched deployable or a browser runner that a bare repository path
 * cannot provide, so those operations return the honest 'not-configured'
 * diagnostic (`operations.ts`, §19) unless the embedding product supplies
 * real executors via `CreateDesignMachineApiOptions.executors`.
 */
export function buildDefaultExecutors(root: string): DesignOperationExecutors {
  return {
    applyDelta: (plan, delta) => applyDeltaTransactionally(plan, delta, root, { currentRevision: workspaceRevision(root) }),
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
    readRepositoryContext: ({ ownedPaths, editableSharedPaths }) =>
      readScopedContext({ root, includePaths: [...ownedPaths, ...editableSharedPaths] }).map((candidate) => ({
        ref: candidate.ref,
        content: candidate.content,
        bytes: candidate.bytes,
        contentHash: candidate.contentHash,
      })),
  }
}

function sha256Short(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  return hash.toString(16)
}

/**
 * Builds the `CreateDesignOperationsDeps` for one call: resolves
 * `options.repositoryRoot` for `projectId`, then selects
 * `options.executors` (test hook, always wins) → real filesystem executors
 * scoped to the resolved repository root → the honest not-configured
 * fallback, and wires `workspaceRevisionProvider` from the same resolved
 * root whenever one is set (see module doc — inspect and apply must agree).
 */
function buildDepsForCall(workspace: DesignWorkspace, options: CreateDesignMachineApiOptions, projectId: string | undefined): CreateDesignOperationsDeps {
  const repositoryRoot = resolveRepositoryRoot(options.repositoryRoot, projectId)
  const executors = options.executors ?? (repositoryRoot ? buildDefaultExecutors(repositoryRoot) : buildRepositoryNotConfiguredExecutors())
  return {
    workspace,
    executors,
    ...(options.clock ? { clock: options.clock } : {}),
    ...(repositoryRoot ? { workspaceRevisionProvider: () => workspaceRevision(repositoryRoot) } : {}),
  }
}

/**
 * A `DesignOperationsService` is built fresh per call (not once for the
 * life of the returned `DesignMachineApi`), because `options.repositoryRoot`
 * may be a per-project map and `DesignOperationExecutors` carries no
 * `projectId` parameter of its own — the executors must be selected from
 * the call's own arguments before the service is constructed. Idempotent
 * replay still works because `operations.ts`'s `executeChange` falls back
 * to `workspace.findOperationResult` (persisted) whenever the in-memory
 * cache is empty — the same reasoning `designCli.ts` already relies on,
 * since it also rebuilds its service per invocation.
 */
export function createDesignMachineApi(options: CreateDesignMachineApiOptions): DesignMachineApi {
  const workspace = new DesignWorkspace(options.dataDir)
  // Built once, with no executors, purely to enumerate the operation names —
  // executors do not change which methods the service exposes.
  const operationNames = Object.keys(createDesignOperations({ workspace }))

  const api: Record<string, (...args: unknown[]) => Promise<unknown>> = {}
  for (const operation of operationNames) {
    api[operation] = async (...args: unknown[]) => {
      const projectId = extractProjectId(args)
      const deps = buildDepsForCall(workspace, options, projectId)
      const service = createDesignOperations(deps)
      const byName = service as unknown as Record<string, (...args: unknown[]) => unknown>
      return byName[operation]!(...args)
    }
  }
  return api as DesignMachineApi
}
