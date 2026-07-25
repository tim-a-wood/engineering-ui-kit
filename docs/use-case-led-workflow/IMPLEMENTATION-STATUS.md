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
| EUC-01 | Use-case analysis core | partial (`ApplicationSpecification` + product gate only) | missing | `packages/core/src/capabilities/design/useCaseAnalysis.ts` | — |
| EUC-02 | Application compiler | missing | missing | `packages/core/src/capabilities/design/applicationCompiler.ts` | — |
| EUC-03 | System-design core | partial (`architectureInterview.ts`) | missing | `packages/core/src/capabilities/design/systemDesign.ts` | — |
| EUC-04 | Module-design core | partial (`moduleInterview.ts`) | missing | `packages/core/src/capabilities/design/moduleDesign.ts`, `moduleDesignSession.ts`, `moduleDesignCompilers.ts` | — |
| EUC-05 | Contract registry | partial (`registry.ts`) | missing | `packages/core/src/capabilities/design/contractRegistry.ts` | — |
| EUC-06 | Design baseline | missing | missing | `packages/core/src/capabilities/design/designBaseline.ts` | — |
| EUC-07 | Impact engine | partial (`impact.ts`) | missing | `packages/core/src/capabilities/design/impactEngine.ts` | — |
| EUC-08 | Diagram semantics | missing | missing | `packages/core/src/capabilities/design/diagramSemantics.ts` | — |
| EUC-09 | Diagram layout adapter | missing | missing | `packages/core/src/capabilities/design/diagramLayout.ts` | — |
| EUC-10 | Context and packet compiler | partial (`packets.ts`) | missing | `packages/core/src/capabilities/design/contextPacket.ts` | — |
| EUC-11 | Delta inspector and apply planner | partial (overlay inspect/apply) | missing | `packages/core/src/capabilities/design/deltaInspector.ts` | — |
| EUC-12 | Verification planner | partial (`verification.ts`) | missing | `packages/core/src/capabilities/design/verificationPlanner.ts` | — |
| EUC-13 | Persistence and migration adapter | partial (`persistence.ts`, `migration.ts`) | missing | `packages/core/src/capabilities/design/designWorkspace.ts`, `designMigration.ts` | — |
| EUC-14 | Provider adapters | partial (file-drop packets only) | missing | `packages/core/src/capabilities/design/providers.ts` | — |
| EUC-15 | Repository and process adapters | partial (overlay apply, command runner) | missing | `packages/core/src/capabilities/design/repositoryAdapter.ts` | — |
| EUC-16 | Desktop and machine API adapters | partial (legacy IPC only) | missing | `packages/core/src/capabilities/design/operations.ts`, `apps/desktop/src/capabilities/designIpc.ts`, `packages/core/src/designCli.ts` | — |
| EUC-17 | React workspaces | partial (legacy views) | missing | `apps/gui/src/views/design/*` | — |

## 3. Specification sections

| Section | Requirement group | Status | Notes / evidence |
| --- | --- | --- | --- |
| §3.1 | Two levels of Design | missing | — |
| §3.2 | Separate approvals | partial | Legacy per-record approvals exist; module-design/baseline approvals missing |
| §3.3 | One module per external handoff; multi-module rules | missing | — |
| §3.4 | Canonical record precedence and conflict blocking | missing | — |
| §3.5 | Build gate mode (`completeBaseline` default, `incrementalModules` by decision) | missing | — |
| §4 | Users and authority; agent cannot approve | partial | Legacy approvals record user; authority model missing |
| §5.1 | Canonical record set | missing | Six new records absent at baseline |
| §5.2–5.3 | Common state model and state rules | missing | — |
| §6 | End-to-end workflow (main flow + controlled incremental build) | missing | — |
| §7 | Plan requirements (CAP-PLAN-001..016) | partial | Legacy interview flow; no item-state review model |
| §8.1 | Architecture draft rules (CAP-DES-SYS-001..008) | partial | Interview gates exist; split reasons and path completeness incomplete |
| §8.2 | Architecture canvas | missing | No graphics, pan/zoom, focus mode at baseline |
| §8.3 | System-structure approval freeze | partial | Architecture approval exists; freeze semantics and progress counts missing |
| §9.1–9.2 | Module-design workspace and queue | missing | — |
| §9.3 | Six-step module-design session | missing | — |
| §9.4 | Draft sources | missing | — |
| §9.5 | Required common content (`ModuleDesignSpecification`) | missing | — |
| §9.6 | Type-specific content (5 module types) | partial | `MODULE_APPLICABLE_DETAILS` per type exists in interview form |
| §9.7 | Contract-first design; compatibility classes | partial | `OperationContract` exists; compatibility classifier missing |
| §9.8 | Module diagrams + detail modal | missing | — |
| §9.9 | Module design checks (blockers and warnings) | missing | — |
| §9.10 | Module approval freeze content | missing | — |
| §9.11 | Reopen and revise | missing | — |
| §10.1 | Supported structural changes | partial | Rename/split/merge etc. not modeled as commands |
| §10.2 | Impact analysis targets | partial | Module-level transitive impact exists |
| §10.3 | Invalidation rules matrix | missing | — |
| §10.4 | Change application scope control | missing | — |
| §11.1–11.2 | Module design handoff | missing | — |
| §11.3 | Module implementation packet | partial | Legacy `ImplementationPacket` lacks contracts/manifest/idempotency/deadline |
| §11.4 | Context limits and deterministic manifest | missing | — |
| §11.5 | Returned delta and rejection rules | partial | Overlay model checks paths/hashes; no packet-ID/base-revision model |
| §11.6 | Inspect, approve, apply; re-inspection | partial | Overlay re-inspects before apply |
| §11.7 | Multi-pass work | missing | — |
| §11.8 | Implementation waves without auto-dispatch | partial | `implementationWave.ts` computes waves |
| §12.1 | Module build lifecycle | partial | Legacy run lifecycle differs |
| §12.2 | Transactional apply | partial | Generation apply is transactional; delta apply needs backup/rollback |
| §12.3 | Module verification | partial | Verification runner exists |
| §13 | Connect requirements | existing | Inbound bindings, composition, observed-path verification exist |
| §14.1–14.3 | Scenario generation, step evidence, run identity | partial | Runner and evidence exist; revision-linking model missing |
| §14.4 | Verify view (counts, links, no diagrams) | partial | — |
| §15.1 | UML notation subset | missing | — |
| §15.2 | Layout quality | missing | — |
| §16 | Data contracts (16.1–16.7) | missing | — |
| §17.1 | Read operations | missing | — |
| §17.2 | Change operations | missing | — |
| §17.3 | Operation controls (idempotency, stale base, audit, next actions) | partial | Some handlers check hashes; no uniform control layer |
| §18.1 | Common interaction rules | partial | — |
| §18.2 | Module workspace layout (wide/narrow) | missing | — |
| §18.3 | Feedback and motivation | partial | — |
| §18.4 | Accessibility (WCAG 2.2 AA behaviors) | partial | a11y suites exist for legacy views |
| §19 | Error and recovery table | partial | Provider-loss/apply-rollback partial; session restore missing |
| §20.1 | Source access read-only; secret references | existing | Redaction and secret-reference model exist |
| §20.2 | Agent isolation; path traversal rejection | partial | Overlay path checks exist |
| §20.3 | Audit events | partial | Transition history only; no full audit event record |
| §21 | Performance and capacity | partial | Perf fixture exists for legacy views |
| §22.1 | Sample rule (default open, synthetic statement) | missing | — |
| §22.2 | 17-module sample catalog | missing | 9-module divergent sample only |
| §22.3 | Sample module-design detail + 5 defects | missing | — |
| §22.4 | Recommended design order | missing | — |
| §22.5 | Recommended implementation waves | missing | — |
| §23.1 | Migration of existing approved architecture | missing | — |
| §23.2 | Existing implementation inspection | partial | Adoption/migration audit exists for legacy model |
| §23.3 | Feature flag | missing | — |
| §24.1 | Contract and unit tests | missing (for new model) | — |
| §24.2 | Product end-to-end tests (30 scenarios) | missing | — |
| §24.3 | Copilot compatibility tests (4 provider modes) | missing | — |
| §24.4 | Accessibility tests | partial | Legacy-view coverage only |
| §24.5 | Evidence requirements | partial | Evidence artifacts exist for legacy journeys |
| §25.1 | Ports-and-adapters rule; core import ban | existing | Core is GUI-independent; keep for new work |
| §25.2–25.4 | Internal modules and build order | missing | This ledger tracks them |
| §26 | Delivery increments | missing | — |
| §27 | Completion criteria | missing | — |
| App. A | Module-design review checklist | missing | — |
| App. B | Module handoff file set | partial | Legacy handoff files differ |
| App. C | Required user-facing labels | missing | — |

## 4. Approved deviations

None recorded yet. Any unavoidable deviation from the specification is listed
here with its reason and approval context.

| ID | Section | Deviation | Reason |
| --- | --- | --- | --- |

## 5. Verification evidence log

| Date | Scope | Command | Result |
| --- | --- | --- | --- |
| 2026-07-25 | Baseline full core suite | `npm run build` (root) then `ELECTRON_DISABLE_SANDBOX=1 xvfb-run -a npx vitest run` in `packages/core` | pass after environment setup (see below) |

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
