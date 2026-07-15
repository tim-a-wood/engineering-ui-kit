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
| WP1a | Canonical contract catalogue (CAP-CONTRACT-023..031 types/schemas/fixtures/parity + InboundBinding) | WP0 (`9ac6c7f`) | contract steward (cap-sonnet-implementer) | core `types.ts`/`parity.ts`/`validation.ts`/`binding.ts`, `standards/schemas/capabilities/*`, fixtures, `cap-test-042/043` | — | CAP-TEST-042, 043 + CAP-TEST-001 stays green | **in-progress** |
| WP1b | Workspace schema 2.0 + migration (1.0 reader, future read-only, FrontendBinding→InboundBinding, interview→ModuleImplementationSpecification, rollback) | WP1a | contract steward (cap-sonnet-implementer) | core `persistence.ts`/`migration.ts` + `cap-test-044..047` | — | CAP-TEST-044..047 | todo (after WP1a) |
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

## Change log

- WP0: classified dirty diff, verified baseline (all green), created this ledger. Baseline-commit + Wave-1 launch awaiting user go/no-go.
