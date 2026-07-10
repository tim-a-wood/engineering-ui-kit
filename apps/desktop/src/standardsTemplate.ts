/**
 * "Standard Web App" packet template: the standards excerpts, token table,
 * guidance, and constraint defaults proven in the Vertical Slice 01 trial.
 * The packet builder merges these defaults with per-run user fields.
 */

import type { TaskDefinition } from '@engineering-ui-kit/core'

export const STANDARD_TOKEN_ROWS: TaskDefinition['tokenRows'] = [
  { path: 'semantic.surface.canvas', value: '#07111f', requiredUse: 'Root app canvas background' },
  { path: 'semantic.surface.panel', value: '#0f172a', requiredUse: 'Primary bounded panels' },
  { path: 'semantic.surface.panelRaised', value: '#111827', requiredUse: 'Emphasized summary or action regions' },
  { path: 'semantic.surface.inset', value: '#172033', requiredUse: 'Inset technical content and monospaced paths' },
  { path: 'semantic.surface.overlay', value: '#0f172a', requiredUse: 'Dialog surfaces' },
  { path: 'semantic.surface.scrim', value: 'rgba(2, 6, 23, 0.72)', requiredUse: 'Modal backdrop' },
  { path: 'semantic.text.primary', value: '#f8fafc', requiredUse: 'Primary headings and body text' },
  { path: 'semantic.text.secondary', value: '#cbd5e1', requiredUse: 'Supporting labels and metadata' },
  { path: 'semantic.text.muted', value: '#94a3b8', requiredUse: 'Helper and step labels' },
  { path: 'semantic.text.disabled', value: 'rgba(203, 213, 225, 0.38)', requiredUse: 'Disabled control text' },
  { path: 'semantic.text.inverse', value: '#ffffff', requiredUse: 'Text on accent-filled controls' },
  { path: 'semantic.border.subtle', value: 'rgba(148, 163, 184, 0.18)', requiredUse: 'Default panel and field borders' },
  { path: 'semantic.border.strong', value: 'rgba(203, 213, 225, 0.34)', requiredUse: 'Stronger separators' },
  { path: 'semantic.border.focus', value: '#5478ff', requiredUse: 'Focus outline color' },
  { path: 'semantic.border.danger', value: '#ef4444', requiredUse: 'Validation error borders' },
  { path: 'semantic.focus.ring', value: '0 0 0 2px #5478ff', requiredUse: 'Visible focus ring' },
  { path: 'semantic.focus.ringOffset', value: '0 0 0 4px rgba(84, 120, 255, 0.16)', requiredUse: 'Focus ring halo' },
  { path: 'semantic.accent.primary', value: '#2f5bff', requiredUse: 'Primary actions and active navigation' },
  { path: 'semantic.accent.primaryHover', value: '#5478ff', requiredUse: 'Primary action hover' },
  { path: 'semantic.accent.primaryActive', value: '#2443cc', requiredUse: 'Primary action pressed' },
  { path: 'semantic.accent.secondary', value: '#a78bfa', requiredUse: 'Secondary technical accent only when needed' },
  { path: 'semantic.accent.glow', value: 'rgba(47, 91, 255, 0.22)', requiredUse: 'Restrained selected/focus emphasis only' },
  { path: 'semantic.status.success', value: '#34d399', requiredUse: 'Success status text and indicators' },
  { path: 'semantic.status.warning', value: '#fbbf24', requiredUse: 'Warning status text and indicators' },
  { path: 'semantic.status.danger', value: '#f87171', requiredUse: 'Error and validation status text' },
  { path: 'semantic.status.info', value: '#60a5fa', requiredUse: 'Informational status text' },
  { path: 'semantic.status.neutral', value: '#94a3b8', requiredUse: 'Neutral status text' },
  { path: 'semantic.spacing.1', value: '4px', requiredUse: 'Tight internal gaps' },
  { path: 'semantic.spacing.2', value: '8px', requiredUse: 'Compact control spacing' },
  { path: 'semantic.spacing.3', value: '12px', requiredUse: 'Field and label spacing' },
  { path: 'semantic.spacing.4', value: '16px', requiredUse: 'Panel internal padding baseline' },
  { path: 'semantic.spacing.5', value: '20px', requiredUse: 'Section spacing' },
  { path: 'semantic.spacing.6', value: '24px', requiredUse: 'Major region gaps' },
  { path: 'semantic.spacing.8', value: '32px', requiredUse: 'Shell and page-level spacing' },
  { path: 'semantic.density.compact.controlHeight', value: '32px', requiredUse: 'Compact control height' },
  { path: 'semantic.density.compact.panelPadding', value: '16px', requiredUse: 'Compact panel padding' },
  { path: 'semantic.density.comfortable.controlHeight', value: '40px', requiredUse: 'Comfortable control height' },
  { path: 'semantic.radius.sm', value: '4px', requiredUse: 'Small control radius' },
  { path: 'semantic.radius.md', value: '8px', requiredUse: 'Panel and field radius' },
  { path: 'semantic.radius.lg', value: '12px', requiredUse: 'Dialog and raised surface radius' },
  { path: 'semantic.shadow.sm', value: '0 1px 2px rgba(0, 0, 0, 0.22)', requiredUse: 'Light elevation' },
  { path: 'semantic.shadow.md', value: '0 10px 24px rgba(0, 0, 0, 0.28)', requiredUse: 'Raised panel elevation' },
  { path: 'semantic.shadow.overlay', value: '0 24px 72px rgba(0, 0, 0, 0.46)', requiredUse: 'Dialog elevation' },
  { path: 'semantic.typography.family.sans', value: 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif', requiredUse: 'UI sans-serif family' },
  { path: 'semantic.typography.family.mono', value: 'JetBrains Mono, SFMono-Regular, Consolas, Liberation Mono, monospace', requiredUse: 'Paths and technical identifiers' },
  { path: 'semantic.typography.size.sm', value: '13px', requiredUse: 'Secondary and metadata text' },
  { path: 'semantic.typography.size.md', value: '14px', requiredUse: 'Default body and control text' },
  { path: 'semantic.typography.size.lg', value: '16px', requiredUse: 'Page and section headings' },
  { path: 'semantic.typography.weight.regular', value: '400', requiredUse: 'Body text weight' },
  { path: 'semantic.typography.weight.medium', value: '500', requiredUse: 'Labels and secondary emphasis' },
  { path: 'semantic.typography.weight.semibold', value: '600', requiredUse: 'Headings and active labels' },
  { path: 'semantic.motion.durationFast', value: '120ms', requiredUse: 'Fast hover/focus transitions' },
  { path: 'semantic.motion.durationNormal', value: '180ms', requiredUse: 'Dialog and state transitions' },
  { path: 'semantic.motion.easingStandard', value: 'cubic-bezier(0.2, 0, 0, 1)', requiredUse: 'Standard motion easing' },
  { path: 'semantic.zIndex.overlay', value: '700', requiredUse: 'Scrim stacking order' },
  { path: 'semantic.zIndex.modal', value: '800', requiredUse: 'Dialog stacking order' },
  { path: 'semantic.charts.grid', value: 'rgba(148, 163, 184, 0.16)', requiredUse: 'Chart gridlines at every major tick' },
  { path: 'semantic.charts.axis', value: '#94a3b8', requiredUse: 'Axis lines, tick labels, and axis titles' },
  { path: 'semantic.charts.crosshair', value: 'rgba(203, 213, 225, 0.42)', requiredUse: 'Hover/keyboard crosshair rule and active-point halo' },
  { path: 'semantic.charts.series.primary', value: '#2f5bff', requiredUse: 'First data series' },
  { path: 'semantic.charts.series.secondary', value: '#a78bfa', requiredUse: 'Second data series' },
  { path: 'semantic.charts.series.warning', value: '#fbbf24', requiredUse: 'Warning-classified series or points (with text label)' },
  { path: 'semantic.charts.series.danger', value: '#f87171', requiredUse: 'Danger-classified series or points (with text label)' },
]

export const STANDARD_APPROVED_GUIDANCE = [
  'Dark engineering workbench.',
  'Restrained technical accent.',
  'Dark canvas with bounded panel hierarchy.',
  'Stable left navigation, visible active state, collapsible to a compact rail with a persisted, keyboard-accessible toggle.',
  'Concise page header.',
  'Compact but readable panels.',
  'Monospaced project paths and technical identifiers.',
  'Primary action hierarchy.',
  'Explicit validation and status text.',
  'Semantic CSS variables.',
  'Dialogs with overlay surface, scrim, focus containment, Escape, and focus return.',
  'Borders and spacing doing more hierarchy work than heavy shadows.',
  'One page grid with shared column edges; sibling panels share padding, heading scale, and vertical rhythm — panels sitting side by side stretch to share top and bottom edges.',
  'Structure from typography, spacing, and hairline rules — bounded panels are reserved for true surfaces (tables, charts, inset technical content, rails, dialogs, empty states); forms and prose compose directly on the canvas under small uppercase section headers.',
  'Status summaries on working screens are one slim stat row attached to the working surface (labels with mono values at body scale); a large instrument strip is reserved for true monitoring dashboards.',
  'Every size from the spacing scale; numeric cells right-aligned in tabular numerals.',
  'Charts framed in a chart panel: title, units, legend, state, and a text summary or table fallback beside them.',
  'Chart and its companion table as bounded sibling panels sharing top and bottom edges; the table scrolls internally.',
  'Compact token-height controls on inset surfaces with the focus-ring tokens; 13px medium labels; every field keeps a persistent hint/error slot so sibling rows align.',
  'Multi-phase tasks default to a wizard: compact numbered step indicator, one phase at a time, per-phase validation gating Next, and a review-and-commit final step — built as one reusable stepper primitive.',
  'Round-number axis ticks with gridlines; series sorted by the x-value; discrete records as points, ordered series as lines.',
]

export const STANDARD_REJECTED_GUIDANCE = [
  'Light mode.',
  'Generic white-card dashboard.',
  'Marketing hero layout.',
  'Arbitrary gradients.',
  'Cyberpunk or decorative neon.',
  'Glow on every panel.',
  'Glassmorphism.',
  'Huge display typography.',
  'Hidden project metadata.',
  'Icon-only unlabeled controls.',
  'Raw repeated colors instead of token variables.',
  'One-click automation that hides validation or review.',
  'Decorative KPI tile walls — status tiles only for 3–5 true peer metrics that answer an engineering question.',
  'Billboard KPI strips on working screens — oversized stat values for counts that belong in a slim one-line summary row; process state (like a selection count) is never a stat cell.',
  'Side-by-side panels with mismatched heights — a row of sibling panels stretches to share top and bottom edges.',
  'Panel-heavy composition — a uniform bordered box around every region reads as generated output; a panel never nests inside another panel, and a form never lives in a heavy box when a section header and hairline rule carry the same structure.',
  'Record lists rendered as card stacks — lists of records are data tables (dense rows, right-aligned numerics), never tiles.',
  'Content clipped by its container — a column that cannot fit its longest value must be resized or its content abbreviated, never cut.',
  'Default browser control chrome — native number-input spinners, oversized rounded inputs, or default focus outlines instead of token-styled compact controls.',
  'Oversized numbered wizard boxes — multi-step flows use the compact workflow step indicator, not billboard step cards.',
  'Sequential phases rendered side by side as parallel panels — a multi-phase task is a stepped wizard, one phase at a time.',
  'Uniform full-width controls regardless of content — a five-digit number does not get a 600px input; size controls to what they hold.',
  'Content stranded in a narrow strip while the viewport sits empty — compose grouped, content-sized rows to the working width.',
  'Full-height dashed placeholder wells — empty states are bounded panels with a title, one hint line, and an optional action.',
  'Multi-column tables squeezed into narrow rails — wrapped three-to-four-line rows forced in to keep a dashboard silhouette, instead of a compact synced readout or a detail view.',
  'Column budgets that exceed the container — cells wrapping labels, configurations, or identifiers into multi-line lattices instead of merging into meta lines, truncating with ellipsis, or scrolling horizontally.',
  'Misaligned panel edges, mixed sibling paddings, or arbitrary component sizes off the spacing scale.',
  'Chart points connected in record/insertion order instead of sorted by the x-value.',
  'Axis ticks at raw data values (min/mid/max) instead of round engineering steps.',
  'Color-only status encoding in charts; legends detached from the chart they describe.',
  'Large empty plot regions caused by unclamped axis ranges or missing gridlines.',
]

export const STANDARD_ACCESSIBILITY_REQUIREMENTS = [
  'Target WCAG 2.2 AA.',
  'Use semantic landmarks, headings, lists, buttons, and labels.',
  'Support complete keyboard operation.',
  'Provide visible focus using the supplied focus tokens.',
  'Expose active navigation semantically.',
  'Associate control labels and validation relationships.',
  'Provide error summary/text in addition to color.',
  'Provide dialog title, modal semantics, focus containment, Escape, and focus restoration.',
  'Use reduced-motion-safe transitions.',
  'Keep dense controls readable with practical target sizes.',
]

export const STANDARD_CONSTRAINTS = [
  'Use semantic CSS custom properties traceable to the supplied token table.',
  'Dark-first only; do not implement light mode.',
  'No raw color scattering outside the supplied CSS variable definitions.',
  'No routers, state libraries, component libraries, CSS frameworks, chart libraries, network clients, PDF libraries, or test frameworks.',
  'No dependency or lockfile changes.',
  'No unrelated refactors.',
  'No success claim before local review.',
]

export const STANDARD_RULE_IDS = [
  'FND-VIS-001', 'FND-VIS-002', 'FND-VIS-003', 'FND-VIS-004', 'FND-VIS-005', 'FND-VIS-006', 'FND-VIS-009', 'FND-VIS-010',
  'FND-TOK-001', 'FND-TOK-003', 'FND-TOK-004', 'FND-TOK-006', 'FND-TOK-007', 'FND-TOK-008', 'FND-TOK-009', 'FND-TOK-010',
  'FND-TOK-011', 'FND-TOK-012', 'FND-TOK-013', 'FND-TOK-014',
  'FND-A11Y-001', 'FND-A11Y-002', 'FND-A11Y-003', 'FND-A11Y-004', 'FND-A11Y-005', 'FND-A11Y-006', 'FND-A11Y-007',
  'FND-A11Y-009', 'FND-A11Y-011', 'FND-A11Y-012',
  'LAY-SHELL-001', 'RCP-WORKFLOW-001', 'RCP-DASH-001',
  'ARCH-FE-001', 'ARCH-FE-002', 'ARCH-FE-003', 'ARCH-FE-004', 'ARCH-FE-005', 'ARCH-FE-007',
  'ARCH-THEME-001', 'ARCH-THEME-002', 'ARCH-THEME-003', 'ARCH-THEME-004', 'ARCH-THEME-005', 'ARCH-THEME-006', 'ARCH-THEME-007',
  'ARCH-STATE-001', 'ARCH-STATE-002', 'ARCH-STATE-003', 'ARCH-STATE-004', 'ARCH-STATE-005', 'ARCH-STATE-007',
]

export const STANDARD_COMPONENT_IDS = [
  'CMP-SHELL-APP', 'CMP-NAV-PRIMARY', 'CMP-SHELL-PAGE-HEADER', 'CMP-SURFACE-PANEL', 'CMP-WORKFLOW-STEP-INDICATOR',
  'CMP-FORM-FIELD', 'CMP-FORM-TEXT-INPUT', 'CMP-FORM-NUMBER-INPUT', 'CMP-FORM-SELECT', 'CMP-FORM-TEXTAREA',
  'CMP-OVERLAY-DIALOG', 'CMP-FEEDBACK-VALIDATION-SUMMARY', 'CMP-FEEDBACK-ALERT',
  'CMP-TABLE-DATA-TABLE', 'CMP-LAYOUT-DASHBOARD-GRID',
  'CMP-VIZ-CHART-PANEL', 'CMP-VIZ-LINE-CHART', 'CMP-VIZ-BAR-CHART', 'CMP-VIZ-LEGEND', 'CMP-VIZ-CHART-TOOLTIP',
]

export const STANDARD_EXCERPTS: TaskDefinition['standardsExcerpts'] = [
  {
    id: 'FND-VIS-001',
    title: 'Dark-first surface hierarchy',
    body: 'Implementations shall use semantic surface tokens to create hierarchy: `semantic.surface.canvas` for the root canvas, `semantic.surface.panel` for ordinary bounded regions, `semantic.surface.panelRaised` for emphasized cards, `semantic.surface.inset` for embedded technical content, and `semantic.surface.overlay` for dialogs and drawers.',
    source: 'standards/foundation/visual-language.md',
  },
  {
    id: 'FND-TOK-004',
    title: 'Dark mode is normative',
    body: 'The dark token mode is the normative theme. Reviewers shall treat dark-first drift as a material issue.',
    source: 'standards/foundation/tokens.md',
  },
  {
    id: 'ARCH-THEME-001',
    title: 'Semantic tokens as CSS custom properties',
    body: 'Map semantic token leaves to CSS custom properties. Component and page styles shall reference those variables, not primitive palette literals, except inside the single token entry point.',
    source: 'standards/reference-architecture/styling-and-theming.md',
  },
  {
    id: 'FND-A11Y-007',
    title: 'Dialog and overlay behavior',
    body: 'Blocking dialogs shall trap focus, provide an accessible title, support Escape where safe, and restore focus to the invoking control when closed.',
    source: 'standards/foundation/accessibility.md',
  },
  {
    id: 'FND-VIS-010',
    title: 'What visual drift looks like',
    body: 'Drift includes generic light cards, arbitrary gradients, excessive glassmorphism, cyberpunk neon, huge marketing typography, placeholder wireframes, hidden metadata, inconsistent borders, and raw colors that bypass tokens.',
    source: 'standards/foundation/visual-language.md',
  },
  {
    id: 'RCP-DASH-001',
    title: 'Layout and composition discipline',
    body: [
      'Dashboards and screens shall not become decorative KPI walls. Compose every page on one grid: panel edges align to shared columns, sibling panels share padding (`semantic.density.compact.panelPadding`), heading scale, and vertical rhythm; all gaps and sizes come from the spacing scale — no arbitrary pixel values.',
      'Status tiles are justified only for 3–5 true peer metrics that answer a standing engineering question; otherwise integrate status into the working surface (table rows, badges, callouts). A chart never floats alone: it sits in a chart panel adjacent to the data table or summary that carries the same information as text. Numeric table cells right-align in tabular numerals; date and identifier cells never wrap mid-value.',
      'Cards may wrap responsively, but tables and charts shall remain legible; hide secondary charts before hiding status or evidence.',
      'Boxes are not structure: reserve bounded panels for true surfaces — tables, charts, inset technical content, side rails, dialogs, and empty states. Forms, prose, and section groupings compose directly on the canvas under small uppercase section headers separated by hairline rules; a panel shall never nest inside another panel. A page that wraps every region in a uniform bordered box reads as generated output, not an engineering tool.',
    ].join(' '),
    source: 'standards/layouts-and-recipes/dashboard-layouts.md',
  },
  {
    id: 'LAY-SHELL-001',
    title: 'Application shell and collapsible navigation',
    body: [
      'The shell is a stable left primary navigation beside the working canvas — and the navigation pane is collapsible by default: a persistent, keyboard-accessible toggle at the rail edge switches it between the full pane and a compact rail (~56–64px).',
      'Collapsed items keep an affordance (glyph or monogram), their accessible name (aria-label/title), visible focus, and the active indicator — collapse never costs state visibility. The preference persists across sessions, and the content grid reclaims the freed width.',
    ].join(' '),
    source: 'standards/layouts-and-recipes/application-shell.md + standards/components/navigation.md (CMP-NAV-PRIMARY, collapsed state)',
  },
  {
    id: 'RCP-WORKFLOW-001',
    title: 'Wizard flows and the step indicator',
    body: [
      'Any task with two or more sequential phases (define → configure → review) defaults to a wizard: a compact step indicator (numbered 20px dots with short labels; complete / current / upcoming states; completed steps are clickable to go back, never forward past validation), then ONE phase of content on the canvas at a time — phases are never rendered side by side as parallel panels.',
      'Each phase validates before Next enables progression; Back never loses input; the final phase is a review-and-commit step that shows the consequential summary (a preview, the expanded result, the exact effect) beside the primary action. The step indicator is a slim strip under the page header spanning the full working width — steps distributed with flexible hairline connectors growing between them — never billboard step cards and never a cluster stranded at the left edge.',
      'Build the stepper once as a reusable primitive (steps + current + furthest-reached + select handler) and reuse it for every multi-phase flow in the app.',
    ].join(' '),
    source: 'standards/layouts-and-recipes/workflow-pages.md + standards/components/component-specs.md (CMP-WORKFLOW-STEP-INDICATOR)',
  },
  {
    id: 'CMP-TABLE-DATA-TABLE',
    title: 'Table craft and fitting',
    body: [
      'Rows scan in one line, plus at most one muted meta line under the primary cell. Identifier, numeric, and date cells never wrap mid-value; long labels truncate to a single line with an ellipsis and expose the full value via title/tooltip.',
      'Budget columns to the space they actually get: merge secondary attributes (configuration, location, family) into the meta line of the primary cell, or defer them to a detail view; prefer horizontal scroll over wrapped cells. A lattice of 3–4-line wrapped rows means the table has too many columns for its container.',
      'A multi-column table is the right text alternative for a chart only where it genuinely fits. In a narrow side rail, use a compact synced readout list instead — primary label (one line, ellipsized), the key value pair in mono figures, and a short text status — with the full table one view away. Never squeeze a miniature table into a rail to preserve a dashboard silhouette.',
    ].join(' '),
    source: 'standards/components/tables.md + standards/layouts-and-recipes/dashboard-layouts.md',
  },
  {
    id: 'CMP-FORM-FIELD',
    title: 'Form and control craft',
    body: [
      'A form field is label + control + a persistent hint/error slot: the slot renders even when empty so sibling rows in a form grid always align; units belong in the label ("Aircraft weight (lb)"), never floating beside the control. Labels are 13px medium in `semantic.text.secondary`; hints 12px in `semantic.text.muted`; errors replace the hint in the same slot, text-first.',
      'Controls are compact and token-styled — never default browser chrome: height `semantic.density.compact.controlHeight` (32px), background `semantic.surface.inset`, 1px `semantic.border.subtle` border, `semantic.radius.sm`, focus via the focus-ring tokens (no default outlines). Number inputs suppress native spinner chrome (`appearance: none`) unless purpose-built steppers are designed; numeric values may use the mono family with tabular figures. Selects share the input metrics with a drawn chevron.',
      'Controls size to their expected content: numeric inputs around 10–14 characters wide, selects to their longest option, identifiers around 20 characters; only free-text names and notes span a column. Uniform full-width controls regardless of content read as generated output.',
      'Forms beyond ~6 fields organize into labeled groups — a small uppercase group header over a hairline, related fields together in content-sized rows — and the grouped rows compose to fill the working width; never a narrow strip of stacked fields stranding the rest of the viewport. Multi-step flows use the compact workflow step indicator (numbered dots with short labels), never billboard step cards. Empty states are bounded panels — title, one hint line, optional action — sized to their content.',
    ].join(' '),
    source: 'standards/components/forms.md + standards/components/component-specs.md',
  },
  {
    id: 'CMP-VIZ-CHART-PANEL',
    title: 'Engineering chart craft',
    body: [
      'Every chart is framed by a chart panel with title, data source or scope, units, legend, explicit state (empty/loading/error/stale), and a text summary or table fallback — the chart is never the only representation.',
      'Axes: visible titles with units; ticks at round engineering steps (never raw data min/mid/max); gridlines at every major tick using `semantic.charts.grid`; axis text in `semantic.charts.axis`; tabular numerals.',
      'Series: line charts only for x-ordered continuous data, always sorted by the x-value before drawing; discrete or unrelated records render as scatter points, never chained into a polyline in insertion order. A family of related cases (e.g. a parameter sweep) is one named series; standalone cases are individual points. Series colors come from `semantic.charts.series.*`; status-classified points (warning/danger) additionally carry a text label or legend entry — never color alone.',
      'Readout: pair pointer hover with a crosshair rule and active-point halo in `semantic.charts.crosshair`, snap to the nearest point, and provide an equivalent keyboard path (arrow keys or focusable points) with a visible readout mirroring the exact values. The reference implementation is the bench-monitor trace chart.',
    ].join(' '),
    source: 'standards/components/data-visualization.md + standards/foundation/tokens.md',
  },
]

export function buildRecommendedPrompt(input: {
  targetApplication: string
  taskTitle: string
  goal: string
  uploadFiles: string[]
}): string {
  return [
    `You are implementing a focused UI transformation for \`${input.targetApplication}\`.`,
    '',
    'Before editing anything, inspect all uploaded inputs:',
    '',
    ...input.uploadFiles.map((f, i) => `${i + 1}. \`${f}\``),
    '',
    'Task goal:',
    '',
    input.goal,
    '',
    'Hard requirements:',
    '',
    '- Constrain changes to the expected files and task scope defined in the pack.',
    '- Preserve domain behavior and protected interactions.',
    '- Implement dark-first styling with semantic tokens as CSS custom properties.',
    '- Do not implement light mode.',
    '- Return only `ui-overlay.zip` containing changed and new files with repo-relative paths.',
    '- Do not return a full repository, `.git` content, dependencies, build output, or secrets.',
    '- If requirements are missing or conflicting, report limitations instead of inventing them.',
    '- Do not claim success. Local verification remains mandatory.',
  ].join('\n')
}

/** Build `task-packet.md` (PRD §22.4) for the text-only three-file upload set. */
export function buildTaskPacketMarkdown(input: {
  packetId: string
  targetApplication: string
  targetAppRoot: string
  taskTitle: string
  goal: string
  scope: string[]
  constraints: string[]
  acceptanceCriteria: string[]
  references: string[]
  generatedAt: string
  /** Saved reviewer notes from the previous iteration of this run, if any. */
  reviewerFeedback?: string
}): string {
  const lines: string[] = [
    '# Task Packet',
    '',
    `- packetId: \`${input.packetId}\``,
    `- targetApplication: \`${input.targetApplication}\``,
    `- targetAppRoot: \`${input.targetAppRoot}\``,
    `- task: ${input.taskTitle}`,
    `- generatedAt: \`${input.generatedAt}\``,
    '- expectedOutput: `ui-overlay.zip`',
    '',
    '## Goal',
    '',
    input.goal,
    '',
    '## Scope',
    '',
    ...input.scope.map((s) => `- ${s}`),
    '',
    '## Constraints',
    '',
    ...input.constraints.map((s) => `- ${s}`),
    '',
    '## Acceptance Criteria',
    '',
    ...input.acceptanceCriteria.map((s, i) => `${i + 1}. ${s}`),
    '',
    '## References',
    '',
    ...input.references.map((s) => `- ${s}`),
    '',
    ...(input.reviewerFeedback
      ? [
          '## Reviewer Feedback (previous iteration)',
          '',
          'The reviewer recorded the following while verifying the previous overlay.',
          'Address every point; where it conflicts with the scope above, the feedback wins.',
          '',
          input.reviewerFeedback.trim(),
          '',
        ]
      : []),
    '## Required Output',
    '',
    '- Return one file named `ui-overlay.zip` containing changed and new files only, with repo-relative paths.',
    '- Do not touch domain logic, calculation logic, API contracts, test data, or unrelated screens.',
    '- Do not include `.git/`, dependencies, caches, build output, environment files, or secrets.',
    '- Do not claim the overlay was locally verified.',
    '',
    '## Verification Expectations',
    '',
    '```bash',
    'npm run typecheck',
    'npm run build',
    '```',
    '',
  ]
  return lines.join('\n')
}

/** Build `standard-pack.md` (PRD §22.3) for the text-only three-file upload set. */
export function buildStandardPackMarkdown(input: { standardsVersion: string; generatedAt: string }): string {
  const lines: string[] = [
    '# Standard Pack',
    '',
    `- standardsPackage: \`engineering-ui-kit-standards\``,
    `- standardsVersion: \`${input.standardsVersion}\``,
    `- themePosture: \`dark-first\``,
    `- generatedAt: \`${input.generatedAt}\``,
    '',
    '## Applicable Rule IDs',
    '',
    ...STANDARD_RULE_IDS.map((id) => `- \`${id}\``),
    '',
    '## Applicable Component IDs',
    '',
    ...STANDARD_COMPONENT_IDS.map((id) => `- \`${id}\``),
    '',
    '## Applicable Token Paths and Values',
    '',
    '| Token path | Resolved value | Required use |',
    '|---|---|---|',
    ...STANDARD_TOKEN_ROWS.map((r) => `| \`${r.path}\` | \`${r.value}\` | ${r.requiredUse} |`),
    '',
    '## Approved Guidance',
    '',
    ...STANDARD_APPROVED_GUIDANCE.map((g) => `- ${g}`),
    '',
    '## Rejected Guidance',
    '',
    ...STANDARD_REJECTED_GUIDANCE.map((g) => `- ${g}`),
    '',
    '## Accessibility Requirements',
    '',
    ...STANDARD_ACCESSIBILITY_REQUIREMENTS.map((g) => `- ${g}`),
    '',
    '## Standards Excerpts',
    '',
  ]
  for (const excerpt of STANDARD_EXCERPTS) {
    lines.push(`### ${excerpt.id} — ${excerpt.title}`, '', excerpt.body, '', `Source: \`${excerpt.source}\``, '')
  }
  return lines.join('\n')
}

/** Build the Copilot review packet (follow-up within the 3-file budget). */
export function buildReviewPacketMarkdown(input: {
  runId: string
  targetApplication: string
  taskTitle: string
  acceptanceCriteria: string
  feedback: string
  verificationSummary: string
  generatedAt: string
}): string {
  return [
    '# Copilot Review Packet',
    '',
    `- runId: \`${input.runId}\``,
    `- targetApplication: \`${input.targetApplication}\``,
    `- task: ${input.taskTitle}`,
    `- generatedAt: \`${input.generatedAt}\``,
    '',
    '## Review Request',
    '',
    `You are reviewing implementation output for \`${input.targetApplication}\`.`,
    'Review only the provided changed files and evidence. Do not assume unstated repository changes.',
    'Classify each finding as blocker, warning, or note, with a corrective action.',
    'Do not approve output that violates dark-first, token, scope, or protected-behavior rules.',
    '',
    '## Acceptance Criteria Under Review',
    '',
    input.acceptanceCriteria,
    '',
    '## Reviewer Feedback',
    '',
    input.feedback || '_No manual feedback captured yet._',
    '',
    '## Verification Summary',
    '',
    input.verificationSummary,
    '',
    '## Upload Budget',
    '',
    'This packet plus at most two supporting files (changed-file archive, evidence) fit the strict 3-file Microsoft 365 Copilot budget.',
    '',
  ].join('\n')
}
