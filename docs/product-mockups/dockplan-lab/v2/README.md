# DockPlan Workbench v2 interactive mockup

This folder contains the v2 interactive mockup of DockPlan Workbench. The
mockup shows the intended desktop product for the Dock D-17 reverse-approach
scenario from the PRD. It is a visual representation of the final product.
It does not implement the full product.

## Open the mockup

Open `index.html` in a desktop browser. No build step and no dependencies
are necessary. You can also start a local server:

```bash
python3 -m http.server 8000
```

Then open `http://127.0.0.1:8000/`.

## What the mockup contains

- Three workspaces: Scenario, Planner, and Validation.
- A dimensioned yard plan with dock bays D-14 to D-18, a pallet stack, a
  parked trailer, and a kerb.
- The refined run and the rejected baseline run, with station playback.
- Synchronized plots, a validation matrix, run comparison, and artifacts.
- A planner replay with a search cloud, convergence plots, objective terms,
  active constraints, and an event log.

## What is computed and what is authored

The model in `model.js` computes the data set that the interface shows:

- The trailer axle path comes from a curvature profile with smooth blends.
- The tractor pose, articulation angle, and steering angle come from the
  articulated kinematic reconstruction of that path.
- The swept bodies, the clearance trace, the witness line, and the minimum
  clearance come from polygon distance checks against the obstacles.
- The speed, acceleration, and steering-rate traces come from the time
  parameterization.
- The validation matrix, the margins, the cost table, and the comparison
  table come from these computed values.

The Hybrid A* search cloud, the SQP iteration history, and the event log are
authored replays. Their numbers are consistent with the computed result, but
no live solver runs in the mockup.

## Limits

- The toolbar controls marked with a tooltip are not functional.
- The mockup does not import files, export bundles, or edit geometry.
- The planner replay always converges to the same stored result.
- Text follows the ASD-STE100 Issue 9 writing profile of this repository.
