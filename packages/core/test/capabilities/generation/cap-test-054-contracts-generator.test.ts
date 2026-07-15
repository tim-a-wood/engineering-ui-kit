/**
 * CAP-TEST-054 (WP3B-gen generator slice of the CAP-TEST-054..061 WP3B gate;
 * CAP-TEST-057..061 cover the executable-slices packet's end-to-end HTTP/
 * CLI/schedule/React/Electron triggers, out of scope here) — `contracts.ts`
 * planning is deterministic under shuffled-equivalent input and structurally
 * correct: declared types, operation interfaces, do-not-edit header, and
 * frozen operation id/version references.
 */
import { describe, expect, it } from 'vitest'
import {
  planContractTypes,
  type ContractsGenerationInput,
  type GeneratedSchemaDefinition,
} from '../../../src/capabilities/generation/contracts.js'
import type { OperationContract } from '../../../src/capabilities/types.js'

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
    domainRejections: ['sku-not-found', 'sku-out-of-stock'],
    technicalErrors: ['inventory-service-unavailable'],
    sideEffects: [],
    idempotency: 'non-idempotent',
    timeoutClass: 'short',
    cancellable: true,
    artifactTypes: [],
    provenanceFields: [],
  },
]

function buildInput(): ContractsGenerationInput {
  return {
    generatorVersion: '0.1.0',
    referenceProfileVersion: '1.0.0',
    schemas: SCHEMAS,
    operations: OPERATIONS,
    typesFilePath: 'src/generated/orders/types.g.ts',
    operationsFilePath: 'src/generated/orders/operations.g.ts',
  }
}

describe('CAP-TEST-054 contracts.ts generator', () => {
  it('is deterministic: shuffled schemas/operations/enum arrays yield byte-identical virtual files', () => {
    const forward = planContractTypes(buildInput())

    const shuffled: ContractsGenerationInput = {
      ...buildInput(),
      schemas: [...SCHEMAS].reverse().map((schema) =>
        schema.schema.kind === 'object' ? { ...schema, schema: { ...schema.schema, properties: [...schema.schema.properties].reverse() } } : schema,
      ),
      operations: [...OPERATIONS].reverse().map((operation) => ({
        ...operation,
        domainRejections: [...operation.domainRejections].reverse(),
        technicalErrors: [...operation.technicalErrors].reverse(),
      })),
    }
    const reversed = planContractTypes(shuffled)

    expect(JSON.stringify(reversed)).toBe(JSON.stringify(forward))
  })

  it('emits a do-not-edit header on both files', () => {
    const result = planContractTypes(buildInput())
    expect(result.typesFile.contents).toContain('GENERATED FILE — DO NOT EDIT.')
    expect(result.operationsFile.contents).toContain('GENERATED FILE — DO NOT EDIT.')
  })

  it('emits correct type declarations from the canonical schemas, with required/optional distinguished', () => {
    const result = planContractTypes(buildInput())
    expect(result.typesFile.contents).toContain('export interface CreateOrderSuccess {')
    expect(result.typesFile.contents).toContain('orderId: string')
    expect(result.typesFile.contents).toContain('total?: number')
    expect(result.typesFile.contents).toContain('export interface CreateOrderInput {')
    expect(result.typesFile.contents).toContain('sku: string')
  })

  it('emits an operation interface and typed-outcome alias referencing the frozen operation id and version', () => {
    const result = planContractTypes(buildInput())
    const contents = result.operationsFile.contents
    expect(contents).toContain("import type { Operation, Outcome } from '@engineering-ui-kit/capabilities-runtime'")
    expect(contents).toContain('// orders.create v1.0.0 (command)')
    expect(contents).toContain('export type OrdersCreateV1_0_0Input = CreateOrderInput')
    expect(contents).toContain('export type OrdersCreateV1_0_0Success = CreateOrderSuccess')
    expect(contents).toContain('export type OrdersCreateV1_0_0DomainRejectionCode = "sku-not-found" | "sku-out-of-stock"')
    expect(contents).toContain('export type OrdersCreateV1_0_0TechnicalErrorCode = "inventory-service-unavailable"')
    expect(contents).toContain(
      'export type OrdersCreateV1_0_0Outcome = Outcome<OrdersCreateV1_0_0Success, OrdersCreateV1_0_0DomainRejectionCode, OrdersCreateV1_0_0TechnicalErrorCode>',
    )
    expect(contents).toContain('export interface OrdersCreateV1_0_0Operation extends Operation<')
    expect(contents).toContain('readonly code: "orders.create"')
  })

  it('flags an unresolved schema reference as a diagnostic and falls back to "unknown" rather than throwing', () => {
    const input: ContractsGenerationInput = {
      ...buildInput(),
      operations: [{ ...OPERATIONS[0]!, inputSchemaRef: 'schema.does-not-exist' }],
    }
    const result = planContractTypes(input)
    expect(result.diagnostics.some((message) => message.includes('schema.does-not-exist'))).toBe(true)
    expect(result.operationsFile.contents).toContain('export type OrdersCreateV1_0_0Input = unknown')
  })

  it('an operation with no domain rejections or technical errors uses "never" for those code unions', () => {
    const input: ContractsGenerationInput = {
      ...buildInput(),
      operations: [{ ...OPERATIONS[0]!, domainRejections: [], technicalErrors: [] }],
    }
    const result = planContractTypes(input)
    expect(result.operationsFile.contents).toContain('export type OrdersCreateV1_0_0DomainRejectionCode = never')
    expect(result.operationsFile.contents).toContain('export type OrdersCreateV1_0_0TechnicalErrorCode = never')
  })
})
