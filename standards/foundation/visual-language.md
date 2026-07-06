# Visual Language

## Purpose

This file defines the visual standard for dark-first Engineering UI Kit screens.

## Scope

The guidance applies to app shells, panels, forms, tables, charts, overlays, and validation workflows. It does not define a brand campaign, public website, or full light-mode system.

## Visual Direction Summary

The visual language is a dark engineering workbench: restrained, structured, technical, and polished. It should look complete and intentional, but not consumerized or decorative.

## FND-VIS-001 — Dark-first surface hierarchy

Implementations shall use semantic surface tokens to create hierarchy: `semantic.surface.canvas` for the root canvas, `semantic.surface.panel` for ordinary bounded regions, `semantic.surface.panelRaised` for emphasized cards, `semantic.surface.inset` for embedded technical content, and `semantic.surface.overlay` for dialogs and drawers.

## FND-VIS-002 — Restrained technical accent usage

Accent color shall identify primary actions, focus, active navigation, selected state, or important technical affordances. `semantic.accent.glow` may be used sparingly around active or focused regions; it shall not become decorative neon styling.

## FND-VIS-003 — Panel and card discipline

Panels shall group related engineering content with clear headers, borders, and spacing. Raised cards shall be used for summaries or key decisions. Inset panels shall be used for code, logs, tabular subregions, or technical data that belongs inside a parent panel.

## FND-VIS-004 — Typography posture

Typography shall prioritize scanability and technical precision. Use semantic typography tokens, short headings, stable artifact names, and monospaced treatment for code, paths, commands, and IDs.

## FND-VIS-005 — Density and spacing posture

Compact density is allowed when content remains readable. Use `semantic.density.compact.*` and `semantic.spacing.*` tokens instead of arbitrary compression. Primary workflow regions should have enough padding to distinguish them from nested technical content.

## FND-VIS-006 — Borders, elevation, and glow

Borders shall define hierarchy more often than heavy shadows. `semantic.border.subtle` is the default; `semantic.border.strong` is reserved for selected, active, or high-emphasis boundaries. Elevation and glow shall support state, not decoration.

## FND-VIS-007 — Tables and technical data tone

Tables shall be dense, aligned, and legible. Header rows, status columns, paths, timestamps, and action columns shall be visually predictable. Decorative table striping or oversized rows that reduce engineering density should be avoided.

## FND-VIS-008 — Charts and analytic surfaces

Charts shall sit inside chart panels with title, scope, units, time range or data source, and state. Gridlines, axes, thresholds, and legends shall use chart semantic tokens and shall not compete with status colors.

## FND-VIS-009 — Status and severity color discipline

Status colors shall be used with text labels and icons or shapes where useful. Pass/fail, warning, blocked, and running states shall not rely on color alone, and screens shall avoid traffic-light noise from excessive severity badges.

## FND-VIS-010 — What visual drift looks like

Drift includes generic light cards, arbitrary gradients, excessive glassmorphism, cyberpunk neon, huge marketing typography, placeholder wireframes, hidden metadata, inconsistent borders, and raw colors that bypass tokens.

## Approved Visual Patterns

| Pattern | Rule |
|---|---|
| Dark canvas with bounded panels | Use surface hierarchy tokens. |
| Subtle accent around active navigation or focus | Use accent/focus tokens only. |
| Compact table with clear status text | Use density and status tokens. |
| Inset log/code region inside a panel | Use code and inset surface tokens. |
| Hairline-divided figure strips | Related key figures share one panel, split by 1px subtle borders, labels in small uppercase, values in tabular/mono numerals. |
| Plot drawn on the panel surface | Series draw directly on the panel with recessive gridlines — no boxed inset chart region; a crosshair plus text readout carries exact values. |
| Machined segmented controls | Window/filter switchers use an inset track whose active segment is raised to the panel-raised surface, not an accent-tinted pill. |
| Status as dot plus text | Routine statuses render as a status-token dot beside plain text; tinted pills are reserved for a few prominent states such as the run state. |

## Rejected Visual Patterns

| Pattern | Reason |
|---|---|
| Generic white-card dashboard | Violates dark-first engineering posture. |
| Arbitrary gradient hero blocks | Adds marketing tone and no engineering value. |
| Decorative neon glow everywhere | Dilutes focus and active-state meaning. |
| Low-fidelity placeholder components in hi-fi output | Fails the standard for polished implementation guidance. |
| A grid of identical rounded metric cards, each with its own accent bar | Reads as template output; group related figures on one hairline-divided surface and reserve accent for state. |
| Tinted pill badges on every status | Dilutes severity; routine statuses use a dot plus text. |
| A marker dot on every point of a dense line series | Noise without information; markers belong on the hovered or focused point. |
| Proportional numerals in readings, tables, or timestamps | Measured values must align digit-for-digit; use tabular numerals or the mono family. |

## Mockup Calibration Notes

Mockups constrain density, panel discipline, dark surfaces, technical tone, and chart/table treatment. They do not prove every component or layout appears in the app, and they shall not be cited as formal company-wide standards.
