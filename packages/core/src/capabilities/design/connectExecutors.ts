/**
 * EUC-16 — real Connect executors (`configureBinding`, `verifyConnection`,
 * `runScenario`) for the `DesignOperationExecutors` seam `operations.ts`
 * defines (§13, §14.1-14.3, §17.2, §19).
 *
 * Second-review P1 fix: before this module existed, every desktop, CLI, and
 * machine-API adapter left these three executors unconfigured — a user
 * reaching Connect in the deployed app could never actually configure or
 * verify a real binding, or run an approved scenario, through a production
 * entry point; the only exercised path was an injected test executor
 * (`product-scenarios.test.ts` S26/S27). This module is a Node adapter-layer
 * module (the same category as `repositoryAdapter.ts` — it uses `node:fs`
 * and `node:child_process` directly and must never be imported from a
 * browser entry) that gives every adapter (`apps/desktop/src/capabilities/
 * designExecutors.ts`, `designMachineApi.ts`, `designCli.ts`) the same real
 * implementation, so Connect works identically everywhere `operations.ts`
 * itself is called from.
 *
 * What "real" means here, precisely:
 *
 *  - `configureBinding` validates the supplied `bindingConfig` as a
 *    CAP-CONTRACT-028 `InboundBinding` (reusing `validateContractRecord`),
 *    confirms the referenced operation is an approved contract for the
 *    project (via `deps.listApprovedOperations`, a plain read function so
 *    core stays testable without a real `DesignWorkspace`), confirms the
 *    binding's `deployableId` matches the target module's own configured
 *    deployable (`deps.getModuleDesign`), and persists the validated binding
 *    atomically under `<dataDir>/projects/<projectId>/design-adapter/
 *    bindings/<bindingId>.json` plus a small `by-module/<moduleId>.json`
 *    index — the same adapter-owned-JSON-store pattern `designIpc.ts` already
 *    uses for `repository.json`. An invalid or unapproved binding is
 *    rejected with real diagnostics; nothing is ever persisted on failure.
 *
 *  - `verifyConnection` loads the binding (from `bindingConfig`, or the
 *    persisted binding for `moduleId` when omitted), requires it to be a
 *    `cli` or `http` kind belonging to a module whose design defines at
 *    least one `verification.configuredCommands` entry (there is no
 *    persisted `DeployableSpecification`/launch-command record in this
 *    workflow to draw a separate "deployable commands" list from, so this
 *    reuses the exact commands `verifyModule`'s own executor already treats
 *    as the module's real, configured, allowlisted commands — see the
 *    "design decisions" note below), then actually launches the first
 *    configured command and sends a real trigger:
 *      - `cli`: runs the launch/health command via `runConfiguredCommandSync`
 *        (foreground, allowlisted to itself), then runs the binding's own
 *        `command` with a bounded sample input, also via
 *        `runConfiguredCommandSync`, and records both exit codes.
 *      - `http`: spawns the launch/health command in the background, polls
 *        `bindingConfig.localBaseUrl + '/health'` with a real (child-process)
 *        `fetch` until ready or a 5s deadline, sends one real request to
 *        `localBaseUrl + binding.path` with `binding.method`, records the
 *        response status, and always terminates the spawned process.
 *        `localBaseUrl` must resolve to `127.0.0.1`/`localhost` — this
 *        executor never dials any other host (§20.2 "no network beyond
 *        localhost" for this executor).
 *    Every executor slot `operations.ts` defines here is synchronous (no
 *    `Promise` in `DesignOperationExecutors`), so the HTTP probe cannot use
 *    `fetch` directly in-process; `syncFetchLocalhost` below spawns a short
 *    Node child process that awaits a real `fetch` and prints its JSON
 *    result, then blocks on it with `spawnSync` — the same "spawn and block"
 *    technique `runConfiguredCommandSync` already uses, just wrapping a
 *    network probe instead of a configured command.
 *    A missing binding, an unsupported kind, or no configured commands all
 *    return `ok:false` naming exactly what is missing — this never fabricates
 *    a passing verification.
 *
 *  - `runScenario` executes a scenario's real steps: `input.entry` (a
 *    `VerificationPlanner.ScenarioTestPlanEntry`) carries only
 *    `useCaseId`/`scenarioId` identifiers, not the steps themselves (see
 *    `verificationPlanner.ts` — `buildScenarioTestPlan` deliberately keeps
 *    the entry lightweight), so the real `ScenarioStep[]` are looked up from
 *    `input.analysis` (exactly how `product-scenarios.test.ts`'s S27 fixture
 *    does it). There is no committed field anywhere that names which
 *    `verification.configuredCommands` entry (if any) verifies which
 *    specific scenario step — `ModuleVerificationSpecification` only carries
 *    a flat `configuredCommands: string[]`. Rather than fabricate a 'passed'
 *    outcome for a step with no way to really check it, this module defines
 *    one explicit, documented convention: a configured command formatted as
 *    `"<stepId>: <command line>"` is recognized as the real check for that
 *    step, across every approved module design in the project
 *    (`deps.listApprovedModuleDesigns`). A step with no matching entry is
 *    reported `outcome: 'skipped'` with an honest `structuredEvidenceRef`
 *    explaining why — never a fabricated `'passed'`. This convention is a
 *    deliberate adapter-layer design decision (not a spec-mandated schema)
 *    and is called out as a contract-change candidate in the packet report:
 *    a future packet that owns `records.ts` could add a real
 *    `stepId -> command` field to `ModuleVerificationSpecification` and
 *    remove the string-prefix convention.
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { validateContractRecord } from '../validation.js'
import { HTTP_METHODS, INBOUND_BINDING_KINDS } from '../parity.js'
import { canonicalHash } from '../hash.js'
import type { CliInboundBinding, ConnectionVerificationRecord, HttpInboundBinding, InboundBinding } from '../types.js'
import type { DesignDiagnostic, ModuleDesignSpecification, ScenarioRun, ScenarioStepEvidence, UseCaseAnalysis } from './records.js'
import type { ScenarioTestPlanEntry } from './verificationPlanner.js'
import { runConfiguredCommandSync, type RunConfiguredCommandResult } from './repositoryAdapter.js'
import type { DesignOperationExecutors, ExecutionContext } from './operations.js'
import { toDesignDiagnostic } from './useCaseAnalysis.js'

// ---------------------------------------------------------------------------
// Small local helpers (mirrors of the local copies `designIpc.ts` and
// `designMachineApi.ts` already keep — no shared helper is exported from
// either of those adapter files for this module to reuse).
// ---------------------------------------------------------------------------

const MAX_SEGMENT_LENGTH = 300

/** A single safe path segment: no separators, no traversal, no leading dot, bounded length. Used for every user-supplied id (`bindingId`, `moduleId`) before it reaches `path.join`. */
function isSafeSegment(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_SEGMENT_LENGTH) return false
  if (value.indexOf('\0') !== -1) return false
  if (value.includes('/') || value.includes('\\')) return false
  if (value === '.' || value === '..') return false
  if (value.startsWith('.')) return false
  return true
}

function makeDiagnostic(code: string, message: string, target?: string, relatedIds?: string[]): DesignDiagnostic {
  return {
    id: target ? `${code}:${target}` : code,
    code,
    severity: 'blocker',
    message,
    ...(relatedIds && relatedIds.length ? { relatedIds } : {}),
    ...(target ? { target } : {}),
  }
}

function parseCommandLine(line: string): { command: string; args: string[] } {
  const [command = '', ...args] = line.trim().split(/\s+/).filter(Boolean)
  return { command, args }
}

// ---------------------------------------------------------------------------
// Adapter-owned binding store: `<dataDir>/projects/<projectId>/
// design-adapter/bindings/<bindingId>.json` (+ a `by-module/<moduleId>.json`
// index) — the same atomic-write, adapter-owned-JSON pattern `designIpc.ts`
// already uses for `repository.json`.
// ---------------------------------------------------------------------------

type PersistedBinding = InboundBinding & { moduleId: string; storedAt: string }

function bindingsRoot(dataDir: string, projectId: string): string {
  return path.join(dataDir, 'projects', projectId, 'design-adapter', 'bindings')
}

function bindingFilePath(dataDir: string, projectId: string, bindingId: string): string {
  return path.join(bindingsRoot(dataDir, projectId), `${bindingId}.json`)
}

function bindingIndexFilePath(dataDir: string, projectId: string, moduleId: string): string {
  return path.join(bindingsRoot(dataDir, projectId), 'by-module', `${moduleId}.json`)
}

function writeJsonAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${crypto.randomUUID()}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n')
  fs.renameSync(tmp, file)
}

function readJson<T>(file: string): T | undefined {
  if (!fs.existsSync(file)) return undefined
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T
  } catch {
    return undefined
  }
}

function loadPersistedBinding(dataDir: string, projectId: string, moduleId: string): PersistedBinding | undefined {
  if (!isSafeSegment(moduleId)) return undefined
  const idx = readJson<{ bindingId: string }>(bindingIndexFilePath(dataDir, projectId, moduleId))
  if (!idx || !isSafeSegment(idx.bindingId)) return undefined
  return readJson<PersistedBinding>(bindingFilePath(dataDir, projectId, idx.bindingId))
}

// ---------------------------------------------------------------------------
// Binding validation (CAP-CONTRACT-028)
// ---------------------------------------------------------------------------

function validateBindingShape(raw: unknown): { ok: boolean; binding?: InboundBinding; diagnostics: DesignDiagnostic[] } {
  const capDiagnostics = validateContractRecord('CAP-CONTRACT-028', raw)
  const diagnostics = capDiagnostics.map(toDesignDiagnostic)
  if (diagnostics.length) return { ok: false, diagnostics }

  const record = raw as Record<string, unknown>
  if (typeof record.kind !== 'string' || !(INBOUND_BINDING_KINDS as readonly string[]).includes(record.kind)) {
    diagnostics.push(
      makeDiagnostic('EUC16-CONNECT-BINDING-KIND-INVALID', `bindingConfig.kind must be one of ${INBOUND_BINDING_KINDS.join(', ')} (received ${JSON.stringify(record.kind)})`, 'kind'),
    )
  }
  if (!isSafeSegment(record.bindingId)) {
    diagnostics.push(makeDiagnostic('EUC16-CONNECT-BINDING-ID-INVALID', 'bindingConfig.bindingId must be a non-empty identifier with no path separators', 'bindingId'))
  }
  if (record.kind === 'cli' && (typeof record.command !== 'string' || !record.command.trim())) {
    diagnostics.push(makeDiagnostic('EUC16-CONNECT-BINDING-COMMAND-REQUIRED', 'a cli binding requires a non-empty "command"', 'command'))
  }
  if (record.kind === 'http') {
    if (typeof record.method !== 'string' || !(HTTP_METHODS as readonly string[]).includes(record.method)) {
      diagnostics.push(makeDiagnostic('EUC16-CONNECT-BINDING-METHOD-INVALID', `an http binding requires "method" to be one of ${HTTP_METHODS.join(', ')}`, 'method'))
    }
    if (typeof record.path !== 'string' || !record.path.startsWith('/')) {
      diagnostics.push(makeDiagnostic('EUC16-CONNECT-BINDING-PATH-INVALID', 'an http binding requires "path" to start with "/"', 'path'))
    }
  }
  if (diagnostics.length) return { ok: false, diagnostics }
  return { ok: true, binding: raw as InboundBinding, diagnostics: [] }
}

// ---------------------------------------------------------------------------
// configureBinding
// ---------------------------------------------------------------------------

export type ConnectExecutorDeps = {
  /** Absolute directory the adapter-owned `design-adapter/` store lives under (the design workspace's own data directory). */
  dataDir: string
  /** The project's real repository root — every real command this module runs uses this as `cwd`/`root`. */
  repositoryRoot: string
  /** Reads a module design (approved preferred, else draft) — a plain function so this module is testable without a real `DesignWorkspace`. */
  getModuleDesign: (projectId: string, moduleId: string) => ModuleDesignSpecification | undefined
  /** Reads the project's approved operation contracts (`operationId`/`version` pairs only). */
  listApprovedOperations: (projectId: string) => { operationId: string; version: string }[]
  /** Reads every approved module design for the project (used to resolve `runScenario`'s per-step configured commands). */
  listApprovedModuleDesigns: (projectId: string) => ModuleDesignSpecification[]
}

function configureBindingExecutor(deps: ConnectExecutorDeps) {
  return (
    input: { projectId: string; moduleId: string; bindingConfig: unknown },
    _context: ExecutionContext,
  ): { ok: boolean; value?: unknown; diagnostics?: DesignDiagnostic[] } => {
    const shape = validateBindingShape(input.bindingConfig)
    if (!shape.ok || !shape.binding) return { ok: false, diagnostics: shape.diagnostics }
    const binding = shape.binding

    const design = deps.getModuleDesign(input.projectId, input.moduleId)
    if (!design) {
      return { ok: false, diagnostics: [makeDiagnostic('EUC16-CONNECT-MODULE-NOT-FOUND', `no module design exists for module "${input.moduleId}"`, 'moduleId')] }
    }
    if (binding.deployableId !== design.boundary.deployableId) {
      return {
        ok: false,
        diagnostics: [
          makeDiagnostic(
            'EUC16-CONNECT-DEPLOYABLE-MISMATCH',
            `bindingConfig.deployableId "${binding.deployableId}" does not match module "${input.moduleId}"'s configured deployable "${design.boundary.deployableId}"`,
            'deployableId',
          ),
        ],
      }
    }

    const approvedOperations = deps.listApprovedOperations(input.projectId)
    const operationApproved = approvedOperations.some((op) => op.operationId === binding.operationId && op.version === binding.operationVersion)
    if (!operationApproved) {
      return {
        ok: false,
        diagnostics: [
          makeDiagnostic(
            'EUC16-CONNECT-OPERATION-NOT-APPROVED',
            `operation "${binding.operationId}@${binding.operationVersion}" is not an approved contract for this project`,
            'operationId',
          ),
        ],
      }
    }

    const storedAt = new Date().toISOString()
    const persisted: PersistedBinding = { ...binding, moduleId: input.moduleId, storedAt }
    writeJsonAtomic(bindingFilePath(deps.dataDir, input.projectId, binding.bindingId), persisted)
    writeJsonAtomic(bindingIndexFilePath(deps.dataDir, input.projectId, input.moduleId), { moduleId: input.moduleId, bindingId: binding.bindingId, updatedAt: storedAt })

    return {
      ok: true,
      value: {
        bindingId: binding.bindingId,
        moduleId: input.moduleId,
        kind: binding.kind,
        operationId: binding.operationId,
        operationVersion: binding.operationVersion,
        deployableId: binding.deployableId,
        storedAt,
      },
    }
  }
}

// ---------------------------------------------------------------------------
// verifyConnection
// ---------------------------------------------------------------------------

type RecordInput = {
  projectId: string
  binding: InboundBinding
  design: ModuleDesignSpecification
  launchCommand: string
  triggerKind: string
  redactedTriggerInput: string
  outcomeSummary: string
  startedAt: string
  completedAt: string
  durationMs: number
  healthState: string
  verificationStatus: ConnectionVerificationRecord['verificationStatus']
  reasonCodes: string[]
}

function buildVerificationRecord(input: RecordInput): ConnectionVerificationRecord {
  return {
    schemaVersion: '1.0',
    verificationId: crypto.randomUUID(),
    projectId: input.projectId,
    bindingId: input.binding.bindingId,
    deployableId: input.binding.deployableId,
    hashes: {
      binding: canonicalHash(input.binding),
      operation: `${input.binding.operationId}@${input.binding.operationVersion}`,
      architecture: input.design.architecture.contentHash,
      // No persisted CompositionManifest/GeneratedOwnershipManifest exists in
      // this workflow to draw a real hash from — left honestly empty rather
      // than fabricated (see module doc).
      composition: '',
      generatedOwnership: '',
      source: input.design.contentHash,
    },
    launchCommand: input.launchCommand,
    triggerKind: input.triggerKind,
    redactedTriggerInput: input.redactedTriggerInput,
    outcomeSummary: input.outcomeSummary,
    correlationId: crypto.randomUUID(),
    observedPath: {
      inboundAdapter: `${input.binding.kind}:${input.binding.bindingId}`,
      // No persisted `DeployableSpecification.compositionRootPath` exists in
      // this workflow; the module's own deployable id stands in.
      compositionRoot: input.design.boundary.deployableId,
      operation: `${input.binding.operationId}@${input.binding.operationVersion}`,
      outboundAdapters: [],
    },
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    durationMs: input.durationMs,
    healthState: input.healthState,
    usedTestAdapter: false,
    externalEvidenceStatus: input.verificationStatus === 'pass' ? 'complete' : 'not-applicable',
    evidenceArtifactRefs: [],
    verificationStatus: input.verificationStatus,
    reasonCodes: input.reasonCodes,
  }
}

function runCliConnectionCheck(
  repositoryRoot: string,
  projectId: string,
  binding: CliInboundBinding,
  design: ModuleDesignSpecification,
  commands: string[],
  context: ExecutionContext,
): ConnectionVerificationRecord {
  const startedAt = new Date().toISOString()
  const startedMs = Date.now()
  const launchLine = commands[0]!
  const launch = parseCommandLine(launchLine)
  const cancellation = context.cancellationRequested ? { cancelled: true } : undefined

  const launchResult = runConfiguredCommandSync({
    command: launch.command,
    args: launch.args,
    cwd: repositoryRoot,
    root: repositoryRoot,
    timeoutMs: 60_000,
    allowedCommands: [launch.command],
    envAllowlist: ['PATH'],
    cancellation,
  })
  const launchOk = launchResult.exitCode === 0 && !launchResult.timedOut && !launchResult.cancelled

  const probe = parseCommandLine(binding.command)
  const sampleInputArg = JSON.stringify({ sample: true, verification: true, bindingId: binding.bindingId })
  let probeResult: RunConfiguredCommandResult | undefined
  if (launchOk) {
    probeResult = runConfiguredCommandSync({
      command: probe.command,
      args: [...probe.args, sampleInputArg],
      cwd: repositoryRoot,
      root: repositoryRoot,
      timeoutMs: 30_000,
      allowedCommands: [probe.command],
      envAllowlist: ['PATH'],
      cancellation,
    })
  }
  const probeOk = Boolean(probeResult && probeResult.exitCode === 0 && !probeResult.timedOut && !probeResult.cancelled)
  const ok = launchOk && probeOk
  const completedAt = new Date().toISOString()

  return buildVerificationRecord({
    projectId,
    binding,
    design,
    launchCommand: `${launch.command} ${launch.args.join(' ')}`.trim(),
    triggerKind: 'cli',
    redactedTriggerInput: JSON.stringify({ args: [...probe.args, '[redacted-sample-input]'] }),
    outcomeSummary: !launchOk
      ? `launch/health command failed (exit ${launchResult.exitCode ?? 'none'}${launchResult.timedOut ? ', timeout' : ''}${launchResult.cancelled ? ', cancelled' : ''}): ${launchLine}`
      : !probeOk
        ? `cli probe failed (exit ${probeResult?.exitCode ?? 'none'}${probeResult?.timedOut ? ', timeout' : ''}${probeResult?.cancelled ? ', cancelled' : ''}): ${binding.command}`
        : `launch ("${launchLine}") and cli probe ("${binding.command}") both exited 0`,
    startedAt,
    completedAt,
    durationMs: Date.now() - startedMs,
    healthState: ok ? 'healthy' : 'unreachable',
    verificationStatus: ok ? 'pass' : 'fail',
    reasonCodes: [...(!launchOk ? ['launch-failed'] : []), ...(launchOk && !probeOk ? ['cli-probe-failed'] : [])],
  })
}

/** Blocking sleep via `Atomics.wait` — the only way to pause inside a synchronous executor slot. */
function syncSleep(ms: number): void {
  if (ms <= 0) return
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

type SyncFetchResult = { ok: boolean; status?: number; error?: string; durationMs: number }

/**
 * A real, bounded HTTP probe from inside a synchronous executor slot: spawns
 * a short-lived Node child process that awaits a real `fetch(...)` and
 * prints its JSON outcome, then blocks on it with `spawnSync` — the same
 * "spawn and block" shape `runConfiguredCommandSync` already uses for a
 * configured command, applied to a network probe instead.
 */
function syncFetchLocalhost(url: string, method: string, timeoutMs: number): SyncFetchResult {
  const script = `(async () => {
    const started = Date.now();
    try {
      const res = await fetch(${JSON.stringify(url)}, { method: ${JSON.stringify(method)}, signal: AbortSignal.timeout(${timeoutMs}) });
      await res.text();
      process.stdout.write(JSON.stringify({ ok: true, status: res.status, durationMs: Date.now() - started }));
    } catch (error) {
      process.stdout.write(JSON.stringify({ ok: false, error: String(error && error.message ? error.message : error), durationMs: Date.now() - started }));
    }
  })();`
  const outcome = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', timeout: timeoutMs + 2_000 })
  if (outcome.error || typeof outcome.stdout !== 'string' || !outcome.stdout.trim()) {
    return { ok: false, error: outcome.error?.message ?? 'no response from the probe process', durationMs: timeoutMs }
  }
  try {
    return JSON.parse(outcome.stdout.trim()) as SyncFetchResult
  } catch {
    return { ok: false, error: 'malformed probe output', durationMs: timeoutMs }
  }
}

function assertLocalOrigin(rawUrl: string): URL {
  const url = new URL(rawUrl)
  if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    throw new Error(`localBaseUrl must target 127.0.0.1 or localhost — no network beyond localhost is permitted (received "${rawUrl}")`)
  }
  return url
}

function killSpawnedSync(child: ReturnType<typeof spawn>): void {
  try {
    if (child.pid && process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL')
    else child.kill('SIGKILL')
  } catch {
    // already gone
  }
}

function runHttpConnectionCheck(
  repositoryRoot: string,
  projectId: string,
  binding: HttpInboundBinding,
  design: ModuleDesignSpecification,
  commands: string[],
  rawBindingConfig: unknown,
): ConnectionVerificationRecord {
  const startedAt = new Date().toISOString()
  const startedMs = Date.now()
  const bare = (record: Partial<RecordInput>): ConnectionVerificationRecord => {
    const completedAt = new Date().toISOString()
    return buildVerificationRecord({
      projectId,
      binding,
      design,
      launchCommand: '(not attempted)',
      triggerKind: 'http',
      redactedTriggerInput: JSON.stringify({ method: binding.method, path: binding.path }),
      startedAt,
      completedAt,
      durationMs: Date.now() - startedMs,
      healthState: 'unreachable',
      verificationStatus: 'fail',
      reasonCodes: [],
      outcomeSummary: 'verification did not run',
      ...record,
    })
  }

  const rawLocalBaseUrl = (rawBindingConfig as Record<string, unknown> | undefined)?.localBaseUrl
  if (typeof rawLocalBaseUrl !== 'string' || !rawLocalBaseUrl.trim()) {
    return bare({
      outcomeSummary: 'bindingConfig.localBaseUrl (a real http://127.0.0.1:<port> URL the launched process listens on) is required to verify an http binding locally',
      reasonCodes: ['local-base-url-missing'],
    })
  }
  let baseUrl: URL
  try {
    baseUrl = assertLocalOrigin(rawLocalBaseUrl)
  } catch (error) {
    return bare({ outcomeSummary: error instanceof Error ? error.message : String(error), reasonCodes: ['local-base-url-invalid'] })
  }

  const launchLine = commands[0]!
  const launch = parseCommandLine(launchLine)
  const child = spawn(launch.command, launch.args, {
    cwd: repositoryRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  })
  let launchOutput = ''
  const captureLaunchOutput = (chunk: Buffer) => {
    if (launchOutput.length < 4_096) launchOutput += chunk.toString('utf8')
  }
  child.stdout?.on('data', captureLaunchOutput)
  child.stderr?.on('data', captureLaunchOutput)

  try {
    const readyDeadline = Date.now() + 5_000
    let ready = false
    while (Date.now() < readyDeadline) {
      const probe = syncFetchLocalhost(`${baseUrl.origin}/health`, 'GET', 800)
      if (probe.ok) {
        ready = true
        break
      }
      syncSleep(150)
    }
    if (!ready) {
      return buildVerificationRecord({
        projectId,
        binding,
        design,
        launchCommand: `${launch.command} ${launch.args.join(' ')}`.trim(),
        triggerKind: 'http',
        redactedTriggerInput: JSON.stringify({ method: binding.method, path: binding.path }),
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startedMs,
        healthState: 'unreachable',
        verificationStatus: 'fail',
        reasonCodes: ['launch-not-ready'],
        outcomeSummary: `launched process never became ready at ${baseUrl.origin}/health within the readiness timeout${launchOutput.trim() ? `: ${launchOutput.trim().slice(0, 500)}` : ''}`,
      })
    }

    const probeUrl = `${baseUrl.origin}${binding.path}`
    const probe = syncFetchLocalhost(probeUrl, binding.method, 5_000)
    const ok = probe.ok && (probe.status ?? 500) < 500
    return buildVerificationRecord({
      projectId,
      binding,
      design,
      launchCommand: `${launch.command} ${launch.args.join(' ')}`.trim(),
      triggerKind: 'http',
      redactedTriggerInput: JSON.stringify({ method: binding.method, path: binding.path }),
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedMs,
      healthState: ok ? 'healthy' : 'degraded',
      verificationStatus: ok ? 'pass' : 'fail',
      reasonCodes: ok ? [] : ['http-probe-failed'],
      outcomeSummary: ok ? `${binding.method} ${binding.path} -> HTTP ${probe.status}` : `http probe failed: ${probe.error ?? `HTTP ${probe.status ?? 'none'}`}`,
    })
  } finally {
    killSpawnedSync(child)
  }
}

function verifyConnectionExecutor(deps: ConnectExecutorDeps) {
  return (
    input: { projectId: string; moduleId: string; bindingConfig?: unknown },
    context: ExecutionContext,
  ): { ok: boolean; value?: unknown; diagnostics?: DesignDiagnostic[] } => {
    const design = deps.getModuleDesign(input.projectId, input.moduleId)
    if (!design) {
      return { ok: false, diagnostics: [makeDiagnostic('EUC16-CONNECT-MODULE-NOT-FOUND', `no module design exists for module "${input.moduleId}"`, 'moduleId')] }
    }

    let binding: InboundBinding | undefined
    if (input.bindingConfig !== undefined) {
      const shape = validateBindingShape(input.bindingConfig)
      if (!shape.ok || !shape.binding) return { ok: false, diagnostics: shape.diagnostics }
      binding = shape.binding
    } else {
      binding = loadPersistedBinding(deps.dataDir, input.projectId, input.moduleId)
      if (!binding) {
        return {
          ok: false,
          diagnostics: [
            makeDiagnostic(
              'EUC16-CONNECT-BINDING-NOT-CONFIGURED',
              `no binding is configured for module "${input.moduleId}"; call configureBinding first or supply bindingConfig`,
              'bindingConfig',
            ),
          ],
        }
      }
    }

    if (binding.kind !== 'cli' && binding.kind !== 'http') {
      return {
        ok: false,
        diagnostics: [makeDiagnostic('EUC16-CONNECT-KIND-UNSUPPORTED', `verifyConnection supports "cli" and "http" bindings only (received "${binding.kind}")`, 'kind')],
      }
    }

    const commands = design.verification.configuredCommands
    if (commands.length === 0) {
      return {
        ok: false,
        diagnostics: [makeDiagnostic('EUC16-CONNECT-NO-CONFIGURED-COMMANDS', `module "${input.moduleId}" defines no verification.configuredCommands to launch/probe its deployable`, 'moduleId')],
      }
    }

    const record =
      binding.kind === 'cli'
        ? runCliConnectionCheck(deps.repositoryRoot, input.projectId, binding, design, commands, context)
        : runHttpConnectionCheck(deps.repositoryRoot, input.projectId, binding, design, commands, input.bindingConfig)

    return {
      ok: record.verificationStatus === 'pass',
      value: record,
      diagnostics: record.verificationStatus === 'pass' ? [] : [makeDiagnostic('EUC16-CONNECT-VERIFICATION-FAILED', record.outcomeSummary, 'bindingConfig')],
    }
  }
}

// ---------------------------------------------------------------------------
// runScenario
// ---------------------------------------------------------------------------

/** Recognizes `"<stepId>: <command line>"` (see module doc) among a flat `configuredCommands` list. */
function findStepCommand(stepId: string, allCommands: string[]): string | undefined {
  const prefix = `${stepId}:`
  for (const line of allCommands) {
    const trimmed = line.trim()
    if (trimmed.startsWith(prefix)) {
      const rest = trimmed.slice(prefix.length).trim()
      if (rest) return rest
    }
  }
  return undefined
}

function runScenarioExecutor(deps: ConnectExecutorDeps) {
  return (
    input: { entry: ScenarioTestPlanEntry; analysis: UseCaseAnalysis },
    context: ExecutionContext,
  ): { steps: ScenarioStepEvidence[]; outcome: ScenarioRun['outcome']; startedAt: string; completedAt: string } => {
    const startedAt = new Date().toISOString()
    const useCase = input.analysis.useCases.find((u) => u.id === input.entry.useCaseId)
    const scenario = useCase?.scenarios.find((s) => s.id === input.entry.scenarioId)
    if (!scenario) {
      return { steps: [], outcome: 'skipped', startedAt, completedAt: new Date().toISOString() }
    }

    const allCommands = deps.listApprovedModuleDesigns(input.analysis.projectId).flatMap((d) => d.verification.configuredCommands)

    const steps: ScenarioStepEvidence[] = []
    for (const step of scenario.steps) {
      const stepStartedAt = new Date().toISOString()
      if (context.cancellationRequested) {
        steps.push({
          stepId: step.id,
          action: step.action,
          expectedResult: step.expectedResult,
          actualResult: '(not executed — cancellation requested)',
          startedAt: stepStartedAt,
          endedAt: new Date().toISOString(),
          outcome: 'cancelled',
          structuredEvidenceRef: 'cancelled: cancellationRequested was set before this step ran',
        })
        continue
      }

      const commandLine = findStepCommand(step.id, allCommands)
      if (!commandLine) {
        steps.push({
          stepId: step.id,
          action: step.action,
          expectedResult: step.expectedResult,
          actualResult: '(not executed — no configured command)',
          startedAt: stepStartedAt,
          endedAt: new Date().toISOString(),
          outcome: 'skipped',
          structuredEvidenceRef: `skipped: no verification.configuredCommands entry formatted "${step.id}: <command>" was found for this step`,
        })
        continue
      }

      const { command, args } = parseCommandLine(commandLine)
      const outcome = runConfiguredCommandSync({
        command,
        args,
        cwd: deps.repositoryRoot,
        root: deps.repositoryRoot,
        timeoutMs: 60_000,
        allowedCommands: [command],
        envAllowlist: ['PATH'],
      })
      const passed = outcome.exitCode === 0 && !outcome.timedOut && !outcome.cancelled
      steps.push({
        stepId: step.id,
        action: step.action,
        expectedResult: step.expectedResult,
        actualResult: passed ? step.expectedResult : `command failed (exit ${outcome.exitCode ?? 'none'}${outcome.timedOut ? ', timeout' : ''}): ${commandLine}`,
        startedAt: stepStartedAt,
        endedAt: new Date().toISOString(),
        outcome: passed ? 'passed' : 'failed',
        structuredEvidenceRef: `command:${commandLine}:exit=${outcome.exitCode ?? 'none'}${outcome.timedOut ? ':timeout' : ''}`,
      })
    }

    const ranSteps = steps.filter((s) => s.outcome !== 'skipped')
    const outcome: ScenarioRun['outcome'] =
      ranSteps.length === 0
        ? 'skipped'
        : ranSteps.some((s) => s.outcome === 'cancelled')
          ? 'cancelled'
          : ranSteps.some((s) => s.outcome === 'failed')
            ? 'failed'
            : 'passed'

    return { steps, outcome, startedAt, completedAt: new Date().toISOString() }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Builds the real `configureBinding`/`verifyConnection`/`runScenario` executors from `deps` (see module doc). */
export function createConnectExecutors(deps: ConnectExecutorDeps): Pick<DesignOperationExecutors, 'configureBinding' | 'verifyConnection' | 'runScenario'> {
  return {
    configureBinding: configureBindingExecutor(deps),
    verifyConnection: verifyConnectionExecutor(deps),
    runScenario: runScenarioExecutor(deps),
  }
}
