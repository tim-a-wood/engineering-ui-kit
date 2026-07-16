"""`HttpOperationHost` — the FastAPI host wrapper described in §7.1/§10.3:
composes operation routes, health/readiness routes, and an OpenAPI
consistency check over a single `FastAPI` app.
"""

from __future__ import annotations

from typing import Any, Iterable, Mapping, Optional

from fastapi import FastAPI

from ..core.dispatch import Operation
from ..telemetry.health import ReadinessCheck
from .health_routes import add_health_routes
from .openapi import assert_operation_schema_in_openapi
from .routing import ContextFactory, add_operation_route, default_context_factory


class HttpOperationHost:
    """A minimal FastAPI-backed host: register operations, get health and
    readiness routes for free, and validate OpenAPI/runtime consistency
    before shipping.
    """

    def __init__(
        self,
        app: Optional[FastAPI] = None,
        *,
        readiness_checks: Iterable[ReadinessCheck] = (),
        title: str = "Engineering UI Capabilities Runtime",
    ) -> None:
        self.app = app if app is not None else FastAPI(title=title)
        add_health_routes(self.app, readiness_checks)
        self._registered_routes: dict[tuple[str, str], Mapping[str, Any]] = {}

    def add_operation(
        self,
        path: str,
        operation: "Operation[Any]",
        input_schema: Mapping[str, Any],
        *,
        method: str = "POST",
        context_factory: ContextFactory = default_context_factory,
        success_status: int = 200,
        summary: Optional[str] = None,
        operation_id: Optional[str] = None,
        observed_path: Optional[Mapping[str, Any]] = None,
    ) -> None:
        add_operation_route(
            self.app,
            path,
            operation,
            input_schema,
            method=method,
            context_factory=context_factory,
            success_status=success_status,
            summary=summary,
            operation_id=operation_id,
            observed_path=observed_path,
        )
        self._registered_routes[(method.upper(), path)] = input_schema

    def assert_openapi_consistent(self) -> None:
        """Verifies every registered operation's documented request-body
        schema in the generated OpenAPI document matches the schema
        `dispatch` actually validates against.
        """

        for (method, path), schema in self._registered_routes.items():
            assert_operation_schema_in_openapi(self.app, path, method, schema)
