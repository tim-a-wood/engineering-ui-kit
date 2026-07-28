# Behavior Model Implementation Plan

## Decision

Engineering UI Kit will model behavior at three separate levels:

1. **Application workflow** describes what the application must do.
2. **Solution allocation** shows which modules perform each workflow action.
3. **Module behavior** describes how one module performs its allocated work.

Verification will trace observed evidence through all three levels.

The product will not use the term `system behavior` by default. In a regulated
system context, that term can imply authority outside the software application.
The UI will use `Application workflow`, `Solution allocation`, and
`Module behavior`.

## Current problem

The current module activity diagram does not describe module behavior. It
selects the first use case traced to a module and renders the use-case main
flow as a linear activity diagram.

The current model already has useful trace anchors:

- use cases have stable step IDs;
- architecture workflow traces allocate steps to modules;
- module designs reference use cases and scenario steps;
- verification records results against scenario steps.

The module behavior record also declares `activities` and `interactions`, but
these fields are unstructured lists. The module editor does not expose them,
and the UML projector does not use them.

## Target information architecture

| Stage | Workspace | Primary question | Canonical source | Main diagrams |
|---|---|---|---|---|
| Plan | Application workflows | What must the application do? | Approved application and use cases | Use case, application activity |
| Design | Solution allocation | Which application parts perform the work? | Approved architecture and allocations | Swimlane activity, cross-module sequence |
| Build | Module behavior | How does this module perform its work? | Approved module design | Module activity, state machine, internal sequence, component |
| Verify | Behavior evidence | Did the implementation perform the approved behavior? | Scenario and module verification records | Trace overlay and result views |

### Plan

Plan will contain two related areas:

- **Use cases** captures actors, goals, triggers, rules, and acceptance cases.
- **Application workflows** captures main, alternate, failure, recovery, and
  parallel behavior before module design starts.

The application workflow must not contain module names, source paths, or
implementation operations. It describes observable application behavior.

### Design

Design will contain a dedicated **Solution allocation** area after architecture
selection. It will show the approved application workflow in module swimlanes.

Users will assign each executable workflow action to:

- one primary module;
- zero or more participating modules;
- an entry point when applicable;
- an output or event when applicable;
- an operation contract when the architecture already defines one.

Design will not define internal module decisions or algorithms.

### Build

Each module workspace will contain a **Behavior** area. It will describe only
the selected module.

The module activity model will support:

- initial and final nodes;
- actions;
- operation calls;
- decisions and merges;
- forks and joins;
- loops with explicit exit conditions;
- sent and received events;
- domain rejections;
- technical failures;
- retry and recovery paths.

The module workspace will show the application workflow actions that the
architecture allocated to the module. Each module activity must refine one or
more of those actions.

### Verify

Verify will retain end-to-end application scenarios. It will add module-level
behavior evidence where a module design requires it.

The trace view will support this chain:

```text
Use case
  -> Application workflow node
  -> Architecture allocation
  -> Module activity node
  -> Operation or event
  -> Test or observed evidence
```

## Canonical contracts

### Shared activity graph

Add a renderer-neutral graph contract in
`packages/core/src/capabilities/types.ts`.

```ts
type ActivityNodeKind =
  | 'initial'
  | 'action'
  | 'call-operation'
  | 'decision'
  | 'merge'
  | 'fork'
  | 'join'
  | 'send-event'
  | 'receive-event'
  | 'final'

type ActivityNode = {
  id: string
  kind: ActivityNodeKind
  label: string
  description: string
  refinesIds: string[]
  actorId?: string
  operationId?: string
  eventId?: string
}

type ActivityEdge = {
  id: string
  fromNodeId: string
  toNodeId: string
  guard?: string
  outcome?: 'success' | 'alternate' | 'failure' | 'recovery'
  loop?: { exitCondition: string; maximumIterations?: number }
  traceIds: string[]
}

type ActivityGraph = {
  id: string
  name: string
  nodes: ActivityNode[]
  edges: ActivityEdge[]
}
```

The shared shape will not collapse the abstraction levels. Application and
module records will wrap the graph in separate contracts with separate gates.

### Application workflow

Add `ApplicationWorkflowDefinition` to `ApplicationSpecification`.

```ts
type ApplicationWorkflowDefinition = {
  id: string
  useCaseId: string
  name: string
  graph: ActivityGraph
  pathIds: string[]
  acceptanceCaseIds: string[]
  sourceRefs: string[]
}
```

Application action nodes will reference the current stable
`UseCaseStepDefinition.id` in `refinesIds`. During transition, the existing
main, alternate, failure, and recovery path fields remain readable.

The application workflow becomes authoritative for activity structure after
migration. The compact use-case step lists remain compatibility projections.

### Solution allocation

Replace the narrow `stepAllocations` shape with a versioned allocation record.

```ts
type WorkflowNodeAllocation = {
  workflowId: string
  nodeId: string
  primaryModuleId: string
  participatingModuleIds: string[]
  entryPointId?: string
  operationId?: string
  outputId?: string
  eventId?: string
}
```

`ArchitectureSpecification.workflowTraces` will retain its current use-case and
module coverage fields. It will add `nodeAllocations`.

The legacy `stepAllocations` field remains readable during migration.

### Module activity

Replace the unstructured `behavior.activities: NamedText[]` field with:

```ts
type ModuleActivityDefinition = {
  id: string
  name: string
  entryOperationId?: string
  refinesWorkflowNodeIds: string[]
  graph: ActivityGraph
}
```

Add `behavior.activityDefinitions: ModuleActivityDefinition[]`.

Keep `behavior.activities` as a deprecated read-only compatibility field for
one workspace version. New approvals must use `activityDefinitions`.

### State behavior

The current state model stores names only and generates one fixed linear chain.
Add structured transitions:

```ts
type ModuleStateDefinition = {
  id: string
  name: string
  parentStateId?: string
  entryActionIds: string[]
  exitActionIds: string[]
}

type ModuleStateTransition = {
  id: string
  fromStateId: string
  toStateId: string
  trigger: string
  guard?: string
  effectActivityNodeIds: string[]
}
```

State-machine work is part of the same behavior-contract migration because
activity actions and state transitions must remain consistent.

### Diagram projection metadata

Extend `DiagramProjection` with:

```ts
level: 'application' | 'allocation' | 'module'
sourceRecordIds: string[]
```

Every projected node and edge must retain stable source and trace IDs. The
renderer cannot invent behavior, labels, conditions, participants, or links.

## Projection rules

Split `projectModuleDiagrams` into explicit projectors:

- `projectApplicationBehaviorDiagrams(application)`
- `projectSolutionAllocationDiagrams(application, architecture)`
- `projectModuleBehaviorDiagrams(application, architecture, moduleDesign)`

### Application activity projection

- Render one selected application workflow.
- Show actors as optional partitions, not modules.
- Show main, alternate, failure, recovery, and parallel paths.
- Put conditions on outgoing decision edges.
- Keep action labels concise.
- Put results and rationale in the inspector.

### Solution allocation projection

- Use one swimlane for each participating module.
- Place each application action in its primary module lane.
- Show cross-lane control flow.
- Show operation or event labels only when the architecture records them.
- Highlight missing allocations without inventing defaults.

### Module activity projection

- Use only `ModuleActivityDefinition.graph`.
- Show allocated application nodes as trace badges or inspector references.
- Show operation calls, events, failures, retry paths, and recovery paths.
- Do not copy the full application workflow into a module diagram.

### Sequence projection

Generate two sequence levels:

- Design generates a cross-module sequence from solution allocations.
- Build generates an internal module sequence from structured interactions and
  operation calls.

### Use-case projection

Move the use-case diagram out of module diagrams. It belongs in Plan.
Module workspaces will show use-case coverage in the trace inspector.

## Validation gates

### Plan gate

Add application-workflow diagnostics:

- each workflow references one approved use case;
- the graph has one initial node and at least one final node;
- every node is reachable from the initial node;
- every non-final node has an outgoing edge;
- each decision has at least two guarded outgoing edges;
- each merge has at least two incoming edges;
- each fork has at least two outgoing edges;
- each join has at least two incoming edges;
- each loop has an exit condition;
- every action traces to a stable use-case step;
- every acceptance case traces to at least one workflow path;
- all visible text passes the product writing profile.

### Design gate

Add allocation diagnostics:

- each executable application node has one primary module;
- all allocated modules exist in the approved architecture;
- each participating module is in the workflow trace;
- each cross-module transition has a defined interaction boundary;
- referenced operations, entry points, outputs, and events exist;
- no module is orphaned from all application workflows.

### Module-design gate

Add module-behavior diagnostics:

- each activity graph is structurally valid;
- each graph refines at least one node allocated to the module;
- every allocated node has at least one refining module activity;
- refinement IDs cannot target nodes allocated to another primary module;
- operation-call nodes reference approved provided or required operations;
- sent and received events reference approved events;
- failure and recovery behavior covers declared module failures when material;
- state transition effects reference valid activity nodes;
- no material unresolved behavior item remains;
- all visible text passes the product writing profile.

### Verification gate

- end-to-end scenarios trace to application workflow paths;
- module tests trace to module activity nodes or operations;
- evidence identifies build, source revision, environment, and test data;
- failures remain visible and cannot be replaced by a later partial run;
- a passing application scenario does not imply that every module behavior
  check passed.

## User experience

### Plan: Application workflows

Add `ApplicationWorkflowWorkspace.tsx`.

Layout:

- left: use-case and workflow selector;
- center: live application activity diagram;
- right: selected node or edge inspector;
- lower panel: path, rule, acceptance, and source trace.

Editing uses structured commands:

- Add action
- Add decision
- Add alternate path
- Add failure path
- Add recovery path
- Add parallel branch
- Set guard
- Set rejoin

The canvas is not a freehand source of truth. Canvas selection opens the
structured editor for the canonical record.

### Design: Solution allocation

Add `WorkflowAllocationWorkspace.tsx`.

Layout:

- top: application workflow selector and allocation status;
- center: module swimlane activity diagram;
- right: allocation inspector;
- lower panel: missing allocations and boundary diagnostics.

Primary actions:

- Assign module
- Add participant
- Bind operation
- Bind event
- Open module

### Build: Module behavior

Add `ModuleBehaviorEditor.tsx` inside the existing module-design Behavior step.

Layout:

- left: activity and state model outline;
- center: selected module diagram;
- right: node, edge, guard, operation, event, and refinement inspector;
- lower panel: allocated application actions and coverage.

The current text fields for preconditions, postconditions, failures,
idempotency, retry, and recovery remain. The new activity and state editors
connect those declarations to executable behavior.

### Verify: Trace evidence

Extend `ScenarioVerificationPanel.tsx` with a trace drawer.

For each observed application step, show:

- application workflow node;
- assigned module;
- refining module activity nodes;
- related operations and events;
- recorded evidence;
- current result.

Add a module-behavior verification filter. Do not merge module checks into
application scenario status.

## AI handoff changes

Update each prompt boundary with a clear abstraction limit.

### Product interview

Require:

- use cases and application workflows;
- observable actions and results;
- alternate, failure, recovery, and parallel behavior;
- no module allocation or internal software design.

### Architecture interview

Require:

- module allocation for every application workflow action;
- operation and event boundaries for cross-module flow;
- no internal algorithms or module-only decisions.

### Module-design interview

Require:

- structured module activities and state transitions;
- refinement links to allocated application workflow nodes;
- operation, event, failure, retry, and recovery behavior;
- no new application scope.

### Implementation handoff

Include:

- the approved module activity and state models;
- allocated application workflow references;
- approved operation and event contracts;
- required verification mappings.

All generated labels and human-facing descriptions must use the Engineering UI
Kit writing profile based on ASD-STE100.

## Persistence and migration

### Schema work

Add:

- `application-workflow.schema.json`
- `activity-graph.schema.json`
- `module-design-specification.schema.json`

Update:

- `application-specification.schema.json`
- `architecture-specification.schema.json`
- capability workspace index schema and migration version.

### Compatibility policy

- Never rewrite an approved record in place.
- Load legacy records through a compatibility adapter.
- Create a new draft revision when a user adopts the structured behavior model.
- Regenerate all diagrams from canonical records.
- Never migrate stored diagram coordinates as behavior semantics.

### Legacy application migration

For each existing use case:

1. Create an initial node.
2. Convert ordered main-flow steps to action nodes.
3. Create a final node.
4. Convert alternate, failure, and recovery paths when branch and rejoin anchors
   are unambiguous.
5. Create a material unresolved item when an anchor is unknown.
6. Preserve existing step IDs as refinement IDs.

### Legacy architecture migration

- Convert `stepAllocations` to `nodeAllocations`.
- Preserve module IDs and workflow ordering.
- Leave operation and event bindings empty when no evidence exists.
- Add review diagnostics instead of inventing bindings.

### Legacy module migration

- Convert nonempty `behavior.activities` lists to one linear draft activity.
- Do not generate a module activity from application use-case steps.
- Leave the module activity absent when the legacy list is empty.
- Require review before the migrated draft can be approved.

## Implementation phases

### Phase 0: Contract decision

Deliver:

- architecture decision record;
- terminology and ownership rules;
- JSON schema drafts;
- migration fixtures;
- trace-ID conventions.

Exit criteria:

- no field has two canonical owners;
- application and module behavior have separate approval authorities;
- legacy records have a documented read path.

### Phase 1: Core graph and migration

Primary files:

- `packages/core/src/capabilities/types.ts`
- new `applicationWorkflow.ts`
- new `moduleBehavior.ts`
- `migration.ts`
- capability schemas.

Deliver:

- graph types and validators;
- deterministic hashing and ordering;
- legacy converters;
- application scenario compilation from structured workflows;
- unit tests.

Exit criteria:

- main, alternate, failure, recovery, fork, join, and loop fixtures validate;
- invalid graphs return stable field paths;
- legacy DO-178C records migrate without data loss or invented behavior.

### Phase 2: Plan workflows

Primary files:

- `ApplicationDefinition.tsx`
- `UseCaseAnalysisPanel.tsx`
- new `ApplicationWorkflowWorkspace.tsx`
- application workflow prompt and import code.

Deliver:

- application workflow editor;
- application activity and use-case projections;
- path and acceptance trace;
- Plan approval gate updates.

Exit criteria:

- users can define a branched workflow before architecture exists;
- the diagram contains no module or operation semantics;
- all workflow labels pass writing checks.

### Phase 3: Design allocations

Primary files:

- `ArchitectureInterview.tsx`
- `ArchitectureView.tsx`
- new `WorkflowAllocationWorkspace.tsx`
- `architectureInterview.ts`
- architecture prompt and import code.

Deliver:

- node allocation editor;
- module swimlane activity projection;
- cross-module sequence projection;
- allocation coverage gate.

Exit criteria:

- every executable application action has one visible primary module;
- cross-module boundaries are traceable;
- missing allocations remain explicit.

### Phase 4: Module behavior

Primary files:

- `ModuleDesignWorkspace.tsx`
- new `ModuleBehaviorEditor.tsx`
- `designWorkflow.ts`
- module-design IPC and persistence.

Deliver:

- structured activity and state editors;
- module activity, state, sequence, and component projections;
- refinement coverage;
- module-design prompt and import updates.

Exit criteria:

- a module diagram contains only internal module behavior;
- every diagram element resolves to a canonical module-design field;
- application workflow steps never appear as copied module actions unless the
  module design explicitly refines them.

### Phase 5: Renderer semantics

Primary files:

- `JointUmlCanvas.tsx`
- `umlDiagramLayout.ts`
- `UmlDiagramWorkspace.tsx`
- styles and accessibility tests.

Deliver:

- fork and join bars;
- swimlane containers;
- loop and failure edge styles;
- decision guard placement;
- level labels and trace inspector;
- dense-layout refinements.

Exit criteria:

- ports and connectors align at all supported zoom levels;
- labels do not overlap nodes or unrelated connectors;
- branches use canvas space efficiently;
- keyboard users can inspect every symbol and connector.

### Phase 6: Verification trace

Primary files:

- `ScenarioVerificationPanel.tsx`
- `scenarioVerification.ts`
- implementation packet builders;
- verification persistence.

Deliver:

- application-to-module trace drawer;
- module behavior evidence links;
- separate application and module result summaries;
- stale-design detection.

Exit criteria:

- users can navigate from a failed observed step to its allocated and refining
  behavior;
- evidence remains immutable and hash-addressed;
- stale module behavior blocks current verification claims.

### Phase 7: Real samples and hardening

Deliver:

- migrated DO-178C Audit Hub workflow;
- a deliberately complex reference project;
- production screenshots;
- performance and accessibility evidence;
- updated documentation and guides.

The complex fixture must include at least:

- 3 use cases;
- 4 actors;
- 20 application workflow nodes;
- 3 decisions and merges;
- 1 fork and join;
- 1 bounded loop;
- 6 modules across swimlanes;
- 2 domain rejection paths;
- 1 technical failure and recovery path;
- 2 module activity graphs with at least 12 nodes each;
- 1 state machine with guarded non-linear transitions;
- 1 sequence with synchronous calls, replies, and an alternate fragment.

## Test strategy

### Core tests

- graph shape and reachability;
- decision, merge, fork, and join cardinality;
- loop exit requirements;
- stable ordering and hashes;
- scenario path compilation;
- allocation coverage;
- refinement coverage;
- operation and event references;
- migration idempotence;
- stale architecture and module design detection;
- writing-policy checks.

### UI tests

- create and edit each activity node type;
- select a diagram element and edit its canonical record;
- keyboard navigation and focus return;
- inspector source and trace IDs;
- allocation status and missing-allocation states;
- module refinement coverage;
- immutable approved revision behavior;
- narrow and wide viewport behavior.

### Integration tests

- Plan workflow approval unlocks Design.
- Design allocation approval unlocks module behavior.
- Module behavior approval unlocks implementation handoff.
- Architecture revision marks affected module behavior stale.
- Application workflow revision marks allocations and downstream module behavior
  stale.
- Scenario evidence retains its original source revision.

### Visual tests

Capture every level:

- application activity;
- solution swimlane activity;
- module activity;
- module state machine;
- cross-module sequence;
- internal module sequence;
- component diagram;
- use-case diagram.

Test simple, medium, and complex graphs. Do not approve the feature using only
linear examples.

## Visual acceptance criteria

- UML symbols follow one shared semantic library.
- Decision and merge nodes use diamonds.
- Fork and join nodes use bars.
- Initial and final nodes use correct activity semantics.
- Guards sit beside their own edge.
- Flow direction is consistent within a diagram.
- Connectors use semantic ports and do not stop beside a node.
- Unrelated connectors do not share a segment when that implies a junction.
- Labels do not cover connectors.
- Fit-to-view leaves useful margins without shrinking labels below readable
  size.
- Swimlanes remain visually distinct at fitted zoom.
- The inspector shows details that do not belong in concise labels.
- Empty and not-applicable diagrams explain the missing canonical data.

## Performance and accessibility

Targets for the complex fixture on supported desktop hardware:

- initial projection under 100 ms;
- layout worker response under 500 ms;
- interactive selection response under 100 ms;
- no main-thread block longer than 100 ms during diagram switching.

Accessibility requirements:

- every diagram has a text alternative;
- every node and edge appears in the inspect selector;
- keyboard navigation follows deterministic graph order;
- focus remains visible;
- status and trace state do not rely on color;
- zoom is not required to access semantic details.

## Risks and controls

### Duplicate truth

Risk: use-case steps and activity nodes describe the same behavior differently.

Control: the structured application workflow becomes authoritative. Legacy step
lists become compatibility projections after migration.

### Diagram editor complexity

Risk: a freeform canvas becomes difficult to validate and maintain.

Control: edit canonical forms and inspectors. Treat the canvas as a live
projection with selection support.

### False precision

Risk: generated module behavior appears authoritative without enough input.

Control: AI output remains a draft. Material assumptions and missing refinement
links block approval.

### Migration invention

Risk: the migration guesses branch anchors or module operations.

Control: migrate only evidenced relationships. Create unresolved items for
ambiguous semantics.

### Large graph readability

Risk: fit-to-view makes a complex graph technically complete but unusable.

Control: support focus mode, path highlighting, level filters, stable
swimlanes, and inspector-driven detail.

## Definition of done

The work is complete when:

1. Plan owns application use cases and application activity diagrams.
2. Design owns module allocation and cross-module behavior.
3. Build owns internal module activity and state behavior.
4. Verify traces evidence through all approved levels.
5. The module activity projector never reads a use-case main flow directly.
6. Every diagram element maps to canonical source and trace IDs.
7. Approval gates reject missing allocation and missing refinement.
8. Existing approved records remain immutable.
9. The DO-178C sample completes the full migrated workflow.
10. A complex non-linear fixture passes functional, visual, accessibility, and
    performance tests.
