import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { assembleGenerationPlan } from '../../src/capabilities/generationAssembly.js'
import type { DeployableSpecification, HttpInboundBinding, OperationContract } from '../../src/capabilities/types.js'

const roots: string[] = []
afterEach(() => { for (const root of roots) fs.rmSync(root, { recursive: true, force: true }); roots.length = 0 })

const operation: OperationContract = {
  schemaVersion: '1.0', operationId: 'weather.read', version: '1.0.0', behavior: 'query',
  inputSchemaRef: 'weather.input', outputSchemaRef: 'weather.output', preconditions: [], postconditions: [],
  domainRejections: ['not-found'], technicalErrors: ['unavailable'], sideEffects: [], idempotency: 'idempotent',
  timeoutClass: 'short', cancellable: true, artifactTypes: [], provenanceFields: [],
}
const binding: HttpInboundBinding = {
  schemaVersion: '1.0', kind: 'http', bindingId: 'binding.weather.http', version: '1.0.0', projectId: 'project-1',
  deployableId: 'python-api', operationId: operation.operationId, operationVersion: operation.version,
  inputMappings: [], outputMappings: [], validationBehavior: 'reject', domainRejectionBehavior: 'typed',
  technicalFailureBehavior: 'safe', timeoutBehavior: 'timed-out', cancellationBehavior: 'propagate', retryBehavior: 'none',
  duplicateSubmissionBehavior: 'none', exposure: 'private', generatedTargets: [], approvalState: 'approved', method: 'POST', path: '/weather',
}
const schemas = [
  { schemaId: 'weather.input', typeName: 'WeatherInput', schema: { kind: 'object' as const, properties: [{ name: 'station', schema: { kind: 'string' as const }, required: true }] } },
  { schemaId: 'weather.output', typeName: 'WeatherOutput', schema: { kind: 'object' as const, properties: [{ name: 'temperature', schema: { kind: 'number' as const }, required: true }] } },
]

function deployable(deployableId: string, kind: DeployableSpecification['kind'], runtimeLanguage: DeployableSpecification['runtimeLanguage']): DeployableSpecification {
  return {
    schemaVersion: '1.0', deployableId, name: deployableId, kind, runtimeLanguage, runtimeVersionRange: '>=22',
    moduleIds: ['module-1'], inboundBindingIds: [], compositionRootPath: `src/composition/${deployableId}.${runtimeLanguage === 'python' ? 'py' : 'ts'}`,
    commands: {}, configurationRefs: [], secretReferenceIds: [], proposedLocations: [],
  }
}

describe('CAP-TEST-114 mixed React/Python HTTP boundary generation', () => {
  it('emits backend OpenAPI and a typed browser client from the same operation and binding', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-mixed-boundary-'))
    roots.push(root)
    const backend = assembleGenerationPlan({
      deployable: deployable('python-api', 'http-api', 'python'), inboundBindings: [binding], operations: [operation], schemas,
      targetRoot: root, generatorVersion: '1.0.0', referenceProfileVersion: '1.0.0', planId: 'backend-plan', runId: 'backend-run',
    })
    expect(backend.virtualFiles.find((file) => file.path.endsWith('/openapi.g.json'))?.contents).toContain('"/weather"')

    const browser = assembleGenerationPlan({
      deployable: deployable('browser', 'browser', 'typescript'), inboundBindings: [], remoteHttpBindings: [binding],
      operations: [operation], schemas, modules: [{ projectId: 'project-1' } as never],
      targetRoot: root, generatorVersion: '1.0.0', referenceProfileVersion: '1.0.0', planId: 'browser-plan', runId: 'browser-run',
    })
    const client = browser.virtualFiles.find((file) => file.path.endsWith('/clients/remote-http.g.ts'))?.contents ?? ''
    expect(client).toContain('export async function bindingWeatherHttpClient')
    expect(client).toContain('input: WeatherReadV1_0_0Input')
    expect(client).toContain('new URL("/weather", options.baseUrl)')
    expect(client).toContain('Promise<Outcome<WeatherReadV1_0_0Success')
    expect(client).toContain('body as unknown as Outcome<WeatherReadV1_0_0Success')
    expect(client).not.toMatch(/body as Outcome</)
  })
})
