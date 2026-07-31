# Generated UI design-system evidence

## Outcome

This revision changes the generator contract and the rendered UI. The ten product trials now use a shared workspace grammar, resolved page plans, design tokens, semantic icons, and automated visual gates.

The default dark theme uses one flat midnight canvas. Structure comes from spacing, alignment, and quiet separators. A different panel shade does not define each section. Light mode uses a light canvas and the same structural rules.

Each product now has a task-specific composition. Review, board, editor, monitor, trade study, test control, supplier intake, impact analysis, software load, and FRACAS views no longer use one dashboard template.

## Research basis

- [Primer layout](https://primer.style/product/getting-started/foundations/layout/) defines reading order, responsive columns, page padding, split views, and narrow-view strategies.
- [Primer PageLayout accessibility](https://primer.style/product/components/page-layout/accessibility/) requires landmarks to follow a logical order and asks authors to review responsive reordering.
- [Primer color usage](https://primer.style/product/getting-started/foundations/color-usage/) separates base, functional, and component tokens.
- [Fluent 2 iconography](https://fluent2.microsoft.design/iconography) requires familiar, literal, and consistent icon metaphors. It also requires an accessible label when an icon has no visible text.
- [Storybook MCP](https://storybook.js.org/docs/ai/mcp/overview) gives agents structured component metadata, stories, and documentation instead of relying on a style prompt alone.
- [DTCG 2025.10](https://www.designtokens.org/tr/2025.10/format/) defines a vendor-neutral token format with groups, aliases, and typed values.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) defines reflow, contrast, focus, and target-size requirements used by the browser gates.
- [University of Basel research](https://edoc.unibas.ch/entities/publication/f42f4d7b-f955-4f70-befc-9540275c4be6) links visual complexity with slower search and more negative affect. This supports the removal of decorative surface tiers and repeated card walls.

Anthropic does not publish a formal Claude design-token system. This work uses broad cues such as quiet chrome, clear task focus, and restrained surfaces. It does not claim to copy Claude components or colors.

## Enforced workspace grammar

1. Each primary layout declares its exact regions. Each region has an ID, role, priority, surface kind, wide position, and narrow behavior. Missing, duplicate, and unknown regions fail validation.

2. Each page has one `h1`. The page title is larger than its summary. Each panel title is larger than its subtitle.

3. Primary work surfaces and structural panes are flat. Only a real object, such as a selected software package, can use an inset boundary. Menus and dialogs can use an overlay surface.

4. Header KPI strips are prohibited unless each value supports a stated task decision. The current products use zero metric strips. Five products use local decision facts where the values change the work.

5. Page plans drive rendered placement at wide widths. The ten products use distinct compositions for review, session tracking, writing, telemetry, trade analysis, HIL control, supplier intake, impact analysis, software loading, and failure investigation.

6. Visible actions use Lucide icons with semantic metadata. Different actions in one group must use different icon names. Every icon button requires a visible label or accessible name, a tooltip, and help text where the result is not self-evident.

7. Responsive behavior preserves the task. Structural panes collapse or move in a declared order. Tables own local scrolling. The impact graph changes to a vertical branch diagram on a phone instead of clipping the desktop graph.

8. Themes and fonts remain configurable for every generated product. Each product includes light and dark modes. Palette selection changes semantic roles and does not create extra panel tiers.

9. Product copy uses the ASD-STE100 writing profile. The pipeline blocks vague status phrases, decorative metrics, and unapproved AI-style copy patterns.

10. The generator receives structured tokens, page recipes, approved components, semantic action metadata, and validation rules. A prose style prompt is not the design system.

## Evidence

The source report covers all ten products. It records zero blocking findings and zero warnings. It also records zero metric strips and five products with task-specific decision facts. See `source-validation.json`.

The Chromium report covers all ten products at 1440, 1024, 768, and 390 pixels. It contains 79 screenshots and zero failures. Desktop captures include dark, light, action-result, and help states. Phone captures include the workspace and navigation drawer where the product has a drawer. See `browser-validation.json` and `screenshots/`.

The rendered gates check:

- exact region identity, surface role, and wide placement;
- stable layout and overlap at each matrix width;
- fixed and sticky control occlusion;
- one page title and correct title hierarchy;
- flat structural surfaces and neutral background count;
- clipped content and local scroll ownership;
- action-icon uniqueness and icon metadata;
- labels, tooltips, help, contrast, focus, and target size;
- product-specific scenarios and visible action results.

## WebKit scope

The local WebKit worker reached page creation but did not complete the representative render within the bounded ten-second run. The result is in `webkit-diagnostic.json`. This is an environment limitation, not a passed Safari check. The evidence does not claim a test in Safari or on a physical iPhone. A separate Safari device run remains a release check.
