# Data Visualization

## Purpose

Data visualization components show engineering trends, distributions, status context, and validation evidence. Charts are for insight, not decoration.

## Scope

This file owns chart selection, chart panels, line charts, bar charts, legends, chart tooltips, threshold bands, chart states, and chart accessibility.

## Chart Selection Rules

Use line charts for trends or traces, bar charts for discrete comparisons, compact sparklines only where exact values are secondary, and threshold/limit visualization only when semantics are validated. ECharts is the primary candidate from research, but Phase 3 does not lock implementation code.

## Chart Panel

A chart panel shall include title, data source or scope, units, time or sample basis where applicable, legend, state, and fallback summary.

## Line Chart

Use line charts for time, sequence, tolerance, or continuous engineering data. Axes and units shall be visible or described.

## Bar Chart

Use bar charts for discrete categories, counts, status distribution, or comparisons. Avoid excessive categories that become unreadable.

## Legend

Legends shall identify series using text, not color alone. Series names shall map to engineering nouns.

## Chart Tooltip

Tooltips may provide exact values and context but shall not be the only way to access critical data.

## Threshold Band

`CMP-VIZ-THRESHOLD-BAND` is reserved for future validation. Use static labels, annotations, or explicit status summaries until threshold semantics are finalized.

## Chart States

Charts shall define empty, loading, error, partial, stale, and unavailable states inside the chart panel.

## Status and Severity in Charts

Severity colors shall be used sparingly and consistently with status tokens. A warning/danger series shall include label, legend, or summary text.

## Accessibility Rules

Charts shall provide accessible names, text summaries, data-table alternatives where practical, and reduced-motion-safe behavior.

## Approved Chart Patterns

- Chart panel with title, units, legend, and text summary.
- Line chart showing trace/tolerance context with labeled axes.
- Bar chart showing validation result distribution with status labels.

## Rejected Chart Patterns

- Decorative charts with no engineering question.
- Color-only severity series.
- Tooltip-only exact values for critical findings.
- Unlabeled axes or hidden units.


## CMP-VIZ-CHART-PANEL — Chart Panel

### Purpose
CMP-VIZ-CHART-PANEL defines a panel that frames a chart with title, legend, controls, and status. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use chart panel when the interface needs a panel that frames a chart with title, legend, controls, and status.

### When not to use
Avoid chart panel when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: default, with-toolbar, empty. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, loading, error. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.panel}, {semantic.charts.grid}, {semantic.charts.axis}, {semantic.charts.series.primary}, {semantic.charts.series.secondary}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Chart Panel` appears in a dark engineering panel, uses manifest ID `CMP-VIZ-CHART-PANEL`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Chart Panel` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-VIZ-CHART-PANEL` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-VIZ-CHART-PANEL` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: observed-in-mockups, prd-required.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-VIZ-LINE-CHART — Line Chart

### Purpose
CMP-VIZ-LINE-CHART defines time-series or ordered numeric trend visualization. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use line chart when the interface needs time-series or ordered numeric trend visualization.

### When not to use
Avoid line chart when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: single-series, multi-series, thresholded. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, hover, selected, empty. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.panel}, {semantic.charts.grid}, {semantic.charts.axis}, {semantic.charts.series.primary}, {semantic.charts.series.secondary}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Line Chart` appears in a dark engineering panel, uses manifest ID `CMP-VIZ-LINE-CHART`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Line Chart` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-VIZ-LINE-CHART` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-VIZ-LINE-CHART` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: observed-in-mockups, reference-backed-standard.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-VIZ-BAR-CHART — Bar Chart

### Purpose
CMP-VIZ-BAR-CHART defines categorical comparison visualization. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use bar chart when the interface needs categorical comparison visualization.

### When not to use
Avoid bar chart when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: vertical, horizontal, stacked-reserved. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, hover, selected, empty. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.panel}, {semantic.charts.grid}, {semantic.charts.axis}, {semantic.charts.series.primary}, {semantic.charts.series.secondary}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Bar Chart` appears in a dark engineering panel, uses manifest ID `CMP-VIZ-BAR-CHART`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Bar Chart` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-VIZ-BAR-CHART` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-VIZ-BAR-CHART` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: reference-backed-standard, prd-required.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-VIZ-LEGEND — Legend

### Purpose
CMP-VIZ-LEGEND defines mapping between chart encodings and series meaning. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use legend when the interface needs mapping between chart encodings and series meaning.

### When not to use
Avoid legend when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: inline, panel, interactive-reserved. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, hidden-series. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.panel}, {semantic.charts.grid}, {semantic.charts.axis}, {semantic.charts.series.primary}, {semantic.charts.series.secondary}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Legend` appears in a dark engineering panel, uses manifest ID `CMP-VIZ-LEGEND`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Legend` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-VIZ-LEGEND` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-VIZ-LEGEND` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: observed-in-mockups, reference-backed-standard.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-VIZ-CHART-TOOLTIP — Chart Tooltip

### Purpose
CMP-VIZ-CHART-TOOLTIP defines precise data values on hover or focus. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use chart tooltip when the interface needs precise data values on hover or focus.

### When not to use
Avoid chart tooltip when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: single-point, multi-series. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: hidden, visible, pinned-reserved. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. When the tooltip follows a pointer or keyboard cursor, pair it with a crosshair rule and active-point halo drawn with `{semantic.charts.crosshair}`, snap to the nearest data point, and offer an equivalent keyboard path (arrow keys or focusable points) so hover is never the only route to the values. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status. A polite live region or visible readout shall mirror the tooltip values for assistive technology.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.panel}, {semantic.charts.grid}, {semantic.charts.axis}, {semantic.charts.crosshair}, {semantic.charts.series.primary}, {semantic.charts.series.secondary}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Chart Tooltip` appears in a dark engineering panel, uses manifest ID `CMP-VIZ-CHART-TOOLTIP`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable. The reference implementation is the crosshair tooltip in `examples/bench-monitor` (pointer and arrow-key driven, mirrored to a live readout).

### Rejected example
Non-compliant use: `Chart Tooltip` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-VIZ-CHART-TOOLTIP` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-VIZ-CHART-TOOLTIP` is referenced exactly.
- Coverage treatment: Tier 2 — standard specification; manifest coverage: reference-backed-standard.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-VIZ-THRESHOLD-BAND — Threshold Band

### Purpose
CMP-VIZ-THRESHOLD-BAND is reserved for visual warning, tolerance, or pass/fail region in charts. It exists for ID stability and future planning, not as a fully validated Phase 3 standard.

### When to use
Do not implement CMP-VIZ-THRESHOLD-BAND as a standard component yet. It may be referenced only in planning notes, validation gaps, or future implementation spikes.

### When not to use
Do not use it to complete current app screens unless a later phase validates behavior, accessibility, and token mapping. Use existing validated components first.

### Anatomy
Reserved. Candidate anatomy shall be proposed in a future validation phase and shall preserve the manifest ID.

### Variants
Reserved candidate variants: warning, danger, tolerance.

### States
Reserved candidate states: default, hidden.

### Behavior
Behavior is unresolved. Any implementation shall be treated as experimental and shall not be promoted into the standard without review.

### Accessibility
Accessibility behavior is unresolved beyond the general requirements in `FND-A11Y-*`. Future validation must define keyboard, focus, semantic, and non-visual behavior.

### Token usage
Candidate token references: {semantic.surface.panel}, {semantic.charts.grid}, {semantic.charts.axis}, {semantic.charts.series.primary}, {semantic.charts.series.secondary}. Do not introduce raw values or new token names while experimenting.

### Content rules
Use plain engineering labels and mark the component as experimental wherever it appears in planning material.

### Layout rules
No normative layout placement is approved in Phase 3.

### Approved example
Approved only as a reservation note: “`CMP-VIZ-THRESHOLD-BAND` is reserved for future validation; use an existing validated component now.”

### Rejected example
Rejected: building production behavior around `CMP-VIZ-THRESHOLD-BAND` and presenting it as an approved standard.

### Agent notes
Implementation agents shall preserve the ID but shall not generate a production component unless a later task supplies validated behavior.

### Validation checks
- Confirm the component remains present in `component-manifest.json`.
- Confirm prose says reserved and does not imply full approval.
- Confirm no app feature is added solely to justify the reserved component.
