# Feedback and Status

## Purpose

Feedback and status components tell users what is known, what is running, what passed, what failed, what is blocked, and what needs review.

## Scope

This file owns status vocabulary, status badges, job indicators, loading, errors, alerts, toasts, progress, validation summaries, workflow step indicators, timeline logs, empty states, metric cards, and key-value lists.

## Status Vocabulary

| Status | Use |
|---|---|
| `Not run` | Work has not started. |
| `Running` | Work is actively executing. |
| `Passed` | Validation or run completed successfully. |
| `Failed` | Validation or run completed with failure. |
| `Blocked` | Required precondition prevents progress. |
| `Needs review` | Human review is required before apply/export. |
| `Applied` | A change has been applied. |
| `Generated` | Output has been generated but may still need review. |
| `Out of date` | Output no longer matches source inputs. |

## Status Badge

Status badges shall include text and may include icon or shape. They shall not rely on color alone.

## Job Status Indicator

Job indicators shall show queued/running/complete/failed/blocked state, current operation where known, and link to logs or evidence when available.

## Loading State

Loading state shall preserve layout context. Long-running operations shall include meaningful labels and progress where known.

## Error State

Error state shall describe what failed, affected artifact, likely cause where known, and next action where known.

## Alert

Alerts shall be used for important contextual messages that need to persist until resolved or acknowledged.

## Toast

Toasts shall be used only for transient, non-critical confirmations or notices. Critical errors and validation failures shall not be toast-only.

## Progress Indicator

Progress indicators shall not imply precision when progress is indeterminate. Use steps, percent, counts, or status text only where truthful.

## Validation Summary

Validation summaries shall list blocking issues and link to affected fields, components, files, or validation gates.

## Persistent vs Temporary Feedback

Feedback affecting implementation correctness, data loss, validation, or export readiness shall persist in the screen. Temporary feedback is allowed only where missing it does not change the user’s ability to proceed safely.

## Accessibility Rules

Use appropriate live regions for timely status updates, but avoid noisy announcements. Ensure all status is conveyed by text, not color alone.

## Approved Feedback Patterns

- Persistent validation summary with linked issues.
- Job indicator with status text and log link.
- Toast confirming a completed copy action.

## Rejected Feedback Patterns

- Disappearing critical errors.
- Spinner-only long operation.
- Green/red color badge with no text.
- Success state that hides warnings or stale source context.


## CMP-FEEDBACK-LOADING-STATE — Loading State

### Purpose
CMP-FEEDBACK-LOADING-STATE defines temporary state while content, jobs, or artifacts load. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use loading state when the interface needs temporary state while content, jobs, or artifacts load.

### When not to use
Avoid loading state when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: spinner, skeleton, inline. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: loading, slow. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.panelRaised}, {semantic.border.strong}, {semantic.status.info}, {semantic.status.danger}, {semantic.radius.md}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Loading State` appears in a dark engineering panel, uses manifest ID `CMP-FEEDBACK-LOADING-STATE`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Loading State` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-FEEDBACK-LOADING-STATE` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-FEEDBACK-LOADING-STATE` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: observed-in-mockups, reference-backed-standard.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-FEEDBACK-ERROR-STATE — Error State

### Purpose
CMP-FEEDBACK-ERROR-STATE defines recoverable error presentation for failed loads, validation, or workflows. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use error state when the interface needs recoverable error presentation for failed loads, validation, or workflows.

### When not to use
Avoid error state when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: panel, inline, page. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: error, retrying. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.panelRaised}, {semantic.border.strong}, {semantic.status.info}, {semantic.status.danger}, {semantic.radius.md}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Error State` appears in a dark engineering panel, uses manifest ID `CMP-FEEDBACK-ERROR-STATE`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Error State` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-FEEDBACK-ERROR-STATE` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-FEEDBACK-ERROR-STATE` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: reference-backed-standard, prd-required.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-FEEDBACK-ALERT — Alert

### Purpose
CMP-FEEDBACK-ALERT defines prominent message for important contextual feedback. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use alert when the interface needs prominent message for important contextual feedback.

### When not to use
Avoid alert when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: info, success, warning, danger. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, dismissible. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.panelRaised}, {semantic.border.strong}, {semantic.status.info}, {semantic.status.danger}, {semantic.radius.md}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Alert` appears in a dark engineering panel, uses manifest ID `CMP-FEEDBACK-ALERT`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Alert` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-FEEDBACK-ALERT` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-FEEDBACK-ALERT` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: reference-backed-standard, prd-required.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-FEEDBACK-TOAST — Toast

### Purpose
CMP-FEEDBACK-TOAST defines temporary non-blocking system feedback. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use toast when the interface needs temporary non-blocking system feedback.

### When not to use
Avoid toast when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: info, success, warning, danger. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: entering, visible, exiting. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.panelRaised}, {semantic.border.strong}, {semantic.status.info}, {semantic.status.danger}, {semantic.radius.md}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Toast` appears in a dark engineering panel, uses manifest ID `CMP-FEEDBACK-TOAST`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Toast` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-FEEDBACK-TOAST` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-FEEDBACK-TOAST` is referenced exactly.
- Coverage treatment: Tier 2 — standard specification; manifest coverage: reference-backed-standard.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-FEEDBACK-PROGRESS-INDICATOR — Progress Indicator

### Purpose
CMP-FEEDBACK-PROGRESS-INDICATOR defines linear, circular, or inline indication of task progress. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use progress indicator when the interface needs linear, circular, or inline indication of task progress.

### When not to use
Avoid progress indicator when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: linear, circular, inline. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: idle, running, complete, failed. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.panelRaised}, {semantic.border.strong}, {semantic.status.info}, {semantic.status.danger}, {semantic.radius.md}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Progress Indicator` appears in a dark engineering panel, uses manifest ID `CMP-FEEDBACK-PROGRESS-INDICATOR`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Progress Indicator` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-FEEDBACK-PROGRESS-INDICATOR` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-FEEDBACK-PROGRESS-INDICATOR` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: observed-in-mockups, prd-required.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-FEEDBACK-VALIDATION-SUMMARY — Validation Summary

### Purpose
CMP-FEEDBACK-VALIDATION-SUMMARY defines summary of validation errors, warnings, and blocker status. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use validation summary when the interface needs summary of validation errors, warnings, and blocker status.

### When not to use
Avoid validation summary when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: form, page, package. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: valid, warning, error. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.surface.panelRaised}, {semantic.border.strong}, {semantic.status.info}, {semantic.status.danger}, {semantic.radius.md}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Validation Summary` appears in a dark engineering panel, uses manifest ID `CMP-FEEDBACK-VALIDATION-SUMMARY`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Validation Summary` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-FEEDBACK-VALIDATION-SUMMARY` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-FEEDBACK-VALIDATION-SUMMARY` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: prd-required, reference-backed-standard.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-STATUS-BADGE — Status Badge

### Purpose
CMP-STATUS-BADGE defines compact visual state indication. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use status badge when the interface needs compact visual state indication.

### When not to use
Avoid status badge when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: success, warning, danger, info, neutral, running, pending. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, active. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.status.success}, {semantic.status.warning}, {semantic.status.danger}, {semantic.status.neutral}, {semantic.radius.pill}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Status Badge` appears in a dark engineering panel, uses manifest ID `CMP-STATUS-BADGE`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Status Badge` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-STATUS-BADGE` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-STATUS-BADGE` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: observed-in-mockups, prd-required.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-STATUS-JOB-INDICATOR — Job Status Indicator

### Purpose
CMP-STATUS-JOB-INDICATOR defines job execution state for queued, running, completed, or failed work. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use job status indicator when the interface needs job execution state for queued, running, completed, or failed work.

### When not to use
Avoid job status indicator when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: queued, running, passed, failed, cancelled. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: pending, running, success, danger. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.status.success}, {semantic.status.warning}, {semantic.status.danger}, {semantic.status.neutral}, {semantic.radius.pill}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Job Status Indicator` appears in a dark engineering panel, uses manifest ID `CMP-STATUS-JOB-INDICATOR`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Job Status Indicator` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-STATUS-JOB-INDICATOR` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-STATUS-JOB-INDICATOR` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: observed-in-mockups, prd-required.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-WORKFLOW-STEP-INDICATOR — Step Indicator

### Purpose
CMP-WORKFLOW-STEP-INDICATOR defines visible progress through a multi-step workflow. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use a step indicator when the interface has three or more genuinely sequential, validation-gated phases and visible completion state materially aids orientation.

### When not to use
Avoid a step indicator for two related modes, simple pages, local tabs, or when page titles and a labeled transition communicate the state with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: horizontal, vertical, compact. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: not-started, current, complete, error. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.accent.primary}, {semantic.status.running}, {semantic.status.pending}, {semantic.border.subtle}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Step Indicator` appears in a dark engineering panel, uses manifest ID `CMP-WORKFLOW-STEP-INDICATOR`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Step Indicator` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-WORKFLOW-STEP-INDICATOR` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-WORKFLOW-STEP-INDICATOR` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: reference-backed-standard, prd-required.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-WORKFLOW-TIMELINE-EVENT-LOG — Timeline Event Log

### Purpose
CMP-WORKFLOW-TIMELINE-EVENT-LOG defines chronological activity and execution history. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use timeline event log when the interface needs chronological activity and execution history.

### When not to use
Avoid timeline event log when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: timeline, audit-log, compact. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, filtered, empty. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.accent.primary}, {semantic.status.running}, {semantic.status.pending}, {semantic.border.subtle}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Timeline Event Log` appears in a dark engineering panel, uses manifest ID `CMP-WORKFLOW-TIMELINE-EVENT-LOG`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Timeline Event Log` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-WORKFLOW-TIMELINE-EVENT-LOG` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-WORKFLOW-TIMELINE-EVENT-LOG` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: prd-required, inferred-engineering-need.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-CONTENT-EMPTY-STATE — Empty State

### Purpose
CMP-CONTENT-EMPTY-STATE defines clear guidance when a panel, table, or workflow has no data. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use empty state when the interface needs clear guidance when a panel, table, or workflow has no data.

### When not to use
Avoid empty state when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: default, actionable, no-results. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.text.primary}, {semantic.text.secondary}, {semantic.text.muted}, {semantic.spacing.4}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Empty State` appears in a dark engineering panel, uses manifest ID `CMP-CONTENT-EMPTY-STATE`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Empty State` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-CONTENT-EMPTY-STATE` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-CONTENT-EMPTY-STATE` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: reference-backed-standard, prd-required.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-CONTENT-METRIC-CARD — Metric Card

### Purpose
CMP-CONTENT-METRIC-CARD defines compact summary of a key count, status, or metric. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use metric card when the interface needs compact summary of a key count, status, or metric.

### When not to use
Avoid metric card when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: standard, trend, status. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default, warning, danger, loading. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.text.primary}, {semantic.text.secondary}, {semantic.text.muted}, {semantic.spacing.4}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Metric Card` appears in a dark engineering panel, uses manifest ID `CMP-CONTENT-METRIC-CARD`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Metric Card` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-CONTENT-METRIC-CARD` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-CONTENT-METRIC-CARD` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: observed-in-mockups, prd-required.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.


## CMP-CONTENT-KEY-VALUE-LIST — Key Value List

### Purpose
CMP-CONTENT-KEY-VALUE-LIST defines compact display of metadata pairs. It shall be used as a stable Engineering UI Kit component reference when this UI need appears in an engineering workflow screen.

### When to use
Use key value list when the interface needs compact display of metadata pairs.

### When not to use
Avoid key value list when a simpler native element or existing component communicates the same intent with less complexity.

### Anatomy
Use the smallest anatomy that preserves clarity: a visible label or heading where applicable, a bounded content region, explicit state indicators, and actions grouped by consequence. Icon-only affordances shall have accessible names.

### Variants
Approved variants: default, two-column, dense. Variants shall be selected by workflow need, not by decorative preference.

### States
Required states: default. Interactive implementations shall also support keyboard focus, disabled where applicable, loading where applicable, and invalid/error where applicable.

### Behavior
The component shall preserve explicit engineering context. Consequential actions shall remain visible, predictable, and reviewable. Long-running or data-dependent behavior shall expose state rather than silently changing content.

### Accessibility
Follow `FND-A11Y-*`. The component shall expose a semantic role, accessible name, visible focus treatment using `{semantic.focus.ring}`, sufficient contrast in the dark theme, and non-color cues for critical status.

### Token usage
Use semantic or component alias tokens only. Primary references: {semantic.text.primary}, {semantic.text.secondary}, {semantic.text.muted}, {semantic.spacing.4}. Raw color values shall not appear in the component spec or generated implementation.

### Content rules
Use stable engineering nouns and specific state labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Generated`, and `Out of date` where relevant.

### Layout rules
Place the component inside the relevant shell, panel, table, form, overlay, or recipe region. It shall not create a new page layout by itself.

### Approved example
Compliant use: `Key Value List` appears in a dark engineering panel, uses manifest ID `CMP-CONTENT-KEY-VALUE-LIST`, uses semantic token references, exposes state text, and links status or evidence to the underlying artifact when applicable.

### Rejected example
Non-compliant use: `Key Value List` is rendered as a generic decorative widget, uses hard-coded colors, hides important state, or has no accessible name.

### Agent notes
Implementation agents shall keep `CMP-CONTENT-KEY-VALUE-LIST` stable, preserve dark-first token usage, reuse existing layout recipes, and avoid inventing app features to showcase the component.

### Validation checks
- Manifest ID `CMP-CONTENT-KEY-VALUE-LIST` is referenced exactly.
- Coverage treatment: Tier 1 — full operational specification; manifest coverage: observed-in-mockups, reference-backed-standard.
- Uses only approved token names.
- Supports required states and visible focus.
- Does not contradict the PRD, mockup calibration posture, or reserved-component rules.
