# Visual refinement 2

Date: 2026-07-31

## Outcome

This pass removes repeated template signals and makes feedback, icons, navigation, and list structure fit the work. The generator produced ten product types with ten compositions, five palettes, five font profiles, two density levels, and three start modes. Source validation found no blocker or warning. Chromium desktop and phone checks passed with no horizontal overflow.

## Problems found

| Priority | Problem | Resolution |
|---|---|---|
| High | A generic plus or arrow represented unrelated commands. | The shared renderer now selects an icon from the action verb. The validation set must contain at least five primary icon meanings. |
| High | Routine success appeared as a fixed toast, far from the command. | Runtime feedback now moves into the action region and uses a status role. Grid action regions give feedback a full row. |
| Medium | Every panel advertised an overflow menu, including panels with no commands. | Panel menus are opt-in. The ten products no longer show generic panel menus. |
| Medium | Repeated rounded rows made review and intake views look generated. | Review checks, writing checks, comments, and supplier intake use hairline rows. Selection alone receives a quiet surface. |
| Medium | Navigation had one dark treatment in almost every product. | Document and portal work use light or quiet navigation. Live control and technical investigation work keep dark rails. |
| Low | User and status chrome competed with work. | User chips, confirmation text, and secondary chrome now have lower contrast and less decoration. |

## System rules added

- Match each action icon to its verb. Do not reuse a generic icon for unrelated commands.
- Confirm routine success beside the action or object that changed.
- Do not cover work with a fixed success toast.
- Add a panel overflow menu only when the panel has real secondary commands.
- Use panels only for bounded tools. Use spacing and hairline rules for ordinary groups.

These rules exist in the core generation prompt, desktop standards template, visual-language standard, application-shell standard, and product-trial validator.

## Evidence

- [Source validation](source-validation.json)
- [Browser validation](browser-validation.json)
- [All screenshots](screenshots/)
- [DO-178C review workbench](screenshots/01-do178-review-workbench-light.png)
- [Copilot session hub](screenshots/04-copilot-session-hub-light.png)
- [Technical writing desk](screenshots/07-technical-writing-desk-light.png)
- [Flight-test telemetry](screenshots/10-flight-test-telemetry-light.png)
- [Aircraft trade study](screenshots/13-aircraft-trade-study-light.png)
- [HIL campaign orchestrator](screenshots/16-hil-campaign-orchestrator-light.png)
- [Supplier intake portal](screenshots/19-supplier-intake-portal-light.png)
- [Requirements impact workbench](screenshots/22-requirements-impact-workbench-light.png)
- [Avionics load manager](screenshots/25-avionics-load-manager-light.png)
- [FRACAS investigation](screenshots/28-fracas-investigation-light.png)

## Verification boundary

The automated run used Chromium at 1440 by 1000 and a Chromium phone viewport at 390 by 844. It checked theme changes, help, keyboard tooltip dismissal, a real scenario action, and horizontal overflow for each product. The files have no runtime dependency and can open as static HTML. Safari was not executed because the interactive browser environment was not available.
