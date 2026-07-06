# Copy-Paste Implementation Prompt

Paste the following message into Microsoft 365 Copilot after uploading exactly the three files in `packet/`. Do not upload this prompt file.

---

You are implementing a focused UI transformation for `UI Overlay / vertical-slice-01-target-app`. The displayed `signal-analyzer-refresh` project is selected-project sample data only; it is not the application being redesigned.

Before editing anything, inspect all three uploaded inputs:

1. `repo-flatfile.txt`
2. `task-and-standard-pack.md`
3. `visual-reference-pack.pdf`

Task goal:

Refresh UI Overlay's Create Task Packet screen to Engineering UI Kit dark-first standards while preserving all existing domain behavior.

Expected changed files:

`src/App.tsx`, `src/styles.css`, and optional new `src/tokens.css` only

Protected behavior that must not change:

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

Acceptance criteria:

- `TRIAL-AC-001` (blocking): Target app typechecks and builds successfully after overlay application. Evaluate this criterion as blocking.
- `TRIAL-AC-002` (blocking): App launches and renders Create Task Packet at `/` without runtime errors. Evaluate this criterion as blocking.
- `TRIAL-AC-003` (blocking): Protected behavior is preserved (Edit/Save/Cancel, validation, preview, Escape/Close, focus return, export). Evaluate this criterion as blocking.
- `TRIAL-AC-004` (blocking): Changed files stay within expected scope (`src/App.tsx`, `src/styles.css`, optional token stylesheet). Evaluate this criterion as blocking.
- `TRIAL-AC-005` (blocking): Transformed UI uses a dark-first shell and clear visual hierarchy. Evaluate this criterion as blocking.
- `TRIAL-AC-006` (blocking): Workflow stepper remains present with five named steps and clear current-step state. Evaluate this criterion as blocking.
- `TRIAL-AC-007` (blocking): Task sections remain usable through labeled edit/save/cancel controls. Evaluate this criterion as blocking.
- `TRIAL-AC-008` (blocking): Preview and export reflect current packet values and required headings. Evaluate this criterion as blocking.
- `TRIAL-AC-009` (blocking): Presentation consumes semantic tokens through CSS custom properties. Evaluate this criterion as blocking.
- `TRIAL-AC-010` (blocking): Keyboard and dialog behavior remain accessible. Evaluate this criterion as blocking.
- `TRIAL-AC-011` (blocking): Visible focus indicators are present on interactive controls. Evaluate this criterion as blocking.
- `TRIAL-AC-012` (blocking): Status and validation are not conveyed by color alone. Evaluate this criterion as blocking.
- `TRIAL-AC-013` (blocking): Result does not drift into generic SaaS, neon/glow, light mode, or unrelated features. Evaluate this criterion as blocking.

Applicable standard, component, layout, and token IDs:

`FND-VIS-001`, `FND-VIS-002`, `FND-VIS-003`, `FND-VIS-004`, `FND-VIS-005`, `FND-VIS-006`, `FND-VIS-009`, `FND-VIS-010`, `FND-TOK-001`, `FND-TOK-003`, `FND-TOK-004`, `FND-TOK-006`, `FND-TOK-007`, `FND-TOK-008`, `FND-TOK-009`, `FND-TOK-010`, `FND-TOK-011`, `FND-TOK-012`, `FND-TOK-013`, `FND-TOK-014`, `FND-A11Y-001`, `FND-A11Y-002`, `FND-A11Y-003`, `FND-A11Y-004`, `FND-A11Y-005`, `FND-A11Y-006`, `FND-A11Y-007`, `FND-A11Y-009`, `FND-A11Y-011`, `FND-A11Y-012`, `LAY-SHELL-001`, `RCP-WORKFLOW-001`, `ARCH-FE-001`, `ARCH-FE-002`, `ARCH-FE-003`, `ARCH-FE-004`, `ARCH-FE-005`, `ARCH-FE-006`, `ARCH-FE-007`, `ARCH-THEME-001`, `ARCH-THEME-002`, `ARCH-THEME-003`, `ARCH-THEME-004`, `ARCH-THEME-005`, `ARCH-THEME-006`, `ARCH-THEME-007`, `ARCH-STATE-001`, `ARCH-STATE-002`, `ARCH-STATE-003`, `ARCH-STATE-004`, `ARCH-STATE-005`, `ARCH-STATE-006`, `ARCH-STATE-007`, `ARCH-FILE-001`, `ARCH-FILE-002`, `ARCH-FILE-003`, `ARCH-FILE-004`, `ARCH-FILE-005`, `ARCH-FILE-006`, `CMP-SHELL-APP`, `CMP-NAV-PRIMARY`, `CMP-SHELL-PAGE-HEADER`, `CMP-SURFACE-PANEL`, `CMP-WORKFLOW-STEP-INDICATOR`, `CMP-FORM-FIELD`, `CMP-FORM-TEXTAREA`, `CMP-OVERLAY-DIALOG`, `CMP-FEEDBACK-VALIDATION-SUMMARY`, `CMP-FEEDBACK-ALERT`

Primary visual reference:

`visual-reference-pack.pdf`, page label `Create Task Packet`, source `1F2214C9-D849-41CA-9435-68F0A0032EEB.jpeg`

Hard requirements:

- Constrain changes to the expected files and task scope only.
- Preserve domain behavior and protected interactions.
- Implement dark-first styling with semantic tokens as CSS custom properties.
- Do not implement light mode.
- Use the primary visual page as calibration, not as an exhaustive component catalog.
- Preserve or improve accessibility: keyboard access, visible focus, labeled controls, dialog Escape/Close, focus return, and status text that is not color-only.
- Return only `ui-overlay.zip` containing changed and new files with repo-relative paths.
- Do not return a full repository, `.git` content, dependencies, build output, or secrets.
- Do not add routers, state libraries, component libraries, network clients, Electron code, or unrelated refactors.
- If requirements are missing or conflicting, report limitations instead of inventing them.
- Do not claim success. Local verification remains mandatory:

`npm run typecheck`; `npm run build`; manually verify launch at `/`, Edit/Save/Cancel, required-field validation, current-value preview, Escape dismissal, Close dismissal, focus return, exported filename and five Markdown headings, keyboard traversal and visible focus, status not conveyed by color alone, and visual comparison with the primary PDF page.
