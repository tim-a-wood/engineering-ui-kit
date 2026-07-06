# Engineering UI Kit Standards

**Package version:** 0.3.0  
**Phase:** Phase 3 — Core Standards Authoring  
**Status:** core standards authored  
**Operational readiness:** unproven; evidence-first vertical slice required
**Primary posture:** dark-first, engineering-focused, app-lightweight

## Purpose

This package defines the authored core standards for Engineering UI Kit screens. It is intended to constrain human and AI-generated UI work so that output stays aligned with the approved dark-first engineering workbench direction rather than drifting into generic SaaS dashboard output.

## What v0.3 Contains

Version 0.3 contains authored prose standards for:

- foundation principles, visual language, tokens, accessibility, content, and interaction;
- component behavior, states, usage, accessibility, and token expectations;
- forms, tables, navigation, feedback, overlays, and data visualization;
- application shell and page layout recipes;
- approved and rejected examples;
- validation rubrics and Phase 3 validation gates.

## Contract Dependency

Version 0.3 still depends on the Phase 2 contracts:

- `tokens.json` is the token source of truth;
- `component-manifest.json` is the component inventory source of truth;
- `schemas/*.json` define the expected machine-readable shapes.

The prose standards explain how to use those contracts. They do not replace them.

## What v0.3 Is Not

This package is not a coded UI kit, React implementation, Storybook site, Figma library, documentation website, or final three-file Copilot handoff export. It also does not claim formal company-wide design authority. The approved mockups calibrate app-specific visual direction only.

## Evidence-First Readiness

The authored core and the minimum trial contract for Vertical Slice 01 are complete.
Reference architecture, Copilot handoff instructions, artifact contracts, safety
rules, and prompts are authored to the depth required for one task-specific
three-file handoff.

The disposable React/Vite target app and acceptance criteria live under
`trials/vertical-slice-01/`. Handcraft the packet and run the Copilot trial before
broad handoff packaging, core-library automation, or Electron implementation begins.

The active roadmap is `engineering-ui-kit-high-level-delivery-plan-v0.2.md`.

## Package Structure

- `foundation/` — operating doctrine, visual language, accessibility, content, interaction, and token usage rules.
- `components/` — component manifest explanation and operational component standards.
- `layouts-and-recipes/` — screen composition recipes and reusable state patterns.
- `examples/` — approved and rejected examples for review and implementation guidance.
- `validation/` — rubrics, checklists, and mechanical validation scripts.
- `schemas/`, `tokens.json`, `component-manifest.json` — Phase 2 contract backbone preserved for Phase 3.
- `assets/`, `research/`, `prompts/`, `copilot-handoff/`, `reference-architecture/` — supporting material, including the Phase 1 trial-critical architecture, handoff, safety, and prompt contracts.

## Use Guidance

For implementation work, start with `foundation/principles.md`, `foundation/visual-language.md`, `foundation/tokens.md`, `component-manifest.json`, and the relevant component or layout recipe. For review work, use `validation/ui-compliance-rubric.md`, `validation/visual-drift-checklist.md`, and `validation/component-completeness-checklist.md`.
