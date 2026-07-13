import { describe, expect, it } from 'vitest'
import type { HandoffRun } from '@engineering-ui-kit/core'
import {
  buildWorkspaceForStep,
  isLegacyStageReachable,
  isStepReachable,
  resolveWorkflowNavigation,
  stepIndex,
  stepStateFor,
  viewForRunStep,
  visibleStepIndex,
  WORKFLOW_STEPS,
  NAV_ITEMS,
} from '../src/appState'

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
  it('exposes two user-facing steps and five nav items', () => {
    expect(WORKFLOW_STEPS.map((s) => s.index)).toEqual([0, 1])
    expect(WORKFLOW_STEPS.map((s) => s.short)).toEqual(['Build', 'Test'])
    expect(NAV_ITEMS.map((n) => n.id)).toEqual(['copilot-handoff', 'recipes', 'components', 'projects', 'settings'])
  })

  it('orders legacy step indices monotonically', () => {
    expect(stepIndex('prepare-context')).toBeLessThan(stepIndex('create-task-packet'))
    expect(stepIndex('create-task-packet')).toBeLessThan(stepIndex('run-in-copilot'))
    expect(stepIndex('verify-review')).toBeLessThan(stepIndex('complete'))
  })
})

describe('legacy → Build workspace mapping', () => {
  it('maps persisted steps to Build workspace tabs', () => {
    expect(buildWorkspaceForStep('prepare-context')).toBe('handoff')
    expect(buildWorkspaceForStep('create-task-packet')).toBe('handoff')
    expect(buildWorkspaceForStep('run-in-copilot')).toBe('copilot')
    expect(buildWorkspaceForStep('apply-zip-overlay')).toBe('overlay')
    expect(buildWorkspaceForStep('build')).toBe('handoff')
  })

  it('resolves legacy routes into build + workspace', () => {
    expect(resolveWorkflowNavigation('prepare-context')).toEqual({ view: 'build', workspace: 'handoff' })
    expect(resolveWorkflowNavigation('create-task-packet')).toEqual({ view: 'build', workspace: 'handoff' })
    expect(resolveWorkflowNavigation('run-in-copilot')).toEqual({ view: 'build', workspace: 'copilot' })
    expect(resolveWorkflowNavigation('apply-zip-overlay')).toEqual({ view: 'build', workspace: 'overlay' })
    expect(resolveWorkflowNavigation('verify-review')).toEqual({ view: 'verify-review' })
  })

  it('maps resume views from persisted run steps', () => {
    expect(viewForRunStep('prepare-context')).toBe('build')
    expect(viewForRunStep('apply-zip-overlay')).toBe('build')
    expect(viewForRunStep('verify-review')).toBe('verify-review')
    expect(viewForRunStep('complete')).toBe('verify-review')
  })

  it('maps visible stepper indices', () => {
    expect(visibleStepIndex('create-task-packet')).toBe(0)
    expect(visibleStepIndex('run-in-copilot')).toBe(0)
    expect(visibleStepIndex('verify-review')).toBe(1)
    expect(visibleStepIndex('complete')).toBe(1)
  })
})

describe('isStepReachable (visible Build/Test gating)', () => {
  it('Build is reachable without a run; Test is not', () => {
    expect(isStepReachable(undefined, 'build')).toBe(true)
    expect(isStepReachable(undefined, 'prepare-context')).toBe(true)
    expect(isStepReachable(undefined, 'create-task-packet')).toBe(true)
    expect(isStepReachable(undefined, 'verify-review')).toBe(false)
  })

  it('Build stages remain revisitable once a run exists', () => {
    const r = run({ currentStep: 'run-in-copilot' })
    expect(isStepReachable(r, 'build')).toBe(true)
    expect(isStepReachable(r, 'prepare-context')).toBe(true)
    expect(isStepReachable(r, 'apply-zip-overlay')).toBe(true)
  })

  it('Test requires appliedFilesPath', () => {
    const noApply = run({ currentStep: 'apply-zip-overlay' })
    expect(isStepReachable(noApply, 'verify-review')).toBe(false)

    const applied = run({ currentStep: 'apply-zip-overlay', appliedFilesPath: '/x/applied-files.json' })
    expect(isStepReachable(applied, 'verify-review')).toBe(true)
  })

  it('non-workflow views are always reachable', () => {
    expect(isStepReachable(undefined, 'projects')).toBe(true)
    expect(isStepReachable(run({}), 'settings')).toBe(true)
  })
})

describe('isLegacyStageReachable (Build-internal artifact gates)', () => {
  it('gates future legacy stages on artifacts', () => {
    const noArtifacts = run({})
    expect(isLegacyStageReachable(noArtifacts, 'create-task-packet')).toBe(false)

    const withFlatfile = run({ repoFlatfilePath: '/x/repo-flatfile.txt' })
    expect(isLegacyStageReachable(withFlatfile, 'create-task-packet')).toBe(true)
    expect(isLegacyStageReachable(withFlatfile, 'run-in-copilot')).toBe(false)

    const withPacket = run({ repoFlatfilePath: '/x/f.txt', taskPacketPath: '/x/task-packet.md' })
    expect(isLegacyStageReachable(withPacket, 'run-in-copilot')).toBe(true)
    expect(isLegacyStageReachable(withPacket, 'apply-zip-overlay')).toBe(true)
    expect(isLegacyStageReachable(withPacket, 'verify-review')).toBe(false)

    const applied = run({ currentStep: 'apply-zip-overlay', appliedFilesPath: '/x/applied-files.json' })
    expect(isLegacyStageReachable(applied, 'verify-review')).toBe(true)
  })

  it('supports legacy combined-pack runs', () => {
    const legacy = run({ taskAndStandardPackPath: '/x/task-and-standard-pack.md' })
    expect(isLegacyStageReachable(legacy, 'run-in-copilot')).toBe(true)
    expect(isStepReachable(legacy, 'run-in-copilot')).toBe(true)
  })
})

describe('stepStateFor', () => {
  it('marks everything complete when the run is complete', () => {
    const r = run({ currentStep: 'complete' })
    expect(stepStateFor(r, 0)).toBe('complete')
    expect(stepStateFor(r, 1)).toBe('complete')
  })

  it('treats all Build-stage runs as current on Build, upcoming on Test', () => {
    const r = run({ currentStep: 'run-in-copilot' })
    expect(stepStateFor(r, 0)).toBe('current')
    expect(stepStateFor(r, 1)).toBe('upcoming')
  })

  it('marks Build complete when Test is current', () => {
    const r = run({ currentStep: 'verify-review', appliedFilesPath: '/x/a.json' })
    expect(stepStateFor(r, 0)).toBe('complete')
    expect(stepStateFor(r, 1)).toBe('current')
  })
})
