# End-to-end workflow remediation closure

**Date:** 2026-07-26
**Baseline audited:** `3addd9911e30bb60f53df155d5e71e60f08d77c8`
**Source audit:** 43-finding end-to-end user audit completed 2026-07-26
**Disposition:** all 43 audit findings implemented and rechecked; the complete
empty-project journey also passes in the packaged desktop application.

## Verification boundary

The remediation was checked in three layers:

1. **Live product walk:** the current GUI was walked through Plan, Design,
   full-screen UML review, Build, Connect, Verify, Evidence, original artifact
   viewing, deep-link reload, 1280px desktop, 900px tablet, 640px/200%-equivalent
   reflow, and browser-console inspection. A second acceptance journey drove
   the packaged Electron app from an empty project through application restart
   using only rendered controls.
2. **Project/desktop behavior:** project-mode reads, changes, setup, handoff,
   connection verification, scenario execution, artifact serving, and failure
   paths are covered by GUI bridge, desktop, core operation, real-process, and
   Electron end-to-end tests. The packaged acceptance walk creates an empty
   project and uses rendered controls for Project setup, Plan, System Design,
   module design, Design-baseline approval, Build overlay inspection/apply,
   Connect, Verify, exact-result approval, Evidence, route reload, and complete
   application restart.
3. **Recorded sample boundary:** the bundled DO-178C workspace is now explicitly
   labeled as a synthetic showcase. Historical results are shown as old, not as
   current project proof. Browser builds without the desktop design bridge
   cannot silently select a project and continue showing sample records.

The screenshots in `e2e-evidence/` are current GUI captures. The packaged
desktop evidence is in
`apps/desktop/validation-evidence/product-delivery-packaged/`; its manifest
records `packaged: true`, all 11 screenshots, route/restart restoration, and
an empty renderer-error list. Screenshots remain presentation evidence, not a
substitute for the operation and Electron test layers.

## Finding closure ledger

| Finding | Disposition | Verification |
| --- | --- | --- |
| WF-001 | Original PNG and structured JSON artifacts now exist, carry hashes and metadata, resolve through the bridge, and open in dedicated viewers with download. | Live original-artifact open; sample manifest; artifact bridge tests. |
| WF-002 | Replaced the retired placeholder walk with a packaged empty-project acceptance journey covering every stage through original Evidence plus reload/restart recovery. The ledger separates presentation, operation, and desktop proof. | `apps/desktop/e2e/product-delivery-packaged.mjs`; packaged manifest/screenshots; full repository suite. |
| WF-003 | Capabilities handoff now opens the same packet in global Build & Test and carries project, module, and design-revision context. Returned results flow back into the design lifecycle. | Build handoff GUI tests and live Build navigation. |
| WF-004 | Restored Guided/Technical modes, a numbered stage rail, sequential completion, prerequisites, current state, and stage guidance. | Live stage walk and workspace tests. |
| WF-005 | Phase and object state are encoded in stable URLs and local route state, including module, run, use case, scenario, diagram element, and artifact. | Live reload restored the exact Evidence route; routing tests. |
| WF-006 | The completed fixture is a clearly labeled showcase with local-only practice edits and a real-project path; it no longer impersonates onboarding. | Live browser banner and disabled desktop-only project options. |
| WF-007 | Plan includes read-only source selection, required/optional status, health, failure gating, and openable source records. | Live Plan walk and Plan bridge tests. |
| WF-008 | Inferred actors, identity, trigger, preconditions, inputs, outputs, steps, paths, rules, and checks are grouped and reviewable with source links and correction actions. | Plan UI and operation tests. |
| WF-009 | Approved Plan now shows approval/revision state and supports an explicit revise/reapprove flow while preserving the approved baseline. The overlay footer was removed. | Plan lifecycle tests and live desktop capture. |
| WF-010 | System Design presents alternatives, recommendation rationale, split reasons, editable modules, allocations, deployables, structural preview, and checks before approval. | System-design GUI and bridge tests. |
| WF-011 | The system canvas renders provided/required interfaces and typed relationships; nodes and edges use one-click/keyboard selection and a routed inspector. | Canvas interaction tests and live inspector walk. |
| WF-012 | Added semantic grouping, minimum readable scale, pan/zoom, fit-system, fit-selection, focus neighborhoods, and a minimap. | Canvas tests and live full-screen review. |
| WF-013 | Module UML now has pan/zoom, fit controls, full screen, persistent tabs, minimap, legend, selection, and an equivalent relationship list. | Live component/use-case captures and diagram tests. |
| WF-014 | Diagram layout responds to the actual container and keeps narrow diagrams pannable instead of shrinking them into illegibility. | Resize/container tests and 640px walk. |
| WF-015 | “Discuss” no longer maps a question to a change proposal. It is explicitly unavailable when no provider exists; proposals retain change semantics. | Bridge-routing tests. |
| WF-016 | Visual changes now follow propose → analyze → approve → execute, update only approved records, regenerate projections/checks, and expose diffs and reapproval impact. | Bridge and module-session tests. |
| WF-017 | Queue/context behavior is independently scrollable at desktop, becomes a drawer when narrow, keeps the next action visible, and provides a dedicated diagram-review mode with an exit. | Responsive/live Design walk and workspace tests. |
| WF-018 | Build is focused on one selected module; waves are collapsed summaries, blockers precede action, and packet/contracts/files are progressively disclosed. | Live Build walk and Build UI tests. |
| WF-019 | Unsupported multi-module project handoff is gated and no longer presented as an enabled production action. | Build capability tests. |
| WF-020 | Returned changes are associated with the handoff, support file/provider return, verify identity, and present a file/record diff before approval and apply. | Handoff/delta tests. |
| WF-021 | Connect provides guided CLI and HTTP editors with operation/mapping/health details; unsupported kinds are explicitly gated rather than advertised as working. | Connect executor and GUI tests. |
| WF-022 | Project binding and last verification state are read from the adapter, persisted, and restored after reload with revision, failure, and next action. | Adapter/bridge persistence tests. |
| WF-023 | Project setup is onboarding/readiness, not a hidden final phase; repository, principal, and authority blockers link directly to Setup. | Project setup and authority-recovery tests. |
| WF-024 | Verify is a grouped use-case/scenario list with search, result filter, detail, run-current/all, export, expected/observed steps, and first actionable failure. | Live Verify walk and Verify tests. |
| WF-025 | Run and approval actions have row-level busy/error/retry state; approval is visible and linked to the immutable result. | Verify interaction and bridge tests. |
| WF-026 | Evidence is artifact-first with thumbnails, original/derived status, structured inspector, metadata, hashes, full resolution, download, and integrity errors. | Live original-artifact viewer and evidence tests. |
| WF-027 | Evidence includes a lifecycle trace from use case through Design, Build, Connect, Verify, approval, steps, and artifacts with bidirectional open actions. | Live Evidence walk and explorer tests. |
| WF-028 | Gate state is centralized in the guided rail and repeated beside blocked actions with exact reason and recovery route. | Workspace, setup, Build, Connect, and Verify tests. |
| WF-029 | Narrow mode focuses one region, uses drawers and horizontal diagram/stage navigation, preserves the active stage, and avoids overlaying actions. | Live 900px, 640px, and 390px checks. |
| WF-030 | Diagram tabs implement roving focus/arrow keys; graph keyboard movement is spatial and the relationship list is a persistent linear equivalent. | Accessibility and diagram keyboard tests. |
| WF-031 | Sample truth is consolidated into one compact, expandable banner. | Live desktop/tablet captures. |
| WF-032 | Save language distinguishes bundled baseline, browser-local change, unsaved/saving/saved, and project-synced states. | Save-indicator tests and live sample state. |
| WF-033 | Plan actions are in normal document flow and no longer obscure reviewed content. | Live Plan capture and layout CSS. |
| WF-034 | Guided mode leads with users, tasks, outcomes, and blockers; identities, hashes, paths, and JSON live in technical disclosure. | Live stage walk and copy assertions. |
| WF-035 | Page, phase, object, status, and metadata hierarchy were rebuilt with stronger type/spacing and fewer competing borders. | Current visual evidence set. |
| WF-036 | UML has a persistent representation heading, compact legend, selected emphasis/breadcrumbs, and stable representation controls. | Live full-screen UML captures. |
| WF-037 | The UML inspector leads with definition, connections, trace, impact, and staged actions; technical identity is collapsed and discussion is separated from proposals. | Live modal walk and diagram tests. |
| WF-038 | Dates are human-readable, long IDs are shortened with full technical disclosure, and status/revision chips lead the lists. | Live Verify/Evidence captures. |
| WF-039 | Added current desktop, full-screen UML, original-artifact, tablet, narrow, and 200%-equivalent captures; blocked/old/completed/in-progress states are visibly represented. | `e2e-evidence/` plus responsive and state tests. |
| WF-040 | The journey vocabulary is Plan, Design, Build, Connect, Verify, Evidence; handoff language is provider-neutral and Build & Test is the continuation surface. | Copy review and live walk. |
| WF-041 | Selected, hover, pressed, and focus-visible treatments were normalized; full-screen and tab states no longer create accidental nested outlines. | Current visual evidence and accessibility tests. |
| WF-042 | Secondary metadata, rationale, coverage, technical identity, legends, waves, and raw detail use progressive disclosure. | Live walk and disclosure tests. |
| WF-043 | Vitest now provisions deterministic storage and isolates state; the normal one-command GUI and repository suites run without the local-storage workaround. | `apps/gui/test/setup.ts`, Vite config, full suite. |

## Additional defects found during the remediation walk

| Defect | Fix |
| --- | --- |
| Historical sample runs made later stages look complete for the current design. | Stage completion now compares the complete current revision identity; old runs and artifacts are visibly labeled old. |
| Resolving one required module question skipped Behavior, Contracts, Diagrams, and Checks. | The session state machine now advances through each step and requires an explicit design-check run before approval. |
| Approved modules showed duplicate handoff actions. | The duplicate approval-step action was removed. |
| Long semantic IDs collided after truncation, producing duplicate React keys and misrouted relationships. | Long stable slugs retain a readable prefix plus a deterministic hash suffix; uniqueness is tested across every bundled projection. |
| Component collectors crossed unrelated nodes and interface labels. | Component routing now uses shared clear rails outside peer rows, with separate provided/required interface corridors. |
| Multiple actor associations visually merged or crossed. | Every actor association has its own attachment and ordered corridor; the Evidence Store projection has zero crossings and a dedicated regression. |
| Stage status text truncated at desktop/tablet width. | Statuses wrap to two lines with a stable rail height. |
| A narrow deep link could hide the active stage. | The active stage is centered on initial load/reload and remains horizontally navigable. |
| Browser project selection silently continued showing fixture data. | Desktop-only project options are disabled in browser builds and the limitation is stated in the showcase banner. |
| A new project’s System Design draft displayed zero checks and could never be approved. | System proposals and edits now refresh the structure gate against the compiled application before persistence; operation tests assert the visible gate passes. |
| The visible project-mode “Continue module design” action announced text but did not advance the session. | Generic editable-draft service actions now drive the local review-step state machine; design checks and approvals still cross the authoritative service boundary. |
| A newly created module contained blank fields required by its own gate, while the GUI exposed no way to author them. | Guided creation now produces a trace-linked, explicitly inferred starter design with type-specific behavior, schemas, acceptance cases, runtime policy, and verification commands for human review. |
| The GUI treated production `{ design, session/evaluation }` service responses as raw module records and crashed after draft creation. | The bridge client now consumes the canonical structured response shapes; fake bridge tests mirror production values. |
| Verify skipped every approved scenario step because generated module commands had no step mapping. | Guided module generation now maps every traced scenario step to an explicit repository-local verification command; the packaged run executes all approved steps. |
| A freshly passing run was born “old” and omitted Build/Connect from its lifecycle trace. | Scenario identity now uses the compiled application revision and carries the linked Build run, source packet, verified connection, environment, runner, and test-data revision into the immutable record. Currency checks remain strict. |
| The complete-baseline Build policy had service operations but no usable release-gate interaction. | Build presents explicit Create/Approve Design baseline actions before enabling the implementation handoff. |
| Module approval and context UI exposed raw ISO time and a very long internal use-case id. | Approval time is localized and linked use cases use concise human labels with full identity retained in the title/technical disclosure. |
| Fresh Plan analysis repeated the whole prompt as its title, assigned a generic actor, left failure/recovery intent disconnected, and copied the paragraph into the primary module responsibility. | Deterministic analysis now extracts a concise actor and task, derives reviewable outcomes, creates main/failure/recovery scenarios, and gives System Design a workflow responsibility sourced from the approved use-case names. |
| Connect and Evidence could create a page-wide horizontal scrollbar on a desktop viewport. | Grid children now have bounded intrinsic width, controls shrink inside the editor, and the six-stage lifecycle trace fits desktop before becoming locally scrollable on narrow windows. |
| The artifact viewer’s packaged screenshot was captured during the dialog entrance animation, producing muddy translucent proof. | Packaged captures wait for UI motion to settle, and each run removes stale failure images before recording current evidence. |
| An inferred failure scenario could exceed the OS filename limit when its immutable run was persisted, leaving “Run all” short of its expected count. | All id-backed records now use bounded, hash-stable file stems after path-containment validation; full semantic IDs remain in the records and resolve through direct reads and listings. |
| An older asynchronous coverage read could overwrite the post-run Verify summary even though all passing results were already persisted. | Verify reads are now ordered so only the newest response may update state; the regression deliberately resolves two requests out of order, and the packaged walk proves the current count advances. |

## Final regression

- `npm test`: all workspace suites passed — 121 core files / 954 tests,
  36 GUI files / 312 tests, 15 runtime files / 96 tests, reference apps, and
  the DO-178C UI/server suites (1,412 tests total).
- Desktop suite: 9 files / 100 tests passed; the one optional real-MATLAB
  integration was skipped because the MATLAB Python Engine is not installed.
- `npm run build`: all buildable workspaces passed.
- Desktop package: `release/mac-arm64/Engineering UI Kit.app`.
- Packaged acceptance:
  `npm run test:capabilities:production-packaged -w @engineering-ui-kit/desktop`
  passed with `packaged: true`, `routeRestored: true`,
  `restartDeepLinkRestored: true`, `restartRestored: true`, and no renderer
  errors.

## Current evidence

- `e2e-evidence/workflow-plan-desktop.png`
- `e2e-evidence/workflow-verify-desktop.png`
- `e2e-evidence/workflow-evidence-desktop.png`
- `e2e-evidence/workflow-evidence-900.png`
- `e2e-evidence/workflow-evidence-640.png`
- `e2e-evidence/workflow-evidence-1440.png`
- `e2e-evidence/workflow-evidence-1920.png`
- `e2e-evidence/uml-component-fullscreen.png`
- `e2e-evidence/uml-use-case-fullscreen.png`
- `e2e-evidence/evidence-original-artifact.png`
- `../../apps/desktop/validation-evidence/product-delivery-packaged/01-plan-describe.png`
- `../../apps/desktop/validation-evidence/product-delivery-packaged/04-module-approved.png`
- `../../apps/desktop/validation-evidence/product-delivery-packaged/05-build-applied.png`
- `../../apps/desktop/validation-evidence/product-delivery-packaged/06-connect-verified.png`
- `../../apps/desktop/validation-evidence/product-delivery-packaged/07-verify-passed.png`
- `../../apps/desktop/validation-evidence/product-delivery-packaged/08-evidence-trace.png`
- `../../apps/desktop/validation-evidence/product-delivery-packaged/09-evidence-original.png`
- `../../apps/desktop/validation-evidence/product-delivery-packaged/11-restart-restored.png`
