"""Health/readiness (§15.4).

"Liveness means the process event loop is functioning. Readiness means
required configuration and mandatory adapters are available."
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Iterable, Optional


class HealthStatus(str, Enum):
    OK = "ok"
    DEGRADED = "degraded"
    DOWN = "down"


@dataclass(frozen=True)
class HealthCheckResult:
    name: str
    status: HealthStatus
    detail: Optional[str] = None


ReadinessCheck = Callable[[], HealthCheckResult]


def liveness_check() -> HealthCheckResult:
    """Trivially true when this code runs at all: the process event loop
    (or, for a synchronous host, the interpreter) is functioning.
    """

    return HealthCheckResult(name="liveness", status=HealthStatus.OK, detail="process responsive")


def _worst(statuses: Iterable[HealthStatus]) -> HealthStatus:
    ordered = [HealthStatus.OK, HealthStatus.DEGRADED, HealthStatus.DOWN]
    worst = HealthStatus.OK
    for status in statuses:
        if ordered.index(status) > ordered.index(worst):
            worst = status
    return worst


@dataclass(frozen=True)
class ReadinessReport:
    status: HealthStatus
    checks: list[HealthCheckResult] = field(default_factory=list)


def readiness_report(checks: Iterable[ReadinessCheck]) -> ReadinessReport:
    """Runs every required-adapter/configuration readiness check and
    reports the worst observed status. A check that raises is treated as
    `down` rather than crashing the readiness endpoint.
    """

    results: list[HealthCheckResult] = []
    for check in checks:
        try:
            results.append(check())
        except Exception as exc:  # noqa: BLE001 - readiness boundary must not crash
            results.append(
                HealthCheckResult(
                    name=getattr(check, "__name__", "check"),
                    status=HealthStatus.DOWN,
                    detail=f"raised {type(exc).__name__}",
                )
            )
    return ReadinessReport(status=_worst(r.status for r in results), checks=results)
