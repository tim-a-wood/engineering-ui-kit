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
  type ModuleImplementationSpecification,
  type ModuleManifest,
} from '@engineering-ui-kit/core'
import { Workspace } from '@engineering-ui-kit/core'
import { ReferenceArchitectureOrchestrator } from '../src/capabilities/referenceArchitectureOrchestrator.js'

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

function seed() {
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
  capabilities.approveModule('project-1', manifest())
  const foundationBody = {
    schemaVersion: '1.0' as const, projectId: 'project-1', architectureId: approvedArchitecture.id,
    architectureRevision: approvedArchitecture.revision, architectureHash: approvedArchitecture.contentHash,
    deployables: [deployable()],
    allocations: [{ moduleId: 'module-1', deployableId: 'embedded-library', moduleType: 'domain' as const, rationale: 'approved test allocation' }],
    resolvedAnswers: [], unresolvedAmbiguities: [], readiness: { status: 'ready' as const, issues: [] },
  }
  const foundation: FoundationPlan = { ...foundationBody, contentHash: canonicalHash(foundationBody) }
  capabilities.approveFoundation('project-1', foundation)
  const orchestrator = new ReferenceArchitectureOrchestrator(workspace, dataDir)
  orchestrator.integration.saveModuleSpecification(specification())
  const compositionBody = {
    schemaVersion: '1.0' as const, projectId: 'project-1', compositionId: 'embedded-library',
    applicationRevision: '1', architectureRevision: approvedArchitecture.revision, deployableIds: ['embedded-library'],
    registrations: [], operationRoutes: [], inboundAdapterRefs: [], outboundAdapterRefs: [], configurationRefs: [],
    secretReferenceIds: [], telemetryHookRefs: [], healthHookRefs: [], authorizationHookRefs: [],
  }
  const composition: CompositionManifest = { ...compositionBody, compositionHash: canonicalHash(compositionBody) }
  orchestrator.integration.saveCompositionManifest(composition)
  return { orchestrator, repoRoot, dataDir }
}

describe('production reference-architecture orchestrator', () => {
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
})
