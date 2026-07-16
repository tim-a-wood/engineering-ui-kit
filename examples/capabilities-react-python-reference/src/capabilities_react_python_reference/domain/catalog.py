"""A tiny, fixed in-memory product catalog. Deterministic: no I/O, no
clock, no randomness — the same catalog every time the process starts.

Mirrors `examples/capabilities-python-reference`'s catalog exactly, so the
`PlaceOrderOperation` domain rejections this cross-language slice exercises
(`unknown_sku`, `insufficient_stock`) are reachable the same way.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping, Optional


@dataclass(frozen=True)
class CatalogItem:
    price_cents: int
    stock: int


class Catalog:
    """Read-only product lookup. Deliberately in-memory and tiny: this is
    a reference app proving runtime traversal, not a real inventory
    system.
    """

    def __init__(self, items: Mapping[str, CatalogItem]) -> None:
        self._items: dict[str, CatalogItem] = dict(items)

    def get(self, sku: str) -> Optional[CatalogItem]:
        return self._items.get(sku)

    @classmethod
    def default(cls) -> "Catalog":
        """The reference catalog used by the HTTP host in this example.
        `out-of-stock-gizmo` exists (a known SKU) but has zero stock, so
        the domain rejection path (`insufficient_stock`) is reachable
        without needing an unknown SKU.
        """

        return cls(
            {
                "widget": CatalogItem(price_cents=1_999, stock=50),
                "gadget": CatalogItem(price_cents=4_999, stock=10),
                "out-of-stock-gizmo": CatalogItem(price_cents=999, stock=0),
            }
        )
