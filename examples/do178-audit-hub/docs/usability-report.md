# Engineering UI Kit usability report

Date: 2026-07-23

Case study: creating the DO-178C Audit Hub with the Engineering UI Kit

## Executive assessment

This report evaluates the human experience of using the Engineering UI Kit,
not the usability of the resulting Audit Hub.

The Kit was valuable as a structured thinking and handoff system. It produced
durable product, architecture, module, deployable, and implementation
artifacts; encouraged bounded changes; and made a large engineering concept
more explicit than an ordinary prompt-and-code workflow.

The experience was nevertheless much more laborious and ambiguous than it
needed to be. The case study required **18 substantive passes through the
tool** before the work left the Kit:

- 15 Capabilities interview/design handoff exports;
- 1 Capabilities implementation handoff export;
- 1 initial Build/UI handoff; and
- 1 Build feedback iteration.

There is one additional empty Build run that stopped at `prepare-context`.
It created a run record but exported no packet, so it is not counted as an
iteration. The persisted total is therefore 19 run records and 18 substantive
tool passes.

Most importantly, the UI made approval progress look too much like
implementation progress. The Capabilities workflow finished with nine
approved module definitions and three approved deployable targets, but only
one module had even reached an implementation packet. That packet remained
at `packet-exported`; it was not returned, applied, or verified in the Kit.
The complete backend, adapters, persistence, and integration were finished
after leaving the tool.

The central product problem is therefore not visual polish. It is **truthful
workflow state and continuity**: a human must always be able to tell what has
been described, approved, exported, implemented, applied, verified, connected,
and completed—and what the next useful action is.

## Evidence and counting method

The count comes from the app-managed Engineering UI Kit workspace under:

```text
~/Library/Application Support/@engineering-ui-kit/desktop/workspace
```

For the Capabilities project `DO-178C Lifecycle Data Hub`, the persisted
history contains 16 exported capability runs:

| Passes | Kind | Outcome |
| --- | --- | --- |
| 1–2 | Initial product and architecture interviews | Exported |
| 3–4 | Revised product and architecture interviews | Exported |
| 5–13 | Module interviews | Exported |
| 14 | `mod.audit-experience` implementation handoff | Exported only |
| 15 | Architecture correction | Exported |
| 16 | `mod.audit-experience` re-interview | Exported |

Those 16 runs break down into 15 interview/design exports and one
implementation export. The interview/design exports comprise:

- 2 product-definition passes;
- 3 architecture passes; and
- 10 module passes for 9 modules, because `mod.audit-experience` was revisited
  after the architecture changed.

The Build workflow adds two substantive passes:

| Pass | Project | Outcome |
| --- | --- | --- |
| 17 | Initial UI handoff, “Build DO-178C Lifecycle Data Hub from spec” | Packet built; history stopped at `run-in-copilot` |
| 18 | Feedback iteration for preview/start compatibility | Overlay applied, checks run, approved |

An additional Build run was created later but contains no packet or work
beyond `prepare-context`. It is excluded from the substantive count.

This distinction matters. Counting every record gives 19; counting actual
exported or executed workflow cycles gives the more useful answer: **18**.

## What using the tool felt like

### 1. Project and workflow orientation

The same product appeared as two projects:

- `DO-178C Lifecycle Data Hub` for Capabilities; and
- `DO-178C Audit Hub (sample)` for the UI/Build result.

There was no strong visible parent/child relationship between them. A human
had to remember which project contained architecture, which contained the
frontend, and whether changes in one had reached the other.

Completed work was also hard to reopen. “Continue” could resume an unfinished
run, create a new run, or appear to open a result. In practice, opening the
completed project could lead to a blank Build form rather than the delivered
Test/preview result.

Human effect: the tool repeatedly consumed orientation effort before useful
work could resume.

### 2. Product definition

The draft-first product interview was much better than a field-by-field
questionnaire. It let the human react to a coherent proposal and correct the
important assumptions.

However, stored run metadata exposed context leakage and system instructions
as if they were domain ownership. One early run referenced
`app.gulfstream-performance-sample`; other records stored the entire interview
instruction as `targetOwnerId`. These are not merely untidy internals: they
make history difficult to trust and make it harder for a human to understand
what was actually interviewed.

The revised product definition required a second product pass, but the UI did
not present that as a clear lineage such as “revision 2 replaces revision 1
because…”.

Human effect: the interview itself was useful, while the surrounding state
made provenance feel less reliable than the generated document.

### 3. Architecture

Architecture took three interview exports and ultimately reached approved
revision 4. Revisiting architecture was appropriate, especially when the
external-adapter boundary needed correction. The problem was that iteration
was represented as separate packets rather than a single visible decision
history.

The design also used a broad `mod.external-adapters` module that could easily
be mistaken for one implementation adapter. The actual implementation needed
separate MATLAB/Simulink, filesystem, Git, spreadsheet, C/H, review, coverage,
objective-profile, persistence, sample, and package adapters. The Kit should
make the distinction between:

- a capability/module responsibility boundary;
- a technology-neutral outbound port; and
- a concrete adapter for one external actor.

Human effect: the architecture was expressible, but the UI did not make
refinement, replacement, or concrete implementation coverage easy to see.

### 4. Module definition

Nine modules were approved:

- audit experience;
- workspace snapshots;
- lifecycle explorer;
- evidence graph;
- assurance workflow;
- ingestion and publication;
- sample workspace;
- evidence store; and
- external adapters.

Defining them required ten module interview exports. Most were created within
minutes of one another and repeated the same export/handoff rhythm. The
one-module-at-a-time safety boundary is sound for implementation, but it is
too expensive for architecture-derived interviews when the same approved
application context and vocabulary apply to every module.

Several run records carried an input module revision of `unknown` even though
the workflow was creating or refining a named module. This weakens the user's
confidence in dependency freshness.

Human effect: the Kit turned the architecture into explicit modules, but the
interaction cost scaled almost linearly with module count.

### 5. From definition to implementation

This was the largest usability failure.

The Capabilities area showed a rich, approved architecture with nine modules
and three deployable targets. Only `mod.audit-experience` produced an
implementation handoff, and that run stopped at `packet-exported`. There was
no returned overlay, inspection, apply, or verification evidence for it.

The UI did not make the gap between “approved design” and “working
application” prominent enough. That ambiguity directly encouraged the
reasonable but incorrect conclusion that a backend and adapters already
existed.

Human effect: progress looked far more complete than the executable product
actually was.

### 6. Build/UI handoff

The initial Build packet was capable of carrying a large, detailed visual
specification and produced a convincing frontend. The bounded packet, standards
pack, and repository context are strong ideas.

The form also retained generic template material alongside the detailed goal.
The saved `scope` still began with `REPLACE:` and the constraints continued to
say “local React state only” and “no persistence or filesystem access.” Those
defaults conflicted with the broader product intent and later contributed to
the frontend-only result.

The tool should never export placeholder text or mutually inconsistent
sections without forcing a review.

Human effect: the high-quality goal dominated the output, but stale template
fields silently narrowed the implementation boundary.

### 7. Preview and verification

Preview startup had two avoidable failures:

- the expected preview port drifted between 4182 and 4183; and
- the generated package initially lacked the start command expected by the
  workbench.

The Test screen remained on “Starting the app” without quickly explaining the
probe, detected ports, missing script, or likely fix. A full feedback
iteration was used primarily to add preview compatibility.

Once the overlay was applied, typecheck and build results were tangible and
the verification page was useful. The run history, however, did not make it
easy to return to the completed result later.

Human effect: verification was credible after setup succeeded, but diagnosing
startup consumed an entire pass through the handoff loop.

### 8. Iteration and recovery

The feedback iteration did several things well:

- previous requirements remained attached;
- review feedback was promoted into the next task;
- returned files were inspected before application;
- verification results were persisted; and
- the final iteration could be explicitly approved.

The weak point was navigation continuity. Completed-result discovery, run
lineage, and the meaning of “Continue” were unclear. An empty later run was
easy to create and then looked like additional project progress even though it
contained no handoff.

Human effect: an individual iteration was safe, but managing a series of
iterations was not yet effortless.

## Usability scorecard

Scores reflect the human workflow in this case study, not feature breadth.

| Area | Score | Assessment |
| --- | ---: | --- |
| Initial orientation | 2/5 | Similar project names and split Capabilities/Build state |
| Product interview | 4/5 | Draft-first review was efficient and understandable |
| Architecture refinement | 3/5 | Expressive, but revision lineage was weak |
| Multi-module definition | 2/5 | Ten repetitive module passes |
| Handoff safety | 4/5 | Bounded packets and overlay inspection inspire confidence |
| Implementation truthfulness | 1/5 | Approved design looked too much like implemented capability |
| Preview diagnosis | 2/5 | Port/start failures were slow and opaque |
| Verification evidence | 4/5 | Applied iteration retained concrete check results |
| Completed-result discovery | 1/5 | No reliable “open the thing I just built” path |
| Iteration continuity | 2/5 | Safe per run, cumbersome across runs |
| Overall for this case | 2.5/5 | Strong underlying model; excessive ceremony and state ambiguity |

## Recommended improvements

### P0 — make state truthful

1. **Show one explicit maturity ladder everywhere.**

   ```text
   Defined → Approved → Packet exported → Result returned →
   Inspected → Applied → Verified → Connected → Complete
   ```

   Every project, module, adapter, binding, and deployable should show its
   actual position. Never summarize “approved” as though it means
   “implemented.”

2. **Separate design coverage from implementation coverage.** Show counts such
   as “9/9 modules defined, 1/9 implementation packets exported, 0/9 applied,
   0/9 verified.” Do the same for concrete adapters and deployables.

3. **Unify Capabilities and Build under one product project.** A UI handoff,
   module implementation, binding, preview, and verification run should be
   branches of one visible project history, not separate similarly named
   projects.

4. **Make completed results first-class.** Project cards need distinct
   **Open result**, **Resume active run**, **View history**, and **Start new
   iteration** actions. Do not overload “Continue.”

5. **Block contradictory or placeholder packets.** Refuse export when fields
   contain `REPLACE:`, unresolved template text, stale project identifiers, or
   constraints that contradict the goal. Present conflicts for human
   resolution.

6. **Make run lineage visible.** Every revision should say what it supersedes,
   why it was created, what changed, and whether downstream modules or UI
   packets are now stale.

### P1 — reduce the number of passes

1. **Batch architecture-derived module interviews.** Generate proposed drafts
   for all modules from the approved architecture, then let the user review
   common assumptions once and open only exceptional modules for deeper
   questioning.

2. **Create an implementation queue automatically.** After architecture
   approval, show all modules, adapters, bindings, and deployables in
   dependency order with one next action. The queue should make it obvious
   that exporting one module does not implement the application.

3. **Support multi-target handoffs when boundaries are independent.** Several
   small module specifications or actor-specific adapters can share one
   handoff while retaining separate allowed paths and verification results.

4. **Carry approved context without repeated export ceremony.** Reuse stable
   product and architecture context by hash; export only deltas and the target
   contract.

5. **Add a project consolidation action.** “Use this Capabilities architecture
   in Build” should create or link the UI project, transfer current revisions,
   and show which UI elements remain unbound.

6. **Treat abandoned drafts separately.** Empty drafts should be resumable or
   discardable, but should not inflate iteration counts or appear as product
   progress.

### P1 — make preview failures self-diagnosing

1. Preflight `package.json`, install state, start command, expected host, and
   port before entering Test.
2. Show every port probe and any detected listening port.
3. Offer **Use detected port** and **Add compatible start command** when the
   fix is mechanical.
4. Distinguish “app failed to start,” “app started elsewhere,” and “preview
   cannot connect.”
5. Preserve the last successful preview while a new iteration is being
   prepared.

### P2 — make the workflow more satisfying

1. **Use verified uncertainty reduction as progress.** Celebrate “all module
   contracts current,” “adapter returned and verified,” or “preview connected,”
   not the number of packets exported.

2. **Show a concise next-best-action card.** After every action, identify the
   single most useful next step and explain why it is unlocked.

3. **Provide a visual iteration timeline.** Let the user see the product brief,
   architecture revisions, module decisions, implementation returns, UI
   iterations, and verification results as one navigable story.

4. **Make repetitive approval fast but deliberate.** Keyboard review, diff
   summaries, approve-and-next, and batched confirmation can reduce friction
   without weakening control.

5. **End with a real completion moment.** Completion should mean all required
   executable paths are applied and verified. Show the runnable result, its
   capability coverage, outstanding limitations, and a direct **Open result**
   action.

## What should remain

The following parts of the Engineering UI Kit were genuinely valuable:

- draft-first product synthesis;
- explicit product/architecture/module artifacts;
- bounded allowed paths;
- deterministic handoff files;
- returned-overlay inspection;
- preserved verification results;
- feedback carried into a controlled iteration; and
- immutable approved revisions.

The recommended direction is not to remove those controls. It is to make them
feel like one continuous product-building workflow, reduce repetitive exports,
and make implementation truth impossible to misread.

## Bottom line

The DO-178C case needed **18 real tool passes** and still left the Kit with
only one implementation packet exported, not applied. The frontend handoff was
strong, but one of its two Build passes was spent fixing preview compatibility,
and the rest of the application was completed outside the Kit.

A mature version of this workflow should plausibly reduce the same case to:

1. one product-definition pass;
2. one architecture review;
3. one batched module review;
4. one or a few dependency-ordered implementation handoffs;
5. one UI composition handoff; and
6. one integrated verification/review pass.

That would preserve the Kit's safety and traceability while reducing the human
journey from 18 passes to roughly 6–8 meaningful passes.
