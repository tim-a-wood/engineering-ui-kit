# Styling and Theming Architecture

## Purpose

Define how implementations consume semantic tokens, preserve dual-mode quality, and
avoid visual drift during the vertical-slice trial and later Engineering UI Kit work.

## Scope

This standard covers semantic tokens as CSS custom properties, token layering, the
global token entry point, component style consumption, raw-color restrictions, focus,
status, density, and reduced-motion handling.

It defines light and dark mode behavior. It does not require one frontend framework.

## Controlling Decisions

- Light and dark modes are part of the implementation contract.
- Dark mode is the default start mode.
- The default palette uses a deep navy canvas, adjacent navy surfaces, light text, and a clear blue accent.
- Light mode uses white surfaces and a dark-blue accent.
- Each frontend can select another approved palette and font.
- `standards/tokens.json` is the token source of truth.
- The Phase 1 baseline app intentionally uses plain system styling so Phase 3 can
  measure standards-driven transformation.
- Transformed trial output must consume semantic tokens rather than hard-coded brand
  colors.

## Required Architecture

### ARCH-THEME-001: Semantic tokens as CSS custom properties

Map semantic token leaves from `tokens.json` to CSS custom properties. Component and
page styles shall reference those variables, not primitive palette literals, except
inside the single token entry point.

### ARCH-THEME-002: Primitive-to-semantic-to-component layering

Preserve three layers:

1. primitive values owned by the token contract;
2. semantic aliases such as surface, text, border, accent, status, and focus;
3. component styles that consume only semantic variables.

Do not skip the semantic layer by wiring components directly to primitives.

### ARCH-THEME-003: One global token entry point

Introduce one global stylesheet or module that defines the semantic CSS variables for
the app. Trial transformation should add or replace that entry point rather than
scattering token declarations across unrelated files.

### ARCH-THEME-004: Components consume semantic variables

Buttons, panels, navigation, workflow markers, status regions, and dialogs shall use
semantic variables for color, border, spacing density, and focus treatment.

### ARCH-THEME-005: Raw color restrictions

Raw hex, `rgb()`, or named colors outside the token entry point are review findings
unless they are part of a documented visualization scale that cannot yet be expressed
as a semantic token. Baseline plain styling is allowed only before the transformation
trial.

### ARCH-THEME-006: Focus, status, density, and reduced motion

- Focus indicators must remain visible and must not rely on color alone.
- Status and validation must include text or iconography in addition to color.
- Density should favor readable engineering workbench spacing over marketing sparsity.
- Honor `prefers-reduced-motion` by avoiding non-essential animation.

### ARCH-THEME-007: Mode control

Provide a labeled mode button. Use the system mode before the user selects a mode.
Store the user choice. Apply the mode before the first paint when possible.

## Allowed Patterns

- CSS custom properties sourced from semantic tokens.
- Component classes that reference `var(--...)` semantic names.
- Minimal baseline CSS in the pre-trial disposable app.
- Explicit focus and status styles that meet accessibility expectations.

## Prohibited Patterns

- Generic SaaS white-card dashboards as the transformed target.
- Neon accents, glow effects, or decorative gradients not supported by standards.
- Hard-coded colors in component files after transformation.
- A frontend that supports only one color mode.
- Treating approved mockups as an excuse to invent untokenized colors.

## Trial Application

- The transformation target uses both mode token sets and the selected font.
- The layout follows the task-specific recipe and applicable `FND-VIS-*` rules.
- Expected style changes are limited to presentation files listed in the task packet.

## Validation Checks

- Transformed styles reference semantic variables.
- Light and dark modes pass the same checks.
- The mode button works with a pointer and a keyboard.
- Focus and status remain perceivable without color alone.
- Visual drift checklist findings are recorded against acceptance criteria.

## Traceability

- Tokens: `standards/tokens.json`, `foundation/tokens.md`, `FND-TOK-*`.
- Visual language: `foundation/visual-language.md`, `FND-VIS-*`.
- Validation: `validation/visual-drift-checklist.md`, `validation/ui-compliance-rubric.md`.
- Trial acceptance criteria: `TRIAL-AC-004`, `TRIAL-AC-008`, `TRIAL-AC-011`,
  `TRIAL-AC-012`, `TRIAL-AC-013`.
