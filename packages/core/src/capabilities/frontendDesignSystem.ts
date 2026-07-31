/**
 * Frontend design contract.
 *
 * The contract separates product intent from framework code. Generators receive
 * one resolved configuration. Review gates can then verify the same values.
 */

export const FRONTEND_PALETTE_IDS = [
  'midnight',
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

/** IDs are stable reservations, but generators must not treat them as approved components. */
export const FRONTEND_RESERVED_COMPONENT_IDS = [
  'CMP-LAYOUT-RESIZABLE-PANEL',
  'CMP-VIZ-THRESHOLD-BAND',
  'CMP-ENG-TRACE-MATRIX',
  'CMP-ENG-DIFF-VIEWER',
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
  /** Surface used by dialogs, popovers, and menus. */
  overlay: string
  text: string
  textMuted: string
  textQuiet: string
  border: string
  borderStrong: string
  /** Foreground accent for links, icons, and data emphasis. */
  accentForeground: string
  /** @deprecated Use action for filled primary actions. */
  accent: string
  /** @deprecated Use actionHover for filled primary actions. */
  accentHover: string
  /** @deprecated Use actionActive for filled primary actions. */
  accentActive: string
  /** @deprecated Use selected for selected and active surfaces. */
  accentSoft: string
  action: string
  actionHover: string
  actionActive: string
  onAccent: string
  control: string
  controlHover: string
  selected: string
  selectedBorder: string
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
  recipeId: string
  name: string
  purpose: string
  workspace: FrontendLayoutWorkspacePolicy
  composition: {
    navigation: 'sidebar' | 'rail' | 'top' | 'contextual' | 'none'
    header: 'workspace' | 'editor' | 'instrument' | 'portal' | 'graph' | 'case'
    actions: 'selection-contextual' | 'command-first' | 'step-gated' | 'page-primary'
    surface: 'canvas-sections' | 'bounded-workbench' | 'editor-sheet' | 'control-grid' | 'flow-columns' | 'spatial-canvas'
  }
  geometry: {
    maxContentWidth: number | 'fluid'
    columns: string
    gap: number
    /** Smallest viewport width that can contain the wide grid without clipping. */
    wideMinimumWidth: number
    primaryMinWidth: number
    narrowBreakpoint: number
  }
  regions: FrontendLayoutRegion[]
  componentIds: string[]
  requiredRegions: string[]
  avoid: string[]
}

export type FrontendSurfaceKind =
  | 'primary-work-surface'
  | 'structural-pane'
  | 'inset-object'
  | 'overlay'

export type FrontendWorkspacePolicy = {
  surfaces: Record<FrontendSurfaceKind, {
    elevation: 'flat' | 'contained' | 'raised'
    scope: 'task' | 'structure' | 'object' | 'transient'
  }>
  defaultRegionContainer: 'flat'
  cardsAsDefaultRegionContainers: false
  titleHierarchy: {
    visiblePageHeadingCount: 1
    pageTitleLevel: 1
    pageTitleMustExceedSummary: true
    sectionTitleMustExceedDescription: true
  }
}

export type FrontendLayoutWorkspacePolicy = {
  primaryRegionId: string
  primarySurface: 'primary-work-surface'
  supportingSurface: 'structural-pane'
  objectSurface: 'inset-object'
  transientSurface: 'overlay'
  placement: 'explicit-grid'
  measurement: {
    mode: 'prohibited' | 'task'
    approvedDecisionPurpose: string | null
  }
}

export type FrontendLayoutRegion = {
  id: string
  role: 'navigation' | 'context' | 'primary' | 'inspector' | 'commands' | 'status'
  priority: 1 | 2 | 3
  minWidth: number
  preferredWidth: number | 'fluid'
  narrowBehavior: 'retain' | 'drawer' | 'route' | 'stack' | 'scroll'
  placement: {
    wide: {
      columnStart: number
      columnSpan: number
      rowStart: number
    }
    narrow: {
      order: number
    }
  }
  componentIds: string[]
}

export type FrontendPagePlan = {
  primaryViewKind: FrontendViewKind
  primaryLayout: FrontendLayoutRule
  supportingViewKinds: FrontendViewKind[]
  supportingLayouts: FrontendLayoutRule[]
  geometry: FrontendLayoutRule['geometry']
  regions: FrontendLayoutRegion[]
  primaryComponentIds: string[]
  supportingComponentIds: string[]
  /** @deprecated This alias now contains primary component IDs only. */
  componentIds: string[]
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
  light: FrontendCustomColorMode
  dark: FrontendCustomColorMode
}

type FrontendAddedColorRole =
  | 'overlay'
  | 'accentForeground'
  | 'action'
  | 'actionHover'
  | 'actionActive'
  | 'onAccent'
  | 'control'
  | 'controlHover'
  | 'selected'
  | 'selectedBorder'

/** Existing custom themes can omit the added semantic roles. */
export type FrontendCustomColorMode = Omit<FrontendColorMode, FrontendAddedColorRole>
  & Partial<Pick<FrontendColorMode, FrontendAddedColorRole>>

export type FrontendDesignPreferences = {
  paletteId?: FrontendPaletteId
  fontId?: FrontendFontId
  defaultMode?: FrontendDefaultMode
  density?: FrontendDensity
  viewKinds?: FrontendViewKind[]
  customPalette?: FrontendCustomPalette
}

export type FrontendDesignSystemConfig = {
  schemaVersion: '1.1'
  contractId: 'EUIT-FRONTEND-001'
  writingProfileId: 'EUIT-STE-001'
  palette: FrontendPalette
  typography: FrontendFont
  defaultMode: FrontendDefaultMode
  density: FrontendDensity
  modeToggle: true
  icons: FrontendIconGuide
  workspacePolicy: FrontendWorkspacePolicy
  viewKinds: FrontendViewKind[]
  layouts: FrontendLayoutRule[]
  pagePlan: FrontendPagePlan
}

/** Resolved 1.0 records can be migrated without trusting their derived layout data. */
export type FrontendDesignSystemConfigV1 = {
  schemaVersion: '1.0'
  contractId: 'EUIT-FRONTEND-001'
  writingProfileId: 'EUIT-STE-001'
  palette: Omit<FrontendPalette, 'light' | 'dark'> & {
    light: FrontendCustomColorMode
    dark: FrontendCustomColorMode
  }
  typography: FrontendFont
  defaultMode: FrontendDefaultMode
  density: FrontendDensity
  modeToggle: true
  icons?: FrontendIconGuide
  viewKinds: FrontendViewKind[]
  layouts?: unknown[]
}

export type FrontendDesignSystemConfigInput =
  | FrontendDesignSystemConfig
  | FrontendDesignSystemConfigV1

export type FrontendDesignFinding = {
  code: string
  severity: 'blocking' | 'warning'
  message: string
}

const midnightLight: FrontendColorMode = {
  canvas: '#f6f8fa',
  surface: '#ffffff',
  surfaceSubtle: '#ffffff',
  surfaceRaised: '#ffffff',
  overlay: '#ffffff',
  text: '#1f2328',
  textMuted: '#59636e',
  textQuiet: '#656d76',
  border: '#d0d7de',
  borderStrong: '#818b98',
  accentForeground: '#0969da',
  accent: '#0969da',
  accentHover: '#0860ca',
  accentActive: '#0757ba',
  accentSoft: '#ddf4ff',
  action: '#0969da',
  actionHover: '#0860ca',
  actionActive: '#0757ba',
  onAccent: '#ffffff',
  control: '#f6f8fa',
  controlHover: '#eef1f4',
  selected: '#ddf4ff',
  selectedBorder: '#0969da',
  focus: '#0969da',
  success: '#176b3a',
  warning: '#805400',
  danger: '#b42318',
  info: '#0969da',
  shadow: '0 12px 32px rgba(31, 35, 40, 0.14)',
}

const midnightDark: FrontendColorMode = {
  canvas: '#0d1117',
  surface: '#161b22',
  surfaceSubtle: '#161b22',
  surfaceRaised: '#161b22',
  overlay: '#1c2128',
  text: '#f0f6fc',
  textMuted: '#b1bac4',
  textQuiet: '#8b949e',
  border: '#30363d',
  borderStrong: '#6e7681',
  accentForeground: '#58a6ff',
  accent: '#1f6feb',
  accentHover: '#1a64d6',
  accentActive: '#195bbf',
  accentSoft: '#1b2a3a',
  action: '#1f6feb',
  actionHover: '#1a64d6',
  actionActive: '#195bbf',
  onAccent: '#ffffff',
  control: '#0d1117',
  controlHover: '#1c2128',
  selected: '#1b2a3a',
  selectedBorder: '#58a6ff',
  focus: '#58a6ff',
  success: '#57c785',
  warning: '#e5b95c',
  danger: '#ff7b72',
  info: '#58a6ff',
  shadow: '0 18px 48px rgba(0, 0, 0, 0.38)',
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
    light: { ...midnightLight, ...light },
    dark: { ...midnightDark, ...dark },
  }
}

export const FRONTEND_PALETTES: Readonly<Record<Exclude<FrontendPaletteId, 'custom'>, FrontendPalette>> = {
  midnight: palette(
    'midnight',
    'Midnight blue',
    'Neutral graphite surfaces with restrained blue actions and emphasis.',
    {},
    {},
  ),
  graphite: palette(
    'graphite',
    'Graphite',
    'Neutral graphite surfaces with blue links and a green primary action.',
    {
      action: '#1f883d',
      actionHover: '#1a7f37',
      actionActive: '#1f7a32',
      accent: '#1f883d',
      accentHover: '#1a7f37',
      accentActive: '#1f7a32',
      accentSoft: '#dafbe1',
      selected: '#dafbe1',
      selectedBorder: '#1f883d',
      focus: '#0969da',
      info: '#0969da',
    },
    {
      action: '#238636',
      actionHover: '#1f7a32',
      actionActive: '#196c2e',
      accent: '#238636',
      accentHover: '#1f7a32',
      accentActive: '#196c2e',
      accentSoft: '#182f20',
      selected: '#182f20',
      selectedBorder: '#3fb950',
      focus: '#58a6ff',
      info: '#58a6ff',
    },
  ),
  teal: palette(
    'teal',
    'Deep teal',
    'Neutral graphite surfaces with a calm teal interaction accent.',
    {
      accentForeground: '#006b66',
      action: '#006b66',
      actionHover: '#005f5b',
      actionActive: '#00534f',
      accent: '#006b66',
      accentHover: '#005f5b',
      accentActive: '#00534f',
      accentSoft: '#daf5f2',
      selected: '#daf5f2',
      selectedBorder: '#006b66',
      focus: '#087b7f',
      info: '#006b66',
    },
    {
      accentForeground: '#56d4cd',
      action: '#087f76',
      actionHover: '#07746c',
      actionActive: '#066860',
      accent: '#087f76',
      accentHover: '#07746c',
      accentActive: '#066860',
      accentSoft: '#153331',
      selected: '#153331',
      selectedBorder: '#2ba9a1',
      focus: '#56d4cd',
      info: '#56d4cd',
    },
  ),
  violet: palette(
    'violet',
    'Technical violet',
    'Neutral graphite surfaces with a focused violet interaction accent.',
    {
      accentForeground: '#6f42c1',
      action: '#6f42c1',
      actionHover: '#6339b2',
      actionActive: '#56319f',
      accent: '#6f42c1',
      accentHover: '#6339b2',
      accentActive: '#56319f',
      accentSoft: '#f0e7ff',
      selected: '#f0e7ff',
      selectedBorder: '#6f42c1',
      focus: '#6f42c1',
      info: '#6f42c1',
    },
    {
      accentForeground: '#a985f5',
      action: '#8250df',
      actionHover: '#7546cc',
      actionActive: '#673bb8',
      accent: '#8250df',
      accentHover: '#7546cc',
      accentActive: '#673bb8',
      accentSoft: '#2a203d',
      selected: '#2a203d',
      selectedBorder: '#a985f5',
      focus: '#a985f5',
      info: '#a985f5',
    },
  ),
  amber: palette(
    'amber',
    'Flight amber',
    'Neutral graphite surfaces with a restrained amber interaction accent.',
    {
      accentForeground: '#7d4e00',
      action: '#9a6700',
      actionHover: '#895b00',
      actionActive: '#7a5100',
      accent: '#9a6700',
      accentHover: '#895b00',
      accentActive: '#7a5100',
      accentSoft: '#fff1d2',
      selected: '#fff1d2',
      selectedBorder: '#7d4e00',
      focus: '#9a6700',
      info: '#005c96',
    },
    {
      accentForeground: '#d29922',
      action: '#9e6a03',
      actionHover: '#8f5f02',
      actionActive: '#805500',
      accent: '#9e6a03',
      accentHover: '#8f5f02',
      accentActive: '#805500',
      accentSoft: '#33280f',
      selected: '#33280f',
      selectedBorder: '#d29922',
      focus: '#d29922',
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

export const FRONTEND_WORKSPACE_POLICY: FrontendWorkspacePolicy = {
  surfaces: {
    'primary-work-surface': { elevation: 'flat', scope: 'task' },
    'structural-pane': { elevation: 'flat', scope: 'structure' },
    'inset-object': { elevation: 'contained', scope: 'object' },
    overlay: { elevation: 'raised', scope: 'transient' },
  },
  defaultRegionContainer: 'flat',
  cardsAsDefaultRegionContainers: false,
  titleHierarchy: {
    visiblePageHeadingCount: 1,
    pageTitleLevel: 1,
    pageTitleMustExceedSummary: true,
    sectionTitleMustExceedDescription: true,
  },
}

function layoutWorkspace(
  primaryRegionId: string,
  approvedDecisionPurpose: string | null = null,
): FrontendLayoutWorkspacePolicy {
  return {
    primaryRegionId,
    primarySurface: 'primary-work-surface',
    supportingSurface: 'structural-pane',
    objectSurface: 'inset-object',
    transientSurface: 'overlay',
    placement: 'explicit-grid',
    measurement: approvedDecisionPurpose === null
      ? { mode: 'prohibited', approvedDecisionPurpose: null }
      : { mode: 'task', approvedDecisionPurpose },
  }
}

export const FRONTEND_LAYOUT_RULES: Readonly<Record<FrontendViewKind, FrontendLayoutRule>> = {
  workbench: {
    kind: 'workbench',
    recipeId: 'RCP-WORKBENCH-001',
    name: 'Review workbench',
    purpose: 'Inspect one artifact and its evidence.',
    workspace: layoutWorkspace('work-surface'),
    composition: {
      navigation: 'sidebar',
      header: 'workspace',
      actions: 'selection-contextual',
      surface: 'bounded-workbench',
    },
    geometry: {
      maxContentWidth: 'fluid',
      columns: 'minmax(220px, 0.7fr) minmax(480px, 1.7fr) minmax(280px, 0.9fr)',
      gap: 12,
      wideMinimumWidth: 1004,
      primaryMinWidth: 480,
      narrowBreakpoint: 1024,
    },
    regions: [
      { id: 'context-rail', role: 'context', priority: 2, minWidth: 220, preferredWidth: 260, narrowBehavior: 'drawer', placement: { wide: { columnStart: 1, columnSpan: 1, rowStart: 1 }, narrow: { order: 2 } }, componentIds: ['CMP-ENG-ARTIFACT-TREE', 'CMP-FILTER-BAR'] },
      { id: 'work-surface', role: 'primary', priority: 1, minWidth: 480, preferredWidth: 'fluid', narrowBehavior: 'retain', placement: { wide: { columnStart: 2, columnSpan: 1, rowStart: 1 }, narrow: { order: 1 } }, componentIds: ['CMP-ENG-CODE-BLOCK', 'CMP-ENG-EVIDENCE-CARD'] },
      { id: 'detail-inspector', role: 'inspector', priority: 2, minWidth: 280, preferredWidth: 320, narrowBehavior: 'drawer', placement: { wide: { columnStart: 3, columnSpan: 1, rowStart: 1 }, narrow: { order: 3 } }, componentIds: ['CMP-LAYOUT-DETAIL', 'CMP-FEEDBACK-VALIDATION-SUMMARY'] },
    ],
    componentIds: ['CMP-ENG-ARTIFACT-TREE', 'CMP-FILTER-BAR', 'CMP-ENG-CODE-BLOCK', 'CMP-ENG-EVIDENCE-CARD', 'CMP-LAYOUT-DETAIL', 'CMP-FEEDBACK-VALIDATION-SUMMARY'],
    requiredRegions: ['context rail', 'primary work surface', 'detail inspector'],
    avoid: ['metric card wall', 'equal panels without a task order'],
  },
  table: {
    kind: 'table',
    recipeId: 'RCP-TABLE-001',
    name: 'Record table',
    purpose: 'Find, compare, and act on many records.',
    workspace: layoutWorkspace('record-table'),
    composition: {
      navigation: 'sidebar',
      header: 'workspace',
      actions: 'selection-contextual',
      surface: 'canvas-sections',
    },
    geometry: {
      maxContentWidth: 1440,
      columns: 'minmax(0, 1fr) minmax(280px, 0.32fr)',
      gap: 16,
      wideMinimumWidth: 936,
      primaryMinWidth: 640,
      narrowBreakpoint: 960,
    },
    regions: [
      { id: 'table-commands', role: 'commands', priority: 1, minWidth: 320, preferredWidth: 'fluid', narrowBehavior: 'retain', placement: { wide: { columnStart: 1, columnSpan: 2, rowStart: 1 }, narrow: { order: 1 } }, componentIds: ['CMP-FILTER-BAR', 'CMP-NAV-COMMAND-ACTION-BAR'] },
      { id: 'record-table', role: 'primary', priority: 1, minWidth: 640, preferredWidth: 'fluid', narrowBehavior: 'scroll', placement: { wide: { columnStart: 1, columnSpan: 1, rowStart: 2 }, narrow: { order: 2 } }, componentIds: ['CMP-TABLE-DATA-TABLE', 'CMP-TABLE-PAGINATION'] },
      { id: 'selection-detail', role: 'inspector', priority: 2, minWidth: 280, preferredWidth: 320, narrowBehavior: 'drawer', placement: { wide: { columnStart: 2, columnSpan: 1, rowStart: 2 }, narrow: { order: 3 } }, componentIds: ['CMP-LAYOUT-DETAIL'] },
    ],
    componentIds: ['CMP-FILTER-BAR', 'CMP-NAV-COMMAND-ACTION-BAR', 'CMP-TABLE-DATA-TABLE', 'CMP-TABLE-PAGINATION', 'CMP-LAYOUT-DETAIL'],
    requiredRegions: ['filter bar', 'data table', 'row or selection detail'],
    avoid: ['record card grid', 'wrapped identifier columns'],
  },
  form: {
    kind: 'form',
    recipeId: 'RCP-FORM-001',
    name: 'Focused form',
    purpose: 'Enter or change one coherent record.',
    workspace: layoutWorkspace('form-fields'),
    composition: {
      navigation: 'contextual',
      header: 'portal',
      actions: 'page-primary',
      surface: 'bounded-workbench',
    },
    geometry: {
      maxContentWidth: 960,
      columns: 'minmax(0, 640px)',
      gap: 20,
      wideMinimumWidth: 320,
      primaryMinWidth: 320,
      narrowBreakpoint: 720,
    },
    regions: [
      { id: 'form-context', role: 'context', priority: 2, minWidth: 280, preferredWidth: 640, narrowBehavior: 'stack', placement: { wide: { columnStart: 1, columnSpan: 1, rowStart: 1 }, narrow: { order: 1 } }, componentIds: ['CMP-SHELL-PAGE-HEADER'] },
      { id: 'form-fields', role: 'primary', priority: 1, minWidth: 320, preferredWidth: 640, narrowBehavior: 'retain', placement: { wide: { columnStart: 1, columnSpan: 1, rowStart: 2 }, narrow: { order: 2 } }, componentIds: ['CMP-FORM-FIELD', 'CMP-FEEDBACK-VALIDATION-SUMMARY'] },
      { id: 'form-actions', role: 'commands', priority: 1, minWidth: 280, preferredWidth: 640, narrowBehavior: 'retain', placement: { wide: { columnStart: 1, columnSpan: 1, rowStart: 3 }, narrow: { order: 3 } }, componentIds: ['CMP-NAV-COMMAND-ACTION-BAR'] },
    ],
    componentIds: ['CMP-SHELL-PAGE-HEADER', 'CMP-FORM-FIELD', 'CMP-FEEDBACK-VALIDATION-SUMMARY', 'CMP-NAV-COMMAND-ACTION-BAR'],
    requiredRegions: ['short context', 'grouped fields', 'stable action area'],
    avoid: ['placeholder-only labels', 'full-width fields for short values'],
  },
  editor: {
    kind: 'editor',
    recipeId: 'RCP-EDITOR-001',
    name: 'Document editor',
    purpose: 'Create content and resolve review input.',
    workspace: layoutWorkspace('document-canvas'),
    composition: {
      navigation: 'contextual',
      header: 'editor',
      actions: 'command-first',
      surface: 'editor-sheet',
    },
    geometry: {
      maxContentWidth: 'fluid',
      columns: 'minmax(200px, 0.45fr) minmax(520px, 1.5fr) minmax(300px, 0.65fr)',
      gap: 0,
      wideMinimumWidth: 1020,
      primaryMinWidth: 520,
      narrowBreakpoint: 1080,
    },
    regions: [
      { id: 'document-outline', role: 'context', priority: 2, minWidth: 200, preferredWidth: 240, narrowBehavior: 'drawer', placement: { wide: { columnStart: 1, columnSpan: 1, rowStart: 1 }, narrow: { order: 2 } }, componentIds: ['CMP-NAV-SECONDARY'] },
      { id: 'document-canvas', role: 'primary', priority: 1, minWidth: 520, preferredWidth: 'fluid', narrowBehavior: 'retain', placement: { wide: { columnStart: 2, columnSpan: 1, rowStart: 1 }, narrow: { order: 1 } }, componentIds: ['CMP-SURFACE-INSET-PANEL'] },
      { id: 'review-inspector', role: 'inspector', priority: 2, minWidth: 300, preferredWidth: 340, narrowBehavior: 'drawer', placement: { wide: { columnStart: 3, columnSpan: 1, rowStart: 1 }, narrow: { order: 3 } }, componentIds: ['CMP-FEEDBACK-VALIDATION-SUMMARY', 'CMP-WORKFLOW-TIMELINE-EVENT-LOG'] },
    ],
    componentIds: ['CMP-NAV-SECONDARY', 'CMP-SURFACE-INSET-PANEL', 'CMP-FEEDBACK-VALIDATION-SUMMARY', 'CMP-WORKFLOW-TIMELINE-EVENT-LOG'],
    requiredRegions: ['outline', 'document canvas', 'review inspector'],
    avoid: ['dashboard summary before the document', 'nested cards around prose'],
  },
  monitor: {
    kind: 'monitor',
    recipeId: 'RCP-MONITOR-001',
    name: 'Live monitor',
    purpose: 'Watch state and investigate change over time.',
    workspace: layoutWorkspace('primary-plot', 'decide-if-state-needs-action'),
    composition: {
      navigation: 'rail',
      header: 'instrument',
      actions: 'selection-contextual',
      surface: 'control-grid',
    },
    geometry: {
      maxContentWidth: 'fluid',
      columns: 'minmax(210px, 0.45fr) minmax(560px, 1.65fr) minmax(300px, 0.65fr)',
      gap: 0,
      wideMinimumWidth: 1070,
      primaryMinWidth: 560,
      narrowBreakpoint: 1120,
    },
    regions: [
      { id: 'scope-rail', role: 'context', priority: 2, minWidth: 210, preferredWidth: 240, narrowBehavior: 'drawer', placement: { wide: { columnStart: 1, columnSpan: 1, rowStart: 1 }, narrow: { order: 2 } }, componentIds: ['CMP-FILTER-BAR', 'CMP-NAV-SECONDARY'] },
      { id: 'primary-plot', role: 'primary', priority: 1, minWidth: 560, preferredWidth: 'fluid', narrowBehavior: 'retain', placement: { wide: { columnStart: 2, columnSpan: 1, rowStart: 1 }, narrow: { order: 1 } }, componentIds: ['CMP-VIZ-CHART-PANEL', 'CMP-VIZ-LINE-CHART', 'CMP-VIZ-LEGEND'] },
      { id: 'event-stream', role: 'inspector', priority: 2, minWidth: 300, preferredWidth: 340, narrowBehavior: 'drawer', placement: { wide: { columnStart: 3, columnSpan: 1, rowStart: 1 }, narrow: { order: 3 } }, componentIds: ['CMP-WORKFLOW-TIMELINE-EVENT-LOG'] },
    ],
    componentIds: ['CMP-FILTER-BAR', 'CMP-NAV-SECONDARY', 'CMP-VIZ-CHART-PANEL', 'CMP-VIZ-LINE-CHART', 'CMP-VIZ-LEGEND', 'CMP-WORKFLOW-TIMELINE-EVENT-LOG'],
    requiredRegions: ['channel or scope rail', 'primary plot', 'event stream'],
    avoid: ['equal KPI tiles as the main content', 'color-only alarms'],
  },
  board: {
    kind: 'board',
    recipeId: 'RCP-BOARD-001',
    name: 'Flow board',
    purpose: 'Move work through explicit states.',
    workspace: layoutWorkspace('flow-columns'),
    composition: {
      navigation: 'rail',
      header: 'workspace',
      actions: 'selection-contextual',
      surface: 'flow-columns',
    },
    geometry: {
      maxContentWidth: 'fluid',
      columns: 'minmax(680px, 1fr) minmax(300px, 0.34fr)',
      gap: 16,
      wideMinimumWidth: 996,
      primaryMinWidth: 680,
      narrowBreakpoint: 1040,
    },
    regions: [
      { id: 'flow-columns', role: 'primary', priority: 1, minWidth: 680, preferredWidth: 'fluid', narrowBehavior: 'scroll', placement: { wide: { columnStart: 1, columnSpan: 1, rowStart: 2 }, narrow: { order: 2 } }, componentIds: ['CMP-WORKFLOW-FLOW-BOARD'] },
      { id: 'work-detail', role: 'inspector', priority: 2, minWidth: 300, preferredWidth: 340, narrowBehavior: 'drawer', placement: { wide: { columnStart: 2, columnSpan: 1, rowStart: 2 }, narrow: { order: 3 } }, componentIds: ['CMP-LAYOUT-DETAIL', 'CMP-WORKFLOW-TIMELINE-EVENT-LOG'] },
      { id: 'board-actions', role: 'commands', priority: 1, minWidth: 280, preferredWidth: 'fluid', narrowBehavior: 'retain', placement: { wide: { columnStart: 1, columnSpan: 2, rowStart: 1 }, narrow: { order: 1 } }, componentIds: ['CMP-NAV-COMMAND-ACTION-BAR'] },
    ],
    componentIds: ['CMP-WORKFLOW-FLOW-BOARD', 'CMP-LAYOUT-DETAIL', 'CMP-WORKFLOW-TIMELINE-EVENT-LOG', 'CMP-NAV-COMMAND-ACTION-BAR'],
    requiredRegions: ['state columns', 'work items', 'selected item detail'],
    avoid: ['duplicate summary dashboard', 'unclear item ownership'],
  },
  graph: {
    kind: 'graph',
    recipeId: 'RCP-GRAPH-001',
    name: 'Relationship graph',
    purpose: 'Trace impact and inspect relationships.',
    workspace: layoutWorkspace('graph-canvas'),
    composition: {
      navigation: 'none',
      header: 'graph',
      actions: 'selection-contextual',
      surface: 'spatial-canvas',
    },
    geometry: {
      maxContentWidth: 'fluid',
      columns: 'minmax(640px, 1fr) minmax(300px, 0.34fr)',
      gap: 0,
      wideMinimumWidth: 940,
      primaryMinWidth: 640,
      narrowBreakpoint: 980,
    },
    regions: [
      { id: 'change-context', role: 'context', priority: 2, minWidth: 280, preferredWidth: 'fluid', narrowBehavior: 'stack', placement: { wide: { columnStart: 1, columnSpan: 2, rowStart: 1 }, narrow: { order: 1 } }, componentIds: ['CMP-CONTENT-KEY-VALUE-LIST', 'CMP-ENG-REQUIREMENT-LINK'] },
      { id: 'graph-canvas', role: 'primary', priority: 1, minWidth: 640, preferredWidth: 'fluid', narrowBehavior: 'scroll', placement: { wide: { columnStart: 1, columnSpan: 1, rowStart: 2 }, narrow: { order: 2 } }, componentIds: ['CMP-SURFACE-INSET-PANEL', 'CMP-ENG-REQUIREMENT-LINK'] },
      { id: 'selection-detail', role: 'inspector', priority: 2, minWidth: 300, preferredWidth: 340, narrowBehavior: 'drawer', placement: { wide: { columnStart: 2, columnSpan: 1, rowStart: 2 }, narrow: { order: 3 } }, componentIds: ['CMP-LAYOUT-DETAIL', 'CMP-ENG-EVIDENCE-CARD'] },
    ],
    componentIds: ['CMP-CONTENT-KEY-VALUE-LIST', 'CMP-ENG-REQUIREMENT-LINK', 'CMP-SURFACE-INSET-PANEL', 'CMP-LAYOUT-DETAIL', 'CMP-ENG-EVIDENCE-CARD'],
    requiredRegions: ['change context', 'graph canvas', 'selection detail'],
    avoid: ['decorative network view', 'labels without selection detail'],
  },
  wizard: {
    kind: 'wizard',
    recipeId: 'RCP-WIZARD-001',
    name: 'Guided task',
    purpose: 'Complete a gated sequence.',
    workspace: layoutWorkspace('current-step'),
    composition: {
      navigation: 'top',
      header: 'portal',
      actions: 'step-gated',
      surface: 'bounded-workbench',
    },
    geometry: {
      maxContentWidth: 960,
      columns: 'minmax(320px, 720px)',
      gap: 20,
      wideMinimumWidth: 320,
      primaryMinWidth: 320,
      narrowBreakpoint: 720,
    },
    regions: [
      { id: 'task-progress', role: 'status', priority: 2, minWidth: 280, preferredWidth: 720, narrowBehavior: 'retain', placement: { wide: { columnStart: 1, columnSpan: 1, rowStart: 1 }, narrow: { order: 1 } }, componentIds: ['CMP-WORKFLOW-STEP-INDICATOR'] },
      { id: 'current-step', role: 'primary', priority: 1, minWidth: 320, preferredWidth: 720, narrowBehavior: 'retain', placement: { wide: { columnStart: 1, columnSpan: 1, rowStart: 2 }, narrow: { order: 2 } }, componentIds: ['CMP-FORM-FIELD', 'CMP-FEEDBACK-VALIDATION-SUMMARY'] },
      { id: 'step-actions', role: 'commands', priority: 1, minWidth: 280, preferredWidth: 720, narrowBehavior: 'retain', placement: { wide: { columnStart: 1, columnSpan: 1, rowStart: 3 }, narrow: { order: 3 } }, componentIds: ['CMP-NAV-COMMAND-ACTION-BAR'] },
    ],
    componentIds: ['CMP-WORKFLOW-STEP-INDICATOR', 'CMP-FORM-FIELD', 'CMP-FEEDBACK-VALIDATION-SUMMARY', 'CMP-NAV-COMMAND-ACTION-BAR'],
    requiredRegions: ['progress', 'current step', 'back and next actions'],
    avoid: ['all steps on one screen', 'stepper for two simple modes'],
  },
  case: {
    kind: 'case',
    recipeId: 'RCP-CASE-001',
    name: 'Case workspace',
    purpose: 'Investigate and close one case.',
    workspace: layoutWorkspace('case-evidence'),
    composition: {
      navigation: 'sidebar',
      header: 'case',
      actions: 'selection-contextual',
      surface: 'bounded-workbench',
    },
    geometry: {
      maxContentWidth: 'fluid',
      columns: 'minmax(240px, 0.55fr) minmax(520px, 1.45fr) minmax(300px, 0.7fr)',
      gap: 12,
      wideMinimumWidth: 1084,
      primaryMinWidth: 520,
      narrowBreakpoint: 1100,
    },
    regions: [
      { id: 'case-list', role: 'context', priority: 2, minWidth: 240, preferredWidth: 280, narrowBehavior: 'route', placement: { wide: { columnStart: 1, columnSpan: 1, rowStart: 1 }, narrow: { order: 2 } }, componentIds: ['CMP-FILTER-BAR', 'CMP-TABLE-DATA-TABLE'] },
      { id: 'case-evidence', role: 'primary', priority: 1, minWidth: 520, preferredWidth: 'fluid', narrowBehavior: 'retain', placement: { wide: { columnStart: 2, columnSpan: 1, rowStart: 1 }, narrow: { order: 1 } }, componentIds: ['CMP-ENG-EVIDENCE-CARD', 'CMP-ENG-CODE-BLOCK', 'CMP-WORKFLOW-TIMELINE-EVENT-LOG'] },
      { id: 'decision-area', role: 'inspector', priority: 2, minWidth: 300, preferredWidth: 340, narrowBehavior: 'drawer', placement: { wide: { columnStart: 3, columnSpan: 1, rowStart: 1 }, narrow: { order: 3 } }, componentIds: ['CMP-LAYOUT-DETAIL', 'CMP-NAV-COMMAND-ACTION-BAR'] },
    ],
    componentIds: ['CMP-FILTER-BAR', 'CMP-TABLE-DATA-TABLE', 'CMP-ENG-EVIDENCE-CARD', 'CMP-ENG-CODE-BLOCK', 'CMP-WORKFLOW-TIMELINE-EVENT-LOG', 'CMP-LAYOUT-DETAIL', 'CMP-NAV-COMMAND-ACTION-BAR'],
    requiredRegions: ['case list', 'case evidence', 'decision or action area'],
    avoid: ['case card grid', 'hidden case status'],
  },
  timeline: {
    kind: 'timeline',
    recipeId: 'RCP-TIMELINE-001',
    name: 'Event timeline',
    purpose: 'Review ordered events and evidence.',
    workspace: layoutWorkspace('event-sequence'),
    composition: {
      navigation: 'contextual',
      header: 'instrument',
      actions: 'selection-contextual',
      surface: 'canvas-sections',
    },
    geometry: {
      maxContentWidth: 1280,
      columns: 'minmax(520px, 1fr) minmax(300px, 0.4fr)',
      gap: 16,
      wideMinimumWidth: 836,
      primaryMinWidth: 520,
      narrowBreakpoint: 900,
    },
    regions: [
      { id: 'time-controls', role: 'commands', priority: 1, minWidth: 300, preferredWidth: 'fluid', narrowBehavior: 'retain', placement: { wide: { columnStart: 1, columnSpan: 2, rowStart: 1 }, narrow: { order: 1 } }, componentIds: ['CMP-FILTER-BAR', 'CMP-FORM-DATE-TIME-INPUT'] },
      { id: 'event-sequence', role: 'primary', priority: 1, minWidth: 520, preferredWidth: 'fluid', narrowBehavior: 'retain', placement: { wide: { columnStart: 1, columnSpan: 1, rowStart: 2 }, narrow: { order: 2 } }, componentIds: ['CMP-WORKFLOW-TIMELINE-EVENT-LOG'] },
      { id: 'event-detail', role: 'inspector', priority: 2, minWidth: 300, preferredWidth: 340, narrowBehavior: 'drawer', placement: { wide: { columnStart: 2, columnSpan: 1, rowStart: 2 }, narrow: { order: 3 } }, componentIds: ['CMP-LAYOUT-DETAIL', 'CMP-ENG-EVIDENCE-CARD'] },
    ],
    componentIds: ['CMP-FILTER-BAR', 'CMP-FORM-DATE-TIME-INPUT', 'CMP-WORKFLOW-TIMELINE-EVENT-LOG', 'CMP-LAYOUT-DETAIL', 'CMP-ENG-EVIDENCE-CARD'],
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

const FRONTEND_COLOR_ROLE_KEYS: ReadonlyArray<Exclude<keyof FrontendColorMode, 'shadow'>> = [
  'canvas',
  'surface',
  'surfaceSubtle',
  'surfaceRaised',
  'overlay',
  'text',
  'textMuted',
  'textQuiet',
  'border',
  'borderStrong',
  'accentForeground',
  'accent',
  'accentHover',
  'accentActive',
  'accentSoft',
  'action',
  'actionHover',
  'actionActive',
  'onAccent',
  'control',
  'controlHover',
  'selected',
  'selectedBorder',
  'focus',
  'success',
  'warning',
  'danger',
  'info',
]

function relativeLuminance(hex: unknown): number {
  if (typeof hex !== 'string' || !/^#[\da-f]{6}$/iu.test(hex)) return Number.NaN
  const channels = hex.slice(1).match(/../g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255) ?? []
  const [red = 0, green = 0, blue = 0] = channels.map((channel) => (
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  ))
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrastRatio(foreground: unknown, background: unknown): number {
  const first = relativeLuminance(foreground)
  const second = relativeLuminance(background)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

function contrastingText(background: unknown): '#000000' | '#ffffff' {
  return contrastRatio('#ffffff', background) >= contrastRatio('#000000', background)
    ? '#ffffff'
    : '#000000'
}

function normalizeCustomColorMode(
  value: FrontendCustomColorMode,
): FrontendColorMode {
  const action = value.action ?? value.accent
  const accentForeground = value.accentForeground
    ?? [value.focus, value.info, value.accent, value.text]
      .find((candidate) => contrastRatio(candidate, value.canvas) >= 4.5)
    ?? value.text
  return {
    ...value,
    overlay: value.overlay ?? value.surfaceRaised,
    accentForeground,
    action,
    actionHover: value.actionHover ?? value.accentHover,
    actionActive: value.actionActive ?? value.accentActive,
    onAccent: value.onAccent ?? contrastingText(action),
    control: value.control ?? value.surfaceSubtle,
    controlHover: value.controlHover ?? value.surfaceRaised,
    selected: value.selected ?? value.accentSoft,
    selectedBorder: value.selectedBorder ?? value.accent,
  }
}

function validateColorMode(mode: FrontendColorMode, label: string): void {
  for (const role of FRONTEND_COLOR_ROLE_KEYS) {
    if (!/^#[\da-f]{6}$/iu.test(mode[role])) {
      throw new Error(`Invalid ${label} palette value for ${role}. Use a six-digit hex color.`)
    }
  }
  if (
    typeof mode.shadow !== 'string'
    || mode.shadow.length > 120
    || !/^[\w\s().,%+-]+$/u.test(mode.shadow)
  ) {
    throw new Error(`Invalid ${label} palette value for shadow.`)
  }

  const requireContrast = (
    foreground: keyof FrontendColorMode,
    background: keyof FrontendColorMode,
    minimum: number,
  ) => {
    const foregroundValue = mode[foreground]
    const backgroundValue = mode[background]
    if (
      foreground === 'shadow'
      || background === 'shadow'
      || contrastRatio(foregroundValue, backgroundValue) < minimum
    ) {
      throw new Error(
        `Invalid ${label} palette contrast for ${foreground} on ${background}. The ratio must be at least ${minimum}:1.`,
      )
    }
  }

  if (mode.canvas.toLowerCase() === mode.surface.toLowerCase()) {
    throw new Error(`Invalid ${label} palette surfaces. Canvas and surface must be distinct.`)
  }
  if (mode.selected.toLowerCase() === mode.surface.toLowerCase()) {
    throw new Error(`Invalid ${label} selected color. It must be distinct from surface.`)
  }
  for (const background of [
    'canvas',
    'surface',
    'surfaceSubtle',
    'surfaceRaised',
    'overlay',
    'control',
    'controlHover',
    'selected',
  ] as const) {
    requireContrast('text', background, 4.5)
  }
  for (const background of ['canvas', 'surface', 'overlay', 'control', 'selected'] as const) {
    requireContrast('textMuted', background, 4.5)
  }
  requireContrast('textQuiet', 'canvas', 4.5)
  requireContrast('textQuiet', 'surface', 4.5)
  for (const background of [
    'canvas',
    'surface',
    'overlay',
    'control',
    'controlHover',
    'selected',
  ] as const) {
    requireContrast('accentForeground', background, 4.5)
  }
  requireContrast('onAccent', 'action', 4.5)
  requireContrast('onAccent', 'actionHover', 4.5)
  requireContrast('onAccent', 'actionActive', 4.5)
  for (const background of [
    'canvas',
    'surface',
    'overlay',
    'control',
    'controlHover',
    'selected',
  ] as const) {
    requireContrast('focus', background, 3)
  }
  requireContrast('selectedBorder', 'selected', 3)
  requireContrast('selectedBorder', 'surface', 3)
  for (const background of ['surface', 'overlay', 'control'] as const) {
    requireContrast('borderStrong', background, 3)
  }
  for (const foreground of ['success', 'warning', 'danger', 'info'] as const) {
    requireContrast(foreground, 'canvas', 4.5)
    requireContrast(foreground, 'surface', 4.5)
  }
}

function validatePalette(value: FrontendPalette): void {
  validateColorMode(value.light, `${value.name} light`)
  validateColorMode(value.dark, `${value.name} dark`)
}

function customPalette(value?: FrontendCustomPalette): FrontendPalette {
  if (!value || !value.light || !value.dark) {
    throw new Error('A custom palette requires light and dark token values.')
  }
  const name = typeof value.name === 'string' ? value.name.trim() || 'Custom' : 'Custom'
  if (name.length > 80 || /[\u0000-\u001f{};]/u.test(name) || /\/\*|\*\//u.test(name)) {
    throw new Error('A custom palette name contains unsupported characters.')
  }
  const resolved: FrontendPalette = {
    id: 'custom',
    name,
    description: 'Project-defined enterprise palette.',
    light: normalizeCustomColorMode(value.light),
    dark: normalizeCustomColorMode(value.dark),
  }
  validatePalette(resolved)
  return resolved
}

function uniqueViewKinds(values: FrontendViewKind[] | undefined): FrontendViewKind[] {
  const source: FrontendViewKind[] = values?.length ? values : ['workbench']
  const result = [...new Set(source)].filter((value): value is FrontendViewKind =>
    FRONTEND_VIEW_KINDS.includes(value))
  return result.length ? result : ['workbench']
}

function gridTrackMinimums(columns: string): number[] {
  return [...columns.matchAll(/minmax\(\s*(\d+(?:\.\d+)?)px|minmax\(\s*0\b/giu)]
    .map((match) => Number.parseFloat(match[1] ?? '0'))
}

function calculateWideMinimumWidth(layout: FrontendLayoutRule): number {
  const trackMinimums = gridTrackMinimums(layout.geometry.columns)
  const rowNumbers = [...new Set(layout.regions.map((region) => region.placement.wide.rowStart))]
  return Math.max(...rowNumbers.map((rowNumber) => {
    const widths = [...trackMinimums]
    const rowRegions = layout.regions.filter((region) => region.placement.wide.rowStart === rowNumber)
    for (const region of rowRegions.filter((candidate) => candidate.placement.wide.columnSpan === 1)) {
      const index = region.placement.wide.columnStart - 1
      widths[index] = Math.max(widths[index] ?? 0, region.minWidth)
    }
    for (const region of rowRegions.filter((candidate) => candidate.placement.wide.columnSpan > 1)) {
      const start = region.placement.wide.columnStart - 1
      const end = start + region.placement.wide.columnSpan
      const currentWidth = widths.slice(start, end).reduce((sum, value) => sum + value, 0)
        + layout.geometry.gap * (region.placement.wide.columnSpan - 1)
      if (currentWidth < region.minWidth) {
        widths[start] = (widths[start] ?? 0) + region.minWidth - currentWidth
      }
    }
    return widths.reduce((sum, value) => sum + value, 0)
      + layout.geometry.gap * Math.max(0, widths.length - 1)
  }))
}

function validateLayoutRule(layout: FrontendLayoutRule): void {
  const columnCount = gridTrackMinimums(layout.geometry.columns).length
  if (!columnCount) {
    throw new Error(`Invalid ${layout.recipeId} columns. Use explicit minmax grid tracks.`)
  }
  const occupiedCells = new Set<string>()
  const narrowOrders = new Set<number>()
  const reservedIds = new Set<string>(FRONTEND_RESERVED_COMPONENT_IDS)
  const primaryRegions = layout.regions.filter((region) => region.role === 'primary')
  if (primaryRegions.length !== 1 || primaryRegions[0]?.minWidth !== layout.geometry.primaryMinWidth) {
    throw new Error(`Invalid ${layout.recipeId} primary region footprint.`)
  }
  const primaryRegion = primaryRegions[0]
  if (!primaryRegion || layout.workspace.primaryRegionId !== primaryRegion.id) {
    throw new Error(`Invalid ${layout.recipeId} primary workspace assignment.`)
  }
  const largestSupportingMinimum = Math.max(
    0,
    ...layout.regions
      .filter((region) => region.id !== primaryRegion.id)
      .map((region) => region.minWidth),
  )
  if (primaryRegion.priority !== 1 || primaryRegion.minWidth < largestSupportingMinimum) {
    throw new Error(`Invalid ${layout.recipeId} primary region dominance.`)
  }
  if (
    layout.workspace.placement !== 'explicit-grid'
    || layout.workspace.primarySurface !== 'primary-work-surface'
    || layout.workspace.supportingSurface !== 'structural-pane'
    || layout.workspace.objectSurface !== 'inset-object'
    || layout.workspace.transientSurface !== 'overlay'
  ) {
    throw new Error(`Invalid ${layout.recipeId} workspace surface policy.`)
  }
  if (
    (layout.workspace.measurement.mode === 'prohibited'
      && layout.workspace.measurement.approvedDecisionPurpose !== null)
    || (layout.workspace.measurement.mode === 'task'
      && !/^[a-z]+(?:-[a-z]+){2,}$/u.test(
        layout.workspace.measurement.approvedDecisionPurpose ?? '',
      ))
  ) {
    throw new Error(`Invalid ${layout.recipeId} measurement policy.`)
  }
  for (const region of layout.regions) {
    const { columnStart, columnSpan, rowStart } = region.placement.wide
    if (
      columnStart < 1
      || columnSpan < 1
      || rowStart < 1
      || columnStart + columnSpan - 1 > columnCount
    ) {
      throw new Error(`Invalid ${layout.recipeId} placement for region ${region.id}.`)
    }
    for (let column = columnStart; column < columnStart + columnSpan; column += 1) {
      const cell = `${rowStart}:${column}`
      if (occupiedCells.has(cell)) {
        throw new Error(`Invalid ${layout.recipeId} placement. Region ${region.id} overlaps another region.`)
      }
      occupiedCells.add(cell)
    }
    if (narrowOrders.has(region.placement.narrow.order)) {
      throw new Error(`Invalid ${layout.recipeId} narrow placement. Orders must be unique.`)
    }
    narrowOrders.add(region.placement.narrow.order)
    for (const componentId of region.componentIds) {
      if (!layout.componentIds.includes(componentId)) {
        throw new Error(`Invalid ${layout.recipeId} component manifest for region ${region.id}.`)
      }
      if (reservedIds.has(componentId)) {
        throw new Error(`Invalid ${layout.recipeId} component manifest. ${componentId} is reserved.`)
      }
    }
  }
  if (layout.componentIds.some((componentId) => reservedIds.has(componentId))) {
    throw new Error(`Invalid ${layout.recipeId} component manifest. Reserved components are not approved.`)
  }
  const calculatedMinimum = calculateWideMinimumWidth(layout)
  if (calculatedMinimum !== layout.geometry.wideMinimumWidth) {
    throw new Error(
      `Invalid ${layout.recipeId} wide footprint. Expected ${calculatedMinimum} pixels from its region placements.`,
    )
  }
  if (layout.geometry.narrowBreakpoint < layout.geometry.wideMinimumWidth) {
    throw new Error(`Invalid ${layout.recipeId} breakpoint. It is smaller than the wide footprint.`)
  }
  if (
    layout.geometry.maxContentWidth !== 'fluid'
    && layout.geometry.maxContentWidth < layout.geometry.wideMinimumWidth
  ) {
    throw new Error(`Invalid ${layout.recipeId} maximum width. It is smaller than the wide footprint.`)
  }
}

export function buildFrontendPagePlan(
  values: FrontendViewKind[],
): FrontendPagePlan {
  const viewKinds = uniqueViewKinds(values)
  const [primaryViewKind = 'workbench', ...supportingViewKinds] = viewKinds
  const primaryLayout = FRONTEND_LAYOUT_RULES[primaryViewKind]
  const supportingLayouts = supportingViewKinds.map((kind) => FRONTEND_LAYOUT_RULES[kind])
  for (const layout of [primaryLayout, ...supportingLayouts]) validateLayoutRule(layout)
  const primaryComponentIds = [...primaryLayout.componentIds]
  const supportingComponentIds = [...new Set([
    ...supportingLayouts.flatMap((layout) => layout.componentIds),
  ])]
  return {
    primaryViewKind,
    primaryLayout,
    supportingViewKinds,
    supportingLayouts,
    geometry: { ...primaryLayout.geometry },
    regions: primaryLayout.regions.map((region) => ({
      ...region,
      placement: {
        wide: { ...region.placement.wide },
        narrow: { ...region.placement.narrow },
      },
      componentIds: [...region.componentIds],
    })),
    primaryComponentIds,
    supportingComponentIds,
    componentIds: [...primaryComponentIds],
  }
}

export function resolveFrontendDesignSystem(
  preferences: FrontendDesignPreferences = {},
): FrontendDesignSystemConfig {
  const paletteId = preferences.paletteId ?? 'midnight'
  const fontId = preferences.fontId ?? 'inter'
  if (!FRONTEND_PALETTE_IDS.includes(paletteId)) {
    throw new Error(`Unknown frontend palette ID: ${String(paletteId)}.`)
  }
  if (!FRONTEND_FONT_IDS.includes(fontId)) {
    throw new Error(`Unknown frontend font ID: ${String(fontId)}.`)
  }
  if (
    preferences.defaultMode !== undefined
    && !FRONTEND_DEFAULT_MODES.includes(preferences.defaultMode)
  ) {
    throw new Error(`Unknown frontend default mode: ${String(preferences.defaultMode)}.`)
  }
  if (preferences.density !== undefined && !FRONTEND_DENSITIES.includes(preferences.density)) {
    throw new Error(`Unknown frontend density: ${String(preferences.density)}.`)
  }
  const viewKinds = uniqueViewKinds(preferences.viewKinds)
  const paletteValue = paletteId === 'custom'
    ? customPalette(preferences.customPalette)
    : FRONTEND_PALETTES[paletteId]
  validatePalette(paletteValue)
  const layouts = viewKinds.map((kind) => FRONTEND_LAYOUT_RULES[kind])
  return {
    schemaVersion: '1.1',
    contractId: 'EUIT-FRONTEND-001',
    writingProfileId: 'EUIT-STE-001',
    palette: paletteValue,
    typography: FRONTEND_FONTS[fontId],
    defaultMode: preferences.defaultMode ?? 'dark',
    density: preferences.density ?? 'compact',
    modeToggle: true,
    icons: FRONTEND_ICON_GUIDE,
    workspacePolicy: FRONTEND_WORKSPACE_POLICY,
    viewKinds,
    layouts,
    pagePlan: buildFrontendPagePlan(viewKinds),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Rebuild a resolved record from its user-owned choices. Derived layout,
 * component, icon, and built-in palette data are never trusted from storage.
 */
export function migrateFrontendDesignSystemConfig(
  value: unknown,
): FrontendDesignSystemConfig {
  if (!isRecord(value) || (value.schemaVersion !== '1.0' && value.schemaVersion !== '1.1')) {
    throw new Error('Unsupported frontend design system schema version.')
  }
  if (
    value.contractId !== 'EUIT-FRONTEND-001'
    || value.writingProfileId !== 'EUIT-STE-001'
    || value.modeToggle !== true
  ) {
    throw new Error('Invalid frontend design system contract identity.')
  }
  if (!isRecord(value.palette) || typeof value.palette.id !== 'string') {
    throw new Error('Invalid frontend design system palette record.')
  }
  const paletteId = value.palette.id
  if (!FRONTEND_PALETTE_IDS.includes(paletteId as FrontendPaletteId)) {
    throw new Error(`Unknown frontend palette ID: ${paletteId}.`)
  }
  if (!isRecord(value.typography) || typeof value.typography.id !== 'string') {
    throw new Error('Invalid frontend design system typography record.')
  }
  const fontId = value.typography.id
  if (!FRONTEND_FONT_IDS.includes(fontId as FrontendFontId)) {
    throw new Error(`Unknown frontend font ID: ${fontId}.`)
  }
  if (
    typeof value.defaultMode !== 'string'
    || !FRONTEND_DEFAULT_MODES.includes(value.defaultMode as FrontendDefaultMode)
  ) {
    throw new Error('Invalid frontend design system default mode.')
  }
  if (
    typeof value.density !== 'string'
    || !FRONTEND_DENSITIES.includes(value.density as FrontendDensity)
  ) {
    throw new Error('Invalid frontend design system density.')
  }
  if (
    !Array.isArray(value.viewKinds)
    || value.viewKinds.some((kind) => (
      typeof kind !== 'string' || !FRONTEND_VIEW_KINDS.includes(kind as FrontendViewKind)
    ))
  ) {
    throw new Error('Invalid frontend design system view kinds.')
  }
  let customPaletteValue: FrontendCustomPalette | undefined
  if (paletteId === 'custom') {
    if (
      typeof value.palette.name !== 'string'
      || !isRecord(value.palette.light)
      || !isRecord(value.palette.dark)
    ) {
      throw new Error('Invalid custom frontend palette record.')
    }
    customPaletteValue = {
      name: value.palette.name,
      light: value.palette.light as FrontendCustomColorMode,
      dark: value.palette.dark as FrontendCustomColorMode,
    }
  }
  return resolveFrontendDesignSystem({
    paletteId: paletteId as FrontendPaletteId,
    fontId: fontId as FrontendFontId,
    defaultMode: value.defaultMode as FrontendDefaultMode,
    density: value.density as FrontendDensity,
    viewKinds: value.viewKinds as FrontendViewKind[],
    ...(customPaletteValue ? { customPalette: customPaletteValue } : {}),
  })
}

export function frontendPreferencesFromConfig(
  input: FrontendDesignSystemConfigInput,
): FrontendDesignPreferences {
  const config = migrateFrontendDesignSystemConfig(input)
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
    `  --eui-color-overlay: ${mode.overlay};`,
    `  --eui-color-text: ${mode.text};`,
    `  --eui-color-text-muted: ${mode.textMuted};`,
    `  --eui-color-text-quiet: ${mode.textQuiet};`,
    `  --eui-color-border: ${mode.border};`,
    `  --eui-color-border-strong: ${mode.borderStrong};`,
    `  --eui-color-accent-foreground: ${mode.accentForeground};`,
    `  --eui-color-accent: ${mode.accent};`,
    `  --eui-color-accent-hover: ${mode.accentHover};`,
    `  --eui-color-accent-active: ${mode.accentActive};`,
    `  --eui-color-accent-soft: ${mode.accentSoft};`,
    `  --eui-color-action: ${mode.action};`,
    `  --eui-color-action-hover: ${mode.actionHover};`,
    `  --eui-color-action-active: ${mode.actionActive};`,
    `  --eui-color-on-accent: ${mode.onAccent};`,
    `  --eui-color-control: ${mode.control};`,
    `  --eui-color-control-hover: ${mode.controlHover};`,
    `  --eui-color-selected: ${mode.selected};`,
    `  --eui-color-selected-border: ${mode.selectedBorder};`,
    `  --eui-color-focus: ${mode.focus};`,
    `  --eui-color-success: ${mode.success};`,
    `  --eui-color-warning: ${mode.warning};`,
    `  --eui-color-danger: ${mode.danger};`,
    `  --eui-color-info: ${mode.info};`,
    `  --eui-shadow-raised: ${mode.shadow};`,
  ]
}

/** Render a portable semantic-token entry point for a generated frontend. */
export function renderFrontendDesignCss(config: FrontendDesignSystemConfigInput): string {
  config = migrateFrontendDesignSystemConfig(config)
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
export function buildFrontendDesignPrompt(config: FrontendDesignSystemConfigInput): string {
  config = migrateFrontendDesignSystemConfig(config)
  const pagePlan = config.pagePlan
  const primaryLayout = pagePlan.primaryLayout
  const maximumWidth = primaryLayout.geometry.maxContentWidth === 'fluid'
    ? 'the available workspace width'
    : `${primaryLayout.geometry.maxContentWidth} pixels`
  const regionLines = primaryLayout.regions.flatMap((region) => [
    `- Put ${region.id} in wide grid column ${region.placement.wide.columnStart}, row ${region.placement.wide.rowStart}. It spans ${region.placement.wide.columnSpan} column${region.placement.wide.columnSpan === 1 ? '' : 's'}.`,
    `- Use narrow order ${region.placement.narrow.order} for ${region.id}. Use ${region.narrowBehavior} below ${primaryLayout.geometry.narrowBreakpoint} pixels.`,
  ])
  const measurementLine = primaryLayout.workspace.measurement.mode === 'task'
    ? `- A metric surface is allowed only for the primary measurement task. Mark it with data-metric-purpose="${primaryLayout.workspace.measurement.approvedDecisionPurpose}" and place it with the work that needs the decision.`
    : '- Do not render a metric surface in this recipe. Measurement is not the primary task.'
  const layoutLines = [
    `- Use ${primaryLayout.name} for ${primaryLayout.purpose.toLowerCase()} This is the primary page recipe.`,
    `- Identify the primary page with data-layout-recipe="${primaryLayout.recipeId}".`,
    `- Use ${primaryLayout.composition.navigation} navigation, the ${primaryLayout.composition.header} header style, ${primaryLayout.composition.actions} actions, and the ${primaryLayout.composition.surface} surface model.`,
    `- Set the maximum content width to ${maximumWidth}. Use grid columns ${primaryLayout.geometry.columns} with a ${primaryLayout.geometry.gap} pixel gap.`,
    `- Keep the primary region at least ${primaryLayout.geometry.primaryMinWidth} pixels wide before the narrow layout applies.`,
    '- Implement each named region at its specified place.',
    `- Mark ${primaryLayout.workspace.primaryRegionId} with data-region-role="primary" and data-surface-kind="primary-work-surface".`,
    '- Mark supporting layout regions with data-surface-kind="structural-pane".',
    '- Use the explicit grid coordinates as the only wide placement source. Use the explicit order as the only narrow placement source.',
    '- Keep the primary work surface dominant. Supporting panes must not compete with it for width, color, or elevation.',
    measurementLine,
    ...regionLines,
    `- Use these approved primary component IDs: ${pagePlan.primaryComponentIds.join(', ')}.`,
    `- Include ${primaryLayout.requiredRegions.join(', ')}.`,
    `- Avoid ${primaryLayout.avoid.join(' and ')}.`,
    ...pagePlan.supportingLayouts.map((layout) => (
      `- Use ${layout.name} only as a supporting pattern inside the primary ${primaryLayout.name.toLowerCase()} shell. Its supporting component IDs are ${layout.componentIds.join(', ')}.`
    )),
  ]
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
    '- Start in the configured mode before the user selects a mode.',
    '- Keep one visual identity in both modes.',
    '- Keep the canvas and standard surfaces neutral.',
    '- Use no more than two routine background tiers: canvas and surface.',
    '- Reserve the overlay surface for dialogs, popovers, and menus.',
    '- Use the accent foreground token for links, icons, and data emphasis.',
    '- Use the action token for a filled primary action and the on-accent token for its text.',
    '- Use the selected tokens for selection. Use the control tokens for neutral controls.',
    '- Do not create accent-tinted navigation, extra background tiers, panel bands, or decorative gradients.',
    '- Treat the selected palette as project configuration. Do not replace it with an inferred palette.',
    '- Use short labels and direct instructions.',
    '- Use natural application names and page titles. Do not write a count-led headline such as “Three sessions wait”.',
    '- Use a short task label or object name for each page title.',
    '- Render exactly one visible h1 on each page.',
    '- Make the page title larger than its summary.',
    '- Make each section title larger than its description.',
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
    '- Use one primary page recipe. Do not merge supporting recipes into equal page shells.',
    '- Let the task control the shell. Do not reuse one shell for every product.',
    '- Keep region containers flat. Do not use a card or raised panel as a default region container.',
    '- Use a structural pane only for navigation, context, commands, status, or an inspector.',
    '- Use an inset object only for one bounded object inside the work surface.',
    '- Use an overlay only for transient content such as a dialog, popover, or menu.',
    '- Do not scatter independent panels across the page. Follow the recipe placement exactly.',
    '- Do not use a dashboard unless measures are the main task.',
    '- Do not invent a metric, KPI, score, trend, or count.',
    '- Add a measure only when it changes a decision in the current task.',
    '- Put an approved measure beside the work that it explains. Do not add a default metric strip.',
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
  const signals: ReadonlyArray<{
    kind: FrontendViewKind
    patterns: ReadonlyArray<readonly [RegExp, number]>
  }> = [
    { kind: 'workbench', patterns: [[/\b(audit|assess)\b/u, 8], [/\b(evidence|artifact)\b/u, 5], [/\b(analysis|inspect|compare)\b/u, 5], [/\breview\b/u, 2]] },
    { kind: 'editor', patterns: [[/\b(document|specification)\b/u, 8], [/\b(author|write|edit|comment)\b/u, 6]] },
    { kind: 'monitor', patterns: [[/\b(monitor|telemetry)\b/u, 8], [/\b(channel|signal|live|trend|threshold)\b/u, 5]] },
    { kind: 'board', patterns: [[/\b(board|kanban)\b/u, 8], [/\b(session|queue|flow|work item|backlog)\b/u, 5]] },
    { kind: 'graph', patterns: [[/\b(graph|topology)\b/u, 8], [/\b(trace|impact|relationship|dependency)\b/u, 5]] },
    { kind: 'wizard', patterns: [[/\b(wizard|guided|intake)\b/u, 8], [/\b(phase|step)\b/u, 5], [/\b(package|setup|release)\b/u, 4]] },
    { kind: 'timeline', patterns: [[/\b(timeline|chronology)\b/u, 8], [/\b(event|history|log)\b/u, 6]] },
    { kind: 'case', patterns: [[/\b(case|finding|incident|failure)\b/u, 8], [/\breview\b/u, 2], [/(?:\breview\b[\s\S]*\bevidence\b|\bevidence\b[\s\S]*\breview\b)/u, 5]] },
    { kind: 'form', patterns: [[/\b(form|questionnaire)\b/u, 8], [/\b(create|register|submit|configure)\b/u, 4]] },
    { kind: 'table', patterns: [[/\b(table|catalog|inventory)\b/u, 8], [/\b(record|list|report)\b/u, 3]] },
  ]
  const scored = signals.map(({ kind, patterns }, order) => ({
    kind,
    order,
    score: patterns.reduce((score, [pattern, weight]) => (
      score + (pattern.test(text) ? weight : 0)
    ), 0),
  })).filter(({ score }) => score >= 3)
    .sort((first, second) => second.score - first.score || first.order - second.order)

  return scored.length
    ? scored.slice(0, 3).map(({ kind }) => kind)
    : ['workbench']
}

type FrontendMarkupElement = {
  tag: string
  attributes: string
  parent: number | null
  contentStart: number
  contentEnd: number
}

function parseFrontendMarkup(source: string): FrontendMarkupElement[] {
  const elements: FrontendMarkupElement[] = []
  const stack: number[] = []
  const voidTags = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
    'param', 'source', 'track', 'wbr',
  ])
  const tags = source.matchAll(/<\s*(\/?)\s*([a-z][\w:-]*)\b([^>]*)>/giu)
  for (const match of tags) {
    const closing = match[1] === '/'
    const tag = (match[2] ?? '').toLowerCase()
    const index = match.index ?? 0
    if (closing) {
      for (let stackIndex = stack.length - 1; stackIndex >= 0; stackIndex -= 1) {
        const elementIndex = stack[stackIndex]
        if (elementIndex === undefined || elements[elementIndex]?.tag !== tag) continue
        const element = elements[elementIndex]
        if (element) element.contentEnd = index
        stack.splice(stackIndex)
        break
      }
      continue
    }
    const attributes = match[3] ?? ''
    const elementIndex = elements.length
    elements.push({
      tag,
      attributes,
      parent: stack.at(-1) ?? null,
      contentStart: index + match[0].length,
      contentEnd: index + match[0].length,
    })
    if (!attributes.trimEnd().endsWith('/') && !voidTags.has(tag)) stack.push(elementIndex)
  }
  for (const elementIndex of stack) {
    const element = elements[elementIndex]
    if (element) element.contentEnd = source.length
  }
  return elements
}

function frontendMarkupAttribute(attributes: string, name: string): string | null {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = attributes.match(new RegExp(
    `(?:^|\\s)${escapedName}\\s*=\\s*(?:["']([^"']*)["']|\\{\\s*["']([^"']*)["']\\s*\\}|\\{\\s*([^{}"']+?)\\s*\\}|([^\\s>]+))`,
    'iu',
  ))
  return match?.[1] ?? match?.[2] ?? match?.[3]?.trim() ?? match?.[4] ?? null
}

function literalCssPixels(value: string): number | null {
  const match = value.trim().match(/^(\d*\.?\d+)\s*(px|r?em|pt)(?:\s*!important)?$/iu)
  if (!match) return null
  const amount = Number.parseFloat(match[1] ?? '')
  const unit = (match[2] ?? 'px').toLowerCase()
  if (unit === 'pt') return amount * (4 / 3)
  if (unit === 'rem' || unit === 'em') return amount * 16
  return amount
}

type FrontendCssPixelRange = {
  minimum: number
  maximum: number
}

type FrontendCssSizeEvidence = {
  ranges: FrontendCssPixelRange[]
  unresolved: string[]
  minimum: number | null
  maximum: number | null
}

function cssPixelRange(value: string): FrontendCssPixelRange | null {
  const normalized = value.trim().replace(/\s*!important\s*$/iu, '')
  const literal = literalCssPixels(normalized)
  if (literal !== null) return { minimum: literal, maximum: literal }

  const clamp = normalized.match(/^clamp\(\s*([^,]+),[\s\S]*,\s*([^,]+)\s*\)$/iu)
  if (clamp) {
    const minimum = literalCssPixels(clamp[1] ?? '')
    const maximum = literalCssPixels(clamp[2] ?? '')
    if (minimum !== null && maximum !== null) {
      return {
        minimum: Math.min(minimum, maximum),
        maximum: Math.max(minimum, maximum),
      }
    }
  }
  return null
}

function cssSizeEvidence(
  styles: string,
  selectorPattern: RegExp,
): FrontendCssSizeEvidence {
  const ranges: FrontendCssPixelRange[] = []
  const unresolved: string[] = []
  for (const rule of styles.matchAll(/([^{}]+)\{([^{}]*)\}/gu)) {
    const selector = rule[1] ?? ''
    if (!selectorPattern.test(selector)) continue
    const declarations = [...(rule[2] ?? '').matchAll(/(?<![-\w])font-size\s*:\s*([^;{}]+)/giu)]
    for (const declaration of declarations) {
      const value = (declaration[1] ?? '').trim()
      const range = cssPixelRange(value)
      if (range) ranges.push(range)
      else if (value) unresolved.push(`${selector.trim()} uses ${value}`)
    }
  }
  return {
    ranges,
    unresolved: [...new Set(unresolved)],
    minimum: ranges.length ? Math.min(...ranges.map((range) => range.minimum)) : null,
    maximum: ranges.length ? Math.max(...ranges.map((range) => range.maximum)) : null,
  }
}

/**
 * Inspect a complete generated frontend source set. This gate checks system
 * structure. The overlay STE gate checks each visible string separately.
 */
export function evaluateFrontendDesignSources(
  sources: Readonly<Record<string, string>>,
  config: FrontendDesignSystemConfigInput,
): FrontendDesignFinding[] {
  config = migrateFrontendDesignSystemConfig(config)
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

  const stripEmbeddedJsonScripts = (source: string) => source.replace(
    /<script\b[^>]*type\s*=\s*["']application\/json["'][^>]*>[\s\S]*?<\/script>/giu,
    '',
  )
  const markupWithoutEmbeddedManifests = stripEmbeddedJsonScripts(markup)
  const markupElements = parseFrontendMarkup(markupWithoutEmbeddedManifests)
  const stylesWithoutComments = styles.replace(/\/\*[\s\S]*?\*\//gu, '')
  const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const findings: FrontendDesignFinding[] = []
  const require = (condition: boolean, code: string, message: string) => {
    if (!condition) findings.push({ code, severity: 'blocking', message })
  }
  const expectedTokenDeclarations = [config.palette.light, config.palette.dark]
    .flatMap((mode) => tokenLines(mode))
    .map((line) => line.trim().match(/^(--[\w-]+):\s*(.+);$/u))
    .filter((match): match is RegExpMatchArray => match !== null)
  const hasExactTokens = expectedTokenDeclarations.every((declaration) => {
    const [, name = '', value = ''] = declaration
    return new RegExp(`${escapePattern(name)}\\s*:\\s*${escapePattern(value)}\\s*;`, 'u')
      .test(stylesWithoutComments)
  })
  const usesRequiredTokens = [
    '--eui-color-canvas',
    '--eui-color-text',
    '--eui-color-action',
  ].every((name) => new RegExp(`var\\(\\s*${escapePattern(name)}\\s*\\)`, 'u').test(stylesWithoutComments))
  require(
    hasExactTokens && usesRequiredTokens,
    'FRONTEND-DESIGN-TOKENS',
    'The frontend must define the configured semantic token values and use the canvas, text, and action tokens.',
  )
  const primaryRecipeId = config.pagePlan.primaryLayout.recipeId
  require(
    new RegExp(
      `data-layout-recipe\\s*=\\s*["']${escapePattern(primaryRecipeId)}["']`,
      'iu',
    ).test(markupWithoutEmbeddedManifests),
    'FRONTEND-DESIGN-LAYOUT-RECIPE',
    `The primary page must identify layout recipe ${primaryRecipeId}.`,
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
    new RegExp(
      `data-design-contract\\s*=\\s*["']${escapePattern(config.contractId)}["']`,
      'iu',
    ).test(markupWithoutEmbeddedManifests),
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
  const visibleEmDash = />(?:[^<]|<(?!\/?(?:script|style)\b))*\u2014/iu.test(markupWithoutEmbeddedManifests)
    || /(?:aria-label|title|placeholder)\s*=\s*["'][^"']*\u2014/iu.test(markupWithoutEmbeddedManifests)
  require(
    !visibleEmDash,
    'FRONTEND-DESIGN-EM-DASH',
    'The frontend must not use an em dash in visible text.',
  )
  const countLedHeading = /<h[12][^>]*>\s*(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/iu.test(markupWithoutEmbeddedManifests)
  require(
    !countLedHeading,
    'FRONTEND-DESIGN-COUNT-HEADLINE',
    'Use a natural task or object title. Do not start a page title with a count.',
  )

  const classValue = (element: FrontendMarkupElement) => (
    frontendMarkupAttribute(element.attributes, 'class')
    ?? frontendMarkupAttribute(element.attributes, 'className')
    ?? ''
  )
  const hasClass = (element: FrontendMarkupElement, pattern: RegExp): boolean => (
    classValue(element).split(/\s+/u).filter(Boolean).some((token) => pattern.test(token))
  )
  const visiblePageHeadings = markupElements.filter((element) => {
    if (element.tag !== 'h1') return false
    const hidden = /(?:^|\s)hidden(?:\s|=|$)/iu.test(element.attributes)
      || /aria-hidden\s*=\s*(?:["']true["']|\{true\})/iu.test(element.attributes)
      || /style\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden)/iu
        .test(element.attributes)
    return !hidden
  })
  require(
    visiblePageHeadings.length === config.workspacePolicy.titleHierarchy.visiblePageHeadingCount,
    'FRONTEND-DESIGN-PAGE-H1',
    'Each page must contain exactly one visible h1.',
  )

  const pageTitleSize = cssSizeEvidence(
    stylesWithoutComments,
    /\.(?:page|workspace|task)-title\b|\[data-page-title\]/iu,
  )
  const pageSummarySize = cssSizeEvidence(
    stylesWithoutComments,
    /\.(?:(?:page|workspace|task)-(?:summary|subtitle))\b|\[data-page-summary\]/iu,
  )
  const sectionTitleSize = cssSizeEvidence(
    stylesWithoutComments,
    /\.(?:section|panel)-title\b|\[data-section-title\]/iu,
  )
  const sectionDescriptionSize = cssSizeEvidence(
    stylesWithoutComments,
    /\.(?:section-(?:description|summary)|panel-subtitle)\b|\[data-section-description\]/iu,
  )
  const hasPageSummary = markupElements.some((element) => (
    hasClass(element, /^(?:(?:page|workspace|task)-(?:summary|subtitle))$/iu)
      || frontendMarkupAttribute(element.attributes, 'data-page-summary') !== null
  ))
  const hasSectionTitle = markupElements.some((element) => (
    hasClass(element, /^(?:section|panel)-title$/iu)
      || frontendMarkupAttribute(element.attributes, 'data-section-title') !== null
  ))
  const hasSectionDescription = markupElements.some((element) => (
    hasClass(element, /^(?:section-(?:description|summary)|panel-subtitle)$/iu)
      || frontendMarkupAttribute(element.attributes, 'data-section-description') !== null
  ))
  const pageHierarchyResolved = !hasPageSummary || (
    pageTitleSize.minimum !== null
    && pageSummarySize.maximum !== null
    && pageTitleSize.unresolved.length === 0
    && pageSummarySize.unresolved.length === 0
  )
  require(
    pageHierarchyResolved
      && (!hasPageSummary || (pageTitleSize.minimum as number) > (pageSummarySize.maximum as number)),
    'FRONTEND-DESIGN-TITLE-HIERARCHY',
    pageHierarchyResolved
      ? 'The page title must use a larger font size than its summary at every responsive size.'
      : `The page title and summary sizes must resolve to literal or clamp pixel ranges.${[...pageTitleSize.unresolved, ...pageSummarySize.unresolved].length ? ` Found: ${[...pageTitleSize.unresolved, ...pageSummarySize.unresolved].join(' | ')}.` : ''}`,
  )
  const sectionHierarchyRequired = hasSectionTitle && hasSectionDescription
  const sectionHierarchyResolved = !sectionHierarchyRequired || (
    sectionTitleSize.minimum !== null
    && sectionDescriptionSize.maximum !== null
    && sectionTitleSize.unresolved.length === 0
    && sectionDescriptionSize.unresolved.length === 0
  )
  require(
    sectionHierarchyResolved
      && (!sectionHierarchyRequired
        || (sectionTitleSize.minimum as number) > (sectionDescriptionSize.maximum as number)),
    'FRONTEND-DESIGN-TITLE-HIERARCHY',
    sectionHierarchyResolved
      ? 'Each section title must use a larger font size than its description at every responsive size.'
      : `Section title and description sizes must resolve to literal or clamp pixel ranges.${[...sectionTitleSize.unresolved, ...sectionDescriptionSize.unresolved].length ? ` Found: ${[...sectionTitleSize.unresolved, ...sectionDescriptionSize.unresolved].join(' | ')}.` : ''}`,
  )

  const explicitPrimaryRegions = markupElements
    .map((element, index) => ({ element, index }))
    .filter(({ element }) => (
      frontendMarkupAttribute(element.attributes, 'data-region-role') === 'primary'
    ))
  const primaryRegions = explicitPrimaryRegions.length
    ? explicitPrimaryRegions
    : markupElements
        .map((element, index) => ({ element, index }))
        .filter(({ element }) => element.tag === 'main')
  const isDescendant = (elementIndex: number, ancestorIndex: number): boolean => {
    let parent = markupElements[elementIndex]?.parent ?? null
    while (parent !== null) {
      if (parent === ancestorIndex) return true
      parent = markupElements[parent]?.parent ?? null
    }
    return false
  }

  const expectedRegions = config.pagePlan.primaryLayout.regions
  const renderedRegions = markupElements
    .map((element, index) => ({
      element,
      index,
      id: frontendMarkupAttribute(element.attributes, 'data-region-id'),
    }))
    .filter((candidate): candidate is typeof candidate & { id: string } => candidate.id !== null)
  const expectedRegionIds = new Set(expectedRegions.map((region) => region.id))
  const regionContractIssues: string[] = []
  for (const region of expectedRegions) {
    const matches = renderedRegions.filter((candidate) => candidate.id === region.id)
    if (matches.length === 0) {
      regionContractIssues.push(`${region.id} is missing`)
      continue
    }
    if (matches.length > 1) {
      regionContractIssues.push(`${region.id} appears ${matches.length} times`)
      continue
    }
    const rendered = matches[0]?.element
    if (!rendered) continue
    const expectedAttributes: ReadonlyArray<readonly [string, string]> = [
      ['data-region-role', region.role],
      ['data-region-priority', String(region.priority)],
      [
        'data-surface-kind',
        region.role === 'primary'
          ? config.pagePlan.primaryLayout.workspace.primarySurface
          : config.pagePlan.primaryLayout.workspace.supportingSurface,
      ],
      ['data-wide-column-start', String(region.placement.wide.columnStart)],
      ['data-wide-column-span', String(region.placement.wide.columnSpan)],
      ['data-wide-row-start', String(region.placement.wide.rowStart)],
      ['data-region-order', String(region.placement.narrow.order)],
      ['data-narrow-behavior', region.narrowBehavior],
    ]
    for (const [attribute, expected] of expectedAttributes) {
      const actual = frontendMarkupAttribute(rendered.attributes, attribute)
      if (actual !== expected) {
        regionContractIssues.push(`${region.id} ${attribute} is ${actual ?? 'missing'}; expected ${expected}`)
      }
    }
  }
  for (const rendered of renderedRegions) {
    if (!expectedRegionIds.has(rendered.id)) {
      regionContractIssues.push(`${rendered.id} is not a region in ${primaryRecipeId}`)
    }
  }
  require(
    regionContractIssues.length === 0,
    'FRONTEND-DESIGN-REGION-CONTRACT',
    `Every primary-layout region must appear once with its exact role, priority, surface, wide placement, and narrow placement.${regionContractIssues.length ? ` Found: ${regionContractIssues.join(' | ')}.` : ''}`,
  )

  const isPanelWrapper = (element: FrontendMarkupElement): boolean => {
    const surfaceKind = frontendMarkupAttribute(element.attributes, 'data-surface-kind')
    if (surfaceKind === 'inset-object' || surfaceKind === 'overlay') return false
    if (frontendMarkupAttribute(element.attributes, 'data-panel-surface') === 'plain') return false
    const wrapperTokens = classValue(element).split(/\s+/u).filter(Boolean)
    return wrapperTokens.some((token) => (
      /(?:^|-)(?:card|panel|tile)(?:$|-)/iu.test(token)
        && !/(?:^|-)(?:header|body|heading|title|subtitle|content|actions|footer|signal|icon|media|meta)(?:$|-)/iu.test(token)
    ))
      || /(?:^|\s)(?:surface-raised|raised-surface)(?:\s|$)/iu.test(classValue(element))
  }
  let hasRepeatedPrimaryPanelWrappers = false
  let hasPanelRegionContainer = false
  const primaryPanelWrapperClasses = new Set<string>()
  for (const { element: primaryRegion, index: primaryRegionIndex } of primaryRegions) {
    if (isPanelWrapper(primaryRegion)) {
      hasPanelRegionContainer = true
      primaryPanelWrapperClasses.add(classValue(primaryRegion))
    }
    const wrapperIndexes = markupElements
      .map((element, index) => ({ element, index }))
      .filter(({ element, index }) => (
        isDescendant(index, primaryRegionIndex) && isPanelWrapper(element)
      ))
      .filter(({ index }) => {
        let parent = markupElements[index]?.parent ?? null
        while (parent !== null && parent !== primaryRegionIndex) {
          if (isPanelWrapper(markupElements[parent] as FrontendMarkupElement)) return false
          parent = markupElements[parent]?.parent ?? null
        }
        return true
      })
    if (wrapperIndexes.length > 1) {
      hasRepeatedPrimaryPanelWrappers = true
      for (const { element } of wrapperIndexes) primaryPanelWrapperClasses.add(classValue(element))
    }
  }
  require(
    !hasPanelRegionContainer && !hasRepeatedPrimaryPanelWrappers,
    'FRONTEND-DESIGN-PANEL-WRAPPERS',
    `Keep the primary region flat. Do not use repeated card or raised panel wrappers as its layout.${primaryPanelWrapperClasses.size ? ` Found: ${[...primaryPanelWrapperClasses].join(', ')}.` : ''}`,
  )

  const metricSurfaces = markupElements.filter((element) => (
    /(?:^|\s)(?:metrics?|metric-grid|metric-strip)(?:\s|$)/iu.test(classValue(element))
  ))
  const expectedMetricPurpose = config.pagePlan.primaryLayout.workspace.measurement
    .approvedDecisionPurpose
  const hasApprovedMetricPurpose = config.pagePlan.primaryLayout.workspace.measurement.mode === 'task'
    && expectedMetricPurpose !== null
    && metricSurfaces.every((element) => (
      frontendMarkupAttribute(element.attributes, 'data-metric-purpose')
        === expectedMetricPurpose
    ))
  require(
    metricSurfaces.length === 0 || hasApprovedMetricPurpose,
    'FRONTEND-DESIGN-METRIC-PURPOSE',
    expectedMetricPurpose === null
      ? 'This page recipe does not approve a metric surface because measurement is not its primary task.'
      : `Each metric surface must use the approved decision purpose ${expectedMetricPurpose}.`,
  )

  const iconActions = new Map<string, Set<string>>()
  for (const [buttonIndex, button] of markupElements.entries()) {
    if (button.tag !== 'button') continue
    const innerMarkup = markupWithoutEmbeddedManifests.slice(button.contentStart, button.contentEnd)
    const visibleLabel = innerMarkup.replace(/<[^>]+>/gu, ' ').replace(/\s+/gu, ' ').trim()
    const label = (
      frontendMarkupAttribute(button.attributes, 'aria-label')
      ?? frontendMarkupAttribute(button.attributes, 'title')
      ?? visibleLabel
    ).trim().toLowerCase()
    if (!label) continue
    const explicitAction = frontendMarkupAttribute(button.attributes, 'data-semantic-action')
      ?? frontendMarkupAttribute(button.attributes, 'data-scenario-action')
      ?? frontendMarkupAttribute(button.attributes, 'data-action')
      ?? frontendMarkupAttribute(button.attributes, 'data-action-id')
    const action = (explicitAction ?? (/^close\b/iu.test(label) ? 'close' : label)).trim().toLowerCase()
    const iconNames = new Set(
      [
        frontendMarkupAttribute(button.attributes, 'data-icon-name'),
        ...markupElements
          .filter((element, elementIndex) => isDescendant(elementIndex, buttonIndex))
          .flatMap((element) => [
            frontendMarkupAttribute(element.attributes, 'data-icon-name'),
            frontendMarkupAttribute(element.attributes, 'data-lucide'),
            frontendMarkupAttribute(element.attributes, 'data-name'),
          ]),
      ]
        .filter((name): name is string => Boolean(name)),
    )
    for (const iconName of iconNames) {
      const actions = iconActions.get(iconName) ?? new Set<string>()
      actions.add(action)
      iconActions.set(iconName, actions)
    }
  }
  require(
    [...iconActions.values()].every((actions) => actions.size <= 1),
    'FRONTEND-DESIGN-ICON-MAPPING',
    'Do not use one icon for buttons that perform different actions.',
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
  const sourceWithoutEmbeddedManifests = stripEmbeddedJsonScripts(joined)
  const sourceWithoutTokenValues = sourceWithoutEmbeddedManifests.replace(
    /--(?:eui|[a-z0-9-]*brand)[\w-]*\s*:[^;]+;/gi,
    '',
  )
  const sourceWithoutTokenFunctions = sourceWithoutTokenValues.replace(
    /\b(?:rgb|hsl)a?\s*\(\s*var\([^)]*\)\s*(?:,[^)]*)?\)/giu,
    '',
  )
  const sourceWithoutVariables = sourceWithoutTokenFunctions.replace(/var\([^)]*\)/giu, '')
  const hasRawColor = /#[\da-f]{3,8}\b/iu.test(sourceWithoutTokenFunctions)
    || /\b(?:rgb|hsl)a?\s*\(/iu.test(sourceWithoutTokenFunctions)
    || /(?:^|[;{]\s*)(?:color|background(?:-color)?|border(?:-[\w-]+)?-color|fill|stroke)\s*:[^;{}]*\b(?:black|white|red|blue|green|yellow|orange|purple|violet|teal|gray|grey)\b/imu.test(sourceWithoutVariables)
  if (hasRawColor) {
    findings.push({
      code: 'FRONTEND-DESIGN-RAW-COLOR',
      severity: 'warning',
      message: 'The frontend uses color values outside the semantic token entry point.',
    })
  }
  const metadataSelector = /(?:\bsmall\b|\btime\b|\bkbd\b|\bcode\b|caption|metadata|meta(?:data)?[-_]|eyebrow|overline|tooltip|status-badge)/iu
  const sizeDeclarations = styles.matchAll(
    /(?<![-\w])font-size\s*:\s*([^;{}]+)/giu,
  )
  let hasTinyText = false
  for (const declaration of sizeDeclarations) {
    const declarationIndex = declaration.index ?? 0
    const blockStart = styles.lastIndexOf('{', declarationIndex)
    const selectorStart = Math.max(
      styles.lastIndexOf('}', Math.max(0, blockStart - 1)),
      styles.lastIndexOf('{', Math.max(0, blockStart - 1)),
    ) + 1
    const selector = blockStart >= 0
      ? styles.slice(selectorStart, blockStart).trim()
      : ''
    const sizes = [...(declaration[1] ?? '').matchAll(/(\d*\.?\d+)\s*(px|r?em|pt)\b/giu)]
      .map((match) => {
        const amount = Number.parseFloat(match[1] ?? '0')
        const unit = (match[2] ?? 'px').toLowerCase()
        if (unit === 'pt') return amount * (4 / 3)
        if (unit === 'rem' || unit === 'em') return amount * 16
        return amount
      })
    if (!sizes.length) continue
    const minimumSize = Math.min(...sizes)
    if (minimumSize < 10 || (minimumSize < 13 && !metadataSelector.test(selector))) {
      hasTinyText = true
      break
    }
  }
  if (hasTinyText) {
    findings.push({
      code: 'FRONTEND-DESIGN-TINY-TEXT',
      severity: 'warning',
      message: 'Use at least 13 pixel text for normal content. Use 10 to 12 pixel text only for short metadata.',
    })
  }
  return findings
}
