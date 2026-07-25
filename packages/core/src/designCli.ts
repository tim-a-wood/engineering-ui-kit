/**
 * EUC-16 — CLI adapter for the use-case-led Capabilities design workflow
 * (§17, §25.3 "IPC, CLI, and machine API return the same structured result
 * for the same operation").
 *
 * `runDesignCli` builds the same `DesignOperationsService`
 * (`capabilities/design/operations.ts`, EUC-16 core) that
 * `apps/desktop/src/capabilities/designIpc.ts` and `designMachineApi.ts`
 * call, dispatches to the named operation with the args array from `--json`,
 * and prints the operation's result to stdout with a stable (canonical
 * key order) `JSON.stringify` — the same JSON shape the other two adapters
 * produce for the same operation and arguments.
 *
 *   euik-design <operation> --json '<argsJson>' [--data-dir path]
 *   euik-design list-operations
 *
 * `<argsJson>` is a JSON array spread positionally onto the service method,
 * e.g. `--json '["project-1"]'` for a §17.1 read operation, or
 * `--json '[{"projectId":"project-1","actor":"user:tim","idempotencyKey":"k1",...}]'`
 * for a §17.2 change operation (which always takes one input object).
 *
 * Reviewer P1 fix (mirrors `apps/desktop/src/capabilities/designIpc.ts` and
 * `designMachineApi.ts` — see those files' module docs): `DesignCliOptions.
 * repositoryRoot` (a single path, or a `{ [projectId]: path }` map) supplies
 * the project's real repository root for the `applyDelta`/`verifyModule`/
 * `readRepositoryContext` executors `buildDefaultExecutors`
 * (`designMachineApi.ts`) builds — never `dataDir`. With no `repositoryRoot`
 * resolved for the invocation's project, `applyDelta` fails honestly
 * (`'repository-not-configured: ...'`) instead of silently applying into
 * `dataDir`.
 *
 * Second-review P1 fix (trusted principal at the adapter boundary, mirrors
 * `designMachineApi.ts` — see its module doc "Trust model"):
 * `DesignCliOptions.principal` (`"user:<id>"`) stamps/overrides the `actor`
 * field of every §17.2 change-operation request this CLI dispatches — a
 * `--json` argument cannot assert an arbitrary actor. `principal` is opt-in
 * (see `designMachineApi.ts`'s module doc for why the default is not
 * automatic): a real `euik-design` binary wrapper should pass
 * `principal: deriveOsPrincipal()` (exported by `designMachineApi.ts`) so a
 * real terminal invocation always stamps the actual OS user running the
 * command; a caller that omits `principal` keeps this adapter's pre-fix
 * behavior (the `--json` body's own `actor` is trusted unchanged).
 */

import { DesignWorkspace } from './capabilities/design/designWorkspace.js'
import { createDesignOperations, type CreateDesignOperationsDeps, type DesignOperationExecutors } from './capabilities/design/operations.js'
import { workspaceRevision } from './capabilities/design/repositoryAdapter.js'
import { canonicalize } from './capabilities/hash.js'
import {
  buildDefaultExecutors,
  buildRepositoryNotConfiguredExecutors,
  extractProjectId,
  resolvePrincipal,
  resolveRepositoryRoot,
  stampPrincipal,
  type RepositoryRootOption,
} from './designMachineApi.js'

export type DesignCliOptions = {
  dataDir: string
  stdout: (s: string) => void
  stderr: (s: string) => void
  /** Test hook — overrides the default filesystem-backed executors. */
  executors?: DesignOperationExecutors
  /** The project's real repository root(s) — see module doc. */
  repositoryRoot?: RepositoryRootOption
  /** §4, §20.2 (finding — trusted principal at the adapter boundary) — see module doc. Opt-in: no stamping when omitted. */
  principal?: string
}

/** Stable stringify: recursively sorted object keys, so identical results serialize identically regardless of construction order (§25.3 equivalence). */
function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

const USAGE = "usage: euik-design <operation> --json '<argsJson>' [--data-dir path]\n       euik-design list-operations\n"

/**
 * Runs one CLI invocation. Exit codes: `0` when the result is not an
 * explicit rejection (`result.ok !== false` — true for every §17.1 read
 * result, which has no `ok` field), `1` when `result.ok === false`, `2` for
 * a usage error (missing/unknown operation, malformed `--json`, missing flag
 * value) — never a thrown exception.
 */
export async function runDesignCli(argv: string[], opts: DesignCliOptions): Promise<number> {
  const [operation, ...rest] = argv
  if (!operation) {
    opts.stderr(USAGE)
    return 2
  }

  let jsonArg: string | undefined
  let dataDir = opts.dataDir
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i]
    if (token === '--json') {
      const value = rest[++i]
      if (value === undefined) {
        opts.stderr('--json requires a value\n')
        return 2
      }
      jsonArg = value
    } else if (token === '--data-dir') {
      const value = rest[++i]
      if (value === undefined) {
        opts.stderr('--data-dir requires a value\n')
        return 2
      }
      dataDir = value
    } else {
      opts.stderr(`unknown flag: ${token}\n`)
      return 2
    }
  }

  const workspace = new DesignWorkspace(dataDir)

  if (operation === 'list-operations') {
    // No real executors needed to enumerate operation names — they do not
    // change which methods the service exposes.
    const names = Object.keys(createDesignOperations({ workspace }))
    opts.stdout(stableStringify(names) + '\n')
    return 0
  }

  // Parsed before the service is built: the resolved `projectId` selects
  // this invocation's `repositoryRoot` (see module doc), which the
  // executors need before `createDesignOperations` is called.
  let args: unknown[] = []
  if (jsonArg !== undefined) {
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonArg)
    } catch (error) {
      opts.stderr(`invalid --json: ${error instanceof Error ? error.message : String(error)}\n`)
      return 2
    }
    if (!Array.isArray(parsed)) {
      opts.stderr('--json must be a JSON array of arguments\n')
      return 2
    }
    args = parsed
  }

  // §4, §20.2 (finding — trusted principal at the adapter boundary):
  // resolved once per invocation, from `opts.principal` (the embedder's
  // authenticated caller) — opt-in; see `designMachineApi.ts` module doc.
  let principal: string | undefined
  try {
    principal = resolvePrincipal(opts.principal)
  } catch (error) {
    opts.stderr(`${error instanceof Error ? error.message : String(error)}\n`)
    return 2
  }
  const stampedArgs = stampPrincipal(args, principal, workspace, operation)

  const projectId = extractProjectId(stampedArgs)
  const repositoryRoot = resolveRepositoryRoot(opts.repositoryRoot, projectId)
  const executors = opts.executors ?? (repositoryRoot ? buildDefaultExecutors(repositoryRoot) : buildRepositoryNotConfiguredExecutors())
  const deps: CreateDesignOperationsDeps = {
    workspace,
    executors,
    ...(repositoryRoot ? { workspaceRevisionProvider: () => workspaceRevision(repositoryRoot) } : {}),
  }
  const service = createDesignOperations(deps)
  const byName = service as unknown as Record<string, (...args: unknown[]) => unknown>

  if (typeof byName[operation] !== 'function') {
    opts.stderr(`unknown operation: ${operation}\n`)
    return 2
  }

  const result = await byName[operation]!(...stampedArgs)
  opts.stdout(stableStringify(result) + '\n')
  const ok =
    result && typeof result === 'object' && 'ok' in (result as Record<string, unknown>)
      ? (result as { ok?: unknown }).ok
      : true
  return ok === false ? 1 : 0
}
