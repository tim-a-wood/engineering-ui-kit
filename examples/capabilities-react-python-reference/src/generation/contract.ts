/**
 * The canonical, frozen-shaped records for the `place order` operation:
 * the exact same source `planOpenApiDocument` (`packages/core/src/capabilities/generation/python.ts`)
 * consumes to plan the OpenAPI 3.1 document that is the boundary contract
 * both the React/TS client (`src/client/**`) and the live Python
 * `HttpOperationHost` (`../../src/capabilities_react_python_reference/http_app.py`)
 * honor (CAP-ERA-001 §5.3, §7.2, §11.1, §9 CAP-CONTRACT-004/CAP-CONTRACT-028).
 *
 * Hand-authored here (not loaded from a live CAP-CONTRACT-004/028 store)
 * because this is a standalone example, not a full coordinator-managed
 * project — but the SHAPE (property names, required/`additionalProperties`,
 * `path`/`method`) is deliberately kept byte-for-byte in sync with the
 * Python side's own literal JSON Schema
 * (`../../src/capabilities_react_python_reference/domain/schemas.py`
 * `PLACE_ORDER_INPUT_SCHEMA`) — CAP-TEST-069 asserts that sync holds.
 *
 * This module imports directly from `packages/core/src/**` by RELATIVE
 * path (not the `@engineering-ui-kit/core` package specifier): that
 * package's `exports` map only resolves `./dist/*` (a gitignored build
 * artifact, and `packages/core` is read-only for this packet), and
 * `capabilities/generation/**` is not part of its public subpath exports
 * at all yet. A relative import to the real, unmodified TypeScript source
 * is the same "resolve straight to source, no build step, no edits to the
 * read-only package" pattern already established for the runtime package
 * by `examples/capabilities-ts-reference/vitest.config.ts` — just applied
 * here as a plain relative import (no alias needed) since nothing else in
 * this repository imports `python.ts`'s generation helpers via a bare
 * package specifier today.
 */
import type { GeneratedSchemaDefinition } from '../../../../packages/core/src/capabilities/generation/contracts.js'
import type { HttpInboundBinding, OperationContract } from '../../../../packages/core/src/capabilities/types.js'

/** Matches `PLACE_ORDER_INPUT_SCHEMA` in `domain/schemas.py`. */
export const PLACE_ORDER_INPUT_SCHEMA_ID = 'schema.orders.place.input'
export const PLACE_ORDER_INPUT_TYPE_NAME = 'PlaceOrderInput'

/** Matches the `order` dict `PlaceOrderOperation.execute` returns on success. */
export const PLACE_ORDER_OUTPUT_SCHEMA_ID = 'schema.orders.place.output'
export const PLACE_ORDER_OUTPUT_TYPE_NAME = 'PlaceOrderSuccess'

export const PLACE_ORDER_OPERATION_ID = 'orders.place'
export const PLACE_ORDER_OPERATION_VERSION = '1.0.0'
export const PLACE_ORDER_HTTP_PATH = '/orders'
export const PLACE_ORDER_HTTP_METHOD = 'POST'

export const SCHEMAS: readonly GeneratedSchemaDefinition[] = [
  {
    schemaId: PLACE_ORDER_INPUT_SCHEMA_ID,
    typeName: PLACE_ORDER_INPUT_TYPE_NAME,
    schema: {
      kind: 'object',
      properties: [
        { name: 'customer_id', schema: { kind: 'string' }, required: true },
        { name: 'sku', schema: { kind: 'string' }, required: true },
        { name: 'quantity', schema: { kind: 'integer' }, required: true },
      ],
    },
  },
  {
    schemaId: PLACE_ORDER_OUTPUT_SCHEMA_ID,
    typeName: PLACE_ORDER_OUTPUT_TYPE_NAME,
    schema: {
      kind: 'object',
      properties: [
        { name: 'order_id', schema: { kind: 'string' }, required: true },
        { name: 'customer_id', schema: { kind: 'string' }, required: true },
        { name: 'sku', schema: { kind: 'string' }, required: true },
        { name: 'quantity', schema: { kind: 'integer' }, required: true },
        { name: 'unit_price_cents', schema: { kind: 'integer' }, required: true },
        { name: 'total_cents', schema: { kind: 'integer' }, required: true },
      ],
    },
  },
]

export const OPERATIONS: readonly OperationContract[] = [
  {
    schemaVersion: '1.0',
    operationId: PLACE_ORDER_OPERATION_ID,
    version: PLACE_ORDER_OPERATION_VERSION,
    behavior: 'command',
    inputSchemaRef: PLACE_ORDER_INPUT_SCHEMA_ID,
    outputSchemaRef: PLACE_ORDER_OUTPUT_SCHEMA_ID,
    preconditions: [],
    postconditions: [],
    domainRejections: ['unknown_sku', 'insufficient_stock'],
    technicalErrors: [],
    sideEffects: ['records-order-in-order-store'],
    idempotency: 'non-idempotent',
    timeoutClass: 'short',
    cancellable: false,
    artifactTypes: [],
    provenanceFields: [],
  },
]

export const HTTP_BINDINGS: readonly HttpInboundBinding[] = [
  {
    schemaVersion: '1.0',
    bindingId: 'binding.orders.place.http',
    version: '1.0.0',
    projectId: 'cap-era-wp4b-react-python',
    deployableId: 'capabilities-react-python-reference-http',
    operationId: PLACE_ORDER_OPERATION_ID,
    operationVersion: PLACE_ORDER_OPERATION_VERSION,
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
    method: PLACE_ORDER_HTTP_METHOD,
    path: PLACE_ORDER_HTTP_PATH,
  },
]
