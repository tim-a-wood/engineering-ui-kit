# Implementation Readiness Checklist

## Purpose

This checklist determines whether the standards package is ready to support one
evidence-first vertical-slice trial and, after that trial, broader implementation.

## Scope

It reviews standards readiness, minimum trial contracts, safety, validation,
evidence capture, and the later automation gate.

## Standards Readiness

- Foundation principles authored.
- Visual language authored.
- Component standards authored.
- Layout recipes authored.
- Examples authored.

## Contract Readiness

- `tokens.json` parses.
- `component-manifest.json` parses.
- Schemas parse.
- Package metadata reflects Phase 3.
- Token and component IDs remain stable.

## Minimum Trial Contract

- Practical frontend and local-backend architecture is authored.
- Repo-flatfile, task-packet, standards-pack, visual-pack, and zip-overlay contracts
  are complete for the selected trial.
- Deterministic context exclusions and overlay hard blockers are documented.
- One implementation prompt and one review prompt contain no open placeholders.
- Standards are excerptable within the three-file handoff constraint.
- The disposable repo, representative screen, and acceptance criteria are selected.

Evidence:

- `standards/reference-architecture/`
- `standards/copilot-handoff/`
- `standards/prompts/implementation-prompt.md`
- `standards/prompts/review-prompt.md`
- `trials/vertical-slice-01/`

## Validation Readiness

- UI compliance rubric authored.
- Accessibility checklist authored.
- Visual drift checklist authored.
- Component completeness checklist authored.
- Phase 3 checklist and result template present.
- Baseline screenshots and current behavior are recorded.
- Trial measurements include build success, scope adherence, visual findings, manual
  corrections, safety results, and elapsed time.
- Rollback or disposable-repo recovery is defined before overlay application.

Evidence:

- `trials/vertical-slice-01/baseline.md`
- `trials/vertical-slice-01/baseline/`
- `standards/validation/evidence-first-trial-measurement.md`
- `standards/validation/evidence-first-trial-readiness-checklist.md`

## Known Deferrals Before the Trial

- General handoff package generation.
- Reusable core-library automation.
- Full implementation primitive/library selection.
- Electron shell and complete workflow GUI.
- Storybook/documentation site not in scope.
- Light-mode standard not authored.
- Reserved components require later validation.
- Running the Copilot trial itself.

## Readiness Decision

The mechanical Phase 3 pass is necessary but insufficient.

Ready for the evidence-first trial packet handcrafting when the minimum trial
contract and safety items above are complete.

Ready for core-library and Electron implementation only when the trial report shows
that the workflow produces useful, safely scoped output and every material failure
has a corrective action.

Current decision: minimum trial contract is complete for Vertical Slice 01. Proceed
to handcraft the Phase 2 three-file packet. Do not begin core-library or Electron
work until the Copilot trial evidence is recorded.
