# Human usability report

Date: 2026-07-23

Product: DO-178C Audit Hub

Scope: Engineering UI Kit handoff plus the completed sample and connected-project Audit Hub journeys

## Executive assessment

The product now feels like a coherent audit application rather than a polished
frontend demonstration. A new user lands in a credible sample instead of an
empty configuration screen; a project administrator can publish real
filesystem evidence; an auditor can move through every lifecycle phase,
inspect a focused requirement-to-result chain, review provenance, record
assurance decisions, and download a deterministic package.

The strongest experience is the combination of:

- an immediate, detailed sample with an unmistakable synthetic watermark;
- stable phase-oriented navigation;
- the representative end-to-end evidence chain;
- explicit read-only boundaries around engineering sources;
- explainable finding transitions; and
- a concrete package result with counts, identity, hash, and download.

The highest-value next improvements are a native folder picker and source
preflight, a personal “next best audit action” queue, better completed-result
discovery in Engineering UI Kit, and richer source-opening/deep-link support.

## Evaluation method

Usability observations were recorded only from visible human workflows:
labels, navigation, information hierarchy, response states, error recovery,
layout, task continuity, confidence, and perceived effort. Architecture and
automated-test results were used to verify corrections, but were not treated
as evidence that a screen was easy to use.

The exercised journeys were:

1. reopen the Engineering UI Kit project and find the delivered result;
2. launch Audit Hub with no configured project;
3. scan the sample overview and identify the most useful next action;
4. move through all eight lifecycle phases and their tailored subviews;
5. search for `SYS-LAT-014` and inspect its evidence dossier and trace;
6. compare retained baselines;
7. inspect the twelve seeded findings and the closure-ready workflow;
8. build, download, and reset a full synthetic package;
9. connect the realistic filesystem fixture with an objective profile;
10. inspect imported requirements, C/H, verification, coverage, review, CM,
    QA, and certification evidence;
11. verify the five reusable connected-project subviews in every phase; and
12. build a real-project package and inspect its exact manifest result.

The interface was also visually inspected at wide and common laptop widths.

## Verified journeys and human outcomes

### No-project first launch

The sample opens automatically with 508 evidence records, 45 reviews, twelve
findings, two baselines, and the known eight-record chain. The user sees useful
work immediately. “Sample Data,” the watermark, and “Connect real project”
keep the context honest without blocking exploration.

Human outcome: a first useful insight is available in seconds, with no setup
tax and no risk of confusing synthetic data with certification evidence.

### Lifecycle exploration

The navigation vocabulary matches the lifecycle: Planning, Requirements,
Design, Implementation, Verification, Configuration Management, Quality
Assurance, and Certification. The sample gives each phase tailored subviews;
connected projects use the consistent Evidence, Traceability, Reviews,
Findings, and Sources & Diagnostics anatomy.

Human outcome: the user can predict where evidence belongs while retaining
phase-specific depth.

### Search, dossier, and trace

Global search resolves an exact ID quickly and supports phase, type, status,
review, finding, and staleness facets. The dossier keeps overview, trace,
provenance, reviews, findings, and baseline history together. Trace now opens
with the representative path rather than a wall of transitive branches, with
the full bounded impact graph one deliberate action away.

Human outcome: the canonical requirement-to-result chain can be understood
without first learning a graph tool or filtering dozens of incidental edges.

### Findings and reviews

Finding state is visible in both phase context and the register. The
closure-ready example makes the workflow legible and states its gates:
reverification evidence and an independent verifier. Invalid transitions are
blocked by the application, and accepted actions append history. Reviews
preserve subject, revision, method, result, comments, and independence.

Human outcome: blocked work explains the next action, and completed work
produces a visible, attributable progression.

### Connected project

The connection dialog states the read-only contract before asking for data.
The realistic fixture published twelve evidence records, including a
program-owned certification objective, a seven-record system-to-objective
chain, two phase-correct imported reviews, C/H functions, coverage, CM, and QA
evidence. Diagnostics are accessible from the lifecycle context.

Human outcome: the transition from sample to real data is now credible; no
AeroNav narrative, fixed sample baseline, or synthetic badge leaks into the
connected workspace.

### Packages and reset

The builder selects the full lifecycle by default and previews evidence,
finding, and review counts. The completed sample package reports 508 evidence,
twelve findings, and 45 reviews; the connected package reports twelve
evidence and two reviews. Both expose a stable package ID, SHA-256 hash,
manifest entry count, path, and direct ZIP download. Sample exports remain
watermarked. Reset clears sandbox records and generated sample archives while
preserving authoritative fixture data.

Human outcome: the workflow has a strong finish—the user receives a tangible,
verifiable artifact rather than an abstract success toast.

## Improvements made during evaluation

| Human friction observed | Product correction |
| --- | --- |
| A live project still looked like AeroNav | Connected-project projections and baselines now come entirely from the selected snapshot |
| Sample data flashed while selecting a real workspace | Main content and all sample-derived header controls now use a neutral loading state |
| Adapter “Available” implied installed MATLAB/licensing | The connection table now says “Supported”; runtime failures remain explicit |
| DO-331 and objective-profile inputs looked cosmetic | Both now affect stored configuration and published evidence |
| Review records appeared in the phase of their source file | Review phase is derived from the reviewed canonical subject |
| Review date could silently use an old sample date | It defaults to the current human date and remains editable |
| Source refresh showed “0” for a review adapter that produced reviews | Counts now include the adapter’s normalized assurance outputs |
| Trace opened with dozens of transitive nodes | It now leads with a representative path or direct neighbors and progressively reveals the full graph |
| Findings rail hid review/trace/action columns | The rail stacks below the explorer below 1800 px; wide tables retain a visible scrollbar |
| Package builder started with a risky narrow scope | All lifecycle phases are selected by default |
| Builder promised 45 reviews but exported 40 | Phase scope now travels through the API and manifest; displayed and exported counts agree |
| Package result gave only an absolute path | A validated Download ZIP action is now adjacent to the hash |
| Package timestamps differed by screen | The manifest timestamp is canonical throughout the UI |
| Sample reset left generated archives on disk | Reset removes validated generated package files and records |
| Production sample menu exposed developer controls | State-demo controls are development-only |
| Header controls compressed the product name | Product identity keeps priority; controls wrap as a group at laptop width |

## Prioritized recommendations

### P1 — remove recurring setup and orientation costs

1. **Native folder and file pickers.** Keep pasteable absolute paths for expert
   use, but make the primary path a controlled folder picker and an
   objective-profile file picker. Show recent roots and verify read access
   before publication.

2. **Connection preflight.** Before the expensive refresh, show one card per
   concrete actor-specific adapter: discovered artifacts, actual local
   readiness, MATLAB/tool version, license availability, sidecar coverage,
   parser version, and whether a failure would block publication. “Supported”
   and “ready here” should remain distinct concepts.

3. **A guided audit queue.** Add a home panel that ranks a small number of
   explainable next actions—for example, an overdue high finding, an
   unreviewed changed LLR, a broken trace, and a package ready to rebuild.
   Let the user dismiss, snooze, assign, or complete each item.

4. **Completed-result discovery in Engineering UI Kit.** Completed projects
   need explicit **Open result**, **Open source**, and **Start another
   handoff** actions. “Continue” should be reserved for an unfinished run.

5. **Capability coverage in Engineering UI Kit.** Show UI, contracts, domain
   operations, persistence, concrete adapters, and end-to-end verification as
   separate coverage states. A polished preview should not imply that all
   integrations exist.

6. **Projection/version awareness.** When a stored snapshot predates a graph
   or schema projection, show “Refresh recommended” with the specific new
   capability. Do not let a stale projection look like absent source
   traceability.

### P2 — make frequent expert work faster

1. **Saved views and recents.** Preserve phase, subview, filters, selected
   baseline, and recent dossiers per workspace. Offer named views such as
   “changed LLRs awaiting independent review.”

2. **Command palette and keyboard routes.** Let expert users jump to an ID,
   phase, finding, review, package, or recent item without moving through
   navigation and dialogs.

3. **Controlled source deep links.** Where company policy permits, open a
   source in MATLAB/Simulink, the requirements tool, repository browser, or
   file viewer at the controlled revision. Keep the current copyable path as
   the safe fallback.

4. **Graph controls after progressive disclosure.** The full impact graph
   should offer depth, lifecycle, relationship-type, status, and changed-only
   filters, plus a “return to representative path” anchor.

5. **Package templates and verification.** Save named phase scopes, show
   exclusions before assembly, offer “copy hash,” and provide a one-click
   local verification result after download.

6. **Bulk assurance actions with safe previews.** Permit assigning or adding
   selected records to a package in bulk, but preview independence,
   revision, and unresolved-link consequences before writing the hub-local
   overlay.

### P3 — make serious work more enjoyable

1. **Professional completion moments.** When a finding closes or a package is
   verified, use a short restrained animation, a crisp completion sound only
   when enabled, and a useful next action. Avoid confetti or language that
   implies regulatory approval.

2. **Visible progress that reflects real evidence.** Show small milestone
   cards such as “all changed LLRs reviewed” or “canonical chain complete.”
   Progress must derive from evidence and assurance gates, never from clicks,
   time spent, or arbitrary streaks.

3. **Turn uncertainty into small wins.** Replace a large readiness percentage
   alone with the top few causes and the estimated number of human actions to
   improve it. Each resolved cause should disappear immediately from the
   queue.

4. **Personal momentum without compliance gamification.** Remember the last
   task, show recently resolved items, and offer “continue where I left off.”
   Do not award points for closing findings or encourage speed over
   independence and evidence quality.

5. **User-controlled information density.** Add comfortable, standard, and
   compact table modes. Dense engineering data is valuable, but humans should
   choose when density helps.

## Design principle for “dopamine”

The safest source of satisfaction in an assurance product is reduced
uncertainty:

```text
clear next action → fast evidence context → explainable gate →
visible verified result → easy continuation
```

The product should celebrate verified closure, trace completeness, and
reproducible delivery—not raw activity. This makes the workflow faster and
more enjoyable without weakening the seriousness of DO-178C/DO-331 work.

## Remaining environment limitation

This environment has no licensed MATLAB executable. Normalized MATLAB
sidecars, successful external-process invocation, authoritative artifact
normalization, timeout/missing-executable behavior, and failure isolation are
verified. Execution of `extract_audit_hub.m` against real licensed
SLREQX/SLMX/SLX/SLDD/SLDATX files still requires validation in a compatible
MathWorks installation and should be an explicit release qualification step.
