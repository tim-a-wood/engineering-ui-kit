import { describe, expect, it } from 'vitest'
import {
  FRONTEND_PALETTES,
  buildFrontendDesignPrompt,
  evaluateFrontendDesignSources,
  frontendPreferencesFromConfig,
  inferFrontendViewKinds,
  renderFrontendDesignCss,
  resolveFrontendDesignSystem,
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

describe('frontend design system', () => {
  it('resolves the Midnight enterprise defaults', () => {
    const config = resolveFrontendDesignSystem()

    expect(config.contractId).toBe('EUIT-FRONTEND-001')
    expect(config.writingProfileId).toBe('EUIT-STE-001')
    expect(config.palette.id).toBe('midnight')
    expect(config.typography.id).toBe('inter')
    expect(config.defaultMode).toBe('dark')
    expect(config.modeToggle).toBe(true)
    expect(config.palette.light.surface).toBe('#ffffff')
    expect(config.palette.light.accent).toBe('#145ea8')
    expect(config.palette.dark.canvas).toBe('#080d14')
    expect(config.palette.dark.surface).toBe('#111923')
    expect(config.palette.dark.surfaceSubtle).toBe('#111923')
    expect(config.palette.dark.surfaceRaised).toBe('#111923')
    expect(config.palette.dark.text).toBe('#f4f6f8')
    expect(config.palette.dark.accent).toBe('#70a0cf')
    expect(config.icons).toEqual(expect.objectContaining({
      family: 'lucide',
      viewBox: '0 0 24 24',
      strokeWidth: 2,
      helpIcon: 'circle-help',
    }))
  })

  it('uses accessible contrast in the Midnight dark palette', () => {
    const { dark } = FRONTEND_PALETTES.midnight

    expect(new Set([dark.surface, dark.surfaceSubtle, dark.surfaceRaised]).size).toBe(1)
    expect(contrastRatio(dark.text, dark.canvas)).toBeGreaterThanOrEqual(7)
    expect(contrastRatio(dark.textMuted, dark.surface)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(dark.textQuiet, dark.surface)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(dark.borderStrong, dark.surface)).toBeGreaterThanOrEqual(3)
    expect(contrastRatio(dark.accent, dark.canvas)).toBeGreaterThanOrEqual(7)
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
    expect(new Set(palettes.map((palette) => palette.dark.canvas)).size).toBe(palettes.length)
    for (const palette of palettes) {
      expect(palette.light.surface).toBe('#ffffff')
      expect(new Set([palette.light.surface, palette.light.surfaceSubtle, palette.light.surfaceRaised]).size).toBe(1)
      expect(palette.dark.canvas).not.toBe(palette.light.canvas)
      expect(palette.dark.surface).not.toBe(palette.light.surface)
      expect(new Set([palette.dark.surface, palette.dark.surfaceSubtle, palette.dark.surfaceRaised, palette.dark.accentSoft]).size).toBe(1)
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
  })

  it('infers task-specific layouts instead of a dashboard', () => {
    expect(inferFrontendViewKinds([
      'Monitor telemetry channels and review the event history.',
    ])).toEqual(['workbench', 'monitor', 'timeline'])
    expect(inferFrontendViewKinds([
      'Write a document and resolve comments.',
    ])).toEqual(['editor'])
  })

  it('puts icon, help, copy, theme, and anti-trope rules in the prompt', () => {
    const prompt = buildFrontendDesignPrompt(resolveFrontendDesignSystem({
      viewKinds: ['editor'],
    }))

    expect(prompt).toContain('Use Lucide icons only.')
    expect(prompt).toContain('Match each action icon to its verb.')
    expect(prompt).toContain('Give each icon-only button a tooltip.')
    expect(prompt).toContain('Put a help icon next to complex domain terms.')
    expect(prompt).toContain('Do not use accent strips on cards, tiles, panels, sections, or summary blocks.')
    expect(prompt).toContain('Do not use an em dash in visible text.')
    expect(prompt).toContain('Use Document editor')
    expect(prompt).toContain('Use contextual navigation, the editor header style, command-first actions, and the editor-sheet surface model.')
    expect(prompt).toContain('Do not reuse one shell for every product.')
    expect(prompt).toContain('Show one primary page action and no more than two secondary page actions.')
    expect(prompt).toContain('Do not put the complete action catalog in the page header.')
    expect(prompt).toContain('Do not put an overflow menu on every panel.')
    expect(prompt).toContain('Do not cover the workspace with a fixed toast.')
    expect(prompt).toContain('use one near-black navy canvas and one subtly lighter component surface.')
    expect(prompt).toContain('Do not create extra background tiers, blue panel bands, or decorative gradients.')
    expect(prompt).toContain('Use a restrained blue accent only for actions, focus, selection, and data emphasis.')
    expect(prompt).toContain('Do not write a count-led headline')
    expect(prompt).toContain('Do not invent a metric, KPI, score, trend, or count.')
    expect(prompt).toContain('Do not add a default metric strip.')
    expect(prompt).toContain('Use 13 pixel or larger text for normal interface content.')
  })

  it('accepts a complete frontend source set', () => {
    const config = resolveFrontendDesignSystem()
    const css = renderFrontendDesignCss(config)
    const sources = {
      'index.html': [
        '<html data-design-contract="EUIT-FRONTEND-001">',
        '<button aria-label="Change color mode" data-theme-toggle>',
        '<svg class="lucide" data-lucide="sun"></svg>',
        '<span role="tooltip">Change mode</span>',
        '</button>',
        '<button aria-label="Open help" data-help-trigger>',
        '<svg class="lucide" data-lucide="circle-help"></svg>',
        '<span role="tooltip">Open help</span>',
        '</button>',
        '</html>',
      ].join(''),
      'styles.css': css,
      'runtime.js': "localStorage.setItem('eui-color-mode', 'dark')",
    }

    expect(evaluateFrontendDesignSources(sources, config)).toEqual([])
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
        '.hero { background: linear-gradient(red, blue); }',
      ].join('\n'),
      'runtime.js': "localStorage.setItem('theme', 'dark')",
    }, config)

    expect(findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      'FRONTEND-DESIGN-MODES',
      'FRONTEND-DESIGN-SYSTEM-MODE',
      'FRONTEND-DESIGN-ICONS',
      'FRONTEND-DESIGN-TOOLTIP',
      'FRONTEND-DESIGN-HELP',
      'FRONTEND-DESIGN-EM-DASH',
      'FRONTEND-DESIGN-COUNT-HEADLINE',
      'FRONTEND-DESIGN-METRIC-PURPOSE',
      'FRONTEND-DESIGN-ACCENT-STRIP',
      'FRONTEND-DESIGN-EFFECT',
    ]))
  })
})
