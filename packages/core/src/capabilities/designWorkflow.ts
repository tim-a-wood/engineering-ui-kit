/**
 * Record-driven module design and UML projections.
 *
 * These functions contain no renderer state. The GUI can lay out the returned
 * nodes and edges, but it cannot invent or mutate design semantics.
 */

import { diagnostic, sortDiagnostics, type CapDiagnostic } from './diagnostics.js'
import { canonicalHash } from './hash.js'
import { evaluateModuleDesignSte, type SteLexicon } from './simplifiedTechnicalEnglish.js'
import { allUseCaseSteps, materializeUseCaseDefinitions } from './useCaseAnalysis.js'
import {
  evaluateArchitectureApplicationLink,
  materializeApplicationWorkflows,
  materializeWorkflowNodeAllocations,
} from './applicationWorkflow.js'
import {
  evaluateModuleBehavior,
  projectModuleBehaviorDiagrams,
} from './moduleBehavior.js'
import type {
  ApplicationSpecification,
  ArchitectureSpecification,
  DiagramProjection,
  DiagramProjectionEdge,
  DiagramProjectionNode,
  ModuleDesignSession,
  ModuleDesignSpecification,
  ModuleManifest,
  OperationContract,
  RuntimeLanguage,
  UseCaseDefinition,
} from './types.js'

function definitionFor(architecture: ArchitectureSpecification, moduleId: string) {
  return architecture.moduleDefinitions?.find((definition) => definition.moduleId === moduleId)
}

function humanLabelFromId(value: string): string {
  const slug = value.split(/[.:/]/).filter(Boolean).at(-1) ?? value
  const tokens = slug
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .split(/[-_]+/)
    .filter(Boolean)
    .filter((token, index, all) =>
      !(index === 0 && all.length > 1 && /^(?:actor|app|mod|module)$/i.test(token)))
  return tokens.map((token, index) => {
    const normalized = token.toLowerCase()
    if (normalized === 'api' || normalized === 'ui' || normalized === 'uml') {
      return normalized.toUpperCase()
    }
    if (normalized === 'matlab') return 'MATLAB'
    const objectiveStandard = normalized.match(/^do(\d+)([a-z])?$/)
    if (objectiveStandard) {
      return `DO-${objectiveStandard[1]}${objectiveStandard[2]?.toUpperCase() ?? ''}`
    }
    return index === 0
      ? `${normalized[0]?.toUpperCase() ?? ''}${normalized.slice(1)}`
      : normalized
  }).join(' ')
}

function moduleName(architecture: ArchitectureSpecification, moduleId: string): string {
  return definitionFor(architecture, moduleId)?.name ?? humanLabelFromId(moduleId)
}

function selectedUseCases(
  application: ApplicationSpecification,
  architecture: ArchitectureSpecification,
  moduleId: string,
): UseCaseDefinition[] {
  const ids = new Set(
    architecture.workflowTraces
      .filter((trace) => trace.moduleIds.includes(moduleId))
      .map((trace) => trace.useCaseId),
  )
  return materializeUseCaseDefinitions(application).filter((useCase) => ids.has(useCase.id))
}

function blankBehavior(): ModuleDesignSpecification['behavior'] {
  return {
    preconditions: [],
    postconditions: [],
    domainRejections: [],
    technicalFailures: [],
    sideEffects: [],
    idempotency: 'Not defined',
    cancellation: 'Not defined',
    timeouts: 'Not defined',
    concurrency: 'Not defined',
    retry: 'Not defined',
    recovery: 'Not defined',
    emittedEvents: [],
    consumedEvents: [],
    stateDefinitions: [],
    stateTransitions: [],
    activityDefinitions: [],
    interactionDefinitions: [],
    states: [],
    activities: [],
    interactions: [],
  }
}

export function createModuleDesignDraft(input: {
  application: ApplicationSpecification
  architecture: ArchitectureSpecification
  manifest: ModuleManifest
  operationContracts?: OperationContract[]
  behaviorDraft?: ModuleDesignSpecification['behavior']
  steLexicon?: SteLexicon
  revision?: string
  deployableId?: string
  runtimeLanguage?: RuntimeLanguage
}): ModuleDesignSpecification {
  const { application, architecture, manifest } = input
  if (!evaluateArchitectureApplicationLink(application, architecture).current) {
    throw new Error('The approved architecture is stale. Revise it for the current application workflow.')
  }
  const useCases = selectedUseCases(application, architecture, manifest.moduleId)
  const traceUseCaseIds = useCases.map((useCase) => useCase.id)
  const workflowAllocations = materializeWorkflowNodeAllocations(application, architecture)
    .filter((allocation) => allocation.primaryModuleId === manifest.moduleId)
  const workflowNodeIds = [...new Set(workflowAllocations.map((allocation) => allocation.nodeId))]
  const workflowNodeById = new Map(
    materializeApplicationWorkflows(application)
      .flatMap((workflow) => workflow.graph.nodes)
      .map((node) => [node.id, node]),
  )
  const allocations = workflowNodeIds.flatMap((nodeId) => workflowNodeById.get(nodeId)?.refinesIds ?? [])
  const dependencies = architecture.dependencyEdges
    .filter((edge) => edge.fromModuleId === manifest.moduleId)
    .map((edge) => edge.toModuleId)
  const consumers = architecture.dependencyEdges
    .filter((edge) => edge.toModuleId === manifest.moduleId)
    .map((edge) => edge.fromModuleId)
  const acceptanceIds = new Set(useCases.flatMap((useCase) => useCase.acceptanceCaseIds))
  const rules = application.rules.filter((rule) => useCases.some((useCase) => useCase.ruleIds.includes(rule.id)))
  const design: ModuleDesignSpecification = {
    schemaVersion: '1.0',
    projectId: application.projectId,
    id: `module-design:${manifest.moduleId}`,
    revision: input.revision ?? manifest.moduleVersion,
    status: 'draft',
    architecture: {
      id: architecture.id,
      revision: architecture.revision,
      contentHash: architecture.contentHash,
    },
    module: {
      moduleId: manifest.moduleId,
      moduleVersion: manifest.moduleVersion,
      name: manifest.name,
      moduleType: manifest.moduleType,
      responsibility: manifest.responsibility,
      nonResponsibilities: [...manifest.excludedConcerns],
      ownedConcerns: [...manifest.ownedConcerns],
      excludedConcerns: [...manifest.excludedConcerns],
    },
    trace: {
      useCaseIds: traceUseCaseIds,
      workflowNodeIds,
      scenarioStepIds: [...new Set(allocations)],
      ruleIds: rules.map((rule) => rule.id),
      qualityRequirementIds: [],
      sourceRefs: [...new Set(useCases.flatMap((useCase) => useCase.sourceRefs))],
      designDecisionIds: [],
    },
    boundary: {
      directDependencyIds: dependencies,
      directConsumerIds: consumers,
      deployableId: input.deployableId ?? 'unassigned',
      runtimeAllocation: manifest.runtimeAllocation,
      runtimeLanguage: input.runtimeLanguage ?? 'typescript',
      ownedPaths: [...manifest.ownedPaths],
      editableSharedPaths: [],
    },
    providedOperations: [...manifest.providedOperations],
    requiredOperations: [...manifest.requiredOperations],
    schemas: [],
    rules,
    invariants: [],
    behavior: input.behaviorDraft
      ? structuredClone(input.behaviorDraft)
      : blankBehavior(),
    data: {
      persistentRecords: [],
      ownership: [],
      retention: [],
      migrationNeeds: [],
      confidentiality: 'Not classified',
      provenanceFields: [],
      canonicalUnits: [],
    },
    runtime: {
      configurationRefs: manifest.configurationSchemaRef ? [manifest.configurationSchemaRef] : [],
      secretRefs: [],
      lifecycleRegistration: 'Not defined',
      health: [],
      telemetry: [],
      resourceOwnership: [],
      startup: [],
      shutdown: [],
      compatibilityConstraints: [],
    },
    verification: {
      examples: [],
      edgeCases: [],
      acceptanceCaseIds: [...acceptanceIds],
      verificationSuiteIds: [...manifest.verificationSuiteIds],
      requiredEvidence: [...new Set(useCases.flatMap((useCase) =>
        allUseCaseSteps(useCase).map((step) => step.evidencePolicy)))],
      testDoubles: [],
      fixtureNeeds: [],
      commands: [],
    },
    diagrams: [],
    unresolvedItems: [],
    gates: [],
    contentHash: '',
  }
  design.diagrams = projectModuleDiagrams({ application, architecture, design })
  const evaluation = evaluateModuleDesign(
    design,
    input.operationContracts ?? [],
    input.steLexicon,
    { application, architecture },
  )
  design.gates = [{
    gateId: 'CAP-GATE-MODULE-DESIGN',
    passed: evaluation.passed,
    diagnostics: evaluation.diagnostics.map((item, index) => ({
      id: `${item.code}:${index + 1}`,
      code: item.code,
      message: item.message,
      relatedIds: item.relatedIds,
    })),
  }]
  design.status = evaluation.passed ? 'readyForReview' : 'needsInput'
  design.contentHash = canonicalHash({ ...design, contentHash: undefined })
  return design
}

export function evaluateModuleDesign(
  design: ModuleDesignSpecification,
  operationContracts: OperationContract[] = [],
  steLexicon?: SteLexicon,
  context?: {
    application: ApplicationSpecification
    architecture: ArchitectureSpecification
  },
): {
  passed: boolean
  diagnostics: CapDiagnostic[]
  reviewDiagnostics: ReturnType<typeof evaluateModuleDesignSte>['reviewDiagnostics']
} {
  const diagnostics: CapDiagnostic[] = []
  const languageEvaluation = evaluateModuleDesignSte(design, steLexicon)
  diagnostics.push(...languageEvaluation.diagnostics)
  if (!design.module.responsibility.trim()) {
    diagnostics.push(diagnostic('CAP-MODULE-DESIGN-RESPONSIBILITY', 'module responsibility is required', {
      fieldPath: 'module.responsibility',
    }))
  }
  if (!design.trace.useCaseIds.length) {
    diagnostics.push(diagnostic('CAP-MODULE-DESIGN-TRACE', 'module must serve at least one approved use case', {
      fieldPath: 'trace.useCaseIds',
    }))
  }
  if (!design.trace.scenarioStepIds.length) {
    diagnostics.push(diagnostic('CAP-MODULE-DESIGN-STEPS', 'module must identify the scenario steps it performs', {
      fieldPath: 'trace.scenarioStepIds',
    }))
  }
  const contractKeys = new Set(operationContracts.map((contract) => `${contract.operationId}@${contract.version}`))
  for (const operation of design.providedOperations) {
    if (!contractKeys.has(`${operation.operationId}@${operation.contractVersion}`)) {
      diagnostics.push(diagnostic('CAP-MODULE-DESIGN-CONTRACT', 'provided operation requires an approved contract', {
        fieldPath: `providedOperations.${operation.operationId}`,
        relatedIds: [operation.operationId],
      }))
    }
  }
  if ((design.providedOperations.length || design.requiredOperations.length) && !design.schemas.length) {
    diagnostics.push(diagnostic('CAP-MODULE-DESIGN-SCHEMA', 'operation inputs and outputs require schema references', {
      fieldPath: 'schemas',
    }))
  }
  if (!design.verification.acceptanceCaseIds.length) {
    diagnostics.push(diagnostic('CAP-MODULE-DESIGN-ACCEPTANCE', 'module requires at least one traced acceptance case', {
      fieldPath: 'verification.acceptanceCaseIds',
    }))
  }
  if (design.unresolvedItems.some((item) => item.materiality === 'material')) {
    diagnostics.push(diagnostic('CAP-MODULE-DESIGN-UNRESOLVED', 'material unresolved items block module approval', {
      fieldPath: 'unresolvedItems',
      relatedIds: design.unresolvedItems
        .filter((item) => item.materiality === 'material')
        .map((item) => item.id),
    }))
  }
  if (context) {
    diagnostics.push(...evaluateArchitectureApplicationLink(
      context.application,
      context.architecture,
    ).diagnostics)
    if (
      design.architecture.id !== context.architecture.id
      || design.architecture.revision !== context.architecture.revision
      || design.architecture.contentHash !== context.architecture.contentHash
    ) {
      diagnostics.push(diagnostic(
        'CAP-MODULE-DESIGN-ARCHITECTURE-STALE',
        'The module design uses an earlier architecture revision.',
        {
          fieldPath: 'architecture',
          relatedIds: [design.module.moduleId, design.architecture.revision],
        },
      ))
    }
    diagnostics.push(...evaluateModuleBehavior({
      ...context,
      design,
      operationContracts,
    }).diagnostics)
  } else if (design.behavior.activityDefinitions !== undefined && !design.behavior.activityDefinitions.length) {
    diagnostics.push(diagnostic(
      'CAP-MODULE-BEHAVIOR-REQUIRED',
      'Add a structured module activity before approval.',
      { fieldPath: 'behavior.activityDefinitions', relatedIds: [design.module.moduleId] },
    ))
  }
  for (const diagram of design.diagrams) {
    diagnostics.push(...diagram.diagnostics
      .filter((item) => !item.code.endsWith('NOT-APPLICABLE'))
      .map((item) => diagnostic(item.code, item.message, {
      relatedIds: item.relatedIds,
      fieldPath: `diagrams.${diagram.kind}`,
      })))
  }
  const sorted = sortDiagnostics(diagnostics)
  return {
    passed: sorted.length === 0,
    diagnostics: sorted,
    reviewDiagnostics: languageEvaluation.reviewDiagnostics,
  }
}

export function createModuleDesignSession(input: {
  projectId: string
  moduleId: string
  architecture: ArchitectureSpecification
  baseModuleDesignRevision?: string
  contextLimit?: number
  now?: string
}): ModuleDesignSession {
  const now = input.now ?? new Date().toISOString()
  const entries = [
    {
      kind: 'record' as const,
      ref: input.architecture.id,
      contentHash: input.architecture.contentHash,
      bytes: JSON.stringify(input.architecture).length,
      priority: 100,
      inclusionReason: 'Approved system structure and workflow allocation',
    },
  ]
  const sourceManifest = {
    id: `context:${input.moduleId}:${input.architecture.revision}`,
    targetRecordId: input.moduleId,
    targetRevision: input.baseModuleDesignRevision ?? 'new',
    tokenOrByteLimit: input.contextLimit ?? 250_000,
    totalBytes: entries.reduce((total, entry) => total + entry.bytes, 0),
    entries,
    omitted: [],
    contentHash: '',
  }
  sourceManifest.contentHash = canonicalHash({ ...sourceManifest, contentHash: undefined })
  return {
    schemaVersion: '1.0',
    id: `module-design-session:${input.moduleId}:${now}`,
    projectId: input.projectId,
    moduleId: input.moduleId,
    baseArchitectureRevision: input.architecture.revision,
    baseModuleDesignRevision: input.baseModuleDesignRevision,
    state: 'created',
    currentStep: 'boundary',
    completedSteps: [],
    sourceManifest,
    answers: [],
    diagnostics: [],
    createdAt: now,
    updatedAt: now,
  }
}

function diagram(
  input: Omit<DiagramProjection, 'schemaVersion' | 'contentHash'>,
): DiagramProjection {
  const value: DiagramProjection = { schemaVersion: '1.0', ...input, contentHash: '' }
  value.contentHash = canonicalHash({ ...value, contentHash: undefined })
  return value
}

function operationKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function operationLabel(value: string): string {
  const segments = value.split(/[.:/]/).filter(Boolean)
  const localName = segments.at(-1) ?? value
  const normalizedLocalName = localName
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/^op\s+/, '')
  const ownerName = segments.length > 1 && segments.at(-2)?.toLowerCase() !== 'op'
    ? segments.at(-2)!
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .trim()
        .toLowerCase()
    : ''
  const words = normalizedLocalName && !normalizedLocalName.includes(' ') && ownerName
    ? `${normalizedLocalName} ${ownerName}`
    : normalizedLocalName
  return words ? `${words[0]!.toUpperCase()}${words.slice(1)}` : 'Use operation'
}

function searchableTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.endsWith('ies')
      ? `${token.slice(0, -3)}y`
      : token.endsWith('s') && token.length > 4 ? token.slice(0, -1) : token)
    .filter((token) => token.length > 2 && token !== 'the' && token !== 'and')
}

function operationReasonScore(operationId: string, reason: string): number {
  const reasonTokens = new Set(searchableTokens(reason))
  return searchableTokens(operationId)
    .filter((token) => token !== 'op')
    .reduce((score, token) => score + (reasonTokens.has(token) ? 1 : 0), 0)
}

function providedOperationsByConsumer(
  architecture: ArchitectureSpecification,
  design: ModuleDesignSpecification,
): Map<string, ModuleDesignSpecification['providedOperations'][number]> {
  const moduleId = design.module.moduleId
  const edges = architecture.dependencyEdges.filter((edge) => edge.toModuleId === moduleId)
  const available = [...design.providedOperations]
  const assigned = new Map<string, ModuleDesignSpecification['providedOperations'][number]>()

  while (available.length && assigned.size < edges.length) {
    const candidates = edges
      .filter((edge) => !assigned.has(edge.fromModuleId))
      .map((edge, edgeIndex) => {
        const operations = available
          .map((operation, operationIndex) => ({
            operation,
            operationIndex,
            score: operationReasonScore(operation.operationId, edge.reason),
          }))
          .filter((candidate) => candidate.score > 0)
          .sort((left, right) =>
            right.score - left.score
            || left.operationIndex - right.operationIndex)
        return { edge, edgeIndex, operations }
      })
      .filter((candidate) => candidate.operations.length)
      .sort((left, right) =>
        left.operations.length - right.operations.length
        || right.operations[0]!.score - left.operations[0]!.score
        || left.edgeIndex - right.edgeIndex)
    const selected = candidates[0]
    if (!selected) break
    const operation = selected.operations[0]!.operation
    assigned.set(selected.edge.fromModuleId, operation)
    available.splice(available.findIndex((candidate) => candidate.operationId === operation.operationId), 1)
  }

  return assigned
}

function componentDiagram(input: {
  application: ApplicationSpecification
  architecture: ArchitectureSpecification
  design: ModuleDesignSpecification
}): DiagramProjection {
  const { architecture, design } = input
  const moduleId = design.module.moduleId
  const relatedEdges = architecture.dependencyEdges
    .filter((edge) => edge.fromModuleId === moduleId || edge.toModuleId === moduleId)
  const directConsumerIds = relatedEdges
    .filter((edge) => edge.toModuleId === moduleId)
    .map((edge) => edge.fromModuleId)
  const directDependencyIds = relatedEdges
    .filter((edge) => edge.fromModuleId === moduleId)
    .map((edge) => edge.toModuleId)
  const providedByConsumer = providedOperationsByConsumer(architecture, design)
  const relatedIds = [...new Set([
    ...directConsumerIds,
    moduleId,
    ...directDependencyIds,
  ])]
  const nodes: DiagramProjectionNode[] = relatedIds.map((id) => ({
    id: `component:${id}`,
    kind: 'component',
    label: moduleName(architecture, id),
    stereotype: 'component',
    description: definitionFor(architecture, id)?.responsibility
      ?? `${moduleName(architecture, id)} participates in this workflow.`,
    sourceRecordId: architecture.id,
    traceIds: architecture.workflowTraces
      .filter((trace) => trace.moduleIds.includes(id))
      .map((trace) => trace.useCaseId),
  }))
  for (const operation of design.providedOperations) {
    nodes.push({
      id: `provided:${moduleId}:${operation.operationId}`,
      kind: 'provided-interface',
      label: operationLabel(operation.operationId),
      description: `${design.module.name} provides this operation.`,
      sourceRecordId: design.id,
      traceIds: design.trace.useCaseIds,
      parentId: `component:${moduleId}`,
    })
  }
  for (const operation of design.requiredOperations) {
    nodes.push({
      id: `required:${moduleId}:${operation.operationId}`,
      kind: 'required-interface',
      label: operationLabel(operation.operationId),
      description: `${design.module.name} requires this operation.`,
      sourceRecordId: design.id,
      traceIds: design.trace.useCaseIds,
      parentId: `component:${moduleId}`,
    })
  }
  const peripheralPortIds = new Set<string>()
  const edges: DiagramProjectionEdge[] = relatedEdges.flatMap((edge) => {
    const requiredOperations = edge.fromModuleId === moduleId
      ? design.requiredOperations.filter((operation) =>
        architecture.operationAllocations.some((allocation) =>
          operationKey(allocation.operationId) === operationKey(operation.operationId)
          && allocation.moduleId === edge.toModuleId))
      : []
    const providedOperation = edge.toModuleId === moduleId
      ? providedByConsumer.get(edge.fromModuleId)
      : undefined
    const operations = providedOperation ? [providedOperation] : requiredOperations
    if (!operations.length) {
      return [{
        id: `dependency:${edge.fromModuleId}:${edge.toModuleId}`,
        kind: 'dependency',
        fromId: `component:${edge.fromModuleId}`,
        toId: `component:${edge.toModuleId}`,
        label: '«use»',
        description: edge.reason,
        sourceRecordId: architecture.id,
        traceIds: architecture.workflowTraces
          .filter((trace) => trace.moduleIds.includes(edge.fromModuleId) && trace.moduleIds.includes(edge.toModuleId))
          .map((trace) => trace.useCaseId),
      } satisfies DiagramProjectionEdge]
    }
    return operations.map((operation): DiagramProjectionEdge => {
      let fromId: string
      let toId: string
      if (providedOperation) {
        const consumerPortId = `required:${edge.fromModuleId}:${providedOperation.operationId}:for:${moduleId}`
        if (!peripheralPortIds.has(consumerPortId)) {
          peripheralPortIds.add(consumerPortId)
          nodes.push({
            id: consumerPortId,
            kind: 'required-interface',
            label: operationLabel(providedOperation.operationId),
            description: `${moduleName(architecture, edge.fromModuleId)} requires this operation.`,
            sourceRecordId: architecture.id,
            traceIds: design.trace.useCaseIds,
            parentId: `component:${edge.fromModuleId}`,
          })
        }
        fromId = consumerPortId
        toId = `provided:${moduleId}:${providedOperation.operationId}`
      } else {
        const providerPortId = `provided:${edge.toModuleId}:${operation.operationId}:for:${moduleId}`
        if (!peripheralPortIds.has(providerPortId)) {
          peripheralPortIds.add(providerPortId)
          nodes.push({
            id: providerPortId,
            kind: 'provided-interface',
            label: operationLabel(operation.operationId),
            description: `${moduleName(architecture, edge.toModuleId)} provides this operation.`,
            sourceRecordId: architecture.id,
            traceIds: design.trace.useCaseIds,
            parentId: `component:${edge.toModuleId}`,
          })
        }
        fromId = `required:${moduleId}:${operation.operationId}`
        toId = providerPortId
      }
      return {
        id: `assembly:${edge.fromModuleId}:${edge.toModuleId}:${operation.operationId}`,
        kind: 'assembly',
        fromId,
        toId,
        label: operationLabel(operation.operationId),
        description: edge.reason,
        sourceRecordId: architecture.id,
        traceIds: architecture.workflowTraces
          .filter((trace) =>
            trace.moduleIds.includes(edge.fromModuleId)
            && trace.moduleIds.includes(edge.toModuleId))
          .map((trace) => trace.useCaseId),
      }
    })
  })
  return diagram({
    id: `diagram:component:${moduleId}`,
    kind: 'component',
    level: 'module',
    sourceRecordIds: [input.application.id, architecture.id, design.id],
    projectId: input.application.projectId,
    contextId: moduleId,
    title: `${design.module.name} component diagram`,
    sourceRevision: design.revision,
    nodes,
    edges,
    diagnostics: [],
    textAlternative: `${design.module.name} with ${directConsumerIds.length} direct consumers and ${directDependencyIds.length} direct dependencies.`,
  })
}

export function projectModuleDiagrams(input: {
  application: ApplicationSpecification
  architecture: ArchitectureSpecification
  design: ModuleDesignSpecification
}): DiagramProjection[] {
  return [
    componentDiagram(input),
    ...projectModuleBehaviorDiagrams(input),
  ]
}
