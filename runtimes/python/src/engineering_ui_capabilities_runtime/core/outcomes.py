"""Outcome — the canonical, language-neutral operation result shape.

Per CAP-ERA-001 §10.1:

    Outcome
      success(value)
      rejected(code, details)
      failed(code, safeMessage, retryable, causeReference?)
      cancelled(reason)
      timedOut(deadline)

Domain rejection (`Rejected`) is not an exception; it is a normal return
value produced by `Operation.execute`. Thrown exceptions are caught at the
`dispatch` boundary and converted to `Failed` with a safe message — never a
traceback or secret value.
"""

from __future__ import annotations

from typing import Any, Generic, Literal, Optional, TypeVar, Union

from pydantic import BaseModel, ConfigDict

SuccessValueT = TypeVar("SuccessValueT")
RejectionDetailsT = TypeVar("RejectionDetailsT")


class Success(BaseModel, Generic[SuccessValueT]):
    """The operation completed and produced a value."""

    model_config = ConfigDict(frozen=True)

    kind: Literal["success"] = "success"
    value: SuccessValueT


class Rejected(BaseModel, Generic[RejectionDetailsT]):
    """A domain rejection. Not an exception/error — a normal outcome."""

    model_config = ConfigDict(frozen=True)

    kind: Literal["rejected"] = "rejected"
    code: str
    details: RejectionDetailsT


class Failed(BaseModel):
    """A technical failure. `safe_message` MUST NOT contain secrets or
    exception internals; `cause_ref` is an opaque reference an operator can
    use to look up full diagnostics out of band (e.g. in server-side logs),
    never the raw exception or traceback.
    """

    model_config = ConfigDict(frozen=True)

    kind: Literal["failed"] = "failed"
    code: str
    safe_message: str
    retryable: bool
    cause_ref: Optional[str] = None


class Cancelled(BaseModel):
    """The operation was cancelled before or during execution."""

    model_config = ConfigDict(frozen=True)

    kind: Literal["cancelled"] = "cancelled"
    reason: str


class TimedOut(BaseModel):
    """The operation did not complete before its deadline."""

    model_config = ConfigDict(frozen=True)

    kind: Literal["timed_out"] = "timed_out"
    deadline: str


AnyOutcome = Union[Success[Any], Rejected[Any], Failed, Cancelled, TimedOut]

_OUTCOME_KINDS = (Success, Rejected, Failed, Cancelled, TimedOut)


class Outcome:
    """Namespace of Outcome constructors, mirroring the language-neutral
    shape from §10.1 (`Outcome.success(value)`, `Outcome.rejected(...)`, ...).
    """

    Success = Success
    Rejected = Rejected
    Failed = Failed
    Cancelled = Cancelled
    TimedOut = TimedOut

    def __init__(self) -> None:  # pragma: no cover - defensive
        raise TypeError("Outcome is a namespace of constructors; do not instantiate it.")

    @staticmethod
    def success(value: SuccessValueT) -> Success[SuccessValueT]:
        return Success[Any](value=value)

    @staticmethod
    def rejected(code: str, details: RejectionDetailsT) -> Rejected[RejectionDetailsT]:
        return Rejected[Any](code=code, details=details)

    @staticmethod
    def failed(
        code: str,
        safe_message: str,
        retryable: bool,
        cause_ref: Optional[str] = None,
    ) -> Failed:
        return Failed(code=code, safe_message=safe_message, retryable=retryable, cause_ref=cause_ref)

    @staticmethod
    def cancelled(reason: str) -> Cancelled:
        return Cancelled(reason=reason)

    @staticmethod
    def timed_out(deadline: str) -> TimedOut:
        return TimedOut(deadline=deadline)


def is_success(outcome: AnyOutcome) -> bool:
    return isinstance(outcome, Success)


def is_rejected(outcome: AnyOutcome) -> bool:
    return isinstance(outcome, Rejected)


def is_failed(outcome: AnyOutcome) -> bool:
    return isinstance(outcome, Failed)


def is_cancelled(outcome: AnyOutcome) -> bool:
    return isinstance(outcome, Cancelled)


def is_timed_out(outcome: AnyOutcome) -> bool:
    return isinstance(outcome, TimedOut)


def is_outcome(value: Any) -> bool:
    return isinstance(value, _OUTCOME_KINDS)
