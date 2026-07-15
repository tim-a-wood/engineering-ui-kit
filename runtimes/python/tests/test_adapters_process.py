"""Process/command adapter: argv arrays (no shell), allowed working roots,
bounded output/timeout, and cooperative cancellation (§15.3).
"""

from __future__ import annotations

import sys
import threading
from pathlib import Path

import pytest

from engineering_ui_capabilities_runtime.adapters.process import (
    DisallowedWorkingDirectoryError,
    ProcessAdapter,
    ShellMetacharacterError,
    reject_shell_metacharacters_in_executable,
)
from engineering_ui_capabilities_runtime.core import CancellationToken, OperationCancelledError

PYTHON = sys.executable


def test_run_executes_an_explicit_executable_with_argv_and_captures_stdout(tmp_path: Path) -> None:
    adapter = ProcessAdapter(allowed_working_roots=[tmp_path])

    result = adapter.run(PYTHON, ["-c", "print('hello-argv')"], cwd=tmp_path)

    assert result.exit_code == 0
    assert result.stdout.strip() == "hello-argv"
    assert result.timed_out is False


def test_run_passes_shell_like_argument_values_as_literal_argv_data_not_shell_syntax(tmp_path: Path) -> None:
    """A value that would be dangerous if concatenated into a shell command
    string (semicolons, backticks, `$()`) is just literal argv data here —
    proving the adapter never goes through a shell. `sys.argv[1]` in the
    spawned interpreter must equal exactly what was passed, unexecuted.
    """

    adapter = ProcessAdapter(allowed_working_roots=[tmp_path])
    dangerous_value = "; rm -rf / #`whoami`$(id)"

    result = adapter.run(
        PYTHON,
        ["-c", "import sys; print(sys.argv[1])", dangerous_value],
        cwd=tmp_path,
    )

    assert result.exit_code == 0
    assert result.stdout.strip() == dangerous_value


@pytest.mark.parametrize(
    "executable",
    ["ls; rm -rf /", "`whoami`", "prog && evil", "prog | evil", "prog > /etc/passwd"],
)
def test_reject_shell_metacharacters_in_executable_rejects_shell_command_strings(executable: str) -> None:
    with pytest.raises(ShellMetacharacterError):
        reject_shell_metacharacters_in_executable(executable)


def test_run_rejects_an_executable_that_looks_like_a_shell_command_before_spawning(tmp_path: Path) -> None:
    adapter = ProcessAdapter(allowed_working_roots=[tmp_path])

    with pytest.raises(ShellMetacharacterError):
        adapter.run("ls; rm -rf /", [], cwd=tmp_path)


def test_run_rejects_a_working_directory_outside_the_allowed_roots(tmp_path: Path) -> None:
    allowed_root = tmp_path / "allowed"
    allowed_root.mkdir()
    disallowed = tmp_path / "disallowed"
    disallowed.mkdir()
    adapter = ProcessAdapter(allowed_working_roots=[allowed_root])

    with pytest.raises(DisallowedWorkingDirectoryError):
        adapter.run(PYTHON, ["-c", "print(1)"], cwd=disallowed)


def test_run_truncates_output_beyond_the_configured_bound(tmp_path: Path) -> None:
    adapter = ProcessAdapter(allowed_working_roots=[tmp_path], max_output_bytes=10)

    result = adapter.run(PYTHON, ["-c", "print('x' * 1000)"], cwd=tmp_path)

    assert len(result.stdout.encode("utf-8")) <= 10 + len("...<truncated>")
    assert result.stdout.endswith("...<truncated>")


def test_run_enforces_the_configured_timeout(tmp_path: Path) -> None:
    adapter = ProcessAdapter(allowed_working_roots=[tmp_path], timeout_seconds=0.2, poll_interval_seconds=0.02)

    result = adapter.run(PYTHON, ["-c", "import time; time.sleep(5)"], cwd=tmp_path)

    assert result.timed_out is True
    assert result.exit_code == -1


def test_run_honors_an_already_cancelled_token_before_spawning(tmp_path: Path) -> None:
    adapter = ProcessAdapter(allowed_working_roots=[tmp_path])
    cancellation = CancellationToken()
    cancellation.cancel(reason="test-cancel-before-start")

    with pytest.raises(OperationCancelledError):
        adapter.run(PYTHON, ["-c", "print(1)"], cwd=tmp_path, cancellation=cancellation)


def test_run_is_cancelled_mid_execution(tmp_path: Path) -> None:
    """Cancelling the token shortly after the subprocess starts kills it
    well before the (much longer) `sleep(30)` or the adapter's own
    30-second timeout would otherwise elapse, proving cancellation is
    polled during execution, not only checked up front.
    """

    adapter = ProcessAdapter(
        allowed_working_roots=[tmp_path],
        timeout_seconds=30.0,
        poll_interval_seconds=0.02,
    )
    cancellation = CancellationToken()
    timer = threading.Timer(0.1, lambda: cancellation.cancel(reason="mid-execution-cancel"))
    timer.start()
    try:
        with pytest.raises(OperationCancelledError):
            adapter.run(
                PYTHON,
                ["-c", "import time; time.sleep(30)"],
                cwd=tmp_path,
                cancellation=cancellation,
            )
    finally:
        timer.cancel()
