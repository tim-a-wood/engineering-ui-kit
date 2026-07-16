"""HTTP slice: exposes `PlaceOrderOperation` over a real FastAPI app via
the runtime's `HttpOperationHost` (CAP-ERA-001 §7.1/§10.3) — this IS the
"live Python host" CAP-TEST-066 spawns as a real subprocess and CAP-TEST-069
diffs against the generated OpenAPI 3.1 document (`src/generation/*.ts`,
`planOpenApiDocument`).

`create_app()` builds one composition root, resolves the operation from
it, and registers it as `POST /orders` — the exact `path`/`method` the
TypeScript-side `HttpInboundBinding` (`src/generation/contract.ts`)
declares, so both sides describe the same boundary.

Standalone: this module never imports Node/Electron/desktop code, and can
run under plain `python -m capabilities_react_python_reference.http_app`
with only this package's own Python dependencies installed.
"""

from __future__ import annotations

import os

from engineering_ui_capabilities_runtime.core import Container
from engineering_ui_capabilities_runtime.http import HttpOperationHost

from .composition_root import PLACE_ORDER_OPERATION, build_container, make_context
from .domain.schemas import PLACE_ORDER_INPUT_SCHEMA

ORDERS_PATH = "/orders"


def create_app(container: Container | None = None) -> HttpOperationHost:
    """Builds the HTTP host. Accepts an optional pre-built `Container` so
    tests can share one composition root across repeated calls (proving
    the same `OrderStore` singleton backs every request), while a real
    process just calls `create_app()` with no arguments.
    """

    container = container if container is not None else build_container()
    operation = container.resolve(PLACE_ORDER_OPERATION)

    host = HttpOperationHost(title="Capabilities React<->Python Reference")
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
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(host.app, host="127.0.0.1", port=port)


if __name__ == "__main__":  # pragma: no cover
    main()
