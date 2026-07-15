/**
 * CAP-TEST-062 (WP4B-gen generator slice) — `python.ts`'s Pydantic v2 model
 * (`planPythonModels`) and operation `Protocol` (`planPythonProtocols`)
 * planning is deterministic under shuffled-equivalent input and
 * structurally correct: PascalCase `BaseModel` classes, snake_case fields
 * with `Field(alias=...)` when needed, `Literal[...]` enums, do-not-edit
 * header, and frozen operation id/version references.
 */
import { describe, expect, it } from 'vitest'
import type { GeneratedSchemaDefinition } from '../../../src/capabilities/generation/contracts.js'
import {
  planPythonModels,
  planPythonProtocols,
  type PythonModelsGenerationInput,
  type PythonProtocolsGenerationInput,
} from '../../../src/capabilities/generation/python.js'
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
      properties: [
        { name: 'sku', schema: { kind: 'string' }, required: true },
        { name: 'quantity', schema: { kind: 'integer' }, required: true },
      ],
    },
  },
  {
    schemaId: 'schema.orders.status',
    typeName: 'OrderStatus',
    schema: { kind: 'string', enumValues: ['pending', 'shipped', 'cancelled'] },
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

function buildModelsInput(): PythonModelsGenerationInput {
  return {
    generatorVersion: '0.1.0',
    referenceProfileVersion: '1.0.0',
    schemas: SCHEMAS,
    modelsFilePath: 'src/generated/orders/models_generated.py',
  }
}

function buildProtocolsInput(): PythonProtocolsGenerationInput {
  return {
    generatorVersion: '0.1.0',
    referenceProfileVersion: '1.0.0',
    schemas: SCHEMAS,
    operations: OPERATIONS,
    protocolsFilePath: 'src/generated/orders/protocols_generated.py',
    modelsFilePath: 'src/generated/orders/models_generated.py',
  }
}

describe('CAP-TEST-062 python.ts model + protocol generator', () => {
  it('planPythonModels is deterministic: shuffled schemas/properties/enum values yield byte-identical output', () => {
    const forward = planPythonModels(buildModelsInput())
    const shuffled: PythonModelsGenerationInput = {
      ...buildModelsInput(),
      schemas: [...SCHEMAS].reverse().map((schema) =>
        schema.schema.kind === 'object'
          ? { ...schema, schema: { ...schema.schema, properties: [...schema.schema.properties].reverse() } }
          : schema.schema.kind === 'string'
            ? { ...schema, schema: { ...schema.schema, enumValues: [...(schema.schema.enumValues ?? [])].reverse() } }
            : schema,
      ),
    }
    const reversed = planPythonModels(shuffled)
    expect(JSON.stringify(reversed)).toBe(JSON.stringify(forward))
  })

  it('planPythonProtocols is deterministic: shuffled operations/domainRejections/technicalErrors yield byte-identical output', () => {
    const forward = planPythonProtocols(buildProtocolsInput())
    const shuffled: PythonProtocolsGenerationInput = {
      ...buildProtocolsInput(),
      operations: [...OPERATIONS].reverse().map((operation) => ({
        ...operation,
        domainRejections: [...operation.domainRejections].reverse(),
        technicalErrors: [...operation.technicalErrors].reverse(),
      })),
    }
    const reversed = planPythonProtocols(shuffled)
    expect(JSON.stringify(reversed)).toBe(JSON.stringify(forward))
  })

  it('emits a do-not-edit header on both files', () => {
    const modelsResult = planPythonModels(buildModelsInput())
    const protocolsResult = planPythonProtocols(buildProtocolsInput())
    expect(modelsResult.file.contents).toContain('# GENERATED FILE — DO NOT EDIT.')
    expect(protocolsResult.file.contents).toContain('# GENERATED FILE — DO NOT EDIT.')
  })

  it('emits PascalCase BaseModel classes with snake_case fields, required vs Optional, and aliasing for non-snake_case property names', () => {
    const result = planPythonModels(buildModelsInput())
    const contents = result.file.contents
    expect(contents).toContain('from pydantic import BaseModel, ConfigDict, Field')
    expect(contents).toContain('class CreateOrderSuccess(BaseModel):')
    expect(contents).toContain('model_config = ConfigDict(populate_by_name=True)')
    expect(contents).toContain('order_id: str = Field(alias="orderId")')
    expect(contents).toContain('total: Optional[float] = None')
    expect(contents).toContain('class CreateOrderInput(BaseModel):')
    expect(contents).toContain('sku: str')
    expect(contents).toContain('quantity: int')
  })

  it('emits a Literal[...] TypeAlias for a top-level string-enum schema', () => {
    const result = planPythonModels(buildModelsInput())
    expect(result.file.contents).toContain('OrderStatus: TypeAlias = Literal["cancelled", "pending", "shipped"]')
  })

  it('a schema with no properties emits an empty BaseModel with a "pass" body', () => {
    const input: PythonModelsGenerationInput = {
      ...buildModelsInput(),
      schemas: [{ schemaId: 'schema.empty', typeName: 'Empty', schema: { kind: 'object', properties: [] } }],
    }
    const result = planPythonModels(input)
    expect(result.file.contents).toContain('class Empty(BaseModel):\n    pass')
  })

  it('emits a Protocol class and typed-outcome TypeAlias referencing the frozen operation id/version', () => {
    const result = planPythonProtocols(buildProtocolsInput())
    const contents = result.file.contents
    expect(contents).toContain('from engineering_ui_capabilities_runtime.core import Cancelled, Context, Failed, Rejected, Success, TimedOut')
    expect(contents).toContain('from src.generated.orders.models_generated import CreateOrderInput, CreateOrderSuccess')
    expect(contents).toContain('# orders.create v1.0.0 (command)')
    expect(contents).toContain('OrdersCreateV1_0_0Input: TypeAlias = CreateOrderInput')
    expect(contents).toContain('OrdersCreateV1_0_0Success: TypeAlias = CreateOrderSuccess')
    expect(contents).toContain('OrdersCreateV1_0_0DomainRejectionCode: TypeAlias = Literal["sku-not-found", "sku-out-of-stock"]')
    expect(contents).toContain('OrdersCreateV1_0_0TechnicalErrorCode: TypeAlias = Literal["inventory-service-unavailable"]')
    expect(contents).toContain(
      'OrdersCreateV1_0_0Outcome: TypeAlias = Union[Success[OrdersCreateV1_0_0Success], Rejected[OrdersCreateV1_0_0DomainRejectionCode], Failed, Cancelled, TimedOut]',
    )
    expect(contents).toContain('class OrdersCreateV1_0_0Operation(Protocol):')
    expect(contents).toContain('code: Literal["orders.create"]')
    expect(contents).toContain('def execute(self, input: OrdersCreateV1_0_0Input, context: Context) -> OrdersCreateV1_0_0Outcome: ...')
  })

  it('flags an unresolved schema reference as a diagnostic and falls back to "Any" rather than throwing', () => {
    const input: PythonProtocolsGenerationInput = {
      ...buildProtocolsInput(),
      operations: [{ ...OPERATIONS[0]!, inputSchemaRef: 'schema.does-not-exist' }],
    }
    const result = planPythonProtocols(input)
    expect(result.diagnostics.some((message) => message.includes('schema.does-not-exist'))).toBe(true)
    expect(result.file.contents).toContain('OrdersCreateV1_0_0Input: TypeAlias = Any')
  })

  it('an operation with no domain rejections or technical errors uses "Never" for those code aliases', () => {
    const input: PythonProtocolsGenerationInput = {
      ...buildProtocolsInput(),
      operations: [{ ...OPERATIONS[0]!, domainRejections: [], technicalErrors: [] }],
    }
    const result = planPythonProtocols(input)
    expect(result.file.contents).toContain('OrdersCreateV1_0_0DomainRejectionCode: TypeAlias = Never')
    expect(result.file.contents).toContain('OrdersCreateV1_0_0TechnicalErrorCode: TypeAlias = Never')
  })
})
