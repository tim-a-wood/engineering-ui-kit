"""Clock protocol used for deadlines and time-based decisions.

Real code uses `SystemClock`. Tests inject `engineering_ui_capabilities_runtime.testing.FakeClock`
so cancellation/timeout behavior is deterministic (see CAP-ERA-001 §10.1/§10.2).
"""

from __future__ import annotations

import time
from typing import Protocol, runtime_checkable


@runtime_checkable
class Clock(Protocol):
    """Returns monotonic seconds. Only used for relative deadline comparisons."""

    def monotonic(self) -> float: ...


class SystemClock:
    """Default clock backed by `time.monotonic()`."""

    def monotonic(self) -> float:
        return time.monotonic()
