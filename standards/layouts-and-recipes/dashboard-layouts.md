# Dashboard Layouts

## Purpose

Dashboard recipes define operational summaries for engineering work.

## Scope

Dashboards may summarize standards readiness, validation status, package health, component coverage, recent outputs, or workflow queues. They shall not become decorative KPI walls.

## RCP-DASH-001 — Engineering dashboard

### Purpose
Show the current engineering state and provide entry points to underlying evidence.

### When to use
Use for the first page of a standards, validation, or handoff tool where users need summary plus next actions.

### When not to use
Do not use a dashboard when the page has one primary task that is better represented as a workflow or detail page.

### Required regions
Summary metrics, status summary, evidence or recent activity, and primary next actions.

### Optional regions
Charts, component coverage, validation trend, recent artifacts, stale-source warning.

### Required components
`CMP-LAYOUT-DASHBOARD-GRID`, `CMP-CONTENT-METRIC-CARD`, `CMP-STATUS-BADGE`, `CMP-VIZ-CHART-PANEL`, and `CMP-TABLE-DATA-TABLE` where records are shown.

### Allowed actions
Open evidence, review blockers, validate package, generate preview, export current report, or open detail pages.

### State model
Support ready, warning, failed, stale, loading, partial, and empty states.

### Loading state
Load cards and tables independently where possible. Avoid full-screen spinner if partial summary data exists.

### Empty state
Explain what must be created, selected, or imported before the dashboard has content.

### Error state
Show failed source or validation area and link to logs/details.

### Offline or stale state where applicable
Show stale state near affected metrics and charts, not as a vague global warning only.

### Responsive behavior
Cards may wrap; tables and charts shall remain legible. Hide secondary charts before hiding status/evidence.

### Accessibility notes
Each metric shall have text label and value. Charts shall have summaries. Status shall not be color-only.

### Approved example
A package dashboard with metric cards for components, tokens, validation gates, and blockers, plus links to detailed validation results.

### Rejected example
A vanity dashboard with unrelated analytics, decorative charts, and no route to underlying evidence.

### Agent transformation rules
Keep dashboard summaries tied to engineering evidence. Do not invent unrelated KPIs.

### Validation checks
- Summary cards link to detail/evidence where applicable.
- Status text present.
- Charts/tables use component IDs.
- No generic SaaS drift.

## Metric Card Use

Metric cards shall summarize meaningful engineering counts, states, or readiness. They should link to source details when the value affects decisions.

## Status Summary Use

Status summaries shall distinguish passed, failed, blocked, warning, and stale state using text and status tokens.

## Chart Panel Use

Charts are optional and shall answer a clear engineering question.

## Table Summary Use

Tables are preferred where individual records need inspection.

## Empty/Loading/Error States

State handling shall happen at the smallest meaningful region.

## Density and Responsiveness

Use compact density without hiding labels, units, or evidence links.

## Accessibility Notes

Dashboard regions shall use headings and accessible summaries.

## Approved Dashboard Pattern

Approved: operational status, evidence links, compact summary, dark-first panels.

## Rejected Dashboard Patterns

Rejected: vanity KPI wall, unrelated charts, animated decorative metrics, and white-card admin templates.
