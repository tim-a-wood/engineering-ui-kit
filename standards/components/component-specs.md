# Component Specifications

## Purpose

This file defines shared component standards and owns component categories not covered by specialized files: surfaces, layout primitives, engineering artifacts, code, and logs.

## Scope

Use this file with `component-manifest.json`, `foundation/principles.md`, `foundation/visual-language.md`, and `foundation/tokens.md`. Specialized files own forms, tables, navigation, feedback/status/workflow, overlays, and data visualization.

## Component Spec Template

Each component spec shall use: Purpose, When to use, When not to use, Anatomy, Variants, States, Behavior, Accessibility, Token usage, Content rules, Layout rules, Approved example, Rejected example, Agent notes, and Validation checks.

## Shared Component Rules

- Components shall use manifest IDs and stable semantic tokens.
- Components shall expose visible state where state affects engineering decisions.
- Components shall be composed inside layout recipes rather than inventing one-off page structures.
- Icon-only actions shall have accessible names and visible focus.
- Components shall not claim company-wide authority beyond the supplied project standards.

## Action Components

Actions are expressed as buttons, menu items, command bars, row action menus, or links depending on consequence and context.

| Action type | Rule |
|---|---|
| Primary | One dominant action per task region where practical. |
| Secondary | Used for alternative safe actions. |
| Quiet | Used for low-emphasis utilities such as copy or open. |
| Destructive | Requires explicit label, consequence, and confirmation when not easily reversible. |
| Icon-only | Allowed only with accessible name and visible tooltip or label where ambiguity exists. |

## Surface Components

Panels, raised cards, and inset panels define hierarchy. Use surface tokens rather than arbitrary backgrounds, and do not create decorative containers that do not group related content.

## Content Components

Content components summarize engineering state. Metric cards and key-value lists shall link back to evidence or source context where applicable. Empty states shall provide a clear next action when one exists.

## Status Components

Status components shall use explicit vocabulary and non-color cues. Status badge and job indicator behavior is further defined in `feedback-and-status.md`.

## Workflow Components

Workflow components shall expose step, progress, blocking conditions, and evidence. Hidden automation is not allowed for consequential operations.

## Engineering Artifact Components

Artifact trees, requirement links, evidence cards, and run/test summaries shall make source, status, and traceability visible. They shall prefer stable artifact nouns and avoid decorative file-browser patterns.

## Code and Log Components

Code and log displays shall use monospaced typography, inset surfaces, copy affordances where useful, and wrapping/scrolling behavior that preserves line context. Logs shall expose severity, timestamp, source, and message text where available.

## Reserved Component Notes

Reserved components keep IDs stable but shall not be implemented as finalized components. See each reserved spec for explicit deferral language.

## Component Compliance Checklist

- Manifest ID is referenced exactly.
- Token references use `tokens.json` names.
- States are visible and accessible.
- Critical status is not color-only.
- Consequential actions are explicit.
- Component placement follows a recipe or a documented container rule.
- Reserved components remain marked as reserved.


## CMP-SURFACE-PANEL — Panel

### Purpose
CMP-SURFACE-PANEL defines a default bounded container for related engineering UI content. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use panel when the interface needs a default bounded container for related engineering UI content.

### When not to use
Avoid panel when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: default, with-header, scrolling. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, active, disabled. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.panel}, {semantic.border.subtle}, {semantic.radius.lg}, {semantic.shadow.sm}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Panel` appears in a dark engineering panel, uses manifest ID `CMP-SURFACE-PANEL`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Panel` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-SURFACE-PANEL` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-SURFACE-PANEL` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: observed-in-mockups, reference-backed-standard.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-SURFACE-RAISED-CARD — Raised Card

### Purpose
CMP-SURFACE-RAISED-CARD defines a higher-emphasis surface for metrics, summaries, or selected records. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use raised card when the interface needs a higher-emphasis surface for metrics, summaries, or selected records.

### When not to use
Avoid raised card when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: metric, summary, selectable. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, hover, selected, focus. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.panel}, {semantic.border.subtle}, {semantic.radius.lg}, {semantic.shadow.sm}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Raised Card` appears in a dark engineering panel, uses manifest ID `CMP-SURFACE-RAISED-CARD`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Raised Card` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-SURFACE-RAISED-CARD` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-SURFACE-RAISED-CARD` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: observed-in-mockups, reference-backed-standard.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-SURFACE-INSET-PANEL — Inset Panel

### Purpose
CMP-SURFACE-INSET-PANEL defines a recessed container nested inside a parent panel. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use inset panel when the interface needs a recessed container nested inside a parent panel.

### When not to use
Avoid inset panel when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: code, chart, form-well. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, focus-within. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.panel}, {semantic.border.subtle}, {semantic.radius.lg}, {semantic.shadow.sm}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Inset Panel` appears in a dark engineering panel, uses manifest ID `CMP-SURFACE-INSET-PANEL`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Inset Panel` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-SURFACE-INSET-PANEL` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-SURFACE-INSET-PANEL` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: observed-in-mockups, reference-backed-standard.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-LAYOUT-SECTION-HEADER — Section Header

### Purpose
CMP-LAYOUT-SECTION-HEADER defines a labeled divider for major page or panel sections. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use section header when the interface needs a labeled divider for major page or panel sections.

### When not to use
Avoid section header when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: default, with-actions, with-count. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.canvas}, {semantic.spacing.6}, {semantic.radius.lg}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Section Header` appears in a dark engineering panel, uses manifest ID `CMP-LAYOUT-SECTION-HEADER`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Section Header` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-LAYOUT-SECTION-HEADER` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-LAYOUT-SECTION-HEADER` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: observed-in-mockups, reference-backed-standard.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-LAYOUT-TOOLBAR — Toolbar

### Purpose
CMP-LAYOUT-TOOLBAR defines a compact horizontal region for controls that affect a nearby panel or table. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use toolbar when the interface needs a compact horizontal region for controls that affect a nearby panel or table.

### When not to use
Avoid toolbar when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: table, chart, form. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, overflow, disabled. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.canvas}, {semantic.spacing.6}, {semantic.radius.lg}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Toolbar` appears in a dark engineering panel, uses manifest ID `CMP-LAYOUT-TOOLBAR`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Toolbar` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-LAYOUT-TOOLBAR` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-LAYOUT-TOOLBAR` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: observed-in-mockups, reference-backed-standard.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-LAYOUT-SPLIT-PANEL — Split Panel

### Purpose
CMP-LAYOUT-SPLIT-PANEL defines side-by-side regions for comparing lists, details, artifacts, or evidence. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use split panel when the interface needs side-by-side regions for comparing lists, details, artifacts, or evidence.

### When not to use
Avoid split panel when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: two-pane, three-pane, master-detail. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, resizing, collapsed. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.canvas}, {semantic.spacing.6}, {semantic.radius.lg}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Split Panel` appears in a dark engineering panel, uses manifest ID `CMP-LAYOUT-SPLIT-PANEL`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Split Panel` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-LAYOUT-SPLIT-PANEL` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-LAYOUT-SPLIT-PANEL` is referenced exactly.
- Coverage treatment: Tier 2 — standard specification; manifest coverage: partially-observed-in-mockups, inferred-engineering-need.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-LAYOUT-RESIZABLE-PANEL — Resizable Panel

### Purpose
CMP-LAYOUT-RESIZABLE-PANEL is reserved for adjustable regions for dense technical review workflows. It exists for ID stability and future planning, not as a fully validated Phase 3 standard.

### When to use
Do not implement CMP-LAYOUT-RESIZABLE-PANEL as a standard component yet. It may be referenced only in planning notes, validation gaps, or future implementation spikes.

### When not to use
Do not use it to complete current app screens unless a later phase validates behavior, accessibility, and token mapping. Use existing validated components first.

### Anatomy
Reserved. Candidate anatomy shall be proposed in a future validation phase and shall preserve the manifest ID.

### Variants
Reserved candidate variants: horizontal, vertical.

### States
Reserved candidate states: default, dragging, collapsed.

### Behavior
Behavior is unresolved. Any implementation shall be treated as experimental and shall not be promoted into the standard without review.

### Accessibility
Accessibility behavior is unresolved beyond the general requirements in `FND-A11Y-*`. Future validation must define keyboard, focus, semantic, and non-visual behavior.

### Token usage
Candidate token references: {semantic.surface.canvas}, {semantic.spacing.6}, {semantic.radius.lg}. Do not introduce raw values or new token names while experimenting.

### Content rules
Use plain engineering labels and mark the component as experimental wherever it appears in planning material.

### Layout rules
No normative layout placement is approved in Phase 3.

### Approved example
Approved only as a reservation note: “`CMP-LAYOUT-RESIZABLE-PANEL` is reserved for future validation; use an existing validated component now.”

### Rejected example
Rejected: building production behavior around `CMP-LAYOUT-RESIZABLE-PANEL` and presenting it as an approved standard.

### Agent notes
Implementation agents shall preserve the ID but shall not generate a production component unless a later task supplies validated behavior.

### Validation checks
- Confirm the component remains present in `component-manifest.json`.
- Confirm prose says reserved and does not imply full approval.
- Confirm no app feature is added solely to justify the reserved component.


## CMP-LAYOUT-DASHBOARD-GRID — Dashboard Grid

### Purpose
CMP-LAYOUT-DASHBOARD-GRID defines a responsive grid for metrics, charts, summaries, and status panels. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use dashboard grid when the interface needs a responsive grid for metrics, charts, summaries, and status panels.

### When not to use
Avoid dashboard grid when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: dense, responsive, fixed. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, loading. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.canvas}, {semantic.spacing.6}, {semantic.radius.lg}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Dashboard Grid` appears in a dark engineering panel, uses manifest ID `CMP-LAYOUT-DASHBOARD-GRID`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Dashboard Grid` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-LAYOUT-DASHBOARD-GRID` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-LAYOUT-DASHBOARD-GRID` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: observed-in-mockups, prd-required.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-LAYOUT-DETAIL — Detail Layout

### Purpose
CMP-LAYOUT-DETAIL defines a structured detail page composition with summary, metadata, tabs, and related panels. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use detail layout when the interface needs a structured detail page composition with summary, metadata, tabs, and related panels.

### When not to use
Avoid detail layout when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: record, artifact, workflow. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, loading, error. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.canvas}, {semantic.spacing.6}, {semantic.radius.lg}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Detail Layout` appears in a dark engineering panel, uses manifest ID `CMP-LAYOUT-DETAIL`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Detail Layout` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-LAYOUT-DETAIL` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-LAYOUT-DETAIL` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: partially-observed-in-mockups, prd-required.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-ENG-ARTIFACT-TREE — Artifact Tree

### Purpose
CMP-ENG-ARTIFACT-TREE defines hierarchical browsing of project, package, file, or evidence artifacts. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use artifact tree when the interface needs hierarchical browsing of project, package, file, or evidence artifacts.

### When not to use
Avoid artifact tree when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: file-tree, package-tree, filterable. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, expanded, selected, loading. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.panel}, {semantic.accent.primary}, {semantic.status.success}, {semantic.border.subtle}, {semantic.typography.family.mono}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Artifact Tree` appears in a dark engineering panel, uses manifest ID `CMP-ENG-ARTIFACT-TREE`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Artifact Tree` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-ENG-ARTIFACT-TREE` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-ENG-ARTIFACT-TREE` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: prd-required, inferred-engineering-need.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-ENG-TRACE-MATRIX — Traceability Matrix

### Purpose
CMP-ENG-TRACE-MATRIX is reserved for matrix view connecting requirements, tests, evidence, and outcomes. It exists for ID stability and future planning, not as a fully validated Phase 3 standard.

### When to use
Do not implement CMP-ENG-TRACE-MATRIX as a standard component yet. It may be referenced only in planning notes, validation gaps, or future implementation spikes.

### When not to use
Do not use it to complete current app screens unless a later phase validates behavior, accessibility, and token mapping. Use existing validated components first.

### Anatomy
Reserved. Candidate anatomy shall be proposed in a future validation phase and shall preserve the manifest ID.

### Variants
Reserved candidate variants: requirements-tests, artifacts-evidence.

### States
Reserved candidate states: default, filtered, selected, gap.

### Behavior
Behavior is unresolved. Any implementation shall be treated as experimental and shall not be promoted into the standard without review.

### Accessibility
Accessibility behavior is unresolved beyond the general requirements in `FND-A11Y-*`. Future validation must define keyboard, focus, semantic, and non-visual behavior.

### Token usage
Candidate token references: {semantic.surface.panel}, {semantic.accent.primary}, {semantic.status.success}, {semantic.border.subtle}, {semantic.typography.family.mono}. Do not introduce raw values or new token names while experimenting.

### Content rules
Use plain engineering labels and mark the component as experimental wherever it appears in planning material.

### Layout rules
No normative layout placement is approved in Phase 3.

### Approved example
Approved only as a reservation note: “`CMP-ENG-TRACE-MATRIX` is reserved for future validation; use an existing validated component now.”

### Rejected example
Rejected: building production behavior around `CMP-ENG-TRACE-MATRIX` and presenting it as an approved standard.

### Agent notes
Implementation agents shall preserve the ID but shall not generate a production component unless a later task supplies validated behavior.

### Validation checks
- Confirm the component remains present in `component-manifest.json`.
- Confirm prose says reserved and does not imply full approval.
- Confirm no app feature is added solely to justify the reserved component.


## CMP-ENG-EVIDENCE-CARD — Evidence Card

### Purpose
CMP-ENG-EVIDENCE-CARD defines summary card for generated evidence, attachments, validation outcome, and review state. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use evidence card when the interface needs summary card for generated evidence, attachments, validation outcome, and review state.

### When not to use
Avoid evidence card when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: artifact, test-result, report. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, selected, warning, failed. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.panel}, {semantic.accent.primary}, {semantic.status.success}, {semantic.border.subtle}, {semantic.typography.family.mono}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Evidence Card` appears in a dark engineering panel, uses manifest ID `CMP-ENG-EVIDENCE-CARD`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Evidence Card` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-ENG-EVIDENCE-CARD` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-ENG-EVIDENCE-CARD` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: prd-required, inferred-engineering-need.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-ENG-REQUIREMENT-LINK — Requirement Link

### Purpose
CMP-ENG-REQUIREMENT-LINK defines linked reference to a requirement, design item, test, or evidence artifact. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use requirement link when the interface needs linked reference to a requirement, design item, test, or evidence artifact.

### When not to use
Avoid requirement link when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: requirement, test, artifact. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, visited, broken, focus. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.panel}, {semantic.accent.primary}, {semantic.status.success}, {semantic.border.subtle}, {semantic.typography.family.mono}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Requirement Link` appears in a dark engineering panel, uses manifest ID `CMP-ENG-REQUIREMENT-LINK`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Requirement Link` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-ENG-REQUIREMENT-LINK` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-ENG-REQUIREMENT-LINK` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: prd-required, inferred-engineering-need.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-ENG-RUN-TEST-RESULT-SUMMARY — Run Test Result Summary

### Purpose
CMP-ENG-RUN-TEST-RESULT-SUMMARY defines compact pass, fail, warning, not-run, and coverage summary for execution results. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use run test result summary when the interface needs compact pass, fail, warning, not-run, and coverage summary for execution results.

### When not to use
Avoid run test result summary when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: package, test-set, single-run. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: not-run, running, passed, failed, warning. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.panel}, {semantic.accent.primary}, {semantic.status.success}, {semantic.border.subtle}, {semantic.typography.family.mono}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Run Test Result Summary` appears in a dark engineering panel, uses manifest ID `CMP-ENG-RUN-TEST-RESULT-SUMMARY`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Run Test Result Summary` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-ENG-RUN-TEST-RESULT-SUMMARY` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-ENG-RUN-TEST-RESULT-SUMMARY` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: prd-required, observed-in-mockups.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-ENG-DIFF-VIEWER — Diff Viewer

### Purpose
CMP-ENG-DIFF-VIEWER is reserved for side-by-side or inline comparison of technical text, generated output, or configuration. It exists for ID stability and future planning, not as a fully validated Phase 3 standard.

### When to use
Do not implement CMP-ENG-DIFF-VIEWER as a standard component yet. It may be referenced only in planning notes, validation gaps, or future implementation spikes.

### When not to use
Do not use it to complete current app screens unless a later phase validates behavior, accessibility, and token mapping. Use existing validated components first.

### Anatomy
Reserved. Candidate anatomy shall be proposed in a future validation phase and shall preserve the manifest ID.

### Variants
Reserved candidate variants: side-by-side, inline, semantic-reserved.

### States
Reserved candidate states: default, highlighted, collapsed.

### Behavior
Behavior is unresolved. Any implementation shall be treated as experimental and shall not be promoted into the standard without review.

### Accessibility
Accessibility behavior is unresolved beyond the general requirements in `FND-A11Y-*`. Future validation must define keyboard, focus, semantic, and non-visual behavior.

### Token usage
Candidate token references: {semantic.code.background}, {semantic.code.text}, {semantic.code.border}, {semantic.typography.family.mono}. Do not introduce raw values or new token names while experimenting.

### Content rules
Use plain engineering labels and mark the component as experimental wherever it appears in planning material.

### Layout rules
No normative layout placement is approved in Phase 3.

### Approved example
Approved only as a reservation note: “`CMP-ENG-DIFF-VIEWER` is reserved for future validation; use an existing validated component now.”

### Rejected example
Rejected: building production behavior around `CMP-ENG-DIFF-VIEWER` and presenting it as an approved standard.

### Agent notes
Implementation agents shall preserve the ID but shall not generate a production component unless a later task supplies validated behavior.

### Validation checks
- Confirm the component remains present in `component-manifest.json`.
- Confirm prose says reserved and does not imply full approval.
- Confirm no app feature is added solely to justify the reserved component.


## CMP-ENG-LOG-VIEWER — Log Viewer

### Purpose
CMP-ENG-LOG-VIEWER defines scrollable technical log output with severity, timestamp, and filtering support. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use log viewer when the interface needs scrollable technical log output with severity, timestamp, and filtering support.

### When not to use
Avoid log viewer when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: plain, structured, filterable. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, streaming, paused, empty. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.code.background}, {semantic.code.text}, {semantic.code.border}, {semantic.typography.family.mono}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Log Viewer` appears in a dark engineering panel, uses manifest ID `CMP-ENG-LOG-VIEWER`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Log Viewer` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-ENG-LOG-VIEWER` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-ENG-LOG-VIEWER` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: prd-required, inferred-engineering-need.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-ENG-CODE-BLOCK — Code Block

### Purpose
CMP-ENG-CODE-BLOCK defines monospaced display of commands, IDs, paths, snippets, and structured text. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use code block when the interface needs monospaced display of commands, IDs, paths, snippets, and structured text.

### When not to use
Avoid code block when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: inline, block, copyable. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, focus, copied. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.code.background}, {semantic.code.text}, {semantic.code.border}, {semantic.typography.family.mono}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Code Block` appears in a dark engineering panel, uses manifest ID `CMP-ENG-CODE-BLOCK`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Code Block` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-ENG-CODE-BLOCK` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-ENG-CODE-BLOCK` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: reference-backed-standard, prd-required.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.
