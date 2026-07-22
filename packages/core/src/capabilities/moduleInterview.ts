/**
 * Type-specific module interviews — CAP-PKT-011 / CAP-GATE-003.
 * One bounded interview depth and one ModuleManifest schema across types.
 */

import { diagnostic, sortDiagnostics, type CapDiagnostic } from './diagnostics.js'
import { evaluateModuleGate, type GateResult } from './gates.js'
import { buildInterviewPacket } from './packets.js'
import type { CapabilityWorkspace } from './persistence.js'
import { validateContractRecord } from './validation.js'
import type {
  ArchitectureSpecification,
  InterviewPacket,
  ModuleManifest,
  ModuleType,
  OperationContract,
} from './types.js'

export type ModuleInterviewAnswer = {
  id: string
  text: string
  status: 'confirmed' | 'proposed' | 'unresolved'
}

export type ModuleDataSchema = {
  schemaId: string
  description: string
  fields: {
    name: string
    type: string
    required: boolean
    description: string
    constraints: string[]
  }[]
}

export type ModuleInterviewResponse = {
  moduleId: string
  moduleType: ModuleType
  name: string
  moduleVersion?: string
  responsibility: string
  ownedConcerns: string[]
  excludedConcerns: string[]
  providedOperations: ModuleManifest['providedOperations']
  requiredOperations?: ModuleManifest['requiredOperations']
  verificationSuiteIds: string[]
  runtimeAllocation: ModuleManifest['runtimeAllocation']
  events?: string[]
  ownedPaths?: string[]
  configurationSchemaRef?: string | null
  /** Full contracts owned by this module's provided operations. */
  operationContracts?: OperationContract[]
  /** Human-readable payload schemas referenced by the provided operation contracts. */
  dataSchemas?: ModuleDataSchema[]
  /** Type-specific applicable detail answers */
  answers: ModuleInterviewAnswer[]
  acceptanceCases?: { id: string; description: string; expectedOutcome: string }[]
  rules?: { id: string; text: string }[]
}

export type ModuleInterviewEvaluation = GateResult & {
  missingApplicableDetailIds: string[]
  unresolvedDomainQuestionIds: string[]
  manifest?: ModuleManifest
}

export type ModuleImportResult = {
  ok: boolean
  response?: ModuleInterviewResponse
  manifest?: ModuleManifest
  evaluation?: ModuleInterviewEvaluation
  diagnostics: CapDiagnostic[]
}

/** Single interview depth — applicable detail IDs per module type. */
export const MODULE_APPLICABLE_DETAILS: Record<ModuleType, readonly string[]> = {
  domain: [
    'responsibility',
    'exclusions',
    'vocabulary',
    'inputs-outputs',
    'units-ranges',
    'rules-invariants',
    'preconditions-postconditions',
    'exceptional-outcomes',
    'worked-examples',
    'sources-assumptions',
    'required-capabilities',
  ],
  workflow: [
    'responsibility',
    'exclusions',
    'trigger-actors',
    'main-sequence',
    'alternative-paths',
    'state-transitions',
    'cancellation',
    'partial-failure',
    'recovery',
    'permissions',
    'success-guarantee',
  ],
  connection: [
    'responsibility',
    'exclusions',
    'external-system',
    'available-operations',
    'io-translation',
    'environment',
    'authentication-secrets',
    'timeouts-cancellation',
    'failure-behavior',
    'version-compatibility',
    'execution-locality',
    'verification-approach',
  ],
  platform: [
    'responsibility',
    'exclusions',
    'storage-location',
    'retention',
    'access',
    'execution-mode',
    'recovery',
    'configuration',
  ],
  experience: [
    'responsibility',
    'exclusions',
    'supported-workflows',
    'required-information',
    'actions-results',
    'loading-empty-error',
    'responsive-a11y',
    'capability-bindings',
  ],
} as const

export function applicableDetailsFor(moduleType: ModuleType): readonly string[] {
  return MODULE_APPLICABLE_DETAILS[moduleType]
}

export function buildModuleInterviewPacket(input: {
  packetId: string
  projectId: string
  architecture: ArchitectureSpecification
  moduleId: string
  moduleType: ModuleType
  /** Version the next imported response must use (for example, the next patch during Revisit). */
  moduleVersion?: string
  dependencyContractIds?: string[]
}): InterviewPacket {
  const details = applicableDetailsFor(input.moduleType)
  const definition = input.architecture.moduleDefinitions?.find((candidate) => candidate.moduleId === input.moduleId)
  const moduleName = definition?.name ?? input.moduleId
  const moduleResponsibility = definition?.responsibility ?? 'Not yet described in the architecture.'
  const moduleNames = new Map(
    input.architecture.moduleDefinitions?.map((candidate) => [candidate.moduleId, candidate.name]) ?? [],
  )
  const architectureRole: Record<ModuleType, string> = {
    experience: 'inbound adapter',
    workflow: 'application orchestration',
    domain: 'domain core',
    connection: 'outbound external adapter',
    platform: 'outbound platform adapter',
  }
  const contextualFacts = [
    `moduleName:${moduleName}`,
    `moduleResponsibility:${moduleResponsibility}`,
    `architectureRole:${architectureRole[input.moduleType]}`,
    ...input.architecture.capabilityProjections
      .filter((capability) => capability.moduleIds.includes(input.moduleId))
      .map((capability) => `capabilityGroup:${capability.name}`),
    ...input.architecture.dependencyEdges.flatMap((edge) => {
      if (edge.fromModuleId === input.moduleId) {
        return [`usesModule:${edge.toModuleId} | ${moduleNames.get(edge.toModuleId) ?? edge.toModuleId} | ${edge.reason}`]
      }
      if (edge.toModuleId === input.moduleId) {
        return [`usedByModule:${edge.fromModuleId} | ${moduleNames.get(edge.fromModuleId) ?? edge.fromModuleId} | ${edge.reason}`]
      }
      return []
    }),
    ...input.architecture.operationAllocations
      .filter((allocation) => allocation.moduleId === input.moduleId)
      .map((allocation) => `allocatedOperation:${allocation.operationId}`),
    ...input.architecture.adapterAllocations
      .filter((allocation) => allocation.moduleId === input.moduleId)
      .map((allocation) => `allocatedAdapter:${allocation.adapterId} | port:${allocation.portId}`),
    ...input.architecture.workflowTraces
      .filter((trace) => trace.moduleIds.includes(input.moduleId))
      .map((trace) => `workflowTrace:${trace.useCaseId}`),
  ]
  return buildInterviewPacket({
    packetId: input.packetId,
    projectId: input.projectId,
    interviewKind: 'module',
    gateId: 'CAP-GATE-003',
    interviewBoundary: `module:${input.moduleType}`,
    stateLabels: {
      confirmed: ['architectureAllocation'],
      proposed: [...details],
      unresolved: [],
    },
    inputContext: {
      recordIds: [input.architecture.id, input.moduleId],
      revisions: [input.architecture.revision],
      hashes: [input.architecture.contentHash],
      facts: [
        `moduleType:${input.moduleType}`,
        `moduleVersion:${input.moduleVersion ?? '1.0.0'}`,
        `architecture:${input.architecture.id}@${input.architecture.revision}`,
        ...contextualFacts,
        ...details.map((d) => `detail:${d}`),
        ...(input.dependencyContractIds ?? []).map((id) => `contract:${id}`),
      ],
      glossary: [],
    },
  })
}

function packetFactValues(packet: InterviewPacket, prefix: string): string[] {
  return packet.inputContext.facts
    .filter((fact) => fact.startsWith(prefix))
    .map((fact) => fact.slice(prefix.length))
}

/** Context-aware instructions for the first conversational turn of a module interview. */
export function moduleInterviewOpeningGuidance(packet: InterviewPacket): string {
  if (packet.outputSchemaRef !== 'CAP-CONTRACT-003') return ''
  const moduleType = packetFactValues(packet, 'moduleType:')[0] ?? 'module'
  const moduleName = packetFactValues(packet, 'moduleName:')[0] ?? packet.inputContext.recordIds[1] ?? 'this module'
  const responsibility = packetFactValues(packet, 'moduleResponsibility:')[0] ?? 'not yet described'
  const role = packetFactValues(packet, 'architectureRole:')[0] ?? moduleType
  const capabilityGroups = packetFactValues(packet, 'capabilityGroup:')
  const uses = packetFactValues(packet, 'usesModule:')
  const usedBy = packetFactValues(packet, 'usedByModule:')
  const workflows = packetFactValues(packet, 'workflowTrace:')
  const connections = [...uses.map((value) => `uses ${value}`), ...usedBy.map((value) => `is used by ${value}`)]
  const typeSuggestions: Record<string, string> = {
    domain: 'Suggest likely domain vocabulary and invariants from the responsibility, then ask the user to correct or confirm the inputs, outputs, ranges, and exceptional outcomes implied by connected modules.',
    workflow: 'Suggest a likely trigger, actor, and happy-path sequence from the traced workflows, then ask the user to correct or confirm alternative paths, cancellation, recovery, and the success guarantee.',
    experience: 'Suggest the primary user task and information hierarchy from the supported workflows, then ask the user to correct or confirm actions, results, and loading, empty, error, responsive, and accessibility behavior.',
    connection: 'Suggest the external operations and translation boundary implied by the connected module and adapter, then ask the user to correct or confirm authentication, timeout, failure, compatibility, and verification behavior.',
    platform: 'Suggest the execution and storage model implied by the platform responsibility, then ask the user to correct or confirm location, retention, access, recovery, and configuration defaults.',
  }
  const context = [
    `- Module: ${moduleName} (${moduleType}; architecture role: ${role})`,
    `- Existing responsibility: ${responsibility}`,
    capabilityGroups.length ? `- Capability group: ${capabilityGroups.join(', ')}` : '',
    workflows.length ? `- Participates in workflow: ${workflows.join(', ')}` : '',
    connections.length ? `- Architecture connections: ${connections.join('; ')}` : '',
  ].filter(Boolean).join('\n')

  return `\nModule-specific opening guidance:
${context}
- Treat the supplied module identity, type, responsibility, allocation, and dependencies as established context. Do not begin by asking the user to restate them.
- Draft concrete answers for every applicable detail from the responsibility, workflow traces, operations, and connected modules before speaking to the user. Do not read the detail checklist back as questions.
- Open with a short plain-language recap and a compact proposed module brief. Clearly identify the few material assumptions, then ask the user to reply “accept” or list corrections in one response.
- Ask a follow-up batch only when the reply exposes a material contradiction or a business decision that cannot be safely defaulted. Do not conduct a serial, field-by-field interview.
- ${typeSuggestions[moduleType] ?? 'Suggest concrete defaults from the supplied architecture context and ask the user to correct or confirm them.'}
- For every provided operation, establish its command/query/job behavior, concrete input and output fields, preconditions, postconditions, domain rejections, technical errors, side effects, idempotency, timeout, and cancellation behavior. Encode these in operationContracts and dataSchemas in the final response rather than leaving them only in prose.
- Avoid identifier-heavy or checklist-style wording. Keep the confirmation request to at most five concise decision bullets that can be answered together.\n`
}

export function missingApplicableDetails(
  moduleType: ModuleType,
  answers: ModuleInterviewAnswer[],
): string[] {
  const required = applicableDetailsFor(moduleType)
  const present = new Set(
    answers.filter((a) => a.status !== 'unresolved' && a.text.trim()).map((a) => a.id),
  )
  return required.filter((id) => !present.has(id))
}

export function unresolvedDomainQuestions(answers: ModuleInterviewAnswer[]): string[] {
  return answers.filter((a) => a.status === 'unresolved').map((a) => a.id).sort((a, b) => a.localeCompare(b))
}

export function draftManifestFromResponse(
  response: ModuleInterviewResponse,
  architectureVersion: '1.0' = '1.0',
): ModuleManifest {
  return {
    schemaVersion: '1.0',
    architectureVersion,
    moduleId: response.moduleId,
    moduleVersion: response.moduleVersion ?? '1.0.0',
    moduleType: response.moduleType,
    name: response.name,
    responsibility: response.responsibility,
    ownedConcerns: response.ownedConcerns,
    excludedConcerns: response.excludedConcerns,
    providedOperations: response.providedOperations,
    requiredOperations: response.requiredOperations ?? [],
    configurationSchemaRef: response.configurationSchemaRef ?? null,
    verificationSuiteIds: response.verificationSuiteIds,
    runtimeAllocation: response.runtimeAllocation,
    events: response.events ?? [],
    ownedPaths: response.ownedPaths ?? [`capabilities/modules/${response.moduleId}/`],
  }
}

export function evaluateModuleInterview(response: ModuleInterviewResponse): ModuleInterviewEvaluation {
  const missingApplicableDetailIds = missingApplicableDetails(response.moduleType, response.answers)
  const unresolvedDomainQuestionIds = unresolvedDomainQuestions(response.answers)
  const manifest = draftManifestFromResponse(response)
  const gate = evaluateModuleGate(manifest, {
    unresolvedDomainQuestions: unresolvedDomainQuestionIds,
    acceptanceCases: response.acceptanceCases,
    rules: response.rules,
  })

  const extras: CapDiagnostic[] = []
  for (const id of missingApplicableDetailIds) {
    extras.push(
      diagnostic('CAP-GATE-003-APPLICABLE', 'applicable module interview detail is required', {
        ruleId: 'CAP-GATE-003',
        fieldPath: id,
        relatedIds: [response.moduleId],
      }),
    )
  }
  const contracts = new Map((response.operationContracts ?? []).map((contract) => [contract.operationId, contract]))
  const schemaIds = new Set((response.dataSchemas ?? []).map((schema) => schema.schemaId))
  const supportedScalars = new Set([
    'string', 'text', 'uuid', 'date', 'datetime', 'timestamp',
    'integer', 'int', 'number', 'float', 'double', 'decimal',
    'boolean', 'bool', 'unknown', 'any', 'object', 'json',
  ])
  const supportedSchemaType = (value: string): boolean => {
    const trimmed = value.trim()
    if (schemaIds.has(trimmed)) return true
    if (trimmed.toLowerCase().endsWith('[]')) return supportedSchemaType(trimmed.slice(0, -2))
    return supportedScalars.has(trimmed.toLowerCase())
  }
  for (const schema of response.dataSchemas ?? []) {
    for (const field of schema.fields ?? []) {
      if (supportedSchemaType(field.type)) continue
      extras.push(
        diagnostic('CAP-GATE-003-SCHEMA-TYPE', 'data schema field type must be a supported scalar, array, object, or supplied schemaId', {
          ruleId: 'CAP-GATE-003',
          fieldPath: `dataSchemas.${schema.schemaId}.${field.name}`,
          relatedIds: [schema.schemaId, field.name],
        }),
      )
    }
  }
  for (const operation of response.providedOperations) {
    const contract = contracts.get(operation.operationId)
    if (!contract || contract.version !== operation.contractVersion) {
      extras.push(
        diagnostic('CAP-GATE-003-CONTRACT', 'every provided operation requires a matching detailed operation contract', {
          ruleId: 'CAP-GATE-003',
          fieldPath: `operationContracts.${operation.operationId}`,
          relatedIds: [operation.operationId],
        }),
      )
      continue
    }
    for (const schemaRef of [contract.inputSchemaRef, contract.outputSchemaRef]) {
      if (!schemaIds.has(schemaRef)) {
        extras.push(
          diagnostic('CAP-GATE-003-SCHEMA', 'operation input and output schema references must resolve to a supplied data schema', {
            ruleId: 'CAP-GATE-003',
            fieldPath: `dataSchemas.${schemaRef}`,
            relatedIds: [operation.operationId, schemaRef],
          }),
        )
      }
    }
  }

  const diagnostics = sortDiagnostics([...gate.diagnostics, ...extras])
  return {
    gateId: 'CAP-GATE-003',
    passed: diagnostics.length === 0,
    diagnostics,
    missingApplicableDetailIds,
    unresolvedDomainQuestionIds,
    manifest,
  }
}

export function parseModuleInterviewResponse(raw: unknown): {
  response?: ModuleInterviewResponse
  diagnostics: CapDiagnostic[]
} {
  if (!raw || typeof raw !== 'object') {
    return {
      diagnostics: [
        diagnostic('CAP-MOD-IMPORT-SHAPE', 'module interview response must be a JSON object', {
          fieldPath: '$',
        }),
      ],
    }
  }
  const r = raw as Record<string, unknown>
  const moduleType = r.moduleType as ModuleType
  if (!moduleType || !(moduleType in MODULE_APPLICABLE_DETAILS)) {
    return {
      diagnostics: [
        diagnostic('CAP-MOD-IMPORT-TYPE', 'moduleType must be one of domain|workflow|connection|platform|experience', {
          fieldPath: 'moduleType',
        }),
      ],
    }
  }
  if (typeof r.moduleId !== 'string' || !r.moduleId.trim()) {
    return {
      diagnostics: [
        diagnostic('CAP-MOD-IMPORT-ID', 'moduleId is required', { fieldPath: 'moduleId' }),
      ],
    }
  }
  const response: ModuleInterviewResponse = {
    moduleId: r.moduleId,
    moduleType,
    name: typeof r.name === 'string' ? r.name : r.moduleId,
    moduleVersion: typeof r.moduleVersion === 'string' ? r.moduleVersion : '1.0.0',
    responsibility: typeof r.responsibility === 'string' ? r.responsibility : '',
    ownedConcerns: Array.isArray(r.ownedConcerns) ? (r.ownedConcerns as string[]) : [],
    excludedConcerns: Array.isArray(r.excludedConcerns) ? (r.excludedConcerns as string[]) : [],
    providedOperations: Array.isArray(r.providedOperations)
      ? (r.providedOperations as ModuleManifest['providedOperations'])
      : [],
    requiredOperations: Array.isArray(r.requiredOperations)
      ? (r.requiredOperations as ModuleManifest['requiredOperations'])
      : [],
    verificationSuiteIds: Array.isArray(r.verificationSuiteIds)
      ? (r.verificationSuiteIds as string[])
      : [],
    runtimeAllocation:
      r.runtimeAllocation === 'external-adapter' ? 'external-adapter' : 'local-embedded',
    events: Array.isArray(r.events) ? (r.events as string[]) : [],
    ownedPaths: Array.isArray(r.ownedPaths) ? (r.ownedPaths as string[]) : undefined,
    configurationSchemaRef:
      r.configurationSchemaRef === null || typeof r.configurationSchemaRef === 'string'
        ? (r.configurationSchemaRef as string | null)
        : null,
    operationContracts: Array.isArray(r.operationContracts)
      ? (r.operationContracts as OperationContract[])
      : [],
    dataSchemas: Array.isArray(r.dataSchemas) ? (r.dataSchemas as ModuleDataSchema[]) : [],
    answers: Array.isArray(r.answers) ? (r.answers as ModuleInterviewAnswer[]) : [],
    acceptanceCases: Array.isArray(r.acceptanceCases)
      ? (r.acceptanceCases as ModuleInterviewResponse['acceptanceCases'])
      : undefined,
    rules: Array.isArray(r.rules) ? (r.rules as ModuleInterviewResponse['rules']) : undefined,
  }
  return { response, diagnostics: [] }
}

export function importModuleInterviewResponse(raw: unknown): ModuleImportResult {
  const parsed = parseModuleInterviewResponse(raw)
  if (!parsed.response) {
    return { ok: false, diagnostics: parsed.diagnostics }
  }
  const evaluation = evaluateModuleInterview(parsed.response)
  const schemaDiagnostics = validateContractRecord('CAP-CONTRACT-003', evaluation.manifest!).map((d) =>
    diagnostic(d.code, d.message, { fieldPath: d.fieldPath, relatedIds: d.relatedIds }),
  )
  const operationContractDiagnostics = (parsed.response.operationContracts ?? []).flatMap((contract) =>
    validateContractRecord('CAP-CONTRACT-004', contract).map((d) =>
      diagnostic(d.code, d.message, {
        fieldPath: d.fieldPath ? `operationContracts.${contract.operationId}.${d.fieldPath}` : `operationContracts.${contract.operationId}`,
        relatedIds: [contract.operationId, ...(d.relatedIds ?? [])],
      }),
    ),
  )
  const diagnostics = sortDiagnostics([
    ...parsed.diagnostics,
    ...evaluation.diagnostics,
    ...(evaluation.passed ? schemaDiagnostics : []),
    ...(evaluation.passed ? operationContractDiagnostics : []),
  ])
  const schemaFailed = evaluation.passed && (schemaDiagnostics.length > 0 || operationContractDiagnostics.length > 0)
  return {
    ok: evaluation.passed && !schemaFailed,
    response: parsed.response,
    manifest: evaluation.manifest,
    evaluation: schemaFailed
      ? { ...evaluation, passed: false, diagnostics }
      : evaluation,
    diagnostics,
  }
}

export function approveModuleIfReady(
  workspace: CapabilityWorkspace,
  projectId: string,
  response: ModuleInterviewResponse,
):
  | { ok: true; approved: ModuleManifest; evaluation: ModuleInterviewEvaluation }
  | { ok: false; evaluation: ModuleInterviewEvaluation } {
  const evaluation = evaluateModuleInterview(response)
  if (!evaluation.passed || !evaluation.manifest) return { ok: false, evaluation }
  const schemaDiagnostics = [
    ...validateContractRecord('CAP-CONTRACT-003', evaluation.manifest),
    ...(response.operationContracts ?? []).flatMap((contract) =>
      validateContractRecord('CAP-CONTRACT-004', contract).map((item) => ({
        ...item,
        fieldPath: item.fieldPath
          ? `operationContracts.${contract.operationId}.${item.fieldPath}`
          : `operationContracts.${contract.operationId}`,
        relatedIds: [contract.operationId, ...(item.relatedIds ?? [])],
      })),
    ),
  ]
  if (schemaDiagnostics.length) {
    return {
      ok: false,
      evaluation: {
        ...evaluation,
        passed: false,
        diagnostics: sortDiagnostics([
          ...evaluation.diagnostics,
          ...schemaDiagnostics.map((d) =>
            diagnostic(d.code, d.message, { fieldPath: d.fieldPath, relatedIds: d.relatedIds }),
          ),
        ]),
      },
    }
  }
  const approved = workspace.approveModule(projectId, evaluation.manifest, response)
  return { ok: true, approved, evaluation }
}
