"""The explicit composition root (CAP-ERA-001 §10.2): wires the domain's
`PlaceOrderOperation` and its dependencies through the runtime's
`Container`, and provides the `Context` factory every host uses.

This is the one place that knows about both the domain (`domain/*`) and
the runtime (`engineering_ui_capabilities_runtime.core`) — hosts
(`http_app`, `cli_app`, `scheduled_app`) only import from here plus the
shared input schema, never construct `PlaceOrderOperation` directly.
"""

from __future__ import annotations

from engineering_ui_capabilities_runtime.core import Container, Context

from .domain.catalog import Catalog
from .domain.order_store import OrderStore
from .domain.place_order import PlaceOrderOperation

#: Registration key for the resolved `PlaceOrderOperation` instance.
PLACE_ORDER_OPERATION = "place_order_operation"

#: Registration keys for the operation's own dependencies, exposed so
#: tests/hosts can inspect state (e.g. `OrderStore.placed`) without
#: reaching around the container.
CATALOG = "catalog"
ORDER_STORE = "order_store"


def build_container() -> Container:
    """Builds one process-wide composition root. Every dependency is a
    `singleton` here: the reference app has no per-request state beyond
    what `Context` already carries, so there is nothing that needs
    `request-job` scoping. A real project may register some things as
    `request-job` (e.g. a per-request database transaction); the
    `Container` supports that (`register_request_job` + `create_scope()`)
    even though this reference app does not need it.
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
    """The `Context` factory (§10.1): every host builds a `Context` this
    way, keyed only by the correlation ID each trigger already carries
    (an HTTP header, a CLI flag, or a scheduled run's own generated ID).
    """

    return Context(correlation_id=correlation_id)
