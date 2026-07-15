"""HTTP slice: exposes `PlaceOrderOperation` over a real FastAPI app via
the runtime's `HttpOperationHost` (CAP-ERA-001 §7.1/§10.3).

`create_app()` builds one composition root, resolves the operation from
it, and registers it as `POST /orders`. The `Context` factory is the same
one every host reuses (`composition_root.make_context`) -- the HTTP host
just supplies the correlation ID the request-mapping layer already
extracted (from `X-Correlation-Id`, or a generated one).
"""

from __future__ import annotations

from engineering_ui_capabilities_runtime.core import Container
from engineering_ui_capabilities_runtime.http import HttpOperationHost

from .composition_root import PLACE_ORDER_OPERATION, build_container, make_context
from .domain.schemas import PLACE_ORDER_INPUT_SCHEMA

ORDERS_PATH = "/orders"


def create_app(container: Container | None = None) -> HttpOperationHost:
    """Builds the HTTP host. Accepts an optional pre-built `Container` so
    tests can share one composition root with, e.g., a CLI invocation in
    the same test (proving both hosts traverse the same wiring), while a
    real process just calls `create_app()` with no arguments.
    """

    container = container if container is not None else build_container()
    operation = container.resolve(PLACE_ORDER_OPERATION)

    host = HttpOperationHost(title="Capabilities Python Reference")
    host.add_operation(
        ORDERS_PATH,
        operation,
        PLACE_ORDER_INPUT_SCHEMA,
        context_factory=lambda correlation_id, request: make_context(correlation_id),
        success_status=201,
        summary="Place an order for a catalog SKU.",
    )
    host.assert_openapi_consistent()
    return host


def main() -> None:  # pragma: no cover - real process entry point
    import uvicorn

    host = create_app()
    uvicorn.run(host.app, host="127.0.0.1", port=8000)


if __name__ == "__main__":  # pragma: no cover
    main()
