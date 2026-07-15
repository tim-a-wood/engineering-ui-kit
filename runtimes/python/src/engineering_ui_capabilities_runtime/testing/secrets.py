"""Test secret resolver (§15.1). Backed by an in-memory mapping seeded with
canary markers in tests — never real credentials — and redaction-aware:
resolved values are only reachable by explicit `RedactedSecret.reveal()`.
"""

from __future__ import annotations

from typing import Dict

from ..core.secrets import RedactedSecret, SecretReference, SecretResolver


class UnknownSecretReferenceError(KeyError):
    pass


class TestSecretResolver(SecretResolver):
    def __init__(self, values: Dict[SecretReference, str] | None = None) -> None:
        self._values: Dict[SecretReference, str] = dict(values or {})

    def seed(self, ref: SecretReference, value: str) -> None:
        self._values[ref] = value

    def resolve(self, ref: SecretReference) -> RedactedSecret:
        if ref not in self._values:
            raise UnknownSecretReferenceError(ref)
        return RedactedSecret(self._values[ref])


def assert_no_leak(haystack: str, canary: str) -> None:
    """Fails loudly if a secret canary value appears in serialized output
    (an outcome, a log line, an evidence artifact). Use a canary string that
    could never be a real credential, e.g. `"canary-secret-do-not-leak"`.
    """

    if canary in haystack:
        raise AssertionError(f"Secret canary {canary!r} leaked into serialized output: {haystack!r}")
