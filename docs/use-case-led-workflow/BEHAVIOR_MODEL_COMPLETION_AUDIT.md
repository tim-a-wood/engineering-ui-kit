# Behavior Model Completion Audit

## Result

The three-level behavior workflow is implemented and verified with the
DO-178C Audit Hub sample.

| Definition of done | Result | Evidence |
| --- | --- | --- |
| Plan owns use cases and application activities. | Pass | `UseCasePlanView.tsx`, `ApplicationBehaviorView.tsx`, application-only projectors, and approval diagnostics |
| Design owns allocation and cross-module behavior. | Pass | `WorkflowAllocationView.tsx`, node allocations, module swimlanes, and cross-module sequences |
| Build owns internal activity and state behavior. | Pass | `BuildHandoffView.tsx`, `ModuleDiagrams.tsx`, and structured module-behavior records |
| Verify traces evidence through every approved level. | Pass | `DesignVerifyView.tsx`, `WorkflowEvidenceView.tsx`, immutable evidence hashes, and stale-result diagnostics |
| Module activity does not read a use-case main flow. | Pass | The module projector reads only `behavior.activityDefinitions`; a regression test rejects copied behavior |
| Each diagram element keeps source and trace IDs. | Pass | Renderer-neutral projections, inspect selector, source panel, and trace tests |
| Approval rejects missing allocation and refinement. | Pass | Plan, allocation, module behavior, and lifecycle gate tests |
| Approved records remain immutable. | Pass | Versioned persistence and approval collision tests |
| The DO-178C sample completes the migrated workflow. | Pass | Four use cases, 16 workflow paths, 17 modules, cross-module allocations, module behavior, and scenario evidence |
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

- [Plan — use cases](./screenshots/behavior-model-final/01-plan-use-cases.png)
- [Plan — application activity](./screenshots/behavior-model-final/02-application-activity.png)
- [Plan — application use cases](./screenshots/behavior-model-final/03-application-use-case.png)
- [Design — solution allocation](./screenshots/behavior-model-final/04-solution-allocation.png)
- [Design — cross-module sequence](./screenshots/behavior-model-final/05-cross-module-sequence.png)
- [Design — system structure](./screenshots/behavior-model-final/06-system-structure.png)
- [Build — component](./screenshots/behavior-model-final/07-module-component.png)
- [Build — module activity](./screenshots/behavior-model-final/08-module-activity.png)
- [Build — state machine](./screenshots/behavior-model-final/09-module-state-machine.png)
- [Build — internal sequence](./screenshots/behavior-model-final/10-module-sequence.png)
- [Verify — scenario testing](./screenshots/behavior-model-final/11-scenario-testing.png)
- [Evidence — immutable trace](./screenshots/behavior-model-final/12-evidence-trace.png)

The final Evidence capture contains an original PNG preview and its recorded
artifact identity. The visual harness fails if a diagram reports a layout
error or the browser reports an uncaught page error.

## Verification result

- Core: 127 files and 1,041 tests passed.
- GUI: 45 files and 352 tests passed.
- Desktop: 10 files and 104 tests passed; one optional MATLAB integration was
  skipped because the MATLAB Engine was not available.
- Core, GUI production, and desktop builds passed.
- The production visual walk captured all 12 expected views with no layout or
  browser errors.
- All design performance targets passed. The 17-module selection projection
  median was 1.23 ms.
