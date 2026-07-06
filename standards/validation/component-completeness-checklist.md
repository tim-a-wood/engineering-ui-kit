# Component Completeness Checklist

## Purpose

This checklist verifies that Phase 3 component standards cover the manifest without contradicting it.

## Scope

Use for standards package review, generated handoff pack review, and implementation planning.

## Manifest Coverage

- Every ID in `component-manifest.json` appears in authored component documentation.
- Categories and names match the manifest.
- No component is deleted because it is absent from mockups.

## Component Spec Coverage

- Tier 1 components include operational behavior, states, accessibility, token usage, examples, agent notes, and validation checks.
- Tier 2 components include useful usage, states, accessibility, token usage, and examples/cross-references.
- Tier 3 components include explicit reserved deferral language.

## Token Reference Coverage

- Component docs reference semantic or component alias tokens.
- Raw colors are absent from component specs.
- Token names match `tokens.json`.

## State Coverage

- Components describe default, hover/focus, disabled, loading, invalid, selected, empty, error, or reserved states where relevant.

## Accessibility Coverage

- Form, table, overlay, status, and chart components include accessibility rules.
- Icon-only controls require accessible names.
- Critical status is not color-only.

## Example Coverage

- Approved and rejected examples cover major component categories.
- Examples do not create new app scope.

## Reserved Component Honesty

- Reserved components are marked as not fully standardized.
- Reserved components do not instruct production implementation.
- Future validation requirements are named.

## Result Classification

Missing Tier 1 coverage, manifest ID mismatch, or invalid reserved-component treatment is a blocker. Short but usable Tier 2 examples may be a warning.
