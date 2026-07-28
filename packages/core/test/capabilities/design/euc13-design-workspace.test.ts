/**
 * EUC-13 — Persistence and migration adapter: workspace tests.
 * Acceptance from docs/use-case-led-workflow/SPECIFICATION.md §25.3 EUC-13..17,
 * §19 ("Lost client session", "Concurrent edit"), §20.3, §21, §5.3.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DesignConflictError, DesignPathError, DesignWorkspace } from '../../../src/capabilities/design/designWorkspace.js'
import { createModuleDesignDraft } from '../../../src/capabilities/design/moduleDesign.js'
import { createSession, completeStep } from '../../../src/capabilities/design/moduleDesignSession.js'
import type {
  ContextManifest,
  DesignAuditEvent,
  ModuleDesignSpecification,
  ReturnedDelta,
} from '../../../src/capabilities/design/records.js'
import type { ArchitectureSpecification, JobRecord } from '../../../src/capabilities/types.js'
import { CapabilityWorkspace } from '../../../src/capabilities/persistence.js'

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'euik-euc13-'))
}

function architectureFixture(overrides: Partial<ArchitectureSpecification> = {}): ArchitectureSpecification {
  return {
    schemaVersion: '1.0',
    projectId: 'proj-1',
    id: 'arch-1',
    revision: 'r1',
    status: 'approved',
    applicationSpecId: 'app-1',
    applicationSpecRevision: 'r1',
    applicationSpecHash: 'app-hash',
    capabilityProjections: [],
    moduleIds: ['mod.domain'],
    moduleDefinitions: [{ moduleId: 'mod.domain', name: 'Domain module', moduleType: 'domain', responsibility: 'Own domain rules' }],
    dependencyEdges: [],
    operationAllocations: [{ operationId: 'op.calculate', moduleId: 'mod.domain' }],
    adapterAllocations: [],
    workflowTraces: [],
    proposals: [],
    unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
    contentHash: 'arch-hash',
    ...overrides,
  }
}

function contextManifestFixture(id = 'ctx-1'): ContextManifest {
  return {
    id,
    targetRecordId: 'mod.domain',
    targetRevision: 'r1',
    tokenOrByteLimit: 8000,
    totalBytes: 0,
    entries: [],
    omitted: [],
    contentHash: 'ctx-hash',
  }
}

function moduleDesignDraftFixture(architecture: ArchitectureSpecification): ModuleDesignSpecification {
  return createModuleDesignDraft({ projectId: 'proj-1', architecture, moduleId: 'mod.domain' })
}

function auditEventFixture(overrides: Partial<DesignAuditEvent> = {}): DesignAuditEvent {
  return {
    eventId: 'evt-1',
    projectId: 'proj-1',
    actor: 'user:alice',
    operation: 'saveModuleDesignDraft',
    targetRecordId: 'mod.domain',
    at: '2026-01-01T00:00:00.000Z',
    outcome: 'ok',
    diagnosticCodes: [],
    evidenceRefs: [],
    ...overrides,
  }
}

describe('EUC-13 DesignWorkspace — additive subtree layout', () => {
  it('stores design records under design/ beside (not inside) the legacy capabilities/ tree', () => {
    const dir = tmpDir()
    const ws = new DesignWorkspace(dir)
    ws.ensureInitialized('proj-1')
    expect(ws.root('proj-1')).toBe(path.join(dir, 'projects', 'proj-1', 'design'))
    expect(fs.existsSync(path.join(dir, 'projects', 'proj-1', 'design', 'meta', 'schema-version.json'))).toBe(true)
    expect(fs.existsSync(path.join(dir, 'projects', 'proj-1', 'capabilities'))).toBe(false)
  })

  it('owns meta/schema-version.json at "1.0" for the design subtree', () => {
    const dir = tmpDir()
    const ws = new DesignWorkspace(dir)
    const meta = ws.ensureInitialized('proj-1')
    expect(meta.schemaVersion).toBe('1.0')
  })

  it('lists every project with an initialized design subtree', () => {
    const dir = tmpDir()
    const ws = new DesignWorkspace(dir)
    ws.ensureInitialized('proj-b')
    ws.ensureInitialized('proj-a')
    expect(ws.listProjects()).toEqual(['proj-a', 'proj-b'])
  })
})

describe('EUC-13 DesignWorkspace — immutable approved revisions', () => {
  it('never overwrites an approved module-design revision (§5.3, §2.2)', () => {
    const dir = tmpDir()
    const ws = new DesignWorkspace(dir)
    const architecture = architectureFixture()
    const draft = moduleDesignDraftFixture(architecture)
    const approved: ModuleDesignSpecification = { ...draft, status: 'approved' }
    ws.approveModuleDesign('proj-1', 'mod.domain', approved)

    const differentApproved: ModuleDesignSpecification = {
      ...approved,
      module: { ...approved.module, responsibility: 'a materially different responsibility text' },
    }
    expect(() => ws.approveModuleDesign('proj-1', 'mod.domain', differentApproved)).toThrow(/already exists/)

    // The originally approved content is untouched.
    const onDisk = ws.getApprovedModuleDesign('proj-1', 'mod.domain', approved.revision)
    expect(onDisk?.module.responsibility).toBe(approved.module.responsibility)
  })

  it('keeps full approved revision history per module', () => {
    const dir = tmpDir()
    const ws = new DesignWorkspace(dir)
    const architecture = architectureFixture()
    const draft = moduleDesignDraftFixture(architecture)
    ws.approveModuleDesign('proj-1', 'mod.domain', { ...draft, revision: 'r1', status: 'approved' })
    ws.approveModuleDesign('proj-1', 'mod.domain', { ...draft, revision: 'r2', status: 'approved' })
    const history = ws.listModuleDesignRevisions('proj-1', 'mod.domain')
    expect(history.map((entry) => entry.revision)).toEqual(['r1', 'r2'])
  })

  it('never overwrites an immutable module-design packet', () => {
    const dir = tmpDir()
    const ws = new DesignWorkspace(dir)
    const packet = {
      schemaVersion: '1.0' as const,
      packetId: 'packet-1',
      projectId: 'proj-1',
      moduleId: 'mod.domain',
      moduleType: 'domain' as const,
      architectureRevision: 'r1',
      architectureHash: 'arch-hash',
      systemSlice: { moduleSummaries: [], dependencyEdges: [] },
      useCaseIds: [],
      scenarioStepIds: [],
      providerSummaries: [],
      consumerSummaries: [],
      projectRules: [],
      typeSpecificQuestions: [],
      contextManifest: contextManifestFixture(),
      existingPatterns: [],
      missingDecisions: [],
      expectedResponseSchemaRef: 'ModuleDesignSpecification@1.0' as const,
      stableIdsToPreserve: [],
      responseValidationRules: [],
      approvalProhibited: true as const,
      idempotencyKey: 'idem-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      contentHash: 'packet-hash',
    }
    ws.saveModuleDesignPacket('proj-1', packet)
    expect(() => ws.saveModuleDesignPacket('proj-1', { ...packet, projectRules: [{ id: 'r', text: 'changed' }] })).toThrow(
      /immutable/,
    )
    expect(ws.getModuleDesignPacket('proj-1', 'packet-1')?.contentHash).toBe('packet-hash')
  })

  it('never overwrites an immutable scenario run', () => {
    const dir = tmpDir()
    const ws = new DesignWorkspace(dir)
    const run = {
      schemaVersion: '1.0' as const,
      runId: 'run-1',
      projectId: 'proj-1',
      scenarioId: 'scn-1',
      useCaseId: 'uc-1',
      identity: {
        useCaseAnalysisRevision: 'r1',
        applicationRevision: 'r1',
        systemStructureRevision: 'r1',
        moduleDesignRevisions: {},
        implementationRevisions: {},
        connectionRevision: 'r1',
        build: 'build-1',
        sourceRevision: 'src-1',
        environment: 'test',
        testDataRevision: 'r1',
        runner: 'vitest',
      },
      steps: [],
      outcome: 'passed' as const,
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:00:01.000Z',
      evidenceHashes: [],
      contentHash: 'run-hash',
    }
    ws.saveScenarioRun('proj-1', run)
    expect(() => ws.saveScenarioRun('proj-1', run)).toThrow(/immutable/)
  })

  it('persists and retrieves a semantic scenario-run id longer than an OS filename segment', () => {
    const dir = tmpDir()
    const ws = new DesignWorkspace(dir)
    const runId = `run.${'failure-path-segment.'.repeat(12)}result`
    const run = {
      schemaVersion: '1.0' as const,
      runId,
      projectId: 'proj-1',
      scenarioId: `${'scenario.failure.'.repeat(10)}final`,
      useCaseId: 'uc-1',
      identity: {
        useCaseAnalysisRevision: 'r1',
        applicationRevision: 'r1',
        systemStructureRevision: 'r1',
        moduleDesignRevisions: {},
        implementationRevisions: {},
        connectionRevision: 'r1',
        build: 'build-1',
        sourceRevision: 'src-1',
        environment: 'test',
        testDataRevision: 'r1',
        runner: 'vitest',
      },
      steps: [],
      outcome: 'passed' as const,
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:00:01.000Z',
      evidenceHashes: [],
      contentHash: 'long-run-hash',
    }

    expect(runId.length).toBeGreaterThan(255)
    ws.saveScenarioRun('proj-1', run)
    expect(ws.getScenarioRun('proj-1', runId)).toEqual(run)
    expect(ws.listScenarioRuns('proj-1')).toEqual([run])
    const persistedNames = fs.readdirSync(path.join(dir, 'projects', 'proj-1', 'design', 'scenario-runs'))
    expect(persistedNames).toHaveLength(1)
    expect(persistedNames[0]!.length).toBeLessThan(140)
  })
})

describe('EUC-13 DesignWorkspace — audit append-only + idempotent retry', () => {
  it('appends events and never rewrites an earlier line', () => {
    const dir = tmpDir()
    const ws = new DesignWorkspace(dir)
    ws.appendAuditEvent('proj-1', auditEventFixture({ eventId: 'evt-1', idempotencyKey: 'key-1' }))
    ws.appendAuditEvent('proj-1', auditEventFixture({ eventId: 'evt-2', idempotencyKey: 'key-2' }))
    const events = ws.listAuditEvents('proj-1')
    expect(events.map((event) => event.eventId)).toEqual(['evt-1', 'evt-2'])
  })

  it('a retry with the same idempotency key returns the first committed result (§5.3, §17.3)', () => {
    const dir = tmpDir()
    const ws = new DesignWorkspace(dir)
    const first = ws.appendAuditEvent('proj-1', auditEventFixture({ eventId: 'evt-1', idempotencyKey: 'key-1', resultHash: 'hash-a' }))
    const retry = ws.appendAuditEvent(
      'proj-1',
      auditEventFixture({ eventId: 'evt-2', idempotencyKey: 'key-1', resultHash: 'hash-b' }),
    )
    expect(retry).toEqual(first)
    expect(ws.listAuditEvents('proj-1')).toHaveLength(1)
    expect(ws.findAuditEventByIdempotencyKey('proj-1', 'key-1')?.eventId).toBe('evt-1')
  })
})

describe('EUC-13 DesignWorkspace — concurrent edit (§19)', () => {
  it('rejects a stale draft save with a structured conflict carrying both revisions', () => {
    const dir = tmpDir()
    const ws = new DesignWorkspace(dir)
    const architecture = architectureFixture()
    const draft = moduleDesignDraftFixture(architecture)
    ws.saveModuleDesignDraft('proj-1', 'mod.domain', draft)

    // Someone else saved a newer revision on disk in the meantime.
    const newerOnDisk: ModuleDesignSpecification = { ...draft, revision: 'r2', module: { ...draft.module, responsibility: 'updated by another user' } }
    ws.saveModuleDesignDraft('proj-1', 'mod.domain', newerOnDisk)

    const staleAttempt: ModuleDesignSpecification = { ...draft, module: { ...draft.module, responsibility: 'my stale edit' } }
    let caught: unknown
    try {
      ws.saveModuleDesignDraft('proj-1', 'mod.domain', staleAttempt, { expectedRevision: draft.revision })
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(DesignConflictError)
    const conflict = caught as DesignConflictError<ModuleDesignSpecification>
    expect(conflict.expectedRevision).toBe('r1')
    expect(conflict.actualRevision).toBe('r2')
    expect(conflict.onDisk?.module.responsibility).toBe('updated by another user')
    expect(conflict.attempted.module.responsibility).toBe('my stale edit')

    // The on-disk (newer) draft is unaffected by the rejected attempt.
    expect(ws.getModuleDesignDraft('proj-1', 'mod.domain')?.module.responsibility).toBe('updated by another user')
  })

  it('accepts a save whose expectedRevision matches the current on-disk revision', () => {
    const dir = tmpDir()
    const ws = new DesignWorkspace(dir)
    const architecture = architectureFixture()
    const draft = moduleDesignDraftFixture(architecture)
    ws.saveModuleDesignDraft('proj-1', 'mod.domain', draft)
    const next: ModuleDesignSpecification = { ...draft, module: { ...draft.module, responsibility: 'legit edit' } }
    expect(() => ws.saveModuleDesignDraft('proj-1', 'mod.domain', next, { expectedRevision: draft.revision })).not.toThrow()
    expect(ws.getModuleDesignDraft('proj-1', 'mod.domain')?.module.responsibility).toBe('legit edit')
  })
})

describe('EUC-13 DesignWorkspace — session restart restores exact step (§19, §25.3)', () => {
  it('restores the exact current step and selected module after a simulated restart', () => {
    const dir = tmpDir()
    const first = new DesignWorkspace(dir)
    const manifest = contextManifestFixture()
    let session = createSession({
      projectId: 'proj-1',
      moduleId: 'mod.domain',
      baseArchitectureRevision: 'r1',
      sourceManifest: manifest,
      now: '2026-01-01T00:00:00.000Z',
    })
    session = completeStep(session, 'boundary', '2026-01-01T00:05:00.000Z')
    session = completeStep(session, 'behavior', '2026-01-01T00:10:00.000Z')
    first.saveModuleDesignSession('proj-1', session)
    first.saveWorkspaceState('proj-1', { selectedModuleId: 'mod.domain', lastRoute: '/design/mod.domain/contracts' })

    // Simulate application restart: a brand-new DesignWorkspace instance, same dataDir.
    const restarted = new DesignWorkspace(dir)
    const restoredSession = restarted.getModuleDesignSession('proj-1', 'mod.domain')
    expect(restoredSession?.currentStep).toBe('contracts')
    expect(restoredSession?.completedSteps).toEqual(['boundary', 'behavior'])
    const state = restarted.getWorkspaceState('proj-1')
    expect(state?.selectedModuleId).toBe('mod.domain')
    expect(state?.lastRoute).toBe('/design/mod.domain/contracts')
  })
})

describe('EUC-13 DesignWorkspace — rejected delta preserved as evidence (§19 "Stale response")', () => {
  it('preserves the returned delta even though its inspection rejects it', () => {
    const dir = tmpDir()
    const ws = new DesignWorkspace(dir)
    const delta: ReturnedDelta = {
      schemaVersion: '1.0',
      deltaId: 'delta-1',
      packetId: 'packet-1',
      baseRevision: 'r1',
      baseHash: 'base-hash',
      fileChanges: [{ path: 'src/mod.domain/index.ts', action: 'change', content: 'stale content' }],
      recordChanges: [],
      testResults: [],
      assumptions: [],
      unresolvedIssues: [],
      requestedScopeChanges: [],
      evidenceFiles: [],
      returnedAt: '2026-01-01T00:00:00.000Z',
      contentHash: 'delta-hash',
    }
    ws.saveReturnedDelta('proj-1', delta)
    ws.saveDeltaInspection('proj-1', {
      inspectionId: 'insp-1',
      deltaId: 'delta-1',
      packetId: 'packet-1',
      inspectedContentHash: 'delta-hash',
      workspaceRevisionAtInspection: 'r2',
      accepted: false,
      rejectionReasons: ['stale-base'],
      fileSummary: { created: [], changed: [], deleted: [] },
      recordChanges: [],
      contractChanges: [],
      affectedRequirementIds: [],
      affectedUseCaseIds: [],
      testResults: [],
      newWarnings: [],
      newDependencies: [],
      outOfScopeAttempts: [],
      generatedFiles: [],
      userOwnedFiles: [],
      rollbackPointRef: 'rollback-1',
      inspectedAt: '2026-01-01T00:00:01.000Z',
    })

    const preserved = ws.getReturnedDelta('proj-1', 'delta-1')
    expect(preserved?.fileChanges[0]?.content).toBe('stale content')
    const inspection = ws.getDeltaInspection('proj-1', 'insp-1')
    expect(inspection?.accepted).toBe(false)
    expect(inspection?.rejectionReasons).toEqual(['stale-base'])
  })
})

describe('EUC-13 DesignWorkspace — jobs survive restart (§21)', () => {
  it('reloads a saved job record from a new DesignWorkspace instance', () => {
    const dir = tmpDir()
    const first = new DesignWorkspace(dir)
    const job: JobRecord = {
      schemaVersion: '1.0',
      jobId: 'job-1',
      projectId: 'proj-1',
      operationId: 'op.compileImplementationPacket',
      operationVersion: '1.0',
      inputHash: 'input-hash',
      state: 'running',
      progress: { ratio: 0.4, message: 'compiling context' },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:01:00.000Z',
      startedAt: '2026-01-01T00:00:05.000Z',
      diagnostics: [],
      artifactRefs: [],
    }
    first.saveJobRecord('proj-1', job)

    const restarted = new DesignWorkspace(dir)
    const jobs = restarted.loadJobRecords('proj-1')
    expect(jobs).toHaveLength(1)
    expect(jobs[0]?.jobId).toBe('job-1')
    expect(jobs[0]?.state).toBe('running')
    expect(restarted.getJobRecord('proj-1', 'job-1')?.progress?.ratio).toBe(0.4)
  })
})

describe('EUC-13 DesignWorkspace — legacy CapabilityWorkspace compatibility', () => {
  it('legacy CapabilityWorkspace operations still work unchanged with a design/ subtree present', () => {
    const dir = tmpDir()
    const legacy = new CapabilityWorkspace(dir)
    const design = new DesignWorkspace(dir)

    design.ensureInitialized('proj-1')
    const architecture = architectureFixture()
    design.saveArchitectureDraft('proj-1', architecture)

    legacy.ensureInitialized('proj-1')
    legacy.saveArchitectureDraft('proj-1', architecture)
    const approvedLegacy = legacy.approveArchitecture('proj-1', architecture)
    expect(approvedLegacy.status).toBe('approved')
    expect(legacy.getApprovedArchitecture('proj-1')?.id).toBe(architecture.id)

    // Both trees coexist under the same project without interfering.
    expect(fs.existsSync(legacy.root('proj-1'))).toBe(true)
    expect(fs.existsSync(design.root('proj-1'))).toBe(true)
    expect(legacy.root('proj-1')).not.toBe(design.root('proj-1'))
    expect(design.getArchitectureDraft('proj-1')?.id).toBe(architecture.id)
  })
})

describe('EUC-13 DesignWorkspace — path containment (finding R4, §20.2 "reject symbolic-link or path-traversal escapes")', () => {
  /** An isolated parent directory so "nothing was written outside dataDir" can be asserted by listing it. */
  function isolatedDataDir(): { parent: string; dataDir: string } {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-euc13-guard-'))
    return { parent, dataDir: path.join(parent, 'data') }
  }

  it('rejects a path-traversal project id in ensureInitialized and writes nothing outside dataDir', () => {
    const { parent, dataDir } = isolatedDataDir()
    const ws = new DesignWorkspace(dataDir)
    expect(() => ws.ensureInitialized('../../escaped-project')).toThrow(DesignPathError)
    expect(fs.existsSync(dataDir)).toBe(false)
    expect(fs.readdirSync(parent)).toEqual([])
  })

  it('rejects an embedded ".." project id segment and a bare ".." project id', () => {
    const { dataDir } = isolatedDataDir()
    const ws = new DesignWorkspace(dataDir)
    expect(() => ws.ensureInitialized('..')).toThrow(DesignPathError)
    expect(() => ws.ensureInitialized('proj/../../escaped')).toThrow(DesignPathError)
    expect(() => ws.getApprovedArchitecture('../../escaped-project')).toThrow(DesignPathError)
  })

  it('rejects a path-traversal module id and writes nothing outside dataDir', () => {
    const { parent, dataDir } = isolatedDataDir()
    const ws = new DesignWorkspace(dataDir)
    const architecture = architectureFixture()
    const draft = moduleDesignDraftFixture(architecture)
    expect(() => ws.saveModuleDesignDraft('proj-1', '../../escaped-module', draft)).toThrow(DesignPathError)
    expect(() => ws.getModuleDesignDraft('proj-1', '../escaped-module')).toThrow(DesignPathError)
    // The legitimate projectId initialization (a side effect of the guarded call) may exist;
    // nothing with the traversal target's name exists anywhere under the isolated parent.
    expect(fs.existsSync(path.join(parent, 'escaped-module'))).toBe(false)
    expect(fs.readdirSync(parent)).toEqual(['data'])
  })

  it('rejects a path-traversal revision string on an approve* write and read', () => {
    const { parent, dataDir } = isolatedDataDir()
    const ws = new DesignWorkspace(dataDir)
    const architecture = architectureFixture()
    const draft = moduleDesignDraftFixture(architecture)
    const approved: ModuleDesignSpecification = { ...draft, revision: '../../escaped-revision', status: 'approved' }
    expect(() => ws.approveModuleDesign('proj-1', 'mod.domain', approved)).toThrow(DesignPathError)
    expect(() => ws.getApprovedModuleDesign('proj-1', 'mod.domain', '../../escaped-revision')).toThrow(DesignPathError)
    expect(fs.existsSync(path.join(parent, 'escaped-revision'))).toBe(false)
  })

  it('rejects a path-traversal packet id on save and get', () => {
    const { parent, dataDir } = isolatedDataDir()
    const ws = new DesignWorkspace(dataDir)
    const packet = {
      schemaVersion: '1.0' as const,
      packetId: '../../escaped-packet',
      projectId: 'proj-1',
      moduleId: 'mod.domain',
      moduleType: 'domain' as const,
      architectureRevision: 'r1',
      architectureHash: 'arch-hash',
      systemSlice: { moduleSummaries: [], dependencyEdges: [] },
      useCaseIds: [],
      scenarioStepIds: [],
      providerSummaries: [],
      consumerSummaries: [],
      projectRules: [],
      typeSpecificQuestions: [],
      contextManifest: contextManifestFixture(),
      existingPatterns: [],
      missingDecisions: [],
      expectedResponseSchemaRef: 'ModuleDesignSpecification@1.0' as const,
      stableIdsToPreserve: [],
      responseValidationRules: [],
      approvalProhibited: true as const,
      idempotencyKey: 'idem-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      contentHash: 'packet-hash',
    }
    expect(() => ws.saveModuleDesignPacket('proj-1', packet)).toThrow(DesignPathError)
    expect(() => ws.getModuleDesignPacket('proj-1', '../../escaped-packet')).toThrow(DesignPathError)
    expect(fs.existsSync(path.join(parent, 'escaped-packet'))).toBe(false)
  })

  it('rejects a path-traversal idempotency key and operation name on saveOperationResult/findOperationResult', () => {
    const { parent, dataDir } = isolatedDataDir()
    const ws = new DesignWorkspace(dataDir)
    ws.ensureInitialized('proj-1')
    expect(() =>
      ws.saveOperationResult('proj-1', 'createUseCaseDraft', '../../escaped-key', {
        ok: true,
        diagnostics: [],
        auditEventId: 'evt-1',
        validNextActions: [],
      }),
    ).toThrow(DesignPathError)
    expect(() => ws.findOperationResult('proj-1', '../../escaped-op', 'idem-1')).toThrow(DesignPathError)
    expect(fs.existsSync(path.join(parent, 'escaped-key'))).toBe(false)
  })

  it('rejects a path-traversal operationId/version on the contract registry', () => {
    const { parent, dataDir } = isolatedDataDir()
    const ws = new DesignWorkspace(dataDir)
    ws.ensureInitialized('proj-1')
    const contract = {
      operationId: '../../escaped-op',
      version: '1.0.0',
      providerModuleId: 'mod.domain',
      status: 'draft' as const,
      contract: {
        schemaVersion: '1.0' as const,
        operationId: 'op.x',
        version: '1.0.0',
        behavior: 'command' as const,
        inputSchemaRef: '',
        outputSchemaRef: '',
        preconditions: [],
        postconditions: [],
        domainRejections: [],
        technicalErrors: [],
        sideEffects: [],
        idempotency: 'unknown' as const,
        timeoutClass: 'medium' as const,
        cancellable: false,
        artifactTypes: [],
        provenanceFields: [],
      },
      contentHash: 'contract-hash',
    }
    expect(() => ws.saveContract('proj-1', contract)).toThrow(DesignPathError)
    expect(() => ws.getContract('proj-1', '../../escaped-op', '1.0.0')).toThrow(DesignPathError)
    expect(fs.existsSync(path.join(parent, 'escaped-op'))).toBe(false)
  })
})
