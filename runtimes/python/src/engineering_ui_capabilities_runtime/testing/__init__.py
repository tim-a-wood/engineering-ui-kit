"""In-memory persistence, an injectable/fake clock, a test secret resolver,
adapter-contract harnesses, and a trigger harness that drives an
`Operation` through `dispatch` (§7.1 `testing`).
"""

from __future__ import annotations

from .adapter_contract import AdapterContractCase, AdapterContractFailure, AdapterContractHarness
from .clock import FakeClock
from .logging import InMemoryLogger, LogRecord
from .persistence import InMemoryRepository, NotFoundError
from .secrets import TestSecretResolver, UnknownSecretReferenceError, assert_no_leak
from .trigger_harness import TriggerHarness

__all__ = [
    "AdapterContractCase",
    "AdapterContractFailure",
    "AdapterContractHarness",
    "FakeClock",
    "InMemoryLogger",
    "InMemoryRepository",
    "LogRecord",
    "NotFoundError",
    "TestSecretResolver",
    "TriggerHarness",
    "UnknownSecretReferenceError",
    "assert_no_leak",
]
