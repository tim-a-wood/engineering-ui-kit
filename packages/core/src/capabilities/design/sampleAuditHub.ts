/**
 * Default DO-178C Audit Hub sample.
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §22 (all),
 * §16, §9.6, §14. When no project is configured, the product opens this
 * sample (§22.1). The sample is synthetic: every actor, evidence item,
 * finding, and package below is invented for demonstration only.
 *
 * `buildSampleAuditHub()` is a pure, deterministic builder: every timestamp
 * is a fixed literal, every id is derived with `childId`/`stableSlug`
 * (./identity.ts), and nothing here reads the clock or a random source.
 * Calling it twice produces two deep-equal trees.
 *
 * The sample is built through the same core functions the product uses
 * (§22 packet instruction): `createUseCaseDraft`-adjacent gate evaluation
 * and `approveUseCaseAnalysis` (./useCaseAnalysis.ts); `evaluateSystemStructureGate`
 * and `approveSystemStructure` (./systemDesign.ts); `createModuleDesignDraft`,
 * `evaluateModuleDesignChecks`, `applyModuleDesignChecks`, `approveModuleDesign`,
 * `reopenModuleDesign`, `markStale`, and `computeModuleDesignProgress`
 * (./moduleDesign.ts); `registerContract`/`approveContract` (./contractRegistry.ts);
 * `createDesignBaseline`/`approveDesignBaseline`/`changeGateMode`/`evaluateBuildGate`
 * (./designBaseline.ts); the real diagram projectors and `validateUmlProjection`
 * (./diagramSemantics.ts) plus `layoutDiagram` (./diagramLayout.ts);
 * `buildContextManifest`/`buildModuleDesignPacket`/`buildModuleImplementationPacket`
 * (./contextPacket.ts); `inspectDelta` (./deltaInspector.ts); `analyzeDesignChange`
 * (./impactEngine.ts); `buildScenarioTestPlan`/`buildEvidenceExpectationPlan`/
 * `scenarioRunIdentity`/`currentResultState` (./verificationPlanner.ts); and
 * `compileModuleImplementationSpecification` (./moduleDesignCompilers.ts).
 *
 * One documented deviation: `buildSampleAuditHub()` must be a synchronous,
 * pure function (the packet contract), but every `DesignProvider` method
 * (./providers.ts) is `async`. A synchronous caller cannot safely unwrap a
 * `Promise` without a clock or an event-loop tick, so the one `ReturnedDelta`
 * example is authored directly in the same deterministic shape
 * `deterministicTestProvider` would produce, rather than obtained by calling
 * it. Every other required sibling above is called directly.
 */

import type { AcceptanceCase, ApplicationSpecification, ModuleType, NamedText, OperationContract } from '../types.js'
import { canonicalHash, sha256Hex } from '../hash.js'
import { childId, designContentHash, stableSortStrings } from './identity.js'
import {
  isAgentActor,
  type ActivityDefinition,
  type ConnectionModuleDetail,
  type ContextManifest,
  type DesignApproval,
  type DesignAuditEvent,
  type DesignBaseline,
  type DesignDiagnostic,
  type DesignImpactRecord,
  type DesignWorkflowPolicy,
  type DiagramProjection,
  type DiagramProjectionRef,
  type DomainModuleDetail,
  type ExperienceModuleDetail,
  type GateResult,
  type ImplementationWavePlan,
  type InteractionDefinition,
  type ModuleBehaviorSpecification,
  type ModuleDataSpecification,
  type ModuleDesignPacket,
  type ModuleDesignProgress,
  type ModuleDesignSession,
  type ModuleDesignSpecification,
  type ModuleImplementationPacket,
  type ModuleRuntimeSpecification,
  type ModuleSchemaRef,
  type ModuleVerificationSpecification,
  type PlatformModuleDetail,
  type RequiredOperationRef,
  type ReturnedDelta,
  type ScenarioRun,
  type ScenarioStep,
  type ScenarioStepEvidence,
  type StateDefinition,
  type TypeSpecificDetail,
  type UnresolvedDesignItem,
  type UseCaseAnalysis,
  type UseCaseDefinition,
  type UseCaseScenario,
  type WorkflowModuleDetail,
} from './records.js'
import { evaluatePlanGate, approveUseCaseAnalysis } from './useCaseAnalysis.js'
import { approveSystemStructure, evaluateSystemStructureGate, type SystemStructureSpecification } from './systemDesign.js'
import {
  applyModuleDesignChecks,
  approveModuleDesign,
  computeModuleDesignProgress,
  createModuleDesignDraft,
  emptyTypeSpecificDetail,
  evaluateModuleDesignChecks,
  markStale,
  reopenModuleDesign,
  type ModuleDesignCheckContext,
} from './moduleDesign.js'
import {
  approveContract,
  createContractRegistry,
  registerContract,
  type ContractRegistry,
  type RegisteredContract,
} from './contractRegistry.js'
import {
  approveDesignBaseline,
  changeGateMode,
  createDefaultPolicy,
  createDesignBaseline,
  evaluateBuildGate,
  type BuildGateResult,
} from './designBaseline.js'
import {
  projectActivityDiagram,
  projectComponentDiagram,
  projectSequenceDiagram,
  projectStateMachineDiagram,
  projectUseCaseDiagram,
} from './diagramSemantics.js'
import { layoutDiagram } from './diagramLayout.js'
import { buildContextManifest, buildModuleDesignPacket, buildModuleImplementationPacket } from './contextPacket.js'
import { inspectDelta } from './deltaInspector.js'
import { analyzeDesignChange, type ImpactWorld } from './impactEngine.js'
import {
  buildEvidenceExpectationPlan,
  buildScenarioTestPlan,
  currentResultState,
  scenarioRunIdentity,
  type ScenarioTestPlan,
} from './verificationPlanner.js'
import { compileModuleImplementationSpecification, compileOperationContracts } from './moduleDesignCompilers.js'
import type { DiagramLayout } from './records.js'

// ---------------------------------------------------------------------------
// Fixed clock — deterministic timestamps only (no Date.now / Math.random)
// ---------------------------------------------------------------------------

const BASE_EPOCH_MS = Date.parse('2026-07-01T09:00:00.000Z')

/** Deterministic ISO timestamp: `minutes` after the fixed sample epoch. */
function at(minutes: number): string {
  return new Date(BASE_EPOCH_MS + minutes * 60_000).toISOString()
}

export const SAMPLE_PROJECT_ID = 'sample-do178c-audit-hub'

const PROJECT_ID = SAMPLE_PROJECT_ID
const ANALYSIS_ID = `${PROJECT_ID}.use-case-analysis`
const APPLICATION_ID = `${PROJECT_ID}.application`
const ARCHITECTURE_ID = `${PROJECT_ID}.architecture`
const PRODUCT_LEAD = 'dana.reyes'
const ARCHITECT = 'sam.okafor'
const MODULE_OWNER = 'priya.natarajan'
const VERIFICATION_LEAD = 'lucas.moreau'

// ---------------------------------------------------------------------------
// Small local builders
// ---------------------------------------------------------------------------

function nt(id: string, text: string): NamedText {
  return { id, text }
}

function ac(id: string, description: string, expectedOutcome: string, kind: AcceptanceCase['kind'] = 'example'): AcceptanceCase {
  return { id, description, expectedOutcome, kind }
}

function step(useCaseId: string, discriminator: string, action: string, expectedResult: string, visibleResult = true, screenshotNotApplicableReason?: string): ScenarioStep {
  return {
    id: childId(useCaseId, 'step', discriminator),
    action,
    expectedResult,
    visibleResult,
    ...(screenshotNotApplicableReason ? { screenshotNotApplicableReason } : {}),
  }
}

function ioSchemas(moduleId: string): ModuleSchemaRef[] {
  return [
    { schemaId: `${moduleId}.input`, version: '1.0.0', role: 'input', ref: `schemas/${moduleId}/input.schema.json` },
    { schemaId: `${moduleId}.output`, version: '1.0.0', role: 'output', ref: `schemas/${moduleId}/output.schema.json` },
  ]
}

function requiredOp(operationId: string, providerModuleId: string, reason: string): RequiredOperationRef {
  return { operationId, acceptedVersionRange: '^1.0.0', providerModuleId, reason }
}

// ---------------------------------------------------------------------------
// §22.2 — module catalog constants
// ---------------------------------------------------------------------------

const MOD = {
  auditWorkspace: 'mod.audit-workspace',
  lifecycleExplorer: 'mod.lifecycle-explorer',
  importAndPublish: 'mod.import-and-publish',
  findingReview: 'mod.finding-review',
  packageExport: 'mod.package-export',
  evidenceGraph: 'mod.evidence-graph',
  workspaceSnapshots: 'mod.workspace-snapshots',
  filesystemAdapter: 'mod.adapter.filesystem',
  gitAdapter: 'mod.adapter.git',
  matlabAdapter: 'mod.adapter.matlab-simulink',
  spreadsheetAdapter: 'mod.adapter.spreadsheet',
  cHeaderAdapter: 'mod.adapter.c-header',
  coverageAdapter: 'mod.adapter.coverage',
  reviewEvidenceAdapter: 'mod.adapter.review-evidence',
  objectiveProfileAdapter: 'mod.adapter.objective-profile',
  evidenceStore: 'mod.evidence-store',
  jobPackageStore: 'mod.job-package-store',
} as const

const ADAPTER_MODULE_IDS = [
  MOD.filesystemAdapter,
  MOD.gitAdapter,
  MOD.matlabAdapter,
  MOD.spreadsheetAdapter,
  MOD.cHeaderAdapter,
  MOD.coverageAdapter,
  MOD.reviewEvidenceAdapter,
  MOD.objectiveProfileAdapter,
]

/** §22.4 — recommended module-design order (exact). */
const RECOMMENDED_ORDER: string[] = [
  MOD.evidenceStore,
  MOD.jobPackageStore,
  MOD.evidenceGraph,
  MOD.workspaceSnapshots,
  MOD.filesystemAdapter,
  MOD.gitAdapter,
  MOD.matlabAdapter,
  MOD.spreadsheetAdapter,
  MOD.cHeaderAdapter,
  MOD.coverageAdapter,
  MOD.reviewEvidenceAdapter,
  MOD.objectiveProfileAdapter,
  MOD.importAndPublish,
  MOD.findingReview,
  MOD.packageExport,
  MOD.lifecycleExplorer,
  MOD.auditWorkspace,
]

const OWNED_PATH: Record<string, string> = {
  [MOD.auditWorkspace]: 'apps/desktop/src/capabilities/audit-hub/audit-workspace/',
  [MOD.lifecycleExplorer]: 'apps/desktop/src/capabilities/audit-hub/lifecycle-explorer/',
  [MOD.importAndPublish]: 'packages/core/src/capabilities/audit-hub/import-and-publish/',
  [MOD.findingReview]: 'packages/core/src/capabilities/audit-hub/finding-review/',
  [MOD.packageExport]: 'packages/core/src/capabilities/audit-hub/package-export/',
  [MOD.evidenceGraph]: 'packages/core/src/capabilities/audit-hub/evidence-graph/',
  [MOD.workspaceSnapshots]: 'packages/core/src/capabilities/audit-hub/workspace-snapshots/',
  [MOD.filesystemAdapter]: 'packages/core/src/capabilities/audit-hub/adapters/filesystem/',
  [MOD.gitAdapter]: 'packages/core/src/capabilities/audit-hub/adapters/git/',
  [MOD.matlabAdapter]: 'packages/core/src/capabilities/audit-hub/adapters/matlab-simulink/',
  [MOD.spreadsheetAdapter]: 'packages/core/src/capabilities/audit-hub/adapters/spreadsheet/',
  [MOD.cHeaderAdapter]: 'packages/core/src/capabilities/audit-hub/adapters/c-header/',
  [MOD.coverageAdapter]: 'packages/core/src/capabilities/audit-hub/adapters/coverage/',
  [MOD.reviewEvidenceAdapter]: 'packages/core/src/capabilities/audit-hub/adapters/review-evidence/',
  [MOD.objectiveProfileAdapter]: 'packages/core/src/capabilities/audit-hub/adapters/objective-profile/',
  [MOD.evidenceStore]: 'packages/core/src/capabilities/audit-hub/evidence-store/',
  [MOD.jobPackageStore]: 'packages/core/src/capabilities/audit-hub/job-package-store/',
}

// ---------------------------------------------------------------------------
// Sample-specific supporting types (not canonical records; documented as
// such). `verificationResults` needs a `timeout` outcome, which no canonical
// contract carries (§19 "MATLAB and Simulink adapter has one timeout run").
// ---------------------------------------------------------------------------

export type ModuleVerificationResult = {
  moduleId: string
  caseId: string
  outcome: 'passed' | 'failed' | 'timeout' | 'skipped'
  summary: string
  evidenceRefs: string[]
  recordedAt: string
}

export type IncrementalPreview = {
  policy: DesignWorkflowPolicy
  gateForFirstModule: { moduleId: string; result: BuildGateResult }
}

export type SamplePackets = {
  moduleDesignPacket: ModuleDesignPacket
  implementationPacket: ModuleImplementationPacket
}

export type PackageExportOldResult = {
  run: ScenarioRun
  currentState: 'current' | 'old'
}

export type SampleDefects = {
  evidenceGraphBrokenTrace: ModuleVerificationResult
  matlabAdapterTimeout: ModuleVerificationResult
  spreadsheetInvalidMapping: ModuleVerificationResult
  findingReviewRejectedDecision: DesignAuditEvent
  packageExportOldResult: PackageExportOldResult
}

export type SampleAuditHub = {
  projectId: string
  /** §22.1 — the interface must state this is synthetic sample data. */
  syntheticDataStatement: string
  useCaseAnalysis: UseCaseAnalysis
  applicationSpecification: ApplicationSpecification
  architecture: SystemStructureSpecification
  /** Exactly 17 entries — current state, one per §22.2 catalog module. */
  moduleDesigns: ModuleDesignSpecification[]
  /** The frozen, approved r1 revision per module (used to build the baseline). */
  approvedModuleDesigns: Record<string, ModuleDesignSpecification>
  /** §22.3 — a draft later revision for at least three modules (reopened). */
  reopenedModuleDesigns: Record<string, ModuleDesignSpecification>
  operationContracts: ContractRegistry
  sessions: ModuleDesignSession[]
  designBaseline: DesignBaseline
  policy: DesignWorkflowPolicy
  /** §22.1 — saved `incrementalModules` preview; never applied to the baseline. */
  incrementalPreview: IncrementalPreview
  progress: ModuleDesignProgress
  /** §22.4 — exact recommended module-design order. */
  recommendedOrder: string[]
  /** §22.5 — the seven recommended implementation waves. */
  wavePlan: ImplementationWavePlan
  /** §22.5 — the default Copilot action still targets one module per wave. */
  copilotHandoffTargets: { wave: number; moduleId: string }[]
  diagrams: DiagramProjection[]
  diagramLayoutExample: DiagramLayout
  packets: SamplePackets
  moduleImplementationSpecificationExample: ReturnType<typeof compileModuleImplementationSpecification>
  returnedDeltas: ReturnedDelta[]
  inspections: ReturnType<typeof inspectDelta>[]
  impactExamples: DesignImpactRecord[]
  scenarioTestPlan: ScenarioTestPlan
  scenarioRuns: ScenarioRun[]
  verificationResults: Record<string, ModuleVerificationResult[]>
  auditEvents: DesignAuditEvent[]
  defects: SampleDefects
}

// ---------------------------------------------------------------------------
// Application specification (CAP-CONTRACT-001)
// ---------------------------------------------------------------------------

function buildApplicationSpecification(): ApplicationSpecification {
  const externalSystems: NamedText[] = [
    nt('filesystem', 'Project file system'),
    nt('git', 'Local Git repository'),
    nt('matlab-simulink', 'MATLAB and Simulink engineering models'),
    nt('spreadsheet', 'Tabular evidence spreadsheets'),
    nt('c-header', 'C source and header files'),
    nt('coverage', 'Structural coverage tool output'),
    nt('review-evidence', 'Human review records'),
    nt('objective-profile', 'Project DO-178C objective and tailoring configuration'),
  ]

  const useCases: NamedText[] = [
    nt(childId(ANALYSIS_ID, 'use-case', 'refresh-evidence'), 'Refresh evidence'),
    nt(childId(ANALYSIS_ID, 'use-case', 'review-finding'), 'Review finding'),
    nt(childId(ANALYSIS_ID, 'use-case', 'export-package'), 'Export package'),
    nt(childId(ANALYSIS_ID, 'use-case', 'browse-lifecycle'), 'Browse lifecycle'),
  ]

  const draft: ApplicationSpecification = {
    schemaVersion: '1.0',
    projectId: PROJECT_ID,
    id: APPLICATION_ID,
    revision: 'r1',
    status: 'approved',
    purpose:
      'Give a DO-178C audit lead one place to refresh evidence, review findings independently, and export a deterministic audit package.',
    outcomes: [
      'An audit lead can see readiness for the current baseline at a glance.',
      'A finding decision is always made by a reviewer independent of the finding author.',
      'An exported audit package is deterministic and traceable to the baseline that produced it.',
    ],
    actors: [nt('actor.audit-lead', 'Audit lead'), nt('actor.independent-reviewer', 'Independent reviewer'), nt('actor.auditor', 'Auditor')],
    goals: [
      nt('goal.readiness', 'Show DO-178C objective readiness without manual spreadsheet reconciliation.'),
      nt('goal.independence', 'Enforce independent review before a finding closes.'),
      nt('goal.package', 'Produce a deterministic, hash-verifiable audit package.'),
    ],
    useCases,
    scenarios: [],
    information: [
      nt('info.evidence', 'Normalized evidence: requirements, models, source, tests, coverage, and reviews.'),
      nt('info.trace', 'Trace links between low-level requirements, models, source, and tests.'),
      nt('info.finding', 'Findings and their independent-review decisions.'),
      nt('info.package', 'Audit packages and their manifests.'),
    ],
    rules: [
      nt('rule.independence', 'A finding decision is rejected when the reviewer is the same person as the finding author.'),
      nt('rule.last-valid', 'A failed refresh preserves the last valid published snapshot for every source.'),
      nt('rule.deterministic-package', 'The same baseline always produces a byte-identical audit package.'),
    ],
    externalSystems,
    constraints: [
      nt('constraint.matlab-process', 'The MATLAB and Simulink adapter must run in a separate, app-owned MATLAB process.'),
      nt('constraint.offline', 'The desktop application must work with no network access once sources are configured locally.'),
    ],
    scope: {
      inScope: [
        'Refreshing evidence from eight source adapters',
        'Independent finding review',
        'Deterministic audit package export',
        'Browsing evidence by DO-178C lifecycle phase',
      ],
      outOfScope: ['Editing source engineering artifacts', 'Authoring new DO-178C objectives'],
    },
    acceptanceCases: [
      ac('app.ac.readiness', 'The audit lead opens the workspace after a refresh.', 'Readiness reflects the newest published snapshot.'),
      ac(
        'app.ac.independence',
        'A reviewer who authored a finding submits its decision.',
        'The product rejects the decision because the reviewer is not independent of the author.',
        'failure',
      ),
    ],
    sources: [nt('source.do178c-spec', 'DO-178C Table A-1..A-10 objective reference')],
    unresolvedQuestions: [],
    approvedAt: at(1),
    approvedBy: PRODUCT_LEAD,
    contentHash: '',
  }
  return { ...draft, contentHash: canonicalHash({ ...draft, contentHash: undefined }) }
}

// ---------------------------------------------------------------------------
// Use-case analysis (EUC-01) — refresh evidence, review finding, export
// package, browse lifecycle, each with main/alternate/failure/recovery.
// ---------------------------------------------------------------------------

function refreshEvidenceUseCase(): UseCaseDefinition {
  const ucId = childId(ANALYSIS_ID, 'use-case', 'refresh-evidence')
  const mainFlow: ScenarioStep[] = [
    step(ucId, 'select', 'The audit lead selects Refresh evidence.', 'The system stages every configured source as a candidate.'),
    step(ucId, 'validate', 'The system validates each candidate against its canonical schema.', 'Every valid candidate is published as a new snapshot.'),
    step(ucId, 'report', 'The system reports refresh status and any defects found.', 'The audit lead sees the updated readiness view.'),
  ]
  const alternate: UseCaseScenario = {
    id: childId(ucId, 'scenario', 'cancel-refresh'),
    name: 'Cancel refresh',
    kind: 'alternate',
    steps: [step(ucId, 'cancel', 'The audit lead cancels an in-progress refresh.', 'The system stops staging new candidates and keeps every already-published snapshot unchanged.')],
  }
  const failure: UseCaseScenario = {
    id: childId(ucId, 'scenario', 'source-unreachable'),
    name: 'Refresh fails when a required source is unreachable',
    kind: 'failure',
    steps: [
      step(
        ucId,
        'unreachable',
        'A configured source is unreachable during refresh.',
        'The system preserves the last valid published snapshot for that source and reports the failure.',
      ),
    ],
  }
  const recovery: UseCaseScenario = {
    id: childId(ucId, 'scenario', 'retry-after-fix'),
    name: 'Refresh recovers after the source is reachable again',
    kind: 'recovery',
    steps: [
      step(
        ucId,
        'retry',
        'The audit lead retries the refresh after restoring source connectivity.',
        'The system publishes a fresh snapshot for the recovered source and clears the failure state.',
      ),
    ],
  }
  return {
    id: ucId,
    name: 'Refresh evidence',
    actors: [childId(ANALYSIS_ID, 'actor', 'audit-lead')],
    trigger: 'The audit lead requests a refresh of evidence from configured sources.',
    preconditions: ['At least one source adapter is configured.'],
    mainFlow,
    alternatePaths: [alternate],
    failurePaths: [failure],
    recoveryBehavior: 'On failure, the last valid snapshot for each source is preserved and the audit lead can retry the refresh.',
    rules: [nt('rule.last-valid', 'A failed refresh preserves the last valid published snapshot for every source.')],
    inputs: ['Source configuration', 'Existing published snapshot'],
    outputs: ['Updated evidence snapshot', 'Refresh status report'],
    acceptanceChecks: [
      {
        id: childId(ucId, 'acceptance', 'publish-or-preserve'),
        text: 'A successful refresh publishes a new snapshot for every valid candidate and preserves the last valid snapshot for every invalid or unreachable candidate.',
        status: 'confirmed',
      },
    ],
    sourceLinks: [],
    scenarios: [{ id: childId(ucId, 'scenario', 'main'), name: 'Main scenario', kind: 'main', steps: mainFlow }, alternate, failure, recovery],
  }
}

function reviewFindingUseCase(): UseCaseDefinition {
  const ucId = childId(ANALYSIS_ID, 'use-case', 'review-finding')
  const mainFlow: ScenarioStep[] = [
    step(ucId, 'open', 'An independent reviewer opens a finding.', 'The system shows the finding, its evidence, and the identity of the finding author.'),
    step(ucId, 'decide', 'The reviewer submits a decision.', 'The system records the decision because the reviewer is independent of the author.'),
    step(ucId, 'close', 'The reviewer closes the finding.', 'The finding state changes to closed.'),
  ]
  const alternate: UseCaseScenario = {
    id: childId(ucId, 'scenario', 'reopen-finding'),
    name: 'Reopen a closed finding',
    kind: 'alternate',
    steps: [step(ucId, 'reopen', 'A reviewer reopens a closed finding with new evidence.', 'The finding state changes back to open for a new decision.')],
  }
  const failure: UseCaseScenario = {
    id: childId(ucId, 'scenario', 'not-independent'),
    name: 'Reviewer is not independent of the finding author',
    kind: 'failure',
    steps: [
      step(
        ucId,
        'reject',
        'A reviewer submits a decision on a finding they authored.',
        'The system rejects the decision because the reviewer is the same person as the author.',
      ),
    ],
  }
  const recovery: UseCaseScenario = {
    id: childId(ucId, 'scenario', 'independent-reviewer-decides'),
    name: 'An independent reviewer submits the decision',
    kind: 'recovery',
    steps: [
      step(
        ucId,
        'independent-decide',
        'A different, independent reviewer submits the decision for the same finding.',
        'The system records the decision.',
      ),
    ],
  }
  return {
    id: ucId,
    name: 'Review finding',
    actors: [childId(ANALYSIS_ID, 'actor', 'independent-reviewer')],
    trigger: 'A reviewer opens a finding to record a decision.',
    preconditions: ['The finding is open.'],
    mainFlow,
    alternatePaths: [alternate],
    failurePaths: [failure],
    recoveryBehavior: 'The finding remains open; a different, independent reviewer can submit a decision.',
    rules: [nt('rule.independence', 'A finding decision is rejected when the reviewer is the same person as the finding author.')],
    inputs: ['Finding record', 'Reviewer identity'],
    outputs: ['Recorded finding decision'],
    acceptanceChecks: [
      {
        id: childId(ucId, 'acceptance', 'independence-enforced'),
        text: 'The system never records a finding decision when the reviewer is the same person as the finding author.',
        status: 'confirmed',
      },
    ],
    sourceLinks: [],
    scenarios: [{ id: childId(ucId, 'scenario', 'main'), name: 'Main scenario', kind: 'main', steps: mainFlow }, alternate, failure, recovery],
  }
}

function exportPackageUseCase(): UseCaseDefinition {
  const ucId = childId(ANALYSIS_ID, 'use-case', 'export-package')
  const mainFlow: ScenarioStep[] = [
    step(ucId, 'select', 'The audit lead selects the approved baseline to export.', 'The system confirms the baseline is approved and current.'),
    step(ucId, 'create', 'The audit lead creates the audit package.', 'The system builds a deterministic package and manifest.'),
    step(ucId, 'status', 'The audit lead checks package status.', 'The system shows the completed package with its hash.'),
  ]
  const alternate: UseCaseScenario = {
    id: childId(ucId, 'scenario', 'cancel-package'),
    name: 'Cancel package export',
    kind: 'alternate',
    steps: [step(ucId, 'cancel-package', 'The audit lead cancels an in-progress package export.', 'The system stops and discards the partial package.')],
  }
  const failure: UseCaseScenario = {
    id: childId(ucId, 'scenario', 'missing-evidence'),
    name: 'Package build fails because required evidence is missing',
    kind: 'failure',
    steps: [
      step(ucId, 'missing', 'The audit lead exports a package while required evidence is missing.', 'The system fails the export and reports which evidence is missing.'),
    ],
  }
  const recovery: UseCaseScenario = {
    id: childId(ucId, 'scenario', 'retry-after-evidence-added'),
    name: 'Export recovers after the missing evidence is added',
    kind: 'recovery',
    steps: [
      step(ucId, 'retry-package', 'The audit lead retries the export after the missing evidence is refreshed.', 'The system builds the package successfully.'),
    ],
  }
  return {
    id: ucId,
    name: 'Export package',
    actors: [childId(ANALYSIS_ID, 'actor', 'audit-lead')],
    trigger: 'The audit lead requests a deterministic audit package for the current baseline.',
    preconditions: ['A baseline is approved.'],
    mainFlow,
    alternatePaths: [alternate],
    failurePaths: [failure],
    recoveryBehavior: 'On failure, the last successful package remains available; the audit lead can retry after adding the missing evidence.',
    rules: [nt('rule.deterministic-package', 'The same baseline always produces a byte-identical audit package.')],
    inputs: ['Approved baseline', 'Published snapshots'],
    outputs: ['Audit package', 'Package manifest'],
    acceptanceChecks: [
      {
        id: childId(ucId, 'acceptance', 'deterministic'),
        text: 'Exporting the same approved baseline twice produces byte-identical package hashes.',
        status: 'confirmed',
      },
    ],
    sourceLinks: [],
    scenarios: [{ id: childId(ucId, 'scenario', 'main'), name: 'Main scenario', kind: 'main', steps: mainFlow }, alternate, failure, recovery],
  }
}

function browseLifecycleUseCase(): UseCaseDefinition {
  const ucId = childId(ANALYSIS_ID, 'use-case', 'browse-lifecycle')
  const mainFlow: ScenarioStep[] = [
    step(ucId, 'phase', 'The auditor opens a DO-178C lifecycle phase.', 'The system shows evidence for that phase.'),
    step(ucId, 'view', 'The auditor views one evidence item.', 'The system shows the item and its known trace links.'),
    step(ucId, 'trace', 'The auditor follows a trace from a low-level requirement to its model element.', 'The system navigates to the linked model element.'),
  ]
  const alternate: UseCaseScenario = {
    id: childId(ucId, 'scenario', 'compare-revisions'),
    name: 'Compare two revisions of the same evidence item',
    kind: 'alternate',
    steps: [step(ucId, 'compare', 'The auditor compares the current and a prior revision of one evidence item.', 'The system shows the differences between the two revisions.')],
  }
  const failure: UseCaseScenario = {
    id: childId(ucId, 'scenario', 'broken-trace'),
    name: 'A low-level-requirement-to-model trace is broken',
    kind: 'failure',
    steps: [
      step(
        ucId,
        'broken',
        'The auditor follows a trace from a low-level requirement to its model element.',
        'The system finds the linked model element.',
        true,
      ),
    ],
  }
  const recovery: UseCaseScenario = {
    id: childId(ucId, 'scenario', 'continue-after-broken-trace'),
    name: 'The auditor continues browsing after a broken trace is reported',
    kind: 'recovery',
    steps: [
      step(
        ucId,
        'continue',
        'The auditor opens a different trace after a broken trace was reported as a defect.',
        'The system navigates to the linked element for the working trace.',
      ),
    ],
  }
  return {
    id: ucId,
    name: 'Browse lifecycle',
    actors: [childId(ANALYSIS_ID, 'actor', 'auditor')],
    trigger: 'The auditor wants to browse evidence by DO-178C lifecycle phase.',
    preconditions: ['At least one snapshot has been published.'],
    mainFlow,
    alternatePaths: [alternate],
    failurePaths: [failure],
    recoveryBehavior: 'A broken trace is reported as a defect for the Evidence Graph owner to resolve; the auditor can continue browsing other traces.',
    rules: [],
    inputs: ['Published snapshot', 'Trace graph'],
    outputs: ['Lifecycle-phase evidence view', 'Trace navigation result'],
    acceptanceChecks: [
      {
        id: childId(ucId, 'acceptance', 'phase-navigation'),
        text: 'Every published lifecycle phase with evidence is reachable from the phase list.',
        status: 'confirmed',
      },
    ],
    sourceLinks: [],
    scenarios: [{ id: childId(ucId, 'scenario', 'main'), name: 'Main scenario', kind: 'main', steps: mainFlow }, alternate, failure, recovery],
  }
}

/** Mirrors the private `finalizeAnalysis` step in useCaseAnalysis.ts (gate + status + hash), reusing the real gate evaluator. */
function finalizeUseCaseAnalysis(base: UseCaseAnalysis): UseCaseAnalysis {
  const gate: GateResult = evaluatePlanGate(base)
  const hasOpenMaterialQuestion = base.questions.some((q) => q.material && !q.answer)
  const status: UseCaseAnalysis['status'] = hasOpenMaterialQuestion ? 'needsInput' : gate.passed ? 'readyForReview' : 'draft'
  const withStatus: UseCaseAnalysis = { ...base, status, gates: [gate] }
  return { ...withStatus, contentHash: designContentHash(withStatus) }
}

function buildUseCaseAnalysis(): UseCaseAnalysis {
  const base: UseCaseAnalysis = {
    schemaVersion: '1.0',
    projectId: PROJECT_ID,
    id: ANALYSIS_ID,
    revision: 'r1',
    status: 'draft',
    workDescription:
      'A DO-178C audit lead needs to refresh evidence from every configured source, review findings independently, export a deterministic audit package, and browse evidence by lifecycle phase.',
    examples: [
      'Refresh evidence overnight and see readiness change in the morning.',
      'Reject a finding decision when the reviewer wrote the finding.',
      'Export the same baseline twice and get the same package hash.',
    ],
    prohibitedResults: ['A finding decision recorded by its own author.', 'A published snapshot from an unvalidated candidate.'],
    actors: [
      { id: childId(ANALYSIS_ID, 'actor', 'audit-lead'), text: 'Audit lead', status: 'confirmed' },
      { id: childId(ANALYSIS_ID, 'actor', 'independent-reviewer'), text: 'Independent reviewer', status: 'confirmed' },
      { id: childId(ANALYSIS_ID, 'actor', 'auditor'), text: 'Auditor', status: 'confirmed' },
    ],
    useCases: [refreshEvidenceUseCase(), reviewFindingUseCase(), exportPackageUseCase(), browseLifecycleUseCase()],
    rules: [
      { id: 'rule.independence', text: 'A finding decision is rejected when the reviewer is the same person as the finding author.', status: 'confirmed' },
      { id: 'rule.last-valid', text: 'A failed refresh preserves the last valid published snapshot for every source.', status: 'confirmed' },
    ],
    qualityNeeds: [{ id: 'quality.refresh-time', text: 'A refresh of a typical project completes within the configured session timeout.', status: 'confirmed' }],
    sources: [
      { id: 'source.do178c-spec', name: 'DO-178C objective reference', ref: 'do178c/table-a1-a10.pdf', required: true, readOnly: true, status: 'ok' },
    ],
    questions: [],
    gates: [],
    contentHash: '',
  }
  const finalized = finalizeUseCaseAnalysis(base)
  const approved = approveUseCaseAnalysis(finalized, { approvedBy: PRODUCT_LEAD, authority: 'product-lead', at: at(2) })
  if (!approved.diagnostics.length && approved.analysis.status === 'approved') return approved.analysis
  // Never silently accept an unapproved sample analysis — a build-time signal beats a subtly wrong sample.
  throw new Error(`sample use-case analysis failed to approve: ${JSON.stringify(approved.diagnostics)}`)
}

function ownedPathOf(moduleId: string): string {
  const path = OWNED_PATH[moduleId]
  if (!path) throw new Error(`no owned path configured for ${moduleId}`)
  return path
}

// ---------------------------------------------------------------------------
// System structure / architecture (EUC-03) — §22.2 catalog wiring
// ---------------------------------------------------------------------------

type ModuleDefEntry = { moduleId: string; name: string; moduleType: ModuleType; responsibility: string }

const MODULE_DEFS: ModuleDefEntry[] = [
  { moduleId: MOD.auditWorkspace, name: 'Audit Workspace', moduleType: 'experience', responsibility: 'Show readiness, findings, review actions, and package status.' },
  { moduleId: MOD.lifecycleExplorer, name: 'Lifecycle Explorer', moduleType: 'experience', responsibility: 'Browse evidence by lifecycle phase and follow traces.' },
  { moduleId: MOD.importAndPublish, name: 'Import and Publish', moduleType: 'workflow', responsibility: 'Read source candidates, validate them, publish valid snapshots, preserve last valid data.' },
  { moduleId: MOD.findingReview, name: 'Finding Review', moduleType: 'workflow', responsibility: 'Enforce independent review and finding transitions.' },
  { moduleId: MOD.packageExport, name: 'Package Export', moduleType: 'workflow', responsibility: 'Create a deterministic audit package and manifest.' },
  { moduleId: MOD.evidenceGraph, name: 'Evidence Graph', moduleType: 'domain', responsibility: 'Own evidence identity, trace links, coverage, first-gap navigation, and revision comparison.' },
  { moduleId: MOD.workspaceSnapshots, name: 'Workspace Snapshots', moduleType: 'domain', responsibility: 'Own candidate, validating, published, failed, and baselined snapshot state.' },
  { moduleId: MOD.filesystemAdapter, name: 'File-system adapter', moduleType: 'connection', responsibility: 'Implement ProjectFileSourcePort for project files and folders.' },
  { moduleId: MOD.gitAdapter, name: 'Git adapter', moduleType: 'connection', responsibility: 'Implement RevisionSourcePort for commit, tag, branch, and status.' },
  { moduleId: MOD.matlabAdapter, name: 'MATLAB and Simulink adapter', moduleType: 'connection', responsibility: 'Implement EngineeringModelSourcePort for .slx/.sldd/.slreqx/.slmx/.sldatx models.' },
  { moduleId: MOD.spreadsheetAdapter, name: 'Spreadsheet adapter', moduleType: 'connection', responsibility: 'Implement TabularEvidenceSourcePort for .xlsx/.csv workbooks.' },
  { moduleId: MOD.cHeaderAdapter, name: 'C and header source adapter', moduleType: 'connection', responsibility: 'Implement SourceCodeEvidencePort for .c/.h files.' },
  { moduleId: MOD.coverageAdapter, name: 'Coverage adapter', moduleType: 'connection', responsibility: 'Implement CoverageEvidenceSourcePort for LCOV, XML, and JSON coverage reports.' },
  { moduleId: MOD.reviewEvidenceAdapter, name: 'Review-evidence adapter', moduleType: 'connection', responsibility: 'Implement ReviewEvidenceSourcePort for checklists, comments, approvals, and findings.' },
  { moduleId: MOD.objectiveProfileAdapter, name: 'Objective-profile adapter', moduleType: 'connection', responsibility: 'Implement ObjectiveProfileSourcePort for project DO-178C objectives and tailoring.' },
  { moduleId: MOD.evidenceStore, name: 'Evidence Store', moduleType: 'platform', responsibility: 'Store immutable source snapshots, normalized evidence, trace records, reviews, and findings.' },
  { moduleId: MOD.jobPackageStore, name: 'Job and Package Store', moduleType: 'platform', responsibility: 'Store job state, progress, package files, hashes, and manifests.' },
]

type DepEdge = { fromModuleId: string; toModuleId: string; reason: string }

function buildDependencyEdges(): DepEdge[] {
  const edges: DepEdge[] = [
    { fromModuleId: MOD.auditWorkspace, toModuleId: MOD.evidenceGraph, reason: 'Reads readiness and coverage from the Evidence Graph.' },
    { fromModuleId: MOD.auditWorkspace, toModuleId: MOD.findingReview, reason: 'Delegates review decisions to Finding Review.' },
    { fromModuleId: MOD.auditWorkspace, toModuleId: MOD.packageExport, reason: 'Shows package status from Package Export.' },
    { fromModuleId: MOD.auditWorkspace, toModuleId: MOD.workspaceSnapshots, reason: 'Reads baseline state from Workspace Snapshots.' },
    { fromModuleId: MOD.lifecycleExplorer, toModuleId: MOD.evidenceGraph, reason: 'Follows traces owned by the Evidence Graph.' },
    { fromModuleId: MOD.lifecycleExplorer, toModuleId: MOD.workspaceSnapshots, reason: 'Browses evidence over published snapshots.' },
    { fromModuleId: MOD.findingReview, toModuleId: MOD.evidenceGraph, reason: 'Resolves evidence identity for the finding.' },
    { fromModuleId: MOD.findingReview, toModuleId: MOD.evidenceStore, reason: 'Persists reviews and findings.' },
    { fromModuleId: MOD.packageExport, toModuleId: MOD.evidenceGraph, reason: 'Reads coverage and revision comparison for the package.' },
    { fromModuleId: MOD.packageExport, toModuleId: MOD.workspaceSnapshots, reason: 'Exports the baselined snapshot set.' },
    { fromModuleId: MOD.packageExport, toModuleId: MOD.evidenceStore, reason: 'Reads normalized evidence for the manifest.' },
    { fromModuleId: MOD.packageExport, toModuleId: MOD.jobPackageStore, reason: 'Stores the package job and its files.' },
    { fromModuleId: MOD.evidenceGraph, toModuleId: MOD.evidenceStore, reason: 'Reads and writes normalized evidence and trace records.' },
    { fromModuleId: MOD.workspaceSnapshots, toModuleId: MOD.evidenceStore, reason: 'Persists snapshot state.' },
    { fromModuleId: MOD.importAndPublish, toModuleId: MOD.evidenceGraph, reason: 'Adds relationships discovered while publishing.' },
    { fromModuleId: MOD.importAndPublish, toModuleId: MOD.workspaceSnapshots, reason: 'Stages, validates, and publishes candidate snapshots.' },
    { fromModuleId: MOD.importAndPublish, toModuleId: MOD.evidenceStore, reason: 'Writes normalized evidence.' },
    { fromModuleId: MOD.importAndPublish, toModuleId: MOD.jobPackageStore, reason: 'Tracks refresh job progress.' },
  ]
  for (const adapterModuleId of ADAPTER_MODULE_IDS) {
    edges.push({ fromModuleId: MOD.importAndPublish, toModuleId: adapterModuleId, reason: 'Reads source candidates through this adapter port.' })
  }
  return edges
}

const OPERATION_ALLOCATIONS: { operationId: string; moduleId: string }[] = [
  { operationId: 'OpenReadiness', moduleId: MOD.auditWorkspace },
  { operationId: 'OpenFinding', moduleId: MOD.auditWorkspace },
  { operationId: 'RecordReviewDecision', moduleId: MOD.auditWorkspace },
  { operationId: 'OpenLifecyclePhase', moduleId: MOD.lifecycleExplorer },
  { operationId: 'CompareEvidence', moduleId: MOD.lifecycleExplorer },
  { operationId: 'RefreshEvidence', moduleId: MOD.importAndPublish },
  { operationId: 'GetRefreshStatus', moduleId: MOD.importAndPublish },
  { operationId: 'CancelRefresh', moduleId: MOD.importAndPublish },
  { operationId: 'SubmitFindingDecision', moduleId: MOD.findingReview },
  { operationId: 'CloseFinding', moduleId: MOD.findingReview },
  { operationId: 'ReopenFinding', moduleId: MOD.findingReview },
  { operationId: 'CreateAuditPackage', moduleId: MOD.packageExport },
  { operationId: 'GetPackageStatus', moduleId: MOD.packageExport },
  { operationId: 'CancelPackage', moduleId: MOD.packageExport },
  { operationId: 'ResolveEvidenceIdentity', moduleId: MOD.evidenceGraph },
  { operationId: 'AddRelationship', moduleId: MOD.evidenceGraph },
  { operationId: 'FollowTrace', moduleId: MOD.evidenceGraph },
  { operationId: 'FindFirstGap', moduleId: MOD.evidenceGraph },
  { operationId: 'ReportCoverage', moduleId: MOD.evidenceGraph },
  { operationId: 'CompareRevisions', moduleId: MOD.evidenceGraph },
  { operationId: 'StageCandidate', moduleId: MOD.workspaceSnapshots },
  { operationId: 'StartValidation', moduleId: MOD.workspaceSnapshots },
  { operationId: 'PublishSnapshot', moduleId: MOD.workspaceSnapshots },
  { operationId: 'PreserveLastValid', moduleId: MOD.workspaceSnapshots },
  { operationId: 'CreateBaseline', moduleId: MOD.workspaceSnapshots },
  { operationId: 'ProjectFileSourcePort', moduleId: MOD.filesystemAdapter },
  { operationId: 'RevisionSourcePort', moduleId: MOD.gitAdapter },
  { operationId: 'EngineeringModelSourcePort', moduleId: MOD.matlabAdapter },
  { operationId: 'TabularEvidenceSourcePort', moduleId: MOD.spreadsheetAdapter },
  { operationId: 'SourceCodeEvidencePort', moduleId: MOD.cHeaderAdapter },
  { operationId: 'CoverageEvidenceSourcePort', moduleId: MOD.coverageAdapter },
  { operationId: 'ReviewEvidenceSourcePort', moduleId: MOD.reviewEvidenceAdapter },
  { operationId: 'ObjectiveProfileSourcePort', moduleId: MOD.objectiveProfileAdapter },
  { operationId: 'EvidenceStorePort', moduleId: MOD.evidenceStore },
  { operationId: 'JobStorePort', moduleId: MOD.jobPackageStore },
  { operationId: 'PackageStorePort', moduleId: MOD.jobPackageStore },
]

/**
 * Note on the §22.2 catalog: Lifecycle Explorer's table row lists `FollowTrace`
 * among its provided operations, but the Evidence Graph row also owns
 * `FollowTrace`. The real `registerContract` (./contractRegistry.ts) enforces
 * "one operation version has exactly one provider module" (§9.7) — a genuine
 * product rule, not a sample limitation. This sample therefore models
 * Lifecycle Explorer's `FollowTrace` as a *required* (consumed) operation on
 * the Evidence Graph's contract, not a second provided contract. See the
 * final report for this documented deviation.
 */
const ADAPTER_SLUGS: Record<string, string> = {
  [MOD.filesystemAdapter]: 'filesystem',
  [MOD.gitAdapter]: 'git',
  [MOD.matlabAdapter]: 'matlab-simulink',
  [MOD.spreadsheetAdapter]: 'spreadsheet',
  [MOD.cHeaderAdapter]: 'c-header',
  [MOD.coverageAdapter]: 'coverage',
  [MOD.reviewEvidenceAdapter]: 'review-evidence',
  [MOD.objectiveProfileAdapter]: 'objective-profile',
}

function buildArchitecture(application: ApplicationSpecification): SystemStructureSpecification {
  const dependencyEdges = buildDependencyEdges()
  const workflowTraces = [
    {
      useCaseId: childId(ANALYSIS_ID, 'use-case', 'refresh-evidence'),
      moduleIds: stableSortStrings([MOD.importAndPublish, MOD.evidenceGraph, MOD.workspaceSnapshots, MOD.evidenceStore, MOD.jobPackageStore, ...ADAPTER_MODULE_IDS]),
    },
    {
      useCaseId: childId(ANALYSIS_ID, 'use-case', 'review-finding'),
      moduleIds: stableSortStrings([MOD.findingReview, MOD.evidenceGraph, MOD.evidenceStore, MOD.auditWorkspace]),
    },
    {
      useCaseId: childId(ANALYSIS_ID, 'use-case', 'export-package'),
      moduleIds: stableSortStrings([MOD.packageExport, MOD.workspaceSnapshots, MOD.evidenceStore, MOD.jobPackageStore, MOD.auditWorkspace]),
    },
    {
      useCaseId: childId(ANALYSIS_ID, 'use-case', 'browse-lifecycle'),
      moduleIds: stableSortStrings([MOD.lifecycleExplorer, MOD.evidenceGraph, MOD.workspaceSnapshots]),
    },
  ]

  const nonMatlabModuleIds = MODULE_DEFS.map((d) => d.moduleId).filter((id) => id !== MOD.matlabAdapter)

  const draft: SystemStructureSpecification = {
    schemaVersion: '1.0',
    projectId: PROJECT_ID,
    id: ARCHITECTURE_ID,
    revision: 'r1',
    status: 'draft',
    applicationSpecId: application.id,
    applicationSpecRevision: application.revision,
    applicationSpecHash: application.contentHash,
    capabilityProjections: [{ id: 'capability.audit-hub', name: 'DO-178C Audit Hub', moduleIds: MODULE_DEFS.map((d) => d.moduleId) }],
    moduleIds: MODULE_DEFS.map((d) => d.moduleId),
    moduleDefinitions: MODULE_DEFS,
    dependencyEdges,
    operationAllocations: OPERATION_ALLOCATIONS,
    adapterAllocations: ADAPTER_MODULE_IDS.map((moduleId) => {
      const key = ADAPTER_SLUGS[moduleId]!
      return { adapterId: `adapter.${key}`, moduleId, portId: `port.${key}` }
    }),
    workflowTraces,
    proposals: MODULE_DEFS.map((d) => nt(d.moduleId, `Recorded reason: ${d.responsibility}`)),
    unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-DES-SYS', passed: false, diagnostics: [] },
    deployables: [
      { deployableId: 'deployable.desktop', name: 'Desktop application process', moduleIds: stableSortStrings(nonMatlabModuleIds) },
      {
        deployableId: 'deployable.matlab-process',
        name: 'MATLAB/Simulink adapter process',
        moduleIds: [MOD.matlabAdapter],
        splitReason: 'runtime',
        splitJustification:
          'The MATLAB and Simulink adapter must run in a separate, app-owned MATLAB process for process isolation and license/session management (§9.6 adapter process isolation).',
      },
    ],
    modulePaths: MODULE_DEFS.map((d) => ({ moduleId: d.moduleId, ownedPaths: [ownedPathOf(d.moduleId)] })),
    contentHash: '',
  }
  const withHash: SystemStructureSpecification = { ...draft, contentHash: canonicalHash({ ...draft, contentHash: undefined, approval: undefined }) }

  const gate = evaluateSystemStructureGate(withHash, application, OPERATION_ALLOCATIONS.map((o) => o.operationId))
  if (!gate.passed) {
    throw new Error(`sample architecture gate failed: ${JSON.stringify(gate.diagnostics)}`)
  }
  const readyForApproval: SystemStructureSpecification = { ...withHash, status: 'draft' }
  const approval = approveSystemStructure(readyForApproval, application, { approvedBy: ARCHITECT, authority: 'software-architect', approvedAt: at(3) }, OPERATION_ALLOCATIONS.map((o) => o.operationId))
  if (!approval.ok || !approval.architecture) {
    throw new Error(`sample architecture failed to approve: ${JSON.stringify(approval.diagnostics)}`)
  }
  return approval.architecture
}

// ---------------------------------------------------------------------------
// Module-design content (§9.5, §9.6) — per-module fill for the draft that
// `createModuleDesignDraft` produces from the approved architecture.
// ---------------------------------------------------------------------------

type ModuleContent = {
  nonResponsibilities: string[]
  ownedConcerns: string[]
  excludedConcerns: string[]
  requiredOperations: RequiredOperationRef[]
  schemas: ModuleSchemaRef[]
  rules: NamedText[]
  invariants: string[]
  behavior: ModuleBehaviorSpecification
  data: ModuleDataSpecification
  runtime: ModuleRuntimeSpecification
  verification: ModuleVerificationSpecification
  typeSpecific: TypeSpecificDetail
  unresolvedItems: UnresolvedDesignItem[]
}

function baseData(moduleId: string, ownership: string, confidentiality = 'internal'): ModuleDataSpecification {
  return {
    inputSchemas: ioSchemas(moduleId).filter((s) => s.role === 'input'),
    outputSchemas: ioSchemas(moduleId).filter((s) => s.role === 'output'),
    persistentRecords: [],
    dataOwnership: ownership,
    retention: 'Retained for the life of the project unless the project is archived.',
    migrationNeeds: 'None for the first sample release.',
    confidentiality,
    provenanceFields: ['source', 'recordedAt', 'contentHash'],
    canonicalUnits: [],
    canonicalEnumerations: [],
  }
}

function baseRuntime(moduleId: string): ModuleRuntimeSpecification {
  return {
    configurationRefs: [`config.${moduleId}`],
    secretReferenceIds: [],
    lifecycleRegistration: 'singleton',
    healthBehavior: `Reports healthy when ${moduleId} can reach every required dependency.`,
    telemetry: `Emits duration and outcome counters per operation for ${moduleId}.`,
    resourceOwnership: `Owns its records under ${ownedPathOf(moduleId)}.`,
    startupBehavior: 'Registers with the module registry on application start.',
    shutdownBehavior: 'Completes in-flight operations, or reports them cancelled, before shutdown.',
    compatibilityConstraints: [],
  }
}

function baseVerification(moduleId: string, headline: string, acceptanceCases: AcceptanceCase[]): ModuleVerificationSpecification {
  return {
    examples: [`${headline} succeeds for a valid, well-formed input.`],
    edgeCases: [`${headline} rejects an empty or malformed input as a domain rejection, not a technical failure.`],
    acceptanceCases,
    verificationSuiteIds: [`suite.${moduleId}`],
    requiredEvidence: [`Test log for ${moduleId}`, 'Coverage report'],
    testDoubles: [`fake-${moduleId}-store`],
    fixtureNeeds: [`fixtures/${moduleId}/`],
    configuredCommands: [`pnpm --filter @engineering-ui-kit/core test -- ${moduleId}`],
    unresolvedItems: [],
  }
}

// --- experience modules -----------------------------------------------------

function auditWorkspaceContent(): ModuleContent {
  const moduleId = MOD.auditWorkspace
  const requiredOperations: RequiredOperationRef[] = [
    requiredOp('FindFirstGap', MOD.evidenceGraph, 'Shows the first readiness gap on the readiness view.'),
    requiredOp('ReportCoverage', MOD.evidenceGraph, 'Shows objective coverage on the readiness view.'),
    requiredOp('SubmitFindingDecision', MOD.findingReview, 'Delegates RecordReviewDecision to Finding Review.'),
    requiredOp('CloseFinding', MOD.findingReview, 'Lets the audit lead close a resolved finding from the workspace.'),
    requiredOp('GetPackageStatus', MOD.packageExport, 'Shows the current package status.'),
    requiredOp('CreateBaseline', MOD.workspaceSnapshots, 'Shows the baseline that package status refers to.'),
  ]
  const detail: ExperienceModuleDetail = {
    userRolesAndTasks: [nt('role.audit-lead', 'Audit lead: check readiness, open findings, record review decisions, watch package status.')],
    surfaces: [nt('surface.readiness', 'Readiness panel'), nt('surface.findings', 'Findings list and detail dialog'), nt('surface.package', 'Package status panel')],
    informationHierarchy: 'Readiness first, then open findings ordered by severity, then package status.',
    commandsAndNavigation: ['Open readiness', 'Open finding', 'Record review decision', 'Open Package Export'],
    viewStates: [nt('state.loading', 'Loading'), nt('state.ready', 'Ready'), nt('state.empty', 'No findings open'), nt('state.error', 'Readiness unavailable')],
    loadingBehavior: 'Shows a skeleton readiness panel while the first readiness call is in flight.',
    emptyStates: 'Shows "No open findings" when every finding is closed.',
    validationMessages: 'Shows "Choose an independent reviewer" when the signed-in user authored the finding.',
    permissionStates: 'Hides Record review decision for a user without reviewer authority.',
    partialDataStates: 'Shows a stale readiness banner when the last refresh failed for one or more sources.',
    recoverableFailures: 'Shows a retry action when GetPackageStatus times out.',
    unrecoverableFailures: 'Shows a support-contact message when the Evidence Store is unreachable.',
    responsiveBehavior: 'Collapses the findings list into a single-column view under 768px.',
    touchTargets: 'Every command target is at least 44x44 CSS pixels.',
    keyboardBehavior: 'Every command is reachable by Tab and activatable by Enter or Space.',
    focusOrderAndReturn: 'Focus returns to the finding row after the review-decision dialog closes.',
    screenReaderNamesAndStatus: 'Announces "Readiness updated" after a refresh completes.',
    reducedMotionBehavior: 'Disables the readiness panel transition when prefers-reduced-motion is set.',
    themeAndContrast: 'Meets WCAG 2.1 AA contrast in the light and dark themes.',
    approvedComponentSources: ['@engineering-ui-kit/ui'],
    inboundBindingIds: ['binding.audit-workspace.open'],
    scenarioScreenshotIds: ['screenshot.audit-workspace.readiness', 'screenshot.audit-workspace.finding-detail'],
  }
  return {
    nonResponsibilities: ['Does not compute coverage or trace status itself.', 'Does not persist evidence.'],
    ownedConcerns: ['Readiness layout', 'Finding list and detail presentation', 'Package status presentation'],
    excludedConcerns: ['Evidence identity', 'Independent-review enforcement', 'Package file generation'],
    requiredOperations,
    schemas: ioSchemas(moduleId),
    rules: [nt('rule.readiness-source', 'Readiness always reflects the newest published snapshot.')],
    invariants: ['The workspace never shows a review-decision control to a nonindependent reviewer.'],
    behavior: {
      preconditions: ['The signed-in user has at least read access to the project.'],
      postconditions: ['OpenReadiness always returns the readiness computed from the current published snapshot.'],
      domainRejections: ['RecordReviewDecision is rejected when the signed-in user authored the finding.'],
      technicalFailures: ['GetPackageStatus fails when the Job and Package Store is unreachable.'],
      sideEffects: ['RecordReviewDecision writes one finding-review record through Finding Review.'],
      idempotency: 'OpenReadiness and OpenFinding are idempotent; RecordReviewDecision is non-idempotent.',
      cancellation: 'A pending readiness call is cancelled when the user navigates away.',
      timeouts: 'Short timeout class for OpenReadiness and OpenFinding.',
      concurrency: 'Safe for concurrent reads; RecordReviewDecision is serialized per finding by Finding Review.',
      retry: 'Safe to retry OpenReadiness and OpenFinding; RecordReviewDecision retry requires a fresh independence check.',
      recovery: 'On a failed readiness call, the workspace shows the last known readiness with a stale indicator.',
      emittedEvents: [],
      consumedEvents: ['event.finding.decision-recorded'],
    },
    data: baseData(moduleId, 'Presentation state only; the workspace owns no persistent evidence.'),
    runtime: baseRuntime(moduleId),
    verification: baseVerification(moduleId, 'OpenReadiness', [
      ac('audit-workspace.ac.readiness', 'The audit lead opens the workspace.', 'Readiness reflects the newest published snapshot.'),
      ac('audit-workspace.ac.reject-self-review', 'The signed-in user is the author of the open finding.', 'Record review decision is hidden and RecordReviewDecision is rejected if invoked.', 'failure'),
    ]),
    typeSpecific: { moduleType: 'experience', detail },
    unresolvedItems: [],
  }
}

function lifecycleExplorerContent(): ModuleContent {
  const moduleId = MOD.lifecycleExplorer
  const requiredOperations: RequiredOperationRef[] = [
    requiredOp('FollowTrace', MOD.evidenceGraph, "Realizes the catalog's FollowTrace entry by calling the Evidence Graph's owned trace operation (see architecture deviation note)."),
    requiredOp('CompareRevisions', MOD.evidenceGraph, 'Backs CompareEvidence.'),
    requiredOp('PublishSnapshot', MOD.workspaceSnapshots, 'Browses evidence over the currently published snapshot.'),
  ]
  const detail: ExperienceModuleDetail = {
    userRolesAndTasks: [nt('role.auditor', 'Auditor: browse evidence by DO-178C lifecycle phase and follow traces to the first gap.')],
    surfaces: [nt('surface.phase-list', 'Lifecycle-phase list'), nt('surface.trace-view', 'Trace navigation view'), nt('surface.compare', 'Revision comparison dialog')],
    informationHierarchy: 'Lifecycle phase first, then evidence items within the phase, then trace links per item.',
    commandsAndNavigation: ['Open lifecycle phase', 'Follow trace', 'Compare evidence'],
    viewStates: [nt('state.loading', 'Loading'), nt('state.ready', 'Ready'), nt('state.empty', 'No evidence for this phase'), nt('state.broken-trace', 'Trace target not found')],
    loadingBehavior: 'Shows a skeleton phase list while the first phase call is in flight.',
    emptyStates: 'Shows "No evidence for this phase yet" when a phase has no published evidence.',
    validationMessages: 'Not applicable; this module has no user-entered forms.',
    permissionStates: 'Every signed-in project member can browse; no elevated permission is required.',
    partialDataStates: 'Shows a partial-data banner when one adapter failed on the last refresh.',
    recoverableFailures: 'Shows "Trace target not found — reported as a defect" and lets the auditor continue browsing.',
    unrecoverableFailures: 'Shows a support-contact message when the Evidence Graph is unreachable.',
    responsiveBehavior: 'Collapses the two-pane trace view into a single pane under 768px.',
    touchTargets: 'Every command target is at least 44x44 CSS pixels.',
    keyboardBehavior: 'Every phase, evidence item, and trace link is reachable by Tab.',
    focusOrderAndReturn: 'Focus returns to the trace link after the comparison dialog closes.',
    screenReaderNamesAndStatus: 'Announces "Trace target not found" when a followed trace is broken.',
    reducedMotionBehavior: 'Disables the phase-transition animation when prefers-reduced-motion is set.',
    themeAndContrast: 'Meets WCAG 2.1 AA contrast in the light and dark themes.',
    approvedComponentSources: ['@engineering-ui-kit/ui'],
    inboundBindingIds: ['binding.lifecycle-explorer.open'],
    scenarioScreenshotIds: ['screenshot.lifecycle-explorer.phase-view', 'screenshot.lifecycle-explorer.broken-trace'],
  }
  return {
    nonResponsibilities: ['Does not own trace identity or coverage computation.', 'Does not persist evidence.'],
    ownedConcerns: ['Lifecycle-phase presentation', 'Trace navigation presentation'],
    excludedConcerns: ['Trace identity', 'Coverage computation'],
    requiredOperations,
    schemas: ioSchemas(moduleId),
    rules: [],
    invariants: ['A broken trace never crashes the browsing view; it is reported and browsing continues.'],
    behavior: {
      preconditions: ['At least one snapshot has been published.'],
      postconditions: ['OpenLifecyclePhase always returns evidence current as of the newest published snapshot.'],
      domainRejections: [],
      technicalFailures: ['FollowTrace fails when the Evidence Graph is unreachable.'],
      sideEffects: [],
      idempotency: 'Every provided operation is idempotent.',
      cancellation: 'A pending phase or trace call is cancelled when the user navigates away.',
      timeouts: 'Short timeout class for every provided operation.',
      concurrency: 'Safe for concurrent reads by multiple auditors.',
      retry: 'Safe to retry every provided operation.',
      recovery: 'A broken trace is reported as a defect and browsing continues for other traces (§22.3).',
      emittedEvents: [],
      consumedEvents: [],
    },
    data: baseData(moduleId, 'Presentation state only; this module owns no persistent evidence.'),
    runtime: baseRuntime(moduleId),
    verification: baseVerification(moduleId, 'OpenLifecyclePhase', [
      ac('lifecycle-explorer.ac.phase-navigation', 'The auditor opens a lifecycle phase with published evidence.', 'Every evidence item for that phase is shown.'),
      ac(
        'lifecycle-explorer.ac.broken-trace',
        'The auditor follows a trace from a low-level requirement to its model element, and the target model element was deleted.',
        'The system reports "Trace target not found" and the auditor can continue browsing other traces.',
        'failure',
      ),
    ]),
    typeSpecific: { moduleType: 'experience', detail },
    unresolvedItems: [],
  }
}

// --- workflow modules --------------------------------------------------------

function importAndPublishActivity(): ActivityDefinition {
  const activityId = childId(MOD.importAndPublish, 'activity', 'refresh-evidence')
  return {
    id: activityId,
    name: 'Refresh evidence',
    actions: [
      { id: 'start', kind: 'initial', label: 'Start refresh', next: [{ targetId: 'validate' }] },
      { id: 'validate', kind: 'action', label: 'Validate candidate snapshot', next: [{ targetId: 'decision' }] },
      {
        id: 'decision',
        kind: 'decision',
        label: 'Is the candidate valid?',
        next: [
          { targetId: 'publish', guard: '[valid]' },
          { targetId: 'preserve', guard: '[invalid or unreachable]' },
        ],
      },
      { id: 'publish', kind: 'action', label: 'Publish snapshot', next: [{ targetId: 'end' }] },
      { id: 'preserve', kind: 'action', label: 'Preserve last valid snapshot and report defect', next: [{ targetId: 'end' }] },
      { id: 'end', kind: 'final', label: 'Refresh complete', next: [] },
    ],
  }
}

function importAndPublishInteraction(): InteractionDefinition {
  const interactionId = childId(MOD.importAndPublish, 'interaction', 'refresh-evidence')
  return {
    id: interactionId,
    name: 'Refresh evidence',
    lifelines: [
      { id: 'user', label: 'Audit lead', kind: 'actor' },
      { id: 'wf', label: 'Import and Publish', kind: 'control' },
      { id: 'adapter', label: 'File-system adapter', kind: 'adapter' },
      { id: 'snap', label: 'Workspace Snapshots', kind: 'entity' },
    ],
    fragments: [],
    messages: [
      { id: 'm1', from: 'user', to: 'wf', label: 'RefreshEvidence', kind: 'call' },
      { id: 'm2', from: 'wf', to: 'adapter', label: 'ProjectFileSourcePort', kind: 'call' },
      { id: 'm3', from: 'adapter', to: 'wf', label: 'candidates', kind: 'reply' },
      { id: 'm4', from: 'wf', to: 'snap', label: 'StageCandidate', kind: 'call' },
      { id: 'm5', from: 'snap', to: 'wf', label: 'staged', kind: 'reply' },
      { id: 'm6', from: 'wf', to: 'user', label: 'refresh status', kind: 'reply' },
    ],
  }
}

function importAndPublishContent(): ModuleContent {
  const moduleId = MOD.importAndPublish
  const requiredOperations: RequiredOperationRef[] = [
    ...ADAPTER_MODULE_IDS.map((adapterModuleId) => {
      const port = OPERATION_ALLOCATIONS.find((a) => a.moduleId === adapterModuleId)!.operationId
      return requiredOp(port, adapterModuleId, `Reads source candidates through ${port}.`)
    }),
    requiredOp('ResolveEvidenceIdentity', MOD.evidenceGraph, 'Resolves canonical identity for every published item.'),
    requiredOp('AddRelationship', MOD.evidenceGraph, 'Records relationships discovered while publishing.'),
    requiredOp('StageCandidate', MOD.workspaceSnapshots, 'Stages every discovered candidate.'),
    requiredOp('StartValidation', MOD.workspaceSnapshots, 'Starts schema validation for staged candidates.'),
    requiredOp('PublishSnapshot', MOD.workspaceSnapshots, 'Publishes every valid candidate.'),
    requiredOp('PreserveLastValid', MOD.workspaceSnapshots, 'Preserves the last valid snapshot when a candidate fails.'),
    requiredOp('EvidenceStorePort', MOD.evidenceStore, 'Writes normalized evidence.'),
    requiredOp('JobStorePort', MOD.jobPackageStore, 'Tracks refresh job progress and cancellation.'),
  ]
  const detail: WorkflowModuleDetail = {
    trigger: 'The audit lead selects Refresh evidence, or a scheduled refresh fires.',
    orderedSteps: [
      nt('step.discover', 'Discover candidates from every configured adapter.'),
      nt('step.stage', 'Stage each candidate.'),
      nt('step.validate', 'Validate each candidate against its canonical schema.'),
      nt('step.publish-or-preserve', 'Publish every valid candidate; preserve the last valid snapshot for every invalid or unreachable one.'),
      nt('step.report', 'Report refresh status and any defects found.'),
    ],
    participants: ['Audit lead', ...ADAPTER_MODULE_IDS, MOD.evidenceGraph, MOD.workspaceSnapshots, MOD.evidenceStore, MOD.jobPackageStore],
    decisionsAndGuards: [nt('decision.valid', 'A candidate publishes only when it passes canonical-schema validation; otherwise the last valid snapshot is preserved.')],
    transactionBoundary: 'Each source candidate publishes or preserves independently; one source failure never blocks another source.',
    partialCompletion: 'A refresh with some failed sources still publishes every valid candidate from the other sources.',
    compensation: 'A failed publish leaves the prior published snapshot in place; nothing is rolled back because nothing partial was written.',
    retryPolicy: 'The audit lead can retry the whole refresh or rely on the next scheduled refresh; adapter reads are safe to retry.',
    deduplication: 'A duplicate candidate with the same content hash as the currently published snapshot is a no-op.',
    idempotencyKeyUse: 'RefreshEvidence accepts an idempotency key so a duplicate submit does not start a second job.',
    cancellationPoints: ['Between adapter reads', 'Between candidate validations'],
    deadlinePropagation: 'The configured refresh deadline is propagated to every adapter call as its timeout class.',
    resourceLocks: ['One refresh job per project runs at a time.'],
    progressReporting: 'GetRefreshStatus reports per-source progress and per-source outcome.',
    finalOutcomes: ['Refresh completed with every source valid', 'Refresh completed with one or more sources preserved as last-valid', 'Refresh cancelled'],
  }
  return {
    nonResponsibilities: ['Does not decide business policy for adapters.', 'Does not compute coverage or trace status.'],
    ownedConcerns: ['Refresh orchestration', 'Publish-or-preserve decision', 'Refresh job progress'],
    excludedConcerns: ['Evidence identity', 'Snapshot state machine internals', 'Adapter-specific parsing'],
    requiredOperations,
    schemas: ioSchemas(moduleId),
    rules: [nt('rule.last-valid', 'A failed refresh preserves the last valid published snapshot for every source.')],
    invariants: ['A refresh never publishes a candidate that failed canonical-schema validation.'],
    behavior: {
      preconditions: ['At least one source adapter is configured.'],
      postconditions: ['Every valid candidate is published; every invalid or unreachable candidate preserves the last valid snapshot.'],
      domainRejections: ['RefreshEvidence is rejected when no source adapter is configured.'],
      technicalFailures: ['RefreshEvidence fails for one source when that adapter is unreachable; other sources are unaffected.'],
      sideEffects: ['Publishes zero or more snapshots and writes zero or more evidence records.'],
      idempotency: 'RefreshEvidence is idempotent for a given idempotency key.',
      cancellation: 'CancelRefresh stops staging new candidates; already-published snapshots are unaffected.',
      timeouts: 'Medium timeout class overall; each adapter call uses its own timeout class.',
      concurrency: 'One refresh job per project at a time; GetRefreshStatus is safe to call concurrently.',
      retry: 'Safe to retry the whole refresh; already-published snapshots are unaffected by a retry.',
      recovery: 'On a per-source failure, the last valid published snapshot for that source is preserved and reported (§19).',
      emittedEvents: ['event.refresh.completed', 'event.refresh.source-failed'],
      consumedEvents: [],
      activities: [importAndPublishActivity()],
      interactions: [importAndPublishInteraction()],
    },
    data: baseData(moduleId, 'Owns refresh job progress; delegates snapshot and evidence ownership to Workspace Snapshots and the Evidence Graph.'),
    runtime: baseRuntime(moduleId),
    verification: baseVerification(moduleId, 'RefreshEvidence', [
      ac('import-publish.ac.publish-valid', 'Every configured source returns a valid candidate.', 'Every candidate is published as a new snapshot.'),
      ac(
        'import-publish.ac.preserve-on-failure',
        'One configured source is unreachable during refresh.',
        'The last valid published snapshot for that source is preserved and the failure is reported; other sources still publish.',
        'failure',
      ),
    ]),
    typeSpecific: { moduleType: 'workflow', detail },
    unresolvedItems: [],
  }
}

function findingReviewActivity(): ActivityDefinition {
  return {
    id: childId(MOD.findingReview, 'activity', 'submit-finding-decision'),
    name: 'Submit finding decision',
    actions: [
      { id: 'start', kind: 'initial', label: 'Start decision submission', next: [{ targetId: 'check-independence' }] },
      {
        id: 'check-independence',
        kind: 'decision',
        label: 'Is the reviewer independent of the author?',
        next: [
          { targetId: 'record', guard: '[independent]' },
          { targetId: 'reject', guard: '[not independent]' },
        ],
      },
      { id: 'record', kind: 'action', label: 'Record the finding decision', next: [{ targetId: 'end' }] },
      { id: 'reject', kind: 'action', label: 'Reject the decision as nonindependent', next: [{ targetId: 'end' }] },
      { id: 'end', kind: 'final', label: 'Decision handled', next: [] },
    ],
  }
}

function findingReviewState(): StateDefinition {
  return {
    recordName: 'Finding',
    states: ['open', 'underReview', 'closed', 'reopened'],
    initialState: 'open',
    finalStates: ['closed'],
    transitions: [
      { id: 'f1', from: 'open', to: 'underReview', trigger: 'SubmitFindingDecision' },
      { id: 'f2', from: 'underReview', to: 'closed', trigger: 'CloseFinding' },
      { id: 'f3', from: 'closed', to: 'reopened', trigger: 'ReopenFinding' },
      { id: 'f4', from: 'reopened', to: 'underReview', trigger: 'SubmitFindingDecision' },
    ],
  }
}

function findingReviewInteraction(): InteractionDefinition {
  return {
    id: childId(MOD.findingReview, 'interaction', 'submit-finding-decision'),
    name: 'Submit finding decision',
    lifelines: [
      { id: 'reviewer', label: 'Independent reviewer', kind: 'actor' },
      { id: 'wf', label: 'Finding Review', kind: 'control' },
      { id: 'graph', label: 'Evidence Graph', kind: 'entity' },
    ],
    fragments: [],
    messages: [
      { id: 'm1', from: 'reviewer', to: 'wf', label: 'SubmitFindingDecision', kind: 'call' },
      { id: 'm2', from: 'wf', to: 'graph', label: 'ResolveEvidenceIdentity', kind: 'call' },
      { id: 'm3', from: 'graph', to: 'wf', label: 'identity', kind: 'reply' },
      { id: 'm4', from: 'wf', to: 'reviewer', label: 'decision recorded or rejected', kind: 'reply' },
    ],
  }
}

function findingReviewContent(): ModuleContent {
  const moduleId = MOD.findingReview
  const requiredOperations: RequiredOperationRef[] = [
    requiredOp('ResolveEvidenceIdentity', MOD.evidenceGraph, 'Resolves the identity of the evidence a finding references.'),
    requiredOp('FollowTrace', MOD.evidenceGraph, 'Shows the evidence trail for a finding under review.'),
    requiredOp('EvidenceStorePort', MOD.evidenceStore, 'Persists reviews and findings.'),
  ]
  const detail: WorkflowModuleDetail = {
    trigger: 'A reviewer opens a finding to record a decision.',
    orderedSteps: [
      nt('step.open', 'Open the finding and its evidence.'),
      nt('step.check-independence', 'Check that the reviewer is not the finding author.'),
      nt('step.record-or-reject', 'Record the decision, or reject it as nonindependent.'),
      nt('step.close', 'Close the finding once a decision is recorded.'),
    ],
    participants: ['Independent reviewer', MOD.evidenceGraph, MOD.evidenceStore],
    decisionsAndGuards: [nt('decision.independence', 'A decision is recorded only when the reviewer differs from the finding author; otherwise it is rejected.')],
    transactionBoundary: 'One finding decision is one transaction; it either records or is rejected, never partially.',
    partialCompletion: 'Not applicable; a decision is atomic.',
    compensation: 'A rejected decision leaves the finding state unchanged.',
    retryPolicy: 'A rejected nonindependent decision is not retried automatically; a different reviewer must submit it.',
    deduplication: 'A duplicate decision submission with the same idempotency key is a no-op.',
    idempotencyKeyUse: 'SubmitFindingDecision accepts an idempotency key.',
    cancellationPoints: ['Before the decision is recorded.'],
    deadlinePropagation: 'Not applicable; this workflow has no long-running external call.',
    resourceLocks: ['One decision at a time per finding.'],
    progressReporting: 'Not applicable; SubmitFindingDecision completes synchronously.',
    finalOutcomes: ['Decision recorded', 'Decision rejected — not independent', 'Finding closed', 'Finding reopened'],
  }
  return {
    nonResponsibilities: ['Does not own evidence identity.', 'Does not decide package readiness.'],
    ownedConcerns: ['Independent-review enforcement', 'Finding state transitions'],
    excludedConcerns: ['Evidence identity', 'Coverage computation'],
    requiredOperations,
    schemas: ioSchemas(moduleId),
    rules: [nt('rule.independence', 'A finding decision is rejected when the reviewer is the same person as the finding author.')],
    invariants: ['A closed finding was never closed by a decision from its own author.'],
    behavior: {
      preconditions: ['The finding exists and is open or reopened.'],
      postconditions: ['A recorded decision always has a reviewer identity that differs from the finding author identity.'],
      domainRejections: ['SubmitFindingDecision is rejected when the reviewer is the same person as the finding author (nonindependent decision, §22.3 defect).'],
      technicalFailures: ['SubmitFindingDecision fails when the Evidence Store is unreachable.'],
      sideEffects: ['Writes one finding-review audit record per submitted decision, accepted or rejected.'],
      idempotency: 'SubmitFindingDecision is idempotent for a given idempotency key; CloseFinding and ReopenFinding are idempotent.',
      cancellation: 'A pending decision submission can be cancelled before it is recorded.',
      timeouts: 'Short timeout class.',
      concurrency: 'Two decisions for the same finding are serialized; the second sees the first result.',
      retry: 'Safe to retry after a technical failure; not safe to retry a rejected nonindependent decision without a different reviewer.',
      recovery: 'A rejected decision leaves the finding open for an independent reviewer.',
      emittedEvents: ['event.finding.decision-recorded', 'event.finding.decision-rejected'],
      consumedEvents: [],
      states: [findingReviewState()],
      activities: [findingReviewActivity()],
      interactions: [findingReviewInteraction()],
    },
    data: baseData(moduleId, 'Owns finding and review-decision records.'),
    runtime: baseRuntime(moduleId),
    verification: baseVerification(moduleId, 'SubmitFindingDecision', [
      ac('finding-review.ac.independent-decision', 'A reviewer who did not author the finding submits a decision.', 'The decision is recorded.'),
      ac(
        'finding-review.ac.reject-nonindependent',
        'A reviewer who authored the finding submits a decision (§22.3 defect: one rejected nonindependent decision).',
        'The decision is rejected because the reviewer is the same person as the author.',
        'failure',
      ),
    ]),
    typeSpecific: { moduleType: 'workflow', detail },
    unresolvedItems: [],
  }
}

function packageExportActivity(): ActivityDefinition {
  return {
    id: childId(MOD.packageExport, 'activity', 'create-audit-package'),
    name: 'Create audit package',
    actions: [
      { id: 'start', kind: 'initial', label: 'Start package creation', next: [{ targetId: 'check-baseline' }] },
      {
        id: 'check-baseline',
        kind: 'decision',
        label: 'Is the baseline current?',
        next: [
          { targetId: 'build', guard: '[current]' },
          { targetId: 'flag-old', guard: '[stale]' },
        ],
      },
      { id: 'build', kind: 'action', label: 'Build deterministic package and manifest', next: [{ targetId: 'end' }] },
      { id: 'flag-old', kind: 'action', label: 'Flag the package result as old', next: [{ targetId: 'end' }] },
      { id: 'end', kind: 'final', label: 'Package export complete', next: [] },
    ],
  }
}

function packageExportInteraction(): InteractionDefinition {
  return {
    id: childId(MOD.packageExport, 'interaction', 'create-audit-package'),
    name: 'Create audit package',
    lifelines: [
      { id: 'user', label: 'Audit lead', kind: 'actor' },
      { id: 'wf', label: 'Package Export', kind: 'control' },
      { id: 'store', label: 'Job and Package Store', kind: 'adapter' },
    ],
    fragments: [],
    messages: [
      { id: 'm1', from: 'user', to: 'wf', label: 'CreateAuditPackage', kind: 'call' },
      { id: 'm2', from: 'wf', to: 'store', label: 'PackageStorePort', kind: 'call' },
      { id: 'm3', from: 'store', to: 'wf', label: 'package stored', kind: 'reply' },
      { id: 'm4', from: 'wf', to: 'user', label: 'package status', kind: 'reply' },
    ],
  }
}

function packageExportContent(): ModuleContent {
  const moduleId = MOD.packageExport
  const requiredOperations: RequiredOperationRef[] = [
    requiredOp('ReportCoverage', MOD.evidenceGraph, 'Includes coverage in the package manifest.'),
    requiredOp('CompareRevisions', MOD.evidenceGraph, 'Detects whether the baseline changed since the last package.'),
    requiredOp('CreateBaseline', MOD.workspaceSnapshots, 'Exports the current baselined snapshot set.'),
    requiredOp('EvidenceStorePort', MOD.evidenceStore, 'Reads normalized evidence for the manifest.'),
    requiredOp('PackageStorePort', MOD.jobPackageStore, 'Stores the package files and manifest.'),
    requiredOp('JobStorePort', MOD.jobPackageStore, 'Tracks package job progress and cancellation.'),
  ]
  const detail: WorkflowModuleDetail = {
    trigger: 'The audit lead selects Create audit package for an approved baseline.',
    orderedSteps: [
      nt('step.select-baseline', 'Select the approved baseline.'),
      nt('step.check-currency', 'Check whether the baseline is still current.'),
      nt('step.build', 'Build the deterministic package and manifest.'),
      nt('step.report-status', 'Report package status and hash.'),
    ],
    participants: ['Audit lead', MOD.evidenceGraph, MOD.workspaceSnapshots, MOD.evidenceStore, MOD.jobPackageStore],
    decisionsAndGuards: [nt('decision.currency', 'A package built against a superseded baseline revision is flagged old, not silently replaced.')],
    transactionBoundary: 'One package build is one transaction: it fully completes or fully fails, with no partial package files left behind.',
    partialCompletion: 'Not applicable; a package either completes or fails as one unit.',
    compensation: 'A failed build discards any partial package files; the last successful package remains available.',
    retryPolicy: 'Safe to retry after the missing evidence is resolved.',
    deduplication: 'A duplicate CreateAuditPackage submission with the same idempotency key returns the same job.',
    idempotencyKeyUse: 'CreateAuditPackage accepts an idempotency key so a duplicate submit does not start a second job.',
    cancellationPoints: ['Before the manifest is finalized.'],
    deadlinePropagation: 'The configured export deadline is propagated to the package job.',
    resourceLocks: ['One package build per baseline at a time.'],
    progressReporting: 'GetPackageStatus reports build progress and the final package hash.',
    finalOutcomes: ['Package created', 'Package build failed — missing evidence', 'Package cancelled', 'Package result old — baseline changed after the package was built'],
  }
  return {
    nonResponsibilities: ['Does not decide DO-178C objective applicability.', 'Does not persist package files itself.'],
    ownedConcerns: ['Deterministic package assembly', 'Package manifest content', 'Package job progress'],
    excludedConcerns: ['Evidence identity', 'Snapshot state machine internals', 'Package file storage'],
    requiredOperations,
    schemas: ioSchemas(moduleId),
    rules: [nt('rule.deterministic-package', 'The same baseline always produces a byte-identical audit package.')],
    invariants: ['A package result always identifies the exact baseline revision it was built from.'],
    behavior: {
      preconditions: ['A baseline is approved.'],
      postconditions: ['CreateAuditPackage always records the baseline revision used to build the package.'],
      domainRejections: ['CreateAuditPackage is rejected when required evidence is missing from the baseline.'],
      technicalFailures: ['CreateAuditPackage fails when the Job and Package Store is unreachable.'],
      sideEffects: ['Writes one package job and, on success, one package file set.'],
      idempotency: 'CreateAuditPackage is idempotent for a given idempotency key.',
      cancellation: 'CancelPackage stops an in-progress build and discards partial files.',
      timeouts: 'Medium timeout class.',
      concurrency: 'One package build per baseline at a time; GetPackageStatus is safe to call concurrently.',
      retry: 'Safe to retry after the missing evidence is resolved.',
      recovery: 'On failure, the last successful package remains available (§22.1 "old data").',
      emittedEvents: ['event.package.created', 'event.package.build-failed'],
      consumedEvents: [],
      activities: [packageExportActivity()],
      interactions: [packageExportInteraction()],
    },
    data: baseData(moduleId, 'Owns package job records; delegates package file storage to the Job and Package Store.'),
    runtime: baseRuntime(moduleId),
    verification: baseVerification(moduleId, 'CreateAuditPackage', [
      ac('package-export.ac.deterministic', 'The same approved baseline is exported twice.', 'Both exports produce byte-identical package hashes.'),
      ac(
        'package-export.ac.old-after-baseline-change',
        'A package was built from a baseline revision that a later design change superseded (§22.3 defect: one old package after a baseline change).',
        'The package result reports state "old" until it is rebuilt from the current baseline.',
        'failure',
      ),
    ]),
    typeSpecific: { moduleType: 'workflow', detail },
    unresolvedItems: [],
  }
}

// --- core data and rules (domain) modules ------------------------------------

function evidenceGraphContent(): ModuleContent {
  const moduleId = MOD.evidenceGraph
  const requiredOperations: RequiredOperationRef[] = [requiredOp('EvidenceStorePort', MOD.evidenceStore, 'Reads and writes normalized evidence and trace records.')]
  const detail: DomainModuleDetail = {
    domainVocabulary: [
      nt('term.trace-link', 'Trace link: a directed relationship between two evidence items, e.g. low-level requirement to model element.'),
      nt('term.coverage', 'Coverage: the ratio of DO-178C objectives with a complete evidence trail to the total applicable objectives.'),
      nt('term.first-gap', 'First gap: the first evidence item, in canonical order, with no outgoing trace link where one is required.'),
    ],
    valueObjects: [nt('vo.evidence-identity', 'EvidenceIdentity: a canonical, content-addressed identity for one evidence item.')],
    consistencyBoundary: 'One project graph of evidence identities and their relationships is the consistency boundary; a relationship never spans two projects.',
    invariants: [
      'Every relationship references two evidence identities that exist in this graph.',
      'A trace identity is stable across a revision comparison unless the underlying source content changed.',
    ],
    calculations: [nt('calc.coverage', 'ReportCoverage divides objectives with a complete trace by total applicable objectives, per DO-178C DAL.')],
    decisionTables: [nt('dt.first-gap-priority', 'FindFirstGap orders candidate gaps by lifecycle phase, then canonical identity, and returns the first.')],
    deterministicOrdering: 'Every list operation orders results by canonical identity, ascending.',
    canonicalIdentityRules: 'An evidence identity is the content hash of its normalized, canonicalized fields plus its source-provenance reference.',
    revisionComparison: 'CompareRevisions diffs the relationship set and coverage of two published snapshots and reports added, removed, and changed trace links.',
    invalidStatePrevention: 'AddRelationship rejects a relationship whose source or target evidence identity does not resolve.',
    operationPurity: [
      { operationId: 'ResolveEvidenceIdentity', pure: true },
      { operationId: 'FollowTrace', pure: true },
      { operationId: 'FindFirstGap', pure: true },
      { operationId: 'ReportCoverage', pure: true },
      { operationId: 'CompareRevisions', pure: true },
      { operationId: 'AddRelationship', pure: false },
    ],
  }
  return {
    nonResponsibilities: ['Does not read files, spreadsheets, or any adapter format directly.', 'Does not decide package readiness.'],
    ownedConcerns: ['Evidence identity', 'Trace links', 'Coverage', 'First-gap navigation', 'Revision comparison'],
    excludedConcerns: ['File formats', 'Vendor tool APIs', 'UI presentation'],
    requiredOperations,
    schemas: ioSchemas(moduleId),
    rules: [],
    invariants: ['A trace link is only ever added between two evidence identities that resolve in this graph.'],
    behavior: {
      preconditions: ['The referenced evidence identities exist in the Evidence Store.'],
      postconditions: ['FollowTrace returns the linked evidence item when a trace link exists, or reports that no link was found.'],
      domainRejections: ['AddRelationship is rejected when either endpoint identity does not resolve.'],
      technicalFailures: ['ResolveEvidenceIdentity fails when the Evidence Store is unreachable.'],
      sideEffects: ['AddRelationship writes one relationship record.'],
      idempotency: 'AddRelationship is idempotent for the same relationship content hash. Every read operation is idempotent.',
      cancellation: 'FindFirstGap and ReportCoverage are cancellable between lifecycle phases.',
      timeouts: 'Short timeout class for identity resolution; medium timeout class for coverage and revision comparison.',
      concurrency: 'Safe for concurrent reads; AddRelationship is serialized per evidence identity.',
      retry: 'Safe to retry every operation; every write is idempotent by content hash.',
      recovery: 'A broken trace does not corrupt the graph; it is reported as an unresolved trace and the graph continues to serve every other trace.',
      emittedEvents: ['event.evidence.relationship-added'],
      consumedEvents: [],
    },
    data: baseData(moduleId, 'Owns evidence identity and trace-relationship records; delegates raw storage to the Evidence Store.'),
    runtime: baseRuntime(moduleId),
    verification: baseVerification(moduleId, 'FollowTrace', [
      ac('evidence-graph.ac.follow-trace', 'A low-level requirement has a trace link to its model element.', 'FollowTrace navigates to the linked model element.'),
      ac(
        'evidence-graph.ac.broken-trace',
        'A low-level requirement references a model element that was deleted from the source model (§22.3 defect: one broken low-level-requirement-to-model trace).',
        'FollowTrace reports the trace as unresolved instead of throwing or returning a wrong element.',
        'failure',
      ),
    ]),
    typeSpecific: { moduleType: 'domain', detail },
    unresolvedItems: [],
  }
}

function workspaceSnapshotsState(): StateDefinition {
  return {
    recordName: 'Snapshot',
    states: ['candidate', 'validating', 'published', 'failed', 'baselined'],
    initialState: 'candidate',
    finalStates: ['published', 'failed', 'baselined'],
    transitions: [
      { id: 's1', from: 'candidate', to: 'validating', trigger: 'StartValidation' },
      { id: 's2', from: 'validating', to: 'published', trigger: 'PublishSnapshot', guard: '[valid]' },
      { id: 's3', from: 'validating', to: 'failed', trigger: 'PublishSnapshot', guard: '[invalid]' },
      { id: 's4', from: 'published', to: 'baselined', trigger: 'CreateBaseline' },
    ],
  }
}

function workspaceSnapshotsContent(): ModuleContent {
  const moduleId = MOD.workspaceSnapshots
  const requiredOperations: RequiredOperationRef[] = [requiredOp('EvidenceStorePort', MOD.evidenceStore, 'Persists snapshot state.')]
  const detail: DomainModuleDetail = {
    domainVocabulary: [
      nt('term.candidate', 'Candidate: an unvalidated staged source read.'),
      nt('term.snapshot', 'Snapshot: one immutable, versioned set of evidence for one source at one point in time.'),
      nt('term.baseline', 'Baseline: the frozen set of published snapshots a package or scenario run is built from.'),
    ],
    valueObjects: [nt('vo.snapshot-id', 'SnapshotId: a canonical, content-addressed identity for one snapshot.')],
    consistencyBoundary: 'One project snapshot set is the consistency boundary; a snapshot never spans two projects.',
    invariants: ['A snapshot moves forward through candidate → validating → published/failed → baselined and never skips a state.'],
    calculations: [nt('calc.revision-number', 'The next canonical revision number for a source is the current published revision number plus one.')],
    decisionTables: [nt('dt.publish-decision', 'PublishSnapshot publishes on a passing validation result and preserves the last valid snapshot otherwise.')],
    deterministicOrdering: 'Snapshots for one source are ordered by canonical revision number, ascending.',
    canonicalIdentityRules: 'A snapshot identity is the content hash of its normalized evidence set plus its source revision.',
    revisionComparison: 'Two snapshots compare equal when their content hashes match, regardless of wall-clock publish time.',
    invalidStatePrevention: 'StartValidation is rejected for a snapshot that is not in the candidate state.',
    operationPurity: [
      { operationId: 'StageCandidate', pure: false },
      { operationId: 'StartValidation', pure: false },
      { operationId: 'PublishSnapshot', pure: false },
      { operationId: 'PreserveLastValid', pure: false },
      { operationId: 'CreateBaseline', pure: false },
    ],
  }
  return {
    nonResponsibilities: ['Does not validate evidence content itself; it orchestrates the candidate/validating/published state transitions.', 'Does not compute coverage.'],
    ownedConcerns: ['Candidate, validating, published, failed, and baselined snapshot state'],
    excludedConcerns: ['Evidence identity', 'Trace links'],
    requiredOperations,
    schemas: ioSchemas(moduleId),
    rules: [nt('rule.last-valid', 'A failed refresh preserves the last valid published snapshot for every source.')],
    invariants: ['A baseline references only published snapshots.'],
    behavior: {
      preconditions: ['A candidate has been staged.'],
      postconditions: ['A snapshot in the published state always has a passing validation result recorded.'],
      domainRejections: ['StartValidation is rejected for a snapshot not in the candidate state.'],
      technicalFailures: ['PublishSnapshot fails when the Evidence Store is unreachable.'],
      sideEffects: ['Writes one snapshot state transition per call.'],
      idempotency: 'Every provided operation is idempotent for the same snapshot identity.',
      cancellation: 'StartValidation is cancellable before it completes; a cancelled validation leaves the candidate unchanged.',
      timeouts: 'Short timeout class.',
      concurrency: 'Snapshot state transitions are serialized per snapshot identity.',
      retry: 'Safe to retry every operation.',
      recovery: 'PreserveLastValid keeps the previously published snapshot available whenever a new candidate fails validation.',
      emittedEvents: ['event.snapshot.published', 'event.snapshot.failed'],
      consumedEvents: [],
      states: [workspaceSnapshotsState()],
    },
    data: baseData(moduleId, 'Owns snapshot state records; delegates raw storage to the Evidence Store.'),
    runtime: baseRuntime(moduleId),
    verification: baseVerification(moduleId, 'PublishSnapshot', [
      ac('workspace-snapshots.ac.publish', 'A staged candidate passes validation.', 'The snapshot moves to the published state.'),
      ac('workspace-snapshots.ac.preserve', 'A staged candidate fails validation.', 'The last valid published snapshot is preserved and the new candidate moves to the failed state.', 'failure'),
    ]),
    typeSpecific: { moduleType: 'domain', detail },
    unresolvedItems: [],
  }
}

// --- external-system adapter modules -----------------------------------------

type AdapterSpec = {
  moduleId: string
  name: string
  portOperationId: string
  externalActor: string
  supportedFormats: string[]
  runtimeAllocation: string
  inputDiscovery: string
  inputValidation: string
  canonicalMapping: string
  provenanceExtraction: string
  authenticationRef: string
  licenseOrSessionNeeds: string
  timeouts: string
  cancellation: string
  retrySafety: string
  partialReadBehavior: string
  corruptInputBehavior: string
  compatibilityErrors: string
  processIsolation: string
  cleanup: string
  representativeFixtures: string[]
  domainRejections: string[]
  technicalFailures: string[]
  acceptance: AcceptanceCase[]
}

const ADAPTER_SPECS: AdapterSpec[] = [
  {
    moduleId: MOD.filesystemAdapter,
    name: 'File-system adapter',
    portOperationId: 'ProjectFileSourcePort',
    externalActor: 'Project file system',
    supportedFormats: ['directory tree', 'arbitrary project files'],
    runtimeAllocation: 'desktop process',
    inputDiscovery: 'Enumerates configured project folders and watches for added or removed files.',
    inputValidation: 'Rejects a path outside the configured project root and a symbolic-link escape.',
    canonicalMapping: 'Maps file path, size, and modified time to the canonical source-candidate schema.',
    provenanceExtraction: 'Records absolute path, modified time, and content hash as provenance.',
    authenticationRef: 'local-filesystem-permissions',
    licenseOrSessionNeeds: 'None.',
    timeouts: 'Short timeout class per file read; a slow network share read fails fast rather than blocking refresh.',
    cancellation: 'Cancellable between files; a cancelled scan discards no already-published snapshot.',
    retrySafety: 'Safe to retry; reads are non-mutating.',
    partialReadBehavior: 'A partially readable folder publishes the readable subset and reports the unreadable paths as findings.',
    corruptInputBehavior: 'An unreadable or truncated file is skipped and reported, not published.',
    compatibilityErrors: 'Maps OS-level permission and not-found errors to the approved technical-error contract.',
    processIsolation: 'Runs in the desktop process; a hang is bounded by the short timeout class.',
    cleanup: 'Closes file handles and watchers on cancel or completion.',
    representativeFixtures: ['fixtures/filesystem/sample-project/', 'fixtures/filesystem/permission-denied/'],
    domainRejections: ['A path outside the configured project root is rejected.'],
    technicalFailures: ['A permission-denied read is reported as a technical failure for that file only.'],
    acceptance: [ac('filesystem-adapter.ac.discover', 'The configured project root has readable files.', 'Every readable file is staged as a candidate.')],
  },
  {
    moduleId: MOD.gitAdapter,
    name: 'Git adapter',
    portOperationId: 'RevisionSourcePort',
    externalActor: 'Local Git repository',
    supportedFormats: ['commit', 'tag', 'branch', 'status'],
    runtimeAllocation: 'desktop process',
    inputDiscovery: 'Reads the configured repository working copy and its ref list.',
    inputValidation: 'Rejects a path that is not a Git working copy and a detached-HEAD state without a resolvable commit.',
    canonicalMapping: 'Maps commit hash, author, message, and changed-path list to the canonical revision-evidence schema.',
    provenanceExtraction: 'Records commit hash, author, and commit time as provenance.',
    authenticationRef: 'local-git-credential-helper',
    licenseOrSessionNeeds: 'None.',
    timeouts: 'Medium timeout class for a full log read on a large repository.',
    cancellation: 'Cancellable between Git process calls.',
    retrySafety: 'Safe to retry; every Git command used is read-only.',
    partialReadBehavior: 'A shallow clone publishes the available history and reports the missing range.',
    corruptInputBehavior: 'A corrupt object store fails the refresh for this source and preserves the last valid snapshot (§19).',
    compatibilityErrors: 'Maps Git process exit codes to the approved technical-error contract.',
    processIsolation: 'Invokes Git as a short-lived desktop child process per call.',
    cleanup: 'Terminates the Git child process on cancel or completion.',
    representativeFixtures: ['fixtures/git/sample-repo/', 'fixtures/git/shallow-clone/'],
    domainRejections: ['A configured path that is not a Git working copy is rejected.'],
    technicalFailures: ['A corrupt Git object store is reported as a technical failure.'],
    acceptance: [ac('git-adapter.ac.read-log', 'The configured repository has a readable commit history.', 'Every commit is mapped to a revision-evidence record.')],
  },
  {
    moduleId: MOD.matlabAdapter,
    name: 'MATLAB and Simulink adapter',
    portOperationId: 'EngineeringModelSourcePort',
    externalActor: 'MATLAB/Simulink engineering models',
    supportedFormats: ['.slx', '.sldd', '.slreqx', '.slmx', '.sldatx'],
    runtimeAllocation: 'separate MATLAB process',
    inputDiscovery: 'Enumerates configured model files and requests model metadata from the MATLAB session.',
    inputValidation: 'Rejects a model file the configured MATLAB/Simulink version cannot open.',
    canonicalMapping: 'Maps model blocks, requirement links, and signal data to the canonical model-evidence schema.',
    provenanceExtraction: 'Records model file hash, MATLAB version, and toolbox versions as provenance.',
    authenticationRef: 'matlab-license-session',
    licenseOrSessionNeeds: 'Requires a checked-out MATLAB/Simulink license and toolbox readiness before use.',
    timeouts:
      'Long timeout class; a model load or link query that exceeds the configured MATLAB session timeout is recorded as a timeout run and does not publish — the last valid snapshot is kept (§19, §22.3 defect: one timeout run).',
    cancellation: 'Cancellable between model files; the in-flight MATLAB call is abandoned and the session is recycled.',
    retrySafety: 'Not safe to retry automatically after a timeout; a stuck MATLAB session must be restarted first.',
    partialReadBehavior: 'A timeout on one model file preserves already-published models from earlier files in the same refresh.',
    corruptInputBehavior: 'A model file MATLAB cannot parse is skipped and reported, not published.',
    compatibilityErrors: 'Maps MATLAB session and license errors to the approved technical-error contract.',
    processIsolation: 'Runs in a separate, app-owned MATLAB process so a MATLAB crash or hang never blocks the desktop process (CAP-CONTRACT-019).',
    cleanup: 'Releases the MATLAB session and toolbox license on cancel, timeout, or completion.',
    representativeFixtures: ['fixtures/matlab/sample-model.slx', 'fixtures/matlab/timeout-model.slx'],
    domainRejections: ['A model file the configured MATLAB/Simulink version cannot open is rejected.'],
    technicalFailures: ['A model load that exceeds the session timeout is reported as a timeout run; the last valid snapshot is kept.'],
    acceptance: [
      ac('matlab-adapter.ac.read-model', 'A configured .slx model opens within the session timeout.', 'Model blocks and links are mapped to the canonical model-evidence schema.'),
      ac(
        'matlab-adapter.ac.timeout',
        'A configured .slx model load exceeds the MATLAB session timeout (§22.3 defect: one timeout run).',
        'The run is recorded with outcome timeout and the last valid published snapshot for that model is kept.',
        'failure',
      ),
    ],
  },
  {
    moduleId: MOD.spreadsheetAdapter,
    name: 'Spreadsheet adapter',
    portOperationId: 'TabularEvidenceSourcePort',
    externalActor: 'Tabular evidence spreadsheets',
    supportedFormats: ['.xlsx', '.csv'],
    runtimeAllocation: 'desktop process',
    inputDiscovery: 'Enumerates configured workbook files and their sheets.',
    inputValidation:
      'Validates the configured column mapping against the sheet header row before reading rows; an invalid column mapping is rejected before any row is published (§22.3 defect: one invalid column mapping).',
    canonicalMapping: 'Maps mapped columns to the canonical requirement/test/trace-row schema.',
    provenanceExtraction: 'Records workbook file hash, sheet name, and row number as provenance.',
    authenticationRef: 'none',
    licenseOrSessionNeeds: 'None.',
    timeouts: 'Short timeout class per workbook.',
    cancellation: 'Cancellable between sheets.',
    retrySafety: 'Safe to retry; reads are non-mutating.',
    partialReadBehavior: 'A sheet with an invalid mapping is skipped and reported; other valid sheets still publish.',
    corruptInputBehavior: 'A corrupt or password-protected workbook is skipped and reported, not published.',
    compatibilityErrors: 'Maps a missing or mismatched column to the approved domain-rejection contract, not a technical error.',
    processIsolation: 'Runs in the desktop process.',
    cleanup: 'Releases the open workbook handle on cancel or completion.',
    representativeFixtures: ['fixtures/spreadsheet/valid-mapping.xlsx', 'fixtures/spreadsheet/invalid-mapping.xlsx'],
    domainRejections: ['An invalid column mapping — a configured column that does not match the sheet header row — is rejected before any row is published.'],
    technicalFailures: ['A corrupt workbook file is reported as a technical failure.'],
    acceptance: [
      ac('spreadsheet-adapter.ac.valid-mapping', 'A configured column mapping matches the sheet header row.', 'Every mapped row is published as evidence.'),
      ac(
        'spreadsheet-adapter.ac.invalid-mapping',
        'A configured column mapping does not match the sheet header row (§22.3 defect: one invalid column mapping).',
        'The sheet is rejected as a domain rejection and no row from it is published.',
        'failure',
      ),
    ],
  },
  {
    moduleId: MOD.cHeaderAdapter,
    name: 'C and header source adapter',
    portOperationId: 'SourceCodeEvidencePort',
    externalActor: 'C source and header files',
    supportedFormats: ['.c', '.h'],
    runtimeAllocation: 'desktop process',
    inputDiscovery: 'Enumerates configured source folders for .c/.h files.',
    inputValidation: 'Rejects a file outside the configured source encoding.',
    canonicalMapping: 'Maps functions, includes, and structural metrics to the canonical source-evidence schema.',
    provenanceExtraction: 'Records file path, hash, and line count as provenance.',
    authenticationRef: 'none',
    licenseOrSessionNeeds: 'None.',
    timeouts: 'Short timeout class per file.',
    cancellation: 'Cancellable between files.',
    retrySafety: 'Safe to retry; reads are non-mutating.',
    partialReadBehavior: 'An unreadable file is skipped and reported.',
    corruptInputBehavior: 'A file with invalid encoding is skipped and reported, not published.',
    compatibilityErrors: 'Maps a parse failure to the approved technical-error contract.',
    processIsolation: 'Runs in the desktop process.',
    cleanup: 'Releases file handles on cancel or completion.',
    representativeFixtures: ['fixtures/c-source/sample.c', 'fixtures/c-source/sample.h'],
    domainRejections: ['A file outside the configured source encoding is rejected.'],
    technicalFailures: ['A parser failure on one file is reported as a technical failure for that file only.'],
    acceptance: [ac('c-header-adapter.ac.parse', 'A configured .c/.h file is well-formed.', 'Functions, includes, and structural metrics are mapped to the canonical source-evidence schema.')],
  },
  {
    moduleId: MOD.coverageAdapter,
    name: 'Coverage adapter',
    portOperationId: 'CoverageEvidenceSourcePort',
    externalActor: 'Structural coverage tool output',
    supportedFormats: ['LCOV', 'XML', 'JSON'],
    runtimeAllocation: 'desktop process',
    inputDiscovery: 'Enumerates configured coverage report files.',
    inputValidation: 'Rejects a report format the configured parser version does not recognize.',
    canonicalMapping: 'Maps statement, decision, and MC/DC coverage to the canonical coverage-evidence schema.',
    provenanceExtraction: 'Records report file hash, tool name, and tool version as provenance.',
    authenticationRef: 'none',
    licenseOrSessionNeeds: 'None.',
    timeouts: 'Medium timeout class for a large coverage report.',
    cancellation: 'Cancellable between report files.',
    retrySafety: 'Safe to retry; reads are non-mutating.',
    partialReadBehavior: 'A partially parseable report publishes the readable subset and reports the rest.',
    corruptInputBehavior: 'A truncated report is skipped and reported, not published.',
    compatibilityErrors: 'Maps an unrecognized report schema to the approved technical-error contract.',
    processIsolation: 'Runs in the desktop process.',
    cleanup: 'Releases file handles on cancel or completion.',
    representativeFixtures: ['fixtures/coverage/sample.lcov', 'fixtures/coverage/sample-coverage.xml'],
    domainRejections: ['A report format the configured parser version does not recognize is rejected.'],
    technicalFailures: ['A truncated report file is reported as a technical failure.'],
    acceptance: [ac('coverage-adapter.ac.parse', 'A configured LCOV report is well-formed.', 'Statement, decision, and MC/DC coverage are mapped to the canonical coverage-evidence schema.')],
  },
  {
    moduleId: MOD.reviewEvidenceAdapter,
    name: 'Review-evidence adapter',
    portOperationId: 'ReviewEvidenceSourcePort',
    externalActor: 'Human review records (checklists, comments, approvals, findings)',
    supportedFormats: ['checklist', 'comment', 'approval', 'finding'],
    runtimeAllocation: 'desktop process',
    inputDiscovery: 'Enumerates configured review-record files and folders.',
    inputValidation: 'Rejects a review record missing a reviewer identity or a decision.',
    canonicalMapping: 'Maps checklist items, comments, approvals, and findings to the canonical review-evidence schema.',
    provenanceExtraction: 'Records reviewer identity, decision time, and source file hash as provenance.',
    authenticationRef: 'none',
    licenseOrSessionNeeds: 'None.',
    timeouts: 'Short timeout class per file.',
    cancellation: 'Cancellable between files.',
    retrySafety: 'Safe to retry; reads are non-mutating.',
    partialReadBehavior: 'A malformed record is skipped and reported; valid records still publish.',
    corruptInputBehavior: 'A file that is not a recognized review-record format is skipped and reported.',
    compatibilityErrors: 'Maps a missing reviewer identity to the approved domain-rejection contract.',
    processIsolation: 'Runs in the desktop process.',
    cleanup: 'Releases file handles on cancel or completion.',
    representativeFixtures: ['fixtures/review/sample-checklist.json', 'fixtures/review/sample-finding.json'],
    domainRejections: ['A review record missing a reviewer identity or a decision is rejected.'],
    technicalFailures: ['An unreadable review-record file is reported as a technical failure.'],
    acceptance: [ac('review-evidence-adapter.ac.parse', 'A configured review record has a reviewer identity and a decision.', 'The record is mapped to the canonical review-evidence schema.')],
  },
  {
    moduleId: MOD.objectiveProfileAdapter,
    name: 'Objective-profile adapter',
    portOperationId: 'ObjectiveProfileSourcePort',
    externalActor: 'Project DO-178C objective and tailoring configuration',
    supportedFormats: ['objective-profile.json'],
    runtimeAllocation: 'desktop process',
    inputDiscovery: 'Reads the configured objective-profile file for the project DAL and tailoring.',
    inputValidation: 'Rejects an objective id not in the approved DO-178C Table A-1..A-10 reference set.',
    canonicalMapping: 'Maps objective id, applicability, and independence requirement to the canonical objective-profile schema.',
    provenanceExtraction: 'Records profile file hash and profile version as provenance.',
    authenticationRef: 'none',
    licenseOrSessionNeeds: 'None.',
    timeouts: 'Short timeout class.',
    cancellation: 'Cancellable.',
    retrySafety: 'Safe to retry; reads are non-mutating.',
    partialReadBehavior: 'Not applicable; the profile is read as one unit.',
    corruptInputBehavior: 'A malformed profile file fails the refresh for this source and preserves the last valid snapshot.',
    compatibilityErrors: 'Maps an unknown objective id to the approved domain-rejection contract.',
    processIsolation: 'Runs in the desktop process.',
    cleanup: 'Releases file handles on cancel or completion.',
    representativeFixtures: ['fixtures/objective-profile/dal-b-profile.json'],
    domainRejections: ['An objective id not in the approved DO-178C Table A-1..A-10 reference set is rejected.'],
    technicalFailures: ['A malformed profile file is reported as a technical failure.'],
    acceptance: [ac('objective-profile-adapter.ac.parse', 'A configured objective-profile file lists only approved DO-178C objective ids.', 'Every objective is mapped to the canonical objective-profile schema.')],
  },
]

function adapterContent(spec: AdapterSpec): ModuleContent {
  const moduleId = spec.moduleId
  const detail: ConnectionModuleDetail = {
    externalActor: spec.externalActor,
    implementedPortId: spec.portOperationId,
    supportedFormats: spec.supportedFormats,
    inputDiscovery: spec.inputDiscovery,
    inputValidation: spec.inputValidation,
    canonicalMapping: spec.canonicalMapping,
    provenanceExtraction: spec.provenanceExtraction,
    authenticationRef: spec.authenticationRef,
    licenseOrSessionNeeds: spec.licenseOrSessionNeeds,
    timeouts: spec.timeouts,
    cancellation: spec.cancellation,
    retrySafety: spec.retrySafety,
    partialReadBehavior: spec.partialReadBehavior,
    corruptInputBehavior: spec.corruptInputBehavior,
    compatibilityErrors: spec.compatibilityErrors,
    processIsolation: spec.processIsolation,
    cleanup: spec.cleanup,
    representativeFixtures: spec.representativeFixtures,
  }
  return {
    nonResponsibilities: ['Does not decide business policy.', 'Maps every technical failure to the approved error contract instead of deciding domain outcomes itself.'],
    ownedConcerns: [`${spec.externalActor} discovery, validation, and canonical mapping`],
    excludedConcerns: ['Evidence identity', 'Domain policy', 'UI presentation'],
    requiredOperations: [],
    schemas: ioSchemas(moduleId),
    rules: [],
    invariants: [`${spec.name} never publishes a candidate that failed canonical-schema validation.`],
    behavior: {
      preconditions: ['The adapter is configured with a reachable source.'],
      postconditions: [`${spec.portOperationId} returns every discovered candidate mapped to its canonical schema.`],
      domainRejections: spec.domainRejections,
      technicalFailures: spec.technicalFailures,
      sideEffects: [],
      idempotency: 'Every read is idempotent; reading the same source twice with no change returns the same candidates.',
      cancellation: spec.cancellation,
      timeouts: spec.timeouts,
      concurrency: 'Safe for concurrent reads of different sources; one adapter instance reads its own source serially.',
      retry: spec.retrySafety,
      recovery: 'A failed read for this source never removes an already-published snapshot (§19 "last valid snapshot kept").',
      emittedEvents: [],
      consumedEvents: [],
    },
    data: baseData(moduleId, `Owns no persistent evidence; maps ${spec.externalActor} content to the canonical schema for Import and Publish.`, 'internal'),
    runtime: baseRuntime(moduleId),
    verification: baseVerification(moduleId, spec.portOperationId, spec.acceptance),
    typeSpecific: { moduleType: 'connection', detail },
    unresolvedItems: [],
  }
}

// --- shared-service (platform) modules ---------------------------------------

function evidenceStoreContent(): ModuleContent {
  const moduleId = MOD.evidenceStore
  const detail: PlatformModuleDetail = {
    storedOrScheduledResource: 'Immutable source snapshots, normalized evidence, trace records, reviews, and findings.',
    ownershipAndAccess: 'Owned exclusively by this module; every other module reaches evidence only through EvidenceStorePort.',
    consistency: 'Strongly consistent within one project; a write is visible to the next read in the same process.',
    transactionBehavior: 'One EvidenceStorePort write is one transaction; a partial write is never visible.',
    indexing: 'Indexed by canonical evidence identity and by lifecycle phase for fast lookup.',
    retention: 'Retained for the life of the project; superseded snapshots are kept for revision comparison.',
    backupAndRecovery: 'Backed up with the project workspace; recovery restores the last consistent snapshot set.',
    capacity: 'Sized for a typical DO-178C project; large binary source content is referenced, not duplicated.',
    cleanup: 'Orphaned records with no referencing snapshot are reclaimed on the next project maintenance pass.',
    healthChecks: 'Reports healthy when a read-write round trip on a canary record succeeds within the short timeout class.',
    failureInjection: 'Test double `fake-evidence-store` can simulate an unreachable store and a slow store for adapter and workflow tests.',
    testImplementation: 'An in-memory implementation backs unit and module tests; the desktop build uses the durable implementation.',
  }
  return {
    nonResponsibilities: ['Does not compute coverage or trace navigation.', 'Does not decide application-specific policy.'],
    ownedConcerns: ['Immutable evidence storage', 'Trace-record storage', 'Review and finding storage'],
    excludedConcerns: ['Evidence identity computation', 'Coverage computation'],
    requiredOperations: [],
    schemas: ioSchemas(moduleId),
    rules: [],
    invariants: ['A published snapshot is never mutated in place; a change creates a new snapshot.'],
    behavior: {
      preconditions: ['The caller holds a valid project context.'],
      postconditions: ['A successful write is durably stored before EvidenceStorePort returns.'],
      domainRejections: ['A write with no project context is rejected.'],
      technicalFailures: ['EvidenceStorePort fails when the underlying storage is unreachable.'],
      sideEffects: ['Writes are the only side effect this module has.'],
      idempotency: 'Every write is idempotent by content hash.',
      cancellation: 'A pending read is cancellable; a write, once started, always completes or fails atomically.',
      timeouts: 'Short timeout class for a single-record read or write.',
      concurrency: 'Safe for concurrent reads; writes to the same record are serialized.',
      retry: 'Safe to retry every operation.',
      recovery: 'On a technical failure, the caller sees no partial write; a retry is safe.',
      emittedEvents: [],
      consumedEvents: [],
    },
    data: baseData(moduleId, 'Owns every persistent evidence, snapshot, trace, review, and finding record.', 'confidential'),
    runtime: baseRuntime(moduleId),
    verification: baseVerification(moduleId, 'EvidenceStorePort', [
      ac('evidence-store.ac.round-trip', 'A record is written and then read back.', 'The read returns the exact written content.'),
      ac('evidence-store.ac.unreachable', 'The underlying storage is unreachable.', 'EvidenceStorePort fails with a technical failure and no partial write is visible.', 'failure'),
    ]),
    typeSpecific: { moduleType: 'platform', detail },
    unresolvedItems: [],
  }
}

function jobPackageStoreState(): StateDefinition {
  return {
    recordName: 'Job',
    states: ['queued', 'running', 'succeeded', 'failed', 'cancelled'],
    initialState: 'queued',
    finalStates: ['succeeded', 'failed', 'cancelled'],
    transitions: [
      { id: 'j1', from: 'queued', to: 'running', trigger: 'StartJob' },
      { id: 'j2', from: 'running', to: 'succeeded', trigger: 'CompleteJob' },
      { id: 'j3', from: 'running', to: 'failed', trigger: 'FailJob' },
      { id: 'j4', from: 'running', to: 'cancelled', trigger: 'CancelJob' },
    ],
  }
}

function jobPackageStoreContent(): ModuleContent {
  const moduleId = MOD.jobPackageStore
  const detail: PlatformModuleDetail = {
    storedOrScheduledResource: 'Job state, job progress, package files, package hashes, and package manifests.',
    ownershipAndAccess: 'Owned exclusively by this module; every other module reaches jobs and packages only through JobStorePort/PackageStorePort.',
    consistency: 'Strongly consistent within one project; a job state transition is visible to the next status read.',
    transactionBehavior: 'A job state transition is one transaction; a package file set is written as one atomic unit.',
    indexing: 'Indexed by job id and by package id.',
    retention: 'Job records are retained for the configured audit-trail period; package files are retained until superseded.',
    backupAndRecovery: 'Backed up with the project workspace; recovery restores the last completed job and package set.',
    capacity: 'Sized for one active refresh job and one active package job per project.',
    cleanup: 'Cancelled or failed job records older than the retention period are reclaimed.',
    healthChecks: 'Reports healthy when a read-write round trip on a canary job record succeeds within the short timeout class.',
    failureInjection: 'Test double `fake-job-package-store` can simulate an unreachable store for workflow tests.',
    testImplementation: 'An in-memory implementation backs unit and module tests; the desktop build uses the durable implementation.',
  }
  return {
    nonResponsibilities: ['Does not decide when a job starts or what a package contains.', 'Does not compute coverage or evidence identity.'],
    ownedConcerns: ['Job state and progress', 'Package file and manifest storage'],
    excludedConcerns: ['Evidence identity', 'Package content decisions'],
    requiredOperations: [],
    schemas: ioSchemas(moduleId),
    rules: [],
    invariants: ['A job transitions through queued → running → one final state and never re-enters running after a final state.'],
    behavior: {
      preconditions: ['The caller holds a valid project context.'],
      postconditions: ['GetPackageStatus always reflects the most recent completed or in-progress job for that package.'],
      domainRejections: ['StartJob is rejected for a job id that already exists.'],
      technicalFailures: ['JobStorePort and PackageStorePort fail when the underlying storage is unreachable.'],
      sideEffects: ['Writes job state transitions and, on success, package files.'],
      idempotency: 'Every provided operation is idempotent for the same job or package identity.',
      cancellation: 'CancelJob is safe to call on a running job; a queued or already-final job is unaffected.',
      timeouts: 'Short timeout class for state reads; medium timeout class for package file writes.',
      concurrency: 'Safe for concurrent reads; job state transitions for the same job are serialized.',
      retry: 'Safe to retry every operation.',
      recovery: 'A failed job leaves the previously completed package available (§22.1 "old data").',
      emittedEvents: ['event.job.succeeded', 'event.job.failed'],
      consumedEvents: [],
      states: [jobPackageStoreState()],
    },
    data: baseData(moduleId, 'Owns every job and package record.', 'internal'),
    runtime: baseRuntime(moduleId),
    verification: baseVerification(moduleId, 'JobStorePort', [
      ac('job-package-store.ac.round-trip', 'A job is started, completed, and its package is stored.', 'GetPackageStatus reflects the completed job and its package hash.'),
      ac('job-package-store.ac.unreachable', 'The underlying storage is unreachable.', 'JobStorePort and PackageStorePort fail with a technical failure.', 'failure'),
    ]),
    typeSpecific: { moduleType: 'platform', detail },
    unresolvedItems: [],
  }
}

// ---------------------------------------------------------------------------
// Module-content lookup + draft assembly
// ---------------------------------------------------------------------------

function moduleContentFor(moduleId: string): ModuleContent {
  switch (moduleId) {
    case MOD.auditWorkspace:
      return auditWorkspaceContent()
    case MOD.lifecycleExplorer:
      return lifecycleExplorerContent()
    case MOD.importAndPublish:
      return importAndPublishContent()
    case MOD.findingReview:
      return findingReviewContent()
    case MOD.packageExport:
      return packageExportContent()
    case MOD.evidenceGraph:
      return evidenceGraphContent()
    case MOD.workspaceSnapshots:
      return workspaceSnapshotsContent()
    case MOD.evidenceStore:
      return evidenceStoreContent()
    case MOD.jobPackageStore:
      return jobPackageStoreContent()
    default: {
      const spec = ADAPTER_SPECS.find((s) => s.moduleId === moduleId)
      if (!spec) throw new Error(`no module content configured for ${moduleId}`)
      return adapterContent(spec)
    }
  }
}

// ---------------------------------------------------------------------------
// Diagrams (§9.8) — applicable UML projections per module (real projectors)
// ---------------------------------------------------------------------------

const ACTIVITY_MODULE_IDS = new Set<string>([MOD.importAndPublish, MOD.findingReview, MOD.packageExport])
const STATE_MODULE_IDS = new Set<string>([MOD.workspaceSnapshots, MOD.findingReview, MOD.jobPackageStore])
const SEQUENCE_MODULE_IDS = new Set<string>([MOD.auditWorkspace, MOD.lifecycleExplorer, MOD.importAndPublish, MOD.findingReview, MOD.packageExport])
const USE_CASE_MODULE_IDS = new Set<string>([MOD.auditWorkspace, MOD.lifecycleExplorer])

function refFor(projection: DiagramProjection): DiagramProjectionRef {
  return { diagramId: projection.diagramId, kind: projection.kind, sourceRecordId: projection.sourceRecordId, sourceRevision: projection.sourceRevision }
}

function attachDiagrams(
  draft: ModuleDesignSpecification,
  architecture: SystemStructureSpecification,
  allDrafts: readonly ModuleDesignSpecification[],
  analysis: UseCaseAnalysis,
): { design: ModuleDesignSpecification; projections: DiagramProjection[] } {
  const moduleId = draft.module.moduleId
  const projections: DiagramProjection[] = []

  projections.push(projectComponentDiagram({ design: draft, architecture, allDesigns: allDrafts }))
  if (ACTIVITY_MODULE_IDS.has(moduleId)) projections.push(projectActivityDiagram(draft))
  if (STATE_MODULE_IDS.has(moduleId)) projections.push(projectStateMachineDiagram(draft))
  if (SEQUENCE_MODULE_IDS.has(moduleId)) projections.push(projectSequenceDiagram(draft))
  if (USE_CASE_MODULE_IDS.has(moduleId)) projections.push(projectUseCaseDiagram({ design: draft, analysis }))

  const blockers = projections.flatMap((p) => p.diagnostics).filter((d) => d.severity === 'blocker')
  if (blockers.length) {
    throw new Error(`sample diagrams for ${moduleId} have blocker diagnostics: ${JSON.stringify(blockers)}`)
  }

  const withDiagrams: ModuleDesignSpecification = { ...draft, diagrams: projections.map(refFor) }
  return { design: { ...withDiagrams, contentHash: designContentHash(withDiagrams) }, projections }
}

// ---------------------------------------------------------------------------
// Deterministic actor pool used by scenario runs and audit events
// ---------------------------------------------------------------------------

const REVIEWER_A = 'reviewer.morgan.blake'
const REVIEWER_B = 'reviewer.jamie.osei'
const AUDIT_LEAD_ACTOR = 'audit-lead.dana.reyes'
const AUDITOR_ACTOR = 'auditor.chris.tan'

// ---------------------------------------------------------------------------
// Top-level builder
// ---------------------------------------------------------------------------

export function buildSampleAuditHub(): SampleAuditHub {
  const applicationSpecification = buildApplicationSpecification()
  const useCaseAnalysis = buildUseCaseAnalysis()
  const architecture = buildArchitecture(applicationSpecification)

  // 1) module-design drafts, filled with §9.5/§9.6 content, derived where
  //    possible from the approved architecture via `createModuleDesignDraft`.
  const filledDrafts: ModuleDesignSpecification[] = MODULE_DEFS.map((def) => {
    const base = createModuleDesignDraft({
      projectId: PROJECT_ID,
      architecture,
      moduleId: def.moduleId,
      owner: MODULE_OWNER,
      deployableId: def.moduleId === MOD.matlabAdapter ? 'deployable.matlab-process' : 'deployable.desktop',
      runtimeAllocation: def.moduleId === MOD.matlabAdapter ? 'separate MATLAB process' : 'desktop process',
      runtimeLanguage: 'typescript',
      ownedPaths: [ownedPathOf(def.moduleId)],
    })
    const content = moduleContentFor(def.moduleId)
    const merged: ModuleDesignSpecification = {
      ...base,
      module: {
        ...base.module,
        owner: MODULE_OWNER,
        nonResponsibilities: content.nonResponsibilities,
        ownedConcerns: content.ownedConcerns,
        excludedConcerns: content.excludedConcerns,
      },
      requiredOperations: content.requiredOperations,
      schemas: content.schemas,
      rules: content.rules,
      invariants: content.invariants,
      behavior: content.behavior,
      data: content.data,
      runtime: content.runtime,
      verification: content.verification,
      typeSpecific: content.typeSpecific,
      unresolvedItems: content.unresolvedItems,
    }
    return { ...merged, contentHash: designContentHash(merged) }
  })

  // 2) diagrams — applicable UML projections per module (§9.8), computed
  //    through the real projectors so `validateUmlProjection` actually runs.
  const diagrams: DiagramProjection[] = []
  const withDiagrams: ModuleDesignSpecification[] = filledDrafts.map((draft) => {
    const attached = attachDiagrams(draft, architecture, filledDrafts, useCaseAnalysis)
    diagrams.push(...attached.projections)
    return attached.design
  })
  const diagramsByDesignId = new Map<string, DiagramProjection[]>()
  for (const projection of diagrams) {
    const list = diagramsByDesignId.get(projection.sourceRecordId) ?? []
    list.push(projection)
    diagramsByDesignId.set(projection.sourceRecordId, list)
  }

  // 3) contract registry — one contract per provided operation, compiled from
  //    each module's own behavior via the real `compileOperationContracts`,
  //    then registered and approved (§9.7, §22.2 "operationContracts").
  let registry: ContractRegistry = createContractRegistry()
  for (const design of withDiagrams) {
    const contracts = compileOperationContracts(design)
    for (const contract of contracts) {
      const registered = registerContract(registry, {
        operationId: contract.operationId,
        version: contract.version,
        providerModuleId: design.module.moduleId,
        contract,
        moduleDesigns: withDiagrams,
      })
      if (!registered.ok || !registered.registry) {
        throw new Error(`sample contract registration failed for ${contract.operationId}: ${JSON.stringify(registered.diagnostics)}`)
      }
      registry = registered.registry
      const approved = approveContract(registry, contract.operationId, contract.version, {
        approvedBy: ARCHITECT,
        authority: 'interface-engineer',
        approvedAt: at(4),
      })
      if (!approved.ok || !approved.registry) {
        throw new Error(`sample contract approval failed for ${contract.operationId}: ${JSON.stringify(approved.diagnostics)}`)
      }
      registry = approved.registry
    }
  }
  const approvedContracts: OperationContract[] = registry.contracts.filter((c) => c.status === 'approved').map((c) => c.contract)

  // 4) approve every module design's first revision (§22.3 "an approved
  //    module-design revision" is required for every module).
  const approvedModuleDesigns: Record<string, ModuleDesignSpecification> = {}
  for (const design of withDiagrams) {
    const otherDesigns = withDiagrams.filter((d) => d.module.moduleId !== design.module.moduleId)
    const diagramDiagnostics = diagramsByDesignId.get(design.id)?.flatMap((p) => p.diagnostics) ?? []
    const context: ModuleDesignCheckContext = { architecture, otherDesigns, approvedContracts, diagramDiagnostics }
    const { design: checked, evaluation } = applyModuleDesignChecks(design, context)
    if (!evaluation.passed) {
      throw new Error(`sample module ${design.module.moduleId} failed design checks: ${JSON.stringify(evaluation.diagnostics)}`)
    }
    const approval = approveModuleDesign(checked, { approvedBy: MODULE_OWNER, authority: 'module-owner', approvedAt: at(5) }, context)
    if (!approval.ok) {
      throw new Error(`sample module ${design.module.moduleId} failed to approve: ${JSON.stringify(approval.diagnostics)}`)
    }
    approvedModuleDesigns[design.module.moduleId] = approval.design
  }

  // 5) design baseline — approved `completeBaseline` (§16.6, §22.1).
  const baselineDraft = createDesignBaseline(architecture, Object.values(approvedModuleDesigns), registry.contracts, {
    baselineId: `${PROJECT_ID}.baseline`,
    revision: 'r1',
    projectId: PROJECT_ID,
  })
  const baselineApproval = approveDesignBaseline(baselineDraft, { approvedBy: PRODUCT_LEAD, authority: 'product-lead', approvedAt: at(6) })
  if (!baselineApproval.ok || !baselineApproval.baseline) {
    throw new Error(`sample design baseline failed to approve: ${JSON.stringify(baselineApproval.diagnostics)}`)
  }
  const designBaseline = baselineApproval.baseline

  // 6) policy — `completeBaseline` by default (§22.1).
  const policy = createDefaultPolicy(PROJECT_ID, PRODUCT_LEAD, at(7))

  // 7) incremental preview — a saved `incrementalModules` preview that never
  //    changes the approved baseline (§22.1, §16.7).
  const previewModeResult = changeGateMode(policy, 'incrementalModules', `${PROJECT_ID}.decision.incremental-preview`, PRODUCT_LEAD, at(8))
  if (!previewModeResult.ok || !previewModeResult.policy) {
    throw new Error(`sample incremental preview failed: ${JSON.stringify(previewModeResult.diagnostics)}`)
  }
  const firstModuleId = RECOMMENDED_ORDER[0]!
  const previewGate = evaluateBuildGate({
    policy: previewModeResult.policy,
    baseline: designBaseline,
    moduleDesign: approvedModuleDesigns[firstModuleId]!,
    moduleProgress: { useCaseAnalysisApproved: true, systemStructureApproved: true },
    contracts: registry.contracts,
    otherActiveModules: Object.values(approvedModuleDesigns)
      .filter((d) => d.module.moduleId !== firstModuleId)
      .map((d) => ({ moduleId: d.module.moduleId, ownedPaths: d.boundary.ownedPaths })),
  })
  const incrementalPreview: IncrementalPreview = { policy: previewModeResult.policy, gateForFirstModule: { moduleId: firstModuleId, result: previewGate } }

  // 8) reopen three approved modules to a draft later revision (§22.3, §9.11)
  //    while preserving the approved r1 revision unchanged.
  const evidenceGraphReopen = reopenModuleDesign(approvedModuleDesigns[MOD.evidenceGraph]!)
  const evidenceGraphQuestion: UnresolvedDesignItem = {
    id: childId(evidenceGraphReopen.draft.id, 'question', 'coverage-window'),
    description: 'Should ReportCoverage compute against the project default DAL, or the per-objective tailored DAL when they differ?',
    materiality: 'material',
  }
  const evidenceGraphDraftWithQuestion: ModuleDesignSpecification = {
    ...evidenceGraphReopen.draft,
    unresolvedItems: [...evidenceGraphReopen.draft.unresolvedItems, evidenceGraphQuestion],
  }
  const evidenceGraphChecked = applyModuleDesignChecks(evidenceGraphDraftWithQuestion, {
    architecture,
    otherDesigns: withDiagrams.filter((d) => d.module.moduleId !== MOD.evidenceGraph),
    approvedContracts,
  }).design
  if (evidenceGraphChecked.status !== 'needsInput') {
    throw new Error(`sample Evidence Graph reopened draft expected status needsInput, got ${evidenceGraphChecked.status}`)
  }

  const packageExportReopen = reopenModuleDesign(approvedModuleDesigns[MOD.packageExport]!)
  const packageExportQuestion: UnresolvedDesignItem = {
    id: childId(packageExportReopen.draft.id, 'question', 'manifest-objective-profile-version'),
    description: 'Confirm whether the package manifest should also list the objective-profile version.',
    materiality: 'nonmaterial',
  }
  const packageExportDraftWithQuestion: ModuleDesignSpecification = {
    ...packageExportReopen.draft,
    unresolvedItems: [...packageExportReopen.draft.unresolvedItems, packageExportQuestion],
  }
  const packageExportChecked = applyModuleDesignChecks(packageExportDraftWithQuestion, {
    architecture,
    otherDesigns: withDiagrams.filter((d) => d.module.moduleId !== MOD.packageExport),
    approvedContracts,
  }).design
  if (packageExportChecked.status !== 'readyForReview') {
    throw new Error(`sample Package Export reopened draft expected status readyForReview, got ${packageExportChecked.status}`)
  }

  const importAndPublishReopen = reopenModuleDesign(approvedModuleDesigns[MOD.importAndPublish]!)
  const importAndPublishChecked = applyModuleDesignChecks(importAndPublishReopen.draft, {
    architecture,
    otherDesigns: withDiagrams.filter((d) => d.module.moduleId !== MOD.importAndPublish),
    approvedContracts,
  }).design

  const reopenedModuleDesigns: Record<string, ModuleDesignSpecification> = {
    [MOD.evidenceGraph]: evidenceGraphChecked,
    [MOD.packageExport]: packageExportChecked,
    [MOD.importAndPublish]: importAndPublishChecked,
  }

  // 9) mark one non-reopened approved module stale because an upstream
  //    dependency (the reopened Evidence Graph) changed (§5.2, §9.11).
  const lifecycleExplorerStale = markStale(approvedModuleDesigns[MOD.lifecycleExplorer]!, {
    recordId: MOD.evidenceGraph,
    recordKind: 'module design',
    fromRevision: 'r1',
    toRevision: evidenceGraphChecked.revision,
    description: 'The reopened Evidence Graph design may change FollowTrace behavior that Lifecycle Explorer depends on.',
  })

  // 10) current state per module — exactly 17 entries.
  const currentByModuleId: Record<string, ModuleDesignSpecification> = { ...approvedModuleDesigns }
  currentByModuleId[MOD.evidenceGraph] = evidenceGraphChecked
  currentByModuleId[MOD.packageExport] = packageExportChecked
  currentByModuleId[MOD.importAndPublish] = importAndPublishChecked
  currentByModuleId[MOD.lifecycleExplorer] = lifecycleExplorerStale
  const moduleDesigns: ModuleDesignSpecification[] = MODULE_DEFS.map((d) => currentByModuleId[d.moduleId]!)

  // 11) session — one in-progress module-design session for the reopened,
  //     needsInput Evidence Graph revision (§9.3, §16.3).
  const evidenceGraphManifest = buildContextManifest({
    targetRecordId: evidenceGraphChecked.id,
    targetRevision: evidenceGraphChecked.revision,
    limit: 200_000,
    candidates: [
      {
        kind: 'record',
        ref: architecture.id,
        content: JSON.stringify({ id: architecture.id, revision: architecture.revision }),
        reason: 'Approved system-structure slice for this module.',
      },
      {
        kind: 'record',
        ref: approvedModuleDesigns[MOD.evidenceGraph]!.id,
        content: JSON.stringify({ id: approvedModuleDesigns[MOD.evidenceGraph]!.id, revision: approvedModuleDesigns[MOD.evidenceGraph]!.revision }),
        reason: 'Approved prior revision being revised.',
      },
      {
        kind: 'contract',
        ref: 'EvidenceStorePort@1.0.0',
        content: JSON.stringify({ operationId: 'EvidenceStorePort', version: '1.0.0' }),
        reason: 'Required dependency contract.',
      },
    ],
  })
  const evidenceGraphSession: ModuleDesignSession = {
    id: childId(PROJECT_ID, 'module-design-session', MOD.evidenceGraph),
    projectId: PROJECT_ID,
    moduleId: MOD.evidenceGraph,
    baseArchitectureRevision: architecture.revision,
    baseModuleDesignRevision: approvedModuleDesigns[MOD.evidenceGraph]!.revision,
    state: 'needsInput',
    currentStep: 'behavior',
    completedSteps: ['boundary'],
    sourceManifest: evidenceGraphManifest,
    answers: [],
    diagnostics: [
      {
        id: `MODDESIGN-MATERIAL-ITEM-OPEN:unresolvedItems.${evidenceGraphQuestion.id}`,
        code: 'MODDESIGN-MATERIAL-ITEM-OPEN',
        severity: 'blocker',
        message: `material unresolved item is open: ${evidenceGraphQuestion.description}`,
        target: `unresolvedItems.${evidenceGraphQuestion.id}`,
      },
    ],
    createdAt: at(9),
    updatedAt: at(9),
  }
  const sessions: ModuleDesignSession[] = [evidenceGraphSession]

  // 12) progress (§9.2, §16.5) — state variety via a real reopen/stale
  //     history plus one externally blocked module.
  const blockers: Record<string, string[]> = {
    [MOD.importAndPublish]: ['Awaiting approval of the reopened Evidence Graph FollowTrace contract before this module can be marked ready.'],
  }
  const progress = computeModuleDesignProgress(architecture, moduleDesigns, sessions, blockers)

  // 13) implementation waves (§22.5) and the default Copilot handoff target
  //     per wave (still one module at a time).
  function waveEntry(moduleId: string, batchEligible: boolean): ImplementationWavePlan['waves'][number]['modules'][number] {
    const design = approvedModuleDesigns[moduleId]
    if (!design) throw new Error(`no approved design for wave module ${moduleId}`)
    return {
      moduleId,
      directDependencyIds: design.boundary.directDependencyIds,
      allowedPaths: design.boundary.ownedPaths,
      sharedResources: moduleId === MOD.matlabAdapter ? ['MATLAB session pool'] : [],
      batchEligible,
      blockingUnapprovedContracts: [],
    }
  }
  const wavePlan: ImplementationWavePlan = {
    projectId: PROJECT_ID,
    architectureRevision: architecture.revision,
    waves: [
      { wave: 1, modules: [waveEntry(MOD.evidenceStore, true), waveEntry(MOD.jobPackageStore, true)], blockingCycles: [] },
      { wave: 2, modules: [waveEntry(MOD.evidenceGraph, true), waveEntry(MOD.workspaceSnapshots, true)], blockingCycles: [] },
      { wave: 3, modules: ADAPTER_MODULE_IDS.map((id) => waveEntry(id, true)), blockingCycles: [] },
      { wave: 4, modules: [waveEntry(MOD.importAndPublish, true), waveEntry(MOD.findingReview, true), waveEntry(MOD.packageExport, true)], blockingCycles: [] },
      { wave: 5, modules: [waveEntry(MOD.lifecycleExplorer, true), waveEntry(MOD.auditWorkspace, true)], blockingCycles: [] },
      {
        wave: 6,
        modules: [
          {
            moduleId: 'composition.entry-points',
            directDependencyIds: MODULE_DEFS.map((d) => d.moduleId),
            allowedPaths: ['apps/desktop/src/main/', 'apps/desktop/src/composition/'],
            sharedResources: ['Composition root'],
            batchEligible: false,
            blockingUnapprovedContracts: [],
          },
        ],
        blockingCycles: [],
      },
      {
        wave: 7,
        modules: [
          {
            moduleId: 'verification.end-to-end-scenarios',
            directDependencyIds: MODULE_DEFS.map((d) => d.moduleId),
            allowedPaths: ['apps/desktop/e2e/audit-hub/'],
            sharedResources: ['Test environment'],
            batchEligible: false,
            blockingUnapprovedContracts: [],
          },
        ],
        blockingCycles: [],
      },
    ],
    autoDispatch: false,
  }
  const copilotHandoffTargets: { wave: number; moduleId: string }[] = [
    { wave: 1, moduleId: MOD.evidenceStore },
    { wave: 2, moduleId: MOD.evidenceGraph },
    { wave: 3, moduleId: MOD.filesystemAdapter },
    { wave: 4, moduleId: MOD.importAndPublish },
    { wave: 5, moduleId: MOD.auditWorkspace },
    { wave: 6, moduleId: 'composition.entry-points' },
    { wave: 7, moduleId: 'verification.end-to-end-scenarios' },
  ]

  // 14) packets (§11.2, §11.3) — one design packet for the module under
  //     revision, one implementation packet for an approved module.
  const evidenceGraphPacketResult = buildModuleDesignPacket({
    projectId: PROJECT_ID,
    moduleId: MOD.evidenceGraph,
    moduleType: 'domain',
    architectureRevision: architecture.revision,
    architectureHash: architecture.contentHash,
    systemSlice: {
      moduleSummaries: MODULE_DEFS.map((d) => ({ moduleId: d.moduleId, name: d.name, responsibility: d.responsibility })),
      dependencyEdges: architecture.dependencyEdges.filter((e) => e.fromModuleId === MOD.evidenceGraph || e.toModuleId === MOD.evidenceGraph),
    },
    useCaseIds: evidenceGraphChecked.trace.useCaseIds,
    scenarioStepIds: evidenceGraphChecked.trace.scenarioStepIds,
    contextManifest: evidenceGraphManifest,
    idempotencyKey: 'sample.evidence-graph.reopen.1',
    createdAt: at(10),
  })
  if (!evidenceGraphPacketResult.ok || !evidenceGraphPacketResult.packet) {
    throw new Error(`sample module-design packet failed: ${JSON.stringify(evidenceGraphPacketResult.diagnostics)}`)
  }

  const evidenceStoreDesign = approvedModuleDesigns[MOD.evidenceStore]!
  const evidenceStoreManifest = buildContextManifest({
    targetRecordId: evidenceStoreDesign.id,
    targetRevision: evidenceStoreDesign.revision,
    limit: 200_000,
    candidates: [
      { kind: 'record', ref: evidenceStoreDesign.id, content: JSON.stringify({ id: evidenceStoreDesign.id, revision: evidenceStoreDesign.revision }), reason: 'Approved module design.' },
      { kind: 'contract', ref: 'EvidenceStorePort@1.0.0', content: JSON.stringify({ operationId: 'EvidenceStorePort' }), reason: 'Provided contract.' },
    ],
  })
  const implementationPacketResult = buildModuleImplementationPacket({
    projectId: PROJECT_ID,
    design: evidenceStoreDesign,
    contractRegistry: registry,
    architectureRevision: architecture.revision,
    architectureHash: architecture.contentHash,
    contextManifest: evidenceStoreManifest,
    implementationSteps: [
      'Implement EvidenceStorePort per the approved contract.',
      'Add the in-memory test double for unit and module tests.',
      'Wire the durable implementation for the desktop build.',
    ],
    acceptanceCases: evidenceStoreDesign.verification.acceptanceCases,
    testCommands: evidenceStoreDesign.verification.configuredCommands,
    requiredEvidence: evidenceStoreDesign.verification.requiredEvidence,
    idempotencyKey: 'sample.evidence-store.implement.1',
    passKind: 'initial',
    createdAt: at(11),
  })
  if (!implementationPacketResult.ok || !implementationPacketResult.packet) {
    throw new Error(`sample implementation packet failed: ${JSON.stringify(implementationPacketResult.diagnostics)}`)
  }
  const implementationPacket = implementationPacketResult.packet
  const moduleImplementationSpecificationExample = compileModuleImplementationSpecification(evidenceStoreDesign)

  // 15) one returned delta and its inspection (§11.5, §11.6). Authored
  //     directly in the same deterministic shape `deterministicTestProvider`
  //     would produce — see the module-header deviation note.
  const deltaContent =
    'Evidence Store implementation notes.\n\nImplemented EvidenceStorePort with an in-memory test double and the durable adapter.\n'
  const deltaFilePath = `${ownedPathOf(MOD.evidenceStore)}IMPLEMENTATION-NOTES.md`
  const returnedDeltaWithoutHash: Omit<ReturnedDelta, 'contentHash'> = {
    schemaVersion: '1.0',
    deltaId: childId(implementationPacket.packetId, 'delta', '1'),
    packetId: implementationPacket.packetId,
    baseRevision: implementationPacket.moduleDesignRevision,
    baseHash: implementationPacket.moduleDesignHash,
    fileChanges: [{ path: deltaFilePath, action: 'create', content: deltaContent, contentHash: sha256Hex(deltaContent) }],
    recordChanges: [{ recordId: MOD.evidenceStore, kind: 'note', summary: 'Implemented EvidenceStorePort.' }],
    testResults: [
      { command: 'pnpm --filter @engineering-ui-kit/core test -- mod.evidence-store', passed: true, summary: 'All Evidence Store tests passed.' },
    ],
    assumptions: ['The durable storage backend follows the existing project persistence pattern.'],
    unresolvedIssues: [],
    requestedScopeChanges: [],
    evidenceFiles: [`${ownedPathOf(MOD.evidenceStore)}test-log.txt`],
    returnedAt: at(12),
  }
  const returnedDelta: ReturnedDelta = { ...returnedDeltaWithoutHash, contentHash: canonicalHash(returnedDeltaWithoutHash) }
  const inspection = inspectDelta(
    returnedDelta,
    implementationPacket,
    { workspaceRevision: implementationPacket.moduleDesignRevision, workspaceHash: implementationPacket.moduleDesignHash },
    { now: at(13), moduleDesign: evidenceStoreDesign, rollbackPointRef: 'workspace-snapshot.pre-evidence-store-implementation' },
  )
  if (!inspection.accepted) {
    throw new Error(`sample returned delta was not accepted: ${JSON.stringify(inspection.rejectionReasons)}`)
  }

  // 16) impact examples (§10, §22.3).
  const impactWorld: ImpactWorld = {
    useCaseAnalysis,
    architecture,
    moduleDesigns: Object.values(approvedModuleDesigns),
    contracts: registry.contracts.map((c) => ({ operationId: c.operationId, version: c.version, providerModuleId: c.providerModuleId })),
  }
  const evidenceGraphImpact = analyzeDesignChange({
    projectId: PROJECT_ID,
    changeKind: 'operationBehavior',
    initiatingRecordId: evidenceGraphChecked.id,
    initiatingRevision: evidenceGraphChecked.revision,
    description: 'Evidence Graph FollowTrace behavior may change while the reopened design is under review.',
    target: { moduleId: MOD.evidenceGraph, operationId: 'FollowTrace' },
    world: impactWorld,
    createdAt: at(14),
  })
  const packageExportBaselineImpact = analyzeDesignChange({
    projectId: PROJECT_ID,
    changeKind: 'operationBehavior',
    initiatingRecordId: designBaseline.id,
    initiatingRevision: designBaseline.revision,
    description: 'The baseline changed after Package Export built a package from the prior revision; the package result becomes old.',
    target: { moduleId: MOD.packageExport, operationId: 'CreateAuditPackage' },
    world: impactWorld,
    createdAt: at(15),
  })
  const impactExamples: DesignImpactRecord[] = [evidenceGraphImpact, packageExportBaselineImpact]

  // 17) scenario runs (§14) — one automated run per approved main/alternate/
  //     failure/recovery scenario, with §14.2/§14.3 evidence and identity.
  const scenarioTestPlan = buildScenarioTestPlan(useCaseAnalysis)
  const scenarioById = new Map(
    useCaseAnalysis.useCases.flatMap((useCase) => useCase.scenarios.map((scenario) => [scenario.id, { useCaseId: useCase.id, scenario }] as const)),
  )
  const refreshUseCaseId = childId(ANALYSIS_ID, 'use-case', 'refresh-evidence')
  const browseUseCaseId = childId(ANALYSIS_ID, 'use-case', 'browse-lifecycle')
  const exportUseCaseId = childId(ANALYSIS_ID, 'use-case', 'export-package')
  const FAILED_SCENARIO_IDS = new Set([childId(refreshUseCaseId, 'scenario', 'source-unreachable'), childId(browseUseCaseId, 'scenario', 'broken-trace')])
  const exportMainScenarioId = childId(exportUseCaseId, 'scenario', 'main')

  const approvedRevisionsAtRunTime: Record<string, string> = Object.fromEntries(MODULE_DEFS.map((d) => [d.moduleId, 'r1']))

  function identityFor(moduleDesignRevisions: Record<string, string>): ScenarioRun['identity'] {
    return scenarioRunIdentity({
      useCaseAnalysisRevision: useCaseAnalysis.revision,
      applicationRevision: applicationSpecification.revision,
      systemStructureRevision: architecture.revision,
      moduleDesignRevisions,
      implementationRevisions: Object.fromEntries(MODULE_DEFS.map((d) => [d.moduleId, 'impl-r1'])),
      connectionRevision: 'connection-r1',
      build: 'build.2026.07.01-1',
      sourceRevision: 'git.sha.deadbeef',
      environment: 'sample-desktop',
      testDataRevision: 'fixtures-r1',
      runner: 'playwright',
    })
  }

  function buildStepsEvidence(scenario: UseCaseScenario, startMinute: number, failStepIds: Set<string>): ScenarioStepEvidence[] {
    const plan = buildEvidenceExpectationPlan(scenario)
    const policyByStep = new Map(plan.policies.map((p) => [p.stepId, p]))
    return scenario.steps.map((s, index) => {
      const outcome: ScenarioStepEvidence['outcome'] = failStepIds.has(s.id) ? 'failed' : 'passed'
      const startedAt = at(startMinute + index * 2)
      const endedAt = at(startMinute + index * 2 + 1)
      const policy = policyByStep.get(s.id)
      const base = {
        stepId: s.id,
        action: s.action,
        expectedResult: s.expectedResult,
        actualResult: outcome === 'passed' ? s.expectedResult : `Did not match the expected result: ${s.expectedResult}`,
        startedAt,
        endedAt,
        outcome,
        evidenceHash: sha256Hex(`${s.id}:${outcome}`),
      }
      if (policy?.evidenceKind === 'screenshot') {
        const withScreenshot: ScenarioStepEvidence = {
          ...base,
          screenshotRef: `evidence/screenshots/${s.id}.png`,
          screenshotMetadata: {
            browser: 'chromium',
            viewport: '1280x800',
            operatingSystem: 'linux',
            theme: 'light',
            locale: 'en-US',
            build: 'build.2026.07.01-1',
            environment: 'sample-desktop',
            testDataRevision: 'fixtures-r1',
          },
        }
        return withScreenshot
      }
      const withStructured: ScenarioStepEvidence = {
        ...base,
        structuredEvidenceRef: `evidence/structured/${s.id}.json`,
        ...(policy?.screenshotNotApplicableReason ? { screenshotNotApplicableReason: policy.screenshotNotApplicableReason } : {}),
      }
      return withStructured
    })
  }

  let runClock = 20
  const scenarioRuns: ScenarioRun[] = scenarioTestPlan.entries.map((entry) => {
    const found = scenarioById.get(entry.scenarioId)
    if (!found) throw new Error(`sample scenario test plan referenced an unknown scenario: ${entry.scenarioId}`)
    const isFailedRun = FAILED_SCENARIO_IDS.has(entry.scenarioId)
    const failStepIds = new Set<string>()
    if (isFailedRun) {
      const lastStep = found.scenario.steps[found.scenario.steps.length - 1]
      if (lastStep) failStepIds.add(lastStep.id)
    }
    const startMinute = runClock
    runClock += found.scenario.steps.length * 2 + 2
    const steps = buildStepsEvidence(found.scenario, startMinute, failStepIds)
    const outcome: ScenarioRun['outcome'] = isFailedRun ? 'failed' : 'passed'
    const withoutHash: Omit<ScenarioRun, 'contentHash'> = {
      schemaVersion: '1.0',
      runId: childId(PROJECT_ID, 'scenario-run', `${entry.scenarioId}.1`),
      projectId: PROJECT_ID,
      scenarioId: entry.scenarioId,
      useCaseId: entry.useCaseId,
      identity: identityFor(approvedRevisionsAtRunTime),
      steps,
      outcome,
      startedAt: steps[0]?.startedAt ?? at(startMinute),
      completedAt: steps[steps.length - 1]?.endedAt ?? at(startMinute),
      evidenceHashes: steps.map((s) => s.evidenceHash).filter((h): h is string => Boolean(h)),
    }
    return { ...withoutHash, contentHash: canonicalHash(withoutHash) }
  })

  const packageExportRun = scenarioRuns.find((r) => r.scenarioId === exportMainScenarioId)
  if (!packageExportRun) throw new Error('sample scenario runs are missing the Export package main scenario run')
  const currentModuleRevisions = Object.fromEntries(moduleDesigns.map((d) => [d.module.moduleId, d.revision]))
  const packageExportCurrentState = currentResultState(packageExportRun, { moduleDesignRevisions: currentModuleRevisions })
  if (packageExportCurrentState !== 'old') {
    throw new Error(`sample Package Export result expected state "old" after the baseline change, got ${packageExportCurrentState}`)
  }

  // 18) module verification results (custom sample shape — §19 needs a
  //     `timeout` outcome no canonical contract carries) and the five
  //     required §22.3 defects.
  function vr(moduleId: string, caseId: string, outcome: ModuleVerificationResult['outcome'], summary: string, evidenceRefs: string[], recordedAt: string): ModuleVerificationResult {
    return { moduleId, caseId, outcome, summary, evidenceRefs, recordedAt }
  }

  const evidenceGraphBrokenTrace = vr(
    MOD.evidenceGraph,
    'evidence-graph.ac.broken-trace',
    'failed',
    'FollowTrace could not resolve LLR-042 to its Simulink model element; the model element was deleted from the source model.',
    ['evidence/defects/evidence-graph-broken-trace.json'],
    at(30),
  )
  const matlabAdapterTimeout = vr(
    MOD.matlabAdapter,
    'matlab-adapter.ac.timeout',
    'timeout',
    'Loading timeout-model.slx exceeded the configured MATLAB session timeout; the last valid published snapshot for that model was kept (§19).',
    ['evidence/defects/matlab-adapter-timeout.json'],
    at(31),
  )
  const spreadsheetInvalidMapping = vr(
    MOD.spreadsheetAdapter,
    'spreadsheet-adapter.ac.invalid-mapping',
    'failed',
    'Sheet "Requirements" column mapping expected "Requirement ID" at column C but found "Req Id" at column D; the sheet was rejected before any row was published.',
    ['evidence/defects/spreadsheet-adapter-invalid-mapping.json'],
    at(32),
  )
  const findingReviewRejectedDecision: DesignAuditEvent = {
    eventId: childId(PROJECT_ID, 'audit-event', 'finding-review-reject-nonindependent-1'),
    projectId: PROJECT_ID,
    actor: REVIEWER_A,
    operation: 'SubmitFindingDecision',
    targetRecordId: 'finding.fnd-014',
    baseRevision: approvedModuleDesigns[MOD.findingReview]!.revision,
    baseHash: approvedModuleDesigns[MOD.findingReview]!.contentHash,
    at: at(33),
    outcome: 'rejected',
    diagnosticCodes: ['FINDING-REVIEW-NOT-INDEPENDENT'],
    evidenceRefs: ['evidence/defects/finding-review-rejected-decision.json'],
  }
  void REVIEWER_B
  void AUDIT_LEAD_ACTOR
  void AUDITOR_ACTOR

  const verificationResults: Record<string, ModuleVerificationResult[]> = {}
  for (const design of moduleDesigns) {
    verificationResults[design.module.moduleId] = design.verification.acceptanceCases.map((c, index) =>
      vr(design.module.moduleId, c.id, 'passed', `${c.description} -> ${c.expectedOutcome}`, [`evidence/verification/${design.module.moduleId}.${index}.json`], at(40 + index)),
    )
  }
  verificationResults[MOD.evidenceGraph] = [...(verificationResults[MOD.evidenceGraph] ?? []), evidenceGraphBrokenTrace]
  verificationResults[MOD.matlabAdapter] = [...(verificationResults[MOD.matlabAdapter] ?? []), matlabAdapterTimeout]
  verificationResults[MOD.spreadsheetAdapter] = [...(verificationResults[MOD.spreadsheetAdapter] ?? []), spreadsheetInvalidMapping]

  const auditEvents: DesignAuditEvent[] = [findingReviewRejectedDecision]

  const defects: SampleDefects = {
    evidenceGraphBrokenTrace,
    matlabAdapterTimeout,
    spreadsheetInvalidMapping,
    findingReviewRejectedDecision,
    packageExportOldResult: { run: packageExportRun, currentState: packageExportCurrentState },
  }

  // 19) one diagram-layout example (§9.8/§15 — reuses the real layout engine).
  const auditWorkspaceComponentDiagram = diagrams.find(
    (d) => d.sourceRecordId === approvedModuleDesigns[MOD.auditWorkspace]!.id && d.kind === 'component',
  )
  if (!auditWorkspaceComponentDiagram) throw new Error('sample is missing the Audit Workspace component diagram')
  const diagramLayoutExample = layoutDiagram(auditWorkspaceComponentDiagram, 'wide')

  const syntheticDataStatement =
    'This is synthetic sample data for the DO-178C Audit Hub. Every actor, evidence item, finding, and package below is invented for demonstration only; it is not real audit evidence.'

  return {
    projectId: PROJECT_ID,
    syntheticDataStatement,
    useCaseAnalysis,
    applicationSpecification,
    architecture,
    moduleDesigns,
    approvedModuleDesigns,
    reopenedModuleDesigns,
    operationContracts: registry,
    sessions,
    designBaseline,
    policy,
    incrementalPreview,
    progress,
    recommendedOrder: RECOMMENDED_ORDER,
    wavePlan,
    copilotHandoffTargets,
    diagrams,
    diagramLayoutExample,
    packets: { moduleDesignPacket: evidenceGraphPacketResult.packet, implementationPacket },
    moduleImplementationSpecificationExample,
    returnedDeltas: [returnedDelta],
    inspections: [inspection],
    impactExamples,
    scenarioTestPlan,
    scenarioRuns,
    verificationResults,
    auditEvents,
    defects,
  }
}
