/**
 * Type-specific module interviews — CAP-PKT-011 / CAP-GATE-003.
 * One bounded interview depth and one ModuleManifest schema across types.
 */

import { diagnostic, sortDiagnostics, type CapDiagnostic } from './diagnostics.js'
import { evaluateModuleGate, type GateResult } from './gates.js'
import { buildInterviewPacket } from './packets.js'
import { canonicalHash } from './hash.js'
import type { CapabilityWorkspace } from './persistence.js'
import { validateContractRecord } from './validation.js'
import {
  evaluateModuleInterviewSte,
  type SteLexicon,
  type SteReviewDiagnostic,
} from './simplifiedTechnicalEnglish.js'
import type {
  ActivityEdge,
  ActivityNodeKind,
  ArchitectureSpecification,
  InterviewPacket,
  ModuleBehaviorSpecification,
  ModuleInteractionFragment,
  ModuleInteractionMessage,
  ModuleInteractionParticipant,
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
  /** Draft internal behavior for the later module-design approval authority. */
  behaviorDraft?: ModuleBehaviorSpecification
}

export type ModuleInterviewEvaluation = GateResult & {
  missingApplicableDetailIds: string[]
  unresolvedDomainQuestionIds: string[]
  manifest?: ModuleManifest
  reviewDiagnostics: SteReviewDiagnostic[]
}

export type ModuleImportResult = {
  ok: boolean
  response?: ModuleInterviewResponse
  manifest?: ModuleManifest
  evaluation?: ModuleInterviewEvaluation
  diagnostics: CapDiagnostic[]
  reviewDiagnostics?: SteReviewDiagnostic[]
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
      .flatMap((trace) => [
        `workflowTrace:${trace.useCaseId}`,
        ...(trace.nodeAllocations ?? [])
          .filter((allocation) => allocation.primaryModuleId === input.moduleId)
          .map((allocation) =>
            `allocatedWorkflowNode:${allocation.workflowId}:${allocation.nodeId}:operation=${allocation.operationId ?? ''}:event=${allocation.eventId ?? ''}`),
      ]),
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
      revisions: [input.architecture.revision, input.moduleVersion ?? '1.0.0'],
      hashes: [
        input.architecture.contentHash,
        canonicalHash({
          moduleId: input.moduleId,
          moduleType: input.moduleType,
          moduleVersion: input.moduleVersion ?? '1.0.0',
          definition,
          contextualFacts,
        }),
      ],
      facts: [
        `moduleType:${input.moduleType}`,
        `moduleVersion:${input.moduleVersion ?? '1.0.0'}`,
        `architecture:${input.architecture.id}@${input.architecture.revision}`,
        ...contextualFacts,
        ...details.map((d) => `detail:${d}`),
        ...(input.dependencyContractIds ?? []).map((id) => `contract:${id}`),
      ],
      glossary: (input.architecture.moduleDefinitions ?? []).map((item) => ({
        id: item.moduleId,
        text: item.name,
      })),
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
  const allocatedNodes = packetFactValues(packet, 'allocatedWorkflowNode:')
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
    allocatedNodes.length ? `- Allocated application actions: ${allocatedNodes.join('; ')}` : '',
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
- Propose structured internal module activities and state transitions that refine only the allocated application actions. Include operation calls, events, material failures, retries, and recovery. Do not introduce new application scope or copy the application workflow as the module algorithm.
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

export function evaluateModuleInterview(
  response: ModuleInterviewResponse,
  lexicon?: SteLexicon,
): ModuleInterviewEvaluation {
  const missingApplicableDetailIds = missingApplicableDetails(response.moduleType, response.answers)
  const unresolvedDomainQuestionIds = unresolvedDomainQuestions(response.answers)
  const manifest = draftManifestFromResponse(response)
  const language = evaluateModuleInterviewSte(response, lexicon)
  const gate = evaluateModuleGate(manifest, {
    unresolvedDomainQuestions: unresolvedDomainQuestionIds,
    acceptanceCases: response.acceptanceCases,
    rules: response.rules,
  }, lexicon)
  const gateDiagnosticKeys = new Set(gate.diagnostics.map((item) =>
    `${item.code}\u0000${item.fieldPath ?? ''}\u0000${item.message}`))
  const interviewLanguageDiagnostics = language.diagnostics.filter((item) =>
    !gateDiagnosticKeys.has(`${item.code}\u0000${item.fieldPath ?? ''}\u0000${item.message}`))

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

  const diagnostics = sortDiagnostics([
    ...gate.diagnostics,
    ...extras,
    ...interviewLanguageDiagnostics,
  ])
  return {
    gateId: 'CAP-GATE-003',
    passed: diagnostics.length === 0,
    diagnostics,
    missingApplicableDetailIds,
    unresolvedDomainQuestionIds,
    manifest,
    reviewDiagnostics: language.reviewDiagnostics,
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
  const nestedDiagnostics: CapDiagnostic[] = []
  const objectItems = (
    value: unknown,
    fieldPath: string,
  ): Record<string, unknown>[] => {
    if (!Array.isArray(value)) {
      if (value !== undefined) {
        nestedDiagnostics.push(diagnostic(
          'CAP-MOD-IMPORT-LIST',
          'Replace the invalid value with a list of JSON objects.',
          { fieldPath },
        ))
      }
      return []
    }
    return value.flatMap((item, index) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        return [item as Record<string, unknown>]
      }
      nestedDiagnostics.push(diagnostic(
        'CAP-MOD-IMPORT-ITEM',
        'Remove the invalid list item or replace it with a JSON object.',
        { fieldPath: `${fieldPath}.${index}` },
      ))
      return []
    })
  }
  const stringItems = (value: unknown, fieldPath: string): string[] => {
    if (!Array.isArray(value)) {
      if (value !== undefined) {
        nestedDiagnostics.push(diagnostic(
          'CAP-MOD-IMPORT-LIST',
          'Replace the invalid value with a list of text values.',
          { fieldPath },
        ))
      }
      return []
    }
    return value.flatMap((item, index) => {
      if (typeof item === 'string') return [item]
      nestedDiagnostics.push(diagnostic(
        'CAP-MOD-IMPORT-TEXT',
        'Replace the invalid list item with text.',
        { fieldPath: `${fieldPath}.${index}` },
      ))
      return []
    })
  }
  const textValue = (value: unknown, fieldPath: string): string => {
    if (typeof value === 'string') return value
    nestedDiagnostics.push(diagnostic(
      'CAP-MOD-IMPORT-TEXT',
      'Replace the invalid value with text.',
      { fieldPath },
    ))
    return ''
  }
  const requiredText = (
    value: unknown,
    fieldPath: string,
    fallback: string,
  ): string => {
    if (typeof value === 'string' && value.trim()) return value
    nestedDiagnostics.push(diagnostic(
      'CAP-MOD-IMPORT-TEXT',
      'Replace the invalid value with nonempty text.',
      { fieldPath },
    ))
    return fallback
  }
  const optionalText = (value: unknown, fieldPath: string): string | undefined => {
    if (value === undefined || value === null || value === '') return undefined
    return textValue(value, fieldPath)
  }
  const recordValue = (value: unknown, fieldPath: string): Record<string, unknown> => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>
    }
    nestedDiagnostics.push(diagnostic(
      'CAP-MOD-IMPORT-OBJECT',
      'Replace the invalid value with a JSON object.',
      { fieldPath },
    ))
    return {}
  }
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
  const behaviorDraft = (() => {
    if (r.behaviorDraft === undefined) return undefined
    const behavior = recordValue(r.behaviorDraft, 'behaviorDraft')
    const activityNodeKinds = new Set([
      'initial',
      'action',
      'call-operation',
      'decision',
      'merge',
      'fork',
      'join',
      'send-event',
      'receive-event',
      'final',
    ])
    const outcomes = new Set(['success', 'alternate', 'failure', 'recovery'])
    const participantKinds = new Set(['actor', 'module', 'operation', 'external'])
    const messageKinds = new Set(['synchronous', 'reply', 'event'])
    const fragmentKinds = new Set(['alt', 'opt', 'loop'])
    const activityDefinitions = objectItems(
      behavior.activityDefinitions,
      'behaviorDraft.activityDefinitions',
    ).map((activity, activityIndex) => {
      const activityPath = `behaviorDraft.activityDefinitions.${activityIndex}`
      const graph = recordValue(activity.graph, `${activityPath}.graph`)
      return {
        id: requiredText(activity.id, `${activityPath}.id`, `activity-${activityIndex + 1}`),
        name: requiredText(activity.name, `${activityPath}.name`, 'Define module activity'),
        entryOperationId: optionalText(
          activity.entryOperationId,
          `${activityPath}.entryOperationId`,
        ),
        refinesWorkflowNodeIds: stringItems(
          activity.refinesWorkflowNodeIds,
          `${activityPath}.refinesWorkflowNodeIds`,
        ),
        graph: {
          id: requiredText(graph.id, `${activityPath}.graph.id`, `activity-${activityIndex + 1}:graph`),
          name: requiredText(graph.name, `${activityPath}.graph.name`, 'Define module activity'),
          nodes: objectItems(graph.nodes, `${activityPath}.graph.nodes`).map((node, nodeIndex) => {
            const nodePath = `${activityPath}.graph.nodes.${nodeIndex}`
            const kind = typeof node.kind === 'string' && activityNodeKinds.has(node.kind)
              ? node.kind
              : 'action'
            if (kind !== node.kind) {
              nestedDiagnostics.push(diagnostic(
                'CAP-MOD-IMPORT-ACTIVITY-KIND',
                'Use a supported module activity node kind.',
                { fieldPath: `${nodePath}.kind` },
              ))
            }
            return {
              id: requiredText(node.id, `${nodePath}.id`, `node-${nodeIndex + 1}`),
              kind: kind as ActivityNodeKind,
              label: requiredText(node.label, `${nodePath}.label`, 'Define module action'),
              description: requiredText(
                node.description,
                `${nodePath}.description`,
                'Define the internal module action.',
              ),
              refinesIds: stringItems(node.refinesIds, `${nodePath}.refinesIds`),
              actorId: optionalText(node.actorId, `${nodePath}.actorId`),
              operationId: optionalText(node.operationId, `${nodePath}.operationId`),
              eventId: optionalText(node.eventId, `${nodePath}.eventId`),
            }
          }),
          edges: objectItems(graph.edges, `${activityPath}.graph.edges`).map((edge, edgeIndex) => {
            const edgePath = `${activityPath}.graph.edges.${edgeIndex}`
            const outcome = typeof edge.outcome === 'string' && outcomes.has(edge.outcome)
              ? edge.outcome
              : undefined
            if (edge.outcome !== undefined && !outcome) {
              nestedDiagnostics.push(diagnostic(
                'CAP-MOD-IMPORT-ACTIVITY-OUTCOME',
                'Use success, alternate, failure, or recovery.',
                { fieldPath: `${edgePath}.outcome` },
              ))
            }
            const loop = edge.loop === undefined
              ? undefined
              : recordValue(edge.loop, `${edgePath}.loop`)
            return {
              id: requiredText(edge.id, `${edgePath}.id`, `edge-${edgeIndex + 1}`),
              fromNodeId: requiredText(edge.fromNodeId, `${edgePath}.fromNodeId`, ''),
              toNodeId: requiredText(edge.toNodeId, `${edgePath}.toNodeId`, ''),
              guard: optionalText(edge.guard, `${edgePath}.guard`),
              outcome: outcome as ActivityEdge['outcome'] | undefined,
              loop: loop
                ? {
                  exitCondition: requiredText(
                    loop.exitCondition,
                    `${edgePath}.loop.exitCondition`,
                    '',
                  ),
                  maximumIterations: typeof loop.maximumIterations === 'number'
                    ? loop.maximumIterations
                    : undefined,
                }
                : undefined,
              traceIds: stringItems(edge.traceIds, `${edgePath}.traceIds`),
            }
          }),
        },
      }
    })
    const stateDefinitions = objectItems(
      behavior.stateDefinitions,
      'behaviorDraft.stateDefinitions',
    ).map((state, index) => ({
      id: requiredText(state.id, `behaviorDraft.stateDefinitions.${index}.id`, `state-${index + 1}`),
      name: requiredText(state.name, `behaviorDraft.stateDefinitions.${index}.name`, 'Define state'),
      parentStateId: optionalText(
        state.parentStateId,
        `behaviorDraft.stateDefinitions.${index}.parentStateId`,
      ),
      entryActionIds: stringItems(
        state.entryActionIds,
        `behaviorDraft.stateDefinitions.${index}.entryActionIds`,
      ),
      exitActionIds: stringItems(
        state.exitActionIds,
        `behaviorDraft.stateDefinitions.${index}.exitActionIds`,
      ),
    }))
    const stateTransitions = objectItems(
      behavior.stateTransitions,
      'behaviorDraft.stateTransitions',
    ).map((transition, index) => ({
      id: requiredText(
        transition.id,
        `behaviorDraft.stateTransitions.${index}.id`,
        `transition-${index + 1}`,
      ),
      fromStateId: requiredText(
        transition.fromStateId,
        `behaviorDraft.stateTransitions.${index}.fromStateId`,
        '',
      ),
      toStateId: requiredText(
        transition.toStateId,
        `behaviorDraft.stateTransitions.${index}.toStateId`,
        '',
      ),
      trigger: requiredText(
        transition.trigger,
        `behaviorDraft.stateTransitions.${index}.trigger`,
        'Define trigger',
      ),
      guard: optionalText(
        transition.guard,
        `behaviorDraft.stateTransitions.${index}.guard`,
      ),
      effectActivityNodeIds: stringItems(
        transition.effectActivityNodeIds,
        `behaviorDraft.stateTransitions.${index}.effectActivityNodeIds`,
      ),
    }))
    const interactionDefinitions = objectItems(
      behavior.interactionDefinitions,
      'behaviorDraft.interactionDefinitions',
    ).map((interaction, interactionIndex) => {
      const interactionPath = `behaviorDraft.interactionDefinitions.${interactionIndex}`
      return {
        id: requiredText(
          interaction.id,
          `${interactionPath}.id`,
          `interaction-${interactionIndex + 1}`,
        ),
        name: requiredText(
          interaction.name,
          `${interactionPath}.name`,
          'Define internal interaction',
        ),
        participants: objectItems(
          interaction.participants,
          `${interactionPath}.participants`,
        ).map((participant, index) => {
          const kind = typeof participant.kind === 'string' && participantKinds.has(participant.kind)
            ? participant.kind
            : 'module'
          if (kind !== participant.kind) {
            nestedDiagnostics.push(diagnostic(
              'CAP-MOD-IMPORT-PARTICIPANT-KIND',
              'Use actor, module, operation, or external.',
              { fieldPath: `${interactionPath}.participants.${index}.kind` },
            ))
          }
          return {
            id: requiredText(
              participant.id,
              `${interactionPath}.participants.${index}.id`,
              `participant-${index + 1}`,
            ),
            label: requiredText(
              participant.label,
              `${interactionPath}.participants.${index}.label`,
              'Define participant',
            ),
            kind: kind as ModuleInteractionParticipant['kind'],
          }
        }),
        messages: objectItems(interaction.messages, `${interactionPath}.messages`)
          .map((message, index) => {
            const kind = typeof message.kind === 'string' && messageKinds.has(message.kind)
              ? message.kind
              : 'synchronous'
            if (kind !== message.kind) {
              nestedDiagnostics.push(diagnostic(
                'CAP-MOD-IMPORT-MESSAGE-KIND',
                'Use synchronous, reply, or event.',
                { fieldPath: `${interactionPath}.messages.${index}.kind` },
              ))
            }
            return {
              id: requiredText(
                message.id,
                `${interactionPath}.messages.${index}.id`,
                `message-${index + 1}`,
              ),
              fromParticipantId: requiredText(
                message.fromParticipantId,
                `${interactionPath}.messages.${index}.fromParticipantId`,
                '',
              ),
              toParticipantId: requiredText(
                message.toParticipantId,
                `${interactionPath}.messages.${index}.toParticipantId`,
                '',
              ),
              label: requiredText(
                message.label,
                `${interactionPath}.messages.${index}.label`,
                'Call module operation',
              ),
              kind: kind as ModuleInteractionMessage['kind'],
              operationId: optionalText(
                message.operationId,
                `${interactionPath}.messages.${index}.operationId`,
              ),
              eventId: optionalText(
                message.eventId,
                `${interactionPath}.messages.${index}.eventId`,
              ),
              guard: optionalText(
                message.guard,
                `${interactionPath}.messages.${index}.guard`,
              ),
              refinesActivityNodeIds: stringItems(
                message.refinesActivityNodeIds,
                `${interactionPath}.messages.${index}.refinesActivityNodeIds`,
              ),
            }
          }),
        fragments: objectItems(interaction.fragments, `${interactionPath}.fragments`)
          .map((fragment, index) => {
            const kind = typeof fragment.kind === 'string' && fragmentKinds.has(fragment.kind)
              ? fragment.kind
              : 'alt'
            if (kind !== fragment.kind) {
              nestedDiagnostics.push(diagnostic(
                'CAP-MOD-IMPORT-FRAGMENT-KIND',
                'Use alt, opt, or loop.',
                { fieldPath: `${interactionPath}.fragments.${index}.kind` },
              ))
            }
            return {
              id: requiredText(
                fragment.id,
                `${interactionPath}.fragments.${index}.id`,
                `fragment-${index + 1}`,
              ),
              kind: kind as ModuleInteractionFragment['kind'],
              label: requiredText(
                fragment.label,
                `${interactionPath}.fragments.${index}.label`,
                'Alternate result',
              ),
              guard: optionalText(
                fragment.guard,
                `${interactionPath}.fragments.${index}.guard`,
              ),
              messageIds: stringItems(
                fragment.messageIds,
                `${interactionPath}.fragments.${index}.messageIds`,
              ),
            }
          }),
      }
    })
    return {
      preconditions: stringItems(behavior.preconditions, 'behaviorDraft.preconditions'),
      postconditions: stringItems(behavior.postconditions, 'behaviorDraft.postconditions'),
      domainRejections: stringItems(behavior.domainRejections, 'behaviorDraft.domainRejections'),
      technicalFailures: stringItems(behavior.technicalFailures, 'behaviorDraft.technicalFailures'),
      sideEffects: stringItems(behavior.sideEffects, 'behaviorDraft.sideEffects'),
      idempotency: requiredText(behavior.idempotency, 'behaviorDraft.idempotency', 'Not defined'),
      cancellation: requiredText(behavior.cancellation, 'behaviorDraft.cancellation', 'Not defined'),
      timeouts: requiredText(behavior.timeouts, 'behaviorDraft.timeouts', 'Not defined'),
      concurrency: requiredText(behavior.concurrency, 'behaviorDraft.concurrency', 'Not defined'),
      retry: requiredText(behavior.retry, 'behaviorDraft.retry', 'Not defined'),
      recovery: requiredText(behavior.recovery, 'behaviorDraft.recovery', 'Not defined'),
      emittedEvents: stringItems(behavior.emittedEvents, 'behaviorDraft.emittedEvents'),
      consumedEvents: stringItems(behavior.consumedEvents, 'behaviorDraft.consumedEvents'),
      stateDefinitions,
      stateTransitions,
      activityDefinitions,
      interactionDefinitions,
      states: [],
      activities: [],
      interactions: [],
    } satisfies ModuleBehaviorSpecification
  })()
  const response: ModuleInterviewResponse = {
    moduleId: r.moduleId,
    moduleType,
    name: requiredText(r.name, 'name', r.moduleId),
    moduleVersion: requiredText(r.moduleVersion, 'moduleVersion', '1.0.0'),
    responsibility: requiredText(r.responsibility, 'responsibility', ''),
    ownedConcerns: stringItems(r.ownedConcerns, 'ownedConcerns'),
    excludedConcerns: stringItems(r.excludedConcerns, 'excludedConcerns'),
    providedOperations: objectItems(
      r.providedOperations,
      'providedOperations',
    ).map((operation, index) => ({
      operationId: textValue(operation.operationId, `providedOperations.${index}.operationId`),
      contractVersion: textValue(
        operation.contractVersion,
        `providedOperations.${index}.contractVersion`,
      ),
    })),
    requiredOperations: objectItems(
      r.requiredOperations,
      'requiredOperations',
    ).map((operation, index) => ({
      operationId: textValue(operation.operationId, `requiredOperations.${index}.operationId`),
      acceptedContractRange: textValue(
        operation.acceptedContractRange,
        `requiredOperations.${index}.acceptedContractRange`,
      ),
      reason: textValue(operation.reason, `requiredOperations.${index}.reason`),
    })),
    verificationSuiteIds: stringItems(r.verificationSuiteIds, 'verificationSuiteIds'),
    runtimeAllocation: (() => {
      if (r.runtimeAllocation === 'external-adapter' || r.runtimeAllocation === 'local-embedded') {
        return r.runtimeAllocation
      }
      nestedDiagnostics.push(diagnostic(
        'CAP-MOD-IMPORT-RUNTIME',
        'Use local-embedded or external-adapter.',
        { fieldPath: 'runtimeAllocation' },
      ))
      return 'local-embedded'
    })(),
    events: stringItems(r.events, 'events'),
    ownedPaths: r.ownedPaths === undefined ? undefined : stringItems(r.ownedPaths, 'ownedPaths'),
    configurationSchemaRef: (() => {
      if (
        r.configurationSchemaRef === undefined
        || r.configurationSchemaRef === null
        || typeof r.configurationSchemaRef === 'string'
      ) {
        return (r.configurationSchemaRef ?? null) as string | null
      }
      nestedDiagnostics.push(diagnostic(
        'CAP-MOD-IMPORT-CONFIGURATION',
        'Use a text schema reference or null.',
        { fieldPath: 'configurationSchemaRef' },
      ))
      return null
    })(),
    operationContracts: objectItems(
      r.operationContracts,
      'operationContracts',
    ).map((contract, index) => {
      const behavior = contract.behavior === 'command'
        || contract.behavior === 'query'
        || contract.behavior === 'job'
        ? contract.behavior
        : 'command'
      const idempotency = contract.idempotency === 'idempotent'
        || contract.idempotency === 'non-idempotent'
        || contract.idempotency === 'unknown'
        ? contract.idempotency
        : 'unknown'
      const timeoutClass = contract.timeoutClass === 'short'
        || contract.timeoutClass === 'medium'
        || contract.timeoutClass === 'long'
        ? contract.timeoutClass
        : 'medium'
      if (
        behavior !== contract.behavior
        || idempotency !== contract.idempotency
        || timeoutClass !== contract.timeoutClass
        || typeof contract.cancellable !== 'boolean'
        || (contract.schemaVersion !== undefined && contract.schemaVersion !== '1.0')
      ) {
        nestedDiagnostics.push(diagnostic(
          'CAP-MOD-IMPORT-CONTRACT',
          'Use valid operation contract values.',
          { fieldPath: `operationContracts.${index}` },
        ))
      }
      return {
        schemaVersion: '1.0',
        operationId: textValue(contract.operationId, `operationContracts.${index}.operationId`),
        version: textValue(contract.version, `operationContracts.${index}.version`),
        behavior,
        inputSchemaRef: textValue(
          contract.inputSchemaRef,
          `operationContracts.${index}.inputSchemaRef`,
        ),
        outputSchemaRef: textValue(
          contract.outputSchemaRef,
          `operationContracts.${index}.outputSchemaRef`,
        ),
        preconditions: stringItems(
          contract.preconditions,
          `operationContracts.${index}.preconditions`,
        ),
        postconditions: stringItems(
          contract.postconditions,
          `operationContracts.${index}.postconditions`,
        ),
        domainRejections: stringItems(
          contract.domainRejections,
          `operationContracts.${index}.domainRejections`,
        ),
        technicalErrors: stringItems(
          contract.technicalErrors,
          `operationContracts.${index}.technicalErrors`,
        ),
        sideEffects: stringItems(
          contract.sideEffects,
          `operationContracts.${index}.sideEffects`,
        ),
        idempotency,
        timeoutClass,
        cancellable: contract.cancellable === true,
        artifactTypes: stringItems(
          contract.artifactTypes,
          `operationContracts.${index}.artifactTypes`,
        ),
        provenanceFields: stringItems(
          contract.provenanceFields,
          `operationContracts.${index}.provenanceFields`,
        ),
      } satisfies OperationContract
    }),
    dataSchemas: objectItems(r.dataSchemas, 'dataSchemas').map((schema, schemaIndex) => ({
      schemaId: requiredText(
        schema.schemaId,
        `dataSchemas.${schemaIndex}.schemaId`,
        `schema-${schemaIndex + 1}`,
      ),
      description: requiredText(
        schema.description,
        `dataSchemas.${schemaIndex}.description`,
        '',
      ),
      fields: objectItems(schema.fields, `dataSchemas.${schemaIndex}.fields`).map((field, fieldIndex) => {
        if (typeof field.required !== 'boolean') {
          nestedDiagnostics.push(diagnostic(
            'CAP-MOD-IMPORT-FIELD',
            'Use true or false for the required value.',
            { fieldPath: `dataSchemas.${schemaIndex}.fields.${fieldIndex}.required` },
          ))
        }
        return {
          name: requiredText(
            field.name,
            `dataSchemas.${schemaIndex}.fields.${fieldIndex}.name`,
            '',
          ),
          type: requiredText(
            field.type,
            `dataSchemas.${schemaIndex}.fields.${fieldIndex}.type`,
            '',
          ),
          required: field.required === true,
          description: requiredText(
            field.description,
            `dataSchemas.${schemaIndex}.fields.${fieldIndex}.description`,
            '',
          ),
          constraints: stringItems(
            field.constraints,
            `dataSchemas.${schemaIndex}.fields.${fieldIndex}.constraints`,
          ),
        }
      }),
    })),
    answers: objectItems(r.answers, 'answers').map((answer, index) => {
      const status = answer.status === 'confirmed'
        || answer.status === 'proposed'
        || answer.status === 'unresolved'
        ? answer.status
        : 'unresolved'
      if (
        typeof answer.id !== 'string'
        || typeof answer.text !== 'string'
        || status !== answer.status
      ) {
        nestedDiagnostics.push(diagnostic(
          'CAP-MOD-IMPORT-ANSWER',
          'Each answer requires an ID, text, and valid status.',
          { fieldPath: `answers.${index}` },
        ))
      }
      return {
        id: typeof answer.id === 'string' ? answer.id : `answer-${index + 1}`,
        text: typeof answer.text === 'string' ? answer.text : '',
        status,
      }
    }),
    acceptanceCases: objectItems(r.acceptanceCases, 'acceptanceCases').map((item, index) => ({
      id: requiredText(item.id, `acceptanceCases.${index}.id`, `acceptance-${index + 1}`),
      description: requiredText(item.description, `acceptanceCases.${index}.description`, ''),
      expectedOutcome: requiredText(
        item.expectedOutcome,
        `acceptanceCases.${index}.expectedOutcome`,
        '',
      ),
    })),
    rules: objectItems(r.rules, 'rules').map((item, index) => ({
      id: requiredText(item.id, `rules.${index}.id`, `rule-${index + 1}`),
      text: requiredText(item.text, `rules.${index}.text`, ''),
    })),
    behaviorDraft,
  }
  return { response, diagnostics: sortDiagnostics(nestedDiagnostics) }
}

export function importModuleInterviewResponse(
  raw: unknown,
  lexicon?: SteLexicon,
): ModuleImportResult {
  const parsed = parseModuleInterviewResponse(raw)
  if (!parsed.response) {
    return { ok: false, diagnostics: parsed.diagnostics }
  }
  const evaluation = evaluateModuleInterview(parsed.response, lexicon)
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
  const importFailed = parsed.diagnostics.length > 0
  return {
    ok: evaluation.passed && !schemaFailed && !importFailed,
    response: parsed.response,
    manifest: evaluation.manifest,
    evaluation: schemaFailed || importFailed
      ? { ...evaluation, passed: false, diagnostics }
      : evaluation,
    diagnostics,
    reviewDiagnostics: evaluation.reviewDiagnostics,
  }
}

export function approveModuleIfReady(
  workspace: CapabilityWorkspace,
  projectId: string,
  response: ModuleInterviewResponse,
):
  | { ok: true; approved: ModuleManifest; evaluation: ModuleInterviewEvaluation }
  | { ok: false; evaluation: ModuleInterviewEvaluation } {
  const evaluation = evaluateModuleInterview(response, workspace.getSteLexicon(projectId))
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
