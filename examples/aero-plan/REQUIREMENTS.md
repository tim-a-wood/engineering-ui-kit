# AeroPlan — flight-ops performance planning suite (requirements)

AeroPlan is the next iteration of our aircraft performance calculator
(AeroCalc). Same mission — planning-grade takeoff and landing performance for
the GL-350 / GL-500 / GL-650 fleet on one local ops PC — but refined from six
months of using the first tool: the calculator becomes a guided three-step
flow, results explain *why* they are what they are, saved cases can be
compared directly, and the whole app holds the engineering-tool quality bar
from the first screen.

Planning/demo-grade throughout: no approved AFM/OEM tables are supplied; every
screen showing results must say so, and nothing may be presented as approved
performance data.

## 1. Case calculator — a three-step wizard

The calculator is an explicit wizard (inputs → review → save) with a compact
numbered step indicator spanning the working width. Back never loses input;
each step validates before the next enables.

**Step 1 — Inputs**, grouped under ruled headers, controls sized to content:

- *Identity*: case label (required for save, ≤ 80 chars, unique across saved
  cases — uniqueness checked live).
- *Configuration*: operation (takeoff/landing), variant (GL-350/500/650),
  flap (10/15/20), runway condition (dry/wet).
- *Environment & runway*: runway (select from the library, prefilling
  available length — editable for planning studies), available runway
  (1,000–20,000 ft), pressure altitude (−1,000–14,000 ft), OAT (−40–55 °C),
  weight (30,000–90,000 lb **and** within the variant envelope below),
  wind component (−30–+50 kt, headwind positive).

| Variant | Min weight | Max weight |
|---|---|---|
| GL-350 | 32,000 lb | 60,000 lb |
| GL-500 | 40,000 lb | 72,000 lb |
| GL-650 | 46,000 lb | 84,000 lb |

Live derived readout beside the environment group: **density altitude**,
computed as PA + 120 × (OAT − ISA), ISA = 15 − 2 °C per 1,000 ft of PA —
shown in mono figures and updating as inputs change.

**Step 2 — Review** (nothing saved yet): the full output set (§2) plus a
**contribution breakdown** — an ordered factor table showing how the base
distance becomes the required runway: base (variant/operation), weight
correction, altitude, temperature, wind, surface condition, flap — each row
with its multiplier and running distance, so an engineer can audit the number.

**Step 3 — Save**: recap line + save; editing an existing case follows the
same wizard with all steps unlocked.

## 2. Outputs and status

Per case: takeoff distance required, accelerate-stop distance, landing
distance, **required runway**, **runway margin** (available − required),
climb gradient (%), approach speed (kt), **max allowable weight** for the
runway, the **limiting factor** (runway length or minimum climb gradient),
and **headroom to the next status boundary** stated in weight ("+3,400 lb to
caution"). Status: within-limits / caution (margin < 1,000 ft or climb within
0.3 % of minimum) / out-of-limits (negative margin or below-minimum climb) —
always carried in text.

## 3. Weight sweeps

From any valid Step-1 configuration: start/end/step weight sweep (≤ 25 cases,
live count before generating), saved as a labeled family
(`<label> · sweep <weight> lb`) of first-class cases.

## 4. Saved cases registry

Dense one-line-row table (meta line for configuration · runway), filters
(variant, operation, status), text search (label/runway), sort by margin or
updated time, edit/duplicate per row — plus a synchronized **XY chart** view:
weight on X, required runway on Y; sweep families as weight-sorted line
series, standalone cases as scatter; crosshair with pointer **and** keyboard
readout; a compact synced readout rail as the text alternative. **When the
registry is filtered to a single runway**, the chart draws that runway's
available length as a reference line with interpolated crossover markers
(the limiting weight); with mixed runways no reference is drawn.

## 5. Case comparison

Select exactly two saved cases → a side-by-side **diff**: all inputs and
outputs as aligned rows, input rows that differ highlighted, numeric outputs
with a signed delta column in mono figures. Reachable from the registry;
deep-linkable.

## 6. Runway library

Managed list (id, length ft, elevation ft, notes; unique id, length
1,000–20,000): create and edit with validation, plus a **usage count** per
runway (how many saved cases reference it). Seed six realistic entries
including one short field and one hot-and-high field.

## 7. Fleet dashboard

The landing page answers: anything out of limits, what needs review, where is
the thinnest margin? **One slim single-line stat row** (total cases,
out-of-limits, caution, thinnest margin with case name) — no KPI tiles — over
a **priority review table**, worst first (status then margin), each row
linking into its case. 

## 8. Persistence, API, seeds

Cases and runways live in JSON files on the server, restart-safe, behind a
small typed JSON API; shared TypeScript types and the deterministic
performance model live in one module used by client and server. Seed on
first run: the six runways and ~16 cases — one 5-point and one 4-point sweep
family plus seven standalone cases including a **comparison-ready pair**
(same runway and weight, wet vs dry) — statuses mixed so every screen and
both chart series kinds are populated immediately.

## 9. One deployable

`npm run build` then `npm start` serves UI, API, and data on one port —
`process.env.PORT` or 4180. `npm run typecheck` and `npm run build` must
pass. React + Vite + TypeScript frontend, Node-stdlib server, no added
dependencies.

## 10. Installable PWA with offline read

Web app manifest (dark theme colors, standalone, SVG icon), installable with
no warnings; hand-rolled service worker precaching the shell and caching
last-synced data; offline shows a clear read-only banner, renders all
screens from cache, disables mutations with an explanation, and surfaces an
"Update available — reload" notice instead of silently swapping builds.

## 11. Quality bar

The Engineering UI Kit standard pack governs; these are named expectations:
collapsible primary navigation (compact monogram rail, persisted,
keyboard-accessible); structure from typography and hairline rules — bounded
panels only for tables, charts, rails, dialogs, and empty states; forms in
labeled groups with content-sized controls filling the working width; wizard
step indicator spanning the width; dense one-line table rows that never clip
or wrap values; slim stat rows, not dashboards; engineering charts with round
ticks, gridlines, legends, and keyboard crosshair readouts; status always
text-backed; loading/empty/error/offline states everywhere; mono tabular
figures for all numerics; complete keyboard operation with visible focus; the
planning-grade limitation banner always visible.

## Non-goals

No authentication, no multi-user sync, no real AFM/OEM data, no cloud, no
telemetry, no push, no background sync, no chart or component libraries.
