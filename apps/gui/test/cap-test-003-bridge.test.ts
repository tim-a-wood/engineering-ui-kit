import { describe, expect, it } from 'vitest'
import { installMockBridge } from '../src/mockBridge'

/**
 * Canonical capability bridge surface. Every operation exposed by the desktop
 * preload (`apps/desktop/src/preload.cts`) and typed in the shared contract
 * (`apps/desktop/src/bridgeApi.ts`) must have a typed renderer method here, and
 * the renderer must expose NO methods the preload does not. This list is the
 * parity oracle; drift on either side fails the test.
 */
const CANONICAL_CAP_METHODS = [
  'capabilitiesEnsureInitialized',
  'capabilitiesGetApplication',
  'capabilitiesSaveApplicationDraft',
  'capabilitiesApproveApplication',
  'capabilitiesEvaluateProductGate',
  'capabilitiesBuildInterviewPacket',
  'capabilitiesExportInterviewPacket',
  'capabilitiesExportImplementationPacket',
  'capabilitiesStartHandoffDrag',
  'capabilitiesImportInterviewResponse',
  'capabilitiesGetArchitecture',
  'capabilitiesSaveArchitectureDraft',
  'capabilitiesApproveArchitecture',
  'capabilitiesSaveModuleDraft',
  'capabilitiesApproveModule',
  'capabilitiesListModules',
  'capabilitiesListBindings',
  'capabilitiesListRuns',
  'capabilitiesCreateRun',
  'capabilitiesInspectOverlay',
  'capabilitiesApplyOverlay',
  'capabilitiesCalculateFreshness',
  'capabilitiesFilesystemRead',
  'capabilitiesFilesystemWrite',
  'capabilitiesSecretPut',
  'capabilitiesMatlabSessionStatus',
  'capabilitiesMatlabInvoke',
  'capabilitiesAzureDiscover',
  'capabilitiesAzureImportWorkItem',
  'capabilitiesInvokeOperation',
  'capabilitiesSaveBindingDraft',
  'capabilitiesApproveBinding',
  'capabilitiesListDeployables',
  'capabilitiesListInboundBindings',
  'capabilitiesSaveInboundBindingDraft',
  'capabilitiesApproveInboundBinding',
  'capabilitiesListNeedsAttention',
  'capabilitiesCalculateImpact',
  'capabilitiesApproveImpact',
  'capabilitiesListImpacts',
  'capabilitiesDeltaQueueState',
  'capabilitiesExportDeltaPacket',
  'capabilitiesMarkDeltaTargetComplete',
  'capabilitiesRunModuleVerification',
  'capabilitiesVerifyApprovedModule',
  'capabilitiesProposeFoundation',
  'capabilitiesGetFoundation',
  'capabilitiesSaveFoundationDraft',
  'capabilitiesApproveFoundation',
  'capabilitiesGetIntegrationState',
  'capabilitiesPreviewGeneration',
  'capabilitiesApplyGeneration',
  'capabilitiesRollbackGeneration',
  'capabilitiesRunConnectionVerification',
  'capabilitiesListConnectionVerifications',
  'capabilitiesSaveCompositionConfiguration',
  'capabilitiesRunIntegrationCommands',
] as const

describe('CAP-TEST-003 capabilities bridge surface', () => {
  it('exposes every canonical named capability method on the renderer bridge', () => {
    const bridge = installMockBridge()
    for (const name of CANONICAL_CAP_METHODS) {
      expect(typeof (bridge as unknown as Record<string, unknown>)[name], name).toBe('function')
    }
  })

  it('exposes NO capability method outside the canonical parity set', () => {
    const bridge = installMockBridge()
    const exposed = Object.keys(bridge).filter((k) => k.startsWith('capabilities'))
    const extra = exposed.filter((k) => !CANONICAL_CAP_METHODS.includes(k as never))
    expect(extra).toEqual([])
    expect(exposed.sort()).toEqual([...CANONICAL_CAP_METHODS].sort())
  })

  it('omits generic privileged clients', () => {
    const bridge = installMockBridge()
    expect((bridge as { readFile?: unknown }).readFile).toBeUndefined()
    expect((bridge as { exec?: unknown }).exec).toBeUndefined()
    expect((bridge as { matlabEval?: unknown }).matlabEval).toBeUndefined()
    expect((bridge as { invoke?: unknown }).invoke).toBeUndefined()
  })

  it('lists needs-attention from architecture modules as draft until verified', async () => {
    const bridge = installMockBridge()
    const projectId = 'p-attention'
    await bridge.capabilitiesEnsureInitialized(projectId)
    await bridge.capabilitiesApproveArchitecture(projectId, {
      schemaVersion: '1.0',
      projectId,
      id: 'arch.1',
      revision: '1.0.0',
      status: 'approved',
      applicationSpecId: 'app.1',
      applicationSpecRevision: '1.0.0',
      applicationSpecHash: 'hash-app',
      capabilityProjections: [],
      moduleIds: ['mod.domain', 'mod.ui'],
      dependencyEdges: [],
      operationAllocations: [],
      adapterAllocations: [],
      workflowTraces: [],
      proposals: [],
      unresolvedQuestions: [],
      gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
      contentHash: 'hash-arch',
    })
    const items = await bridge.capabilitiesListNeedsAttention(projectId)
    expect(items.map((i) => i.moduleId)).toEqual(['mod.domain', 'mod.ui'])
    expect(items.every((i) => i.primaryState === 'draft')).toBe(true)
    expect(items[0]?.nextAction).toMatch(/interview|approve/i)
  })

  it('blocks incomplete binding approval and simulates non-connected modes', async () => {
    const bridge = installMockBridge()
    const incomplete = {
      schemaVersion: '1.0',
      bindingId: 'binding.demo',
      version: '1.0.0',
      projectId: 'p1',
      selectionEvidence: {
        route: '/',
        documentTitle: 'Demo',
        selector: '#save',
        visibleText: 'Save',
        elementTag: 'button',
        captureTime: '2026-07-12T00:00:00.000Z',
        stableMarker: 'data-cap-id=btn.save',
      },
      trigger: 'activate',
      operationId: 'op.save',
      operationVersion: '1.0.0',
      inputMappings: [],
      outputMappings: [],
      loadingBehavior: '',
      validationBehavior: '',
      domainRejectionBehavior: '',
      technicalFailureBehavior: '',
      cancellationBehavior: '',
      duplicateSubmissionBehavior: '',
      dataMode: 'connected',
    }
    const blocked = await bridge.capabilitiesApproveBinding('p1', incomplete)
    expect(blocked.ok).toBe(false)

    const simulated = await bridge.capabilitiesInvokeOperation({
      projectId: 'p1',
      operationId: 'op.save',
      dataMode: 'approved-example',
      explicit: false,
    })
    expect(simulated).toMatchObject({
      outcome: 'success',
      value: { simulated: true, dataMode: 'approved-example' },
    })

    const draft = await bridge.capabilitiesSaveBindingDraft('p1', incomplete)
    expect(draft).toEqual({ ok: true })
  })
})
