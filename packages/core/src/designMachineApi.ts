/**
 * EUC-16: machine API adapter for the use-case-led Capabilities design
 * workflow (§17, §25.3 "IPC, CLI, and machine API return the same structured
 * result for the same operation"; "every human operation has a machine
 * operation").
 *
 * `createDesignMachineApi` builds one `DesignWorkspace` +
 * `DesignOperationsService` (`capabilities/design/operations.ts`, EUC-16 core)
 * and returns a plain object with one async method per §17.1 read + §17.2
 * change operation, derived from the service itself (`Object.keys(service)`)
 * rather than a hand-maintained list: so this adapter can never expose an
 * operation the service does not, and never drifts from it. Every method
 * forwards its arguments unchanged to the matching service method and
 * returns its result unchanged: the same value `apps/desktop/src/capabilities
 * /designIpc.ts` and `designCli.ts` return for the same operation and
 * arguments, including the `EUC16-AGENT-APPROVAL-FORBIDDEN` rejection an
 * agent actor gets from any `approve*` operation (§20.2 "no approval
 * shortcut for agents"): this adapter adds no bypass of its own.
 *
 * --- Reviewer P1 fix (finding: apps/desktop/src/capabilities/designIpc.ts
 * ~line 54, mirrored here) ---------------------------------------------------
 *
 * `buildDefaultExecutors(root)` now treats `root` unambiguously as the
 * project's real *repository* root (never the design workspace's own data
 * directory): `applyDelta` supplies `options.currentRevision:
 * workspaceRevision(root)` so it agrees with the `workspaceRevisionProvider`
 * `createDesignMachineApi` wires from the same `root` (§11.6/§12.2: inspect
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
 *
 * --- Second-review P1 fix: trusted principal at the adapter boundary ------
 *
 * Trust model: `operations.ts`'s `createDesignOperations` is the low-level,
 * already-trusted core service: it takes a request's `actor` at face value
 * (as it always has), because the callers of `createDesignOperations`
 * itself are other packets' own code, not an arbitrary remote caller. This
 * *adapter* is different: it is the layer a caller who has not necessarily
 * been authenticated by this process reaches. `CreateDesignMachineApiOptions
 * .principal` (`"user:<id>"`) is the identity this embedder is calling on
 * behalf of, authenticated however the embedder likes *before* constructing
 * this API: this adapter never re-authenticates it. Every §17.2
 * change-operation request built by a returned `DesignMachineApi` method has
 * its own `actor` field stamped/overridden with `principal`
 * (`stampPrincipal`) before it reaches the service, so a caller-supplied
 * `actor` in the request body is decorative only: it can never assert a
 * different identity, an agent identity, or a claimed authority the
 * embedder did not actually authenticate. When a request's own claimed
 * `actor` differs from the stamped principal, `stampPrincipal` appends a
 * non-blocking `EUC16-ACTOR-CLAIM-MISMATCH` audit event so the mismatch is
 * visible without blocking the call.
 *
 * `principal` is opt-in: an embedder that supplies it gets the full
 * protection above (fail-fast at construction on a malformed value, then
 * unconditional stamping of every change-operation request). An embedder
 * that omits it keeps this adapter's pre-fix behavior unchanged: the
 * request's own `actor` is trusted as before, with no stamping and no
 * mismatch diagnostic. This is a deliberate, documented trust-model gap
 * (see the packet report "trust model" section): a strict
 * always-stamp-even-when-omitted default would retroactively change the
 * `actor` (and therefore the authority-check outcome) of every existing
 * caller that has not yet been updated to pass `principal`: including
 * concurrently developed code this packet does not own. `deriveOsPrincipal`
 * is exported so a caller (e.g. a future `euik-design` CLI binary wrapper
 * around `designCli.ts`) can opt in to the OS-derived identity explicitly:
 * `runDesignCli(argv, { ...opts, principal: opts.principal ??
 * deriveOsPrincipal() })`.
 */

import crypto from 'node:crypto'
import os from 'node:os'
import { DesignWorkspace } from './capabilities/design/designWorkspace.js'
import {
  createDesignOperations,
  type CreateDesignOperationsDeps,
  type DesignOperationExecutors,
  type DesignOperationsService,
} from './capabilities/design/operations.js'
import type { DesignAuditEvent, ModuleDesignSpecification } from './capabilities/design/records.js'
import { applyDeltaTransactionally, readScopedContext, runConfiguredCommandSync, workspaceRevision } from './capabilities/design/repositoryAdapter.js'
import { createConnectExecutors, type ConnectExecutorDeps } from './capabilities/design/connectExecutors.js'

/** `"user:<id>"` after trim: the only principal shape this adapter stamps onto a change-operation request. */
const PRINCIPAL_FORMAT = /^user:\S+$/

/** §4, §20.2 (finding: trusted principal at the adapter boundary): the OS process identity, `user:<os.userInfo().username>`. Not applied automatically (see module doc); a caller opts in explicitly. */
export function deriveOsPrincipal(): string {
  const username = os.userInfo().username?.trim()
  return `user:${username && username.length > 0 ? username : 'unknown'}`
}

/**
 * Validates an explicitly supplied `principal`; returns `undefined`
 * unchanged when omitted (see module doc: stamping is opt-in). Throws
 * (fails fast at construction) for a malformed explicit value rather than
 * silently accepting it.
 */
export function resolvePrincipal(principal: string | undefined): string | undefined {
  if (principal === undefined) return undefined
  const trimmed = principal.trim()
  if (!PRINCIPAL_FORMAT.test(trimmed)) {
    throw new Error(
      `createDesignMachineApi/runDesignCli: options.principal must be "user:<id>" (received ${JSON.stringify(principal)}): authenticate the caller before constructing this API`,
    )
  }
  return trimmed
}

function isChangeOperationInput(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && 'actor' in (value as Record<string, unknown>)
}

/**
 * §4, §20.2, §17.3 (finding: trusted principal at the adapter boundary):  * when `principal` is set, every §17.2 change-operation request's `actor`
 * field is stamped/overridden with it before the request reaches the
 * service; the caller's own claimed `actor` is never trusted alone. A §17.1
 * read operation (whose first argument is a bare positional value, never an
 * object carrying its own `actor` field) always passes through unchanged.
 * When the request's own claimed `actor` differs from the stamped
 * principal, a non-blocking audit diagnostic records the mismatch: this
 * never blocks the call, it only makes a forged claim visible. `principal
 * === undefined` is a no-op (see module doc: stamping is opt-in).
 */
export function stampPrincipal(args: readonly unknown[], principal: string | undefined, workspace: DesignWorkspace, operation: string): unknown[] {
  if (principal === undefined) return [...args]
  const first = args[0]
  if (!isChangeOperationInput(first)) return [...args]
  const claimed = typeof first.actor === 'string' ? first.actor : undefined
  const stamped = { ...first, actor: principal }
  if (claimed !== undefined && claimed !== principal) {
    const projectId = typeof first.projectId === 'string' ? first.projectId : undefined
    if (projectId) {
      const event: DesignAuditEvent = {
        eventId: crypto.randomUUID(),
        projectId,
        actor: principal,
        operation: 'actor-claim-mismatch',
        targetRecordId: operation,
        at: new Date().toISOString(),
        outcome: 'ok',
        diagnosticCodes: ['EUC16-ACTOR-CLAIM-MISMATCH'],
        evidenceRefs: [claimed],
      }
      // Best-effort diagnostic only: an unsafe `projectId` (path traversal)
      // is the *request's* own validation failure, surfaced by the
      // dispatched operation itself: this non-blocking mismatch log must
      // never throw ahead of that.
      try {
        workspace.appendAuditEvent(projectId, event)
      } catch {
        // ignore
      }
    }
  }
  return [stamped, ...args.slice(1)]
}

/**
 * One async method per `DesignOperationsService` operation, with the exact
 * same parameters and (awaited) return value as the underlying service
 * method: derived by mapped type so adding an operation to the committed
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
  /** Test hook: see `CreateDesignOperationsDeps.clock`; defaults to the real clock. */
  clock?: () => string
  /** Test hook: overrides the default filesystem-backed executors (see `buildDefaultExecutors`). Bypasses `repositoryRoot` resolution entirely when set. */
  executors?: DesignOperationExecutors
  /**
   * The project's real repository root(s) (§11.6, §12.2, §17.3, §25.3):    * `applyDelta`/`verifyModule`/`readRepositoryContext` operate on this
   * path, never on `dataDir`. With no `repositoryRoot` resolved for a given
   * call's project, those executors fail honestly (`applyDelta`) or stay
   * unconfigured (`verifyModule`) rather than touching `dataDir`.
   */
  repositoryRoot?: RepositoryRootOption
  /**
   * §4, §20.2 (finding: trusted principal at the adapter boundary): the
   * authenticated `"user:<id>"` principal this embedder is calling on
   * behalf of. Every §17.2 change-operation request built by the returned
   * `DesignMachineApi` has its `actor` field stamped/overridden with this
   * value (see module doc "Trust model"); the embedder authenticates its
   * caller however it likes *before* constructing this API. Opt-in: when
   * omitted, this adapter keeps its pre-fix behavior and trusts the
   * request's own `actor` unchanged (see module doc for why the default is
   * not automatic).
   */
  principal?: string
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
 * `projectId` field: the exact convention `operations.ts` itself uses for
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
 * through `runConfiguredCommandSync` with `cwd: root`: the allowlist is
 * exactly the command set frozen in the approved `ModuleDesignSpecification`
 * (§12.3 "configured commands", §20.2 configured allowlist). A design with no
 * configured commands fails honestly rather than passing vacuously.
 * `readRepositoryContext` reads the module's owned + editable-shared paths
 * from `root` (`repositoryAdapter.readScopedContext`).
 *
 * Second-review P1 fix (was DEV-05 "intentionally unconfigured"):
 * `configureBinding`, `verifyConnection`, and `runScenario` are now real:  * `capabilities/design/connectExecutors.ts`: whenever `connect` (a
 * `DesignWorkspace` + `dataDir`) is supplied; see `buildConnectExecutorDeps`.
 * `createDesignMachineApi` always supplies `connect` when it resolves a
 * `repositoryRoot` for the call. A caller invoking `buildDefaultExecutors`
 * directly with no `connect` argument keeps the old behavior for those three
 * (the honest 'not-configured' diagnostic, `operations.ts` §19): e.g. a
 * caller with no real `DesignWorkspace` to read approved contracts/module
 * designs from. `CreateDesignMachineApiOptions.executors` still overrides
 * everything, as before.
 */
/**
 * Second-review P1 fix: `ConnectExecutorDeps`'s plain read functions, built
 * from a real `DesignWorkspace` (`capabilities/design/connectExecutors.ts`,
 * module doc). Exported so `apps/desktop/src/capabilities/designExecutors.ts`
 * (which cannot construct a `DesignWorkspace` directly the way this file
 * does: it goes through `designIpc.ts`'s own workspace instance) never has
 * to re-derive this wiring by hand.
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

/**
 * `connect` supplies the workspace + data directory `configureBinding`/
 * `verifyConnection`/`runScenario` need (see `buildConnectExecutorDeps`);
 * omitted, those three stay unconfigured (as before this fix) while
 * `applyDelta`/`verifyModule`/`readRepositoryContext` are unaffected.
 */
export function buildDefaultExecutors(root: string, connect?: { workspace: DesignWorkspace; dataDir: string }): DesignOperationExecutors {
  return {
    applyDelta: (plan, delta) => applyDeltaTransactionally(plan, delta, root, { currentRevision: workspaceRevision(root) }),
    ...(connect ? createConnectExecutors(buildConnectExecutorDeps(connect.workspace, connect.dataDir, root)) : {}),
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
 * root whenever one is set (see module doc: inspect and apply must agree).
 */
function buildDepsForCall(workspace: DesignWorkspace, options: CreateDesignMachineApiOptions, projectId: string | undefined): CreateDesignOperationsDeps {
  const repositoryRoot = resolveRepositoryRoot(options.repositoryRoot, projectId)
  const executors =
    options.executors ?? (repositoryRoot ? buildDefaultExecutors(repositoryRoot, { workspace, dataDir: options.dataDir }) : buildRepositoryNotConfiguredExecutors())
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
 * `projectId` parameter of its own: the executors must be selected from
 * the call's own arguments before the service is constructed. Idempotent
 * replay still works because `operations.ts`'s `executeChange` falls back
 * to `workspace.findOperationResult` (persisted) whenever the in-memory
 * cache is empty: the same reasoning `designCli.ts` already relies on,
 * since it also rebuilds its service per invocation.
 */
export function createDesignMachineApi(options: CreateDesignMachineApiOptions): DesignMachineApi {
  // §4, §20.2 (finding: trusted principal at the adapter boundary):
  // resolved once, at construction, from the already-authenticated embedder
  //: never per call, and never from a request's own claimed `actor`.
  const principal = resolvePrincipal(options.principal)
  const workspace = new DesignWorkspace(options.dataDir)
  // Built once, with no executors, purely to enumerate the operation names:   // executors do not change which methods the service exposes.
  const operationNames = Object.keys(createDesignOperations({ workspace }))

  const api: Record<string, (...args: unknown[]) => Promise<unknown>> = {}
  for (const operation of operationNames) {
    api[operation] = async (...args: unknown[]) => {
      const stampedArgs = stampPrincipal(args, principal, workspace, operation)
      const projectId = extractProjectId(stampedArgs)
      const deps = buildDepsForCall(workspace, options, projectId)
      const service = createDesignOperations(deps)
      const byName = service as unknown as Record<string, (...args: unknown[]) => unknown>
      return byName[operation]!(...stampedArgs)
    }
  }
  return api as DesignMachineApi
}
