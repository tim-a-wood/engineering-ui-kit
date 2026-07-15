"""Portable five-field cron model, injected clock, job lifecycle
(overlap/misfire policy, request-job scope per run), and graceful shutdown
(§7.1, §10.3).
"""

from __future__ import annotations

from .clock import FakeWallClock, SystemWallClock, WallClock
from .cron import CronSchedule, InvalidCronExpressionError
from .scheduler import (
    CronJob,
    JobContextFactory,
    JobInputFactory,
    MisfirePolicy,
    OverlapPolicy,
    ScheduledJobRun,
    Scheduler,
    default_job_context_factory,
)
from .shutdown import DEFAULT_SHUTDOWN_SIGNALS, RestoreSignals, install_shutdown_signal_handlers

__all__ = [
    "CronJob",
    "CronSchedule",
    "DEFAULT_SHUTDOWN_SIGNALS",
    "FakeWallClock",
    "InvalidCronExpressionError",
    "JobContextFactory",
    "JobInputFactory",
    "MisfirePolicy",
    "OverlapPolicy",
    "RestoreSignals",
    "ScheduledJobRun",
    "Scheduler",
    "SystemWallClock",
    "WallClock",
    "default_job_context_factory",
    "install_shutdown_signal_handlers",
]
