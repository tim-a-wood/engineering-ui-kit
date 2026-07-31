/**
 * Frontend design contract.
 *
 * The contract separates product intent from framework code. Generators receive
 * one resolved configuration. Review gates can then verify the same values.
 */

export const FRONTEND_PALETTE_IDS = [
  'gulfstream',
  'graphite',
  'teal',
  'violet',
  'amber',
  'custom',
] as const

export const FRONTEND_FONT_IDS = [
  'system',
  'inter',
  'ibm-plex',
  'source-sans',
  'atkinson',
] as const

export const FRONTEND_VIEW_KINDS = [
  'workbench',
  'table',
  'form',
  'editor',
  'monitor',
  'board',
  'graph',
  'wizard',
  'case',
  'timeline',
] as const

export const FRONTEND_DEFAULT_MODES = ['system', 'light', 'dark'] as const
export const FRONTEND_DENSITIES = ['compact', 'comfortable'] as const

export type FrontendPaletteId = (typeof FRONTEND_PALETTE_IDS)[number]
export type FrontendFontId = (typeof FRONTEND_FONT_IDS)[number]
export type FrontendViewKind = (typeof FRONTEND_VIEW_KINDS)[number]
export type FrontendDefaultMode = (typeof FRONTEND_DEFAULT_MODES)[number]
export type FrontendDensity = (typeof FRONTEND_DENSITIES)[number]

export type FrontendColorMode = {
  canvas: string
  surface: string
  surfaceSubtle: string
  surfaceRaised: string
  text: string
  textMuted: string
  textQuiet: string
  border: string
  borderStrong: string
  accent: string
  accentHover: string
  accentActive: string
  accentSoft: string
  focus: string
  success: string
  warning: string
  danger: string
  info: string
  shadow: string
}

export type FrontendPalette = {
  id: FrontendPaletteId
  name: string
  description: string
  light: FrontendColorMode
  dark: FrontendColorMode
}

export type FrontendFont = {
  id: FrontendFontId
  name: string
  stack: string
  posture: string
}

export type FrontendLayoutRule = {
  kind: FrontendViewKind
  name: string
  purpose: string
  composition: {
    navigation: 'sidebar' | 'rail' | 'top' | 'contextual' | 'none'
    header: 'workspace' | 'editor' | 'instrument' | 'portal' | 'graph' | 'case'
    actions: 'selection-contextual' | 'command-first' | 'step-gated' | 'page-primary'
    surface: 'canvas-sections' | 'bounded-workbench' | 'editor-sheet' | 'control-grid' | 'flow-columns' | 'spatial-canvas'
  }
  requiredRegions: string[]
  avoid: string[]
}

export type FrontendIconGuide = {
  family: 'lucide'
  packageNames: string[]
  license: 'ISC'
  viewBox: '0 0 24 24'
  strokeWidth: 2
  lineCap: 'round'
  lineJoin: 'round'
  sizes: {
    inline: 16
    control: 18
    navigation: 20
    feature: 24
  }
  helpIcon: 'circle-help'
}

export type FrontendCustomPalette = {
  name: string
  light: FrontendColorMode
  dark: FrontendColorMode
}

export type FrontendDesignPreferences = {
  paletteId?: FrontendPaletteId
  fontId?: FrontendFontId
  defaultMode?: FrontendDefaultMode
  density?: FrontendDensity
  viewKinds?: FrontendViewKind[]
  customPalette?: FrontendCustomPalette
}

export type FrontendDesignSystemConfig = {
  schemaVersion: '1.0'
  contractId: 'EUIT-FRONTEND-001'
  writingProfileId: 'EUIT-STE-001'
  palette: FrontendPalette
  typography: FrontendFont
  defaultMode: FrontendDefaultMode
  density: FrontendDensity
  modeToggle: true
  icons: FrontendIconGuide
  viewKinds: FrontendViewKind[]
  layouts: FrontendLayoutRule[]
}

export type FrontendDesignFinding = {
  code: string
  severity: 'blocking' | 'warning'
  message: string
}

const gulfstreamLight: FrontendColorMode = {
  canvas: '#f5f8fa',
  surface: '#ffffff',
  surfaceSubtle: '#edf3f6',
  surfaceRaised: '#ffffff',
  text: '#102536',
  textMuted: '#526978',
  textQuiet: '#6d808c',
  border: '#c8d5dc',
  borderStrong: '#8da2ae',
  accent: '#003767',
  accentHover: '#004b87',
  accentActive: '#002846',
  accentSoft: '#e2eef5',
  focus: '#0069aa',
  success: '#176b3a',
  warning: '#805400',
  danger: '#b42318',
  info: '#005c96',
  shadow: '0 12px 32px rgba(16, 37, 54, 0.12)',
}

const gulfstreamDark: FrontendColorMode = {
  canvas: '#071521',
  surface: '#0c2030',
  surfaceSubtle: '#112a3d',
  surfaceRaised: '#153247',
  text: '#f4f8fb',
  textMuted: '#adc0cb',
  textQuiet: '#8299a7',
  border: '#29475a',
  borderStrong: '#4e6d7e',
  accent: '#70b7e6',
  accentHover: '#98cef0',
  accentActive: '#4c99ce',
  accentSoft: '#0d3854',
  focus: '#8ac9f0',
  success: '#63d69b',
  warning: '#f2c46d',
  danger: '#ff8c85',
  info: '#70b7e6',
  shadow: '0 18px 48px rgba(0, 0, 0, 0.32)',
}

function palette(
  id: Exclude<FrontendPaletteId, 'custom'>,
  name: string,
  description: string,
  light: Partial<FrontendColorMode>,
  dark: Partial<FrontendColorMode>,
): FrontendPalette {
  return {
    id,
    name,
    description,
    light: { ...gulfstreamLight, ...light },
    dark: { ...gulfstreamDark, ...dark },
  }
}

export const FRONTEND_PALETTES: Readonly<Record<Exclude<FrontendPaletteId, 'custom'>, FrontendPalette>> = {
  gulfstream: palette(
    'gulfstream',
    'Gulfstream blue',
    'Blue and white enterprise palette.',
    {},
    {},
  ),
  graphite: palette(
    'graphite',
    'Graphite',
    'Neutral palette for code and operations.',
    {
      canvas: '#f6f7f8',
      surfaceSubtle: '#eef0f2',
      text: '#20262d',
      textMuted: '#59636e',
      textQuiet: '#737d87',
      border: '#d0d5da',
      borderStrong: '#959da7',
      accent: '#24292f',
      accentHover: '#3d444d',
      accentActive: '#1b1f24',
      accentSoft: '#eaeef2',
      focus: '#0969da',
      info: '#0969da',
    },
    {
      canvas: '#0d1117',
      surface: '#151b23',
      surfaceSubtle: '#1c2430',
      surfaceRaised: '#212a36',
      text: '#f0f6fc',
      textMuted: '#b1bac4',
      textQuiet: '#8b949e',
      border: '#30363d',
      borderStrong: '#59636e',
      accent: '#58a6ff',
      accentHover: '#79c0ff',
      accentActive: '#388bfd',
      accentSoft: '#132f4c',
      focus: '#58a6ff',
      info: '#58a6ff',
    },
  ),
  teal: palette(
    'teal',
    'Deep teal',
    'Calm palette for analysis and planning.',
    {
      accent: '#075e61',
      accentHover: '#087b7f',
      accentActive: '#04484a',
      accentSoft: '#e0f1f0',
      focus: '#087b7f',
      info: '#075e61',
    },
    {
      accent: '#62d0ca',
      accentHover: '#8fe0dc',
      accentActive: '#3fb2ad',
      accentSoft: '#103c3d',
      focus: '#73d8d3',
      info: '#62d0ca',
    },
  ),
  violet: palette(
    'violet',
    'Technical violet',
    'Focused palette for creative and agent work.',
    {
      accent: '#4f3698',
      accentHover: '#654ab2',
      accentActive: '#3a2872',
      accentSoft: '#eee9f8',
      focus: '#654ab2',
      info: '#4f3698',
    },
    {
      accent: '#b5a0f4',
      accentHover: '#cbbcf8',
      accentActive: '#9176e0',
      accentSoft: '#2a2245',
      focus: '#c1aff7',
      info: '#b5a0f4',
    },
  ),
  amber: palette(
    'amber',
    'Flight amber',
    'Warm palette for test and release work.',
    {
      accent: '#7a4b00',
      accentHover: '#985f00',
      accentActive: '#5d3900',
      accentSoft: '#f8edda',
      focus: '#8a5500',
      info: '#005c96',
    },
    {
      accent: '#f0bd62',
      accentHover: '#f7d08a',
      accentActive: '#d99a36',
      accentSoft: '#3e2c14',
      focus: '#f5c874',
      info: '#70b7e6',
    },
  ),
}

export const FRONTEND_FONTS: Readonly<Record<FrontendFontId, FrontendFont>> = {
  system: {
    id: 'system',
    name: 'System sans',
    stack: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    posture: 'Native, fast, and neutral.',
  },
  inter: {
    id: 'inter',
    name: 'Inter',
    stack: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    posture: 'Compact and precise.',
  },
  'ibm-plex': {
    id: 'ibm-plex',
    name: 'IBM Plex Sans',
    stack: '"IBM Plex Sans", Inter, ui-sans-serif, system-ui, sans-serif',
    posture: 'Technical and editorial.',
  },
  'source-sans': {
    id: 'source-sans',
    name: 'Source Sans 3',
    stack: '"Source Sans 3", Inter, ui-sans-serif, system-ui, sans-serif',
    posture: 'Open and highly readable.',
  },
  atkinson: {
    id: 'atkinson',
    name: 'Atkinson Hyperlegible',
    stack: '"Atkinson Hyperlegible", Inter, ui-sans-serif, system-ui, sans-serif',
    posture: 'Distinct and accessible.',
  },
}

export const FRONTEND_LAYOUT_RULES: Readonly<Record<FrontendViewKind, FrontendLayoutRule>> = {
  workbench: {
    kind: 'workbench',
    name: 'Review workbench',
    purpose: 'Inspect one artifact and its evidence.',
    composition: {
      navigation: 'sidebar',
      header: 'workspace',
      actions: 'selection-contextual',
      surface: 'bounded-workbench',
    },
    requiredRegions: ['context rail', 'primary work surface', 'detail inspector'],
    avoid: ['metric card wall', 'equal panels without a task order'],
  },
  table: {
    kind: 'table',
    name: 'Record table',
    purpose: 'Find, compare, and act on many records.',
    composition: {
      navigation: 'sidebar',
      header: 'workspace',
      actions: 'selection-contextual',
      surface: 'canvas-sections',
    },
    requiredRegions: ['filter bar', 'data table', 'row or selection detail'],
    avoid: ['record card grid', 'wrapped identifier columns'],
  },
  form: {
    kind: 'form',
    name: 'Focused form',
    purpose: 'Enter or change one coherent record.',
    composition: {
      navigation: 'contextual',
      header: 'portal',
      actions: 'page-primary',
      surface: 'bounded-workbench',
    },
    requiredRegions: ['short context', 'grouped fields', 'stable action area'],
    avoid: ['placeholder-only labels', 'full-width fields for short values'],
  },
  editor: {
    kind: 'editor',
    name: 'Document editor',
    purpose: 'Create content and resolve review input.',
    composition: {
      navigation: 'contextual',
      header: 'editor',
      actions: 'command-first',
      surface: 'editor-sheet',
    },
    requiredRegions: ['outline', 'document canvas', 'review inspector'],
    avoid: ['dashboard summary before the document', 'nested cards around prose'],
  },
  monitor: {
    kind: 'monitor',
    name: 'Live monitor',
    purpose: 'Watch state and investigate change over time.',
    composition: {
      navigation: 'rail',
      header: 'instrument',
      actions: 'selection-contextual',
      surface: 'control-grid',
    },
    requiredRegions: ['channel or scope rail', 'primary plot', 'event stream'],
    avoid: ['equal KPI tiles as the main content', 'color-only alarms'],
  },
  board: {
    kind: 'board',
    name: 'Flow board',
    purpose: 'Move work through explicit states.',
    composition: {
      navigation: 'rail',
      header: 'workspace',
      actions: 'selection-contextual',
      surface: 'flow-columns',
    },
    requiredRegions: ['state columns', 'work items', 'selected item detail'],
    avoid: ['duplicate summary dashboard', 'unclear item ownership'],
  },
  graph: {
    kind: 'graph',
    name: 'Relationship graph',
    purpose: 'Trace impact and inspect relationships.',
    composition: {
      navigation: 'none',
      header: 'graph',
      actions: 'selection-contextual',
      surface: 'spatial-canvas',
    },
    requiredRegions: ['change context', 'graph canvas', 'selection detail'],
    avoid: ['decorative network view', 'labels without selection detail'],
  },
  wizard: {
    kind: 'wizard',
    name: 'Guided task',
    purpose: 'Complete a gated sequence.',
    composition: {
      navigation: 'top',
      header: 'portal',
      actions: 'step-gated',
      surface: 'bounded-workbench',
    },
    requiredRegions: ['progress', 'current step', 'back and next actions'],
    avoid: ['all steps on one screen', 'stepper for two simple modes'],
  },
  case: {
    kind: 'case',
    name: 'Case workspace',
    purpose: 'Investigate and close one case.',
    composition: {
      navigation: 'sidebar',
      header: 'case',
      actions: 'selection-contextual',
      surface: 'bounded-workbench',
    },
    requiredRegions: ['case list', 'case evidence', 'decision or action area'],
    avoid: ['case card grid', 'hidden case status'],
  },
  timeline: {
    kind: 'timeline',
    name: 'Event timeline',
    purpose: 'Review ordered events and evidence.',
    composition: {
      navigation: 'contextual',
      header: 'instrument',
      actions: 'selection-contextual',
      surface: 'canvas-sections',
    },
    requiredRegions: ['time controls', 'event sequence', 'event detail'],
    avoid: ['unordered event cards', 'time encoded by position only'],
  },
}

export const FRONTEND_ICON_GUIDE: FrontendIconGuide = {
  family: 'lucide',
  packageNames: [
    'lucide',
    'lucide-react',
    '@lucide/vue',
    '@lucide/svelte',
    'lucide-static',
  ],
  license: 'ISC',
  viewBox: '0 0 24 24',
  strokeWidth: 2,
  lineCap: 'round',
  lineJoin: 'round',
  sizes: {
    inline: 16,
    control: 18,
    navigation: 20,
    feature: 24,
  },
  helpIcon: 'circle-help',
}

function customPalette(value?: FrontendCustomPalette): FrontendPalette {
  if (!value) {
    throw new Error('A custom palette requires light and dark token values.')
  }
  return {
    id: 'custom',
    name: value.name.trim() || 'Custom',
    description: 'Project-defined enterprise palette.',
    light: { ...value.light },
    dark: { ...value.dark },
  }
}

function uniqueViewKinds(values: FrontendViewKind[] | undefined): FrontendViewKind[] {
  const source: FrontendViewKind[] = values?.length ? values : ['workbench']
  return [...new Set(source)].filter((value): value is FrontendViewKind =>
    FRONTEND_VIEW_KINDS.includes(value))
}

export function resolveFrontendDesignSystem(
  preferences: FrontendDesignPreferences = {},
): FrontendDesignSystemConfig {
  const paletteId = preferences.paletteId ?? 'gulfstream'
  const fontId = preferences.fontId ?? 'inter'
  const viewKinds = uniqueViewKinds(preferences.viewKinds)
  const paletteValue = paletteId === 'custom'
    ? customPalette(preferences.customPalette)
    : FRONTEND_PALETTES[paletteId]
  return {
    schemaVersion: '1.0',
    contractId: 'EUIT-FRONTEND-001',
    writingProfileId: 'EUIT-STE-001',
    palette: paletteValue,
    typography: FRONTEND_FONTS[fontId],
    defaultMode: preferences.defaultMode ?? 'system',
    density: preferences.density ?? 'compact',
    modeToggle: true,
    icons: FRONTEND_ICON_GUIDE,
    viewKinds,
    layouts: viewKinds.map((kind) => FRONTEND_LAYOUT_RULES[kind]),
  }
}

export function frontendPreferencesFromConfig(
  config: FrontendDesignSystemConfig,
): FrontendDesignPreferences {
  return {
    paletteId: config.palette.id,
    fontId: config.typography.id,
    defaultMode: config.defaultMode,
    density: config.density,
    viewKinds: [...config.viewKinds],
    ...(config.palette.id === 'custom'
      ? {
          customPalette: {
            name: config.palette.name,
            light: { ...config.palette.light },
            dark: { ...config.palette.dark },
          },
        }
      : {}),
  }
}

function tokenLines(mode: FrontendColorMode): string[] {
  return [
    `  --eui-color-canvas: ${mode.canvas};`,
    `  --eui-color-surface: ${mode.surface};`,
    `  --eui-color-surface-subtle: ${mode.surfaceSubtle};`,
    `  --eui-color-surface-raised: ${mode.surfaceRaised};`,
    `  --eui-color-text: ${mode.text};`,
    `  --eui-color-text-muted: ${mode.textMuted};`,
    `  --eui-color-text-quiet: ${mode.textQuiet};`,
    `  --eui-color-border: ${mode.border};`,
    `  --eui-color-border-strong: ${mode.borderStrong};`,
    `  --eui-color-accent: ${mode.accent};`,
    `  --eui-color-accent-hover: ${mode.accentHover};`,
    `  --eui-color-accent-active: ${mode.accentActive};`,
    `  --eui-color-accent-soft: ${mode.accentSoft};`,
    `  --eui-color-focus: ${mode.focus};`,
    `  --eui-color-success: ${mode.success};`,
    `  --eui-color-warning: ${mode.warning};`,
    `  --eui-color-danger: ${mode.danger};`,
    `  --eui-color-info: ${mode.info};`,
    `  --eui-shadow-raised: ${mode.shadow};`,
  ]
}

/** Render a portable semantic-token entry point for a generated frontend. */
export function renderFrontendDesignCss(config: FrontendDesignSystemConfig): string {
  const compact = config.density === 'compact'
  return [
    `/* ${config.contractId}; palette: ${config.palette.name}; font: ${config.typography.name}. */`,
    ':root,',
    ':root[data-theme="light"] {',
    '  color-scheme: light;',
    ...tokenLines(config.palette.light),
    `  --eui-font-sans: ${config.typography.stack};`,
    '  --eui-font-mono: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;',
    `  --eui-control-height: ${compact ? '34px' : '40px'};`,
    `  --eui-row-height: ${compact ? '38px' : '46px'};`,
    `  --eui-space-page: ${compact ? '24px' : '32px'};`,
    '  --eui-radius-control: 6px;',
    '  --eui-radius-panel: 8px;',
    '}',
    '',
    ':root[data-theme="dark"] {',
    '  color-scheme: dark;',
    ...tokenLines(config.palette.dark),
    '}',
    '',
    '@media (prefers-color-scheme: dark) {',
    '  :root:not([data-theme]) {',
    '    color-scheme: dark;',
    ...tokenLines(config.palette.dark).map((line) => `  ${line.trim()}`),
    '  }',
    '}',
    '',
    'body {',
    '  background: var(--eui-color-canvas);',
    '  color: var(--eui-color-text);',
    '  font-family: var(--eui-font-sans);',
    '}',
    '',
    ':focus-visible {',
    '  outline: 2px solid var(--eui-color-focus);',
    '  outline-offset: 2px;',
    '}',
    '',
    '@media (prefers-reduced-motion: reduce) {',
    '  *, *::before, *::after {',
    '    scroll-behavior: auto !important;',
    '    transition-duration: 0.01ms !important;',
    '    animation-duration: 0.01ms !important;',
    '    animation-iteration-count: 1 !important;',
    '  }',
    '}',
    '',
  ].join('\n')
}

/** Return a short prompt section that is safe to embed in a frontend brief. */
export function buildFrontendDesignPrompt(config: FrontendDesignSystemConfig): string {
  const layoutLines = config.layouts.flatMap((layout) => [
    `- Use ${layout.name} for ${layout.purpose.toLowerCase()}`,
    `- Use ${layout.composition.navigation} navigation, the ${layout.composition.header} header style, ${layout.composition.actions} actions, and the ${layout.composition.surface} surface model.`,
    `- Include ${layout.requiredRegions.join(', ')}.`,
    `- Avoid ${layout.avoid.join(' and ')}.`,
  ])
  return [
    '## Design system',
    `- Use design contract ${config.contractId}.`,
    `- Use the ${config.palette.name} palette.`,
    `- Use ${config.typography.name} for user interface text.`,
    `- Use ${config.density} density.`,
    '- Use semantic tokens for every color.',
    '- Provide light and dark modes.',
    '- Provide a labeled mode button.',
    '- Store the user mode choice.',
    '- Use the system mode before the user selects a mode.',
    '- Keep one visual identity in both modes.',
    '- Use short labels and direct instructions.',
    '- Apply the approved STE profile to all visible text.',
    '- Use Lucide icons only.',
    '- Use a 24 pixel icon grid and a 2 pixel stroke.',
    '- Use round line caps and line joins.',
    '- Use the same icon for the same action.',
    '- Match each action icon to its verb. Do not reuse a plus or arrow for unrelated actions.',
    '- Put text on primary and uncommon actions.',
    '- Give each icon-only button an accessible name.',
    '- Give each icon-only button a tooltip.',
    '- Show tooltips on pointer hover and keyboard focus.',
    '- Let the Escape key close each tooltip.',
    '- Keep essential instructions outside tooltips.',
    '- Put a help icon next to complex domain terms.',
    '- Use a disclosure when help contains actions.',
    '- Do not use emoji as interface icons.',
    '',
    '## View layouts',
    ...layoutLines,
    '- Select the layout from the user task.',
    '- Let the task control the shell. Do not reuse one shell for every product.',
    '- Do not use a dashboard unless measures are the main task.',
    '- Put the main task before support data.',
    '- Show one primary page action and no more than two secondary page actions.',
    '- Put other actions in a command menu or next to the selected object.',
    '- Do not put the complete action catalog in the page header.',
    '- Use 13 pixel or larger text for normal interface content.',
    '- Reserve 10 to 12 pixel text for short metadata.',
    '- Show progress for work that takes time.',
    '- Confirm a completed action near its source.',
    '- Keep routine success feedback inside the affected action region. Do not cover the workspace with a fixed toast.',
    '',
    '## Visual limits',
    '- Do not use accent strips on cards, tiles, panels, sections, or summary blocks.',
    '- Do not use ornamental sparkles.',
    '- Do not use a grid of equal metric cards.',
    '- Do not put every section in a rounded panel.',
    '- Do not put an overflow menu on every panel. Add one only when the panel has real secondary commands.',
    '- Do not use an em dash in visible text.',
    '- Do not use gradient text or glass effects.',
    '- Do not use a pill for routine text.',
    '- Do not add vague promotional text.',
  ].join('\n')
}

/** Infer useful layout patterns from approved product and capability terms. */
export function inferFrontendViewKinds(values: string[]): FrontendViewKind[] {
  const text = values.join(' ').toLowerCase()
  const result: FrontendViewKind[] = []
  const add = (kind: FrontendViewKind, pattern: RegExp) => {
    if (pattern.test(text)) result.push(kind)
  }
  add('editor', /\b(document|author|write|edit|comment)\b/)
  add('monitor', /\b(monitor|telemetry|channel|signal|live|trend)\b/)
  add('board', /\b(board|session|queue|flow|task|work item)\b/)
  add('graph', /\b(graph|trace|impact|relationship|dependency)\b/)
  add('wizard', /\b(wizard|intake|release|load|setup|guided|phase)\b/)
  add('timeline', /\b(timeline|event|history|log)\b/)
  add('case', /\b(case|finding|incident|failure|review)\b/)
  add('form', /\b(form|create|register|submit|configure)\b/)
  add('table', /\b(table|record|catalog|list|inventory|report)\b/)
  if (result.length === 0) result.push('workbench')
  if (
    !result.includes('workbench')
    && /\b(review|evidence|artifact|analysis|inspect)\b/.test(text)
  ) result.unshift('workbench')
  return [...new Set(result)].slice(0, 3)
}

/**
 * Inspect a complete generated frontend source set. This gate checks system
 * structure. The overlay STE gate checks each visible string separately.
 */
export function evaluateFrontendDesignSources(
  sources: Readonly<Record<string, string>>,
  config: FrontendDesignSystemConfig,
): FrontendDesignFinding[] {
  const sourceEntries = Object.entries(sources)
    .filter(([name]) => /\.(?:css|html?|[cm]?[jt]sx?|vue|svelte|astro)$/i.test(name))
  const joined = sourceEntries
    .map(([, source]) => source)
    .join('\n')
  const markup = sourceEntries
    .filter(([name]) => /\.(?:html?|[cm]?[jt]sx?|vue|svelte|astro)$/i.test(name))
    .map(([, source]) => source)
    .join('\n')
  const styles = sourceEntries
    .filter(([name]) => /\.(?:css|scss|sass|less)$/i.test(name))
    .map(([, source]) => source)
    .join('\n')
  if (!joined.trim()) return []

  const findings: FrontendDesignFinding[] = []
  const require = (condition: boolean, code: string, message: string) => {
    if (!condition) findings.push({ code, severity: 'blocking', message })
  }
  require(
    /--eui-color-canvas\b/.test(joined)
      && /--eui-color-surface\b/.test(joined)
      && /--eui-color-text\b/.test(joined)
      && /--eui-color-accent\b/.test(joined),
    'FRONTEND-DESIGN-TOKENS',
    'The frontend must define and use the semantic color tokens.',
  )
  require(
    /data-theme\s*=\s*["'{][^"'}]*(?:light|dark)/i.test(joined)
      || /\[data-theme\s*=\s*["'](?:light|dark)["']\]/i.test(joined),
    'FRONTEND-DESIGN-MODES',
    'The frontend must define light and dark modes.',
  )
  require(
    /prefers-color-scheme\s*:\s*dark/i.test(joined),
    'FRONTEND-DESIGN-SYSTEM-MODE',
    'The frontend must use the system color mode by default.',
  )
  require(
    /localStorage/i.test(joined) && /theme|color.?mode/i.test(joined),
    'FRONTEND-DESIGN-MODE-STORE',
    'The frontend must store the user mode choice.',
  )
  require(
    /(?:aria-label|title)\s*=\s*["'{][^"'}]*(?:mode|theme)/i.test(joined)
      && /<(?:button|input)[\s\S]{0,240}(?:mode|theme)/i.test(joined),
    'FRONTEND-DESIGN-MODE-BUTTON',
    'The frontend must provide a labeled mode button.',
  )
  require(
    /--eui-font-sans\b/.test(joined) && /font-family\s*:\s*var\(--eui-font-sans\)/i.test(joined),
    'FRONTEND-DESIGN-FONT',
    'The frontend must apply the configured font token.',
  )
  require(
    new RegExp(config.contractId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(joined),
    'FRONTEND-DESIGN-CONTRACT',
    `The frontend must identify design contract ${config.contractId}.`,
  )
  const iconFamilies = [
    ['lucide', /(?:from\s+['"](?:lucide|lucide-react|@lucide\/(?:vue|svelte))['"]|data-lucide=|class=["'][^"']*\blucide\b)/i],
    ['heroicons', /@heroicons\//i],
    ['font-awesome', /(?:fontawesome|fa-[a-z-]+)/i],
    ['material', /(?:@mui\/icons-material|material-icons)/i],
    ['react-icons', /from\s+['"]react-icons\//i],
  ].filter(([, pattern]) => (pattern as RegExp).test(joined)).map(([name]) => name)
  require(
    iconFamilies.length === 1 && iconFamilies[0] === config.icons.family,
    'FRONTEND-DESIGN-ICONS',
    'The frontend must use Lucide as its only interface icon family.',
  )
  require(
    /(?:data-tooltip|role\s*=\s*["']tooltip["']|<Tooltip\b|tooltipContent)/i.test(joined),
    'FRONTEND-DESIGN-TOOLTIP',
    'The frontend must provide accessible tooltips for icon-only controls.',
  )
  require(
    /(?:CircleHelp|HelpCircle|data-lucide\s*=\s*["']circle-help["']|data-help-trigger)/i.test(joined),
    'FRONTEND-DESIGN-HELP',
    'The frontend must provide contextual help for complex terms.',
  )
  const visibleEmDash = />(?:[^<]|<(?!\/?(?:script|style)\b))*\u2014/iu.test(markup)
    || /(?:aria-label|title|placeholder)\s*=\s*["'][^"']*\u2014/iu.test(markup)
  require(
    !visibleEmDash,
    'FRONTEND-DESIGN-EM-DASH',
    'The frontend must not use an em dash in visible text.',
  )
  const tropeChecks: [RegExp, string, string][] = [
    [
      /(?:card|tile|metric|panel|section|summary|well|callout|investigation)[^{]{0,100}\{[^}]*border-(?:left|inline-start)\s*:\s*[3-9]px|(?:card|tile|metric|panel|section|summary|well|callout|investigation)[^{]{0,100}\{[^}]*border-(?:left|inline-start)\s*:\s*2px[^;}]*(?:accent|brand)|(?:card|tile|metric|panel|section|summary|well|callout|investigation)[^{]{0,100}\{[^}]*box-shadow\s*:\s*inset\s+[2-9]px\s+0|(?:card|tile|metric|panel|section|summary|well|callout|investigation)[^{,]*::before\s*\{[^}]*(?:background|border)[^}]*\}/i,
      'FRONTEND-DESIGN-ACCENT-STRIP',
      'Do not use a decorative accent strip on a content container.',
    ],
    [
      /(?:sparkles?|magic-wand|wand-sparkles|✦|✨)/i,
      'FRONTEND-DESIGN-SPARKLE',
      'Do not use an ornamental sparkle or magic icon.',
    ],
    [
      /(?:background-clip\s*:\s*text|(?:hero|card|tile)[^{]{0,100}\{[^}]*background\s*:\s*(?:linear|radial)-gradient|backdrop-filter\s*:\s*blur)/i,
      'FRONTEND-DESIGN-EFFECT',
      'Do not use glass effects or decorative gradients.',
    ],
  ]
  for (const [pattern, code, message] of tropeChecks) {
    if (pattern.test(joined)) findings.push({ code, severity: 'blocking', message })
  }
  if (!/prefers-reduced-motion\s*:\s*reduce/i.test(joined)) {
    findings.push({
      code: 'FRONTEND-DESIGN-MOTION',
      severity: 'warning',
      message: 'The frontend should reduce nonessential motion when the system requests it.',
    })
  }
  const sourceWithoutTokenValues = styles.replace(
    /--(?:eui|[a-z0-9-]*brand)[\w-]*\s*:[^;]+;/gi,
    '',
  )
  const rawColorCount = (sourceWithoutTokenValues.match(/#[\da-f]{3,8}\b/gi) ?? []).length
  if (rawColorCount > 4) {
    findings.push({
      code: 'FRONTEND-DESIGN-RAW-COLOR',
      severity: 'warning',
      message: 'The frontend uses color values outside the semantic token entry point.',
    })
  }
  return findings
}
