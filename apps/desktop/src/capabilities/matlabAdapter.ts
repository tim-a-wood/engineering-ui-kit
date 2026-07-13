/**
 * CAP-PKT-020/021/022 — Real production MATLAB adapter (CAP-DEC-012 / CAP-DEC-013).
 *
 * The desktop (Node) process owns the MATLAB Engine API boundary. This module
 * spawns a Python worker (`matlab_bridge.py`, using `matlab.engine`) as a child
 * process and talks to it over newline-delimited JSON on stdio. The renderer
 * never receives an engine handle — it only ever sees serializable result
 * envelopes produced here.
 *
 * The adapter logic (per-project serialization, allowlists, value validation,
 * snapshots, health/crash state, envelopes) is worker-agnostic. Two workers
 * implement the same private protocol:
 *   - RealMatlabWorker  — spawns matlab_bridge.py; used when the Engine is present.
 *   - FakeMatlabWorker   — deterministic in-process emulator; used under
 *                          EUIK_TEST_MODE=1 or whenever discovery genuinely fails.
 * Because both share one code path, the real implementation stays present and
 * reachable while the fake path keeps tests hermetic with no MATLAB installed.
 *
 * Security invariants:
 *   - No arbitrary raw eval bridge: expressions must clear an allowlist regex,
 *     functions an allowlist set, scripts an approved-id map.
 *   - Unsupported values are rejected with a typed error, never stringified.
 *   - Result envelopes never contain absolute host paths (only project-relative
 *     refs and opaque ids).
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  successResult,
  technicalFailureResult,
  sanitizeBoundaryError,
  type ResultEnvelope,
  type ErrorCategory,
  type MatlabSessionState,
} from '@engineering-ui-kit/core'

const SCHEMA_VERSION = '1.0' as const
const SNAPSHOT_SCHEMA_VERSION = '1.0' as const

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type MatlabToolboxReadiness = { name: string; ready: boolean }

/** CAP-CONTRACT-019 — carries no engine handle. */
export type MatlabSessionRecord = {
  schemaVersion: '1.0'
  projectId: string
  sessionId: string
  state: MatlabSessionState
  matlabVersion?: string
  toolboxReadiness: MatlabToolboxReadiness[]
  processOwnership: 'app-owned'
  startedAt?: string
  lastUsedAt?: string
  initRecipeRevision?: string
  inMemoryStateRevision?: string
  currentJobId?: string
  lastDiagnosticId?: string
}

export type MatlabDiscovery = {
  available: boolean
  mode: 'real' | 'fake'
  /** Exact failure reason when the real Engine is unavailable. */
  reason?: string
  pythonPath?: string
  pythonVersion?: string
  matlabVersion?: string
  engineVersion?: string
}

export type MatlabAllowlist = {
  /** Approved named functions callable via callFunction. */
  functions?: readonly string[]
  /** Approved scripts by id — the adapter never runs raw script text. */
  scripts?: Readonly<Record<string, string>>
  /** Allowlisted expression shape; defaults to arithmetic-only. */
  expression?: RegExp
  /** Variable names permitted in workspace put/get/snapshot operations. */
  variables?: readonly string[]
}

export type MatlabAdapterOptions = {
  /** Resolver for a project's capability root; snapshots live under it. */
  rootDir: (projectId: string) => string
  /** Force the deterministic fake worker (EUIK_TEST_MODE). */
  forceFakeMode?: boolean
  pythonPath?: string
  bridgeScriptPath?: string
  allowlist?: MatlabAllowlist
  /** Approved initialization recipe rerun on start/restart. */
  initRecipe?: { revision: string; expressions: readonly string[] }
  now?: () => string
  /** Test seam: build a worker (overrides real/fake selection). */
  createWorker?: (mode: 'real' | 'fake') => MatlabWorker
  /** Register process-exit shutdown so sessions never outlive the app. */
  registerExitShutdown?: boolean
}

export type CallFunctionRequest = { name: string; args?: unknown[]; nargout?: number }
export type EvalExpressionRequest = { expression: string }
export type RunScriptRequest = { scriptId: string }
export type WorkspacePutRequest = { name: string; value: unknown }
export type WorkspaceGetRequest = { name: string }
export type WorkspaceClearRequest = { names?: string[] }
export type WorkingDirRequest = { relativePath: string }
export type AddPathRequest = { relativePath: string }
export type SnapshotSaveRequest = { variables: string[]; jobId?: string }
export type SnapshotRestoreRequest = { snapshotId: string }

export interface MatlabAdapter {
  discover(): Promise<MatlabDiscovery>
  getStatus(projectId: string): MatlabSessionRecord
  start(projectId: string): Promise<ResultEnvelope>
  stop(projectId: string): Promise<ResultEnvelope>
  restart(projectId: string): Promise<ResultEnvelope>
  callFunction(projectId: string, req: CallFunctionRequest): Promise<ResultEnvelope>
  evalExpression(projectId: string, req: EvalExpressionRequest): Promise<ResultEnvelope>
  runScript(projectId: string, req: RunScriptRequest): Promise<ResultEnvelope>
  workspacePut(projectId: string, req: WorkspacePutRequest): Promise<ResultEnvelope>
  workspaceGet(projectId: string, req: WorkspaceGetRequest): Promise<ResultEnvelope>
  workspaceList(projectId: string): Promise<ResultEnvelope>
  workspaceClear(projectId: string, req: WorkspaceClearRequest): Promise<ResultEnvelope>
  setWorkingDirectory(projectId: string, req: WorkingDirRequest): Promise<ResultEnvelope>
  addPath(projectId: string, req: AddPathRequest): Promise<ResultEnvelope>
  snapshotSave(projectId: string, req: SnapshotSaveRequest): Promise<ResultEnvelope>
  snapshotRestore(projectId: string, req: SnapshotRestoreRequest): Promise<ResultEnvelope>
  /** Simulate an engine crash (kills the worker; state becomes unhealthy). */
  simulateCrash(projectId: string): Promise<void>
  /** Stop every session; call on desktop exit. */
  shutdownAll(): Promise<void>
}

// ---------------------------------------------------------------------------
// Worker protocol
// ---------------------------------------------------------------------------

type WorkerRequest =
  | { cmd: 'version' }
  | { cmd: 'eval'; expression: string }
  | { cmd: 'call'; name: string; args: unknown[]; nargout: number }
  | { cmd: 'script'; text: string }
  | { cmd: 'put'; name: string; value: unknown }
  | { cmd: 'get'; name: string }
  | { cmd: 'list' }
  | { cmd: 'clear'; names?: string[] }
  | { cmd: 'cd'; dir: string }
  | { cmd: 'addpath'; dir: string }
  | { cmd: 'save'; file: string; vars: string[] }
  | { cmd: 'load'; file: string; vars: string[] }
  | { cmd: 'shutdown' }

type WorkerResponse = Record<string, unknown> & { ok?: boolean; code?: string; message?: string }

export interface MatlabWorker {
  /** Resolve once the worker is ready, or reject with the exact failure reason. */
  ready(): Promise<void>
  send(request: WorkerRequest): Promise<WorkerResponse>
  kill(): void
  /** Called with the exit reason when the worker dies unexpectedly. */
  onExit(handler: (reason: string) => void): void
  matlabVersion?: string
  toolboxes?: MatlabToolboxReadiness[]
}

class WorkerError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly category: ErrorCategory,
    readonly retryability: 'none' | 'manual' = 'manual',
  ) {
    super(message)
  }
}

// ---------------------------------------------------------------------------
// Real worker: spawns matlab_bridge.py and speaks NDJSON over stdio.
// ---------------------------------------------------------------------------

class RealMatlabWorker implements MatlabWorker {
  private child: ChildProcessWithoutNullStreams
  private buffer = ''
  private nextId = 1
  private pending = new Map<number, { resolve: (r: WorkerResponse) => void; reject: (e: Error) => void }>()
  private readyResolve!: () => void
  private readyReject!: (e: Error) => void
  private readyPromise: Promise<void>
  private exitHandlers: ((reason: string) => void)[] = []
  private settledReady = false
  matlabVersion?: string
  toolboxes?: MatlabToolboxReadiness[]

  constructor(pythonPath: string, scriptPath: string) {
    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolve = resolve
      this.readyReject = reject
    })
    this.child = spawn(pythonPath, [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] })
    this.child.stdout.setEncoding('utf8')
    this.child.stdout.on('data', (chunk: string) => this.onData(chunk))
    this.child.on('exit', (code, signal) => {
      const reason = `matlab worker exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`
      if (!this.settledReady) {
        this.settledReady = true
        this.readyReject(new Error(reason))
      }
      for (const [, waiter] of this.pending) waiter.reject(new Error(reason))
      this.pending.clear()
      for (const handler of this.exitHandlers) handler(reason)
    })
    this.child.on('error', (err) => {
      if (!this.settledReady) {
        this.settledReady = true
        this.readyReject(err)
      }
    })
  }

  private onData(chunk: string): void {
    this.buffer += chunk
    let index: number
    while ((index = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, index).trim()
      this.buffer = this.buffer.slice(index + 1)
      if (!line) continue
      let message: WorkerResponse
      try {
        message = JSON.parse(line) as WorkerResponse
      } catch {
        continue
      }
      if (!this.settledReady && typeof message.ready === 'boolean') {
        this.settledReady = true
        if (message.ready) this.readyResolve()
        else this.readyReject(new Error(String(message.reason ?? 'matlab worker not ready')))
        continue
      }
      const id = message.id as number | undefined
      if (typeof id === 'number' && this.pending.has(id)) {
        const waiter = this.pending.get(id)!
        this.pending.delete(id)
        waiter.resolve(message)
      }
    }
  }

  ready(): Promise<void> {
    return this.readyPromise
  }

  send(request: WorkerRequest): Promise<WorkerResponse> {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      try {
        this.child.stdin.write(JSON.stringify({ id, ...request }) + '\n')
      } catch (err) {
        this.pending.delete(id)
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }

  kill(): void {
    try {
      this.child.kill('SIGKILL')
    } catch {
      /* already gone */
    }
  }

  onExit(handler: (reason: string) => void): void {
    this.exitHandlers.push(handler)
  }
}

// ---------------------------------------------------------------------------
// Fake worker: deterministic in-process MATLAB emulator (no install needed).
// ---------------------------------------------------------------------------

class FakeMatlabWorker implements MatlabWorker {
  private workspace = new Map<string, unknown>()
  private files = new Map<string, string>()
  private alive = true
  private exitHandlers: ((reason: string) => void)[] = []
  matlabVersion = '9.14.0 (R2023a) [fake-boundary]'
  toolboxes: MatlabToolboxReadiness[] = [
    { name: 'MATLAB', ready: true },
    { name: 'Simulink', ready: false },
  ]

  ready(): Promise<void> {
    return Promise.resolve()
  }

  onExit(handler: (reason: string) => void): void {
    this.exitHandlers.push(handler)
  }

  kill(): void {
    if (!this.alive) return
    this.alive = false
    this.workspace.clear()
    for (const handler of this.exitHandlers) handler('fake worker killed')
  }

  send(request: WorkerRequest): Promise<WorkerResponse> {
    if (!this.alive && request.cmd !== 'shutdown') {
      return Promise.reject(new Error('fake matlab worker is not alive'))
    }
    try {
      return Promise.resolve(this.handle(request))
    } catch (err) {
      return Promise.resolve({ ok: false, code: 'MATLAB_ERROR', message: (err as Error).message })
    }
  }

  private handle(request: WorkerRequest): WorkerResponse {
    switch (request.cmd) {
      case 'version':
        return { ok: true, matlabVersion: this.matlabVersion, toolboxes: this.toolboxes }
      case 'eval':
        return { ok: true, value: this.evalArithmetic(request.expression) }
      case 'call':
        return { ok: true, value: this.callBuiltin(request.name, request.args) }
      case 'script':
        return { ok: true, value: null, warnings: [], console: '' }
      case 'put':
        this.workspace.set(request.name, request.value)
        return { ok: true }
      case 'get':
        if (!this.workspace.has(request.name)) {
          return { ok: false, code: 'MATLAB_ERROR', message: `undefined variable: ${request.name}` }
        }
        return { ok: true, value: this.workspace.get(request.name) }
      case 'list':
        return { ok: true, names: [...this.workspace.keys()].sort() }
      case 'clear':
        if (request.names && request.names.length) {
          for (const name of request.names) this.workspace.delete(name)
        } else {
          this.workspace.clear()
        }
        return { ok: true }
      case 'cd':
      case 'addpath':
        return { ok: true }
      case 'save': {
        const payload: Record<string, unknown> = {}
        for (const name of request.vars) {
          if (!this.workspace.has(name)) {
            return { ok: false, code: 'MATLAB_ERROR', message: `undefined variable: ${name}` }
          }
          payload[name] = this.workspace.get(name)
        }
        const serialized = JSON.stringify(payload)
        this.files.set(request.file, serialized)
        fs.mkdirSync(path.dirname(request.file), { recursive: true })
        fs.writeFileSync(request.file, serialized)
        const checksum = crypto.createHash('sha256').update(serialized).digest('hex')
        return { ok: true, checksum, matlabVersion: this.matlabVersion }
      }
      case 'load': {
        const serialized = this.files.get(request.file) ?? (fs.existsSync(request.file) ? fs.readFileSync(request.file, 'utf8') : undefined)
        if (serialized === undefined) return { ok: false, code: 'MATLAB_ERROR', message: 'snapshot file missing' }
        const payload = JSON.parse(serialized) as Record<string, unknown>
        for (const name of request.vars) {
          if (name in payload) this.workspace.set(name, payload[name])
        }
        return { ok: true, names: request.vars }
      }
      case 'shutdown':
        this.alive = false
        this.workspace.clear()
        return { ok: true }
    }
  }

  /** Safe arithmetic evaluator — no JS eval. Supports + - * / ( ) and scalar vars. */
  private evalArithmetic(expression: string): number {
    const tokens = expression.match(/\d+\.?\d*|[a-zA-Z_]\w*|[+\-*/()]/g) ?? []
    let pos = 0
    const peek = () => tokens[pos]
    const parseExpr = (): number => {
      let value = parseTerm()
      while (peek() === '+' || peek() === '-') {
        const op = tokens[pos++]
        const rhs = parseTerm()
        value = op === '+' ? value + rhs : value - rhs
      }
      return value
    }
    const parseTerm = (): number => {
      let value = parseFactor()
      while (peek() === '*' || peek() === '/') {
        const op = tokens[pos++]
        const rhs = parseFactor()
        value = op === '*' ? value * rhs : value / rhs
      }
      return value
    }
    const parseFactor = (): number => {
      const token = peek()
      if (token === '(') {
        pos++
        const value = parseExpr()
        if (tokens[pos] !== ')') throw new Error('unbalanced parentheses')
        pos++
        return value
      }
      if (token === '-') {
        pos++
        return -parseFactor()
      }
      if (token === '+') {
        pos++
        return parseFactor()
      }
      if (token === undefined) throw new Error('unexpected end of expression')
      pos++
      if (/^[a-zA-Z_]/.test(token)) {
        const resolved = this.workspace.get(token)
        if (typeof resolved !== 'number') throw new Error(`unknown scalar variable: ${token}`)
        return resolved
      }
      const num = Number(token)
      if (!Number.isFinite(num)) throw new Error(`invalid number: ${token}`)
      return num
    }
    const result = parseExpr()
    if (pos !== tokens.length) throw new Error('trailing tokens in expression')
    return result
  }

  private callBuiltin(name: string, args: unknown[]): unknown {
    const nums = args.filter((a): a is number => typeof a === 'number')
    switch (name) {
      case 'zeros':
        return makeMatrix(args, 0)
      case 'ones':
        return makeMatrix(args, 1)
      case 'sum':
        return flatten(args[0]).reduce((a, b) => a + b, 0)
      case 'plus':
        return (nums[0] ?? 0) + (nums[1] ?? 0)
      case 'size':
        return Array.isArray(args[0]) ? [ (args[0] as unknown[]).length, 1 ] : [1, 1]
      case 'sqrt':
        return Math.sqrt(nums[0] ?? 0)
      case 'sin':
        return Math.sin(nums[0] ?? 0)
      case 'cos':
        return Math.cos(nums[0] ?? 0)
      default:
        throw new Error(`fake worker has no builtin: ${name}`)
    }
  }
}

function makeMatrix(args: unknown[], fill: number): number[] | number[][] {
  const rows = typeof args[0] === 'number' ? args[0] : 1
  const cols = typeof args[1] === 'number' ? args[1] : rows
  if (rows === 1) return new Array(cols).fill(fill)
  return Array.from({ length: rows }, () => new Array(cols).fill(fill))
}

function flatten(value: unknown): number[] {
  if (typeof value === 'number') return [value]
  if (Array.isArray(value)) return value.flatMap(flatten)
  return []
}

// ---------------------------------------------------------------------------
// Value validation — supported types only, never silently stringified.
// ---------------------------------------------------------------------------

function assertSupportedValue(value: unknown, pathLabel = 'value'): void {
  if (value === null) return
  const type = typeof value
  if (type === 'boolean' || type === 'string') return
  if (type === 'number') {
    if (!Number.isFinite(value as number)) {
      throw new WorkerError(`non-finite numeric at ${pathLabel}`, 'CAP-MATLAB-UNSUPPORTED-VALUE', 'validation', 'none')
    }
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertSupportedValue(item, `${pathLabel}[${i}]`))
    return
  }
  if (type === 'object') {
    const proto = Object.getPrototypeOf(value)
    if (proto !== Object.prototype && proto !== null) {
      throw new WorkerError(`unsupported object at ${pathLabel}`, 'CAP-MATLAB-UNSUPPORTED-VALUE', 'validation', 'none')
    }
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      assertSupportedValue(item, `${pathLabel}.${key}`)
    }
    return
  }
  throw new WorkerError(
    `unsupported ${type} at ${pathLabel}`,
    'CAP-MATLAB-UNSUPPORTED-VALUE',
    'validation',
    'none',
  )
}

// ---------------------------------------------------------------------------
// Snapshot metadata (CAP-CONTRACT-008 shaped)
// ---------------------------------------------------------------------------

type SnapshotMetadata = {
  schemaVersion: '1.0'
  snapshotId: string
  projectId: string
  variableAllowlist: string[]
  matlabVersion: string
  checksum: string
  createdAt: string
  jobId?: string
  initRecipeRevision?: string
  compatibilityStatus: 'compatible' | 'incompatible'
  /** Project-relative ref to the .mat file (never an absolute host path). */
  dataRef: string
}

// ---------------------------------------------------------------------------
// Adapter implementation
// ---------------------------------------------------------------------------

type Session = {
  worker: MatlabWorker
  record: MatlabSessionRecord
}

const DEFAULT_EXPRESSION_ALLOWLIST = /^[a-zA-Z0-9_+\-*/().\s]+$/
const DEFAULT_FUNCTION_ALLOWLIST = ['zeros', 'ones', 'sum', 'plus', 'size', 'sqrt', 'sin', 'cos']

function defaultBridgeScriptPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url))
  // Prefer the source .py that ships alongside this module (dist copies it too).
  const candidates = [
    path.join(here, 'matlab_bridge.py'),
    path.join(here, '..', '..', 'src', 'capabilities', 'matlab_bridge.py'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return candidates[0]!
}

export function createMatlabAdapter(options: MatlabAdapterOptions): MatlabAdapter {
  const now = options.now ?? (() => new Date().toISOString())
  const forceFake = options.forceFakeMode || process.env.EUIK_TEST_MODE === '1'
  const pythonPath = options.pythonPath ?? process.env.EUIK_MATLAB_PYTHON ?? 'python3'
  const bridgeScriptPath = options.bridgeScriptPath ?? defaultBridgeScriptPath()
  const exprAllowlist = options.allowlist?.expression ?? DEFAULT_EXPRESSION_ALLOWLIST
  const functionAllowlist = new Set(options.allowlist?.functions ?? DEFAULT_FUNCTION_ALLOWLIST)
  const scriptAllowlist = options.allowlist?.scripts ?? {}
  const variableAllowlist = options.allowlist?.variables ? new Set(options.allowlist.variables) : undefined

  const sessions = new Map<string, Session>()
  const queues = new Map<string, Promise<unknown>>()
  let discoveryCache: MatlabDiscovery | undefined

  /** Serialize all work for a single project; distinct projects run concurrently. */
  function enqueue<T>(projectId: string, task: () => Promise<T>): Promise<T> {
    const previous = queues.get(projectId) ?? Promise.resolve()
    const next = previous.then(task, task)
    queues.set(projectId, next.catch(() => undefined))
    return next
  }

  function provenance(source: string) {
    return { source, recordedAt: now() }
  }

  function makeWorker(mode: 'real' | 'fake'): MatlabWorker {
    if (options.createWorker) return options.createWorker(mode)
    if (mode === 'fake') return new FakeMatlabWorker()
    return new RealMatlabWorker(pythonPath, bridgeScriptPath)
  }

  function stoppedRecord(projectId: string): MatlabSessionRecord {
    return {
      schemaVersion: SCHEMA_VERSION,
      projectId,
      sessionId: `matlab-${projectId}-stopped`,
      state: 'stopped',
      toolboxReadiness: [],
      processOwnership: 'app-owned',
    }
  }

  function snapshotsDir(projectId: string): string {
    return path.join(options.rootDir(projectId), 'matlab-snapshots')
  }

  async function discover(): Promise<MatlabDiscovery> {
    if (discoveryCache) return discoveryCache
    if (forceFake) {
      discoveryCache = { available: false, mode: 'fake', reason: 'EUIK_TEST_MODE=1' }
      return discoveryCache
    }
    // Probe a real worker; if it cannot become ready, fall back to fake and
    // record the exact reason so real-integration tests can print it.
    let probe: MatlabWorker | undefined
    try {
      probe = makeWorker('real')
      await probe.ready()
      const version = await probe.send({ cmd: 'version' })
      discoveryCache = {
        available: true,
        mode: 'real',
        pythonPath,
        matlabVersion: typeof version.matlabVersion === 'string' ? version.matlabVersion : undefined,
        engineVersion: 'matlab.engine',
      }
      probe.kill()
      return discoveryCache
    } catch (err) {
      try {
        probe?.kill()
      } catch {
        /* ignore */
      }
      discoveryCache = {
        available: false,
        mode: 'fake',
        reason: err instanceof Error ? err.message : String(err),
        pythonPath,
      }
      return discoveryCache
    }
  }

  function getStatus(projectId: string): MatlabSessionRecord {
    const session = sessions.get(projectId)
    return session ? session.record : stoppedRecord(projectId)
  }

  async function ensureStarted(projectId: string): Promise<Session> {
    const existing = sessions.get(projectId)
    if (existing && existing.record.state !== 'unhealthy') return existing
    if (existing && existing.record.state === 'unhealthy') {
      // Never reuse an unhealthy session implicitly; caller must restart.
      throw new WorkerError('session is unhealthy; restart required', 'CAP-MATLAB-UNHEALTHY', 'dependency', 'manual')
    }
    const discovery = await discover()
    const worker = makeWorker(discovery.mode)
    const record: MatlabSessionRecord = {
      schemaVersion: SCHEMA_VERSION,
      projectId,
      sessionId: `matlab-${projectId}`,
      state: 'starting',
      toolboxReadiness: [],
      processOwnership: 'app-owned',
      startedAt: now(),
      inMemoryStateRevision: crypto.randomUUID(),
    }
    const session: Session = { worker, record }
    sessions.set(projectId, session)
    worker.onExit(() => {
      const current = sessions.get(projectId)
      if (current === session) current.record.state = 'unhealthy'
    })
    try {
      await worker.ready()
      const version = await worker.send({ cmd: 'version' })
      record.matlabVersion = typeof version.matlabVersion === 'string' ? version.matlabVersion : worker.matlabVersion
      record.toolboxReadiness = Array.isArray(version.toolboxes)
        ? (version.toolboxes as MatlabToolboxReadiness[])
        : worker.toolboxes ?? []
      if (options.initRecipe) {
        for (const expression of options.initRecipe.expressions) {
          await worker.send({ cmd: 'eval', expression })
        }
        record.initRecipeRevision = options.initRecipe.revision
      }
      record.state = 'ready'
      record.lastUsedAt = now()
      return session
    } catch (err) {
      record.state = 'unhealthy'
      record.lastDiagnosticId = crypto.randomUUID()
      throw err
    }
  }

  /** Run a worker call against a ready session, translating outcomes to envelopes. */
  async function withSession(
    projectId: string,
    source: string,
    fn: (session: Session) => Promise<ResultEnvelope>,
  ): Promise<ResultEnvelope> {
    return enqueue(projectId, async () => {
      let session: Session
      try {
        session = await ensureStarted(projectId)
      } catch (err) {
        return failureFrom(err, source)
      }
      session.record.state = 'busy'
      try {
        const result = await fn(session)
        if (session.record.state === 'busy') session.record.state = 'ready'
        session.record.lastUsedAt = now()
        return result
      } catch (err) {
        // A worker death mid-call leaves the session unhealthy.
        if (session.record.state === 'busy') {
          session.record.state = sessions.get(projectId) === session && session.record.state === 'busy'
            ? 'ready'
            : session.record.state
        }
        return failureFrom(err, source)
      }
    })
  }

  function failureFrom(err: unknown, source: string): ResultEnvelope {
    if (err instanceof WorkerError) {
      return technicalFailureResult(
        {
          schemaVersion: SCHEMA_VERSION,
          code: err.code,
          category: err.category,
          safeMessage: err.message,
          retryability: err.retryability,
          relatedIds: [],
          diagnosticRefs: [],
        },
        provenance(source),
      )
    }
    return technicalFailureResult(sanitizeBoundaryError(err), provenance(source))
  }

  function unwrap(response: WorkerResponse): unknown {
    if (response.ok === false) {
      const code = String(response.code ?? 'MATLAB_ERROR')
      const category: ErrorCategory = code === 'UNSUPPORTED_VALUE' ? 'validation' : 'execution'
      throw new WorkerError(String(response.message ?? 'matlab error'), `CAP-MATLAB-${code}`, category, category === 'validation' ? 'none' : 'manual')
    }
    return response.value
  }

  function assertVariableAllowed(name: string): void {
    if (variableAllowlist && !variableAllowlist.has(name)) {
      throw new WorkerError(`variable is not allowlisted: ${name}`, 'CAP-MATLAB-VAR-ALLOWLIST', 'authorization', 'none')
    }
  }

  // -- Lifecycle ------------------------------------------------------------

  async function start(projectId: string): Promise<ResultEnvelope> {
    return enqueue(projectId, async () => {
      try {
        const session = await ensureStarted(projectId)
        return successResult(publicRecord(session.record), provenance('matlab'))
      } catch (err) {
        return failureFrom(err, 'matlab')
      }
    })
  }

  async function stopInternal(projectId: string): Promise<void> {
    const session = sessions.get(projectId)
    if (!session) return
    try {
      await session.worker.send({ cmd: 'shutdown' })
    } catch {
      /* worker may already be dead */
    }
    session.worker.kill()
    sessions.delete(projectId)
  }

  async function stop(projectId: string): Promise<ResultEnvelope> {
    return enqueue(projectId, async () => {
      await stopInternal(projectId)
      return successResult({ state: 'stopped' }, provenance('matlab'))
    })
  }

  async function restart(projectId: string): Promise<ResultEnvelope> {
    return enqueue(projectId, async () => {
      await stopInternal(projectId)
      try {
        const session = await ensureStarted(projectId)
        // Honest readiness: prior in-memory workspace state did NOT survive.
        return successResult(
          { ...publicRecord(session.record), inMemoryStatePreserved: false },
          provenance('matlab'),
        )
      } catch (err) {
        return failureFrom(err, 'matlab')
      }
    })
  }

  function publicRecord(record: MatlabSessionRecord): MatlabSessionRecord {
    // Records already carry no engine handle or host path; return as-is.
    return { ...record }
  }

  // -- Execution ------------------------------------------------------------

  async function evalExpression(projectId: string, req: EvalExpressionRequest): Promise<ResultEnvelope> {
    return withSession(projectId, 'matlab', async (session) => {
      const expression = (req.expression ?? '').trim()
      if (!expression || !exprAllowlist.test(expression)) {
        throw new WorkerError('expression is not allowlisted', 'CAP-MATLAB-ALLOWLIST', 'authorization', 'none')
      }
      const value = unwrap(await session.worker.send({ cmd: 'eval', expression }))
      assertSupportedValue(value)
      return successResult({ expression, value }, provenance('matlab'))
    })
  }

  async function callFunction(projectId: string, req: CallFunctionRequest): Promise<ResultEnvelope> {
    return withSession(projectId, 'matlab', async (session) => {
      if (!functionAllowlist.has(req.name)) {
        throw new WorkerError(`function is not allowlisted: ${req.name}`, 'CAP-MATLAB-ALLOWLIST', 'authorization', 'none')
      }
      const args = req.args ?? []
      args.forEach((arg, i) => assertSupportedValue(arg, `args[${i}]`))
      const value = unwrap(
        await session.worker.send({ cmd: 'call', name: req.name, args, nargout: req.nargout ?? 1 }),
      )
      assertSupportedValue(value)
      return successResult({ name: req.name, value }, provenance('matlab'))
    })
  }

  async function runScript(projectId: string, req: RunScriptRequest): Promise<ResultEnvelope> {
    return withSession(projectId, 'matlab', async (session) => {
      const text = scriptAllowlist[req.scriptId]
      if (typeof text !== 'string') {
        throw new WorkerError(`script is not approved: ${req.scriptId}`, 'CAP-MATLAB-SCRIPT-ALLOWLIST', 'authorization', 'none')
      }
      const response = await session.worker.send({ cmd: 'script', text })
      unwrap(response)
      return successResult(
        {
          scriptId: req.scriptId,
          warnings: Array.isArray(response.warnings) ? response.warnings : [],
          console: typeof response.console === 'string' ? boundConsole(response.console) : '',
        },
        provenance('matlab'),
      )
    })
  }

  // -- Workspace ------------------------------------------------------------

  async function workspacePut(projectId: string, req: WorkspacePutRequest): Promise<ResultEnvelope> {
    return withSession(projectId, 'matlab', async (session) => {
      assertVariableAllowed(req.name)
      assertSupportedValue(req.value, req.name)
      unwrap(await session.worker.send({ cmd: 'put', name: req.name, value: req.value }))
      return successResult({ name: req.name }, provenance('matlab'))
    })
  }

  async function workspaceGet(projectId: string, req: WorkspaceGetRequest): Promise<ResultEnvelope> {
    return withSession(projectId, 'matlab', async (session) => {
      assertVariableAllowed(req.name)
      const value = unwrap(await session.worker.send({ cmd: 'get', name: req.name }))
      assertSupportedValue(value, req.name)
      return successResult({ name: req.name, value }, provenance('matlab'))
    })
  }

  async function workspaceList(projectId: string): Promise<ResultEnvelope> {
    return withSession(projectId, 'matlab', async (session) => {
      const response = await session.worker.send({ cmd: 'list' })
      const names = Array.isArray(response.names) ? (response.names as string[]) : []
      return successResult({ names }, provenance('matlab'))
    })
  }

  async function workspaceClear(projectId: string, req: WorkspaceClearRequest): Promise<ResultEnvelope> {
    return withSession(projectId, 'matlab', async (session) => {
      unwrap(await session.worker.send({ cmd: 'clear', names: req.names }))
      return successResult({ cleared: req.names ?? 'all' }, provenance('matlab'))
    })
  }

  // -- Path / working directory (relative refs only) ------------------------

  async function setWorkingDirectory(projectId: string, req: WorkingDirRequest): Promise<ResultEnvelope> {
    return withSession(projectId, 'matlab', async (session) => {
      const relative = safeRelative(req.relativePath)
      const abs = path.resolve(options.rootDir(projectId), relative)
      unwrap(await session.worker.send({ cmd: 'cd', dir: abs }))
      // Never leak the absolute host path back through the envelope.
      return successResult({ relativePath: relative }, provenance('matlab'))
    })
  }

  async function addPath(projectId: string, req: AddPathRequest): Promise<ResultEnvelope> {
    return withSession(projectId, 'matlab', async (session) => {
      const relative = safeRelative(req.relativePath)
      const abs = path.resolve(options.rootDir(projectId), relative)
      unwrap(await session.worker.send({ cmd: 'addpath', dir: abs }))
      return successResult({ relativePath: relative }, provenance('matlab'))
    })
  }

  // -- Snapshots ------------------------------------------------------------

  async function snapshotSave(projectId: string, req: SnapshotSaveRequest): Promise<ResultEnvelope> {
    return withSession(projectId, 'matlab', async (session) => {
      const variables = req.variables ?? []
      if (!variables.length) {
        throw new WorkerError('snapshot requires an explicit variable selection', 'CAP-MATLAB-SNAPSHOT-SCOPE', 'validation', 'none')
      }
      for (const name of variables) assertVariableAllowed(name)
      const dir = snapshotsDir(projectId)
      fs.mkdirSync(dir, { recursive: true })
      const snapshotId = `snap-${crypto.randomUUID()}`
      const fileName = `${snapshotId}.mat`
      const abs = path.join(dir, fileName)
      const saveResponse = await session.worker.send({ cmd: 'save', file: abs, vars: variables })
      const checksum = String(unwrapChecksum(saveResponse))
      const metadata: SnapshotMetadata = {
        schemaVersion: SNAPSHOT_SCHEMA_VERSION,
        snapshotId,
        projectId,
        variableAllowlist: [...variables].sort(),
        matlabVersion: typeof saveResponse.matlabVersion === 'string' ? saveResponse.matlabVersion : session.record.matlabVersion ?? 'unknown',
        checksum,
        createdAt: now(),
        jobId: req.jobId,
        initRecipeRevision: session.record.initRecipeRevision,
        compatibilityStatus: 'compatible',
        dataRef: fileName,
      }
      fs.writeFileSync(path.join(dir, `${snapshotId}.json`), JSON.stringify(metadata, null, 2))
      return successResult(
        { snapshotId, variables: metadata.variableAllowlist, checksum, dataRef: fileName },
        provenance('matlab'),
      )
    })
  }

  async function snapshotRestore(projectId: string, req: SnapshotRestoreRequest): Promise<ResultEnvelope> {
    return withSession(projectId, 'matlab', async (session) => {
      const dir = snapshotsDir(projectId)
      const metaPath = path.join(dir, `${req.snapshotId}.json`)
      if (!fs.existsSync(metaPath)) {
        throw new WorkerError('snapshot not found; session left usable but uninitialized', 'CAP-MATLAB-SNAPSHOT-MISSING', 'configuration', 'manual')
      }
      const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as SnapshotMetadata
      if (metadata.projectId !== projectId) {
        throw new WorkerError('snapshot belongs to another project', 'CAP-MATLAB-SNAPSHOT-SCOPE', 'authorization', 'none')
      }
      const dataPath = path.join(dir, metadata.dataRef)
      if (!fs.existsSync(dataPath)) {
        throw new WorkerError('snapshot data missing; session left usable but uninitialized', 'CAP-MATLAB-SNAPSHOT-MISSING', 'configuration', 'manual')
      }
      const actualChecksum = crypto.createHash('sha256').update(fs.readFileSync(dataPath)).digest('hex')
      if (actualChecksum !== metadata.checksum) {
        throw new WorkerError('snapshot checksum mismatch; session left usable but uninitialized', 'CAP-MATLAB-SNAPSHOT-CORRUPT', 'validation', 'none')
      }
      if (session.record.matlabVersion && metadata.matlabVersion !== 'unknown') {
        const compatible = majorRelease(metadata.matlabVersion) <= majorRelease(session.record.matlabVersion)
        if (!compatible) {
          throw new WorkerError('snapshot MATLAB version is incompatible; session left usable but uninitialized', 'CAP-MATLAB-SNAPSHOT-INCOMPATIBLE', 'configuration', 'manual')
        }
      }
      unwrap(await session.worker.send({ cmd: 'load', file: dataPath, vars: metadata.variableAllowlist }))
      return successResult(
        { snapshotId: req.snapshotId, restored: metadata.variableAllowlist, checksum: metadata.checksum },
        provenance('matlab'),
      )
    })
  }

  // -- Health / shutdown ----------------------------------------------------

  async function simulateCrash(projectId: string): Promise<void> {
    const session = sessions.get(projectId)
    if (!session) return
    session.worker.kill()
    session.record.state = 'unhealthy'
    session.record.lastDiagnosticId = crypto.randomUUID()
  }

  async function shutdownAll(): Promise<void> {
    const ids = [...sessions.keys()]
    await Promise.all(ids.map((id) => stopInternal(id)))
  }

  if (options.registerExitShutdown) {
    process.once('exit', () => {
      for (const session of sessions.values()) session.worker.kill()
    })
  }

  return {
    discover,
    getStatus,
    start,
    stop,
    restart,
    callFunction,
    evalExpression,
    runScript,
    workspacePut,
    workspaceGet,
    workspaceList,
    workspaceClear,
    setWorkingDirectory,
    addPath,
    snapshotSave,
    snapshotRestore,
    simulateCrash,
    shutdownAll,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function unwrapChecksum(response: WorkerResponse): string {
  if (response.ok === false) {
    throw new WorkerError(String(response.message ?? 'snapshot save failed'), 'CAP-MATLAB-SNAPSHOT-SAVE', 'execution', 'manual')
  }
  if (typeof response.checksum !== 'string') {
    throw new WorkerError('worker returned no checksum', 'CAP-MATLAB-SNAPSHOT-SAVE', 'execution', 'manual')
  }
  return response.checksum
}

function safeRelative(relativePath: string): string {
  const normalized = (relativePath ?? '').replace(/\\/g, '/').replace(/^\.\//, '')
  if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..')) {
    throw new WorkerError(`invalid relative path: ${relativePath}`, 'CAP-MATLAB-PATH', 'validation', 'none')
  }
  return normalized
}

function majorRelease(version: string): number {
  const match = version.match(/R(\d{4})/)
  if (match) return Number(match[1])
  const numeric = parseFloat(version)
  return Number.isFinite(numeric) ? numeric : 0
}

/** Bound captured console/warning artifacts so envelopes stay small. */
function boundConsole(text: string, limit = 8192): string {
  return text.length > limit ? text.slice(0, limit) + '\n…[truncated]' : text
}
