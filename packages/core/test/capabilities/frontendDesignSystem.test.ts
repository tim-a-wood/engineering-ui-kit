import { describe, expect, it } from 'vitest'
import {
  FRONTEND_LAYOUT_RULES,
  FRONTEND_PALETTES,
  FRONTEND_RESERVED_COMPONENT_IDS,
  FRONTEND_WORKSPACE_POLICY,
  buildFrontendPagePlan,
  buildFrontendDesignPrompt,
  evaluateFrontendDesignSources,
  frontendPreferencesFromConfig,
  inferFrontendViewKinds,
  migrateFrontendDesignSystemConfig,
  renderFrontendDesignCss,
  resolveFrontendDesignSystem,
} from '../../src/capabilities/frontendDesignSystem.js'
import type {
  FrontendColorMode,
  FrontendCustomColorMode,
  FrontendDesignSystemConfigV1,
} from '../../src/capabilities/frontendDesignSystem.js'

function relativeLuminance(hex: string): number {
  const channels = hex.slice(1).match(/../g)?.map((channel) => Number.parseInt(channel, 16) / 255) ?? []
  const [red = 0, green = 0, blue = 0] = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ))
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground)
  const second = relativeLuminance(background)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

function legacyColorMode(mode: FrontendColorMode): FrontendCustomColorMode {
  const addedRoles = new Set([
    'overlay',
    'accentForeground',
    'action',
    'actionHover',
    'actionActive',
    'onAccent',
    'control',
    'controlHover',
    'selected',
    'selectedBorder',
  ])
  return Object.fromEntries(
    Object.entries(mode).filter(([role]) => !addedRoles.has(role)),
  ) as FrontendCustomColorMode
}

function completeSources(config = resolveFrontendDesignSystem()): Record<string, string> {
  const primaryContent = [
    '<h1 class="page-title">Artifact review</h1>',
    '<p class="page-summary">Review one artifact and its evidence.</p>',
    '<h2 class="section-title">Selected change</h2>',
    '<p class="section-description">Inspect the approved revision.</p>',
    '<button aria-label="Change color mode" data-theme-toggle>',
    '<svg class="lucide" data-lucide="sun"></svg>',
    '<span role="tooltip">Change mode</span>',
    '</button>',
    '<button aria-label="Open help" data-help-trigger>',
    '<svg class="lucide" data-lucide="circle-help"></svg>',
    '<span role="tooltip">Open help</span>',
    '</button>',
    '<!--primary-content-end-->',
  ].join('')
  const regions = config.pagePlan.primaryLayout.regions.map((region) => {
    const surface = region.role === 'primary'
      ? config.pagePlan.primaryLayout.workspace.primarySurface
      : config.pagePlan.primaryLayout.workspace.supportingSurface
    return [
      `<section data-region-id="${region.id}" data-region-role="${region.role}" data-region-priority="${region.priority}" data-surface-kind="${surface}"`,
      ` data-wide-column-start="${region.placement.wide.columnStart}" data-wide-column-span="${region.placement.wide.columnSpan}" data-wide-row-start="${region.placement.wide.rowStart}"`,
      ` data-region-order="${region.placement.narrow.order}" data-narrow-behavior="${region.narrowBehavior}">`,
      region.role === 'primary' ? primaryContent : '',
      '</section>',
    ].join('')
  }).join('')
  return {
    'index.html': [
      `<html data-design-contract="EUIT-FRONTEND-001" data-layout-recipe="${config.pagePlan.primaryLayout.recipeId}">`,
      `<main data-region="primary-workspace">${regions}</main>`,
      '</html>',
    ].join(''),
    'styles.css': [
      renderFrontendDesignCss(config),
      '.primary-action { background: var(--eui-color-action); color: var(--eui-color-on-accent); }',
      '.page-title { font-size: clamp(22px, 3vw, 28px); }',
      '.page-summary { font-size: 14px; }',
      '.section-title { font-size: 15px; }',
      '.section-description { font-size: 13px; }',
    ].join('\n'),
    'runtime.js': "localStorage.setItem('eui-color-mode', 'dark')",
  }
}

describe('frontend design system', () => {
  it('resolves the Midnight enterprise defaults', () => {
    const config = resolveFrontendDesignSystem()

    expect(config.contractId).toBe('EUIT-FRONTEND-001')
    expect(config.schemaVersion).toBe('1.1')
    expect(config.writingProfileId).toBe('EUIT-STE-001')
    expect(config.palette.id).toBe('midnight')
    expect(config.typography.id).toBe('inter')
    expect(config.defaultMode).toBe('dark')
    expect(config.modeToggle).toBe(true)
    expect(config.palette.light.surface).toBe('#ffffff')
    expect(config.palette.light.accentForeground).toBe('#0969da')
    expect(config.palette.light.action).toBe('#0969da')
    expect(config.palette.dark.canvas).toBe('#0d1117')
    expect(config.palette.dark.surface).toBe('#161b22')
    expect(config.palette.dark.overlay).toBe('#1c2128')
    expect(config.palette.dark.text).toBe('#f0f6fc')
    expect(config.palette.dark.accentForeground).toBe('#58a6ff')
    expect(config.palette.dark.action).toBe('#1f6feb')
    expect(config.palette.dark.onAccent).toBe('#ffffff')
    expect(config.palette.dark.selected).toBe('#1b2a3a')
    expect(config.pagePlan.primaryViewKind).toBe('workbench')
    expect(config.pagePlan.primaryLayout.recipeId).toBe('RCP-WORKBENCH-001')
    expect(config.workspacePolicy).toEqual(FRONTEND_WORKSPACE_POLICY)
    expect(config.workspacePolicy.cardsAsDefaultRegionContainers).toBe(false)
    expect(config.workspacePolicy.surfaces['primary-work-surface']).toEqual({
      elevation: 'flat',
      scope: 'task',
    })
    expect(config.workspacePolicy.surfaces['structural-pane'].elevation).toBe('flat')
    expect(config.workspacePolicy.surfaces['inset-object'].scope).toBe('object')
    expect(config.workspacePolicy.surfaces.overlay.scope).toBe('transient')
    expect(config.icons).toEqual(expect.objectContaining({
      family: 'lucide',
      viewBox: '0 0 24 24',
      strokeWidth: 2,
      helpIcon: 'circle-help',
    }))
  })

  it('uses accessible contrast in the Midnight dark palette', () => {
    const { dark } = FRONTEND_PALETTES.midnight

    expect(dark.canvas).not.toBe(dark.surface)
    expect(dark.selected).not.toBe(dark.surface)
    expect(contrastRatio(dark.text, dark.canvas)).toBeGreaterThanOrEqual(7)
    expect(contrastRatio(dark.textMuted, dark.surface)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(dark.textQuiet, dark.surface)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(dark.borderStrong, dark.surface)).toBeGreaterThanOrEqual(3)
    expect(contrastRatio(dark.accentForeground, dark.canvas)).toBeGreaterThanOrEqual(7)
    expect(contrastRatio(dark.onAccent, dark.action)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(dark.focus, dark.canvas)).toBeGreaterThanOrEqual(3)
  })

  it('keeps every approved palette configurable in both modes', () => {
    const palettes = Object.values(FRONTEND_PALETTES)

    expect(palettes.map((palette) => palette.id).sort()).toEqual([
      'amber',
      'graphite',
      'midnight',
      'teal',
      'violet',
    ])
    expect(new Set(palettes.map((palette) => palette.light.canvas))).toEqual(new Set(['#f6f8fa']))
    expect(new Set(palettes.map((palette) => palette.dark.canvas))).toEqual(new Set(['#0d1117']))
    expect(new Set(palettes.map((palette) => palette.dark.surface))).toEqual(new Set(['#161b22']))
    expect(new Set(palettes.map((palette) => palette.dark.action)).size).toBeGreaterThan(1)
    for (const palette of palettes) {
      expect(palette.light.surface).toBe('#ffffff')
      expect(palette.dark.canvas).not.toBe(palette.light.canvas)
      expect(palette.dark.surface).not.toBe(palette.light.surface)
      expect(palette.light.selected).not.toBe(palette.light.surface)
      expect(palette.dark.selected).not.toBe(palette.dark.surface)
      expect(contrastRatio(palette.light.onAccent, palette.light.action)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(palette.dark.onAccent, palette.dark.action)).toBeGreaterThanOrEqual(4.5)
      for (const mode of [palette.light, palette.dark]) {
        for (const background of [
          mode.canvas,
          mode.surface,
          mode.overlay,
          mode.control,
          mode.controlHover,
          mode.selected,
        ]) {
          expect(contrastRatio(mode.text, background)).toBeGreaterThanOrEqual(4.5)
          expect(contrastRatio(mode.accentForeground, background)).toBeGreaterThanOrEqual(4.5)
          expect(contrastRatio(mode.focus, background)).toBeGreaterThanOrEqual(3)
        }
        expect(contrastRatio(mode.onAccent, mode.actionHover)).toBeGreaterThanOrEqual(4.5)
        expect(contrastRatio(mode.onAccent, mode.actionActive)).toBeGreaterThanOrEqual(4.5)
        expect(contrastRatio(mode.selectedBorder, mode.selected)).toBeGreaterThanOrEqual(3)
        expect(contrastRatio(mode.selectedBorder, mode.surface)).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('round trips a selected design profile', () => {
    const config = resolveFrontendDesignSystem({
      paletteId: 'violet',
      fontId: 'source-sans',
      defaultMode: 'dark',
      density: 'comfortable',
      viewKinds: ['board', 'timeline'],
    })

    expect(frontendPreferencesFromConfig(config)).toEqual({
      paletteId: 'violet',
      fontId: 'source-sans',
      defaultMode: 'dark',
      density: 'comfortable',
      viewKinds: ['board', 'timeline'],
    })
    expect(config.pagePlan.primaryViewKind).toBe('board')
    expect(config.pagePlan.supportingViewKinds).toEqual(['timeline'])
  })

  it('builds one primary page plan from structured layout recipes', () => {
    const layouts = Object.values(FRONTEND_LAYOUT_RULES)
    const plan = buildFrontendPagePlan(['monitor', 'timeline'])

    expect(new Set(layouts.map((layout) => layout.recipeId)).size).toBe(layouts.length)
    for (const layout of layouts) {
      expect(() => buildFrontendPagePlan([layout.kind])).not.toThrow()
      expect(layout.recipeId).toMatch(/^RCP-[A-Z]+-001$/u)
      expect(layout.geometry.primaryMinWidth).toBeGreaterThanOrEqual(320)
      expect(layout.geometry.narrowBreakpoint).toBeGreaterThanOrEqual(layout.geometry.wideMinimumWidth)
      expect(layout.regions.filter((region) => region.role === 'primary')).toHaveLength(1)
      expect(layout.workspace.placement).toBe('explicit-grid')
      expect(layout.workspace.primarySurface).toBe('primary-work-surface')
      expect(layout.workspace.supportingSurface).toBe('structural-pane')
      expect(layout.workspace.primaryRegionId).toBe(
        layout.regions.find((region) => region.role === 'primary')?.id,
      )
      expect(layout.componentIds.every((id) => id.startsWith('CMP-'))).toBe(true)
      expect(layout.componentIds).not.toEqual(expect.arrayContaining(FRONTEND_RESERVED_COMPONENT_IDS))
      expect(layout.componentIds).not.toContain('CMP-LAYOUT-DASHBOARD-GRID')
      expect(new Set(layout.regions.map((region) => region.placement.narrow.order)).size)
        .toBe(layout.regions.length)
      for (const region of layout.regions) {
        expect(region.componentIds.every((id) => layout.componentIds.includes(id))).toBe(true)
        expect(region.placement.wide.columnStart).toBeGreaterThanOrEqual(1)
        expect(region.placement.wide.columnSpan).toBeGreaterThanOrEqual(1)
        expect(region.placement.wide.rowStart).toBeGreaterThanOrEqual(1)
      }
    }
    expect(plan.primaryViewKind).toBe('monitor')
    expect(plan.primaryLayout.recipeId).toBe('RCP-MONITOR-001')
    expect(plan.supportingViewKinds).toEqual(['timeline'])
    expect(plan.supportingLayouts.map((layout) => layout.recipeId)).toEqual(['RCP-TIMELINE-001'])
    expect(plan.geometry).toEqual(FRONTEND_LAYOUT_RULES.monitor.geometry)
    expect(plan.primaryComponentIds).toEqual(FRONTEND_LAYOUT_RULES.monitor.componentIds)
    expect(plan.supportingComponentIds).toEqual(FRONTEND_LAYOUT_RULES.timeline.componentIds)
    expect(plan.componentIds).toEqual(plan.primaryComponentIds)
    expect(plan.primaryComponentIds).not.toContain('CMP-FORM-DATE-TIME-INPUT')
    expect(plan.supportingComponentIds).toContain('CMP-FORM-DATE-TIME-INPUT')
    expect(FRONTEND_LAYOUT_RULES.board.componentIds).toContain('CMP-WORKFLOW-FLOW-BOARD')
    expect(FRONTEND_LAYOUT_RULES.monitor.workspace.measurement).toEqual({
      mode: 'task',
      approvedDecisionPurpose: 'decide-if-state-needs-action',
    })
    expect(FRONTEND_LAYOUT_RULES.workbench.workspace.measurement.mode).toBe('prohibited')
  })

  it('normalizes legacy custom palettes and rejects unsafe or inaccessible values', () => {
    const legacyConfig = resolveFrontendDesignSystem({
      paletteId: 'custom',
      customPalette: {
        name: 'Project blue',
        light: legacyColorMode(FRONTEND_PALETTES.midnight.light),
        dark: legacyColorMode(FRONTEND_PALETTES.midnight.dark),
      },
    })

    expect(legacyConfig.palette.light.action).toBe(legacyConfig.palette.light.accent)
    expect(legacyConfig.palette.light.accentForeground).toBe(legacyConfig.palette.light.accent)
    expect(legacyConfig.palette.dark.control).toBe(legacyConfig.palette.dark.surfaceSubtle)
    expect(legacyConfig.palette.dark.selected).toBe(legacyConfig.palette.dark.accentSoft)
    expect(contrastRatio(
      legacyConfig.palette.dark.onAccent,
      legacyConfig.palette.dark.action,
    )).toBeGreaterThanOrEqual(4.5)

    expect(() => resolveFrontendDesignSystem({
      paletteId: 'custom',
      customPalette: {
        name: 'Broken contrast',
        light: { ...FRONTEND_PALETTES.midnight.light },
        dark: {
          ...FRONTEND_PALETTES.midnight.dark,
          action: '#ffffff',
          onAccent: '#ffffff',
        },
      },
    })).toThrow(/onAccent on action/u)
    expect(() => resolveFrontendDesignSystem({
      paletteId: 'custom',
      customPalette: {
        name: 'Unsafe */ body { color: red; }',
        light: { ...FRONTEND_PALETTES.midnight.light },
        dark: { ...FRONTEND_PALETTES.midnight.dark },
      },
    })).toThrow(/unsupported characters/u)
  })

  it('migrates resolved 1.0 records from choices and discards unsafe derived data', () => {
    const current = resolveFrontendDesignSystem({
      paletteId: 'midnight',
      fontId: 'system',
      viewKinds: ['monitor', 'timeline'],
    })
    const legacy: FrontendDesignSystemConfigV1 = {
      schemaVersion: '1.0',
      contractId: current.contractId,
      writingProfileId: current.writingProfileId,
      palette: {
        ...current.palette,
        light: {
          ...legacyColorMode(current.palette.light),
          canvas: '#ffffff',
        },
        dark: legacyColorMode(current.palette.dark),
      },
      typography: current.typography,
      defaultMode: current.defaultMode,
      density: current.density,
      modeToggle: true,
      icons: { ...current.icons, family: 'lucide' },
      viewKinds: [...current.viewKinds],
      layouts: [{ componentIds: ['CMP-VIZ-THRESHOLD-BAND'] }],
    }

    const migrated = migrateFrontendDesignSystemConfig(legacy)

    expect(migrated.schemaVersion).toBe('1.1')
    expect(migrated.palette.light.canvas).toBe(FRONTEND_PALETTES.midnight.light.canvas)
    expect(migrated.pagePlan.primaryLayout.recipeId).toBe('RCP-MONITOR-001')
    expect(migrated.pagePlan.primaryComponentIds).not.toContain('CMP-VIZ-THRESHOLD-BAND')
    expect(renderFrontendDesignCss(legacy)).toContain('--eui-color-overlay:')
    expect(() => migrateFrontendDesignSystemConfig({
      ...legacy,
      schemaVersion: '9.0',
    })).toThrow(/schema version/u)
    expect(() => migrateFrontendDesignSystemConfig({
      ...legacy,
      modeToggle: false,
    })).toThrow(/contract identity/u)
  })

  it('validates every added color role on its intended surface', () => {
    const custom = (darkChanges: Partial<FrontendColorMode>) => resolveFrontendDesignSystem({
      paletteId: 'custom',
      customPalette: {
        name: 'Role check',
        light: { ...FRONTEND_PALETTES.midnight.light },
        dark: { ...FRONTEND_PALETTES.midnight.dark, ...darkChanges },
      },
    })

    expect(() => custom({ controlHover: '#f0f6fc' })).toThrow(/text on controlHover/u)
    expect(() => custom({ accentForeground: '#161b22' })).toThrow(/accentForeground on (?:canvas|surface)/u)
    expect(() => custom({ selectedBorder: FRONTEND_PALETTES.midnight.dark.selected })).toThrow(/selectedBorder on selected/u)
    expect(() => custom({ actionHover: '#ffffff' })).toThrow(/onAccent on actionHover/u)
    expect(() => custom({ overlay: '#58a6ff' })).toThrow(/text on overlay/u)
  })

  it('renders both modes and accessible motion defaults', () => {
    const css = renderFrontendDesignCss(resolveFrontendDesignSystem({
      paletteId: 'amber',
      fontId: 'ibm-plex',
      density: 'comfortable',
    }))

    expect(css).toContain(':root[data-theme="light"]')
    expect(css).toContain(':root[data-theme="dark"]')
    expect(css).toContain('@media (prefers-color-scheme: dark)')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('--eui-font-sans: "IBM Plex Sans"')
    expect(css).toContain('--eui-control-height: 40px')
    expect(css).toContain('--eui-color-accent-foreground:')
    expect(css).toContain('--eui-color-action:')
    expect(css).toContain('--eui-color-on-accent:')
    expect(css).toContain('--eui-color-control:')
    expect(css).toContain('--eui-color-selected:')
    expect(css).toContain('--eui-color-overlay:')
  })

  it('infers task-specific layouts instead of a dashboard', () => {
    expect(inferFrontendViewKinds([
      'Monitor telemetry channels and review the event history.',
    ])).toEqual(['monitor', 'timeline'])
    expect(inferFrontendViewKinds([
      'Write a document and resolve comments.',
    ])).toEqual(['editor'])
    expect(inferFrontendViewKinds([
      'Investigate one incident. Review its finding evidence.',
    ])[0]).toBe('case')
  })

  it('puts icon, help, copy, theme, and anti-trope rules in the prompt', () => {
    const prompt = buildFrontendDesignPrompt(resolveFrontendDesignSystem({
      viewKinds: ['editor', 'timeline'],
    }))

    expect(prompt).toContain('Use Lucide icons only.')
    expect(prompt).toContain('Match each action icon to its verb.')
    expect(prompt).toContain('Give each icon-only button a tooltip.')
    expect(prompt).toContain('Put a help icon next to complex domain terms.')
    expect(prompt).toContain('Do not use accent strips on cards, tiles, panels, sections, or summary blocks.')
    expect(prompt).toContain('Do not use an em dash in visible text.')
    expect(prompt).toContain('Use Document editor')
    expect(prompt).toContain('data-layout-recipe="RCP-EDITOR-001"')
    expect(prompt).toContain('Use contextual navigation, the editor header style, command-first actions, and the editor-sheet surface model.')
    expect(prompt).toContain('Use grid columns minmax(200px, 0.45fr) minmax(520px, 1.5fr) minmax(300px, 0.65fr)')
    expect(prompt).toContain('Put document-canvas in wide grid column 2, row 1. It spans 1 column.')
    expect(prompt).toContain('Use narrow order 1 for document-canvas. Use retain below 1080 pixels.')
    expect(prompt).toContain('Use these approved primary component IDs:')
    expect(prompt).toContain('Use Event timeline only as a supporting pattern inside the primary document editor shell.')
    expect(prompt).toContain('Its supporting component IDs are CMP-FILTER-BAR')
    expect(prompt).not.toContain('CMP-ENG-DIFF-VIEWER')
    expect(prompt).not.toContain('CMP-VIZ-THRESHOLD-BAND')
    expect(prompt).toContain('Use one primary page recipe.')
    expect(prompt).toContain('Do not reuse one shell for every product.')
    expect(prompt).toContain('Show one primary page action and no more than two secondary page actions.')
    expect(prompt).toContain('Do not put the complete action catalog in the page header.')
    expect(prompt).toContain('Do not put an overflow menu on every panel.')
    expect(prompt).toContain('Do not cover the workspace with a fixed toast.')
    expect(prompt).toContain('Keep the canvas and standard surfaces neutral.')
    expect(prompt).toContain('Use no more than two routine background tiers: canvas and surface.')
    expect(prompt).toContain('Use the accent foreground token for links, icons, and data emphasis.')
    expect(prompt).toContain('Use the action token for a filled primary action and the on-accent token for its text.')
    expect(prompt).toContain('Do not create accent-tinted navigation, extra background tiers, panel bands, or decorative gradients.')
    expect(prompt).toContain('Do not write a count-led headline')
    expect(prompt).toContain('Render exactly one visible h1 on each page.')
    expect(prompt).toContain('Make the page title larger than its summary.')
    expect(prompt).toContain('Make each section title larger than its description.')
    expect(prompt).toContain('data-region-role="primary" and data-surface-kind="primary-work-surface"')
    expect(prompt).toContain('Mark supporting layout regions with data-surface-kind="structural-pane".')
    expect(prompt).toContain('Keep the primary work surface dominant.')
    expect(prompt).toContain('Do not use a card or raised panel as a default region container.')
    expect(prompt).toContain('Use an inset object only for one bounded object')
    expect(prompt).toContain('Use an overlay only for transient content')
    expect(prompt).toContain('Do not scatter independent panels across the page.')
    expect(prompt).toContain('Do not render a metric surface in this recipe.')
    expect(prompt).toContain('Do not invent a metric, KPI, score, trend, or count.')
    expect(prompt).toContain('Do not add a default metric strip.')
    expect(prompt).toContain('Use 13 pixel or larger text for normal interface content.')

    const monitorPrompt = buildFrontendDesignPrompt(resolveFrontendDesignSystem({
      viewKinds: ['monitor'],
    }))
    expect(monitorPrompt).toContain(
      'data-metric-purpose="decide-if-state-needs-action"',
    )
    expect(monitorPrompt).not.toContain('Do not render a metric surface in this recipe.')

    const boardPrompt = buildFrontendDesignPrompt(resolveFrontendDesignSystem({
      viewKinds: ['board'],
    }))
    expect(boardPrompt).toContain('CMP-WORKFLOW-FLOW-BOARD')
    expect(boardPrompt).not.toContain('CMP-LAYOUT-DASHBOARD-GRID')
  })

  it('accepts a complete frontend source set', () => {
    const config = resolveFrontendDesignSystem()
    const sources = completeSources(config)

    expect(evaluateFrontendDesignSources(sources, config)).toEqual([])
  })

  it('requires exact contract, recipe, and configured token declarations in executable sources', () => {
    const config = resolveFrontendDesignSystem()
    const valid = completeSources(config)
    const wrongMarkup = {
      ...valid,
      'index.html': [
        valid['index.html']
          ?.replace('EUIT-FRONTEND-001', 'EUIT-FRONTEND-999')
          .replace('RCP-WORKBENCH-001', 'RCP-TABLE-001'),
        '<script type="application/json">',
        '{"contract":"EUIT-FRONTEND-001","recipe":"RCP-WORKBENCH-001"}',
        '</script>',
      ].join(''),
    }
    const wrongTokens = {
      ...valid,
      'styles.css': valid['styles.css']?.replace(
        '--eui-color-action: #0969da;',
        '--eui-color-action: #ff0000;',
      ) ?? '',
    }

    expect(evaluateFrontendDesignSources(wrongMarkup, config).map(({ code }) => code))
      .toEqual(expect.arrayContaining([
        'FRONTEND-DESIGN-CONTRACT',
        'FRONTEND-DESIGN-LAYOUT-RECIPE',
      ]))
    expect(evaluateFrontendDesignSources(wrongTokens, config).map(({ code }) => code))
      .toContain('FRONTEND-DESIGN-TOKENS')
  })

  it('requires every primary layout region and its exact placement metadata', () => {
    const config = resolveFrontendDesignSystem()
    const valid = completeSources(config)
    const region = config.pagePlan.primaryLayout.regions.find((candidate) => candidate.role === 'primary')
    if (!region) throw new Error('The test layout has no primary region.')
    const source = valid['index.html'] ?? ''
    const escapedId = region.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const openingPattern = new RegExp(`<section[^>]*data-region-id="${escapedId}"[^>]*>`, 'u')
    const opening = source.match(openingPattern)?.[0]
    if (!opening) throw new Error('The test source has no primary region opening tag.')
    const code = (nextSource: string) => evaluateFrontendDesignSources({
      ...valid,
      'index.html': nextSource,
    }, config).map((finding) => finding.code)
    const mutate = (attribute: string, expected: string, replacement: string) => source.replace(
      openingPattern,
      opening.replace(`${attribute}="${expected}"`, `${attribute}="${replacement}"`),
    )

    expect(code(source)).not.toContain('FRONTEND-DESIGN-REGION-CONTRACT')
    expect(code(source.replace(` data-region-id="${region.id}"`, '')))
      .toContain('FRONTEND-DESIGN-REGION-CONTRACT')
    expect(code(source.replace('</main>', `${opening}</section></main>`)))
      .toContain('FRONTEND-DESIGN-REGION-CONTRACT')

    const exactAttributes: ReadonlyArray<readonly [string, string, string]> = [
      ['data-region-role', region.role, region.role === 'primary' ? 'inspector' : 'primary'],
      ['data-region-priority', String(region.priority), region.priority === 3 ? '1' : '3'],
      ['data-surface-kind', 'primary-work-surface', 'structural-pane'],
      ['data-wide-column-start', String(region.placement.wide.columnStart), String(region.placement.wide.columnStart + 1)],
      ['data-wide-column-span', String(region.placement.wide.columnSpan), String(region.placement.wide.columnSpan + 1)],
      ['data-wide-row-start', String(region.placement.wide.rowStart), String(region.placement.wide.rowStart + 1)],
      ['data-region-order', String(region.placement.narrow.order), String(region.placement.narrow.order + 1)],
      ['data-narrow-behavior', region.narrowBehavior, region.narrowBehavior === 'retain' ? 'drawer' : 'retain'],
    ]
    for (const [attribute, expected, replacement] of exactAttributes) {
      expect(code(mutate(attribute, expected, replacement)), attribute)
        .toContain('FRONTEND-DESIGN-REGION-CONTRACT')
    }

    expect(code(source.replace(
      `data-region-id="${region.id}"`,
      'data-region-id="invented-region"',
    ))).toContain('FRONTEND-DESIGN-REGION-CONTRACT')
  })

  it('checks rendered text sizes but ignores custom-property token declarations', () => {
    const config = resolveFrontendDesignSystem()
    const valid = completeSources(config)
    const tokenOnly = {
      ...valid,
      'styles.css': `${valid['styles.css']}\n:root { --eui-font-size-caption: 10px; }`,
    }
    const tinyContent = {
      ...valid,
      'styles.css': `${valid['styles.css']}\n.record-label { font-size: var(--eui-font-size-caption, 11px); }`,
    }
    const metadata = {
      ...valid,
      'styles.css': `${valid['styles.css']}\n.record-metadata { font-size: 11px; }`,
    }

    expect(evaluateFrontendDesignSources(tokenOnly, config).map(({ code }) => code))
      .not.toContain('FRONTEND-DESIGN-TINY-TEXT')
    expect(evaluateFrontendDesignSources(tinyContent, config).map(({ code }) => code))
      .toContain('FRONTEND-DESIGN-TINY-TEXT')
    expect(evaluateFrontendDesignSources(metadata, config).map(({ code }) => code))
      .not.toContain('FRONTEND-DESIGN-TINY-TEXT')
  })

  it('requires one visible page heading and enforces responsive title hierarchy', () => {
    const config = resolveFrontendDesignSystem()
    const valid = completeSources(config)
    const withoutHeading = {
      ...valid,
      'index.html': valid['index.html']?.replace(
        '<h1 class="page-title">Artifact review</h1>',
        '<p>Artifact review</p>',
      ) ?? '',
    }
    const duplicateHeading = {
      ...valid,
      'index.html': valid['index.html']?.replace(
        '</main>',
        '<h1>Second page title</h1></main>',
      ) ?? '',
    }
    const hiddenHeading = {
      ...valid,
      'index.html': valid['index.html']?.replace(
        '</main>',
        '<h1 hidden>Print title</h1><h1 aria-hidden="true">Visual copy</h1></main>',
      ) ?? '',
    }
    const invertedPageHierarchy = {
      ...valid,
      'styles.css': `${valid['styles.css']}\n.page-title { font-size: 18px; }\n.page-summary { font-size: 20px; }`,
    }
    const invertedSectionHierarchy = {
      ...valid,
      'styles.css': `${valid['styles.css']}\n.section-title { font-size: 13px; }\n.section-description { font-size: 14px; }`,
    }
    const responsiveHierarchy = {
      ...valid,
      'styles.css': `${valid['styles.css']}\n@media (max-width: 700px) { .page-title { font-size: 24px; } .page-summary { font-size: 15px; } }`,
    }
    const invertedClampHierarchy = {
      ...valid,
      'styles.css': `${valid['styles.css']}\n.page-title { font-size: clamp(16px, 3vw, 22px); }\n.page-summary { font-size: 20px; }`,
    }
    const unresolvedHierarchy = {
      ...valid,
      'styles.css': `${valid['styles.css']}\n.page-title { font-size: var(--unknown-page-title); }`,
    }

    expect(evaluateFrontendDesignSources(withoutHeading, config).map(({ code }) => code))
      .toContain('FRONTEND-DESIGN-PAGE-H1')
    expect(evaluateFrontendDesignSources(duplicateHeading, config).map(({ code }) => code))
      .toContain('FRONTEND-DESIGN-PAGE-H1')
    expect(evaluateFrontendDesignSources(hiddenHeading, config).map(({ code }) => code))
      .not.toContain('FRONTEND-DESIGN-PAGE-H1')
    expect(evaluateFrontendDesignSources(invertedPageHierarchy, config).map(({ code }) => code))
      .toContain('FRONTEND-DESIGN-TITLE-HIERARCHY')
    expect(evaluateFrontendDesignSources(invertedSectionHierarchy, config).map(({ code }) => code))
      .toContain('FRONTEND-DESIGN-TITLE-HIERARCHY')
    expect(evaluateFrontendDesignSources(responsiveHierarchy, config).map(({ code }) => code))
      .not.toContain('FRONTEND-DESIGN-TITLE-HIERARCHY')
    expect(evaluateFrontendDesignSources(invertedClampHierarchy, config).map(({ code }) => code))
      .toContain('FRONTEND-DESIGN-TITLE-HIERARCHY')
    expect(evaluateFrontendDesignSources(unresolvedHierarchy, config).map(({ code }) => code))
      .toContain('FRONTEND-DESIGN-TITLE-HIERARCHY')
  })

  it('blocks panel layouts in the primary region but permits explicit inset objects', () => {
    const config = resolveFrontendDesignSystem()
    const valid = completeSources(config)
    const panelWall = {
      ...valid,
      'index.html': valid['index.html']?.replace(
        '<!--primary-content-end-->',
        '<div class="review-panel">A</div><div class="review-panel">B</div><!--primary-content-end-->',
      ) ?? '',
    }
    const panelRegion = {
      ...valid,
      'index.html': valid['index.html']?.replace(
        'data-region-role="primary" data-region-priority="1" data-surface-kind="primary-work-surface"',
        'data-region-role="primary" data-region-priority="1" data-surface-kind="primary-work-surface" class="raised-panel"',
      ) ?? '',
    }
    const insetObjects = {
      ...valid,
      'index.html': valid['index.html']?.replace(
        '</main>',
        [
          '<article class="record-card" data-surface-kind="inset-object">A</article>',
          '<article class="record-card" data-surface-kind="inset-object">B</article>',
          '</main>',
        ].join(''),
      ) ?? '',
    }

    expect(evaluateFrontendDesignSources(panelWall, config).map(({ code }) => code))
      .toContain('FRONTEND-DESIGN-PANEL-WRAPPERS')
    expect(evaluateFrontendDesignSources(panelRegion, config).map(({ code }) => code))
      .toContain('FRONTEND-DESIGN-PANEL-WRAPPERS')
    expect(evaluateFrontendDesignSources(insetObjects, config).map(({ code }) => code))
      .not.toContain('FRONTEND-DESIGN-PANEL-WRAPPERS')
  })

  it('allows metrics only for the approved primary measurement decision', () => {
    const workbench = resolveFrontendDesignSystem({ viewKinds: ['workbench'] })
    const workbenchSources = completeSources(workbench)
    const prohibitedMetric = {
      ...workbenchSources,
      'index.html': workbenchSources['index.html']?.replace(
        '</main>',
        '<section class="metric-strip" data-metric-purpose="decide-if-state-needs-action">12</section></main>',
      ) ?? '',
    }
    const monitor = resolveFrontendDesignSystem({ viewKinds: ['monitor'] })
    const monitorSources = completeSources(monitor)
    const approvedMetric = {
      ...monitorSources,
      'index.html': monitorSources['index.html']?.replace(
        '</main>',
        '<section class="metric-strip" data-metric-purpose="decide-if-state-needs-action">12</section></main>',
      ) ?? '',
    }
    const unapprovedMetric = {
      ...monitorSources,
      'index.html': monitorSources['index.html']?.replace(
        '</main>',
        '<section class="metric-strip" data-metric-purpose="show-interesting-numbers">12</section></main>',
      ) ?? '',
    }

    expect(evaluateFrontendDesignSources(prohibitedMetric, workbench).map(({ code }) => code))
      .toContain('FRONTEND-DESIGN-METRIC-PURPOSE')
    expect(evaluateFrontendDesignSources(approvedMetric, monitor).map(({ code }) => code))
      .not.toContain('FRONTEND-DESIGN-METRIC-PURPOSE')
    expect(evaluateFrontendDesignSources(unapprovedMetric, monitor).map(({ code }) => code))
      .toContain('FRONTEND-DESIGN-METRIC-PURPOSE')
  })

  it('blocks one icon for different button actions without flagging repeated actions or status icons', () => {
    const config = resolveFrontendDesignSystem()
    const valid = completeSources(config)
    const ambiguous = {
      ...valid,
      'index.html': valid['index.html']?.replace(
        '</main>',
        [
          '<button aria-label="Add record" data-scenario-action="add-record"><svg class="lucide" data-icon-name="plus"></svg></button>',
          '<button aria-label="Open record" data-semantic-action="open-record"><svg class="lucide" data-icon-name="plus"></svg></button>',
          '</main>',
        ].join(''),
      ) ?? '',
    }
    const repeatedActionAndStatus = {
      ...valid,
      'index.html': valid['index.html']?.replace(
        '</main>',
        [
          '<button aria-label="Save document" data-action="save"><svg class="lucide" data-name="save"></svg></button>',
          '<button aria-label="Save record" data-action="save"><svg class="lucide" data-name="save"></svg></button>',
          '<span>Ready <svg class="lucide" data-name="circle-check"></svg></span>',
          '<span>Complete <svg class="lucide" data-name="circle-check"></svg></span>',
          '</main>',
        ].join(''),
      ) ?? '',
    }
    const sharedCloseVerb = {
      ...valid,
      'index.html': valid['index.html']?.replace(
        '</main>',
        [
          '<button aria-label="Close help"><svg class="lucide" data-icon-name="x"></svg></button>',
          '<button aria-label="Close command menu"><svg class="lucide" data-icon-name="x"></svg></button>',
          '</main>',
        ].join(''),
      ) ?? '',
    }

    expect(evaluateFrontendDesignSources(ambiguous, config).map(({ code }) => code))
      .toContain('FRONTEND-DESIGN-ICON-MAPPING')
    expect(evaluateFrontendDesignSources(repeatedActionAndStatus, config).map(({ code }) => code))
      .not.toContain('FRONTEND-DESIGN-ICON-MAPPING')
    expect(evaluateFrontendDesignSources(sharedCloseVerb, config).map(({ code }) => code))
      .not.toContain('FRONTEND-DESIGN-ICON-MAPPING')
  })

  it('blocks mixed icons, missing help, visible em dashes, and AI-like effects', () => {
    const config = resolveFrontendDesignSystem()
    const findings = evaluateFrontendDesignSources({
      'index.html': [
        '<html data-design-contract="EUIT-FRONTEND-001">',
        '<button aria-label="Change theme"><i class="fa fa-moon"></i></button>',
        '<svg class="lucide"></svg>',
        '<h1>Three sessions wait</h1>',
        '<section class="metric-strip"><strong>12</strong></section>',
        '<p>Review — approve</p>',
        '</html>',
      ].join(''),
      'styles.css': [
        ':root { --eui-color-canvas: #fff; --eui-color-surface: #fff;',
        '--eui-color-text: #111; --eui-color-accent: #057;',
        '--eui-font-sans: Inter; }',
        'body { font-family: var(--eui-font-sans); }',
        '.card { border-left: 4px solid var(--eui-color-accent); }',
        '.investigation-row { border-left: 2px solid var(--eui-color-accent); }',
        '.summary { box-shadow: inset 3px 0 var(--eui-color-accent); }',
        '.metric::before { content: ""; background: var(--eui-color-accent); }',
        '.card p { font-size: 8px; }',
        '.hero { background: linear-gradient(red, blue); }',
      ].join('\n'),
      'runtime.js': "localStorage.setItem('theme', 'dark')",
    }, config)

    expect(findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      'FRONTEND-DESIGN-MODES',
      'FRONTEND-DESIGN-LAYOUT-RECIPE',
      'FRONTEND-DESIGN-SYSTEM-MODE',
      'FRONTEND-DESIGN-ICONS',
      'FRONTEND-DESIGN-TOOLTIP',
      'FRONTEND-DESIGN-HELP',
      'FRONTEND-DESIGN-EM-DASH',
      'FRONTEND-DESIGN-COUNT-HEADLINE',
      'FRONTEND-DESIGN-METRIC-PURPOSE',
      'FRONTEND-DESIGN-ACCENT-STRIP',
      'FRONTEND-DESIGN-EFFECT',
      'FRONTEND-DESIGN-RAW-COLOR',
      'FRONTEND-DESIGN-TINY-TEXT',
    ]))
  })
})
