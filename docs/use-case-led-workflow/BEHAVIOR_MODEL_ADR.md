# Behavior model ownership

Status: Accepted

## Decision

The product stores behavior at three independent levels.

| Level | Owner | Canonical record | Approval authority |
|---|---|---|---|
| Application workflow | Plan | `ApplicationWorkflowDefinition` | Application approval |
| Solution allocation | Design | `WorkflowNodeAllocation` | Architecture approval |
| Module behavior | Build | `ModuleActivityDefinition` and structured state records | Module-design approval |

Verification records refer to these approved records. Diagram projections are
read-only views and are not canonical behavior.

## Ownership rules

- A use case owns the actor goal, trigger, rules, and stable step IDs.
- An application workflow owns observable control flow.
- An allocation owns the primary module and interaction boundary for one
  executable application node.
- A module activity owns internal decisions, calls, events, retry, and recovery.
- A module state record owns internal states and guarded transitions.
- A verification record owns observed results and immutable evidence hashes.

No field has two canonical owners. A module activity can refine an application
node, but it cannot redefine the application workflow.

## Trace ID conventions

- Use-case step: `<use-case-id>:step:<local-name>`
- Application workflow: `workflow:<use-case-id>`
- Application node: a stable workflow-local ID, such as `finding:assign`
- Allocation: the pair `<workflow-id>, <node-id>`
- Module activity: `activity:<module-name>:<local-name>`
- Module activity node: a stable activity-local ID, such as `mf:persist`
- Diagram element: `<projection-level>:<source-id>:<element-kind>:<element-id>`

Every projected node and edge contains its canonical `sourceRecordId` and all
available `traceIds`.

## Compatibility

- Approved records are never rewritten in place.
- A legacy use case can produce a read-only linear workflow projection.
- An ambiguous branch produces an unresolved migration item.
- Legacy step allocations can map to workflow nodes only when the step has one
  unambiguous refining node.
- A legacy module activity list can produce a reviewable linear module draft.
- Migration never derives module behavior from a use-case flow.
- Stored diagram coordinates are discarded when diagrams are regenerated.

## Consequences

Plan can define non-linear application behavior before architecture exists.
Design can expose missing allocation and cross-module boundaries. Build can
describe internal module behavior without copying the application workflow.
Verify can distinguish application scenario results from module behavior
results.
