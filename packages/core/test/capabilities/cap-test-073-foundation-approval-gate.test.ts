/**
 * CAP-TEST-073 — foundation approval is separate from architecture approval,
 * `foundationHandoffGate` reflects approval and architecture-hash staleness,
 * and `buildModuleImplementationBrief` enrichment with a deployable populates
 * `brief.deployment` (WP5A-core).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CapabilityWorkspace } from '../../src/capabilities/persistence.js'
import { foundationHandoffGate, proposeFoundation } from '../../src/capabilities/foundation.js'
import { buildModuleImplementationBrief } from '../../src/capabilities/implementationBrief.js'
import type { RepositoryDiscoveryResult } from '../../src/capabilities/generation/repositoryDiscovery.js'
import type {
  ArchitectureSpecification,
  DeployableSpecification,
  ModuleImplementationSpecification,
  ModuleManifest,
} from '../../src/capabilities/types.js'
import type { RepositoryImplementationContext } from '../../src/capabilities/implementationBrief.js'

function tmpWorkspace(): CapabilityWorkspace {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-cap-073-'))
  return new CapabilityWorkspace(dir)
}

function architecture(overrides: Partial<ArchitectureSpecification> = {}): ArchitectureSpecification {
  return {
    schemaVersion: '1.0',
    projectId: 'proj-1',
    id: 'arch-1',
    revision: '1',
    status: 'proposed',
    applicationSpecId: 'app-1',
    applicationSpecRevision: '1',
    applicationSpecHash: 'app-hash',
    capabilityProjections: [{ id: 'cap1', name: 'Primary', moduleIds: ['mod.domain'] }],
    moduleIds: ['mod.domain'],
    moduleDefinitions: [
      { moduleId: 'mod.domain', name: 'Domain', moduleType: 'domain', responsibility: 'inventory rules' },
    ],
    dependencyEdges: [],
    operationAllocations: [],
    adapterAllocations: [],
    workflowTraces: [{ useCaseId: 'u1', moduleIds: ['mod.domain'] }],
    proposals: [],
    unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
    contentHash: 'pending',
    ...overrides,
  }
}

function emptyDiscovery(overrides: Partial<RepositoryDiscoveryResult> = {}): RepositoryDiscoveryResult {
  return {
    packageManager: 'unknown',
    languages: [],
    sourceRoots: [],
    testRoots: [],
    entryPoints: [],
    frameworks: [],
    existingCompositionPaths: [],
    ciOperatingSystems: [],
    ambiguities: [],
    ...overrides,
  }
}

describe('CAP-TEST-073 foundation approval gate and brief deployment enrichment', () => {
  it('separates foundation approval from architecture approval and detects hash staleness', () => {
    const ws = tmpWorkspace()

    const approvedArchitecture = ws.approveArchitecture('proj-1', architecture())
    // Approving the architecture must not approve any foundation.
    expect(ws.getApprovedFoundation('proj-1')).toBeUndefined()
    expect(
      foundationHandoffGate({
        approvedArchitecture,
        approvedFoundation: ws.getApprovedFoundation('proj-1'),
      }).enabled,
    ).toBe(false)

    const plan = proposeFoundation({
      architecture: approvedArchitecture,
      discovery: emptyDiscovery({ frameworks: ['fastapi'], languages: ['python'] }),
    })
    expect(plan.readiness.status).toBe('ready')

    // An ambiguous plan is rejected.
    const ambiguousPlan = {
      ...plan,
      readiness: { status: 'ambiguous' as const, issues: [{ id: 'x', text: 'unresolved' }] },
    }
    expect(() => ws.approveFoundation('proj-1', ambiguousPlan)).toThrow()
    expect(ws.getApprovedFoundation('proj-1')).toBeUndefined()

    ws.approveFoundation('proj-1', plan)
    const approvedFoundation = ws.getApprovedFoundation('proj-1')
    expect(approvedFoundation).toEqual(plan)
    expect(ws.getApprovedDeployable('proj-1', 'http-api')).toEqual(plan.deployables[0])

    expect(
      foundationHandoffGate({ approvedArchitecture, approvedFoundation }).enabled,
    ).toBe(true)

    // Re-approving the architecture with different content changes its hash and
    // makes the previously approved foundation stale (gate re-blocks).
    const secondApprovedArchitecture = ws.approveArchitecture('proj-1', architecture({
      revision: '2',
      capabilityProjections: [{ id: 'cap1', name: 'Primary Revised', moduleIds: ['mod.domain'] }],
    }))
    expect(secondApprovedArchitecture.contentHash).not.toBe(approvedArchitecture.contentHash)

    const staleGate = foundationHandoffGate({
      approvedArchitecture: secondApprovedArchitecture,
      approvedFoundation: ws.getApprovedFoundation('proj-1'),
    })
    expect(staleGate.enabled).toBe(false)
    expect(staleGate.reason).toBeDefined()
  })

  it('populates brief.deployment when a deployable (and specification) is supplied, and omits it otherwise', () => {
    const manifest: ModuleManifest = {
      schemaVersion: '1.0',
      architectureVersion: '1.0',
      moduleId: 'mod.domain',
      moduleVersion: '1.0.0',
      moduleType: 'domain',
      name: 'Domain',
      responsibility: 'inventory rules',
      ownedConcerns: ['inventory-rules'],
      excludedConcerns: ['ui'],
      providedOperations: [{ operationId: 'op.receive', contractVersion: '1.0.0' }],
      requiredOperations: [],
      verificationSuiteIds: ['suite.domain'],
      runtimeAllocation: 'local-embedded',
      events: [],
      ownedPaths: ['capabilities/modules/mod.domain/'],
    }
    const arch = architecture({ contentHash: 'arch-hash-brief' })
    const repository: RepositoryImplementationContext = {
      repositoryName: 'test-repo',
      detectedLanguages: ['Python'],
      detectedFrameworks: ['fastapi'],
      detectedPackageManager: 'pip',
      manifestFiles: ['pyproject.toml'],
      sourceRoots: ['src'],
      packageScripts: {},
      configuredVerificationCommands: { test: 'pytest', typecheck: 'mypy .' },
      ownedPaths: [{ path: 'capabilities/modules/mod.domain/', exists: false, kind: 'missing' }],
      existingFilesInScope: [],
      nearbyPatternFiles: [],
      testFiles: [],
    }
    const deployable: DeployableSpecification = {
      schemaVersion: '1.0',
      deployableId: 'http-api',
      name: 'Http Api',
      kind: 'http-api',
      runtimeLanguage: 'python',
      runtimeVersionRange: '>=3.11',
      moduleIds: ['mod.domain'],
      inboundBindingIds: [],
      compositionRootPath: 'src/composition/http-api.py',
      commands: { build: 'pip install -e .', test: 'pytest', launch: 'uvicorn app:main' },
      configurationRefs: [],
      secretReferenceIds: [],
      proposedLocations: [],
    }
    const specification: ModuleImplementationSpecification = {
      schemaVersion: '1.0',
      projectId: 'proj-1',
      moduleId: 'mod.domain',
      moduleVersion: '1.0.0',
      moduleType: 'domain',
      runtimeLanguage: 'python',
      deployableId: 'http-api',
      ownedPaths: ['capabilities/modules/mod.domain/'],
      editablePaths: ['capabilities/modules/mod.domain/'],
      responsibility: 'inventory rules',
      nonResponsibilities: [],
      providedOperations: [{ operationId: 'op.receive', contractVersion: '1.0.0' }],
      requiredOperations: [],
      providedPorts: [],
      requiredPorts: [],
      canonicalSchemaRefs: ['schema.receive.input', 'schema.receive.output'],
      generatedTypeTargets: ['src/generated/receive_types.py'],
      rules: [],
      invariants: [],
      examples: [],
      edgeCases: [],
      failureSemantics: [],
      performanceConstraints: [],
      cancellationExpectations: 'none',
      timeoutExpectations: 'none',
      concurrencyExpectations: 'single-threaded',
      lifecycleRegistration: 'singleton',
      configurationRefs: [],
      secretReferenceIds: [],
      persistenceExpectations: 'none',
      telemetryExpectations: 'none',
      healthExpectations: 'none',
      implementationSteps: [],
      acceptanceCases: [],
      acceptanceCommands: ['pytest tests/mod_domain'],
      unresolvedItems: [],
    }

    const briefWithDeployment = buildModuleImplementationBrief({
      manifest,
      architecture: arch,
      repository,
      deployable,
      specification,
    })
    expect(briefWithDeployment.deployment).toEqual({
      deployableId: 'http-api',
      kind: 'http-api',
      runtimeLanguage: 'python',
      runtimeVersionRange: '>=3.11',
      compositionRootPath: 'src/composition/http-api.py',
      commands: deployable.commands,
      generatedContractRefs: specification.canonicalSchemaRefs,
      generatedTypeTargets: specification.generatedTypeTargets,
      acceptanceCommands: specification.acceptanceCommands,
    })

    const briefWithoutDeployment = buildModuleImplementationBrief({ manifest, architecture: arch, repository })
    expect(briefWithoutDeployment.deployment).toBeUndefined()
  })
})
