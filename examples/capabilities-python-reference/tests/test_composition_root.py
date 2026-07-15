"""Unit-level checks on the composition root itself (not an end-to-end
host test -- see `test_http_e2e.py`/`test_cli_e2e.py`/
`test_schedule_e2e.py` for those). Confirms `build_container()` wires a
resolvable `PlaceOrderOperation` and that it is a stable singleton across
resolutions (so repeated dispatches share the same `OrderStore`, which is
what gives sequential order IDs their meaning).
"""

from __future__ import annotations

from capabilities_python_reference.composition_root import (
    PLACE_ORDER_OPERATION,
    build_container,
    make_context,
)
from capabilities_python_reference.domain.place_order import PlaceOrderOperation


def test_container_resolves_a_place_order_operation() -> None:
    container = build_container()

    operation = container.resolve(PLACE_ORDER_OPERATION)

    assert isinstance(operation, PlaceOrderOperation)


def test_operation_registration_is_a_singleton() -> None:
    container = build_container()

    first = container.resolve(PLACE_ORDER_OPERATION)
    second = container.resolve(PLACE_ORDER_OPERATION)

    assert first is second


def test_make_context_carries_the_supplied_correlation_id() -> None:
    context = make_context("corr-abc")

    assert context.correlation_id == "corr-abc"
