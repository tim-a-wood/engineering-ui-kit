"""A CLI invocation maps argv -> operation input through `dispatch` with the
correct exit code (§10.3), and SIGINT/SIGTERM wiring marks a
`CancellationToken` without needing to fire a real, asynchronous OS signal.
"""

from __future__ import annotations

import io
import json
import signal
from typing import Any

from engineering_ui_capabilities_runtime.cli import (
    CliCommand,
    CliHost,
    EXIT_FAILED,
    EXIT_REJECTED,
    EXIT_SUCCESS,
    install_cancellation_signal_handlers,
)
from engineering_ui_capabilities_runtime.cli.mapping import EXIT_CANCELLED, EXIT_TIMED_OUT
from engineering_ui_capabilities_runtime.core import (
    CancellationToken,
    Context,
    Deadline,
    Outcome,
)
from engineering_ui_capabilities_runtime.testing import FakeClock

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
            raise RuntimeError("boom - should never reach stderr")
        return Outcome.success({"greeting": f"hello, {input['name']}"})


def _build_input(args, stdin_text):
    return {"name": args.name}


def _add_arguments(parser):
    parser.add_argument("name")


def make_host() -> CliHost:
    host = CliHost(prog="euik-example")
    host.add_command(
        CliCommand(
            name="greet",
            operation=GreetOperation(),
            input_schema=GREET_SCHEMA,
            build_input=_build_input,
            add_arguments=_add_arguments,
        )
    )
    return host


def _run(host: CliHost, argv: list[str], **kwargs):
    stdout, stderr = io.StringIO(), io.StringIO()
    exit_code = host.run(
        argv,
        stdout=stdout,
        stderr=stderr,
        install_signal_handlers=False,
        **kwargs,
    )
    return exit_code, stdout.getvalue(), stderr.getvalue()


def test_successful_invocation_writes_the_result_to_stdout_and_exits_zero() -> None:
    exit_code, stdout, stderr = _run(make_host(), ["greet", "ada"])

    assert exit_code == EXIT_SUCCESS
    assert json.loads(stdout) == {"greeting": "hello, ada"}
    assert stderr == ""


def test_domain_rejection_writes_diagnostics_to_stderr_and_exits_nonzero() -> None:
    exit_code, stdout, stderr = _run(make_host(), ["greet", "reject-me"])

    assert exit_code == EXIT_REJECTED
    assert stdout == ""
    payload = json.loads(stderr)
    assert payload["kind"] == "rejected"
    assert payload["code"] == "not_allowed"


def test_invalid_input_is_rejected_before_reaching_the_operation() -> None:
    exit_code, stdout, stderr = _run(make_host(), ["greet", ""])

    assert exit_code == EXIT_REJECTED
    payload = json.loads(stderr)
    assert payload["code"] == "invalid_input"


def test_unhandled_exception_maps_to_a_safe_failure_exit_code() -> None:
    exit_code, stdout, stderr = _run(make_host(), ["greet", "explode"])

    assert exit_code == EXIT_FAILED
    payload = json.loads(stderr)
    assert payload["kind"] == "failed"
    assert "boom" not in payload["safe_message"]


def test_already_cancelled_token_short_circuits_to_the_cancelled_exit_code() -> None:
    cancellation = CancellationToken()
    cancellation.cancel(reason="test-cancel")

    exit_code, stdout, stderr = _run(make_host(), ["greet", "ada"], cancellation=cancellation)

    assert exit_code == EXIT_CANCELLED
    assert json.loads(stderr)["kind"] == "cancelled"


def test_expired_deadline_maps_to_the_timed_out_exit_code() -> None:
    host = CliHost(prog="euik-example")
    clock = FakeClock()
    deadline = Deadline.after(seconds=1, clock=clock)
    clock.advance(2)

    def context_factory(correlation_id, args):
        return Context(correlation_id=correlation_id, deadline=deadline, clock=clock)

    host.add_command(
        CliCommand(
            name="greet",
            operation=GreetOperation(),
            input_schema=GREET_SCHEMA,
            build_input=_build_input,
            add_arguments=_add_arguments,
            context_factory=context_factory,
        )
    )

    exit_code, stdout, stderr = _run(host, ["greet", "ada"])

    assert exit_code == EXIT_TIMED_OUT
    assert json.loads(stderr)["kind"] == "timed_out"


def test_correlation_id_flag_is_propagated_into_the_context() -> None:
    seen_correlation_ids: list[str] = []

    def context_factory(correlation_id, args):
        seen_correlation_ids.append(correlation_id)
        return Context(correlation_id=correlation_id)

    host = CliHost(prog="euik-example")
    host.add_command(
        CliCommand(
            name="greet",
            operation=GreetOperation(),
            input_schema=GREET_SCHEMA,
            build_input=_build_input,
            add_arguments=_add_arguments,
            context_factory=context_factory,
        )
    )

    _run(host, ["--correlation-id", "corr-fixed", "greet", "ada"])

    assert seen_correlation_ids == ["corr-fixed"]


def test_stdin_is_read_only_when_the_command_declares_reads_stdin() -> None:
    def build_input_from_stdin(args, stdin_text):
        return {"name": (stdin_text or "").strip()}

    host = CliHost(prog="euik-example")
    host.add_command(
        CliCommand(
            name="greet-stdin",
            operation=GreetOperation(),
            input_schema=GREET_SCHEMA,
            build_input=build_input_from_stdin,
            reads_stdin=True,
        )
    )

    stdout, stderr = io.StringIO(), io.StringIO()
    exit_code = host.run(
        ["greet-stdin"],
        stdin=io.StringIO("ada\n"),
        stdout=stdout,
        stderr=stderr,
        install_signal_handlers=False,
    )

    assert exit_code == EXIT_SUCCESS
    assert json.loads(stdout.getvalue()) == {"greeting": "hello, ada"}


def test_install_cancellation_signal_handlers_marks_the_token_and_restores_prior_handlers() -> None:
    cancellation = CancellationToken()
    original_handler = signal.getsignal(signal.SIGINT)

    restore = install_cancellation_signal_handlers(cancellation, signals=(signal.SIGINT,))
    try:
        installed_handler = signal.getsignal(signal.SIGINT)
        assert installed_handler is not original_handler

        # Invoke the installed handler directly rather than delivering a
        # real, asynchronous OS signal, so this test is deterministic.
        installed_handler(signal.SIGINT, None)

        assert cancellation.is_cancelled()
        assert "SIGINT" in cancellation.reason
    finally:
        restore()

    assert signal.getsignal(signal.SIGINT) is original_handler
