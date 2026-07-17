# Capabilities Desktop Integration Evidence

## Status

The executable reference architecture is integrated into the production desktop workflow and is
visibly exercised through the packaged application. This document is the evidence index for
[`CAPABILITIES-DESKTOP-INTEGRATION-GOAL.md`](CAPABILITIES-DESKTOP-INTEGRATION-GOAL.md).

Local macOS validation completed on 2026-07-16. The authoritative cross-platform gate then built
and drove the packaged app on macOS, Windows, and Ubuntu in
[Actions run 29545112965](https://github.com/tim-a-wood/engineering-ui-kit/actions/runs/29545112965)
at production fix `39d28c6`; all required suites and packaged journeys A–E passed on every runner.

## Production authority

- Desktop orchestration: `apps/desktop/src/capabilities/referenceArchitectureOrchestrator.ts`
- Privileged IPC: `apps/desktop/src/capabilities/ipc.ts`
- Typed bridge parity: `apps/desktop/src/bridgeApi.ts`, `apps/desktop/src/preload.cts`,
  `apps/gui/src/bridge.ts`, and `apps/gui/src/mockBridge.ts`
- Visible generation/apply/rollback: `apps/gui/src/views/capabilities/IntegrationWorkspace.tsx`
- Visible connection configuration: `apps/gui/src/views/capabilities/GuidedConnect.tsx` and
  `apps/gui/src/views/capabilities/inbound/`
- Visible real verification: `apps/gui/src/views/capabilities/ConnectionVerificationPanel.tsx`
- Canonical persistence: `packages/core/src/capabilities/integrationStore.ts`
- Deterministic assembly and generators: `packages/core/src/capabilities/generationAssembly.ts` and
  `packages/core/src/capabilities/generation/`
- Transactional mutation: `packages/core/src/capabilities/generationApply.ts`
- Real launch/trigger evidence: `packages/core/src/capabilities/verificationRunner.ts`

The renderer supplies identities, approved choices, and explicit user intent. Filesystem access,
process execution, runtime distribution, transaction journals, and verification launches remain in
Electron main. The production desktop calls the existing core authorities rather than duplicating
their logic.

## Required packaged journeys

The authoritative harness is
`apps/desktop/e2e/capabilities-production-packaged.mjs`. The historical
`capabilities-packaged.mjs` entry point delegates to it and no longer runs the weaker source-mode,
`page.evaluate`-driven smoke path.

The harness launches the unpacked Electron artifact, verifies `app.isPackaged === true`, and drives
rendered controls. It does not call `window.euik`, mutate state with `page.evaluate`, invoke core
helpers, or dispatch IPC directly.

| Journey | Result | Proof |
|---|---:|---|
| A. TypeScript UI | Pass | Generate/apply, real target UI selection, browser-local connection, generated client invocation, current passing evidence, rollback. `01`–`04` screenshots and `typescript-ui.json`. |
| B. Headless Python | Pass | No UI disposition, Python generation/apply in a clean venv, schedule binding, real spawned-process execution trace. `11`–`13` screenshots and `python-headless.json`. |
| C. Mixed React/Python | Pass | Browser and Python deployables, approved HTTP boundary, both real builds, Python HTTP launch, React-side invocation, correlated outbound binding trace. `21`–`23` screenshots and `mixed-react-python.json`. |
| D. Existing repository | Pass | Visible no-loss migration preview, additive apply, legacy behavior before/after, rollback, byte-identical baseline/restored hash. `31`–`33` screenshots and `existing-repository.json`. |
| E. Failure recovery | Pass | Fault on the second real target rename, exact automatic restoration, packaged app restart, visible persisted failure, enabled retry, successful apply, final exact rollback. `41`–`43` screenshots and `failure-recovery.json`. |

Evidence directory:
`apps/desktop/validation-evidence/capabilities-production/packaged/`.

The final sequential local command passed all five journeys against the same artifact:

```sh
EUIK_PACKAGED_SKIP_BUILD=1 \
EUIK_PACKAGED_JOURNEYS=typescript-ui,python-headless,mixed,existing,recovery \
EUIK_PACKAGED_TIMEOUT_MS=120000 \
EUIK_PACKAGED_JOURNEY_TIMEOUT_MS=1800000 \
node apps/desktop/e2e/capabilities-production-packaged.mjs
```

## Requirement audit

| Goal requirement | Implementation and evidence |
|---|---|
| Production orchestration | Approved architecture, foundation, module specifications, contracts, schemas, composition, and bindings are collected by the desktop service; plans are impact-scoped and persisted with hashes and inputs. Orchestrator tests plus packaged A–E. |
| Privileged bridge | Typed plan preview/state/apply/rollback/commands/verification operations cross renderer → preload → IPC. Mutations require explicit intent, current IDs/hashes, approved inputs, path checks, ownership checks, and staleness checks. Bridge parity tests and desktop typecheck. |
| Complete lifecycle persistence | Plans, virtual files, apply records, rollback IDs, command runs, ownership, verification records, and freshness relationships survive a new store and application process. CAP-TEST-109 and packaged Journey E. |
| Build integration | Deployable cards expose composition factories, exact plan files/ownership/dependencies/commands/hashes, apply, command results, failure recovery, regenerate, and rollback. Packaged Journeys A–E. |
| Real Connect | UI/browser-local, Electron IPC, HTTP, CLI, schedule, and embedded-library bindings generate host-specific adapters; deferred remains incomplete; headless never requires UI. Core generator tests and packaged A–C. |
| Real verification | Actual generated targets launch, actual triggers run, observed paths and six source hashes persist, simulation cannot pass, child processes are bounded/cleaned, and secrets are redacted. CAP-TEST-094 and packaged A–C. |
| Overlay reconciliation | External implementation overlays remain for editable business code. Current generated-owned paths are injected into overlay protected paths at inspection and immediately before apply; deterministic infrastructure uses `GenerationPlan`. UI labels the agent route as an external implementation handoff. |
| Polished states | Guided/Design projections show readiness, plans, IDs/hashes, ownership, commands, verification traces, migration preview, failure restoration, retry, and rollback. Raw Electron failure prefixes are removed. Packaged screenshots and GUI tests. |
| Production gaps | Python composition, real DI factories, TS/Python HTTP/CLI/schedule/embedded hosts, Electron IPC, runtime distribution, OpenAPI/client generation, browser remote clients, freshness, and shared redaction are implemented and exercised. CAP-TEST-111–119 and packaged A–C. |
| Migration/no loss | Repository evidence includes package.json, requirements.txt, PEP 621, and Poetry. Migration preview is visible; apply is additive; generated ownership is protected; rollback restores originals exactly. Existing-repo tests and packaged D. |

## Local reproducible matrix

Validated on macOS Apple Silicon on 2026-07-16:

| Surface | Result |
|---|---:|
| TypeScript runtime | 96 passed |
| Core | 337 passed |
| GUI | 181 passed |
| Python runtime | 133 passed |
| TypeScript reference | 7 passed |
| React reference | 8 passed |
| React/Python TypeScript side | 7 passed |
| Python reference | 15 passed |
| React/Python Python side | 3 passed |
| All workspace builds | Pass |
| Packaged journeys A–E sequentially | Pass |

Commands:

```sh
npm test
.venv/bin/python -m pytest runtimes/python -q
.venv/bin/python -m pytest examples/capabilities-python-reference -q
.venv/bin/python -m pytest examples/capabilities-react-python-reference -q
npm run build
```

Desktop-specific tests are also run with:

```sh
npx vitest run apps/desktop/test
```

## Supported-platform CI

`.github/workflows/capabilities-cross-platform.yml` now runs on `macos-latest`, `windows-latest`,
and `ubuntu-latest`. Each job runs the language/core/GUI/reference matrix, builds an unpacked desktop
artifact, drives packaged journeys A–E (under Xvfb on Linux), and uploads the artifact plus evidence.

Production integration gate:
[Actions run 29545112965](https://github.com/tim-a-wood/engineering-ui-kit/actions/runs/29545112965)
at `39d28c6` — **green on macOS, Windows, and Ubuntu**, including packaged journeys A–E on every
runner. The checked-in packaged evidence below was captured from that run's macOS artifact; the
Windows and Ubuntu artifacts contain the corresponding platform executions.

Final `main` verification:
[Actions run 29545605675](https://github.com/tim-a-wood/engineering-ui-kit/actions/runs/29545605675)
at `c02b87e` — **green on macOS, Windows, and Ubuntu on attempt 2**, including packaged journeys
A–E and artifact upload on every runner. The rerun followed one transient macOS Playwright click
stall; the same job then passed without a source change, as had the preceding branch gate.

## Packaging and distribution

The v0.1 artifacts are intentionally unsigned. `mac.identity: null` prevents local developer
certificate auto-discovery from making packaging differ from CI. Signing/notarization is a release
distribution decision and does not change the packaged runtime path exercised here.

The package carries complete TypeScript runtime JavaScript/declarations and Python runtime sources.
Generated targets install those local runtime assets and operate with the desktop closed.

## Remaining external-system limitations

Real MATLAB Engine and real Azure DevOps connections still require their respective external
installations/credentials. They remain separate experimental adapters and are not prerequisites for
the executable reference-architecture desktop workflow proven here. Fake/simulated evidence cannot
earn a passing real-connection status.
