"""Generic outbound adapter foundations (§7.1, §15.3): HTTP, filesystem,
process/command, and a persistence port + in-memory adapter.
"""

from __future__ import annotations

from .filesystem import (
    FilesystemAdapter,
    FilesystemCapability,
    FilesystemCapabilityError,
    PathTraversalError,
)
from .http_client import (
    CREDENTIAL_HEADER_NAMES,
    DEFAULT_ALLOWED_SCHEMES,
    InvalidOutboundUrlError,
    OutboundHttpAdapter,
    OutboundHttpRequest,
    OutboundHttpResponse,
    OutboundResponseTooLargeError,
    REDACTED_PLACEHOLDER,
    redact_headers,
    validate_outbound_url,
)
from .persistence import (
    InMemoryPersistenceAdapter,
    PersistenceKeyNotFoundError,
    PersistencePort,
)
from .process import (
    CommandResult,
    DisallowedWorkingDirectoryError,
    ProcessAdapter,
    SHELL_METACHARACTERS,
    ShellMetacharacterError,
    reject_shell_metacharacters_in_executable,
)

__all__ = [
    "CREDENTIAL_HEADER_NAMES",
    "CommandResult",
    "DEFAULT_ALLOWED_SCHEMES",
    "DisallowedWorkingDirectoryError",
    "FilesystemAdapter",
    "FilesystemCapability",
    "FilesystemCapabilityError",
    "InMemoryPersistenceAdapter",
    "InvalidOutboundUrlError",
    "OutboundHttpAdapter",
    "OutboundHttpRequest",
    "OutboundHttpResponse",
    "OutboundResponseTooLargeError",
    "PathTraversalError",
    "PersistenceKeyNotFoundError",
    "PersistencePort",
    "ProcessAdapter",
    "REDACTED_PLACEHOLDER",
    "SHELL_METACHARACTERS",
    "ShellMetacharacterError",
    "redact_headers",
    "reject_shell_metacharacters_in_executable",
    "validate_outbound_url",
]
