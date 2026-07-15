"""`CronJob`/`Scheduler` behavior under an injected `FakeWallClock`:
overlap policy, misfire policy, request-job scope per run, and graceful
shutdown (§10.3).
"""

from __future__ import annotations

import signal
from datetime import datetime, timezone
from typing import Any

from engineering_ui_capabilities_runtime.core import Context, Container, Outcome
from engineering_ui_capabilities_runtime.worker import (
    CronJob,
    CronSchedule,
    FakeWallClock,
    MisfirePolicy,
    OverlapPolicy,
    Scheduler,
)
from engineering_ui_capabilities_runtime.worker.shutdown import install_shutdown_signal_handlers


class RecordingOperation:
    def __init__(self) -> None:
        self.calls: list[Any] = []

    def execute(self, input: Any, context: Context) -> Any:
        self.calls.append(input)
        return Outcome.success(input)


class BlockingOperation:
    """Simulates a still-in-flight run by never clearing `is_running`
    itself — the test manipulates the job's `_running` flag directly to
    simulate "previous run still executing" deterministically, without
    threads.
    """

    def execute(self, input: Any, context: Context) -> Any:
        return Outcome.success(input)


def _every_minute(tz: str = "UTC") -> CronSchedule:
    return CronSchedule.parse("* * * * *", timezone=tz)


def test_poll_does_nothing_before_the_scheduled_time() -> None:
    clock = FakeWallClock(start=datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc))
    operation = RecordingOperation()
    job = CronJob("noop", _every_minute(), operation)

    result = job.poll(clock)

    assert result is None
    assert operation.calls == []


def test_poll_executes_the_operation_once_due_and_advances_the_next_run() -> None:
    clock = FakeWallClock(start=datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc))
    operation = RecordingOperation()
    job = CronJob("tick", _every_minute(), operation, make_input=lambda scheduled_for: {"at": scheduled_for.isoformat()})

    job.initialize(clock)
    clock.advance(minutes=1)

    result = job.poll(clock)

    assert result is not None
    assert result.outcome is not None
    assert result.outcome.kind == "success"
    assert len(operation.calls) == 1
    assert job.next_run_at == datetime(2026, 1, 1, 12, 2, tzinfo=timezone.utc)


def test_overlap_policy_skip_drops_a_trigger_while_the_job_is_running() -> None:
    clock = FakeWallClock(start=datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc))
    job = CronJob("overlap-skip", _every_minute(), BlockingOperation(), overlap_policy=OverlapPolicy.SKIP)
    job.initialize(clock)
    clock.advance(minutes=1)

    job._running = True  # simulate a still-executing previous run
    result = job.poll(clock)
    job._running = False

    assert result is not None
    assert result.outcome is None
    assert result.skipped_reason == "overlap"
    assert job.pending_queue_size == 0


def test_overlap_policy_allow_concurrent_executes_even_while_running() -> None:
    clock = FakeWallClock(start=datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc))
    operation = RecordingOperation()
    job = CronJob("overlap-allow", _every_minute(), operation, overlap_policy=OverlapPolicy.ALLOW_CONCURRENT)
    job.initialize(clock)
    clock.advance(minutes=1)

    job._running = True
    result = job.poll(clock)

    assert result is not None
    assert result.outcome is not None
    assert result.outcome.kind == "success"
    assert len(operation.calls) == 1


def test_overlap_policy_queue_defers_a_trigger_while_the_job_is_running_then_runs_it_once_free() -> None:
    clock = FakeWallClock(start=datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc))
    operation = RecordingOperation()
    job = CronJob(
        "overlap-queue",
        _every_minute(),
        operation,
        make_input=lambda scheduled_for: {"at": scheduled_for.isoformat()},
        overlap_policy=OverlapPolicy.QUEUE,
    )
    job.initialize(clock)
    clock.advance(minutes=1)

    job._running = True  # simulate a still-executing previous run
    deferred = job.poll(clock)

    # Never runs concurrently: the occurrence is queued, not executed.
    assert deferred is not None
    assert deferred.outcome is None
    assert deferred.skipped_reason == "queued"
    assert operation.calls == []
    assert job.pending_queue_size == 1

    # The previous run finishes; nothing new is due yet (clock unmoved),
    # but the queued occurrence runs as soon as the job is free.
    job._running = False
    drained = job.poll(clock)

    assert drained is not None
    assert drained.outcome is not None
    assert drained.outcome.kind == "success"
    assert drained.scheduled_for == datetime(2026, 1, 1, 12, 1, tzinfo=timezone.utc)
    assert operation.calls == [{"at": "2026-01-01T12:01:00+00:00"}]
    assert job.pending_queue_size == 0


def test_overlap_policy_queue_never_runs_concurrently_and_preserves_order() -> None:
    clock = FakeWallClock(start=datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc))
    operation = RecordingOperation()
    job = CronJob(
        "overlap-queue-multi",
        _every_minute(),
        operation,
        make_input=lambda scheduled_for: {"at": scheduled_for.isoformat()},
        overlap_policy=OverlapPolicy.QUEUE,
    )
    job.initialize(clock)

    job._running = True
    clock.advance(minutes=1)
    first = job.poll(clock)
    clock.advance(minutes=1)
    second = job.poll(clock)

    assert first is not None and first.skipped_reason == "queued"
    assert second is not None and second.skipped_reason == "queued"
    assert operation.calls == []
    assert job.pending_queue_size == 2

    job._running = False
    drained_first = job.poll(clock)
    drained_second = job.poll(clock)

    assert drained_first is not None and drained_first.outcome is not None
    assert drained_second is not None and drained_second.outcome is not None
    # Runs in the order they were queued (FIFO), never concurrently.
    assert operation.calls == [
        {"at": "2026-01-01T12:01:00+00:00"},
        {"at": "2026-01-01T12:02:00+00:00"},
    ]
    assert job.pending_queue_size == 0


def test_misfire_policy_run_once_runs_once_for_the_oldest_missed_occurrence_then_resumes_from_now() -> None:
    clock = FakeWallClock(start=datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc))
    operation = RecordingOperation()
    job = CronJob(
        "misfire-run-once",
        _every_minute(),
        operation,
        make_input=lambda scheduled_for: {"at": scheduled_for.isoformat()},
        misfire_policy=MisfirePolicy.RUN_ONCE,
    )
    job.initialize(clock)
    # Skip ahead 5 minutes without polling in between: 5 occurrences missed.
    clock.advance(minutes=5)

    result = job.poll(clock)

    assert result is not None
    assert result.outcome is not None
    assert result.outcome.kind == "success"
    # Fires for the *oldest* missed occurrence (12:01), not "now" (12:05).
    assert result.scheduled_for == datetime(2026, 1, 1, 12, 1, tzinfo=timezone.utc)
    assert operation.calls == [{"at": "2026-01-01T12:01:00+00:00"}]
    # A single catch-up run only: resumes strictly after "now" (12:05), not
    # from the fired occurrence — the rest of the backlog (12:02..12:05) is
    # never fired even on repeated polls.
    assert job.next_run_at == datetime(2026, 1, 1, 12, 6, tzinfo=timezone.utc)

    again = job.poll(clock)
    assert again is None
    assert len(operation.calls) == 1


def test_misfire_policy_run_all_fires_each_missed_occurrence_once_in_order() -> None:
    clock = FakeWallClock(start=datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc))
    operation = RecordingOperation()
    job = CronJob(
        "misfire-run-all",
        _every_minute(),
        operation,
        make_input=lambda scheduled_for: {"at": scheduled_for.isoformat()},
        misfire_policy=MisfirePolicy.RUN_ALL,
    )
    job.initialize(clock)
    # Skip ahead 5 minutes without polling in between: 5 occurrences missed.
    clock.advance(minutes=5)

    # Repeated polls (clock unmoved) drain the whole backlog, one
    # occurrence per poll, in order, until caught up to "now".
    results = [job.poll(clock) for _ in range(5)]

    assert all(r is not None and r.outcome is not None for r in results)
    assert [r.scheduled_for for r in results] == [
        datetime(2026, 1, 1, 12, 1, tzinfo=timezone.utc),
        datetime(2026, 1, 1, 12, 2, tzinfo=timezone.utc),
        datetime(2026, 1, 1, 12, 3, tzinfo=timezone.utc),
        datetime(2026, 1, 1, 12, 4, tzinfo=timezone.utc),
        datetime(2026, 1, 1, 12, 5, tzinfo=timezone.utc),
    ]
    assert operation.calls == [
        {"at": "2026-01-01T12:01:00+00:00"},
        {"at": "2026-01-01T12:02:00+00:00"},
        {"at": "2026-01-01T12:03:00+00:00"},
        {"at": "2026-01-01T12:04:00+00:00"},
        {"at": "2026-01-01T12:05:00+00:00"},
    ]
    assert job.next_run_at == datetime(2026, 1, 1, 12, 6, tzinfo=timezone.utc)
    # Now fully caught up: nothing else is due.
    assert job.poll(clock) is None


def test_misfire_policy_skip_drops_missed_occurrences_without_executing() -> None:
    clock = FakeWallClock(start=datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc))
    operation = RecordingOperation()
    job = CronJob(
        "misfire-skip",
        _every_minute(),
        operation,
        misfire_policy=MisfirePolicy.SKIP,
    )
    job.initialize(clock)
    clock.advance(minutes=5)

    result = job.poll(clock)

    assert result is not None
    assert result.outcome is None
    assert result.skipped_reason == "misfire"
    assert operation.calls == []
    # Resumes strictly after "now" (12:05), not from the missed 12:01 tick.
    assert job.next_run_at == datetime(2026, 1, 1, 12, 6, tzinfo=timezone.utc)


def test_job_uses_a_request_job_scope_per_run_when_a_container_is_supplied() -> None:
    container = Container()
    scope_events: list[str] = []
    container.register_request_job(
        "widget",
        factory=lambda c: (scope_events.append("created") or object()),
        dispose=lambda instance: scope_events.append("disposed"),
    )

    class ScopedOperation:
        def execute(self, input: Any, context: Context) -> Any:
            # Resolve inside execute is not directly wired here (the
            # scope is created around dispatch, not injected into
            # Context), so instead assert the scope lifecycle directly
            # via the container after the job runs.
            return Outcome.success(None)

    clock = FakeWallClock(start=datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc))
    job = CronJob("scoped", _every_minute(), ScopedOperation(), container=container)
    job.initialize(clock)
    clock.advance(minutes=1)

    # Directly prove the container's create_scope is exercised per run by
    # wrapping the container so we can observe scope creation/disposal.
    real_create_scope = container.create_scope
    scopes_created = []

    def spying_create_scope():
        scope = real_create_scope()
        scopes_created.append(scope)
        return scope

    container.create_scope = spying_create_scope  # type: ignore[assignment]

    result = job.poll(clock)

    assert result is not None
    assert result.outcome is not None
    assert len(scopes_created) == 1
    assert scopes_created[0]._disposed is True


def test_scheduler_poll_once_collects_results_from_all_jobs() -> None:
    clock = FakeWallClock(start=datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc))
    op_a, op_b = RecordingOperation(), RecordingOperation()
    scheduler = Scheduler(clock)
    scheduler.add_job(CronJob("a", _every_minute(), op_a))
    scheduler.add_job(CronJob("b", _every_minute(), op_b))
    for job in scheduler.jobs:
        job.initialize(clock)
    clock.advance(minutes=1)

    results = scheduler.poll_once()

    assert {r.job_name for r in results} == {"a", "b"}
    assert len(op_a.calls) == 1
    assert len(op_b.calls) == 1


def test_run_until_shutdown_stops_after_request_shutdown() -> None:
    clock = FakeWallClock(start=datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc))
    scheduler = Scheduler(clock)
    sleep_calls: list[float] = []

    def fake_sleep(seconds: float) -> None:
        sleep_calls.append(seconds)
        clock.advance(minutes=1)
        if len(sleep_calls) >= 3:
            scheduler.request_shutdown()

    scheduler.run_until_shutdown(fake_sleep, poll_interval_seconds=0.01)

    assert scheduler.is_shutdown_requested is True
    assert len(sleep_calls) == 3


def test_install_shutdown_signal_handlers_requests_shutdown_and_restores_prior_handlers() -> None:
    clock = FakeWallClock(start=datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc))
    scheduler = Scheduler(clock)
    original_handler = signal.getsignal(signal.SIGTERM)

    restore = install_shutdown_signal_handlers(scheduler, signals=(signal.SIGTERM,))
    try:
        installed_handler = signal.getsignal(signal.SIGTERM)
        assert installed_handler is not original_handler

        installed_handler(signal.SIGTERM, None)

        assert scheduler.is_shutdown_requested is True
    finally:
        restore()

    assert signal.getsignal(signal.SIGTERM) is original_handler
