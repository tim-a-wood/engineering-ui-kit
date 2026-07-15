"""Cooperative cancellation on process signals (§10.3 "CLI: ... cancellation
on process signals").

Installing a handler here does not itself interrupt in-flight Python code —
that is what cooperative cancellation means: long-running operations must
check `context.cancellation` at safe points (see `core.cancellation`). This
module only wires SIGINT/SIGTERM to mark a `CancellationToken`, and returns
a restore function so a host can always put prior handlers back (tests rely
on this to avoid leaking signal state between cases).
"""

from __future__ import annotations

import signal
from types import FrameType
from typing import Callable, Optional, Sequence

from ..core.cancellation import CancellationToken

DEFAULT_CANCELLATION_SIGNALS: Sequence[signal.Signals] = (signal.SIGINT, signal.SIGTERM)

RestoreSignals = Callable[[], None]


def install_cancellation_signal_handlers(
    cancellation: CancellationToken,
    signals: Sequence[signal.Signals] = DEFAULT_CANCELLATION_SIGNALS,
) -> RestoreSignals:
    """Registers a handler for each signal in `signals` that marks
    `cancellation` cancelled with a reason naming the signal, and returns a
    function that restores whatever handler was previously registered.
    """

    previous_handlers: dict[signal.Signals, object] = {}

    def _handle(signum: int, frame: Optional[FrameType]) -> None:
        try:
            signal_name = signal.Signals(signum).name
        except ValueError:  # pragma: no cover - defensive
            signal_name = str(signum)
        cancellation.cancel(reason=f"signal:{signal_name}")

    for sig in signals:
        previous_handlers[sig] = signal.getsignal(sig)
        signal.signal(sig, _handle)

    def restore() -> None:
        for sig, handler in previous_handlers.items():
            signal.signal(sig, handler)

    return restore
