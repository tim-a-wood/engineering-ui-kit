# Review Instructions

## Purpose

Define how reviewers evaluate Copilot-produced overlays and local verification
evidence for Engineering UI Kit trials.

## Scope

This standard covers review inputs, acceptance-criteria checking, overlay scope,
protected behavior, severity classification, visual and accessibility drift, and
corrective-action output. Reusable prompt wording lives in
`standards/prompts/review-prompt.md`.

## Controlling Decisions

- Review only provided changed files and evidence.
- Every acceptance criterion receives an explicit result.
- Findings are classified as blocker, warning, or note.
- Broad rewrites are out of scope for review output.

## Required Architecture

### AI-REVIEW-001 — Review only provided changed files and evidence

Do not assume unstated repository changes. Use the overlay contents, local diff,
build/typecheck output, and recorded screenshots or notes.

### AI-REVIEW-002 — Check every acceptance criterion

Evaluate each `TRIAL-AC-*` or task-specific criterion as pass, fail, or not evidenced.
Missing evidence is not a pass.

### AI-REVIEW-003 — Check overlay scope and protected behavior

Confirm the overlay stays within expected files, uses repo-relative paths, and does
not alter protected domain behavior.

### AI-REVIEW-004 — Distinguish blocker, warning, and note

- Blocker: prevents apply or trial success.
- Warning: apply may proceed only with explicit human acceptance and follow-up.
- Note: non-blocking observation.

### AI-REVIEW-005 — Identify visual and accessibility drift

Check dark-first hierarchy, semantic tokens, workflow stepper, focus, keyboard and
dialog behavior, and status text. Flag generic SaaS, neon, or untokenized styling.

### AI-REVIEW-006 — Avoid proposing broad rewrites

Review output should list concise corrective actions suitable for a follow-up packet.
Do not propose repository-wide redesigns.

### AI-REVIEW-007 — Return a corrective-action list

Each failed or warning item should include the affected files, the violated rule or
criterion ID, and the smallest corrective action.

### AI-REVIEW-008 — No success claim without verification evidence

A review may say the overlay appears compliant only when build/typecheck, inspection,
and acceptance evidence are present.

## Allowed Patterns

- Criterion-by-criterion tables.
- Overlay inspection summaries using the overlay-safety result shape.
- Follow-up packet suggestions limited to failed criteria.

## Prohibited Patterns

- Rubber-stamp approvals without evidence.
- Collapsing blockers into notes.
- Requesting unrelated features during review.
- Treating mockups as proof that every component exists.

## Trial Application

Vertical Slice 01 review uses `trials/vertical-slice-01/acceptance-criteria.md`,
overlay-safety rules, and protected behaviors recorded in `baseline.md`.

## Validation Checks

- Review prompt has no open placeholders.
- Severity model matches overlay-safety and measurement documents.
- Corrective actions are packet-sized, not program-sized.

## Traceability

- `standards/prompts/review-prompt.md`
- `overlay-safety.md`
- `validation/ui-compliance-rubric.md`
- `validation/visual-drift-checklist.md`
- `trials/vertical-slice-01/acceptance-criteria.md`
