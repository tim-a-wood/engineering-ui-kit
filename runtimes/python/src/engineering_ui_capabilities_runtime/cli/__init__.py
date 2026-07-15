"""`argparse`-based command host integration (§7.1, §10.3): argv/options/
stdin -> operation input -> `dispatch` -> exit code, with results on stdout
and diagnostics on stderr, and cancellation on process signals.
"""

from __future__ import annotations

from .host import CliCommand, CliContextFactory, CliHost, default_cli_context_factory
from .mapping import (
    EXIT_CANCELLED,
    EXIT_FAILED,
    EXIT_REJECTED,
    EXIT_SUCCESS,
    EXIT_TIMED_OUT,
    outcome_diagnostic_payload,
    outcome_exit_code,
)
from .signals import DEFAULT_CANCELLATION_SIGNALS, RestoreSignals, install_cancellation_signal_handlers

__all__ = [
    "CliCommand",
    "CliContextFactory",
    "CliHost",
    "DEFAULT_CANCELLATION_SIGNALS",
    "EXIT_CANCELLED",
    "EXIT_FAILED",
    "EXIT_REJECTED",
    "EXIT_SUCCESS",
    "EXIT_TIMED_OUT",
    "RestoreSignals",
    "default_cli_context_factory",
    "install_cancellation_signal_handlers",
    "outcome_diagnostic_payload",
    "outcome_exit_code",
]
