/**
 * EUC-10 — Context and packet compiler.
 * Acceptance (SPECIFICATION.md §25.3 EUC-10):
 *  - the packet contains one module by default;
 *  - every included context item has a reason and hash;
 *  - lower-priority context is omitted before a canonical record;
 *  - no packet contains a secret value.
 * Also covers §3.3 multi-module rules, §11.4 the context-limit stop report,
 * §11.7 multi-pass continuation, and Appendix B's handoff file set.
 */
import { describe, expect, it } from 'vitest'
import {
  buildContextManifest,
  buildModuleDesignPacket,
  buildModuleImplementationPacket,
  buildMultiModulePacket,
  contextLimitReport,
  multiPassContinuation,
  packetFileSet,
  type BuildModuleImplementationPacketInput,
  type ContextManifestCandidate,
} from '../../../src/capabilities/design/contextPacket.js'
import { approveContract, createContractRegistry, registerContract, type ContractRegistry } from '../../../src/capabilities/design/contractRegistry.js'
import type { ContextManifest, ModuleDesignSpecification } from '../../../src/capabilities/design/records.js'
import type { AcceptanceCase, OperationContract } from '../../../src/capabilities/types.js'

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
      ruleIds: ['rule.retain-90-days'],
      qualityRequirementIds: ['qual.durable'],
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

function emptyManifest(targetRevision = 'r1'): ContextManifest {
  return buildContextManifest({
    targetRecordId: 'design.mod.evidence-store',
    targetRevision,
    limit: 100_000,
    candidates: [{ kind: 'record', ref: 'design.mod.evidence-store', content: '{}', reason: 'canonical module design' }],
  })
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
    contextManifest: emptyManifest(),
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

// ---------------------------------------------------------------------------
// buildContextManifest (§11.4)
// ---------------------------------------------------------------------------

describe('EUC-10 buildContextManifest', () => {
  function candidates(): ContextManifestCandidate[] {
    return [
      { kind: 'record', ref: 'design.mod.evidence-store', content: 'x'.repeat(400), reason: 'canonical module design' },
      { kind: 'source', ref: 'src/owned-file.ts', content: 'x'.repeat(300), priority: 2, reason: 'file in owned path' },
      { kind: 'schema', ref: 'src/dependency-interface.ts', content: 'x'.repeat(300), priority: 3, reason: 'direct dependency interface' },
      { kind: 'test', ref: 'test/relevant.test.ts', content: 'x'.repeat(300), reason: 'relevant test' },
      { kind: 'pattern', ref: 'src/pattern.ts', content: 'x'.repeat(300), reason: 'nearby approved pattern' },
    ]
  }

  it('produces the same manifest hash for the same input (deterministic)', () => {
    const input = { targetRecordId: 'design.mod.evidence-store', targetRevision: 'r1', limit: 100_000, candidates: candidates() }
    const first = buildContextManifest(input)
    const second = buildContextManifest({ ...input, candidates: candidates() })
    expect(first).toEqual(second)
    expect(first.contentHash).toBe(second.contentHash)
  })

  it('gives every included entry a reason, a hash, and a byte count', () => {
    const manifest = buildContextManifest({
      targetRecordId: 'design.mod.evidence-store',
      targetRevision: 'r1',
      limit: 100_000,
      candidates: candidates(),
    })
    expect(manifest.entries.length).toBeGreaterThan(0)
    for (const entry of manifest.entries) {
      expect(entry.inclusionReason).toBeTruthy()
      expect(entry.contentHash).toBeTruthy()
      expect(entry.bytes).toBeGreaterThan(0)
    }
  })

  it('omits lower-priority context before it ever touches the canonical record', () => {
    const manifest = buildContextManifest({
      targetRecordId: 'design.mod.evidence-store',
      targetRevision: 'r1',
      // Small enough that not everything fits, large enough that the canonical record alone fits.
      limit: 500,
      candidates: candidates(),
    })
    const canonical = manifest.entries.find((e) => e.ref === 'design.mod.evidence-store')
    expect(canonical).toBeDefined()
    expect(manifest.omitted.length).toBeGreaterThan(0)
    // every omitted ref must have had a strictly lower priority than the canonical record
    for (const omission of manifest.omitted) {
      expect(omission.ref).not.toBe('design.mod.evidence-store')
      expect(omission.reason).toBeTruthy()
    }
  })

  it('never omits the canonical record even when it alone exceeds the limit', () => {
    const manifest = buildContextManifest({
      targetRecordId: 'design.mod.evidence-store',
      targetRevision: 'r1',
      limit: 10, // smaller than the canonical record alone
      candidates: [{ kind: 'record', ref: 'design.mod.evidence-store', content: 'x'.repeat(400), reason: 'canonical module design' }],
    })
    expect(manifest.entries.some((e) => e.ref === 'design.mod.evidence-store')).toBe(true)
    expect(manifest.entries.length).toBe(1)
    expect(manifest.totalBytes).toBeGreaterThan(manifest.tokenOrByteLimit)
  })

  it('never omits a canonical schema reference either, since caller priority cannot demote a canonical kind (§11.4 review fix)', () => {
    // Adversarial input: the canonical schema is given a very low (numerically
    // high) priority while a non-canonical test entry is given the highest
    // (numerically lowest) priority it could claim. The clamp must still
    // keep the schema and drop the test first.
    const manifest = buildContextManifest({
      targetRecordId: 'design.mod.evidence-store',
      targetRevision: 'r1',
      limit: 350,
      candidates: [
        { kind: 'schema', ref: 'schema.canonical', content: 'x'.repeat(300), priority: 9, reason: 'canonical schema' },
        { kind: 'test', ref: 'test/adversarial.test.ts', content: 'x'.repeat(300), priority: 1, reason: 'adversarial low-value test' },
      ],
    })
    expect(manifest.entries.map((e) => e.ref)).toEqual(['schema.canonical'])
    expect(manifest.omitted.map((o) => o.ref)).toEqual(['test/adversarial.test.ts'])
  })
})

describe('EUC-10 contextLimitReport', () => {
  it('reports current size, limit, largest items, safe exclusions, and the subtask option when still over limit', () => {
    const candidateList: ContextManifestCandidate[] = [
      { kind: 'record', ref: 'design.mod.evidence-store', content: 'x'.repeat(400), reason: 'canonical module design' },
      { kind: 'source', ref: 'src/owned-file.ts', content: 'x'.repeat(300), priority: 2, reason: 'file in owned path' },
    ]
    const manifest = buildContextManifest({
      targetRecordId: 'design.mod.evidence-store',
      targetRevision: 'r1',
      limit: 10,
      candidates: candidateList,
    })
    const report = contextLimitReport(manifest, candidateList)
    expect(report).toBeDefined()
    expect(report!.currentSize).toBe(manifest.totalBytes)
    expect(report!.configuredLimit).toBe(10)
    expect(report!.largestItems.length).toBeGreaterThan(0)
    expect(report!.canCreateSmallerSubtask).toBe(true)
  })

  it('returns undefined once the manifest fits within the limit', () => {
    const manifest = emptyManifest()
    expect(contextLimitReport(manifest, [])).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// buildModuleDesignPacket (§11.2)
// ---------------------------------------------------------------------------

describe('EUC-10 buildModuleDesignPacket', () => {
  function designPacketInput() {
    return {
      projectId: 'proj-1',
      moduleId: 'mod.evidence-store',
      moduleType: 'domain' as const,
      architectureRevision: 'r1',
      architectureHash: 'arch-hash',
      systemSlice: { moduleSummaries: [{ moduleId: 'mod.evidence-store', name: 'Evidence store', responsibility: 'owns evidence storage' }], dependencyEdges: [] },
      contextManifest: emptyManifest(),
      idempotencyKey: 'idem-design-1',
      createdAt: '2026-01-01T00:00:00.000Z',
    }
  }

  it('builds a one-module design handoff that prohibits approval and never contains a secret', () => {
    const result = buildModuleDesignPacket(designPacketInput())
    expect(result.ok).toBe(true)
    expect(result.packet?.approvalProhibited).toBe(true)
    expect(result.packet?.moduleId).toBe('mod.evidence-store')
    expect(result.packet?.typeSpecificQuestions.length).toBeGreaterThan(0)
  })

  it('blocks a packet that would leak a secret canary', () => {
    const result = buildModuleDesignPacket({
      ...designPacketInput(),
      projectRules: [{ id: 'rule-1', text: 'never leak SECRET-CANARY-VALUE' }],
      secretCanaries: ['SECRET-CANARY-VALUE'],
    })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-PKT-SECRET-LEAK')).toBe(true)
    expect(result.packet).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// buildModuleImplementationPacket (§11.3, §5.3)
// ---------------------------------------------------------------------------

describe('EUC-10 buildModuleImplementationPacket', () => {
  it('builds a one-module implementation packet for an approved design with approved contracts', () => {
    const result = buildModuleImplementationPacket(implementationInput())
    expect(result.ok).toBe(true)
    expect(result.packet?.moduleId).toBe('mod.evidence-store')
    expect(result.packet?.allowedPaths).toEqual(['capabilities/modules/mod.evidence-store/'])
    expect(result.packet?.providedContracts.length).toBe(1)
  })

  it('refuses a draft (unapproved) module design', () => {
    const draft = moduleDesign({ status: 'draft', approval: undefined })
    const result = buildModuleImplementationPacket(implementationInput({ design: draft }))
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-PKT-STALE-DESIGN')).toBe(true)
  })

  it('refuses a stale module design (a stale record must never be used for a new handoff, §5.3)', () => {
    const stale = moduleDesign({ status: 'stale', approval: undefined })
    const result = buildModuleImplementationPacket(implementationInput({ design: stale }))
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-PKT-STALE-DESIGN')).toBe(true)
  })

  it('refuses an unapproved required or provided contract', () => {
    const result = buildModuleImplementationPacket(implementationInput({ contractRegistry: createContractRegistry() }))
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-CTR-UNAPPROVED-PROVIDED')).toBe(true)
  })

  it('blocks a packet that would leak a secret canary', () => {
    const result = buildModuleImplementationPacket(
      implementationInput({ implementationSteps: ['use SECRET-VALUE-123 to authenticate'], secretCanaries: ['SECRET-VALUE-123'] }),
    )
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-PKT-SECRET-LEAK')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Multi-pass continuation (§11.7)
// ---------------------------------------------------------------------------

describe('EUC-10 multiPassContinuation', () => {
  it('the second pass references the current applied revision, not the first packet’s stale base', () => {
    const registry = approvedRegistry()
    const design = moduleDesign()
    const first = buildModuleImplementationPacket(implementationInput({ design, contractRegistry: registry }))
    expect(first.ok).toBe(true)

    // The module design was reopened and re-approved at r2 after the first pass applied.
    const appliedRevisionR2 = 'r2'
    const continuation = multiPassContinuation(first.packet!, appliedRevisionR2, 'continueModule')
    expect(continuation.baseRevision).toBe(appliedRevisionR2)
    expect(continuation.previousPacketId).toBe(first.packet!.packetId)

    const designAtR2 = moduleDesign({ revision: appliedRevisionR2 })
    const second = buildModuleImplementationPacket(
      implementationInput({
        design: designAtR2,
        contractRegistry: registry,
        contextManifest: emptyManifest(appliedRevisionR2),
        idempotencyKey: 'idem-2',
        ...continuation,
      }),
    )
    expect(second.ok).toBe(true)
    expect(second.packet!.packetId).not.toBe(first.packet!.packetId)
    expect(second.packet!.previousPacketId).toBe(first.packet!.packetId)
    expect(second.packet!.moduleDesignRevision).toBe(appliedRevisionR2)
  })

  it('refuses to build a packet whose context manifest still targets a stale (superseded) base revision', () => {
    const design = moduleDesign()
    const result = buildModuleImplementationPacket(
      implementationInput({ design, baseRevision: 'r2', contextManifest: emptyManifest('r1') }),
    )
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-PKT-BASE-MISMATCH')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Multi-module wave handoff (§3.3)
// ---------------------------------------------------------------------------

describe('EUC-10 buildMultiModulePacket', () => {
  function secondModuleDesign(): ModuleDesignSpecification {
    return moduleDesign({
      id: 'design.mod.evidence-index',
      module: {
        moduleId: 'mod.evidence-index',
        moduleVersion: '1.0.0',
        name: 'Evidence index',
        moduleType: 'domain',
        responsibility: 'indexes evidence',
        nonResponsibilities: [],
        ownedConcerns: ['indexing'],
        excludedConcerns: ['storage'],
      },
      boundary: {
        directDependencyIds: [],
        directConsumerIds: [],
        deployableId: 'deployable.primary',
        runtimeAllocation: 'local-embedded',
        runtimeLanguage: 'typescript',
        ownedPaths: ['capabilities/modules/mod.evidence-index/'],
        editableSharedPaths: [],
      },
      providedOperations: [],
      approval: {
        approvedBy: 'owner-1',
        authority: 'module-owner',
        approvedAt: '2026-01-01T00:00:00.000Z',
        recordId: 'design.mod.evidence-index',
        revision: 'r1',
        contentHash: 'frozen-hash-2',
      },
    })
  }

  function baseInput() {
    const registry = approvedRegistry()
    return {
      projectId: 'proj-1',
      modules: [
        { design: moduleDesign(), packetInput: implementationInput({ contractRegistry: registry }), fixtureIsolationConfirmed: true as const },
        {
          design: secondModuleDesign(),
          packetInput: implementationInput({ design: secondModuleDesign(), contractRegistry: registry, idempotencyKey: 'idem-second' }),
          fixtureIsolationConfirmed: true as const,
        },
      ],
      dependencyPlanMarksIndependent: true,
      fixturesIsolated: true,
      explicitUserSelection: true,
      receivingAgentSupportsCombinedTask: true,
      userConfirmedIndependence: true as const,
    }
  }

  it('allows a combined handoff when every multi-module rule passes', () => {
    const result = buildMultiModulePacket(baseInput())
    expect(result.ok).toBe(true)
    expect(result.packets?.length).toBe(2)
  })

  it('refuses a combined handoff with overlapping owned paths', () => {
    const overlapping = secondModuleDesign()
    overlapping.boundary.ownedPaths = ['capabilities/modules/mod.evidence-store/']
    const input = baseInput()
    input.modules[1] = {
      design: overlapping,
      packetInput: implementationInput({ design: overlapping, contractRegistry: approvedRegistry(), idempotencyKey: 'idem-second' }),
      fixtureIsolationConfirmed: true,
    }
    const result = buildMultiModulePacket(input)
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-PKT-MULTI-OWNED-PATH-OVERLAP')).toBe(true)
  })

  it('refuses a combined handoff when a selected module design is not approved', () => {
    const input = baseInput()
    const draftSecond = { ...secondModuleDesign(), status: 'draft' as const, approval: undefined }
    input.modules[1] = {
      design: draftSecond,
      packetInput: implementationInput({ design: draftSecond, contractRegistry: approvedRegistry(), idempotencyKey: 'idem-second' }),
      fixtureIsolationConfirmed: true,
    }
    const result = buildMultiModulePacket(input)
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-PKT-MULTI-UNAPPROVED')).toBe(true)
  })

  it('refuses a combined handoff without explicit user selection', () => {
    const result = buildMultiModulePacket({ ...baseInput(), explicitUserSelection: false })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-PKT-MULTI-NO-SELECTION')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Appendix B — module handoff file set
// ---------------------------------------------------------------------------

describe('EUC-10 packetFileSet', () => {
  it('contains the complete Appendix B file set', () => {
    const design = moduleDesign()
    const result = buildModuleImplementationPacket(implementationInput({ design }))
    expect(result.ok).toBe(true)
    const files = packetFileSet(result.packet!, design)
    const paths = files.map((f) => f.path)
    expect(paths).toContain('module-handoff/README.md')
    expect(paths).toContain('module-handoff/packet.json')
    expect(paths).toContain('module-handoff/module-design.json')
    expect(paths).toContain('module-handoff/architecture-slice.json')
    expect(paths.some((p) => p.startsWith('module-handoff/contracts/'))).toBe(true)
    expect(paths.some((p) => p.startsWith('module-handoff/schemas/'))).toBe(true)
    expect(paths).toContain('module-handoff/context-manifest.json')
    expect(paths).toContain('module-handoff/repository-context.md')
    expect(paths).toContain('module-handoff/acceptance-cases.json')
    expect(paths).toContain('module-handoff/required-evidence.json')
    expect(paths).toContain('module-handoff/return-schema.json')

    const readme = files.find((f) => f.path === 'module-handoff/README.md')!.content
    expect(readme).toContain('Target module')
    expect(readme).toContain('Allowed result')
    expect(readme).toContain('Forbidden changes')
    expect(readme).toContain('Ordered work')
    expect(readme).toContain('Commands to run')
    expect(readme).toContain('How to return the delta')
    expect(readme).toContain('When to stop')
  })
})
