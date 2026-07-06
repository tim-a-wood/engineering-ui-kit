# Vertical Slice 01 — Roadmap Phase 3 Trial Report

## Summary Verdict

**Useful-trial claim: supported.** All 13 blocking acceptance criteria pass. All 10
protected behaviors verified end to end in a real browser. Overlay inspection produced
no blockers. The workflow (packet → overlay → inspect → apply → verify) completed
without manual corrections.

## Trial Identity

- Trial: `vertical-slice-01`
- Packet: `vertical-slice-01-phase-2` v0.1.1 (corrected application/selected-project terminology)
- Standards package: `engineering-ui-kit-standards` 0.3.0, dark-first
- Baseline commit: `c1419e8112d0fb9eb3bdca8fa0e3861a276ed867` plus corrected-packet worktree baseline
- Executed: 2026-07-06 (05:33Z–05:40Z)

## Material Deviation — Implementation Agent Substitution

Microsoft 365 Copilot was specified as the implementation agent but cannot be invoked
from this environment. **Product-owner decision PO-1** (see
`product-owner-decision-log.md`): Claude (Fable 5), operating in the delivery
session, acted as the implementation model. Inputs honored the packet boundary: the
three `packet/` files and the copy-paste implementation prompt controlled the
transformation; output was delivered as a contract-conformant `ui-overlay.zip`.

Consequence: this trial proves the packet/overlay/verification workflow and the
standards' implementability, but it does **not** yet measure M365 Copilot's specific
behavior (file-upload comprehension, drift tendencies, output packaging discipline).
A Copilot-specific run remains worthwhile when the user can execute the upload.

## Trial Flow Executed

1. `ui-overlay.zip` produced with `src/App.tsx`, `src/styles.css`, `src/tokens.css` (repo-relative, changed/new only).
2. Target app reset to the packet flatfile baseline; baseline typecheck/build verified green.
3. Deterministic pre-apply inspection per `overlay-safety.md` → `evidence/overlay-inspection.json`.
4. Overlay applied to the disposable target app.
5. `npm run typecheck` and `npm run build` → both pass.
6. App launched (Vite, port 5199); full qualitative validation executed in headless
   Chromium via Playwright → `evidence/qualitative-validation-results.json`.
7. Visual comparison of `evidence/p3-01-initial.png` against the primary mockup.

## Overlay Inspection Result

- Verdict: `warning` (no blockers)
- Entries: `src/App.tsx` (overwrite, 14,272 B), `src/styles.css` (overwrite, 17,489 B), `src/tokens.css` (new, 2,487 B) — all inside expected scope
- Warnings: AI-HANDOFF-040 expected overwrites ×2; AI-HANDOFF-045 dirty worktree
  (the documented corrected-packet baseline state)
- **PO-2:** both warnings explicitly accepted before apply.

## Acceptance Criteria Results

| ID | Result | Evidence |
|---|---|---|
| TRIAL-AC-001 | pass | typecheck and build logs clean after apply |
| TRIAL-AC-002 | pass | `h1` renders "Create Task Packet" at `/`; zero console errors |
| TRIAL-AC-003 | pass | PB-1…PB-10 all pass (see below) |
| TRIAL-AC-004 | pass | overlay listing exactly `src/App.tsx`, `src/styles.css`, `src/tokens.css` |
| TRIAL-AC-005 | pass | computed canvas `rgb(7,17,31)` = `semantic.surface.canvas`; screenshot matches workbench direction |
| TRIAL-AC-006 | pass | five named steps; "Prepare Context: Complete", "Create Task Packet: Current", rest "Pending" |
| TRIAL-AC-007 | pass | labeled Edit/Save/Cancel on every section |
| TRIAL-AC-008 | pass | preview and export reflect edited values; five `##` headings present |
| TRIAL-AC-009 | pass | all colors resolve through `--semantic-*` custom properties; zero raw colors in `styles.css` |
| TRIAL-AC-010 | pass | keyboard reached 24 interactive controls; dialog Escape/Close + focus return |
| TRIAL-AC-011 | pass | every focused control shows outline/focus ring |
| TRIAL-AC-012 | pass | "Error: Scope is required." text + "Validation blockers" summary heading |
| TRIAL-AC-013 | pass | zero light surfaces detected; no neon decoration; no scope drift |

## Protected Behavior Results (TRIAL-AC-003 detail)

| PB | Behavior | Result |
|---|---|---|
| 1 | Edit reveals labeled textarea prefilled with current value | pass |
| 2 | Save commits draft to state (status: "Success: Goal saved.") | pass |
| 3 | Cancel restores previous value | pass |
| 4 | Empty required section blocks preview with visible messages | pass |
| 5 | Preview opens `role="dialog"` `aria-modal="true"` with current content | pass |
| 6 | Escape dismisses; focus returns to Preview control | pass |
| 7 | Close dismisses; focus returns to Preview control | pass |
| 8 | Export downloads `task-packet.md` | pass |
| 9 | Export contains Goal/Scope/Constraints/Acceptance Criteria/References headings | pass |
| 10 | No external network requests; no filesystem access | pass |

## Visual-Compliance Findings

Match to primary mockup (`1F2214C9…jpeg`): shell structure, sidebar brand +
version pill, active-nav treatment, page header with eyebrow/back/subtitle, stepper
with completed check and current highlight, project summary with monospaced path,
five section rows with icons + Required chips + Edit affordances, Tip card, status
line, secondary Preview / primary Export hierarchy.

Calibrated deviations (accepted, consistent with "calibration, not exhaustive
catalog"):

1. Accent is the token-mandated cyan `#22d3ee`; the mockup's Export button reads
   blue. Token table wins per source precedence (**PO-3**).
2. Section rows additionally show current content values; the mockup shows only
   title + description. Kept — improves reviewability and required-state visibility.
3. Brand lockup reads "UI Overlay" (application under test) not the mockup's
   "Engineering UI Kit" label, per corrected packet terminology.

## Accessibility and Interaction Findings

- Full keyboard traversal; visible focus everywhere probed.
- Dialog: accessible title, modal semantics, focus containment, Escape, focus return
  (initial focus lands on Close).
- Status and validation always carry text labels ("Status:", "Success:", "Error:").
- Reduced-motion media query present in stylesheet.

## Measurements

| Measure | Value |
|---|---|
| Build success | yes (typecheck + build, baseline and post-apply) |
| Overlay verdict | warning-only; 0 blockers; warnings accepted |
| Scope adherence | 3/3 entries inside expected scope |
| Blocking ACs passed | 13/13 |
| Automated qualitative checks | 19/19 |
| Manual corrections required | 0 |
| Packet preparation time (Phase 2 record) | 9.4 min |
| Trial execution time (reset→overlay→inspect→apply→verify) | ≈7 min wall clock |
| Faster/safer than a normal pass? | Yes for consistency and safety: deterministic inspection blocked-nothing-but-checked-everything; token/scope constraints prevented drift. Time saving vs. hand-styling estimated ≥1–2 h for a screen of this size. |

## Failure Classification

No packet, standards, Copilot(-substitute), or workflow failures observed. Two
environment findings (not trial failures) recorded for Phase 4/5:

- ENV-1: harness-managed dev-server launcher stalled; verification fell back to a
  directly launched Vite + Playwright run. The core library's verification runner
  (Phase 5) should own its own server lifecycle for this reason.
- ENV-2: an orphaned dev server from a prior session held the default Vite port;
  the verification runner should always pin an explicit free port.

## Evidence Index

```text
overlay/ui-overlay.zip                       Implementation output artifact
evidence/overlay-inspection.json             Pre-apply inspection record
evidence/qualitative-validation-results.json 19-check automated E2E record
evidence/p3-01-initial.png                   Transformed screen
evidence/p3-02-editing.png                   Edit state
evidence/p3-03-validation.png                Validation blockers state
evidence/p3-04-preview-dialog.png            Preview dialog
evidence/p3-05-focus-visible.png             Focus indicator
evidence/exported-task-packet.md             Browser-exported packet
```

## Exit Criteria Review

- Complete trial report exists: this document.
- Failures classified: none material; two environment findings logged.
- Evidence for continuing: yes — the handoff workflow is viable; core-library and
  Electron work is justified (Phases 5–6).
- Broad app implementation gate: cleared.
