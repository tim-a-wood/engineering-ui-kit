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
| WP3A | TypeScript runtime core (`.`+`./testing`) | WP1 | cap-sonnet-implementer (coordinator checkout) | `packages/capabilities-runtime-ts/` | `34f1b6c` | runtime-ts 29/29 typecheck clean; core still 180/180; standalone (no core/desktop/gui imports); node-free core | **gate-green (core; hosts=WP3A-hosts next)** |
| WP3B | TS generators + executable slices | WP2, WP3A | TS runtime (Sonnet) | TS generators + examples | — | CAP-TEST-054..061 | todo |
| WP4A | Python runtime core (`core`+`telemetry`+`testing`) | WP1 | cap-sonnet-implementer (worktree) | `runtimes/python/` | `ee1fe1f` (merged) | 34 pytest at integrated tree; Outcome/Operation/Context frozen for parity; conftest fixes `.pth`/UF_HIDDEN | **gate-green (core; hosts=WP4B)** |
| WP4B | Python generators + executable slices | WP2, WP4A | Py runtime (Sonnet) | Py generators + examples | — | CAP-TEST-062..069 | todo |
| WP5A | Foundation planning UI | WP1, WP2 | foundation workbench (Sonnet) | Design/Build UI | — | CAP-TEST-070..075 | todo |
| WP5B | Foundation runtime integration | WP3B, WP4B, WP5A | foundation workbench (Sonnet) | bridge/IPC | — | (part of WP5 gate) | todo |
| WP6A | Inbound binding + journey state | WP1 | cap-sonnet-implementer (coordinator checkout) | `journeys.ts`, `capabilitiesUiState.ts` | `a9492d4` | CAP-TEST-076/079/081; core 193/193, gui 162/162; private-default, multi-binding, no-UI-can't-skip | **gate-green** (GUI deployable/binding bridge wiring → WP6B) |
| WP6B | Connect editors | WP2, WP6A | connect (Sonnet) | Connect UI/editors | — | (part of WP6 gate) | todo |
| WP7 | Real generation + transactional apply | WP3B, WP4B, WP5B, WP6B | integration/apply (Sonnet + Opus review) | inbound generators, overlay | — | CAP-TEST-084..093 | todo |
| WP8 | Real connection evidence + verification | WP7 | evidence/verification (Sonnet) | launchers, evidence, freshness | — | CAP-TEST-094..101 | todo |
| WP9A | Migration preparation | WP1, WP2 | migration/adoption (Sonnet) | migration, fixtures | — | (part of WP9 gate) | todo |
| WP9B | Adoption finalization | WP7, WP8, WP9A | migration/adoption (Sonnet + Opus review) | conformance | — | CAP-TEST-102..108 | todo |
| WP10 | Platform matrix + docs + Experimental-exit evidence | WP9B | matrix/docs (Sonnet) + coordinator sign-off | docs, CI, evidence index | — | full matrix (§18) | todo |

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

## Parallel-execution note

Env ceiling: 1 node-lane agent in the coordinator checkout at a time (npm workspace resolution) +
N isolated (Python) agents in worktrees. Currently: WP3A (coordinator) ‖ WP4A (worktree). WP6A and
WP9A are node lanes → queued behind WP3A in the coordinator checkout.

## RESUME HERE — next session (Wave 2)

**Wave 1 is COMPLETE** (WP0, WP1a, WP1b) at HEAD `14f9f7f` on `claude/cap-era-integration`.
The contract surface is FROZEN at `14f9f7f` (content hash `1cb8df5e…b2b5c2`) — do NOT change
parity.ts `CONTRACT_REQUIRED_FIELDS`, types.ts contract types, or the schemas; every downstream
lane depends on them. If a defect is found, follow the §17.6 change-request protocol, don't patch ad hoc.

Fresh coordinator: `git checkout claude/cap-era-integration`, confirm HEAD `14f9f7f`, then release
**Wave 2** per handoff §17.5 — up to 4 concurrent `cap-sonnet-implementer` agents (now 90 steps each):
- **WP2** deterministic planning + repo discovery → `packages/core/src/capabilities/generation/` (gate CAP-TEST-048..053)
- **WP3A** TypeScript runtime core → `packages/capabilities-runtime-ts/`
- **WP4A** Python runtime core → `runtimes/python/` (consumes the same frozen fixtures as WP3A; behavior must match)
- **WP6A** inbound binding + journey state (uses the frozen InboundBinding)

After WP2 integrates, release WP9A. Integrate narrow commits centrally; run affected tests per §17.9;
run the full gate at wave end. Size each packet to fit one agent context and commit at checkpoints.

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
