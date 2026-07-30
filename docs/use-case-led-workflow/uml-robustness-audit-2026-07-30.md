# UML robustness audit

Date: 2026-07-30

## Outcome

The UML framework now has measurable layout acceptance criteria, a cross-product
stress suite, and regression gates for the real DO-178 workflow. The audit
covered 104 UML symbols and 118 relationships across seven product contexts.

The final layouts have:

- no node overlaps;
- no shared or merged connector runs;
- no connector-to-node clearance faults;
- no connector-label collisions;
- no label-to-label collisions;
- no port-alignment faults;
- no symbols, ports, connectors, or labels outside the canvas; and
- no ordinary ambiguous line crossings.

Two deliberately dense, non-planar examples retain one crossover each. The
canvas draws each residual crossover with an explicit jump bridge. It also
reports the crossover count in the workspace.

## Product and behavior matrix

| Context | UML view | Coverage | Baseline defects | Final result |
| --- | --- | ---: | --- | --- |
| Regional logistics | Component architecture | 13 symbols, 20 relationships | One crossing | One bridged crossover; all other checks pass |
| Aircraft telemetry | Component ports | 21 symbols, 10 relationships | One duplicate port attachment | All checks pass |
| Surgical device | Swimlane activity | 19 symbols, 17 relationships | Three crossings, four clearance faults, one label collision | All checks pass |
| Payment processing | State machine | 12 symbols, 18 relationships | Four crossings, 15 merged connector pairs, 10 clearance faults, two label-to-node collisions, one label-to-label collision | All checks pass |
| Marketplace checkout | Sequence | 9 symbols, 17 relationships | No measured defect | All checks pass, including self-message routing |
| Flight safety | Use case | 16 symbols, 20 relationships | One crossing, 11 clearance faults, three label-to-node collisions | One bridged crossover; all other checks pass |
| Rail traffic | Activity | 14 symbols, 16 relationships | Four clearance faults, three label-to-node collisions | All checks pass |

This matrix exercises dense component topologies, interface ports, nested system
boundaries, actors, include and extend relationships, swimlanes, branches,
returns, retries, state cycles, sequence returns, and self messages.

## Findings and triage

### Critical

1. Nested use-case relationships used boundary-local coordinates as canvas
   coordinates. Include and extend connectors could miss their symbols or cross
   unrelated use cases.

   Resolution: translate nested ELK edge points and labels through the shared
   parent boundary before rendering and before quality analysis.

### High

1. Parallel and returning relationships could share the same orthogonal
   segment. This made separate UML relationships look like one relationship.

   Resolution: order incoming and outgoing relationships by geometry, reserve
   independent branch channels, and spread loop attachment points.

2. Activity return paths could pass through alternate actions.

   Resolution: detect blocking symbols and route the return through a reserved
   outer rail with a clear final approach.

3. Cyclic state layouts produced merged trunks and dense crossings.

   Resolution: test deterministic ELK placement strategies and use a balanced
   state fallback when ELK cannot produce the model.

4. Labels used a fixed offset and could cover symbols, other labels, or an
   unrelated connector.

   Resolution: score horizontal and vertical label candidates on both sides of
   a connector. Reject candidates that overlap a symbol, an assigned label, or
   another connector. Reserve guarded sequence-label height before its message.

### Medium

1. Component ports could attach to arbitrary sides or share an attachment point.

   Resolution: retain each interface as a semantic port, align its endpoint with
   the parent component perimeter, and gate the result.

2. Diagram quality was invisible to the user.

   Resolution: add a `Layout verified` status. Dense layouts report the exact
   number of bridged crossovers.

3. A residual crossover looked like an accidental connection.

   Resolution: use the JointJS jump-over connector for every UML relationship
   type. A residual crossing is now visibly unconnected.

4. Dense use-case boundaries had insufficient internal spacing.

   Resolution: increase node, edge, label, and layer spacing inside compound
   graphs.

### Low

1. Backdrop and boundary shapes could cover connectors in the legacy module
   viewer.

   Resolution: draw boundaries and fragments first, connectors second, and
   ordinary symbols last.

2. Sequence self messages were not always visible in the legacy fallback.

   Resolution: render self messages as explicit loops and make interaction
   fragments span their participant lifelines.

## Automated acceptance

The quality analyzer measures:

- proper segment crossings;
- collinear or merged connector pairs;
- symbol overlaps;
- connector clearance from unrelated symbols;
- label-to-symbol and label-to-label overlap;
- unrelated connector-to-label overlap;
- port and endpoint alignment;
- canvas containment;
- bend count;
- total connector length; and
- occupied canvas area.

The stress suite lays out every fixture twice and requires an identical result.
It also verifies that no semantic symbol, port, or relationship is lost.

The real DO-178 application workflow, solution allocation, and module behavior
projections use the same gates. They allow at most one bridged crossover per
diagram, or two in a dense solution-allocation view. All other defect counts
must be zero.

## Verification

- GUI: 46 test files and 360 tests passed.
- Legacy design layout: 32 tests passed.
- GUI and core TypeScript checks passed.
- The production GUI bundle compiled.
- The packaged Electron acceptance journey passed with no renderer error.

## Packaged application evidence

- [Application activity](./screenshots/uml-robustness-2026-07-30/uml-application-activity.png)
- [Application use cases](./screenshots/uml-robustness-2026-07-30/uml-application-use-case.png)
- [Solution allocation](./screenshots/uml-robustness-2026-07-30/uml-solution-allocation.png)
- [System architecture](./screenshots/uml-robustness-2026-07-30/uml-system-canvas.png)
- [Component diagram](./screenshots/uml-robustness-2026-07-30/uml-component-fullscreen.png)
- [Activity diagram](./screenshots/uml-robustness-2026-07-30/uml-activity-fullscreen.png)
- [State machine](./screenshots/uml-robustness-2026-07-30/uml-state-machine-fullscreen.png)
- [Sequence diagram](./screenshots/uml-robustness-2026-07-30/uml-sequence-fullscreen.png)
- [Use-case diagram](./screenshots/uml-robustness-2026-07-30/uml-use-case-fullscreen.png)
- [Packaged-run manifest](./screenshots/uml-robustness-2026-07-30/uml-packaged-manifest.json)

## Residual constraints

The framework does not claim that every arbitrary UML graph is planar. Dense,
non-planar graphs can require a crossover. The framework minimizes these cases,
counts them, and draws an explicit bridge so that the semantics remain clear.

Very wide component architectures can also require a large canvas. The viewer
retains fit, zoom, pan, selection focus, and minimap controls for these layouts.
The measured logistics topology uses a 2640 by 836 canvas and remains readable
without compressing symbols or merging connector channels.
