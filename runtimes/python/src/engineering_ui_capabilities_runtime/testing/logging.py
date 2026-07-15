"""An in-memory `Logger` implementation for assertions in tests, e.g.
"a secret reference never appears in a serialized outcome/log" canary
checks.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class LogRecord:
    level: str
    event: str
    fields: dict[str, Any]


class InMemoryLogger:
    """Implements `core.telemetry_protocols.Logger`; records every call for
    later inspection instead of writing anywhere.
    """

    def __init__(self) -> None:
        self.records: list[LogRecord] = []

    def _record(self, level: str, event: str, fields: dict[str, Any]) -> None:
        self.records.append(LogRecord(level=level, event=event, fields=fields))

    def debug(self, event: str, **fields: Any) -> None:
        self._record("debug", event, fields)

    def info(self, event: str, **fields: Any) -> None:
        self._record("info", event, fields)

    def warning(self, event: str, **fields: Any) -> None:
        self._record("warning", event, fields)

    def error(self, event: str, **fields: Any) -> None:
        self._record("error", event, fields)

    def text(self) -> str:
        """A single string containing every recorded event/field, useful
        for a simple canary substring check.
        """
        return "\n".join(f"{r.level} {r.event} {r.fields!r}" for r in self.records)
