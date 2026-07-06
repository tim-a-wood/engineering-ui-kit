# Application Shell

## Purpose

The application shell defines the standard dark frame for Engineering UI Kit applications.

## Scope

The shell applies to lightweight desktop/web-style tools using the standards package. It covers persistent regions, page headers, navigation, main content, command/status regions, density, responsiveness, and accessibility.

## LAY-SHELL-001 — Standard engineering app shell

### Purpose
The shell shall provide stable orientation, visible app context, and a predictable place for navigation, page metadata, commands, and status.

### When to use
Use this shell for multi-page or multi-workflow engineering tools where users move between standards, assets, validation, and handoff tasks.

### When not to use
Do not use the shell for standalone dialogs, small embedded widgets, marketing pages, or one-off prototypes that do not need navigation.

### Required regions
Top bar, primary navigation or equivalent persistent navigation, page header, main content region, command/status region where applicable, and global feedback region.

### Optional regions
Secondary navigation, breadcrumb trail, side panel, bottom status strip, or drawer trigger.

### Required components
`CMP-SHELL-APP`, `CMP-SHELL-TOP-BAR`, `CMP-NAV-PRIMARY`, `CMP-SHELL-PAGE-HEADER`, `CMP-NAV-COMMAND-ACTION-BAR`, and `CMP-SURFACE-PANEL`.

### Allowed actions
Navigation, search, open artifact, generate preview, validate, export, copy, and safe settings changes. Destructive actions require explicit confirmation.

### State model
The shell shall support default, active navigation, loading, error, offline/stale, and blocked states. Global status shall not obscure page-level status.

### Loading state
Show page-level loading inside the main region. Keep shell navigation visible unless the whole app is unavailable.

### Empty state
Empty content belongs inside the main content region, not in the top bar or navigation.

### Error state
Global errors may appear in a persistent alert region. Page-specific errors belong inside the affected page or panel.

### Offline or stale state where applicable
Show stale standards, stale preview, or disconnected source status in the page header or persistent status region.

### Responsive behavior
Collapse secondary panels before removing core actions. Primary navigation may collapse, but active state and accessible names shall remain available.

### Accessibility notes
Use landmarks for shell regions. Focus order shall move from navigation to page header to main content to local actions. Skip-to-content support should be provided where practical.

### Approved example
A dark shell with top bar, left navigation, page header, command bar, and panel-based content using `semantic.surface.canvas` and `semantic.surface.panel`.

### Rejected example
A generic admin template with white cards, marketing hero header, unlabeled icon navigation, and hidden workflow status.

### Agent transformation rules
Preserve shell regions and component IDs. Do not invent new app-level navigation areas unless the task requires them and standards support them.

### Validation checks
- `LAY-SHELL-001` regions present.
- Uses shell/navigation component IDs.
- Dark-first token hierarchy preserved.
- Primary actions visible and not hidden in unrelated menus.

## Persistent Regions

Persistent regions shall contain stable orientation and app-level status. They shall not be overloaded with page-specific content.

## Page Header Rules

Page headers shall include title, short description or metadata, stale/generated state where relevant, and task actions.

## Navigation Region Rules

Navigation shall show active state and shall not duplicate page tabs or command bars.

## Main Content Region Rules

Main content shall be panel-based and should keep primary workflow content visually dominant over supporting metadata.

## Command and Status Regions

Commands and status shall be adjacent to the affected workflow region where possible. Global status is reserved for app-level state.

## Density Rules

Use compact density for data-heavy regions and comfortable density for dialogs or complex forms where comprehension matters.

## Responsive Behavior

At narrower widths, preserve reading order and task actions. Avoid cramped two-column layouts where neither panel is readable.

## Accessibility Notes

Use semantic landmarks, headings, focus order, and keyboard navigation. Do not require pointer-only access to navigation or actions.

## Approved Shell Pattern

Approved: dark frame, bounded panels, active navigation, concise page header, visible command/status region, and predictable feedback placement.

## Rejected Shell Patterns

Rejected: landing-page shell, generic SaaS admin shell, missing active state, floating command buttons with no context, and navigation sprawl.
