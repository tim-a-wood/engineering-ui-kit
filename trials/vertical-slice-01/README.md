# Vertical Slice 01

Roadmap Phase 1 trial package for one disposable Create Task Packet target app and
the documents required to handcraft a three-file Microsoft 365 Copilot packet.

## Contents

```text
target-app/                  Disposable React/Vite/TypeScript baseline app
target-selection.md          Selected target, screen, and applicable IDs
baseline.md                  Install, typecheck, build, and behavior baseline
baseline/                    Screenshot directory
acceptance-criteria.md       Later-transformation acceptance criteria
phase-1-readiness-result.md  Phase 1 exit record
phase-2/                     Roadmap Phase 2 three-file packet and evidence
```

### Roadmap Phase 2 Packet

- Packet directory: [`phase-2/`](phase-2/)
- Upload files:
  - [`phase-2/packet/repo-flatfile.txt`](phase-2/packet/repo-flatfile.txt)
  - [`phase-2/packet/task-and-standard-pack.md`](phase-2/packet/task-and-standard-pack.md)
  - [`phase-2/packet/visual-reference-pack.pdf`](phase-2/packet/visual-reference-pack.pdf)
- Completion result: [`phase-2/phase-2-completion-result.md`](phase-2/phase-2-completion-result.md)
- Copy-paste prompt: [`phase-2/copy-paste-implementation-prompt.md`](phase-2/copy-paste-implementation-prompt.md)

## Selected Three-File Variant

Visual/mockup variant:

1. `repo-flatfile.txt`
2. `task-and-standard-pack.md`
3. `visual-reference-pack.pdf`

## Baseline Commands

From `target-app/`:

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

## Phase Boundary

Phase 1 prepares readiness only. Roadmap Phase 2 handcrafts and validates the
three-file packet under `phase-2/`. Neither phase uploads to Copilot, pastes the
implementation prompt, or applies an overlay. Roadmap Phase 3 is the user-owned
upload and evidence-first trial.
