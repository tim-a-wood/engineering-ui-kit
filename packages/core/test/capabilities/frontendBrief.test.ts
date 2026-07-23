import { describe, expect, it } from 'vitest'
import { lintTaskPacket } from '../../src/packetLint.js'
import { compileFrontendBrief } from '../../src/capabilities/frontendBrief.js'
import type {
  ApplicationSpecification,
  ArchitectureSpecification,
  FrontendBinding,
  ModuleManifest,
} from '../../src/capabilities/types.js'

const application: ApplicationSpecification = {
  schemaVersion: '1.0',
  projectId: 'project-1',
  id: 'application-1',
  revision: '3',
  status: 'approved',
  purpose: 'Help certification engineers assemble an audit.',
  outcomes: ['Find missing evidence before formal review.'],
  actors: [{ id: 'engineer', text: 'Certification engineer' }],
  goals: [{ id: 'prepare', text: 'Prepare a complete audit package' }],
  useCases: [{ id: 'review-evidence', text: 'Review evidence by lifecycle phase' }],
  scenarios: [],
  information: [],
  rules: [],
  externalSystems: [],
  constraints: [],
  scope: { inScope: ['Evidence review'], outOfScope: [] },
  acceptanceCases: [{
    id: 'accept-review',
    description: 'Open evidence by lifecycle phase',
    expectedOutcome: 'Evidence and gaps are visible',
  }],
  sources: [],
  unresolvedQuestions: [],
  contentHash: 'application-hash',
}

const architecture: ArchitectureSpecification = {
  schemaVersion: '1.0',
  projectId: 'project-1',
  id: 'architecture-1',
  revision: '5',
  status: 'approved',
  applicationSpecId: application.id,
  applicationSpecRevision: application.revision,
  applicationSpecHash: application.contentHash,
  capabilityProjections: [],
  moduleIds: ['mod.evidence', 'mod.experience'],
  moduleDefinitions: [
    { moduleId: 'mod.evidence', name: 'Evidence', moduleType: 'domain', responsibility: 'Classify evidence.' },
    { moduleId: 'mod.experience', name: 'Audit hub', moduleType: 'experience', responsibility: 'Present audit evidence.' },
  ],
  dependencyEdges: [
    { fromModuleId: 'mod.experience', toModuleId: 'mod.evidence', reason: 'Presents classifications.' },
  ],
  operationAllocations: [
    { operationId: 'evidence.list', moduleId: 'mod.evidence' },
    { operationId: 'audit.open', moduleId: 'mod.experience' },
  ],
  adapterAllocations: [],
  workflowTraces: [{ useCaseId: 'review-evidence', moduleIds: ['mod.experience', 'mod.evidence'] }],
  proposals: [],
  unresolvedQuestions: [],
  gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
  contentHash: 'architecture-hash',
}

const experience: ModuleManifest = {
  schemaVersion: '1.0',
  architectureVersion: '1.0',
  moduleId: 'mod.experience',
  moduleVersion: '1.2.0',
  moduleType: 'experience',
  name: 'Audit hub',
  responsibility: 'Present audit evidence by lifecycle phase.',
  ownedConcerns: ['Evidence exploration'],
  excludedConcerns: ['Evidence classification rules'],
  providedOperations: [{ operationId: 'audit.open', contractVersion: '1.0' }],
  requiredOperations: [{
    operationId: 'evidence.list',
    acceptedContractRange: '^1.0',
    reason: 'Loads evidence.',
  }],
  verificationSuiteIds: ['suite.audit-ui'],
  runtimeAllocation: 'local-embedded',
  events: [],
  ownedPaths: ['apps/audit-hub/src'],
}

const binding: FrontendBinding = {
  schemaVersion: '1.0',
  bindingId: 'binding.evidence-list',
  version: '2',
  projectId: 'project-1',
  selectionEvidence: {
    route: '/evidence',
    documentTitle: 'Audit hub',
    selector: '[data-testid=evidence-list]',
    visibleText: 'Evidence explorer',
    elementTag: 'section',
    stableMarker: 'evidence-list',
    captureTime: '2026-07-23T00:00:00.000Z',
  },
  trigger: 'submit',
  operationId: 'evidence.list',
  operationVersion: '1.0',
  inputMappings: [],
  outputMappings: [],
  loadingBehavior: 'Show skeleton rows.',
  validationBehavior: 'Explain invalid filters.',
  domainRejectionBehavior: 'Show the rule rejection.',
  technicalFailureBehavior: 'Keep filters and offer retry.',
  cancellationBehavior: 'Stop loading and keep the previous list.',
  duplicateSubmissionBehavior: 'Ignore duplicate refreshes.',
  dataMode: 'live',
}

describe('frontend brief compiler', () => {
  it('compiles approved product, module, operation, and binding truth into editable packet fields', () => {
    const brief = compileFrontendBrief({
      projectId: 'project-1',
      application,
      architecture,
      modules: [experience],
      bindings: [binding],
      generatedAt: '2026-07-23T00:00:00.000Z',
    })

    expect(brief.coverage).toEqual({
      moduleIds: ['mod.experience'],
      operationIds: ['audit.open', 'evidence.list'],
      bindingIds: ['binding.evidence-list'],
      routes: ['/evidence'],
      useCaseIds: ['review-evidence'],
    })
    expect(brief.fields.goal).toContain('Evidence explorer → evidence.list @ 1.0 on /evidence')
    expect(brief.fields.goal).toContain('Show skeleton rows.')
    expect(brief.fields.references).toContain('binding.evidence-list @ 2')
    expect(brief.gaps).toEqual([])
    expect(lintTaskPacket(brief.fields)).toEqual({ valid: true, diagnostics: [] })
  })

  it('marks a missing experience target as blocking and a missing binding as reviewable', () => {
    const brief = compileFrontendBrief({
      projectId: 'project-1',
      architecture,
      modules: [],
      bindings: [],
    })

    expect(brief.gaps.map((gap) => [gap.code, gap.severity])).toEqual([
      ['FRONTEND-BRIEF-APPLICATION', 'warning'],
      ['FRONTEND-BRIEF-MODULE', 'blocking'],
      ['FRONTEND-BRIEF-BINDING', 'warning'],
    ])
  })
})
