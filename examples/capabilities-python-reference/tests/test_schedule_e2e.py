"""Real end-to-end schedule test: a cron trigger, driven purely by an
injected `FakeWallClock` (no real sleeping, no real wall-clock time),
fires `PlaceOrderOperation` through the composition root and `dispatch`
(CAP-ERA-001 §19, §10.3).

As with the HTTP/CLI E2E tests, the assertions depend on real traversal:
the recorded order in the shared `OrderStore` proves the cron tick really
reached the operation through `dispatch` + the composition root, not a
direct call to `PlaceOrderOperation.execute(...)`.
"""

from __future__ import annotations

from datetime import datetime, timezone

from engineering_ui_capabilities_runtime.worker import FakeWallClock

from capabilities_python_reference.composition_root import ORDER_STORE, build_container
from capabilities_python_reference.scheduled_app import (
    JOB_NAME,
    SUBSCRIPTION_ORDER,
    build_scheduler,
)


def test_cron_trigger_reaches_the_operation_under_an_injected_clock() -> None:
    container = build_container()
    clock = FakeWallClock(start=datetime(2026, 1, 1, 11, 0, tzinfo=timezone.utc))
    scheduler = build_scheduler(container, clock)

    # Nothing is due yet: the schedule is "0 * * * *" (on the hour), and
    # the clock starts exactly on an hour boundary, so the *next* due
    # instant is the following hour.
    assert scheduler.poll_once() == []

    clock.advance(hours=1)
    results = scheduler.poll_once()

    assert len(results) == 1
    run = results[0]
    assert run.job_name == JOB_NAME
    assert run.scheduled_for == datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
    assert run.outcome is not None
    assert run.outcome.kind == "success"
    assert run.outcome.value["customer_id"] == SUBSCRIPTION_ORDER["customer_id"]
    assert run.outcome.value["sku"] == SUBSCRIPTION_ORDER["sku"]

    # Proves the trigger really reached the composition root's
    # OrderStore (through dispatch), not just a returned outcome shape.
    order_store = container.resolve(ORDER_STORE)
    assert order_store.placed == [run.outcome.value]


def test_repeated_ticks_share_the_same_composition_root_state() -> None:
    container = build_container()
    clock = FakeWallClock(start=datetime(2026, 1, 1, 11, 0, tzinfo=timezone.utc))
    scheduler = build_scheduler(container, clock)
    scheduler.poll_once()  # establishes the first scheduled occurrence (12:00), nothing due yet

    clock.advance(hours=1)
    first_results = scheduler.poll_once()
    clock.advance(hours=1)
    second_results = scheduler.poll_once()

    assert first_results[0].outcome.value["order_id"] == "order-000001"
    assert second_results[0].outcome.value["order_id"] == "order-000002"

    order_store = container.resolve(ORDER_STORE)
    assert len(order_store.placed) == 2


def test_poll_before_the_scheduled_time_does_not_reach_the_operation() -> None:
    container = build_container()
    clock = FakeWallClock(start=datetime(2026, 1, 1, 11, 30, tzinfo=timezone.utc))
    scheduler = build_scheduler(container, clock)

    results = scheduler.poll_once()

    assert results == []
    order_store = container.resolve(ORDER_STORE)
    assert order_store.placed == []
