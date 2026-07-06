# Front-End Audit Manifest

**Date:** 2026-07-06 · **Method:** element-by-element comparison of all ten approved
mockups against the implemented renderer, with purpose evidence (mockup + PRD
section) and wiring evidence (bridge method / state) for every component.
**Gap classes:** `IMPL` = implementation gap (fixed this pass) · `REQ` = requirements
gap surfaced by the audit (fixed + logged) · `DEV` = intentional deviation (kept,
logged in the product-owner decision log).

## Shell (all mockups)

| Element | Mockup evidence | Purpose / wiring | Status |
|---|---|---|---|
| Titlebar logo + product name + version pill | all ten, top-left | Brand/orientation; version from `appVersion()` | ✅ SVG cube (was unicode — IMPL, fixed) |
| Help button (top-right) | `D4786C76`, `8C252B19`, `E4541331` | Opens workflow Help dialog (PRD §12.1) | ✅ SVG icon |
| Sidebar nav ×5 with icons + active state | all ten | View-state navigation (`ARCH-ROUTE-001/002`) | ✅ SVG icons (was unicode — IMPL, fixed) |
| Tip card with "View workflow guide →" | all ten, bottom-left | PRD §12.2 tip copy; link opens Help | ✅ link was dead — IMPL, now wired |
| Dark scrollbars, hover states | overall polish | production feel | ✅ added |

## Copilot Handoff Hub (`D4786C76`)

| Element | Evidence | Purpose / wiring | Status |
|---|---|---|---|
| Five step cards w/ outline icons + status pills | mockup | Workflow overview; navigates to reachable steps | ✅ mockup icon set (folder/file+/cloud/tray/shield) |
| Stepper circle row above cards | mockup | Run progress; derived from `HandoffRun.currentStep` | ✅ |
| Recent Projects (3-col, folder icon, last-updated, Open) | mockup | Entry into workflow; `listProjects()` | ✅ |
| "+ New Project" from the hub | **not in mockup/PRD (§13.1 forbids)** | User requirement — create + auto-start handoff | ✅ REQ gap → added; PO-14 |
| Info banner + "Learn more about the workflow →" | mockup bottom banner | Opens Help | ✅ link added — IMPL |

## Prepare Context (`8C252B19`)

| Element | Evidence | Purpose / wiring | Status |
|---|---|---|---|
| Repository panel w/ folder icon + Change | mockup | shows `project.repoPath`; Change → Projects | ✅ icon added — IMPL |
| What-to-include rows (source/config/assets/docs) | mockup + PRD §13.2 | fixed include categories | ✅ (assets row added earlier) |
| Per-category "Configure ›" buttons | mockup | — | DEV: PRD §13.2 forbids a context editor; rows show "Included" badges instead |
| Output format radio cards | mockup | flatfile primary + `repo-inventory.json` | ✅ |
| Advanced options (bottom-left) | mockup | reveals deterministic exclusion detail | ✅ repositioned — IMPL |
| Context review summary + policy reminder | **PRD §13.2 (not in mockup)** | pre-upload review: project, task/recipe, upload set, categories, warnings | ✅ |
| Generate Context (primary) | mockup | `prepareContext(runId)` → inventory + flatfile | ✅ |

## Create Task Packet (`1F2214C9`)

| Element | Evidence | Purpose / wiring | Status |
|---|---|---|---|
| Project panel w/ folder icon | mockup | context | ✅ icon added — IMPL |
| Five section rows w/ icons, Required chips, Edit | mockup + PRD §13.3 | packet fields; local state | ✅ |
| Inline saved values in rows | not in mockup | reviewability | DEV (kept) |
| Recipe chip when prefiled | — | recipe→packet flow (PRD §13.2 "task or recipe") | ✅ |
| Preview Task Packet | mockup + PRD §13.4 | rendered-markdown modal, Code tab, Copy/Download/Close; `getArtifactText` | ✅ |
| "Start from a template" picker | user requirement (repeatable tasks); consumer of `Settings.preferredTemplate` (PRD §28.8 — previously a dead setting) | 5 templates fill all sections in one click w/ project-name interpolation + dirty-form guard | ✅ REQ gap → added; PO-16 |
| Export Task Packet (primary) | mockup + PRD §13.3 | `buildPacket()` → task-packet.md + standard-pack.md | ✅ |

## Run in Copilot (`E4541331`)

| Element | Evidence | Purpose / wiring | Status |
|---|---|---|---|
| "Upload to Microsoft 365 Copilot (max 3 files)" + dashed set | mockup + PRD §13.5 | shows real manifest w/ sizes | ✅ |
| Per-file ✕ remove | mockup | — | DEV: upload set is the contract-fixed trio; Replace files rebuilds instead |
| Replace files + "3 of 3 selected ✓" | mockup | back to packet step | ✅ |
| Copy Recommended Prompt | mockup + PRD §13.5 | clipboard w/ fallback | ✅ SVG icon |
| Show Files in Folder / Open M365 Copilot | not in mockup | REQ gap: user must physically grab files + open Copilot; `showInFolder`/`openExternal` | ✅ added |
| Expected output banner | mockup + PRD §13.5 | sets expectation incl. optional apply-notes.md | ✅ |

## Apply Zip Overlay (no mockup — PRD §13.6 controls)

| Element | Evidence | Purpose / wiring | Status |
|---|---|---|---|
| 2×1 layout: apply panel + zip contents tree | PRD §13.6 layout spec | `inspectOverlay()`; tree from normalized entries | ✅ |
| Hard-blocker refusal / warning acceptance checkbox | overlay-safety standard | `applyOverlay(acceptWarnings)` | ✅ |
| Applied-files list | PRD §28.6 | persisted record | ✅ |

## Verify & Review (`241E2FF5`)

| Element | Evidence | Purpose / wiring | Status |
|---|---|---|---|
| Iteration loop w/ leading intro cell + 3 numbered steps | mockup | Launch App (`openExternal(project.launchUrl)`), Add Feedback (`saveFeedback`), Review Packet (`buildReviewPacket`), New Task Packet | ✅ intro cell added — IMPL |
| Green hero check + "All checks passed" + last-run time | mockup | verification summary state | ✅ added — IMPL |
| Stat chips w/ icons (run/passed/failed/duration) | mockup | derived from `VerificationResult[]` | ✅ icons added — IMPL |
| Results table + "View full test report" | mockup | `showInFolder(combinedOutputPath)` | ✅ added — IMPL |
| Recent feedback history + "View all →" | mockup | history events + full notes dialog (`getArtifactText`) | ✅ added — IMPL |
| What's next guidance | mockup + PRD §13.7 | state-dependent guidance | ✅ |
| Bottom: Back / Re-run tests / Approve & Complete | mockup | re-run + `updateRun(complete, approved)` | ✅ Re-run moved to bottom row — IMPL |

## Recipes (`26DF7358`)

| Element | Evidence | Purpose / wiring | Status |
|---|---|---|---|
| Five recipe rows w/ wireframe thumbnails | mockup + PRD §13.8 exact set | SVG schematics per recipe | ✅ |
| Search | mockup | filter | ✅ |
| Row action | mockup chevron | "Use in Task Packet" → prefill flow (PO-13) | ✅ |
| Recipe detail views | — | PRD §11.4 removed from v0.1 | DEV (excluded by PRD) |

## Components (`32D5753D`)

| Element | Evidence | Purpose / wiring | Status |
|---|---|---|---|
| Eight curated cards w/ live demos (incl. Tabs, Page Header) | mockup + PRD §13.9 exact set | token-styled demos | ✅ |
| Search | mockup | filters demos + manifest | ✅ |
| Full 68-component manifest table + category filter | user requirement (PO-12) | generated from `standards/component-manifest.json` | ✅ |
| Storybook-style playground | — | PRD §13.9 forbids | DEV (excluded by PRD) |

## Projects (`5B1D0845`) + New Project modal (`7F2C5648`)

| Element | Evidence | Purpose / wiring | Status |
|---|---|---|---|
| Search + All Status filter | mockup + PRD §13.10 | list filtering | ✅ |
| Sort: Last Modified select | mockup | sort control | ✅ added — IMPL |
| List/grid toggle | mockup | layout switch w/ card grid | ✅ added — IMPL |
| Table: name+desc, status pill, friendly dates | mockup | `listProjects()` | ✅ |
| Actions: kebab "⋯" menu | mockup | — | DEV: explicit labeled buttons (Start handoff / Launch URL / Archive) beat a two-item hidden menu for a11y |
| "Set launch URL…" | **REQ gap** — PRD §27.5 requires per-project launch URL; no UI existed to set it (Launch App was permanently disabled) | `updateProject({launchUrl})` w/ http(s) validation | ✅ added |
| Pagination "Showing X to Y of Z" + pager | mockup | page size 8 | ✅ added — IMPL |
| New Project modal (name/path+Browse/description) | mockup + PRD §13.11 | `createProject` w/ validation | ✅ |

## Settings (`D7DC446E`)

| Element | Evidence | Purpose / wiring | Status |
|---|---|---|---|
| Four panels (workspace/handoff/review/safety) | mockup + PRD §13.12 | bound to `Settings` (PRD §28.8) | ✅ |
| Per-panel "Save changes" buttons | mockup | `saveSettings` per panel | ✅ added — IMPL |
| Max uploads spinner (3) | mockup | fixed by budget — read-only w/ note | ✅ |
| Preferred packet format select | mockup | v0.1 Markdown-only (disabled select + note) | ✅ added — IMPL |
| Preferred template | mockup + PRD §28.8 | select over the 5 task templates; preselects the Create Task Packet picker | ✅ was a free-text field feeding nothing — REQ gap, fixed |
| Org-policy note in footer banner | mockup | policy reminder | ✅ text aligned — IMPL |

## Summary

- 9 implementation gaps fixed this pass (dead tip links, hub learn-more, folder
  icons, advanced-options placement, verify hero/last-run/chip icons/report/view-all,
  bottom re-run, projects sort/grid/pagination, settings per-panel saves + packet
  format, icon sweep).
- 3 requirements gaps surfaced and closed: hub New Project (PO-14), Show
  Files/Open Copilot on Run in Copilot, and **Set launch URL** (without it, PRD
  §27.5's Launch App button could never be enabled).
- 6 intentional deviations kept and logged: per-category Configure (context-editor
  ban), upload-file removal (fixed trio), inline section values, explicit action
  buttons over kebab menu, recipe/component detail views (PRD §11.4), manifest
  reference table (PO-12).
- Every interactive control now has a wired handler; no dead affordances remain.
