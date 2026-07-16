/**
 * CAP-TEST-094 — real connection verification evidence (CAP-CONTRACT-029).
 *
 * `runConnectionVerification` must LAUNCH a real process (or in-process
 * host), send a REAL trigger, and always terminate what it launched. A
 * direct-dispatch/simulation path must never report `'pass'`.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

import {
  runConnectionVerification,
  runSimulatedConnectionVerification,
  type SpawnLaunch,
} from '../../src/capabilities/verificationRunner.js'
import { assertNoCanaryLeak } from '../../src/capabilities/redaction.js'
import type {
  CliInboundBinding,
  ConnectionVerificationRecord,
  DeployableSpecification,
  HttpInboundBinding,
} from '../../src/capabilities/types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schemaDir = path.resolve(__dirname, '../../../../standards/schemas/capabilities')

function createAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  addFormats(ajv)
  return ajv
}

function loadConnectionVerificationSchema(): object {
  return JSON.parse(fs.readFileSync(path.join(schemaDir, 'connection-verification-record.schema.json'), 'utf8'))
}

function expectSchemaValid(record: ConnectionVerificationRecord): void {
  const ajv = createAjv()
  const validate = ajv.compile(loadConnectionVerificationSchema())
  expect(validate(record), ajv.errorsText(validate.errors)).toBe(true)
}

const HASHES: ConnectionVerificationRecord['hashes'] = {
  binding: 'hash-binding',
  operation: 'hash-operation',
  architecture: 'hash-architecture',
  composition: 'hash-composition',
  generatedOwnership: 'hash-ownership',
  source: 'hash-source',
}

function deployable(overrides: Partial<DeployableSpecification> = {}): DeployableSpecification {
  return {
    schemaVersion: '1.0',
    deployableId: 'http-api',
    name: 'Http Api',
    kind: 'http-api',
    runtimeLanguage: 'typescript',
    runtimeVersionRange: '>=22',
    moduleIds: ['mod.example'],
    inboundBindingIds: [],
    compositionRootPath: 'src/composition/http-api.ts',
    commands: {},
    configurationRefs: [],
    secretReferenceIds: [],
    proposedLocations: [],
    ...overrides,
  }
}

function httpBinding(overrides: Partial<HttpInboundBinding> = {}): HttpInboundBinding {
  return {
    schemaVersion: '1.0',
    kind: 'http',
    bindingId: 'bind-http-1',
    version: '1.0.0',
    projectId: 'proj-1',
    deployableId: 'http-api',
    operationId: 'op.create-widget',
    operationVersion: '1.0.0',
    inputMappings: [],
    outputMappings: [],
    validationBehavior: 'inline',
    domainRejectionBehavior: '409',
    technicalFailureBehavior: '500',
    timeoutBehavior: '504',
    cancellationBehavior: 'abort',
    retryBehavior: 'none',
    duplicateSubmissionBehavior: 'idempotency-key',
    exposure: 'private',
    generatedTargets: [],
    approvalState: 'draft',
    method: 'POST',
    path: '/widgets',
    ...overrides,
  }
}

function cliBinding(overrides: Partial<CliInboundBinding> = {}): CliInboundBinding {
  return {
    schemaVersion: '1.0',
    kind: 'cli',
    bindingId: 'bind-cli-1',
    version: '1.0.0',
    projectId: 'proj-1',
    deployableId: 'cli-tool',
    operationId: 'op.run-report',
    operationVersion: '1.0.0',
    inputMappings: [],
    outputMappings: [],
    validationBehavior: 'inline',
    domainRejectionBehavior: 'exit-code',
    technicalFailureBehavior: 'exit-code',
    timeoutBehavior: 'exit-code',
    cancellationBehavior: 'sigterm',
    retryBehavior: 'none',
    duplicateSubmissionBehavior: 'none',
    exposure: 'private',
    generatedTargets: [],
    approvalState: 'draft',
    command: 'report',
    ...overrides,
  }
}

/** A tiny real node:http server (spawned as its own process) driven purely by env PORT. */
const HTTP_SERVER_SCRIPT = `
const http = require('node:http');
const port = Number(process.env.PORT);
const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200); res.end('ok'); return; }
  if (req.url === '/widgets' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      res.writeHead(200, {
        'content-type': 'application/json',
        'x-correlation-id': req.headers['x-correlation-id'],
        'x-euik-observed-operation': 'op.create-widget',
        'x-euik-observed-path': JSON.stringify({
          inboundAdapter: 'http:bind-http-1',
          compositionRoot: 'src/composition/http-api.ts',
          operation: 'op.create-widget@1.0.0',
          outboundAdapters: [],
        }),
      });
      res.end(JSON.stringify({ kind: 'success', received: JSON.parse(body || '{}') }));
    });
    return;
  }
  res.writeHead(404);
  res.end();
});
server.listen(port, '127.0.0.1');
`

/** A real node:http server whose /health route never becomes healthy. */
const NEVER_READY_SERVER_SCRIPT = `
const fs = require('node:fs');
const http = require('node:http');
fs.writeFileSync(process.env.PIDFILE, String(process.pid));
const port = Number(process.env.PORT);
const server = http.createServer((req, res) => {
  res.writeHead(503);
  res.end();
});
server.listen(port, '127.0.0.1');
`

function nodeEvalLaunch(script: string, extra: Partial<SpawnLaunch> = {}): SpawnLaunch {
  return {
    command: process.execPath,
    args: ['-e', script],
    ...extra,
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

describe('CAP-TEST-094 real connection verification evidence', () => {
  it('real HTTP pass: spawns a real http server, sends a real request, and cleans up', async () => {
    const launch = nodeEvalLaunch(HTTP_SERVER_SCRIPT)
    const record = await runConnectionVerification({
      verificationId: 'ver-http-1',
      projectId: 'proj-1',
      binding: httpBinding(),
      deployable: deployable(),
      hashes: HASHES,
      launch,
      trigger: { kind: 'http', method: 'POST', path: '/widgets', body: { name: 'gizmo' } },
      correlationId: 'corr-http-1',
    })

    expect(record.verificationStatus).toBe('pass')
    expect(record.observedPath.inboundAdapter).toContain('bind-http-1')
    expect(record.observedPath.operation).toContain('op.create-widget')
    expect(record.outcomeSummary).toContain('HTTP 200')
    expect(record.correlationId).toBe('corr-http-1')
    expect(record.usedTestAdapter).toBe(false)
    expect(record.externalEvidenceStatus).toBe('complete')
    expect(record.reasonCodes).toEqual([])
    expectSchemaValid(record)
  })

  it('real CLI pass: requires correlated generated execution-path evidence, not only exit zero', async () => {
    const launch = nodeEvalLaunch(`
      process.stdout.write('cli-ok');
      process.stderr.write('EUIK_CONNECTION_EVIDENCE=' + JSON.stringify({
        correlationId: process.env.EUIK_VERIFICATION_CORRELATION_ID,
        operation: 'op.run-report',
        observedPath: {
          inboundAdapter: 'cli:bind-cli-1',
          compositionRoot: 'src/composition/http-api.ts',
          operation: 'op.run-report@1.0.0',
          outboundAdapters: [],
        },
      }) + '\\n');
      process.exitCode = 0;
    `)
    const record = await runConnectionVerification({
      verificationId: 'ver-cli-1',
      projectId: 'proj-1',
      binding: cliBinding(),
      deployable: deployable({ deployableId: 'cli-tool', kind: 'cli' }),
      hashes: HASHES,
      launch,
      trigger: { kind: 'cli' },
    })

    expect(record.verificationStatus).toBe('pass')
    expect(record.triggerKind).toBe('cli')
    expect(record.outcomeSummary).toContain('exit code 0')
    expect(record.outcomeSummary).toContain('cli-ok')
    expectSchemaValid(record)
  })

  it('a zero-exit CLI without correlated execution-path evidence fails', async () => {
    const record = await runConnectionVerification({
      verificationId: 'ver-cli-no-path', projectId: 'proj-1', binding: cliBinding(),
      deployable: deployable({ deployableId: 'cli-tool', kind: 'cli' }), hashes: HASHES,
      launch: nodeEvalLaunch("process.stdout.write('looks-successful'); process.exitCode = 0;"),
      trigger: { kind: 'cli' },
    })
    expect(record.verificationStatus).toBe('fail')
    expect(record.reasonCodes).toContain('execution-path-not-observed')
  })

  it('a real CLI process with a nonzero exit is failed evidence', async () => {
    const record = await runConnectionVerification({
      verificationId: 'ver-cli-nonzero',
      projectId: 'proj-1',
      binding: cliBinding(),
      deployable: deployable({ deployableId: 'cli-tool', kind: 'cli' }),
      hashes: HASHES,
      launch: nodeEvalLaunch('process.exitCode = 7;'),
      trigger: { kind: 'cli' },
    })

    expect(record.verificationStatus).toBe('fail')
    expect(record.healthState).toBe('degraded')
    expect(record.reasonCodes).toContain('cli-nonzero-exit')
    expect(record.outcomeSummary).toContain('exit code 7')
    expectSchemaValid(record)
  })

  it('simulation / direct-dispatch never reports pass', () => {
    const record = runSimulatedConnectionVerification({
      verificationId: 'ver-sim-1',
      projectId: 'proj-1',
      binding: httpBinding(),
      deployable: deployable(),
      hashes: HASHES,
      triggerKind: 'http',
      simulatedOutcomeSummary: 'direct dispatch returned success in-memory',
    })

    expect(record.verificationStatus).not.toBe('pass')
    expect(record.reasonCodes).toContain('simulation-insufficient')
    expectSchemaValid(record)
  })

  it('usedTestAdapter downgrades an otherwise-real pass to partial/outstanding', async () => {
    const launch = nodeEvalLaunch(HTTP_SERVER_SCRIPT)
    const record = await runConnectionVerification({
      verificationId: 'ver-test-adapter-1',
      projectId: 'proj-1',
      binding: httpBinding(),
      deployable: deployable(),
      hashes: HASHES,
      launch,
      trigger: { kind: 'http', method: 'POST', path: '/widgets', body: { name: 'gizmo' } },
      usedTestAdapter: true,
    })

    expect(record.usedTestAdapter).toBe(true)
    expect(record.externalEvidenceStatus).toBe('outstanding')
    expect(record.verificationStatus).toBe('partial')
    expectSchemaValid(record)
  })

  it('redacts a secret canary from the trigger input and leaves no leak anywhere in the record', async () => {
    const canary = 'CANARY-TOKEN-7Q'
    const launch = nodeEvalLaunch(HTTP_SERVER_SCRIPT)
    const record = await runConnectionVerification({
      verificationId: 'ver-redact-1',
      projectId: 'proj-1',
      binding: httpBinding(),
      deployable: deployable(),
      hashes: HASHES,
      launch,
      trigger: {
        kind: 'http',
        method: 'POST',
        path: '/widgets',
        headers: { authorization: `Bearer ${canary}` },
        body: { apiKey: canary, name: 'gizmo' },
      },
    })

    expect(record.redactedTriggerInput).not.toContain(canary)
    expect(assertNoCanaryLeak(record, [canary])).toEqual([])
    expectSchemaValid(record)
  })

  it('bounds a launch that never becomes ready, returns fail, and leaves no leaked process', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-cap-094-'))
    const pidFile = path.join(tmpDir, 'pid.txt')
    const launch = nodeEvalLaunch(NEVER_READY_SERVER_SCRIPT, {
      env: { PIDFILE: pidFile },
      readyTimeoutMs: 1000,
    })

    const record = await runConnectionVerification({
      verificationId: 'ver-timeout-1',
      projectId: 'proj-1',
      binding: httpBinding(),
      deployable: deployable(),
      hashes: HASHES,
      launch,
      trigger: { kind: 'http', method: 'POST', path: '/widgets', body: {} },
    })

    expect(record.verificationStatus).toBe('fail')
    expect(record.reasonCodes).toContain('launch-not-ready')
    expectSchemaValid(record)

    // The spawned process must have written its pid before we assert it's gone.
    for (let attempt = 0; attempt < 20 && !fs.existsSync(pidFile); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    expect(fs.existsSync(pidFile)).toBe(true)
    const pid = Number(fs.readFileSync(pidFile, 'utf8'))
    expect(isProcessAlive(pid)).toBe(false)

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})
