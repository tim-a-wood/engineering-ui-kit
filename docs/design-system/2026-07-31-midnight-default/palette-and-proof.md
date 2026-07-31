# Midnight default palette

Date: 2026-07-31

## Decision

The design system no longer uses a company-specific blue as its default. The default palette is now Midnight blue. Generated applications start in dark mode. Users can select light mode and the application stores their choice.

The dark theme uses a deep navy canvas, adjacent navy surfaces, light text, and a clear blue accent. This keeps the interface dark without making every surface black or using one flat blue field.

## Default tokens

| Role | Dark mode | Light mode |
| --- | --- | --- |
| Canvas | `#0b1628` | `#f6f8fa` |
| Surface | `#10213a` | `#ffffff` |
| Subtle surface | `#142943` | `#eef2f6` |
| Raised surface | `#19314f` | `#ffffff` |
| Main text | `#f7f9fc` | `#182536` |
| Muted text | `#c5d0de` | `#536579` |
| Quiet text | `#9aacc0` | `#6b7d90` |
| Border | `#334b69` | `#cbd5e1` |
| Strong border | `#5e7899` | `#8da0b5` |
| Accent | `#78b7ff` | `#145ea8` |
| Accent text | `#0b1628` | `#ffffff` |
| Focus | `#9acaff` | `#1f6feb` |

## Contrast gates

| Check | Result | Required |
| --- | ---: | ---: |
| Main text on canvas | 17.17:1 | 7:1 project target |
| Muted text on surface | 10.34:1 | 4.5:1 |
| Quiet text on surface | 6.95:1 | 4.5:1 |
| Strong border on surface | 3.55:1 | 3:1 |
| Accent on canvas | 8.64:1 | 7:1 project target |

The source validator and the core unit test enforce these limits.

## Product proof

- Ten generated products use Midnight blue by default.
- All ten products start in dark mode.
- Each product retains a light-mode toggle.
- Five palettes and five font choices remain configurable.
- The browser run produced 50 screenshots.
- Desktop and phone checks found no horizontal overflow.
- Tooltip dismissal, contextual help, and product actions passed.
- The browser report contains no failures.

The visual pass also removed border-colored gutters from the telemetry, HIL, and impact layouts. Empty canvas areas now use the dark canvas token.

## Evidence

- [Browser validation](browser-validation.json)
- [Source validation](source-validation.json)
- [All screenshots](screenshots/)
- [DO-178 review](screenshots/02-do178-review-workbench-dark.png)
- [Flight-test telemetry](screenshots/11-flight-test-telemetry-dark.png)
- [Requirements impact](screenshots/23-requirements-impact-workbench-dark.png)
- [Copilot sessions on phone](screenshots/33-copilot-session-hub-phone.png)
