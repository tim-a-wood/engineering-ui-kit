"""Maps a real HTTP request to an `Operation` through `dispatch` (§10.3):

    request -> (validate against the operation's JSON Schema) -> execute -> Outcome -> response

Correlation IDs are read from `X-Correlation-Id` if the caller supplied one,
otherwise generated; the same header is always echoed back on the response
so a caller can correlate its own logs with server-side ones (§15.4).
"""

from __future__ import annotations

import json
import uuid
from typing import Any, Awaitable, Callable, Mapping, Optional

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from starlette.requests import Request

from ..core.context import Context
from ..core.dispatch import Operation, dispatch
from ..core.outcomes import AnyOutcome
from .mapping import CORRELATION_HEADER, outcome_envelope, outcome_status_code

ContextFactory = Callable[[str, Request], Context]

#: Endpoint signature FastAPI/Starlette will call for a registered route.
Endpoint = Callable[[Request], Awaitable[JSONResponse]]


def default_context_factory(correlation_id: str, request: Request) -> Context:
    return Context(correlation_id=correlation_id)


def correlation_id_from_request(request: Request) -> str:
    header_value = request.headers.get(CORRELATION_HEADER)
    return header_value if header_value else uuid.uuid4().hex


def outcome_to_response(
    outcome: AnyOutcome,
    correlation_id: str,
    *,
    success_status: int = 200,
) -> JSONResponse:
    status_code = outcome_status_code(outcome, success_status=success_status)
    body = outcome_envelope(outcome)
    return JSONResponse(status_code=status_code, content=body, headers={CORRELATION_HEADER: correlation_id})


def _invalid_json_response(correlation_id: str) -> JSONResponse:
    body = {"kind": "rejected", "code": "invalid_json", "details": {"message": "Request body is not valid JSON."}}
    return JSONResponse(status_code=400, content=body, headers={CORRELATION_HEADER: correlation_id})


def create_operation_endpoint(
    operation: "Operation[Any]",
    input_schema: Mapping[str, Any],
    *,
    context_factory: ContextFactory = default_context_factory,
    success_status: int = 200,
) -> Endpoint:
    """Builds an ASGI endpoint function suitable for `app.add_api_route`.

    The endpoint reads the raw JSON request body as operation input (no
    implicit coercion — schema validation happens inside `dispatch`),
    builds a `Context`, and always returns the mapped `Outcome`.
    """

    async def endpoint(request: Request) -> JSONResponse:
        correlation_id = correlation_id_from_request(request)
        raw_body = await request.body()
        if raw_body:
            try:
                input_value = json.loads(raw_body)
            except json.JSONDecodeError:
                return _invalid_json_response(correlation_id)
        else:
            input_value = {}
        context = context_factory(correlation_id, request)
        outcome = dispatch(operation, input_value, context, input_schema=input_schema)
        return outcome_to_response(outcome, correlation_id, success_status=success_status)

    return endpoint


def add_operation_route(
    app: FastAPI,
    path: str,
    operation: "Operation[Any]",
    input_schema: Mapping[str, Any],
    *,
    method: str = "POST",
    context_factory: ContextFactory = default_context_factory,
    success_status: int = 200,
    summary: Optional[str] = None,
) -> None:
    """Registers `operation` at `path`/`method`, embedding `input_schema`
    verbatim in the generated OpenAPI document (`openapi_extra`) so the
    documented request body always matches what `dispatch` validates
    against — see `http.openapi.assert_operation_schema_in_openapi`.
    """

    endpoint = create_operation_endpoint(
        operation,
        input_schema,
        context_factory=context_factory,
        success_status=success_status,
    )
    app.router.add_api_route(
        path,
        endpoint,
        methods=[method.upper()],
        summary=summary,
        openapi_extra={
            "requestBody": {
                "content": {"application/json": {"schema": dict(input_schema)}},
                "required": True,
            }
        },
    )
