# Detail Pages

## Purpose

Detail page recipes define how to inspect a single engineering entity.

## Scope

Entities may include artifacts, projects, runs, files, components, recipes, validation gates, or handoff packets.

## RCP-DETAIL-001 — Entity detail page

### Purpose
Expose one entity’s identity, metadata, status, evidence, relationships, and actions.

### When to use
Use when users need to inspect or act on a specific item selected from a list, table, tree, search result, or dashboard.

### When not to use
Do not use for broad summaries or multi-step generation flows.

### Required regions
Header/metadata, primary detail, supporting evidence, related items, and actions.

### Optional regions
Timeline, log excerpt, source preview, validation summary, diff summary, drawer for related evidence.

### Required components
`CMP-LAYOUT-DETAIL`, `CMP-CONTENT-KEY-VALUE-LIST`, `CMP-STATUS-BADGE`, `CMP-ENG-EVIDENCE-CARD`, and relevant table/artifact components.

### Allowed actions
Open source, copy path/ID, validate, regenerate preview, export evidence, mark reviewed, or open related items.

### State model
Support default, stale, invalid, missing evidence, loading, error, and no-related-items states.

### Loading state
Load header identity first where possible, then evidence and related lists.

### Empty state
If supporting evidence is missing, explain whether it has not been generated or cannot be found.

### Error state
Show which entity failed to load and what source produced the failure.

### Offline or stale state where applicable
Show stale source context in the header and affected panels.

### Responsive behavior
Metadata can collapse into stacked key-value groups. Actions remain near the header or affected section.

### Accessibility notes
Use clear heading hierarchy and link labels that identify destination artifacts.

### Approved example
A component detail page with manifest metadata, token references, validation state, examples, and related recipe links.

### Rejected example
A wall of unstructured text with hidden status, no evidence, and no source links.

### Agent transformation rules
Preserve entity identity, evidence, status, and relationships. Do not replace detail pages with summary cards alone.

### Validation checks
- Entity title and ID visible.
- Status/evidence visible.
- Actions scoped to entity.
- Related items are labeled and accessible.

## Header and Metadata Region

The header shall identify the entity and high-level state. Key metadata shall be compact and scannable.

## Primary Detail Region

The primary region contains the main content users came to inspect.

## Supporting Evidence Region

Evidence shall link to validation results, source files, logs, or generated outputs where available.

## Related Items Region

Related items shall be grouped by relationship type.

## Actions

Actions shall state their consequence and affect only the scoped entity unless clearly labeled otherwise.

## State Handling

Missing, stale, invalid, and blocked detail states shall be explicit.

## Accessibility Notes

Maintain heading hierarchy and descriptive links.

## Approved Detail Pattern

Approved: header, metadata, evidence panels, related items, scoped actions.

## Rejected Detail Patterns

Rejected: unstructured wall-of-text detail, hidden source context, and unlabeled related links.
