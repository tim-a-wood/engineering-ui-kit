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
} from './parity.js'

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
  dependencyEdges: DependencyEdge[]
  operationAllocations: { operationId: string; moduleId: string }[]
  adapterAllocations: { adapterId: string; moduleId: string; portId: string }[]
  workflowTraces: { useCaseId: string; moduleIds: string[] }[]
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
  fromState: string
  toState: string
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
  lifecycleState: string
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
}
