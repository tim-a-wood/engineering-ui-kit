# Overlay Safety

## Purpose

Define deterministic inspection rules for `ui-overlay.zip` so reviewers can block
unsafe overlays and distinguish hard blockers from warning-only conditions before any
local application.

## Scope

This standard covers hard blockers, warning-only conditions, representative fixture
concepts, and the inspection result shape. It does not implement an overlay applier or
executable fixtures in Phase 1.

## Controlling Decisions

- Hard blockers prevent apply.
- Warnings require explicit human acceptance and follow-up.
- Overlays contain changed and new files only.
- No destructive deletion semantics are implied by file absence.

## Hard Blockers

Any one of the following yields `verdict: "blocked"`:

| ID | Blocker | Detection intent |
|---|---|---|
| AI-HANDOFF-030 | Malformed archive | Zip cannot be opened or listed. |
| AI-HANDOFF-031 | Absolute path | Entry path is absolute (`/`, `C:\`, `\\`). |
| AI-HANDOFF-032 | Traversal path | Entry contains `..` segments. |
| AI-HANDOFF-033 | Normalized path outside repo | After normalization, path escapes the target root. |
| AI-HANDOFF-034 | Symlink or special file | Entry is a symlink, device, or unsupported special file. |
| AI-HANDOFF-035 | `.git/` content | Entry path includes `.git/`. |
| AI-HANDOFF-036 | Dependency, cache, or build folder | Entry targets `node_modules/`, `dist/`, `build/`, coverage, or cache dirs. |
| AI-HANDOFF-037 | Likely secret or environment file | Entry is `.env*`, key material, certificate, or obvious credential filename. |
| AI-HANDOFF-038 | Full-repo dump | Archive appears to contain an entire repository rather than a focused change set. |
| AI-HANDOFF-039 | Unsupported filename or path encoding | Path cannot be safely decoded or reviewed. |

## Warning-Only Conditions

These yield `verdict: "warning"` when no blocker is present:

| ID | Warning | Detection intent |
|---|---|---|
| AI-HANDOFF-040 | Overwrite existing source | Entry path already exists in the target repo. |
| AI-HANDOFF-041 | Lockfile or dependency change | Entry changes package manifests or lockfiles. |
| AI-HANDOFF-042 | Build or configuration change | Entry changes build tooling or tsconfig/vite config unexpectedly. |
| AI-HANDOFF-043 | File outside expected scope | Entry path is not listed in expected changed files. |
| AI-HANDOFF-044 | Unusually large file | Entry exceeds the task's size threshold, default 200 KB. |
| AI-HANDOFF-045 | Dirty repo | Target working tree has uncommitted changes before apply. |
| AI-HANDOFF-046 | Deletion instruction in accompanying text | Text asks to delete files; overlays themselves do not delete by omission. |
| AI-HANDOFF-047 | New binary asset | Entry introduces a binary file. |

## Inspection Result Shape

Conceptual result only; Phase 1 does not require executable TypeScript:

```ts
type OverlayInspectionResult = {
  verdict: "pass" | "warning" | "blocked";
  entries: Array<{
    path: string;
    status: "new" | "overwrite";
    size: number;
    expectedScope: boolean;
  }>;
  blockers: string[];
  warnings: string[];
};
```

Verdict rules:

1. If any blocker exists, `verdict` is `"blocked"`.
2. Else if any warning exists, `verdict` is `"warning"`.
3. Else `verdict` is `"pass"`.

## Representative Fixtures (Conceptual)

### Valid overlay

- `src/App.tsx`
- `src/styles.css`
- optional `src/tokens.css`

All paths repo-relative, within expected scope, text-only, no secrets.

### Blocked overlay

- `C:\work\ui-overlay\src\App.tsx` (absolute path), or
- `../secrets/.env` (traversal and secret), or
- entire repo tree including `.git/` and `node_modules/`.

### Warning-only overlay

- Overwrites `src/App.tsx` and also changes `package.json`, or
- includes `src/extra-panel.tsx` outside expected scope, with no blockers.

Actual executable fixtures may be added in a later phase.

## Allowed Patterns

- Changed/new source files only.
- Repo-relative POSIX-style paths from the target-app root.
- Deterministic listing before apply.
- Human decision after warning verdicts.

## Prohibited Patterns

- Applying a blocked overlay.
- Interpreting missing files as deletions.
- Auto-merge without inspection.
- Treating warnings as silent passes.

## Trial Application

For Vertical Slice 01, expected scope is normally:

- `src/App.tsx`
- `src/styles.css`
- optional token entry file referenced by the app

`src/taskPacket.ts` overwrites are warnings and require explicit justification because
packet behavior is protected.

## Validation Checks

- Hard blockers and warnings are not conflated.
- Result shape matches this document.
- UI overlay contract references the same blocker classes.

## Traceability

- `contracts/ui-overlay-contract.md`
- `review-instructions.md`
- `validation/evidence-first-trial-measurement.md`
- `trials/vertical-slice-01/acceptance-criteria.md`
