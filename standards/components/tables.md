# Tables

## Purpose

Tables display structured engineering records, validation results, file lists, component inventories, and traceable metadata.

## Scope

This file owns data tables, data grids, column headers, row action menus, pagination, dense display, and table states.

## Table vs Data Grid Decision Rule

Use a simple data table when the user primarily reads, sorts, filters, selects, or opens rows. Use a data grid only when cells are interactive, editable, virtualized, or require rich keyboard navigation.

## Data Table Anatomy

A table shall include a caption or surrounding heading, column headers, body rows, visible status text where applicable, optional toolbar/filter region, and empty/loading/error states.

## Column Headers

Headers shall be concise, visible, and associated with cells. Sortable headers shall expose sort state and keyboard behavior.

## Sorting

Sorting shall be explicit and reversible. Multi-sort may be used only when the state is visible.

## Filtering

Filters shall show active criteria using filter chips or summary text. Hidden filters that materially change table results are non-compliant.

## Selection

Selectable rows shall expose selected state visually and programmatically. Bulk actions shall describe the selected count and consequence.

## Row Actions

Row actions shall be close to the affected row and shall not hide destructive actions without explicit labels or confirmation.

## Pagination

Use pagination when the full record set is large or server-backed. Preserve current filters, sorting, and selected state rules.

## Empty, Loading, Error, and Partial Data States

Tables shall show state inside the table region. Long loading shall include useful context; errors shall identify what failed and whether partial data is shown.

## Engineering Data Density

Use compact row height tokens and predictable alignment. Paths, IDs, timestamps, and status columns shall remain readable.

## Accessibility Rules

Tables shall use semantic table structure where possible. Interactive grids shall validate keyboard navigation, active cell/row state, selected state, and header associations.

## Approved Table Patterns

- Compact table with visible headers, status labels, and row actions.
- Sort and filter state visible above or in the table header.
- Empty state inside the table with a next action.

## Rejected Table Patterns

- Decorative cards pretending to be tables.
- Color-only status chips.
- Hidden horizontal scrolling with no affordance.
- Action menus with unlabeled destructive operations.


## CMP-TABLE-DATA-TABLE — Data Table

### Purpose
CMP-TABLE-DATA-TABLE defines structured tabular presentation of records. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use data table when the interface needs structured tabular presentation of records.

### When not to use
Avoid data table when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: default, sortable, selectable. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, hover, selected, loading, empty. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.panel}, {semantic.surface.panelRaised}, {semantic.border.subtle}, {semantic.text.primary}, {semantic.density.compact.rowHeight}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Data Table` appears in a dark engineering panel, uses manifest ID `CMP-TABLE-DATA-TABLE`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Data Table` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-TABLE-DATA-TABLE` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-TABLE-DATA-TABLE` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: observed-in-mockups, reference-backed-standard.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-TABLE-DATA-GRID — Data Grid

### Purpose
CMP-TABLE-DATA-GRID defines interactive tabular review with sorting, selection, and dense engineering metadata. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use data grid when the interface needs interactive tabular review with sorting, selection, and dense engineering metadata.

### When not to use
Avoid data grid when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: virtualized-reserved, editable-reserved, selectable. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, focus-cell, selected, loading, error. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.panel}, {semantic.surface.panelRaised}, {semantic.border.subtle}, {semantic.text.primary}, {semantic.density.compact.rowHeight}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Data Grid` appears in a dark engineering panel, uses manifest ID `CMP-TABLE-DATA-GRID`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Data Grid` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-TABLE-DATA-GRID` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-TABLE-DATA-GRID` is referenced exactly.
- Coverage treatment: Tier 2 — standard specification; manifest coverage: partially-observed-in-mockups, reference-backed-standard, inferred-engineering-need.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-TABLE-COLUMN-HEADER — Column Header

### Purpose
CMP-TABLE-COLUMN-HEADER defines labeled table columns with sorting and alignment metadata. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use column header when the interface needs labeled table columns with sorting and alignment metadata.

### When not to use
Avoid column header when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: sortable, numeric, resizable-reserved. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, hover, sorted, focus. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.panel}, {semantic.surface.panelRaised}, {semantic.border.subtle}, {semantic.text.primary}, {semantic.density.compact.rowHeight}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Column Header` appears in a dark engineering panel, uses manifest ID `CMP-TABLE-COLUMN-HEADER`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Column Header` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-TABLE-COLUMN-HEADER` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-TABLE-COLUMN-HEADER` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: observed-in-mockups, reference-backed-standard.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-TABLE-ROW-ACTION-MENU — Row Action Menu

### Purpose
CMP-TABLE-ROW-ACTION-MENU defines per-row contextual actions without overcrowding the table. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use row action menu when the interface needs per-row contextual actions without overcrowding the table.

### When not to use
Avoid row action menu when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: kebab, inline. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, open, disabled. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.panel}, {semantic.surface.panelRaised}, {semantic.border.subtle}, {semantic.text.primary}, {semantic.density.compact.rowHeight}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Row Action Menu` appears in a dark engineering panel, uses manifest ID `CMP-TABLE-ROW-ACTION-MENU`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Row Action Menu` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-TABLE-ROW-ACTION-MENU` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-TABLE-ROW-ACTION-MENU` is referenced exactly.
- Coverage treatment: Tier 2 — standard specification; manifest coverage: partially-observed-in-mockups, reference-backed-standard.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-TABLE-PAGINATION — Pagination

### Purpose
CMP-TABLE-PAGINATION defines navigation across large record sets. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use pagination when the interface needs navigation across large record sets.

### When not to use
Avoid pagination when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: page-number, cursor-reserved. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, focus, disabled. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.panel}, {semantic.surface.panelRaised}, {semantic.border.subtle}, {semantic.text.primary}, {semantic.density.compact.rowHeight}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Pagination` appears in a dark engineering panel, uses manifest ID `CMP-TABLE-PAGINATION`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Pagination` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-TABLE-PAGINATION` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-TABLE-PAGINATION` is referenced exactly.
- Coverage treatment: Tier 2 — standard specification; manifest coverage: reference-backed-standard, inferred-engineering-need.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.
