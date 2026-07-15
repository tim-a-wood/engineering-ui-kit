"""JSON Schema (Draft 2020-12) for the `place order` operation input.
Shared verbatim by every host (HTTP request body, CLI-built input, and the
scheduled job's synthesized input) so `dispatch` validates the exact same
contract everywhere.
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
