# Qualitative Verification Checklist

## Purpose

Reusable end-to-end verification checklist for a transformed Engineering UI Kit
screen, derived from the Vertical Slice 01 Phase 3 trial. Each item is automatable in
a real browser (the trial used Playwright against the running dev server); evidence
lives beside the trial as screenshots plus a JSON result record.

## Preconditions

- Overlay inspection completed with no unaccepted blockers or warnings.
- `npm run typecheck` and `npm run build` pass after overlay application.
- App launched on an explicitly pinned free port (never assume the framework default
  port is available; see trial finding ENV-2).

## Checklist

| # | Check | Method | Trial evidence key |
|---|---|---|---|
| 1 | Screen renders at `/` with zero console errors | page load + console listener | TRIAL-AC-002 |
| 2 | Root canvas uses `semantic.surface.canvas` | computed body background | TRIAL-AC-005 |
| 3 | Semantic tokens resolve as CSS custom properties | computed `--semantic-*` probes | TRIAL-AC-009 |
| 4 | Workflow stepper: five named steps, exactly one current | DOM state probe | TRIAL-AC-006 |
| 5 | Edit reveals labeled textarea prefilled with committed value | interaction | PB-1 |
| 6 | Save commits draft; status text confirms | interaction | PB-2 |
| 7 | Cancel restores previous committed value | interaction | PB-3 |
| 8 | Empty required section blocks preview with visible messages | interaction | PB-4 |
| 9 | Field error and summary carry text labels, not color alone | text assertion | TRIAL-AC-012 |
| 10 | Preview dialog: `role=dialog`, `aria-modal`, labelled, current values | DOM + content probe | PB-5 / TRIAL-AC-008 |
| 11 | Escape dismisses dialog; focus returns to invoking control | keyboard interaction | PB-6 |
| 12 | Close dismisses dialog; focus returns to invoking control | interaction | PB-7 |
| 13 | Export downloads the contracted filename | download capture | PB-8 |
| 14 | Exported Markdown contains all required headings and current values | file content assertion | PB-9 |
| 15 | No external network requests during the session | request listener | PB-10 |
| 16 | Keyboard traversal reaches all interactive controls | Tab walk | TRIAL-AC-010 |
| 17 | Every focused control shows a visible outline or ring | computed style during Tab walk | TRIAL-AC-011 |
| 18 | No light-mode surfaces anywhere in the shell | computed background sweep | TRIAL-AC-013 |
| 19 | Screenshot set captured: initial, editing, validation, dialog, focus | screenshots | evidence PNGs |

## Result Record

Store results as JSON: `{ results: [{ id, pass, detail }], consoleErrors, externalRequests, generatedAt }`,
plus the screenshot set, in the trial's `evidence/` directory. The Phase 3 reference
implementation is `trials/vertical-slice-01/phase-3/evidence/validate-trial.mjs`.

## Traceability

- `trials/vertical-slice-01/acceptance-criteria.md`
- `standards/validation/evidence-first-trial-measurement.md`
- `standards/prompts/visual-drift-prompt.md`
