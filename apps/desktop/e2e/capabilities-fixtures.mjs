/**
 * Domain-neutral capability record fixtures for the packaged journey harness
 * (CAP-TEST-040 / CAP-JRN-001–008).
 *
 * These mirror the shapes exercised by packages/core's offline journeys
 * (packages/core/src/capabilities/journeys.ts) so the SAME canonical records
 * are pushed across the REAL preload → IPC → CapabilityWorkspace → disk path
 * rather than through in-process core helpers.
 */

export function productDraft(projectId, revision = '1') {
  return {
    schemaVersion: '1.0',
    projectId,
    id: 'app-inventory',
    revision,
    status: 'draft',
    purpose: 'Track inventory locally',
    outcomes: ['Operators can approve inventory counts'],
    actors: [{ id: 'operator', text: 'Operator' }],
    goals: [{ id: 'g1', text: 'Accurate counts' }],
    useCases: [{ id: 'u1', text: 'Approve count' }],
    scenarios: [{ id: 's1', text: 'Happy path count' }],
    information: [{ id: 'i1', text: 'SKU quantities' }],
    rules: [{ id: 'r1', text: 'Counts must be non-negative' }],
    externalSystems: [{ id: 'e1', text: 'Local files' }],
    constraints: [{ id: 'c1', text: 'Offline capable' }],
    scope: { inScope: ['counts'], outOfScope: ['ERP sync'] },
    acceptanceCases: [{ id: 'ac1', description: 'Approve a count', expectedOutcome: 'success' }],
    sources: [{ id: 'src1', text: 'product interview' }],
    unresolvedQuestions: [],
    contentHash: 'pending',
  }
}

export function domainManifest() {
  return {
    schemaVersion: '1.0',
    architectureVersion: '1.0',
    moduleId: 'mod.domain',
    moduleVersion: '1.0.0',
    moduleType: 'domain',
    name: 'Domain',
    responsibility: 'Inventory rules',
    ownedConcerns: ['rules'],
    excludedConcerns: ['ui'],
    providedOperations: [{ operationId: 'op.count.approve', contractVersion: '1.0.0' }],
    requiredOperations: [],
    verificationSuiteIds: ['suite.domain'],
    runtimeAllocation: 'local-embedded',
    events: [],
    ownedPaths: ['capabilities/modules/mod.domain/'],
  }
}

export function workflowManifest() {
  return {
    ...domainManifest(),
    moduleId: 'mod.workflow',
    name: 'Workflow',
    moduleType: 'workflow',
    responsibility: 'Approve flow',
    ownedConcerns: ['workflow'],
    excludedConcerns: ['storage'],
    providedOperations: [{ operationId: 'op.flow', contractVersion: '1.0.0' }],
    requiredOperations: [
      { operationId: 'op.count.approve', acceptedContractRange: '^1.0.0', reason: 'uses domain' },
    ],
    ownedPaths: ['capabilities/modules/mod.workflow/'],
  }
}

export function architectureDraft(product) {
  const manifest = domainManifest()
  return {
    schemaVersion: '1.0',
    projectId: product.projectId,
    id: 'arch-1',
    revision: '1',
    status: 'proposed',
    applicationSpecId: product.id,
    applicationSpecRevision: product.revision,
    applicationSpecHash: product.contentHash,
    capabilityProjections: [{ id: 'cap1', name: 'Inventory', moduleIds: [manifest.moduleId] }],
    moduleIds: [manifest.moduleId],
    dependencyEdges: [],
    operationAllocations: [{ operationId: 'op.count.approve', moduleId: manifest.moduleId }],
    adapterAllocations: [
      { adapterId: 'adapter.filesystem', moduleId: manifest.moduleId, portId: 'files' },
    ],
    workflowTraces: [{ useCaseId: 'u1', moduleIds: [manifest.moduleId] }],
    proposals: [],
    unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] },
    contentHash: 'pending',
  }
}

export function approveBindingRecord(projectId) {
  return {
    schemaVersion: '1.0',
    bindingId: 'bind-approve',
    version: '1.0.0',
    projectId,
    selectionEvidence: {
      route: '/',
      documentTitle: 'Inventory',
      selector: '#approve',
      visibleText: 'Approve',
      elementTag: 'button',
      role: 'button',
      name: 'Approve',
      stableMarker: 'data-cap-id=approve',
      captureTime: new Date().toISOString(),
    },
    trigger: 'activate',
    operationId: 'op.count.approve',
    operationVersion: '1.0.0',
    inputMappings: [{ from: 'qty', to: 'input.qty' }],
    outputMappings: [{ from: 'result', to: 'status' }],
    loadingBehavior: 'spinner',
    validationBehavior: 'inline',
    domainRejectionBehavior: 'toast',
    technicalFailureBehavior: 'banner',
    cancellationBehavior: 'idle',
    duplicateSubmissionBehavior: 'ignore',
    dataMode: 'connected',
  }
}
