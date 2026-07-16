# Capabilities Executable Reference Architecture — Execution Ledger

Tracks the CAP-ERA-001 initiative (`docs/CAPABILITIES-EXECUTABLE-REFERENCE-ARCHITECTURE-CLAUDE-HANDOFF.md`).
Coordinator maintains this file. One row per work packet.

## Operating constraints (session-specific)

- **Budget gating:** The coordinator has **no tool to read the user's token/credit balance.**
  Therefore, before each expensive wave, the coordinator posts a scope/cost estimate and
  **pauses for the user's explicit go/no-go** rather than assessing a balance it cannot see.
  Autonomous *within* a wave; gated *between* waves.
- **Preserve user work.** The uncommitted "richer handoff" work present at WP0 is retained.
- Standard invariant card (handoff §17.10) applies to every agent.

## Baseline

| Field | Value |
|---|---|
| Baseline branch | `main` (pushed to origin) |
| Pre-initiative HEAD | `a805045` |
| WP0 baseline commit (richer-handoff work + scaffolding) | `e80ddce` (on `main`, pushed) |
| Initiative integration branch | `claude/cap-era-integration` (from `e80ddce`) |
| **WP1 contract freeze** | commit `14f9f7f`; 31 schemas; content hash `1cb8df5e084851946121b5a6b1f0032aeededdb69361d0d205abc99dedb2b5c2` |
| Current HEAD (Wave 1 complete) | `14f9f7f` |
| Node / TS | Node 22 LTS, TypeScript 5.8 |
| Test runner | vitest |

## Wave / packet status

Status legend: `todo` · `in-progress` · `blocked` · `integrated` · `gate-green`

| Packet | Title | Depends on | Owner / model | Owned paths | Commit | Tests | Status |
|---|---|---|---|---|---|---|---|
| WP0 | Preserve & baseline | — | coordinator | (read-only + this ledger) | `e80ddce` | core 151/151, gui 157/157, all typecheck clean | **gate-green** |
| WP1a | Canonical contract catalogue (CAP-CONTRACT-023..031 types/schemas/fixtures/parity + InboundBinding + canonicalRecordHash) | WP0 | coordinator-direct (see note) | core `types.ts`/`parity.ts`/`validation.ts`/`hash.ts`/`implementationBrief.ts`, `standards/schemas/capabilities/*`, fixtures, `cap-test-042/043` | `103c229` | core 155/155 + desktop/gui typecheck clean; CAP-TEST-001 covers all 31 | **gate-green** |
| WP1b | Workspace schema 2.0 + migration (1.0 reader, future read-only, FrontendBinding→InboundBinding, interview→ModuleImplementationSpecification, rollback) | WP1a | coordinator-direct | core `persistence.ts`/`migration.ts`/`binding.ts`/`types.ts` + `cap-test-044..047` | `14f9f7f` | core 161/161; desktop/gui typecheck clean | **gate-green** |
| WP2 | Reference profile, repo discovery, deterministic planning | WP1 | cap-sonnet-implementer (delegated ✓) | `packages/core/src/capabilities/generation/` | `def7616` | core 180/180 (19 new); CAP-TEST-048..053; all workspaces typecheck clean | **gate-green** |
| WP3A | TypeScript runtime: core + Node/browser hosts + React + Electron IPC | WP1 | cap-sonnet-implementer (worktrees) | `packages/capabilities-runtime-ts/` | `e12f7da` (merged) | runtime-ts **89/89**, typecheck clean; standalone; node-free `.`/`./browser`/`./react`/preload; real node:http/CLI/cron; Electron pure logic tested (real-Electron E2E → WP8) | **gate-green** (TS runtime complete) |
| WP3B-gen | TS code generators (contracts/composition/inbound/typescript) | WP2, WP3A | cap-sonnet-implementer (symlinked worktree) | `generation/{contracts,composition,inbound,typescript}.ts` | `87cd124` (merged) | pure/deterministic; core 233/233; CAP-TEST-054/055/056 | **gate-green** |
| WP3B-slices-headless | TS headless HTTP+CLI reference app — real E2E | WP3B-gen | cap-sonnet-implementer (symlinked worktree) | `examples/capabilities-ts-reference/` | `dad2e54` (merged) | **7/7 at integrated tree** (real node:http+fetch; real runCli argv→dispatch); run via `cd <pkg> && npx vitest run` | **gate-green** |
| WP3B-slices-re | TS React web + Electron reference slices — real E2E | WP3B-gen, WP3A-react | cap-sonnet-implementer (symlinked worktree) | `examples/capabilities-react-reference/` | `4ebe6e3` (merged) | **8/8 at integrated tree** (React form→useOperation→dispatch→op; Electron renderer→main-handler→dispatch, correlation propagation); real-Electron-process E2E → WP8 | **gate-green** |
| WP4A | Python runtime: core + FastAPI/CLI/worker hosts + adapters | WP1 | cap-sonnet-implementer (worktrees) | `runtimes/python/` | `338ac7f` (merged) | **127 pytest** at integrated tree; outcome→HTTP/CLI mapping frozen for parity; conftest fixes `.pth`/UF_HIDDEN | **gate-green** (Python runtime complete) |
| WP4B-gen | Python code generators (Pydantic/protocols/inbound/OpenAPI) | WP2, WP4A | cap-sonnet-implementer (symlinked worktree) | `generation/python.ts`,`python-emit.ts` | `619cdbb` (merged) | pure/deterministic; core 266/266; CAP-TEST-062/063/064; verified vs real WP4A runtime | **gate-green** |
| WP4B-slices-py | Python runnable HTTP/CLI/schedule slices — real E2E | WP4B-gen | cap-sonnet-implementer (Python worktree) | `examples/capabilities-python-reference/` | `1cc204f` (merged) | **15 pytest at integrated tree** (TestClient→dispatch→op; CronJob.poll under injected clock; real traversal) | **gate-green** |
| WP4B-react-python | React↔Python via generated OpenAPI + cross-lang parity fixtures | WP4B-gen, WP3A-react | cap-sonnet-implementer (hybrid worktree) | `examples/capabilities-react-python-reference/` | `fb503e5` (merged) | **Python 3/3 pytest + TS 7/7 vitest** at integrated tree; CAP-TEST-066 (React/TS → real spawned FastAPI subprocess, real HTTP round-trip, success + domain rejection); CAP-TEST-069 (same canonical fixture bytes accepted/rejected by TS Ajv + live Python; generated OpenAPI agrees with served /openapi.json) — **DoD #4 met** | **gate-green** (needs coordinator `.venv`; see Python env note) |
| WP5A | Foundation planning UI (pure `FoundationPlan`: deployable/allocation proposals + per-module allocation explanations + ambiguity resolve/persist + separate approval + handoff/staleness gate; enriched module brief `deployment`; foundation-review UI in both projections + Build/handoff prerequisite gate + From-spec generated-ref enrichment) | WP1, WP2 | cap-sonnet-implementer (core: symlinked worktree; gui: coord checkout) | core `foundation.ts`(new)/`implementationBrief.ts`/`persistence.ts` + barrels; `apps/gui` `FoundationReview.tsx`(new)/`ArchitectureInterview`/`ModulesView`/`CapabilitiesView`/`GuidedBuild`/`bridge`/`mockBridge`; `apps/desktop` `ipc.ts`/`bridgeApi.ts`/`preload.cts` | `1b394df` (core) + `90725d6` (gui) merged | **core 317/317 + gui 174/174** at integrated tree; CAP-TEST-071 (UI+headless import→deployable proposals), 072 (ambiguity asks-once + persists), 073 (foundation approval SEPARATE from architecture + handoff staleness re-block + brief.deployment), 074 (Build/handoff prerequisite gate, guided+design), 075 (Guided/Design project same records + From-spec generated contract/path/command refs); desktop typecheck clean; **real** desktop foundation IPC wired (no mock-only debt) | **gate-green** (DoD #5 met) |
| WP5B | Foundation runtime integration: real `DeployableSpecification`+`InboundBinding` persistence (schema-2.0-aware, private-default, multi-binding) + 4 desktop IPC handlers | WP3B, WP4B, WP5A | cap-sonnet-implementer | `persistence.ts` + `apps/desktop/src/capabilities/ipc.ts` | `6023f59` (merged; see CONNECT-BACKING resolution) | CAP-TEST-070 connect-backing persistence; `listDeployables` proposes via `proposeDeployables` when empty | **gate-green** (WP5 gate CAP-TEST-070..075 now complete together with WP5A) |
| WP6A | Inbound binding + journey state | WP1 | cap-sonnet-implementer (coordinator checkout) | `journeys.ts`, `capabilitiesUiState.ts` | `a9492d4` | CAP-TEST-076/079/081; core 193/193, gui 162/162; private-default, multi-binding, no-UI-can't-skip | **gate-green** (GUI deployable/binding bridge wiring → WP6B) |
| WP6B | Connect editors (trigger-first, per-host, private-default, multi-binding) | WP2, WP6A | cap-sonnet-implementer (coord checkout, 3 resumes) | `GuidedConnect.tsx` + `inbound/*` editors + bridge/mock | `61a3148` (+preload fix) | gui 165/165; CAP-TEST-076..083; desktop typecheck restored | **gate-green (real IPC/persistence → WP5B, see Open issues)** |
| WP7-apply | §11.3 transactional generation apply + rollback (`applyGenerationPlan`/`rollbackGenerationApply`) | WP2 | cap-sonnet-implementer + Opus review | `capabilities/generationApply.ts` (Node) | `7b70435` (merged) | core 284/284; **13 safety tests** (forced-failure-@-each-phase byte-identical restore; traversal/symlink/stale/modified refusal; rollback idempotent); reviewed | **gate-green** (CAP-TEST-085/086/089/092) |
| WP7-rest (assembly) | Generate→apply assembly (`assembleGenerationPlan`) + impact-scoped regen | WP7-apply, WP3B-gen, WP4B-gen | cap-sonnet-implementer | `capabilities/generationAssembly.ts` (Node) | `12cad75` (merged) | core 291/291; CAP-TEST-087/088; deterministic `planHash`; impact-scoped (1 binding→1 adapter); generate→apply→app-on-disk proven | **gate-green** (deferred → WP7-followups) |
| WP7-followups | React marker/source adoption (§10.4), OpenAPI-artifact wiring, registry-diagnostic equivalence, Python composition-root generator, real DI wiring (`resolved.g.*` is placeholder glue) | WP7-rest | — | generation | — | CAP-TEST-084/090/091 | todo |
| WP8 | Real connection verification runner + `ConnectionVerificationRecord` | WP7 | cap-sonnet-implementer + Opus review | `capabilities/verificationRunner.ts` (Node) | `a17f77a` (merged) | core 297/297 clean exit (no leaks); real HTTP+CLI launch→trigger→CAP-CONTRACT-029 (AJV-valid); simulation≠pass (separate fn, no bypass); test-adapter→partial/outstanding; redaction; process-cleanup pid-death-verified; CAP-TEST-094 | **gate-green** (Electron/Python launch presets + freshness-aggregation → WP8-followups) |
| WP9A | Migration prep: existing-repo planner + 3 fixtures + legacy diagnostic | WP1, WP2 | cap-sonnet-implementer (symlinked worktree) | `generation/existingRepoMigration.ts`, `fixtures/existing-repos/` | `79d2fa3` (merged) | pure planner (additive, node-free); react-ts/python/react-python fixtures; CAP-TEST-102; core 199/199 | **gate-green** (apply=WP9B) |
| WP9B | Adoption finalization: additive existing-repo apply + runtime-upgrade preview | WP7, WP8, WP9A | cap-sonnet-implementer + coordinator completion | `generation/upgradePreview.ts`, legacy compatibility gate + adoption tests | `25dec77` + `7ec2588` | CAP-TEST-103–108; react-ts+python adopted additively (originals byte-identical, rollback restores); react-python boundary preserved; actual legacy `runtime.js` crosses real HTTP before+after apply; compatibility retires only after full conformance; upgrade never silent | **gate-green** |
| WP10 | Platform matrix + docs + Experimental-exit evidence | WP9B | coordinator sign-off | [`capabilities-platform-matrix-and-evidence.md`](capabilities-platform-matrix-and-evidence.md) + `.github/workflows/capabilities-cross-platform.yml` | `0245dfb` workflow + `b55384f`/`44f9997`/`ea24e5b` portability fixes + `7ec2588` final WP9 gate | **full matrix green on macOS, Windows, and Ubuntu Linux** (core 320, runtime-ts 95, gui 174, desktop typecheck, python 130, examples 15+7+8+7/3); real CI [run 29465586532](https://github.com/tim-a-wood/engineering-ui-kit/actions/runs/29465586532); DoD **10/10** | **gate-green; technical Experimental-exit evidence complete** (`Experimental` retained pending separate product decision) |

## WP0 classification of the dirty baseline diff

All 13 modified + 3 untracked source/test files are **one coherent "richer handoff" feature**
(handoff §3). No unrelated user work is intermixed. Preserved:

- `packages/core/src/capabilities/implementationBrief.ts` (new) — `ModuleImplementationBrief`, `buildModuleImplementationBrief`, reference-architecture profiles.
- `packages/core/src/capabilities/repositoryContext.ts` (new) — bounded, symlink-safe live repo discovery.
- `packages/core/test/capabilities/cap-test-implementation-brief.test.ts` (new) — brief + repo-context coverage.
- `moduleInterview.ts` — preserved `operationContracts` + `dataSchemas`; CAP-GATE-003 contract/schema checks.
- `packets.ts` — `buildCapabilityHandoffMarkdown`; implementation/delta packets now demand **source code, not a manifest**.
- `persistence.ts` — persists draft/approved module interview responses alongside manifests.
- `apps/desktop/src/capabilities/ipc.ts`, `bridgeApi.ts`, `apps/gui/src/bridge.ts`, `mockBridge.ts`, `ModulesView.tsx` — thread interview responses + readiness through the bridge; brief-driven handoff prompts.
- `.gitignore` — keeps `.claude/agents/cap-*.md` in version control, ignores the rest of `.claude/`.

WP0 handoff step 3 confirmed: implementation/delta packets no longer instruct the agent to
return a module manifest as the primary deliverable (see `packets.ts` output rules +
`cap-test-core-ops.test.ts` assertions).

## Coordinator execution note (session constraint)

`cap-sonnet-implementer` `maxTurns` is read once at session start; it was 24 and two WP1a
attempts stalled at exactly 24 steps. It is now **committed as `maxTurns: 90`** (`b1137e8`), so
**after an app restart, Sonnet delegation works as the handoff §17 model intends** — the fresh
coordinator should delegate WP1b onward to `cap-sonnet-implementer` (and scouts/verifiers),
integrating and reviewing centrally. WP1a was completed coordinator-direct only because the fix
had not yet loaded. The failed runs' one salvage — the field-name design in `parity.ts` — was kept.

## Python environment (provisioned for WP4A/WP4B)

System Python is 3.9.6 (too old; spec needs 3.11+). Provisioned a user-space standalone build —
NO sudo, fully reversible (delete the dir):
- Interpreter (3.11.15): `/Users/timwood/.local/uikit-python/python/bin/python3.11`
- `curl` reaches github/PyPI/astral fine (system trust store has the corp CA); `pip`/`npm` use their
  OWN cert bundles and fail — so **every pip command MUST pass `--use-feature=truststore`** (verified:
  pydantic 2.13.4 / fastapi 0.139 / uvicorn 0.51 / pytest 9.1 / httpx install cleanly that way).
- Shared sanity venv: `/Users/timwood/.local/uikit-python/venv-cap`. Per-packet venvs live in the
  worktree (gitignored). Node worktrees remain unusable without a full `npm install` (workspace
  symlinks), so node lanes run in the coordinator checkout; Python/isolated lanes run in worktrees.
- **Coordinator-root `.venv` (durable, gitignored via root `.gitignore` `.venv/`)** — provisioned for
  the cross-language react-python E2E and WP10 matrix: `python3.11 -m venv .venv` then
  `.venv/bin/python -m pip install --use-feature=truststore -e runtimes/python fastapi uvicorn httpx pytest`.
  CAP-TEST-066's server-spawn helper resolves the interpreter as
  `CAPABILITIES_PYTHON_INTERPRETER ?? <repoRoot>/.venv/bin/python`, so this venv MUST exist at the repo
  root (or the env var must be set) for the react-python vitest suite to pass from the main checkout.
  NB: a stale Jul-3 system-Python `.venv` had to be `rm -rf`'d and recreated (its `python`→`python3`
  symlink pointed at CommandLineTools 3.9.6); recreate cleanly if it reappears at 3.9.x.

## Parallel-execution model (proven)

- **Standalone / core lanes with NO new npm deps** → git worktree + `ln -s <main>/node_modules <wt>/node_modules`; agent MUST NOT run `npm install` (symlink is shared). Verified for `capabilities-runtime-ts` and `packages/core` lanes. Keeps the coordinator checkout free for integration.
- **Python lanes** → git worktree + per-worktree venv from `~/.local/uikit-python/python/bin/python3.11`, `pip install --use-feature=truststore`. Disjoint from node.
- **Lanes needing NEW npm deps** (example apps under `examples/`, some gui work) → coordinator checkout, ONE at a time (npm workspace resolution + lockfile).
- **`generation/index.ts` is a shared barrel** — run core/`generation` lanes one at a time, or have agents report new exports for the coordinator to wire (avoids merge conflicts).
- Coordinator merges each lane branch with `--no-ff`, verifies at the integrated tree, updates this ledger. `react`/`react-dom`/`@types/react`/`electron` are already in `node_modules` (React/Electron lanes need no install).

## Open issues / required reconciliations

**SCHED-ENUM — ✅ RESOLVED (`c4e8981`)** — runtimes reconciled UP to the contract enums (queue/run-all semantics implemented in TS `node` scheduler + Python `worker`), generators emit contract values 1:1 (no remap). Original issue for reference:
Frozen CAP-CONTRACT-028 schedule enums diverge from what the runtimes implemented —
- contract `OVERLAP_POLICIES=[skip,queue,allow-concurrent]` vs TS runtime `OverlapPolicy=[skip,allow]` (Python worker similar);
- contract `MISFIRE_POLICIES=[run-once,skip,run-all]` vs TS runtime `MisfirePolicy=[skip-missed,run-once]`.
WP3B-gen `inbound.ts` maps contract→runtime lossily (queue/allow-concurrent→allow; run-all→run-once) + emits a diagnostic.
**Resolution: align the RUNTIMES to the canonical contract enums** (implement `queue` serialize + `run-all`
catch-up in the TS `node` scheduler AND the Python `worker`; use the contract's names), then drop inbound.ts's
lossy mapping. Cross-language (parity) — a focused reconciliation packet. Do NOT change the frozen contract enums.

**CONNECT-BACKING — ✅ RESOLVED by WP5B (`6023f59`)** — real `DeployableSpecification`+`InboundBinding` persistence in `CapabilityWorkspace` (schema-2.0-aware, private-default, multi-binding) + the 4 desktop IPC handlers (`listDeployables` proposes via `proposeDeployables` when empty). Residual: no shared *core* `InboundBinding` validator yet (desktop approve gate is a minimal inline check; gui has a per-kind presentation validator) — add one if WP7/WP8 needs stricter server-side gating. Original issue for reference:
WP6B added 4 bridge methods (`capabilitiesListDeployables`/`ListInboundBindings`/`SaveInboundBindingDraft`/`ApproveInboundBinding`) wired through `bridge.ts`+`bridgeApi.ts`+`preload.cts` (parity restored) but backed only by `mockBridge.ts`. WP5B/WP7 must add: (a) real `DeployableSpecification` (CAP-CONTRACT-024) + `InboundBinding` (CAP-CONTRACT-028) persistence in `CapabilityWorkspace` (`persistence.ts`, mirror `listModules`/`saveBindingDraft`/`approveBinding`); (b) the 4 `ipcMain.handle(...)` handlers in `apps/desktop/src/capabilities/ipc.ts`; (c) replace the mock's deployable-synthesis heuristic with the real Design-stage `proposeDeployables` (`generation/deployables.ts`). Until then the desktop Connect path is declared-but-unhandled (gui mock tests pass; real desktop run would 404 those channels).

**RUNTIME-DIST — distribution hardening before shipping generated TS apps:**
`@engineering-ui-kit/capabilities-runtime` package.json `exports` point only at `./dist/*.js` (gitignored, unbuilt), so downstream TS consumers can't resolve it via `node_modules` without building it. The TS example (`capabilities-ts-reference`) works around it with tsconfig `paths` + a vitest `resolve.alias` to the runtime `src/`. Fix before real generated apps: build the runtime (`npm run build --workspace=@engineering-ui-kit/capabilities-runtime`) into consumer resolution OR add a `"development"`/`"source"` export condition pointing at `src`. Also: TS example packages must be run via `cd <pkg> && npx vitest run` (Vitest loads a nested config only from its own cwd) — document for WP10's matrix.

**REDACTION-JSON — hardening candidate (WP8 found it):** the frozen `redaction.ts` `redactSensitiveText` only matches unquoted `key: value`/`key=value` + `Bearer …`; it does NOT mask JSON-quoted secret-looking keys (`"apiKey":"…"`). WP8's `verificationRunner.ts` added a local `redactSensitiveKeys` deep-walk as defense-in-depth. Consider hardening `redactSensitiveText` itself (small; affects existing cap-test-047 — verify) so all secret sinks (evidence/logs/diagnostics) are covered uniformly.

## RESUME HERE — current state

**The executable core of CAP-ERA-001 is COMPLETE, integrated, and E2E-proven** on
`claude/cap-era-integration` (pushed). Contract surface FROZEN at `14f9f7f` (hash `1cb8df5e…`) — do NOT
change parity.ts `CONTRACT_REQUIRED_FIELDS`, types.ts contract types, or schemas; §17.6 change-request
protocol for any defect.

**Done + integrated (all gate-green):** WP0, WP1a/b (contracts + schema 2.0 + migration), WP2 (generation/
planning), WP3A (TS runtime: core + Node/browser + React + Electron), WP4A (Python runtime: core + FastAPI/
CLI/worker), WP3B-gen + WP4B-gen (both code generators), WP3B-slices + WP4B-slices-py (runnable TS + Python
examples, real E2E), **WP4B-react-python** (`fb503e5`, React↔Python over generated OpenAPI, CAP-TEST-066/069,
DoD #4), WP5B (real Deployable/InboundBinding persistence + desktop IPC), **WP5A** (`1b394df`+`90725d6`,
foundation planning: `FoundationPlan` proposer + allocation explanations + ambiguity resolve/persist +
separate approval + handoff/staleness gate + brief `deployment` enrichment + foundation-review UI +
Build prerequisite gate + From-spec generated-refs, CAP-TEST-071..075, **DoD #5**), WP6A/WP6B (journey model +
trigger-first Connect editors), WP7-apply + WP7-rest (transactional generate→apply→rollback), WP8 (real
connection verification), WP9A + **WP9B** (`25dec77`+`7ec2588`, additive existing-repo adoption +
legacy-runtime continuity/retirement gate + runtime-upgrade preview, CAP-TEST-103–108, DoD #2/#8),
SCHED-ENUM reconciled (`c4e8981`). See the status table.
**The last feature lane (WP5A) and the cross-platform evidence gate are done — all 10 DoD requirements are met.**

**WP10 matrix — green on the complete supported platform set** (see
[`capabilities-platform-matrix-and-evidence.md`](capabilities-platform-matrix-and-evidence.md)): core **320**,
runtime-ts 95, gui **174**, desktop typecheck, python 130, examples 15 + 7 + 8 + (7 TS / 3 py). DoD scorecard:
**10/10 fully met**. The same suite passed on macOS and in real Windows+Ubuntu GitHub jobs
([run 29465586532](https://github.com/tim-a-wood/engineering-ui-kit/actions/runs/29465586532)); the react↔python
TS suite re-spawned a real FastAPI subprocess on both CI platforms. **Capabilities remains `Experimental` only
because badge removal is the separate product decision required by WP10.6, not because evidence is missing.**

**Remaining (all tracked; none are DoD blockers):**
- **WP7-followups / WP8-followups / RUNTIME-DIST / REDACTION-JSON** — see "Open issues".
- **WP5A followup (non-blocking):** `brief.deployment.generatedContractRefs`/`generatedTypeTargets` are wired
  and tested but render empty in live UI until a `ModuleImplementationSpecification` exists (WP7 generation
  scope populates them); the surfacing mechanism is complete.

To provision Python locally: repo-root `.venv` (git-ignored) — see the "Python environment" note above and
§1 of the platform-matrix doc. The initiative is complete; any resumed work should select an explicitly
approved non-blocking follow-up from "Open issues" rather than reopening a green gate.

The WP1b notes below are RETAINED FOR REFERENCE ONLY (already implemented in `14f9f7f`).

**WP1b goal:** workspace schema 2.0 + migration. Gate: CAP-TEST-044 (FrontendBinding→InboundBinding
lossless), 045 (migration idempotent + reversible), 046 (future version read-only), 047 (secret
canary never survives redaction).

**Existing machinery (already read):**
- `persistence.ts`: `SchemaMeta {schemaVersion, initializedAt}` at `meta/schema-version.json`;
  `ensureInitialized` writes `'1.0'`; `isFutureSchemaVersion` (~L80) returns `meta.schemaVersion !== '1.0'`.
  Bindings stored as `FrontendBinding` (`saveBindingDraft`/`approveBinding`/`getApprovedBinding`/`listBindings`, ~L313-370).
- `migration.ts`: minimal `migrateCapabilityWorkspace` stub only.
- `redaction.ts`: `redactSensitiveText(text)`, `assertNoCanaryLeak(payload, canaries)`.
- `binding.ts` is browser-safe/pure (in `browser.ts`); `migration.ts` is Node-only (fs), index-only.
  Barrels already re-export these modules — no `index.ts`/`browser.ts` edits needed.

**Design (worked out; hand to the implementer):**
1. **Lossless FrontendBinding→InboundBinding:** `FrontendBinding` has `loadingBehavior` + `dataMode`
   that `UiInboundBinding` lacks. Add OPTIONAL `loadingBehavior?: string` and `dataMode?: BindingDataMode`
   to `UiInboundBinding` (types.ts) and to `inbound-binding.schema.json` as optional properties
   (`dataMode` enum = `BINDING_DATA_MODES`). Implement pure pair in `binding.ts`:
   `frontendBindingToInboundBinding(fb, { deployableId })` and `inboundBindingToFrontendBinding(ui)`.
   New required InboundBinding fields absent from FrontendBinding get migration defaults
   (`kind:'ui'`, `transport:'browser-local'`, `exposure:'private'`, `generatedTargets:[]`,
   `approvalState:'migrated'`, `timeoutBehavior`/`retryBehavior:'unspecified (migrated)'`).
   CAP-TEST-044: `inboundBindingToFrontendBinding(frontendBindingToInboundBinding(fb))` deep-equals `fb`.
2. **Schema 2.0:** add `CURRENT_WORKSPACE_SCHEMA_VERSION='2.0'` and
   `SUPPORTED_WORKSPACE_SCHEMA_VERSIONS=['1.0','2.0']` in persistence.ts; change `isFutureSchemaVersion`
   to `!SUPPORTED.includes(version)`. Keep init at `'1.0'` (migration bumps). CAP-TEST-046: set
   `'3.0'` → writes throw; `persistence.test.ts` has no version assertions to break.
3. **Migration in migration.ts:** `planCapabilityMigration(ws, projectId): CapabilityMigrationPlan`
   (CAP-CONTRACT-030 preview record). `applyCapabilityMigration` — snapshot `capabilities/` except
   `meta/backups` via `fs.cpSync({recursive, filter})`, convert stored bindings additively, bump
   `schema-version.json`→2.0, write rollback journal; **idempotent** (no-op if already 2.0).
   `rollbackCapabilityMigration(backupId)` — clear live except `meta/backups`, restore snapshot.
   CAP-TEST-045: apply→idempotent re-apply; rollback restores 1.0 + original FrontendBinding.
4. `promoteInterviewToModuleImplementationSpecification(manifest, interview, { deployableId, runtimeLanguage })`
   pure best-effort → `ModuleImplementationSpecification`, gaps recorded in `unresolvedItems` (materiality).
5. CAP-TEST-047: `redactSensitiveText` strips a secret canary from a record text field; `assertNoCanaryLeak` confirms none survive.

**Files:** `types.ts` (+2 optional ui fields), `inbound-binding.schema.json` (+2 optional props),
`binding.ts` (conversion pair), `persistence.ts` (constants + isFutureSchemaVersion), `migration.ts`
(plan/apply/rollback/promote), `cap-test-044..047`. Acceptance: core typecheck + `npm run test --workspace=@engineering-ui-kit/core` green.

**After WP1b:** WP1 gate complete → record contract-freeze hash → release Wave 2 (WP2, WP3A, WP4A, WP6A) per handoff §17.5.

## Change log

- WP0: classified dirty diff, verified baseline (all green), created this ledger. Committed `e80ddce` (main), branched `claude/cap-era-integration`.
- WP1a: nine canonical contracts frozen; `103c229`; core 155/155, all workspaces typecheck clean.
- WP1b: workspace schema 2.0 + lossless migration/rollback; `14f9f7f`; core 161/161, all workspaces typecheck clean.
- **Wave 1 COMPLETE** (WP0+WP1a+WP1b). WP1 gate green; contract freeze recorded. Wave 2 ready to release (needs session restart for parallel Sonnet delegation).
- Restart confirmed: delegation restored (agents run 90–99 steps). Provisioned user-space Python 3.11.15 (+ `pip --use-feature=truststore`) so Python lanes verify locally.
- WP2 integrated `def7616` (180/180). WP3A-core integrated `34f1b6c` (runtime-ts 29/29, standalone). WP4A merged `ee1fe1f` (34 pytest). WP6A integrated `a9492d4` (core 193/193, gui 162/162).
- **Wave 2 core packets COMPLETE** (WP2/WP3A-core/WP4A/WP6A). WP3A-hosts-node (Node/browser adapters) in a symlinked worktree; then release Wave 3 (WP3B/WP4B/WP5A/WP6B) + WP9A.
- WP3A-hosts merged `4528258` (runtime-ts 63/63) — **TS runtime complete** (React/Electron adapters deferred, need deps). WP4A-hosts (Python FastAPI/CLI/worker) running in `cap-era-wt-wp4ah`.
- Proven parallelism model: symlinked-node_modules worktree works for no-new-deps standalone/core lanes (keeps coordinator checkout free for integration); Python lanes use their own worktree+venv; lanes needing new npm deps (example apps, gui) use the coordinator checkout one at a time.
- WP4A-hosts merged `338ac7f` — **Python runtime complete** (127 pytest: core+http+cli+worker+adapters). WP9A merged `79d2fa3` — existing-repo migration prep (CAP-TEST-102, core 199/199). Cleaned up 4 merged worktrees/branches.
- **BOTH RUNTIMES COMPLETE.** integration HEAD `79d2fa3`. Remaining: WP3A React/Electron adapters; WP3B/WP4B (generators + slices); WP5 (Design/Build foundation UI + bridge); WP6B (Connect editors); WP7 (real generation + transactional apply); WP8 (real evidence/verify); WP9B (adoption finalization); WP10 (matrix + docs). react 19 / electron 43 / @types/react present in node_modules (React/Electron lanes need no new install).
- **WP5A COMPLETE (the last feature lane)** — split into two delegated packets, both `cap-sonnet-implementer`, coordinator-reviewed + integrated `--no-ff`:
  - **WP5A-core** (`1b394df`) in a symlinked worktree (core-only, relative-import tests): new pure `foundation.ts` (`FoundationPlan` + `proposeFoundation` reusing `proposeDeployables`; per-module allocation explanations; ambiguity resolve-by-re-proposal that asks once + persists; `foundationHandoffGate` staleness re-block), additive `CapabilityWorkspace` foundation persistence (`saveFoundationDraft`/`getFoundationDraft`/`approveFoundation`[rejects non-ready + approves constituent deployables, SEPARATE from `approveArchitecture`]/`getApprovedFoundation`), `ModuleImplementationBrief.deployment` enrichment. CAP-TEST-071/072/073; **core 308→317**; frozen surface untouched (`types.ts` never edited — all new types live in `foundation.ts`).
  - **WP5A-gui** (`90725d6`) in the coordinator checkout: `FoundationReview.tsx` rendered from `ArchitectureInterview` in BOTH projections; Build/handoff **prerequisite gate** in `ModulesView` (guided + design) via `foundationHandoffGate`; From-spec spec enriched with generated contract/path/command refs at `buildUiModuleTaskFields` (single source of truth); 4 new `EuikBridge` foundation methods with **real** desktop IPC wiring (`ipc.ts`/`bridgeApi.ts`/`preload.cts`, reusing `listDeployables`' discovery) — no mock-only debt. CAP-TEST-074/075; **gui 165→174**; desktop typecheck clean.
  - **WP5 gate CAP-TEST-070..075 now complete** (070 = WP5B connect-backing pulled forward; 071–075 = WP5A). Numbering note: 070 was consumed by WP5B, so WP5A realized its planning bullets as 071–075.
- **Full platform matrix re-run green post-WP5A** at integrated HEAD `90725d6`: core **317**, runtime-ts 95, gui **174**, desktop typecheck clean, python 130, examples 15 + 7 + 8 + (7 TS / 3 py). **DoD 8/10 → 9/10** (#5 met; only #9 cross-platform CI remains). Capabilities still `Experimental` pending Windows/Linux CI. Not pushed (awaiting explicit request).
- **WP10 cross-platform gate COMPLETE:** workflow `0245dfb`; clean-install lock repair `b55384f`; Windows portability fixes `44f9997`; browser provisioning `ea24e5b`. Real Windows+Ubuntu matrix [run 29465178533](https://github.com/tim-a-wood/engineering-ui-kit/actions/runs/29465178533) passed every §1 suite. **DoD 9/10 → 10/10**; technical Experimental-exit evidence complete. Badge retained pending the separate WP10.6 product decision.
- **WP9 legacy execution gate COMPLETE** (`7ec2588`): CAP-TEST-106 invokes the actual mixed-app `runtime.js` over real HTTP before and after additive generate/apply and proves byte-identical preservation; CAP-TEST-107 proves only material evidence conflicts ask questions; CAP-TEST-108 prevents compatibility retirement until generated contracts, composition registration, and real-connection verification all pass.
- **WP10 final matrix re-run green:** [run 29465586532](https://github.com/tim-a-wood/engineering-ui-kit/actions/runs/29465586532) passed every §1 suite, including CAP-TEST-106–108, on Windows+Ubuntu at `7ec2588` (core 320). This supersedes the prior pre-legacy-gate run above.
