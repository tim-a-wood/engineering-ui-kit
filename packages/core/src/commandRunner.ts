/**
 * Verification command runner (PRD §28.5).
 *
 * Runs configured verification commands with timeouts, captures output to
 * files, and returns `VerificationResult` records. Also owns dev-server
 * lifecycle helpers with explicit port probing (trial findings ENV-1/ENV-2:
 * never assume a framework default port; own the process lifecycle).
 */

import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import type { VerificationResult } from './types.js'
import { redactSensitiveText } from './capabilities/redaction.js'

export type RunCommandOptions = {
  runId: string
  commandLabel: string
  /** Full shell command text, e.g. "npm run typecheck". */
  commandText: string
  workingDirectory: string
  timeoutMs?: number
  outputDir?: string
  now?: () => Date
}

export async function runCommand(options: RunCommandOptions): Promise<VerificationResult> {
  const startedAt = (options.now?.() ?? new Date()).toISOString()
  const timeoutMs = options.timeoutMs ?? 10 * 60 * 1000

  let stdout = ''
  let stderr = ''
  let timedOut = false
  const maxCapturedBytes = 1_048_576
  const appendBounded = (current: string, chunk: Buffer): string => {
    if (Buffer.byteLength(current, 'utf8') >= maxCapturedBytes) return current
    const next = current + chunk.toString()
    if (Buffer.byteLength(next, 'utf8') <= maxCapturedBytes) return next
    return Buffer.from(next, 'utf8').subarray(0, maxCapturedBytes).toString('utf8') + '\n[output truncated]\n'
  }

  const exitCode = await new Promise<number | null>((resolve) => {
    // Run the shell in its own process group (detached) so a timeout can kill the WHOLE tree.
    // With shell:true, child.kill() would only signal the shell; a runaway grandchild keeps the
    // stdout/stderr pipes open and 'close' never fires. Killing the group (negative pid) reaps it.
    const detached = process.platform !== 'win32'
    const child = spawn(options.commandText, {
      cwd: options.workingDirectory,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached,
    })
    const killTree = (signal: NodeJS.Signals) => {
      if (process.platform === 'win32' && typeof child.pid === 'number') {
        const taskkill = spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
          stdio: 'ignore',
          windowsHide: true,
        })
        if (taskkill.status === 0) return
      }
      try {
        if (detached && typeof child.pid === 'number') process.kill(-child.pid, signal)
        else child.kill(signal)
      } catch {
        child.kill(signal)
      }
    }
    const timer = setTimeout(() => {
      timedOut = true
      killTree('SIGKILL')
    }, timeoutMs)
    child.stdout.on('data', (d: Buffer) => { stdout = appendBounded(stdout, d) })
    child.stderr.on('data', (d: Buffer) => { stderr = appendBounded(stderr, d) })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve(code)
    })
    child.on('error', () => {
      clearTimeout(timer)
      resolve(null)
    })
  })

  const endedAt = (options.now?.() ?? new Date()).toISOString()
  const result: VerificationResult = {
    runId: options.runId,
    commandLabel: options.commandLabel,
    commandText: redactSensitiveText(options.commandText),
    workingDirectory: options.workingDirectory,
    startedAt,
    endedAt,
    exitCode,
    status: timedOut ? 'timed-out' : exitCode === 0 ? 'passed' : 'failed',
    wasCancelledByUser: false,
  }

  if (options.outputDir) {
    fs.mkdirSync(options.outputDir, { recursive: true })
    const base = `${options.commandLabel.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}`
    const stdoutPath = path.join(options.outputDir, `${base}.stdout.log`)
    const stderrPath = path.join(options.outputDir, `${base}.stderr.log`)
    const combinedPath = path.join(options.outputDir, `${base}.combined.log`)
    const safeStdout = redactSensitiveText(stdout)
    const safeStderr = redactSensitiveText(stderr)
    fs.writeFileSync(stdoutPath, safeStdout)
    fs.writeFileSync(stderrPath, safeStderr)
    fs.writeFileSync(combinedPath, safeStdout + (safeStderr ? `\n--- stderr ---\n${safeStderr}` : ''))
    result.stdoutPath = stdoutPath
    result.stderrPath = stderrPath
    result.combinedOutputPath = combinedPath
  }

  return result
}

/** Find a free TCP port on 127.0.0.1 by asking the OS for an ephemeral port. */
export async function probeFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address && typeof address === 'object') {
        const port = address.port
        server.close(() => resolve(port))
      } else {
        server.close(() => reject(new Error('could not determine probed port')))
      }
    })
  })
}

export type DevServer = {
  port: number
  url: string
  stop: () => Promise<void>
}

export type StartDevServerOptions = {
  /** Command template; `{{PORT}}` is replaced with the probed port. */
  commandTemplate: string
  workingDirectory: string
  /** Path probed for readiness, default "/". */
  healthPath?: string
  startupTimeoutMs?: number
}

/**
 * Start a dev server on an explicitly probed free port and wait until it
 * answers HTTP before returning. Callers own calling `stop()`.
 */
export async function startDevServer(options: StartDevServerOptions): Promise<DevServer> {
  const port = await probeFreePort()
  const commandText = options.commandTemplate.replaceAll('{{PORT}}', String(port))
  const child: ChildProcess = spawn(commandText, {
    cwd: options.workingDirectory,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  })

  const url = `http://127.0.0.1:${port}${options.healthPath ?? '/'}`
  const deadline = Date.now() + (options.startupTimeoutMs ?? 30_000)

  let ready = false
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        ready = true
        break
      }
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250))
  }

  const stop = async () => {
    if (child.pid && !child.killed) {
      child.kill('SIGTERM')
      await new Promise((r) => setTimeout(r, 300))
      if (!child.killed) child.kill('SIGKILL')
    }
  }

  if (!ready) {
    await stop()
    throw new Error(`dev server did not answer at ${url} within timeout`)
  }

  return { port, url: `http://127.0.0.1:${port}`, stop }
}
