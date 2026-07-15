"""In-memory persistence test adapter.

Standard persistence ports are host/project concerns (production database
selection is explicitly out of scope for the runtime core), but every port
implementation needs an in-memory adapter for fast, deterministic tests and
adapter-contract conformance checks.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Callable, Dict, Generic, Iterator, Optional, TypeVar

KeyT = TypeVar("KeyT")
ValueT = TypeVar("ValueT")


class NotFoundError(KeyError):
    """Raised by `get()`/`remove()` when a key is absent."""


class InMemoryRepository(Generic[KeyT, ValueT]):
    """A minimal, deterministic in-memory store for persistence-port test
    doubles. Stores deep copies so callers cannot mutate stored state
    through a returned reference (matching the isolation a real adapter
    would provide).
    """

    def __init__(self, key_fn: Optional[Callable[[ValueT], KeyT]] = None) -> None:
        self._key_fn = key_fn
        self._items: Dict[KeyT, ValueT] = {}

    def _key_for(self, key: Optional[KeyT], value: ValueT) -> KeyT:
        if key is not None:
            return key
        if self._key_fn is None:
            raise ValueError("No key given and no key_fn configured.")
        return self._key_fn(value)

    def add(self, value: ValueT, key: Optional[KeyT] = None) -> KeyT:
        resolved_key = self._key_for(key, value)
        self._items[resolved_key] = deepcopy(value)
        return resolved_key

    def get(self, key: KeyT) -> ValueT:
        if key not in self._items:
            raise NotFoundError(key)
        return deepcopy(self._items[key])

    def try_get(self, key: KeyT) -> Optional[ValueT]:
        if key not in self._items:
            return None
        return deepcopy(self._items[key])

    def remove(self, key: KeyT) -> None:
        if key not in self._items:
            raise NotFoundError(key)
        del self._items[key]

    def list(self) -> list[ValueT]:
        return [deepcopy(value) for value in self._items.values()]

    def __len__(self) -> int:
        return len(self._items)

    def __iter__(self) -> Iterator[ValueT]:
        return iter(self.list())

    def clear(self) -> None:
        self._items.clear()

    def snapshot(self) -> Dict[KeyT, ValueT]:
        """A deep copy of current state, for transaction-rollback tests."""
        return deepcopy(self._items)

    def restore(self, snapshot: Dict[KeyT, ValueT]) -> None:
        self._items = deepcopy(snapshot)
