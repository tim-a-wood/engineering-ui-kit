"""Real end-to-end CLI test: a real `CliHost.run(argv)` invocation maps
argv into `PlaceOrderOperation`'s input through `dispatch` and the
composition root, and returns the correct process exit code
(CAP-ERA-001 §19, §10.3).

As with the HTTP test, the assertions depend on real traversal: the
sequential order ID proves the same composition root backs repeated
invocations, and the `invalid_input` rejection code for a bad `--quantity`
only exists on the `dispatch` schema-validation path.
"""

from __future__ import annotations

import io
import json

from engineering_ui_capabilities_runtime.cli import EXIT_REJECTED, EXIT_SUCCESS

from capabilities_python_reference.cli_app import COMMAND_NAME, build_cli
from capabilities_python_reference.composition_root import ORDER_STORE, build_container


def _run(host, argv: list[str]):
    stdout, stderr = io.StringIO(), io.StringIO()
    exit_code = host.run(argv, stdout=stdout, stderr=stderr, install_signal_handlers=False)
    return exit_code, stdout.getvalue(), stderr.getvalue()


def test_real_invocation_reaches_the_operation_and_exits_zero_on_success() -> None:
    container = build_container()
    host = build_cli(container)

    exit_code, stdout, stderr = _run(
        host, [COMMAND_NAME, "--customer-id", "cust-1", "--sku", "widget", "--quantity", "3"]
    )

    assert exit_code == EXIT_SUCCESS
    assert stderr == ""
    result = json.loads(stdout)
    assert result["order_id"] == "order-000001"
    assert result["total_cents"] == 3 * 1_999
    # Proves the invocation really reached the composition root's
    # OrderStore (through dispatch), not just a printed literal.
    order_store = container.resolve(ORDER_STORE)
    assert order_store.placed == [result]


def test_repeated_invocations_share_the_same_composition_root_state() -> None:
    container = build_container()
    host = build_cli(container)

    first_exit, first_out, _ = _run(
        host, [COMMAND_NAME, "--customer-id", "cust-1", "--sku", "widget", "--quantity", "1"]
    )
    second_exit, second_out, _ = _run(
        host, [COMMAND_NAME, "--customer-id", "cust-2", "--sku", "gadget", "--quantity", "1"]
    )

    assert first_exit == EXIT_SUCCESS
    assert second_exit == EXIT_SUCCESS
    assert json.loads(first_out)["order_id"] == "order-000001"
    assert json.loads(second_out)["order_id"] == "order-000002"


def test_domain_rejection_writes_diagnostics_to_stderr_and_exits_nonzero() -> None:
    host = build_cli()

    exit_code, stdout, stderr = _run(
        host, [COMMAND_NAME, "--customer-id", "cust-1", "--sku", "out-of-stock-gizmo", "--quantity", "1"]
    )

    assert exit_code == EXIT_REJECTED
    assert stdout == ""
    payload = json.loads(stderr)
    assert payload["kind"] == "rejected"
    assert payload["code"] == "insufficient_stock"


def test_invalid_quantity_is_rejected_by_dispatch_before_reaching_the_operation() -> None:
    """`--quantity 0` violates the shared JSON Schema's `minimum: 1` --
    `dispatch`'s own validation rejects it with `invalid_input`, which
    only exists on the real `dispatch` traversal path, before the
    operation ever runs.
    """

    container = build_container()
    host = build_cli(container)

    exit_code, stdout, stderr = _run(
        host, [COMMAND_NAME, "--customer-id", "cust-1", "--sku", "widget", "--quantity", "0"]
    )

    assert exit_code == EXIT_REJECTED
    payload = json.loads(stderr)
    assert payload["code"] == "invalid_input"
    order_store = container.resolve(ORDER_STORE)
    assert order_store.placed == []
