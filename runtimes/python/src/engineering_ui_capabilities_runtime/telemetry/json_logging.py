"""JSON console logging (§15.1, §15.4). The default standalone sink for
generated Python applications: one JSON object per line on a stream
(`stdout` by default), automatically annotated with the active correlation
ID (propagated via `contextvars`, see `core.correlation`).
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from typing import Any, TextIO

from ..core.correlation import get_current_correlation_id
from ..core.secrets import RedactedSecret


def _json_default(value: Any) -> Any:
    """Serialization fallback used by the JSON logger. Secret wrappers are
    always redacted; anything else unknown to `json` falls back to a
    `repr()` label rather than raising, so logging itself never crashes an
    operation.
    """

    if isinstance(value, RedactedSecret):
        return str(value)
    return f"<unserializable:{type(value).__name__}>"


class JsonConsoleLogger:
    """Implements `core.telemetry_protocols.Logger`."""

    def __init__(self, stream: TextIO | None = None, service: str | None = None) -> None:
        self._stream = stream or sys.stdout
        self._service = service

    def _emit(self, level: str, event: str, fields: dict[str, Any]) -> None:
        record: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": level,
            "event": event,
            "correlation_id": get_current_correlation_id(),
        }
        if self._service is not None:
            record["service"] = self._service
        record.update(fields)
        self._stream.write(json.dumps(record, default=_json_default) + "\n")

    def debug(self, event: str, **fields: Any) -> None:
        self._emit("debug", event, fields)

    def info(self, event: str, **fields: Any) -> None:
        self._emit("info", event, fields)

    def warning(self, event: str, **fields: Any) -> None:
        self._emit("warning", event, fields)

    def error(self, event: str, **fields: Any) -> None:
        self._emit("error", event, fields)
