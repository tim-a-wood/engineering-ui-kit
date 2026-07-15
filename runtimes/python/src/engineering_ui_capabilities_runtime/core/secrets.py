"""Secret reference and resolver protocols (§15.1).

Contracts store references only (e.g. an environment-variable name or a
project-defined secret-provider key), never values. Resolution happens at
the latest practical point and returns a redaction-aware wrapper so a
resolved value can never be accidentally serialized, logged, or printed.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable


@dataclass(frozen=True)
class SecretReference:
    """A reference to a secret. Carries no value."""

    provider: str
    key: str

    def __repr__(self) -> str:  # pragma: no cover - trivial
        return f"SecretReference(provider={self.provider!r}, key={self.key!r})"


class RedactedSecret:
    """Wraps a resolved secret value. `str()`/`repr()` always redact; the
    raw value is only reachable via the explicit `reveal()` call, which
    callers must not pass to a logger, exception, or serialized outcome.
    """

    __slots__ = ("_value",)

    def __init__(self, value: str) -> None:
        self._value = value

    def reveal(self) -> str:
        return self._value

    def __repr__(self) -> str:
        return "RedactedSecret(***)"

    def __str__(self) -> str:
        return "***"

    def __eq__(self, other: object) -> bool:
        return isinstance(other, RedactedSecret) and self._value == other._value

    def __hash__(self) -> int:  # pragma: no cover - trivial
        return hash(("RedactedSecret", self._value))


@runtime_checkable
class SecretResolver(Protocol):
    """Resolves a `SecretReference` to a `RedactedSecret` at the latest
    practical point. Implementations MUST NOT log the resolved value.
    """

    def resolve(self, ref: SecretReference) -> RedactedSecret: ...
