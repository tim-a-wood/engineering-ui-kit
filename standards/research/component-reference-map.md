# Component Reference Map

## Purpose

This map links Phase 2 component families to the rationale and public-reference posture that supports their inclusion. It does not copy third-party source text, code, images, icons, or branded visual language.

| Component family | Manifest IDs | Inclusion rationale | Reference posture | Phase 2 status | Notes |
|---|---|---|---|---|---|
| Application shell and navigation | `CMP-SHELL-*`, `CMP-NAV-*` | Persistent app frame, global actions, page context, and movement are necessary for multi-view engineering applications. | Taxonomy, accessibility, and documentation pattern. | Required / recommended | Use public systems for structure and keyboard expectations only; visual language remains Engineering UI Kit dark-first. |
| Forms and validation | `CMP-FORM-*`, `CMP-FEEDBACK-VALIDATION-SUMMARY` | Engineering workflows require precise data entry, validation, helper text, and error recovery. | Accessibility and component taxonomy. | Required / recommended | Do not copy branded field visuals; use semantic tokens and project-specific density. |
| Tables and data grids | `CMP-TABLE-*` | Dense records, results, artifacts, and trace data require sortable and selectable tabular views. | Taxonomy, accessibility, and implementation-primitive research. | Required / recommended | Grid editing and virtualization remain deferred where marked reserved. |
| Status and feedback | `CMP-STATUS-*`, `CMP-FEEDBACK-*` | Jobs, validation, execution outcomes, loading, and failure states need consistent feedback. | Accessibility, state taxonomy, and documentation pattern. | Required / recommended | Status color must come from semantic tokens and pass dark-theme contrast checks. |
| Dialogs and overlays | `CMP-OVERLAY-*` | Confirmations, drawers, popovers, menus, and tooltips are standard interaction needs. | Accessibility and keyboard/focus management. | Required / recommended / optional | Focus trapping and dismissal behavior require strict Phase 3 prose standards. |
| Tabs, menus, comboboxes, and tree views | `CMP-NAV-SECONDARY`, `CMP-FORM-COMBOBOX`, `CMP-OVERLAY-CONTEXT-MENU`, `CMP-ENG-ARTIFACT-TREE` | Composite widgets are required for dense navigation, option selection, contextual actions, and artifact browsing. | Accessibility pattern reference and implementation-primitive research. | Recommended / optional / later validation | Use established ARIA patterns; do not invent keyboard behavior casually. |
| Data visualization and chart panels | `CMP-VIZ-*` | Engineering dashboards require charts, legends, thresholds, and tooltips. | Chart taxonomy, interaction expectations, and implementation-primitive research. | Required / recommended / optional | Chart theme must use semantic chart tokens; library-specific behavior is deferred. |
| Engineering artifact browsers | `CMP-ENG-ARTIFACT-TREE`, `CMP-ENG-EVIDENCE-CARD`, `CMP-ENG-REQUIREMENT-LINK` | Engineering UIs need artifact navigation, evidence summaries, and durable links to requirements or tests. | Engineering inference and PRD-backed inclusion. | Recommended / required / later validation | Data model and exact artifact metadata require later validation. |
| Traceability and evidence patterns | `CMP-ENG-TRACE-MATRIX`, `CMP-ENG-RUN-TEST-RESULT-SUMMARY`, `CMP-ENG-EVIDENCE-CARD` | Trace, evidence, and result summaries are core to engineering review and verification workflows. | PRD-backed and engineering inference. | Required / recommended / later validation | Avoid presenting trace matrix behavior as complete until relationship rules are specified. |
| Logs, code blocks, and diff views | `CMP-ENG-LOG-VIEWER`, `CMP-ENG-CODE-BLOCK`, `CMP-ENG-DIFF-VIEWER` | Automation, jobs, generated artifacts, and review workflows require readable technical text and comparisons. | Taxonomy, accessibility, and engineering inference. | Required / recommended / optional | Syntax highlighting, streaming, and diff granularity remain deferred unless later specified. |

## Interpretation

The manifest is broader than the mockups by design. Mockups calibrate appearance; the PRD, public references, and engineering workflow needs determine inventory breadth.
