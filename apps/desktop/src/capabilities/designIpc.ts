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
 *
 * --- Reviewer P1 fix (finding: designIpc.ts ~line 54) -----------------------
 *
 * Before this fix, the only wired executor (`applyDelta`) applied a delta
 * against the workspace *data directory* (`root` = `dataDir`), and
 * `verifyModule`/`configureBinding`/`verifyConnection`/`runScenario` were
 * entirely unconfigured. Two bugs followed: (1) a real desktop project could
 * never apply a delta into its actual repository — every apply landed inside
 * the app's own data directory instead; (2) `inspectAgentDelta` recorded
 * `workspaceRevisionAtInspection` from the module design's own revision
 * (e.g. `'r1'`, from `deps.workspaceRevisionProvider` being unset, so
 * `operations.ts` fell back to `design?.revision`), while
 * `applyDeltaTransactionally`'s default (`options.currentRevision` omitted)
 * recomputes a *filesystem content hash* — two different value spaces that
 * can never agree, so every apply failed as `'stale workspace revision'`
 * before writing a single file.
 *
 * The fix has three parts, all confined to this adapter (no edit to
 * `operations.ts`, `deltaInspector.ts`, `repositoryAdapter.ts`, or
 * `designWorkspace.ts` — all frozen for this packet):
 *
 *  1. Adapter-level project-repository configuration
 *     (`adapter:configureProjectRepository` / `adapter:getProjectRepository`,
 *     declared in `designBridge.ts`, deliberately *not* part of
 *     `DESIGN_OPERATIONS`/`DesignOperationsService`). The mapping is
 *     persisted per project at
 *     `<dataDir>/projects/<projectId>/design-adapter/repository.json`
 *     (atomic write, `projectId` validated as a single safe path segment
 *     before it ever reaches `path.join`) and audit-logged through
 *     `workspace.appendAuditEvent` with the same idempotency-key semantics
 *     every §17.2 change operation uses. Only a `user:` actor may configure
 *     a repository — an `agent:` (or `service:`) actor is rejected before
 *     anything is written or logged as a rejection.
 *
 *  2. Real executors, built per project from that configured repository
 *     root: `applyDelta` runs `applyDeltaTransactionally` against the real
 *     repository (never the data directory) — with no repository configured
 *     it returns a structured `{ applied: false, failure:
 *     'repository-not-configured: ...' }` result rather than silently
 *     touching `dataDir`. `verifyModule` runs the design's configured
 *     verification commands (`repositoryAdapter.runConfiguredCommandSync`)
 *     with `cwd` set to the repository root. `readRepositoryContext` reads
 *     the module's owned + editable-shared paths from the repository root
 *     (`repositoryAdapter.readScopedContext`). `configureBinding`,
 *     `verifyConnection`, and `runScenario` stay honestly unconfigured here
 *     (DEV-05, `docs/use-case-led-workflow/IMPLEMENTATION-STATUS.md`): they
 *     need a launched deployable or a browser runner a bare repository path
 *     cannot provide. A future packet configures them by supplying
 *     `configureBinding`/`verifyConnection`/`runScenario` executors here,
 *     the same `DesignOperationExecutors` hook `verifyModule` and
 *     `applyDelta` already use.
 *
 *  3. Revision alignment: `deps.workspaceRevisionProvider` is now wired to
 *     `() => workspaceRevision(repositoryRoot)` (the *same* deterministic,
 *     content-derived hash `repositoryAdapter.ts` defines) for every project
 *     with a configured repository, so `inspectAgentDelta` records the real
 *     repository's revision, and `applyDelta` passes
 *     `options.currentRevision: workspaceRevision(repositoryRoot)` — the
 *     identical computation — so inspect and apply agree on real filesystem
 *     state instead of comparing a module-design revision string to a
 *     filesystem hash.
 *
 * Because a project's repository root can change between requests (and
 * different requests target different projects sharing one `dataDir`), the
 * `DesignOperationsService` is built fresh per dispatch call from the
 * request's own `projectId` (extracted from `args[0]` — a string for every
 * §17.1 read, `args[0].projectId` for every §17.2 change operation, exactly
 * the convention `operations.ts` itself uses) — the same per-invocation
 * construction `packages/core/src/designCli.ts` already uses, so the
 * in-process idempotency cache never has to survive a stale executor
 * closure; idempotent replay still works because `operations.ts`'s
 * `executeChange` falls back to `workspace.findOperationResult` (persisted)
 * whenever the in-memory cache is empty.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { ipcMain } from 'electron'
import {
  DesignWorkspace,
  createDesignOperations,
  applyDeltaTransactionally,
  workspaceRevision,
  readScopedContext,
  runConfiguredCommandSync,
  type CreateDesignOperationsDeps,
  type DesignAuditEvent,
  type DesignOperationExecutors,
  type DesignOperationsService,
} from '@engineering-ui-kit/core'
import {
  DESIGN_CHANNEL,
  DESIGN_OPERATIONS,
  type AdapterConfigurationResponse,
  type ConfigureProjectRepositoryInput,
  type DesignBridgeRequest,
  type DesignBridgeResponse,
  type GetProjectRepositoryInput,
} from './designBridge.js'

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

// ---------------------------------------------------------------------------
// §20.2 / §20.3 path-segment validation — copied locally (designWorkspace.ts
// is frozen for this packet; its own `assertSafeSegment` is not exported).
// Same rule: a single path segment, no separators, no traversal, no leading
// dot, bounded length, so `projectId` cannot escape
// `<dataDir>/projects/<projectId>/...` when it is joined into a path below.
// ---------------------------------------------------------------------------

const MAX_PROJECT_ID_LENGTH = 300

function isSafeProjectIdSegment(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_PROJECT_ID_LENGTH) return false
  if (value.indexOf('\0') !== -1) return false
  if (value.includes('/') || value.includes('\\')) return false
  if (value === '.' || value === '..') return false
  if (value.startsWith('.')) return false
  return true
}

/** `"user"`, `"agent"`, or `"service"` after trim (case-insensitive) — mirrors `operations.ts`'s own actor-format gate, copied locally since it is not exported. */
const ACTOR_FORMAT = /^(user|agent|service):\S+$/i

function localActorKind(actor: unknown): 'user' | 'agent' | 'service' | undefined {
  if (typeof actor !== 'string') return undefined
  const match = ACTOR_FORMAT.exec(actor.trim())
  return match ? (match[1]!.toLowerCase() as 'user' | 'agent' | 'service') : undefined
}

// ---------------------------------------------------------------------------
// §4, §20.2, §17.3 (second-review P1 finding — trusted principal at the
// adapter boundary)
//
// Trust model: an Electron renderer process is not a separate authenticated
// party from the desktop app's own OS user — it runs inside the same
// process tree, as the same OS account, in the same session. What it is NOT
// is a *trustworthy reporter of its own identity*: nothing stops a hostile
// or buggy renderer from attaching `actor: 'agent:copilot'` (to reach for
// the "no approval shortcut for agents" carve-out) or `actor:
// 'user:someone-else'` (to forge a different real user's approval) to a
// request body. `main.ts`'s single `ipcMain.handle` is the trust boundary:
// everything that arrives on `DESIGN_CHANNEL` is, by construction, a request
// from *this* desktop process's own OS user, so this adapter derives that
// identity itself — once per dispatcher — and stamps/overrides it onto
// every request's `actor` field before it reaches the service or the
// adapter-owned repository-configuration operations. A request's own
// claimed `actor` is decorative only; when it differs from the stamped
// principal, `stampPrincipalOnArgs` appends a non-blocking
// `EUC16-ACTOR-CLAIM-MISMATCH` audit event so the mismatch stays visible
// without blocking the call.
// ---------------------------------------------------------------------------

/** `"user:<id>"` after trim — the only principal shape this adapter stamps onto a request. */
const PRINCIPAL_FORMAT = /^user:\S+$/

/** The OS process identity, `user:<os.userInfo().username>` — derived once per dispatcher (see block doc above), never per request. */
function deriveOsPrincipal(): string {
  const username = os.userInfo().username?.trim()
  return `user:${username && username.length > 0 ? username : 'unknown'}`
}

/** Validates a test/embedder-supplied principal override; the real desktop app never supplies one (see `registerDesignIpcHandlers`). */
function resolveDispatchPrincipal(explicit: string | undefined): string {
  if (explicit === undefined) return deriveOsPrincipal()
  const trimmed = explicit.trim()
  if (!PRINCIPAL_FORMAT.test(trimmed)) {
    throw new Error(`createDesignIpcDispatch: options.principal must be "user:<id>" (received ${JSON.stringify(explicit)})`)
  }
  return trimmed
}

function isChangeOperationInput(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && 'actor' in (value as Record<string, unknown>)
}

/**
 * Stamps/overrides `args[0].actor` with `principal` for a §17.2
 * change-operation request or an `adapter:*` request (both take one input
 * object carrying its own `actor` field); a §17.1 read request (whose first
 * argument is a bare positional value) passes through unchanged. Appends a
 * non-blocking `EUC16-ACTOR-CLAIM-MISMATCH` audit event when the request's
 * own claimed `actor` differs from the stamped principal.
 */
function stampPrincipalOnArgs(args: unknown[], principal: string, workspace: DesignWorkspace, operation: string): unknown[] {
  const first = args[0]
  if (!isChangeOperationInput(first)) return args
  const claimed = typeof first.actor === 'string' ? first.actor : undefined
  const stamped = { ...first, actor: principal }
  if (claimed !== undefined && claimed !== principal) {
    const projectId = typeof first.projectId === 'string' ? first.projectId : undefined
    // Only log the mismatch when `projectId` is itself a safe path segment
    // (the same check `configureProjectRepository`/the workspace path
    // helpers apply) — an unsafe `projectId` is the *request's* own
    // validation failure, reported by the dispatched operation itself; this
    // non-blocking diagnostic must never throw ahead of that, and never let
    // an unvalidated value reach a persisted path.
    if (projectId && isSafeProjectIdSegment(projectId)) {
      try {
        appendAdapterAuditEvent(workspace, {
          projectId,
          actor: principal,
          operation: 'actor-claim-mismatch',
          targetRecordId: operation,
          outcome: 'ok',
          diagnosticCodes: ['EUC16-ACTOR-CLAIM-MISMATCH'],
          evidenceRefs: [claimed],
        })
      } catch {
        // Best-effort diagnostic only — never blocks or fails the dispatch.
      }
    }
  }
  return [stamped, ...args.slice(1)]
}

// ---------------------------------------------------------------------------
// Adapter-owned per-project repository configuration
// (`<dataDir>/projects/<projectId>/design-adapter/repository.json`)
// ---------------------------------------------------------------------------

type ProjectRepositoryConfig = {
  schemaVersion: '1.0'
  projectId: string
  repositoryRoot: string
  configuredBy: string
  configuredAt: string
}

function repositoryConfigDir(dataDir: string, projectId: string): string {
  return path.join(dataDir, 'projects', projectId, 'design-adapter')
}

function repositoryConfigPath(dataDir: string, projectId: string): string {
  return path.join(repositoryConfigDir(dataDir, projectId), 'repository.json')
}

/** Returns `undefined` for a missing, unreadable, or malformed config — never throws. */
function readProjectRepositoryConfig(dataDir: string, projectId: string): ProjectRepositoryConfig | undefined {
  if (!isSafeProjectIdSegment(projectId)) return undefined
  const file = repositoryConfigPath(dataDir, projectId)
  if (!fs.existsSync(file)) return undefined
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<ProjectRepositoryConfig>
    if (typeof parsed.repositoryRoot !== 'string' || !parsed.repositoryRoot) return undefined
    return parsed as ProjectRepositoryConfig
  } catch {
    return undefined
  }
}

/** Atomic write: write to a sibling temp file, then rename (same pattern `designWorkspace.ts` uses for every persisted record). */
function writeProjectRepositoryConfigAtomic(dataDir: string, config: ProjectRepositoryConfig): void {
  const dir = repositoryConfigDir(dataDir, config.projectId)
  fs.mkdirSync(dir, { recursive: true })
  const file = repositoryConfigPath(dataDir, config.projectId)
  const tmp = `${file}.${crypto.randomUUID()}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2) + '\n')
  fs.renameSync(tmp, file)
}

function appendAdapterAuditEvent(
  workspace: DesignWorkspace,
  input: {
    projectId: string
    actor: string
    operation: string
    idempotencyKey?: string
    targetRecordId?: string
    outcome: DesignAuditEvent['outcome']
    diagnosticCodes: string[]
    evidenceRefs?: string[]
  },
): DesignAuditEvent {
  return workspace.appendAuditEvent(input.projectId, {
    eventId: crypto.randomUUID(),
    projectId: input.projectId,
    actor: input.actor,
    operation: input.operation,
    targetRecordId: input.targetRecordId,
    idempotencyKey: input.idempotencyKey,
    at: new Date().toISOString(),
    outcome: input.outcome,
    diagnosticCodes: input.diagnosticCodes,
    evidenceRefs: input.evidenceRefs ?? [],
  })
}

/**
 * `adapter:configureProjectRepository` — persists `<dataDir>/projects/
 * <projectId>/design-adapter/repository.json` and appends a
 * `DesignAuditEvent` (idempotency-key deduplicated, exactly like every §17.2
 * change operation). Rejects a malformed `projectId`, a malformed or
 * non-`user:` actor, a missing `idempotencyKey`, and a `repositoryRoot` that
 * is not an absolute, existing directory — never writes or logs a partial
 * configuration.
 */
function configureProjectRepository(dataDir: string, workspace: DesignWorkspace, rawInput: unknown): AdapterConfigurationResponse {
  const input = (rawInput ?? {}) as Partial<ConfigureProjectRepositoryInput>
  const { projectId, actor, idempotencyKey, repositoryRoot } = input

  if (!isSafeProjectIdSegment(projectId)) {
    return { ok: false, diagnostics: [makeDiagnostic('EUC16-ADAPTER-INVALID-PROJECT-ID', 'projectId must be a single safe path segment', 'projectId')] }
  }

  const kind = localActorKind(actor)
  if (!kind) {
    return {
      ok: false,
      diagnostics: [
        makeDiagnostic('EUC16-ADAPTER-ACTOR-INVALID', `actor must match "user:<id>", "agent:<id>", or "service:<id>" (received ${JSON.stringify(actor)})`, 'actor'),
      ],
    }
  }

  const rejectAndLog = (code: string, message: string): AdapterConfigurationResponse => {
    appendAdapterAuditEvent(workspace, {
      projectId,
      actor: actor as string,
      operation: 'adapter:configureProjectRepository',
      idempotencyKey: typeof idempotencyKey === 'string' ? idempotencyKey : undefined,
      targetRecordId: projectId,
      outcome: 'rejected',
      diagnosticCodes: [code],
    })
    return { ok: false, diagnostics: [makeDiagnostic(code, message, 'repositoryRoot')] }
  }

  // §20.2 "external agents shall receive a packet, not unrestricted project
  // authority" — only a genuine user may configure the repository an
  // agent's own deltas will be applied against; agent and service actors
  // are rejected the same way every approve* operation rejects them.
  if (kind !== 'user') {
    return rejectAndLog('EUC16-ADAPTER-AGENT-FORBIDDEN', `an ${kind} actor cannot configure the project repository`)
  }

  if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    return { ok: false, diagnostics: [makeDiagnostic('EUC16-ADAPTER-IDEMPOTENCY-KEY-REQUIRED', 'idempotencyKey is required', 'idempotencyKey')] }
  }

  // Idempotent replay: a prior committed event with this key returns the
  // committed configuration rather than re-validating/re-writing.
  const existing = workspace.listAuditEvents(projectId).find((e) => e.operation === 'adapter:configureProjectRepository' && e.idempotencyKey === idempotencyKey)
  if (existing) {
    const config = readProjectRepositoryConfig(dataDir, projectId)
    return {
      ok: existing.outcome === 'ok',
      ...(existing.outcome === 'ok'
        ? { projectId, repositoryRoot: config?.repositoryRoot ?? '', auditEventId: existing.eventId, idempotentReplay: true }
        : { diagnostics: existing.diagnosticCodes.map((code) => makeDiagnostic(code, `replayed rejection: ${code}`)) }),
    } as AdapterConfigurationResponse
  }

  if (typeof repositoryRoot !== 'string' || !repositoryRoot.trim()) {
    return rejectAndLog('EUC16-ADAPTER-REPOSITORY-ROOT-INVALID', 'repositoryRoot must be a non-empty absolute path')
  }
  if (!path.isAbsolute(repositoryRoot)) {
    return rejectAndLog('EUC16-ADAPTER-REPOSITORY-ROOT-INVALID', `repositoryRoot must be an absolute path (received ${JSON.stringify(repositoryRoot)})`)
  }
  let stat: fs.Stats | undefined
  try {
    stat = fs.statSync(repositoryRoot)
  } catch {
    stat = undefined
  }
  if (!stat || !stat.isDirectory()) {
    return rejectAndLog('EUC16-ADAPTER-REPOSITORY-ROOT-NOT-FOUND', `repositoryRoot does not exist or is not a directory: ${repositoryRoot}`)
  }

  const resolvedRoot = path.resolve(repositoryRoot)
  writeProjectRepositoryConfigAtomic(dataDir, {
    schemaVersion: '1.0',
    projectId,
    repositoryRoot: resolvedRoot,
    configuredBy: actor as string,
    configuredAt: new Date().toISOString(),
  })

  const event = appendAdapterAuditEvent(workspace, {
    projectId,
    actor: actor as string,
    operation: 'adapter:configureProjectRepository',
    idempotencyKey,
    targetRecordId: projectId,
    outcome: 'ok',
    diagnosticCodes: [],
  })

  return { ok: true, projectId, repositoryRoot: resolvedRoot, auditEventId: event.eventId }
}

/** `adapter:getProjectRepository` — a read; no actor/idempotencyKey required, consistent with every §17.1 read operation. */
function getProjectRepository(dataDir: string, rawInput: unknown): AdapterConfigurationResponse {
  const input = (rawInput ?? {}) as Partial<GetProjectRepositoryInput>
  if (!isSafeProjectIdSegment(input.projectId)) {
    return { ok: false, diagnostics: [makeDiagnostic('EUC16-ADAPTER-INVALID-PROJECT-ID', 'projectId must be a single safe path segment', 'projectId')] }
  }
  const config = readProjectRepositoryConfig(dataDir, input.projectId)
  if (!config) {
    return {
      ok: false,
      diagnostics: [
        makeDiagnostic(
          'EUC16-ADAPTER-REPOSITORY-NOT-CONFIGURED',
          `no repository is configured for project "${input.projectId}"; call adapter:configureProjectRepository with a real repository path first`,
          'projectId',
        ),
      ],
    }
  }
  return { ok: true, projectId: input.projectId, repositoryRoot: config.repositoryRoot }
}

// ---------------------------------------------------------------------------
// Executors backed by the real filesystem (`packages/core`
// `capabilities/design/repositoryAdapter.ts`, EUC-15), scoped to the
// project's configured repository root.
// ---------------------------------------------------------------------------

const REPOSITORY_NOT_CONFIGURED_MESSAGE =
  'repository-not-configured: no repository root is configured for this project; call the adapter:configureProjectRepository operation (or, for the machine API/CLI adapters, pass a repositoryRoot option) with a real repository path before applying a delta'

/** Small stable hash for a diagnostic id suffix — copied from `designMachineApi.ts`'s local helper (that file is not importable from `apps/desktop`, only the package "." barrel is). */
function shortHash(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  return hash.toString(16)
}

function buildExecutors(repositoryRoot: string | undefined): DesignOperationExecutors {
  if (!repositoryRoot) {
    return {
      // §12.2 "apply ... against the real filesystem" — with no repository
      // configured this must fail honestly rather than silently touching
      // the workspace data directory (the reviewer P1 finding).
      applyDelta: (plan) => ({
        planId: plan.planId,
        applied: false,
        rolledBack: false,
        appliedFiles: [],
        failure: REPOSITORY_NOT_CONFIGURED_MESSAGE,
        completedAt: new Date().toISOString(),
      }),
      // verifyModule/configureBinding/verifyConnection/runScenario stay
      // unconfigured — operations.ts's own EUC16-EXECUTOR-NOT-CONFIGURED
      // diagnostic already names the missing hook.
    }
  }
  return {
    applyDelta: (plan, delta) =>
      applyDeltaTransactionally(plan, delta, repositoryRoot, {
        // §11.6/§12.2 revision-alignment fix — the *same* deterministic
        // computation `workspaceRevisionProvider` below supplies at
        // inspection time, so inspect and apply agree on real filesystem
        // state instead of comparing a module-design revision string to a
        // filesystem hash.
        currentRevision: workspaceRevision(repositoryRoot),
      }),
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
          cwd: repositoryRoot,
          root: repositoryRoot,
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
          id: `euc16.verify.${shortHash(line)}`,
          code: outcome.timedOut ? 'EUC16-VERIFY-TIMEOUT' : 'EUC16-VERIFY-FAILED',
          severity: 'blocker' as const,
          message: outcome.timedOut ? `verification command timed out: ${line}` : `verification command failed (exit ${outcome.exitCode ?? 'none'}): ${line}`,
        })),
      }
    },
    readRepositoryContext: ({ ownedPaths, editableSharedPaths }) =>
      readScopedContext({ root: repositoryRoot, includePaths: [...ownedPaths, ...editableSharedPaths] }).map((candidate) => ({
        ref: candidate.ref,
        content: candidate.content,
        bytes: candidate.bytes,
        contentHash: candidate.contentHash,
      })),
  }
}

function extractProjectId(args: unknown[]): string | undefined {
  const first = args[0]
  if (typeof first === 'string') return first
  if (first && typeof first === 'object' && typeof (first as { projectId?: unknown }).projectId === 'string') {
    return (first as { projectId: string }).projectId
  }
  return undefined
}

/**
 * Builds one `DesignWorkspace` for `dataDir` and returns a plain dispatch
 * function — no Electron dependency, so tests can call it directly.
 *
 * A fresh `DesignOperationsService` is built per dispatch call, scoped to
 * the request's `projectId` (see module doc — every project can have its
 * own configured repository root, and `DesignOperationExecutors` carries no
 * `projectId` parameter of its own, so the executors must be selected
 * before the service is constructed).
 *
 * `options.principal` is a test/embedder-only override for the stamped
 * identity (see the "trusted principal at the adapter boundary" block doc
 * above) — `registerDesignIpcHandlers` never supplies one, so the real
 * desktop app always derives it from the OS process identity.
 */
export function createDesignIpcDispatch(
  dataDir: string,
  options: { principal?: string } = {},
): (request: DesignBridgeRequest) => DesignBridgeResponse {
  const workspace = new DesignWorkspace(dataDir)
  // §4, §20.2, §17.3 — derived ONCE per dispatcher (per process, in
  // production), never per request; a request's own claimed `actor` never
  // decides this.
  const principal = resolveDispatchPrincipal(options.principal)

  return function dispatch(request: DesignBridgeRequest): DesignBridgeResponse {
    const { operation, args: rawArgs } = request
    const args = Array.isArray(rawArgs) ? rawArgs : []

    if (operation === 'adapter:configureProjectRepository') {
      const stampedArgs = stampPrincipalOnArgs(args, principal, workspace, operation)
      return configureProjectRepository(dataDir, workspace, stampedArgs[0])
    }
    if (operation === 'adapter:getProjectRepository') {
      return getProjectRepository(dataDir, args[0])
    }

    if (!(DESIGN_OPERATIONS as readonly string[]).includes(operation)) {
      return unknownOperationResult(operation)
    }

    const stampedArgs = stampPrincipalOnArgs(args, principal, workspace, operation)
    const projectId = extractProjectId(stampedArgs)
    const repositoryRoot = projectId ? readProjectRepositoryConfig(dataDir, projectId)?.repositoryRoot : undefined

    const deps: CreateDesignOperationsDeps = {
      workspace,
      executors: buildExecutors(repositoryRoot),
      ...(repositoryRoot ? { workspaceRevisionProvider: () => workspaceRevision(repositoryRoot) } : {}),
    }
    const service = createDesignOperations(deps)
    const byName = service as unknown as Record<string, (...args: unknown[]) => unknown>
    if (typeof byName[operation] !== 'function') {
      return unknownOperationResult(operation)
    }
    // `stampedArgs` is spread positionally onto the named service method —
    // the exact same call shape `designCli.ts` and `designMachineApi.ts`
    // use, so the same operation with the same args produces the same
    // result regardless of which adapter is called (§25.3), modulo the
    // `actor` stamp every adapter now applies at its own trust boundary.
    return byName[operation]!(...stampedArgs)
  }
}

/**
 * Registers the single `DESIGN_CHANNEL` handler. `getDataDir` is called at
 * most once per process — the `DesignWorkspace` is created lazily on the
 * first request and reused for the life of the process; each request still
 * builds its own project-scoped `DesignOperationsService` (see
 * `createDesignIpcDispatch`).
 */
export function registerDesignIpcHandlers(getDataDir: () => string): void {
  let dispatch: ((request: DesignBridgeRequest) => DesignBridgeResponse) | undefined
  ipcMain.handle(DESIGN_CHANNEL, (_event, request: DesignBridgeRequest) => {
    dispatch ??= createDesignIpcDispatch(getDataDir())
    return dispatch(request)
  })
}

export type { DesignOperationsService }
