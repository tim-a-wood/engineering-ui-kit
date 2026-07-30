/**
 * Capabilities MVP TypeScript contracts (CAP-CONTRACT-001–022).
 * CAP-PKT-001 — domain-neutral except adapter-specific 019/020.
 */

import type {
  BINDING_DATA_MODES,
  BINDING_TRIGGERS,
  CAPABILITY_RUN_KINDS,
  ERROR_CATEGORIES,
  FRESHNESS_STATES,
  IMPACT_CLASSIFICATIONS,
  JOB_STATES,
  MATLAB_SESSION_STATES,
  MODULE_TYPES,
  OPERATION_BEHAVIORS,
  RECORD_STATUSES,
  RESULT_OUTCOMES,
  RUNTIME_ALLOCATIONS,
  RUNTIME_LANGUAGES,
  DEPLOYABLE_KINDS,
  LIFECYCLE_KINDS,
  EXPOSURE_LEVELS,
  INBOUND_BINDING_KINDS,
  UI_TRANSPORT_KINDS,
  HTTP_METHODS,
  OVERLAP_POLICIES,
  MISFIRE_POLICIES,
  PROPOSED_LOCATION_APPROVAL_STATUSES,
  CLEAN_STATES,
  FILE_CHANGE_ACTIONS,
  GENERATED_CLASSIFICATIONS,
  EXTERNAL_EVIDENCE_STATUSES,
  CONNECTION_VERIFICATION_STATUSES,
  MATERIALITY_LEVELS,
} from './parity.js'
import type { PersistedWorkLifecycleState } from '../workTypes.js'
import type { WorkTargetKind } from '../workTypes.js'

export type ModuleType = (typeof MODULE_TYPES)[number]
export type RuntimeAllocation = (typeof RUNTIME_ALLOCATIONS)[number]
export type OperationBehavior = (typeof OPERATION_BEHAVIORS)[number]
export type ResultOutcome = (typeof RESULT_OUTCOMES)[number]
export type ErrorCategory = (typeof ERROR_CATEGORIES)[number]
export type JobState = (typeof JOB_STATES)[number]
export type FreshnessState = (typeof FRESHNESS_STATES)[number]
export type BindingTrigger = (typeof BINDING_TRIGGERS)[number]
export type BindingDataMode = (typeof BINDING_DATA_MODES)[number]
export type ImpactClassification = (typeof IMPACT_CLASSIFICATIONS)[number]
export type MatlabSessionState = (typeof MATLAB_SESSION_STATES)[number]
export type RecordStatus = (typeof RECORD_STATUSES)[number]
export type CapabilityRunKind = (typeof CAPABILITY_RUN_KINDS)[number]
export type RuntimeLanguage = (typeof RUNTIME_LANGUAGES)[number]
export type DeployableKind = (typeof DEPLOYABLE_KINDS)[number]
export type LifecycleKind = (typeof LIFECYCLE_KINDS)[number]
export type ExposureLevel = (typeof EXPOSURE_LEVELS)[number]
export type InboundBindingKind = (typeof INBOUND_BINDING_KINDS)[number]
export type UiTransportKind = (typeof UI_TRANSPORT_KINDS)[number]
export type HttpMethod = (typeof HTTP_METHODS)[number]
export type OverlapPolicy = (typeof OVERLAP_POLICIES)[number]
export type MisfirePolicy = (typeof MISFIRE_POLICIES)[number]
export type ProposedLocationApprovalStatus = (typeof PROPOSED_LOCATION_APPROVAL_STATUSES)[number]
export type CleanState = (typeof CLEAN_STATES)[number]
export type FileChangeAction = (typeof FILE_CHANGE_ACTIONS)[number]
export type GeneratedClassification = (typeof GENERATED_CLASSIFICATIONS)[number]
export type ExternalEvidenceStatus = (typeof EXTERNAL_EVIDENCE_STATUSES)[number]
export type ConnectionVerificationStatus = (typeof CONNECTION_VERIFICATION_STATUSES)[number]
export type MaterialityLevel = (typeof MATERIALITY_LEVELS)[number]

export type Provenance = {
  source: string
  recordedAt: string
  actor?: string
  refs?: string[]
}

export type Diagnostic = {
  id: string
  code: string
  message: string
  relatedIds?: string[]
}

export type NamedText = { id: string; text: string }
export type AcceptanceCase = {
  id: string
  description: string
  expectedOutcome: string
  kind?: 'example' | 'failure'
}

export type UseCasePathKind = 'main' | 'alternate' | 'failure' | 'recovery'
export type ScenarioEvidencePolicy = 'screenshot' | 'structured' | 'either' | 'not-applicable'
export type ScenarioOutcome = 'passed' | 'failed' | 'skipped' | 'cancelled' | 'unverified'

/** One stable, allocatable step in an approved use-case path. */
export type UseCaseStepDefinition = {
  id: string
  order: number
  actorId?: string
  action: string
  expectedResult: string
  inputIds: string[]
  outputIds: string[]
  ruleIds: string[]
  evidencePolicy: ScenarioEvidencePolicy
}

export type UseCasePathDefinition = {
  id: string
  name: string
  kind: UseCasePathKind
  trigger?: string
  preconditions: string[]
  steps: UseCaseStepDefinition[]
  outcome: string
}

/**
 * Detailed use-case analysis. `ApplicationSpecification.useCases` remains the
 * compact compatibility index; these records are the authoritative analysis
 * used by architecture, module design, UML, and scenario verification.
 */
export type UseCaseDefinition = {
  id: string
  name: string
  actorIds: string[]
  trigger: string
  preconditions: string[]
  mainFlow: UseCaseStepDefinition[]
  alternatePaths: UseCasePathDefinition[]
  failurePaths: UseCasePathDefinition[]
  recoveryPaths: UseCasePathDefinition[]
  ruleIds: string[]
  inputIds: string[]
  outputIds: string[]
  acceptanceCaseIds: string[]
  sourceRefs: string[]
}

/**
 * Renderer-neutral behavior graph. Application workflows and module activities
 * wrap this shared structure, but they remain separate approval authorities.
 */
export type ActivityNodeKind =
  | 'initial'
  | 'action'
  | 'call-operation'
  | 'decision'
  | 'merge'
  | 'fork'
  | 'join'
  | 'send-event'
  | 'receive-event'
  | 'final'

export type ActivityNode = {
  id: string
  kind: ActivityNodeKind
  label: string
  description: string
  refinesIds: string[]
  actorId?: string
  operationId?: string
  eventId?: string
}

export type ActivityEdge = {
  id: string
  fromNodeId: string
  toNodeId: string
  guard?: string
  outcome?: 'success' | 'alternate' | 'failure' | 'recovery'
  loop?: {
    exitCondition: string
    maximumIterations?: number
  }
  traceIds: string[]
}

export type ActivityGraph = {
  id: string
  name: string
  nodes: ActivityNode[]
  edges: ActivityEdge[]
}

/** Observable application behavior that refines one approved use case. */
export type ApplicationWorkflowDefinition = {
  id: string
  useCaseId: string
  name: string
  graph: ActivityGraph
  pathIds: string[]
  acceptanceCaseIds: string[]
  sourceRefs: string[]
}

/** Executable scenario definition compiled from one approved use-case path. */
export type ScenarioDefinition = {
  id: string
  useCaseId: string
  pathId: string
  workflowId?: string
  workflowNodeIds?: string[]
  name: string
  kind: UseCasePathKind
  stepIds: string[]
  tags: string[]
  requiredEvidence: ScenarioEvidencePolicy
  testCommand?: string
}

/** CAP-CONTRACT-001 */
export type ApplicationSpecification = {
  schemaVersion: '1.0'
  projectId: string
  id: string
  revision: string
  status: RecordStatus
  purpose: string
  outcomes: string[]
  actors: NamedText[]
  goals: NamedText[]
  useCases: NamedText[]
  scenarios: NamedText[]
  /** Rich, record-driven workflow fields; optional for 1.0 workspace compatibility. */
  useCaseDefinitions?: UseCaseDefinition[]
  applicationWorkflows?: ApplicationWorkflowDefinition[]
  scenarioDefinitions?: ScenarioDefinition[]
  information: NamedText[]
  rules: NamedText[]
  externalSystems: NamedText[]
  constraints: NamedText[]
  scope: { inScope: string[]; outOfScope: string[] }
  acceptanceCases: AcceptanceCase[]
  sources: NamedText[]
  unresolvedQuestions: NamedText[]
  approvedAt?: string
  approvedBy?: string
  contentHash: string
}

export type DependencyEdge = {
  fromModuleId: string
  toModuleId: string
  reason: string
}

export type ArchitectureModuleDefinition = {
  moduleId: string
  name: string
  moduleType: ModuleType
  responsibility: string
}

/** One explicit allocation from an application workflow node to the solution. */
export type WorkflowNodeAllocation = {
  workflowId: string
  nodeId: string
  primaryModuleId: string
  participatingModuleIds: string[]
  entryPointId?: string
  operationId?: string
  outputId?: string
  eventId?: string
}

/** CAP-CONTRACT-002 */
export type ArchitectureSpecification = {
  schemaVersion: '1.0'
  projectId: string
  id: string
  revision: string
  status: RecordStatus
  applicationSpecId: string
  applicationSpecRevision: string
  applicationSpecHash: string
  capabilityProjections: { id: string; name: string; moduleIds: string[] }[]
  moduleIds: string[]
  /** Design-time identity and classification, assigned by the architecture interview. */
  moduleDefinitions?: ArchitectureModuleDefinition[]
  dependencyEdges: DependencyEdge[]
  operationAllocations: { operationId: string; moduleId: string }[]
  adapterAllocations: { adapterId: string; moduleId: string; portId: string }[]
  workflowTraces: {
    useCaseId: string
    moduleIds: string[]
    entryPointId?: string
    outputId?: string
    nodeAllocations?: WorkflowNodeAllocation[]
    /** @deprecated Read only. New approvals use nodeAllocations. */
    stepAllocations?: { stepId: string; moduleId: string }[]
  }[]
  proposals: NamedText[]
  unresolvedQuestions: NamedText[]
  gateResult: { gateId: string; passed: boolean; diagnostics: Diagnostic[] }
  approvedAt?: string
  approvedBy?: string
  contentHash: string
}

/** CAP-CONTRACT-003 */
export type ModuleManifest = {
  schemaVersion: '1.0'
  architectureVersion: '1.0'
  moduleId: string
  moduleVersion: string
  moduleType: ModuleType
  name: string
  responsibility: string
  ownedConcerns: string[]
  excludedConcerns: string[]
  providedOperations: { operationId: string; contractVersion: string }[]
  requiredOperations: {
    operationId: string
    acceptedContractRange: string
    reason: string
  }[]
  configurationSchemaRef?: string | null
  verificationSuiteIds: string[]
  runtimeAllocation: RuntimeAllocation
  events: string[]
  ownedPaths: string[]
}

export type DiagramKind = 'component' | 'activity' | 'state-machine' | 'sequence' | 'use-case'
export type DiagramNodeKind =
  | 'actor'
  | 'component'
  | 'port'
  | 'provided-interface'
  | 'required-interface'
  | 'initial'
  | 'final'
  | 'action'
  | 'call-operation'
  | 'decision'
  | 'merge'
  | 'fork'
  | 'join'
  | 'send-event'
  | 'receive-event'
  | 'swimlane'
  | 'state'
  | 'lifeline'
  | 'activation'
  | 'fragment'
  | 'system-boundary'
  | 'use-case'
export type DiagramEdgeKind =
  | 'association'
  | 'dependency'
  | 'assembly'
  | 'control-flow'
  | 'transition'
  | 'synchronous-message'
  | 'reply-message'
  | 'include'
  | 'extend'

export type DiagramProjectionNode = {
  id: string
  kind: DiagramNodeKind
  label: string
  description: string
  sourceRecordId: string
  traceIds: string[]
  parentId?: string
  stereotype?: string
  details?: string[]
}

export type DiagramProjectionEdge = {
  id: string
  kind: DiagramEdgeKind
  fromId: string
  toId: string
  label?: string
  /** A canonical condition that the renderer places beside this connector. */
  guard?: string
  /** A canonical activity outcome used for semantic connector styling. */
  outcome?: ActivityEdge['outcome']
  /** True when the canonical activity edge repeats a bounded flow. */
  isLoop?: boolean
  description: string
  sourceRecordId: string
  traceIds: string[]
}

/** Renderer-neutral UML projection derived from canonical records. */
export type DiagramProjection = {
  schemaVersion: '1.0'
  id: string
  kind: DiagramKind
  projectId: string
  contextId: string
  title: string
  sourceRevision: string
  /** Behavior level for the diagram. Legacy projections can omit this field. */
  level?: 'application' | 'allocation' | 'module'
  /** Canonical records that supplied the projection semantics. */
  sourceRecordIds?: string[]
  nodes: DiagramProjectionNode[]
  edges: DiagramProjectionEdge[]
  diagnostics: Diagnostic[]
  textAlternative: string
  contentHash: string
}

export type ModuleDesignState =
  | 'draft'
  | 'needsInput'
  | 'readyForReview'
  | 'approved'
  | 'stale'
  | 'conflict'
  | 'superseded'
  | 'withdrawn'

export type ModuleDesignStep = 'boundary' | 'behavior' | 'contracts' | 'diagrams' | 'checks' | 'approval'

export type ModuleActivityDefinition = {
  id: string
  name: string
  entryOperationId?: string
  refinesWorkflowNodeIds: string[]
  graph: ActivityGraph
}

export type ModuleStateDefinition = {
  id: string
  name: string
  parentStateId?: string
  entryActionIds: string[]
  exitActionIds: string[]
}

export type ModuleStateTransition = {
  id: string
  fromStateId: string
  toStateId: string
  trigger: string
  guard?: string
  effectActivityNodeIds: string[]
}

export type ModuleInteractionParticipant = {
  id: string
  label: string
  kind: 'actor' | 'module' | 'operation' | 'external'
}

export type ModuleInteractionMessage = {
  id: string
  fromParticipantId: string
  toParticipantId: string
  label: string
  kind: 'synchronous' | 'reply' | 'event'
  operationId?: string
  eventId?: string
  guard?: string
  refinesActivityNodeIds: string[]
}

export type ModuleInteractionFragment = {
  id: string
  kind: 'alt' | 'opt' | 'loop'
  label: string
  guard?: string
  messageIds: string[]
}

export type ModuleInteractionDefinition = {
  id: string
  name: string
  participants: ModuleInteractionParticipant[]
  messages: ModuleInteractionMessage[]
  fragments?: ModuleInteractionFragment[]
}

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
  stateDefinitions?: ModuleStateDefinition[]
  stateTransitions?: ModuleStateTransition[]
  activityDefinitions?: ModuleActivityDefinition[]
  interactionDefinitions?: ModuleInteractionDefinition[]
  /** @deprecated Read only. New approvals use stateDefinitions. */
  states: NamedText[]
  /** @deprecated Read only. New approvals use activityDefinitions. */
  activities: NamedText[]
  /** @deprecated Read only. New approvals use interactionDefinitions. */
  interactions: NamedText[]
}

export type ModuleDesignSpecification = {
  schemaVersion: '1.0'
  projectId: string
  id: string
  revision: string
  status: ModuleDesignState
  architecture: { id: string; revision: string; contentHash: string }
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
    workflowNodeIds?: string[]
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
    runtimeAllocation: RuntimeAllocation
    runtimeLanguage: RuntimeLanguage
    ownedPaths: string[]
    editableSharedPaths: string[]
  }
  providedOperations: { operationId: string; contractVersion: string }[]
  requiredOperations: { operationId: string; acceptedContractRange: string; reason: string }[]
  schemas: NamedText[]
  rules: NamedText[]
  invariants: string[]
  behavior: ModuleBehaviorSpecification
  data: {
    persistentRecords: NamedText[]
    ownership: string[]
    retention: string[]
    migrationNeeds: string[]
    confidentiality: string
    provenanceFields: string[]
    canonicalUnits: string[]
  }
  runtime: {
    configurationRefs: string[]
    secretRefs: string[]
    lifecycleRegistration: string
    health: string[]
    telemetry: string[]
    resourceOwnership: string[]
    startup: string[]
    shutdown: string[]
    compatibilityConstraints: string[]
  }
  verification: {
    examples: string[]
    edgeCases: string[]
    acceptanceCaseIds: string[]
    verificationSuiteIds: string[]
    requiredEvidence: ScenarioEvidencePolicy[]
    testDoubles: string[]
    fixtureNeeds: string[]
    commands: string[]
  }
  diagrams: DiagramProjection[]
  unresolvedItems: { id: string; description: string; materiality: MaterialityLevel }[]
  gates: { gateId: string; passed: boolean; diagnostics: Diagnostic[] }[]
  approval?: {
    approvedAt: string
    approvedBy?: string
    authority?: string
    sourceHashes: Record<string, string>
    openNonblockingItemIds: string[]
  }
  contentHash: string
}

export type ContextManifest = {
  id: string
  targetRecordId: string
  targetRevision: string
  tokenOrByteLimit: number
  totalBytes: number
  entries: {
    kind: 'record' | 'contract' | 'schema' | 'source' | 'pattern' | 'test'
    ref: string
    contentHash: string
    bytes: number
    priority: number
    inclusionReason: string
  }[]
  omitted: { ref: string; reason: string }[]
  contentHash: string
}

export type ModuleDesignSession = {
  schemaVersion: '1.0'
  id: string
  projectId: string
  moduleId: string
  baseArchitectureRevision: string
  baseModuleDesignRevision?: string
  state: 'created' | 'drafting' | 'needsInput' | 'readyForReview' | 'completed' | 'cancelled' | 'expired'
  currentStep: ModuleDesignStep
  completedSteps: ModuleDesignStep[]
  sourceManifest: ContextManifest
  answers: { id: string; question: string; answer: string; sourceRefs: string[] }[]
  diagnostics: Diagnostic[]
  createdAt: string
  updatedAt: string
}

export type ScenarioStepEvidence = {
  kind: 'screenshot' | 'structured' | 'not-applicable'
  artifactId?: string
  reason?: string
}

export type ScenarioStepResult = {
  scenarioStepId: string
  action: string
  expectedResult: string
  actualResult: string
  startedAt: string
  completedAt: string
  outcome: ScenarioOutcome
  evidence: ScenarioStepEvidence[]
}

export type ScenarioRunRecord = {
  schemaVersion: '1.0'
  runId: string
  projectId: string
  scenarioId: string
  useCaseId: string
  kind: UseCasePathKind
  outcome: ScenarioOutcome
  identity: {
    useCaseAnalysisRevision: string
    applicationRevision: string
    architectureRevision: string
    moduleDesignRevisions: Record<string, string>
    implementationRevisions: Record<string, string>
    connectionRevision?: string
    build: string
    sourceRevision: string
    environment: string
    testDataRevision: string
    runner: string
  }
  steps: ScenarioStepResult[]
  evidenceHashes: Record<string, string>
  startedAt: string
  completedAt?: string
  contentHash: string
}

/** Persisted module read model used by desktop and renderer projections. */
export type CapabilityModuleRecord = {
  moduleId: string
  draft?: ModuleManifest
  approved?: ModuleManifest
  freshness?: FreshnessRecord
}

/** CAP-CONTRACT-004 */
export type OperationContract = {
  schemaVersion: '1.0'
  operationId: string
  version: string
  behavior: OperationBehavior
  inputSchemaRef: string
  outputSchemaRef: string
  preconditions: string[]
  postconditions: string[]
  domainRejections: string[]
  technicalErrors: string[]
  sideEffects: string[]
  idempotency: 'idempotent' | 'non-idempotent' | 'unknown'
  timeoutClass: 'short' | 'medium' | 'long'
  cancellable: boolean
  artifactTypes: string[]
  provenanceFields: string[]
}

/** CAP-CONTRACT-005 */
export type ResultEnvelope = {
  schemaVersion: '1.0'
  outcome: ResultOutcome
  diagnostics: Diagnostic[]
  artifacts: string[]
  provenance: Provenance
  value?: unknown
  rejection?: { code: string; message: string }
  error?: ErrorRecord
}

/** CAP-CONTRACT-006 */
export type ErrorRecord = {
  schemaVersion: '1.0'
  code: string
  category: ErrorCategory
  safeMessage: string
  retryability: 'none' | 'immediate' | 'delayed' | 'manual'
  relatedIds: string[]
  diagnosticRefs: string[]
}

/** CAP-CONTRACT-007 */
export type JobRecord = {
  schemaVersion: '1.0'
  jobId: string
  projectId: string
  operationId: string
  operationVersion: string
  inputHash: string
  state: JobState
  progress?: { ratio?: number; message?: string }
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
  cancellationRequested?: boolean
  resultRef?: string
  diagnostics: Diagnostic[]
  artifactRefs: string[]
}

/** CAP-CONTRACT-008 */
export type ArtifactReference = {
  schemaVersion: '1.0'
  artifactId: string
  projectId: string
  mediaType: string
  checksum: string
  byteSize: number
  createdAt: string
  producingOperationId?: string
  producingJobId?: string
  producingRunId?: string
  provenance: Provenance
  storageClass: 'app-managed' | 'project-relative' | 'ephemeral'
  opaqueStorageRef: string
}

/** CAP-CONTRACT-009 */
export type ConfigurationRecord = {
  schemaVersion: '1.0'
  kind: 'configuration'
  id: string
  projectId: string
  scope: 'project' | 'module' | 'adapter'
  scopeOwnerId?: string
  nonSecretValues: Record<string, unknown>
  secretReferenceIds: string[]
  readiness?: { ready: boolean; diagnostics: Diagnostic[] }
  revision: string
  contentHash: string
}

export type SecretReference = {
  schemaVersion: '1.0'
  kind: 'secret-reference'
  opaqueId: string
  providerKind: string
  label: string
  createdAt: string
  lastValidatedAt?: string
}

export type ConfigurationAndSecretReference = ConfigurationRecord | SecretReference

/** CAP-CONTRACT-010 — extension point; no MVP event bus. */
export type EventEnvelope = {
  schemaVersion: '1.0'
  eventId: string
  eventType: string
  eventVersion: string
  moduleId: string
  projectId: string
  occurredAt: string
  correlationId?: string
  causationId?: string
  payloadSchemaRef: string
  payload: unknown
  provenance: Provenance
}

/** CAP-CONTRACT-011 — derived registry entry. */
export type RegistryEntry = {
  schemaVersion: '1.0'
  moduleId: string
  moduleVersion: string
  operationId?: string
  compatibleContractVersions: string[]
  runtimeAllocation: RuntimeAllocation
  configReady: boolean
  verificationState: string
  freshnessState: FreshnessState
  evidenceRefs: string[]
}

/** CAP-CONTRACT-012 */
export type FreshnessRecord = {
  schemaVersion: '1.0'
  moduleId: string
  moduleVersion: string
  hashes: {
    specification: string
    implementation: string
    architecture: string
    dependencies: string
    adapters: string
    bindings: string
    verificationSuites: string
  }
  verificationEvidenceId?: string
  evaluatedAt: string
  primaryState: FreshnessState
  reasonCodes: string[]
}

export type SelectionEvidence = {
  route: string
  documentTitle: string
  selector: string
  visibleText: string
  elementTag: string
  role?: string
  name?: string
  stableMarker?: string
  captureTime: string
  sourceTargetConfirmed?: boolean
  proposedSourceTarget?: string
}

/** CAP-CONTRACT-013 */
export type FrontendBinding = {
  schemaVersion: '1.0'
  bindingId: string
  version: string
  projectId: string
  selectionEvidence: SelectionEvidence
  trigger: BindingTrigger
  operationId: string
  operationVersion: string
  inputMappings: { from: string; to: string }[]
  outputMappings: { from: string; to: string }[]
  loadingBehavior: string
  validationBehavior: string
  domainRejectionBehavior: string
  technicalFailureBehavior: string
  cancellationBehavior: string
  duplicateSubmissionBehavior: string
  dataMode: BindingDataMode
}

export type CapabilityBindingRecord = {
  bindingId: string
  draft?: FrontendBinding
  approved?: FrontendBinding
}

/** CAP-CONTRACT-014 */
export type InterviewPacket = {
  schemaVersion: '1.0'
  packetId: string
  packetVersion: string
  projectId: string
  interviewKind: string
  generatedAt: string
  inputContext: {
    recordIds: string[]
    revisions: string[]
    hashes: string[]
    facts: string[]
    glossary: NamedText[]
  }
  interviewBoundary: string
  stateLabels: { confirmed: string[]; proposed: string[]; unresolved: string[] }
  outputSchemaRef: string
  outputFileName: string
  gateId: string
  safetyNotes: string[]
}

/** CAP-CONTRACT-015 */
export type ImplementationPacket = {
  schemaVersion: '1.0'
  packetId: string
  packetVersion: string
  projectId: string
  targetKind: 'module' | 'connection'
  targetId: string
  inputHashes: Record<string, string>
  architectureVersion: string
  architectureHash: string
  allowedPaths: string[]
  expectedPaths: string[]
  protectedPaths: string[]
  excludedPaths: string[]
  requiredTests: string[]
  acceptanceCases: AcceptanceCase[]
  unchangedBehavior: string[]
  requiredOutput: 'ui-overlay.zip'
}

/** CAP-CONTRACT-016 */
export type DeltaPacket = ImplementationPacket & {
  changeReason: string
  impactRecordId: string
  previousContractVersions: Record<string, string>
  targetContractVersions: Record<string, string>
  preserveBehavior: string[]
  addBehavior: string[]
  changeBehavior: string[]
  newTests: string[]
  unchangedModuleIds: string[]
}

/** CAP-CONTRACT-017 */
export type VerificationRecord = {
  schemaVersion: '1.0'
  verificationId: string
  projectId: string
  moduleId?: string
  connectionId?: string
  suiteIds: string[]
  suiteVersions: string[]
  suiteHashes: string[]
  inputHashes: Record<string, string>
  commandResults: {
    label: string
    exitCode: number
    passed: boolean
    outputSummary?: string
  }[]
  artifacts: string[]
  diagnostics: Diagnostic[]
  startedAt: string
  completedAt: string
  outcome:
    | 'passed'
    | 'failed-setup'
    | 'failed-domain'
    | 'failed-technical'
    | 'cancelled'
    | 'unverified'
}

/** CAP-CONTRACT-018 */
export type AdapterConfiguration = {
  schemaVersion: '1.0'
  adapterId: string
  adapterContractVersion: string
  projectId: string
  nonSecretSettings: Record<string, unknown>
  secretReferenceIds: string[]
  permissionSummary: string[]
  readinessResult: { ready: boolean; diagnostics: Diagnostic[] }
  revision: string
  contentHash: string
}

/** CAP-CONTRACT-019 — adapter-specific */
export type MatlabSessionRecord = {
  schemaVersion: '1.0'
  projectId: string
  sessionId: string
  state: MatlabSessionState
  matlabVersion?: string
  toolboxReadiness: { name: string; ready: boolean }[]
  processOwnership: 'app-owned'
  startedAt?: string
  lastUsedAt?: string
  initRecipeRevision?: string
  inMemoryStateRevision?: string
  currentJobId?: string
  lastDiagnosticId?: string
}

/** CAP-CONTRACT-020 — adapter-specific */
export type AzureDevOpsProvenance = {
  schemaVersion: '1.0'
  organization: string
  project: string
  externalType: string
  externalId: string
  revision: string
  url?: string
  retrievedAt: string
  contentHash: string
  fieldMapping?: Record<string, string>
  sourceAdapterVersion: string
  pipelineRunId?: string
  testRunId?: string
  artifactId?: string
}

export type CapabilityRunTransition = {
  at: string
  actor: string
  fromState: PersistedWorkLifecycleState
  toState: PersistedWorkLifecycleState
  sourceRevision?: string
  resultRevision?: string
  evidenceIds?: string[]
}

/** CAP-CONTRACT-021 */
export type CapabilityRunScope = {
  schemaVersion: '1.0'
  runId: string
  kind: CapabilityRunKind
  projectId: string
  targetOwnerId: string
  /** Explicit target classification; legacy records are classified on read. */
  targetKind?: WorkTargetKind
  lifecycleState: PersistedWorkLifecycleState
  /** Optional cross-workflow lineage added by the unified project work model. */
  parentRunId?: string
  supersedesRunId?: string
  changeReason?: string
  inputRevisions: Record<string, string>
  inputHashes: Record<string, string>
  allowedPaths: string[]
  expectedPaths: string[]
  protectedPaths: string[]
  packetRefs: string[]
  artifactRefs: string[]
  inspectionRef?: string
  applicationRef?: string
  verificationRef?: string
  transitionHistory: CapabilityRunTransition[]
  createdAt: string
  updatedAt: string
  completedAt?: string
}

/** CAP-CONTRACT-022 */
export type ImpactRecord = {
  schemaVersion: '1.0'
  changeId: string
  initiatingRecordId: string
  initiatingRevision: string
  classification: ImpactClassification
  affectedModules: { moduleId: string; reason: string }[]
  unaffectedModules: { moduleId: string; reason: string }[]
  proposedPacketOrder: string[]
  userApproval?: { approved: boolean; at?: string; by?: string }
  recalculationEvidence: string[]
}

/** CAP-CONTRACT-023 — immutable reference-architecture profile. */
export type ReferenceArchitectureProfile = {
  schemaVersion: '1.0'
  profileId: string
  profileVersion: string
  supportedRuntimeLanguages: { language: RuntimeLanguage; versionRange: string }[]
  supportedHostKinds: DeployableKind[]
  contractFormat: string
  httpContractFormat: string
  generatedDirectoryPolicy: string[]
  editableDirectoryPolicy: string[]
  runtimePackageCoordinates: {
    language: RuntimeLanguage
    packageName: string
    version: string
    pinnedVersionPolicy: string
  }[]
  lifecyclePolicy: string
  telemetryPolicy: string
  secretPolicy: string
  authorizationPolicy: string
  persistencePolicy: string
  errorPolicy: string
  generatorVersion: string
  generatorCompatibilityRange: string
  contentHash: string
}

/** CAP-CONTRACT-024 — one executable/library deployable. */
export type ProposedLocation = {
  path: string
  evidence: string
  approvalStatus: ProposedLocationApprovalStatus
}
export type DeployableSpecification = {
  schemaVersion: '1.0'
  deployableId: string
  name: string
  kind: DeployableKind
  runtimeLanguage: RuntimeLanguage
  runtimeVersionRange: string
  moduleIds: string[]
  inboundBindingIds: string[]
  compositionRootPath: string
  commands: {
    build?: string
    test?: string
    launch?: string
    health?: string
    shutdown?: string
  }
  configurationRefs: string[]
  secretReferenceIds: string[]
  proposedLocations: ProposedLocation[]
}

/** CAP-CONTRACT-025 — deterministic generation plan. */
export type GenerationDependencyChange = {
  packageName: string
  language: RuntimeLanguage
  toVersion: string
  fromVersion?: string
  reason: string
}
export type GenerationFileChange = {
  path: string
  action: FileChangeAction
  ownership: GeneratedClassification
  reason: string
  preimageHash?: string
  postimageHash?: string
}
export type GenerationPlan = {
  schemaVersion: '1.0'
  planId: string
  projectId: string
  inputRecords: { recordId: string; revision: string; hash: string }[]
  generatorVersion: string
  referenceProfileVersion: string
  targetRepository: { root: string; cleanState: CleanState }
  dependencyChanges: GenerationDependencyChange[]
  fileChanges: GenerationFileChange[]
  commands: string[]
  warnings: string[]
  blockers: string[]
  ambiguityQuestions: { id: string; question: string; choices: string[] }[]
  rollbackStrategy: string
  planHash: string
}

/** CAP-CONTRACT-026 — generated file ownership record. */
export type GeneratedOwnershipManifest = {
  schemaVersion: '1.0'
  projectId: string
  filePath: string
  contentHash: string
  generatorVersion: string
  referenceProfileVersion: string
  sourceContractHashes: string[]
  deployableId: string
  moduleIds: string[]
  lastAppliedPlanId: string
  safeToDelete: boolean
}

/** CAP-CONTRACT-027 — one deployable composition manifest. */
export type CompositionRegistration = {
  contractId: string
  implementationTarget: string
  lifecycle: LifecycleKind
  providerModuleId: string
  dependencies: string[]
}
export type CompositionOperationRoute = {
  operationId: string
  operationVersion: string
  inboundBindingId: string
}
export type CompositionManifest = {
  schemaVersion: '1.0'
  projectId: string
  compositionId: string
  applicationRevision: string
  architectureRevision: string
  deployableIds: string[]
  registrations: CompositionRegistration[]
  operationRoutes: CompositionOperationRoute[]
  inboundAdapterRefs: string[]
  outboundAdapterRefs: string[]
  configurationRefs: string[]
  secretReferenceIds: string[]
  telemetryHookRefs: string[]
  healthHookRefs: string[]
  authorizationHookRefs: string[]
  compositionHash: string
}

/**
 * CAP-CONTRACT-028 — inbound binding (discriminated on `kind`).
 * Supersedes the frontend-only FrontendBinding (CAP-CONTRACT-013); the `ui`
 * variant is the compatibility target for migrated frontend bindings.
 */
export type InboundBindingBase = {
  schemaVersion: '1.0'
  bindingId: string
  version: string
  projectId: string
  deployableId: string
  operationId: string
  operationVersion: string
  inputMappings: { from: string; to: string }[]
  outputMappings: { from: string; to: string }[]
  validationBehavior: string
  domainRejectionBehavior: string
  technicalFailureBehavior: string
  timeoutBehavior: string
  cancellationBehavior: string
  retryBehavior: string
  duplicateSubmissionBehavior: string
  exposure: ExposureLevel
  generatedTargets: string[]
  approvalState: string
}
export type UiInboundBinding = InboundBindingBase & {
  kind: 'ui'
  transport: UiTransportKind
  trigger: BindingTrigger
  /** Localhost, file URL, or repository-relative HTML entry point. */
  launchUrl?: string
  route?: string
  readinessSelector?: string
  captureSelector?: string
  /** Browser actions that make each approved scenario step executable. */
  stepActions?: {
    stepId: string
    route?: string
    actionSelector?: string
    expectedSelector: string
    expectedText?: string
  }[]
  selectionEvidence?: SelectionEvidence
  rendererDeployableId?: string
  mainDeployableId?: string
  ipcChannel?: string
  /** Preserved from a migrated FrontendBinding (CAP-CONTRACT-013). */
  loadingBehavior?: string
  /** Preserved from a migrated FrontendBinding (CAP-CONTRACT-013). */
  dataMode?: BindingDataMode
}
export type HttpInboundBinding = InboundBindingBase & {
  kind: 'http'
  method: HttpMethod
  path: string
  /** Local origin used by the desktop verification executor after it launches the configured process. */
  localBaseUrl?: string
  statusMapping?: { outcome: string; status: number }[]
  authRequirement?: string
}
export type CliInboundBinding = InboundBindingBase & {
  kind: 'cli'
  command: string
  argumentMappings?: { from: string; to: string }[]
  exitCodeMapping?: { outcome: string; code: number }[]
}
export type ScheduleInboundBinding = InboundBindingBase & {
  kind: 'schedule'
  cronExpression: string
  timezone: string
  overlapPolicy: OverlapPolicy
  misfirePolicy: MisfirePolicy
}
export type EmbeddedLibraryInboundBinding = InboundBindingBase & {
  kind: 'embedded-library'
  exportedCallable: string
  reason: string
}
export type InboundBinding =
  | UiInboundBinding
  | HttpInboundBinding
  | CliInboundBinding
  | ScheduleInboundBinding
  | EmbeddedLibraryInboundBinding

/** CAP-CONTRACT-029 — real connection verification evidence. */
export type ConnectionVerificationRecord = {
  schemaVersion: '1.0'
  verificationId: string
  projectId: string
  bindingId: string
  deployableId: string
  hashes: {
    binding: string
    operation: string
    architecture: string
    composition: string
    generatedOwnership: string
    source: string
  }
  launchCommand: string
  triggerKind: string
  redactedTriggerInput: string
  outcomeSummary: string
  correlationId: string
  observedPath: {
    inboundAdapter: string
    compositionRoot: string
    operation: string
    outboundAdapters: string[]
    workflow?: string
  }
  startedAt: string
  completedAt: string
  durationMs: number
  healthState: string
  usedTestAdapter: boolean
  externalEvidenceStatus: ExternalEvidenceStatus
  evidenceArtifactRefs: string[]
  verificationStatus: ConnectionVerificationStatus
  reasonCodes: string[]
}

/** CAP-CONTRACT-030 — reviewable capability/workspace migration plan. */
export type CapabilityMigrationPlan = {
  schemaVersion: '1.0'
  migrationPlanId: string
  projectId: string
  versions: {
    fromWorkspaceVersion: string
    toWorkspaceVersion: string
    fromProfileVersion?: string
    toProfileVersion?: string
    fromRuntimeVersion?: string
    toRuntimeVersion?: string
  }
  recordTransformations: { recordId: string; kind: string; description: string }[]
  fileTransformations: { path: string; action: FileChangeAction; description: string }[]
  compatibilityShims: string[]
  dataLossAssessment: { hasLoss: boolean; details: string[] }
  blockedAmbiguities: { id: string; description: string }[]
  previewHashes: string[]
  backupInstructions: string
  rollbackInstructions: string
  conformanceCommands: string[]
}

/** CAP-CONTRACT-031 — canonical, implementation-ready module specification. */
export type ModuleImplementationSpecification = {
  schemaVersion: '1.0'
  projectId: string
  moduleId: string
  moduleVersion: string
  moduleType: ModuleType
  runtimeLanguage: RuntimeLanguage
  deployableId: string
  ownedPaths: string[]
  editablePaths: string[]
  responsibility: string
  nonResponsibilities: string[]
  providedOperations: { operationId: string; contractVersion: string }[]
  requiredOperations: { operationId: string; acceptedContractRange: string; reason: string }[]
  providedPorts: string[]
  requiredPorts: string[]
  canonicalSchemaRefs: string[]
  generatedTypeTargets: string[]
  rules: NamedText[]
  invariants: string[]
  examples: string[]
  edgeCases: string[]
  failureSemantics: string[]
  performanceConstraints: string[]
  cancellationExpectations: string
  timeoutExpectations: string
  concurrencyExpectations: string
  lifecycleRegistration: LifecycleKind
  configurationRefs: string[]
  secretReferenceIds: string[]
  persistenceExpectations: string
  telemetryExpectations: string
  healthExpectations: string
  implementationSteps: string[]
  acceptanceCases: AcceptanceCase[]
  acceptanceCommands: string[]
  unresolvedItems: { id: string; description: string; materiality: MaterialityLevel }[]
}

export type CapabilityContractMap = {
  'CAP-CONTRACT-001': ApplicationSpecification
  'CAP-CONTRACT-002': ArchitectureSpecification
  'CAP-CONTRACT-003': ModuleManifest
  'CAP-CONTRACT-004': OperationContract
  'CAP-CONTRACT-005': ResultEnvelope
  'CAP-CONTRACT-006': ErrorRecord
  'CAP-CONTRACT-007': JobRecord
  'CAP-CONTRACT-008': ArtifactReference
  'CAP-CONTRACT-009': ConfigurationAndSecretReference
  'CAP-CONTRACT-010': EventEnvelope
  'CAP-CONTRACT-011': RegistryEntry
  'CAP-CONTRACT-012': FreshnessRecord
  'CAP-CONTRACT-013': FrontendBinding
  'CAP-CONTRACT-014': InterviewPacket
  'CAP-CONTRACT-015': ImplementationPacket
  'CAP-CONTRACT-016': DeltaPacket
  'CAP-CONTRACT-017': VerificationRecord
  'CAP-CONTRACT-018': AdapterConfiguration
  'CAP-CONTRACT-019': MatlabSessionRecord
  'CAP-CONTRACT-020': AzureDevOpsProvenance
  'CAP-CONTRACT-021': CapabilityRunScope
  'CAP-CONTRACT-022': ImpactRecord
  'CAP-CONTRACT-023': ReferenceArchitectureProfile
  'CAP-CONTRACT-024': DeployableSpecification
  'CAP-CONTRACT-025': GenerationPlan
  'CAP-CONTRACT-026': GeneratedOwnershipManifest
  'CAP-CONTRACT-027': CompositionManifest
  'CAP-CONTRACT-028': InboundBinding
  'CAP-CONTRACT-029': ConnectionVerificationRecord
  'CAP-CONTRACT-030': CapabilityMigrationPlan
  'CAP-CONTRACT-031': ModuleImplementationSpecification
}
