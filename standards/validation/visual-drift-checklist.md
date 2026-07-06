# Visual Drift Checklist

## Purpose

This checklist helps reviewers decide whether generated UI still resembles the intended Engineering UI Kit visual language.

## Scope

Use it for mockups, implementation screenshots, generated component output, and AI-produced screen descriptions.

## Dark-First Drift

- Root canvas uses dark-first posture.
- Panels, insets, and overlays follow surface hierarchy.
- Output does not default to light cards or white admin templates.

## Generic Dashboard Drift

- Summary content is tied to engineering evidence.
- KPI cards do not replace artifacts, validation, traceability, or workflows.
- Charts answer engineering questions.

## Token Drift

- No raw colors where tokens are required.
- Semantic token names are preserved.
- Accent/glow usage is restrained.

## Density Drift

- Content remains compact but readable.
- Tables and metadata are not oversized or sparse.
- Text is not compressed below readable standards.

## Surface Hierarchy Drift

- Primary regions are distinct from supporting panels and nested technical content.
- Borders and elevation are consistent.

## Accent and Glow Drift

- Accent indicates action, active state, focus, selection, or meaningful emphasis.
- Decorative neon/cyberpunk treatment is absent.

## Typography Drift

- Headings are concise.
- Code/paths/IDs use mono treatment where appropriate.
- Marketing hero typography is absent.

## Table and Chart Drift

- Tables show headers, status text, and action affordances.
- Charts include labels, legends, units, summaries, and states.

## Mockup Traceability Drift

- Mockups are used as app-specific visual calibration.
- Output does not claim mockups are formal company-wide standards.

## Result Classification

Any generic light dashboard output, raw color styling, or color-only critical status should be treated as a blocker unless clearly outside scope.
