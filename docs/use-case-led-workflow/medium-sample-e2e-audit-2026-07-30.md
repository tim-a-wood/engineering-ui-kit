# Medium sample end-to-end triage report

Date: 2026-07-30

Sample: Harbor Ops Console

## Executive summary

The workflow is demonstrable from project creation through immutable evidence, but it is not yet dependable as an end-to-end design and verification system.

The two release-blocking gaps are trust and integration. Verification can accept the same screenshot for different scenarios, and the built user interface cannot connect to the UI execution path. The next largest problem is design fidelity: five distinct user tasks collapse into one use case, one linear application workflow, one operation, and one generic module. The polished sample UI was imported as a returned Build overlay; the approved design did not generate or fully describe that UI.

The strongest parts are the coherent product shell, the responsive sample interface, the final verification summary, and the Evidence lifecycle trace. The weakest parts are the STE warning wall, shallow design decomposition, repetitive approvals, diagram presentation, and the amount of work required before the user sees a meaningful result.

### Severity summary

| Severity | Count | Meaning |
| --- | ---: | --- |
| Critical | 2 | Breaks the integrity of the proved delivery chain. |
| High | 8 | Prevents the workflow from delivering the promised design quality or creates major user friction. |
| Medium | 6 | Materially reduces usability, clarity, or workflow efficiency. |
| Low | 3 | Creates avoidable polish, accessibility, or momentum defects. |

## Remediation outcome

Status: complete and verified on 2026-07-30.

The original audit is preserved below. The same medium Harbor sample now completes the packaged workflow with the required and recommended changes in place.

- 68 rendered user actions across 11 phases
- 5 separate use cases and 6 approved scenarios
- 2 design modules: User workspace and Application workflow
- Component, activity, state machine, sequence, and use-case diagrams for both modules
- A real local UI entry point with scenario-specific selectors, actions, observations, captures, and execution traces
- 6 of 6 current scenario runs passed
- 12 immutable scenario artifacts
- 29 current remediation screenshots
- 0 open rerun findings
- 0 renderer errors
- 0 sample UI errors

Vocabulary review remains an explicit human policy gate. The Build view grouped 129 review items into one rule/file group and showed examples on demand. The sample accepted that review set; it did not silently classify those items as approved ASD-STE100 vocabulary.

### Finding disposition

| Finding | Status | Verified change |
| --- | --- | --- |
| AUD-001 | Resolved | UI steps record routes, selectors, observed text, original captures, and execution traces. Reused visible screenshot hashes block the run. |
| AUD-002 | Resolved | Connect launches a local UI, waits for readiness, performs the mapped action, observes the result, and captures evidence. |
| AUD-003 | Resolved | Plan asks whether examples are separate user tasks or steps. The sample produces five use cases. |
| AUD-004 | Resolved | Generated failure actions and scenario names use short verb-object labels and pass the product writing gate. |
| AUD-005 | Resolved | Plan shows a sticky blocker summary with a `Fix next` field action. |
| AUD-006 | Resolved | Control checks use the accessible name and exclude metadata, help, and nested status text. |
| AUD-007 | Resolved | Build groups repeated review items by rule and file, with counts, examples, and expandable detail. |
| AUD-008 | Resolved | Design creates separate experience and workflow modules and derives behavior projections from approved use cases. |
| AUD-009 | Resolved | Diagrams fit on open, use compact simple layouts, hide unnecessary minimaps, and expose all applicable UML views. |
| AUD-010 | Resolved | New-project readiness is one compact setup card with one completion action. |
| AUD-011 | Resolved | Experience summaries, diagram projections, stage previews, and the built-UI preview provide earlier payoff. |
| AUD-012 | Resolved | Project context remains visible in the product breadcrumb, and Build retains the originating capability packet context. |
| AUD-013 | Resolved | Connect and diagrams show approved human names first. Stable IDs and hashes are secondary technical details. |
| AUD-014 | Resolved | The entry action is `New project`; dialog submission remains `Create project`. |
| AUD-015 | Resolved | Policy detail is progressive, warning lists are grouped, and current actions remain visually prominent. |
| AUD-016 | Resolved | Experience design records screens, navigation, view states, accessibility, recovery, responsive behavior, and trace IDs. Build handoffs reference those elements. |
| AUD-017 | Resolved | The active project persists across Plan, Capabilities, Build, and return navigation. |
| AUD-018 | Resolved | Completed readiness and diagram-review content collapses or yields to the current task. |
| AUD-019 | Resolved | Build completion exposes a primary `Preview built UI` action and can open a generated static UI when no launch URL exists. |

### Verification record

| Check | Result |
| --- | --- |
| Core tests | 127 files, 1,046 tests passed |
| GUI tests | 45 files, 353 tests passed |
| Product builds | Core, GUI, and desktop TypeScript/Vite builds passed |
| Desktop package | Packaged macOS arm64 application launched successfully |
| Packaged audit | 11 of 11 phases passed in 29.3 seconds |
| Scenario verification | 6 passed, 0 failed |
| Runtime integrity | 0 renderer errors, 0 product errors |
| Visual review | All 29 current screenshots inspected; no open rerun finding |

## Outcome

The packaged desktop workflow completed from a new project through Plan, Design, Build, Connect, Verify, and Evidence.

- 51 rendered user actions
- 11 workflow phases
- 1 use case
- 1 application workflow
- 1 operation
- 1 module
- 2 scenarios
- 2 passed scenarios
- 12 recorded artifacts
- 0 renderer errors
- 0 sample UI errors

The sample UI contains a harbor dashboard, vessel plan, berth assignment flow, shift handoff, and responsive mobile layout.

The implementation entered the product as a returned Build overlay. The platform applied and verified the overlay. The platform did not generate the detailed screen architecture from the approved design.

## Audit scope and method

- Started with a new packaged-desktop project.
- Entered a medium operational brief with five user tasks and a required UI.
- Completed Plan, application workflow, system design, module design, Build, Connect, Verify, and Evidence.
- Used 51 rendered user actions across 11 phases.
- Inspected the generated design records and diagrams.
- Applied a working Harbor Ops UI through the product Build overlay flow.
- Exercised the built UI on desktop and mobile viewports.
- Reviewed scenario results, evidence lineage, original captures, usability, presentation, boredom, and payoff.
- Recorded 19 screenshots and a machine-readable audit manifest.

The packaged application completed without renderer or product errors. A separate browser-development-path observation is included as a scoped Medium finding because it did not reproduce in the packaged path.

## Maturity assessment

| Dimension | Score | Assessment |
| --- | ---: | --- |
| Function | 5/10 | The full stage model works, but medium scope loses structure. UI behavior is not proved end to end. |
| Presentation | 6/10 | The shell is coherent. Diagram and warning views use space poorly. |
| Usability | 5/10 | The path is learnable, but it requires repeated approvals, scrolling, and technical interpretation. |
| Trust | 3/10 | Evidence is immutable, but scenario proof can be unrelated to the specific step. |
| Fun | 4/10 | Most stages are procedural. Build completion and Evidence provide the main payoff. |
| Sample UI | 8/10 | The returned Harbor Ops interface is coherent, responsive, and visually finished. |

## Triage

### Critical

#### AUD-001 — Scenario proof is not specific

The same Harbor dashboard screenshot passed as evidence for the main path and the closed-berth failure path. The runner proved that the app artifact existed. It did not prove each approved action or expected result.

Impact: A green verification result can create false confidence.

Recommended change:

- Require step-specific execution metadata.
- Detect reused screenshot hashes across visible steps.
- Require a route, action, observed result, and capture for each visible step.
- Show reused proof as a blocker or explicit review item.

#### AUD-002 — The UI cannot connect as a UI

Connect reports that the user-interface executor is unavailable, even after Build applies a real UI. The sample uses a command-line binding for verification.

Impact: The built interface is outside the proved delivery chain.

Recommended change:

- Add a user-interface entry point.
- Configure a launch URL or file, route, readiness selector, and capture target.
- Run approved UI scenarios against that entry point.

### High

#### AUD-003 — Medium scope collapses

Five distinct tasks became one use case, one linear workflow, one operation, and one module:

1. Review vessel queue.
2. Assign vessel berth.
3. Record maintenance hold.
4. Review harbor incident.
5. Prepare shift handoff.

These tasks are not one necessary sequence. Some tasks are independent or conditional.

Impact: The generated design misstates user behavior and produces shallow module design.

Recommended change:

- Detect task lists in examples.
- Ask whether examples are steps, alternate paths, or separate use cases.
- Show a decomposition preview before draft creation.

#### AUD-004 — The draft generator violates the STE gate

The generator created this blocked action:

> Exercise the failure path related to: assign closed berth

The user had to edit it to:

> Reject closed berth

The generated scenario name remained `Prevent prohibited outcome 1`.

Impact: A normal input produces a draft that cannot be approved without manual repair.

Recommended change:

- Use a short failure action template.
- Derive the failure scenario name from the prohibited result.
- Run the same STE check before the draft reaches the UI.

#### AUD-005 — Plan does not explain its blocked state

The top of the Plan review shows `Draft`, but it does not show the blocking STE diagnostic or a link to the invalid field. The approval message is far below the first viewport.

Impact: Users must search a long record to find the defect.

Recommended change:

- Add a sticky blocker summary.
- Add `Fix next` and field-anchor links.
- Put the first blocker beside the state badge.

#### AUD-006 — The STE gate conflicts with rich controls

The first overlay inspection treated all visible text inside rich button cards as one action label. It also treated complete checkbox and radio rows as technical names. The markup required structural changes or concise `aria-label` values before it could pass.

Impact: Common accessible UI patterns can fail for reasons unrelated to the actual control name.

Recommended change:

- Check the computed accessible name.
- Do not concatenate status and metadata into the action label.
- Check associated form labels separately from help text.

#### AUD-007 — STE review noise is excessive

The accepted overlay produced 121 vocabulary review warnings. Most warnings repeated the same message. The Build screen rendered the full list.

Impact: Users learn to accept all warnings without review.

Recommended change:

- Group warnings by rule and file.
- Show counts and three examples by default.
- Add a project vocabulary review flow.
- Preserve individual details in an expandable section.

#### AUD-008 — Diagram scope is too shallow

The experience-first design still produced one generic module. The component view contains one operation and one component. It does not describe the dashboard, vessel view, handoff view, UI state, or data boundaries.

Impact: The diagrams do not guide implementation of the medium UI.

Recommended change:

- Allocate application actions to multiple design responsibilities.
- Add screen or experience projections for UI modules.
- Derive module behavior from application workflow paths.

#### AUD-009 — Diagram review wastes the viewport

The module view shows a large blank canvas, a clipped node, and a minimap for a one-node structure. The current diagram starts below earlier workflow content and requires more scrolling.

Impact: Diagram review feels unfinished and slow.

Recommended change:

- Fit visible elements after every layout.
- Center the selected diagram when the review step opens.
- Collapse earlier projections during diagram review.
- Reduce the canvas height for simple graphs.
- Hide the minimap when it adds no value.

#### AUD-016 — Approved design does not describe the polished UI

The Harbor dashboard, vessel detail, berth assignment modal, handoff checklist, responsive behavior, view state, and interaction structure are present in the finished sample. The approved design contains one generic module and one operation. The polished interface entered Build as a prepared overlay rather than as an implementation derived from those design records.

Impact: The demonstration can imply design-to-code traceability that the current workflow does not provide.

Recommended change:

- Add an experience design stage that describes screens, navigation, states, actions, data dependencies, and responsive behavior.
- Allocate application workflow actions to those experience elements.
- Require Build output to reference the approved experience and module elements it implements.
- Show coverage from use case to application workflow, screen, module, implementation artifact, scenario, and evidence.

### Medium

#### AUD-010 — Setup is verbose for every new project

Repository, principal, and approval-role setup is clear but occupies multiple panels and requires a dedicated technical view.

Recommended change: Combine readiness checks into one compact setup card and grant the expected local roles during trusted local project creation.

#### AUD-011 — The workflow delays its payoff

Users complete Plan approval, system approval, six module steps, module approval, baseline creation, baseline approval, handoff creation, Build import, Connect, and verification approval before the strongest result appears.

Recommended change: Show live previews and generated artifacts after each stage. Collapse completed approval details.

#### AUD-012 — Build breaks context

The user leaves Capabilities for a separate Build shell, then returns to Capabilities for Connect. Navigation emphasis also changes.

Recommended change: Keep the stage rail and project context visible through Build, or open Build as a stage-specific workspace in the same shell.

#### AUD-013 — Technical identifiers dominate

Long operation IDs appear in Connect and diagrams. Evidence uses truncated hashes as primary references.

Recommended change: Use human names by default. Put stable IDs in expandable technical details.

#### AUD-015 — Dense text increases fatigue

The dark workflow UI uses many small labels and long helper paragraphs. Several primary actions start below the viewport.

Recommended change: Shorten helper text, keep one sticky primary action, and use progressive disclosure for policy detail.

#### AUD-017 — The browser-development path can lose project context

In the browser-development path, project creation succeeded, but `Define product` and `Open capabilities` loaded the DO-178C showcase and reset the project selector. The packaged application retained the Harbor Ops project and completed normally.

Impact: Development and browser-based review can test the wrong project or make new-project work appear to disappear.

Recommended change:

- Persist the active project ID before navigation.
- Resolve stage routes from the active project rather than a showcase default.
- Add an end-to-end regression test that creates a project, opens Plan, opens Capabilities, and asserts that the same project remains selected.

### Low

#### AUD-014 — Creation controls have duplicate accessible names

The project page and the open project dialog both expose a `Create project` action at the same time.

Impact: The distinction between opening the dialog and submitting it is weaker for keyboard, assistive-technology, and automated users.

Recommended change: Use `New project` for the entry action and `Create project` for submission.

#### AUD-018 — Completed workflow panels remain visually dominant

Completed setup and approval content continues to occupy substantial vertical space while the user works on the next task.

Impact: The current action moves below the fold and progress feels slower than it is.

Recommended change: Collapse completed panels into one-line summaries with an explicit `Review details` action.

#### AUD-019 — Build completion does not surface the UI payoff

After the overlay is applied, the workflow does not provide a prominent action to open the built interface. The user must know how to find or launch it separately.

Impact: The strongest visual reward is easy to miss at the moment when it would create momentum.

Recommended change: Add a primary `Preview built UI` action to the successful Build result.

## Engagement review

| Stage | Boredom | Fun | Payoff | Notes |
| --- | ---: | ---: | ---: | --- |
| Project setup | High | Low | Low | Necessary configuration with little visible progress. |
| Plan input | Medium | Low | Medium | The draft reveal is useful, but the blocked state damages momentum. |
| Application workflow | Medium | Medium | Medium | The activity diagram is the first visual reward. Its semantics are too shallow. |
| System design | High | Low | Low | The choice appears meaningful, but it still creates one generic module. |
| Module design | High | Low | Low | Repeated continue actions feel procedural. |
| Build | Very high | Medium | High | Warning noise is severe. Seeing the applied UI is the first strong reward. |
| Connect | High | Low | Medium | Proof is technical, and the UI executor is unavailable. |
| Verify | Medium | Medium | High | Passed counts and approval provide clear progress. |
| Evidence | Low | Medium | Very high | The lifecycle trace and original capture provide the best closure. |

## Low-hanging fruit improvements

These changes are small or well bounded and improve trust, usability, or visible polish without requiring the full design-system redesign.

| Priority | Improvement | Effort | Expected value | Related findings |
| ---: | --- | --- | --- | --- |
| 1 | Reject duplicate screenshot hashes across different visible scenario steps unless a reviewer records a reason. | Small | Immediately reduces false-positive evidence. | AUD-001 |
| 2 | Replace the generated failure template with a short verb-object action and derive a specific scenario name. | Small | Removes a routine approval blocker. | AUD-004 |
| 3 | Add a sticky Plan blocker summary with `Fix next` and field links. | Small | Makes blocked drafts understandable without searching. | AUD-005 |
| 4 | Group STE warnings by rule and file; show three examples and a count by default. | Small | Removes the 121-warning wall and restores review value. | AUD-007 |
| 5 | Use the computed accessible name for STE checks on controls. | Small–medium | Stops rich buttons and form rows from failing for irrelevant metadata. | AUD-006 |
| 6 | Fit and center the active diagram when its review step opens. | Small | Removes clipped nodes and large empty canvases. | AUD-009 |
| 7 | Hide the minimap and reduce canvas height for trivial diagrams. | Small | Makes simple diagrams look intentional. | AUD-009 |
| 8 | Rename the project entry action to `New project`. | Trivial | Removes the duplicate accessible action name. | AUD-014 |
| 9 | Collapse completed setup and approval panels into summaries. | Small | Reduces scrolling and makes progress more visible. | AUD-011, AUD-018 |
| 10 | Add a primary `Preview built UI` action after Build applies an overlay. | Small | Delivers an earlier and stronger payoff. | AUD-011, AUD-019 |
| 11 | Ask one decomposition question when an example contains several independent task verbs. | Small–medium | Prevents the most obvious one-use-case collapse. | AUD-003 |
| 12 | Show human labels first and move stable IDs into technical details. | Small | Improves scanability across diagrams, Connect, and Evidence. | AUD-013 |
| 13 | Persist and assert the active project across browser stage navigation. | Small–medium | Prevents development reviews from silently switching samples. | AUD-017 |

## Larger follow-on work

The following items are not low-hanging fruit and should be planned as product-level changes:

1. Add a real UI executor and connect the built UI to approved scenarios.
2. Define scenario-specific proof contracts for actions, observations, routes, and captures.
3. Add use-case decomposition and validate whether tasks are sequential, alternate, or independent.
4. Introduce experience-level design for screens, navigation, state, responsive behavior, and data responsibilities.
5. Trace approved use cases through workflows, experience elements, modules, implementation artifacts, scenarios, and evidence.

## Recommended delivery order

1. **Restore trust:** fix scenario-specific proof and add the UI executor.
2. **Restore design fidelity:** prevent scope collapse and add experience-level design.
3. **Remove avoidable friction:** fix generated STE output, warning grouping, and Plan blocker guidance.
4. **Polish the review experience:** improve diagram fitting, stage context, progressive disclosure, labels, and preview actions.

## Evidence

- Remediation manifest: `docs/use-case-led-workflow/screenshots/triage-remediation-2026-07-30/audit-manifest.json`
- Remediation screenshots: `docs/use-case-led-workflow/screenshots/triage-remediation-2026-07-30`
- Original audit manifest: `docs/use-case-led-workflow/screenshots/new-medium-app-audit-2026-07-30/audit-manifest.json`
- Original screenshot set: `docs/use-case-led-workflow/screenshots/new-medium-app-audit-2026-07-30`
- Generated sample: `e2e-samples/harbor-ops-console`
- Reproducible packaged-app audit: `apps/desktop/e2e/harbor-ops-audit.mjs`
