# Use-case-led Capabilities workflow

## Executive decision

Engineering UI Kit should **augment the current Plan stage with a richer,
AI-assisted use-case analysis and compile that analysis into the existing
`ApplicationSpecification`**. It should not immediately replace the existing
contract or add another top-level lifecycle stage.

The human experience becomes:

> Describe the outcome → check only the uncertain parts → approve the product
> story → review a proposed solution map → reshape it if needed → approve

The canonical implementation remains:

> Plan → Design → Build → Connect → Verify

The product-facing name for the new experience is **Shape the product**. “Use
case analysis” is an optional technical label visible in Design mode, exports,
and machine APIs. A user should not have to understand actors, preconditions,
alternative flows, bounded contexts, ports, adapters, dependency graphs, or
quality-attribute scenarios to get a useful proposal.

This is an additive migration because the repository already has the right
downstream spine:

- `ApplicationSpecification` records outcomes, actors, goals, use cases,
  scenarios, information, rules, external systems, constraints, scope, and
  acceptance cases.
- the product gate already requires people, outcomes, workflows, scope, and
  acceptance evidence;
- `ArchitectureSpecification` already records modules, dependencies,
  operations, adapters, and workflow traces;
- architecture evaluation already detects untraced modules and dependency
  cycles;
- foundation planning, module proposal, implementation waves, frontend brief
  compilation, connection, and verification already consume these approved
  records and their hashes.

The missing piece is not a new lifecycle. It is a richer upstream analysis,
an exception-led review experience, and an explainable compiler from human
intent to product and architecture truth.

---

## 1. Desired outcome

### For a human

A user should be able to begin with one plain-language statement such as:

> Help certification engineers explore lifecycle evidence, investigate trace
> gaps, disposition findings, and create reproducible audit packages from
> MATLAB, files, source code, spreadsheets, and review records.

The tool should scan the context the user has allowed, create a complete first
analysis, and ask only questions whose answers materially change scope,
behavior, safety, or architecture. The user reviews recognizable stories and
outcomes rather than filling in a technical questionnaire.

The target interaction budget for a medium-sized application is:

1. one outcome description;
2. zero to five high-value clarification answers;
3. one product-story approval;
4. one architecture option selection;
5. zero to three restructuring actions;
6. one architecture approval.

That is a target, not a promise. A high-risk or contradictory project can
legitimately need more review, but the tool must explain why.

### For an LLM or automation client

The same workflow should be available as stable, idempotent operations. An
agent should not imitate clicks, manually compose a large
`ApplicationSpecification`, or make one handoff for every module.

The target machine workflow is:

1. `usecases.analysis.create`
2. `usecases.analysis.resolve` when blockers exist
3. `usecases.analysis.approve`
4. `architecture.proposal.create`
5. `architecture.proposal.restructure` when requested
6. `architecture.proposal.approve`

Every response should return structured diagnostics, source revisions,
affected targets, hashes, legal next actions, and whether a retry was replayed.

### For the underlying system

The tool must preserve explicit approvals, content hashes, impact-scoped
staleness, ports-and-adapters boundaries, and evidence-backed completion.
Automation may propose and compile. It must not silently approve or erase a
human override.

---

## 2. Product principles

### 2.1 Ask for intent, derive structure

Ask:

- What should people be able to accomplish?
- What source material may the tool use?
- Which uncertainty materially changes the result?

Derive:

- actors and goals;
- primary, alternative, failure, and recovery scenarios;
- information, rules, scope, acceptance observations, and quality drivers;
- architecture modules, operations, ports, adapters, dependencies, and
  deployables.

### 2.2 Review exceptions, not generated paperwork

The normal review surface should contain:

- a short product promise;
- “people and outcomes” cards;
- end-to-end story cards;
- assumptions that need confirmation;
- missing or conflicting evidence;
- a concise readiness summary.

The full record remains inspectable, but it is not the default task.

### 2.3 Progressive disclosure has two stable modes

**Guided** uses plain language, story cards, confidence phrased as certainty,
and a single next action. IDs, schema names, hashes, gate codes, and raw
dependency data are hidden.

**Design** shows the same canonical state with IDs, provenance, confidence
scores, analysis revisions, trace matrices, contracts, gates, and JSON export.
Switching mode must not create a separate draft or alternate truth.

### 2.4 Proposals must explain themselves

Every proposed module and adapter should answer:

- What human need does this support?
- Why is it separate?
- What does it own?
- What is deliberately outside it?
- What depends on it?
- What changes if it is merged, split, or removed?

### 2.5 Human changes become durable decisions

Renames, merges, splits, type changes, responsibility edits, and adapter
reassignments are stored as decision records. Regeneration reapplies valid
decisions and flags conflicts. It never silently returns the design to the
model’s original proposal.

### 2.6 Confidence is a review aid, not truth

“High confidence” means evidence was consistent, not that the inference is
correct. The UI distinguishes sourced, inferred, confirmed, overridden, and
contradicted content. Approval remains explicit.

---

## 3. Seamless place in the current workflow

### 3.1 Keep the five top-level stages

| Current stage | Proposed user-facing task | Canonical output |
|---|---|---|
| Plan | **Shape the product** | Approved `UseCaseAnalysis` compiled to approved `ApplicationSpecification` |
| Design | **Shape the solution** | Approved `ArchitectureSpecification` and foundation plan |
| Build | **Build the solution** | Approved modules, generated integration, applied results |
| Connect | **Connect entry points** | Approved inbound bindings and verified connections |
| Verify | **Prove it works** | Verification records and completion evidence |

No sixth “Analysis” stage is added. Analysis is how Plan becomes faster and
more complete.

### 3.2 Plan has three lightweight internal moments

1. **Describe** — a single outcome prompt, context selection, and an optional
   example or constraint.
2. **Check** — the system presents what it understood and only the questions
   that materially affect the result.
3. **Approve** — a product-story summary shows scope, critical stories,
   acceptance observations, and what Design will receive.

The moments are not a wizard that traps users in sequence. A user can revisit
any completed moment, and the main command always explains the current best
action.

### 3.3 Design begins with a generated solution map

Design no longer opens with a blank architecture interview. It opens with:

- a recommended architecture shape;
- one or two materially different alternatives when evidence justifies them;
- modules arranged in Experience, Workflow, Domain, Connections, and Platform
  lanes;
- visible end-to-end use-case coverage;
- a short list of genuine design decisions;
- an impact-aware restructuring surface.

The existing architecture contract remains the approved output.

### 3.4 Downstream stages remain compatible

The compiled application and approved architecture continue to feed:

- foundation and deployable proposals;
- batch module proposals;
- dependency-safe implementation waves;
- generated integration plans;
- frontend briefs compiled from experience modules and workflow traces;
- connection and adapter work;
- verification plans and completion evidence;
- impact analysis when approved intent changes.

---

## 4. Human interaction design

## 4.1 Entry states

### New project

The primary action on Project Overview is **Shape the product**. The page shows
one sentence:

> Describe what people need to accomplish. We’ll draft the workflows and a
> solution for you to review.

### Existing project with repository context

The tool offers selected, read-only context sources:

- project name and description;
- README and architecture documentation;
- repository language/framework discovery;
- existing routes, schemas, APIs, and entry points;
- approved Capabilities records;
- explicitly attached requirement or design documents.

Each source shows whether it will be read, how much content is included, and
whether it stays local. Sources outside the project boundary require explicit
selection.

### Existing approved application

The action becomes **Improve product story**. Analysis is seeded from the
approved `ApplicationSpecification`; the original remains approved until a new
revision passes review. The UI previews which downstream artifacts would
become stale before approval.

### Imported structured definition

Existing application JSON can still be imported. The tool creates a derived
analysis marked “imported structure” and asks only about gaps needed for richer
architecture reasoning.

## 4.2 Describe

The page contains one large, plain-language prompt:

> What should people be able to accomplish?

Supporting prompts are optional and compact:

- “Include a real example”
- “Mention anything that must never happen”
- “Add a source”

Useful starter actions:

- **Use project context**
- **Start from existing definition**
- **Paste notes**
- **Import document**
- **Start without context**

The action is **Draft product story**. It launches an observable analysis job
with progress expressed in human terms:

1. Understanding people and outcomes
2. Finding important moments and exceptions
3. Checking boundaries and external systems
4. Preparing acceptance observations
5. Shaping architecture drivers

Cancellation preserves the user’s input. Retry is idempotent.

## 4.3 Check

The result opens on **What I understood**, not on a form.

### Product promise

A two- or three-sentence summary with **Correct** and **Edit** actions.

### People and outcomes

Each card combines an actor with the result they need. The user can confirm,
correct, combine, or remove a card. “Actor” is not used in Guided mode.

### Key stories

Each story uses a recognizable narrative:

> When a certification engineer sees a trace gap, they can follow the chain
> across requirements, design, code, tests, and reviews, see where the link
> breaks, and record a finding without modifying source evidence.

The collapsed card shows:

- who;
- the trigger;
- the desired outcome;
- whether it is critical;
- source/confirmation state.

Expanding it shows normal steps, notable alternatives, failure/recovery, and
observable completion. Technical precondition/postcondition terminology only
appears in Design mode.

### Needs your input

Only material uncertainty becomes a question. Each question:

- uses plain language;
- explains why it matters;
- offers two to four concrete choices;
- recommends one choice when evidence supports it;
- allows “not now” when it is not approval-blocking;
- previews the architectural impact of each choice when applicable.

Example:

> If MATLAB is unavailable, should users still be able to open the last
> published evidence snapshot?

Choices:

- Yes — keep audit work available (recommended)
- No — block the workspace until MATLAB returns
- Only allow read-only browsing

The user never sees “quality attribute scenario: availability” unless they
open Design details.

### Ready signal

Instead of a generic percentage, show:

- **Ready to shape a solution**
- **Ready, with 3 assumptions**
- **2 answers needed**

A secondary coverage strip shows People, Stories, Boundaries, Recovery, and
Proof. It is a completeness aid, not gamified false precision.

## 4.4 Approve the product story

The approval dialog contains:

- product promise;
- number of people/outcomes;
- critical and supporting stories;
- external boundaries;
- non-negotiable constraints;
- acceptance observations;
- assumptions carried forward;
- downstream impact.

Approval writes both the analysis revision and its compiled
`ApplicationSpecification`. The button reads **Approve and shape solution**.

## 4.5 Review the solution map

### Lanes

The default map uses stable, understandable lanes:

| Guided label | Technical classification |
|---|---|
| Experiences | `experience` modules |
| Coordinators | `workflow` modules |
| Core knowledge | `domain` modules |
| Connections | `connection` modules and adapters |
| Shared foundation | `platform` modules |

Guided mode may label the whole surface “Solution map.” Design mode adds
module IDs, types, ports, operations, and dependency directions.

### Architecture options

Only materially different options are shown. The recommended option is open by
default.

1. **Cohesive application** — a modular monolith with explicit internal ports.
   Prefer this unless independent scaling, security isolation, deployment
   ownership, or technology boundaries justify more.
2. **Separated integration boundary** — isolates long-running or proprietary
   external-system extraction behind a worker/process boundary.
3. **Distributed services** — generated only when the quality drivers
   genuinely require independent deployment or scaling. It is never offered
   merely because the model can imagine it.

Each option states operational cost, deployment count, failure boundaries,
testing burden, and the use-case drivers it addresses.

### Restructuring controls

Users can:

- rename a module;
- edit its responsibility;
- merge selected modules;
- split a module by rule set, workflow, ownership, or runtime boundary;
- change its classification;
- move an operation;
- assign or separate an adapter;
- redirect a dependency;
- add a missing boundary;
- choose a different architecture option.

Every action previews:

- use cases affected;
- operations moved;
- new or removed dependencies;
- adapter/port consequences;
- foundation and build artifacts made stale;
- gate status.

Actions are undoable until approval. Approved revisions remain immutable.

### Coverage inspector

Selecting a story highlights the modules and adapters that serve it in order.
Selecting a module shows every story, rule, information object, and external
boundary that justifies it. The inspector calls out:

- unserved stories;
- orphan modules;
- external systems without adapters;
- adapters without an external actor;
- operations without owners;
- cycles;
- critical failure paths without recovery;
- quality drivers not reflected in a boundary or deployable decision.

## 4.6 Approve the architecture

The approval dialog shows:

- selected architecture option;
- module and adapter counts by type;
- use-case coverage;
- remaining non-blocking assumptions;
- deployable expectation;
- estimated implementation waves;
- explicit human changes to the generated proposal;
- downstream output that will be created.

The action is **Approve and plan the build**.

---

## 5. Canonical analysis model

Introduce provisional **CAP-CONTRACT-030: `UseCaseAnalysis`**. It is richer
than `ApplicationSpecification`, but compiles to it deterministically.

```ts
type UseCaseAnalysis = {
  schemaVersion: '1.0'
  projectId: string
  analysisId: string
  revision: string
  status: 'draft' | 'proposed' | 'approved' | 'superseded'
  intent: {
    prompt: string
    purpose: string
    outcomes: AnalysisItem[]
  }
  people: PersonNeed[]
  stories: UseCaseStory[]
  information: AnalysisItem[]
  rules: AnalysisItem[]
  externalActors: ExternalActor[]
  qualityDrivers: QualityDriver[]
  scope: {
    inScope: AnalysisItem[]
    outOfScope: AnalysisItem[]
  }
  acceptanceObservations: AcceptanceObservation[]
  uncertainties: Uncertainty[]
  contradictions: Contradiction[]
  sources: AnalysisSource[]
  coverage: AnalysisCoverage
  decisions: AnalysisDecision[]
  applicationProjection?: {
    applicationSpecId: string
    revision: string
    contentHash: string
  }
  createdAt: string
  contentHash: string
}
```

### 5.1 Common analysis item

```ts
type AnalysisItem = {
  id: string
  text: string
  criticality: 'critical' | 'important' | 'supporting'
  state: 'sourced' | 'inferred' | 'confirmed' | 'overridden' | 'contradicted'
  confidence?: number
  evidenceRefs: string[]
  rationale?: string
}
```

Confidence is optional for sourced or human-confirmed facts. It is not copied
into the user-facing product contract.

### 5.2 People and needs

```ts
type PersonNeed = {
  id: string
  name: string
  description: string
  outcomeIds: string[]
  permissions?: string[]
  channels?: string[]
  evidenceRefs: string[]
  state: AnalysisItem['state']
}
```

An external software system is not a person. Scheduled jobs and automated
actors are represented as external actors with triggers.

### 5.3 Use-case story

```ts
type UseCaseStory = {
  id: string
  title: string
  summary: string
  primaryPersonId: string
  supportingPersonIds: string[]
  trigger: string
  preconditions: string[]
  normalFlow: StoryStep[]
  alternatives: ScenarioFlow[]
  failures: ScenarioFlow[]
  recovery: ScenarioFlow[]
  postconditions: string[]
  informationIds: string[]
  ruleIds: string[]
  externalActorIds: string[]
  qualityDriverIds: string[]
  acceptanceObservationIds: string[]
  criticality: 'critical' | 'important' | 'supporting'
  evidenceRefs: string[]
  state: AnalysisItem['state']
  confidence?: number
}
```

Steps describe intent and observable behavior. They do not prescribe HTTP
endpoints, frameworks, tables, classes, or deployment topology.

### 5.4 External actors

```ts
type ExternalActor = {
  id: string
  name: string
  kind: 'system' | 'device' | 'filesystem' | 'human-organization' | 'service'
  exchanges: {
    direction: 'in' | 'out' | 'both'
    informationIds: string[]
    trigger?: string
  }[]
  availability?: 'required-live' | 'degraded-mode' | 'snapshot-allowed'
  trustBoundary?: string
  evidenceRefs: string[]
  state: AnalysisItem['state']
}
```

This makes the later “adapter per external actor/technology” rule explicit
without forcing the user to reason about adapters.

### 5.5 Quality drivers

```ts
type QualityDriver = {
  id: string
  category:
    | 'availability' | 'performance' | 'security' | 'privacy'
    | 'safety' | 'auditability' | 'portability' | 'scale'
    | 'offline' | 'maintainability'
  stimulus: string
  context: string
  expectedResponse: string
  measure?: string
  criticality: 'critical' | 'important' | 'supporting'
  evidenceRefs: string[]
  state: AnalysisItem['state']
}
```

Guided mode renders these as “Important behavior,” for example:

> Keep the last valid evidence snapshot available when MATLAB is offline.

### 5.6 Uncertainty and contradiction

```ts
type Uncertainty = {
  id: string
  question: string
  plainReason: string
  choices: {
    id: string
    label: string
    consequence: string
    recommended?: boolean
  }[]
  blocking: boolean
  affectedIds: string[]
  answer?: string
}
```

Contradictions are separate because a question cannot safely hide conflicting
sources. A contradiction names both evidence references, the affected stories,
and the decision needed.

### 5.7 Provenance

An `AnalysisSource` stores source identity, allowed scope, checksum/revision,
retrieval time, extractor version, and structured evidence references. It must
not duplicate entire proprietary documents unless the user explicitly imports
them into the project.

Model chain-of-thought is never persisted. Store concise rationales and
evidence links, not hidden reasoning transcripts.

---

## 6. Deterministic compilation into the current product contract

Implement a pure `compileApplicationSpecification(analysis)` function.

| `UseCaseAnalysis` | `ApplicationSpecification` |
|---|---|
| `intent.purpose` | `purpose` |
| confirmed/proposed `intent.outcomes` | `outcomes` |
| `people` | `actors` |
| person/outcome relationships | `goals` |
| `stories` | `useCases` |
| normal, alternative, failure, and recovery flows | `scenarios` |
| `information` | `information` |
| `rules` | `rules` |
| `externalActors` | `externalSystems` |
| `qualityDrivers` plus explicit constraints | `constraints` |
| analysis scope | `scope` |
| `acceptanceObservations` | `acceptanceCases` |
| source descriptors | `sources` |
| blocking unanswered uncertainties and contradictions | `unresolvedQuestions` |

Compilation rules:

1. IDs are stable across re-analysis when semantic identity is unchanged.
2. Output ordering is canonical.
3. The same approved analysis produces the same product content hash.
4. Low-confidence supporting inferences may compile if visibly identified as
   assumptions; blocking uncertainty may not pass the product gate.
5. Human-confirmed and overridden values take precedence over inferred values.
6. Removed items remain addressable in revision history but do not compile.
7. The compiled draft is validated with the existing schema and evaluated by
   the existing product gate.
8. Approval is transactional: either both analysis and compiled application
   revisions are approved, or neither is.
9. A later analysis revision does not change the current approved application
   until explicitly approved.
10. Approval reports which architecture, foundation, modules, bindings, and
    verification evidence become stale.

This preserves compatibility with current architecture, frontend, build,
connect, and verification logic.

---

## 7. Architecture derivation model

Introduce provisional **CAP-CONTRACT-031:
`ArchitectureProposalRationale`**. The approved architecture remains
`ArchitectureSpecification`; the rationale records how it was derived and how
the user changed it.

### 7.1 Inputs

- approved use-case analysis and compiled application hash;
- repository discovery evidence;
- approved organizational constraints;
- existing architecture when revising;
- runtime and deployable evidence;
- human design decisions and locked boundaries.

### 7.2 Derivation sequence

1. Build a graph of people, stories, steps, rules, information, external
   actors, quality drivers, and acceptance observations.
2. Identify end-to-end workflow coordinators from story flows.
3. Cluster rules and information that must remain internally consistent.
4. identify external boundaries and trust/runtime differences.
5. identify experience channels and actor-specific interaction needs.
6. identify cross-cutting foundation needs justified by quality drivers.
7. propose operations at stable responsibility boundaries.
8. create ports for dependencies that cross a boundary.
9. create actor/technology-specific adapters for external exchanges.
10. choose the least distributed deployable topology that satisfies the
    quality drivers.
11. calculate workflow traces, unsupported stories, orphan modules, cycles,
    and unowned operations.
12. produce one recommendation and only evidence-backed alternatives.

### 7.3 Module inference rules

#### Experience modules

Propose an `experience` module when a distinct user channel, task environment,
interaction model, or independently changing experience warrants one. Do not
create a module per screen.

#### Workflow modules

Propose a `workflow` module for orchestration spanning multiple domain or
connection boundaries, especially when compensation, recovery, authorization,
or long-running progress is part of a story. Do not hide core business rules
in the coordinator.

#### Domain modules

Cluster information and rules that must remain consistent together. Split only
when there is evidence of distinct rules, independent change, reuse,
ownership, or lifecycle. Shared nouns alone are insufficient.

#### Connection modules and adapters

For each external actor:

1. define a technology-neutral port owned by the consuming workflow/domain;
2. create at least one actor/technology-specific adapter;
3. separate adapters when credentials, process lifecycle, failure semantics,
   deployment, or data ownership differ;
4. do not merge MATLAB, filesystem, Git, spreadsheets, source scanning, or
   review evidence into a generic adapter merely because all ingest data;
5. allow several format handlers inside one adapter only when they represent
   the same external actor and lifecycle.

#### Platform modules

Propose a `platform` module only for justified shared runtime concerns such as
persistence, job execution, secrets, telemetry, or configuration. Do not use
“platform” as a home for unclear responsibilities.

### 7.4 Split tests

A proposed module separation needs at least one justification:

- distinct rules/invariants;
- independent change cadence;
- reuse across workflows;
- external actor or trust boundary;
- runtime or deployment isolation;
- independent scaling;
- materially different availability or failure behavior;
- organizational ownership.

If none apply, prefer a cohesive module.

### 7.5 Dependency rules

- Experience calls workflow/application ports.
- Workflow coordinates domain and connection ports.
- Domain does not depend on experience or concrete adapters.
- Concrete adapters depend inward on ports/contracts.
- Platform dependencies are explicit and narrowly owned.
- Every edge has a human-readable reason and supporting story/rule IDs.
- Cycles are blocked unless represented through an explicit event boundary
  whose semantics are documented.

### 7.6 Operation derivation

Candidate operations come from meaningful story transitions, not every UI
gesture. Each operation proposal includes:

- user-visible intent;
- owning module;
- input and output concepts;
- preconditions and postconditions;
- domain rejections;
- technical failure expectations;
- idempotency and cancellation need;
- stories and acceptance observations it supports.

Detailed schemas remain a module-definition task after architecture approval.

### 7.7 Architecture option policy

The recommender scores options against:

- story coverage;
- quality-driver satisfaction;
- boundary clarity;
- dependency health;
- deployment and operational cost;
- estimated implementation waves;
- repository fit;
- migration cost from existing architecture.

The score is explainable and never substitutes for the design gate.

### 7.8 User restructuring

Each edit creates an `ArchitectureDecision`:

```ts
type ArchitectureDecision = {
  id: string
  action: 'rename' | 'merge' | 'split' | 'retype' | 'move-operation'
    | 'move-adapter' | 'redirect-dependency' | 'add' | 'remove'
  targets: string[]
  rationale: string
  createdBy: string
  createdAt: string
  sourceProposalHash: string
  resultingArchitectureHash: string
}
```

Regeneration replays compatible decisions. Conflicts appear as explicit review
items.

---

## 8. Gates and readiness

### 8.1 Analysis readiness

Provisional `CAP-GATE-030` checks:

- at least one person or automated initiator;
- at least one observable outcome;
- at least one end-to-end story;
- every critical story has a trigger, outcome, and acceptance observation;
- critical failure paths have explicit recovery or an acknowledged hard stop;
- referenced information, rule, external actor, and quality-driver IDs exist;
- no unresolved blocking contradiction;
- every blocking uncertainty is answered;
- source and inference states are valid;
- the analysis compiles to a schema-valid `ApplicationSpecification`;
- the existing product gate passes.

Warnings do not become blockers simply to improve a completeness score.

### 8.2 Architecture readiness

Extend the architecture evaluation, without weakening the current gate:

- every critical story has a workflow trace;
- every external actor used by a story has a port and concrete adapter
  allocation or an explicit deferred decision;
- every operation has one owner;
- every module has supporting story/rule/quality-driver evidence;
- no orphan module;
- every dependency edge has a reason and evidence reference;
- no prohibited cycle;
- critical recovery and availability drivers are reflected in boundaries and
  deployable decisions;
- user decisions are internally consistent;
- architecture input hashes match the currently approved analysis and
  application.

### 8.3 Guided presentation

Guided mode translates gate output:

| Technical diagnostic | Guided message |
|---|---|
| missing critical acceptance observation | “How will we know this worked?” |
| external actor lacks adapter | “Choose how the solution will connect to MATLAB.” |
| orphan module | “This part of the solution is not needed by any approved story.” |
| dependency cycle | “These responsibilities depend on each other in a loop.” |
| stale analysis hash | “The product story changed after this solution was proposed.” |

Codes and related IDs remain available in Design details.

---

## 9. Ports-and-adapters implementation

### 9.1 Core/application layer

Add pure services:

- `analyzeUseCases`
- `mergeAnalysisEvidence`
- `resolveAnalysisUncertainty`
- `evaluateAnalysisGate`
- `compileApplicationSpecification`
- `proposeArchitectureFromAnalysis`
- `applyArchitectureDecision`
- `evaluateArchitectureCoverage`
- `calculateAnalysisImpact`

The core accepts structured provider results. It does not directly call an LLM
or read files.

### 9.2 Inbound ports

- renderer bridge operations for create, status, review, resolve, approve,
  propose, restructure, and approve architecture;
- versioned machine API operations with equivalent behavior;
- CLI descriptors generated from the same operation catalog;
- optional import of a complete `UseCaseAnalysis` for regulated or external
  workflows.

### 9.3 Outbound ports

```ts
interface AnalysisProviderPort {
  analyze(input: AnalysisProviderInput): Promise<AnalysisProviderResult>
  refine(input: AnalysisRefinementInput): Promise<AnalysisProviderResult>
}

interface ContextSourcePort {
  describe(selection: ContextSelection): Promise<ContextDescriptor[]>
  read(selection: ContextSelection): Promise<ContextEvidence[]>
}

interface ArchitectureProposalPort {
  propose(input: ArchitectureProposalInput): Promise<ArchitectureCandidate[]>
}
```

Initial adapters:

- existing Copilot packet/export/import adapter;
- in-process Codex/agent adapter when available;
- deterministic rules adapter used for testing and offline fallback;
- repository context adapter;
- approved-record adapter;
- document/import adapter.

Provider-specific prompts and credentials remain outside the core.

### 9.4 Analysis orchestration

Analysis is a cancellable job:

1. snapshot allowed source descriptors and hashes;
2. extract bounded evidence;
3. run deterministic discovery;
4. request structured analysis from the provider;
5. validate and normalize the result;
6. merge with locked human decisions;
7. compute contradictions, uncertainties, coverage, and gate state;
8. persist a proposed revision;
9. return a human summary and legal next action.

A failed provider call never corrupts the last proposed or approved revision.

### 9.5 Persistence

Suggested project-local structure:

```text
capabilities/
  analysis/
    use-case-analysis.draft.json
    approved/
      use-case-analysis.<revision>.json
    decisions/
      <decision-id>.json
    sources/
      source-index.json
    jobs/
      <job-id>.json
  approved/
    application.json
    architecture.json
```

Approved revisions are immutable. A pointer identifies the current approved
analysis. Content hashes cover semantic content, not UI expansion state.

### 9.6 Machine API

| Operation | Mutates | Explicit approval |
|---|---:|---:|
| `usecases.context.describe` | No | No |
| `usecases.analysis.create` | Yes | No |
| `usecases.analysis.get` | No | No |
| `usecases.analysis.resolve` | Yes | No |
| `usecases.analysis.evaluate` | No | No |
| `usecases.analysis.approve` | Yes | Yes |
| `architecture.proposal.create` | Yes | No |
| `architecture.proposal.evaluate` | No | No |
| `architecture.proposal.restructure` | Yes | No |
| `architecture.proposal.approve` | Yes | Yes |

Mutations require idempotency keys. Approval requests require the expected
source hash and `explicit: true`.

### 9.7 Existing interview compatibility

Phase one can emit and import the new structured analysis through the existing
Copilot handoff mechanism. The packet asks the agent to return
`UseCaseAnalysis`, not a hand-written product specification. The application
then compiles and saves the current draft.

When an in-app provider is available, the exact same application service is
called without export/import ceremony. The UI does not care which adapter
produced the proposal.

---

## 10. DO-178C Audit Hub worked example

### 10.1 Minimal input

> Certification engineers need to explore requirements, design, source, tests,
> reviews, coverage, and traceability from Simulink and project files; find
> gaps; manage findings; and create reproducible audit packages without
> changing authoritative evidence.

### 10.2 Analysis produced automatically

People and outcomes:

- Certification engineer — assess objective and lifecycle evidence readiness.
- Verification lead — investigate trace and coverage gaps.
- Quality reviewer — review and disposition findings independently.
- Software lead — refresh evidence and understand impact without corrupting
  the last valid snapshot.

Critical stories:

1. Open a program and assess certification readiness.
2. Explore evidence by lifecycle phase.
3. Follow an end-to-end trace and identify the first broken link.
4. Create, review, and disposition a finding.
5. Refresh evidence from authoritative sources while preserving the last valid
   snapshot on failure.
6. Create and download a deterministic audit package.

External actors:

- filesystem;
- Git repository;
- MATLAB/Simulink;
- spreadsheets;
- C/H source tree;
- coverage reports;
- review evidence;
- objective profile.

Important behavior:

- authoritative engineering artifacts remain read-only;
- unavailable MATLAB does not remove the last published evidence;
- rejected refreshes never replace the valid snapshot;
- package bytes are reproducible for the same snapshot and scope;
- provenance is visible at every evidence hop;
- sample evidence is visibly synthetic.

High-value clarification:

> Can a reviewer approve their own finding?

The answer materially changes authorization rules and the assurance workflow,
so it is worth asking. File formats and adapter naming are derived from
project evidence and do not need a user questionnaire.

### 10.3 Recommended solution map

**Experiences**

- Audit Experience
- Lifecycle Explorer

**Coordinators**

- Evidence Ingestion & Publication
- Assurance Workflow
- Audit Package Assembly

**Core knowledge**

- Evidence Graph
- Workspace Snapshots

**Connections**

- Filesystem Adapter
- Git Adapter
- MATLAB/Simulink Adapter
- Spreadsheet Adapter
- C Source Adapter
- Coverage Adapter
- Review Evidence Adapter
- Objective Profile Adapter

**Shared foundation**

- Evidence Store
- Job/Package Store

The proposal explains that the concrete connections are separate because their
external actors, extraction lifecycles, provenance, and failure behavior
differ. It may still group them under a single visual “Connections” lane
without collapsing their implementation boundaries.

### 10.4 Architecture option

Recommended: a modular monolith with an optional isolated MATLAB extractor
process. It satisfies local data access, deterministic persistence, and
single-user deployment while containing the proprietary process boundary. A
microservice topology is not proposed because the stories do not require
independent network deployment or scaling.

---

## 11. Migration and compatibility

### 11.1 Adopt an augment-first strategy

Do not hard-replace `ApplicationSpecification` in the first release.

1. Add `UseCaseAnalysis` persistence and validation.
2. Compile it into the existing application draft.
3. Keep existing import, approval, gate, and downstream behavior.
4. Record the analysis ID/revision/hash in application provenance.
5. Add richer architecture proposal rationale beside the existing
   architecture draft.
6. Move old structured Plan editing behind Design details.

Once real projects prove the analysis contract is stable, it can become the
canonical authoring source while `ApplicationSpecification` remains a stable
projection.

### 11.2 Existing workspace migration

For a project with an approved application but no analysis:

- create a derived analysis proposal;
- mark each item `sourced` from the application revision;
- synthesize shallow story flows only where deterministic;
- create non-blocking gaps for missing alternatives, recovery, and quality
  drivers;
- do not change current approval;
- let the user adopt the richer analysis when convenient.

No automatic migration invalidates an approved architecture.

### 11.3 Legacy interview path

Keep **Import structured response** in Design mode. Guided mode uses the same
adapter behind **Draft product story** and **Continue analysis**. This preserves
offline/manual provider workflows without exposing ceremony to most users.

### 11.4 Revision and staleness behavior

- analysis draft changes do not stale downstream records;
- approving a semantically unchanged compiled application is a no-op replay;
- approving a changed application runs impact analysis before commit;
- affected architecture and downstream targets become visibly stale;
- unaffected evidence remains current;
- user architecture decisions are replayed against the new proposal where
  valid.

---

## 12. Delivery plan

## Phase 0 — benchmark and vocabulary

Deliver:

- baseline telemetry events for the current Plan and Design workflow;
- terminology test for “Shape the product,” “Product story,” and “Solution
  map”;
- three representative fixtures: small CRUD-style app, medium Audit Hub, and
  integration-heavy existing repository;
- task scripts for human and machine clients.

Exit criteria:

- current clicks, questions, handoffs, elapsed active time, corrections, and
  blocked actions are reproducible;
- chosen Guided labels are understood without documentation.

## Phase 1 — contracts and pure compiler

Deliver:

- `UseCaseAnalysis` types and JSON schema;
- validation, canonical hashing, diff, provenance, and persistence;
- analysis gate;
- deterministic application compiler;
- migration projection from an existing application;
- impact calculation;
- core and schema tests.

Exit criteria:

- the same analysis produces the same application hash;
- every valid fixture compiles and passes the current product gate;
- invalid references, contradictions, and blocking uncertainty fail safely;
- existing applications and architecture records remain readable.

## Phase 2 — Guided Plan experience

Deliver:

- Describe, Check, and Approve views;
- source-selection and privacy summary;
- analysis job progress/cancel/retry;
- story, assumption, contradiction, and readiness cards;
- progressive Design details;
- explicit transactional approval;
- bridge and mock implementations.

Exit criteria:

- a new user creates an approved medium product story without opening raw JSON;
- input survives cancel, failure, and restart;
- the UI exposes one deterministic next action;
- keyboard, screen reader, zoom, reduced-motion, and responsive checks pass.

## Phase 3 — provider adapters

Deliver:

- structured analysis provider port;
- existing Copilot packet adapter;
- in-app agent adapter where available;
- deterministic offline/test adapter;
- bounded repository and approved-record context adapters;
- prompt/version registry and provider evidence.

Exit criteria:

- provider failure cannot replace the last valid proposal;
- malformed output is diagnosed and recoverable;
- source scope and revisions are visible;
- no chain-of-thought or secret content enters persisted analysis;
- identical retries are idempotent.

## Phase 4 — solution proposal and restructuring

Deliver:

- architecture derivation graph and rationale contract;
- option scorer;
- solution-map lanes and coverage inspector;
- merge, split, rename, retype, move, add, and remove actions;
- decision records and undo;
- extended architecture gate;
- architecture approval and existing foundation handoff.

Exit criteria:

- all critical stories trace through the recommended architecture;
- external actors have explicit ports/adapters or blocking decisions;
- every module has a justification;
- edits recalculate coverage and gates immediately;
- approved output validates as the current `ArchitectureSpecification`;
- foundation and module batch proposal work unchanged.

## Phase 5 — machine parity and automation

Deliver:

- machine operation catalog;
- idempotent execute handlers;
- CLI examples and JSON fixtures;
- legal-next-action results;
- analysis and architecture batch operations;
- workflow benchmark update.

Exit criteria:

- an agent can complete Plan and Design without renderer navigation;
- retries do not duplicate records;
- human approvals cannot be bypassed;
- GUI and machine operations produce equivalent canonical records.

## Phase 6 — downstream enrichment

Deliver:

- frontend brief uses detailed stories, failure/recovery, and acceptance
  observations;
- module proposals inherit analysis evidence and quality drivers;
- connection view is pre-seeded from external actors;
- verification planning derives scenario/acceptance coverage;
- change impact traverses analysis → application → architecture → module →
  connection → verification.

Exit criteria:

- implementation briefs contain no repeated manual product context;
- every critical story maps to verification evidence or a visible gap;
- a changed story identifies only affected downstream targets.

## Phase 7 — rollout and retirement

Deliver:

- feature flag and per-project opt-in;
- migration audit/report;
- feedback capture tied to analysis revision;
- rollback to legacy Plan authoring;
- documentation and examples;
- decision on deprecating direct structured Plan authoring in Guided mode.

Exit criteria:

- representative teams complete projects with lower effort and no approval or
  traceability regression;
- migration has no data loss;
- support can diagnose every analysis/provider state from durable evidence.

---

## 13. Verification strategy

### 13.1 Contract tests

- schema-valid and invalid analysis fixtures;
- stable IDs and canonical ordering;
- stable hashes;
- source/evidence reference integrity;
- state precedence: confirmed/overridden over inferred;
- compilation mapping for every field;
- transactional approval;
- legacy migration round trip.

### 13.2 Analysis tests

- happy path, alternatives, failures, and recovery extraction;
- critical story without proof;
- conflicting sources;
- optional versus blocking uncertainty;
- unavailable provider;
- malformed provider output;
- stale source hash;
- cancellation and retry;
- protected human decision replay.

### 13.3 Architecture tests

- experience/workflow/domain/connection/platform classification;
- no unjustified split;
- adapter per external actor/technology;
- operations have one owner;
- dependency direction;
- cycle detection;
- unserved critical story;
- orphan module;
- quality driver to deployable decision;
- merge/split impact;
- decision replay after re-analysis.

### 13.4 UI tests

- empty, analyzing, proposed, needs-input, ready, approval, stale, and failure
  states;
- Guided/Design parity over one model;
- technical-detail toggle;
- exception answering;
- architecture option comparison;
- keyboard restructuring alternative to drag/drop;
- undo and approval confirmation;
- preserved state after restart;
- 200% zoom and narrow desktop;
- screen-reader names and status announcements;
- non-color state cues and reduced motion.

### 13.5 End-to-end journeys

1. new project, minimal prompt, no context;
2. repository-assisted product story;
3. existing approved application adoption;
4. blocking contradiction and resolution;
5. Audit Hub analysis to modular-monolith proposal;
6. merge two proposed modules and approve;
7. split an external adapter and recalculate coverage;
8. approve changed intent and inspect impact-scoped staleness;
9. provider fails, retry succeeds without duplicate revision;
10. agent completes the same workflow through machine operations.

### 13.6 Evaluation with people

Use at least:

- product/domain expert with limited architecture experience;
- senior architect;
- frontend-focused engineer;
- integration/backend engineer;
- occasional user returning after a week;
- LLM agent client.

Measure task completion and comprehension, not preference alone.

---

## 14. Success measures

Targets for a medium-sized application:

| Measure | Target |
|---|---:|
| Manual structured fields before first proposal | 0 |
| Median user questions before product review | ≤ 5 |
| Median active time to approved product story | < 8 minutes |
| Median active time from product approval to architecture proposal | < 2 minutes |
| Median active review time for architecture | < 12 minutes |
| Critical stories traced in proposed architecture | 100% |
| Proposed modules with explicit justification | 100% |
| External actors with adapter decision | 100% |
| Context re-entry between Plan and Design | 0 |
| Accidental duplicate analysis/approval records | 0 |
| Users able to explain why a module exists | ≥ 90% |
| Users correctly distinguish proposed/approved/implemented | ≥ 95% |

Local-only telemetry should record action names, durations, outcomes, counts,
and revision IDs. It must not store prompts, source content, paths, or
proprietary names.

Useful qualitative questions:

- Did the tool ask anything you expected it to infer?
- Did it infer anything you did not feel able to check?
- Could you tell what needed your judgment?
- Could you explain the recommended architecture in product terms?
- Did restructuring feel reversible and safe?
- Did the next action remain obvious?

---

## 15. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Plausible but wrong analysis | provenance states, exception review, explicit approval, contradiction detection |
| Too few questions hides ambiguity | materiality rules, critical-story gate, “show assumptions” |
| Too many questions recreates the interview | ask only architecture/scope/safety-changing questions; batch them |
| Architecture theater | hard split tests, least-distributed default, workflow coverage, gate diagnostics |
| User cannot understand modules | human labels, rationale, story highlighting, guided lanes |
| Model overwrites human edits | durable decision records, locked items, conflict review |
| Provider lock-in | provider ports and canonical structured result |
| Sensitive context leakage | explicit source scope, bounded adapters, local descriptors, no chain-of-thought storage |
| Existing projects break | augment-first compiler, no implicit reapproval, migration audit |
| Approval becomes ceremonial | approval summary, impact preview, blockers separated from warnings |
| Confidence mistaken for correctness | state labels and evidence links; no unsupported precision in Guided mode |
| Large analysis becomes slow | async/cancellable jobs, incremental source hashing, partial result preservation |
| Drag/drop is inaccessible | every restructuring action has keyboard/menu equivalent |
| Architecture options overwhelm | one recommendation; alternatives only when materially distinct |

---

## 16. Deliberate non-goals

- generating production code during Plan or Design;
- replacing domain experts or formal safety/security analysis;
- storing model chain-of-thought;
- automatically approving product or architecture records;
- forcing every project into microservices or domain-driven-design vocabulary;
- creating one module per screen, noun, or use case;
- treating a high completeness score as evidence of correctness;
- replacing the existing Build, Connect, Verify, foundation, or completion
  contracts in the initial release;
- hiding technical detail from users who deliberately choose Design mode.

---

## 17. Definition of done

The overhaul is complete only when:

1. a human can begin with a plain-language outcome and reach an approved
   product story and architecture proposal with no required schema knowledge;
2. the analysis captures primary, alternative, failure, recovery, information,
   rules, external actors, quality drivers, acceptance, provenance, and
   uncertainty;
3. the compiled output is a valid, approved current
   `ApplicationSpecification`;
4. the architecture proposal is traceable to stories and produces a valid
   current `ArchitectureSpecification`;
5. users can restructure the proposal with immediate impact and gate feedback;
6. adapters remain actor/technology-specific and ports remain
   technology-neutral;
7. existing foundation, module batch, frontend brief, integration, connection,
   and verification paths consume the result;
8. Guided mode masks technical detail without creating alternate state;
9. Design mode exposes full records and evidence;
10. machine clients can perform the same legal operations idempotently;
11. existing projects migrate without data loss or implicit invalidation;
12. human testing demonstrates lower effort and correct understanding of
    proposed versus approved versus implemented maturity.

The core product bet is simple: **the tool should make users judge meaning,
not manufacture structure**. Structure is proposed automatically, explained
in context, and kept safely editable.
