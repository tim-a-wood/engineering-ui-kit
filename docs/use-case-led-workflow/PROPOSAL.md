# Plan from use cases

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
> use cases → review the system design → approve the design

The tool prepares the records. The user makes each decision that affects scope,
safety, policy, ownership, or cost.

## 1. What changes for the user

### 1.1 Plan defines the work

The first screen asks one question:

> What work must users do?

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

### 1.3 Build, Connect, and Verify keep their current purpose

Build uses the approved use cases and architecture. It creates module plans in
dependency order.

Connect uses the approved ports and adapters. It connects real entry points and
external systems.

Verify links each approved use case to test evidence. It also checks failure and
recovery behavior.

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
- one action: **Create use-case draft**.

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
- sources.

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
  rules: string[];
  inputs: string[];
  outputs: string[];
  acceptanceChecks: string[];
  priority: "main" | "supporting";
  sourceRefs: string[];
};
```

Use stable IDs. A small wording change must not create a new ID.

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
- approve a design;
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
- Add architecture approval.

### Phase 5: Add the machine API

- Expose the same application operations.
- Add idempotency, stale-revision checks, and structured errors.
- Add cancellation and deadlines.

### Phase 6: Use approved data in later stages

- Add use cases to module plans.
- Add user tasks to interface briefs.
- Add ports and adapters to Connect.
- Add acceptance checks to Verify.
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
- migration;
- idempotent machine calls;
- keyboard use;
- screen readers;
- narrow screens;
- loss of provider access;
- loss of MATLAB;
- failed import and last-valid recovery.

Use end-to-end tests for:

1. a new project with one description;
2. an existing project with current approvals;
3. an imported application record;
4. a required permission decision;
5. a module split;
6. a source change after approval;
7. a failed MATLAB import;
8. a repeatable audit-package export;
9. the default sample project;
10. an LLM client that uses the machine API.

## 14. Success measures

Test medium projects with product experts, architects, interface engineers,
integration engineers, returning users, and LLM clients.

Targets:

- no required form field before the first draft;
- no more than five user questions before review;
- all main use cases have an architecture path;
- no repeated project input between stages;
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

## 16. Completion criteria

The work is complete when:

- Plan can create an approved `UseCaseAnalysis`;
- the converter creates the current `ApplicationSpecification`;
- Design creates an editable system design;
- every main use case has a complete system path;
- every external system has a named port and adapter;
- each module has a clear purpose;
- user changes survive a new design draft;
- approvals use revisions and hashes;
- existing projects migrate without losing approvals;
- the sample Audit Hub opens when no project is configured;
- Evidence Explorer has one view for each lifecycle phase;
- human users and LLM clients can complete the same workflow;
- the workflow meets the success targets.
