# File and Folder Conventions

## Purpose

Define file and folder conventions for the trial target app, standards package
references, generated handoff artifacts, and future monorepo boundaries.

## Scope

This standard covers application and standards naming, placement of components,
utilities, contracts, and trial fixtures, separation of generated artifacts from
source, and expected future package boundaries without creating those packages now.

## Controlling Decisions

- The disposable trial app lives at `trials/vertical-slice-01/target-app/`.
- Trial records live beside the app under `trials/vertical-slice-01/`.
- Generated handoff artifacts are not written into a target repo unless explicitly
  exported by a user or later tooling.
- Phase 1 does not create a monorepo package layout for core library or Electron.

## Required Architecture

### ARCH-FILE-001 — Application naming

Use lowercase path segments and descriptive filenames. Trial app source files use
camelCase or PascalCase TypeScript names (`taskPacket.ts`, `App.tsx`) and a single
baseline stylesheet (`styles.css`).

### ARCH-FILE-002 — Standards package naming

Standards documents use kebab-case Markdown filenames. Stable rule IDs remain inside
document content and must not be renamed casually. Machine-readable contracts remain
at `standards/tokens.json` and `standards/component-manifest.json`.

### ARCH-FILE-003 — Component, utility, contract, and trial-fixture placement

- Presentation and interaction: target-app `src/` view files.
- Domain utilities: target-app modules such as `taskPacket.ts`.
- Artifact contracts: `standards/copilot-handoff/contracts/`.
- Trial fixtures and records: `trials/vertical-slice-01/`.

### ARCH-FILE-004 — Generated artifacts separated from source

Handoff outputs such as `repo-flatfile.txt`, compiled packs, and `ui-overlay.zip`
are generated artifacts. Store them in an explicit export or trial-output location,
not mixed into standards source or committed as if they were authored standards.

### ARCH-FILE-005 — No generated handoff artifacts in a target repo by default

Do not write generated packet files into the target application tree unless the user
explicitly exports them there. The trial app may download `task-packet.md` in the
browser without persisting it into source control.

### ARCH-FILE-006 — Future monorepo boundaries

Future packages may include standards consumption helpers, a core library, and an
Electron shell. Phase 1 must not create those packages. Keep the trial app disposable
and self-contained.

## Allowed Patterns

- `trials/vertical-slice-01/target-app/src/` for baseline source.
- `trials/vertical-slice-01/baseline/` for screenshots and baseline evidence.
- `standards/copilot-handoff/contracts/` for artifact contracts.
- Browser download of exported Markdown without writing into the repo.

## Prohibited Patterns

- Committing Copilot overlays as standards content.
- Writing generated flatfiles into `standards/`.
- Creating `packages/core`, Electron shells, or CLI packages in Phase 1.
- Scattering trial acceptance evidence outside `trials/vertical-slice-01/` without
  a recorded reason.

## Trial Application

Expected trial tree:

```text
trials/vertical-slice-01/
  README.md
  target-selection.md
  baseline.md
  acceptance-criteria.md
  phase-1-readiness-result.md
  baseline/
  target-app/
    package.json
    src/main.tsx
    src/App.tsx
    src/styles.css
    src/taskPacket.ts
```

Expected changed-file scope for the later Copilot transformation is limited to
presentation and styling files listed in the task packet, typically:

- `src/App.tsx`
- `src/styles.css`
- optionally a new token entry stylesheet referenced by the app

`src/taskPacket.ts` is protected unless the task packet explicitly allows a
presentation-safe change that cannot alter domain behavior.

## Validation Checks

- Trial records exist under `trials/vertical-slice-01/`.
- Target app source remains small enough for complete human review.
- Overlay and packet contracts require repo-relative paths only.
- No core-library or Electron package directories are introduced by Phase 1.

## Traceability

- Handoff contracts: `standards/copilot-handoff/contracts/`.
- Overlay safety: `standards/copilot-handoff/overlay-safety.md`.
- Trial selection: `trials/vertical-slice-01/target-selection.md`.
