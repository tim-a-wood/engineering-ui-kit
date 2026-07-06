# Implementation Prompt

## Intent

Guide a Microsoft 365 Copilot implementation pass for the Engineering UI Kit
vertical-slice trial using exactly three uploaded files and a returned
`ui-overlay.zip`.

## Canonical Variable Markers

Only these markers are used. Substitute them before upload.

```text
{{PROJECT_NAME}}
{{TASK_GOAL}}
{{EXPECTED_CHANGED_FILES}}
{{PROTECTED_BEHAVIOR}}
{{ACCEPTANCE_CRITERIA}}
{{APPLICABLE_STANDARD_IDS}}
{{PRIMARY_VISUAL_REFERENCE}}
{{VERIFICATION_COMMANDS}}
```

## Canonical Prompt

You are implementing a focused UI transformation for `{{PROJECT_NAME}}`.

Before editing anything, inspect all three uploaded inputs:

1. `repo-flatfile.txt`
2. `task-and-standard-pack.md` or the text-only task and standards pair when that
   variant is used
3. `visual-reference-pack.pdf` when present, otherwise `standards-pack.md`

Task goal:

{{TASK_GOAL}}

Expected changed files:

{{EXPECTED_CHANGED_FILES}}

Protected behavior that must not change:

{{PROTECTED_BEHAVIOR}}

Acceptance criteria:

{{ACCEPTANCE_CRITERIA}}

Applicable standard, component, layout, and token IDs:

{{APPLICABLE_STANDARD_IDS}}

Primary visual reference:

{{PRIMARY_VISUAL_REFERENCE}}

Hard requirements:

- Constrain changes to the expected files and task scope only.
- Preserve domain behavior and protected interactions.
- Implement dark-first styling with semantic tokens as CSS custom properties.
- Do not implement light mode.
- Use the primary visual page as calibration, not as an exhaustive component catalog.
- Preserve or improve accessibility: keyboard access, visible focus, labeled controls,
  dialog Escape/Close, focus return, and status text that is not color-only.
- Return only `ui-overlay.zip` containing changed and new files with repo-relative
  paths.
- Do not return a full repository, `.git` content, dependencies, build output, or
  secrets.
- Do not add routers, state libraries, component libraries, network clients, Electron
  code, or unrelated refactors.
- If requirements are missing or conflicting, report limitations instead of inventing
  them.
- Do not claim success. Local verification remains mandatory:

{{VERIFICATION_COMMANDS}}

## Vertical Slice 01 Substituted Dry Run

```text
{{PROJECT_NAME}} = UI Overlay / trials/vertical-slice-01/target-app (selected-project sample: signal-analyzer-refresh)
{{TASK_GOAL}} = Refresh UI Overlay's Create Task Packet screen to Engineering UI Kit dark-first standards while preserving all existing domain behavior.
{{EXPECTED_CHANGED_FILES}} = src/App.tsx; src/styles.css; optional new token entry stylesheet referenced by the app
{{PROTECTED_BEHAVIOR}} = Edit/Save/Cancel for task sections; required-field validation; preview dialog content from current packet values; Escape and Close dismiss preview; focus returns to Preview; browser-only export of task-packet.md with the five section headings; no network or filesystem access
{{ACCEPTANCE_CRITERIA}} = TRIAL-AC-001 through TRIAL-AC-013 in trials/vertical-slice-01/acceptance-criteria.md
{{APPLICABLE_STANDARD_IDS}} = FND-VIS-001, FND-TOK-001, FND-A11Y-001, LAY-SHELL-001, RCP-WORKFLOW-001, CMP-SHELL-APP, CMP-NAV-PRIMARY, CMP-SHELL-PAGE-HEADER, CMP-WORKFLOW-STEP-INDICATOR, CMP-SURFACE-PANEL, CMP-FORM-TEXTAREA, CMP-OVERLAY-DIALOG, CMP-FEEDBACK-VALIDATION-SUMMARY, ARCH-FE-*, ARCH-THEME-*, ARCH-STATE-*, ARCH-FILE-*
{{PRIMARY_VISUAL_REFERENCE}} = project-sources/visual-references/1F2214C9-D849-41CA-9435-68F0A0032EEB.jpeg (Create Task Packet)
{{VERIFICATION_COMMANDS}} = npm run typecheck; npm run build; manually verify Edit/Save/Cancel, validation, preview, Escape/Close, and export
```

## Review Criteria for the Implementation Pass

- Output stays inside expected files.
- Protected behavior is preserved.
- Dark-first semantic tokens are used.
- Accessibility behaviors remain intact.
- Overlay matches `ui-overlay.zip` contract.
- Limitations are disclosed rather than hidden.
