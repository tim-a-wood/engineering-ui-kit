/**
 * Shared contract catalogue for CAP-CONTRACT-001–022.
 * Schemas, TypeScript types, and CAP-TEST-001 parity checks consume these
 * constants so drift fails deterministically (CAP-PKT-001).
 */

export const CAP_SCHEMA_VERSION = '1.0' as const

export const MODULE_TYPES = [
  'domain',
  'workflow',
  'experience',
  'connection',
  'platform',
] as const

export const RUNTIME_ALLOCATIONS = ['local-embedded', 'external-adapter'] as const

export const OPERATION_BEHAVIORS = ['command', 'query', 'job'] as const

export const RESULT_OUTCOMES = [
  'success',
  'domain-rejection',
  'technical-failure',
  'cancelled',
] as const

export const ERROR_CATEGORIES = [
  'validation',
  'domain',
  'dependency',
  'configuration',
  'execution',
  'timeout',
  'authorization',
  'conflict',
] as const

export const JOB_STATES = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
] as const

export const FRESHNESS_STATES = [
  'draft',
  'ready',
  'needs-review',
  'verification-needed',
  'connection-outdated',
  'blocked',
  'failed',
] as const

export const BINDING_TRIGGERS = ['activate', 'change', 'submit', 'load'] as const

export const BINDING_DATA_MODES = [
  'connected',
  'approved-example',
  'invalid-input',
  'dependency-unavailable',
  'timeout',
] as const

export const IMPACT_CLASSIFICATIONS = [
  'implementation-only',
  'optional-additive',
  'required-additive',
  'breaking',
] as const

export const MATLAB_SESSION_STATES = [
  'stopped',
  'starting',
  'ready',
  'busy',
  'unhealthy',
] as const

export const RECORD_STATUSES = ['draft', 'proposed', 'approved', 'superseded'] as const

export const CAPABILITY_RUN_KINDS = [
  'interview',
  'implementation',
  'delta',
  'connection',
  'verification',
] as const

/** CAP-ERA-001 §5.1/§7.1 — first-release runtime languages. */
export const RUNTIME_LANGUAGES = ['typescript', 'python'] as const

/** CAP-ERA-001 §5.1 — first-release deployable/host kinds. */
export const DEPLOYABLE_KINDS = [
  'browser',
  'electron-main',
  'http-api',
  'cli',
  'worker',
  'embedded-library',
] as const

/** CAP-ERA-001 §10.2 — explicit lifecycle registrations. */
export const LIFECYCLE_KINDS = ['singleton', 'request-job', 'transient'] as const

/** CAP-ERA-001 §5.5/§15.2 — inbound exposure visibility, private by default. */
export const EXPOSURE_LEVELS = ['private', 'protected', 'public'] as const

/** CAP-ERA-001 §9 CAP-CONTRACT-028 — discriminated inbound binding kinds. */
export const INBOUND_BINDING_KINDS = ['ui', 'http', 'cli', 'schedule', 'embedded-library'] as const

/** CAP-ERA-001 §9/§10.3 — UI inbound transport. */
export const UI_TRANSPORT_KINDS = ['browser-local', 'electron-ipc', 'generated-http-client'] as const

/** CAP-ERA-001 §9 CAP-CONTRACT-028 http variant — bounded HTTP verbs. */
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

/** CAP-ERA-001 §9 CAP-CONTRACT-028 schedule variant — overlap policy. */
export const OVERLAP_POLICIES = ['skip', 'queue', 'allow-concurrent'] as const

/** CAP-ERA-001 §9 CAP-CONTRACT-028 schedule variant — misfire policy. */
export const MISFIRE_POLICIES = ['run-once', 'skip', 'run-all'] as const

/** CAP-ERA-001 §9 CAP-CONTRACT-024 — proposed repository location approval. */
export const PROPOSED_LOCATION_APPROVAL_STATUSES = ['proposed', 'approved', 'rejected'] as const

/** CAP-ERA-001 §9 CAP-CONTRACT-025 — target repository clean/dirty state. */
export const CLEAN_STATES = ['clean', 'dirty'] as const

/** CAP-ERA-001 §9 CAP-CONTRACT-025 — ordered file change action. */
export const FILE_CHANGE_ACTIONS = ['create', 'update', 'delete'] as const

/** CAP-ERA-001 §7.2 — generated vs editable file classification. */
export const GENERATED_CLASSIFICATIONS = ['generated', 'editable'] as const

/** CAP-ERA-001 §9 CAP-CONTRACT-029 — external evidence status. */
export const EXTERNAL_EVIDENCE_STATUSES = ['complete', 'outstanding', 'not-applicable'] as const

/** CAP-ERA-001 §9 CAP-CONTRACT-029 — pass/fail/partial connection verification. */
export const CONNECTION_VERIFICATION_STATUSES = ['pass', 'fail', 'partial'] as const

/** CAP-ERA-001 §9 CAP-CONTRACT-031 — unresolved item materiality. */
export const MATERIALITY_LEVELS = ['material', 'non-material'] as const

export const CONTRACT_IDS = [
  'CAP-CONTRACT-001',
  'CAP-CONTRACT-002',
  'CAP-CONTRACT-003',
  'CAP-CONTRACT-004',
  'CAP-CONTRACT-005',
  'CAP-CONTRACT-006',
  'CAP-CONTRACT-007',
  'CAP-CONTRACT-008',
  'CAP-CONTRACT-009',
  'CAP-CONTRACT-010',
  'CAP-CONTRACT-011',
  'CAP-CONTRACT-012',
  'CAP-CONTRACT-013',
  'CAP-CONTRACT-014',
  'CAP-CONTRACT-015',
  'CAP-CONTRACT-016',
  'CAP-CONTRACT-017',
  'CAP-CONTRACT-018',
  'CAP-CONTRACT-019',
  'CAP-CONTRACT-020',
  'CAP-CONTRACT-021',
  'CAP-CONTRACT-022',
  'CAP-CONTRACT-023',
  'CAP-CONTRACT-024',
  'CAP-CONTRACT-025',
  'CAP-CONTRACT-026',
  'CAP-CONTRACT-027',
  'CAP-CONTRACT-028',
  'CAP-CONTRACT-029',
  'CAP-CONTRACT-030',
  'CAP-CONTRACT-031',
] as const

export type ContractId = (typeof CONTRACT_IDS)[number]

/** Schema file basename (without .schema.json) keyed by contract id. */
export const CONTRACT_SCHEMA_NAMES: Record<ContractId, string> = {
  'CAP-CONTRACT-001': 'application-specification',
  'CAP-CONTRACT-002': 'architecture-specification',
  'CAP-CONTRACT-003': 'module-manifest',
  'CAP-CONTRACT-004': 'operation-contract',
  'CAP-CONTRACT-005': 'result-envelope',
  'CAP-CONTRACT-006': 'error-record',
  'CAP-CONTRACT-007': 'job-record',
  'CAP-CONTRACT-008': 'artifact-reference',
  'CAP-CONTRACT-009': 'configuration-and-secret-reference',
  'CAP-CONTRACT-010': 'event-envelope',
  'CAP-CONTRACT-011': 'registry-entry',
  'CAP-CONTRACT-012': 'freshness-record',
  'CAP-CONTRACT-013': 'frontend-binding',
  'CAP-CONTRACT-014': 'interview-packet',
  'CAP-CONTRACT-015': 'implementation-packet',
  'CAP-CONTRACT-016': 'delta-packet',
  'CAP-CONTRACT-017': 'verification-record',
  'CAP-CONTRACT-018': 'adapter-configuration',
  'CAP-CONTRACT-019': 'matlab-session-record',
  'CAP-CONTRACT-020': 'azure-devops-provenance',
  'CAP-CONTRACT-021': 'capability-run-scope',
  'CAP-CONTRACT-022': 'impact-record',
  'CAP-CONTRACT-023': 'reference-architecture-profile',
  'CAP-CONTRACT-024': 'deployable-specification',
  'CAP-CONTRACT-025': 'generation-plan',
  'CAP-CONTRACT-026': 'generated-ownership-manifest',
  'CAP-CONTRACT-027': 'composition-manifest',
  'CAP-CONTRACT-028': 'inbound-binding',
  'CAP-CONTRACT-029': 'connection-verification-record',
  'CAP-CONTRACT-030': 'capability-migration-plan',
  'CAP-CONTRACT-031': 'module-implementation-specification',
}

/**
 * Required top-level fields per contract. Used for schema generation and
 * TypeScript/schema parity (CAP-TEST-001).
 */
export const CONTRACT_REQUIRED_FIELDS: Record<ContractId, readonly string[]> = {
  'CAP-CONTRACT-001': [
    'schemaVersion',
    'projectId',
    'id',
    'revision',
    'status',
    'purpose',
    'outcomes',
    'actors',
    'goals',
    'useCases',
    'scenarios',
    'information',
    'rules',
    'externalSystems',
    'constraints',
    'scope',
    'acceptanceCases',
    'sources',
    'unresolvedQuestions',
    'contentHash',
  ],
  'CAP-CONTRACT-002': [
    'schemaVersion',
    'projectId',
    'id',
    'revision',
    'status',
    'applicationSpecId',
    'applicationSpecRevision',
    'applicationSpecHash',
    'capabilityProjections',
    'moduleIds',
    'dependencyEdges',
    'operationAllocations',
    'adapterAllocations',
    'workflowTraces',
    'proposals',
    'unresolvedQuestions',
    'gateResult',
    'contentHash',
  ],
  'CAP-CONTRACT-003': [
    'schemaVersion',
    'architectureVersion',
    'moduleId',
    'moduleVersion',
    'moduleType',
    'name',
    'responsibility',
    'ownedConcerns',
    'excludedConcerns',
    'providedOperations',
    'requiredOperations',
    'verificationSuiteIds',
    'runtimeAllocation',
    'events',
    'ownedPaths',
  ],
  'CAP-CONTRACT-004': [
    'schemaVersion',
    'operationId',
    'version',
    'behavior',
    'inputSchemaRef',
    'outputSchemaRef',
    'preconditions',
    'postconditions',
    'domainRejections',
    'technicalErrors',
    'sideEffects',
    'idempotency',
    'timeoutClass',
    'cancellable',
    'artifactTypes',
    'provenanceFields',
  ],
  'CAP-CONTRACT-005': [
    'schemaVersion',
    'outcome',
    'diagnostics',
    'artifacts',
    'provenance',
  ],
  'CAP-CONTRACT-006': [
    'schemaVersion',
    'code',
    'category',
    'safeMessage',
    'retryability',
    'relatedIds',
    'diagnosticRefs',
  ],
  'CAP-CONTRACT-007': [
    'schemaVersion',
    'jobId',
    'projectId',
    'operationId',
    'operationVersion',
    'inputHash',
    'state',
    'createdAt',
    'updatedAt',
    'diagnostics',
    'artifactRefs',
  ],
  'CAP-CONTRACT-008': [
    'schemaVersion',
    'artifactId',
    'projectId',
    'mediaType',
    'checksum',
    'byteSize',
    'createdAt',
    'provenance',
    'storageClass',
    'opaqueStorageRef',
  ],
  'CAP-CONTRACT-009': [
    'schemaVersion',
    'kind',
  ],
  'CAP-CONTRACT-010': [
    'schemaVersion',
    'eventId',
    'eventType',
    'eventVersion',
    'moduleId',
    'projectId',
    'occurredAt',
    'payloadSchemaRef',
    'payload',
    'provenance',
  ],
  'CAP-CONTRACT-011': [
    'schemaVersion',
    'moduleId',
    'moduleVersion',
    'compatibleContractVersions',
    'runtimeAllocation',
    'configReady',
    'verificationState',
    'freshnessState',
    'evidenceRefs',
  ],
  'CAP-CONTRACT-012': [
    'schemaVersion',
    'moduleId',
    'moduleVersion',
    'hashes',
    'evaluatedAt',
    'primaryState',
    'reasonCodes',
  ],
  'CAP-CONTRACT-013': [
    'schemaVersion',
    'bindingId',
    'version',
    'projectId',
    'selectionEvidence',
    'trigger',
    'operationId',
    'operationVersion',
    'inputMappings',
    'outputMappings',
    'loadingBehavior',
    'validationBehavior',
    'domainRejectionBehavior',
    'technicalFailureBehavior',
    'cancellationBehavior',
    'duplicateSubmissionBehavior',
    'dataMode',
  ],
  'CAP-CONTRACT-014': [
    'schemaVersion',
    'packetId',
    'packetVersion',
    'projectId',
    'interviewKind',
    'generatedAt',
    'inputContext',
    'interviewBoundary',
    'stateLabels',
    'outputSchemaRef',
    'outputFileName',
    'gateId',
    'safetyNotes',
  ],
  'CAP-CONTRACT-015': [
    'schemaVersion',
    'packetId',
    'packetVersion',
    'projectId',
    'targetKind',
    'targetId',
    'inputHashes',
    'architectureVersion',
    'architectureHash',
    'allowedPaths',
    'expectedPaths',
    'protectedPaths',
    'excludedPaths',
    'requiredTests',
    'acceptanceCases',
    'unchangedBehavior',
    'requiredOutput',
  ],
  'CAP-CONTRACT-016': [
    'schemaVersion',
    'packetId',
    'packetVersion',
    'projectId',
    'targetKind',
    'targetId',
    'inputHashes',
    'architectureVersion',
    'architectureHash',
    'allowedPaths',
    'expectedPaths',
    'protectedPaths',
    'excludedPaths',
    'requiredTests',
    'acceptanceCases',
    'unchangedBehavior',
    'requiredOutput',
    'changeReason',
    'impactRecordId',
    'previousContractVersions',
    'targetContractVersions',
    'preserveBehavior',
    'addBehavior',
    'changeBehavior',
    'newTests',
    'unchangedModuleIds',
  ],
  'CAP-CONTRACT-017': [
    'schemaVersion',
    'verificationId',
    'projectId',
    'suiteIds',
    'suiteVersions',
    'suiteHashes',
    'inputHashes',
    'commandResults',
    'artifacts',
    'diagnostics',
    'startedAt',
    'completedAt',
    'outcome',
  ],
  'CAP-CONTRACT-018': [
    'schemaVersion',
    'adapterId',
    'adapterContractVersion',
    'projectId',
    'nonSecretSettings',
    'secretReferenceIds',
    'permissionSummary',
    'readinessResult',
    'revision',
    'contentHash',
  ],
  'CAP-CONTRACT-019': [
    'schemaVersion',
    'projectId',
    'sessionId',
    'state',
    'toolboxReadiness',
    'processOwnership',
  ],
  'CAP-CONTRACT-020': [
    'schemaVersion',
    'organization',
    'project',
    'externalType',
    'externalId',
    'revision',
    'retrievedAt',
    'contentHash',
    'sourceAdapterVersion',
  ],
  'CAP-CONTRACT-021': [
    'schemaVersion',
    'runId',
    'kind',
    'projectId',
    'targetOwnerId',
    'lifecycleState',
    'inputRevisions',
    'inputHashes',
    'allowedPaths',
    'expectedPaths',
    'protectedPaths',
    'packetRefs',
    'artifactRefs',
    'transitionHistory',
    'createdAt',
    'updatedAt',
  ],
  'CAP-CONTRACT-022': [
    'schemaVersion',
    'changeId',
    'initiatingRecordId',
    'initiatingRevision',
    'classification',
    'affectedModules',
    'unaffectedModules',
    'proposedPacketOrder',
    'recalculationEvidence',
  ],
  'CAP-CONTRACT-023': [
    'schemaVersion',
    'profileId',
    'profileVersion',
    'supportedRuntimeLanguages',
    'supportedHostKinds',
    'contractFormat',
    'httpContractFormat',
    'generatedDirectoryPolicy',
    'editableDirectoryPolicy',
    'runtimePackageCoordinates',
    'lifecyclePolicy',
    'telemetryPolicy',
    'secretPolicy',
    'authorizationPolicy',
    'persistencePolicy',
    'errorPolicy',
    'generatorVersion',
    'generatorCompatibilityRange',
    'contentHash',
  ],
  'CAP-CONTRACT-024': [
    'schemaVersion',
    'deployableId',
    'name',
    'kind',
    'runtimeLanguage',
    'runtimeVersionRange',
    'moduleIds',
    'inboundBindingIds',
    'compositionRootPath',
    'commands',
    'configurationRefs',
    'secretReferenceIds',
    'proposedLocations',
  ],
  'CAP-CONTRACT-025': [
    'schemaVersion',
    'planId',
    'projectId',
    'inputRecords',
    'generatorVersion',
    'referenceProfileVersion',
    'targetRepository',
    'dependencyChanges',
    'fileChanges',
    'commands',
    'warnings',
    'blockers',
    'ambiguityQuestions',
    'rollbackStrategy',
    'planHash',
  ],
  'CAP-CONTRACT-026': [
    'schemaVersion',
    'projectId',
    'filePath',
    'contentHash',
    'generatorVersion',
    'referenceProfileVersion',
    'sourceContractHashes',
    'deployableId',
    'moduleIds',
    'lastAppliedPlanId',
    'safeToDelete',
  ],
  'CAP-CONTRACT-027': [
    'schemaVersion',
    'projectId',
    'compositionId',
    'applicationRevision',
    'architectureRevision',
    'deployableIds',
    'registrations',
    'operationRoutes',
    'inboundAdapterRefs',
    'outboundAdapterRefs',
    'configurationRefs',
    'secretReferenceIds',
    'telemetryHookRefs',
    'healthHookRefs',
    'authorizationHookRefs',
    'compositionHash',
  ],
  'CAP-CONTRACT-028': [
    'schemaVersion',
    'bindingId',
    'version',
    'projectId',
    'deployableId',
    'kind',
    'operationId',
    'operationVersion',
    'inputMappings',
    'outputMappings',
    'validationBehavior',
    'domainRejectionBehavior',
    'technicalFailureBehavior',
    'timeoutBehavior',
    'cancellationBehavior',
    'retryBehavior',
    'duplicateSubmissionBehavior',
    'exposure',
    'generatedTargets',
    'approvalState',
  ],
  'CAP-CONTRACT-029': [
    'schemaVersion',
    'verificationId',
    'projectId',
    'bindingId',
    'deployableId',
    'hashes',
    'launchCommand',
    'triggerKind',
    'redactedTriggerInput',
    'outcomeSummary',
    'correlationId',
    'observedPath',
    'startedAt',
    'completedAt',
    'durationMs',
    'healthState',
    'usedTestAdapter',
    'externalEvidenceStatus',
    'evidenceArtifactRefs',
    'verificationStatus',
    'reasonCodes',
  ],
  'CAP-CONTRACT-030': [
    'schemaVersion',
    'migrationPlanId',
    'projectId',
    'versions',
    'recordTransformations',
    'fileTransformations',
    'compatibilityShims',
    'dataLossAssessment',
    'blockedAmbiguities',
    'previewHashes',
    'backupInstructions',
    'rollbackInstructions',
    'conformanceCommands',
  ],
  'CAP-CONTRACT-031': [
    'schemaVersion',
    'projectId',
    'moduleId',
    'moduleVersion',
    'moduleType',
    'runtimeLanguage',
    'deployableId',
    'ownedPaths',
    'editablePaths',
    'responsibility',
    'nonResponsibilities',
    'providedOperations',
    'requiredOperations',
    'providedPorts',
    'requiredPorts',
    'canonicalSchemaRefs',
    'generatedTypeTargets',
    'rules',
    'invariants',
    'examples',
    'edgeCases',
    'failureSemantics',
    'performanceConstraints',
    'cancellationExpectations',
    'timeoutExpectations',
    'concurrencyExpectations',
    'lifecycleRegistration',
    'configurationRefs',
    'secretReferenceIds',
    'persistenceExpectations',
    'telemetryExpectations',
    'healthExpectations',
    'implementationSteps',
    'acceptanceCases',
    'acceptanceCommands',
    'unresolvedItems',
  ],
}

/** Adapter-specific contracts allowed to use technology field names. */
export const ADAPTER_SPECIFIC_CONTRACTS: readonly ContractId[] = [
  'CAP-CONTRACT-019',
  'CAP-CONTRACT-020',
]

/** Forbidden tokens in domain-neutral schema property keys (CAP-TEST-001). */
export const FORBIDDEN_DOMAIN_PROPERTY_TOKENS = [
  'matlab',
  'azuredevops',
  'azure',
  'aerospace',
  'flightscientist',
  'simulink',
] as const
