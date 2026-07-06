# Assets — Mockup Traceability

## Purpose

This file explains how approved hi-fi mockups map to Phase 2 component contracts.

Mockups are visual calibration references for the application concept. They are not exhaustive component standards and are not company-wide UI authority.

## Traceability classes

| Class | Meaning |
|---|---|
| Directly observed | Component is visibly present in at least one approved hi-fi mockup. |
| Partially observed | Component appears through some visual or behavioral evidence, but is not fully specified. |
| Visually inferred | Component is suggested by layout or workflow needs, but not clearly specified. |
| Absent but included | Component is included because the PRD, research, accessibility, or engineering workflow scope requires it. |

## Directly observed examples

| Mockup reference | Component examples |
|---|---|
| `MOCK-HIFI-SHELL` | `CMP-SHELL-APP`, `CMP-SHELL-TOP-BAR`, `CMP-NAV-PRIMARY`, `CMP-SHELL-PAGE-HEADER` |
| `MOCK-HIFI-DASHBOARD` | `CMP-LAYOUT-DASHBOARD-GRID`, `CMP-CONTENT-METRIC-CARD`, `CMP-SURFACE-RAISED-CARD` |
| `MOCK-HIFI-TABLES` | `CMP-TABLE-DATA-TABLE`, `CMP-TABLE-COLUMN-HEADER`, `CMP-FILTER-BAR`, `CMP-FILTER-SEARCH-FIELD` |
| `MOCK-HIFI-FORMS` | `CMP-FORM-FIELD`, `CMP-FORM-TEXT-INPUT`, `CMP-FORM-SELECT`, `CMP-FILTER-CHIP` |
| `MOCK-HIFI-CHARTS` | `CMP-VIZ-CHART-PANEL`, `CMP-VIZ-LINE-CHART`, `CMP-VIZ-LEGEND` |
| `MOCK-HIFI-STATUS` | `CMP-STATUS-BADGE`, `CMP-STATUS-JOB-INDICATOR`, `CMP-FEEDBACK-PROGRESS-INDICATOR` |

## Partially observed or inferred examples

| Component | Reason |
|---|---|
| `CMP-LAYOUT-SPLIT-PANEL` | Detail and dense review layouts imply split regions, but exact resize behavior is not specified. |
| `CMP-OVERLAY-DRAWER` | Detail side surfaces are visually aligned with drawer usage, but full overlay behavior is not specified. |
| `CMP-TABLE-DATA-GRID` | Dense tables are visible, but editable or virtualized grid behavior requires later validation. |
| `CMP-VIZ-THRESHOLD-BAND` | Engineering charting likely needs thresholds and tolerances, but examples are not exhaustive. |

## Absent but included examples

| Component | Inclusion basis |
|---|---|
| `CMP-ENG-TRACE-MATRIX` | PRD and engineering workflow scope require stable traceability patterns. |
| `CMP-ENG-DIFF-VIEWER` | Engineering review workflows commonly require comparison of generated and source artifacts. |
| `CMP-ENG-LOG-VIEWER` | Job execution and automation workflows require log review. |
| `CMP-FORM-FILE-DROPZONE` | Artifact intake is a likely engineering need but security and allowed types require later validation. |
| `CMP-OVERLAY-CONTEXT-MENU` | Dense artifact and table workflows may need contextual actions, but exact scope is deferred. |

## Implementation rule

Use the component manifest for component inclusion and token references. Use mockups for visual calibration. Do not treat mockup absence as proof that a component is out of scope.
