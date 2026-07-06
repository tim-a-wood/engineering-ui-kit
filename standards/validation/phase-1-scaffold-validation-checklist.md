# Phase 1 Scaffold Validation Checklist

## Purpose

Validate that the Phase 1 scaffold satisfies the implementation specification before acceptance.

## Scope

This checklist applies to `engineering-ui-kit-standards-v0.1-dark-first-scaffold.zip` and the `standards/` folder inside it.

## Source Inputs

- `MOCK-*`: approved hi-fi mockups used as app-specific visual calibration references, not exhaustive standards.
- `engineering-ui-kit-prd-v7-final-contracts-incorporated.md`.
- `engineering-ui-kit-gap-analysis-v4-final-contracts.md`.
- `engineering-ui-kit-public-reuse-research-report-v3-dark-first-hi-fi-aligned.md`.
- `engineering-ui-kit-high-level-delivery-plan-v0.1.md`.
- `engineering-ui-kit-phase-1-implementation-spec-v0.1.md`.

## A. Package Structure

- [ ] Zip exists.
- [ ] Zip contains one top-level `standards/` folder.
- [ ] Required directories exist.
- [ ] Required files exist.
- [ ] No required folder has been renamed.

## B. File Scaffolding

- [ ] Markdown files are non-empty.
- [ ] Non-exempt markdown files contain the standard scaffold headings.
- [ ] Exempt files contain purpose, scope, and traceability information where practical.
- [ ] JSON files parse successfully.
- [ ] Schema files parse successfully.

## C. Dark-First Alignment

- [ ] `standards/README.md` states the dark-first contract.
- [ ] `package-metadata.json` states `themeStrategy` as `dark-first`.
- [ ] Required dark-first files include dark-first language.
- [ ] Visual drift checks include light-first framing, default light-theme assumption, generic white-card SaaS dashboard styling, uncontrolled imported design-system visual identity, neon/cyberpunk over-styling, low-fidelity wireframe placeholder look, inconsistent status/accent colors, and arbitrary raw colors outside semantic tokens.

## D. Traceability

- [ ] Source-of-truth hierarchy is documented.
- [ ] Traceability prefix scheme is documented.
- [ ] Mockup reference strategy exists.
- [ ] Public reuse attribution file exists.
- [ ] Third-party notices ledger exists.

## E. Contract Readiness

- [ ] `tokens.json` has the required placeholder groups.
- [ ] `component-manifest.json` includes representative placeholder component records.
- [ ] Schemas exist for tokens, component manifest, page pattern, validation result, and package structure.
- [ ] Placeholder contracts are ready for Phase 2 expansion rather than replacement.

## F. Source-of-Truth Consistency

- [ ] Mockups remain the controlling visual authority.
- [ ] PRD remains the controlling product intent authority.
- [ ] Gap analysis remains the implementation-readiness authority.
- [ ] Research report remains the public-reuse posture authority.
- [ ] Public systems are reference material, not a visual identity fork.

## G. Review Outcome

- [ ] Defects are classified as critical, major, minor, or observation.
- [ ] Critical and major defects are corrected before packaging.
- [ ] Final result is one of: `Pass`, `Pass with minor corrections`, or `Fail — restructure required`.

## Traceability Notes

Use `VAL-P1-*` IDs for future checklist automation and validation reporting.
