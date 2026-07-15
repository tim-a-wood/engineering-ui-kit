"""A trigger harness that drives an `Operation` through `dispatch`, the way
a real inbound adapter (HTTP, CLI, schedule, UI) would — never invoking the
operation directly — so tests exercise the same boundary hosts use
(validation, exceptions -> failed, deadline, cancellation).
"""

from __future__ import annotations

from typing import Any, Mapping, Optional, TypeVar

from ..core.cancellation import CancellationToken
from ..core.clock import Clock
from ..core.config import ConfigReader, MappingConfigReader
from ..core.context import Context
from ..core.deadline import Deadline
from ..core.dispatch import Operation, dispatch
from ..core.outcomes import AnyOutcome
from ..core.secrets import SecretResolver
from ..core.telemetry_protocols import Logger, NullLogger, NullTracer, Tracer
from .clock import FakeClock

InputT = TypeVar("InputT")


class TriggerHarness:
    """Builds a deterministic `Context` (fake clock by default) and drives
    an operation through `dispatch`, mirroring how a generated inbound
    adapter invokes the composition root.
    """

    def __init__(
        self,
        clock: Clock | None = None,
        config: ConfigReader | None = None,
        secrets: SecretResolver | None = None,
        logger: Logger | None = None,
        tracer: Tracer | None = None,
    ) -> None:
        self.clock = clock or FakeClock()
        self.config = config or MappingConfigReader()
        self.secrets = secrets
        self.logger = logger or NullLogger()
        self.tracer = tracer or NullTracer()

    def make_context(
        self,
        correlation_id: str = "test-correlation",
        cancellation: CancellationToken | None = None,
        deadline: Deadline | None = None,
        principal: Any | None = None,
    ) -> Context:
        return Context(
            correlation_id=correlation_id,
            cancellation=cancellation or CancellationToken(),
            deadline=deadline,
            config=self.config,
            secrets=self.secrets,
            logger=self.logger,
            tracer=self.tracer,
            clock=self.clock,
            principal=principal,
        )

    def trigger(
        self,
        operation: "Operation[InputT]",
        input: InputT,
        input_schema: Optional[Mapping[str, Any]] = None,
        context: Optional[Context] = None,
        **context_kwargs: Any,
    ) -> AnyOutcome:
        active_context = context or self.make_context(**context_kwargs)
        return dispatch(operation, input, active_context, input_schema=input_schema)
