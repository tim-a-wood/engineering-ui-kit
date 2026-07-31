# Flight Test Telemetry

Triage recorded telemetry, exceedances, analysis intervals, and investigation evidence.

## Product structure

- Architecture style: stream-processing investigation system
- Starting structure: Focused core
- Telemetry console (experience): Synchronizes plots, events, intervals, and investigation controls.
- Run ingest (connection): Reads recorded channels and validates time and source identity.
- Signal analysis (domain): Computes thresholds, dropouts, and correlated events.
- Investigation (workflow): Owns intervals, engineering notes, review, and export.
- Flight archive (platform): Preserves source samples and investigation packages.

## User tasks

- Load telemetry run
- Review exceedance event
- Mark analysis interval
- Compare sensor source
- Annotate data dropout
- Record engineering note
- Export investigation package

## Protected outcome

- Never show unverified exceedance
