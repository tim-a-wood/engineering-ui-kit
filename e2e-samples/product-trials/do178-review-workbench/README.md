# DO-178C Review Workbench

Run independent reviews of software lifecycle data and preserve review evidence.

## Product structure

- Architecture style: layered review system
- Starting structure: Experience-first
- Review control (workflow): Coordinates independent review tasks and review state.
- Evidence index (domain): Owns lifecycle data, trace links, revisions, and objective coverage.
- Finding control (domain): Owns findings, ownership, closure evidence, and review rules.
- Review records (platform): Preserves approved review records and immutable evidence.

## User tasks

- Review requirement set
- Record review finding
- Assign finding owner
- Verify finding closure
- Check objective coverage
- Approve review record
- Export review evidence

## Protected outcome

- Never use author approval
