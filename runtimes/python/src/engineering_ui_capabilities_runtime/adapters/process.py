"""Process/command adapter foundation (§15.3 "Process/command adapters use
argument arrays, explicit executables, allowed working roots, bounded
output, timeout, and cancellation. Shell interpolation is not the
default.").

Always invokes `subprocess.Popen` with an explicit argv list and
`shell=False` — never a shell string — so shell metacharacters in an
*argument* are inert data, not syntax (e.g. a chunk of source code passed
to `python -c` may legitimately contain `;`, `()`, etc.). `run()`
additionally rejects shell metacharacters in the *executable* itself, so a
caller cannot accidentally pass a shell command string (`"ls; rm -rf /"`)
where an explicit executable path/name is required.
"""

from __future__ import annotations

import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Optional, Sequence, Union

from ..core.cancellation import CancellationToken, OperationCancelledError

#: Characters that have special meaning to a shell. Rejecting them in any
#: argv element is a defense-in-depth check: this adapter never invokes a
#: shell, so these characters are already inert, but their presence in an
#: argument usually signals the caller meant to build a shell command
#: string rather than an argv array.
SHELL_METACHARACTERS: frozenset[str] = frozenset(";&|<>`$(){}*?[]!\n")


class ShellMetacharacterError(ValueError):
    pass


class DisallowedWorkingDirectoryError(ValueError):
    pass


@dataclass(frozen=True)
class CommandResult:
    exit_code: int
    stdout: str
    stderr: str
    timed_out: bool = False


def reject_shell_metacharacters_in_executable(executable: str) -> None:
    """Rejects shell metacharacters in the *executable* only.

    Arguments are never shell-interpreted by this adapter (`shell=False`
    always), so arbitrary characters in an argument — including characters
    that would be dangerous if concatenated into a shell command string,
    such as `;`, `|`, `` ` `` — are simply literal data (e.g. a chunk of
    source code passed to `python -c`). The executable name/path is
    different: a caller who lets an *executable* string contain shell
    metacharacters is very likely building a shell command by mistake, so
    this is rejected outright as defense-in-depth.
    """

    found = SHELL_METACHARACTERS.intersection(executable)
    if found:
        raise ShellMetacharacterError(
            f"Executable {executable!r} contains shell metacharacter(s) {sorted(found)!r}; "
            "pass an explicit executable path/name, not a shell command string"
        )


def _truncate(text: str, max_bytes: int) -> str:
    encoded = text.encode("utf-8", errors="surrogateescape")
    if len(encoded) <= max_bytes:
        return text
    return encoded[:max_bytes].decode("utf-8", errors="ignore") + "...<truncated>"


class ProcessAdapter:
    """Runs an explicit executable with an argument array under a working
    directory that must be within one of `allowed_working_roots`. Enforces
    a wall-clock timeout and bounded stdout/stderr, and supports cooperative
    cancellation via a `CancellationToken` (checked before starting, and
    polled while the process runs).
    """

    def __init__(
        self,
        allowed_working_roots: Sequence[Union[str, Path]],
        *,
        timeout_seconds: float = 10.0,
        max_output_bytes: int = 1_000_000,
        poll_interval_seconds: float = 0.02,
    ) -> None:
        if not allowed_working_roots:
            raise ValueError("At least one allowed working root is required")
        self._allowed_roots = [Path(root).resolve() for root in allowed_working_roots]
        self._timeout_seconds = timeout_seconds
        self._max_output_bytes = max_output_bytes
        self._poll_interval_seconds = poll_interval_seconds

    def _validate_cwd(self, cwd: Union[str, Path]) -> Path:
        resolved = Path(cwd).resolve()
        for root in self._allowed_roots:
            try:
                resolved.relative_to(root)
                return resolved
            except ValueError:
                continue
        raise DisallowedWorkingDirectoryError(
            f"{cwd!r} (resolved to {resolved}) is not under any allowed working root: {self._allowed_roots}"
        )

    def run(
        self,
        executable: str,
        arguments: Sequence[str],
        *,
        cwd: Union[str, Path],
        env: Optional[Mapping[str, str]] = None,
        cancellation: Optional[CancellationToken] = None,
    ) -> CommandResult:
        if not isinstance(executable, str) or not executable:
            raise ValueError("executable must be an explicit, non-empty string")
        reject_shell_metacharacters_in_executable(executable)
        argv = [executable, *arguments]
        resolved_cwd = self._validate_cwd(cwd)

        if cancellation is not None and cancellation.is_cancelled():
            raise OperationCancelledError(cancellation.reason)

        process = subprocess.Popen(  # noqa: S603 - argv array, shell=False by construction; see module docstring
            argv,
            cwd=str(resolved_cwd),
            env=dict(env) if env is not None else None,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

        started_at = time.monotonic()
        try:
            while True:
                try:
                    stdout, stderr = process.communicate(timeout=self._poll_interval_seconds)
                    return CommandResult(
                        exit_code=process.returncode,
                        stdout=_truncate(stdout, self._max_output_bytes),
                        stderr=_truncate(stderr, self._max_output_bytes),
                    )
                except subprocess.TimeoutExpired:
                    if cancellation is not None and cancellation.is_cancelled():
                        process.kill()
                        process.communicate()
                        raise OperationCancelledError(cancellation.reason)
                    if time.monotonic() - started_at >= self._timeout_seconds:
                        process.kill()
                        process.communicate()
                        return CommandResult(exit_code=-1, stdout="", stderr="", timed_out=True)
        finally:
            if process.poll() is None:
                process.kill()
                process.communicate()
