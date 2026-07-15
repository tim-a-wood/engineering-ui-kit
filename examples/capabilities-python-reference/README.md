# Capabilities Python Reference App

A runnable Python reference app that proves the
`engineering-ui-capabilities-runtime` (CAP-ERA-001) works **end-to-end**:
a real trigger (HTTP request, CLI invocation, or a cron tick under an
injected clock) reaches a domain operation through an explicit
composition root and a real `dispatch` call, and returns a typed
`Outcome`.

This is the Python-only slice set (HTTP/CLI/schedule). The React <->
Python OpenAPI slice is a separate, cross-language packet and is
intentionally **not** included here.

## What it proves

- A tiny, deterministic domain operation (`PlaceOrderOperation`) with one
  success path and two domain-rejection paths, implementing the
  runtime's `Operation` protocol directly.
- An explicit composition root (`composition_root.py`) that wires the
  operation and its dependencies through the runtime's `Container`, and
  a `Context` factory every host reuses.
- Three real hosts built from the same operation, wired through the same
  composition root:
  - **HTTP** (`http_app.py`): a FastAPI app via
    `engineering_ui_capabilities_runtime.http.HttpOperationHost`.
  - **CLI** (`cli_app.py`): an argparse-based app via
    `engineering_ui_capabilities_runtime.cli.CliHost`.
  - **Schedule** (`scheduled_app.py`): a cron-triggered job via
    `engineering_ui_capabilities_runtime.worker.CronJob`/`Scheduler`,
    driven by an injected `WallClock` in tests.
- Real end-to-end tests (`tests/`) that start the actual host / drive
  the actual trigger and assert the traversal is real (through
  `dispatch` + the composition root), not a direct call into the
  operation.

## Layout

```
src/capabilities_python_reference/
  domain/
    catalog.py       - fixed, in-memory product catalog
    order_store.py   - in-memory, deterministic order ledger (sequential IDs)
    schemas.py       - the shared JSON Schema for the operation's input
    place_order.py   - PlaceOrderOperation (the domain operation)
  composition_root.py - Container wiring + the Context factory
  http_app.py          - FastAPI host (Group B)
  cli_app.py           - CLI host (Group B)
  scheduled_app.py     - cron worker host (Group C)
tests/
  test_http_e2e.py     - real TestClient request -> operation -> outcome
  test_cli_e2e.py      - real argv -> operation -> exit code
  test_schedule_e2e.py - real cron trigger (injected clock) -> operation
```

## The domain operation

`PlaceOrderOperation.execute(input, context)`:

- Success: the SKU exists and there is enough stock -> records the order
  in the `OrderStore` and returns `Outcome.success({...order...})`.
- Domain rejection `unknown_sku`: the SKU is not in the catalog.
- Domain rejection `insufficient_stock`: the SKU exists but the
  requested quantity exceeds available stock (see the fixed
  `out-of-stock-gizmo` catalog entry, which exists but always has zero
  stock).

Input schema (`domain/schemas.py`, shared by every host):

```json
{
  "type": "object",
  "properties": {
    "customer_id": { "type": "string", "minLength": 1 },
    "sku": { "type": "string", "minLength": 1 },
    "quantity": { "type": "integer", "minimum": 1 }
  },
  "required": ["customer_id", "sku", "quantity"],
  "additionalProperties": False
}
```

## Running it

Using the pre-provisioned `.venv-slices` virtualenv (see the parent
worktree's setup):

```bash
# HTTP: starts a real uvicorn server on an ephemeral port.
python -m capabilities_python_reference.http_app

# CLI:
python -m capabilities_python_reference.cli_app place-order \
  --customer-id cust-1 --sku widget --quantity 2

# Schedule: runs the real (non-test) process loop against the system
# wall clock until SIGINT/SIGTERM.
python -m capabilities_python_reference.scheduled_app
```

## Tests

```bash
python -m pytest examples/capabilities-python-reference
```

Every test starts the actual host (a FastAPI `TestClient`, a real
`CliHost.run(argv)` call, or a real `CronJob.poll(clock)` call against an
injected `FakeWallClock`) and asserts on the response/exit-code/outcome
that comes back through the real composition root and `dispatch` — none
of them call `PlaceOrderOperation.execute(...)` directly.

## Known open issues (not solved here)

- `SCHED-ENUM`: `OverlapPolicy`/`MisfirePolicy` naming is a tracked open
  issue across the spec/runtimes. This example uses the Python runtime's
  current enum values (`OverlapPolicy.SKIP`/`.ALLOW`,
  `MisfirePolicy.FIRE_NOW`/`.SKIP`) as-is; reconciling them is out of
  scope for this packet.
