"""A small, project-owned composition container (§10.2), not a heavyweight
DI framework. Generated composition roots use explicit imports and
registrations; this container only manages lifecycle:

- `singleton`: one instance for the process lifetime.
- `request-job`: one instance per HTTP request, CLI invocation, scheduled
  job, or equivalent UI dispatch scope — created via `Container.create_scope()`.
- `transient`: a new instance at every resolution.

Disposal happens in reverse creation order, matching shutdown semantics in
§10.2 ("disposes scopes in reverse order").
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Optional, Protocol


class Lifecycle(str, Enum):
    SINGLETON = "singleton"
    REQUEST_JOB = "request-job"
    TRANSIENT = "transient"


class RegistrationError(Exception):
    """Raised for duplicate registrations or resolving an unknown key."""


class ScopeRequiredError(Exception):
    """Raised when a `request-job` registration is resolved without an
    active scope.
    """


class Resolver(Protocol):
    def resolve(self, key: str) -> Any: ...


Factory = Callable[[Resolver], Any]
Disposer = Callable[[Any], None]


@dataclass(frozen=True)
class Registration:
    key: str
    lifecycle: Lifecycle
    factory: Factory
    dispose: Optional[Disposer] = None


@dataclass
class _InstanceLedger:
    instances: dict[str, Any] = field(default_factory=dict)
    creation_order: list[str] = field(default_factory=list)

    def get_or_create(self, reg: Registration, resolver: Resolver) -> Any:
        if reg.key not in self.instances:
            self.instances[reg.key] = reg.factory(resolver)
            self.creation_order.append(reg.key)
        return self.instances[reg.key]

    def dispose_all(self, registrations: dict[str, Registration]) -> None:
        for key in reversed(self.creation_order):
            instance = self.instances.pop(key, None)
            reg = registrations.get(key)
            if reg is not None and reg.dispose is not None and instance is not None:
                reg.dispose(instance)
        self.creation_order.clear()


class Scope:
    """A `request-job` resolution scope: one HTTP request, CLI invocation,
    scheduled job run, or equivalent UI dispatch. Dispose it when the scope
    ends (e.g. at the end of the request).
    """

    def __init__(self, container: "Container") -> None:
        self._container = container
        self._ledger = _InstanceLedger()
        self._disposed = False

    def resolve(self, key: str) -> Any:
        if self._disposed:
            raise RegistrationError(f"Cannot resolve {key!r} from a disposed scope.")
        reg = self._container._registration(key)
        if reg.lifecycle is Lifecycle.SINGLETON:
            return self._container._resolve_singleton(reg)
        if reg.lifecycle is Lifecycle.TRANSIENT:
            return reg.factory(self)
        return self._ledger.get_or_create(reg, self)

    def dispose(self) -> None:
        if self._disposed:
            return
        self._ledger.dispose_all(self._container._registrations)
        self._disposed = True

    def __enter__(self) -> "Scope":
        return self

    def __exit__(self, *exc_info: object) -> None:
        self.dispose()


class Container:
    """The process-wide composition container. Create one per deployable
    composition root.
    """

    def __init__(self) -> None:
        self._registrations: dict[str, Registration] = {}
        self._singletons = _InstanceLedger()

    def register_singleton(self, key: str, factory: Factory, dispose: Optional[Disposer] = None) -> None:
        self._register(key, Lifecycle.SINGLETON, factory, dispose)

    def register_transient(self, key: str, factory: Factory, dispose: Optional[Disposer] = None) -> None:
        self._register(key, Lifecycle.TRANSIENT, factory, dispose)

    def register_request_job(self, key: str, factory: Factory, dispose: Optional[Disposer] = None) -> None:
        self._register(key, Lifecycle.REQUEST_JOB, factory, dispose)

    def _register(self, key: str, lifecycle: Lifecycle, factory: Factory, dispose: Optional[Disposer]) -> None:
        if key in self._registrations:
            raise RegistrationError(f"Duplicate registration for key {key!r}.")
        self._registrations[key] = Registration(key=key, lifecycle=lifecycle, factory=factory, dispose=dispose)

    def _registration(self, key: str) -> Registration:
        try:
            return self._registrations[key]
        except KeyError as exc:
            raise RegistrationError(f"No registration for key {key!r}.") from exc

    def _resolve_singleton(self, reg: Registration) -> Any:
        return self._singletons.get_or_create(reg, self)

    def resolve(self, key: str) -> Any:
        """Resolve a `singleton` or `transient` registration. `request-job`
        registrations require an active `Scope` — use `create_scope()`.
        """
        reg = self._registration(key)
        if reg.lifecycle is Lifecycle.REQUEST_JOB:
            raise ScopeRequiredError(
                f"Key {key!r} is registered as request-job; resolve it through a Scope "
                "created with Container.create_scope()."
            )
        if reg.lifecycle is Lifecycle.SINGLETON:
            return self._resolve_singleton(reg)
        return reg.factory(self)

    def create_scope(self) -> Scope:
        return Scope(self)

    def dispose(self) -> None:
        """Dispose all singletons in reverse creation order (process shutdown)."""
        self._singletons.dispose_all(self._registrations)
