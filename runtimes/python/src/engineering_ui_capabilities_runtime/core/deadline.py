"""Deadline value object and the exception `dispatch` converts to `timed_out`."""

from __future__ import annotations

from dataclasses import dataclass

from .clock import Clock, SystemClock


class DeadlineExceededError(Exception):
    """Raised by `Deadline.raise_if_exceeded()` and caught at the `dispatch`
    boundary, where it is converted to `Outcome.timed_out(deadline)`.
    """

    def __init__(self, deadline: "Deadline") -> None:
        super().__init__(deadline.isoformat())
        self.deadline = deadline


@dataclass(frozen=True)
class Deadline:
    """A deadline expressed as monotonic seconds-from-epoch-of-clock plus a
    human-readable ISO-ish label used only for the `Outcome.timed_out`
    payload (never re-parsed by this runtime).
    """

    expires_at_monotonic: float
    label: str

    @classmethod
    def after(cls, seconds: float, clock: Clock | None = None, label: str | None = None) -> "Deadline":
        clock = clock or SystemClock()
        expires_at = clock.monotonic() + seconds
        return cls(expires_at_monotonic=expires_at, label=label or f"+{seconds}s")

    def is_expired(self, clock: Clock | None = None) -> bool:
        clock = clock or SystemClock()
        return clock.monotonic() >= self.expires_at_monotonic

    def raise_if_exceeded(self, clock: Clock | None = None) -> None:
        if self.is_expired(clock):
            raise DeadlineExceededError(self)

    def isoformat(self) -> str:
        return self.label
