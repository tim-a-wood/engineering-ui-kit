# Behavior Model Completion Audit

## Result

The three-level behavior workflow is implemented and verified with the
DO-178C Audit Hub sample.

| Definition of done | Result | Evidence |
| --- | --- | --- |
| Plan owns use cases and application activities. | Pass | `ApplicationWorkflowWorkspace.tsx`; application-only projectors and approval diagnostics |
| Design owns allocation and cross-module behavior. | Pass | `WorkflowAllocationWorkspace.tsx`; node allocations, module swimlanes, and cross-module sequences |
| Build owns internal activity and state behavior. | Pass | `ModuleBehaviorEditor.tsx`; structured activity, state, interaction, operation, and event records |
| Verify traces evidence through every approved level. | Pass | Scenario trace drawer, immutable evidence hashes, and stale-result diagnostics |
| Module activity does not read a use-case main flow. | Pass | The module projector reads only `behavior.activityDefinitions`; a regression test rejects copied behavior |
| Each diagram element keeps source and trace IDs. | Pass | Renderer-neutral projections, inspect selector, source panel, and trace tests |
| Approval rejects missing allocation and refinement. | Pass | Plan, allocation, module behavior, and lifecycle gate tests |
| Approved records remain immutable. | Pass | Versioned persistence and approval collision tests |
| The DO-178C sample completes the migrated workflow. | Pass | Three workflows, six allocated modules, nine manifests, six approved module designs, and scenario evidence |
| A complex fixture passes functional, visual, accessibility, and performance checks. | Pass | Branched activities, bounded loops, fork and join, non-linear state behavior, alternate sequence fragment, semantic ports, and full test suites |

## Lifecycle gate audit

- A current approved application unlocks architecture approval.
- Complete solution allocation unlocks module design.
- Approved current module behavior unlocks implementation handoff.
- An application revision makes the architecture and module designs stale.
- An architecture revision makes earlier module designs stale.
- Scenario evidence retains the application, architecture, module-design,
  source, build, environment, and test-data revisions that produced it.

## Visual acceptance audit

- UML symbols come from one shared JointJS semantic library.
- Decisions and merges use diamonds.
- Forks and joins use bars.
- Initial and final nodes use UML activity semantics.
- Component interfaces use fixed semantic ports.
- Activity guards are attached to their own orthogonal routes.
- Loop, recovery, failure, reply, and dependency connectors have distinct
  styles.
- Swimlanes use stable ranked partitions.
- Complex state machines use a deterministic balanced lifecycle layout.
- Sequence fragments cover only their referenced message rows.
- Every node and connector remains available in the inspect selector.

## Production evidence

- [Plan — use cases](./screenshots/behavior-model-final/01-use-case.png)
- [Plan — application activity](./screenshots/behavior-model-final/02-application-activity.png)
- [Design — solution allocation](./screenshots/behavior-model-final/03-solution-allocation.png)
- [Design — cross-module sequence](./screenshots/behavior-model-final/04-cross-module-sequence.png)
- [Build — component](./screenshots/behavior-model-final/05-component.png)
- [Build — module activity](./screenshots/behavior-model-final/06-module-activity.png)
- [Build — state machine](./screenshots/behavior-model-final/07-state-machine.png)
- [Build — internal sequence](./screenshots/behavior-model-final/08-internal-sequence.png)
- [Verify — observed evidence trace](./screenshots/behavior-model-final/09-verification-trace.png)

The final Verify capture contains an original PNG preview and its recorded
artifact identity. The visual harness fails if a diagram reports a layout
error.

## Verification result

- Core: 95 files and 461 tests passed.
- GUI: 32 files and 242 tests passed.
- Desktop: 8 files and 75 tests passed; one optional MATLAB integration was
  skipped because the MATLAB Engine was not available.
- Core build, GUI typecheck, and desktop typecheck passed.
- Complex projection performance p95: 62.1 ms.
- Complex focused UML layout: 357 ms.

