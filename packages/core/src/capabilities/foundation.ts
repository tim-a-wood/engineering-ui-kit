/**
 * Foundation planning (WP5A-core): the pure orchestration layer that turns an
 * approved `ArchitectureSpecification` plus optional repository-discovery
 * evidence into a single reviewable `FoundationPlan` — deployable proposals,
 * module-to-deployable allocation explanations, and ambiguity
 * question/answer resolution — before any generation occurs.
 *
 * This module is a NON-contract wrapper: `FoundationPlan` is not a frozen
 * CAP-CONTRACT record. It reuses `proposeDeployables` (`generation/deployables.ts`)
 * for all allocation logic rather than duplicating it; ambiguity answers are
 * translated into adjusted discovery evidence and re-fed through the same
 * pure proposal function so the result stays derivable from first principles.
 */

import type { ArchitectureSpecification, DeployableSpecification, ModuleType, RuntimeLanguage } from './types.js'
import type { AmbiguityChoice, RepositoryDiscoveryResult } from './generation/repositoryDiscovery.js'
import { type ApprovedDeployableLocation, proposeDeployables } from './generation/deployables.js'
import { sortByKey, uniqueSorted } from './generation/paths.js'
import { canonicalHash } from './hash.js'

/** A human-readable reason a module was allocated to a particular deployable. */
export type ModuleAllocationExplanation = {
  moduleId: string
  deployableId: string
  moduleType: ModuleType
  rationale: string
}

/** A user-supplied resolution for one `AmbiguityChoice.id`. */
export type FoundationAmbiguityAnswer = {
  id: string
  choice: string
}

/**
 * Non-contract foundation plan: the reviewable bundle of proposed deployables,
 * their module allocation rationale, and ambiguity resolution state, prior to
 * generation.
 */
export type FoundationPlan = {
  schemaVersion: '1.0'
  projectId: string
  architectureId: string
  architectureRevision: string
  /** The `ArchitectureSpecification.contentHash` this plan was derived from — used for staleness detection. */
  architectureHash: string
  deployables: DeployableSpecification[]
  allocations: ModuleAllocationExplanation[]
  resolvedAnswers: FoundationAmbiguityAnswer[]
  unresolvedAmbiguities: AmbiguityChoice[]
  readiness: {
    status: 'ready' | 'ambiguous' | 'blocked'
    issues: { id: string; text: string }[]
  }
  contentHash: string
}

const EMPTY_DISCOVERY: RepositoryDiscoveryResult = {
  packageManager: 'unknown',
  languages: [],
  sourceRoots: [],
  testRoots: [],
  entryPoints: [],
  frameworks: [],
  existingCompositionPaths: [],
  ciOperatingSystems: [],
  ambiguities: [],
}

/**
 * Translate answered ambiguities into adjusted discovery evidence so a
 * second `proposeDeployables` pass resolves them without duplicating its
 * allocation logic. Unknown ambiguity ids are left unresolved (no adjustment).
 */
function applyAnswers(
  discovery: RepositoryDiscoveryResult,
  ambiguities: readonly AmbiguityChoice[],
  answers: readonly FoundationAmbiguityAnswer[],
): RepositoryDiscoveryResult {
  const answerByAmbiguityId = new Map(answers.map((answer) => [answer.id, answer.choice]))
  let frameworks = discovery.frameworks
  let languages = discovery.languages

  for (const ambiguity of ambiguities) {
    const choice = answerByAmbiguityId.get(ambiguity.id)
    if (choice === undefined || !ambiguity.choices.includes(choice)) continue

    if (ambiguity.id === 'deployable-language') {
      // Restrict to exactly the chosen runtime language.
      languages = [choice as RuntimeLanguage]
      continue
    }
    if (ambiguity.id === 'ui-deployable-missing') {
      // Inject a framework marker so `proposeDeployables` detects the chosen UI host kind.
      const marker = choice === 'electron-main' ? 'electron' : 'react'
      frameworks = uniqueSorted([...frameworks, marker])
      continue
    }
    // Generic resolution (e.g. `http-api-language`): drop every losing choice
    // (evidence for a competing framework) so only the chosen one remains.
    const losingChoices = ambiguity.choices.filter((candidate) => candidate !== choice)
    frameworks = frameworks.filter((framework) => !losingChoices.includes(framework))
  }

  return { ...discovery, frameworks, languages }
}

function moduleTypeFor(architecture: ArchitectureSpecification, moduleId: string): ModuleType {
  return architecture.moduleDefinitions?.find((definition) => definition.moduleId === moduleId)?.moduleType ?? 'domain'
}

function rationaleFor(moduleType: ModuleType, deployable: DeployableSpecification): string {
  if (moduleType === 'experience') {
    return `experience module → UI host \`${deployable.kind}\``
  }
  if (deployable.kind === 'embedded-library') {
    return `single runtime language → \`embedded-library\``
  }
  return `non-experience module → backend host \`${deployable.kind}\``
}

function buildAllocations(
  architecture: ArchitectureSpecification,
  deployables: readonly DeployableSpecification[],
): ModuleAllocationExplanation[] {
  const allocations: ModuleAllocationExplanation[] = []
  for (const deployable of deployables) {
    for (const moduleId of deployable.moduleIds) {
      const moduleType = moduleTypeFor(architecture, moduleId)
      allocations.push({
        moduleId,
        deployableId: deployable.deployableId,
        moduleType,
        rationale: rationaleFor(moduleType, deployable),
      })
    }
  }
  return sortByKey(allocations, (allocation) => `${allocation.moduleId}::${allocation.deployableId}`)
}

/**
 * Propose a `FoundationPlan` from an approved architecture and optional
 * repository-discovery evidence, resolving any `answers` supplied for
 * previously surfaced ambiguities. Reuses `proposeDeployables` for all
 * allocation logic; re-running with the same `answers` is idempotent.
 */
export function proposeFoundation(input: {
  architecture: ArchitectureSpecification
  discovery?: RepositoryDiscoveryResult
  runtimeVersionRanges?: Partial<Record<RuntimeLanguage, string>>
  approvedLocations?: readonly ApprovedDeployableLocation[]
  answers?: readonly FoundationAmbiguityAnswer[]
}): FoundationPlan {
  const discovery = input.discovery ?? EMPTY_DISCOVERY
  const answers = input.answers ?? []

  const baseResult = proposeDeployables({
    architectureModuleIds: input.architecture.moduleIds,
    architectureModuleDefinitions: input.architecture.moduleDefinitions,
    discovery,
    runtimeVersionRanges: input.runtimeVersionRanges,
    approvedLocations: input.approvedLocations,
  })

  const resolvedAnswers = answers.filter((answer) =>
    baseResult.ambiguities.some((ambiguity) => ambiguity.id === answer.id && ambiguity.choices.includes(answer.choice)),
  )

  const finalResult = resolvedAnswers.length
    ? proposeDeployables({
        architectureModuleIds: input.architecture.moduleIds,
        architectureModuleDefinitions: input.architecture.moduleDefinitions,
        discovery: applyAnswers(discovery, baseResult.ambiguities, resolvedAnswers),
        runtimeVersionRanges: input.runtimeVersionRanges,
        approvedLocations: input.approvedLocations,
      })
    : baseResult

  const unresolvedAmbiguities = sortByKey(finalResult.ambiguities, (ambiguity) => ambiguity.id)
  const allocations = buildAllocations(input.architecture, finalResult.deployables)

  const issues: { id: string; text: string }[] = []
  if (finalResult.deployables.length === 0) {
    issues.push({
      id: 'no-deployables',
      text: 'No deployables could be proposed from the supplied architecture and discovery evidence.',
    })
  }
  for (const ambiguity of unresolvedAmbiguities) {
    issues.push({ id: ambiguity.id, text: ambiguity.question })
  }
  const status: FoundationPlan['readiness']['status'] =
    unresolvedAmbiguities.length > 0 ? 'ambiguous' : finalResult.deployables.length === 0 ? 'blocked' : 'ready'

  const bodyWithoutHash = {
    schemaVersion: '1.0' as const,
    projectId: input.architecture.projectId,
    architectureId: input.architecture.id,
    architectureRevision: input.architecture.revision,
    architectureHash: input.architecture.contentHash,
    deployables: finalResult.deployables,
    allocations,
    resolvedAnswers,
    unresolvedAmbiguities,
    readiness: { status, issues },
  }

  return { ...bodyWithoutHash, contentHash: canonicalHash(bodyWithoutHash) }
}

/**
 * Gate implementation for the foundation → implementation handoff: enabled
 * only when an approved foundation exists AND was derived from the currently
 * approved architecture's exact content hash. A re-approved architecture
 * whose hash changed makes the prior foundation stale and re-blocks the gate
 * (impact-scoped staleness) until the foundation is re-approved.
 */
export function foundationHandoffGate(input: {
  approvedFoundation?: FoundationPlan
  approvedArchitecture: ArchitectureSpecification
}): { enabled: boolean; reason?: string } {
  if (!input.approvedFoundation) {
    return { enabled: false, reason: 'No approved foundation plan exists for this project.' }
  }
  if (input.approvedFoundation.architectureHash !== input.approvedArchitecture.contentHash) {
    return {
      enabled: false,
      reason:
        'The approved foundation plan is stale: the approved architecture content hash has changed since the foundation was approved.',
    }
  }
  return { enabled: true }
}
