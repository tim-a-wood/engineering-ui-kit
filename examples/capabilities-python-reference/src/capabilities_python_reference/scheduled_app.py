"""Schedule slice: a cron-triggered `PlaceOrderOperation` run via the
runtime's `worker` (CAP-ERA-001 §7.1/§10.3): a subscription customer's
recurring order is placed once an hour, wired through the same
composition root as the HTTP and CLI slices.

`OverlapPolicy`/`MisfirePolicy` naming is a tracked open issue
(`SCHED-ENUM`) across the wider spec/runtimes; this slice deliberately
does not attempt to reconcile it -- it just uses the Python runtime's
current enum values (`OverlapPolicy.SKIP`, `MisfirePolicy.FIRE_NOW`) as
they exist today.
"""

from __future__ import annotations

import time
from typing import Any

from engineering_ui_capabilities_runtime.core import Container
from engineering_ui_capabilities_runtime.worker import (
    CronJob,
    CronSchedule,
    MisfirePolicy,
    OverlapPolicy,
    Scheduler,
    SystemWallClock,
    WallClock,
    install_shutdown_signal_handlers,
)

from .composition_root import PLACE_ORDER_OPERATION, build_container, make_context
from .domain.schemas import PLACE_ORDER_INPUT_SCHEMA

JOB_NAME = "hourly-subscription-reorder"

#: The fixed recurring order this job places every time it fires -- a
#: subscription-style reorder, not user-supplied input (there is no user
#: at a cron tick).
SUBSCRIPTION_ORDER: dict[str, Any] = {
    "customer_id": "subscription-customer",
    "sku": "widget",
    "quantity": 1,
}


def build_scheduler(container: Container | None = None, clock: WallClock | None = None) -> Scheduler:
    """Builds the scheduler with one job: every hour, on the hour, place
    the fixed subscription reorder through the shared composition root.
    Accepts an optional `Container`/`WallClock` so tests can inject a
    `FakeWallClock` and share a composition root with assertions, while a
    real process just calls `build_scheduler()` with no arguments.
    """

    container = container if container is not None else build_container()
    clock = clock if clock is not None else SystemWallClock()
    operation = container.resolve(PLACE_ORDER_OPERATION)

    schedule = CronSchedule.parse("0 * * * *", timezone="UTC")
    job = CronJob(
        JOB_NAME,
        schedule,
        operation,
        input_schema=PLACE_ORDER_INPUT_SCHEMA,
        make_input=lambda scheduled_for: dict(SUBSCRIPTION_ORDER),
        context_factory=lambda correlation_id, scheduled_for: make_context(correlation_id),
        overlap_policy=OverlapPolicy.SKIP,
        misfire_policy=MisfirePolicy.FIRE_NOW,
        container=container,
    )
    return Scheduler(clock, jobs=[job])


def main() -> None:  # pragma: no cover - real process entry point
    scheduler = build_scheduler()
    restore_signals = install_shutdown_signal_handlers(scheduler)
    try:
        scheduler.run_until_shutdown(time.sleep, poll_interval_seconds=30.0)
    finally:
        restore_signals()


if __name__ == "__main__":  # pragma: no cover
    main()
