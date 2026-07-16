"""Real end-to-end HTTP test for the Python side alone (no Node/React
involved): a `starlette.testclient.TestClient` request (in-process ASGI
transport, no real network socket) reaches `PlaceOrderOperation` through
the composition root and `dispatch`, and returns the mapped `Outcome`
(CAP-ERA-001 §19, §10.3).

The cross-process/cross-language proof (a real subprocess + a real network
socket, driven by the React/TypeScript client) is CAP-TEST-066
(`tests/cap-test-066-react-calls-live-python.test.ts`, vitest); this file
only proves the Python host itself is real and correct in isolation.
"""

from __future__ import annotations

from starlette.testclient import TestClient

from capabilities_react_python_reference.composition_root import ORDER_STORE, build_container
from capabilities_react_python_reference.http_app import ORDERS_PATH, create_app


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
    assert order_store.placed == [body["value"]]


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


def test_invalid_input_is_rejected_by_dispatch_before_reaching_the_operation() -> None:
    client, order_store = _client()

    response = client.post(ORDERS_PATH, json={"customer_id": "cust-1", "sku": "widget"})

    assert response.status_code == 422
    assert response.json()["code"] == "invalid_input"
    assert order_store.placed == []
