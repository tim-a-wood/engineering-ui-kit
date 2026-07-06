# Tokens

## Purpose

This file explains how to use `tokens.json` when authoring or implementing Engineering UI Kit screens.

## Scope

The rules apply to standards prose, component specs, page recipes, generated CSS variables, implementation constants, and review checklists.

## Token Contract Source

`tokens.json` is the source of truth for token names and values. `schemas/tokens.schema.json` defines the expected contract shape.

## FND-TOK-001 — Use semantic tokens in component and page guidance

Component and layout guidance shall reference semantic tokens such as `{semantic.surface.panel}` rather than primitive values.

## FND-TOK-002 — Primitive tokens are implementation backing values

Primitive tokens may back implementation output, but prose standards should avoid exposing primitives unless explaining the token model.

## FND-TOK-003 — Raw color values are not allowed in component specs

Component and page specs shall not use raw hex, RGB, HSL, or named color values where a token exists.

## FND-TOK-004 — Dark mode is normative

The dark token mode is the normative Phase 3 theme. Reviewers shall treat dark-first drift as a material issue.

## FND-TOK-005 — Light mode is non-normative until separately authored

Light mode may remain present in the contract as a future or secondary mode, but Phase 3 does not author full light-mode behavior.

## FND-TOK-006 — Surface tokens

Use `semantic.surface.canvas`, `semantic.surface.panel`, `semantic.surface.panelRaised`, `semantic.surface.inset`, `semantic.surface.overlay`, and `semantic.surface.scrim` to express hierarchy.

## FND-TOK-007 — Text tokens

Use `semantic.text.primary`, `semantic.text.secondary`, `semantic.text.muted`, `semantic.text.disabled`, and `semantic.text.inverse` based on content importance.

## FND-TOK-008 — Border and focus tokens

Use `semantic.border.subtle`, `semantic.border.strong`, `semantic.border.focus`, `semantic.border.danger`, `semantic.focus.ring`, and `semantic.focus.ringOffset` for boundaries and focus.

## FND-TOK-009 — Accent tokens

Use `semantic.accent.primary`, `semantic.accent.primaryHover`, `semantic.accent.primaryActive`, `semantic.accent.secondary`, and `semantic.accent.glow` only for active, selected, focus, or primary-command emphasis.

## FND-TOK-010 — Status tokens

Use `semantic.status.success`, `semantic.status.warning`, `semantic.status.danger`, `semantic.status.info`, `semantic.status.neutral`, `semantic.status.running`, and `semantic.status.pending` with text labels.

## FND-TOK-011 — Spacing and density tokens

Use `semantic.spacing.*` for general spacing and `semantic.density.compact.*` / `semantic.density.comfortable.*` for controls, rows, and panel padding.

## FND-TOK-012 — Radius and shadow tokens

Use `semantic.radius.*` and `semantic.shadow.*` for bounded surfaces. Avoid creating local radii or shadow values.

## FND-TOK-013 — Typography tokens

Use `semantic.typography.family.*`, `semantic.typography.size.*`, and `semantic.typography.weight.*`. Use monospaced typography for code, paths, IDs, commands, and log fragments.

## FND-TOK-014 — Motion and z-index tokens

Use `semantic.motion.*` and `semantic.zIndex.*`. Motion shall clarify state; z-index shall follow overlay, modal, and toast rules.

## FND-TOK-015 — Chart tokens

Use `semantic.charts.grid`, `semantic.charts.axis`, and `semantic.charts.series.*` for visualization. Chart status overlays shall still include labels or summaries.

## Token Reference Syntax

Use curly-brace references in prose: `{semantic.surface.panel}`. Implementation agents may translate these to CSS variables, theme constants, or framework tokens while preserving the source name.

## Component Alias Usage

Component aliases such as `componentAliases.button.primary.background`, `componentAliases.field.border`, `componentAliases.table.header.background`, and `componentAliases.badge.*.text` may be used when an implementation needs a component-specific mapping. They shall not replace semantic intent in the standards.

## Token Review Checklist

- Token names match `tokens.json`.
- Component docs use semantic or component alias tokens, not raw values.
- Dark mode remains normative.
- New local token names are not invented.
- Generated code can trace styling back to token references.
