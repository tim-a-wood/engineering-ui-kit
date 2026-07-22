import { describe, expect, it } from 'vitest'
import type { DeployableSpecification, FoundationPlan, InboundBinding } from '@engineering-ui-kit/core'
import { isBrowserUiVerificationBinding, projectActiveBindingRecords, projectActiveBindings, projectActiveDeployables, projectDerivedOutboundBindingRefs, promoteRemoteUiBindings } from '../src/capabilities/deployableProjection.js'

function deployable(deployableId: string, kind: DeployableSpecification['kind']): DeployableSpecification {
  return {
    schemaVersion: '1.0', deployableId, name: deployableId, kind,
    runtimeLanguage: 'typescript', runtimeVersionRange: '>=22', moduleIds: [], inboundBindingIds: [],
    compositionRootPath: `composition/${deployableId}.ts`, commands: {}, configurationRefs: [], secretReferenceIds: [],
    proposedLocations: [{ path: `composition/${deployableId}.ts`, evidence: 'test', approvalStatus: 'approved' }],
  }
}

describe('active deployable projection', () => {
  it('excludes retired append-only deployable records from Connect', () => {
    const browser = deployable('browser', 'browser')
    const httpApi = deployable('http-api', 'http-api')
    const retired = deployable('embedded-library', 'embedded-library')
    const foundation = {
      schemaVersion: '1.0', projectId: 'project', architectureId: 'architecture', architectureRevision: '2', architectureHash: 'hash',
      deployables: [browser, httpApi], allocations: [], resolvedAnswers: [], unresolvedAmbiguities: [],
      readiness: { status: 'ready', issues: [] }, contentHash: 'foundation-hash',
    } satisfies FoundationPlan

    expect(projectActiveDeployables([browser, retired, httpApi], foundation).map((item) => item.deployableId))
      .toEqual(['browser', 'http-api'])
  })

  it('drops retired bindings and promotes a browser UI operation with a matching remote HTTP route', () => {
    const browser = deployable('browser', 'browser')
    const httpApi = deployable('http-api', 'http-api')
    const foundation = {
      schemaVersion: '1.0', projectId: 'project', architectureId: 'architecture', architectureRevision: '2', architectureHash: 'hash',
      deployables: [browser, httpApi], allocations: [], resolvedAnswers: [], unresolvedAmbiguities: [],
      readiness: { status: 'ready', issues: [] }, contentHash: 'foundation-hash',
    } satisfies FoundationPlan
    const common = {
      schemaVersion: '1.0', version: '1.0.0', projectId: 'project', operationId: 'op.workflow.calculate', operationVersion: '1.0.0',
      inputMappings: [], outputMappings: [], validationBehavior: 'validate', domainRejectionBehavior: 'reject',
      technicalFailureBehavior: 'fail', timeoutBehavior: 'timeout', cancellationBehavior: 'cancel', retryBehavior: 'retry',
      duplicateSubmissionBehavior: 'dedupe', exposure: 'private', generatedTargets: [], approvalState: 'approved',
    } as const
    const ui = { ...common, kind: 'ui', bindingId: 'ui', deployableId: 'browser', transport: 'browser-local', trigger: 'activate' } satisfies InboundBinding
    const http = { ...common, kind: 'http', bindingId: 'http', deployableId: 'http-api', method: 'POST', path: '/api/workflow/calculate' } satisfies InboundBinding
    const retired = { ...common, kind: 'http', bindingId: 'retired', deployableId: 'embedded-library', method: 'POST', path: '/old' } satisfies InboundBinding

    const active = projectActiveBindings([ui, retired, http], foundation)
    expect(active.map((binding) => binding.bindingId)).toEqual(['ui', 'http'])
    expect(projectActiveBindingRecords([
      { bindingId: 'ui', approved: ui },
      { bindingId: 'retired', approved: retired },
      { bindingId: 'http', approved: http },
    ], foundation).map((record) => record.bindingId)).toEqual(['ui', 'http'])
    expect(promoteRemoteUiBindings([ui], [http])[0]).toMatchObject({ transport: 'generated-http-client' })
    expect(isBrowserUiVerificationBinding(ui)).toBe(true)
    expect(isBrowserUiVerificationBinding({ ...ui, transport: 'generated-http-client' })).toBe(true)
    expect(isBrowserUiVerificationBinding({ ...ui, transport: 'electron-ipc' })).toBe(false)
    expect(projectDerivedOutboundBindingRefs(
      ['custom.audit-adapter', retired.bindingId, http.bindingId],
      [ui, retired, http],
      foundation,
      'browser',
      new Set(['op.workflow.calculate']),
    )).toEqual(['custom.audit-adapter', 'http'])
  })
})
