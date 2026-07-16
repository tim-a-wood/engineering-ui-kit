import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import { applyGenerationPlan } from '../../src/capabilities/generationApply.js'
import { assembleGenerationPlan } from '../../src/capabilities/generationAssembly.js'
import { canonicalHash } from '../../src/capabilities/hash.js'
import { runConnectionVerification } from '../../src/capabilities/verificationRunner.js'
import type { CompositionManifest, ConnectionVerificationRecord, DeployableSpecification, OperationContract, UiInboundBinding } from '../../src/capabilities/types.js'

const roots: string[] = []
afterEach(() => { if (!process.env.EUIK_KEEP_TEST_ROOTS) for (const root of roots) fs.rmSync(root, { recursive: true, force: true }); roots.length = 0 })

describe('CAP-TEST-119 generated Electron renderer/preload/main target', () => {
  it('launches real Electron and proves renderer → typed preload → main → composition → operation', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-electron-generated-')); roots.push(root)
    if (process.env.EUIK_KEEP_TEST_ROOTS) console.log(`EUIK electron fixture: ${root}`)
    const repoRoot = path.resolve(import.meta.dirname, '../../../..')
    fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(root, 'node_modules'), 'dir')
    fs.mkdirSync(path.join(root, 'src/domain'), { recursive: true })
    fs.writeFileSync(path.join(root, 'src/domain/echo.ts'), [
      "import { Outcome } from '@engineering-ui-kit/capabilities-runtime'",
      "export function createEchoOperation() { return { code: 'echo.run', execute() { return Outcome.success({ echo: 'electron' }) } } }",
    ].join('\n'))
    const operation: OperationContract = { schemaVersion: '1.0', operationId: 'echo.run', version: '1.0.0', behavior: 'command', inputSchemaRef: 'echo.input', outputSchemaRef: 'echo.output', preconditions: [], postconditions: [], domainRejections: [], technicalErrors: ['unexpected'], sideEffects: [], idempotency: 'idempotent', timeoutClass: 'short', cancellable: false, artifactTypes: [], provenanceFields: [] }
    const binding: UiInboundBinding = { schemaVersion: '1.0', kind: 'ui', bindingId: 'binding.echo.electron', version: '1.0.0', projectId: 'project-1', deployableId: 'electron-main', operationId: operation.operationId, operationVersion: operation.version, inputMappings: [], outputMappings: [], validationBehavior: 'inline', domainRejectionBehavior: 'inline', technicalFailureBehavior: 'inline', timeoutBehavior: 'inline', cancellationBehavior: 'cancel', retryBehavior: 'none', duplicateSubmissionBehavior: 'none', exposure: 'private', generatedTargets: [], approvalState: 'approved', transport: 'electron-ipc', trigger: 'activate', rendererDeployableId: 'electron-main', mainDeployableId: 'electron-main' }
    const deployable: DeployableSpecification = { schemaVersion: '1.0', deployableId: 'electron-main', name: 'Electron Application', kind: 'electron-main', runtimeLanguage: 'typescript', runtimeVersionRange: '>=22', moduleIds: ['module.echo'], inboundBindingIds: [binding.bindingId], compositionRootPath: 'src/composition/electron-main.ts', commands: {}, configurationRefs: [], secretReferenceIds: [], proposedLocations: [] }
    const compositionBody = { schemaVersion: '1.0' as const, projectId: 'project-1', compositionId: 'electron-main', applicationRevision: '1', architectureRevision: '1', deployableIds: [deployable.deployableId], registrations: [{ contractId: operation.operationId, implementationTarget: 'src/domain/echo.ts#createEchoOperation', lifecycle: 'singleton' as const, providerModuleId: 'module.echo', dependencies: [] }], operationRoutes: [{ operationId: operation.operationId, operationVersion: operation.version, inboundBindingId: binding.bindingId }], inboundAdapterRefs: [binding.bindingId], outboundAdapterRefs: [], configurationRefs: [], secretReferenceIds: [], telemetryHookRefs: [], healthHookRefs: [], authorizationHookRefs: [] }
    const composition: CompositionManifest = { ...compositionBody, compositionHash: canonicalHash(compositionBody) }
    const assembled = assembleGenerationPlan({ deployable, inboundBindings: [binding], composition, operations: [operation], schemas: [{ schemaId: 'echo.input', typeName: 'EchoInput', schema: { kind: 'object', properties: [] } }, { schemaId: 'echo.output', typeName: 'EchoOutput', schema: { kind: 'object', properties: [{ name: 'echo', schema: { kind: 'string' }, required: true }] } }], targetRoot: root, targetCleanState: 'clean', generatorVersion: '1.0.0', referenceProfileVersion: '1.0.0', planId: 'plan-electron', runId: 'run-electron' })
    applyGenerationPlan({ plan: assembled.plan, targetRoot: root, virtualFiles: assembled.virtualFiles, runId: 'run-electron' })
    const main = '.engineering-ui/capabilities/build/src/generated/electron-main/electron/binding.echo.electron.verification-main.g.js'
    fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', rootDir: '.', outDir: '.engineering-ui/capabilities/build', strict: true, skipLibCheck: true, types: ['node'], allowSyntheticDefaultImports: true }, include: ['src/**/*.ts', 'src/**/*.mts'] }))
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ type: 'module', main }))
    execFileSync(path.join(repoRoot, 'node_modules/.bin/tsc'), ['-p', 'tsconfig.json'], { cwd: root, stdio: 'inherit' })
    const hashes: ConnectionVerificationRecord['hashes'] = { binding: canonicalHash(binding), operation: canonicalHash(operation), architecture: 'architecture-hash', composition: composition.compositionHash, generatedOwnership: 'ownership-hash', source: 'source-hash' }
    const record = await runConnectionVerification({ verificationId: 'verification-electron-real', projectId: 'project-1', binding, deployable, hashes, launch: { command: (await import('electron')).default, args: ['.'], cwd: root }, trigger: { kind: 'electron-ipc', input: {} }, correlationId: 'correlation-electron-real' })
    expect(record.verificationStatus, JSON.stringify(record, null, 2)).toBe('pass')
    expect(record.observedPath).toEqual({ inboundAdapter: 'ui:binding.echo.electron', compositionRoot: 'src/composition/electron-main.ts', operation: 'echo.run@1.0.0', outboundAdapters: [] })
  }, 30_000)
})
