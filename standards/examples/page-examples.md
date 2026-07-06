# Page Examples

## Purpose

These page examples describe regions and component usage without adding new product scope.

## Engineering Dashboard Page

Regions: app shell, page header, metric cards, validation status summary, component coverage table, recent evidence list. Components: `CMP-SHELL-APP`, `CMP-CONTENT-METRIC-CARD`, `CMP-STATUS-BADGE`, `CMP-TABLE-DATA-TABLE`, `CMP-ENG-EVIDENCE-CARD`.

## Workflow Page

Regions: step indicator, input form, preview panel, validation summary, command action bar, timeline log. Components: `CMP-WORKFLOW-STEP-INDICATOR`, `CMP-FORM-FIELD`, `CMP-FEEDBACK-VALIDATION-SUMMARY`, `CMP-NAV-COMMAND-ACTION-BAR`, `CMP-WORKFLOW-TIMELINE-EVENT-LOG`.

## Detail Page

Regions: entity header, metadata key-value list, source/evidence panel, related records table, scoped actions. Components: `CMP-LAYOUT-DETAIL`, `CMP-CONTENT-KEY-VALUE-LIST`, `CMP-ENG-EVIDENCE-CARD`, `CMP-TABLE-DATA-TABLE`.

## Split Review Page

Regions: source pane, candidate pane, issue summary, review actions. Components: `CMP-LAYOUT-SPLIT-PANEL`, `CMP-ENG-CODE-BLOCK`, `CMP-FEEDBACK-VALIDATION-SUMMARY`, `CMP-STATUS-BADGE`.

## Settings Page

Regions: settings form, current package metadata, validation state, save/revert command bar. Components: `CMP-FORM-FIELD`, `CMP-FORM-SELECT`, `CMP-FORM-SWITCH`, `CMP-FEEDBACK-ALERT`. Switches shall not be used for ambiguous destructive settings.

## Error Page

Regions: error summary, affected source, likely cause, next actions, log/evidence link. Components: `CMP-FEEDBACK-ERROR-STATE`, `CMP-ENG-LOG-VIEWER`, `CMP-NAV-COMMAND-ACTION-BAR`.
