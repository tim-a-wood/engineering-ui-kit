# Handoff Model

## Purpose

Define how standards, repository context, task detail, and visual references are
translated into a constrained Copilot handoff and how returned overlays are reviewed
before any local application.

## Scope

This standard covers producers, user actions, and consumers for each artifact;
three-file variants; source precedence; review-before-apply behavior; and explicit
prohibitions on direct Copilot APIs, automatic application, and unverified success
claims.

## Controlling Decisions

- The user remains the authority for upload, review, and apply decisions.
- Phase 1 prepares documents only; it does not run the Copilot trial.
- The returned artifact is a zip overlay, never a full-repo replacement.

## Required Architecture

### AI-HANDOFF-001 — Artifact producers, user actions, and consumers

| Artifact | Producer | User action | Consumer |
|---|---|---|---|
| `repo-flatfile.txt` | Human or later generator using context exclusions | Upload as file 1 | Copilot implementation pass |
| `task-packet.md` | Human author | Upload as file 2 in text-only variant | Copilot implementation pass |
| `standards-pack.md` | Human author excerpting applicable standards | Upload as file 3 in text-only variant | Copilot implementation pass |
| `task-and-standard-pack.md` | Human author combining task and standards contracts | Upload as file 2 in visual variant | Copilot implementation pass |
| `visual-reference-pack.pdf` | Human author packaging labeled references | Upload as file 3 in visual variant | Copilot implementation pass |
| Implementation prompt | Human, from `standards/prompts/implementation-prompt.md` | Paste or attach with the three files | Copilot implementation pass |
| `ui-overlay.zip` | Copilot | Download and inspect locally | Human reviewer and local apply workflow |
| Review prompt | Human, from `standards/prompts/review-prompt.md` | Provide changed files and evidence | Copilot or human review pass |

### AI-HANDOFF-002 — Three-file variants

Text-only variant:

1. `repo-flatfile.txt`
2. `task-packet.md`
3. `standards-pack.md`

Visual/mockup variant:

1. `repo-flatfile.txt`
2. `task-and-standard-pack.md`
3. `visual-reference-pack.pdf`

Vertical Slice 01 uses the visual/mockup variant.

### AI-HANDOFF-003 — Source precedence

When instructions conflict, use:

1. task packet or combined task-and-standards pack for task scope;
2. applicable standards excerpts and stable rule IDs;
3. labeled visual references for calibration only;
4. repository flatfile as implementation context;
5. historical chat or informal notes only as non-authoritative background.

Mockups calibrate visual direction. They do not exhaust component standards.

### AI-HANDOFF-004 — Review-before-apply behavior

No overlay is applied until a human inspects it against overlay-safety rules, expected
changed-file scope, and protected behavior. Review may use the review prompt, but the
apply decision remains manual.

### AI-HANDOFF-005 — No direct Copilot API

v0.1 does not integrate a Copilot API. The user performs upload and download in the
Microsoft 365 Copilot surface.

### AI-HANDOFF-006 — No automatic application

v0.1 does not auto-extract or auto-merge `ui-overlay.zip` into the target repo.

### AI-HANDOFF-007 — No success claim before local verification

Implementation or review output must not claim success until local typecheck/build,
overlay inspection, acceptance criteria, and protected-behavior checks are performed.

## Allowed Patterns

- Handcrafted packets for the first trial.
- Explicit applicable standard and component IDs.
- One primary visual reference page for the selected screen.
- Manual rollback by restoring the disposable trial app.

## Prohibited Patterns

- Uploading the full standards package as one of the three files.
- Treating chat history as the task contract.
- Applying overlays without inspection.
- Claiming the workflow is proven before trial evidence exists.

## Trial Application

Vertical Slice 01 prepares the visual/mockup variant for
`trials/vertical-slice-01/target-app/` Create Task Packet. Phase 1 stops after
readiness; Phase 3 runs the Copilot trial.

## Validation Checks

- Each artifact has a producer, user action, and consumer.
- Both three-file variants are named consistently.
- Review-before-apply and no-auto-apply rules are explicit.
- Prompts and contracts cite the same artifact names.

## Traceability

- `three-file-upload-strategy.md`
- `contracts/`
- `standards/prompts/implementation-prompt.md`
- `standards/prompts/review-prompt.md`
- `trials/vertical-slice-01/target-selection.md`
