"""Job lifecycle: overlap policy, misfire policy, request-job scope per
run, and graceful shutdown (§10.3 "Schedule: ... overlap and misfire
policy ... request-job scope per run").
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, List, Mapping, Optional, Sequence

from ..core.context import Context
from ..core.dispatch import Operation, dispatch
from ..core.lifecycle import Container
from ..core.outcomes import AnyOutcome
from .clock import WallClock
from .cron import CronSchedule


class OverlapPolicy(str, Enum):
    """What to do if a scheduled run becomes due while the previous run of
    the *same* job is still executing.
    """

    #: Drop this occurrence; wait for the next scheduled time.
    SKIP = "skip"
    #: Run anyway, concurrently with the still-executing previous run.
    ALLOW = "allow"


class MisfirePolicy(str, Enum):
    """What to do if the scheduler was not polled promptly enough and one
    or more scheduled occurrences were missed entirely.
    """

    #: Run once now, for the most recently missed occurrence, then resume
    #: the normal schedule from that point.
    FIRE_NOW = "fire_now"
    #: Drop every missed occurrence; jump straight to the next occurrence
    #: strictly after the current time.
    SKIP = "skip"


JobContextFactory = Callable[[str, datetime], Context]
JobInputFactory = Callable[[datetime], Any]


def default_job_context_factory(correlation_id: str, scheduled_for: datetime) -> Context:
    return Context(correlation_id=correlation_id)


@dataclass(frozen=True)
class ScheduledJobRun:
    """The result of one `CronJob.poll()` call that found a due
    occurrence. `outcome` is `None` when the occurrence was skipped
    (overlap or misfire) rather than executed.
    """

    job_name: str
    scheduled_for: datetime
    outcome: Optional[AnyOutcome]
    skipped_reason: Optional[str] = None


class CronJob:
    """One scheduled operation. `poll()` is called by a `Scheduler` (or
    directly in tests) and only ever executes the operation synchronously,
    within the call — there is no background thread here, which is what
    makes deterministic, injected-clock testing possible.
    """

    def __init__(
        self,
        name: str,
        schedule: CronSchedule,
        operation: "Operation[Any]",
        *,
        input_schema: Optional[Mapping[str, Any]] = None,
        make_input: JobInputFactory = lambda scheduled_for: {},
        context_factory: JobContextFactory = default_job_context_factory,
        overlap_policy: OverlapPolicy = OverlapPolicy.SKIP,
        misfire_policy: MisfirePolicy = MisfirePolicy.FIRE_NOW,
        container: Optional[Container] = None,
    ) -> None:
        self.name = name
        self.schedule = schedule
        self.operation = operation
        self.input_schema = input_schema
        self.make_input = make_input
        self.context_factory = context_factory
        self.overlap_policy = overlap_policy
        self.misfire_policy = misfire_policy
        self.container = container
        self._next_run_at: Optional[datetime] = None
        self._running = False

    def initialize(self, clock: WallClock) -> None:
        """Computes the first scheduled occurrence strictly after `now`.
        Called automatically by the first `poll()` if not called
        explicitly first.
        """

        self._next_run_at = self.schedule.next_run_after(clock.now())

    @property
    def next_run_at(self) -> Optional[datetime]:
        return self._next_run_at

    @property
    def is_running(self) -> bool:
        return self._running

    def poll(self, clock: WallClock) -> Optional[ScheduledJobRun]:
        """Checks whether a scheduled occurrence is due at `clock.now()`.
        Returns `None` if nothing is due yet, otherwise a `ScheduledJobRun`
        describing what happened (executed, or skipped per overlap/misfire
        policy).
        """

        if self._next_run_at is None:
            self.initialize(clock)
        assert self._next_run_at is not None

        now = clock.now()
        if now < self._next_run_at:
            return None

        scheduled_for = self._next_run_at

        if self.misfire_policy is MisfirePolicy.SKIP:
            # Drop this (possibly stale) occurrence and any others between
            # it and `now`; resume from the next occurrence after `now`.
            self._next_run_at = self.schedule.next_run_after(now)
            return ScheduledJobRun(
                job_name=self.name,
                scheduled_for=scheduled_for,
                outcome=None,
                skipped_reason="misfire",
            )

        # FIRE_NOW: catch up once, for the oldest missed occurrence, then
        # resume the schedule from that occurrence (not from `now`), so a
        # long pause does not fire a burst of catch-up runs.
        self._next_run_at = self.schedule.next_run_after(scheduled_for)

        if self._running and self.overlap_policy is OverlapPolicy.SKIP:
            return ScheduledJobRun(
                job_name=self.name,
                scheduled_for=scheduled_for,
                outcome=None,
                skipped_reason="overlap",
            )

        outcome = self._execute(scheduled_for)
        return ScheduledJobRun(job_name=self.name, scheduled_for=scheduled_for, outcome=outcome)

    def _execute(self, scheduled_for: datetime) -> AnyOutcome:
        self._running = True
        try:
            correlation_id = uuid.uuid4().hex
            input_value = self.make_input(scheduled_for)
            context = self.context_factory(correlation_id, scheduled_for)
            if self.container is not None:
                with self.container.create_scope():
                    return dispatch(self.operation, input_value, context, input_schema=self.input_schema)
            return dispatch(self.operation, input_value, context, input_schema=self.input_schema)
        finally:
            self._running = False


class Scheduler:
    """Holds any number of `CronJob`s and polls them together. A real
    process wires `run_until_shutdown` to a real sleep function and a
    signal-installed `request_shutdown`; tests call `poll_once()` directly
    against a `FakeWallClock`.
    """

    def __init__(self, clock: WallClock, jobs: Sequence[CronJob] = ()) -> None:
        self._clock = clock
        self._jobs: List[CronJob] = list(jobs)
        self._shutdown_requested = False

    def add_job(self, job: CronJob) -> None:
        self._jobs.append(job)

    @property
    def jobs(self) -> Sequence[CronJob]:
        return tuple(self._jobs)

    def poll_once(self) -> List[ScheduledJobRun]:
        """Polls every job exactly once and returns the runs that were due
        (executed or skipped). Never blocks.
        """

        results: List[ScheduledJobRun] = []
        for job in self._jobs:
            result = job.poll(self._clock)
            if result is not None:
                results.append(result)
        return results

    def request_shutdown(self) -> None:
        self._shutdown_requested = True

    @property
    def is_shutdown_requested(self) -> bool:
        return self._shutdown_requested

    def run_until_shutdown(
        self,
        sleep: Callable[[float], None],
        poll_interval_seconds: float = 1.0,
    ) -> None:
        """A real run loop: poll, sleep, repeat, until `request_shutdown()`
        has been called (typically from a signal handler — see
        `worker.shutdown.install_shutdown_signal_handlers`). Drains by
        simply finishing the current `poll_once()` call before checking
        the shutdown flag again; it never starts a new poll after shutdown
        has been requested.
        """

        while not self._shutdown_requested:
            self.poll_once()
            if self._shutdown_requested:
                break
            sleep(poll_interval_seconds)
