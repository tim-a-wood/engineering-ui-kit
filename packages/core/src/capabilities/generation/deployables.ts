/**
 * Deployable and language proposal (CAP-ERA-001 §9 CAP-CONTRACT-024, §11.1
 * `deployables.ts`).
 *
 * Pure: proposes `DeployableSpecification` records from supplied architecture
 * module identity plus repository-discovery evidence. Module-to-deployable
 * allocation here is deliberately conservative (experience-type modules to a
 * UI-facing deployable, everything else to the primary backend deployable);
 * richer allocation refinement is WP5's foundation-orchestration concern.
 * Each proposed deployable uses exactly one runtime language.
 */

import type {
  ArchitectureModuleDefinition,
  DeployableKind,
  DeployableSpecification,
  ProposedLocation,
  ProposedLocationApprovalStatus,
  RuntimeLanguage,
} from '../types.js'
import type { AmbiguityChoice, RepositoryDiscoveryResult } from './repositoryDiscovery.js'
import { normalizeRepoRelativePath, sortByKey, uniqueSorted } from './paths.js'

type DeployableKindEvidence = {
  kind: DeployableKind
  language: RuntimeLanguage
  evidence: string
}

const UI_FRAMEWORKS = ['react', 'vue', 'svelte', '@angular/core']
const HTTP_FRAMEWORKS_TS = ['express', 'fastify', '@nestjs/core']
const HTTP_FRAMEWORKS_PY = ['fastapi', 'django', 'flask']
const BACKEND_PRIORITY: DeployableKind[] = ['http-api', 'cli', 'worker', 'embedded-library', 'electron-main']

function deployableName(kind: DeployableKind): string {
  return kind
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function extensionFor(language: RuntimeLanguage): string {
  return language === 'python' ? 'py' : 'ts'
}

function buildDefaultCompositionPath(candidate: DeployableKindEvidence, discovery: RepositoryDiscoveryResult): string {
  const root = discovery.sourceRoots[0]
  const base = root ? `${root}/composition` : 'composition'
  return normalizeRepoRelativePath(`${base}/${candidate.kind}.${extensionFor(candidate.language)}`)
}

function compositionEvidence(candidate: DeployableKindEvidence, discovery: RepositoryDiscoveryResult): string {
  const root = discovery.sourceRoots[0]
  return root
    ? `evidence-derived source root "${root}"; ${candidate.evidence}`
    : `no existing source-root evidence; ${candidate.evidence}`
}

export type ApprovedDeployableLocation = {
  deployableId: string
  path: string
}

export type DeployableProposalInput = {
  /** Module ids belonging to the approved architecture revision (only these may be allocated). */
  architectureModuleIds: string[]
  /** Optional design-time module definitions, used to route `experience` modules to a UI deployable. */
  architectureModuleDefinitions?: ArchitectureModuleDefinition[]
  discovery: RepositoryDiscoveryResult
  /** Runtime version range per language, e.g. `{ typescript: '>=22', python: '>=3.11' }`. */
  runtimeVersionRanges?: Partial<Record<RuntimeLanguage, string>>
  /** Previously user-approved deployable locations to persist across regeneration (CAP-TEST-051). */
  approvedLocations?: readonly ApprovedDeployableLocation[]
}

export type DeployableProposalResult = {
  deployables: DeployableSpecification[]
  ambiguities: AmbiguityChoice[]
}

const DEFAULT_RUNTIME_VERSION_RANGE: Record<RuntimeLanguage, string> = {
  typescript: '>=22',
  python: '>=3.11',
}

/**
 * Propose `DeployableSpecification`s from repository-discovery evidence and
 * approved architecture module identity. Only surfaces ambiguity when the
 * evidence genuinely does not determine a unique, defensible proposal.
 */
export function proposeDeployables(input: DeployableProposalInput): DeployableProposalResult {
  const ambiguities: AmbiguityChoice[] = []
  const frameworks = new Set(input.discovery.frameworks)
  const candidates: DeployableKindEvidence[] = []

  if (frameworks.has('electron')) {
    candidates.push({ kind: 'electron-main', language: 'typescript', evidence: 'manifest dependency "electron"' })
  }
  const uiFramework = UI_FRAMEWORKS.find((name) => frameworks.has(name))
  if (uiFramework) {
    candidates.push({ kind: 'browser', language: 'typescript', evidence: `manifest dependency "${uiFramework}"` })
  }

  const tsHttp = HTTP_FRAMEWORKS_TS.find((name) => frameworks.has(name))
  const pyHttp = HTTP_FRAMEWORKS_PY.find((name) => frameworks.has(name))
  if (tsHttp && pyHttp) {
    ambiguities.push({
      id: 'http-api-language',
      question: 'Both TypeScript and Python HTTP frameworks were detected. Which language should the http-api deployable use?',
      choices: sortByKey([tsHttp, pyHttp], (value) => value),
    })
  } else if (tsHttp) {
    candidates.push({ kind: 'http-api', language: 'typescript', evidence: `manifest dependency "${tsHttp}"` })
  } else if (pyHttp) {
    candidates.push({ kind: 'http-api', language: 'python', evidence: `manifest dependency "${pyHttp}"` })
  }

  if (candidates.length === 0 && !(tsHttp && pyHttp)) {
    if (input.discovery.languages.length === 1) {
      const language = input.discovery.languages[0] as RuntimeLanguage
      candidates.push({
        kind: 'embedded-library',
        language,
        evidence: `single detected runtime language "${language}" and no host-framework evidence`,
      })
    } else if (input.discovery.languages.length > 1) {
      ambiguities.push({
        id: 'deployable-language',
        question: 'Multiple runtime languages were detected and no host framework identifies a deployable. Which language should the default deployable use?',
        choices: sortByKey(input.discovery.languages, (value) => value),
      })
    } else {
      candidates.push({
        kind: 'embedded-library',
        language: 'typescript',
        evidence: 'greenfield repository with no file or framework evidence; defaulting to the TypeScript baseline (CAP-ERA-001 §5.3)',
      })
    }
  }

  const experienceModuleIds = (input.architectureModuleDefinitions ?? [])
    .filter((module) => module.moduleType === 'experience')
    .map((module) => module.moduleId)
    .filter((moduleId) => input.architectureModuleIds.includes(moduleId))
  const nonExperienceModuleIds = input.architectureModuleIds.filter(
    (moduleId) => !experienceModuleIds.includes(moduleId),
  )

  const uiCandidate = candidates.find((c) => c.kind === 'browser') ?? candidates.find((c) => c.kind === 'electron-main')
  const backendCandidate = BACKEND_PRIORITY
    .map((kind) => candidates.find((c) => c.kind === kind))
    .find((c): c is DeployableKindEvidence => Boolean(c))

  if (experienceModuleIds.length > 0 && !uiCandidate) {
    ambiguities.push({
      id: 'ui-deployable-missing',
      question: 'Experience-type modules exist but no UI host framework was detected. Which deployable kind should host them?',
      choices: ['browser', 'electron-main'],
    })
  }

  const approvedByDeployableId = new Map((input.approvedLocations ?? []).map((entry) => [entry.deployableId, entry]))
  const runtimeVersionRanges = { ...DEFAULT_RUNTIME_VERSION_RANGE, ...input.runtimeVersionRanges }

  const deployables = sortByKey(candidates, (candidate) => candidate.kind).map((candidate) => {
    const deployableId = candidate.kind
    const moduleIds =
      candidate === uiCandidate && candidate === backendCandidate
        ? [...experienceModuleIds, ...nonExperienceModuleIds]
        : candidate === uiCandidate
          ? experienceModuleIds
          : candidate === backendCandidate
            ? nonExperienceModuleIds
            : []
    const approved = approvedByDeployableId.get(deployableId)
    const proposedPath = approved
      ? normalizeRepoRelativePath(approved.path)
      : buildDefaultCompositionPath(candidate, input.discovery)
    const proposedLocations: ProposedLocation[] = [
      {
        path: proposedPath,
        evidence: approved
          ? 'user-approved location persisted from a prior generation plan'
          : compositionEvidence(candidate, input.discovery),
        approvalStatus: (approved ? 'approved' : 'proposed') satisfies ProposedLocationApprovalStatus,
      },
    ]
    const spec: DeployableSpecification = {
      schemaVersion: '1.0',
      deployableId,
      name: deployableName(candidate.kind),
      kind: candidate.kind,
      runtimeLanguage: candidate.language,
      runtimeVersionRange: runtimeVersionRanges[candidate.language] ?? DEFAULT_RUNTIME_VERSION_RANGE[candidate.language],
      moduleIds: uniqueSorted(moduleIds),
      inboundBindingIds: [],
      compositionRootPath: proposedPath,
      commands: {},
      configurationRefs: [],
      secretReferenceIds: [],
      proposedLocations,
    }
    return spec
  })

  return { deployables, ambiguities: sortByKey(ambiguities, (item) => item.id) }
}
