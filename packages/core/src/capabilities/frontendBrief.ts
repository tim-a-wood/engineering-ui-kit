import type { TaskIntentProfile } from '../packetLint.js'
import type {
  ApplicationSpecification,
  ArchitectureSpecification,
  FrontendBinding,
  InboundBinding,
  ModuleManifest,
} from './types.js'

export type FrontendBriefFields = {
  taskTitle: string
  goal: string
  scope: string
  constraints: string
  acceptanceCriteria: string
  references: string
  intentProfile: TaskIntentProfile
}

export type FrontendBriefGap = {
  code: string
  severity: 'warning' | 'blocking'
  message: string
  relatedIds: string[]
}

export type FrontendBrief = {
  schemaVersion: '1.0'
  projectId: string
  generatedAt: string
  source: {
    applicationRevision?: string
    architectureRevision: string
    architectureHash: string
    moduleVersions: Record<string, string>
    bindingVersions: Record<string, string>
  }
  coverage: {
    moduleIds: string[]
    operationIds: string[]
    bindingIds: string[]
    routes: string[]
    useCaseIds: string[]
  }
  fields: FrontendBriefFields
  gaps: FrontendBriefGap[]
}

function bullets(values: string[], fallback: string): string {
  return values.length ? values.map((value) => `- ${value}`).join('\n') : `- ${fallback}`
}

function numbered(values: string[], fallback: string): string {
  return (values.length ? values : [fallback]).map((value, index) => `${index + 1}. ${value}`).join('\n')
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right))
}

function bindingRoute(binding: FrontendBinding | InboundBinding): string | undefined {
  if ('kind' in binding) {
    if (binding.kind !== 'ui') return undefined
    return binding.selectionEvidence?.route
  }
  return binding.selectionEvidence.route
}

function bindingVisibleTarget(binding: FrontendBinding | InboundBinding): string {
  if ('kind' in binding) {
    if (binding.kind !== 'ui') return binding.bindingId
    return binding.selectionEvidence?.visibleText
      || binding.selectionEvidence?.name
      || binding.generatedTargets[0]
      || binding.bindingId
  }
  return binding.selectionEvidence.visibleText
    || binding.selectionEvidence.name
    || binding.bindingId
}

function bindingBehaviors(binding: FrontendBinding | InboundBinding): string[] {
  return [
    `Validation: ${binding.validationBehavior}`,
    `Domain rejection: ${binding.domainRejectionBehavior}`,
    `Technical failure: ${binding.technicalFailureBehavior}`,
    `Cancellation: ${binding.cancellationBehavior}`,
    `Duplicate action: ${binding.duplicateSubmissionBehavior}`,
    ...('kind' in binding
      ? [`Timeout: ${binding.timeoutBehavior}`, `Retry: ${binding.retryBehavior}`]
      : [`Loading: ${binding.loadingBehavior}`]),
  ]
}

/** Compile approved capability truth into a complete, editable frontend task brief. */
export function compileFrontendBrief(input: {
  projectId: string
  architecture: ArchitectureSpecification
  application?: ApplicationSpecification
  modules: ModuleManifest[]
  bindings?: (FrontendBinding | InboundBinding)[]
  targetModuleIds?: string[]
  generatedAt?: string
}): FrontendBrief {
  const explicitTargets = new Set(input.targetModuleIds ?? [])
  const selectedModules = input.modules
    .filter((module) =>
      explicitTargets.size > 0
        ? explicitTargets.has(module.moduleId)
        : module.moduleType === 'experience')
    .sort((left, right) => left.moduleId.localeCompare(right.moduleId))
  const uiBindings = (input.bindings ?? [])
    .filter((binding) => !('kind' in binding) || binding.kind === 'ui')
    .sort((left, right) => left.bindingId.localeCompare(right.bindingId))
  const selectedOperationIds = new Set(selectedModules.flatMap((module) => [
    ...module.providedOperations.map((operation) => operation.operationId),
    ...module.requiredOperations.map((operation) => operation.operationId),
  ]))
  const relevantBindings = uiBindings.filter((binding) =>
    selectedOperationIds.size === 0 || selectedOperationIds.has(binding.operationId))
  const useCases = input.application?.useCases ?? []
  const workflowTraces = input.architecture.workflowTraces
    .filter((trace) => selectedModules.some((module) => trace.moduleIds.includes(module.moduleId)))
  const definitionById = new Map(
    (input.architecture.moduleDefinitions ?? []).map((definition) => [definition.moduleId, definition]),
  )
  const moduleName = (moduleId: string) => definitionById.get(moduleId)?.name ?? moduleId
  const moduleLines = selectedModules.map((module) =>
    `${module.name} (${module.moduleId} @ ${module.moduleVersion}) — ${module.responsibility}`)
  const provided = selectedModules.flatMap((module) => module.providedOperations.map((operation) =>
    `${module.name}: ${operation.operationId} @ ${operation.contractVersion}`))
  const required = selectedModules.flatMap((module) => module.requiredOperations.map((operation) =>
    `${module.name}: ${operation.operationId} ${operation.acceptedContractRange} — ${operation.reason}`))
  const bindingLines = relevantBindings.map((binding) =>
    `${bindingVisibleTarget(binding)} → ${binding.operationId} @ ${binding.operationVersion}`
      + `${bindingRoute(binding) ? ` on ${bindingRoute(binding)}` : ''}`)
  const behaviorLines = relevantBindings.flatMap((binding) =>
    bindingBehaviors(binding).map((behavior) => `${bindingVisibleTarget(binding)} — ${behavior}`))
  const routes = unique(relevantBindings.flatMap((binding) => {
    const route = bindingRoute(binding)
    return route ? [route] : []
  }))
  const dependencyLines = selectedModules.flatMap((module) =>
    input.architecture.dependencyEdges
      .filter((edge) => edge.fromModuleId === module.moduleId)
      .map((edge) => `${module.name} → ${moduleName(edge.toModuleId)}: ${edge.reason}`))
  const ownedPaths = unique(selectedModules.flatMap((module) => module.ownedPaths))
  const acceptanceCases = input.application?.acceptanceCases ?? []
  const gaps: FrontendBriefGap[] = []
  if (!input.application) {
    gaps.push({
      code: 'FRONTEND-BRIEF-APPLICATION',
      severity: 'warning',
      message: 'No approved product definition is available; the brief is based on architecture and modules.',
      relatedIds: [input.architecture.id],
    })
  }
  if (selectedModules.length === 0) {
    gaps.push({
      code: 'FRONTEND-BRIEF-MODULE',
      severity: 'blocking',
      message: 'No approved experience module is available for the frontend brief.',
      relatedIds: input.targetModuleIds ?? [],
    })
  }
  if (relevantBindings.length === 0) {
    gaps.push({
      code: 'FRONTEND-BRIEF-BINDING',
      severity: 'warning',
      message: 'No approved UI binding is available; interaction targets remain implementation choices.',
      relatedIds: [...selectedOperationIds],
    })
  }
  const productName = selectedModules.length === 1
    ? selectedModules[0]!.name
    : input.application?.purpose || 'approved capability experience'
  const fields: FrontendBriefFields = {
    taskTitle: `Build frontend from approved capabilities: ${productName}`,
    goal: [
      `# Frontend brief — ${productName}`,
      `## Product purpose\n${input.application?.purpose || selectedModules.map((module) => module.responsibility).join(' ')}`,
      `## Outcomes\n${bullets(input.application?.outcomes ?? [], 'Deliver the observable outcomes defined by the selected capability modules.')}`,
      `## Users and goals\nActors:\n${bullets((input.application?.actors ?? []).map((item) => item.text), 'Use the actors implied by the approved workflows.')}\n\nGoals:\n${bullets((input.application?.goals ?? []).map((item) => item.text), 'Support the selected modules’ approved responsibilities.')}`,
      `## Journeys\n${bullets(useCases.map((item) => `${item.id}: ${item.text}`), 'Use the approved workflow traces as the primary journeys.')}\n\nWorkflow traces:\n${bullets(workflowTraces.map((trace) => `${trace.useCaseId}: ${trace.moduleIds.map(moduleName).join(' → ')}`), 'No selected workflow trace is recorded.')}`,
      `## Capability modules\n${bullets(moduleLines, 'No frontend module selected.')}`,
      `## Operation map\nProvided operations:\n${bullets(provided, 'No provided operation recorded.')}\n\nRequired operations:\n${bullets(required, 'No required operation recorded.')}`,
      `## Bound interactions\n${bullets(bindingLines, 'No UI binding recorded; choose repository-consistent interaction targets and keep them replaceable.')}`,
      `## Required interaction behavior\n${bullets(behaviorLines, 'Define intentional loading, validation, rejection, failure, cancellation, retry, and duplicate-action behavior for every operation.')}`,
      '## Experience quality\n- Make the main journey immediately legible and keep the next meaningful action obvious.\n- Provide intentional initial, loading, ready, empty, partial, validation, rejection, technical-failure, cancelled, retrying, and success states where applicable.\n- Preserve user input after recoverable failures and prevent accidental duplicate submissions.\n- Use progressive disclosure for dense engineering detail; keep routine actions quick and satisfying.\n- Build responsive, keyboard-complete, screen-reader-friendly interactions with visible focus and non-color status cues.',
    ].join('\n\n'),
    scope: [
      'Implement the selected frontend modules, views, reusable presentation components, state models, adapters, and focused tests.',
      `Selected modules:\n${bullets(moduleLines, 'No module selected.')}`,
      `Routes and views:\n${bullets(routes, 'Use the repository’s existing frontend entry point and route structure.')}`,
      `Approved paths:\n${bullets(ownedPaths, 'Use repository-consistent frontend paths and avoid unrelated modules.')}`,
    ].join('\n\n'),
    constraints: [
      '- Preserve the approved ports-and-adapters boundaries; keep domain rules and external-system details outside presentation code.',
      '- Reuse existing backend, network, persistence, and filesystem boundaries; do not replace or duplicate them in the frontend.',
      '- Use the repository’s established framework, design tokens, components, accessibility patterns, and dependencies.',
      '- Do not invent product scope, operations, domain rules, or external-system behavior.',
      `- Preserve these architecture dependencies:\n${bullets(dependencyLines, 'No selected module dependency is recorded.')}`,
      `- Keep these concerns outside the frontend:\n${bullets(unique(selectedModules.flatMap((module) => module.excludedConcerns)), 'Anything outside the selected module responsibilities.')}`,
      ...(input.application?.constraints.length
        ? [`- Honor approved product constraints:\n${bullets(input.application.constraints.map((item) => item.text), 'No product constraint recorded.')}`]
        : []),
    ].join('\n'),
    acceptanceCriteria: [
      numbered(acceptanceCases.map((item) => `${item.id}: ${item.description} — ${item.expectedOutcome}`), 'The selected module responsibilities and operation boundaries are visibly implemented.'),
      '- Every bound operation has a discoverable interaction, explicit progress, and a visible outcome.',
      '- Loading, empty, validation, rejection, technical failure, cancellation, retry, duplicate action, and success behaviors match the approved bindings where relevant.',
      '- The implementation is responsive and fully usable with keyboard and assistive technology.',
      '- Focused tests, type checking, and the production build pass without weakening existing coverage.',
    ].join('\n'),
    references: [
      `Architecture: ${input.architecture.id} revision ${input.architecture.revision} (${input.architecture.contentHash})`,
      ...(input.application ? [`Application: ${input.application.id} revision ${input.application.revision} (${input.application.contentHash})`] : []),
      ...selectedModules.map((module) => `Module: ${module.moduleId} @ ${module.moduleVersion}`),
      ...relevantBindings.map((binding) => `Binding: ${binding.bindingId} @ ${binding.version} → ${binding.operationId} @ ${binding.operationVersion}`),
    ].join('\n'),
    intentProfile: {
      delivery: 'existing-api-ui',
      backend: 'existing',
      network: 'existing',
      persistence: 'preserve',
      filesystem: 'preserve',
    },
  }
  return {
    schemaVersion: '1.0',
    projectId: input.projectId,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    source: {
      applicationRevision: input.application?.revision,
      architectureRevision: input.architecture.revision,
      architectureHash: input.architecture.contentHash,
      moduleVersions: Object.fromEntries(selectedModules.map((module) => [module.moduleId, module.moduleVersion])),
      bindingVersions: Object.fromEntries(relevantBindings.map((binding) => [binding.bindingId, binding.version])),
    },
    coverage: {
      moduleIds: selectedModules.map((module) => module.moduleId),
      operationIds: unique([...selectedOperationIds]),
      bindingIds: relevantBindings.map((binding) => binding.bindingId),
      routes,
      useCaseIds: unique([
        ...useCases.map((item) => item.id),
        ...workflowTraces.map((trace) => trace.useCaseId),
      ]),
    },
    fields,
    gaps,
  }
}
