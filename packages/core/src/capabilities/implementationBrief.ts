/**
 * Implementation-ready module brief assembled from the reference architecture,
 * approved project records, and a live repository snapshot.
 */

import type { ModuleDataSchema, ModuleInterviewResponse } from './moduleInterview.js'
import type {
  ArchitectureModuleDefinition,
  ArchitectureSpecification,
  DeployableKind,
  DeployableSpecification,
  ModuleImplementationSpecification,
  ModuleDesignSpecification,
  ModuleManifest,
  ModuleType,
  OperationContract,
  RuntimeLanguage,
} from './types.js'
import {
  assertSteProfile,
  checkSteEntries,
  type SteLexicon,
  type SteCheckResult,
  type SteTextEntry,
} from './simplifiedTechnicalEnglish.js'

export type RepositoryImplementationContext = {
  repositoryName: string
  detectedLanguages: string[]
  detectedFrameworks: string[]
  detectedPackageManager: string
  manifestFiles: string[]
  sourceRoots: string[]
  packageScripts: Record<string, string>
  configuredVerificationCommands: Record<string, string>
  ownedPaths: { path: string; exists: boolean; kind: 'file' | 'directory' | 'missing' }[]
  existingFilesInScope: string[]
  nearbyPatternFiles: string[]
  testFiles: string[]
}

export type ModuleReferenceProfile = {
  profileId: 'hexagonal-ports-and-adapters'
  version: '1.0'
  role: string
  dependencyRules: string[]
  implementationRules: string[]
  portRules: string[]
  testingRules: string[]
}

export type ImplementationReadinessIssue = {
  code: string
  severity: 'warning' | 'blocking'
  message: string
  resolution: string
}

export type ModuleImplementationBrief = {
  schemaVersion: '1.0'
  generatedAt: string
  readiness: {
    status: 'ready' | 'ready-with-gaps' | 'blocked'
    issues: ImplementationReadinessIssue[]
  }
  target: {
    moduleId: string
    name: string
    moduleType: ModuleType
    responsibility: string
    runtimeAllocation: ModuleManifest['runtimeAllocation']
    allowedPaths: string[]
  }
  referenceArchitecture: ModuleReferenceProfile
  approvedSpecification: {
    ownedConcerns: string[]
    excludedConcerns: string[]
    events: string[]
    configurationSchemaRef?: string | null
    detailAnswers: { id: string; text: string; status: string }[]
    rules: { id: string; text: string }[]
    acceptanceCases: { id: string; description: string; expectedOutcome: string }[]
  }
  contracts: {
    providedOperations: ModuleManifest['providedOperations']
    requiredOperations: ModuleManifest['requiredOperations']
    providedOperationContracts: OperationContract[]
    requiredOperationContracts: OperationContract[]
    dataSchemas: ModuleDataSchema[]
    behavioralEvidence: { detailId: string; text: string }[]
  }
  architectureContext: {
    architectureId: string
    revision: string
    targetModule?: ArchitectureModuleDefinition
    dependencyEdges: ArchitectureSpecification['dependencyEdges']
    operationAllocations: ArchitectureSpecification['operationAllocations']
    adapterAllocations: ArchitectureSpecification['adapterAllocations']
    workflowTraces: ArchitectureSpecification['workflowTraces']
  }
  moduleDesign?: {
    revision: string
    contentHash: string
    trace: ModuleDesignSpecification['trace']
    boundary: ModuleDesignSpecification['boundary']
    behavior: ModuleDesignSpecification['behavior']
    data: ModuleDesignSpecification['data']
    runtime: ModuleDesignSpecification['runtime']
    verification: ModuleDesignSpecification['verification']
    diagramRefs: { id: string; kind: string; contentHash: string }[]
  }
  repositoryContext: RepositoryImplementationContext
  /**
   * Generated-deployment references (WP5A-core enrichment): which deployable
   * hosts this module, plus its generated composition root, commands, and
   * generated contract/type targets. Present only when a `deployable` (and,
   * optionally, its `ModuleImplementationSpecification`) is supplied to
   * `buildModuleImplementationBrief`: omitted for backward compatibility
   * otherwise.
   */
  deployment?: {
    deployableId: string
    kind: DeployableKind
    runtimeLanguage: RuntimeLanguage
    runtimeVersionRange: string
    compositionRootPath: string
    commands: DeployableSpecification['commands']
    generatedContractRefs: string[]
    generatedTypeTargets: string[]
    acceptanceCommands: string[]
  }
  implementationPlan: string[]
  verificationPlan: {
    suiteIds: string[]
    acceptanceCases: { id: string; description: string; expectedOutcome: string }[]
    commands: Record<string, string>
    requiredEvidence: string[]
  }
  precedence: string[]
}

const COMMON_PROFILE = {
  profileId: 'hexagonal-ports-and-adapters' as const,
  version: '1.0' as const,
  dependencyRules: [
    'Point dependencies toward application and domain policy. Make adapters depend on ports, not the reverse.',
    'Cross-module behavior is invoked through an explicit provided or required operation boundary.',
    'Do not import another module’s internal implementation or duplicate its owned concerns.',
    'Keep infrastructure, transport, storage, and presentation details outside domain policy.',
  ],
  portRules: [
    'Represent provided operations as stable inbound ports and required operations as outbound ports.',
    'Use repository-native types while preserving the approved operation identifiers and contract versions.',
    'Validate data at the boundary and translate technical failures without hiding domain rejections.',
    'Do not invent an operation contract when approved detail is missing. Identify the exact missing decision.',
  ],
  testingRules: [
    'Trace every approved acceptance case to at least one automated test.',
    'Test the module through its public port wherever practical, not through private implementation details.',
    'Cover successful behavior, approved edge cases, domain rejections, and relevant technical failures.',
    'Run the configured repository verification commands and preserve unrelated passing behavior.',
  ],
}

const TYPE_PROFILE: Record<ModuleType, Pick<ModuleReferenceProfile, 'role' | 'implementationRules'>> = {
  domain: {
    role: 'Domain core: owns business vocabulary, invariants, calculations, and decisions.',
    implementationRules: [
      'Keep domain behavior deterministic and independent of UI, persistence, network, and vendor APIs.',
      'Express invariants and units explicitly in domain types or boundary validation.',
      'Request external information through outbound ports instead of performing I/O directly.',
    ],
  },
  workflow: {
    role: 'Application workflow: coordinates use cases across domain and outbound ports.',
    implementationRules: [
      'Keep orchestration explicit: trigger, sequence, alternatives, cancellation, recovery, and completion.',
      'Delegate business decisions to domain ports and technical work to outbound ports.',
      'Make partial failure and retry behavior visible and testable.',
    ],
  },
  experience: {
    role: 'Inbound experience adapter: translates user intent and presents application outcomes.',
    implementationRules: [
      'Keep domain rules and persistence out of presentation code.',
      'Bind user actions to approved application ports and model loading, empty, rejection, and failure states.',
      'Follow the repository’s established accessibility, responsive, state-management, and component patterns.',
    ],
  },
  connection: {
    role: 'Outbound external adapter: translates an application port to an external system or protocol.',
    implementationRules: [
      'Isolate vendor and protocol types inside the adapter and map them at the port boundary.',
      'Implement approved authentication references, timeouts, cancellation, compatibility, and failure mapping.',
      'Never embed secret values. Use the repository’s configuration or secret-reference mechanism.',
    ],
  },
  platform: {
    role: 'Outbound platform adapter: supplies storage, configuration, execution, or other platform services.',
    implementationRules: [
      'Keep platform APIs behind the approved outbound port.',
      'Implement approved retention, access, recovery, configuration, and execution semantics.',
      'Make resource ownership and cleanup explicit and test platform failure behavior.',
    ],
  },
}

export function referenceArchitectureFor(moduleType: ModuleType): ModuleReferenceProfile {
  return {
    ...COMMON_PROFILE,
    ...TYPE_PROFILE[moduleType],
  }
}

function architectureSlice(architecture: ArchitectureSpecification, moduleId: string) {
  return {
    architectureId: architecture.id,
    revision: architecture.revision,
    targetModule: architecture.moduleDefinitions?.find((definition) => definition.moduleId === moduleId),
    dependencyEdges: architecture.dependencyEdges.filter(
      (edge) => edge.fromModuleId === moduleId || edge.toModuleId === moduleId,
    ),
    operationAllocations: architecture.operationAllocations.filter(
      (allocation) => allocation.moduleId === moduleId,
    ),
    adapterAllocations: architecture.adapterAllocations.filter(
      (allocation) => allocation.moduleId === moduleId,
    ),
    workflowTraces: architecture.workflowTraces.filter((trace) => trace.moduleIds.includes(moduleId)),
  }
}

function readinessIssues(
  manifest: ModuleManifest,
  interview: ModuleInterviewResponse | undefined,
  repository: RepositoryImplementationContext,
  availableOperationContracts: OperationContract[],
): ImplementationReadinessIssue[] {
  const issues: ImplementationReadinessIssue[] = []
  if (!interview) {
    issues.push({
      code: 'IMPLEMENTATION-BRIEF-INTERVIEW-DETAIL',
      severity: 'warning',
      message: 'The approved module predates preservation of the complete interview outcome.',
      resolution: 'Use the approved manifest and repository context. Revisit the module interview only if behavior remains ambiguous.',
    })
  }
  if (!(interview?.acceptanceCases?.length)) {
    issues.push({
      code: 'IMPLEMENTATION-BRIEF-ACCEPTANCE',
      severity: 'warning',
      message: 'No detailed module acceptance cases are available in the approved interview record.',
      resolution: 'Derive tests from the module responsibility and verification suites, and ask only if an observable outcome is ambiguous.',
    })
  }
  const answerIds = new Set(interview?.answers.map((answer) => answer.id) ?? [])
  if (manifest.providedOperations.length && !answerIds.has('inputs-outputs') && manifest.moduleType === 'domain') {
    issues.push({
      code: 'IMPLEMENTATION-BRIEF-OPERATION-DETAIL',
      severity: 'warning',
      message: 'Provided operation identifiers exist without preserved input/output interview detail.',
      resolution: 'Inspect existing contracts in the repository. Do not invent incompatible boundary shapes.',
    })
  }
  const availableContractIds = new Set([
    ...(interview?.operationContracts ?? []),
    ...availableOperationContracts,
  ].map((contract) => contract.operationId))
  for (const operation of manifest.providedOperations) {
    if (!(interview?.operationContracts ?? []).some(
      (contract) => contract.operationId === operation.operationId && contract.version === operation.contractVersion,
    )) {
      issues.push({
        code: 'IMPLEMENTATION-BRIEF-PROVIDED-CONTRACT',
        severity: 'warning',
        message: `Detailed contract ${operation.operationId}@${operation.contractVersion} is not preserved with this module.`,
        resolution: 'Use an authoritative repository contract. Otherwise, revisit only this module contract before implementation.',
      })
    }
  }
  for (const operation of manifest.requiredOperations) {
    if (!availableContractIds.has(operation.operationId)) {
      issues.push({
        code: 'IMPLEMENTATION-BRIEF-REQUIRED-CONTRACT',
        severity: 'warning',
        message: `The approved provider contract for required operation ${operation.operationId} is not available.`,
        resolution: 'Inspect the provider module or repository contract. Do not invent an incompatible dependency interface.',
      })
    }
  }
  if (!repository.manifestFiles.length && !repository.detectedLanguages.length) {
    issues.push({
      code: 'IMPLEMENTATION-BRIEF-REPOSITORY',
      severity: 'blocking',
      message: 'The selected repository has no detectable build manifest or source language.',
      resolution: 'Select the actual project repository before creating an implementation handoff.',
    })
  }
  return issues
}

function implementationPlan(
  manifest: ModuleManifest,
  interview: ModuleInterviewResponse | undefined,
  repository: RepositoryImplementationContext,
): string[] {
  const profile = referenceArchitectureFor(manifest.moduleType)
  const firstExistingFile = repository.existingFilesInScope.find(
    (file) => !/(?:^|[./_-])test(?:[./_-]|$)|\.spec\./i.test(file),
  ) ?? repository.existingFilesInScope[0]
  const firstPath = repository.existingFilesInScope.length
    ? `Inspect this existing file first: ${firstExistingFile}.`
    : `Inspect the nearby repository patterns before you create files under ${manifest.ownedPaths[0] ?? 'the approved path'}.`
  const acceptance = interview?.acceptanceCases?.length
    ? `Implement the ${interview.acceptanceCases.length} approved acceptance case(s) and keep their IDs in test names or comments for traceability.`
    : 'Implement the approved responsibility and convert each observable outcome into an automated test.'
  return [
    firstPath,
    `Follow the ${profile.profileId} ${profile.version} role and dependency rules for a ${manifest.moduleType} module.`,
    'Define the module’s public ports from the approved operations. Reuse repository contract types when they exist.',
    ...profile.implementationRules,
    acceptance,
    'Run the configured verification commands, fix failures caused by this change, and return only the changed implementation and test files.',
  ]
}

/** Check all human-facing prose emitted in the implementation brief. */
export function evaluateImplementationBriefSte(
  brief: ModuleImplementationBrief,
  lexicon?: SteLexicon,
): SteCheckResult {
  const operationContractEntries = (
    contracts: readonly OperationContract[],
    fieldPath: string,
  ): SteTextEntry[] => contracts.flatMap((contract, contractIndex) => [
    ...contract.preconditions.map((text, index) => ({
      text,
      textClass: 'description' as const,
      fieldPath: `${fieldPath}.${contractIndex}.preconditions.${index}`,
    })),
    ...contract.postconditions.map((text, index) => ({
      text,
      textClass: 'description' as const,
      fieldPath: `${fieldPath}.${contractIndex}.postconditions.${index}`,
    })),
    ...contract.domainRejections.map((text, index) => ({
      text,
      textClass: 'description' as const,
      fieldPath: `${fieldPath}.${contractIndex}.domainRejections.${index}`,
    })),
    ...contract.technicalErrors.map((text, index) => ({
      text,
      textClass: 'description' as const,
      fieldPath: `${fieldPath}.${contractIndex}.technicalErrors.${index}`,
    })),
    ...contract.sideEffects.map((text, index) => ({
      text,
      textClass: 'description' as const,
      fieldPath: `${fieldPath}.${contractIndex}.sideEffects.${index}`,
    })),
  ])
  const entries: SteTextEntry[] = [
    {
      text: brief.target.name,
      textClass: 'technical-name',
      fieldPath: 'target.name',
    },
    {
      text: brief.target.responsibility,
      textClass: 'description',
      fieldPath: 'target.responsibility',
    },
    ...brief.approvedSpecification.ownedConcerns.map((text, index) => ({
      text,
      textClass: 'technical-name' as const,
      fieldPath: `approvedSpecification.ownedConcerns.${index}`,
    })),
    ...brief.approvedSpecification.excludedConcerns.map((text, index) => ({
      text,
      textClass: 'technical-name' as const,
      fieldPath: `approvedSpecification.excludedConcerns.${index}`,
    })),
    ...brief.approvedSpecification.detailAnswers.map((answer, index) => ({
      text: answer.text,
      textClass: 'description' as const,
      fieldPath: `approvedSpecification.detailAnswers.${index}.text`,
    })),
    ...brief.approvedSpecification.rules.map((rule, index) => ({
      text: rule.text,
      textClass: 'description' as const,
      fieldPath: `approvedSpecification.rules.${index}.text`,
    })),
    ...brief.approvedSpecification.acceptanceCases.flatMap((acceptanceCase, index) => [
      {
        text: acceptanceCase.description,
        textClass: 'description' as const,
        fieldPath: `approvedSpecification.acceptanceCases.${index}.description`,
      },
      {
        text: acceptanceCase.expectedOutcome,
        textClass: 'description' as const,
        fieldPath: `approvedSpecification.acceptanceCases.${index}.expectedOutcome`,
      },
    ]),
    ...brief.contracts.requiredOperations.map((operation, index) => ({
      text: operation.reason,
      textClass: 'description' as const,
      fieldPath: `contracts.requiredOperations.${index}.reason`,
    })),
    ...operationContractEntries(
      brief.contracts.providedOperationContracts,
      'contracts.providedOperationContracts',
    ),
    ...operationContractEntries(
      brief.contracts.requiredOperationContracts,
      'contracts.requiredOperationContracts',
    ),
    ...brief.contracts.dataSchemas.flatMap((schema, schemaIndex) => [
      {
        text: schema.description,
        textClass: 'description' as const,
        fieldPath: `contracts.dataSchemas.${schemaIndex}.description`,
      },
      ...schema.fields.flatMap((field, fieldIndex) => [
        {
          text: field.description,
          textClass: 'description' as const,
          fieldPath: `contracts.dataSchemas.${schemaIndex}.fields.${fieldIndex}.description`,
        },
        ...field.constraints.map((text, constraintIndex) => ({
          text,
          textClass: 'description' as const,
          fieldPath: `contracts.dataSchemas.${schemaIndex}.fields.${fieldIndex}.constraints.${constraintIndex}`,
        })),
      ]),
    ]),
    ...(brief.architectureContext.targetModule
      ? [
          {
            text: brief.architectureContext.targetModule.name,
            textClass: 'technical-name' as const,
            fieldPath: 'architectureContext.targetModule.name',
          },
          {
            text: brief.architectureContext.targetModule.responsibility,
            textClass: 'description' as const,
            fieldPath: 'architectureContext.targetModule.responsibility',
          },
        ]
      : []),
    ...brief.architectureContext.dependencyEdges.map((edge, index) => ({
      text: edge.reason,
      textClass: 'description' as const,
      fieldPath: `architectureContext.dependencyEdges.${index}.reason`,
    })),
    ...brief.readiness.issues.flatMap((issue, index) => [
      {
        text: issue.message,
        textClass: 'description' as const,
        fieldPath: `readiness.issues.${index}.message`,
      },
      {
        text: issue.resolution,
        textClass: 'instruction' as const,
        fieldPath: `readiness.issues.${index}.resolution`,
      },
    ]),
    {
      text: brief.referenceArchitecture.role,
      textClass: 'description',
      fieldPath: 'referenceArchitecture.role',
    },
    ...brief.referenceArchitecture.dependencyRules.map((text, index) => ({
      text,
      textClass: 'instruction' as const,
      fieldPath: `referenceArchitecture.dependencyRules.${index}`,
    })),
    ...brief.referenceArchitecture.implementationRules.map((text, index) => ({
      text,
      textClass: 'instruction' as const,
      fieldPath: `referenceArchitecture.implementationRules.${index}`,
    })),
    ...brief.referenceArchitecture.portRules.map((text, index) => ({
      text,
      textClass: 'instruction' as const,
      fieldPath: `referenceArchitecture.portRules.${index}`,
    })),
    ...brief.referenceArchitecture.testingRules.map((text, index) => ({
      text,
      textClass: 'instruction' as const,
      fieldPath: `referenceArchitecture.testingRules.${index}`,
    })),
    ...brief.implementationPlan.map((text, index) => ({
      text,
      textClass: 'instruction' as const,
      fieldPath: `implementationPlan.${index}`,
    })),
    ...brief.verificationPlan.requiredEvidence.map((text, index) => ({
      text,
      textClass: 'description' as const,
      fieldPath: `verificationPlan.requiredEvidence.${index}`,
    })),
    ...brief.precedence.map((text, index) => ({
      text,
      textClass: 'description' as const,
      fieldPath: `precedence.${index}`,
    })),
  ]
  return checkSteEntries(entries, { lexicon })
}

export function buildModuleImplementationBrief(input: {
  manifest: ModuleManifest
  interview?: ModuleInterviewResponse
  architecture: ArchitectureSpecification
  moduleDesign?: ModuleDesignSpecification
  repository: RepositoryImplementationContext
  availableOperationContracts?: OperationContract[]
  availableDataSchemas?: ModuleDataSchema[]
  /** WP5A-core enrichment: the deployable hosting this module, if a foundation plan has been proposed/approved. */
  deployable?: DeployableSpecification
  /** WP5A-core enrichment: this module's canonical implementation specification, if generated. */
  specification?: ModuleImplementationSpecification
  /** Project-selected vocabulary and preferred terms. */
  steLexicon?: SteLexicon
  now?: () => Date
}): ModuleImplementationBrief {
  const availableOperationContracts = input.availableOperationContracts ?? []
  const availableDataSchemas = input.availableDataSchemas ?? []
  const issues = readinessIssues(
    input.manifest,
    input.interview,
    input.repository,
    availableOperationContracts,
  )
  const status = issues.some((issue) => issue.severity === 'blocking')
    ? 'blocked'
    : issues.length
      ? 'ready-with-gaps'
      : 'ready'
  const acceptanceCases = input.interview?.acceptanceCases ?? []
  const detailAnswers = input.interview?.answers ?? []
  const providedOperationContracts = (input.interview?.operationContracts ?? []).filter((contract) =>
    input.manifest.providedOperations.some(
      (operation) => operation.operationId === contract.operationId && operation.contractVersion === contract.version,
    ),
  )
  const requiredOperationContracts = availableOperationContracts.filter((contract) =>
    input.manifest.requiredOperations.some((operation) => operation.operationId === contract.operationId),
  )
  const referencedSchemaIds = new Set(
    [...providedOperationContracts, ...requiredOperationContracts]
      .flatMap((contract) => [contract.inputSchemaRef, contract.outputSchemaRef]),
  )
  const dataSchemas = [...(input.interview?.dataSchemas ?? []), ...availableDataSchemas]
    .filter((schema, index, all) => all.findIndex((candidate) => candidate.schemaId === schema.schemaId) === index)
    .filter((schema) => referencedSchemaIds.has(schema.schemaId))
  const brief: ModuleImplementationBrief = {
    schemaVersion: '1.0',
    generatedAt: (input.now?.() ?? new Date()).toISOString(),
    readiness: { status, issues },
    target: {
      moduleId: input.manifest.moduleId,
      name: input.manifest.name,
      moduleType: input.manifest.moduleType,
      responsibility: input.manifest.responsibility,
      runtimeAllocation: input.manifest.runtimeAllocation,
      allowedPaths: input.manifest.ownedPaths,
    },
    referenceArchitecture: referenceArchitectureFor(input.manifest.moduleType),
    approvedSpecification: {
      ownedConcerns: input.manifest.ownedConcerns,
      excludedConcerns: input.manifest.excludedConcerns,
      events: input.manifest.events,
      configurationSchemaRef: input.manifest.configurationSchemaRef,
      detailAnswers,
      rules: input.interview?.rules ?? [],
      acceptanceCases,
    },
    contracts: {
      providedOperations: input.manifest.providedOperations,
      requiredOperations: input.manifest.requiredOperations,
      providedOperationContracts,
      requiredOperationContracts,
      dataSchemas,
      behavioralEvidence: detailAnswers
        .filter((answer) => ['inputs-outputs', 'preconditions-postconditions', 'exceptional-outcomes', 'rules-invariants', 'io-translation', 'failure-behavior'].includes(answer.id))
        .map((answer) => ({ detailId: answer.id, text: answer.text })),
    },
    architectureContext: architectureSlice(input.architecture, input.manifest.moduleId),
    ...(input.moduleDesign ? {
      moduleDesign: {
        revision: input.moduleDesign.revision,
        contentHash: input.moduleDesign.contentHash,
        trace: input.moduleDesign.trace,
        boundary: input.moduleDesign.boundary,
        behavior: input.moduleDesign.behavior,
        data: input.moduleDesign.data,
        runtime: input.moduleDesign.runtime,
        verification: input.moduleDesign.verification,
        diagramRefs: input.moduleDesign.diagrams.map((diagram) => ({
          id: diagram.id,
          kind: diagram.kind,
          contentHash: diagram.contentHash,
        })),
      },
    } : {}),
    repositoryContext: input.repository,
    ...(input.deployable
      ? {
          deployment: {
            deployableId: input.deployable.deployableId,
            kind: input.deployable.kind,
            runtimeLanguage: input.deployable.runtimeLanguage,
            runtimeVersionRange: input.deployable.runtimeVersionRange,
            compositionRootPath: input.deployable.compositionRootPath,
            commands: input.deployable.commands,
            generatedContractRefs: input.specification?.canonicalSchemaRefs ?? [...referencedSchemaIds],
            generatedTypeTargets: input.specification?.generatedTypeTargets ?? [],
            acceptanceCommands:
              input.specification?.acceptanceCommands ?? Object.values(input.repository.configuredVerificationCommands),
          },
        }
      : {}),
    implementationPlan: implementationPlan(input.manifest, input.interview, input.repository),
    verificationPlan: {
      suiteIds: input.manifest.verificationSuiteIds,
      acceptanceCases,
      commands: input.repository.configuredVerificationCommands,
      requiredEvidence: [
        'Changed production files stay inside the approved owned paths.',
        'Automated tests trace to the approved acceptance cases and boundary behavior.',
        'Configured verification commands complete successfully.',
        'Unrelated module behavior remains unchanged.',
      ],
    },
    precedence: [
      'The approved module-design revision supplies the authoritative use-case trace, behavior, data, runtime, and verification detail.',
      'Approved project and module behavior overrides reference-architecture defaults.',
      'Existing repository conventions override generic file-layout suggestions when they preserve approved boundaries.',
      'Reference architecture supplies defaults only where the approved specification and repository are silent.',
      'If a material business or contract decision remains unresolved, ask a targeted question instead of inventing it.',
    ],
  }
  assertSteProfile(
    'Module implementation brief',
    evaluateImplementationBriefSte(brief, input.steLexicon),
  )
  return brief
}
