/**
 * Spawns the REAL Python FastAPI host (`../../src/capabilities_react_python_reference/http_app.py`)
 * as a real OS subprocess, using the pre-provisioned venv interpreter, on
 * an ephemeral loopback port — the "spawn the real Python FastAPI server
 * as a subprocess ... on an ephemeral port; wait for readiness" backbone
 * CAP-TEST-066 and CAP-TEST-069 both build on. No Node/Electron/desktop
 * dependency exists on the Python side: this helper only shells out to
 * `python -m capabilities_react_python_reference.http_app`, exactly as a
 * real deployment would run it.
 */
// Imported explicitly and ALIASED (rather than relying on the ambient
// global `URL`, and rather than a local binding literally named `URL`):
// this module is transitively imported by a test file that runs under
// vitest's `jsdom` environment (CAP-TEST-066), which replaces the global
// `URL` with jsdom's browser-realistic implementation. A local binding
// named exactly `URL` was observed to still resolve to that jsdom
// implementation in this environment (rejecting `file:`-scheme URLs with
// "The URL must be of scheme file"); aliasing to `NodeURL` sidesteps
// whatever global-shim mechanism causes that name collision, so this
// helper reliably gets Node's own `URL`/`fileURLToPath` regardless of
// which test environment (`node`/`jsdom`) the importing test file
// declares.
import { URL as NodeURL, fileURLToPath } from 'node:url'
import { spawn, type ChildProcess } from 'node:child_process'
import * as net from 'node:net'
import * as path from 'node:path'

const EXAMPLE_ROOT = path.resolve(fileURLToPath(new NodeURL('../..', import.meta.url)))
const REPO_ROOT = path.resolve(EXAMPLE_ROOT, '..', '..')

/**
 * The pre-provisioned worktree venv interpreter. Computed relative to
 * this file (not hardcoded to a single machine path) so the same helper
 * works from any worktree checkout of this repository; overridable via
 * `CAPABILITIES_PYTHON_INTERPRETER` for CI environments that provision the
 * venv elsewhere.
 */
export const PYTHON_INTERPRETER =
  process.env.CAPABILITIES_PYTHON_INTERPRETER ?? path.join(REPO_ROOT, '.venv', 'bin', 'python')

const EXAMPLE_SRC = path.join(EXAMPLE_ROOT, 'src')
const RUNTIME_SRC = path.join(REPO_ROOT, 'runtimes', 'python', 'src')

export interface PythonServerHandle {
  readonly baseUrl: string
  readonly port: number
  stop(): Promise<void>
}

/** Finds a free TCP port on the loopback interface by binding to port 0 and immediately releasing it. */
async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      if (address === null || typeof address === 'string') {
        probe.close()
        reject(new Error('failed to determine a free port'))
        return
      }
      const { port } = address
      probe.close(() => resolve(port))
    })
  })
}

async function waitForReadiness(baseUrl: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/healthz`)
      if (response.ok) return
      lastError = new Error(`readiness probe returned status ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(
    `Python host at ${baseUrl} did not become ready within ${timeoutMs}ms: ${String(lastError)}`,
  )
}

/**
 * Starts the real Python host as a subprocess on a fresh ephemeral port
 * and waits until it answers its liveness route. Callers MUST always
 * `stop()` the returned handle (e.g. in `afterAll`/`finally`), which sends
 * `SIGTERM` and waits for the process to exit.
 */
export async function startPythonServer(): Promise<PythonServerHandle> {
  const port = await findFreePort()
  const baseUrl = `http://127.0.0.1:${port}`

  const existingPythonPath = process.env.PYTHONPATH
  const pythonPath = [EXAMPLE_SRC, RUNTIME_SRC, existingPythonPath].filter(Boolean).join(path.delimiter)

  const child: ChildProcess = spawn(PYTHON_INTERPRETER, ['-m', 'capabilities_react_python_reference.http_app'], {
    cwd: EXAMPLE_ROOT,
    env: { ...process.env, PORT: String(port), PYTHONPATH: pythonPath },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stderrOutput = ''
  child.stderr?.on('data', (chunk: Buffer) => {
    stderrOutput += chunk.toString('utf8')
  })

  // Races readiness against an early (unexpected) process exit, so a
  // startup failure fails fast with the process's stderr rather than
  // waiting out the full readiness timeout. `.catch(() => {})` gives this
  // promise a handler immediately so Node never reports it as an
  // unhandled rejection if the process happens to exit normally, later,
  // after the race below has already settled via readiness.
  const exitedEarly = new Promise<never>((_, reject) => {
    child.once('exit', (code, signal) => {
      reject(new Error(`Python host process exited early (code=${code}, signal=${signal}):\n${stderrOutput}`))
    })
  })
  exitedEarly.catch(() => {})

  try {
    await Promise.race([waitForReadiness(baseUrl, 15_000), exitedEarly])
  } catch (error) {
    child.kill('SIGTERM')
    throw error
  }

  async function stop(): Promise<void> {
    if (child.exitCode !== null || child.signalCode !== null) return
    await new Promise<void>((resolve) => {
      child.once('exit', () => resolve())
      child.kill('SIGTERM')
      setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
      }, 5_000).unref()
    })
  }

  return { baseUrl, port, stop }
}
