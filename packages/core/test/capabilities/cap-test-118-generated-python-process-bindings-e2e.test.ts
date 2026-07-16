import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { applyGenerationPlan } from '../../src/capabilities/generationApply.js'
import { assembleGenerationPlan } from '../../src/capabilities/generationAssembly.js'
import { canonicalHash } from '../../src/capabilities/hash.js'
import { runConnectionVerification } from '../../src/capabilities/verificationRunner.js'
import type { CompositionManifest, ConnectionVerificationRecord, DeployableSpecification, EmbeddedLibraryInboundBinding, OperationContract, ScheduleInboundBinding } from '../../src/capabilities/types.js'

const roots: string[] = []
afterEach(() => { for (const root of roots) fs.rmSync(root, { recursive: true, force: true }); roots.length = 0 })

describe('CAP-TEST-118 generated Python schedule and embedded-library targets', () => {
  it('launches and proves both real process paths through generated composition', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-py-process-generated-')); roots.push(root)
    fs.mkdirSync(path.join(root, 'src/domain'), { recursive: true })
    fs.writeFileSync(path.join(root, 'src/domain/run.py'), [
      'from engineering_ui_capabilities_runtime.core import Outcome',
      'class RunOperation:',
      '    def execute(self, input, context): return Outcome.success({"ran": True})',
      'def create_run_operation(): return RunOperation()',
    ].join('\n'))
    const operation: OperationContract = { schemaVersion: '1.0', operationId: 'job.run', version: '1.0.0', behavior: 'command', inputSchemaRef: 'job.input', outputSchemaRef: 'job.output', preconditions: [], postconditions: [], domainRejections: [], technicalErrors: ['unexpected'], sideEffects: [], idempotency: 'idempotent', timeoutClass: 'short', cancellable: false, artifactTypes: [], provenanceFields: [] }
    const common = { schemaVersion: '1.0' as const, version: '1.0.0', projectId: 'project-1', deployableId: 'python-worker', operationId: operation.operationId, operationVersion: operation.version, inputMappings: [], outputMappings: [], validationBehavior: 'reject', domainRejectionBehavior: 'typed', technicalFailureBehavior: 'safe', timeoutBehavior: 'timed-out', cancellationBehavior: 'propagate', retryBehavior: 'none', duplicateSubmissionBehavior: 'none', exposure: 'private' as const, generatedTargets: [], approvalState: 'approved' }
    const schedule: ScheduleInboundBinding = { ...common, kind: 'schedule', bindingId: 'binding.job.schedule', cronExpression: '* * * * *', timezone: 'UTC', overlapPolicy: 'skip', misfirePolicy: 'run-once' }
    const embedded: EmbeddedLibraryInboundBinding = { ...common, kind: 'embedded-library', bindingId: 'binding.job.embedded', exportedCallable: 'run_job', reason: 'library API' }
    const deployable: DeployableSpecification = { schemaVersion: '1.0', deployableId: 'python-worker', name: 'Python Worker', kind: 'worker', runtimeLanguage: 'python', runtimeVersionRange: '>=3.11', moduleIds: ['module.job'], inboundBindingIds: [schedule.bindingId, embedded.bindingId], compositionRootPath: 'src/composition/python_worker.py', commands: {}, configurationRefs: [], secretReferenceIds: [], proposedLocations: [] }
    const compositionBody = { schemaVersion: '1.0' as const, projectId: 'project-1', compositionId: 'python-worker', applicationRevision: '1', architectureRevision: '1', deployableIds: [deployable.deployableId], registrations: [{ contractId: operation.operationId, implementationTarget: 'src/domain/run.py#create_run_operation', lifecycle: 'singleton' as const, providerModuleId: 'module.job', dependencies: [] }], operationRoutes: [schedule, embedded].map((binding) => ({ operationId: operation.operationId, operationVersion: operation.version, inboundBindingId: binding.bindingId })), inboundAdapterRefs: [schedule.bindingId, embedded.bindingId], outboundAdapterRefs: [], configurationRefs: [], secretReferenceIds: [], telemetryHookRefs: [], healthHookRefs: [], authorizationHookRefs: [] }
    const composition: CompositionManifest = { ...compositionBody, compositionHash: canonicalHash(compositionBody) }
    const assembled = assembleGenerationPlan({ deployable, inboundBindings: [schedule, embedded], composition, operations: [operation], schemas: [{ schemaId: 'job.input', typeName: 'JobInput', schema: { kind: 'object', properties: [] } }, { schemaId: 'job.output', typeName: 'JobOutput', schema: { kind: 'object', properties: [{ name: 'ran', schema: { kind: 'boolean' }, required: true }] } }], targetRoot: root, targetCleanState: 'clean', generatorVersion: '1.0.0', referenceProfileVersion: '1.0.0', planId: 'plan-process', runId: 'run-process' })
    applyGenerationPlan({ plan: assembled.plan, targetRoot: root, virtualFiles: assembled.virtualFiles, runId: 'run-process' })
    const repoRoot = path.resolve(import.meta.dirname, '../../../..')
    const launch = (host: string) => ({ command: path.join(repoRoot, '.venv/bin/python'), args: [host], cwd: root, env: { PYTHONPATH: [root, path.join(repoRoot, 'runtimes/python/src')].join(path.delimiter) } })
    const verify = (binding: ScheduleInboundBinding | EmbeddedLibraryInboundBinding, host: string) => {
      const hashes: ConnectionVerificationRecord['hashes'] = { binding: canonicalHash(binding), operation: canonicalHash(operation), architecture: 'architecture-hash', composition: composition.compositionHash, generatedOwnership: 'ownership-hash', source: 'source-hash' }
      return runConnectionVerification({ verificationId: `verification-${binding.kind}`, projectId: 'project-1', binding, deployable, hashes, launch: launch(host), trigger: { kind: binding.kind, input: {} }, correlationId: `correlation-${binding.kind}` })
    }
    const scheduleRecord = await verify(schedule, 'src/generated/python_worker/worker/binding_job_schedule_host_g.py')
    const embeddedRecord = await verify(embedded, 'src/generated/python_worker/embedded/binding_job_embedded_host_g.py')
    expect(scheduleRecord.verificationStatus, JSON.stringify(scheduleRecord, null, 2)).toBe('pass')
    expect(embeddedRecord.verificationStatus, JSON.stringify(embeddedRecord, null, 2)).toBe('pass')
  }, 20_000)
})
