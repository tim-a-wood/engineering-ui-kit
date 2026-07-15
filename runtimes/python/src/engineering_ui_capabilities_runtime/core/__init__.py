"""Framework-neutral core: dispatcher, outcomes, validation, lifecycle
container, configuration/secret protocols, cancellation and timeouts.

See CAP-ERA-001 §7.1, §10.1, §10.2.
"""

from __future__ import annotations

from .cancellation import CancellationToken, OperationCancelledError
from .clock import Clock, SystemClock
from .config import ConfigReader, ConfigurationKeyError, MappingConfigReader
from .context import AuthHook, Context
from .correlation import correlation_scope, get_current_correlation_id
from .deadline import Deadline, DeadlineExceededError
from .dispatch import Operation, dispatch
from .errors import TechnicalFailureError
from .lifecycle import (
    Container,
    Lifecycle,
    RegistrationError,
    Scope,
    ScopeRequiredError,
)
from .outcomes import (
    AnyOutcome,
    Cancelled,
    Failed,
    Outcome,
    Rejected,
    Success,
    TimedOut,
    is_cancelled,
    is_failed,
    is_outcome,
    is_rejected,
    is_success,
    is_timed_out,
)
from .secrets import RedactedSecret, SecretReference, SecretResolver
from .telemetry_protocols import Logger, NullLogger, NullTracer, Tracer

__all__ = [
    "AnyOutcome",
    "AuthHook",
    "CancellationToken",
    "Cancelled",
    "Clock",
    "ConfigReader",
    "ConfigurationKeyError",
    "Container",
    "Context",
    "Deadline",
    "DeadlineExceededError",
    "Failed",
    "Lifecycle",
    "Logger",
    "MappingConfigReader",
    "NullLogger",
    "NullTracer",
    "Operation",
    "OperationCancelledError",
    "Outcome",
    "RedactedSecret",
    "RegistrationError",
    "Rejected",
    "Scope",
    "ScopeRequiredError",
    "SecretReference",
    "SecretResolver",
    "Success",
    "SystemClock",
    "TechnicalFailureError",
    "TimedOut",
    "Tracer",
    "correlation_scope",
    "dispatch",
    "get_current_correlation_id",
    "is_cancelled",
    "is_failed",
    "is_outcome",
    "is_rejected",
    "is_success",
    "is_timed_out",
]
