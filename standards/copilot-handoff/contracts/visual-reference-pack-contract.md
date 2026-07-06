# Visual Reference Pack Contract

## Purpose

Define `visual-reference-pack.pdf`, the labeled visual-reference upload used as file 3
in the visual/mockup three-file handoff variant.

## Producer

Human author packaging approved hi-fi references for the selected screen.

## Consumer

Microsoft 365 Copilot during implementation, and reviewers checking visual
calibration and traceability.

## Required Structure

The PDF contains one or more pages. Each included page provides:

- the primary image for that page;
- page label;
- source filename;
- view name;
- status;
- related acceptance criteria IDs;
- related standards or component IDs.

A cover or index page may list the included pages, but the default content is labeled
primary page references rather than a contact sheet.

## Required Metadata

For each image page:

| Field | Example |
|---|---|
| page label | Create Task Packet |
| source filename | `1F2214C9-D849-41CA-9435-68F0A0032EEB.jpeg` |
| view name | Copilot Handoff / Create Task Packet |
| status | approved |
| related acceptance criteria | `TRIAL-AC-004`, `TRIAL-AC-005` |
| related standards IDs | `FND-VIS-001`, `LAY-SHELL-001`, `RCP-WORKFLOW-001` |

## Size and Scope Constraints

- One primary image per selected page by default.
- Vertical Slice 01 includes only the Create Task Packet reference unless the task
  packet expands scope.
- Do not embed the entire ten-image set by default.

## Validation Rules

1. Every image has the required labels.
2. Source filename is stable and traceable to `project-sources/visual-references/`.
3. Status is `approved` for trial use.
4. Related criteria and standards IDs are present.
5. Pack is a PDF suitable as a single upload file.

## Prohibited Content

- Contact-sheet default as the only content
- Unlabeled images
- Claims that mockups define every component
- Unapproved or edited historical archive images
- Light-mode alternatives presented as v0.1 targets

## Minimal Valid Example

A one-page PDF containing:

- Image: Create Task Packet hi-fi reference
- Page label: Create Task Packet
- Source filename: `1F2214C9-D849-41CA-9435-68F0A0032EEB.jpeg`
- View name: Copilot Handoff / Create Task Packet
- Status: approved
- Related acceptance criteria: `TRIAL-AC-004`–`TRIAL-AC-013` as applicable
- Related standards IDs: `FND-VIS-001`, `LAY-SHELL-001`, `RCP-WORKFLOW-001`,
  `CMP-SHELL-APP`, `CMP-WORKFLOW-STEP-INDICATOR`

## Invalid Example

A PDF that contains only an unlabeled collage of many screenshots with no source
filenames, criteria, or standards IDs.

## Traceability

- `../visual-reference-strategy.md`
- `AI-VIS-001` through `AI-VIS-007`
- `trials/vertical-slice-01/target-selection.md`
