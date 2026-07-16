# Capabilities React <-> Python Reference (CAP-ERA-001 WP4B-react-python)

The last cross-language end-to-end slice: a **React/TypeScript client
calls a live Python host through a generated OpenAPI 3.1 boundary**, plus
a **cross-language parity fixture** proving TS and Python accept/reject
the same canonical inputs.

Gate tests: **CAP-TEST-066** and **CAP-TEST-069** (handoff §Wave-4 gate).

## What it proves

1. **A real, live Python host** (`src/capabilities_react_python_reference/`):
   a tiny deterministic domain operation (`PlaceOrderOperation`, mirroring
   `examples/capabilities-python-reference`'s own — one success path, two
   domain rejections), an explicit composition root, and a FastAPI app
   via `engineering_ui_capabilities_runtime.http.HttpOperationHost`
   exposing it as `POST /orders`. Runs with plain Python tooling only —
   no Node, no Electron, no desktop dependency.
2. **The generated OpenAPI 3.1 document as the shared boundary contract**
   (`src/generation/`): `planOpenApiDocument` (the real generator,
   `packages/core/src/capabilities/generation/python.ts`) plans the
   OpenAPI document from the same canonical `OperationContract`/
   `HttpInboundBinding`/schema records (`src/generation/contract.ts`)
   this example hand-authors to mirror the Python side's own literal JSON
   Schema.
3. **A framework-neutral TS client + a thin React hook/controller**
   (`src/client/`, `src/react/PlaceOrderForm.tsx`): a real `fetch()`-based
   `Transport` (`PythonHttpTransport`) speaking the generated HTTP
   contract to the live Python host, and `PlaceOrderForm` driving it
   through the runtime's `useOperation` hook
   (`@engineering-ui-kit/capabilities-runtime/react`). No operation/domain
   logic lives on the TS side — it only speaks the generated contract.

## Layout

```
src/capabilities_react_python_reference/   - the live Python host (standalone)
  domain/                                    catalog.py, order_store.py, schemas.py, place_order.py
  composition_root.py                        Container wiring + Context factory
  http_app.py                                FastAPI host via HttpOperationHost (POST /orders)
src/generation/                            - the canonical records + the real OpenAPI generator call
  contract.ts                                OperationContract/HttpInboundBinding/GeneratedSchemaDefinition records
  generate-openapi.ts                        planOpenApiDocument(...) wrapper
src/client/                                - the TS/React side of the generated boundary
  types.ts                                    wire-shape types (no domain logic)
  place-order-schema.ts                      TS-side mirror of the Python input JSON Schema (for AJV parity)
  http-transport.ts                           PythonHttpTransport: a REAL fetch()-based Transport
  composition-root.ts                        OperationClient wired to PythonHttpTransport
src/react/PlaceOrderForm.tsx                - the single deployable UI trigger (useOperation hook)
fixtures/                                  - canonical JSON bytes both languages read verbatim
tests/                                     - Python (pytest) and TS (vitest) tests, side by side
  test_http_e2e.py                           Python-only real e2e (no Node/React)
  support/python-server.ts                   spawns the real Python host as a subprocess
  cap-test-066-react-calls-live-python.test.tsx  the real cross-process round-trip gate
  cap-test-069-cross-language-parity.test.ts     the cross-language parity gate
```

## Running the tests

TypeScript/React (from `WORKTREE_ROOT`):

```bash
cd examples/capabilities-react-python-reference && ../../node_modules/.bin/vitest run
```

Python:

```bash
/absolute/path/to/venv/bin/python -m pytest examples/capabilities-react-python-reference -q
```

Both suites spawn the SAME real Python FastAPI process
(`python -m capabilities_react_python_reference.http_app`) as a subprocess
on an ephemeral loopback port — the TS suite via
`tests/support/python-server.ts`, the Python suite via an in-process
`starlette.testclient.TestClient` for its own isolated coverage.

## CAP-TEST-066 — real cross-process round-trip

`tests/cap-test-066-react-calls-live-python.test.tsx` spawns the real
Python host as an OS subprocess, waits for it to answer its own
`/healthz` route, renders the real `PlaceOrderForm` component wired to a
real `PythonHttpTransport`, and drives it with real
`@testing-library/user-event` interactions — each of which fires a real
`fetch()` HTTP request across a real network socket to the real Python
process. It asserts the typed `Outcome` for both a success input and a
domain-rejection input (`unknown_sku`), and always tears the subprocess
down (`SIGTERM`) in `afterAll`.

## CAP-TEST-069 — cross-language parity

`tests/cap-test-069-cross-language-parity.test.ts` has two parts:

- **(a) Canonical fixture parity**: the exact same fixture JSON bytes
  (`fixtures/*.json`) are (1) validated by TS's own `AjvValidator`
  (Draft 2020-12) against a hand-mirrored copy of the Python input
  schema, and (2) POSTed, unmodified, to the real live Python host. A
  schema-valid/domain-success fixture is accepted by both; a
  schema-valid/domain-rejected fixture passes SCHEMA validation on both
  (then Python's own domain logic separately rejects it, which is
  correctly *not* a schema disagreement); a malformed fixture (missing a
  required field) is rejected by both.
- **(b) Generated-OpenAPI / served-OpenAPI agreement**: `planOpenApiDocument`'s
  output is compared against the live Python host's actually-served
  `/openapi.json` for the same path, method, and request-body schema
  shape (property names, `required` set, `additionalProperties`, and
  per-property JSON Schema `type` — the generator does not emit
  finer-grained keywords like `minLength`/`minimum`, so those are
  intentionally excluded from the comparison). A documented, known,
  out-of-scope-for-this-packet gap: Python's auto-generated doc leaves
  the success *response* schema unconstrained (`{}`) because
  `add_operation_route` never registers a `response_model` — real
  response-shape agreement is instead proven at runtime by CAP-TEST-066's
  live round-trip.

## Why a relative import into `packages/core/src/**`, not a package specifier

`@engineering-ui-kit/core`'s `package.json` `exports` map only resolves
`./dist/*` (a gitignored build artifact) and does not expose
`capabilities/generation/**` as a subpath at all yet. Rather than editing
that read-only, centrally-owned package to add a new export, this example
imports `planOpenApiDocument` and the generation types directly from
`packages/core/src/capabilities/generation/*.ts` by a plain relative
path — the same "resolve straight to the real TS source, no build step,
no edits to the shared package" principle already established for
`@engineering-ui-kit/capabilities-runtime` by
`examples/capabilities-ts-reference/vitest.config.ts`'s alias, just
applied here as an ordinary relative import since nothing else in this
repository imports `python.ts`'s generation helpers via a bare package
specifier today. If a package-level export is wanted later, that is a
central-barrel change outside this packet's scope (see the coordinator
report's "shared-export" note).

## Standalone guarantee

- `src/capabilities_react_python_reference/**` depends only on
  `engineering_ui_capabilities_runtime`, FastAPI, and uvicorn — never on
  Node or Electron.
- `src/client/**` and `src/react/**` depend only on
  `@engineering-ui-kit/capabilities-runtime` (+ its `/browser` and
  `/react` subpaths), React, and the platform `fetch` — never on Python,
  the desktop package, or the GUI package.
