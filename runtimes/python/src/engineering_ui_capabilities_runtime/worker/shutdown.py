"""Graceful shutdown on process signals (§10.2 "Shutdown stops inbound
acceptance ... disposes scopes in reverse order"; §10.3 "graceful
shutdown").

Wires SIGINT/SIGTERM to `Scheduler.request_shutdown()`, so `run_until_shutdown`
stops accepting new polls after finishing whatever poll is in flight, and
returns a restore function so a host (and tests) can always put prior
handlers back.
"""

from __future__ import annotations

import signal
from types import FrameType
from typing import Callable, Optional, Sequence

from .scheduler import Scheduler

DEFAULT_SHUTDOWN_SIGNALS: Sequence[signal.Signals] = (signal.SIGINT, signal.SIGTERM)

RestoreSignals = Callable[[], None]


def install_shutdown_signal_handlers(
    scheduler: Scheduler,
    signals: Sequence[signal.Signals] = DEFAULT_SHUTDOWN_SIGNALS,
) -> RestoreSignals:
    previous_handlers: dict[signal.Signals, object] = {}

    def _handle(signum: int, frame: Optional[FrameType]) -> None:
        scheduler.request_shutdown()

    for sig in signals:
        previous_handlers[sig] = signal.getsignal(sig)
        signal.signal(sig, _handle)

    def restore() -> None:
        for sig, handler in previous_handlers.items():
            signal.signal(sig, handler)

    return restore
