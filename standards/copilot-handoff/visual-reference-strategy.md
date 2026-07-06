# Visual Reference Strategy

## Purpose

Define how approved hi-fi mockups are labeled, cited, and packaged for Copilot
visual implementation trials without treating them as exhaustive component standards.

## Scope

This standard covers primary page selection, labeling metadata, PDF pack expectations,
traceability to acceptance criteria and standards IDs, and explicit non-claims about
mockup completeness.

## Controlling Decisions

- Approved mockups calibrate app-specific visual direction.
- One primary image per page is the default for the trial.
- Contact sheets are not the default handoff format.
- Mockups do not define every manifest component.

## Required Architecture

### AI-VIS-001 — One primary image per page

Each selected screen has one primary visual reference image. Secondary images are
included only when the task packet explicitly needs another state or region.

### AI-VIS-002 — Required labels

Every included reference must record:

- page label;
- source filename;
- view name;
- status (`approved`);
- related acceptance criteria IDs;
- related standards or component IDs.

### AI-VIS-003 — Source filename stability

Cite the repository source filename. For Vertical Slice 01:

`project-sources/visual-references/1F2214C9-D849-41CA-9435-68F0A0032EEB.jpeg`

### AI-VIS-004 — Visual reference pack is the third file in the visual variant

When using the visual/mockup variant, package labeled references as
`visual-reference-pack.pdf`. Do not upload loose images as extra files.

### AI-VIS-005 — Mockups calibrate, they do not exhaust

If a control appears in the mockup but lacks a standards rule, follow authored
standards and report the gap. If a manifest component is absent from the mockup, do
not invent it unless the task packet requires it.

### AI-VIS-006 — No contact-sheet default

Do not substitute a multi-page contact sheet for a labeled primary page reference
unless the task explicitly requests overview context.

### AI-VIS-007 — Baseline must not pre-imitate the reference

Phase 1 baseline styling remains plain. The reference is for later transformation
measurement, not for baseline restyling.

## Allowed Patterns

- Single-page PDF pack for Create Task Packet.
- Explicit mapping from reference regions to acceptance criteria.
- Notes describing shell, stepper, cards, and actions visible in the reference.

## Prohibited Patterns

- Embedding all ten source JPEGs into standards prose.
- Claiming the mockup authorizes unrelated screens.
- Using the reference to justify light mode or generic SaaS styling.
- Editing or recompressing historical visual-reference archives.

## Trial Application

Vertical Slice 01 primary reference:

- Page label: Create Task Packet
- Source filename: `1F2214C9-D849-41CA-9435-68F0A0032EEB.jpeg`
- View name: Copilot Handoff / Create Task Packet
- Status: approved
- Related criteria: `TRIAL-AC-004` through `TRIAL-AC-013` as applicable
- Related standards: `LAY-SHELL-001`, `RCP-WORKFLOW-001`, `FND-VIS-001`, `FND-TOK-001`,
  and component IDs listed in `target-selection.md`

## Validation Checks

- Target selection cites the primary reference path.
- Visual reference pack contract requires labels and forbids contact-sheet default.
- Acceptance criteria include dark-first and no-drift expectations.

## Traceability

- `contracts/visual-reference-pack-contract.md`
- `foundation/visual-language.md`
- `trials/vertical-slice-01/target-selection.md`
- `trials/vertical-slice-01/acceptance-criteria.md`
