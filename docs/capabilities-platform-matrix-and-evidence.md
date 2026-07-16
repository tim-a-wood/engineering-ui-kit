# CAP-ERA-001 — WP10 Platform Matrix, Definition-of-Done Scorecard, and Experimental-Exit Evidence

This is the coordinator's final evidence index for the Capabilities Executable Reference
Architecture initiative (`docs/CAPABILITIES-EXECUTABLE-REFERENCE-ARCHITECTURE-CLAUDE-HANDOFF.md`,
CAP-ERA-001). It records what has been proven, **how to reproduce it**, and — honestly — what
remains before the `Experimental` badge can be removed. The authoritative packet-by-packet status
lives in [`capabilities-execution-ledger.md`](capabilities-execution-ledger.md); this document is the
requirement→evidence roll-up required by handoff §18/§19/WP10.

Integration branch: `claude/cap-era-integration`. All evidence below was captured on **macOS**
(darwin 24.6.0, Apple Silicon) with Python 3.11.15 (user-space standalone build) and Node via the
repo toolchain.

---

## 1. Reproducible evidence — full suite run

Every suite below was run green at the integrated tree. Commands are copy-pasteable from the repo root.

| Surface | Command | Result |
|---|---|---|
| Core (contracts, generation, apply, migration, **foundation planning**, verification) | `npm run test --workspace=@engineering-ui-kit/core` | **317 passed** (WP5A: +CAP-TEST-071/072/073) |
| TypeScript runtime | `npm run test --workspace=@engineering-ui-kit/capabilities-runtime` | **95 passed** |
| Foundation GUI | `npm run test --workspace=@engineering-ui-kit/gui` | **174 passed** (WP5A: +CAP-TEST-074/075) |
| Desktop (privileged bridge/IPC) | `npm run typecheck --workspace=@engineering-ui-kit/desktop` | **clean** |
| Python runtime | `.venv/bin/python -m pytest runtimes/python -q` | **130 passed** |
| Example — TS reference (React-in-one-deployable, HTTP, CLI, schedule, Electron IPC) | `cd examples/capabilities-ts-reference && npx vitest run` | **7 passed** |
| Example — React reference | `cd examples/capabilities-react-reference && npx vitest run` | **8 passed** |
| Example — Python reference (HTTP, CLI, schedule) | `.venv/bin/python -m pytest examples/capabilities-python-reference -q` | **15 passed** |
| Example — React↔Python over generated OpenAPI (CAP-TEST-066/069) | `cd examples/capabilities-react-python-reference && npx vitest run` **and** `.venv/bin/python -m pytest examples/capabilities-react-python-reference -q` | **TS 7 passed + Python 3 passed** |

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

Legend: **✅ real E2E green (macOS)** · **⬚ deferred to CI** (not run in this single-developer macOS
environment) · **◐ partial** (see note).

| Scenario | Boundary | Greenfield | Existing repo | Windows | macOS | Linux CI | Real E2E |
|---|---|:--:|:--:|:--:|:--:|:--:|---|
| React UI in one deployable | TS | ✅ | ✅ | ⬚ | ✅ | ⬚ | `capabilities-ts-reference`, `capabilities-react-reference` |
| React UI → API | TS→TS HTTP | ✅ | ✅ | ⬚ | ✅ | ⬚ | `capabilities-ts-reference` (HTTP host + client round-trip) |
| React UI → Python API | TS→Python HTTP | ✅ | ✅ | ⬚ | ✅ | ⬚ | `capabilities-react-python-reference` CAP-TEST-066/069 |
| Electron renderer → main | TS IPC | ✅ | ✅ | ⬚ | ✅ | ⬚ | `capabilities-ts-reference` (Electron IPC slice) |
| HTTP API | TS | ✅ | ✅ | ⬚ | ✅ | ⬚ | `capabilities-ts-reference` |
| HTTP API | Python | ✅ | ✅ | ⬚ | ✅ | ⬚ | `capabilities-python-reference` (FastAPI TestClient→dispatch) |
| CLI | TS | ✅ | ✅ | ⬚ | ✅ | ⬚ | `capabilities-ts-reference` |
| CLI | Python | ✅ | ✅ | ⬚ | ✅ | ⬚ | `capabilities-python-reference` (argparse host) |
| Scheduled/background | TS | ✅ | ✅ | ⬚ | ✅ | ⬚ | `capabilities-ts-reference` (injected-clock scheduler) |
| Scheduled/background | Python | ✅ | ✅ | ⬚ | ✅ | ⬚ | `capabilities-python-reference` (CronJob under injected `WallClock`) |
| Legacy `runtime.js` adoption | TS compatibility | n/a | ◐ | ⬚ | ◐ | ⬚ | migration overlay + additive apply proven (CAP-TEST-103/104); compat-adapter **execution** deferred |

**Cross-cutting coverage** (proven at the core/runtime level, applies to every applicable cell):
deterministic generation (`canonicalRecordHash`, generator determinism tests); schema/type parity
(CAP-TEST-069 shared canonical fixtures across TS/Python); private-exposure default + protected denial;
secret canary/redaction (`redaction.ts` + `verificationRunner` deep-walk); timeout/cancellation
(runtime `Outcome.timedOut`/`cancelled`); lifecycle scopes; health/readiness/shutdown (Python host);
ownership tamper refusal + atomic apply rollback (13 forced-failure tests in `generationApply`);
impact-scoped staleness (`impact.ts`, CAP-TEST-088); desktop-stopped standalone execution (examples
have no `apps/desktop`/`apps/gui` dependency; Python invokes no Node); offline-after-install
(no network at run time once deps are installed).

**Windows/Linux cells (⬚):** not exercised in this environment (single macOS developer machine; a
Windows installer/runner is separately tracked in project memory). The runtimes and examples use only
cross-platform Python/Node APIs; the remaining work is to run this same matrix under Windows and Linux
CI runners. This is the primary gap for §18's "all required matrix cells pass".

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
| 9 | TS + Python conformance matrices pass on the supported platform set | ◐ | Full matrix green on **macOS**; **Windows + Linux CI runs are the remaining work** (see §2). |
| 10 | Generated targets run with EUIK/Claude Code/Cursor/Copilot/desktop closed | ✅ | Examples run under plain `vitest`/`pytest` with no editor, no desktop, and no GUI process; Python invokes no Node. |

**Fully met: 9 of 10. Partial: #9 (cross-platform CI) only.** (#5 met by WP5A, `1b394df`+`90725d6`.)

---

## 4. Experimental-exit decision

Per the WP10 gate, "Capabilities remains Experimental unless the complete TypeScript and Python
evidence set is green." The **macOS** evidence set is green with zero known severity-1/severity-2
conformance or security defects, and standalone/offline-after-install operation is demonstrated. The
WP10 matrix pass additionally **caught and fixed** a latent SCHED-ENUM regression in the Python
schedule example (a post-merge enum rename), which is exactly the kind of drift this gate exists to
surface.

**Decision: Capabilities remains `Experimental`.** Removing the badge is a separate product decision
(handoff §WP10.6) and now waits on a **single** remaining gap:

1. **Cross-platform matrix (§18 / DoD #9)** — run this identical suite on Windows and Linux CI runners.

(DoD #5 — foundation-orchestration UI — is now **met** by WP5A: deployables/allocations are surfaced and
explained in the architecture interview, a foundation review with a separate approval + Build prerequisite
gate is in the Design workflow, and generated contract/path/command references enrich the module brief and
the From-spec Build launch. Re-run matrix green: core 317, gui 174, all other suites unchanged.)

This last gap does not undermine the executable core: both language runtimes, both code generators, the
generate→apply→rollback pipeline, real connection verification, foundation planning, and every trigger's
real E2E are proven and reproducible today.

---

## 5. Remaining backlog (tracked, non-blocking for the executable core)

Detail and rationale for each item live in the ledger's "Open issues" section.

- ~~**WP5A** — Foundation planning UI~~ **DONE** (`1b394df`+`90725d6`, CAP-TEST-071..075, DoD #5 met).
- **Cross-platform CI** — Windows + Linux matrix runs. *(DoD #9 / §18 ⬚ cells — the last Experimental-exit gate.)*
- **Legacy `runtime.js` compatibility-adapter execution** — the review-level migration + additive
  apply are proven; actually wrapping/invoking a legacy `runtime.js` and the "conformance replaces
  compatibility" retirement gate are deferred (handoff-acknowledged).
- **WP7-followups** — React source-marker adoption (§10.4), OpenAPI-artifact wiring into apply,
  registry-diagnostic equivalence, a Python composition-root generator, real DI glue (currently
  `resolved.g.*` placeholders).
- **WP8-followups** — Electron/Python launch presets for `runConnectionVerification`; freshness/impact
  aggregation surfacing.
- **RUNTIME-DIST** — TS runtime package `exports` resolve only `./dist/*` (unbuilt); consumers use a
  `src` alias workaround. Add a `source`/`development` export condition or build into consumer
  resolution before shipping real generated TS apps. Also affects a deep relative import in the
  react-python example's `generation/contract.ts` (no `@engineering-ui-kit/core` generation subpath export).
- **REDACTION-JSON** — frozen `redactSensitiveText` misses JSON-quoted secret keys; `verificationRunner`
  compensates with a deep-walk. Consider hardening the shared helper.

---

_Last updated by the Opus integration coordinator after the WP10 matrix pass. Regenerate the evidence
in §1 by re-running the listed commands from the repo root._
