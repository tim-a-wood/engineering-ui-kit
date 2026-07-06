import { describe, expect, it } from 'vitest'
import type { HandoffRun } from '@engineering-ui-kit/core'
import { isStepReachable, stepIndex, stepStateFor, WORKFLOW_STEPS, NAV_ITEMS } from '../src/appState'

function run(patch: Partial<HandoffRun>): HandoffRun {
  return {
    id: 'r1',
    projectId: 'p1',
    currentStep: 'prepare-context',
    createdAt: '2026-07-06T00:00:00Z',
    updatedAt: '2026-07-06T00:00:00Z',
    ...patch,
  }
}

describe('workflow structure', () => {
  it('exposes five ordered steps and five nav items', () => {
    expect(WORKFLOW_STEPS.map((s) => s.index)).toEqual([0, 1, 2, 3, 4])
    expect(NAV_ITEMS.map((n) => n.id)).toEqual(['copilot-handoff', 'recipes', 'components', 'projects', 'settings'])
  })

  it('orders step indices monotonically', () => {
    expect(stepIndex('prepare-context')).toBeLessThan(stepIndex('create-task-packet'))
    expect(stepIndex('create-task-packet')).toBeLessThan(stepIndex('run-in-copilot'))
    expect(stepIndex('verify-review')).toBeLessThan(stepIndex('complete'))
  })
})

describe('isStepReachable (ARCH-ROUTE-004 artifact gating)', () => {
  it('only step 1 is reachable without a run', () => {
    expect(isStepReachable(undefined, 'prepare-context')).toBe(true)
    expect(isStepReachable(undefined, 'create-task-packet')).toBe(false)
    expect(isStepReachable(undefined, 'verify-review')).toBe(false)
  })

  it('completed and current steps are always revisitable', () => {
    const r = run({ currentStep: 'run-in-copilot' })
    expect(isStepReachable(r, 'prepare-context')).toBe(true)
    expect(isStepReachable(r, 'create-task-packet')).toBe(true)
    expect(isStepReachable(r, 'run-in-copilot')).toBe(true)
  })

  it('gates future steps on artifacts, not on currentStep alone', () => {
    const noArtifacts = run({})
    expect(isStepReachable(noArtifacts, 'create-task-packet')).toBe(false)

    const withFlatfile = run({ repoFlatfilePath: '/x/repo-flatfile.txt' })
    expect(isStepReachable(withFlatfile, 'create-task-packet')).toBe(true)
    expect(isStepReachable(withFlatfile, 'run-in-copilot')).toBe(false)

    // the Copilot upload is user-owned and invisible: packet artifacts open both step 3 and step 4
    const withPacket = run({ repoFlatfilePath: '/x/f.txt', taskPacketPath: '/x/task-packet.md' })
    expect(isStepReachable(withPacket, 'run-in-copilot')).toBe(true)
    expect(isStepReachable(withPacket, 'apply-zip-overlay')).toBe(true)
    expect(isStepReachable(withPacket, 'verify-review')).toBe(false)

    const applied = run({ currentStep: 'apply-zip-overlay', appliedFilesPath: '/x/applied-files.json' })
    expect(isStepReachable(applied, 'verify-review')).toBe(true)
  })

  it('supports legacy combined-pack runs', () => {
    const legacy = run({ taskAndStandardPackPath: '/x/task-and-standard-pack.md' })
    expect(isStepReachable(legacy, 'run-in-copilot')).toBe(true)
  })

  it('non-workflow views are always reachable', () => {
    expect(isStepReachable(undefined, 'projects')).toBe(true)
    expect(isStepReachable(run({}), 'settings')).toBe(true)
  })
})

describe('stepStateFor', () => {
  it('marks everything complete when the run is complete', () => {
    const r = run({ currentStep: 'complete' })
    for (let i = 0; i < 5; i++) expect(stepStateFor(r, i)).toBe('complete')
  })

  it('splits complete/current/upcoming around the current step', () => {
    const r = run({ currentStep: 'run-in-copilot' })
    expect(stepStateFor(r, 0)).toBe('complete')
    expect(stepStateFor(r, 1)).toBe('complete')
    expect(stepStateFor(r, 2)).toBe('current')
    expect(stepStateFor(r, 3)).toBe('upcoming')
  })
})
