import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  evaluateFrontendDesignSources,
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
const expectedPalettes = ['gulfstream', 'graphite', 'teal', 'violet', 'amber']
const expectedFonts = ['system', 'inter', 'plex', 'source', 'atkinson']
const fontMap = {
  system: 'system',
  inter: 'inter',
  plex: 'ibm-plex',
  source: 'source-sans',
  atkinson: 'atkinson',
}

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
assertSet(productTrialSystems.map((system) => system.design.paletteId), expectedPalettes, 'Palette')
assertSet(productTrialSystems.map((system) => system.design.fontId), expectedFonts, 'Font')
assertSet(productTrialSystems.map((system) => system.design.defaultMode), ['system', 'light', 'dark'], 'Start mode')
assertSet(productTrialSystems.map((system) => system.design.density), ['compact', 'comfortable'], 'Density')

const sharedSources = {
  'styles.css': fs.readFileSync(path.join(sharedUiRoot, 'styles.css'), 'utf8'),
  'product-layouts.css': fs.readFileSync(path.join(sharedUiRoot, 'product-layouts.css'), 'utf8'),
  'runtime.js': fs.readFileSync(path.join(sharedUiRoot, 'runtime.js'), 'utf8'),
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

  const config = resolveFrontendDesignSystem({
    paletteId: system.design.paletteId,
    fontId: fontMap[system.design.fontId],
    defaultMode: system.design.defaultMode,
    density: system.design.density,
  })
  const sources = { 'index.html': renderedHtml, ...sharedSources }
  const findings = evaluateFrontendDesignSources(sources, config)
  if (findings.length > 0) {
    throw new Error(`${system.slug} failed the frontend gate: ${findings.map((item) => item.code).join(', ')}`)
  }
  const shellMode = renderedHtml.match(/data-shell-mode="([^"]+)"/)?.[1]
  const composition = renderedHtml.match(/data-composition="([^"]+)"/)?.[1]
  const visibleActionCount = (renderedHtml.match(/data-scenario-action=/g) ?? []).length
  const moreActionCount = (renderedHtml.match(/class="more-actions"/g) ?? []).length
  const commandActionCount = (renderedHtml.match(/data-command-item=/g) ?? []).length
  const primaryActionIcon = renderedHtml.match(/class="primary-action"[^>]*data-scenario-action[^>]*>[\s\S]{0,180}?lucide-([a-z-]+)/)?.[1]
  if (!shellMode) throw new Error(`${system.slug} has no shell mode.`)
  if (!composition) throw new Error(`${system.slug} has no composition identity.`)
  if (visibleActionCount < 1 || visibleActionCount > 3) {
    throw new Error(`${system.slug} shows ${visibleActionCount} page actions. Expected 1 to 3.`)
  }
  if (moreActionCount !== 1) {
    throw new Error(`${system.slug} has ${moreActionCount} labeled action menus. Expected 1.`)
  }
  if (commandActionCount !== system.scenarios.length) {
    throw new Error(`${system.slug} exposes ${commandActionCount} of ${system.scenarios.length} actions in its command menu.`)
  }
  if (!/class="[^"]*product-v4/.test(renderedHtml)) {
    throw new Error(`${system.slug} does not use the current outcome grammar.`)
  }
  if (!primaryActionIcon) throw new Error(`${system.slug} has no semantic icon on its primary action.`)
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
    composition,
    primaryActionIcon,
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
if (new Set(results.map((result) => result.shellMode)).size !== results.length) {
  throw new Error('Two product frontends use the same shell mode.')
}
if (new Set(results.map((result) => result.composition)).size !== results.length) {
  throw new Error('Two product frontends use the same composition identity.')
}
if (new Set(results.map((result) => result.primaryActionIcon)).size < 5) {
  throw new Error('The primary actions do not use enough semantic icon meanings.')
}

const report = {
  generatedAt: new Date().toISOString(),
  contractId: 'EUIT-FRONTEND-001',
  writingProfileId: 'EUIT-STE-001',
  products: results.length,
  layouts: sortedUnique(results.map((result) => result.productKind)),
  palettes: sortedUnique(productTrialSystems.map((system) => system.design.paletteId)),
  fonts: sortedUnique(productTrialSystems.map((system) => system.design.fontId)),
  startModes: sortedUnique(productTrialSystems.map((system) => system.design.defaultMode)),
  densities: sortedUnique(productTrialSystems.map((system) => system.design.density)),
  blockingFindings: 0,
  warningFindings: 0,
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
