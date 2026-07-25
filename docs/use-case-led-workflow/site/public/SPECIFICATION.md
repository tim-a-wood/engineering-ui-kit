# Use-case-led Capabilities workflow

## Product and implementation specification

| Field | Value |
| --- | --- |
| Status | Proposed implementation baseline |
| Product | Engineering UI Kit — Capabilities |
| Scope | Plan, Design, Build, Connect, Verify |
| Primary sample | DO-178C Audit Hub |
| Language | ASD-STE100 Simplified Technical English, Issue 9 |
| UML subset | UML 2.5.1 component, activity, state machine, sequence, and use-case diagrams |

This document specifies the required behavior of the use-case-led Capabilities
workflow. It is normative for the proposed feature. The proposal explains the
reasons for the feature. The interactive mockup shows the intended interaction
style.

The specification adds one important control:

> The tool can draft the complete system structure, but the user can define,
> review, approve, hand off, build, and verify one module at a time.

This control is required for human review. It is also required for external
agents such as Copilot that cannot safely design or implement a medium
application in one pass.

---

## 1. Requirement language

The words **must**, **must not**, **required**, **shall**, and **shall not**
identify requirements.

The words **can** and **may** identify permitted behavior.

The word **should** identifies recommended behavior. A product decision can
override a recommendation, but the decision must state the reason.

Each explicit requirement has a stable ID. A requirement list under a numbered
heading is one controlled requirement group. Tests, issues, design decisions,
and release evidence can refer to the explicit ID or to the numbered heading.
The implementation baseline shall assign a clause suffix when separate clauses
in one group need separate trace links.

---

## 2. Scope

### 2.1 In scope

The product shall:

- create and approve a use-case analysis;
- compile the approved analysis to the current application specification;
- create a system-level architecture;
- let the user inspect the complete architecture on one canvas;
- let the user design each module separately;
- let the user approve module designs separately;
- create stable contracts between modules;
- create one implementation handoff for one module by default;
- inspect and apply returned implementation overlays;
- connect application entry points and outbound adapters;
- create automated end-to-end tests from approved scenarios;
- keep screenshot or structured evidence for each applicable test step;
- show UML detail in Design;
- analyze the effect of each proposed design change;
- support the same operations through the human interface and machine API;
- preserve approved records, revisions, hashes, sources, and audit events.

### 2.2 Out of scope

The first release shall not:

- let an agent approve a use-case, system design, module design, or baseline;
- edit a diagram without changing its source record;
- infer completion from generated text alone;
- require one agent to process the full application in one context window;
- implement a general UML authoring tool;
- replace source engineering tools;
- write to selected engineering source files during analysis;
- make every module a network service;
- use code coverage as proof of use-case scenario coverage;
- overwrite an earlier approval or verification result.

---

## 3. Product decisions

### 3.1 Two levels of Design

Design shall contain two related levels:

1. **System design** defines the system boundary, modules, deployable units,
   dependencies, ports, adapters, and use-case paths.
2. **Module design** defines the behavior and implementation boundary of one
   module.

The system design shall be useful before every module is complete. It shall
show which module designs are not started, in progress, ready for review,
approved, blocked, or old.

### 3.2 Separate approvals

The product shall keep these approvals separate:

- use-case analysis approval;
- system-structure approval;
- module-design approval for each module;
- complete Design baseline approval;
- implementation-overlay approval for each module;
- Connect approval;
- Verify approval.

An approval shall identify the exact record revision and content hash.

### 3.3 One module per external handoff

The default Copilot or external-agent handoff shall contain one module.

The handoff shall contain the approved contracts and the minimum required
context. It shall not require the agent to infer the rest of the application.

The user can create a multi-module wave handoff only when:

- each selected module design is approved;
- the modules do not write to the same owned path;
- the dependency plan marks them as independent;
- their fixtures and external resources are isolated;
- the user explicitly selects the modules;
- the receiving agent supports the combined task.

### 3.4 Canonical records

Generated text, diagrams, prompts, and handoff files are projections. They are
not canonical records.

The precedence order shall be:

1. approved user decisions;
2. approved use-case analysis;
3. approved application specification;
4. approved system structure;
5. approved module designs and operation contracts;
6. approved implementation overlays;
7. generated diagrams, briefs, prompts, and summaries.

When two approved records conflict, the product shall block the affected next
action and request a new decision.

### 3.5 Build gate mode

Each project shall use one explicit Design-to-Build gate mode:

| Mode | Rule |
| --- | --- |
| `completeBaseline` | Build starts after the complete Design baseline is approved |
| `incrementalModules` | An approved, dependency-closed module can enter Build before unrelated module designs are complete |

`completeBaseline` shall be the default.

A change to the mode shall be an approved project decision. The product shall
show the current mode beside each module handoff action.

---

## 4. Users and authority

| Role | Main work | Approval authority |
| --- | --- | --- |
| Product or domain lead | Defines user work, rules, outcomes, and scope | Use-case analysis |
| Software architect | Reviews system boundaries and module allocation | System structure and complete Design baseline |
| Module owner | Defines one module and reviews its implementation | Module design and module overlay |
| Interface engineer | Defines user-interface states and interactions | Interface-module design |
| Integration engineer | Defines entry points, adapters, and composition | Connect records |
| Verification lead | Reviews scenario automation and evidence | Verify baseline |
| Independent reviewer | Reviews findings or controlled evidence | As defined by project policy |
| Agent or Copilot | Creates drafts and implementation changes | None |
| Project administrator | Configures repositories, providers, and access | Configuration only |

The product shall enforce project policy when one person has more than one
role.

The product shall not treat the person who imported an agent response as the
author of that response. The audit event shall identify both the agent source
and the user who imported or applied the result.

---

## 5. Records and lifecycle

### 5.1 Canonical record set

The workflow shall use these canonical records:

| Record | Purpose |
| --- | --- |
| `UseCaseAnalysis` | Users, tasks, paths, rules, quality needs, and acceptance |
| `ApplicationSpecification` | Current application-level contract |
| `ArchitectureSpecification` | System structure and allocations |
| `ModuleDesignSpecification` | Complete design for one module |
| `DesignBaseline` | Approved set of one system structure and required module-design revisions |
| `ModuleManifest` | Runtime-facing module identity and boundaries |
| `OperationContract` | Versioned behavior at a module boundary |
| `ModuleImplementationSpecification` | Implementation-ready module instructions |
| `DesignDecision` | Approved change and its reason |
| `DiagramProjection` | Generated UML view of approved or draft records |
| `ImplementationPacket` | Immutable external-agent handoff |
| `DeltaPacket` | Returned file and record changes |
| `ImpactRecord` | Effect of a proposed or returned change |
| `VerificationRecord` | Module, connection, or scenario result |
| `ScenarioRun` | One immutable end-to-end scenario execution |
| `Approval` | User, time, revision, hash, and authority |
| `AuditEvent` | Immutable record of an operation and result |

### 5.2 Common state model

Draftable records shall use these states:

| State | Meaning |
| --- | --- |
| `notStarted` | No draft exists |
| `draft` | The tool or user has started a draft |
| `needsInput` | A material question blocks completion |
| `readyForReview` | Required fields and checks are complete |
| `approved` | An authorized user approved this revision and hash |
| `stale` | An approved upstream record changed |
| `conflict` | Two requirements or decisions cannot both apply |
| `superseded` | A later approved revision replaced this revision |
| `withdrawn` | An authorized user stopped work on this draft |

Implementation work shall use these additional states:

| State | Meaning |
| --- | --- |
| `handoffCreated` | The product created an immutable implementation packet |
| `responseReturned` | An agent response or delta packet is available |
| `inspected` | The product checked the returned scope and impact |
| `approvedToApply` | The user accepted the inspected change |
| `applied` | The product applied the exact approved delta |
| `verified` | Current module checks passed against the applied revision |

### 5.3 State rules

- A record shall move to `approved` only through an explicit approval
  operation.
- A new revision shall not change the content of an approved revision.
- A stale record shall keep its approval history.
- A stale record shall not be used for a new handoff.
- The product shall show the upstream change that made a record stale.
- The product shall calculate valid next actions from current state.
- The interface shall not show an enabled action that the application service
  will reject.
- A retry with the same idempotency key shall return the first committed
  result.

---

## 6. End-to-end workflow

### 6.1 Main flow

1. The user describes the work.
2. The tool creates a use-case draft.
3. The user resolves material questions.
4. The user approves the use-case analysis.
5. The tool compiles the application specification.
6. The tool proposes the simplest system structure.
7. The user reviews use-case paths and system boundaries.
8. The user approves the system structure.
9. The tool creates a module-design queue.
10. The user designs modules one at a time.
11. The user approves each module design.
12. The tool checks cross-module contracts after each approval.
13. The product applies the project Design-to-Build gate. In
    `completeBaseline` mode, the user completes all required module designs and
    approves the Design baseline. In `incrementalModules` mode, the user can
    select one approved, dependency-closed module.
14. The tool creates a module-scoped handoff.
15. Copilot or another agent returns a delta.
16. The tool inspects the delta and shows its impact.
17. The user approves and applies the delta.
18. The tool verifies the module.
19. The user repeats steps 10 through 18 for other modules.
20. The user approves the complete Design baseline when all required module
    designs are approved, if that approval did not occur at step 13.
21. The user connects entry points and adapters.
22. The tool runs every approved scenario.
23. The user reviews the evidence and approves Verify.

### 6.2 Controlled incremental build

The project can enter Build before every module design is approved only when
its gate mode is `incrementalModules`.

A module can enter Build when:

- the use-case analysis is approved;
- the system structure is approved;
- that module design is approved;
- every required operation contract is approved;
- each required provider has an approved contract;
- its deployable and runtime allocation are approved;
- its owned paths do not conflict with another active module;
- no blocking impact record applies to it.

The complete Design baseline can remain open while an approved,
dependency-closed subset enters Build. The interface shall state that this is
an incremental build. It shall show which module designs remain incomplete.

No incomplete module can be represented as approved or ready.

In `completeBaseline` mode, the same module-by-module design and Copilot
controls apply. The only difference is that implementation handoffs remain
blocked until the complete Design baseline is approved.

---

## 7. Plan requirements

### 7.1 Create the first draft

- **CAP-PLAN-001** The Describe view shall require only a work description.
- **CAP-PLAN-002** The user can add examples, prohibited results, and selected
  read-only sources.
- **CAP-PLAN-003** The tool shall state that selected sources are read-only.
- **CAP-PLAN-004** The tool shall create the first draft without record IDs,
  schemas, modules, ports, or adapters from the user.
- **CAP-PLAN-005** A failed optional source shall not remove a valid draft.
- **CAP-PLAN-006** A failed required source shall block approval and identify
  the source and cause.

### 7.2 Use-case content

Each main use case shall contain:

- a stable ID;
- a name;
- one or more actors;
- a trigger;
- preconditions;
- a main flow;
- approved alternate paths;
- failure paths;
- recovery behavior;
- business and safety rules;
- inputs and outputs;
- acceptance checks;
- source links;
- test scenarios.

### 7.3 Review and approval

- **CAP-PLAN-010** The Review view shall show sourced, inferred, confirmed,
  changed, and conflicting items.
- **CAP-PLAN-011** The interface shall show counts instead of an unexplained
  completion percentage.
- **CAP-PLAN-012** The user shall be able to open the source for each sourced
  item.
- **CAP-PLAN-013** The user shall be able to accept, correct, or reject an
  inferred item.
- **CAP-PLAN-014** The user shall answer only material questions.
- **CAP-PLAN-015** Approval shall be blocked when a main use case has no actor,
  result, or acceptance check.
- **CAP-PLAN-016** Approval shall be blocked when a required permission,
  safety, ownership, or source conflict is open.

---

## 8. System-design requirements

### 8.1 Architecture draft

- **CAP-DES-SYS-001** The tool shall start with one application.
- **CAP-DES-SYS-002** A separate deployable shall require a stated reason.
- **CAP-DES-SYS-003** Valid split reasons are runtime, trust boundary, owner,
  scale, release timing, fault isolation, legal separation, or safety
  separation.
- **CAP-DES-SYS-004** The architecture shall allocate every operation to one
  module.
- **CAP-DES-SYS-005** The architecture shall identify one port and one
  actor-specific adapter for each external system.
- **CAP-DES-SYS-006** A main use case shall have a complete path from an entry
  point to an output or stored state.
- **CAP-DES-SYS-007** The architecture shall show the reason for every module.
- **CAP-DES-SYS-008** The architecture shall identify deployable units and
  runtime boundaries.

### 8.2 Architecture canvas

The Design view shall contain one system canvas.

The canvas shall:

- place each module once;
- show group or deployable boundaries;
- show provided and required interfaces;
- show directed dependencies;
- use shared rails only when they reduce crossings;
- keep labels clear of nodes and lines;
- use focus mode by default;
- provide an explicit all-links mode;
- support pan and zoom without changing the model;
- support keyboard navigation;
- provide a text relationship list;
- open a small detail modal when the user selects a node or relationship.

### 8.3 System-structure approval

The user can approve the system structure before all module details exist.

System-structure approval shall freeze:

- module IDs and names;
- module types;
- module responsibilities at summary level;
- dependency edges;
- operation allocation;
- adapter allocation;
- deployable allocation;
- use-case path allocation.

The approval shall not claim that module behavior is complete.

The interface shall show:

- `System structure approved`;
- the number of module designs approved;
- the number of module designs that remain;
- the modules that block the next implementation target.

---

## 9. Module-design workspace

### 9.1 Purpose

The module-design workspace shall let a human or an agent define one module
without losing the system context.

The user shall not need to reopen the full application prompt for each module.
The workspace shall provide the approved system slice automatically.

### 9.2 Module queue

The left side of the workspace shall show all allocated modules.

Each module row shall show:

- module name;
- module type;
- summary responsibility;
- state;
- owner, when assigned;
- direct dependency count;
- direct consumer count;
- blocking issue count;
- changed-upstream indicator;
- recommended design order.

The queue shall support:

- `All`;
- `Not started`;
- `Needs input`;
- `Ready for review`;
- `Approved`;
- `Old`;
- `Blocked`.

The default selection shall be:

1. the selected module from the architecture canvas;
2. otherwise the first incomplete dependency;
3. otherwise the first incomplete module in stable sort order;
4. otherwise the first approved module.

The queue shall not force the user to follow the recommended order. If the
user selects a blocked module, the workspace shall open it and explain the
block.

### 9.3 Module-design session

The session shall have these steps:

1. **Review boundary**
2. **Define behavior**
3. **Define contracts**
4. **Review diagrams**
5. **Run checks**
6. **Approve module**

The interface shall show one current step. The user can open completed steps.
The user can return to an earlier step without losing later draft data.

The primary action shall state the next operation. Examples:

- `Create module draft`
- `Answer 2 required questions`
- `Review contracts`
- `Fix 1 design error`
- `Approve module`
- `Create Copilot handoff`

### 9.4 Draft sources

A module draft can use:

- the approved use-case analysis;
- the approved application specification;
- the approved system structure;
- direct dependency contracts;
- direct consumer needs;
- approved project constraints;
- selected repository files;
- applicable reference-architecture rules;
- earlier compatible design decisions;
- an approved module design from a prior revision.

The draft shall not use an unrelated module implementation as authority.

### 9.5 Required common content

Each `ModuleDesignSpecification` shall contain:

#### Identity

- project ID;
- module ID;
- module version;
- module type;
- name;
- owner;
- state;
- source architecture revision and hash.

#### Boundary

- responsibility;
- non-responsibilities;
- owned concerns;
- excluded concerns;
- direct dependencies;
- direct consumers;
- owned source paths;
- editable shared paths, if any;
- deployable ID;
- runtime allocation;
- runtime language.

#### Trace

- use cases served;
- scenario steps performed;
- requirements or rules applied;
- quality requirements;
- source links;
- design-decision links.

#### Behavior

- provided operations;
- required operations;
- preconditions;
- postconditions;
- invariants;
- domain rejections;
- technical failures;
- side effects;
- idempotency;
- cancellation;
- timeout behavior;
- concurrency behavior;
- retry and recovery behavior;
- events emitted or consumed.

#### Data

- input schemas;
- output schemas;
- persistent records;
- data ownership;
- retention;
- migration needs;
- confidentiality classification;
- provenance fields;
- canonical units and enumerations.

#### Runtime

- configuration references;
- secret references;
- lifecycle registration;
- health behavior;
- telemetry;
- resource ownership;
- startup and shutdown;
- compatibility constraints.

#### Verification

- examples;
- edge cases;
- acceptance cases;
- verification suites;
- required evidence;
- test doubles;
- fixture needs;
- configured commands;
- unresolved items.

### 9.6 Type-specific content

#### User-interface module

A user-interface module shall also define:

- user roles and tasks;
- routes, panels, dialogs, or host surfaces;
- information hierarchy;
- commands and navigation;
- view states;
- loading behavior;
- empty states;
- validation messages;
- permission states;
- partial-data states;
- recoverable failures;
- unrecoverable failures;
- responsive behavior;
- touch targets;
- keyboard behavior;
- focus order and focus return;
- screen-reader names and status announcements;
- reduced-motion behavior;
- theme and contrast requirements;
- approved component and token sources;
- inbound bindings;
- screenshots required by each scenario.

The module shall not own domain rules or persistence.

#### Workflow module

A workflow module shall also define:

- trigger;
- ordered steps;
- participants;
- decisions and guards;
- transaction boundary;
- partial completion;
- compensation;
- retry policy;
- deduplication;
- idempotency key use;
- cancellation points;
- deadline propagation;
- resource locks;
- progress reporting;
- final outcomes.

The module shall not implement vendor protocols or duplicate domain rules.

#### Core data and rules module

A core module shall also define:

- domain vocabulary;
- value objects;
- aggregate or consistency boundary;
- invariants;
- calculations;
- decision tables;
- deterministic ordering;
- canonical identity rules;
- revision comparison;
- invalid-state prevention;
- pure or impure operation classification.

The module shall not import interface, transport, storage, file-format, or
vendor APIs.

#### External-system adapter module

An adapter module shall also define:

- one external actor or source type;
- implemented application port;
- supported formats and versions;
- input discovery;
- input validation;
- mapping to canonical schemas;
- provenance extraction;
- authentication reference;
- license or session needs;
- timeouts;
- cancellation;
- retry safety;
- partial-read behavior;
- corrupt-input behavior;
- compatibility errors;
- process isolation;
- cleanup;
- representative fixtures.

The adapter shall not decide business policy. It shall map technical failures
to the approved error contract.

#### Shared-service module

A shared-service module shall also define:

- stored or scheduled resource;
- ownership and access;
- consistency;
- transaction behavior;
- indexing;
- retention;
- backup and recovery;
- capacity;
- cleanup;
- health checks;
- failure injection;
- test implementation.

The service shall not contain application-specific policy unless the
architecture allocates that policy to the service.

### 9.7 Contract-first design

The product shall define an operation contract before it creates an
implementation handoff.

An `OperationContract` shall include:

- operation ID;
- semantic version;
- behavior type;
- input schema reference;
- output schema reference;
- preconditions;
- postconditions;
- domain rejections;
- technical errors;
- side effects;
- idempotency;
- timeout class;
- cancellation support;
- artifact types;
- provenance fields.

The provider and every known consumer shall review a changed contract.

The tool shall identify:

- a compatible additive change;
- a conditionally compatible change;
- an incompatible change;
- a new required migration;
- a stale consumer.

The tool shall not create separate consumer-specific versions of the same
approved contract.

### 9.8 Module diagrams

The module workspace shall provide these projections when they apply:

| Diagram | Required content |
| --- | --- |
| Component | selected module, direct consumers, direct dependencies, provided interfaces, required interfaces |
| Activity | main operation or workflow, actions, decisions, guards, recovery, final node |
| State machine | stateful record or process, transitions, triggers, guards, effects |
| Sequence | actor or caller, boundary, control, entity or adapter, calls, replies, alternatives |
| Use case | actors, use cases served, system boundary, include or extend relationships |

Every meaningful node and relationship shall be selectable.

The detail modal shall show:

- UML element type;
- stable element ID;
- label;
- source record;
- definition;
- connected elements;
- trace links;
- discussion history;
- `Discuss with agent`;
- `Propose change`.

The diagram shall remain a projection. A visual change shall update the module
or architecture record before the renderer changes.

### 9.9 Module design checks

The product shall block module approval when:

- responsibility is empty;
- responsibility overlaps an approved module without a recorded decision;
- an operation has no contract;
- a required operation has no provider;
- a provided operation has no approved owner;
- an input or output schema is missing;
- a module rule conflicts with an approved use case;
- a state transition has no defined trigger;
- a workflow decision has an unguarded ambiguous branch;
- a failure has no observable outcome;
- a required external adapter has no failure mapping;
- an owned path overlaps another module;
- a required acceptance case is missing;
- a material unresolved item is open;
- a source revision changed during review;
- UML semantic validation fails for a required diagram.

The product shall show warnings when:

- an optional example is missing;
- a nonmaterial question remains;
- a performance target is not measured yet;
- an optional diagram does not apply;
- a repository path does not exist in a greenfield project.

### 9.10 Module approval

Module approval shall freeze:

- the module boundary;
- provided and required operation versions;
- schemas;
- runtime and deployable allocation;
- owned paths;
- rules and invariants;
- failure semantics;
- acceptance cases;
- unresolved nonblocking items;
- source and design-decision links.

The approval shall contain:

- module ID and version;
- design revision;
- content hash;
- architecture revision and hash;
- approver;
- authority;
- time;
- source hashes;
- open nonblocking items.

Approval of one module shall not approve another module.

### 9.11 Reopen and revise

The user can reopen an approved module design.

The product shall:

1. preserve the approved revision;
2. create a new draft revision;
3. show the change from the approved revision;
4. run impact analysis;
5. keep existing implementation and verification linked to the old revision;
6. require a new approval before a new handoff;
7. mark dependent records stale only when the approved change affects them.

---

## 10. Structural changes and impact

### 10.1 Supported changes

The user can:

- rename a module;
- change its purpose;
- change its type;
- split a module;
- merge modules;
- move an operation;
- add or remove a dependency;
- add or remove a port;
- change an adapter allocation;
- move a module to another deployable;
- change a contract;
- change a schema;
- change runtime allocation;
- change an owned path.

### 10.2 Impact analysis

The product shall calculate impact before it changes an approved record.

The impact result shall identify:

- use cases;
- scenarios and steps;
- requirements and rules;
- modules;
- operation contracts;
- schemas;
- ports;
- adapters;
- deployables;
- diagrams;
- implementation packets;
- source overlays;
- generated code;
- module tests;
- connection tests;
- end-to-end tests;
- screenshot expectations;
- approvals;
- verification records;
- baselines;
- migrations;
- documentation.

### 10.3 Invalidation rules

| Change | Minimum invalidation |
| --- | --- |
| Label only | Diagram and text projections |
| Responsibility text with no semantic change | Module review |
| Operation behavior | Provider module, consumers, module tests, affected scenarios |
| Input or output schema | Provider, consumers, bindings, fixtures, affected scenarios |
| Dependency | Source and target modules, architecture paths, implementation order |
| Adapter allocation | Adapter, port, Connect records, connection tests, affected scenarios |
| Deployable allocation | Foundation, composition, commands, health checks, connection evidence |
| Module split or merge | Architecture, affected module designs, paths, contracts, ownership, tests |
| Use-case step | Application, architecture path, modules that perform the step, scenario test |
| Screenshot expectation | Scenario test and test-evidence policy |

The product shall not mark unrelated modules stale.

### 10.4 Change application

An approved change plan shall contain ordered changes.

The agent shall apply only the approved changes. If it discovers a new material
change, it shall stop and return a new impact item. It shall not expand scope
without user approval.

---

## 11. Copilot and external-agent workflow

### 11.1 Purpose

The external-agent workflow shall support short, repeatable passes. Each pass
shall have one defined target, one approved base revision, and one expected
return format.

### 11.2 Module design handoff

The user can ask Copilot to draft one module design.

The design handoff shall contain:

- module identity and type;
- approved system-structure slice;
- applicable use cases and scenario steps;
- direct provider and consumer summaries;
- approved project rules;
- type-specific question set;
- selected repository context;
- relevant existing patterns;
- missing decisions;
- expected `ModuleDesignSpecification` schema;
- stable IDs to preserve;
- response validation rules;
- instruction not to approve the result.

The response shall contain:

- a complete module-design draft;
- explicit assumptions;
- unresolved material questions;
- proposed contracts;
- proposed diagrams as semantic elements and relationships;
- source references;
- a short change summary.

### 11.3 Module implementation packet

An implementation packet shall contain:

- packet ID;
- project ID;
- module ID and version;
- approved module-design revision and hash;
- approved architecture revision and hash;
- allowed paths;
- forbidden paths;
- editable shared paths;
- provided and required contracts;
- canonical schema references;
- reference-architecture profile;
- relevant repository files;
- target deployable and composition boundary;
- implementation steps;
- acceptance cases;
- test commands;
- required evidence;
- return manifest schema;
- idempotency key;
- deadline and cancellation instructions.

The packet shall not contain:

- unrelated module internals;
- secrets;
- hidden user data;
- unsupported assumptions;
- permission to change architecture;
- permission to approve or merge.

### 11.4 Context limits

The product shall create a deterministic context manifest.

The manifest shall list each included file and reason. The product shall apply
these priorities:

1. canonical record and contracts;
2. files in owned paths;
3. direct dependency interfaces;
4. direct consumer interfaces;
5. nearby approved patterns;
6. relevant tests;
7. repository conventions.

The product shall omit a lower-priority file before it truncates a canonical
record.

When the packet exceeds the configured context limit, the product shall stop
and show:

- current size;
- configured limit;
- largest items;
- safe exclusion choices;
- option to create a smaller subtask.

### 11.5 Returned delta

The external agent shall return:

- packet ID;
- base revision and hash;
- changed files;
- created files;
- deleted files;
- changed records;
- test results;
- assumptions;
- unresolved issues;
- requested scope changes;
- evidence files.

The product shall reject a delta when:

- packet ID is unknown;
- base revision or hash is stale;
- a changed path is outside the allowed set;
- a deleted path was not approved;
- a canonical contract changed without an approved impact record;
- the response omits its change manifest;
- required checks did not run and no reason exists.

### 11.6 Inspect, approve, and apply

The user shall see:

- a file summary;
- record changes;
- contract changes;
- affected requirements and use cases;
- test results;
- new warnings;
- new dependencies;
- out-of-scope attempts;
- generated versus user-owned files;
- rollback point.

The product shall apply only the inspected content hash.

If the workspace changes after inspection, the product shall require a new
inspection.

### 11.7 Multi-pass work

A module can require several Copilot passes.

The product shall support:

- `Continue this module`;
- `Fix failed checks`;
- `Add missing acceptance case`;
- `Update after contract change`;
- `Prepare connection binding`;
- `Address review comments`.

Each pass shall create a new packet. It shall refer to the current applied
module revision. It shall not reuse a stale packet as the base.

### 11.8 Implementation waves

The product shall calculate dependency waves after module approval.

The default interface shall show waves as planning information. It shall not
send every wave automatically.

For each wave, show:

- modules;
- direct dependencies;
- allowed paths;
- shared resources;
- batch eligibility;
- blocking unapproved contracts;
- blocking cycles.

The user can select one module from a wave. The user can explicitly select
several independent modules when the multi-module rules in section 3.3 pass.

---

## 12. Build requirements

### 12.1 Module build lifecycle

Each module shall use this lifecycle:

1. approved design;
2. implementation handoff;
3. returned delta;
4. scope inspection;
5. warning acceptance, when needed;
6. user approval to apply;
7. transactional apply;
8. module verification;
9. integration readiness.

### 12.2 Transactional apply

The apply operation shall:

- verify the base workspace revision;
- verify the inspected delta hash;
- create a recoverable backup;
- apply all approved changes or none;
- preserve unrelated changes;
- update ownership manifests;
- update generated files only through their generator;
- record the result;
- provide rollback instructions.

### 12.3 Module verification

Module verification shall include:

- schema validation;
- contract tests;
- unit tests;
- acceptance-case tests;
- type checks;
- repository lint or static analysis when configured;
- module boundary checks;
- owned-path checks;
- prohibited dependency checks;
- applicable accessibility checks;
- applicable failure-injection checks;
- configured commands.

A module is `ready` only when its current applied revision passes all blocking
checks.

---

## 13. Connect requirements

Connect shall begin with approved module contracts.

The user shall configure:

- inbound entry points;
- UI bindings;
- command-line bindings;
- HTTP bindings;
- schedule bindings;
- embedded-library bindings;
- outbound adapter instances;
- configuration references;
- secret references;
- composition roots;
- process boundaries;
- health checks.

The product shall not offer an operation that has no approved provider.

The product shall verify the observed path:

> inbound adapter → composition root → operation → outbound adapter

Connection verification shall use the real configured path. It shall identify
when a test adapter replaces an external dependency.

---

## 14. Verify requirements

### 14.1 Scenario generation

The product shall generate one automated end-to-end test for:

- every approved main scenario;
- every approved alternate scenario;
- every approved failure scenario;
- every approved recovery scenario.

Each test action and check shall refer to one scenario-step ID.

### 14.2 Step evidence

For each step, record:

- action;
- expected result;
- actual result;
- start time;
- end time;
- outcome;
- screenshot evidence when the result is visible;
- structured evidence for nonvisual results;
- reason when a screenshot does not apply.

Screenshot metadata shall include applicable browser, viewport, operating
system, theme, locale, build, environment, and test-data revision.

The product shall preserve the original screenshot. A mask or comparison image
shall be a separate artifact.

### 14.3 Scenario run identity

A scenario run shall identify:

- use-case analysis revision;
- application revision;
- system-structure revision;
- module-design revisions;
- implementation revisions;
- connection revision;
- build;
- source revision;
- environment;
- test data;
- runner;
- evidence hashes.

### 14.4 Verify view

Verify shall show:

- use-case count;
- scenario count;
- passed, failed, skipped, and cancelled counts;
- step count;
- screenshot count;
- structured evidence count;
- first failed step;
- current versus old result;
- link to approved Design records.

Verify shall not contain design diagrams.

---

## 15. UML rendering requirements

### 15.1 Supported notation

The renderer shall support only the declared UML 2.5.1 subset.

The renderer shall:

- use the component icon or `«component»`;
- use lollipop notation for a provided interface;
- use socket notation for a required interface;
- use dashed open arrows for dependencies;
- use a filled circle for an initial node;
- use a bullseye for an activity or state final node;
- use diamonds for decisions and merges;
- place guards in square brackets;
- use `trigger [guard] / effect` for state transitions;
- order sequence messages from top to bottom;
- use solid calls and dashed replies;
- label combined fragments and operands;
- place actors outside a use-case system boundary;
- place use cases inside the boundary;
- label `«include»` and `«extend»`.

### 15.2 Layout quality

The renderer shall:

- use orthogonal routing when it improves readability;
- keep node positions stable for the same record and viewport class;
- prevent line labels from covering node text;
- prevent nodes from overlapping;
- keep relationship crossings below the configured threshold;
- route multiple relationships through shared rails only when labels remain
  unambiguous;
- keep at least the configured clearance between a line and unrelated node;
- provide horizontal pan on a narrow viewport;
- preserve readable text size;
- provide a text alternative.

Layout failure shall produce a diagnostic. It shall not silently hide a
relationship.

---

## 16. Data contracts

### 16.1 Module design

```ts
type ModuleDesignSpecification = {
  schemaVersion: "1.0";
  projectId: string;
  id: string;
  revision: string;
  status:
    | "draft"
    | "needsInput"
    | "readyForReview"
    | "approved"
    | "stale"
    | "conflict"
    | "superseded"
    | "withdrawn";

  architecture: {
    id: string;
    revision: string;
    contentHash: string;
  };

  module: {
    moduleId: string;
    moduleVersion: string;
    name: string;
    moduleType:
      | "experience"
      | "workflow"
      | "domain"
      | "connection"
      | "platform";
    owner?: string;
    responsibility: string;
    nonResponsibilities: string[];
    ownedConcerns: string[];
    excludedConcerns: string[];
  };

  trace: {
    useCaseIds: string[];
    scenarioStepIds: string[];
    ruleIds: string[];
    qualityRequirementIds: string[];
    sourceRefs: string[];
    designDecisionIds: string[];
  };

  boundary: {
    directDependencyIds: string[];
    directConsumerIds: string[];
    deployableId: string;
    runtimeAllocation: string;
    runtimeLanguage: string;
    ownedPaths: string[];
    editableSharedPaths: string[];
  };

  providedOperations: OperationContractRef[];
  requiredOperations: RequiredOperationRef[];
  schemas: ModuleSchemaRef[];
  rules: NamedText[];
  invariants: string[];
  behavior: ModuleBehaviorSpecification;
  data: ModuleDataSpecification;
  runtime: ModuleRuntimeSpecification;
  verification: ModuleVerificationSpecification;
  diagrams: DiagramProjectionRef[];
  unresolvedItems: UnresolvedDesignItem[];
  gates: GateResult[];
  approval?: Approval;
  contentHash: string;
};
```

### 16.2 Module behavior

```ts
type ModuleBehaviorSpecification = {
  preconditions: string[];
  postconditions: string[];
  domainRejections: string[];
  technicalFailures: string[];
  sideEffects: string[];
  idempotency: string;
  cancellation: string;
  timeouts: string;
  concurrency: string;
  retry: string;
  recovery: string;
  emittedEvents: string[];
  consumedEvents: string[];
  states?: StateDefinition[];
  activities?: ActivityDefinition[];
  interactions?: InteractionDefinition[];
};
```

### 16.3 Design session

```ts
type ModuleDesignSession = {
  id: string;
  projectId: string;
  moduleId: string;
  baseArchitectureRevision: string;
  baseModuleDesignRevision?: string;
  state:
    | "created"
    | "drafting"
    | "needsInput"
    | "readyForReview"
    | "completed"
    | "cancelled"
    | "expired";
  currentStep:
    | "boundary"
    | "behavior"
    | "contracts"
    | "diagrams"
    | "checks"
    | "approval";
  sourceManifest: ContextManifest;
  answers: DesignAnswer[];
  diagnostics: Diagnostic[];
  createdAt: string;
  updatedAt: string;
};
```

### 16.4 Context manifest

```ts
type ContextManifest = {
  id: string;
  targetRecordId: string;
  targetRevision: string;
  tokenOrByteLimit: number;
  totalBytes: number;
  entries: {
    kind: "record" | "contract" | "schema" | "source" | "pattern" | "test";
    ref: string;
    contentHash: string;
    bytes: number;
    priority: number;
    inclusionReason: string;
  }[];
  omitted: {
    ref: string;
    reason: string;
  }[];
  contentHash: string;
};
```

### 16.5 Module progress

```ts
type ModuleDesignProgress = {
  projectId: string;
  architectureRevision: string;
  total: number;
  notStarted: number;
  draft: number;
  needsInput: number;
  readyForReview: number;
  approved: number;
  stale: number;
  blocked: number;
  modules: {
    moduleId: string;
    state: string;
    blockingIds: string[];
    validNextActions: string[];
  }[];
};
```

### 16.6 Complete Design baseline

```ts
type DesignBaseline = {
  schemaVersion: "1.0";
  projectId: string;
  id: string;
  revision: string;
  status: "draft" | "approved" | "stale" | "superseded";
  architecture: {
    id: string;
    revision: string;
    contentHash: string;
  };
  modules: {
    moduleId: string;
    designId: string;
    revision: string;
    contentHash: string;
  }[];
  operationContracts: {
    operationId: string;
    version: string;
    contentHash: string;
  }[];
  requiredModuleIds: string[];
  missingModuleIds: string[];
  gates: GateResult[];
  approval?: Approval;
  contentHash: string;
};
```

The product shall approve a complete Design baseline only when
`missingModuleIds` is empty and every blocking gate passes.

### 16.7 Design workflow policy

```ts
type DesignWorkflowPolicy = {
  projectId: string;
  mode: "completeBaseline" | "incrementalModules";
  approvedDecisionId?: string;
  changedAt: string;
  changedBy: string;
};
```

Changing this policy shall not change an existing record approval. It shall
change only the validity of later Build handoff actions.

---

## 17. Application operations and machine API

The interface and machine API shall call the same application operations.

### 17.1 Read operations

- `getWorkflowStatus(projectId)`
- `getValidNextActions(projectId)`
- `getSystemDesign(projectId, revision?)`
- `listModuleDesigns(projectId, filter?)`
- `getModuleDesign(projectId, moduleId, revision?)`
- `getModuleContext(projectId, moduleId)`
- `getModuleImpact(projectId, moduleId)`
- `getImplementationWaves(projectId)`
- `getScenarioCoverage(projectId)`
- `getVerificationEvidence(projectId, scenarioRunId)`

### 17.2 Change operations

- `createUseCaseDraft`
- `updateUseCaseItem`
- `approveUseCaseAnalysis`
- `createSystemDesignDraft`
- `applySystemDesignDecision`
- `approveSystemStructure`
- `startModuleDesign`
- `answerModuleDesignQuestion`
- `updateModuleDesignItem`
- `analyzeModuleDesign`
- `approveModuleDesign`
- `reopenModuleDesign`
- `createDesignBaseline`
- `approveDesignBaseline`
- `proposeVisualChange`
- `analyzeVisualChange`
- `approveChangePlan`
- `createModuleImplementationPacket`
- `importAgentDelta`
- `inspectAgentDelta`
- `approveAgentDelta`
- `applyAgentDelta`
- `verifyModule`
- `configureBinding`
- `verifyConnection`
- `runScenario`
- `approveVerification`

### 17.3 Operation controls

Each change operation shall:

- require an idempotency key;
- accept the expected base revision and hash;
- reject a stale base;
- validate authorization;
- support cancellation when work can take more than one second;
- accept a deadline for provider or process work;
- return structured diagnostics;
- return the new revision and hash;
- write an audit event;
- return valid next actions.

The API shall not expose an approval shortcut for agents.

---

## 18. User-interface requirements

### 18.1 Common interaction rules

- Show one primary action in each focused workspace.
- Put the object before the action in labels.
- Use counts for progress.
- Keep technical IDs available in Design mode.
- Hide IDs in Guided mode unless an error requires one.
- Autosave drafts locally and show save state.
- Preserve selection after a rerender.
- Return focus to the control that opened a modal.
- Support undo for an unapplied draft change.
- Show the last approved revision beside a changed draft.
- Keep a user-selected module visible when another record refreshes.

### 18.2 Module workspace layout

On a wide screen:

- left: module queue;
- center: current module step and design content;
- right: system context, dependencies, traces, and checks.

On a narrow screen:

- module queue becomes a drawer or selector;
- current module content remains first;
- context becomes a collapsible section;
- diagram canvases pan horizontally;
- approval actions remain reachable without precision pointing.

### 18.3 Feedback and motivation

The interface should make progress clear without using false celebration.

Use:

- `3 of 17 module designs approved`;
- a clear next module;
- a visible reduction in open questions;
- a short confirmation after a valid approval;
- a completion summary for each module;
- a resume action that returns to the exact incomplete step.

Do not use:

- unexplained percentages;
- random confetti;
- approval pressure;
- hidden blocking work;
- a completed state while dependencies are stale.

### 18.4 Accessibility

The product shall meet WCAG 2.2 AA for the supported interface.

It shall include:

- complete keyboard operation;
- visible focus;
- correct headings and landmarks;
- named controls;
- status announcements;
- error summary and field links;
- focus containment in modal dialogs;
- focus return;
- reduced motion;
- text alternatives for diagrams;
- non-color status indicators;
- minimum touch target policy;
- zoom to 200 percent without loss of operation.

---

## 19. Error and recovery requirements

| Failure | Required behavior |
| --- | --- |
| Provider unavailable | Keep the draft and allow manual work or later retry |
| Copilot response incomplete | Import valid fields, identify missing required fields, do not approve |
| Stale response | Preserve response as evidence, block apply, offer a new packet |
| Source changed | Mark dependent records old, show exact source change |
| MATLAB timeout | Stop or isolate the process, keep last valid snapshot, record failure |
| Partial file import | Do not publish the candidate snapshot |
| Apply failure | Roll back the complete delta and preserve diagnostics |
| Verification command timeout | Stop the command, record timeout, keep module not ready |
| Browser screenshot failure | Fail the applicable step or record the approved nonapplicable reason |
| Dependency cycle | Block implementation wave, show the cycle and direct edit links |
| Lost client session | Restore persisted draft and last selected module |
| Concurrent edit | Reject stale save and offer a three-way comparison |

The product shall never replace the last valid approved snapshot with an
invalid candidate.

---

## 20. Security, privacy, and audit

### 20.1 Source access

- Source adapters shall be read-only during Plan and Design analysis.
- The product shall request write access only for an approved implementation
  apply.
- The product shall restrict agent context to selected repositories and
  approved sources.
- Secret values shall not enter prompts, packets, logs, screenshots, or
  canonical records.
- Secret records shall contain references only.

### 20.2 Agent isolation

- External agents shall receive a packet, not unrestricted project authority.
- The product shall validate returned paths.
- The product shall reject symbolic-link or path-traversal escapes.
- Command execution shall use configured allowlists or explicit user approval.
- An agent shall not change access policy or provider configuration in a module
  handoff.

### 20.3 Audit events

Record:

- actor;
- operation;
- target record;
- base revision and hash;
- result revision and hash;
- idempotency key;
- provider or agent identity;
- packet and delta IDs;
- approval;
- time;
- diagnostics;
- evidence references.

Do not store private model reasoning. Store sources, assumptions, short reasons,
and observable results.

---

## 21. Performance and capacity

For a medium project with 10 to 40 modules and 20 to 200 scenarios:

- the module queue should render in 200 ms after local records load;
- selection should update the workspace in 100 ms;
- local design checks should complete in 500 ms;
- impact analysis should stream first results in 2 seconds;
- diagram selection should respond in 100 ms;
- the architecture canvas should remain usable at 40 modules and 100 visible
  relationships in all-links mode;
- focus mode should render only the selected neighborhood;
- autosave should not block typing;
- provider and process work shall show progress and support cancellation;
- a long operation shall preserve its job record across application restart.

The product shall measure these targets on reference hardware. A failure to
meet a target shall create a visible performance issue. It shall not remove a
required control.

---

## 22. Default DO-178C Audit Hub sample

### 22.1 Sample rule

When no project is configured, the product shall open **Sample DO-178C Audit
Hub**.

The interface shall state that this is synthetic sample data.

The sample shall contain valid data, defects, old data, one failed refresh, and
verification evidence.

The sample shall use `completeBaseline` by default. It shall include a saved
preview of `incrementalModules` mode so that the user can inspect the different
handoff gate without changing the approved sample baseline.

### 22.2 Sample module catalog

The sample shall contain 17 modules.

#### User interfaces

| Module | Responsibility | Provides | Requires |
| --- | --- | --- | --- |
| Audit Workspace | Show readiness, findings, review actions, and package status | `OpenReadiness`, `OpenFinding`, `RecordReviewDecision` | Evidence Graph, Finding Review, Package Export, Workspace Snapshots |
| Lifecycle Explorer | Browse evidence by lifecycle phase and follow traces | `OpenLifecyclePhase`, `FollowTrace`, `CompareEvidence` | Evidence Graph, Workspace Snapshots |

#### Workflows

| Module | Responsibility | Provides | Requires |
| --- | --- | --- | --- |
| Import and Publish | Read source candidates, validate them, publish valid snapshots, preserve last valid data | `RefreshEvidence`, `GetRefreshStatus`, `CancelRefresh` | all source ports, Evidence Graph, Workspace Snapshots, Evidence Store, Job and Package Store |
| Finding Review | Enforce independent review and finding transitions | `SubmitFindingDecision`, `CloseFinding`, `ReopenFinding` | Evidence Graph, Evidence Store |
| Package Export | Create a deterministic audit package and manifest | `CreateAuditPackage`, `GetPackageStatus`, `CancelPackage` | Evidence Graph, Workspace Snapshots, Evidence Store, Job and Package Store |

#### Core data and rules

| Module | Responsibility | Provides | Requires |
| --- | --- | --- | --- |
| Evidence Graph | Own evidence identity, trace links, coverage, first-gap navigation, and revision comparison | `ResolveEvidenceIdentity`, `AddRelationship`, `FollowTrace`, `FindFirstGap`, `ReportCoverage`, `CompareRevisions` | Evidence Store |
| Workspace Snapshots | Own candidate, validating, published, failed, and baselined snapshot state | `StageCandidate`, `StartValidation`, `PublishSnapshot`, `PreserveLastValid`, `CreateBaseline` | Evidence Store |

#### External-system adapters

| Module | Port | Input | Runtime |
| --- | --- | --- | --- |
| File-system adapter | `ProjectFileSourcePort` | project files and folders | desktop process |
| Git adapter | `RevisionSourcePort` | commit, tag, branch, status | desktop process |
| MATLAB and Simulink adapter | `EngineeringModelSourcePort` | `.slx`, `.sldd`, `.slreqx`, `.slmx`, `.sldatx` | separate MATLAB process |
| Spreadsheet adapter | `TabularEvidenceSourcePort` | `.xlsx`, `.csv` | desktop process |
| C and header source adapter | `SourceCodeEvidencePort` | `.c`, `.h` | desktop process |
| Coverage adapter | `CoverageEvidenceSourcePort` | LCOV, XML, JSON | desktop process |
| Review-evidence adapter | `ReviewEvidenceSourcePort` | checklists, comments, approvals, findings | desktop process |
| Objective-profile adapter | `ObjectiveProfileSourcePort` | project DO-178C objectives and tailoring | desktop process |

#### Shared services

| Module | Responsibility | Provides |
| --- | --- | --- |
| Evidence Store | Store immutable source snapshots, normalized evidence, trace records, reviews, and findings | `EvidenceStorePort` |
| Job and Package Store | Store job state, progress, package files, hashes, and manifests | `JobStorePort`, `PackageStorePort` |

### 22.3 Sample module-design detail

Each sample module shall include:

- an approved module-design revision;
- a draft later revision for at least three modules;
- operation contracts;
- type-specific details;
- applicable UML projections;
- acceptance cases;
- direct dependency and consumer links;
- owned paths;
- module verification results;
- a Copilot handoff example;
- an inspected returned delta;
- one impact example.

At minimum, include these defects:

- Evidence Graph has one broken low-level requirement to model trace;
- MATLAB and Simulink adapter has one timeout run;
- Spreadsheet adapter has one invalid column mapping;
- Finding Review has one rejected nonindependent decision;
- Package Export has one old package after a baseline change.

### 22.4 Recommended design order

The sample shall recommend this module-design order:

1. Evidence Store;
2. Job and Package Store;
3. Evidence Graph;
4. Workspace Snapshots;
5. the eight source adapters;
6. Import and Publish;
7. Finding Review;
8. Package Export;
9. Lifecycle Explorer;
10. Audit Workspace.

The user can choose another module. The workspace shall show missing contracts
or upstream decisions.

### 22.5 Recommended implementation waves

| Wave | Modules | Reason |
| --- | --- | --- |
| 1 | Evidence Store; Job and Package Store | No application-module dependency |
| 2 | Evidence Graph; Workspace Snapshots | Depend on approved store contracts |
| 3 | Eight source adapters | Independent actor-specific adapters with isolated owned paths |
| 4 | Import and Publish; Finding Review; Package Export | Use core and store contracts |
| 5 | Lifecycle Explorer; Audit Workspace | Bind approved workflows and domain operations |
| 6 | Composition and entry points | Connect implemented modules in deployable units |
| 7 | End-to-end scenarios | Verify complete real paths |

The default Copilot action in every wave shall still target one module.

---

## 23. Migration

### 23.1 Existing approved architecture

For an existing project:

1. preserve the approved architecture;
2. create one draft `ModuleDesignSpecification` for each allocated module;
3. populate it from the current `ModuleManifest`, preserved module interview,
   operation contracts, implementation specification, and repository context;
4. mark inferred fields;
5. identify missing type-specific fields;
6. do not remove existing module approval;
7. require the new module-design approval only before a new implementation
   handoff or structural change.

### 23.2 Existing implementation

The product shall inspect existing owned paths.

It shall:

- link matching behavior to proposed acceptance cases;
- identify implementation that has no approved design source;
- identify approved behavior that has no implementation;
- preserve user-authored code;
- propose a migration overlay;
- require inspection before apply.

### 23.3 Feature control

The release shall use a project feature flag.

The flag shall:

- enable module-design records and workspace;
- leave existing projects usable;
- support export before disable;
- not delete new records when disabled;
- support project-by-project migration evidence.

---

## 24. Test specification

### 24.1 Contract and unit tests

Test:

- schema validation;
- stable IDs;
- deterministic hashes;
- stable sorting;
- state transitions;
- idempotent retries;
- stale revision rejection;
- module queue filters;
- default module selection;
- type-specific required fields;
- operation compatibility;
- owned-path conflicts;
- dependency cycles;
- impact classification;
- context manifest limits;
- packet and delta validation;
- transactional apply and rollback;
- diagram semantic validation;
- diagram collision and crossing thresholds;
- approval authority;
- audit events.

### 24.2 Product end-to-end tests

Automate these product scenarios:

1. Create a first use-case draft from one sentence.
2. Approve use cases after resolving one required decision.
3. Create and approve the system structure.
4. Open the module queue with 17 sample modules.
5. Create the Evidence Store module draft.
6. Stop and resume the module design at the contracts step.
7. Import an incomplete Copilot module-design response.
8. Show the exact missing fields without discarding valid data.
9. Approve one module while 16 remain incomplete.
10. Block a handoff for a module with an unapproved required contract.
11. Create one module implementation packet.
12. Reject a returned delta that changes an unrelated path.
13. Inspect, approve, and apply an in-scope delta.
14. Roll back a failed transactional apply.
15. Verify the applied module.
16. Reopen an approved module after a contract change.
17. Mark only affected consumers stale.
18. Split a module and review the complete impact.
19. Select a UML relationship and propose a change.
20. Approve a change plan and regenerate affected diagrams.
21. Create an implementation-wave plan without automatic dispatch.
22. Explicitly select two independent adapter modules for a combined handoff.
23. Reject a combined handoff with overlapping owned paths.
24. Restore a module-design draft after application restart.
25. Resolve a concurrent edit through comparison.
26. Complete Connect through a real entry point.
27. Run every approved sample scenario.
28. Open screenshot evidence for each visible step.
29. Open structured evidence for each nonvisual step.
30. Confirm that Verify contains links to Design and no design diagrams.

### 24.3 Copilot compatibility tests

Run the same module task with:

- current Copilot handoff;
- an in-app provider;
- a fixed deterministic test provider;
- no provider.

Verify that:

- all modes create the same canonical record shape;
- only user approval changes state to approved;
- a partial response is recoverable;
- the context manifest is deterministic;
- a second pass uses the current module revision;
- no pass requires the full repository when scoped context is sufficient;
- a provider outage does not lose work.

### 24.4 Accessibility tests

Test:

- keyboard completion of every stage;
- module selection and filtering;
- modal focus and return;
- diagram text alternatives;
- status announcements;
- error links;
- 200 percent zoom;
- narrow viewport operation;
- reduced motion;
- screen-reader names;
- non-color state communication.

### 24.5 Evidence requirements

Each automated product scenario shall store:

- scenario and step IDs;
- expected and actual result;
- application and design revisions;
- module revisions;
- build and environment;
- test-data revision;
- screenshot for visible results;
- structured evidence for nonvisual results;
- reason for each nonapplicable screenshot;
- immutable content hashes.

---

## 25. Reference implementation architecture

### 25.1 Architecture rule

The implementation shall use ports and adapters.

The core package shall not import React, Electron, Git, file-system, database,
MATLAB, browser, test-runner, or provider libraries.

The core package shall own:

- record validation;
- state transitions;
- stable IDs;
- canonical sorting and hashing;
- use-case compilation;
- system-design rules;
- module-design rules;
- contract compatibility;
- impact analysis;
- approval rules;
- valid next actions;
- packet manifests;
- returned-delta policy;
- verification planning.

Adapters shall own I/O, provider protocols, storage, processes, and user
interface translation.

### 25.2 Internal implementation modules

The feature should be built as these implementation modules. Each row is a
separate design, review, and Copilot handoff target.

| ID | Module | Responsibility | Depends on |
| --- | --- | --- | --- |
| EUC-01 | Use-case analysis core | Validate analysis records, item status, use cases, paths, questions, and Plan gates | common record utilities |
| EUC-02 | Application compiler | Compile approved analysis to a deterministic `ApplicationSpecification` | EUC-01 |
| EUC-03 | System-design core | Create and change the simplest valid system structure and use-case paths | EUC-02 |
| EUC-04 | Module-design core | Create, update, check, approve, reopen, and mark module designs old | EUC-03 |
| EUC-05 | Contract registry | Own operation and schema versions, provider ownership, and compatibility checks | EUC-04 |
| EUC-06 | Design baseline | Create and approve the exact architecture and required module-design set | EUC-04, EUC-05 |
| EUC-07 | Impact engine | Calculate record, contract, file, diagram, test, approval, and baseline impact | EUC-03, EUC-04, EUC-05 |
| EUC-08 | Diagram semantics | Compile canonical records to UML elements and relationships and validate the supported subset | EUC-03, EUC-04, EUC-05 |
| EUC-09 | Diagram layout adapter | Place nodes, route relationships, enforce clearance, and produce accessible projections | EUC-08 |
| EUC-10 | Context and packet compiler | Build deterministic one-module design and implementation packets | EUC-04, EUC-05, EUC-07 |
| EUC-11 | Delta inspector and apply planner | Validate returned manifests, paths, revisions, hashes, ownership, and rollback plan | EUC-10, EUC-07 |
| EUC-12 | Verification planner | Compile approved scenarios and module acceptance cases to required checks and evidence | EUC-01, EUC-04, EUC-06 |
| EUC-13 | Persistence and migration adapter | Store immutable revisions, approvals, sessions, packets, deltas, jobs, and audit events | canonical record schemas |
| EUC-14 | Provider adapters | Support Copilot handoff, in-app provider, and fixed deterministic provider | EUC-10 |
| EUC-15 | Repository and process adapters | Read scoped context, inspect workspace revisions, apply approved deltas, and run commands | EUC-10, EUC-11 |
| EUC-16 | Desktop and machine API adapters | Expose the same application operations through IPC, CLI, and machine API | EUC-01 through EUC-15 |
| EUC-17 | React workspaces | Present Plan, system design, module design, Build, Connect, and Verify | EUC-16 |

### 25.3 Internal module details

#### EUC-01 — Use-case analysis core

Owned outputs:

- `UseCaseAnalysis` schema;
- analysis item state rules;
- scenario and step stable IDs;
- Plan gate results;
- analysis approval command.

Acceptance:

- the same input produces the same canonical record;
- a required conflict blocks approval;
- an optional missing source creates a warning;
- approval preserves the exact source set and hash.

#### EUC-02 — Application compiler

Owned outputs:

- pure `compileApplication` operation;
- stable mapping rules;
- diagnostic mapping;
- legacy path compatibility.

Acceptance:

- the same approved analysis and options produce the same application hash;
- no compilation path grants approval;
- a missing required item returns a stable diagnostic.

#### EUC-03 — System-design core

Owned outputs:

- architecture proposal;
- module, operation, adapter, deployable, and path allocation;
- structural change commands;
- system-structure approval.

Acceptance:

- every main use case has a complete path;
- every external actor has an actor-specific adapter allocation;
- a split has an approved reason;
- cycles and unowned operations block approval.

#### EUC-04 — Module-design core

Owned outputs:

- `ModuleDesignSpecification`;
- module queue and progress read model;
- six-step session;
- type-specific field policy;
- module approval and reopen commands;
- pure compilers to current module records.

Acceptance:

- one module can be approved without changing another;
- incomplete upstream work produces an exact block;
- a reopened module preserves its approved revision;
- a semantic change marks only affected records old.

#### EUC-05 — Contract registry

Owned outputs:

- operation and schema registries;
- provider and consumer index;
- semantic compatibility classifier;
- consumer review requirements.

Acceptance:

- one operation version has one provider;
- an incompatible change identifies every consumer;
- no implementation packet uses an unapproved contract.

#### EUC-06 — Design baseline

Owned outputs:

- `DesignBaseline`;
- complete and incremental gate policy;
- baseline approval;
- baseline-staleness calculation.

Acceptance:

- complete mode blocks Build until required module designs are approved;
- incremental mode allows only dependency-closed approved modules;
- the baseline hash changes when one linked module revision changes.

#### EUC-07 — Impact engine

Owned outputs:

- `ImpactRecord`;
- direct and transitive trace traversal;
- invalidation matrix;
- ordered required-change plan.

Acceptance:

- label-only changes do not mark implementations old;
- contract changes identify providers, consumers, tests, and bindings;
- split and merge changes identify ownership and migration work.

#### EUC-08 and EUC-09 — Diagram semantics and layout

Owned outputs:

- semantic UML projections;
- stable element and relationship IDs;
- notation diagnostics;
- deterministic layout seed;
- collision, clearance, crossing, and label checks;
- accessible relationship list.

Acceptance:

- every visible relationship exists in the semantic projection;
- every selectable element opens its canonical source;
- the renderer never hides a relationship to make a layout pass;
- the same record and viewport class produce a stable layout.

#### EUC-10 — Context and packet compiler

Owned outputs:

- `ContextManifest`;
- module-design packet;
- module-implementation packet;
- context priority and limit policy;
- return schema.

Acceptance:

- the packet contains one module by default;
- every included context item has a reason and hash;
- lower-priority context is omitted before a canonical record;
- no packet contains a secret value.

#### EUC-11 — Delta inspector and apply planner

Owned outputs:

- returned-delta schema;
- stale-base check;
- path and ownership check;
- impact preview;
- transactional apply plan;
- rollback plan.

Acceptance:

- an unapproved path blocks apply;
- a workspace change after inspection requires new inspection;
- apply changes all approved files or none;
- unrelated workspace changes remain unchanged.

#### EUC-12 — Verification planner

Owned outputs:

- scenario-to-test plan;
- module acceptance plan;
- evidence expectation plan;
- current-result calculation;
- Verify counts and links.

Acceptance:

- every approved scenario has one automation target;
- every step has an evidence policy;
- a stale module or connection revision makes the affected scenario result old;
- Verify contains no design diagram.

#### EUC-13 through EUC-17 — Adapters and interface

These modules shall implement the approved core ports. They shall not duplicate
core state or policy.

Acceptance:

- IPC, CLI, and machine API return the same structured result for the same
  operation;
- provider loss does not lose a draft;
- persistence restart restores the module session and selected module;
- the React interface enables only valid next actions;
- every human operation has a machine operation;
- no machine operation bypasses approval.

### 25.4 Recommended internal build order

| Wave | Modules | Output |
| --- | --- | --- |
| 1 | shared schemas; EUC-01; EUC-02 | Approved analysis and deterministic application compile |
| 2 | EUC-03; EUC-04; EUC-05; EUC-06 | System structure, module designs, contracts, Design baseline |
| 3 | EUC-07; EUC-08; EUC-10; EUC-12 | Impact, semantic diagrams, packets, verification plans |
| 4 | EUC-09; EUC-11; EUC-13; EUC-14; EUC-15 | Layout, returned changes, persistence, providers, repository and process I/O |
| 5 | EUC-16 | Desktop and machine operations |
| 6 | EUC-17 | Human workspaces |
| 7 | migration and end-to-end evidence | Release candidate |

The team shall approve the design for one internal module before it creates
that module's implementation handoff. The team can use the same module workflow
that this specification defines.

---

## 26. Delivery plan

### Increment 1 — Canonical module design

- Add `ModuleDesignSpecification`.
- Add schema, persistence, revision, hash, and approval.
- Add migration from current module records.
- Add pure compilers to `ModuleManifest`, `OperationContract`, and
  `ModuleImplementationSpecification`.

### Increment 2 — Module queue and workspace

- Add module state counts.
- Add filters and recommended order.
- Add the six-step module-design session.
- Add resume, autosave, and valid next actions.
- Add type-specific views.

### Increment 3 — Contract and diagram review

- Add provider and consumer contract review.
- Add compatibility checks.
- Generate module UML projections.
- Add semantic and layout validation.
- Add selectable visual elements.

### Increment 4 — Copilot design passes

- Add one-module design packets.
- Add deterministic context manifests.
- Import and validate partial responses.
- Add explicit assumption and question review.

### Increment 5 — Copilot implementation passes

- Compile one-module implementation packets.
- Inspect returned deltas.
- Add scope and path enforcement.
- Add transactional apply and rollback.
- Add multi-pass continuation.

### Increment 6 — Controlled waves

- Calculate dependency waves.
- Keep one-module dispatch as the default.
- Add explicit independent multi-module selection.
- Add resource and owned-path checks.

### Increment 7 — Connect and Verify trace

- Link bindings to approved module contracts.
- Link scenario runs to all module-design revisions.
- Add step screenshot and structured evidence.
- Add Design links in Verify.

### Increment 8 — Migration and release

- Migrate sample and selected existing projects.
- Run human and Copilot usability studies.
- Measure completion time, errors, recovery, and context size.
- Enable the feature per project.

Each increment shall have a reversible release boundary.

---

## 27. Completion criteria

The feature is complete when:

- the tool creates and approves a use-case analysis;
- the tool creates and approves a system structure;
- the Design view shows all allocated modules and their design states;
- the user can design one module without designing all modules;
- the user can approve one module without approving all modules;
- the product blocks only actions that require incomplete upstream work;
- an approved, dependency-closed module can enter Build;
- the default external-agent handoff contains one module;
- the product supports several passes for one module;
- a returned delta cannot change an unapproved path;
- apply is transactional and recoverable;
- the product calculates implementation waves but does not dispatch them
  automatically;
- every required operation has one approved contract and provider;
- every module has type-specific design detail and acceptance cases;
- every applicable module has selectable UML detail;
- each visual change produces impact analysis before data changes;
- the sample contains 17 detailed module designs;
- the sample demonstrates incomplete, approved, stale, blocked, and recovered
  module states;
- every approved scenario has a current automated result;
- every applicable visible step has screenshot evidence;
- every nonvisual step has structured evidence or a reason;
- human and machine clients use the same application operations;
- only authorized users can approve records;
- all required product, Copilot, accessibility, migration, and recovery tests
  pass.

---

## Appendix A — Module-design review checklist

### Boundary

- Is the responsibility one clear statement?
- Are non-responsibilities explicit?
- Does another module own the same concern?
- Are direct dependencies necessary?
- Does each dependency use an approved contract?
- Are owned paths exclusive?

### Behavior

- Does every operation have an observable result?
- Are preconditions and postconditions testable?
- Are domain rejections separate from technical failures?
- Are retries, timeouts, cancellation, and idempotency defined?
- Are partial failure and recovery defined?

### Data

- Are schemas versioned?
- Is data ownership explicit?
- Are units, enumerations, and identity rules canonical?
- Are provenance, retention, and migration defined?
- Are secrets references only?

### Runtime

- Is the deployable allocation justified?
- Are startup, shutdown, health, and cleanup defined?
- Are configuration and compatibility limits defined?
- Are resources and concurrency controlled?

### Verification

- Does each acceptance case trace to a use case or module rule?
- Are success, alternate, failure, and recovery behaviors covered?
- Are external failures testable?
- Are required commands known?
- Is required evidence defined?

### Approval

- Are all material questions closed?
- Did sources change during review?
- Did the impact result identify every affected record?
- Is the approver authorized?
- Does the approval identify the exact revision and hash?

---

## Appendix B — Module handoff file set

A standard external-agent handoff should contain:

```text
module-handoff/
  README.md
  packet.json
  module-design.json
  architecture-slice.json
  contracts/
  schemas/
  context-manifest.json
  repository-context.md
  acceptance-cases.json
  required-evidence.json
  return-schema.json
```

`README.md` shall state:

- target module;
- allowed result;
- forbidden changes;
- ordered work;
- commands to run;
- how to return the delta;
- when to stop and request a new decision.

---

## Appendix C — Required user-facing labels

| Use | Do not use |
| --- | --- |
| Define the work | Shape the product |
| Check the use-case draft | Check generated intent |
| System design | Solution map |
| Design modules | Decompose capabilities |
| Module design | Capability elaboration |
| Required question | Material uncertainty |
| Review contracts | Reconcile interfaces |
| Create Copilot handoff | Dispatch implementation context |
| Inspect returned changes | Reconcile overlay |
| Apply reviewed changes | Materialize delta |
| Old | Freshness invalid |
| Waiting for dependency | Dependency-gated |
| Run module checks | Execute verification suite |
| Ready to connect | Integration eligible |

Keep exact technical terms when the system meaning requires them. Examples are
port, adapter, hash, revision, idempotency key, UML, schema, and contract.
