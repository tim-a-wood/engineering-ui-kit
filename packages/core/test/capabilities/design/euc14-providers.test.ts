/**
 * EUC-14 — Provider adapters.
 * Acceptance (SPECIFICATION.md §24.3 Copilot compatibility tests):
 *  - all modes create the same canonical record shape;
 *  - only user approval changes state to approved;
 *  - a partial response is recoverable;
 *  - a second pass uses the current module revision;
 *  - a provider outage does not lose work.
 * Also covers §19 (Provider unavailable, Copilot response incomplete),
 * §11.5 (a deterministic delta must pass `validateReturnedDelta`), and
 * §20.2 (agent isolation — stable-id and architecture tampering rejected).
 */
import { describe, expect, it } from 'vitest'
import {
  canonicalizeResponse,
  copilotHandoffProvider,
  deterministicTestProvider,
  importModuleDesignResponse,
  inAppProvider,
  noProvider,
  type CopilotIo,
  type InAppGenerator,
  type ModuleDesignResponse,
} from '../../../src/capabilities/design/providers.js'
import { buildModuleImplementationPacket, multiPassContinuation, type BuildModuleImplementationPacketInput } from '../../../src/capabilities/design/contextPacket.js'
import { approveContract, createContractRegistry, registerContract, type ContractRegistry } from '../../../src/capabilities/design/contractRegistry.js'
import { validateReturnedDelta } from '../../../src/capabilities/design/deltaInspector.js'
import type { ContextManifest, ModuleDesignPacket, ModuleDesignSpecification, ModuleImplementationPacket } from '../../../src/capabilities/design/records.js'
import type { AcceptanceCase, OperationContract } from '../../../src/capabilities/types.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function contextManifest(targetRevision = 'r1'): ContextManifest {
  return {
    id: 'ctx-1',
    targetRecordId: 'design.mod.evidence-store',
    targetRevision,
    tokenOrByteLimit: 100_000,
    totalBytes: 10,
    entries: [{ kind: 'record', ref: 'design.mod.evidence-store', contentHash: 'h1', bytes: 10, priority: 1, inclusionReason: 'canonical module design' }],
    omitted: [],
    contentHash: 'ctx-hash',
  }
}

function designPacket(overrides: Partial<ModuleDesignPacket> = {}): ModuleDesignPacket {
  return {
    schemaVersion: '1.0',
    packetId: 'design-packet-1',
    projectId: 'proj-1',
    moduleId: 'mod.evidence-store',
    moduleType: 'domain',
    architectureRevision: 'r1',
    architectureHash: 'arch-hash',
    systemSlice: {
      moduleSummaries: [{ moduleId: 'mod.evidence-store', name: 'Evidence store', responsibility: 'owns evidence storage' }],
      dependencyEdges: [],
    },
    useCaseIds: ['uc.store-evidence'],
    scenarioStepIds: ['uc.store-evidence.step-1'],
    providerSummaries: [{ moduleId: 'mod.evidence-store', operations: [{ operationId: 'op.import-evidence', version: '1.0.0' }] }],
    consumerSummaries: [],
    projectRules: [],
    typeSpecificQuestions: [],
    contextManifest: contextManifest(),
    existingPatterns: [],
    missingDecisions: [],
    expectedResponseSchemaRef: 'ModuleDesignSpecification@1.0',
    stableIdsToPreserve: ['mod.evidence-store'],
    responseValidationRules: [],
    approvalProhibited: true,
    idempotencyKey: 'idem-design-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    contentHash: 'design-packet-hash',
    ...overrides,
  }
}

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
  const base: ModuleDesignSpecification = {
    schemaVersion: '1.0',
    projectId: 'proj-1',
    id: 'design.mod.evidence-store',
    revision: 'r1',
    status: 'approved',
    architecture: { id: 'arch-1', revision: 'r1', contentHash: 'arch-hash' },
    module: {
      moduleId: 'mod.evidence-store',
      moduleVersion: '1.0.0',
      name: 'Evidence store',
      moduleType: 'domain',
      responsibility: 'owns evidence storage',
      nonResponsibilities: [],
      ownedConcerns: ['storage'],
      excludedConcerns: ['import'],
    },
    trace: {
      useCaseIds: ['uc.store-evidence'],
      scenarioStepIds: ['uc.store-evidence.step-1'],
      ruleIds: [],
      qualityRequirementIds: [],
      sourceRefs: [],
      designDecisionIds: [],
    },
    boundary: {
      directDependencyIds: [],
      directConsumerIds: [],
      deployableId: 'deployable.primary',
      runtimeAllocation: 'local-embedded',
      runtimeLanguage: 'typescript',
      ownedPaths: ['capabilities/modules/mod.evidence-store/'],
      editableSharedPaths: ['capabilities/shared/types.ts'],
    },
    providedOperations: [{ operationId: 'op.import-evidence', version: '1.0.0' }],
    requiredOperations: [],
    schemas: [
      { schemaId: 'schema.import-evidence.input', version: '1', role: 'input', ref: 'schema.import-evidence.input@1' },
      { schemaId: 'schema.import-evidence.output', version: '1', role: 'output', ref: 'schema.import-evidence.output@1' },
    ],
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
    typeSpecific: {
      moduleType: 'domain',
      detail: {
        domainVocabulary: [],
        valueObjects: [],
        consistencyBoundary: '',
        invariants: [],
        calculations: [],
        decisionTables: [],
        deterministicOrdering: '',
        canonicalIdentityRules: '',
        revisionComparison: '',
        invalidStatePrevention: '',
        operationPurity: [],
      },
    },
    diagrams: [],
    unresolvedItems: [],
    gates: [],
    approval: {
      approvedBy: 'owner-1',
      authority: 'module-owner',
      approvedAt: '2026-01-01T00:00:00.000Z',
      recordId: 'design.mod.evidence-store',
      revision: 'r1',
      contentHash: 'frozen-hash',
    },
    contentHash: 'design-hash',
  }
  return { ...base, ...overrides }
}

function approvedRegistry(): ContractRegistry {
  let registry = createContractRegistry()
  registry = registerContract(registry, {
    operationId: 'op.import-evidence',
    version: '1.0.0',
    providerModuleId: 'mod.evidence-store',
    contract: contract(),
  }).registry!
  registry = approveContract(registry, 'op.import-evidence', '1.0.0', { approvedBy: 'owner-1', authority: 'module-owner' }).registry!
  return registry
}

function acceptanceCase(): AcceptanceCase {
  return { id: 'ac-1', description: 'imports one evidence file', expectedOutcome: 'the evidence is stored' }
}

function implementationInput(overrides: Partial<BuildModuleImplementationPacketInput> = {}): BuildModuleImplementationPacketInput {
  return {
    projectId: 'proj-1',
    design: moduleDesign(),
    contractRegistry: approvedRegistry(),
    architectureRevision: 'r1',
    architectureHash: 'arch-hash',
    contextManifest: contextManifest(),
    implementationSteps: ['create the evidence store module'],
    acceptanceCases: [acceptanceCase()],
    testCommands: ['npm test'],
    requiredEvidence: ['unit-test-report'],
    idempotencyKey: 'idem-1',
    passKind: 'initial',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function implementationPacket(overrides: Partial<BuildModuleImplementationPacketInput> = {}): ModuleImplementationPacket {
  const result = buildModuleImplementationPacket(implementationInput(overrides))
  if (!result.ok || !result.packet) throw new Error(`fixture packet build failed: ${JSON.stringify(result.diagnostics)}`)
  return result.packet
}

const noCancellation = {}

// ---------------------------------------------------------------------------
// §24.3 — same canonical record shape across every provider mode
// ---------------------------------------------------------------------------

describe('EUC-14 §24.3 canonical shape equivalence', () => {
  function deterministicDraftKeys(): string[] {
    return [
      'architecture',
      'behavior',
      'boundary',
      'data',
      'module',
      'providedOperations',
      'requiredOperations',
      'runtime',
      'schemas',
      'trace',
      'typeSpecific',
      'verification',
    ]
  }

  function stubResponse(): ModuleDesignResponse {
    return {
      draft: {
        module: { moduleId: 'mod.evidence-store', moduleType: 'domain', responsibility: 'stub' },
        architecture: { revision: 'r1', contentHash: 'arch-hash' },
        trace: { useCaseIds: ['uc.store-evidence'], scenarioStepIds: [] },
        boundary: { directDependencyIds: [] },
        providedOperations: [{ operationId: 'op.import-evidence', version: '1.0.0' }],
        requiredOperations: [],
        schemas: [],
        behavior: { idempotency: 'stub' },
        data: { dataOwnership: 'stub' },
        runtime: { lifecycleRegistration: 'stub' },
        verification: { acceptanceCases: [] },
        typeSpecific: { moduleType: 'domain' },
      },
      assumptions: ['stub assumption'],
      unresolvedQuestions: [],
      proposedContracts: [],
      proposedDiagrams: [],
      sourceRefs: ['design.mod.evidence-store'],
      changeSummary: 'stub change summary',
    }
  }

  it('the deterministic, in-app, and Copilot round-trip providers all produce the same canonical shape', async () => {
    const packet = designPacket()

    const deterministic = deterministicTestProvider()
    const deterministicResult = await deterministic.requestModuleDesign(packet, noCancellation)
    expect(deterministicResult.ok).toBe(true)

    const inApp: InAppGenerator = {
      async requestModuleDesign() {
        return stubResponse()
      },
      async requestImplementation(p) {
        throw new Error('not used in this test')
      },
    }
    const inAppResult = await inAppProvider(inApp).requestModuleDesign(packet, noCancellation)
    expect(inAppResult.ok).toBe(true)

    const io: CopilotIo = {
      async writePacketFiles() {
        /* no-op in-memory drop */
      },
      async readResponse() {
        return JSON.stringify(stubResponse())
      },
    }
    const copilotResult = await copilotHandoffProvider(io).requestModuleDesign(packet, noCancellation)
    expect(copilotResult.ok).toBe(true)

    const shapes = [deterministicResult, inAppResult, copilotResult].map((r) => canonicalizeResponse(r.value))
    expect(shapes[0]!.draftKeys).toEqual(deterministicDraftKeys())
    expect(shapes[1]).toEqual(shapes[0])
    expect(shapes[2]).toEqual(shapes[0])
  })

  it('the none provider produces no value — manual-work mode, never a canonical shape to compare', async () => {
    const packet = designPacket()
    const result = await noProvider().requestModuleDesign(packet, noCancellation)
    expect(result.ok).toBe(false)
    expect(result.unavailable).toBe(true)
    expect(result.value).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Only user approval changes state to approved
// ---------------------------------------------------------------------------

describe('EUC-14 importModuleDesignResponse — never approves (§19, §11.2)', () => {
  it('strips an agent-set status and approval, with a diagnostic', () => {
    const packet = designPacket()
    const response: ModuleDesignResponse = {
      draft: {
        module: { moduleId: 'mod.evidence-store' },
        boundary: {},
        status: 'approved',
        approval: { approvedBy: 'agent:copilot', authority: 'module-owner' },
      },
      assumptions: [],
      unresolvedQuestions: [],
      proposedContracts: [],
      proposedDiagrams: [],
      sourceRefs: [],
      changeSummary: '',
    }
    const result = importModuleDesignResponse(response, packet)
    expect(result.imported.status).toBeUndefined()
    expect((result.imported as Record<string, unknown>).approval).toBeUndefined()
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-PROV-STRIP-APPROVAL')).toBe(true)
    // twice, once for `status` and once for `approval`
    expect(result.diagnostics.filter((d) => d.code === 'CAP-DES-PROV-STRIP-APPROVAL').length).toBe(2)
  })

  it('strips product-computed gates and contentHash', () => {
    const packet = designPacket()
    const response: ModuleDesignResponse = {
      draft: { module: {}, gates: [{ gateId: 'x', passed: true, diagnostics: [] }], contentHash: 'agent-supplied-hash' },
      assumptions: [],
      unresolvedQuestions: [],
      proposedContracts: [],
      proposedDiagrams: [],
      sourceRefs: [],
      changeSummary: '',
    }
    const result = importModuleDesignResponse(response, packet)
    expect((result.imported as Record<string, unknown>).gates).toBeUndefined()
    expect((result.imported as Record<string, unknown>).contentHash).toBeUndefined()
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-PROV-STRIP-CONTROLLED')).toBe(true)
  })

  it('strips an unrecognized top-level field with a diagnostic', () => {
    const packet = designPacket()
    const response: ModuleDesignResponse = {
      draft: { module: {}, boundary: {}, evilExtraField: 'do-not-import-me' },
      assumptions: [],
      unresolvedQuestions: [],
      proposedContracts: [],
      proposedDiagrams: [],
      sourceRefs: [],
      changeSummary: '',
    }
    const result = importModuleDesignResponse(response, packet)
    expect((result.imported as Record<string, unknown>).evilExtraField).toBeUndefined()
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-PROV-UNKNOWN-FIELD' && d.target === 'evilExtraField')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Stable-ID and architecture tampering rejected
// ---------------------------------------------------------------------------

describe('EUC-14 importModuleDesignResponse — stable-id tampering rejected (§20.2)', () => {
  it('reverts an attempt to change the preserved module id', () => {
    const packet = designPacket()
    const response: ModuleDesignResponse = {
      draft: { module: { moduleId: 'mod.attacker-renamed', responsibility: 'hijacked' } },
      assumptions: [],
      unresolvedQuestions: [],
      proposedContracts: [],
      proposedDiagrams: [],
      sourceRefs: [],
      changeSummary: '',
    }
    const result = importModuleDesignResponse(response, packet)
    const importedModule = (result.imported as Record<string, unknown>).module as Record<string, unknown>
    expect(importedModule.moduleId).toBe('mod.evidence-store')
    // the rest of the (non-tampering) field content is still imported
    expect(importedModule.responsibility).toBe('hijacked')
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-PROV-MODULE-ID-TAMPER')).toBe(true)
  })

  it('reverts an attempt to change the approved architecture reference', () => {
    const packet = designPacket()
    const response: ModuleDesignResponse = {
      draft: { architecture: { revision: 'r99', contentHash: 'attacker-hash' } },
      assumptions: [],
      unresolvedQuestions: [],
      proposedContracts: [],
      proposedDiagrams: [],
      sourceRefs: [],
      changeSummary: '',
    }
    const result = importModuleDesignResponse(response, packet)
    const importedArchitecture = (result.imported as Record<string, unknown>).architecture as Record<string, unknown>
    expect(importedArchitecture.revision).toBe('r1')
    expect(importedArchitecture.contentHash).toBe('arch-hash')
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-PROV-ARCHITECTURE-TAMPER')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// A partial response is recoverable
// ---------------------------------------------------------------------------

describe('EUC-14 importModuleDesignResponse — partial response is recoverable (§19)', () => {
  it('lists exactly the missing required fields, imports the valid ones, and a second import completes', () => {
    const packet = designPacket()
    const firstResponse: ModuleDesignResponse = {
      draft: {
        module: { moduleId: 'mod.evidence-store', responsibility: 'owns evidence storage' },
        boundary: { ownedPaths: ['capabilities/modules/mod.evidence-store/'] },
        trace: { useCaseIds: ['uc.store-evidence'] },
        providedOperations: [{ operationId: 'op.import-evidence', version: '1.0.0' }],
      },
      assumptions: ['partial pass'],
      unresolvedQuestions: ['what retention policy applies?'],
      proposedContracts: [],
      proposedDiagrams: [],
      sourceRefs: ['design.mod.evidence-store'],
      changeSummary: 'first partial pass',
    }
    const first = importModuleDesignResponse(firstResponse, packet)
    expect(first.missingRequiredFields).toEqual(['requiredOperations', 'schemas', 'behavior', 'data', 'runtime', 'verification', 'typeSpecific'])
    expect((first.imported as Record<string, unknown>).module).toBeDefined()
    expect((first.imported as Record<string, unknown>).boundary).toBeDefined()

    const secondResponse: ModuleDesignResponse = {
      draft: {
        requiredOperations: [],
        schemas: [],
        behavior: { idempotency: 'complete' },
        data: { dataOwnership: 'complete' },
        runtime: { lifecycleRegistration: 'complete' },
        verification: { acceptanceCases: [] },
        typeSpecific: { moduleType: 'domain' },
      },
      assumptions: [],
      unresolvedQuestions: [],
      proposedContracts: [],
      proposedDiagrams: [],
      sourceRefs: [],
      changeSummary: 'second completing pass',
    }
    const second = importModuleDesignResponse(secondResponse, packet, first.imported)
    expect(second.missingRequiredFields).toEqual([])
    // fields from the first pass are still present after the second merge
    expect((second.imported as Record<string, unknown>).module).toEqual((first.imported as Record<string, unknown>).module)
    expect((second.imported as Record<string, unknown>).behavior).toEqual({ idempotency: 'complete' })
  })
})

// ---------------------------------------------------------------------------
// Deterministic context/provider — byte-identical for the same packet
// ---------------------------------------------------------------------------

describe('EUC-14 deterministicTestProvider — deterministic (§24.3)', () => {
  it('produces a byte-identical module-design response for the same packet, twice', async () => {
    const packet = designPacket()
    const provider = deterministicTestProvider()
    const first = await provider.requestModuleDesign(packet, noCancellation)
    const second = await provider.requestModuleDesign(packet, noCancellation)
    expect(first.ok).toBe(true)
    expect(JSON.stringify(first.value)).toBe(JSON.stringify(second.value))
  })

  it('produces a byte-identical returned delta for the same packet, twice', async () => {
    const packet = implementationPacket()
    const provider = deterministicTestProvider()
    const first = await provider.requestImplementation(packet, noCancellation)
    const second = await provider.requestImplementation(packet, noCancellation)
    expect(first.ok).toBe(true)
    expect(JSON.stringify(first.value)).toBe(JSON.stringify(second.value))
  })

  it('the generated ReturnedDelta passes validateReturnedDelta against its own packet (§11.5)', async () => {
    const packet = implementationPacket()
    const result = await deterministicTestProvider().requestImplementation(packet, noCancellation)
    expect(result.ok).toBe(true)
    const inspection = validateReturnedDelta(result.value!, packet, {})
    expect(inspection.accepted).toBe(true)
    expect(inspection.rejectionReasons).toEqual([])
  })

  it('a second pass uses the current module revision — the continuation packet base is echoed (§11.7)', async () => {
    const registry = approvedRegistry()
    const first = implementationPacket({ contractRegistry: registry })
    expect(first.moduleDesignRevision).toBe('r1')

    const appliedRevisionR2 = 'r2'
    const continuation = multiPassContinuation(first, appliedRevisionR2, 'continueModule')
    const designAtR2 = moduleDesign({ revision: appliedRevisionR2 })
    const second = implementationPacket({
      design: designAtR2,
      contractRegistry: registry,
      contextManifest: contextManifest(appliedRevisionR2),
      idempotencyKey: 'idem-2',
      ...continuation,
    })
    expect(second.moduleDesignRevision).toBe(appliedRevisionR2)
    expect(second.packetId).not.toBe(first.packetId)

    const result = await deterministicTestProvider().requestImplementation(second, noCancellation)
    expect(result.ok).toBe(true)
    expect(result.value!.baseRevision).toBe(appliedRevisionR2)
    expect(result.value!.packetId).toBe(second.packetId)
    // never reuses the first (stale) packet's base
    expect(result.value!.baseRevision).not.toBe(first.moduleDesignRevision)
  })
})

// ---------------------------------------------------------------------------
// Provider outage does not lose work
// ---------------------------------------------------------------------------

describe('EUC-14 provider outage never loses work (§19 "Provider unavailable")', () => {
  it('a copilot handoff with no response yet is unavailable, and the packet is untouched', async () => {
    const packet = designPacket()
    const packetSnapshot = JSON.stringify(packet)
    const io: CopilotIo = {
      async writePacketFiles() {},
      async readResponse() {
        return undefined
      },
    }
    const result = await copilotHandoffProvider(io).requestModuleDesign(packet, noCancellation)
    expect(result.ok).toBe(false)
    expect(result.unavailable).toBe(true)
    expect(result.value).toBeUndefined()
    expect(JSON.stringify(packet)).toBe(packetSnapshot)
  })

  it('a malformed copilot response is treated as unavailable, not as data loss', async () => {
    const packet = designPacket()
    const io: CopilotIo = {
      async writePacketFiles() {},
      async readResponse() {
        return 'not valid json {'
      },
    }
    const result = await copilotHandoffProvider(io).requestModuleDesign(packet, noCancellation)
    expect(result.ok).toBe(false)
    expect(result.unavailable).toBe(true)
  })

  it('an in-app generator that throws never throws through — it becomes unavailable', async () => {
    const packet = designPacket()
    const generate: InAppGenerator = {
      async requestModuleDesign() {
        throw new Error('simulated provider crash')
      },
      async requestImplementation() {
        throw new Error('simulated provider crash')
      },
    }
    const result = await inAppProvider(generate).requestModuleDesign(packet, noCancellation)
    expect(result.ok).toBe(false)
    expect(result.unavailable).toBe(true)
    expect(result.diagnostics.length).toBeGreaterThan(0)
  })

  it('the none provider is always unavailable — manual-work mode', async () => {
    const result = await noProvider().requestModuleDesign(designPacket(), noCancellation)
    expect(result.ok).toBe(false)
    expect(result.unavailable).toBe(true)
  })

  it('an outage leaves the draft (baseDraft) intact for retry — a later import still completes it', () => {
    const packet = designPacket()
    const firstResponse: ModuleDesignResponse = {
      draft: { module: { moduleId: 'mod.evidence-store' }, boundary: {} },
      assumptions: [],
      unresolvedQuestions: [],
      proposedContracts: [],
      proposedDiagrams: [],
      sourceRefs: [],
      changeSummary: '',
    }
    const first = importModuleDesignResponse(firstResponse, packet)
    const baseDraftSnapshot = JSON.stringify(first.imported)

    // Simulate an outage: no response is available, so nothing new is imported.
    const outageResult = importModuleDesignResponse(undefined, packet, first.imported)
    expect(outageResult.imported).toEqual(first.imported)
    expect(outageResult.missingRequiredFields).toEqual(first.missingRequiredFields)
    // the original draft used as the base for retry is never mutated
    expect(JSON.stringify(first.imported)).toBe(baseDraftSnapshot)
  })

  it('a cancelled request never performs provider I/O and reports unavailable', async () => {
    const packet = designPacket()
    let wrote = false
    const io: CopilotIo = {
      async writePacketFiles() {
        wrote = true
      },
      async readResponse() {
        return JSON.stringify({ draft: {} })
      },
    }
    const result = await copilotHandoffProvider(io).requestModuleDesign(packet, { cancellation: { cancelled: true } })
    expect(result.ok).toBe(false)
    expect(result.unavailable).toBe(true)
    expect(wrote).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Copilot handoff — partial ReturnedDelta is flagged, not silently accepted
// ---------------------------------------------------------------------------

describe('EUC-14 copilotHandoffProvider requestImplementation (§11.3, §11.5)', () => {
  it('flags a returned delta missing required fields as partial, listing them as diagnostics', async () => {
    const packet = implementationPacket()
    const io: CopilotIo = {
      async writePacketFiles() {},
      async readResponse() {
        return JSON.stringify({ packetId: packet.packetId, baseRevision: packet.moduleDesignRevision })
      },
    }
    const result = await copilotHandoffProvider(io).requestImplementation(packet, noCancellation)
    expect(result.ok).toBe(true)
    expect(result.partial).toBe(true)
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-PROV-MISSING-FIELD')).toBe(true)
  })

  it('accepts a complete returned delta and it validates against its packet', async () => {
    const packet = implementationPacket()
    const deterministicDelta = await deterministicTestProvider().requestImplementation(packet, noCancellation)
    const io: CopilotIo = {
      async writePacketFiles() {},
      async readResponse() {
        return JSON.stringify(deterministicDelta.value)
      },
    }
    const result = await copilotHandoffProvider(io).requestImplementation(packet, noCancellation)
    expect(result.ok).toBe(true)
    expect(result.partial).toBeFalsy()
    const inspection = validateReturnedDelta(result.value!, packet, {})
    expect(inspection.accepted).toBe(true)
  })
})
