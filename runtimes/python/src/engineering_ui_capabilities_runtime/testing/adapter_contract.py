"""A tiny harness for proving a concrete adapter satisfies a port's
contract: a fixed list of behavioral cases run against any adapter instance
that claims to implement the port, so an in-memory test adapter and a real
adapter can share the same conformance suite.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Generic, TypeVar

AdapterT = TypeVar("AdapterT")


@dataclass(frozen=True)
class AdapterContractCase(Generic[AdapterT]):
    name: str
    invoke: Callable[[AdapterT], Any]
    expect: Callable[[Any], bool]


@dataclass(frozen=True)
class AdapterContractFailure:
    case_name: str
    detail: str


class AdapterContractHarness(Generic[AdapterT]):
    """Register `AdapterContractCase`s once per port; run them against any
    number of adapter implementations.
    """

    def __init__(self, cases: list[AdapterContractCase[AdapterT]] | None = None) -> None:
        self._cases: list[AdapterContractCase[AdapterT]] = list(cases or [])

    def add_case(
        self,
        name: str,
        invoke: Callable[[AdapterT], Any],
        expect: Callable[[Any], bool],
    ) -> None:
        self._cases.append(AdapterContractCase(name=name, invoke=invoke, expect=expect))

    def run(self, adapter: AdapterT) -> list[AdapterContractFailure]:
        failures: list[AdapterContractFailure] = []
        for case in self._cases:
            try:
                result = case.invoke(adapter)
            except Exception as exc:  # noqa: BLE001 - harness reports, does not crash
                failures.append(AdapterContractFailure(case.name, f"raised {type(exc).__name__}: {exc}"))
                continue
            if not case.expect(result):
                failures.append(AdapterContractFailure(case.name, f"unexpected result: {result!r}"))
        return failures

    def assert_conforms(self, adapter: AdapterT) -> None:
        failures = self.run(adapter)
        if failures:
            detail = "; ".join(f"{f.case_name}: {f.detail}" for f in failures)
            raise AssertionError(f"Adapter does not conform to contract: {detail}")
