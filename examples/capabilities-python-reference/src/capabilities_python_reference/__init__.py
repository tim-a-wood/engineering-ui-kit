"""Capabilities Python reference app (CAP-ERA-001 WP4B-slices).

A small, deterministic "place order" domain operation wired through the
real `engineering_ui_capabilities_runtime` core (`Container`/`dispatch`)
and exposed over three real hosts: HTTP (FastAPI), CLI (argparse), and a
scheduled cron worker. Proves the runtime end-to-end: a real trigger
(HTTP request, CLI invocation, or cron tick) reaches the operation through
an explicit composition root and returns a typed `Outcome`.

The React<->Python OpenAPI slice is a separate, cross-language packet and
is intentionally out of scope here (Python-only slices only).
"""

from __future__ import annotations

__all__ = ["__version__"]

__version__ = "0.1.0"
