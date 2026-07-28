# End-to-end workflow product audit

**Audit date:** 2026-07-26  
**Target build:** `3addd9911e30bb60f53df155d5e71e60f08d77c8` (`main`)  
**Reference:** `docs/use-case-led-workflow/mockup.html` and the normative
`SPECIFICATION.md`

## Executive verdict

**Release decision: NO-GO.**

The canonical record layer is substantial, and the use-case analysis now feeds
system design, module traces, scenario planning, and scenario-run identity.
That is real progress. The user experience around it is not close to the
mockup's level of maturity.

The shipped workflow is best described as an **internal engineering alpha**:
the data model and many individual operations exist, but the visible journey
is flat, technical, difficult to scan, and incomplete at several critical
handoffs. The largest problem is not cosmetic. Screenshot evidence is represented
by references that do not resolve to artifacts, the current GUI does not open
either screenshot or structured evidence, and the two Build experiences are
not one continuous workflow.

### Maturity score

| Dimension | Score | Assessment |
| --- | ---: | --- |
| Functional continuity | 2.0 / 5 | Canonical records connect internally, but the user journey breaks at Build, Connect coverage, change execution, and evidence review. |
| Presentation | 1.5 / 5 | Dense engineering-console layouts replaced much of the mockup's hierarchy and progressive disclosure. |
| Usability | 1.5 / 5 | Flat unlocked tabs, technical IDs, weak next actions, long pages, and hidden interaction conventions make the product hard to learn. |
| Evidence integrity | 1.0 / 5 | Run records exist, but screenshot references are not backed by sample artifacts or an artifact viewer. |
| Accessibility | 2.5 / 5 | Good foundations exist, but diagram scaling, tab keyboard behavior, zoom usability, and sticky overlays remain material problems. |
| Overall | **1.7 / 5** | **Internal alpha; not ready for beta or customer review.** |

## Audit method and evidence boundary

This audit used:

- the five current rendered workflow captures committed with `3addd99`;
- the prior 17-step browser evidence run at build `ab859d0`, including its
  full-page, narrow, zoom, modal, Build, Verify, and Evidence captures;
- the current React implementation and canonical operation routing;
- the specification and mockup interaction contract;
- the evidence manifests, usability log, and accessibility reports.

The current connected browser control was unavailable during this audit. I did
not count source inspection as proof that a user interaction succeeds. Any
critical interaction not demonstrated by current rendered evidence is treated
as unverified, not passed.

## Priority definitions

- **P0 — stop release:** breaks the promised end-to-end outcome or undermines
  evidence integrity.
- **P1 — must fix before beta:** major functional, usability, or accessibility
  gap in a primary journey.
- **P2 — fix before polish sign-off:** visible quality or comprehension issue
  that materially lowers trust.
- **P3 — backlog:** worthwhile refinement after the primary journey is sound.

## Triaged findings

| ID | Priority | Area | Finding and evidence | Required disposition |
| --- | --- | --- | --- | --- |
| WF-001 | **P0** | Evidence integrity | The sample creates strings such as `evidence/screenshots/<step>.png` and `evidence/structured/<step>.json`, but those artifacts do not exist. `WorkflowEvidenceView` prints the references as text. The app therefore presents evidence identities without reviewable evidence. This directly fails product scenarios 28 and 29 and the original-screenshot requirement. | Capture and persist the original artifact for every applicable step, serve it through the desktop bridge, show a thumbnail plus full-resolution viewer, and open structured evidence in a readable inspector. Missing artifacts must fail the run or carry an approved non-applicable reason. |
| WF-002 | **P0** | Release evidence | The current integration is evidenced by five approved-sample screenshots, not an end-to-end user run. They do not show project creation, Plan drafting, approvals, Build, Connect, scenario execution, evidence opening, error recovery, narrow layout, or restart/resume. The older browser manifest explicitly covers GUI-visible halves of only a subset while operations tests cover the rest. The ledger's “verified” wording overstates product-level proof. | Run a fresh desktop product test against the current commit from an empty project through approved Evidence. Record actions, results, artifacts, restart/resume, failures, and viewport variants. Change the ledger to distinguish unit/operation coverage from real GUI completion. |
| WF-003 | **P0** | Workflow continuity | There are two Build products. The Capabilities **Build** tab creates module packets in `DesignStore`; the global **Build & Test** workflow is driven by `activeRun`, `BuildView`, and a separate packet state. No route transfers the approved module handoff into the global Build run. The sidebar and tab both say Build while operating different lifecycles. | Establish one canonical Build packet/run model and one visible transition. “Continue to Build” must open the same packet in Build & Test, preserve project/module/revision context, and return apply/verification results to the Capabilities workflow. Remove the duplicate conceptual path. |
| WF-004 | **P1** | Global journey | The mockup's Guided/Design modes, numbered stages, subtitles, completion state, locks, stage guide, and focused next action were replaced with six plain tabs. All phases are always clickable. Users can enter Evidence before Verify or Connect before prerequisites and must infer why a screen is empty. | Restore the guided journey shell around the canonical content. Show numbered stage state, prerequisites, next action, completed/blocked markers, and a technical Design mode. Allow deliberate expert navigation without presenting it as the default. |
| WF-005 | **P1** | Navigation state | The active workflow phase is local React state. The URL does not change and reload returns to Plan. A link cannot open a scenario, module, diagram, run, or evidence item. This undermines resume, collaboration, support, and audit review. | Add routable phase and object state, restore the exact phase/object after restart, and provide stable deep links for use cases, modules, diagram elements, scenario runs, and evidence artifacts. |
| WF-006 | **P1** | First-use experience | The default sample opens after every major decision is already approved. It demonstrates records but not the promised workflow. A first-time user cannot experience Describe → Review → Approve → Design without configuring a desktop project and authorities. | Provide a resettable guided sample journey with safe, real interactions or a separate read-only showcase clearly labeled as such. Do not use a completed sample as the primary onboarding path. |
| WF-007 | **P1** | Plan · Describe | The project Plan form accepts a work description, examples, and prohibited results, but has no source picker, selected-source list, read-only-source statement, source health, or required/optional source failure handling. This fails CAP-PLAN-002/003 in the visible product. | Add source selection and management, show read-only scope and health, distinguish required/optional failures, and carry source links into the draft. |
| WF-008 | **P1** | Plan · Review | The review UI can act on actors and the selected use case's acceptance checks. Trigger, preconditions, rules, inputs, outputs, main-flow steps, alternate/failure/recovery paths, and use-case identity are display-only. Source references are plain text, not openable. Users cannot perform the full review promised by the mockup or CAP-PLAN-010..013. | Make every inferred review item actionable, open its source, support add/correct/reject where allowed, and group content into the mockup's purpose/users/tasks/limits/checks hierarchy. |
| WF-009 | **P1** | Plan lifecycle | Once approved, Plan offers only “Continue to system design.” There is no reopen/revise flow. The same screen simultaneously shows **Approved** and a sticky footer saying **Ready for approval**, which is contradictory. | Add an explicit revise flow that preserves the last approved revision, shows impact, and requires reapproval. Replace the approved footer with approval identity, revision, and the correct next action. |
| WF-010 | **P1** | System Design | Project mode can generate one structure and approve it, but the UI does not present alternatives, recommendation rationale, split reasons, module editing, operation allocation, or deployable choices before approval. It asks the user to approve an opaque generated result. | Provide the mockup's option comparison, design rationale, module inspector/editor, structural-change preview, and check summary before approval. |
| WF-011 | **P1** | System canvas semantics | The system canvas renders modules and dependency edges only. It does not show provided/required interfaces. Edges are not selectable, and a node detail modal requires undisclosed double-click; single-click changes the module workspace below. This fails the canvas interaction contract. | Render system interfaces and relationship types, make every node and relationship selectable with one click/Enter, and open a small inspector with a clear route into module design. |
| WF-012 | **P1** | System canvas readability | Fitting all visible nodes into a fixed 480px canvas makes the 17-module graph microscopic. The earlier off-screen-node defect was exchanged for an unreadable-fit defect; current screenshots show most labels below practical reading size. | Use semantic grouping, focus neighborhoods, progressive disclosure, a minimap, fit-selection and fit-system actions, and a minimum readable scale with horizontal/vertical navigation. |
| WF-013 | **P1** | Module diagrams | Dense UML projections have no pan, zoom, fit-selection, minimap, or full-screen review controls. The SVG scales the entire graph into the available width, so labels and ports become tiny. This is especially poor for the Package Export component diagram and narrow viewports. | Build a real diagram viewport with pan/zoom, fit controls, persistent diagram tabs, selectable relationship list, legend, and readable minimum scale. |
| WF-014 | **P1** | Diagram responsiveness | `ModuleDiagrams` calls its hook “narrow container” but uses viewport `matchMedia`, not the diagram container width. In the three-column workspace it can choose the wide layout while the actual center column is narrow. The specification also requires narrow diagrams to pan horizontally; the implementation scales them down instead. | Use `ResizeObserver`/container queries and provide horizontal panning at narrow widths. Add visual tests for the actual center-column widths, not only browser widths. |
| WF-015 | **P1** | Agent discussion | **Discuss with agent** is materially misleading. In sample mode it stores only the user's own message and announces that it was sent; there is no agent response. In project mode it calls `proposeVisualChange`, so a “discussion” is persisted as a proposed change. | Either implement an actual discussion provider and preserve conversation semantics, or relabel/remove the action. Do not map questions to change proposals. |
| WF-016 | **P1** | Visual change execution | In project mode, **Approve change plan** approves an impact record but does not apply the approved change to canonical records or regenerate affected diagrams/tests. The mockup promises approval followed by controlled agent execution and regenerated projections. | Add an explicit assign/execute step, update only the approved records, regenerate diagrams/tests, show diffs, and require reapproval where impact rules demand it. |
| WF-017 | **P1** | Module workspace | The three-column module workspace often leaves a large empty center/right region while the module queue continues for many screens. Diagram focus hides global context instead of offering a purposeful review mode. Selection and the next incomplete step are visually weak. | Make queue and context independently sticky/scrollable, keep the current module and next action visible, and use a dedicated diagram-review layout with an obvious return path. |
| WF-018 | **P1** | Build presentation | Build expands all seven waves as dense eight-column tables and repeats **Create Copilot handoff** on every row, then appends multi-module controls, gate information, another module picker, packet details, and a raw delta form. It violates the focused-workspace/one-primary-action rule and requires extreme scrolling. | Collapse waves into summary cards, select one module into a focused handoff workspace, show blockers before action, and progressively disclose paths/contracts/manifests. |
| WF-019 | **P1** | Build capability | Multi-module handoff is shown in project mode even though the copy states it is unavailable. The primary button is not disabled by project mode, so the interface advertises an unsupported production path. | Hide it behind a truthful capability flag or implement the bridge operation. Disabled/unavailable functionality must not look like part of the supported path. |
| WF-020 | **P1** | Returned changes | The normal returned-change path is a raw JSON paste. There is no file picker, handoff-provider return channel, packet/run association, visual diff, or obvious source identity before import. | Integrate provider/file return into the canonical handoff run, verify identity automatically, and use a file/record diff review rather than a JSON textarea as the primary flow. |
| WF-021 | **P1** | Connect coverage | The Connect UI is a 430px raw JSON editor seeded with a CLI template. The production executor supports only CLI and localhost HTTP conventions while the specification promises UI, CLI, HTTP, schedule, embedded-library, outbound adapter, composition-root, process, and health-check configuration. | Create guided binding editors per supported kind, show approved operation choices, mappings and health checks, and either implement or explicitly gate every promised binding kind. |
| WF-022 | **P1** | Connect persistence | Connection presentation state initializes to `{}` and is reset when a project snapshot loads. A persisted binding may exist in the service, but the UI returns to “Not configured in this session” after reload and cannot show the last verification. | Add binding/connection reads to the workflow snapshot and restore configuration, status, revision, last verification, failure, and next action after restart. |
| WF-023 | **P1** | Project setup | Setup is the last tab after Evidence even though repository, principal, and authority configuration are prerequisites for early approvals and Build. Users discover it only after an authority failure. | Move setup into project onboarding and project settings. Show a readiness checklist before Plan approval and link each missing prerequisite directly to its fix. |
| WF-024 | **P1** | Verify workflow | Verify renders every scenario as an equal card with long IDs. It has no “run all current scenarios,” filter, grouping by use case, export, or selected-scenario detail. A failed card shows only “Failed,” not the failed step or corrective path. | Use the mockup's scenario list/detail layout, group paths under use cases, add run-current/all and export actions, and show expected/actual step evidence plus the first actionable failure. |
| WF-025 | **P1** | Verify feedback | Approving a passed run calls the operation but does not update a visible approval state. Run/approval errors are not rendered near the scenario action, and there is no per-row running state. Users cannot tell whether approval succeeded. | Persist and display verification approval, show row-level progress/error/retry, disable only the active row, and link the approved result to its immutable evidence set. |
| WF-026 | **P1** | Evidence review | The “Evidence Explorer” is a run list plus raw metadata. Screenshot and structured evidence are plain strings; there is no preview, open, compare, download, mask disclosure, original-resolution access, or missing-artifact status. | Build an artifact-first evidence inspector with thumbnails, original/derived distinction, structured viewer, metadata, hashes, download/export, and explicit integrity failures. |
| WF-027 | **P1** | Evidence information model | The promised lifecycle-phase Evidence Explorer is reduced to a collapsed sample defect gallery below scenario runs. Planning, Design, implementation, verification, and approval evidence are not navigable as a coherent trace. | Provide lifecycle views and a bidirectional trace from use case → design revision → implementation/build → connection → scenario step → artifact. |
| WF-028 | **P1** | Gate/error guidance | Tabs remain open regardless of prerequisites, while many operations surface only global diagnostics or generic empty states. The user is not consistently told “what is blocked, why, and what to do next” at the action point. | Centralize gate presentation, show exact blocker-to-fix links beside every disabled/failed action, and make the guided stage rail the primary recovery path. |
| WF-029 | **P1** | Narrow/zoom usability | Existing 640px and 200% captures technically reflow without horizontal page overflow, but the canvas becomes unreadable, the page becomes several screens long, and context is pushed far below the action. That is survival, not usable responsive behavior. | Redesign narrow layouts around one focused region, drawers/inspectors, horizontal diagram pan, sticky context summary, and shorter progressive sections. Re-test the new Plan, Connect, Verify, and Evidence phases at 200%. |
| WF-030 | **P1** | Diagram keyboard model | Module diagram tabs use ARIA tab roles but do not implement arrow-key/roving-tabindex behavior. Every diagram tab remains in the tab order. Diagram selection is keyboard-addressable, but navigation across a dense graph has no spatial model. | Implement the complete tabs pattern and a documented diagram keyboard model, with the relationship list as an equivalent, persistent representation. |
| WF-031 | **P2** | Header economy | `MOCK DATA`, a full synthetic-data statement, and a full sample-workspace warning repeat the same status on every phase. Together with the workflow header and tabs they consume roughly half of a 720px viewport before task content. | Consolidate sample status into one compact, persistent banner with an expandable explanation. |
| WF-032 | **P2** | Save/trust state | Approved sample records display **Not saved yet**. The sample also says changes stay in the browser, which implies persistence. The status creates unnecessary doubt about whether the visible canonical data is durable. | Distinguish bundled read-only baseline, unsaved draft, locally saved sample change, saving, saved, and service-synced project states. |
| WF-033 | **P2** | Plan layout | The sticky Plan footer visibly overlays the use-case content at 1280×720 and has no corresponding content-safe area. | Reserve footer space, make it context-aware, and avoid obscuring the item being reviewed at normal and 200% zoom. |
| WF-034 | **P2** | Guided language | User-facing copy repeatedly leads with “canonical records,” “application specification,” “binding,” revision IDs, hashes, module IDs, and raw source paths. The specification says IDs should be hidden in Guided mode. | Restore a plain-language Guided mode and move IDs/hashes/JSON into technical details or Design mode. |
| WF-035 | **P2** | Visual hierarchy | Most content uses the same dark panel, one-pixel border, and small type. Primary content, metadata, status, and diagnostics compete at the same level. Build and Evidence are especially difficult to scan. | Define page, section, object, status, and metadata hierarchy; increase readable type size; reduce borders; and use space and grouping deliberately. |
| WF-036 | **P2** | Diagram presentation | The improved UML symbols are not supported by a legend, persistent current-view label, relationship emphasis, or readable interaction affordance. The text-alternative toggle changes its label without a separate active-view heading. | Add a compact UML legend, persistent representation heading, hover/focus emphasis, selected-element breadcrumb, and stable switch label/state. |
| WF-037 | **P2** | Detail modal | The UML detail modal is dominated by raw stable IDs and empty sections, followed by two similar textareas. It looks like a data dump, not the mockup's guided element inspector/change conversation. | Lead with definition, trace, connections, impact and actions; collapse technical identity; separate discussion from change proposal; and use staged impact/change review. |
| WF-038 | **P2** | Dates and identifiers | Scenario and evidence lists show raw ISO timestamps and very long IDs that wrap into multiple lines. They obscure outcome and recency. | Show human-readable time, short stable labels, build/revision chips, and reveal full IDs on demand with copy controls. |
| WF-039 | **P2** | Current visual QA | The current commit has only five 1280×720 captures. Build and Connect have no current screenshot, and current Plan/Connect/Verify/Evidence have no narrow, zoom, empty, loading, error, or project-mode captures. | Add a current visual matrix at 1280×720, 1440×900, 1920×1080, 900px, 640px, and 200% zoom across primary, empty, blocked, error, and completed states. |
| WF-040 | **P2** | Terminology | “Capabilities,” “Capabilities workflow,” “Build,” “Build & Test,” “Design,” “module design,” and “Copilot handoff” overlap without explaining which is a phase, product area, or external-provider action. | Establish one journey vocabulary and use provider-neutral handoff language, with Copilot shown as a configured provider rather than the workflow name. |
| WF-041 | **P3** | Focused control polish | Selected tabs and diagram elements use heavy nested borders/focus rings that read as accidental double outlines in screenshots. Some secondary controls look visually disabled when they are active. | Normalize selected, hover, pressed, and focus-visible treatments across tabs, chips, diagram elements, and drawer toggles. |
| WF-042 | **P3** | Content density | Empty states, status summaries, and technical details are often permanently expanded. The product rarely uses progressive disclosure despite long records. | Collapse secondary metadata, retain user expansion state, and tune default disclosure per phase and role. |
| WF-043 | **P1** | Test reproducibility | The default GUI `npm test` command fails 96 tests because `window.localStorage` is unavailable. With the documented Node local-storage-file workaround, the full run reached 307/308 and failed the lost-session selection assertion; the failing file passed 5/5 in isolation. This points to shared-state/test-isolation fragility and means the claimed 308/308 result is not reproducible from the package's normal command. | Provision storage in the Vitest setup or package script, give workers isolated storage, remove singleton leakage between files, and make the documented one-command suite pass repeatedly before using it as release evidence. |

## What is genuinely mature

These parts should be preserved while the product surface is rebuilt:

- approved use cases compile into application/system inputs;
- module designs carry use-case and scenario-step traces;
- approvals and immutable revisions are separated;
- the five UML projections use semantic element types rather than one generic
  box;
- the module queue, six module steps, impact records, packet compiler,
  scenario plan, and scenario-run identity are real domain concepts;
- basic focus handling, status announcements, text alternatives, and
  responsive stacking are present;
- core and GUI automated suites provide useful regression protection.

The correct next move is not another cosmetic pass over isolated cards. It is
to restore the mockup's guided shell, make one real path through the existing
canonical operations, and then polish each phase inside that path.

## Remediation sequence

### Wave 0 — restore truth and continuity

1. Implement actual screenshot/structured artifact persistence and viewing.
2. Unify Capabilities Build with Build & Test.
3. Execute and record one current, real desktop journey from an empty project.
4. Correct the implementation ledger and release claims to match demonstrated
   product evidence.

### Wave 1 — restore the product journey

1. Reintroduce Guided/Design modes and the numbered, gated stage rail.
2. Add routable/resumable phase and object state.
3. Move project setup into onboarding.
4. Create a resettable first-use sample.

### Wave 2 — complete the phase workflows

1. Finish Plan sources, review/edit, and revision.
2. Add real system-design alternatives and editable structure review.
3. Build proper diagram viewports and a real change-execution loop.
4. Refocus Build around one selected module and one handoff/run.
5. Replace raw Connect JSON with supported guided binding editors.
6. Rebuild Verify and Evidence around scenario detail and artifacts.

### Wave 3 — presentation and accessibility sign-off

1. Establish the visual hierarchy and plain-language copy.
2. Complete narrow/zoom and keyboard behavior.
3. Run the full visual-state matrix and WCAG 2.2 AA audit.
4. Conduct task-based user testing against the mockup's success measures.

## Exit criteria for beta

The workflow is not beta-ready until:

- a new user can complete the full journey without source knowledge or manual
  JSON;
- every stage has one obvious next action and exact blocker recovery;
- Build is one continuous lifecycle;
- supported Connect paths are configured and verified through guided UI;
- every visible scenario step opens an original screenshot;
- every nonvisual step opens structured evidence or a valid reason;
- a change approved from a diagram updates canonical records and regenerated
  projections;
- reload returns the user to the exact phase and object;
- narrow and 200% zoom preserve readable, operable diagrams and actions;
- the current desktop build has a complete, reproducible end-to-end evidence
  run.
