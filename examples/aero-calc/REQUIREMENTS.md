# AeroCalc — aircraft performance planning workbench (requirements)

We are a flight-operations engineering group. Before every charter quote and
every hot-and-high airfield study we estimate takeoff and landing performance
for our three aircraft types. Today that lives in a spreadsheet with macros
nobody trusts. We want one small installable web app — one deployable on a
local ops PC — that computes **planning-grade** performance cases, keeps its
own records, and works at airfields where the Wi-Fi doesn't.

Everything is planning/demo-grade: we supply no approved AFM/OEM tables, and
the app must say so on every screen that shows results. Nothing it produces
may be presented as approved performance data.

## 1. Case calculator

A performance case takes these inputs, validated exactly as stated (client
side and again by the API):

| Input | Type / range | Notes |
|---|---|---|
| Case label | text, required, ≤ 80 chars | unique per saved case |
| Operation | takeoff / landing | |
| Aircraft variant | GL-350 / GL-500 / GL-650 | fixed fleet |
| Runway | from the runway library (req. 5) | |
| Runway length | 1,000–20,000 ft, whole ft | prefilled from the library, editable |
| Pressure altitude | −1,000–14,000 ft | |
| Outside air temp | −40–55 °C | |
| Aircraft weight | 30,000–90,000 lb, whole lb | also bounded by variant min/max |
| Wind component | −30–+50 kt | headwind positive, tailwind negative |
| Runway condition | dry / wet | |
| Flap setting | 10 / 15 / 20 | |
| Notes | optional text | review context |

Outputs, all shown together after calculation: takeoff distance required,
accelerate-stop distance, landing distance, **required runway**, **runway
margin** (available − required), climb gradient (%), approach speed (kt),
max allowable weight for the given runway, the **limiting factor** (which
constraint binds), and the calculation basis (assumptions text). Status
classifies the case: **within-limits**, **caution** (margin < 1,000 ft or
climb gradient within 0.3 % of minimum), **out-of-limits** (negative margin
or below-minimum gradient), and status must always be carried in text.

Calculate is explicit: inputs → **Review calculation** (outputs shown, not
yet saved) → **Save case**. No silent saves; editing a saved case follows
the same review-before-save flow.

## 2. Weight sweeps

From any valid set of inputs, generate a family of cases varying weight only:
start, end, step (all validated; ≤ 25 cases per sweep with a live count
before generating). Sweep members are labeled as one family
(`<label> · sweep <weight> lb`) and are first-class saved cases.

## 3. Saved cases

A registry of every saved case with two synchronized views:

- **Table** — dense data table: case, configuration, key inputs, required
  runway, margin, status, edit action. Sortable by margin and by updated
  time; filterable by variant, operation, and status; text search over label
  and runway. Numerics right-aligned in tabular figures.
- **XY chart** — required runway vs aircraft weight. Sweep families plot as
  weight-sorted line series; standalone cases as scatter points; round-number
  axis ticks with gridlines; legend and units in the chart header; crosshair
  with pointer *and* keyboard readout of exact values; a compact synced case
  table beside the chart as the text alternative, both panels sharing edges.

## 4. Dashboard

The landing page answers: is any case out of limits, what needs review, and
what is our thinnest margin? One instrument strip (out-of-limits count,
caution count, minimum margin with its case, fleet weight-limited case
count), then a **priority review table** — worst cases first by status then
margin — linking straight into each case. No decorative tiles.

## 5. Runway library

A small managed list used by the calculator: runway id (e.g. `KSVN RWY 10`),
length (ft), elevation (ft), notes. Create/edit with validation (unique id,
length 1,000–20,000 ft); deleting is not required. Seed with six realistic
entries including at least one short field and one hot-and-high field.

## 6. Persistence and API

All data (cases, runways) lives in JSON files on the server, surviving
restart. The frontend talks only to a small typed JSON API. Seed on first
run: the six runways plus ~14 cases — two sweep families (one 4-point, one
5-point) and five standalone cases, statuses mixed so every screen and both
chart series kinds are populated immediately.

## 7. One deployable

`npm run build` then `npm start` serves UI, API, and data on one port —
`process.env.PORT` or 4180. `npm run typecheck` and `npm run build` must
pass. React + Vite + TypeScript frontend, Node-stdlib server, shared types
in one module. No added dependencies.

## 8. Installable PWA with offline read

- Web app manifest: name, dark theme/background colors, standalone display,
  an SVG icon — installable from Chrome/Edge with no manifest warnings.
- A hand-rolled service worker (no libraries): precache the built app shell;
  cache the latest case/runway data as it is fetched.
- Offline: the app opens, shows a clear **"Offline — showing last-synced
  data (read-only)"** banner, renders dashboard/saved cases/chart from
  cached data, and disables mutating actions with an explanatory state
  (never a silent failure). Calculator submissions while offline are
  rejected with a readable message — no queuing.
- When a new build is deployed, the app shows an unobtrusive "Update
  available — reload" notice rather than silently swapping mid-session.

## 9. Quality bar

Dark-first engineering tool on the semantic token set. Record lists are
data tables, never card stacks. Sibling panels share edges, padding, and
rhythm; nothing may be clipped by its container. Complete keyboard
operation with visible focus; status always text-backed; loading, empty,
error, and offline states for every remote region; mono tabular numerals
for all figures; the planning-grade limitation banner is always visible.

## Non-goals

No authentication, no multi-user sync, no real AFM/OEM data, no cloud
services, no telemetry, no push notifications, no background sync.
