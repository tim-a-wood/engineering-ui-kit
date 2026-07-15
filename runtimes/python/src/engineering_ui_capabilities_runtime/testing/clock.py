"""Injectable/fake clock for deterministic tests (§10.2 deadlines,
cancellation timing)."""

from __future__ import annotations


class FakeClock:
    """Implements `core.clock.Clock`. Starts at `0.0` monotonic seconds
    unless given a starting value; advance it explicitly in tests instead
    of sleeping.
    """

    def __init__(self, start: float = 0.0) -> None:
        self._now = start

    def monotonic(self) -> float:
        return self._now

    def advance(self, seconds: float) -> None:
        if seconds < 0:
            raise ValueError("FakeClock cannot move backwards")
        self._now += seconds

    def set(self, value: float) -> None:
        self._now = value
