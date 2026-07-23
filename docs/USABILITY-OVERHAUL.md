# Engineering UI Kit usability overhaul

## Outcome

This release turns the Engineering UI Kit from two partially overlapping
workflows into one evidence-backed product-development system. A human can move
from project intent to capability implementation or frontend construction
without repeatedly re-entering context. An LLM can perform the same legal
operations through a stable, versioned JSON interface without navigating the
renderer.

The overhaul is deliberately about usability of the **Engineering UI Kit
itself**, not the usability of the sample applications built with it.

## Problems addressed

The prior workflow made a user infer too much:

- capability definition and frontend handoff history appeared in different
  places and used different lifecycle vocabulary;
- the next legal action was not obvious from a project entry point;
- architecture modules were proposed, reviewed, and handed off one at a time;
- frontend task packets required users or agents to restate approved product,
  module, operation, and binding truth;
- task packet problems surfaced late, after an export or handoff;
- “complete” did not show a durable evidence chain;
- automation had to imitate GUI navigation and could accidentally repeat
  mutations;
- there was no privacy-safe way to measure whether workflow changes actually
  saved effort.

## Canonical work model

All capability and frontend work now projects into one lifecycle:

`draft → proposed → approved → exported → returned → inspected → applied → verified → integrated → complete`

Condition and outcome are separate from maturity. A record can therefore be
`approved` but `stale`, or `verified` with an `attention` outcome, without
inventing contradictory statuses. Unknown legacy values are preserved and
reported as `legacy-unknown` instead of being silently promoted.

The Project Overview derives, rather than guesses:

- approval and executable coverage by product dimension;
- a unified capability/frontend history;
- blocking legacy diagnostics;
- one deterministic next-best action with prerequisites and affected targets;
- a direct route to the latest runnable result;
- local workflow-efficiency measurements when observations exist.

Empty frontend drafts are excluded from substantive progress.

## Faster human workflows

### Define and implement capabilities

1. Open the project and follow **Next best action**.
2. Approve the product definition and architecture at their explicit gates.
3. Select **Generate all module proposals** to create only missing proposals.
4. Review the batch as a table, including dependencies, risks, and gate
   diagnostics.
5. Explicitly approve the selected modules.
6. Plan dependency-safe implementation waves.
7. Export a wave handoff. The wave has one shared context, while each target
   retains its own run ID, ZIP name, scope, and evidence trail.
8. Return, inspect, apply, verify, and complete each result.

Existing module records are never silently replaced. An approved consumer is
not scheduled before an unapproved dependency.

### Build the frontend

1. Select the intended approved experience modules.
2. Compile an editable frontend brief from approved application,
   architecture, module, operation, and binding records.
3. Review coverage and blocking gaps in the dialog.
4. Edit the generated task fields where human judgment is useful.
5. Open Build with the compiled fields already populated.
6. Run packet lint and preview before export.
7. Return, inspect, apply, verify, and complete the result.

The compiler identifies which approved records were used, which requested
targets were covered, and which gaps prevent a trustworthy build.

### Complete a run

Approval requires at least one verification result and every result must pass.
Completion writes:

- `completion-summary.json`;
- `completion-timeline.json`;
- `completion-record.json`.

The Test view shows the timeline and evidence count immediately, and reloads it
when a completed run is revisited.

## Faster LLM and automation workflow

The machine API is version `1.0`. Discover operations with:

```bash
node packages/core/dist/cli.js machine describe
```

Execute a request with:

```bash
node packages/core/dist/cli.js machine execute request.json \
  --data /path/to/workspace \
  --out result.json
```

Available operations:

| Operation | Mutates | Explicit approval |
|---|---:|---:|
| `project.overview.get` | No | No |
| `modules.batch.propose` | Yes | No |
| `modules.batch.approve` | Yes | Yes |
| `implementation.waves.plan` | No | No |
| `implementation.brief.compile` | No | No |
| `frontend.brief.compile` | No | No |
| `frontend.build.create` | Yes | Yes |
| `packet.lint` | No | No |

Every request declares `apiVersion`, `requestId`, `operation`, and `input`.
Mutations require an `idempotencyKey`; approval operations also require
`input.explicit=true`.

Every result has a stable envelope containing:

- `status`: `succeeded`, `blocked`, or `failed`;
- `replayed`, so a safe retry is visible;
- a canonical `resultHash`;
- structured diagnostics;
- affected targets and produced records;
- artifact references;
- legal next operations.

Reusing a key with the same input replays the persisted result. Reusing it with
different input fails with an idempotency conflict. This makes network or agent
retries safe without weakening human approval gates.

Example mutation request:

```json
{
  "apiVersion": "1.0",
  "requestId": "approve-audit-modules-01",
  "operation": "modules.batch.approve",
  "idempotencyKey": "audit-hub/module-approval/v1",
  "input": {
    "projectId": "audit-hub",
    "moduleIds": ["mod.evidence", "mod.traceability"],
    "explicit": true
  }
}
```

## Early diagnostics

Packet lint catches missing sections, unresolved placeholders, conflicting
scope, and incomplete handoff detail before export. Preview preflight separates
configuration, dependency, package-script, port, and reachability problems and
offers targeted repairs instead of a generic launch failure.

## Measurement and privacy

Operational telemetry is local-only JSONL stored under:

`telemetry/workflow-events.jsonl`

It records action name, outcome, timestamps, duration, project/run identifiers,
and numeric counts. It does **not** store prompt text, source paths, source
content, or user-entered content.

The Project Overview reports observed runs, completions, exported handoffs,
blocked/failed actions, and median action duration. Telemetry begins with this
release; it does not invent or reconstruct historical usage.

## Structural benchmark

The benchmark compares interaction structure, not speculative elapsed minutes.
It can be reproduced with:

```bash
node packages/core/dist/cli.js benchmark workflow \
  --name "DO-178C audit hub" \
  --modules 8 \
  --waves 3 \
  --experience 2 \
  --bindings 10
```

For that medium-sized scenario:

| Measure | Per-record baseline | Batched/compiled workflow | Reduction |
|---|---:|---:|---:|
| Human review passes | 21 | 8 | 62% |
| LLM handoffs | 20 | 7 | 65% |
| Navigation transitions | 52 | 11 | 79% |
| Repeated context entries | 28 | 0 | 100% |

These are deterministic counts from the declared scenario. Observed time and
error-rate improvements should be evaluated using the local telemetry after
representative projects have been run.

## Migration safety

Existing workspaces are read through the canonical projection. Before changing
a workspace, run the read-only audit:

```bash
node packages/core/dist/cli.js migration audit \
  --data /path/to/workspace \
  --out migration-audit.json
```

The report identifies unsupported schemas, available migrations, legacy
frontend bindings, unknown lifecycle values, ambiguity, and any assessed
data-loss risk. The audit never initializes, migrates, or rewrites a project.

## Usability evaluation checklist

For each representative project, assess the Engineering UI Kit itself:

1. Can the user identify the next legal action without documentation?
2. Does every approval show exactly what will change?
3. Can several related modules be reviewed without losing target identity?
4. Does compiled context eliminate manual re-entry without hiding gaps?
5. Are configuration problems diagnosed before an expensive handoff?
6. Can a user resume after restart without reconstructing state?
7. Can an LLM discover and execute the same workflow without screen scraping?
8. Can a retry occur without duplicate records?
9. Does completion prove what was built, applied, checked, and approved?
10. Do measured events show fewer blocked actions and shorter active action
    duration over time?

## Remaining validation

The structural benchmark is a design comparison, not a user study. The next
evidence step is to run the same medium-sized project with representative
engineers and agent clients, then compare task completion, blocked actions,
median action duration, and rework while preserving the local-only privacy
boundary.
