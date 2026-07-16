import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { applyGenerationPlan } from '../../src/capabilities/generationApply.js'
import { assembleGenerationPlan } from '../../src/capabilities/generationAssembly.js'
import { runConnectionVerification } from '../../src/capabilities/verificationRunner.js'
import { canonicalHash } from '../../src/capabilities/hash.js'
import type {
  CompositionManifest, ConnectionVerificationRecord, DeployableSpecification, HttpInboundBinding, OperationContract,
} from '../../src/capabilities/types.js'

const roots: string[] = []
afterEach(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true })
  roots.length = 0
})

describe('CAP-TEST-112 generated Python HTTP target', () => {
  it('applies, launches, dispatches through generated composition, and emits observed-path evidence', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-python-generated-'))
    roots.push(root)
    fs.mkdirSync(path.join(root, 'src/domain'), { recursive: true })
    fs.writeFileSync(path.join(root, 'src/domain/echo.py'), [
      'from engineering_ui_capabilities_runtime.core import Outcome',
      '',
      'class EchoOperation:',
      '    def execute(self, input, context):',
      '        return Outcome.success({"echo": input.get("message", "")})',
      '',
      'def create_echo_operation():',
      '    return EchoOperation()',
      '',
    ].join('\n'))

    const operation: OperationContract = {
      schemaVersion: '1.0', operationId: 'echo.run', version: '1.0.0', behavior: 'command',
      inputSchemaRef: 'echo.input', outputSchemaRef: 'echo.output', preconditions: [], postconditions: [],
      domainRejections: [], technicalErrors: ['unexpected'], sideEffects: [], idempotency: 'idempotent',
      timeoutClass: 'short', cancellable: false, artifactTypes: [], provenanceFields: [],
    }
    const binding: HttpInboundBinding = {
      schemaVersion: '1.0', kind: 'http', bindingId: 'binding.echo.http', version: '1.0.0', projectId: 'project-1',
      deployableId: 'python-api', operationId: operation.operationId, operationVersion: operation.version,
      inputMappings: [], outputMappings: [], validationBehavior: 'reject', domainRejectionBehavior: 'typed',
      technicalFailureBehavior: 'safe', timeoutBehavior: 'timed-out', cancellationBehavior: 'propagate',
      retryBehavior: 'none', duplicateSubmissionBehavior: 'none', exposure: 'private', generatedTargets: [],
      approvalState: 'approved', method: 'POST', path: '/echo',
    }
    const deployable: DeployableSpecification = {
      schemaVersion: '1.0', deployableId: 'python-api', name: 'Python API', kind: 'http-api', runtimeLanguage: 'python',
      runtimeVersionRange: '>=3.11', moduleIds: ['module.echo'], inboundBindingIds: [binding.bindingId],
      compositionRootPath: 'src/composition/python_api.py', commands: {}, configurationRefs: [], secretReferenceIds: [], proposedLocations: [],
    }
    const compositionBody = {
      schemaVersion: '1.0' as const, projectId: 'project-1', compositionId: 'python-api', applicationRevision: '1', architectureRevision: '1',
      deployableIds: ['python-api'], registrations: [{
        contractId: operation.operationId, implementationTarget: 'src/domain/echo.py#create_echo_operation', lifecycle: 'singleton' as const,
        providerModuleId: 'module.echo', dependencies: [],
      }],
      operationRoutes: [{ operationId: operation.operationId, operationVersion: operation.version, inboundBindingId: binding.bindingId }],
      inboundAdapterRefs: [binding.bindingId], outboundAdapterRefs: [], configurationRefs: [], secretReferenceIds: [],
      telemetryHookRefs: [], healthHookRefs: [], authorizationHookRefs: [],
    }
    const composition: CompositionManifest = { ...compositionBody, compositionHash: canonicalHash(compositionBody) }
    const assembled = assembleGenerationPlan({
      deployable, inboundBindings: [binding], composition, operations: [operation],
      schemas: [
        { schemaId: 'echo.input', typeName: 'EchoInput', schema: { kind: 'object', properties: [{ name: 'message', schema: { kind: 'string' }, required: true }] } },
        { schemaId: 'echo.output', typeName: 'EchoOutput', schema: { kind: 'object', properties: [{ name: 'echo', schema: { kind: 'string' }, required: true }] } },
      ],
      targetRoot: root, targetCleanState: 'clean', generatorVersion: '1.0.0', referenceProfileVersion: '1.0.0',
      planId: 'plan-python-real', runId: 'run-python-real',
    })
    applyGenerationPlan({ plan: assembled.plan, targetRoot: root, virtualFiles: assembled.virtualFiles, runId: 'run-python-real' })

    const repoRoot = path.resolve(import.meta.dirname, '../../../..')
    const python = path.join(repoRoot, '.venv/bin/python')
    const hashes: ConnectionVerificationRecord['hashes'] = {
      binding: canonicalHash(binding), operation: canonicalHash(operation), architecture: 'architecture-hash',
      composition: composition.compositionHash, generatedOwnership: 'ownership-hash', source: 'source-hash',
    }
    const record = await runConnectionVerification({
      verificationId: 'verification-python-real', projectId: 'project-1', binding, deployable, hashes,
      launch: {
        command: python,
        args: ['src/generated/python_api/host_g.py'],
        cwd: root,
        env: { PYTHONPATH: [root, path.join(repoRoot, 'runtimes/python/src')].join(path.delimiter) },
        healthPath: '/healthz',
        readyTimeoutMs: 10_000,
      },
      trigger: { kind: 'http', method: 'POST', path: '/echo', body: { message: 'hello' } },
      correlationId: 'correlation-python-real',
    })
    expect(record.verificationStatus, JSON.stringify(record, null, 2)).toBe('pass')
    expect(record.observedPath).toEqual({
      inboundAdapter: 'http:binding.echo.http', compositionRoot: 'src/composition/python_api.py',
      operation: 'echo.run@1.0.0', outboundAdapters: [],
    })
  }, 20_000)
})
