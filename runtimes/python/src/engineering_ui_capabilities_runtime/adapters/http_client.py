"""Generic outbound HTTP adapter foundation (§15.3 "Generic HTTP adapters
validate URLs, bound redirects/timeouts/body size, and redact
credentials").

Backed by `httpx`. The adapter accepts an injectable `httpx.BaseTransport`
(e.g. `httpx.MockTransport`) so tests never need a real network socket.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping, Optional

import httpx

DEFAULT_ALLOWED_SCHEMES: frozenset[str] = frozenset({"http", "https"})

#: Header names whose values are always redacted in any diagnostic surface
#: (never logged, never included in evidence). Comparison is case-insensitive.
CREDENTIAL_HEADER_NAMES: frozenset[str] = frozenset(
    {"authorization", "proxy-authorization", "cookie", "set-cookie", "x-api-key"}
)

REDACTED_PLACEHOLDER = "***"


class InvalidOutboundUrlError(ValueError):
    pass


class OutboundResponseTooLargeError(RuntimeError):
    pass


@dataclass(frozen=True)
class OutboundHttpRequest:
    method: str
    url: str
    headers: Mapping[str, str] = field(default_factory=dict)
    body: Optional[bytes] = None


@dataclass(frozen=True)
class OutboundHttpResponse:
    status_code: int
    headers: Mapping[str, str]
    body: bytes


def redact_headers(headers: Mapping[str, str]) -> dict[str, str]:
    """Returns a copy of `headers` with every credential-bearing header
    value replaced by `REDACTED_PLACEHOLDER`. Safe to log or include in
    evidence artifacts.
    """

    return {
        name: (REDACTED_PLACEHOLDER if name.lower() in CREDENTIAL_HEADER_NAMES else value)
        for name, value in headers.items()
    }


def validate_outbound_url(url: str, *, allowed_schemes: frozenset[str] = DEFAULT_ALLOWED_SCHEMES) -> httpx.URL:
    try:
        parsed = httpx.URL(url)
    except Exception as exc:  # noqa: BLE001 - httpx raises its own error types
        raise InvalidOutboundUrlError(f"{url!r} is not a valid URL") from exc
    if parsed.scheme not in allowed_schemes:
        raise InvalidOutboundUrlError(f"URL scheme {parsed.scheme!r} is not allowed for outbound requests")
    if not parsed.host:
        raise InvalidOutboundUrlError(f"{url!r} has no host")
    return parsed


class OutboundHttpAdapter:
    """A generic, safety-bounded outbound HTTP client: validates the target
    URL's scheme/host, bounds redirects, request timeout, and response body
    size, and never places credential header values in a diagnostic
    summary.
    """

    def __init__(
        self,
        *,
        allowed_schemes: frozenset[str] = DEFAULT_ALLOWED_SCHEMES,
        timeout_seconds: float = 10.0,
        max_redirects: int = 5,
        max_response_bytes: int = 10 * 1024 * 1024,
        transport: Optional[httpx.BaseTransport] = None,
    ) -> None:
        self._allowed_schemes = allowed_schemes
        self._timeout_seconds = timeout_seconds
        self._max_redirects = max_redirects
        self._max_response_bytes = max_response_bytes
        self._transport = transport

    def send(self, request: OutboundHttpRequest) -> OutboundHttpResponse:
        validate_outbound_url(request.url, allowed_schemes=self._allowed_schemes)
        with httpx.Client(
            timeout=self._timeout_seconds,
            follow_redirects=True,
            max_redirects=self._max_redirects,
            transport=self._transport,
        ) as client:
            with client.stream(
                request.method,
                request.url,
                headers=dict(request.headers),
                content=request.body,
            ) as response:
                chunks: list[bytes] = []
                total_bytes = 0
                for chunk in response.iter_bytes():
                    total_bytes += len(chunk)
                    if total_bytes > self._max_response_bytes:
                        raise OutboundResponseTooLargeError(
                            f"Outbound response exceeded the configured limit of {self._max_response_bytes} bytes"
                        )
                    chunks.append(chunk)
                return OutboundHttpResponse(
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    body=b"".join(chunks),
                )

    def diagnostic_summary(self, request: OutboundHttpRequest) -> dict[str, Any]:
        """A safe-to-log summary of an outbound request: credential headers
        redacted, body omitted entirely (bodies may themselves carry
        secrets and are never assumed safe to log).
        """

        return {
            "method": request.method,
            "url": request.url,
            "headers": redact_headers(dict(request.headers)),
        }
