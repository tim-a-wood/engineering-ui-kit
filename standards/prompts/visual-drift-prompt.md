# Visual Drift Review Prompt

## Intent

Guide a visual compliance review against Engineering UI Kit dark-first standards and approved mockups.

## Required Inputs

- Repo or implementation context.
- Relevant task packet.
- Relevant Engineering UI Kit standards excerpt or compiled standards pack.
- Approved dark high-fidelity mockup references when visual fidelity is part of the task.
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

Compare `{{SCREENSHOT_EVIDENCE}}` with `{{PRIMARY_VISUAL_REFERENCE}}` and the standards identified by `{{APPLICABLE_STANDARD_IDS}}`. Treat the mockup as app-specific visual calibration, not as an exhaustive component catalog or pixel contract.

Evaluate and report each of the following, citing the rule ID that controls the finding:

1. Dark-first alignment: root canvas, panels, and overlays use the dark semantic surface hierarchy (`FND-VIS-001`, `FND-TOK-004`, `FND-TOK-006`). Any light surface is a material finding.
2. Surface hierarchy: canvas, panel, raised, inset, and overlay layers are distinguishable and consistently used (`FND-VIS-001`, `FND-VIS-003`).
3. Accent discipline: accent identifies primary actions, focus, active navigation, or selected state only; no decorative neon or glow spread (`FND-VIS-002`, `FND-TOK-009`).
4. Token traceability: rendered colors resolve to the semantic variables in `{{TOKEN_TABLE}}`; raw colors outside the token entry point are findings (`ARCH-THEME-001`, `ARCH-THEME-005`).
5. Typography posture: sans for UI, monospaced for paths, IDs, and technical identifiers; sizes and weights from tokens (`FND-VIS-004`, `FND-TOK-013`).
6. Density and spacing: compact but readable; spacing steps from tokens rather than arbitrary compression (`FND-VIS-005`, `FND-TOK-011`).
7. Borders and elevation: borders carry hierarchy; shadows support state, not decoration (`FND-VIS-006`, `FND-TOK-012`).
8. Status discipline: status colors always accompanied by text labels or structure (`FND-VIS-009`, `FND-A11Y-006`).
9. Drift inventory: enumerate any generic SaaS white-card styling, marketing hero layout, gradients, glassmorphism, cyberpunk neon, huge display typography, placeholder wireframe look, hidden metadata, or icon-only unlabeled controls (`FND-VIS-010`).
10. Mockup traceability: identify each intentional deviation from the mockup and classify it as token-mandated, content-driven, or unexplained. Unexplained deviations are findings.

Classify every finding as blocker, warning, or note, and state the corrective action. Do not approve output that contains a light-mode surface, raw-color scattering, or an unexplained structural departure from the calibrated shell.

## Hard Constraints

- Engineering UI Kit v0.1 is dark-first. Light mode is not part of the v0.1 implementation contract unless explicitly added later.
- Follow the source-of-truth hierarchy.
- Use semantic tokens once token contracts are available.
- Do not invent visual features or product scope beyond the task packet.
- Do not drift into generic white-card dashboard styling.
- Preserve the strict three-file upload model when this prompt is used in constrained Copilot workflows.

## Expected Output

A visual drift report covering dark-first alignment, surface hierarchy, accents, density, polish, component consistency, and mockup traceability, with every finding tied to a rule ID and a corrective action.

## Review Criteria

- Output uses approved hi-fi mockup visual calibration references without treating them as exhaustive component standards.
- Output uses the documented component and layout standards available at the time.
- Output is traceable to task inputs and standards references.
- Output avoids unresolved visual drift and unsupported scope expansion.
