# Vertical Slice 01 — Target Selection

## Decision

Use the disposable fallback React/Vite/TypeScript app committed at
`trials/vertical-slice-01/target-app/`.

No external repository is required.

## Repository and Path

- Repository: Engineering UI Kit monorepo
- Trial app path: `trials/vertical-slice-01/target-app/`
- Package name: `vertical-slice-01-target-app`
- Application under test: UI Overlay
- Package manager: npm
- Application type: disposable browser app
- Backend: none
- Persistence: none

## Why the Target Is Safe

- Disposable and trivially restorable from git.
- Contains no secrets or sensitive source material.
- Small enough for a human to review every changed file.
- Installs and builds without proprietary infrastructure.
- Provides typecheck and build commands.
- Uses local sample data only.

## Selected Screen

- Application: UI Overlay
- Selected project sample shown inside the application:
  `signal-analyzer-refresh` (`C:\work\signal-analyzer-refresh`)
- Screen: Create Task Packet
- Route: `/` only; no router dependency
- Regions: app shell/navigation, page header, workflow stepper, project summary,
  editable task sections, status/validation, preview, and export actions

## Baseline Commands

```bash
cd trials/vertical-slice-01/target-app
npm install
npm run typecheck
npm run build
npm run dev
```

Existing automated tests: none by design. Protected behavior is verified manually or
with an external browser script that is not part of the target-app dependencies.

## Protected Behavior

- Edit reveals a labeled textarea prefilled with the current section value.
- Save commits draft text to local React state.
- Cancel restores the previous value.
- Empty required sections produce visible validation messages.
- Preview opens an accessible dialog with packet content.
- Escape and Close dismiss the dialog and return focus to Preview where practical.
- Export downloads `task-packet.md` in the browser with the five section headings.
- No network requests or filesystem access occur.

## Primary Visual Reference

```text
project-sources/visual-references/1F2214C9-D849-41CA-9435-68F0A0032EEB.jpeg
```

- Page label: Create Task Packet
- View name: Copilot Handoff / Create Task Packet
- Status: approved
- Phase 1 baseline intentionally does not imitate this reference.

## Applicable Standard IDs

- `FND-VIS-001`
- `FND-TOK-001`
- `FND-A11Y-001`
- `LAY-SHELL-001`
- `RCP-WORKFLOW-001`
- `ARCH-FE-001` through `ARCH-FE-007`
- `ARCH-THEME-001` through `ARCH-THEME-007`
- `ARCH-STATE-001` through `ARCH-STATE-007`
- `ARCH-FILE-001` through `ARCH-FILE-006`

## Applicable Component IDs

- `CMP-SHELL-APP`
- `CMP-NAV-PRIMARY`
- `CMP-SHELL-PAGE-HEADER`
- `CMP-SURFACE-PANEL`
- `CMP-WORKFLOW-STEP-INDICATOR`
- `CMP-FORM-TEXTAREA`
- `CMP-FORM-FIELD`
- `CMP-OVERLAY-DIALOG`
- `CMP-FEEDBACK-VALIDATION-SUMMARY`
- `CMP-FEEDBACK-ALERT`

## Known Limitations

- Baseline styling is deliberately plain and not standards-compliant visually.
- Navigation items are presentational and do not route.
- Project Change control is out of scope for the baseline; project data is fixed sample data.
- The selected-project sample is not the application identity or the repository being
  visually transformed.
- No unit/e2e test framework is included in the target app.
- Copilot trial execution is deferred to a later roadmap phase.
