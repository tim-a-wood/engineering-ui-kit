# Overlays and Dialogs

## Purpose

Overlays contain focused secondary tasks, confirmations, contextual actions, and non-page surfaces without destroying page context.

## Scope

This file owns dialogs, confirmation dialogs, drawers, popovers, tooltips, context menus, layering, dismissal, and focus management.

## Dialog

Use dialogs for blocking tasks that require focused input or decision. Dialogs shall have an accessible title, clear actions, and focus management.

## Confirmation Dialog

Use confirmation dialogs for destructive, irreversible, overwrite, or consequential actions. The copy shall name the action, affected artifact, consequence, and safe alternative.

## Drawer

Use drawers for secondary inspection or editing that benefits from keeping page context visible. Avoid drawers for complex workflows that need a full page.

## Popover

Use popovers for small contextual controls or supplemental details. Popovers shall not hide required instructions.

## Tooltip

Use tooltips for short clarifications only. Tooltips shall not contain essential instructions, interactive controls, or validation errors.

## Context Menu

Use context menus for secondary item-specific actions. Primary or destructive actions shall also be discoverable elsewhere when important.

## Overlay Layering

Use `semantic.zIndex.dropdown`, `semantic.zIndex.overlay`, `semantic.zIndex.modal`, and `semantic.zIndex.toast`. Do not create arbitrary z-index values.

## Dismissal Rules

Dismissal shall be predictable. Escape and outside-click behavior may be disabled for destructive confirmations or required decisions, but this must be intentional.

## Focus Management

Blocking overlays shall move focus into the overlay and restore focus to the trigger when closed. Focus shall not fall back to the document body.

## Accessibility Rules

Overlays shall expose roles, names, descriptions where useful, keyboard operation, focus trap where blocking, and non-color state.

## Approved Overlay Patterns

- Confirmation dialog with explicit consequence and safe cancel.
- Drawer for inspecting evidence while preserving table context.
- Popover for local filter options with keyboard support.

## Rejected Overlay Patterns

- Nested modals except where unavoidable and documented.
- Tooltip-only instructions.
- Dialog with unlabeled icon buttons.
- Context menu as the only location for destructive actions.


## CMP-OVERLAY-DIALOG — Dialog

### Purpose
CMP-OVERLAY-DIALOG defines blocking overlay for focused decisions or forms. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use dialog when the interface needs blocking overlay for focused decisions or forms.

### When not to use
Avoid dialog when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: standard, large, form. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: closed, opening, open, closing. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.overlay}, {semantic.surface.scrim}, {semantic.shadow.overlay}, {semantic.zIndex.modal}, {semantic.radius.lg}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Dialog` appears in a dark engineering panel, uses manifest ID `CMP-OVERLAY-DIALOG`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Dialog` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-OVERLAY-DIALOG` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-OVERLAY-DIALOG` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: reference-backed-standard, prd-required.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-OVERLAY-CONFIRMATION-DIALOG — Confirmation Dialog

### Purpose
CMP-OVERLAY-CONFIRMATION-DIALOG defines explicit confirmation before destructive or irreversible actions. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use confirmation dialog when the interface needs explicit confirmation before destructive or irreversible actions.

### When not to use
Avoid confirmation dialog when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: destructive, warning, info. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: open, confirming, error. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.overlay}, {semantic.surface.scrim}, {semantic.shadow.overlay}, {semantic.zIndex.modal}, {semantic.radius.lg}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Confirmation Dialog` appears in a dark engineering panel, uses manifest ID `CMP-OVERLAY-CONFIRMATION-DIALOG`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Confirmation Dialog` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-OVERLAY-CONFIRMATION-DIALOG` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-OVERLAY-CONFIRMATION-DIALOG` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: reference-backed-standard, prd-required.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-OVERLAY-DRAWER — Drawer

### Purpose
CMP-OVERLAY-DRAWER defines side overlay for supplemental details without full page navigation. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use drawer when the interface needs side overlay for supplemental details without full page navigation.

### When not to use
Avoid drawer when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: right, left, wide. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: closed, open, loading. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.overlay}, {semantic.surface.scrim}, {semantic.shadow.overlay}, {semantic.zIndex.modal}, {semantic.radius.lg}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Drawer` appears in a dark engineering panel, uses manifest ID `CMP-OVERLAY-DRAWER`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Drawer` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-OVERLAY-DRAWER` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-OVERLAY-DRAWER` is referenced exactly.
- Coverage treatment: Tier 2 — standard specification; manifest coverage: partially-observed-in-mockups, reference-backed-standard.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-OVERLAY-POPOVER — Popover

### Purpose
CMP-OVERLAY-POPOVER defines small contextual overlay anchored to a control. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use popover when the interface needs small contextual overlay anchored to a control.

### When not to use
Avoid popover when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: default, interactive, noninteractive. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: closed, open, focus-within. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.overlay}, {semantic.surface.scrim}, {semantic.shadow.overlay}, {semantic.zIndex.modal}, {semantic.radius.lg}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Popover` appears in a dark engineering panel, uses manifest ID `CMP-OVERLAY-POPOVER`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Popover` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-OVERLAY-POPOVER` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-OVERLAY-POPOVER` is referenced exactly.
- Coverage treatment: Tier 2 — standard specification; manifest coverage: reference-backed-standard.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-OVERLAY-TOOLTIP — Tooltip

### Purpose
CMP-OVERLAY-TOOLTIP defines brief non-interactive explanation for controls or data points. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use tooltip when the interface needs brief non-interactive explanation for controls or data points.

### When not to use
Avoid tooltip when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: default, chart, truncated-text. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: hidden, visible. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.overlay}, {semantic.surface.scrim}, {semantic.shadow.overlay}, {semantic.zIndex.modal}, {semantic.radius.lg}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Tooltip` appears in a dark engineering panel, uses manifest ID `CMP-OVERLAY-TOOLTIP`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Tooltip` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-OVERLAY-TOOLTIP` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-OVERLAY-TOOLTIP` is referenced exactly.
- Coverage treatment: Tier 2 — standard specification; manifest coverage: reference-backed-standard.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-OVERLAY-CONTEXT-MENU — Context Menu

### Purpose
CMP-OVERLAY-CONTEXT-MENU defines contextual action menu for rows, artifacts, or panes. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use context menu when the interface needs contextual action menu for rows, artifacts, or panes.

### When not to use
Avoid context menu when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: row, tree, editor. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: closed, open, keyboard-navigation. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.overlay}, {semantic.surface.scrim}, {semantic.shadow.overlay}, {semantic.zIndex.modal}, {semantic.radius.lg}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Context Menu` appears in a dark engineering panel, uses manifest ID `CMP-OVERLAY-CONTEXT-MENU`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Context Menu` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-OVERLAY-CONTEXT-MENU` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-OVERLAY-CONTEXT-MENU` is referenced exactly.
- Coverage treatment: Tier 2 — standard specification; manifest coverage: reference-backed-standard, inferred-engineering-need.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.
