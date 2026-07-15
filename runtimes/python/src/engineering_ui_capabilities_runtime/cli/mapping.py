"""Outcome -> CLI exit code / diagnostic-payload mapping (§10.3
"CLI: ... nonzero exit codes for rejection/failure, stdout for results,
stderr for diagnostics").
"""

from __future__ import annotations

from typing import Any

from ..core.outcomes import AnyOutcome

EXIT_SUCCESS = 0
EXIT_REJECTED = 1
EXIT_FAILED = 2
#: Conventional shell exit code for "terminated by SIGINT" (128 + signal 2).
EXIT_CANCELLED = 130
#: Conventional exit code used by GNU coreutils' `timeout` for "timed out".
EXIT_TIMED_OUT = 124


def outcome_exit_code(outcome: AnyOutcome) -> int:
    kind = outcome.kind
    if kind == "success":
        return EXIT_SUCCESS
    if kind == "rejected":
        return EXIT_REJECTED
    if kind == "failed":
        return EXIT_FAILED
    if kind == "cancelled":
        return EXIT_CANCELLED
    if kind == "timed_out":
        return EXIT_TIMED_OUT
    raise TypeError(f"Unknown outcome kind: {kind!r}")  # pragma: no cover - defensive


def outcome_diagnostic_payload(outcome: AnyOutcome) -> dict[str, Any]:
    """The structured payload written to stderr for any non-success
    outcome. Never includes a traceback or secret value: `Failed` already
    only carries `safe_message`/`cause_ref` (never the raw exception).
    """

    kind = outcome.kind
    if kind == "rejected":
        return {"kind": kind, "code": outcome.code, "details": outcome.details}
    if kind == "failed":
        return {
            "kind": kind,
            "code": outcome.code,
            "safe_message": outcome.safe_message,
            "retryable": outcome.retryable,
            "cause_ref": outcome.cause_ref,
        }
    if kind == "cancelled":
        return {"kind": kind, "reason": outcome.reason}
    if kind == "timed_out":
        return {"kind": kind, "deadline": outcome.deadline}
    raise TypeError(f"outcome_diagnostic_payload is only for non-success outcomes, got {kind!r}")
