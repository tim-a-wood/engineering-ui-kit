# Gulfstream palette research and audit

Date: 2026-07-31

## Result

The default theme now uses `#003767` as Gulfstream blue. Dark mode uses this color as the main canvas. White is the main text color and the primary interaction highlight. Light mode uses white as the main canvas and Gulfstream blue for actions, focus, and selected states.

The previous theme did not meet this intent. It used `#002846` for the canvas and used a bright cyan-blue accent. The adjacent surfaces also moved too far from the Gulfstream hue. This made the theme look like a generic blue product theme.

## Research basis

The [Gulfstream Aerospace site](https://www.gulfstream.com/en/) is the visual reference for the company identity. Gulfstream does not publish a public digital brand guide with hexadecimal values on that site. Three independent logo references identify `#003767` as the Gulfstream Aerospace logo blue:

- [BrandColorCode](https://www.brandcolorcode.com/gulfstream-aerospace) lists `#003767` and RGB `0, 55, 103`.
- [Encycolorpedia](https://encycolorpedia.com/companies/us/gulfstream-aerospace) lists `#003767`.
- [Logoneate](https://logoneate.com/gulfstream-aerospace/) lists `#003767` for the SVG logo.

The implementation uses the value on which these sources agree. It does not claim access to a private Gulfstream identity standard.

[WCAG 2.2 contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) sets a minimum ratio of 4.5:1 for normal text. [WCAG non-text contrast guidance](https://www.w3.org/WAI/WCAG22/understanding/non-text-contrast.html) sets a 3:1 target for meaningful interface boundaries and states. The [Carbon color system](https://carbondesignsystem.com/elements/color/overview/) also supports the use of adjacent semantic layers. The new dark surfaces remain close to the Gulfstream hue instead of using unrelated blue panels.

## Approved tokens

| Role | Light mode | Dark mode |
| --- | --- | --- |
| Canvas | `#f5f8fa` | `#003767` |
| Surface | `#ffffff` | `#063c6b` |
| Subtle surface | `#edf3f6` | `#0d416f` |
| Raised surface | `#ffffff` | `#144773` |
| Main text | `#102536` | `#ffffff` |
| Muted text | `#526978` | `#d8e1e9` |
| Quiet text | `#6d808c` | `#b3c3d0` |
| Strong border | `#8da2ae` | `#809bb3` |
| Primary accent | `#003767` | `#ffffff` |
| Accent text | `#ffffff` | `#003767` |
| Focus | `#003767` | `#ffffff` |

## Automated contrast gates

| Check | Result | Required |
| --- | ---: | ---: |
| White text on Gulfstream canvas | 12.05:1 | 7:1 project target |
| Muted text on dark surface | 8.50:1 | 4.5:1 |
| Quiet text on dark surface | 6.23:1 | 4.5:1 |
| Strong border on dark surface | 3.89:1 | 3:1 |
| White accent on Gulfstream canvas | 12.05:1 | 7:1 project target |

The source validator now rejects a change that breaks the exact default colors or these contrast limits. The core unit test applies the same checks to the design-system contract.

## Product proof

The generator rebuilt ten products with ten distinct view compositions. Every product uses the Gulfstream palette by default. Each product still supports five configurable palettes, five font choices, and light, dark, or system start modes.

The browser run produced 50 screenshots:

- 30 desktop screenshots across light, dark, and help states.
- 20 phone screenshots across workspace and open-navigation states.
- 20 interactive viewport checks with no horizontal overflow.
- Tooltip dismissal, contextual help, and a product action passed in each desktop product.
- Contextual help and a product action passed in each phone product.

The browser report has no failures. The static products have no runtime dependency, so a user can open each generated `index.html` file directly in Safari. The automated image run used Chromium because Safari automation was not available in the test environment.

## Evidence

- [Browser validation](browser-validation.json)
- [Source validation](source-validation.json)
- [All screenshots](screenshots/)
- [DO-178 review, dark mode](screenshots/02-do178-review-workbench-dark.png)
- [Flight-test telemetry, dark mode](screenshots/11-flight-test-telemetry-dark.png)
- [Copilot session hub, phone](screenshots/33-copilot-session-hub-phone.png)
