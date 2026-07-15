"""Cancellation and deadline enforcement in `dispatch` (CAP-ERA-001 SS10.1),
using deterministic injected clocks/tokens rather than real sleeps.
"""

from __future__ import annotations

from typing import Any

from engineering_ui_capabilities_runtime.core import (
    CancellationToken,
    Context,
    Deadline,
    DeadlineExceededError,
    Outcome,
    OperationCancelledError,
    dispatch,
    is_cancelled,
    is_success,
    is_timed_out,
)
from engineering_ui_capabilities_runtime.testing import FakeClock


class EchoOperation:
    def execute(self, input: dict, context: Context) -> Any:
        return Outcome.success(input.get("value"))


class RaisesCancelledMidExecutionOperation:
    """Simulates cancellation observed only after `execute` is already
    running (e.g. a signal arrived mid-flight) — the token is untouched at
    dispatch time, so this exercises the exception-conversion path rather
    than the pre-execute cancellation check.
    """

    def execute(self, input: dict, context: Context) -> Any:
        raise OperationCancelledError("shutdown requested mid-flight")


class RaisesDeadlineExceededMidExecutionOperation:
    """Simulates a deadline discovered only inside `execute`, exercising the
    exception-conversion path rather than the pre-execute deadline check.
    """

    def execute(self, input: dict, context: Context) -> Any:
        assert context.deadline is not None
        raise DeadlineExceededError(context.deadline)


def test_dispatch_returns_cancelled_when_token_already_cancelled() -> None:
    token = CancellationToken()
    token.cancel("client disconnected")
    context = Context(correlation_id="c1", cancellation=token)

    outcome = dispatch(EchoOperation(), {"value": 1}, context)

    assert is_cancelled(outcome)
    assert outcome.reason == "client disconnected"


def test_dispatch_converts_cancellation_raised_from_inside_execute() -> None:
    # The token itself is not cancelled, so dispatch's pre-execute check
    # passes and the operation's own raise is what dispatch must convert.
    context = Context(correlation_id="c2", cancellation=CancellationToken())

    outcome = dispatch(RaisesCancelledMidExecutionOperation(), {}, context)

    assert is_cancelled(outcome)
    assert outcome.reason == "shutdown requested mid-flight"


def test_dispatch_returns_timed_out_when_deadline_already_expired() -> None:
    clock = FakeClock(start=100.0)
    deadline = Deadline(expires_at_monotonic=90.0, label="past-deadline")
    context = Context(correlation_id="c3", deadline=deadline, clock=clock)

    outcome = dispatch(EchoOperation(), {"value": 1}, context)

    assert is_timed_out(outcome)
    assert outcome.deadline == "past-deadline"


def test_dispatch_succeeds_before_deadline_and_times_out_after_clock_advances() -> None:
    clock = FakeClock(start=0.0)
    deadline = Deadline.after(seconds=10.0, clock=clock, label="+10s")
    context = Context(correlation_id="c4", deadline=deadline, clock=clock)

    still_ok = dispatch(EchoOperation(), {"value": 1}, context)
    assert is_success(still_ok)

    clock.advance(10.0)

    now_expired = dispatch(EchoOperation(), {"value": 1}, context)
    assert is_timed_out(now_expired)


def test_dispatch_converts_deadline_exceeded_raised_inside_execute() -> None:
    # A deadline that has not yet expired at dispatch time, so the
    # pre-execute check passes and the operation's own raise (simulating a
    # deadline crossed mid-flight) is what dispatch must convert.
    clock = FakeClock(start=0.0)
    deadline = Deadline.after(seconds=5.0, clock=clock, label="+5s")
    context = Context(correlation_id="c5", deadline=deadline, clock=clock)

    outcome = dispatch(RaisesDeadlineExceededMidExecutionOperation(), {}, context)

    assert is_timed_out(outcome)
    assert outcome.deadline == "+5s"


def test_cancellation_token_raises_when_cancelled() -> None:
    token = CancellationToken()
    assert token.is_cancelled() is False
    token.raise_if_cancelled()  # no-op

    token.cancel("stop")
    assert token.is_cancelled() is True
    try:
        token.raise_if_cancelled()
    except OperationCancelledError as exc:
        assert exc.reason == "stop"
    else:
        raise AssertionError("expected OperationCancelledError")


def test_deadline_raises_when_exceeded() -> None:
    clock = FakeClock(start=0.0)
    deadline = Deadline.after(seconds=1.0, clock=clock, label="+1s")
    deadline.raise_if_exceeded(clock)  # no-op, not yet expired

    clock.advance(1.0)
    try:
        deadline.raise_if_exceeded(clock)
    except DeadlineExceededError as exc:
        assert exc.deadline is deadline
    else:
        raise AssertionError("expected DeadlineExceededError")
