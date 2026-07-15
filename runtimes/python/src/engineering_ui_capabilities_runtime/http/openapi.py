"""OpenAPI-consistency check helper (§7.1 "OpenAPI router/host integration
and OpenAPI consistency checks").

`add_operation_route` embeds each operation's canonical JSON Schema verbatim
into the generated OpenAPI document via `openapi_extra`. This module proves
there is no drift between what is documented and what `dispatch` actually
validates against, so a generated OpenAPI artifact can never silently
disagree with runtime behavior.
"""

from __future__ import annotations

from typing import Any, Mapping

from fastapi import FastAPI


class OpenApiConsistencyError(AssertionError):
    pass


def documented_request_schema(app: FastAPI, path: str, method: str) -> Mapping[str, Any]:
    spec = app.openapi()
    try:
        path_item = spec["paths"][path]
        operation_spec = path_item[method.lower()]
        return operation_spec["requestBody"]["content"]["application/json"]["schema"]
    except KeyError as exc:
        raise OpenApiConsistencyError(
            f"No documented JSON request body schema for {method.upper()} {path} in the generated OpenAPI document."
        ) from exc


def assert_operation_schema_in_openapi(
    app: FastAPI,
    path: str,
    method: str,
    input_schema: Mapping[str, Any],
) -> None:
    """Raises `OpenApiConsistencyError` if the OpenAPI document's request
    body schema for `method path` does not equal `input_schema` exactly.
    """

    documented = documented_request_schema(app, path, method)
    if documented != dict(input_schema):
        raise OpenApiConsistencyError(
            f"OpenAPI request body schema for {method.upper()} {path} does not match the operation's "
            "input schema (documentation/runtime drift detected)."
        )
