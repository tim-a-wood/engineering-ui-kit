# Interaction Model

## Purpose

This file defines cross-component interaction rules for Engineering UI Kit workflows.

## Scope

The rules apply to commands, previews, overlays, validation, selection, loading, dirty state, disabled state, copying, exporting, and feedback.

## FND-INT-001 — Manual control for consequential actions

Generation, export, destructive actions, and overlay application shall require an explicit user action. Non-mutating health checks and preview startup may run automatically when entering the relevant view, provided their activity and results are visible and a manual retry is available. The UI shall never silently apply consequential changes.

## FND-INT-002 — Preview before apply

Generated content, handoff packets, destructive edits, and overwrite operations should provide a preview or summary before final apply where practical.

## FND-INT-003 — Visible command text before execution

Commands that run external tools, validation, or generation shall show the command label and meaningful parameters before execution when those parameters affect output.

## FND-INT-004 — Loading and progress honesty

Loading states shall communicate whether work is pending, running, complete, failed, blocked, or partially complete. Long operations shall not use spinner-only feedback.

## FND-INT-005 — Dirty state and unsaved changes

Editable screens shall expose unsaved or stale state and shall warn before losing changes when practical.

## FND-INT-006 — Disabled states must explain why when consequential

Disabled primary or destructive actions shall provide visible help text, tooltip, or validation summary explaining what blocks the action.

## FND-INT-007 — Keyboard and focus order

Focus order shall follow visual and workflow order. Opening overlays shall move focus intentionally; closing overlays shall restore focus.

## FND-INT-008 — Selection behavior

Selected rows, panels, tabs, or artifacts shall have visible selected state and programmatic selected state when interactive.

## FND-INT-009 — Copy and export interactions

Copy/export actions shall identify exactly what was copied/exported and where output can be found. Sensitive or stale content should be identified before export.

## FND-INT-010 — Toasts, alerts, and persistent feedback

Use toasts for transient confirmations, alerts for important but local issues, and persistent panels for consequential validation, generation, or failure state.

## FND-INT-011 — Full-row navigation

When a list row has one destination, make the full row the accessible target. Do not add a redundant `Open`, `Continue`, or arrow button inside it. Provide hover and visible keyboard focus without turning the row into a raised card.

## FND-INT-012 — Native file handoff

File-oriented workflows should provide both browse and drag-and-drop intake. Prepared outbound files should support native drag-out and an equivalent copy action. Drop zones shall state accepted content, show the selected filename, and remain keyboard operable.

## FND-INT-013 — Preview before implementation exists

When a preview target is not yet running, preserve the preview region with a clearly labeled placeholder canvas. Show the intended local URL and a retry action. Do not present the expected absence of an app as a primary error state.

## Interaction Anti-Patterns

- One-click destructive actions with no consequence summary.
- Hidden automation that modifies generated output without review.
- Disabled buttons with no explanation.
- Status updates that disappear before the user can inspect them.
- Focus lost after closing a dialog or drawer.
