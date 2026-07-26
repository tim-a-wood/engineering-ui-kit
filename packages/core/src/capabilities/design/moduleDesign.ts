/**
 * EUC-04 — Module-design core.
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §3, §5, §9,
 * §16.1-16.5, §18.1, §24.1, §25.3 (EUC-04).
 *
 * Owned outputs: `ModuleDesignSpecification` draft/update/approve/reopen
 * lifecycle, the §9.9 module-design checks, the §9.6 type-specific field
 * policy, and the §16.5 module queue and progress read model.
 *
 * This module never edits `records.ts` or `identity.ts` (shared contracts);
 * it only imports from them.
 */

import type {
  ApprovalAuthority,
  ConnectionModuleDetail,
  DesignApproval,
  DesignDiagnostic,
  DomainModuleDetail,
  ExperienceModuleDetail,
  ModuleDesignProgress,
  ModuleDesignProgressEntry,
  ModuleDesignSession,
  ModuleDesignSpecification,
  PlatformModuleDetail,
  TypeSpecificDetail,
  UnresolvedDesignItem,
  WorkflowModuleDetail,
} from './records.js'
import { isNonHumanActor } from './records.js'
import {
  childId,
  compareRevisions,
  designContentHash,
  firstRevision,
  nextRevision,
  ownedPathsOverlap,
  stableSortBy,
  stableSortStrings,
} from './identity.js'
import type { ArchitectureSpecification, ModuleType, OperationContract } from '../types.js'
import type { GateResult } from '../gates.js'

// ---------------------------------------------------------------------------
// Diagnostics helpers
// ---------------------------------------------------------------------------

function makeDiagnostic(
  code: string,
  severity: DesignDiagnostic['severity'],
  message: string,
  target?: string,
  relatedIds?: string[],
): DesignDiagnostic {
  return {
    id: `${code}:${target ?? 'design'}`,
    code,
    severity,
    message,
    ...(relatedIds && relatedIds.length ? { relatedIds } : {}),
    ...(target ? { target } : {}),
  }
}

function sortDesignDiagnostics(diagnostics: DesignDiagnostic[]): DesignDiagnostic[] {
  return [...diagnostics].sort((a, b) => (a.code === b.code ? a.id.localeCompare(b.id) : a.code.localeCompare(b.code)))
}

// ---------------------------------------------------------------------------
// Draft creation (§9.4, §9.5)
// ---------------------------------------------------------------------------

export type CreateModuleDesignDraftInput = {
  projectId: string
  architecture: ArchitectureSpecification
  moduleId: string
  moduleVersion?: string
  owner?: string
  deployableId?: string
  runtimeAllocation?: string
  runtimeLanguage?: string
  ownedPaths?: string[]
  editableSharedPaths?: string[]
}

function emptyExperienceDetail(): ExperienceModuleDetail {
  return {
    userRolesAndTasks: [],
    surfaces: [],
    informationHierarchy: '',
    commandsAndNavigation: [],
    viewStates: [],
    loadingBehavior: '',
    emptyStates: '',
    validationMessages: '',
    permissionStates: '',
    partialDataStates: '',
    recoverableFailures: '',
    unrecoverableFailures: '',
    responsiveBehavior: '',
    touchTargets: '',
    keyboardBehavior: '',
    focusOrderAndReturn: '',
    screenReaderNamesAndStatus: '',
    reducedMotionBehavior: '',
    themeAndContrast: '',
    approvedComponentSources: [],
    inboundBindingIds: [],
    scenarioScreenshotIds: [],
  }
}

function emptyWorkflowDetail(): WorkflowModuleDetail {
  return {
    trigger: '',
    orderedSteps: [],
    participants: [],
    decisionsAndGuards: [],
    transactionBoundary: '',
    partialCompletion: '',
    compensation: '',
    retryPolicy: '',
    deduplication: '',
    idempotencyKeyUse: '',
    cancellationPoints: [],
    deadlinePropagation: '',
    resourceLocks: [],
    progressReporting: '',
    finalOutcomes: [],
  }
}

function emptyDomainDetail(): DomainModuleDetail {
  return {
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
  }
}

function emptyConnectionDetail(): ConnectionModuleDetail {
  return {
    externalActor: '',
    implementedPortId: '',
    supportedFormats: [],
    inputDiscovery: '',
    inputValidation: '',
    canonicalMapping: '',
    provenanceExtraction: '',
    authenticationRef: '',
    licenseOrSessionNeeds: '',
    timeouts: '',
    cancellation: '',
    retrySafety: '',
    partialReadBehavior: '',
    corruptInputBehavior: '',
    compatibilityErrors: '',
    processIsolation: '',
    cleanup: '',
    representativeFixtures: [],
  }
}

function emptyPlatformDetail(): PlatformModuleDetail {
  return {
    storedOrScheduledResource: '',
    ownershipAndAccess: '',
    consistency: '',
    transactionBehavior: '',
    indexing: '',
    retention: '',
    backupAndRecovery: '',
    capacity: '',
    cleanup: '',
    healthChecks: '',
    failureInjection: '',
    testImplementation: '',
  }
}

/** §9.6 — an empty (all-fields-blank) detail block for the applicable type. */
export function emptyTypeSpecificDetail(moduleType: ModuleType): TypeSpecificDetail {
  switch (moduleType) {
    case 'experience':
      return { moduleType, detail: emptyExperienceDetail() }
    case 'workflow':
      return { moduleType, detail: emptyWorkflowDetail() }
    case 'domain':
      return { moduleType, detail: emptyDomainDetail() }
    case 'connection':
      return { moduleType, detail: emptyConnectionDetail() }
    case 'platform':
      return { moduleType, detail: emptyPlatformDetail() }
  }
}

/**
 * Creates a `ModuleDesignSpecification` draft from an approved
 * `ArchitectureSpecification` slice (§9.4). Identity, type, and
 * responsibility come from `architecture.moduleDefinitions`; dependencies
 * and consumers come from `dependencyEdges`; provided operations come from
 * `operationAllocations`. Deterministic id, revision `r1`, status `draft`.
 */
export function createModuleDesignDraft(input: CreateModuleDesignDraftInput): ModuleDesignSpecification {
  const { architecture, moduleId } = input
  const definition = architecture.moduleDefinitions?.find((candidate) => candidate.moduleId === moduleId)
  if (!definition) {
    throw new Error(`unknown module in architecture: ${moduleId}`)
  }
  const directDependencyIds = stableSortStrings(
    Array.from(
      new Set(
        architecture.dependencyEdges
          .filter((edge) => edge.fromModuleId === moduleId)
          .map((edge) => edge.toModuleId),
      ),
    ),
  )
  const directConsumerIds = stableSortStrings(
    Array.from(
      new Set(
        architecture.dependencyEdges
          .filter((edge) => edge.toModuleId === moduleId)
          .map((edge) => edge.fromModuleId),
      ),
    ),
  )
  const providedOperations = stableSortBy(
    architecture.operationAllocations.filter((allocation) => allocation.moduleId === moduleId),
    (allocation) => allocation.operationId,
  ).map((allocation) => ({ operationId: allocation.operationId, version: '1.0.0' }))
  const useCaseIds = stableSortStrings(
    Array.from(
      new Set(
        architecture.workflowTraces
          .filter((trace) => trace.moduleIds.includes(moduleId))
          .map((trace) => trace.useCaseId),
      ),
    ),
  )

  const id = childId(architecture.id, 'module-design', moduleId)
  const design: ModuleDesignSpecification = {
    schemaVersion: '1.0',
    projectId: input.projectId,
    id,
    revision: firstRevision(),
    status: 'draft',
    architecture: {
      id: architecture.id,
      revision: architecture.revision,
      contentHash: architecture.contentHash,
    },
    module: {
      moduleId,
      moduleVersion: input.moduleVersion ?? '1.0.0',
      name: definition.name,
      moduleType: definition.moduleType,
      owner: input.owner,
      responsibility: definition.responsibility,
      nonResponsibilities: [],
      ownedConcerns: [],
      excludedConcerns: [],
    },
    trace: {
      useCaseIds,
      scenarioStepIds: [],
      ruleIds: [],
      qualityRequirementIds: [],
      sourceRefs: [],
      designDecisionIds: [],
    },
    boundary: {
      directDependencyIds,
      directConsumerIds,
      deployableId: input.deployableId ?? `deployable.${moduleId}`,
      runtimeAllocation: input.runtimeAllocation ?? 'local-embedded',
      runtimeLanguage: input.runtimeLanguage ?? 'typescript',
      ownedPaths: input.ownedPaths ?? [`capabilities/modules/${moduleId}/`],
      editableSharedPaths: input.editableSharedPaths ?? [],
    },
    providedOperations,
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
    typeSpecific: emptyTypeSpecificDetail(definition.moduleType),
    diagrams: [],
    unresolvedItems: [],
    gates: [],
    contentHash: '',
  }
  return { ...design, contentHash: designContentHash(design) }
}

// ---------------------------------------------------------------------------
// Pure updates (§9.3, §9.11)
// ---------------------------------------------------------------------------

function setByPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split('.')
  let cursor: Record<string, unknown> = target
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i]!
    const nested = cursor[segment]
    if (!nested || typeof nested !== 'object') {
      cursor[segment] = {}
    }
    cursor = cursor[segment] as Record<string, unknown>
  }
  cursor[segments[segments.length - 1]!] = value
}

export type UpdateModuleDesignItemResult = {
  ok: boolean
  design: ModuleDesignSpecification
  diagnostics: DesignDiagnostic[]
}

/**
 * Pure field update that returns a new draft revision. Never mutates
 * `design`. Rejects updates to an approved record — the caller must
 * `reopenModuleDesign` first (§9.11).
 */
export function updateModuleDesignItem(
  design: ModuleDesignSpecification,
  path: string,
  value: unknown,
): UpdateModuleDesignItemResult {
  if (design.status === 'approved') {
    return {
      ok: false,
      design,
      diagnostics: [
        makeDiagnostic(
          'MODDESIGN-UPDATE-APPROVED',
          'blocker',
          'an approved module design must be reopened before it can be updated',
          path,
        ),
      ],
    }
  }
  const next = structuredClone(design) as ModuleDesignSpecification
  setByPath(next as unknown as Record<string, unknown>, path, value)
  next.revision = nextRevision(design.revision)
  const withHash = { ...next, contentHash: designContentHash(next) }
  return { ok: true, design: withHash, diagnostics: [] }
}

// ---------------------------------------------------------------------------
// Type-specific field policy (§9.6)
// ---------------------------------------------------------------------------

const EXPERIENCE_FIELDS: (keyof ExperienceModuleDetail)[] = [
  'userRolesAndTasks',
  'surfaces',
  'informationHierarchy',
  'commandsAndNavigation',
  'viewStates',
  'loadingBehavior',
  'emptyStates',
  'validationMessages',
  'permissionStates',
  'partialDataStates',
  'recoverableFailures',
  'unrecoverableFailures',
  'responsiveBehavior',
  'touchTargets',
  'keyboardBehavior',
  'focusOrderAndReturn',
  'screenReaderNamesAndStatus',
  'reducedMotionBehavior',
  'themeAndContrast',
  'approvedComponentSources',
  'inboundBindingIds',
  'scenarioScreenshotIds',
]

const WORKFLOW_FIELDS: (keyof WorkflowModuleDetail)[] = [
  'trigger',
  'orderedSteps',
  'participants',
  'decisionsAndGuards',
  'transactionBoundary',
  'partialCompletion',
  'compensation',
  'retryPolicy',
  'deduplication',
  'idempotencyKeyUse',
  'cancellationPoints',
  'deadlinePropagation',
  'resourceLocks',
  'progressReporting',
  'finalOutcomes',
]

const DOMAIN_FIELDS: (keyof DomainModuleDetail)[] = [
  'domainVocabulary',
  'valueObjects',
  'consistencyBoundary',
  'invariants',
  'calculations',
  'decisionTables',
  'deterministicOrdering',
  'canonicalIdentityRules',
  'revisionComparison',
  'invalidStatePrevention',
  'operationPurity',
]

const CONNECTION_FIELDS: (keyof ConnectionModuleDetail)[] = [
  'externalActor',
  'implementedPortId',
  'supportedFormats',
  'inputDiscovery',
  'inputValidation',
  'canonicalMapping',
  'provenanceExtraction',
  'authenticationRef',
  'licenseOrSessionNeeds',
  'timeouts',
  'cancellation',
  'retrySafety',
  'partialReadBehavior',
  'corruptInputBehavior',
  'compatibilityErrors',
  'processIsolation',
  'cleanup',
  'representativeFixtures',
]

const PLATFORM_FIELDS: (keyof PlatformModuleDetail)[] = [
  'storedOrScheduledResource',
  'ownershipAndAccess',
  'consistency',
  'transactionBehavior',
  'indexing',
  'retention',
  'backupAndRecovery',
  'capacity',
  'cleanup',
  'healthChecks',
  'failureInjection',
  'testImplementation',
]

/** §9.6 — the field names of the applicable `TypeSpecificDetail` block. */
export function requiredTypeSpecificFields(moduleType: ModuleType): string[] {
  switch (moduleType) {
    case 'experience':
      return [...EXPERIENCE_FIELDS]
    case 'workflow':
      return [...WORKFLOW_FIELDS]
    case 'domain':
      return [...DOMAIN_FIELDS]
    case 'connection':
      return [...CONNECTION_FIELDS]
    case 'platform':
      return [...PLATFORM_FIELDS]
  }
}

function isEmptyDetailValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'string') return value.trim().length === 0
  return value === undefined || value === null
}

/** §9.6 — diagnostics for each missing applicable type-specific field. */
export function evaluateTypeSpecificCompleteness(design: ModuleDesignSpecification): DesignDiagnostic[] {
  const fields = requiredTypeSpecificFields(design.module.moduleType)
  const detail = design.typeSpecific.detail as unknown as Record<string, unknown>
  const diagnostics: DesignDiagnostic[] = []
  for (const field of fields) {
    if (isEmptyDetailValue(detail[field])) {
      diagnostics.push(
        makeDiagnostic(
          'MODDESIGN-TYPE-FIELD',
          'blocker',
          `${design.module.moduleType} module design requires typeSpecific.detail.${field}`,
          `typeSpecific.detail.${field}`,
          [design.module.moduleId],
        ),
      )
    }
  }
  return diagnostics
}

// ---------------------------------------------------------------------------
// Module design checks (§9.9)
// ---------------------------------------------------------------------------

export type ModuleDesignCheckContext = {
  /** Approved architecture read again at check time, to detect §9.9 source drift. */
  architecture?: ArchitectureSpecification
  /** Other module designs, used for responsibility-overlap and owned-path checks. */
  otherDesigns?: ModuleDesignSpecification[]
  /** Approved operation contracts, used for the "operation has no contract" check. */
  approvedContracts?: OperationContract[]
  /** Rule ids known (by an upstream analysis) to conflict with an approved use case. */
  conflictingRuleIds?: string[]
  /** Explicit override: a source revision changed while this design was under review. */
  sourceRevisionChanged?: boolean
  /** Pluggable UML semantic validation hook (§9.9 "UML semantic validation fails"). */
  diagramDiagnostics?: DesignDiagnostic[]
  /** Quality-requirement ids that already have a measured performance target. */
  measuredQualityRequirementIds?: string[]
  /** Whether the project has no existing repository yet. */
  greenfield?: boolean
  /** Repository paths known to exist, used for the greenfield warning. */
  existingRepoPaths?: string[]
}

export type ModuleDesignCheckEvaluation = {
  gateId: 'EUC-04-MODULE-DESIGN-CHECKS'
  passed: boolean
  diagnostics: DesignDiagnostic[]
  blockerCount: number
  warningCount: number
}

/** Converts a check evaluation into the shared `GateResult` shape (blockers only). */
export function toGateResult(evaluation: ModuleDesignCheckEvaluation): GateResult {
  return {
    gateId: evaluation.gateId,
    passed: evaluation.passed,
    diagnostics: evaluation.diagnostics
      .filter((diagnostic) => diagnostic.severity === 'blocker')
      .map((diagnostic) => ({
        id: diagnostic.id,
        code: diagnostic.code,
        message: diagnostic.message,
        ...(diagnostic.relatedIds ? { relatedIds: diagnostic.relatedIds } : {}),
      })),
  }
}

/** §9.9 — every blocking and warning module-design check. */
export function evaluateModuleDesignChecks(
  design: ModuleDesignSpecification,
  context: ModuleDesignCheckContext = {},
): ModuleDesignCheckEvaluation {
  const blockers: DesignDiagnostic[] = []
  const warnings: DesignDiagnostic[] = []
  const moduleId = design.module.moduleId

  // responsibility is empty
  if (!design.module.responsibility.trim()) {
    blockers.push(makeDiagnostic('MODDESIGN-RESPONSIBILITY-EMPTY', 'blocker', 'module responsibility is empty', 'module.responsibility', [moduleId]))
  }

  // responsibility overlaps an approved module without a recorded decision
  const otherDesigns = context.otherDesigns ?? []
  const normalizedResponsibility = design.module.responsibility.trim().toLowerCase()
  if (normalizedResponsibility) {
    for (const other of otherDesigns) {
      if (other.module.moduleId === moduleId) continue
      if (other.status !== 'approved') continue
      if (other.module.responsibility.trim().toLowerCase() !== normalizedResponsibility) continue
      const hasDecision = design.trace.designDecisionIds.length > 0
      if (!hasDecision) {
        blockers.push(
          makeDiagnostic(
            'MODDESIGN-RESPONSIBILITY-OVERLAP',
            'blocker',
            `responsibility overlaps approved module ${other.module.moduleId} without a recorded decision`,
            'module.responsibility',
            [moduleId, other.module.moduleId],
          ),
        )
      }
    }
  }

  // an operation has no contract
  const approvedContracts = context.approvedContracts ?? []
  for (const operation of design.providedOperations) {
    const hasHash = Boolean(operation.contentHash)
    const hasApprovedContract = approvedContracts.some(
      (contract) => contract.operationId === operation.operationId && contract.version === operation.version,
    )
    if (!hasHash && !hasApprovedContract) {
      blockers.push(
        makeDiagnostic(
          'MODDESIGN-OPERATION-NO-CONTRACT',
          'blocker',
          `operation ${operation.operationId}@${operation.version} has no contract`,
          `providedOperations.${operation.operationId}`,
          [operation.operationId],
        ),
      )
    }
  }

  // a required operation has no provider
  for (const required of design.requiredOperations) {
    if (!required.providerModuleId || !required.providerModuleId.trim()) {
      blockers.push(
        makeDiagnostic(
          'MODDESIGN-REQUIRED-OPERATION-NO-PROVIDER',
          'blocker',
          `required operation ${required.operationId} has no provider`,
          `requiredOperations.${required.operationId}`,
          [required.operationId],
        ),
      )
    }
  }

  // a provided operation has no approved owner
  if (context.architecture) {
    for (const operation of design.providedOperations) {
      const allocation = context.architecture.operationAllocations.find((a) => a.operationId === operation.operationId)
      if (!allocation || allocation.moduleId !== moduleId) {
        blockers.push(
          makeDiagnostic(
            'MODDESIGN-OPERATION-NO-OWNER',
            'blocker',
            `provided operation ${operation.operationId} has no approved owner allocation to this module`,
            `providedOperations.${operation.operationId}`,
            [operation.operationId],
          ),
        )
      }
    }
  }

  // an input or output schema is missing
  if (design.providedOperations.length > 0) {
    if (!design.schemas.some((schema) => schema.role === 'input' && schema.ref.trim())) {
      blockers.push(makeDiagnostic('MODDESIGN-SCHEMA-INPUT-MISSING', 'blocker', 'no input schema is defined for a provided operation', 'schemas', [moduleId]))
    }
    if (!design.schemas.some((schema) => schema.role === 'output' && schema.ref.trim())) {
      blockers.push(makeDiagnostic('MODDESIGN-SCHEMA-OUTPUT-MISSING', 'blocker', 'no output schema is defined for a provided operation', 'schemas', [moduleId]))
    }
  }
  for (const schema of design.schemas) {
    if (!schema.ref.trim()) {
      blockers.push(
        makeDiagnostic('MODDESIGN-SCHEMA-REF-MISSING', 'blocker', `schema ${schema.schemaId} has no ref`, `schemas.${schema.schemaId}`, [schema.schemaId]),
      )
    }
  }

  // a module rule conflicts with an approved use case
  const conflictingRuleIds = new Set(context.conflictingRuleIds ?? [])
  for (const ruleId of design.trace.ruleIds) {
    if (conflictingRuleIds.has(ruleId)) {
      blockers.push(
        makeDiagnostic('MODDESIGN-RULE-CONFLICT', 'blocker', `rule ${ruleId} conflicts with an approved use case`, `trace.ruleIds.${ruleId}`, [ruleId]),
      )
    }
  }

  // a state transition has no defined trigger
  for (const state of design.behavior.states ?? []) {
    for (const transition of state.transitions) {
      if (!transition.trigger || !transition.trigger.trim()) {
        blockers.push(
          makeDiagnostic(
            'MODDESIGN-TRANSITION-NO-TRIGGER',
            'blocker',
            `state transition ${transition.id} (${transition.from} -> ${transition.to}) has no trigger`,
            `behavior.states.${state.recordName}.transitions.${transition.id}`,
            [transition.id],
          ),
        )
      }
    }
  }

  // a workflow decision has an unguarded ambiguous branch
  for (const activity of design.behavior.activities ?? []) {
    for (const action of activity.actions) {
      if (action.kind !== 'decision') continue
      const unguarded = action.next.filter((edge) => !edge.guard || !edge.guard.trim())
      if (action.next.length > 1 && unguarded.length > 1) {
        blockers.push(
          makeDiagnostic(
            'MODDESIGN-AMBIGUOUS-BRANCH',
            'blocker',
            `decision ${action.id} in activity ${activity.id} has more than one unguarded outgoing branch`,
            `behavior.activities.${activity.id}.actions.${action.id}`,
            [action.id],
          ),
        )
      }
    }
  }

  // a failure has no observable outcome (blank failure/rejection text)
  design.behavior.domainRejections.forEach((text, index) => {
    if (!text.trim()) {
      blockers.push(
        makeDiagnostic('MODDESIGN-FAILURE-NO-OUTCOME', 'blocker', 'a domain rejection has no observable outcome', `behavior.domainRejections.${index}`, [moduleId]),
      )
    }
  })
  design.behavior.technicalFailures.forEach((text, index) => {
    if (!text.trim()) {
      blockers.push(
        makeDiagnostic('MODDESIGN-FAILURE-NO-OUTCOME', 'blocker', 'a technical failure has no observable outcome', `behavior.technicalFailures.${index}`, [moduleId]),
      )
    }
  })

  // a required external adapter has no failure mapping
  if (design.module.moduleType === 'connection' && design.behavior.technicalFailures.length > 0) {
    const detail = design.typeSpecific.moduleType === 'connection' ? design.typeSpecific.detail : undefined
    if (!detail || !detail.compatibilityErrors.trim()) {
      blockers.push(
        makeDiagnostic(
          'MODDESIGN-ADAPTER-NO-FAILURE-MAPPING',
          'blocker',
          'adapter module has technical failures but no failure mapping to the approved error contract',
          'typeSpecific.detail.compatibilityErrors',
          [moduleId],
        ),
      )
    }
  }

  // an owned path overlaps another module (§9.9; overlap is containment-aware,
  // not exact string equality — see identity.ts `ownedPathsOverlap`)
  for (const other of otherDesigns) {
    if (other.module.moduleId === moduleId) continue
    for (const path of design.boundary.ownedPaths) {
      for (const otherOwnedPath of other.boundary.ownedPaths) {
        if (!ownedPathsOverlap(path, otherOwnedPath)) continue
        blockers.push(
          makeDiagnostic(
            'MODDESIGN-OWNED-PATH-OVERLAP',
            'blocker',
            `owned path ${path} of module ${moduleId} overlaps owned path ${otherOwnedPath} of module ${other.module.moduleId}`,
            `boundary.ownedPaths.${path}`,
            [moduleId, other.module.moduleId],
          ),
        )
      }
      for (const otherSharedPath of other.boundary.editableSharedPaths) {
        if (!ownedPathsOverlap(path, otherSharedPath)) continue
        blockers.push(
          makeDiagnostic(
            'MODDESIGN-OWNED-PATH-OVERLAP',
            'blocker',
            `owned path ${path} of module ${moduleId} overlaps editable shared path ${otherSharedPath} of module ${other.module.moduleId}`,
            `boundary.ownedPaths.${path}`,
            [moduleId, other.module.moduleId],
          ),
        )
      }
    }
  }

  // a required acceptance case is missing
  if (design.verification.acceptanceCases.length === 0) {
    blockers.push(makeDiagnostic('MODDESIGN-ACCEPTANCE-CASE-MISSING', 'blocker', 'a required acceptance case is missing', 'verification.acceptanceCases', [moduleId]))
  }

  // a material unresolved item is open
  for (const item of design.unresolvedItems) {
    if (item.materiality === 'material' && !item.resolvedAt) {
      blockers.push(
        makeDiagnostic('MODDESIGN-MATERIAL-ITEM-OPEN', 'blocker', `material unresolved item is open: ${item.description}`, `unresolvedItems.${item.id}`, [item.id]),
      )
    }
  }

  // a source revision changed during review
  const sourceChanged =
    context.sourceRevisionChanged === true ||
    (context.architecture !== undefined && context.architecture.revision !== design.architecture.revision)
  if (sourceChanged) {
    blockers.push(
      makeDiagnostic('MODDESIGN-SOURCE-REVISION-CHANGED', 'blocker', 'a source revision changed during review', 'architecture.revision', [moduleId]),
    )
  }

  // UML semantic validation failure hook — pluggable diagramDiagnostics input
  for (const diagram of context.diagramDiagnostics ?? []) {
    if (diagram.severity === 'blocker') blockers.push(diagram)
    else if (diagram.severity === 'warning') warnings.push(diagram)
  }

  // §9.6 type-specific field completeness is also a material blocker
  blockers.push(...evaluateTypeSpecificCompleteness(design))

  // --- warnings -------------------------------------------------------

  if (design.verification.examples.length === 0) {
    warnings.push(makeDiagnostic('MODDESIGN-EXAMPLE-MISSING', 'warning', 'an optional example is missing', 'verification.examples', [moduleId]))
  }
  for (const item of design.unresolvedItems) {
    if (item.materiality === 'nonmaterial' && !item.resolvedAt) {
      warnings.push(
        makeDiagnostic('MODDESIGN-NONMATERIAL-QUESTION-OPEN', 'warning', `a nonmaterial question remains: ${item.description}`, `unresolvedItems.${item.id}`, [item.id]),
      )
    }
  }
  const measured = new Set(context.measuredQualityRequirementIds ?? [])
  for (const qualityId of design.trace.qualityRequirementIds) {
    if (!measured.has(qualityId)) {
      warnings.push(
        makeDiagnostic('MODDESIGN-PERFORMANCE-UNMEASURED', 'warning', `performance target ${qualityId} is not measured yet`, `trace.qualityRequirementIds.${qualityId}`, [qualityId]),
      )
    }
  }
  if (design.diagrams.length === 0) {
    warnings.push(makeDiagnostic('MODDESIGN-DIAGRAM-NOT-APPLICABLE', 'warning', 'an optional diagram does not apply', 'diagrams', [moduleId]))
  }
  if (context.greenfield) {
    const existingRepoPaths = new Set(context.existingRepoPaths ?? [])
    for (const path of design.boundary.ownedPaths) {
      if (!existingRepoPaths.has(path)) {
        warnings.push(
          makeDiagnostic('MODDESIGN-REPO-PATH-MISSING', 'warning', `repository path ${path} does not exist in a greenfield project`, `boundary.ownedPaths.${path}`, [moduleId]),
        )
      }
    }
  }

  const diagnostics = sortDesignDiagnostics([...blockers, ...warnings])
  return {
    gateId: 'EUC-04-MODULE-DESIGN-CHECKS',
    passed: blockers.length === 0,
    diagnostics,
    blockerCount: blockers.length,
    warningCount: warnings.length,
  }
}

/**
 * Runs §9.9 checks and recomputes `status`/`gates` (the "Run checks" step,
 * §9.3 step 5). Not valid on an approved design — reopen it first.
 */
export function applyModuleDesignChecks(
  design: ModuleDesignSpecification,
  context: ModuleDesignCheckContext = {},
): { design: ModuleDesignSpecification; evaluation: ModuleDesignCheckEvaluation } {
  const evaluation = evaluateModuleDesignChecks(design, context)
  if (design.status === 'approved') {
    return { design, evaluation }
  }
  const status: ModuleDesignSpecification['status'] = evaluation.blockerCount > 0 ? 'needsInput' : 'readyForReview'
  const next: ModuleDesignSpecification = {
    ...design,
    status,
    gates: [toGateResult(evaluation)],
  }
  return { design: { ...next, contentHash: designContentHash(next) }, evaluation }
}

// ---------------------------------------------------------------------------
// Approval, reopen, and lifecycle transitions (§9.10, §9.11, §5.2)
// ---------------------------------------------------------------------------

export type ApproveModuleDesignInput = {
  approvedBy: string
  authority: ApprovalAuthority
  approvedAt: string
}

export type ApproveModuleDesignResult = {
  ok: boolean
  design: ModuleDesignSpecification
  diagnostics: DesignDiagnostic[]
}

/**
 * Approves a module design only from `readyForReview` with passing checks
 * (§9.10). Rejects agent actors (§4). Freezes content, and records
 * architecture revision + hash, source hashes, and open nonblocking items.
 * Approval of one module never touches another module's record.
 */
export function approveModuleDesign(
  design: ModuleDesignSpecification,
  approval: ApproveModuleDesignInput,
  context: ModuleDesignCheckContext = {},
): ApproveModuleDesignResult {
  // §4, §17.3 (second-review finding — self-asserted approval identity):
  // case-insensitive after trim, and rejects a `service:` actor the same as
  // an `agent:` actor.
  if (isNonHumanActor(approval.approvedBy)) {
    return {
      ok: false,
      design,
      diagnostics: [
        makeDiagnostic('MODDESIGN-APPROVAL-AGENT', 'blocker', 'a non-human (agent or service) actor cannot approve a module design', 'approval.approvedBy', [
          design.module.moduleId,
        ]),
      ],
    }
  }
  if (design.status !== 'readyForReview') {
    return {
      ok: false,
      design,
      diagnostics: [
        makeDiagnostic(
          'MODDESIGN-APPROVAL-STATE',
          'blocker',
          `module design must be readyForReview to approve (current status: ${design.status})`,
          'status',
          [design.module.moduleId],
        ),
      ],
    }
  }
  const evaluation = evaluateModuleDesignChecks(design, context)
  if (!evaluation.passed) {
    return { ok: false, design, diagnostics: evaluation.diagnostics }
  }

  const openNonblockingItemIds = design.unresolvedItems.filter((item) => !item.resolvedAt).map((item) => item.id)
  const sourceHashes: Record<string, string> = { architecture: design.architecture.contentHash }
  for (const contract of context.approvedContracts ?? []) {
    sourceHashes[`operation:${contract.operationId}@${contract.version}`] = designContentHash(contract)
  }

  const frozen: ModuleDesignSpecification = {
    ...design,
    status: 'approved',
    gates: [toGateResult(evaluation)],
  }
  const contentHash = designContentHash(frozen)
  const nextApproval: DesignApproval = {
    approvedBy: approval.approvedBy,
    authority: approval.authority,
    approvedAt: approval.approvedAt,
    recordId: design.id,
    revision: design.revision,
    contentHash,
    sourceHashes,
    openNonblockingItemIds,
  }
  const approved: ModuleDesignSpecification = { ...frozen, approval: nextApproval, contentHash }
  return { ok: true, design: approved, diagnostics: [] }
}

/**
 * Reopens an approved module design (§9.11): preserves the approved
 * revision untouched and returns a new draft revision linked to it.
 * Nothing is superseded until the new draft is itself approved.
 */
export function reopenModuleDesign(approved: ModuleDesignSpecification): {
  approved: ModuleDesignSpecification
  draft: ModuleDesignSpecification
} {
  if (approved.status !== 'approved') {
    throw new Error(`reopenModuleDesign requires an approved module design (status: ${approved.status})`)
  }
  const cloned = structuredClone(approved) as ModuleDesignSpecification
  const draft: ModuleDesignSpecification = {
    ...cloned,
    status: 'draft',
    revision: nextRevision(approved.revision),
    approval: undefined,
    gates: [],
  }
  return { approved, draft: { ...draft, contentHash: designContentHash(draft) } }
}

export type ModuleDesignDiffEntry = { path: string; before: unknown; after: unknown }

function deepDiff(before: unknown, after: unknown, path: string, out: ModuleDesignDiffEntry[]): void {
  if (JSON.stringify(before) === JSON.stringify(after)) return
  const bothObjects =
    before !== null &&
    after !== null &&
    typeof before === 'object' &&
    typeof after === 'object' &&
    !Array.isArray(before) &&
    !Array.isArray(after)
  if (bothObjects) {
    const beforeRecord = before as Record<string, unknown>
    const afterRecord = after as Record<string, unknown>
    const keys = stableSortStrings(Array.from(new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])))
    for (const key of keys) {
      deepDiff(beforeRecord[key], afterRecord[key], path ? `${path}.${key}` : key, out)
    }
    return
  }
  out.push({ path, before, after })
}

/** Reports the exact change set between an approved revision and its reopened draft (§9.11). */
export function diffModuleDesign(approved: ModuleDesignSpecification, draft: ModuleDesignSpecification): ModuleDesignDiffEntry[] {
  const ignoredKeys = new Set(['revision', 'status', 'contentHash', 'approval', 'gates'])
  const out: ModuleDesignDiffEntry[] = []
  const keys = stableSortStrings(
    Array.from(new Set([...Object.keys(approved), ...Object.keys(draft)])).filter((key) => !ignoredKeys.has(key)),
  )
  for (const key of keys) {
    deepDiff((approved as unknown as Record<string, unknown>)[key], (draft as unknown as Record<string, unknown>)[key], key, out)
  }
  return out
}

export type UpstreamChange = {
  recordId: string
  recordKind: string
  fromRevision: string
  toRevision: string
  description: string
}

/** §5.2 / §9.11 — marks a design stale because an upstream approved record changed. Approval history is preserved. */
export function markStale(design: ModuleDesignSpecification, upstreamChange: UpstreamChange): ModuleDesignSpecification {
  const item: UnresolvedDesignItem = {
    id: childId(design.id, 'stale', `${upstreamChange.recordId}-${upstreamChange.toRevision}`),
    description: `Upstream ${upstreamChange.recordKind} ${upstreamChange.recordId} changed from ${upstreamChange.fromRevision} to ${upstreamChange.toRevision}: ${upstreamChange.description}`,
    materiality: 'material',
  }
  const next: ModuleDesignSpecification = {
    ...design,
    status: 'stale',
    unresolvedItems: [...design.unresolvedItems, item],
  }
  return { ...next, contentHash: designContentHash(next) }
}

/** Returns the upstream-change unresolved items recorded by `markStale`. */
export function staleUpstreamChanges(design: ModuleDesignSpecification): UnresolvedDesignItem[] {
  const prefix = `${design.id}.stale.`
  return design.unresolvedItems.filter((item) => item.id.startsWith(prefix))
}

export type ConflictInfo = { description: string; conflictingRecordIds: string[] }

/** §5.2 — two requirements or decisions cannot both apply. */
export function markConflict(design: ModuleDesignSpecification, conflict: ConflictInfo): ModuleDesignSpecification {
  const item: UnresolvedDesignItem = {
    id: childId(design.id, 'conflict', conflict.description),
    description: `Conflict: ${conflict.description} (${conflict.conflictingRecordIds.join(', ')})`,
    materiality: 'material',
  }
  const next: ModuleDesignSpecification = {
    ...design,
    status: 'conflict',
    unresolvedItems: [...design.unresolvedItems, item],
  }
  return { ...next, contentHash: designContentHash(next) }
}

export type WithdrawInfo = { by: string; at: string; reason: string }

/** §5.2 — an authorized user stopped work on this draft. */
export function withdraw(design: ModuleDesignSpecification, info: WithdrawInfo): ModuleDesignSpecification {
  const item: UnresolvedDesignItem = {
    id: childId(design.id, 'withdrawn', `${info.by}-${info.at}`),
    description: `Withdrawn by ${info.by} at ${info.at}: ${info.reason}`,
    materiality: 'nonmaterial',
  }
  const next: ModuleDesignSpecification = {
    ...design,
    status: 'withdrawn',
    unresolvedItems: [...design.unresolvedItems, item],
  }
  return { ...next, contentHash: designContentHash(next) }
}

// ---------------------------------------------------------------------------
// Module queue and progress read model (§9.2, §16.5)
// ---------------------------------------------------------------------------

function topologicalOrder(architecture: ArchitectureSpecification): string[] {
  const moduleIds = architecture.moduleDefinitions?.length
    ? architecture.moduleDefinitions.map((definition) => definition.moduleId)
    : architecture.moduleIds
  const stableIds = stableSortStrings(moduleIds)
  const idSet = new Set(stableIds)
  const dependenciesOf = new Map<string, string[]>()
  for (const id of stableIds) dependenciesOf.set(id, [])
  for (const edge of architecture.dependencyEdges) {
    if (idSet.has(edge.fromModuleId) && idSet.has(edge.toModuleId)) {
      dependenciesOf.get(edge.fromModuleId)!.push(edge.toModuleId)
    }
  }
  const order: string[] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const visit = (id: string): void => {
    if (visited.has(id) || visiting.has(id)) return
    visiting.add(id)
    for (const dep of stableSortStrings(dependenciesOf.get(id) ?? [])) {
      visit(dep)
    }
    visiting.delete(id)
    visited.add(id)
    order.push(id)
  }
  for (const id of stableIds) visit(id)
  return order
}

function progressValidNextActions(state: ModuleDesignProgressEntry['state'], blockingIssueCount: number): string[] {
  switch (state) {
    case 'notStarted':
      return ['Create module draft']
    case 'draft':
      return ['Continue module design']
    case 'needsInput':
      return [`Answer ${blockingIssueCount} required question${blockingIssueCount === 1 ? '' : 's'}`]
    case 'readyForReview':
      return ['Run checks', 'Approve module']
    case 'approved':
      return ['Create implementation handoff', 'Reopen module']
    case 'stale':
      return ['Review upstream change']
    case 'blocked':
      return ['Resolve blocking issue']
    default:
      return []
  }
}

/** §16.5 — module queue and progress read model, combining architecture, designs, and sessions. */
export function computeModuleDesignProgress(
  architecture: ArchitectureSpecification,
  designs: ModuleDesignSpecification[],
  sessions: ModuleDesignSession[] = [],
  blockers: Record<string, string[]> = {},
): ModuleDesignProgress {
  const moduleDefs = architecture.moduleDefinitions?.length
    ? architecture.moduleDefinitions
    : architecture.moduleIds.map((moduleId) => ({
        moduleId,
        name: moduleId,
        moduleType: 'domain' as ModuleType,
        responsibility: '',
      }))
  const order = topologicalOrder(architecture)
  const orderIndex = new Map(order.map((id, index) => [id, index + 1]))
  const designByModule = new Map<string, ModuleDesignSpecification>()
  for (const design of designs) {
    const existing = designByModule.get(design.module.moduleId)
    if (!existing || compareRevisions(design.revision, existing.revision) > 0) {
      designByModule.set(design.module.moduleId, design)
    }
  }
  const sessionByModule = new Map(sessions.map((session) => [session.moduleId, session]))

  const modules: ModuleDesignProgressEntry[] = moduleDefs.map((definition) => {
    const design = designByModule.get(definition.moduleId)
    const directDependencyCount = architecture.dependencyEdges.filter((edge) => edge.fromModuleId === definition.moduleId).length
    const directConsumerCount = architecture.dependencyEdges.filter((edge) => edge.toModuleId === definition.moduleId).length
    const blockingIds = stableSortStrings(blockers[definition.moduleId] ?? [])
    const blockingIssueCount = blockingIds.length

    let state: ModuleDesignProgressEntry['state']
    if (!design) {
      state = 'notStarted'
    } else if (design.status === 'conflict' || design.status === 'withdrawn') {
      state = 'blocked'
    } else if (design.status === 'approved') {
      state = 'approved'
    } else if (design.status === 'stale') {
      state = 'stale'
    } else if (blockingIssueCount > 0) {
      state = 'blocked'
    } else if (design.status === 'superseded') {
      state = 'approved'
    } else {
      state = design.status
    }

    const session = sessionByModule.get(definition.moduleId)
    if (session && state !== 'approved' && state !== 'stale' && state !== 'blocked') {
      if (session.state === 'needsInput') state = 'needsInput'
      else if (session.state === 'readyForReview') state = 'readyForReview'
    }

    return {
      moduleId: definition.moduleId,
      name: design?.module.name ?? definition.name,
      moduleType: design?.module.moduleType ?? definition.moduleType,
      responsibility: design?.module.responsibility ?? definition.responsibility,
      state,
      owner: design?.module.owner,
      directDependencyCount,
      directConsumerCount,
      blockingIssueCount,
      changedUpstream: design?.status === 'stale',
      recommendedOrder: orderIndex.get(definition.moduleId) ?? order.length + 1,
      blockingIds,
      validNextActions: progressValidNextActions(state, blockingIssueCount),
    }
  })

  const counts = { notStarted: 0, draft: 0, needsInput: 0, readyForReview: 0, approved: 0, stale: 0, blocked: 0 }
  for (const entry of modules) counts[entry.state] += 1

  return {
    projectId: architecture.projectId,
    architectureRevision: architecture.revision,
    total: modules.length,
    ...counts,
    modules,
  }
}

export type ModuleQueueFilter =
  | 'all'
  | 'notStarted'
  | 'draft'
  | 'needsInput'
  | 'readyForReview'
  | 'approved'
  | 'stale'
  | 'old'
  | 'blocked'

/** §9.2 — module queue filters. `old` is an alias for the `stale` state. */
export function filterModuleQueue(progress: ModuleDesignProgress, filter: ModuleQueueFilter): ModuleDesignProgressEntry[] {
  if (filter === 'all') return progress.modules
  if (filter === 'old') return progress.modules.filter((entry) => entry.state === 'stale')
  return progress.modules.filter((entry) => entry.state === filter)
}

/**
 * §9.2 — default module selection: 1) the canvas selection, 2) the first
 * incomplete dependency, 3) the first incomplete module in stable sort
 * order, 4) the first approved module.
 */
export function selectDefaultModule(progress: ModuleDesignProgress, canvasSelectedId?: string): string | undefined {
  if (canvasSelectedId && progress.modules.some((entry) => entry.moduleId === canvasSelectedId)) {
    return canvasSelectedId
  }
  const isIncomplete = (entry: ModuleDesignProgressEntry) => entry.state !== 'approved'
  const incompleteDependencies = progress.modules
    .filter((entry) => entry.directConsumerCount > 0 && isIncomplete(entry))
    .sort((a, b) => a.recommendedOrder - b.recommendedOrder || a.moduleId.localeCompare(b.moduleId))
  if (incompleteDependencies[0]) return incompleteDependencies[0].moduleId

  const incompleteStable = [...progress.modules].filter(isIncomplete).sort((a, b) => a.moduleId.localeCompare(b.moduleId))
  if (incompleteStable[0]) return incompleteStable[0].moduleId

  const approved = [...progress.modules].filter((entry) => entry.state === 'approved').sort((a, b) => a.moduleId.localeCompare(b.moduleId))
  return approved[0]?.moduleId
}
