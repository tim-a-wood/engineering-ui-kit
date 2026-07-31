# Visual Language

## Purpose

This file defines the visual standard for Engineering UI Kit screens.

## Scope

The guidance applies to app shells, panels, forms, tables, charts, overlays, and validation workflows. It does not define a brand campaign or public website.

## Visual Direction Summary

The visual language is a modern enterprise workbench. It is restrained, structured, technical, and polished. A neutral graphite dark theme with blue actions is the default.

## FND-VIS-001: Dual-mode surface hierarchy

Use semantic surface tokens to create hierarchy. Keep equal visual quality in light and dark modes. Start in dark mode unless a project selects another start mode. The default dark mode shall use a neutral graphite canvas and one standard component surface. Use a separate overlay surface only for menus, popovers, and dialogs. Do not add blue panel bands or decorative gradients. The light mode shall use a neutral canvas and white as the dominant component surface. A project can select another approved accent before generation. The selected accent shall not recolor the application foundation.

## FND-VIS-002: Restrained technical accent usage

Use the accent foreground for links, icons, and important data. Use the action fill for one primary action in a task region. Use the muted accent surface for selected state. Navigation shall use neutral surfaces by default. Do not use accent glow.

## FND-VIS-003: Surface and containment discipline

The canvas shall remain visually quiet. Each view shall have one dominant work surface. Structural panes shall use the canvas, spacing, alignment, and hairline dividers. They shall not look like floating cards. Panels are reserved for genuinely bounded objects, tools, previews, forms, or consequential review regions; they shall not wrap every section, row, empty state, or navigation choice. Raised surfaces are reserved for overlays and temporary emphasis. Inset surfaces are for documents, code, logs, file-drop targets, preview chrome, or technical data nested inside a work surface.

## FND-VIS-004: Typography posture

Typography shall prioritize scanability and technical precision. Use semantic typography tokens, short headings, stable artifact names, and monospaced treatment for code, paths, commands, and IDs.

## FND-VIS-005: Density and spacing posture

Compact density is allowed when content remains readable. Use `semantic.density.compact.*` and `semantic.spacing.*` tokens instead of arbitrary compression. Primary workflow regions should have enough padding to distinguish them from nested technical content.

## FND-VIS-006: Borders, elevation, and glow

Borders shall define hierarchy more often than heavy shadows. `semantic.border.subtle` is the default; `semantic.border.strong` is reserved for selected, active, or high-emphasis boundaries. Elevation shall identify overlays, not decorate routine panels.

## FND-VIS-007: Tables and technical data tone

Tables shall be dense, aligned, and legible. Header rows, status columns, paths, timestamps, and action columns shall be visually predictable. Decorative table striping or oversized rows that reduce engineering density should be avoided.

## FND-VIS-008: Charts and analytic surfaces

Charts shall sit in a named analysis region with a title, scope, units, time range or data source, and state. The analysis region can be the primary work surface and does not need a card around it. Gridlines, axes, thresholds, and legends shall use chart semantic tokens and shall not compete with status colors.

## FND-VIS-009: Status and severity color discipline

Status colors shall be used with text labels and icons or shapes where useful. Pass/fail, warning, blocked, and running states shall not rely on color alone, and screens shall avoid traffic-light noise from excessive severity badges.

## FND-VIS-010: What visual drift looks like

Drift includes card walls, accent-strip tiles, arbitrary gradients, glass effects, ornamental sparkles, large marketing text, vague copy, mixed icons, and raw colors.

## FND-VIS-011: Quiet workspace composition

Landing views and project choosers should resemble a native workbench rather than a dashboard: concise page header, generous canvas, one obvious primary action, and full-row navigation separated by hairlines. Avoid summary cards that merely repeat destinations or workflow stages already available elsewhere.

## FND-VIS-012: Integrated page identity

Major workflow pages may pair the title with one unboxed semantic icon. The icon shall sit directly in the title bar without a card, tile, glow, or decorative container. A short text-and-arrow transition may appear opposite the title when moving between two closely related modes.

## FND-VIS-013: Task-specific composition

The task shall control the application shell. Select the navigation model, header style, action placement, and surface model from the work that the user must do. A document editor, live monitor, guided intake flow, relationship graph, and case workspace shall not use one interchangeable dashboard shell.

## FND-VIS-014: Restrained page actions

Show one primary page action and no more than two secondary page actions. Put the remaining actions in a labeled command menu or next to the selected object. Do not put the complete action catalog in the page header.

## FND-VIS-015: Readable working text

Use text of 13 pixels or larger for normal interface content. Reserve text from 10 to 12 pixels for short metadata. Do not compress labels, table content, or instructions to create artificial density.

## FND-VIS-016: Semantic commands and local feedback

Match each action icon to its verb and keep that meaning stable. Do not reuse a generic plus or arrow for unrelated actions. Confirm a routine completed action beside the action or object that changed. Do not cover the workspace with a fixed success toast. Add a panel overflow menu only when that panel has real secondary commands.

## FND-VIS-017: Natural titles and justified measures

Use a short natural noun phrase for an application name. Use a short task label or object name for a page title. Do not start a page title with a count or turn a status count into a dramatic headline. Do not invent a metric, KPI, score, trend, or count. Add a measure only when it changes a decision in the current task, and state that purpose in the design specification. Put the measure beside the work that it explains.

## FND-VIS-018: Deterministic workspace hierarchy

Each page shall have exactly one visible level-one title. The page title shall be larger than its context label and summary. A section title shall be larger than its description. Each layout recipe shall define one primary region, explicit supporting-region positions, and a narrow-width order. Do not position regions only to fill available space. The task sequence and selection context shall determine placement.

## FND-VIS-019: One icon meaning

Use one icon for one semantic action. Different visible actions in the same command group shall not reuse an icon only because the icon is convenient. Use a literal action or object metaphor. Reuse an icon only when the action has the same meaning. Every icon-only control shall have an accessible name and a tooltip.

## Approved Visual Patterns

| Pattern | Rule |
|---|---|
| Dark canvas with one dominant work surface | Use flat structural panes and hairline dividers. |
| Subtle accent around active navigation or focus | Use accent/focus tokens only. |
| Compact table with clear status text | Use density and status tokens. |
| Inset log/code region inside a panel | Use code and inset surface tokens. |
| Hairline-divided decision facts | Related facts sit beside the work that they explain, with tabular or monospaced numerals where alignment matters. |
| Plot drawn on the panel surface | Series draw directly on the panel with recessive gridlines: no boxed inset chart region; a crosshair plus text readout carries exact values. |
| Machined segmented controls | Window/filter switchers use an inset track whose active segment is raised to the panel-raised surface, not an accent-tinted pill. |
| Status as dot plus text | Routine statuses render as a status-token dot beside plain text; tinted pills are reserved for a few prominent states such as the run state. |
| Quiet clickable project row | The entire row is the target; use a hairline divider, subtle hover, visible focus, and at most a quiet chevron. Do not add a redundant Continue button. |
| Integrated workflow title icon | One unboxed icon sits beside the page title; the title and subtitle remain the primary orientation. |
| Clearly labeled preview placeholder | Before an app exists, preview chrome contains a subdued mock shell and explicit `Placeholder preview` label rather than an error slab or ambiguous blank region. |
| Matched light and dark modes | Both modes preserve hierarchy, contrast, density, and product identity. |
| Consistent Lucide icons | Icons use one family, one geometry, and one meaning for each action. |
| Accessible contextual help | Icon-only controls have tooltips. Complex terms have help triggers or persistent helper text. |
| Local action confirmation | Routine success appears beside the action or affected object and does not cover the workspace. |
| Natural task title | A page title identifies the task or selected object without a count-led slogan. |
| Decision measure | A measure appears only when it changes a task decision and its purpose is explicit. |

## Rejected Visual Patterns

| Pattern | Reason |
|---|---|
| Generic white-card dashboard | Replaces the task with uniform cards. |
| Arbitrary gradient hero blocks | Adds marketing tone and no engineering value. |
| Decorative neon glow everywhere | Dilutes focus and active-state meaning. |
| Low-fidelity placeholder components in hi-fi output | Fails the standard for polished implementation guidance. |
| A grid of identical rounded metric cards, each with its own accent bar | Reads as template output; group related figures on one hairline-divided surface and reserve accent for state. |
| Tinted pill badges on every status | Dilutes severity; routine statuses use a dot plus text. |
| A marker dot on every point of a dense line series | Noise without information; markers belong on the hovered or focused point. |
| Proportional numerals in readings, tables, or timestamps | Measured values must align digit-for-digit; use tabular numerals or the mono family. |
| A rounded panel around every section | Creates visual noise and weakens hierarchy; use the canvas and hairline dividers for ordinary grouping. |
| Destination card plus button for the same action | Duplicates interaction; make the row or card itself the accessible target. |
| Accent strip on a card, tile, panel, section, summary, well, or callout | Reads as generated template output and adds no task meaning. Use spacing, a hairline divider, or an explicit status icon and text. A selection rail is permitted only on a control that is actually selected. |
| Ornamental sparkle or magic icon | Signals generic AI branding instead of product meaning. |
| Em dash in visible copy | Breaks the controlled writing profile and often joins unrelated ideas. |
| Mixed icon families | Creates inconsistent stroke, weight, geometry, and meaning. |
| One shell reused for unrelated products | Removes task identity and makes each product look like a template. |
| Complete action catalog in the page header | Competes with the main task and makes action priority unclear. |
| Normal interface text below 13 pixels | Reduces scanability and creates artificial density. |
| Generic icon reused for unrelated actions | Hides action meaning and makes the interface look templated. |
| Overflow menu on every panel | Advertises commands that do not exist and adds repeated visual noise. |
| Fixed toast for routine success | Separates feedback from its cause and can cover active work. |
| Count-led page title | Turns queue state into a strange slogan and weakens orientation. |
| Default KPI or metric strip | Adds dashboard noise when the task does not use the measure. |
| Rounded border around a structural pane | Makes the page look like a card dashboard and weakens the primary task surface. |
| Subtitle equal to or larger than its title | Inverts orientation and makes scanning harder. |
| Different commands with the same icon | Hides meaning and makes the command system look generated. |

## Mockup Calibration Notes

Mockups constrain density, panel discipline, dark surfaces, technical tone, and chart/table treatment. They do not prove every component or layout appears in the app, and they shall not be cited as formal company-wide standards.
