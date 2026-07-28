import { describe, expect, it } from 'vitest'
import type {
  ApplicationSpecification,
  ArchitectureSpecification,
  CapDiagnostic,
  FrontendBinding,
  HttpInboundBinding,
  ModuleManifest,
} from '@engineering-ui-kit/core'
import { STE_PROMPT_MARKER } from '@engineering-ui-kit/core/browser'
import { installMockBridge } from '../src/mockBridge'

function gateCodes(gate: unknown): string[] {
  return ((gate as { diagnostics?: CapDiagnostic[] } | undefined)?.diagnostics ?? [])
    .map((item) => item.code)
}

async function saveBlockingLexicon(
  bridge: ReturnType<typeof installMockBridge>,
  projectId: string,
  alias = 'defect',
) {
  await bridge.capabilitiesSaveSteLexicon(
    projectId,
    {
      generalWords: ['record'],
      technicalTerms: [],
      prohibitedAliases: { [alias]: 'audit finding' },
    },
    'Licensed test vocabulary',
  )
}

function application(projectId: string): ApplicationSpecification {
  return {
    schemaVersion: '1.0',
    projectId,
    id: `app.${projectId}`,
    revision: '1.0.0',
    status: 'draft',
    purpose: 'Manage defect records.',
    outcomes: ['Audit records are available.'],
    actors: [{ id: 'actor.auditor', text: 'Auditor' }],
    goals: [],
    useCases: [{ id: 'usecase.review', text: 'Review audit findings' }],
    scenarios: [],
    information: [],
    rules: [],
    externalSystems: [],
    constraints: [],
    scope: { inScope: ['Audit records'], outOfScope: [] },
    acceptanceCases: [{
      id: 'accept.review',
      description: 'The auditor reviews a record.',
      expectedOutcome: 'The record is available.',
    }],
    sources: [],
    unresolvedQuestions: [],
    contentHash: 'app-hash',
  }
}

function architecture(projectId: string): ArchitectureSpecification {
  return {
    schemaVersion: '1.0',
    projectId,
    id: `arch.${projectId}`,
    revision: '1.0.0',
    status: 'draft',
    applicationSpecId: `app.${projectId}`,
    applicationSpecRevision: '1.0.0',
    applicationSpecHash: 'app-hash',
    capabilityProjections: [],
    moduleIds: ['mod.audit'],
    dependencyEdges: [],
    operationAllocations: [],
    adapterAllocations: [],
    workflowTraces: [],
    proposals: [{ id: 'proposal.audit', text: 'Use defect records.' }],
    unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
    contentHash: 'architecture-hash',
  }
}

function moduleManifest(): ModuleManifest {
  return {
    schemaVersion: '1.0',
    architectureVersion: '1.0',
    moduleId: 'mod.audit',
    moduleVersion: '1.0.0',
    moduleType: 'domain',
    name: 'Audit records',
    responsibility: 'Manage defect records.',
    ownedConcerns: ['Audit records'],
    excludedConcerns: ['User interface'],
    providedOperations: [{ operationId: 'op.review', contractVersion: '1.0.0' }],
    requiredOperations: [],
    verificationSuiteIds: ['accept.review'],
    runtimeAllocation: 'local-embedded',
    events: [],
    ownedPaths: ['capabilities/modules/mod.audit/'],
  }
}

describe('mock project STE approval gates', () => {
  it('adds the project vocabulary to browser review instructions', async () => {
    const bridge = installMockBridge()
    const project = await bridge.createProject({
      name: 'Review prompt',
      repoPath: '/mock/review-prompt',
    })
    await bridge.capabilitiesSaveSteLexicon(
      project.id,
      {
        generalWords: ['review'],
        technicalTerms: ['audit finding'],
        prohibitedAliases: { defect: 'audit finding' },
      },
      'Licensed test vocabulary',
    )
    const run = await bridge.createRun(project.id)

    const packet = await bridge.buildReviewPacket(run.id)

    expect(packet.reviewPacketText.startsWith(STE_PROMPT_MARKER)).toBe(true)
    expect(packet.reviewPacketText).toContain('"approvedTechnicalTerms":["audit finding"]')
    expect(packet.reviewPacketText).toContain('"preferredTermMap":{"defect":"audit finding"}')
    expect(packet.reviewPacketText).toContain('# Copilot Review Packet')
  })

  it('uses the saved vocabulary for frontend and inbound binding approval', async () => {
    const bridge = installMockBridge()
    const projectId = 'ste-binding-gate'
    await saveBlockingLexicon(bridge, projectId)
    const behavior = 'Report the defect.'
    const frontend: FrontendBinding = {
      schemaVersion: '1.0',
      bindingId: 'binding.frontend',
      version: '1.0.0',
      projectId,
      selectionEvidence: {
        route: '/',
        documentTitle: 'Test',
        selector: '#save',
        visibleText: 'Save',
        elementTag: 'button',
        captureTime: '2026-07-28T00:00:00.000Z',
        stableMarker: 'data-cap-id=save',
      },
      trigger: 'activate',
      operationId: 'op.save',
      operationVersion: '1.0.0',
      inputMappings: [],
      outputMappings: [],
      loadingBehavior: behavior,
      validationBehavior: behavior,
      domainRejectionBehavior: behavior,
      technicalFailureBehavior: behavior,
      cancellationBehavior: behavior,
      duplicateSubmissionBehavior: behavior,
      dataMode: 'connected',
    }
    const inbound: HttpInboundBinding = {
      schemaVersion: '1.0',
      kind: 'http',
      bindingId: 'binding.http',
      version: '1.0.0',
      projectId,
      deployableId: 'deployable.api',
      operationId: 'op.save',
      operationVersion: '1.0.0',
      inputMappings: [],
      outputMappings: [],
      validationBehavior: behavior,
      domainRejectionBehavior: behavior,
      technicalFailureBehavior: behavior,
      timeoutBehavior: behavior,
      cancellationBehavior: behavior,
      retryBehavior: behavior,
      duplicateSubmissionBehavior: behavior,
      exposure: 'private',
      generatedTargets: [],
      approvalState: 'draft',
      method: 'POST',
      path: '/save',
    }

    const frontendResult = await bridge.capabilitiesApproveBinding(projectId, frontend)
    const inboundResult = await bridge.capabilitiesApproveInboundBinding(projectId, inbound)

    expect(frontendResult.ok).toBe(false)
    expect(gateCodes(frontendResult)).toContain('STE-TERM-PREFERRED')
    expect(inboundResult.ok).toBe(false)
    expect(gateCodes(inboundResult)).toContain('STE-TERM-PREFERRED')
  })

  it('uses the saved vocabulary for product evaluation and approval', async () => {
    const bridge = installMockBridge()
    const projectId = 'ste-product-gate'
    await saveBlockingLexicon(bridge, projectId)
    const draft = application(projectId)

    const evaluated = await bridge.capabilitiesEvaluateProductGate(draft)
    const result = await bridge.capabilitiesApproveApplication(projectId, draft)

    expect(gateCodes(evaluated)).toContain('STE-TERM-PREFERRED')
    expect(result.ok).toBe(false)
    expect(gateCodes(result.gate)).toContain('STE-TERM-PREFERRED')
  })

  it('uses the saved vocabulary for architecture approval', async () => {
    const bridge = installMockBridge()
    const projectId = 'ste-architecture-gate'
    await saveBlockingLexicon(bridge, projectId)

    const result = await bridge.capabilitiesApproveArchitecture(projectId, architecture(projectId))

    expect(result.ok).toBe(false)
    expect(gateCodes(result.gate)).toContain('STE-TERM-PREFERRED')
  })

  it('uses the saved vocabulary for direct and batch module approval', async () => {
    const directBridge = installMockBridge()
    await saveBlockingLexicon(directBridge, 'ste-module-direct')
    const direct = await directBridge.capabilitiesApproveModule(
      'ste-module-direct',
      moduleManifest(),
    )
    expect(direct.ok).toBe(false)
    expect(gateCodes(direct.gate)).toContain('STE-TERM-PREFERRED')

    const batchBridge = installMockBridge()
    const projectId = 'ste-module-batch'
    const baseArchitecture = architecture(projectId)
    baseArchitecture.proposals = []
    expect((await batchBridge.capabilitiesApproveArchitecture(projectId, baseArchitecture)).ok).toBe(true)
    await saveBlockingLexicon(batchBridge, projectId)
    await batchBridge.capabilitiesSaveModuleDraft(projectId, moduleManifest())
    const batch = await batchBridge.capabilitiesApproveModuleBatch({
      projectId,
      moduleIds: ['mod.audit'],
      explicit: true,
    })

    expect(batch.ok).toBe(false)
    expect(batch.results[0]?.status).toBe('blocked')
    expect(gateCodes(batch.results[0]?.gate)).toContain('STE-TERM-PREFERRED')
  })

  it('uses the saved vocabulary for module-design approval', async () => {
    const bridge = installMockBridge()
    const projectId = 'do-178c-audit-hub'
    const moduleId = 'mod.assurance-workflow'
    const records = await bridge.capabilitiesListModuleDesigns(projectId)
    const record = records.find((item) => item.moduleId === moduleId)
    const draft = record?.draft ?? record?.approved
    expect(draft).toBeTruthy()
    await saveBlockingLexicon(bridge, projectId, 'snapshot')

    const result = await bridge.capabilitiesApproveModuleDesign({
      projectId,
      draft: draft!,
      explicit: true,
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((item) => item.code)).toContain('STE-TERM-PREFERRED')
  })
})
