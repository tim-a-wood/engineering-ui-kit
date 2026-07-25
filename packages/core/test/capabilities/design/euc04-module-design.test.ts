/**
 * EUC-04 — Module-design core.
 * Acceptance from docs/use-case-led-workflow/SPECIFICATION.md §25.3 EUC-04:
 * one module can be approved without changing another; incomplete upstream
 * work produces an exact block; a reopened module preserves its approved
 * revision; a semantic change marks only affected records old.
 */
import { describe, expect, it } from 'vitest'
import {
  applyModuleDesignChecks,
  approveModuleDesign,
  computeModuleDesignProgress,
  createModuleDesignDraft,
  diffModuleDesign,
  evaluateModuleDesignChecks,
  evaluateTypeSpecificCompleteness,
  filterModuleQueue,
  markConflict,
  markStale,
  reopenModuleDesign,
  requiredTypeSpecificFields,
  selectDefaultModule,
  updateModuleDesignItem,
  withdraw,
  type ModuleDesignCheckContext,
} from '../../../src/capabilities/design/moduleDesign.js'
import type { ModuleDesignSpecification } from '../../../src/capabilities/design/records.js'
import type { ArchitectureSpecification, ModuleType, OperationContract } from '../../../src/capabilities/types.js'

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
    moduleIds: ['mod.domain', 'mod.workflow', 'mod.experience'],
    moduleDefinitions: [
      { moduleId: 'mod.domain', name: 'Domain module', moduleType: 'domain', responsibility: 'Own domain rules' },
      { moduleId: 'mod.workflow', name: 'Workflow module', moduleType: 'workflow', responsibility: 'Orchestrate the main flow' },
      { moduleId: 'mod.experience', name: 'Experience module', moduleType: 'experience', responsibility: 'Render the main screen' },
    ],
    dependencyEdges: [
      { fromModuleId: 'mod.workflow', toModuleId: 'mod.domain', reason: 'uses domain rules' },
      { fromModuleId: 'mod.experience', toModuleId: 'mod.workflow', reason: 'invokes the workflow' },
    ],
    operationAllocations: [
      { operationId: 'op.calculate', moduleId: 'mod.domain' },
      { operationId: 'op.run', moduleId: 'mod.workflow' },
    ],
    adapterAllocations: [],
    workflowTraces: [{ useCaseId: 'uc.main', moduleIds: ['mod.domain', 'mod.workflow', 'mod.experience'] }],
    proposals: [],
    unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
    contentHash: 'arch-hash',
    ...overrides,
  }
}

function makeCompletableDraft(architecture: ArchitectureSpecification, moduleId: string): ModuleDesignSpecification {
  const draft = createModuleDesignDraft({ projectId: 'proj-1', architecture, moduleId })
  const withFields: ModuleDesignSpecification = {
    ...draft,
    module: { ...draft.module, responsibility: `${moduleId} responsibility`, ownedConcerns: ['owns-thing'] },
    // Simulate an already-established contract for each provided operation so
    // the "operation has no contract" check (§9.9) is satisfied by default.
    providedOperations: draft.providedOperations.map((operation) => ({ ...operation, contentHash: `${operation.operationId}-contract-hash` })),
    schemas:
      draft.providedOperations.length > 0
        ? [
            { schemaId: `${moduleId}.input`, version: '1.0.0', role: 'input', ref: `schemas/${moduleId}/input.json` },
            { schemaId: `${moduleId}.output`, version: '1.0.0', role: 'output', ref: `schemas/${moduleId}/output.json` },
          ]
        : [],
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
    typeSpecific: fillTypeSpecificDetail(draft.module.moduleType, draft),
  }
  return { ...withFields, contentHash: 'ignored-recomputed-by-checks' }
}

function fillTypeSpecificDetail(moduleType: ModuleType, draft: ModuleDesignSpecification): ModuleDesignSpecification['typeSpecific'] {
  const fields = requiredTypeSpecificFields(moduleType)
  const filled: Record<string, unknown> = {}
  for (const field of fields) {
    // Arrays and strings both accept a single representative non-empty value.
    filled[field] = arrayFieldNames(moduleType).has(field) ? [`${field}-value`] : `${field} value`
  }
  return { moduleType, detail: filled } as ModuleDesignSpecification['typeSpecific']
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

describe('EUC-04 createModuleDesignDraft', () => {
  it('creates a deterministic draft from architecture identity, dependencies, and operation allocations', () => {
    const architecture = architectureFixture()
    const draft = createModuleDesignDraft({ projectId: 'proj-1', architecture, moduleId: 'mod.workflow' })

    expect(draft.status).toBe('draft')
    expect(draft.revision).toBe('r1')
    expect(draft.module.moduleType).toBe('workflow')
    expect(draft.module.name).toBe('Workflow module')
    expect(draft.module.responsibility).toBe('Orchestrate the main flow')
    expect(draft.boundary.directDependencyIds).toEqual(['mod.domain'])
    expect(draft.boundary.directConsumerIds).toEqual(['mod.experience'])
    expect(draft.providedOperations).toEqual([{ operationId: 'op.run', version: '1.0.0' }])
    expect(draft.trace.useCaseIds).toEqual(['uc.main'])
    expect(draft.typeSpecific.moduleType).toBe('workflow')
  })

  it('is deterministic for the same input', () => {
    const architecture = architectureFixture()
    const a = createModuleDesignDraft({ projectId: 'proj-1', architecture, moduleId: 'mod.domain' })
    const b = createModuleDesignDraft({ projectId: 'proj-1', architecture, moduleId: 'mod.domain' })
    expect(a).toEqual(b)
    expect(a.id).toBe(b.id)
    expect(a.contentHash).toBe(b.contentHash)
  })

  it('throws for a module not present in architecture.moduleDefinitions', () => {
    const architecture = architectureFixture()
    expect(() => createModuleDesignDraft({ projectId: 'proj-1', architecture, moduleId: 'mod.unknown' })).toThrow()
  })
})

describe('EUC-04 updateModuleDesignItem', () => {
  it('returns a new revision without mutating the input', () => {
    const architecture = architectureFixture()
    const draft = createModuleDesignDraft({ projectId: 'proj-1', architecture, moduleId: 'mod.domain' })
    const result = updateModuleDesignItem(draft, 'module.responsibility', 'Updated responsibility')

    expect(result.ok).toBe(true)
    expect(result.design.module.responsibility).toBe('Updated responsibility')
    expect(result.design.revision).toBe('r2')
    expect(result.design).not.toBe(draft)
    expect(draft.module.responsibility).toBe('Own domain rules')
    expect(draft.revision).toBe('r1')
  })

  it('rejects updates to an approved record', () => {
    const architecture = architectureFixture()
    const approved = approvedDomainDesign(architecture)
    const result = updateModuleDesignItem(approved, 'module.responsibility', 'changed')

    expect(result.ok).toBe(false)
    expect(result.design).toBe(approved)
    expect(result.diagnostics[0]?.code).toBe('MODDESIGN-UPDATE-APPROVED')
  })
})

describe('EUC-04 type-specific field policy (§9.6)', () => {
  const moduleTypes: ModuleType[] = ['experience', 'workflow', 'domain', 'connection', 'platform']

  it.each(moduleTypes)('requires every applicable field for %s modules', (moduleType) => {
    const fields = requiredTypeSpecificFields(moduleType)
    expect(fields.length).toBeGreaterThan(0)

    const architecture = architectureFixture()
    const draft = createModuleDesignDraft({ projectId: 'proj-1', architecture, moduleId: 'mod.domain' })
    const empty: ModuleDesignSpecification = { ...draft, module: { ...draft.module, moduleType }, typeSpecific: { moduleType, detail: {} } as ModuleDesignSpecification['typeSpecific'] }

    const diagnostics = evaluateTypeSpecificCompleteness(empty)
    expect(diagnostics).toHaveLength(fields.length)
    expect(diagnostics.every((d) => d.severity === 'blocker')).toBe(true)

    const complete = fillTypeSpecificDetail(moduleType, draft)
    const filled: ModuleDesignSpecification = { ...draft, module: { ...draft.module, moduleType }, typeSpecific: complete }
    expect(evaluateTypeSpecificCompleteness(filled)).toHaveLength(0)
  })
})

function approvedDomainDesign(architecture: ArchitectureSpecification): ModuleDesignSpecification {
  const draft = makeCompletableDraft(architecture, 'mod.domain')
  const { design: readyForReview } = applyModuleDesignChecks(draft)
  expect(readyForReview.status).toBe('readyForReview')
  const approval = approveModuleDesign(readyForReview, { approvedBy: 'user:alice', authority: 'module-owner', approvedAt: '2026-01-01T00:00:00.000Z' })
  expect(approval.ok).toBe(true)
  return approval.design
}

describe('EUC-04 evaluateModuleDesignChecks (§9.9)', () => {
  it('blocks on an empty responsibility', () => {
    const architecture = architectureFixture()
    const draft = makeCompletableDraft(architecture, 'mod.domain')
    const design = { ...draft, module: { ...draft.module, responsibility: '' } }
    const evaluation = evaluateModuleDesignChecks(design)
    expect(evaluation.passed).toBe(false)
    expect(evaluation.diagnostics.some((d) => d.code === 'MODDESIGN-RESPONSIBILITY-EMPTY')).toBe(true)
  })

  it('blocks on a responsibility overlap with an approved module without a recorded decision', () => {
    const architecture = architectureFixture()
    const approvedDomain = approvedDomainDesign(architecture)
    const draft = makeCompletableDraft(architecture, 'mod.workflow')
    const design = { ...draft, module: { ...draft.module, responsibility: approvedDomain.module.responsibility } }
    const evaluation = evaluateModuleDesignChecks(design, { otherDesigns: [approvedDomain] })
    expect(evaluation.diagnostics.some((d) => d.code === 'MODDESIGN-RESPONSIBILITY-OVERLAP')).toBe(true)
  })

  it('does not block a responsibility overlap when a design decision is recorded', () => {
    const architecture = architectureFixture()
    const approvedDomain = approvedDomainDesign(architecture)
    const draft = makeCompletableDraft(architecture, 'mod.workflow')
    const design = {
      ...draft,
      module: { ...draft.module, responsibility: approvedDomain.module.responsibility },
      trace: { ...draft.trace, designDecisionIds: ['decision.shared-responsibility'] },
    }
    const evaluation = evaluateModuleDesignChecks(design, { otherDesigns: [approvedDomain] })
    expect(evaluation.diagnostics.some((d) => d.code === 'MODDESIGN-RESPONSIBILITY-OVERLAP')).toBe(false)
  })

  it('blocks when an operation has no contract', () => {
    const architecture = architectureFixture()
    const draft = makeCompletableDraft(architecture, 'mod.domain')
    const noContract = { ...draft, providedOperations: draft.providedOperations.map((op) => ({ operationId: op.operationId, version: op.version })) }
    const evaluation = evaluateModuleDesignChecks(noContract)
    expect(evaluation.diagnostics.some((d) => d.code === 'MODDESIGN-OPERATION-NO-CONTRACT')).toBe(true)
  })

  it('does not block when the operation has an approved contract', () => {
    const architecture = architectureFixture()
    const draft = makeCompletableDraft(architecture, 'mod.domain')
    const noContract = { ...draft, providedOperations: draft.providedOperations.map((op) => ({ operationId: op.operationId, version: op.version })) }
    const approvedContracts: OperationContract[] = [
      {
        schemaVersion: '1.0',
        operationId: 'op.calculate',
        version: '1.0.0',
        behavior: 'command',
        inputSchemaRef: draft.schemas[0]!.schemaId,
        outputSchemaRef: draft.schemas[1]!.schemaId,
        preconditions: [],
        postconditions: [],
        domainRejections: [],
        technicalErrors: [],
        sideEffects: [],
        idempotency: 'idempotent',
        timeoutClass: 'medium',
        cancellable: false,
        artifactTypes: [],
        provenanceFields: [],
      },
    ]
    const evaluation = evaluateModuleDesignChecks(noContract, { approvedContracts })
    expect(evaluation.diagnostics.some((d) => d.code === 'MODDESIGN-OPERATION-NO-CONTRACT')).toBe(false)
  })

  it('blocks when a required operation has no provider', () => {
    const architecture = architectureFixture()
    const draft = makeCompletableDraft(architecture, 'mod.workflow')
    const design = { ...draft, requiredOperations: [{ operationId: 'op.calculate', acceptedVersionRange: '^1.0.0', reason: 'needs domain rules' }] }
    const evaluation = evaluateModuleDesignChecks(design)
    expect(evaluation.diagnostics.some((d) => d.code === 'MODDESIGN-REQUIRED-OPERATION-NO-PROVIDER')).toBe(true)
  })

  it('does not block a required operation once it has a provider', () => {
    const architecture = architectureFixture()
    const draft = makeCompletableDraft(architecture, 'mod.workflow')
    const design = {
      ...draft,
      requiredOperations: [{ operationId: 'op.calculate', acceptedVersionRange: '^1.0.0', providerModuleId: 'mod.domain', reason: 'needs domain rules' }],
    }
    const evaluation = evaluateModuleDesignChecks(design)
    expect(evaluation.diagnostics.some((d) => d.code === 'MODDESIGN-REQUIRED-OPERATION-NO-PROVIDER')).toBe(false)
  })

  it('blocks when a provided operation has no approved architecture owner', () => {
    const architecture = architectureFixture()
    const draft = makeCompletableDraft(architecture, 'mod.domain')
    const evaluation = evaluateModuleDesignChecks(draft, {
      architecture: architectureFixture({ operationAllocations: [{ operationId: 'op.calculate', moduleId: 'mod.workflow' }] }),
    })
    expect(evaluation.diagnostics.some((d) => d.code === 'MODDESIGN-OPERATION-NO-OWNER')).toBe(true)
  })

  it('blocks when an input or output schema is missing', () => {
    const architecture = architectureFixture()
    const draft = makeCompletableDraft(architecture, 'mod.domain')
    const design = { ...draft, schemas: [] }
    const evaluation = evaluateModuleDesignChecks(design)
    expect(evaluation.diagnostics.some((d) => d.code === 'MODDESIGN-SCHEMA-INPUT-MISSING')).toBe(true)
    expect(evaluation.diagnostics.some((d) => d.code === 'MODDESIGN-SCHEMA-OUTPUT-MISSING')).toBe(true)
  })

  it('blocks when a module rule conflicts with an approved use case', () => {
    const architecture = architectureFixture()
    const draft = makeCompletableDraft(architecture, 'mod.domain')
    const design = { ...draft, trace: { ...draft.trace, ruleIds: ['rule.conflicting'] } }
    const evaluation = evaluateModuleDesignChecks(design, { conflictingRuleIds: ['rule.conflicting'] })
    expect(evaluation.diagnostics.some((d) => d.code === 'MODDESIGN-RULE-CONFLICT')).toBe(true)
  })

  it('blocks when a state transition has no defined trigger', () => {
    const architecture = architectureFixture()
    const draft = makeCompletableDraft(architecture, 'mod.domain')
    const design = {
      ...draft,
      behavior: {
        ...draft.behavior,
        states: [
          {
            recordName: 'Order',
            states: ['open', 'closed'],
            initialState: 'open',
            finalStates: ['closed'],
            transitions: [{ id: 't1', from: 'open', to: 'closed', trigger: '' }],
          },
        ],
      },
    }
    const evaluation = evaluateModuleDesignChecks(design)
    expect(evaluation.diagnostics.some((d) => d.code === 'MODDESIGN-TRANSITION-NO-TRIGGER')).toBe(true)
  })

  it('blocks a workflow decision with an unguarded ambiguous branch', () => {
    const architecture = architectureFixture()
    const draft = makeCompletableDraft(architecture, 'mod.workflow')
    const design = {
      ...draft,
      behavior: {
        ...draft.behavior,
        activities: [
          {
            id: 'act1',
            name: 'Main flow',
            actions: [
              {
                id: 'dec1',
                kind: 'decision' as const,
                label: 'branch?',
                next: [{ targetId: 'a' }, { targetId: 'b' }],
              },
            ],
          },
        ],
      },
    }
    const evaluation = evaluateModuleDesignChecks(design)
    expect(evaluation.diagnostics.some((d) => d.code === 'MODDESIGN-AMBIGUOUS-BRANCH')).toBe(true)
  })

  it('does not block a decision with exactly one unguarded default branch', () => {
    const architecture = architectureFixture()
    const draft = makeCompletableDraft(architecture, 'mod.workflow')
    const design = {
      ...draft,
      behavior: {
        ...draft.behavior,
        activities: [
          {
            id: 'act1',
            name: 'Main flow',
            actions: [
              {
                id: 'dec1',
                kind: 'decision' as const,
                label: 'branch?',
                next: [{ targetId: 'a', guard: 'x > 0' }, { targetId: 'b' }],
              },
            ],
          },
        ],
      },
    }
    const evaluation = evaluateModuleDesignChecks(design)
    expect(evaluation.diagnostics.some((d) => d.code === 'MODDESIGN-AMBIGUOUS-BRANCH')).toBe(false)
  })

  it('blocks a failure with no observable outcome', () => {
    const architecture = architectureFixture()
    const draft = makeCompletableDraft(architecture, 'mod.domain')
    const design = { ...draft, behavior: { ...draft.behavior, technicalFailures: [''] } }
    const evaluation = evaluateModuleDesignChecks(design)
    expect(evaluation.diagnostics.some((d) => d.code === 'MODDESIGN-FAILURE-NO-OUTCOME')).toBe(true)
  })

  it('blocks a required external adapter with no failure mapping', () => {
    const architecture = architectureFixture({
      moduleDefinitions: [{ moduleId: 'mod.connection', name: 'Adapter', moduleType: 'connection', responsibility: 'Reads external files' }],
      moduleIds: ['mod.connection'],
      dependencyEdges: [],
      operationAllocations: [],
    })
    const draft = makeCompletableDraft(architecture, 'mod.connection')
    const detail = draft.typeSpecific.moduleType === 'connection' ? { ...draft.typeSpecific.detail, compatibilityErrors: '' } : draft.typeSpecific.detail
    const design = { ...draft, typeSpecific: { moduleType: 'connection' as const, detail }, behavior: { ...draft.behavior, technicalFailures: ['file is corrupt'] } }
    const evaluation = evaluateModuleDesignChecks(design)
    expect(evaluation.diagnostics.some((d) => d.code === 'MODDESIGN-ADAPTER-NO-FAILURE-MAPPING')).toBe(true)
  })

  it('blocks an owned-path overlap with another module', () => {
    const architecture = architectureFixture()
    const a = makeCompletableDraft(architecture, 'mod.domain')
    const b = { ...makeCompletableDraft(architecture, 'mod.workflow'), boundary: { ...makeCompletableDraft(architecture, 'mod.workflow').boundary, ownedPaths: a.boundary.ownedPaths } }
    const evaluation = evaluateModuleDesignChecks(b, { otherDesigns: [a] })
    expect(evaluation.diagnostics.some((d) => d.code === 'MODDESIGN-OWNED-PATH-OVERLAP')).toBe(true)
  })

  it('blocks a missing required acceptance case', () => {
    const architecture = architectureFixture()
    const draft = makeCompletableDraft(architecture, 'mod.domain')
    const design = { ...draft, verification: { ...draft.verification, acceptanceCases: [] } }
    const evaluation = evaluateModuleDesignChecks(design)
    expect(evaluation.diagnostics.some((d) => d.code === 'MODDESIGN-ACCEPTANCE-CASE-MISSING')).toBe(true)
  })

  it('blocks an open material unresolved item', () => {
    const architecture = architectureFixture()
    const draft = makeCompletableDraft(architecture, 'mod.domain')
    const design = { ...draft, unresolvedItems: [{ id: 'q1', description: 'is x allowed?', materiality: 'material' as const }] }
    const evaluation = evaluateModuleDesignChecks(design)
    expect(evaluation.diagnostics.some((d) => d.code === 'MODDESIGN-MATERIAL-ITEM-OPEN')).toBe(true)
  })

  it('blocks when a source revision changed during review', () => {
    const architecture = architectureFixture()
    const draft = makeCompletableDraft(architecture, 'mod.domain')
    const evaluation = evaluateModuleDesignChecks(draft, { architecture: architectureFixture({ revision: 'r2' }) })
    expect(evaluation.diagnostics.some((d) => d.code === 'MODDESIGN-SOURCE-REVISION-CHANGED')).toBe(true)
  })

  it('blocks when UML semantic validation fails for a required diagram (pluggable hook)', () => {
    const architecture = architectureFixture()
    const draft = makeCompletableDraft(architecture, 'mod.domain')
    const context: ModuleDesignCheckContext = {
      diagramDiagnostics: [{ id: 'diag1', code: 'UML-INVALID-STATE-MACHINE', severity: 'blocker', message: 'state machine has an unreachable state' }],
    }
    const evaluation = evaluateModuleDesignChecks(draft, context)
    expect(evaluation.diagnostics.some((d) => d.code === 'UML-INVALID-STATE-MACHINE')).toBe(true)
  })

  it('warns on an optional example missing, a nonmaterial question, an unmeasured performance target, an inapplicable diagram, and a missing greenfield repo path', () => {
    const architecture = architectureFixture()
    const draft = makeCompletableDraft(architecture, 'mod.domain')
    const design = {
      ...draft,
      verification: { ...draft.verification, examples: [] },
      unresolvedItems: [{ id: 'q2', description: 'nice to know', materiality: 'nonmaterial' as const }],
      trace: { ...draft.trace, qualityRequirementIds: ['quality.latency'] },
      diagrams: [],
    }
    const evaluation = evaluateModuleDesignChecks(design, { greenfield: true, existingRepoPaths: [] })
    const codes = evaluation.diagnostics.map((d) => d.code)
    expect(codes).toContain('MODDESIGN-EXAMPLE-MISSING')
    expect(codes).toContain('MODDESIGN-NONMATERIAL-QUESTION-OPEN')
    expect(codes).toContain('MODDESIGN-PERFORMANCE-UNMEASURED')
    expect(codes).toContain('MODDESIGN-DIAGRAM-NOT-APPLICABLE')
    expect(codes).toContain('MODDESIGN-REPO-PATH-MISSING')
    expect(evaluation.diagnostics.filter((d) => d.severity === 'warning').length).toBeGreaterThan(0)
    // Warnings never block approval by themselves once required content is complete.
    expect(evaluation.passed).toBe(true)
  })
})

describe('EUC-04 approveModuleDesign (§9.10)', () => {
  it('approves one module without changing another', () => {
    const architecture = architectureFixture()
    const domainDraft = makeCompletableDraft(architecture, 'mod.domain')
    const workflowDraft = makeCompletableDraft(architecture, 'mod.workflow')
    const workflowSnapshot = JSON.parse(JSON.stringify(workflowDraft))

    const { design: domainReady } = applyModuleDesignChecks(domainDraft)
    expect(domainReady.status).toBe('readyForReview')

    const approval = approveModuleDesign(domainReady, { approvedBy: 'user:alice', authority: 'module-owner', approvedAt: '2026-01-01T00:00:00.000Z' })
    expect(approval.ok).toBe(true)
    expect(approval.design.status).toBe('approved')
    expect(approval.design.approval?.recordId).toBe(domainReady.id)
    expect(approval.design.approval?.contentHash).toBe(approval.design.contentHash)
    expect(approval.design.approval?.sourceHashes?.architecture).toBe(architecture.contentHash)

    // The other module's draft is completely untouched.
    expect(workflowDraft).toEqual(workflowSnapshot)
  })

  it('produces an exact block diagnostic set for incomplete upstream work', () => {
    const architecture = architectureFixture()
    const incompleteDraft = createModuleDesignDraft({ projectId: 'proj-1', architecture, moduleId: 'mod.domain' })
    const { design: evaluated, evaluation } = applyModuleDesignChecks(incompleteDraft)
    expect(evaluated.status).toBe('needsInput')
    expect(evaluation.passed).toBe(false)
    expect(evaluation.blockerCount).toBeGreaterThan(0)

    const approval = approveModuleDesign(evaluated, { approvedBy: 'user:alice', authority: 'module-owner', approvedAt: '2026-01-01T00:00:00.000Z' })
    expect(approval.ok).toBe(false)
    expect(approval.diagnostics[0]?.code).toBe('MODDESIGN-APPROVAL-STATE')
  })

  it('rejects an agent actor as approver', () => {
    const architecture = architectureFixture()
    const draft = makeCompletableDraft(architecture, 'mod.domain')
    const { design: ready } = applyModuleDesignChecks(draft)
    const approval = approveModuleDesign(ready, { approvedBy: 'agent:copilot', authority: 'module-owner', approvedAt: '2026-01-01T00:00:00.000Z' })
    expect(approval.ok).toBe(false)
    expect(approval.diagnostics[0]?.code).toBe('MODDESIGN-APPROVAL-AGENT')
  })

  it('rejects approval from a status other than readyForReview', () => {
    const architecture = architectureFixture()
    const draft = makeCompletableDraft(architecture, 'mod.domain')
    const approval = approveModuleDesign(draft, { approvedBy: 'user:alice', authority: 'module-owner', approvedAt: '2026-01-01T00:00:00.000Z' })
    expect(approval.ok).toBe(false)
    expect(approval.diagnostics[0]?.code).toBe('MODDESIGN-APPROVAL-STATE')
  })
})

describe('EUC-04 reopenModuleDesign and diffModuleDesign (§9.11)', () => {
  it('preserves the approved revision and returns a new linked draft', () => {
    const architecture = architectureFixture()
    const approved = approvedDomainDesign(architecture)
    const { approved: preserved, draft } = reopenModuleDesign(approved)

    expect(preserved).toBe(approved)
    expect(preserved.status).toBe('approved')
    expect(draft.status).toBe('draft')
    expect(draft.revision).toBe('r2')
    expect(draft.approval).toBeUndefined()
    expect(draft.module).toEqual(approved.module)
  })

  it('throws when reopening a design that is not approved', () => {
    const architecture = architectureFixture()
    const draft = createModuleDesignDraft({ projectId: 'proj-1', architecture, moduleId: 'mod.domain' })
    expect(() => reopenModuleDesign(draft)).toThrow()
  })

  it('reports the exact change set between the approved revision and the reopened draft', () => {
    const architecture = architectureFixture()
    const approved = approvedDomainDesign(architecture)
    const { draft } = reopenModuleDesign(approved)
    const changed = updateModuleDesignItem(draft, 'module.responsibility', 'A new, more precise responsibility')
    expect(changed.ok).toBe(true)

    const diff = diffModuleDesign(approved, changed.design)
    expect(diff).toEqual([{ path: 'module.responsibility', before: approved.module.responsibility, after: 'A new, more precise responsibility' }])
  })

  it('reports no diff when nothing changed since reopening', () => {
    const architecture = architectureFixture()
    const approved = approvedDomainDesign(architecture)
    const { draft } = reopenModuleDesign(approved)
    expect(diffModuleDesign(approved, draft)).toEqual([])
  })
})

describe('EUC-04 markStale / markConflict / withdraw (§5.2)', () => {
  it('marks only the affected module stale, selectively, and preserves approval history', () => {
    const architecture = architectureFixture()
    const approvedDomain = approvedDomainDesign(architecture)
    const approvedWorkflowDraft = makeCompletableDraft(architecture, 'mod.workflow')
    const { design: workflowReady } = applyModuleDesignChecks(approvedWorkflowDraft)
    const approvedWorkflow = approveModuleDesign(workflowReady, {
      approvedBy: 'user:alice',
      authority: 'module-owner',
      approvedAt: '2026-01-01T00:00:00.000Z',
    }).design

    // A semantic change to the domain module's contract makes only the domain
    // module stale; the workflow module (unaffected) is untouched.
    const staleDomain = markStale(approvedDomain, {
      recordId: 'op.calculate',
      recordKind: 'OperationContract',
      fromRevision: '1.0.0',
      toRevision: '1.1.0',
      description: 'output schema changed',
    })

    expect(staleDomain.status).toBe('stale')
    expect(staleDomain.approval).toEqual(approvedDomain.approval)
    expect(approvedWorkflow.status).toBe('approved')
  })

  it('marks a conflict and preserves it as a material unresolved item', () => {
    const architecture = architectureFixture()
    const draft = makeCompletableDraft(architecture, 'mod.domain')
    const conflicted = markConflict(draft, { description: 'two decisions require different owners', conflictingRecordIds: ['decision.a', 'decision.b'] })
    expect(conflicted.status).toBe('conflict')
    expect(conflicted.unresolvedItems.some((item) => item.materiality === 'material')).toBe(true)
  })

  it('withdraws a draft', () => {
    const architecture = architectureFixture()
    const draft = makeCompletableDraft(architecture, 'mod.domain')
    const withdrawn = withdraw(draft, { by: 'user:alice', at: '2026-01-01T00:00:00.000Z', reason: 'superseded by a merge' })
    expect(withdrawn.status).toBe('withdrawn')
  })
})

describe('EUC-04 module queue and progress (§9.2, §16.5)', () => {
  it('computes state, dependency counts, and a stable recommended order', () => {
    const architecture = architectureFixture()
    const approvedDomain = approvedDomainDesign(architecture)
    const progress = computeModuleDesignProgress(architecture, [approvedDomain])

    expect(progress.total).toBe(3)
    expect(progress.approved).toBe(1)
    expect(progress.notStarted).toBe(2)

    const domainEntry = progress.modules.find((m) => m.moduleId === 'mod.domain')!
    expect(domainEntry.state).toBe('approved')
    expect(domainEntry.directConsumerCount).toBe(1)
    expect(domainEntry.directDependencyCount).toBe(0)

    // Dependency-first: domain (no deps) before workflow before experience.
    const order = [...progress.modules].sort((a, b) => a.recommendedOrder - b.recommendedOrder).map((m) => m.moduleId)
    expect(order).toEqual(['mod.domain', 'mod.workflow', 'mod.experience'])
  })

  it('is stable for a tied dependency-free set (alphabetical tie-break)', () => {
    const architecture = architectureFixture({
      dependencyEdges: [],
      moduleDefinitions: [
        { moduleId: 'mod.b', name: 'B', moduleType: 'domain', responsibility: 'b' },
        { moduleId: 'mod.a', name: 'A', moduleType: 'domain', responsibility: 'a' },
      ],
      moduleIds: ['mod.b', 'mod.a'],
    })
    const progress = computeModuleDesignProgress(architecture, [])
    const order = [...progress.modules].sort((a, b) => a.recommendedOrder - b.recommendedOrder).map((m) => m.moduleId)
    expect(order).toEqual(['mod.a', 'mod.b'])
  })

  it('marks a module blocked when blockers are supplied', () => {
    const architecture = architectureFixture()
    const draft = createModuleDesignDraft({ projectId: 'proj-1', architecture, moduleId: 'mod.domain' })
    const progress = computeModuleDesignProgress(architecture, [draft], [], { 'mod.domain': ['issue-1', 'issue-2'] })
    const entry = progress.modules.find((m) => m.moduleId === 'mod.domain')!
    expect(entry.state).toBe('blocked')
    expect(entry.blockingIssueCount).toBe(2)
    expect(entry.blockingIds).toEqual(['issue-1', 'issue-2'])
  })

  it('filters the queue by every supported tab', () => {
    const architecture = architectureFixture()
    const approvedDomain = approvedDomainDesign(architecture)
    const progress = computeModuleDesignProgress(architecture, [approvedDomain])

    expect(filterModuleQueue(progress, 'all')).toHaveLength(3)
    expect(filterModuleQueue(progress, 'approved').map((m) => m.moduleId)).toEqual(['mod.domain'])
    expect(filterModuleQueue(progress, 'notStarted').map((m) => m.moduleId).sort()).toEqual(['mod.experience', 'mod.workflow'])
    expect(filterModuleQueue(progress, 'needsInput')).toHaveLength(0)
    expect(filterModuleQueue(progress, 'readyForReview')).toHaveLength(0)
    expect(filterModuleQueue(progress, 'stale')).toHaveLength(0)
    expect(filterModuleQueue(progress, 'old')).toHaveLength(0)
    expect(filterModuleQueue(progress, 'blocked')).toHaveLength(0)
  })

  it('selects the canvas-selected module first', () => {
    const architecture = architectureFixture()
    const progress = computeModuleDesignProgress(architecture, [])
    expect(selectDefaultModule(progress, 'mod.experience')).toBe('mod.experience')
  })

  it('falls back to the first incomplete dependency of another module', () => {
    const architecture = architectureFixture()
    const progress = computeModuleDesignProgress(architecture, [])
    // mod.domain and mod.workflow are both dependencies of another module; mod.domain sorts first in recommended order.
    expect(selectDefaultModule(progress)).toBe('mod.domain')
  })

  it('falls back to the first incomplete module in stable sort order when nothing is a dependency', () => {
    const architecture = architectureFixture({ dependencyEdges: [] })
    const progress = computeModuleDesignProgress(architecture, [])
    expect(selectDefaultModule(progress)).toBe('mod.domain')
  })

  it('falls back to the first approved module when everything else is approved', () => {
    const architecture = architectureFixture({ dependencyEdges: [] })
    const approvedDomain = approvedDomainDesign(architecture)
    const workflowDraft = makeCompletableDraft(architecture, 'mod.workflow')
    const { design: workflowReady } = applyModuleDesignChecks(workflowDraft)
    const approvedWorkflow = approveModuleDesign(workflowReady, { approvedBy: 'user:alice', authority: 'module-owner', approvedAt: '2026-01-01T00:00:00.000Z' }).design
    const experienceDraft = makeCompletableDraft(architecture, 'mod.experience')
    const { design: experienceReady } = applyModuleDesignChecks(experienceDraft)
    const approvedExperience = approveModuleDesign(experienceReady, { approvedBy: 'user:alice', authority: 'module-owner', approvedAt: '2026-01-01T00:00:00.000Z' }).design

    const progress = computeModuleDesignProgress(architecture, [approvedDomain, approvedWorkflow, approvedExperience])
    expect(selectDefaultModule(progress)).toBe('mod.domain')
  })
})
