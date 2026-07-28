// @vitest-environment jsdom
/**
 * §11 implementation-handoff workflow, §12 Build, §3.5 gate mode tests: one-module handoff
 * by default, the Build gate blocking implementation handoffs verbatim in
 * `completeBaseline` mode while the baseline is unapproved, multi-module
 * handoff acceptance/rejection (§3.3), and the full returned-delta review
 * round trip (inspect → approve → apply (simulated) → rollback), including
 * out-of-scope attempts.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { buildSampleAuditHub, type DesignBaseline, type ModuleDesignSpecification, type ReturnedDelta } from '@engineering-ui-kit/core/design-browser'
import { DesignStore } from '../src/views/design/designState'

const NOW = () => '2026-07-25T00:00:00.000Z'

beforeEach(() => {
  window.localStorage.clear()
})

function baseSnapshot() {
  const sample = buildSampleAuditHub()
  return {
    projectId: sample.projectId,
    syntheticDataStatement: sample.syntheticDataStatement,
    architecture: sample.architecture,
    approvedModuleDesigns: sample.approvedModuleDesigns,
    moduleDesigns: sample.moduleDesigns,
    sessions: sample.sessions,
    approvedContracts: sample.operationContracts.contracts.filter((c) => c.status === 'approved').map((c) => c.contract),
    useCaseAnalysis: sample.useCaseAnalysis,
    contractRegistry: sample.operationContracts,
    designBaseline: sample.designBaseline,
    policy: sample.policy,
    incrementalPreview: sample.incrementalPreview,
    wavePlan: sample.wavePlan,
    copilotHandoffTargets: sample.copilotHandoffTargets,
    scenarioTestPlan: sample.scenarioTestPlan,
    scenarioRuns: sample.scenarioRuns,
    verificationResults: sample.verificationResults,
    defects: sample.defects,
  }
}

describe('One-module implementation handoff (§11.2, §11.3, §6.2)', () => {
  it('creates an implementation packet for exactly one module by default when the Build gate passes', () => {
    const store = new DesignStore({ now: NOW, snapshot: baseSnapshot() })
    const result = store.createModuleHandoff('mod.evidence-store')
    expect(result.ok).toBe(true)
    expect(result.kind).toBe('implementation')
    expect(result.packet).toBeTruthy()
    expect((result.packet as { moduleId: string }).moduleId).toBe('mod.evidence-store')
  })

  it('blocks the handoff in completeBaseline mode while the Design baseline is unapproved, with the verbatim blocking reason', () => {
    const snapshot = baseSnapshot()
    const unapprovedBaseline: DesignBaseline = { ...snapshot.designBaseline, status: 'draft' }
    const store = new DesignStore({ now: NOW, snapshot: { ...snapshot, designBaseline: unapprovedBaseline } })

    expect(store.getState().policy.mode).toBe('completeBaseline')
    const result = store.createModuleHandoff('mod.evidence-store')
    expect(result.ok).toBe(false)
    expect(result.diagnostics[0]?.message).toBe('implementation handoffs remain blocked until the complete Design baseline is approved')
  })
})

const fullMultiModuleConfirmations = {
  userConfirmedIndependence: true,
  receivingAgentSupportsCombinedTask: true,
  fixtureIsolationConfirmedByModuleId: { 'mod.adapter.filesystem': true, 'mod.adapter.git': true },
}

describe('Multi-module handoff (§3.3)', () => {
  it('is allowed for two independent, non-overlapping adapters', () => {
    const store = new DesignStore({ now: NOW, snapshot: baseSnapshot() })
    const result = store.createMultiModuleHandoff(['mod.adapter.filesystem', 'mod.adapter.git'], fullMultiModuleConfirmations)
    expect(result.ok).toBe(true)
    expect(result.packets?.length).toBe(2)
  })

  it('is rejected without a real independence confirmation, with no packet created (review finding #2)', () => {
    const store = new DesignStore({ now: NOW, snapshot: baseSnapshot() })
    const result = store.createMultiModuleHandoff(['mod.adapter.filesystem', 'mod.adapter.git'], {
      ...fullMultiModuleConfirmations,
      userConfirmedIndependence: false,
    })
    expect(result.ok).toBe(false)
    expect(result.packets).toBeUndefined()
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-PKT-MULTI-NO-USER-CONFIRMATION')).toBe(true)
  })

  it('is rejected when a module has no confirmed fixture isolation, with no packet created (review finding #2)', () => {
    const store = new DesignStore({ now: NOW, snapshot: baseSnapshot() })
    const result = store.createMultiModuleHandoff(['mod.adapter.filesystem', 'mod.adapter.git'], {
      ...fullMultiModuleConfirmations,
      fixtureIsolationConfirmedByModuleId: { 'mod.adapter.filesystem': true, 'mod.adapter.git': false },
    })
    expect(result.ok).toBe(false)
    expect(result.packets).toBeUndefined()
    expect(result.diagnostics.some((d) => d.code === 'CAP-DES-PKT-MULTI-NO-FIXTURE-CONFIRMATION')).toBe(true)
  })

  it('is rejected when the selected modules have an owned-path overlap', () => {
    const snapshot = baseSnapshot()
    const overlappingGit: ModuleDesignSpecification = {
      ...snapshot.moduleDesigns.find((d) => d.module.moduleId === 'mod.adapter.git')!,
      boundary: {
        ...snapshot.moduleDesigns.find((d) => d.module.moduleId === 'mod.adapter.git')!.boundary,
        ownedPaths: snapshot.moduleDesigns.find((d) => d.module.moduleId === 'mod.adapter.filesystem')!.boundary.ownedPaths,
      },
    }
    const moduleDesigns = snapshot.moduleDesigns.map((d) => (d.module.moduleId === 'mod.adapter.git' ? overlappingGit : d))
    const approvedModuleDesigns = { ...snapshot.approvedModuleDesigns, [overlappingGit.module.moduleId]: overlappingGit }
    const store = new DesignStore({ now: NOW, snapshot: { ...snapshot, moduleDesigns, approvedModuleDesigns } })

    const result = store.createMultiModuleHandoff(['mod.adapter.filesystem', 'mod.adapter.git'], fullMultiModuleConfirmations)
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some((d) => d.message.includes('overlaps'))).toBe(true)
  })
})

describe('Returned-delta review flow (§11.5, §11.6, §12.2, §19)', () => {
  function deltaFor(
    packet: { packetId: string; moduleDesignRevision: string; moduleDesignHash: string },
    path: string,
    deltaId: string,
  ): ReturnedDelta {
    return {
      schemaVersion: '1.0',
      deltaId,
      packetId: packet.packetId,
      baseRevision: packet.moduleDesignRevision,
      baseHash: packet.moduleDesignHash,
      fileChanges: [{ path, action: 'create', content: 'implementation notes' }],
      recordChanges: [],
      testResults: [{ command: 'pnpm test', passed: true, summary: 'All tests passed.' }],
      assumptions: [],
      unresolvedIssues: [],
      requestedScopeChanges: [],
      evidenceFiles: [],
      returnedAt: NOW(),
      contentHash: 'test-content-hash',
    }
  }

  it('inspection shows out-of-scope attempts for a path outside the allowed set', () => {
    const store = new DesignStore({ now: NOW, snapshot: baseSnapshot() })
    const handoff = store.createModuleHandoff('mod.evidence-store')
    const packet = handoff.packet as { packetId: string; moduleDesignRevision: string; moduleDesignHash: string }

    const delta = deltaFor(packet, 'apps/desktop/src/forbidden-out-of-scope.ts', 'delta.out-of-scope')
    store.importReturnedDeltaText('mod.evidence-store', JSON.stringify(delta))
    const inspection = store.inspectReturnedDelta('mod.evidence-store')

    expect(inspection).toBeTruthy()
    expect(inspection!.accepted).toBe(false)
    expect(inspection!.outOfScopeAttempts).toContain('apps/desktop/src/forbidden-out-of-scope.ts')
    expect(inspection!.rejectionReasons).toContain('path-outside-allowed')
  })

  it('round-trips approve, apply (simulated in browser), and rollback', () => {
    const store = new DesignStore({ now: NOW, snapshot: baseSnapshot() })
    const handoff = store.createModuleHandoff('mod.evidence-store')
    const packet = handoff.packet as { packetId: string; moduleDesignRevision: string; moduleDesignHash: string; allowedPaths: string[] }
    const path = `${packet.allowedPaths[0]}notes.md`

    const delta = deltaFor(packet, path, 'delta.round-trip')
    store.importReturnedDeltaText('mod.evidence-store', JSON.stringify(delta))

    const inspection = store.inspectReturnedDelta('mod.evidence-store')
    expect(inspection?.accepted).toBe(true)

    const approval = store.approveReturnedDelta('mod.evidence-store', 'tester.reviewer')
    expect(approval.ok).toBe(true)

    const applyResult = store.applyReturnedDelta('mod.evidence-store')
    expect(applyResult?.applied).toBe(true)
    expect(applyResult?.appliedFiles).toContain(path)
    expect(store.getDeltaFlow('mod.evidence-store').files[path]).toBe('implementation notes')

    store.rollbackReturnedDelta('mod.evidence-store')
    const flow = store.getDeltaFlow('mod.evidence-store')
    expect(flow.rolledBack).toBe(true)
    expect(flow.files[path]).toBeUndefined()
  })
})
