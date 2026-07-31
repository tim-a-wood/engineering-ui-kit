# Frontend design system research and validation

Date: 2026-07-31

## Outcome

The frontend design system is now a versioned generation contract. It is not a
prompt fragment or a sample-only theme.

The contract has these identifiers:

- Design contract: `EUIT-FRONTEND-001`
- Controlled writing profile: `EUIT-STE-001`
- Default palette: Gulfstream-inspired blue and white
- Default icon family: Lucide
- Required color modes: light, dark, and system

The app lets a user select the palette, font, start mode, density, and layout
before a frontend handoff. The compiler stores that choice in the frontend
brief. The implementation prompt receives the resolved rules. The overlay gate
then checks the generated source. A prompt is therefore not the only control.

## Ownership

| Layer | Responsibility |
|---|---|
| Design system | Define semantic tokens, typography, icon geometry, help behavior, layout archetypes, controlled copy, accessibility, and rejected visual patterns. |
| Frontend generation pipeline | Infer task-specific view kinds, resolve the selected theme and font, include the complete contract in the brief, and generate both color modes. |
| Capabilities system | Store the approved frontend design configuration with the module handoff. |
| Overlay review gate | Inspect the actual source and block missing modes, raw design drift, mixed icons, missing help, em dashes, and common generated-interface tropes. |
| Product UI | Let the user configure the result and show the resolved design before handoff. |

This split keeps policy in one contract and enforcement at each boundary where
the policy can drift.

## Research decisions

### Accessibility and help

The target remains WCAG 2.2 AA. WCAG 2.2 adds requirements for focus
visibility, target size, and consistent help. WAI guidance for hover and focus
content requires that users can dismiss, hover, and keep the content present.
The ARIA tooltip pattern associates a tooltip with its trigger and keeps focus
on the trigger.

Sources:

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Understanding consistent help](https://www.w3.org/WAI/WCAG22/Understanding/consistent-help)
- [Understanding content on hover or focus](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html)
- [WAI-ARIA tooltip pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/)
- [Primer tooltip accessibility](https://primer.style/product/components/tooltip/accessibility/)

Applied rules:

- Every icon-only control has an accessible name and a concise tooltip.
- Pointer hover and keyboard focus open a tooltip.
- Escape closes a tooltip.
- Required instructions do not exist only in a tooltip.
- A `circle-help` trigger or persistent helper text explains complex terms.
- Help stays in a consistent location in every generated shell.

### Clear language

W3C cognitive guidance recommends common words, short sentences, simple tense,
short blocks, and whitespace. ASD-STE100 Issue 9 supplies the controlled
technical-writing basis. The official ASD-STE100 FAQ also explains that
software cannot assess every rule and does not replace training or the
specification.

Sources:

- [W3C clear content objective](https://www.w3.org/WAI/WCAG2/supplemental/objectives/o3-clear-content/)
- [ASD-STE100 Issue 9](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf)
- [ASD-STE100 FAQ](https://www.asd-ste100.org/STE_faq.html)

Applied rules:

- The app UI, boilerplate prompts, generated labels, help, status text, errors,
  and empty states use `EUIT-STE-001`.
- The gate blocks em dashes in visible text.
- Prompts require short action-led labels and one term for one concept.
- The checker is an application writing-profile gate. It is not a claim of
  formal ASD-STE100 certification.

### Tokens, modes, and configuration

Fluent describes a two-level token model in which global values feed semantic
aliases. Style Dictionary provides a platform-neutral token architecture.
Primer and Radix provide proven day, night, and automatic theme patterns.
Carbon reinforces sentence case, concise helper text, and theme-aware
component behavior.

Sources:

- [Fluent design tokens](https://fluent2.microsoft.design/design-tokens)
- [Style Dictionary tokens](https://styledictionary.com/info/tokens/)
- [Primer theming](https://primer.style/product/getting-started/react/theming/)
- [Radix Themes dark mode](https://www.radix-ui.com/themes/docs/theme/dark-mode)
- [Radix Themes](https://github.com/radix-ui/themes)
- [Carbon themes](https://carbondesignsystem.com/elements/themes/overview/)
- [Carbon form style](https://carbondesignsystem.com/components/form/style/)

Applied rules:

- Global palette values resolve into semantic canvas, surface, text, border,
  accent, focus, success, warning, and danger tokens.
- Generated source uses semantic tokens instead of repeated raw colors.
- Every frontend contains light and dark tokens.
- The start mode can be system, light, or dark.
- The mode control stores the user choice in local storage.
- Palette, font, density, and layout are configurable per frontend.
- The current implementation keeps the contract dependency-light. A future
  multi-platform token exporter can use Style Dictionary without changing the
  semantic contract.

The default blue uses `#003767` as a practical Gulfstream-inspired value. A
secondary color reference lists that value but states that it is not an
official brand guideline. The product must not present it as certified
Gulfstream brand material.

Source:

- [Gulfstream Aerospace color reference](https://www.brandcolorcode.com/gulfstream-aerospace)

### Icons

Lucide supplies a large, consistent, open-source SVG icon set. Its standard
geometry uses a 24 pixel view box and a 2 pixel stroke.

Source:

- [Lucide](https://lucide.dev/)

Applied rules:

- Use Lucide as the only interface icon family.
- Use a `0 0 24 24` view box, 2 pixel stroke, and round caps and joins.
- Use stable sizes for inline, control, navigation, and feature icons.
- Keep one icon meaning for one action.
- Use text with primary and uncommon actions.
- Do not use emoji, ornamental sparkles, magic wands, or decorative icon tiles.

### Layout and visual fluency

Research on the aesthetic-usability effect found that perceived beauty affects
perceived usability. Processing-fluency research links easier perceptual
processing with positive aesthetic response. Progress-feedback research shows
that the presentation of progress affects perceived duration.

Sources:

- [What is beautiful is usable](https://cris.bgu.ac.il/en/publications/what-is-beautiful-is-usable-2/)
- [Processing fluency and aesthetic pleasure](https://doi.org/10.1207/S15327957PSPR0804_3)
- [Rethinking the progress bar](https://www.figlab.com/research/2010/faster-progress-bars)

Applied rules:

- Use a layout that follows the task. Do not force each product into a
  dashboard.
- Align panels, reduce decorative containers, and use a stable spacing rhythm.
- Use real state, progress, and action feedback. Do not use decorative
  gamification.
- Reserve accent for primary action, focus, selection, and technical state.
- Do not use accent strips on cards, tiles, panels, sections, summaries, wells,
  or callouts.
- Do not use glass effects, decorative gradients, sparkle motifs, pill walls,
  or vague promotional copy.
- Use a selection rail only on a control that is actually selected.

## Layout catalog

The contract defines ten task-oriented view kinds:

1. Workbench
2. Table
3. Form
4. Editor
5. Monitor
6. Board
7. Graph
8. Wizard
9. Case
10. Timeline

The generator can combine view kinds when the workflow needs more than one
working surface.

## Product proof

Ten different realistic systems were generated through the same contract.

| Product | Primary layout | Palette | Font | Start mode | Density |
|---|---|---|---|---|---|
| DO-178C Review Workbench | Review workbench | Gulfstream blue | Inter | System | Compact |
| Copilot Session Hub | Session board | Technical violet | Source Sans 3 | Dark | Comfortable |
| Technical Writing Desk | Document editor | Gulfstream blue | IBM Plex Sans | Light | Comfortable |
| Flight Test Telemetry | Live monitor | Graphite | Inter | Dark | Compact |
| Aircraft Trade Study | Analysis canvas | Deep teal | Source Sans 3 | System | Compact |
| HIL Campaign Orchestrator | Bench campaign | Flight amber | IBM Plex Sans | Dark | Compact |
| Supplier Intake Portal | Intake workflow | Gulfstream blue | Atkinson Hyperlegible | Light | Comfortable |
| Requirements Impact Workbench | Dependency graph | Technical violet | Inter | System | Compact |
| Avionics Load Manager | Release workflow | Flight amber | System UI | Dark | Compact |
| FRACAS Investigation | Reliability case | Deep teal | Atkinson Hyperlegible | System | Comfortable |

The generated sources have ten unique hashes. They cover ten layout families,
five palettes, five fonts, three start modes, and two densities.

## Browser proof

The automated browser walk captured these states for each product:

- Desktop light mode
- Desktop dark mode
- Desktop contextual help
- Phone workflow state after an interaction

This produced 40 screenshots and 20 browser checks. The checks verify:

- the design contract;
- one Lucide icon family;
- accessible icon-button names;
- tooltip association and Escape dismissal;
- contextual help;
- theme change and persistence;
- a real scenario action;
- horizontal overflow.

All automated checks pass. The first phone run found 23 to 43 pixels of
horizontal page overflow in every product. A shared toolbar minimum width
caused the defect. The shared responsive shell was corrected, and the second
run measured zero page overflow in all ten products.

The visual review also found residual decorative strips on the session board
and the FRACAS investigation. The shared CSS was corrected. The source gate was
expanded so the same patterns now fail future output.

The complete workspace build passes. The complete workspace test run has 1,579
passing tests and one existing todo. This includes 1,059 core tests, 374 GUI
tests, 96 runtime tests, and 50 example application tests. The standards
validator passes 58 files and 68 component records with no warning.

Evidence:

- [Browser validation data](./browser-validation.json)
- [DO-178C Review Workbench](./screenshots/01-do178-review-workbench-light.png)
- [Copilot Session Hub](./screenshots/04-copilot-session-hub-light.png)
- [Technical Writing Desk](./screenshots/07-technical-writing-desk-light.png)
- [Flight Test Telemetry](./screenshots/10-flight-test-telemetry-light.png)
- [Aircraft Trade Study](./screenshots/13-aircraft-trade-study-light.png)
- [HIL Campaign Orchestrator](./screenshots/16-hil-campaign-orchestrator-light.png)
- [Supplier Intake Portal](./screenshots/19-supplier-intake-portal-light.png)
- [Requirements Impact Workbench](./screenshots/22-requirements-impact-workbench-light.png)
- [Avionics Load Manager](./screenshots/25-avionics-load-manager-light.png)
- [FRACAS Investigation](./screenshots/28-fracas-investigation-light.png)
- [Copilot Session Hub on phone](./screenshots/32-copilot-session-hub-phone.png)

## Platform caveat

The samples are static HTML, CSS, and JavaScript with no runtime dependency.
They can open from a local file. Chromium desktop and phone proof passes.

An actual Safari UI pass is not recorded. The macOS computer was locked during
the Safari check, and the local Playwright WebKit runtime did not complete page
creation. This report does not claim that Safari was visually verified.
