"""Outcome -> HTTP response mapping (§10.3 "HTTP: ... safe error mapping").

Every `Outcome` kind maps to a fixed, documented status code and a typed
JSON envelope. `Failed.safe_message` is the only failure text ever placed
in the body — never a traceback or raw exception value.
"""

from __future__ import annotations

from typing import Any

from ..core.outcomes import AnyOutcome

CORRELATION_HEADER = "X-Correlation-Id"

#: HTTP status used for `Outcome.cancelled`. 499 ("Client Closed Request")
#: is a widely recognized nginx convention for "the request was cancelled
#: before a normal status could be produced"; it is not in the IANA HTTP
#: status registry, but `Response`/`JSONResponse` accept any integer.
CANCELLED_STATUS = 499

#: HTTP status used for `Outcome.timed_out` (server-side deadline exceeded).
TIMED_OUT_STATUS = 504

#: HTTP status used for `Outcome.rejected` (a domain rejection, including
#: dispatch's own `invalid_input` schema-validation rejection).
REJECTED_STATUS = 422

#: HTTP status used for `Outcome.failed` (a technical failure).
FAILED_STATUS = 500


def outcome_envelope(outcome: AnyOutcome) -> dict[str, Any]:
    """The JSON body for an outcome, independent of status code. Shared by
    the response mapper and any other host that wants the same shape
    (evidence capture, logging previews, etc).
    """

    kind = outcome.kind
    if kind == "success":
        return {"kind": "success", "value": outcome.value}
    if kind == "rejected":
        return {"kind": "rejected", "code": outcome.code, "details": outcome.details}
    if kind == "failed":
        return {
            "kind": "failed",
            "code": outcome.code,
            "safe_message": outcome.safe_message,
            "retryable": outcome.retryable,
            "cause_ref": outcome.cause_ref,
        }
    if kind == "cancelled":
        return {"kind": "cancelled", "reason": outcome.reason}
    if kind == "timed_out":
        return {"kind": "timed_out", "deadline": outcome.deadline}
    raise TypeError(f"Unknown outcome kind: {kind!r}")  # pragma: no cover - defensive


def outcome_status_code(outcome: AnyOutcome, *, success_status: int = 200) -> int:
    kind = outcome.kind
    if kind == "success":
        return success_status
    if kind == "rejected":
        return REJECTED_STATUS
    if kind == "failed":
        return FAILED_STATUS
    if kind == "cancelled":
        return CANCELLED_STATUS
    if kind == "timed_out":
        return TIMED_OUT_STATUS
    raise TypeError(f"Unknown outcome kind: {kind!r}")  # pragma: no cover - defensive
