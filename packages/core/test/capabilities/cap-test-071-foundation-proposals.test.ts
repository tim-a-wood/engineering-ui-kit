/**
 * CAP-TEST-071 — `proposeFoundation` produces deployable proposals from an
 * approved architecture and repository-discovery evidence, reusing
 * `proposeDeployables` for allocation (WP5A-core).
 */
import { describe, expect, it } from 'vitest'
import { importArchitectureProposal, type ArchitectureProposalInput } from '../../src/capabilities/architectureInterview.js'
import { proposeFoundation } from '../../src/capabilities/foundation.js'
import type { RepositoryDiscoveryResult } from '../../src/capabilities/generation/repositoryDiscovery.js'
import type {
  ApplicationSpecification,
  ArchitectureSpecification,
  ModuleManifest,
} from '../../src/capabilities/types.js'

const product: ApplicationSpecification = {
  schemaVersion: '1.0',
  projectId: 'proj-1',
  id: 'app-1',
  revision: '1',
  status: 'approved',
  purpose: 'demo',
  outcomes: ['ship inventory'],
  actors: [{ id: 'a1', text: 'operator' }],
  goals: [{ id: 'g1', text: 'track stock' }],
  useCases: [{ id: 'u1', text: 'receive stock' }],
  scenarios: [{ id: 's1', text: 'happy path' }],
  information: [],
  rules: [],
  externalSystems: [],
  constraints: [],
  scope: { inScope: ['inventory'], outOfScope: ['payroll'] },
  acceptanceCases: [{ id: 'ac1', description: 'receive works', expectedOutcome: 'ok' }],
  sources: [],
  unresolvedQuestions: [],
  contentHash: 'app-hash',
}

function baseArch(overrides: Partial<ArchitectureSpecification> = {}): ArchitectureSpecification {
  return {
    schemaVersion: '1.0',
    projectId: 'proj-1',
    id: 'arch-1',
    revision: '1',
    status: 'proposed',
    applicationSpecId: product.id,
    applicationSpecRevision: product.revision,
    applicationSpecHash: product.contentHash,
    capabilityProjections: [{ id: 'cap1', name: 'Primary', moduleIds: ['mod.domain'] }],
    moduleIds: ['mod.domain'],
    dependencyEdges: [],
    operationAllocations: [],
    adapterAllocations: [],
    workflowTraces: [{ useCaseId: 'u1', moduleIds: ['mod.domain'] }],
    proposals: [],
    unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-GATE-002', passed: false, diagnostics: [] },
    contentHash: 'pending',
    ...overrides,
  }
}

function experienceManifest(id = 'mod.experience'): ModuleManifest {
  return {
    schemaVersion: '1.0',
    architectureVersion: '1.0',
    moduleId: id,
    moduleVersion: '1.0.0',
    moduleType: 'experience',
    name: 'Experience',
    responsibility: 'renders inventory receiving UI',
    ownedConcerns: ['ui-rendering'],
    excludedConcerns: ['persistence'],
    providedOperations: [],
    requiredOperations: [],
    verificationSuiteIds: ['suite.experience'],
    runtimeAllocation: 'local-embedded',
    events: [],
    ownedPaths: [`capabilities/modules/${id}/`],
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

describe('CAP-TEST-071 foundation deployable proposals', () => {
  it('proposes a browser deployable with the experience module allocated (real architecture import)', () => {
    const proposalInput: ArchitectureProposalInput = {
      architecture: baseArch({
        moduleIds: ['mod.experience'],
        capabilityProjections: [{ id: 'cap1', name: 'Primary', moduleIds: ['mod.experience'] }],
        workflowTraces: [{ useCaseId: 'u1', moduleIds: ['mod.experience'] }],
      }),
      manifests: [experienceManifest()],
      moduleNeedTraces: [{ moduleId: 'mod.experience', needIds: ['u1'] }],
      moduleJustifications: [{ moduleId: 'mod.experience', justification: 'distinct-rules' }],
    }
    const imported = importArchitectureProposal(product, proposalInput)
    expect(imported.ok).toBe(true)
    expect(imported.draft).toBeDefined()
    const architecture = imported.draft!
    expect(architecture.moduleDefinitions).toEqual([
      expect.objectContaining({ moduleId: 'mod.experience', moduleType: 'experience' }),
    ])

    const plan = proposeFoundation({
      architecture,
      discovery: emptyDiscovery({ frameworks: ['react'], languages: ['typescript'] }),
    })

    const browser = plan.deployables.find((d) => d.deployableId === 'browser')
    expect(browser).toBeDefined()
    expect(browser?.kind).toBe('browser')
    expect(browser?.runtimeLanguage).toBe('typescript')
    expect(browser?.moduleIds).toContain('mod.experience')
    expect(
      plan.allocations.some(
        (a) => a.moduleId === 'mod.experience' && a.deployableId === 'browser' && a.moduleType === 'experience',
      ),
    ).toBe(true)
    expect(plan.architectureHash).toBe(architecture.contentHash)
  })

  it('keeps discovered composition roots stable across foundation refreshes', () => {
    const architecture = baseArch({
      moduleIds: ['mod.experience'],
      moduleDefinitions: [{ moduleId: 'mod.experience', name: 'Experience', moduleType: 'experience', responsibility: 'ui' }],
      capabilityProjections: [{ id: 'cap1', name: 'Primary', moduleIds: ['mod.experience'] }],
      workflowTraces: [{ useCaseId: 'u1', moduleIds: ['mod.experience'] }],
    })

    const plan = proposeFoundation({
      architecture,
      discovery: emptyDiscovery({ frameworks: ['react'], languages: ['typescript'], sourceRoots: ['composition'] }),
    })

    expect(plan.deployables.find((deployable) => deployable.deployableId === 'browser')?.compositionRootPath)
      .toBe('composition/browser.ts')
  })

  it('proposes an http-api python deployable for a headless architecture with modules allocated', () => {
    const architecture = baseArch({
      moduleDefinitions: [
        { moduleId: 'mod.domain', name: 'Domain', moduleType: 'domain', responsibility: 'inventory rules' },
      ],
      contentHash: 'arch-headless-hash',
    })

    const plan = proposeFoundation({
      architecture,
      discovery: emptyDiscovery({ frameworks: ['fastapi'], languages: ['python'] }),
    })

    const httpApi = plan.deployables.find((d) => d.deployableId === 'http-api')
    expect(httpApi).toBeDefined()
    expect(httpApi?.kind).toBe('http-api')
    expect(httpApi?.runtimeLanguage).toBe('python')
    expect(httpApi?.moduleIds).toEqual(['mod.domain'])
    expect(
      plan.allocations.some(
        (a) => a.moduleId === 'mod.domain' && a.deployableId === 'http-api' && a.moduleType === 'domain',
      ),
    ).toBe(true)
    expect(plan.readiness.status).toBe('ready')
  })
})
