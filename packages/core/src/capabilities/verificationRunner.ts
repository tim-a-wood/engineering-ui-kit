/**
 * Real connection verification evidence (CAP-CONTRACT-029; handoff §8, §12.5, §15.1).
 *
 * This module LAUNCHES an actual deployable process (or starts a real
 * in-process host) and triggers its ACTUAL inbound adapter, then records what
 * was observed. It is an evidence generator, not a simulator: a
 * `verificationStatus` of `'pass'` is reported only when a real process/host
 * was launched AND a real trigger reached the operation through the
 * composition root. There is no code path inside `runConnectionVerification`
 * that can report `'pass'` without both steps actually happening.
 *
 * A caller that only has a direct-dispatch/in-memory result (no real
 * transport, no real process) must use `runSimulatedConnectionVerification`
 * instead, which is hard-coded to never report `'pass'` — see its doc comment.
 *
 * Every spawned process is always terminated (success, error, and timeout
 * paths) and every in-process host's `close()` is always invoked, so callers
 * never leak processes or open handles.
 */

import { randomUUID } from 'node:crypto'
import { spawn, type ChildProcess } from 'node:child_process'

import { probeFreePort } from '../commandRunner.js'
import { redactSensitiveText } from './redaction.js'
import type { ConnectionVerificationRecord, DeployableSpecification, InboundBinding } from './types.js'

// ---------------------------------------------------------------------------
// Trigger descriptors — what real interaction to perform against the target.
// ---------------------------------------------------------------------------

export type HttpTrigger = {
  kind: 'http'
  method: string
  path: string
  headers?: Record<string, string>
  body?: unknown
  /** Bounds the real HTTP request. Defaults to 5000ms. */
  timeoutMs?: number
}

export type CliTrigger = {
  kind: 'cli'
  /** Extra argv appended after `launch.args` when spawning the CLI entry. */
  args?: string[]
  /** Bounds waiting for the process to exit. Defaults to 10000ms. */
  timeoutMs?: number
}

export type InProcessTrigger = {
  kind: 'in-process'
  /** Payload handed to the launch's `invoke` hook. */
  input?: unknown
  /** Bounds the real in-process call. Defaults to 5000ms. */
  timeoutMs?: number
}

export type VerificationTrigger = HttpTrigger | CliTrigger | InProcessTrigger

// ---------------------------------------------------------------------------
// Launch descriptors — how to bring the real target up.
// ---------------------------------------------------------------------------

export type SpawnLaunch = {
  /** Executable to spawn directly (no shell), e.g. `'node'`. */
  command: string
  args?: string[]
  cwd?: string
  env?: Record<string, string>
  /** Env var set to the chosen ephemeral port before spawning (HTTP triggers only). Defaults to `'PORT'`. */
  portEnvVar?: string
  /** Overrides the default readiness poll (HTTP triggers only). Return `true` once ready. */
  readyProbe?: (port: number) => Promise<boolean>
  /** Path polled for readiness when no `readyProbe` is given. Defaults to `'/health'`. */
  healthPath?: string
  /** Bounds waiting for readiness (HTTP triggers only). Defaults to 5000ms. */
  readyTimeoutMs?: number
}

export type InProcessLaunchResult = {
  /** Real ephemeral port a just-started in-process HTTP host is listening on. */
  port?: number
  /** Direct call into a just-started in-process target (no network hop). */
  invoke?: (payload?: unknown) => Promise<{ ok: boolean; outcome?: string; body?: unknown }>
  /** Always invoked once verification completes (success, error, or timeout). */
  close: () => Promise<void> | void
}

export type InProcessLaunch = {
  kind: 'in-process'
  /** Actually launches the real host/target; must return a live port and/or an invoke hook. */
  start: () => Promise<InProcessLaunchResult>
}

export type Launch = SpawnLaunch | InProcessLaunch

function isInProcessLaunch(launch: Launch): launch is InProcessLaunch {
  return (launch as Partial<InProcessLaunch>).kind === 'in-process'
}

// ---------------------------------------------------------------------------
// runConnectionVerification
// ---------------------------------------------------------------------------

export type RunConnectionVerificationInput = {
  verificationId: string
  projectId: string
  binding: InboundBinding
  deployable: DeployableSpecification
  hashes: ConnectionVerificationRecord['hashes']
  launch: Launch
  trigger: VerificationTrigger
  /** True when a faithful TEST adapter stood in for a live external dependency. */
  usedTestAdapter?: boolean
  now?: () => Date
  correlationId?: string
  evidenceArtifactRefs?: string[]
  observedPathOverrides?: Partial<ConnectionVerificationRecord['observedPath']>
}

type StepOutcome = {
  ok: boolean
  healthState: string
  outcomeSummary: string
  reasonCodes: string[]
  observedPathPatch?: Partial<ConnectionVerificationRecord['observedPath']>
}

function describeLaunchCommand(launch: Launch, deployable: DeployableSpecification): string {
  if (isInProcessLaunch(launch)) {
    return deployable.commands.launch ?? `in-process:${deployable.deployableId}`
  }
  return [launch.command, ...(launch.args ?? [])].join(' ')
}

function baseObservedPath(
  binding: InboundBinding,
  deployable: DeployableSpecification,
): ConnectionVerificationRecord['observedPath'] {
  return {
    inboundAdapter: `${binding.kind}:${binding.bindingId}`,
    compositionRoot: deployable.compositionRootPath,
    operation: `${binding.operationId}@${binding.operationVersion}`,
    outboundAdapters: [],
  }
}

function triggerInputForRedaction(trigger: VerificationTrigger): unknown {
  if (trigger.kind === 'http') {
    return { method: trigger.method, path: trigger.path, headers: trigger.headers, body: trigger.body }
  }
  if (trigger.kind === 'cli') {
    return { args: trigger.args ?? [] }
  }
  return { input: trigger.input }
}

/**
 * `redactSensitiveText` (CAP-PKT-030) only matches a handful of unquoted
 * `key: value` / `key=value` text shapes; JSON-encoded secret-ish fields
 * (e.g. `"apiKey":"..."`, `"authorization":"Bearer ..."`) survive naive
 * stringify+redact. This walks the trigger payload first and masks any
 * value whose *key* looks sensitive, before `redactSensitiveText` runs its
 * own text-pattern pass over the remainder — defense in depth so no secret
 * value can leak into `redactedTriggerInput` regardless of shape.
 */
const SENSITIVE_KEY_PATTERN = /(api[_-]?key|token|password|secret|authorization|credential)/i

function redactSensitiveKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactSensitiveKeys(item))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY_PATTERN.test(key) && item !== undefined ? '[redacted]' : redactSensitiveKeys(item)
    }
    return out
  }
  return value
}

/** Kills a spawned process (SIGTERM then SIGKILL fallback); resolves once it has exited. Never hangs. */
async function killChild(child: ChildProcess): Promise<void> {
  if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return
  await new Promise<void>((resolve) => {
    let resolved = false
    const finish = () => {
      if (resolved) return
      resolved = true
      clearTimeout(killTimer)
      clearTimeout(safetyTimer)
      resolve()
    }
    child.once('exit', finish)
    try {
      child.kill('SIGTERM')
    } catch {
      /* already gone */
    }
    const killTimer = setTimeout(() => {
      try {
        child.kill('SIGKILL')
      } catch {
        /* already gone */
      }
    }, 500)
    const safetyTimer = setTimeout(finish, 1_500)
    killTimer.unref?.()
    safetyTimer.unref?.()
  })
}

function defaultReadyProbe(healthPath: string) {
  return async (port: number): Promise<boolean> => {
    const response = await fetch(`http://127.0.0.1:${port}${healthPath}`, { signal: AbortSignal.timeout(800) })
    return response.status < 500
  }
}

async function waitForReady(port: number, launch: SpawnLaunch): Promise<boolean> {
  const timeoutMs = launch.readyTimeoutMs ?? 5_000
  const probe = launch.readyProbe ?? defaultReadyProbe(launch.healthPath ?? '/health')
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      if (await probe(port)) return true
    } catch {
      // not ready yet — keep polling until the deadline.
    }
    if (Date.now() >= deadline) return false
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

async function sendHttpTrigger(port: number, trigger: HttpTrigger): Promise<StepOutcome> {
  const timeoutMs = trigger.timeoutMs ?? 5_000
  const url = `http://127.0.0.1:${port}${trigger.path}`
  try {
    const response = await fetch(url, {
      method: trigger.method,
      headers:
        trigger.body !== undefined ? { 'content-type': 'application/json', ...(trigger.headers ?? {}) } : trigger.headers,
      body: trigger.body !== undefined ? JSON.stringify(trigger.body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    })
    // Draining the body confirms the real round trip completed; its content
    // never enters the record (only the status code is recorded).
    await response.text()
    const reachedOperation = response.status !== 404
    return {
      ok: reachedOperation,
      healthState: response.status < 500 ? 'healthy' : 'degraded',
      outcomeSummary: `${trigger.method} ${trigger.path} -> HTTP ${response.status}`,
      reasonCodes: reachedOperation ? [] : ['route-not-matched'],
    }
  } catch (error) {
    return {
      ok: false,
      healthState: 'unreachable',
      outcomeSummary: `http trigger failed: ${error instanceof Error ? error.message : String(error)}`,
      reasonCodes: ['trigger-failed'],
    }
  }
}

async function runHttpVerification(launch: Launch, trigger: HttpTrigger): Promise<StepOutcome> {
  if (isInProcessLaunch(launch)) {
    let handle: InProcessLaunchResult | undefined
    try {
      handle = await launch.start()
      if (typeof handle.port !== 'number') {
        return {
          ok: false,
          healthState: 'unreachable',
          outcomeSummary: 'in-process launch did not expose a port for an http trigger',
          reasonCodes: ['launch-port-missing'],
        }
      }
      return await sendHttpTrigger(handle.port, trigger)
    } finally {
      if (handle) await Promise.resolve(handle.close())
    }
  }

  const port = await probeFreePort()
  const portEnvVar = launch.portEnvVar ?? 'PORT'
  const child = spawn(launch.command, launch.args ?? [], {
    cwd: launch.cwd,
    env: { ...process.env, ...launch.env, [portEnvVar]: String(port) },
    stdio: 'ignore',
  })
  try {
    const spawnFailed = await new Promise<boolean>((resolve) => {
      child.once('error', () => resolve(true))
      // If the process is still alive shortly after spawn, assume the executable was found.
      setTimeout(() => resolve(false), 0)
    })
    if (spawnFailed) {
      return {
        ok: false,
        healthState: 'unreachable',
        outcomeSummary: `failed to spawn launch command: ${launch.command}`,
        reasonCodes: ['spawn-failed'],
      }
    }
    const ready = await waitForReady(port, launch)
    if (!ready) {
      return {
        ok: false,
        healthState: 'unreachable',
        outcomeSummary: `launched process never became ready on port ${port} within the readiness timeout`,
        reasonCodes: ['launch-not-ready'],
      }
    }
    return await sendHttpTrigger(port, trigger)
  } finally {
    await killChild(child)
  }
}

async function runCliVerification(launch: Launch, trigger: CliTrigger): Promise<StepOutcome> {
  if (isInProcessLaunch(launch)) {
    return {
      ok: false,
      healthState: 'unreachable',
      outcomeSummary: 'an in-process launch cannot serve a cli trigger',
      reasonCodes: ['unsupported-launch-trigger-combination'],
    }
  }

  const timeoutMs = trigger.timeoutMs ?? 10_000
  const args = [...(launch.args ?? []), ...(trigger.args ?? [])]
  const child = spawn(launch.command, args, {
    cwd: launch.cwd,
    env: { ...process.env, ...launch.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stdout = ''
  let stderr = ''
  child.stdout?.on('data', (chunk: Buffer) => {
    stdout += chunk.toString('utf8')
  })
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString('utf8')
  })

  const exitResult = await new Promise<{ code: number | null; timedOut: boolean; spawnError?: Error }>((resolve) => {
    const timer = setTimeout(() => resolve({ code: null, timedOut: true }), timeoutMs)
    child.once('error', (error) => {
      clearTimeout(timer)
      resolve({ code: null, timedOut: false, spawnError: error })
    })
    child.once('close', (code) => {
      clearTimeout(timer)
      resolve({ code, timedOut: false })
    })
  })

  // Always terminate: a no-op if the process already exited on its own.
  await killChild(child)

  if (exitResult.spawnError) {
    return {
      ok: false,
      healthState: 'unreachable',
      outcomeSummary: `cli spawn failed: ${exitResult.spawnError.message}`,
      reasonCodes: ['spawn-failed'],
    }
  }
  if (exitResult.timedOut) {
    return {
      ok: false,
      healthState: 'unreachable',
      outcomeSummary: `cli process timed out after ${timeoutMs}ms`,
      reasonCodes: ['launch-timeout'],
    }
  }
  const summary = redactSensitiveText(`${stdout}${stderr ? ` [stderr] ${stderr}` : ''}`).trim().slice(0, 200)
  return {
    ok: true,
    healthState: exitResult.code === 0 ? 'healthy' : 'degraded',
    outcomeSummary: `exit code ${exitResult.code}${summary ? ` (output: ${summary})` : ''}`,
    reasonCodes: [],
  }
}

async function runInProcessTrigger(launch: Launch, trigger: InProcessTrigger): Promise<StepOutcome> {
  if (!isInProcessLaunch(launch)) {
    return {
      ok: false,
      healthState: 'unreachable',
      outcomeSummary: 'a spawn launch cannot serve an in-process trigger',
      reasonCodes: ['unsupported-launch-trigger-combination'],
    }
  }

  let handle: InProcessLaunchResult | undefined
  try {
    handle = await launch.start()
    if (typeof handle.invoke !== 'function') {
      return {
        ok: false,
        healthState: 'unreachable',
        outcomeSummary: 'in-process launch did not expose an invoke hook for an in-process trigger',
        reasonCodes: ['launch-invoke-missing'],
      }
    }
    const timeoutMs = trigger.timeoutMs ?? 5_000
    const invoke = handle.invoke
    const result = await Promise.race([
      invoke(trigger.input),
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error('in-process trigger timed out')), timeoutMs)
      }),
    ])
    return {
      ok: result.ok,
      healthState: result.ok ? 'healthy' : 'degraded',
      outcomeSummary: result.outcome ?? (result.ok ? 'in-process invocation succeeded' : 'in-process invocation reported failure'),
      reasonCodes: result.ok ? [] : ['in-process-invocation-failed'],
    }
  } catch (error) {
    return {
      ok: false,
      healthState: 'unreachable',
      outcomeSummary: `in-process trigger failed: ${error instanceof Error ? error.message : String(error)}`,
      reasonCodes: ['trigger-failed'],
    }
  } finally {
    if (handle) await Promise.resolve(handle.close())
  }
}

/**
 * Launches the real target (spawned process or in-process host) and sends a
 * real trigger, producing a CAP-CONTRACT-029 evidence record.
 *
 * `verificationStatus === 'pass'` only when the real launch reached readiness
 * (or the in-process host started) AND the real trigger reached the
 * operation. Any launch/trigger failure — including a readiness timeout —
 * yields `'fail'`; `usedTestAdapter: true` downgrades an otherwise-passing
 * result to `'partial'` with `externalEvidenceStatus: 'outstanding'` because a
 * faithful TEST adapter stood in for a live external dependency.
 *
 * The spawned process (or in-process host) is always terminated, on every
 * path — success, trigger failure, and readiness timeout.
 */
export async function runConnectionVerification(
  input: RunConnectionVerificationInput,
): Promise<ConnectionVerificationRecord> {
  const now = input.now ?? (() => new Date())
  const startedAt = now().toISOString()
  const startedAtMs = Date.now()
  const correlationId = input.correlationId ?? randomUUID()
  const launchCommand = describeLaunchCommand(input.launch, input.deployable)
  const observedPathBase = { ...baseObservedPath(input.binding, input.deployable), ...input.observedPathOverrides }

  let step: StepOutcome
  try {
    if (input.trigger.kind === 'http') {
      step = await runHttpVerification(input.launch, input.trigger)
    } else if (input.trigger.kind === 'cli') {
      step = await runCliVerification(input.launch, input.trigger)
    } else {
      step = await runInProcessTrigger(input.launch, input.trigger)
    }
  } catch (error) {
    step = {
      ok: false,
      healthState: 'unreachable',
      outcomeSummary: `verification threw unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
      reasonCodes: ['verification-threw'],
    }
  }

  const completedAt = now().toISOString()
  const durationMs = Date.now() - startedAtMs
  const usedTestAdapter = input.usedTestAdapter ?? false

  const verificationStatus: ConnectionVerificationRecord['verificationStatus'] = !step.ok
    ? 'fail'
    : usedTestAdapter
      ? 'partial'
      : 'pass'

  const externalEvidenceStatus: ConnectionVerificationRecord['externalEvidenceStatus'] = usedTestAdapter
    ? 'outstanding'
    : step.ok
      ? 'complete'
      : 'not-applicable'

  const reasonCodes = [...step.reasonCodes]
  if (step.ok && usedTestAdapter) reasonCodes.push('test-adapter-used')

  const redactedTriggerInput = redactSensitiveText(
    JSON.stringify(redactSensitiveKeys(triggerInputForRedaction(input.trigger))),
  )

  return {
    schemaVersion: '1.0',
    verificationId: input.verificationId,
    projectId: input.projectId,
    bindingId: input.binding.bindingId,
    deployableId: input.deployable.deployableId,
    hashes: input.hashes,
    launchCommand: redactSensitiveText(launchCommand),
    triggerKind: input.trigger.kind,
    redactedTriggerInput,
    outcomeSummary: redactSensitiveText(step.outcomeSummary),
    correlationId,
    observedPath: { ...observedPathBase, ...step.observedPathPatch },
    startedAt,
    completedAt,
    durationMs,
    healthState: step.healthState,
    usedTestAdapter,
    externalEvidenceStatus,
    evidenceArtifactRefs: input.evidenceArtifactRefs ?? [],
    verificationStatus,
    reasonCodes,
  }
}

// ---------------------------------------------------------------------------
// Simulation / direct-dispatch — deliberately never 'pass'.
// ---------------------------------------------------------------------------

export type SimulatedConnectionVerificationInput = {
  verificationId: string
  projectId: string
  binding: InboundBinding
  deployable: DeployableSpecification
  hashes: ConnectionVerificationRecord['hashes']
  triggerKind: string
  /** Optional description of the simulated/direct-dispatch outcome (never presented as passing evidence). */
  simulatedOutcomeSummary?: string
  correlationId?: string
  now?: () => Date
}

/**
 * Builds a CAP-CONTRACT-029 record for a direct-dispatch / no-process
 * "simulation" path — e.g. a caller that already has an in-memory dispatch
 * `Outcome` but never launched a real process or sent a real trigger.
 *
 * This is deliberately incapable of reporting `'pass'`: it always returns
 * `verificationStatus: 'fail'` with the `simulation-insufficient` reason
 * code, no matter what the caller passes in. Simulated/direct-dispatch
 * evidence can never stand in for a real launched-process + real-trigger
 * verification produced by `runConnectionVerification`.
 */
export function runSimulatedConnectionVerification(
  input: SimulatedConnectionVerificationInput,
): ConnectionVerificationRecord {
  const now = input.now ?? (() => new Date())
  const timestamp = now().toISOString()
  return {
    schemaVersion: '1.0',
    verificationId: input.verificationId,
    projectId: input.projectId,
    bindingId: input.binding.bindingId,
    deployableId: input.deployable.deployableId,
    hashes: input.hashes,
    launchCommand: '(none: direct-dispatch simulation — no process was launched)',
    triggerKind: input.triggerKind,
    redactedTriggerInput: redactSensitiveText('(simulation: no real trigger input was captured)'),
    outcomeSummary: redactSensitiveText(
      input.simulatedOutcomeSummary ?? 'direct-dispatch simulation only; no real process or trigger evidence exists',
    ),
    correlationId: input.correlationId ?? randomUUID(),
    observedPath: baseObservedPath(input.binding, input.deployable),
    startedAt: timestamp,
    completedAt: timestamp,
    durationMs: 0,
    healthState: 'unknown',
    usedTestAdapter: false,
    externalEvidenceStatus: 'not-applicable',
    evidenceArtifactRefs: [],
    verificationStatus: 'fail',
    reasonCodes: ['simulation-insufficient'],
  }
}
