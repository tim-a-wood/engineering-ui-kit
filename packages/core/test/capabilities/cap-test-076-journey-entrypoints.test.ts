/**
 * CAP-TEST-076/079/081 — Connect entry-point completeness (CAP-ERA-001 §5.1/§5.4/§12.4).
 *
 * Canonical journey/state model (WP6A): Connect completeness is driven by
 * whether each required (non-`embedded-library`) deployable has at least one
 * valid `InboundBinding`, not by whether a UI module exists.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_INBOUND_EXPOSURE,
  evaluateConnectEntryPoints,
  withDefaultExposure,
  type DeployableEntryPointInput,
  type InboundBindingEntryPointInput,
} from '../../src/capabilities/journeys.js'
import { frontendBindingToInboundBinding } from '../../src/capabilities/binding.js'
import type { FrontendBinding } from '../../src/capabilities/types.js'

function frontendBindingFixture(overrides: Partial<FrontendBinding> = {}): FrontendBinding {
  return {
    schemaVersion: '1.0',
    bindingId: 'bind-legacy',
    version: '1.0.0',
    projectId: 'proj-1',
    selectionEvidence: {
      route: '/',
      documentTitle: 'App',
      selector: '#go',
      visibleText: 'Go',
      elementTag: 'button',
      captureTime: new Date().toISOString(),
      stableMarker: 'data-cap-id=go',
    },
    trigger: 'activate',
    operationId: 'op.show',
    operationVersion: '1.0.0',
    inputMappings: [],
    outputMappings: [],
    loadingBehavior: 'spinner',
    validationBehavior: 'inline',
    domainRejectionBehavior: 'toast',
    technicalFailureBehavior: 'banner',
    cancellationBehavior: 'idle',
    duplicateSubmissionBehavior: 'ignore',
    dataMode: 'connected',
    ...overrides,
  }
}

describe('CAP-TEST-076 headless deployable cannot reach Connect-complete without an inbound entry point', () => {
  it('an http-api deployable with zero bindings is unsatisfied', () => {
    const deployables: DeployableEntryPointInput[] = [{ deployableId: 'dep.api', kind: 'http-api' }]
    const model = evaluateConnectEntryPoints(deployables, [])
    expect(model.allRequiredSatisfied).toBe(false)
    expect(model.requiredDeployableIds).toEqual(['dep.api'])
    expect(model.deployables[0]).toMatchObject({
      deployableId: 'dep.api',
      requiresEntryPoint: true,
      hasValidEntryPoint: false,
      satisfied: false,
    })
  })

  it('a cli/worker/browser/electron-main deployable likewise requires an entry point', () => {
    const kinds = ['cli', 'worker', 'browser', 'electron-main'] as const
    for (const kind of kinds) {
      const model = evaluateConnectEntryPoints([{ deployableId: `dep.${kind}`, kind }], [])
      expect(model.allRequiredSatisfied, kind).toBe(false)
    }
  })

  it('becomes satisfied once a valid (approved) binding targets the deployable', () => {
    const deployables: DeployableEntryPointInput[] = [{ deployableId: 'dep.api', kind: 'http-api' }]
    const bindings: InboundBindingEntryPointInput[] = [
      { bindingId: 'b1', deployableId: 'dep.api', operationId: 'op.show', operationVersion: '1.0.0', approved: true },
    ]
    const model = evaluateConnectEntryPoints(deployables, bindings)
    expect(model.allRequiredSatisfied).toBe(true)
    expect(model.deployables[0]?.satisfied).toBe(true)
  })

  it('a deployable classified embedded-library requires no entry point at all', () => {
    const model = evaluateConnectEntryPoints([{ deployableId: 'dep.lib', kind: 'embedded-library' }], [])
    expect(model.requiredDeployableIds).toEqual([])
    expect(model.allRequiredSatisfied).toBe(true)
    expect(model.deployables[0]).toMatchObject({ requiresEntryPoint: false, satisfied: true })
  })
})

describe('CAP-TEST-079 a deferred/unapproved deployable stays incomplete and visible', () => {
  it('a draft (unapproved) binding does not satisfy the requirement, but remains visible via bindingCount', () => {
    const deployables: DeployableEntryPointInput[] = [{ deployableId: 'dep.api', kind: 'http-api' }]
    const bindings: InboundBindingEntryPointInput[] = [
      { bindingId: 'b1', deployableId: 'dep.api', operationId: 'op.show', operationVersion: '1.0.0', approved: false },
    ]
    const model = evaluateConnectEntryPoints(deployables, bindings)
    expect(model.allRequiredSatisfied).toBe(false)
    const status = model.deployables[0]!
    expect(status.satisfied).toBe(false)
    // Visible: the draft binding is counted, not hidden, even though it is not yet valid.
    expect(status.bindingCount).toBe(1)
    expect(status.validBindingCount).toBe(0)
  })

  it('a deployable with no bindings at all is never silently marked complete', () => {
    const model = evaluateConnectEntryPoints([{ deployableId: 'dep.worker', kind: 'worker' }], [])
    expect(model.deployables[0]?.satisfied).toBe(false)
    expect(model.allRequiredSatisfied).toBe(false)
  })
})

describe('CAP-TEST-081 the same operation accepts multiple inbound bindings', () => {
  it('two approved bindings targeting the same operation id/version both count', () => {
    const deployables: DeployableEntryPointInput[] = [{ deployableId: 'dep.api', kind: 'http-api' }]
    const bindings: InboundBindingEntryPointInput[] = [
      { bindingId: 'b1', deployableId: 'dep.api', operationId: 'op.show', operationVersion: '1.0.0', approved: true },
      { bindingId: 'b2', deployableId: 'dep.api', operationId: 'op.show', operationVersion: '1.0.0', approved: true },
    ]
    const model = evaluateConnectEntryPoints(deployables, bindings)
    const status = model.deployables[0]!
    expect(status.bindingCount).toBe(2)
    expect(status.validBindingCount).toBe(2)
    expect(status.satisfied).toBe(true)
    expect(model.allRequiredSatisfied).toBe(true)
  })

  it('bindings on two different deployables for the same operation are both counted independently', () => {
    const deployables: DeployableEntryPointInput[] = [
      { deployableId: 'dep.api', kind: 'http-api' },
      { deployableId: 'dep.browser', kind: 'browser' },
    ]
    const bindings: InboundBindingEntryPointInput[] = [
      { bindingId: 'b1', deployableId: 'dep.api', operationId: 'op.show', operationVersion: '1.0.0', approved: true },
      { bindingId: 'b2', deployableId: 'dep.browser', operationId: 'op.show', operationVersion: '1.0.0', approved: true },
    ]
    const model = evaluateConnectEntryPoints(deployables, bindings)
    expect(model.allRequiredSatisfied).toBe(true)
    expect(model.deployables.every((d) => d.satisfied)).toBe(true)
  })
})

describe('new inbound bindings default to private exposure', () => {
  it('withDefaultExposure fills in private when exposure is omitted', () => {
    const filled = withDefaultExposure({ bindingId: 'b1' })
    expect(filled.exposure).toBe('private')
    expect(filled.exposure).toBe(DEFAULT_INBOUND_EXPOSURE)
  })

  it('withDefaultExposure never overrides an explicit exposure', () => {
    const filled = withDefaultExposure({ bindingId: 'b1', exposure: 'public' as const })
    expect(filled.exposure).toBe('public')
  })

  it('a binding with omitted exposure is not flagged as elevated', () => {
    const model = evaluateConnectEntryPoints(
      [{ deployableId: 'dep.api', kind: 'http-api' }],
      [{ bindingId: 'b1', deployableId: 'dep.api', approved: true }],
    )
    expect(model.deployables[0]?.exposureElevated).toBe(false)
    expect(model.anyExposureElevated).toBe(false)
  })

  it('elevating exposure beyond private is surfaced visibly, not silently allowed', () => {
    const model = evaluateConnectEntryPoints(
      [{ deployableId: 'dep.api', kind: 'http-api' }],
      [{ bindingId: 'b1', deployableId: 'dep.api', approved: true, exposure: 'public' }],
    )
    expect(model.deployables[0]?.exposureElevated).toBe(true)
    expect(model.anyExposureElevated).toBe(true)
    // Elevation is visible, but does not by itself block the entry-point requirement.
    expect(model.deployables[0]?.satisfied).toBe(true)
  })
})

describe('a migrated frontend (ui) binding still counts as a valid UI inbound entry point', () => {
  it('frontendBindingToInboundBinding output satisfies the deployable requirement', () => {
    const legacy = frontendBindingFixture()
    const migrated = frontendBindingToInboundBinding(legacy, { deployableId: 'dep.browser' })
    expect(migrated.kind).toBe('ui')
    expect(migrated.exposure).toBe('private')

    const model = evaluateConnectEntryPoints(
      [{ deployableId: 'dep.browser', kind: 'browser' }],
      [
        {
          bindingId: migrated.bindingId,
          deployableId: migrated.deployableId,
          operationId: migrated.operationId,
          operationVersion: migrated.operationVersion,
          approved: true,
          exposure: migrated.exposure,
        },
      ],
    )
    expect(model.allRequiredSatisfied).toBe(true)
    expect(model.deployables[0]?.satisfied).toBe(true)
  })
})
