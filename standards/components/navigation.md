# Navigation

## Purpose

Navigation components move users between standards areas, workflow steps, detail pages, and command contexts without obscuring engineering state.

## Scope

This file owns primary navigation, secondary navigation, breadcrumbs, command action bars, top bar, app shell references, and page header behavior.

## Primary Navigation

Primary navigation shall represent stable app areas. It may be persistent in an app shell or collapsed where space requires, but active state and focus state shall remain visible.

## Secondary Navigation

Secondary navigation shall be task-local or entity-local. It shall not duplicate primary navigation or create portal-style sprawl.

## Breadcrumbs

Breadcrumbs shall be used where hierarchy or deep detail pages need context. They shall not replace a page title.

## Command Action Bar

The command action bar shall group task actions by consequence. Primary, secondary, destructive, and quiet actions shall be visually distinguishable and keyboard reachable.

## Tabs and Local Navigation

Tabs may switch local panels inside a page. Tabs shall expose selected state and shall not be used for workflow steps that require completion state; use a step indicator for that.

## Navigation State

Navigation shall expose active, hover, disabled, selected, focus, loading, and blocked states where applicable. Disabled states for consequential actions shall explain why.

## Accessibility Rules

Use landmarks, lists, buttons, links, or tabs according to behavior. Do not render navigation as unlabeled icons only.

## Approved Navigation Patterns

- Persistent primary navigation with a clear active item.
- Page header with title, metadata, and command bar.
- Breadcrumbs on detail pages with deep hierarchy.

## Rejected Navigation Patterns

- Generic mega-navigation.
- Duplicate navigation regions with conflicting active states.
- Icon-only navigation with no accessible names.
- Hidden primary commands inside unrelated menus.


## CMP-SHELL-APP — App Shell

### Purpose
CMP-SHELL-APP defines a persistent application frame for dark-first engineering workflows. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use app shell when the interface needs a persistent application frame for dark-first engineering workflows.

### When not to use
Avoid app shell when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: desktop, wide, constrained. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, loading, error. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.canvas}, {semantic.surface.panel}, {semantic.border.subtle}, {semantic.density.compact.controlHeight}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `App Shell` appears in a dark engineering panel, uses manifest ID `CMP-SHELL-APP`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `App Shell` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-SHELL-APP` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-SHELL-APP` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: observed-in-mockups, prd-required.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-SHELL-TOP-BAR — Top Bar

### Purpose
CMP-SHELL-TOP-BAR defines a persistent top region for product context, global actions, and status. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use top bar when the interface needs a persistent top region for product context, global actions, and status.

### When not to use
Avoid top bar when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: default, dense. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, sticky. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.canvas}, {semantic.surface.panel}, {semantic.border.subtle}, {semantic.density.compact.controlHeight}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Top Bar` appears in a dark engineering panel, uses manifest ID `CMP-SHELL-TOP-BAR`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Top Bar` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-SHELL-TOP-BAR` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-SHELL-TOP-BAR` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: observed-in-mockups, prd-required.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-SHELL-PAGE-HEADER — Page Header

### Purpose
CMP-SHELL-PAGE-HEADER defines a consistent title, subtitle, metadata, and page action region. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use page header when the interface needs a consistent title, subtitle, metadata, and page action region.

### When not to use
Avoid page header when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: default, with-actions, with-tabs. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.canvas}, {semantic.surface.panel}, {semantic.border.subtle}, {semantic.density.compact.controlHeight}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Page Header` appears in a dark engineering panel, uses manifest ID `CMP-SHELL-PAGE-HEADER`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Page Header` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-SHELL-PAGE-HEADER` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-SHELL-PAGE-HEADER` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: observed-in-mockups, prd-required.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-NAV-PRIMARY — Primary Navigation

### Purpose
CMP-NAV-PRIMARY defines top-level movement between major application areas. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use primary navigation when the interface needs top-level movement between major application areas.

### When not to use
Avoid primary navigation when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: rail, tabs, horizontal. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, active, focus, collapsed. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.panel}, {semantic.text.secondary}, {semantic.accent.primary}, {semantic.border.subtle}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Primary Navigation` appears in a dark engineering panel, uses manifest ID `CMP-NAV-PRIMARY`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Primary Navigation` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-NAV-PRIMARY` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-NAV-PRIMARY` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: observed-in-mockups, prd-required, reference-backed-standard.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-NAV-SECONDARY — Secondary Navigation

### Purpose
CMP-NAV-SECONDARY defines movement within a page, workspace, or secondary workflow context. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use secondary navigation when the interface needs movement within a page, workspace, or secondary workflow context.

### When not to use
Avoid secondary navigation when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: tabs, subnav, section-list. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, active, focus. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.panel}, {semantic.text.secondary}, {semantic.accent.primary}, {semantic.border.subtle}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Secondary Navigation` appears in a dark engineering panel, uses manifest ID `CMP-NAV-SECONDARY`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Secondary Navigation` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-NAV-SECONDARY` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-NAV-SECONDARY` is referenced exactly.
- Coverage treatment: Tier 2 — standard specification; manifest coverage: partially-observed-in-mockups, reference-backed-standard.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-NAV-BREADCRUMBS — Breadcrumbs

### Purpose
CMP-NAV-BREADCRUMBS defines hierarchical location context for nested artifacts or records. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use breadcrumbs when the interface needs hierarchical location context for nested artifacts or records.

### When not to use
Avoid breadcrumbs when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: default, truncated. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, focus. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.panel}, {semantic.text.secondary}, {semantic.accent.primary}, {semantic.border.subtle}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Breadcrumbs` appears in a dark engineering panel, uses manifest ID `CMP-NAV-BREADCRUMBS`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Breadcrumbs` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-NAV-BREADCRUMBS` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-NAV-BREADCRUMBS` is referenced exactly.
- Coverage treatment: Tier 2 — standard specification; manifest coverage: reference-backed-standard, inferred-engineering-need.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-NAV-COMMAND-ACTION-BAR — Command Action Bar

### Purpose
CMP-NAV-COMMAND-ACTION-BAR defines a grouped action region for page-level commands and workflow actions. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use command action bar when the interface needs a grouped action region for page-level commands and workflow actions.

### When not to use
Avoid command action bar when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: page, panel, inline. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, disabled, overflow. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.panel}, {semantic.text.secondary}, {semantic.accent.primary}, {semantic.border.subtle}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Command Action Bar` appears in a dark engineering panel, uses manifest ID `CMP-NAV-COMMAND-ACTION-BAR`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Command Action Bar` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-NAV-COMMAND-ACTION-BAR` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-NAV-COMMAND-ACTION-BAR` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: observed-in-mockups, prd-required.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.
