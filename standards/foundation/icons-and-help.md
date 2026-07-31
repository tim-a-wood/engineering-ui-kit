# Icons and help

## Purpose

This standard defines icon geometry, icon meaning, tooltips, and contextual help.

## FND-ICON-001: Use one icon family

Use Lucide as the default icon family. Lucide uses the ISC license. Do not mix icon families in one frontend.

## FND-ICON-002: Use stable geometry

Use the `0 0 24 24` view box. Use a 2 pixel stroke. Use round line caps and round line joins.

Use these display sizes:

- 16 pixels for inline status.
- 18 pixels for controls.
- 20 pixels for navigation.
- 24 pixels for a feature icon.

Do not use emoji as interface icons. Do not put a page icon in a decorative tile.

## FND-ICON-003: Keep one meaning

Use the same icon for the same action. Do not use one icon for different actions in the same frontend.

Use text with primary actions and uncommon actions. Use an icon-only control only when the action is familiar and space is limited.

## FND-HELP-001: Label icon controls

Give each icon-only control an accessible name. Give each icon-only control a short tooltip.

Show the tooltip when the trigger receives pointer hover or keyboard focus. Let the Escape key close it. Keep focus on the trigger.

## FND-HELP-002: Keep required help visible

Do not put required instructions only in a tooltip. Use persistent helper text for required formats, limits, and task steps.

## FND-HELP-003: Provide contextual help

Put a `circle-help` icon next to complex domain terms when a short explanation is useful. Give the trigger an accessible name.

Use a tooltip for short nonessential text. Use a disclosure or dialog when the help contains actions, links, or detailed content.

## FND-COPY-001: Apply controlled language

Apply the Engineering UI Kit writing profile to labels, tooltips, help, status text, empty states, and error messages.

Do not use an em dash. Do not use vague promotional text. Use one term for one concept.

## Review checks

- One icon family is present.
- Icon geometry matches the standard.
- Each icon-only control has an accessible name and tooltip.
- Complex terms have persistent help or an accessible help trigger.
- Required instructions remain visible.
- Tooltips work with a pointer and a keyboard.
- Visible copy passes the STE gate.
