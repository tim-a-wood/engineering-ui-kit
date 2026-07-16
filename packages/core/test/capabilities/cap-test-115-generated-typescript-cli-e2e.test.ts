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
  CliInboundBinding,
  CompositionManifest,
  ConnectionVerificationRecord,
  DeployableSpecification,
  OperationContract,
} from '../../src/capabilities/types.js'

const roots: string[] = []
afterEach(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true })
  roots.length = 0
})

describe('CAP-TEST-115 generated TypeScript CLI target', () => {
  it('compiles, launches, dispatches through generated composition, and proves the observed path', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-ts-cli-generated-'))
    roots.push(root)
    const repoRoot = path.resolve(import.meta.dirname, '../../../..')
    fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(root, 'node_modules'), 'dir')
    fs.mkdirSync(path.join(root, 'src/domain'), { recursive: true })
    fs.writeFileSync(path.join(root, 'src/domain/echo.ts'), [
      "import { Outcome } from '@engineering-ui-kit/capabilities-runtime'",
      'export function createEchoOperation() {',
      "  return { code: 'echo.run', execute(input: { message: string }) { return Outcome.success({ echo: input.message }) } }",
      '}',
    ].join('\n'))

    const operation: OperationContract = {
      schemaVersion: '1.0', operationId: 'echo.run', version: '1.0.0', behavior: 'command',
      inputSchemaRef: 'echo.input', outputSchemaRef: 'echo.output', preconditions: [], postconditions: [],
      domainRejections: [], technicalErrors: ['unexpected'], sideEffects: [], idempotency: 'idempotent',
      timeoutClass: 'short', cancellable: false, artifactTypes: [], provenanceFields: [],
    }
    const binding: CliInboundBinding = {
      schemaVersion: '1.0', kind: 'cli', bindingId: 'binding.echo.cli', version: '1.0.0', projectId: 'project-1',
      deployableId: 'typescript-cli', operationId: operation.operationId, operationVersion: operation.version,
      inputMappings: [], outputMappings: [], validationBehavior: 'reject', domainRejectionBehavior: 'exit-code',
      technicalFailureBehavior: 'exit-code', timeoutBehavior: 'exit-code', cancellationBehavior: 'signal', retryBehavior: 'none',
      duplicateSubmissionBehavior: 'none', exposure: 'private', generatedTargets: [], approvalState: 'approved',
      command: 'echo', argumentMappings: [{ from: 'message', to: 'message' }],
    }
    const deployable: DeployableSpecification = {
      schemaVersion: '1.0', deployableId: 'typescript-cli', name: 'TypeScript CLI', kind: 'cli', runtimeLanguage: 'typescript',
      runtimeVersionRange: '>=22', moduleIds: ['module.echo'], inboundBindingIds: [binding.bindingId],
      compositionRootPath: 'src/composition/typescript-cli.ts', commands: {}, configurationRefs: [], secretReferenceIds: [], proposedLocations: [],
    }
    const compositionBody = {
      schemaVersion: '1.0' as const, projectId: 'project-1', compositionId: 'typescript-cli', applicationRevision: '1', architectureRevision: '1',
      deployableIds: [deployable.deployableId], registrations: [{
        contractId: operation.operationId, implementationTarget: 'src/domain/echo.ts#createEchoOperation', lifecycle: 'singleton' as const,
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
      planId: 'plan-ts-cli-real', runId: 'run-ts-cli-real',
    })
    applyGenerationPlan({ plan: assembled.plan, targetRoot: root, virtualFiles: assembled.virtualFiles, runId: 'run-ts-cli-real' })
    fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', rootDir: '.', outDir: 'dist', strict: true, skipLibCheck: true, types: ['node'] },
      include: ['src/**/*.ts'],
    }))
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ type: 'module' }))
    execFileSync(process.execPath, [path.join(repoRoot, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], { cwd: root, stdio: 'inherit' })

    const hashes: ConnectionVerificationRecord['hashes'] = {
      binding: canonicalHash(binding), operation: canonicalHash(operation), architecture: 'architecture-hash',
      composition: composition.compositionHash, generatedOwnership: 'ownership-hash', source: 'source-hash',
    }
    const record = await runConnectionVerification({
      verificationId: 'verification-ts-cli-real', projectId: 'project-1', binding, deployable, hashes,
      launch: { command: process.execPath, args: ['dist/src/generated/typescript-cli/cli-host.g.js'], cwd: root },
      trigger: { kind: 'cli', args: ['echo', 'hello'] }, correlationId: 'correlation-ts-cli-real',
    })
    expect(record.verificationStatus, JSON.stringify(record, null, 2)).toBe('pass')
    expect(record.observedPath).toEqual({
      inboundAdapter: 'cli:binding.echo.cli', compositionRoot: 'src/composition/typescript-cli.ts',
      operation: 'echo.run@1.0.0', outboundAdapters: [],
    })
  }, 20_000)
})
