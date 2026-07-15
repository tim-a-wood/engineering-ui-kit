"""Outbound HTTP adapter: URL validation, bounded response size, and
credential redaction (§15.3), proved with an `httpx.MockTransport` so no
real network socket is ever opened.
"""

from __future__ import annotations

import json

import httpx
import pytest

from engineering_ui_capabilities_runtime.adapters.http_client import (
    InvalidOutboundUrlError,
    OutboundHttpAdapter,
    OutboundHttpRequest,
    OutboundResponseTooLargeError,
    redact_headers,
    validate_outbound_url,
)
from engineering_ui_capabilities_runtime.testing.secrets import assert_no_leak

CANARY_SECRET = "canary-secret-do-not-leak"


def test_validate_outbound_url_accepts_http_and_https() -> None:
    validate_outbound_url("https://example.test/resource")
    validate_outbound_url("http://example.test/resource")


@pytest.mark.parametrize("url", ["ftp://example.test/file", "file:///etc/passwd", "javascript:alert(1)"])
def test_validate_outbound_url_rejects_disallowed_schemes(url: str) -> None:
    with pytest.raises(InvalidOutboundUrlError):
        validate_outbound_url(url)


def test_redact_headers_hides_authorization_and_cookie_values() -> None:
    headers = {"Authorization": f"Bearer {CANARY_SECRET}", "Cookie": f"session={CANARY_SECRET}", "Accept": "*/*"}

    redacted = redact_headers(headers)

    assert redacted["Authorization"] == "***"
    assert redacted["Cookie"] == "***"
    assert redacted["Accept"] == "*/*"
    assert_no_leak(str(redacted), CANARY_SECRET)


def test_diagnostic_summary_never_contains_the_credential_canary() -> None:
    adapter = OutboundHttpAdapter()
    request = OutboundHttpRequest(
        method="GET",
        url="https://example.test/resource",
        headers={"Authorization": f"Bearer {CANARY_SECRET}"},
    )

    summary = adapter.diagnostic_summary(request)

    assert_no_leak(str(summary), CANARY_SECRET)


def test_send_performs_a_real_request_through_a_mock_transport_and_reads_the_response() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.host == "example.test"
        return httpx.Response(200, json={"ok": True})

    adapter = OutboundHttpAdapter(transport=httpx.MockTransport(handler))
    response = adapter.send(OutboundHttpRequest(method="GET", url="https://example.test/resource"))

    assert response.status_code == 200
    assert json.loads(response.body) == {"ok": True}


def test_send_rejects_a_disallowed_scheme_before_making_any_request() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("Transport must not be invoked for an invalid URL")

    adapter = OutboundHttpAdapter(transport=httpx.MockTransport(handler))

    with pytest.raises(InvalidOutboundUrlError):
        adapter.send(OutboundHttpRequest(method="GET", url="ftp://example.test/resource"))


def test_send_enforces_the_max_response_size() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"x" * 1000)

    adapter = OutboundHttpAdapter(transport=httpx.MockTransport(handler), max_response_bytes=100)

    with pytest.raises(OutboundResponseTooLargeError):
        adapter.send(OutboundHttpRequest(method="GET", url="https://example.test/big"))
