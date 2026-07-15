"""Outcome construction and guard functions (CAP-ERA-001 SS10.1)."""

from engineering_ui_capabilities_runtime.core import (
    Cancelled,
    Failed,
    Outcome,
    Rejected,
    Success,
    TimedOut,
    is_cancelled,
    is_failed,
    is_outcome,
    is_rejected,
    is_success,
    is_timed_out,
)


def test_success_constructs_and_guards() -> None:
    outcome = Outcome.success({"orderId": "o-1"})
    assert isinstance(outcome, Success)
    assert is_success(outcome)
    assert not is_rejected(outcome)
    assert not is_failed(outcome)
    assert not is_cancelled(outcome)
    assert not is_timed_out(outcome)
    assert outcome.value == {"orderId": "o-1"}


def test_rejected_is_a_domain_outcome_not_an_error() -> None:
    outcome = Outcome.rejected("insufficient_funds", {"balance": 0})
    assert isinstance(outcome, Rejected)
    assert is_rejected(outcome)
    assert outcome.code == "insufficient_funds"
    assert outcome.details == {"balance": 0}


def test_failed_carries_only_safe_fields() -> None:
    outcome = Outcome.failed(
        code="downstream_unavailable",
        safe_message="The downstream service is temporarily unavailable.",
        retryable=True,
        cause_ref="cause-123",
    )
    assert isinstance(outcome, Failed)
    assert is_failed(outcome)
    assert outcome.retryable is True
    assert outcome.cause_ref == "cause-123"


def test_cancelled_and_timed_out() -> None:
    cancelled = Outcome.cancelled("client disconnected")
    assert isinstance(cancelled, Cancelled)
    assert is_cancelled(cancelled)
    assert cancelled.reason == "client disconnected"

    timed_out = Outcome.timed_out("2026-07-15T00:00:00Z")
    assert isinstance(timed_out, TimedOut)
    assert is_timed_out(timed_out)
    assert timed_out.deadline == "2026-07-15T00:00:00Z"


def test_is_outcome_guard() -> None:
    assert is_outcome(Outcome.success(1))
    assert is_outcome(Outcome.rejected("x", {}))
    assert not is_outcome({"kind": "success", "value": 1})
    assert not is_outcome(None)


def test_outcomes_are_frozen() -> None:
    outcome = Outcome.success(1)
    try:
        outcome.value = 2  # type: ignore[misc]
    except Exception:
        pass
    else:
        raise AssertionError("Success outcome should be immutable")
