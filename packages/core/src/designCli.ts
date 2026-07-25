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
 */

import { DesignWorkspace } from './capabilities/design/designWorkspace.js'
import { createDesignOperations, type DesignOperationExecutors } from './capabilities/design/operations.js'
import { canonicalize } from './capabilities/hash.js'
import { buildDefaultExecutors } from './designMachineApi.js'

export type DesignCliOptions = {
  dataDir: string
  stdout: (s: string) => void
  stderr: (s: string) => void
  /** Test hook — overrides the default filesystem-backed executors. */
  executors?: DesignOperationExecutors
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
  const service = createDesignOperations({
    workspace,
    executors: opts.executors ?? buildDefaultExecutors(dataDir),
  })
  const byName = service as unknown as Record<string, (...args: unknown[]) => unknown>

  if (operation === 'list-operations') {
    opts.stdout(stableStringify(Object.keys(byName)) + '\n')
    return 0
  }

  if (typeof byName[operation] !== 'function') {
    opts.stderr(`unknown operation: ${operation}\n`)
    return 2
  }

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

  const result = await byName[operation]!(...args)
  opts.stdout(stableStringify(result) + '\n')
  const ok =
    result && typeof result === 'object' && 'ok' in (result as Record<string, unknown>)
      ? (result as { ok?: unknown }).ok
      : true
  return ok === false ? 1 : 0
}
