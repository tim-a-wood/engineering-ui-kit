/**
 * EUC-13: Persistence and migration adapter (migration half).
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §23 (all).
 *
 * Pure planning and record production: every function here is fs-free and
 * takes already-loaded records, returning records for a caller to persist
 * through `DesignWorkspace` (`./designWorkspace.js`). Keeping this module
 * pure lets it be unit-tested without a filesystem and keeps the "do not
 * touch legacy approvals" guarantee structural rather than incidental: this
 * module never calls `fs` and never imports `../persistence.ts`.
 */

import type { ArchitectureSpecification, ModuleImplementationSpecification, ModuleManifest, OperationContract } from '../types.js'
import type { ModuleInterviewResponse } from '../moduleInterview.js'
import { createModuleDesignDraft, evaluateTypeSpecificCompleteness } from './moduleDesign.js'
import { designContentHash, stableSortStrings } from './identity.js'
import type {
  DesignAuditEvent,
  DesignBaseline,
  DesignFeatureFlag,
  DesignImpactRecord,
  DesignWorkflowPolicy,
  DiagramDiscussionEntry,
  ModuleDesignSpecification,
  ReturnedDelta,
  ScenarioRun,
  UnresolvedDesignItem,
  UseCaseAnalysis,
} from './records.js'
import type { ApplicationSpecification } from '../types.js'
import type { DesignWorkspace } from './designWorkspace.js'

// ---------------------------------------------------------------------------
// §23.1: migrate an existing project's approved architecture and modules
// into one draft ModuleDesignSpecification per allocated module.
// ---------------------------------------------------------------------------

export type MigrateModuleInput = {
  manifest: ModuleManifest
  /** Preserved module interview, when one was captured (§23.1 item 3). */
  interview?: ModuleInterviewResponse
  /** Approved operation contracts this module provides, when available. */
  providedContracts?: OperationContract[]
  /** Preserved implementation specification, when one exists (§23.1 item 3). */
  implementationSpec?: ModuleImplementationSpecification
  /** Repository-derived context references (paths, patterns) with no structured record yet. */
  repositoryContextRefs?: string[]
}

export type MigrateExistingProjectInput = {
  projectId: string
  /** The approved architecture, preserved untouched by this function (§23.1 item 1). */
  architecture: ArchitectureSpecification
  modules: MigrateModuleInput[]
  now: string
}

/** §23.1: one migration-produced draft per module, with provenance for review. */
export type DesignMigrationPlan = {
  schemaVersion: '1.0'
  projectId: string
  preservedArchitecture: { id: string; revision: string; contentHash: string }
  moduleDesignDraftIds: string[]
  /** moduleId -> field paths this migration inferred rather than the user authoring (§23.1 item 4). */
  inferredFieldPathsByModule: Record<string, string[]>
  /** moduleId -> needsInput diagnostics for missing type-specific fields (§23.1 item 5). */
  needsInputByModule: Record<string, UnresolvedDesignItem[]>
  createdAt: string
}

export type MigrateExistingProjectResult = {
  plan: DesignMigrationPlan
  /** Drafts to persist via `DesignWorkspace.saveModuleDesignDraft`; never `approved` (§23.1 item 7). */
  moduleDesigns: ModuleDesignSpecification[]
}

function migrateOneModule(
  projectId: string,
  architecture: ArchitectureSpecification,
  input: MigrateModuleInput,
): { design: ModuleDesignSpecification; inferredFieldPaths: string[]; missingItems: UnresolvedDesignItem[] } {
  const { manifest, interview, providedContracts = [], implementationSpec } = input
  const inferredFieldPaths: string[] = []

  let design = createModuleDesignDraft({
    projectId,
    architecture,
    moduleId: manifest.moduleId,
    moduleVersion: manifest.moduleVersion,
    runtimeAllocation: manifest.runtimeAllocation,
    ownedPaths: manifest.ownedPaths,
  })

  // Always available from the manifest (§23.1 item 3 "current ModuleManifest").
  design = {
    ...design,
    module: {
      ...design.module,
      nonResponsibilities: manifest.excludedConcerns,
      ownedConcerns: manifest.ownedConcerns,
      excludedConcerns: manifest.excludedConcerns,
    },
    requiredOperations: manifest.requiredOperations.map((op) => ({
      operationId: op.operationId,
      acceptedVersionRange: op.acceptedContractRange,
      reason: op.reason,
    })),
  }
  inferredFieldPaths.push('module.nonResponsibilities', 'module.ownedConcerns', 'module.excludedConcerns', 'requiredOperations')

  // Fill in contract identity/hash for any provided operation whose approved contract we have.
  if (providedContracts.length) {
    design = {
      ...design,
      providedOperations: design.providedOperations.map((op) => {
        const contract = providedContracts.find((candidate) => candidate.operationId === op.operationId)
        return contract ? { ...op, version: contract.version, contentHash: designContentHash(contract) } : op
      }),
    }
    inferredFieldPaths.push('providedOperations')
  }

  // Preserved module interview (§23.1 item 3 "preserved module interview").
  if (interview) {
    design = {
      ...design,
      rules: interview.rules ?? [],
      schemas: (interview.dataSchemas ?? []).map((schema) => ({
        schemaId: schema.schemaId,
        version: '1.0.0',
        role: 'input' as const,
        ref: schema.schemaId,
      })),
      verification: {
        ...design.verification,
        acceptanceCases: (interview.acceptanceCases ?? []).map((item) => ({
          id: item.id,
          description: item.description,
          expectedOutcome: item.expectedOutcome,
        })),
      },
    }
    inferredFieldPaths.push('rules', 'schemas', 'verification.acceptanceCases')
  }

  // Preserved implementation specification (§23.1 item 3).
  if (implementationSpec) {
    design = {
      ...design,
      boundary: {
        ...design.boundary,
        runtimeLanguage: implementationSpec.runtimeLanguage,
        deployableId: implementationSpec.deployableId,
        editableSharedPaths: implementationSpec.editablePaths.filter(
          (candidate) => !design.boundary.ownedPaths.includes(candidate),
        ),
      },
      invariants: implementationSpec.invariants,
      verification: {
        ...design.verification,
        examples: implementationSpec.examples,
        edgeCases: implementationSpec.edgeCases,
        acceptanceCases: implementationSpec.acceptanceCases.length
          ? implementationSpec.acceptanceCases
          : design.verification.acceptanceCases,
        configuredCommands: implementationSpec.acceptanceCommands,
      },
      runtime: {
        ...design.runtime,
        configurationRefs: implementationSpec.configurationRefs,
        secretReferenceIds: implementationSpec.secretReferenceIds,
        lifecycleRegistration: implementationSpec.lifecycleRegistration,
      },
    }
    inferredFieldPaths.push(
      'boundary.runtimeLanguage',
      'boundary.deployableId',
      'boundary.editableSharedPaths',
      'invariants',
      'verification.examples',
      'verification.edgeCases',
      'verification.configuredCommands',
      'runtime.configurationRefs',
      'runtime.secretReferenceIds',
      'runtime.lifecycleRegistration',
    )
  }

  // Repository context references, recorded as trace source refs (§23.1 item 3 "repository context").
  if (input.repositoryContextRefs?.length) {
    design = { ...design, trace: { ...design.trace, sourceRefs: input.repositoryContextRefs } }
    inferredFieldPaths.push('trace.sourceRefs')
  }

  // §23.1 item 5: identify missing type-specific fields as needsInput diagnostics.
  const completenessDiagnostics = evaluateTypeSpecificCompleteness(design)
  const missingItems: UnresolvedDesignItem[] = completenessDiagnostics.map((diagnostic) => ({
    id: `migrated.${manifest.moduleId}.${(diagnostic.target ?? diagnostic.code).replace(/[^a-zA-Z0-9._-]+/g, '-')}`,
    description: diagnostic.message,
    materiality: 'material' as const,
  }))

  const sortedInferredFieldPaths = stableSortStrings(Array.from(new Set(inferredFieldPaths)))

  // §23.1 item 7: migrated drafts are drafts; a module with missing required
  // fields is `needsInput`, never `approved`.
  design = {
    ...design,
    status: missingItems.length > 0 ? 'needsInput' : 'draft',
    unresolvedItems: [...design.unresolvedItems, ...missingItems],
    inferredFieldPaths: sortedInferredFieldPaths,
  }
  design = { ...design, contentHash: designContentHash(design) }

  return { design, inferredFieldPaths: sortedInferredFieldPaths, missingItems }
}

/**
 * §23.1: for an existing project: preserve the approved architecture, and
 * create one draft `ModuleDesignSpecification` per allocated module,
 * populated from the manifest, preserved interview, operation contracts,
 * implementation specification, and repository context where available.
 * Never touches legacy records: this function performs no I/O.
 */
export function migrateExistingProject(input: MigrateExistingProjectInput): MigrateExistingProjectResult {
  const moduleDesigns: ModuleDesignSpecification[] = []
  const inferredFieldPathsByModule: Record<string, string[]> = {}
  const needsInputByModule: Record<string, UnresolvedDesignItem[]> = {}

  for (const moduleInput of input.modules) {
    const { design, inferredFieldPaths, missingItems } = migrateOneModule(input.projectId, input.architecture, moduleInput)
    moduleDesigns.push(design)
    inferredFieldPathsByModule[moduleInput.manifest.moduleId] = inferredFieldPaths
    needsInputByModule[moduleInput.manifest.moduleId] = missingItems
  }

  const plan: DesignMigrationPlan = {
    schemaVersion: '1.0',
    projectId: input.projectId,
    preservedArchitecture: {
      id: input.architecture.id,
      revision: input.architecture.revision,
      contentHash: input.architecture.contentHash,
    },
    moduleDesignDraftIds: moduleDesigns.map((design) => design.id),
    inferredFieldPathsByModule,
    needsInputByModule,
    createdAt: input.now,
  }

  return { plan, moduleDesigns }
}

// ---------------------------------------------------------------------------
// §23.3: project feature flag.
// ---------------------------------------------------------------------------

/** The flag starts disabled: enabling the design workflow is an explicit, later action (§23.3). */
export function defaultFeatureFlag(projectId: string, now: string = new Date().toISOString()): DesignFeatureFlag {
  return { projectId, enabled: false, changedAt: now, changedBy: 'system' }
}

export function enableDesignWorkflow(
  flag: DesignFeatureFlag,
  actor: string,
  now: string = new Date().toISOString(),
): DesignFeatureFlag {
  return { ...flag, enabled: true, changedAt: now, changedBy: actor }
}

/**
 * §23.3 "not delete new records when disabled": this only flips the flag
 * record; the caller's `DesignWorkspace` files are never touched by
 * disabling, so re-enabling later finds every prior record intact.
 */
export function disableDesignWorkflow(
  flag: DesignFeatureFlag,
  actor: string,
  now: string = new Date().toISOString(),
): DesignFeatureFlag {
  return { ...flag, enabled: false, changedAt: now, changedBy: actor }
}

/** §23.3 "support project-by-project migration evidence." */
export type DesignMigrationEvidence = {
  projectId: string
  migrationPlanId: string
  moduleCount: number
  needsInputModuleCount: number
  migratedAt: string
}

export function migrationEvidence(projectId: string, plan: DesignMigrationPlan): DesignMigrationEvidence {
  return {
    projectId,
    migrationPlanId: `design-migration-${projectId}-${plan.createdAt}`,
    moduleCount: plan.moduleDesignDraftIds.length,
    needsInputModuleCount: Object.values(plan.needsInputByModule).filter((items) => items.length > 0).length,
    migratedAt: plan.createdAt,
  }
}

/** §23.3 "support export before disable": a JSON-serializable snapshot of every design record. */
export type DesignExportBundle = {
  schemaVersion: '1.0'
  projectId: string
  exportedAt: string
  useCaseAnalysis: { draft?: UseCaseAnalysis; approvedRevisions: UseCaseAnalysis[] }
  application: { draft?: ApplicationSpecification; approvedRevisions: ApplicationSpecification[] }
  architecture: { draft?: ArchitectureSpecification; approvedRevisions: ArchitectureSpecification[] }
  modules: Record<string, { draft?: ModuleDesignSpecification; approvedRevisions: ModuleDesignSpecification[] }>
  baseline: { draft?: DesignBaseline; approvedRevisions: DesignBaseline[] }
  policy?: DesignWorkflowPolicy
  featureFlag?: DesignFeatureFlag
  auditEvents: DesignAuditEvent[]
}

export function exportDesignRecords(
  workspace: DesignWorkspace,
  projectId: string,
  now: string = new Date().toISOString(),
): DesignExportBundle {
  const modules: DesignExportBundle['modules'] = {}
  for (const moduleId of workspace.listModuleIds(projectId)) {
    modules[moduleId] = {
      draft: workspace.getModuleDesignDraft(projectId, moduleId),
      approvedRevisions: workspace.listModuleDesignRevisions(projectId, moduleId),
    }
  }

  return {
    schemaVersion: '1.0',
    projectId,
    exportedAt: now,
    useCaseAnalysis: {
      draft: workspace.getUseCaseAnalysisDraft(projectId),
      approvedRevisions: workspace
        .listApprovedUseCaseAnalysisRevisions(projectId)
        .map((revision) => workspace.getApprovedUseCaseAnalysis(projectId, revision)!),
    },
    application: {
      draft: workspace.getApplicationDraft(projectId),
      approvedRevisions: workspace
        .listApprovedApplicationRevisions(projectId)
        .map((revision) => workspace.getApprovedApplication(projectId, revision)!),
    },
    architecture: {
      draft: workspace.getArchitectureDraft(projectId),
      approvedRevisions: workspace
        .listApprovedArchitectureRevisions(projectId)
        .map((revision) => workspace.getApprovedArchitecture(projectId, revision)!),
    },
    modules,
    baseline: {
      draft: workspace.getDesignBaselineDraft(projectId),
      approvedRevisions: workspace
        .listApprovedDesignBaselineRevisions(projectId)
        .map((revision) => workspace.getApprovedDesignBaseline(projectId, revision)!),
    },
    policy: workspace.getDesignWorkflowPolicy(projectId),
    featureFlag: workspace.getFeatureFlag(projectId),
    auditEvents: workspace.listAuditEvents(projectId),
  }
}

// ---------------------------------------------------------------------------
// §23.2: existing implementation inspection and migration overlay proposal.
// ---------------------------------------------------------------------------

export type LegacyModuleImplementationInput = {
  moduleId: string
  /** Existing owned-path files discovered in the repository (§23.2 "inspect existing owned paths"). */
  ownedFiles: string[]
}

export type MigrateLegacyImplementationEvidenceInput = {
  projectId: string
  modules: LegacyModuleImplementationInput[]
  /** Migrated or otherwise proposed module designs, used to link behavior to acceptance cases. */
  moduleDesigns: ModuleDesignSpecification[]
  now: string
}

export type BehaviorMatch = {
  moduleId: string
  acceptanceCaseId: string
  matchedFiles: string[]
}

export type ImplementationWithoutDesign = {
  moduleId: string
  files: string[]
}

export type ApprovedBehaviorWithoutImplementation = {
  moduleId: string
  acceptanceCaseId: string
}

export type LegacyImplementationEvidenceReport = {
  schemaVersion: '1.0'
  projectId: string
  behaviorMatchedToAcceptance: BehaviorMatch[]
  implementationWithoutApprovedDesign: ImplementationWithoutDesign[]
  approvedBehaviorWithoutImplementation: ApprovedBehaviorWithoutImplementation[]
  /** §23.2 "propose a migration overlay" / "require inspection before apply": reuses the §11.5 ReturnedDelta shape. */
  overlayProposal: ReturnedDelta
  createdAt: string
}

function fileLooksLikeEvidenceFor(file: string, acceptanceCaseId: string): boolean {
  const needle = acceptanceCaseId.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return file.toLowerCase().includes(needle)
}

/**
 * §23.2: inspects existing owned paths: links matching behavior to
 * proposed acceptance cases, identifies implementation with no approved
 * design source and approved behavior with no implementation, and proposes
 * a migration overlay that requires inspection before apply. User-authored
 * code is never rewritten by this function: it only reports and proposes;
 * an apply is a separate, later, explicitly inspected step (§23.2, §11.6).
 */
export function migrateLegacyImplementationEvidence(
  input: MigrateLegacyImplementationEvidenceInput,
): LegacyImplementationEvidenceReport {
  const designsByModuleId = new Map(input.moduleDesigns.map((design) => [design.module.moduleId, design]))

  const behaviorMatchedToAcceptance: BehaviorMatch[] = []
  const implementationWithoutApprovedDesign: ImplementationWithoutDesign[] = []
  const approvedBehaviorWithoutImplementation: ApprovedBehaviorWithoutImplementation[] = []

  for (const module of stableSortByModuleId(input.modules)) {
    const design = designsByModuleId.get(module.moduleId)
    if (!design || (design.status !== 'approved' && design.status !== 'readyForReview')) {
      if (module.ownedFiles.length) {
        implementationWithoutApprovedDesign.push({ moduleId: module.moduleId, files: [...module.ownedFiles].sort() })
      }
      continue
    }
    for (const acceptanceCase of design.verification.acceptanceCases) {
      const matchedFiles = module.ownedFiles.filter((file) => fileLooksLikeEvidenceFor(file, acceptanceCase.id))
      if (matchedFiles.length) {
        behaviorMatchedToAcceptance.push({ moduleId: module.moduleId, acceptanceCaseId: acceptanceCase.id, matchedFiles })
      } else {
        approvedBehaviorWithoutImplementation.push({ moduleId: module.moduleId, acceptanceCaseId: acceptanceCase.id })
      }
    }
  }

  const overlayProposal: ReturnedDelta = {
    schemaVersion: '1.0',
    deltaId: `migration-overlay-${input.projectId}`,
    packetId: `migration-overlay-${input.projectId}`,
    baseRevision: 'legacy',
    baseHash: 'legacy',
    fileChanges: [],
    recordChanges: input.moduleDesigns.map((design) => ({
      recordId: design.id,
      kind: 'ModuleDesignSpecification',
      summary: `Migrated draft for module ${design.module.moduleId} (status: ${design.status}).`,
    })),
    testResults: [],
    assumptions: [
      'Owned-path file names were matched to acceptance case ids by substring heuristic; every match requires manual inspection before apply.',
    ],
    unresolvedIssues: approvedBehaviorWithoutImplementation.map(
      (item) => `No implementation evidence found for ${item.moduleId} acceptance case ${item.acceptanceCaseId}.`,
    ),
    requestedScopeChanges: implementationWithoutApprovedDesign.map(
      (item) => `Module ${item.moduleId} has implementation with no approved design source.`,
    ),
    evidenceFiles: [],
    returnedAt: input.now,
    contentHash: '',
  }
  overlayProposal.contentHash = designContentHash(overlayProposal)

  return {
    schemaVersion: '1.0',
    projectId: input.projectId,
    behaviorMatchedToAcceptance,
    implementationWithoutApprovedDesign,
    approvedBehaviorWithoutImplementation,
    overlayProposal,
    createdAt: input.now,
  }
}

function stableSortByModuleId<T extends { moduleId: string }>(values: readonly T[]): T[] {
  return [...values].sort((a, b) => a.moduleId.localeCompare(b.moduleId))
}
