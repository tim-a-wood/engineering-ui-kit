# Task Packet Contract

## Purpose

Define `task-packet.md`, the task-scoped instruction file used as file 2 in the
text-only three-file handoff variant.

## Producer

Human author preparing the trial or implementation task.

## Consumer

Microsoft 365 Copilot during implementation, and reviewers checking scope and
protected behavior.

## Required Structure

```markdown
# Task Packet

## Goal
## Scope
## Constraints
## Acceptance Criteria
## References
## Expected Changed Files
## Forbidden Changes
## Required Output
## Verification Expectations
```

## Required Metadata

- Application or target name
- Target path
- Selected-project sample identity, when present, explicitly distinguished from the
  application being changed
- Primary visual reference when visual fidelity matters
- Applicable standard IDs and component IDs, or an explicit pointer to the standards
  pack that contains them

## Size and Scope Constraints

- One screen or tightly bounded change set.
- Only acceptance criteria that can produce pass/fail evidence.
- No full product roadmap content.

## Validation Rules

1. All required sections are present.
2. Expected changed files use repo-relative paths.
3. Forbidden changes and protected behavior are explicit.
4. Required output names `ui-overlay.zip`.
5. Verification expectations include build/typecheck and behavior checks.

## Prohibited Content

- Unrelated screens or features
- Requests for full-repo rewrites
- Light-mode requirements in v0.1
- Instructions to skip overlay inspection

## Minimal Valid Example

```markdown
# Task Packet

Application: UI Overlay
Path: trials/vertical-slice-01/target-app
Selected project (sample): signal-analyzer-refresh

## Goal
Refresh UI Overlay's Create Task Packet screen to dark-first Engineering UI Kit styling.

## Scope
Presentation and styling for the Create Task Packet screen only.

## Constraints
Preserve Edit/Save/Cancel, validation, preview, and export behavior.

## Acceptance Criteria
- Typecheck and build pass.
- Protected interactions still work.
- Dark-first shell and semantic tokens are present.

## References
1F2214C9-D849-41CA-9435-68F0A0032EEB.jpeg

## Expected Changed Files
- src/App.tsx
- src/styles.css

## Forbidden Changes
- src/taskPacket.ts domain behavior
- package dependencies

## Required Output
ui-overlay.zip containing changed/new files only.

## Verification Expectations
npm run typecheck && npm run build; manually verify preview and export.
```

## Invalid Example

```markdown
# Task Packet
Make the app better and modern.
```

Missing required sections, scope, protected behavior, and output contract.

## Traceability

- `../implementation-instructions.md`
- `../three-file-upload-strategy.md`
- `trials/vertical-slice-01/acceptance-criteria.md`
