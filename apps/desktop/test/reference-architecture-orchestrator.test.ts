import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'

import {
  CapabilityWorkspace,
  canonicalHash,
  type ArchitectureSpecification,
  type CompositionManifest,
  type DeployableSpecification,
  type FoundationPlan,
  type ModuleInterviewResponse,
  type ModuleImplementationSpecification,
  type ModuleManifest,
  type OperationContract,
} from '@engineering-ui-kit/core'
import { Workspace } from '@engineering-ui-kit/core'
import {
  ReferenceArchitectureOrchestrator,
  buildRuntimeDistribution,
  parseApprovedCommand,
  platformExecutable,
} from '../src/capabilities/referenceArchitectureOrchestrator.js'

const roots: string[] = []
function tempRoot(label: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), label))
  roots.push(root)
  return root
}

afterEach(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true })
  roots.length = 0
})

function architecture(): ArchitectureSpecification {
  return {
    schemaVersion: '1.0', projectId: 'project-1', id: 'architecture-1', revision: '1', status: 'proposed',
    applicationSpecId: 'application-1', applicationSpecRevision: '1', applicationSpecHash: 'application-hash',
    capabilityProjections: [{ id: 'capability-1', name: 'Capability', moduleIds: ['module-1'] }],
    moduleIds: ['module-1'],
    moduleDefinitions: [{ moduleId: 'module-1', name: 'Module', moduleType: 'domain', responsibility: 'Provide a test operation.' }],
    dependencyEdges: [], operationAllocations: [], adapterAllocations: [],
    workflowTraces: [{ useCaseId: 'use-case-1', moduleIds: ['module-1'] }],
    proposals: [], unresolvedQuestions: [], gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
    contentHash: 'pending',
  }
}

function deployable(): DeployableSpecification {
  return {
    schemaVersion: '1.0', deployableId: 'embedded-library', name: 'Embedded Library', kind: 'embedded-library',
    runtimeLanguage: 'typescript', runtimeVersionRange: '>=22', moduleIds: ['module-1'], inboundBindingIds: [],
    compositionRootPath: 'src/generated/embedded-library/composition.g.ts', commands: {}, configurationRefs: [],
    secretReferenceIds: [], proposedLocations: [{ path: 'src/generated/embedded-library/composition.g.ts', evidence: 'approved test location', approvalStatus: 'approved' }],
  }
}

function manifest(): ModuleManifest {
  return {
    schemaVersion: '1.0', architectureVersion: '1', moduleId: 'module-1', moduleVersion: '1.0.0',
    moduleType: 'domain', name: 'Module', responsibility: 'Provide a test operation.', ownedConcerns: ['test'],
    excludedConcerns: [], providedOperations: [], requiredOperations: [], verificationSuiteIds: [],
    runtimeAllocation: 'local-embedded', events: [], ownedPaths: ['src/modules/module-1/'],
  }
}

function specification(): ModuleImplementationSpecification {
  return {
    schemaVersion: '1.0', projectId: 'project-1', moduleId: 'module-1', moduleVersion: '1.0.0', moduleType: 'domain',
    runtimeLanguage: 'typescript', deployableId: 'embedded-library', ownedPaths: ['src/modules/module-1/'],
    editablePaths: ['src/modules/module-1/'], responsibility: 'Provide a test operation.', nonResponsibilities: [],
    providedOperations: [], requiredOperations: [], providedPorts: [], requiredPorts: [], canonicalSchemaRefs: [],
    generatedTypeTargets: [], rules: [], invariants: [], examples: [], edgeCases: [], failureSemantics: [],
    performanceConstraints: [], cancellationExpectations: 'none', timeoutExpectations: 'none',
    concurrencyExpectations: 'none', lifecycleRegistration: 'singleton', configurationRefs: [], secretReferenceIds: [],
    persistenceExpectations: 'none', telemetryExpectations: 'none', healthExpectations: 'none',
    implementationSteps: [], acceptanceCases: [], acceptanceCommands: [], unresolvedItems: [],
  }
}

function operationContract(): OperationContract {
  return {
    schemaVersion: '1.0', operationId: 'operation.test', version: '1.0.0', behavior: 'command',
    inputSchemaRef: 'operation.test.input', outputSchemaRef: 'operation.test.output',
    preconditions: [], postconditions: ['The requested operation completes.'], domainRejections: [],
    technicalErrors: ['unexpected'], sideEffects: [], idempotency: 'idempotent', timeoutClass: 'short',
    cancellable: false, artifactTypes: [], provenanceFields: [],
  }
}

function operationInterview(moduleVersion = '1.0.1'): ModuleInterviewResponse {
  return {
    moduleId: 'module-1', moduleType: 'domain', name: 'Module', moduleVersion,
    responsibility: 'Provide a test operation.', ownedConcerns: ['test'], excludedConcerns: [],
    providedOperations: [{ operationId: 'operation.test', contractVersion: '1.0.0' }],
    requiredOperations: [], verificationSuiteIds: [], runtimeAllocation: 'local-embedded', events: [],
    ownedPaths: ['src/modules/module-1/'], operationContracts: [operationContract()],
    dataSchemas: [
      { schemaId: 'operation.test.input', description: 'Input.', fields: [] },
      { schemaId: 'operation.test.output', description: 'Output.', fields: [] },
    ],
    answers: [], acceptanceCases: [{ id: 'operation-test', description: 'Run it.', expectedOutcome: 'It completes.' }],
    rules: [],
  }
}

function seed(options: { approveModule?: boolean; deployable?: DeployableSpecification } = {}) {
  const dataDir = tempRoot('euik-integration-data-')
  const repoRoot = tempRoot('euik-integration-repo-')
  execFileSync('git', ['init'], { cwd: repoRoot, stdio: 'ignore' })
  execFileSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: repoRoot })
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repoRoot })
  execFileSync('git', ['commit', '--allow-empty', '-m', 'initial'], { cwd: repoRoot, stdio: 'ignore' })
  const workspace = new Workspace(dataDir)
  workspace.createProject({ id: 'project-1', name: 'Project', repoPath: repoRoot, verificationCommands: [] })
  const capabilities = new CapabilityWorkspace(dataDir)
  const approvedArchitecture = capabilities.approveArchitecture('project-1', architecture())
  if (options.approveModule !== false) capabilities.approveModule('project-1', manifest())
  const approvedDeployable = options.deployable ?? deployable()
  const foundationBody = {
    schemaVersion: '1.0' as const, projectId: 'project-1', architectureId: approvedArchitecture.id,
    architectureRevision: approvedArchitecture.revision, architectureHash: approvedArchitecture.contentHash,
    deployables: [approvedDeployable],
    allocations: [{ moduleId: 'module-1', deployableId: approvedDeployable.deployableId, moduleType: 'domain' as const, rationale: 'approved test allocation' }],
    resolvedAnswers: [], unresolvedAmbiguities: [], readiness: { status: 'ready' as const, issues: [] },
  }
  const foundation: FoundationPlan = { ...foundationBody, contentHash: canonicalHash(foundationBody) }
  capabilities.approveFoundation('project-1', foundation)
  const orchestrator = new ReferenceArchitectureOrchestrator(workspace, dataDir)
  orchestrator.integration.saveModuleSpecification({ ...specification(), deployableId: approvedDeployable.deployableId })
  const compositionBody = {
    schemaVersion: '1.0' as const, projectId: 'project-1', compositionId: approvedDeployable.deployableId,
    applicationRevision: '1', architectureRevision: approvedArchitecture.revision, deployableIds: [approvedDeployable.deployableId],
    registrations: [], operationRoutes: [], inboundAdapterRefs: [], outboundAdapterRefs: [], configurationRefs: [],
    secretReferenceIds: [], telemetryHookRefs: [], healthHookRefs: [], authorizationHookRefs: [],
  }
  const composition: CompositionManifest = { ...compositionBody, compositionHash: canonicalHash(compositionBody) }
  orchestrator.integration.saveCompositionManifest(composition)
  return { orchestrator, repoRoot, dataDir }
}

describe('production reference-architecture orchestrator', () => {
  it('blocks generation state until every allocated module is approved', () => {
    const { orchestrator } = seed({ approveModule: false })

    const state = orchestrator.getState('project-1').deployables[0]

    expect(state?.status).toBe('blocked')
    expect(state?.attention).toEqual(expect.arrayContaining([
      expect.stringMatching(/approved module not found: module-1/i),
    ]))
  })

  it('blocks shared-setup generation for a required host until an entry point is approved', () => {
    const host = {
      ...deployable(),
      deployableId: 'http-api',
      name: 'HTTP API',
      kind: 'http-api' as const,
      compositionRootPath: 'src/generated/http-api/composition.g.ts',
      proposedLocations: [{ path: 'src/generated/http-api/composition.g.ts', evidence: 'approved test location', approvalStatus: 'approved' as const }],
    }
    const { orchestrator } = seed({ deployable: host })

    const preview = orchestrator.previewGeneration('project-1', 'http-api')

    expect(preview.status).toBe('blocked')
    expect(preview.plan.blockers).toEqual(expect.arrayContaining([
      expect.stringMatching(/requires an approved application entry point/i),
    ]))
  })

  it('resolves only approved package-manager shims on Windows', () => {
    expect(platformExecutable('npm', 'win32')).toBe('npm.cmd')
    expect(platformExecutable('npx', 'win32')).toBe('npx.cmd')
    expect(platformExecutable('npm.cmd', 'win32')).toBe('npm.cmd')
    expect(platformExecutable('node', 'win32')).toBe('node')
    expect(platformExecutable('npm', 'darwin')).toBe('npm')
  })

  it('preserves a native Windows executable path without invoking a shell', () => {
    expect(parseApprovedCommand('.\\.venv\\Scripts\\python.exe -m worker.py', 'win32')).toEqual({
      command: '.\\.venv\\Scripts\\python.exe',
      args: ['-m', 'worker.py'],
    })
  })

  it('persists a recoverable failed state after a genuine mid-transaction rollback', () => {
    const { orchestrator, repoRoot, dataDir } = seed()
    const preview = orchestrator.previewGeneration('project-1', 'embedded-library')
    process.env.EUIK_TEST_MODE = '1'
    process.env.EUIK_TEST_FAIL_GENERATION_RENAME_AT = '2'
    try {
      expect(() => orchestrator.applyGeneration({
        projectId: 'project-1', deployableId: 'embedded-library', planId: preview.plan.planId,
        planHash: preview.plan.planHash, explicit: true,
      })).toThrow(/fully rolled back/)
    } finally {
      delete process.env.EUIK_TEST_FAIL_GENERATION_RENAME_AT
      delete process.env.EUIK_TEST_MODE
    }

    expect(fs.existsSync(path.join(repoRoot, 'src/generated/embedded-library/types.g.ts'))).toBe(false)
    const restarted = new ReferenceArchitectureOrchestrator(new Workspace(dataDir), dataDir)
    const recovered = restarted.getState('project-1').deployables[0]
    expect(recovered?.status).toBe('failed')
    expect(recovered?.latestApply?.error).toMatch(/fully rolled back/)
  })

  it('projects a no-loss migration preview for a non-empty existing repository', () => {
    const { orchestrator, repoRoot } = seed()
    fs.mkdirSync(path.join(repoRoot, 'src'), { recursive: true })
    fs.writeFileSync(path.join(repoRoot, 'src', 'index.ts'), 'export const legacy = true\n')
    fs.writeFileSync(path.join(repoRoot, 'package.json'), JSON.stringify({ private: true, type: 'module' }) + '\n')

    const preview = orchestrator.getState('project-1').migrationPreview

    expect(preview?.dataLossAssessment.hasLoss).toBe(false)
    expect(preview?.fileTransformations).not.toContainEqual(expect.objectContaining({ action: 'delete' }))
    expect(preview?.fileTransformations).toContainEqual(expect.objectContaining({ path: 'src/index.ts', action: 'update' }))
  })

  it('includes the ASGI server required by generated Python HTTP hosts', () => {
    const root = tempRoot('euik-python-http-runtime-')
    const distribution = buildRuntimeDistribution({
      ...deployable(),
      deployableId: 'http-api',
      name: 'HTTP API',
      kind: 'http-api',
      runtimeLanguage: 'python',
      compositionRootPath: 'src/composition/http_api.py',
    }, root)

    expect(distribution.files.find((file) => file.path === 'requirements.engineering-ui.txt')?.contents)
      .toContain('uvicorn==0.35.0')
    expect(distribution.dependencies).toContainEqual(expect.objectContaining({ packageName: 'uvicorn', language: 'python' }))
  })

  it('merges every TypeScript deployable composition root into the generated compiler configuration', () => {
    const root = tempRoot('euik-typescript-multi-deployable-')
    fs.writeFileSync(path.join(root, 'tsconfig.engineering-ui.json'), JSON.stringify({
      compilerOptions: { target: 'ES2022' },
      include: ['src/**/*.ts', 'composition/browser.ts'],
    }))

    const distribution = buildRuntimeDistribution({
      ...deployable(),
      compositionRootPath: 'composition/http-api.ts',
    }, root)
    const tsconfig = JSON.parse(distribution.files.find((file) => file.path === 'tsconfig.engineering-ui.json')!.contents)

    expect(tsconfig.include).toEqual([
      'src/**/*.ts',
      'src/**/*.tsx',
      'src/**/*.mts',
      'composition/browser.ts',
      'composition/http-api.ts',
    ])
    expect(distribution.files.find((file) => file.path === 'tsconfig.engineering-ui.json')?.ownership).toBe('editable')
  })

  it('adds greenfield build and typecheck scripts without replacing repository scripts', () => {
    const root = tempRoot('euik-typescript-package-scripts-')
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
      private: true,
      scripts: { build: 'custom-build', test: 'custom-test' },
    }))

    const distribution = buildRuntimeDistribution(deployable(), root)
    const packageJson = JSON.parse(distribution.files.find((file) => file.path === 'package.json')!.contents)

    expect(packageJson.scripts).toEqual({
      build: 'custom-build',
      test: 'custom-test',
      typecheck: 'tsc -p tsconfig.engineering-ui.json --noEmit',
    })
  })

  it('removes retired composition roots from the generated compiler configuration', () => {
    const root = tempRoot('euik-typescript-retired-deployable-')
    fs.writeFileSync(path.join(root, 'tsconfig.engineering-ui.json'), JSON.stringify({
      include: ['src/**/*.ts', 'composition/embedded-library.ts', 'composition/browser.ts'],
    }))

    const distribution = buildRuntimeDistribution({
      ...deployable(),
      compositionRootPath: 'composition/http-api.ts',
    }, root, ['composition/browser.ts', 'composition/http-api.ts'])
    const tsconfig = JSON.parse(distribution.files.find((file) => file.path === 'tsconfig.engineering-ui.json')!.contents)

    expect(tsconfig.include).toEqual([
      'src/**/*.ts',
      'src/**/*.tsx',
      'src/**/*.mts',
      'composition/browser.ts',
      'composition/http-api.ts',
    ])
  })

  it('refreshes a persisted module implementation specification when the approved module version changes', () => {
    const { orchestrator } = seed()
    orchestrator.capabilities.approveModule('project-1', { ...manifest(), moduleVersion: '1.0.1' })

    orchestrator.getState('project-1')

    expect(orchestrator.integration.getModuleSpecification('project-1', 'module-1')?.moduleVersion).toBe('1.0.1')
  })

  it('previews, persists, applies, restores after restart, and rolls back a real generation plan', () => {
    const { orchestrator, repoRoot, dataDir } = seed()
    const preview = orchestrator.previewGeneration('project-1', 'embedded-library')
    expect(preview.status).toBe('plan-ready')
    expect(preview.plan.fileChanges.length).toBeGreaterThan(0)
    const applied = orchestrator.applyGeneration({
      projectId: 'project-1', deployableId: 'embedded-library', planId: preview.plan.planId,
      planHash: preview.plan.planHash, explicit: true,
    })
    expect(applied.status).toBe('applied')
    expect(applied.rollbackId).toBeDefined()
    expect(fs.existsSync(path.join(repoRoot, 'src/generated/embedded-library/types.g.ts'))).toBe(true)

    const restarted = new ReferenceArchitectureOrchestrator(new Workspace(dataDir), dataDir)
    expect(restarted.getState('project-1').deployables[0]?.status).toBe('applied')
    const rolledBack = restarted.rollbackGeneration({
      projectId: 'project-1', deployableId: 'embedded-library', rollbackId: applied.rollbackId!, explicit: true,
    })
    expect(rolledBack.status).toBe('rolled-back')
    expect(fs.existsSync(path.join(repoRoot, 'src/generated/embedded-library/types.g.ts'))).toBe(false)
  })

  it('persists an honest blocked preview when composition input is missing', () => {
    const { orchestrator } = seed()
    fs.rmSync(path.join(orchestrator.capabilities.root('project-1'), 'integration', 'compositions'), { recursive: true, force: true })
    const preview = orchestrator.previewGeneration('project-1', 'embedded-library')
    expect(preview.status).toBe('blocked')
    expect(preview.plan.blockers).toEqual(expect.arrayContaining([expect.stringMatching(/composition manifest/i)]))
    expect(() => orchestrator.applyGeneration({
      projectId: 'project-1', deployableId: 'embedded-library', planId: preview.plan.planId,
      planHash: preview.plan.planHash, explicit: true,
    })).toThrow(/PLAN-BLOCKER/)
  })

  it('rejects non-explicit apply and mismatched plan hashes', () => {
    const { orchestrator } = seed()
    const preview = orchestrator.previewGeneration('project-1', 'embedded-library')
    expect(() => orchestrator.applyGeneration({
      projectId: 'project-1', deployableId: 'embedded-library', planId: preview.plan.planId,
      planHash: preview.plan.planHash, explicit: false,
    })).toThrow(/explicit/)
    expect(() => orchestrator.applyGeneration({
      projectId: 'project-1', deployableId: 'embedded-library', planId: preview.plan.planId,
      planHash: 'hostile-replacement', explicit: true,
    })).toThrow(/hash/)
  })

  it('derives composition factories from approved module ownership and persists only explicitly confirmed targets', () => {
    const { orchestrator } = seed()
    orchestrator.integration.saveModuleSpecification({
      ...specification(),
      providedOperations: [{ operationId: 'operation.test', contractVersion: '1.0.0' }],
      providedPorts: ['operation.test'],
    })
    const proposed = orchestrator.getState('project-1').deployables[0]?.compositionConfiguration
    expect(proposed?.registrations).toEqual([
      expect.objectContaining({
        contractId: 'operation.test',
        providerModuleId: 'module-1',
        suggestedImplementationTarget: 'src/modules/module-1/operation_test.ts#createOperationTest',
      }),
    ])
    expect(() => orchestrator.saveCompositionConfiguration({
      projectId: 'project-1', deployableId: 'embedded-library', explicit: true,
      targets: [{ contractId: 'operation.test', implementationTarget: 'src/outside.ts#createOperationTest' }],
    })).toThrow(/outside/)

    const saved = orchestrator.saveCompositionConfiguration({
      projectId: 'project-1', deployableId: 'embedded-library', explicit: true,
      targets: [{ contractId: 'operation.test', implementationTarget: 'src/modules/module-1/operation_test.ts#createOperationTest' }],
    })
    expect(saved.ready).toBe(true)
    expect(orchestrator.integration.getCompositionManifest('project-1', 'embedded-library')?.registrations)
      .toEqual([expect.objectContaining({ contractId: 'operation.test' })])
  })

  it('projects bindings approved after factory configuration into the next composition plan', () => {
    const { orchestrator } = seed()
    orchestrator.integration.saveModuleSpecification({
      ...specification(),
      providedOperations: [{ operationId: 'operation.test', contractVersion: '1.0.0' }],
      providedPorts: ['operation.test'],
    })
    orchestrator.saveCompositionConfiguration({
      projectId: 'project-1', deployableId: 'embedded-library', explicit: true,
      targets: [{ contractId: 'operation.test', implementationTarget: 'src/modules/module-1/operation_test.ts#createOperationTest' }],
    })
    const binding = {
      schemaVersion: '1.0' as const, kind: 'embedded-library' as const,
      bindingId: 'binding.operation.test', version: '1.0.0', projectId: 'project-1',
      deployableId: 'embedded-library', operationId: 'operation.test', operationVersion: '1.0.0',
      inputMappings: [], outputMappings: [], validationBehavior: 'reject invalid input',
      domainRejectionBehavior: 'return a typed rejection', technicalFailureBehavior: 'return a safe failure',
      timeoutBehavior: 'return timed out', cancellationBehavior: 'return cancelled', retryBehavior: 'none',
      duplicateSubmissionBehavior: 'reject duplicates', exposure: 'private' as const, generatedTargets: [],
      approvalState: 'approved', exportedCallable: 'runOperationTest', reason: 'approved library boundary',
    }
    orchestrator.capabilities.approveInboundBinding('project-1', binding)

    orchestrator.previewGeneration('project-1', 'embedded-library')

    expect(orchestrator.integration.getCompositionManifest('project-1', 'embedded-library')).toEqual(
      expect.objectContaining({
        inboundAdapterRefs: ['binding.operation.test'],
        operationRoutes: [{
          inboundBindingId: 'binding.operation.test', operationId: 'operation.test', operationVersion: '1.0.0',
        }],
      }),
    )
  })

  it('generates the approved inbound adapter and route, then marks only shared setup stale when the binding changes', () => {
    const { orchestrator } = seed()
    const approvedManifest = {
      ...manifest(), moduleVersion: '1.0.1',
      providedOperations: [{ operationId: 'operation.test', contractVersion: '1.0.0' }],
    }
    orchestrator.capabilities.approveModule('project-1', approvedManifest, operationInterview())
    orchestrator.integration.saveModuleSpecification({
      ...specification(), moduleVersion: '1.0.1',
      providedOperations: [{ operationId: 'operation.test', contractVersion: '1.0.0' }],
      providedPorts: ['operation.test'],
    })
    orchestrator.saveCompositionConfiguration({
      projectId: 'project-1', deployableId: 'embedded-library', explicit: true,
      targets: [{ contractId: 'operation.test', implementationTarget: 'src/modules/module-1/operation_test.ts#createOperationTest' }],
    })
    const binding = {
      schemaVersion: '1.0' as const, kind: 'embedded-library' as const,
      bindingId: 'binding.operation.test', version: '1.0.0', projectId: 'project-1',
      deployableId: 'embedded-library', operationId: 'operation.test', operationVersion: '1.0.0',
      inputMappings: [], outputMappings: [], validationBehavior: 'reject invalid input',
      domainRejectionBehavior: 'return a typed rejection', technicalFailureBehavior: 'return a safe failure',
      timeoutBehavior: 'return timed out', cancellationBehavior: 'return cancelled', retryBehavior: 'none',
      duplicateSubmissionBehavior: 'reject duplicates', exposure: 'private' as const, generatedTargets: [],
      approvalState: 'approved', exportedCallable: 'runOperationTest', reason: 'approved library boundary',
    }
    orchestrator.capabilities.approveInboundBinding('project-1', binding)

    const first = orchestrator.previewGeneration('project-1', 'embedded-library')
    expect(first.status).toBe('plan-ready')
    expect(first.plan.inputRecords).toContainEqual(expect.objectContaining({
      recordId: 'binding:binding.operation.test', revision: '1.0.0',
    }))
    expect(first.plan.fileChanges).toContainEqual(expect.objectContaining({
      path: 'src/generated/embedded-library/inbound/binding.operation.test.g.ts',
    }))
    const firstFiles = orchestrator.integration.getGenerationBundle('project-1', first.plan.planId)?.virtualFiles ?? []
    expect(firstFiles.find((file) => file.path.endsWith('/inbound/binding.operation.test.g.ts'))?.contents)
      .toContain('runOperationTest')
    expect(firstFiles.find((file) => file.path === 'src/generated/embedded-library/composition.g.ts')?.contents)
      .toContain('inboundBindingId: "binding.operation.test"')

    orchestrator.applyGeneration({
      projectId: 'project-1', deployableId: 'embedded-library', planId: first.plan.planId,
      planHash: first.plan.planHash, explicit: true,
    })
    expect(orchestrator.getState('project-1').deployables[0]?.status).toBe('applied')

    const revised = { ...binding, version: '1.0.1', exportedCallable: 'executeOperationTest' }
    orchestrator.capabilities.approveInboundBinding('project-1', revised)
    const stale = orchestrator.getState('project-1').deployables[0]
    expect(stale?.status).toBe('stale')
    expect(stale?.attention).toContain('Approved inputs changed after this generation plan was created.')
    expect(orchestrator.capabilities.getApprovedModule('project-1', 'module-1')).toMatchObject({
      moduleId: 'module-1', moduleVersion: '1.0.1',
    })

    const refreshed = orchestrator.previewGeneration('project-1', 'embedded-library')
    expect(refreshed.status).toBe('plan-ready')
    expect(refreshed.plan.inputRecords).toContainEqual(expect.objectContaining({
      recordId: 'binding:binding.operation.test', revision: '1.0.1',
    }))
    orchestrator.applyGeneration({
      projectId: 'project-1', deployableId: 'embedded-library', planId: refreshed.plan.planId,
      planHash: refreshed.plan.planHash, explicit: true, acceptDirtyWorktree: true,
    })
    expect(orchestrator.getState('project-1').deployables[0]?.status).toBe('applied')
  })
})
