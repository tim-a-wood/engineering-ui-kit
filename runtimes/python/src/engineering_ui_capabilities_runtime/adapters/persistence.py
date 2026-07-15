"""Persistence port + in-memory foundation adapter (§7.1 "adapters ...
persistence port foundations").

Production persistence implementation is explicitly a host/project concern
(§7.3); this module defines only the port protocol every persistence
adapter must satisfy, plus a deterministic in-memory implementation for
early-stage composition and conformance testing (see
`testing.adapter_contract` to prove any other adapter satisfies the same
port).
"""

from __future__ import annotations

from copy import deepcopy
from typing import Callable, Dict, Generic, Iterator, Optional, Protocol, TypeVar, runtime_checkable

KeyT = TypeVar("KeyT")
ValueT = TypeVar("ValueT")


class PersistenceKeyNotFoundError(KeyError):
    pass


@runtime_checkable
class PersistencePort(Protocol[KeyT, ValueT]):
    """The minimal persistence port shape every concrete adapter (SQL,
    document store, in-memory) must satisfy.
    """

    def add(self, value: ValueT, key: Optional[KeyT] = None) -> KeyT: ...

    def get(self, key: KeyT) -> ValueT: ...

    def try_get(self, key: KeyT) -> Optional[ValueT]: ...

    def remove(self, key: KeyT) -> None: ...

    def list(self) -> list[ValueT]: ...


class InMemoryPersistenceAdapter(Generic[KeyT, ValueT]):
    """Implements `PersistencePort`. Stores deep copies so callers cannot
    mutate stored state through a returned reference, matching the
    isolation guarantee a real adapter provides.
    """

    def __init__(self, key_fn: Optional[Callable[[ValueT], KeyT]] = None) -> None:
        self._key_fn = key_fn
        self._items: Dict[KeyT, ValueT] = {}

    def _resolve_key(self, key: Optional[KeyT], value: ValueT) -> KeyT:
        if key is not None:
            return key
        if self._key_fn is None:
            raise ValueError("No key given and no key_fn configured to derive one from the value")
        return self._key_fn(value)

    def add(self, value: ValueT, key: Optional[KeyT] = None) -> KeyT:
        resolved_key = self._resolve_key(key, value)
        self._items[resolved_key] = deepcopy(value)
        return resolved_key

    def get(self, key: KeyT) -> ValueT:
        if key not in self._items:
            raise PersistenceKeyNotFoundError(key)
        return deepcopy(self._items[key])

    def try_get(self, key: KeyT) -> Optional[ValueT]:
        if key not in self._items:
            return None
        return deepcopy(self._items[key])

    def remove(self, key: KeyT) -> None:
        if key not in self._items:
            raise PersistenceKeyNotFoundError(key)
        del self._items[key]

    def list(self) -> list[ValueT]:
        return [deepcopy(value) for value in self._items.values()]

    def __len__(self) -> int:
        return len(self._items)

    def __iter__(self) -> Iterator[ValueT]:
        return iter(self.list())
