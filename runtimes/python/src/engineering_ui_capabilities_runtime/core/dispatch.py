"""`Operation` protocol and `dispatch` — the boundary described in §10.1:

    Operation<Input, Success, DomainRejection, TechnicalFailure>
      execute(input, context) -> Outcome

`dispatch`:

- validates `input` against a supplied JSON Schema (Draft 2020-12);
- runs `execute`;
- catches exceptions at the boundary and converts them to a safe `failed`
  outcome (no traceback/secret leak);
- keeps a returned `rejected` as a domain rejection (not an error path);
- enforces the deadline -> `timed_out`;
- honors cancellation -> `cancelled`.
"""

from __future__ import annotations

import uuid
from typing import Any, Mapping, Optional, Protocol, TypeVar, runtime_checkable

from jsonschema import Draft202012Validator

from .cancellation import OperationCancelledError
from .context import Context
from .correlation import correlation_scope
from .deadline import DeadlineExceededError
from .errors import TechnicalFailureError
from .outcomes import AnyOutcome, Outcome, is_outcome

InputT = TypeVar("InputT")
InputT_contra = TypeVar("InputT_contra", contravariant=True)


@runtime_checkable
class Operation(Protocol[InputT_contra]):
    """A framework-neutral unit of application behavior."""

    def execute(self, input: InputT_contra, context: Context) -> AnyOutcome: ...


def _validation_error_details(validator: Draft202012Validator, input_value: Any) -> list[dict[str, Any]]:
    errors = sorted(validator.iter_errors(input_value), key=lambda e: list(e.absolute_path))
    return [
        {
            "path": list(error.absolute_path),
            "message": error.message,
            "validator": error.validator,
        }
        for error in errors
    ]


def dispatch(
    operation: "Operation[InputT]",
    input: InputT,
    context: Context,
    input_schema: Optional[Mapping[str, Any]] = None,
) -> AnyOutcome:
    with correlation_scope(context.correlation_id):
        if input_schema is not None:
            validator = Draft202012Validator(dict(input_schema))
            details = _validation_error_details(validator, input)
            if details:
                return Outcome.rejected(code="invalid_input", details=details)

        if context.cancellation.is_cancelled():
            return Outcome.cancelled(context.cancellation.reason)

        if context.deadline is not None and context.deadline.is_expired(context.clock):
            return Outcome.timed_out(context.deadline.isoformat())

        try:
            outcome = operation.execute(input, context)
        except OperationCancelledError as exc:
            return Outcome.cancelled(exc.reason)
        except DeadlineExceededError as exc:
            return Outcome.timed_out(exc.deadline.isoformat())
        except TechnicalFailureError as exc:
            return Outcome.failed(
                code=exc.code,
                safe_message=exc.safe_message,
                retryable=exc.retryable,
                cause_ref=exc.cause_ref,
            )
        except Exception as exc:  # noqa: BLE001 - intentional dispatcher safety boundary
            cause_ref = uuid.uuid4().hex
            context.logger.error(
                "operation.unhandled_exception",
                correlation_id=context.correlation_id,
                cause_ref=cause_ref,
                exception_type=type(exc).__name__,
            )
            return Outcome.failed(
                code="unhandled_exception",
                safe_message="An unexpected error occurred while processing the request.",
                retryable=False,
                cause_ref=cause_ref,
            )

        if not is_outcome(outcome):
            raise TypeError(f"Operation.execute must return an Outcome, got {type(outcome)!r}")

        return outcome
