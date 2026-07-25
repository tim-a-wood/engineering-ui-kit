# Plan from use cases

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
- [`mockup.html`](./mockup.html) — an interactive mockup of planning, system
  design, selectable UML elements, controlled change impact, and scenario-test
  evidence.
- [`index.html`](./index.html) — a short visual summary.

Both HTML files are self-contained and can be opened directly in a browser.
The mockup shows the design. It is not working product code.

## Mobile links

- [Visual briefing](https://use-case-led-capabilities.tim-a-wood.chatgpt.site/briefing)
- [Interactive mockup](https://use-case-led-capabilities.tim-a-wood.chatgpt.site/mockup)
- [Full specification](https://use-case-led-capabilities.tim-a-wood.chatgpt.site/SPECIFICATION.md)
