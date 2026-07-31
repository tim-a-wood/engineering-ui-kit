import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  FRONTEND_FONT_IDS,
  evaluateFrontendDesignSources,
  renderFrontendDesignCss,
  resolveFrontendDesignSystem,
} from '../../../../packages/core/dist/index.js'
import { productTrialSystems } from './systems.mjs'
import { renderProductDocument } from './ui/product-renderers.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../../../..')
const sampleRoot = path.join(repoRoot, 'e2e-samples/product-trials')
const sharedUiRoot = path.join(here, 'ui')
const expectedLayouts = [
  'review',
  'sessions',
  'writing',
  'telemetry',
  'trade',
  'hil',
  'supplier',
  'impact',
  'load',
  'fracas',
]
const configurablePaletteIds = ['midnight', 'graphite', 'teal', 'violet', 'amber']

function sortedUnique(values) {
  return [...new Set(values)].sort()
}

function assertSet(actual, expected, label) {
  const actualValues = sortedUnique(actual)
  const expectedValues = [...expected].sort()
  if (JSON.stringify(actualValues) !== JSON.stringify(expectedValues)) {
    throw new Error(`${label} coverage is ${actualValues.join(', ')}. Expected ${expectedValues.join(', ')}.`)
  }
}

function decodeHtml(value) {
  return String(value)
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}

function attributeValue(source, name) {
  const match = source.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))
  return match ? decodeHtml(match[1]) : null
}

function textContent(source) {
  return decodeHtml(source.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

function sourceActionGroupAudit(renderedHtml) {
  const groups = []
  const groupPattern = /<div\b[^>]*aria-label="Product actions"[^>]*>([\s\S]*?)<\/div>/g
  for (const [groupIndex, match] of [...renderedHtml.matchAll(groupPattern)].entries()) {
    const actions = []
    const buttonPattern = /<button\b([^>]*)>([\s\S]*?)<\/button>/g
    for (const buttonMatch of match[1].matchAll(buttonPattern)) {
      const attributes = buttonMatch[1]
      const semanticAction = attributeValue(attributes, 'data-semantic-action')
        ?? attributeValue(attributes, 'data-scenario-action')
      if (!semanticAction) continue
      const svgAttributes = buttonMatch[2].match(/<svg\b([^>]*)>/)?.[1] ?? ''
      const svgClasses = attributeValue(svgAttributes, 'class')?.split(/\s+/) ?? []
      const classIcon = svgClasses.find((name) => name.startsWith('lucide-') && name !== 'lucide')?.slice(7) ?? null
      const dataIconName = attributeValue(attributes, 'data-icon-name')
        ?? attributeValue(svgAttributes, 'data-icon-name')
      const actionIcon = attributeValue(attributes, 'data-action-icon')
      const iconName = dataIconName ?? actionIcon ?? classIcon
      actions.push({
        label: textContent(buttonMatch[2]),
        semanticAction,
        iconName,
        dataIconName,
        actionIcon,
        iconMetadata: dataIconName ? 'data-icon-name' : actionIcon ? 'data-action-icon' : classIcon ? 'svg-class' : 'missing',
      })
    }
    if (actions.length === 0) continue

    const duplicateIcons = []
    for (const iconName of sortedUnique(actions.map((action) => action.iconName).filter(Boolean))) {
      const uses = actions.filter((action) => action.iconName === iconName)
      if (new Set(uses.map((action) => action.label)).size > 1
        && new Set(uses.map((action) => action.semanticAction)).size > 1) {
        duplicateIcons.push({ iconName, actions: uses.map(({ label, semanticAction }) => ({ label, semanticAction })) })
      }
    }
    groups.push({ group: groupIndex + 1, actions, duplicateIcons })
  }
  return groups
}

function sourceVisualGrammarAudit(renderedHtml, system) {
  const h1Matches = [...renderedHtml.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
  const h1Count = h1Matches.length
  const h1Text = h1Matches[0] ? textContent(h1Matches[0][1]) : null
  const primaryWorkspaceSource = renderedHtml.match(/<main\b[^>]*data-region="primary-workspace"[^>]*>[\s\S]*<\/main>/i)?.[0] ?? ''
  const panelCount = (renderedHtml.match(/<article\b[^>]*class="[^"]*\bpanel\b/gi) ?? []).length
  const panelTitleCount = (renderedHtml.match(/class="[^"]*\bpanel-title\b/gi) ?? []).length
  const panelSubtitleCount = (renderedHtml.match(/class="[^"]*\bpanel-subtitle\b/gi) ?? []).length
  const headerMetricPurposes = [...renderedHtml.matchAll(/<header\b[^>]*>[\s\S]*?<\/header>/gi)]
    .flatMap((header) => [...header[0].matchAll(/data-metric-purpose="([^"]*)"/gi)])
    .map((metric) => decodeHtml(metric[1]).trim())
  const approvedMetricPurpose = system.design.config.pagePlan.primaryLayout.workspace.measurement
    .approvedDecisionPurpose?.trim() ?? null
  const actionGroups = sourceActionGroupAudit(renderedHtml)
  const actions = actionGroups.flatMap((group) => group.actions)

  if (h1Count !== 1) {
    throw new Error(`${system.slug} has ${h1Count} source h1 elements. Expected exactly one page h1.`)
  }
  if (h1Text !== system.headline) {
    throw new Error(`${system.slug} uses “${h1Text ?? 'missing'}” as its page h1. Expected the task title “${system.headline}”.`)
  }
  if (!/<h1\b/i.test(primaryWorkspaceSource)) {
    throw new Error(`${system.slug} does not place its page h1 inside the primary workspace.`)
  }
  if (panelCount === 0 || panelTitleCount !== panelCount || panelSubtitleCount !== panelCount) {
    throw new Error(
      `${system.slug} has ${panelCount} panels, ${panelTitleCount} explicit panel titles, and ${panelSubtitleCount} explicit panel subtitles. Each panel needs one title and one subtitle.`,
    )
  }
  if (headerMetricPurposes.some((purpose) => !approvedMetricPurpose || purpose !== approvedMetricPurpose)) {
    throw new Error(
      `${system.slug} places a metric strip in the page header without its approved task-decision purpose. Header purposes: ${headerMetricPurposes.join(' | ') || 'missing'}.`,
    )
  }
  if (actionGroups.length !== 1) {
    throw new Error(`${system.slug} has ${actionGroups.length} visible-action source groups. Expected one Product actions group.`)
  }
  if (actions.some((action) => !action.dataIconName)) {
    throw new Error(`${system.slug} has a visible action whose SVG does not expose data-icon-name.`)
  }
  const mismatchedIconMetadata = actions.filter((action) =>
    action.actionIcon && action.dataIconName && action.actionIcon !== action.dataIconName)
  if (mismatchedIconMetadata.length) {
    throw new Error(
      `${system.slug} has inconsistent action icon metadata: ${mismatchedIconMetadata.map((action) => `${action.label} (${action.actionIcon}/${action.dataIconName})`).join(' | ')}.`,
    )
  }
  const duplicateIcons = actionGroups.flatMap((group) => group.duplicateIcons)
  if (duplicateIcons.length) {
    const details = duplicateIcons.map((duplicate) =>
      `${duplicate.iconName}: ${duplicate.actions.map((action) => `${action.label} [${action.semanticAction}]`).join(', ')}`).join(' | ')
    throw new Error(`${system.slug} reuses an icon for distinct actions in one group: ${details}.`)
  }

  return {
    h1Count,
    h1Text,
    panelCount,
    panelTitleCount,
    panelSubtitleCount,
    headerMetricSurfaceCount: headerMetricPurposes.length,
    approvedHeaderMetricPurpose: headerMetricPurposes.length ? approvedMetricPurpose : null,
    actionGroupCount: actionGroups.length,
    visibleActionIconMetadata: Object.fromEntries(
      ['data-icon-name', 'data-action-icon', 'svg-class', 'missing'].map((kind) => [
        kind,
        actions.filter((action) => action.iconMetadata === kind).length,
      ]),
    ),
    duplicateActionIcons: [],
  }
}

function relativeLuminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi)?.map((channel) => Number.parseInt(channel, 16) / 255)
  if (!channels || channels.length !== 3) throw new Error(`Invalid color value: ${hex}`)
  const linear = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ))
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2])
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = relativeLuminance(foreground)
  const backgroundLuminance = relativeLuminance(background)
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
}

function colorChroma(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi)?.map((channel) => Number.parseInt(channel, 16) / 255)
  if (!channels || channels.length !== 3) throw new Error(`Invalid color value: ${hex}`)
  return Math.max(...channels) - Math.min(...channels)
}

function findUiRoot(system) {
  const modulesRoot = path.join(sampleRoot, system.slug, 'capabilities/modules')
  const uiRoots = fs.readdirSync(modulesRoot)
    .map((name) => path.join(modulesRoot, name, 'ui'))
    .filter((candidate) => fs.existsSync(path.join(candidate, 'index.html')))
  if (uiRoots.length !== 1) {
    throw new Error(`${system.slug} has ${uiRoots.length} frontend roots.`)
  }
  return uiRoots[0]
}

if (productTrialSystems.length !== 10) {
  throw new Error(`The stress set has ${productTrialSystems.length} products. Expected 10.`)
}
assertSet(productTrialSystems.map((system) => system.layout), expectedLayouts, 'Layout')
assertSet(productTrialSystems.map((system) => system.design.paletteId), ['midnight'], 'Default palette')
assertSet(productTrialSystems.map((system) => system.design.fontId), ['system'], 'Default font')
assertSet(productTrialSystems.map((system) => system.design.defaultMode), ['dark'], 'Start mode')
assertSet(productTrialSystems.map((system) => system.design.density), ['compact', 'comfortable'], 'Density')

const configurablePalettes = configurablePaletteIds.map((paletteId) =>
  resolveFrontendDesignSystem({ paletteId }).palette)
const paletteContrast = {}
for (const palette of configurablePalettes) {
  paletteContrast[palette.id] = {}
  for (const modeName of ['light', 'dark']) {
    const mode = palette[modeName]
    const checks = {
      textOnCanvas: contrastRatio(mode.text, mode.canvas),
      mutedTextOnSurface: contrastRatio(mode.textMuted, mode.surface),
      quietTextOnSurface: contrastRatio(mode.textQuiet, mode.surface),
      accentForegroundOnCanvas: contrastRatio(mode.accentForeground, mode.canvas),
      textOnAction: contrastRatio(mode.onAccent, mode.action),
      strongBorderOnSurface: contrastRatio(mode.borderStrong, mode.surface),
      focusOnCanvas: contrastRatio(mode.focus, mode.canvas),
    }
    if (colorChroma(mode.canvas) > 0.08 || colorChroma(mode.surface) > 0.08) {
      throw new Error(`${palette.name} ${modeName} mode uses a chromatic foundation.`)
    }
    if (mode.canvas === mode.surface) {
      throw new Error(`${palette.name} ${modeName} mode does not separate canvas from surface.`)
    }
    if (mode.selected === mode.surface) {
      throw new Error(`${palette.name} ${modeName} mode does not expose a selected state.`)
    }
    if (checks.textOnCanvas < 7) throw new Error(`${palette.name} ${modeName} primary text is below 7:1.`)
    if (checks.mutedTextOnSurface < 4.5 || checks.quietTextOnSurface < 4.5) {
      throw new Error(`${palette.name} ${modeName} secondary text is below 4.5:1.`)
    }
    if (checks.accentForegroundOnCanvas < 4.5 || checks.textOnAction < 4.5) {
      throw new Error(`${palette.name} ${modeName} accent roles are below 4.5:1.`)
    }
    if (checks.strongBorderOnSurface < 3 || checks.focusOnCanvas < 3) {
      throw new Error(`${palette.name} ${modeName} boundaries are below 3:1.`)
    }
    paletteContrast[palette.id][modeName] = Object.fromEntries(
      Object.entries(checks).map(([key, value]) => [key, Number(value.toFixed(2))]),
    )
  }
}

for (const fontId of FRONTEND_FONT_IDS) resolveFrontendDesignSystem({ fontId })

const sharedSources = {
  'styles.css': fs.readFileSync(path.join(sharedUiRoot, 'styles.css'), 'utf8'),
  'product-layouts.css': fs.readFileSync(path.join(sharedUiRoot, 'product-layouts.css'), 'utf8'),
  'modern-system.css': fs.readFileSync(path.join(sharedUiRoot, 'modern-system.css'), 'utf8'),
  'runtime.js': fs.readFileSync(path.join(sharedUiRoot, 'runtime.js'), 'utf8'),
}
const basePanelRule = sharedSources['modern-system.css'].match(/\.product-v5\s+\.panel\s*\{([^}]*)\}/)?.[1] ?? ''
if (
  !/border:\s*0(?:\s*;|$)/.test(basePanelRule)
  || !/border-radius:\s*0(?:\s*;|$)/.test(basePanelRule)
  || !/background:\s*transparent(?:\s*;|$)/.test(basePanelRule)
) {
  throw new Error('The base panel grammar must be flat: no border, no corner radius, and no opaque background.')
}
const results = []

for (const system of productTrialSystems) {
  const renderedHtml = renderProductDocument(system)
  const uiRoot = findUiRoot(system)
  const generatedHtml = fs.readFileSync(path.join(uiRoot, 'index.html'), 'utf8')
  if (renderedHtml !== generatedHtml) {
    throw new Error(`${system.slug} is stale. Run generate-samples.mjs.`)
  }
  for (const file of Object.keys(sharedSources)) {
    const generatedSource = fs.readFileSync(path.join(uiRoot, file), 'utf8')
    if (generatedSource !== sharedSources[file]) {
      throw new Error(`${system.slug}/${file} is stale. Run generate-samples.mjs.`)
    }
  }

  const config = system.design.config
  const themeSource = renderFrontendDesignCss(config)
  const generatedTheme = fs.readFileSync(path.join(uiRoot, 'theme.css'), 'utf8')
  if (themeSource !== generatedTheme) {
    throw new Error(`${system.slug}/theme.css is stale. Run generate-samples.mjs.`)
  }
  const sources = { 'index.html': renderedHtml, 'theme.css': themeSource, ...sharedSources }
  const findings = evaluateFrontendDesignSources(sources, config)
  const blockingFindings = findings.filter((finding) => finding.severity === 'blocking')
  if (blockingFindings.length > 0) {
    throw new Error(`${system.slug} failed the frontend gate: ${blockingFindings.map((item) => item.code).join(', ')}`)
  }
  const shellMode = renderedHtml.match(/data-shell-mode="([^"]+)"/)?.[1]
  const layoutRecipe = renderedHtml.match(/data-layout-recipe="([^"]+)"/)?.[1]
  const primaryView = renderedHtml.match(/data-primary-view="([^"]+)"/)?.[1]
  const visibleActionCount = (renderedHtml.match(/data-scenario-action=/g) ?? []).length
  const moreActionCount = (renderedHtml.match(/class="more-actions"/g) ?? []).length
  const commandActionCount = (renderedHtml.match(/data-command-item=/g) ?? []).length
  const primaryActionIcon = renderedHtml.match(/class="primary-action"[^>]*data-scenario-action[^>]*>[\s\S]{0,360}?data-icon-name="([a-z0-9-]+)"/)?.[1]
  const metricSurfaceCount = (renderedHtml.match(/data-metric-purpose=/g) ?? []).length
  const decisionFactSurfaceCount = (renderedHtml.match(/data-decision-purpose=/g) ?? []).length
  const visualGrammar = sourceVisualGrammarAudit(renderedHtml, system)
  if (!shellMode) throw new Error(`${system.slug} has no shell mode.`)
  if (layoutRecipe !== config.pagePlan.primaryLayout.recipeId) throw new Error(`${system.slug} does not expose its layout recipe.`)
  if (primaryView !== config.pagePlan.primaryViewKind) throw new Error(`${system.slug} does not expose its primary view.`)
  if ((renderedHtml.match(/data-region="primary-workspace"/g) ?? []).length !== 1) {
    throw new Error(`${system.slug} must expose one primary workspace container.`)
  }
  if ((renderedHtml.match(/data-region-role="primary"/g) ?? []).length !== 1) {
    throw new Error(`${system.slug} must expose one primary task region.`)
  }
  if (!renderedHtml.includes('id="design-system-manifest"')) {
    throw new Error(`${system.slug} has no machine-readable design manifest.`)
  }
  if (visibleActionCount < 1 || visibleActionCount > 3) {
    throw new Error(`${system.slug} shows ${visibleActionCount} page actions. Expected 1 to 3.`)
  }
  if (moreActionCount !== 1) {
    throw new Error(`${system.slug} has ${moreActionCount} labeled action menus. Expected 1.`)
  }
  if (commandActionCount !== system.scenarios.length) {
    throw new Error(`${system.slug} exposes ${commandActionCount} of ${system.scenarios.length} actions in its command menu.`)
  }
  if (!/class="[^"]*product-v5/.test(renderedHtml)) {
    throw new Error(`${system.slug} does not use the current outcome grammar.`)
  }
  if (/\bproduct-v[234]\b/.test(renderedHtml)) {
    throw new Error(`${system.slug} activates a legacy outcome grammar.`)
  }
  if (!primaryActionIcon) throw new Error(`${system.slug} has no semantic icon on its primary action.`)
  if (/^\s*(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/i.test(system.headline)) {
    throw new Error(`${system.slug} has a count-led page title.`)
  }
  if (!system.decisionPurpose && system.decisionFacts?.length) {
    throw new Error(`${system.slug} defines decision facts without a decision purpose.`)
  }
  if (system.decisionPurpose && (!Array.isArray(system.decisionFacts) || system.decisionFacts.length < 1)) {
    throw new Error(`${system.slug} declares a decision purpose without a fact.`)
  }
  if (decisionFactSurfaceCount !== (system.decisionPurpose ? 1 : 0)) {
    throw new Error(`${system.slug} does not match its declared decision purpose.`)
  }
  if (metricSurfaceCount !== 0) {
    throw new Error(`${system.slug} adds a default metric surface. Keep decision facts with the task that uses them.`)
  }
  if (/Open panel menu/.test(renderedHtml)) {
    throw new Error(`${system.slug} contains a generic panel menu.`)
  }
  if (!/role="status" data-scenario-result=/.test(renderedHtml)) {
    throw new Error(`${system.slug} has no accessible contextual action result.`)
  }
  if (/reward-toast|reward-spark|reward-track/.test(renderedHtml + sharedSources['styles.css'])) {
    throw new Error(`${system.slug} still contains generic reward UI.`)
  }
  results.push({
    slug: system.slug,
    productKind: system.productKind,
    architecture: system.architecture.style,
    moduleCount: system.architecture.modules.length,
    scenarioCount: system.scenarios.length,
    visibleActionCount,
    commandActionCount,
    shellMode,
    layoutRecipe,
    primaryView,
    regionCount: (renderedHtml.match(/data-region-id=/g) ?? []).length,
    primaryActionIcon,
    metricSurfaceCount,
    decisionFactSurfaceCount,
    decisionPurpose: system.decisionPurpose ?? null,
    visualGrammar,
    design: {
      palette: system.design.palette,
      font: system.design.fontId,
      startMode: system.design.defaultMode,
      density: system.design.density,
      iconFamily: system.design.iconFamily,
    },
    sourceHash: crypto.createHash('sha256').update(renderedHtml).digest('hex'),
    findings,
  })
}

if (new Set(results.map((result) => result.sourceHash)).size !== results.length) {
  throw new Error('Two product frontends have the same rendered source.')
}
if (new Set(results.map((result) => result.primaryActionIcon)).size < 5) {
  throw new Error('The primary actions do not use enough semantic icon meanings.')
}
if (results.filter((result) => result.metricSurfaceCount === 0).length < 4) {
  throw new Error('Too many product views add a metric surface by default.')
}

const report = {
  generatedAt: new Date().toISOString(),
  contractId: 'EUIT-FRONTEND-001',
  writingProfileId: 'EUIT-STE-001',
  products: results.length,
  layouts: sortedUnique(results.map((result) => result.productKind)),
  defaultPalettes: sortedUnique(productTrialSystems.map((system) => system.design.paletteId)),
  configurablePalettes: configurablePalettes.map((palette) => palette.id),
  paletteContrast,
  productsWithMetrics: results.filter((result) => result.metricSurfaceCount > 0).length,
  productsWithoutMetrics: results.filter((result) => result.metricSurfaceCount === 0).length,
  productsWithDecisionFacts: results.filter((result) => result.decisionFactSurfaceCount > 0).length,
  productsWithoutDecisionFacts: results.filter((result) => result.decisionFactSurfaceCount === 0).length,
  defaultFonts: sortedUnique(productTrialSystems.map((system) => system.design.fontId)),
  configurableFonts: FRONTEND_FONT_IDS,
  startModes: sortedUnique(productTrialSystems.map((system) => system.design.defaultMode)),
  densities: sortedUnique(productTrialSystems.map((system) => system.design.density)),
  blockingFindings: results.flatMap((result) => result.findings).filter((finding) => finding.severity === 'blocking').length,
  warningFindings: results.flatMap((result) => result.findings).filter((finding) => finding.severity === 'warning').length,
  visualGrammarGates: {
    pageHeading: 'Exactly one h1. Runtime size must exceed the page summary.',
    panelHierarchy: 'Every panel title must be larger than its subtitle.',
    headerMetrics: 'A header metric strip requires the product task-decision purpose.',
    structuralSurfaces: 'Primary workspace structure must use flat regions and no more than two opaque neutral backgrounds.',
    deterministicLayout: 'Structural siblings must be stable and non-overlapping at 1440, 1024, 768, and 390 pixels.',
    actionIcons: 'Distinct actions in one visible group must use distinct semantic icons.',
  },
  results,
}

const reportFlag = process.argv.indexOf('--report')
if (reportFlag >= 0) {
  const reportPath = process.argv[reportFlag + 1]
  if (!reportPath) throw new Error('The --report option requires a path.')
  const absoluteReportPath = path.resolve(reportPath)
  fs.mkdirSync(path.dirname(absoluteReportPath), { recursive: true })
  fs.writeFileSync(absoluteReportPath, `${JSON.stringify(report, null, 2)}\n`)
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
