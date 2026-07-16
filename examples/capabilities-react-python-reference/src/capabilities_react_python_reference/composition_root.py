"""The explicit composition root (CAP-ERA-001 §10.2): wires the domain's
`PlaceOrderOperation` and its dependencies through the runtime's
`Container`, and provides the `Context` factory the HTTP host uses.

This is the one place that knows about both the domain (`domain/*`) and
the runtime (`engineering_ui_capabilities_runtime.core`) — `http_app`
only imports from here plus the shared input schema, never constructs
`PlaceOrderOperation` directly.
"""

from __future__ import annotations

from engineering_ui_capabilities_runtime.core import Container, Context

from .domain.catalog import Catalog
from .domain.order_store import OrderStore
from .domain.place_order import PlaceOrderOperation

#: Registration key for the resolved `PlaceOrderOperation` instance.
PLACE_ORDER_OPERATION = "place_order_operation"

#: Registration keys for the operation's own dependencies, exposed so
#: tests can inspect state (e.g. `OrderStore.placed`) without reaching
#: around the container.
CATALOG = "catalog"
ORDER_STORE = "order_store"


def build_container() -> Container:
    """Builds one process-wide composition root. Every dependency is a
    `singleton` here: this reference app has no per-request state beyond
    what `Context` already carries.
    """

    container = Container()
    container.register_singleton(CATALOG, lambda c: Catalog.default())
    container.register_singleton(ORDER_STORE, lambda c: OrderStore())
    container.register_singleton(
        PLACE_ORDER_OPERATION,
        lambda c: PlaceOrderOperation(
            catalog=c.resolve(CATALOG),
            orders=c.resolve(ORDER_STORE),
        ),
    )
    return container


def make_context(correlation_id: str) -> Context:
    """The `Context` factory (§10.1): the HTTP host builds a `Context` this
    way, keyed only by the correlation ID the request-mapping layer already
    extracted (an HTTP header, or a generated one).
    """

    return Context(correlation_id=correlation_id)
