# Vertical Slice 01 — Roadmap Phase 2

Handcrafted minimum three-file Microsoft 365 Copilot handoff packet for the
UI Overlay Create Task Packet screen. `signal-analyzer-refresh` is fixed
selected-project sample data displayed within the screen, not the application being
redesigned.

## Purpose

Prepare one deterministic, reviewable, task-specific visual handoff packet without
building a general handoff generator and without running Copilot.

## Upload Files

Only the contents of `packet/` are upload inputs:

```text
packet/repo-flatfile.txt
packet/task-and-standard-pack.md
packet/visual-reference-pack.pdf
```

Do not upload `evidence/`, `source/`, `tools/`, this README,
`copy-paste-implementation-prompt.md`, or `phase-2-completion-result.md`.

## Local Records

| Path | Role |
|---|---|
| `evidence/` | Context review, manifest hashes, validation record, PDF page render |
| `source/visual-reference-pack.html` | Reproducible one-page PDF layout source |
| `tools/validate-packet.py` | Trial-specific packet validator |
| `copy-paste-implementation-prompt.md` | Fully substituted Copilot message text |
| `phase-2-completion-result.md` | Roadmap Phase 2 exit record |

## Validation

From the repository root:

```bash
python3 trials/vertical-slice-01/phase-2/tools/validate-packet.py
```

On Windows:

```powershell
py trials/vertical-slice-01/phase-2/tools/validate-packet.py
```

## Human Pre-Upload Review

A human must review the three packet files for sensitive or unnecessary content,
open the PDF, and confirm manifest hashes before any upload.

## Visual Reference Pack Withheld From the Public Repository

`packet/visual-reference-pack.pdf`, `evidence/visual-reference-pack-page-1.png`,
and `source/visual-reference-pack.html` embed an approved internal hi-fi mockup
image and are excluded from the public repository. Their exact SHA-256 hashes and
byte counts remain recorded in `evidence/packet-manifest.json` and
`phase-2-completion-result.md`, so a locally held copy can still be verified.

## Phase Boundary

Roadmap Phase 2 does not upload to Microsoft 365 Copilot, paste the implementation
prompt, generate or apply `ui-overlay.zip`, or evaluate transformed UI.

The next step is Roadmap Phase 3: user-owned upload and evidence-first trial execution.
