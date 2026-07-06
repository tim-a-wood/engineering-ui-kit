# Three-File Upload Strategy

## Purpose

Define the exact three-file upload budget and the two allowed handoff variants for
Microsoft 365 Copilot implementation trials.

## Scope

This standard covers allowed input files, text-only and visual variants, size and
scope discipline, and the separation between inputs and the returned overlay.

## Controlling Decisions

- The upload budget is exactly three files.
- Zip files are never Copilot inputs in v0.1.
- `ui-overlay.zip` is Copilot output only.
- Vertical Slice 01 uses the visual/mockup variant.

## Required Architecture

### AI-HANDOFF-010 — Strict three-file budget

Every implementation handoff uploads exactly three files. Additional context must be
compressed into those files rather than attached separately.

### AI-HANDOFF-011 — Text-only variant

1. `repo-flatfile.txt` — filtered repository context.
2. `task-packet.md` — task scope, constraints, acceptance criteria, and verification.
3. `standards-pack.md` — applicable standards excerpts only.

Use this variant when no visual reference pack is required.

### AI-HANDOFF-012 — Visual/mockup variant

1. `repo-flatfile.txt` — filtered repository context.
2. `task-and-standard-pack.md` — combined task and standards contracts.
3. `visual-reference-pack.pdf` — labeled primary visual reference pages.

Use this variant for Vertical Slice 01.

### AI-HANDOFF-013 — Standards are excerpted, not uploaded whole

Do not upload the entire `standards/` package. Include only applicable rule IDs,
component IDs, token paths, approved/rejected guidance, and accessibility requirements
for the selected screen.

### AI-HANDOFF-014 — Overlay is output, not input

Copilot must return `ui-overlay.zip` containing changed and new files only. The
overlay is inspected locally and is never one of the three upload files.

### AI-HANDOFF-015 — Manual authority remains

The user reviews exported context before upload and reviews the overlay before apply.
Exclusions reduce risk but do not replace review.

## Allowed Patterns

- One primary page image in the visual reference pack for the selected screen.
- Combined task-and-standards pack that preserves both contracts without needless
  duplication.
- Deterministic repo-flatfile ordering and repo-relative paths.

## Prohibited Patterns

- Four or more upload files.
- Zip input files.
- Full-repo dumps as the standards or task pack.
- Contact-sheet-only visual packs as the default.
- Claiming that mockups define every component.

## Trial Application

Vertical Slice 01 packet:

1. `repo-flatfile.txt` from `trials/vertical-slice-01/target-app/` after exclusions.
2. `task-and-standard-pack.md` authored from the task-packet and standards-pack
   contracts using trial acceptance criteria and applicable IDs.
3. `visual-reference-pack.pdf` containing the Create Task Packet reference
   `1F2214C9-D849-41CA-9435-68F0A0032EEB.jpeg` with labels required by the visual
   reference pack contract.

## Validation Checks

- Both variants are documented identically in handoff, contracts, and prompts.
- Overlay is identified as output only.
- Trial readiness names the selected variant explicitly.

## Traceability

- `handoff-model.md`
- `contracts/repo-flatfile-contract.md`
- `contracts/task-packet-contract.md`
- `contracts/standards-pack-contract.md`
- `contracts/task-and-standard-pack-contract.md`
- `contracts/visual-reference-pack-contract.md`
- `contracts/ui-overlay-contract.md`
