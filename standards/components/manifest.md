# Component Manifest

## Purpose

This file explains how to use `component-manifest.json` during implementation and review. The JSON manifest remains the component inventory source of truth.

## Manifest Source

`component-manifest.json` is canonical for component IDs, names, categories, status, coverage classifications, token references, accessibility notes, and validation expectations. Prose files may explain those components, but they shall not contradict the manifest.

## Coverage Classification Definitions

| `observed-in-mockups` | Directly visible in at least one approved hi-fi mockup. |
| `partially-observed-in-mockups` | Some visual or behavioral aspects appear in the mockups, but the component is not fully specified by them. |
| `prd-required` | Required by product or workflow scope even if not fully visible in mockups. |
| `reference-backed-standard` | Included because mature public references support it as a standard UI component or pattern. |
| `inferred-engineering-need` | Included because engineering UIs commonly need it, but further project validation is required. |
| `reserved-for-future-validation` | Reserved in the manifest so later phases can define it without ID churn. |

## Category Definitions

| Category | Name | Purpose | Maturity |
|---|---|---|---|
| `shell` | Shell | Application frame and persistent global regions | core |
| `navigation` | Navigation | Movement between app sections and workflow locations | core |
| `surface` | Surface | Containers, cards, panels, and visual grouping surfaces | core |
| `layout` | Layout | Composition patterns and region structure | core |
| `forms` | Forms | Inputs, labels, validation, and controlled data entry | core |
| `tables` | Tables | Tabular data, grids, rows, columns, pagination, and row actions | core |
| `filters` | Filters | Search, chip, and filtering controls for dense views | supporting |
| `feedback` | Feedback | Alerts, toasts, validation summaries, and user-facing messages | core |
| `status` | Status | Compact state indicators for jobs, results, and workflow state | core |
| `overlays` | Overlays | Dialogs, drawers, popovers, menus, and tooltips | core |
| `data-visualization` | Data Visualization | Charts and visual analysis surfaces | supporting |
| `workflow` | Workflow | Multi-step, event, and execution workflow patterns | supporting |
| `engineering-artifacts` | Engineering Artifacts | Artifacts, evidence, requirements, traces, and test summaries | supporting |
| `code-and-logs` | Code and Logs | Code, logs, diffs, paths, and technical text | supporting |
| `content` | Content | Text blocks, empty states, help content, and key-value summaries | supporting |

## Component ID Stability Rules

Component IDs shall be treated as stable contract names. They shall not be renamed to match implementation library names, visual variants, or local code preferences. A new ID may be added only when a validated UI need cannot be represented by an existing component and a later phase updates the manifest and schema-aware validation.

## Phase 3 Authoring Depth Rules

| Treatment | Meaning |
|---|---|
| Tier 1 — full operational specification | Component is observed in mockups, PRD-required, or required by the manifest. It needs behavior, states, accessibility, token use, examples, and validation checks. |
| Tier 2 — standard specification | Component is reference-backed or inferred. It needs useful usage, state, accessibility, and token rules but not speculative detail. |
| Tier 3 — reserved specification | Component remains reserved for future validation. Prose shall preserve the ID but explicitly prohibit treating it as a finalized standard. |

## Component-to-Document Map

| Component ID | Name | Category | Coverage | Phase 3 treatment | Owner document |
|---|---|---|---|---|---|
| `CMP-SHELL-APP` | App Shell | `shell` | observed-in-mockups, prd-required | Tier 1 — full operational specification | `components/navigation.md` |
| `CMP-SHELL-TOP-BAR` | Top Bar | `shell` | observed-in-mockups, prd-required | Tier 1 — full operational specification | `components/navigation.md` |
| `CMP-NAV-PRIMARY` | Primary Navigation | `navigation` | observed-in-mockups, prd-required, reference-backed-standard | Tier 1 — full operational specification | `components/navigation.md` |
| `CMP-NAV-SECONDARY` | Secondary Navigation | `navigation` | partially-observed-in-mockups, reference-backed-standard | Tier 2 — standard specification | `components/navigation.md` |
| `CMP-NAV-BREADCRUMBS` | Breadcrumbs | `navigation` | reference-backed-standard, inferred-engineering-need | Tier 2 — standard specification | `components/navigation.md` |
| `CMP-SHELL-PAGE-HEADER` | Page Header | `shell` | observed-in-mockups, prd-required | Tier 1 — full operational specification | `components/navigation.md` |
| `CMP-NAV-COMMAND-ACTION-BAR` | Command Action Bar | `navigation` | observed-in-mockups, prd-required | Tier 1 — full operational specification | `components/navigation.md` |
| `CMP-SURFACE-PANEL` | Panel | `surface` | observed-in-mockups, reference-backed-standard | Tier 1 — full operational specification | `components/component-specs.md` |
| `CMP-SURFACE-RAISED-CARD` | Raised Card | `surface` | observed-in-mockups, reference-backed-standard | Tier 1 — full operational specification | `components/component-specs.md` |
| `CMP-SURFACE-INSET-PANEL` | Inset Panel | `surface` | observed-in-mockups, reference-backed-standard | Tier 1 — full operational specification | `components/component-specs.md` |
| `CMP-LAYOUT-SECTION-HEADER` | Section Header | `layout` | observed-in-mockups, reference-backed-standard | Tier 1 — full operational specification | `components/component-specs.md` |
| `CMP-LAYOUT-TOOLBAR` | Toolbar | `layout` | observed-in-mockups, reference-backed-standard | Tier 1 — full operational specification | `components/component-specs.md` |
| `CMP-LAYOUT-SPLIT-PANEL` | Split Panel | `layout` | partially-observed-in-mockups, inferred-engineering-need | Tier 2 — standard specification | `components/component-specs.md` |
| `CMP-LAYOUT-RESIZABLE-PANEL` | Resizable Panel | `layout` | inferred-engineering-need, reserved-for-future-validation | Tier 3 — reserved specification | `components/component-specs.md` |
| `CMP-LAYOUT-DASHBOARD-GRID` | Dashboard Grid | `layout` | observed-in-mockups, prd-required | Tier 1 — full operational specification | `components/component-specs.md` |
| `CMP-LAYOUT-DETAIL` | Detail Layout | `layout` | partially-observed-in-mockups, prd-required | Tier 1 — full operational specification | `components/component-specs.md` |
| `CMP-FORM-FIELD` | Form Field | `forms` | observed-in-mockups, reference-backed-standard | Tier 1 — full operational specification | `components/forms.md` |
| `CMP-FORM-TEXT-INPUT` | Text Input | `forms` | observed-in-mockups, reference-backed-standard | Tier 1 — full operational specification | `components/forms.md` |
| `CMP-FORM-NUMBER-INPUT` | Number Input | `forms` | partially-observed-in-mockups, reference-backed-standard | Tier 1 — full operational specification | `components/forms.md` |
| `CMP-FORM-SELECT` | Select | `forms` | observed-in-mockups, reference-backed-standard | Tier 1 — full operational specification | `components/forms.md` |
| `CMP-FORM-COMBOBOX` | Combobox | `forms` | reference-backed-standard, inferred-engineering-need | Tier 2 — standard specification | `components/forms.md` |
| `CMP-FORM-TEXTAREA` | Textarea | `forms` | reference-backed-standard, prd-required | Tier 1 — full operational specification | `components/forms.md` |
| `CMP-FORM-CHECKBOX` | Checkbox | `forms` | reference-backed-standard, prd-required | Tier 1 — full operational specification | `components/forms.md` |
| `CMP-FORM-RADIO-GROUP` | Radio Group | `forms` | reference-backed-standard | Tier 2 — standard specification | `components/forms.md` |
| `CMP-FORM-SWITCH` | Switch | `forms` | reference-backed-standard | Tier 2 — standard specification | `components/forms.md` |
| `CMP-FORM-DATE-TIME-INPUT` | Date Time Input | `forms` | reference-backed-standard, inferred-engineering-need | Tier 2 — standard specification | `components/forms.md` |
| `CMP-FILTER-SEARCH-FIELD` | Search Field | `filters` | observed-in-mockups, reference-backed-standard | Tier 1 — full operational specification | `components/forms.md` |
| `CMP-FILTER-BAR` | Filter Bar | `filters` | observed-in-mockups, prd-required | Tier 1 — full operational specification | `components/forms.md` |
| `CMP-FILTER-CHIP` | Filter Chip | `filters` | observed-in-mockups, reference-backed-standard | Tier 1 — full operational specification | `components/forms.md` |
| `CMP-FORM-FILE-DROPZONE` | File Dropzone | `forms` | prd-required, inferred-engineering-need | Tier 1 — full operational specification | `components/forms.md` |
| `CMP-TABLE-DATA-TABLE` | Data Table | `tables` | observed-in-mockups, reference-backed-standard | Tier 1 — full operational specification | `components/tables.md` |
| `CMP-TABLE-DATA-GRID` | Data Grid | `tables` | partially-observed-in-mockups, reference-backed-standard, inferred-engineering-need | Tier 2 — standard specification | `components/tables.md` |
| `CMP-TABLE-COLUMN-HEADER` | Column Header | `tables` | observed-in-mockups, reference-backed-standard | Tier 1 — full operational specification | `components/tables.md` |
| `CMP-TABLE-ROW-ACTION-MENU` | Row Action Menu | `tables` | partially-observed-in-mockups, reference-backed-standard | Tier 2 — standard specification | `components/tables.md` |
| `CMP-TABLE-PAGINATION` | Pagination | `tables` | reference-backed-standard, inferred-engineering-need | Tier 2 — standard specification | `components/tables.md` |
| `CMP-CONTENT-EMPTY-STATE` | Empty State | `content` | reference-backed-standard, prd-required | Tier 1 — full operational specification | `components/feedback-and-status.md` |
| `CMP-FEEDBACK-LOADING-STATE` | Loading State | `feedback` | observed-in-mockups, reference-backed-standard | Tier 1 — full operational specification | `components/feedback-and-status.md` |
| `CMP-FEEDBACK-ERROR-STATE` | Error State | `feedback` | reference-backed-standard, prd-required | Tier 1 — full operational specification | `components/feedback-and-status.md` |
| `CMP-CONTENT-METRIC-CARD` | Metric Card | `content` | observed-in-mockups, prd-required | Tier 1 — full operational specification | `components/feedback-and-status.md` |
| `CMP-CONTENT-KEY-VALUE-LIST` | Key Value List | `content` | observed-in-mockups, reference-backed-standard | Tier 1 — full operational specification | `components/feedback-and-status.md` |
| `CMP-STATUS-BADGE` | Status Badge | `status` | observed-in-mockups, prd-required | Tier 1 — full operational specification | `components/feedback-and-status.md` |
| `CMP-FEEDBACK-ALERT` | Alert | `feedback` | reference-backed-standard, prd-required | Tier 1 — full operational specification | `components/feedback-and-status.md` |
| `CMP-FEEDBACK-TOAST` | Toast | `feedback` | reference-backed-standard | Tier 2 — standard specification | `components/feedback-and-status.md` |
| `CMP-FEEDBACK-PROGRESS-INDICATOR` | Progress Indicator | `feedback` | observed-in-mockups, prd-required | Tier 1 — full operational specification | `components/feedback-and-status.md` |
| `CMP-STATUS-JOB-INDICATOR` | Job Status Indicator | `status` | observed-in-mockups, prd-required | Tier 1 — full operational specification | `components/feedback-and-status.md` |
| `CMP-FEEDBACK-VALIDATION-SUMMARY` | Validation Summary | `feedback` | prd-required, reference-backed-standard | Tier 1 — full operational specification | `components/feedback-and-status.md` |
| `CMP-WORKFLOW-STEP-INDICATOR` | Step Indicator | `workflow` | reference-backed-standard, prd-required | Tier 1 — full operational specification | `components/feedback-and-status.md` |
| `CMP-WORKFLOW-TIMELINE-EVENT-LOG` | Timeline Event Log | `workflow` | prd-required, inferred-engineering-need | Tier 1 — full operational specification | `components/feedback-and-status.md` |
| `CMP-OVERLAY-DIALOG` | Dialog | `overlays` | reference-backed-standard, prd-required | Tier 1 — full operational specification | `components/overlays-and-dialogs.md` |
| `CMP-OVERLAY-CONFIRMATION-DIALOG` | Confirmation Dialog | `overlays` | reference-backed-standard, prd-required | Tier 1 — full operational specification | `components/overlays-and-dialogs.md` |
| `CMP-OVERLAY-DRAWER` | Drawer | `overlays` | partially-observed-in-mockups, reference-backed-standard | Tier 2 — standard specification | `components/overlays-and-dialogs.md` |
| `CMP-OVERLAY-POPOVER` | Popover | `overlays` | reference-backed-standard | Tier 2 — standard specification | `components/overlays-and-dialogs.md` |
| `CMP-OVERLAY-TOOLTIP` | Tooltip | `overlays` | reference-backed-standard | Tier 2 — standard specification | `components/overlays-and-dialogs.md` |
| `CMP-OVERLAY-CONTEXT-MENU` | Context Menu | `overlays` | reference-backed-standard, inferred-engineering-need | Tier 2 — standard specification | `components/overlays-and-dialogs.md` |
| `CMP-VIZ-CHART-PANEL` | Chart Panel | `data-visualization` | observed-in-mockups, prd-required | Tier 1 — full operational specification | `components/data-visualization.md` |
| `CMP-VIZ-LINE-CHART` | Line Chart | `data-visualization` | observed-in-mockups, reference-backed-standard | Tier 1 — full operational specification | `components/data-visualization.md` |
| `CMP-VIZ-BAR-CHART` | Bar Chart | `data-visualization` | reference-backed-standard, prd-required | Tier 1 — full operational specification | `components/data-visualization.md` |
| `CMP-VIZ-LEGEND` | Legend | `data-visualization` | observed-in-mockups, reference-backed-standard | Tier 1 — full operational specification | `components/data-visualization.md` |
| `CMP-VIZ-CHART-TOOLTIP` | Chart Tooltip | `data-visualization` | reference-backed-standard | Tier 2 — standard specification | `components/data-visualization.md` |
| `CMP-VIZ-THRESHOLD-BAND` | Threshold Band | `data-visualization` | inferred-engineering-need, reserved-for-future-validation | Tier 3 — reserved specification | `components/data-visualization.md` |
| `CMP-ENG-ARTIFACT-TREE` | Artifact Tree | `engineering-artifacts` | prd-required, inferred-engineering-need | Tier 1 — full operational specification | `components/component-specs.md` |
| `CMP-ENG-TRACE-MATRIX` | Traceability Matrix | `engineering-artifacts` | prd-required, inferred-engineering-need, reserved-for-future-validation | Tier 3 — reserved specification | `components/component-specs.md` |
| `CMP-ENG-DIFF-VIEWER` | Diff Viewer | `code-and-logs` | inferred-engineering-need, reserved-for-future-validation | Tier 3 — reserved specification | `components/component-specs.md` |
| `CMP-ENG-LOG-VIEWER` | Log Viewer | `code-and-logs` | prd-required, inferred-engineering-need | Tier 1 — full operational specification | `components/component-specs.md` |
| `CMP-ENG-CODE-BLOCK` | Code Block | `code-and-logs` | reference-backed-standard, prd-required | Tier 1 — full operational specification | `components/component-specs.md` |
| `CMP-ENG-EVIDENCE-CARD` | Evidence Card | `engineering-artifacts` | prd-required, inferred-engineering-need | Tier 1 — full operational specification | `components/component-specs.md` |
| `CMP-ENG-REQUIREMENT-LINK` | Requirement Link | `engineering-artifacts` | prd-required, inferred-engineering-need | Tier 1 — full operational specification | `components/component-specs.md` |
| `CMP-ENG-RUN-TEST-RESULT-SUMMARY` | Run Test Result Summary | `engineering-artifacts` | prd-required, observed-in-mockups | Tier 1 — full operational specification | `components/component-specs.md` |

## Component-to-Token Rule

Component docs shall use token references already present in the manifest or stable semantic token groups from `tokens.json`. Raw colors and ad hoc local token names are not allowed.

## Reserved Component Rule

Reserved components are intentionally not final standards. They document a likely future need and preserve naming stability, but they shall not be implemented as production components until later validation defines behavior, accessibility, and layout rules.

## Validation Notes

Reviewers shall verify that every manifest component is mentioned in Phase 3 prose, reserved components remain honest, and generated UI uses manifest IDs rather than invented component names.
