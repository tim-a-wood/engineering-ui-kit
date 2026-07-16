import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'

import { applyGenerationPlan } from '../../src/capabilities/generationApply.js'
import { assembleGenerationPlan } from '../../src/capabilities/generationAssembly.js'
import { canonicalHash } from '../../src/capabilities/hash.js'
import { runConnectionVerification } from '../../src/capabilities/verificationRunner.js'
import type {
  CompositionManifest, ConnectionVerificationRecord, DeployableSpecification, EmbeddedLibraryInboundBinding,
  OperationContract, ScheduleInboundBinding,
} from '../../src/capabilities/types.js'

const roots: string[] = []
afterEach(() => { for (const root of roots) fs.rmSync(root, { recursive: true, force: true }); roots.length = 0 })

describe('CAP-TEST-117 generated schedule and embedded-library targets', () => {
  it('compiles and proves both real process paths through generated composition', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-ts-process-generated-'))
    roots.push(root)
    const repoRoot = path.resolve(import.meta.dirname, '../../../..')
    fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(root, 'node_modules'), 'dir')
    fs.mkdirSync(path.join(root, 'src/domain'), { recursive: true })
    fs.writeFileSync(path.join(root, 'src/domain/run.ts'), [
      "import { Outcome } from '@engineering-ui-kit/capabilities-runtime'",
      "export function createRunOperation() { return { code: 'job.run', execute() { return Outcome.success({ ran: true }) } } }",
    ].join('\n'))
    const operation: OperationContract = {
      schemaVersion: '1.0', operationId: 'job.run', version: '1.0.0', behavior: 'command', inputSchemaRef: 'job.input',
      outputSchemaRef: 'job.output', preconditions: [], postconditions: [], domainRejections: [], technicalErrors: ['unexpected'],
      sideEffects: [], idempotency: 'idempotent', timeoutClass: 'short', cancellable: false, artifactTypes: [], provenanceFields: [],
    }
    const common = {
      schemaVersion: '1.0' as const, version: '1.0.0', projectId: 'project-1', deployableId: 'typescript-worker',
      operationId: operation.operationId, operationVersion: operation.version, inputMappings: [], outputMappings: [],
      validationBehavior: 'reject', domainRejectionBehavior: 'typed', technicalFailureBehavior: 'safe', timeoutBehavior: 'timed-out',
      cancellationBehavior: 'propagate', retryBehavior: 'none', duplicateSubmissionBehavior: 'none', exposure: 'private' as const,
      generatedTargets: [], approvalState: 'approved',
    }
    const schedule: ScheduleInboundBinding = {
      ...common, kind: 'schedule', bindingId: 'binding.job.schedule', cronExpression: '* * * * *', timezone: 'UTC',
      overlapPolicy: 'skip', misfirePolicy: 'run-once',
    }
    const embedded: EmbeddedLibraryInboundBinding = {
      ...common, kind: 'embedded-library', bindingId: 'binding.job.embedded', exportedCallable: 'runJob', reason: 'library API',
    }
    const deployable: DeployableSpecification = {
      schemaVersion: '1.0', deployableId: 'typescript-worker', name: 'TypeScript Worker', kind: 'worker', runtimeLanguage: 'typescript',
      runtimeVersionRange: '>=22', moduleIds: ['module.job'], inboundBindingIds: [schedule.bindingId, embedded.bindingId],
      compositionRootPath: 'src/composition/typescript-worker.ts', commands: {}, configurationRefs: [], secretReferenceIds: [], proposedLocations: [],
    }
    const compositionBody = {
      schemaVersion: '1.0' as const, projectId: 'project-1', compositionId: 'typescript-worker', applicationRevision: '1', architectureRevision: '1',
      deployableIds: [deployable.deployableId], registrations: [{ contractId: operation.operationId, implementationTarget: 'src/domain/run.ts#createRunOperation', lifecycle: 'singleton' as const, providerModuleId: 'module.job', dependencies: [] }],
      operationRoutes: [schedule, embedded].map((binding) => ({ operationId: operation.operationId, operationVersion: operation.version, inboundBindingId: binding.bindingId })),
      inboundAdapterRefs: [schedule.bindingId, embedded.bindingId], outboundAdapterRefs: [], configurationRefs: [], secretReferenceIds: [], telemetryHookRefs: [], healthHookRefs: [], authorizationHookRefs: [],
    }
    const composition: CompositionManifest = { ...compositionBody, compositionHash: canonicalHash(compositionBody) }
    const assembled = assembleGenerationPlan({
      deployable, inboundBindings: [schedule, embedded], composition, operations: [operation],
      schemas: [
        { schemaId: 'job.input', typeName: 'JobInput', schema: { kind: 'object', properties: [] } },
        { schemaId: 'job.output', typeName: 'JobOutput', schema: { kind: 'object', properties: [{ name: 'ran', schema: { kind: 'boolean' }, required: true }] } },
      ], targetRoot: root, targetCleanState: 'clean', generatorVersion: '1.0.0', referenceProfileVersion: '1.0.0', planId: 'plan-process', runId: 'run-process',
    })
    applyGenerationPlan({ plan: assembled.plan, targetRoot: root, virtualFiles: assembled.virtualFiles, runId: 'run-process' })
    fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', rootDir: '.', outDir: 'dist', strict: true, skipLibCheck: true, types: ['node'] }, include: ['src/**/*.ts'] }))
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ type: 'module' }))
    execFileSync(path.join(repoRoot, 'node_modules/.bin/tsc'), ['-p', 'tsconfig.json'], { cwd: root, stdio: 'inherit' })

    const verify = async (binding: ScheduleInboundBinding | EmbeddedLibraryInboundBinding, host: string) => {
      const hashes: ConnectionVerificationRecord['hashes'] = { binding: canonicalHash(binding), operation: canonicalHash(operation), architecture: 'architecture-hash', composition: composition.compositionHash, generatedOwnership: 'ownership-hash', source: 'source-hash' }
      return runConnectionVerification({
        verificationId: `verification-${binding.kind}`, projectId: 'project-1', binding, deployable, hashes,
        launch: { command: process.execPath, args: [host], cwd: root }, trigger: { kind: binding.kind, input: {} },
        correlationId: `correlation-${binding.kind}`,
      })
    }
    const scheduleRecord = await verify(schedule, 'dist/src/generated/typescript-worker/worker/binding.job.schedule.host.g.js')
    const embeddedRecord = await verify(embedded, 'dist/src/generated/typescript-worker/embedded/binding.job.embedded.host.g.js')
    expect(scheduleRecord.verificationStatus, JSON.stringify(scheduleRecord, null, 2)).toBe('pass')
    expect(embeddedRecord.verificationStatus, JSON.stringify(embeddedRecord, null, 2)).toBe('pass')
  }, 20_000)
})
