# Capabilities: Product and Implementation Plan

Status: Draft for review
Working feature name: **Capabilities**
Product context: Extension of the existing Engineering UI Kit desktop application
Primary audience: Domain experts, including flight scientists, who specify and supervise software creation through Copilot without needing to write code

## 1. Executive summary

Capabilities will be a new top-level area in the existing application, at the same scope as **Build & Test**. It will help a domain expert turn an informal software need into a set of small, explicit, reusable, testable application capabilities. Copilot will conduct structured interviews, propose a reference-architecture-compliant module design, implement one bounded module or connection at a time, and return changes through the application's existing handoff, inspection, application, and verification workflow.

The domain expert remains the product designer and technical decision owner. Copilot is the software implementer. A deeper Design mode will expose contracts, module boundaries, files, endpoints, adapters, diagrams, logs, and verification evidence, but it will still be intended for the same domain expert rather than assuming a conventional software developer.

The system will be domain-neutral. Its contracts must be able to represent calculations, rules, workflows, persistence, visualization, files, and external tools without embedding any example domain into the product architecture. The MVP implements filesystem, MATLAB, and a bounded Azure DevOps adapter. Simulink, generic APIs, and remote execution remain contract-compatible deferred extensions.

The initial implementation must remain deliberately minimal:

- One reference architecture.
- One universal module manifest.
- One operation-contract format.
- One result and diagnostic model.
- One artifact model.
- One frontend-binding format.
- One local capability runtime.
- One dependency/freshness projection derived from persisted IDs, versions, and hashes.
- One bounded Copilot lifecycle for all module types.
- Initial adapters for filesystem, MATLAB, and Azure DevOps.
- No microservice generation, graph database, arbitrary deployment designer, general workflow engine, or plugin marketplace in the first release.

Extensibility will come from stable contracts and ports, not from implementing every possible subsystem in advance.

## 2. Product vision

The product should enable this outcome:

> A domain expert describes what an application must accomplish, confirms its workflows, rules, exceptions, examples, and boundaries, reviews a clear capability architecture, and has Copilot implement and verify each reusable module. The expert can then visually connect verified backend capabilities to frontend components in Preview without writing code or configuring endpoints.

The complete progression is:

```text
Informal need
→ structured interview
→ validated product specification
→ reference-architecture allocation
→ capability map
→ module interviews
→ implementation-ready module specifications
→ bounded Copilot handoffs
→ automated verification
→ visual frontend connections
→ integrated application preview
```

## 3. Product principles

### 3.1 Domain expert in control

The user approves:

- Purpose and scope.
- Actors and goals.
- Workflows and scenarios.
- Rules and constraints.
- Inputs, outputs, units, and validity limits.
- Exceptional outcomes.
- Worked examples.
- Capability boundaries.
- Dependencies and connections.
- Frontend mappings.
- Acceptance outcomes.

The user should not ordinarily need to author:

- Source code.
- HTTP clients.
- JSON schemas.
- Dependency injection.
- Runtime plumbing.
- Folder structures.
- Framework configuration.
- Serialization code.
- Internal helper functions.

### 3.2 Copilot as implementer

Copilot should act as:

- Interviewer.
- Ambiguity detector.
- Decomposition assistant.
- Domain-glossary curator.
- Architecture planner within supplied constraints.
- Contract and test generator.
- Module implementer.
- Connection implementer.
- Repair assistant when verification fails.

Copilot must not silently invent domain truth. Proposed rules, assumptions, and module allocations must remain visibly proposed until confirmed.

### 3.3 One model, progressive disclosure

The product must not create separate definitions for simple and advanced use. It will maintain one source of truth and provide two projections:

- **Guided mode:** goals, workflows, rules, examples, capabilities, tools, and connections in plain language.
- **Design mode:** module types, operation contracts, schemas, ports, adapters, endpoints, files, logs, architecture rules, and provenance.

The same domain expert may move between both modes. Design mode means deeper specification and supervision, not manual programming.

### 3.4 Convention over configuration

The product should generate the standard architecture automatically. Guided mode should ask users about intent and domain decisions rather than infrastructure mechanics.

### 3.5 Bounded implementation

Copilot should receive one capability, adapter, or connection at a time with explicit allowed scope, dependency contracts, acceptance examples, and exclusions.

### 3.6 Deterministic freshness

Copilot may propose semantic impact, but hashes, versions, dependency contracts, and verification provenance will determine whether a module is current.

## 4. Top-level application structure

Capabilities will be a new top-level page:

```text
Build & Test
Capabilities
Recipes
Components
Projects
Settings
```

Capabilities is added without removing the existing Recipes or Components library destinations.

Responsibilities:

- **Build & Test:** creates, applies, previews, and reviews frontend experiences.
- **Capabilities:** defines, implements, verifies, connects, and maintains backend/application capabilities.
- **Projects:** owns project roots, runtimes, launch configuration, and project-level settings.
- **Settings:** owns tool-wide preferences, integrations, and defaults.

Capabilities and Build & Test share the existing implementation lifecycle and safety mechanisms. Capabilities must extend, rather than duplicate, the existing external-Copilot file handoff, overlay inspection/application, and verification mechanisms:

```text
Define
→ generate Copilot packet
→ hand off
→ inspect returned overlay
→ apply
→ verify
→ review
→ iterate
```

## 5. User-facing information model

Guided mode should expose three primary concepts:

1. **Capabilities** — what the application can do.
2. **Connections** — how capabilities, tools, data, and frontend components work together.
3. **Application** — where capabilities appear in the user experience.

Internally, capabilities may be implemented by several module types. A capability is a user-facing product ability; a module is an implementation boundary. The terms are not interchangeable, and one capability may map to one or more modules.

## 6. Internal module taxonomy

### 6.1 Experience modules

Own frontend screens, components, input collection, result presentation, and interaction states.

### 6.2 Workflow modules

Coordinate actor-oriented processes, multiple domain operations, state transitions, recovery, and completion guarantees.

### 6.3 Domain modules

Own domain vocabulary, invariants, rules, calculations, decisions, units, validity limits, and exceptional outcomes.

### 6.4 Connection modules

Connect the application to external tools, systems, services, or data. Examples include MATLAB, Simulink, Azure DevOps, filesystem access, databases, and HTTP APIs.

### 6.5 Platform modules

Provide technical services required by an approved workflow, such as storage, local job execution, configuration, diagnostics, artifact management, and credential references. Scheduling is not an MVP platform responsibility.

### 6.6 Composite capability projection

Guided mode may present an approved group of modules and bindings as one higher-level capability. This is a registry/visualization projection, not a separately generated module type in the MVP, and it contains no duplicate domain logic.

Guided mode can group these more simply:

- Primary capabilities.
- Supporting capabilities.
- Tools and data.

## 7. Interview-driven specification process

Interviews must be bounded, hierarchical, and gate-driven. Each interview has:

- One purpose.
- A defined input context.
- A defined structured output.
- A question budget.
- Explicit unresolved-question handling.
- A readiness gate.
- A clear next interview.

### 7.1 Stage 1: Product interview

Purpose: determine the product shape without prematurely designing technical architecture.

The interview should cover:

- Problem and desired outcome.
- Primary and supporting users.
- Actor goals.
- Main workflows.
- Important alternatives and exceptions.
- Information used and produced.
- Known rules and calculations.
- External tools and systems.
- Persistence needs.
- Operational and deployment constraints.
- Offline requirements.
- Safety, security, and criticality.
- Expected scale.
- Reuse opportunities.
- Scope and exclusions.
- Measures of success.

Copilot should ask one focused question at a time, summarize confirmed decisions periodically, distinguish confirmed information from proposals, and stop when the product gate can be evaluated.

### 7.2 Product specification hierarchy

```text
Product
├── Purpose and outcomes
├── Actors
│   └── Goals
├── Use cases
│   ├── Main scenarios
│   ├── Alternatives
│   └── Exceptions
├── Information
├── Rules and calculations
├── External systems
├── Constraints
├── Scope boundaries
└── Acceptance outcomes
```

### 7.3 Product gate

The gate should validate at least:

- Primary user identified.
- Primary outcome defined.
- Main workflows identified.
- Scope boundary defined.
- Persistence decision recorded.
- External systems identified.
- Important failure handling discussed.
- Operational assumptions recorded.
- Unresolved questions explicitly listed.

If incomplete, the app generates a follow-up interview containing only unresolved areas.

### 7.4 Stage 2: Architecture-planning interview

The app combines the validated product specification with:

- The reference architecture.
- Module-boundary rules.
- Existing reusable capabilities.
- Available adapters.
- Project constraints.

Copilot proposes:

- Minimal module set.
- Module responsibilities and exclusions.
- Dependencies.
- Operations crossing boundaries.
- Required adapters and platform services.
- Frontend workflows.
- Modules requiring further interviews.

The proposed architecture remains provisional until approved.

### 7.5 Architecture gate

- Every module supports a product need.
- Every module has one clear responsibility.
- Owned and excluded concerns are explicit.
- Dependencies have stated reasons.
- Domain logic is not allocated to UI or infrastructure.
- External technology has a connection module.
- Persistence requirements have platform support.
- No circular dependencies exist.
- Every primary workflow traces through the proposed modules.
- Decomposition is justified and minimal.
- Every module has an interview plan or an approved reusable specification.

### 7.6 Stage 3: Module interviews

Each proposed module receives a type-specific interview.

#### Domain-module interview

- Responsibility and exclusions.
- Vocabulary and concepts.
- Inputs and outputs.
- Units and valid ranges.
- Rules and invariants.
- Preconditions and postconditions.
- Exceptional outcomes.
- Worked examples and tolerances.
- Authoritative sources and assumptions.
- Required capabilities.

#### Workflow-module interview

- Trigger and actors.
- Main sequence.
- Alternative paths.
- State transitions.
- Cancellation.
- Partial failure.
- Recovery.
- Permissions.
- Success guarantee and minimum guarantee.

#### Connection-module interview

- External system or tool.
- Available operations.
- Input/output translation.
- Environment requirements.
- Authentication or secrets.
- Timeouts and cancellation.
- Failure behavior.
- Version compatibility.
- Local or remote execution.
- Verification approach.

#### Platform-module interview

This should use constrained choices wherever possible: storage location, retention, access, execution mode, recovery, and configuration.

#### Experience-module interview

- Supported workflows.
- Required information.
- Actions and results.
- Loading, empty, error, and permission states.
- Responsive and accessibility requirements.
- Capability bindings.

### 7.7 Module readiness gate

A module is implementation-ready when applicable conditions pass:

- Purpose is bounded.
- Inputs and outputs are explicit.
- Rules are confirmed.
- Preconditions and postconditions are defined.
- Exceptions are specified.
- Dependencies are available or explicitly stubbed.
- Approved examples exist.
- Acceptance criteria are testable.
- No unresolved domain questions remain.

### 7.8 Interview depth

The MVP uses one bounded interview behavior and one output schema. Named Quick, Standard, or Detailed variants are deferred until evidence shows that multiple depths improve completion without creating divergent specifications.

## 8. Use-case analysis model

The internal specification should distinguish:

- Product intent.
- Actor.
- Actor goal.
- Use case.
- Scenario.
- Scenario step.
- Domain rule.
- Constraint.
- Capability.
- Operation.
- Service/runtime allocation.
- User experience.
- Acceptance case.

Scenario analysis should systematically consider missing information, invalid ranges, conflicting sources, unavailable dependencies, cancellation, repeated requests, partial success, approval, and unsafe or misleading outcomes.

## 9. Decomposition stopping rule

Stop decomposing when an operation has:

- One clear responsibility.
- Explicit inputs and outputs.
- Defined units and constraints.
- Known failure outcomes.
- One owning module.
- Testable postconditions.
- An implementation or adapter allocation.

Do not require the user to decompose into internal helper functions or implementation trivia.

Create a separate module only when it owns distinct rules, changes independently, is reusable, or represents an external boundary. Small applications may need only one or two modules.

## 10. Reference architecture

The reference architecture is a versioned, enforceable architecture constitution. It defines interaction and boundaries while remaining neutral about domain content and implementation technology.

### 10.1 Architectural layers

```text
Experience
→ Application/workflow
→ Domain
→ Ports
→ Adapters/platform
```

### 10.2 Dependency rules

Allowed:

```text
Experience  → Application contracts
Application → Domain
Application → Ports
Domain      → Domain
Domain      → Ports when external capability is required
Adapters    → Ports and external technology
```

Forbidden:

- Domain to React or Electron.
- Domain to filesystem paths.
- Domain to HTTP clients or database drivers.
- Domain to MATLAB or Simulink engines.
- Experience directly to databases, MATLAB, or external APIs.
- Frontend components containing endpoint URLs.
- Cross-module imports that bypass public contracts.
- Circular module dependencies.

### 10.3 Universal module manifest

Every module declares:

- Schema and architecture version.
- Identity, type, and version.
- Responsibility, owned concerns, and exclusions.
- Provided operations and events.
- Required capabilities and contract versions.
- Configuration schema.
- Verification suites.
- Runtime allocation (`local-embedded` for MVP modules, or `external-adapter` for the three initial adapters).

### 10.4 Standard module shape

```text
module/
  module.yaml
  specification/
  contracts/
  domain/
  application/
  ports/
  adapters/
  tests/
  generated/
```

Only applicable directories are generated. The manifest and public contracts are required; the remaining folders are conventions, not a requirement to create empty layers. The project-level module root remains a decision required before implementation because the current repository has no capability-source convention.

### 10.5 Operation contract

Every published operation defines:

- Identity and version.
- Command/query/job behavior.
- Input and output schemas.
- Preconditions and postconditions.
- Domain and technical errors.
- Side effects.
- Idempotency.
- Timeout class.
- Artifacts and provenance.

### 10.6 Standard result envelope

Operations distinguish:

- Successful execution.
- Valid domain rejection.
- Technical failure.
- Cancellation.

Each result carries one outcome discriminator. Diagnostics, artifacts, and provenance are optional typed fields. Domain rejection is not represented as a technical failure. Thrown exceptions must be converted at the module/runtime boundary.

### 10.7 Error taxonomy

- Validation.
- Domain.
- Dependency.
- Configuration.
- Execution.
- Timeout.
- Authorization.
- Conflict.

Generated frontends use the category to select appropriate presentation and recovery.

### 10.8 Ports

Ports describe required capabilities, not technologies. A domain module requests a performance model, repository, artifact store, or job executor rather than requesting MATLAB, a filesystem, or a specific HTTP API.

### 10.9 Jobs

The architecture defines queued, running, succeeded, failed, and cancelled job records because MATLAB and other long-running operations require progress and cancellation. An operation declares whether it is immediate or job-based. The MVP job runner remains local and in-process; it does not introduce a queue service, worker fleet, or scheduler.

### 10.10 Artifacts

Files cross boundaries as artifact references containing identity, type, checksum, size, provenance, and storage reference. Domain logic must not exchange unexplained absolute paths.

### 10.11 Configuration

Configuration is schema-driven and separate from implementation. Guided mode renders friendly forms. Secrets use secret references and never enter Copilot packets.

### 10.12 Events

The architecture defines a versioned envelope for business-significant facts so manifests and contracts remain extensible. MVP modules only declare or publish events when an approved workflow requires them. No event bus, durable subscription system, replay mechanism, or queue infrastructure is part of the MVP.

### 10.13 Capability registry and runtime resolver

The MVP registry is a project-scoped persisted index derived from approved module manifests. It records provided operations, required contracts, configuration readiness, verification state, and local allocation. The resolver deterministically selects the single approved local module or initial adapter for an operation. Example execution is an explicit Preview data mode, not an alternate production provider. Remote provider selection, health-based routing, and multi-provider arbitration are deferred.

### 10.14 Architecture shapes

The MVP may produce a minimal shape or a tool-backed shape using the same contracts. Connected and collaborative deployment profiles are deferred; the plan must not generate shared databases, object storage, service queues, or deployment topology.

### 10.15 Architecture package

The versioned package contains schemas, dependency rules, boundary rules, security rules, templates, validators, and representative examples. Every Copilot packet identifies the architecture and contract versions it must follow.

### 10.16 Evolution

Use semantic versioning:

- Patch: clarification or tooling improvement.
- Minor: optional backward-compatible capability.
- Major: breaking contract.

Modules declare compatible architecture major versions and exact contract versions. Patch and minor architecture compatibility rules must be encoded by validators rather than inferred by Copilot. Architecture migrations may later use the same Copilot handoff and verification lifecycle; automatic migration is not required for the MVP.

## 11. Capability and module lifecycle

Every module type follows:

```text
Interview
→ specification
→ readiness gate
→ Copilot implementation packet
→ returned overlay
→ inspection
→ application
→ verification
→ connection
→ publication/versioning
```

### 11.1 Copilot implementation packet

Each packet includes:

- Module specification.
- Relevant architecture constitution.
- Direct dependency contracts.
- Allowed scope.
- Forbidden dependencies.
- Approved examples.
- Required tests.
- Expected manifest.
- Explicit exclusions.
- Architecture-validation command.
- Packet identity and hashes for every supplied specification and contract.
- Machine-readable allowed repository paths and expected returned files.

The MVP handoff is compatible with the application's current external Copilot workflow: the app exports bounded files and a recommended prompt, and the user returns a zip overlay. Integrated Copilot sessions are a recorded product decision, not an assumed dependency. Copilot must report architectural conflicts rather than bypass boundaries. Overlay inspection must compare returned paths with the packet's persisted allowed scope before application.

### 11.2 Delta updates

When an existing capability changes, generate a delta packet describing the reason, current contract, required change, preserved behavior, added tests, allowed scope, and unchanged modules. Do not regenerate an entire application unnecessarily.

## 12. Capability freshness and impact analysis

Freshness must track four independently versioned concerns:

1. Specification.
2. Implementation.
3. Verification.
4. Connections.

Each implementation records hashes of:

- Capability specification.
- Reference architecture.
- Dependency contracts.
- Adapter contracts.

Verification records the exact implementation, specification, architecture, dependencies, and suites it validated.

Freshness is recalculated from persisted evidence. User-facing status must not be stored as an independently editable source of truth. Missing evidence produces `Draft`, `Blocked`, or `Verification needed`; it never defaults to `Ready`.

### 12.1 User-facing states

- Ready.
- Draft.
- Definition changed.
- Dependency changed.
- Implementation outdated.
- Verification needed.
- Connection outdated.
- Update available.
- Blocked.
- Failed.

Each module has one primary lifecycle state and zero or more reason codes. The UI derives labels such as `Definition changed` or `Dependency changed` from the reason codes; it must not allow contradictory independent status flags.

### 12.2 Change classification

- Internal implementation change: consumers remain current; changed module needs verification.
- Optional additive contract change: consumers show an available enhancement.
- Required additive change: affected providers, workflows, or bindings need updates.
- Breaking contract change: affected consumers require review and regeneration.

### 12.3 Deterministic invalidation

Review or regeneration is required when relevant specifications, required operation contracts, domain rules, schemas, architecture major versions, adapter contracts, persistence contracts, frontend bindings, or approved examples change.

Unrelated module internals, documentation, styling, optional unused operations, and patch-level architecture clarifications do not invalidate a module.

### 12.4 Impact process

1. Interview the requested change.
2. Propose changed and new capabilities.
3. Compare contracts and dependencies.
4. Explain affected and unaffected modules.
5. Obtain user approval.
6. Mark affected modules with reasons.
7. Order updates provider-first, workflow-second, experience-last.
8. Generate one delta packet at a time.
9. Verify and recalculate freshness after each update.

Copilot proposes semantic impact; deterministic graph and contract checks decide final freshness.

### 12.5 Minimal implementation

Use content hashes, explicit dependencies, contract versions, implementation provenance, verification provenance, frontend-binding versions, and simple graph traversal. Do not initially introduce graph databases, predictive scoring, semantic source-code analysis, or concurrent architecture branches.

## 13. Architecture visualization

The architecture diagram is the central Capabilities design surface. It should answer:

- What can the application do?
- Which capabilities are related?
- Which tools and data do they use?
- Which capabilities need attention?
- Where is a capability used in the application?

### 13.1 Guided visualization

Show:

- Purpose-based groups.
- Plain-language capability names.
- Related-capability connections.
- Tools and data.
- Status and freshness.
- Suggested connections.
- Focus mode for one capability and its neighbors.

Avoid by default:

- UML notation.
- Class names.
- Package names.
- Ports.
- Endpoints.
- File paths.
- Dense crossing dependency arrows.
- Architecture acronyms.

### 13.2 Visual status language

- Neutral: ready.
- Blue: selected/current.
- Yellow: needs review/update.
- Purple: being implemented.
- Green: recently verified.
- Red: failed/blocked.
- Dashed: proposed capability.
- Dotted connection: suggested but unconfirmed.

Never rely on color alone.

### 13.3 Design-mode visualization

Reveal module type, provided/required operations, contract versions, adapter allocation, runtime, files, endpoint details, dependency direction, hashes, and freshness evidence.

## 14. Frontend connection and Preview wiring

Frontend components must bind to named application operations rather than embedding endpoint URLs.

```text
Frontend component
→ named binding
→ named operation
→ runtime resolver
→ module implementation
```

### 14.1 Preview flow

1. Open the generated frontend in the existing embedded Preview.
2. Select a rendered element using an extension of the existing Preview picker.
3. Choose Connect action or Connect data.
4. Select an available capability operation.
5. Let Copilot propose input and output mappings.
6. Resolve only ambiguous mappings.
7. Generate a bounded connection handoff that identifies the selected element, target binding file scope, and operation contract.
8. Apply and verify the binding.
9. Run approved examples through the real interface.

### 14.2 Binding model

Bindings declare:

- Component trigger.
- Operation identity/version.
- Input sources.
- Output destinations.
- Loading behavior.
- Validation presentation.
- Domain-rejection presentation.
- Technical-failure presentation.
- Cancellation and duplicate-submission behavior.
- Stable binding identity and binding version.
- Selected-element locator evidence used for inspection and later re-selection.

The current Preview picker can observe DOM selector, visible text, route, and view. It does not identify React component source reliably. The MVP must either require an approved stable element marker or make the user confirm the proposed source target before generating a binding packet. The final locator strategy is an explicit decision required before Preview-binding implementation.

### 14.3 Preview data modes

- Connected local runtime.
- Approved example.
- Simulated invalid input.
- Simulated unavailable dependency.
- Simulated timeout/failure.

### 14.4 Guided versus Design presentation

Guided mode says, for example, “This button uses this capability” and shows field/result mappings. Design mode may reveal operation IDs, endpoint resolution, schemas, and generated binding files.

## 15. Standard local capability runtime

The MVP should provide one standard project-local runtime boundary that provides:

- Capability manifest.
- Health/readiness information.
- Operation invocation.
- Validation.
- Jobs and progress.
- Diagnostics.
- Artifacts.
- Approved examples.
- A renderer-safe invocation path through the desktop bridge for the Engineering UI Kit Preview.

HTTP exposure is deferred unless a generated target application cannot invoke the local runtime through the selected binding architecture. That decision must be made before runtime implementation; the MVP must not build both transports. Guided mode must not require endpoint configuration.

## 16. MATLAB adapter

MATLAB will be a general platform/connection adapter, not a domain-specific implementation.

### 16.1 Minimality statement

The initial adapter must support the primitive calls necessary for richer integrations while avoiding an attempt to serialize every MATLAB class or implement Simulink behavior prematurely.

### 16.2 Environment capabilities

- Detect installation and version.
- Detect required toolboxes.
- Validate configured paths.
- Start a session.
- Reuse the app-owned project session started by the Engineering UI Kit.
- Stop a session.
- Health/readiness checks.

### 16.3 Primitive execution capabilities

- Call a named function.
- Pass positional or structured inputs.
- Specify expected output count.
- Run an approved script.
- Evaluate only an expression explicitly allowlisted by an approved operation, initiated by the user, and recorded in diagnostics. Arbitrary interactive evaluation is not an MVP Guided or Design action.
- Put and get workspace values.
- List or clear approved variables.
- Add/remove approved paths.
- Set working directory.
- Capture warnings, errors, console output, figures, and files.
- Apply timeout and cancellation.

### 16.4 Initial value model

Support scalars, strings, booleans, nulls, arrays, structures, numeric multidimensional arrays, and artifact references. Add specialized MATLAB types only when demonstrated by real use cases.

### 16.5 Session persistence

Initial policy: one app-owned MATLAB session per project.

Support:

- Long-lived process/workspace across calls.
- Expensive initialization reuse.
- Loaded data and model state.
- Session health and last-used state.
- Project isolation.

The session starts lazily on first approved MATLAB operation or explicit readiness action. It survives individual operation calls, stops when the desktop application exits or the user explicitly stops it, and is recreated after a crash. An unhealthy or restarted session invalidates in-memory-state readiness but does not invalidate durable snapshots. Concurrent calls for one project are serialized in the MVP.

Future contracts may allow per-module sessions, session pools, and remote workers without implementing them initially.

### 16.6 Durable persistence

Persist only explicitly selected state using project-scoped MAT-file snapshots plus a metadata record, or an approved reinitialization recipe. Domain-state records and ordinary artifacts remain separate records and are not alternate MATLAB-workspace stores. Never persist the entire workspace indiscriminately. Snapshot metadata records the project, selected variables, MATLAB version, checksum, creation time, originating operation, and compatibility result. Restore requires explicit selection and validation; a failed restore leaves the session usable but uninitialized.

### 16.7 Guided configuration

Ask the user what existing implementation they have, how inputs and outputs map, whether initialization is required, what should persist, whether figures/files are produced, which toolboxes are required, and what should happen when MATLAB is unavailable.

### 16.8 Verification

Adapter checks:

- Discovery/version/toolboxes.
- Session start/stop/restart.
- Scalar/array/structure round trips.
- Function and script execution.
- Timeout and cancellation.
- Error conversion.
- Artifact retrieval.
- Selected-state save/restore.
- Project isolation.

Connection checks:

- Function availability.
- Input/output mapping.
- Unit conversion.
- Diagnostic mapping.
- Approved examples.

## 17. Simulink extension

Simulink is a future connection adapter using the same tool, job, artifact, persistence, and diagnostic contracts. Potential operations include model loading, update, simulation, analysis, code generation, model metadata, screenshots, and comparisons. It is explicitly not part of the first implementation.

## 18. Filesystem adapter

The filesystem adapter provides repository and artifact capabilities without leaking paths into domain modules.

It should support:

- Project-scoped reads/writes.
- Approved path policies.
- File discovery.
- Artifact creation/retrieval.
- Checksums and provenance.
- Clear separation between source, generated output, configuration, and artifacts.

All reads and writes must resolve a project-relative path against a named policy root, reject traversal and symlink escape, and return artifact references instead of absolute paths across operation contracts. File monitoring is deferred because no MVP journey requires it.

Guided mode uses concepts such as project files, input data, and generated results. Design mode exposes paths and policies.

## 19. Azure DevOps adapter

Azure DevOps is a first-class connection adapter, not a dependency of the core architecture.

### 19.1 Candidate capabilities

- Organization/project/repository discovery.
- Source and branch metadata.
- Work-item and revision reading.
- Requirement and acceptance-criteria import.
- Linking capabilities and changes to work items.
- Pipeline invocation and status.
- Test-result retrieval.
- Build-artifact metadata and retrieval when referenced by verification evidence.

Work-item mutation, artifact publication, task creation, branch changes, and repository writes are deferred. The MVP adapter is read-only except for explicitly starting an already configured pipeline when that decision is approved.

### 19.2 Guided setup

The user connects an organization, project, repository, work-item access, pipeline access, and artifact access using friendly selectors. Credentials are secret references and never enter specifications or Copilot packets.

### 19.3 Freshness

Imported work items and requirements record external identity and revision. New external revisions trigger impact review rather than silently changing specifications.

### 19.4 Verification

- Authentication and permission checks.
- Organization/project/repository discovery.
- Read-only work-item retrieval with identity and revision provenance.
- Pipeline discovery and optional test invocation.
- Artifact access.
- Rate-limit and unavailable-service handling.
- Contract compatibility.

## 20. Generic HTTP/API adapter

A future generic service adapter may use the same connection interview, result, verification, freshness, and frontend-binding contracts. Contract discovery, authentication schemes, and endpoint configuration are not part of the MVP.

## 21. Verification framework

Verification is selected by module type while retaining a common user experience.

### 21.1 Domain verification

- Contract validation.
- Rules and invariants.
- Units.
- Worked examples.
- Boundary cases.
- Invalid-domain outcomes.
- Numerical tolerances.
- Provenance.

### 21.2 Workflow verification

- Main scenario.
- Alternatives.
- State transitions.
- Cancellation.
- Partial failure and recovery.
- Completion guarantees.

### 21.3 Connection verification

- Environment readiness.
- Authentication/connectivity.
- Input/output translation.
- Timeouts and cancellation.
- Tool/service errors.
- Contract compatibility.

### 21.4 Platform verification

- Health.
- Read/write.
- Persistence across restart.
- Permissions.
- Migration.
- Isolation.
- Failure recovery.

### 21.5 Experience verification

- Typecheck/build.
- Accessibility.
- Input/output binding.
- Loading, empty, rejection, and failure states.
- Responsive behavior.
- Visual review.

### 21.6 Architecture verification

- Module-boundary rules.
- Dependency direction.
- No undeclared cross-module imports.
- Contract/version compatibility.
- No technology leakage into domain modules.
- Traceability from product need to module, operation, and acceptance case.

### 21.7 Repair flow

Failed checks generate a copied, module-scoped repair prompt containing actual diagnostic output, current specification, allowed scope, required behavior, and preserved contracts. Setup failures use setup actions rather than Copilot repair prompts.

## 22. Capabilities page UX

Initial page structure:

```text
Capabilities

Application definition
Architecture
Needs attention
Modules
Connections
Verification
```

### 22.1 Application definition

Shows interview status, unresolved questions, main workflows, and the next action.

### 22.2 Architecture

Shows the clean interactive capability diagram and approved/proposed module organization.

### 22.3 Needs attention

Shows stale, blocked, draft, failed, or connection-outdated capabilities in dependency order with reasons and next actions.

### 22.4 Modules

Each card shows purpose, status, provided operations, verification summary, related capabilities, and one primary action.

### 22.5 Connections

Shows completed, suggested, missing, and outdated connections between capabilities, tools/data, and the frontend.

### 22.6 Verification

Shows module-specific checks, evidence, diagnostics, and freshness provenance without exposing raw logs unless requested.

## 23. Integration with the current Build & Test engine

Reuse:

- Context preparation.
- Copilot handoff files.
- Recommended prompts.
- Overlay inspection.
- Scope and safety constraints.
- Apply behavior.
- Verification execution.
- Failure classification.
- Copied repair prompts.
- Review and iteration.

Extend these concepts from project-wide UI changes to capability-scoped changes. Every module or connection must declare its permitted path/scope so returned overlays can be checked against it.

The existing system provides the following concrete extension points:

- `packages/core` owns GUI-independent contracts, persistence helpers, packet construction, overlay safety, and command execution.
- The Electron desktop process owns filesystem access, child processes, native dialogs, credentials, and external tool sessions.
- The preload/renderer bridge exposes named serializable operations; it must not expose generic filesystem, shell, MATLAB, or Azure clients.
- The renderer owns navigation, Guided/Design projections, interview editing, diagrams, Preview selection, and user approvals.
- Current handoff runs are project-wide UI runs. Capability implementation runs require an explicit run kind and capability/module/connection scope; they must not overload UI-only fields with different meanings.
- Current verification records command results but not input hashes. Capability verification must add immutable provenance without changing the meaning of legacy records.

## 24. Data model

The MVP can use versioned files or records rather than a graph database.

Core records:

- Application specification.
- Architecture specification.
- Capability/module manifest.
- Operation contract.
- Event contract.
- Configuration schema.
- Binding specification.
- Adapter configuration.
- Artifact reference.
- Job/execution record.
- Verification record.
- Freshness/provenance record.
- Change/impact record.
- Interview transcript and structured output.

Relationships are explicit IDs and versions. A graph projection can be generated for visualization and impact traversal.

Capability definition records and generated source code have different ownership. App-managed records are authoritative for interviews, approvals, registry state, bindings, freshness, and verification provenance. Repository files are authoritative for module manifests, public contracts, and implementation. The exact app-managed directory and repository module root are implementation-blocking decisions that must be confirmed before persistence packets begin. Writes must be atomic, records must carry schema versions, and unknown future fields must not cause destructive rewrites.

## 25. Security and trust

- Secrets remain in OS/application secret storage and are referenced, never copied into packets.
- External operations declare required permissions.
- Local execution requires explicit user initiation where consequential.
- Arbitrary MATLAB expression execution is hidden from Guided mode and restricted to approved specifications.
- Filesystem access is project-scoped and policy-checked.
- Copilot cannot silently approve domain rules or safety-relevant assumptions.
- Every generated module records provenance and implementation packet identity.
- External requirement changes require review before altering the approved specification.
- The renderer receives capability results and bounded artifact display data, never credentials, unrestricted paths, child-process handles, MATLAB engine objects, or Azure client objects.
- Adapter permissions are least-privilege and are displayed before connection verification or consequential execution.

## 26. Delivery roadmap

### Phase 0: Architecture definition and validation

- Finalize vocabulary.
- Define reference architecture 1.0.
- Define module, operation, result, diagnostic, artifact, job, event, configuration/secret-reference, binding, and freshness schemas.
- Define dependency and boundary rules.
- Create architecture validators.
- Create minimal representative examples.

Exit gate: schemas and rules can describe a minimal app, tool-backed app, and connected app without domain-specific assumptions.

### Phase 1: Capabilities page foundation

- Add Capabilities top-level navigation/page.
- Add Guided and Design projections over the same records.
- Add application interview prompt export and specification paste/import.
- Add structured specification validation.
- Add architecture-planning handoff.
- Render the initial capability diagram.
- Add module lifecycle/status model.

Exit gate: a user can interview, import a product specification, review proposed modules, and approve an architecture.

### Phase 2: Module interviews and Copilot lifecycle

- Add type-specific module interviews.
- Add readiness gates.
- Generate module-scoped packets.
- Reuse overlay inspection and application.
- Add module-specific verification selection.
- Display module readiness and evidence.

Exit gate: one domain-neutral module can be specified, implemented by Copilot, applied, and verified independently.

### Phase 3: Freshness and impact

- Add specification, implementation, verification, dependency, and binding hashes.
- Add contract-aware change classification.
- Add impact proposals and approval.
- Add stale/blocked/update states.
- Add dependency-ordered update queue.
- Generate delta packets.

Exit gate: adding or changing a capability identifies only affected modules, explains why, and guides ordered updates.

### Phase 4: Standard runtime and filesystem

- Add local capability runtime.
- Add project-scoped registry and deterministic local resolver.
- Add job, diagnostic, artifact, and configuration support.
- Add filesystem/repository adapter.
- Add health/readiness reporting.

Exit gate: verified operations can be invoked locally through stable contracts without frontend endpoint knowledge.

### Phase 5: MATLAB adapter

- Add discovery/version/toolbox readiness.
- Add project-scoped persistent session.
- Add primitive calls and initial value conversion.
- Add approved scripts/expressions.
- Add artifact/figure/log capture.
- Add timeout/cancellation.
- Add selected-state durable persistence.
- Add adapter and connection verification.

Exit gate: a domain-neutral operation can be mapped to MATLAB, executed repeatedly through a persistent session, verified, and represented through standard results.

### Phase 6: Connections and Preview wiring

- Add connection map.
- Add component selection in Preview.
- Add operation suggestions.
- Add input/output mapping UI.
- Add example and failure simulation modes.
- Generate connection-scoped packets.
- Verify the complete frontend-to-capability path.

Exit gate: a user connects a verified backend operation to frontend components and validates it without writing code or entering endpoints.

### Phase 7: Azure DevOps

- Add secure connection configuration.
- Add project/repository/work-item discovery.
- Add requirements import with revision provenance.
- Add read-only work-item linkage and revision provenance.
- Add pipeline discovery/status, optional approved invocation, test-result retrieval, and referenced artifact retrieval.
- Add freshness signals for external revisions.

Exit gate: requirements and implementation work can be traced to Azure DevOps, and pipeline evidence can feed capability verification.

### Phase 8: Additional adapters and remote runtime

- Evaluate Simulink based on demonstrated needs.
- Add generic HTTP/API integration.
- Add remote capability runtime where justified.
- Add shared storage/authentication only when collaboration requires it.

Phase 8 is not part of MVP completion and must not contribute required MVP packages or acceptance gates.

## 27. Explicit initial non-goals

- No arbitrary microservice generation.
- No Kubernetes or deployment-topology designer.
- No graph database.
- No general visual programming canvas.
- No general workflow engine.
- No third-party adapter marketplace.
- No remote MATLAB execution.
- No MATLAB session pools.
- No full MATLAB object serialization.
- No Simulink implementation in the first adapter release.
- No automatic service-boundary invention without user approval.
- No direct code-editing requirement.
- No separate source of truth for Guided and Design modes.
- No application-wide regeneration for a localized capability change.
- No direct frontend-to-infrastructure calls.
- No production event bus, durable event subscriptions, or replay system.
- No multi-provider runtime routing or health-based failover.
- No file watcher or background synchronization service.
- No Azure DevOps write operations other than an explicitly approved pipeline invocation.

## 28. Key risks and mitigations

### Interview sprawl

Mitigation: bounded interviews, question budgets, readiness gates, explicit deferred scope, one question at a time.

### Premature architecture decomposition

Mitigation: minimal module rule, provisional architecture, explicit responsibility/exclusion review, small-application profiles.

### Copilot inventing domain truth

Mitigation: proposed/confirmed states, source provenance, approved examples, unresolved-question gates.

### Stale modules after change

Mitigation: deterministic fingerprints, contract versions, explicit dependency graph, ordered regeneration queue.

### Architecture drift in generated code

Mitigation: architecture constitution in every packet, scoped paths, automated dependency/boundary validation.

### Tool-specific leakage

Mitigation: capability-oriented ports, separate adapters, standard result/artifact/job models.

### Overengineering

Mitigation: one runtime, one schema family, local-first execution, file/record persistence, explicit non-goals, phase exit gates.

### Misleading verification

Mitigation: separate setup, domain rejection, technical failure, and unverified states; preserve exact provenance of what was tested.

## 29. Review decisions required

Before the dependent implementation phase begins, confirm:

1. Final Guided/Design mode naming.
2. Copilot handoff transport: retain external file export/import for MVP, or require an integrated Copilot session. The current repository implements only external file handoff.
3. Initial generated-module language/runtime constraints and the single repository module root. The current repository does not define a capability-source root.
4. Version 1 module schema and operation result envelope approval after schema prototypes; do not implement adapters against draft shapes.
5. Exact app-managed storage layout, retention behavior, and backup/export behavior for capability definitions and architecture records.
6. Visual diagram interaction model: read-only selection/focus for MVP or direct editing. Direct graph editing is not otherwise required.
7. Manual source-code change policy: mark affected modules `Verification needed` from manifest-owned file hashes, or also require a definition review.
8. Preview locator: require a stable element marker or allow a user-confirmed proposed source target.
9. Target-application runtime transport: the desktop bridge or one local HTTP transport. Implement only one transport.
10. Credential-store provider and the approval boundary for allowlisted MATLAB expressions, durable-state restore, filesystem writes, and pipeline invocation.
11. Minimum Azure DevOps read scopes.
12. Whether Azure DevOps pipeline invocation is included in MVP or the adapter remains read-only.
13. Supported MATLAB integration mechanism, operating systems, MATLAB versions, and toolbox detection API.

Filesystem, MATLAB, and Azure DevOps are fixed as the first three adapter priorities; that ordering is not an open decision.

## 30. Definition of first meaningful product increment

The first meaningful increment should demonstrate the complete product thesis without implementing every adapter:

1. User conducts and imports a product interview.
2. App validates the specification.
3. Copilot proposes a minimal reference-architecture-compliant capability map.
4. User approves the visual architecture.
5. User conducts one module interview.
6. Module passes readiness gate.
7. App generates a scoped Copilot packet.
8. Returned implementation is inspected, applied, and verified.
9. Module appears fresh and verified in the architecture diagram.
10. A frontend component is visually connected to its operation in Preview.
11. An approved example runs through the complete frontend-to-capability path.

This increment proves the durable core: interview, specification, architecture, modular implementation, verification, freshness, and visual connection.

## 31. MVP completion boundary

MVP completion includes the durable core above, the local runtime and filesystem adapter, one project-scoped MATLAB session with selected durable state, Preview binding through one approved transport, the bounded Azure DevOps read path, and hardening/migration tests. Simulink, generic HTTP, remote runtime, shared infrastructure, event infrastructure, alternative interview depths, and Azure DevOps mutation remain deferred even when their extension contracts are present.
