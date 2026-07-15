# engineering-ui-capabilities-runtime (Python)

Framework-neutral Python runtime core for Engineering UI Kit Capabilities
(CAP-ERA-001, packet WP4A-core).

This package implements ONLY the framework-neutral core described in
`docs/CAPABILITIES-EXECUTABLE-REFERENCE-ARCHITECTURE-CLAUDE-HANDOFF.md`
§7.1, §10.1, §10.2, and §15:

- `engineering_ui_capabilities_runtime.core` — `Outcome`, `Operation`,
  `Context`, `dispatch`, the lifecycle container, and configuration/secret
  protocols.
- `engineering_ui_capabilities_runtime.telemetry` — JSON console logging,
  correlation propagation via `contextvars`, tracing hooks, health/readiness.
- `engineering_ui_capabilities_runtime.testing` — in-memory persistence, a
  fake clock, a test secret resolver, adapter-contract harnesses, and a
  trigger harness that drives an `Operation` through `dispatch`.

The FastAPI/CLI/worker hosts and generic outbound adapters (`http`, `cli`,
`worker`, `adapters`) are a separate later packet and are intentionally not
implemented here.

## Development

```bash
python3.11 -m venv .venv
.venv/bin/python -m pip install --use-feature=truststore -e . pytest jsonschema
.venv/bin/python -m pytest ..
```
