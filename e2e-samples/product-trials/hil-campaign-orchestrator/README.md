# HIL Test Campaign Orchestrator

Reserve benches, load configurations, execute procedures, manage failures, and preserve campaign evidence.

## Product structure

- Architecture style: distributed execution control
- Starting structure: Focused core
- Campaign console (experience): Shows reservations, execution state, failures, and evidence.
- Bench scheduler (domain): Owns reservations, conflicts, assets, and campaign windows.
- Test executor (workflow): Loads configurations and controls procedure execution.
- Rig adapter (connection): Isolates real-time bench commands and observations.
- Campaign evidence (platform): Stores results, logs, configurations, and approvals.

## User tasks

- Reserve test bench
- Load test configuration
- Start test campaign
- Pause test campaign
- Review failed procedure
- Retry failed procedure
- Approve campaign evidence
- Release test bench

## Protected outcome

- Never use unreserved bench
