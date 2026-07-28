# Use-case-led behavior workflow

Engineering UI Kit now owns behavior at three explicit levels:

1. **Plan — Application workflows:** what the application does.
2. **Design — Solution allocation:** which modules perform each application
   action.
3. **Build — Module behavior:** how one module performs its allocated work.

Verify keeps the evidence chain from an approved use-case step through its
application workflow node, architecture allocation, refining module activity,
operation or event, and immutable observed evidence. Application scenario
status and module behavior status remain separate.

The diagrams are live projections of versioned records. The renderer does not
own or invent behavior. Use cases and application activities are in Plan;
module swimlanes and cross-module sequences are in Design; component, module
activity, state, and internal sequence diagrams are in Build.

> **Implementation status:** the specification in this folder is implemented
> in the product. The canonical records, rules, and operations live in
> `packages/core/src/capabilities/design/`; the desktop IPC, CLI, and machine
> API adapters in `apps/desktop/src/capabilities/designIpc.ts`,
> `packages/core/src/designCli.ts`, and `packages/core/src/designMachineApi.ts`;
> the Design workspace interface in `apps/gui/src/views/design/`; and the
> 17-module DO-178C Audit Hub sample in
> `packages/core/src/capabilities/design/sampleAuditHub.ts`. See
> [`IMPLEMENTATION-STATUS.md`](./IMPLEMENTATION-STATUS.md) for the
> requirement-by-requirement matrix and evidence.

This folder explains the use-case-led workflow for Engineering UI Kit
Capabilities.
The workflow creates use cases before it creates the system design. Verify then
runs every approved scenario as an automated end-to-end test and keeps
step-level screenshot or structured evidence. Design detail views provide UML
2.5.1 component, activity, state machine, sequence, and use-case diagrams.
Each UML element opens a modal for discussion, a proposed change, and impact
analysis. System structure and module design are separate approvals. The user
can design, approve, hand off, build, and verify one module at a time. External
Copilot handoffs target one module by default.

## Artifacts

- [`PROPOSAL.md`](./PROPOSAL.md) — the full design, data, delivery, and test
  plan.
- [`SPECIFICATION.md`](./SPECIFICATION.md) — the exhaustive product and
  implementation requirements, including module-by-module design, one-module
  Copilot handoffs, records, gates, recovery, migration, and tests.
- [`APP_INTEGRATION_GAP_ANALYSIS.md`](./APP_INTEGRATION_GAP_ANALYSIS.md) — the
  baseline gap matrix, completed integration mapping, verification criteria,
  and screenshots from the running application.
- [`BEHAVIOR_MODEL_IMPLEMENTATION_PLAN.md`](./BEHAVIOR_MODEL_IMPLEMENTATION_PLAN.md)
  — the implementation plan that separates application workflows, solution
  allocations, module behavior, and verification evidence.
- [`BEHAVIOR_MODEL_ADR.md`](./BEHAVIOR_MODEL_ADR.md) — the canonical ownership,
  trace-ID, approval, and compatibility decision for the behavior model.
- [`BEHAVIOR_MODEL_COMPLETION_AUDIT.md`](./BEHAVIOR_MODEL_COMPLETION_AUDIT.md)
  — the final requirement, lifecycle, visual, sample, and verification audit.
- [`mockup.html`](./mockup.html) — an interactive mockup of planning, system
  design, selectable UML elements, controlled change impact, and scenario-test
  evidence.
- [`index.html`](./index.html) — a short visual summary.

Both HTML files are self-contained and can be opened directly in a browser.
The mockup is the original design reference. It is not working product code.
The integrated workflow is in `packages/core`, `apps/desktop`, and `apps/gui`.

## Production workflow evidence

These captures come from one automated walk through the running DO-178C Audit
Hub sample. The walk selects the real sample records, opens each behavior
level, checks a cross-module allocation, reviews scenario results, and opens
the immutable evidence trace.

- [Plan — use cases](./screenshots/behavior-model-final/01-plan-use-cases.png)
- [Plan — application activity](./screenshots/behavior-model-final/02-application-activity.png)
- [Plan — application use cases](./screenshots/behavior-model-final/03-application-use-case.png)
- [Design — solution allocation](./screenshots/behavior-model-final/04-solution-allocation.png)
- [Design — cross-module sequence](./screenshots/behavior-model-final/05-cross-module-sequence.png)
- [Design — system structure](./screenshots/behavior-model-final/06-system-structure.png)
- [Build — component](./screenshots/behavior-model-final/07-module-component.png)
- [Build — module activity](./screenshots/behavior-model-final/08-module-activity.png)
- [Build — state machine](./screenshots/behavior-model-final/09-module-state-machine.png)
- [Build — internal sequence](./screenshots/behavior-model-final/10-module-sequence.png)
- [Verify — scenario testing](./screenshots/behavior-model-final/11-scenario-testing.png)
- [Evidence — immutable trace](./screenshots/behavior-model-final/12-evidence-trace.png)

Run the same production walk with:

```sh
npm run visual:behavior
```

## Mobile links

- [Visual briefing](https://use-case-led-capabilities.tim-a-wood.chatgpt.site/briefing)
- [Interactive mockup](https://use-case-led-capabilities.tim-a-wood.chatgpt.site/mockup)
- [Full specification](https://use-case-led-capabilities.tim-a-wood.chatgpt.site/SPECIFICATION.md)
