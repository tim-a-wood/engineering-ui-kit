"""FastAPI router/host integration (§7.1, §10.3): maps a real HTTP request
to an `Operation` through `dispatch`, returns the typed outcome with safe
status/error mapping, exposes health/readiness routes, propagates the
correlation ID, and offers an OpenAPI-consistency check helper.
"""

from __future__ import annotations

from .health_routes import LIVENESS_PATH, READINESS_PATH, add_health_routes
from .host import HttpOperationHost
from .mapping import (
    CANCELLED_STATUS,
    CORRELATION_HEADER,
    FAILED_STATUS,
    REJECTED_STATUS,
    TIMED_OUT_STATUS,
    outcome_envelope,
    outcome_status_code,
)
from .openapi import OpenApiConsistencyError, assert_operation_schema_in_openapi, documented_request_schema
from .routing import (
    ContextFactory,
    add_operation_route,
    correlation_id_from_request,
    create_operation_endpoint,
    default_context_factory,
    outcome_to_response,
)

__all__ = [
    "CANCELLED_STATUS",
    "CORRELATION_HEADER",
    "ContextFactory",
    "FAILED_STATUS",
    "HttpOperationHost",
    "LIVENESS_PATH",
    "OpenApiConsistencyError",
    "READINESS_PATH",
    "REJECTED_STATUS",
    "TIMED_OUT_STATUS",
    "add_health_routes",
    "add_operation_route",
    "assert_operation_schema_in_openapi",
    "correlation_id_from_request",
    "create_operation_endpoint",
    "default_context_factory",
    "documented_request_schema",
    "outcome_envelope",
    "outcome_status_code",
    "outcome_to_response",
]
