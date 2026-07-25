# Plan from use cases

This proposal states the product direction and reasons. The
[`SPECIFICATION.md`](./SPECIFICATION.md) document defines the complete product,
record, module-by-module, Copilot handoff, validation, and test requirements.

## Decision

Add use-case analysis to the current Plan stage.

Keep the five current stages:

1. Plan
2. Design
3. Build
4. Connect
5. Verify

Do not replace the current `ApplicationSpecification` or
`ArchitectureSpecification`. These records already support approval, hashing,
build planning, connections, and verification.

Add a new `UseCaseAnalysis` record before the
`ApplicationSpecification`. Convert the approved analysis to the current
application record. Then create a system design from that application record.

The user workflow becomes:

> Describe the work → review the use cases → answer open questions → approve the
> use cases → review the system structure → design and approve modules one at a
> time → approve the complete design

The tool prepares the records. The user makes each decision that affects scope,
safety, policy, ownership, or cost.

Keep system design and module design as separate levels. The system design
shows the complete structure. A module design defines one module in enough
detail to build and verify it.

Create one Copilot or external-agent handoff for one module by default. The
tool can calculate implementation waves, but it must not require one agent to
design or build the full application in one pass.

## 1. What changes for the user

### 1.1 Plan defines the work

The first screen asks one question:

> Describe the user tasks.

The user can write a short description. Examples and limits are optional.

The user also selects which sources the tool can read. Sources can include:

- the project description;
- repository files;
- approved capability records;
- imported documents;
- requirements and design files;
- test data;
- review records.

The tool does not change a selected source.

The tool creates a draft that contains:

- users and their tasks;
- main use cases;
- other valid paths;
- failure and recovery behavior;
- business and safety rules;
- external systems;
- data inputs and outputs;
- quality requirements;
- acceptance checks;
- source links;
- open questions.

The user reviews this draft. The user does not enter record IDs, schemas,
modules, ports, or adapters.

### 1.2 Design defines the system

Design starts after the user approves the use cases.

The tool creates a system design. The design contains:

- user-interface modules;
- workflow modules;
- core data and rule modules;
- ports;
- adapters;
- shared services;
- dependencies;
- deployable units;
- a reason for each module;
- a complete system path for each main use case.

The user can rename, merge, split, or move a module. The tool shows the effect
before it applies the change. The tool saves the approved change as a design
decision.

After the user approves the system structure, the tool creates a module-design
queue. The user can define, review, approve, hand off, build, and verify one
module at a time. The design view continues to show the complete architecture
and the state of every module.

### 1.3 Build and Connect keep their current purpose; Verify becomes scenario-led

Build uses the approved use cases and architecture. It creates module plans in
dependency order.

In the default gate mode, Build starts after the complete Design baseline is
approved. A project can explicitly use incremental mode and start Build with
one approved, dependency-closed module. Neither mode needs one Copilot pass for
every module. Each module handoff contains the approved module design, direct
contracts, repository paths, acceptance cases, commands, and expected return
format.

Connect uses the approved ports and adapters. It connects real entry points and
external systems.

Verify converts each approved use-case scenario into an automated end-to-end
test. A scenario is the main path, an approved other path, a failure path, or a
recovery path. The test follows the approved steps through real entry points
and connected adapters.

Each test step records its expected result and its actual result. It also
records screenshot evidence when the step has a visible result. A background,
API, file, or data-only step records structured evidence and states why a
screenshot does not apply.

Verify is complete only when every approved scenario has a current automated
result. The result points to the use case, scenario, application revision,
architecture revision, build, environment, test data, and evidence files.

The user does not enter the same project facts again in later stages.

## 2. Writing and label rules

Use the same term for the same item on every screen.

Use these user-facing terms:

| Use this term | Do not use this term |
| --- | --- |
| Define the work | Shape the product |
| Use-case draft | Product story |
| Main use case | Critical story |
| Open question | Material uncertainty |
| Required decision | Needs your input |
| System design | Solution map |
| Change a module | Restructure the proposal |
| User interface | Experience |
| Workflow | Coordinator |
| Core data and rules | Core knowledge |
| External system | External actor or connection |
| Shared service | Foundation |
| Source link | Provenance |
| Acceptance check | Proof |
| Current record | Canonical truth |

Keep a technical name when it has an exact system meaning. Examples include
`ApplicationSpecification`, `ArchitectureSpecification`, port, adapter, hash,
and idempotency key.

Put the actor before the action:

- “The tool creates the draft.”
- “The user approves the record.”
- “The adapter reads the file.”

Use one instruction in each sentence. Do not use a metaphor as a control label.

## 3. Guided Plan

Guided Plan has three views.

### 3.1 Describe

The Describe view contains:

- one text area for the required work;
- buttons to add an example or prohibited result;
- a list of selected sources;
- a clear statement that the sources are read-only;
- one action: **Create draft**.

The tool can start when the user enters one description. It must not require a
form before it creates the first draft.

If source access fails, show the source name and the cause. Do not discard a
valid earlier draft.

### 3.2 Review

The Review view shows:

- the purpose of the application;
- users and their tasks;
- the main use cases;
- the status of the draft;
- required decisions;
- assumptions;
- source links.

Each use case can expand to show:

- main flow;
- other valid paths;
- failure;
- recovery;
- rules;
- acceptance checks;
- sources;
- test scenarios.

Guided mode hides record IDs and hashes. Design mode shows them. Both modes
read and change the same records.

The status panel must use counts. It must not use a percentage without an
explanation. For example:

- 4 of 4 user roles defined;
- 6 of 6 main use cases have acceptance checks;
- 8 of 8 external systems named;
- 5 of 6 use cases have recovery behavior;
- 1 required decision is open.

### 3.3 Approve

Approval is available only when:

- every main use case has an actor and a result;
- every main use case has an acceptance check;
- every external system has a named role;
- every blocking conflict is resolved;
- every required decision has an answer.

The approval record contains:

- the record ID;
- the revision;
- the content hash;
- the approver;
- the approval time;
- the source hashes;
- the open nonblocking assumptions.

The tool can create a draft. Only an authorized user can approve it.

## 4. System Design

### 4.1 Start with the simplest design

Start with one application.

Add a process or service only when a requirement makes it necessary. Valid
reasons include:

- a separate runtime;
- a separate trust boundary;
- a separate owner;
- independent scale;
- independent release timing;
- fault isolation;
- legal or safety separation.

Do not create a service only because a noun appears in a use case.

### 4.2 Design groups

Show modules in five groups.

| Group | Purpose |
| --- | --- |
| User interfaces | Support separate user tasks or channels |
| Workflows | Control tasks that use several modules |
| Core data and rules | Apply rules that do not depend on a source technology |
| External systems | Connect a specific source or remote system |
| Shared services | Store data and report job status |

Each module must show:

- its purpose;
- the use cases that use it;
- its operations;
- its dependencies;
- its ports;
- its adapter, when applicable;
- the reason that it is separate.

### 4.3 Ports and adapters

A port states what the application needs. It must not name a vendor or file
format.

Examples:

- `RequirementsSourcePort`
- `DesignSourcePort`
- `TraceSourcePort`
- `TestEvidenceSourcePort`
- `ReviewEvidenceSourcePort`
- `RevisionSourcePort`
- `EvidenceStorePort`

An adapter connects one port to one technology or source type.

Examples:

- MATLAB and Simulink adapter;
- file-system adapter;
- Git adapter;
- spreadsheet adapter;
- C and header source adapter;
- coverage adapter;
- review-evidence adapter;
- DO-178C objective-profile adapter.

Do not make one general “engineering data adapter.” Each source type has
different file rules, failure modes, version data, and runtime needs.

The MATLAB and Simulink adapter can run in a separate process. This process
contains MATLAB startup, license use, proprietary file readers, timeouts, and
crashes. The rest of the application does not depend on MATLAB APIs.

### 4.4 Use-case paths

The user can select a main use case. The design view then highlights every
module in that use case path.

A complete path starts at an entry point and ends at an output or stored state.
It includes each workflow, core module, port, adapter, and store used by the
case.

The design cannot be approved if a main use case has no complete path.

### 4.5 Module changes

The user can:

- rename a module;
- change its purpose;
- split it;
- merge it;
- move an operation;
- change its group;
- change a dependency.

Before the change, show:

- affected use cases;
- affected operations;
- added or removed dependencies;
- new design errors;
- migration work.

Save the approved change as a `DesignDecision`. When the tool creates a new
design draft, apply each compatible decision again. Show a conflict when a
decision is no longer compatible.

### 4.6 UML diagrams in Design

Keep all design diagrams in the Design step. Do not put design diagrams in
Verify. Verify shows test results and links back to the approved Design record.

Keep the architecture canvas as the main system view. A user selects a module,
port, adapter, stateful record, or use case and opens its UML detail. The detail
offers these diagrams:

| Diagram | What it shows |
| --- | --- |
| Component | components, provided interfaces, required interfaces, and dependencies |
| Activity | actions, control flows, decisions, guards, and final nodes |
| State machine | states, pseudostates, transitions, triggers, guards, and effects |
| Sequence | lifelines, calls, replies, and combined fragments |
| Use case | actors, use cases, system boundaries, associations, includes, and extensions |

Generate each diagram from the approved use-case and system-design records.
Do not keep a second hand-edited model. A diagram is a view of the approved
record, not a separate source of truth.

Make each meaningful visual element selectable. This includes actors, use
cases, components, interfaces, actions, states, pseudostates, lifelines,
messages, guards, and relationships. Selection opens a small modal with:

- the element type and stable ID;
- its definition and source record;
- trace links;
- connected elements;
- **Discuss with agent**;
- **Propose change**.

Also provide a text list or table with the same information. Keyboard and
screen-reader users must be able to follow the same relationships.

### 4.7 UML 2.5.1 notation rules

Support a defined UML 2.5.1 notation subset. Do not claim support for UML
constructs that the tool does not render or validate.

Use the [OMG Unified Modeling Language 2.5.1 specification](https://www.omg.org/spec/UML/2.5.1/PDF)
as the normative source.

Apply these rules:

- show a component with the `«component»` keyword or component icon;
- show provided and required interfaces with the correct interface notation;
- show dependencies as dashed directed relationships;
- show an activity initial node as a filled circle;
- show an activity final node and a state final state as a bullseye;
- show decisions and merges as diamonds;
- write activity guards in square brackets;
- write state transitions as `trigger [guard] / effect` when these parts exist;
- order sequence messages from top to bottom;
- use a solid line for a call and a dashed line for a reply;
- label combined fragments such as `alt` and show their guards;
- keep actors outside the use-case system boundary;
- show use cases as ellipses inside the system boundary;
- label include and extend relationships with `«include»` and `«extend»`;
- keep labels clear of nodes and relationship lines;
- keep relationship crossings to the minimum practical number.

Validate the supported notation before Design approval. Store the diagram type,
element type, relationship type, source record, and stable element ID. This
data lets the renderer check semantics without reading pixels.

### 4.8 Discuss and change a visual element

The Design modal supports this controlled workflow:

1. The user selects a visual element.
2. The modal shows its record, traces, and relationships.
3. The user discusses the element with the agent.
4. The user describes a proposed result.
5. The tool runs an impact analysis before it changes data.
6. The tool shows the affected use cases, requirements, modules, operations,
   ports, adapters, diagrams, automated scenarios, screenshot expectations,
   approvals, and baselines.
7. The user revises the proposal or approves the change plan.
8. The agent updates the canonical records, code, tests, and diagrams named in
   the approved plan.
9. The tool runs Design checks and affected end-to-end tests.
10. The tool asks for Design approval again.

Do not apply a diagram-only edit. Every approved change must update the
canonical record first. Preserve the last approved revision until the new
revision passes its checks and the user approves it.

### 4.9 Design modules one at a time

Approval of the system structure creates a module-design queue. The queue
shows every allocated module and one of these states:

- not started;
- draft;
- needs input;
- ready for review;
- approved;
- old;
- blocked.

The user selects one module. The workspace keeps the selected module beside its
direct dependencies, direct consumers, use-case paths, contracts, and UML
detail.

Each module-design session contains:

1. review the boundary;
2. define behavior;
3. define contracts;
4. review diagrams;
5. run checks;
6. approve the module.

The module record contains the common boundary, behavior, data, runtime, and
verification fields. It also contains type-specific fields:

- user-interface state, interaction, accessibility, and responsive behavior;
- workflow steps, decisions, transactions, retries, and recovery;
- core vocabulary, invariants, calculations, and identity rules;
- adapter formats, mappings, timeouts, failures, isolation, and fixtures;
- shared-service consistency, retention, recovery, capacity, and health.

Approval of one module does not approve another module. In incremental mode, a
module can enter Build when its design and required contracts are approved and
its dependency slice is complete. In the default complete-baseline mode, the
handoff waits until every required module design is approved.

The product creates one Copilot handoff for one module by default. The handoff
contains the approved module design, the direct architecture slice, contracts,
schemas, owned paths, repository context, acceptance cases, commands, and
return format. It does not give Copilot authority to change the architecture or
approve a record.

The product can show dependency waves. It sends several modules in one handoff
only when the user selects them, their paths do not overlap, and their
dependencies and resources are independent.

See the [product and implementation specification](./SPECIFICATION.md) for the
complete module record, state model, gates, Copilot round trip, application
operations, migration, and tests.

## 5. Data model

The `UseCaseAnalysis` is a versioned record. It does not replace an approved
application or architecture record.

```ts
type UseCaseAnalysis = {
  schemaVersion: string;
  id: string;
  revision: number;
  state: "draft" | "approved" | "superseded";
  purpose: AnalysisItem<string>;
  users: UserRole[];
  useCases: UseCase[];
  externalSystems: ExternalSystem[];
  dataItems: DataItem[];
  qualityRequirements: QualityRequirement[];
  assumptions: Assumption[];
  conflicts: Conflict[];
  sourceRefs: SourceRef[];
  gates: GateResult[];
  approval?: Approval;
};
```

Add one versioned design record for each module:

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
    | "superseded";
  architecture: {
    id: string;
    revision: string;
    contentHash: string;
  };
  module: {
    moduleId: string;
    moduleVersion: string;
    moduleType: ModuleType;
    name: string;
    responsibility: string;
    nonResponsibilities: string[];
  };
  trace: ModuleTrace;
  boundary: ModuleBoundary;
  providedOperations: OperationContractRef[];
  requiredOperations: RequiredOperationRef[];
  schemas: ModuleSchemaRef[];
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

Compile an approved module design to the existing `ModuleManifest`,
`OperationContract`, and `ModuleImplementationSpecification` records. Keep the
compiler pure and repeatable. Do not make a Copilot response a canonical
record.

Each generated item uses the same control fields:

```ts
type AnalysisItem<T> = {
  id: string;
  value: T;
  status: "sourced" | "inferred" | "confirmed" | "changed" | "conflict";
  confidence?: number;
  sourceRefs: string[];
  reason?: string;
};
```

Use confidence only to set review order. Confidence is not approval and is not
evidence.

Design diagrams use projection records:

```ts
type DiagramProjection = {
  id: string;
  type: "component" | "activity" | "stateMachine" | "sequence" | "useCase";
  umlVersion: "2.5.1";
  sourceRevision: number;
  elementIds: string[];
  relationshipIds: string[];
  validation: DiagramValidationResult[];
};

type DiagramElement = {
  id: string;
  umlType: string;
  label: string;
  sourceRecordId: string;
  traceIds: string[];
};

type DiagramRelationship = {
  id: string;
  umlType: string;
  sourceElementId: string;
  targetElementId: string;
  label?: string;
  guard?: string;
};
```

The diagram renderer reads these projections. A proposed change does not write
to a projection. It creates a controlled request:

```ts
type VisualChangeProposal = {
  id: string;
  diagramElementId: string;
  requestedResult: string;
  baseDesignRevision: number;
  impact: ChangeImpact;
  state: "draft" | "analyzed" | "approved" | "applied" | "rejected";
};

type ChangeImpact = {
  useCaseIds: string[];
  requirementIds: string[];
  moduleIds: string[];
  operationIds: string[];
  portIds: string[];
  adapterIds: string[];
  diagramIds: string[];
  scenarioIds: string[];
  screenshotExpectationIds: string[];
  approvalIds: string[];
  baselineIds: string[];
  requiredChanges: RequiredAgentChange[];
};
```

A use case contains:

```ts
type UseCase = {
  id: string;
  name: string;
  actorIds: string[];
  trigger: string;
  preconditions: string[];
  mainFlow: UseCaseStep[];
  otherPaths: UseCasePath[];
  failures: UseCaseFailure[];
  recovery: UseCaseStep[];
  scenarios: UseCaseScenario[];
  rules: string[];
  inputs: string[];
  outputs: string[];
  acceptanceChecks: string[];
  priority: "main" | "supporting";
  sourceRefs: string[];
};
```

Use stable IDs. A small wording change must not create a new ID.

Each approved path becomes an explicit scenario:

```ts
type UseCaseScenario = {
  id: string;
  useCaseId: string;
  name: string;
  kind: "main" | "alternate" | "failure" | "recovery";
  preconditions: string[];
  steps: ScenarioStep[];
  expectedResult: string;
  automation?: ScenarioAutomation;
};

type ScenarioStep = {
  id: string;
  actorId: string;
  action: string;
  expectedResult: string;
  evidence: "screenshot" | "structured" | "none";
  noScreenshotReason?: string;
};

type ScenarioAutomation = {
  id: string;
  runner: string;
  testRef: string;
  fixtureRefs: string[];
  resourceLocks: string[];
};

type ScenarioRun = {
  id: string;
  scenarioId: string;
  applicationRevision: number;
  architectureRevision: number;
  buildId: string;
  environmentId: string;
  testDataRevision: string;
  sourceRevision: string;
  status: "passed" | "failed" | "skipped" | "cancelled";
  startedAt: string;
  completedAt: string;
  steps: ScenarioStepResult[];
};

type ScenarioStepResult = {
  stepId: string;
  status: "passed" | "failed" | "skipped";
  actualResult: string;
  startedAt: string;
  completedAt: string;
  evidenceRefs: EvidenceRef[];
};

type EvidenceRef = {
  id: string;
  kind: "screenshot" | "structured";
  contentHash: string;
  originalFile: string;
  previewFile?: string;
  metadata: Record<string, string>;
};
```

The tool creates stable scenario and step IDs. Test code and evidence refer to
these IDs. Rewording a label does not break the link.

## 6. Conversion to current records

Use a pure converter:

```ts
compileApplication(
  analysis: UseCaseAnalysis,
  options: CompileOptions
): ApplicationSpecification
```

The same approved analysis and options must produce the same application
record.

The converter:

1. copies the approved purpose;
2. creates application tasks from the approved use cases;
3. copies inputs, outputs, rules, and quality requirements;
4. includes source links;
5. uses stable IDs;
6. sorts unordered data before hashing;
7. returns errors for missing required data;
8. does not approve the result.

Store the source analysis ID, revision, and hash in the generated application
record. This link supports review and change analysis.

Keep the current application compiler during migration. Existing projects can
continue to use the current path.

## 7. Required checks

### 7.1 Plan checks

Block use-case approval when:

- a main use case has no actor;
- a main use case has no result;
- a main use case has no acceptance check;
- a required external system has no role;
- a safety or permission conflict is open;
- a source changed after the last analysis;
- a required source failed to load.

Show warnings, but do not block approval, when:

- a supporting use case has no recovery step;
- confidence is low;
- an assumption is still open;
- an optional source is missing.

### 7.2 Design checks

Block design approval when:

- a main use case has no complete path;
- a module has no purpose;
- an operation has no owner;
- an external system has no port and adapter;
- a dependency cycle exists;
- a deployable unit has no entry point;
- a required design decision has a conflict.

Show the exact item that caused each error. Provide a direct link to it.

### 7.3 Verify checks

Block verification when:

- an approved scenario has no automated end-to-end test;
- a scenario test has not run against the current approved build;
- a scenario test failed;
- an applicable visible step has no screenshot;
- a nonvisual step has neither structured evidence nor a reason;
- evidence does not identify its scenario and step;
- a required failure or recovery scenario was skipped;
- the test data, environment, or source revision is unknown.

Show warnings, but do not block verification, when:

- an optional browser or viewport was not run;
- a screenshot differs only in an approved dynamic region;
- extra exploratory evidence has no approved scenario link.

The Verify summary uses counts. It shows use cases, scenarios, steps,
screenshots, structured evidence items, failures, and skipped items. It does not
use one unexplained percentage.

## 8. Application structure

Use ports and adapters.

The core application layer owns:

- analysis records;
- use-case rules;
- conversion;
- design generation;
- design checks;
- approvals;
- decision replay;
- migration;
- hashing.

The core layer does not import Electron, React, MATLAB, file-system, Git,
database, or model-provider libraries.

Inbound ports include:

- create an analysis;
- update an analysis item;
- answer a required question;
- approve an analysis;
- create a design;
- apply a design decision;
- approve the system structure;
- start a module design;
- update a module design item;
- approve one module design;
- reopen one module design;
- create one module implementation handoff;
- inspect and apply one returned change;
- verify one module;
- approve the complete design;
- get current status;
- get valid next actions.

Outbound ports include:

- read project sources;
- call an analysis provider;
- load and save records;
- read time;
- create hashes;
- write audit events;
- run jobs;
- read secrets.

Adapters implement these ports for the desktop app, command line, HTTP API,
test harness, source systems, storage, and analysis providers.

## 9. Human and machine access

The interface and the machine API use the same application operations.

The machine API must:

- accept an idempotency key for each change;
- return the current revision and hash;
- list valid next actions;
- return structured check results;
- require explicit approval calls;
- reject stale revisions;
- support cancellation and deadlines;
- avoid screen scraping.

Do not add a hidden operation that only an LLM can use.

## 10. DO-178C Audit Hub example

### 10.1 Default sample project

Open a detailed sample project when the user has not configured a project.

Label the project **Sample DO-178C Audit Hub**. Make it clear that the data is
not from a real program.

The sample contains:

- a project and certification basis;
- software levels and objective profiles;
- planning records;
- high-level and low-level requirements;
- Simulink design models;
- C and header source files;
- tests and results;
- structural coverage;
- review records;
- configuration records;
- trace links;
- findings;
- baselines;
- two audit packages;
- known gaps and one failed refresh.

Use realistic file names and revisions. Include good data and defective data.
The user must be able to test filters, gaps, findings, recovery, and export.

### 10.2 Evidence Explorer views

Evidence Explorer has one view for each lifecycle phase:

1. Planning
2. Requirements
3. Design
4. Code
5. Verification
6. Quality assurance
7. Configuration management
8. Certification

Each phase view shows:

- applicable objectives;
- expected evidence;
- available evidence;
- review status;
- trace status;
- findings;
- source files;
- revision and baseline;
- responsible role;
- next action.

Use the same filter names and status colors in every phase view.

### 10.3 Source adapters

Use these adapters in the sample:

| Adapter | Example input |
| --- | --- |
| MATLAB and Simulink | `.slx`, `.sldd`, `.slreqx`, `.slmx`, `.sldatx` |
| File system | project folders and evidence files |
| Git | commit, tag, branch, and dirty state |
| Spreadsheet | `.xlsx` and `.csv` test or review data |
| C and header source | `.c` and `.h` symbols and links |
| Coverage | LCOV, XML, and JSON coverage data |
| Review evidence | checklists, comments, approvals, and findings |
| Objective profile | project-owned DO-178C objectives and tailoring |

The application reads source data into an evidence snapshot. A failed import
does not replace the last valid snapshot.

### 10.4 Recommended design

Use one desktop application and one separate MATLAB process.

Recommended modules:

- Audit Workspace;
- Lifecycle Explorer;
- Import and Publish;
- Finding Review;
- Package Export;
- Evidence Graph;
- Workspace Snapshots;
- one adapter for each source type;
- Evidence Store;
- Job and Package Store.

This design supports local source access and one-team ownership. No current use
case requires independent network services.

### 10.5 Sample verification evidence

The default sample includes automated end-to-end evidence for every approved
scenario. At minimum, include:

- readiness with complete evidence;
- readiness with a missing objective record;
- lifecycle browsing by phase;
- first-gap trace navigation;
- independent finding approval;
- rejection when the reviewer is not independent;
- a successful evidence refresh;
- a failed source refresh that keeps the last valid snapshot;
- a MATLAB timeout and recovery;
- a repeatable package export;
- a second export that proves byte-for-byte repeatability.

Each scenario contains realistic steps, results, timings, test data, and
evidence links. Visible steps include sample screenshots. Background import,
hash, file, and API checks use structured evidence and explain why a screenshot
does not apply.

## 11. Migration

Use an opt-in project flag for the first release.

For an existing project:

1. keep the current approval;
2. create a draft analysis from the current application record;
3. mark each imported item as sourced;
4. show all missing use-case data;
5. let the user review and approve the new analysis;
6. create a new application revision;
7. keep the old revision for audit.

Do not invalidate an existing approval only because the new feature is
available.

If a source changes, mark the dependent analysis and design records as old.
Show the changed source and affected records. Do not change an approval without
a new user action.

## 12. Delivery plan

### Phase 0: Measure and test labels

- Measure the current Plan and Design workflow.
- Record time, error rate, questions, and abandoned tasks.
- Test the new labels with human users and LLM clients.

### Phase 1: Add the record and converter

- Add `UseCaseAnalysis`.
- Add stable IDs and hashes.
- Add source links and required checks.
- Add the pure application converter.
- Add migration tests.

This phase does not change the interface.

### Phase 2: Add Guided Plan

- Add Describe, Review, and Approve.
- Add source selection.
- Add required decisions.
- Add the technical-record switch.
- Add keyboard and screen-reader tests.

### Phase 3: Add analysis providers

- Keep the current Copilot handoff.
- Add an in-app provider adapter.
- Add a fixed provider for repeatable tests.
- Enforce source limits and redaction.

### Phase 4: Add the design editor

- Create the system design draft.
- Show use-case paths.
- Show reasons for modules.
- Add design options.
- Add module changes and decision replay.
- Add separate system-structure approval.
- Add `ModuleDesignSpecification`.
- Add the module-design queue, states, filters, and resume behavior.
- Add the six-step module-design workspace.
- Add type-specific module detail.
- Add separate module approval.
- Add contract compatibility and owned-path checks.
- Add UML 2.5.1 component, activity, state machine, sequence, and use-case
  detail diagrams.
- Make each UML element selectable.
- Add agent discussion, change proposals, impact analysis, and approved change
  plans to the visual-element modal.
- Add architecture approval.

### Phase 5: Add the machine API

- Expose the same application operations.
- Add one-module design and implementation packets.
- Add deterministic context manifests.
- Validate returned paths, revisions, hashes, and delta manifests.
- Add transactional apply and rollback.
- Calculate dependency waves without automatic dispatch.
- Add idempotency, stale-revision checks, and structured errors.
- Add cancellation and deadlines.

### Phase 6: Use approved data in later stages

- Add use cases to module plans.
- Add user tasks to interface briefs.
- Compile approved module designs to current manifests, operation contracts,
  and implementation specifications.
- Keep one module as the default Copilot implementation target.
- Support several handoff passes for one module.
- Add ports and adapters to Connect.
- Generate one automated end-to-end test for every approved scenario.
- Capture screenshot evidence for each applicable visible step.
- Record structured evidence for nonvisual steps.
- Add scenario, step, build, environment, and evidence links to Verify.
- Add links from Verify records back to their approved Design records.
- Add source links to change reports.

### Phase 7: Release

- Enable the workflow per project.
- Review migration evidence.
- Run user tests.
- Remove the old Guided screens only after the new workflow meets the targets.

## 13. Tests

Add tests for:

- schema validation;
- stable IDs;
- repeatable conversion;
- hashing;
- source links;
- required checks;
- stale-source detection;
- design generation;
- dependency cycles;
- missing operation owners;
- missing adapters;
- use-case path coverage;
- decision replay;
- module-design state transitions;
- separate module approval;
- type-specific module fields;
- operation contract compatibility;
- owned-path conflicts;
- deterministic one-module context manifests;
- incomplete Copilot response recovery;
- stale Copilot response rejection;
- returned-delta path enforcement;
- transactional apply and rollback;
- dependency-wave calculation;
- explicit multi-module eligibility;
- supported UML 2.5.1 notation semantics;
- selectable UML elements and keyboard access;
- visual-element detail modals;
- change impact completeness;
- required agent change plans;
- diagram layout crossings, label overlap, and node collisions;
- migration;
- idempotent machine calls;
- keyboard use;
- screen readers;
- narrow screens;
- loss of provider access;
- loss of MATLAB;
- failed import and last-valid recovery.

### 13.1 Product tests

Use end-to-end product tests for:

1. a new project with one description;
2. an existing project with current approvals;
3. an imported application record;
4. a required permission decision;
5. a module split;
6. a source change after approval;
7. a failed MATLAB import;
8. a repeatable audit-package export;
9. the default sample project;
10. an LLM client that uses the machine API;
11. a UML element discussion;
12. a proposed visual change with impact analysis;
13. an approved change plan that updates records, diagrams, and affected tests;
14. a check that Verify contains no design diagram;
15. a system structure with 17 incomplete module designs;
16. approval of one module while other modules remain incomplete;
17. one module implemented through several Copilot passes;
18. rejection of an out-of-scope returned file;
19. incremental Build for an approved dependency-closed module;
20. explicit selection of independent modules for a wave handoff.

### 13.2 Generated use-case scenario tests

For each approved use case, generate and run an automated end-to-end test for:

1. the main scenario;
2. each approved alternate scenario;
3. each approved failure scenario;
4. each approved recovery scenario.

Do not infer scenario coverage from code coverage. Trace every test to one
scenario ID. Trace every test action and check to one step ID.

For each step:

- record the action;
- record the expected result;
- record the actual result;
- record the start time, end time, and outcome;
- capture a screenshot when the result is visible;
- record structured output for API, file, worker, hash, or data checks;
- record a reason when a screenshot does not apply.

Store screenshots at their original resolution. Also create a small preview for
the evidence list. Record the viewport, browser, operating system, theme,
locale, build, environment, and test-data revision when they can affect the
image.

Allow masks only for approved dynamic regions, such as clocks or generated run
IDs. Record every mask. Never replace the original screenshot with the masked
comparison image.

Keep the evidence immutable. A rerun creates a new result. It does not overwrite
the earlier result.

The test runner can run scenarios in parallel only when their fixtures and
external systems are isolated. A scenario that uses shared MATLAB, file-system,
license, or baseline state declares the resource that prevents unsafe parallel
execution.

### 13.3 Evidence review

The Verify detail view shows:

- the approved use case and scenario;
- the automated test and run;
- each step and outcome;
- screenshot or structured evidence for each step;
- reasons for steps without screenshots;
- the build, environment, test data, and source revisions;
- failure output and the first failed step;
- a link back to the approved Design record.

A reviewer can compare runs, open the original evidence, and follow the link
back to the approved scenario and system design. Verify does not contain design
diagrams.

## 14. Success measures

Test medium projects with product experts, architects, interface engineers,
integration engineers, returning users, and LLM clients.

Targets:

- no required form field before the first draft;
- no more than five user questions before review;
- all main use cases have an architecture path;
- all approved scenarios have an automated end-to-end result;
- all applicable visible steps have screenshot evidence;
- all nonvisual steps have structured evidence or a recorded reason;
- no repeated project input between stages;
- a user can stop and resume one module design at the same step;
- one module can be approved without false completion of the other modules;
- the default Copilot handoff contains one module and its direct context;
- a second Copilot pass can continue from the applied module revision;
- no returned file outside approved paths can be applied;
- a user can identify each required decision in less than 30 seconds;
- a user can state why a selected module exists;
- a user can find the first failed source in less than one minute;
- the same approved input produces the same generated records;
- every approval has a revision, hash, source set, user, and time;
- an LLM completes the workflow without reading screen markup.

Compare the results with the Phase 0 measurements.

## 15. Risks and controls

| Risk | Control |
| --- | --- |
| The draft looks correct but contains a wrong assumption | Show sources and assumptions. Require approval. |
| Users trust a confidence score | Use confidence only to order review. |
| The tool creates too many services | Start with one application. Require a reason for each split. |
| A new draft removes a user change | Save and reapply design decisions. Show conflicts. |
| An import changes approved evidence | Use read-only source adapters and immutable snapshots. |
| A failed refresh hides valid evidence | Keep the last valid snapshot. |
| Migration invalidates an approval | Keep the old approval until a user approves a new revision. |
| Human and LLM workflows differ | Use the same application operations and checks. |
| Technical terms make screens hard to read | Hide IDs and hashes in Guided mode. Use the approved label table. |
| A passing summary hides an untested scenario | Count approved scenarios and automated results separately. |
| Screenshot evidence is missing or misleading | Require step links, preserve originals, and record approved masks. |
| Diagrams contradict the approved records | Generate UML detail diagrams from the approved use-case and architecture records. Apply changes to canonical records first. |
| A visual edit has an unknown effect | Run impact analysis before the agent changes a record. Show affected use cases, modules, interfaces, tests, approvals, and baselines. |
| One Copilot pass is too large | Use one module per handoff by default. Support several short passes and persistent module state. |
| A module is built from incomplete contracts | Require module and direct contract approval before its handoff. |
| Batch work changes the same file twice | Check owned paths and shared resources before a multi-module handoff. |
| A returned change expands scope | Reject paths and record changes outside the approved packet. |
| A stale agent response overwrites current work | Check the base revision and hash before inspection and apply. |
| A module approval implies complete Design | Show separate system, module, and complete-Design approvals with counts. |

## 16. Completion criteria

The work is complete when:

- Plan can create an approved `UseCaseAnalysis`;
- the converter creates the current `ApplicationSpecification`;
- Design creates an editable system design;
- Design has separate system-structure and module-design records;
- the module queue shows the state of every allocated module;
- the user can define and approve modules one at a time;
- a project can explicitly use incremental mode so that an approved,
  dependency-closed module can enter Build before unrelated modules are
  complete;
- the default Copilot design and implementation packets contain one module;
- a module can use several Copilot passes without losing its approved boundary;
- returned changes are checked against approved paths, records, revisions, and
  hashes;
- implementation apply is transactional and recoverable;
- implementation waves are visible but are not dispatched automatically;
- every main use case has a complete system path;
- every external system has a named port and adapter;
- each module has a clear purpose;
- user changes survive a new design draft;
- approvals use revisions and hashes;
- existing projects migrate without losing approvals;
- the sample Audit Hub opens when no project is configured;
- Evidence Explorer has one view for each lifecycle phase;
- every approved use-case scenario has a current automated end-to-end result;
- every applicable visible test step has screenshot evidence;
- every nonvisual test step has structured evidence or a recorded reason;
- UML 2.5.1 component, activity, state machine, sequence, and use-case diagrams
  are available only in Design detail views;
- every meaningful UML element opens a detail modal;
- the modal supports agent discussion and a proposed change;
- each proposed visual change produces an impact analysis and a required agent
  change plan before records change;
- the supported UML notation passes semantic and layout checks;
- human users and LLM clients can complete the same workflow;
- the workflow meets the success targets.
