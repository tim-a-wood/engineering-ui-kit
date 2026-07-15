"""`dispatch` boundary behavior (CAP-ERA-001 SS10.1):

- a raised exception becomes a safe `failed` outcome (no traceback/secret leak);
- a returned `rejected` stays a domain rejection, not an error path;
- a returned `success` passes through unchanged.
"""

from __future__ import annotations

from typing import Any

from engineering_ui_capabilities_runtime.core import (
    Context,
    Outcome,
    TechnicalFailureError,
    dispatch,
    is_failed,
    is_rejected,
    is_success,
)
from engineering_ui_capabilities_runtime.testing import InMemoryLogger


class EchoOperation:
    def execute(self, input: dict, context: Context) -> Any:
        return Outcome.success(input["value"])


class RejectingOperation:
    def execute(self, input: dict, context: Context) -> Any:
        return Outcome.rejected("already_approved", {"orderId": input["orderId"]})


class RaisingOperation:
    def execute(self, input: dict, context: Context) -> Any:
        raise ValueError("connection string: postgres://user:canary-db-secret@host/db")


class SafeTechnicalFailureOperation:
    def execute(self, input: dict, context: Context) -> Any:
        raise TechnicalFailureError(
            code="downstream_unavailable",
            safe_message="The downstream service is temporarily unavailable.",
            retryable=True,
        )


class InvalidReturnOperation:
    def execute(self, input: dict, context: Context) -> Any:
        return {"not": "an outcome"}


def _context(logger: InMemoryLogger | None = None) -> Context:
    return Context(correlation_id="corr-1", logger=logger or InMemoryLogger())


def test_dispatch_passes_through_success() -> None:
    outcome = dispatch(EchoOperation(), {"value": 42}, _context())
    assert is_success(outcome)
    assert outcome.value == 42


def test_dispatch_keeps_returned_rejection_as_domain_rejection() -> None:
    outcome = dispatch(RejectingOperation(), {"orderId": "o-1"}, _context())
    assert is_rejected(outcome)
    assert outcome.code == "already_approved"
    assert outcome.details == {"orderId": "o-1"}


def test_dispatch_converts_raised_exception_to_safe_failed() -> None:
    logger = InMemoryLogger()
    outcome = dispatch(RaisingOperation(), {}, _context(logger))

    assert is_failed(outcome)
    assert outcome.code == "unhandled_exception"
    assert outcome.retryable is False
    assert outcome.cause_ref is not None

    serialized = outcome.model_dump_json()
    assert "canary-db-secret" not in serialized
    assert "canary-db-secret" not in outcome.safe_message
    assert "canary-db-secret" not in logger.text()


def test_dispatch_uses_operation_supplied_safe_technical_failure() -> None:
    outcome = dispatch(SafeTechnicalFailureOperation(), {}, _context())
    assert is_failed(outcome)
    assert outcome.code == "downstream_unavailable"
    assert outcome.retryable is True


def test_dispatch_rejects_operation_that_returns_a_non_outcome() -> None:
    try:
        dispatch(InvalidReturnOperation(), {}, _context())
    except TypeError:
        pass
    else:
        raise AssertionError("dispatch should reject a non-Outcome return value")
