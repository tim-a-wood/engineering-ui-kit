"""`argparse`-based command host (§7.1, §10.3): parses argv/options/stdin
into an operation input, drives it through `dispatch`, and maps the
`Outcome` to an exit code, with results on stdout and diagnostics on
stderr. Mirrors the HTTP host's request -> operation -> outcome shape.
"""

from __future__ import annotations

import argparse
import json
import sys
import uuid
from dataclasses import dataclass, field, replace
from typing import Any, Callable, IO, Mapping, Optional, Sequence

from ..core.cancellation import CancellationToken
from ..core.context import Context
from ..core.dispatch import Operation, dispatch
from .mapping import outcome_diagnostic_payload, outcome_exit_code
from .signals import DEFAULT_CANCELLATION_SIGNALS, install_cancellation_signal_handlers

BuildInput = Callable[[argparse.Namespace, Optional[str]], Any]
AddArguments = Callable[[argparse.ArgumentParser], None]
CliContextFactory = Callable[[str, argparse.Namespace], Context]


def _default_add_arguments(parser: argparse.ArgumentParser) -> None:
    return None


def default_cli_context_factory(correlation_id: str, args: argparse.Namespace) -> Context:
    return Context(correlation_id=correlation_id)


@dataclass(frozen=True)
class CliCommand:
    """A single subcommand: argv -> operation input -> `dispatch`."""

    name: str
    operation: "Operation[Any]"
    input_schema: Mapping[str, Any]
    build_input: BuildInput
    operation_id: Optional[str] = None
    observed_path: Optional[Mapping[str, Any]] = None
    add_arguments: AddArguments = field(default=_default_add_arguments)
    context_factory: CliContextFactory = field(default=default_cli_context_factory)
    reads_stdin: bool = False
    help: Optional[str] = None


class CliHost:
    """An `argparse`-based multi-command host. `run()` is the single
    entry point a generated `__main__` calls with `sys.argv[1:]`.
    """

    def __init__(self, prog: str, description: Optional[str] = None) -> None:
        self._parser = argparse.ArgumentParser(prog=prog, description=description)
        self._parser.add_argument(
            "--correlation-id",
            dest="correlation_id",
            default=None,
            help="Correlation ID to propagate; a new one is generated if omitted.",
        )
        self._subparsers = self._parser.add_subparsers(dest="command", required=True)
        self._commands: dict[str, CliCommand] = {}

    def add_command(self, command: CliCommand) -> None:
        if command.name in self._commands:
            raise ValueError(f"Duplicate CLI command name: {command.name!r}")
        subparser = self._subparsers.add_parser(command.name, help=command.help)
        command.add_arguments(subparser)
        subparser.set_defaults(_euik_command=command.name)
        self._commands[command.name] = command

    def run(
        self,
        argv: Sequence[str],
        *,
        stdin: Optional[IO[str]] = None,
        stdout: Optional[IO[str]] = None,
        stderr: Optional[IO[str]] = None,
        cancellation: Optional[CancellationToken] = None,
        install_signal_handlers: bool = True,
        signals: Sequence[int] = DEFAULT_CANCELLATION_SIGNALS,
        verification_correlation_id: Optional[str] = None,
    ) -> int:
        """Parses `argv`, dispatches the selected command's operation, and
        returns a process exit code (never raises for a normal
        rejection/failure/cancellation/timeout — only `argparse` usage
        errors, e.g. an unknown command, raise/exit via `argparse` itself).
        """

        stdin = stdin if stdin is not None else sys.stdin
        stdout = stdout if stdout is not None else sys.stdout
        stderr = stderr if stderr is not None else sys.stderr

        args = self._parser.parse_args(list(argv))
        command = self._commands[args._euik_command]

        correlation_id = args.correlation_id or uuid.uuid4().hex
        cancellation = cancellation if cancellation is not None else CancellationToken()

        restore_signals: Optional[Callable[[], None]] = None
        if install_signal_handlers:
            restore_signals = install_cancellation_signal_handlers(cancellation, signals=signals)
        try:
            stdin_text = stdin.read() if command.reads_stdin else None
            input_value = command.build_input(args, stdin_text)
            context = command.context_factory(correlation_id, args)
            context = replace(context, cancellation=cancellation)
            outcome = dispatch(command.operation, input_value, context, input_schema=command.input_schema)
            exit_code = _emit_outcome(outcome, stdout, stderr)
            if outcome.kind == "success" and verification_correlation_id and command.observed_path:
                stderr.write(
                    "EUIK_CONNECTION_EVIDENCE="
                    + json.dumps(
                        {
                            "correlationId": verification_correlation_id,
                            "operation": command.operation_id,
                            "observedPath": command.observed_path,
                        },
                        separators=(",", ":"),
                    )
                    + "\n"
                )
            return exit_code
        finally:
            if restore_signals is not None:
                restore_signals()


def _emit_outcome(outcome: Any, stdout: IO[str], stderr: IO[str]) -> int:
    if outcome.kind == "success":
        stdout.write(json.dumps(outcome.value, default=str) + "\n")
        return outcome_exit_code(outcome)
    stderr.write(json.dumps(outcome_diagnostic_payload(outcome), default=str) + "\n")
    return outcome_exit_code(outcome)
