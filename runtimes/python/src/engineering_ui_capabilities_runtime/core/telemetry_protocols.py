"""Logger/Tracer protocols consumed by `Context` (§10.1, §15.4).

Defined here (rather than in `telemetry`) so `core` never imports
`telemetry`; `telemetry` implements these protocols instead. This keeps the
dependency direction one-way: `telemetry` -> `core`, never the reverse.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator, Protocol, runtime_checkable


@runtime_checkable
class Logger(Protocol):
    """A structured logger. Implementations MUST NOT be given secret values
    or raw exception tracebacks to log directly — callers pass safe,
    redacted fields only.
    """

    def debug(self, event: str, **fields: Any) -> None: ...

    def info(self, event: str, **fields: Any) -> None: ...

    def warning(self, event: str, **fields: Any) -> None: ...

    def error(self, event: str, **fields: Any) -> None: ...


@runtime_checkable
class Tracer(Protocol):
    """Vendor-neutral tracing hook (§15.4). No exporter is mandatory."""

    def start_span(self, name: str, **attributes: Any) -> Any: ...


class NullLogger:
    """Default no-op logger used when a host has not wired telemetry."""

    def debug(self, event: str, **fields: Any) -> None:  # pragma: no cover - trivial
        return None

    def info(self, event: str, **fields: Any) -> None:  # pragma: no cover - trivial
        return None

    def warning(self, event: str, **fields: Any) -> None:  # pragma: no cover - trivial
        return None

    def error(self, event: str, **fields: Any) -> None:  # pragma: no cover - trivial
        return None


class NullTracer:
    """Default no-op tracer used when a host has not wired telemetry."""

    @contextmanager
    def start_span(self, name: str, **attributes: Any) -> Iterator[None]:  # pragma: no cover - trivial
        yield None
