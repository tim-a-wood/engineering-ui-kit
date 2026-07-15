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
| Node / TS | Node 22 LTS, TypeScript 5.8 |
| Test runner | vitest |

## Wave / packet status

Status legend: `todo` · `in-progress` · `blocked` · `integrated` · `gate-green`

| Packet | Title | Depends on | Owner / model | Owned paths | Commit | Tests | Status |
|---|---|---|---|---|---|---|---|
| WP0 | Preserve & baseline | — | coordinator | (read-only + this ledger) | `e80ddce` | core 151/151, gui 157/157, all typecheck clean | **gate-green** |
| WP1a | Canonical contract catalogue (CAP-CONTRACT-023..031 types/schemas/fixtures/parity + InboundBinding + canonicalRecordHash) | WP0 | coordinator-direct (see note) | core `types.ts`/`parity.ts`/`validation.ts`/`hash.ts`/`implementationBrief.ts`, `standards/schemas/capabilities/*`, fixtures, `cap-test-042/043` | `103c229` | core 155/155 + desktop/gui typecheck clean; CAP-TEST-001 covers all 31 | **gate-green** |
| WP1b | Workspace schema 2.0 + migration (1.0 reader, future read-only, FrontendBinding→InboundBinding, interview→ModuleImplementationSpecification, rollback) | WP1a (`103c229`) | cap-sonnet-implementer (delegate post-restart) | core `persistence.ts`/`migration.ts`/`binding.ts`/`types.ts` + `cap-test-044..047` | — | CAP-TEST-044..047 | **NEXT — see Resume section** |
| WP2 | Reference profile, repo discovery, deterministic planning | WP1 | generator (Sonnet) | `packages/core/src/capabilities/generation/` | — | CAP-TEST-048..053 | todo |
| WP3A | TypeScript runtime core | WP1 | TS runtime (Sonnet) | `packages/capabilities-runtime-ts/` | — | — | todo |
| WP3B | TS generators + executable slices | WP2, WP3A | TS runtime (Sonnet) | TS generators + examples | — | CAP-TEST-054..061 | todo |
| WP4A | Python runtime core | WP1 | Py runtime (Sonnet) | `runtimes/python/` | — | — | todo |
| WP4B | Python generators + executable slices | WP2, WP4A | Py runtime (Sonnet) | Py generators + examples | — | CAP-TEST-062..069 | todo |
| WP5A | Foundation planning UI | WP1, WP2 | foundation workbench (Sonnet) | Design/Build UI | — | CAP-TEST-070..075 | todo |
| WP5B | Foundation runtime integration | WP3B, WP4B, WP5A | foundation workbench (Sonnet) | bridge/IPC | — | (part of WP5 gate) | todo |
| WP6A | Inbound binding + journey state | WP1 | connect (Sonnet) | journey/state | — | CAP-TEST-076..083 | todo |
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

## RESUME HERE — next session (WP1b)

Fresh coordinator: `git checkout claude/cap-era-integration`, confirm HEAD is the WP1b-notes
commit, then delegate WP1b to `cap-sonnet-implementer` (now 90 steps) with a packet built from
these notes. **Do not re-derive; do not change the frozen WP1a contract surface** (parity.ts
`CONTRACT_REQUIRED_FIELDS` + types.ts) — other lanes depend on it. Contract freeze = `103c229`.

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
