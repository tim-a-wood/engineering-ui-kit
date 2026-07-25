/**
 * EUC-13 — Persistence and migration adapter: migration tests.
 * Acceptance from docs/use-case-led-workflow/SPECIFICATION.md §23 (all),
 * §25.3 EUC-13..17.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  defaultFeatureFlag,
  disableDesignWorkflow,
  enableDesignWorkflow,
  exportDesignRecords,
  migrateExistingProject,
  migrateLegacyImplementationEvidence,
  migrationEvidence,
  type MigrateModuleInput,
} from '../../../src/capabilities/design/designMigration.js'
import { DesignWorkspace } from '../../../src/capabilities/design/designWorkspace.js'
import { CapabilityWorkspace } from '../../../src/capabilities/persistence.js'
import type { ArchitectureSpecification, ModuleManifest } from '../../../src/capabilities/types.js'
import type { ModuleInterviewResponse } from '../../../src/capabilities/moduleInterview.js'

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'euik-euc13-migration-'))
}

function architectureFixture(): ArchitectureSpecification {
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
    moduleIds: ['mod.domain', 'mod.experience'],
    moduleDefinitions: [
      { moduleId: 'mod.domain', name: 'Domain module', moduleType: 'domain', responsibility: 'Own domain rules' },
      { moduleId: 'mod.experience', name: 'Experience module', moduleType: 'experience', responsibility: 'Render the main screen' },
    ],
    dependencyEdges: [{ fromModuleId: 'mod.experience', toModuleId: 'mod.domain', reason: 'reads domain state' }],
    operationAllocations: [{ operationId: 'op.calculate', moduleId: 'mod.domain' }],
    adapterAllocations: [],
    workflowTraces: [],
    proposals: [],
    unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
    contentHash: 'arch-hash',
  }
}

function moduleManifestFixture(moduleId: string, moduleType: ModuleManifest['moduleType'] = 'domain'): ModuleManifest {
  return {
    schemaVersion: '1.0',
    architectureVersion: '1.0',
    moduleId,
    moduleVersion: '1.0.0',
    moduleType,
    name: `${moduleId} module`,
    responsibility: `${moduleId} responsibility`,
    ownedConcerns: ['owns-thing'],
    excludedConcerns: ['excluded-thing'],
    providedOperations: [{ operationId: 'op.calculate', contractVersion: '1.0.0' }],
    requiredOperations: [],
    verificationSuiteIds: [],
    runtimeAllocation: 'local-embedded',
    events: [],
    ownedPaths: [`src/${moduleId}/`],
  }
}

function interviewFixture(moduleId: string): ModuleInterviewResponse {
  return {
    moduleId,
    moduleType: 'domain',
    name: `${moduleId} module`,
    responsibility: `${moduleId} responsibility`,
    ownedConcerns: ['owns-thing'],
    excludedConcerns: ['excluded-thing'],
    providedOperations: [{ operationId: 'op.calculate', contractVersion: '1.0.0' }],
    verificationSuiteIds: [],
    runtimeAllocation: 'local-embedded',
    answers: [],
    rules: [{ id: 'rule-1', text: 'Calculations are deterministic.' }],
    acceptanceCases: [{ id: 'ac-1', description: 'Calculates a valid result', expectedOutcome: 'returns the computed value' }],
  }
}

describe('EUC-13 migrateExistingProject (§23.1)', () => {
  it('creates one draft ModuleDesignSpecification per allocated module, never approved', () => {
    const architecture = architectureFixture()
    const modules: MigrateModuleInput[] = [
      { manifest: moduleManifestFixture('mod.domain', 'domain'), interview: interviewFixture('mod.domain') },
      { manifest: moduleManifestFixture('mod.experience', 'experience') },
    ]
    const { plan, moduleDesigns } = migrateExistingProject({
      projectId: 'proj-1',
      architecture,
      modules,
      now: '2026-01-01T00:00:00.000Z',
    })

    expect(moduleDesigns).toHaveLength(2)
    expect(moduleDesigns.map((design) => design.module.moduleId).sort()).toEqual(['mod.domain', 'mod.experience'])
    for (const design of moduleDesigns) {
      expect(design.status === 'draft' || design.status === 'needsInput').toBe(true)
      expect(design.status).not.toBe('approved')
    }
    expect(plan.preservedArchitecture).toEqual({ id: architecture.id, revision: architecture.revision, contentHash: architecture.contentHash })
    expect(plan.moduleDesignDraftIds).toHaveLength(2)
  })

  it('marks inferred fields via inferredFieldPaths', () => {
    const architecture = architectureFixture()
    const { moduleDesigns, plan } = migrateExistingProject({
      projectId: 'proj-1',
      architecture,
      modules: [{ manifest: moduleManifestFixture('mod.domain', 'domain'), interview: interviewFixture('mod.domain') }],
      now: '2026-01-01T00:00:00.000Z',
    })
    const design = moduleDesigns[0]!
    expect(design.inferredFieldPaths).toBeDefined()
    expect(design.inferredFieldPaths).toContain('module.ownedConcerns')
    expect(design.inferredFieldPaths).toContain('rules')
    expect(plan.inferredFieldPathsByModule['mod.domain']).toEqual(design.inferredFieldPaths)
  })

  it('identifies missing type-specific fields as needsInput when no interview or implementation spec is available', () => {
    const architecture = architectureFixture()
    const { moduleDesigns, plan } = migrateExistingProject({
      projectId: 'proj-1',
      architecture,
      modules: [{ manifest: moduleManifestFixture('mod.experience', 'experience') }],
      now: '2026-01-01T00:00:00.000Z',
    })
    const design = moduleDesigns[0]!
    expect(design.status).toBe('needsInput')
    expect(design.unresolvedItems.length).toBeGreaterThan(0)
    expect(design.unresolvedItems.every((item) => item.materiality === 'material')).toBe(true)
    expect(plan.needsInputByModule['mod.experience']!.length).toBeGreaterThan(0)
  })

  it('does not remove or alter existing module approvals in the legacy CapabilityWorkspace (byte-for-byte)', () => {
    const dir = tmpDir()
    const legacy = new CapabilityWorkspace(dir)
    const manifest = moduleManifestFixture('mod.domain', 'domain')
    legacy.approveModule('proj-1', manifest)
    const approvedPath = path.join(legacy.root('proj-1'), 'modules', 'mod.domain', 'approved', `${manifest.moduleVersion}.json`)
    const before = fs.readFileSync(approvedPath, 'utf8')

    // Run migration (pure) and persist its output through the *design* workspace only.
    const architecture = architectureFixture()
    const { moduleDesigns } = migrateExistingProject({
      projectId: 'proj-1',
      architecture,
      modules: [{ manifest, interview: interviewFixture('mod.domain') }],
      now: '2026-01-01T00:00:00.000Z',
    })
    const design = new DesignWorkspace(dir)
    for (const moduleDesign of moduleDesigns) {
      design.saveModuleDesignDraft('proj-1', moduleDesign.module.moduleId, moduleDesign)
    }

    const after = fs.readFileSync(approvedPath, 'utf8')
    expect(after).toBe(before)
    // The legacy approved-module index entry is also untouched.
    expect(legacy.getApprovedModule('proj-1', 'mod.domain')?.moduleVersion).toBe('1.0.0')
  })

  it('populates from ModuleManifest, preserved interview, operation contracts, and repository context where available', () => {
    const architecture = architectureFixture()
    const { moduleDesigns } = migrateExistingProject({
      projectId: 'proj-1',
      architecture,
      modules: [
        {
          manifest: moduleManifestFixture('mod.domain', 'domain'),
          interview: interviewFixture('mod.domain'),
          providedContracts: [
            {
              schemaVersion: '1.0',
              operationId: 'op.calculate',
              version: '1.0.1',
              behavior: 'query',
              inputSchemaRef: 'schemas/input.json',
              outputSchemaRef: 'schemas/output.json',
              preconditions: [],
              postconditions: [],
              domainRejections: [],
              technicalErrors: [],
              sideEffects: [],
              idempotency: 'idempotent',
              timeoutClass: 'short',
              cancellable: false,
              artifactTypes: [],
              provenanceFields: [],
            },
          ],
          repositoryContextRefs: ['src/mod.domain/calculate.ts'],
        },
      ],
      now: '2026-01-01T00:00:00.000Z',
    })
    const design = moduleDesigns[0]!
    expect(design.providedOperations.find((op) => op.operationId === 'op.calculate')?.version).toBe('1.0.1')
    expect(design.rules.map((rule) => rule.text)).toContain('Calculations are deterministic.')
    expect(design.trace.sourceRefs).toEqual(['src/mod.domain/calculate.ts'])
    expect(design.verification.acceptanceCases.map((ac) => ac.id)).toContain('ac-1')
  })
})

describe('EUC-13 migrationEvidence (§23.3 "project-by-project migration evidence")', () => {
  it('summarizes the migration plan for one project', () => {
    const architecture = architectureFixture()
    const { plan } = migrateExistingProject({
      projectId: 'proj-1',
      architecture,
      modules: [
        { manifest: moduleManifestFixture('mod.domain', 'domain'), interview: interviewFixture('mod.domain') },
        { manifest: moduleManifestFixture('mod.experience', 'experience') },
      ],
      now: '2026-01-01T00:00:00.000Z',
    })
    const evidence = migrationEvidence('proj-1', plan)
    expect(evidence.projectId).toBe('proj-1')
    expect(evidence.moduleCount).toBe(2)
    // Neither module's interview/manifest data populates the type-specific
    // detail block, so both remain `needsInput` (§23.1 item 5).
    expect(evidence.needsInputModuleCount).toBe(2)
  })
})

describe('EUC-13 feature flag (§23.3)', () => {
  it('starts disabled and leaves existing projects usable', () => {
    const flag = defaultFeatureFlag('proj-1', '2026-01-01T00:00:00.000Z')
    expect(flag.enabled).toBe(false)
  })

  it('disabling never deletes records: records are intact after disable then re-enable', () => {
    const dir = tmpDir()
    const ws = new DesignWorkspace(dir)
    const architecture = architectureFixture()
    const { moduleDesigns } = migrateExistingProject({
      projectId: 'proj-1',
      architecture,
      modules: [{ manifest: moduleManifestFixture('mod.domain', 'domain'), interview: interviewFixture('mod.domain') }],
      now: '2026-01-01T00:00:00.000Z',
    })
    for (const design of moduleDesigns) {
      ws.saveModuleDesignDraft('proj-1', design.module.moduleId, design)
    }
    let flag = defaultFeatureFlag('proj-1', '2026-01-01T00:00:00.000Z')
    flag = enableDesignWorkflow(flag, 'user:alice', '2026-01-01T00:01:00.000Z')
    ws.saveFeatureFlag('proj-1', flag)
    expect(ws.getModuleDesignDraft('proj-1', 'mod.domain')).toBeDefined()

    flag = disableDesignWorkflow(ws.getFeatureFlag('proj-1')!, 'user:alice', '2026-01-01T00:02:00.000Z')
    ws.saveFeatureFlag('proj-1', flag)
    expect(ws.getFeatureFlag('proj-1')?.enabled).toBe(false)
    // Records are preserved (not deleted) while disabled.
    expect(ws.getModuleDesignDraft('proj-1', 'mod.domain')?.module.moduleId).toBe('mod.domain')

    flag = enableDesignWorkflow(ws.getFeatureFlag('proj-1')!, 'user:alice', '2026-01-01T00:03:00.000Z')
    ws.saveFeatureFlag('proj-1', flag)
    expect(ws.getFeatureFlag('proj-1')?.enabled).toBe(true)
    expect(ws.getModuleDesignDraft('proj-1', 'mod.domain')?.module.moduleId).toBe('mod.domain')
  })

  it('supports export before disable, and the export bundle round-trips through JSON', () => {
    const dir = tmpDir()
    const ws = new DesignWorkspace(dir)
    const architecture = architectureFixture()
    const { moduleDesigns } = migrateExistingProject({
      projectId: 'proj-1',
      architecture,
      modules: [{ manifest: moduleManifestFixture('mod.domain', 'domain'), interview: interviewFixture('mod.domain') }],
      now: '2026-01-01T00:00:00.000Z',
    })
    for (const design of moduleDesigns) {
      ws.saveModuleDesignDraft('proj-1', design.module.moduleId, design)
      ws.approveModuleDesign('proj-1', design.module.moduleId, { ...design, status: 'approved' })
    }
    ws.saveArchitectureDraft('proj-1', architecture)
    ws.approveArchitecture('proj-1', architecture)

    const bundle = exportDesignRecords(ws, 'proj-1', '2026-01-01T00:05:00.000Z')
    const roundTripped = JSON.parse(JSON.stringify(bundle))
    expect(roundTripped).toEqual(bundle)
    expect(roundTripped.modules['mod.domain'].approvedRevisions).toHaveLength(1)
    expect(roundTripped.architecture.approvedRevisions).toHaveLength(1)

    // Export remains possible before disabling, and disabling afterward does not invalidate it.
    const flag = disableDesignWorkflow(defaultFeatureFlag('proj-1'), 'user:alice')
    ws.saveFeatureFlag('proj-1', flag)
    expect(ws.getModuleDesignDraft('proj-1', 'mod.domain')).toBeDefined()
  })
})

describe('EUC-13 migrateLegacyImplementationEvidence (§23.2)', () => {
  it('links matching behavior, flags implementation without design and design without implementation, and proposes an overlay', () => {
    const architecture = architectureFixture()
    const { moduleDesigns } = migrateExistingProject({
      projectId: 'proj-1',
      architecture,
      modules: [
        { manifest: moduleManifestFixture('mod.domain', 'domain'), interview: interviewFixture('mod.domain') },
      ],
      now: '2026-01-01T00:00:00.000Z',
    })
    const approvedDesigns = moduleDesigns.map((design) => ({ ...design, status: 'approved' as const }))

    const report = migrateLegacyImplementationEvidence({
      projectId: 'proj-1',
      modules: [
        { moduleId: 'mod.domain', ownedFiles: ['src/mod.domain/ac-1.test.ts', 'src/mod.domain/index.ts'] },
        { moduleId: 'mod.unowned', ownedFiles: ['src/mod.unowned/index.ts'] },
      ],
      moduleDesigns: approvedDesigns,
      now: '2026-01-01T00:00:00.000Z',
    })

    expect(report.behaviorMatchedToAcceptance).toEqual([
      { moduleId: 'mod.domain', acceptanceCaseId: 'ac-1', matchedFiles: ['src/mod.domain/ac-1.test.ts'] },
    ])
    expect(report.implementationWithoutApprovedDesign).toEqual([
      { moduleId: 'mod.unowned', files: ['src/mod.unowned/index.ts'] },
    ])
    expect(report.approvedBehaviorWithoutImplementation).toEqual([])
    expect(report.overlayProposal.deltaId).toBe('migration-overlay-proj-1')
    expect(report.overlayProposal.requestedScopeChanges).toEqual([
      'Module mod.unowned has implementation with no approved design source.',
    ])
  })

  it('identifies approved behavior with no implementation evidence', () => {
    const architecture = architectureFixture()
    const { moduleDesigns } = migrateExistingProject({
      projectId: 'proj-1',
      architecture,
      modules: [{ manifest: moduleManifestFixture('mod.domain', 'domain'), interview: interviewFixture('mod.domain') }],
      now: '2026-01-01T00:00:00.000Z',
    })
    const approvedDesigns = moduleDesigns.map((design) => ({ ...design, status: 'approved' as const }))

    const report = migrateLegacyImplementationEvidence({
      projectId: 'proj-1',
      modules: [{ moduleId: 'mod.domain', ownedFiles: ['src/mod.domain/unrelated.ts'] }],
      moduleDesigns: approvedDesigns,
      now: '2026-01-01T00:00:00.000Z',
    })
    expect(report.approvedBehaviorWithoutImplementation).toEqual([{ moduleId: 'mod.domain', acceptanceCaseId: 'ac-1' }])
    expect(report.overlayProposal.unresolvedIssues).toEqual([
      'No implementation evidence found for mod.domain acceptance case ac-1.',
    ])
  })
})
