# Two-step Copilot handoff workflow

Implementation specification for the approved Build/Test workflow mockup.

Visual reference: [`two-step-workflow.html`](./two-step-workflow.html) and [`two-step-workflow.png`](./two-step-workflow.png).

## 1. Objective

Replace the visible five-step workflow with two user-facing steps:

1. **Build** — combines Prepare Context, Create Task Packet, Run in Copilot, and Apply Zip Overlay in one view.
2. **Test** — the existing Verify & Review view, unchanged except for its user-facing name and navigation labels.

This is an information-architecture and layout change. It must not remove, weaken, or bypass any existing behavior, artifact gate, safety check, evidence feature, or error state.

## 2. Non-goals and hard boundaries

- Do not redesign, reorder, simplify, or otherwise modify the body of `VerifyReviewView`.
- Do not change verification execution, result restoration, review comments, evidence, review packet generation, launch configuration, embedded preview, or iteration behavior.
- Do not alter bridge contracts, generated artifact formats, overlay inspection rules, exclusion rules, or persisted run semantics unless a small compatibility change is strictly necessary for routing.
- Do not automatically upload repository data to Copilot. Existing explicit copy/open interactions remain explicit.
- Do not automatically apply an overlay after selection or inspection.
- Do not make an unsafe or blocked overlay applyable.
- Do not delete the four existing view implementations until the consolidated view has parity and tests pass. They may first be retained as extracted sections/internal components.

## 3. User-facing navigation model

The global workflow stepper displays exactly:

| Step | Label | Supporting label |
| --- | --- | --- |
| 1 | Build | Prepare, hand off & apply |
| 2 | Test | Verify & review |

The page title for step 1 is `Build`. The page title and all user-facing references to `Verify & Review` become `Test`. Descriptive copy inside Test may still use the words “verify” and “review”; only the step/page name changes.

Recommended route model:

- Add one canonical `build` view ID.
- Retain `verify-review` internally if renaming it would create unnecessary persisted-state migration risk; display it as `Test` everywhere.
- Old internal links/routes for `prepare-context`, `create-task-packet`, `run-in-copilot`, and `apply-zip-overlay` should resolve to `build` and select the corresponding Build workspace state.
- Back navigation from Test returns to Build with the Overlay workspace state selected.
- “Iterate on feedback” from Test returns to Build with the task authoring area visible and the iteration template/feedback prefilled exactly as it is today.

Persisted `HandoffRun.currentStep` values must remain readable. Add a presentation-level mapping rather than destructively migrating existing runs:

| Existing current step | Visible step | Initial Build workspace state |
| --- | --- | --- |
| `prepare-context` | Build | Handoff |
| `create-task-packet` | Build | Handoff |
| `run-in-copilot` | Build | Copilot |
| `apply-zip-overlay` | Build | Overlay |
| `verify-review` | Test | n/a |
| `complete` | Test | n/a |

## 4. Build view layout

Use the current application shell, tokens, typography, control sizes, and responsive rules. At desktop widths, Build uses a two-column layout:

- Main column: fluid, minimum useful width about 580 px.
- Workspace rail: approximately 350 px and visually persistent beside the main column.
- Gap: existing semantic spacing equivalent to about 16–20 px.
- At narrower widths, stack the workspace rail above or below the main authoring content without losing controls.

### 4.1 Page header

- Breadcrumb: `Copilot Handoff / {project name}`.
- Title: `Build`.
- Subtitle: `Prepare the handoff, run it in Copilot, inspect the returned overlay, and apply it safely.`
- Keep the guide entry point. Update its content/routing so Build guidance covers all four former steps.
- Render the two-step stepper immediately below the header.

### 4.2 Main column: task authoring panel

Panel heading: `What should Copilot build?`

Keep all existing Create Task Packet capability:

- Template selector.
- “Use template” behavior and overwrite confirmation.
- Launch-default behavior supplied by templates.
- Project association/change behavior.
- All `TaskPacketFields`, including title, goal/requirements, acceptance criteria, constraints, files/scope, expected output, and any other field currently rendered.
- Feedback-prefill behavior for iteration runs.
- Add/remove/reorder controls currently supported for repeatable field entries.
- Current validation, error messages, busy states, and status reporting.

Layout rules:

- Show template and project controls in a compact first row.
- Keep task title and the primary requirements/goal field always visible.
- Less-frequently edited task sections may use progressive disclosure, but their values and editing controls must remain immediately reachable in this panel.
- A collapsed section must show whether it is empty or populated; do not hide populated data without a summary indicator.
- Do not generate the packet merely by editing. Preserve an explicit prepare/regenerate action.

### 4.3 Main column: project context panel

Panel heading: `Project context`.

Keep the repository identity and `Change` action visible. Place the remaining Prepare Context features in focused disclosures or modal overlays:

#### Context & privacy

- Included categories: source, configuration, text assets, documentation.
- Deterministic exclusions and the full exclusion-rule list.
- Secret-pattern warnings and their exact messages.
- Company-policy/upload warning.
- Included/excluded file counts, detected frameworks, package manager, flatfile size, and generated path after preparation.
- Existing error, success, and busy states.

Collapsed summary example: `Source, config, assets, docs · 8 exclusion rules` plus warning state when applicable.

#### Output & upload set

- Flat-file output.
- Structured JSON inventory.
- Generated filenames and paths.
- Upload-slot accounting, including the optional third visual-reference slot.
- Visual reference selection/attachment behavior.

Collapsed summary example: `Flat file + JSON · 2 of 3 slots`.

#### Before evidence

- Preserve `EvidenceSection` behavior for phase `before`.
- Preserve launch configuration requirements, capture, configured-view list, output, errors, and navigation to project configuration.
- This may open in a modal/overlay or expand inline.

Collapsed summary example: `Capture configured views for visual drift`, followed by captured-count/status after completion.

## 5. Build workspace rail

The rail is a workspace, not a second workflow stepper. It has three tabs/states:

1. `Handoff`
2. `Copilot`
3. `Overlay`

Tabs may become enabled as prerequisites are satisfied, but users must be able to return to any earlier state without losing data. The selected tab may be derived from the existing run step on first load and then maintained as local view state.

### 5.1 Handoff state

Represent current artifact readiness as rows:

- **Context screened** — included/excluded counts, warning state, file size.
- **Task + standards packet** — generated/not generated/stale state.
- **Upload set** — number of occupied Copilot slots.

Required controls and behavior:

- Prepare/regenerate context.
- Build/regenerate task packet.
- Packet preview dialog with rendered preview and source/code tabs.
- Packet copy.
- Packet download.
- Copy upload files.
- Show upload files in folder.
- Copy recommended prompt.
- Open Microsoft 365 Copilot.
- Preserve Launch URL dialog behavior if the existing launch path requires it.
- Preserve all status messages and bridge error handling.

The primary CTA should reflect the next unmet prerequisite:

- `Prepare handoff` when artifacts are absent or stale.
- `Open in Copilot` when the upload set and prompt are ready.

Never label a row Ready solely because mock data exists; readiness must derive from the same run artifacts used today.

### 5.2 Copilot state

Keep every current Run in Copilot capability:

- Display the exact upload file list and slot usage.
- Explain the three-file maximum.
- Support drag/copy guidance as currently provided.
- Copy files.
- Show files.
- Open Copilot.
- Show the recommended prompt.
- Copy the recommended prompt.
- Preserve success/failure feedback for clipboard and shell operations.
- Provide the transition/action indicating the overlay has been returned.

The Copilot state should not imply that the app can observe Copilot completion. The user explicitly returns with `ui-overlay.zip`.

### 5.3 Overlay state

Keep every current Apply Zip Overlay capability:

- Select `ui-overlay.zip`.
- Support drag/drop only if the desktop/browser bridge can do so without weakening the existing picker behavior; the picker remains available.
- Select a different zip.
- Inspect before extraction/application.
- Show inspection verdict and summary.
- Show the complete zip file tree/contents preview.
- Show hard blockers, soft warnings, conflicts, counts, and affected paths.
- Generate and copy the remediation prompt for a refused overlay.
- Link back to/open the Copilot state to obtain a corrected overlay.
- Preserve the rule that a blocked overlay can never be applied.
- Preserve explicit apply confirmation/action and all busy/error states.
- Show applied files and applied result after success.
- Enable `Continue to Test` only after a successful apply, following the same reachability rules used today.

If inspection becomes stale because a different file is selected, immediately disable Apply and clear the prior verdict.

## 6. State, gating, and staleness

Reuse the current artifact-based gates. Combining views must not turn sequential correctness requirements into purely visual tab requirements.

Minimum rules:

- Task packet generation requires prepared context where required today.
- Copilot handoff requires the same packet/context artifacts as today.
- Overlay selection does not imply inspection success.
- Apply requires a current passing inspection for the currently selected zip.
- Test remains reachable only under the same successful-apply conditions as Verify & Review today.
- Editing any task field after packet generation marks the packet/upload set stale and requires regeneration.
- Changing repository/context options marks context and all downstream artifacts stale.
- Changing the visual reference marks the upload set stale.
- Selecting another overlay clears prior inspection and apply eligibility.
- Applying a new overlay invalidates prior verification results exactly as today.

Do not discard generated artifacts or form state when switching among Handoff, Copilot, and Overlay tabs.

## 7. Test view

`VerifyReviewView` is unchanged except for:

- Page title/step label: `Test`.
- Stepper: two steps, with Test active.
- Back destination: Build, Overlay state.
- Any CTA or navigation label that names the destination should say `Build` rather than `Apply Zip Overlay` or `Create Task Packet`, while preserving the same action and prefill behavior.

No other markup, layout, component behavior, dialogs, status calculations, or copy should be changed as part of this implementation.

## 8. Suggested code organization

Avoid one monolithic component. Suggested extraction:

```text
BuildView
├── BuildTaskPanel
├── ProjectContextPanel
│   ├── ContextPrivacyDialog
│   ├── OutputUploadDialog
│   └── BeforeEvidenceDialog
└── BuildWorkspace
    ├── HandoffWorkspace
    ├── CopilotWorkspace
    └── OverlayWorkspace
```

Prefer moving/reusing the existing logic from:

- `PrepareContextView`
- `CreateTaskPacketView`
- `RunInCopilotView`
- `ApplyZipOverlayView`

Shared helpers such as packet preview, blocker remediation prompt generation, evidence capture, byte formatting, clipboard fallback, and status derivation should remain shared rather than duplicated.

## 9. Accessibility and interaction requirements

- Workspace tabs use the ARIA tabs pattern with keyboard navigation and a labelled tab panel.
- Disclosures use buttons with `aria-expanded` and `aria-controls`.
- Modal overlays use the existing `Dialog` component and retain focus trapping/restoration.
- Status changes remain announced through the existing status/live-region mechanism.
- Readiness and verdicts are never conveyed by color alone.
- Disabled Apply and Continue actions must expose clear adjacent prerequisite text.
- Maintain logical tab order: main authoring controls, context disclosures, workspace controls.
- Preserve reduced-motion behavior and current focus-visible treatment.
- At 200% zoom, all controls remain reachable without horizontal page scrolling.

## 10. Responsive behavior

- Desktop: main authoring column plus fixed-width workspace rail.
- Medium/narrow: workspace becomes a full-width section; its tabs remain available.
- Do not hide capabilities at narrow widths.
- Long repository paths, filenames, blocker paths, and warning messages wrap or scroll within bounded code areas instead of widening the page.
- Primary/secondary action groups may wrap but retain action priority.

## 11. Acceptance criteria

### Navigation and naming

- [ ] Only Build and Test appear in the workflow stepper.
- [ ] All four former pre-test routes resolve into the correct state of Build.
- [ ] Existing persisted runs open at the correct visible step/state.
- [ ] Verify & Review is named Test in page and navigation chrome.
- [ ] Test returns to Build/Overlay when navigating back.

### Capability parity

- [ ] Every interactive control available in the four former Build-related views remains reachable.
- [ ] Templates, feedback prefill, and all task fields behave identically.
- [ ] Context generation, inventory details, exclusions, warnings, formats, and evidence capture remain available.
- [ ] Packet preview/source, copy, download, regeneration, and upload-set actions remain available.
- [ ] Copilot file/prompt instructions, copying, folder reveal, and launch remain available.
- [ ] Overlay selection, re-selection, inspection, contents, blockers, remediation prompt, application, and applied-files result remain available.

### Safety and correctness

- [ ] Artifact gates are based on run state, not selected UI tab.
- [ ] A blocked overlay cannot be applied through keyboard, mouse, or direct state transition.
- [ ] Selecting a different overlay invalidates the prior inspection.
- [ ] Editing upstream inputs marks downstream artifacts stale.
- [ ] Test cannot be entered earlier than Verify & Review can be entered today.
- [ ] Applying a new overlay invalidates old verification results.

### Test page boundary

- [ ] A focused diff of `VerifyReviewView` shows only naming, stepper, and Build-destination changes.
- [ ] Verification, review cockpit, comments, evidence, preview, review packet, and launch settings are behaviorally unchanged.

### Quality

- [ ] Existing unit and end-to-end tests pass after route expectation updates.
- [ ] Add tests for legacy-step-to-Build-state mapping.
- [ ] Add tests for stale artifact invalidation in the consolidated view.
- [ ] Add tests for Overlay apply gating and Test reachability.
- [ ] Add an accessibility test for workspace tabs and context disclosures.
- [ ] Capture desktop and narrow-width screenshots for visual comparison with the approved mockup.

## 12. Implementation sequence

1. Add the two-step presentation model and legacy-step mapping without deleting existing views.
2. Extract reusable sections and handlers from the four current views.
3. Assemble `BuildView` with the main column and workspace rail.
4. Wire artifact-derived readiness, staleness, and workspace state.
5. Redirect legacy navigation into Build workspace states.
6. Change Verify & Review’s user-facing name to Test and update only its navigation chrome/destinations.
7. Update tests and perform a parity audit against the four existing views.
8. Remove dead route rendering only after parity is proven; retain reusable logic and compatibility mapping.

## 13. Cursor handoff instruction

Implement this spec against the existing React/TypeScript GUI. Treat the four current workflow views as the behavioral source of truth and the approved mockup as the layout source of truth. Before deleting or replacing any current control, produce a capability checklist mapping it to its new location. Keep `VerifyReviewView` unchanged except for the explicitly allowed naming, stepper, and navigation-destination edits. Run typecheck, unit tests, applicable desktop/e2e tests, and render both desktop and narrow Build screenshots before considering the work complete.
