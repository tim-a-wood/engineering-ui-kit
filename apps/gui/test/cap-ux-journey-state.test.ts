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
  type CapabilityDeployableRecord,
  type CapabilityInboundBindingRecord,
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

function deployable(deployableId: string, kind: CapabilityDeployableRecord['kind'] = 'browser'): CapabilityDeployableRecord {
  return { deployableId, kind }
}

function inboundBinding(
  bindingId: string,
  deployableId: string,
  opts: { approved?: boolean; operationId?: string; operationVersion?: string; exposure?: CapabilityInboundBindingRecord['exposure'] } = {},
): CapabilityInboundBindingRecord {
  return {
    bindingId,
    deployableId,
    operationId: opts.operationId ?? 'op.show',
    operationVersion: opts.operationVersion ?? '1.0.0',
    approved: opts.approved ?? true,
    exposure: opts.exposure,
  }
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

  it('all modules approved, no deployables requiring an entry point: Build complete, Connect not-applicable, Verify current', () => {
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

  it('an embedded-library deployable never requires an entry point', () => {
    const j = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: arch(['mod.a']) },
      modules: [moduleRecord('mod.a', { approved: manifest('mod.a', 'domain', ['op.a']) })],
      deployables: [deployable('dep.lib', 'embedded-library')],
    })
    expect(stageById(j, 'connect').state).toBe('not-applicable')
    expect(j.connectEntryPoints).toEqual([
      expect.objectContaining({ deployableId: 'dep.lib', requiresEntryPoint: false, satisfied: true }),
    ])
  })

  // CAP-TEST-076: a headless (no-UI) application cannot reach Connect-complete
  // without a real inbound entry point. Applicability is driven by the
  // deployable, not by whether a UI module exists (§5.1/§12.4).
  it('CAP-TEST-076: a required deployable with no binding keeps Connect current (not not-applicable, not complete)', () => {
    const j = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: arch(['mod.a']) },
      modules: [moduleRecord('mod.a', { approved: manifest('mod.a', 'domain', ['op.show']) })],
      deployables: [deployable('dep.api', 'http-api')],
    })
    const connect = stageById(j, 'connect')
    expect(connect.state).toBe('current')
    expect(connect.satisfied).toBe(false)
    expect(stageById(j, 'verify').state).toBe('locked')
  })

  it('CAP-TEST-076: "no-ui" disposition alone never completes or skips Connect', () => {
    const j = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: arch(['mod.a']) },
      modules: [moduleRecord('mod.a', { approved: manifest('mod.a', 'domain', ['op.show']) })],
      deployables: [deployable('dep.cli', 'cli')],
      connectDisposition: 'no-ui',
    })
    const connect = stageById(j, 'connect')
    expect(connect.state).toBe('current')
    expect(connect.satisfied).toBe(false)
    expect(connect.shortStatus).toContain('headless entry point')
    expect(stageById(j, 'verify').state).toBe('locked')
  })

  it('Connect required and satisfied by a valid inbound binding on the deployable', () => {
    const j = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: arch(['mod.ui']) },
      modules: [moduleRecord('mod.ui', { approved: manifest('mod.ui', 'connection', ['op.show']) })],
      deployables: [deployable('dep.browser', 'browser')],
      inboundBindings: [inboundBinding('b1', 'dep.browser')],
    })
    expect(stageById(j, 'connect').state).toBe('complete')
    expect(stageById(j, 'verify').state).toBe('current')
  })

  // CAP-TEST-081: multiple inbound bindings may target the same operation.
  it('CAP-TEST-081: two bindings targeting the same operation on the same deployable both count', () => {
    const j = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: arch(['mod.ui']) },
      modules: [moduleRecord('mod.ui', { approved: manifest('mod.ui', 'connection', ['op.show']) })],
      deployables: [deployable('dep.browser', 'browser')],
      inboundBindings: [inboundBinding('b1', 'dep.browser'), inboundBinding('b2', 'dep.browser')],
    })
    expect(stageById(j, 'connect').state).toBe('complete')
    const status = j.connectEntryPoints.find((d) => d.deployableId === 'dep.browser')
    expect(status?.bindingCount).toBe(2)
    expect(status?.validBindingCount).toBe(2)
  })

  // CAP-TEST-079: a deferred deployable stays incomplete and visible.
  it('CAP-TEST-079: deferred Connect never silently completes, even with a required deployable', () => {
    const j = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: arch(['mod.ui']) },
      modules: [moduleRecord('mod.ui', { approved: manifest('mod.ui', 'experience', ['op.show']) })],
      deployables: [deployable('dep.browser', 'browser')],
      connectDisposition: 'deferred',
    })
    const connect = stageById(j, 'connect')
    expect(connect.state).not.toBe('not-applicable')
    expect(connect.state).not.toBe('complete')
    expect(connect.satisfied).toBe(false)
    expect(connect.shortStatus).toBe('Connect is deferred and needs attention.')
    expect(j.complete).toBe(false)
  })

  it('a draft (unapproved) binding remains visible in connectEntryPoints but does not satisfy Connect', () => {
    const j = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: arch(['mod.ui']) },
      modules: [moduleRecord('mod.ui', { approved: manifest('mod.ui', 'experience', ['op.show']) })],
      deployables: [deployable('dep.browser', 'browser')],
      inboundBindings: [inboundBinding('b1', 'dep.browser', { approved: false })],
    })
    expect(stageById(j, 'connect').state).toBe('current')
    const status = j.connectEntryPoints.find((d) => d.deployableId === 'dep.browser')
    expect(status?.bindingCount).toBe(1)
    expect(status?.validBindingCount).toBe(0)
    expect(status?.satisfied).toBe(false)
  })

  it('new inbound bindings default to private exposure; escalating is surfaced, not hidden', () => {
    const privateJourney = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: arch(['mod.ui']) },
      modules: [moduleRecord('mod.ui', { approved: manifest('mod.ui', 'experience', ['op.show']) })],
      deployables: [deployable('dep.browser', 'browser')],
      inboundBindings: [inboundBinding('b1', 'dep.browser')],
    })
    expect(privateJourney.anyExposureElevated).toBe(false)

    const elevatedJourney = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: arch(['mod.ui']) },
      modules: [moduleRecord('mod.ui', { approved: manifest('mod.ui', 'experience', ['op.show']) })],
      deployables: [deployable('dep.browser', 'browser')],
      inboundBindings: [inboundBinding('b1', 'dep.browser', { exposure: 'public' })],
    })
    expect(elevatedJourney.anyExposureElevated).toBe(true)
    // Elevation is visible, but does not by itself block Connect completeness.
    expect(stageById(elevatedJourney, 'connect').state).toBe('complete')
  })

  it('a migrated ui inbound binding counts the same as any other kind (legacy FrontendBinding no longer consulted)', () => {
    const j = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: arch(['mod.ui']) },
      modules: [moduleRecord('mod.ui', { approved: manifest('mod.ui', 'experience', ['op.show']) })],
      deployables: [deployable('dep.browser', 'browser')],
      inboundBindings: [inboundBinding('bind-approve', 'dep.browser')],
      // Legacy FrontendBinding records no longer drive Connect completeness.
      bindings: [{ bindingId: 'stale-legacy', approved: {} as never }],
    })
    expect(stageById(j, 'connect').state).toBe('complete')
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
