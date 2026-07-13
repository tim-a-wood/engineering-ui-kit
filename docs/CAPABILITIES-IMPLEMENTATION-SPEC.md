# Capabilities Implementation Specification

## 1. Document control

| Field | Value |
|---|---|
| Document ID | `CAP-SPEC-001` |
| Status | Draft pending open decisions |
| Product | Engineering UI Kit — Capabilities |
| Source plan | `docs/CAPABILITIES-PLAN.md` |
| Repository observed | 2026-07-12 workspace state |
| Target release | Capabilities MVP |
| Normative vocabulary | RFC 2119 terms in requirement blocks |
| Change control | Update requirement, packet, test, and traceability rows together |

This document is normative except where a section is labeled informative or non-normative. Paths labeled **existing** were observed in the repository. Paths labeled **proposed** do not exist yet. Paths labeled **illustrative** require an open decision before implementation.

## 2. Purpose

This specification converts the Capabilities product plan into implementation boundaries, contracts, delivery packets, and acceptance tests. It is designed for incremental Cursor execution without product reinterpretation.

## 3. Product outcome

A flight scientist defines and approves an application need, reviews a minimal capability architecture, delegates one bounded module or connection at a time to Copilot, verifies returned work locally, and connects a verified operation to a selected Preview element without writing source code or endpoint configuration.

### CAP-PROD-001

Statement:
The system MUST preserve the flight scientist as the approver of domain facts, scope, architecture, mappings, and acceptance outcomes while Copilot produces proposals and implementation overlays.

Rationale:
The operating model prevents unreviewed domain invention.

Verification:
Exercise every approval gate with an unconfirmed proposal and confirm that implementation actions remain unavailable.

Implemented by:
- CAP-PKT-008
- CAP-PKT-009
- CAP-PKT-011
- CAP-PKT-024

Validated by:
- CAP-TEST-006
- CAP-TEST-008
- CAP-TEST-010
- CAP-TEST-030

### CAP-PROD-002

Statement:
The system MUST keep one persisted model for Guided and Design projections.

Rationale:
Parallel models would drift and create conflicting authority.

Verification:
Edit an approved field through each projection and confirm both projections read the same record revision.

Implemented by:
- CAP-PKT-003
- CAP-PKT-007

Validated by:
- CAP-TEST-004
- CAP-TEST-005

### CAP-PROD-003

Statement:
The MVP MUST remain a local-first modular monolith and MUST NOT require a network service, graph database, message broker, worker fleet, or shared database for core operation.

Rationale:
The product plan requires a minimal desktop architecture.

Verification:
Run the MVP end-to-end with network access disabled except during an explicitly selected Azure DevOps test.

Implemented by:
- CAP-PKT-017
- CAP-PKT-018
- CAP-PKT-032

Validated by:
- CAP-TEST-023
- CAP-TEST-040

### CAP-PROD-004

Statement:
The system MUST represent domain concepts without embedding aerospace, MATLAB, Azure DevOps, or example-project vocabulary in core capability contracts.

Rationale:
Domain neutrality is required for reuse across applications.

Verification:
Validate two representative manifests with unrelated domain vocabularies against the same schemas.

Implemented by:
- CAP-PKT-001
- CAP-PKT-002

Validated by:
- CAP-TEST-001
- CAP-TEST-002

### CAP-PROD-005

Statement:
The MVP MUST implement filesystem, MATLAB, and bounded Azure DevOps adapters and MUST keep Simulink, generic HTTP, remote execution, and shared deployment infrastructure deferred.

Rationale:
The adapter order demonstrates local files, engineering tools, and enterprise traceability without broadening scope.

Verification:
Inspect the delivered registry and packages; confirm the three named adapters exist and deferred adapters have contracts or documentation only.

Implemented by:
- CAP-PKT-019
- CAP-PKT-020
- CAP-PKT-021
- CAP-PKT-022
- CAP-PKT-026
- CAP-PKT-027
- CAP-PKT-028

Validated by:
- CAP-TEST-025
- CAP-TEST-026
- CAP-TEST-027
- CAP-TEST-028
- CAP-TEST-033
- CAP-TEST-034
- CAP-TEST-035

## 4. Scope

MVP scope includes product and module interviews through external Copilot file handoff, readiness gates, architecture visualization, module-scoped implementation overlays, deterministic freshness and impact ordering, a local runtime, filesystem and MATLAB execution, Preview binding, read-oriented Azure DevOps traceability, migration, security, and end-to-end verification.

## 5. Explicit non-goals

The following items are outside MVP: integrated Copilot chat unless CAP-DEC-002 changes the handoff decision; direct graph editing; arbitrary service topology; microservices; graph persistence; general workflow execution; event infrastructure; multi-provider routing; background file monitoring; MATLAB pools or remote MATLAB; Simulink; generic HTTP; arbitrary MATLAB evaluation; Azure DevOps work-item/repository mutation; plugin marketplace; deployment generation; and application-wide regeneration for a local capability change.

## 6. Users and operating model

| Actor | Owns | Does not own |
|---|---|---|
| Flight scientist | Domain truth, scope, approvals, examples, mappings, acceptance | Source implementation and runtime plumbing |
| Copilot | Interview proposals, decomposition proposals, bounded code overlays, repair overlays | Approval, credentials, silent assumptions, local verification claims |
| Engineering UI Kit desktop | Persistence, safety gates, local execution, tool sessions, evidence | Domain truth |
| Generated target application | Module implementations and frontend binding code | Engineering UI Kit credentials or unrestricted host access |

## 7. Guided and Design projections

Guided shows outcomes, workflows, capabilities, connections, examples, and plain-language status. Design shows the same record IDs plus module types, contracts, versions, paths, hashes, diagnostics, and provenance. Mode changes alter presentation only.

### CAP-UX-001

Statement:
The Capabilities area MUST expose Guided and Design projections without duplicating persisted product, architecture, module, connection, or verification records.

Rationale:
Progressive disclosure must not create competing truth.

Verification:
Compare record identifiers and revisions displayed in both modes after edits and reload.

Implemented by:
- CAP-PKT-007

Validated by:
- CAP-TEST-005

## 8. Terminology and glossary

| Term | Definition |
|---|---|
| Acceptance case | Approved example or failure case with observable expected outcome. |
| Adapter | Desktop-owned implementation of a port for a specific external boundary. |
| Application specification | Approved product intent, actors, use cases, constraints, and acceptance outcomes. |
| Architecture specification | Approved module allocation, dependencies, operations, and adapter allocations. |
| Artifact reference | Metadata that identifies content without exposing an unexplained absolute path. |
| Binding | Versioned mapping from a selected frontend trigger to one operation and presentation behaviors. |
| Capability | User-facing ability of the application. |
| Capability run | Persisted interview, implementation, delta, connection, or verification lifecycle instance. |
| Connection | Approved relationship between a module, adapter, data source, or frontend binding. |
| Contract | Versioned schema governing a boundary. |
| Design projection | Technical presentation of the canonical capability records. |
| Diagnostic | Structured explanatory record associated with an outcome or job. |
| Durable MATLAB state | Explicitly selected MATLAB variables stored in a validated snapshot plus metadata. |
| Freshness | Deterministic relationship between current inputs and recorded implementation or verification provenance. |
| Guided projection | Plain-language presentation of the canonical capability records. |
| Implementation packet | Bounded external-Copilot handoff for one module or connection. |
| Job | Persisted local execution record for an operation requiring progress or cancellation. |
| Module | Implementation boundary with one responsibility and a public manifest. |
| Operation | Versioned callable module behavior. |
| Overlay | Copilot-returned zip containing changed and new repository-relative files. |
| Port | Technology-neutral required capability contract. |
| Preview | Existing embedded target-application view in Verify & Review. |
| Projection | Derived presentation or graph that is not a second source of truth. |
| Provenance | IDs, versions, hashes, timestamps, and evidence connecting an output to inputs. |
| Readiness gate | Deterministic validation that controls the next lifecycle action. |
| Registry | Project-scoped index derived from approved manifests and evidence. |
| Result envelope | Standard discriminated operation outcome. |
| Secret reference | Opaque identifier resolved only by the desktop process. |

## 9. Existing application context

### 9.1 Existing package boundaries

| Existing path | Observed responsibility | Capabilities implication |
|---|---|---|
| `packages/core/src/types.ts` | Persisted project, handoff-run, overlay, verification, and settings contracts | Add capability contracts without changing legacy semantics. |
| `packages/core/src/persistence.ts` | Atomic app-workspace JSON persistence for projects and runs | Extend with capability-specific stores and schema versions. |
| `packages/core/src/packetBuilder.ts` | GUI-independent handoff pack construction | Reuse patterns; capability packets need their own contracts. |
| `packages/core/src/overlay.ts` | Zip inspection and non-destructive application | Add persisted capability scope enforcement before apply. |
| `packages/core/src/commandRunner.ts` | Local verification commands, timeouts, output capture | Reuse for module suites and local jobs where appropriate. |
| `apps/desktop/src/ipc.ts` | Filesystem, persistence, child process, packet, overlay, verification, evidence, and launch handlers | Own adapters, runtime, credentials, and capability persistence handlers. |
| `apps/desktop/src/bridgeApi.ts` | Canonical named desktop bridge contract | Add serializable capability operations. |
| `apps/desktop/src/preload.cts` | Named IPC forwarding | Expose no generic tool or filesystem method. |
| `apps/gui/src/bridge.ts` | Renderer mirror and mock fallback | Keep parity with the desktop bridge. |
| `apps/gui/src/appState.ts` | Typed in-memory navigation and persisted-run reachability | Add `capabilities` view without URL routing. |
| `apps/gui/src/App.tsx` | Primary navigation and top-level state ownership | Mount the Capabilities page and selected project context. |
| `apps/gui/src/views/build/` | Current two-step Build handoff workspace | Reuse lifecycle components selectively; do not couple capability records to UI task fields. |
| `apps/gui/src/views/workflow.tsx` | Verify/Review, Preview, DOM picker, verification UI | Extend the picker and binding workflow. |
| `standards/copilot-handoff/` | Packet and overlay safety standards | Add capability packet contracts and scope rules. |
| `standards/schemas/` | Existing JSON schemas | Host versioned capability schemas. |
| `standards/validation/` | Schema/contract validation scripts and checklists | Extend validation gates. |

### 9.2 Existing lifecycle and constraints

The current Build & Test flow persists `Project` and `HandoffRun` records under the Electron user-data workspace. It exports up to three files for external Copilot, accepts `ui-overlay.zip`, inspects and applies the overlay, invalidates project-level verification after apply, runs configured commands, and persists evidence. The renderer has no generic filesystem API.

The current overlay inspector accepts `expectedFiles`, but the desktop `inspectOverlay` handler does not pass packet scope. The current Preview picker returns a DOM selector, text, title, and route; it cannot reliably locate React source. Current verification provenance records commands and output paths, but not specification, implementation, architecture, dependency, or suite hashes. These are implementation constraints, not reasons to duplicate the workflow.

### CAP-ARCH-001

Statement:
GUI-independent capability contracts, validators, graph calculations, freshness calculations, and packet construction MUST reside in `packages/core`, while privileged filesystem, child-process, credential, MATLAB, and Azure DevOps work MUST reside in the Electron desktop process.

Rationale:
The existing modular-monolith boundary protects the renderer and keeps core logic testable.

Verification:
Inspect imports and run boundary tests that fail when renderer code imports privileged modules or core code imports Electron.

Implemented by:
- CAP-PKT-001
- CAP-PKT-002
- CAP-PKT-005
- CAP-PKT-012
- CAP-PKT-015
- CAP-PKT-016
- CAP-PKT-017
- CAP-PKT-030

Validated by:
- CAP-TEST-003
- CAP-TEST-037

### CAP-ARCH-002

Statement:
The renderer MUST invoke capability persistence, runtime, adapters, and artifacts only through named serializable bridge operations and MUST NOT receive generic filesystem, shell, credential-store, MATLAB-engine, or Azure-client access.

Rationale:
The renderer is an unprivileged presentation boundary.

Verification:
Audit the preload surface and attempt prohibited path, handle, and credential transfers.

Implemented by:
- CAP-PKT-005
- CAP-PKT-030

Validated by:
- CAP-TEST-003
- CAP-TEST-037

## 10. Target user journeys

| Journey ID | Journey | Exit evidence |
|---|---|---|
| `CAP-JRN-001` | Import and approve a product interview | Approved application specification revision |
| `CAP-JRN-002` | Generate and approve minimal architecture | Approved architecture revision and gate result |
| `CAP-JRN-003` | Interview, implement, inspect, apply, and verify one module | Fresh verified module with packet provenance |
| `CAP-JRN-004` | Change a contract and update affected modules | Approved impact record and provider-first delta sequence |
| `CAP-JRN-005` | Invoke a filesystem-backed operation locally | Result envelope and artifact evidence |
| `CAP-JRN-006` | Reuse and restore project-scoped MATLAB state | Session and snapshot evidence |
| `CAP-JRN-007` | Bind a selected Preview element to an operation | Verified binding and real/example execution |
| `CAP-JRN-008` | Link an imported Azure DevOps requirement and verification evidence | External identity/revision and evidence provenance |

## 11. Interview lifecycle

The MVP uses external file handoffs. Each interview run exports `CAP-CONTRACT-014`, receives one structured JSON response, validates it, displays confirmed/proposed/unresolved fields, and requires user approval. Invalid input remains importable as a draft with field diagnostics; it cannot pass a gate.

### CAP-HANDOFF-001

Statement:
Each interview handoff MUST identify its purpose, input record revisions, question budget, confirmed facts, proposals, unresolved questions, output schema version, and next gate.

Rationale:
Bounded context prevents interview sprawl and hidden assumptions.

Verification:
Validate product, architecture, and module interview packets against `CAP-CONTRACT-014`.

Implemented by:
- CAP-PKT-008
- CAP-PKT-009
- CAP-PKT-011

Validated by:
- CAP-TEST-006
- CAP-TEST-008
- CAP-TEST-010

### CAP-HANDOFF-002

Statement:
An imported Copilot interview response MUST NOT change an approved record until the user reviews a field-level delta and explicitly approves the new revision.

Rationale:
External text is untrusted proposed input.

Verification:
Import a response that changes a confirmed rule and confirm the approved revision remains unchanged before approval.

Implemented by:
- CAP-PKT-008
- CAP-PKT-009
- CAP-PKT-011

Validated by:
- CAP-TEST-007

## 12. Product, architecture, and module readiness gates

| Gate ID | Required facts | Blocking output |
|---|---|---|
| `CAP-GATE-001` Product | Primary actor/outcome, main workflows, scope, persistence decision, external systems, failure behavior, operating assumptions, explicit unresolved list | Missing field IDs and reasons |
| `CAP-GATE-002` Architecture | Need trace for each module, responsibility/exclusions, dependency reasons, no cycle, external boundaries allocated, workflow traces, minimality, interview plan | Rule IDs, module IDs, and paths |
| `CAP-GATE-003` Module | Bounded purpose, explicit contracts, confirmed rules, conditions, errors, dependencies, approved examples, testable acceptance, no unresolved domain question | Requirement/contract IDs and reasons |

### CAP-DATA-001

Statement:
Readiness gates MUST be deterministic functions of versioned records and MUST return stable rule IDs, severity, affected record IDs, and remediation text.

Rationale:
Agents and users need reproducible blocking reasons.

Verification:
Run each gate twice over identical input and compare ordered results byte-for-byte.

Implemented by:
- CAP-PKT-002
- CAP-PKT-008
- CAP-PKT-009
- CAP-PKT-011

Validated by:
- CAP-TEST-002
- CAP-TEST-006
- CAP-TEST-008
- CAP-TEST-010

## 13. Use-case and scenario model

The application specification records products, actors, goals, use cases, scenarios, ordered steps, domain rules, constraints, external systems, acceptance cases, sources, and unresolved questions using stable IDs. Scenario review covers missing information, invalid values, conflicting sources, unavailable dependencies, cancellation, repeated requests, partial success, approval, and unsafe or misleading outcomes when applicable.

### CAP-DATA-002

Statement:
Every approved use case MUST trace to at least one scenario, capability, operation, and acceptance case before MVP completion.

Rationale:
Traceability proves that architecture and verification serve product intent.

Verification:
Run the trace validator and confirm it identifies an intentionally orphaned use case.

Implemented by:
- CAP-PKT-001
- CAP-PKT-002
- CAP-PKT-009

Validated by:
- CAP-TEST-001
- CAP-TEST-009

## 14. Capability and module taxonomy

| Module type | Owns | Excludes |
|---|---|---|
| Experience | Target-app interaction and presentation | Domain rules and external clients |
| Workflow | Scenario coordination and recovery | UI rendering and adapter technology |
| Domain | Vocabulary, rules, calculations, validity, rejections | React, Electron, paths, MATLAB, Azure APIs |
| Connection | Translation to one external boundary | Domain truth |
| Platform | Required local storage, jobs, configuration, diagnostics, artifacts | Scheduling and distributed infrastructure |

A composite is a Guided projection over module IDs, not an MVP module type. A separate module is justified only by distinct rules, independent change, reuse, or an external boundary.

## 15. Reference architecture

```text
Renderer experience
        |
        v
Named desktop bridge contracts
        |
        v
Application/workflow -> Domain -> Ports
                              ^       |
                              |       v
                    Local runtime <- Adapters/platform
```

The generated target application's exact invocation transport is controlled by CAP-DEC-009. Only one transport is implemented for MVP.

### Architecture rules

| ID | Rule |
|---|---|
| `CAP-AR-001` | Experience depends on application contracts, not adapters. |
| `CAP-AR-002` | Application depends on domain and ports. |
| `CAP-AR-003` | Domain depends only on domain code and technology-neutral ports. |
| `CAP-AR-004` | Adapters implement ports and own external technology translation. |
| `CAP-AR-005` | Cross-module access uses declared public contracts. |
| `CAP-AR-006` | Module dependencies are acyclic. |
| `CAP-AR-007` | Renderer access to privileged behavior uses named bridge methods. |
| `CAP-AR-008` | Absolute paths do not cross domain operation contracts. |
| `CAP-AR-009` | Secrets are represented only by secret references outside the desktop resolver. |
| `CAP-AR-010` | MVP runtime allocation is local embedded or one of the three approved external adapters. |

### CAP-ARCH-003

Statement:
Architecture validation MUST enforce `CAP-AR-001` through `CAP-AR-010` against manifests, operation contracts, declared dependencies, bindings, and packet scope.

Rationale:
The reference architecture is enforceable rather than advisory prose.

Verification:
Run representative valid and invalid fixtures and compare exact rule IDs.

Implemented by:
- CAP-PKT-002
- CAP-PKT-013

Validated by:
- CAP-TEST-002
- CAP-TEST-015

## 16. Dependency rules

Dependency edges use module ID, required operation ID, accepted contract range, and reason. Derived graphs are ordered by stable IDs after topological ordering. A cycle blocks architecture approval. Optional unused operations do not create edges.

### CAP-ARCH-004

Statement:
The dependency graph MUST be derived from approved manifests and contracts and MUST NOT be persisted as an independently editable source of truth.

Rationale:
Derived graph state cannot drift from contracts.

Verification:
Change one manifest dependency and confirm the next graph projection changes without direct graph mutation.

Implemented by:
- CAP-PKT-002
- CAP-PKT-010

Validated by:
- CAP-TEST-009
- CAP-TEST-012

## 17. Universal module manifest

### CAP-CONTRACT-003: Module manifest

```yaml
schemaVersion: "1.0"
architectureVersion: "1.0"
moduleId: "module.example"
moduleVersion: "1.0.0"
moduleType: "domain|workflow|experience|connection|platform"
name: "Example"
responsibility: "One bounded responsibility"
ownedConcerns: []
excludedConcerns: []
providedOperations:
  - operationId: "operation.example"
    contractVersion: "1.0.0"
requiredOperations:
  - operationId: "operation.dependency"
    acceptedContractRange: "^1.0.0"
    reason: "Approved workflow need"
configurationSchemaRef: null
verificationSuiteIds: []
runtimeAllocation: "local-embedded|external-adapter"
events: []
ownedPaths: []
```

Fields are normative; values above are non-normative examples. Empty directories are not implied.

### CAP-DATA-003

Statement:
Every implementation-ready module MUST have one schema-valid `CAP-CONTRACT-003` manifest with stable identity, semantic version, responsibility, exclusions, public operations, required operations, configuration reference, verification suites, runtime allocation, and owned repository paths.

Rationale:
The manifest is the minimal machine-readable module boundary.

Verification:
Reject manifests with missing identity, ambiguous ownership, undeclared dependencies, invalid versions, or overlapping owned paths.

Implemented by:
- CAP-PKT-001
- CAP-PKT-002
- CAP-PKT-011

Validated by:
- CAP-TEST-001
- CAP-TEST-010

## 18. Operation contracts

### CAP-CONTRACT-004: Operation contract

| Field | Meaning |
|---|---|
| `operationId`, `version` | Stable identity and semantic version |
| `behavior` | `command`, `query`, or `job` |
| `inputSchema`, `outputSchema` | Closed versioned schemas or schema references |
| `preconditions`, `postconditions` | Observable boundary conditions |
| `domainRejections` | Expected valid refusals |
| `technicalErrors` | Allowed error codes from CAP-CONTRACT-006 |
| `sideEffects` | Explicit external or persisted changes |
| `idempotency` | Key, guarantee, or explicit non-idempotence |
| `timeoutClass`, `cancellable` | Execution behavior |
| `artifactTypes` | Allowed artifact outputs |
| `provenanceFields` | Required evidence inputs |

### CAP-DATA-004

Statement:
Every published operation MUST define all fields in `CAP-CONTRACT-004`, and callers MUST depend on the operation contract rather than an implementation file, endpoint, or adapter type.

Rationale:
Stable contracts permit bounded implementation and later adapter substitution.

Verification:
Validate manifest operation references and reject a binding or dependency that names an endpoint or implementation path instead of an operation ID.

Implemented by:
- CAP-PKT-001
- CAP-PKT-002
- CAP-PKT-017

Validated by:
- CAP-TEST-001
- CAP-TEST-024

## 19. Standard result envelope

### CAP-CONTRACT-005: Result envelope

```text
Result<T> =
  | { outcome: "success"; value: T; diagnostics[]; artifacts[]; provenance }
  | { outcome: "domain-rejection"; rejection; diagnostics[]; artifacts[]; provenance }
  | { outcome: "technical-failure"; error; diagnostics[]; artifacts[]; provenance }
  | { outcome: "cancelled"; diagnostics[]; artifacts[]; provenance }
```

### CAP-RUN-001

Statement:
Every runtime operation MUST return exactly one `CAP-CONTRACT-005` outcome and MUST convert uncaught boundary exceptions to a technical-failure error without exposing stack traces or secrets to Guided mode.

Rationale:
Callers need predictable presentation and recovery behavior.

Verification:
Exercise success, rejection, thrown error, and cancellation fixtures.

Implemented by:
- CAP-PKT-017
- CAP-PKT-018

Validated by:
- CAP-TEST-024

## 20. Error taxonomy

### CAP-CONTRACT-006: Error

| Category | Observable meaning | Default recovery |
|---|---|---|
| `validation` | Contract input is invalid | Correct input |
| `domain` | Valid request rejected by rules | Explain and revise request |
| `dependency` | Required capability unavailable | Restore dependency or retry |
| `configuration` | Required configuration absent/invalid | Open setup action |
| `execution` | Tool/runtime failed | Inspect diagnostic and retry/repair |
| `timeout` | Deadline elapsed | Retry or change approved timeout |
| `authorization` | Permission insufficient | Reconnect with approved scope |
| `conflict` | Version, idempotency, or concurrent-state conflict | Refresh and review |

Error records include stable code, category, safe message, retryability, related IDs, and diagnostic references.

## 21. Job model

### CAP-CONTRACT-007: Job record

Job states are `queued`, `running`, `succeeded`, `failed`, and `cancelled`. A record includes job ID, project ID, operation ID/version, input hash, state, progress when known, timestamps, cancellation request, result reference, diagnostics, and artifact references. The local runner serializes MATLAB work per project.

### CAP-RUN-002

Statement:
An operation declared as `job` MUST create and persist a `CAP-CONTRACT-007` record before execution, expose observable terminal state, and honor cancellation when its contract declares `cancellable`.

Rationale:
Long-running tool calls need restart-safe evidence and user control.

Verification:
Start, observe, cancel, and reload a test job; confirm legal transitions and terminal evidence.

Implemented by:
- CAP-PKT-018
- CAP-PKT-021

Validated by:
- CAP-TEST-027

## 22. Artifact model

### CAP-CONTRACT-008: Artifact reference

An artifact reference includes artifact ID, project ID, media/type identifier, checksum, byte size, created time, producing operation/job/run IDs, provenance, storage class, and opaque storage reference. Renderer display uses a bounded bridge response or a user-approved open action.

### CAP-DATA-005

Statement:
Files crossing operation boundaries MUST use `CAP-CONTRACT-008` artifact references; domain operations MUST NOT exchange unexplained absolute filesystem paths.

Rationale:
Artifact identity and policy remain stable across storage choices.

Verification:
Reject operation schemas containing absolute-path fields and verify checksum/provenance on retrieval.

Implemented by:
- CAP-PKT-001
- CAP-PKT-018
- CAP-PKT-019

Validated by:
- CAP-TEST-001
- CAP-TEST-025

## 23. Configuration and secret references

### CAP-CONTRACT-009: Configuration and secret reference

Configuration records include schema version, project/module/adapter scope, non-secret values, readiness state, and secret-reference IDs. A secret reference contains opaque ID, provider kind, label, created time, and last validation time; it never contains the secret value.

### CAP-SEC-001

Statement:
Secret values MUST remain in an approved OS/application credential store, MUST be resolved only in the desktop process, and MUST NOT appear in persisted specifications, logs, diagnostics, packets, renderer state, or artifact content.

Rationale:
Copilot packets and renderer data are not secret boundaries.

Verification:
Seed canary credentials and scan all persisted/exported outputs after adapter setup and failure.

Implemented by:
- CAP-PKT-026
- CAP-PKT-030

Validated by:
- CAP-TEST-022
- CAP-TEST-036
- CAP-TEST-037

## 24. Event model

### CAP-CONTRACT-010: Event envelope

The extension contract includes event ID, event type/version, module ID, project ID, occurred time, correlation/causation IDs, payload schema reference, payload, and provenance. No MVP event bus, subscription UI, replay store, or guaranteed delivery mechanism is created. Modules declare events only for an approved workflow.

## 25. Capability registry

### CAP-CONTRACT-011: Registry entry

A registry entry is derived from an approved manifest plus configuration and verification evidence. It contains module/operation identity, compatible required contracts, runtime allocation, configuration readiness, verification state, freshness state, and evidence references.

### CAP-ARCH-005

Statement:
The project registry MUST be rebuilt deterministically from approved manifests and current evidence and MUST NOT permit direct editing of derived operation, compatibility, or freshness fields.

Rationale:
Registry state must remain explainable and reproducible.

Verification:
Rebuild twice and compare output; attempt direct mutation through the bridge and confirm no operation exists.

Implemented by:
- CAP-PKT-017

Validated by:
- CAP-TEST-023

## 26. Runtime resolver

The MVP resolver maps an operation ID/version to exactly one approved local module or initial adapter. Missing, ambiguous, incompatible, unconfigured, or unverified providers produce typed failure. Approved examples are selected through Preview data mode and are not production providers.

### CAP-RUN-003

Statement:
The resolver MUST select exactly one compatible approved provider for an operation or return a typed configuration, dependency, or conflict failure; it MUST NOT perform health-based routing, remote discovery, or silent fallback to examples.

Rationale:
Deterministic local selection prevents hidden behavior.

Verification:
Exercise zero, one, multiple, incompatible, unconfigured, and example-only provider fixtures.

Implemented by:
- CAP-PKT-017

Validated by:
- CAP-TEST-023

## 27. Local capability runtime

The runtime owns validation, invocation, result conversion, local jobs, diagnostics, artifacts, approved examples, and readiness. It does not own interview data, user approvals, architecture editing, remote routing, or deployment.

### CAP-RUN-004

Statement:
The local runtime MUST validate inputs before invocation, resolve one provider, enforce timeout/cancellation declarations, persist job and artifact evidence when applicable, and return `CAP-CONTRACT-005`.

Rationale:
One boundary centralizes operation semantics without creating a service mesh.

Verification:
Invoke representative immediate and job operations through the named desktop bridge.

Implemented by:
- CAP-PKT-017
- CAP-PKT-018

Validated by:
- CAP-TEST-024
- CAP-TEST-027

## 28. Capability freshness model

### CAP-CONTRACT-012: Freshness record

The record contains module ID/version, specification hash, implementation hash, architecture version/hash, dependency contract hashes, adapter contract hashes, binding hashes, verification suite hashes, verification evidence ID, evaluated time, primary state, and ordered reason codes.

Primary states are `draft`, `ready`, `needs-review`, `verification-needed`, `connection-outdated`, `blocked`, and `failed`. Reason codes distinguish definition, dependency, implementation, verification, connection, configuration, and external-revision causes. UI labels such as “Definition changed” are derived from state and reasons.

### CAP-FRESH-001

Statement:
Freshness MUST be calculated from content hashes, versions, explicit dependencies, and verification provenance and MUST NOT be set directly by Copilot or the renderer.

Rationale:
Deterministic evidence prevents false current status.

Verification:
Attempt state mutation, then change each tracked input independently and compare expected reason codes.

Implemented by:
- CAP-PKT-015

Validated by:
- CAP-TEST-017

### CAP-FRESH-002

Statement:
A module MUST NOT become `ready` unless its current implementation, specification, architecture, required contracts, adapter contracts, and required verification suites match one successful verification record.

Rationale:
Green status must describe exactly what was verified.

Verification:
Alter one provenance input after a successful check and confirm readiness is removed.

Implemented by:
- CAP-PKT-014
- CAP-PKT-015

Validated by:
- CAP-TEST-016
- CAP-TEST-017

## 29. Impact analysis and regeneration ordering

### CAP-CONTRACT-022: Impact record

An impact record contains change ID, initiating record/revision, change classification, affected and unaffected module IDs with reasons, proposed dependency-ordered packets, user approval, and recalculation evidence.

Classifications are `implementation-only`, `optional-additive`, `required-additive`, and `breaking`. Ordering is provider first, then workflow, then experience/binding, with stable-ID tie breaking.

### CAP-FRESH-003

Statement:
Impact analysis MUST derive candidate affected modules from approved dependency and binding edges, display affected and unaffected reasons, require approval, and generate no delta packet before approval.

Rationale:
Semantic proposals require deterministic scope and user control.

Verification:
Change a provider contract in a branched fixture and confirm both affected and unaffected explanations.

Implemented by:
- CAP-PKT-016

Validated by:
- CAP-TEST-018

### CAP-FRESH-004

Statement:
Approved regeneration ordering MUST be acyclic, provider-first, workflow-second, and experience/binding-last, and MUST emit one delta packet at a time.

Rationale:
Consumers must not update against unavailable provider contracts.

Verification:
Compare the generated order with a known dependency fixture and confirm only the first incomplete packet is actionable.

Implemented by:
- CAP-PKT-016

Validated by:
- CAP-TEST-019

## 30. Architecture visualization

The diagram is a derived projection. Guided nodes show capability name, purpose group, tools/data, status text/icon, and focus neighbors. Design nodes add module type, operations, versions, runtime allocation, files, dependency direction, hashes, and evidence. Proposed nodes are dashed; suggested unapproved connections are dotted. Color is redundant with text and shape.

### CAP-UX-002

Statement:
The architecture diagram MUST derive nodes and edges from approved/proposed records, MUST expose status without color alone, and MUST provide keyboard selection and a non-graph list alternative.

Rationale:
The central design surface must remain accurate and accessible.

Verification:
Compare diagram and list IDs, navigate both by keyboard, and run automated accessibility checks.

Implemented by:
- CAP-PKT-010
- CAP-PKT-031

Validated by:
- CAP-TEST-012
- CAP-TEST-038

## 31. Capabilities page information architecture

The top-level page contains Application definition, Architecture, Needs attention, Modules, Connections, and Verification. The selected project owns page context. No active project shows a project-selection action rather than creating implicit data.

### CAP-UX-003

Statement:
Primary navigation MUST include a `Capabilities` destination at the same level as Build & Test, and the page MUST preserve existing Build & Test run navigation and resume behavior.

Rationale:
Capabilities is a peer product area, not another Build step.

Verification:
Run navigation tests with no run, an active legacy run, a completed run, and a selected Capabilities project.

Implemented by:
- CAP-PKT-006

Validated by:
- CAP-TEST-004

### CAP-UX-004

Statement:
The Needs attention view MUST order actionable modules by approved dependency order and display state, reason, blocking record, and one next action.

Rationale:
Users need an explainable maintenance queue.

Verification:
Render mixed stale, blocked, and failed fixtures and compare order and action labels.

Implemented by:
- CAP-PKT-007
- CAP-PKT-016

Validated by:
- CAP-TEST-020

## 32. Module and connection lifecycle

```text
draft interview -> validated specification -> approved readiness
-> packet exported -> overlay inspected -> overlay applied
-> verification recorded -> ready -> connected
```

Each transition records actor, time, source revision, resulting revision, and gate/evidence IDs. A failed verification remains implemented but not ready. A connection has its own specification, binding version, overlay scope, verification, and freshness.

### CAP-DATA-006

Statement:
Lifecycle transitions MUST reject missing prerequisites, persist an append-only transition record, and preserve the last approved revision when a later draft fails validation.

Rationale:
Lifecycle state must be auditable and recoverable.

Verification:
Attempt every invalid transition and reload after a failed draft import.

Implemented by:
- CAP-PKT-003
- CAP-PKT-004
- CAP-PKT-011

Validated by:
- CAP-TEST-011
- CAP-TEST-013
- CAP-TEST-021

## 33. Copilot interview packet contracts

### CAP-CONTRACT-014: Interview packet

| Field | Required content |
|---|---|
| Packet control | Packet ID/version, project ID, interview kind, generated time |
| Input context | Record IDs, revisions, hashes, approved facts, applicable glossary |
| Interview boundary | Purpose, question budget, required topics, explicit exclusions |
| State labels | Confirmed facts, proposals, unresolved questions |
| Output | Exact response schema and one output filename |
| Gate | Gate ID and blocking conditions |
| Safety | No credentials, no silent approval, no source implementation |

The MVP output filename is `capability-interview-response.json`. The exact upload grouping follows the existing three-file budget.

## 34. Copilot implementation packet contracts

### CAP-CONTRACT-015: Implementation packet

| Field | Required content |
|---|---|
| Control | Packet ID/version/kind, project/module/connection IDs, generated time |
| Provenance | Specification, architecture, dependency, adapter, and example hashes |
| Objective | One module or one connection outcome |
| Contracts | Target manifest, public contracts, direct dependency contracts |
| Scope | Allowed paths, expected returned paths, protected paths, exclusions |
| Architecture | Applicable `CAP-AR-*` rules and validation action |
| Verification | Required suites, acceptance cases, expected evidence |
| Output | One `ui-overlay.zip`, changed/new files only, no deletion semantics |
| Conflict behavior | Report conflicts; do not bypass or broaden scope |

### CAP-HANDOFF-003

Statement:
Every implementation packet MUST conform to `CAP-CONTRACT-015`, contain one module or one connection, persist its exact scope and input hashes, and fit the existing external-Copilot upload budget.

Rationale:
Small immutable handoffs can be inspected and reproduced.

Verification:
Generate domain-module and connection packets and validate required sections, hashes, upload count, and scope.

Implemented by:
- CAP-PKT-012

Validated by:
- CAP-TEST-014

### CAP-HANDOFF-004

Statement:
Capability overlay inspection MUST treat any returned file outside the packet's persisted allowed paths as a hard blocker and MUST retain all existing generic overlay safety blockers and explicit-warning acceptance.

Rationale:
Capability packets promise a stronger bounded scope than current project-wide UI packets.

Verification:
Inspect overlays containing allowed, protected, traversal, secret, and unrelated repository files.

Implemented by:
- CAP-PKT-013

Validated by:
- CAP-TEST-015

## 35. Delta-update packet contracts

### CAP-CONTRACT-016: Delta packet

A delta packet extends `CAP-CONTRACT-015` with change reason, approved impact record ID, previous and target contract versions, behavior to preserve, behavior to add/change, new tests, and explicitly unchanged modules. It never requests application-wide regeneration.

### CAP-HANDOFF-005

Statement:
Delta packets MUST reference one approved impact record, one target module or connection, preserved behavior, changed behavior, added tests, unchanged neighbors, and a scope no broader than that target.

Rationale:
Localized change should not trigger unrelated regeneration.

Verification:
Generate a delta packet for a breaking provider change and verify excluded neighboring modules are named.

Implemented by:
- CAP-PKT-016

Validated by:
- CAP-TEST-019

## 36. Overlay scope and inspection rules

Capability runs add `runKind`, `scopeOwnerId`, `allowedPaths`, `expectedPaths`, and `protectedPaths` to persisted run scope. Scope is captured at packet generation and cannot be widened by imported overlay metadata. Existing UI handoff behavior remains warning-based for expected-file mismatches; capability runs use the hard-block rule in CAP-HANDOFF-004.

## 37. Verification framework

### CAP-CONTRACT-017: Verification record

The record includes verification ID, project/module/connection IDs, suite IDs/versions/hashes, specification hash, implementation hash, architecture hash/version, dependency and adapter contract hashes, binding hashes when applicable, command/check results, artifacts, diagnostics, started/ended times, and final outcome.

Suite selection rules:

| Module type | Required coverage |
|---|---|
| Domain | Contracts, rules, units, examples, bounds, rejection, tolerances |
| Workflow | Main/alternate scenarios, states, cancellation, recovery, guarantees |
| Connection | Readiness, translation, timeout, cancellation, external errors, compatibility |
| Platform | Health, persistence, permissions, isolation, recovery |
| Experience/binding | Build/typecheck, accessibility, mapping, all presentation states, responsive behavior |
| All | Architecture rules and traceability |

### CAP-ARCH-006

Statement:
Verification MUST select suites from the approved manifest/module type, persist `CAP-CONTRACT-017`, and separate setup failure, domain rejection, technical failure, cancellation, and unverified state.

Rationale:
One green label cannot conflate readiness and behavior.

Verification:
Run fixtures for each outcome class and compare persisted provenance.

Implemented by:
- CAP-PKT-014

Validated by:
- CAP-TEST-016

## 38. Preview component selection

The existing injected Preview picker is the starting mechanism. `CAP-CONTRACT-013` selection evidence contains route, document title, selector, visible text, element tag/role/name, stable marker when present, and capture time. DOM selectors are evidence, not sufficient source identity.

### CAP-UX-005

Statement:
Preview selection MUST capture bounded element evidence and MUST require either an approved stable element marker or explicit user confirmation of the proposed source target before a binding packet is generated.

Rationale:
DOM structure does not reliably identify React source.

Verification:
Select marked and unmarked elements, navigate routes, and confirm the unmarked case blocks packet generation until confirmation.

Implemented by:
- CAP-PKT-023

Validated by:
- CAP-TEST-029

## 39. Frontend binding model

### CAP-CONTRACT-013: Frontend binding

```yaml
schemaVersion: "1.0"
bindingId: "binding.example"
bindingVersion: "1.0.0"
projectId: "project-id"
selectionEvidence: {}
trigger: "activate|change|submit|load"
operationId: "operation.example"
operationVersion: "1.0.0"
inputMappings: []
outputMappings: []
loadingPresentation: {}
validationPresentation: {}
domainRejectionPresentation: {}
technicalFailurePresentation: {}
cancellationBehavior: "none|user-action|on-navigation"
duplicateSubmissionBehavior: "allow|block|idempotency-key"
dataMode: "connected|approved-example|invalid-input|dependency-unavailable|timeout"
```

The example is non-normative. Requirements are carried by CAP-UX-006 and CAP-RUN-005.

### CAP-UX-006

Statement:
A binding MUST name one operation ID/version, explicit trigger, input/output mappings, loading, validation, domain-rejection, technical-failure, cancellation, duplicate-submission, data-mode behavior, version, and selection evidence.

Rationale:
Observable UI behavior must be complete before Copilot changes frontend code.

Verification:
Validate complete and incomplete binding fixtures and render every presentation mode.

Implemented by:
- CAP-PKT-024
- CAP-PKT-025

Validated by:
- CAP-TEST-030
- CAP-TEST-031

## 40. Example and failure simulation

Approved examples contain stable ID/version, operation contract version, input, expected result, tolerance or matching rule, and source. Invalid-input, dependency-unavailable, and timeout modes return standard envelopes without calling a real external adapter. Simulation state is visibly labeled and cannot mark production connection verification successful.

### CAP-RUN-005

Statement:
Preview data modes MUST be explicit, visibly labeled, and isolated; simulated results MUST NOT invoke real adapters or satisfy connected-path verification.

Rationale:
Examples and failures help review but cannot masquerade as production evidence.

Verification:
Exercise every mode with adapter spies and inspect verification eligibility.

Implemented by:
- CAP-PKT-025

Validated by:
- CAP-TEST-031

## 41. Filesystem adapter

The adapter exposes project-scoped read, write, discover, artifact-create, artifact-retrieve, checksum, and provenance operations only when declared by an approved port. Policy roots distinguish source, generated output, configuration, input data, and artifacts.

### CAP-ADAPT-001

Statement:
Filesystem operations MUST resolve project-relative paths against an approved named policy root and MUST reject absolute input, traversal, symlink escape, disallowed root access, and writes outside the operation's declared policy.

Rationale:
Project scope must survive path normalization and filesystem indirection.

Verification:
Run path, traversal, symlink, and cross-root hostile fixtures on each supported operating system.

Implemented by:
- CAP-PKT-019

Validated by:
- CAP-TEST-025

### CAP-ADAPT-002

Statement:
Filesystem read/write results MUST return content or `CAP-CONTRACT-008` references with checksum and provenance and MUST NOT expose host absolute paths through operation results.

Rationale:
Callers depend on portable identity rather than storage layout.

Verification:
Create and retrieve an artifact, verify its checksum, and scan the returned envelope for the project root.

Implemented by:
- CAP-PKT-019

Validated by:
- CAP-TEST-025

## 42. MATLAB adapter

MVP primitives are installation/version/toolbox readiness, session start/reuse/stop, named function call, approved script, allowlisted expression, workspace put/get/list/clear for approved variables, approved path and working-directory changes, timeout/cancellation, value conversion, and capture of warnings/errors/console/figures/files.

Supported values are null, booleans, strings, finite numeric scalars, arrays, structures, numeric multidimensional arrays, and artifact references. Unsupported values return a typed validation or execution error; they are not stringified silently.

### CAP-ADAPT-003

Statement:
MATLAB execution MUST occur in the desktop process through approved named operations, MUST enforce configured function/script/expression allowlists, and MUST convert values and diagnostics through versioned contracts.

Rationale:
Raw engine access would bypass approvals and renderer isolation.

Verification:
Attempt approved and unapproved primitives, supported and unsupported values, and diagnostic-producing calls.

Implemented by:
- CAP-PKT-020
- CAP-PKT-021

Validated by:
- CAP-TEST-026
- CAP-TEST-027

## 43. MATLAB session persistence

### CAP-CONTRACT-019: MATLAB session record

The record contains project ID, session ID, state (`stopped`, `starting`, `ready`, `busy`, `unhealthy`), MATLAB version, toolbox readiness, process ownership, start/last-used times, initialization recipe revision, in-memory-state revision, current job ID, and last diagnostic ID. The record contains no engine handle.

One project has at most one app-owned session. It starts lazily, survives calls, serializes project calls, stops on explicit action or desktop exit, and becomes unhealthy after a crash. Restart invalidates in-memory readiness and reruns only an approved initialization recipe.

### CAP-ADAPT-004

Statement:
The MVP MUST enforce one app-owned MATLAB session per project, serialize that project's MATLAB calls, expose deterministic health state, and recreate the session after failure without claiming prior in-memory state remains loaded.

Rationale:
The policy enables reuse while preserving project isolation and honest readiness.

Verification:
Run repeated, concurrent, cross-project, crash, restart, stop, and desktop-exit scenarios.

Implemented by:
- CAP-PKT-020

Validated by:
- CAP-TEST-026
- CAP-TEST-027

## 44. MATLAB durable persistence

Selected variables are saved to a project-scoped MAT snapshot with metadata: snapshot ID, project ID, variable allowlist, MATLAB version, checksum, created time, operation/job ID, initialization revision, and compatibility status. Restore validates scope, checksum, MATLAB compatibility, and variable list before import. Failure leaves the session usable but uninitialized.

### CAP-ADAPT-005

Statement:
MATLAB durable persistence MUST save and restore only explicitly approved variables with `CAP-CONTRACT-008` artifact and snapshot metadata, and MUST NOT serialize the entire workspace by default.

Rationale:
Selective persistence limits stale, sensitive, or incompatible state.

Verification:
Save selected variables beside unselected variables, restart, restore, and verify only selected values return; then test corrupt and incompatible snapshots.

Implemented by:
- CAP-PKT-022

Validated by:
- CAP-TEST-028

## 45. Azure DevOps adapter

MVP operations are credential/configuration validation, organization/project/repository discovery, read-only work-item and revision retrieval, requirement/acceptance import, capability linkage, pipeline discovery/status, optionally approved pipeline invocation, test-result retrieval, and referenced build-artifact metadata/retrieval. CAP-DEC-012 decides whether invocation is included.

### CAP-CONTRACT-020: Azure DevOps provenance

Imported records contain organization/project identity, external type/ID, revision, URL, retrieved time, content hash, selected field mapping, and source adapter version. Pipeline/test evidence adds pipeline/run/test/artifact IDs and server timestamps.

### CAP-ADAPT-006

Statement:
The Azure DevOps adapter MUST use least-privilege secret references, preserve external identity and revision, treat newer revisions as proposed impact, and MUST NOT mutate work items, repositories, branches, or artifacts in the MVP.

Rationale:
Enterprise traceability must not silently change product truth or external state.

Verification:
Import a work item, observe a newer revision, inspect impact gating, and attempt prohibited mutations.

Implemented by:
- CAP-PKT-026
- CAP-PKT-027
- CAP-PKT-028

Validated by:
- CAP-TEST-033
- CAP-TEST-034
- CAP-TEST-035
- CAP-TEST-036

## 46. Security and trust boundaries

| Boundary | Trusted input | Untrusted input | Enforcement owner |
|---|---|---|---|
| Copilot import | Schema/version envelope | All field content and paths | Core validator + user approval |
| Overlay | Persisted packet scope | Zip names/content | Core inspector + desktop apply |
| Renderer bridge | Named serializable request | Renderer arguments | Desktop handler validation |
| Filesystem | Project/policy roots | Relative paths and file content | Filesystem adapter |
| MATLAB | Approved contracts/allowlists | Function values and tool output | MATLAB adapter |
| Azure DevOps | Configured organization/scopes | Remote content and revisions | Azure adapter + impact gate |
| Secret store | Opaque reference | Renderer/packet/log sinks | Desktop secret resolver |

### CAP-SEC-002

Statement:
Consequential local writes, MATLAB scripts or expressions, durable-state restore, and pipeline invocation MUST require an approved operation and an explicit user action; background refresh MUST remain read-only.

Rationale:
User supervision is required at consequential boundaries.

Verification:
Attempt each action through reload, background refresh, imported packet, and direct bridge request without approval.

Implemented by:
- CAP-PKT-019
- CAP-PKT-021
- CAP-PKT-022
- CAP-PKT-028
- CAP-PKT-030

Validated by:
- CAP-TEST-032
- CAP-TEST-037

### CAP-SEC-003

Statement:
Diagnostics shown or persisted outside privileged adapter internals MUST redact credentials, secret values, authorization headers, and host-sensitive paths while retaining stable codes and actionable safe context.

Rationale:
Failure evidence must be useful without leaking sensitive material.

Verification:
Generate adapter failures containing canary secrets and paths, then scan renderer data, logs, packets, and records.

Implemented by:
- CAP-PKT-030

Validated by:
- CAP-TEST-036
- CAP-TEST-037

## 47. Persistence and state model

### CAP-CONTRACT-001: Application specification

Contains schema version, project ID, record ID/revision/status, purpose/outcomes, actors/goals, use cases/scenarios, information, rules, external systems, constraints, scope, acceptance cases, sources, unresolved questions, approval metadata, and content hash.

### CAP-CONTRACT-002: Architecture specification

Contains schema version, project ID, record ID/revision/status, application-spec revision/hash, capability projections, module IDs, dependency edges, operation allocations, adapter/platform allocations, workflow traces, proposals, unresolved questions, gate result, approval metadata, and content hash.

### CAP-CONTRACT-018: Adapter configuration

Contains schema version, project/adapter IDs, adapter contract version, non-secret settings, secret-reference IDs, permission summary, readiness result, and revision/hash.

### CAP-CONTRACT-021: Capability run scope

Contains run ID/kind, project ID, target owner ID, lifecycle state, input revision/hashes, allowed/expected/protected paths, packet/artifact references, inspection/application/verification references, transition history, and created/updated/completed times.

### CAP-DATA-007

Statement:
Capability records MUST use stable IDs, schema versions, immutable approved revisions, atomic writes, content hashes, and explicit references; derived diagrams, registry entries, freshness, and status labels MUST be reproducible from those records.

Rationale:
File-based persistence requires strong record discipline to remain reliable.

Verification:
Round-trip, interrupt, reload, and rebuild derived state from fixtures.

Implemented by:
- CAP-PKT-003
- CAP-PKT-004
- CAP-PKT-015
- CAP-PKT-017

Validated by:
- CAP-TEST-011
- CAP-TEST-013
- CAP-TEST-017
- CAP-TEST-023

### CAP-DATA-008

Statement:
Legacy `Project`, `HandoffRun`, overlay, and verification records MUST retain their existing meaning and remain readable; Capabilities MUST introduce explicit record kinds or new records instead of reinterpreting UI-only fields.

Rationale:
Existing projects and open Build & Test runs must not be corrupted.

Verification:
Load pre-Capabilities fixtures, resume Build & Test, create capability records, and confirm byte-preserving legacy behavior where no migration is required.

Implemented by:
- CAP-PKT-004
- CAP-PKT-029

Validated by:
- CAP-TEST-013
- CAP-TEST-039

## 48. Existing files and packages likely to change

| Existing path | Expected change |
|---|---|
| `packages/core/src/index.ts` | Export capability contracts and services. |
| `packages/core/src/overlay.ts` | Add a capability-run hard scope policy without changing legacy defaults. |
| `packages/core/src/persistence.ts` | Compose or expose capability-specific stores; preserve current API. |
| `packages/core/src/types.ts` | Add only shared discriminators/references that belong beside legacy types. |
| `packages/core/test/` | Add contract, persistence, scope, freshness, graph, packet, and runtime tests. |
| `apps/desktop/src/bridgeApi.ts` | Add named capability bridge methods. |
| `apps/desktop/src/preload.cts` | Forward the named methods. |
| `apps/desktop/src/ipc.ts` | Register capability persistence/runtime/adapter handlers or delegate registration. |
| `apps/gui/src/bridge.ts` | Mirror capability bridge methods and types. |
| `apps/gui/src/mockBridge.ts` | Add deterministic capability fixtures. |
| `apps/gui/src/appState.ts` | Add Capabilities navigation and state helpers. |
| `apps/gui/src/App.tsx` | Mount page and own selected project/mode state. |
| `apps/gui/src/views/workflow.tsx` | Extract/extend Preview selection and binding entry points. |
| `apps/gui/src/styles.css` | Capabilities layout and states using existing tokens. |
| `apps/gui/test/` | Navigation, projections, gates, diagram, selection, binding, accessibility tests. |
| `standards/schemas/` | Add capability schema family. |
| `standards/validation/` | Add capability schema and cross-reference validation. |
| `standards/copilot-handoff/` | Add interview, implementation, delta, and scope contracts. |

## 49. Proposed files and packages

All paths below are proposed. Cursor packets may adjust filenames within the shown owner folder when a concrete existing convention requires it; responsibilities and dependencies remain fixed.

```text
packages/core/src/capabilities/
  types.ts
  validation.ts
  gates.ts
  graph.ts
  freshness.ts
  impact.ts
  persistence.ts
  packets.ts
  registry.ts
  runtime.ts
  results.ts
  artifacts.ts
  jobs.ts
  filesystem.ts

apps/desktop/src/capabilities/
  ipc.ts
  runtimeHost.ts
  artifactStore.ts
  secretStore.ts
  filesystemAdapter.ts
  matlabAdapter.ts
  matlabSessions.ts
  matlabSnapshots.ts
  azureDevOpsAdapter.ts

apps/gui/src/views/capabilities/
  CapabilitiesView.tsx
  ApplicationDefinition.tsx
  ArchitectureView.tsx
  NeedsAttention.tsx
  ModulesView.tsx
  ConnectionsView.tsx
  VerificationView.tsx
  InterviewImport.tsx
  PreviewBinding.tsx

standards/schemas/capabilities/
  *.schema.json

standards/copilot-handoff/capabilities/
  interview-packet-contract.md
  implementation-packet-contract.md
  delta-packet-contract.md
  overlay-scope-contract.md
```

Illustrative paths requiring CAP-DEC-003 and CAP-DEC-005:

```text
<app-user-data>/workspace/projects/<projectId>/capabilities/...
<target-repository>/<capabilityModuleRoot>/<moduleId>/...
```

No new workspace package, service package, database, queue package, or deployment package is proposed.

## 50. Migration and backward compatibility

Capability storage starts at schema version 1. New readers accept missing capability directories as “not initialized.” Migration creates capability indexes only after project selection; it does not rewrite legacy run files. Future-version records are opened read-only with an upgrade diagnostic. Interrupted writes retain the last atomic record. Schema migration is idempotent and writes a migration evidence record.

### CAP-ARCH-007

Statement:
Capability initialization and migration MUST be idempotent, MUST preserve legacy Build & Test data and behavior, and MUST fail read-only when a stored schema is newer than the application understands.

Rationale:
Local-first persistence must not make upgrade failures destructive.

Verification:
Run clean, repeated, interrupted, legacy, and future-version migration fixtures.

Implemented by:
- CAP-PKT-029

Validated by:
- CAP-TEST-039

## 51. Observability and diagnostics

Diagnostics use stable code, category, severity, safe summary/detail, related record IDs, operation/job/run IDs, timestamps, remediation action, and privileged-detail reference when available. Guided mode shows safe summaries; Design mode may show sanitized structured detail and captured command/tool output. Logs are local and bounded by the existing run/artifact retention decision.

## 52. Accessibility and UX requirements

### CAP-QUAL-001

Statement:
Capabilities workflows MUST be fully keyboard operable, expose visible focus, use programmatic labels and status announcements, preserve focus across dialogs and mode switches, and provide text/icon equivalents for all color states.

Rationale:
The product serves technical users across varied interaction needs.

Verification:
Run keyboard, screen-reader semantics, contrast, focus, and reduced-motion checks on each primary journey.

Implemented by:
- CAP-PKT-006
- CAP-PKT-007
- CAP-PKT-010
- CAP-PKT-023
- CAP-PKT-024
- CAP-PKT-031

Validated by:
- CAP-TEST-038

### CAP-QUAL-002

Statement:
Every asynchronous Capabilities action MUST expose pending, success, empty, blocked, domain-rejection, technical-failure, and recovery presentation when applicable, without replacing actionable text with raw logs.

Rationale:
Users need accurate state and next action during supervised execution.

Verification:
Render the state catalogue for interviews, verification, adapters, jobs, and bindings.

Implemented by:
- CAP-PKT-007
- CAP-PKT-018
- CAP-PKT-025
- CAP-PKT-031

Validated by:
- CAP-TEST-038

## 53. Performance and responsiveness requirements

### CAP-QUAL-003

Statement:
Opening the Capabilities page and switching Guided/Design projections SHOULD complete within 200 milliseconds for 100 modules and 300 edges on reference development hardware, excluding first disk load; graph/freshness recomputation SHOULD complete within 500 milliseconds for that fixture.

Rationale:
Local deterministic projections should feel immediate at expected MVP scale.

Verification:
Measure p95 over 20 runs using the fixed 100-module fixture and record hardware.

Implemented by:
- CAP-PKT-007
- CAP-PKT-010
- CAP-PKT-015
- CAP-PKT-031

Validated by:
- CAP-TEST-041

### CAP-QUAL-004

Statement:
Long-running filesystem, MATLAB, Azure DevOps, verification, and binding actions MUST leave renderer navigation responsive, expose progress when known, and permit contract-declared cancellation.

Rationale:
Privileged work must not block the desktop interface.

Verification:
Run delayed adapter fixtures while navigating, switching modes, and cancelling.

Implemented by:
- CAP-PKT-018
- CAP-PKT-019
- CAP-PKT-021
- CAP-PKT-025
- CAP-PKT-028
- CAP-PKT-031

Validated by:
- CAP-TEST-027
- CAP-TEST-041

## 54. Failure and recovery behavior

| Failure | Required recovery |
|---|---|
| Invalid interview import | Preserve draft, show field diagnostics, keep prior approved revision |
| Architecture cycle | Block approval, focus cycle path |
| Packet inputs changed | Mark packet stale; require regeneration |
| Overlay blocked | Apply unavailable; export corrected repair prompt |
| Apply succeeds, verification fails | Implementation remains applied; state becomes verification-needed/failed |
| Desktop restarts during job | Record interrupted failure unless adapter can prove terminal result |
| MATLAB crashes | Mark session unhealthy; preserve durable snapshots; allow restart |
| Snapshot restore fails | Keep new session usable but uninitialized |
| Azure unavailable/rate-limited | Preserve cached provenance as stale; do not claim current |
| Preview selection invalid after navigation | Require re-selection or user-confirmed source target |
| Future record version | Read-only diagnostic; no downgrade write |

## 55. Delivery phases

| Phase | Packets | Exit gate |
|---|---|---|
| 0. Contracts and validators | CAP-PKT-001–002 | Version 1 schemas and deterministic validators pass fixtures. |
| 1. Persistence and bridge | CAP-PKT-003–005 | Records round-trip and named bridge operations are available. |
| 2. Navigation and product definition | CAP-PKT-006–008 | Product interview imports and passes approval gate. |
| 3. Architecture planning | CAP-PKT-009–010 | Minimal architecture is approved and rendered. |
| 4. Module lifecycle | CAP-PKT-011–014 | One module is scoped, applied, and verified. |
| 5. Freshness and delta updates | CAP-PKT-015–016 | Changes produce explained ordered delta work. |
| 6. Local runtime and filesystem | CAP-PKT-017–019 | Local operations and project-scoped files work through contracts. |
| 7. MATLAB | CAP-PKT-020–022 | Persistent session and selected durable state pass tests. |
| 8. Preview bindings | CAP-PKT-023–025 | Selected UI invokes or simulates a named operation correctly. |
| 9. Azure DevOps | CAP-PKT-026–028 | Requirements and verification evidence retain external provenance. |
| 10. Hardening | CAP-PKT-029–032 | Migration, security, UX, performance, and end-to-end tests pass. |

## 56. Implementation packets

### CAP-PKT-001: Version 1 contracts and schemas

Objective:
Define the domain-neutral schema family and shared contract types.

Depends on:
- Approved CAP-DEC-004.

Allowed scope:
- `standards/schemas/capabilities/`
- `packages/core/src/capabilities/types.ts`
- Contract fixtures under `packages/core/test/`

Inputs:
- CAP-CONTRACT-001 through CAP-CONTRACT-022.
- Existing `standards/schemas/` conventions.

Required changes:
- Add versioned schemas, stable enums, IDs, revisions, hashes, and valid/invalid fixtures.
- Establish one source or generated parity check between persisted schemas and TypeScript types.

Contracts created or changed:
- CAP-CONTRACT-001 through CAP-CONTRACT-022.

Explicit exclusions:
- Persistence, UI, adapters, runtime, and schema migration.

Verification:
- CAP-TEST-001.

Completion criteria:
- Every contract has valid and invalid fixtures; schema/type drift check passes.

### CAP-PKT-002: Validators, gates, and architecture rules

Objective:
Implement deterministic schema, reference, gate, dependency, traceability, and architecture validation.

Depends on:
- CAP-PKT-001.

Allowed scope:
- `packages/core/src/capabilities/validation.ts`
- `packages/core/src/capabilities/gates.ts`
- `packages/core/src/capabilities/graph.ts`
- `standards/validation/`
- Core tests/fixtures.

Inputs:
- CAP-GATE-001 through CAP-GATE-003.
- CAP-AR-001 through CAP-AR-010.

Required changes:
- Return ordered stable diagnostics.
- Validate references, owned paths, trace coverage, compatibility, and cycles.

Contracts created or changed:
- Gate result and diagnostic portions of CAP-CONTRACT-001 through CAP-CONTRACT-003.

Explicit exclusions:
- Persistence and UI.

Verification:
- CAP-TEST-002.

Completion criteria:
- Determinism and hostile fixtures pass with exact expected rule IDs.

### CAP-PKT-003: Capability definition persistence

Objective:
Persist application, architecture, module, connection, interview, approval, and transition records atomically.

Depends on:
- CAP-PKT-001.
- CAP-DEC-005.

Allowed scope:
- `packages/core/src/capabilities/persistence.ts`
- Minimal composition changes in `packages/core/src/persistence.ts` and `index.ts`
- Persistence tests.

Inputs:
- Existing `Workspace` atomic-write pattern.
- CAP-CONTRACT-001, CAP-CONTRACT-002, CAP-CONTRACT-003, CAP-CONTRACT-013, CAP-CONTRACT-014.

Required changes:
- Add immutable approved revisions, mutable drafts, indexes, transition records, and read-only future-version detection.

Contracts created or changed:
- Capability persistence layout and revision API.

Explicit exclusions:
- Capability runs, jobs, artifacts, adapters, and GUI.

Verification:
- CAP-TEST-011.

Completion criteria:
- Round-trip, interrupted-write, approval, and last-approved-preservation tests pass.

### CAP-PKT-004: Capability run and evidence persistence

Objective:
Persist scoped capability runs, packets, jobs, artifacts, verification, freshness, and impact evidence without changing legacy run meaning.

Depends on:
- CAP-PKT-003.

Allowed scope:
- Capability persistence/types files.
- Minimal additive fields/discriminators in existing core types when required.
- Persistence tests.

Inputs:
- CAP-CONTRACT-007, CAP-CONTRACT-008, CAP-CONTRACT-012, CAP-CONTRACT-017, CAP-CONTRACT-021, CAP-CONTRACT-022.
- Existing `HandoffRun` fixtures.

Required changes:
- Add explicit capability run kind/scope and append-only transitions.
- Preserve legacy read/write behavior.

Contracts created or changed:
- CAP-CONTRACT-021 and evidence record references.

Explicit exclusions:
- Packet generation, overlay changes, and runtime execution.

Verification:
- CAP-TEST-013.

Completion criteria:
- New and legacy records coexist and reload without reinterpretation.

### CAP-PKT-005: Named capability bridge contracts

Objective:
Expose serializable persistence and lifecycle operations through the existing narrow bridge.

Depends on:
- CAP-PKT-003.
- CAP-PKT-004.

Allowed scope:
- `apps/desktop/src/bridgeApi.ts`
- `apps/desktop/src/preload.cts`
- `apps/gui/src/bridge.ts`
- `apps/gui/src/mockBridge.ts`
- Proposed `apps/desktop/src/capabilities/ipc.ts`

Inputs:
- Capability persistence APIs.
- Existing bridge channel conventions.

Required changes:
- Add explicit list/get/create-draft/import/approve/evaluate-gate and run/evidence methods.
- Validate all desktop handler arguments.

Contracts created or changed:
- `EuikBridge` capability surface.

Explicit exclusions:
- Generic filesystem, shell, adapter clients, and UI.

Verification:
- CAP-TEST-003.

Completion criteria:
- Desktop, preload, renderer, and mock surfaces have parity and prohibited generic methods are absent.

### CAP-PKT-006: Capabilities navigation and page shell

Objective:
Add the top-level destination and project-context page shell.

Depends on:
- CAP-PKT-005.

Allowed scope:
- `apps/gui/src/appState.ts`
- `apps/gui/src/App.tsx`
- Proposed `apps/gui/src/views/capabilities/CapabilitiesView.tsx`
- Relevant GUI tests/styles.

Inputs:
- Existing typed navigation and run resume helpers.

Required changes:
- Add Capabilities nav/view, selected project behavior, empty project action, and mode control shell.

Contracts created or changed:
- Renderer `ViewId` and navigation configuration.

Explicit exclusions:
- Interview, diagram, module cards, and adapter UI.

Verification:
- CAP-TEST-004.

Completion criteria:
- Existing Build & Test navigation/resume tests and new Capabilities navigation tests pass.

### CAP-PKT-007: Canonical projections and page sections

Objective:
Render Guided and Design projections plus the six page sections from the same records.

Depends on:
- CAP-PKT-006.
- CAP-PKT-003.

Allowed scope:
- `apps/gui/src/views/capabilities/`
- Relevant GUI tests/styles.

Inputs:
- Persisted record read models and freshness fixtures.

Required changes:
- Add Application definition, Architecture placeholder, Needs attention, Modules, Connections, and Verification sections.
- Implement shared record selection and mode projection.

Contracts created or changed:
- None.

Explicit exclusions:
- Editing graph edges, live runtime calls, and adapters.

Verification:
- CAP-TEST-005.
- CAP-TEST-020.

Completion criteria:
- Both modes show identical record/revision identity and all empty/loading/error states.

### CAP-PKT-008: Product interview import and gate

Objective:
Export a bounded product interview, import its response, show deltas, evaluate CAP-GATE-001, and approve a revision.

Depends on:
- CAP-PKT-002.
- CAP-PKT-003.
- CAP-PKT-007.
- CAP-DEC-002.

Allowed scope:
- Core interview packet builder/validator.
- Capability interview GUI.
- Named bridge handlers.
- Handoff standards contract.

Inputs:
- CAP-CONTRACT-001 and CAP-CONTRACT-014.

Required changes:
- Generate files within upload budget, parse one JSON response, preserve invalid drafts, render confirmed/proposed/unresolved states, and gate approval.

Contracts created or changed:
- CAP-CONTRACT-014 product-interview specialization.

Explicit exclusions:
- Integrated Copilot chat and architecture design.

Verification:
- CAP-TEST-006.
- CAP-TEST-007.

Completion criteria:
- Approved application specification is produced without unreviewed import mutation.

### CAP-PKT-009: Architecture planning import and gate

Objective:
Export architecture context, import a minimal proposal, validate traces/dependencies, and approve CAP-GATE-002.

Depends on:
- CAP-PKT-008.
- CAP-PKT-002.
- CAP-DEC-003.

Allowed scope:
- Core architecture interview packet and validators.
- Capability architecture GUI/import.
- Named bridge handlers.

Inputs:
- Approved application specification, available adapter contracts, reusable manifests, architecture rules.

Required changes:
- Import module responsibilities/exclusions, dependencies, operations, adapter allocations, and workflow traces.
- Present minimality and cycle findings.

Contracts created or changed:
- CAP-CONTRACT-002 and architecture specialization of CAP-CONTRACT-014.

Explicit exclusions:
- Diagram editing and module implementation.

Verification:
- CAP-TEST-008.
- CAP-TEST-009.

Completion criteria:
- A valid minimal architecture can be approved; unsupported or cyclic proposals cannot.

### CAP-PKT-010: Architecture diagram and list projection

Objective:
Render accessible Guided and Design architecture projections.

Depends on:
- CAP-PKT-009.
- CAP-DEC-006.

Allowed scope:
- Architecture GUI components/styles/tests.
- Core graph projection helpers only when needed.

Inputs:
- Approved/proposed architecture, registry/freshness fixture data.

Required changes:
- Add stable layout, focus neighbors, status language, keyboard navigation, and equivalent list.

Contracts created or changed:
- None.

Explicit exclusions:
- Direct node/edge editing and third-party graph infrastructure.

Verification:
- CAP-TEST-012.
- CAP-TEST-038.

Completion criteria:
- Diagram and list IDs/edges match; no color-only status exists.

### CAP-PKT-011: Module interviews and readiness

Objective:
Implement type-specific module interviews, manifest drafting, CAP-GATE-003, and approval.

Depends on:
- CAP-PKT-009.
- CAP-PKT-008.

Allowed scope:
- Core module interview packet/gate logic.
- Module detail/interview GUI.
- Named bridge handlers and tests.

Inputs:
- Approved architecture, direct dependency contracts, type-specific question sets.

Required changes:
- Produce one schema across module types, validate required applicable details, and block unresolved domain questions.

Contracts created or changed:
- CAP-CONTRACT-003 and module specialization of CAP-CONTRACT-014.

Explicit exclusions:
- Multiple interview depths and implementation packets.

Verification:
- CAP-TEST-010.

Completion criteria:
- One representative module of each type yields deterministic readiness results.

### CAP-PKT-012: Module and connection implementation packets

Objective:
Generate immutable bounded CAP-CONTRACT-015 packets within the current upload workflow.

Depends on:
- CAP-PKT-011.
- CAP-DEC-002.
- CAP-DEC-003.
- CAP-DEC-004.

Allowed scope:
- `packages/core/src/capabilities/packets.ts`
- Capability handoff standards.
- Desktop packet handlers and GUI export surface.

Inputs:
- Approved module/connection specification, architecture, direct contracts, examples, owned paths.

Required changes:
- Persist input hashes and path scope; generate recommended prompt and manifest.

Contracts created or changed:
- CAP-CONTRACT-015.

Explicit exclusions:
- Overlay application and delta packets.

Verification:
- CAP-TEST-014.

Completion criteria:
- Module and connection packet fixtures validate, remain within upload budget, and contain one target.

### CAP-PKT-013: Capability-scoped overlay inspection and application

Objective:
Extend the existing overlay lifecycle with hard capability scope enforcement.

Depends on:
- CAP-PKT-012.
- CAP-PKT-004.

Allowed scope:
- `packages/core/src/overlay.ts`
- Capability overlay helpers/tests.
- Desktop capability overlay handlers and GUI inspection state.

Inputs:
- Persisted CAP-CONTRACT-021 scope and existing safety rules.

Required changes:
- Pass persisted scope to inspection, hard-block outside paths for capability runs, preserve legacy defaults, and invalidate capability verification after apply.

Contracts created or changed:
- Capability overlay-scope standard; additive inspection diagnostic codes.

Explicit exclusions:
- Deletion semantics and rollback engine.

Verification:
- CAP-TEST-015.

Completion criteria:
- All hostile/scope fixtures pass and current overlay tests remain unchanged.

### CAP-PKT-014: Module verification and provenance

Objective:
Select module-type suites, execute checks, persist CAP-CONTRACT-017, and generate scoped repair context.

Depends on:
- CAP-PKT-013.
- CAP-PKT-002.

Allowed scope:
- Core verification selection/provenance helpers.
- Desktop verification handlers.
- Capability verification GUI/tests.

Inputs:
- Manifest suites, architecture rules, current input hashes, existing command runner.

Required changes:
- Separate setup, rejection, technical failure, cancellation, and unverified results.
- Include exact provenance and module-scoped repair packet data.

Contracts created or changed:
- CAP-CONTRACT-017.

Explicit exclusions:
- Freshness propagation and new test frameworks.

Verification:
- CAP-TEST-016.

Completion criteria:
- Representative module types persist complete evidence and failed checks cannot produce ready state.

### CAP-PKT-015: Freshness calculation

Objective:
Calculate CAP-CONTRACT-012 deterministically and expose reasoned states.

Depends on:
- CAP-PKT-014.
- CAP-PKT-002.
- CAP-DEC-007.

Allowed scope:
- `packages/core/src/capabilities/freshness.ts`
- Persistence integration and status GUI.
- Tests.

Inputs:
- Current records and verification provenance.

Required changes:
- Hash canonical content, derive primary state/reasons, and recalculate after relevant writes.

Contracts created or changed:
- CAP-CONTRACT-012.

Explicit exclusions:
- Semantic source analysis and background file watching.

Verification:
- CAP-TEST-017.

Completion criteria:
- Each tracked change yields the specified state and unrelated changes do not invalidate.

### CAP-PKT-016: Impact analysis and delta queue

Objective:
Classify approved changes, explain impact, order updates, and emit one delta packet.

Depends on:
- CAP-PKT-015.
- CAP-PKT-012.

Allowed scope:
- `packages/core/src/capabilities/impact.ts`
- Delta packet builder/standard.
- Needs attention/impact GUI and tests.

Inputs:
- Dependency/binding graph, current and proposed contracts, user approval.

Required changes:
- Derive affected/unaffected reasons, stable provider-first order, approval gate, and one-action queue.

Contracts created or changed:
- CAP-CONTRACT-016 and CAP-CONTRACT-022.

Explicit exclusions:
- Concurrent architecture branches and automatic multi-module generation.

Verification:
- CAP-TEST-018.
- CAP-TEST-019.
- CAP-TEST-020.

Completion criteria:
- Known graph fixtures produce exact impact sets and only the next packet is actionable.

### CAP-PKT-017: Registry, resolver, and immediate runtime

Objective:
Build the derived registry, deterministic resolver, validation boundary, and immediate-operation invocation.

Depends on:
- CAP-PKT-015.
- CAP-PKT-005.
- CAP-DEC-009.

Allowed scope:
- `packages/core/src/capabilities/registry.ts`
- `packages/core/src/capabilities/runtime.ts`
- Desktop runtime host and named bridge methods.
- Tests.

Inputs:
- Approved manifests, contracts, configuration, verification/freshness evidence.

Required changes:
- Rebuild registry, resolve exactly one provider, validate input, invoke, and convert result.

Contracts created or changed:
- CAP-CONTRACT-005, CAP-CONTRACT-006, CAP-CONTRACT-011.

Explicit exclusions:
- Remote providers, HTTP plus bridge dual transport, jobs, and adapters.

Verification:
- CAP-TEST-023.
- CAP-TEST-024.

Completion criteria:
- Resolver fixtures and one in-memory immediate operation pass through the chosen transport.

### CAP-PKT-018: Jobs, artifacts, configuration, and diagnostics

Objective:
Add local job execution, artifact storage, non-secret configuration, result evidence, and cancellation.

Depends on:
- CAP-PKT-017.
- CAP-PKT-004.

Allowed scope:
- Core jobs/artifacts/results files.
- Desktop runtime host/artifact store.
- Named bridge methods and GUI state components.
- Tests.

Inputs:
- CAP-CONTRACT-005 through CAP-CONTRACT-009 and CAP-CONTRACT-017.

Required changes:
- Persist legal job transitions, bounded progress, cancellation, artifact checksum/provenance, and safe diagnostic reads.

Contracts created or changed:
- CAP-CONTRACT-007, CAP-CONTRACT-008, non-secret portion of CAP-CONTRACT-009.

Explicit exclusions:
- Scheduler, queue service, retry orchestration, and credential values.

Verification:
- CAP-TEST-027.

Completion criteria:
- Immediate and job paths survive renderer reload and preserve terminal evidence.

### CAP-PKT-019: Filesystem adapter

Objective:
Implement project-policy-scoped filesystem and artifact operations.

Depends on:
- CAP-PKT-018.

Allowed scope:
- Core filesystem policy logic.
- Desktop filesystem adapter.
- Adapter manifests/contracts/configuration.
- Tests and minimal setup UI.

Inputs:
- Project root, named policy roots, approved operations, artifact store.

Required changes:
- Implement normalized read/write/discover/artifact/checksum operations with symlink-safe confinement.

Contracts created or changed:
- Filesystem operation contracts and CAP-CONTRACT-018 specialization.

Explicit exclusions:
- File monitoring, arbitrary host paths, deletion, and domain-facing absolute paths.

Verification:
- CAP-TEST-025.

Completion criteria:
- Hostile path fixtures pass on supported platforms and result envelopes expose no project absolute path.

### CAP-PKT-020: MATLAB discovery and session manager

Objective:
Implement configured MATLAB discovery/readiness and one serialized app-owned session per project.

Depends on:
- CAP-PKT-018.
- CAP-DEC-013.

Allowed scope:
- Desktop MATLAB adapter/session files.
- Adapter configuration/manifests.
- Named bridge methods, setup UI, tests with a fake integration boundary.

Inputs:
- Approved versions/platforms/toolbox rules and MATLAB integration mechanism.

Required changes:
- Detect readiness, lazily start/reuse/stop, serialize calls, isolate projects, detect crash, and invalidate in-memory readiness.

Contracts created or changed:
- CAP-CONTRACT-019 and MATLAB configuration contract.

Explicit exclusions:
- Value conversion beyond readiness probe, execution primitives, pools, remote sessions, Simulink.

Verification:
- CAP-TEST-026.

Completion criteria:
- Fake and available-real-environment tests prove lifecycle and isolation; unavailable environments skip only real integration tests.

### CAP-PKT-021: MATLAB execution and value conversion

Objective:
Implement approved primitives, value conversion, diagnostics, artifacts, timeout, cancellation, and job integration.

Depends on:
- CAP-PKT-020.
- CAP-PKT-018.

Allowed scope:
- Desktop MATLAB adapter.
- MATLAB operation contracts/manifests.
- Tests and operation setup UI.

Inputs:
- Approved allowlists, initial value model, artifact/job services.

Required changes:
- Add named function, approved script/expression, workspace value, path/working-directory operations and output capture.

Contracts created or changed:
- MATLAB operation contracts and value schemas.

Explicit exclusions:
- Arbitrary console, full MATLAB object serialization, Simulink, and remote execution.

Verification:
- CAP-TEST-027.

Completion criteria:
- Round trips, allowed/denied calls, timeout, cancellation, errors, figures, and files pass.

### CAP-PKT-022: MATLAB durable snapshots

Objective:
Save, validate, restore, and invalidate selected project-scoped MATLAB state.

Depends on:
- CAP-PKT-021.

Allowed scope:
- Desktop MATLAB snapshot file.
- Artifact/persistence integration.
- Snapshot setup UI and tests.

Inputs:
- Approved variable allowlist, session record, MATLAB version, artifact store.

Required changes:
- Persist MAT snapshot and metadata, validate checksum/compatibility, restore selected variables, and preserve usable uninitialized session after failure.

Contracts created or changed:
- MATLAB snapshot metadata contract.

Explicit exclusions:
- Automatic full-workspace snapshots, cross-project restore, and snapshot migration across unsupported MATLAB versions.

Verification:
- CAP-TEST-028.

Completion criteria:
- Selected-only, corrupt, incompatible, and cross-project tests pass.

### CAP-PKT-023: Preview selection evidence

Objective:
Extract and extend the existing DOM picker for binding-grade selection evidence.

Depends on:
- CAP-PKT-007.
- CAP-DEC-008.

Allowed scope:
- `apps/gui/src/views/workflow.tsx`
- Proposed Preview selection components/helpers.
- GUI tests.

Inputs:
- Existing `PICKER_JS` and `PickedTarget` behavior.

Required changes:
- Capture role/name/tag/stable marker, retain route/title/selector/text, clean up listeners, and add confirmation gating.

Contracts created or changed:
- Selection-evidence portion of CAP-CONTRACT-013.

Explicit exclusions:
- React fiber inspection, source-map infrastructure, binding generation, and runtime invocation.

Verification:
- CAP-TEST-029.

Completion criteria:
- Marked/unmarked/navigation/cancel/reload cases behave deterministically.

### CAP-PKT-024: Binding mapping and connection packet

Objective:
Create, validate, approve, and export one frontend binding specification and connection packet.

Depends on:
- CAP-PKT-023.
- CAP-PKT-012.
- CAP-PKT-017.

Allowed scope:
- Core binding validation/packet builder.
- Preview binding GUI.
- Named bridge handlers, standards, and tests.

Inputs:
- Selection evidence, operation contract, proposed field mappings, target owned paths.

Required changes:
- Require explicit behavior mappings, show ambiguity, approve binding revision, and generate bounded overlay scope.

Contracts created or changed:
- CAP-CONTRACT-013 and connection specialization of CAP-CONTRACT-015.

Explicit exclusions:
- Automatic approval, endpoint entry, and runtime execution.

Verification:
- CAP-TEST-030.

Completion criteria:
- Incomplete mappings block approval; approved packet names exactly one binding and operation.

### CAP-PKT-025: Binding execution and simulation modes

Objective:
Verify connected binding behavior and implement isolated approved-example/failure modes.

Depends on:
- CAP-PKT-024.
- CAP-PKT-017.
- CAP-PKT-014.

Allowed scope:
- Core example/simulation result helpers.
- Preview binding GUI/runtime bridge.
- Binding verification and tests.

Inputs:
- Approved binding, examples, selected MVP transport.

Required changes:
- Execute real connected path, simulate four non-connected modes, label mode, render all outcome presentations, and prevent simulated verification credit.

Contracts created or changed:
- Binding verification specialization of CAP-CONTRACT-017.

Explicit exclusions:
- Mock-server infrastructure and alternate transport.

Verification:
- CAP-TEST-031.
- CAP-TEST-032.

Completion criteria:
- Connected and simulated behavior is observable through the selected element and only connected execution satisfies connected verification.

### CAP-PKT-026: Azure DevOps credentials and discovery

Objective:
Implement least-privilege secret references, configuration validation, and organization/project/repository discovery.

Depends on:
- CAP-PKT-018.
- CAP-DEC-010.
- CAP-DEC-011.

Allowed scope:
- Desktop secret store and Azure adapter.
- Azure configuration contracts, named bridge methods, setup UI, tests.

Inputs:
- Approved credential provider and minimum scopes.

Required changes:
- Store opaque references, validate scopes, discover selectable resources, redact failures, and expose permission summary.

Contracts created or changed:
- Azure specialization of CAP-CONTRACT-009 and CAP-CONTRACT-018.

Explicit exclusions:
- Work-item content, pipelines, repositories writes, and secret values in renderer state.

Verification:
- CAP-TEST-033.
- CAP-TEST-036.

Completion criteria:
- Discovery and insufficient-permission fixtures pass with no canary leakage.

### CAP-PKT-027: Azure requirement import and external freshness

Objective:
Import read-only work-item requirements with revision provenance and proposed impact.

Depends on:
- CAP-PKT-026.
- CAP-PKT-016.

Allowed scope:
- Azure adapter read operations.
- Requirement mapping/import GUI.
- Persistence, impact integration, and tests.

Inputs:
- Selected work item/fields and approved application record.

Required changes:
- Persist CAP-CONTRACT-020, map selected fields, show delta, link capability IDs, and treat new revisions as unapproved impact.

Contracts created or changed:
- Work-item portion of CAP-CONTRACT-020.

Explicit exclusions:
- Work-item update, comment, task creation, and silent specification mutation.

Verification:
- CAP-TEST-034.

Completion criteria:
- Initial and changed revisions preserve identity and cannot alter approved product truth without approval.

### CAP-PKT-028: Azure pipelines, tests, and artifacts

Objective:
Retrieve pipeline/test/artifact evidence and optionally invoke one approved configured pipeline.

Depends on:
- CAP-PKT-026.
- CAP-PKT-014.
- CAP-DEC-012.

Allowed scope:
- Azure adapter pipeline/test/artifact read operations.
- Optional invocation operation when approved.
- Verification GUI/persistence and tests.

Inputs:
- Configured pipeline, scopes, verification suite mapping.

Required changes:
- Discover/status runs, retrieve test results and referenced artifacts, map provenance, handle rate limits, and gate invocation.

Contracts created or changed:
- Pipeline/test/artifact portion of CAP-CONTRACT-020.

Explicit exclusions:
- Pipeline editing, arbitrary parameters, artifact publication, branch/repository mutation.

Verification:
- CAP-TEST-035.

Completion criteria:
- Read evidence is traceable and optional invocation cannot occur without explicit action.

### CAP-PKT-029: Initialization, migration, and compatibility

Objective:
Initialize capability storage and protect legacy/future data across upgrades.

Depends on:
- CAP-PKT-003.
- CAP-PKT-004.

Allowed scope:
- Capability persistence/migration helpers.
- App startup/project-open integration.
- Migration fixtures/tests.

Inputs:
- Legacy workspace fixtures, schema version 1, future-version fixture.

Required changes:
- Add lazy initialization, idempotent migration evidence, interrupted-write recovery, and future-version read-only behavior.

Contracts created or changed:
- Migration evidence record.

Explicit exclusions:
- Destructive downgrade and rewriting unrelated legacy records.

Verification:
- CAP-TEST-039.

Completion criteria:
- Clean, repeated, interrupted, legacy, and future-version fixtures pass.

### CAP-PKT-030: Trust-boundary and diagnostic hardening

Objective:
Audit and enforce bridge validation, secret/path redaction, approval boundaries, and packet/record scanning.

Depends on:
- CAP-PKT-019.
- CAP-PKT-022.
- CAP-PKT-028.

Allowed scope:
- Core safe diagnostic helpers.
- Desktop bridge/adapter validation.
- Security tests and narrowly required UI copy.

Inputs:
- All trust-boundary contracts and canary fixtures.

Required changes:
- Centralize safe error conversion, validate IDs/paths/URLs/enums, enforce consequential actions, and scan export/persistence outputs.

Contracts created or changed:
- Diagnostic redaction rules.

Explicit exclusions:
- New authentication service, audit server, or telemetry backend.

Verification:
- CAP-TEST-036.
- CAP-TEST-037.

Completion criteria:
- Canary scans are clean and prohibited renderer/bridge actions fail safely.

### CAP-PKT-031: Accessibility, state catalogue, and performance

Objective:
Complete accessible interaction states and measure responsiveness at MVP scale.

Depends on:
- CAP-PKT-025.
- CAP-PKT-028.

Allowed scope:
- Capabilities GUI/styles/tests.
- Core projection optimization only when measurement demonstrates need.

Inputs:
- Primary journeys, state catalogue, 100-module fixture.

Required changes:
- Close keyboard/focus/label/status/reduced-motion gaps, add list fallbacks, and record p95 timings.

Contracts created or changed:
- None.

Explicit exclusions:
- Visual redesign and speculative caching infrastructure.

Verification:
- CAP-TEST-038.
- CAP-TEST-041.

Completion criteria:
- Accessibility checks pass and performance targets pass or have an approved documented exception.

### CAP-PKT-032: MVP end-to-end verification

Objective:
Verify all eight target journeys together in the packaged desktop boundary.

Depends on:
- CAP-PKT-029.
- CAP-PKT-030.
- CAP-PKT-031.

Allowed scope:
- End-to-end tests, fixtures, validation evidence, and defect fixes within owning packet scope.

Inputs:
- Approved representative domain-neutral fixture, fake adapter fixtures, optional real MATLAB/Azure test configuration.

Required changes:
- Exercise interview through binding, change/delta, filesystem, MATLAB persistence, Azure provenance, restart, and offline core operation.

Contracts created or changed:
- None unless a discovered contradiction is resolved across the specification first.

Explicit exclusions:
- Deferred features and broad refactors.

Verification:
- CAP-TEST-040.

Completion criteria:
- All blocking tests pass; optional real-integration tests report explicit skipped/passed state; evidence is retained.

## 57. Acceptance-test catalogue

| Test ID | Preconditions | Action | Expected result |
|---|---|---|---|
| `CAP-TEST-001` | Version 1 schema family and unrelated-domain fixtures | Validate all valid/invalid fixtures and check schema/type parity | Valid fixtures pass; invalid fixtures return expected field/rule IDs; no domain-specific core field exists. |
| `CAP-TEST-002` | Gate, dependency, trace, and architecture fixtures | Run validators twice | Byte-equivalent ordered diagnostics; cycles, missing traces, invalid ownership, and forbidden dependencies fail. |
| `CAP-TEST-003` | Desktop, preload, renderer, and mock bridge builds | Compare method/type parity and issue malformed requests | Named methods match; malformed input fails; generic filesystem/tool/client methods are absent. |
| `CAP-TEST-004` | No run, active legacy run, completed run, and selected project fixtures | Navigate among Build & Test, Capabilities, Projects, and Settings; reload | Capabilities is top-level; legacy resume/reachability behavior remains intact. |
| `CAP-TEST-005` | One canonical record set | Switch Guided/Design, edit permitted draft fields, reload | Both modes show the same IDs/revisions; no duplicate projection record is persisted. |
| `CAP-TEST-006` | Product interview packet and incomplete/complete responses | Export, import, evaluate CAP-GATE-001, approve | Packet is bounded; incomplete response blocks; complete reviewed response creates an approved revision. |
| `CAP-TEST-007` | Approved product revision and Copilot response changing a confirmed rule | Import without approval, inspect delta, then approve | Approved revision is unchanged before approval; field-level delta is visible; approval creates a new revision. |
| `CAP-TEST-008` | Approved product specification and architecture proposals | Import minimal, unsupported, redundant, and cyclic proposals | Only need-traced minimal acyclic proposal can pass CAP-GATE-002. |
| `CAP-TEST-009` | Architecture with use cases, scenarios, modules, operations, and dependencies | Run trace/graph projection, then alter a manifest edge | Orphans fail; derived graph updates from manifests; no graph record is directly edited. |
| `CAP-TEST-010` | Representative domain, workflow, connection, platform, and experience drafts | Run type-specific interviews and CAP-GATE-003 | Applicable details are required; unresolved domain questions block; approved modules have valid manifests. |
| `CAP-TEST-011` | Empty and populated capability workspace | Create drafts, approve revisions, simulate interrupted write, reload | Atomic records recover; approved revisions are immutable; invalid drafts do not replace approval. |
| `CAP-TEST-012` | Approved/proposed 20-node architecture fixture | Compare Guided/Design diagram and list; keyboard navigate | IDs/edges/status match source; focus works; list alternative is complete; color is redundant. |
| `CAP-TEST-013` | Legacy project/run fixtures plus new capability runs | Round-trip, transition, and reload | Legacy meaning is unchanged; capability run scope/history/evidence persist independently. |
| `CAP-TEST-014` | Ready domain module and ready connection | Generate implementation packets | Each packet has one target, exact hashes/scope/contracts, required sections, and no more than three upload files. |
| `CAP-TEST-015` | Allowed, out-of-scope, protected, traversal, secret, dirty-tree, and warning overlays | Inspect and attempt apply for legacy and capability run kinds | Capability out-of-scope is blocked; generic blockers remain; warnings require acceptance; legacy expectation behavior is preserved. |
| `CAP-TEST-016` | Module fixtures and all verification outcome classes | Select/run suites and persist evidence | Suite selection matches type; provenance is complete; failure classes remain distinct; only exact passing evidence is eligible for ready. |
| `CAP-TEST-017` | Passing verification and individual changed inputs | Recalculate freshness after each change | Expected primary state/reason appears; direct status write is impossible; unrelated change does not invalidate. |
| `CAP-TEST-018` | Branched dependency/binding graph and proposed contract changes | Calculate impact before/after approval | Affected and unaffected modules have reasons; no packet exists before approval. |
| `CAP-TEST-019` | Approved multi-level impact record | Build regeneration order and request packets repeatedly | Provider precedes workflow and experience/binding; one incomplete target is actionable; delta scope stays local. |
| `CAP-TEST-020` | Mixed draft, stale, blocked, failed, and connection-outdated fixtures | Open Needs attention | Items follow dependency order and show state, reason, blocker, and one next action. |
| `CAP-TEST-021` | Lifecycle state fixtures with missing prerequisites | Attempt every invalid transition and one valid sequence | Invalid transitions return stable diagnostics; valid transitions append actor/time/source/result evidence. |
| `CAP-TEST-022` | Non-secret configuration and canary credential reference | Persist, render, export packet, reload | Configuration round-trips; only opaque reference metadata appears outside the desktop secret resolver. |
| `CAP-TEST-023` | Registry fixtures with zero/one/multiple/incompatible/unconfigured providers | Rebuild registry and resolve operations | Rebuild is deterministic; exactly one compatible ready provider resolves; other cases return typed failures; examples never silently resolve. |
| `CAP-TEST-024` | Immediate operations for success, rejection, exception, cancellation, invalid input | Invoke through the named bridge | Input validates; every call returns one standard outcome; boundary exception is sanitized technical failure. |
| `CAP-TEST-025` | Temporary project with source/data/artifact roots and hostile paths/symlinks | Read, write, discover, create/retrieve artifact | Approved operations work; escape attempts fail; checksums/provenance match; result contains no host absolute path. |
| `CAP-TEST-026` | Fake MATLAB integration and optional configured real MATLAB | Discover, start/reuse/stop, run concurrent and cross-project requests, simulate crash/restart | One serialized session per project; isolation holds; crash removes in-memory readiness; unavailable real integration is explicit. |
| `CAP-TEST-027` | Long-running MATLAB operation and general job fixture | Start, observe, cancel, reload; run approved/denied MATLAB calls | Legal job transitions persist; UI remains responsive; cancellation and allowlists are enforced; captured outputs use contracts. |
| `CAP-TEST-028` | MATLAB session with selected/unselected variables and snapshot fixtures | Save, restart, restore valid/corrupt/incompatible/cross-project snapshots | Only selected variables restore; invalid restore leaves usable uninitialized session; full workspace is never saved. |
| `CAP-TEST-029` | Preview routes with marked and unmarked elements | Select, cancel, navigate, reload, and select again | Evidence is bounded; listeners clean up; marked element proceeds; unmarked element requires source-target confirmation. |
| `CAP-TEST-030` | Selection evidence and operation with clear/ambiguous mappings | Draft, validate, approve, and export binding | All behavior fields are required; ambiguity requires user resolution; packet contains one operation and bounded paths. |
| `CAP-TEST-031` | Approved binding, approved example, and adapter spy | Run connected, example, invalid, unavailable, and timeout modes | Mode is labeled; correct presentations render; simulations do not call adapter or earn connected verification. |
| `CAP-TEST-032` | Consequential filesystem/MATLAB/snapshot/binding actions | Trigger through background refresh, imported data, direct request, and explicit UI action | Only approved explicit UI action executes; all other attempts fail without side effects. |
| `CAP-TEST-033` | Azure fake service with valid/insufficient scopes | Configure secret reference and discover resources | Least-privilege discovery works; insufficient scope is actionable; credential value never reaches renderer/persistence. |
| `CAP-TEST-034` | Azure work item revisions N and N+1 | Import N, approve mapping, refresh to N+1 | Identity/revision/hash persist; N+1 creates proposed impact and does not mutate approved specification. |
| `CAP-TEST-035` | Azure pipeline/test/artifact fixtures and rate limits | Discover/status/retrieve; optionally invoke through explicit action | Evidence retains external IDs/times; rate limit becomes typed retryable failure; mutation exclusions hold. |
| `CAP-TEST-036` | Failures seeded with canary secret/header/path data | Exercise all adapters and scan records/logs/packets/renderer payloads | No canary secret/header appears; safe codes and remediation remain. |
| `CAP-TEST-037` | Malformed renderer requests and prohibited trust-boundary operations | Invoke every capability bridge method with hostile values | Desktop validates and rejects safely; privileged objects/paths/secrets do not cross bridge. |
| `CAP-TEST-038` | All primary Capabilities views and state fixtures | Run keyboard, focus, labels, announcements, contrast, reduced motion, and list-fallback checks | Blocking accessibility checks pass and focus recovers after dialogs/mode switches. |
| `CAP-TEST-039` | Clean, legacy, repeated, interrupted, and future-version workspaces | Initialize/migrate/open | Initialization is lazy/idempotent; legacy runs work; interrupted writes recover; future version is read-only. |
| `CAP-TEST-040` | Packaged app, representative domain-neutral fixture, fake adapters, network disabled except Azure case | Execute CAP-JRN-001 through CAP-JRN-008 including restart | All MVP journeys complete with traceable evidence; core journeys work offline; deferred features are absent. |
| `CAP-TEST-041` | Fixed 100-module/300-edge fixture and delayed adapter jobs | Measure 20 runs and navigate during jobs | p95 projection/recompute targets pass or approved exception exists; navigation remains responsive; declared cancellation works. |

## 58. Traceability matrix

| Requirement | Implementation packets | Acceptance tests |
|---|---|---|
| `CAP-PROD-001` | `CAP-PKT-008`, `CAP-PKT-009`, `CAP-PKT-011`, `CAP-PKT-024` | `CAP-TEST-006`, `CAP-TEST-008`, `CAP-TEST-010`, `CAP-TEST-030` |
| `CAP-PROD-002` | `CAP-PKT-003`, `CAP-PKT-007` | `CAP-TEST-004`, `CAP-TEST-005` |
| `CAP-PROD-003` | `CAP-PKT-017`, `CAP-PKT-018`, `CAP-PKT-032` | `CAP-TEST-023`, `CAP-TEST-040` |
| `CAP-PROD-004` | `CAP-PKT-001`, `CAP-PKT-002` | `CAP-TEST-001`, `CAP-TEST-002` |
| `CAP-PROD-005` | `CAP-PKT-019`, `CAP-PKT-020`, `CAP-PKT-021`, `CAP-PKT-022`, `CAP-PKT-026`, `CAP-PKT-027`, `CAP-PKT-028` | `CAP-TEST-025`, `CAP-TEST-026`, `CAP-TEST-027`, `CAP-TEST-028`, `CAP-TEST-033`, `CAP-TEST-034`, `CAP-TEST-035` |
| `CAP-UX-001` | `CAP-PKT-007` | `CAP-TEST-005` |
| `CAP-UX-002` | `CAP-PKT-010`, `CAP-PKT-031` | `CAP-TEST-012`, `CAP-TEST-038` |
| `CAP-UX-003` | `CAP-PKT-006` | `CAP-TEST-004` |
| `CAP-UX-004` | `CAP-PKT-007`, `CAP-PKT-016` | `CAP-TEST-020` |
| `CAP-UX-005` | `CAP-PKT-023` | `CAP-TEST-029` |
| `CAP-UX-006` | `CAP-PKT-024`, `CAP-PKT-025` | `CAP-TEST-030`, `CAP-TEST-031` |
| `CAP-DATA-001` | `CAP-PKT-002`, `CAP-PKT-008`, `CAP-PKT-009`, `CAP-PKT-011` | `CAP-TEST-002`, `CAP-TEST-006`, `CAP-TEST-008`, `CAP-TEST-010` |
| `CAP-DATA-002` | `CAP-PKT-001`, `CAP-PKT-002`, `CAP-PKT-009` | `CAP-TEST-001`, `CAP-TEST-009` |
| `CAP-DATA-003` | `CAP-PKT-001`, `CAP-PKT-002`, `CAP-PKT-011` | `CAP-TEST-001`, `CAP-TEST-010` |
| `CAP-DATA-004` | `CAP-PKT-001`, `CAP-PKT-002`, `CAP-PKT-017` | `CAP-TEST-001`, `CAP-TEST-024` |
| `CAP-DATA-005` | `CAP-PKT-001`, `CAP-PKT-018`, `CAP-PKT-019` | `CAP-TEST-001`, `CAP-TEST-025` |
| `CAP-DATA-006` | `CAP-PKT-003`, `CAP-PKT-004`, `CAP-PKT-011` | `CAP-TEST-011`, `CAP-TEST-013`, `CAP-TEST-021` |
| `CAP-DATA-007` | `CAP-PKT-003`, `CAP-PKT-004`, `CAP-PKT-015`, `CAP-PKT-017` | `CAP-TEST-011`, `CAP-TEST-013`, `CAP-TEST-017`, `CAP-TEST-023` |
| `CAP-DATA-008` | `CAP-PKT-004`, `CAP-PKT-029` | `CAP-TEST-013`, `CAP-TEST-039` |
| `CAP-ARCH-001` | `CAP-PKT-001`, `CAP-PKT-002`, `CAP-PKT-005`, `CAP-PKT-012`, `CAP-PKT-015`, `CAP-PKT-016`, `CAP-PKT-017`, `CAP-PKT-030` | `CAP-TEST-003`, `CAP-TEST-037` |
| `CAP-ARCH-002` | `CAP-PKT-005`, `CAP-PKT-030` | `CAP-TEST-003`, `CAP-TEST-037` |
| `CAP-ARCH-003` | `CAP-PKT-002`, `CAP-PKT-013` | `CAP-TEST-002`, `CAP-TEST-015` |
| `CAP-ARCH-004` | `CAP-PKT-002`, `CAP-PKT-010` | `CAP-TEST-009`, `CAP-TEST-012` |
| `CAP-ARCH-005` | `CAP-PKT-017` | `CAP-TEST-023` |
| `CAP-ARCH-006` | `CAP-PKT-014` | `CAP-TEST-016` |
| `CAP-ARCH-007` | `CAP-PKT-029` | `CAP-TEST-039` |
| `CAP-HANDOFF-001` | `CAP-PKT-008`, `CAP-PKT-009`, `CAP-PKT-011` | `CAP-TEST-006`, `CAP-TEST-008`, `CAP-TEST-010` |
| `CAP-HANDOFF-002` | `CAP-PKT-008`, `CAP-PKT-009`, `CAP-PKT-011` | `CAP-TEST-007` |
| `CAP-HANDOFF-003` | `CAP-PKT-012` | `CAP-TEST-014` |
| `CAP-HANDOFF-004` | `CAP-PKT-013` | `CAP-TEST-015` |
| `CAP-HANDOFF-005` | `CAP-PKT-016` | `CAP-TEST-019` |
| `CAP-FRESH-001` | `CAP-PKT-015` | `CAP-TEST-017` |
| `CAP-FRESH-002` | `CAP-PKT-014`, `CAP-PKT-015` | `CAP-TEST-016`, `CAP-TEST-017` |
| `CAP-FRESH-003` | `CAP-PKT-016` | `CAP-TEST-018` |
| `CAP-FRESH-004` | `CAP-PKT-016` | `CAP-TEST-019` |
| `CAP-RUN-001` | `CAP-PKT-017`, `CAP-PKT-018` | `CAP-TEST-024` |
| `CAP-RUN-002` | `CAP-PKT-018`, `CAP-PKT-021` | `CAP-TEST-027` |
| `CAP-RUN-003` | `CAP-PKT-017` | `CAP-TEST-023` |
| `CAP-RUN-004` | `CAP-PKT-017`, `CAP-PKT-018` | `CAP-TEST-024`, `CAP-TEST-027` |
| `CAP-RUN-005` | `CAP-PKT-025` | `CAP-TEST-031` |
| `CAP-ADAPT-001` | `CAP-PKT-019` | `CAP-TEST-025` |
| `CAP-ADAPT-002` | `CAP-PKT-019` | `CAP-TEST-025` |
| `CAP-ADAPT-003` | `CAP-PKT-020`, `CAP-PKT-021` | `CAP-TEST-026`, `CAP-TEST-027` |
| `CAP-ADAPT-004` | `CAP-PKT-020` | `CAP-TEST-026`, `CAP-TEST-027` |
| `CAP-ADAPT-005` | `CAP-PKT-022` | `CAP-TEST-028` |
| `CAP-ADAPT-006` | `CAP-PKT-026`, `CAP-PKT-027`, `CAP-PKT-028` | `CAP-TEST-033`, `CAP-TEST-034`, `CAP-TEST-035`, `CAP-TEST-036` |
| `CAP-SEC-001` | `CAP-PKT-026`, `CAP-PKT-030` | `CAP-TEST-022`, `CAP-TEST-036`, `CAP-TEST-037` |
| `CAP-SEC-002` | `CAP-PKT-019`, `CAP-PKT-021`, `CAP-PKT-022`, `CAP-PKT-028`, `CAP-PKT-030` | `CAP-TEST-032`, `CAP-TEST-037` |
| `CAP-SEC-003` | `CAP-PKT-030` | `CAP-TEST-036`, `CAP-TEST-037` |
| `CAP-QUAL-001` | `CAP-PKT-006`, `CAP-PKT-007`, `CAP-PKT-010`, `CAP-PKT-023`, `CAP-PKT-024`, `CAP-PKT-031` | `CAP-TEST-038` |
| `CAP-QUAL-002` | `CAP-PKT-007`, `CAP-PKT-018`, `CAP-PKT-025`, `CAP-PKT-031` | `CAP-TEST-038` |
| `CAP-QUAL-003` | `CAP-PKT-007`, `CAP-PKT-010`, `CAP-PKT-015`, `CAP-PKT-031` | `CAP-TEST-041` |
| `CAP-QUAL-004` | `CAP-PKT-018`, `CAP-PKT-019`, `CAP-PKT-021`, `CAP-PKT-025`, `CAP-PKT-028`, `CAP-PKT-031` | `CAP-TEST-027`, `CAP-TEST-041` |

## 59. Requirement index

The following JSON is the machine-readable normative requirement index. Packet and test mappings are authoritative in Section 58.

```json
{
  "documentId": "CAP-SPEC-001",
  "requirementCount": 53,
  "requirements": {
    "product": ["CAP-PROD-001", "CAP-PROD-002", "CAP-PROD-003", "CAP-PROD-004", "CAP-PROD-005"],
    "ux": ["CAP-UX-001", "CAP-UX-002", "CAP-UX-003", "CAP-UX-004", "CAP-UX-005", "CAP-UX-006"],
    "data": ["CAP-DATA-001", "CAP-DATA-002", "CAP-DATA-003", "CAP-DATA-004", "CAP-DATA-005", "CAP-DATA-006", "CAP-DATA-007", "CAP-DATA-008"],
    "architecture": ["CAP-ARCH-001", "CAP-ARCH-002", "CAP-ARCH-003", "CAP-ARCH-004", "CAP-ARCH-005", "CAP-ARCH-006", "CAP-ARCH-007"],
    "handoff": ["CAP-HANDOFF-001", "CAP-HANDOFF-002", "CAP-HANDOFF-003", "CAP-HANDOFF-004", "CAP-HANDOFF-005"],
    "freshness": ["CAP-FRESH-001", "CAP-FRESH-002", "CAP-FRESH-003", "CAP-FRESH-004"],
    "runtime": ["CAP-RUN-001", "CAP-RUN-002", "CAP-RUN-003", "CAP-RUN-004", "CAP-RUN-005"],
    "adapters": ["CAP-ADAPT-001", "CAP-ADAPT-002", "CAP-ADAPT-003", "CAP-ADAPT-004", "CAP-ADAPT-005", "CAP-ADAPT-006"],
    "security": ["CAP-SEC-001", "CAP-SEC-002", "CAP-SEC-003"],
    "quality": ["CAP-QUAL-001", "CAP-QUAL-002", "CAP-QUAL-003", "CAP-QUAL-004"]
  },
  "implementationPacketRange": ["CAP-PKT-001", "CAP-PKT-032"],
  "acceptanceTestRange": ["CAP-TEST-001", "CAP-TEST-041"]
}
```

## 60. Deferred extensions

| Deferred item | Stable extension point retained | Why deferred |
|---|---|---|
| Integrated Copilot session | Interview/implementation packet contracts | Current product already uses external file handoff; integration is not required to prove MVP. |
| Quick/Standard/Detailed interviews | One interview schema and question budget | Multiple depths add UX and testing branches without a demonstrated need. |
| Composite modules | Capability projection over module IDs | A generated composite type duplicates grouping already supplied by the registry/diagram. |
| Simulink | Adapter, job, artifact, diagnostic, and session contracts | MATLAB primitives must prove the boundary first. |
| Generic HTTP adapter | Operation/result/configuration/secret contracts | Endpoint/auth discovery is a separate product surface. |
| Remote runtime | Registry allocation field and operation contracts | Local execution is sufficient for MVP journeys. |
| Multi-provider routing/failover | Registry compatibility fields | One approved provider is deterministic and sufficient. |
| Durable event infrastructure | CAP-CONTRACT-010 | No MVP journey requires subscriptions, replay, or delivery guarantees. |
| File monitoring | Filesystem policy and freshness inputs | Explicit recalculation covers MVP; watchers add lifecycle complexity. |
| MATLAB pools/remote workers | Job and session contracts | One project session meets persistence and isolation needs. |
| Full MATLAB object serialization | Versioned value schema | Initial values cover demonstrated primitive calls. |
| Azure work-item/repository/artifact mutation | Adapter operation authorization | Read provenance proves traceability with lower risk. |
| Direct architecture graph editing | Architecture specification revisions | Interview import plus approval is sufficient and avoids a general modeling canvas. |
| Shared database/object storage/job queue | Ports and artifact/job contracts | Collaboration and distributed deployment are not MVP requirements. |
| Plugin marketplace | Adapter/module manifests | The first adapters are product-owned and fixed. |

### 60.1 Anti-overengineering audit

| Proposed component | MVP consumer | Single responsibility | Verification | Audit result |
|---|---|---|---|---|
| Capability contract/validator files | All journeys and packets | Boundary schemas and deterministic validation | CAP-TEST-001–002 | Retain |
| Definition records: CAP-CONTRACT-001–004, 013–014, 018 | CAP-JRN-001–003, CAP-JRN-007–008 | Approved product/module/binding/configuration truth | CAP-TEST-001, CAP-TEST-006–011, CAP-TEST-030 | Retain |
| Execution/evidence records: CAP-CONTRACT-005–009, 012, 017, 019–022 | CAP-JRN-003–008 | Runtime outcomes, evidence, freshness, sessions, external provenance, and scoped runs | CAP-TEST-013, CAP-TEST-016–028, CAP-TEST-034–035 | Retain |
| Event envelope: CAP-CONTRACT-010 | Future business-event declaration only | Compatibility extension point | Schema fixture only | Contract retained; runtime deferred |
| Registry record: CAP-CONTRACT-011 | CAP-JRN-003, CAP-JRN-005, CAP-JRN-007 | Derived provider/readiness index | CAP-TEST-023 | Retain |
| Handoff abstractions: CAP-CONTRACT-014–016 | CAP-JRN-001–004, CAP-JRN-007 | Bounded interview, implementation, and delta files | CAP-TEST-006, CAP-TEST-008, CAP-TEST-010, CAP-TEST-014, CAP-TEST-019 | Retain |
| Capability persistence | All approval/freshness journeys | Versioned local records | CAP-TEST-011, CAP-TEST-013 | Retain |
| Named bridge additions | Renderer journeys | Serializable privileged boundary | CAP-TEST-003, CAP-TEST-037 | Retain |
| Registry/resolver | Runtime and binding journeys | One approved provider lookup | CAP-TEST-023 | Retain |
| Immediate runtime host | CAP-JRN-005, CAP-JRN-007 | Contract validation and one-provider invocation | CAP-TEST-024 | Retain |
| Local job/artifact services | MATLAB and verification | Long work evidence and file identity | CAP-TEST-027 | Retain |
| Filesystem adapter | CAP-JRN-005 | Project-scoped file port | CAP-TEST-025 | Retain |
| MATLAB adapter | CAP-JRN-006 | Approved tool primitives and value translation | CAP-TEST-026–028 | Retain |
| MATLAB session manager | CAP-JRN-006 | One serialized project session | CAP-TEST-026–027 | Retain |
| MATLAB snapshot store | CAP-JRN-006 | Selected durable variables and compatibility metadata | CAP-TEST-028 | Retain |
| Preview selection/binding components | CAP-JRN-007 | Element evidence and operation mapping | CAP-TEST-029–031 | Retain |
| Azure DevOps adapter | CAP-JRN-008 | External requirement/evidence provenance | CAP-TEST-033–035 | Retain |
| Guided/Design/page projections | CAP-JRN-001–004, CAP-JRN-007–008 | Presentation of canonical records | CAP-TEST-005, CAP-TEST-012, CAP-TEST-020 | Retain |
| New service/package/database/queue | None | Duplicates local monolith | None | Reject |
| Event bus, file watcher, multi-provider router | None | Premature runtime abstractions | None | Defer |

## 61. Open decisions

No packet may resolve a blocking decision silently. Record the selected option, approver, date, and rationale in this document before starting the affected packet.

| Decision ID | Decision required | Constrained options | Default for estimation only | Blocks |
|---|---|---|---|---|
| `CAP-DEC-001` | Final projection names | Guided/Design or approved replacement pair | Guided/Design | UI copy only; non-blocking for contracts |
| `CAP-DEC-002` | Copilot interview/implementation transport | Existing external file export/import; integrated session | External file export/import | CAP-PKT-008, CAP-PKT-009, CAP-PKT-011, CAP-PKT-012 |
| `CAP-DEC-003` | Generated module language/runtime and repository root | One approved local target and one root convention | TypeScript-compatible local module under an approved repository root | CAP-PKT-009, CAP-PKT-012 |
| `CAP-DEC-004` | Version 1 schema/result approval | Approve proposed shapes; revise before adapters | Proposed CAP-CONTRACT shapes | CAP-PKT-001 and every downstream packet |
| `CAP-DEC-005` | App-managed capability storage, retention, backup/export | Exact user-data layout and retention/export behavior | Illustrative project capability directory; no automatic pruning | CAP-PKT-003, CAP-PKT-004, CAP-PKT-029 |
| `CAP-DEC-006` | Architecture diagram editing | Read-only select/focus; direct editing | Read-only select/focus | CAP-PKT-010 |
| `CAP-DEC-007` | Manual source change freshness | Verification-needed from owned-file hash; definition review plus verification | Verification-needed from owned-file hash | CAP-PKT-015 |
| `CAP-DEC-008` | Preview source locator | Required stable element marker; user-confirmed proposed source target | Stable marker with confirmation fallback | CAP-PKT-023, CAP-PKT-024 |
| `CAP-DEC-009` | Target-app runtime transport | Desktop bridge path; one local HTTP path | No estimate until target-runtime constraints from CAP-DEC-003 are known | CAP-PKT-017, CAP-PKT-024, CAP-PKT-025 |
| `CAP-DEC-010` | Credential-store provider and consequential-action approval wording | OS/application store supported by target platforms; explicit action designs | Platform OS credential store | CAP-PKT-026, CAP-PKT-030 |
| `CAP-DEC-011` | Minimum Azure DevOps read scopes | Approved least-privilege organization/project/work-item/pipeline/test/artifact reads | Read-only minimum | CAP-PKT-026, CAP-PKT-027 |
| `CAP-DEC-012` | Azure pipeline invocation in MVP | Read-only; explicitly approved invocation of configured pipeline | Read-only | CAP-PKT-028 |
| `CAP-DEC-013` | MATLAB integration mechanism and support matrix | Approved engine/API, operating systems, MATLAB versions, toolbox discovery | No implementation default | CAP-PKT-020–CAP-PKT-022 |

## 62. Definition of MVP completion

MVP is complete only when all of the following are true:

1. CAP-DEC-002 through CAP-DEC-013 are recorded before their dependent packets.
2. CAP-PKT-001 through CAP-PKT-032 meet their completion criteria.
3. All 53 normative requirements are implemented and traced.
4. CAP-TEST-001 through CAP-TEST-041 pass, except real MATLAB/Azure integration tests may be explicitly skipped only when the environment is unavailable; fake boundary tests remain mandatory.
5. CAP-JRN-001 through CAP-JRN-008 complete in the packaged desktop application with retained evidence.
6. One underlying record model powers Guided and Design projections.
7. Capability scope blocks out-of-packet overlays before apply.
8. Freshness never reports ready without exact successful verification provenance.
9. One filesystem operation, one persistent MATLAB workflow, one Preview binding, and one Azure requirement/evidence link work through standard contracts.
10. Existing Build & Test projects and runs retain their behavior.
11. Core journeys run without distributed infrastructure and without network access except the explicit Azure DevOps journey.
12. Deferred items in Section 60 are absent from implementation packages and MVP acceptance gates.
