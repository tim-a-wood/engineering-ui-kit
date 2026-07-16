# Capabilities Desktop Integration Goal

## Objective

Complete the integration of the Capabilities Executable Reference Architecture into the Engineering UI Kit desktop application so the reference architecture is the real user-facing implementation workflow, rather than an isolated core library, test suite, or collection of reference examples.

Work autonomously until the complete workflow is implemented, exercised through the packaged desktop application, verified on supported platforms, documented, committed, and pushed to `main`. Do not stop at intermediate green unit tests, library exports, mock bridges, or disconnected UI. Persist through failures and fix defects discovered during end-to-end validation.

## Current context

The CAP-ERA-001 implementation on `main` includes:

- Canonical capability contracts and workspace records.
- Foundation and deployable planning and approval.
- TypeScript and Python generators and runtimes.
- Deterministic `GenerationPlan` assembly.
- Transactional generation apply and rollback.
- `ConnectionVerificationRecord` generation and real connection verification.
- Existing-repository adoption and migration.
- Cross-platform core, runtime, and reference-example tests.
- Some application UI for foundation planning, module interviews, implementation handoffs, ZIP overlay import, and older module verification.

However, the executable architecture is not fully integrated into the desktop application:

- `assembleGenerationPlan` has no production desktop or renderer caller.
- `applyGenerationPlan` and `rollbackGenerationApply` have no production desktop workflow.
- `runConnectionVerification` has no production desktop or renderer caller.
- Build still primarily exports an external implementation handoff, imports a ZIP overlay, applies it through the older overlay mechanism, and uses the older module-verification path.
- The app does not visibly expose the generated architecture, generation plan, transactional application, rollback, or connection evidence as one coherent workflow.
- Pulling and opening the current application therefore looks largely unchanged despite the underlying libraries and tests.

## Primary outcome

A user must be able to take an approved UI-based, headless, or mixed-language capability project through the real application workflow:

> Plan → Design/Foundation → Build modules → Generate integration → Review changes → Apply transactionally → Connect entry points → Verify real connections → Inspect evidence → Roll back or regenerate when needed

The canonical records, generators, runtime packages, transactional apply system, and verification runner must be the authority behind that workflow.

## Required implementation

### 1. Establish the production orchestration layer

Create a desktop-owned application service that translates approved persisted records into the existing reference-architecture APIs.

It must:

- Load the approved architecture and foundation.
- Load approved `ModuleImplementationSpecification`s, `OperationContract`s, schemas, deployables, composition manifests, and inbound bindings.
- Identify unresolved or stale prerequisites without fabricating missing values.
- Assemble deterministic `GenerationPlan`s per affected deployable.
- Preserve impact-scoped regeneration.
- Persist plan metadata, hashes, warnings, generated artifacts, apply status, rollback IDs, commands, and verification relationships.
- Never make the renderer responsible for filesystem access, process execution, secrets, or transactional writes.

Do not duplicate generator, apply, or verification logic inside desktop IPC handlers or React components. Use the existing core APIs.

### 2. Add a complete privileged bridge

Add typed, narrow IPC operations for at least:

- Preview or assemble a generation plan.
- Load the current generation plan.
- Apply an approved generation plan.
- Load apply status and results.
- Roll back an applied generation plan.
- Run recorded build and test commands where required.
- Run connection verification for an approved binding and deployable.
- List and inspect `ConnectionVerificationRecord`s.
- Re-run stale or failed verification.
- Load the complete implementation and integration state after an application restart.

Keep the desktop bridge, preload, renderer bridge, mocks, and test doubles in parity.

Every mutating operation must require explicit intent and enforce project, path, ownership, preimage, approval, and staleness gates in the desktop process.

### 3. Persist the complete lifecycle

Persist enough canonical state to survive application restart without relying on React component state:

- `GenerationPlan` and plan hash.
- Input record versions and hashes.
- Generated virtual artifact references.
- Inspection status and warnings.
- Apply run, transaction journal outcome, and rollback ID.
- Commands executed and their bounded, redacted results.
- `ConnectionVerificationRecord`s.
- Verification freshness and impact relationships.
- Current workflow status and attention reasons.

Migration must be lossless for existing capability workspaces. Existing handoffs, overlays, approved architecture, modules, deployables, and bindings must remain readable.

### 4. Integrate the Build experience

Replace the disconnected handoff-only experience with a coherent implementation workflow.

For each module and deployable, show:

- Approved module responsibility and interview outcome.
- Hosting deployable, runtime language, host kind, and composition root.
- Generated contracts and type targets.
- Editable versus generated paths.
- Inbound and outbound relationships.
- Current generation, apply, and verification status.
- Attention items and stale reasons.

The user must be able to:

- Preview what will be generated or updated.
- Inspect exact files, dependency changes, ownership, warnings, and commands.
- Apply the approved plan transactionally.
- See success or failure without losing the original repository state.
- Roll back a successful application.
- Regenerate after approved record changes.
- Revisit a module interview and see only affected artifacts become stale.
- Use **Build UI with Agent** where appropriate without bypassing canonical generation and integration records.

External-agent implementation remains available for genuinely editable business implementation, but it must not substitute for deterministic reference-architecture infrastructure generation.

The handoff must clearly distinguish:

- Generated infrastructure that the application owns.
- Editable implementation files an agent or developer must complete.
- Acceptance commands and unresolved decisions.
- Contracts, composition boundaries, and paths that must not be invented or changed.

### 5. Integrate Connect with actual deployables

Connect must configure real inbound bindings against approved deployables rather than a random preview UI.

Support:

- UI and browser-local.
- Electron renderer-to-main IPC.
- HTTP.
- CLI.
- Schedule and background worker.
- Embedded-library and headless callable.
- Explicit deferred entry points.

The interface must:

- Start from the approved deployable and foundation topology.
- Offer only host kinds compatible with that deployable.
- Default exposure to private.
- Support multiple bindings per operation.
- Automate obvious mappings.
- Ask only about material ambiguity.
- Generate or update the affected inbound adapter and composition wiring.
- Keep deferred connections visible and incomplete.
- Never require a UI for headless applications.

### 6. Integrate real verification

Use `runConnectionVerification` as the application authority for connection verification.

The app must:

- Launch the actual generated target using recorded commands.
- Perform the actual configured trigger.
- Capture the observed adapter → composition root → operation → outbound adapter path.
- Distinguish real evidence, simulation, and test-adapter evidence.
- Prevent simulation from producing a passing status.
- Keep unavailable live dependencies outstanding when a test adapter is used.
- Redact secret-bearing inputs and output.
- Bound all commands and clean up processes.
- Persist evidence and display it in understandable form.
- Re-run only stale or affected verification after changes.

A module, deployable, or project cannot be marked fully verified without valid current evidence for every required non-deferred entry point.

### 7. Reconcile the legacy ZIP-overlay path

Do not leave two competing application workflows.

Decide and implement a clear migration:

- Reuse the existing overlay inspector for external editable-code returns where appropriate.
- Use `GenerationPlan` and `applyGenerationPlan` for application-owned deterministic generation.
- Ensure the two mechanisms share ownership, expected-path, preimage, warning, staleness, and evidence rules.
- Prevent an external overlay from overwriting generated-owned files unless an explicit supported migration path exists.
- Remove or relabel obsolete actions so users understand which path implements infrastructure and which path supplies editable business code.
- Preserve existing project compatibility and rollback safety.

### 8. Provide a polished user experience

The new integration must be clearly visible in both Guided and Design projections.

Guided mode should explain outcomes in product language. Design mode should additionally expose:

- Record and contract identifiers.
- Plan, input, and content hashes.
- Generated and editable boundaries.
- Composition registrations.
- Commands.
- Verification trace paths.
- Evidence and rollback IDs.

Provide clear states for:

- Not ready.
- Ready to generate.
- Plan ready for review.
- Blocked by ambiguity.
- Ready to apply.
- Applying.
- Applied.
- Implementation incomplete.
- Ready to connect.
- Verification running.
- Partially verified.
- Failed.
- Stale.
- Verified.
- Rolled back.

Avoid raw exceptions, duplicate error lists, disabled buttons without explanations, and workflow states with no next action.

### 9. Complete production gaps encountered during integration

Audit the existing implementation rather than trusting completion ledgers.

If required by the real application workflow, complete outstanding gaps such as:

- Python composition-root generation.
- Real dependency-injection resolution instead of unresolved placeholders.
- Typed Electron renderer, preload, and main generation.
- React source-marker adoption.
- Generated OpenAPI and client artifact application.
- Runtime-package distribution and resolution.
- Registry and composition equivalence.
- Electron and Python launch presets.
- Verification freshness and attention aggregation.
- Shared JSON secret redaction.

Treat these as required when they block the stated end-to-end outcome. Do not broaden into unrelated product redesign.

### 10. Verification and evidence

Add tests at appropriate layers:

- Pure orchestration tests.
- Persistence and migration tests.
- IPC and bridge-parity tests.
- Renderer workflow tests.
- Transactional failure and rollback tests.
- Existing-repository tests.
- UI, headless, TypeScript, Python, and mixed React/Python tests.
- Packaged Electron end-to-end tests using the real desktop bridge and filesystem.
- Windows, macOS, and Linux or server validation where applicable.

Required packaged-application journeys follow.

#### A. TypeScript UI project

Approve foundation → generate → apply → connect UI → launch → trigger → pass verification.

#### B. Headless Python project

Approve foundation → generate → apply → configure HTTP, CLI, or schedule → launch → trigger → pass verification without any UI module.

#### C. Mixed React/Python project

Generate and apply both deployables → preserve HTTP boundary → launch Python backend → invoke it from the React side → capture current cross-language evidence.

#### D. Existing repository

Preview migration → preserve original files → apply additively → confirm legacy behavior remains invocable → roll back → confirm byte-identical restoration.

#### E. Failure recovery

Force a mid-transaction failure → prove exact restoration and recoverable UI state after application restart.

Do not count a unit test, mock bridge, direct dispatcher call, reference fixture, or unlaunched Electron adapter as packaged-application end-to-end evidence.

## Completion gate

The goal is complete only when:

- The packaged desktop application visibly exposes and uses the reference-architecture workflow.
- Production desktop and renderer call sites invoke generation assembly, transactional apply and rollback, and real connection verification.
- UI and headless projects can complete the workflow.
- TypeScript, Python, and mixed-language targets are covered.
- State survives restart.
- Existing projects migrate losslessly.
- The old and new implementation workflows no longer conflict.
- Required packaged-application journeys pass.
- Supported-platform CI is green.
- No known severity-1 or severity-2 correctness, security, migration, or data-loss defect remains.
- Documentation accurately distinguishes completed behavior from optional follow-up work.
- The completion ledger and evidence index point to real tests and packaged-application evidence.
- The application has been rebuilt from the final source and visually inspected.
- All changes are committed and pushed to `main`.
- Remote `main` is verified to contain the final commit.
- The worktree is clean.

## Operating constraints

- Preserve unrelated user changes.
- Do not modify frozen contract fields or schemas casually. Use the documented contract-change protocol for a proven defect.
- Prefer additive, lossless migration.
- Never fabricate architecture, contracts, paths, commands, credentials, or user decisions.
- Keep secrets out of canonical records, logs, packets, evidence, and UI.
- Keep filesystem, process, and credential authority in Electron main.
- Keep generated and editable ownership explicit.
- Run bounded commands and terminate child processes.
- Do not declare completion based solely on test counts or a ledger.
- Inspect actual production call sites and demonstrate the workflow through the packaged application.
- Fix issues autonomously while they remain within this goal.
- Pause only for a material product contradiction, destructive migration decision, unavailable credential or external dependency that cannot be represented honestly, or a required user decision that would materially alter architecture.
- Provide concise progress updates while working.
- At completion, report the final `main` commit, CI links, packaged-application evidence, supported journeys, and any genuinely optional non-blocking limitations.

## Agent coordination constraint

Use subagents only for bounded read-only audits, isolated tests, or disjoint implementation packets. The primary agent owns architecture decisions, shared production files, integration, packaged-application validation, and final completion claims. Never allow parallel agents to edit overlapping paths.

## Suggested `/goal` command

```text
/goal Complete the production integration described in docs/CAPABILITIES-DESKTOP-INTEGRATION-GOAL.md. Treat that document as the authoritative scope and completion criteria. Audit actual production call sites rather than trusting existing ledgers. Continue until the packaged desktop app visibly uses generation assembly, transactional apply/rollback, and real connection verification for UI, headless, and mixed-language projects; all required packaged-app journeys and supported-platform CI pass; documentation reflects reality; and the verified final changes are committed and pushed to main. Do not declare completion from core tests, mocks, reference examples, or disconnected UI alone.
```
