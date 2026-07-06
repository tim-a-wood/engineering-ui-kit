# Forms

## Purpose

Forms collect, edit, validate, and submit engineering parameters, metadata, and handoff settings.

## Scope

This file owns form controls, field layout, validation, file dropzones, and filter controls used as form-like query inputs.

## Form Field Anatomy

A form field shall include a visible label, control, optional hint, optional unit or suffix, state indicator, and error text when invalid. Related fields may be grouped with a section header.

## Label, Hint, and Error Hierarchy

Labels identify the required input. Hints clarify constraints. Errors explain what is invalid and how to fix it where known. Placeholder text shall not replace labels.

## Required and Optional Fields

Required state shall be visible in the label or adjacent metadata. Optional fields may be marked only where doing so reduces ambiguity. Required state shall not be conveyed by color alone.

## Text Input

Use `CMP-FORM-TEXT-INPUT` for short free-text values such as names, IDs, paths, or query strings. Support default, focus, invalid, disabled, and read-only behavior.

## Number Input

Use `CMP-FORM-NUMBER-INPUT` for numeric engineering values. Show units, valid ranges, and precision expectations where they affect correctness.

## Select

Use `CMP-FORM-SELECT` for finite choices where search is unnecessary. Do not use select controls for large, dynamic, or unknown option sets.

## Combobox

Use `CMP-FORM-COMBOBOX` where users need search, typeahead, or dynamic options. Keyboard and announcement behavior shall be validated before broad use.

## Textarea

Use `CMP-FORM-TEXTAREA` for multi-line notes, review findings, descriptions, or generated text that needs editing.

## Checkbox

Use `CMP-FORM-CHECKBOX` for independent boolean choices. The label shall describe the checked state.

## Radio Group

Use `CMP-FORM-RADIO-GROUP` for mutually exclusive choices where seeing all options improves decision quality.

## Switch

Use `CMP-FORM-SWITCH` only for immediate binary settings that are safe and clear. Do not use a switch for destructive or ambiguous operations.

## Date Time Input

Use `CMP-FORM-DATE-TIME-INPUT` where time affects traceability or scheduling. Include timezone where ambiguity matters.

## File Dropzone

Use `CMP-FORM-FILE-DROPZONE` for deliberate file selection. Show accepted file types, size limits where known, selected filenames, error state, and remove/replace actions.

## Validation Summary

Use `CMP-FEEDBACK-VALIDATION-SUMMARY` when multiple fields are invalid or when blocked generation/apply actions require a consolidated explanation.

## Accessibility Rules

Fields shall have accessible names, linked descriptions and errors, keyboard operation, visible focus, and non-color invalid cues. Custom selects, comboboxes, and dropzones shall not be used unless keyboard behavior is correct.

## Approved Form Patterns

- Label above control, hint below label, error below control.
- Numeric input with unit and range text.
- File dropzone that also supports button-based file selection.
- Validation summary linking to invalid fields.

## Rejected Form Patterns

- Placeholder-only labels.
- Disabled submit button with no explanation.
- Switch labeled with unclear consequences.
- Invisible validation that appears only after export fails.


## CMP-FORM-FIELD — Form Field

### Purpose
CMP-FORM-FIELD defines a label, description, control, error, and helper-text wrapper. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use form field when the interface needs a label, description, control, error, and helper-text wrapper.

### When not to use
Avoid form field when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: default, required, invalid. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, focus-within, invalid, disabled. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.inset}, {semantic.border.subtle}, {semantic.border.focus}, {semantic.text.primary}, {semantic.density.compact.controlHeight}, {semantic.radius.md}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Form Field` appears in a dark engineering panel, uses manifest ID `CMP-FORM-FIELD`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Form Field` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-FORM-FIELD` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-FORM-FIELD` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: observed-in-mockups, reference-backed-standard.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-FORM-TEXT-INPUT — Text Input

### Purpose
CMP-FORM-TEXT-INPUT defines single-line text entry. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use text input when the interface needs single-line text entry.

### When not to use
Avoid text input when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: default, with-prefix, with-suffix. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, hover, focus, invalid, disabled. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.inset}, {semantic.border.subtle}, {semantic.border.focus}, {semantic.text.primary}, {semantic.density.compact.controlHeight}, {semantic.radius.md}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Text Input` appears in a dark engineering panel, uses manifest ID `CMP-FORM-TEXT-INPUT`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Text Input` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-FORM-TEXT-INPUT` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-FORM-TEXT-INPUT` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: observed-in-mockups, reference-backed-standard.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-FORM-NUMBER-INPUT — Number Input

### Purpose
CMP-FORM-NUMBER-INPUT defines numeric entry with validation and formatting expectations. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use number input when the interface needs numeric entry with validation and formatting expectations.

### When not to use
Avoid number input when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: integer, decimal, unit. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, focus, invalid, disabled. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.inset}, {semantic.border.subtle}, {semantic.border.focus}, {semantic.text.primary}, {semantic.density.compact.controlHeight}, {semantic.radius.md}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Number Input` appears in a dark engineering panel, uses manifest ID `CMP-FORM-NUMBER-INPUT`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Number Input` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-FORM-NUMBER-INPUT` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-FORM-NUMBER-INPUT` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: partially-observed-in-mockups, reference-backed-standard.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-FORM-SELECT — Select

### Purpose
CMP-FORM-SELECT defines selection from a constrained list of values. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use select when the interface needs selection from a constrained list of values.

### When not to use
Avoid select when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: single, compact. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, open, focus, invalid, disabled. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.inset}, {semantic.border.subtle}, {semantic.border.focus}, {semantic.text.primary}, {semantic.density.compact.controlHeight}, {semantic.radius.md}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Select` appears in a dark engineering panel, uses manifest ID `CMP-FORM-SELECT`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Select` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-FORM-SELECT` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-FORM-SELECT` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: observed-in-mockups, reference-backed-standard.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-FORM-COMBOBOX — Combobox

### Purpose
CMP-FORM-COMBOBOX defines searchable selection for long or dynamic option lists. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use combobox when the interface needs searchable selection for long or dynamic option lists.

### When not to use
Avoid combobox when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: single, async, creatable-reserved. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, open, filtering, no-results, disabled. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.inset}, {semantic.border.subtle}, {semantic.border.focus}, {semantic.text.primary}, {semantic.density.compact.controlHeight}, {semantic.radius.md}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Combobox` appears in a dark engineering panel, uses manifest ID `CMP-FORM-COMBOBOX`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Combobox` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-FORM-COMBOBOX` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-FORM-COMBOBOX` is referenced exactly.
- Coverage treatment: Tier 2 — standard specification; manifest coverage: reference-backed-standard, inferred-engineering-need.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-FORM-TEXTAREA — Textarea

### Purpose
CMP-FORM-TEXTAREA defines multi-line free-text entry for notes, comments, and descriptions. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use textarea when the interface needs multi-line free-text entry for notes, comments, and descriptions.

### When not to use
Avoid textarea when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: default, resizable, fixed. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, focus, invalid, disabled. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.inset}, {semantic.border.subtle}, {semantic.border.focus}, {semantic.text.primary}, {semantic.density.compact.controlHeight}, {semantic.radius.md}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Textarea` appears in a dark engineering panel, uses manifest ID `CMP-FORM-TEXTAREA`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Textarea` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-FORM-TEXTAREA` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-FORM-TEXTAREA` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: reference-backed-standard, prd-required.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-FORM-CHECKBOX — Checkbox

### Purpose
CMP-FORM-CHECKBOX defines binary or multi-select boolean selection. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use checkbox when the interface needs binary or multi-select boolean selection.

### When not to use
Avoid checkbox when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: single, grouped. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: unchecked, checked, indeterminate, focus, disabled. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.inset}, {semantic.border.subtle}, {semantic.border.focus}, {semantic.text.primary}, {semantic.density.compact.controlHeight}, {semantic.radius.md}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Checkbox` appears in a dark engineering panel, uses manifest ID `CMP-FORM-CHECKBOX`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Checkbox` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-FORM-CHECKBOX` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-FORM-CHECKBOX` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: reference-backed-standard, prd-required.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-FORM-RADIO-GROUP — Radio Group

### Purpose
CMP-FORM-RADIO-GROUP defines exclusive selection from a small set of choices. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use radio group when the interface needs exclusive selection from a small set of choices.

### When not to use
Avoid radio group when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: vertical, horizontal. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, focus, disabled. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.inset}, {semantic.border.subtle}, {semantic.border.focus}, {semantic.text.primary}, {semantic.density.compact.controlHeight}, {semantic.radius.md}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Radio Group` appears in a dark engineering panel, uses manifest ID `CMP-FORM-RADIO-GROUP`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Radio Group` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-FORM-RADIO-GROUP` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-FORM-RADIO-GROUP` is referenced exactly.
- Coverage treatment: Tier 2 — standard specification; manifest coverage: reference-backed-standard.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-FORM-SWITCH — Switch

### Purpose
CMP-FORM-SWITCH defines immediate binary setting toggle. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use switch when the interface needs immediate binary setting toggle.

### When not to use
Avoid switch when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: default, compact. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: off, on, focus, disabled. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.inset}, {semantic.border.subtle}, {semantic.border.focus}, {semantic.text.primary}, {semantic.density.compact.controlHeight}, {semantic.radius.md}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Switch` appears in a dark engineering panel, uses manifest ID `CMP-FORM-SWITCH`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Switch` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-FORM-SWITCH` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-FORM-SWITCH` is referenced exactly.
- Coverage treatment: Tier 2 — standard specification; manifest coverage: reference-backed-standard.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-FORM-DATE-TIME-INPUT — Date Time Input

### Purpose
CMP-FORM-DATE-TIME-INPUT defines date, time, or timestamp entry for engineering records and filters. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use date time input when the interface needs date, time, or timestamp entry for engineering records and filters.

### When not to use
Avoid date time input when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: date, time, datetime. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, focus, invalid, disabled. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.inset}, {semantic.border.subtle}, {semantic.border.focus}, {semantic.text.primary}, {semantic.density.compact.controlHeight}, {semantic.radius.md}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Date Time Input` appears in a dark engineering panel, uses manifest ID `CMP-FORM-DATE-TIME-INPUT`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Date Time Input` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-FORM-DATE-TIME-INPUT` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-FORM-DATE-TIME-INPUT` is referenced exactly.
- Coverage treatment: Tier 2 — standard specification; manifest coverage: reference-backed-standard, inferred-engineering-need.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-FORM-FILE-DROPZONE — File Dropzone

### Purpose
CMP-FORM-FILE-DROPZONE defines drag-and-drop or browse file intake for artifacts and imports. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use file dropzone when the interface needs drag-and-drop or browse file intake for artifacts and imports.

### When not to use
Avoid file dropzone when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: single, multiple, restricted-type. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, drag-over, uploading, error, disabled. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.inset}, {semantic.border.subtle}, {semantic.border.focus}, {semantic.text.primary}, {semantic.density.compact.controlHeight}, {semantic.radius.md}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `File Dropzone` appears in a dark engineering panel, uses manifest ID `CMP-FORM-FILE-DROPZONE`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `File Dropzone` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-FORM-FILE-DROPZONE` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-FORM-FILE-DROPZONE` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: prd-required, inferred-engineering-need.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-FILTER-SEARCH-FIELD — Search Field

### Purpose
CMP-FILTER-SEARCH-FIELD defines keyword filtering across tables, artifacts, and records. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use search field when the interface needs keyword filtering across tables, artifacts, and records.

### When not to use
Avoid search field when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: global, table, panel. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, typing, clearable, disabled. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.inset}, {semantic.accent.primary}, {semantic.border.subtle}, {semantic.radius.pill}, {semantic.density.compact.controlHeight}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Search Field` appears in a dark engineering panel, uses manifest ID `CMP-FILTER-SEARCH-FIELD`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Search Field` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-FILTER-SEARCH-FIELD` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-FILTER-SEARCH-FIELD` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: observed-in-mockups, reference-backed-standard.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-FILTER-BAR — Filter Bar

### Purpose
CMP-FILTER-BAR defines a compact control region for filtering high-density datasets. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use filter bar when the interface needs a compact control region for filtering high-density datasets.

### When not to use
Avoid filter bar when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: table, dashboard, artifact. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, dirty, disabled. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.inset}, {semantic.accent.primary}, {semantic.border.subtle}, {semantic.radius.pill}, {semantic.density.compact.controlHeight}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Filter Bar` appears in a dark engineering panel, uses manifest ID `CMP-FILTER-BAR`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Filter Bar` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-FILTER-BAR` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-FILTER-BAR` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: observed-in-mockups, prd-required.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-FILTER-CHIP — Filter Chip

### Purpose
CMP-FILTER-CHIP defines a compact representation of an active filter. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use filter chip when the interface needs a compact representation of an active filter.

### When not to use
Avoid filter chip when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: removable, read-only, status. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, hover, focus, selected. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.inset}, {semantic.accent.primary}, {semantic.border.subtle}, {semantic.radius.pill}, {semantic.density.compact.controlHeight}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Filter Chip` appears in a dark engineering panel, uses manifest ID `CMP-FILTER-CHIP`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Filter Chip` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-FILTER-CHIP` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-FILTER-CHIP` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: observed-in-mockups, reference-backed-standard.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.
