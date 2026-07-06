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
]

export const STANDARD_APPROVED_GUIDANCE = [
  'Dark engineering workbench.',
  'Restrained technical accent.',
  'Dark canvas with bounded panel hierarchy.',
  'Stable left navigation and visible active state.',
  'Concise page header.',
  'Compact but readable panels.',
  'Monospaced project paths and technical identifiers.',
  'Primary action hierarchy.',
  'Explicit validation and status text.',
  'Semantic CSS variables.',
  'Dialogs with overlay surface, scrim, focus containment, Escape, and focus return.',
  'Borders and spacing doing more hierarchy work than heavy shadows.',
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
  'LAY-SHELL-001', 'RCP-WORKFLOW-001',
  'ARCH-FE-001', 'ARCH-FE-002', 'ARCH-FE-003', 'ARCH-FE-004', 'ARCH-FE-005', 'ARCH-FE-007',
  'ARCH-THEME-001', 'ARCH-THEME-002', 'ARCH-THEME-003', 'ARCH-THEME-004', 'ARCH-THEME-005', 'ARCH-THEME-006', 'ARCH-THEME-007',
  'ARCH-STATE-001', 'ARCH-STATE-002', 'ARCH-STATE-003', 'ARCH-STATE-004', 'ARCH-STATE-005', 'ARCH-STATE-007',
]

export const STANDARD_COMPONENT_IDS = [
  'CMP-SHELL-APP', 'CMP-NAV-PRIMARY', 'CMP-SHELL-PAGE-HEADER', 'CMP-SURFACE-PANEL', 'CMP-WORKFLOW-STEP-INDICATOR',
  'CMP-FORM-FIELD', 'CMP-FORM-TEXTAREA', 'CMP-OVERLAY-DIALOG', 'CMP-FEEDBACK-VALIDATION-SUMMARY', 'CMP-FEEDBACK-ALERT',
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
