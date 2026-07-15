"""An in-memory, deterministic order ledger. Order IDs are a simple
monotonic sequence — no wall clock or randomness involved — so composing
this store's state into an assertion never introduces test flakiness.
"""

from __future__ import annotations

from typing import Any, List


class OrderStore:
    def __init__(self) -> None:
        self._next_sequence = 1
        self._placed: List[dict[str, Any]] = []

    def next_order_id(self) -> str:
        order_id = f"order-{self._next_sequence:06d}"
        self._next_sequence += 1
        return order_id

    def record(self, order: dict[str, Any]) -> None:
        self._placed.append(order)

    @property
    def placed(self) -> List[dict[str, Any]]:
        return list(self._placed)
