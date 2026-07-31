# Visual outcome redesign

Date: 2026-07-31

## Finding

The first design-system pass improved compliance but did not materially improve
the generated outcome. Every product still used the same shell, title block,
page action rack, pale panel treatment, small type, and reward toast. The
product-specific content could not overcome the repeated visual grammar.

## System correction

The `EUIT-FRONTEND-001` contract now controls four composition decisions for
each view kind:

1. Navigation model
2. Header style
3. Action placement
4. Surface model

The generation prompt now requires task-specific shells. It also limits each
view to one primary page action and no more than two secondary page actions.
Other actions stay in a labeled command menu or beside the selected object.
Normal interface text must use a size of at least 13 pixels. Text from 10 to 12
pixels is for short metadata.

These decisions follow established system guidance:

- [Primer foundations](https://primer.style/product/getting-started/foundations/)
  treats layout, typography, color, icons, and responsive behavior as connected
  foundations.
- [Primer navigation](https://primer.style/product/ui-patterns/navigation/)
  puts navigation close to the content that it affects and moves narrow-screen
  options into menus.
- [Material canonical layouts](https://m3.material.io/foundations/layout/canonical-examples/overview)
  uses different feed, list-detail, and supporting-pane models across
  breakpoints.
- [Carbon common actions](https://carbondesignsystem.com/patterns/common-actions/)
  uses one high-emphasis action and secondary emphasis for other actions.
- [Fluent navigation](https://fluent2.microsoft.design/components/web/react/core/nav/usage)
  recommends brief navigation, plain language, and overflow for excess
  secondary actions.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) supplies the accessibility target
  for focus, labels, help, and pointer targets.

## Visual corrections

- Replaced the repeated light sidebar with a restrained branded navigation
  surface.
- Added ten shell modes: review, sessions, editor, instrument, analysis,
  control, portal, graph, secure, and case.
- Removed the universal reward toast and progress treatment.
- Replaced the eight-button page action rack with contextual actions and a
  labeled command menu.
- Increased interface, table, panel, navigation, and measure text.
- Removed decorative side strips, blurred brand decoration, and random
  selection rails.
- Added semantic Lucide icons to navigation.
- Corrected dark technical rails in telemetry, HIL, and impact views.
- Kept the document page light in dark mode to preserve the authored-paper
  model.
- Added a real mobile navigation drawer and separate workspace and open-menu
  evidence.

## Proof

The stress set contains ten products, ten layout identities, ten shell modes,
five palettes, five fonts, three start modes, and two densities. Each product
has a unique rendered source hash.

The source validator reports:

- 10 of 10 distinct composition identities
- 10 of 10 distinct shell modes
- 1 to 3 visible page actions per product
- All actions available from the command menu
- No generic reward UI
- No blocking or warning findings

The browser matrix includes desktop light, desktop dark, desktop help, phone
workspace, and phone navigation states for each product. It produced 50
screenshots and 20 browser interaction records. All checks pass with no
horizontal page overflow.

Evidence:

- [Source validation](./source-validation.json)
- [Browser validation](./browser-validation.json)
- [DO-178C review workbench](./screenshots/01-do178-review-workbench-light.png)
- [Copilot session board](./screenshots/04-copilot-session-hub-light.png)
- [Technical writing editor](./screenshots/07-technical-writing-desk-light.png)
- [Flight-test monitor](./screenshots/10-flight-test-telemetry-light.png)
- [Aircraft trade study](./screenshots/13-aircraft-trade-study-light.png)
- [HIL control room](./screenshots/16-hil-campaign-orchestrator-light.png)
- [Supplier intake flow](./screenshots/19-supplier-intake-portal-light.png)
- [Requirements impact graph](./screenshots/22-requirements-impact-workbench-light.png)
- [Avionics load workflow](./screenshots/25-avionics-load-manager-light.png)
- [FRACAS case workspace](./screenshots/28-fracas-investigation-light.png)
- [Copilot phone workspace](./screenshots/33-copilot-session-hub-phone.png)
- [Copilot phone navigation](./screenshots/34-copilot-session-hub-phone-menu.png)

## Platform caveat

The generated products use static HTML, CSS, and JavaScript and have no runtime
dependency. Chromium desktop and phone checks pass. An interactive Safari
environment was not available, so this report does not claim a Safari visual
pass.
