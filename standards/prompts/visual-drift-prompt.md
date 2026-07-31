# Visual Drift Review Prompt

## Intent

Guide a visual compliance review against Engineering UI Kit standards and approved references.

## Required Inputs

- Repo or implementation context.
- Relevant task packet.
- Relevant Engineering UI Kit standards excerpt or compiled standards pack.
- Approved high-fidelity references when visual fidelity is part of the task.
- Screenshot evidence of the implemented state.

## Canonical Variable Markers

Only these markers are used. Substitute them before the review pass.

```text
{{PROJECT_NAME}}
{{SCREEN_NAME}}
{{PRIMARY_VISUAL_REFERENCE}}
{{APPLICABLE_STANDARD_IDS}}
{{TOKEN_TABLE}}
{{SCREENSHOT_EVIDENCE}}
```

## Canonical Prompt

You are reviewing visual compliance for `{{PROJECT_NAME}}`, screen `{{SCREEN_NAME}}`.

Apply the Engineering UI Kit writing profile based on ASD-STE100 Issue 9 to the review and
to all reviewed user-interface text and diagram labels.

- Use American English, active voice, simple verb forms, and one action per sentence.
- Limit instructions to 20 words and descriptions to 25 words per sentence.
- Require names and diagram labels in `VERB + OBJECT` form with no more than four words.
- Require one technical term for one concept. Reject contractions, semicolons, and em dashes.
- Report each writing defect as a finding with a direct correction.

Compare `{{SCREENSHOT_EVIDENCE}}` with `{{PRIMARY_VISUAL_REFERENCE}}` and the standards identified by `{{APPLICABLE_STANDARD_IDS}}`. Treat the mockup as app-specific visual calibration, not as an exhaustive component catalog or pixel contract.

Evaluate and report each of the following, citing the rule ID that controls the finding:

1. Mode quality: light and dark modes preserve hierarchy, contrast, density, and product identity (`FND-VIS-001`, `FND-TOK-004`).
2. Surface hierarchy: canvas, panel, raised, inset, and overlay layers are distinguishable and consistently used (`FND-VIS-001`, `FND-VIS-003`).
3. Accent discipline: accent identifies primary actions, focus, active navigation, or selected state only; no decorative neon or glow spread (`FND-VIS-002`, `FND-TOK-009`).
4. Token traceability: rendered colors resolve to the semantic variables in `{{TOKEN_TABLE}}`; raw colors outside the token entry point are findings (`ARCH-THEME-001`, `ARCH-THEME-005`).
5. Typography posture: sans for UI, monospaced for paths, IDs, and technical identifiers; sizes and weights from tokens (`FND-VIS-004`, `FND-TOK-013`).
6. Density and spacing: compact but readable; spacing steps from tokens rather than arbitrary compression (`FND-VIS-005`, `FND-TOK-011`).
7. Borders and elevation: borders carry hierarchy; shadows support state, not decoration (`FND-VIS-006`, `FND-TOK-012`).
8. Status discipline: status colors always accompanied by text labels or structure (`FND-VIS-009`, `FND-A11Y-006`).
9. Icon and help quality: verify one icon family, stable geometry, labeled icon controls, tooltips, and contextual help (`FND-ICON-001`, `FND-HELP-001`).
10. Trope inventory: report accent-strip tiles, sparkles, card walls, glass effects, gradient text, excessive pills, and vague promotional copy (`FND-TROPE-001`).
11. Writing quality: verify STE copy and reject em dashes in all visible text (`FND-COPY-001`).
12. Reference traceability: identify each intentional deviation and classify it as token-driven, content-driven, or unexplained.

Classify every finding as blocker, warning, or note. State the corrective action. Do not approve output that fails a required gate.

## Hard Constraints

- Light and dark modes are part of the frontend contract.
- Follow the source-of-truth hierarchy.
- Use semantic tokens once token contracts are available.
- Do not invent visual features or product scope beyond the task packet.
- Do not drift into generic white-card dashboard styling.
- Preserve the strict three-file upload model when this prompt is used in constrained Copilot workflows.

## Expected Output

A visual drift report covering mode quality, hierarchy, icons, help, copy, density, polish, and reference traceability.

## Review Criteria

- Output uses approved hi-fi mockup visual calibration references without treating them as exhaustive component standards.
- Output uses the documented component and layout standards available at the time.
- Output is traceable to task inputs and standards references.
- Output avoids unresolved visual drift and unsupported scope expansion.
