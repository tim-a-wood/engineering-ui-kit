"""Real end-to-end HTTP test: a `starlette.testclient.TestClient` request
(in-process ASGI transport, no real network socket) reaches
`PlaceOrderOperation` through the composition root and `dispatch`, and
returns the mapped `Outcome` (CAP-ERA-001 §19, §10.3).

Every assertion here depends on the request actually having traveled
through `dispatch` + the composition root, not on a direct call to
`PlaceOrderOperation.execute(...)`:

- `dispatch`'s own JSON-Schema validation (not the operation) is what
  rejects a missing field with `invalid_input`.
- The sequential order ID and the growing `OrderStore.placed` list prove
  the *same* composition root (the same `OrderStore` singleton) backs
  every request through the host, across repeated calls.
"""

from __future__ import annotations

from starlette.testclient import TestClient

from capabilities_python_reference.composition_root import ORDER_STORE, build_container
from capabilities_python_reference.http_app import ORDERS_PATH, create_app


def _client() -> tuple[TestClient, object]:
    container = build_container()
    host = create_app(container)
    return TestClient(host.app), container.resolve(ORDER_STORE)


def test_real_request_reaches_the_operation_and_returns_a_success_outcome() -> None:
    client, order_store = _client()

    response = client.post(
        ORDERS_PATH,
        json={"customer_id": "cust-1", "sku": "widget", "quantity": 2},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["kind"] == "success"
    assert body["value"]["order_id"] == "order-000001"
    assert body["value"]["total_cents"] == 2 * 1_999
    # Proves the request really reached the composition root's OrderStore
    # (through dispatch), not just a mocked/expected response shape.
    assert order_store.placed == [body["value"]]


def test_repeated_requests_share_the_same_composition_root_state() -> None:
    client, order_store = _client()

    first = client.post(ORDERS_PATH, json={"customer_id": "cust-1", "sku": "widget", "quantity": 1})
    second = client.post(ORDERS_PATH, json={"customer_id": "cust-2", "sku": "gadget", "quantity": 1})

    assert first.json()["value"]["order_id"] == "order-000001"
    assert second.json()["value"]["order_id"] == "order-000002"
    assert len(order_store.placed) == 2


def test_unknown_sku_is_a_domain_rejection_mapped_to_422() -> None:
    client, _ = _client()

    response = client.post(
        ORDERS_PATH,
        json={"customer_id": "cust-1", "sku": "does-not-exist", "quantity": 1},
    )

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "unknown_sku"
    assert body["details"] == {"sku": "does-not-exist"}


def test_insufficient_stock_is_a_domain_rejection_mapped_to_422() -> None:
    client, _ = _client()

    response = client.post(
        ORDERS_PATH,
        json={"customer_id": "cust-1", "sku": "out-of-stock-gizmo", "quantity": 1},
    )

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "insufficient_stock"
    assert body["details"] == {"sku": "out-of-stock-gizmo", "requested": 1, "available": 0}


def test_invalid_input_is_rejected_by_dispatch_before_reaching_the_operation() -> None:
    """A missing required field never reaches `PlaceOrderOperation.execute`
    -- `dispatch`'s own schema validation rejects it with `invalid_input`,
    which only exists on the real `dispatch` traversal path.
    """

    client, order_store = _client()

    response = client.post(ORDERS_PATH, json={"customer_id": "cust-1", "sku": "widget"})

    assert response.status_code == 422
    assert response.json()["code"] == "invalid_input"
    assert order_store.placed == []
