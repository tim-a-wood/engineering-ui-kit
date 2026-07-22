/**
 * CAP-TEST-055 (WP3B-gen generator slice of the CAP-TEST-054..061 WP3B gate)
 * — `composition.ts` registration validation (unambiguous provider
 * resolution, no forbidden cycles, no undeclared dependencies, unambiguous
 * inbound-route resolution) and composition-root TS planning are
 * deterministic under shuffled-equivalent input and structurally correct.
 */
import { describe, expect, it } from 'vitest'
import {
  planCompositionRootModule,
  validateComposition,
  type CompositionRootModuleInput,
} from '../../../src/capabilities/generation/composition.js'
import type { CompositionManifest } from '../../../src/capabilities/types.js'

function buildManifest(overrides: Partial<CompositionManifest> = {}): CompositionManifest {
  return {
    schemaVersion: '1.0',
    projectId: 'proj-1',
    compositionId: 'http-api',
    applicationRevision: '1',
    architectureRevision: '1',
    deployableIds: ['http-api'],
    registrations: [
      {
        contractId: 'orders.repository',
        implementationTarget: 'src/domain/orders/repository.ts#createOrdersRepository',
        lifecycle: 'singleton',
        providerModuleId: 'mod.domain.orders',
        dependencies: [],
      },
      {
        contractId: 'orders.service',
        implementationTarget: 'src/domain/orders/service.ts#createOrdersService',
        lifecycle: 'request-job',
        providerModuleId: 'mod.domain.orders',
        dependencies: ['orders.repository'],
      },
    ],
    operationRoutes: [{ operationId: 'orders.create', operationVersion: '1.0.0', inboundBindingId: 'binding.orders.create.http' }],
    inboundAdapterRefs: ['binding.orders.create.http'],
    outboundAdapterRefs: [],
    configurationRefs: [],
    secretReferenceIds: [],
    telemetryHookRefs: [],
    healthHookRefs: [],
    authorizationHookRefs: [],
    compositionHash: 'composition-hash-1',
    ...overrides,
  }
}

function buildRootInput(manifest: CompositionManifest): CompositionRootModuleInput {
  return {
    manifest,
    generatorVersion: '0.1.0',
    referenceProfileVersion: '1.0.0',
    filePath: 'src/composition/http-api.g.ts',
  }
}

describe('CAP-TEST-055 composition.ts validation', () => {
  it('a clean acyclic manifest is valid with no issues', () => {
    const result = validateComposition(buildManifest())
    expect(result.valid).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('detects an ambiguous provider: two registrations for the same contractId', () => {
    const manifest = buildManifest({
      registrations: [
        ...buildManifest().registrations,
        {
          contractId: 'orders.repository',
          implementationTarget: 'src/domain/orders/repository-alt.ts#createAltRepository',
          lifecycle: 'singleton',
          providerModuleId: 'mod.domain.orders',
          dependencies: [],
        },
      ],
    })
    const result = validateComposition(manifest)
    expect(result.valid).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'ambiguous-provider' && issue.message.includes('orders.repository'))).toBe(true)
  })

  it('detects a forbidden dependency cycle', () => {
    const manifest = buildManifest({
      registrations: [
        {
          contractId: 'a',
          implementationTarget: 'src/a.ts#createA',
          lifecycle: 'singleton',
          providerModuleId: 'mod.a',
          dependencies: ['b'],
        },
        {
          contractId: 'b',
          implementationTarget: 'src/b.ts#createB',
          lifecycle: 'singleton',
          providerModuleId: 'mod.b',
          dependencies: ['a'],
        },
      ],
    })
    const result = validateComposition(manifest)
    expect(result.valid).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'forbidden-cycle')).toBe(true)
  })

  it('detects a dependency on an undeclared contractId', () => {
    const manifest = buildManifest({
      registrations: [
        {
          contractId: 'orders.service',
          implementationTarget: 'src/domain/orders/service.ts#createOrdersService',
          lifecycle: 'singleton',
          providerModuleId: 'mod.domain.orders',
          dependencies: ['orders.repository'],
        },
      ],
    })
    const result = validateComposition(manifest)
    expect(result.valid).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'undeclared-dependency')).toBe(true)
  })

  it('detects an ambiguous inbound route: one bindingId resolving to two operation/version combinations', () => {
    const manifest = buildManifest({
      operationRoutes: [
        { operationId: 'orders.create', operationVersion: '1.0.0', inboundBindingId: 'binding.orders.create.http' },
        { operationId: 'orders.update', operationVersion: '2.0.0', inboundBindingId: 'binding.orders.create.http' },
      ],
    })
    const result = validateComposition(manifest)
    expect(result.valid).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'ambiguous-inbound-route')).toBe(true)
  })

  it('validation issues are deterministic under shuffled registration/route order', () => {
    const manifest = buildManifest()
    const shuffled = buildManifest({
      registrations: [...manifest.registrations].reverse(),
      operationRoutes: [...manifest.operationRoutes].reverse(),
    })
    expect(JSON.stringify(validateComposition(manifest))).toBe(JSON.stringify(validateComposition(shuffled)))
  })
})

describe('CAP-TEST-055 composition.ts composition-root planning', () => {
  it('is deterministic: shuffled registrations/dependencies/routes yield a byte-identical virtual file', () => {
    const manifest = buildManifest()
    const forward = planCompositionRootModule(buildRootInput(manifest))

    const shuffled = buildManifest({
      registrations: [...manifest.registrations].reverse().map((registration) => ({ ...registration, dependencies: [...registration.dependencies].reverse() })),
      operationRoutes: [...manifest.operationRoutes].reverse(),
    })
    const reversed = planCompositionRootModule(buildRootInput(shuffled))

    expect(JSON.stringify(reversed)).toBe(JSON.stringify(forward))
  })

  it('emits a do-not-edit header, LifecycleContainer imports, one ServiceToken per contractId, and lifecycle-correct registrations', () => {
    const result = planCompositionRootModule(buildRootInput(buildManifest()))
    const contents = result.file.contents
    expect(contents).toContain('GENERATED FILE — DO NOT EDIT.')
    expect(contents).toContain("import { LifecycleContainer, createToken } from '@engineering-ui-kit/capabilities-runtime'")
    expect(contents).toContain('export const ordersRepositoryToken: ServiceToken<ReturnType<typeof createOrdersRepository>> = createToken("orders.repository")')
    expect(contents).toContain('export const ordersServiceToken: ServiceToken<ReturnType<typeof createOrdersService>> = createToken("orders.service")')
    expect(contents).toContain('lifecycle: "singleton"')
    expect(contents).toContain('lifecycle: "request-job"')
    expect(contents).toContain('factory: (scope: ResolutionContext) => createOrdersService(scope.resolve(ordersRepositoryToken))')
    expect(contents).toContain('export function buildHttpApiContainer(): LifecycleContainer {')
    expect(contents).toContain("import { createOrdersRepository } from '../domain/orders/repository.js'")
    expect(contents).toContain("import { createOrdersService } from '../domain/orders/service.js'")
  })

  it('references the frozen operation id/version from operationRoutes in an explicit route table', () => {
    const result = planCompositionRootModule(buildRootInput(buildManifest()))
    const contents = result.file.contents
    expect(contents).toContain('export const httpApiOperationRoutes')
    expect(contents).toContain('inboundBindingId: "binding.orders.create.http"')
    expect(contents).toContain('operationId: "orders.create"')
    expect(contents).toContain('operationVersion: "1.0.0"')
  })

  it('always emits a file even when the manifest has validation issues, surfacing them separately', () => {
    const manifest = buildManifest({
      registrations: [
        ...buildManifest().registrations,
        {
          contractId: 'orders.repository',
          implementationTarget: 'src/domain/orders/repository-alt.ts#createAltRepository',
          lifecycle: 'singleton',
          providerModuleId: 'mod.domain.orders',
          dependencies: [],
        },
      ],
    })
    const result = planCompositionRootModule(buildRootInput(manifest))
    expect(result.file.contents.length).toBeGreaterThan(0)
    expect(result.issues.some((issue) => issue.code === 'ambiguous-provider')).toBe(true)
  })
})
