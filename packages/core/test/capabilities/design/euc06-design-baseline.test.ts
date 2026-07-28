/**
 * EUC-06 — Design baseline.
 * Acceptance (SPECIFICATION.md §25.3 EUC-06):
 *  - complete mode blocks Build until required module designs are approved;
 *  - incremental mode allows only dependency-closed approved modules;
 *  - the baseline hash changes when one linked module revision changes.
 * Also covers §16.7 gate-mode change (approved decision required) and
 * agent-cannot-approve.
 */
import { describe, expect, it } from 'vitest'
import type { ArchitectureSpecification } from '../../../src/capabilities/types.js'
import type { ModuleDesignSpecification } from '../../../src/capabilities/design/records.js'
import type { RegisteredContract } from '../../../src/capabilities/design/contractRegistry.js'
import {
  approveDesignBaseline,
  baselineStaleness,
  changeGateMode,
  createDefaultPolicy,
  createDesignBaseline,
  evaluateBuildGate,
} from '../../../src/capabilities/design/designBaseline.js'

function architecture(overrides: Partial<ArchitectureSpecification> = {}): ArchitectureSpecification {
  return {
    schemaVersion: '1.0',
    projectId: 'proj-1',
    id: 'arch-1',
    revision: 'r1',
    status: 'approved',
    applicationSpecId: 'app-1',
    applicationSpecRevision: 'r1',
    applicationSpecHash: 'app-hash',
    capabilityProjections: [],
    moduleIds: ['mod.core', 'mod.adapter'],
    dependencyEdges: [{ fromModuleId: 'mod.core', toModuleId: 'mod.adapter', reason: 'calls adapter' }],
    operationAllocations: [{ operationId: 'op.import', moduleId: 'mod.core' }],
    adapterAllocations: [{ adapterId: 'adapter.ext', moduleId: 'mod.adapter', portId: 'port.ext' }],
    workflowTraces: [{ useCaseId: 'uc.import', moduleIds: ['mod.core', 'mod.adapter'] }],
    proposals: [],
    unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-DES-SYS', passed: true, diagnostics: [] },
    contentHash: 'arch-hash',
    ...overrides,
  }
}

function moduleDesign(overrides: {
  id: string
  moduleId: string
  revision?: string
  status?: ModuleDesignSpecification['status']
  contentHash?: string
  providedOperations?: ModuleDesignSpecification['providedOperations']
  requiredOperations?: ModuleDesignSpecification['requiredOperations']
  ownedPaths?: string[]
}): ModuleDesignSpecification {
  return {
    schemaVersion: '1.0',
    projectId: 'proj-1',
    id: overrides.id,
    revision: overrides.revision ?? 'r1',
    status: overrides.status ?? 'approved',
    architecture: { id: 'arch-1', revision: 'r1', contentHash: 'arch-hash' },
    module: {
      moduleId: overrides.moduleId,
      moduleVersion: '1.0.0',
      name: overrides.moduleId,
      moduleType: 'workflow',
      responsibility: 'owns its allocated operations',
      nonResponsibilities: [],
      ownedConcerns: ['x'],
      excludedConcerns: ['y'],
    },
    trace: { useCaseIds: [], scenarioStepIds: [], ruleIds: [], qualityRequirementIds: [], sourceRefs: [], designDecisionIds: [] },
    boundary: {
      directDependencyIds: [],
      directConsumerIds: [],
      deployableId: 'deployable.primary',
      runtimeAllocation: 'local-embedded',
      runtimeLanguage: 'typescript',
      ownedPaths: overrides.ownedPaths ?? [],
      editableSharedPaths: [],
    },
    providedOperations: overrides.providedOperations ?? [],
    requiredOperations: overrides.requiredOperations ?? [],
    schemas: [],
    rules: [],
    invariants: [],
    behavior: {
      preconditions: [], postconditions: [], domainRejections: [], technicalFailures: [], sideEffects: [],
      idempotency: '', cancellation: '', timeouts: '', concurrency: '', retry: '', recovery: '',
      emittedEvents: [], consumedEvents: [],
    },
    data: {
      inputSchemas: [], outputSchemas: [], persistentRecords: [], dataOwnership: '', retention: '',
      migrationNeeds: '', confidentiality: '', provenanceFields: [], canonicalUnits: [], canonicalEnumerations: [],
    },
    runtime: {
      configurationRefs: [], secretReferenceIds: [], lifecycleRegistration: '', healthBehavior: '',
      telemetry: '', resourceOwnership: '', startupBehavior: '', shutdownBehavior: '', compatibilityConstraints: [],
    },
    verification: {
      examples: [], edgeCases: [], acceptanceCases: [], verificationSuiteIds: [], requiredEvidence: [],
      testDoubles: [], fixtureNeeds: [], configuredCommands: [], unresolvedItems: [],
    },
    typeSpecific: { moduleType: 'workflow', detail: {
      trigger: '', orderedSteps: [], participants: [], decisionsAndGuards: [], transactionBoundary: '',
      partialCompletion: '', compensation: '', retryPolicy: '', deduplication: '', idempotencyKeyUse: '',
      cancellationPoints: [], deadlinePropagation: '', resourceLocks: [], progressReporting: '', finalOutcomes: [],
    } },
    diagrams: [],
    unresolvedItems: [],
    gates: [],
    contentHash: overrides.contentHash ?? `hash-${overrides.moduleId}-${overrides.revision ?? 'r1'}`,
  }
}

const coreDesign = moduleDesign({
  id: 'design.mod.core',
  moduleId: 'mod.core',
  providedOperations: [{ operationId: 'op.import', version: '1.0.0' }],
  requiredOperations: [{ operationId: 'op.adapter-call', acceptedVersionRange: '^1.0.0', reason: 'calls adapter', providerModuleId: 'mod.adapter' }],
})
const adapterDesign = moduleDesign({
  id: 'design.mod.adapter',
  moduleId: 'mod.adapter',
  providedOperations: [{ operationId: 'op.adapter-call', version: '1.0.0' }],
})

const approvedContracts: RegisteredContract[] = [
  { operationId: 'op.import', version: '1.0.0', providerModuleId: 'mod.core', status: 'approved', contract: contractStub('op.import'), contentHash: 'ctr-import' },
  { operationId: 'op.adapter-call', version: '1.0.0', providerModuleId: 'mod.adapter', status: 'approved', contract: contractStub('op.adapter-call'), contentHash: 'ctr-adapter' },
]

function contractStub(operationId: string) {
  return {
    schemaVersion: '1.0' as const,
    operationId,
    version: '1.0.0',
    behavior: 'command' as const,
    inputSchemaRef: 's.in',
    outputSchemaRef: 's.out',
    preconditions: [],
    postconditions: [],
    domainRejections: [],
    technicalErrors: [],
    sideEffects: [],
    idempotency: 'idempotent' as const,
    timeoutClass: 'short' as const,
    cancellable: false,
    artifactTypes: [],
    provenanceFields: [],
  }
}

describe('EUC-06 createDesignBaseline / approveDesignBaseline (§16.6)', () => {
  it('lists every allocated module as required and reports missing modules', () => {
    const baseline = createDesignBaseline(architecture(), [coreDesign], approvedContracts, { baselineId: 'baseline-1' })
    expect(baseline.requiredModuleIds).toEqual(['mod.adapter', 'mod.core'])
    expect(baseline.missingModuleIds).toEqual(['mod.adapter'])
    expect(baseline.status).toBe('draft')
  })

  it('cannot approve while missingModuleIds is non-empty', () => {
    const baseline = createDesignBaseline(architecture(), [coreDesign], approvedContracts, { baselineId: 'baseline-1' })
    const result = approveDesignBaseline(baseline, { approvedBy: 'architect-1', authority: 'software-architect' })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-BASE-MISSING')).toBe(true)
  })

  it('approves once every required module design and contract is approved, and rejects an agent actor', () => {
    const baseline = createDesignBaseline(architecture(), [coreDesign, adapterDesign], approvedContracts, { baselineId: 'baseline-1' })
    expect(baseline.missingModuleIds).toEqual([])
    expect(baseline.gates.every((g) => g.passed)).toBe(true)

    const agentAttempt = approveDesignBaseline(baseline, { approvedBy: 'agent:copilot', authority: 'software-architect' })
    expect(agentAttempt.ok).toBe(false)
    expect(agentAttempt.diagnostics.some((d) => d.code === 'CAP-DES-BASE-AGENT-APPROVAL')).toBe(true)

    const result = approveDesignBaseline(baseline, { approvedBy: 'architect-1', authority: 'software-architect' })
    expect(result.ok).toBe(true)
    expect(result.baseline!.status).toBe('approved')
  })

  it('changes the baseline content hash when one linked module revision changes', () => {
    const baselineA = createDesignBaseline(architecture(), [coreDesign, adapterDesign], approvedContracts, { baselineId: 'baseline-1' })
    const revisedCore = { ...coreDesign, revision: 'r2', contentHash: 'hash-mod.core-r2' }
    const baselineB = createDesignBaseline(architecture(), [revisedCore, adapterDesign], approvedContracts, { baselineId: 'baseline-1' })
    expect(baselineA.contentHash).not.toBe(baselineB.contentHash)
  })
})

describe('EUC-06 baselineStaleness', () => {
  it('is stale when a linked module design revision changed', () => {
    const baseline = createDesignBaseline(architecture(), [coreDesign, adapterDesign], approvedContracts, { baselineId: 'baseline-1' })
    expect(baselineStaleness(baseline, [coreDesign, adapterDesign])).toBe(false)
    const revisedCore = { ...coreDesign, revision: 'r2', contentHash: 'hash-mod.core-r2' }
    expect(baselineStaleness(baseline, [revisedCore, adapterDesign])).toBe(true)
  })

  it('is stale when the architecture revision changed', () => {
    const baseline = createDesignBaseline(architecture(), [coreDesign, adapterDesign], approvedContracts, { baselineId: 'baseline-1' })
    expect(baselineStaleness(baseline, [coreDesign, adapterDesign], { revision: 'r2' })).toBe(true)
  })
})

describe('EUC-06 gate-mode policy (§3.5 / §16.7)', () => {
  it('defaults to completeBaseline', () => {
    const policy = createDefaultPolicy('proj-1')
    expect(policy.mode).toBe('completeBaseline')
  })

  it('requires an approved project decision to switch to incrementalModules', () => {
    const policy = createDefaultPolicy('proj-1')
    const withoutDecision = changeGateMode(policy, 'incrementalModules', undefined, 'architect-1')
    expect(withoutDecision.ok).toBe(false)
    expect(withoutDecision.diagnostics.some((d) => d.code === 'CAP-DES-POLICY-DECISION')).toBe(true)

    const withDecision = changeGateMode(policy, 'incrementalModules', 'decision-1', 'architect-1')
    expect(withDecision.ok).toBe(true)
    expect(withDecision.policy!.mode).toBe('incrementalModules')
    expect(withDecision.policy!.approvedDecisionId).toBe('decision-1')
  })

  it('rejects an agent actor changing the gate mode', () => {
    const policy = createDefaultPolicy('proj-1')
    const result = changeGateMode(policy, 'incrementalModules', 'decision-1', 'agent:copilot')
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-POLICY-AGENT')).toBe(true)
  })
})

describe('EUC-06 evaluateBuildGate (§6.2)', () => {
  it('completeBaseline mode blocks Build until the baseline is approved', () => {
    const policy = createDefaultPolicy('proj-1')
    const draftBaseline = createDesignBaseline(architecture(), [coreDesign, adapterDesign], approvedContracts, { baselineId: 'baseline-1' })
    const blocked = evaluateBuildGate({
      policy,
      baseline: draftBaseline,
      moduleDesign: coreDesign,
      moduleProgress: { useCaseAnalysisApproved: true, systemStructureApproved: true },
      contracts: approvedContracts,
      otherActiveModules: [],
    })
    expect(blocked.ok).toBe(false)
    expect(blocked.diagnostics.some((d) => d.code === 'CAP-DES-BUILD-BASELINE')).toBe(true)

    const approvedBaseline = approveDesignBaseline(draftBaseline, { approvedBy: 'architect-1', authority: 'software-architect' }).baseline!
    const allowed = evaluateBuildGate({
      policy,
      baseline: approvedBaseline,
      moduleDesign: coreDesign,
      moduleProgress: { useCaseAnalysisApproved: true, systemStructureApproved: true },
      contracts: approvedContracts,
      otherActiveModules: [],
    })
    expect(allowed.ok).toBe(true)
  })

  it('incrementalModules mode allows only a dependency-closed approved module and blocks on owned-path conflicts', () => {
    const policy = changeGateMode(createDefaultPolicy('proj-1'), 'incrementalModules', 'decision-1', 'architect-1').policy!
    const draftBaseline = createDesignBaseline(architecture(), [coreDesign], approvedContracts, { baselineId: 'baseline-1' })

    const readyModule = moduleDesign({
      id: 'design.mod.adapter',
      moduleId: 'mod.adapter',
      providedOperations: [{ operationId: 'op.adapter-call', version: '1.0.0' }],
      ownedPaths: ['src/adapter/'],
    })
    const ready = evaluateBuildGate({
      policy,
      baseline: draftBaseline,
      moduleDesign: readyModule,
      moduleProgress: { useCaseAnalysisApproved: true, systemStructureApproved: true },
      contracts: approvedContracts,
      otherActiveModules: [{ moduleId: 'mod.other', ownedPaths: ['src/other/'] }],
    })
    expect(ready.ok).toBe(true)

    const conflicting = evaluateBuildGate({
      policy,
      baseline: draftBaseline,
      moduleDesign: readyModule,
      moduleProgress: { useCaseAnalysisApproved: true, systemStructureApproved: true },
      contracts: approvedContracts,
      otherActiveModules: [{ moduleId: 'mod.other', ownedPaths: ['src/adapter/'] }],
    })
    expect(conflicting.ok).toBe(false)
    expect(conflicting.diagnostics.some((d) => d.code === 'CAP-DES-BUILD-PATH-CONFLICT')).toBe(true)

    const notApprovedModule = moduleDesign({
      id: 'design.mod.adapter',
      moduleId: 'mod.adapter',
      status: 'draft',
      providedOperations: [{ operationId: 'op.adapter-call', version: '1.0.0' }],
    })
    const blockedByModuleStatus = evaluateBuildGate({
      policy,
      baseline: draftBaseline,
      moduleDesign: notApprovedModule,
      moduleProgress: { useCaseAnalysisApproved: true, systemStructureApproved: true },
      contracts: approvedContracts,
      otherActiveModules: [],
    })
    expect(blockedByModuleStatus.ok).toBe(false)
    expect(blockedByModuleStatus.diagnostics.some((d) => d.code === 'CAP-DES-BUILD-MODULE')).toBe(true)

    const blockedByMissingContract = evaluateBuildGate({
      policy,
      baseline: draftBaseline,
      moduleDesign: readyModule,
      moduleProgress: { useCaseAnalysisApproved: true, systemStructureApproved: true },
      contracts: [],
      otherActiveModules: [],
    })
    expect(blockedByMissingContract.ok).toBe(false)
    expect(blockedByMissingContract.diagnostics.some((d) => d.code === 'CAP-DES-BUILD-CONTRACT')).toBe(true)
  })
})
