# DockPlan Lab — Motion Planning Workbench

[Open the public interactive mockup](https://tim-a-wood.github.io/engineering-ui-kit/mockups/dockplan-lab/) · [Read the PRD](./product/PRD.md)

A desktop engineering workbench for authoring, refining, replaying and validating low-speed articulated yard-truck reverse-docking trajectories. The interface is grounded in a concrete warehouse dock scenario and exposes the quantities an engineer needs to inspect: vehicle articulation, collision clearance, steering and steering-rate limits, speed profile, terminal pose and feasibility checks.

## Run locally

```bash
npm install
npm run dev
```

The prototype includes scenario authoring, planner diagnostics, constraint plots, replay and validation review views. Its calculations and traces are representative prototype data, clearly separated from production solver claims.

## Reference material

- [Product requirements](./product/PRD.md)
- [Scenario authoring benchmark](./product/scenario-authoring.png)
- [Planner diagnostics benchmark](./product/planner-diagnostics.png)
- [Validation review benchmark](./product/validation-review.png)
