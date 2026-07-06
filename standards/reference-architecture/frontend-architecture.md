# Frontend Architecture

## Purpose

Define the frontend architecture rules for the vertical-slice trial and for later
Engineering UI Kit implementations that follow the same React/Vite/TypeScript
renderer model.

## Scope

This standard covers view, component, and module boundaries; React state ownership;
DOM and accessibility posture; TypeScript strictness; separation of task-packet
serialization from presentation; and future Electron renderer constraints.

It does not implement Electron, a reusable component library, or application
backends.

## Controlling Decisions

- The Phase 1 trial target is a disposable React/Vite/TypeScript browser app at
  `trials/vertical-slice-01/target-app/`.
- The selected screen is Create Task Packet on route `/` with no router dependency.
- Domain behavior for task sections, validation, preview, and export must remain
  reviewable and protected during later Copilot transformation.
- Engineering UI Kit v0.1 is dark-first for transformed output. The Phase 1 baseline
  remains deliberately plain so improvement can be measured.

## Required Architecture

### ARCH-FE-001 — View, component, and module boundaries

Keep presentation in view modules such as `App.tsx`. Keep serializable domain
behavior, sample data, validation, and Markdown export in dedicated modules such as
`taskPacket.ts`. Do not bury packet rules inside CSS or presentational markup.

### ARCH-FE-002 — React state ownership

Own interactive UI state in the nearest React view that needs it. For the trial,
`App.tsx` owns edit mode, draft values, dialog visibility, and status messages.
`taskPacket.ts` owns the packet shape and pure functions that derive validation and
export content.

### ARCH-FE-003 — DOM and accessibility posture

Use semantic HTML for shell, navigation, headings, lists, forms, status, and dialogs.
Interactive controls must be keyboard reachable, expose visible focus, and convey
status with text as well as color. Dialogs must support Escape and Close dismissal
and return focus to the invoking control where practical.

### ARCH-FE-004 — TypeScript strictness

Trial and future renderer code shall use TypeScript strict mode. Public packet and
validation types must be explicit. Avoid `any` for packet state, validation results,
or export helpers.

### ARCH-FE-005 — Serialization separated from presentation

Task-packet types, sample data, validation, and Markdown serialization shall live
outside visual components. Presentation may call those functions but must not redefine
section headings, required-field rules, or export filenames.

### ARCH-FE-006 — Future Electron renderer constraints

When an Electron shell is introduced later, renderer code remains a React/Vite UI.
Filesystem, process, and privileged operations must cross a typed boundary owned by
the main or preload layer. Do not import Node-only APIs into trial or renderer UI
modules during Phase 1.

### ARCH-FE-007 — No domain behavior in visual-only components

Visual components may render labels, layout, and controls. They must not invent
acceptance criteria, alter protected behavior, or silently change export content.

## Allowed Patterns

- Local React state for edit/draft/dialog/status concerns.
- Pure functions for validation and serialization.
- Plain CSS modules or a single stylesheet that later consumes semantic tokens.
- Small presentational helpers colocated with the view when they do not own domain
  rules.

## Prohibited Patterns

- Global state libraries for the trial app.
- Routers, component libraries, chart libraries, CSS frameworks, or test frameworks
  in the Phase 1 target app.
- Network requests or filesystem access from the trial UI.
- Embedding packet validation rules only in CSS or copy text.
- Implementing Electron, preload, IPC, or core-library packages in Phase 1.

## Trial Application

For `trials/vertical-slice-01/target-app/`:

- `src/taskPacket.ts` owns packet types, sample data, validation, and Markdown
  serialization/download helpers.
- `src/App.tsx` owns rendering and interaction state.
- `src/styles.css` owns the plain baseline presentation only.
- Protected behavior includes Edit/Save/Cancel, required-field validation, preview
  dialog dismissal, focus return, and browser-only `task-packet.md` export.

## Validation Checks

- Packet serialization and validation are importable without rendering React.
- Presentation files do not redefine section titles used by export.
- Typecheck and build succeed for the target app.
- Accessibility-critical interactions remain keyboard operable.

## Traceability

- Parent specs: roadmap Phase 1 minimum implementation contract and Cursor agent
  handoff.
- Standards: `foundation/accessibility.md`, `layouts-and-recipes/application-shell.md`,
  `layouts-and-recipes/workflow-pages.md`, `components/forms.md`,
  `components/overlays-and-dialogs.md`.
- Trial records: `trials/vertical-slice-01/target-selection.md`,
  `trials/vertical-slice-01/baseline.md`,
  `trials/vertical-slice-01/acceptance-criteria.md`.
