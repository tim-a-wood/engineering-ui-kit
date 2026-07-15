/**
 * CAP-TEST-070 — real Connect-stage persistence for `DeployableSpecification`
 * (CAP-CONTRACT-024) and `InboundBinding` (CAP-CONTRACT-028) on
 * `CapabilityWorkspace` (WP5B connect backing, replacing WP6B's mock-only
 * gui bridge).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CapabilityWorkspace } from '../../src/capabilities/persistence.js'
import type { DeployableSpecification, HttpInboundBinding } from '../../src/capabilities/types.js'

function tmpWorkspace(): CapabilityWorkspace {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-cap-070-'))
  return new CapabilityWorkspace(dir)
}

function deployable(overrides: Partial<DeployableSpecification> = {}): DeployableSpecification {
  return {
    schemaVersion: '1.0',
    deployableId: 'http-api',
    name: 'Http Api',
    kind: 'http-api',
    runtimeLanguage: 'typescript',
    runtimeVersionRange: '>=22',
    moduleIds: ['mod.example'],
    inboundBindingIds: [],
    compositionRootPath: 'src/composition/http-api.ts',
    commands: {},
    configurationRefs: [],
    secretReferenceIds: [],
    proposedLocations: [],
    ...overrides,
  }
}

function httpBinding(overrides: Partial<HttpInboundBinding> = {}): HttpInboundBinding {
  return {
    schemaVersion: '1.0',
    kind: 'http',
    bindingId: 'bind-http-1',
    version: '1.0.0',
    projectId: 'proj-1',
    deployableId: 'http-api',
    operationId: 'op.create-widget',
    operationVersion: '1.0.0',
    inputMappings: [],
    outputMappings: [],
    validationBehavior: 'inline',
    domainRejectionBehavior: '409',
    technicalFailureBehavior: '500',
    timeoutBehavior: '504',
    cancellationBehavior: 'abort',
    retryBehavior: 'none',
    duplicateSubmissionBehavior: 'idempotency-key',
    exposure: 'private',
    generatedTargets: [],
    approvalState: 'draft',
    method: 'POST',
    path: '/widgets',
    ...overrides,
  } as HttpInboundBinding
}

function setSchemaVersion(ws: CapabilityWorkspace, projectId: string, version: string): void {
  fs.writeFileSync(
    path.join(ws.root(projectId), 'meta', 'schema-version.json'),
    JSON.stringify({ schemaVersion: version, initializedAt: new Date().toISOString() }),
  )
}

describe('CAP-TEST-070 connect-stage backing persistence', () => {
  it('round-trips a DeployableSpecification: save -> list -> approve -> get', () => {
    const ws = tmpWorkspace()
    const draft = deployable()
    ws.saveDeployableDraft('proj-1', draft)

    const listedAfterDraft = ws.listDeployables('proj-1')
    expect(listedAfterDraft).toHaveLength(1)
    expect(listedAfterDraft[0]!.deployableId).toBe('http-api')
    expect(listedAfterDraft[0]!.draft).toEqual(draft)
    expect(listedAfterDraft[0]!.approved).toBeUndefined()

    const approved = ws.approveDeployable('proj-1', draft)
    expect(approved).toEqual(draft)
    expect(ws.getApprovedDeployable('proj-1', 'http-api')).toEqual(draft)

    const listedAfterApproval = ws.listDeployables('proj-1')
    expect(listedAfterApproval[0]!.approved).toEqual(draft)
  })

  it('round-trips an InboundBinding: save -> approve -> list', () => {
    const ws = tmpWorkspace()
    const draft = httpBinding()
    ws.saveInboundBindingDraft('proj-1', draft)
    expect(ws.getInboundBindingDraft('proj-1', draft.bindingId)).toEqual(draft)

    const approved = ws.approveInboundBinding('proj-1', draft)
    expect(approved.bindingId).toBe(draft.bindingId)
    expect(ws.getApprovedInboundBinding('proj-1', draft.bindingId)).toEqual(approved)

    const listed = ws.listInboundBindings('proj-1')
    expect(listed).toHaveLength(1)
    expect(listed[0]!.bindingId).toBe(draft.bindingId)
    expect(listed[0]!.approved).toEqual(approved)
  })

  it('defaults an omitted exposure to private on save', () => {
    const ws = tmpWorkspace()
    const { exposure: _omit, ...withoutExposure } = httpBinding()
    // Deliberately construct a draft missing `exposure` the way an untyped IPC payload might.
    ws.saveInboundBindingDraft('proj-1', withoutExposure as HttpInboundBinding)
    const draft = ws.getInboundBindingDraft('proj-1', withoutExposure.bindingId)
    expect(draft?.exposure).toBe('private')

    const approved = ws.approveInboundBinding('proj-1', withoutExposure as HttpInboundBinding)
    expect(approved.exposure).toBe('private')
    expect(ws.getApprovedInboundBinding('proj-1', withoutExposure.bindingId)?.exposure).toBe('private')
  })

  it('persists and lists multiple inbound bindings on the same operation (never deduplicated)', () => {
    const ws = tmpWorkspace()
    const first = httpBinding({ bindingId: 'bind-http-1', method: 'POST', path: '/widgets' })
    const second = httpBinding({ bindingId: 'bind-http-2', method: 'GET', path: '/widgets/:id' })
    expect(second.operationId).toBe(first.operationId)
    expect(second.operationVersion).toBe(first.operationVersion)

    ws.approveInboundBinding('proj-1', first)
    ws.approveInboundBinding('proj-1', second)

    const listed = ws.listInboundBindings('proj-1')
    expect(listed.map((r) => r.bindingId).sort()).toEqual(['bind-http-1', 'bind-http-2'])
    expect(listed.every((r) => r.approved?.operationId === first.operationId)).toBe(true)
  })

  it('throws on deployable and inbound-binding writes when the workspace schema version is from the future', () => {
    const ws = tmpWorkspace()
    ws.ensureInitialized('proj-1')
    setSchemaVersion(ws, 'proj-1', '3.0')
    expect(ws.isFutureSchemaVersion('proj-1')).toBe(true)

    expect(() => ws.saveDeployableDraft('proj-1', deployable())).toThrow(/read-only/)
    expect(() => ws.approveDeployable('proj-1', deployable())).toThrow(/read-only/)
    expect(() => ws.saveInboundBindingDraft('proj-1', httpBinding())).toThrow(/read-only/)
    expect(() => ws.approveInboundBinding('proj-1', httpBinding())).toThrow(/read-only/)
  })
})
