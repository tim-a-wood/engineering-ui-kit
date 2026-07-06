# Evidence-First Trial Measurement

## Purpose

Define the measurement fields required to evaluate one Microsoft 365 Copilot
implementation trial without relying on informal recollection.

## Scope

This contract covers timing, overlay inspection, build results, acceptance outcomes,
defect classification, manual correction effort, and the subjective usefulness
decision for Vertical Slice 01 and later comparable trials.

## Measurement Table

Record one row set per trial attempt:

| Metric | Value | Evidence | Notes |
|---|---|---|---|
| Baseline install time | | command log / stopwatch | `npm install` in target app |
| Packet preparation time | | stopwatch | handcrafting three-file packet |
| Copilot interaction time | | stopwatch | upload through overlay download |
| Overlay inspection verdict | pass / warning / blocked | inspection notes | from overlay-safety result |
| Changed file count | | overlay listing | total entries |
| New file count | | overlay listing | status = new |
| Overwritten file count | | overlay listing | status = overwrite |
| Build result | pass / fail | command log | `npm run build` |
| Typecheck result | pass / fail | command log | `npm run typecheck` |
| Test result | pass / fail / not-run | command log | Phase 1 target has no test suite |
| Acceptance criteria passed | | criteria table | count |
| Acceptance criteria failed | | criteria table | count |
| Blocker count | | review result | |
| Warning count | | review result | |
| Note count | | review result | |
| Manual correction count | | review notes | distinct fixes after overlay |
| Manual correction time | | stopwatch | |
| Total elapsed time | | stopwatch | packet prep through final decision |
| Subjective usefulness decision | useful / not useful / inconclusive | rationale | required |

## Failure Classification

Classify each material failure as one of:

- packet issue
- standards issue
- Copilot issue
- workflow issue
- target-repo issue

## Visual and Accessibility Findings

Record:

- dark-first compliance findings
- semantic token findings
- visual-drift checklist findings
- keyboard, focus, dialog, and status findings

## Usefulness Decision Rules

- **Useful:** overlay was inspectable, protected behavior held or was cheaply restored,
  and acceptance criteria mostly passed with limited manual correction.
- **Not useful:** blockers, scope explosions, or correction cost exceeded the value of
  the generated output.
- **Inconclusive:** evidence is incomplete.

## Trial Application

Vertical Slice 01 leaves this table blank until Phase 3 runs the Copilot trial. Phase
1 only establishes the contract and readiness to measure.

## Traceability

- `evidence-first-trial-readiness-checklist.md`
- `../copilot-handoff/overlay-safety.md`
- `trials/vertical-slice-01/acceptance-criteria.md`
- `trials/vertical-slice-01/phase-1-readiness-result.md`
