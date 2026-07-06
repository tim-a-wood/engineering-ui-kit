# Vertical Slice 01 — Acceptance Criteria

These criteria describe the later transformed result after the Copilot trial. They are
not expected to pass against the intentionally plain Phase 1 baseline.

| ID | Criterion | Evidence Method | Blocking |
|---|---|---|---|
| TRIAL-AC-001 | Target app typechecks and builds successfully after overlay application. | `npm run typecheck` and `npm run build` logs | yes |
| TRIAL-AC-002 | App launches and renders Create Task Packet at `/` without runtime errors. | `npm run dev` or `npm run preview` plus browser observation | yes |
| TRIAL-AC-003 | Protected behavior is preserved: Edit/Save/Cancel, required-field validation, preview content, Escape/Close dismissal, focus return to Preview, and browser export of `task-packet.md` with the five section headings. | Manual interaction checklist | yes |
| TRIAL-AC-004 | Changed files stay within expected scope (`src/App.tsx`, `src/styles.css`, and optional token entry stylesheet). | Overlay listing and diff review | yes |
| TRIAL-AC-005 | Transformed UI uses a dark-first shell and clear visual hierarchy aligned to the engineering workbench direction. | Screenshot comparison to primary visual reference and `FND-VIS-001` | yes |
| TRIAL-AC-006 | Workflow stepper remains present with the five named steps and a clear current-step state. | Browser observation and screenshot | yes |
| TRIAL-AC-007 | Task sections remain usable: each section can be edited through a labeled control and saved or cancelled. | Manual interaction checklist | yes |
| TRIAL-AC-008 | Preview and export behavior continue to reflect current packet values and required headings. | Preview dialog inspection and exported `task-packet.md` contents | yes |
| TRIAL-AC-009 | Presentation consumes semantic tokens through CSS custom properties rather than scattered raw colors. | Stylesheet review against `tokens.json` / `ARCH-THEME-*` | yes |
| TRIAL-AC-010 | Keyboard and dialog behavior remain accessible: controls are reachable, dialog supports Escape/Close, and focus returns to Preview where practical. | Keyboard-only walkthrough | yes |
| TRIAL-AC-011 | Visible focus indicators are present on interactive controls. | Keyboard focus observation | yes |
| TRIAL-AC-012 | Status and validation are not conveyed by color alone; textual status or labels remain present. | Browser observation of validation and status regions | yes |
| TRIAL-AC-013 | Result does not drift into generic SaaS white-card styling, neon/glow decoration, light mode, or unrelated feature scope. | Visual drift checklist and diff review | yes |

## Notes

- Baseline evidence for protected behavior is recorded in `baseline.md`.
- Criteria IDs are stable for measurement tables and review prompts.
- A failed blocking criterion prevents a useful-trial claim.
