# CAP-ERA-001 — WP10 Platform Matrix, Definition-of-Done Scorecard, and Experimental-Exit Evidence

This is the coordinator's final evidence index for the Capabilities Executable Reference
Architecture initiative (`docs/CAPABILITIES-EXECUTABLE-REFERENCE-ARCHITECTURE-CLAUDE-HANDOFF.md`,
CAP-ERA-001). It records what has been proven, **how to reproduce it**, and the evidence supporting
the separate product decision about the `Experimental` badge. The authoritative packet-by-packet status
lives in [`capabilities-execution-ledger.md`](capabilities-execution-ledger.md); this document is the
requirement→evidence roll-up required by handoff §18/§19/WP10.

> **2026-07-16 desktop-integration addendum:** the original WP10 run below proved the executable
> libraries and reference slices, but did not package or drive the production desktop workflow.
> Production desktop integration is now locally green through packaged journeys A–E; the authoritative
> completion evidence is
> [`CAPABILITIES-DESKTOP-INTEGRATION-EVIDENCE.md`](CAPABILITIES-DESKTOP-INTEGRATION-EVIDENCE.md).
> `.github/workflows/capabilities-cross-platform.yml` now adds macOS and runs those same packaged
> journeys on macOS, Windows, and Ubuntu. All three packaged jobs, including journeys A–E, passed in
> [Actions run 29545112965](https://github.com/tim-a-wood/engineering-ui-kit/actions/runs/29545112965)
> at production integration fix `39d28c6`, then passed on `main` in
> [run 29545605675](https://github.com/tim-a-wood/engineering-ui-kit/actions/runs/29545605675)
> at `c02b87e`.

Integration branch: `claude/cap-era-integration`. The suite was captured locally on **macOS**
(darwin 24.6.0, Apple Silicon, Python 3.11.15) and repeated on GitHub-hosted **Windows** and
**Ubuntu Linux** runners in [Actions run 29465586532](https://github.com/tim-a-wood/engineering-ui-kit/actions/runs/29465586532).

---

## 1. Reproducible evidence — full suite run

Every suite below was run green at the integrated tree. Commands are copy-pasteable from the repo root.

| Surface | Command | Result |
|---|---|---|
| Core (contracts, generation, apply, migration, **foundation planning**, verification) | `npm run test --workspace=@engineering-ui-kit/core` | **337 passed** (including generated-host CAP-TEST-111–119) |
| TypeScript runtime | `npm run test --workspace=@engineering-ui-kit/capabilities-runtime` | **96 passed** |
| Foundation GUI | `npm run test --workspace=@engineering-ui-kit/gui` | **181 passed** (including production integration/recovery UI) |
| Desktop (privileged bridge/IPC) | `npm run typecheck --workspace=@engineering-ui-kit/desktop` | **clean** |
| Python runtime | `.venv/bin/python -m pytest runtimes/python -q` | **133 passed** |
| Packaged production desktop | `npm run test:capabilities:production-packaged --workspace=@engineering-ui-kit/desktop` | **Journeys A–E pass sequentially on macOS, Windows, and Ubuntu** ([run 29545112965](https://github.com/tim-a-wood/engineering-ui-kit/actions/runs/29545112965)) |
| Example — TS reference (React-in-one-deployable, HTTP, CLI, schedule, Electron IPC) | `cd examples/capabilities-ts-reference && npx vitest run` | **7 passed** |
| Example — React reference | `cd examples/capabilities-react-reference && npx vitest run` | **8 passed** |
| Example — Python reference (HTTP, CLI, schedule) | `.venv/bin/python -m pytest examples/capabilities-python-reference -q` | **15 passed** |
| Example — React↔Python over generated OpenAPI (CAP-TEST-066/069) | `cd examples/capabilities-react-python-reference && npx vitest run` **and** `.venv/bin/python -m pytest examples/capabilities-react-python-reference -q` | **TS 7 passed + Python 3 passed** |

The complete table passed unchanged in both jobs of
[Actions run 29465586532](https://github.com/tim-a-wood/engineering-ui-kit/actions/runs/29465586532)
at `7ec2588`: Ubuntu in 1m23s and Windows in 2m05s. The first CI passes found and fixed a stale
workspace lockfile (`b55384f`), missing Playwright browser provisioning (`ea24e5b`), Windows
timezone-data packaging, Windows process-tree termination, and an asynchronous E2E assertion race
(`44f9997`).

### Environment prerequisites (one-time)

- **Node:** the repo's `node_modules` must be installed at the root (`npm install`). No example needs
  extra npm dependencies; TS example suites resolve the runtime `src/` via a per-package `vitest`
  `resolve.alias` (see RUNTIME-DIST below) and are run with `cd <example> && npx vitest run`.
- **Python:** a repo-root `.venv` (git-ignored) provisioned with a 3.11 interpreter:
  ```sh
  python3.11 -m venv .venv
  .venv/bin/python -m pip install -e runtimes/python fastapi uvicorn httpx pytest
  ```
  On a network that intercepts TLS, add `--use-feature=truststore` to the `pip install`.
  The React↔Python E2E spawns a real Python server and resolves the interpreter as
  `CAPABILITIES_PYTHON_INTERPRETER ?? <repoRoot>/.venv/bin/python`; set that env var to point at any
  other provisioned interpreter (e.g. in CI).

---

## 2. Required test matrix (handoff §18)

Legend: **✅ real E2E green on the named platform**.

| Scenario | Boundary | Greenfield | Existing repo | Windows | macOS | Linux CI | Real E2E |
|---|---|:--:|:--:|:--:|:--:|:--:|---|
| React UI in one deployable | TS | ✅ | ✅ | ✅ | ✅ | ✅ | `capabilities-ts-reference`, `capabilities-react-reference` |
| React UI → API | TS→TS HTTP | ✅ | ✅ | ✅ | ✅ | ✅ | `capabilities-ts-reference` (HTTP host + client round-trip) |
| React UI → Python API | TS→Python HTTP | ✅ | ✅ | ✅ | ✅ | ✅ | `capabilities-react-python-reference` CAP-TEST-066/069 |
| Electron renderer → main | TS IPC | ✅ | ✅ | ✅ | ✅ | ✅ | `capabilities-ts-reference` (Electron IPC slice) |
| HTTP API | TS | ✅ | ✅ | ✅ | ✅ | ✅ | `capabilities-ts-reference` |
| HTTP API | Python | ✅ | ✅ | ✅ | ✅ | ✅ | `capabilities-python-reference` (FastAPI TestClient→dispatch) |
| CLI | TS | ✅ | ✅ | ✅ | ✅ | ✅ | `capabilities-ts-reference` |
| CLI | Python | ✅ | ✅ | ✅ | ✅ | ✅ | `capabilities-python-reference` (argparse host) |
| Scheduled/background | TS | ✅ | ✅ | ✅ | ✅ | ✅ | `capabilities-ts-reference` (injected-clock scheduler) |
| Scheduled/background | Python | ✅ | ✅ | ✅ | ✅ | ✅ | `capabilities-python-reference` (CronJob under injected `WallClock`) |
| Legacy `runtime.js` adoption | TS compatibility | n/a | ✅ | ✅ | ✅ | ✅ | actual `runtime.js` → real HTTP before and after additive apply, byte-identical preservation, and conformance-retirement gate (CAP-TEST-106–108) |

**Cross-cutting coverage** (proven at the core/runtime level, applies to every applicable cell):
deterministic generation (`canonicalRecordHash`, generator determinism tests); schema/type parity
(CAP-TEST-069 shared canonical fixtures across TS/Python); private-exposure default + protected denial;
secret canary/redaction (`redaction.ts` + `verificationRunner` deep-walk); timeout/cancellation
(runtime `Outcome.timedOut`/`cancelled`); lifecycle scopes; health/readiness/shutdown (Python host);
ownership tamper refusal + atomic apply rollback (13 forced-failure tests in `generationApply`);
impact-scoped staleness (`impact.ts`, CAP-TEST-088); desktop-stopped standalone execution (examples
have no `apps/desktop`/`apps/gui` dependency; Python invokes no Node); offline-after-install
(no network at run time once deps are installed).

**Windows/Linux evidence:** every supported TypeScript/Python runtime and reference-application cell
passed on the real GitHub-hosted runners in
[run 29465586532](https://github.com/tim-a-wood/engineering-ui-kit/actions/runs/29465586532),
including legacy compatibility execution across a real HTTP boundary before and after migration.

---

## 3. Definition-of-Done scorecard (handoff §19)

| # | Requirement | Status | Evidence / gap |
|:--:|---|:--:|---|
| 1 | Greenfield TS + Python apps generated from approved records, run independently | ✅ | Deterministic generators (`generation/**`) + records→files assembly (`generationAssembly`, CAP-TEST-088) + transactional apply (`generationApply`) + runnable reference apps (`capabilities-ts-reference`, `capabilities-python-reference`). |
| 2 | Existing repo adopted via reviewable migration overlay without losing behavior | ✅ | WP9A `planExistingRepoMigration` (no-loss assessment) + WP9B CAP-TEST-103/104: originals byte-identical after additive apply, rollback restores exactly. |
| 3 | React web, Electron IPC, HTTP, CLI, scheduled triggers — all real E2E | ✅ | `capabilities-ts-reference` (React/HTTP/CLI/schedule/Electron IPC), `capabilities-react-reference`, `capabilities-python-reference` (HTTP/CLI/schedule). |
| 4 | React invokes a Python capability through generated OpenAPI | ✅ | WP4B-react-python CAP-TEST-066 (React/TS → real spawned FastAPI, live round-trip) + CAP-TEST-069 (generated OpenAPI agrees with served `/openapi.json`; shared canonical fixtures accepted/rejected identically). |
| 5 | Module handoffs contain implementable specs + generated contracts/paths/tests | ✅ | **WP5A (`1b394df`+`90725d6`).** Foundation planning surfaces deployables/language/hosts/allocations with auto-proposed + explained allocations (`proposeFoundation`), a foundation review in Design (both projections) with a separate approval and a Build/handoff prerequisite gate, and enriches the module brief (`ModuleImplementationBrief.deployment`) + the From-spec Build launch with generated contract/path/command references. CAP-TEST-071..075. |
| 6 | Connect writes and verifies real integration code | ✅ | WP6B trigger-first editors + WP5B real `Deployable`/`InboundBinding` persistence + WP8 `runConnectionVerification` (real launch+trigger; simulation can never `pass`). |
| 7 | "No UI" produces a headless connection path | ✅ | `embedded-library` inbound binding generates a headless callable (TS + Python generators + runtime dispatch); no UI host required. |
| 8 | Ownership conflicts, atomic rollback, secret leakage, auth defaults, runtime upgrades tested | ✅ | `generationApply` 13 forced-failure/tamper tests; redaction + canary; private-default/protected-denial; WP9B `planRuntimeUpgradePreview` (preview-only, blocks silent upgrades). |
| 9 | TS + Python conformance matrices pass on the supported platform set | ✅ | Full matrix green on **macOS, Windows, and Ubuntu Linux**; real Windows/Linux evidence is [Actions run 29465586532](https://github.com/tim-a-wood/engineering-ui-kit/actions/runs/29465586532). |
| 10 | Generated targets run with EUIK/Claude Code/Cursor/Copilot/desktop closed | ✅ | Examples run under plain `vitest`/`pytest` with no editor, no desktop, and no GUI process; Python invokes no Node. |

**Fully met: 10 of 10.** The final platform gate is [Actions run 29465586532](https://github.com/tim-a-wood/engineering-ui-kit/actions/runs/29465586532).

---

## 4. Experimental-exit decision

Per the WP10 gate, "Capabilities remains Experimental unless the complete TypeScript and Python
evidence set is green." The evidence set is now green on **macOS, Windows, and Ubuntu Linux**, with
zero known severity-1/severity-2 conformance or security defects and standalone/offline-after-install
operation demonstrated. The WP10 passes caught and fixed both a latent SCHED-ENUM regression and the
real cross-platform defects recorded in §1, which is exactly the kind of drift this gate exists to surface.

**Decision: the technical Experimental-exit gate is met; Capabilities remains `Experimental` pending
the separate product decision required by handoff §WP10.6.** There is no remaining engineering-evidence
gap in the 10-point Definition of Done. Both language runtimes, both code generators, the
generate→apply→rollback pipeline, real connection verification, foundation planning, and every supported
trigger's real E2E are proven and reproducible across the supported platform set.

---

## 5. Remaining backlog (tracked, non-blocking for the executable core)

Detail and rationale for each item live in the ledger's "Open issues" section.

- ~~**WP5A** — Foundation planning UI~~ **DONE** (`1b394df`+`90725d6`, CAP-TEST-071..075, DoD #5 met).
- ~~**Cross-platform CI**~~ **DONE** (`0245dfb` workflow; green Windows+Ubuntu
  [run 29465586532](https://github.com/tim-a-wood/engineering-ui-kit/actions/runs/29465586532); DoD #9 met).
- ~~**Legacy `runtime.js` compatibility-adapter execution**~~ **DONE** (`7ec2588`, CAP-TEST-106–108:
  migrated real-HTTP E2E plus the "conformance replaces compatibility" retirement gate).
- ~~**WP7 followups**~~ **DONE in desktop integration:** Python composition roots, real DI factories,
  generated OpenAPI/client application, registry equivalence, and generated host execution are covered
  by CAP-TEST-111–119 and packaged journeys A–C.
- ~~**WP8 followups**~~ **DONE in desktop integration:** Electron/Python launch presets and
  freshness/impact aggregation are production orchestrator behavior and packaged evidence.
- ~~**RUNTIME-DIST**~~ **DONE in desktop integration:** complete built TS runtime declarations/code and
  Python runtime sources ship as desktop resources and are installed into generated targets; packaged
  A–C build and launch those targets with the desktop acting only as orchestrator.
- ~~**REDACTION-JSON**~~ **DONE:** the shared helper handles quoted secret keys and the verification
  runner retains deep-walk defense; hostile tests cover both.
- **External systems only:** real MATLAB Engine and real Azure DevOps still require installations or
  credentials and remain separate experimental adapters.

---

_Last updated after the green production desktop A–E matrix on macOS, Windows, and Ubuntu in
[Actions run 29545112965](https://github.com/tim-a-wood/engineering-ui-kit/actions/runs/29545112965)
and the final `main` verification in
[run 29545605675](https://github.com/tim-a-wood/engineering-ui-kit/actions/runs/29545605675)._
