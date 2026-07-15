"""Deterministic domain code for the "place order" reference operation.

Framework-neutral: no FastAPI/argparse/scheduler imports here, only the
runtime `core` (`Context`, `Outcome`). Hosts (HTTP/CLI/schedule) wire this
domain to real triggers through the composition root.
"""

from __future__ import annotations
