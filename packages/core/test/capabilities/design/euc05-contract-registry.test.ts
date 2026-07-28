/**
 * EUC-05 — Contract registry.
 * Acceptance (SPECIFICATION.md §25.3 EUC-05):
 *  - one operation version has one provider;
 *  - an incompatible change identifies every consumer;
 *  - no implementation packet uses an unapproved contract.
 * Also covers §9.7's "no separate consumer-specific versions" rule.
 */
import { describe, expect, it } from 'vitest'
import type { OperationContract } from '../../../src/capabilities/types.js'
import type { ModuleDesignSpecification } from '../../../src/capabilities/design/records.js'
import {
  approveContract,
  assertNoUnapprovedContractForPacket,
  classifyContractChange,
  consumerReviewRequirements,
  createContractRegistry,
  registerContract,
  type ContractRegistry,
} from '../../../src/capabilities/design/contractRegistry.js'

function contract(overrides: Partial<OperationContract> = {}): OperationContract {
  return {
    schemaVersion: '1.0',
    operationId: 'op.import-evidence',
    version: '1.0.0',
    behavior: 'command',
    inputSchemaRef: 'schema.import-evidence.input@1',
    outputSchemaRef: 'schema.import-evidence.output@1',
    preconditions: ['the project exists'],
    postconditions: ['the evidence is stored'],
    domainRejections: ['duplicate evidence id'],
    technicalErrors: ['storage unavailable'],
    sideEffects: ['writes to the evidence store'],
    idempotency: 'idempotent',
    timeoutClass: 'short',
    cancellable: false,
    artifactTypes: ['evidence-record'],
    provenanceFields: ['importedAt'],
    ...overrides,
  }
}

function moduleDesign(overrides: Partial<ModuleDesignSpecification> = {}): ModuleDesignSpecification {
  return {
    schemaVersion: '1.0',
    projectId: 'proj-1',
    id: 'design.mod.consumer-a',
    revision: 'r1',
    status: 'approved',
    architecture: { id: 'arch-1', revision: 'r1', contentHash: 'arch-hash' },
    module: {
      moduleId: 'mod.consumer-a',
      moduleVersion: '1.0.0',
      name: 'Consumer A',
      moduleType: 'workflow',
      responsibility: 'consumes evidence import',
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
      ownedPaths: [],
      editableSharedPaths: [],
    },
    providedOperations: [],
    requiredOperations: [{ operationId: 'op.import-evidence', acceptedVersionRange: '^1.0.0', reason: 'needs evidence' }],
    schemas: [],
    rules: [],
    invariants: [],
    behavior: {
      preconditions: [],
      postconditions: [],
      domainRejections: [],
      technicalFailures: [],
      sideEffects: [],
      idempotency: '',
      cancellation: '',
      timeouts: '',
      concurrency: '',
      retry: '',
      recovery: '',
      emittedEvents: [],
      consumedEvents: [],
    },
    data: {
      inputSchemas: [],
      outputSchemas: [],
      persistentRecords: [],
      dataOwnership: '',
      retention: '',
      migrationNeeds: '',
      confidentiality: '',
      provenanceFields: [],
      canonicalUnits: [],
      canonicalEnumerations: [],
    },
    runtime: {
      configurationRefs: [],
      secretReferenceIds: [],
      lifecycleRegistration: '',
      healthBehavior: '',
      telemetry: '',
      resourceOwnership: '',
      startupBehavior: '',
      shutdownBehavior: '',
      compatibilityConstraints: [],
    },
    verification: {
      examples: [],
      edgeCases: [],
      acceptanceCases: [],
      verificationSuiteIds: [],
      requiredEvidence: [],
      testDoubles: [],
      fixtureNeeds: [],
      configuredCommands: [],
      unresolvedItems: [],
    },
    typeSpecific: { moduleType: 'workflow', detail: {
      trigger: '', orderedSteps: [], participants: [], decisionsAndGuards: [], transactionBoundary: '',
      partialCompletion: '', compensation: '', retryPolicy: '', deduplication: '', idempotencyKeyUse: '',
      cancellationPoints: [], deadlinePropagation: '', resourceLocks: [], progressReporting: '', finalOutcomes: [],
    } },
    diagrams: [],
    unresolvedItems: [],
    gates: [],
    contentHash: 'design-hash-a',
    ...overrides,
  }
}

const provider = moduleDesign({
  id: 'design.mod.provider',
  module: {
    moduleId: 'mod.provider',
    moduleVersion: '1.0.0',
    name: 'Evidence store',
    moduleType: 'domain',
    responsibility: 'owns evidence storage',
    nonResponsibilities: [],
    ownedConcerns: ['x'],
    excludedConcerns: ['y'],
  },
  providedOperations: [{ operationId: 'op.import-evidence', version: '1.0.0' }],
  requiredOperations: [],
  contentHash: 'design-hash-provider',
})

const consumerA = moduleDesign()
const consumerB = moduleDesign({
  id: 'design.mod.consumer-b',
  module: { ...consumerA.module, moduleId: 'mod.consumer-b', name: 'Consumer B' },
  contentHash: 'design-hash-b',
})

describe('EUC-05 registerContract', () => {
  it('registers a draft contract for one operation version with one provider', () => {
    const result = registerContract(createContractRegistry(), {
      operationId: 'op.import-evidence',
      version: '1.0.0',
      providerModuleId: 'mod.provider',
      contract: contract(),
    })
    expect(result.ok).toBe(true)
    expect(result.contract?.status).toBe('draft')
  })

  it('rejects a second provider module for the same operation version', () => {
    const registered = registerContract(createContractRegistry(), {
      operationId: 'op.import-evidence',
      version: '1.0.0',
      providerModuleId: 'mod.provider',
      contract: contract(),
    })
    const second = registerContract(registered.registry!, {
      operationId: 'op.import-evidence',
      version: '1.0.0',
      providerModuleId: 'mod.other-provider',
      contract: contract(),
    })
    expect(second.ok).toBe(false)
    expect(second.diagnostics.some((d) => d.code === 'CAP-DES-CTR-MULTI-PROVIDER')).toBe(true)
  })

  it('rejects a consumer-specific variant of an already-registered operation version', () => {
    const registered = registerContract(createContractRegistry(), {
      operationId: 'op.import-evidence',
      version: '1.0.0',
      providerModuleId: 'mod.provider',
      contract: contract(),
    })
    const variant = registerContract(registered.registry!, {
      operationId: 'op.import-evidence',
      version: '1.0.0',
      providerModuleId: 'mod.provider',
      contract: contract({ preconditions: ['a different precondition for one consumer'] }),
    })
    expect(variant.ok).toBe(false)
    expect(variant.diagnostics.some((d) => d.code === 'CAP-DES-CTR-VARIANT')).toBe(true)
  })

  it('flags a declared second provider from module designs even before an explicit second registration', () => {
    const otherProvider = moduleDesign({
      id: 'design.mod.other-provider',
      module: { ...provider.module, moduleId: 'mod.other-provider' },
      providedOperations: [{ operationId: 'op.import-evidence', version: '1.0.0' }],
      requiredOperations: [],
    })
    const result = registerContract(createContractRegistry(), {
      operationId: 'op.import-evidence',
      version: '1.0.0',
      providerModuleId: 'mod.provider',
      contract: contract(),
      moduleDesigns: [provider, otherProvider],
    })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-CTR-MULTI-PROVIDER')).toBe(true)
  })
})

describe('EUC-05 approveContract', () => {
  it('approves a registered contract and rejects an agent actor', () => {
    const registered = registerContract(createContractRegistry(), {
      operationId: 'op.import-evidence',
      version: '1.0.0',
      providerModuleId: 'mod.provider',
      contract: contract(),
    })
    const agentAttempt = approveContract(registered.registry!, 'op.import-evidence', '1.0.0', {
      approvedBy: 'agent:copilot',
      authority: 'module-owner',
    })
    expect(agentAttempt.ok).toBe(false)
    expect(agentAttempt.diagnostics.some((d) => d.code === 'CAP-DES-CTR-AGENT-APPROVAL')).toBe(true)

    const approved = approveContract(registered.registry!, 'op.import-evidence', '1.0.0', {
      approvedBy: 'owner-1',
      authority: 'module-owner',
    })
    expect(approved.ok).toBe(true)
    expect(approved.contract?.status).toBe('approved')
  })
})

describe('EUC-05 classifyContractChange (§9.7)', () => {
  it('classifies an additive postcondition as compatibleAdditive', () => {
    const oldContract = contract()
    const newContract = contract({ postconditions: [...oldContract.postconditions, 'an audit event was emitted'] })
    const result = classifyContractChange(oldContract, newContract)
    expect(result.classification).toBe('compatibleAdditive')
    expect(result.newRequiredMigration).toBe(false)
  })

  it('classifies a new precondition as conditionallyCompatible', () => {
    const oldContract = contract()
    const newContract = contract({ preconditions: [...oldContract.preconditions, 'the evidence file is signed'] })
    const result = classifyContractChange(oldContract, newContract)
    expect(result.classification).toBe('conditionallyCompatible')
  })

  it('classifies a removed postcondition as incompatible and identifies every known consumer', () => {
    const oldContract = contract()
    const newContract = contract({ postconditions: [] })
    const result = classifyContractChange(oldContract, newContract, [consumerA, consumerB])
    expect(result.classification).toBe('incompatible')
    expect(result.newRequiredMigration).toBe(true)
    expect(result.staleConsumerModuleIds.sort()).toEqual(['mod.consumer-a', 'mod.consumer-b'])
  })

  it('classifies a changed behavior type as incompatible', () => {
    const oldContract = contract()
    const newContract = contract({ behavior: 'query' })
    const result = classifyContractChange(oldContract, newContract)
    expect(result.classification).toBe('incompatible')
  })

  it('classifies a removed operation (undefined new contract) as incompatible', () => {
    const result = classifyContractChange(contract(), undefined, [consumerA])
    expect(result.classification).toBe('incompatible')
    expect(result.staleConsumerModuleIds).toEqual(['mod.consumer-a'])
  })
})

describe('EUC-05 consumerReviewRequirements', () => {
  it('requires review from the provider and every known consumer', () => {
    const requirements = consumerReviewRequirements(
      { operationId: 'op.import-evidence', providerModuleId: 'mod.provider' },
      { moduleDesigns: [consumerA, consumerB] },
    )
    expect(requirements.some((r) => r.moduleId === 'mod.provider' && r.role === 'provider')).toBe(true)
    expect(requirements.some((r) => r.moduleId === 'mod.consumer-a' && r.role === 'consumer')).toBe(true)
    expect(requirements.some((r) => r.moduleId === 'mod.consumer-b' && r.role === 'consumer')).toBe(true)
  })
})

describe('EUC-05 assertNoUnapprovedContractForPacket', () => {
  it('blocks a packet when a required contract is not approved', () => {
    const registry = createContractRegistry()
    const diagnostics = assertNoUnapprovedContractForPacket(consumerA, registry)
    expect(diagnostics.some((d) => d.code === 'CAP-DES-CTR-UNAPPROVED-REQUIRED')).toBe(true)
  })

  it('blocks a packet when a provided contract is not approved', () => {
    const registered = registerContract(createContractRegistry(), {
      operationId: 'op.import-evidence',
      version: '1.0.0',
      providerModuleId: 'mod.provider',
      contract: contract(),
    })
    const diagnostics = assertNoUnapprovedContractForPacket(provider, registered.registry!)
    expect(diagnostics.some((d) => d.code === 'CAP-DES-CTR-UNAPPROVED-PROVIDED')).toBe(true)
  })

  it('allows a packet once every provided and required contract is approved', () => {
    let registry: ContractRegistry = createContractRegistry()
    registry = registerContract(registry, {
      operationId: 'op.import-evidence',
      version: '1.0.0',
      providerModuleId: 'mod.provider',
      contract: contract(),
    }).registry!
    registry = approveContract(registry, 'op.import-evidence', '1.0.0', {
      approvedBy: 'owner-1',
      authority: 'module-owner',
    }).registry!

    expect(assertNoUnapprovedContractForPacket(provider, registry)).toEqual([])
    expect(assertNoUnapprovedContractForPacket(consumerA, registry)).toEqual([])
  })
})
