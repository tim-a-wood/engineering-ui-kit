"""Cooperative cancellation primitives (§10.1, §10.2)."""

from __future__ import annotations


class OperationCancelledError(Exception):
    """Raised by `CancellationToken.raise_if_cancelled()` and caught at the
    `dispatch` boundary, where it is converted to `Outcome.cancelled(reason)`.
    """

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class CancellationToken:
    """A simple, thread-safe-enough (GIL) cooperative cancellation flag.

    Hosts (HTTP, CLI, worker) set this on process signals or client
    disconnects; operations should check it at safe points during long work.
    """

    def __init__(self) -> None:
        self._cancelled = False
        self._reason: str = "cancelled"

    def cancel(self, reason: str = "cancelled") -> None:
        self._cancelled = True
        self._reason = reason

    def is_cancelled(self) -> bool:
        return self._cancelled

    @property
    def reason(self) -> str:
        return self._reason

    def raise_if_cancelled(self) -> None:
        if self._cancelled:
            raise OperationCancelledError(self._reason)
