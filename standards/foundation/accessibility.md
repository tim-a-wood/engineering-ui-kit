# Accessibility

## Purpose

This file defines the minimum accessibility standard for Engineering UI Kit output.

## Scope

The rules apply to components, layouts, examples, generated implementations, review checklists, and handoff packets.

## Authority

The target posture is WCAG 2.2 AA, supported by practical WAI-ARIA Authoring Practices behavior where custom components are necessary.

## FND-A11Y-001 — WCAG 2.2 AA target

Implemented UI shall target WCAG 2.2 AA for contrast, keyboard operation, focus visibility, semantics, labels, errors, and motion.

## FND-A11Y-002 — Keyboard access

All interactive components shall be reachable and operable by keyboard. Custom composites shall follow established keyboard patterns for menus, dialogs, tabs, grids, comboboxes, and popovers.

## FND-A11Y-003 — Visible focus

Focus shall be visible using `{semantic.focus.ring}` and shall not be hidden by shadows, overlays, clipping, or disabled-looking styles.

## FND-A11Y-004 — Semantic structure

Pages shall use meaningful headings, regions, labels, lists, tables, and buttons. Generic clickable containers shall not replace semantic controls.

## FND-A11Y-005 — Accessible names and descriptions

Icon-only buttons, status icons, inputs, charts, controls, menus, and dialogs shall expose accessible names. Additional descriptions shall be used when consequences or context are not clear from the name.

## FND-A11Y-006 — Color is not the only status signal

Critical status shall include text, icon, shape, or structural cues in addition to color.

## FND-A11Y-007 — Dialog and overlay behavior

Blocking dialogs shall trap focus, provide an accessible title, support Escape where safe, and restore focus to the invoking control when closed.

## FND-A11Y-008 — Tables and data grids

Tables shall expose headers and relationships. Interactive grids shall support keyboard navigation, selected state, sorting state, and row/column context.

## FND-A11Y-009 — Forms and validation

Fields shall have visible labels or equivalent accessible names. Errors shall be linked to fields and summarized when multiple fields are invalid.

## FND-A11Y-010 — Charts and non-visual alternatives

Charts shall provide a text summary, data table fallback where practical, and accessible labels for series, axes, thresholds, and critical findings.

## FND-A11Y-011 — Motion and reduced motion

Motion shall respect reduced-motion preferences and shall not be required to understand status or workflow progress.

## FND-A11Y-012 — Target sizes and dense UI exceptions

Dense engineering UI may use compact spacing, but frequently used actions, destructive actions, and touch-adjacent controls should preserve adequate target size and spacing.

## Component Accessibility Matrix

| Component area | Minimum requirement |
|---|---|
| Forms | Label, hint, error, invalid state, keyboard operation. |
| Tables/grids | Header relationships, keyboard support for interactions, non-color status. |
| Overlays | Focus management, title, dismissal, restoration. |
| Navigation | Active state, focus state, landmark/region support. |
| Charts | Text summary and meaningful status labels. |
| Status/feedback | Announced where timely, persistent where consequential. |

## Accessibility Anti-Patterns

- Placeholder-only labels.
- Color-only pass/fail badges.
- Divs acting as buttons without role, name, or keyboard support.
- Dialogs without focus trap or title.
- Tooltips containing essential instructions unavailable to keyboard users.
- Spinner-only long-running operations.

## Accessibility Validation Notes

Reviewers shall validate keyboard order, visible focus, semantics, form labels, overlay behavior, chart alternatives, and non-color status cues. Automated tooling may help later, but Phase 3 criteria are written for practical manual review.
