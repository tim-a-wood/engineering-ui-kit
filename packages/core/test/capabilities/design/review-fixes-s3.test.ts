/**
 * Review-fixes S3 — second-review hierarchical-ownership finding (P1).
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §9.9 ("an
 * owned path overlaps another module"), §6.2 ("its owned paths do not
 * conflict with another active module").
 *
 * The finding: the single-module approval check (moduleDesign.ts §9.9) and
 * the Build gate (designBaseline.ts §6.2) compared owned paths with exact
 * string equality only, so a module owning `src/adapters` and another
 * owning `src/adapters/git` passed both checks even though the second is
 * nested inside the first. The multi-module packet check
 * (contextPacket.ts §3.3) already compared paths in a containment-aware
 * way; this fix moves that comparison into a shared helper
 * (`identity.ts` `ownedPathsOverlap`) and reuses it in both checks.
 */
import { describe, expect, it } from 'vitest'
import { ownedPathsOverlap } from '../../../src/capabilities/design/identity.js'
import {
  applyModuleDesignChecks,
  createModuleDesignDraft,
  evaluateModuleDesignChecks,
  requiredTypeSpecificFields,
} from '../../../src/capabilities/design/moduleDesign.js'
import type { ModuleDesignSpecification, ModuleType } from '../../../src/capabilities/design/records.js'
import {
  changeGateMode,
  createDefaultPolicy,
  createDesignBaseline,
  evaluateBuildGate,
} from '../../../src/capabilities/design/designBaseline.js'
import type { ArchitectureSpecification } from '../../../src/capabilities/types.js'
import type { RegisteredContract } from '../../../src/capabilities/design/contractRegistry.js'

// ---------------------------------------------------------------------------
// ownedPathsOverlap unit tests (identity.ts)
// ---------------------------------------------------------------------------

describe('ownedPathsOverlap (identity.ts)', () => {
  it('treats equal paths as overlapping', () => {
    expect(ownedPathsOverlap('src/adapters', 'src/adapters')).toBe(true)
  })

  it('treats a nested path as overlapping its ancestor directory', () => {
    expect(ownedPathsOverlap('src/adapters', 'src/adapters/git')).toBe(true)
    expect(ownedPathsOverlap('src/adapters/git', 'src/adapters')).toBe(true)
  })

  it('does not treat a sibling with a shared prefix as overlapping', () => {
    expect(ownedPathsOverlap('src/adapters', 'src/adapters-extra')).toBe(false)
  })

  it('normalizes trailing slashes', () => {
    expect(ownedPathsOverlap('src/adapters/', 'src/adapters/git/')).toBe(true)
    expect(ownedPathsOverlap('src/adapters/', 'src/adapters/')).toBe(true)
  })

  it('normalizes a leading ./ prefix', () => {
    expect(ownedPathsOverlap('./src/adapters', 'src/adapters/git')).toBe(true)
  })

  it('normalizes backslashes', () => {
    expect(ownedPathsOverlap('src\\adapters', 'src/adapters/git')).toBe(true)
    expect(ownedPathsOverlap('src\\adapters', 'src/adapters-extra')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// moduleDesign.ts — §9.9 single-module approval check
// ---------------------------------------------------------------------------

function architectureFixture(overrides: Partial<ArchitectureSpecification> = {}): ArchitectureSpecification {
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
    moduleIds: ['mod.a', 'mod.b'],
    moduleDefinitions: [
      { moduleId: 'mod.a', name: 'Module A', moduleType: 'domain', responsibility: 'owns a' },
      { moduleId: 'mod.b', name: 'Module B', moduleType: 'workflow', responsibility: 'owns b' },
    ],
    dependencyEdges: [],
    operationAllocations: [],
    adapterAllocations: [],
    workflowTraces: [{ useCaseId: 'uc.main', moduleIds: ['mod.a', 'mod.b'] }],
    proposals: [],
    unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
    contentHash: 'arch-hash',
    ...overrides,
  }
}

function arrayFieldNames(moduleType: ModuleType): Set<string> {
  const arrayFieldsByType: Record<ModuleType, string[]> = {
    experience: [
      'userRolesAndTasks',
      'surfaces',
      'commandsAndNavigation',
      'viewStates',
      'approvedComponentSources',
      'inboundBindingIds',
      'scenarioScreenshotIds',
    ],
    workflow: ['orderedSteps', 'participants', 'decisionsAndGuards', 'cancellationPoints', 'resourceLocks', 'finalOutcomes'],
    domain: ['domainVocabulary', 'valueObjects', 'invariants', 'calculations', 'decisionTables', 'operationPurity'],
    connection: ['supportedFormats', 'representativeFixtures'],
    platform: [],
  }
  return new Set(arrayFieldsByType[moduleType])
}

function fillTypeSpecificDetail(moduleType: ModuleType): ModuleDesignSpecification['typeSpecific'] {
  const fields = requiredTypeSpecificFields(moduleType)
  const filled: Record<string, unknown> = {}
  for (const field of fields) {
    filled[field] = arrayFieldNames(moduleType).has(field) ? [`${field}-value`] : `${field} value`
  }
  return { moduleType, detail: filled } as ModuleDesignSpecification['typeSpecific']
}

/** A module design that passes every §9.9 check except (possibly) owned-path overlap. */
function makeCompletableDraft(architecture: ArchitectureSpecification, moduleId: string, ownedPaths: string[]): ModuleDesignSpecification {
  const draft = createModuleDesignDraft({ projectId: 'proj-1', architecture, moduleId })
  return {
    ...draft,
    module: { ...draft.module, responsibility: `${moduleId} responsibility`, ownedConcerns: ['owns-thing'] },
    boundary: { ...draft.boundary, ownedPaths, editableSharedPaths: [] },
    providedOperations: draft.providedOperations.map((operation) => ({ ...operation, contentHash: `${operation.operationId}-contract-hash` })),
    behavior: {
      ...draft.behavior,
      preconditions: ['input is valid'],
      postconditions: ['output is produced'],
      domainRejections: ['invalid input is rejected'],
      technicalFailures: ['downstream timeout is reported'],
      idempotency: 'idempotent',
      cancellation: 'not cancellable',
      timeouts: 'medium timeout',
    },
    verification: {
      ...draft.verification,
      examples: ['a worked example'],
      acceptanceCases: [{ id: `${moduleId}.ac1`, description: 'does the thing', expectedOutcome: 'the thing is done' }],
    },
    typeSpecific: fillTypeSpecificDetail(draft.module.moduleType),
    contentHash: 'ignored-recomputed-by-checks',
  }
}

describe('moduleDesign.ts evaluateModuleDesignChecks — §9.9 owned-path overlap is containment-aware', () => {
  it('reviewer scenario: nested owned paths (src/adapters vs src/adapters/git) both fail approval, naming both modules and both paths', () => {
    const architecture = architectureFixture()
    const a = makeCompletableDraft(architecture, 'mod.a', ['src/adapters'])
    const b = makeCompletableDraft(architecture, 'mod.b', ['src/adapters/git'])

    const evalA = evaluateModuleDesignChecks(a, { otherDesigns: [b] })
    const overlapA = evalA.diagnostics.find((d) => d.code === 'MODDESIGN-OWNED-PATH-OVERLAP')
    expect(overlapA).toBeDefined()
    expect(overlapA?.relatedIds).toContain('mod.a')
    expect(overlapA?.relatedIds).toContain('mod.b')
    expect(overlapA?.message).toContain('src/adapters')
    expect(overlapA?.message).toContain('src/adapters/git')
    expect(evalA.passed).toBe(false)

    const evalB = evaluateModuleDesignChecks(b, { otherDesigns: [a] })
    const overlapB = evalB.diagnostics.find((d) => d.code === 'MODDESIGN-OWNED-PATH-OVERLAP')
    expect(overlapB).toBeDefined()
    expect(overlapB?.relatedIds).toContain('mod.a')
    expect(overlapB?.relatedIds).toContain('mod.b')
    expect(evalB.passed).toBe(false)

    // applyModuleDesignChecks (the review-lifecycle entry point) also blocks.
    const applied = applyModuleDesignChecks(a, { otherDesigns: [b] })
    expect(applied.design.status).not.toBe('readyForReview')
  })

  it('sibling paths with a shared prefix do not overlap and do not block', () => {
    const architecture = architectureFixture()
    const a = makeCompletableDraft(architecture, 'mod.a', ['src/adapters-fs/'])
    const b = makeCompletableDraft(architecture, 'mod.b', ['src/adapters-git/'])

    const evalA = evaluateModuleDesignChecks(a, { otherDesigns: [b] })
    expect(evalA.diagnostics.some((d) => d.code === 'MODDESIGN-OWNED-PATH-OVERLAP')).toBe(false)
    expect(evalA.passed).toBe(true)
  })

  it('equal owned paths still block (regression: exact-match case keeps working)', () => {
    const architecture = architectureFixture()
    const a = makeCompletableDraft(architecture, 'mod.a', ['src/shared/'])
    const b = makeCompletableDraft(architecture, 'mod.b', ['src/shared/'])

    const evalA = evaluateModuleDesignChecks(a, { otherDesigns: [b] })
    expect(evalA.diagnostics.some((d) => d.code === 'MODDESIGN-OWNED-PATH-OVERLAP')).toBe(true)
  })

  it('an owned path nested inside another module editable shared path also blocks', () => {
    const architecture = architectureFixture()
    const a = makeCompletableDraft(architecture, 'mod.a', ['src/shared-area/config.json'])
    const b = { ...makeCompletableDraft(architecture, 'mod.b', ['src/mod-b-only/']), boundary: { ...makeCompletableDraft(architecture, 'mod.b', ['src/mod-b-only/']).boundary, editableSharedPaths: ['src/shared-area'] } }

    const evalA = evaluateModuleDesignChecks(a, { otherDesigns: [b] })
    const overlap = evalA.diagnostics.find((d) => d.code === 'MODDESIGN-OWNED-PATH-OVERLAP')
    expect(overlap).toBeDefined()
    expect(overlap?.relatedIds).toContain('mod.a')
    expect(overlap?.relatedIds).toContain('mod.b')
  })
})

// ---------------------------------------------------------------------------
// designBaseline.ts — §6.2 Build gate owned-path conflict check
// ---------------------------------------------------------------------------

function buildArchitecture(): ArchitectureSpecification {
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
  }
}

function moduleDesignFixture(overrides: {
  id: string
  moduleId: string
  ownedPaths?: string[]
  providedOperations?: ModuleDesignSpecification['providedOperations']
  requiredOperations?: ModuleDesignSpecification['requiredOperations']
}): ModuleDesignSpecification {
  return {
    schemaVersion: '1.0',
    projectId: 'proj-1',
    id: overrides.id,
    revision: 'r1',
    status: 'approved',
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
    contentHash: `hash-${overrides.moduleId}`,
  }
}

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

describe('designBaseline.ts evaluateBuildGate — §6.2 owned-path conflict is containment-aware', () => {
  const policy = changeGateMode(createDefaultPolicy('proj-1'), 'incrementalModules', 'decision-1', 'architect-1').policy!
  const architecture = buildArchitecture()
  const approvedContracts: RegisteredContract[] = [
    { operationId: 'op.adapter-call', version: '1.0.0', providerModuleId: 'mod.adapter', status: 'approved', contract: contractStub('op.adapter-call'), contentHash: 'ctr-adapter' },
  ]

  it('reviewer scenario: a module owning src/adapters/git fails the Build gate against an active module owning src/adapters, naming both modules and both paths', () => {
    const readyModule = moduleDesignFixture({
      id: 'design.mod.adapter',
      moduleId: 'mod.adapter',
      providedOperations: [{ operationId: 'op.adapter-call', version: '1.0.0' }],
      ownedPaths: ['src/adapters/git'],
    })
    const result = evaluateBuildGate({
      policy,
      baseline: createDesignBaseline(architecture, [readyModule], approvedContracts, { baselineId: 'baseline-1' }),
      moduleDesign: readyModule,
      moduleProgress: { useCaseAnalysisApproved: true, systemStructureApproved: true },
      contracts: approvedContracts,
      otherActiveModules: [{ moduleId: 'mod.other', ownedPaths: ['src/adapters'] }],
    })
    expect(result.ok).toBe(false)
    const conflict = result.diagnostics.find((d) => d.code === 'CAP-DES-BUILD-PATH-CONFLICT')
    expect(conflict).toBeDefined()
    expect(conflict?.relatedIds).toContain('mod.adapter')
    expect(conflict?.relatedIds).toContain('mod.other')
    expect(conflict?.message).toContain('src/adapters/git')
    expect(conflict?.message).toContain('src/adapters')
  })

  it('sibling non-overlapping owned paths still pass the Build gate', () => {
    const readyModule = moduleDesignFixture({
      id: 'design.mod.adapter',
      moduleId: 'mod.adapter',
      providedOperations: [{ operationId: 'op.adapter-call', version: '1.0.0' }],
      ownedPaths: ['src/adapters-fs/'],
    })
    const result = evaluateBuildGate({
      policy,
      baseline: createDesignBaseline(architecture, [readyModule], approvedContracts, { baselineId: 'baseline-1' }),
      moduleDesign: readyModule,
      moduleProgress: { useCaseAnalysisApproved: true, systemStructureApproved: true },
      contracts: approvedContracts,
      otherActiveModules: [{ moduleId: 'mod.other', ownedPaths: ['src/adapters-git/'] }],
    })
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-BUILD-PATH-CONFLICT')).toBe(false)
  })

  it('equal owned paths still block (regression: exact-match case keeps working)', () => {
    const readyModule = moduleDesignFixture({
      id: 'design.mod.adapter',
      moduleId: 'mod.adapter',
      providedOperations: [{ operationId: 'op.adapter-call', version: '1.0.0' }],
      ownedPaths: ['src/shared/'],
    })
    const result = evaluateBuildGate({
      policy,
      baseline: createDesignBaseline(architecture, [readyModule], approvedContracts, { baselineId: 'baseline-1' }),
      moduleDesign: readyModule,
      moduleProgress: { useCaseAnalysisApproved: true, systemStructureApproved: true },
      contracts: approvedContracts,
      otherActiveModules: [{ moduleId: 'mod.other', ownedPaths: ['src/shared/'] }],
    })
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-BUILD-PATH-CONFLICT')).toBe(true)
  })
})
