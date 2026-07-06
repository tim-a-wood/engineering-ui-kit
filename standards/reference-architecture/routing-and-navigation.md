# Routing and Navigation Architecture

## Purpose

Define routing and navigation implementation guidance.

## Scope

Authored operational standard as of package 0.4.0, informed by the Vertical Slice 01
trial and scoped to the v0.1 desktop workbench. It owns navigation architecture, not
visual navigation appearance.

## Source Inputs

- `MOCK-*`: approved hi-fi mockups used as app-specific visual calibration references, not exhaustive standards.
- `engineering-ui-kit-prd-v7-final-contracts-incorporated.md`.
- `engineering-ui-kit-gap-analysis-v4-final-contracts.md`.
- `trials/vertical-slice-01/phase-3/phase-3-trial-report.md`.
- `engineering-ui-kit-high-level-delivery-plan-v0.2.md`.

## Owns

Route naming posture, navigation state, deep-link expectations, route-level loading/error handling, and shell integration.

## Does Not Own

Visual navigation component appearance or product-specific route inventory.

## Rules

### ARCH-ROUTE-001 — View-state navigation, not URL routing, in v0.1

The v0.1 desktop renderer shall model navigation as typed view state (a discriminated
union of view identifiers plus per-view parameters) owned by the renderer's top-level
view. URL-based routers (React Router, TanStack Router, wouter) shall not be added.
This preserves the trial constraint that forbids router dependencies and keeps the
Electron renderer's navigation serializable.

### ARCH-ROUTE-002 — Stable view identifiers

Each major area shall have a stable kebab-case view identifier: `copilot-handoff`,
`recipes`, `components`, `projects`, `settings`, and workflow subviews
`prepare-context`, `create-task-packet`, `run-in-copilot`, `apply-zip-overlay`,
`verify-review`. Identifiers are contracts: persisted state, telemetry, and help
anchors may reference them, so they shall not be renamed casually.

### ARCH-ROUTE-003 — Navigation state ownership

Current view, workflow step, and selected project identity are application-level
state owned above individual screens. Screen-local interaction state (edit drafts,
dialog visibility) shall not leak into navigation state. Navigating away and back may
reset screen-local state; it shall never corrupt committed domain state.

### ARCH-ROUTE-004 — Workflow step navigation semantics

The five-step Copilot handoff workflow is ordered but inspectable: completed steps
are revisitable, the current step is active, and future steps are reachable only when
their preconditions hold (e.g. Apply Zip Overlay requires a selected overlay file).
Preconditions shall be expressed as pure functions of persisted handoff state so the
step indicator, navigation guards, and tests share one source of truth.

### ARCH-ROUTE-005 — Route-level loading and error boundaries

Each view shall render inside an error boundary that reports failures with visible
text and a recovery action, and shall present loading states for asynchronous IPC
data using status text rather than layout-shifting spinners alone. A failed view
never blanks the shell; navigation chrome remains operable.

### ARCH-ROUTE-006 — Deep links deferred

External deep linking (custom protocol handlers, `--open-view` arguments) is out of
scope for v0.1. The view-state model shall keep view identifiers serializable so deep
links can be added later without renaming views.

## Traceability Notes

`ARCH-ROUTE-*` IDs link to `CMP-NAV-*` components and `LAY-SHELL-001`. The trial
evidence for the no-router posture is the `TRIAL-AC-013` scope-drift review in
`trials/vertical-slice-01/phase-3/phase-3-trial-report.md`.

## Open Decisions

None blocking v0.1. Deep-link protocol design is deferred to a post-v0.1 phase.
