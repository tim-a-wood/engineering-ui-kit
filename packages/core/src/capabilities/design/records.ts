/**
 * Use-case-led Capabilities workflow — canonical record contracts.
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §5, §16.
 * These records are canonical; generated text, diagrams, prompts, and handoff
 * files are projections of them. Shared by EUC-01..EUC-17.
 *
 * Ownership: this file is the shared contract for the design workflow. Module
 * logic lives beside it in one file per internal module (EUC id).
 */

import type { ModuleType, NamedText, AcceptanceCase, OperationContract } from '../types.js'
import type { GateResult } from '../gates.js'

export type { GateResult }

/** §5.2 — states for draftable records. */
export const DESIGN_RECORD_STATES = [
  'notStarted',
  'draft',
  'needsInput',
  'readyForReview',
  'approved',
  'stale',
  'conflict',
  'superseded',
  'withdrawn',
] as const
export type DesignRecordState = (typeof DESIGN_RECORD_STATES)[number]

/** §5.2 — additional states for implementation work. */
export const IMPLEMENTATION_WORK_STATES = [
  'handoffCreated',
  'responseReturned',
  'inspected',
  'approvedToApply',
  'applied',
  'verified',
] as const
export type ImplementationWorkState = (typeof IMPLEMENTATION_WORK_STATES)[number]

/** §3.2 / §9.10 — an approval identifies the exact record revision and hash. */
export type DesignApproval = {
  approvedBy: string
  /** §4 role that authorizes this approval, e.g. "software-architect". */
  authority: string
  approvedAt: string
  recordId: string
  revision: string
  contentHash: string
  /** Upstream record hashes frozen with this approval. */
  sourceHashes?: Record<string, string>
  /** Open nonblocking item ids accepted at approval time. */
  openNonblockingItemIds?: string[]
}

/** §20.3 — immutable audit record of an operation and result. */
export type DesignAuditEvent = {
  eventId: string
  projectId: string
  actor: string
  /** Agent source when the change was imported from a provider (§4). */
  agentSource?: string
  operation: string
  targetRecordId?: string
  baseRevision?: string
  baseHash?: string
  resultRevision?: string
  resultHash?: string
  idempotencyKey?: string
  providerId?: string
  packetId?: string
  deltaId?: string
  approvalRef?: string
  at: string
  outcome: 'ok' | 'rejected' | 'error'
  diagnosticCodes: string[]
  evidenceRefs: string[]
}

export type DesignDiagnostic = {
  id: string
  code: string
  severity: 'blocker' | 'warning' | 'info'
  message: string
  relatedIds?: string[]
  /** Field path or step link so an error summary can link to the field (§18.4). */
  target?: string
}

/** §7.1 — item review status inside a use-case analysis (CAP-PLAN-010). */
export const ANALYSIS_ITEM_STATUSES = [
  'sourced',
  'inferred',
  'confirmed',
  'changed',
  'conflicting',
  'rejected',
] as const
export type AnalysisItemStatus = (typeof ANALYSIS_ITEM_STATUSES)[number]

export type AnalysisItem = {
  id: string
  text: string
  status: AnalysisItemStatus
  /** Source link when status is `sourced` (CAP-PLAN-012). */
  sourceRef?: string
}

export type AnalysisSource = {
  id: string
  name: string
  ref: string
  required: boolean
  readOnly: true
  status: 'ok' | 'failed'
  failureCause?: string
}

export type AnalysisQuestion = {
  id: string
  text: string
  material: boolean
  answer?: string
  answeredBy?: string
  answeredAt?: string
}

export type ScenarioStep = {
  /** Stable step id; scenario tests refer to it (§14.1). */
  id: string
  action: string
  expectedResult: string
  /** Whether the expected result is visible and needs screenshot evidence. */
  visibleResult: boolean
  screenshotNotApplicableReason?: string
}

export type UseCaseScenario = {
  id: string
  name: string
  kind: 'main' | 'alternate' | 'failure' | 'recovery'
  steps: ScenarioStep[]
}

/** §7.2 — required use-case content. */
export type UseCaseDefinition = {
  id: string
  name: string
  actors: string[]
  trigger: string
  /** Explicit UML «include» targets; preferred over step-text inference. */
  includesUseCaseIds?: string[]
  /** Explicit UML «extend» targets; preferred over step-text inference. */
  extendsUseCaseIds?: string[]
  preconditions: string[]
  mainFlow: ScenarioStep[]
  alternatePaths: UseCaseScenario[]
  failurePaths: UseCaseScenario[]
  recoveryBehavior: string
  rules: NamedText[]
  inputs: string[]
  outputs: string[]
  acceptanceChecks: AnalysisItem[]
  sourceLinks: string[]
  scenarios: UseCaseScenario[]
}

/** §5.1 — users, tasks, paths, rules, quality needs, and acceptance. */
export type UseCaseAnalysis = {
  schemaVersion: '1.0'
  projectId: string
  id: string
  revision: string
  status: DesignRecordState
  workDescription: string
  examples: string[]
  prohibitedResults: string[]
  actors: AnalysisItem[]
  useCases: UseCaseDefinition[]
  rules: AnalysisItem[]
  qualityNeeds: AnalysisItem[]
  sources: AnalysisSource[]
  questions: AnalysisQuestion[]
  gates: GateResult[]
  approval?: DesignApproval
  contentHash: string
}

export type OperationContractRef = {
  operationId: string
  version: string
  contentHash?: string
}

export type RequiredOperationRef = {
  operationId: string
  acceptedVersionRange: string
  providerModuleId?: string
  reason: string
}

export type ModuleSchemaRef = {
  schemaId: string
  version: string
  role: 'input' | 'output' | 'persistent'
  ref: string
}

export type StateTransitionDefinition = {
  id: string
  from: string
  to: string
  trigger: string
  guard?: string
  effect?: string
}

export type StateDefinition = {
  recordName: string
  states: string[]
  initialState: string
  finalStates: string[]
  transitions: StateTransitionDefinition[]
}

export type ActivityActionDefinition = {
  id: string
  kind: 'action' | 'decision' | 'merge' | 'initial' | 'final'
  label: string
  /** Outgoing edges; guards in square brackets for decisions (§15.1). */
  next: { targetId: string; guard?: string }[]
}

export type ActivityDefinition = {
  id: string
  name: string
  actions: ActivityActionDefinition[]
}

export type InteractionMessageDefinition = {
  id: string
  from: string
  to: string
  label: string
  kind: 'call' | 'reply'
  /** Combined-fragment operand this message belongs to, when any. */
  fragmentId?: string
}

export type InteractionDefinition = {
  id: string
  name: string
  lifelines: { id: string; label: string; kind: 'actor' | 'boundary' | 'control' | 'entity' | 'adapter' }[]
  fragments: { id: string; operator: 'alt' | 'opt' | 'loop'; operands: { id: string; guard: string }[] }[]
  messages: InteractionMessageDefinition[]
}

/** §16.2 */
export type ModuleBehaviorSpecification = {
  preconditions: string[]
  postconditions: string[]
  domainRejections: string[]
  technicalFailures: string[]
  sideEffects: string[]
  idempotency: string
  cancellation: string
  timeouts: string
  concurrency: string
  retry: string
  recovery: string
  emittedEvents: string[]
  consumedEvents: string[]
  states?: StateDefinition[]
  activities?: ActivityDefinition[]
  interactions?: InteractionDefinition[]
}

export type ModuleDataSpecification = {
  inputSchemas: ModuleSchemaRef[]
  outputSchemas: ModuleSchemaRef[]
  persistentRecords: ModuleSchemaRef[]
  dataOwnership: string
  retention: string
  migrationNeeds: string
  confidentiality: string
  provenanceFields: string[]
  canonicalUnits: NamedText[]
  canonicalEnumerations: NamedText[]
}

export type ModuleRuntimeSpecification = {
  configurationRefs: string[]
  secretReferenceIds: string[]
  lifecycleRegistration: string
  healthBehavior: string
  telemetry: string
  resourceOwnership: string
  startupBehavior: string
  shutdownBehavior: string
  compatibilityConstraints: string[]
}

export type ModuleVerificationSpecification = {
  examples: string[]
  edgeCases: string[]
  acceptanceCases: AcceptanceCase[]
  verificationSuiteIds: string[]
  requiredEvidence: string[]
  testDoubles: string[]
  fixtureNeeds: string[]
  configuredCommands: string[]
  unresolvedItems: string[]
}

export type DiagramProjectionRef = {
  diagramId: string
  kind: DiagramKind
  sourceRecordId: string
  sourceRevision: string
}

export type UnresolvedDesignItem = {
  id: string
  description: string
  materiality: 'material' | 'nonmaterial'
  resolvedAt?: string
}

/**
 * §9.6 — type-specific detail blocks. Exactly one block applies per module
 * type; the applicable block is required for readyForReview.
 */
export type ExperienceModuleDetail = {
  userRolesAndTasks: NamedText[]
  surfaces: NamedText[]
  informationHierarchy: string
  commandsAndNavigation: string[]
  viewStates: NamedText[]
  loadingBehavior: string
  emptyStates: string
  validationMessages: string
  permissionStates: string
  partialDataStates: string
  recoverableFailures: string
  unrecoverableFailures: string
  responsiveBehavior: string
  touchTargets: string
  keyboardBehavior: string
  focusOrderAndReturn: string
  screenReaderNamesAndStatus: string
  reducedMotionBehavior: string
  themeAndContrast: string
  approvedComponentSources: string[]
  inboundBindingIds: string[]
  scenarioScreenshotIds: string[]
}

export type WorkflowModuleDetail = {
  trigger: string
  orderedSteps: NamedText[]
  participants: string[]
  decisionsAndGuards: NamedText[]
  transactionBoundary: string
  partialCompletion: string
  compensation: string
  retryPolicy: string
  deduplication: string
  idempotencyKeyUse: string
  cancellationPoints: string[]
  deadlinePropagation: string
  resourceLocks: string[]
  progressReporting: string
  finalOutcomes: string[]
}

export type DomainModuleDetail = {
  domainVocabulary: NamedText[]
  valueObjects: NamedText[]
  consistencyBoundary: string
  invariants: string[]
  calculations: NamedText[]
  decisionTables: NamedText[]
  deterministicOrdering: string
  canonicalIdentityRules: string
  revisionComparison: string
  invalidStatePrevention: string
  operationPurity: { operationId: string; pure: boolean }[]
}

export type ConnectionModuleDetail = {
  externalActor: string
  implementedPortId: string
  supportedFormats: string[]
  inputDiscovery: string
  inputValidation: string
  canonicalMapping: string
  provenanceExtraction: string
  authenticationRef: string
  licenseOrSessionNeeds: string
  timeouts: string
  cancellation: string
  retrySafety: string
  partialReadBehavior: string
  corruptInputBehavior: string
  compatibilityErrors: string
  processIsolation: string
  cleanup: string
  representativeFixtures: string[]
}

export type PlatformModuleDetail = {
  storedOrScheduledResource: string
  ownershipAndAccess: string
  consistency: string
  transactionBehavior: string
  indexing: string
  retention: string
  backupAndRecovery: string
  capacity: string
  cleanup: string
  healthChecks: string
  failureInjection: string
  testImplementation: string
}

export type TypeSpecificDetail =
  | { moduleType: 'experience'; detail: ExperienceModuleDetail }
  | { moduleType: 'workflow'; detail: WorkflowModuleDetail }
  | { moduleType: 'domain'; detail: DomainModuleDetail }
  | { moduleType: 'connection'; detail: ConnectionModuleDetail }
  | { moduleType: 'platform'; detail: PlatformModuleDetail }

/** §16.1 — complete design for one module. */
export type ModuleDesignSpecification = {
  schemaVersion: '1.0'
  projectId: string
  id: string
  revision: string
  status: Exclude<DesignRecordState, 'notStarted'>

  architecture: {
    id: string
    revision: string
    contentHash: string
  }

  module: {
    moduleId: string
    moduleVersion: string
    name: string
    moduleType: ModuleType
    owner?: string
    responsibility: string
    nonResponsibilities: string[]
    ownedConcerns: string[]
    excludedConcerns: string[]
  }

  trace: {
    useCaseIds: string[]
    scenarioStepIds: string[]
    ruleIds: string[]
    qualityRequirementIds: string[]
    sourceRefs: string[]
    designDecisionIds: string[]
  }

  boundary: {
    directDependencyIds: string[]
    directConsumerIds: string[]
    deployableId: string
    runtimeAllocation: string
    runtimeLanguage: string
    ownedPaths: string[]
    editableSharedPaths: string[]
  }

  providedOperations: OperationContractRef[]
  requiredOperations: RequiredOperationRef[]
  schemas: ModuleSchemaRef[]
  rules: NamedText[]
  invariants: string[]
  behavior: ModuleBehaviorSpecification
  data: ModuleDataSpecification
  runtime: ModuleRuntimeSpecification
  verification: ModuleVerificationSpecification
  typeSpecific: TypeSpecificDetail
  diagrams: DiagramProjectionRef[]
  unresolvedItems: UnresolvedDesignItem[]
  gates: GateResult[]
  approval?: DesignApproval
  /** Fields populated by migration inference rather than a user (§23.1). */
  inferredFieldPaths?: string[]
  contentHash: string
}

export type DesignAnswer = {
  questionId: string
  step: ModuleDesignStep
  text: string
  answeredAt: string
}

export const MODULE_DESIGN_STEPS = [
  'boundary',
  'behavior',
  'contracts',
  'diagrams',
  'checks',
  'approval',
] as const
export type ModuleDesignStep = (typeof MODULE_DESIGN_STEPS)[number]

/** §16.3 — resumable six-step module-design session. */
export type ModuleDesignSession = {
  id: string
  projectId: string
  moduleId: string
  baseArchitectureRevision: string
  baseModuleDesignRevision?: string
  state:
    | 'created'
    | 'drafting'
    | 'needsInput'
    | 'readyForReview'
    | 'completed'
    | 'cancelled'
    | 'expired'
  currentStep: ModuleDesignStep
  /** Steps the user has completed at least once; earlier steps stay openable. */
  completedSteps: ModuleDesignStep[]
  sourceManifest: ContextManifest
  answers: DesignAnswer[]
  diagnostics: DesignDiagnostic[]
  createdAt: string
  updatedAt: string
}

/** §16.4 — deterministic context manifest. */
export type ContextManifestEntry = {
  kind: 'record' | 'contract' | 'schema' | 'source' | 'pattern' | 'test'
  ref: string
  contentHash: string
  bytes: number
  priority: number
  inclusionReason: string
}

export type ContextManifest = {
  id: string
  targetRecordId: string
  targetRevision: string
  tokenOrByteLimit: number
  totalBytes: number
  entries: ContextManifestEntry[]
  omitted: { ref: string; reason: string }[]
  contentHash: string
}

/** §16.5 — module queue read model. */
export type ModuleDesignProgressEntry = {
  moduleId: string
  name: string
  moduleType: ModuleType
  responsibility: string
  state: 'notStarted' | 'draft' | 'needsInput' | 'readyForReview' | 'approved' | 'stale' | 'blocked'
  owner?: string
  directDependencyCount: number
  directConsumerCount: number
  blockingIssueCount: number
  changedUpstream: boolean
  recommendedOrder: number
  blockingIds: string[]
  validNextActions: string[]
}

export type ModuleDesignProgress = {
  projectId: string
  architectureRevision: string
  total: number
  notStarted: number
  draft: number
  needsInput: number
  readyForReview: number
  approved: number
  stale: number
  blocked: number
  modules: ModuleDesignProgressEntry[]
}

/** §16.6 — approved set of one system structure and required module designs. */
export type DesignBaseline = {
  schemaVersion: '1.0'
  projectId: string
  id: string
  revision: string
  status: 'draft' | 'approved' | 'stale' | 'superseded'
  architecture: {
    id: string
    revision: string
    contentHash: string
  }
  modules: {
    moduleId: string
    designId: string
    revision: string
    contentHash: string
  }[]
  operationContracts: {
    operationId: string
    version: string
    contentHash: string
  }[]
  requiredModuleIds: string[]
  missingModuleIds: string[]
  gates: GateResult[]
  approval?: DesignApproval
  contentHash: string
}

/** §16.7 — project Design-to-Build gate mode. */
export type DesignWorkflowPolicy = {
  projectId: string
  mode: 'completeBaseline' | 'incrementalModules'
  approvedDecisionId?: string
  changedAt: string
  changedBy: string
}

/** §23.3 — project feature flag for the use-case-led workflow. */
export type DesignFeatureFlag = {
  projectId: string
  enabled: boolean
  changedAt: string
  changedBy: string
  /** Records are preserved when disabled; export remains possible. */
  exportedAt?: string
}

// ---------------------------------------------------------------------------
// Diagrams (EUC-08 / EUC-09)
// ---------------------------------------------------------------------------

export const DIAGRAM_KINDS = ['component', 'activity', 'stateMachine', 'sequence', 'useCase'] as const
export type DiagramKind = (typeof DIAGRAM_KINDS)[number]

export type UmlElement = {
  /** Stable element id derived from the source record (§25.3 EUC-08). */
  id: string
  kind:
    | 'component'
    | 'providedInterface'
    | 'requiredInterface'
    | 'actor'
    | 'useCase'
    | 'systemBoundary'
    | 'initialNode'
    | 'finalNode'
    | 'action'
    | 'decision'
    | 'merge'
    | 'state'
    | 'lifeline'
    | 'fragment'
  label: string
  sourceRecordId: string
  sourceElementRef?: string
  /** UML element type shown in the detail modal (§9.8). */
  umlType: string
  definition?: string
  traceLinks?: string[]
}

export type UmlRelationship = {
  id: string
  kind:
    | 'dependency'
    | 'provides'
    | 'requires'
    | 'transition'
    | 'controlFlow'
    | 'message'
    | 'reply'
    | 'include'
    | 'extend'
    | 'association'
  fromId: string
  toId: string
  label?: string
  guard?: string
  trigger?: string
  effect?: string
  sourceRecordId: string
}

/** §5.1 DiagramProjection — semantic projection of canonical records. */
export type DiagramProjection = {
  diagramId: string
  kind: DiagramKind
  title: string
  sourceRecordId: string
  sourceRevision: string
  sourceContentHash: string
  elements: UmlElement[]
  relationships: UmlRelationship[]
  /** UML 2.5.1 subset validation results (§15.1). */
  diagnostics: DesignDiagnostic[]
  /** Accessible text alternative: ordered relationship list (§15.2). */
  textAlternative: string[]
  contentHash: string
}

export type DiagramLayoutNode = {
  elementId: string
  x: number
  y: number
  width: number
  height: number
}

export type DiagramLayoutEdge = {
  relationshipId: string
  points: { x: number; y: number }[]
  labelPosition?: { x: number; y: number }
}

export type DiagramLayout = {
  diagramId: string
  viewportClass: 'wide' | 'narrow'
  seed: string
  nodes: DiagramLayoutNode[]
  edges: DiagramLayoutEdge[]
  /** Collision/clearance/crossing check output; a failure is a diagnostic, never a hidden relationship (§15.2). */
  diagnostics: DesignDiagnostic[]
  crossingCount: number
  contentHash: string
}

// ---------------------------------------------------------------------------
// Packets, deltas, impact (EUC-10 / EUC-11 / EUC-07)
// ---------------------------------------------------------------------------

/** §11.2 — one-module design handoff. */
export type ModuleDesignPacket = {
  schemaVersion: '1.0'
  packetId: string
  projectId: string
  moduleId: string
  moduleType: ModuleType
  architectureRevision: string
  architectureHash: string
  systemSlice: {
    moduleSummaries: { moduleId: string; name: string; responsibility: string }[]
    dependencyEdges: { fromModuleId: string; toModuleId: string; reason: string }[]
  }
  useCaseIds: string[]
  scenarioStepIds: string[]
  providerSummaries: { moduleId: string; operations: OperationContractRef[] }[]
  consumerSummaries: { moduleId: string; operations: RequiredOperationRef[] }[]
  projectRules: NamedText[]
  typeSpecificQuestions: NamedText[]
  contextManifest: ContextManifest
  existingPatterns: string[]
  missingDecisions: string[]
  expectedResponseSchemaRef: 'ModuleDesignSpecification@1.0'
  stableIdsToPreserve: string[]
  responseValidationRules: string[]
  /** The receiving agent must not approve the result (§11.2). */
  approvalProhibited: true
  idempotencyKey: string
  createdAt: string
  contentHash: string
}

/** §11.3 — immutable one-module implementation packet. */
export type ModuleImplementationPacket = {
  schemaVersion: '1.0'
  packetId: string
  projectId: string
  moduleId: string
  moduleVersion: string
  moduleDesignRevision: string
  moduleDesignHash: string
  architectureRevision: string
  architectureHash: string
  allowedPaths: string[]
  forbiddenPaths: string[]
  editableSharedPaths: string[]
  providedContracts: OperationContract[]
  requiredContracts: OperationContract[]
  canonicalSchemaRefs: string[]
  referenceProfileId?: string
  contextManifest: ContextManifest
  targetDeployableId: string
  implementationSteps: string[]
  acceptanceCases: AcceptanceCase[]
  testCommands: string[]
  requiredEvidence: string[]
  returnManifestSchemaRef: 'ReturnedDelta@1.0'
  idempotencyKey: string
  deadlineAt?: string
  cancellationInstructions: string
  /** §11.7 continuation kind for multi-pass work; first pass is `initial`. */
  passKind:
    | 'initial'
    | 'continueModule'
    | 'fixFailedChecks'
    | 'addMissingAcceptanceCase'
    | 'updateAfterContractChange'
    | 'prepareConnectionBinding'
    | 'addressReviewComments'
  previousPacketId?: string
  createdAt: string
  contentHash: string
}

export type ReturnedFileChange = {
  path: string
  action: 'create' | 'change' | 'delete'
  contentHash?: string
  /** File body for create/change; adapters may externalize to storage refs. */
  content?: string
}

/** §11.5 — returned delta from an external agent or provider. */
export type ReturnedDelta = {
  schemaVersion: '1.0'
  deltaId: string
  packetId: string
  baseRevision: string
  baseHash: string
  fileChanges: ReturnedFileChange[]
  recordChanges: { recordId: string; kind: string; summary: string; payload?: unknown }[]
  testResults: { command: string; passed: boolean; summary: string }[]
  assumptions: string[]
  unresolvedIssues: string[]
  requestedScopeChanges: string[]
  evidenceFiles: string[]
  returnedAt: string
  contentHash: string
}

export type DeltaRejectionReason =
  | 'unknown-packet'
  | 'stale-base'
  | 'path-outside-allowed'
  | 'unapproved-delete'
  | 'contract-change-without-impact'
  | 'missing-change-manifest'
  | 'checks-not-run'
  | 'path-traversal'
  | 'record-change-not-allowed'

/** §11.6 — inspection result shown before approve/apply. */
export type DeltaInspection = {
  inspectionId: string
  deltaId: string
  packetId: string
  /** Hash of the exact inspected content; only this hash may be applied. */
  inspectedContentHash: string
  workspaceRevisionAtInspection: string
  accepted: boolean
  rejectionReasons: DeltaRejectionReason[]
  fileSummary: { created: string[]; changed: string[]; deleted: string[] }
  recordChanges: { recordId: string; kind: string; summary: string }[]
  contractChanges: { operationId: string; fromVersion: string; toVersion: string; compatibility: string }[]
  affectedRequirementIds: string[]
  affectedUseCaseIds: string[]
  testResults: { command: string; passed: boolean; summary: string }[]
  newWarnings: string[]
  newDependencies: string[]
  outOfScopeAttempts: string[]
  generatedFiles: string[]
  userOwnedFiles: string[]
  rollbackPointRef: string
  inspectedAt: string
}

/** §12.2 — transactional apply plan and result. */
export type DeltaApplyPlan = {
  planId: string
  inspectionId: string
  deltaId: string
  expectedWorkspaceRevision: string
  expectedDeltaHash: string
  backupRef: string
  orderedChanges: ReturnedFileChange[]
  rollbackInstructions: string[]
}

export type DeltaApplyResult = {
  planId: string
  applied: boolean
  rolledBack: boolean
  appliedFiles: string[]
  failure?: string
  resultWorkspaceRevision?: string
  completedAt: string
}

/** §10.2 — impact categories a design change identifies. */
export type DesignImpactItem = {
  category:
    | 'useCase'
    | 'scenarioStep'
    | 'requirement'
    | 'module'
    | 'operationContract'
    | 'schema'
    | 'port'
    | 'adapter'
    | 'deployable'
    | 'diagram'
    | 'implementationPacket'
    | 'sourceOverlay'
    | 'generatedCode'
    | 'moduleTest'
    | 'connectionTest'
    | 'endToEndTest'
    | 'screenshotExpectation'
    | 'approval'
    | 'verificationRecord'
    | 'baseline'
    | 'migration'
    | 'documentation'
  targetId: string
  reason: string
  invalidation: 'projectionOnly' | 'review' | 'stale' | 'blocked' | 'none'
}

export type DesignChangeKind =
  | 'labelOnly'
  | 'responsibilityText'
  | 'operationBehavior'
  | 'schema'
  | 'dependency'
  | 'adapterAllocation'
  | 'deployableAllocation'
  | 'moduleSplitOrMerge'
  | 'useCaseStep'
  | 'screenshotExpectation'
  | 'ownedPath'
  | 'runtimeAllocation'
  | 'contract'
  | 'moduleType'
  | 'purpose'
  | 'rename'
  | 'portChange'

/** §10 — impact of one proposed or returned change. */
export type DesignImpactRecord = {
  schemaVersion: '1.0'
  impactId: string
  projectId: string
  initiatingRecordId: string
  initiatingRevision: string
  changeKind: DesignChangeKind
  description: string
  items: DesignImpactItem[]
  /** Ordered required-change plan (§10.4). */
  orderedChangePlan: { order: number; targetId: string; description: string }[]
  createdAt: string
  approval?: DesignApproval
  contentHash: string
}

/** §9.8 detail-modal discussion and proposed change. */
export type DiagramDiscussionEntry = {
  id: string
  elementId: string
  diagramId: string
  author: string
  kind: 'discussion' | 'proposedChange' | 'impactAnalysis' | 'approvedChangePlan'
  text: string
  impactRecordId?: string
  at: string
}

// ---------------------------------------------------------------------------
// Waves (§11.8)
// ---------------------------------------------------------------------------

export type ImplementationWavePlan = {
  projectId: string
  architectureRevision: string
  waves: {
    wave: number
    modules: {
      moduleId: string
      directDependencyIds: string[]
      allowedPaths: string[]
      sharedResources: string[]
      batchEligible: boolean
      blockingUnapprovedContracts: string[]
    }[]
    blockingCycles: string[][]
  }[]
  /** Waves are planning information; nothing dispatches automatically. */
  autoDispatch: false
}

// ---------------------------------------------------------------------------
// Scenario runs and evidence (§14)
// ---------------------------------------------------------------------------

export type ScenarioStepEvidence = {
  stepId: string
  action: string
  expectedResult: string
  actualResult: string
  startedAt: string
  endedAt: string
  outcome: 'passed' | 'failed' | 'skipped' | 'cancelled'
  screenshotRef?: string
  screenshotMetadata?: {
    browser?: string
    viewport?: string
    operatingSystem?: string
    theme?: string
    locale?: string
    build?: string
    environment?: string
    testDataRevision?: string
  }
  structuredEvidenceRef?: string
  screenshotNotApplicableReason?: string
  evidenceHash?: string
}

/** §5.1 / §14.3 — one immutable end-to-end scenario execution. */
export type ScenarioRun = {
  schemaVersion: '1.0'
  runId: string
  projectId: string
  scenarioId: string
  useCaseId: string
  identity: {
    useCaseAnalysisRevision: string
    applicationRevision: string
    systemStructureRevision: string
    moduleDesignRevisions: Record<string, string>
    implementationRevisions: Record<string, string>
    connectionRevision: string
    build: string
    sourceRevision: string
    environment: string
    testDataRevision: string
    runner: string
  }
  steps: ScenarioStepEvidence[]
  outcome: 'passed' | 'failed' | 'skipped' | 'cancelled'
  startedAt: string
  completedAt: string
  evidenceHashes: string[]
  contentHash: string
}

// ---------------------------------------------------------------------------
// Operations (§17)
// ---------------------------------------------------------------------------

export type ValidNextAction = {
  operation: string
  targetId?: string
  label: string
  enabled: boolean
  blockedReason?: string
}

/** §17.3 — uniform result of every change operation. */
export type DesignOperationResult<T = unknown> = {
  ok: boolean
  value?: T
  diagnostics: DesignDiagnostic[]
  revision?: string
  contentHash?: string
  auditEventId: string
  validNextActions: ValidNextAction[]
  /** First committed result returned again for an idempotent retry. */
  idempotentReplay?: boolean
}

/** Roles with approval authority (§4). */
export const APPROVAL_AUTHORITIES = [
  'product-lead',
  'software-architect',
  'module-owner',
  'interface-engineer',
  'integration-engineer',
  'verification-lead',
  'independent-reviewer',
  'project-administrator',
] as const
export type ApprovalAuthority = (typeof APPROVAL_AUTHORITIES)[number]

/** §4 — agents create drafts and changes; they hold no approval authority. */
export const AGENT_ACTOR_PREFIX = 'agent:'

export function isAgentActor(actor: string): boolean {
  return actor.startsWith(AGENT_ACTOR_PREFIX)
}
