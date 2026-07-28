Review the use-case-led Capabilities implementation in `tim-a-wood/engineering-ui-kit`.

**Context.** Commit `c92f292` on `main` (also on `claude/use-case-led-capabilities-i3bcxf`) claims to fully implement `docs/use-case-led-workflow/SPECIFICATION.md` (normative baseline `29bbac7` — the commit immediately before the implementation; diff scope is `29bbac7..c92f292`, 142 files, ~40.8k insertions). `PROPOSAL.md` is rationale, `mockup.html` is interaction reference only. The implementation ledger is `docs/use-case-led-workflow/IMPLEMENTATION-STATUS.md` — treat its claims as assertions to audit, not facts.

**Where things live.**

- Core records/rules/operations: `packages/core/src/capabilities/design/` (records.ts, moduleDesign.ts, operations.ts, contextPacket.ts, deltaInspector.ts, impactEngine.ts, diagramSemantics.ts, diagramLayout.ts, designWorkspace.ts, designMigration.ts, providers.ts, sampleAuditHub.ts)
- Adapters: `apps/desktop/src/capabilities/designIpc.ts` + `designBridge.ts`, `packages/core/src/designCli.ts`, `designMachineApi.ts`
- GUI: `apps/gui/src/views/design/`
- Tests/evidence: `packages/core/test/capabilities/design/` (incl. `product-scenarios.test.ts` + `__evidence__/`), `apps/gui/test/design-*.test.tsx`, `apps/desktop/e2e/design-workflow.mjs`, `apps/gui/validation-evidence/design-workflow/`

**Reproduce the validation** (Linux container; `npm install` first; Python venv needs `uvicorn fastapi`):

    npm run build
    ELECTRON_DISABLE_SANDBOX=1 EUIK_TEST_MODE=1 xvfb-run -a npm test
    EUIK_TEST_MODE=1 npx vitest run apps/desktop/test
    node apps/desktop/e2e/design-workflow.mjs
    node scripts/design-workflow-evidence.mjs

Expected: core 809/809, GUI 273/273, runtime 96/96, desktop 78+1 skip, e2e 11/11, 17 screenshots, 0 axe violations.

**Audit priorities — verify by reading code and writing adversarial tests, not by trusting test names:**

1. **Approval integrity.** No code path lets an agent actor approve anything (core, IPC dispatch, CLI, machine API); no operation sets `approved` outside explicit approval; approved revisions are immutable on disk; approving one module cannot mutate another.
2. **Safety controls not weakened for tests.** Check the delta pipeline end-to-end: stale base/hash rejection, path traversal and symlink escape rejection, out-of-scope path rejection, workspace-change-requires-reinspection, all-or-nothing apply with rollback, evidence preservation of rejected deltas. Try to construct a delta that bypasses one of these.
3. **Spec fidelity spot-checks.** §10.3 invalidation matrix exact behavior (label-only never staling implementations; unrelated modules untouched); §11.4 context priority (canonical record never omitted before lower-priority items); §3.3 multi-module rules; §22.2 sample catalog exactness (17 modules, provides/requires tables, five defects); §14.4 Verify contains Design links and zero diagrams.
4. **Recorded deviations (ledger DEV-01..05)** — judge whether each is genuinely forced by the spec or a shortcut: derived contract registry (DEV-01), audit-event-only cross-restart idempotent replay (DEV-02), not-configured executors for connect/scenario execution (DEV-05).
5. **Ledger honesty.** Sample 3–5 "verified" rows at random and confirm the cited evidence actually proves the claim; flag any row where a type or placeholder exists but behavior doesn't.
6. **Hygiene.** Confirm the diff touches nothing outside the implementation scope and that legacy Capabilities tests/behavior are unregressed.

**Report:** findings ranked by severity (broken control > spec violation > unproven claim > style), each with file:line, a concrete failure scenario, and whether you confirmed it by running code. Do not fix anything; do not push. End with a verdict: merge-worthy as-is, or list of required changes.
