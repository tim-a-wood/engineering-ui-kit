import { describe, expect, it } from 'vitest'
import { planPythonCompositionRootModule } from '../../../src/capabilities/generation/python.js'
import type { CompositionManifest } from '../../../src/capabilities/types.js'

function manifest(): CompositionManifest {
  return {
    schemaVersion: '1.0', projectId: 'project-1', compositionId: 'http-api',
    applicationRevision: '1', architectureRevision: '1', deployableIds: ['http-api'],
    registrations: [
      {
        contractId: 'orders.repository', implementationTarget: 'src/domain/orders/repository.py#create_repository',
        lifecycle: 'request-job', providerModuleId: 'mod.orders', dependencies: [],
      },
      {
        contractId: 'orders.create', implementationTarget: 'src/domain/orders/create.py#create_operation',
        lifecycle: 'request-job', providerModuleId: 'mod.orders', dependencies: ['orders.repository'],
      },
    ],
    operationRoutes: [{ operationId: 'orders.create', operationVersion: '1.0.0', inboundBindingId: 'binding.orders.http' }],
    inboundAdapterRefs: ['binding.orders.http'], outboundAdapterRefs: [], configurationRefs: [], secretReferenceIds: [],
    telemetryHookRefs: [], healthHookRefs: [], authorizationHookRefs: [], compositionHash: 'composition-hash',
  }
}

describe('CAP-TEST-111 Python composition-root generation', () => {
  it('emits deterministic explicit imports, registrations, dependency resolution, and routes', () => {
    const input = {
      manifest: manifest(), generatorVersion: '1.0.0', referenceProfileVersion: '1.0.0',
      filePath: 'src/composition/http_api_g.py',
    }
    const result = planPythonCompositionRootModule(input)
    const reversed = planPythonCompositionRootModule({
      ...input,
      manifest: { ...manifest(), registrations: [...manifest().registrations].reverse() },
    })
    expect(result.issues).toEqual([])
    expect(reversed.file.contents).toBe(result.file.contents)
    expect(result.file.contents).toContain('from engineering_ui_capabilities_runtime.core import Container')
    expect(result.file.contents).toContain('from src.domain.orders.create import create_operation')
    expect(result.file.contents).toContain('ORDERS_CREATE_KEY = "orders.create"')
    expect(result.file.contents).toContain('container.register_request_job(')
    expect(result.file.contents).toContain('lambda resolver: create_operation(resolver.resolve(ORDERS_REPOSITORY_KEY))')
    expect(result.file.contents).toContain('def build_http_api_container() -> Container:')
    expect(result.file.contents).toContain('("binding.orders.http", "orders.create", "1.0.0")')
  })
})
