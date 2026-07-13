# Capabilities packet completion evidence

## CAP-PKT-014 — Module verification and provenance

**Status:** Complete (2026-07-12)

**Delivered:**
- `packages/core/src/capabilities/verification.ts` — suite selection by moduleType, VerificationRecord build, outcome classes, repair packet context, ready only on exact pass
- `packages/core/test/capabilities/cap-test-016.test.ts` — injected fake command results for all outcome classes
- `apps/gui/src/views/capabilities/VerificationPanel.tsx` + CapabilitiesView Verification section
- Bridge `capabilitiesRunModuleVerification` (desktop IPC persist + mock/gui/preload/bridgeApi)
- Export via `packages/core/src/capabilities/index.ts`

**Verification:**
- `npm test -w packages/core -- cap-test-016` — CAP-TEST-016 pass
- Typecheck packages/core + apps/gui

**Decisions used:** CAP-ARCH-006; ready never without exact successful verification provenance

## CAP-PKT-001 — Version 1 contracts and schemas

**Status:** Complete (2026-07-12)

**Delivered:**
- `standards/schemas/capabilities/*.schema.json` (22 contracts)
- `packages/core/src/capabilities/{parity,types,index}.ts`
- Fixtures under `packages/core/test/capabilities/fixtures/`
- `packages/core/test/capabilities/cap-test-001.test.ts`

**Verification:**
- `npm run typecheck -w packages/core` — pass
- `npm test -w packages/core -- capabilities` — CAP-TEST-001 pass

**Decisions used:** CAP-DEC-004

## CAP-PKT-002 — Validators, gates, architecture rules

**Status:** Complete

**Delivered:** `diagnostics.ts`, `validation.ts`, `gates.ts`, `graph.ts`, `cap-test-002.test.ts`

**Verification:** CAP-TEST-002 pass

## CAP-PKT-003 — Definition persistence

**Status:** Complete

**Delivered:** `persistence.ts` under `<userData>/workspace/projects/<id>/capabilities/`, CAP-TEST-011

**Decisions used:** CAP-DEC-005

## CAP-PKT-004 — Run/evidence persistence

**Status:** Complete

**Delivered:** `runs.ts`, CAP-TEST-013 (legacy HandoffRun independence)

## CAP-PKT-005 — Named capability bridge

**Status:** Complete (MVP surface)

**Delivered:** `apps/desktop/src/capabilities/ipc.ts`, bridge/preload/gui/mock parity methods, CAP-TEST-003

## CAP-PKT-006 / 007 — Navigation + Guided/Design shell

**Status:** Complete (MVP shell)

**Delivered:** Capabilities nav item, `CapabilitiesView.tsx`, Guided/Design toggle over one model, CAP-TEST-004/005 surface

## CAP-PKT-012 / 013 / 015 / 016 / 017 / 018 / 019 (core)

**Status:** Complete (core logic)

**Delivered:** packets, overlay scope hard-block, freshness, impact, registry/resolver, jobs, filesystem policy, tests 014/015/017/018/019/023/024/025(core)

## CAP-PKT-020–028 adapters (desktop fake boundaries)

**Status:** Complete for fake-boundary paths

**Delivered:** MATLAB session/invoke/snapshot fake boundary; Azure discover/import fake boundary; safeStorage secret put/validate; consequential explicit-action gates

**Real MATLAB/Azure:** skipped unless environment configured (fake tests mandatory)

## CAP-PKT-029 / 030

**Status:** Complete (helpers + tests)

**Delivered:** migration idempotence, redaction/canary scan helpers, CAP-TEST-036/039

## CAP-PKT-008 — Product interview import and gate

**Status:** Complete (2026-07-12)

**Delivered:**
- `packages/core/src/capabilities/interview.ts` — parse/coerce product interview response, field-level delta, bounded packet helper
- `packages/core/test/capabilities/cap-test-006.test.ts`, `cap-test-007.test.ts`
- `apps/gui/src/views/capabilities/ApplicationDefinition.tsx`, `InterviewImport.tsx` wired into CapabilitiesView Application definition section
- Bridge: `capabilitiesBuildInterviewPacket`, `capabilitiesImportInterviewResponse` (desktop ipc / preload / gui / mock)

**Verification:**
- `npm test -w packages/core -- cap-test-006` — CAP-TEST-006
- `npm test -w packages/core -- cap-test-007` — CAP-TEST-007
- `npm run typecheck -w packages/core`
- `npm run typecheck -w apps/gui`

**Notes:** Import saves draft only; approved revision unchanged until explicit `approveApplication` after CAP-GATE-001.

## CAP-PKT-024 — Binding mapping and connection packet

**Status:** Complete (2026-07-12)

**Delivered:**
- `packages/core/src/capabilities/binding.ts` — `validateFrontendBinding`, `evaluateBindingApprovalGate`, `buildConnectionPacket`, ambiguity resolution
- `apps/gui/src/views/capabilities/BindingEditor.tsx` — all behavior fields, ambiguity UI, approve + packet export (`selectionEvidence` prop)
- `packages/core/test/capabilities/cap-test-030.test.ts`

**Verification:**
- `npm test -w packages/core -- cap-test-030` — pass

**Completion criteria:** Incomplete mappings block approval; approved packet names exactly one binding/operation with bounded paths.

## CAP-PKT-025 — Binding execution and simulation modes

**Status:** Complete (2026-07-12)

**Delivered:**
- Simulation helpers in `binding.ts` (`simulateBindingMode`, `bindingModeLabel`, `runConsequentialAction`)
- Modes: connected (explicit plan), approved-example, invalid-input, dependency-unavailable, timeout — no adapter calls; simulations do not earn connected verification
- Consequential explicit-action gate (CAP-SEC-002 / CAP-TEST-032)
- BindingEditor mode label + outcome presentations
- `packages/core/test/capabilities/cap-test-031.test.ts`, `cap-test-032.test.ts`

**Verification:**
- `npm test -w packages/core -- cap-test-031 cap-test-032` — pass

**Exclusions honored:** No mock-server infrastructure; no alternate transport.

## CAP-PKT-010 — Architecture diagram and list projection

**Status:** Complete (2026-07-12)

**Delivered:**
- `packages/core/src/capabilities/architectureProjection.ts` — derived Guided/Design nodes/edges/list; focus neighbors; status text+icon
- `packages/core/test/capabilities/cap-test-012.test.ts` — 20-node fixture; ID/edge parity; no source mutation
- `apps/gui/src/views/capabilities/ArchitectureView.tsx` — read-only SVG + list; keyboard arrows; CAP-DEC-006
- Wired into `CapabilitiesView` Architecture section
- Exported from `packages/core/src/capabilities/index.ts`

**Verification:**
- `npm test -w packages/core -- cap-test-012` — CAP-TEST-012
- `npm run typecheck -w packages/core` / `npm run typecheck -w apps/gui`

**Decisions used:** CAP-DEC-006 (read-only select/focus)

## CAP-PKT-023 — Preview selection evidence

**Status:** Complete (2026-07-12)

**Delivered:**
- `apps/gui/src/views/capabilities/previewSelection.ts` — SelectionEvidence builders, stable marker (`data-cap-id` / `data-testid`), confirmation gate, picker session cleanup, `PREVIEW_BINDING_PICKER_JS`
- `apps/gui/src/views/capabilities/PreviewBindingPicker.tsx` — pick UI with unmarked confirmation
- `apps/gui/test/cap-test-029-preview-selection.test.ts` — marked/unmarked/cancel/navigate

**Verification:**
- `npm test -w apps/gui -- cap-test-029` — CAP-TEST-029
- `npm run typecheck -w apps/gui`

**Decisions used:** CAP-DEC-008 (stable marker or explicit source-target confirmation)

**Exclusions held:** no React fiber, no source maps, no binding generation in this packet

## CAP-PKT-009 — Architecture planning import and gate

**Status:** Complete (2026-07-12)

**Delivered:**
- `packages/core/src/capabilities/architectureInterview.ts` — packet export, proposal import, unsupported/redundant/cycle/orphan evaluation via `evaluateArchitectureGate` + `detectCycles`, `approveArchitectureIfReady`
- `packages/core/test/capabilities/cap-test-008.test.ts`, `cap-test-009.test.ts`
- `apps/gui/src/views/capabilities/ArchitectureInterview.tsx` — export/import/review/approve; cycle paths; blocks module interviews until approved
- Wired into `CapabilitiesView` Architecture section (alongside ArchitectureView diagram)
- Exported from `packages/core/src/capabilities/index.ts`
- Bridge: `capabilitiesSaveArchitectureDraft` / `capabilitiesApproveArchitecture` (existing); module draft/approve channels exposed for follow-on packet

**Verification:**
- `npm test -w packages/core -- test/capabilities/cap-test-008.test.ts test/capabilities/cap-test-009.test.ts` — 10 tests pass
- `npm run typecheck -w packages/core` — pass

**Completion criteria:** Need-traced minimal acyclic proposal passes CAP-GATE-002; unsupported, redundant, and cyclic proposals fail. Graph is derived only (CAP-TEST-009).

## CAP-PKT-011 — Module interviews and readiness

**Status:** Complete (2026-07-12)

**Delivered:**
- `packages/core/src/capabilities/moduleInterview.ts` — one interview depth; type-specific applicable details for domain/workflow/connection/platform/experience; CAP-GATE-003 via `evaluateModuleGate`; unresolved domain questions block; `approveModuleIfReady`
- `packages/core/test/capabilities/cap-test-010.test.ts` — all five module types
- `apps/gui/src/views/capabilities/ModulesView.tsx` — list modules; per-type export/import/approve; gate diagnostics
- Wired into `CapabilitiesView` Modules section (blocked until architecture approved)
- Bridge: `capabilitiesSaveModuleDraft`, `capabilitiesApproveModule` on desktop/preload/gui/mock

**Verification:**
- `npm test -w packages/core -- test/capabilities/cap-test-010.test.ts` — 4 tests pass
- `npm run typecheck -w packages/core` — pass

**Exclusions honored:** No multiple interview depths; no implementation packets in this packet.

## CAP-PKT-031 — Accessibility, state catalogue, and performance

**Status:** Complete for automated core/GUI smoke (2026-07-12)

**Delivered:**
- `packages/core/src/capabilities/perfFixture.ts` — fixed 100 modules / 300 edges
- `packages/core/test/capabilities/cap-test-041.test.ts` — 20-run p95 projection (≤200ms) and freshness recompute (≤500ms); delayed job cancellation
- `apps/gui/test/cap-test-038-a11y.test.tsx` — keyboard/label/live-region/list-fallback/reduced-motion smoke on Capabilities views
- Capabilities focus-visible + reduced-motion CSS; `role="status"` on panel status

**Verification:**
- `npm test -w packages/core -- cap-test-041` — pass (projection p95 ≈5ms, recompute p95 ≈0.2ms on Apple M4 / 10 cores / 16GB)
- `npm test -w apps/gui -- cap-test-038` — pass (5 tests)

**Packaged Electron a11y:** not separately driven; GUI static markup + CSS checks are the blocking automated path.

## CAP-PKT-032 — MVP end-to-end verification

**Status:** Complete for offline core journeys; packaged Electron UI not run

**Delivered:**
- `packages/core/src/capabilities/journeys.ts` — CAP-JRN-001–008 with CapabilityWorkspace + fake filesystem/MATLAB/Azure adapters (offline)
- `packages/core/test/capabilities/cap-test-040-journeys.test.ts`
- `apps/desktop/e2e/capabilities-journeys.mjs` — Node harness patterned after `apps/desktop/e2e/`; writes packaged vs offline evidence under `apps/desktop/validation-evidence/capabilities-journeys/`

**Verification:**
- `npm test -w packages/core -- cap-test-040` — offline journeys must pass
- `node apps/desktop/e2e/capabilities-journeys.mjs` — offline pass; packaged status `not-run`

**Packaged vs core:**

| Path | Status | Notes |
|---|---|---|
| Offline core + fake adapters | **passed** (blocking) | CAP-JRN-001–008 + restart + deferred-absent |
| Packaged Electron Playwright | **not-run** | Honest skip: harness records `packaged-status.json`; GUI interview/binding Playwright path not launched |

Continue from remaining packets without redoing completed foundation / 031–032 offline work.

## Audit correction — demo-removal pass (2026-07-13)

This addendum corrects earlier over-claims. The CAP-PKT-014 "Complete" entry above was
accurate for core `verification.ts` but **not** for the GUI: `VerificationPanel.tsx` still
carried an injected-outcome scenario picker and `spec-demo`/`impl-demo`/… placeholder hashes,
and `BindingEditor.tsx` still carried a "Demo ambiguous mapping" button and free-text operation
entry. Those production demo paths are now removed.

### Packet 5 — real verification UI (was Partial, now Complete for the GUI production path)

- `apps/gui/src/views/capabilities/VerificationPanel.tsx` rewritten:
  - Loads approved modules from the `CapabilityModuleRecord[]` list (`capabilitiesListModules`
    seam) and lets the user pick an approved module.
  - Removed the scenario picker, `commandsForScenario`, the demo `HASHES` map, and all
    renderer-supplied command outcomes.
  - Calls `capabilitiesVerifyApprovedModule({ projectId, moduleId, explicit: true })` only —
    the desktop loads the manifest, computes hashes, and runs configured commands.
  - Displays real command results, outcome, input hashes, evidence references, diagnostics,
    freshness (`primaryState`), and repair context. Setup failure is shown separately (`role="alert"`).
  - Refreshes module/architecture state after verification via `onVerified`.
- Evidence: `apps/gui/test/cap-test-016-verification.test.tsx` (4 tests) — empty state, no
  demo markers, explicit-only verify seam, freshness persistence, non-approved rejection.

### Packet 4 — binding editor completion (was Partial, now Partial — demo removed)

- `apps/gui/src/views/capabilities/BindingEditor.tsx`:
  - Removed the "Demo ambiguous mapping" button and `seedAmbiguityDemo`.
  - Operation selection now sources `{operationId, contractVersion}` **only** from persisted
    approved module manifests (`records` prop) via a single-select; free-text Operation ID/version
    inputs removed.
  - Added real add/remove Input and Output mapping editors.
  - Simulation modes remain clearly labelled and still cannot earn connected verification credit.
- Evidence: `apps/gui/test/cap-test-030-binding-editor.test.tsx` (3 tests).
- **Remaining (still Partial):** binding drafts are persisted via `capabilitiesSaveBindingDraft`
  but there is no bridge read/list method, so the editor does not yet reload a persisted draft on
  section switch / project reload. Binding record reload is the named remaining behavior.

### Regression results (2026-07-13)

- `npm run typecheck -w packages/core` — pass
- `npm test -w packages/core` — 130/130
- `npm run typecheck -w apps/desktop` — pass
- `npm run typecheck -w apps/gui` — pass
- `npm test -w apps/gui` — 61/61 (was 54; +4 CAP-TEST-016 GUI, +3 CAP-TEST-030 GUI)
- `npm run build` — pass
- `git diff --check` — clean
- `rg -n "playwright|fsevents|node:fs|node:crypto|child_process" apps/gui/dist` — no matches

### Still explicitly NOT complete (unchanged by this pass)

- Packet 1 real external-Copilot handoff **file** export — no `capabilities*Packet` file-writing
  bridge method exists yet; `capabilitiesBuildInterviewPacket` returns structured data, not written
  files with paths/sizes/hashes/upload set. **Partial.**
- Packet 2 module implementation lifecycle overlay UI (inspect → warnings → apply → verify inside
  a single approved-module flow) — core seams exist; the combined GUI flow is not assembled. **Partial.**
- Packet 3 impact/delta approval queue UI — core helpers exist; queue UI not assembled. **Partial.**
- CAP-TEST-040 packaged Electron journey remains **not-run** (honest skip); production MATLAB/Azure
  remain fake-boundary only. Not claimed complete.

## Codex validation and integration pass (2026-07-13)

Opus's reported 130 core / 61 GUI baseline and clean GUI build were independently reproduced.
Two review findings were corrected: the verification view now includes manifest-specific suites,
and binding drafts/approvals reload through `capabilitiesListBindings` rather than React-only state.

Additional product seams completed in this pass:

- Interview exports now write a real three-file app-managed handoff set with run ID, paths, byte
  sizes, SHA-256 values, prompt, and persisted CAP-CONTRACT-021 packet lifecycle.
- Approved modules export real implementation handoff files and restore the latest persisted run.
- The module flow now selects/inspects a zip, renders blockers/warnings, requires separate warning
  acceptance, applies through the capability-scoped handler, invalidates freshness, and invokes
  desktop-owned verification.
- Impact proposals and explicit approvals now persist and render affected/unaffected explanations
  plus deterministic packet order.

## Audit correction — delta lifecycle pass (2026-07-13, WS1)

CAP-PKT-016 delta packet export and completed-target queue advancement are now implemented end to
end and no longer "not complete".

Delivered:

- `packages/core/src/capabilities/impact.ts` — `deltaQueueState`, `assertTargetExportable`
  (single-actionable-target guard; deterministic provider-first order preserved from `calculateImpact`).
- `packages/core/src/capabilities/runs.ts` — persisted per-impact completed targets
  (`getDeltaProgress`, `markDeltaTargetComplete`) under `evidence/impact/<changeId>.progress.json`.
- `apps/desktop/src/capabilities/ipc.ts` — `deltaQueueState`, `exportDeltaPacket` (writes a real
  three-file delta handoff set with all CAP-CONTRACT-016 fields: impact record ID, one target,
  change reason, previous/target contract versions, preserve/add/change behavior, new tests,
  unchanged neighbor IDs, allowed/expected/protected paths, `ui-overlay.zip` required output),
  and `markDeltaTargetComplete` (gated on a real passing verification for that exact target).
- Bridge surfaces updated together: `apps/desktop/src/bridgeApi.ts`, `apps/desktop/src/preload.cts`,
  `apps/gui/src/bridge.ts`, `apps/gui/src/mockBridge.ts`. CAP-TEST-003 canonical set extended.
- GUI: `apps/gui/src/views/capabilities/DeltaQueue.tsx` + new "Delta queue" section — affected/
  unaffected explanations, ordered queue with only the next target actionable, export-next, and
  verify-&-complete advancement. Application-wide regeneration is never offered.

Executable evidence (2026-07-13):

- `npm test -w packages/core -- cap-test-021` — 3 pass (queue ordering, single-actionable, export guard).
- `npm test -w apps/gui -- cap-test-022` — 3 pass (export-next-only, verification-gated completion,
  advance-and-finish). CAP-TEST-003 extended and passing.
- `npm run typecheck -w packages/core|apps/desktop|apps/gui` — pass.
- `npm test -w packages/core` — 133/133; `npm test -w apps/gui` — 65/65; `npm run build` — pass;
  `git diff --check` — clean; renderer Node-module scan — no matches.

## Production adapter pass (2026-07-13, WS2 + WS3)

### CAP-DEC-012 — real MATLAB adapter

- `apps/desktop/src/capabilities/matlabAdapter.ts` + `apps/desktop/src/capabilities/matlab_bridge.py`
  — real `matlab.engine` worker spawned as a child process (NDJSON over stdio); the renderer never
  receives an engine handle. Per-project serialized calls, cross-project isolation, lazy start,
  reuse, explicit stop, crash/restart, allowlisted functions/scripts/expressions, workspace
  put/get/list/clear, working-dir/path changes, typed rejection of unsupported values, real `.mat`
  snapshot save/restore with checksum + provenance, shutdown-on-exit.
- Gated: the deterministic fake worker is used ONLY under `EUIK_TEST_MODE=1` or genuine Engine
  unavailability. `apps/desktop/src/capabilities/ipc.ts` `capabilities:matlab-*` handlers now call
  `createMatlabAdapter(...)`; the former in-line fake bodies are removed.
- Evidence: `npx vitest run apps/desktop/test/matlab-adapter.test.ts` — 22 pass; the real-integration
  test genuinely spawned `python3 matlab_bridge.py`, hit real discovery, and **skipped with the exact
  reason**: `matlab.engine import failed: No module named 'matlab'` (no MATLAB installed here). Real
  MATLAB execution is therefore NOT claimed.

### Real Azure DevOps read-only adapter (WS3)

- `apps/desktop/src/capabilities/azureAdapter.ts` — real read-only REST client (api-version 7.1,
  GET-only), PAT passed in-process only and never returned/logged, org/project as non-secret config,
  operations for credential validation / discovery / repositories / work-item read-import / pipeline
  / test / artifact / readiness / provenance. Imported records are proposed impact / draft
  (`proposedImpact: true, mutatesApprovedSpec: false`) — never mutate approved records. Pagination,
  429+Retry-After, timeout, AbortController cancellation, sanitized errors.
- Gated: fake mode ONLY under `EUIK_TEST_MODE=1`. `ipc.ts` `capabilities:azure-*` handlers decrypt the
  PAT via `safeStorage` and call the adapter; bridge input shapes extended with non-secret
  `azureConfig` (all four surfaces updated together).
- Evidence: `npx vitest run apps/desktop/test/azure-adapter.test.ts` — 17 pass + 1 opt-in real-network
  test skipped (no `EUIK_AZURE_ORG`/`EUIK_AZURE_PAT`). Hostile tests prove: PAT never leaks into any
  value/provenance/error/serialized record; every operation is GET-only (no mutation path built);
  fake mode markers cannot earn connected credit. Real Azure execution is NOT claimed.

Note: remaining `fake-boundary` string matches in the repo are confined to the adapters' explicit
fake-worker code and the renderer mock double — the real desktop handlers no longer return it.

## Executable-test audit (2026-07-13)

A CAP-TEST ID is counted below only when an actual executable test exercises the required
behavior (comments/tables do not count). Commands used:
`npm test -w packages/core`, `npm test -w apps/gui`, `npx vitest run apps/desktop/test/`,
`node apps/desktop/e2e/capabilities-packaged.mjs`.

| ID | Executable evidence | Kind |
|---|---|---|
| 001,002,006–013,015–017,020,021,023,024,031,032,036,039,041 | `packages/core/test/capabilities/*` | offline core — pass |
| 003,004,016,022,029,030,037,038,038b | `apps/gui/test/*` | renderer/bridge/a11y — pass |
| 005 | `apps/gui/test/cap-test-005-single-record.test.ts` (single persisted record; reload returns same IDs/revisions; approved revision stable under later draft) | offline — pass |
| 018 | `packages/core/test/capabilities/cap-test-018-impact.test.ts` (branched graph; affected + unaffected modules each carry a reason; freshly calculated impact is a proposal only — no approval/packet before the user approves) | offline core — pass |
| 019 | `packages/core/test/capabilities/cap-test-019-regeneration-order.test.ts` (approved multi-level impact; provider precedes workflow precedes experience; exactly one actionable target, deterministic on repeat; delta scope stays local — unaffected modules never enter the queue) | offline core — pass |
| 025 | `apps/desktop/test/cap-test-025-filesystem.test.ts` (real temp project with source/data/artifact roots + a real escaping symlink: approved ops resolve; absolute/traversal/out-of-root rejected; symlink escape fails `isRealPathWithinProjectRoot` where a string prefix check is fooled; resolved results carry no host absolute path) | offline desktop — pass |
| 026,027,028 | `apps/desktop/test/matlab-adapter.test.ts` (fake-mode: session serialization, cross-project isolation, crash/restart, allowlist reject, snapshot save/restore/corrupt/cross-project) | fake — pass; real-Engine portion **skipped** (`No module named 'matlab'`) — see **Experimental** below |
| 033,034,035 | `apps/desktop/test/azure-adapter.test.ts` (fake-mode + hostile: least-privilege discovery, work-item import → proposed impact / no approved-spec mutation, pipeline/test/artifact reads, 429 typed-retryable, PAT no-leak, GET-only) | fake — pass; real-network portion **skipped** (no `EUIK_AZURE_ORG`/`EUIK_AZURE_PAT`) — see **Experimental** below |
| 040 | `apps/desktop/e2e/capabilities-packaged.mjs` | packaged Electron — verification deferred: exits 1, `packaged-status.json` = `status:"unavailable", launched:false` (Electron cannot open a window here) — see **Experimental** below |

Every offline CAP-TEST ID (001–024, 029–032, 036–039, 041, plus 005/018/019/025) now has a dedicated
executable test that passes. The only IDs without a green *real-environment* run are the three
experimental surfaces below, whose production code is present and whose fake/offline behavior is
fully tested — only the real external execution is deferred.

### Experimental features (code complete; real-environment verification deferred)

These ship as **experimental**. The implementation is present and exercised offline; the checks
below require an environment not available in CI and can be run on a suitably configured machine.

- **Packaged Electron journeys — CAP-TEST-040 / CAP-JRN-001–008.** Run
  `node apps/desktop/e2e/capabilities-packaged.mjs` on a machine with a real display; require exit 0 +
  `status:"passed", launched:true` + 8/8 journeys + restart persistence. The renderer journey-driving
  sequences are unverified end-to-end here and may need selector/return-shape tweaks isolated to the
  two e2e files.
- **Real MATLAB Engine execution — CAP-TEST-026/027/028 real path.** Needs a machine with MATLAB and
  the `matlab.engine` Python package; unset `EUIK_TEST_MODE` to exercise the real adapter.
- **Real Azure DevOps execution — CAP-TEST-033/034/035 real path.** Needs `EUIK_AZURE_ORG` + a
  read-scoped PAT via `EUIK_AZURE_PAT`.
