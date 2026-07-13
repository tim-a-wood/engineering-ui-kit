/**
 * CAP-TEST-022 (GUI) — delta queue advancement through the named bridge.
 * Exercises: approve impact → export only next target → block later targets →
 * verify → mark complete → advance → finish when exhausted.
 */

import { describe, expect, it } from 'vitest'
import type { ImpactRecord, ModuleManifest } from '@engineering-ui-kit/core'
import { installMockBridge } from '../src/mockBridge'

function manifest(moduleId: string): ModuleManifest {
  return {
    schemaVersion: '1.0',
    architectureVersion: '1.0',
    moduleId,
    moduleVersion: '1.0.0',
    moduleType: 'domain',
    name: moduleId,
    responsibility: moduleId,
    ownedConcerns: [],
    excludedConcerns: [],
    providedOperations: [],
    requiredOperations: [],
    verificationSuiteIds: [],
    runtimeAllocation: 'local-embedded',
    events: [],
    ownedPaths: [`capabilities/modules/${moduleId}/`],
  }
}

const order = ['mod.a', 'mod.b']

async function seed(bridge: ReturnType<typeof installMockBridge>) {
  await bridge.capabilitiesEnsureInitialized('p1')
  for (const id of order) await bridge.capabilitiesApproveModule('p1', manifest(id))
  const impact: ImpactRecord = {
    schemaVersion: '1.0',
    changeId: 'impact-1',
    initiatingRecordId: 'mod.a',
    initiatingRevision: '1.0.0',
    classification: 'required-additive',
    affectedModules: order.map((moduleId) => ({ moduleId, reason: 'initiating-change' })),
    unaffectedModules: [],
    proposedPacketOrder: order,
    recalculationEvidence: [],
  }
  return bridge.capabilitiesApproveImpact('p1', impact)
}

async function verify(bridge: ReturnType<typeof installMockBridge>, moduleId: string) {
  const result = await bridge.capabilitiesVerifyApprovedModule({ projectId: 'p1', moduleId, explicit: true })
  return result.record.verificationId
}

describe('CAP-TEST-022 delta lifecycle', () => {
  it('exports only the next target and blocks later targets', async () => {
    const bridge = installMockBridge()
    await seed(bridge)

    const queue = await bridge.capabilitiesDeltaQueueState({ projectId: 'p1', changeId: 'impact-1' })
    expect(queue.nextTarget).toBe('mod.a')

    const packet = await bridge.capabilitiesExportDeltaPacket({ projectId: 'p1', changeId: 'impact-1', targetId: 'mod.a' })
    expect(packet.uploadFiles.length).toBe(3)

    await expect(
      bridge.capabilitiesExportDeltaPacket({ projectId: 'p1', changeId: 'impact-1', targetId: 'mod.b' }),
    ).rejects.toThrow(/blocked/)
  })

  it('requires a passing verification before completing a target', async () => {
    const bridge = installMockBridge()
    await seed(bridge)
    await expect(
      bridge.capabilitiesMarkDeltaTargetComplete({
        projectId: 'p1', changeId: 'impact-1', targetId: 'mod.a', verificationId: 'ver-missing', explicit: true,
      }),
    ).rejects.toThrow(/verification not found/)

    await expect(
      bridge.capabilitiesMarkDeltaTargetComplete({
        projectId: 'p1', changeId: 'impact-1', targetId: 'mod.a', verificationId: 'ver-x', explicit: false,
      }),
    ).rejects.toThrow(/explicit/)
  })

  it('advances through the queue and finishes when exhausted', async () => {
    const bridge = installMockBridge()
    await seed(bridge)

    const vA = await verify(bridge, 'mod.a')
    let queue = await bridge.capabilitiesMarkDeltaTargetComplete({
      projectId: 'p1', changeId: 'impact-1', targetId: 'mod.a', verificationId: vA, explicit: true,
    })
    expect(queue.completedTargets).toEqual(['mod.a'])
    expect(queue.nextTarget).toBe('mod.b')

    // Now mod.b is exportable; mod.a is no longer.
    await expect(
      bridge.capabilitiesExportDeltaPacket({ projectId: 'p1', changeId: 'impact-1', targetId: 'mod.a' }),
    ).rejects.toThrow(/blocked|exhausted/)
    await bridge.capabilitiesExportDeltaPacket({ projectId: 'p1', changeId: 'impact-1', targetId: 'mod.b' })

    const vB = await verify(bridge, 'mod.b')
    queue = await bridge.capabilitiesMarkDeltaTargetComplete({
      projectId: 'p1', changeId: 'impact-1', targetId: 'mod.b', verificationId: vB, explicit: true,
    })
    expect(queue.done).toBe(true)
    expect(queue.nextTarget).toBeUndefined()
  })
})
