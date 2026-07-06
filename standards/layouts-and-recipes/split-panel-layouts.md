# Split Panel Layouts

## Purpose

Split-panel recipes support list/detail and compare/review workflows.

## Scope

Use split panels for artifact browsing, component inspection, standards review, generated output comparison, and evidence inspection.

## RCP-SPLIT-001 — List/detail split panel

### Purpose
Show a selectable collection and the details for the selected item in one workflow.

### When to use
Use when users need to move through a set of related records while preserving context.

### When not to use
Do not use when either pane becomes unreadable or when a detail page is required for depth.

### Required regions
List/filter pane, detail pane, selected item state, empty state.

### Optional regions
Preview drawer, evidence panel, local toolbar.

### Required components
`CMP-LAYOUT-SPLIT-PANEL`, `CMP-TABLE-DATA-TABLE` or `CMP-ENG-ARTIFACT-TREE`, and `CMP-LAYOUT-DETAIL`.

### Allowed actions
Select item, filter, open full detail, copy ID/path, inspect evidence.

### State model
Support no selection, selected, missing detail, loading detail, and error.

### Loading state
Keep list visible while detail loads.

### Empty state
Show no-selection guidance in the detail pane.

### Error state
Show detail error without losing list selection.

### Offline or stale state where applicable
Mark selected detail stale if source changes.

### Responsive behavior
At narrow widths, convert to list then detail route or stacked panels.

### Accessibility notes
Selected state shall be programmatic and visible.

### Approved example
Artifact tree on the left, selected artifact metadata and evidence on the right.

### Rejected example
Two cramped panes with hidden selected state and no full-detail escape.

### Agent transformation rules
Do not add resizable behavior unless validated. Use fixed or responsive panels first.

### Validation checks
- Selection state visible.
- Both panes readable.
- Empty and error states scoped.
- Resizable behavior not assumed unless validated.

## RCP-SPLIT-002 — Compare/review split panel

### Purpose
Show source and generated/reviewed content side by side.

### When to use
Use where users must compare standards source, generated handoff content, diffs, or validation findings.

### When not to use
Do not use for unrelated content or when comparison does not affect a decision.

### Required regions
Left source/reference pane, right candidate/result pane, comparison status, review actions.

### Optional regions
Diff markers, issue list, synchronized scrolling if later validated.

### Required components
`CMP-LAYOUT-SPLIT-PANEL`, `CMP-ENG-CODE-BLOCK`, `CMP-ENG-LOG-VIEWER`, `CMP-ENG-EVIDENCE-CARD`, and status components.

### Allowed actions
Copy, open source, mark reviewed, validate, export, and open full detail.

### State model
Support matched, changed, stale, missing source, missing candidate, and failed comparison.

### Loading state
Show which side is loading.

### Empty state
Explain what source/candidate is missing.

### Error state
Identify failed side and source.

### Offline or stale state where applicable
Mark stale candidate clearly.

### Responsive behavior
Stack source above candidate with clear labels.

### Accessibility notes
Comparison shall be understandable without color-only diff cues.

### Approved example
Standards excerpt on the left and generated handoff packet preview on the right with issue summary.

### Rejected example
Two unlabeled scroll panes with color-only differences.

### Agent transformation rules
Treat `CMP-LAYOUT-RESIZABLE-PANEL` and `CMP-ENG-DIFF-VIEWER` as reserved unless later validated.

### Validation checks
- Pane roles labeled.
- Comparison result text present.
- Reserved components not treated as finalized.

## Panel Roles

Each pane shall have a clear role such as source, list, detail, preview, evidence, or result.

## Resize Rules

Resizable panels are reserved pending validation. Fixed or responsive sizes are acceptable in Phase 3.

## Selection State

Selection state shall be visible and programmatic.

## Empty and Error States

State shall be scoped to the affected pane.

## Accessibility Notes

Do not rely on color alone for selection or comparison.

## Approved Split Panel Pattern

Approved: labeled panes, readable content, visible selected state, scoped errors.

## Rejected Split Panel Patterns

Rejected: cramped panes, unlabeled compare regions, and unvalidated resizable behavior presented as final.
