# Vertical Slice 01 — Baseline

## Environment

- Host OS: macOS (darwin 24.6.0)
- Node/npm: project-local npm install in `target-app/`
- App path: `trials/vertical-slice-01/target-app/`
- Baseline date: 2026-07-03

## Install Result

```text
npm install
added 68 packages
found 0 vulnerabilities
```

Result: pass

## Typecheck Result

```text
npm run typecheck
tsc -b --pretty false
```

Result: pass

## Build Result

```text
npm run build
tsc -b && vite build
✓ built successfully
```

Result: pass

## Launch Result

```text
npm run preview -- --host 127.0.0.1 --port 4173
Local: http://127.0.0.1:4173/
```

Result: pass. Browser verification used system Chrome through Playwright against the preview server.

## Current Behavior

- Application under test: UI Overlay
- Baseline app title: Engineering UI Kit Trial
- Navigation items: Copilot Handoff, Recipes, Components, Projects, Settings
- Page title: Create Task Packet
- Workflow steps: Prepare Context, Create Task Packet, Run in Copilot, Apply Zip Overlay, Verify & Review
- Selected-project sample: `signal-analyzer-refresh` at
  `C:\work\signal-analyzer-refresh`
- Task sections: Goal, Scope, Constraints, Acceptance Criteria, References
- Edit opens a labeled textarea prefilled with sample content
- Save updates local React state
- Cancel restores the previous value
- Empty required sections show visible validation messages
- Preview opens an accessible dialog with Markdown-like packet content
- Escape and Close dismiss the dialog and return focus to Preview
- Export downloads `task-packet.md` in the browser with the five section headings
- No network or filesystem access occurs

Browser verification checklist:

- cancel restores value — pass
- save updates state — pass
- required-field validation — pass
- preview dialog content — pass
- escape dismisses and returns focus — pass
- close dismisses and returns focus — pass
- export downloads task-packet.md — pass

## Current Visual State

Plain system-font baseline with light/neutral surfaces, basic borders, and no
Engineering UI Kit dark-first tokens. Intentionally unpolished so later
transformation can be measured.

Screenshots:

- `baseline/01-initial.png`
- `baseline/02-after-save.png`
- `baseline/03-validation.png`
- `baseline/04-preview-dialog.png`

Exported packet sample:

- `baseline/task-packet-export.md`

## Protected Behavior

- Task-section Edit/Save/Cancel semantics
- Required-field validation messaging
- Preview dialog content derived from current packet values
- Escape/Close dismissal and focus return to Preview
- Browser-only export filename `task-packet.md`
- Five required section headings in export content
- No network requests or filesystem access
- Domain logic ownership in `src/taskPacket.ts`

## Expected Change Scope

Later Copilot transformation should normally change:

- `src/App.tsx`
- `src/styles.css`
- optional token entry stylesheet referenced by the app

`src/taskPacket.ts` remains protected unless a presentation-safe change is explicitly
authorized and does not alter domain behavior.

## Baseline Assets

```text
trials/vertical-slice-01/baseline/
  01-initial.png
  02-after-save.png
  03-validation.png
  04-preview-dialog.png
  task-packet-export.md
```
