"""Correlation-ID propagation via `contextvars` (§15.4).

Python uses `contextvars` where TypeScript uses `AsyncLocalStorage`. `dispatch`
enters `correlation_scope(context.correlation_id)` around `execute`, so any
code running underneath — including `telemetry` loggers — can read the
active correlation ID without it being threaded through every call site.
"""

from __future__ import annotations

import contextvars
from contextlib import contextmanager
from typing import Iterator, Optional

_current_correlation_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "euik_correlation_id", default=None
)


def get_current_correlation_id() -> Optional[str]:
    return _current_correlation_id.get()


@contextmanager
def correlation_scope(correlation_id: str) -> Iterator[str]:
    token = _current_correlation_id.set(correlation_id)
    try:
        yield correlation_id
    finally:
        _current_correlation_id.reset(token)
