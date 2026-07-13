import { describe, expect, it } from 'vitest'
import { resolveProjectRelativePath } from '../../src/capabilities/filesystem.js'
import { calculateImpact, classifyImpact, nextActionableTarget } from '../../src/capabilities/impact.js'
import { buildImplementationPacket } from '../../src/capabilities/packets.js'
import type { ModuleManifest } from '../../src/capabilities/types.js'

const policy = {
  roots: {
    source: 'capabilities/modules',
    'generated-output': 'capabilities/generated',
    configuration: 'capabilities/config',
    'input-data': 'data',
    artifacts: 'artifacts',
  },
} as const

describe('CAP-TEST-025 filesystem policy (core)', () => {
  it('accepts project-relative paths and rejects traversal/absolute escapes', () => {
    expect(resolveProjectRelativePath(policy, 'data/input.csv', ['input-data']).ok).toBe(true)
    expect(resolveProjectRelativePath(policy, '/etc/passwd', ['input-data']).ok).toBe(false)
    expect(resolveProjectRelativePath(policy, '../secret', ['input-data']).ok).toBe(false)
    expect(resolveProjectRelativePath(policy, 'capabilities/modules/a/x.ts', ['source']).ok).toBe(true)
  })
})

describe('CAP-TEST-018/019 impact ordering', () => {
  it('orders provider before workflow/experience and exposes one next action', () => {
    const manifests: ModuleManifest[] = [
      {
        schemaVersion: '1.0',
        architectureVersion: '1.0',
        moduleId: 'mod.domain',
        moduleVersion: '1',
        moduleType: 'domain',
        name: 'd',
        responsibility: 'd',
        ownedConcerns: ['d'],
        excludedConcerns: ['u'],
        providedOperations: [{ operationId: 'op.1', contractVersion: '1' }],
        requiredOperations: [],
        verificationSuiteIds: ['s'],
        runtimeAllocation: 'local-embedded',
        events: [],
        ownedPaths: ['capabilities/modules/mod.domain/'],
      },
      {
        schemaVersion: '1.0',
        architectureVersion: '1.0',
        moduleId: 'mod.workflow',
        moduleVersion: '1',
        moduleType: 'workflow',
        name: 'w',
        responsibility: 'w',
        ownedConcerns: ['w'],
        excludedConcerns: ['u'],
        providedOperations: [],
        requiredOperations: [{ operationId: 'op.1', acceptedContractRange: '^1', reason: 'need' }],
        verificationSuiteIds: ['s'],
        runtimeAllocation: 'local-embedded',
        events: [],
        ownedPaths: ['capabilities/modules/mod.workflow/'],
      },
      {
        schemaVersion: '1.0',
        architectureVersion: '1.0',
        moduleId: 'mod.ui',
        moduleVersion: '1',
        moduleType: 'experience',
        name: 'e',
        responsibility: 'e',
        ownedConcerns: ['e'],
        excludedConcerns: ['d'],
        providedOperations: [],
        requiredOperations: [],
        verificationSuiteIds: ['s'],
        runtimeAllocation: 'local-embedded',
        events: [],
        ownedPaths: ['capabilities/modules/mod.ui/'],
      },
    ]
    const impact = calculateImpact({
      changeId: 'c1',
      initiatingRecordId: 'mod.domain',
      initiatingRevision: '2',
      classification: classifyImpact({
        contractChanged: true,
        additiveOnly: false,
        breaking: false,
        implementationOnly: false,
      }),
      graph: {
        nodes: manifests.map((m) => ({ id: m.moduleId, moduleType: m.moduleType })),
        edges: [
          { from: 'mod.workflow', to: 'mod.domain', reason: 'uses' },
          { from: 'mod.ui', to: 'mod.workflow', reason: 'calls' },
        ],
      },
      manifests,
      changedModuleIds: ['mod.domain'],
    })
    expect(impact.classification).toBe('required-additive')
    expect(impact.proposedPacketOrder[0]).toBe('mod.domain')
    expect(impact.proposedPacketOrder.indexOf('mod.workflow')).toBeLessThan(
      impact.proposedPacketOrder.indexOf('mod.ui'),
    )
    expect(nextActionableTarget(impact, new Set())).toBe('mod.domain')
    expect(nextActionableTarget(impact, new Set(['mod.domain']))).toBe('mod.workflow')
  })
})

describe('CAP-TEST-014 implementation packet', () => {
  it('names one target and required ui-overlay.zip output', () => {
    const packet = buildImplementationPacket({
      packetId: 'p1',
      projectId: 'proj',
      targetKind: 'module',
      targetId: 'mod.domain',
      manifest: {
        schemaVersion: '1.0',
        architectureVersion: '1.0',
        moduleId: 'mod.domain',
        moduleVersion: '1.0.0',
        moduleType: 'domain',
        name: 'Domain',
        responsibility: 'rules',
        ownedConcerns: ['rules'],
        excludedConcerns: ['ui'],
        providedOperations: [{ operationId: 'op.1', contractVersion: '1.0.0' }],
        requiredOperations: [],
        verificationSuiteIds: ['suite.domain'],
        runtimeAllocation: 'local-embedded',
        events: [],
        ownedPaths: ['capabilities/modules/mod.domain/'],
      },
      architectureVersion: '1.0',
      architectureHash: 'h',
      inputHashes: { spec: 'a' },
      acceptanceCases: [{ id: 'ac', description: 'd', expectedOutcome: 'ok' }],
      unchangedBehavior: ['other modules'],
    })
    expect(packet.targetId).toBe('mod.domain')
    expect(packet.requiredOutput).toBe('ui-overlay.zip')
    expect(packet.allowedPaths).toEqual(['capabilities/modules/mod.domain/'])
  })
})
