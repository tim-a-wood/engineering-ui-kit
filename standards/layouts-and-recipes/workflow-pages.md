# Workflow Pages

## Purpose

Workflow page recipes define multi-step engineering flows such as package validation, handoff generation, and review-before-export.

## Scope

This recipe aligns with Copilot/AI handoff hub workflows from the PRD without generating final Phase 4 handoff files.

## RCP-WORKFLOW-001 — Multi-step engineering workflow

### Purpose
Guide users through ordered technical work while preserving reviewability and explicit status.

### When to use
Use where users must select inputs, generate/preview output, validate results, and apply/export deliberately.

### When not to use
Do not use for simple one-screen settings or read-only detail views.

### Required regions
Step indicator, current step content, preview/review region, command/action region, and status/evidence region.

### Optional regions
Timeline event log, generated output preview, validation summary, side evidence drawer.

### Required components
`CMP-WORKFLOW-STEP-INDICATOR`, `CMP-FEEDBACK-PROGRESS-INDICATOR`, `CMP-FEEDBACK-VALIDATION-SUMMARY`, `CMP-NAV-COMMAND-ACTION-BAR`, and relevant form/table/evidence components.

### Allowed actions
Select input, preview, validate, apply, export, copy, cancel, and open evidence.

### State model
Support not started, in progress, needs review, blocked, failed, passed, generated, applied, and out-of-date states.

### Loading state
Show which step is running and whether the user can continue inspecting prior output.

### Empty state
Explain what input is missing before generation can begin.

### Error state
Show failed step, affected artifact, and next action where known.

### Offline or stale state where applicable
Mark previews and generated packets as stale when source inputs change.

### Responsive behavior
Stack preview below current step at narrow widths while keeping actions near their step.

### Accessibility notes
Step indicators shall expose current step and completion state. Review/preview regions shall be reachable by keyboard.

### Approved example
A handoff preparation workflow: choose scope, preview generated pack, validate, then export after review.

### Rejected example
A one-click `Generate everything` command with no preview, status, or consequence text.

### Agent transformation rules
Preserve manual control. Do not auto-apply generated output or hide validation failures.

### Validation checks
- Preview-before-apply present for consequential output.
- Current step and status visible.
- Blockers listed before export/apply.
- Generated content has stale-state handling.

## Step Indicator Use

Use step indicators for ordered workflow state, not for tab-like local navigation.

## Current Step Region

The current step contains the active inputs or decision.

## Preview and Review Region

Preview/review shall show generated output, validation issues, or evidence before apply/export.

## Command/Action Region

Commands shall be grouped by consequence and enabled only when prerequisites are met.

## Status and Evidence Region

Status and evidence shall remain visible after a step completes or fails.

## Error and Blocked States

Blocked states shall identify missing inputs or invalid contracts.

## Accessibility Notes

Keyboard and screen-reader users shall understand step order and current state.

## Approved Workflow Pattern

Approved: explicit steps, preview, validation, evidence, deliberate export.

## Rejected Workflow Patterns

Rejected: hidden automation, ambiguous one-click consequential actions, and output with no review state.

## RCP-TABLE-001 — Data table view

### Purpose

Present dense structured records with search, filters, sortable columns, text status
badges, and pagination, following the dark-first table standards.

### Required components

`CMP-TABLE-DATA-TABLE`, `CMP-FILTER-SEARCH-FIELD`, `CMP-STATUS-BADGE`,
`CMP-TABLE-PAGINATION`, `CMP-SHELL-PAGE-HEADER`.

### State model

Loading, ready, empty (with guidance text), and error states; sorting and filtering
are derived, never persisted implicitly.

### Accessibility notes

Semantic table markup with column headers and caption; status conveyed by text
badges; keyboard-operable controls with visible focus.

### Agent transformation rules

Use semantic surface and border tokens for row separation; keep row height compact
but readable; never convey status by color alone.
