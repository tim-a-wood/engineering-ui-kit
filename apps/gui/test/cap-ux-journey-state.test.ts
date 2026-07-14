/**
 * CAP-UX journey-state derivation (capabilitiesUiState).
 * The Guided five-stage journey is derived purely from canonical records and
 * never persists projection state. These tests cover every gating transition.
 */

import { describe, expect, it } from 'vitest'
import {
  deriveJourney,
  stageById,
  continueTarget,
  type JourneyInput,
} from '../src/views/capabilities/capabilitiesUiState'
import type { CapabilityModuleRecord, ModuleManifest, ModuleType } from '@engineering-ui-kit/core'

function manifest(moduleId: string, moduleType: ModuleType, ops: string[] = []): ModuleManifest {
  return {
    schemaVersion: '1.0',
    architectureVersion: '1.0',
    moduleId,
    moduleVersion: '1.0.0',
    moduleType,
    name: moduleId,
    responsibility: moduleId,
    ownedConcerns: [],
    excludedConcerns: [],
    providedOperations: ops.map((operationId) => ({ operationId, contractVersion: '1.0' })),
    requiredOperations: [],
    verificationSuiteIds: [],
    runtimeAllocation: 'local-embedded',
    events: [],
    ownedPaths: [],
  }
}

function moduleRecord(
  moduleId: string,
  opts: { approved?: ModuleManifest; freshness?: string } = {},
): CapabilityModuleRecord {
  return {
    moduleId,
    approved: opts.approved,
    freshness: opts.freshness
      ? ({ primaryState: opts.freshness } as CapabilityModuleRecord['freshness'])
      : undefined,
  }
}

function arch(moduleIds: string[]) {
  return { schemaVersion: '1.0', moduleIds } as unknown
}

const EMPTY: JourneyInput = { application: {}, architecture: {}, modules: [], bindings: [] }

describe('deriveJourney', () => {
  it('empty selected project: Define is current, everything after is locked', () => {
    const j = deriveJourney(EMPTY)
    expect(stageById(j, 'define').state).toBe('current')
    expect(stageById(j, 'define').shortStatus).toBe('Understand the application.')
    expect(stageById(j, 'architect').state).toBe('locked')
    expect(stageById(j, 'build').state).toBe('locked')
    expect(stageById(j, 'connect').state).toBe('locked')
    expect(stageById(j, 'verify').state).toBe('locked')
    expect(j.firstIncompleteStageId).toBe('define')
    expect(j.complete).toBe(false)
  })

  it('application draft only: Define current with draft status; Architect still locked', () => {
    const j = deriveJourney({ ...EMPTY, application: { draft: { id: 'app.x' } } })
    expect(stageById(j, 'define').state).toBe('current')
    expect(stageById(j, 'define').shortStatus).toBe('Review the application plan.')
    expect(stageById(j, 'architect').state).toBe('locked')
  })

  it('approved application: Define complete, Architect becomes current', () => {
    const j = deriveJourney({ ...EMPTY, application: { approved: { id: 'app.x' } } })
    expect(stageById(j, 'define').state).toBe('complete')
    expect(stageById(j, 'architect').state).toBe('current')
    expect(stageById(j, 'architect').shortStatus).toBe('Shape the solution.')
    expect(j.firstIncompleteStageId).toBe('architect')
  })

  it('architecture draft only does not complete Architect', () => {
    const j = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { draft: arch(['mod.a']) },
    })
    expect(stageById(j, 'architect').state).toBe('current')
    expect(stageById(j, 'architect').shortStatus).toBe('Review the solution design.')
    expect(stageById(j, 'build').state).toBe('locked')
  })

  it('approved architecture with no modules: Build is actionable-blocked, not complete', () => {
    const j = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: arch([]) },
    })
    const build = stageById(j, 'build')
    expect(build.state).toBe('current')
    expect(build.satisfied).toBe(false)
    expect(build.shortStatus).toBe('The architecture allocates no modules.')
  })

  it('partial module approval: Build shows progress and stays current', () => {
    const j = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: arch(['mod.a', 'mod.b', 'mod.c']) },
      modules: [
        moduleRecord('mod.a', { approved: manifest('mod.a', 'domain', ['op.a']) }),
        moduleRecord('mod.b'),
        moduleRecord('mod.c'),
      ],
    })
    const build = stageById(j, 'build')
    expect(build.state).toBe('current')
    expect(build.progress).toEqual({ done: 1, total: 3 })
    expect(build.shortStatus).toBe('1 of 3 approved.')
    expect(stageById(j, 'connect').state).toBe('locked')
  })

  it('all modules approved (no UI modules): Build complete, Connect not-applicable, Verify current', () => {
    const j = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: arch(['mod.a']) },
      modules: [moduleRecord('mod.a', { approved: manifest('mod.a', 'domain', ['op.a']) })],
    })
    expect(stageById(j, 'build').state).toBe('complete')
    const connect = stageById(j, 'connect')
    expect(connect.state).toBe('not-applicable')
    expect(connect.shortStatus).toBe('Not required.')
    expect(connect.satisfied).toBe(true)
    expect(stageById(j, 'verify').state).toBe('current')
    // Connect being not-applicable is skipped by first-incomplete.
    expect(j.firstIncompleteStageId).toBe('verify')
  })

  it('Connect required (experience module) with no binding: Connect current', () => {
    const j = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: arch(['mod.ui']) },
      modules: [moduleRecord('mod.ui', { approved: manifest('mod.ui', 'experience', ['op.show']) })],
    })
    const connect = stageById(j, 'connect')
    expect(connect.state).toBe('current')
    expect(connect.satisfied).toBe(false)
    expect(stageById(j, 'verify').state).toBe('locked')
  })

  it('Connect required and satisfied by an approved binding', () => {
    const j = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: arch(['mod.ui']) },
      modules: [moduleRecord('mod.ui', { approved: manifest('mod.ui', 'connection', ['op.show']) })],
      bindings: [{ bindingId: 'b1', approved: {} as never }],
    })
    expect(stageById(j, 'connect').state).toBe('complete')
    expect(stageById(j, 'verify').state).toBe('current')
  })

  it('Build complete but no approved operation keeps Connect locked', () => {
    const j = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: arch(['mod.a']) },
      modules: [moduleRecord('mod.a', { approved: manifest('mod.a', 'domain', []) })],
    })
    expect(stageById(j, 'build').state).toBe('complete')
    expect(stageById(j, 'connect').state).toBe('locked')
    expect(stageById(j, 'verify').state).toBe('locked')
  })

  it('verification partially ready: Verify shows progress', () => {
    const j = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: arch(['mod.a', 'mod.b']) },
      modules: [
        moduleRecord('mod.a', { approved: manifest('mod.a', 'domain', ['op.a']), freshness: 'ready' }),
        moduleRecord('mod.b', { approved: manifest('mod.b', 'domain', ['op.b']), freshness: 'verification-needed' }),
      ],
    })
    const verify = stageById(j, 'verify')
    expect(verify.state).toBe('current')
    expect(verify.progress).toEqual({ done: 1, total: 2 })
    expect(verify.shortStatus).toBe('1 of 2 ready.')
  })

  it('all modules ready: journey complete', () => {
    const j = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: arch(['mod.a']) },
      modules: [moduleRecord('mod.a', { approved: manifest('mod.a', 'domain', ['op.a']), freshness: 'ready' })],
    })
    expect(stageById(j, 'verify').state).toBe('complete')
    expect(j.complete).toBe(true)
    expect(j.firstIncompleteStageId).toBe('verify')
  })

  it('continueTarget returns the next stage descriptor', () => {
    const j = deriveJourney({ ...EMPTY, application: { approved: {} } })
    expect(continueTarget(j, 'define')?.id).toBe('architect')
    expect(continueTarget(j, 'verify')).toBeUndefined()
  })

  it('derivation is pure: same input twice yields equal output and no side effects', () => {
    const input: JourneyInput = {
      application: { approved: {} },
      architecture: { approved: arch(['mod.a']) },
      modules: [moduleRecord('mod.a', { approved: manifest('mod.a', 'domain', ['op.a']) })],
      bindings: [],
    }
    const a = deriveJourney(input)
    const b = deriveJourney(input)
    expect(a).toEqual(b)
    // input untouched
    expect(input.modules).toHaveLength(1)
  })
})
