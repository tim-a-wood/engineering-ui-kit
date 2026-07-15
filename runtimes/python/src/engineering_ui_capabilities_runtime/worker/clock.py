"""Injectable wall clocks for the worker (§10.3 "Schedule: ... injected
clock in tests").

`core.clock.Clock` only exposes monotonic seconds (deadlines/cancellation);
cron scheduling needs an actual, timezone-aware wall-clock `datetime`, so
the worker defines its own small clock protocol here rather than widening
`core.clock`.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Protocol, runtime_checkable


@runtime_checkable
class WallClock(Protocol):
    """Returns the current, timezone-aware instant."""

    def now(self) -> datetime: ...


class SystemWallClock:
    """Default `WallClock`, backed by `datetime.now(timezone.utc)`."""

    def now(self) -> datetime:
        return datetime.now(timezone.utc)


class FakeWallClock:
    """Deterministic, injectable `WallClock` for tests: starts at a fixed
    instant (UTC by default) and only moves forward when `advance()` or
    `set()` is called explicitly.
    """

    def __init__(self, start: datetime | None = None) -> None:
        self._now = start or datetime(2026, 1, 1, tzinfo=timezone.utc)
        if self._now.tzinfo is None:
            raise ValueError("FakeWallClock requires a timezone-aware start instant")

    def now(self) -> datetime:
        return self._now

    def advance(self, **timedelta_kwargs: float) -> None:
        delta = timedelta(**timedelta_kwargs)
        if delta.total_seconds() < 0:
            raise ValueError("FakeWallClock cannot move backwards")
        self._now = self._now + delta

    def set(self, value: datetime) -> None:
        if value.tzinfo is None:
            raise ValueError("FakeWallClock requires a timezone-aware instant")
        self._now = value
