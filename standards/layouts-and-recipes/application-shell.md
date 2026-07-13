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
A dark shell with a quiet top bar, collapsible left navigation, concise page header, integrated title icon, contextual actions, and canvas-first content using panels only where containment is meaningful.

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

Page headers shall include a title and short description or metadata. A major workflow may include one unboxed semantic icon beside the title. Put only page-level actions in the header; do not repeat global help, breadcrumbs, workflow indicators, or commands already present in the body. For paired modes such as Build and Test, use a quiet text-and-arrow transition rather than a stepper or segmented state control.

## Navigation Region Rules

Navigation shall show active state and shall not duplicate page tabs or command bars.

## Main Content Region Rules

Main content shall be canvas-first and keep the primary workflow visually dominant. Use panels only for bounded tools, previews, complex forms, or consequential review. Project lists, resume rows, ordinary metadata, and simple groups should use whitespace and hairline dividers.

## Command and Status Regions

Commands and status shall be adjacent to the affected workflow region where possible. Global status is reserved for app-level state.

## Density Rules

Use compact density for data-heavy regions and comfortable density for dialogs or complex forms where comprehension matters.

## Responsive Behavior

At narrower widths, preserve reading order and task actions. Avoid cramped two-column layouts where neither panel is readable.

## Accessibility Notes

Use semantic landmarks, headings, focus order, and keyboard navigation. Do not require pointer-only access to navigation or actions.

## Approved Shell Pattern

Approved: dark frame, restrained surfaces, active navigation, concise icon-supported page header, full-row project navigation, visible local feedback, and predictable command placement.

## Rejected Shell Patterns

Rejected: marketing landing page, generic SaaS card dashboard, panel around every section, duplicated workflow navigation, missing active state, floating commands with no context, and navigation sprawl.
