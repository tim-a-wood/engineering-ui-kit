/**
 * Pure existing-repository migration planning (CAP-ERA-001 §14.3 existing
 * source repositories, §11.2 repository path proposal, §9 CAP-CONTRACT-030).
 *
 * This is PLANNING only — it never touches the filesystem and never applies
 * anything (applying a `CapabilityMigrationPlan` is WP7/WP9B's concern). Given
 * a `RepositoryEvidence` snapshot (from the frozen `repositoryDiscovery.ts`)
 * plus minimal capability records describing the modules being adopted, this
 * module produces a reviewable, additive `CapabilityMigrationPlan`:
 *
 * - generated composition roots are proposed as new (`create`) files;
 * - existing entry points are proposed as `update` (wrap/extend) — an
 *   existing entry point is NEVER proposed for `delete` or wholesale
 *   replacement;
 * - conventions the plan preserves (package manager, source/test roots,
 *   frameworks) are recorded in `recordTransformations`;
 * - `dataLossAssessment.hasLoss` is always `false` because nothing is ever
 *   deleted or overwritten destructively by this planner;
 * - only genuinely evidence-backed ambiguity (from `discoverRepository`,
 *   `proposeDeployables`, or an ambiguity the caller explicitly flagged on a
 *   capability record) becomes a `blockedAmbiguities` entry — never
 *   fabricated.
 *
 * Design note: `proposeDeployables` (frozen, WP2) places every deployable's
 * default composition root under `discovery.sourceRoots[0]` — a reasonable
 * single-root default for foundation generation, but one that would collapse
 * a mixed-language existing repository's generated HTTP boundary (e.g. a
 * TypeScript UI and a Python API) into a single source root. This module
 * therefore reuses `proposeDeployables` for deployable identity, kind,
 * language, and module allocation, but computes the migration's *target
 * path* itself from language-specific evidence, so a Python deployable's
 * generated file lands in a Python source root and a TypeScript deployable's
 * generated file lands in a TypeScript source root — never both in the same
 * one. `deployables.ts` itself is not modified.
 */

import { canonicalRecordHash } from '../hash.js'
import type {
  ArchitectureModuleDefinition,
  CapabilityMigrationPlan,
  ModuleType,
  RuntimeLanguage,
} from '../types.js'
import { normalizeRepoRelativePath, sortByKey, uniqueSorted } from './paths.js'
import { discoverRepository, type RepositoryEvidence } from './repositoryDiscovery.js'
import { proposeDeployables } from './deployables.js'

/** A minimal, evidence-agnostic capability record describing a module being adopted from an existing repository. */
export type ExistingRepoCapabilityRecord = {
  recordId: string
  moduleId: string
  name: string
  moduleType: ModuleType
  responsibility: string
  providedOperations?: { operationId: string; contractVersion: string }[]
  /**
   * Only set when the caller has direct, evidence-backed knowledge that this
   * record's adoption path is materially ambiguous (e.g. an interview flagged
   * it). The planner never invents an ambiguity itself.
   */
  adoptionAmbiguity?: { id: string; description: string }
}

export type ExistingRepoMigrationInput = {
  migrationPlanId: string
  projectId: string
  evidence: RepositoryEvidence
  capabilityRecords: ExistingRepoCapabilityRecord[]
  versions: CapabilityMigrationPlan['versions']
  runtimeVersionRanges?: Partial<Record<RuntimeLanguage, string>>
  backupInstructions?: string
  rollbackInstructions?: string
  conformanceCommands?: string[]
}

/** One legacy `runtime.mjs`/`runtime.js` module detected in repository evidence (§14.2). */
export type LegacyRuntimeDiagnostic = {
  path: string
  readinessGap: string
  migrationPath: string
}

/** Evidence required before a legacy direct-invocation adapter may be retired (§14.2/WP9). */
export type LegacyRuntimeConformanceEvidence = {
  generatedContractsImplemented: boolean
  compositionRootRegistered: boolean
  realConnectionVerified: boolean
}

export type LegacyRuntimeCompatibilityDecision = {
  status: 'retain' | 'retire'
  missingEvidence: string[]
}

const LEGACY_RUNTIME_MODULE_PATTERN = /(^|\/)runtime\.(mjs|js)$/i
const LANGUAGE_EXTENSIONS: Record<RuntimeLanguage, string[]> = {
  typescript: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
  python: ['.py'],
}

const DEFAULT_BACKUP_INSTRUCTIONS =
  'Back up the target repository (or an export of every path this plan touches) before applying. '
  + 'Apply is atomic and reversible via the rollback bundle (§11.3); this preview never writes to the target repository itself.'
const DEFAULT_ROLLBACK_INSTRUCTIONS =
  'Restore the pre-migration backup and delete only the files this plan created. No existing file is ever deleted or '
  + 'overwritten destructively by this plan, so rollback never requires restoring a deleted source file.'

/**
 * Detect legacy `runtime.mjs`/`runtime.js` modules in repository evidence and
 * emit a readiness-gap diagnostic with a migration path for each (§14.2):
 * legacy modules stay readable/invocable through a compatibility adapter
 * during migration, but direct-invocation evidence does not satisfy new
 * real-connection verification (CAP-CONTRACT-029), and the module is not
 * reference-architecture conformant until it implements generated contracts
 * and is registered through a deployable composition root.
 */
export function detectLegacyRuntimeModules(evidence: RepositoryEvidence): LegacyRuntimeDiagnostic[] {
  const files = evidence.files.map((file) => normalizeRepoRelativePath(file.path))
  const matches = uniqueSorted(files.filter((file) => LEGACY_RUNTIME_MODULE_PATTERN.test(file)))
  return matches.map((path) => ({
    path,
    readinessGap:
      `"${path}" is a legacy runtime module invoked directly. Direct-invocation evidence does not satisfy new `
      + 'real-connection verification (CAP-CONTRACT-029), and the module is not reference-architecture conformant '
      + 'until it implements the generated contracts and is registered through a deployable composition root (§14.2).',
    migrationPath:
      `Keep "${path}" readable and invocable through a compatibility adapter during migration. Wrap it with a generated `
      + 'composition root and inbound binding, implement the generated operation contract behind the existing behavior, '
      + 'then replace direct invocation with an actual connection (real launch, real trigger) before retiring the adapter.',
  }))
}

/**
 * Decide whether compatibility may be removed. Direct legacy invocation is
 * intentionally not an input: it proves continuity during migration, not
 * reference-architecture conformance. The adapter can retire only after all
 * three independent conformance gates have passed.
 */
export function evaluateLegacyRuntimeCompatibility(
  evidence: LegacyRuntimeConformanceEvidence,
): LegacyRuntimeCompatibilityDecision {
  const missingEvidence: string[] = []
  if (!evidence.generatedContractsImplemented) missingEvidence.push('generated-contracts-implemented')
  if (!evidence.compositionRootRegistered) missingEvidence.push('composition-root-registered')
  if (!evidence.realConnectionVerified) missingEvidence.push('real-connection-verified')
  return {
    status: missingEvidence.length === 0 ? 'retire' : 'retain',
    missingEvidence,
  }
}

function extensionForLanguage(language: RuntimeLanguage): string {
  return language === 'python' ? 'py' : 'ts'
}

/**
 * The best-evidenced source root for `language`: the ordinally-first
 * candidate source root that contains at least one file with a
 * language-matching extension. Falls back to `undefined` (never fabricated)
 * when no source root has language-specific evidence.
 */
function sourceRootForLanguage(
  files: readonly string[],
  sourceRoots: readonly string[],
  language: RuntimeLanguage,
): string | undefined {
  const extensions = LANGUAGE_EXTENSIONS[language]
  const matches = sourceRoots.filter((root) => {
    const prefix = root === '.' ? '' : `${root}/`
    return files.some((file) => file.startsWith(prefix) && extensions.some((ext) => file.endsWith(ext)))
  })
  return sortByKey(matches, (root) => root)[0]
}

function recordToModuleDefinition(record: ExistingRepoCapabilityRecord): ArchitectureModuleDefinition {
  return {
    moduleId: record.moduleId,
    name: record.name,
    moduleType: record.moduleType,
    responsibility: record.responsibility,
  }
}

/**
 * Build a reviewable, additive `CapabilityMigrationPlan` (CAP-CONTRACT-030)
 * for adopting an existing repository: generated composition roots are
 * proposed as `create`; existing entry points are proposed as `update`
 * (wrap/extend, never `delete` or wholesale replacement); conventions the
 * plan preserves are recorded; data loss is always assessed as none; and
 * only genuinely evidence-backed ambiguity becomes a `blockedAmbiguities`
 * entry. Pure — reads only the supplied evidence and records.
 */
export function planExistingRepoMigration(input: ExistingRepoMigrationInput): CapabilityMigrationPlan {
  const files = input.evidence.files.map((file) => normalizeRepoRelativePath(file.path))
  const existingFiles = new Set(files)
  const discovery = discoverRepository(input.evidence)

  const moduleDefinitions = input.capabilityRecords.map(recordToModuleDefinition)
  const deployableResult = proposeDeployables({
    architectureModuleIds: input.capabilityRecords.map((record) => record.moduleId),
    architectureModuleDefinitions: moduleDefinitions,
    discovery,
    runtimeVersionRanges: input.runtimeVersionRanges,
  })

  const legacyRuntimeDiagnostics = detectLegacyRuntimeModules(input.evidence)

  // Generated composition roots: additive `create`, placed in a source root
  // with evidence for the deployable's own language (never collapsed onto a
  // different-language deployable's root). A path collision with an
  // existing file is wrapped (`update`) rather than silently overwritten.
  const fileTransformations: CapabilityMigrationPlan['fileTransformations'] = []
  for (const deployable of deployableResult.deployables) {
    const languageRoot = sourceRootForLanguage(files, discovery.sourceRoots, deployable.runtimeLanguage)
      ?? discovery.sourceRoots[0]
    const base = languageRoot ? `${languageRoot}/composition` : 'composition'
    const path = normalizeRepoRelativePath(`${base}/${deployable.kind}.${extensionForLanguage(deployable.runtimeLanguage)}`)
    const modulesDescription = deployable.moduleIds.length > 0 ? deployable.moduleIds.join(', ') : 'no modules allocated'
    if (existingFiles.has(path)) {
      fileTransformations.push({
        path,
        action: 'update',
        description:
          `An existing file already occupies the proposed composition-root location "${path}"; it is extended (not `
          + `replaced) through an explicit edit to additively register deployable "${deployable.deployableId}" `
          + `(${deployable.runtimeLanguage}: ${modulesDescription}).`,
      })
    } else {
      fileTransformations.push({
        path,
        action: 'create',
        description:
          `Create the generated composition root for deployable "${deployable.deployableId}" `
          + `(${deployable.runtimeLanguage}); registers ${modulesDescription} additively alongside existing code.`,
      })
    }
  }

  // Existing entry points: `update` only — wrap/extend through an explicit
  // edit, never `delete` or wholesale replacement (§14.3).
  for (const entryPoint of discovery.entryPoints) {
    fileTransformations.push({
      path: entryPoint,
      action: 'update',
      description:
        `Wrap/extend the existing entry point "${entryPoint}" with an explicit edit that additively invokes the `
        + 'generated composition root. Existing behavior is preserved; the entry point is never replaced wholesale (§14.3).',
    })
  }

  // Record transformations: conventions preserved, plus one promotion note per capability record.
  const recordTransformations: CapabilityMigrationPlan['recordTransformations'] = [
    {
      recordId: `${input.evidence.repositoryId}:conventions`,
      kind: 'preserve-conventions',
      description:
        `Preserved detected repository conventions: package manager "${discovery.packageManager}", `
        + `source roots [${discovery.sourceRoots.join(', ') || 'none detected'}], `
        + `test roots [${discovery.testRoots.join(', ') || 'none detected'}], `
        + `frameworks [${discovery.frameworks.join(', ') || 'none detected'}].`,
    },
    ...input.capabilityRecords.map((record) => {
      const operationSummary = (record.providedOperations ?? []).map((op) => op.operationId).join(', ')
        || 'no provided operations recorded'
      return {
        recordId: record.recordId,
        kind: 'promote-module-record',
        description:
          `Promoted module "${record.moduleId}" (${record.moduleType}) into workspace schema 2.0 without data loss; `
          + `responsibility "${record.responsibility}"; provided operations: ${operationSummary}.`,
      }
    }),
  ]

  const compatibilityShims = uniqueSorted(
    legacyRuntimeDiagnostics.map(
      (diagnostic) => `Legacy runtime compatibility adapter retained for "${diagnostic.path}": ${diagnostic.migrationPath}`,
    ),
  )

  const dataLossDetails = [
    'No existing source file is deleted; every proposed change is additive (create) or a wrapping edit (update) (§14.3).',
    'Existing entry points are wrapped/extended through explicit edits, never replaced wholesale.',
  ]
  if (legacyRuntimeDiagnostics.length > 0) {
    dataLossDetails.push(
      'Legacy runtime.mjs/runtime.js modules remain readable and invocable through a compatibility adapter during migration (§14.2).',
    )
  }

  // Blocked ambiguities: only from repository-discovery evidence, deployable
  // proposal evidence, or a caller-flagged, evidence-backed record ambiguity.
  // Never fabricated.
  const blockedAmbiguities = sortByKey(
    [
      ...discovery.ambiguities.map((ambiguity) => ({
        id: ambiguity.id,
        description: `${ambiguity.question} Choices: ${ambiguity.choices.join(', ')}.`,
      })),
      ...deployableResult.ambiguities.map((ambiguity) => ({
        id: ambiguity.id,
        description: `${ambiguity.question} Choices: ${ambiguity.choices.join(', ')}.`,
      })),
      ...input.capabilityRecords
        .filter((record): record is ExistingRepoCapabilityRecord & { adoptionAmbiguity: { id: string; description: string } } =>
          Boolean(record.adoptionAmbiguity))
        .map((record) => record.adoptionAmbiguity),
    ],
    (ambiguity) => ambiguity.id,
  )

  const orderedFileTransformations = sortByKey(fileTransformations, (change) => change.path)
  const previewHashes = uniqueSorted(orderedFileTransformations.map((change) => canonicalRecordHash(change)))

  return {
    schemaVersion: '1.0',
    migrationPlanId: input.migrationPlanId,
    projectId: input.projectId,
    versions: input.versions,
    recordTransformations: sortByKey(recordTransformations, (record) => record.recordId),
    fileTransformations: orderedFileTransformations,
    compatibilityShims,
    dataLossAssessment: { hasLoss: false, details: uniqueSorted(dataLossDetails) },
    blockedAmbiguities,
    previewHashes,
    backupInstructions: input.backupInstructions ?? DEFAULT_BACKUP_INSTRUCTIONS,
    rollbackInstructions: input.rollbackInstructions ?? DEFAULT_ROLLBACK_INSTRUCTIONS,
    conformanceCommands: input.conformanceCommands ? [...input.conformanceCommands] : [],
  }
}
