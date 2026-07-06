# UI Overlay Contract

## Purpose

Define `ui-overlay.zip`, the only expected Copilot implementation output artifact for
v0.1 trials.

## Producer

Microsoft 365 Copilot during an implementation pass.

## Consumer

Human reviewer performing overlay-safety inspection, local verification, and manual
apply or reject decisions.

## Required Structure

- Filename: `ui-overlay.zip`
- Contents: changed and new files only
- Entry paths: repository-relative from the target-app root
- No required process-summary file
- No absolute or traversal paths
- No `.git`, dependencies, caches, secrets, or build output
- No destructive deletion semantics
- Deterministic pre-apply inspection using `overlay-safety.md`

Example listing:

```text
src/App.tsx
src/styles.css
src/tokens.css
```

## Required Metadata

The zip itself has no mandatory internal manifest in Phase 1. Reviewers record:

- source task or packet identifier
- inspection verdict
- entry list with new/overwrite status
- blockers and warnings

## Size and Scope Constraints

- Focused change set only.
- Full-repo dumps are blocked.
- Files outside expected scope are warnings.
- Default large-file warning threshold is 200 KB.

## Validation Rules

1. Archive opens and lists successfully.
2. Every path is repo-relative and safe under overlay-safety hard blockers.
3. Entries are changed/new files only.
4. No deletion is inferred from omission.
5. Inspection result is recorded before apply.
6. Local typecheck/build and protected-behavior checks occur after apply in a
   disposable or backed-up tree.

## Prohibited Content

- Absolute paths
- `..` traversal
- `.git/`
- `node_modules/`, `dist/`, caches
- `.env` and credential files
- Full repository snapshots
- Instructions that auto-apply without review

## Minimal Valid Example

`ui-overlay.zip` containing only:

```text
src/App.tsx
src/styles.css
```

Both files are text, repo-relative, and within the expected changed-file list.

## Invalid Example

`ui-overlay.zip` containing:

```text
C:\work\ui-overlay\src\App.tsx
.git/config
node_modules/react/index.js
.env
```

Absolute path, git metadata, dependency folder, and secret file are all blockers.

## Traceability

- `../overlay-safety.md`
- `../implementation-instructions.md`
- `AI-IMPL-007`
- `AI-HANDOFF-030` through `AI-HANDOFF-047`
