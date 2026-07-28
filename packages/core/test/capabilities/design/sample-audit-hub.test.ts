/**
 * Default DO-178C Audit Hub sample.
 * Acceptance (SPECIFICATION.md §22 all, §16, §9.6, §14):
 *  - the sample opens with exactly the 17-module §22.2 catalog, matching
 *    provided/required operations and dependency edges per the catalog
 *    tables (one documented deviation: Lifecycle Explorer's `FollowTrace`
 *    is modeled as required, not provided — see the module-header note);
 *  - the five §22.3 defects are present and discoverable;
 *  - the §22.4 recommended order and §22.5 wave plan are exact, with
 *    `autoDispatch: false`;
 *  - the baseline is approved `completeBaseline`, with a saved
 *    `incrementalModules` preview that never alters the approved baseline;
 *  - three modules carry a draft later revision while their approved
 *    revision is preserved (§9.11);
 *  - module-design state variety (needsInput/readyForReview/stale/blocked)
 *    is present in the progress read model;
 *  - every module has an approved revision, approved operation contracts,
 *    owned paths, acceptance cases, and complete type-specific detail, and
 *    every approved module actually passes `evaluateModuleDesignChecks`;
 *  - every applicable diagram validates with zero blocker diagnostics;
 *  - the packet, delta, and inspection examples are real and accepted;
 *  - the builder is pure and deterministic (twice → deep-equal).
 */
import { describe, expect, it } from 'vitest'
import {
  SAMPLE_PROJECT_ID,
  buildSampleAuditHub,
  type ModuleVerificationResult,
} from '../../../src/capabilities/design/sampleAuditHub.js'
import { evaluateModuleDesignChecks, evaluateTypeSpecificCompleteness } from '../../../src/capabilities/design/moduleDesign.js'
import { validateUmlProjection } from '../../../src/capabilities/design/diagramSemantics.js'
import {
  evaluateApplicationWorkflows,
  evaluateSolutionAllocations,
  projectSolutionAllocationDiagrams,
} from '../../../src/capabilities/applicationWorkflow.js'
import { evaluateApplicationSte } from '../../../src/capabilities/simplifiedTechnicalEnglish.js'
import type { ModuleType } from '../../../src/capabilities/types.js'

const CATALOG: { moduleId: string; name: string; moduleType: ModuleType; provides: string[]; requires: string[] }[] = [
  { moduleId: 'mod.audit-workspace', name: 'Audit Workspace', moduleType: 'experience', provides: ['OpenReadiness', 'OpenFinding', 'RecordReviewDecision'], requires: ['mod.evidence-graph', 'mod.finding-review', 'mod.package-export', 'mod.workspace-snapshots'] },
  // Deviation: Lifecycle Explorer's catalog "FollowTrace" is modeled as a
  // required (consumed) operation on the Evidence Graph's contract, not a
  // second provided contract — see sampleAuditHub.ts for the rule that
  // forces this (one operation version has exactly one provider).
  { moduleId: 'mod.lifecycle-explorer', name: 'Lifecycle Explorer', moduleType: 'experience', provides: ['OpenLifecyclePhase', 'CompareEvidence'], requires: ['mod.evidence-graph', 'mod.workspace-snapshots'] },
  {
    moduleId: 'mod.import-and-publish',
    name: 'Import and Publish',
    moduleType: 'workflow',
    provides: ['RefreshEvidence', 'GetRefreshStatus', 'CancelRefresh'],
    requires: [
      'mod.adapter.filesystem',
      'mod.adapter.git',
      'mod.adapter.matlab-simulink',
      'mod.adapter.spreadsheet',
      'mod.adapter.c-header',
      'mod.adapter.coverage',
      'mod.adapter.review-evidence',
      'mod.adapter.objective-profile',
      'mod.evidence-graph',
      'mod.workspace-snapshots',
      'mod.evidence-store',
      'mod.job-package-store',
    ],
  },
  { moduleId: 'mod.finding-review', name: 'Finding Review', moduleType: 'workflow', provides: ['SubmitFindingDecision', 'CloseFinding', 'ReopenFinding'], requires: ['mod.evidence-graph', 'mod.evidence-store'] },
  { moduleId: 'mod.package-export', name: 'Package Export', moduleType: 'workflow', provides: ['CreateAuditPackage', 'GetPackageStatus', 'CancelPackage'], requires: ['mod.evidence-graph', 'mod.workspace-snapshots', 'mod.evidence-store', 'mod.job-package-store'] },
  {
    moduleId: 'mod.evidence-graph',
    name: 'Evidence Graph',
    moduleType: 'domain',
    provides: ['ResolveEvidenceIdentity', 'AddRelationship', 'FollowTrace', 'FindFirstGap', 'ReportCoverage', 'CompareRevisions'],
    requires: ['mod.evidence-store'],
  },
  { moduleId: 'mod.workspace-snapshots', name: 'Workspace Snapshots', moduleType: 'domain', provides: ['StageCandidate', 'StartValidation', 'PublishSnapshot', 'PreserveLastValid', 'CreateBaseline'], requires: ['mod.evidence-store'] },
  { moduleId: 'mod.adapter.filesystem', name: 'File-system adapter', moduleType: 'connection', provides: ['ProjectFileSourcePort'], requires: [] },
  { moduleId: 'mod.adapter.git', name: 'Git adapter', moduleType: 'connection', provides: ['RevisionSourcePort'], requires: [] },
  { moduleId: 'mod.adapter.matlab-simulink', name: 'MATLAB and Simulink adapter', moduleType: 'connection', provides: ['EngineeringModelSourcePort'], requires: [] },
  { moduleId: 'mod.adapter.spreadsheet', name: 'Spreadsheet adapter', moduleType: 'connection', provides: ['TabularEvidenceSourcePort'], requires: [] },
  { moduleId: 'mod.adapter.c-header', name: 'C and header source adapter', moduleType: 'connection', provides: ['SourceCodeEvidencePort'], requires: [] },
  { moduleId: 'mod.adapter.coverage', name: 'Coverage adapter', moduleType: 'connection', provides: ['CoverageEvidenceSourcePort'], requires: [] },
  { moduleId: 'mod.adapter.review-evidence', name: 'Review-evidence adapter', moduleType: 'connection', provides: ['ReviewEvidenceSourcePort'], requires: [] },
  { moduleId: 'mod.adapter.objective-profile', name: 'Objective-profile adapter', moduleType: 'connection', provides: ['ObjectiveProfileSourcePort'], requires: [] },
  { moduleId: 'mod.evidence-store', name: 'Evidence Store', moduleType: 'platform', provides: ['EvidenceStorePort'], requires: [] },
  { moduleId: 'mod.job-package-store', name: 'Job and Package Store', moduleType: 'platform', provides: ['JobStorePort', 'PackageStorePort'], requires: [] },
]

const RECOMMENDED_ORDER = [
  'mod.evidence-store',
  'mod.job-package-store',
  'mod.evidence-graph',
  'mod.workspace-snapshots',
  'mod.adapter.filesystem',
  'mod.adapter.git',
  'mod.adapter.matlab-simulink',
  'mod.adapter.spreadsheet',
  'mod.adapter.c-header',
  'mod.adapter.coverage',
  'mod.adapter.review-evidence',
  'mod.adapter.objective-profile',
  'mod.import-and-publish',
  'mod.finding-review',
  'mod.package-export',
  'mod.lifecycle-explorer',
  'mod.audit-workspace',
]

describe('Default DO-178C Audit Hub sample (§22)', () => {
  const sample = buildSampleAuditHub()

  it('opens with SAMPLE_PROJECT_ID and states it is synthetic (§22.1)', () => {
    expect(sample.projectId).toBe(SAMPLE_PROJECT_ID)
    expect(sample.syntheticDataStatement.toLowerCase()).toContain('synthetic')
  })

  it('contains exactly 17 modules with exact names and types from §22.2', () => {
    expect(sample.moduleDesigns).toHaveLength(17)
    const byId = new Map(sample.moduleDesigns.map((d) => [d.module.moduleId, d]))
    expect(byId.size).toBe(17)
    for (const entry of CATALOG) {
      const design = byId.get(entry.moduleId)
      expect(design, `missing module ${entry.moduleId}`).toBeDefined()
      expect(design!.module.name).toBe(entry.name)
      expect(design!.module.moduleType).toBe(entry.moduleType)
    }
    const experienceCount = CATALOG.filter((c) => c.moduleType === 'experience').length
    const workflowCount = CATALOG.filter((c) => c.moduleType === 'workflow').length
    const domainCount = CATALOG.filter((c) => c.moduleType === 'domain').length
    const connectionCount = CATALOG.filter((c) => c.moduleType === 'connection').length
    const platformCount = CATALOG.filter((c) => c.moduleType === 'platform').length
    expect([experienceCount, workflowCount, domainCount, connectionCount, platformCount]).toEqual([2, 3, 2, 8, 2])
  })

  it('matches provides/requires from the §22.2 catalog tables', () => {
    const byId = new Map(sample.approvedModuleDesigns ? Object.entries(sample.approvedModuleDesigns) : [])
    for (const entry of CATALOG) {
      const design = byId.get(entry.moduleId)!
      const providedIds = design.providedOperations.map((op) => op.operationId).sort()
      expect(providedIds, `provides for ${entry.moduleId}`).toEqual([...entry.provides].sort())
      expect(design.boundary.directDependencyIds, `requires for ${entry.moduleId}`).toEqual([...entry.requires].sort())
    }
  })

  it('recommends the exact §22.4 module-design order', () => {
    expect(sample.recommendedOrder).toEqual(RECOMMENDED_ORDER)
  })

  it('plans the exact seven §22.5 waves with autoDispatch false and one Copilot target per wave', () => {
    expect(sample.wavePlan.autoDispatch).toBe(false)
    expect(sample.wavePlan.waves).toHaveLength(7)
    const waveModuleIds = sample.wavePlan.waves.map((w) => w.modules.map((m) => m.moduleId).sort())
    expect(waveModuleIds[0]).toEqual(['mod.evidence-store', 'mod.job-package-store'].sort())
    expect(waveModuleIds[1]).toEqual(['mod.evidence-graph', 'mod.workspace-snapshots'].sort())
    expect(waveModuleIds[2]).toEqual(
      ['mod.adapter.filesystem', 'mod.adapter.git', 'mod.adapter.matlab-simulink', 'mod.adapter.spreadsheet', 'mod.adapter.c-header', 'mod.adapter.coverage', 'mod.adapter.review-evidence', 'mod.adapter.objective-profile'].sort(),
    )
    expect(waveModuleIds[3]).toEqual(['mod.import-and-publish', 'mod.finding-review', 'mod.package-export'].sort())
    expect(waveModuleIds[4]).toEqual(['mod.lifecycle-explorer', 'mod.audit-workspace'].sort())
    expect(sample.wavePlan.waves[2]!.modules.every((m) => m.batchEligible)).toBe(true)
    expect(sample.copilotHandoffTargets).toHaveLength(7)
    for (let i = 0; i < 7; i++) {
      expect(sample.copilotHandoffTargets[i]!.wave).toBe(i + 1)
      expect(sample.copilotHandoffTargets[i]!.moduleId).toBeTruthy()
    }
  })

  it('approves the baseline as completeBaseline and saves an incrementalModules preview without altering it (§22.1, §16.7)', () => {
    expect(sample.designBaseline.status).toBe('approved')
    expect(sample.designBaseline.missingModuleIds).toEqual([])
    expect(sample.policy.mode).toBe('completeBaseline')
    expect(sample.incrementalPreview.policy.mode).toBe('incrementalModules')
    // The preview policy is a distinct saved value; the active policy is untouched.
    expect(sample.policy.mode).not.toBe(sample.incrementalPreview.policy.mode)
    expect(sample.incrementalPreview.gateForFirstModule.moduleId).toBe(sample.recommendedOrder[0])
  })

  it('carries a draft later revision for at least three modules while the approved revision is preserved (§9.11, §22.3)', () => {
    const reopenedIds = Object.keys(sample.reopenedModuleDesigns)
    expect(reopenedIds.length).toBeGreaterThanOrEqual(3)
    for (const moduleId of reopenedIds) {
      const draft = sample.reopenedModuleDesigns[moduleId]!
      const approved = sample.approvedModuleDesigns[moduleId]!
      expect(approved.status).toBe('approved')
      expect(draft.status).not.toBe('approved')
      expect(draft.revision).not.toBe(approved.revision)
      expect(draft.approval).toBeUndefined()
      expect(approved.approval).toBeDefined()
    }
  })

  it('shows needsInput/readyForReview/stale/blocked state variety in progress (§9.2, §16.5)', () => {
    expect(sample.progress.needsInput).toBeGreaterThan(0)
    expect(sample.progress.readyForReview).toBeGreaterThan(0)
    expect(sample.progress.stale).toBeGreaterThan(0)
    expect(sample.progress.blocked).toBeGreaterThan(0)
    expect(sample.progress.approved).toBeGreaterThan(0)
    expect(sample.progress.total).toBe(17)
  })

  it('gives every module an approved revision, owned paths, acceptance cases, and complete type-specific detail that actually passes its gates', () => {
    expect(Object.keys(sample.approvedModuleDesigns)).toHaveLength(17)
    for (const design of Object.values(sample.approvedModuleDesigns)) {
      expect(design.status).toBe('approved')
      expect(design.approval).toBeDefined()
      expect(design.boundary.ownedPaths.length).toBeGreaterThan(0)
      expect(design.verification.acceptanceCases.length).toBeGreaterThan(0)
      expect(evaluateTypeSpecificCompleteness(design)).toEqual([])

      const providedContracts = design.providedOperations.map((op) => {
        const registered = sample.operationContracts.contracts.find((c) => c.operationId === op.operationId && c.version === op.version)
        return registered
      })
      for (const registered of providedContracts) {
        expect(registered, `operation contract for a provided operation of ${design.module.moduleId}`).toBeDefined()
        expect(registered!.status).toBe('approved')
      }

      const otherDesigns = Object.values(sample.approvedModuleDesigns).filter((d) => d.module.moduleId !== design.module.moduleId)
      const approvedContracts = sample.operationContracts.contracts.filter((c) => c.status === 'approved').map((c) => c.contract)
      const evaluation = evaluateModuleDesignChecks(design, { architecture: sample.architecture, otherDesigns, approvedContracts })
      expect(evaluation.passed, `${design.module.moduleId} checks: ${JSON.stringify(evaluation.diagnostics)}`).toBe(true)
    }
  })

  it('validates every diagram with zero blocker diagnostics, including every approved module component diagram', () => {
    expect(sample.diagrams.length).toBeGreaterThan(0)
    for (const projection of sample.diagrams) {
      const diagnostics = validateUmlProjection(projection)
      expect(diagnostics.filter((d) => d.severity === 'blocker')).toEqual([])
    }
    for (const design of Object.values(sample.approvedModuleDesigns)) {
      const component = sample.diagrams.find((d) => d.sourceRecordId === design.id && d.kind === 'component')
      expect(component, `component diagram for ${design.module.moduleId}`).toBeDefined()
    }
  })

  it('demonstrates at least a component diagram for all 17 modules, use-case diagrams for both experience modules, and sequence diagrams for at least 5 modules', () => {
    const componentCount = sample.diagrams.filter((d) => d.kind === 'component').length
    const useCaseCount = sample.diagrams.filter((d) => d.kind === 'useCase').length
    const sequenceCount = sample.diagrams.filter((d) => d.kind === 'sequence').length
    expect(componentCount).toBe(17)
    expect(useCaseCount).toBe(2)
    expect(sequenceCount).toBeGreaterThanOrEqual(5)
  })

  it('uses concise STE labels in every application workflow', () => {
    expect(evaluateApplicationWorkflows(sample.applicationSpecification).diagnostics).toEqual([])
    expect(evaluateApplicationSte(sample.applicationSpecification).diagnostics).toEqual([])
  })

  it('allocates application actions across modules and projects a real solution sequence', () => {
    expect(evaluateSolutionAllocations(sample.applicationSpecification, sample.architecture).diagnostics).toEqual([])
    const sequenceDiagrams = projectSolutionAllocationDiagrams(
      sample.applicationSpecification,
      sample.architecture,
    ).filter((diagram) => diagram.kind === 'sequence')
    expect(
      sequenceDiagrams.some((diagram) => diagram.nodes.length >= 2 && diagram.edges.length >= 1),
    ).toBe(true)
  })

  it('builds real packet examples; the implementation packet targets an approved module', () => {
    expect(sample.packets.moduleDesignPacket.approvalProhibited).toBe(true)
    const implModuleId = sample.packets.implementationPacket.moduleId
    expect(sample.approvedModuleDesigns[implModuleId]?.status).toBe('approved')
    expect(sample.packets.implementationPacket.moduleDesignHash).toBe(sample.approvedModuleDesigns[implModuleId]!.contentHash)
  })

  it('accepts the one inspected in-scope delta', () => {
    expect(sample.returnedDeltas).toHaveLength(1)
    expect(sample.inspections).toHaveLength(1)
    expect(sample.inspections[0]!.accepted).toBe(true)
    expect(sample.inspections[0]!.rejectionReasons).toEqual([])
  })

  it('records at least one design impact example (§10, §22.3)', () => {
    expect(sample.impactExamples.length).toBeGreaterThan(0)
    for (const impact of sample.impactExamples) {
      expect(impact.items.length).toBeGreaterThan(0)
    }
  })

  it('carries §14.3 scenario-run identity and §14.2 step evidence with screenshot policy fields', () => {
    expect(sample.scenarioRuns.length).toBeGreaterThan(0)
    for (const run of sample.scenarioRuns) {
      expect(run.identity.useCaseAnalysisRevision).toBe(sample.useCaseAnalysis.revision)
      expect(run.identity.systemStructureRevision).toBe(sample.architecture.revision)
      expect(run.steps.length).toBeGreaterThan(0)
      for (const step of run.steps) {
        const hasScreenshot = Boolean(step.screenshotRef && step.screenshotMetadata)
        const hasStructured = Boolean(step.structuredEvidenceRef)
        expect(hasScreenshot || hasStructured, `step ${step.stepId} needs screenshot or structured evidence`).toBe(true)
        if (step.screenshotMetadata) {
          expect(step.screenshotMetadata.browser).toBeTruthy()
          expect(step.screenshotMetadata.testDataRevision).toBeTruthy()
        }
      }
    }
    const passed = sample.scenarioRuns.filter((r) => r.outcome === 'passed')
    const failed = sample.scenarioRuns.filter((r) => r.outcome === 'failed')
    expect(passed.length).toBeGreaterThan(0)
    expect(failed.length).toBeGreaterThan(0)
  })

  it('has all five required §22.3 defects, discoverable from `sample.defects`', () => {
    expect(sample.defects.evidenceGraphBrokenTrace.moduleId).toBe('mod.evidence-graph')
    expect(sample.defects.evidenceGraphBrokenTrace.outcome).toBe('failed')

    expect(sample.defects.matlabAdapterTimeout.moduleId).toBe('mod.adapter.matlab-simulink')
    expect(sample.defects.matlabAdapterTimeout.outcome).toBe('timeout')

    expect(sample.defects.spreadsheetInvalidMapping.moduleId).toBe('mod.adapter.spreadsheet')
    expect(sample.defects.spreadsheetInvalidMapping.outcome).toBe('failed')

    expect(sample.defects.findingReviewRejectedDecision.outcome).toBe('rejected')
    expect(sample.defects.findingReviewRejectedDecision.operation).toBe('SubmitFindingDecision')

    expect(sample.defects.packageExportOldResult.currentState).toBe('old')
    expect(sample.defects.packageExportOldResult.run.scenarioId).toContain('export-package')
  })

  it('records a timeout outcome for the MATLAB and Simulink adapter (§19, §22.3)', () => {
    const matlabResults: ModuleVerificationResult[] = sample.verificationResults['mod.adapter.matlab-simulink'] ?? []
    expect(matlabResults.some((r) => r.outcome === 'timeout')).toBe(true)
  })

  it("reports Package Export's package result as old after the baseline/design revision change (§22.3, §14)", () => {
    expect(sample.defects.packageExportOldResult.currentState).toBe('old')
  })

  it('produces byte-identical output on a second call (pure, deterministic builder)', () => {
    const again = buildSampleAuditHub()
    expect(again).toEqual(sample)
  })
})
