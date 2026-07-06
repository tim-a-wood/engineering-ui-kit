# State and Data Flow

## Purpose

Define state ownership and data-flow rules for the vertical-slice trial and for later
renderer implementations that preserve domain behavior under AI-assisted changes.

## Scope

This standard covers local UI state, serializable task-packet state, derived
validation state, immutable update expectations, the prohibition on global state
libraries for the trial, future typed IPC boundaries, and error or stale-state
ownership.

It does not define backend persistence models or product-specific APIs.

## Controlling Decisions

- The trial app has no backend and no persistence.
- Task-packet content is local React state initialized from sample data.
- Validation is derived from current packet values.
- Future Electron backends must cross a typed boundary; the trial must not invent one.

## Required Architecture

### ARCH-STATE-001 — Local UI state

Transient interaction state such as edit mode, draft text, dialog open/closed, and
status messages belongs in local React state owned by the view.

### ARCH-STATE-002 — Serializable task-packet state

Task-packet section values must be plain serializable data. The trial packet contains
string fields for Goal, Scope, Constraints, Acceptance Criteria, and References.

### ARCH-STATE-003 — Derived validation state

Validation results are derived from current packet values through pure functions.
Do not store a separate mutable “isValid” flag that can drift from the packet.

### ARCH-STATE-004 — Immutable update expectations

Updates replace packet fields immutably. Save commits the draft into packet state.
Cancel discards the draft and restores the previous committed value.

### ARCH-STATE-005 — No global state library for the trial

Do not introduce Redux, Zustand, MobX, Recoil, or similar libraries in the Phase 1
target app. Local React state is sufficient.

### ARCH-STATE-006 — Future backend data crosses a typed IPC boundary

When privileged or remote data is introduced later, it must enter the renderer through
an explicit typed contract. Renderer code must not reach directly into OS filesystem
or process APIs.

### ARCH-STATE-007 — Error and stale-state ownership

The view owns user-visible status and validation messages. Serialization helpers may
return data or throw only for programming errors. Do not silently swallow validation
failures.

## Allowed Patterns

- `useState` for packet, draft, dialog, and status.
- Pure `validateTaskPacket` and `serializeTaskPacketMarkdown` helpers.
- Status messages that restate validation errors in text.
- Browser-only download via `Blob` and object URLs.

## Prohibited Patterns

- Persisting packet data to disk or network in Phase 1.
- Global stores or context providers that hide packet ownership.
- Mutating packet objects in place.
- Treating export success as proof of standards compliance.
- Inventing backend synchronization for the disposable trial.

## Trial Application

- Initial packet comes from `SAMPLE_TASK_PACKET`.
- Edit copies the current value into draft state.
- Save writes draft back to packet state.
- Cancel restores the previous packet value.
- Preview and Export both require validation to pass.
- Export downloads `task-packet.md` entirely in the browser.

## Validation Checks

- Empty required sections produce visible validation messages.
- Cancel does not retain draft text.
- Export content matches current packet values and required headings.
- No network or filesystem APIs are used by trial modules.

## Traceability

- Frontend architecture: `ARCH-FE-002`, `ARCH-FE-005`.
- Interaction model: `FND-INT-*`.
- Forms and feedback: `components/forms.md`, `components/feedback-and-status.md`.
- Protected behavior: `trials/vertical-slice-01/baseline.md`.
