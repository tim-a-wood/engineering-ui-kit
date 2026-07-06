# Approved Patterns

## Purpose

Approved examples show representative ways to apply the standards. They are not new app requirements.

## How to Use These Examples

Use examples as implementation and review references. Match the rule intent, component IDs, and token posture rather than copying layout blindly.

## EX-APPROVED-001 — Dark engineering app shell

**Demonstrates:** `LAY-SHELL-001`, `FND-VIS-001`, `CMP-SHELL-APP`, `CMP-NAV-PRIMARY`, `CMP-SHELL-PAGE-HEADER`.  
**Why compliant:** The screen uses a dark canvas, bounded panels, active navigation, concise page metadata, and visible command/status regions.  
**Agent notes:** Preserve shell regions and use semantic surface tokens.

## EX-APPROVED-002 — Panel-based workflow page

**Demonstrates:** `RCP-WORKFLOW-001`, `FND-INT-002`, `CMP-WORKFLOW-STEP-INDICATOR`, `CMP-FEEDBACK-VALIDATION-SUMMARY`.  
**Why compliant:** Inputs, preview, validation, and export are separate. Consequential output is reviewed before apply/export.  
**Agent notes:** Keep generation status persistent and mark stale previews.

## EX-APPROVED-003 — Dense data table with status

**Demonstrates:** `CMP-TABLE-DATA-TABLE`, `CMP-TABLE-COLUMN-HEADER`, `CMP-STATUS-BADGE`, `FND-A11Y-006`.  
**Why compliant:** Headers, sort state, status text, row actions, and compact density are all visible.  
**Agent notes:** Use table tokens and avoid color-only badges.

## EX-APPROVED-004 — Form with validation summary

**Demonstrates:** `CMP-FORM-FIELD`, `CMP-FORM-TEXT-INPUT`, `CMP-FEEDBACK-VALIDATION-SUMMARY`, `FND-A11Y-009`.  
**Why compliant:** Fields have labels, hints, linked errors, and a summary for blocked submission.  
**Agent notes:** Do not use placeholders as labels.

## EX-APPROVED-005 — Chart panel with engineering context

**Demonstrates:** `CMP-VIZ-CHART-PANEL`, `CMP-VIZ-LINE-CHART`, `CMP-VIZ-LEGEND`, `FND-VIS-008`.  
**Why compliant:** The chart includes title, units, data source, legend, state, and text summary.  
**Agent notes:** Mention ECharts only as candidate implementation context, not a hard dependency.

## EX-APPROVED-006 — Confirmation dialog for destructive action

**Demonstrates:** `CMP-OVERLAY-CONFIRMATION-DIALOG`, `FND-CONTENT-009`, `FND-INT-001`.  
**Why compliant:** The dialog names the affected artifact, consequence, reversibility, cancel action, and destructive action.  
**Agent notes:** Focus must move into the dialog and return to the trigger.

## EX-APPROVED-007 — Empty state with next action

**Demonstrates:** `CMP-CONTENT-EMPTY-STATE`, state recipe, and content rules.  
**Why compliant:** The state explains why no content exists and offers a scoped next action without implying success.  
**Agent notes:** Place the empty state inside the affected panel or table.

## Traceability

Examples are derived from PRD workflows, Phase 2 component and token contracts, mockup calibration, and public accessibility/component research.
