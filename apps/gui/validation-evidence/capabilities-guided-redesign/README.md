# Capabilities Guided redesign validation

Validated 2026-07-22 against the packaged macOS arm64 application.

## Outcome

The Guided Plan, Design, Build, and Verify views now share one compact four-stage journey, a state-aware stage hero, a single dominant action in normal states, plain decision-oriented copy, and progressive disclosure for implementation detail. The canonical workflow remains Plan → Design → Build → Verify; no Connect stage or view-only workflow state was introduced.

The responsive shell, stage content, architecture/deployment diagrams, module workflow, shared setup, evidence, failure, stale, and repair states were reviewed at the required viewports. All automated visual assertions, focused accessibility checks, core/GUI/desktop/runtime/Python tests, and real packaged journeys passed.

## Required viewport matrix

Each image is a viewport capture rather than a full-page capture. The visual harness asserts that the document and main content do not overflow horizontally and that visible workflow content remains within the viewport.

| Stage | 1024 × 768 | 1440 × 900 | 1920 × 1080 |
|---|---|---|---|
| Plan | [screenshot](15-plan-1024x768.png) | [screenshot](15-plan-1440x900.png) | [screenshot](15-plan-1920x1080.png) |
| Design | [screenshot](15-design-1024x768.png) | [screenshot](15-design-1440x900.png) | [screenshot](15-design-1920x1080.png) |
| Build | [screenshot](15-build-1024x768.png) | [screenshot](15-build-1440x900.png) | [screenshot](15-build-1920x1080.png) |
| Verify | [screenshot](15-verify-1024x768.png) | [screenshot](15-verify-1440x900.png) | [screenshot](15-verify-1920x1080.png) |

The harness produced 31 screenshots in total, including empty, draft, approved, needs-attention, narrow, reflow, help, architecture, module, and completed-journey states. At 1440 × 900 each required capture presents the stage identity/status, principal task, and primary action or completion status in the initial viewport.

## Accessibility

- [Axe report](axe-report.json): zero violations and zero critical/serious violations on representative Plan, Design, Build, and Verify states.
- Axe marked color contrast as `incomplete`, not failing, because the dark shell uses gradients and computed color mixing. Manual WCAG calculations against canvas, panel, raised, and inset surfaces produced minimum ratios of 15.55:1 (primary text), 10.96:1 (secondary text), 6.34:1 (muted text), 6.97:1 (accent text), and 5.88:1 (semantic status text). All exceed the 4.5:1 normal-text requirement.
- Dialog behavioral tests prove named dialogs, initial focus, focus trapping, safe Escape, and focus restoration.
- The architecture diagram exposes one keyboard entry point with Arrow keys, Home, End, and Enter; stage and local-step navigation use native buttons and explicit current/locked semantics.
- Workflow order matches DOM/tab order. Focus remains visible, status is expressed with text/glyphs rather than color alone, and the stylesheet honors reduced motion.
- Focused behavioral result: `cap-ux-isolation.test.tsx` — 35/35 passed. The broader GUI and accessibility suites are included in the complete test result below.

## UI compliance rubric

| Criterion | Rating | Evidence | Corrective action |
|---|---|---|---|
| `VAL-UI-001` Source alignment | Pass | Canonical journey derives locks/completion from approved records and the current approved foundation; focused journey-state tests cover missing, stale, and current foundation data. | None. |
| `VAL-UI-002` Dark-first visual language | Pass | All viewport evidence uses the Engineering UI Kit dark surface hierarchy without light-dashboard drift. | None. |
| `VAL-UI-003` Token usage | Pass | Capabilities styling uses semantic/component aliases; the final stylesheet contains no raw hexadecimal colors. | None. |
| `VAL-UI-004` Component usage | Pass | Existing buttons, badges, panels, empty states, dialogs, and workflow patterns are reused. The reusable wide technical-dialog variant is documented and consumed. | None. |
| `VAL-UI-005` Layout composition | Pass | Shared shell and workflow recipe are used for the four stages; Build uses an explicit four-step local sequence and responsive single-column fallback. | None. |
| `VAL-UI-006` Engineering density | Pass | Primary decisions remain compact and readable while IDs, hashes, paths, versions, suite IDs, and raw runtime allocation move to technical overlays. | None. |
| `VAL-UI-007` Status and feedback clarity | Pass | Complete, current, locked, blocked, stale, failed, repair, and ready states identify both state and next action. | None. |
| `VAL-UI-008` Accessibility minimums | Pass | Zero axe violations, WCAG AA manual contrast check, native controls, named regions/dialogs, focus tests, keyboard diagram semantics, reduced motion, and non-color status cues. | None. |
| `VAL-UI-009` Content and labeling | Pass | Guided copy uses stable user-facing nouns and direct outcomes; technical terms remain available through labelled specification overlays. | None. |
| `VAL-UI-010` AI handoff suitability | Pass | The screenshots, explicit state model, viewport assertions, accessibility report, and behavioral tests make the intended hierarchy and interactions independently reproducible. | None. |

No rubric item is Warning or Blocker.

## Visual-drift checklist

| Area | Rating | Evidence |
|---|---|---|
| Dark-first posture and surface hierarchy | Pass | Canvas, panels, raised regions, insets, and overlays use the documented hierarchy. |
| Generic dashboard drift | Pass | Summaries remain tied to approvals, entry points, setup, evidence, and repair rather than decorative KPIs. |
| Token drift | Pass | No raw CSS hex colors; semantic and component aliases are used throughout. |
| Density | Pass | Compact at desktop sizes, readable at 1024 × 768, and reflowed without horizontal page scroll. |
| Surface hierarchy | Pass | Stage hero, command card, principal work, supporting detail, and technical overlays have distinct weights. |
| Accent and glow | Pass | Accent is reserved for active stage, focus, selection, and the dominant action; decorative neon treatment is absent. |
| Typography | Pass | Concise headings and plain Guided copy; code/IDs use technical overlays and mono treatment. |
| Tables and diagrams | Pass | Architecture/deployment diagrams are labelled, keyboard navigable, non-overlapping, and paired with details; no chart is used without an engineering question. |
| Mockup traceability | Pass | Required screenshots calibrate this feature only and do not claim wider company-standard authority. |

No visual-drift item is Warning or Blocker.

## Packaged end-to-end evidence

The test launches `release/mac-arm64/Engineering UI Kit.app`, confirms Electron reports `app.isPackaged=true`, drives rendered controls only, and fails on uncaught page errors or renderer `console.error`. Every final journey recorded `rendererErrors: []`.

| Path | Result | Evidence |
|---|---|---|
| TypeScript UI | Pass | [Build ready](../../../desktop/validation-evidence/capabilities-production/packaged/01-ui-build-ready.png), [real verification](../../../desktop/validation-evidence/capabilities-production/packaged/02-ui-real-verification.png), [rollback](../../../desktop/validation-evidence/capabilities-production/packaged/03-ui-rolled-back.png), [record](../../../desktop/validation-evidence/capabilities-production/packaged/typescript-ui.json) |
| Python headless schedule | Pass | [Build ready](../../../desktop/validation-evidence/capabilities-production/packaged/11-python-build-ready.png), [real verification](../../../desktop/validation-evidence/capabilities-production/packaged/12-python-real-verification.png), [record](../../../desktop/validation-evidence/capabilities-production/packaged/python-headless.json) |
| Mixed React/Python HTTP | Pass | [Build ready](../../../desktop/validation-evidence/capabilities-production/packaged/21-mixed-build-ready.png), [cross-language verification](../../../desktop/validation-evidence/capabilities-production/packaged/22-mixed-cross-language-verification.png), [record](../../../desktop/validation-evidence/capabilities-production/packaged/mixed-react-python.json) |
| Existing repository, additive apply, byte-identical rollback | Pass | [migration preview](../../../desktop/validation-evidence/capabilities-production/packaged/31-existing-migration-preview.png), [additive apply](../../../desktop/validation-evidence/capabilities-production/packaged/32-existing-additive-apply.png), [rollback](../../../desktop/validation-evidence/capabilities-production/packaged/33-existing-byte-identical-rollback.png), [record](../../../desktop/validation-evidence/capabilities-production/packaged/existing-repository.json) |
| Interrupted transaction, restart, recovery, retry | Pass | [restored](../../../desktop/validation-evidence/capabilities-production/packaged/41-mid-transaction-failure-restored.png), [restart state](../../../desktop/validation-evidence/capabilities-production/packaged/42-recoverable-state-after-restart.png), [retry](../../../desktop/validation-evidence/capabilities-production/packaged/43-retry-succeeded.png), [record](../../../desktop/validation-evidence/capabilities-production/packaged/failure-recovery.json) |

The clean-console gate exposed and fixed a packaged CSP issue by explicitly allowing the locally bundled `data:` fonts through `font-src`; the policy remains otherwise restrictive.

## Reproduction

```sh
npm run build
npm run visual:capabilities
npm test
npx vitest run apps/desktop/test
.venv/bin/python -m pytest runtimes/python
.venv/bin/python -m pytest examples/capabilities-python-reference
.venv/bin/python -m pytest examples/capabilities-react-python-reference
npm run test:capabilities:production-packaged --workspace @engineering-ui-kit/desktop
```

Results:

- Root workspace test matrix: 657 passed.
- Desktop: 71 passed, 1 skipped because a real MATLAB Engine is unavailable in this environment.
- Python 3.11 virtual environment: 151 passed across the runtime and two reference applications, with no warnings.
- Full workspace build: passed. Capabilities is lazy-loaded as a separate 228.68 kB chunk and the 493.29 kB main chunk is below Vite's advisory threshold.
- Visual harness: 31 screenshots, all overflow/off-canvas assertions passed.
- Packaged production journeys: 5/5 passed with zero renderer errors.

## Pass-with-notes

- The desktop test requiring a locally installed MATLAB Engine is skipped; adapter contract coverage remains green.
- Axe cannot compute contrast through the shell gradients/color mixing. Manual token-to-surface calculations above satisfy WCAG AA.

There are no unresolved Warnings or Blockers.
