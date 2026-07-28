import fs from 'node:fs'
import path from 'node:path'
import {
  canonicalHash,
  compileScenarioDefinitions,
  createModuleDesignDraft,
  evaluateModuleDesign,
  projectModuleDiagrams,
  type ActivityNode,
  type ApplicationSpecification,
  type ArchitectureSpecification,
  type ModuleBehaviorSpecification,
  type ModuleDesignSpecification,
  type ModuleManifest,
  type OperationContract,
} from '@engineering-ui-kit/core'
import {
  buildAssuranceModuleBehavior,
  buildDo178ApplicationWorkflows,
  buildDo178UseCases,
  buildDo178WorkflowAllocations,
} from '../apps/gui/src/do178BehaviorFixture.js'

const root = path.resolve('examples/do178-audit-hub/capabilities')
const applicationPath = path.join(root, 'approved/application.json')
const architecturePath = path.join(root, 'approved/architecture.json')
const foundationPath = path.join(root, 'approved/foundation.json')
const implementationArchitecturePath = path.join(root, 'implementation-architecture.json')
const moduleSourceRoot = path.join(root, 'approved/module-specifications')
const moduleDesignRoot = path.join(root, 'approved/module-designs')

function read<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

function write(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function manifestFor(
  architecture: ArchitectureSpecification,
  moduleId: string,
): ModuleManifest {
  const source = read<Record<string, unknown>>(path.join(moduleSourceRoot, `${moduleId}.json`))
  const definition = architecture.moduleDefinitions?.find((item) => item.moduleId === moduleId)
  return {
    schemaVersion: '1.0',
    architectureVersion: '1.0',
    moduleId,
    moduleVersion: String(source.moduleVersion ?? '1.0.0'),
    moduleType: source.moduleType as ModuleManifest['moduleType'],
    name: definition?.name ?? moduleId,
    responsibility: String(source.responsibility ?? definition?.responsibility ?? ''),
    ownedConcerns: ['Module behavior'],
    excludedConcerns: Array.isArray(source.nonResponsibilities)
      ? source.nonResponsibilities as string[]
      : [],
    providedOperations: Array.isArray(source.providedOperations)
      ? source.providedOperations as ModuleManifest['providedOperations']
      : [],
    requiredOperations: Array.isArray(source.requiredOperations)
      ? source.requiredOperations as ModuleManifest['requiredOperations']
      : [],
    configurationSchemaRef: null,
    verificationSuiteIds: [`acceptance:${moduleId}`],
    runtimeAllocation: 'local-embedded',
    events: [],
    ownedPaths: Array.isArray(source.ownedPaths) ? source.ownedPaths as string[] : [],
  }
}

function genericBehavior(
  base: ModuleBehaviorSpecification,
  moduleId: string,
  application: ApplicationSpecification,
  architecture: ArchitectureSpecification,
): ModuleBehaviorSpecification {
  const allocations = architecture.workflowTraces.flatMap((trace) =>
    (trace.nodeAllocations ?? []).filter((allocation) =>
      allocation.primaryModuleId === moduleId))
  const workflowNodeById = new Map((application.applicationWorkflows ?? [])
    .flatMap((workflow) => workflow.graph.nodes)
    .map((node) => [node.id, node]))
  const declaredOperations = new Set([
    ...architecture.operationAllocations
      .filter((allocation) => allocation.moduleId === moduleId)
      .map((allocation) => allocation.operationId),
  ])
  const actions: ActivityNode[] = allocations.map((allocation) => {
    const source = workflowNodeById.get(allocation.nodeId)
    const operationId = allocation.operationId && declaredOperations.has(allocation.operationId)
      ? allocation.operationId
      : undefined
    return {
      id: `module:${moduleId}:refine:${allocation.nodeId}`,
      kind: operationId ? 'call-operation' : 'action',
      label: source?.label ?? 'Perform allocated action',
      description: source
        ? `The module performs the allocated ${source.label.toLowerCase()} action.`
        : 'The module performs the allocated application action.',
      refinesIds: [allocation.nodeId],
      ...(operationId ? { operationId } : {}),
    }
  })
  const initialId = `module:${moduleId}:initial`
  const finalId = `module:${moduleId}:final`
  const orderedIds = [initialId, ...actions.map((node) => node.id), finalId]
  return {
    ...base,
    preconditions: ['The application request is valid.'],
    postconditions: ['The module returns an observable result.'],
    retry: 'Retry only a declared technical failure.',
    recovery: 'Keep the last valid module state.',
    activityDefinitions: [{
      id: `activity:${moduleId}:allocated-actions`,
      name: 'Perform allocated actions',
      refinesWorkflowNodeIds: allocations.map((allocation) => allocation.nodeId),
      graph: {
        id: `activity:${moduleId}:allocated-actions:graph`,
        name: 'Perform allocated actions',
        nodes: [
          {
            id: initialId,
            kind: 'initial',
            label: 'Initial',
            description: 'The module activity starts.',
            refinesIds: [],
          },
          ...actions,
          {
            id: finalId,
            kind: 'final',
            label: 'Final',
            description: 'The module activity ends.',
            refinesIds: [],
          },
        ],
        edges: orderedIds.slice(0, -1).map((fromNodeId, index) => ({
          id: `activity:${moduleId}:edge:${index + 1}`,
          fromNodeId,
          toNodeId: orderedIds[index + 1]!,
          traceIds: allocations.flatMap((allocation) => [allocation.workflowId, allocation.nodeId]),
        })),
      },
    }],
    stateDefinitions: [],
    stateTransitions: [],
    interactionDefinitions: [],
  }
}

function approveDesign(
  application: ApplicationSpecification,
  architecture: ArchitectureSpecification,
  manifest: ModuleManifest,
): ModuleDesignSpecification {
  const design = createModuleDesignDraft({
    application,
    architecture,
    manifest,
    revision: '1.1.0',
  })
  const source = read<Record<string, unknown>>(
    path.join(moduleSourceRoot, `${manifest.moduleId}.json`),
  )
  design.schemas = (Array.isArray(source.canonicalSchemaRefs)
    ? source.canonicalSchemaRefs as string[]
    : []).map((schemaId) => ({ id: schemaId, text: schemaId }))
  design.behavior = manifest.moduleId === 'mod.assurance-workflow'
    ? buildAssuranceModuleBehavior(design.behavior)
    : genericBehavior(design.behavior, manifest.moduleId, application, architecture)
  design.diagrams = projectModuleDiagrams({ application, architecture, design })
  const contractOperations = [
    ...manifest.providedOperations.map((operation) => ({
      operationId: operation.operationId,
      version: operation.contractVersion,
    })),
    ...manifest.requiredOperations.map((operation) => ({
      operationId: operation.operationId,
      version: '1.0.0',
    })),
  ]
  const contracts: OperationContract[] = contractOperations.map((operation) => ({
    schemaVersion: '1.0',
    operationId: operation.operationId,
    version: operation.version,
    behavior: 'command',
    inputSchemaRef: `${operation.operationId}.input`,
    outputSchemaRef: `${operation.operationId}.output`,
    preconditions: [],
    postconditions: [],
    domainRejections: [],
    technicalErrors: [],
    sideEffects: [],
    idempotency: 'unknown',
    timeoutClass: 'medium',
    cancellable: true,
    artifactTypes: [],
    provenanceFields: [],
  }))
  const evaluation = evaluateModuleDesign(design, contracts, undefined, { application, architecture })
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
  design.status = evaluation.passed ? 'approved' : 'needsInput'
  if (evaluation.passed) {
    design.approval = {
      approvedAt: '2026-07-28T00:00:00.000Z',
      approvedBy: 'DO-178C sample fixture',
    }
  }
  design.contentHash = canonicalHash({ ...design, contentHash: undefined })
  if (!evaluation.passed) {
    throw new Error(
      `${manifest.moduleId} module design failed: ${evaluation.diagnostics
        .map((item) => `${item.code} ${item.fieldPath ?? ''}`)
        .join(', ')}`,
    )
  }
  return design
}

const application = read<ApplicationSpecification>(applicationPath)
application.useCaseDefinitions = buildDo178UseCases(application)
application.applicationWorkflows = buildDo178ApplicationWorkflows(application)
application.scenarioDefinitions = compileScenarioDefinitions(application)
const {
  contentHash: _applicationContentHash,
  approvedAt: _applicationApprovedAt,
  ...applicationBody
} = application
application.contentHash = canonicalHash(applicationBody)

const architecture = read<ArchitectureSpecification>(architecturePath)
const allocations = buildDo178WorkflowAllocations()
architecture.applicationSpecRevision = application.revision
architecture.applicationSpecHash = application.contentHash
architecture.workflowTraces = architecture.workflowTraces.map((trace) => allocations[trace.useCaseId]
  ? {
    ...trace,
    moduleIds: [...new Set(allocations[trace.useCaseId]!.flatMap((allocation) => [
      allocation.primaryModuleId,
      ...allocation.participatingModuleIds,
    ]))],
    nodeAllocations: allocations[trace.useCaseId],
  }
  : trace)
const {
  contentHash: _architectureContentHash,
  approvedAt: _architectureApprovedAt,
  ...architectureBody
} = architecture
architecture.contentHash = canonicalHash(architectureBody)

write(applicationPath, application)
write(architecturePath, architecture)

const foundation = read<Record<string, unknown>>(foundationPath)
foundation.architectureHash = architecture.contentHash
foundation.contentHash = canonicalHash({ ...foundation, contentHash: undefined })
write(foundationPath, foundation)

const implementationArchitecture = read<{
  refines: {
    architectureId: string
    architectureRevision: string
    architectureHash: string
    groupingModuleId: string
  }
}>(implementationArchitecturePath)
implementationArchitecture.refines.architectureHash = architecture.contentHash
write(implementationArchitecturePath, implementationArchitecture)

for (const moduleId of [
  'mod.audit-experience',
  'mod.workspace-snapshots',
  'mod.evidence-graph',
  'mod.assurance-workflow',
  'mod.evidence-store',
  'mod.external-adapters',
]) {
  write(
    path.join(moduleDesignRoot, `${moduleId}.json`),
    approveDesign(application, architecture, manifestFor(architecture, moduleId)),
  )
}
