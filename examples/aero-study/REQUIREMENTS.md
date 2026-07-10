# AeroStudy — aircraft performance trade-study workbench (requirements)

AeroStudy is the next tool after our single-case planner (AeroCalc). Where
AeroCalc answers "is *this* case OK?", AeroStudy answers the questions our
engineers actually argue about before a charter quote or an airfield study:
**how does performance trade against weight, temperature, altitude, and
configuration — and where do the limits bite?** It is a planning/demo-grade
tool: no approved AFM/OEM tables are supplied, and every results screen must
say so. Nothing it produces may be presented as approved performance data.

It is one installable, offline-capable deployable on a local ops PC, built on
the same GL-350 / GL-500 / GL-650 fleet and the same performance model family
as AeroCalc.

## 1. The core object: a study

A **study** is a named, multi-case parameter sweep, not a single case. It has:

- a **baseline** configuration: operation (takeoff/landing), aircraft variant,
  runway id + available length (ft), pressure altitude (ft), OAT (°C), aircraft
  weight (lb), wind component (kt, headwind positive), runway condition
  (dry/wet), flap setting (10/15/20);
- a **sweep variable** — one of aircraft weight, pressure altitude, OAT, wind
  component, or available runway length — with start, end, and step (validated
  ranges; the generated point count shown live, capped at 40 points);
- an optional **compare dimension** that fans the study into several series:
  none, aircraft variant, runway condition, flap setting, or operation.

Expanding a study yields a grid of computed cases: for each compare value, one
case per sweep step. Each computed case carries the full input set plus the
outputs from §2. Studies are created and edited through a builder with a live
preview of the resulting series and point count before saving.

## 2. Performance model (shared, deterministic)

A single shared, pure TypeScript module computes outputs from inputs and is the
only source of truth (used by the builder preview and every chart). Per case it
returns: takeoff/landing distance required, **required runway**, **runway
margin** (available − required), climb gradient (%), **max allowable weight**
for the case's runway (the binding weight limit), the **limiting factor**
(which constraint binds — runway length or climb gradient), status, and a short
calculation-basis note. Status: **within-limits**, **caution** (margin <
1,000 ft or climb gradient within 0.3 % of its minimum), **out-of-limits**
(negative margin or below-minimum gradient). Status is always carried in text.

## 3. The study chart (the centerpiece)

The reason this app exists. A configurable engineering XY chart:

- **Choose the axes.** X and Y are each selectable from the numeric fields
  (sweep inputs and computed outputs): weight, pressure altitude, OAT, wind,
  runway length, required runway, runway margin, climb gradient, max allowable
  weight. Axis titles show units; ticks are round engineering steps with
  gridlines.
- **Overlay series.** The compare dimension produces multiple named line
  series, each sorted by the X value, on the semantic chart-series palette,
  identified in a legend by text (never color alone). Standalone (no-compare)
  studies show one series; points that are discrete rather than a monotonic
  sweep render as markers.
- **Reference lines for tradeoffs.** When Y is required runway, draw the
  available-runway reference line; when Y is runway margin, draw the zero-margin
  line. Where a series crosses the reference, mark and label the crossover (the
  **limiting value** — e.g. the weight at which margin reaches zero). This is
  the tradeoff readout.
- **Read exact values.** A crosshair follows the pointer *and* the keyboard
  (arrow keys move along the active series, Tab/keys switch series, Home/End
  jump, Escape clears); a visible readout mirrors the highlighted point's exact
  values for assistive tech and for the operator a metre from the screen.
- **Text alternative.** Beside the chart, a compact synced readout of the
  active series (label, the X→Y pair in mono figures, status) — not a squeezed
  multi-column table — with the full data one toggle away.

## 4. Study analysis panel

Alongside the chart, a per-series analysis: for each series, the Y range over
the sweep, the crossover / limiting value against the reference (or "no
crossover in range"), and the worst status reached. A one-line plain-English
finding summarizes the study (e.g. "GL-500 dry: limiting weight 66,200 lb on
5,000 ft; wet: 61,400 lb").

## 5. Studies list (landing page)

A registry of saved studies as a dense data table: name, what it varies (sweep
+ compare), series/point counts, headline limiting value, worst status, updated
time, open/edit. An instrument strip above it: total studies, studies with an
out-of-limits point, tightest limiting margin across all studies, count of
studies needing review. Worst studies first. No decorative tiles.

## 6. Multi-case operations

- **Select** multiple studies in the list and open a **comparison** overlaying
  one chosen series-representative curve from each selected study on a single
  chart (same axis rules), to compare designs directly.
- **Duplicate** a study as the starting point for a variant ("what if we allow
  wet?"), and **edit** any study, both through the builder.

## 7. Persistence and API

Study definitions live in a JSON file on the server, surviving restart; the
frontend talks only to a small typed JSON API (list / create / update /
duplicate / delete studies). Points are derived on the client from the shared
model — the definition is the stored source of truth. Seed on first run with
~6 studies exercising every sweep variable and every compare dimension,
including at least two with a real crossover and one hot-and-high study, so
every screen and both series kinds are populated immediately.

## 8. One deployable + installable PWA with offline read

- `npm run build` then `npm start` serves UI, API, and data on one port —
  `process.env.PORT` or 4181. `npm run typecheck` and `npm run build` pass.
  React + Vite + TypeScript, Node-stdlib server, shared types/model in one
  module, no added dependencies.
- Web app manifest (dark theme colors, standalone display, SVG icon),
  installable with no manifest warnings; a hand-rolled service worker (no
  libraries) precaches the app shell and caches last-synced study data.
- Offline: the app opens, shows a clear **"Offline — showing last-synced
  studies (read-only)"** banner, renders the list, charts, and analysis from
  cached data, and disables mutating actions with an explanatory state (never
  a silent failure). An "Update available — reload" notice replaces silent
  mid-session swaps.

## 9. Quality bar

Dark-first engineering tool on the semantic token set. Record lists are data
tables with one-line rows (secondary attributes in a muted meta line), never
card stacks or wrapped lattices; narrow rails use compact synced readouts, not
squeezed tables. Compact token-styled controls (no native chrome); sibling
panels share edges, padding, and rhythm; nothing clipped by its container.
Complete keyboard operation with visible focus; status always text-backed;
loading, empty, error, and offline states for every remote region; mono
tabular numerals for all figures; the planning-grade limitation banner always
visible.

## Non-goals

No authentication, no multi-user sync, no real AFM/OEM data, no cloud
services, no telemetry, no push, no background sync, no chart libraries
(hand-rolled SVG only).
