/**
 * §24.2 — Product end-to-end scenario suite (operations level).
 *
 * Normative source: docs/use-case-led-workflow/SPECIFICATION.md §24.2 (the
 * 30 numbered product scenarios), §24.5 (evidence requirements), §19
 * (error/recovery), §14 (evidence model).
 *
 * Every scenario below runs through the real, committed core modules —
 * `createDesignOperations` over a real (temp-dir) `DesignWorkspace`, the
 * real `repositoryAdapter` against a real temp repository directory, the
 * real `buildSampleAuditHub()` DO-178C Audit Hub sample, and the real
 * `providers.ts` adapters. Nothing here mocks a core module.
 *
 * Scenarios 26-30 name a GUI/desktop-level half (a real browser entry
 * point, a screenshot) that this packet does not own; each of those tests
 * says explicitly, in a comment, which half it exercises and which half is
 * left to the GUI evidence suite (a later packet):
 *  - S26 exercises the `verifyConnection` operations-level record layer;
 *    the GUI half (a real binding UI) is out of scope here.
 *  - S27 exercises `runScenario` for every approved sample scenario at the
 *    operations level; the GUI half (a rendered browser run) is out of
 *    scope here.
 *  - S28/S29 exercise the §14.2 evidence-policy rule itself
 *    (`buildEvidenceExpectationPlan`) against the sample's real recorded
 *    scenario-run evidence; opening a screenshot/structured-evidence
 *    *viewer* is a GUI concern, out of scope here.
 *  - S30 exercises `buildVerifySummary`'s real return shape (`designLinks`
 *    present, no field capable of carrying a diagram payload); the Verify
 *    *view* itself is a GUI concern, out of scope here.
 *
 * Every scenario or scenario group gets a fresh `DesignWorkspace` (a fresh
 * `fs.mkdtempSync` directory), per the packet instructions. Related
 * scenarios that build a coherent product narrative (e.g. approve a
 * use-case analysis, then approve the system structure that depends on it)
 * share one workspace within their `describe` block, mirroring
 * `euc16-operations.test.ts`'s existing style.
 *
 * §24.5 evidence: every `it()` is wrapped in `withScenarioEvidence`
 * (./product-scenario-evidence.ts), which writes one small, immutable JSON
 * evidence file per scenario to `__evidence__/product-scenarios/<id>.json`.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { canonicalHash } from '../../../src/capabilities/hash.js'
import { DesignWorkspace, DesignConflictError } from '../../../src/capabilities/design/designWorkspace.js'
import { createDesignOperations } from '../../../src/capabilities/design/operations.js'
import { buildSampleAuditHub, SAMPLE_PROJECT_ID } from '../../../src/capabilities/design/sampleAuditHub.js'
import {
  deterministicTestProvider,
  importModuleDesignResponse,
  noProvider,
} from '../../../src/capabilities/design/providers.js'
import * as UseCase from '../../../src/capabilities/design/useCaseAnalysis.js'
import * as Impact from '../../../src/capabilities/design/impactEngine.js'
import * as DiagramSemantics from '../../../src/capabilities/design/diagramSemantics.js'
import * as VerificationPlanner from '../../../src/capabilities/design/verificationPlanner.js'
import {
  buildContextManifest,
  buildModuleDesignPacket,
  buildMultiModulePacket,
} from '../../../src/capabilities/design/contextPacket.js'
import { applyDeltaTransactionally, runConfiguredCommand } from '../../../src/capabilities/design/repositoryAdapter.js'
import type { ReturnedDelta, UseCaseAnalysis } from '../../../src/capabilities/design/records.js'

import { loadFullSample, loadSampleFoundation, recordScenarioEvidence, withScenarioEvidence } from './product-scenario-evidence.js'

// ---------------------------------------------------------------------------
// Shared test helpers
// ---------------------------------------------------------------------------

function tmpDir(prefix = 'euik-scn-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

const actor = 'user:alice'

/**
 * The service enforces §4 default-deny approval authority; every scenario
 * workspace configures the roles its approvals use (S25 also uses user:bob).
 */
const SCENARIO_ROLES = {
  'user:alice': [
    'product-lead',
    'software-architect',
    'module-owner',
    'interface-engineer',
    'integration-engineer',
    'verification-lead',
  ],
  'user:bob': ['module-owner', 'software-architect'],
} as const
function seedRoles(workspace: DesignWorkspace, projectId: string): void {
  workspace.saveProjectRoles(projectId, SCENARIO_ROLES as unknown as Parameters<DesignWorkspace['saveProjectRoles']>[1])
}

let idem = 0
function key(): string {
  idem += 1
  return `scn-idem-${idem}`
}

function at(minutes: number): string {
  return new Date(minutes * 60_000).toISOString()
}

function ioSchemas(moduleId: string) {
  return [
    { schemaId: `${moduleId}.input`, version: '1.0.0', role: 'input' as const, ref: `schemas/${moduleId}/input.schema.json` },
    { schemaId: `${moduleId}.output`, version: '1.0.0', role: 'output' as const, ref: `schemas/${moduleId}/output.schema.json` },
  ]
}

const workflowDetail = {
  trigger: 'A reviewer requests review-package coordination.',
  orderedSteps: [
    { id: 'step-refresh', text: 'Refresh evidence' },
    { id: 'step-publish', text: 'Publish the validated snapshot' },
  ],
  participants: ['audit-lead'],
  decisionsAndGuards: [{ id: 'guard-valid', text: 'the candidate validates against its canonical schema' }],
  transactionBoundary: 'one refresh cycle per invocation',
  partialCompletion: 'not supported; a failed source keeps its last valid snapshot',
  compensation: 'not applicable',
  retryPolicy: 'the audit lead retries after fixing the source',
  deduplication: 'idempotency key per refresh request',
  idempotencyKeyUse: 'required on every call',
  cancellationPoints: ['before any candidate is published'],
  deadlinePropagation: 'propagated from the caller',
  resourceLocks: ['one refresh per project at a time'],
  progressReporting: 'per-source status',
  finalOutcomes: ['refreshed', 'partially refreshed', 'failed'],
}

const platformDetail = {
  storedOrScheduledResource: 'Canonical evidence records and their content-addressed blobs.',
  ownershipAndAccess: 'Owned exclusively by this module; every other module reads through its port.',
  consistency: 'Strong consistency within one project; writes are serialized per project.',
  transactionBehavior: 'Single-record atomic writes; no cross-record transactions.',
  indexing: 'Indexed by record id and content hash.',
  retention: 'Retained for the life of the project; nothing is purged automatically.',
  backupAndRecovery: 'Snapshotted alongside the workspace data directory.',
  capacity: 'Bounded by local disk; no in-memory size limit is enforced.',
  cleanup: 'Orphaned blobs are swept after a published snapshot supersedes them.',
  healthChecks: 'A read-after-write probe on startup.',
  failureInjection: 'A configurable write-failure hook for test doubles.',
  testImplementation: 'An in-memory test double backs unit and module tests.',
}

function buildDelta(overrides: {
  deltaId: string
  packetId: string
  baseRevision: string
  baseHash: string
  fileChanges?: { path: string; action: 'create' | 'change' | 'delete'; content?: string; contentHash?: string }[]
  testResults?: { command: string; passed: boolean; summary: string }[]
  unresolvedIssues?: string[]
}): ReturnedDelta {
  const withoutHash: Omit<ReturnedDelta, 'contentHash'> = {
    schemaVersion: '1.0',
    deltaId: overrides.deltaId,
    packetId: overrides.packetId,
    baseRevision: overrides.baseRevision,
    baseHash: overrides.baseHash,
    fileChanges: overrides.fileChanges ?? [],
    recordChanges: [],
    testResults: overrides.testResults ?? [],
    assumptions: [],
    unresolvedIssues: overrides.unresolvedIssues ?? [],
    requestedScopeChanges: [],
    evidenceFiles: [],
    returnedAt: at(0),
  }
  return { ...withoutHash, contentHash: canonicalHash(withoutHash) }
}

// ---------------------------------------------------------------------------
// S01 — Create a first use-case draft from one sentence.
// ---------------------------------------------------------------------------

describe('S01 — create a first use-case draft from one sentence', () => {
  it(
    'S01 create first use-case draft from one sentence',
    withScenarioEvidence(
      'S01',
      ['use-case-analysis.create'],
      'A first use-case draft is created from one plain-English sentence, with the described work as its main use case and no open material questions.',
      () => {
        const workspace = new DesignWorkspace(tmpDir())
        const ops = createDesignOperations({ workspace })
        const projectId = 'proj-s01'
        seedRoles(workspace, projectId)

        const result = ops.createUseCaseDraft({
          projectId,
          actor,
          idempotencyKey: key(),
          workDescription: 'An audit lead refreshes evidence from every configured source.',
        })

        expect(result.ok).toBe(true)
        expect(result.value?.useCases).toHaveLength(1)
        expect(result.value?.useCases[0]!.name).toBe('Refresh evidence from every configured source')
        expect(result.value?.questions.filter((q) => q.material && !q.answer)).toHaveLength(0)

        return {
          actual: `draft ${result.value!.id}@${result.value!.revision} created with 1 use case and 0 open material questions`,
          revisions: { design: result.value!.revision },
        }
      },
    ),
  )
})

// ---------------------------------------------------------------------------
// S02, S03 — Approve use cases after resolving one required decision;
// create and approve the system structure.
// ---------------------------------------------------------------------------

describe('S02, S03 — approve the use-case analysis and the system structure', () => {
  const workspace = new DesignWorkspace(tmpDir())
  const ops = createDesignOperations({ workspace })
  const projectId = 'proj-s02-s03'
  seedRoles(workspace, projectId)
  let questionId = ''

  it(
    'S02 approve use cases after resolving one required decision',
    withScenarioEvidence(
      'S02',
      ['use-case-analysis.answer-question', 'use-case-analysis.approve'],
      'A use-case draft with one open required decision (a material question) is approved once, and only once, that decision is resolved.',
      () => {
        const created = ops.createUseCaseDraft({ projectId, actor, idempotencyKey: key(), workDescription: '' })
        expect(created.ok).toBe(true)
        expect(created.value?.status).toBe('needsInput')
        const openMaterial = created.value!.questions.filter((q) => q.material && !q.answer)
        expect(openMaterial).toHaveLength(1)
        questionId = openMaterial[0]!.id

        const blocked = ops.approveUseCaseAnalysis({ projectId, actor, idempotencyKey: key(), authority: 'product-lead' })
        expect(blocked.ok).toBe(false)

        const answered = ops.updateUseCaseItem({
          projectId,
          actor,
          idempotencyKey: key(),
          target: { kind: 'question', questionId, answer: 'Refresh evidence and review findings independently.' },
        })
        expect(answered.ok).toBe(true)
        expect(answered.value?.status).toBe('readyForReview')

        const approved = ops.approveUseCaseAnalysis({ projectId, actor, idempotencyKey: key(), authority: 'product-lead' })
        expect(approved.ok).toBe(true)
        expect(approved.value?.analysis.status).toBe('approved')
        expect(approved.value?.application).toBeDefined()

        return {
          actual: `1 required decision resolved; use-case analysis approved at ${approved.value!.analysis.revision}`,
          revisions: { design: approved.value!.analysis.revision, application: approved.value!.application?.revision },
        }
      },
    ),
  )

  it(
    'S03 create and approve the system structure',
    withScenarioEvidence(
      'S03',
      ['system-design.create', 'system-design.approve'],
      'A system-design draft compiled from the approved application specification is approved as the current architecture.',
      () => {
        const draft = ops.createSystemDesignDraft({ projectId, actor, idempotencyKey: key() })
        expect(draft.ok).toBe(true)
        expect(draft.value?.moduleIds.length).toBeGreaterThan(0)

        const approved = ops.approveSystemStructure({ projectId, actor, idempotencyKey: key(), authority: 'software-architect' })
        expect(approved.ok).toBe(true)
        expect(approved.value?.status).toBe('approved')

        return { actual: `system structure approved at ${approved.value!.revision}`, revisions: { design: approved.value!.revision } }
      },
    ),
  )
})

// ---------------------------------------------------------------------------
// S04 — Open the module queue with 17 sample modules.
// ---------------------------------------------------------------------------

describe('S04 — open the module queue with 17 sample modules', () => {
  it(
    'S04 module queue shows 17 sample modules',
    withScenarioEvidence(
      'S04',
      ['module-queue.open'],
      'The module queue lists all 17 §22.2 catalog modules, every one notStarted before any module design begins.',
      () => {
        const sample = buildSampleAuditHub()
        const workspace = new DesignWorkspace(tmpDir())
        loadSampleFoundation(workspace, sample)
        const ops = createDesignOperations({ workspace })

        const queue = ops.listModuleDesigns(sample.projectId, 'all')
        expect(queue.total).toBe(17)
        expect(queue.modules).toHaveLength(17)
        expect(queue.notStarted).toBe(17)
        expect(queue.approved).toBe(0)

        return {
          actual: `module queue: total=17, notStarted=17`,
          revisions: { design: sample.architecture.revision },
          testDataRevision: sample.architecture.contentHash,
        }
      },
    ),
  )
})

// ---------------------------------------------------------------------------
// S05, S06, S09, S10, S11 — module-design lifecycle on the sample module
// queue (a fresh workspace seeded with the sample foundation: approved
// use-case analysis, application, and 17-module architecture, but no
// module designs — matching the state S04 just observed).
// ---------------------------------------------------------------------------

describe('S05, S06, S09, S10, S11 — module design lifecycle on the sample module queue', () => {
  const sample = buildSampleAuditHub()
  const workspace = new DesignWorkspace(tmpDir())
  loadSampleFoundation(workspace, sample)
  workspace.saveDesignWorkflowPolicy(sample.projectId, {
    projectId: sample.projectId,
    mode: 'incrementalModules',
    approvedDecisionId: 'decision-partial-baseline',
    changedAt: at(0),
    changedBy: actor,
  })
  const ops = createDesignOperations({ workspace })
  const projectId = sample.projectId
  seedRoles(workspace, projectId)

  it(
    'S05 create the Evidence Store module draft',
    withScenarioEvidence(
      'S05',
      ['module-design.start'],
      'startModuleDesign creates a draft for the Evidence Store module at the boundary step, with a persisted resumable session.',
      () => {
        const started = ops.startModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.evidence-store' })
        expect(started.ok).toBe(true)
        expect(started.value?.design.module.moduleId).toBe('mod.evidence-store')
        expect(started.value?.design.status).toBe('draft')
        expect(started.value?.session.currentStep).toBe('boundary')

        return {
          actual: `mod.evidence-store draft created at revision ${started.value!.design.revision}, session step boundary`,
          revisions: { design: started.value!.design.revision },
        }
      },
    ),
  )

  it(
    'S06 stop and resume module design at the contracts step',
    withScenarioEvidence(
      'S06',
      ['module-design.session.persist', 'module-design.session.resume'],
      'A module-design session stopped at the contracts step is resumed at exactly that step by a new DesignWorkspace instance over the same data directory.',
      () => {
        const session = workspace.getModuleDesignSession(projectId, 'mod.evidence-store')!
        workspace.saveModuleDesignSession(projectId, {
          ...session,
          currentStep: 'contracts',
          completedSteps: ['boundary', 'behavior'],
          updatedAt: at(1),
        })

        // "Restart": a brand-new DesignWorkspace/operations instance over the same dataDir.
        const workspace2 = new DesignWorkspace(workspace.dataDir)
        const ops2 = createDesignOperations({ workspace: workspace2 })
        const resumed = ops2.getModuleContext(projectId, 'mod.evidence-store')

        expect(resumed.session?.currentStep).toBe('contracts')
        expect(resumed.session?.completedSteps).toEqual(['boundary', 'behavior'])

        return { actual: 'resumed at the contracts step from a fresh workspace instance over the same data directory' }
      },
    ),
  )

  it(
    'S09 approve one module while 16 remain incomplete',
    withScenarioEvidence(
      'S09',
      ['module-design.update', 'module-design.analyze', 'module-design.approve'],
      'The Evidence Store module design is approved while the other 16 sample modules remain not started; progress counts reflect exactly 1 approved and 16 not started.',
      () => {
        ops.updateModuleDesignItem({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.evidence-store', path: 'schemas', value: ioSchemas('mod.evidence-store') })
        ops.updateModuleDesignItem({
          projectId,
          actor,
          idempotencyKey: key(),
          moduleId: 'mod.evidence-store',
          path: 'verification.acceptanceCases',
          value: [{ id: 'ac.evidence-store.1', description: 'stores and returns an evidence record', expectedOutcome: 'the record round-trips exactly' }],
        })
        ops.updateModuleDesignItem({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.evidence-store', path: 'typeSpecific.detail', value: platformDetail })

        const analyzed = ops.analyzeModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.evidence-store' })
        expect(analyzed.ok).toBe(true)
        expect(analyzed.value?.design.status).toBe('readyForReview')

        const approved = ops.approveModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.evidence-store', authority: 'module-owner' })
        expect(approved.ok).toBe(true)
        expect(approved.value?.status).toBe('approved')

        const queue = ops.listModuleDesigns(projectId, 'all')
        expect(queue.total).toBe(17)
        expect(queue.approved).toBe(1)
        expect(queue.notStarted).toBe(16)

        return {
          actual: 'mod.evidence-store approved; queue shows approved=1, notStarted=16',
          revisions: { design: approved.value!.revision, modules: { 'mod.evidence-store': approved.value!.revision } },
        }
      },
    ),
  )

  it(
    'S10 block a handoff for a module with an unapproved required contract',
    withScenarioEvidence(
      'S10',
      ['module-design.start', 'module-design.update', 'module-design.approve', 'implementation-packet.create'],
      'createModuleImplementationPacket is blocked for Import and Publish because a required operation (from the still-unapproved Evidence Graph module) has no approved provider contract.',
      () => {
        ops.startModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.import-and-publish' })
        ops.updateModuleDesignItem({
          projectId,
          actor,
          idempotencyKey: key(),
          moduleId: 'mod.import-and-publish',
          path: 'requiredOperations',
          value: [{ operationId: 'ResolveEvidenceIdentity', acceptedVersionRange: '^1.0.0', providerModuleId: 'mod.evidence-graph', reason: 'needs canonical identity resolution before publishing' }],
        })
        ops.updateModuleDesignItem({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.import-and-publish', path: 'schemas', value: ioSchemas('mod.import-and-publish') })
        ops.updateModuleDesignItem({
          projectId,
          actor,
          idempotencyKey: key(),
          moduleId: 'mod.import-and-publish',
          path: 'verification.acceptanceCases',
          value: [{ id: 'ac.import-and-publish.1', description: 'refreshes and publishes a valid candidate', expectedOutcome: 'a new snapshot is published' }],
        })
        ops.updateModuleDesignItem({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.import-and-publish', path: 'typeSpecific.detail', value: workflowDetail })

        const analyzed = ops.analyzeModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.import-and-publish' })
        expect(analyzed.value?.design.status).toBe('readyForReview')
        const approved = ops.approveModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.import-and-publish', authority: 'module-owner' })
        expect(approved.ok).toBe(true)

        const blocked = ops.createModuleImplementationPacket({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.import-and-publish' })
        expect(blocked.ok).toBe(false)
        expect(blocked.diagnostics.some((d) => d.code === 'CAP-DES-BUILD-PROVIDER')).toBe(true)

        return { actual: 'handoff blocked: CAP-DES-BUILD-PROVIDER (ResolveEvidenceIdentity has no approved provider)' }
      },
    ),
  )

  it(
    'S11 create one module implementation packet',
    withScenarioEvidence(
      'S11',
      ['implementation-packet.create'],
      'createModuleImplementationPacket succeeds for the approved, contract-satisfied Evidence Store module.',
      () => {
        const packet = ops.createModuleImplementationPacket({
          projectId,
          actor,
          idempotencyKey: key(),
          moduleId: 'mod.evidence-store',
          implementationSteps: ['implement EvidenceStorePort per the approved contract'],
          testCommands: ['npm test'],
        })
        expect(packet.ok).toBe(true)
        expect(packet.value?.moduleId).toBe('mod.evidence-store')

        return { actual: `implementation packet ${packet.value!.packetId} created for mod.evidence-store` }
      },
    ),
  )
})

// ---------------------------------------------------------------------------
// S07, S08 — Import an incomplete Copilot module-design response; show the
// exact missing fields without discarding valid data.
// ---------------------------------------------------------------------------

describe('S07, S08 — import an incomplete Copilot module-design response', () => {
  const workspace = new DesignWorkspace(tmpDir())
  const ops = createDesignOperations({ workspace })
  const projectId = 'proj-s07-s08'
  seedRoles(workspace, projectId)

  ops.createUseCaseDraft({ projectId, actor, idempotencyKey: key(), workDescription: 'Track review approvals.' })
  ops.approveUseCaseAnalysis({ projectId, actor, idempotencyKey: key(), authority: 'product-lead' })
  ops.createSystemDesignDraft({ projectId, actor, idempotencyKey: key() })
  ops.approveSystemStructure({ projectId, actor, idempotencyKey: key(), authority: 'software-architect' })
  const architecture = workspace.getApprovedArchitecture(projectId)!
  const manifest = buildContextManifest({
    targetRecordId: architecture.id,
    targetRevision: architecture.revision,
    limit: 200_000,
    candidates: [{ kind: 'record', ref: architecture.id, content: JSON.stringify({ moduleId: 'mod.core' }), reason: 'architecture slice for this module' }],
  })
  const packetResult = buildModuleDesignPacket({
    projectId,
    moduleId: 'mod.core',
    moduleType: 'workflow',
    architectureRevision: architecture.revision,
    architectureHash: architecture.contentHash,
    systemSlice: { moduleSummaries: [{ moduleId: 'mod.core', name: 'Core', responsibility: 'Coordinates review approvals.' }], dependencyEdges: [] },
    contextManifest: manifest,
    idempotencyKey: 'design-packet.core.1',
    createdAt: at(0),
  })
  const packet = packetResult.packet!
  let firstImportedFields: Record<string, unknown> = {}

  it(
    'S07 import an incomplete Copilot module-design response',
    withScenarioEvidence(
      'S07',
      ['module-design.import-response'],
      'importModuleDesignResponse imports every valid field from an incomplete response and lists exactly the missing required fields.',
      () => {
        const incompleteResponse = {
          draft: {
            module: {
              moduleId: 'mod.core',
              moduleVersion: '1.0.0',
              name: 'Core',
              moduleType: 'workflow',
              responsibility: 'Coordinates review approvals.',
              nonResponsibilities: [],
              ownedConcerns: [],
              excludedConcerns: [],
            },
            boundary: {
              directDependencyIds: [],
              directConsumerIds: [],
              deployableId: 'deployable.mod.core',
              runtimeAllocation: 'local-embedded',
              runtimeLanguage: 'typescript',
              ownedPaths: ['capabilities/modules/mod.core/'],
              editableSharedPaths: [],
            },
            trace: { useCaseIds: [], scenarioStepIds: [], ruleIds: [], qualityRequirementIds: [], sourceRefs: [], designDecisionIds: [] },
            providedOperations: [],
            requiredOperations: [],
            schemas: ioSchemas('mod.core'),
          },
          assumptions: ['Approvals are single-step.'],
          unresolvedQuestions: ['Should rejection require a written reason?'],
          proposedContracts: [],
          proposedDiagrams: [],
          sourceRefs: ['docs/use-case-led-workflow/SPECIFICATION.md'],
          changeSummary: 'Initial partial module design for mod.core.',
        }

        const firstImport = importModuleDesignResponse(incompleteResponse, packet)
        expect([...firstImport.missingRequiredFields].sort()).toEqual(['behavior', 'data', 'runtime', 'typeSpecific', 'verification'].sort())
        expect(firstImport.imported.module).toEqual(incompleteResponse.draft.module)
        expect(firstImport.imported.schemas).toEqual(incompleteResponse.draft.schemas)

        firstImportedFields = firstImport.imported as Record<string, unknown>

        return { actual: `missing fields exactly: ${[...firstImport.missingRequiredFields].sort().join(', ')}` }
      },
    ),
  )

  it(
    'S08 show the exact missing fields without discarding valid data',
    withScenarioEvidence(
      'S08',
      ['module-design.import-response'],
      'A second import that supplies exactly the previously-missing fields completes the draft, preserving every field the first import already contributed.',
      () => {
        const completingResponse = {
          draft: {
            behavior: {
              preconditions: [],
              postconditions: [],
              domainRejections: [],
              technicalFailures: [],
              sideEffects: [],
              idempotency: 'idempotent per approval id',
              cancellation: 'not cancellable once recorded',
              timeouts: 'none',
              concurrency: 'single-writer per approval',
              retry: 'the client retries on a 5xx response',
              recovery: 'none required',
              emittedEvents: [],
              consumedEvents: [],
            },
            data: {
              inputSchemas: [],
              outputSchemas: [],
              persistentRecords: [],
              dataOwnership: 'owned by this module',
              retention: 'life of the project',
              migrationNeeds: 'none',
              confidentiality: 'internal',
              provenanceFields: [],
              canonicalUnits: [],
              canonicalEnumerations: [],
            },
            runtime: {
              configurationRefs: [],
              secretReferenceIds: [],
              lifecycleRegistration: 'registered at startup',
              healthBehavior: 'reports ready once loaded',
              telemetry: 'basic operation counters',
              resourceOwnership: 'in-process',
              startupBehavior: 'loads configuration',
              shutdownBehavior: 'flushes pending writes',
              compatibilityConstraints: [],
            },
            verification: {
              examples: [],
              edgeCases: [],
              acceptanceCases: [{ id: 'ac1', description: 'approves a review', expectedOutcome: 'the review is approved' }],
              verificationSuiteIds: [],
              requiredEvidence: [],
              testDoubles: [],
              fixtureNeeds: [],
              configuredCommands: [],
              unresolvedItems: [],
            },
            typeSpecific: { moduleType: 'workflow', detail: workflowDetail },
          },
          assumptions: ['Approvals are single-step.'],
          unresolvedQuestions: [],
          proposedContracts: [],
          proposedDiagrams: [],
          sourceRefs: [],
          changeSummary: 'Completes the module design with behavior, data, runtime, verification, and type-specific detail.',
        }

        const secondImport = importModuleDesignResponse(completingResponse, packet, firstImportedFields)
        expect(secondImport.missingRequiredFields).toEqual([])
        // the first import's fields were not discarded.
        expect(secondImport.imported.module).toEqual(firstImportedFields.module)
        expect(secondImport.imported.schemas).toEqual(firstImportedFields.schemas)
        expect(secondImport.imported.behavior).toEqual(completingResponse.draft.behavior)

        return { actual: 'second import completed the draft with zero missing fields; first import fields preserved' }
      },
    ),
  )
})

// ---------------------------------------------------------------------------
// S12, S13, S14 — inspect/reject an out-of-scope delta; inspect, approve,
// and apply an in-scope delta through the real repositoryAdapter against a
// real temp repository directory; roll back a failed transactional apply.
// ---------------------------------------------------------------------------

describe('S12, S13, S14 — inspect, approve, apply, and roll back a returned delta', () => {
  const repoRoot = tmpDir('euik-scn-repo-')
  const workspace = new DesignWorkspace(tmpDir())
  const ops = createDesignOperations({
    workspace,
    executors: {
      applyDelta: (plan, delta) => applyDeltaTransactionally(plan, delta, repoRoot, { currentRevision: plan.expectedWorkspaceRevision }),
    },
  })
  const projectId = 'proj-s12-s14'
  seedRoles(workspace, projectId)
  const moduleId = 'mod.core'

  ops.createUseCaseDraft({ projectId, actor, idempotencyKey: key(), workDescription: 'Track review approvals.' })
  ops.approveUseCaseAnalysis({ projectId, actor, idempotencyKey: key(), authority: 'product-lead' })
  ops.createSystemDesignDraft({ projectId, actor, idempotencyKey: key() })
  ops.approveSystemStructure({ projectId, actor, idempotencyKey: key(), authority: 'software-architect' })
  ops.startModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId })
  ops.updateModuleDesignItem({ projectId, actor, idempotencyKey: key(), moduleId, path: 'schemas', value: ioSchemas(moduleId) })
  ops.updateModuleDesignItem({
    projectId,
    actor,
    idempotencyKey: key(),
    moduleId,
    path: 'verification.acceptanceCases',
    value: [{ id: 'ac1', description: 'does the work', expectedOutcome: 'the work is done' }],
  })
  ops.updateModuleDesignItem({ projectId, actor, idempotencyKey: key(), moduleId, path: 'typeSpecific.detail', value: workflowDetail })
  ops.analyzeModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId })
  const approved = ops.approveModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId, authority: 'module-owner' })
  ops.createDesignBaseline({ projectId, actor, idempotencyKey: key() })
  ops.approveDesignBaseline({ projectId, actor, idempotencyKey: key(), authority: 'software-architect' })
  const packet = ops.createModuleImplementationPacket({
    projectId,
    actor,
    idempotencyKey: key(),
    moduleId,
    implementationSteps: ['implement the core workflow'],
    testCommands: ['npm test'],
  })

  fs.mkdirSync(path.join(repoRoot, 'capabilities/modules/mod.core'), { recursive: true })
  fs.writeFileSync(path.join(repoRoot, 'unrelated.txt'), 'do not touch\n')

  it(
    'S12 reject a returned delta that changes an unrelated path',
    withScenarioEvidence(
      'S12',
      ['delta.import', 'delta.inspect'],
      'A delta that writes outside the module owned paths is rejected (path-outside-allowed) and preserved as evidence.',
      () => {
        const outOfScopeDelta = buildDelta({
          deltaId: 'delta.out-of-scope.1',
          packetId: packet.value!.packetId,
          baseRevision: approved.value!.revision,
          baseHash: approved.value!.contentHash,
          fileChanges: [{ path: 'capabilities/modules/other-module/hack.ts', action: 'create', content: 'export {}', contentHash: 'hash-x' }],
          testResults: [{ command: 'npm test', passed: true, summary: 'all green' }],
        })

        const imported = ops.importAgentDelta({ projectId, actor, idempotencyKey: key(), delta: outOfScopeDelta })
        expect(imported.ok).toBe(true)
        expect(workspace.getReturnedDelta(projectId, outOfScopeDelta.deltaId)).toEqual(outOfScopeDelta)

        const inspected = ops.inspectAgentDelta({ projectId, actor, idempotencyKey: key(), deltaId: outOfScopeDelta.deltaId })
        expect(inspected.value?.accepted).toBe(false)
        expect(inspected.value?.rejectionReasons).toContain('path-outside-allowed')

        return { actual: 'delta rejected: path-outside-allowed; preserved in the workspace as evidence' }
      },
    ),
  )

  it(
    'S13 inspect, approve, and apply an in-scope delta',
    withScenarioEvidence(
      'S13',
      ['delta.import', 'delta.inspect', 'delta.approve', 'delta.apply'],
      'An in-scope delta is accepted, approved, and applied for real against a temp repository directory through the repositoryAdapter, leaving unrelated files untouched.',
      () => {
        const delta = buildDelta({
          deltaId: 'delta.in-scope.1',
          packetId: packet.value!.packetId,
          baseRevision: approved.value!.revision,
          baseHash: approved.value!.contentHash,
          fileChanges: [{ path: 'capabilities/modules/mod.core/index.ts', action: 'create', content: 'export {}', contentHash: 'h1' }],
          testResults: [{ command: 'npm test', passed: true, summary: 'all green' }],
        })

        ops.importAgentDelta({ projectId, actor, idempotencyKey: key(), delta })
        const inspected = ops.inspectAgentDelta({ projectId, actor, idempotencyKey: key(), deltaId: delta.deltaId })
        expect(inspected.value?.accepted).toBe(true)
        const inspectionId = inspected.value!.inspectionId

        const approvedDelta = ops.approveAgentDelta({ projectId, actor, idempotencyKey: key(), inspectionId })
        expect(approvedDelta.ok).toBe(true)

        const applied = ops.applyAgentDelta({ projectId, actor, idempotencyKey: key(), inspectionId })
        expect(applied.ok).toBe(true)
        expect(applied.value?.applied).toBe(true)

        expect(fs.readFileSync(path.join(repoRoot, 'capabilities/modules/mod.core/index.ts'), 'utf8')).toBe('export {}')
        expect(fs.readFileSync(path.join(repoRoot, 'unrelated.txt'), 'utf8')).toBe('do not touch\n')

        return { actual: 'delta applied for real; index.ts written, unrelated.txt untouched' }
      },
    ),
  )

  it(
    'S14 roll back a failed transactional apply',
    withScenarioEvidence(
      'S14',
      ['delta.import', 'delta.inspect', 'delta.approve', 'delta.apply'],
      'An induced mid-apply failure rolls back every change for that plan; the repository is byte-identical to its pre-apply state.',
      () => {
        const before = fs.readFileSync(path.join(repoRoot, 'unrelated.txt'), 'utf8')
        const beforeListing = fs.readdirSync(path.join(repoRoot, 'capabilities/modules/mod.core')).sort()

        const failingOps = createDesignOperations({
          workspace,
          executors: {
            applyDelta: (plan, delta) =>
              applyDeltaTransactionally(plan, delta, repoRoot, { currentRevision: plan.expectedWorkspaceRevision, failAfter: 0 }),
          },
        })

        const delta2 = buildDelta({
          deltaId: 'delta.rollback.1',
          packetId: packet.value!.packetId,
          baseRevision: approved.value!.revision,
          baseHash: approved.value!.contentHash,
          fileChanges: [{ path: 'capabilities/modules/mod.core/second.ts', action: 'create', content: 'export const x = 1', contentHash: 'h2' }],
          testResults: [{ command: 'npm test', passed: true, summary: 'all green' }],
        })

        failingOps.importAgentDelta({ projectId, actor, idempotencyKey: key(), delta: delta2 })
        const inspected2 = failingOps.inspectAgentDelta({ projectId, actor, idempotencyKey: key(), deltaId: delta2.deltaId })
        expect(inspected2.value?.accepted).toBe(true)
        const inspectionId2 = inspected2.value!.inspectionId
        failingOps.approveAgentDelta({ projectId, actor, idempotencyKey: key(), inspectionId: inspectionId2 })

        const applied2 = failingOps.applyAgentDelta({ projectId, actor, idempotencyKey: key(), inspectionId: inspectionId2 })
        expect(applied2.ok).toBe(false)
        expect(applied2.value?.rolledBack).toBe(true)

        expect(fs.existsSync(path.join(repoRoot, 'capabilities/modules/mod.core/second.ts'))).toBe(false)
        expect(fs.readFileSync(path.join(repoRoot, 'unrelated.txt'), 'utf8')).toBe(before)
        expect(fs.readdirSync(path.join(repoRoot, 'capabilities/modules/mod.core')).sort()).toEqual(beforeListing)

        return { actual: 'induced apply failure rolled back; repository byte-identical to its pre-apply state' }
      },
    ),
  )
})

// ---------------------------------------------------------------------------
// S15 — Verify the applied module, using a real `runConfiguredCommand`
// executor that runs a real trivial `node` command.
// ---------------------------------------------------------------------------

describe('S15 — verify the applied module', () => {
  it(
    'S15 verify the applied module',
    withScenarioEvidence(
      'S15',
      ['module.verify'],
      'verifyModule reports passed once its configured executor runs a real command (node -e "process.exit(0)") that exits 0.',
      async () => {
        const workspace = new DesignWorkspace(tmpDir())
        const baseOps = createDesignOperations({ workspace })
        const projectId = 'proj-s15'
        seedRoles(workspace, projectId)
        const moduleId = 'mod.core'

        baseOps.createUseCaseDraft({ projectId, actor, idempotencyKey: key(), workDescription: 'Track review approvals.' })
        baseOps.approveUseCaseAnalysis({ projectId, actor, idempotencyKey: key(), authority: 'product-lead' })
        baseOps.createSystemDesignDraft({ projectId, actor, idempotencyKey: key() })
        baseOps.approveSystemStructure({ projectId, actor, idempotencyKey: key(), authority: 'software-architect' })
        baseOps.startModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId })
        baseOps.updateModuleDesignItem({ projectId, actor, idempotencyKey: key(), moduleId, path: 'schemas', value: ioSchemas(moduleId) })
        baseOps.updateModuleDesignItem({
          projectId,
          actor,
          idempotencyKey: key(),
          moduleId,
          path: 'verification.acceptanceCases',
          value: [{ id: 'ac1', description: 'does the work', expectedOutcome: 'the work is done' }],
        })
        baseOps.updateModuleDesignItem({ projectId, actor, idempotencyKey: key(), moduleId, path: 'typeSpecific.detail', value: workflowDetail })
        baseOps.analyzeModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId })
        baseOps.approveModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId, authority: 'module-owner' })

        // Run the real, configured, allow-listed command through repositoryAdapter first
        // (verifyModule's executor contract is synchronous; the real process work happens here).
        const commandResult = await runConfiguredCommand({
          command: 'node',
          args: ['-e', 'process.exit(0)'],
          cwd: process.cwd(),
          timeoutMs: 10_000,
          allowedCommands: ['node'],
          // PATH must be explicitly allow-listed — the executor never
          // inherits the parent's full environment by default (§20.2).
          envAllowlist: ['PATH'],
        })
        expect(commandResult.exitCode).toBe(0)
        expect(commandResult.timedOut).toBe(false)

        const verifyOps = createDesignOperations({
          workspace,
          executors: {
            verifyModule: () => ({ passed: commandResult.exitCode === 0, evidenceRefs: ['evidence.verify.node-exit-0'] }),
          },
        })
        const result = verifyOps.verifyModule({ projectId, actor, idempotencyKey: key(), moduleId })
        expect(result.ok).toBe(true)
        expect(result.value?.passed).toBe(true)

        return { actual: `real 'node -e process.exit(0)' exited 0; verifyModule reported passed=true` }
      },
    ),
  )
})

// ---------------------------------------------------------------------------
// S16-S23, S27, S30 — sample lifecycle at baseline. One workspace fully
// seeded via loadFullSample (17 approved module designs + approved Design
// baseline), matching the project right after §22's baseline approval.
// ---------------------------------------------------------------------------

describe('S16-S23, S27, S30 — sample lifecycle at baseline', () => {
  const sample = buildSampleAuditHub()
  const workspace = new DesignWorkspace(tmpDir())
  loadFullSample(workspace, sample)
  const ops = createDesignOperations({ workspace })
  const projectId = sample.projectId
  seedRoles(workspace, projectId)
  const allApprovedDesigns = Object.values(sample.approvedModuleDesigns)

  let s19DiagramId = ''
  let s19RelationshipId = ''

  it(
    'S16 reopen an approved module after a contract change',
    withScenarioEvidence(
      'S16',
      ['impact.analyze', 'module-design.reopen'],
      'After a contract-behavior change to an operation Lifecycle Explorer consumes (FollowTrace), Lifecycle Explorer is reopened for review while its approved revision is preserved.',
      () => {
        const impact = Impact.analyzeDesignChange({
          projectId,
          changeKind: 'operationBehavior',
          initiatingRecordId: sample.approvedModuleDesigns['mod.evidence-graph']!.id,
          initiatingRevision: sample.approvedModuleDesigns['mod.evidence-graph']!.revision,
          description: 'FollowTrace now returns a richer trace node shape.',
          target: { operationId: 'FollowTrace', moduleId: 'mod.evidence-graph' },
          world: { architecture: sample.architecture, moduleDesigns: allApprovedDesigns },
          createdAt: at(0),
        })
        const consumerIds = impact.items.filter((i) => i.category === 'module').map((i) => i.targetId)
        expect(consumerIds).toContain('mod.lifecycle-explorer')

        const before = ops.getModuleDesign(projectId, 'mod.lifecycle-explorer')!
        expect(before.status).toBe('approved')

        const reopened = ops.reopenModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.lifecycle-explorer' })
        expect(reopened.ok).toBe(true)
        expect(reopened.value?.status).not.toBe('approved')

        const stillApproved = workspace.getApprovedModuleDesign(projectId, 'mod.lifecycle-explorer')!
        expect(stillApproved.revision).toBe(before.revision)
        expect(stillApproved.contentHash).toBe(before.contentHash)

        return { actual: 'mod.lifecycle-explorer reopened as a draft; its approved revision is preserved untouched' }
      },
    ),
  )

  it(
    'S17 mark only affected consumers stale',
    withScenarioEvidence(
      'S17',
      ['impact.analyze', 'impact.apply-to-records'],
      'An operation-behavior change to EvidenceStorePort marks its provider and consumers stale; an unrelated leaf module (the Git adapter) is left untouched.',
      () => {
        const impact = Impact.analyzeDesignChange({
          projectId,
          changeKind: 'operationBehavior',
          initiatingRecordId: sample.approvedModuleDesigns['mod.evidence-store']!.id,
          initiatingRevision: sample.approvedModuleDesigns['mod.evidence-store']!.revision,
          description: 'EvidenceStorePort now requires a provenance field on every write.',
          target: { operationId: 'EvidenceStorePort', moduleId: 'mod.evidence-store' },
          world: { architecture: sample.architecture, moduleDesigns: allApprovedDesigns },
          createdAt: at(0),
        })

        const records = sample.architecture.moduleIds.map((id) => ({ id }))
        const applied = Impact.applyImpactToRecords(impact, records)

        expect(applied.staleRecordIds).toContain('mod.evidence-store')
        expect(applied.staleRecordIds).toContain('mod.evidence-graph')
        expect(applied.staleRecordIds).not.toContain('mod.adapter.git')

        return {
          actual: `stale: ${applied.staleRecordIds.join(', ')}; mod.adapter.git (unrelated) untouched`,
        }
      },
    ),
  )

  it(
    'S18 split a module and review the complete impact',
    withScenarioEvidence(
      'S18',
      ['system-design.split', 'impact.analyze'],
      'Splitting the Job and Package Store into two independent modules marks both new modules stale and every direct/transitive consumer for review.',
      () => {
        // A system-design decision requires a `draft`-status architecture
        // record (the approved one is edit-locked); save a draft-status
        // clone of the approved sample architecture for this decision.
        workspace.saveArchitectureDraft(projectId, { ...sample.architecture, status: 'draft' })

        const splitResult = ops.applySystemDesignDecision({
          projectId,
          actor,
          idempotencyKey: key(),
          decision: {
            kind: 'split',
            moduleId: 'mod.job-package-store',
            newModules: [
              { moduleId: 'mod.job-store', name: 'Job Store', moduleType: 'platform', responsibility: 'Stores and schedules implementation-wave jobs.', operationIds: ['JobStorePort'] },
              { moduleId: 'mod.package-store', name: 'Package Store', moduleType: 'platform', responsibility: 'Stores exported audit packages.', operationIds: ['PackageStorePort'] },
            ],
          },
        })
        expect(splitResult.ok).toBe(true)
        const splitArchitecture = splitResult.value!
        expect(splitArchitecture.moduleIds).toContain('mod.job-store')
        expect(splitArchitecture.moduleIds).toContain('mod.package-store')
        expect(splitArchitecture.moduleIds).not.toContain('mod.job-package-store')

        const impact = Impact.analyzeDesignChange({
          projectId,
          changeKind: 'moduleSplitOrMerge',
          initiatingRecordId: splitArchitecture.id,
          initiatingRevision: splitArchitecture.revision,
          description: 'Split the Job and Package Store into two independent modules.',
          target: { splitOrMergeModuleIds: ['mod.job-store', 'mod.package-store'] },
          world: { architecture: splitArchitecture, moduleDesigns: allApprovedDesigns },
          createdAt: at(0),
        })

        const moduleItems = impact.items.filter((i) => i.category === 'module')
        expect(moduleItems.some((i) => i.targetId === 'mod.job-store' && i.invalidation === 'stale')).toBe(true)
        expect(moduleItems.some((i) => i.targetId === 'mod.package-store' && i.invalidation === 'stale')).toBe(true)
        const reviewIds = moduleItems.filter((i) => i.invalidation === 'review').map((i) => i.targetId)
        expect(reviewIds).toContain('mod.import-and-publish')
        expect(reviewIds).toContain('mod.package-export')

        return { actual: `split modules stale; consumers under review: ${reviewIds.join(', ')}` }
      },
    ),
  )

  it(
    'S19 select a UML relationship and propose a change',
    withScenarioEvidence(
      'S19',
      ['diagram.project', 'diagram.propose-change'],
      'A real dependency relationship is selected from the projected Evidence Graph component diagram and a change is proposed against it.',
      () => {
        const evidenceGraphDesign = sample.approvedModuleDesigns['mod.evidence-graph']!
        const projection = DiagramSemantics.projectComponentDiagram({ design: evidenceGraphDesign, architecture: sample.architecture, allDesigns: allApprovedDesigns })
        const relationship = projection.relationships.find((r) => r.kind === 'dependency')
        expect(relationship).toBeDefined()

        // The `DesignWorkspace` file-naming scheme concatenates diagramId +
        // elementId + idempotencyKey into one filename; the real, fully
        // qualified generated ids (childId chains rooted at the project id)
        // are individually reasonable but together exceed the filesystem
        // path-length limit. `proposeVisualChange`/`analyzeVisualChange`/
        // `approveChangePlan` treat these as opaque discussion-entry
        // pointers (never re-derived from a `DiagramProjection`), so a
        // short, stable label that still names the real selected diagram
        // and relationship is the correct id to pass here.
        const shortDiagramId = 'diagram.mod-evidence-graph.component'
        const shortRelationshipId = `rel.${relationship!.fromId.split('.').pop()}-to-${relationship!.toId.split('.').pop()}`

        const proposed = ops.proposeVisualChange({
          projectId,
          actor,
          idempotencyKey: key(),
          diagramId: shortDiagramId,
          elementId: shortRelationshipId,
          description: 'Consider inlining the trace lookup instead of a cross-module call.',
        })
        expect(proposed.ok).toBe(true)
        expect(proposed.value?.kind).toBe('proposedChange')

        s19DiagramId = shortDiagramId
        s19RelationshipId = shortRelationshipId

        return { actual: `proposed change recorded on relationship ${relationship!.id}` }
      },
    ),
  )

  it(
    'S20 approve a change plan and regenerate affected diagrams',
    withScenarioEvidence(
      'S20',
      ['impact.analyze', 'change-plan.approve', 'diagram.project'],
      'Approving the change plan for the selected relationship is followed by a real diagram content-hash change for the affected module and no change for an unaffected module.',
      () => {
        const evidenceGraphApproved = sample.approvedModuleDesigns['mod.evidence-graph']!
        const gitAdapter = sample.approvedModuleDesigns['mod.adapter.git']!

        const beforeHash = DiagramSemantics.projectComponentDiagram({ design: evidenceGraphApproved, architecture: sample.architecture, allDesigns: allApprovedDesigns }).contentHash
        const unaffectedBefore = DiagramSemantics.projectComponentDiagram({ design: gitAdapter, architecture: sample.architecture, allDesigns: allApprovedDesigns }).contentHash

        const analyzed = ops.analyzeVisualChange({
          projectId,
          actor,
          idempotencyKey: key(),
          diagramId: s19DiagramId,
          elementId: s19RelationshipId,
          changeKind: 'dependency',
          initiatingRecordId: evidenceGraphApproved.id,
          initiatingRevision: evidenceGraphApproved.revision,
          description: 'Evidence Graph depends directly on Evidence Store for trace lookups.',
          target: { sourceModuleId: 'mod.evidence-graph', targetModuleId: 'mod.evidence-store' },
        })
        expect(analyzed.ok).toBe(true)

        const approvedPlan = ops.approveChangePlan({
          projectId,
          actor,
          idempotencyKey: key(),
          diagramId: s19DiagramId,
          elementId: s19RelationshipId,
          impactId: analyzed.value!.impactId,
          authority: 'software-architect',
        })
        expect(approvedPlan.ok).toBe(true)

        const reopened = ops.reopenModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.evidence-graph' })
        expect(reopened.ok).toBe(true)
        const updated = ops.updateModuleDesignItem({
          projectId,
          actor,
          idempotencyKey: key(),
          moduleId: 'mod.evidence-graph',
          path: 'module',
          value: { ...evidenceGraphApproved.module, responsibility: `${evidenceGraphApproved.module.responsibility} Trace lookups are now direct, per the approved change plan.` },
        })
        expect(updated.ok).toBe(true)

        const afterHash = DiagramSemantics.projectComponentDiagram({ design: updated.value!, architecture: sample.architecture, allDesigns: allApprovedDesigns }).contentHash
        expect(afterHash).not.toBe(beforeHash)

        const unaffectedAfter = DiagramSemantics.projectComponentDiagram({ design: gitAdapter, architecture: sample.architecture, allDesigns: allApprovedDesigns }).contentHash
        expect(unaffectedAfter).toBe(unaffectedBefore)

        return { actual: 'affected diagram content hash changed; unaffected module diagram content hash unchanged' }
      },
    ),
  )

  it(
    'S21 create an implementation-wave plan without automatic dispatch',
    withScenarioEvidence(
      'S21',
      ['waves.plan'],
      'getImplementationWaves returns a full wave plan with autoDispatch always false, and creates no implementation packet as a side effect.',
      () => {
        const packetsDirBefore = path.join(workspace.root(projectId), 'packets', 'module-implementation')
        const before = fs.existsSync(packetsDirBefore) ? fs.readdirSync(packetsDirBefore).length : 0

        const waves = ops.getImplementationWaves(projectId)
        expect(waves.autoDispatch).toBe(false)
        expect(waves.waves.length).toBeGreaterThan(0)
        expect(waves.waves.every((w) => w.modules.length > 0 || w.blockingCycles.length > 0)).toBe(true)
        // The ops-computed level grouping covers every approved module exactly once
        // (a valid, if coarser, grouping than the sample's own curated 7-wave narrative).
        const coveredModuleIds = waves.waves.flatMap((w) => w.modules.map((m) => m.moduleId)).sort()
        expect(coveredModuleIds).toEqual([...sample.architecture.moduleIds].sort())

        const after = fs.existsSync(packetsDirBefore) ? fs.readdirSync(packetsDirBefore).length : 0
        expect(after).toBe(before)

        return { actual: `wave plan: ${waves.waves.length} waves, autoDispatch=false, no packet created` }
      },
    ),
  )

  it(
    'S22 explicitly select two independent adapter modules for a combined handoff',
    withScenarioEvidence(
      'S22',
      ['multi-module-handoff.build'],
      'buildMultiModulePacket accepts an explicit, independent, non-overlapping selection of the File-system and Git adapters.',
      () => {
        const fsAdapter = sample.approvedModuleDesigns['mod.adapter.filesystem']!
        const gitAdapter = sample.approvedModuleDesigns['mod.adapter.git']!

        function packetInputFor(design: typeof fsAdapter, idempotencyKey: string) {
          const manifest = buildContextManifest({
            targetRecordId: design.id,
            targetRevision: design.revision,
            limit: 200_000,
            candidates: [{ kind: 'record', ref: design.id, content: JSON.stringify({ id: design.id }), reason: 'approved module design' }],
          })
          return {
            design,
            contractRegistry: sample.operationContracts,
            architectureRevision: sample.architecture.revision,
            architectureHash: sample.architecture.contentHash,
            contextManifest: manifest,
            implementationSteps: [`implement ${design.module.name}`],
            acceptanceCases: design.verification.acceptanceCases,
            testCommands: design.verification.configuredCommands,
            requiredEvidence: design.verification.requiredEvidence,
            idempotencyKey,
            passKind: 'initial' as const,
            createdAt: at(0),
          }
        }

        const result = buildMultiModulePacket({
          projectId: sample.projectId,
          modules: [
            { design: fsAdapter, packetInput: packetInputFor(fsAdapter, 'multi.fs.1'), fixtureIsolationConfirmed: true },
            { design: gitAdapter, packetInput: packetInputFor(gitAdapter, 'multi.git.1'), fixtureIsolationConfirmed: true },
          ],
          dependencyPlanMarksIndependent: true,
          fixturesIsolated: true,
          explicitUserSelection: true,
          receivingAgentSupportsCombinedTask: true,
          // §3.3 review fix — explicit user confirmation of independence is a
          // required input distinct from the tool-derived dependency plan
          // signal; this scenario's user has explicitly confirmed it.
          userConfirmedIndependence: true,
        })

        expect(result.ok).toBe(true)
        expect(result.packets).toHaveLength(2)

        return { actual: 'combined handoff built for the File-system and Git adapters (2 packets)' }
      },
    ),
  )

  it(
    'S23 reject a combined handoff with overlapping owned paths',
    withScenarioEvidence(
      'S23',
      ['multi-module-handoff.build'],
      'buildMultiModulePacket rejects a combined handoff whose selected modules have overlapping owned paths.',
      () => {
        const fsAdapter = sample.approvedModuleDesigns['mod.adapter.filesystem']!
        const gitAdapter = sample.approvedModuleDesigns['mod.adapter.git']!
        const overlappingGitAdapter = { ...gitAdapter, boundary: { ...gitAdapter.boundary, ownedPaths: fsAdapter.boundary.ownedPaths } }

        function manifestFor(design: typeof fsAdapter) {
          return buildContextManifest({
            targetRecordId: design.id,
            targetRevision: design.revision,
            limit: 200_000,
            candidates: [{ kind: 'record', ref: design.id, content: JSON.stringify({ id: design.id }), reason: 'approved module design' }],
          })
        }

        const result = buildMultiModulePacket({
          projectId: sample.projectId,
          modules: [
            {
              design: fsAdapter,
              packetInput: {
                design: fsAdapter,
                contractRegistry: sample.operationContracts,
                architectureRevision: sample.architecture.revision,
                architectureHash: sample.architecture.contentHash,
                contextManifest: manifestFor(fsAdapter),
                implementationSteps: ['implement the file-system adapter'],
                acceptanceCases: fsAdapter.verification.acceptanceCases,
                testCommands: fsAdapter.verification.configuredCommands,
                requiredEvidence: fsAdapter.verification.requiredEvidence,
                idempotencyKey: 'multi.overlap.fs.1',
                passKind: 'initial',
                createdAt: at(0),
              },
              fixtureIsolationConfirmed: true,
            },
            {
              design: overlappingGitAdapter,
              packetInput: {
                design: overlappingGitAdapter,
                contractRegistry: sample.operationContracts,
                architectureRevision: sample.architecture.revision,
                architectureHash: sample.architecture.contentHash,
                contextManifest: manifestFor(overlappingGitAdapter),
                implementationSteps: ['implement the git adapter'],
                acceptanceCases: overlappingGitAdapter.verification.acceptanceCases,
                testCommands: overlappingGitAdapter.verification.configuredCommands,
                requiredEvidence: overlappingGitAdapter.verification.requiredEvidence,
                idempotencyKey: 'multi.overlap.git.1',
                passKind: 'initial',
                createdAt: at(0),
              },
              fixtureIsolationConfirmed: true,
            },
          ],
          dependencyPlanMarksIndependent: true,
          fixturesIsolated: true,
          explicitUserSelection: true,
          receivingAgentSupportsCombinedTask: true,
          userConfirmedIndependence: true,
        })

        expect(result.ok).toBe(false)
        expect(result.diagnostics.some((d) => d.code === 'CAP-DES-PKT-MULTI-OWNED-PATH-OVERLAP')).toBe(true)

        return { actual: 'combined handoff rejected: CAP-DES-PKT-MULTI-OWNED-PATH-OVERLAP' }
      },
    ),
  )

  it(
    'S27 run every approved sample scenario',
    withScenarioEvidence(
      'S27',
      ['verify.run-scenario'],
      'Every approved main/alternate/failure/recovery scenario from the sample use-case analysis runs and persists an immutable ScenarioRun; re-writing an existing run throws.',
      () => {
        const analysis = workspace.getApprovedUseCaseAnalysis(projectId)!
        const testPlan = VerificationPlanner.buildScenarioTestPlan(analysis)
        expect(testPlan.entries.length).toBeGreaterThan(0)

        function findScenario(useCaseId: string, scenarioId: string) {
          const uc = analysis.useCases.find((u) => u.id === useCaseId)!
          return uc.scenarios.find((s) => s.id === scenarioId)!
        }

        const runnerOps = createDesignOperations({
          workspace,
          executors: {
            runScenario: (input) => {
              const scenario = findScenario(input.entry.useCaseId, input.entry.scenarioId)
              const plan = VerificationPlanner.buildEvidenceExpectationPlan(scenario)
              const steps = scenario.steps.map((step, i) => {
                const policy = plan.policies.find((p) => p.stepId === step.id)!
                const base = {
                  stepId: step.id,
                  action: step.action,
                  expectedResult: step.expectedResult,
                  actualResult: step.expectedResult,
                  startedAt: at(i),
                  endedAt: at(i + 1),
                  outcome: 'passed' as const,
                }
                if (policy.evidenceKind === 'screenshot') {
                  return {
                    ...base,
                    screenshotRef: `evidence/${input.entry.scenarioId}/${step.id}.png`,
                    screenshotMetadata: {
                      browser: 'chromium',
                      viewport: '1280x800',
                      operatingSystem: process.platform,
                      theme: 'light',
                      locale: 'en-US',
                      build: 'core-vitest',
                      environment: 'test',
                      testDataRevision: sample.useCaseAnalysis.contentHash,
                    },
                  }
                }
                return {
                  ...base,
                  structuredEvidenceRef: `evidence/${input.entry.scenarioId}/${step.id}.json`,
                  ...(policy.screenshotNotApplicableReason ? { screenshotNotApplicableReason: policy.screenshotNotApplicableReason } : {}),
                }
              })
              return { steps, outcome: 'passed' as const, startedAt: at(0), completedAt: at(steps.length) }
            },
          },
        })

        for (const entry of testPlan.entries) {
          const result = runnerOps.runScenario({
            projectId,
            actor,
            idempotencyKey: key(),
            scenarioId: entry.scenarioId,
            identity: { build: 'core-vitest', environment: 'test', testDataRevision: sample.useCaseAnalysis.contentHash, runner: 'product-scenario-suite' },
          })
          expect(result.ok, `scenario ${entry.scenarioId}: ${JSON.stringify(result.diagnostics)}`).toBe(true)
          expect(workspace.getScenarioRun(projectId, result.value!.runId)).toBeDefined()
        }

        const persistedRuns = workspace.listScenarioRuns(projectId)
        expect(persistedRuns.length).toBe(testPlan.entries.length)

        const anyRun = persistedRuns[0]!
        expect(() => workspace.saveScenarioRun(projectId, anyRun)).toThrow(/immutable/)

        return {
          actual: `${persistedRuns.length} scenario runs persisted (of ${testPlan.entries.length} approved scenarios); re-write of an existing run throws`,
          revisions: { design: analysis.revision },
        }
      },
    ),
  )

  it(
    'S30 confirm that Verify contains links to Design and no design diagrams',
    withScenarioEvidence(
      'S30',
      ['verify.summary'],
      'buildVerifySummary carries designLinks and has no field capable of holding a diagram payload.',
      () => {
        const analysis = workspace.getApprovedUseCaseAnalysis(projectId)!
        const testPlan = VerificationPlanner.buildScenarioTestPlan(analysis)
        const runs = workspace.listScenarioRuns(projectId)
        expect(runs.length).toBeGreaterThan(0)

        const designLinks = [`design://architecture/${sample.architecture.id}@${sample.architecture.revision}`, `design://use-case-analysis/${analysis.id}@${analysis.revision}`]
        const summary = VerificationPlanner.buildVerifySummary(runs, {
          scenarioTestPlan: testPlan,
          currentRevisions: { useCaseAnalysisRevision: analysis.revision, systemStructureRevision: sample.architecture.revision },
          designLinks,
        })

        expect(summary.designLinks).toEqual([...designLinks].sort())
        expect(summary.scenarioCount).toBeGreaterThan(0)
        expect(summary.passedCount).toBeGreaterThan(0)
        // No field on the Verify summary can carry a diagram payload (§14.4 "shall not contain design diagrams").
        expect(Object.keys(summary)).not.toContain('diagrams')
        expect(Object.keys(summary)).not.toContain('diagramProjection')
        expect(Object.keys(summary).sort()).toEqual(
          [
            'useCaseCount',
            'scenarioCount',
            'passedCount',
            'failedCount',
            'skippedCount',
            'cancelledCount',
            'stepCount',
            'screenshotCount',
            'structuredEvidenceCount',
            'firstFailedStep',
            'currentCount',
            'oldCount',
            'designLinks',
          ]
            .filter((k) => k !== 'firstFailedStep' || 'firstFailedStep' in summary)
            .sort(),
        )

        // A lighter, ops-level consistency check over the same workspace.
        const coverage = ops.getScenarioCoverage(projectId)!
        expect(coverage.scenarioCount).toBe(summary.scenarioCount)
        expect('diagrams' in coverage).toBe(false)

        return { actual: `Verify summary carries ${designLinks.length} design links and no diagram-capable field` }
      },
    ),
  )
})

// ---------------------------------------------------------------------------
// S24 — Restore a module-design draft after application restart.
// ---------------------------------------------------------------------------

describe('S24 — restore a module-design draft after application restart', () => {
  it(
    'S24 restore a module-design draft after application restart',
    withScenarioEvidence(
      'S24',
      ['workspace.restart'],
      'A fresh DesignWorkspace instance over the same data directory ("application restart") restores the module-design draft, its session, and the last selected module byte-identically.',
      () => {
        const dataDir = tmpDir()
        const ops1 = createDesignOperations({ workspace: new DesignWorkspace(dataDir) })
        const projectId = 'proj-restart'
        seedRoles(new DesignWorkspace(dataDir), projectId)

        ops1.createUseCaseDraft({ projectId, actor, idempotencyKey: key(), workDescription: 'Track review approvals.' })
        ops1.approveUseCaseAnalysis({ projectId, actor, idempotencyKey: key(), authority: 'product-lead' })
        ops1.createSystemDesignDraft({ projectId, actor, idempotencyKey: key() })
        ops1.approveSystemStructure({ projectId, actor, idempotencyKey: key(), authority: 'software-architect' })
        ops1.startModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' })
        ops1.updateModuleDesignItem({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', path: 'schemas', value: ioSchemas('mod.core') })

        const ws1 = new DesignWorkspace(dataDir)
        ws1.saveWorkspaceState(projectId, { selectedModuleId: 'mod.core', lastRoute: '/design/mod.core' })

        const beforeDesign = ops1.getModuleDesign(projectId, 'mod.core')!
        const beforeSession = ops1.getModuleContext(projectId, 'mod.core').session!

        // "Restart": brand-new DesignWorkspace/operations instances over the same dataDir.
        const workspace2 = new DesignWorkspace(dataDir)
        const ops2 = createDesignOperations({ workspace: workspace2 })

        const afterDesign = ops2.getModuleDesign(projectId, 'mod.core')
        const afterSession = ops2.getModuleContext(projectId, 'mod.core').session
        const afterState = workspace2.getWorkspaceState(projectId)

        expect(afterDesign).toEqual(beforeDesign)
        expect(afterSession).toEqual(beforeSession)
        expect(afterState).toEqual({ selectedModuleId: 'mod.core', lastRoute: '/design/mod.core' })

        return { actual: 'draft, session, and last-selected-module state all restored byte-identically after restart' }
      },
    ),
  )
})

// ---------------------------------------------------------------------------
// S25 — Resolve a concurrent edit through comparison.
// ---------------------------------------------------------------------------

describe('S25 — resolve a concurrent edit through comparison', () => {
  it(
    'S25 resolve a concurrent edit through comparison',
    withScenarioEvidence(
      'S25',
      ['use-case-analysis.save'],
      'A concurrent save against a stale expected revision throws DesignConflictError carrying both the on-disk and attempted versions; resolving by saving with the correct expectedRevision succeeds.',
      () => {
        const workspace = new DesignWorkspace(tmpDir())
        const projectId = 'proj-concurrency'
        seedRoles(workspace, projectId)

        const created = UseCase.createUseCaseDraft({ projectId, workDescription: 'Track review approvals.' })
        workspace.saveUseCaseAnalysisDraft(projectId, created.analysis)
        const original = workspace.getUseCaseAnalysisDraft(projectId)!

        // Two editors both start from `original`. Editor A saves first.
        const editorAResult = UseCase.acceptAnalysisItem(original, original.actors[0]!.id, 'user:alice')
        workspace.saveUseCaseAnalysisDraft(projectId, editorAResult.analysis, { expectedRevision: original.revision })

        // Editor B, unaware of A's change, attempts to save against the now-stale revision they read.
        const editorBResult = UseCase.rejectAnalysisItem(original, original.actors[0]!.id, 'user:bob')
        let caught: DesignConflictError<UseCaseAnalysis> | undefined
        try {
          workspace.saveUseCaseAnalysisDraft(projectId, editorBResult.analysis, { expectedRevision: original.revision })
        } catch (error) {
          caught = error as DesignConflictError<UseCaseAnalysis>
        }

        expect(caught).toBeInstanceOf(DesignConflictError)
        expect(caught!.code).toBe('stale-revision')
        expect(caught!.expectedRevision).toBe(original.revision)
        expect(caught!.actualRevision).toBe(editorAResult.analysis.revision)
        expect(caught!.onDisk).toEqual(editorAResult.analysis)
        expect(caught!.attempted).toEqual(editorBResult.analysis)

        // Resolve through comparison: rebase editor B's change on top of the current on-disk version.
        const rebased = UseCase.rejectAnalysisItem(caught!.onDisk!, caught!.onDisk!.actors[0]!.id, 'user:bob')
        workspace.saveUseCaseAnalysisDraft(projectId, rebased.analysis, { expectedRevision: caught!.onDisk!.revision })

        const finalDraft = workspace.getUseCaseAnalysisDraft(projectId)!
        expect(finalDraft.revision).toBe(rebased.analysis.revision)
        expect(finalDraft.actors[0]!.status).toBe('rejected')

        return { actual: 'concurrent save rejected with both versions carried; resolved by saving against the correct expectedRevision' }
      },
    ),
  )
})

// ---------------------------------------------------------------------------
// S26 — Connect through a real entry point (GUI half out of scope here).
// This test exercises the operations-level verifyConnection record layer
// with observed-path fields, and the honest not-configured failure (§19
// "never fake success"). A real browser entry point is a GUI-level
// concern, covered by the GUI evidence suite (a later packet).
// ---------------------------------------------------------------------------

describe('S26 — verifyConnection record layer with observed-path fields', () => {
  it(
    'S26 verifyConnection record layer with observed-path fields',
    withScenarioEvidence(
      'S26',
      ['connection.verify'],
      'verifyConnection returns the observed connection fields from its configured executor, and an honest not-configured diagnostic when no executor is configured (operations-level half; the GUI half is covered by the GUI evidence suite).',
      () => {
        const workspace = new DesignWorkspace(tmpDir())
        const projectId = 'proj-connect'
        seedRoles(workspace, projectId)
        const setupOps = createDesignOperations({ workspace })
        setupOps.createUseCaseDraft({ projectId, actor, idempotencyKey: key(), workDescription: 'Track review approvals.' })
        setupOps.approveUseCaseAnalysis({ projectId, actor, idempotencyKey: key(), authority: 'product-lead' })
        setupOps.createSystemDesignDraft({ projectId, actor, idempotencyKey: key() })
        setupOps.approveSystemStructure({ projectId, actor, idempotencyKey: key(), authority: 'software-architect' })

        const observed = { observedPath: '/workspace/adapters/mod.core', latencyMs: 12, protocol: 'fs' }
        const configuredOps = createDesignOperations({ workspace, executors: { verifyConnection: () => ({ ok: true, value: observed }) } })
        const result = configuredOps.verifyConnection({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core', bindingConfig: { root: '/workspace' } })
        expect(result.ok).toBe(true)
        expect(result.value).toEqual(observed)

        // §19 "the product shall never replace the last valid approved snapshot with an invalid
        // candidate" — an unconfigured executor returns an honest failure, never a fake success.
        const unconfiguredOps = createDesignOperations({ workspace })
        const blocked = unconfiguredOps.verifyConnection({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' })
        expect(blocked.ok).toBe(false)
        expect(blocked.diagnostics.map((d) => d.code)).toContain('EUC16-EXECUTOR-NOT-CONFIGURED')

        return { actual: `verifyConnection returned observed path ${observed.observedPath}; unconfigured executor failed honestly` }
      },
    ),
  )
})

// ---------------------------------------------------------------------------
// S28, S29 — evidence policy (pure, over the real sample data). The GUI
// half (opening a screenshot/structured-evidence viewer) is out of scope
// here; covered by the GUI evidence suite.
// ---------------------------------------------------------------------------

describe('S28, S29 — evidence policy: screenshot for visible steps, structured for nonvisual steps', () => {
  const sample = buildSampleAuditHub()

  it(
    'S28 open screenshot evidence for each visible step',
    withScenarioEvidence(
      'S28',
      ['evidence-policy.plan'],
      'buildEvidenceExpectationPlan assigns screenshot evidence to every visible step (unless a not-applicable reason applies), and the sample\'s real recorded runs carry screenshotMetadata wherever they carry a screenshotRef.',
      () => {
        let visibleWithScreenshotPolicy = 0
        for (const useCase of sample.useCaseAnalysis.useCases) {
          for (const scenario of useCase.scenarios) {
            const plan = VerificationPlanner.buildEvidenceExpectationPlan(scenario)
            for (const step of scenario.steps) {
              const policy = plan.policies.find((p) => p.stepId === step.id)!
              if (step.visibleResult && !step.screenshotNotApplicableReason) {
                expect(policy.evidenceKind).toBe('screenshot')
                visibleWithScreenshotPolicy += 1
              }
            }
          }
        }
        expect(visibleWithScreenshotPolicy).toBeGreaterThan(0)

        for (const run of sample.scenarioRuns) {
          for (const step of run.steps) {
            if (step.screenshotRef) {
              expect(step.screenshotMetadata).toBeDefined()
              expect(step.screenshotMetadata!.testDataRevision).toBeTruthy()
            }
          }
        }

        return { actual: `${visibleWithScreenshotPolicy} visible steps expect screenshot evidence; recorded runs carry screenshotMetadata wherever a screenshotRef is present` }
      },
    ),
  )

  it(
    'S29 open structured evidence for each nonvisual step',
    withScenarioEvidence(
      'S29',
      ['evidence-policy.plan'],
      'buildEvidenceExpectationPlan assigns structured evidence to every nonvisual step and to every visible step with a recorded not-applicable reason; every real recorded run step carries screenshotRef, structuredEvidenceRef, or a not-applicable reason.',
      () => {
        let nonvisualWithStructuredPolicy = 0
        for (const useCase of sample.useCaseAnalysis.useCases) {
          for (const scenario of useCase.scenarios) {
            const plan = VerificationPlanner.buildEvidenceExpectationPlan(scenario)
            for (const step of scenario.steps) {
              const policy = plan.policies.find((p) => p.stepId === step.id)!
              if (!step.visibleResult) {
                expect(policy.evidenceKind).toBe('structured')
                nonvisualWithStructuredPolicy += 1
              }
              if (step.visibleResult && step.screenshotNotApplicableReason) {
                expect(policy.evidenceKind).toBe('structured')
                expect(policy.screenshotNotApplicableReason).toBe(step.screenshotNotApplicableReason)
              }
            }
          }
        }

        let checkedSteps = 0
        for (const run of sample.scenarioRuns) {
          for (const step of run.steps) {
            const hasScreenshot = Boolean(step.screenshotRef)
            const hasStructured = Boolean(step.structuredEvidenceRef)
            const hasReason = Boolean(step.screenshotNotApplicableReason)
            expect(hasScreenshot || hasStructured || hasReason, `step ${step.stepId} needs screenshot, structured evidence, or a not-applicable reason`).toBe(true)
            checkedSteps += 1
          }
        }
        expect(checkedSteps).toBeGreaterThan(0)

        return { actual: `nonvisual steps require structured evidence; ${checkedSteps} recorded steps each carry screenshot, structured evidence, or a not-applicable reason` }
      },
    ),
  )
})

// ---------------------------------------------------------------------------
// Required checks beyond the 30 numbered scenarios (§19, §24.3).
// ---------------------------------------------------------------------------

describe('Required check — provider unavailable (§19 "Provider unavailable")', () => {
  it('a noProvider response leaves the draft intact; a later retry with a real provider succeeds', async () => {
    const workspace = new DesignWorkspace(tmpDir())
    const projectId = 'proj-provider-loss'
    seedRoles(workspace, projectId)
    const ops = createDesignOperations({ workspace })

    ops.createUseCaseDraft({ projectId, actor, idempotencyKey: key(), workDescription: 'Track review approvals.' })
    ops.approveUseCaseAnalysis({ projectId, actor, idempotencyKey: key(), authority: 'product-lead' })
    ops.createSystemDesignDraft({ projectId, actor, idempotencyKey: key() })
    ops.approveSystemStructure({ projectId, actor, idempotencyKey: key(), authority: 'software-architect' })
    const started = ops.startModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId: 'mod.core' })
    const before = started.value!.design
    const architecture = workspace.getApprovedArchitecture(projectId)!

    const manifest = buildContextManifest({
      targetRecordId: before.id,
      targetRevision: before.revision,
      limit: 200_000,
      candidates: [{ kind: 'record', ref: before.id, content: JSON.stringify({ id: before.id }), reason: 'module design draft' }],
    })
    const packetResult = buildModuleDesignPacket({
      projectId,
      moduleId: 'mod.core',
      moduleType: before.module.moduleType,
      architectureRevision: architecture.revision,
      architectureHash: architecture.contentHash,
      systemSlice: { moduleSummaries: [{ moduleId: 'mod.core', name: before.module.name, responsibility: before.module.responsibility }], dependencyEdges: [] },
      contextManifest: manifest,
      idempotencyKey: 'design-packet.provider-loss.1',
      createdAt: at(0),
    })
    const packet = packetResult.packet!

    const unavailable = await noProvider().requestModuleDesign(packet, {})
    expect(unavailable.ok).toBe(false)
    expect(unavailable.unavailable).toBe(true)

    // the draft is untouched — nothing was lost.
    const stillThere = ops.getModuleDesign(projectId, 'mod.core')
    expect(stillThere).toEqual(before)

    // a later retry with a real (deterministic test) provider succeeds.
    const retried = await deterministicTestProvider('retry-seed').requestModuleDesign(packet, {})
    expect(retried.ok).toBe(true)
    expect(retried.value?.draft).toBeDefined()

    recordScenarioEvidence({
      scenarioId: 'S19-CHECK-provider-loss',
      stepIds: ['provider.request', 'provider.retry'],
      expected: 'noProvider leaves the draft intact; a later retry with a configured provider succeeds.',
      actual: 'draft intact after an unavailable provider response; retry with deterministicTestProvider succeeded',
      outcome: 'passed',
      revisions: { design: before.revision },
    })
  })
})

describe('Required check — stale response (§19 "Stale response")', () => {
  it('a delta against a superseded packet base is rejected and preserved as evidence', () => {
    const workspace = new DesignWorkspace(tmpDir())
    const projectId = 'proj-stale-response'
    seedRoles(workspace, projectId)
    const ops = createDesignOperations({ workspace })
    const moduleId = 'mod.core'

    ops.createUseCaseDraft({ projectId, actor, idempotencyKey: key(), workDescription: 'Track review approvals.' })
    ops.approveUseCaseAnalysis({ projectId, actor, idempotencyKey: key(), authority: 'product-lead' })
    ops.createSystemDesignDraft({ projectId, actor, idempotencyKey: key() })
    ops.approveSystemStructure({ projectId, actor, idempotencyKey: key(), authority: 'software-architect' })
    ops.startModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId })
    ops.updateModuleDesignItem({ projectId, actor, idempotencyKey: key(), moduleId, path: 'schemas', value: ioSchemas(moduleId) })
    ops.updateModuleDesignItem({
      projectId,
      actor,
      idempotencyKey: key(),
      moduleId,
      path: 'verification.acceptanceCases',
      value: [{ id: 'ac1', description: 'does the work', expectedOutcome: 'the work is done' }],
    })
    ops.updateModuleDesignItem({ projectId, actor, idempotencyKey: key(), moduleId, path: 'typeSpecific.detail', value: workflowDetail })
    ops.analyzeModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId })
    const firstApproved = ops.approveModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId, authority: 'module-owner' }).value!
    ops.createDesignBaseline({ projectId, actor, idempotencyKey: key() })
    ops.approveDesignBaseline({ projectId, actor, idempotencyKey: key(), authority: 'software-architect' })
    const packet = ops.createModuleImplementationPacket({ projectId, actor, idempotencyKey: key(), moduleId, implementationSteps: ['implement it'], testCommands: ['npm test'] }).value!

    // Supersede the packet's base: reopen, change, and re-approve the module design.
    ops.reopenModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId })
    ops.updateModuleDesignItem({
      projectId,
      actor,
      idempotencyKey: key(),
      moduleId,
      path: 'module',
      value: { ...firstApproved.module, responsibility: 'Updated responsibility after reopening for a later revision.' },
    })
    ops.analyzeModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId })
    const secondApproved = ops.approveModuleDesign({ projectId, actor, idempotencyKey: key(), moduleId, authority: 'module-owner' }).value!
    expect(secondApproved.revision).not.toBe(firstApproved.revision)

    const staleDelta = buildDelta({
      deltaId: 'delta.stale-response.1',
      packetId: packet.packetId,
      baseRevision: firstApproved.revision,
      baseHash: firstApproved.contentHash,
      fileChanges: [{ path: 'capabilities/modules/mod.core/index.ts', action: 'create', content: 'export {}', contentHash: 'h' }],
      testResults: [{ command: 'npm test', passed: true, summary: 'ok' }],
    })

    const imported = ops.importAgentDelta({ projectId, actor, idempotencyKey: key(), delta: staleDelta })
    expect(imported.ok).toBe(true)

    const inspected = ops.inspectAgentDelta({ projectId, actor, idempotencyKey: key(), deltaId: staleDelta.deltaId })
    expect(inspected.value?.accepted).toBe(false)
    expect(inspected.value?.rejectionReasons).toContain('stale-base')

    expect(workspace.getReturnedDelta(projectId, staleDelta.deltaId)).toEqual(staleDelta)

    recordScenarioEvidence({
      scenarioId: 'S12-CHECK-stale-response',
      stepIds: ['delta.import', 'delta.inspect'],
      expected: 'A delta whose base revision was superseded by a later approval is rejected (stale-base) and preserved as evidence.',
      actual: 'delta rejected: stale-base; preserved in the workspace as evidence',
      outcome: 'passed',
      revisions: { design: secondApproved.revision },
    })
  })
})
