import { describe, expect, it } from 'vitest'
import {
  assertWorkLifecycleTransition,
  capabilityRunEvidenceState,
  deriveProjectWorkOverview,
  handoffRunEvidenceState,
  normalizeWorkLifecycleState,
  type CapabilityRunScope,
  type HandoffRun,
  type ModuleManifest,
} from '../src/index.js'

const now = '2026-07-23T12:00:00.000Z'

function manifest(moduleId: string): ModuleManifest {
  return {
    schemaVersion: '1.0',
    architectureVersion: '1.0',
    moduleId,
    moduleVersion: '1.0.0',
    moduleType: 'domain',
    name: moduleId,
    responsibility: `Own ${moduleId}`,
    ownedConcerns: [],
    excludedConcerns: [],
    providedOperations: [],
    requiredOperations: [],
    verificationSuiteIds: [],
    runtimeAllocation: 'local-embedded',
    events: [],
    ownedPaths: [`src/${moduleId}`],
  }
}

function capabilityRun(
  moduleId: string,
  lifecycleState: CapabilityRunScope['lifecycleState'],
  patch: Partial<CapabilityRunScope> = {},
): CapabilityRunScope {
  return {
    schemaVersion: '1.0',
    runId: `run-${moduleId}`,
    kind: 'implementation',
    projectId: 'project-1',
    targetOwnerId: moduleId,
    lifecycleState,
    inputRevisions: { module: '1.0.0' },
    inputHashes: { module: 'hash' },
    allowedPaths: [`src/${moduleId}`],
    expectedPaths: [],
    protectedPaths: [],
    packetRefs: [],
    artifactRefs: [],
    transitionHistory: [],
    createdAt: now,
    updatedAt: now,
    ...patch,
  }
}

function handoff(patch: Partial<HandoffRun> = {}): HandoffRun {
  return {
    id: 'ui-run',
    projectId: 'project-1',
    currentStep: 'prepare-context',
    createdAt: now,
    updatedAt: now,
    ...patch,
  }
}

describe('canonical work lifecycle', () => {
  it('normalizes every persisted legacy state without overstating evidence', () => {
    expect(normalizeWorkLifecycleState('packet-exported')).toEqual({
      state: 'exported',
      condition: 'current',
      legacyValue: 'packet-exported',
    })
    expect(normalizeWorkLifecycleState('overlay-applied').state).toBe('applied')
    expect(normalizeWorkLifecycleState('future-state')).toEqual({
      state: 'draft',
      condition: 'legacy-unknown',
      legacyValue: 'future-state',
    })
  })

  it('allows atomic forward transitions and rejects lifecycle regression', () => {
    expect(() => assertWorkLifecycleTransition('draft', 'exported')).not.toThrow()
    expect(() => assertWorkLifecycleTransition('overlay-applied', 'verified')).not.toThrow()
    expect(() => assertWorkLifecycleTransition('verified', 'applied')).toThrow(/cannot move backward/)
    expect(() => assertWorkLifecycleTransition('future-state', 'exported')).toThrow(/unknown legacy/)
  })

  it('derives lifecycle from durable evidence even for an older run label', () => {
    const run = capabilityRun('mod.a', 'packet-exported', {
      packetRefs: ['runs/a/handoff.md'],
      inspectionRef: 'runs/a/inspection.json',
      applicationRef: 'runs/a/applied.json',
      verificationRef: 'evidence/verifications/a.json',
    })
    expect(capabilityRunEvidenceState(run).state).toBe('verified')
  })

  it('never treats approved module specifications as implemented modules', () => {
    const overview = deriveProjectWorkOverview({
      projectId: 'project-1',
      application: { approved: {} },
      architecture: { approved: { moduleIds: ['mod.a', 'mod.b'] } },
      modules: [
        { moduleId: 'mod.a', approved: manifest('mod.a') },
        { moduleId: 'mod.b', approved: manifest('mod.b') },
      ],
      capabilityRuns: [],
      handoffRuns: [],
    })
    expect(overview.dimensions[0]?.coverage).toMatchObject({
      total: 2,
      approved: 2,
      exported: 0,
      applied: 0,
      verified: 0,
    })
    expect(overview.complete).toBe(false)
    expect(overview.nextActions[0]).toMatchObject({
      operation: 'work.plan',
      targetIds: ['mod.a', 'mod.b'],
    })
  })

  it('reports exact implementation coverage and a deterministic next action', () => {
    const overview = deriveProjectWorkOverview({
      projectId: 'project-1',
      application: { approved: {} },
      architecture: { approved: { moduleIds: ['mod.a', 'mod.b'] } },
      modules: [
        { moduleId: 'mod.a', approved: manifest('mod.a') },
        { moduleId: 'mod.b', approved: manifest('mod.b') },
      ],
      capabilityRuns: [
        capabilityRun('mod.a', 'verified', { verificationRef: 'evidence/verifications/a.json' }),
        capabilityRun('mod.b', 'exported', { packetRefs: ['runs/b/handoff.md'] }),
      ],
      handoffRuns: [],
    })
    expect(overview.dimensions[0]?.coverage).toMatchObject({
      approved: 2,
      exported: 2,
      returned: 1,
      inspected: 1,
      applied: 1,
      verified: 1,
    })
    expect(overview.nextActions[0]).toMatchObject({
      operation: 'run.return',
      targetIds: ['mod.b'],
    })
  })

  it('derives frontend return/apply/verification from artifacts instead of the coarse step', () => {
    expect(handoffRunEvidenceState(handoff({
      currentStep: 'apply-zip-overlay',
      taskPacketPath: '/run/task.md',
      overlayZipPath: '/run/ui-overlay.zip',
      overlayInspectionSummaryPath: '/run/inspection.json',
      appliedFilesPath: '/run/applied.json',
    })).state).toBe('applied')

    const complete = handoffRunEvidenceState(handoff({
      currentStep: 'complete',
      completionStatus: 'approved',
    }))
    expect(complete.state).toBe('complete')
    expect(complete.condition).toBe('current')
  })

  it('combines capability and frontend runs into one newest-first project history', () => {
    const overview = deriveProjectWorkOverview({
      projectId: 'project-1',
      application: { approved: {} },
      architecture: { approved: { moduleIds: ['mod.a'] } },
      modules: [{ moduleId: 'mod.a', approved: manifest('mod.a') }],
      capabilityRuns: [capabilityRun('mod.a', 'exported')],
      handoffRuns: [handoff({
        updatedAt: '2026-07-24T00:00:00.000Z',
        taskTitle: 'Build UI',
        taskPacketPath: '/run/task.md',
      })],
      requiresFrontend: true,
    })
    expect(overview.history.map((entry) => entry.source)).toEqual(['frontend', 'capability'])
    expect(overview.history[0]).toMatchObject({
      title: 'Build UI',
      lifecycleState: 'exported',
      isEmptyDraft: false,
    })
  })
})
