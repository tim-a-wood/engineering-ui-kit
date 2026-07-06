# Standards Pack Contract

## Purpose

Define `standards-pack.md`, the applicable-standards excerpt used as file 3 in the
text-only three-file handoff variant.

## Producer

Human author excerpting only the standards needed for the selected task.

## Consumer

Microsoft 365 Copilot during implementation, and reviewers checking standards
traceability.

## Required Structure

```markdown
# Standards Pack

## Package Metadata
## Applicable Rule IDs
## Applicable Component IDs
## Applicable Token Paths
## Approved Guidance
## Rejected Guidance
## Accessibility Requirements
## Excerpts
```

## Required Metadata

- package name and version from `standards/package-metadata.json`
- theme posture: dark-first
- selected screen or task name
- explicit statement that unrelated standards are omitted

## Size and Scope Constraints

- Include only rules, components, and tokens needed by the selected screen.
- Prefer stable IDs plus short excerpts over whole-document dumps.
- Do not include reserved components unless the task requires them.

## Validation Rules

1. Package/version metadata is present.
2. Every included rule ID is stable and traceable.
3. Applicable component IDs and token paths are listed.
4. Approved and rejected guidance are both present.
5. Accessibility requirements are present.
6. No unrelated standards sections are included without rationale.

## Prohibited Content

- Entire standards package dump
- Unrelated chart, table, or dashboard guidance for a non-chart task
- Light-mode guidance in v0.1
- Untraceable freeform style advice with no IDs

## Minimal Valid Example

```markdown
# Standards Pack

## Package Metadata
- packageName: engineering-ui-kit-standards
- packageVersion: 0.3.0
- themePosture: dark-first
- screen: Create Task Packet

## Applicable Rule IDs
- FND-VIS-001
- FND-TOK-001
- LAY-SHELL-001
- RCP-WORKFLOW-001

## Applicable Component IDs
- CMP-SHELL-APP
- CMP-NAV-PRIMARY
- CMP-SHELL-PAGE-HEADER
- CMP-WORKFLOW-STEP-INDICATOR
- CMP-FORM-TEXTAREA
- CMP-OVERLAY-DIALOG
- CMP-FEEDBACK-VALIDATION-SUMMARY

## Applicable Token Paths
- color.surface.*
- color.text.*
- color.border.*
- color.action.*
- color.status.*
- color.focus.*

## Approved Guidance
Dark engineering workbench shell with clear hierarchy and semantic tokens.

## Rejected Guidance
Generic SaaS white cards, neon accents, and untokenized hard-coded colors.

## Accessibility Requirements
Keyboard access, visible focus, dialog Escape/Close, status not by color alone.

## Excerpts
FND-VIS-001 — Dark-first surface hierarchy.
```

## Invalid Example

```markdown
# Standards Pack
Use good design and modern colors.
```

No metadata, IDs, approved/rejected guidance, or accessibility requirements.

## Traceability

- `standards/package-metadata.json`
- `standards/tokens.json`
- `standards/component-manifest.json`
- `../three-file-upload-strategy.md`
