/**
 * The `place order` input JSON Schema (Draft 2020-12), hand-mirrored
 * byte-for-byte against the Python side's own literal
 * (`../../src/capabilities_react_python_reference/domain/schemas.py`
 * `PLACE_ORDER_INPUT_SCHEMA`) — the canonical schema CAP-TEST-069 proves
 * both languages' OWN validators (AJV here, `jsonschema.Draft202012Validator`
 * on the Python side, reached through a real HTTP round-trip to the live
 * host) accept/reject identically against the same canonical fixture bytes
 * (`../../fixtures/*.json`).
 *
 * This is validation-shape parity evidence, not a duplicate of the domain:
 * this example's React/TS client never re-implements
 * `PlaceOrderOperation`'s business logic (unknown-sku / insufficient-stock)
 * — only the Python host does. This schema exists purely to let the TS side
 * independently confirm "is this JSON well-formed input for the operation",
 * exactly as `dispatch`'s own JSON-Schema validation does on the Python
 * side before the operation ever runs.
 */
export const PLACE_ORDER_INPUT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    customer_id: { type: 'string', minLength: 1 },
    sku: { type: 'string', minLength: 1 },
    quantity: { type: 'integer', minimum: 1 },
  },
  required: ['customer_id', 'sku', 'quantity'],
  additionalProperties: false,
} as const
