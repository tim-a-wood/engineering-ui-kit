"""JSON console logging, correlation propagation, tracing hooks, and
health/readiness (§15.4). Correlation propagation itself lives in
`core.correlation` (via `contextvars`) since `dispatch` establishes the
active scope; this package supplies concrete `Logger`/`Tracer`
implementations and health/readiness reporting.
"""

from __future__ import annotations

from ..core.correlation import correlation_scope, get_current_correlation_id
from .health import (
    HealthCheckResult,
    HealthStatus,
    ReadinessCheck,
    ReadinessReport,
    liveness_check,
    readiness_report,
)
from .json_logging import JsonConsoleLogger
from .tracing import JsonLoggingTracer

__all__ = [
    "HealthCheckResult",
    "HealthStatus",
    "JsonConsoleLogger",
    "JsonLoggingTracer",
    "ReadinessCheck",
    "ReadinessReport",
    "correlation_scope",
    "get_current_correlation_id",
    "liveness_check",
    "readiness_report",
]
