/**
 * Scenario-level verification records and evidence rules.
 *
 * Core accepts observed step results from a runner. It never fabricates a
 * passing result or a screenshot artifact.
 */

import { diagnostic, sortDiagnostics, type CapDiagnostic } from './diagnostics.js'
import { canonicalHash } from './hash.js'
import {
  evaluateArchitectureApplicationLink,
  materializeApplicationWorkflows,
  materializeWorkflowNodeAllocations,
} from './applicationWorkflow.js'
import { allUseCaseSteps, compileScenarioDefinitions, materializeUseCaseDefinitions, useCaseAnalysisHash } from './useCaseAnalysis.js'
import type {
  ApplicationSpecification,
  ArchitectureSpecification,
  ModuleDesignSpecification,
  ScenarioDefinition,
  ScenarioOutcome,
  ScenarioRunRecord,
  ScenarioStepEvidence,
  ScenarioStepResult,
} from './types.js'

export type ScenarioStepModuleTrace = {
  moduleId: string
  participatingModuleIds: string[]
  operationId?: string
  eventId?: string
  entryPointId?: string
  moduleDesignId?: string
  moduleDesignRevision?: string
  activityIds: string[]
  activityNodeIds: string[]
  operationIds: string[]
  eventIds: string[]
  stale: boolean
}

export type ScenarioStepTrace = {
  scenarioId: string
  scenarioStepId: string
  workflowId?: string
  workflowNodeIds: string[]
  modules: ScenarioStepModuleTrace[]
  evidence: ScenarioStepEvidence[]
  result?: ScenarioStepResult
  staleApplication: boolean
  staleArchitecture: boolean
  staleModuleIds: string[]
}

/**
 * Resolve one observed application step through the approved workflow,
 * solution allocation, module behavior, and recorded evidence. The projection
 * contains references only; it does not copy behavior between authority levels.
 */
export function projectScenarioStepTrace(input: {
  application: ApplicationSpecification
  architecture: ArchitectureSpecification
  moduleDesigns: ModuleDesignSpecification[]
  scenarioId: string
  scenarioStepId: string
  record?: ScenarioRunRecord
}): ScenarioStepTrace {
  const scenario = scenarioDefinition(input.application, input.scenarioId)
  const workflows = materializeApplicationWorkflows(input.application)
  const workflow = workflows.find((candidate) =>
    candidate.id === scenario.workflowId
    || candidate.useCaseId === scenario.useCaseId)
  const scenarioNodeIds = new Set(scenario.workflowNodeIds ?? [])
  const workflowNodes = (workflow?.graph.nodes ?? []).filter((node) =>
    node.refinesIds.includes(input.scenarioStepId)
    && (!scenarioNodeIds.size || scenarioNodeIds.has(node.id)))
  const workflowNodeIds = workflowNodes.map((node) => node.id)
  const allocations = materializeWorkflowNodeAllocations(input.application, input.architecture)
    .filter((allocation) =>
      allocation.workflowId === workflow?.id
      && workflowNodeIds.includes(allocation.nodeId))
  const designByModule = new Map(input.moduleDesigns.map((design) => [
    design.module.moduleId,
    design,
  ]))
  const modules = allocations.map((allocation): ScenarioStepModuleTrace => {
    const design = designByModule.get(allocation.primaryModuleId)
    const activities = (design?.behavior.activityDefinitions ?? []).filter((activity) =>
      activity.refinesWorkflowNodeIds.includes(allocation.nodeId)
      || activity.graph.nodes.some((node) => node.refinesIds.includes(allocation.nodeId)))
    const activityNodes = activities.flatMap((activity) =>
      activity.graph.nodes.filter((node) => node.refinesIds.includes(allocation.nodeId)))
    const expectedRevision = input.record?.identity.moduleDesignRevisions[allocation.primaryModuleId]
    const stale = Boolean(
      design
      && (
        (expectedRevision && expectedRevision !== design.revision)
        || design.architecture.revision !== input.architecture.revision
      ),
    ) || Boolean(expectedRevision && !design)
    return {
      moduleId: allocation.primaryModuleId,
      participatingModuleIds: [...allocation.participatingModuleIds],
      operationId: allocation.operationId,
      eventId: allocation.eventId,
      entryPointId: allocation.entryPointId,
      moduleDesignId: design?.id,
      moduleDesignRevision: design?.revision,
      activityIds: activities.map((activity) => activity.id),
      activityNodeIds: activityNodes.map((node) => node.id),
      operationIds: [...new Set([
        ...(allocation.operationId ? [allocation.operationId] : []),
        ...activityNodes.flatMap((node) => node.operationId ? [node.operationId] : []),
      ])],
      eventIds: [...new Set([
        ...(allocation.eventId ? [allocation.eventId] : []),
        ...activityNodes.flatMap((node) => node.eventId ? [node.eventId] : []),
      ])],
      stale,
    }
  })
  const result = input.record?.steps.find((step) =>
    step.scenarioStepId === input.scenarioStepId)
  return {
    scenarioId: scenario.id,
    scenarioStepId: input.scenarioStepId,
    workflowId: workflow?.id,
    workflowNodeIds,
    modules,
    evidence: result?.evidence.map((item) => ({ ...item })) ?? [],
    result,
    staleApplication: Boolean(
      input.record
      && input.record.identity.applicationRevision !== input.application.revision
    ),
    staleArchitecture: Boolean(
      input.record
      && input.record.identity.architectureRevision !== input.architecture.revision
    ),
    staleModuleIds: modules.filter((module) => module.stale).map((module) => module.moduleId),
  }
}

export function evaluateScenarioTraceFreshness(input: {
  application: ApplicationSpecification
  architecture: ArchitectureSpecification
  moduleDesigns: ModuleDesignSpecification[]
  record: ScenarioRunRecord
}): { current: boolean; diagnostics: CapDiagnostic[] } {
  const diagnostics: CapDiagnostic[] = []
  if (input.record.identity.applicationRevision !== input.application.revision) {
    diagnostics.push(diagnostic(
      'CAP-SCENARIO-APPLICATION-STALE',
      'The scenario run uses an earlier application revision.',
      { fieldPath: 'identity.applicationRevision' },
    ))
  }
  if (input.record.identity.architectureRevision !== input.architecture.revision) {
    diagnostics.push(diagnostic(
      'CAP-SCENARIO-ARCHITECTURE-STALE',
      'The scenario run uses an earlier architecture revision.',
      { fieldPath: 'identity.architectureRevision' },
    ))
  }
  const designByModule = new Map(input.moduleDesigns.map((design) => [
    design.module.moduleId,
    design,
  ]))
  for (const [moduleId, revision] of Object.entries(input.record.identity.moduleDesignRevisions)) {
    const design = designByModule.get(moduleId)
    if (!design || design.revision !== revision || design.architecture.revision !== input.architecture.revision) {
      diagnostics.push(diagnostic(
        'CAP-SCENARIO-MODULE-DESIGN-STALE',
        'The scenario run uses an earlier module design revision.',
        {
          fieldPath: `identity.moduleDesignRevisions.${moduleId}`,
          relatedIds: [moduleId, revision],
        },
      ))
    }
  }
  const sorted = sortDiagnostics(diagnostics)
  return { current: sorted.length === 0, diagnostics: sorted }
}

function scenarioDefinition(
  application: ApplicationSpecification,
  scenarioId: string,
): ScenarioDefinition {
  const scenario = compileScenarioDefinitions(application).find((candidate) => candidate.id === scenarioId)
  if (!scenario) throw new Error(`scenario definition not found: ${scenarioId}`)
  return scenario
}
function stepDefinitions(application: ApplicationSpecification, scenario: ScenarioDefinition) {
  const useCase = materializeUseCaseDefinitions(application)
    .find((candidate) => candidate.id === scenario.useCaseId)
  if (!useCase) throw new Error(`scenario use case not found: ${scenario.useCaseId}`)
  const byId = new Map(allUseCaseSteps(useCase).map((step) => [step.id, step]))
  return scenario.stepIds.map((stepId) => {
    const step = byId.get(stepId)
    if (!step) throw new Error(`scenario step not found: ${scenario.id}/${stepId}`)
    return step
  })
}

export function createScenarioRun(input: {
  runId: string
  application: ApplicationSpecification
  architecture: ArchitectureSpecification
  moduleDesigns: ModuleDesignSpecification[]
  scenarioId: string
  build: string
  sourceRevision: string
  environment: string
  testDataRevision: string
  runner: string
  implementationRevisions?: Record<string, string>
  connectionRevision?: string
  startedAt?: string
}): ScenarioRunRecord {
  if (!evaluateArchitectureApplicationLink(input.application, input.architecture).current) {
    throw new Error('The approved architecture is stale. Revise it before scenario verification.')
  }
  const scenario = scenarioDefinition(input.application, input.scenarioId)
  const startedAt = input.startedAt ?? new Date().toISOString()
  const steps: ScenarioStepResult[] = stepDefinitions(input.application, scenario).map((step) => ({
    scenarioStepId: step.id,
    action: step.action,
    expectedResult: step.expectedResult,
    actualResult: '',
    startedAt,
    completedAt: startedAt,
    outcome: 'unverified',
    evidence: [],
  }))
  const record: ScenarioRunRecord = {
    schemaVersion: '1.0',
    runId: input.runId,
    projectId: input.application.projectId,
    scenarioId: scenario.id,
    useCaseId: scenario.useCaseId,
    kind: scenario.kind,
    outcome: 'unverified',
    identity: {
      useCaseAnalysisRevision: useCaseAnalysisHash(input.application),
      applicationRevision: input.application.revision,
      architectureRevision: input.architecture.revision,
      moduleDesignRevisions: Object.fromEntries(input.moduleDesigns.map((design) => [
        design.module.moduleId,
        design.revision,
      ])),
      implementationRevisions: input.implementationRevisions ?? {},
      connectionRevision: input.connectionRevision,
      build: input.build,
      sourceRevision: input.sourceRevision,
      environment: input.environment,
      testDataRevision: input.testDataRevision,
      runner: input.runner,
    },
    steps,
    evidenceHashes: {},
    startedAt,
    contentHash: '',
  }
  record.contentHash = canonicalHash({ ...record, contentHash: undefined })
  return record
}

export function recordScenarioStep(input: {
  record: ScenarioRunRecord
  scenarioStepId: string
  actualResult: string
  outcome: Exclude<ScenarioOutcome, 'unverified'>
  evidence: ScenarioStepEvidence[]
  startedAt: string
  completedAt: string
  evidenceHashes?: Record<string, string>
}): ScenarioRunRecord {
  const index = input.record.steps.findIndex((step) => step.scenarioStepId === input.scenarioStepId)
  if (index < 0) throw new Error(`scenario step not found in run: ${input.scenarioStepId}`)
  if (!input.actualResult.trim()) throw new Error('scenario step actual result is required')
  if (Date.parse(input.completedAt) < Date.parse(input.startedAt)) {
    throw new Error('scenario step completedAt must not precede startedAt')
  }
  const steps = [...input.record.steps]
  steps[index] = {
    ...steps[index]!,
    actualResult: input.actualResult,
    outcome: input.outcome,
    evidence: input.evidence.map((item) => ({ ...item })),
    startedAt: input.startedAt,
    completedAt: input.completedAt,
  }
  const record: ScenarioRunRecord = {
    ...input.record,
    steps,
    evidenceHashes: { ...input.record.evidenceHashes, ...(input.evidenceHashes ?? {}) },
    contentHash: '',
  }
  record.contentHash = canonicalHash({ ...record, contentHash: undefined })
  return record
}

function hasEvidence(evidence: ScenarioStepEvidence[], kind: ScenarioStepEvidence['kind']): boolean {
  return evidence.some((item) => item.kind === kind && (kind === 'not-applicable' ? Boolean(item.reason?.trim()) : Boolean(item.artifactId)))
}

export function evaluateScenarioRun(
  application: ApplicationSpecification,
  record: ScenarioRunRecord,
): { passed: boolean; diagnostics: CapDiagnostic[] } {
  const diagnostics: CapDiagnostic[] = []
  const scenario = scenarioDefinition(application, record.scenarioId)
  const definitions = stepDefinitions(application, scenario)
  if (record.steps.length !== definitions.length) {
    diagnostics.push(diagnostic('CAP-SCENARIO-STEP-COUNT', 'scenario run must record every approved step', {
      fieldPath: 'steps',
    }))
  }
  for (const definition of definitions) {
    const result = record.steps.find((step) => step.scenarioStepId === definition.id)
    if (!result) {
      diagnostics.push(diagnostic('CAP-SCENARIO-STEP-MISSING', 'scenario run is missing an approved step', {
        fieldPath: `steps.${definition.id}`,
        relatedIds: [definition.id],
      }))
      continue
    }
    if (result.outcome === 'unverified') {
      diagnostics.push(diagnostic('CAP-SCENARIO-STEP-UNVERIFIED', 'scenario step has not run', {
        fieldPath: `steps.${definition.id}.outcome`,
        relatedIds: [definition.id],
      }))
    }
    if (!result.actualResult.trim()) {
      diagnostics.push(diagnostic('CAP-SCENARIO-STEP-ACTUAL', 'scenario step requires an actual result', {
        fieldPath: `steps.${definition.id}.actualResult`,
        relatedIds: [definition.id],
      }))
    }
    const screenshot = hasEvidence(result.evidence, 'screenshot')
    const structured = hasEvidence(result.evidence, 'structured')
    const notApplicable = hasEvidence(result.evidence, 'not-applicable')
    if (definition.evidencePolicy === 'screenshot' && !screenshot) {
      diagnostics.push(diagnostic('CAP-SCENARIO-EVIDENCE-SCREENSHOT', 'visual scenario step requires original screenshot evidence', {
        fieldPath: `steps.${definition.id}.evidence`,
        relatedIds: [definition.id],
      }))
    } else if (definition.evidencePolicy === 'structured' && !structured) {
      diagnostics.push(diagnostic('CAP-SCENARIO-EVIDENCE-STRUCTURED', 'nonvisual scenario step requires structured evidence', {
        fieldPath: `steps.${definition.id}.evidence`,
        relatedIds: [definition.id],
      }))
    } else if (definition.evidencePolicy === 'either' && !screenshot && !structured) {
      diagnostics.push(diagnostic('CAP-SCENARIO-EVIDENCE', 'scenario step requires screenshot or structured evidence', {
        fieldPath: `steps.${definition.id}.evidence`,
        relatedIds: [definition.id],
      }))
    } else if (definition.evidencePolicy === 'not-applicable' && !notApplicable) {
      diagnostics.push(diagnostic('CAP-SCENARIO-EVIDENCE-NA', 'scenario step requires an evidence not-applicable reason', {
        fieldPath: `steps.${definition.id}.evidence`,
        relatedIds: [definition.id],
      }))
    }
    for (const item of result.evidence) {
      if (item.artifactId && !record.evidenceHashes[item.artifactId]) {
        diagnostics.push(diagnostic('CAP-SCENARIO-EVIDENCE-HASH', 'scenario evidence artifact requires an immutable hash', {
          fieldPath: `evidenceHashes.${item.artifactId}`,
          relatedIds: [item.artifactId],
        }))
      }
    }
  }
  const sorted = sortDiagnostics(diagnostics)
  return { passed: sorted.length === 0, diagnostics: sorted }
}

export function finalizeScenarioRun(
  application: ApplicationSpecification,
  record: ScenarioRunRecord,
  completedAt = new Date().toISOString(),
  current?: {
    architecture: ArchitectureSpecification
    moduleDesigns: ModuleDesignSpecification[]
  },
): { record: ScenarioRunRecord; diagnostics: CapDiagnostic[] } {
  const evaluation = evaluateScenarioRun(application, record)
  const freshness = current
    ? evaluateScenarioTraceFreshness({
      application,
      architecture: current.architecture,
      moduleDesigns: current.moduleDesigns,
      record,
    })
    : { current: true, diagnostics: [] }
  const diagnostics = sortDiagnostics([
    ...evaluation.diagnostics,
    ...freshness.diagnostics,
  ])
  const stepOutcomes = record.steps.map((step) => step.outcome)
  const outcome: ScenarioOutcome = evaluation.passed
    && freshness.current
    && stepOutcomes.every((value) => value === 'passed')
    ? 'passed'
    : stepOutcomes.includes('failed')
      ? 'failed'
      : stepOutcomes.includes('cancelled')
        ? 'cancelled'
        : stepOutcomes.includes('skipped')
          ? 'skipped'
          : 'unverified'
  const completed: ScenarioRunRecord = {
    ...record,
    outcome,
    completedAt,
    contentHash: '',
  }
  completed.contentHash = canonicalHash({ ...completed, contentHash: undefined })
  return { record: completed, diagnostics }
}

export type ScenarioVerificationSummary = {
  useCaseCount: number
  scenarioCount: number
  passed: number
  failed: number
  skipped: number
  cancelled: number
  unverified: number
  stepCount: number
  screenshotCount: number
  structuredCount: number
  firstFailedStepId?: string
  currentRunByScenario: Record<string, ScenarioRunRecord>
}

export function summarizeScenarioRuns(
  application: ApplicationSpecification,
  records: ScenarioRunRecord[],
): ScenarioVerificationSummary {
  const scenarios = compileScenarioDefinitions(application)
  const currentRunByScenario = Object.fromEntries(scenarios.flatMap((scenario) => {
    const matches = records
      .filter((record) => record.scenarioId === scenario.id)
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
    return matches[0] ? [[scenario.id, matches[0]]] : []
  }))
  const current = Object.values(currentRunByScenario)
  return {
    useCaseCount: materializeUseCaseDefinitions(application).length,
    scenarioCount: scenarios.length,
    passed: current.filter((record) => record.outcome === 'passed').length,
    failed: current.filter((record) => record.outcome === 'failed').length,
    skipped: current.filter((record) => record.outcome === 'skipped').length,
    cancelled: current.filter((record) => record.outcome === 'cancelled').length,
    unverified: scenarios.length - current.filter((record) => record.outcome !== 'unverified').length,
    stepCount: current.reduce((total, record) => total + record.steps.length, 0),
    screenshotCount: current.reduce((total, record) => total + record.steps.reduce((count, step) =>
      count + step.evidence.filter((item) => item.kind === 'screenshot' && item.artifactId).length, 0), 0),
    structuredCount: current.reduce((total, record) => total + record.steps.reduce((count, step) =>
      count + step.evidence.filter((item) => item.kind === 'structured' && item.artifactId).length, 0), 0),
    firstFailedStepId: current
      .flatMap((record) => record.steps)
      .find((step) => step.outcome === 'failed')?.scenarioStepId,
    currentRunByScenario,
  }
}
