# Copilot Handoff

## Purpose

Orient authors and reviewers to the constrained Microsoft 365 Copilot handoff
workflow used by the evidence-first vertical-slice trial.

## Scope

This folder defines the handoff model, three-file upload strategy, implementation and
review instructions, visual-reference strategy, context exclusions, overlay safety,
and artifact contracts required to handcraft one trial packet.

It does not automate packet generation, submit work to Copilot, or apply overlays.

## Controlling Decisions

- Every Copilot handoff stays within a strict three-file input budget.
- Copilot output is expected to be `ui-overlay.zip` containing changed and new files
  only.
- There is no direct Copilot API and no automatic application in v0.1.
- Human review remains authoritative before any overlay is applied.
- Success is never claimed before local verification.

## Folder Map

- `handoff-model.md` — producers, consumers, precedence, and authority.
- `three-file-upload-strategy.md` — exact input variants and budget rules.
- `implementation-instructions.md` — constraints embedded in implementation work.
- `review-instructions.md` — post-overlay review responsibilities.
- `visual-reference-strategy.md` — labeling and citation of approved mockups.
- `context-exclusions.md` — deterministic exclusion rules for repo context.
- `overlay-safety.md` — hard blockers and warning-only conditions.
- `contracts/` — artifact contracts for each handoff input and the returned overlay.

## Trial Application

Vertical Slice 01 uses the visual/mockup handoff variant:

1. `repo-flatfile.txt`
2. `task-and-standard-pack.md`
3. `visual-reference-pack.pdf`

The selected screen is Create Task Packet in
`trials/vertical-slice-01/target-app/`.

## Validation Checks

- No required handoff file retains scaffold-only wording.
- Three-file variants are consistent across handoff documents and prompts.
- Artifact contracts include valid and invalid examples.
- Overlay blockers and warnings are distinct.

## Traceability

- PRD and delivery plan three-file constraint.
- Roadmap Phase 1 minimum implementation contract.
- Trial records under `trials/vertical-slice-01/`.
