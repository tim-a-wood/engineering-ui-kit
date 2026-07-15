"""Health/readiness routes (§15.4): "Liveness means the process event loop
is functioning. Readiness means required configuration and mandatory
adapters are available."
"""

from __future__ import annotations

from typing import Iterable

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from ..telemetry.health import HealthStatus, ReadinessCheck, liveness_check, readiness_report

LIVENESS_PATH = "/healthz"
READINESS_PATH = "/readyz"


def add_health_routes(app: FastAPI, readiness_checks: Iterable[ReadinessCheck] = ()) -> None:
    checks = list(readiness_checks)

    async def liveness_endpoint() -> JSONResponse:
        result = liveness_check()
        return JSONResponse(status_code=200, content={"status": result.status.value, "detail": result.detail})

    async def readiness_endpoint() -> JSONResponse:
        report = readiness_report(checks)
        # Readiness gates traffic: DOWN must fail the check (503) so an
        # orchestrator stops routing to this instance. DEGRADED still
        # accepts traffic (200) but reports the detail for observability.
        status_code = 503 if report.status is HealthStatus.DOWN else 200
        return JSONResponse(
            status_code=status_code,
            content={
                "status": report.status.value,
                "checks": [
                    {"name": check.name, "status": check.status.value, "detail": check.detail}
                    for check in report.checks
                ],
            },
        )

    app.router.add_api_route(LIVENESS_PATH, liveness_endpoint, methods=["GET"])
    app.router.add_api_route(READINESS_PATH, readiness_endpoint, methods=["GET"])
