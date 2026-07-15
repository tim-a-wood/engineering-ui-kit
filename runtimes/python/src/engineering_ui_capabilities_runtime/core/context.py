"""`Context` — everything an `Operation.execute` receives besides its input
(§10.1):

    Context
      correlationId
      cancellation
      deadline
      principal/auth context hook
      configuration reader
      secret resolver reference
      logger/tracer
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from .cancellation import CancellationToken
from .clock import Clock, SystemClock
from .config import ConfigReader, MappingConfigReader
from .deadline import Deadline
from .secrets import SecretResolver
from .telemetry_protocols import Logger, NullLogger, NullTracer, Tracer

AuthHook = Callable[[str], bool]


@dataclass
class Context:
    correlation_id: str
    cancellation: CancellationToken = field(default_factory=CancellationToken)
    deadline: Optional[Deadline] = None
    config: ConfigReader = field(default_factory=MappingConfigReader)
    secrets: Optional[SecretResolver] = None
    logger: Logger = field(default_factory=NullLogger)
    tracer: Tracer = field(default_factory=NullTracer)
    clock: Clock = field(default_factory=SystemClock)
    principal: Optional[Any] = None
    authorize: Optional[AuthHook] = None

    def is_authorized(self, permission: str) -> bool:
        """Protected operations default to deny until a hook is registered
        (§15.2). The runtime provides only this hook shape; identity
        providers and policy engines are host/project concerns.
        """
        if self.authorize is None:
            return False
        return bool(self.authorize(permission))
