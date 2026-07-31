# Aircraft Trade Study

Run MATLAB-backed analyses, compare options, review sensitivity, and approve study baselines.

## Product structure

- Architecture style: analysis pipeline
- Starting structure: Domain-centered
- Study canvas (experience): Owns parameter editing, result comparison, and decision views.
- Case control (domain): Owns cases, assumptions, units, and approved baselines.
- Model runner (connection): Runs the approved analysis model and captures execution data.
- Trade engine (domain): Computes comparison, sensitivity, margin, and rank.

## User tasks

- Define study case
- Run performance analysis
- Compare design options
- Review sensitivity result
- Approve study baseline

## Protected outcome

- Never use stale assumption
