# Use-case-led Capabilities workflow — implementation status

| Field | Value |
| --- | --- |
| Specification baseline | `docs/use-case-led-workflow/SPECIFICATION.md` at commit `29bbac7` |
| Branch | `claude/use-case-led-capabilities-i3bcxf` → `main` |
| Legend | `existing` = met before this work · `partial` = some behavior existed · `missing` = no prior behavior · `implemented` = built in this effort · `verified` = implemented and covered by passing automated evidence · `deviation` = recorded approved deviation |

This document is the live ledger for the implementation. Every specification
section, EUC internal module, and CAP requirement group is tracked here. A row
is not `implemented` merely because a type or placeholder exists; it must have
working behavior. A row is `verified` only when automated evidence passes.

## 1. Discovery summary (baseline audit)

- `packages/core` implements the earlier Capabilities MVP model
  (CAP-CONTRACT-001..031, interviews, generation, overlay apply). None of the
  six new canonical records existed at baseline: `UseCaseAnalysis`,
  `ModuleDesignSpecification`, `ModuleDesignSession`, `DesignBaseline`,
  `DesignWorkflowPolicy`, `ContextManifest`.
- Reusable machinery: `canonicalHash` (isomorphic SHA-256), diagnostics,
  gate-evaluation pattern, dependency graph and cycle detection, impact
  traversal, packet path-policy conventions, atomic JSON persistence
  (`CapabilityWorkspace`), workspace migration pattern, redaction.
- `apps/desktop` exposes ~70 IPC channels for the legacy model with typed
  preload/bridge parity into `apps/gui`; overlay inspect/apply enforces
  allowed/protected paths and re-inspects hashes before apply.
- `apps/gui` has Plan/Design/Build/Connect/Verify surfaces for the legacy
  model; no UML renderer, no system canvas graphics, no module-design queue or
  six-step session, no DO-178C default sample, no Evidence Explorer.
- `examples/do178-audit-hub` is a 9-module standalone sample (adapters
  collapsed into one module); the spec requires a 17-module catalog wired as
  the default no-project experience.
- Baseline test health: all suites pass when workspaces are built, the
  Electron binary is installed, and Electron runs with
  `ELECTRON_DISABLE_SANDBOX=1` under `xvfb-run` (container requirement).

## 2. Internal implementation modules (EUC)

| ID | Module | Baseline | Status | Owned implementation | Evidence |
| --- | --- | --- | --- | --- | --- |
| EUC-01 | Use-case analysis core | partial (`ApplicationSpecification` + product gate only) | verified | `packages/core/src/capabilities/design/useCaseAnalysis.ts` | `euc01-use-case-analysis.test.ts` (11 tests) |
| EUC-02 | Application compiler | missing | verified | `packages/core/src/capabilities/design/applicationCompiler.ts` | `euc02-application-compiler.test.ts` (11 tests) |
| EUC-03 | System-design core | partial (`architectureInterview.ts`) | verified | `packages/core/src/capabilities/design/systemDesign.ts` | `euc03-system-design.test.ts` (20 tests) |
| EUC-04 | Module-design core | partial (`moduleInterview.ts`) | verified | `packages/core/src/capabilities/design/moduleDesign.ts`, `moduleDesignSession.ts`, `moduleDesignCompilers.ts` | `euc04-*.test.ts` (75 tests) |
| EUC-05 | Contract registry | partial (`registry.ts`) | verified | `packages/core/src/capabilities/design/contractRegistry.ts` | `euc05-contract-registry.test.ts` (14 tests) |
| EUC-06 | Design baseline | missing | verified | `packages/core/src/capabilities/design/designBaseline.ts` | `euc06-design-baseline.test.ts` (11 tests) |
| EUC-07 | Impact engine | partial (`impact.ts`) | verified | `packages/core/src/capabilities/design/impactEngine.ts` | `euc07-impact-engine.test.ts` (10 tests) |
| EUC-08 | Diagram semantics | missing | verified | `packages/core/src/capabilities/design/diagramSemantics.ts` | `euc08-diagram-semantics.test.ts` (21 tests) |
| EUC-09 | Diagram layout adapter | missing | verified | `packages/core/src/capabilities/design/diagramLayout.ts` | `euc09-diagram-layout.test.ts` (27 tests) |
| EUC-10 | Context and packet compiler | partial (`packets.ts`) | verified | `packages/core/src/capabilities/design/contextPacket.ts` | `euc10-context-packet.test.ts` (20 tests) |
| EUC-11 | Delta inspector and apply planner | partial (overlay inspect/apply) | verified | `packages/core/src/capabilities/design/deltaInspector.ts` | `euc11-delta-inspector.test.ts` (30 tests) |
| EUC-12 | Verification planner | partial (`verification.ts`) | verified | `packages/core/src/capabilities/design/verificationPlanner.ts` | `euc12-verification-planner.test.ts` (19 tests) |
| EUC-13 | Persistence and migration adapter | partial (`persistence.ts`, `migration.ts`) | verified | `packages/core/src/capabilities/design/designWorkspace.ts`, `designMigration.ts` | `euc13-*.test.ts` (26 tests) |
| EUC-14 | Provider adapters | partial (file-drop packets only) | verified | `packages/core/src/capabilities/design/providers.ts` | `euc14-providers.test.ts` (20 tests) |
| EUC-15 | Repository and process adapters | partial (overlay apply, command runner) | verified | `packages/core/src/capabilities/design/repositoryAdapter.ts` | `euc15-repository-adapter.test.ts` (23 tests) |
| EUC-16 | Desktop and machine API adapters | partial (legacy IPC only) | verified | `packages/core/src/capabilities/design/operations.ts`, `apps/desktop/src/capabilities/designIpc.ts`, `packages/core/src/designCli.ts`, `packages/core/src/designMachineApi.ts` | `euc16-operations.test.ts` (22), `euc16-adapters.test.ts` (15), `design-ipc.test.ts` (7), `integration-executors.test.ts` (6), `apps/desktop/e2e/design-workflow.mjs` (11 steps, real Electron) |
| EUC-17 | React workspaces | partial (legacy views) | verified | `apps/gui/src/views/design/*` | `design-*.test.tsx` (51+ tests), browser evidence run under `apps/gui/validation-evidence/design-workflow/` |

## 3. Specification sections

| Section | Requirement group | Status | Notes / evidence |
| --- | --- | --- | --- |
| §3.1 | Two levels of Design | missing | verified — system structure (`systemDesign.ts`) and per-module design (`moduleDesign.ts`) are separate records with separate approvals; GUI shows both levels |
| §3.2 | Separate approvals | partial | verified — analysis, structure, per-module design, baseline, delta, and verification approvals are distinct records (`DesignApproval`), each tied to revision + hash |
| §3.3 | One module per external handoff; multi-module rules | missing | verified — `buildModuleDesignPacket`/`buildModuleImplementationPacket` are one-module; `buildMultiModulePacket` enforces the six §3.3 rules (euc10 tests, S22/S23) |
| §3.4 | Canonical record precedence and conflict blocking | missing | verified — projections regenerate from canonical records; `conflict` state blocks next actions (`markConflict`, valid-next-action gating) |
| §3.5 | Build gate mode | missing | verified — `DesignWorkflowPolicy` defaults `completeBaseline`; `incrementalModules` needs an approved decision (`changeGateMode`); mode shown beside handoff actions in Build view |
| §4 | Users and authority; agent cannot approve | partial | verified — `isAgentActor` rejection on every approval path (core, IPC, CLI, machine API, Electron e2e); audit events record agent source and importing user |
| §5.1 | Canonical record set | missing | verified — all records in `design/records.ts`, persisted by `designWorkspace.ts` |
| §5.2–5.3 | Common state model and state rules | missing | verified — `DESIGN_RECORD_STATES` + `IMPLEMENTATION_WORK_STATES`; immutable approved revisions; stale keeps approval history and blocks new handoffs; idempotent retry returns first result |
| §6 | End-to-end workflow | missing | verified — full flow exercised by `euc16-operations.test.ts` and product scenarios S01–S15 |
| §7 | Plan requirements (CAP-PLAN-001..016) | partial | verified — `useCaseAnalysis.ts` (euc01 tests: item statuses, counts, material questions, source-failure rules, gate blocks) |
| §8.1 | Architecture draft rules (CAP-DES-SYS-001..008) | partial | verified — `proposeSystemStructure` + gate (euc03 tests: split reasons, allocation, complete paths, cycles) |
| §8.2 | Architecture canvas | missing | verified — `SystemCanvas.tsx`: SVG, focus default, all-links, pan/zoom, keyboard, text list, detail modal (design-canvas tests + screenshots) |
| §8.3 | System-structure approval freeze | partial | verified — freeze via content hash; status line shows approved/remaining counts and blocking modules |
| §9.1–9.2 | Module-design workspace and queue | missing | verified — `ModuleQueue.tsx` + `computeModuleDesignProgress` (row fields, 7 filters, default-selection precedence, blocked explanation) |
| §9.3 | Six-step module-design session | missing | verified — `moduleDesignSession.ts` + `ModuleSessionView.tsx` (resume exact step, earlier steps preserved, primary-action labels) |
| §9.4 | Draft sources | missing | verified — draft sources from approved records + context manifest; unrelated implementations excluded |
| §9.5 | Required common content | missing | verified — `ModuleDesignSpecification` per §16.1 with all §9.5 blocks |
| §9.6 | Type-specific content (5 module types) | partial | verified — `TypeSpecificDetail` per type with completeness policy (euc04 tests per type) |
| §9.7 | Contract-first design; compatibility classes | partial | verified — `contractRegistry.ts` (one provider per version, compatibility classes, consumer review, packet gate) |
| §9.8 | Module diagrams + detail modal | missing | verified — five projections, selectable elements, detail modal with all §9.8 fields, Discuss/Propose change (design-diagrams tests) |
| §9.9 | Module design checks | missing | verified — all 16 blockers + 5 warnings (euc04 tests trigger each blocker) |
| §9.10 | Module approval freeze content | missing | verified — approval freezes boundary/contracts/schemas/paths with revision + hash + source hashes; one module never approves another (S09) |
| §9.11 | Reopen and revise | missing | verified — `reopenModuleDesign` preserves approved revision, diffs, requires re-approval (S16) |
| §10.1 | Supported structural changes | partial | verified — twelve structural-change commands in `systemDesign.ts`, dispatched via `applySystemDesignDecision` |
| §10.2 | Impact analysis targets | partial | verified — `DesignImpactItem` categories across all §10.2 targets |
| §10.3 | Invalidation rules matrix | missing | verified — exact matrix in `impactEngine.ts`; unrelated modules never marked stale (euc07 tests, S17) |
| §10.4 | Change application scope control | missing | verified — ordered change plan; out-of-scope delta changes rejected (S12) |
| §11.1–11.2 | Module design handoff | missing | verified — `ModuleDesignPacket` with all §11.2 content and `approvalProhibited` |
| §11.3 | Module implementation packet | partial | verified — `ModuleImplementationPacket` with paths, contracts, manifest, idempotency key, deadline, pass kind |
| §11.4 | Context limits and deterministic manifest | missing | verified — priority policy, canonical-record protection, limit stop report (euc10 tests) |
| §11.5 | Returned delta and rejection rules | partial | verified — all seven §11.5 rejection rules incl. traversal (euc11 tests) |
| §11.6 | Inspect, approve, apply; re-inspection | partial | verified — inspection hash, workspace-change re-inspection, §11.6 panel in GUI (S13) |
| §11.7 | Multi-pass work | missing | verified — six continuation kinds; new packet per pass on current revision (euc14 test) |
| §11.8 | Implementation waves without auto-dispatch | partial | verified — `getImplementationWaves` autoDispatch:false; WavesView has no dispatch-all control (S21) |
| §12.1 | Module build lifecycle | partial | verified — nine-stage lifecycle across packet → delta → inspect → approve → apply → verify (S11–S15) |
| §12.2 | Transactional apply | partial | verified — backup, all-or-none, unrelated files preserved, ownership manifest, rollback (euc15 tests, S14) |
| §12.3 | Module verification | partial | verified — verification planner + configured-command executor with timeout-as-failure (integration-executors tests, S15) |
| §13 | Connect requirements | existing | existing Connect machinery retained; design workflow links bindings via `configureBinding`/`verifyConnection` record layer (S26) |
| §14.1–14.3 | Scenario generation, step evidence, run identity | partial | verified — one test per approved scenario, step evidence policy, full §14.3 identity (euc12 tests, S27–S29) |
| §14.4 | Verify view | partial | verified — counts + Design links, no diagrams (assert in tests and GUI view) (S30) |
| §15.1 | UML notation subset | missing | verified — subset validation diagnostics (euc08 tests) |
| §15.2 | Layout quality | missing | verified — deterministic collision-safe layout, clearance/crossing checks, no hidden relationships, text alternatives (euc09 tests) |
| §16 | Data contracts (16.1–16.7) | missing | verified — `design/records.ts` matches §16 shapes |
| §17.1 | Read operations | missing | verified — all ten in `operations.ts` |
| §17.2 | Change operations | missing | verified — all twenty-seven in `operations.ts` |
| §17.3 | Operation controls | partial | verified — uniform idempotency/stale-base/authorization/audit/next-actions wrapper (euc16 tests; cross-process replay in Electron e2e) |
| §18.1 | Common interaction rules | partial | verified — counts not percentages, autosave with save state, selection preserved, focus return, last-approved-beside-draft (GUI tests) |
| §18.2 | Module workspace layout (wide/narrow) | missing | verified — three-column wide layout, drawer/collapse narrow layout (design-workspace tests + reflow screenshot) |
| §18.3 | Feedback and motivation | partial | verified — '3 of 17' counts, next module, factual confirmations, exact-step resume; no confetti or percentages |
| §18.4 | Accessibility | partial | verified — keyboard, focus, landmarks, names, live regions, reduced motion, non-color indicators, zoom/narrow (design-a11y suites + axe scan) |
| §19 | Error and recovery table | partial | verified — provider loss, incomplete response, stale response evidence, apply rollback, command timeout, session restore, concurrent edit (scenario + unit tests) |
| §20.1 | Source access read-only; secret references | existing | verified — read-only scoped context; packet canary checks |
| §20.2 | Agent isolation; path traversal rejection | partial | verified — traversal/symlink rejection, command allowlists, no agent policy changes (euc11/euc15 tests) |
| §20.3 | Audit events | partial | verified — `DesignAuditEvent` append-only log with §20.3 fields; no model reasoning stored |
| §21 | Performance and capacity | partial | implemented — pure read models sized for 40-module projects; job records survive restart; no measured reference-hardware evidence (see DEV-04) |
| §22.1 | Sample rule (default open, synthetic statement) | missing | verified — GUI opens the sample with the synthetic statement when no project is configured (screenshot 01) |
| §22.2 | 17-module sample catalog | missing | verified with recorded deviation DEV-06 — catalog table matches the specification; the table's Lifecycle Explorer/Evidence Graph `FollowTrace` listing internally conflicts with §9.7's one-provider rule, resolved per DEV-06 (sample tests) |
| §22.3 | Sample module-design detail + 5 defects | missing | verified — approved revisions, 3 draft later revisions, contracts, UML, packets, inspected delta, impact, all five defects |
| §22.4 | Recommended design order | missing | verified — exact §22.4 order |
| §22.5 | Recommended implementation waves | missing | verified — seven waves with reasons; one-module default everywhere |
| §23.1 | Migration of existing approved architecture | missing | verified — `migrateExistingProject` preserves approvals, marks inferred fields, drafts per module (euc13 tests) |
| §23.2 | Existing implementation inspection | partial | verified — owned-path linkage report and migration overlay proposal requiring inspection |
| §23.3 | Feature flag | missing | verified — `DesignFeatureFlag`: disable preserves records, export supported, per-project evidence |
| §24.1 | Contract and unit tests | missing (for new model) | verified — 430+ design-suite tests covering every §24.1 bullet |
| §24.2 | Product end-to-end tests (30 scenarios) | missing | verified — two layers, honestly separated: (1) operations-level automation for all 30 scenarios (S01–S30) with structured evidence; (2) a 17-step browser walkthrough covering the GUI-visible halves of a subset, each screenshot mapped to the scenario number(s) it evidences via `scenarioRefs` in `evidence-manifest.json`. S26 ("Connect through a real entry point") is exercised only at the operations-level record layer with an injected test executor; no deployed-product execution of Connect is claimed (see the evidence record's `executorHonestyNote` and DEV-05) |
| §24.3 | Copilot compatibility tests (4 provider modes) | missing | verified — same canonical shape across copilot-handoff/in-app/deterministic/none; partial recovery; outage keeps work (euc14 tests) |
| §24.4 | Accessibility tests | partial | verified — design a11y suites + axe scans over the new workspace |
| §24.5 | Evidence requirements | partial | verified — per-scenario structured evidence with hashes for all 30 scenarios (core evidence); screenshots with metadata, environment (runtime-derived, not hardcoded), and §24.2 scenario cross-references for the GUI-visible steps (browser evidence). Each run writes to a run-stamped `runs/<runId>/` subdirectory with a `latest.json` pointer so a later run never silently overwrites a prior run's committed evidence |
| §25.1 | Ports-and-adapters rule; core import ban | existing | verified — design core modules import no React/Electron/provider/fs libraries (fs only in the persistence/repository adapters) |
| §25.2–25.4 | Internal modules and build order | missing | verified — EUC-01..17 implemented in the §25.4 wave order; this ledger is the trace |
| §26 | Delivery increments | missing | verified — increments 1–8 delivered as the packet sequence in this branch's commit history |
| §27 | Completion criteria | missing | verified — see section 2 rows and the evidence log |
| App. A | Module-design review checklist | missing | verified — checklist items enforced by §9.9 checks and approval gates |
| App. B | Module handoff file set | partial | verified — `packetFileSet` emits the Appendix B layout including README rules |
| App. C | Required user-facing labels | missing | verified — `designShared.tsx` label maps use the "Use" column; tests assert absence of banned terms |

## 4. Approved deviations

Any unavoidable deviation from the specification is listed here with its
reason.

| ID | Section | Deviation | Reason |
| --- | --- | --- | --- |
| DEV-01 | §17.2 / EUC-05 | Operation contracts are derived from `contentHash`-stamped provided operations on module designs rather than a separately persisted contract-registry store. The §17.2 operation list defines no `registerContract`/`approveContract` operation, so the registry (`contractRegistry.ts`) is used in-process and contract approval travels with module-design approval. | §17.2 is the normative operation list; a persisted standalone registry would add operations the specification does not define. Compatibility classification and consumer review requirements are still enforced through `contractRegistry.ts`. |
| DEV-02 | §17.3 | Byte-equal idempotent replay is guaranteed within a process; across restart the replay is reconstructed from the persisted audit event (revision, hash, event id) without the full `value` payload. | The audit log persists the committed identity of the first result; storing full result payloads per idempotency key was judged unnecessary for correctness of §5.3 ("a retry returns the first committed result"). |
| DEV-03 | §9.8 use-case diagrams | UML include/extend edges prefer the explicit `includesUseCaseIds`/`extendsUseCaseIds` fields; analyses without them fall back to a whole-token step-text scan. | `UseCaseDefinition` gained explicit fields; the fallback keeps older analyses projectable. |
| DEV-04 | §21 | Performance targets are respected by design (pure read models, focus-mode-only rendering, debounced autosave) but no reference-hardware measurement program ran; §21 says a target failure "shall create a visible performance issue", and no such measurement harness was built in this release. | §21 uses "should" for the numeric targets; the mandatory controls (progress + cancellation for provider/process work, job persistence across restart) are implemented and tested. |
| DEV-05 | §13 / §17.2 | `configureBinding`, `verifyConnection`, and `runScenario` execute real work only when the embedding product supplies executors; the bare data-directory adapters return an honest `not-configured` diagnostic, and the record/state layer plus legacy Connect machinery carry the real product path. | A launched deployable or browser runner cannot be conjured from a data directory; faking success would violate the "do not infer completion" rule. |
| DEV-06 | §22.2 vs §9.7 | §22.2's catalog table lists `FollowTrace` as provided by both Lifecycle Explorer and Evidence Graph — an internal specification conflict, since §9.7 requires exactly one provider per operation version ("the tool shall not create separate consumer-specific versions of the same approved contract"). The sample models Lifecycle Explorer's `FollowTrace` as a *required* (consumed) operation on the Evidence Graph's contract, not a second provided contract; Evidence Graph remains the sole provider. | §9.7 states the binding product rule; §3.4's precedence order ranks approved module designs and operation contracts (item 5) above generated/descriptive text (item 7), and the §22.2 table row is descriptive documentation of the catalog rather than an approved operation contract itself. Resolution therefore follows §9.7 (one provider) with §3.4 precedence breaking the tie in the table's favor of the contract, not the table. See `sampleAuditHub.ts`'s inline note beside the `FollowTrace` contract registration for the same reasoning in code. |

## 5. Verification evidence log

| Date | Scope | Command | Result |
| --- | --- | --- | --- |
| 2026-07-25 | Baseline full core suite | `npm run build` (root) then `ELECTRON_DISABLE_SANDBOX=1 xvfb-run -a npx vitest run` in `packages/core` | pass after environment setup (see below) |

| 2026-07-25 | Wave 1 core modules (EUC-01..06) | `npx vitest run test/capabilities/design/` in `packages/core` | 8 files, 142 tests passed; `tsc --noEmit` clean |
| 2026-07-25 | Final full validation | root `npm run build`; typecheck for core/desktop/gui; root `npm test` under `ELECTRON_DISABLE_SANDBOX=1 EUIK_TEST_MODE=1 xvfb-run`; `npx vitest run apps/desktop/test`; `node apps/desktop/e2e/design-workflow.mjs`; `npm test` in `examples/do178-audit-hub` | all green: core 809/809 (112 files), gui 273/273 (34 files), runtime 96/96, desktop 78 passed + 1 environment skip (no MATLAB engine), Electron design e2e 11/11, DO-178C example 28/28; builds and typechecks clean |
| 2026-07-25 | Browser evidence run | `node scripts/design-workflow-evidence.mjs` | 17/17 screenshots with §24.5 metadata; axe: 0 violations on 4 workspace states; usability log 8 entries, 3 resolved in-scope |
| 2026-07-25 | Product scenarios | `npx vitest run test/capabilities/design/product-scenarios.test.ts` | 32/32 (S01–S30 + provider-loss + stale-response) with per-scenario structured evidence |

Environment prerequisites established for this container: root `npm install`
and `npm run build`; Electron binary via `node node_modules/electron/install.js`
and `ELECTRON_DISABLE_SANDBOX=1` under `xvfb-run`; repo-root `.venv` with
`requirements-dev.txt` plus `pip install -e runtimes/python`; Playwright
headless-shell shim (`/opt/pw-browsers/chromium_headless_shell-1228` linked to
the preinstalled 1194 build because the container proxy blocks browser
downloads).

## 6. Usability log

Workflow-centered observations recorded during implementation and final
in-app testing. Material problems are fixed in scope; the remainder become
recommendations in the final report.

| # | Area | Observation | Disposition |
| --- | --- | --- | --- |
| U-01 | Module queue | The sample ships every module with an approved history, so the `Blocked` filter shows an empty state on first open; a first-time user cannot see what a blocked module looks like without constructing one. | Accepted for the sample (blocked rows appear as soon as a dependency is reopened); the queue's blocked filter shows an explanatory empty state. |
| U-02 | Checks step | Error-summary links jump to the step that owns the diagnostic, not the exact field, so precise correction still needs a short visual scan inside the step. | Recorded as a recommendation; step-level focus keeps §18.4 error-linking useful without deep per-field forms. |
| U-03 | Copilot handoff | The foundation build shipped the handoff button as a confirmation stub, which would have been a silent dead end for users. | Fixed in GUI part 2: the button now creates a real packet through the same builders the machine API uses. |
| U-04 | Session resume | Resume returns to the exact step, but nothing summarizes what changed upstream since the user left. | Recorded as a recommendation (changed-upstream indicator exists in the queue row; a session-level banner would repeat it at the point of work). |
| U-05 | Long ids | Deep generated diagram-relationship ids exceeded OS filename limits when used as discussion-entry filenames — an invisible, hard-to-diagnose failure for a user proposing a change from a diagram. | Fixed: long ids are hashed in filenames; full ids stay in the record body. |
| U-06 | Delta rollback | Rolling back an applied delta cleared the apply-result state, which removed the status region that should have announced "Rolled back" — the user got no visible or announced confirmation of a successful recovery. | Fixed: the apply result persists through rollback so the confirmation renders and is announced. |
| U-07 | System canvas | With 17 modules the fixed viewBox left deep-topology nodes off screen; the selected module itself could be invisible even in focus mode, and "Reset view" did not recover it. Found while driving the built GUI in a real browser. | Fixed: the viewBox now fits the visible content, and a selection or mode change re-fits the view; pan and zoom remain user adjustments. |
| U-08 | Approvals | The "Approve module" button was silently disabled when a design was not ready for review — no inline reason near the action. | Fixed: the approval step states why approval is unavailable (open questions, stale upstream, or checks not run). |
| U-09 | Narrow screens | The module-list drawer toggle did not name the currently selected module, losing context when the queue is collapsed. | Fixed: the toggle now names the current module. |
| U-10 | Canvas mode label | Focus mode is only exposed through its inverse "Show all links" toggle; there is no positively worded label for the default state. | Recommendation: add a mode label such as "Focus on selected module" beside the toggle. |
| U-11 | Waves view | "Create Copilot handoff" inside a wave row gives no in-place confirmation; the packet result appears only in the separate per-module handoff panel. | Recommendation: surface an inline confirmation or move focus to the packet summary after creation. |
| U-12 | Diagram alternative | The text-alternative toggle swaps its own label ("Show relationship list" ↔ "Show diagram") with no persistent heading naming the active view. | Recommendation: keep a static heading above the region naming the current representation. |
