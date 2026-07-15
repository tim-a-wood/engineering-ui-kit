/**
 * CAP-TEST-064 (WP4B-gen generator slice) — `python.ts`'s
 * `planOpenApiDocument` planning is deterministic under shuffled-equivalent
 * input and emits a structurally correct OpenAPI 3.1 document (JSON): the
 * `openapi: 3.1.x` version marker, one path per `http` `InboundBinding`, and
 * component schemas for every canonical schema — the same boundary a
 * browser/TS client and the Python FastAPI host share.
 */
import { describe, expect, it } from 'vitest'
import type { GeneratedSchemaDefinition } from '../../../src/capabilities/generation/contracts.js'
import { planOpenApiDocument, type OpenApiGenerationInput } from '../../../src/capabilities/generation/python.js'
import type { HttpInboundBinding, OperationContract } from '../../../src/capabilities/types.js'

const SCHEMAS: GeneratedSchemaDefinition[] = [
  {
    schemaId: 'schema.orders.create.output',
    typeName: 'CreateOrderSuccess',
    schema: {
      kind: 'object',
      properties: [
        { name: 'orderId', schema: { kind: 'string' }, required: true },
        { name: 'total', schema: { kind: 'number' } },
      ],
    },
  },
  {
    schemaId: 'schema.orders.create.input',
    typeName: 'CreateOrderInput',
    schema: {
      kind: 'object',
      properties: [{ name: 'sku', schema: { kind: 'string' }, required: true }],
    },
  },
]

const OPERATIONS: OperationContract[] = [
  {
    schemaVersion: '1.0',
    operationId: 'orders.create',
    version: '1.0.0',
    behavior: 'command',
    inputSchemaRef: 'schema.orders.create.input',
    outputSchemaRef: 'schema.orders.create.output',
    preconditions: [],
    postconditions: [],
    domainRejections: ['sku-not-found'],
    technicalErrors: ['inventory-service-unavailable'],
    sideEffects: [],
    idempotency: 'non-idempotent',
    timeoutClass: 'short',
    cancellable: true,
    artifactTypes: [],
    provenanceFields: [],
  },
]

const HTTP_BINDINGS: HttpInboundBinding[] = [
  {
    schemaVersion: '1.0',
    bindingId: 'binding.orders.create.http',
    version: '1.0.0',
    projectId: 'proj-1',
    deployableId: 'python-api',
    operationId: 'orders.create',
    operationVersion: '1.0.0',
    inputMappings: [],
    outputMappings: [],
    validationBehavior: 'reject-with-details',
    domainRejectionBehavior: 'return-typed',
    technicalFailureBehavior: 'safe-message-only',
    timeoutBehavior: 'return-timed-out',
    cancellationBehavior: 'propagate',
    retryBehavior: 'none',
    duplicateSubmissionBehavior: 'none',
    exposure: 'protected',
    generatedTargets: [],
    approvalState: 'approved',
    kind: 'http',
    method: 'POST',
    path: '/orders',
  },
]

function buildInput(): OpenApiGenerationInput {
  return {
    generatorVersion: '0.1.0',
    referenceProfileVersion: '1.0.0',
    title: 'Orders API',
    apiVersion: '1.0.0',
    schemas: SCHEMAS,
    operations: OPERATIONS,
    httpBindings: HTTP_BINDINGS,
    documentFilePath: 'src/generated/openapi.json',
  }
}

describe('CAP-TEST-064 python.ts OpenAPI 3.1 generator', () => {
  it('is deterministic: shuffled schemas/operations/bindings/properties yield byte-identical output', () => {
    const forward = planOpenApiDocument(buildInput())
    const shuffled: OpenApiGenerationInput = {
      ...buildInput(),
      schemas: [...SCHEMAS].reverse().map((schema) =>
        schema.schema.kind === 'object' ? { ...schema, schema: { ...schema.schema, properties: [...schema.schema.properties].reverse() } } : schema,
      ),
      operations: [...OPERATIONS].reverse(),
      httpBindings: [...HTTP_BINDINGS].reverse(),
    }
    const reversed = planOpenApiDocument(shuffled)
    expect(JSON.stringify(reversed)).toBe(JSON.stringify(forward))
  })

  it('emits a top-level "openapi: 3.1.x" version marker', () => {
    const result = planOpenApiDocument(buildInput())
    expect(result.document.openapi).toMatch(/^3\.1\.\d+$/)
    expect(result.file.contents).toContain('"openapi": "3.1.0"')
  })

  it('emits one path per http binding, wired to the operation input/output component schemas', () => {
    const result = planOpenApiDocument(buildInput())
    const document = result.document as { paths: Record<string, Record<string, unknown>> }
    expect(Object.keys(document.paths)).toEqual(['/orders'])
    const postOp = document.paths['/orders']!.post as {
      requestBody: { content: { 'application/json': { schema: { $ref: string } } } }
      responses: { '200': { content: { 'application/json': { schema: { $ref: string } } } } }
    }
    expect(postOp.requestBody.content['application/json'].schema.$ref).toBe('#/components/schemas/CreateOrderInput')
    expect(postOp.responses['200'].content['application/json'].schema.$ref).toBe('#/components/schemas/CreateOrderSuccess')
  })

  it('emits component schemas for every canonical schema, with required/optional distinguished', () => {
    const result = planOpenApiDocument(buildInput())
    const document = result.document as { components: { schemas: Record<string, { type: string; properties: Record<string, unknown>; required?: string[] }> } }
    const successSchema = document.components.schemas.CreateOrderSuccess!
    expect(successSchema.type).toBe('object')
    expect(successSchema.required).toEqual(['orderId'])
    expect(successSchema.properties.orderId).toEqual({ type: 'string' })
    expect(successSchema.properties.total).toEqual({ type: 'number' })
    const inputSchema = document.components.schemas.CreateOrderInput!
    expect(inputSchema.required).toEqual(['sku'])
  })

  it('the emitted file contents are valid JSON that round-trips to the same document', () => {
    const result = planOpenApiDocument(buildInput())
    expect(JSON.parse(result.file.contents)).toEqual(result.document)
  })

  it('flags an http binding routing to an unknown operation as a diagnostic and skips its path rather than throwing', () => {
    const input: OpenApiGenerationInput = {
      ...buildInput(),
      httpBindings: [{ ...HTTP_BINDINGS[0]!, operationVersion: '9.9.9' }],
    }
    const result = planOpenApiDocument(input)
    expect(result.diagnostics.some((message) => message.includes('9.9.9'))).toBe(true)
    expect(Object.keys((result.document as { paths: Record<string, unknown> }).paths)).toEqual([])
  })
})
