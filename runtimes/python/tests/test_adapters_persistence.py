"""In-memory persistence adapter conforms to `PersistencePort` (§7.1
"adapters ... persistence port foundations"), proved with
`testing.AdapterContractHarness` so any other concrete adapter can share
the same conformance suite.
"""

from __future__ import annotations

import pytest

from engineering_ui_capabilities_runtime.adapters.persistence import (
    InMemoryPersistenceAdapter,
    PersistenceKeyNotFoundError,
    PersistencePort,
)
from engineering_ui_capabilities_runtime.testing import AdapterContractHarness


def _make_populated_adapter() -> InMemoryPersistenceAdapter:
    adapter: InMemoryPersistenceAdapter = InMemoryPersistenceAdapter()
    adapter.add({"name": "ada"}, key="ada")
    return adapter


def test_in_memory_adapter_is_a_persistence_port() -> None:
    assert isinstance(_make_populated_adapter(), PersistencePort)


def test_add_and_get_round_trip() -> None:
    adapter: InMemoryPersistenceAdapter = InMemoryPersistenceAdapter()

    key = adapter.add({"name": "ada"}, key="ada")

    assert key == "ada"
    assert adapter.get("ada") == {"name": "ada"}


def test_get_raises_for_a_missing_key() -> None:
    adapter: InMemoryPersistenceAdapter = InMemoryPersistenceAdapter()

    with pytest.raises(PersistenceKeyNotFoundError):
        adapter.get("missing")


def test_try_get_returns_none_for_a_missing_key() -> None:
    adapter: InMemoryPersistenceAdapter = InMemoryPersistenceAdapter()

    assert adapter.try_get("missing") is None


def test_stored_values_are_isolated_from_the_caller_via_deep_copy() -> None:
    adapter: InMemoryPersistenceAdapter = InMemoryPersistenceAdapter()
    original = {"tags": ["a"]}

    adapter.add(original, key="k")
    original["tags"].append("mutated-after-add")

    assert adapter.get("k") == {"tags": ["a"]}


def test_remove_deletes_the_entry() -> None:
    adapter = _make_populated_adapter()

    adapter.remove("ada")

    assert adapter.try_get("ada") is None


def test_list_returns_all_stored_values() -> None:
    adapter: InMemoryPersistenceAdapter = InMemoryPersistenceAdapter()
    adapter.add({"name": "ada"}, key="ada")
    adapter.add({"name": "grace"}, key="grace")

    assert sorted(adapter.list(), key=lambda v: v["name"]) == [{"name": "ada"}, {"name": "grace"}]


def test_key_fn_derives_the_key_when_none_is_given() -> None:
    adapter: InMemoryPersistenceAdapter = InMemoryPersistenceAdapter(key_fn=lambda value: value["id"])

    key = adapter.add({"id": "derived-key", "name": "ada"})

    assert key == "derived-key"
    assert adapter.get("derived-key")["name"] == "ada"


def test_adapter_contract_harness_proves_conformance_for_the_in_memory_adapter() -> None:
    harness: AdapterContractHarness[InMemoryPersistenceAdapter] = AdapterContractHarness()
    harness.add_case(
        name="add_then_get_round_trips",
        invoke=lambda adapter: (adapter.add({"id": "x"}, key="x"), adapter.get("x"))[1],
        expect=lambda result: result == {"id": "x"},
    )
    harness.add_case(
        name="remove_then_try_get_is_none",
        invoke=lambda adapter: (adapter.remove("x"), adapter.try_get("x"))[1],
        expect=lambda result: result is None,
    )

    harness.assert_conforms(InMemoryPersistenceAdapter())
