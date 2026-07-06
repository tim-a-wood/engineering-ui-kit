# Task and Standards Pack

## Package Metadata

- packetId: `vertical-slice-01-phase-2`
- packetVersion: `0.1.1`
- generatedAt: `2026-07-05T14:14:46Z`
- baselineCommit: `c1419e8112d0fb9eb3bdca8fa0e3861a276ed867`
- standardsPackage: `engineering-ui-kit-standards`
- standardsVersion: `0.3.0`
- themePosture: `dark-first`
- variant: `visual/mockup`
- targetPackage: `vertical-slice-01-target-app`
- targetApplication: `UI Overlay`
- selectedProjectSample: `signal-analyzer-refresh`
- selectedProjectSamplePath: `C:\work\signal-analyzer-refresh`
- targetAppRoot: `trials/vertical-slice-01/target-app`
- screen: `Create Task Packet`
- route: `/`
- primaryVisualReference: `1F2214C9-D849-41CA-9435-68F0A0032EEB.jpeg`
- expectedOutput: `ui-overlay.zip`

## Goal

Refresh UI Overlay's Create Task Packet screen to Engineering UI Kit dark-first standards while preserving all existing domain behavior.

## Scope

- Only the Create Task Packet screen at `/`.
- The application under test is UI Overlay. The displayed
  `signal-analyzer-refresh` project is fixed selected-project sample data, not the
  application being redesigned.
- Visual hierarchy, layout, styling, and presentation.
- Existing React component structure may be reorganized only where necessary for the presentation change.
- Existing local state, serialization, validation, preview, focus-return, and export behavior remains authoritative.
- No new product feature or navigation behavior.
- No backend, persistence, network, filesystem, Electron, IPC, or API work.

## Constraints

- Preserve the five workflow steps and their names.
- Preserve current-step and completed-step semantics.
- Preserve UI Overlay application identity and selected-project sample data without
  conflating them.
- Preserve all five editable task sections.
- Preserve required-field validation.
- Preserve preview and exported Markdown content.
- Preserve `task-packet.md` as the export filename.
- Use semantic CSS custom properties traceable to the supplied token table.
- Dark-first only.
- No raw color scattering outside the supplied CSS variable definitions.
- No routers, state libraries, component libraries, CSS frameworks, chart libraries, network clients, PDF libraries, or test frameworks.
- No dependency or lockfile changes.
- No unrelated refactors.
- No success claim before local review.

## Protected Behavior

1. Edit reveals a labeled textarea prefilled with the current section value.
2. Save commits draft text to local React state.
3. Cancel restores the previous value.
4. Empty required sections produce visible validation messages.
5. Preview opens an accessible dialog containing the current packet content.
6. Escape dismisses Preview and returns focus to the Preview control where practical.
7. Close dismisses Preview and returns focus to the Preview control where practical.
8. Export downloads `task-packet.md` in the browser.
9. Exported Markdown contains Goal, Scope, Constraints, Acceptance Criteria, and References headings.
10. The app performs no network request or filesystem access.

## Acceptance Criteria

| ID | Criterion | Evidence Method | Blocking |
|---|---|---|---|
| TRIAL-AC-001 | Target app typechecks and builds successfully after overlay application. | `npm run typecheck` and `npm run build` logs | yes |
| TRIAL-AC-002 | App launches and renders Create Task Packet at `/` without runtime errors. | `npm run dev` or `npm run preview` plus browser observation | yes |
| TRIAL-AC-003 | Protected behavior is preserved: Edit/Save/Cancel, required-field validation, preview content, Escape/Close dismissal, focus return to Preview, and browser export of `task-packet.md` with the five section headings. | Manual interaction checklist | yes |
| TRIAL-AC-004 | Changed files stay within expected scope (`src/App.tsx`, `src/styles.css`, and optional token entry stylesheet). | Overlay listing and diff review | yes |
| TRIAL-AC-005 | Transformed UI uses a dark-first shell and clear visual hierarchy aligned to the engineering workbench direction. | Screenshot comparison to primary visual reference and `FND-VIS-001` | yes |
| TRIAL-AC-006 | Workflow stepper remains present with the five named steps and a clear current-step state. | Browser observation and screenshot | yes |
| TRIAL-AC-007 | Task sections remain usable: each section can be edited through a labeled control and saved or cancelled. | Manual interaction checklist | yes |
| TRIAL-AC-008 | Preview and export behavior continue to reflect current packet values and required headings. | Preview dialog inspection and exported `task-packet.md` contents | yes |
| TRIAL-AC-009 | Presentation consumes semantic tokens through CSS custom properties rather than scattered raw colors. | Stylesheet review against `tokens.json` / `ARCH-THEME-*` | yes |
| TRIAL-AC-010 | Keyboard and dialog behavior remain accessible: controls are reachable, dialog supports Escape/Close, and focus returns to Preview where practical. | Keyboard-only walkthrough | yes |
| TRIAL-AC-011 | Visible focus indicators are present on interactive controls. | Keyboard focus observation | yes |
| TRIAL-AC-012 | Status and validation are not conveyed by color alone; textual status or labels remain present. | Browser observation of validation and status regions | yes |
| TRIAL-AC-013 | Result does not drift into generic SaaS white-card styling, neon/glow decoration, light mode, or unrelated feature scope. | Visual drift checklist and diff review | yes |

## References

- Target selection: `trials/vertical-slice-01/target-selection.md`
- Acceptance criteria: `trials/vertical-slice-01/acceptance-criteria.md`
- Baseline record: `trials/vertical-slice-01/baseline.md`
- Baseline screenshots: `trials/vertical-slice-01/baseline/`
- Primary visual JPEG: `project-sources/visual-references/1F2214C9-D849-41CA-9435-68F0A0032EEB.jpeg`
- Historical labels visible inside the approved mockup belong to an earlier UI
  Overlay working copy. They do not identify the application under test or the
  selected project.
- Three-file strategy: `standards/copilot-handoff/three-file-upload-strategy.md`
- Combined-pack contract: `standards/copilot-handoff/contracts/task-and-standard-pack-contract.md`
- Overlay contract: `standards/copilot-handoff/contracts/ui-overlay-contract.md`
- Implementation prompt: `standards/prompts/implementation-prompt.md`
- The PDF is visual calibration, not exhaustive component or company-wide design authority.

## Expected Changed Files

The expected overlay scope is:

```text
src/App.tsx
src/styles.css
src/tokens.css   # optional; new only, and only when imported by the app
```

- `src/tokens.css` is optional, not required.
- No other changed file is expected.
- An overlay entry outside this list is at least a warning.
- Any behavior or dependency file change requires explicit human rejection or justification under later overlay review.

## Forbidden Changes

Do not change:

```text
src/taskPacket.ts
src/main.tsx
src/vite-env.d.ts
index.html
package.json
package-lock.json
tsconfig.app.json
tsconfig.json
tsconfig.node.json
vite.config.ts
```

Also forbid:

- Deletions.
- Full-repo output.
- `.git/`, dependencies, caches, build output, environment files, credentials, or archives nested inside the output.
- Light mode.
- Generic SaaS white-card styling.
- Decorative neon/glow treatment.
- New features or routes.
- Behavior changes hidden as presentation changes.

## Required Output

- Return one file named `ui-overlay.zip`.
- Include changed and new files only.
- Use paths relative to the target-app root.
- Include no process-summary file unless it is outside the zip in ordinary response text.
- Include no deletion semantics.
- Do not return a full repository.
- Do not claim the overlay was locally verified.

## Verification Expectations

The later human workflow shall run:

```bash
npm run typecheck
npm run build
```

Also require manual verification of:

- Launch at `/`.
- Edit/Save/Cancel.
- Required-field validation.
- Current-value preview.
- Escape dismissal.
- Close dismissal.
- Focus return.
- Exported filename and five Markdown headings.
- Keyboard traversal and visible focus.
- Status not conveyed by color alone.
- Visual comparison with the primary PDF page.

Copilot may reason about these checks but shall not claim to have run local commands it cannot execute.

## Source Precedence

1. Combined task and standards pack for task scope.
2. Stable-ID standards excerpts and token mappings.
3. Labeled PDF for visual calibration.
4. Repo flatfile for implementation context.
5. No historical chat assumptions.

## Applicable Rule IDs

- `FND-VIS-001`
- `FND-VIS-002`
- `FND-VIS-003`
- `FND-VIS-004`
- `FND-VIS-005`
- `FND-VIS-006`
- `FND-VIS-009`
- `FND-VIS-010`
- `FND-TOK-001`
- `FND-TOK-003`
- `FND-TOK-004`
- `FND-TOK-006`
- `FND-TOK-007`
- `FND-TOK-008`
- `FND-TOK-009`
- `FND-TOK-010`
- `FND-TOK-011`
- `FND-TOK-012`
- `FND-TOK-013`
- `FND-TOK-014`
- `FND-A11Y-001`
- `FND-A11Y-002`
- `FND-A11Y-003`
- `FND-A11Y-004`
- `FND-A11Y-005`
- `FND-A11Y-006`
- `FND-A11Y-007`
- `FND-A11Y-009`
- `FND-A11Y-011`
- `FND-A11Y-012`
- `LAY-SHELL-001`
- `RCP-WORKFLOW-001`
- `ARCH-FE-001`
- `ARCH-FE-002`
- `ARCH-FE-003`
- `ARCH-FE-004`
- `ARCH-FE-005`
- `ARCH-FE-006`
- `ARCH-FE-007`
- `ARCH-THEME-001`
- `ARCH-THEME-002`
- `ARCH-THEME-003`
- `ARCH-THEME-004`
- `ARCH-THEME-005`
- `ARCH-THEME-006`
- `ARCH-THEME-007`
- `ARCH-STATE-001`
- `ARCH-STATE-002`
- `ARCH-STATE-003`
- `ARCH-STATE-004`
- `ARCH-STATE-005`
- `ARCH-STATE-006`
- `ARCH-STATE-007`
- `ARCH-FILE-001`
- `ARCH-FILE-002`
- `ARCH-FILE-003`
- `ARCH-FILE-004`
- `ARCH-FILE-005`
- `ARCH-FILE-006`

## Applicable Component IDs

- `CMP-SHELL-APP`
- `CMP-NAV-PRIMARY`
- `CMP-SHELL-PAGE-HEADER`
- `CMP-SURFACE-PANEL`
- `CMP-WORKFLOW-STEP-INDICATOR`
- `CMP-FORM-FIELD`
- `CMP-FORM-TEXTAREA`
- `CMP-OVERLAY-DIALOG`
- `CMP-FEEDBACK-VALIDATION-SUMMARY`
- `CMP-FEEDBACK-ALERT`

## Applicable Token Paths and Values

| Token path | Resolved value | Required use |
|---|---|---|
| `semantic.surface.canvas` | `#07111f` | Root app canvas background |
| `semantic.surface.panel` | `#0f172a` | Primary task and summary panels |
| `semantic.surface.panelRaised` | `#111827` | Emphasized summary or action regions |
| `semantic.surface.inset` | `#172033` | Inset technical content and monospaced paths |
| `semantic.surface.overlay` | `#0f172a` | Preview dialog surface |
| `semantic.surface.scrim` | `rgba(2, 6, 23, 0.72)` | Modal backdrop behind preview dialog |
| `semantic.text.primary` | `#f8fafc` | Primary headings and body text |
| `semantic.text.secondary` | `#cbd5e1` | Supporting labels and metadata |
| `semantic.text.muted` | `#94a3b8` | Secondary helper and step labels |
| `semantic.text.disabled` | `rgba(203, 213, 225, 0.38)` | Disabled control text |
| `semantic.text.inverse` | `#07111f` | Text on accent-filled controls |
| `semantic.border.subtle` | `rgba(148, 163, 184, 0.18)` | Default panel and field borders |
| `semantic.border.strong` | `rgba(203, 213, 225, 0.34)` | Stronger section separators |
| `semantic.border.focus` | `#22d3ee` | Focus outline color |
| `semantic.border.danger` | `#ef4444` | Validation error borders |
| `semantic.focus.ring` | `0 0 0 2px #22d3ee` | Visible focus ring on interactive controls |
| `semantic.focus.ringOffset` | `0 0 0 4px rgba(34, 211, 238, 0.16)` | Focus ring offset halo |
| `semantic.accent.primary` | `#22d3ee` | Primary actions and active navigation |
| `semantic.accent.primaryHover` | `#67e8f9` | Primary action hover state |
| `semantic.accent.primaryActive` | `#0891b2` | Primary action pressed state |
| `semantic.accent.secondary` | `#a78bfa` | Secondary technical accent only when needed |
| `semantic.accent.glow` | `rgba(34, 211, 238, 0.22)` | Restrained selected/focus emphasis only, never decoration |
| `semantic.status.success` | `#34d399` | Success status text and indicators |
| `semantic.status.warning` | `#fbbf24` | Warning status text and indicators |
| `semantic.status.danger` | `#f87171` | Error and validation status text |
| `semantic.status.info` | `#60a5fa` | Informational status text |
| `semantic.status.neutral` | `#94a3b8` | Neutral status text |
| `semantic.spacing.1` | `4px` | Tight internal gaps |
| `semantic.spacing.2` | `8px` | Compact control spacing |
| `semantic.spacing.3` | `12px` | Field and label spacing |
| `semantic.spacing.4` | `16px` | Panel internal padding baseline |
| `semantic.spacing.5` | `20px` | Section spacing |
| `semantic.spacing.6` | `24px` | Major region gaps |
| `semantic.spacing.8` | `32px` | Shell and page-level spacing |
| `semantic.density.compact.controlHeight` | `32px` | Compact control height for dense workflow |
| `semantic.density.compact.panelPadding` | `16px` | Compact panel padding |
| `semantic.density.comfortable.controlHeight` | `40px` | Comfortable control height where needed |
| `semantic.radius.sm` | `4px` | Small control radius |
| `semantic.radius.md` | `8px` | Panel and field radius |
| `semantic.radius.lg` | `12px` | Dialog and raised surface radius |
| `semantic.shadow.sm` | `0 1px 2px rgba(0, 0, 0, 0.22)` | Light elevation only where hierarchy needs it |
| `semantic.shadow.md` | `0 10px 24px rgba(0, 0, 0, 0.28)` | Moderate elevation for raised panels |
| `semantic.shadow.overlay` | `0 24px 72px rgba(0, 0, 0, 0.46)` | Dialog elevation |
| `semantic.typography.family.sans` | `Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif` | UI sans-serif family |
| `semantic.typography.family.mono` | `JetBrains Mono, SFMono-Regular, Consolas, Liberation Mono, monospace` | Project paths and technical identifiers |
| `semantic.typography.size.sm` | `13px` | Secondary and metadata text size |
| `semantic.typography.size.md` | `14px` | Default body and control text size |
| `semantic.typography.size.lg` | `16px` | Page and section headings |
| `semantic.typography.weight.regular` | `400` | Body text weight |
| `semantic.typography.weight.medium` | `500` | Labels and secondary emphasis |
| `semantic.typography.weight.semibold` | `600` | Headings and active labels |
| `semantic.motion.durationFast` | `120ms` | Fast hover/focus transitions |
| `semantic.motion.durationNormal` | `180ms` | Normal dialog and state transitions |
| `semantic.motion.easingStandard` | `cubic-bezier(0.2, 0, 0, 1)` | Standard motion easing |
| `semantic.zIndex.overlay` | `700` | Scrim stacking order |
| `semantic.zIndex.modal` | `800` | Dialog stacking order |

## Approved Guidance

- Dark engineering workbench.
- Restrained technical accent.
- Dark canvas with bounded panel hierarchy.
- Stable left navigation and visible active state.
- Concise page header.
- Clear five-step workflow status.
- Compact but readable task panels.
- Monospaced project paths and technical identifiers.
- Primary action hierarchy.
- Explicit validation and status text.
- Semantic CSS variables.
- Dialog with overlay surface, scrim, focus containment, Escape, and focus return.
- Borders and spacing doing more hierarchy work than heavy shadows.

## Rejected Guidance

- Light mode.
- Generic white-card dashboard.
- Marketing hero layout.
- Arbitrary gradients.
- Cyberpunk or decorative neon.
- Glow on every panel.
- Glassmorphism.
- Huge display typography.
- Hidden project metadata.
- Icon-only unlabeled controls.
- Raw repeated colors instead of token variables.
- Workflow steps used as decorative tabs.
- One-click automation that hides validation or review.

## Accessibility Requirements

- Target WCAG 2.2 AA.
- Use semantic landmarks, headings, lists, buttons, and labels.
- Support complete keyboard operation.
- Provide visible focus using the supplied focus tokens.
- Expose active navigation semantically.
- Associate textarea labels and validation relationships.
- Provide error summary/text in addition to color.
- Provide dialog title, modal semantics, focus containment, Escape, and focus restoration.
- Use reduced-motion-safe transitions.
- Keep dense controls readable with practical target sizes.

## Standards Excerpts

### FND-VIS-001 — Dark-first surface hierarchy

Implementations shall use semantic surface tokens to create hierarchy: `semantic.surface.canvas` for the root canvas, `semantic.surface.panel` for ordinary bounded regions, `semantic.surface.panelRaised` for emphasized cards, `semantic.surface.inset` for embedded technical content, and `semantic.surface.overlay` for dialogs and drawers.

Source: `standards/foundation/visual-language.md`
### FND-VIS-002 — Restrained technical accent usage

Accent color shall identify primary actions, focus, active navigation, selected state, or important technical affordances. `semantic.accent.glow` may be used sparingly around active or focused regions; it shall not become decorative neon styling.

Source: `standards/foundation/visual-language.md`
### FND-VIS-003 — Panel and card discipline

Panels shall group related engineering content with clear headers, borders, and spacing. Raised cards shall be used for summaries or key decisions. Inset panels shall be used for code, logs, tabular subregions, or technical data that belongs inside a parent panel.

Source: `standards/foundation/visual-language.md`
### FND-VIS-004 — Typography posture

Typography shall prioritize scanability and technical precision. Use semantic typography tokens, short headings, stable artifact names, and monospaced treatment for code, paths, commands, and IDs.

Source: `standards/foundation/visual-language.md`
### FND-VIS-005 — Density and spacing posture

Compact density is allowed when content remains readable. Use `semantic.density.compact.*` and `semantic.spacing.*` tokens instead of arbitrary compression. Primary workflow regions should have enough padding to distinguish them from nested technical content.

Source: `standards/foundation/visual-language.md`
### FND-VIS-006 — Borders, elevation, and glow

Borders shall define hierarchy more often than heavy shadows. `semantic.border.subtle` is the default; `semantic.border.strong` is reserved for selected, active, or high-emphasis boundaries. Elevation and glow shall support state, not decoration.

Source: `standards/foundation/visual-language.md`
### FND-VIS-009 — Status and severity color discipline

Status colors shall be used with text labels and icons or shapes where useful. Pass/fail, warning, blocked, and running states shall not rely on color alone, and screens shall avoid traffic-light noise from excessive severity badges.

Source: `standards/foundation/visual-language.md`
### FND-VIS-010 — What visual drift looks like

Drift includes generic light cards, arbitrary gradients, excessive glassmorphism, cyberpunk neon, huge marketing typography, placeholder wireframes, hidden metadata, inconsistent borders, and raw colors that bypass tokens.

Source: `standards/foundation/visual-language.md`
### FND-TOK-001 — Use semantic tokens in component and page guidance

Component and layout guidance shall reference semantic tokens such as `{semantic.surface.panel}` rather than primitive values.

Source: `standards/foundation/tokens.md`
### FND-TOK-003 — Raw color values are not allowed in component specs

Component and page specs shall not use raw hex, RGB, HSL, or named color values where a token exists.

Source: `standards/foundation/tokens.md`
### FND-TOK-004 — Dark mode is normative

The dark token mode is the normative Phase 3 theme. Reviewers shall treat dark-first drift as a material issue.

Source: `standards/foundation/tokens.md`
### FND-TOK-006 — Surface tokens

Use `semantic.surface.canvas`, `semantic.surface.panel`, `semantic.surface.panelRaised`, `semantic.surface.inset`, `semantic.surface.overlay`, and `semantic.surface.scrim` to express hierarchy.

Source: `standards/foundation/tokens.md`
### FND-TOK-007 — Text tokens

Use `semantic.text.primary`, `semantic.text.secondary`, `semantic.text.muted`, `semantic.text.disabled`, and `semantic.text.inverse` based on content importance.

Source: `standards/foundation/tokens.md`
### FND-TOK-008 — Border and focus tokens

Use `semantic.border.subtle`, `semantic.border.strong`, `semantic.border.focus`, `semantic.border.danger`, `semantic.focus.ring`, and `semantic.focus.ringOffset` for boundaries and focus.

Source: `standards/foundation/tokens.md`
### FND-TOK-009 — Accent tokens

Use `semantic.accent.primary`, `semantic.accent.primaryHover`, `semantic.accent.primaryActive`, `semantic.accent.secondary`, and `semantic.accent.glow` only for active, selected, focus, or primary-command emphasis.

Source: `standards/foundation/tokens.md`
### FND-TOK-010 — Status tokens

Use `semantic.status.success`, `semantic.status.warning`, `semantic.status.danger`, `semantic.status.info`, `semantic.status.neutral`, `semantic.status.running`, and `semantic.status.pending` with text labels.

Source: `standards/foundation/tokens.md`
### FND-TOK-011 — Spacing and density tokens

Use `semantic.spacing.*` for general spacing and `semantic.density.compact.*` / `semantic.density.comfortable.*` for controls, rows, and panel padding.

Source: `standards/foundation/tokens.md`
### FND-TOK-012 — Radius and shadow tokens

Use `semantic.radius.*` and `semantic.shadow.*` for bounded surfaces. Avoid creating local radii or shadow values.

Source: `standards/foundation/tokens.md`
### FND-TOK-013 — Typography tokens

Use `semantic.typography.family.*`, `semantic.typography.size.*`, and `semantic.typography.weight.*`. Use monospaced typography for code, paths, IDs, commands, and log fragments.

Source: `standards/foundation/tokens.md`
### FND-TOK-014 — Motion and z-index tokens

Use `semantic.motion.*` and `semantic.zIndex.*`. Motion shall clarify state; z-index shall follow overlay, modal, and toast rules.

Source: `standards/foundation/tokens.md`
### FND-A11Y-001 — WCAG 2.2 AA target

Implemented UI shall target WCAG 2.2 AA for contrast, keyboard operation, focus visibility, semantics, labels, errors, and motion.

Source: `standards/foundation/accessibility.md`
### FND-A11Y-002 — Keyboard access

All interactive components shall be reachable and operable by keyboard. Custom composites shall follow established keyboard patterns for menus, dialogs, tabs, grids, comboboxes, and popovers.

Source: `standards/foundation/accessibility.md`
### FND-A11Y-003 — Visible focus

Focus shall be visible using `{semantic.focus.ring}` and shall not be hidden by shadows, overlays, clipping, or disabled-looking styles.

Source: `standards/foundation/accessibility.md`
### FND-A11Y-004 — Semantic structure

Pages shall use meaningful headings, regions, labels, lists, tables, and buttons. Generic clickable containers shall not replace semantic controls.

Source: `standards/foundation/accessibility.md`
### FND-A11Y-005 — Accessible names and descriptions

Icon-only buttons, status icons, inputs, charts, controls, menus, and dialogs shall expose accessible names. Additional descriptions shall be used when consequences or context are not clear from the name.

Source: `standards/foundation/accessibility.md`
### FND-A11Y-006 — Color is not the only status signal

Critical status shall include text, icon, shape, or structural cues in addition to color.

Source: `standards/foundation/accessibility.md`
### FND-A11Y-007 — Dialog and overlay behavior

Blocking dialogs shall trap focus, provide an accessible title, support Escape where safe, and restore focus to the invoking control when closed.

Source: `standards/foundation/accessibility.md`
### FND-A11Y-009 — Forms and validation

Fields shall have visible labels or equivalent accessible names. Errors shall be linked to fields and summarized when multiple fields are invalid.

Source: `standards/foundation/accessibility.md`
### FND-A11Y-011 — Motion and reduced motion

Motion shall respect reduced-motion preferences and shall not be required to understand status or workflow progress.

Source: `standards/foundation/accessibility.md`
### FND-A11Y-012 — Target sizes and dense UI exceptions

Dense engineering UI may use compact spacing, but frequently used actions, destructive actions, and touch-adjacent controls should preserve adequate target size and spacing.

Source: `standards/foundation/accessibility.md`
### LAY-SHELL-001 — Standard engineering app shell

The shell shall provide stable orientation, visible app context, and a predictable place for navigation, page metadata, commands, and status.

Source: `standards/layouts-and-recipes/application-shell.md`
### RCP-WORKFLOW-001 — Multi-step engineering workflow

Guide users through ordered technical work while preserving reviewability and explicit status.

Source: `standards/layouts-and-recipes/workflow-pages.md`
### ARCH-FE-001 — View, component, and module boundaries

Keep presentation in view modules such as `App.tsx`. Keep serializable domain behavior, sample data, validation, and Markdown export in dedicated modules such as `taskPacket.ts`. Do not bury packet rules inside CSS or presentational markup.

Source: `standards/reference-architecture/frontend-architecture.md`
### ARCH-FE-002 — React state ownership

Own interactive UI state in the nearest React view that needs it. For the trial, `App.tsx` owns edit mode, draft values, dialog visibility, and status messages. `taskPacket.ts` owns the packet shape and pure functions that derive validation and export content.

Source: `standards/reference-architecture/frontend-architecture.md`
### ARCH-FE-003 — DOM and accessibility posture

Use semantic HTML for shell, navigation, headings, lists, forms, status, and dialogs. Interactive controls must be keyboard reachable, expose visible focus, and convey status with text as well as color. Dialogs must support Escape and Close dismissal and return focus to the invoking control where practical.

Source: `standards/reference-architecture/frontend-architecture.md`
### ARCH-FE-004 — TypeScript strictness

Trial and future renderer code shall use TypeScript strict mode. Public packet and validation types must be explicit. Avoid `any` for packet state, validation results, or export helpers.

Source: `standards/reference-architecture/frontend-architecture.md`
### ARCH-FE-005 — Serialization separated from presentation

Task-packet types, sample data, validation, and Markdown serialization shall live outside visual components. Presentation may call those functions but must not redefine section headings, required-field rules, or export filenames.

Source: `standards/reference-architecture/frontend-architecture.md`
### ARCH-FE-006 — Future Electron renderer constraints

When an Electron shell is introduced later, renderer code remains a React/Vite UI. Filesystem, process, and privileged operations must cross a typed boundary owned by the main or preload layer. Do not import Node-only APIs into trial or renderer UI modules during Phase 1.

Source: `standards/reference-architecture/frontend-architecture.md`
### ARCH-FE-007 — No domain behavior in visual-only components

Visual components may render labels, layout, and controls. They must not invent acceptance criteria, alter protected behavior, or silently change export content.

Source: `standards/reference-architecture/frontend-architecture.md`
### ARCH-THEME-001 — Semantic tokens as CSS custom properties

Map semantic token leaves from `tokens.json` to CSS custom properties. Component and page styles shall reference those variables, not primitive palette literals, except inside the single token entry point.

Source: `standards/reference-architecture/styling-and-theming.md`
### ARCH-THEME-002 — Primitive-to-semantic-to-component layering

Do not skip the semantic layer by wiring components directly to primitives.

Source: `standards/reference-architecture/styling-and-theming.md`
### ARCH-THEME-003 — One global token entry point

Introduce one global stylesheet or module that defines the semantic CSS variables for the app. Trial transformation should add or replace that entry point rather than scattering token declarations across unrelated files.

Source: `standards/reference-architecture/styling-and-theming.md`
### ARCH-THEME-004 — Components consume semantic variables

Buttons, panels, navigation, workflow markers, status regions, and dialogs shall use semantic variables for color, border, spacing density, and focus treatment.

Source: `standards/reference-architecture/styling-and-theming.md`
### ARCH-THEME-005 — Raw color restrictions

Raw hex, `rgb()`, or named colors outside the token entry point are review findings unless they are part of a documented visualization scale that cannot yet be expressed as a semantic token. Baseline plain styling is allowed only before the transformation trial.

Source: `standards/reference-architecture/styling-and-theming.md`
### ARCH-THEME-006 — Focus, status, density, and reduced motion

Focus indicators must remain visible and must not rely on color alone. Status and validation must include text or iconography in addition to color. Density should favor readable engineering workbench spacing over marketing sparsity.

Source: `standards/reference-architecture/styling-and-theming.md`
### ARCH-THEME-007 — No light-mode implementation in v0.1

Do not add a light theme, theme toggle, or light-mode token set during the trial. Dark-first is the only supported transformed posture.

Source: `standards/reference-architecture/styling-and-theming.md`
### ARCH-STATE-001 — Local UI state

Transient interaction state such as edit mode, draft text, dialog open/closed, and status messages belongs in local React state owned by the view.

Source: `standards/reference-architecture/state-and-data-flow.md`
### ARCH-STATE-002 — Serializable task-packet state

Task-packet section values must be plain serializable data. The trial packet contains string fields for Goal, Scope, Constraints, Acceptance Criteria, and References.

Source: `standards/reference-architecture/state-and-data-flow.md`
### ARCH-STATE-003 — Derived validation state

Validation results are derived from current packet values through pure functions. Do not store a separate mutable “isValid” flag that can drift from the packet.

Source: `standards/reference-architecture/state-and-data-flow.md`
### ARCH-STATE-004 — Immutable update expectations

Updates replace packet fields immutably. Save commits the draft into packet state. Cancel discards the draft and restores the previous committed value.

Source: `standards/reference-architecture/state-and-data-flow.md`
### ARCH-STATE-005 — No global state library for the trial

Do not introduce Redux, Zustand, MobX, Recoil, or similar libraries in the Phase 1 target app. Local React state is sufficient.

Source: `standards/reference-architecture/state-and-data-flow.md`
### ARCH-STATE-006 — Future backend data crosses a typed IPC boundary

When privileged or remote data is introduced later, it must enter the renderer through an explicit typed contract. Renderer code must not reach directly into OS filesystem or process APIs.

Source: `standards/reference-architecture/state-and-data-flow.md`
### ARCH-STATE-007 — Error and stale-state ownership

The view owns user-visible status and validation messages. Serialization helpers may return data or throw only for programming errors. Do not silently swallow validation failures.

Source: `standards/reference-architecture/state-and-data-flow.md`
### ARCH-FILE-001 — Application naming

Use lowercase path segments and descriptive filenames. Trial app source files use camelCase or PascalCase TypeScript names (`taskPacket.ts`, `App.tsx`) and a single baseline stylesheet (`styles.css`).

Source: `standards/reference-architecture/file-and-folder-conventions.md`
### ARCH-FILE-002 — Standards package naming

Standards documents use kebab-case Markdown filenames. Stable rule IDs remain inside document content and must not be renamed casually. Machine-readable contracts remain at `standards/tokens.json` and `standards/component-manifest.json`.

Source: `standards/reference-architecture/file-and-folder-conventions.md`
### ARCH-FILE-003 — Component, utility, contract, and trial-fixture placement

Presentation and interaction: target-app `src/` view files. Domain utilities: target-app modules such as `taskPacket.ts`. Artifact contracts: `standards/copilot-handoff/contracts/`.

Source: `standards/reference-architecture/file-and-folder-conventions.md`
### ARCH-FILE-004 — Generated artifacts separated from source

Handoff outputs such as `repo-flatfile.txt`, compiled packs, and `ui-overlay.zip` are generated artifacts. Store them in an explicit export or trial-output location, not mixed into standards source or committed as if they were authored standards.

Source: `standards/reference-architecture/file-and-folder-conventions.md`
### ARCH-FILE-005 — No generated handoff artifacts in a target repo by default

Do not write generated packet files into the target application tree unless the user explicitly exports them there. The trial app may download `task-packet.md` in the browser without persisting it into source control.

Source: `standards/reference-architecture/file-and-folder-conventions.md`
### ARCH-FILE-006 — Future monorepo boundaries

Future packages may include standards consumption helpers, a core library, and an Electron shell. Phase 1 must not create those packages. Keep the trial app disposable and self-contained.

Source: `standards/reference-architecture/file-and-folder-conventions.md`
### CMP-SHELL-APP — App Shell

CMP-SHELL-APP defines a persistent application frame for dark-first engineering workflows. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

Source: `standards/components/navigation.md`
### CMP-NAV-PRIMARY — Primary Navigation

CMP-NAV-PRIMARY defines top-level movement between major application areas. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

Source: `standards/components/navigation.md`
### CMP-SHELL-PAGE-HEADER — Page Header

CMP-SHELL-PAGE-HEADER defines a consistent title, subtitle, metadata, and page action region. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

Source: `standards/components/navigation.md`
### CMP-SURFACE-PANEL — Panel

CMP-SURFACE-PANEL defines a default bounded container for related engineering UI content. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

Source: `standards/components/component-specs.md`
### CMP-WORKFLOW-STEP-INDICATOR — Step Indicator

CMP-WORKFLOW-STEP-INDICATOR defines visible progress through a multi-step workflow. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

Source: `standards/components/feedback-and-status.md`
### CMP-FORM-FIELD — Form Field

CMP-FORM-FIELD defines a label, description, control, error, and helper-text wrapper. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

Source: `standards/components/forms.md`
### CMP-FORM-TEXTAREA — Textarea

CMP-FORM-TEXTAREA defines multi-line free-text entry for notes, comments, and descriptions. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

Source: `standards/components/forms.md`
### CMP-OVERLAY-DIALOG — Dialog

CMP-OVERLAY-DIALOG defines blocking overlay for focused decisions or forms. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

Source: `standards/components/overlays-and-dialogs.md`
### CMP-FEEDBACK-VALIDATION-SUMMARY — Validation Summary

CMP-FEEDBACK-VALIDATION-SUMMARY defines summary of validation errors, warnings, and blocker status. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

Source: `standards/components/feedback-and-status.md`
### CMP-FEEDBACK-ALERT — Alert

CMP-FEEDBACK-ALERT defines prominent message for important contextual feedback. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

Source: `standards/components/feedback-and-status.md`

## Copilot Response Requirements

- Inspect all three files before proposing changes.
- Report missing or conflicting information rather than guessing.
- Keep changes inside expected scope.
- Return only `ui-overlay.zip` as the file artifact.
- Mention any limitation in response text.
- Do not claim local verification.
- Do not include dependencies, build output, source repository snapshots, or secrets.
