# Foundation Principles

## Purpose

This file defines the operating doctrine for the Engineering UI Kit. It tells implementers what kind of interface the standards are trying to produce before they choose components, layouts, or tokens.

## Scope

These principles apply to engineering workflow applications, standards browsers, handoff tools, validation hubs, and related technical workbenches. They do not define a consumer app, a marketing site, or a general-purpose SaaS design system.

## Source Inputs

Rules are grounded in the PRD, Phase 2 contracts, public reuse research, accessibility authorities, and approved high-fidelity mockups used as app-specific visual calibration.

## Principles Summary

| Rule | Summary |
|---|---|
| `FND-PRI-001` | Engineering workbench over generic dashboard. |
| `FND-PRI-002` | Dark-first by default. |
| `FND-PRI-003` | Dense but readable. |
| `FND-PRI-004` | Stable contracts over one-off styling. |
| `FND-PRI-005` | Workflow clarity over decorative motion. |
| `FND-PRI-006` | Explicit status and traceability. |
| `FND-PRI-007` | Accessibility is part of correctness. |
| `FND-PRI-008` | AI handoff compatibility. |
| `FND-PRI-009` | App lightweight, standards complete. |
| `FND-PRI-010` | Mockups calibrate direction but do not exhaust the standard. |

## FND-PRI-001 — Engineering workbench over generic dashboard

Screens shall feel like technical workspaces for inspecting, generating, validating, and handing off engineering standards. Generic SaaS dashboard drift is non-compliant when it replaces artifact context, evidence, traceability, or workflow state with decorative KPI panels.

## FND-PRI-002 — Dark-first by default

Dark mode is normative. Implementations shall begin from the dark semantic token set and shall not invert the standard into light-card dashboard styling unless a later phase authors a separate light-mode standard.

## FND-PRI-003 — Dense but readable

The UI shall support compact engineering information without becoming cramped. Density shall be created with predictable spacing, bounded panels, hierarchy, tables, and concise labels, not by shrinking text until metadata becomes unreadable.

## FND-PRI-004 — Stable contracts over one-off styling

Token paths and component IDs shall remain stable. Implementers shall reference `tokens.json` and `component-manifest.json` instead of inventing local names, hard-coded colors, or one-off component concepts.

## FND-PRI-005 — Workflow clarity over decorative motion

Motion, animation, glow, and visual effects shall only clarify state, focus, progress, or spatial transition. Decorative motion that distracts from engineering tasks is non-compliant.

## FND-PRI-006 — Explicit status and traceability

Status, evidence, validation, run context, source file, version, and trace links are first-class UI concepts. Screens shall show what is known, what changed, what is stale, what failed, and where evidence can be inspected.

## FND-PRI-007 — Accessibility is part of correctness

An engineering UI that cannot be used by keyboard, screen reader, or users with reduced motion and contrast needs is incomplete. Accessibility shall be validated as part of UI correctness, not as a later polish pass.

## FND-PRI-008 — AI handoff compatibility

Standards shall be written so an AI implementation agent can apply them in excerpted form. Each rule should be specific, token-referenced, component-ID aware, and compatible with the three-file handoff constraint.

## FND-PRI-009 — App lightweight, standards complete

The desktop app remains lightweight and minimal. The standards package shall still be complete, opinionated, and useful enough to constrain implementation. Completeness belongs in reusable standards, not app feature expansion.

## FND-PRI-010 — Mockups calibrate visual direction but do not exhaust the standard

The approved high-fidelity mockups calibrate density, dark surfaces, typography posture, panel treatment, and technical polish. They are not formal company-wide standards and do not enumerate every component required by the manifest.

## Approved Patterns

- A dark engineering shell with persistent context, page header, command region, panels, and explicit validation status.
- Dense tables with visible column labels, status text, and artifact links.
- Workflow pages that preview generated handoff content before apply/export.
- Chart panels that explain engineering data and expose non-visual summaries.

## Rejected Patterns

- Generic white-card SaaS dashboard layout.
- Marketing landing-page typography or oversized hero regions.
- Decorative neon/glassmorphism that obscures hierarchy.
- Color-only pass/fail indicators.
- Hidden destructive actions or unreviewable automation.

## Traceability Notes

Derived from PRD scope decisions, Phase 2 contracts, public accessibility and component research, and approved high-fidelity mockup calibration. These principles intentionally avoid implementation-library choices.
