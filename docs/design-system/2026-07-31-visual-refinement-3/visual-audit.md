# Frontend generation audit

## Outcome

The generator now applies one clear default color rule:

- Light mode uses white as the dominant color.
- Dark mode uses Gulfstream blue as the dominant color.
- Each project can select an approved palette and font before generation.
- Each generated frontend stores the selected palette and font in its project record.

The generator no longer adds a metric strip to each view. Five trial products have
no metric surface. The other five products state the decision purpose for each
measure group.

## Root causes

The prior Gulfstream dark palette used a near-black navy canvas. The product trial
also selected a different palette for each product. These choices hid the intended
Gulfstream identity.

One STE prompt applied VERB + OBJECT grammar to all names. This rule made some page
titles sound like status counters. The rule now applies only to actions, use cases,
activity steps, and sequence messages.

The prior renderer expected a measure array for each product. This design made a
dashboard strip the default. The renderer now requires an explicit decision purpose
before it shows a measure surface.

## System controls

- The core palette contract defines the full light and dark surface system.
- The frontend prompt states the color dominance rule.
- The frontend prompt blocks invented KPIs, scores, trends, and counts.
- The source evaluator blocks count-led H1 and H2 text.
- The source evaluator blocks a metric surface without `data-metric-purpose`.
- The product trial validates all five approved palette configurations.
- The product trial validates the ten generated products against the default
  Gulfstream palette.
- The application setup view shows both light and dark palette previews.

## Rendered proof

The trial generated 50 screenshots for ten different products. It captured light,
dark, help, phone, and phone-navigation states. Chromium reported no page errors and
no horizontal page overflow.

Pixel inspection confirms the intended dominance:

- Light screenshots contain 65.3 to 91.4 percent near-white pixels.
- Nine dark screenshots contain 97.1 to 98.3 percent Gulfstream-blue pixels.
- The dark writing view contains 74.4 percent Gulfstream-blue pixels because its
  document page stays white for a paper editing context.

The capture tool now waits for two render frames after a mode change. This check
prevents a saved screenshot from showing the old mode after the token state changes.

## Measure decisions

The following products have no metric surface:

- Copilot Sessions
- Technical Writing
- Aircraft Trade Study
- Supplier Deliveries
- Software Load Control

The following products retain measures because the measures support a current
decision:

- DO-178C Review Workbench: review readiness and independence
- Flight Test Telemetry: data health and triage scope
- HIL Test Campaign: campaign progress, bench state, and remaining time
- Requirement Change Impact: change scope for planning and approval
- FRACAS Investigations: reliability risk and case priority

## Evidence

- `source-validation.json` contains the source and generation gate results.
- `browser-validation.json` contains the desktop and phone interaction results.
- `screenshots/` contains the rendered evidence.
