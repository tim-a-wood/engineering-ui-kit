# Implementation Instructions

## Purpose

Define the instructions that constrain a Copilot implementation pass for Engineering
UI Kit compliant UI changes.

## Scope

This standard covers implementation constraints, source hierarchy, dark-first and
token expectations, protected behavior, output shape, and reporting limitations.
Reusable prompt wording lives in `standards/prompts/implementation-prompt.md`.

## Controlling Decisions

- Copilot must inspect all three inputs before editing.
- Changes are limited to expected files and task scope.
- Domain behavior is preserved.
- Output is `ui-overlay.zip` with changed and new files only.
- Limitations must be reported rather than silently invented.

## Required Architecture

### AI-IMPL-001 — Inspect all three inputs first

Before proposing changes, inspect the repo flatfile, the task or combined pack, and
the standards or visual reference pack. Do not begin from memory or chat history.

### AI-IMPL-002 — Constrain changes to expected files and task scope

Modify only files listed under expected changed files. Do not rename protected modules,
expand into unrelated screens, or rewrite the repository.

### AI-IMPL-003 — Preserve domain behavior

Keep task-section behavior, validation rules, preview and export semantics, and any
other protected behaviors listed in the task packet. Presentation may change; domain
outcomes must not.

### AI-IMPL-004 — Enforce dark-first semantic tokens

Transformed UI must be dark-first and must consume semantic tokens through CSS custom
properties. Do not implement light mode. Do not hard-code decorative colors outside
the token entry point.

### AI-IMPL-005 — Reference the primary visual page and applicable IDs

Use the labeled primary visual reference and the supplied standard, component, layout,
and token IDs. Treat mockups as calibration, not an exhaustive component catalog.

### AI-IMPL-006 — Require accessibility behavior

Preserve or improve keyboard access, visible focus, dialog dismissal, focus return,
labels, and status text that does not rely on color alone.

### AI-IMPL-007 — Require `ui-overlay.zip`

Return changed and new files only in `ui-overlay.zip` using repo-relative paths. Do
not return a full repository archive.

### AI-IMPL-008 — Prohibit unrelated rewrites

Do not add routers, state libraries, component libraries, network clients, Electron
code, tests frameworks, or unrelated refactors.

### AI-IMPL-009 — Report limitations instead of inventing requirements

If an input is missing, ambiguous, or conflicting, report the limitation. Do not
silently invent product requirements or acceptance criteria.

### AI-IMPL-010 — No success claim without local verification

Do not claim the task is complete. Local typecheck, build, overlay inspection, and
acceptance checks remain human-owned.

## Allowed Patterns

- Focused presentation and styling changes.
- One global token entry point.
- Semantic HTML retained or improved.
- Explicit notes about unresolved limitations.

## Prohibited Patterns

- Full-repo output.
- Light-mode implementation.
- Generic SaaS or neon styling.
- Changing export filenames or validation rules without explicit permission.
- Automatic application instructions that bypass human review.

## Trial Application

For Vertical Slice 01, implementation work targets the Create Task Packet baseline in
`trials/vertical-slice-01/target-app/` and must preserve Edit/Save/Cancel, validation,
preview dialog behavior, and `task-packet.md` export.

## Validation Checks

- Implementation prompt markers are fully defined for the trial.
- Expected changed files and protected behavior are present in the task pack.
- Overlay contract and implementation instructions agree on `ui-overlay.zip`.

## Traceability

- `standards/prompts/implementation-prompt.md`
- `contracts/ui-overlay-contract.md`
- `reference-architecture/styling-and-theming.md`
- `trials/vertical-slice-01/acceptance-criteria.md`
