# Content and Language

## Purpose

This file defines writing rules for engineering UI copy.

## Scope

The guidance applies to labels, button text, status text, validation messages, empty states, warnings, confirmations, help text, and implementation prompts.

## FND-CONTENT-001 — Use direct engineering language

UI copy shall describe the artifact, state, command, or consequence directly. Avoid marketing tone and personality-heavy phrasing.

## FND-CONTENT-002 — Make action consequences explicit

Destructive, overwrite, export, apply, or generation actions shall state what will change and whether evidence or source files are affected.

## FND-CONTENT-003 — Prefer specific status labels

Use specific labels such as `Not run`, `Running`, `Passed`, `Failed`, `Blocked`, `Needs review`, `Applied`, `Generated`, and `Out of date` where applicable.

## FND-CONTENT-004 — Separate instruction, status, and evidence text

Instruction text tells the user what to do. Status text tells what is happening or known. Evidence text links to artifacts, logs, validation results, or generated outputs. Do not collapse these into one vague message.

## FND-CONTENT-005 — Error messages must identify cause and next action where known

Error messages shall state what failed, where it failed, and what the user can do if that is known. Unknown causes shall be identified as unknown without speculation.

## FND-CONTENT-006 — Avoid marketing and personality-heavy copy

Copy such as `Magic`, `Looks good`, `Oops`, or `Something happened` shall not be used when engineering certainty is required.

## FND-CONTENT-007 — Use stable nouns for artifacts

Use consistent names such as `component manifest`, `token contract`, `standard pack`, `validation result`, `mockup reference`, `handoff packet`, and `artifact`.

## FND-CONTENT-008 — Help text and tips

Help text should clarify constraints, file expectations, or workflow consequences. It shall not hide required information that should be visible in labels, errors, or summaries.

## FND-CONTENT-009 — Confirmation copy

Confirmation dialogs shall identify the action, affected artifact, consequence, reversibility, and required user choice. Destructive confirmations shall not use ambiguous labels such as `OK`.

## Approved Copy Examples

| Context | Approved copy |
|---|---|
| Validation failure | `3 required fields are missing. Review the highlighted fields before generating the handoff packet.` |
| Stale artifact | `Out of date — token contract changed after this preview was generated.` |
| Destructive action | `Delete generated packet? This removes the local generated files but does not change standards sources.` |
| Blocked state | `Blocked — component manifest is invalid. Fix JSON errors before continuing.` |

## Rejected Copy Examples

| Copy | Reason |
|---|---|
| `Oops, something went wrong.` | Does not identify cause or action. |
| `AI did it.` | Not traceable or reviewable. |
| `Looks good.` | Too vague for engineering validation. |
| `Magic generate` | Marketing tone and unclear consequence. |
