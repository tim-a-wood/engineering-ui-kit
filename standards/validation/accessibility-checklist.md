# Accessibility Checklist

## Purpose

This checklist supports practical review of Engineering UI Kit accessibility expectations.

## Scope

Use it for components, page recipes, generated screens, and implementation outputs. It does not require automated tooling in Phase 3.

## Keyboard

- All controls are reachable by keyboard.
- Custom composites follow expected keyboard behavior.
- Focus order matches workflow order.
- No pointer-only action is required.

## Focus

- Visible focus uses focus tokens.
- Focus is not clipped or hidden.
- Overlay focus moves and restores correctly.

## Semantics

- Buttons, links, forms, headings, regions, lists, and tables use appropriate semantics.
- Custom widgets expose role, name, and state.

## Forms

- Fields have visible labels or equivalent accessible names.
- Hints and errors are linked to controls.
- Required/invalid state is not color-only.

## Tables and Data Grids

- Headers are associated with cells.
- Sort and selected state are exposed.
- Interactive grids support keyboard operation.

## Overlays

- Blocking dialogs have title, focus trap, Escape behavior where safe, and focus restoration.
- Tooltip content is not essential-only.

## Status and Feedback

- Critical status uses text plus color/icon/shape where useful.
- Long-running status is persistent or inspectable.
- Timely updates are announced without excessive noise.

## Charts

- Charts have names, summaries, axis/series context, and data fallback where practical.
- Tooltip-only critical data is not allowed.

## Motion

- Motion respects reduced-motion preferences.
- Animation is not required to understand status.

## Content

- Labels are specific.
- Error messages identify cause and next action where known.
- Destructive confirmations name the affected artifact and consequence.

## Result Classification

Classify each issue as Pass, Pass with notes, Warning, Blocker, or Not applicable using `validation/ui-compliance-rubric.md`.
