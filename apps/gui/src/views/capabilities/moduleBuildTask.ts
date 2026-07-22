import type {
  ArchitectureSpecification,
  FoundationPlan,
  ModuleImplementationBrief,
  ModuleManifest,
} from '@engineering-ui-kit/core'
import type { TaskPacketFields } from '../../bridge'
import { humanizeIdentifier } from './capabilityPresentation'

/** Generated deployment references a From-spec UI build should carry. */
export type UiModuleDeploymentContext = NonNullable<ModuleImplementationBrief['deployment']>

export function deploymentContextFor(
  foundation: FoundationPlan | undefined,
  moduleId: string,
  manifest?: ModuleManifest,
): UiModuleDeploymentContext | undefined {
  const allocation = foundation?.allocations.find((candidate) => candidate.moduleId === moduleId)
  const deployable = allocation
    ? foundation?.deployables.find((candidate) => candidate.deployableId === allocation.deployableId)
    : undefined
  if (!deployable) return undefined
  const generatedRoot = `src/generated/${deployable.deployableId.replaceAll('/', '-')}`
  const generatedContractRefs = manifest
    ? [
        ...manifest.providedOperations.map((operation) => `${operation.operationId}@${operation.contractVersion} (${generatedRoot}/operations.g.ts)`),
        ...manifest.requiredOperations.map((operation) => `${operation.operationId}@${operation.acceptedContractRange} (${generatedRoot}/operations.g.ts)`),
        ...(manifest.configurationSchemaRef ? [manifest.configurationSchemaRef] : []),
      ]
    : []
  const fallbackCommands = deployable.runtimeLanguage === 'typescript'
    ? { install: 'npm install', build: 'npx tsc -p tsconfig.engineering-ui.json' }
    : { install: 'python -m pip install -r requirements.engineering-ui.txt' }
  const commands = Object.keys(deployable.commands).length ? deployable.commands : fallbackCommands
  return {
    deployableId: deployable.deployableId,
    kind: deployable.kind,
    runtimeLanguage: deployable.runtimeLanguage,
    runtimeVersionRange: deployable.runtimeVersionRange,
    compositionRootPath: deployable.compositionRootPath,
    commands,
    generatedContractRefs,
    generatedTypeTargets: [`${generatedRoot}/types.g.ts`, `${generatedRoot}/operations.g.ts`],
    acceptanceCommands: Object.values(commands),
  }
}

export function buildUiModuleTaskFields(
  manifest: ModuleManifest,
  architecture: ArchitectureSpecification,
  deployment?: UiModuleDeploymentContext,
): TaskPacketFields {
  const bullets = (values: string[], fallback: string) => values.length
    ? values.map((value) => `- ${value}`).join('\n')
    : `- ${fallback}`
  const numbered = (values: string[], fallback: string) => (values.length ? values : [fallback])
    .map((value, index) => `${index + 1}. ${value}`)
    .join('\n')
  const definitions = new Map((architecture.moduleDefinitions ?? []).map((definition) => [definition.moduleId, definition]))
  const moduleName = (moduleId: string) => definitions.get(moduleId)?.name || humanizeIdentifier(moduleId)
  const provided = manifest.providedOperations.map((operation) => (
    `${humanizeIdentifier(operation.operationId)} (${operation.operationId} @ ${operation.contractVersion})`
  ))
  const required = manifest.requiredOperations.map((operation) => (
    `${humanizeIdentifier(operation.operationId)} (${operation.operationId}, accepts ${operation.acceptedContractRange}) — ${operation.reason}`
  ))
  const owned = manifest.ownedConcerns.map((concern) => `${humanizeIdentifier(concern)} (${concern})`)
  const excluded = manifest.excludedConcerns.map((concern) => `${humanizeIdentifier(concern)} (${concern})`)
  const journeys = (architecture.capabilityProjections ?? [])
    .filter((projection) => projection.moduleIds.includes(manifest.moduleId))
    .map((projection) => projection.name || humanizeIdentifier(projection.id))
  const traces = (architecture.workflowTraces ?? [])
    .filter((trace) => trace.moduleIds.includes(manifest.moduleId))
    .map((trace) => `${humanizeIdentifier(trace.useCaseId)}: ${trace.moduleIds.map(moduleName).join(' → ')}`)
  const dependencies = (architecture.dependencyEdges ?? [])
    .filter((edge) => edge.fromModuleId === manifest.moduleId)
    .map((edge) => `${moduleName(edge.toModuleId)} — ${edge.reason}`)
  const consumers = (architecture.dependencyEdges ?? [])
    .filter((edge) => edge.toModuleId === manifest.moduleId)
    .map((edge) => `${moduleName(edge.fromModuleId)} — ${edge.reason}`)
  const functionalRequirements = [
    ...provided.map((operation) => `Provide a clear, discoverable interface for ${operation}, with visible confirmation of the outcome.`),
    ...manifest.requiredOperations.map((operation) => `Consume ${humanizeIdentifier(operation.operationId)} (${operation.operationId}, accepts ${operation.acceptedContractRange}) for this purpose: ${operation.reason.replace(/[.\s]+$/, '')}. Keep the call behind the approved module boundary; do not reproduce the capability or its business rules in presentation code.`),
    'Organize the smallest coherent set of screens, panels, and dialogs that fully supports the approved responsibility and journeys; do not add unrelated product scope.',
    'Make validation specific and actionable, preserve entered data after recoverable failures, and prevent accidental duplicate submissions.',
  ]
  const requirementSpec = [
    `# Approved UI requirement spec — ${manifest.name}`,
    `## Product outcome\nBuild a polished, production-quality user interface for **${manifest.name}**. ${manifest.responsibility}`,
    `## Users and supported journeys\n${bullets(journeys, 'Use the approved module responsibility to infer the primary user journey without expanding product scope.')}\n\nWorkflow traces:\n${bullets(traces, 'No cross-module workflow trace was recorded; keep navigation focused on this module’s responsibility.')}`,
    `## Functional requirements\n${numbered(functionalRequirements, 'Represent the approved module responsibility as a complete, usable interface.')}`,
    `## Capability interactions\nOperations this UI provides:\n${bullets(provided, 'No outward operation was recorded; present the module’s information and status without inventing commands.')}\n\nOperations this UI requires:\n${bullets(required, 'No capability dependency was recorded; keep sample data behind a replaceable local interface.')}`,
    `## Information, ownership, and boundaries\nThis UI owns:\n${bullets(owned, 'Presentation of the approved module responsibility.')}\n\nThis UI explicitly does not own:\n${bullets(excluded, 'Domain rules, persistence, orchestration, and external integration outside its approved responsibility.')}\n\nAllowed implementation paths:\n${bullets(manifest.ownedPaths, 'Choose paths that match the repository’s existing UI feature structure and do not modify unrelated modules.')}`,
    `## Architecture context\nThis module depends on:\n${bullets(dependencies, 'No module dependency is recorded.')}\n\nOther modules depending on this UI:\n${bullets(consumers, 'No downstream module dependency is recorded.')}\n\nKeep every interaction behind the named operation boundary so the local sample implementation can be replaced when the shared application setup is generated without rewriting the UI.`,
    `## Required experience states\n- Show intentional initial, loading, ready, empty, partial-data, validation-error, capability-rejection, technical-failure, cancelled, and retrying states where relevant.\n- Use local sample fixtures for this build; keep fixtures and state variants outside view markup and make every state easy to exercise.\n- For long-running actions, show progress and cancellation when supported. For destructive or irreversible actions, require clear confirmation.\n- Never leave a blank panel, silent failure, ambiguous disabled action, or color-only status.`,
    `## Responsive and accessible behavior\n- Design desktop, tablet, narrow-window, and keyboard-only layouts; content must reflow without horizontal page scrolling.\n- Use semantic landmarks, headings, labels, descriptions, and status announcements. Preserve logical focus order and restore focus after dialogs.\n- Provide visible focus, sufficient contrast, non-color status cues, meaningful empty/error copy, and reduced-motion behavior.\n- Keep primary actions obvious, secondary actions quieter, and dense technical details progressively disclosed.`,
    `## Visual and interaction quality\n- Follow the repository’s established design system, semantic tokens, components, spacing, and typography.\n- Establish a clear information hierarchy with aligned panels, consistent control placement, restrained decoration, and deliberate whitespace.\n- Reuse existing components before introducing new ones. Do not imitate a generic dashboard when the approved workflow calls for a more focused task surface.`,
    `## Verification targets\n- Every listed responsibility, owned concern, provided operation, required operation, and workflow is visibly accounted for.\n- Each relevant state can be reached with deterministic sample data.\n- Keyboard, focus, validation, responsive, and failure behaviors have automated or documented verification.\n- Type checking, tests, and the production build pass without weakening existing coverage.`,
    ...(deployment
      ? [
          `## Generated deployment references\nThis module is hosted by the approved foundation plan's \`${deployment.deployableId}\` deployable (${deployment.kind}, ${deployment.runtimeLanguage} ${deployment.runtimeVersionRange}).\n\nComposition root: \`${deployment.compositionRootPath}\`\n\nCommands:\n${bullets(Object.entries(deployment.commands).map(([label, command]) => `${label}: ${command}`), 'No generated commands recorded.')}\n\nGenerated contract references:\n${bullets(deployment.generatedContractRefs, 'No generated contract references recorded.')}\n\nGenerated type targets:\n${bullets(deployment.generatedTypeTargets, 'No generated type targets recorded.')}\n\nAcceptance commands:\n${bullets(deployment.acceptanceCommands, 'No generated acceptance commands recorded.')}`,
        ]
      : []),
  ].join('\n\n')
  return {
    taskTitle: `Build UI from approved capability spec: ${manifest.name}`,
    goal: requirementSpec,
    scope: [
      `Approved module: ${manifest.moduleId} @ ${manifest.moduleVersion}`,
      '- Implement the UI views, reusable presentation components, local state fixtures, and focused UI tests required by the specification.',
      '- Use sample adapters for approved capability ports so the shared application setup can replace them without changing view components.',
      `- Account for these provided operations:\n${bullets(provided, 'No outward operation is recorded.')}`,
      `- Account for these required operations:\n${bullets(required, 'No required operation is recorded.')}`,
      `- Work only within approved or repository-consistent UI paths:\n${bullets(manifest.ownedPaths, 'Use the existing UI feature structure.')}`,
    ].join('\n\n'),
    constraints: [
      '- Preserve the approved ports-and-adapters boundaries; keep domain logic outside the UI module.',
      '- Do not call a real backend, network service, filesystem, or platform adapter in this build; use typed local fixtures behind the approved interfaces.',
      '- Use the repository’s existing design system, component patterns, visual language, framework, and dependencies.',
      '- Do not invent new domain rules, capability contracts, operations, or product scope.',
      `- Do not take ownership of:\n${bullets(excluded, 'Anything outside the approved module boundary.')}`,
    ].join('\n'),
    acceptanceCriteria: [
      '- The complete requirement spec in the Goal section is implemented and traceable in the resulting UI.',
      '- Every approved user-facing operation has a clear action, state model, and visible outcome.',
      '- Required capability operations are consumed through the approved interfaces, not reimplemented in the UI.',
      '- Loading, empty, validation, rejection, technical failure, cancellation, duplicate action, success, and retry behaviors are represented where applicable.',
      '- The module is visually polished, responsive, and accessible by keyboard and assistive technology.',
      '- Relevant tests, type checks, and the project build pass.',
    ].join('\n'),
    references: [
      `Capabilities architecture: ${architecture.id} revision ${architecture.revision}`,
      `Module manifest: ${manifest.moduleId} @ ${manifest.moduleVersion}`,
      `Runtime allocation: ${humanizeIdentifier(manifest.runtimeAllocation)}`,
      `Verification suites: ${manifest.verificationSuiteIds.join(', ') || 'none recorded'}`,
      ...(deployment
        ? [
            `Deployable: ${deployment.deployableId} (${deployment.kind}, ${deployment.runtimeLanguage} ${deployment.runtimeVersionRange})`,
            `Composition root: ${deployment.compositionRootPath}`,
            ...Object.entries(deployment.commands).map(([label, command]) => `Command (${label}): ${command}`),
            ...deployment.generatedContractRefs.map((ref) => `Generated contract: ${ref}`),
            ...deployment.generatedTypeTargets.map((ref) => `Generated type target: ${ref}`),
            ...deployment.acceptanceCommands.map((command) => `Acceptance command: ${command}`),
          ]
        : []),
    ].join('\n'),
  }
}
