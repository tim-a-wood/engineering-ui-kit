"""Vendor-neutral tracing hooks (§15.4). No exporter is mandatory; this
module provides a JSON-log-backed `Tracer` implementation so a standalone
application has span start/end events without a tracing vendor dependency.
Project adapters may export to a vendor by implementing the same protocol.
"""

from __future__ import annotations

import time
import uuid
from contextlib import contextmanager
from typing import Any, Iterator

from ..core.telemetry_protocols import Logger, NullLogger


class JsonLoggingTracer:
    """Implements `core.telemetry_protocols.Tracer` by logging span
    start/end events through a `Logger`.
    """

    def __init__(self, logger: Logger | None = None) -> None:
        self._logger = logger or NullLogger()

    @contextmanager
    def start_span(self, name: str, **attributes: Any) -> Iterator[str]:
        span_id = uuid.uuid4().hex
        started_at = time.monotonic()
        self._logger.debug("span.start", span=name, span_id=span_id, **attributes)
        try:
            yield span_id
        except Exception as exc:
            duration_ms = (time.monotonic() - started_at) * 1000
            self._logger.debug(
                "span.error",
                span=name,
                span_id=span_id,
                duration_ms=duration_ms,
                exception_type=type(exc).__name__,
            )
            raise
        else:
            duration_ms = (time.monotonic() - started_at) * 1000
            self._logger.debug("span.end", span=name, span_id=span_id, duration_ms=duration_ms)
