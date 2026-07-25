/**
 * Review fixes (round 2) — delta inspector and context/packet compiler.
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §3.3,
 * §11.4, §11.5, §11.6, §19, §20.2.
 *
 * Covers four review findings:
 *  1. forbidden/protected paths take precedence over allowed paths in the
 *     delta inspector, even for a file inside an allowed directory (exact
 *     and directory-prefix forbidden matches);
 *  2. incomplete or out-of-scope record deltas are blocking rejections (not
 *     mere warnings), the response is still preserved as evidence, and
 *     approval independently re-verifies completeness rather than trusting
 *     `accepted` alone;
 *  3. hierarchical (directory-prefix) owned/editable-shared-path overlap is
 *     detected across a multi-module handoff, and a combined handoff
 *     requires explicit user confirmations rather than silent defaults;
 *  4. context-manifest priority is derived from entry kind and clamped so a
 *     caller-supplied priority can never demote a canonical record,
 *     contract, or schema below top priority — and the §11.4 stop report is
 *     produced when canonical records alone still exceed the limit.
 */
import { describe, expect, it } from 'vitest'
import {
  approveDeltaToApply,
  inspectDelta,
  validateReturnedDelta,
  type DeltaWorkspaceContext,
} from '../../../src/capabilities/design/deltaInspector.js'
import {
  buildContextManifest,
  buildModuleImplementationPacket,
  buildMultiModulePacket,
  contextLimitReport,
  type BuildModuleImplementationPacketInput,
  type ContextManifestCandidate,
} from '../../../src/capabilities/design/contextPacket.js'
import { createContractRegistry, type ContractRegistry } from '../../../src/capabilities/design/contractRegistry.js'
import type { ModuleDesignSpecification, ModuleImplementationPacket, ReturnedDelta } from '../../../src/capabilities/design/records.js'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

function packet(overrides: Partial<ModuleImplementationPacket> = {}): ModuleImplementationPacket {
  return {
    schemaVersion: '1.0',
    packetId: 'packet-1',
    projectId: 'proj-1',
    moduleId: 'mod.evidence-store',
    moduleVersion: '1.0.0',
    moduleDesignRevision: 'r1',
    moduleDesignHash: 'design-hash-r1',
    architectureRevision: 'r1',
    architectureHash: 'arch-hash',
    allowedPaths: ['src/'],
    forbiddenPaths: ['**'],
    editableSharedPaths: ['capabilities/shared/types.ts'],
    providedContracts: [],
    requiredContracts: [],
    canonicalSchemaRefs: [],
    contextManifest: {
      id: 'ctx-1',
      targetRecordId: 'design.mod.evidence-store',
      targetRevision: 'r1',
      tokenOrByteLimit: 100_000,
      totalBytes: 0,
      entries: [],
      omitted: [],
      contentHash: 'ctx-hash',
    },
    targetDeployableId: 'deployable.primary',
    implementationSteps: ['create the module'],
    acceptanceCases: [],
    testCommands: ['npm test'],
    requiredEvidence: [],
    returnManifestSchemaRef: 'ReturnedDelta@1.0',
    idempotencyKey: 'idem-1',
    cancellationInstructions: 'stop and return partial progress',
    passKind: 'initial',
    createdAt: '2026-01-01T00:00:00.000Z',
    contentHash: 'packet-hash',
    ...overrides,
  }
}

function delta(overrides: Partial<ReturnedDelta> = {}): ReturnedDelta {
  return {
    schemaVersion: '1.0',
    deltaId: 'delta-1',
    packetId: 'packet-1',
    baseRevision: 'r1',
    baseHash: 'design-hash-r1',
    fileChanges: [{ path: 'src/index.ts', action: 'create', content: 'export {}', contentHash: 'hash-1' }],
    recordChanges: [],
    testResults: [{ command: 'npm test', passed: true, summary: 'all green' }],
    assumptions: [],
    unresolvedIssues: [],
    requestedScopeChanges: [],
    evidenceFiles: [],
    returnedAt: '2026-01-02T00:00:00.000Z',
    contentHash: 'delta-hash',
    ...overrides,
  }
}

const workspace: DeltaWorkspaceContext = { workspaceRevision: 'r1', workspaceHash: 'design-hash-r1' }

function moduleDesign(overrides: Partial<ModuleDesignSpecification> = {}): ModuleDesignSpecification {
  const base: ModuleDesignSpecification = {
    schemaVersion: '1.0',
    projectId: 'proj-1',
    id: 'design.mod.a',
    revision: 'r1',
    status: 'approved',
    architecture: { id: 'arch-1', revision: 'r1', contentHash: 'arch-hash' },
    module: {
      moduleId: 'mod.a',
      moduleVersion: '1.0.0',
      name: 'Module A',
      moduleType: 'domain',
      responsibility: 'does a',
      nonResponsibilities: [],
      ownedConcerns: [],
      excludedConcerns: [],
    },
    trace: {
      useCaseIds: [],
      scenarioStepIds: [],
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
      ownedPaths: ['src/adapters/'],
      editableSharedPaths: [],
    },
    providedOperations: [],
    requiredOperations: [],
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
      recordId: 'design.mod.a',
      revision: 'r1',
      contentHash: 'frozen-hash',
    },
    contentHash: 'design-hash',
  }
  return { ...base, ...overrides }
}

function emptyManifest(targetRecordId: string, targetRevision = 'r1') {
  return buildContextManifest({
    targetRecordId,
    targetRevision,
    limit: 100_000,
    candidates: [{ kind: 'record', ref: targetRecordId, content: '{}', reason: 'canonical module design' }],
  })
}

function emptyRegistry(): ContractRegistry {
  return createContractRegistry()
}

function implementationInput(design: ModuleDesignSpecification, overrides: Partial<BuildModuleImplementationPacketInput> = {}): BuildModuleImplementationPacketInput {
  return {
    projectId: 'proj-1',
    design,
    contractRegistry: emptyRegistry(),
    architectureRevision: 'r1',
    architectureHash: 'arch-hash',
    contextManifest: emptyManifest(design.id),
    implementationSteps: ['implement the module'],
    acceptanceCases: [],
    testCommands: ['npm test'],
    requiredEvidence: [],
    idempotencyKey: `idem-${design.module.moduleId}`,
    passKind: 'initial',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// FINDING 1 — forbidden paths take precedence over allowed paths
// ---------------------------------------------------------------------------

describe('review fix 1 — forbidden paths take precedence over allowed paths (§11.5, §20.2)', () => {
  it('rejects a forbidden file inside an allowed directory (exact reviewer scenario)', () => {
    const p = packet({ allowedPaths: ['src/'], forbiddenPaths: ['src/access-policy.json', '**'] })
    const result = validateReturnedDelta(
      delta({ fileChanges: [{ path: 'src/access-policy.json', action: 'change', content: 'x', contentHash: 'h' }] }),
      p,
      workspace,
    )
    expect(result.accepted).toBe(false)
    expect(result.rejectionReasons).toContain('path-outside-allowed')
    expect(result.outOfScopeAttempts).toContain('src/access-policy.json')
    // an ordinary file in the same allowed directory is unaffected
    const ok = validateReturnedDelta(
      delta({ fileChanges: [{ path: 'src/index.ts', action: 'create', content: 'x', contentHash: 'h2' }] }),
      p,
      workspace,
    )
    expect(ok.accepted).toBe(true)
  })

  it('rejects a forbidden directory-prefix match, not just an exact file', () => {
    const p = packet({ allowedPaths: ['src/'], forbiddenPaths: ['src/secrets/', '**'] })
    const result = validateReturnedDelta(
      delta({ fileChanges: [{ path: 'src/secrets/api-key.txt', action: 'create', content: 'x', contentHash: 'h' }] }),
      p,
      workspace,
    )
    expect(result.accepted).toBe(false)
    expect(result.rejectionReasons).toContain('path-outside-allowed')
    expect(result.outOfScopeAttempts).toContain('src/secrets/api-key.txt')
  })

  it('applies forbidden-path precedence to a delete as well as a create/change', () => {
    const p = packet({ allowedPaths: ['src/'], forbiddenPaths: ['src/access-policy.json', '**'] })
    const result = validateReturnedDelta(
      delta({ fileChanges: [{ path: 'src/access-policy.json', action: 'delete' }] }),
      p,
      { ...workspace, approvedDeletes: ['src/access-policy.json'] },
    )
    expect(result.accepted).toBe(false)
    expect(result.rejectionReasons).toContain('path-outside-allowed')
  })

  it('buildModuleImplementationPacket emits concrete forbidden entries (other modules owned paths, protected paths) in addition to the ** marker', () => {
    const design = moduleDesign({ boundary: { ...moduleDesign().boundary, ownedPaths: ['src/mod-a/'] } })
    const result = buildModuleImplementationPacket(
      implementationInput(design, { protectedPaths: ['config/secrets.json'], otherModuleOwnedPaths: ['src/mod-b/'] }),
    )
    expect(result.ok).toBe(true)
    expect(result.packet!.forbiddenPaths).toContain('config/secrets.json')
    expect(result.packet!.forbiddenPaths).toContain('src/mod-b/')
    expect(result.packet!.forbiddenPaths).toContain('**')

    // this real packet now has data the delta inspector can enforce
    const d = delta({
      packetId: result.packet!.packetId,
      baseRevision: result.packet!.moduleDesignRevision,
      baseHash: result.packet!.moduleDesignHash,
      fileChanges: [{ path: 'src/mod-b/hack.ts', action: 'create', content: 'x', contentHash: 'h' }],
    })
    const inspection = validateReturnedDelta(d, result.packet!, { workspaceRevision: 'r1', workspaceHash: 'design-hash' })
    expect(inspection.accepted).toBe(false)
    expect(inspection.rejectionReasons).toContain('path-outside-allowed')
  })
})

// ---------------------------------------------------------------------------
// FINDING 2 — incomplete and unrestricted record deltas
// ---------------------------------------------------------------------------

describe('review fix 2 — incomplete and unrestricted record deltas are blocking rejections (§11.5, §11.6, §19)', () => {
  it('rejects a delta missing contentHash/returnedAt/manifest as a blocking rejection, while still preserving it in the inspection (§19)', () => {
    const incomplete = delta({ fileChanges: [], recordChanges: [], returnedAt: '', contentHash: '' })
    const result = validateReturnedDelta(incomplete, packet(), workspace)
    expect(result.accepted).toBe(false)
    expect(result.rejectionReasons).toContain('missing-change-manifest')
    // the response is preserved as evidence, not discarded
    expect(result.deltaId).toBe(incomplete.deltaId)
    expect(result.testResults).toEqual(incomplete.testResults)

    // even through the full inspection surface
    const inspection = inspectDelta(incomplete, packet(), workspace, { rollbackPointRef: 'backup-1' })
    expect(inspection.accepted).toBe(false)
    expect(inspection.rejectionReasons).toContain('missing-change-manifest')
    expect(inspection.deltaId).toBe(incomplete.deltaId)
  })

  it('rejects a delta missing only returnedAt (fileChanges present)', () => {
    const result = validateReturnedDelta(delta({ returnedAt: '' }), packet(), workspace)
    expect(result.accepted).toBe(false)
    expect(result.rejectionReasons).toContain('missing-change-manifest')
  })

  it('rejects a delta missing only contentHash (fileChanges present)', () => {
    const result = validateReturnedDelta(delta({ contentHash: '' }), packet(), workspace)
    expect(result.accepted).toBe(false)
    expect(result.rejectionReasons).toContain('missing-change-manifest')
  })

  it('rejects an out-of-scope record change with record-change-not-allowed', () => {
    const result = validateReturnedDelta(
      delta({ recordChanges: [{ recordId: 'mod.some-other-module', kind: 'note', summary: 'unrelated module note' }] }),
      packet(),
      workspace,
    )
    expect(result.accepted).toBe(false)
    expect(result.rejectionReasons).toContain('record-change-not-allowed')
  })

  it('allows a module-design record change scoped to the packet own module', () => {
    const result = validateReturnedDelta(
      delta({ recordChanges: [{ recordId: 'mod.evidence-store', kind: 'note', summary: 'implementation notes' }] }),
      packet(),
      workspace,
    )
    expect(result.accepted).toBe(true)
    expect(result.rejectionReasons).not.toContain('record-change-not-allowed')
  })

  it('rejects a contract record change without an approved impact record distinctly from the scope rule', () => {
    const result = validateReturnedDelta(
      delta({ recordChanges: [{ recordId: 'op.import-evidence', kind: 'contract', summary: 'widened input' }] }),
      packet(),
      workspace,
    )
    expect(result.accepted).toBe(false)
    expect(result.rejectionReasons).toContain('contract-change-without-impact')
    expect(result.rejectionReasons).not.toContain('record-change-not-allowed')
  })

  it('approveDeltaToApply refuses an inspection carrying a blocking rejection even when accepted is tampered to true', () => {
    const inspection = inspectDelta(
      delta({ recordChanges: [{ recordId: 'mod.some-other-module', kind: 'note', summary: 'unrelated' }] }),
      packet(),
      workspace,
      { rollbackPointRef: 'backup-1' },
    )
    expect(inspection.accepted).toBe(false)
    expect(inspection.rejectionReasons.length).toBeGreaterThan(0)

    const tampered = { ...inspection, accepted: true }
    const result = approveDeltaToApply(tampered, { approvedBy: 'user-1', currentWorkspaceRevision: tampered.workspaceRevisionAtInspection })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-DELTA-NOT-ACCEPTED')).toBe(true)
  })

  it('approveDeltaToApply refuses an inspection missing required fields even when accepted is tampered to true', () => {
    const incomplete = delta({ returnedAt: '' })
    const inspection = inspectDelta(incomplete, packet(), workspace, { rollbackPointRef: 'backup-1' })
    expect(inspection.accepted).toBe(false)

    const tampered = { ...inspection, accepted: true, rejectionReasons: [] as never[] }
    const result = approveDeltaToApply(tampered, { approvedBy: 'user-1', currentWorkspaceRevision: tampered.workspaceRevisionAtInspection })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-DELTA-NOT-ACCEPTED')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// FINDING 3 — hierarchical path overlap and required explicit confirmations
// ---------------------------------------------------------------------------

describe('review fix 3 — hierarchical path overlap and required explicit confirmations (§3.3)', () => {
  function moduleA() {
    return moduleDesign({
      id: 'design.mod.a',
      module: { ...moduleDesign().module, moduleId: 'mod.a', name: 'Module A' },
      boundary: { ...moduleDesign().boundary, ownedPaths: ['src/adapters'] },
      approval: { ...moduleDesign().approval!, recordId: 'design.mod.a' },
    })
  }
  function moduleB() {
    return moduleDesign({
      id: 'design.mod.b',
      module: { ...moduleDesign().module, moduleId: 'mod.b', name: 'Module B' },
      boundary: { ...moduleDesign().boundary, ownedPaths: ['src/adapters/git'] },
      approval: { ...moduleDesign().approval!, recordId: 'design.mod.b' },
    })
  }

  function fullyConfirmedInput() {
    const a = moduleA()
    const b = moduleB()
    return {
      projectId: 'proj-1',
      modules: [
        { design: a, packetInput: implementationInput(a), fixtureIsolationConfirmed: true as const },
        { design: b, packetInput: implementationInput(b, { idempotencyKey: 'idem-b' }), fixtureIsolationConfirmed: true as const },
      ],
      dependencyPlanMarksIndependent: true,
      fixturesIsolated: true,
      explicitUserSelection: true,
      receivingAgentSupportsCombinedTask: true,
      userConfirmedIndependence: true as const,
    }
  }

  it("refuses a combined handoff when 'src/adapters' and 'src/adapters/git' are nested owned paths, not independent strings", () => {
    const result = buildMultiModulePacket(fullyConfirmedInput())
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-PKT-MULTI-OWNED-PATH-OVERLAP')).toBe(true)
  })

  it('refuses a combined handoff when one owned path contains another module editable shared path', () => {
    const a = moduleA()
    a.boundary.ownedPaths = ['src/shared-area']
    const b = moduleB()
    b.boundary.ownedPaths = ['src/mod-b-only/']
    b.boundary.editableSharedPaths = ['src/shared-area/config.json']
    const input = {
      projectId: 'proj-1',
      modules: [
        { design: a, packetInput: implementationInput(a), fixtureIsolationConfirmed: true as const },
        { design: b, packetInput: implementationInput(b, { idempotencyKey: 'idem-b' }), fixtureIsolationConfirmed: true as const },
      ],
      dependencyPlanMarksIndependent: true,
      fixturesIsolated: true,
      explicitUserSelection: true,
      receivingAgentSupportsCombinedTask: true,
      userConfirmedIndependence: true as const,
    }
    const result = buildMultiModulePacket(input)
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-PKT-MULTI-OWNED-PATH-OVERLAP')).toBe(true)
  })

  it('allows non-overlapping sibling-like owned paths (no false-positive prefix match)', () => {
    const a = moduleA()
    a.boundary.ownedPaths = ['src/adapters-fs/']
    const b = moduleB()
    b.boundary.ownedPaths = ['src/adapters-git/']
    const input = {
      projectId: 'proj-1',
      modules: [
        { design: a, packetInput: implementationInput(a), fixtureIsolationConfirmed: true as const },
        { design: b, packetInput: implementationInput(b, { idempotencyKey: 'idem-b' }), fixtureIsolationConfirmed: true as const },
      ],
      dependencyPlanMarksIndependent: true,
      fixturesIsolated: true,
      explicitUserSelection: true,
      receivingAgentSupportsCombinedTask: true,
      userConfirmedIndependence: true as const,
    }
    const result = buildMultiModulePacket(input)
    expect(result.ok).toBe(true)
  })

  it('refuses a combined handoff missing the explicit user-confirmed-independence input', () => {
    const input = { ...fullyConfirmedInput(), userConfirmedIndependence: false as unknown as true }
    const result = buildMultiModulePacket(input)
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-PKT-MULTI-NO-USER-CONFIRMATION')).toBe(true)
  })

  it('refuses a combined handoff missing a per-module fixture-isolation confirmation', () => {
    const input = fullyConfirmedInput()
    input.modules[1] = { ...input.modules[1]!, fixtureIsolationConfirmed: false as unknown as true }
    const result = buildMultiModulePacket(input)
    expect(result.ok).toBe(false)
    expect(
      result.diagnostics.some((d) => d.code === 'CAP-DES-PKT-MULTI-NO-FIXTURE-CONFIRMATION' && d.relatedIds?.includes('mod.b')),
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// FINDING 4 — context-manifest priority derived from kind, clamped
// ---------------------------------------------------------------------------

describe('review fix 4 — context-manifest priority is derived from kind and clamped (§11.4)', () => {
  it('a canonical record survives adversarial priorities: canonical priority 9, test priority 1 -> test omitted first', () => {
    const candidates: ContextManifestCandidate[] = [
      { kind: 'record', ref: 'design.mod.a', content: 'x'.repeat(300), priority: 9, reason: 'canonical module design' },
      { kind: 'test', ref: 'test/adversarial.test.ts', content: 'x'.repeat(300), priority: 1, reason: 'adversarial low-value test' },
    ]
    const manifest = buildContextManifest({ targetRecordId: 'design.mod.a', targetRevision: 'r1', limit: 350, candidates })
    expect(manifest.entries.map((e) => e.ref)).toEqual(['design.mod.a'])
    expect(manifest.omitted.map((o) => o.ref)).toEqual(['test/adversarial.test.ts'])
  })

  it('a canonical contract also survives an adversarial low priority against a canonical-looking but non-canonical pattern entry', () => {
    const candidates: ContextManifestCandidate[] = [
      { kind: 'contract', ref: 'op.import-evidence@1.0.0', content: 'x'.repeat(300), priority: 7, reason: 'canonical provided contract' },
      { kind: 'pattern', ref: 'src/nearby-pattern.ts', content: 'x'.repeat(300), priority: 1, reason: 'nearby pattern' },
    ]
    const manifest = buildContextManifest({ targetRecordId: 'design.mod.a', targetRevision: 'r1', limit: 350, candidates })
    expect(manifest.entries.map((e) => e.ref)).toEqual(['op.import-evidence@1.0.0'])
    expect(manifest.omitted.map((o) => o.ref)).toEqual(['src/nearby-pattern.ts'])
  })

  it('produces the §11.4 stop report instead of omitting canonical records when they alone exceed the limit', () => {
    const candidates: ContextManifestCandidate[] = [
      { kind: 'record', ref: 'design.mod.a', content: 'x'.repeat(400), reason: 'canonical module design' },
      { kind: 'contract', ref: 'op.import-evidence@1.0.0', content: 'x'.repeat(400), reason: 'canonical provided contract' },
    ]
    const manifest = buildContextManifest({ targetRecordId: 'design.mod.a', targetRevision: 'r1', limit: 500, candidates })
    // both canonical entries are retained even though together they exceed the limit
    expect(manifest.entries.map((e) => e.ref).sort()).toEqual(['design.mod.a', 'op.import-evidence@1.0.0'])
    expect(manifest.omitted).toEqual([])
    expect(manifest.totalBytes).toBeGreaterThan(manifest.tokenOrByteLimit)

    const report = contextLimitReport(manifest, candidates)
    expect(report).toBeDefined()
    expect(report!.currentSize).toBe(manifest.totalBytes)
    expect(report!.configuredLimit).toBe(500)
    expect(report!.canCreateSmallerSubtask).toBe(true)
    // no safe exclusion exists: both remaining entries are canonical (priority 1)
    expect(report!.safeExclusionChoices).toEqual([])
  })
})
