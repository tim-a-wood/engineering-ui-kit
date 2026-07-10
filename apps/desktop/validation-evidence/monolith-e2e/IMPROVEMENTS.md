# Monolith E2E experiment — improvement log

Running log of workflow, process, and UI/UX findings from repeated
requirements-to-monolith passes (target: `examples/gauge-lab`, method:
*Create a monolithic web app* template). Each pass drives the real Electron
workbench end to end via `apps/desktop/e2e/`; screenshots per pass live in
`pass-N/`. Findings are numbered once and referenced across passes.

## Pass 1 — 2026-07-09

Result: **workflow completed end to end**; sample saturated after 4 overlay
iterations (initial build → typecheck fix → wrap/deep-link polish → KPI/list
consistency). 15/15 sample interaction checks pass; handoff approved. The
five-step flow, the warning-acceptance gate, feedback capture, evidence
capture, and the review packet all worked against a real repo.

### Findings

| # | Severity | Area | Finding |
|---|---|---|---|
| F1 | High | Projects / evidence | The **Launch & evidence dialog has no launch-command field**, although `Project.launchCommand` exists, `Launch App` and evidence capture both use it, and the built-in sample gets one seeded programmatically. User-created projects can only capture evidence if they start the dev server by hand outside the app. |
| F2 | High | Projects / evidence | **Evidence-view path validation rejects `#/…` paths** (`must start with /`) — but the app's own PlantOps sample seeds `#/orders`-style views, which the dialog itself would refuse to re-save. Hash-routed apps (most simple SPAs) need `/#/…` workarounds. |
| F3 | High | Verify & Review | The info banner promises *"A new task packet will include your feedback"*, but **`buildPacket` never reads the saved feedback** (`user-review-notes.md`). Regenerated packets silently drop the reviewer's notes — the core iteration promise is unimplemented. |
| F4 | Medium | Verify & Review | **Verification results are not rehydrated on revisit.** The run record stores `verificationResultPaths`, but reopening the step shows "Run checks" as if never run, and Approve stays disabled until checks are re-run in-session. |
| F5 | Medium | Evidence | **Green-field runs have no "before" concept.** For from-requirements builds the baseline capture can only fail (nothing serves yet); the UI shows "Not captured yet" errors instead of an explicit *no baseline — new build* state. |
| F6 | Low | Shell | The **titlebar crumb tracks the run's persisted step, not the visible view** — after generating context, the crumb reads "Create Task Packet" while the user is still looking at Prepare Context. |
| F7 | Low | Templates | The monolithic template gained a learned constraint: monorepo-hosted targets hit **duplicate-vite type identity errors** when `vite.config.ts` is inside the tsconfig project (cost one full iteration in pass 1). Encode as template guidance. |
| F8 | Process | Harness | The previous Electron E2E run's driver was never checked in. Fixed: `apps/desktop/e2e/` now holds the reusable Playwright driver + phase scripts. |

### What worked notably well

- The **combined task-and-standard-pack** is a complete, self-sufficient
  Copilot instruction set — the pass-1 sample was built from it without
  reading anything outside the exported files (plus the flatfile).
- The **overlay inspector + warning gate** behaved exactly as designed
  across 3 overwrite iterations (AI-HANDOFF-040 each time).
- **Run persistence / resume** ("Continue where you left off") survived 6
  app relaunches with zero state loss.
- `EUIK_TEST_MODE` picker-from-environment made the whole flow automatable
  without touching production dialog code.

## Pass 2 — 2026-07-09 (after round-1 improvements)

Result: **first-try green** — the initial overlay passed typecheck+build with
no fix iteration (pass 1 needed one), because the template now carries the
learned tsconfig constraint (F7) and pass-1 lessons were baked into the first
overlay. Sample saturated after 2 iterations (initial → out-of-service
dashboard panel). 12/12 interaction checks pass. Handoff approved.

### Round-1 improvements validated in real use

- **F1 fixed & validated** — launch command entered in the dialog; evidence
  capture auto-started `npm start` and captured 3/3 views, zero external
  processes.
- **F2 fixed & validated** — `#/instruments`-style paths accepted directly.
- **F3 fixed & validated** — regenerated packet contains
  `## Reviewer Feedback (previous iteration)` with the saved notes verbatim
  (asserted programmatically in `phase-regen.mjs`).
- **F4 fixed & validated** — reopening Verify & Review shows the stored
  verdict ("Re-run checks"), Approve enabled without a redundant run.
- **F5/F6 fixed** — green-field baseline copy and view-accurate crumb visible
  in the pass-2 screenshots.

### New findings

| # | Severity | Area | Finding |
|---|---|---|---|
| F9 | Medium | Create Task Packet | **"Generate New Task Packet" starts blank.** Fields (except title) reset on regeneration; the user must re-apply the template and re-type every section. Prior packet fields should prefill. |
| F10 | Medium | Verify & Review | **Rehydrated verification results can be stale.** After applying a *newer* overlay, the step still shows the pre-overlay green verdict. Results that predate the latest apply should be flagged "from before the latest overlay — re-run". |
| F11 | Low | Inspection | Warning list includes `AI-HANDOFF-045` (dirty working tree) on every run in a monorepo — correct but noisy; consider a project-level acknowledgement. (Recorded, not yet actioned.) |
| F12 | Low | Shell | Clicking the sidebar immediately after Approve times out in automation (both passes, same spot). Needs investigation — possibly a re-render race on run completion. |

### Round-1 app improvements (from F1–F7)

1. F1 — add *Launch command* field to the Launch & evidence dialog.
2. F2 — accept `#/…` and `/#/…` evidence view paths.
3. F3 — `buildPacket` appends a "Reviewer feedback (previous iteration)"
   section when the run has saved feedback; banner stays truthful.
4. F4 — rehydrate stored verification results when Verify & Review mounts.
5. F5 — explicit green-field baseline copy ("No baseline — this run builds
   a new UI from requirements") instead of capture-failure noise.
6. F6 — crumb reflects the view being displayed.
7. F7 — monolithic template constraints gain the tsconfig guidance line.

## Pass 3 — 2026-07-09 (after round-2 improvements)

Round-2 changes under test: **F9** (packet fields persisted on the run;
"Generate New Task Packet" arrives prefilled) and **F10** (applying a new
overlay invalidates prior verification results).

Result: first-try green again; saturation after 2 iterations (initial →
interval-helper-text polish). All round-2 improvements validated
programmatically in `phase-regen3.mjs`:

- `F9-PREFILL` / `F9-CONTENT` — regenerated packet keeps the previous
  sections with zero retyping (pass 2 required re-applying the template and
  re-entering both REPLACE sections).
- `F3-FEEDBACK` — feedback section still carried.
- `F10-INVALIDATED` — after the new overlay, Verify reads "Run checks"
  fresh instead of the stale green verdict pass 2 exhibited.
- 12/12 sample interaction checks; handoff approved; evidence captured with
  the app-managed server.

F12 (post-approve sidebar click flake) was reproduced as *transient only* —
navigation works normally on relaunch and in every other state; left open.

## Post-experiment — 2026-07-09, user-reported

| # | Severity | Area | Finding |
|---|---|---|---|
| F13 | High | Apply Zip Overlay | **A blocked overlay was a dead end.** Hard blockers refuse the zip (correctly), but the user had to compose the remediation message to Copilot by hand from the blocker table. Fixed: the blocker panel now has *Copy Fix Prompt for Copilot* — a paste-ready prompt naming every violation (rule id, path, message) and restating the corrected-zip contract for a fresh Copilot session — plus a link back to Run in Copilot to re-attach the upload set. Validated against a hostile zip (traversal + `.git` + `node_modules`) in `e2e/validate-fix-prompt.mjs`: 7/7 checks, screenshots in `pass-fix-prompt/`. |
| F18 | High | Standards pack | **The standard pack shipped zero visualization or layout-composition craft, so generated apps default to generic dashboards.** User-reported against a real Copilot-generated app: raw-value axis ticks, records chained into one trend line regardless of series, color-only status with a detached legend, KPI-tile filler, misalignment, arbitrary sizes. The standards *package* already had the material (`standards/components/data-visualization.md` with `CMP-VIZ-*`, `standards/layouts-and-recipes/dashboard-layouts.md` "shall not become decorative KPI walls", `semantic.charts.*` tokens) — the packet builder just never included any of it. Fixed in `buildStandardPackMarkdown`: 7 chart tokens with resolved values, `CMP-VIZ-*`/`CMP-TABLE-DATA-TABLE`/`CMP-LAYOUT-DASHBOARD-GRID` component IDs, `RCP-DASH-001`, 4 approved + 6 rejected guidance lines naming the observed drift, and two operative excerpts (*Layout and composition discipline*, *Engineering chart craft*: round ticks + grid, x-sorted series vs scatter, text-backed status, crosshair + keyboard readout). Proven end to end: the user's critique ran through the F16 iteration loop; the regenerated packet carried the new standards; the responding overlay rebuilt the app's Saved-cases chart to spec (verified green; before/after: user screenshot vs `pass-3/sample-user-viz-after.png`). Also fixed: harness `newestRunDir` sorted UUID dirs lexically instead of by mtime. |
| F18b | High | Standards pack | **Follow-up to F18 — the first "fixed" chart still failed the user's bar** (tile stack for the case list; no vertical alignment between the chart and list columns; then two self-audit catches: table columns clipped at the panel edge, dead space inside the stretched chart frame). Took 3 corrective overlay turns through the same run to reach a defensible result (`pass-3/sample-user-viz-final.png`): synced compact data table (dense rows, right-aligned tabular numerics, sticky header, active-row rail, abbreviated text-backed status), chart and table as bounded sibling panels sharing top/bottom edges, readout pinned to the panel bottom, fit verified programmatically. Lessons encoded into the pack so first generations get them: rejected — "record lists rendered as card stacks", "content clipped by its container"; approved — "chart + companion table as sibling panels sharing edges". Process lesson: screenshot self-audit against the reviewer's words before reporting, every turn. |
| F20 | High | Standards pack | **The pack specified layout, tables, and charts — but nothing about what a control looks like**, so real-Copilot generations (AeroCalc, from the much-more-complete requirements) produced disciplined layout *and* basic-looking components: 40px inputs with native number-spinner/select chrome, billboard wizard step boxes, full-height dashed empty wells. Notably, everything the pack *did* specify came out right (instrument strip, persistent helper slots, chart tokens, companion tables) — evidence the standards transfer; the gap tracks the pack's blind spots exactly. Fixed generically in `buildStandardPackMarkdown`: *Form and control craft* excerpt (compact 32px token-styled controls on inset surfaces, suppressed native chrome, drawn select chevrons, mono tabular numeric inputs, units in labels, persistent hint/error slots, compact step indicator, content-sized bounded empty states — sourced from `standards/components/forms.md`), `CMP-FORM-TEXT-INPUT/NUMBER-INPUT/SELECT` IDs, and three rejected-drift lines. Proven on the user's generated app via a CSS-only loop iteration: computed-style checks (32px, spinner `appearance: none`) plus screen-by-screen audit (`aero-calculator-after.png`, `aero-dashboard-after.png`, `aero-saved-after.png`). |
| F21 | High | Standards pack | **The pack had no table-fitting judgment**, so the generation (2) budgeted more columns than the container fits — Case/Configuration/Runway wrapping into 4-line lattice rows — and (1) forced a miniature 4-column table into the chart's narrow text-alternative rail to keep a dashboard silhouette, wrapping labels over four lines. Fixed generically: *Table craft and fitting* excerpt (one-line rows plus at most one meta line; merge secondary attributes into the primary cell's meta line or defer to a detail view; ellipsis + title over wrapping; horizontal scroll over lattices; **narrow rails get a compact synced readout list, never a squeezed table**) plus two rejected-drift lines. Applied to the generated AeroCalc via the loop: registry table now 8 columns with merged config·runway meta line (row height 65px, nothing wraps); the rail is a synced readout list (one-line label, mono weight→required pair, short status) fitting ~9 records where 4 wrapped rows fit before. Evidence: `pass-3/aero-table-after.png`, `aero-chart-rail-after.png`. |
| F19 | Medium | Process | **Standards improvements only reach regenerated screens.** After F18/F18b fixed Saved cases, the user found Dashboard and Calculator untouched with the same tropes (mismatched status-railed tiles, a second card-stack list, ragged form rhythm from conditional helper lines, stretched empty panels). Verified the standards additions are fully app-agnostic (no app-specific terms; view-specific code ships only in overlays). Fixed app-wide through three more loop turns: dashboard KPI tiles → one instrument strip (neutral hairline dividers, uppercase labels, mono tabular values, status in the value color only — the old rails were inset box-shadows needing an explicit override), Priority review → data table, FormField always renders its helper slot so rows align, panels top-align. Evidence: `pass-3/final-dashboard.png`, `final-calculator.png`. Process rule added to the experiment: an iteration is not done until **every** screen is re-audited against the standards, not just the one named in feedback. |
| F17 | High | Verify & Review / launch | **Launch App silently reused a running server and showed a stale build after an iteration.** For a build-and-serve monolith (`npm run build && npm start` serving a static `dist/`), `launchApp` only ran the launch command when the URL was *unreachable*; if the app's server was already up (from a previous launch), it just reopened the browser — so after applying an iteration overlay (which changes `src/` but not `dist/`) the user saw the pre-iteration app. Reproduced from a real user report: server up since before the apply, `dist/` older than `src/`. Fixed: when the server is already running, Launch App now re-runs the build step of the launch command (detected by the `&&`-joined "build then serve" shape; dev servers with a single hot-reloading command are left alone), so the running server serves the latest overlay; a build failure surfaces instead of opening a stale app, and the status tells the user to hard-refresh. Validated live in `e2e/validate-launch-rebuild.mjs` (4/4: dist made stale → Launch App → served bundle changes + status reports the rebuild). |
| F16 | High | Create Task Packet | **Returning to the packet step mid-iteration still spoke the language of a fresh build.** Fields prefilled from the *previous* packet (F9) and feedback only rode along at export (F3) — the form neither showed the feedback nor constrained the task to iteration. Fixed: a ninth template category, *Iterate on the previous design (feedback-driven)*, plus auto-population — when a run has an applied overlay and feedback saved since the last packet export (`taskPacketBuiltAt` on the run), returning to Create Task Packet switches to that category automatically: title/goal become the iteration task, **Scope is prefilled with the new feedback notes verbatim**, and constraints pin the previous design steady ("address only the feedback; preserve structure, routes, API contracts; changed files only"). Older, already-addressed feedback is excluded by timestamp. Validated live in `e2e/validate-iteration-prefill.mjs`: 7/7 (auto category, auto title, scope carries feedback, iteration constraints, and the exported packet carries all three). Unit-covered: `parseFeedbackEntries` + template registry (gui tests now 25). |
| F15 | High | Templates / launch | **The monolith method didn't wire itself up to run.** The template told Copilot to build a server but prescribed no port or `npm start` contract, and a created project had no launch config — so "automatically run the monolith" required manual setup every time. Fixed by making it the default for this method: the monolithic-web-app template now standardizes on `npm start` serving the built frontend + API at `http://localhost:4180` (PORT-overridable), and choosing that template auto-seeds the project's `launchUrl` + `launchCommand` (`npm run build && npm start`) when it has none. After Verify builds, **Launch App just works** — no dialog. Validated in `e2e/validate-monolith-autolaunch.mjs` (4/4: fresh project unconfigured → template auto-sets url+command → packet prescribes the matching port) plus a functional launch: `npm run build && npm start` served `GET /` → 200 and `GET /api/instruments` on 4180. Overridable via the F14 dialog. |
| F14 | High | Verify & Review | **A newly built app couldn't be opened in step 5.1.** A project created in the app has no `launchUrl` (only the seeded PlantOps sample does), so "1 · Launch app" showed a disabled button and dead-end text with no in-workflow way to fix it — exactly the case for a from-requirements monolith. Fixed: when there is no launch URL the card offers *Set launch URL…*, opening the same Launch & evidence dialog inline (URL + launch command + views); on save the project persists and *Launch App* appears without leaving the step. Threaded `refreshProjects` into the workflow step props so the saved project flows straight back into the view. Validated in `e2e/validate-launch-config.mjs`: 5/5 checks (inline CTA present, no disabled button, Launch App appears after save, URL+command persisted), screenshots in `../launch-fix/pass-launch-fix/`. |

## F22 — requirements generation in the workflow + two design rules (2026-07-10, user-directed)

1. **New workflow step: requirements from a brief.** Users shouldn't need to
   hand-author a detailed spec. New task template `requirements-from-brief`
   ("Write the requirements (from a short brief)"): the user supplies 3–6
   sentences of product intent; Copilot returns `ui-overlay.zip` containing
   only `REQUIREMENTS.md`, structured to the proven shape (numbered verifiable
   requirements, input tables with ranges/validation, status thresholds, seed
   data, run contract, PWA/offline section, quality bar, non-goals, and an
   explicit **Assumptions** section for anything beyond the brief). Apply it,
   then run the build handoff from the document — two handoffs, zero new
   plumbing. Templates now 10 (gui tests updated).
2. **Sibling panels stretch** — pack now states side-by-side panels stretch to
   share top and bottom edges (rejected line added); AeroStudy builder fixed
   and verified programmatically (panel bottoms 930 = 930).
3. **KPI bars stay minimal on working screens** — "this is an app builder,
   not a dashboard builder": pack now prescribes a slim one-line stat row
   attached to the working surface (mono values at body scale), reserves
   instrument strips for true monitoring dashboards, and bans process state
   (e.g. a selection count) as a stat cell. AeroStudy registry converted
   (`study-list-v2.png`, `study-builder-v2.png`).

## F23 — "boxes are not structure" (2026-07-10, user-directed)

**Panel-heavy composition is the deepest AI-generated tell**: a uniform
bordered box around every region (page → panel → sub-panel → field). Encoded
as a first-class principle in the pack — approved: *structure from typography,
spacing, and hairline rules; bounded panels reserved for true surfaces
(tables, charts, insets, rails, dialogs, empty states); forms and prose
compose directly on the canvas under small uppercase section headers*;
rejected: *panel-heavy composition / panel nested in panel / forms in heavy
boxes*; and the same paragraph added to the RCP-DASH-001 excerpt body.
AeroStudy de-boxed through the loop across all four views: step panels →
canvas columns under ruled headers, tables keep a dedicated `table-surface`,
the limitation banner / summary row / sidebar meta lighten to rules. Evidence:
`pass-3/study-builder-v3.png`, `study-detail-v3.png`, `study-list-v3.png`
(compare the -v2 shots).

## F24 — wizard flows as a first-class primitive (2026-07-10, user-directed)

Multi-phase tasks were rendering as **side-by-side step panels** — not a
stepped flow. Encoded as an operative pack excerpt under the already-reserved
`RCP-WORKFLOW-001` (+ `CMP-WORKFLOW-STEP-INDICATOR`): any 2+-phase task
defaults to a wizard — compact numbered step indicator (20px dots, short
labels, complete/current/upcoming, completed steps clickable back, never
forward past validation), **one phase on the canvas at a time**, per-phase
validation gating Next, Back never losing input, and a review-and-commit
final phase showing the consequential summary beside the primary action —
**built once as a reusable stepper primitive**. Approved + rejected lines
added ("sequential phases rendered side by side as parallel panels").
AeroStudy converted through the loop: new reusable `src/components/Wizard.tsx`
(WizardStepper/WizardPhase/WizardActions), builder now 3 phases
(identity → sweep & compare → preview & save with the expanded-study recap
and crossover-labeled preview chart). Behavior verified programmatically:
Next gated on validation, step-back navigation works, review chart renders.
Evidence: `pass-3/wizard-step1.png`, `wizard-step3.png`.

## F25 — content-sized controls, grouped rows, fill the working width (2026-07-10, user-directed)

The wizard phase stranded most of the viewport behind a narrow flat list of
uniformly stretched fields ("a five-digit number in a 600px input"). Encoded
in the form-craft excerpt + approved/rejected lines: **controls size to their
expected content** (numerics ~10–14ch, selects to longest option, identifiers
~20ch; only names/notes span), and **forms beyond ~6 fields organize into
labeled groups** (uppercase group header over a hairline) whose content-sized
rows compose to fill the working width — density from structure, not
stretched inputs. AeroStudy builder restructured through the loop: Identity /
Configuration / Environment & runway groups; numeric inputs measured at
170px; the environment row fills 1,248px with six aligned compact fields.
Evidence: `pass-3/wizard-v5-step1.png` (compare `wizard-step1.png`).

## F26 — stepper spans the working width (2026-07-10, user-directed)

The wizard step indicator clustered at the left with fixed stub connectors.
Excerpt tightened: the strip spans the full working width, steps distributed
with flexible hairline connectors — "never a cluster stranded at the left
edge." AeroStudy fixed via the loop; span verified programmatically (last
step flush with the strip edge, 1528 = 1528). Evidence:
`pass-3/wizard-v6-stepper.png`.

## F27 — collapsible navigation as the shell default (2026-07-10, user-directed)

Nav panes should collapse. The standards package already sanctioned it
(`CMP-NAV-PRIMARY` lists a `collapsed` state; application-shell.md requires
active state + accessible names to survive collapse) but the pack never
carried it, and "may" wasn't a default. New `LAY-SHELL-001` excerpt makes it
one: primary navigation collapses to a compact ~56–64px monogram/glyph rail
via a persistent keyboard-accessible toggle; collapsed items keep accessible
names, visible focus, and the active indicator; the preference persists
across sessions; the content grid reclaims the width. Approved-guidance line
updated. AeroStudy implemented through the loop and verified programmatically:
248→64px, persisted across reload, active `aria-label` intact, re-expand
works. Evidence: `pass-3/nav-collapsed.png`.

## F28 — embedded app preview in the iteration loop (2026-07-10, user-directed)

The Verify step's iteration panel now embeds the app under construction
**inside the workbench**: "Preview here" reuses the launch machinery (auto-
start + F17 rebuild, without popping the system browser — `launchApp` gained
an `{ open }` option) and renders the project's launch URL in an Electron
`<webview>` guest (browser/mock mode falls back to an iframe), with Reload /
Open externally / Close controls. Verify → navigate the real product →
write feedback → regenerate, all in one window. `webviewTag` enabled on the
sandboxed renderer; the guest src comes only from the project's launch URL.
Validated via harness: guest webContents confirmed at `http://127.0.0.1:4180/`,
1106×640 frame, screenshot `pass-3/100-embedded-preview.png` showing AeroPlan
rendering inside Verify & Review.

**F28b (user corrections):** (1) the preview is a ruled *region inside the
review panel* (own-panel version violated F23's no-nested-panels rule);
(2) it renders **by default** on arriving at Verify & Review — no Preview
button; the server auto-starts/rebuilds in the background with visible
starting/error states and a Retry; (3) fixed the double-open bug — the
preview path now passes `{ open: false }` (the option existed but wasn't
passed), and "Open externally" no longer calls `openExternal` on top of
`launchApp`'s own open. Harness-verified: auto-preview guest at
`http://127.0.0.1:4180/` with zero clicks, region inside the iteration
panel, no preview buttons (`pass-3/100-embedded-preview-v2.png`).

**F28c (user-reported cutoff):** the preview painted only the top strip of
the app and left the rest of the frame black. Cause: `.app-preview-frame`
set `display: block` on the `<webview>`; Electron sizes the guest through
the tag's internal flex styling, so overriding it leaves the guest viewport
stale (Electron docs: do not overwrite webview's default `display:flex`).
Fix: `webview.app-preview-frame { display: flex; }`, and the frame height is
now viewport-aware (`clamp(420px, calc(100vh - 280px), 720px)`) instead of a
hard 640px so the whole frame fits on screen. New harness check
`e2e/validate-embedded-preview.mjs` asserts the guest viewport equals the
frame box — 1104×551 in a 1106×553 frame, 5/5 PASS
(`pass-3/100-embedded-preview-guest-fill.png`).

**F28d (user-reported blending):** the guest app blended seamlessly into the
workbench panel — no visible boundary where the preview begins. The preview
now renders inside explicit chrome: a shell with a strong border
(`--semantic-border-strong`) and drop shadow, a raised header strip
(`--semantic-surface-inset`, ruled off from the guest) holding the APP
PREVIEW label, the URL in an address-bar pill, and the Reload / Open
externally controls. Principle: embedded foreign content is always framed by
host chrome, never blended. Harness gained a GUEST-DEMARCATED computed-style
assertion (shell border ≥1px, chrome bar background ≠ panel background) —
6/6 PASS.

## F29 — Verify & Review rebuilt as a preview-centric review cockpit (2026-07-10, user-directed)

The step is now built around the embedded preview instead of around cards:

- **Layout.** One panel: a compact toolbar (health chip · notes chip ·
  evidence chip on the left; Review Packet · New Task Packet · Approve &
  Complete on the right) above the app preview, which is the entire body of
  the step. Verification results, review notes, and visual evidence moved
  behind dialogs — no observability lost, dramatically less chrome.
- **Autonomous health checks.** Verification runs on arrival with zero
  clicks whenever there are no fresh results (applyOverlay already
  invalidates them, so "empty" always means "this overlay is unverified").
  The chip reports running → n/n passed / n failed; the dialog holds the
  stat chips, per-command table, and full-report link.
- **Component-anchored comments.** A Comment button in the preview chrome
  injects a picker into the <webview> guest (hover highlight + selector tag,
  click picks, Esc cancels; capture-phase listeners keep the click from
  activating the app). Clicking a component opens a composer anchored to the
  element (selector path, text snippet, route + title) and saves a
  structured entry to user-review-notes.md — which the F16 iterate-on-
  feedback prefill then carries verbatim into the follow-on packet, giving
  Copilot element-level anchors.
- **Electron gotchas fixed en route.** (1) The <webview> guest composites
  above host DOM, so dialogs bled through it — the preview hides
  (visibility, guest stays alive) while any dialog is open. (2) The picker
  resolves from the click target, not the last hover, so a stray OS cursor
  over the window can't mis-anchor the comment.

Validated by `e2e/validate-review-cockpit.mjs` (9/9 PASS): checks chip
"running… → 2/2 passed" with zero clicks; guest h1 click → composer anchored
to `main#main > header.page-header > div:nth-of-type(1) > h1`; note saved
and listed; repair packet prefilled with the anchored comment and the
template auto-switched to the iteration category. Evidence:
`pass-3/100-cockpit-composer.png` … `104-cockpit-repair-prefill.png`.

## AeroPlan — the single-pass capstone (2026-07-10)

Fresh project + the **refined next-iteration requirements** (`examples/aero-plan`):
wizard calculator with live density-altitude readout and variant envelopes, a
review step with the auditable **contribution breakdown** (base → weight →
altitude → temperature → wind → surface → flap with running distances),
weight-headroom-to-boundary outputs, a registry whose chart draws the
available-runway **reference line only when filtered to a single runway**
(crossover = limiting weight), a **two-case diff** with highlighted changed
inputs and signed output deltas, a runway library with usage counts, a slim
stat-row dashboard, collapsible nav, and full PWA/offline — built from the
25.5KB packet in **one authored pass**.

**Honest single-pass verdict:** verification (typecheck + build) green on the
first apply — no fix iterations, the pass-1 → pass-3 trend holding at 1.
Design audit: five of six screens passed the full standards ladder untouched
(wizard + breakdown, conditional reference chart with keyboard crosshair,
dashboard, registry, runways, 64px nav collapse all verified); **one fitting
defect** — the compare view's input-diff table clipped its B column by
carrying full case labels as headers — fixed in one disclosed micro-iteration
(headers → A/B, labels in the intro; fit verified 835 ≤ 836). Evidence:
`pass-3/aeroplan-dashboard.png`, `aeroplan-calc-step1/2.png`,
`aeroplan-cases-table.png`, `aeroplan-cases-chart-reference.png`,
`aeroplan-compare-diff.png`, `aeroplan-runways.png`.

## AeroStudy — new example built on the accumulated standards (2026-07-10)

Added `examples/aero-study`: a performance **trade-study** workbench that builds
on AeroCalc (same GL fleet + performance model) but makes the unit of work a
*study* — a multi-case parameter sweep with a compare dimension — and centres on
a **configurable engineering chart**: selectable X/Y axes over any numeric
input/output, overlaid x-sorted series, reference lines with interpolated
crossover markers (the tradeoff readout), pointer+keyboard crosshair with a
visible readout, and a compact synced text-alternative rail. Screens: studies
registry (instrument strip + dense worst-first table), study builder with live
preview chart, study detail (chart + per-series analysis + plain-English
finding), and multi-study comparison overlay. Full monolith PWA (Node-stdlib
JSON API over study defs, shared deterministic model as the single compute
source, hand-rolled service worker + manifest, offline read-only). 28-file
overlay, applied and verified green through the workbench loop; **every screen
passed the standards audit on the first authored pass** — the accumulated pack
(charts, layout, tables + fitting, controls) now produces a polished, genuinely
complex engineering tool without per-screen correction. Evidence:
`pass-3/study-list.png`, `study-detail.png`, `study-detail-margin.png`,
`study-builder.png`, `study-compare.png`.

### Saturation statement

Three passes converged: iterations-to-green went 2 → 1 → 1, iterations-to-
saturation 4 → 2 → 2, and pass 3 surfaced **no new workflow defects** — its
only findings were the two already queued from pass 2. The remaining known
items (F11 dirty-tree warning ergonomics, F12 transient nav flake) are
recorded above. The next dimension to exercise is breadth: the other seven
task-template methods through the same harness (`TARGET=`/`EXPERIMENT=`).
