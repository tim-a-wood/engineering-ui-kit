# Validation

## Purpose

This folder contains validation artifacts for the Engineering UI Kit standards package.

Phase 2 validation focuses on machine-readable contract readiness rather than complete prose standards.

## Phase 2 authoritative artifacts

| File | Purpose |
|---|---|
| `phase-2-contract-validation-checklist.md` | Gate checklist for Phase 2 completion. |
| `phase-2-validation-result-template.md` | Reusable result template for future Phase 2-style validation. |
| `phase-2-contract-validation-result.md` | Completed validation result for this package. |
| `validate-phase-2-contracts.py` | Optional helper script. Markdown checklist and result remain authoritative. |

## Phase 2 validation gates

The Phase 2 gate checks:

- package structure;
- JSON parseability;
- schema validation;
- token contract completeness;
- component manifest completeness;
- token-reference integrity;
- corrected source framing;
- component reference-map coverage;
- handoff readiness.

A package with blocker findings is not ready for Phase 3.
