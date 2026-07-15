"""Cross-cutting proof (WP4A-hosts Group D) that the host foundations added
in this packet all reach the same `dispatch` boundary and behave per
§10.3/§15.3/§15.4, using a single shared operation across HTTP and CLI to
demonstrate the parity the packet asks for ("mirroring the shape the
TypeScript host foundation established: real request -> operation ->
outcome").
"""

from __future__ import annotations

import io
import json
import sys
from typing import Any

import httpx
from starlette.testclient import TestClient

from engineering_ui_capabilities_runtime.adapters.http_client import (
    OutboundHttpAdapter,
    OutboundHttpRequest,
)
from engineering_ui_capabilities_runtime.adapters.process import (
    ProcessAdapter,
    ShellMetacharacterError,
)
from engineering_ui_capabilities_runtime.cli import CliCommand, CliHost, EXIT_SUCCESS
from engineering_ui_capabilities_runtime.core import Context, Outcome
from engineering_ui_capabilities_runtime.http import HttpOperationHost
from engineering_ui_capabilities_runtime.testing.secrets import assert_no_leak
from engineering_ui_capabilities_runtime.worker.cron import CronSchedule
from engineering_ui_capabilities_runtime.worker.clock import FakeWallClock

GREET_SCHEMA = {
    "type": "object",
    "properties": {"name": {"type": "string", "minLength": 1}},
    "required": ["name"],
    "additionalProperties": False,
}


class GreetOperation:
    """The single shared operation both the HTTP and CLI cross-cutting
    checks drive through `dispatch`, proving both hosts reach the exact
    same operation behavior (parity)."""

    def execute(self, input: dict, context: Context) -> Any:
        return Outcome.success({"greeting": f"hello, {input['name']}"})


def test_a_real_fastapi_request_reaches_the_operation_through_dispatch() -> None:
    host = HttpOperationHost()
    host.add_operation("/greet", GreetOperation(), GREET_SCHEMA)
    client = TestClient(host.app)

    response = client.post("/greet", json={"name": "ada"})

    assert response.status_code == 200
    assert response.json() == {"kind": "success", "value": {"greeting": "hello, ada"}}


def test_a_cli_invocation_maps_argv_to_the_same_operation_with_the_correct_exit_code() -> None:
    host = CliHost(prog="euik-example")
    host.add_command(
        CliCommand(
            name="greet",
            operation=GreetOperation(),
            input_schema=GREET_SCHEMA,
            build_input=lambda args, stdin_text: {"name": args.name},
            add_arguments=lambda parser: parser.add_argument("name"),
        )
    )
    stdout, stderr = io.StringIO(), io.StringIO()

    exit_code = host.run(["greet", "ada"], stdout=stdout, stderr=stderr, install_signal_handlers=False)

    assert exit_code == EXIT_SUCCESS
    assert json.loads(stdout.getvalue()) == {"greeting": "hello, ada"}
    assert stderr.getvalue() == ""


def test_http_and_cli_hosts_agree_on_success_for_the_same_operation_and_input() -> None:
    """Cross-language/cross-host parity check within Python itself: the
    same `Operation` reached through two different inbound hosts produces
    the same domain result.
    """

    host = HttpOperationHost()
    host.add_operation("/greet", GreetOperation(), GREET_SCHEMA)
    client = TestClient(host.app)
    http_result = client.post("/greet", json={"name": "grace"}).json()["value"]

    cli_host = CliHost(prog="euik-example")
    cli_host.add_command(
        CliCommand(
            name="greet",
            operation=GreetOperation(),
            input_schema=GREET_SCHEMA,
            build_input=lambda args, stdin_text: {"name": args.name},
            add_arguments=lambda parser: parser.add_argument("name"),
        )
    )
    stdout = io.StringIO()
    cli_host.run(["greet", "grace"], stdout=stdout, stderr=io.StringIO(), install_signal_handlers=False)
    cli_result = json.loads(stdout.getvalue())

    assert http_result == cli_result == {"greeting": "hello, grace"}


def test_cron_next_run_is_correct_under_an_injected_clock() -> None:
    clock = FakeWallClock()
    schedule = CronSchedule.parse("0 9 * * *", timezone="UTC")

    next_run = schedule.next_run_after(clock.now())

    assert next_run.hour == 9
    assert next_run.minute == 0
    assert next_run > clock.now()


def test_process_adapter_rejects_a_shell_command_string_executable_and_uses_argv(tmp_path) -> None:
    adapter = ProcessAdapter(allowed_working_roots=[tmp_path])

    # Rejects an executable that looks like a shell command.
    try:
        adapter.run("ls; rm -rf /", [], cwd=tmp_path)
    except ShellMetacharacterError:
        pass
    else:
        raise AssertionError("Expected ShellMetacharacterError for a shell-command-like executable")

    # Uses argv: a value with shell metacharacters is passed through as
    # literal data to the child process, never shell-interpreted.
    result = adapter.run(sys.executable, ["-c", "import sys; print(sys.argv[1])", "a;b|c"], cwd=tmp_path)
    assert result.stdout.strip() == "a;b|c"


def test_outbound_http_adapter_redacts_a_credential_canary() -> None:
    canary = "canary-secret-do-not-leak"

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"ok": True})

    adapter = OutboundHttpAdapter(transport=httpx.MockTransport(handler))
    request = OutboundHttpRequest(
        method="GET",
        url="https://example.test/resource",
        headers={"Authorization": f"Bearer {canary}"},
    )

    # The real call still succeeds (the canary is a valid header value on
    # the wire) ...
    response = adapter.send(request)
    assert response.status_code == 200

    # ... but any safe-to-log diagnostic summary never contains it.
    summary = adapter.diagnostic_summary(request)
    assert_no_leak(json.dumps(summary), canary)


def test_health_vs_readiness_are_distinct_endpoints_with_distinct_semantics() -> None:
    from engineering_ui_capabilities_runtime.telemetry.health import HealthCheckResult, HealthStatus

    def down_check() -> HealthCheckResult:
        return HealthCheckResult(name="required-adapter", status=HealthStatus.DOWN, detail="unavailable")

    host = HttpOperationHost(readiness_checks=[down_check])
    client = TestClient(host.app)

    liveness = client.get("/healthz")
    readiness = client.get("/readyz")

    # Liveness ("the process event loop is functioning") is unaffected by
    # a downstream adapter being unavailable.
    assert liveness.status_code == 200
    assert liveness.json()["status"] == "ok"

    # Readiness ("required configuration and mandatory adapters are
    # available") reflects the down dependency.
    assert readiness.status_code == 503
    assert readiness.json()["status"] == "down"
