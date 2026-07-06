# Combined Task and Standards Pack Contract

## Purpose

Define `task-and-standard-pack.md`, the visual-trial replacement for separate
`task-packet.md` and `standards-pack.md` files. It is file 2 in the visual/mockup
three-file variant.

## Producer

Human author combining the task-packet and standards-pack contracts for a visual
trial.

## Consumer

Microsoft 365 Copilot during implementation, and reviewers checking both task scope
and standards traceability from one document.

## Required Structure

```markdown
# Task and Standards Pack

## Package Metadata

## Goal
## Scope
## Constraints
## Acceptance Criteria
## References
## Expected Changed Files
## Forbidden Changes
## Required Output
## Verification Expectations

## Applicable Rule IDs
## Applicable Component IDs
## Applicable Token Paths
## Approved Guidance
## Rejected Guidance
## Accessibility Requirements
## Standards Excerpts
```

## Required Metadata

All metadata required by both the task-packet and standards-pack contracts:

- application/target name and path
- selected-project sample name and path, when the target screen displays one
- package name/version and dark-first posture
- primary visual reference citation
- applicable IDs and token paths

## Size and Scope Constraints

- Preserve both contracts without duplicating prose unnecessarily.
- Task sections remain authoritative for scope and protected behavior.
- Standards sections remain authoritative for IDs and excerpts.
- Still must fit the three-file budget as a single upload file.

## Validation Rules

1. Every required task-packet section is present.
2. Every required standards-pack section is present.
3. No conflicting instructions between task and standards sections.
4. Required output remains `ui-overlay.zip`.
5. Unrelated standards are omitted.

## Prohibited Content

- Dropping either contract's required sections
- Duplicating large standards documents verbatim
- Adding a fourth conceptual input inside this file, such as embedded binaries

## Minimal Valid Example

```markdown
# Task and Standards Pack

## Package Metadata
- packageName: engineering-ui-kit-standards
- packageVersion: 0.3.0
- themePosture: dark-first
- application: UI Overlay
- path: trials/vertical-slice-01/target-app
- selectedProjectSample: signal-analyzer-refresh

## Goal
Refresh UI Overlay's Create Task Packet screen to dark-first Engineering UI Kit styling.

## Scope
Presentation and styling only.

## Constraints
Preserve packet behavior and export semantics.

## Acceptance Criteria
Build passes; protected interactions work; dark-first tokens applied.

## References
Primary visual reference: 1F2214C9-D849-41CA-9435-68F0A0032EEB.jpeg

## Expected Changed Files
- src/App.tsx
- src/styles.css

## Forbidden Changes
- Domain logic in src/taskPacket.ts
- Dependency changes

## Required Output
ui-overlay.zip

## Verification Expectations
npm run typecheck && npm run build; verify preview and export.

## Applicable Rule IDs
FND-VIS-001, FND-TOK-001, LAY-SHELL-001, RCP-WORKFLOW-001

## Applicable Component IDs
CMP-SHELL-APP, CMP-NAV-PRIMARY, CMP-WORKFLOW-STEP-INDICATOR, CMP-OVERLAY-DIALOG

## Applicable Token Paths
color.surface.*, color.text.*, color.border.*, color.action.*, color.focus.*

## Approved Guidance
Dark engineering workbench hierarchy.

## Rejected Guidance
Generic SaaS and neon styling.

## Accessibility Requirements
Keyboard, focus, dialog dismissal, textual status.

## Standards Excerpts
FND-VIS-001 — Dark-first surface hierarchy.
```

## Invalid Example

```markdown
# Task and Standards Pack
See the mockup and standards repo.
```

Missing both task and standards required sections.

## Traceability

- `task-packet-contract.md`
- `standards-pack-contract.md`
- `../three-file-upload-strategy.md`
- `AI-HANDOFF-012`
