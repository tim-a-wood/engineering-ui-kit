"""CLI slice: exposes `PlaceOrderOperation` over a real `argparse`-based
`CliHost` (CAP-ERA-001 §7.1/§10.3): `place-order --customer-id ... --sku
... --quantity ...` maps argv straight into the operation's input schema.
"""

from __future__ import annotations

import argparse
import sys
from typing import Any, Optional, Sequence

from engineering_ui_capabilities_runtime.cli import CliCommand, CliHost
from engineering_ui_capabilities_runtime.core import Container

from .composition_root import PLACE_ORDER_OPERATION, build_container, make_context
from .domain.schemas import PLACE_ORDER_INPUT_SCHEMA

COMMAND_NAME = "place-order"


def _add_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--customer-id", required=True)
    parser.add_argument("--sku", required=True)
    parser.add_argument("--quantity", type=int, required=True)


def _build_input(args: argparse.Namespace, stdin_text: Optional[str]) -> dict[str, Any]:
    return {"customer_id": args.customer_id, "sku": args.sku, "quantity": args.quantity}


def build_cli(container: Container | None = None) -> CliHost:
    """Builds the CLI host, same pattern as `http_app.create_app`: an
    optional pre-built `Container` for tests that want to share one
    composition root, otherwise a fresh one per real invocation.
    """

    container = container if container is not None else build_container()
    operation = container.resolve(PLACE_ORDER_OPERATION)

    host = CliHost(prog="capabilities-python-reference", description="Place an order for a catalog SKU.")
    host.add_command(
        CliCommand(
            name=COMMAND_NAME,
            operation=operation,
            input_schema=PLACE_ORDER_INPUT_SCHEMA,
            build_input=_build_input,
            add_arguments=_add_arguments,
            context_factory=lambda correlation_id, args: make_context(correlation_id),
            help="Place an order for a catalog SKU.",
        )
    )
    return host


def main(argv: Optional[Sequence[str]] = None) -> int:  # pragma: no cover - real process entry point
    argv = argv if argv is not None else sys.argv[1:]
    return build_cli().run(argv)


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
