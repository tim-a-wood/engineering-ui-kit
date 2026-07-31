import { describe, expect, it } from 'vitest'
import {
  buildFrontendDesignPrompt,
  evaluateFrontendDesignSources,
  frontendPreferencesFromConfig,
  inferFrontendViewKinds,
  renderFrontendDesignCss,
  resolveFrontendDesignSystem,
} from '../../src/capabilities/frontendDesignSystem.js'

describe('frontend design system', () => {
  it('resolves the Gulfstream enterprise defaults', () => {
    const config = resolveFrontendDesignSystem()

    expect(config.contractId).toBe('EUIT-FRONTEND-001')
    expect(config.writingProfileId).toBe('EUIT-STE-001')
    expect(config.palette.id).toBe('gulfstream')
    expect(config.typography.id).toBe('inter')
    expect(config.defaultMode).toBe('system')
    expect(config.modeToggle).toBe(true)
    expect(config.icons).toEqual(expect.objectContaining({
      family: 'lucide',
      viewBox: '0 0 24 24',
      strokeWidth: 2,
      helpIcon: 'circle-help',
    }))
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
    expect(prompt).toContain('Give each icon-only button a tooltip.')
    expect(prompt).toContain('Put a help icon next to complex domain terms.')
    expect(prompt).toContain('Do not use accent strips on cards, tiles, panels, sections, or summary blocks.')
    expect(prompt).toContain('Do not use an em dash in visible text.')
    expect(prompt).toContain('Use Document editor')
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
      'FRONTEND-DESIGN-ACCENT-STRIP',
      'FRONTEND-DESIGN-EFFECT',
    ]))
  })
})
