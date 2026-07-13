/**
 * Offline MVP journeys CAP-JRN-001–008 (CAP-PKT-032 / CAP-TEST-040).
 * Uses CapabilityWorkspace + in-process fake adapters — no network, no Electron.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type {
  ApplicationSpecification,
  ArchitectureSpecification,
  AzureDevOpsProvenance,
  FrontendBinding,
  MatlabSessionRecord,
  ModuleManifest,
  ResultEnvelope,
  VerificationRecord,
} from './types.js'
import { CapabilityWorkspace, canonicalHash } from './persistence.js'
import { CapabilityRunStore } from './runs.js'
import { evaluateProductGate, evaluateArchitectureGate, evaluateModuleGate } from './gates.js'
import { importProductInterviewResponse, buildProductInterviewPacket } from './interview.js'
import { buildArchitectureInterviewPacket, evaluateArchitectureProposal } from './architectureInterview.js'
import { buildImplementationPacket, buildDeltaPacket } from './packets.js'
import { buildVerificationRecord, isEligibleForReady } from './verification.js'
import { calculateFreshness } from './freshness.js'
import { calculateImpact, classifyImpact, nextActionableTarget } from './impact.js'
import { buildCapabilityGraph } from './graph.js'
import { resolveProjectRelativePath, type FilesystemPolicy } from './filesystem.js'
import { approveFrontendBinding, executeBindingMode, selectionAllowsProgress } from './binding.js'
import { successResult } from './runtime.js'

export type JourneyEvidence = {
  journeyId: string
  passed: boolean
  evidence: Record<string, unknown>
}

export type FakeFilesystemAdapter = {
  root: string
  policy: FilesystemPolicy
  read(relativePath: string, explicit: boolean): ResultEnvelope
  write(relativePath: string, contents: string, explicit: boolean): ResultEnvelope
}

export type FakeMatlabAdapter = {
  sessions: Map<string, MatlabSessionRecord>
  snapshots: Map<string, { selected: Record<string, unknown>; projectId: string }>
  start(projectId: string): MatlabSessionRecord
  status(projectId: string): MatlabSessionRecord | undefined
  saveSnapshot(projectId: string, selected: Record<string, unknown>): string
  restoreSnapshot(projectId: string, snapshotId: string): MatlabSessionRecord
}

export type FakeAzureAdapter = {
  items: Map<string, { title: string; revision: string; fields: Record<string, string> }>
  discover(opaqueSecretId: string): { projects: string[]; workItemIds: string[] }
  importWorkItem(externalId: string): AzureDevOpsProvenance
}

const FS_POLICY: FilesystemPolicy = {
  roots: {
    source: 'capabilities/modules',
    'generated-output': 'capabilities/generated',
    configuration: 'capabilities/config',
    'input-data': 'data',
    artifacts: 'artifacts',
  },
}

export function createFakeFilesystemAdapter(projectRoot: string): FakeFilesystemAdapter {
  return {
    root: projectRoot,
    policy: FS_POLICY,
    read(relativePath, explicit) {
      if (!explicit) throw new Error('filesystem read requires explicit user action')
      const resolved = resolveProjectRelativePath(FS_POLICY, relativePath, [
        'source',
        'input-data',
        'artifacts',
        'configuration',
        'generated-output',
      ])
      if (!resolved.ok) {
        return {
          schemaVersion: '1.0',
          outcome: 'technical-failure',
          diagnostics: [],
          artifacts: [],
          provenance: { source: 'fake-filesystem', recordedAt: new Date().toISOString() },
          error: {
            schemaVersion: '1.0',
            code: 'CAP-FS-003',
            category: 'validation',
            safeMessage: 'path rejected',
            retryability: 'none',
            relatedIds: [],
            diagnosticRefs: [],
          },
        }
      }
      const abs = path.join(projectRoot, resolved.relativePath)
      const value = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : ''
      return successResult(
        { relativePath: resolved.relativePath, contents: value, byteSize: Buffer.byteLength(value) },
        { source: 'fake-filesystem', recordedAt: new Date().toISOString() },
      )
    },
    write(relativePath, contents, explicit) {
      if (!explicit) throw new Error('filesystem write requires explicit user action')
      const resolved = resolveProjectRelativePath(FS_POLICY, relativePath, [
        'source',
        'input-data',
        'artifacts',
        'generated-output',
        'configuration',
      ])
      if (!resolved.ok) {
        return {
          schemaVersion: '1.0',
          outcome: 'technical-failure',
          diagnostics: [],
          artifacts: [],
          provenance: { source: 'fake-filesystem', recordedAt: new Date().toISOString() },
          error: {
            schemaVersion: '1.0',
            code: 'CAP-FS-003',
            category: 'validation',
            safeMessage: 'path rejected',
            retryability: 'none',
            relatedIds: [],
            diagnosticRefs: [],
          },
        }
      }
      const abs = path.join(projectRoot, resolved.relativePath)
      fs.mkdirSync(path.dirname(abs), { recursive: true })
      fs.writeFileSync(abs, contents)
      const checksum = canonicalHash(contents)
      return successResult(
        {
          relativePath: resolved.relativePath,
          checksum,
          byteSize: Buffer.byteLength(contents),
          artifactId: `art-${checksum.slice(0, 12)}`,
        },
        { source: 'fake-filesystem', recordedAt: new Date().toISOString() },
      )
    },
  }
}

export function createFakeMatlabAdapter(): FakeMatlabAdapter {
  const sessions = new Map<string, MatlabSessionRecord>()
  const snapshots = new Map<string, { selected: Record<string, unknown>; projectId: string }>()
  return {
    sessions,
    snapshots,
    start(projectId) {
      const existing = sessions.get(projectId)
      if (existing && existing.state !== 'stopped') return existing
      const record: MatlabSessionRecord = {
        schemaVersion: '1.0',
        projectId,
        sessionId: `sess-${projectId}`,
        state: 'ready',
        matlabVersion: 'fake-R2023b',
        toolboxReadiness: [{ name: 'MATLAB', ready: true }],
        processOwnership: 'app-owned',
        startedAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      }
      sessions.set(projectId, record)
      return record
    },
    status(projectId) {
      return sessions.get(projectId)
    },
    saveSnapshot(projectId, selected) {
      const id = `snap-${projectId}-${snapshots.size + 1}`
      snapshots.set(id, { selected: { ...selected }, projectId })
      return id
    },
    restoreSnapshot(projectId, snapshotId) {
      const snap = snapshots.get(snapshotId)
      if (!snap || snap.projectId !== projectId) {
        return {
          schemaVersion: '1.0' as const,
          projectId,
          sessionId: `rejected-${projectId}`,
          state: 'stopped' as const,
          toolboxReadiness: [],
          processOwnership: 'app-owned' as const,
          startedAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
          lastDiagnosticId: 'CAP-MATLAB-SNAPSHOT-INVALID',
        }
      }
      const session = this.start(projectId)
      const restored: MatlabSessionRecord = {
        ...session,
        state: 'ready',
        inMemoryStateRevision: snapshotId,
        lastUsedAt: new Date().toISOString(),
      }
      sessions.set(projectId, restored)
      return restored
    },
  }
}

export function createFakeAzureAdapter(): FakeAzureAdapter {
  const items = new Map([
    [
      '42',
      {
        title: 'Inventory acceptance',
        revision: '3',
        fields: { 'System.Title': 'Inventory acceptance', 'System.State': 'Active' },
      },
    ],
  ])
  return {
    items,
    discover(opaqueSecretId) {
      if (!opaqueSecretId.startsWith('secret:')) throw new Error('credential value must not be passed')
      return { projects: ['proj'], workItemIds: [...items.keys()] }
    },
    importWorkItem(externalId) {
      const item = items.get(externalId)
      if (!item) throw new Error(`unknown work item ${externalId}`)
      const contentHash = canonicalHash(item)
      return {
        schemaVersion: '1.0',
        organization: 'org',
        project: 'proj',
        externalType: 'work-item',
        externalId,
        revision: item.revision,
        retrievedAt: new Date().toISOString(),
        contentHash,
        fieldMapping: { title: 'System.Title', state: 'System.State' },
        sourceAdapterVersion: 'fake-1.0.0',
      }
    },
  }
}

function productDraft(projectId: string, revision = '1'): ApplicationSpecification {
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

function domainManifest(): ModuleManifest {
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

function architectureDraft(product: ApplicationSpecification): ArchitectureSpecification {
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
    gateResult: { gateId: 'CAP-GATE-002', passed: false, diagnostics: [] },
    contentHash: 'pending',
  }
}

export function runCapJrn001(ws: CapabilityWorkspace, projectId: string): JourneyEvidence {
  ws.ensureInitialized(projectId)
  const packet = buildProductInterviewPacket({ packetId: 'pkt-product-1', projectId })
  const response = productDraft(projectId, '1')
  const imported = importProductInterviewResponse(response, { projectId, packet })
  ws.saveApplicationDraft(projectId, imported.draft)
  const gate = evaluateProductGate(imported.draft)
  if (!gate.passed) {
    return { journeyId: 'CAP-JRN-001', passed: false, evidence: { gate, diagnostics: imported.diagnostics } }
  }
  const approved = ws.approveApplication(projectId, imported.draft)
  return {
    journeyId: 'CAP-JRN-001',
    passed: approved.status === 'approved' && approved.revision === '1',
    evidence: {
      applicationId: approved.id,
      revision: approved.revision,
      contentHash: approved.contentHash,
      packetId: packet.packetId,
      uploadFileCount: imported.uploadFileCount,
    },
  }
}

export function runCapJrn002(ws: CapabilityWorkspace, projectId: string): JourneyEvidence {
  const product = ws.getApprovedApplication(projectId)
  if (!product) {
    return { journeyId: 'CAP-JRN-002', passed: false, evidence: { error: 'missing approved product' } }
  }
  const packet = buildArchitectureInterviewPacket({
    packetId: 'pkt-arch-1',
    projectId,
    application: product,
    availableAdapterIds: ['adapter.filesystem'],
  })
  const draft = architectureDraft(product)
  const manifest = domainManifest()
  const evaluation = evaluateArchitectureProposal(product, {
    architecture: draft,
    manifests: [manifest],
    moduleNeedTraces: [{ moduleId: manifest.moduleId, needIds: ['u1'] }],
    moduleJustifications: [{ moduleId: manifest.moduleId, justification: 'distinct-rules' }],
  })
  if (!evaluation.passed) {
    return { journeyId: 'CAP-JRN-002', passed: false, evidence: { evaluation, packetId: packet.packetId } }
  }
  draft.gateResult = { gateId: 'CAP-GATE-002', passed: true, diagnostics: [] }
  ws.saveArchitectureDraft(projectId, draft)
  const approved = ws.approveArchitecture(projectId, draft)
  return {
    journeyId: 'CAP-JRN-002',
    passed: approved.status === 'approved' && evaluateArchitectureGate(approved, [manifest]).passed,
    evidence: {
      architectureId: approved.id,
      revision: approved.revision,
      gatePassed: true,
      packetId: packet.packetId,
    },
  }
}

export function runCapJrn003(
  ws: CapabilityWorkspace,
  projectId: string,
  fsAdapter: FakeFilesystemAdapter,
): JourneyEvidence {
  const product = ws.getApprovedApplication(projectId)
  const arch = ws.getApprovedArchitecture(projectId)
  if (!product || !arch) {
    return { journeyId: 'CAP-JRN-003', passed: false, evidence: { error: 'missing product or architecture' } }
  }
  const manifest = domainManifest()
  const moduleGate = evaluateModuleGate(manifest, {
    acceptanceCases: product.acceptanceCases,
  })
  if (!moduleGate.passed) {
    return { journeyId: 'CAP-JRN-003', passed: false, evidence: { moduleGate } }
  }
  ws.saveModuleDraft(projectId, manifest)
  const approvedModule = ws.approveModule(projectId, manifest)
  const packet = buildImplementationPacket({
    packetId: 'pkt-impl-1',
    projectId,
    targetKind: 'module',
    targetId: manifest.moduleId,
    manifest,
    architectureVersion: arch.revision,
    architectureHash: arch.contentHash,
    inputHashes: { spec: product.contentHash, architecture: arch.contentHash },
    acceptanceCases: product.acceptanceCases,
    unchangedBehavior: ['other modules'],
  })
  const runs = new CapabilityRunStore(ws)
  const now = new Date().toISOString()
  const run = runs.createRun({
    schemaVersion: '1.0',
    runId: 'run-impl-1',
    projectId,
    kind: 'implementation',
    targetOwnerId: manifest.moduleId,
    lifecycleState: 'ready',
    inputRevisions: { architecture: arch.revision, module: manifest.moduleVersion },
    inputHashes: { spec: product.contentHash, architecture: arch.contentHash },
    allowedPaths: packet.allowedPaths,
    expectedPaths: packet.expectedPaths,
    protectedPaths: [],
    packetRefs: [packet.packetId],
    artifactRefs: [],
    transitionHistory: [],
    createdAt: now,
    updatedAt: now,
  })
  const write = fsAdapter.write(
    'capabilities/modules/mod.domain/module.yaml',
    'module: mod.domain\n',
    true,
  )
  const hashes = {
    specification: product.contentHash,
    implementation: canonicalHash('module: mod.domain\n'),
    architecture: arch.contentHash,
    dependencies: 'none',
    adapters: 'adapter.filesystem',
    bindings: 'none',
    verificationSuites: 'suite.domain',
  }
  const verification = buildVerificationRecord({
    verificationId: 'ver-1',
    projectId,
    moduleId: manifest.moduleId,
    moduleType: 'domain',
    manifest,
    inputHashes: hashes,
    commands: [{ label: 'suite.domain', exitCode: 0, passed: true }],
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  })
  runs.saveVerification(projectId, verification)
  const freshness = calculateFreshness({
    moduleId: manifest.moduleId,
    moduleVersion: approvedModule.moduleVersion,
    specificationHash: hashes.specification,
    implementationHash: hashes.implementation,
    architectureHash: hashes.architecture,
    dependencyHash: hashes.dependencies,
    adapterHash: hashes.adapters,
    bindingHash: hashes.bindings,
    verificationSuiteHash: hashes.verificationSuites,
    verification,
  })
  return {
    journeyId: 'CAP-JRN-003',
    passed:
      write.outcome === 'success' &&
      verification.outcome === 'passed' &&
      isEligibleForReady(verification, hashes) &&
      freshness.primaryState === 'ready',
    evidence: {
      moduleId: approvedModule.moduleId,
      packetId: packet.packetId,
      runId: run.runId,
      verificationId: verification.verificationId,
      freshness: freshness.primaryState,
      writeArtifact: (write.value as { artifactId?: string } | undefined)?.artifactId,
    },
  }
}

export function runCapJrn004(ws: CapabilityWorkspace, projectId: string): JourneyEvidence {
  const arch = ws.getApprovedArchitecture(projectId)
  const manifest = ws.getApprovedModule(projectId, 'mod.domain') ?? domainManifest()
  if (!arch) {
    return { journeyId: 'CAP-JRN-004', passed: false, evidence: { error: 'missing architecture' } }
  }
  const workflow: ModuleManifest = {
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
  ws.approveModule(projectId, workflow)
  const graph = buildCapabilityGraph(
    {
      ...arch,
      moduleIds: [manifest.moduleId, workflow.moduleId],
      dependencyEdges: [
        { fromModuleId: workflow.moduleId, toModuleId: manifest.moduleId, reason: 'uses' },
      ],
    },
    [manifest, workflow],
  )
  const impact = calculateImpact({
    changeId: 'chg-1',
    initiatingRecordId: manifest.moduleId,
    initiatingRevision: '2.0.0',
    classification: classifyImpact({
      contractChanged: true,
      additiveOnly: false,
      breaking: false,
      implementationOnly: false,
    }),
    graph,
    manifests: [manifest, workflow],
    changedModuleIds: [manifest.moduleId],
  })
  const next = nextActionableTarget(impact, new Set())
  const basePacket = buildImplementationPacket({
    packetId: 'pkt-delta-base',
    projectId,
    targetKind: 'module',
    targetId: manifest.moduleId,
    manifest,
    architectureVersion: arch.revision,
    architectureHash: arch.contentHash,
    inputHashes: { contract: '1.0.0' },
    acceptanceCases: [{ id: 'ac', description: 'delta', expectedOutcome: 'ok' }],
    unchangedBehavior: ['workflow scenarios'],
  })
  const delta = buildDeltaPacket(basePacket, {
    changeReason: 'contract bump',
    impactRecordId: impact.changeId,
    previousContractVersions: { 'op.count.approve': '1.0.0' },
    targetContractVersions: { 'op.count.approve': '2.0.0' },
    preserveBehavior: ['non-negative counts'],
    addBehavior: [],
    changeBehavior: ['approve signature'],
    newTests: ['suite.domain-v2'],
    unchangedModuleIds: impact.unaffectedModules.map((m) => m.moduleId),
  })
  return {
    journeyId: 'CAP-JRN-004',
    passed:
      impact.classification === 'required-additive' &&
      next === manifest.moduleId &&
      delta.impactRecordId === 'chg-1' &&
      impact.proposedPacketOrder[0] === manifest.moduleId,
    evidence: {
      impactClassification: impact.classification,
      proposedPacketOrder: impact.proposedPacketOrder,
      nextActionable: next,
      deltaPacketId: delta.packetId,
    },
  }
}

export function runCapJrn005(fsAdapter: FakeFilesystemAdapter): JourneyEvidence {
  const write = fsAdapter.write('artifacts/counts-result.json', '{"sku":1,"qty":3,"ok":true}', true)
  const read = fsAdapter.read('artifacts/counts-result.json', true)
  const escape = resolveProjectRelativePath(FS_POLICY, '../etc/passwd', ['input-data'])
  const serialized = JSON.stringify({ write, read })
  const hostAbsoluteAbsent = !serialized.includes(path.resolve(fsAdapter.root))
  return {
    journeyId: 'CAP-JRN-005',
    passed:
      write.outcome === 'success' &&
      read.outcome === 'success' &&
      !escape.ok &&
      hostAbsoluteAbsent &&
      Boolean((write.value as { artifactId?: string } | undefined)?.artifactId),
    evidence: {
      writeOutcome: write.outcome,
      readOutcome: read.outcome,
      relativePath: (read.value as { relativePath?: string } | undefined)?.relativePath,
      artifactId: (write.value as { artifactId?: string } | undefined)?.artifactId,
      escapeBlocked: !escape.ok,
      hostAbsoluteAbsent,
    },
  }
}

export function runCapJrn006(matlab: FakeMatlabAdapter, projectId: string): JourneyEvidence {
  const first = matlab.start(projectId)
  const reused = matlab.start(projectId)
  const snapId = matlab.saveSnapshot(projectId, { count: 3, ignored: 'x' })
  // Only selected variables are restored — caller passes the selected map.
  const restored = matlab.restoreSnapshot(projectId, snapId)
  const cross = matlab.restoreSnapshot('other-project', snapId)
  return {
    journeyId: 'CAP-JRN-006',
    passed:
      first.sessionId === reused.sessionId &&
      restored.state === 'ready' &&
      restored.inMemoryStateRevision === snapId &&
      cross.state === 'stopped',
    evidence: {
      sessionId: first.sessionId,
      reused: first.sessionId === reused.sessionId,
      snapshotId: snapId,
      restoredState: restored.state,
      crossProjectRejected: cross.state === 'stopped',
    },
  }
}

export function runCapJrn007(ws: CapabilityWorkspace, projectId: string): JourneyEvidence {
  const binding: FrontendBinding = {
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
  const selectionOk = selectionAllowsProgress(binding.selectionEvidence).length === 0
  const approvedGate = approveFrontendBinding(binding)
  if (!approvedGate.ok) {
    return { journeyId: 'CAP-JRN-007', passed: false, evidence: { diagnostics: approvedGate.diagnostics } }
  }
  ws.saveBindingDraft(projectId, binding)
  const approved = ws.approveBinding(projectId, binding)
  const connected = executeBindingMode({
    binding,
    mode: 'connected',
    explicit: true,
    invokeConnected: () =>
      successResult(
        { approved: true },
        { source: 'fake-runtime', recordedAt: new Date().toISOString() },
      ),
  })
  const example = executeBindingMode({
    binding: { ...binding, dataMode: 'approved-example' },
    mode: 'approved-example',
    explicit: true,
    example: {
      id: 'ex-1',
      version: '1.0.0',
      operationContractVersion: '1.0.0',
      input: { qty: 1 },
      expectedResult: { approved: true },
      source: 'fixture',
    },
  })
  return {
    journeyId: 'CAP-JRN-007',
    passed:
      selectionOk &&
      approved.bindingId === 'bind-approve' &&
      connected.envelope.outcome === 'success' &&
      example.envelope.outcome === 'success' &&
      example.envelope.provenance.source.includes('simulation'),
    evidence: {
      bindingId: approved.bindingId,
      version: approved.version,
      connectedOutcome: connected.envelope.outcome,
      exampleOutcome: example.envelope.outcome,
      selectionOk,
    },
  }
}

export function runCapJrn008(
  ws: CapabilityWorkspace,
  projectId: string,
  azure: FakeAzureAdapter,
): JourneyEvidence {
  const discovered = azure.discover('secret:opaque-ref-1')
  const provenance = azure.importWorkItem(discovered.workItemIds[0]!)
  const product = ws.getApprovedApplication(projectId)
  const linkedDraft: ApplicationSpecification = {
    ...(product ?? productDraft(projectId, '2')),
    revision: '2',
    status: 'draft',
    sources: [
      ...(product?.sources ?? []),
      {
        id: `ado:${provenance.externalId}@${provenance.revision}`,
        text: `Azure DevOps ${provenance.externalType} ${provenance.externalId}`,
      },
    ],
    contentHash: 'pending',
  }
  // N+1 refresh creates proposed impact — does not mutate approved revision 1.
  const approvedBefore = ws.getApprovedApplication(projectId)
  ws.saveApplicationDraft(projectId, linkedDraft)
  const approvedAfter = ws.getApprovedApplication(projectId)
  const verification: VerificationRecord = {
    schemaVersion: '1.0',
    verificationId: 'ver-ado-1',
    projectId,
    moduleId: 'mod.domain',
    suiteIds: ['suite.domain'],
    suiteVersions: ['1.0'],
    suiteHashes: ['suite.domain'],
    inputHashes: { azure: provenance.contentHash },
    commandResults: [{ label: 'ado-link', exitCode: 0, passed: true }],
    artifacts: [],
    diagnostics: [],
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    outcome: 'passed',
  }
  const runs = new CapabilityRunStore(ws)
  runs.saveVerification(projectId, verification)
  return {
    journeyId: 'CAP-JRN-008',
    passed:
      provenance.externalId === '42' &&
      provenance.revision === '3' &&
      approvedBefore?.revision === approvedAfter?.revision &&
      linkedDraft.revision === '2' &&
      verification.inputHashes.azure === provenance.contentHash,
    evidence: {
      externalId: provenance.externalId,
      revision: provenance.revision,
      contentHash: provenance.contentHash,
      approvedUnchanged: approvedBefore?.revision === approvedAfter?.revision,
      draftRevision: linkedDraft.revision,
      verificationId: verification.verificationId,
    },
  }
}

export type OfflineJourneyContext = {
  workspace: CapabilityWorkspace
  projectId: string
  projectRoot: string
  filesystem: FakeFilesystemAdapter
  matlab: FakeMatlabAdapter
  azure: FakeAzureAdapter
}

export function createOfflineJourneyContext(prefix = 'euik-cap-jrn-'): OfflineJourneyContext {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}repo-`))
  const projectId = 'proj-journey'
  const workspace = new CapabilityWorkspace(dataDir)
  workspace.ensureInitialized(projectId)
  return {
    workspace,
    projectId,
    projectRoot,
    filesystem: createFakeFilesystemAdapter(projectRoot),
    matlab: createFakeMatlabAdapter(),
    azure: createFakeAzureAdapter(),
  }
}

/** Execute CAP-JRN-001 through CAP-JRN-008 offline, including workspace restart. */
export function runAllOfflineJourneys(ctx = createOfflineJourneyContext()): {
  results: JourneyEvidence[]
  restartOk: boolean
  deferredAbsent: boolean
} {
  const { workspace, projectId, filesystem, matlab, azure } = ctx
  const results: JourneyEvidence[] = [
    runCapJrn001(workspace, projectId),
    runCapJrn002(workspace, projectId),
    runCapJrn003(workspace, projectId, filesystem),
    runCapJrn004(workspace, projectId),
    runCapJrn005(filesystem),
    runCapJrn006(matlab, projectId),
    runCapJrn007(workspace, projectId),
    runCapJrn008(workspace, projectId, azure),
  ]

  // Restart: reopen workspace from the same dataDir and confirm approved records survive.
  const reopened = new CapabilityWorkspace(workspace.dataDir)
  const restartOk =
    reopened.getApprovedApplication(projectId)?.revision === '1' &&
    reopened.getApprovedArchitecture(projectId)?.revision === '1' &&
    reopened.getApprovedModule(projectId, 'mod.domain')?.moduleId === 'mod.domain' &&
    reopened.getApprovedBinding(projectId, 'bind-approve')?.bindingId === 'bind-approve'

  // Deferred features must be absent from this offline path (no pipeline invoke, no remote discovery API).
  const deferredAbsent =
    !('invokePipeline' in azure) &&
    !('remoteDiscover' in filesystem) &&
    !('evalArbitrary' in matlab) &&
    typeof azure.discover === 'function' &&
    typeof azure.importWorkItem === 'function'

  return { results, restartOk, deferredAbsent }
}
