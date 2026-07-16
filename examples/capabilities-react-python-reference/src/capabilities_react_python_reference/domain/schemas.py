"""JSON Schema (Draft 2020-12) for the `place order` operation input.

This is the canonical source both languages honor: the exact same
property names, types, and `required`/`additionalProperties` shape are
mirrored, by hand, as the TypeScript `GeneratedSchemaDefinition` consumed
by `planOpenApiDocument` (see `src/generation/contract.ts`) and as the
plain JSON-Schema object AJV validates against on the TS side (see
`src/client/place-order-schema.ts`). CAP-TEST-069 asserts the two sides
agree on the same canonical fixture bytes (`fixtures/*.json`).
"""

from __future__ import annotations

from typing import Any, Mapping

PLACE_ORDER_INPUT_SCHEMA: Mapping[str, Any] = {
    "type": "object",
    "properties": {
        "customer_id": {"type": "string", "minLength": 1},
        "sku": {"type": "string", "minLength": 1},
        "quantity": {"type": "integer", "minimum": 1},
    },
    "required": ["customer_id", "sku", "quantity"],
    "additionalProperties": False,
}
