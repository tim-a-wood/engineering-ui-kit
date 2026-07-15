"""A secret reference never appears in a serialized outcome/log (SS15.1).

Uses an obviously-fake canary value — never a real credential — seeded into
the test secret resolver, then proves it cannot leak through the normal
`Context.secrets` -> `RedactedSecret` path, nor through `dispatch`'s
exception-to-`failed` conversion, nor through the JSON console logger.
"""

from __future__ import annotations

import io
import json
from typing import Any

from engineering_ui_capabilities_runtime.core import (
    Context,
    Outcome,
    SecretReference,
    TechnicalFailureError,
    dispatch,
)
from engineering_ui_capabilities_runtime.telemetry import JsonConsoleLogger
from engineering_ui_capabilities_runtime.testing import (
    InMemoryLogger,
    TestSecretResolver,
    assert_no_leak,
)

CANARY = "canary-secret-do-not-leak-9f3c2a"


def test_redacted_secret_repr_and_str_never_reveal_the_value() -> None:
    resolver = TestSecretResolver()
    ref = SecretReference(provider="env", key="SOME_API_TOKEN")
    resolver.seed(ref, CANARY)

    secret = resolver.resolve(ref)

    assert_no_leak(repr(secret), CANARY)
    assert_no_leak(str(secret), CANARY)
    assert secret.reveal() == CANARY


def test_secret_value_does_not_leak_through_a_failed_outcome() -> None:
    class LeaksSecretIfMishandledOperation:
        def execute(self, input: dict, context: Context) -> Any:
            secret = context.secrets.resolve(SecretReference(provider="env", key="DB_PASSWORD"))
            # A correct operation never does this; simulate the failure
            # mode dispatch's exception boundary must still contain.
            raise ValueError(f"connect failed for password {secret.reveal()}")

    resolver = TestSecretResolver()
    resolver.seed(SecretReference(provider="env", key="DB_PASSWORD"), CANARY)
    logger = InMemoryLogger()
    context = Context(correlation_id="c1", secrets=resolver, logger=logger)

    outcome = dispatch(LeaksSecretIfMishandledOperation(), {}, context)

    serialized = outcome.model_dump_json()
    assert_no_leak(serialized, CANARY)
    assert_no_leak(logger.text(), CANARY)


def test_secret_value_does_not_leak_through_the_json_console_logger() -> None:
    resolver = TestSecretResolver()
    ref = SecretReference(provider="env", key="API_TOKEN")
    resolver.seed(ref, CANARY)
    secret = resolver.resolve(ref)

    stream = io.StringIO()
    logger = JsonConsoleLogger(stream=stream)
    logger.info("secret.resolved", secret=secret, provider=ref.provider)

    written = stream.getvalue()
    assert_no_leak(written, CANARY)

    record = json.loads(written.strip())
    assert record["secret"] == "***"


def test_technical_failure_error_safe_message_is_deliberately_chosen() -> None:
    class RaisesTechnicalFailureWithSecretMishandledOperation:
        def execute(self, input: dict, context: Context) -> Any:
            secret = context.secrets.resolve(SecretReference(provider="env", key="DB_PASSWORD"))
            # Even if an operation author mistakenly interpolates a raw
            # value into an exception message, the point under test is
            # that only the operation-declared safe_message is what
            # dispatch propagates — never str(exc)/traceback text.
            raise TechnicalFailureError(
                code="downstream_unavailable",
                safe_message="The downstream service is temporarily unavailable.",
                retryable=True,
            ) from ValueError(secret.reveal())

    resolver = TestSecretResolver()
    resolver.seed(SecretReference(provider="env", key="DB_PASSWORD"), CANARY)
    context = Context(correlation_id="c1", secrets=resolver)

    outcome = dispatch(RaisesTechnicalFailureWithSecretMishandledOperation(), {}, context)

    serialized = outcome.model_dump_json()
    assert_no_leak(serialized, CANARY)
