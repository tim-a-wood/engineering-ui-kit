/**
 * EUC-02 — Application compiler.
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §5, §6.1,
 * §16, §25.3 (EUC-02). Pure `compileApplication` operation that maps an
 * approved `UseCaseAnalysis` (EUC-01) to a deterministic legacy
 * `ApplicationSpecification` (CAP-CONTRACT-001). No compilation path grants
 * approval; compiling never reads or writes the analysis approval.
 */

import type {
  AcceptanceCase,
  ActivityEdge,
  ActivityNode,
  ApplicationSpecification,
  ApplicationWorkflowDefinition,
  NamedText,
  UseCaseDefinition as ApplicationUseCaseDefinition,
  UseCasePathDefinition,
  UseCaseStepDefinition,
} from '../types.js'
import type {
  DesignDiagnostic,
  ScenarioStep,
  UseCaseAnalysis,
  UseCaseDefinition as AnalysisUseCaseDefinition,
  UseCaseScenario,
} from './records.js'
import { canonicalHash, childId, stableSortBy, stableSortStrings } from './identity.js'
import { designDiagnostic, sortDesignDiagnostics, toDesignDiagnostic } from './useCaseAnalysis.js'
import { validateContractRecord } from '../validation.js'
import { compileWorkflowScenarioDefinitions } from '../applicationWorkflow.js'

/** §25.3 EUC-02 — stable diagnostic codes owned by the application compiler. */
export const EUC02_DIAGNOSTIC_CODES = {
  notApproved: 'EUC02-ANALYSIS-NOT-APPROVED',
  missingActors: 'EUC02-MISSING-ACTORS',
  missingUseCases: 'EUC02-MISSING-USE-CASES',
  missingAcceptanceCases: 'EUC02-MISSING-ACCEPTANCE-CASES',
} as const

export type ApplicationCompileOptions = {
  /** Overrides the deterministic default application id. */
  id?: string
  /** Overrides the default revision ('1'). */
  revision?: string
}

export type ApplicationCompileResult = {
  specification?: ApplicationSpecification
  diagnostics: DesignDiagnostic[]
}

function byId<T extends { id: string }>(items: T[]): T[] {
  return stableSortBy(items, (item) => item.id)
}

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function applicationStep(
  step: ScenarioStep,
  order: number,
  actorId: string | undefined,
  ruleIds: string[],
): UseCaseStepDefinition {
  return {
    id: step.id,
    order,
    ...(actorId ? { actorId } : {}),
    action: step.action,
    expectedResult: step.expectedResult,
    inputIds: [],
    outputIds: [],
    ruleIds,
    evidencePolicy: step.visibleResult ? 'screenshot' : 'structured',
  }
}

function applicationPath(
  useCase: AnalysisUseCaseDefinition,
  scenario: UseCaseScenario,
  actorId: string | undefined,
): UseCasePathDefinition {
  return {
    id: scenario.id,
    name: scenario.name,
    kind: scenario.kind === 'main' ? 'main' : scenario.kind,
    preconditions: [...useCase.preconditions],
    steps: scenario.steps.map((step, index) => applicationStep(step, index + 1, actorId, useCase.rules.map((rule) => rule.id))),
    outcome: scenario.steps.at(-1)?.expectedResult ?? useCase.outputs[0] ?? '',
  }
}

/**
 * Preserve the reviewed use-case detail when EUC-02 compiles the application
 * record. The former compact-only projection discarded ordered steps and made
 * an application activity diagram impossible without reading `mainFlow`
 * downstream.
 */
function compileDetailedUseCases(analysis: UseCaseAnalysis): ApplicationUseCaseDefinition[] {
  return analysis.useCases.map((useCase) => {
    const actorId = useCase.actors[0]
    const mainScenario = useCase.scenarios.find((scenario) => scenario.kind === 'main')
    const recoveryScenarios = useCase.scenarios.filter((scenario) => scenario.kind === 'recovery')
    return {
      id: useCase.id,
      name: useCase.name,
      actorIds: [...useCase.actors],
      trigger: useCase.trigger,
      preconditions: [...useCase.preconditions],
      mainFlow: (mainScenario?.steps ?? useCase.mainFlow)
        .map((step, index) => applicationStep(step, index + 1, actorId, useCase.rules.map((rule) => rule.id))),
      alternatePaths: useCase.alternatePaths.map((scenario) => applicationPath(useCase, scenario, actorId)),
      failurePaths: useCase.failurePaths.map((scenario) => applicationPath(useCase, scenario, actorId)),
      recoveryPaths: recoveryScenarios.map((scenario) => applicationPath(useCase, scenario, actorId)),
      ruleIds: useCase.rules.map((rule) => rule.id),
      inputIds: useCase.inputs.map((value, index) => childId(useCase.id, 'input', value || String(index + 1))),
      outputIds: useCase.outputs.map((value, index) => childId(useCase.id, 'output', value || String(index + 1))),
      acceptanceCaseIds: useCase.acceptanceChecks
        .filter((item) => item.status !== 'rejected')
        .map((item) => item.id),
      sourceRefs: [...useCase.sourceLinks],
    }
  })
}

function workflowForPath(
  useCase: ApplicationUseCaseDefinition,
  path: UseCasePathDefinition,
): ApplicationWorkflowDefinition {
  const workflowId = `workflow:${useCase.id}:${slug(path.id.replace(`${useCase.id}:`, '') || path.kind)}`
  const initialId = `${workflowId}:initial`
  const finalId = `${workflowId}:final`
  const actionNodes: ActivityNode[] = [...path.steps]
    .sort((left, right) => left.order - right.order)
    .map((step) => ({
      id: `${workflowId}:action:${step.id}`,
      kind: 'action',
      label: step.action,
      description: step.expectedResult,
      refinesIds: [step.id],
      ...(step.actorId ? { actorId: step.actorId } : {}),
    }))
  const orderedNodeIds = [initialId, ...actionNodes.map((node) => node.id), finalId]
  const edges: ActivityEdge[] = orderedNodeIds.slice(0, -1).map((fromNodeId, index) => ({
    id: `${workflowId}:edge:${index + 1}`,
    fromNodeId,
    toNodeId: orderedNodeIds[index + 1]!,
    outcome: path.kind === 'main' ? 'success' : path.kind,
    traceIds: [useCase.id, path.id],
  }))
  return {
    id: workflowId,
    useCaseId: useCase.id,
    name: path.kind === 'main' ? useCase.name : path.name,
    graph: {
      id: `${workflowId}:graph`,
      name: path.kind === 'main' ? useCase.name : path.name,
      nodes: [
        {
          id: initialId,
          kind: 'initial',
          label: 'Initial',
          description: path.trigger ?? useCase.trigger,
          refinesIds: [],
        },
        ...actionNodes,
        {
          id: finalId,
          kind: 'final',
          label: 'Final',
          description: path.outcome,
          refinesIds: [],
        },
      ],
      edges,
    },
    pathIds: [path.id],
    acceptanceCaseIds: [...useCase.acceptanceCaseIds],
    sourceRefs: [...useCase.sourceRefs],
  }
}

function compileApplicationWorkflows(useCases: ApplicationUseCaseDefinition[]): ApplicationWorkflowDefinition[] {
  return useCases.flatMap((useCase) => {
    const main: UseCasePathDefinition = {
      id: `${useCase.id}:main`,
      name: useCase.name,
      kind: 'main',
      trigger: useCase.trigger,
      preconditions: [...useCase.preconditions],
      steps: [...useCase.mainFlow],
      outcome: useCase.mainFlow.at(-1)?.expectedResult ?? '',
    }
    return [main, ...useCase.alternatePaths, ...useCase.failurePaths, ...useCase.recoveryPaths]
      .filter((path) => path.steps.length > 0)
      .map((path) => workflowForPath(useCase, path))
  })
}

/**
 * §6.1 step 5, §25.3 EUC-02 — compile an approved use-case analysis to the
 * current application specification. Deterministic: the same approved
 * analysis and options always produce the same `contentHash`. A missing
 * required item (no active actor, no use case, no acceptance case) returns a
 * stable diagnostic instead of a specification.
 */
export function compileApplication(
  analysis: UseCaseAnalysis,
  options: ApplicationCompileOptions = {},
): ApplicationCompileResult {
  if (analysis.status !== 'approved' || !analysis.approval) {
    return {
      diagnostics: [
        designDiagnostic(
          EUC02_DIAGNOSTIC_CODES.notApproved,
          'blocker',
          'compileApplication requires an approved use-case analysis',
          { target: 'status', relatedIds: [analysis.id] },
        ),
      ],
    }
  }

  const activeActors = analysis.actors.filter((item) => item.status !== 'rejected')
  const acceptanceCases: AcceptanceCase[] = analysis.useCases.flatMap((useCase) =>
    useCase.acceptanceChecks
      .filter((item) => item.status !== 'rejected')
      .map((item) => ({ id: item.id, description: item.text, expectedOutcome: item.text })),
  )

  const missing: DesignDiagnostic[] = []
  if (!activeActors.length) {
    missing.push(
      designDiagnostic(EUC02_DIAGNOSTIC_CODES.missingActors, 'blocker', 'approved analysis has no active actor', {
        target: 'actors',
      }),
    )
  }
  if (!analysis.useCases.length) {
    missing.push(
      designDiagnostic(EUC02_DIAGNOSTIC_CODES.missingUseCases, 'blocker', 'approved analysis has no use case', {
        target: 'useCases',
      }),
    )
  }
  if (!acceptanceCases.length) {
    missing.push(
      designDiagnostic(
        EUC02_DIAGNOSTIC_CODES.missingAcceptanceCases,
        'blocker',
        'approved analysis has no acceptance check',
        { target: 'acceptanceCases' },
      ),
    )
  }
  if (missing.length) {
    return { diagnostics: sortDesignDiagnostics(missing) }
  }

  const rules: NamedText[] = [
    ...analysis.rules.filter((item) => item.status !== 'rejected').map((item) => ({ id: item.id, text: item.text })),
    ...analysis.useCases.flatMap((useCase) => useCase.rules),
  ]
  const scenarios: NamedText[] = analysis.useCases.flatMap((useCase) =>
    useCase.scenarios.map((scenario) => ({ id: scenario.id, text: scenario.name })),
  )
  const outcomes = stableSortStrings(Array.from(new Set(analysis.useCases.flatMap((useCase) => useCase.outputs))))
  const information: NamedText[] = Array.from(
    new Set(analysis.useCases.flatMap((useCase) => useCase.inputs)),
  ).map((text, index) => ({ id: childId(analysis.id, 'information', text || String(index)), text }))
  const unresolvedQuestions: NamedText[] = analysis.questions
    .filter((q) => !q.material && !q.answer)
    .map((q) => ({ id: q.id, text: q.text }))
  const useCaseDefinitions = compileDetailedUseCases(analysis)
  const applicationWorkflows = compileApplicationWorkflows(useCaseDefinitions)

  const specWithoutHash: Omit<ApplicationSpecification, 'contentHash'> = {
    schemaVersion: '1.0',
    projectId: analysis.projectId,
    id: options.id ?? childId(analysis.id, 'application', 'spec'),
    revision: options.revision ?? '1',
    status: 'draft',
    purpose: analysis.workDescription,
    outcomes,
    actors: byId(activeActors.map((item) => ({ id: item.id, text: item.text }))),
    goals: [],
    useCases: byId(analysis.useCases.map((useCase) => ({ id: useCase.id, text: useCase.name }))),
    scenarios: byId(scenarios),
    useCaseDefinitions,
    applicationWorkflows,
    information: byId(information),
    rules: byId(rules),
    externalSystems: [],
    constraints: byId(
      analysis.qualityNeeds
        .filter((item) => item.status !== 'rejected')
        .map((item) => ({ id: item.id, text: item.text })),
    ),
    scope: { inScope: [], outOfScope: [...analysis.prohibitedResults] },
    acceptanceCases: byId(acceptanceCases),
    sources: byId(analysis.sources.map((source) => ({ id: source.id, text: source.name }))),
    unresolvedQuestions: byId(unresolvedQuestions),
  }

  const scenarioDefinitions = compileWorkflowScenarioDefinitions({ ...specWithoutHash, contentHash: '' })
  const completeSpec = { ...specWithoutHash, scenarioDefinitions }
  const contentHash = canonicalHash(completeSpec)
  const specification: ApplicationSpecification = { ...completeSpec, contentHash }

  const structural = validateContractRecord('CAP-CONTRACT-001', specification)
  const diagnostics = sortDesignDiagnostics(structural.map(toDesignDiagnostic))

  return { specification, diagnostics }
}
