# UI Compliance Rubric

## Purpose

This rubric evaluates whether a generated or implemented UI complies with the Engineering UI Kit standards.

## Scope

Use it for mockups, generated app screens, component implementations, page recipes, and AI handoff outputs.

## Rating Model

| Rating | Meaning |
|---|---|
| Pass | Meets the standard with no material issues. |
| Pass with notes | Meets the standard but has minor improvement opportunities. |
| Warning | Usable but has a clear issue that should be corrected. |
| Blocker | Violates a hard rule or would mislead implementation/review. |
| Not applicable | Criterion does not apply to the reviewed artifact. |

## Blocking Failures

Automatic blockers include raw colors where tokens are required, generic light dashboard output, inaccessible interactive components, color-only critical status, hidden destructive actions, contract contradictions, and overstated mockup/company-standard authority.

## VAL-UI-001 — Source alignment

The artifact shall align with PRD decisions, Phase 2 contracts, and Phase 3 authored standards.

## VAL-UI-002 — Dark-first visual language

The artifact shall use dark-first surface hierarchy and shall not drift into generic white-card dashboard styling.

## VAL-UI-003 — Token usage

The artifact shall use semantic or component alias tokens and shall not introduce raw color values where tokens exist.

## VAL-UI-004 — Component usage

The artifact shall reference manifest component IDs and shall not invent conflicting component concepts.

## VAL-UI-005 — Layout composition

The artifact shall follow shell, dashboard, detail, workflow, split-panel, or state recipes as applicable.

## VAL-UI-006 — Engineering density

The artifact shall be dense enough for engineering use while preserving readability, labels, and state.

## VAL-UI-007 — Status and feedback clarity

Status, progress, errors, blockers, stale state, and validation results shall be visible and specific.

## VAL-UI-008 — Accessibility minimums

Keyboard access, visible focus, accessible names, semantic structure, and non-color status cues shall be present for applicable interactive elements.

## VAL-UI-009 — Content and labeling

Copy shall use direct engineering language, stable nouns, explicit consequences, and specific status labels.

## VAL-UI-010 — AI handoff suitability

The artifact shall be specific enough for AI implementation or review without relying on unstated visual intent.

## Review Procedure

1. Identify artifact type and applicable recipe.
2. Check contract alignment: tokens and component IDs.
3. Review visual language and density.
4. Review component behavior and states.
5. Review accessibility minimums.
6. Review examples and rejected-pattern drift.
7. Record result using the rating model.

## Result Template

| Criterion | Rating | Evidence | Corrective action |
|---|---|---|---|
| `VAL-UI-001` |  |  |  |
| `VAL-UI-002` |  |  |  |
| `VAL-UI-003` |  |  |  |
| `VAL-UI-004` |  |  |  |
| `VAL-UI-005` |  |  |  |
| `VAL-UI-006` |  |  |  |
| `VAL-UI-007` |  |  |  |
| `VAL-UI-008` |  |  |  |
| `VAL-UI-009` |  |  |  |
| `VAL-UI-010` |  |  |  |
