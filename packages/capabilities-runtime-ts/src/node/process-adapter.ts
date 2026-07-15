/**
 * Process/command adapter foundation (§15.3). Executes an explicit
 * executable with an argument array — never a shell string — against an
 * allow-listed executable and working-root, with bounded output, a
 * timeout, and cooperative cancellation via `AbortSignal`. Shell
 * interpolation is never the default: `child_process.spawn` is always
 * invoked with `shell: false`.
 */

import { spawn } from 'node:child_process'
import * as path from 'node:path'

export interface ProcessAdapterOptions {
  /** Executables this adapter may invoke (compared by exact string match). */
  readonly allowedExecutables: ReadonlyArray<string>
  /** Absolute directories a command's working directory must be inside. */
  readonly allowedWorkingRoots: ReadonlyArray<string>
  readonly timeoutMs?: number
  readonly maxOutputBytes?: number
}

export interface RunCommandRequest {
  readonly executable: string
  /** Argument array passed directly to the executable; never shell-interpolated. */
  readonly args: ReadonlyArray<string>
  readonly cwd: string
  readonly env?: Readonly<Record<string, string>>
  readonly signal?: AbortSignal
}

export interface RunCommandResult {
  readonly exitCode: number | null
  readonly signal: string | null
  readonly stdout: string
  readonly stderr: string
  readonly timedOut: boolean
}

export class ProcessAdapterError extends Error {
  constructor(
    message: string,
    readonly code: 'executable-not-allowed' | 'cwd-not-allowed' | 'unsafe-argument',
  ) {
    super(message)
    this.name = 'ProcessAdapterError'
  }
}

// Disallowed outside an explicit argv array: shell metacharacters that would
// have special meaning if this string were ever concatenated into a shell
// command line. Rejecting them here defends callers even if a future code
// path is tempted to build a shell string from adapter inputs.
const SHELL_METACHARACTERS = /[\0;&|`$(){}<>\n\r"'\\*?~[\]!#]/

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_OUTPUT_BYTES = 1_048_576

/** Runs allow-listed commands via argv arrays with bounded output, timeout, and cancellation. */
export class NodeProcessAdapter {
  constructor(private readonly options: ProcessAdapterOptions) {}

  async run(request: RunCommandRequest): Promise<RunCommandResult> {
    if (!this.options.allowedExecutables.includes(request.executable)) {
      throw new ProcessAdapterError(`executable "${request.executable}" is not in the allow-list`, 'executable-not-allowed')
    }

    const resolvedCwd = path.resolve(request.cwd)
    const cwdAllowed = this.options.allowedWorkingRoots.some((root) => {
      const resolvedRoot = path.resolve(root)
      return resolvedCwd === resolvedRoot || resolvedCwd.startsWith(resolvedRoot + path.sep)
    })
    if (!cwdAllowed) {
      throw new ProcessAdapterError(`working directory "${request.cwd}" is not within an allowed root`, 'cwd-not-allowed')
    }

    for (const arg of request.args) {
      if (SHELL_METACHARACTERS.test(arg)) {
        throw new ProcessAdapterError(`argument "${arg}" contains a disallowed shell metacharacter`, 'unsafe-argument')
      }
    }

    const timeoutMs = this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const maxOutputBytes = this.options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES

    return new Promise<RunCommandResult>((resolve, reject) => {
      const child = spawn(request.executable, request.args, {
        cwd: resolvedCwd,
        env: request.env,
        shell: false,
      })

      let stdout = ''
      let stderr = ''
      let stdoutBytes = 0
      let stderrBytes = 0
      let timedOut = false
      let settled = false

      const timer = setTimeout(() => {
        timedOut = true
        child.kill('SIGTERM')
      }, timeoutMs)
      const withUnref = timer as unknown as { unref?: () => void }
      if (typeof withUnref.unref === 'function') withUnref.unref()

      const onAbort = (): void => {
        child.kill('SIGTERM')
      }
      request.signal?.addEventListener('abort', onAbort)

      const cleanup = (): void => {
        clearTimeout(timer)
        request.signal?.removeEventListener('abort', onAbort)
      }

      child.stdout?.on('data', (chunk: Buffer) => {
        stdoutBytes += chunk.length
        if (stdoutBytes <= maxOutputBytes) stdout += chunk.toString('utf8')
      })
      child.stderr?.on('data', (chunk: Buffer) => {
        stderrBytes += chunk.length
        if (stderrBytes <= maxOutputBytes) stderr += chunk.toString('utf8')
      })

      child.on('error', (error) => {
        if (settled) return
        settled = true
        cleanup()
        reject(error)
      })

      child.on('close', (exitCode, signal) => {
        if (settled) return
        settled = true
        cleanup()
        resolve({ exitCode, signal, stdout, stderr, timedOut })
      })
    })
  }
}
