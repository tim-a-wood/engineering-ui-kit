# Review Prompt

## Intent

Guide a review pass over Copilot-produced UI changes using only the provided changed
files, overlay inspection evidence, and local verification results.

## Canonical Variable Markers

Only these markers are used. Substitute them before the review pass.

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

You are reviewing implementation output for `{{PROJECT_NAME}}`.

Review only the provided changed files and evidence. Do not assume unstated repository
changes.

Task goal:

{{TASK_GOAL}}

Expected changed files:

{{EXPECTED_CHANGED_FILES}}

Protected behavior:

{{PROTECTED_BEHAVIOR}}

Acceptance criteria to evaluate one by one:

{{ACCEPTANCE_CRITERIA}}

Applicable standard, component, layout, and token IDs:

{{APPLICABLE_STANDARD_IDS}}

Primary visual reference:

{{PRIMARY_VISUAL_REFERENCE}}

Verification commands and evidence to consider:

{{VERIFICATION_COMMANDS}}

Review requirements:

- Check every acceptance criterion as pass, fail, or not evidenced.
- Check overlay scope against expected files and overlay-safety rules.
- Confirm protected behavior is preserved.
- Identify visual drift from dark-first engineering workbench direction.
- Identify accessibility issues including keyboard, focus, dialog behavior, and status
  text.
- Distinguish findings as blocker, warning, or note.
- Do not propose broad unrelated rewrites.
- Return a concise corrective-action list suitable for a follow-up task packet.
- Do not claim success unless build/typecheck, overlay inspection, and acceptance
  evidence support that claim.

Required response shape:

```markdown
# Review Result
## Summary Verdict
## Acceptance Criteria
| ID | Result | Evidence | Notes |
|---|---|---|---|
## Overlay Scope
## Protected Behavior
## Visual and Accessibility Findings
## Blockers
## Warnings
## Notes
## Corrective Actions
```

## Vertical Slice 01 Substituted Dry Run

```text
{{PROJECT_NAME}} = UI Overlay / trials/vertical-slice-01/target-app (selected-project sample: signal-analyzer-refresh)
{{TASK_GOAL}} = Refresh UI Overlay's Create Task Packet screen to Engineering UI Kit dark-first standards while preserving all existing domain behavior.
{{EXPECTED_CHANGED_FILES}} = src/App.tsx; src/styles.css; optional new token entry stylesheet referenced by the app
{{PROTECTED_BEHAVIOR}} = Edit/Save/Cancel for task sections; required-field validation; preview dialog content from current packet values; Escape and Close dismiss preview; focus returns to Preview; browser-only export of task-packet.md with the five section headings; no network or filesystem access
{{ACCEPTANCE_CRITERIA}} = TRIAL-AC-001 through TRIAL-AC-013 in trials/vertical-slice-01/acceptance-criteria.md
{{APPLICABLE_STANDARD_IDS}} = FND-VIS-001, FND-TOK-001, FND-A11Y-001, LAY-SHELL-001, RCP-WORKFLOW-001, CMP-SHELL-APP, CMP-NAV-PRIMARY, CMP-SHELL-PAGE-HEADER, CMP-WORKFLOW-STEP-INDICATOR, CMP-SURFACE-PANEL, CMP-FORM-TEXTAREA, CMP-OVERLAY-DIALOG, CMP-FEEDBACK-VALIDATION-SUMMARY
{{PRIMARY_VISUAL_REFERENCE}} = project-sources/visual-references/1F2214C9-D849-41CA-9435-68F0A0032EEB.jpeg (Create Task Packet)
{{VERIFICATION_COMMANDS}} = npm run typecheck; npm run build; overlay inspection verdict; manual interaction checks
```

## Severity Model

- Blocker: prevents apply or trial success.
- Warning: requires explicit human acceptance and follow-up.
- Note: non-blocking observation.
