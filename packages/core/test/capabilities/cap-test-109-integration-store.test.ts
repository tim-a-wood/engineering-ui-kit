/** CAP-TEST-109 — durable, restart-safe production integration lifecycle state. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { CapabilityIntegrationStore } from '../../src/capabilities/integrationStore.js'
import { CapabilityWorkspace } from '../../src/capabilities/persistence.js'
import type {
  ConnectionVerificationRecord,
  GenerationPlan,
  ModuleImplementationSpecification,
} from '../../src/capabilities/types.js'

const roots: string[] = []
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-integration-store-'))
  roots.push(root)
  const workspace = new CapabilityWorkspace(root)
  return { root, workspace, store: new CapabilityIntegrationStore(workspace) }
}

afterEach(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true })
  roots.length = 0
})

function plan(overrides: Partial<GenerationPlan> = {}): GenerationPlan {
  return {
    schemaVersion: '1.0',
    planId: 'plan-1',
    projectId: 'project-1',
    inputRecords: [],
    generatorVersion: '1.0.0',
    referenceProfileVersion: '1.0.0',
    targetRepository: { root: '.', cleanState: 'clean' },
    dependencyChanges: [],
    fileChanges: [],
    commands: [],
    warnings: [],
    blockers: [],
    ambiguityQuestions: [],
    rollbackStrategy: 'staged-rename-with-journal',
    planHash: 'plan-hash-1',
    ...overrides,
  }
}

function connectionVerification(): ConnectionVerificationRecord {
  return {
    schemaVersion: '1.0',
    verificationId: 'connection-1',
    projectId: 'project-1',
    bindingId: 'binding-1',
    deployableId: 'deployable-1',
    hashes: { binding: 'b', operation: 'o', architecture: 'a', composition: 'c', generatedOwnership: 'g', source: 's' },
    launchCommand: 'node app.js',
    triggerKind: 'http',
    redactedTriggerInput: '{}',
    outcomeSummary: 'HTTP 200',
    correlationId: 'correlation-1',
    observedPath: { inboundAdapter: 'binding-1', compositionRoot: 'composition.ts', operation: 'op@1', outboundAdapters: [] },
    startedAt: '2026-07-16T00:00:00.000Z',
    completedAt: '2026-07-16T00:00:01.000Z',
    durationMs: 1000,
    healthState: 'healthy',
    usedTestAdapter: false,
    externalEvidenceStatus: 'complete',
    evidenceArtifactRefs: [],
    verificationStatus: 'pass',
    reasonCodes: [],
  }
}

function moduleSpecification(
  overrides: Partial<ModuleImplementationSpecification> = {},
): ModuleImplementationSpecification {
  return {
    schemaVersion: '1.0',
    projectId: 'project-1',
    moduleId: 'module-1',
    moduleVersion: '1.0.0',
    moduleType: 'domain',
    runtimeLanguage: 'typescript',
    deployableId: 'deployable-1',
    ownedPaths: ['src/modules/module-1/'],
    editablePaths: ['src/modules/module-1/'],
    responsibility: 'Provide a test operation.',
    nonResponsibilities: [],
    providedOperations: [],
    requiredOperations: [],
    providedPorts: [],
    requiredPorts: [],
    canonicalSchemaRefs: [],
    generatedTypeTargets: [],
    rules: [],
    invariants: [],
    examples: [],
    edgeCases: [],
    failureSemantics: [],
    performanceConstraints: [],
    cancellationExpectations: 'No cancellation requirement.',
    timeoutExpectations: 'No timeout requirement.',
    concurrencyExpectations: 'No concurrency requirement.',
    lifecycleRegistration: 'singleton',
    configurationRefs: [],
    secretReferenceIds: [],
    persistenceExpectations: 'No persistence requirement.',
    telemetryExpectations: 'No telemetry requirement.',
    healthExpectations: 'No health requirement.',
    implementationSteps: [],
    acceptanceCases: [],
    acceptanceCommands: [],
    unresolvedItems: [],
    ...overrides,
  }
}

describe('CAP-TEST-109 integration lifecycle persistence', () => {
  it('restores plan, virtual files, apply, rollback and connection evidence through a fresh store instance', () => {
    const { root, workspace, store } = fixture()
    store.saveGenerationBundle({
      schemaVersion: '1.0',
      projectId: 'project-1',
      deployableId: 'deployable-1',
      plan: plan(),
      virtualFiles: [{ path: 'generated.ts', contents: 'export {}\n' }],
      inputHash: 'input-hash-1',
      createdAt: '2026-07-16T00:00:00.000Z',
    })
    store.saveApplyRecord({
      schemaVersion: '1.0',
      projectId: 'project-1',
      deployableId: 'deployable-1',
      planId: 'plan-1',
      planHash: 'plan-hash-1',
      applyRunId: 'apply-1',
      status: 'rolled-back',
      rollbackId: 'apply-1',
      ownershipManifests: [],
      commands: [],
      startedAt: '2026-07-16T00:00:00.000Z',
      completedAt: '2026-07-16T00:00:02.000Z',
    })
    store.saveConnectionVerification(connectionVerification())

    const restarted = new CapabilityIntegrationStore(new CapabilityWorkspace(root))
    expect(restarted.getCurrentGenerationBundle('project-1', 'deployable-1')?.virtualFiles[0]?.contents).toBe('export {}\n')
    expect(restarted.getLatestApplyRecord('project-1', 'deployable-1')?.status).toBe('rolled-back')
    expect(restarted.listConnectionVerifications('project-1')).toHaveLength(1)
    expect(restarted.buildState('project-1', ['deployable-1']).deployables[0]?.status).toBe('rolled-back')
    expect(workspace.getApprovedArchitecture('project-1')).toBeUndefined()
  })

  it('marks a persisted plan stale when the current approved-input hash changes', () => {
    const { store } = fixture()
    store.saveGenerationBundle({
      schemaVersion: '1.0', projectId: 'project-1', deployableId: 'deployable-1',
      plan: plan(), virtualFiles: [], inputHash: 'old-input', createdAt: '2026-07-16T00:00:00.000Z',
    })
    const state = store.buildState('project-1', ['deployable-1'], { 'deployable-1': 'new-input' })
    expect(state.deployables[0]?.status).toBe('stale')
    expect(state.deployables[0]?.attention[0]).toMatch(/inputs changed/i)
  })

  it('rejects a plan-id collision instead of silently replacing persisted source', () => {
    const { store } = fixture()
    const base = { schemaVersion: '1.0' as const, projectId: 'project-1', deployableId: 'deployable-1', virtualFiles: [], inputHash: 'i', createdAt: '2026-07-16T00:00:00.000Z' }
    store.saveGenerationBundle({ ...base, plan: plan() })
    expect(() => store.saveGenerationBundle({ ...base, plan: plan({ planHash: 'different' }) })).toThrow(/collision/)
  })

  it('blocks deterministic STE defects before it persists a module specification', () => {
    const { workspace, store } = fixture()
    const specification = moduleSpecification({
      responsibility: 'Analyse the test operation; return a result.',
    })

    expect(() => store.saveModuleSpecification(specification)).toThrow(
      /STE-(?:PUNCTUATION-SEMICOLON|SPELLING-AMERICAN)/,
    )
    expect(store.getModuleSpecification('project-1', 'module-1')).toBeUndefined()
    expect(fs.existsSync(workspace.root('project-1'))).toBe(false)
  })

  it('uses the optional project lexicon when it saves a module specification', () => {
    const { store } = fixture()
    const specification = moduleSpecification({
      responsibility: 'Utilize the test operation.',
    })

    expect(() => store.saveModuleSpecification(specification, {
      prohibitedAliases: { Utilize: 'Use' },
    })).toThrow(/STE-TERM-PREFERRED/)
    expect(store.getModuleSpecification('project-1', 'module-1')).toBeUndefined()
  })
})
