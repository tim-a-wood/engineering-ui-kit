"""Configuration reader protocol (§10.1 `Context.configuration reader`)."""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


class ConfigurationKeyError(KeyError):
    """Raised by `require()` when a required configuration key is absent."""


@runtime_checkable
class ConfigReader(Protocol):
    """A minimal, read-only configuration surface. Concrete adapters (env,
    file, remote config service) live outside this framework-neutral core.
    """

    def get(self, key: str, default: Any | None = None) -> Any | None: ...

    def require(self, key: str) -> Any: ...


class MappingConfigReader:
    """Simple `ConfigReader` backed by an in-memory mapping. Useful for
    generated composition roots and tests; production adapters may layer
    environment variables, files, or a remote config service behind the
    same protocol.
    """

    def __init__(self, values: dict[str, Any] | None = None) -> None:
        self._values = dict(values or {})

    def get(self, key: str, default: Any | None = None) -> Any | None:
        return self._values.get(key, default)

    def require(self, key: str) -> Any:
        if key not in self._values:
            raise ConfigurationKeyError(key)
        return self._values[key]
