/**
 * CAP-UX journey-state derivation (capabilitiesUiState).
 * The Guided four-stage journey is derived purely from canonical records and
 * never persists projection state. These tests cover every gating transition.
 */

import { describe, expect, it } from 'vitest'
import {
  deriveJourney,
  stageById,
  continueTarget,
  normalizeStageId,
  stageFromCapabilitiesNavigation,
  STAGE_ORDER,
  type CapabilityDeployableRecord,
  type CapabilityInboundBindingRecord,
  type JourneyInput,
} from '../src/views/capabilities/capabilitiesUiState'
import type { CapabilityIntegrationState, CapabilityModuleRecord, ModuleManifest, ModuleType } from '@engineering-ui-kit/core'

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
    operationVersion: opts.operationVersion ?? '1.0',
    approved: opts.approved ?? true,
    exposure: opts.exposure,
  }
}

const EMPTY: JourneyInput = { application: {}, architecture: {}, modules: [], bindings: [] }

function integration(status: 'ready-to-generate' | 'applied' | 'stale', options: {
  planId?: string
  applyPlanId?: string
  verifiedBindingIds?: string[]
  deployableId?: string
} = {}): CapabilityIntegrationState {
  const planId = options.planId ?? 'plan-1'
  const deployableId = options.deployableId ?? 'dep.browser'
  return {
    schemaVersion: '1.0', projectId: 'project-1', updatedAt: '2026-07-16T00:00:00.000Z',
    deployables: [{
      deployableId, status, attention: [],
      currentPlan: status === 'ready-to-generate' ? undefined : { planId, planHash: `${planId}-hash` } as never,
      latestApply: status === 'ready-to-generate' ? undefined : {
        status: 'applied', planId: options.applyPlanId ?? planId, planHash: `${options.applyPlanId ?? planId}-hash`,
      } as never,
      latestCommandRun: status === 'ready-to-generate' ? undefined : {
        status: 'passed', planId: options.applyPlanId ?? planId, planHash: `${options.applyPlanId ?? planId}-hash`,
      } as never,
      connectionVerifications: (options.verifiedBindingIds ?? []).map((bindingId) => ({
        verificationId: `verification-${bindingId}`, bindingId, deployableId, verificationStatus: 'pass', usedTestAdapter: false,
      } as never)),
      currentConnectionVerificationIds: (options.verifiedBindingIds ?? []).map((bindingId) => `verification-${bindingId}`),
    }],
  }
}

describe('deriveJourney', () => {
  it('has exactly four top-level stages and redirects a legacy Connect location into Build', () => {
    expect(STAGE_ORDER).toEqual(['define', 'architect', 'build', 'verify'])
    expect(normalizeStageId('connect')).toBe('build')
    expect(normalizeStageId('verify')).toBe('verify')
    expect(stageFromCapabilitiesNavigation('euik://app/capabilities/connect')).toBe('build')
    expect(stageFromCapabilitiesNavigation('https://app.invalid/?view=capabilities&stage=connect')).toBe('build')
    expect(stageFromCapabilitiesNavigation('https://app.invalid/?view=capabilities&section=connections')).toBe('build')
    expect(stageFromCapabilitiesNavigation('https://app.invalid/#capabilities/design')).toBe('architect')
    expect(stageFromCapabilitiesNavigation('https://app.invalid/?view=capabilities')).toBeUndefined()
  })
  it('empty selected project: Define is current, everything after is locked', () => {
    const j = deriveJourney(EMPTY)
    expect(stageById(j, 'define').state).toBe('current')
    expect(stageById(j, 'define').shortStatus).toBe('Understand the application.')
    expect(stageById(j, 'architect').state).toBe('locked')
    expect(stageById(j, 'build').state).toBe('locked')
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

  it('keeps Design current until the canonical application structure matches the approved architecture', () => {
    const approvedArchitecture = { ...(arch(['mod.a']) as object), contentHash: 'architecture-hash' }
    const pending = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: approvedArchitecture },
      foundation: {},
    })
    expect(stageById(pending, 'architect').state).toBe('current')
    expect(stageById(pending, 'architect').shortStatus).toBe('Review how the application runs.')
    expect(stageById(pending, 'build').state).toBe('locked')

    const approved = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: approvedArchitecture },
      foundation: { approved: { architectureHash: 'architecture-hash' } as never },
    })
    expect(stageById(approved, 'architect').state).toBe('complete')
    expect(stageById(approved, 'build').state).toBe('current')
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
  })

  it('all modules approved with no required deployables: Build completes and Verify is current', () => {
    const j = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: arch(['mod.a']) },
      modules: [moduleRecord('mod.a', { approved: manifest('mod.a', 'domain', ['op.a']) })],
    })
    expect(stageById(j, 'build').state).toBe('complete')
    expect(stageById(j, 'verify').state).toBe('current')
    expect(j.firstIncompleteStageId).toBe('verify')
  })

  it('production integration keeps Build open until infrastructure has been applied', () => {
    const base = {
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: arch(['mod.ui']) },
      modules: [moduleRecord('mod.ui', { approved: manifest('mod.ui', 'experience', ['op.show']) })],
      deployables: [deployable('dep.browser')],
      inboundBindings: [inboundBinding('binding-1', 'dep.browser')],
    }
    const pending = deriveJourney({ ...base, integration: integration('ready-to-generate') })
    expect(stageById(pending, 'build').state).toBe('current')
    expect(stageById(pending, 'verify').state).toBe('locked')

    const applied = deriveJourney({ ...base, integration: integration('applied') })
    expect(stageById(applied, 'build').state).toBe('complete')
    expect(stageById(applied, 'verify').state).toBe('current')

    const verified = deriveJourney({ ...base, integration: integration('applied', { verifiedBindingIds: ['binding-1'] }) })
    expect(stageById(verified, 'verify').state).toBe('complete')
  })

  for (const example of [
    { label: 'UI', kind: 'browser' as const, deployableId: 'dep.browser' },
    { label: 'headless HTTP', kind: 'http-api' as const, deployableId: 'dep.http' },
    { label: 'headless CLI', kind: 'cli' as const, deployableId: 'dep.cli' },
    { label: 'headless scheduled', kind: 'worker' as const, deployableId: 'dep.worker' },
  ]) {
    it(`${example.label} follows modules → entry point → shared setup → Verify without returning to an earlier stage`, () => {
      const base = {
        ...EMPTY,
        application: { approved: {} },
        architecture: { approved: arch(['mod.main']) },
        modules: [moduleRecord('mod.main', { approved: manifest('mod.main', 'domain', ['op.run']) })],
        deployables: [deployable(example.deployableId, example.kind)],
      }
      const beforeEntryPoint = deriveJourney({
        ...base,
        integration: integration('ready-to-generate', { deployableId: example.deployableId }),
      })
      expect(stageById(beforeEntryPoint, 'build').state).toBe('current')
      expect(stageById(beforeEntryPoint, 'build').shortStatus).toContain('0 of 1 application entry points configured')
      expect(stageById(beforeEntryPoint, 'verify').state).toBe('locked')

      const afterEntryPoint = deriveJourney({
        ...base,
        inboundBindings: [inboundBinding('binding-main', example.deployableId, { operationId: 'op.run' })],
        integration: integration('ready-to-generate', { deployableId: example.deployableId }),
      })
      expect(stageById(afterEntryPoint, 'build').state).toBe('current')
      expect(stageById(afterEntryPoint, 'build').shortStatus).toMatch(/generate and apply/i)
      expect(stageById(afterEntryPoint, 'verify').state).toBe('locked')

      const setupApplied = deriveJourney({
        ...base,
        inboundBindings: [inboundBinding('binding-main', example.deployableId, { operationId: 'op.run' })],
        integration: integration('applied', { deployableId: example.deployableId }),
      })
      expect(stageById(setupApplied, 'build').state).toBe('complete')
      expect(stageById(setupApplied, 'verify').state).toBe('current')
      expect(setupApplied.firstIncompleteStageId).toBe('verify')
    })
  }

  it('a new unapplied integration plan reopens Build and locks downstream stages', () => {
    const j = deriveJourney({
      ...EMPTY,
      application: { approved: {} }, architecture: { approved: arch(['mod.ui']) },
      modules: [moduleRecord('mod.ui', { approved: manifest('mod.ui', 'experience', ['op.show']) })],
      deployables: [deployable('dep.browser')], inboundBindings: [inboundBinding('binding-1', 'dep.browser')],
      integration: integration('stale', { planId: 'plan-2', applyPlanId: 'plan-1' }),
    })
    expect(stageById(j, 'build').state).toBe('current')
    expect(stageById(j, 'verify').state).toBe('locked')
  })

  it('reapplying the refreshed setup restores Build completion without invalidating module approval', () => {
    const base = {
      ...EMPTY,
      application: { approved: {} }, architecture: { approved: arch(['mod.ui']) },
      modules: [moduleRecord('mod.ui', { approved: manifest('mod.ui', 'experience', ['op.show']) })],
      deployables: [deployable('dep.browser')], inboundBindings: [inboundBinding('binding-1', 'dep.browser')],
    }
    const stale = deriveJourney({ ...base, integration: integration('stale', { planId: 'plan-2', applyPlanId: 'plan-1' }) })
    expect(stageById(stale, 'build').state).toBe('current')
    expect(base.modules[0]?.approved?.moduleVersion).toBe('1.0.0')

    const reapplied = deriveJourney({ ...base, integration: integration('applied', { planId: 'plan-2' }) })
    expect(stageById(reapplied, 'build').state).toBe('complete')
    expect(stageById(reapplied, 'verify').state).toBe('current')
    expect(base.modules[0]?.approved?.moduleVersion).toBe('1.0.0')
  })

  it('an embedded-library deployable never requires an entry point', () => {
    const j = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: arch(['mod.a']) },
      modules: [moduleRecord('mod.a', { approved: manifest('mod.a', 'domain', ['op.a']) })],
      deployables: [deployable('dep.lib', 'embedded-library')],
    })
    expect(stageById(j, 'build').state).toBe('complete')
    expect(j.entryPoints).toEqual([
      expect.objectContaining({ deployableId: 'dep.lib', requiresEntryPoint: false, satisfied: true }),
    ])
  })

  // CAP-TEST-076: a headless (no-UI) application cannot complete Build
  // without a real inbound entry point. Applicability is driven by the
  // deployable, not by whether a UI module exists (§5.1/§12.4).
  it('CAP-TEST-076: a required deployable with no binding keeps Build current', () => {
    const j = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: arch(['mod.a']) },
      modules: [moduleRecord('mod.a', { approved: manifest('mod.a', 'domain', ['op.show']) })],
      deployables: [deployable('dep.api', 'http-api')],
    })
    const build = stageById(j, 'build')
    expect(build.state).toBe('current')
    expect(build.satisfied).toBe(false)
    expect(build.shortStatus).toContain('0 of 1 application entry points configured')
    expect(stageById(j, 'verify').state).toBe('locked')
  })

  it('CAP-TEST-076: legacy "no-ui" disposition alone never completes or skips entry-point configuration', () => {
    const j = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: arch(['mod.a']) },
      modules: [moduleRecord('mod.a', { approved: manifest('mod.a', 'domain', ['op.show']) })],
      deployables: [deployable('dep.cli', 'cli')],
      connectDisposition: 'no-ui',
    })
    const build = stageById(j, 'build')
    expect(build.state).toBe('current')
    expect(build.satisfied).toBe(false)
    expect(stageById(j, 'verify').state).toBe('locked')
  })

  it('a required entry point is satisfied by a valid approved inbound binding', () => {
    const j = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: arch(['mod.ui']) },
      modules: [moduleRecord('mod.ui', { approved: manifest('mod.ui', 'connection', ['op.show']) })],
      deployables: [deployable('dep.browser', 'browser')],
      inboundBindings: [inboundBinding('b1', 'dep.browser')],
    })
    expect(stageById(j, 'build').state).toBe('complete')
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
    expect(stageById(j, 'build').state).toBe('complete')
    const status = j.entryPoints.find((d) => d.deployableId === 'dep.browser')
    expect(status?.bindingCount).toBe(2)
    expect(status?.validBindingCount).toBe(2)
  })

  // CAP-TEST-079: a deferred entry point stays incomplete and visible within Build.
  it('CAP-TEST-079: deferred entry-point work never silently completes Build', () => {
    const j = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: arch(['mod.ui']) },
      modules: [moduleRecord('mod.ui', { approved: manifest('mod.ui', 'experience', ['op.show']) })],
      deployables: [deployable('dep.browser', 'browser')],
      connectDisposition: 'deferred',
    })
    const build = stageById(j, 'build')
    expect(build.state).toBe('current')
    expect(build.satisfied).toBe(false)
    expect(build.shortStatus).toBe('Entry-point configuration is deferred and needs attention.')
    expect(j.complete).toBe(false)
  })

  it('a draft binding remains visible in entryPoints but does not satisfy Build', () => {
    const j = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: arch(['mod.ui']) },
      modules: [moduleRecord('mod.ui', { approved: manifest('mod.ui', 'experience', ['op.show']) })],
      deployables: [deployable('dep.browser', 'browser')],
      inboundBindings: [inboundBinding('b1', 'dep.browser', { approved: false })],
    })
    expect(stageById(j, 'build').state).toBe('current')
    const status = j.entryPoints.find((d) => d.deployableId === 'dep.browser')
    expect(status?.bindingCount).toBe(1)
    expect(status?.validBindingCount).toBe(0)
    expect(status?.satisfied).toBe(false)
  })

  it('an approved binding for an operation outside the approved modules remains visible but does not satisfy Build', () => {
    const j = deriveJourney({
      ...EMPTY,
      application: { approved: {} }, architecture: { approved: arch(['mod.ui']) },
      modules: [moduleRecord('mod.ui', { approved: manifest('mod.ui', 'experience', ['op.show']) })],
      deployables: [deployable('dep.browser', 'browser')],
      inboundBindings: [inboundBinding('b1', 'dep.browser', { operationId: 'op.retired', operationVersion: '1.0' })],
    })
    expect(stageById(j, 'build').state).toBe('current')
    expect(j.entryPoints[0]).toMatchObject({ bindingCount: 1, validBindingCount: 0, satisfied: false })
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
    // Elevation is visible, but does not by itself block Build completeness.
    expect(stageById(elevatedJourney, 'build').state).toBe('complete')
  })

  it('a migrated ui inbound binding counts the same as any other kind (legacy FrontendBinding no longer consulted)', () => {
    const j = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: arch(['mod.ui']) },
      modules: [moduleRecord('mod.ui', { approved: manifest('mod.ui', 'experience', ['op.show']) })],
      deployables: [deployable('dep.browser', 'browser')],
      inboundBindings: [inboundBinding('bind-approve', 'dep.browser')],
      // Legacy FrontendBinding records no longer drive entry-point completeness.
      bindings: [{ bindingId: 'stale-legacy', approved: {} as never }],
    })
    expect(stageById(j, 'build').state).toBe('complete')
  })

  it('a required entry point with no approved operation keeps Build incomplete', () => {
    const j = deriveJourney({
      ...EMPTY,
      application: { approved: {} },
      architecture: { approved: arch(['mod.a']) },
      modules: [moduleRecord('mod.a', { approved: manifest('mod.a', 'domain', []) })],
      deployables: [deployable('dep.api', 'http-api')],
    })
    expect(stageById(j, 'build').state).toBe('current')
    expect(stageById(j, 'build').shortStatus).toContain('Approve at least one capability operation')
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
