"""A real FastAPI request reaches an operation through `dispatch` and
returns its mapped `Outcome` (§10.3, §7.1). Uses Starlette's `TestClient`
(in-process ASGI transport — no real network socket, no live server to
leak between tests).
"""

from __future__ import annotations

from typing import Any

from starlette.testclient import TestClient

from engineering_ui_capabilities_runtime.core import Context, Outcome
from engineering_ui_capabilities_runtime.http import (
    CORRELATION_HEADER,
    HttpOperationHost,
)

GREET_SCHEMA = {
    "type": "object",
    "properties": {"name": {"type": "string", "minLength": 1}},
    "required": ["name"],
    "additionalProperties": False,
}


class GreetOperation:
    def execute(self, input: dict, context: Context) -> Any:
        if input["name"] == "reject-me":
            return Outcome.rejected(code="not_allowed", details={"name": input["name"]})
        if input["name"] == "explode":
            raise RuntimeError("boom - should never reach the client")
        return Outcome.success({"greeting": f"hello, {input['name']}"})


def make_host() -> HttpOperationHost:
    host = HttpOperationHost()
    host.add_operation(
        "/greet",
        GreetOperation(),
        GREET_SCHEMA,
        operation_id="op.greet",
        observed_path={
            "inboundAdapter": "http:greet",
            "compositionRoot": "composition_root.py",
            "operation": "op.greet@1.0.0",
            "outboundAdapters": [],
        },
    )
    return host


def test_real_request_reaches_the_operation_and_returns_success() -> None:
    client = TestClient(make_host().app)

    response = client.post("/greet", json={"name": "ada"})

    assert response.status_code == 200
    assert response.headers["x-euik-observed-operation"] == "op.greet"
    assert "op.greet@1.0.0" in response.headers["x-euik-observed-path"]
    assert response.json() == {"kind": "success", "value": {"greeting": "hello, ada"}}


def test_correlation_id_is_echoed_when_supplied() -> None:
    client = TestClient(make_host().app)

    response = client.post("/greet", json={"name": "ada"}, headers={CORRELATION_HEADER: "corr-123"})

    assert response.headers[CORRELATION_HEADER] == "corr-123"


def test_correlation_id_is_generated_when_absent() -> None:
    client = TestClient(make_host().app)

    response = client.post("/greet", json={"name": "ada"})

    assert response.headers[CORRELATION_HEADER]


def test_invalid_input_is_rejected_with_422_before_reaching_the_operation() -> None:
    client = TestClient(make_host().app)

    response = client.post("/greet", json={})

    assert response.status_code == 422
    body = response.json()
    assert body["kind"] == "rejected"
    assert body["code"] == "invalid_input"


def test_domain_rejection_maps_to_422() -> None:
    client = TestClient(make_host().app)

    response = client.post("/greet", json={"name": "reject-me"})

    assert response.status_code == 422
    assert response.json()["kind"] == "rejected"
    assert response.json()["code"] == "not_allowed"


def test_unhandled_exception_maps_to_a_safe_500_failure_without_a_traceback() -> None:
    client = TestClient(make_host().app, raise_server_exceptions=False)

    response = client.post("/greet", json={"name": "explode"})

    assert response.status_code == 500
    body = response.json()
    assert body["kind"] == "failed"
    assert "boom" not in body["safe_message"]
    assert "RuntimeError" not in str(body)


def test_malformed_json_body_is_a_400_not_a_500() -> None:
    client = TestClient(make_host().app)

    response = client.post("/greet", content=b"{not json", headers={"content-type": "application/json"})

    assert response.status_code == 400
    assert response.json()["code"] == "invalid_json"


def test_liveness_route_is_always_ok() -> None:
    client = TestClient(make_host().app)

    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_readiness_route_reports_down_as_503() -> None:
    from engineering_ui_capabilities_runtime.telemetry.health import HealthCheckResult, HealthStatus

    def failing_check() -> HealthCheckResult:
        return HealthCheckResult(name="database", status=HealthStatus.DOWN, detail="unreachable")

    host = HttpOperationHost(readiness_checks=[failing_check])
    client = TestClient(host.app)

    response = client.get("/readyz")

    assert response.status_code == 503
    assert response.json()["status"] == "down"


def test_readiness_route_reports_ok_when_all_checks_pass() -> None:
    from engineering_ui_capabilities_runtime.telemetry.health import HealthCheckResult, HealthStatus

    def passing_check() -> HealthCheckResult:
        return HealthCheckResult(name="database", status=HealthStatus.OK)

    host = HttpOperationHost(readiness_checks=[passing_check])
    client = TestClient(host.app)

    response = client.get("/readyz")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_openapi_consistency_check_passes_for_a_correctly_registered_route() -> None:
    host = make_host()

    host.assert_openapi_consistent()  # must not raise


def test_openapi_consistency_check_detects_documentation_drift() -> None:
    from engineering_ui_capabilities_runtime.http.openapi import OpenApiConsistencyError, assert_operation_schema_in_openapi

    host = make_host()
    drifted_schema = {**GREET_SCHEMA, "required": []}

    try:
        assert_operation_schema_in_openapi(host.app, "/greet", "POST", drifted_schema)
    except OpenApiConsistencyError:
        pass
    else:
        raise AssertionError("Expected OpenApiConsistencyError for a drifted schema")
