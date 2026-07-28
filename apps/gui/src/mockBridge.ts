/**
 * In-memory bridge used when the renderer runs outside Electron (browser dev
 * and qualitative UI validation). Behavior mirrors the real IPC handlers
 * closely enough to exercise every view state, including warning and blocked
 * overlay verdicts.
 */

import type {
  ApplicationSpecification,
  AppliedFiles,
  ArchitectureSpecification,
  AttentionItem,
  DeployableKind,
  EvidenceCapture,
  FoundationPlan,
  FreshnessRecord,
  FrontendBinding,
  HandoffRun,
  InboundBinding,
  InterviewPacket,
  ModuleManifest,
  ModuleDesignSession,
  ModuleDesignSpecification,
  ModuleInterviewResponse,
  OperationContract,
  OverlayInspectionSummary,
  ProjectSteLexicon,
  Project,
  Settings,
  VerificationResult,
  CapabilityIntegrationState,
  CapabilityRunScope,
  GenerationApplyRecord,
  GenerationPlan,
  ConnectionVerificationRecord,
  ArtifactReference,
  ScenarioRunRecord,
} from '@engineering-ui-kit/core'
import {
  buildNeedsAttention,
  buildRunCompletionRecord,
  calculateFreshness,
  compileFrontendBrief,
  deriveProjectWorkOverview,
  analyzePreviewPreflight,
  deltaQueueState,
  assertTargetExportable,
  evaluateBindingApprovalGate,
  evaluateArchitectureApplicationLink,
  evaluateArchitectureGate,
  evaluateArchitectureProposal,
  evaluateInboundBindingSte,
  evaluateModuleGate,
  evaluateModuleInterview,
  implementationWaveDeliverable,
  planImplementationWaves,
  proposeArchitectureModuleBatch,
  proposeFoundation,
  canonicalHash,
  compileScenarioDefinitions,
  createModuleDesignDraft,
  createModuleDesignSession,
  createScenarioRun,
  evaluateModuleDesign,
  evaluateProductGate,
  finalizeScenarioRun,
  importProductInterviewResponse,
  projectModuleDiagrams,
  recordScenarioStep,
  runModuleVerification,
  withStePrompt,
  createProjectSteLexicon,
} from '@engineering-ui-kit/core/browser'
import type { BuildPacketResult, CapabilityDeployableSummary, InboundBindingReadRecord, EuikBridge, PrepareContextResult, RunEvidence, TaskPacketFields } from './bridge'
import { validateInboundBindingDraft } from './views/capabilities/inbound/inboundBinding'
import do178ApplicationRecord from '../../../examples/do178-audit-hub/capabilities/approved/application.json'
import do178ArchitectureRecord from '../../../examples/do178-audit-hub/capabilities/approved/architecture.json'
import do178AssuranceModuleRecord from '../../../examples/do178-audit-hub/capabilities/approved/module-specifications/mod.assurance-workflow.json'
import do178AuditExperienceModuleRecord from '../../../examples/do178-audit-hub/capabilities/approved/module-specifications/mod.audit-experience.json'
import do178EvidenceGraphModuleRecord from '../../../examples/do178-audit-hub/capabilities/approved/module-specifications/mod.evidence-graph.json'
import do178EvidenceStoreModuleRecord from '../../../examples/do178-audit-hub/capabilities/approved/module-specifications/mod.evidence-store.json'
import do178ExternalAdaptersModuleRecord from '../../../examples/do178-audit-hub/capabilities/approved/module-specifications/mod.external-adapters.json'
import do178IngestionPublicationModuleRecord from '../../../examples/do178-audit-hub/capabilities/approved/module-specifications/mod.ingestion-publication.json'
import do178LifecycleExplorerModuleRecord from '../../../examples/do178-audit-hub/capabilities/approved/module-specifications/mod.lifecycle-explorer.json'
import do178SampleWorkspaceModuleRecord from '../../../examples/do178-audit-hub/capabilities/approved/module-specifications/mod.sample-workspace.json'
import do178WorkspaceSnapshotsModuleRecord from '../../../examples/do178-audit-hub/capabilities/approved/module-specifications/mod.workspace-snapshots.json'
import do178AssuranceDesignRecord from '../../../examples/do178-audit-hub/capabilities/approved/module-designs/mod.assurance-workflow.json'
import do178AuditExperienceDesignRecord from '../../../examples/do178-audit-hub/capabilities/approved/module-designs/mod.audit-experience.json'
import do178EvidenceGraphDesignRecord from '../../../examples/do178-audit-hub/capabilities/approved/module-designs/mod.evidence-graph.json'
import do178EvidenceStoreDesignRecord from '../../../examples/do178-audit-hub/capabilities/approved/module-designs/mod.evidence-store.json'
import do178ExternalAdaptersDesignRecord from '../../../examples/do178-audit-hub/capabilities/approved/module-designs/mod.external-adapters.json'
import do178WorkspaceSnapshotsDesignRecord from '../../../examples/do178-audit-hub/capabilities/approved/module-designs/mod.workspace-snapshots.json'
import {
  buildDo178ApplicationWorkflows,
  buildDo178UseCases,
  buildDo178WorkflowAllocations,
} from './do178BehaviorFixture'

type CapProjectState = {
  initializedAt: string
  steLexicon?: ProjectSteLexicon
  applicationDraft?: ApplicationSpecification
  applicationApproved?: ApplicationSpecification
  architectureDraft?: ArchitectureSpecification
  architectureApproved?: ArchitectureSpecification
  moduleDrafts: Map<string, ModuleManifest>
  moduleApproved: Map<string, ModuleManifest>
  moduleInterviewDrafts: Map<string, ModuleInterviewResponse>
  moduleInterviewApproved: Map<string, ModuleInterviewResponse>
  moduleDesignDrafts: Map<string, ModuleDesignSpecification>
  moduleDesignApproved: Map<string, ModuleDesignSpecification>
  moduleDesignSessions: Map<string, ModuleDesignSession>
  scenarioRuns: Map<string, ScenarioRunRecord>
  scenarioEvidence: Map<string, { reference: ArtifactReference; base64: string }>
  bindingDrafts: Map<string, FrontendBinding>
  bindingApproved: Map<string, FrontendBinding>
  freshness: Map<string, FreshnessRecord>
  /** CAP-ERA-001 §5.1/§12.4 — deployables this mock synthesizes for Build entry points (WP5B/WP7 own real generation-time deployables). */
  deployables: Map<string, CapabilityDeployableSummary>
  inboundBindingDrafts: Map<string, InboundBinding>
  inboundBindingApproved: Map<string, InboundBinding>
  /** WP5A — the project's single foundation-planning draft/approved record (CAP-TEST-074/075). */
  foundationDraft?: FoundationPlan
  foundationApproved?: FoundationPlan
  generationPlans: Map<string, GenerationPlan>
  generationApplies: Map<string, GenerationApplyRecord>
  connectionVerifications: Map<string, ConnectionVerificationRecord>
  capabilityRuns: Map<string, CapabilityRunScope>
}

/* 4x3 placeholder PNGs (blue-ish before, teal-ish after) for evidence mocks. */
const MOCK_BEFORE_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPgF9cCAACJAFEcS6mRAAAAAElFTkSuQmCC'
const MOCK_AFTER_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPgndIBAAHbASoDVGnEAAAAAElFTkSuQmCC'

const DEFAULT_SETTINGS: Settings = {
  defaultProjectFolder: '/workspace/projects',
  defaultOutputFolder: '/workspace/output',
  maxCopilotUploads: 3,
  preferredTemplate: 'Standard Web App',
  includeScreenshotsByDefault: true,
  includeBuildTestResultsByDefault: true,
  requireManualReviewBeforeApply: true,
  confirmOverwriteExistingFiles: true,
  warnOnDirtyRepo: true,
  warnWhenOverlayChangesMoreThanFiles: 10,
  defaultCommandTimeoutMinutes: 10,
}

export function installMockBridge(): EuikBridge {
  let settings = { ...DEFAULT_SETTINGS }
  const now = () => new Date().toISOString()
  const projects = new Map<string, Project>()
  const runs = new Map<string, HandoffRun>()
  const verificationByRun = new Map<string, VerificationResult[]>()
  const completionByRun = new Map<string, import('@engineering-ui-kit/core').RunCompletionRecord>()
  let lastPacketFields: TaskPacketFields | null = null
  const mockFeedback: { at: string; text: string }[] = []

  const evidenceCaptured = new Map<string, { before?: string; after?: string }>()
  const capByProject = new Map<string, CapProjectState>()

  function seedPlantOpsWorkflow(state: CapProjectState) {
    const application: ApplicationSpecification = {
      schemaVersion: '1.0',
      projectId: 'plantops-sample',
      id: 'app.plantops',
      revision: '2.0.0',
      status: 'approved',
      purpose: 'Plan, assign, and complete maintenance work with auditable evidence.',
      outcomes: ['Planners can release valid work orders.', 'Technicians can complete assigned work with evidence.'],
      actors: [
        { id: 'planner', text: 'Maintenance planner' },
        { id: 'technician', text: 'Field technician' },
        { id: 'supervisor', text: 'Maintenance supervisor' },
        { id: 'auditor', text: 'Compliance auditor' },
      ],
      goals: [
        { id: 'goal-plan', text: 'Release a safe, complete work order' },
        { id: 'goal-complete', text: 'Complete assigned maintenance with evidence' },
      ],
      useCases: [
        { id: 'uc-release-work-order', text: 'Release a work order' },
        { id: 'uc-complete-work-order', text: 'Complete assigned maintenance' },
        { id: 'uc-review-evidence', text: 'Review maintenance evidence' },
      ],
      scenarios: [],
      useCaseDefinitions: [{
        id: 'uc-release-work-order',
        name: 'Release work order',
        actorIds: ['planner', 'supervisor'],
        trigger: 'A planner opens a draft work order that is ready for scheduling.',
        preconditions: ['The asset exists.', 'Required safety information is available.'],
        mainFlow: [
          {
            id: 'uc-release:step:review',
            order: 1,
            actorId: 'planner',
            action: 'Review work scope',
            expectedResult: 'The application presents a complete release checklist.',
            inputIds: ['work-order-draft'],
            outputIds: ['release-checklist'],
            ruleIds: ['rule-safety'],
            evidencePolicy: 'screenshot',
          },
          {
            id: 'uc-release:step:validate',
            order: 2,
            action: 'Check release constraints',
            expectedResult: 'Every blocking omission is reported without changing the draft.',
            inputIds: ['release-checklist'],
            outputIds: ['validation-result'],
            ruleIds: ['rule-safety'],
            evidencePolicy: 'structured',
          },
          {
            id: 'uc-release:step:release',
            order: 3,
            actorId: 'planner',
            action: 'Schedule work order',
            expectedResult: 'The schedule and technician assignment are held for this work order.',
            inputIds: ['validation-result'],
            outputIds: ['reserved-maintenance-window'],
            ruleIds: ['rule-safety'],
            evidencePolicy: 'either',
          },
          {
            id: 'uc-release:step:approve',
            order: 4,
            actorId: 'supervisor',
            action: 'Approve release plan',
            expectedResult: 'Supervisor approval is bound to the reviewed revision.',
            inputIds: ['reserved-maintenance-window'],
            outputIds: ['approved-release-plan'],
            ruleIds: ['rule-safety'],
            evidencePolicy: 'structured',
          },
          {
            id: 'uc-release:step:record',
            order: 5,
            action: 'Record release decision',
            expectedResult: 'The audit ledger records the actor, revision, decision, and controls.',
            inputIds: ['approved-release-plan'],
            outputIds: ['release-audit-record'],
            ruleIds: ['rule-safety'],
            evidencePolicy: 'structured',
          },
          {
            id: 'uc-release:step:notify',
            order: 6,
            action: 'Publish work order',
            expectedResult: 'The work order becomes released and assigned technicians are notified.',
            inputIds: ['release-audit-record'],
            outputIds: ['released-work-order'],
            ruleIds: ['rule-safety'],
            evidencePolicy: 'screenshot',
          },
        ],
        alternatePaths: [],
        failurePaths: [{
          id: 'uc-release:failure:missing-safety',
          name: 'Block unsafe release',
          kind: 'failure',
          trigger: 'Validation finds a missing safety requirement.',
          preconditions: [],
          steps: [{
            id: 'uc-release:step:block',
            order: 1,
            action: 'Block unsafe release',
            expectedResult: 'The draft remains unchanged and the planner sees the corrective action.',
            inputIds: ['validation-result'],
            outputIds: ['release-rejection'],
            ruleIds: ['rule-safety'],
            evidencePolicy: 'screenshot',
          }],
          outcome: 'Release is blocked without losing the planner’s work.',
        }],
        recoveryPaths: [{
          id: 'uc-release:recovery:correct',
          name: 'Correct release draft',
          kind: 'recovery',
          trigger: 'The planner supplies the missing safety information.',
          preconditions: [],
          steps: [{
            id: 'uc-release:step:retry',
            order: 1,
            actorId: 'planner',
            action: 'Correct release draft',
            expectedResult: 'The same work order is revalidated with the corrections preserved.',
            inputIds: ['release-rejection'],
            outputIds: ['validation-result'],
            ruleIds: ['rule-safety'],
            evidencePolicy: 'either',
          }],
          outcome: 'The corrected order can continue through the main release path.',
        }],
        ruleIds: ['rule-safety'],
        inputIds: ['work-order-draft'],
        outputIds: ['released-work-order'],
        acceptanceCaseIds: ['accept-release'],
        sourceRefs: ['source-ops'],
      }, {
        id: 'uc-complete-work-order',
        name: 'Complete assigned maintenance',
        actorIds: ['technician', 'supervisor'],
        trigger: 'A technician opens a released work order assigned to their field team.',
        preconditions: ['The work order is released.', 'The technician is assigned.'],
        mainFlow: [
          {
            id: 'uc-complete:step:start',
            order: 1,
            actorId: 'technician',
            action: 'Start maintenance task',
            expectedResult: 'The work order enters in-progress state.',
            inputIds: ['released-work-order'],
            outputIds: ['active-work-order'],
            ruleIds: ['rule-safety'],
            evidencePolicy: 'structured',
          },
          {
            id: 'uc-complete:step:evidence',
            order: 2,
            actorId: 'technician',
            action: 'Record completion evidence',
            expectedResult: 'Evidence remains linked to the exact task revision.',
            inputIds: ['active-work-order'],
            outputIds: ['completion-evidence'],
            ruleIds: ['rule-safety'],
            evidencePolicy: 'screenshot',
          },
          {
            id: 'uc-complete:step:review',
            order: 3,
            actorId: 'supervisor',
            action: 'Inspect completion evidence',
            expectedResult: 'Blocking exceptions remain visible before closure.',
            inputIds: ['completion-evidence'],
            outputIds: ['completion-review'],
            ruleIds: ['rule-safety'],
            evidencePolicy: 'either',
          },
          {
            id: 'uc-complete:step:close',
            order: 4,
            actorId: 'supervisor',
            action: 'Close work order',
            expectedResult: 'The order is completed once and its evidence becomes immutable.',
            inputIds: ['completion-review'],
            outputIds: ['completed-work-order'],
            ruleIds: ['rule-safety'],
            evidencePolicy: 'structured',
          },
        ],
        alternatePaths: [],
        failurePaths: [],
        recoveryPaths: [],
        ruleIds: ['rule-safety'],
        inputIds: ['released-work-order'],
        outputIds: ['completed-work-order'],
        acceptanceCaseIds: ['accept-complete'],
        sourceRefs: ['source-ops'],
      }, {
        id: 'uc-review-evidence',
        name: 'Review maintenance evidence',
        actorIds: ['auditor', 'supervisor'],
        trigger: 'An authorized reviewer opens a completed maintenance record.',
        preconditions: ['A completed work order and immutable audit record exist.'],
        mainFlow: [
          {
            id: 'uc-review:step:locate',
            order: 1,
            actorId: 'auditor',
            action: 'Find completed work order',
            expectedResult: 'Matching immutable records are returned.',
            inputIds: ['completed-work-order'],
            outputIds: ['evidence-search-result'],
            ruleIds: ['rule-safety'],
            evidencePolicy: 'structured',
          },
          {
            id: 'uc-review:step:trace',
            order: 2,
            actorId: 'auditor',
            action: 'Trace maintenance evidence',
            expectedResult: 'Every artifact resolves to its actor and source revision.',
            inputIds: ['evidence-search-result'],
            outputIds: ['evidence-trace'],
            ruleIds: ['rule-safety'],
            evidencePolicy: 'screenshot',
          },
          {
            id: 'uc-review:step:export',
            order: 3,
            actorId: 'auditor',
            action: 'Export evidence package',
            expectedResult: 'The export includes integrity hashes and provenance.',
            inputIds: ['evidence-trace'],
            outputIds: ['evidence-package'],
            ruleIds: ['rule-safety'],
            evidencePolicy: 'either',
          },
        ],
        alternatePaths: [],
        failurePaths: [],
        recoveryPaths: [],
        ruleIds: ['rule-safety'],
        inputIds: ['completed-work-order'],
        outputIds: ['evidence-package'],
        acceptanceCaseIds: ['accept-review-evidence'],
        sourceRefs: ['source-ops'],
      }],
      information: [{ id: 'work-order-draft', text: 'Work order draft' }],
      rules: [{ id: 'rule-safety', text: 'A work order cannot be released until every required safety field is complete.' }],
      externalSystems: [],
      constraints: [{ id: 'constraint-audit', text: 'Every release decision must be auditable.' }],
      scope: { inScope: ['Work-order release'], outOfScope: ['Inventory purchasing'] },
      acceptanceCases: [{
        id: 'accept-release',
        description: 'Release a complete work order',
        expectedOutcome: 'The order is released once and its audit event identifies the approved revision.',
      }, {
        id: 'accept-complete',
        description: 'Complete assigned maintenance with evidence',
        expectedOutcome: 'The order closes once with immutable completion evidence.',
      }, {
        id: 'accept-review-evidence',
        description: 'Review and export maintenance evidence',
        expectedOutcome: 'The evidence package resolves to immutable records and source revisions.',
      }],
      sources: [{ id: 'source-ops', text: 'Plant maintenance operating procedure' }],
      unresolvedQuestions: [],
      contentHash: '',
    }
    application.scenarioDefinitions = compileScenarioDefinitions(application)
    const {
      contentHash: _applicationContentHash,
      approvedAt: _applicationApprovedAt,
      ...applicationBody
    } = application
    application.contentHash = canonicalHash(applicationBody)

    const architecture: ArchitectureSpecification = {
      schemaVersion: '1.0',
      projectId: application.projectId,
      id: 'arch.plantops',
      revision: '2.0.0',
      status: 'approved',
      applicationSpecId: application.id,
      applicationSpecRevision: application.revision,
      applicationSpecHash: application.contentHash,
      capabilityProjections: [{
        id: 'cap.work-orders',
        name: 'Auditable maintenance execution',
        moduleIds: [
          'mod.work-orders-ui',
          'mod.release-workflow',
          'mod.work-order-domain',
          'mod.audit-ledger',
          'mod.notification-gateway',
        ],
      }],
      moduleIds: [
        'mod.work-orders-ui',
        'mod.release-workflow',
        'mod.work-order-domain',
        'mod.audit-ledger',
        'mod.notification-gateway',
      ],
      moduleDefinitions: [
        { moduleId: 'mod.work-orders-ui', name: 'Work Orders UI', moduleType: 'experience', responsibility: 'Present and capture the work-order release interaction.' },
        { moduleId: 'mod.release-workflow', name: 'Release Workflow', moduleType: 'workflow', responsibility: 'Coordinate validation, release, and audit recording.' },
        { moduleId: 'mod.work-order-domain', name: 'Work Order Domain', moduleType: 'domain', responsibility: 'Own work-order state and release invariants.' },
        { moduleId: 'mod.audit-ledger', name: 'Audit Ledger', moduleType: 'domain', responsibility: 'Persist immutable decisions, state transitions, evidence hashes, and provenance.' },
        { moduleId: 'mod.notification-gateway', name: 'Notification Gateway', moduleType: 'connection', responsibility: 'Publish approved work-order events to assigned field teams.' },
      ],
      dependencyEdges: [
        { fromModuleId: 'mod.work-orders-ui', toModuleId: 'mod.release-workflow', reason: 'The UI invokes the release use case through its application port.' },
        { fromModuleId: 'mod.release-workflow', toModuleId: 'mod.work-order-domain', reason: 'The workflow delegates release validity and state transition to the domain.' },
        { fromModuleId: 'mod.release-workflow', toModuleId: 'mod.audit-ledger', reason: 'Every release and completion decision is recorded with immutable provenance.' },
        { fromModuleId: 'mod.release-workflow', toModuleId: 'mod.notification-gateway', reason: 'Approved state changes are published to the assigned field team.' },
        { fromModuleId: 'mod.work-order-domain', toModuleId: 'mod.audit-ledger', reason: 'Domain state transitions are appended to the immutable maintenance history.' },
      ],
      operationAllocations: [
        { operationId: 'work-orders.release', moduleId: 'mod.release-workflow' },
        { operationId: 'work-orders.validate-release', moduleId: 'mod.work-order-domain' },
        { operationId: 'audit.append-maintenance-record', moduleId: 'mod.audit-ledger' },
        { operationId: 'notifications.publish-work-order-event', moduleId: 'mod.notification-gateway' },
      ],
      adapterAllocations: [],
      workflowTraces: [{
        useCaseId: 'uc-release-work-order',
        moduleIds: [
          'mod.work-orders-ui',
          'mod.release-workflow',
          'mod.work-order-domain',
          'mod.audit-ledger',
          'mod.notification-gateway',
        ],
        entryPointId: 'route:/orders/:id/release',
        outputId: 'released-work-order',
        stepAllocations: [
          { stepId: 'uc-release:step:review', moduleId: 'mod.work-orders-ui' },
          { stepId: 'uc-release:step:validate', moduleId: 'mod.work-order-domain' },
          { stepId: 'uc-release:step:release', moduleId: 'mod.release-workflow' },
          { stepId: 'uc-release:step:approve', moduleId: 'mod.release-workflow' },
          { stepId: 'uc-release:step:record', moduleId: 'mod.audit-ledger' },
          { stepId: 'uc-release:step:notify', moduleId: 'mod.notification-gateway' },
          { stepId: 'uc-release:step:block', moduleId: 'mod.release-workflow' },
          { stepId: 'uc-release:step:retry', moduleId: 'mod.work-orders-ui' },
        ],
      }, {
        useCaseId: 'uc-complete-work-order',
        moduleIds: ['mod.work-orders-ui', 'mod.release-workflow', 'mod.work-order-domain', 'mod.audit-ledger'],
        entryPointId: 'route:/orders/:id/complete',
        outputId: 'completed-work-order',
        stepAllocations: [
          { stepId: 'uc-complete:step:start', moduleId: 'mod.work-order-domain' },
          { stepId: 'uc-complete:step:evidence', moduleId: 'mod.work-orders-ui' },
          { stepId: 'uc-complete:step:review', moduleId: 'mod.release-workflow' },
          { stepId: 'uc-complete:step:close', moduleId: 'mod.audit-ledger' },
        ],
      }, {
        useCaseId: 'uc-review-evidence',
        moduleIds: ['mod.work-orders-ui', 'mod.release-workflow', 'mod.audit-ledger'],
        entryPointId: 'route:/evidence',
        outputId: 'evidence-package',
        stepAllocations: [
          { stepId: 'uc-review:step:locate', moduleId: 'mod.audit-ledger' },
          { stepId: 'uc-review:step:trace', moduleId: 'mod.release-workflow' },
          { stepId: 'uc-review:step:export', moduleId: 'mod.work-orders-ui' },
        ],
      }],
      proposals: [],
      unresolvedQuestions: [],
      gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
      contentHash: '',
    }
    architecture.contentHash = canonicalHash({ ...architecture, contentHash: undefined })

    const manifests: ModuleManifest[] = [
      {
        schemaVersion: '1.0', architectureVersion: '1.0', moduleId: 'mod.work-orders-ui', moduleVersion: '1.0.0',
        moduleType: 'experience', name: 'Work Orders UI', responsibility: 'Present and capture the work-order release interaction.',
        ownedConcerns: ['Release form', 'Validation feedback'], excludedConcerns: ['Release policy', 'Audit storage'],
        providedOperations: [], requiredOperations: [{ operationId: 'work-orders.release', acceptedContractRange: '^1.0.0', reason: 'Submit an approved release request.' }],
        verificationSuiteIds: ['suite.work-orders-ui'], runtimeAllocation: 'local-embedded', events: [], ownedPaths: ['src/work-orders/'],
      },
      {
        schemaVersion: '1.0', architectureVersion: '1.0', moduleId: 'mod.release-workflow', moduleVersion: '1.0.0',
        moduleType: 'workflow', name: 'Release Workflow', responsibility: 'Coordinate validation, release, and audit recording.',
        ownedConcerns: ['Release coordination'], excludedConcerns: ['Presentation', 'Domain invariants'],
        providedOperations: [{ operationId: 'work-orders.release', contractVersion: '1.0.0' }],
        requiredOperations: [
          { operationId: 'work-orders.validate-release', acceptedContractRange: '^1.0.0', reason: 'Validate release invariants.' },
          { operationId: 'audit.append-maintenance-record', acceptedContractRange: '^1.0.0', reason: 'Record immutable decisions and provenance.' },
          { operationId: 'notifications.publish-work-order-event', acceptedContractRange: '^1.0.0', reason: 'Notify assigned field teams.' },
        ],
        verificationSuiteIds: ['suite.release-workflow'], runtimeAllocation: 'local-embedded', events: ['work-order.released'], ownedPaths: ['src/release-workflow/'],
      },
      {
        schemaVersion: '1.0', architectureVersion: '1.0', moduleId: 'mod.work-order-domain', moduleVersion: '1.0.0',
        moduleType: 'domain', name: 'Work Order Domain', responsibility: 'Own work-order state and release invariants.',
        ownedConcerns: ['Work-order state', 'Release invariants'], excludedConcerns: ['Presentation', 'Workflow coordination'],
        providedOperations: [{ operationId: 'work-orders.validate-release', contractVersion: '1.0.0' }], requiredOperations: [],
        verificationSuiteIds: ['suite.work-order-domain'], runtimeAllocation: 'local-embedded', events: [], ownedPaths: ['src/domain/work-orders/'],
      },
      {
        schemaVersion: '1.0', architectureVersion: '1.0', moduleId: 'mod.audit-ledger', moduleVersion: '1.0.0',
        moduleType: 'domain', name: 'Audit Ledger', responsibility: 'Persist immutable maintenance decisions and evidence provenance.',
        ownedConcerns: ['Audit records', 'Evidence hashes', 'Decision provenance'], excludedConcerns: ['Workflow coordination', 'Notifications'],
        providedOperations: [{ operationId: 'audit.append-maintenance-record', contractVersion: '1.0.0' }], requiredOperations: [],
        verificationSuiteIds: ['suite.audit-ledger'], runtimeAllocation: 'local-embedded', events: [], ownedPaths: ['src/domain/audit/'],
      },
      {
        schemaVersion: '1.0', architectureVersion: '1.0', moduleId: 'mod.notification-gateway', moduleVersion: '1.0.0',
        moduleType: 'connection', name: 'Notification Gateway', responsibility: 'Publish approved work-order events to field channels.',
        ownedConcerns: ['Notification delivery', 'Channel adaptation'], excludedConcerns: ['Release decisions', 'Work-order state'],
        providedOperations: [{ operationId: 'notifications.publish-work-order-event', contractVersion: '1.0.0' }], requiredOperations: [],
        verificationSuiteIds: ['suite.notification-gateway'], runtimeAllocation: 'external-adapter', events: [], ownedPaths: ['src/adapters/notifications/'],
      },
    ]
    const contracts: OperationContract[] = [
      {
        schemaVersion: '1.0', operationId: 'work-orders.release', version: '1.0.0', behavior: 'command',
        inputSchemaRef: 'schema.release-request', outputSchemaRef: 'schema.released-work-order',
        preconditions: [], postconditions: ['The order is released.'], domainRejections: ['Safety information is incomplete.'],
        technicalErrors: [], sideEffects: ['An audit event is recorded.'], idempotency: 'idempotent', timeoutClass: 'short',
        cancellable: true, artifactTypes: [], provenanceFields: ['revision'],
      },
      {
        schemaVersion: '1.0', operationId: 'work-orders.validate-release', version: '1.0.0', behavior: 'query',
        inputSchemaRef: 'schema.work-order', outputSchemaRef: 'schema.validation-result',
        preconditions: [], postconditions: [], domainRejections: [], technicalErrors: [], sideEffects: [],
        idempotency: 'idempotent', timeoutClass: 'short', cancellable: true, artifactTypes: [], provenanceFields: [],
      },
      {
        schemaVersion: '1.0', operationId: 'audit.append-maintenance-record', version: '1.0.0', behavior: 'command',
        inputSchemaRef: 'schema.maintenance-decision', outputSchemaRef: 'schema.audit-record',
        preconditions: [], postconditions: ['The record is immutable and content-addressed.'], domainRejections: [],
        technicalErrors: [], sideEffects: ['A maintenance history entry is appended.'],
        idempotency: 'idempotent', timeoutClass: 'short', cancellable: false, artifactTypes: ['audit-record'], provenanceFields: ['revision', 'actorId'],
      },
      {
        schemaVersion: '1.0', operationId: 'notifications.publish-work-order-event', version: '1.0.0', behavior: 'command',
        inputSchemaRef: 'schema.work-order-event', outputSchemaRef: 'schema.delivery-result',
        preconditions: [], postconditions: ['The event is accepted for delivery.'], domainRejections: [],
        technicalErrors: [], sideEffects: ['One or more field channels are notified.'],
        idempotency: 'idempotent', timeoutClass: 'short', cancellable: true, artifactTypes: [], provenanceFields: ['revision'],
      },
    ]

    state.applicationApproved = application
    state.architectureApproved = architecture
    for (const manifest of manifests) {
      state.moduleApproved.set(manifest.moduleId, manifest)
      let design = createModuleDesignDraft({
        application,
        architecture,
        manifest,
        operationContracts: contracts,
        steLexicon: state.steLexicon,
      })
      design = {
        ...design,
        schemas: [{ id: 'schema.release', text: 'Approved operation input and output schemas' }],
        behavior: {
          ...design.behavior,
          preconditions: ['The work order exists and is a draft.'],
          postconditions: ['A valid work order is released exactly once.'],
          domainRejections: ['Safety information is incomplete.'],
          states: [
            { id: 'draft', text: 'Draft' },
            { id: 'validation-pending', text: 'Validation pending' },
            { id: 'awaiting-approval', text: 'Awaiting supervisor approval' },
            { id: 'scheduled', text: 'Scheduled' },
            { id: 'released', text: 'Released' },
            { id: 'in-progress', text: 'In progress' },
            { id: 'completed', text: 'Completed' },
          ],
        },
      }
      design.diagrams = projectModuleDiagrams({ application, architecture, design })
      const evaluation = evaluateModuleDesign(
        design,
        contracts,
        state.steLexicon,
        { application, architecture },
      )
      design.gates = [{
        gateId: 'CAP-GATE-MODULE-DESIGN',
        passed: evaluation.passed,
        diagnostics: evaluation.diagnostics.map((item, index) => ({
          id: `${item.code}:${index + 1}`, code: item.code, message: item.message, relatedIds: item.relatedIds,
        })),
      }]
      design.status = evaluation.passed ? 'approved' : 'needsInput'
      design.approval = {
        approvedAt: now(),
        approvedBy: 'PlantOps sample',
        sourceHashes: { architecture: architecture.contentHash },
        openNonblockingItemIds: [],
      }
      design.contentHash = canonicalHash({ ...design, contentHash: undefined })
      state.moduleDesignApproved.set(manifest.moduleId, design)
      state.moduleDesignSessions.set(manifest.moduleId, {
        ...createModuleDesignSession({
          projectId: application.projectId,
          moduleId: manifest.moduleId,
          architecture,
          baseModuleDesignRevision: design.revision,
        }),
        state: 'completed',
        currentStep: 'approval',
        completedSteps: ['boundary', 'behavior', 'contracts', 'diagrams', 'checks', 'approval'],
      })
    }
  }

  function seedDo178AuditHubWorkflow(state: CapProjectState) {
    const sourceApplication = do178ApplicationRecord as ApplicationSpecification
    const sourceArchitecture = do178ArchitectureRecord as unknown as ArchitectureSpecification
    const step = (
      useCaseId: string,
      suffix: string,
      order: number,
      actorId: string | undefined,
      action: string,
      expectedResult: string,
    ) => ({
      id: `${useCaseId}:step:${suffix}`,
      order,
      ...(actorId ? { actorId } : {}),
      action,
      expectedResult,
      inputIds: [],
      outputIds: [],
      ruleIds: sourceApplication.rules.map((rule) => rule.id),
      evidencePolicy: 'structured' as const,
    })
    let detailedUseCases: NonNullable<ApplicationSpecification['useCaseDefinitions']> = [{
      id: 'uc-findings',
      name: 'Close audit finding',
      actorIds: ['actor-vv', 'actor-qa', 'actor-lead'],
      trigger: 'A reviewer opens an audit finding that is ready for work.',
      preconditions: ['The selected immutable snapshot contains evidence linked to an open finding.'],
      mainFlow: [
        step('uc-findings', 'open', 1, 'actor-vv', 'Inspect finding evidence', 'The view shows the exact evidence identity, revision, hash, and history.'),
        step('uc-findings', 'assign', 2, 'actor-qa', 'Assign finding owner', 'The record includes the owner, severity, and due date.'),
        step('uc-findings', 'correct', 3, 'actor-vv', 'Record corrective action', 'The corrective action stays linked to the authoritative evidence revision.'),
        step('uc-findings', 'review', 4, 'actor-qa', 'Check closure readiness', 'The closure gate shows the evidence status and the independence status.'),
        step('uc-findings', 'reverify', 5, 'actor-lead', 'Verify corrective action', 'The verification result stays linked to the finding history.'),
        step('uc-findings', 'close', 6, 'actor-lead', 'Close audit finding', 'The finding closes with an immutable decision and complete source data.'),
      ],
      alternatePaths: [],
      failurePaths: [],
      recoveryPaths: [],
      ruleIds: sourceApplication.rules.map((rule) => rule.id),
      inputIds: [],
      outputIds: [],
      acceptanceCaseIds: ['ac-4'],
      sourceRefs: sourceApplication.sources.map((source) => source.id),
    }, {
      id: 'uc-reviews',
      name: 'Record assurance review',
      actorIds: ['actor-qa', 'actor-vv', 'actor-auditor'],
      trigger: 'A reviewer starts an assurance review for the selected snapshot.',
      preconditions: ['The reviewer has approved access to the selected snapshot.'],
      mainFlow: [
        step('uc-reviews', 'scope', 1, 'actor-qa', 'Select review evidence', 'The review uses the selected scope, artifact revisions, and hashes.'),
        step('uc-reviews', 'independence', 2, 'actor-auditor', 'Confirm reviewer independence', 'The record includes the reviewer identity and independence evidence.'),
        step('uc-reviews', 'inspect', 3, 'actor-vv', 'Inspect review history', 'The view shows related traces, findings, and prior decisions without a source change.'),
        step('uc-reviews', 'decide', 4, 'actor-auditor', 'Record review decision', 'The record adds the decision and comments to the immutable review history.'),
      ],
      alternatePaths: [],
      failurePaths: [],
      recoveryPaths: [],
      ruleIds: sourceApplication.rules.map((rule) => rule.id),
      inputIds: [],
      outputIds: [],
      acceptanceCaseIds: ['ac-2'],
      sourceRefs: sourceApplication.sources.map((source) => source.id),
    }, {
      id: 'uc-package',
      name: 'Build audit package',
      actorIds: ['actor-lead', 'actor-auditor', 'actor-cm'],
      trigger: 'A certification lead starts an audit-package export.',
      preconditions: ['A published immutable snapshot and package selection exist.'],
      mainFlow: [
        step('uc-package', 'select', 1, 'actor-lead', 'Select package evidence', 'The selection includes dossiers, trace matrices, reviews, and findings.'),
        step('uc-package', 'baseline', 2, 'actor-cm', 'Record baseline metadata', 'The manifest records the immutable snapshot and exact source revisions.'),
        step('uc-package', 'verify', 3, 'actor-auditor', 'Check package integrity', 'Each package item passes the hash, review, open-item, and source-data checks.'),
        step('uc-package', 'watermark', 4, undefined, 'Mark synthetic sample', 'The watermark distinguishes sample evidence from certification evidence.'),
        step('uc-package', 'export', 5, 'actor-lead', 'Export audit package', 'The outbound adapter writes a reproducible package and manifest.'),
      ],
      alternatePaths: [],
      failurePaths: [],
      recoveryPaths: [],
      ruleIds: sourceApplication.rules.map((rule) => rule.id),
      inputIds: [],
      outputIds: [],
      acceptanceCaseIds: ['ac-5'],
      sourceRefs: sourceApplication.sources.map((source) => source.id),
    }]
    detailedUseCases = buildDo178UseCases(sourceApplication)
    const applicationWorkflows = buildDo178ApplicationWorkflows(sourceApplication)
    const application: ApplicationSpecification = {
      ...sourceApplication,
      projectId: 'do-178c-audit-hub',
      useCaseDefinitions: detailedUseCases,
      applicationWorkflows,
      scenarioDefinitions: undefined,
      contentHash: '',
    }
    application.scenarioDefinitions = compileScenarioDefinitions(application)
    application.contentHash = canonicalHash({ ...application, contentHash: undefined })
    const workflowAllocations = buildDo178WorkflowAllocations()
    const architecture: ArchitectureSpecification = {
      ...sourceArchitecture,
      projectId: application.projectId,
      applicationSpecId: application.id,
      applicationSpecRevision: application.revision,
      applicationSpecHash: application.contentHash,
      workflowTraces: sourceArchitecture.workflowTraces.map((trace) => {
        const allocations = workflowAllocations[trace.useCaseId]
        return allocations
          ? {
            ...trace,
            moduleIds: [...new Set(allocations.flatMap((allocation) => [
              allocation.primaryModuleId,
              ...allocation.participatingModuleIds,
            ]))],
            nodeAllocations: allocations,
          }
          : trace
      }),
      contentHash: '',
    }
    const {
      contentHash: _architectureContentHash,
      approvedAt: _architectureApprovedAt,
      ...architectureBody
    } = architecture
    architecture.contentHash = canonicalHash(architectureBody)
    const sourceManifests = [
      do178AssuranceModuleRecord,
      do178AuditExperienceModuleRecord,
      do178EvidenceGraphModuleRecord,
      do178EvidenceStoreModuleRecord,
      do178ExternalAdaptersModuleRecord,
      do178IngestionPublicationModuleRecord,
      do178LifecycleExplorerModuleRecord,
      do178SampleWorkspaceModuleRecord,
      do178WorkspaceSnapshotsModuleRecord,
    ] as unknown as {
      moduleId: string
      moduleVersion: string
      moduleType: ModuleManifest['moduleType']
      name?: string
      responsibility: string
      nonResponsibilities?: string[]
      ownedConcerns?: string[]
      excludedConcerns?: string[]
      providedOperations: ModuleManifest['providedOperations']
      requiredOperations: ModuleManifest['requiredOperations']
      verificationSuiteIds?: string[]
      runtimeAllocation?: ModuleManifest['runtimeAllocation']
      events?: string[]
      ownedPaths: string[]
    }[]
    state.applicationApproved = application
    state.architectureApproved = architecture
    for (const sourceManifest of sourceManifests) {
      const definition = architecture.moduleDefinitions!.find((item) =>
        item.moduleId === sourceManifest.moduleId)
      const manifest: ModuleManifest = {
        schemaVersion: '1.0',
        architectureVersion: '1.0',
        moduleId: sourceManifest.moduleId,
        moduleVersion: sourceManifest.moduleVersion,
        moduleType: sourceManifest.moduleType,
        name: sourceManifest.name ?? definition?.name ?? sourceManifest.moduleId,
        responsibility: sourceManifest.responsibility,
        ownedConcerns: sourceManifest.ownedConcerns ?? [definition?.name ?? sourceManifest.moduleId],
        excludedConcerns: sourceManifest.excludedConcerns ?? sourceManifest.nonResponsibilities ?? [],
        providedOperations: [...sourceManifest.providedOperations],
        requiredOperations: [...sourceManifest.requiredOperations],
        verificationSuiteIds: sourceManifest.verificationSuiteIds
          ?? [`acceptance:${sourceManifest.moduleId}`],
        runtimeAllocation: sourceManifest.runtimeAllocation
          ?? (sourceManifest.moduleType === 'connection' ? 'external-adapter' : 'local-embedded'),
        events: sourceManifest.events ?? [],
        ownedPaths: [...sourceManifest.ownedPaths],
      }
      state.moduleApproved.set(manifest.moduleId, manifest)
    }
    for (const approvedDesign of [
      do178AssuranceDesignRecord,
      do178AuditExperienceDesignRecord,
      do178EvidenceGraphDesignRecord,
      do178EvidenceStoreDesignRecord,
      do178ExternalAdaptersDesignRecord,
      do178WorkspaceSnapshotsDesignRecord,
    ] as unknown as ModuleDesignSpecification[]) {
      const rebasedDesign: ModuleDesignSpecification = {
        ...structuredClone(approvedDesign),
        projectId: application.projectId,
        architecture: {
          id: architecture.id,
          revision: architecture.revision,
          contentHash: architecture.contentHash,
        },
        approval: approvedDesign.approval
          ? {
            ...approvedDesign.approval,
            sourceHashes: {
              ...approvedDesign.approval.sourceHashes,
              architecture: architecture.contentHash,
            },
          }
          : approvedDesign.approval,
        diagrams: [],
        contentHash: '',
      }
      rebasedDesign.diagrams = projectModuleDiagrams({
        application,
        architecture,
        design: rebasedDesign,
      })
      rebasedDesign.contentHash = canonicalHash({ ...rebasedDesign, contentHash: undefined })
      state.moduleDesignApproved.set(rebasedDesign.module.moduleId, rebasedDesign)
      state.moduleDesignSessions.set(rebasedDesign.module.moduleId, {
        ...createModuleDesignSession({
          projectId: application.projectId,
          moduleId: rebasedDesign.module.moduleId,
          architecture,
          baseModuleDesignRevision: rebasedDesign.revision,
        }),
        state: 'completed',
        currentStep: 'diagrams',
        completedSteps: ['boundary', 'behavior', 'contracts', 'diagrams', 'checks', 'approval'],
      })
    }
  }

  function ensureCap(projectId: string): CapProjectState {
    let state = capByProject.get(projectId)
    if (!state) {
      state = {
        initializedAt: now(),
        moduleDrafts: new Map(),
        moduleApproved: new Map(),
        moduleInterviewDrafts: new Map(),
        moduleInterviewApproved: new Map(),
        moduleDesignDrafts: new Map(),
        moduleDesignApproved: new Map(),
        moduleDesignSessions: new Map(),
        scenarioRuns: new Map(),
        scenarioEvidence: new Map(),
        bindingDrafts: new Map(),
        bindingApproved: new Map(),
        freshness: new Map(),
        deployables: new Map(),
        inboundBindingDrafts: new Map(),
        inboundBindingApproved: new Map(),
        generationPlans: new Map(),
        generationApplies: new Map(),
        connectionVerifications: new Map(),
        capabilityRuns: new Map(),
      }
      if (projectId === 'plantops-sample') seedPlantOpsWorkflow(state)
      if (projectId === 'do-178c-audit-hub') seedDo178AuditHubWorkflow(state)
      capByProject.set(projectId, state)
    }
    return state
  }

  /**
   * Synthesizes this project's deployables (CAP-ERA-001 §5.1) on first access.
   * The mock has no persisted `DeployableSpecification` generation pipeline
   * (that is WP5B/WP7 real-IPC scope) — it derives a defensible minimal set:
   * a `browser` UI deployable when the project has a configured application UI
   * or an approved `experience`-type module, plus always one headless deployable
   * so every project has at least one entry point that requires connecting.
   */
  function ensureDeployables(projectId: string): Map<string, CapabilityDeployableSummary> {
    const state = ensureCap(projectId)
    if (state.deployables.size > 0) return state.deployables
    const project = projects.get(projectId)
    const hasExperienceModule = [...state.moduleApproved.values()].some((m) => m.moduleType === 'experience')
    const hasUi = Boolean(project?.launchUrl) || hasExperienceModule
    if (hasUi) {
      state.deployables.set('deployable.ui', { deployableId: 'deployable.ui', kind: 'browser' as DeployableKind, name: 'Application UI' })
    }
    state.deployables.set('deployable.main', { deployableId: 'deployable.main', kind: 'http-api' as DeployableKind, name: 'Application' })
    return state.deployables
  }

  function listNeedsAttentionFor(projectId: string): AttentionItem[] {
    const state = ensureCap(projectId)
    const arch = state.architectureApproved ?? state.architectureDraft
    const moduleIds =
      arch?.moduleIds?.length
        ? arch.moduleIds
        : [...new Set([...state.moduleDrafts.keys(), ...state.moduleApproved.keys()])].sort((a, b) =>
            a.localeCompare(b),
          )
    const freshness: FreshnessRecord[] = moduleIds.map((moduleId) => {
      const existing = state.freshness.get(moduleId)
      if (existing) return existing
      const approved = state.moduleApproved.get(moduleId)
      return calculateFreshness({
        moduleId,
        moduleVersion: approved?.moduleVersion ?? '0.0.0',
        specificationHash: approved ? `spec:${approved.moduleId}@${approved.moduleVersion}` : 'pending',
        implementationHash: 'pending',
        architectureHash: arch?.contentHash ?? 'pending',
        dependencyHash: 'pending',
        adapterHash: 'pending',
        bindingHash: 'pending',
        verificationSuiteHash: 'pending',
        verification: null,
      })
    })
    return buildNeedsAttention(freshness, {
      schemaVersion: '1.0',
      changeId: `attention-${projectId}`,
      initiatingRecordId: arch?.id ?? projectId,
      initiatingRevision: arch?.revision ?? '0',
      classification: 'required-additive',
      affectedModules: [],
      unaffectedModules: [],
      proposedPacketOrder: moduleIds,
      recalculationEvidence: [],
    })
  }

  const seed = (name: string, repoPath: string, description: string, daysAgo: number, status: Project['status'] = 'active') => {
    const id = name.toLowerCase().replace(/\s+/g, '-')
    const at = new Date(Date.now() - daysAgo * 864e5).toISOString()
    projects.set(id, {
      id, name, description, repoPath, status,
      verificationCommands: { typecheck: 'npm run typecheck', build: 'npm run build' },
      launchUrl: 'http://localhost:5173',
      evidenceViews: [
        { id: 'home', label: 'Dashboard', path: '/' },
        { id: 'settings', label: 'Settings', path: '/settings' },
      ],
      settingsSchemaVersion: '1', createdAt: at, updatedAt: at,
    })
  }
  seed('sample-analytics-app', 'C:\\work\\sample-analytics-app', 'Real-time metrics and analytics dashboard', 2)
  seed('sample-design-system', 'C:\\work\\sample-design-system', 'Shared UI components and style guide', 5)
  seed('sample-integrations', 'C:\\work\\sample-integrations', 'Manage third-party integrations', 8, 'archived')
  // Built-in sample, mirroring the real bridge's seeded PlantOps project.
  projects.set('plantops-sample', {
    id: 'plantops-sample',
    name: 'PlantOps (sample)',
    description: 'Built-in sample: a multi-page legacy work-order app to explore the whole workflow against.',
    repoPath: 'examples/work-orders-monolith',
    status: 'active',
    isSample: true,
    launchUrl: 'http://127.0.0.1:5402',
    launchCommand: 'npx vite --port 5402 --strictPort',
    verificationCommands: { typecheck: 'npm run typecheck', build: 'npm run build' },
    evidenceViews: [
      { id: 'dashboard', label: 'Dashboard', path: '/' },
      { id: 'orders', label: 'Work Orders', path: '#/orders' },
      { id: 'order-form', label: 'New Order Form', path: '#/orders/new' },
      { id: 'assets', label: 'Assets', path: '#/assets' },
      { id: 'reports', label: 'Reports', path: '#/reports' },
    ],
    settingsSchemaVersion: '1',
    createdAt: new Date(Date.now() - 864e5).toISOString(),
    updatedAt: new Date(Date.now() - 864e5).toISOString(),
  })
  projects.set('do-178c-audit-hub', {
    id: 'do-178c-audit-hub',
    name: 'DO-178C Audit Hub (sample)',
    description: 'Canonical aerospace assurance sample with approved application, architecture, and module specifications.',
    repoPath: 'examples/do178-audit-hub',
    status: 'active',
    isSample: true,
    verificationCommands: { typecheck: 'npm run typecheck', build: 'npm run build' },
    evidenceViews: [{ id: 'overview', label: 'Audit overview', path: '/' }],
    settingsSchemaVersion: '1',
    createdAt: new Date(Date.now() - 864e5).toISOString(),
    updatedAt: new Date().toISOString(),
  })

  let counter = 0
  const newId = (prefix: string) => `${prefix}-${++counter}`
  const saveMockModuleDesign = (
    projectId: string,
    draft: ModuleDesignSpecification,
  ): { ok: true; design: ModuleDesignSpecification; diagnostics: ReturnType<typeof evaluateModuleDesign>['diagnostics'] } => {
    const state = ensureCap(projectId)
    const application = state.applicationApproved
    const architecture = state.architectureApproved
    if (!application || !architecture) throw new Error('Approved application and architecture are required.')
    const design: ModuleDesignSpecification = {
      ...draft,
      status: 'draft',
      approval: undefined,
      diagrams: [],
      gates: [],
      contentHash: '',
    }
    design.diagrams = projectModuleDiagrams({ application, architecture, design })
    const evaluation = evaluateModuleDesign(
      design,
      [],
      state.steLexicon,
      { application, architecture },
    )
    const diagnostics = evaluation.diagnostics
    design.gates = [{
      gateId: 'CAP-GATE-MODULE-DESIGN',
      passed: diagnostics.length === 0,
      diagnostics: diagnostics.map((item, index) => ({
        id: `${item.code}:${index + 1}`,
        code: item.code,
        message: item.message,
        relatedIds: item.relatedIds,
      })),
    }]
    design.status = diagnostics.length === 0 ? 'readyForReview' : 'needsInput'
    design.contentHash = canonicalHash({ ...design, contentHash: undefined })
    state.moduleDesignDrafts.set(design.module.moduleId, design)
    return { ok: true, design, diagnostics }
  }

  return {
    async appVersion() { return '0.1.0 (mock)' },
    async getSettings() { return { ...settings } },
    async saveSettings(next) { settings = { ...next } },
    async listProjects() { return [...projects.values()].sort((a, b) => a.name.localeCompare(b.name)) },
    async createProject(input) {
      if (!input.name.trim()) throw new Error('project name is required')
      if (!input.repoPath.trim()) throw new Error('repository path does not exist')
      const project: Project = {
        id: newId('project'), name: input.name.trim(), repoPath: input.repoPath, status: 'active',
        launchUrl: 'http://127.0.0.1:4180', launchCommand: 'npm run build && npm start',
        ...(input.description ? { description: input.description } : {}),
        verificationCommands: { typecheck: 'npm run typecheck', build: 'npm run build' },
        settingsSchemaVersion: '1', createdAt: now(), updatedAt: now(),
      }
      projects.set(project.id, project)
      return project
    },
    async updateProject(projectId, patch) {
      const existing = projects.get(projectId)
      if (!existing) throw new Error(`project not found: ${projectId}`)
      const updated = { ...existing, ...patch, id: existing.id, updatedAt: now() }
      projects.set(projectId, updated)
      return updated
    },
    async getProjectWorkOverview(projectId) {
      const state = ensureCap(projectId)
      const architecture = state.architectureApproved ?? state.architectureDraft
      const modules = (architecture?.moduleIds ?? [...state.moduleApproved.keys()]).map((moduleId) => ({
        moduleId,
        draft: state.moduleDrafts.get(moduleId),
        approved: state.moduleApproved.get(moduleId),
        freshness: state.freshness.get(moduleId),
      }))
      return deriveProjectWorkOverview({
        projectId,
        application: { draft: state.applicationDraft, approved: state.applicationApproved },
        architecture: { draft: state.architectureDraft, approved: state.architectureApproved },
        modules,
        capabilityRuns: [...state.capabilityRuns.values()],
        handoffRuns: [...runs.values()].filter((run) => run.projectId === projectId),
        requiresFrontend: projects.get(projectId)?.developmentScope !== 'capabilities',
      })
    },
    async preflightProjectPreview(projectId) {
      const project = projects.get(projectId)
      if (!project) throw new Error(`project not found: ${projectId}`)
      return analyzePreviewPreflight({
        projectId,
        repoPath: project.repoPath,
        launchUrl: project.launchUrl,
        launchCommand: project.launchCommand,
        packageJsonExists: true,
        dependenciesInstalled: true,
        detectedPackageManager: 'npm',
        packageScripts: { build: 'vite build', start: 'vite --host 127.0.0.1' },
        probes: project.launchUrl ? [{ url: project.launchUrl, reachable: true, latencyMs: 1 }] : [],
      })
    },
    async listRuns(projectId) {
      return [...runs.values()].filter((r) => !projectId || r.projectId === projectId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    async createRun(projectId) {
      const run: HandoffRun = { id: newId('run'), projectId, currentStep: 'prepare-context', createdAt: now(), updatedAt: now() }
      runs.set(run.id, run)
      return run
    },
    async getRun(runId) { return runs.get(runId) },
    async updateRun(runId, patch) {
      const existing = runs.get(runId)
      if (!existing) throw new Error(`run not found: ${runId}`)
      const updated = { ...existing, ...patch, id: existing.id, updatedAt: now() }
      runs.set(runId, updated)
      return updated
    },
    async completeRun(input) {
      const run = runs.get(input.runId)
      if (!run) throw new Error(`run not found: ${input.runId}`)
      const record = buildRunCompletionRecord({
        run,
        decision: input.decision,
        verificationResults: verificationByRun.get(input.runId) ?? [],
        userDecisionNote: input.userDecisionNote,
      })
      completionByRun.set(input.runId, record)
      await this.updateRun(input.runId, {
        currentStep: 'complete',
        completionStatus: input.decision,
        completedAt: record.summary.completedAt,
        completionSummaryPath: `/mock/${input.runId}/completion-summary.json`,
      })
      return record
    },
    async getRunCompletion(runId) {
      return completionByRun.get(runId)
    },
    async getProjectWorkflowMetrics(projectId) {
      const projectRuns = [...runs.values()].filter((run) => run.projectId === projectId)
      const completedRuns = projectRuns.filter((run) => completionByRun.has(run.id)).length
      return {
        schemaVersion: '1.0',
        projectId,
        events: projectRuns.length + completedRuns,
        uniqueRuns: projectRuns.length,
        completedRuns,
        blockedActions: 0,
        failedActions: 0,
        handoffsExported: projectRuns.filter((run) => Boolean(run.taskPacketPath)).length,
        medianActionDurationMs: 0,
        p95ActionDurationMs: 0,
        byAction: [],
      }
    },
    async pickDirectory() { return 'C:\\work\\picked-repo' },
    async pickZipFile() { return 'C:\\work\\Downloads\\ui-overlay.zip' },
    async addReferenceFile() { return { path: '/tmp/reference-example.pdf', name: 'example.pdf' } },
    getDroppedFilePath(file) { return file.name },
    async prepareContext(runId): Promise<PrepareContextResult> {
      const run = runs.get(runId)
      if (!run) throw new Error(`run not found: ${runId}`)
      await this.updateRun(runId, { currentStep: 'create-task-packet', repoFlatfilePath: '/mock/repo-flatfile.txt' })
      return {
        inventory: {
          projectId: run.projectId, repoPath: projects.get(run.projectId)?.repoPath ?? '', generatedAt: now(),
          detectedFrameworks: ['react', 'vite', 'typescript'], detectedPackageManager: 'npm',
          packageScripts: { dev: 'vite', build: 'tsc -b && vite build', typecheck: 'tsc -b --pretty false' },
          includedFiles: ['index.html', 'package.json', 'src/App.tsx', 'src/styles.css', 'src/main.tsx'],
          excludedPaths: [
            { path: 'node_modules/**', reason: "directory 'node_modules' is excluded (dependencies)" },
            { path: 'dist/**', reason: "directory 'dist' is excluded (build output)" },
            { path: '.env', reason: 'likely environment file' },
          ],
          contextWarnings: ['src/config.ts: possible assigned secret-like literal matched pattern review'],
          sourceFileCount: 42, includedFileCount: 11, excludedFileCount: 31,
        },
        flatfilePath: '/mock/repo-flatfile.txt',
        flatfileBytes: 2_460_000,
        warnings: ['src/config.ts: possible assigned secret-like literal matched pattern review'],
      }
    },
    async buildPacket(runId, fields: TaskPacketFields): Promise<BuildPacketResult> {
      for (const [key, value] of Object.entries(fields)) {
        if (!String(value ?? '').trim()) throw new Error(`required packet field is empty: ${key}`)
      }
      await this.updateRun(runId, {
        currentStep: 'run-in-copilot',
        taskTitle: fields.taskTitle,
        taskPacketPath: '/mock/task-packet.md',
        standardPackPath: '/mock/standard-pack.md',
        taskAndStandardPackPath: '/mock/task-and-standard-pack.md',
        uploadSetType: 'text-only',
      })
      lastPacketFields = { ...fields }
      const projectId = runs.get(runId)?.projectId
      const steLexicon = projectId ? ensureCap(projectId).steLexicon : undefined
      return {
        taskPacketPath: '/mock/task-packet.md',
        standardPackPath: '/mock/standard-pack.md',
        runDir: '/mock',
        packBytes: 73_000,
        uploadFiles: [
          { file: 'repo-flatfile.txt', bytes: 2_460_000, sha256: 'a'.repeat(64) },
          { file: 'task-and-standard-pack.md', bytes: 73_000, sha256: 'b'.repeat(64) },
        ],
        recommendedPrompt: withStePrompt(`Implement the focused UI change.

Task goal:

${fields.goal}

Return only ui-overlay.zip with the changed files and new files.`, {
          technicalTerms: steLexicon?.technicalTerms,
          prohibitedAliases: steLexicon?.prohibitedAliases,
        }),
      }
    },
    async getArtifactText(_runId, fileName): Promise<string> {
      if (fileName === 'task-packet.md') {
        return [
          '# Task Packet', '',
          `- task: ${lastPacketFields?.taskTitle ?? 'Sample task'}`,
          '- expectedOutput: `ui-overlay.zip`', '',
          '## Goal', '', lastPacketFields?.goal ?? 'Sample goal.', '',
          '## Scope', '', ...(lastPacketFields?.scope ?? 'Sample scope.').split('\n').map((s) => `- ${s}`), '',
          '## Constraints', '', ...(lastPacketFields?.constraints ?? 'Sample constraint.').split('\n').map((s) => `- ${s}`), '',
          '## Acceptance Criteria', '', ...(lastPacketFields?.acceptanceCriteria ?? 'Builds.').split('\n').map((s, i) => `${i + 1}. ${s}`), '',
          '## References', '', ...(lastPacketFields?.references ?? 'Mockups.').split('\n').map((s) => `- ${s}`), '',
        ].join('\n')
      }
      return `# ${fileName}\n\nMock artifact content.`
    },
    async saveFeedback(runId, text) {
      if (!text.trim()) throw new Error('feedback text is empty')
      mockFeedback.push({ at: now(), text: text.trim() })
      return this.updateRun(runId, { userReviewNotesPath: '/mock/user-review-notes.md' })
    },
    async buildReviewPacket(runId) {
      const run = runs.get(runId)
      if (!run) throw new Error(`run not found: ${runId}`)
      const steLexicon = ensureCap(run.projectId).steLexicon
      const captured = evidenceCaptured.get(runId)
      const visual = Boolean(captured?.before || captured?.after)
      await this.updateRun(runId, {
        reviewEvidencePackPath: '/mock/review-packet.md',
        uploadSetType: visual ? 'follow-up-visual' : 'follow-up-text',
      })
      const reviewPacketText = withStePrompt(
        `# Copilot Review Packet

- runId: \`${runId}\`

## Review request

Review the changed files and evidence.
Classify each finding as a blocker, warning, or note.
Give one corrective action for each finding.

## Reviewer feedback

${mockFeedback.map((item) => item.text).join('\n\n') || '_No manual feedback is available._'}`,
        {
          technicalTerms: steLexicon?.technicalTerms,
          prohibitedAliases: steLexicon?.prohibitedAliases,
        },
      )
      return {
        reviewPacketPath: '/mock/review-packet.md',
        reviewPacketText,
        ...(visual ? { contactSheetPath: '/mock/review-evidence.pdf' } : {}),
        changesZipPath: '/mock/changes.zip',
        uploadFiles: visual
          ? ['/mock/review-packet.md', '/mock/review-evidence.pdf', '/mock/changes.zip']
          : ['/mock/review-packet.md', '/mock/changes.zip'],
      }
    },
    async captureEvidence(runId, phase): Promise<EvidenceCapture> {
      const run = runs.get(runId)
      if (!run) throw new Error(`run not found: ${runId}`)
      const project = projects.get(run.projectId)
      const views = project?.evidenceViews ?? []
      if (views.length === 0) throw new Error('no target views configured; add evidence views in the project settings first')
      const record = evidenceCaptured.get(runId) ?? {}
      record[phase] = now()
      evidenceCaptured.set(runId, record)
      return {
        runId, phase, capturedAt: now(), baseUrl: project?.launchUrl ?? 'http://localhost:5173',
        viewport: { width: 1440, height: 960 },
        views: views.map((v) => ({
          viewId: v.id, label: v.label, path: v.path,
          screenshotFile: `${v.id}.png`,
          census: phase === 'before' ? { svg: 4, img: 1, button: 6, input: 2 } : { svg: 0, img: 1, button: 6, input: 2 },
          ok: true,
        })),
        ok: true,
      }
    },
    async getEvidence(runId): Promise<RunEvidence> {
      const run = runs.get(runId)
      if (!run) throw new Error(`run not found: ${runId}`)
      const project = projects.get(run.projectId)
      const captured = evidenceCaptured.get(runId) ?? {}
      const views = (project?.evidenceViews ?? []).map((v, index) => ({
        viewId: v.id, label: v.label, path: v.path,
        ...(captured.before ? { beforeShot: MOCK_BEFORE_PNG } : {}),
        ...(captured.after ? { afterShot: MOCK_AFTER_PNG } : {}),
        // First view demonstrates the loss badge once both phases exist.
        losses: captured.before && captured.after && index === 0 ? [{ element: 'svg', before: 4, after: 0 }] : [],
      }))
      return {
        ...(captured.before ? { before: { capturedAt: captured.before, ok: true } } : {}),
        ...(captured.after ? { after: { capturedAt: captured.after, ok: true } } : {}),
        views,
      }
    },
    async captureProjectThumbnail() { return undefined },
    async inspectOverlay(runId, zipPath): Promise<OverlayInspectionSummary> {
      const blocked = zipPath.toLowerCase().includes('blocked')
      const summary: OverlayInspectionSummary = {
        runId, zipFilename: zipPath.split(/[\\/]/).pop() ?? 'ui-overlay.zip', inspectedAt: now(),
        normalizedEntries: [
          { originalPath: 'src/App.tsx', normalizedRelativePath: 'src/App.tsx', targetPath: 'src/App.tsx', sizeBytes: 14272, isDirectory: false },
          { originalPath: 'src/styles.css', normalizedRelativePath: 'src/styles.css', targetPath: 'src/styles.css', sizeBytes: 17489, isDirectory: false },
          { originalPath: 'src/tokens.css', normalizedRelativePath: 'src/tokens.css', targetPath: 'src/tokens.css', sizeBytes: 2487, isDirectory: false },
        ],
        hardBlockers: blocked ? [{ ruleId: 'AI-HANDOFF-035', path: '.git/config', message: 'git metadata entry' }] : [],
        warnings: [
          { ruleId: 'AI-HANDOFF-040', path: 'src/App.tsx', message: 'overwrites existing source file' },
          { ruleId: 'AI-HANDOFF-040', path: 'src/styles.css', message: 'overwrites existing source file' },
        ],
        canApply: !blocked,
      }
      await this.updateRun(runId, { currentStep: 'apply-zip-overlay', overlayZipPath: zipPath })
      return summary
    },
    async applyOverlay(runId, acceptWarnings): Promise<AppliedFiles> {
      if (!acceptWarnings) throw new Error('refusing to apply: warnings present and not explicitly accepted')
      await this.updateRun(runId, { currentStep: 'verify-review' })
      return {
        runId, appliedAt: now(),
        files: [
          { relativePath: 'src/App.tsx', action: 'overwritten', sizeBytes: 14272 },
          { relativePath: 'src/styles.css', action: 'overwritten', sizeBytes: 17489 },
          { relativePath: 'src/tokens.css', action: 'created', sizeBytes: 2487 },
        ],
      }
    },
    async runVerification(runId, labels): Promise<VerificationResult[]> {
      const results = labels.map((label) => ({
        runId, commandLabel: label, commandText: `npm run ${label}`, workingDirectory: '/mock',
        startedAt: now(), endedAt: now(), exitCode: 0, status: 'passed' as const, wasCancelledByUser: false,
      }))
      verificationByRun.set(runId, results)
      const run = runs.get(runId)
      if (run) {
        await this.updateRun(runId, {
          verificationResultPaths: results.map((result) => `/mock/${runId}/verification-result-${result.commandLabel}.json`),
        })
      }
      return results
    },
    async installDependencies(runId): Promise<VerificationResult> {
      return {
        runId, commandLabel: 'install-dependencies', commandText: 'npm install', workingDirectory: '/mock',
        startedAt: now(), endedAt: now(), exitCode: 0, status: 'passed', wasCancelledByUser: false,
      }
    },
    async startUploadDrag() { /* native drag needs Electron; no-op in mock */ },
    async launchApp(projectId, _options) {
      const project = projects.get(projectId)
      if (!project?.launchUrl) throw new Error('no launch URL configured for this project')
      return { url: project.launchUrl, started: false, rebuilt: false }
    },
    async pickPreviewElement() { return null },
    async copyUploadSet(runId) {
      const run = runs.get(runId)
      if (!run) throw new Error(`run not found: ${runId}`)
      if (!run.repoFlatfilePath) throw new Error('no upload files for this run yet — prepare context and build the task packet first')
      return { files: 2 }
    },
    async openExternal() { /* no-op in mock */ },
    async openPath() { /* no-op in mock */ },
    async showInFolder() { /* no-op in mock */ },
    async capabilitiesEnsureInitialized(projectId) {
      const state = ensureCap(projectId)
      return { schemaVersion: '1.0', initializedAt: state.initializedAt }
    },
    async capabilitiesGetSteLexicon(projectId) {
      return ensureCap(projectId).steLexicon
    },
    async capabilitiesSaveSteLexicon(projectId, lexicon, source, reviewedAt) {
      const record = createProjectSteLexicon({
        source,
        reviewedAt,
        generalWords: lexicon.generalWords ?? [],
        technicalTerms: lexicon.technicalTerms,
        prohibitedAliases: lexicon.prohibitedAliases,
      })
      ensureCap(projectId).steLexicon = record
      return record
    },
    async capabilitiesGetApplication(projectId) {
      const state = ensureCap(projectId)
      return { draft: state.applicationDraft, approved: state.applicationApproved }
    },
    async capabilitiesSaveApplicationDraft(projectId, draft) {
      ensureCap(projectId).applicationDraft = draft as ApplicationSpecification
      return { ok: true as const }
    },
    async capabilitiesApproveApplication(projectId, draft) {
      const state = ensureCap(projectId)
      const candidate = draft as ApplicationSpecification
      const gate = evaluateProductGate(candidate, state.steLexicon)
      if (!gate.passed) return { ok: false, gate }
      const approved = { ...candidate, status: 'approved' as const }
      state.applicationApproved = approved
      state.applicationDraft = undefined
      return { ok: true, approved, gate }
    },
    async capabilitiesEvaluateProductGate(specification) {
      const candidate = specification as ApplicationSpecification
      return evaluateProductGate(candidate, ensureCap(candidate.projectId).steLexicon)
    },
    async capabilitiesBuildInterviewPacket(input) {
      return input
    },
    async capabilitiesExportInterviewPacket(input) {
      const packet = input as InterviewPacket
      const state = ensureCap(packet.projectId)
      const runId = `cap-interview-${Date.now()}`
      const files = ['capability-interview-handoff.md']
        .map((name) => ({ path: `/mock/${runId}/${name}`, bytes: 100, sha256: `mock-${name}` }))
      return {
        runId,
        packetId: packet.packetId,
        recommendedPrompt: withStePrompt('Conduct the bounded interview.', {
          technicalTerms: [
            ...(state.steLexicon?.technicalTerms ?? []),
            ...packet.inputContext.glossary.map((item) => item.text),
          ],
          prohibitedAliases: state.steLexicon?.prohibitedAliases,
        }),
        files,
        uploadFiles: files.map((f) => f.path),
      }
    },
    async capabilitiesExportImplementationPacket(input) {
      const state = ensureCap(input.projectId)
      const moduleDesign = state.moduleDesignApproved.get(input.moduleId)
      if (
        state.applicationApproved
        && state.architectureApproved
        && !evaluateArchitectureApplicationLink(
          state.applicationApproved,
          state.architectureApproved,
        ).current
      ) {
        throw new Error('Approved architecture is stale. Revise it for the current application workflow.')
      }
      const requiresModuleDesign = Boolean(state.applicationApproved?.useCaseDefinitions?.length)
      if (requiresModuleDesign && !moduleDesign) {
        throw new Error(`Approved module design not found: ${input.moduleId}. Complete and approve the module design before implementation.`)
      }
      if (state.architectureApproved && moduleDesign && moduleDesign.architecture.contentHash !== state.architectureApproved.contentHash) {
        throw new Error(`Approved module design is stale for ${input.moduleId}.`)
      }
      const runId = `cap-implementation-${Date.now()}`
      const createdAt = now()
      state.capabilityRuns.set(runId, {
        schemaVersion: '1.0',
        runId,
        kind: 'implementation',
        projectId: input.projectId,
        targetOwnerId: input.moduleId,
        targetKind: 'module',
        lifecycleState: 'exported',
        inputRevisions: {
          module: 'mock',
          ...(moduleDesign ? { moduleDesign: moduleDesign.revision } : {}),
        },
        inputHashes: moduleDesign ? { moduleDesign: moduleDesign.contentHash } : {},
        allowedPaths: [],
        expectedPaths: [],
        protectedPaths: [],
        packetRefs: ['handoff.md'],
        artifactRefs: ['handoff.md'],
        transitionHistory: [{
          at: createdAt,
          actor: 'mock',
          fromState: 'draft',
          toState: 'exported',
        }],
        createdAt,
        updatedAt: createdAt,
      })
      const files = ['capability-implementation-handoff.md']
        .map((name) => ({ path: `/mock/${runId}/${name}`, bytes: 100, sha256: `mock-${name}` }))
      return {
        runId,
        packetId: `pkt-${input.moduleId}`,
        recommendedPrompt: withStePrompt(
          moduleDesign
            ? `Implement production source code and tests for ${input.moduleId}. Use approved design ${moduleDesign.revision}.`
            : `Implement production source code and tests for ${input.moduleId}. Use its approved legacy module record.`,
          {
            technicalTerms: state.steLexicon?.technicalTerms,
            prohibitedAliases: state.steLexicon?.prohibitedAliases,
          },
        ),
        files,
        uploadFiles: files.map((f) => f.path),
        readiness: { status: 'ready' as const, issues: [] },
      }
    },
    async capabilitiesExportImplementationWave(input) {
      const state = ensureCap(input.projectId)
      const architecture = state.architectureApproved
      if (!architecture) throw new Error('approved architecture not found')
      const plan = planImplementationWaves({
        projectId: input.projectId,
        architecture,
        modules: architecture.moduleIds.map((moduleId) => ({
          moduleId,
          approved: state.moduleApproved.get(moduleId),
        })),
      })
      const wave = plan.waves.find((candidate) => candidate.index === input.waveIndex)
      if (!wave) throw new Error(`implementation wave not found: ${input.waveIndex}`)
      const moduleIds = input.moduleIds?.length ? input.moduleIds : wave.targets.map((target) => target.moduleId)
      const requiresModuleDesign = Boolean(state.applicationApproved?.useCaseDefinitions?.length)
      const missingDesigns = requiresModuleDesign
        ? moduleIds.filter((moduleId) => !state.moduleDesignApproved.has(moduleId))
        : []
      if (missingDesigns.length) {
        throw new Error(`Approve module designs before implementation: ${missingDesigns.join(', ')}`)
      }
      const groupId = `cap-wave-${Date.now()}`
      const createdAt = now()
      const targets = moduleIds.map((moduleId, index) => {
        const manifest = state.moduleApproved.get(moduleId)
        if (!manifest || !wave.targets.some((target) => target.moduleId === moduleId)) {
          throw new Error(`${moduleId} is not in implementation wave ${input.waveIndex}`)
        }
        const runId = `cap-implementation-${Date.now()}-${index}`
        state.capabilityRuns.set(runId, {
          schemaVersion: '1.0',
          runId,
          kind: 'implementation',
          projectId: input.projectId,
          targetOwnerId: moduleId,
          targetKind: manifest.moduleType === 'connection' ? 'adapter' : 'module',
          parentRunId: groupId,
          lifecycleState: 'exported',
          inputRevisions: { module: manifest.moduleVersion, architecture: architecture.revision },
          inputHashes: { module: `mock-${moduleId}` },
          allowedPaths: manifest.ownedPaths,
          expectedPaths: [],
          protectedPaths: [],
          packetRefs: [`runs/waves/${groupId}/implementation-wave-${input.waveIndex}.md`],
          artifactRefs: [`runs/waves/${groupId}/implementation-wave-${input.waveIndex}.md`],
          transitionHistory: [{
            at: createdAt,
            actor: 'mock',
            fromState: 'draft',
            toState: 'exported',
          }],
          createdAt,
          updatedAt: createdAt,
        })
        return {
          moduleId,
          runId,
          packetId: `pkt-${moduleId}`,
          deliverable: implementationWaveDeliverable(moduleId),
          readiness: 'ready' as const,
        }
      })
      const files = [{
        path: `/mock/${groupId}/implementation-wave-${input.waveIndex}.md`,
        bytes: 100,
        sha256: `mock-${groupId}`,
      }]
      return {
        groupId,
        waveIndex: input.waveIndex,
        recommendedPrompt: withStePrompt(`Implement capability wave ${input.waveIndex}.`, {
          technicalTerms: state.steLexicon?.technicalTerms,
          prohibitedAliases: state.steLexicon?.prohibitedAliases,
        }),
        files,
        uploadFiles: files.map((file) => file.path),
        targets,
      }
    },
    async capabilitiesStartHandoffDrag() { return { files: 1 } },
    async capabilitiesImportInterviewResponse(projectId, raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      const response = (parsed as { draft?: ApplicationSpecification }).draft ?? (parsed as ApplicationSpecification)
      const state = ensureCap(projectId)
      const imported = importProductInterviewResponse(response, {
        projectId,
        approved: state.applicationApproved,
        lexicon: state.steLexicon,
      })
      state.applicationDraft = imported.draft
      return {
        ...imported,
        approvedUnchanged: state.applicationApproved,
      }
    },
    async capabilitiesGetArchitecture(projectId) {
      const state = ensureCap(projectId)
      return { draft: state.architectureDraft, approved: state.architectureApproved }
    },
    async capabilitiesSaveArchitectureDraft(projectId, draft) {
      ensureCap(projectId).architectureDraft = draft as ArchitectureSpecification
      return { ok: true as const }
    },
    async capabilitiesApproveArchitecture(projectId, draft) {
      const state = ensureCap(projectId)
      const candidate = draft as ArchitectureSpecification
      const gate = state.applicationApproved
        ? evaluateArchitectureProposal(state.applicationApproved, {
            architecture: candidate,
            moduleNeedTraces: candidate.moduleIds.map((moduleId) => ({
              moduleId,
              needIds: candidate.workflowTraces
                .filter((trace) => trace.moduleIds.includes(moduleId))
                .map((trace) => trace.useCaseId),
            })),
          }, state.steLexicon)
        : evaluateArchitectureGate(candidate, [], undefined, state.steLexicon)
      if (!gate.passed) return { ok: false, gate }
      const approved = { ...candidate, status: 'approved' as const }
      state.architectureApproved = approved
      state.architectureDraft = undefined
      return { ok: true, approved, gate }
    },
    async capabilitiesProposeFoundation(input) {
      const state = ensureCap(input.projectId)
      const architecture = state.architectureApproved
      if (!architecture) throw new Error('architecture must be approved before proposing a foundation')
      return proposeFoundation({ architecture, answers: input.answers })
    },
    async capabilitiesGetFoundation(projectId) {
      const state = ensureCap(projectId)
      return { draft: state.foundationDraft, approved: state.foundationApproved }
    },
    async capabilitiesSaveFoundationDraft(projectId, plan) {
      ensureCap(projectId).foundationDraft = plan
      return { ok: true as const }
    },
    async capabilitiesApproveFoundation(projectId, plan) {
      if (plan.readiness.status !== 'ready') {
        return { ok: false, reason: `cannot approve a foundation plan with readiness status "${plan.readiness.status}"` }
      }
      const state = ensureCap(projectId)
      state.foundationApproved = plan
      state.foundationDraft = undefined
      return { ok: true, approved: plan }
    },
    async capabilitiesGetIntegrationState(projectId) {
      const state = ensureCap(projectId)
      const deployables = [...ensureDeployables(projectId).values()].map((deployable) => {
        const currentPlan = state.generationPlans.get(deployable.deployableId)
        const latestApply = state.generationApplies.get(deployable.deployableId)
        return {
          deployableId: deployable.deployableId,
          status: latestApply?.status ?? (currentPlan ? (currentPlan.blockers.length ? 'blocked' : 'plan-ready') : 'ready-to-generate'),
          attention: currentPlan ? [] : ['Generate and review the reference-architecture plan.'],
          currentPlan,
          latestApply,
          connectionVerifications: [...state.connectionVerifications.values()].filter((record) => record.deployableId === deployable.deployableId),
          currentConnectionVerificationIds: [],
        }
      }) satisfies CapabilityIntegrationState['deployables']
      return { schemaVersion: '1.0', projectId, deployables, updatedAt: now() }
    },
    async capabilitiesPreviewGeneration(input) {
      const state = ensureCap(input.projectId)
      const plan: GenerationPlan = {
        schemaVersion: '1.0', planId: `mock-plan-${input.deployableId}`, projectId: input.projectId,
        inputRecords: [], generatorVersion: '1.0.0', referenceProfileVersion: '1.0.0',
        targetRepository: { root: '.', cleanState: 'clean' }, dependencyChanges: [], fileChanges: [], commands: [],
        warnings: [], blockers: ['Browser mock cannot produce filesystem-backed generation artifacts. Open the desktop app.'],
        ambiguityQuestions: [], rollbackStrategy: 'staged-rename-with-journal', planHash: `mock-${input.deployableId}`,
      }
      state.generationPlans.set(input.deployableId, plan)
      return { plan, status: 'blocked' as const }
    },
    async capabilitiesApplyGeneration(input) {
      if (!input.explicit) throw new Error('generation apply requires explicit user action')
      const state = ensureCap(input.projectId)
      const plan = state.generationPlans.get(input.deployableId)
      if (!plan || plan.planId !== input.planId || plan.planHash !== input.planHash) throw new Error('generation plan mismatch')
      if (plan.blockers.length) throw new Error(`generation apply refused: ${plan.blockers.join(' ')}`)
      const record: GenerationApplyRecord = {
        schemaVersion: '1.0', projectId: input.projectId, deployableId: input.deployableId,
        planId: plan.planId, planHash: plan.planHash, applyRunId: `mock-apply-${input.deployableId}`,
        status: 'applied', rollbackId: `mock-apply-${input.deployableId}`,
        ownershipManifests: [], commands: [], startedAt: now(), completedAt: now(),
      }
      state.generationApplies.set(input.deployableId, record)
      return record
    },
    async capabilitiesRollbackGeneration(input) {
      if (!input.explicit) throw new Error('generation rollback requires explicit user action')
      const state = ensureCap(input.projectId)
      const current = state.generationApplies.get(input.deployableId)
      if (!current || current.rollbackId !== input.rollbackId) throw new Error('rollback mismatch')
      const record: GenerationApplyRecord = { ...current, status: 'rolled-back', ownershipManifests: [], completedAt: now() }
      state.generationApplies.set(input.deployableId, record)
      return record
    },
    async capabilitiesRunConnectionVerification() {
      throw new Error('Real connection verification requires the desktop app so it can launch and clean up the generated target.')
    },
    async capabilitiesListConnectionVerifications(input) {
      return [...ensureCap(input.projectId).connectionVerifications.values()]
        .filter((record) => !input.deployableId || record.deployableId === input.deployableId)
    },
    async capabilitiesSaveCompositionConfiguration() {
      throw new Error('Composition configuration is persisted by the desktop app against the real project workspace.')
    },
    async capabilitiesRunIntegrationCommands() {
      throw new Error('Install, build, and test commands require the desktop app and a real project repository.')
    },
    async capabilitiesSaveModuleDraft(projectId, draft, interviewResponse) {
      const manifest = draft as ModuleManifest
      const state = ensureCap(projectId)
      state.moduleDrafts.set(manifest.moduleId, manifest)
      if (interviewResponse) state.moduleInterviewDrafts.set(manifest.moduleId, interviewResponse as ModuleInterviewResponse)
      return { ok: true as const }
    },
    async capabilitiesApproveModule(projectId, draft, interviewResponse) {
      const state = ensureCap(projectId)
      const candidate = draft as ModuleManifest
      const approvedInterview = interviewResponse as ModuleInterviewResponse | undefined
        ?? state.moduleInterviewDrafts.get(candidate.moduleId)
      const candidateGate = evaluateModuleGate(candidate, undefined, state.steLexicon)
      const interviewGate = approvedInterview
        ? evaluateModuleInterview(approvedInterview, state.steLexicon)
        : undefined
      const gate = interviewGate
        ? {
            ...interviewGate,
            diagnostics: [...candidateGate.diagnostics, ...interviewGate.diagnostics]
              .filter((item, index, items) => items.findIndex((candidateItem) =>
                candidateItem.code === item.code
                && candidateItem.fieldPath === item.fieldPath
                && candidateItem.message === item.message) === index),
          }
        : candidateGate
      gate.passed = gate.diagnostics.length === 0
      if (!gate.passed) return { ok: false, gate }
      state.moduleApproved.set(candidate.moduleId, candidate)
      if (approvedInterview) state.moduleInterviewApproved.set(candidate.moduleId, approvedInterview)
      state.moduleDrafts.delete(candidate.moduleId)
      return { ok: true, approved: candidate, gate }
    },
    async capabilitiesProposeModuleBatch(projectId) {
      const state = ensureCap(projectId)
      const architecture = state.architectureApproved
      if (!architecture) throw new Error('Approve the architecture before generating module proposals.')
      const existing = architecture.moduleIds.map((moduleId) => ({
        moduleId,
        draft: state.moduleDrafts.get(moduleId),
        approved: state.moduleApproved.get(moduleId),
      }))
      const batch = proposeArchitectureModuleBatch({ projectId, architecture, existing })
      const savedDraftModuleIds: string[] = []
      const preservedModuleIds: string[] = []
      for (const proposal of batch.proposals) {
        if (state.moduleApproved.has(proposal.moduleId) || state.moduleDrafts.has(proposal.moduleId)) {
          preservedModuleIds.push(proposal.moduleId)
        } else {
          state.moduleDrafts.set(proposal.moduleId, proposal.manifest)
          savedDraftModuleIds.push(proposal.moduleId)
        }
      }
      return { ...batch, savedDraftModuleIds, preservedModuleIds }
    },
    async capabilitiesApproveModuleBatch(input) {
      if (!input.explicit) throw new Error('Batch approval requires explicit confirmation.')
      const state = ensureCap(input.projectId)
      const architecture = state.architectureApproved
      if (!architecture) throw new Error('Approve the architecture before approving modules.')
      const selected = [...new Set(input.moduleIds)].filter((moduleId) =>
        architecture.moduleIds.includes(moduleId),
      )
      const results = selected.map((moduleId) => {
        const approved = state.moduleApproved.get(moduleId)
        if (approved) return { moduleId, status: 'already-approved' as const, ok: true as const, approved }
        const draft = state.moduleDrafts.get(moduleId)
        if (!draft) return { moduleId, status: 'missing' as const, ok: false as const }
        const gate = evaluateModuleGate(draft, undefined, state.steLexicon)
        if (!gate.passed) return { moduleId, status: 'blocked' as const, ok: false as const, gate }
        state.moduleApproved.set(moduleId, draft)
        state.moduleDrafts.delete(moduleId)
        return { moduleId, status: 'approved' as const, ok: true as const, gate, approved: draft }
      })
      return { ok: results.length > 0 && results.every((result) => result.ok), results }
    },
    async capabilitiesPlanImplementationWaves(projectId) {
      const state = ensureCap(projectId)
      const architecture = state.architectureApproved
      if (!architecture) throw new Error('Approve the architecture before planning implementation.')
      return planImplementationWaves({
        projectId,
        architecture,
        modules: architecture.moduleIds.map((moduleId) => ({
          moduleId,
          draft: state.moduleDrafts.get(moduleId),
          approved: state.moduleApproved.get(moduleId),
        })),
      })
    },
    async capabilitiesCompileFrontendBrief(input) {
      const state = ensureCap(input.projectId)
      const architecture = state.architectureApproved
      if (!architecture) throw new Error('Approve the architecture before compiling a frontend brief.')
      const inbound = [...state.inboundBindingApproved.values()]
      const canonicalIds = new Set(inbound.map((binding) => binding.bindingId))
      const legacy = [...state.bindingApproved.values()]
        .filter((binding) => !canonicalIds.has(binding.bindingId))
      return compileFrontendBrief({
        projectId: input.projectId,
        application: state.applicationApproved,
        architecture,
        modules: [...state.moduleApproved.values()],
        moduleDesigns: [...state.moduleDesignApproved.values()],
        bindings: [...inbound, ...legacy],
        targetModuleIds: input.targetModuleIds,
        steLexicon: state.steLexicon,
      })
    },
    async capabilitiesListModules(projectId) {
      const state = ensureCap(projectId)
      const architecture = state.architectureApproved ?? state.architectureDraft
      const moduleIds = [...new Set([
        ...(architecture?.moduleIds ?? []),
        ...state.moduleDrafts.keys(),
        ...state.moduleApproved.keys(),
      ])].sort((a, b) => a.localeCompare(b))
      return moduleIds.map((moduleId) => ({
        moduleId,
        draft: state.moduleDrafts.get(moduleId),
        approved: state.moduleApproved.get(moduleId),
        freshness: state.freshness.get(moduleId),
      }))
    },
    async capabilitiesListModuleDesigns(projectId) {
      const state = ensureCap(projectId)
      const moduleIds = [...new Set([
        ...state.moduleDrafts.keys(),
        ...state.moduleApproved.keys(),
        ...state.moduleDesignDrafts.keys(),
        ...state.moduleDesignApproved.keys(),
      ])].sort((a, b) => a.localeCompare(b))
      return moduleIds.map((moduleId) => ({
        moduleId,
        draft: state.moduleDesignDrafts.get(moduleId),
        approved: state.moduleDesignApproved.get(moduleId),
        session: state.moduleDesignSessions.get(moduleId),
      }))
    },
    async capabilitiesCreateModuleDesignDraft(input) {
      const state = ensureCap(input.projectId)
      const application = state.applicationApproved
      const architecture = state.architectureApproved
      const manifest = state.moduleApproved.get(input.moduleId) ?? state.moduleDrafts.get(input.moduleId)
      if (!application || !architecture || !manifest) {
        throw new Error('Approve the application and architecture, then create the module manifest.')
      }
      const previous = state.moduleDesignApproved.get(input.moduleId)
      const approvedInterview = state.moduleInterviewApproved.get(input.moduleId)
      const revision = previous
        ? (/^(\d+)\.(\d+)\.(\d+)$/.test(previous.revision)
            ? previous.revision.replace(/^(\d+)\.(\d+)\.(\d+)$/, (_, major, minor, patch) => `${major}.${minor}.${Number(patch) + 1}`)
            : `${previous.revision}-next`)
        : manifest.moduleVersion
      const design = createModuleDesignDraft({
        application,
        architecture,
        manifest,
        behaviorDraft: approvedInterview?.behaviorDraft,
        steLexicon: state.steLexicon,
        revision,
      })
      const existingSession = state.moduleDesignSessions.get(input.moduleId)
      const session = existingSession && existingSession.state !== 'completed' ? existingSession : createModuleDesignSession({
        projectId: input.projectId,
        moduleId: input.moduleId,
        architecture,
        baseModuleDesignRevision: design.revision,
      })
      state.moduleDesignDrafts.set(input.moduleId, design)
      state.moduleDesignSessions.set(input.moduleId, session)
      return { design, session }
    },
    async capabilitiesSaveModuleDesignDraft(projectId, draft) {
      return saveMockModuleDesign(projectId, draft)
    },
    async capabilitiesApproveModuleDesign(input) {
      if (!input.explicit) throw new Error('Module design approval requires explicit confirmation.')
      const saved = saveMockModuleDesign(input.projectId, input.draft)
      if (saved.diagnostics.length) return { ok: false, design: saved.design, diagnostics: saved.diagnostics }
      const approved: ModuleDesignSpecification = {
        ...saved.design,
        status: 'approved',
        approval: {
          approvedAt: now(),
          approvedBy: input.approvedBy,
          sourceHashes: {
            architecture: saved.design.architecture.contentHash,
            draft: saved.design.contentHash,
          },
          openNonblockingItemIds: [],
        },
        contentHash: '',
      }
      approved.contentHash = canonicalHash({ ...approved, contentHash: undefined })
      const state = ensureCap(input.projectId)
      state.moduleDesignApproved.set(approved.module.moduleId, approved)
      state.moduleDesignDrafts.delete(approved.module.moduleId)
      return { ok: true, approved, diagnostics: [] }
    },
    async capabilitiesSaveModuleDesignSession(projectId, session) {
      ensureCap(projectId).moduleDesignSessions.set(session.moduleId, { ...session, updatedAt: now() })
      return { ok: true as const }
    },
    async capabilitiesListScenarioRuns(projectId) {
      return [...ensureCap(projectId).scenarioRuns.values()]
        .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
    },
    async capabilitiesCreateScenarioRun(input) {
      const state = ensureCap(input.projectId)
      if (!state.applicationApproved || !state.architectureApproved) {
        throw new Error('Approve the application and architecture before preparing scenario verification.')
      }
      const scenario = compileScenarioDefinitions(state.applicationApproved)
        .find((candidate) => candidate.id === input.scenarioId)
      const trace = state.architectureApproved.workflowTraces
        .find((candidate) => candidate.useCaseId === scenario?.useCaseId)
      const missingDesignIds = (trace?.moduleIds ?? []).filter((moduleId) => {
        const design = state.moduleDesignApproved.get(moduleId)
        return !design || design.architecture.contentHash !== state.architectureApproved!.contentHash
      })
      if (missingDesignIds.length) {
        throw new Error(`Approve current module designs before scenario verification: ${missingDesignIds.join(', ')}`)
      }
      const record = createScenarioRun({
        runId: `scenario-${Date.now()}`,
        application: state.applicationApproved,
        architecture: state.architectureApproved,
        moduleDesigns: [...state.moduleDesignApproved.values()],
        scenarioId: input.scenarioId,
        build: input.build,
        sourceRevision: input.sourceRevision,
        environment: input.environment,
        testDataRevision: input.testDataRevision,
        runner: input.runner,
        implementationRevisions: input.implementationRevisions,
        connectionRevision: input.connectionRevision,
      })
      state.scenarioRuns.set(record.runId, record)
      return record
    },
    async capabilitiesRunScenarioCommand() {
      throw new Error('Configured scenario commands run only in the desktop app against the selected project repository.')
    },
    async capabilitiesRecordScenarioStep(input) {
      const state = ensureCap(input.projectId)
      const current = state.scenarioRuns.get(input.runId)
      if (!current) throw new Error('Scenario run not found.')
      const evidenceHashes = Object.fromEntries(input.evidence.flatMap((item) => {
        if (!item.artifactId) return []
        const artifact = state.scenarioEvidence.get(`${input.runId}:${item.artifactId}`)
        if (!artifact) throw new Error(`Scenario evidence artifact not found: ${item.artifactId}`)
        return [[item.artifactId, artifact.reference.checksum]]
      }))
      const record = recordScenarioStep({ ...input, record: current, evidenceHashes })
      state.scenarioRuns.set(record.runId, record)
      return record
    },
    async capabilitiesFinalizeScenarioRun(input) {
      const state = ensureCap(input.projectId)
      const application = state.applicationApproved
      const architecture = state.architectureApproved
      const current = state.scenarioRuns.get(input.runId)
      if (!application || !architecture || !current) {
        throw new Error('Approved application, architecture, and scenario run are required.')
      }
      const finalized = finalizeScenarioRun(application, current, undefined, {
        architecture,
        moduleDesigns: [...state.moduleDesignApproved.values()],
      })
      state.scenarioRuns.set(finalized.record.runId, finalized.record)
      return finalized
    },
    async capabilitiesSaveScenarioEvidence(input) {
      const state = ensureCap(input.projectId)
      if (!state.scenarioRuns.has(input.runId)) throw new Error('Scenario run not found.')
      const reference: ArtifactReference = {
        schemaVersion: '1.0',
        artifactId: input.artifactId,
        projectId: input.projectId,
        mediaType: input.mediaType,
        checksum: canonicalHash(input.base64),
        byteSize: Math.ceil(input.base64.length * 0.75),
        createdAt: now(),
        producingOperationId: input.producingOperationId,
        producingRunId: input.runId,
        provenance: { source: input.provenanceSource, recordedAt: now() },
        storageClass: 'app-managed',
        opaqueStorageRef: `mock/${input.runId}/${input.artifactId}`,
      }
      state.scenarioEvidence.set(`${input.runId}:${input.artifactId}`, { reference, base64: input.base64 })
      return reference
    },
    async capabilitiesGetScenarioEvidence(input) {
      return ensureCap(input.projectId).scenarioEvidence.get(`${input.runId}:${input.artifactId}`)
    },
    async capabilitiesListBindings(projectId) {
      const state = ensureCap(projectId)
      const bindingIds = [...new Set([
        ...state.bindingDrafts.keys(),
        ...state.bindingApproved.keys(),
      ])].sort((a, b) => a.localeCompare(b))
      return bindingIds.map((bindingId) => ({
        bindingId,
        draft: state.bindingDrafts.get(bindingId),
        approved: state.bindingApproved.get(bindingId),
      }))
    },
    async capabilitiesListRuns(projectId) {
      return [...ensureCap(projectId).capabilityRuns.values()]
    },
    async capabilitiesCreateRun(run) {
      const record = run as CapabilityRunScope
      const created = {
        ...record,
        runId: record.runId ?? `run-${Date.now()}`,
        createdAt: record.createdAt ?? now(),
        updatedAt: record.updatedAt ?? now(),
      }
      ensureCap(created.projectId).capabilityRuns.set(created.runId, created)
      return created
    },
    async capabilitiesInspectOverlay() {
      return {
        runId: 'mock',
        zipFilename: 'ui-overlay.zip',
        inspectedAt: now(),
        normalizedEntries: [],
        hardBlockers: [],
        warnings: [],
        canApply: false,
      }
    },
    async capabilitiesApplyOverlay(input) {
      if (!input.explicit) throw new Error('capability overlay apply requires explicit user action')
      return { runId: input.runId, appliedAt: now(), files: [] }
    },
    async capabilitiesCalculateFreshness(input) {
      return calculateFreshness(input as Parameters<typeof calculateFreshness>[0])
    },
    async capabilitiesFilesystemRead() {
      return { outcome: 'success', value: { text: '' } }
    },
    async capabilitiesFilesystemWrite(input) {
      if (!input.explicit) throw new Error('filesystem write requires explicit user action')
      return { outcome: 'success', value: { relativePath: input.relativePath, bytes: input.text.length } }
    },
    async capabilitiesSecretPut(input) {
      if (!input.explicit) throw new Error('secret write requires explicit user action')
      return { outcome: 'success', value: { opaqueId: input.opaqueId, label: input.label, stored: true } }
    },
    async capabilitiesMatlabSessionStatus(projectId) {
      return {
        schemaVersion: '1.0',
        projectId,
        sessionId: `matlab-${projectId}-stopped`,
        state: 'stopped',
        toolboxReadiness: [],
        processOwnership: 'app-owned',
      }
    },
    async capabilitiesMatlabInvoke(input) {
      if (!input.explicit) throw new Error('MATLAB operation requires explicit user action')
      return { outcome: 'success', value: { mode: 'fake-boundary' } }
    },
    async capabilitiesAzureDiscover(input) {
      if (!input.explicit) throw new Error('Azure discovery requires explicit user action')
      return {
        outcome: 'success',
        value: {
          organizations: [],
          permissionSummary: ['organization:read', 'project:read', 'work-item:read'],
          mode: 'fake-boundary',
        },
      }
    },
    async capabilitiesAzureImportWorkItem(input) {
      if (!input.explicit) throw new Error('Azure import requires explicit user action')
      return {
        outcome: 'success',
        value: {
          externalId: input.externalId,
          revision: input.revision,
          content: input.content,
          mode: 'fake-boundary',
        },
        provenance: { source: 'azure-devops', recordedAt: now() },
      }
    },
    async capabilitiesInvokeOperation(input) {
      const dataMode = input.dataMode ?? 'connected'
      if (dataMode !== 'connected') {
        return {
          outcome: 'success',
          value: { simulated: true, dataMode, operationId: input.operationId },
          provenance: { source: 'runtime-simulated', recordedAt: new Date().toISOString() },
        }
      }
      if (!input.explicit) {
        throw new Error('connected invoke requires explicit user action')
      }
      return {
        outcome: 'success',
        value: { operationId: input.operationId, dataMode: 'connected', args: input.args ?? null },
        provenance: { source: 'runtime', recordedAt: new Date().toISOString() },
      }
    },
    async capabilitiesSaveBindingDraft(projectId, draft) {
      const binding = draft as FrontendBinding
      ensureCap(projectId).bindingDrafts.set(binding.bindingId, binding)
      return { ok: true as const }
    },
    async capabilitiesApproveBinding(projectId, draft) {
      const binding = draft as FrontendBinding
      const state = ensureCap(projectId)
      if (!binding?.selectionEvidence?.stableMarker && !binding?.selectionEvidence?.sourceTargetConfirmed) {
        return {
          ok: false,
          diagnostics: [
            {
              code: 'CAP-BIND-001',
              message: 'stable marker or explicit source-target confirmation is required',
            },
          ],
        }
      }
      const gate = evaluateBindingApprovalGate(binding, {
        steLexicon: state.steLexicon,
      })
      if (!gate.passed) {
        return { ok: false, diagnostics: gate.diagnostics }
      }
      state.bindingApproved.set(binding.bindingId, binding)
      state.bindingDrafts.delete(binding.bindingId)
      return { ok: true, approved: binding }
    },
    async capabilitiesListDeployables(projectId) {
      return [...ensureDeployables(projectId).values()].sort((a, b) => a.deployableId.localeCompare(b.deployableId))
    },
    async capabilitiesListInboundBindings(projectId) {
      const state = ensureCap(projectId)
      const bindingIds = [...new Set([
        ...state.inboundBindingDrafts.keys(),
        ...state.inboundBindingApproved.keys(),
      ])].sort((a, b) => a.localeCompare(b))
      return bindingIds.map((bindingId) => ({
        bindingId,
        draft: state.inboundBindingDrafts.get(bindingId),
        approved: state.inboundBindingApproved.get(bindingId),
      }))
    },
    async capabilitiesSaveInboundBindingDraft(projectId, draft) {
      // Missing/omitted exposure is always treated as private (§5.1) — never silently escalated.
      const binding: InboundBinding = { ...draft, exposure: draft.exposure ?? 'private' }
      ensureCap(projectId).inboundBindingDrafts.set(binding.bindingId, binding)
      return { ok: true as const }
    },
    async capabilitiesApproveInboundBinding(projectId, draft) {
      const binding: InboundBinding = { ...draft, exposure: draft.exposure ?? 'private', approvalState: 'approved' }
      const issues = validateInboundBindingDraft(binding)
      const state = ensureCap(projectId)
      const diagnostics = [
        ...issues.map((message) => ({ code: 'CAP-BIND-INBOUND-001', message })),
        ...evaluateInboundBindingSte(binding, state.steLexicon).diagnostics,
      ]
      if (diagnostics.length > 0) return { ok: false, diagnostics }
      // Multiple bindings may target the same operation — none are deduplicated (§12.4).
      state.inboundBindingApproved.set(binding.bindingId, binding)
      state.inboundBindingDrafts.delete(binding.bindingId)
      return { ok: true, approved: binding }
    },
    async capabilitiesArchiveInboundBinding(projectId, bindingId) {
      const state = ensureCap(projectId)
      state.inboundBindingDrafts.delete(bindingId)
      state.inboundBindingApproved.delete(bindingId)
      return { ok: true as const }
    },
    async capabilitiesListNeedsAttention(projectId) {
      return listNeedsAttentionFor(projectId)
    },
    async capabilitiesCalculateImpact(input) {
      const state = ensureCap(input.projectId)
      const arch = state.architectureApproved ?? state.architectureDraft
      const affected = input.changedModuleIds.map((moduleId) => ({ moduleId, reason: 'initiating-change' }))
      return {
        schemaVersion: '1.0', changeId: `impact-${Date.now()}`,
        initiatingRecordId: input.changedModuleIds[0] ?? input.projectId,
        initiatingRevision: arch?.revision ?? '0', classification: input.classification,
        affectedModules: affected,
        unaffectedModules: (arch?.moduleIds ?? []).filter((id) => !input.changedModuleIds.includes(id)).map((moduleId) => ({ moduleId, reason: 'no-dependency-path' })),
        proposedPacketOrder: input.changedModuleIds, recalculationEvidence: [],
      }
    },
    async capabilitiesApproveImpact(projectId, impact) {
      const approved = { ...impact, userApproval: { approved: true, at: now(), by: 'user' } }
      const state = ensureCap(projectId) as CapProjectState & { impacts?: Map<string, typeof approved> }
      state.impacts ??= new Map()
      state.impacts.set(approved.changeId, approved)
      return approved
    },
    async capabilitiesListImpacts(projectId) {
      const state = ensureCap(projectId) as CapProjectState & { impacts?: Map<string, import('@engineering-ui-kit/core').ImpactRecord> }
      return [...(state.impacts?.values() ?? [])]
    },
    async capabilitiesRunModuleVerification(input) {
      const result = runModuleVerification(input as Parameters<typeof runModuleVerification>[0])
      const state = ensureCap(input.projectId)
      const hashes = input.inputHashes
      const freshness = calculateFreshness({
        moduleId: input.moduleId,
        moduleVersion: input.manifest?.moduleVersion ?? '1.0.0',
        specificationHash: hashes.specification ?? 'pending',
        implementationHash: hashes.implementation ?? 'pending',
        architectureHash: hashes.architecture ?? 'pending',
        dependencyHash: hashes.dependencies ?? 'pending',
        adapterHash: hashes.adapters ?? 'pending',
        bindingHash: hashes.bindings ?? 'pending',
        verificationSuiteHash: hashes.verificationSuites ?? 'pending',
        verification: result.record,
      })
      state.freshness.set(input.moduleId, freshness)
      return result
    },
    async capabilitiesVerifyApprovedModule(input) {
      if (!input.explicit) throw new Error('module verification requires explicit user action')
      const state = ensureCap(input.projectId)
      const manifest = state.moduleApproved.get(input.moduleId)
      if (!manifest) throw new Error(`approved module not found: ${input.moduleId}`)
      const hashes = {
        specification: `spec:${manifest.moduleId}@${manifest.moduleVersion}`,
        implementation: 'mock-implementation',
        architecture: state.architectureApproved?.contentHash ?? 'mock-architecture',
        dependencies: 'mock-dependencies',
        adapters: 'mock-adapters',
        bindings: 'mock-bindings',
        verificationSuites: 'mock-suites',
      }
      const result = runModuleVerification({
        verificationId: `ver-${input.moduleId}-${Date.now()}`,
        projectId: input.projectId,
        moduleId: input.moduleId,
        moduleType: manifest.moduleType,
        manifest,
        inputHashes: hashes,
        currentHashes: hashes,
        commands: [{ label: 'mock-project-check', exitCode: 0, passed: true, kind: 'technical' }],
      })
      state.freshness.set(
        input.moduleId,
        calculateFreshness({
          moduleId: input.moduleId,
          moduleVersion: manifest.moduleVersion,
          specificationHash: hashes.specification,
          implementationHash: hashes.implementation,
          architectureHash: hashes.architecture,
          dependencyHash: hashes.dependencies,
          adapterHash: hashes.adapters,
          bindingHash: hashes.bindings,
          verificationSuiteHash: hashes.verificationSuites,
          verification: result.record,
        }),
      )
      const vstate = state as CapProjectState & {
        verifications?: Map<string, import('@engineering-ui-kit/core').VerificationRecord>
      }
      vstate.verifications ??= new Map()
      vstate.verifications.set(result.record.verificationId, result.record)
      return result
    },
    async capabilitiesDeltaQueueState(input) {
      const state = ensureCap(input.projectId) as CapProjectState & {
        impacts?: Map<string, import('@engineering-ui-kit/core').ImpactRecord>
        deltaProgress?: Map<string, string[]>
      }
      const impact = state.impacts?.get(input.changeId)
      if (!impact) throw new Error(`impact not found: ${input.changeId}`)
      return deltaQueueState(impact, state.deltaProgress?.get(input.changeId) ?? [])
    },
    async capabilitiesExportDeltaPacket(input) {
      const state = ensureCap(input.projectId) as CapProjectState & {
        impacts?: Map<string, import('@engineering-ui-kit/core').ImpactRecord>
        deltaProgress?: Map<string, string[]>
      }
      const impact = state.impacts?.get(input.changeId)
      if (!impact) throw new Error(`impact not found: ${input.changeId}`)
      if (!impact.userApproval?.approved) {
        throw new Error('impact must be explicitly approved before delta export')
      }
      assertTargetExportable(impact, state.deltaProgress?.get(input.changeId) ?? [], input.targetId)
      const runId = `cap-delta-${input.targetId}-${Date.now()}`
      const base = `runs/${runId}/handoff`
      const files = [
        { path: `${base}/capability-delta-handoff.md`, bytes: 1152, sha256: 'mock-delta-handoff' },
      ]
      return {
        runId,
        packetId: `pkt-delta-${input.targetId}`,
        recommendedPrompt: withStePrompt(
          `Apply only the delta for ${input.targetId}. Return only ui-overlay.zip.`,
          {
            technicalTerms: state.steLexicon?.technicalTerms,
            prohibitedAliases: state.steLexicon?.prohibitedAliases,
          },
        ),
        files,
        uploadFiles: files.map((f) => f.path),
      }
    },
    async capabilitiesMarkDeltaTargetComplete(input) {
      if (!input.explicit) throw new Error('marking a delta target complete requires explicit user action')
      const state = ensureCap(input.projectId) as CapProjectState & {
        impacts?: Map<string, import('@engineering-ui-kit/core').ImpactRecord>
        deltaProgress?: Map<string, string[]>
        verifications?: Map<string, import('@engineering-ui-kit/core').VerificationRecord>
      }
      const impact = state.impacts?.get(input.changeId)
      if (!impact) throw new Error(`impact not found: ${input.changeId}`)
      const verification = state.verifications?.get(input.verificationId)
      if (!verification) throw new Error(`verification not found: ${input.verificationId}`)
      if (verification.moduleId !== input.targetId) {
        throw new Error('verification does not match the delta target')
      }
      if (verification.outcome !== 'passed') {
        throw new Error(`cannot complete target ${input.targetId}; verification outcome is ${verification.outcome}`)
      }
      state.deltaProgress ??= new Map()
      const done = state.deltaProgress.get(input.changeId) ?? []
      if (!done.includes(input.targetId)) done.push(input.targetId)
      state.deltaProgress.set(input.changeId, done)
      return deltaQueueState(impact, done)
    },
  }
}
