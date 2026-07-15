"""An operation-raised exception that carries an already-safe failure
description. `dispatch` converts it directly to `Outcome.failed(...)`
without generating a generic message, letting operation authors provide a
deliberately safe message when they need to raise rather than return.
"""

from __future__ import annotations

from typing import Optional


class TechnicalFailureError(Exception):
    def __init__(
        self,
        code: str,
        safe_message: str,
        retryable: bool = False,
        cause_ref: Optional[str] = None,
    ) -> None:
        super().__init__(safe_message)
        self.code = code
        self.safe_message = safe_message
        self.retryable = retryable
        self.cause_ref = cause_ref
