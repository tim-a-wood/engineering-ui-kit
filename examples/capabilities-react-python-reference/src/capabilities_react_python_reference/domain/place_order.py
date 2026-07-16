"""The reference domain operation: `PlaceOrderOperation`.

Implements the runtime's `Operation` protocol (`execute(input, context) ->
Outcome`) directly. It has exactly one success path and two domain
rejection paths (not exceptions — normal `Outcome.rejected` returns, per
CAP-ERA-001 §10.1):

- `unknown_sku`: the requested SKU is not in the catalog.
- `insufficient_stock`: the SKU exists but there is not enough stock.

This is the ONLY domain/business logic in this cross-language slice: the
React/TypeScript side (`src/client/**`, `src/react/**`) never re-implements
any of it — it only speaks the generated HTTP/OpenAPI boundary.
"""

from __future__ import annotations

from typing import Any

from engineering_ui_capabilities_runtime.core import AnyOutcome, Context, Outcome

from .catalog import Catalog
from .order_store import OrderStore


class PlaceOrderOperation:
    def __init__(self, catalog: Catalog, orders: OrderStore) -> None:
        self._catalog = catalog
        self._orders = orders

    def execute(self, input: dict[str, Any], context: Context) -> AnyOutcome:
        sku = input["sku"]
        quantity = input["quantity"]

        item = self._catalog.get(sku)
        if item is None:
            return Outcome.rejected(code="unknown_sku", details={"sku": sku})

        if quantity > item.stock:
            return Outcome.rejected(
                code="insufficient_stock",
                details={"sku": sku, "requested": quantity, "available": item.stock},
            )

        order_id = self._orders.next_order_id()
        total_cents = item.price_cents * quantity
        order = {
            "order_id": order_id,
            "customer_id": input["customer_id"],
            "sku": sku,
            "quantity": quantity,
            "unit_price_cents": item.price_cents,
            "total_cents": total_cents,
        }
        self._orders.record(order)
        return Outcome.success(order)
