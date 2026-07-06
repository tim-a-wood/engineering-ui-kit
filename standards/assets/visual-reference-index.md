# Assets — Visual Reference Index

## Purpose

This file indexes visual references used to calibrate the Engineering UI Kit application concept. It does not embed raw image assets.

## Phase 2 visual-reference posture

Approved hi-fi mockups are app-specific visual calibration references. They guide:

- dark-first surface hierarchy;
- information density;
- panel and card treatment;
- engineering-dashboard polish;
- visual rhythm and spacing tone;
- status, chart, table, and workflow feel.

They do **not** define every allowable component, and they do **not** represent formal company-wide UI standards.

## Current visual reference set

| Reference | Role | Package treatment |
|---|---|---|
| `MOCK-HIFI-SHELL` | App shell, top bar, navigation, and global density calibration. | Referenced only; image not embedded. |
| `MOCK-HIFI-DASHBOARD` | Dashboard cards, grids, charts, and status summary calibration. | Referenced only; image not embedded. |
| `MOCK-HIFI-TABLES` | Dense tables, row states, filters, and action density calibration. | Referenced only; image not embedded. |
| `MOCK-HIFI-FORMS` | Inputs, filters, labels, validation, and control styling calibration. | Referenced only; image not embedded. |
| `MOCK-HIFI-DETAIL` | Detail page, split panel, drawer, and metadata calibration. | Referenced only; image not embedded. |
| `MOCK-HIFI-CHARTS` | Chart panel, line chart, legend, tooltip, and threshold visual calibration. | Referenced only; image not embedded. |
| `MOCK-HIFI-STATUS` | Badges, job state, result summary, and progress treatment calibration. | Referenced only; image not embedded. |

## Reconciliation rule

When a mockup appears narrower than the component manifest, do not delete the manifest component solely because it is absent from the image set. Check whether the component is PRD-required, reference-backed, or an inferred engineering need.

When a mockup shows a visual treatment that conflicts with accessibility or contract rules, the contract and accessibility posture must be reconciled before implementation rather than copied blindly.
