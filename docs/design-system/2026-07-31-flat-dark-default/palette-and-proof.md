# Flat dark theme proof

## Decision

The default dark theme uses two background values.

| Role | Value | Use |
| --- | --- | --- |
| Canvas | `#080d14` | Page, navigation, and workspace background |
| Component surface | `#111923` | Panels, cards, raised regions, and soft regions |
| Border | `#263344` | Component separation |
| Text | `#f4f6f8` | Primary content |
| Accent | `#70a0cf` | Actions, focus, selection, and data emphasis |

The theme does not use extra surface tiers, blue panel bands, glow effects, or decorative gradients. The same flat-surface rule applies to each configurable palette. Light mode uses one white component surface over its canvas.

## System enforcement

- The frontend design contract defines the two background values.
- The generation prompts prohibit extra background tiers.
- The source validator rejects a palette when its component surfaces differ.
- The browser validator checks the computed values in each generated product.
- The unit tests protect the rule for all five built-in palettes.

## Validation result

- Products: 10
- Layouts: 10
- Built-in palettes: 5
- Desktop and phone browser checks: 20
- Screenshots: 50
- Horizontal overflow findings: 0
- Browser failures: 0
- Source validation findings: 0

## Default dark contrast

| Pair | Ratio |
| --- | ---: |
| Primary text on canvas | 17.98:1 |
| Muted text on surface | 9.63:1 |
| Quiet text on surface | 5.75:1 |
| Strong border on surface | 3.30:1 |
| Accent on canvas | 7.07:1 |

See `source-validation.json`, `browser-validation.json`, and the `screenshots` directory for the recorded evidence.
