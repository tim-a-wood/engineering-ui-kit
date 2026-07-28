/**
 * Detailed use-case analysis, validation, and scenario compilation.
 *
 * Compact `useCases`/`scenarios` remain readable for workspace 1.0. New work
 * uses `useCaseDefinitions` and `scenarioDefinitions` as the canonical source.
 */

import { diagnostic, sortDiagnostics, type CapDiagnostic } from './diagnostics.js'
import { canonicalHash } from './hash.js'
import { compileWorkflowScenarioDefinitions } from './applicationWorkflow.js'
import { evaluateApplicationSte } from './simplifiedTechnicalEnglish.js'
import type {
  ApplicationSpecification,
  ScenarioDefinition,
  UseCaseDefinition,
  UseCasePathDefinition,
  UseCaseStepDefinition,
} from './types.js'

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function allUseCasePaths(useCase: UseCaseDefinition): UseCasePathDefinition[] {
  return [
    {
      id: `${useCase.id}:main`,
      name: useCase.name,
      kind: 'main',
      trigger: useCase.trigger,
      preconditions: useCase.preconditions,
      steps: useCase.mainFlow,
      outcome: useCase.mainFlow.at(-1)?.expectedResult ?? '',
    },
    ...useCase.alternatePaths,
    ...useCase.failurePaths,
    ...useCase.recoveryPaths,
  ]
}

export function allUseCaseSteps(useCase: UseCaseDefinition): UseCaseStepDefinition[] {
  return allUseCasePaths(useCase).flatMap((path) => path.steps)
}

/**
 * Produces incomplete, explicitly reviewable definitions for legacy records.
 * It never invents triggers, actors, results, or acceptance semantics.
 */
export function materializeUseCaseDefinitions(
  application: ApplicationSpecification,
): UseCaseDefinition[] {
  if (application.useCaseDefinitions?.length) return application.useCaseDefinitions
  return (application.useCases ?? []).map((useCase) => ({
    id: useCase.id,
    name: useCase.text,
    actorIds: [],
    trigger: '',
    preconditions: [],
    mainFlow: [],
    alternatePaths: [],
    failurePaths: [],
    recoveryPaths: [],
    ruleIds: [],
    inputIds: [],
    outputIds: [],
    acceptanceCaseIds: [],
    sourceRefs: [],
  }))
}

function scenarioForPath(useCase: UseCaseDefinition, path: UseCasePathDefinition): ScenarioDefinition {
  const suffix = path.kind === 'main'
    ? 'main'
    : slug(path.id.replace(`${useCase.id}:`, '') || path.name || path.kind)
  const policies = new Set(path.steps.map((step) => step.evidencePolicy))
  const requiredEvidence = policies.size === 1
    ? [...policies][0]!
    : policies.has('screenshot') && policies.has('structured')
      ? 'either'
      : policies.has('screenshot')
        ? 'screenshot'
        : policies.has('structured')
          ? 'structured'
          : 'not-applicable'
  return {
    id: `${useCase.id}:scenario:${suffix}`,
    useCaseId: useCase.id,
    pathId: path.id,
    name: path.name,
    kind: path.kind,
    stepIds: path.steps.map((step) => step.id),
    tags: [useCase.id, path.kind],
    requiredEvidence,
  }
}

export function compileScenarioDefinitions(
  application: ApplicationSpecification,
): ScenarioDefinition[] {
  if (application.scenarioDefinitions?.length) return application.scenarioDefinitions
  if (application.applicationWorkflows?.length) {
    return compileWorkflowScenarioDefinitions(application)
  }
  return materializeUseCaseDefinitions(application)
    .flatMap((useCase) => allUseCasePaths(useCase).map((path) => scenarioForPath(useCase, path)))
    .filter((scenario) => scenario.stepIds.length > 0)
}

export function useCaseAnalysisHash(application: ApplicationSpecification): string {
  return canonicalHash({
    applicationId: application.id,
    applicationRevision: application.revision,
    useCases: materializeUseCaseDefinitions(application),
    scenarios: compileScenarioDefinitions(application),
  })
}

export function evaluateUseCaseAnalysis(
  application: ApplicationSpecification,
  options: { includeSte?: boolean } = {},
): { passed: boolean; diagnostics: CapDiagnostic[] } {
  const diagnostics: CapDiagnostic[] = []
  const actors = new Set((application.actors ?? []).map((actor) => actor.id))
  const acceptanceCases = new Set((application.acceptanceCases ?? []).map((item) => item.id))
  const rules = new Set((application.rules ?? []).map((item) => item.id))
  const useCases = materializeUseCaseDefinitions(application)
  const useCaseIds = new Set<string>()
  const stepOwners = new Map<string, string>()

  if (options.includeSte !== false) {
    const useCaseFieldPrefixes = [
      'useCases.',
      'scenarios.',
      'useCaseDefinitions.',
      'scenarioDefinitions.',
    ]
    diagnostics.push(...evaluateApplicationSte(application).diagnostics.filter((item) =>
      useCaseFieldPrefixes.some((prefix) => item.fieldPath?.startsWith(prefix))))
  }

  if (!useCases.length) {
    diagnostics.push(diagnostic('CAP-PLAN-USE-CASE', 'at least one detailed use case is required', {
      fieldPath: 'useCaseDefinitions',
      ruleId: 'CAP-PLAN-015',
    }))
  }

  for (const useCase of useCases) {
    const field = `useCaseDefinitions.${useCase.id}`
    if (useCaseIds.has(useCase.id)) {
      diagnostics.push(diagnostic('CAP-PLAN-USE-CASE-ID', 'use-case IDs must be unique', {
        fieldPath: `${field}.id`,
        relatedIds: [useCase.id],
      }))
    }
    useCaseIds.add(useCase.id)
    if (!useCase.name.trim()) {
      diagnostics.push(diagnostic('CAP-PLAN-USE-CASE-NAME', 'use case requires a name', {
        fieldPath: `${field}.name`,
      }))
    }
    if (!useCase.actorIds.length) {
      diagnostics.push(diagnostic('CAP-PLAN-USE-CASE-ACTOR', 'main use case requires at least one actor', {
        fieldPath: `${field}.actorIds`,
        ruleId: 'CAP-PLAN-015',
      }))
    }
    for (const actorId of useCase.actorIds) {
      if (!actors.has(actorId)) {
        diagnostics.push(diagnostic('CAP-PLAN-USE-CASE-ACTOR-REF', 'use case references an unknown actor', {
          fieldPath: `${field}.actorIds`,
          relatedIds: [actorId],
        }))
      }
    }
    if (!useCase.trigger.trim()) {
      diagnostics.push(diagnostic('CAP-PLAN-USE-CASE-TRIGGER', 'main use case requires a trigger', {
        fieldPath: `${field}.trigger`,
      }))
    }
    if (!useCase.mainFlow.length) {
      diagnostics.push(diagnostic('CAP-PLAN-USE-CASE-FLOW', 'main use case requires at least one step', {
        fieldPath: `${field}.mainFlow`,
      }))
    }
    if (!useCase.acceptanceCaseIds.length) {
      diagnostics.push(diagnostic('CAP-PLAN-USE-CASE-ACCEPTANCE', 'main use case requires an acceptance check', {
        fieldPath: `${field}.acceptanceCaseIds`,
        ruleId: 'CAP-PLAN-015',
      }))
    }
    for (const acceptanceId of useCase.acceptanceCaseIds) {
      if (!acceptanceCases.has(acceptanceId)) {
        diagnostics.push(diagnostic('CAP-PLAN-USE-CASE-ACCEPTANCE-REF', 'use case references an unknown acceptance check', {
          fieldPath: `${field}.acceptanceCaseIds`,
          relatedIds: [acceptanceId],
        }))
      }
    }
    for (const ruleId of useCase.ruleIds) {
      if (!rules.has(ruleId)) {
        diagnostics.push(diagnostic('CAP-PLAN-USE-CASE-RULE-REF', 'use case references an unknown rule', {
          fieldPath: `${field}.ruleIds`,
          relatedIds: [ruleId],
        }))
      }
    }
    for (const path of allUseCasePaths(useCase)) {
      const ordered = [...path.steps].sort((left, right) => left.order - right.order)
      for (let index = 0; index < ordered.length; index++) {
        const step = ordered[index]!
        const stepField = `${field}.paths.${path.id}.steps.${step.id}`
        const previousOwner = stepOwners.get(step.id)
        if (previousOwner) {
          diagnostics.push(diagnostic('CAP-PLAN-STEP-ID', 'scenario-step IDs must be globally unique', {
            fieldPath: `${stepField}.id`,
            relatedIds: [previousOwner, step.id],
          }))
        } else {
          stepOwners.set(step.id, useCase.id)
        }
        if (step.order !== index + 1) {
          diagnostics.push(diagnostic('CAP-PLAN-STEP-ORDER', 'scenario steps must use contiguous one-based order', {
            fieldPath: `${stepField}.order`,
          }))
        }
        if (!step.action.trim() || !step.expectedResult.trim()) {
          diagnostics.push(diagnostic('CAP-PLAN-STEP-CONTENT', 'scenario step requires an action and expected result', {
            fieldPath: stepField,
            relatedIds: [step.id],
          }))
        }
        if (step.actorId && !actors.has(step.actorId)) {
          diagnostics.push(diagnostic('CAP-PLAN-STEP-ACTOR-REF', 'scenario step references an unknown actor', {
            fieldPath: `${stepField}.actorId`,
            relatedIds: [step.actorId],
          }))
        }
      }
    }
  }

  const scenarios = compileScenarioDefinitions(application)
  const scenarioIds = new Set<string>()
  for (const scenario of scenarios) {
    if (scenarioIds.has(scenario.id)) {
      diagnostics.push(diagnostic('CAP-PLAN-SCENARIO-ID', 'scenario IDs must be unique', {
        fieldPath: `scenarioDefinitions.${scenario.id}.id`,
      }))
    }
    scenarioIds.add(scenario.id)
    const useCase = useCases.find((item) => item.id === scenario.useCaseId)
    if (!useCase) {
      diagnostics.push(diagnostic('CAP-PLAN-SCENARIO-USE-CASE', 'scenario references an unknown use case', {
        fieldPath: `scenarioDefinitions.${scenario.id}.useCaseId`,
        relatedIds: [scenario.useCaseId],
      }))
      continue
    }
    const validStepIds = new Set(allUseCaseSteps(useCase).map((step) => step.id))
    for (const stepId of scenario.stepIds) {
      if (!validStepIds.has(stepId)) {
        diagnostics.push(diagnostic('CAP-PLAN-SCENARIO-STEP', 'scenario references a step outside its use case', {
          fieldPath: `scenarioDefinitions.${scenario.id}.stepIds`,
          relatedIds: [stepId],
        }))
      }
    }
  }

  const sorted = sortDiagnostics(diagnostics)
  return { passed: sorted.length === 0, diagnostics: sorted }
}
